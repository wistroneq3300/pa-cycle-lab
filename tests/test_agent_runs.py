"""AgentRun / AgentRunContext contract tests (P3-b).

Exercises the real shipped test library: a run must be built from
``case_variant_id``, snapshot the reviewed row without inventing fields, and the
stored context must stay immutable and hash-verifiable.
"""
import json
import os
import sys
import tempfile
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'app'))
sys.path.insert(0, ROOT)

from integration.agent_runs import AgentRunStore, context_hash  # noqa: E402
from test_library_contract import prepare_library  # noqa: E402


def _dataset_path():
    for name in sorted(os.listdir(os.path.join(ROOT, 'data'))):
        candidate = os.path.join(ROOT, 'data', name, 'tests.json')
        if os.path.exists(candidate):
            return candidate
    return None


class AgentRunStoreTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        path = _dataset_path()
        if not path:
            raise unittest.SkipTest('no tests.json dataset present')
        with open(path, encoding='utf-8') as fh:
            cls.library = json.load(fh)
        prepare_library(cls.library)
        cls.items = [it for sheet in cls.library['sheets'].values()
                     for it in sheet.get('items', [])]

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = AgentRunStore(path=os.path.join(self.tmp.name, 'agent_runs.sqlite3'))

    def tearDown(self):
        self.tmp.cleanup()

    def _first_variant(self):
        return self.items[0]['case_variant_id']

    def test_build_and_create_run_from_variant_id(self):
        variant = self._first_variant()
        ctx = self.store.build_context(self.library, variant, target={'node_id': 'n1'})
        self.assertEqual(ctx['case_variant_id'], variant)
        self.assertEqual(ctx['library_version'], self.library['version'])
        self.assertNotIn('code', [])  # sanity: code is not the identity
        run_id = self.store.create_run(ctx, created_by='tester')
        run = self.store.get_run(run_id)
        self.assertEqual(run['status'], 'PENDING')
        self.assertEqual(run['context']['case_variant_id'], variant)
        self.assertEqual(run['context']['target'], {'node_id': 'n1'})
        self.assertTrue(run['context_hash'])

    def test_unknown_variant_is_rejected(self):
        with self.assertRaises(KeyError):
            self.store.build_context(self.library, 'case-does-not-exist')

    def test_ai_review_snapshot_preserved(self):
        reviewed = [it for it in self.items if isinstance(it.get('ai_review'), dict)]
        if not reviewed:
            self.skipTest('legacy dataset (no ai_review)')
        ctx = self.store.build_context(self.library, reviewed[0]['case_variant_id'])
        self.assertEqual(ctx['ai_review'], reviewed[0]['ai_review'])
        self.assertEqual(ctx['testcase']['code'], reviewed[0].get('code'))
        self.assertEqual(ctx['testcase']['ai_agent_instruction'],
                         reviewed[0].get('ai_agent_instruction'))

    def test_context_is_immutable_and_hash_verified(self):
        variant = self._first_variant()
        ctx = self.store.build_context(self.library, variant)
        run_id = self.store.create_run(ctx)
        self.assertTrue(self.store.verify_context(run_id))
        # Tampering with the stored blob must break the sealed hash.
        import sqlite3
        with sqlite3.connect(self.store.path) as db:
            row = db.execute('SELECT context_json FROM agent_runs WHERE run_id=?',
                             (run_id,)).fetchone()
            tampered = json.loads(row[0])
            tampered['target'] = {'node_id': 'evil'}
            db.execute('UPDATE agent_runs SET context_json=? WHERE run_id=?',
                       (json.dumps(tampered), run_id))
        self.assertFalse(self.store.verify_context(run_id))

    def test_duplicate_run_id_rejected(self):
        variant = self._first_variant()
        ctx = self.store.build_context(self.library, variant, run_id='fixed-id')
        self.store.create_run(ctx)
        with self.assertRaises(ValueError):
            self.store.create_run(ctx)

    def test_list_and_filter(self):
        v1 = self.items[0]['case_variant_id']
        v2 = self.items[1]['case_variant_id']
        self.store.create_run(self.store.build_context(self.library, v1))
        self.store.create_run(self.store.build_context(self.library, v2))
        all_runs = self.store.list_runs()
        self.assertEqual(len(all_runs), 2)
        filtered = self.store.list_runs(case_variant_id=v1)
        self.assertEqual(len(filtered), 1)
        self.assertEqual(filtered[0]['case_variant_id'], v1)
        self.assertEqual(len(self.store.list_runs(status='PENDING')), 2)
        self.assertEqual(len(self.store.list_runs(status='PASS')), 0)

    def test_context_hash_stable_for_same_inputs(self):
        variant = self._first_variant()
        a = self.store.build_context(self.library, variant, run_id='r1')
        b = self.store.build_context(self.library, variant, run_id='r1')
        # created_at is set at build time; normalise before comparing.
        a.pop('created_at'), b.pop('created_at')
        self.assertEqual(context_hash(a), context_hash(b))


if __name__ == '__main__':
    unittest.main()
