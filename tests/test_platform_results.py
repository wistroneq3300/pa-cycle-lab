"""Full record set must agree across persisted API state and Vera reports."""
import unittest
from types import SimpleNamespace
import test_integration as base
from integration import runner
from cycle_core import issue, now
from cycle_engine import new_record
from cycle_report import status, render_html


class PlatformResults(unittest.TestCase):
    setUp=base.IntegrationTests.setUp
    tearDown=base.IntegrationTests.tearDown
    body=base.IntegrationTests.body
    create=base.IntegrationTests.create

    def test_record_health_api_and_report_agree(self):
        job=self.create(machine_ids=['neutrino-n1'])
        for expected in ('WARN','FAIL','PENDING','UNKNOWN'):
            with self.subTest(expected=expected):
                pre=new_record('PRE');pre.update(status='PASS',finished=now())
                start=new_record('START');start.update(status=expected,finished=None if expected=='PENDING' else now())
                if expected in ('WARN','FAIL'):
                    start['issues']=[issue('START_CHECK','identity','fixture',severity=expected)]
                node=dict(key='tray/n1',target=job['targets'][0],pre=pre,start=start,loops=[],
                          stage='START',completed=0,attempts=0,blocked=[],stop_reason='')
                session=SimpleNamespace(node=node,machine_id='neutrino-n1')
                campaign=dict(nodes=[node],state='RUNNING',started=now(),finished=None,
                              cycle_mode='reboot',channel='inband',limits={'loops':2,'hours':0},
                              run_id=job['id'],script_sha256='synthetic')
                summary=runner.compact(session)
                self.store.node_update(job['id'],summary)
                response=self.client.get(f"{self.base}/jobs/{job['id']}")
                self.assertEqual(response.status_code,200)
                self.assertEqual(response.json()['nodes'][0]['cumulative_health'],expected)
                self.assertEqual(status(campaign)['health'],expected)
                self.assertIn('>'+expected+'</span>',render_html(campaign))
                # A later PASS must not erase historical warning/failure/unknown.
                if expected!='PENDING':
                    post=new_record('POST');post.update(status='PASS',finished=now(),loop=1)
                    node['loops'].append(post)
                    self.assertEqual(runner.compact(session)['cumulative_health'],expected)

