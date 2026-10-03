"""Independent observations; no Cycle job, NodeSession, action, or reservation writes."""
import copy
import hashlib
import json
import re
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from . import settings
from .events import redact, environment_secrets
from cycle_core import Target, atomic_write, EvidencePersistenceError
from validation_collectors import Collector, core_version, HARDWARE_INPUTS
from validation_checker import run_checker
from validation_identity import collect_identity
from validation_rules import (parse_sensors, sensor_issues, missing_sensors, compare_sensors,
                              parse_pci, parse_pci_verbose, merge_pci_devices, pci_issues,
                              config_issues, parse_hardware_checks)
from validation_events import identity, kernel_events, sel_records, log_events


def sha(text): return hashlib.sha256(text.encode()).hexdigest()


class IndependentSource:
    def __init__(self,store,targets,profile,transport,evidence,telemetry=None,clock=time.time,checker=run_checker,secrets=lambda:(),identity_sync=None):
        self.store=store; self.targets=targets; self.profile=profile; self.transport=transport
        self.evidence=Path(evidence); self.telemetry=telemetry; self.clock=clock; self.checker=checker; self.secrets=secrets
        self.identity_sync=identity_sync

    def __call__(self,system,config,now):
        # Resolve all bindings and freeze one checker/policy before any remote IO.
        targets=self.targets(system); frozen=self.profile(system)
        previous=self.store.node_state(system['id']); version=core_version()
        controller_cache={}; controller_lock=threading.Lock()
        def collect(target):
            old=previous.get(target['node_id'],{})
            try: return self.node(system,target,config,frozen,old,version,controller_cache,controller_lock)
            except (EvidencePersistenceError,OSError): raise
            except Exception as exc:
                return dict(node_id=target['node_id'],state=old,observations=[],snapshots=[],coverage=[dict(node_id=target['node_id'],source='Observation',state='FAILED',detail='來源未完成：'+type(exc).__name__)])
        # A stable controller owner also owns its incremental cursor. Never let
        # thread timing move a shared SEL/journal history to a different node.
        groups={}
        for target in sorted(targets,key=lambda t:t['node_id']):
            groups.setdefault(target.get('controller_id') or target['node_id'],[]).append(target)
        def collect_group(group): return [collect(t) for t in group]
        with ThreadPoolExecutor(max_workers=4,thread_name_prefix='inspection-node') as pool:
            results=[r for group in pool.map(collect_group,groups.values()) for r in group]
        observations=[]; coverage=[]; snapshots=[]; states={}
        for result in results:
            observations+=result['observations']; coverage+=result['coverage']; snapshots+=result['snapshots']; states[result['node_id']]=result['state']
        # Shared-controller findings use controller identity, not one issue per OS.
        unique={}
        for obs in observations:
            token=identity(obs['node_id'],obs['rule'],obs['component'],obs.get('event_id'),obs.get('sample_at'))
            unique[token]=obs
        observations=list(unique.values())
        for obs in observations:
            obs['affected_nodes']=[t['node_id'] for t in targets if t.get('controller_id')==obs['node_id']]
        if self.telemetry:
            rows,local_coverage,_=self.telemetry(system,dict(config,_skip_reports=True),self.clock())
            observations+=rows; coverage+=[c for c in local_coverage if c.get('source')=='Telemetry']
        context=self.telemetry.context(system,self.clock()) if self.telemetry and hasattr(self.telemetry,'context') else []
        for item in context:
            coverage.append(dict(node_id=item['node_id'],source='Cycle context',state='EXPECTED_OFFLINE',
                                 detail='Cycle 正在等待此節點恢復；不影響其他硬體來源判定',deadline=item['deadline'],run_id=item['run_id']))
        batch=dict(snapshots=snapshots,states=states,summary=dict(shared_core_version=version,
                   checker_hash=sha(frozen['checker']) if frozen else None,
                   last_fast_at=max((s.get('fast_at') or 0 for s in states.values()),default=0),last_deep_at=max((s.get('deep_at') or 0 for s in states.values()),default=0)))
        deadlines=[]
        for t in targets:
            st=states[t['node_id']]
            deadlines.extend([(st.get('fast_at') or now)+config['interval_seconds'],(st.get('deep_attempt') or now)+config['deep_seconds'],(st.get('firmware_at') or now)+config['firmware_seconds']])
            if t.get('bmc_ip') and not st.get('shared_follower'): deadlines.append((st.get('sensor_at') or now)+config['sensor_seconds'])
            if st.get('deep_pending'): deadlines.append(now+30)
        batch['summary']['source_next_due']=max(self.clock()+1,min(deadlines,default=now+config['interval_seconds']))
        config['_batch']=batch
        return observations,coverage,context

    def node(self,system,target,config,frozen,old,version,controller_cache,controller_lock):
        nid=target['node_id']; state=copy.deepcopy(old); observations=[]; coverage=[]; snapshots=[]
        started=self.clock(); batch_id=uuid.uuid4().hex; raw_refs={}
        checker_hash=sha(frozen['checker']) if frozen else None
        policy_hash=sha(frozen.get('policy','')) if frozen else None
        target_binding=target.get('revision')
        # JSON stores tuples as arrays; compare the serialized shape explicitly.
        binding=[version,checker_hash,policy_hash,target_binding]
        changed=state.get('version')!=binding
        if changed: state.pop('previous_pci',None); state.pop('previous_sensors',None)
        state['version']=binding
        node=Target(tray=target.get('tray',''),node=target.get('node',nid),os_ip=target.get('os_ip',''),bmc_ip=target.get('bmc_ip',''))
        def progress(name,status,at): self.store.progress(system['id'],nid,dict(source=name,state=status,updated_at=at))
        try: collector=Collector(self.transport(target),node,self.clock,progress)
        except Exception as exc:
            return dict(node_id=nid,state=state,snapshots=[],observations=[],coverage=[dict(node_id=nid,source='Identity',state='FAILED',detail=type(exc).__name__)])
        secrets=(*environment_secrets(),*self.secrets())

        def save(name,item,data=None,findings=(),cadence=None,scope=None):
            at=self.clock(); sid=uuid.uuid4().hex
            if len(item.get('raw','').encode('utf-8'))>2097152:
                item=dict(item,truncated=True,collection_status='TRUNCATED',reason='Raw evidence exceeded the per-source byte limit')
            text=redact(item.get('raw',''),secrets,2097152,preserve_lines=True)
            digest=sha(text)
            rel=raw_refs.get(digest)
            if rel is None:
                rel=Path(sid[:2])/(sid+'.txt')
                atomic_write(self.evidence/rel,text,durable=True)
                raw_refs[digest]=rel
            snap=dict(schema_version=1,snapshot_id=sid,project_id=target.get('project_id') or system['project'],
                      chassis_id=system['id'],node_id=nid,scope=scope or nid,endpoint_binding_revision=target_binding,
                      boot_id=state.get('boot_id'),collector_name=name,collector_version=1,shared_core_version=version,
                      checker_hash=checker_hash,policy_hash=policy_hash,requested_at=item.get('requested_at',started),
                      collected_at=item.get('collected_at',at),completed_at=at,duration=item.get('duration',max(0,at-started)),
                      collection_status=item.get('collection_status','SUCCESS'),truncated=item.get('truncated',False),
                      source_time=item.get('source_time'),time_quality=item.get('time_quality','received'),
                      data=data,findings=list(findings),raw_evidence=rel.as_posix(),size=len(text.encode()),sha256=sha(text),
                      reason=item.get('reason',''),baseline_reference='previous_valid_observation' if name in {'Sensor','PCIe'} else None,
                      baseline_available=bool(old.get('previous_sensors' if name=='Sensor' else 'previous_pci')) if name in {'Sensor','PCIe'} else False,
                      validated_baseline=None,batch_id=batch_id)
            snap['display_context']={k:state.get('identity',{}).get(k) for k in ('os_hostname','bmc_hostname')}
            def scrub(value):
                if isinstance(value,str): return redact(value,secrets,2097152,preserve_lines=True)
                if isinstance(value,dict): return {k:scrub(v) for k,v in value.items()}
                if isinstance(value,list): return [scrub(v) for v in value]
                return value
            snap['data']=scrub(snap['data']); snap['findings']=scrub(snap['findings'])
            for finding in snap['findings']:
                finding.update(rule_id=finding.get('code'),rule_version=version,
                               component_id=finding.get('component'),verdict_determinable=finding.get('severity') in {'PASS','WARN','FAIL'},
                               evidence_ref={'snapshot_id':sid})
            snapshots.append(snap)
            cadence=cadence or config['interval_seconds']
            snap['freshness_seconds']=cadence*2+60
            entry=dict(node_id=nid,source=name,state='FRESH' if snap['collection_status']=='SUCCESS' else snap['collection_status'],
                       collected_at=snap['collected_at'],duration=snap['duration'],freshness_seconds=cadence*2+60,
                       last_attempt=at,last_success=at if snap['collection_status']=='SUCCESS' else state.get('sources',{}).get(name,{}).get('last_success'),
                       detail=snap['reason'],evidence_ref={'snapshot_id':sid},checker_hash=checker_hash,scope=snap['scope'])
            state.setdefault('sources',{})[name]=entry; coverage.append(entry)
            return snap

        def fact(f,snap,event=False,scope=None):
            return dict(node_id=scope or nid,component=redact(f.get('component','hardware'),secrets,512),rule=f['code'],kind='finding' if event else 'state',
                        verified_rule=True,severity=f.get('severity','UNKNOWN'),message=redact(f.get('detail',''),secrets,4000),
                        native_severity=redact(f['native_severity'],secrets,128) if f.get('native_severity') else None,
                        sample_at=snap['collected_at'],source=snap['collector_name'],event_id=f.get('event_id') if event else None,
                        generation=f.get('generation',state.get('boot_id')),fingerprint=f.get('fingerprint'),
                        source_time=redact(f['source_time'],secrets,128) if isinstance(f.get('source_time'),str) else f.get('source_time'),historical=f.get('historical',False),identity_version=version,
                        occurrence_precision=f.get('occurrence_precision','native_event' if event else 'sample'),countable=f.get('countable',True),
                        evidence=snap['raw_evidence'],evidence_ref={'snapshot_id':snap['snapshot_id']},
                        freshness_seconds=snap['freshness_seconds'],recovery_supported=not event)

        observed=collect_identity(collector,target,include_bmc=False)
        controller=target.get('controller_id') or nid
        with controller_lock:
            identity_lock=controller_cache.setdefault(('identity-lock',controller),threading.Lock())
        with identity_lock:
            bmc=controller_cache.get(('identity',controller))
            if bmc is None:
                full=collect_identity(collector,target)
                bmc={k:v for k,v in full.items() if k.startswith('bmc_')}
                controller_cache[('identity',controller)]=bmc
            observed.update(bmc)
        ident=dict(observed['os_evidence']); boot=observed['os_boot_id'];hostname=observed['os_hostname']
        identity_ok=observed['os_status']=='SUCCESS'
        ident['collection_status']=observed['os_status']
        prior_identity=old.get('identity',{})
        moved=any(prior_identity.get(k)!=observed.get(k) for k in ('os_ip','bmc_ip')) if prior_identity else False
        if (moved or prior_identity.get('endpoint_confirmation_pending')) and not observed.get('hardware_uuid') and not observed.get('node_serial'):
            observed['identity_mismatch']=True;observed['endpoint_confirmation_pending']=True
        sync=self.identity_sync(target,observed,state.get('boot_id')) if self.identity_sync else {'status':'UNCHANGED'}
        state['identity']={k:v for k,v in observed.items() if k!='os_evidence'}
        state['identity']['sync']=sync
        if sync['status']=='IDENTITY_REQUIRES_CONFIRMATION':
            identity_ok=False;ident.update(collection_status=sync['status'],reason=sync['reason'])
        if sync.get('binding_revision'):
            target_binding=sync['binding_revision'];state['version']=[version,checker_hash,policy_hash,target_binding]
        boot_changed=identity_ok and bool(state.get('boot_id')) and state['boot_id']!=boot
        if identity_ok:
            if boot_changed:
                state.update(readiness_since=self.clock(),deep_pending=True,kernel={},previous_pci=None,previous_sensors=None)
            state['boot_id']=boot
        save('Identity',ident,dict(hostname=hostname,boot_id=boot,verified=identity_ok,observation=state['identity']))
        save('BMC Hostname',dict(raw=observed.get('bmc_hostname_raw') or '',collection_status=observed['bmc_status']),
             dict(hostname=observed.get('bmc_hostname'),source=observed.get('bmc_source')))
        fast=config.get('_full') or changed or boot_changed or self.clock()-(state.get('fast_at') or 0)>=config['interval_seconds']
        if identity_ok and fast:
            prior=state.get('kernel',{})
            kernel=collector.kernel(prior.get('cursor'))
            if kernel['collection_status']=='SUCCESS':
                events,proposed,gap=kernel_events(kernel,boot,prior)
                if gap: kernel['reason']='Kernel coverage gap: journal unavailable, ring reset/wrap or partial multi-line record'; kernel['collection_status']='PARTIAL'
                snap=save('Kernel',kernel,dict(backlog=kernel.get('backlog'),coverage_gap=gap),events)
                observations.extend(fact(f,snap,True) for f in events)
                state['kernel']=proposed
            else: save('Kernel',kernel)

        # Scope sharing requires an explicit controller ID. Equal IPs alone do
        # not establish a shared hardware resource.
        controller=target.get('controller_id') or nid
        with controller_lock:
            scope_lock=controller_cache.setdefault(('lock',controller),threading.Lock())
        with scope_lock:
            shared=controller_cache.get(controller)
            if shared is None:
                shared={}; controller_cache[controller]=shared
                if target.get('bmc_ip'):
                    for name in (('power','bmc_identity','sel','sel_info') if fast else ('power','bmc_identity')):
                        shared[name]=collector.read(name)
                    if config.get('_full') or changed or self.clock()-state.get('sensor_at',0)>=config['sensor_seconds']:
                        shared['sensor']=collector.read('sensor')
                    if fast:
                        try: shared['redfish']=collector.redfish(target.get('system_uri'),resume=state.get('redfish_pages'))
                        except Exception as exc: shared['redfish']=dict(raw='',collection_status='FAILED',reason=type(exc).__name__)
                shared['owner']=nid
        if shared.get('owner')==nid and target.get('bmc_ip'):
            state.pop('shared_follower',None)
            power=shared['power']; power_match=re.search(r'^Chassis Power is (on|off)\s*$',power['raw'].strip(),re.I|re.M)
            power_on=power['collection_status']=='SUCCESS' and bool(power_match and power_match[1].lower()=='on')
            if power['collection_status']=='SUCCESS' and not power_match:
                power=dict(power,collection_status='INVALID',reason='Unrecognized power-state response')
            save('Power',power,dict(power_on=power_on if power['collection_status']=='SUCCESS' else None),scope=controller)
            save('BMC Identity',shared['bmc_identity'],scope=controller)
            if 'sensor' in shared:
                item=shared['sensor']; findings=[]; rows=[]
                if item['collection_status']=='SUCCESS':
                    rows=parse_sensors(item['raw']); findings=sensor_issues(rows)
                    previous=state.get('previous_sensors')
                    if previous and power_on and missing_sensors(previous,rows):
                        retry=collector.read('sensor',refresh=True)
                        save('Sensor confirmation',retry,scope=controller)
                        if retry['collection_status']=='SUCCESS': findings=compare_sensors(previous,rows,parse_sensors(retry['raw']))
                        else: item=dict(item,collection_status='PARTIAL',reason='Missing sensors could not be confirmed')
                    state['sensor_at']=self.clock()
                unknown={'SENSOR_EMPTY','SENSOR_MALFORMED','SENSOR_UNREADABLE','SENSOR_NAME_MALFORMED','SENSOR_UNRECOGNIZED'}
                if any(f['code'] in unknown for f in findings): item=dict(item,collection_status='PARTIAL',reason='部分感測器資料無法判定；保留原始狀態')
                if item['collection_status']=='SUCCESS': state['previous_sensors']=rows
                snap=save('Sensor',item,rows,findings,config['sensor_seconds'],controller)
                observations.extend(fact(f,snap,scope=controller) for f in findings if f['code'] not in unknown)
                # Recovery is explicit per sensor and rule, never absence of an event.
                for row in rows:
                    if row['status']=='ok' and not sensor_issues([row]):
                        for code in ('SENSOR_CRITICAL','SENSOR_NONCRITICAL','SENSOR_MISSING'):
                            observations.append(fact(dict(code=code,component=row['name'],severity='PASS',detail='Sensor returned a valid normal reading'),snap,scope=controller))
            if 'sel' in shared:
                item=shared['sel']; rows=sel_records(item['raw']) if item['collection_status']=='SUCCESS' else []
                if item['collection_status']=='SUCCESS':
                    info=shared['sel_info']['raw']; marker=next((line for line in info.splitlines() if 'Last Del Time' in line),'')
                    generation=identity(shared['bmc_identity']['raw'],marker)
                    events,proposed,gap=log_events(rows,'sel',generation,state.get('sel'))
                    if state.get('sel_clear') is not None and state.get('sel_clear')!=marker: gap=True
                    if gap: item=dict(item,collection_status='PARTIAL',reason='SEL reset, rollover or clear observed; source continuity is incomplete')
                    snap=save('SEL',item,rows,events,scope=controller)
                    observations.extend(fact(f,snap,True,controller) for f in events)
                    state.update(sel=proposed,sel_clear=marker)
                else: save('SEL',item,scope=controller)
                rf=shared['redfish']; rows=rf.get('entries',[])
                events,proposed,gap=log_events(rows,'redfish',identity(shared['bmc_identity']['raw']),state.get('redfish'))
                snap=save('Redfish',rf,rows,events,scope=controller)
                observations.extend(fact(f,snap,True,controller) for f in events)
                if rows:
                    proposed['identities']=list(set(state.get('redfish',{}).get('identities',[])+proposed['identities']))[-50000:]
                    state['redfish']=proposed
                state['redfish_pages']=rf.get('next_pages',{})
        elif target.get('bmc_ip'):
            state['shared_follower']=True
            coverage.append(dict(node_id=nid,source='BMC sources',state='SHARED',scope=controller,detail='Controller observation shared with '+shared['owner']))
        else:
            for name in ('Sensor','SEL','Redfish','Power'): coverage.append(dict(node_id=nid,source=name,state='NOT_CONFIGURED',detail='此節點未設定 BMC 連線'))

        if fast: state['fast_at']=self.clock()
        deep=config.get('_full') or changed or state.get('deep_pending') or self.clock()-(state.get('deep_at') or 0)>=config['deep_seconds']
        if deep: state['deep_attempt']=self.clock()
        if identity_ok and deep:
            if boot_changed:
                coverage.append(dict(node_id=nid,source='Hardware',state='WAITING_READY',detail='偵測到新開機世代；保留早期事件，下一輪確認工具與裝置就緒'))
            else:
                save('Tool versions',collector.read('tools'),cadence=config['deep_seconds'])
                inputs={name:collector.read(name) for name in ('pci',*HARDWARE_INPUTS)}
                ready=all(i['collection_status']=='SUCCESS' for i in inputs.values())
                waiting=state.get('deep_pending') and not ready and self.clock()-state.get('readiness_since',started)<config['readiness_seconds']
                for name,item in inputs.items(): save('Input '+name,item,cadence=config['deep_seconds'])
                if waiting:
                    coverage.append(dict(node_id=nid,source='Hardware',state='WAITING_READY',detail='等待平台工具／裝置就緒；有期限的後續重試'))
                else:
                    pci=inputs['pci']; parsed=parse_pci(pci['raw']) if pci['collection_status']=='SUCCESS' else {}
                    devices=merge_pci_devices(parsed,parse_pci_verbose(pci['raw'])) if parsed else {}
                    findings=pci_issues(state['previous_pci'],parsed) if state.get('previous_pci') and parsed else []
                    snap=save('PCIe',pci,devices,findings,config['deep_seconds'])
                    observations.extend(fact(f,snap) for f in findings)
                    if parsed: state['previous_pci']=parsed
                    if frozen:
                        result=self.checker(frozen['checker'],inputs)
                        findings=config_issues(result.output,result.code)
                        checks,details=parse_hardware_checks(result.output,findings)
                        acquisition={'COLLECTION_FAILED','CONFIG_FAILED','CONFIG_INCOMPLETE','MST_MODULE','BF4_IDENTITY_UNAVAILABLE','PCIE_LINK_UNAVAILABLE'}
                        status='PARTIAL' if any(f['code'] in acquisition for f in findings) else 'SUCCESS'
                        if result.state=='NOT_READY': status='NOT_READY'
                        snap=save('Hardware',dict(raw=result.output,code=result.code,collection_status=status),details,findings,config['deep_seconds'])
                        observations.extend(fact(f,snap) for f in findings if f['code'] not in acquisition)
                        # Existing active configuration rules recover only from
                        # that component's successful structured CHECK in a new sample.
                        for item in self.store.issues(system['id'],1000):
                            if item['node_id']==nid and item.get('source')=='Hardware' and item['status']=='ACTIVE':
                                component=item['component']
                                if checks.get(component)=='PASS' and not any(f['component']==component for f in findings):
                                    observations.append(fact(dict(code=item['rule'],component=component,severity='PASS',detail='Project checker confirmed the component'),snap))
                    else:
                        coverage.append(dict(node_id=nid,source='Hardware',state='NOT_READY',detail='此專案尚無對應硬體 checker；其他來源照常採集'))
                    state.update(deep_at=self.clock(),deep_pending=False)
        firmware=config.get('_full') or changed or boot_changed or self.clock()-state.get('firmware_at',0)>=config['firmware_seconds']
        if firmware:
            for name in ('firmware','system','drivers','bmc_firmware'):
                if name=='bmc_firmware' and (not target.get('bmc_ip') or shared.get('owner')!=nid): continue
                if name!='bmc_firmware' and not identity_ok: continue
                save('Firmware '+name,collector.read(name),cadence=config['firmware_seconds'])
            state['firmware_at']=self.clock()
        if identity_ok and target.get('capabilities',{}).get('telemetry_gpu')=='nvidia':
            gpu=collector.read('gpu'); snap=save('GPU',gpu)
            if gpu['collection_status']=='SUCCESS':
                import csv
                for row in csv.reader(gpu['raw'].splitlines()):
                    if len(row)<6: continue
                    try: utilization=float(row[3]); memory=100*float(row[4])/float(row[5])
                    except (ValueError,ZeroDivisionError): continue
                    for metric,value in (('gpu',utilization),('vram',memory)):
                        observations.append(dict(node_id=nid,component=row[0].strip(),rule=metric+'.utilization.high',kind='utilization',
                                                 metric=metric,value=value,source='GPU',sample_at=snap['collected_at'],evidence=snap['raw_evidence'],
                                                 evidence_ref={'snapshot_id':snap['snapshot_id']}))
        if identity_ok:
            final=collector.read('identity',refresh=True)
            if final['collection_status']!='SUCCESS' or 'BOOT_ID='+boot not in final['raw']:
                # Do not commit cross-boot OS cursors or hardware conclusions.
                observations=[o for o in observations if o['source'] in {'Sensor','SEL','Redfish'}]
                for snap in snapshots:
                    if snap['collector_name'] not in {'Sensor','SEL','Redfish','Power','BMC Identity'}: snap['collection_status']='INTERRUPTED'
                for entry in coverage:
                    if entry['source'] not in {'Sensor','SEL','Redfish','Power','BMC Identity'}: entry['state']='INTERRUPTED'
                for k in ('kernel','previous_pci','previous_sensors','boot_id','deep_at'): state[k]=old.get(k)
                state['deep_pending']=True
        present={c['source'] for c in coverage}
        coverage.extend(v for k,v in state.get('sources',{}).items() if k not in present)
        state['last_completed']=self.clock()
        def scrub_state(value):
            if isinstance(value,str): return redact(value,secrets,2097152,preserve_lines=True)
            if isinstance(value,dict): return {k:scrub_state(v) for k,v in value.items()}
            if isinstance(value,list): return [scrub_state(v) for v in value]
            return value
        state=scrub_state(state)
        return dict(node_id=nid,state=state,snapshots=snapshots,observations=observations,coverage=coverage)
