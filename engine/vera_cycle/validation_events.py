"""Pure event envelopes. Event identity is separate from problem identity."""
import hashlib
import json
import re
from collections import Counter
from validation_rules import dmesg_issues, redfish_entries, sel_records


def identity(*values):
    return hashlib.sha256(json.dumps(values,sort_keys=True,ensure_ascii=False).encode()).hexdigest()


def kernel_events(batch,boot_id,previous=None):
    previous=previous or {}; events=[]; state={}; gap=bool(batch.get('gap'))
    if batch['source']=='journal':
        rows=previous.get('pending',[])+batch.get('rows',[])
        # A page can split an APEI/GHES record. Retain the final contiguous
        # hardware-error block (including interleaved sequence tags) until drain.
        cut=len(rows)
        if batch.get('backlog'):
            while cut and re.search(r'Hardware Error|GHES|APEI',rows[cut-1]['MESSAGE'],re.I): cut-=1
        pending=rows[cut:]
        if len(pending)>2048:  # retain evidence; report incomplete grouping explicitly
            cut=len(rows); pending=[]; gap=True
        text='\n'.join(r['MESSAGE'] for r in rows[:cut])
        for finding in dmesg_issues(text):
            contributing=[rows[n-1] for n in finding['raw_lines']]
            source_time=contributing[0].get('__REALTIME_TIMESTAMP')
            events.append(dict(finding,event_id=identity(*(r['__CURSOR'] for r in contributing)),
                               generation=contributing[0].get('_BOOT_ID',boot_id),
                               source_time=float(source_time)/1000000 if source_time else None,
                               time_quality='journal',historical=not previous.get('initialized')))
        state=dict(cursor=batch.get('cursor'),pending=pending,initialized=True,source='journal')
    else:
        counts=Counter(); old=previous.get('counts',{}) if previous.get('boot_id')==boot_id else {}
        raw=batch.get('raw','')
        for finding in dmesg_issues(raw):
            signature=identity(finding['raw']); counts[signature]+=1
            if counts[signature]<=old.get(signature,0): continue
            events.append(dict(finding,event_id=identity(signature,counts[signature]),generation=boot_id,
                               source_time=None,time_quality='kernel-monotonic-or-unknown',
                               historical=not previous.get('initialized'),
                               occurrence_precision='uncertain' if previous.get('source')=='journal' else 'lower_bound',
                               countable=previous.get('source')!='journal'))
        # Ring shrink/wrap or Cycle dmesg clear cannot be reconstructed reliably.
        if any(counts[k]<v for k,v in old.items()): gap=True
        state=dict(counts=dict(counts),boot_id=boot_id,initialized=True,source='dmesg')
    return events,state,gap



def log_events(rows,source,generation,previous=None):
    """Full entry content + native ID survives ID reuse and constant row counts.

    Unknown reset/rollover is a coverage gap, not fabricated certainty. Callers
    persist events before committing returned state. Sources are never merged
    just because their English messages look similar.
    """
    previous=previous or {}; old=previous.get('identities',[]); current=[]; events=[]
    for row in rows:
        eid=identity(source,generation,row)
        current.append(eid)
        if eid in old: continue
        if source=='sel':
            f=dict(code='SEL_EVENT',component=row.get('component','controller'),detail=row['message'],
                   severity=row['severity'],native_severity=row['severity'],fingerprint=row['fingerprint'])
        else:
            normalized=redfish_entries({'Members':[row]})[0]
            native=normalized.get('severity','')
            f=dict(code='REDFISH_EVENT',component=row.get('_service','controller'),detail=normalized.get('message',''),
                   severity={'Critical':'FAIL','Warning':'WARN','OK':'INFO'}.get(native,'UNKNOWN'),
                   native_severity=native,fingerprint=identity(row.get('_service'),row.get('MessageId'),normalized.get('message')))
        f.update(event_id=eid,generation=generation,source_time=row.get('Created',row.get('source_time')),
                 historical=not previous.get('initialized'))
        events.append(f)
    gap=bool(old and not set(old).intersection(current) and current)
    return events,dict(identities=current,initialized=True,generation=generation),gap
