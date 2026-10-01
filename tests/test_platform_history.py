import json
import unittest
import uuid
from unittest.mock import patch
import test_integration as base
from integration import store as storage, web
from integration.settings import DATA


class PlatformHistory(unittest.TestCase):
    setUp=base.IntegrationTests.setUp
    tearDown=base.IntegrationTests.tearDown
    body=base.IntegrationTests.body

    def test_artifact_index_reuses_hash_and_download_does_not_scan(self):
        from pathlib import Path
        job=base.IntegrationTests.create(self,machine_ids=['neutrino-n1'])
        root=web.ARTIFACTS/job['id'];root.mkdir(parents=True,exist_ok=True)
        evidence=root/'sample.log';evidence.write_text('first evidence',encoding='utf-8')
        (root/'credentials.json').write_text('PRIVATE-SENTINEL',encoding='utf-8')
        url=self.base+'/jobs/'+job['id']
        response=self.client.get(url+'/artifacts')
        self.assertEqual(response.status_code,200,response.text)
        item=next(a for a in response.json()['manifest'] if a['path']=='sample.log')
        self.assertNotIn('credentials',response.text)
        original=Path.open
        def no_evidence_read(path,*args,**kwargs):
            if path==evidence: raise AssertionError('Unchanged artifact was rehashed')
            return original(path,*args,**kwargs)
        with patch.object(Path,'open',no_evidence_read):
            self.assertEqual(self.client.get(url+'/artifacts').status_code,200)
        with patch.object(web,'artifacts',side_effect=AssertionError('Download scanned entire run')):
            response=self.client.get(url+'/artifact/'+item['artifact_id'])
        self.assertEqual(response.text,'first evidence')
        evidence.write_text('second evidence, changed',encoding='utf-8')
        updated=self.client.get(url+'/artifacts').json()['manifest'][0]
        self.assertNotEqual(updated['sha256'],item['sha256'])
        evidence.unlink()
        self.assertEqual(self.client.get(url+'/artifact/'+item['artifact_id']).status_code,404)

    def test_css_changes_do_not_change_execution_hash(self):
        root=DATA/('hash-'+uuid.uuid4().hex)
        files=['run.py','integration/worker.py','app/static/view.css','engine/vera_cycle/issue_policy.md']
        for name in files:
            path=root/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_text('initial',encoding='utf-8')
        (root/'RUNTIME_ENGINE_FILES.json').write_text(json.dumps({'RUNTIME_ENGINE_FILES':files}),encoding='utf-8')
        with patch.object(storage,'ROOT',root):
            before=storage.engine_hash()
            (root/'app/static/view.css').write_text('new colors',encoding='utf-8')
            self.assertEqual(storage.engine_hash(),before)
            (root/'engine/vera_cycle/issue_policy.md').write_text('changed policy',encoding='utf-8')
            self.assertNotEqual(storage.engine_hash(),before)
            policy_hash=storage.engine_hash()
            (root/'run.py').write_text('changed service entry point',encoding='utf-8')
            self.assertNotEqual(storage.engine_hash(),policy_hash)

    def test_history_authorization_before_database_pagination(self):
        from types import SimpleNamespace
        web.pa.projects={'A':{},'B':{}}
        with self.store.tx() as db:
            for i in range(8):
                job=dict(id=f'{i:032x}',project='A' if i%2 else 'B',state='COMPLETE',
                         created_at=i,updated_at=i,health='PASS',synthetic=True)
                db.execute('INSERT INTO jobs(id,project,state,updated,data,idem,request_hash) VALUES(?,?,?,?,?,?,?)',
                           (job['id'],job['project'],job['state'],i,json.dumps(job),str(i),'fixture'))
        web.app.state.cycle_provider=SimpleNamespace(authenticate=lambda request:'A-reader',
            authorize=lambda actor,project,action:action=='read' and project in (None,'A'))
        self.addCleanup(lambda:delattr(web.app.state,'cycle_provider'))
        with patch.object(self.store,'jobs',side_effect=AssertionError('Unbounded job history read')):
            response=self.client.get('/api/cycle/runs?offset=1&limit=2')
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual([r['id'] for r in response.json()['runs']],[f'{i:032x}' for i in (5,3)])
        self.assertTrue(response.json()['has_more'])

