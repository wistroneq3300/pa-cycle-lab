"""Independent normal observation uses a service principal and node identity."""
import unittest
from types import SimpleNamespace
from unittest.mock import patch
import test_integration as base
from integration import web
from scripts.native_demo import fixture


class PlatformTelemetry(unittest.TestCase):
    setUp=base.IntegrationTests.setUp
    tearDown=base.IntegrationTests.tearDown

    def test_synthetic_service_never_opens_transport(self):
        from integration import observation_service
        with patch.object(observation_service,'MODE','synthetic'),patch.object(observation_service,'Transport') as transport:
            self.assertEqual(observation_service.collect_once(self.store,SimpleNamespace(),fixture()),[])
        transport.assert_not_called()

    def test_observation_restart_requires_os_ownership_and_keeps_control_locks(self):
        from integration import observation_service
        from integration.runner import process_lock
        from integration.settings import DATA
        with self.store.tx() as db:
            self.store.reserve(db,'observation-interrupted',['node:observed'])
            self.store.reserve(db,'cycle-unknown',['node:cycle'])
            self.store.reserve(db,'session-unknown',['node:input'])
        self.store.observation_status('observed',dict(state='COLLECTING',owner='observation-interrupted',attempted_at=0))
        runtime=DATA/'observer-lock-fixture'
        with patch.object(observation_service,'MODE','live'),patch.object(observation_service,'RUNTIME',runtime),\
             patch.object(observation_service,'configured_provider',return_value=SimpleNamespace()),\
             patch.object(observation_service,'Store',return_value=self.store),\
             patch.object(observation_service,'collect_once',side_effect=RuntimeError('End isolated service test')) as sample:
            with process_lock(runtime/'observation-service.lock'):
                with self.assertRaises(OSError):observation_service.service()
                self.assertEqual(self.store.observation_status('observed')['state'],'COLLECTING')
                sample.assert_not_called()
            with self.assertRaisesRegex(RuntimeError,'End isolated service test'):observation_service.service()
        self.assertEqual(self.store.observation_status('observed')['state'],'INTERRUPTED')
        self.assertEqual(set(self.store.lock_owners().values()),{'cycle-unknown','session-unknown'})

    def test_cpu_samples_without_cycle_are_node_bound_and_reservations_defer(self):
        from integration import observation_service
        from cycle_transport import Transport
        doc=fixture();doc['machines']['chassis-01']['project']='A'
        doc['projects']['A']=dict(name='A')
        doc['machines']['chassis-01']['os'][2]['capabilities']['telemetry_gpu']='nvidia'
        seen=[]
        def connect(transport,target,role,timeout):
            seen.append((target.os_ip,transport.ports['os']))
            class Channel:
                output=b''
                def set_combine_stderr(self,*a):pass
                def settimeout(self,*a):pass
                def shutdown_write(self):pass
                def exec_command(self,command):
                    self.output=(b'0, Synthetic GPU, N/A, 100, 20, 99, 200, 500\n' if 'nvidia-smi --query-gpu=' in command else
                                 b'load average: 0.1, 0.2, 0.3\nMemTotal: 1000000 kB\nMemAvailable: 500000 kB\n')
                def recv_ready(self):return bool(self.output)
                def recv(self,*a):result=self.output;self.output=b'';return result
                def exit_status_ready(self):return True
                def recv_exit_status(self):return 0
            return SimpleNamespace(close=lambda:None,get_transport=lambda:SimpleNamespace(open_session=lambda **kw:Channel()))
        provider=SimpleNamespace(service_principal=lambda purpose:'cpu-observer',
            authorize=lambda actor,project,action:actor=='cpu-observer' and project=='A' and action=='observe',
            credentials=lambda *args:dict(os_password='OBSERVE-ONLY'))
        from integration.settings import DATA
        database=DATA/'observation-test.sqlite3'
        with patch.object(observation_service,'MODE','live'),patch.object(Transport,'_connect',connect),\
             patch.object(web.pa.telemetry_core,'DB_FILE',str(database)),\
             patch.object(web.pa.telemetry_core,'_alert_llm',side_effect=AssertionError('Observer must not invoke AI')):
            results=observation_service.collect_once(self.store,provider,doc)
            self.assertEqual([r['state'] for r in results],['COLLECTED']*4)
            self.assertEqual(len(seen),5)
            self.assertNotIn('OBSERVE-ONLY',str(results))
            with web.pa.telemetry_core._conn() as db:
                names={r[0] for r in db.execute('SELECT DISTINCT machine FROM os_metrics')}
            self.assertEqual(names,{e['node_id'] for e in doc['machines']['chassis-01']['os']})
            web.pa.machines=doc['machines'];web.pa.projects=doc['projects'];web.pa._save_data()
            node=doc['machines']['chassis-01']['os'][2]
            response=self.client.get('/api/machine/chassis-01/telemetry',params={'node_id':node['node_id']})
            self.assertEqual(response.status_code,200,response.text)
            self.assertEqual(response.json()['node_id'],node['node_id'])
            self.assertEqual(response.json()['history_source'],'canonical-node')
            self.assertEqual(len(response.json()['gpu']['series']),1)
            self.assertEqual(results[2]['gpu_state'],'COLLECTED')
            self.assertEqual(results[0]['gpu_state'],'NOT_CONFIGURED')
            self.assertEqual(self.store.observation_status(node['node_id'])['state'],'COLLECTED')
            response=self.client.get('/api/ai/gpu-alerts')
            self.assertEqual(response.status_code,200,response.text)
            self.assertEqual(response.json()['alerts'][0]['machine'],node['node_id'])
            self.assertEqual(response.json()['alerts'][0]['kind'],'high_temp')
            doc['machines']['chassis-01']['rack_u']=30
            web.pa._save_data()
            response=self.client.get('/api/rack/A/telemetry')
            self.assertEqual(response.status_code,200,response.text)
            rack_nodes=response.json()['data']['server']['machines']
            self.assertEqual({m.get('node_id') for m in rack_nodes},names)
            self.assertEqual(response.json()['kinds_count']['server'],1)
            from integration.targets import inventory
            targets=inventory(SimpleNamespace(**doc))
            with self.store.tx() as db:self.store.reserve(db,'test-cycle',['node:'+targets[0]['node_id']])
            seen.clear()
            results=observation_service.collect_once(self.store,provider,doc)
            self.assertEqual(results[0]['state'],'DEFERRED')
            self.assertEqual(len(seen),4)
