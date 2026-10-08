import json
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

from integration.full_zip import FullZipService
from integration.store import Store


class FullRunZip(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name)
        self.store=Store(self.root/'jobs.sqlite3');self.artifacts=self.root/'artifacts';self.run=self.artifacts/'run-123'
        (self.run/'node-1'/'loop001').mkdir(parents=True)
        (self.run/'CYCLE_REVIEW_REPORT.html').write_text('<a href="node-1/loop001/report.json">Evidence</a>',encoding='utf-8')
        (self.run/'node-1'/'loop001'/'report.json').write_text('{"status":"PASS"}',encoding='utf-8')
        (self.run/'console.log').write_text('complete',encoding='utf-8')
        (self.run/'credential.txt').write_text('excluded',encoding='utf-8')
        (self.run/'.report-writer.lock').write_text(' ',encoding='utf-8')
        self.service=FullZipService(self.store,self.artifacts)

    def tearDown(self):
        self.service.close();self.temp.cleanup()

    def test_complete_zip_preserves_paths_manifest_and_exclusions(self):
        result=self.service.request({'id':'run-123','state':'COMPLETE'})
        self.assertIn(result['state'],{'PREPARING','COMPRESSING','READY'})
        self.service.active['run-123'].result(timeout=10)
        status=self.service.status('run-123')
        self.assertEqual(status['state'],'READY')
        self.assertEqual(status['file_count'],3)
        self.assertGreater(status['original_size'],0);self.assertGreater(status['zip_size'],0)
        with zipfile.ZipFile(self.service.path('run-123')) as archive:
            names=set(archive.namelist())
            self.assertIn('CYCLE_REVIEW_REPORT.html',names)
            self.assertIn('node-1/loop001/report.json',names)
            self.assertIn('FULL_ZIP_MANIFEST.json',names)
            self.assertNotIn('credential.txt',names);self.assertNotIn('.report-writer.lock',names)
            manifest=json.loads(archive.read('FULL_ZIP_MANIFEST.json'))
            self.assertEqual({row['path'] for row in manifest['files']},names-{'FULL_ZIP_MANIFEST.json'})
            self.assertTrue(all(len(row['sha256'])==64 for row in manifest['files']))

    def test_incomplete_zip_is_allowed_after_runner_and_writer_stop(self):
        result=self.service.request({'id':'run-123','state':'INCOMPLETE'})
        self.assertIn(result['state'],{'PREPARING','COMPRESSING','READY'})
        self.service.active['run-123'].result(timeout=10)
        self.assertEqual(self.service.status('run-123')['state'],'READY')
        self.assertTrue(self.service.path('run-123').is_file())

    def test_running_and_stop_requested_are_blocked(self):
        for state in ('RUNNING','STOP_REQUESTED'):
            with self.subTest(state=state),self.assertRaises(ValueError):
                self.service.request({'id':'run-123','state':state})

    def test_terminal_run_without_final_html_is_not_exported(self):
        (self.run/'CYCLE_REVIEW_REPORT.html').unlink()
        with self.assertRaisesRegex(ValueError,'Final HTML report'):
            self.service.request({'id':'run-123','state':'COMPLETE'})
        self.assertFalse(self.service.path('run-123').exists())

    def test_error_requires_explicit_consistency_confirmation(self):
        with self.assertRaises(ValueError):
            self.service.request({'id':'run-123','state':'ERROR'})
        with self.assertRaisesRegex(ValueError,'campaign.json'):
            self.service.request({'id':'run-123','state':'ERROR'},confirm=True)
        (self.run/'campaign.json').write_text('{"run_id":"cycle-run-123","state":"ERROR"}',encoding='utf-8')
        (self.run/'job_final.json').write_text('{"id":"run-123","state":"ERROR"}',encoding='utf-8')
        self.service.request({'id':'run-123','run_id':'cycle-run-123','state':'ERROR'},confirm=True)
        self.service.active['run-123'].result(timeout=10)
        self.assertEqual(self.service.status('run-123')['state'],'READY')

    def test_reconciliation_requires_matching_final_snapshots_and_evidence(self):
        (self.run/'campaign.json').write_text('{"run_id":"cycle-run-123","state":"ERROR"}',encoding='utf-8')
        (self.run/'job_final.json').write_text('{"id":"run-123","state":"RECONCILIATION_REQUIRED"}',encoding='utf-8')
        with self.assertRaisesRegex(ValueError,'不一致'):
            self.service.request({'id':'run-123','run_id':'cycle-run-123','state':'RECONCILIATION_REQUIRED'},confirm=True)
        (self.run/'campaign.json').write_text('{"run_id":"cycle-run-123","state":"RECONCILIATION_REQUIRED"}',encoding='utf-8')
        (self.run/'node-1'/'loop001'/'report.json').unlink()
        with self.assertRaisesRegex(ValueError,'Run Evidence'):
            self.service.request({'id':'run-123','run_id':'cycle-run-123','state':'RECONCILIATION_REQUIRED'},confirm=True)

    def test_terminal_states_reject_an_active_runner(self):
        self.service.worker_active=lambda _job_id:True
        for state in ('COMPLETE','INCOMPLETE','ERROR','RECONCILIATION_REQUIRED'):
            with self.subTest(state=state),self.assertRaisesRegex(ValueError,'Runner 仍在執行'):
                self.service.request({'id':'run-123','state':state},confirm=state in {'ERROR','RECONCILIATION_REQUIRED'})

    def test_exceptional_archive_rejects_concurrent_report_writer(self):
        (self.run/'campaign.json').write_text('{"run_id":"cycle-run-123","state":"ERROR"}',encoding='utf-8')
        (self.run/'job_final.json').write_text('{"id":"run-123","state":"ERROR"}',encoding='utf-8')
        code=("from cycle_storage import report_writer_lock\n"
              "import sys,time\n"
              "with report_writer_lock(sys.argv[1]):\n"
              " print('LOCKED',flush=True);time.sleep(10)\n")
        process=subprocess.Popen([sys.executable,'-c',code,str(self.run)],stdout=subprocess.PIPE,text=True)
        try:
            self.assertEqual(process.stdout.readline().strip(),'LOCKED')
            with self.assertRaisesRegex(ValueError,'Report Writer'):
                self.service.request({'id':'run-123','run_id':'cycle-run-123','state':'ERROR'},confirm=True)
        finally:
            process.terminate();process.wait(timeout=5)

    def test_four_nodes_ten_loops_large_manifest_is_complete(self):
        for node in range(1,5):
            for loop in range(1,11):
                folder=self.run/f'node-{node}'/f'loop{loop:04d}'
                folder.mkdir(parents=True,exist_ok=True)
                for evidence in range(16):
                    (folder/f'evidence-{evidence:02d}.log').write_text(
                        f'node={node} loop={loop} evidence={evidence}\n',encoding='utf-8')
        self.service.request({'id':'run-123','state':'INCOMPLETE'})
        self.service.active['run-123'].result(timeout=20)
        status=self.service.status('run-123')
        self.assertEqual(status['state'],'READY')
        self.assertEqual(status['file_count'],643)
        with zipfile.ZipFile(self.service.path('run-123')) as archive:
            manifest=json.loads(archive.read('FULL_ZIP_MANIFEST.json'))
            self.assertEqual(len(manifest['files']),643)
            self.assertIn('node-4/loop0010/evidence-15.log',{row['path'] for row in manifest['files']})


if __name__=='__main__':
    unittest.main()
