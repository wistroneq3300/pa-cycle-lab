import unittest
import test_integration as base
from integration import web
from scripts.native_demo import fixture


class PlatformMetadata(unittest.TestCase):
    setUp=base.IntegrationTests.setUp
    tearDown=base.IntegrationTests.tearDown

    def test_malformed_node_scope_is_rejected_without_publishing(self):
        import copy
        doc=fixture();web.pa.machines=doc['machines'];web.pa.projects=doc['projects'];web.pa._save_data()
        node=web.pa.machines['chassis-01']['os'][2]
        before=copy.deepcopy(web.pa.machines)
        for field,value in [('power_domain',[]),('capabilities','all'),('expected_identity',False),
                            ('trust',[]),('aux_scope_confirmed','true'),('ipmi_cipher',True)]:
            with self.subTest(field=field):
                response=self.client.patch('/api/machines/chassis-01',json={field:value,
                    'expected_node_id':node['node_id'],'expected_binding_revision':web.pa.node_identity.binding(node)})
                self.assertEqual(response.status_code,422,response.text)
                self.assertEqual(web.pa.machines,before)

    def test_management_ip_resolves_sparse_slot_without_index_math(self):
        doc=fixture();web.pa.machines=doc['machines'];web.pa.projects=doc['projects']
        m=web.pa.machines['chassis-01'];m.update(mgx_type='cdu',active_os=3)
        m['os']=m['os'][2:3];web.pa._sync_active_os(m);web.pa._save_data()
        node=m['os'][0]
        response=self.client.patch('/api/machines/chassis-01/management-ip',json=dict(target='bmc',
            ip='198.18.20.233',expected_ip=m['bmc_ip'],expected_node_id=node['node_id'],
            expected_binding_revision=web.pa.node_identity.binding(node)))
        self.assertEqual(response.status_code,200,response.text)
        saved=web.pa.machines['chassis-01']
        self.assertEqual(saved['os'][0]['slot'],3)
        self.assertEqual(saved['os'][0]['bmc_ip'],'198.18.20.233')

    def test_chassis_connection_patch_targets_explicit_sparse_node_and_invalidates_cache(self):
        doc=fixture();web.pa.machines=doc['machines'];web.pa.projects=doc['projects']
        machine=web.pa.machines['chassis-01'];machine['os']=machine['os'][2:3];machine['active_os']=3
        web.pa._sync_active_os(machine);web.pa._save_data()
        node=machine['os'][0];old=web.pa.node_identity.binding(node)
        response=self.client.patch('/api/machines/chassis-01',json={'bmc_port':2300})
        self.assertEqual(response.status_code,409,response.text)
        response=self.client.patch('/api/machines/chassis-01',json=dict(bmc_port=2300,
            expected_node_id=node['node_id'],expected_binding_revision=old))
        self.assertEqual(response.status_code,200,response.text)
        saved=web.pa.machines['chassis-01']
        self.assertEqual(saved['bmc_port'],2300)
        self.assertEqual(saved['os'][0]['bmc_ssh_port'],2300)
        self.assertEqual(saved['os'][0]['slot'],3)
        self.assertNotEqual(web.pa.node_identity.binding(saved['os'][0]),old)

    def test_generic_patch_preserves_next_rack_specification_rules(self):
        doc=fixture();web.pa.machines=doc['machines'];web.pa.projects=doc['projects']
        machine=web.pa.machines['chassis-01'];machine['level']='system'
        web.pa._save_data()
        response=self.client.patch('/api/machines/chassis-01',json={'level':'rack','rack_size':4})
        self.assertEqual(response.status_code,422,response.text)
        self.assertEqual(web.pa.machines['chassis-01']['level'],'system')
        web.pa.machines['chassis-01']['level']='rack';web.pa._save_data()
        response=self.client.patch('/api/machines/chassis-01',json={'rack_size':4})
        self.assertEqual(response.status_code,400,response.text)
        self.assertEqual(web.pa.machines['chassis-01']['rack_size'],1)

    def test_scope_edit_changes_exact_node_and_rejects_identity_rewrite(self):
        doc=fixture();web.pa.machines=doc['machines'];web.pa.projects=doc['projects'];web.pa._save_data()
        m=web.pa.machines['chassis-01'];node=m['os'][2]
        body=dict(power_domain='verified-domain-three',expected_node_id=node['node_id'],
                  expected_binding_revision=web.pa.node_identity.binding(node))
        response=self.client.patch('/api/machines/chassis-01',json=body)
        self.assertEqual(response.status_code,200,response.text)
        saved=web.pa.machines['chassis-01']
        self.assertEqual(saved['os'][2]['power_domain'],'verified-domain-three')
        self.assertNotEqual(saved['os'][0]['power_domain'],'verified-domain-three')
        response=self.client.patch('/api/machines/chassis-01',json={'node_id':'overwrite-asset'})
        self.assertEqual(response.status_code,422,response.text)
