"""Rack and topology routes retain canonical sparse node targets."""
import unittest
from unittest.mock import patch
from types import SimpleNamespace
import test_integration as base
from integration import web
from scripts.native_demo import fixture


class PlatformSlots(unittest.TestCase):
    setUp=base.IntegrationTests.setUp
    tearDown=base.IntegrationTests.tearDown

    def test_planned_replacement_keeps_empty_selection_and_new_asset_identity(self):
        doc=fixture();web.pa.machines=doc['machines'];web.pa.projects=doc['projects'];web.pa._save_data()
        retired=web.pa.machines['chassis-01']['os'][1]['node_id']
        self.assertEqual(self.client.delete('/api/machines/chassis-01/os/2').status_code,200)
        web.pa.machines['chassis-01']['active_os']=None;web.pa._sync_active_os(web.pa.machines['chassis-01']);web.pa._save_data()
        from cycle_transport import Transport
        with patch.object(Transport,'_connect') as connect,patch.object(web.pa.subprocess,'run') as io:
            response=self.client.post('/api/machines/chassis-01/os',json=dict(ip='192.0.2.249',user='planned',
                **{'pass':''},port=2345,bmc_ssh_port=2205,ipmi_port=2623,label='Replacement N2'))
        self.assertEqual(response.status_code,200,response.text);connect.assert_not_called();io.assert_not_called()
        m=web.pa.machines['chassis-01'];n=next(e for e in m['os'] if e['slot']==2)
        self.assertIsNone(m['active_os'])
        self.assertNotEqual(n['node_id'],retired)
        self.assertEqual(n['port'],2345)
        self.assertIn(retired,[e['node_id'] for e in m['retired_nodes']])

    def test_node_edit_rejects_stale_identity_and_versions_credentials(self):
        doc=fixture();web.pa.machines=doc['machines'];web.pa.projects=doc['projects']
        machine=web.pa.machines['chassis-01'];machine['active_os']=None
        web.pa._save_data()
        entry=machine['os'][2]
        binding=web.pa.node_identity.binding(entry)
        url='/api/machines/chassis-01/os/3'
        response=self.client.patch(url,json=dict(expected_node_id='another-node',
            expected_binding_revision=binding,label='wrong'))
        self.assertEqual(response.status_code,409,response.text)
        machine=web.pa.machines['chassis-01'];entry=machine['os'][2]
        response=self.client.patch(url,json=dict(expected_node_id=entry['node_id'],
            expected_binding_revision=binding,**{'pass':'ROTATED-SECRET'}))
        self.assertEqual(response.status_code,200,response.text)
        changed=web.pa.node_identity.binding(web.pa.machines['chassis-01']['os'][2])
        self.assertNotEqual(binding,changed)
        self.assertNotIn('ROTATED-SECRET',response.text)
        response=self.client.patch(url,json=dict(expected_node_id=entry['node_id'],
            expected_binding_revision=binding,label='stale'))
        self.assertEqual(response.status_code,409,response.text)
        self.assertIsNone(web.pa.machines['chassis-01']['active_os'])

    def test_sparse_nodes_through_both_ping_routes(self):
        doc=fixture();web.pa.machines=doc['machines'];web.pa.projects=doc['projects']
        machine=web.pa.machines['chassis-01']
        original={e['slot']:e.copy() for e in machine['os']}
        machine.update(level='rack',rack_u=20)
        topology=dict(revision=0,racks=[dict(id='rack-one',devices=[dict(id='dev-one',
            inventory='chassis-01',kind='server',nodes=[dict(id='legacy-'+str(i),name='N'+str(i),
            host_os='192.0.2.250' if i==2 else '') for i in range(1,5)])])])
        web.pa.projects[machine['project']]['topology']=topology
        web.pa._save_data()
        self.assertEqual(self.client.delete('/api/machines/chassis-01/os/2').status_code,200)
        web.app.state.cycle_provider=SimpleNamespace(authenticate=lambda request:'test-reader',
            authorize=lambda actor,project,action:True)
        self.addCleanup(lambda:delattr(web.app.state,'cycle_provider'))
        with patch.object(web,'MODE','live'), patch.object(web.pa,'ping_check',return_value=True) as ping:
            rack=self.client.get('/api/rack/ping',params={'name':'chassis-01'})
            self.assertEqual(rack.status_code,200,rack.text)
            targets=rack.json()['nodes'][0]['ping_targets']
            self.assertEqual({t['node_id']:t['ip'] for t in targets},
                             {original[i]['node_id']:original[i]['ip'] for i in (1,3,4)})
            self.assertNotIn('192.0.2.250',[call.args[0] for call in ping.call_args_list])
            result=self.client.post('/api/projects/Neutrino%20Demo/topology/ping',json={'rack_id':'rack-one'})
            self.assertEqual(result.status_code,200,result.text)
            self.assertNotIn('192.0.2.250',[call.args[0] for call in ping.call_args_list])
            self.assertIn(original[3]['node_id'],result.text)

