"""Run2 safety regressions: fake transport and local persistence faults only."""
import copy
import errno
import json
import os
from pathlib import Path
import sqlite3
import stat
import threading
import time
from types import SimpleNamespace
import unittest
from unittest.mock import patch, MagicMock
import test_integration as base
from integration import web, control, runner
from integration.store import Store, Conflict, TERMINAL, engine_hash
from integration.settings import ROOT, DATA, ARTIFACTS
from integration.synthetic import SyntheticTransport
from cycle_core import EvidencePersistenceError, atomic_write
from cycle_transport import Command, Transport


class ManualFake(SyntheticTransport):
    def action(self,t):
        if self.on_action: self.on_action()
        if not self.no_recovery: self.boots[t.key]=self.boots.get(t.key,0)+1
        return Command(255,'lost','RESPONSE_LOST') if self.response_lost else Command(0,'accepted')

    def oob(self,t,cmd,timeout=30):
        if cmd=='power off':
            self.calls.append((t.key,'oob',cmd))
            if not self.no_recovery: self.power_off=True
            return self.action(t)
        return super().oob(t,cmd,timeout)


def actions(transport):
    return [c for c in transport.calls if c[2] in {'reboot','power on','power off','power reset','power cycle','ipmitool power cycle','/usr/bin/stbypowerctrl.sh aux_cycle'}]


class Run2Tests(unittest.TestCase):
    setUp=base.IntegrationTests.setUp
    tearDown=base.IntegrationTests.tearDown
    body=base.IntegrationTests.body
    create=base.IntegrationTests.create
    worker=base.IntegrationTests.worker
    wait=base.IntegrationTests.wait
    confirm=base.IntegrationTests.confirm

    def fake(self): return ManualFake({},DATA/'fake-keys')
    def machine(self): return web.pa.machines['neutrino-n1']

    def control_body(self, **payload):
        import uuid
        from node_identity import canonical
        from integration.targets import inventory
        self.machine().setdefault('capabilities',{'independent_power':True})
        self.machine().update(canonical(self.machine()))
        target=next(t for t in inventory(web.pa) if t.get('parent_name')=='neutrino-n1')
        return dict(payload,node_id=target['name'],expected_binding_revision=target['revision'],idempotency_key=uuid.uuid4().hex)

    def test_manual_power_strict_boolean_at_http_boundary(self):
        with patch.object(web,'MODE','live'),patch.dict(os.environ,{'CYCLE_USERS_JSON':'{"operator":"test"}'}),patch.object(web,'control_transport') as transport:
            for body in ({},{'on':None},{'on':'false'},{'on':0},{'on':1},[],{'on':True,'extra':1}):
                with self.subTest(body=body):
                    response=self.client.post('/api/machine/neutrino-n1/power',json=body,auth=('operator','test'))
                    self.assertEqual(response.status_code,422,response.text)
            transport.assert_not_called()
            self.assertEqual(self.store.controls(),[])

    def test_manual_explicit_on_off_dispatch_once_and_verified(self):
        for on in (True,False):
            transport=self.fake()
            result=control.execute(self.store,self.machine(),'power',{'on':on},'tester',transport,timeout=0)
            self.assertEqual(result['state'],'CONTROL_COMPLETE')
            self.assertEqual([a[2] for a in actions(transport)],['power on' if on else 'power off'])
            self.assertEqual(self.store.lock_owners(),{})

    def test_manual_power_true_false_through_live_http_with_fake_transport(self):
        self.machine().update(synthetic=False,credential_ref='test-only')
        for on in (True,False):
            transport=self.fake()
            with patch.object(web,'MODE','live'),patch.dict(os.environ,{'CYCLE_USERS_JSON':'{"operator":"test"}'}),patch.object(web,'control_transport',return_value=transport):
                response=self.client.post('/api/machine/neutrino-n1/power',json=self.control_body(on=on),auth=('operator','test'))
            self.assertEqual(response.status_code,200,response.text)
            self.assertTrue(response.json()['ok']);self.assertEqual([a[2] for a in actions(transport)],['power on' if on else 'power off'])

    def test_reconcile_before_dispatch_cannot_release_then_allow_stale_dispatch(self):
        transport=self.fake()
        prepared=self.store.begin_control(self.machine(),'reboot',None,'tester')
        control.reconcile(self.store,prepared['id'],transport,timeout=0)
        job=self.create(machine_ids=['neutrino-n1'])
        result=control.execute(self.store,self.machine(),'reboot',{},'tester',transport,timeout=0,prepared=prepared)
        self.assertEqual(result['state'],'CONTROL_FAILED');self.assertEqual(actions(transport),[])
        self.assertIn(job['id'],self.store.lock_owners().values())

    def test_manual_reboot_without_explicit_target_is_rejected(self):
        self.machine().update(synthetic=False,credential_ref='test-only');transport=self.fake()
        with patch.object(web,'MODE','live'),patch.dict(os.environ,{'CYCLE_USERS_JSON':'{"operator":"test"}'}),patch.object(web,'control_transport',return_value=transport):
            response=self.client.post('/api/machine/neutrino-n1/reboot',auth=('operator','test'))
        self.assertEqual(response.status_code,422,response.text);self.assertEqual(actions(transport),[])

    def test_manual_identity_mismatch_never_dispatches(self):
        transport=self.fake();transport.mismatch=True
        result=control.execute(self.store,self.machine(),'power',{'on':False},'tester',transport,timeout=0)
        self.assertEqual(result['state'],'CONTROL_FAILED');self.assertEqual(actions(transport),[])

    def test_manual_duplicate_inventory_refuses_before_transport(self):
        self.machine().update(synthetic=False,credential_ref='test-only',os_ip=web.pa.machines['neutrino-n2']['os_ip'])
        with patch.object(web,'MODE','live'),patch.dict(os.environ,{'CYCLE_USERS_JSON':'{"operator":"test"}'}),patch.object(web,'control_transport') as transport:
            response=self.client.post('/api/machine/neutrino-n1/power',json=self.control_body(on=False),auth=('operator','test'))
        self.assertEqual(response.status_code,409,response.text);transport.assert_not_called()

    def test_cycle_lock_blocks_manual_and_manual_blocks_cycle_create(self):
        job=self.create(machine_ids=['neutrino-n1']);transport=self.fake()
        with self.assertRaises(Conflict):control.execute(self.store,self.machine(),'reboot',{},'tester',transport,timeout=0)
        self.assertEqual(transport.calls,[])
        self.store.stop(job['id'],'tester')
        transport.on_action=lambda:self.assertEqual(self.client.post(self.base+'/jobs',json=self.body()).status_code,409)
        self.assertEqual(control.execute(self.store,self.machine(),'reboot',{},'tester',transport,timeout=0)['state'],'CONTROL_COMPLETE')

    def test_ambiguous_response_survives_reopen_and_blocks_all_actions(self):
        transport=self.fake();transport.response_lost=True;transport.no_recovery=True
        result=control.execute(self.store,self.machine(),'reboot',{},'tester',transport,timeout=0)
        self.assertEqual(result['state'],'CONTROL_AMBIGUOUS');self.assertEqual(len(actions(transport)),1)
        reopened=Store(self.store.path)
        with self.assertRaises(Conflict):control.execute(reopened,self.machine(),'power',{'on':False},'tester',transport,timeout=0)
        self.assertEqual(self.client.post(self.base+'/jobs',json=self.body()).status_code,409)
        again=control.reconcile(reopened,result['id'],transport,timeout=0)
        self.assertEqual(again['state'],'CONTROL_AMBIGUOUS');self.assertEqual(len(actions(transport)),1)
        transport.boots['tray1_n1']=2
        # Use the actual engine key, independent of key formatting.
        transport.boots[next(iter({c[0] for c in transport.calls}))]=2
        self.assertEqual(control.reconcile(reopened,result['id'],transport,timeout=0)['state'],'CONTROL_COMPLETE')
        self.assertEqual(len(actions(transport)),1);self.assertEqual(reopened.lock_owners(),{})

    def test_response_lost_reconciles_without_retry(self):
        for action,body in (('reboot',{}),('power',{'on':True}),('power',{'on':False})):
            transport=self.fake();transport.response_lost=True
            result=control.execute(self.store,self.machine(),action,body,'tester',transport,timeout=0)
            self.assertEqual(result['state'],'CONTROL_COMPLETE');self.assertEqual(len(actions(transport)),1)

    def test_control_intent_database_failure_prevents_dispatch(self):
        transport=self.fake();original=self.store.update_control
        def fail_intent(cid,**fields):
            if fields.get('dispatched'):raise sqlite3.OperationalError('disk full')
            return original(cid,**fields)
        with patch.object(self.store,'update_control',side_effect=fail_intent):
            result=control.execute(self.store,self.machine(),'reboot',{},'tester',transport,timeout=0)
        self.assertEqual(actions(transport),[]);self.assertEqual(result['state'],'CONTROL_FAILED')

    def test_control_result_database_failure_keeps_reservation(self):
        transport=self.fake();original=self.store.update_control
        def fail_result(cid,**fields):
            if 'outcome' in fields:raise sqlite3.OperationalError('disk full')
            return original(cid,**fields)
        with patch.object(self.store,'update_control',side_effect=fail_result):
            result=control.execute(self.store,self.machine(),'reboot',{},'tester',transport,timeout=0)
        self.assertEqual(len(actions(transport)),1);self.assertEqual(result['state'],'CONTROL_AMBIGUOUS')
        self.assertTrue(self.store.lock_owners())

    def test_active_inventory_critical_edits_and_project_rename_blocked(self):
        job=self.create(machine_ids=['neutrino-n1'])
        fields={'name':'renamed','project':'Other platform','os_ip':'192.0.2.90','bmc_ip':'198.51.100.90',
                'tray':'tray2','node':'n9','power_domain':'other','aux_domain':'other','cycle_profile':'neutrino',
                'credential_ref':'other','os_hostname':'other','bmc_hostname':'other','os_port':2222,'bmc_port':2222,
                'os_user':'other','bmc_user':'other','ipmi_cipher':3,'mgx_type':'switch','aux_scope_confirmed':False}
        with patch.object(web.pa,'_save_data') as save:
            for state in ('CREATED','PRE_RUNNING','AWAITING_CONFIRMATION','RUNNING','STOP_REQUESTED'):
                self.store.update(job['id'],state=state)
                for key,value in fields.items():
                    with self.subTest(state=state,field=key):
                        response=self.client.patch('/api/machines/neutrino-n1',json={key:value})
                        self.assertEqual(response.status_code,409,response.text)
                self.assertEqual(self.client.delete('/api/machines/neutrino-n1').status_code,409)
                self.assertEqual(self.client.patch('/api/projects/Neutrino%20Demo',json={'name':'renamed'}).status_code,409)
            save.assert_not_called()
        self.assertEqual(self.store.get(job['id'])['targets'][0]['os_ip'],'192.0.2.11')

    def test_unresolved_control_blocks_inventory_edits(self):
        self.store.begin_control(self.machine(),'power',False,'tester')
        self.assertEqual(self.client.delete('/api/machines/neutrino-n1').status_code,409)
        self.assertEqual(self.client.patch('/api/projects/Neutrino%20Demo',json={'name':'renamed'}).status_code,409)

    def test_inventory_cannot_change_alias_of_reserved_domain(self):
        self.create(machine_ids=['neutrino-n1'])
        self.assertEqual(self.client.patch('/api/machines/neutrino-n2',json={'aux_domain':'escape'}).status_code,409)
        self.assertEqual(self.client.delete('/api/machines/neutrino-n2').status_code,409)

    def test_inventory_early_validation_and_passive_exemption(self):
        invalid=[{'name':'neutrino-n2'},{'os_ip':'invalid'},{'os_ip':'192.0.2.12'},
                 {'bmc_ip':'198.51.100.12'},{'node':'n2'},{'os_hostname':'bad host'},
                 {'os_hostname':'bad..host'},{'os_port':0},{'os_port':True},{'bmc_port':65536},
                 {'ipmi_cipher':21},{'power_domain':''},{'cycle_profile':'naboo'}]
        with patch.object(web.pa,'_save_data'):
            for body in invalid:
                with self.subTest(body=body):
                    response=self.client.patch('/api/machines/neutrino-n1',json=body)
                    self.assertEqual(response.status_code,422,response.text)
            self.assertEqual(self.client.patch('/api/machines/neutrino-n1',json={'os_port':2222}).status_code,200)
            web.pa.machines['pdu']=dict(name='pdu',project='Neutrino Demo',mgx_type='pdu')
            self.assertEqual(self.client.patch('/api/machines/pdu',json={'project':'Other platform'}).status_code,200)

    def test_inventory_save_failure_rolls_back_memory(self):
        before=copy.deepcopy(web.pa.machines)
        for fault in (OSError(errno.ENOSPC,'disk full'),EvidencePersistenceError('Evidence persistence failure')):
            with patch.object(web.pa,'_save_data',side_effect=fault):
                self.assertEqual(self.client.patch('/api/machines/neutrino-n1',json={'os_port':2222}).status_code,503)
        self.assertEqual(web.pa.machines,before)
        projects=copy.deepcopy(web.pa.projects)
        with patch.object(web.pa,'_save_data',side_effect=EvidencePersistenceError('disk full')):
            response=self.client.post('/api/projects',json={'name':'unsaved project'})
            self.assertEqual(response.status_code,503,response.text)
        self.assertEqual(web.pa.projects,projects)

    def test_invalid_imported_endpoint_can_be_repaired_when_idle(self):
        self.machine()['os_ip']='invalid-import'
        with patch.object(web.pa,'_save_data'):
            self.assertEqual(self.client.patch('/api/machines/neutrino-n1',json={'os_ip':'192.0.2.11'}).status_code,200)

    def test_compact_uses_fingerprint_for_unique_and_first(self):
        def finding(fp):return dict(code='DMESG_APEI',component='PCIe',fingerprint=fp)
        session=SimpleNamespace(machine_id='n1',node=dict(key='t_n1',pre={'issues':[finding('AAA')]},loops=[],stage='DONE',completed=1,attempts=1,stop_reason='',blocked=[]))
        for issues,unique,first in (([finding('AAA')]*2,1,0),([finding('BBB')],2,1),([finding('AAA'),finding('BBB')],2,0),([finding('CCC')],3,1)):
            session.node['loops'].append(dict(issues=issues,loop=len(session.node['loops'])+1,finished=True,status='FAIL'))
            result=runner.compact(session)
            self.assertEqual((result['unique_issues'],result['first_this_round']),(unique,first))

    def test_legacy_remote_boundary_and_future_routes_default_deny(self):
        paths=['/api/terminal','/api/kvm/basecode','/api/ssh','/api/ai/copilot','/api/ai/vision',
               '/api/machine/neutrino-n1/aux','/api/machine/neutrino-n1/diagnose',
               '/api/machine/neutrino-n1/sensors/analyze','/api/projects/new-remote-route',
               '/api/projects/Neutrino%20Demo/remote-exec','/api/cycle/arbitrary-ssh',
               '/api/testlibrary/remote-exec','/api/machines/neutrino-n1/change-os-ip']
        for path in paths:
            for method in ('get','post'):
                with self.subTest(path=path,method=method):self.assertEqual(getattr(self.client,method)(path).status_code,409)
        from starlette.websockets import WebSocketDisconnect
        for path in ('/ws/terminal/neutrino-n1/os','/ws/kvm/neutrino-n1','/ws/rack-broadcast'):
            with self.assertRaises(WebSocketDisconnect):
                with self.client.websocket_connect(path):pass

    def test_metadata_and_startup_never_use_legacy_live_transport(self):
        with patch.object(web.pa,'_kick_status_scan',side_effect=AssertionError('legacy scan')),patch.object(web.pa,'ping_check',side_effect=AssertionError('remote metadata')),patch.object(web.pa.telemetry_core,'start_worker') as telemetry:
            self.assertEqual(self.client.get('/api/machines?force_scan=true').status_code,200)
            self.assertEqual(self.client.get('/api/machine/neutrino-n1').status_code,200)
            with patch.dict(os.environ,{'CYCLE_MODE':'live'}):web.pa._start_telemetry()
            telemetry.assert_not_called()

    def test_credentials_excluded_from_snapshots_and_artifact_downloads(self):
        machine=dict(self.machine(),os_pass='PRIVATE-OS',bmc_pass='PRIVATE-BMC',password='PRIVATE-OTHER')
        job=self.store.create('Neutrino Demo',self.body(),[machine],'tester')
        self.assertNotIn('PRIVATE-',json.dumps(job))
        root=ARTIFACTS/job['id'];root.mkdir()
        for name in ('credentials.json','bmc_password.txt','private_key.pem','id_rsa'):
            (root/name).write_text('PRIVATE-KEY')
            self.assertEqual(self.client.get(f'{self.base}/jobs/{job["id"]}/files/{name}').status_code,404)
        self.assertEqual(self.client.get(f'{self.base}/jobs/{job["id"]}/artifacts').json()['files'],[])

    def test_transport_password_env_not_argv_and_exception_redaction(self):
        transport=Transport({'os':'PRIVATE-OS','bmc':'PRIVATE-BMC'},DATA/'keys')
        from cycle_core import Target
        target=Target('t','n','192.0.2.1','192.0.2.2')
        with patch('cycle_transport.subprocess.run',return_value=SimpleNamespace(returncode=0,stdout='PRIVATE-BMC',stderr='')) as execute:
            result=transport.oob(target,'power cycle')
        argv=execute.call_args.args[0];kwargs=execute.call_args.kwargs
        self.assertIn('-E',argv);self.assertNotIn('-P',argv);self.assertNotIn('PRIVATE-BMC',str(argv))
        self.assertEqual(kwargs['env']['IPMI_PASSWORD'],'PRIVATE-BMC');self.assertFalse(kwargs.get('shell',False))
        self.assertNotIn('PRIVATE-BMC',result.output)
        with patch.object(transport,'_connect',side_effect=OSError('PRIVATE-OS PRIVATE-BMC')):
            result=transport.ssh(target,'os','reboot')
        self.assertNotIn('PRIVATE-',result.output);self.assertEqual(result.state,'NOT_ISSUED')

    def test_cycle_modes_response_lost_never_retry(self):
        for m in web.pa.machines.values():m['aux_domain']=m['name']
        for mode in ('reboot','power_cycle','aux_cycle'):
            for channel in ('inband','outband'):
                with self.subTest(mode=mode,channel=channel):
                    transport=self.fake();transport.response_lost=True
                    job=self.create(machine_ids=['neutrino-n1'],cycle_mode=mode,channel=channel,limits={'loops':1})
                    self.worker(job,lambda *_:transport);self.confirm(self.wait(job,{'AWAITING_CONFIRMATION'}))
                    self.assertEqual(self.wait(job,TERMINAL)['state'],'COMPLETE');self.assertEqual(len(actions(transport)),1)

    def test_dispatch_intent_disk_failure_sends_no_power(self):
        job=self.create(machine_ids=['neutrino-n1']);transport=self.fake()
        original=runner.atomic_write
        def fail_intent(path,*args,**kwargs):
            if Path(path).name.endswith('_intent.json'):raise EvidencePersistenceError('Evidence persistence failure')
            return original(path,*args,**kwargs)
        with patch('cycle_engine.atomic_write',side_effect=fail_intent):
            self.worker(job,lambda *_:transport);self.confirm(self.wait(job,{'AWAITING_CONFIRMATION'}))
            final=self.wait(job,TERMINAL)
        self.assertEqual(final['state'],'RECONCILIATION_REQUIRED');self.assertIn('Evidence persistence failure',final['stop_reason'])
        self.assertEqual(actions(transport),[])

    def test_report_disk_failure_after_dispatch_stops_next_round(self):
        for fault in (OSError(errno.ENOSPC,'disk full'),OSError(errno.EROFS,'read only'),RuntimeError('renderer failed')):
            job=self.create(machine_ids=['neutrino-n1'],limits={'loops':3});transport=self.fake();original=runner.write_reports
            def fail_after(root,campaign):
                if campaign['nodes'][0]['loops']:raise fault
                return original(root,campaign)
            with patch.object(runner,'write_reports',side_effect=fail_after):
                self.worker(job,lambda *_:transport);self.confirm(self.wait(job,{'AWAITING_CONFIRMATION'}));final=self.wait(job,TERMINAL)
            self.assertEqual(final['state'],'RECONCILIATION_REQUIRED');self.assertEqual(final['health'],'UNKNOWN')
            self.assertIn('Evidence persistence failure',final['stop_reason']);self.assertEqual(len(actions(transport)),1)
            self.assertTrue(self.store.lock_owners())
            with self.store.tx() as db: db.execute('DELETE FROM locks WHERE owner=?',(job['id'],))

    def test_final_artifact_failure_cannot_publish_complete(self):
        job=self.create(machine_ids=['neutrino-n1'],limits={'loops':1});transport=self.fake();original=runner.write_json
        def fail_final(path,value):
            if Path(path).name=='job_final.json':raise OSError(errno.ENOSPC,'disk full')
            return original(path,value)
        with patch.object(runner,'write_json',side_effect=fail_final):
            self.worker(job,lambda *_:transport);self.confirm(self.wait(job,{'AWAITING_CONFIRMATION'}));final=self.wait(job,TERMINAL)
        self.assertEqual(final['state'],'RECONCILIATION_REQUIRED');self.assertEqual(len(actions(transport)),1)
        self.assertEqual(json.loads((ARTIFACTS/job['id']/'campaign.json').read_text())['state'],'RECONCILIATION_REQUIRED')

    def test_artifact_directory_failure_is_terminal_error(self):
        job=self.create();root=ARTIFACTS/job['id'];original=Path.mkdir;transport=self.fake()
        def fail_root(path,*args,**kwargs):
            if path==root:raise OSError(errno.EROFS,'readonly')
            return original(path,*args,**kwargs)
        with patch.object(Path,'mkdir',fail_root):runner.run_job(self.store,job['id'],lambda *_:transport)
        final=self.store.get(job['id']);self.assertEqual(final['state'],'ERROR')
        self.assertIn('Evidence persistence failure',final['stop_reason']);self.assertEqual(actions(transport),[])

    def test_sqlite_finalization_failure_retains_lock_until_recovery(self):
        job=self.create();self.store.stop(job['id'],'tester')
        # A claimed worker cannot be replayed even if terminal DB publication fails.
        job=self.create();transport=self.fake();transport.mismatch=True
        with patch.object(self.store,'finish',side_effect=sqlite3.OperationalError('disk full')):
            runner.run_job(self.store,job['id'],lambda *_:transport)
        self.assertNotIn(self.store.get(job['id'])['state'],TERMINAL)
        self.assertTrue(self.store.lock_owners());self.assertIsNone(self.store.claim(job['id'],'replay'))
        runner.recover(self.store,self.store.get(job['id']))
        self.assertEqual(self.store.get(job['id'])['state'],'RECONCILIATION_REQUIRED');self.assertEqual(actions(transport),[])

    def test_sqlite_commit_failure_does_not_leave_successful_report(self):
        job=self.create(machine_ids=['neutrino-n1'],limits={'loops':1});transport=self.fake()
        with patch.object(self.store,'finish',side_effect=sqlite3.OperationalError('disk full')):
            self.worker(job,lambda *_:transport);self.confirm(self.wait(job,{'AWAITING_CONFIRMATION'}))
            self.threads[-1].join(15);self.assertFalse(self.threads[-1].is_alive())
        self.assertTrue(self.store.lock_owners());self.assertEqual(len(actions(transport)),1)
        self.assertEqual(json.loads((ARTIFACTS/job['id']/'campaign.json').read_text())['state'],'INCOMPLETE')
        self.assertEqual(json.loads((ARTIFACTS/job['id']/'job_final.json').read_text())['state'],'INCOMPLETE')
        runner.recover(self.store,self.store.get(job['id']))

    def test_credential_permission_validation_and_transport_boundary(self):
        from integration.credentials import validate_permissions
        validate_permissions(SimpleNamespace(st_mode=stat.S_IFREG|0o600,st_uid=1001),1001)
        for mode,owner in ((stat.S_IFREG|0o644,1001),(stat.S_IFREG|0o600,1002),(stat.S_IFLNK|0o600,1001)):
            with self.assertRaises(PermissionError):validate_permissions(SimpleNamespace(st_mode=mode,st_uid=owner),1001)
        # Architectural regression: the integration must never import/call legacy helpers.
        import ast
        for path in [* (ROOT/'integration').glob('*.py'),ROOT/'engine/vera_cycle/cycle_engine.py',ROOT/'engine/vera_cycle/cycle_transport.py']:
            tree=ast.parse(path.read_text(encoding='utf-8'))
            for node in ast.walk(tree):
                if isinstance(node,ast.Call):
                    called=getattr(node.func,'attr',getattr(node.func,'id',''))
                    self.assertNotIn(called,{'ssh_run','_ipmi_cmd','run_control_cmd'},str(path))
                    self.assertFalse(any(k.arg=='shell' and isinstance(k.value,ast.Constant) and k.value.value is True for k in node.keywords),str(path))

    def test_engine_exception_evidence_redacts_upload_failure(self):
        transport=self.fake()
        transport.redact=lambda text:text.replace('PRIVATE-SECRET','[REDACTED]')
        transport.upload=MagicMock(side_effect=RuntimeError('upload PRIVATE-SECRET failed'))
        job=self.create(machine_ids=['neutrino-n1']);self.worker(job,lambda *_:transport)
        self.wait(job,TERMINAL)
        for path in (ARTIFACTS/job['id']).rglob('*'):
            if path.is_file():self.assertNotIn(b'PRIVATE-SECRET',path.read_bytes(),str(path))
        self.assertNotIn('PRIVATE-SECRET',json.dumps(self.store.get(job['id'])))

    def test_sqlite_event_failure_blocks_dispatch(self):
        job=self.create(machine_ids=['neutrino-n1']);transport=self.fake();original=self.store.append_event
        def fail_event(jid,event=None,**fields):
            if event:raise sqlite3.OperationalError('database or disk is full')
            return original(jid,event=event,**fields)
        with patch.object(self.store,'append_event',side_effect=fail_event):
            runner.run_job(self.store,job['id'],lambda *_:transport)
        final=self.store.get(job['id'])
        self.assertEqual(final['state'],'ERROR');self.assertIn('Evidence persistence failure',final['stop_reason'])
        self.assertEqual(actions(transport),[])

    def test_crash_recovery_with_corrupt_evidence_never_replays(self):
        job=self.create();self.store.claim(job['id'],'dead-worker')
        root=ARTIFACTS/job['id'];root.mkdir();(root/'campaign.json').write_text('{broken')
        runner.recover(self.store,self.store.get(job['id']))
        final=self.store.get(job['id']);self.assertEqual(final['state'],'RECONCILIATION_REQUIRED')
        self.assertIn('Evidence persistence failure',final['stop_reason']);self.assertIsNone(self.store.claim(job['id'],'replay'))

    def test_atomic_storage_fault_has_explicit_failure_type(self):
        for fault in (OSError(errno.ENOSPC,'full'),OSError(errno.EROFS,'readonly')):
            with patch('cycle_core.tempfile.NamedTemporaryFile',side_effect=fault):
                with self.assertRaisesRegex(EvidencePersistenceError,'Evidence persistence failure'):atomic_write(DATA/'fault.txt','evidence')

    def test_runtime_manifest_nested_file_and_pre_engine_hash(self):
        original=engine_hash();folder=ROOT/'integration'/'_run2_nested_probe';folder.mkdir()
        nested=folder/'runtime.py'
        try:
            nested.write_text('RUNTIME_CHANGE=True\n')
            with self.assertRaisesRegex(Conflict,'manifest is missing'):engine_hash()
        finally:
            nested.unlink(missing_ok=True);folder.rmdir()
        self.assertEqual(engine_hash(),original)
        job=self.create();self.store.ready(job['id'],{'runnable_ids':job['config']['machine_ids']},[])
        job=self.store.get(job['id'])
        with patch('integration.store.engine_hash',return_value='changed'):
            with self.assertRaises(Conflict):self.store.confirm(job['id'],job['pre']['version'],job['pre']['runnable_ids'],'tester')
        manifest=json.loads((ROOT/'RUNTIME_ENGINE_FILES.json').read_text())['RUNTIME_ENGINE_FILES']
        for name in ('run.py','engine/vera_cycle/cycle_engine.py','engine/vera_cycle/neutrino_config.sh','engine/vera_cycle/issue_policy.md','engine/vera_cycle/VERSION','integration/control.py'):
            self.assertIn(name,manifest)

    def test_retention_only_compacts_old_terminal_events(self):
        job=self.create();self.store.stop(job['id'],'tester');root=ARTIFACTS/job['id'];root.mkdir();(root/'evidence.txt').write_text('keep')
        active=self.create();before=self.store.events(active['id'],0)
        last=self.store.events(job['id'],0)[-1]['sequence']
        self.assertGreater(self.store.compact_events(time.time()+1),0)
        self.assertEqual(self.store.events(active['id'],0),before)
        events=self.store.events(job['id'],0);self.assertEqual(len(events),1);self.assertEqual(events[0]['sequence'],last)
        self.assertEqual((root/'evidence.txt').read_text(),'keep')
        self.assertEqual(self.store.compact_events(time.time()+1),0)

    def test_policy_is_inactive_hardware_fail_stays_fail(self):
        transport=self.fake();transport.hardware_failure=True
        job=self.create(machine_ids=['neutrino-n1'],limits={'loops':1});self.worker(job,lambda *_:transport)
        self.confirm(self.wait(job,{'AWAITING_CONFIRMATION'}));final=self.wait(job,TERMINAL)
        self.assertEqual(final['health'],'FAIL')
        campaign=json.loads((ARTIFACTS/job['id']/'campaign.json').read_text())
        self.assertEqual(campaign['policy_exceptions'],'NOT_ACTIVE_IN_V1')
        self.assertIn('Policy exceptions not active in V1',(ARTIFACTS/job['id']/'issue_policy.snapshot.md').read_text())


if __name__=='__main__':unittest.main()
