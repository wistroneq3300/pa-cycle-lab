"""Real control route/guard/Transport, fake SSH connection and subprocess only."""
import unittest
import uuid
from types import SimpleNamespace
from unittest.mock import patch
import test_integration as base
from integration import web
from integration.targets import inventory
from cycle_transport import Transport
from scripts.native_demo import fixture


class PlatformControl(unittest.TestCase):
    setUp=base.IntegrationTests.setUp
    tearDown=base.IntegrationTests.tearDown

    def test_manual_without_cycle_profile_and_idempotent_retry(self):
        doc=fixture();web.pa.machines=doc['machines'];web.pa.projects=doc['projects']
        web.pa.projects['Neutrino Demo'].pop('cycle_profile',None)
        for e in web.pa.machines['chassis-01']['os']:
            e['synthetic']=False;e.pop('cycle_profile',None)
        web.pa.machines['chassis-01']['synthetic']=False
        web.pa._save_data()
        target=inventory(web.pa)[2]
        provider=SimpleNamespace(authenticate=lambda request:'operator-a',
            authorize=lambda actor,project,action:project in (None,'Neutrino Demo'),
            credentials=lambda *args:dict(os_password='os-sentinel',bmc_password='bmc-sentinel'),
            verify_identity=lambda *args:True)
        web.app.state.cycle_provider=provider
        self.addCleanup(lambda:delattr(web.app.state,'cycle_provider'))
        commands=[];power=['on'];boot=[0]
        def connect(transport,t,role,timeout):
            class Channel:
                output=b''
                def set_combine_stderr(self,*args):pass
                def settimeout(self,*args):pass
                def shutdown_write(self):pass
                def sendall(self,*args):pass
                def exec_command(self,cmd):
                    commands.append((t.os_ip,role,cmd))
                    if "printf 'HOSTNAME='" in cmd:
                        self.output=(f'HOSTNAME={getattr(t,role+"_hostname")}\nBOOT_ID=00000000-0000-0000-0000-{boot[0]:012d}\n').encode()
                    elif 'reboot' in cmd:boot[0]+=1
                def recv_ready(self):return bool(self.output)
                def recv(self,*args):value=self.output;self.output=b'';return value
                def exit_status_ready(self):return True
                def recv_exit_status(self):return 0
            return SimpleNamespace(close=lambda:None,get_transport=lambda:SimpleNamespace(open_session=lambda **kwargs:Channel()))
        def subprocess(argv,**kwargs):
            commands.append(tuple(argv))
            if argv[-1] in ('on','off'):power[0]=argv[-1]
            return SimpleNamespace(returncode=0,stdout='Chassis Power is '+power[0],stderr='')
        with patch.object(web,'MODE','live'),patch('integration.authorization.configured_provider',return_value=provider),\
             patch.object(Transport,'_connect',connect),patch('cycle_transport.subprocess.run',subprocess):
            for action,on in (('power',False),('power',True),('reboot',None)):
                body=dict(node_id=target['node_id'],expected_binding_revision=target['revision'],idempotency_key=uuid.uuid4().hex)
                if action=='power':body['on']=on
                url='/api/machine/chassis-01/'+action
                stale=self.client.post(url,json=dict(body,expected_binding_revision='stale'))
                self.assertEqual(stale.status_code,409,stale.text)
                before=len(commands)
                response=self.client.post(url,json=body)
                self.assertEqual(response.status_code,200,response.text)
                self.assertEqual(response.json()['state'],'CONTROL_COMPLETE',response.text)
                after=len(commands);self.assertGreater(after,before)
                retry=self.client.post(url,json=body)
                self.assertEqual(retry.status_code,200,retry.text)
                self.assertEqual(retry.json()['id'],response.json()['id'])
                self.assertEqual(len(commands),after)
            self.assertTrue(all(row[0]==target['os_ip'] for row in commands if len(row)==3))

