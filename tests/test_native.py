"""Actual Next/ASGI/NodeSession integration, synthetic endpoints only."""
import copy
import json
import time
import threading
import unittest
import uuid
from unittest.mock import patch
import test_integration as base
from integration import web, runner
from integration.store import Store, TERMINAL
from integration.targets import inventory
from scripts.native_demo import fixture
from node_identity import migrate, canonical
from integration.synthetic import SyntheticTransport


class NativeTests(unittest.TestCase):
    setUp=base.IntegrationTests.setUp
    tearDown=base.IntegrationTests.tearDown
    body=base.IntegrationTests.body
    worker=base.IntegrationTests.worker
    wait=base.IntegrationTests.wait
    confirm=base.IntegrationTests.confirm

    def setup_nodes(self,shared=False,chassis=1):
        doc=fixture(chassis=chassis,shared=shared)
        web.pa.machines=doc['machines'];web.pa.projects=doc['projects']
        web.pa._save_data()  # Publish fixtures through the same coordinator baseline as real inventory.
        return inventory(web.pa)

    def create_native(self,**changes):
        ids=[t['name'] for t in inventory(web.pa)]
        r=self.client.post(self.base+'/jobs',json=self.body(machine_ids=ids,**changes))
        self.assertEqual(r.status_code,200,r.text);return r.json()

    def test_single_chassis_four_nodes_eight_actions_and_posts(self):
        targets=self.setup_nodes();job=self.create_native()
        self.worker(job);ready=self.wait(job,{'AWAITING_CONFIRMATION'})
        # Display selection may change after PRE; worker and report retain node snapshots.
        r=self.client.post('/api/machines/chassis-01/select-os',json={'slot':3})
        self.assertEqual(r.status_code,200,r.text)
        self.confirm(ready);done=self.wait(job,TERMINAL,30)
        self.assertEqual(done['state'],'COMPLETE',done)
        self.assertEqual(len(self.store.actions(job['id'])),8)
        self.assertEqual(sum(n['completed'] for n in done['nodes']),8)
        self.assertEqual(sum(n['valid_cycles'] for n in done['nodes']),8)
        self.assertEqual([t['os_ip'] for t in done['targets']],[t['os_ip'] for t in targets])
        encoded=json.dumps(done)+self.client.get(f"{self.base}/jobs/{job['id']}/events/download").text
        self.assertNotIn('SYNTHETIC-OS-',encoded);self.assertNotIn('SYNTHETIC-BMC-',encoded)

    def test_shared_domain_two_actions_eight_posts(self):
        self.setup_nodes(shared=True);job=self.create_native(cycle_mode='power_cycle')
        self.worker(job);self.confirm(self.wait(job,{'AWAITING_CONFIRMATION'}))
        done=self.wait(job,TERMINAL,30)
        self.assertEqual(done['state'],'COMPLETE',done)
        self.assertEqual(len(self.store.actions(job['id'])),2)
        self.assertEqual(sum(n['completed'] for n in done['nodes']),8)

    def test_delete_n2_preserves_n3_n4_and_last_node(self):
        self.setup_nodes();original=copy.deepcopy(web.pa.machines['chassis-01']['os'])
        for slot in (2,1,4):
            r=self.client.delete('/api/machines/chassis-01/os/'+str(slot));self.assertEqual(r.status_code,200,r.text)
        remaining=web.pa.machines['chassis-01']['os']
        self.assertEqual([e['slot'] for e in remaining],[3]);self.assertEqual(remaining[0]['node_id'],original[2]['node_id'])
        self.assertEqual(len(web.pa.machines['chassis-01']['physical_slots']),4)

    def test_patch_label_preserves_port_and_sibling_duplicate_rejected(self):
        self.setup_nodes();baseurl='/api/machines/chassis-01/os/'
        r=self.client.patch(baseurl+'1',json={'label':'renamed'});self.assertEqual(r.status_code,200,r.text)
        self.assertEqual(web.pa.machines['chassis-01']['os'][0]['port'],2222)
        r=self.client.patch(baseurl+'3',json={'ip':web.pa.machines['chassis-01']['os'][0]['ip']})
        self.assertEqual(r.status_code,400)

    def test_active_binding_edit_and_delete_reserved(self):
        self.setup_nodes();job=self.create_native()
        for method,url,body in [('patch','/api/machines/chassis-01/os/3',{'ip':'192.0.2.220'}),('delete','/api/machines/chassis-01/os/2',None),('delete','/api/machines/chassis-01',None)]:
            r=getattr(self.client,method)(url,**({'json':body} if body else {}));self.assertEqual(r.status_code,409,r.text)
        self.assertEqual(len(web.pa.machines['chassis-01']['os']),4)

    def test_stop_parallelism_one_has_no_later_dispatch(self):
        self.stop_case(1)

    def test_128_node_queue_stop_does_not_dispatch_waiting_domains(self):
        self.stop_case(32)

    def stop_case(self,chassis):
        self.setup_nodes(chassis=chassis);job=self.create_native(parallelism=1,limits={'loops':100})
        sent=threading.Event();release=threading.Event()
        class Hold(SyntheticTransport):
            def ssh(inner,target,role,command,*args,**kwargs):
                result=super().ssh(target,role,command,*args,**kwargs)
                if command=='reboot': sent.set();release.wait(10)
                return result
        self.worker(job,Hold);self.confirm(self.wait(job,{'AWAITING_CONFIRMATION'},90))
        self.assertTrue(sent.wait(180),self.store.get(job['id']));self.store.stop(job['id'],'test');release.set()
        done=self.wait(job,TERMINAL,60)
        self.assertEqual(len(self.store.actions(job['id'])),1,done)
        self.assertEqual(sum(n['completed'] for n in done['nodes']),1)

    def test_worker_lost_keeps_reservations(self):
        self.setup_nodes();job=self.create_native();self.store.claim(job['id'],'dead')
        runner.recover(self.store,self.store.get(job['id']))
        self.assertEqual(self.store.get(job['id'])['state'],'RECONCILIATION_REQUIRED')
        self.assertTrue(self.store.lock_owners());self.assertIsNone(self.store.claim(job['id'],'replay'))

    def test_migration_repeat_and_identity_collision(self):
        doc=fixture();self.assertEqual(migrate(doc),doc)
        duplicate=copy.deepcopy(doc['machines']['chassis-01']);doc['machines']['other']=duplicate
        with self.assertRaises(ValueError): migrate(doc)

    def test_128_targets_and_node_filter(self):
        self.setup_nodes(chassis=32)
        data=self.client.get(self.base+'/targets').json();self.assertEqual(len(data['targets']),128)
        self.assertEqual(len({t['parent_name'] for t in data['targets']}),32)
        job=self.create_native(parallelism=1);self.store.stop(job['id'],'test')
        self.assertEqual(self.store.actions(job['id']),[])

    def test_provider_checks_viewer_and_cross_project(self):
        self.setup_nodes()
        class Provider:
            def authenticate(self,request):return 'viewer'
            def authorize(self,actor,project,action):return action=='read' and project in (None,'Neutrino Demo')
        web.app.state.cycle_provider=Provider()
        try:
            self.assertEqual(self.client.post(self.base+'/jobs',json=self.body()).status_code,403)
            self.assertEqual(self.client.get('/api/projects/Other/cycle/jobs').status_code,403)
        finally:del web.app.state.cycle_provider

    def test_empty_canonical_chassis_never_becomes_parent_target(self):
        self.setup_nodes()
        for slot in range(1,5):
            self.assertEqual(self.client.delete('/api/machines/chassis-01/os/'+str(slot)).status_code,200)
        self.assertEqual(inventory(web.pa),[])
        self.assertEqual(self.client.post('/api/machines/chassis-01/select-os',json={'slot':3}).status_code,404)

    def test_native_blocked_plan_is_persistent_and_zero_dispatch(self):
        self.setup_nodes();web.pa.machines['chassis-01']['os'][0]['mapping_status']='needs_confirmation'
        web.pa.machines['chassis-01']['os'][0]['trust']={'private_key':'BLOCKED_SECRET_SENTINEL'}
        body=dict(self.body(machine_ids=[t['name'] for t in inventory(web.pa)]),project='Neutrino Demo')
        response=self.client.post('/api/cycle/runs',json=body)
        self.assertEqual(response.status_code,200,response.text)
        job=response.json();self.assertEqual(job['state'],'BLOCKED');self.assertTrue(job['pre']['excluded'])
        self.assertNotIn('BLOCKED_SECRET_SENTINEL',json.dumps(self.store.get(job['id'])))
        self.assertEqual(self.store.actions(job['id']),[])
        self.assertEqual(self.client.post('/api/cycle/runs',json=body).json()['id'],job['id'])

    def test_legacy_single_node_migration_preserves_binding_and_ports(self):
        source={'id':7,'name':'single','os_ip':'192.0.2.7','os_port':2222,'bmc_ip':'192.0.2.8',
                'bmc_port':2203,'ipmi_port':1623,'power_domain':'verified-domain','credential_ref':'ref7',
                'expected_identity':{'serial':'board7'},'os_hostname':'node7','bmc_hostname':'controller7'}
        result=canonical(source);entry=result['os'][0]
        self.assertEqual((entry['port'],entry['bmc_ssh_port'],entry['ipmi_port']),(2222,2203,1623))
        for field in ('power_domain','credential_ref','expected_identity','os_hostname','bmc_hostname'):
            self.assertEqual(entry[field],source[field])
        self.assertEqual(entry['mapping_status'],'needs_confirmation');self.assertEqual(canonical(result),result)

    def test_reconciliation_requires_exact_review_and_never_replays(self):
        self.setup_nodes();job=self.create_native();self.store.claim(job['id'],'dead');runner.recover(self.store,self.store.get(job['id']))
        url=f"{self.base}/jobs/{job['id']}"
        review=self.client.get(url+'/reconciliation').json()
        response=self.client.post(url+'/reconcile',json=dict(reviewed_actions_hash='wrong',reason='Synthetic evidence reviewed'))
        self.assertEqual(response.status_code,409);self.assertTrue(self.store.lock_owners())
        response=self.client.post(url+'/reconcile',json=dict(reviewed_actions_hash=review['reviewed_actions_hash'],reason='Synthetic evidence reviewed'))
        self.assertEqual(response.status_code,200,response.text);self.assertEqual(response.json()['state'],'INCOMPLETE')
        self.assertEqual(self.store.lock_owners(),{});self.assertIsNone(self.store.claim(job['id'],'replay'))

    def test_shared_sel_collected_once_and_manifest_download(self):
        self.setup_nodes(shared=True);job=self.create_native(cycle_mode='power_cycle');transports=[]
        def factory(*args):
            t=SyntheticTransport(*args);transports.append(t);return t
        self.worker(job,factory);self.confirm(self.wait(job,{'AWAITING_CONFIRMATION'}));self.wait(job,TERMINAL,30)
        commands=[call[2] for t in transports for call in t.calls]
        self.assertEqual(commands.count('ipmitool sel clear'),1)
        self.assertEqual(commands.count('ipmitool sel list'),5) # PRE + before/POST per loop
        url=f"{self.base}/jobs/{job['id']}"
        manifest=self.client.get(url+'/artifacts').json()['manifest']
        report=next(a for a in manifest if a['path']=='campaign.json')
        response=self.client.get(url+'/artifact/'+report['artifact_id'])
        import hashlib
        self.assertEqual(response.status_code,200);self.assertEqual(hashlib.sha256(response.content).hexdigest(),report['sha256'])

    def test_session_reservations_are_canonical_and_authorized(self):
        from fastapi import FastAPI, WebSocket
        from fastapi.testclient import TestClient
        from integration.sessions import SessionReservations
        self.setup_nodes();app=FastAPI()
        class Provider:
            def authenticate(self,connection): return 'engineer' if connection.headers.get('x-test-actor')=='engineer' else None
            def authorize(self,actor,project,action): return project=='Neutrino Demo'
        app.state.cycle_provider=Provider()
        @app.websocket('/ws/terminal/{name}/{kind}')
        async def fake(ws:WebSocket,name:str,kind:str):
            await ws.accept();await ws.send_text('ready');await ws.receive_text()
        app.add_middleware(SessionReservations,pa=web.pa,store_getter=lambda:self.store,mode='live')
        from starlette.websockets import WebSocketDisconnect
        with TestClient(app) as client:
            with self.assertRaises(WebSocketDisconnect):
                with client.websocket_connect('/ws/terminal/chassis-01/os?slot=3'): pass
            with client.websocket_connect('/ws/terminal/chassis-01/os?slot=3',headers={'x-test-actor':'engineer'}) as socket:
                self.assertEqual(socket.receive_text(),'ready')
                n3=next(t for t in inventory(web.pa) if t['slot_key']=='N3')
                self.assertIn('node:'+n3['node_id'],self.store.lock_owners())
                r=self.client.post(self.base+'/jobs',json=self.body(machine_ids=[n3['name']]))
                self.assertEqual(r.status_code,409)
                socket.send_text('close')
        self.assertEqual(self.store.lock_owners(),{})

    def test_cursor_compaction_requires_snapshot_reset(self):
        self.setup_nodes();job=self.create_native();self.store.append_event(job['id'],dict(message='retained'))
        self.store.stop(job['id'],'test');self.store.compact_events(time.time()+1)
        page=self.client.get(f"{self.base}/jobs/{job['id']}/events?after=1").json()
        self.assertTrue(page['cursor_reset']);self.assertTrue(page['history_compacted'])

    def test_session_active_selection_is_frozen_before_proxy(self):
        from fastapi import FastAPI, WebSocket
        from fastapi.testclient import TestClient
        from integration.sessions import SessionReservations
        self.setup_nodes();web.pa.machines['chassis-01']['active_os']=3
        app=FastAPI()
        class Provider:
            def authenticate(self,connection): return 'test'
            def authorize(self,*args): return True
        app.state.cycle_provider=Provider()
        @app.websocket('/ws/terminal/{name}/{kind}')
        async def fake(ws:WebSocket,name:str,kind:str):
            web.pa.machines[name]['active_os']=1
            await ws.accept();await ws.send_json({'slot':ws.query_params['slot'],'bmc':ws.scope['cycle_bmc']['bmc_ip']})
            await ws.receive_text()
        app.add_middleware(SessionReservations,pa=web.pa,store_getter=lambda:self.store,mode='live')
        expected=web.pa.machines['chassis-01']['os'][2]['bmc_ip']
        with TestClient(app) as client:
            with client.websocket_connect('/ws/terminal/chassis-01/os') as socket:
                self.assertEqual(socket.receive_json(),{'slot':'3','bmc':expected});socket.send_text('close')

    def test_nested_inventory_secrets_never_enter_snapshot(self):
        self.setup_nodes()
        entry=web.pa.machines['chassis-01']['os'][0]
        entry['expected_identity']={'serial':'expected','private_key':'PRIVATE_SENTINEL','nested':{'password':'PASSWORD_SENTINEL'}}
        entry['trust']={'fingerprint':'public-trust','headers':{'Authorization':'HEADER_SENTINEL'}}
        job=self.create_native()
        text=json.dumps(self.store.get(job['id']))
        for value in ('PRIVATE_SENTINEL','PASSWORD_SENTINEL','HEADER_SENTINEL'):self.assertNotIn(value,text)
        self.assertIn('public-trust',text)

    def test_create_and_binding_edit_serialize_at_route_boundary(self):
        from concurrent.futures import ThreadPoolExecutor
        self.setup_nodes();entered=threading.Event();release=threading.Event()
        original=self.store.create
        def held(*args,**kwargs):
            entered.set();self.assertTrue(release.wait(5));return original(*args,**kwargs)
        ids=[t['name'] for t in inventory(web.pa)]
        with patch.object(self.store,'create',side_effect=held),ThreadPoolExecutor(max_workers=2) as pool:
            create=pool.submit(self.client.post,self.base+'/jobs',json=self.body(machine_ids=ids))
            self.assertTrue(entered.wait(5))
            edit=pool.submit(self.client.patch,'/api/machines/chassis-01/os/3',json={'ip':'192.0.2.230'})
            release.set();created=create.result(10);changed=edit.result(10)
        self.assertEqual(created.status_code,200,created.text);self.assertEqual(changed.status_code,409,changed.text)
        n3=next(t for t in created.json()['targets'] if t['slot_key']=='N3')
        self.assertEqual(n3['os_ip'],web.pa.machines['chassis-01']['os'][2]['ip'])

    def test_manual_power_shared_controller_cannot_fake_independent_domains(self):
        self.setup_nodes(shared=True)
        for e in web.pa.machines['chassis-01']['os']:
            e['power_domain']='pretend-'+str(e['slot']);e['capabilities']={'independent_power':True}
        target=inventory(web.pa)[0]
        with patch.object(web,'MODE','live'),patch.object(web,'control_transport') as transport:
            response=self.client.post('/api/machine/'+target['name']+'/power',json={'on':False})
        self.assertEqual(response.status_code,409,response.text);transport.assert_not_called()
        self.assertEqual(self.store.controls(),[])

    def test_legacy_observation_and_cycle_share_reservations(self):
        from types import SimpleNamespace
        from unittest.mock import Mock
        from integration.legacy_observation import install,caller
        from integration.store import Conflict
        self.setup_nodes();calls=Mock(return_value=('ok',0,''))
        pa=SimpleNamespace(machines=web.pa.machines,projects=web.pa.projects,_DATA_LOCK=web.pa._DATA_LOCK,
                           ssh_run=calls,ssh_ipmi=calls,_ipmi_run_any=calls,ipmi_power=calls,
                           run_control_cmd=calls,_reboot_machine=calls)
        class Provider:
            def authorize(self,*a):return True
            def approve_legacy_observation(self,actor,targets,operation):return operation.get('command')=='hostname'
        install(pa,lambda:self.store,lambda:Provider());token=caller.set('test')
        try:
            t=inventory(web.pa)[0];job=self.create_native()
            with self.assertRaises(Conflict):pa.ssh_run(t['os_ip'],'user','secret',2222,'hostname')
            calls.assert_not_called();self.store.stop(job['id'],'test')
            self.assertEqual(pa.ssh_run(t['os_ip'],'user','secret',2222,'hostname'),('ok',0,''))
            with self.assertRaises(Conflict):pa.run_control_cmd({},'aux')
            with self.assertRaises(Conflict):pa.ipmi_power({},'reset')
            self.assertEqual(calls.call_count,1)
        finally:caller.reset(token)

    def test_live_cannot_use_environment_operator_as_caller(self):
        from integration import authorization
        import os
        self.setup_nodes()
        with patch.object(authorization,'MODE','live'),patch.dict(os.environ,{'CYCLE_USERS_JSON':'{"operator":"not-authentication"}'}):
            r=self.client.post(self.base+'/jobs',json=self.body(),headers={'X-Operator':'operator'})
        self.assertEqual(r.status_code,503);self.assertEqual(self.store.jobs(),[])

    def test_nondefault_ipmi_port_is_separate_from_ssh(self):
        from cycle_transport import Transport
        from cycle_core import Target
        from types import SimpleNamespace
        t=Transport({'bmc':'PRIVATE-BMC'},'unused',ports={'bmc':2201},ipmi_port=1623)
        with patch('cycle_transport.subprocess.run',return_value=SimpleNamespace(returncode=0,stdout='Chassis Power is on',stderr='')) as run:
            t.oob(Target('t','n','192.0.2.2','192.0.2.1'),'power status')
        argv=run.call_args.args[0]
        self.assertEqual(argv[argv.index('-p')+1],'1623');self.assertEqual(t.ports['bmc'],2201)
        self.assertNotIn('PRIVATE-BMC',argv);self.assertEqual(run.call_args.kwargs['env']['IPMI_PASSWORD'],'PRIVATE-BMC')

    def test_create_four_slot_primary_bmc_and_port_patch_through_routes(self):
        metadata={'ipmi_cipher':17,'aux_scope_confirmed':True,'console_id':'console3','node_serial':'board3','hardware_uuid':'uuid3'}
        normalized=web.pa._norm_os_entry(dict(ip='192.0.2.3',user='fixture',**metadata),3)
        self.assertEqual({key:normalized[key] for key in metadata},metadata)
        def ssh(host,*args,**kwargs):
            return ('IP Address : 198.18.20.1' if host=='198.18.20.1' else 'distinct-'+host,0,'')
        body=dict(os_ip='192.0.2.201',os_user='primary',os_pass='FAKE_PRIMARY',os_port=2222,
                  bmc_ip='198.18.20.1',bmc_user='bmc-primary',bmc_pass='FAKE_BMC',bmc_port=2201,
                  project='Neutrino Demo',os=[dict(ip='192.0.2.'+str(201+i),user='user'+str(i),
                  **{'pass':'FAKE_EXTRA'},port=2222+i,bmc_ip='198.18.20.'+str(i+1),
                  bmc_user='bmc'+str(i),bmc_pass='FAKE_EXTRA_BMC',bmc_ssh_port=2201+i,ipmi_port=1623+i) for i in range(1,4)])
        with patch.object(web,'MODE','live'),patch.object(web.pa,'ssh_run',side_effect=ssh),patch.object(web.pa,'ping_check',return_value=True),patch.object(web.pa,'ssh_login_ok',return_value=True):
            response=self.client.post('/api/machines',json=body)
        self.assertEqual(response.status_code,200,response.text)
        name='distinct-192.0.2.201';saved=web.pa.machines[name]
        self.assertEqual(saved['bmc_ip'],body['bmc_ip']);self.assertEqual(saved['bmc_port'],2201)
        self.assertEqual([n['bmc_ssh_port'] for n in saved['os']],[2201,2202,2203,2204])
        url='/api/machines/'+name+'/os/3'
        self.assertEqual(self.client.patch(url,json={'bmc_ssh_port':2303,'ipmi_port':2623}).status_code,200)
        self.assertEqual(self.client.patch(url,json={'label':'changed only'}).status_code,200)
        self.assertEqual(self.client.post('/api/machines/'+name+'/select-os',json={'slot':3}).status_code,200)
        self.assertEqual((saved['os'][2]['port'],saved['bmc_port'],saved['os'][2]['ipmi_port']),(2224,2303,2623))
