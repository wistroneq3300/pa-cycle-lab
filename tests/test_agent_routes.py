"""HTTP contract tests for /api/agent/runs* (P3-b).

Uses the real integration app so route wiring, the auth dependency and the
library loader are exercised rather than mocked. Runs against an isolated data
directory so the checked-in datasets are never touched.
"""
import os
import shutil
import sys
import tempfile
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)


def _dataset_dir():
    data = os.path.join(ROOT, 'data')
    if not os.path.isdir(data):
        return None
    for name in sorted(os.listdir(data)):
        if os.path.exists(os.path.join(data, name, 'tests.json')):
            return os.path.join(data, name)
    return None


def _build_client(tmp_dir):
    # integration.settings requires CYCLE_INSTANCE to be a relative subdir of the
    # checkout, and PA_DATA_DIR to resolve to exactly that dir. So create the
    # isolated instance *under* ROOT/data rather than in the system temp dir.
    rel = os.path.relpath(tmp_dir, ROOT)
    os.makedirs(tmp_dir, exist_ok=True)
    shutil.copy(os.path.join(_dataset_dir(), 'tests.json'),
                os.path.join(tmp_dir, 'tests.json'))
    os.environ['CYCLE_MODE'] = 'synthetic'
    os.environ['CYCLE_INSTANCE'] = rel
    os.environ['PA_DATA_DIR'] = tmp_dir
    os.environ['PA_AGENT_ATTACHMENTS_DIR'] = os.path.join(tmp_dir, 'attachments')
    from fastapi.testclient import TestClient
    from integration.web import app
    return TestClient(app)


class AgentRunRoutes(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if _dataset_dir() is None:
            raise unittest.SkipTest('no tests.json dataset present')
        cls.tmpdir = tempfile.mkdtemp(prefix='.agent-test-', dir=os.path.join(ROOT, 'data'))
        cls.client = _build_client(cls.tmpdir)
        tl = cls.client.get('/api/testlibrary').json()
        cls.item = next(it for sheet in tl['sheets'].values()
                        for it in sheet.get('items', []) if it.get('ai_review'))

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmpdir, ignore_errors=True)

    def test_list_is_empty_or_list(self):
        r = self.client.get('/api/agent/runs')
        self.assertEqual(r.status_code, 200)
        self.assertIsInstance(r.json()['runs'], list)

    def test_create_get_context_roundtrip(self):
        vid = self.item['case_variant_id']
        created = self.client.post('/api/agent/runs', json={'case_variant_id': vid})
        self.assertEqual(created.status_code, 200)
        run = created.json()['run']
        self.assertEqual(run['status'], 'PENDING')
        self.assertEqual(run['case_variant_id'], vid)
        rid = run['run_id']

        got = self.client.get(f'/api/agent/runs/{rid}').json()['run']
        self.assertTrue(got['context_verified'])
        self.assertEqual(got['context']['case_variant_id'], vid)
        self.assertEqual(got['context']['testcase']['code'], self.item.get('code'))
        self.assertEqual(got['context']['ai_review'], self.item.get('ai_review'))

        ctx = self.client.get(f'/api/agent/runs/{rid}/context').json()
        self.assertTrue(ctx['context_verified'])
        self.assertEqual(ctx['context']['run_id'], rid)

    def test_unknown_variant_is_404(self):
        r = self.client.post('/api/agent/runs', json={'case_variant_id': 'case-nope'})
        self.assertEqual(r.status_code, 404)

    def test_unknown_run_is_404(self):
        self.assertEqual(self.client.get('/api/agent/runs/does-not-exist').status_code, 404)

    def test_missing_variant_field_is_422(self):
        self.assertEqual(self.client.post('/api/agent/runs', json={}).status_code, 422)

    def test_post_message_unknown_run_is_404(self):
        r = self.client.post('/api/agent/runs/does-not-exist/messages', json={'text': 'hi'})
        self.assertEqual(r.status_code, 404)

    def test_post_message_requires_text(self):
        vid = self.item['case_variant_id']
        rid = self.client.post('/api/agent/runs', json={'case_variant_id': vid}).json()['run']['run_id']
        self.assertEqual(
            self.client.post(f'/api/agent/runs/{rid}/messages', json={'text': '   '}).status_code, 422)

    def test_post_message_without_conversation_is_409(self):
        # A freshly created run is PENDING with no bound conversation yet.
        vid = self.item['case_variant_id']
        rid = self.client.post('/api/agent/runs', json={'case_variant_id': vid}).json()['run']['run_id']
        r = self.client.post(f'/api/agent/runs/{rid}/messages', json={'text': 'hello'})
        self.assertEqual(r.status_code, 409)

    def test_active_lookup_requires_case_variant(self):
        self.assertEqual(self.client.get('/api/agent/active').status_code, 422)

    def test_active_lookup_returns_none_when_no_live_run(self):
        r = self.client.get('/api/agent/active', params={'case_variant_id': 'case-none'})
        self.assertEqual(r.status_code, 200)
        self.assertIsNone(r.json()['run'])

    def test_supplemental_records_a_revision(self):
        vid = self.item['case_variant_id']
        rid = self.client.post('/api/agent/runs', json={'case_variant_id': vid}).json()['run']['run_id']
        r = self.client.post(f'/api/agent/runs/{rid}/supplemental', json={'text': '只測 slot 1'})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()['revision'], 1)
        self.assertIn('slot 1', r.json()['supplemental']['text'])

    def test_attachment_upload_stores_and_lists(self):
        vid = self.item['case_variant_id']
        rid = self.client.post('/api/agent/runs', json={'case_variant_id': vid}).json()['run']['run_id']
        r = self.client.post(
            f'/api/agent/runs/{rid}/attachments',
            params={'name': 'spec.txt', 'kind': 'file', 'mime': 'text/plain'},
            content=b'EXPECTED SPEC CONTENT'.decode().encode())
        self.assertEqual(r.status_code, 200, r.text)
        aid = r.json()['attachment']['attachment_id']
        listed = self.client.get(f'/api/agent/runs/{rid}/attachments').json()['attachments']
        self.assertEqual([a['name'] for a in listed], ['spec.txt'])
        # text-like content is extracted so the agent can read it
        rec = self.client.get(f'/api/agent/runs/{rid}').json()['run']
        self.assertEqual(len(rec['attachments']), 1)
        # delete removes it
        d = self.client.delete(f'/api/agent/runs/{rid}/attachments/{aid}')
        self.assertEqual(d.status_code, 200)
        self.assertEqual(
            self.client.get(f'/api/agent/runs/{rid}/attachments').json()['attachments'], [])

    def test_attachment_upload_unknown_run_is_404(self):
        r = self.client.post('/api/agent/runs/nope/attachments',
                             params={'name': 'x.txt'}, content=b'x')
        self.assertEqual(r.status_code, 404)


if __name__ == '__main__':
    unittest.main()
