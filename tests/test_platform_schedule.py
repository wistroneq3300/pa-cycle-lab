"""Actual worker with a synthetic transport and an injected campaign clock."""
import threading
import time
from types import SimpleNamespace
from unittest.mock import patch
import unittest
import test_integration as base
import test_native as native
from integration import runner
from integration.store import TERMINAL
from integration.synthetic import SyntheticTransport


class PlatformSchedule(unittest.TestCase):
    setUp=base.IntegrationTests.setUp
    tearDown=base.IntegrationTests.tearDown
    setup_nodes=native.NativeTests.setup_nodes
    create_native=native.NativeTests.create_native
    body=base.IntegrationTests.body
    wait=base.IntegrationTests.wait
    confirm=base.IntegrationTests.confirm

    def exercise(self,hours,advance):
        self.setup_nodes();job=self.create_native(parallelism=1,limits={'loops':2,'hours':hours})
        clock=[0.0];sent=[]
        class Fake(SyntheticTransport):
            def action(inner,target):
                sent.append(target.key);clock[0]+=advance
                return super().action(target)
        thread=threading.Thread(target=runner.run_job,args=(self.store,job['id'],Fake))
        with patch.object(runner,'time',SimpleNamespace(monotonic=lambda:clock[0],time=time.time,sleep=time.sleep)):
            thread.start();self.threads.append(thread)
            self.confirm(self.wait(job,{'AWAITING_CONFIRMATION'},30))
            done=self.wait(job,TERMINAL,30)
            thread.join(5)
        return done,sent

    def test_whole_run_budget_never_reports_zero_coverage_complete(self):
        done,sent=self.exercise(.01,45)
        self.assertEqual(len(sent),1)
        self.assertEqual(done['state'],'INCOMPLETE')
        self.assertEqual(sum(n['attempts']==0 for n in done['nodes']),3)
        self.assertEqual(sum(n['coverage']=='NOT_EXERCISED' for n in done['nodes']),3)

    def test_domains_are_admitted_fairly_one_round_at_a_time(self):
        done,sent=self.exercise(0,0)
        self.assertEqual(done['state'],'COMPLETE')
        self.assertEqual(len(sent),8)
        self.assertEqual(len(set(sent[:4])),4)
        self.assertEqual(sent[:4],sent[4:])

    def test_shared_domain_peer_exclusion_has_a_reviewable_reason(self):
        self.setup_nodes(shared=True);job=self.create_native(cycle_mode='power_cycle')
        class Fake(SyntheticTransport):
            def ssh(inner,target,role,cmd,*args,**kwargs):
                if "printf 'HOSTNAME='" in cmd and target.node=='n2':
                    from cycle_transport import Command
                    return Command(0,'HOSTNAME=wrong-node\nBOOT_ID=wrong\n')
                return super().ssh(target,role,cmd,*args,**kwargs)
        runner.run_job(self.store,job['id'],Fake)
        done=self.store.get(job['id'])
        self.assertEqual(done['state'],'BLOCKED')
        self.assertEqual(self.store.actions(job['id']),[])
        self.assertEqual(len(done['pre']['excluded']),4)
        self.assertTrue(all(row['reasons'] for row in done['pre']['excluded']))

