"""Offline regressions for the project review. Never imports/starts main.app."""
import ast
import copy
import datetime
import io
import json
import os
import threading
import time
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

ROOT = Path(__file__).resolve().parents[1]


class ApiError(Exception):
    def __init__(self, code, message):
        self.status_code = code
        super().__init__(message)


def extract(file, names, scope):
    import node_identity
    scope.setdefault("node_identity",node_identity)
    tree = ast.parse((ROOT / file).read_text(encoding='utf-8'))
    if file == 'main.py':
        scope.setdefault('os', os)
        names = [*names, *(n for n in ('_machine_allowed', '_project_allowed', '_machine_candidate', '_connection_node', '_os_conflict', '_is_masked') if n not in names)]
        if '_invalidate_machine_cache' not in names and '_invalidate_machine_cache' not in scope:
            names = [*names, '_invalidate_machine_cache']
    if file == 'main.py' and '_background_target' not in names:
        names = [*names, '_background_target']
    nodes = [n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name in names]
    assert len(nodes) == len(names)
    for n in nodes:
        n.decorator_list = []
        n.returns = None
        for a in n.args.args:
            a.annotation = None
    exec(compile(ast.fix_missing_locations(ast.Module(body=nodes, type_ignores=[])), file, 'exec'), scope)


class Operations(unittest.TestCase):
    def setUp(self):
        self.m = dict(name='node', active_os=2, os_ip='old2', os_user='user2', os_pass='secret2',
                      bmc_ip='bmc1', bmc_user='root', bmc_pass='secretB', os=[
                          dict(slot=1, ip='old1', user='user1', **{'pass':'secret1'}, bmc_ip='bmc1'),
                          dict(slot=2, os_hostname='node', ip='old2', user='user2', **{'pass':'secret2'})])
        import node_identity
        self.m.update(node_identity.canonical(self.m))
        self.m['os'][1]['bmc_hostname']='node'
        self.s = dict(machines={'node':self.m}, copy=copy, json=json, os=os, time=time,
                      telemetry_core=SimpleNamespace(kind_of=lambda m,n='':m.get('mgx_type','server')),
                      HTTPException=ApiError, _DATA_LOCK=threading.RLock(), ping_check=lambda *a, **k:True,
                      _save_data=Mock(), ssh_run=Mock(return_value=('node',0,'')))
        extract('main.py', ['_sync_active_os','_invalidate_machine_cache','_bmc_safe','_mask_os_list','_commit_connection',
                'machine_delete_os','change_os_ip','change_bmc_ip','probe_bmc','_reboot_machine',
                '_operation_target'], self.s)

    def connection_body(self,**values):
        e=self.m['os'][1]
        return SimpleNamespace(expected_node_id=e['node_id'],expected_binding_revision=self.s['node_identity'].binding(e),**values)

    def test_missing_paired_bmc_is_cleared(self):
        self.s['_sync_active_os'](self.m)
        self.assertEqual(self.m['bmc_ip'], '')
        self.assertEqual(self.m['bmc_pass'], '')

    def test_delete_active_slot_keeps_canonical_identity_without_fallback(self):
        self.s['machine_delete_os']('node',2)
        self.assertEqual(self.m['os_ip'],'')
        self.assertEqual(self.m['os_pass'],'')
        self.assertEqual(len(self.m['os']),1)
        self.assertTrue(self.m['os'][0]['node_id'])

    def test_ip_changes_survive_resync_and_never_return_passwords(self):
        for fn,field,value in [('change_os_ip','new_os_ip','new2'),('change_bmc_ip','new_bmc_ip','newB')]:
            result=self.s[fn]('node',self.connection_body(**{field:value},os_user='user2',os_pass='secret2',os_port=22,bmc_user='root',bmc_pass='secretB',bmc_ssh_port=22))
            self.assertTrue(result['ok'])
            self.assertNotIn('secret',json.dumps(result))
        self.s['_sync_active_os'](self.m)
        self.assertEqual(self.m['os_ip'],'new2')
        self.assertEqual(self.m['bmc_ip'],'newB')

    def test_probe_resolves_credentials_on_server(self):
        self.s['_probe_bmc_ip']=Mock(return_value=('paired',True,''))
        body=SimpleNamespace(machine_name='node',os_ip='old2',os_user='',os_pass='****',os_port=22,expected_hostname='')
        self.assertTrue(self.s['probe_bmc'](body)['ok'])
        self.assertEqual(self.s['ssh_run'].call_args.args[2],'secret2')

    def test_probe_rejects_changed_target_before_ssh(self):
        self.s['_probe_bmc_ip']=Mock()
        for target in ['new2', 'old1', '']:
            body=SimpleNamespace(machine_name='node',os_ip=target,os_user='',os_pass='****',os_port=22,expected_hostname='')
            with self.assertRaises(ApiError) as error:
                self.s['probe_bmc'](body)
            self.assertEqual(error.exception.status_code,409)
        self.s['ssh_run'].assert_not_called()
        self.s['_probe_bmc_ip'].assert_not_called()

    def test_manual_probe_uses_only_supplied_credentials(self):
        self.s['_probe_bmc_ip']=Mock(return_value=('paired',True,''))
        body=SimpleNamespace(machine_name='',os_ip='new2',os_user='manual',os_pass='explicit',os_port=2222,expected_hostname='node')
        self.assertTrue(self.s['probe_bmc'](body)['ok'])
        self.assertEqual(self.s['ssh_run'].call_args.args[:4],('new2','manual','explicit',2222))
        self.assertEqual(self.s['_probe_bmc_ip'].call_args.args,('new2','manual','explicit',2222))

    def test_probe_missing_machine_masked_manual_and_invalid_port_are_rejected(self):
        for name,password,port in [('missing','explicit',22),('', '****',22),('', 'explicit',0),('', 'explicit',65536)]:
            with self.assertRaises(ApiError):
                self.s['probe_bmc'](SimpleNamespace(machine_name=name,os_ip='new2',os_user='manual',os_pass=password,os_port=port,expected_hostname=''))
        self.s['ssh_run'].assert_not_called()

    def test_changed_ip_requires_explicit_credentials_before_network(self):
        self.s['ping_check']=Mock()
        before=copy.deepcopy(self.m)
        for password in ['', '****']:
            with self.assertRaises(ApiError):
                self.s['change_os_ip']('node',self.connection_body(new_os_ip='new2',os_user='user2',os_pass=password))
        self.s['ping_check'].assert_not_called()
        self.s['ssh_run'].assert_not_called()
        self.s['_save_data'].assert_not_called()
        self.assertEqual(self.m,before)

    def test_changed_ip_saves_explicit_connection_to_active_slot(self):
        body=self.connection_body(new_os_ip='new2',os_user='manual',os_pass='explicit',os_port=2222)
        self.assertTrue(self.s['change_os_ip']('node',body)['ok'])
        self.assertEqual(self.s['ssh_run'].call_args.args[:4],('new2','manual','explicit',2222))
        self.s['_sync_active_os'](self.m)
        self.assertEqual((self.m['os_ip'],self.m['os_user'],self.m['os_pass'],self.m['os_port']),('new2','manual','explicit',2222))
        self.assertEqual(self.m['os'][0]['pass'],'secret1')

    def test_changed_ip_hostname_failure_preserves_connection(self):
        before=copy.deepcopy(self.m)
        self.s['ssh_run'].return_value=('other',0,'')
        self.assertFalse(self.s['change_os_ip']('node',self.connection_body(new_os_ip='new2',os_user='manual',os_pass='explicit',os_port=22))['ok'])
        self.assertEqual(self.m,before)
        self.s['_save_data'].assert_not_called()

    def test_unchanged_ip_needs_no_credentials_or_network(self):
        self.assertFalse(self.s['change_os_ip']('node',self.connection_body(new_os_ip='old2'))['changed'])
        self.s['ssh_run'].assert_not_called()

    def test_refused_reboot_is_not_success(self):
        self.s['ssh_run'].return_value=('',255,'Connection refused')
        self.assertFalse(self.s['_reboot_machine'](self.m)[0])
        self.s['ssh_run'].return_value=('',255,'Connection closed')
        self.assertFalse(self.s['_reboot_machine'](self.m)[0])
        self.s['ssh_run'].return_value=('',0,'')
        self.assertTrue(self.s['_reboot_machine'](self.m)[0])

    def test_target_change_rejected_before_command(self):
        with self.assertRaises(ApiError) as e:
            self.s['_operation_target']('node',{'expected_target':{'active_os':1,'os_ip':'old1','bmc_ip':'bmc1'}})
        self.assertEqual(e.exception.status_code,409)

    def test_failed_load_preserves_inventory_and_blocks_save(self):
        self.s.update(projects={'rack':{}}, links=[], _seq=3, DATA_FILE='unread-test-file', _DATA_LOCK=threading.RLock())
        extract('main.py',['_load_data','_save_data'],self.s)
        before=copy.deepcopy(self.s['machines'])
        with patch('os.path.exists',return_value=True),patch('builtins.open',return_value=io.StringIO('{broken')):
            with self.assertRaises(RuntimeError):self.s['_load_data']()
        self.assertEqual(self.s['machines'],before)
        with self.assertRaises(ApiError) as e:self.s['_save_data']()
        self.assertEqual(e.exception.status_code,503)

    def test_only_mounted_rack_members_and_external_cdu(self):
        scope={'kind_of':lambda m:m.get('mgx_type','server')}
        extract('telemetry_core.py',['is_rack_member'],scope)
        member=scope['is_rack_member']
        base=dict(project='Rack',level='rack')
        self.assertFalse(member(base,'rack'))
        self.assertFalse(member(dict(base,rack_u=4),'rack'))  # Distinct authorized Project.
        self.assertTrue(member(dict(base,rack_u=4),'Rack'))
        self.assertTrue(member(dict(base,rack_mount='external',mgx_type='cdu'),'Rack'))
        self.assertFalse(member(dict(base,rack_u=1,mgx_type='blanking'),'Rack'))

    def test_secret_cache_uses_elapsed_time(self):
        scope={}
        exec(compile((ROOT/'spx_kvm_broker/secret_store.py').read_text(), 'secret_store.py', 'exec'),scope)
        store=scope['AgeSecretStore'](Path('unused'),Path('unused'))
        store._decrypt_payload=Mock(return_value={'node':{'password':'test-only'}})
        with patch.object(scope['time'],'monotonic',return_value=100):
            for _ in range(100):store.credential('node')
        self.assertEqual(store._decrypt_payload.call_count,1)
        with patch.object(scope['time'],'monotonic',return_value=161):store.credential('node')
        self.assertEqual(store._decrypt_payload.call_count,2)

    def test_bmc_force_refresh_starts_collection_even_with_fresh_cache(self):
        now=time.time()
        class ImmediateThread:
            def __init__(self,target,**kw):self.target=target
            def start(self):self.target()
        self.s.update(datetime=datetime, threading=SimpleNamespace(Thread=ImmediateThread),
            _network_identity=lambda *a:{},_bmc_safe=lambda m:{'bmc_alive':True,'os_alive':False},
            _os_info_cache={},_os_info_time={},_os_hw_cache={},_os_hw_time={},_os_access_cache={},
            _bmc_fw_cache={'node':(now,['old'])},_bmc_pwr_cache={'node':(now,'old')},
            _BMC_TTL=600,_bmc_pending=set(),ipmi_fw_list=Mock(return_value=['new']),
            ipmi_power=Mock(return_value=(True,'on')))
        extract('main.py',['machine_detail'],self.s)
        self.s['machine_detail']('node',0)
        self.s['ipmi_fw_list'].assert_not_called()
        self.s['machine_detail']('node',1)
        self.assertEqual(self.s['ipmi_fw_list'].call_count,1)
        self.assertEqual(self.s['_bmc_fw_cache']['node'][1],['new'])
        def switch_during_collection(m):
            self.m['active_os']=1
            return ['wrong-slot']
        self.s['ipmi_fw_list'].side_effect=switch_during_collection
        self.s['machine_detail']('node',1)
        self.assertEqual(self.s['_bmc_fw_cache']['node'][1],['new'])

    def test_unobserved_status_is_unknown_with_no_timestamp(self):
        self.s.update(_kick_status_scan=lambda **kw:None,_status_cache={},_status_observed={},
                      _POWER={},_health_cache={},_STATUS_TIME=0)
        extract('main.py',['list_machines'],self.s)
        m=self.s['list_machines']()['machines'][0]
        self.assertIsNone(m['os_alive'])
        self.assertIsNone(m['connectivity']['os']['observed_at'])
        self.assertNotIn('secret',json.dumps(m))

    def test_cdu_detail_does_not_run_server_inventory_commands(self):
        self.m['mgx_type']='cdu'
        self.m['rack_mount']='external'
        self.s['_bmc_safe']=lambda m: {'name':m['name']}
        extract('main.py',['machine_detail'],self.s)
        result=self.s['machine_detail']('node',1)
        self.assertEqual(result['cdu']['collector'],'not_implemented')
        self.assertEqual(result['cdu']['installation'],'external')
        self.s['ssh_run'].assert_not_called()


if __name__ == '__main__':
    unittest.main(verbosity=2)
