"""Enrollment keeps the live guard; only SSH connection and ICMP IO are fake."""
import unittest
from types import SimpleNamespace
from unittest.mock import patch
import test_integration as base
from integration import web
from cycle_transport import Transport
from scripts.native_demo import fixture
import node_identity


class PlatformEnrollment(unittest.TestCase):
    def setUp(self):
        base.IntegrationTests.setUp(self)
        # Publish the isolated fixture before authenticating the test caller;
        # another test's in-memory inventory is not this request's mutation.
        web.pa._save_data()
    tearDown=base.IntegrationTests.tearDown

    def test_new_ip_for_n3_is_explicit_and_does_not_follow_active_os(self):
        doc=fixture();web.pa.machines=doc['machines'];web.pa.projects=doc['projects'];web.pa._save_data()
        node=web.pa.machines['chassis-01']['os'][2];original_id=node['node_id']
        seen=[]
        def connect(transport,target,role,timeout):
            seen.append((target.os_ip,transport.users['os'],transport.ports['os'],transport.credentials['os']))
            class Channel:
                output=b'os-3\n'
                def set_combine_stderr(self,*a):pass
                def settimeout(self,*a):pass
                def shutdown_write(self):pass
                def exec_command(self,cmd):self.output=b'bmc-3\n' if target.os_ip.startswith('198.18.') else b'os-3\n'
                def recv_ready(self):return bool(self.output)
                def recv(self,*a):out=self.output;self.output=b'';return out
                def exit_status_ready(self):return True
                def recv_exit_status(self):return 0
            return SimpleNamespace(close=lambda:None,get_transport=lambda:SimpleNamespace(open_session=lambda **kw:Channel()))
        web.app.state.cycle_provider=SimpleNamespace(authenticate=lambda r:'enroller',authorize=lambda *a:True,
            approve_enrollment=lambda *a:True)
        self.addCleanup(lambda:delattr(web.app.state,'cycle_provider'))
        body=dict(new_os_ip='192.0.2.250',os_user='new-node-3',os_pass='EXPLICIT-N3',os_port=2345,
                  expected_node_id=node['node_id'],expected_binding_revision=node_identity.binding(node))
        with patch.object(web,'MODE','live'),patch.object(Transport,'_connect',connect),\
             patch.object(web.pa.subprocess,'run',return_value=SimpleNamespace(returncode=0,stdout='',stderr='')):
            response=self.client.post('/api/machines/chassis-01/change-os-ip',json=body)
            self.assertEqual(response.status_code,200,response.text)
            self.assertTrue(response.json()['changed'],response.text)
            self.assertEqual(seen,[('192.0.2.250','new-node-3',2345,'EXPLICIT-N3')])
            saved=web.pa.machines['chassis-01'];current=next(n for n in saved['os'] if n['node_id']==original_id)
            self.assertEqual(current['ip'],'192.0.2.250');self.assertEqual(current['port'],2345)
            self.assertEqual(saved['active_os'],1);self.assertEqual(saved['os_ip'],saved['os'][0]['ip'])
            self.assertNotEqual(node_identity.binding(current),body['expected_binding_revision'])
            seen.clear()
            response=self.client.post('/api/machines/chassis-01/change-os-ip',json=body)
            self.assertEqual(response.status_code,409,response.text);self.assertEqual(seen,[])
            bmc=dict(new_bmc_ip='198.18.20.250',bmc_user='provided-bmc-3',bmc_pass='EXPLICIT-BMC3',bmc_ssh_port=2303,
                     expected_node_id=original_id,expected_binding_revision=node_identity.binding(current))
            response=self.client.post('/api/machines/chassis-01/change-bmc-ip',json=bmc)
            self.assertEqual(response.status_code,200,response.text)
            self.assertEqual(current['bmc_ip'],'198.18.20.250');self.assertEqual(current['bmc_ssh_port'],2303)
            self.assertEqual(current['ipmi_port'],623)
            self.assertNotIn('EXPLICIT-BMC3',response.text)
            self.assertEqual(saved['bmc_ip'],saved['os'][0]['bmc_ip'])

    def test_new_chassis_four_slots_uses_only_supplied_credentials(self):
        seen=[]
        def connect(transport,target,role,timeout):
            seen.append((target.os_ip,transport.users['os'],transport.ports['os'],transport.credentials['os']))
            class Channel:
                output=b''
                def set_combine_stderr(self,*a):pass
                def settimeout(self,*a):pass
                def shutdown_write(self):pass
                def exec_command(self,cmd):
                    self.output=(('IP Address : '+target.os_ip) if 'lan print' in cmd else
                                 ('distinct-'+target.os_ip if 'hostname' in cmd else 'ok')).encode()
                def recv_ready(self):return bool(self.output)
                def recv(self,*a):out=self.output;self.output=b'';return out
                def exit_status_ready(self):return True
                def recv_exit_status(self):return 0
            return SimpleNamespace(close=lambda:None,get_transport=lambda:SimpleNamespace(open_session=lambda **kw:Channel()))
        provider=SimpleNamespace(authenticate=lambda request:'enroller',
            authorize=lambda actor,project,action:project in (None,'Neutrino Demo'),
            approve_enrollment=lambda actor,plan:plan['project']=='Neutrino Demo',
            credentials=lambda *args:(_ for _ in ()).throw(AssertionError('Enrollment borrowed inventory credentials')))
        web.app.state.cycle_provider=provider
        self.addCleanup(lambda:delattr(web.app.state,'cycle_provider'))
        body=dict(project='Neutrino Demo',os_ip='192.0.2.201',os_user='primary',os_pass='NEW-ONLY-1',os_port=2222,
            bmc_ip='198.18.20.1',bmc_user='new-bmc',bmc_pass='NEW-BMC-ONLY',bmc_port=2201,
            os=[dict(ip='192.0.2.'+str(i),user='u'+str(i),**{'pass':'NEW-ONLY-'+str(i)},port=2200+i) for i in (202,203,204)])
        with patch.object(web,'MODE','live'),patch.object(Transport,'_connect',connect),patch.object(web.pa,'ping_check',return_value=True):
            response=self.client.post('/api/machines',json=body)
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual({row[0] for row in seen},{'192.0.2.201','192.0.2.202','192.0.2.203','192.0.2.204','198.18.20.1'})
        self.assertIn(('192.0.2.203','u203',2403,'NEW-ONLY-203'),seen)
        saved=web.pa.machines['distinct-192.0.2.201']
        self.assertEqual(len(saved['os']),4);self.assertEqual(saved['bmc_ip'],'198.18.20.1')
        self.assertNotIn('NEW-ONLY',response.text);self.assertNotIn('NEW-BMC-ONLY',response.text)


        url='/api/machines/distinct-192.0.2.201/os/3'
        response=self.client.patch(url,json={'bmc_ssh_port':2303,'ipmi_port':2623})
        self.assertEqual(response.status_code,200,response.text)
        response=self.client.patch(url,json={'label':'changed only'})
        self.assertEqual(response.status_code,200,response.text)
        response=self.client.post('/api/machines/distinct-192.0.2.201/select-os',json={'slot':3})
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual((saved['os'][2]['port'],saved['bmc_port'],saved['os'][2]['ipmi_port']),(2403,2303,2623))

    def test_unapproved_enrollment_does_not_connect(self):
        web.app.state.cycle_provider=SimpleNamespace(authenticate=lambda request:'viewer',
            authorize=lambda *args:True,approve_enrollment=lambda *args:False)
        self.addCleanup(lambda:delattr(web.app.state,'cycle_provider'))
        with patch.object(web,'MODE','live'),patch.object(Transport,'_connect') as connect:
            response=self.client.post('/api/machines/probe-bmc',json=dict(project='Neutrino Demo',
                os_ip='192.0.2.240',os_user='provided',os_pass='PROVIDED-ONLY',os_port=2222))
        self.assertEqual(response.status_code,403,response.text);connect.assert_not_called()
