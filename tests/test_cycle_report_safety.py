import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


ROOT=Path(__file__).resolve().parents[1]
ENGINE=ROOT/'engine'/'vera_cycle'
sys.path.insert(0,str(ENGINE))

from cycle_storage import reject_live_rebuild, report_writer_lock, writer_identity


class ReportWriterSafety(unittest.TestCase):
    def test_current_writer_owner_refuses_live_rebuild(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)/'output';runtime=Path(folder)/'runtime';root.mkdir();runtime.mkdir()
            campaign={'run_id':'safety-test','state':'RUNNING','writer_owner':writer_identity()}
            with self.assertRaisesRegex(RuntimeError,'owner is still running'):
                reject_live_rebuild(root,campaign,runtime)

    def test_writer_lock_is_cross_process(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)/'output'
            code=("from cycle_storage import report_writer_lock\n"
                  "import sys\n"
                  "with report_writer_lock(sys.argv[1]):\n"
                  " print('READY',flush=True)\n"
                  " sys.stdin.readline()\n")
            environment=dict(os.environ, PYTHONPATH=str(ENGINE)+os.pathsep+os.environ.get('PYTHONPATH',''))
            process=subprocess.Popen([sys.executable,'-c',code,str(root)],stdin=subprocess.PIPE,
                                     stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,env=environment)
            try:
                self.assertEqual(process.stdout.readline().strip(),'READY')
                with self.assertRaisesRegex(RuntimeError,'busy'):
                    with report_writer_lock(root):
                        self.fail('A second writer acquired the same output lock')
            finally:
                process.communicate('\n',timeout=15)
            self.assertEqual(process.returncode,0)


if __name__=='__main__':
    unittest.main()
