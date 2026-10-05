"""Apply an identity observation to the same canonical node, after remote IO.

Metadata and change history share the existing durable inventory transaction.
Names never become lookup keys; this module does not touch Cycle evidence.
"""
import copy
import hashlib
import json
from .inventory import MUTEX
from validation_identity import normalize_hostname


class IdentitySync:
    def __init__(self,pa): self.pa=pa

    def __call__(self,target,observation,previous_boot=None):
        pa=self.pa
        result=dict(status='UNCHANGED',events=[],reason='',os_hostname=target.get('os_hostname'),bmc_hostname=target.get('bmc_hostname'))
        def reject(reason):
            return dict(result,status='IDENTITY_REQUIRES_CONFIRMATION',reason=reason)
        with MUTEX,pa._DATA_LOCK:
            name=target.get('parent_name'); parent=pa.machines.get(name)
            if not parent: return reject('原設備已移除或更名，請重新確認目前目標')
            canonical=pa.node_identity.canonical(dict(parent,name=name))
            if canonical.get('chassis_id')!=target.get('chassis_id'): return reject('Chassis 身分已變更')
            entries=[e for e in canonical.get('os',[]) if e.get('node_id')==target.get('node_id')]
            if len(entries)!=1: return reject('原 Node 已移除，請確認實體槽位')
            entry=entries[0]
            if target.get('binding_revision',entry.get('binding_revision',1))!=entry.get('binding_revision',1): return reject('連線設定版本已變更')
            if entry.get('empty') or entry.get('retired') or entry.get('status')=='retired': return reject('Node 已退役或槽位為空')
            if pa.node_identity.binding(entry)!=target.get('revision') or entry.get('ip','')!=observation.get('os_ip') or entry.get('bmc_ip','')!=observation.get('bmc_ip'):
                return reject('採集期間連線設定已變更，保留原名稱')
            if observation.get('node_id')!=entry['node_id'] or observation.get('binding_revision')!=target.get('revision'):
                return reject('觀測與目前 Node／連線版本不一致')
            # Only independently observed asset evidence can establish mismatch.
            # A hostname or a new boot generation alone is never such evidence.
            expected=entry.get('expected_identity') or {}
            for field in ('hardware_uuid','node_serial'):
                want=expected.get(field) or entry.get(field)
                actual=observation.get(field)
                if want and not actual: return reject('無法取得既有資產識別以確認目標：'+field)
                if want and actual and str(want).casefold()!=str(actual).casefold(): return reject('實體資產識別不一致：'+field)
            if observation.get('identity_mismatch'): return reject('來源回報資產識別不一致')
            changes=[]
            mutated=False
            for role in ('os','bmc'):
                value=observation.get(role+'_hostname')
                if observation.get(role+'_status')!='SUCCESS' or not normalize_hostname(value): continue
                key=role+'_hostname'
                observed_mac=observation.get(role+'_mac')
                stored_mac=entry.get(role+'_mac')
                # MAC (keyed to the registered IP) is the asset evidence for a name change.
                # A name change is only accepted while the same interface is still present;
                # if the stored MAC no longer matches, the target may be a different machine.
                if stored_mac and observed_mac and stored_mac!=observed_mac:
                    return reject(role.upper()+' 網卡 MAC 與前次不一致（可能已換到其他實體節點），請重新確認目標')
                if observed_mac and entry.get(role+'_mac')!=observed_mac:
                    entry[role+'_mac']=observed_mac;mutated=True
                if normalize_hostname(entry.get(key))!=normalize_hostname(value):
                    if stored_mac and not observed_mac:
                        return reject('無法取得 '+role.upper()+' 網卡 MAC 以確認 hostname 變更，請重新確認目標')
                    changes.append((role.upper()+'_HOSTNAME_CHANGED',entry.get(key,''),value))
                    entry[key]=value;mutated=True
                    if observation.get(role+'_hostname_raw') and entry.get(key+'_raw')!=observation[role+'_hostname_raw']:
                        entry[key+'_raw']=observation[role+'_hostname_raw'];mutated=True
                result[key]=entry.get(key)
            boot=observation.get('os_boot_id')
            if observation.get('os_status')=='SUCCESS' and previous_boot and boot and previous_boot!=boot:
                changes.append(('BOOT_GENERATION_CHANGED',previous_boot,boot))
            history=canonical.setdefault('identity_history',[])
            events=[]
            for kind,before,after in changes:
                seed=[entry['node_id'],kind,before,after]
                if kind!='BOOT_GENERATION_CHANGED': seed.append(history[-1]['id'] if history else '')
                eid=hashlib.sha256(json.dumps(seed).encode()).hexdigest()
                if any(e.get('id')==eid for e in history): continue
                event=dict(id=eid,node_id=entry['node_id'],chassis_id=canonical['chassis_id'],kind=kind,
                           previous=before,current=after,observed_at=observation['collected_at'],source='inspection_identity',severity='INFO')
                history.append(event);events.append(event)
            if not events and not mutated: return result
            backup=copy.deepcopy(parent)
            try:
                if any(e['kind'].endswith('HOSTNAME_CHANGED') for e in events):
                    entry['binding_revision']=int(entry.get('binding_revision',1))+1
                # Only the selected node's display metadata is reflected at top level.
                if canonical.get('active_os')==entry.get('slot'):
                    for field in ('os_hostname','bmc_hostname','os_hostname_raw','bmc_hostname_raw','os_mac','bmc_mac'):
                        if field in entry: canonical[field]=entry[field]
                parent.clear();parent.update(canonical)
                pa._save_data()
            except BaseException:
                parent.clear();parent.update(backup)
                raise
            pa._invalidate_machine_cache(name)
            return dict(result,status='AUTO_SYNC',events=events,binding_revision=pa.node_identity.binding(entry))
