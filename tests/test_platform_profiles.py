"""Activated project profiles must be frozen with the real durable run."""
import copy
import threading
import unittest
from unittest.mock import patch
import test_integration as base
import test_native as native
from integration import web, runner
from integration.synthetic import SyntheticTransport
from integration.store import TERMINAL


class PlatformProfiles(unittest.TestCase):
    setUp=base.IntegrationTests.setUp
    tearDown=base.IntegrationTests.tearDown
    setup_nodes=native.NativeTests.setup_nodes
    create_native=native.NativeTests.create_native
    body=base.IntegrationTests.body
    wait=base.IntegrationTests.wait
    confirm=base.IntegrationTests.confirm

    def test_legacy_job_without_profile_snapshot_keeps_pre_confirmation(self):
        from integration.targets import inventory
        from integration.store import validate_request
        self.setup_nodes()
        targets=inventory(web.pa)[:1]
        body=validate_request(self.body(machine_ids=[targets[0]['name']],limits={'loops':1,'hours':0}))
        job=self.store.create('Neutrino Demo',body,targets,'synthetic-test')
        self.assertFalse(job.get('profile_snapshot'))
        thread=threading.Thread(target=runner.run_job,args=(self.store,job['id'],SyntheticTransport))
        self.threads.append(thread);thread.start()
        ready=self.wait(job,{'AWAITING_CONFIRMATION'}|TERMINAL,20)
        self.assertEqual(ready['state'],'AWAITING_CONFIRMATION',ready.get('stop_reason'))
        self.assertEqual(self.store.actions(job['id']),[])
        self.confirm(ready)
        done=self.wait(job,TERMINAL,20);thread.join(5)
        self.assertEqual(done['state'],'COMPLETE',done.get('stop_reason'))

    def test_two_project_packages_are_immutable_and_drive_real_worker(self):
        from integration import profiles
        self.setup_nodes(chassis=2)
        original=web.pa.projects['Neutrino Demo']
        web.pa.projects['Second']=dict(original,name='Second',project_id='second-stable-id')
        web.pa.machines['chassis-02']['project']='Second'
        web.pa._save_data()
        a=profiles.default_package();a['profile_id']='lab-a';a['revision']=2
        a['expectations']['cpu']['value']=3
        a['actions']['aux_cycle:inband']['argv']=['/usr/bin/stbypowerctrl.sh','aux_cycle','--fixture-a']
        b=copy.deepcopy(a);b['profile_id']='lab-b';b['expectations']['cpu']['value']=4
        b['actions']['aux_cycle:inband']['argv'][-1]='--fixture-b'
        profiles.activate(self.store,original['project_id'],a)
        profiles.activate(self.store,'second-stable-id',b)
        made=[]
        for project,profile in [('Neutrino Demo',a),('Second',b)]:
            ids=[n['node_id'] for m in web.pa.machines.values() if m['project']==project for n in m['os']]
            response=self.client.post('/api/projects/'+project+'/cycle/jobs',json=self.body(
                machine_ids=ids,cycle_profile=profile['profile_id'],cycle_mode='aux_cycle',limits={'loops':1,'hours':0}))
            self.assertEqual(response.status_code,200,response.text)
            made.append(response.json())
        self.assertEqual(made[0]['profile_snapshot']['package']['expectations']['cpu']['value'],3)
        self.assertEqual(made[1]['profile_snapshot']['package']['expectations']['cpu']['value'],4)
        changed=copy.deepcopy(a);changed['revision']=3;changed['expectations']['cpu']['value']=99
        profiles.activate(self.store,original['project_id'],changed)
        seen=[]
        class Fake(SyntheticTransport):
            def ssh(inner,target,role,cmd,*args,**kw):
                if cmd.startswith('/usr/bin/stbypowerctrl.sh aux_cycle --fixture-'):
                    seen.append(cmd);return inner.action(target)
                return super().ssh(target,role,cmd,*args,**kw)
        for job in made:
            thread=threading.Thread(target=runner.run_job,args=(self.store,job['id'],Fake))
            self.threads.append(thread);thread.start()
            ready=self.wait(job,{'AWAITING_CONFIRMATION'},30)
            result=self.client.post('/api/projects/'+job['project']+'/cycle/jobs/'+job['id']+'/confirm',json={
                'version':ready['pre']['version'],'machine_ids':ready['pre']['runnable_ids']})
            self.assertEqual(result.status_code,200,result.text)
            done=self.wait(job,TERMINAL,30);thread.join(5)
            self.assertEqual(done['state'],'COMPLETE',done.get('stop_reason'))
            self.assertEqual(len(self.store.actions(job['id'])),4)
        self.assertEqual(sum('--fixture-a' in s for s in seen),4)
        self.assertEqual(sum('--fixture-b' in s for s in seen),4)
        self.assertEqual(self.store.get(made[0]['id'])['profile_snapshot'],made[0]['profile_snapshot'])

    def test_schema_rejects_ambiguous_measurements_and_shell_action(self):
        from integration import profiles
        profile=profiles.default_package()
        profile['expectations']['nic']['unit']='physical_cards'
        with self.assertRaises(ValueError):profiles.validate(profile)
        profile=profiles.default_package();profile['expectations']['cpu']['enabled']=False
        profile['expectations']['cpu']['value']=0
        self.assertEqual(profiles.validate(profile)['expectations']['cpu']['value'],0)
        profile['actions']['reboot:inband']['argv']=['sh','-c','reboot; echo bad']
        with self.assertRaises(ValueError):profiles.validate(profile)
