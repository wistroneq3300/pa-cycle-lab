"""Real mutation handlers with synthetic storage; no live networking."""
import copy
import ipaddress
import unittest
from unittest.mock import Mock, patch
from types import SimpleNamespace
import reliability_regression as base
import equipment_policy

class EquipmentRegression(unittest.TestCase):
    setUp = base.Reliability.setUp
    machine = base.Reliability.machine

    def setup_handlers(self):
        self.s.update(ipaddress=ipaddress,equipment_policy=equipment_policy,
            _invalidate_machine_cache=Mock(),
            telemetry_core=SimpleNamespace(kind_of=lambda m,n=None:equipment_policy.classify(m,n)['kind']))
        base.extract('main.py',['_sync_active_os','change_management_ip'],self.s)

    def test_generic_bmc_patch_survives_os_switch(self):
        self.setup_handlers()
        self.machine(mgx_type='server',os=[{'slot':1,'ip':'192.0.2.1','bmc_ip':'192.0.2.2','bmc_pass':'first'},
                    {'slot':2,'ip':'192.0.2.3','bmc_ip':'192.0.2.4','bmc_pass':'second'}],active_os=2)
        self.s['_sync_active_os'](self.s['machines']['node'])
        m=self.s['node_identity'].canonical(self.s['machines']['node']);self.s['machines']['node']=m
        node=m['os'][1]
        self.s['edit_machine']('node',{'bmc_ip':'192.0.2.40','bmc_user':'changed','bmc_pass':'new-password',
            'expected_node_id':node['node_id'],'expected_binding_revision':self.s['node_identity'].binding(node)})
        m=self.s['machines']['node']
        for active in [1,2]:
            m['active_os']=active;self.s['_sync_active_os'](m)
        self.assertEqual((m['bmc_ip'],m['bmc_user'],m['bmc_pass']),('192.0.2.40','changed','new-password'))
        self.assertEqual(m['os'][0]['bmc_pass'],'first')
        self.s['_invalidate_machine_cache'].assert_called_once_with('node')

    def test_nonserver_demotion_rejected_without_mutation(self):
        self.setup_handlers()
        for kind in ['blanking','switch','cdu','pdu','powershelf','storage','network','nvlink']:
            self.machine(mgx_type=kind,passive=True)
            before=copy.deepcopy(self.s['machines'])
            with self.assertRaises(base.ApiError):self.s['edit_machine']('node',{'level':'system'})
            self.assertEqual(self.s['machines'],before)

    def test_management_ip_offline_keeps_other_target_and_credentials(self):
        self.setup_handlers()
        for kind in ['cdu','switch','pdu','powershelf','storage','network','nvlink']:
            self.machine(mgx_type=kind,os_ip='192.0.2.1',bmc_ip='192.0.2.2',os_user='a',os_pass='secret',bmc_user='b',bmc_pass='other')
            before=copy.deepcopy(self.s['machines']['node'])
            result=self.s['change_management_ip']('node',{'target':'bmc','ip':'2001:db8::10','expected_ip':'192.0.2.2'})
            before['bmc_ip']='2001:db8::10'
            self.assertEqual(self.s['machines']['node'],before)
            self.assertNotIn('secret',str(result));self.assertNotIn('other',str(result))

    def test_invalid_stale_and_failed_save_preserve_inventory(self):
        self.setup_handlers();self.machine(mgx_type='cdu',bmc_ip='192.0.2.2')
        before=copy.deepcopy(self.s['machines'])
        for body in [{'target':'bmc','ip':'not-an-ip','expected_ip':'192.0.2.2'},
                     {'target':'bmc','ip':'192.0.2.3','expected_ip':'192.0.2.1'},
                     {'target':'os_pass','ip':'192.0.2.3','expected_ip':''}]:
            with self.assertRaises(base.ApiError):self.s['change_management_ip']('node',body)
            self.assertEqual(self.s['machines'],before)
        with patch.object(base.os,'replace',side_effect=OSError('disk full')):
            with self.assertRaises(base.ApiError):
                self.s['change_management_ip']('node',{'target':'bmc','ip':'192.0.2.3','expected_ip':'192.0.2.2'})
        self.assertEqual(self.s['machines'],before)

    def test_management_endpoint_rejects_servers_and_blanking(self):
        self.setup_handlers()
        for kind in ['server','blanking']:
            self.machine(mgx_type=kind)
            with self.assertRaises(base.ApiError):self.s['change_management_ip']('node',{'target':'os','ip':'192.0.2.3','expected_ip':''})

    def test_power_rejects_nonservers_before_commands(self):
        self.setup_handlers()
        self.s.update(_POWER={},_operation_target=Mock(),run_control_cmd=Mock(),ipmi_power=Mock())
        base.extract('main.py',['machine_power'],self.s)
        self.machine(mgx_type='cdu',os_ip='192.0.2.2')
        with self.assertRaises(base.ApiError):self.s['machine_power']('node',{'on':True})
        self.s['run_control_cmd'].assert_not_called()

    def test_custom_power_capability_is_action_specific(self):
        m=dict(mgx_type='pdu',power_on_cmd='configured-command')
        self.assertTrue(equipment_policy.can_power(m, True))
        self.assertFalse(equipment_policy.can_power(m, False))

    def test_legacy_classification_and_explicit_type(self):
        for name,kind in [('rack-cdu-01','cdu'),('rack-pdu-01','pdu'),('rack-sw-01','switch'),('NVSWH-NVLINK-1','nvlink')]:
            self.assertEqual(equipment_policy.classify({'name':name}),{'kind':kind,'status':'inferred'})
        self.assertEqual(equipment_policy.classify({'name':'rack-cdu-01','mgx_type':'switch'})['kind'],'switch')
        for name in ['mystery','rack-cdu-switch-01']:
            self.assertEqual(equipment_policy.classify({'name':name})['status'],'needs_confirmation')

if __name__=='__main__':unittest.main()
