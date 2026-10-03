"""Real source -> transport spy -> shared checker -> DB, without any Cycle runs."""
import copy
import json
import os
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from integration import settings
from integration.inspection import InspectionStore,InspectionEvaluator,DEFAULTS
from integration.inspection_collection import IndependentSource
from integration.inspection_fixture import FixtureTransport
from integration.inspection_service import InspectionService
from integration import profiles
from validation_collectors import core_version,Collector
from validation_events import kernel_events,log_events,sel_records


class Independent(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(); self.root=Path(self.tmp.name); self.now=10000.
        self.store=InspectionStore(self.root/'inspection.db'); self.calls=[]; self.scenario={}
        self.targets=[dict(node_id='n'+str(i),node='n'+str(i),os_hostname='n'+str(i),os_ip='192.0.2.'+str(i),
                      os_port=2200+i,bmc_ip='198.51.100.'+str(i),revision='r1',project_id='p',tray='t') for i in range(1,5)]
        self.system=dict(id='chassis',name='box',project='Neutrino',nodes=[dict(node_id=t['node_id'],label=t['node']) for t in self.targets])
        self.frozen=profiles.freeze(profiles.default_package(),'test','Neutrino')
        self.source=IndependentSource(self.store,lambda s:self.targets,lambda s:self.frozen,
            lambda t:FixtureTransport(t,self.scenario,self.calls),self.root/'evidence',clock=lambda:self.now)
        self.config=copy.deepcopy(DEFAULTS); self.config['_full']=True
    def tearDown(self): self.tmp.cleanup()
    def collect(self):
        rows,coverage,_=self.source(self.system,self.config,self.now)
        result=InspectionEvaluator(self.store,lambda:self.now).evaluate('chassis',rows,coverage,batch=self.config['_batch'])
        self.now+=1
        return result
    def event(self,cursor='c1',at=1):
        return dict(__CURSOR=cursor,__REALTIME_TIMESTAMP=str(at*1000000),_BOOT_ID='boot-a',MESSAGE='NVRM: Xid (PCI:0000:01:00): 79, GPU has fallen off the bus.')
    def test_no_cycle_required_and_all_sources_have_new_evidence(self):
        result=self.collect()
        self.assertIsNotNone(result['last_completed_at'])
        sources={c['source'] for c in result['coverage']}
        self.assertTrue({'Hardware','PCIe','Kernel','Sensor','SEL','Redfish','Power','Firmware system'}<=sources)
        self.assertFalse((self.root/'jobs.sqlite3').exists())
        self.assertEqual(sum(cmd=='lspci -Dvv -nn' for _,_,cmd in self.calls),4)
        for snap in self.config['_batch']['snapshots']:
            self.assertTrue((self.root/'evidence'/snap['raw_evidence']).is_file())
        hw=[s for s in self.config['_batch']['snapshots'] if s['collector_name']=='Hardware']
        self.assertTrue(all(s['collection_status']=='SUCCESS' for s in hw),[(s['collection_status'],s['findings']) for s in hw])
    def test_old_event_and_real_recurrence_are_not_freshness_filtered(self):
        self.scenario['journal']=[self.event()]
        self.collect(); self.collect()
        items=self.store.issues('chassis'); kernel=[i for i in items if i['source']=='Kernel']
        self.assertEqual(len(kernel),4); self.assertTrue(all(i['occurrences']==1 for i in kernel))
        self.scenario['journal'].append(self.event('c2',2))
        self.collect(); kernel=[i for i in self.store.issues('chassis') if i['source']=='Kernel']
        self.assertEqual(len(kernel),4); self.assertTrue(all(i['occurrences']==2 for i in kernel))
    def test_sensor_warning_recovery_and_failed_collection_do_not_clear(self):
        self.scenario['raw']={'sensor':'CPU Temp | 80 | degrees C | unc\n'}
        self.collect(); items=self.store.issues('chassis')
        self.assertEqual(len(items),4); self.assertTrue(all(i['severity']=='WARNING' for i in items))
        self.scenario['failed']=['sensor']; self.collect()
        self.assertTrue(all(i['status']=='ACTIVE' for i in self.store.issues('chassis')))
        self.scenario.clear(); self.collect(); self.collect()
        self.assertTrue(all(i['status']=='RECOVERED' for i in self.store.issues('chassis')))

    def test_unreadable_sensor_does_not_clear_and_invalid_power_is_unknown(self):
        self.targets=self.targets[:1]
        self.scenario['raw']={'sensor':'CPU Temp | 99 | degrees C | cr\n'};self.collect()
        self.scenario['raw']={'sensor':'CPU Temp | na | degrees C | ok\n','power':'session pending'}
        self.collect();result=self.collect()
        self.assertEqual(self.store.issues('chassis')[0]['status'],'ACTIVE')
        power=next(c for c in result['coverage'] if c['source']=='Power')
        self.assertNotEqual(power['state'],'FRESH')
        snap=self.store.snapshot_record('chassis',power['evidence_ref']['snapshot_id']);self.assertIsNone(snap['data']['power_on'])

    def test_invalid_boot_id_is_not_fresh_verified_identity(self):
        self.targets=self.targets[:1];self.scenario['boot_id']='-'*36
        result=self.collect();identity=next(c for c in result['coverage'] if c['source']=='Identity')
        self.assertEqual(identity['state'],'MISSING_DATA')
        self.assertFalse(any(c['source']=='Hardware' and c['state']=='FRESH' for c in result['coverage']))
    def test_boot_change_wait_then_one_deep_and_cadence(self):
        self.collect(); self.config['_full']=False; self.calls.clear()
        self.scenario['boot_id']='00000000-0000-0000-0000-000000000002'
        result=self.collect(); self.assertTrue(any(c['state']=='WAITING_READY' for c in result['coverage']))
        self.assertEqual(sum(cmd=='lspci -Dvv -nn' for _,_,cmd in self.calls),0)
        self.collect(); self.collect()
        self.assertEqual(sum(cmd=='lspci -Dvv -nn' for _,_,cmd in self.calls),4)

    def test_sensor_due_between_fast_ticks_does_not_repeat_kernel(self):
        self.targets=self.targets[:1];self.collect();self.config['_full']=False
        for at in (10120,10240): self.now=at;self.collect()
        self.assertEqual(self.store.system('chassis')['next_due'],10300)
        self.calls.clear();self.now=10300;self.collect()
        self.assertEqual(sum(c=='sensor list' for _,_,c in self.calls),1)
        self.assertFalse(any(c.startswith('bash -o pipefail') for _,_,c in self.calls))
        self.assertEqual(sum(c=='lspci -Dvv -nn' for _,_,c in self.calls),0)
    def test_missing_checker_does_not_stop_kernel_or_sensor(self):
        self.frozen=None; self.scenario['journal']=[self.event()]
        result=self.collect()
        self.assertEqual(len([i for i in self.store.issues('chassis') if i['source']=='Kernel']),4)
        self.assertTrue(any(c['source']=='Hardware' and c['state']=='NOT_READY' for c in result['coverage']))
    def test_shared_controller_one_acquisition_and_one_issue(self):
        for t in self.targets: t['controller_id']='controller-1'
        self.scenario['raw']={'sensor':'CPU Temp | 99 | degrees C | cr\n'}
        self.collect()
        self.assertEqual(sum(cmd=='sensor list' for _,_,cmd in self.calls),1)
        self.assertEqual(len(self.store.issues('chassis')),1)
    def test_persistence_failure_keeps_cursor_retryable(self):
        self.scenario['journal']=[self.event()]
        with patch('integration.inspection_collection.atomic_write',side_effect=OSError('full')):
            with self.assertRaises(OSError): self.collect()
        self.assertEqual(self.store.node_state('chassis'),{})
        self.collect(); self.assertEqual(len(self.store.issues('chassis')),4)
    def test_retained_state_and_handling_survive_store_reopen(self):
        self.scenario['journal']=[self.event()]; self.collect()
        item=self.store.issues('chassis')[0]; self.store.handle('chassis',item['id'],{'known_issue':True},'test')
        self.store=InspectionStore(self.root/'inspection.db'); self.source.store=self.store
        self.collect()
        self.assertTrue(next(i for i in self.store.issues('chassis') if i['id']==item['id'])['known_issue'])
    def test_new_check_version_does_not_rewrite_old_snapshot(self):
        self.collect(); before=copy.deepcopy(self.config['_batch']['snapshots'][0])
        self.frozen=dict(self.frozen,checker=self.frozen['checker'].replace('DIMM_EXPECTED=16','DIMM_EXPECTED=20'))
        self.collect()
        self.assertEqual(self.store.snapshot_record('chassis',before['snapshot_id']),before)
        self.assertTrue(any(i['rule']=='DIMM_COUNT' for i in self.store.issues('chassis')))

    def test_source_specific_freshness_and_no_implicit_baseline_pass(self):
        result=self.collect()
        pci=next(c for c in result['coverage'] if c['source']=='PCIe')
        self.assertGreaterEqual(pci['freshness_seconds'],self.config['deep_seconds'])
        snap=self.store.snapshot_record('chassis',pci['evidence_ref']['snapshot_id'])
        self.assertEqual(snap['baseline_reference'],'previous_valid_observation')
        self.assertFalse(snap.get('validated_baseline'))

    def test_no_secret_in_snapshot_raw_state_or_issue(self):
        sentinel='FAKE-CREDENTIAL-SECRET-ONLY'
        self.source.secrets=lambda:[sentinel]
        self.scenario['journal']=[dict(self.event(),MESSAGE=self.event()['MESSAGE']+' '+sentinel)]
        self.scenario['raw']={'sensor':sentinel+' | 99 | degrees C | cr\n'}
        self.collect()
        with self.store.tx(False) as db:
            for table in ('inspection_items','inspection_nodes','inspection_snapshots'):
                self.assertNotIn(sentinel,str(db.execute('SELECT data FROM '+table).fetchall()))
        for path in (self.root/'evidence').rglob('*.txt'): self.assertNotIn(sentinel,path.read_text())

    def test_collection_failure_not_zero_hardware_or_all_sources_lost(self):
        self.scenario['raw']={'pci':''};self.scenario['failed']=['DIMM']
        result=self.collect()
        self.assertTrue(any(c['source']=='Sensor' and c['state']=='FRESH' for c in result['coverage']))
        self.assertFalse(any(i['rule'] in {'DIMM_COUNT','BF4_MISSING'} for i in self.store.issues('chassis')))

    def test_read_plan_rejects_unregistered_subcommands(self):
        from cycle_core import Target
        fake=FixtureTransport(self.targets[0]);collector=Collector(fake,Target('t','n1','b','o'))
        for command in ('power off','nvme format','ip link set','dmesg -c','sel clear'):
            with self.assertRaises(KeyError): collector.read(command)
        self.assertEqual(fake.calls,[])

    def test_mid_collection_reboot_discards_os_verdict_and_cursor(self):
        source=self.source.transport
        def factory(target):
            fake=source(target); original=fake.ssh; calls=[0]
            def ssh(t,r,c,*a):
                if 'BOOT_ID=' in c:
                    calls[0]+=1
                    if calls[0]>1: fake.scenario=dict(fake.scenario,boot_id='00000000-0000-0000-0000-000000000002')
                return original(t,r,c,*a)
            fake.ssh=ssh;return fake
        self.source.transport=factory;self.scenario['journal']=[self.event()]
        result=self.collect()
        self.assertFalse(any(i['source']=='Kernel' for i in self.store.issues('chassis')))
        self.assertTrue(any(c['state']=='INTERRUPTED' for c in result['coverage']))

    def test_retention_keeps_issue_evidence(self):
        self.scenario['journal']=[self.event()];self.collect()
        issue=self.store.issues('chassis')[0];ref=issue['evidence_ref']['snapshot_id']
        self.store.configure('chassis',{'retention_days':1},'test',now=self.now)
        self.store.prune('chassis',self.root/'evidence',self.now+86400*2)
        self.assertIsNotNone(self.store.snapshot_record('chassis',ref))


class Events(unittest.TestCase):
    def test_sel_same_count_new_id_and_reused_id_keep_event(self):
        first=sel_records('1 | 01/01/2026 | 00:00:00 | Memory | Uncorrectable ECC | Asserted')
        events,old,_=log_events(first,'sel','controller')
        self.assertEqual(events[0]['severity'],'FAIL')
        second=sel_records('1 | 01/01/2026 | 00:01:00 | Memory | Uncorrectable ECC | Asserted')
        events,new,gap=log_events(second,'sel','controller',old)
        self.assertEqual(len(events),1); self.assertTrue(gap)
        self.assertEqual(log_events(second,'sel','controller',new)[0],[])
    def test_dmesg_same_text_new_timestamp_not_lost(self):
        batch=dict(source='dmesg',raw='[1.0] NVRM: Xid (PCI:0000:01:00): 79, fallen off the bus',gap=True)
        first,state,_=kernel_events(batch,'boot1')
        self.assertEqual(len(first),1)
        self.assertEqual(kernel_events(batch,'boot1',state)[0],[])
        batch['raw']+='\n[2.0] NVRM: Xid (PCI:0000:01:00): 79, fallen off the bus'
        self.assertEqual(len(kernel_events(batch,'boot1',state)[0]),1)
    def test_redfish_native_warning_and_unknown_oem(self):
        events,_,_=log_events([{'Id':'1','Severity':'Warning','Message':'Fan degraded'}],'redfish','c')
        self.assertEqual(events[0]['severity'],'WARN')
        self.assertEqual(sel_records('1 | 01/01/2026 | 00:00:00 | OEM | vendor 42')[0]['severity'],'UNKNOWN')

if __name__=='__main__': unittest.main()
