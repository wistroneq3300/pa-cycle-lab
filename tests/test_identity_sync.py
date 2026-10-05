"""Identity collector + durable metadata adapter using only fixture transport."""
import copy
import json
import tempfile
import threading
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock
from integration import settings
from integration.targets import inventory, node_identity
from integration.identity_sync import IdentitySync
from integration.inspection_fixture import FixtureTransport
from validation_collectors import Collector
from validation_identity import collect_identity,normalize_hostname
from cycle_core import Target

BOOT='00000000-0000-0000-0000-000000000001'
BOOT2='00000000-0000-0000-0000-000000000002'


class Identity(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.file=Path(self.tmp.name)/'inventory.json'
        machine=node_identity.canonical(dict(id='chassis1',name='box',project='P',active_os=1,os=[
            dict(slot=i,ip='192.0.2.'+str(i),user='user'+str(i),port=2200+i,os_hostname='n'+str(i),bmc_ip='198.51.100.'+str(i),bmc_hostname='b'+str(i)) for i in range(1,5)]))
        self.pa=SimpleNamespace(machines={'box':machine},projects={'P':{'project_id':'p'}},node_identity=node_identity,_DATA_LOCK=threading.RLock(),_invalidate_machine_cache=Mock())
        self.pa._save_data=Mock(side_effect=lambda:self.file.write_text(json.dumps(self.pa.machines),encoding='utf8'))
        self.sync=IdentitySync(self.pa);self.scenario={};self.calls=[]
    def tearDown(self): self.tmp.cleanup()
    def target(self,i=0): return dict(inventory(self.pa)[i],binding_revision=self.pa.machines['box']['os'][i]['binding_revision'])
    def pin_redfish(self,i=0):
        # These cases exercise the Redfish transport; pin it so auto mode does not
        # route through the (also-faked) BMC SSH path first.
        node=self.pa.machines['box']['os'][i];node['capabilities']={'bmc_hostname_query':'redfish'}
        node['binding_revision']=int(node.get('binding_revision',1))+1
    def observe(self,t=None):
        t=t or self.target();transport=FixtureTransport(t,self.scenario,self.calls)
        return collect_identity(Collector(transport,Target('t','n',t['os_ip'],t['bmc_ip']),clock=lambda:1000),t)
    def test_unchanged_zero_inventory_write(self):
        # First observation records the MAC baseline (one durable write); an identical
        # second observation must then be a true no-op with no further writes.
        self.sync(self.target(),self.observe());self.pa._save_data.reset_mock()
        self.assertEqual(self.sync(self.target(),self.observe())['status'],'UNCHANGED');self.pa._save_data.assert_not_called()
    def test_os_rename_stable_identity_and_history(self):
        t=self.target();self.scenario['hostname']='new.example.'
        result=self.sync(t,self.observe(t));after=self.target()
        self.assertEqual(result['status'],'AUTO_SYNC');self.assertEqual(after['node_id'],t['node_id'])
        self.assertEqual(after['chassis_id'],t['chassis_id']);self.assertEqual(after['os_hostname'],'new.example')
        self.assertEqual(result['events'][0]['severity'],'INFO');self.assertTrue(self.file.exists())
    def test_bmc_redfish_hostname(self):
        self.pin_redfish()
        self.scenario['bmc_hostname']='new-bmc';self.sync(self.target(),self.observe())
        self.assertEqual(self.target()['bmc_hostname'],'new-bmc')
    def test_bmc_unsupported_does_not_block_os(self):
        self.pin_redfish()
        self.scenario['hostname']='new';obs=self.observe();self.assertEqual(obs['bmc_status'],'NOT_SUPPORTED')
        self.sync(self.target(),obs);self.assertEqual(self.target()['os_hostname'],'new')
    def test_os_failure_keeps_name(self):
        self.scenario['failed']=['identity'];obs=self.observe();self.assertEqual(obs['os_status'],'UNAVAILABLE')
        self.sync(self.target(),obs);self.assertEqual(self.target()['os_hostname'],'n1')
    def test_bmc_failure_keeps_name(self):
        self.pin_redfish()
        self.scenario['failed']=['redfish'];obs=self.observe();self.assertEqual(obs['bmc_status'],'UNAVAILABLE')
        self.sync(self.target(),obs);self.assertEqual(self.target()['bmc_hostname'],'b1')
    def test_concurrent_binding_edit_rejected(self):
        t=self.target();self.scenario['hostname']='new';obs=self.observe(t)
        self.pa.machines['box']['os'][0]['ip']='192.0.2.99'
        self.assertEqual(self.sync(t,obs)['status'],'IDENTITY_REQUIRES_CONFIRMATION');self.pa._save_data.assert_not_called()
    def test_retired_rejected(self):
        t=self.target();obs=self.observe(t);self.pa.machines['box']['os'][0]['retired']=True
        self.assertEqual(self.sync(t,obs)['status'],'IDENTITY_REQUIRES_CONFIRMATION')
    def test_revision_only_change_rejected(self):
        t=self.target();obs=self.observe(t);self.pa.machines['box']['os'][0]['binding_revision']+=1
        self.assertEqual(self.sync(t,obs)['status'],'IDENTITY_REQUIRES_CONFIRMATION')
    def test_boot_change_same_node(self):
        t=self.target();self.scenario['boot_id']=BOOT2
        result=self.sync(t,self.observe(t),BOOT)
        self.assertEqual(result['events'][0]['kind'],'BOOT_GENERATION_CHANGED');self.assertEqual(t['node_id'],self.target()['node_id'])
    def test_boot_and_rename_are_normal_changes(self):
        self.scenario.update(boot_id=BOOT2,hostname='new')
        result=self.sync(self.target(),self.observe(),BOOT)
        self.assertEqual({e['kind'] for e in result['events']},{'BOOT_GENERATION_CHANGED','OS_HOSTNAME_CHANGED'})
    def test_active_os_switch_does_not_redirect(self):
        t=self.target(2);self.scenario['hostname']='new3';obs=self.observe(t)
        self.pa.machines['box']['active_os']=4;self.sync(t,obs)
        self.assertEqual(self.target(2)['os_hostname'],'new3');self.assertEqual(self.target(3)['os_hostname'],'n4')
    def test_four_nodes_remain_distinct(self):
        for i in range(4):
            t=self.target(i);self.scenario['hostname']='new'+str(i);self.sync(t,self.observe(t))
        self.assertEqual([t['os_hostname'] for t in inventory(self.pa)],['new0','new1','new2','new3'])
    def test_reread_no_duplicate_history(self):
        self.scenario['hostname']='new';self.sync(self.target(),self.observe());self.sync(self.target(),self.observe())
        self.assertEqual(len(self.pa.machines['box']['identity_history']),1);self.assertEqual(self.pa._save_data.call_count,1)
    def test_restart_deduplicates(self):
        self.scenario.update(hostname='new',boot_id=BOOT2);self.sync(self.target(),self.observe(),BOOT)
        self.pa.machines=json.loads(self.file.read_text());IdentitySync(self.pa)(self.target(),self.observe(),BOOT)
        self.assertEqual(len(self.pa.machines['box']['identity_history']),2)
    def test_independent_asset_mismatch_requires_confirmation(self):
        t=self.target();obs=self.observe();obs['identity_mismatch']=True
        self.assertEqual(self.sync(t,obs)['status'],'IDENTITY_REQUIRES_CONFIRMATION')
    def test_old_evidence_unchanged_new_context_renamed(self):
        old=Path(self.tmp.name)/'old-report.json';old.write_text(json.dumps(self.target()));before=old.read_bytes()
        self.scenario['hostname']='new';self.sync(self.target(),self.observe())
        self.assertEqual(old.read_bytes(),before);self.assertEqual(self.observe()['os_hostname'],'new')
    def test_normalization_not_rename_loop(self):
        self.sync(self.target(),self.observe())   # baseline (MAC + raw)
        self.pa._save_data.reset_mock()
        # A case/whitespace-only difference must NOT create a HOSTNAME_CHANGED event.
        self.scenario['hostname']='  N1.\n';self.sync(self.target(),self.observe())
        self.assertFalse(any(e['kind']=='OS_HOSTNAME_CHANGED' for e in self.pa.machines['box']['identity_history']))
        self.assertEqual(self.pa.machines['box']['os'][0]['os_hostname'],'n1')
        self.assertEqual(normalize_hostname('Host.Example.'),'host.example');self.assertIsNone(normalize_hostname('bad name'))
    def test_known_bmc_ssh_capability(self):
        self.pa.machines['box']['os'][0]['capabilities']={'bmc_hostname_query':'ssh_hostname'}
        obs=self.observe();self.assertEqual(obs['bmc_source'],'bmc_ssh_hostname')
        self.assertFalse(any(role=='redfish' for _,role,_ in self.calls))
    def test_save_failure_rolls_back_metadata_and_history(self):
        before=copy.deepcopy(self.pa.machines);self.pa._save_data.side_effect=OSError('disk full');self.scenario['hostname']='new'
        with self.assertRaises(OSError): self.sync(self.target(),self.observe())
        self.assertEqual(self.pa.machines,before)
    def test_shared_collector_has_no_inventory_side_effects(self):
        t=self.target();before=copy.deepcopy(self.pa.machines);obs=self.observe(t)
        self.assertEqual(obs['node_id'],t['node_id']);self.assertEqual(self.pa.machines,before)
        self.assertEqual(sum('HOSTNAME=' in c for _,_,c in self.calls),1)
        self.assertFalse(any('power' in c or 'reboot' in c for _,_,c in self.calls))

    def test_real_route_service_collects_and_syncs_without_cycle(self):
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        from integration.inspection_routes import install
        from integration.store import Store
        from unittest.mock import patch
        root=Path(self.tmp.name);jobs=Store(root/'jobs.sqlite3')
        self.pa.telemetry_core=SimpleNamespace(DB_FILE=root/'telemetry.sqlite3')
        app=FastAPI();get_service=install(app,self.pa,lambda:jobs);svc=get_service()
        self.scenario.update(hostname='renamed.example',bmc_hostname='bmc.example')
        svc.source.transport=lambda t:FixtureTransport(t,self.scenario,self.calls)
        try:
            with patch('integration.inspection_routes.MODE','synthetic'):
                client=TestClient(app);base='/api/machine/box/inspection'
                self.assertEqual(client.post(base+'/run').status_code,202)
                for future,_ in list(svc._active.values()):future.result(15)
                payload=client.get(base).json()
                self.assertIsNone(payload.get('error'),payload)
                # Inspection is scoped to the machine's selected node (active_os),
                # so only the active slot is collected and reports identity changes.
                self.assertEqual(len(payload['nodes']),1)
                self.assertEqual(payload['nodes'][0]['slot'],1)
                self.assertEqual(len(payload['identity_history']),2)
                self.assertTrue(all(n['os_hostname']=='renamed.example' for n in payload['nodes']))
                self.assertEqual(payload['summary'],{'fail':0,'warning':0})
                self.assertEqual(jobs.jobs('P'),[])
                previous=len(payload['identity_history'])
                self.assertEqual(client.post(base+'/run').status_code,202)
                for future,_ in list(svc._active.values()):future.result(15)
                self.assertEqual(len(client.get(base).json()['identity_history']),previous)
                identity=next(c for c in payload['coverage'] if c['source']=='Identity')
                self.assertEqual(client.get(base+'/evidence/'+identity['evidence_ref']['snapshot_id']).status_code,200)
                client.close()
        finally: svc.close()

    def test_expected_asset_missing_or_wrong_does_not_rename(self):
        self.pa.machines['box']['os'][0]['hardware_uuid']='asset-one'
        t=self.target();self.scenario['hostname']='other';obs=self.observe(t)
        self.assertEqual(self.sync(t,obs)['status'],'IDENTITY_REQUIRES_CONFIRMATION')
        obs['hardware_uuid']='asset-two'
        self.assertEqual(self.sync(t,obs)['status'],'IDENTITY_REQUIRES_CONFIRMATION')
        obs['hardware_uuid']='asset-one'
        self.assertEqual(self.sync(t,obs)['status'],'AUTO_SYNC')

    def test_redfish_display_name_is_not_hostname_and_auth_is_distinct(self):
        from cycle_transport import Command
        self.pin_redfish()
        t=self.target();transport=FixtureTransport(t)
        transport.redfish_get=lambda target,path,token,timeout=30:Command(0,json.dumps({'Members':[{'@odata.id':'/redfish/v1/Managers/a'}]} if path.endswith('Managers') else {'Name':'BMC display','Id':'a'}))
        collector=Collector(transport,Target('t','n',t['os_ip'],t['bmc_ip']))
        self.assertEqual(collect_identity(collector,t)['bmc_status'],'NOT_SUPPORTED')
        transport.redfish_get=lambda *a,**k:Command(22,'HTTP 401 Unauthorized')
        self.assertEqual(collect_identity(collector,t)['bmc_status'],'AUTH_FAILED')

    def test_inspection_scopes_to_active_os(self):
        from fastapi import FastAPI
        from integration.inspection_routes import install
        from integration.store import Store
        root=Path(self.tmp.name);jobs=Store(root/'jobs.sqlite3')
        self.pa.telemetry_core=SimpleNamespace(DB_FILE=root/'telemetry.sqlite3')
        app=FastAPI();get_service=install(app,self.pa,lambda:jobs);svc=get_service()
        base='/api/machine/box/inspection'
        # The box owns 4 OS slots; the selected node decides the inspection scope.
        for slot in (1,2,3,4):
            self.pa.machines['box']['active_os']=slot
            nodes=svc.resolve('box')['nodes']
            self.assertEqual([n['slot'] for n in nodes],[slot])
        # Without a selected node the full slot list is retained.
        self.pa.machines['box']['active_os']=None
        self.assertEqual(len(svc.resolve('box')['nodes']),4)

    def test_collect_identity_records_mac(self):
        obs=self.observe();self.assertEqual(obs['os_mac'],'02:00:00:00:00:01');self.assertEqual(obs['bmc_mac'],'02:00:00:00:00:02')

    def test_rename_same_mac_updates_and_stores_mac(self):
        t=self.target();self.sync(t,self.observe(t))          # baseline: MAC stored, no rename
        self.assertEqual(self.pa.machines['box']['os'][0]['os_mac'],'02:00:00:00:00:01')
        self.scenario['hostname']='renamed.example'
        result=self.sync(self.target(),self.observe())
        self.assertEqual(result['status'],'AUTO_SYNC')
        self.assertEqual(self.target()['os_hostname'],'renamed.example')
        self.assertEqual(self.pa.machines['box']['os'][0]['os_mac'],'02:00:00:00:00:01')

    def test_rename_different_mac_is_blocked(self):
        t=self.target();self.sync(t,self.observe(t))          # baseline MAC recorded
        self.pa._save_data.reset_mock()
        self.scenario['hostname']='renamed.example'
        self.scenario['os_ip_a']='2: eth9: <UP>\n    link/ether aa:bb:cc:dd:ee:ff\n    inet %s/24 scope global eth9\n' % t['os_ip']
        result=self.sync(self.target(),self.observe())
        self.assertEqual(result['status'],'IDENTITY_REQUIRES_CONFIRMATION')
        self.assertIn('MAC',result['reason']);self.pa._save_data.assert_not_called()

    def test_rename_without_mac_after_baseline_is_blocked(self):
        t=self.target();self.sync(t,self.observe(t))          # baseline MAC recorded
        self.scenario['hostname']='renamed.example';self.scenario['os_ip_a']=''  # MAC unreadable now
        result=self.sync(self.target(),self.observe())
        self.assertEqual(result['status'],'IDENTITY_REQUIRES_CONFIRMATION')

    def test_mac_change_without_rename_is_blocked(self):
        t=self.target();self.sync(t,self.observe(t))          # baseline MAC recorded
        self.scenario['os_ip_a']='2: eth9: <UP>\n    link/ether aa:bb:cc:dd:ee:ff\n    inet %s/24 scope global eth9\n' % t['os_ip']
        result=self.sync(self.target(),self.observe())
        self.assertEqual(result['status'],'IDENTITY_REQUIRES_CONFIRMATION')


if __name__=='__main__': unittest.main()
