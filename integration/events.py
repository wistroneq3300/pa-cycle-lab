"""Structured operational events: bounded text, no stdout or secret containers."""
from datetime import datetime, timezone
import json
import os
from pathlib import PurePosixPath
import re

LEVELS={'INFO','CMD','WAIT','PASS','WARN','FAIL','ERROR','PRE','POST'}
LIFECYCLE={
    'CREATED':('INFO','Job created; targets and configuration reserved'),
    'PRE_RUNNING':('PRE','PRE started'),
    'AWAITING_CONFIRMATION':('WAIT','PRE ready; waiting for operator confirmation'),
    'CONFIRMED':('INFO','Confirmation accepted; approved targets may start cycling'),
    'STOP_REQUESTED':('WARN','Stop requested'),
    'STOPPING_AFTER_ROUND':('WAIT','Stopping after current round POST; no next round'),
    'COMPLETE':('INFO','Job COMPLETE; execution completion is separate from hardware health'),
    'INCOMPLETE':('WARN','Job INCOMPLETE; commands are never replayed'),
    'CANCELLED':('INFO','Job cancelled before cycle execution'),
    'BLOCKED':('ERROR','Job BLOCKED by PRE safety checks'),
    'ERROR':('ERROR','Job ERROR; inspect retained evidence'),
    'WORKER_LOST':('ERROR','Worker lost; commands are never replayed'),
    'COMPACTED':('WARN','Older terminal event history was compacted by explicit maintenance'),
}


def environment_secrets():
    values=[v for k,v in os.environ.items() if v and re.search(r'PASSWORD|PASSWD|(?:^|_)PASS$|TOKEN|SECRET|AUTHORIZATION|API_KEY|PRIVATE_KEY',k,re.I)]
    try:
        users=json.loads(os.environ.get('CYCLE_USERS_JSON','{}'))
        if isinstance(users,dict): values.extend(v for v in users.values() if isinstance(v,str) and v)
    except ValueError: pass
    return values


def redact(text, secrets=(), limit=2000):
    text=str(text)
    # Redact before clipping/flattening, so a boundary cannot expose a partial secret.
    for value in sorted({s for s in secrets if isinstance(s,str) and s},key=len,reverse=True):
        text=text.replace(value,'[REDACTED]')
    text=re.sub(r'(?im)(authorization\s*[:=]\s*)[^\r\n]+',r'\1[REDACTED]',text)
    text=re.sub(r'(?i)((?:password|passwd|token|secret|credential_ref|api_key)\s*[=:]\s*)[^\s,;]+',r'\1[REDACTED]',text)
    text=re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]','',text)
    text=re.sub(r'[\x00-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]',' ',text)
    return text[:limit]


def evidence_reference(value):
    if not isinstance(value,str) or not value or len(value)>512: return None
    if any(c in value for c in ('\\',':','%','\x00','?','#')) or any(ord(c)<32 for c in value): return None
    path=PurePosixPath(value)
    if path.is_absolute() or any(p.startswith('.') or any(s in p.lower() for s in ('credential','password','secret','private_key','id_rsa','id_ed25519')) for p in path.parts): return None
    return path.as_posix()


def structured(job_id, run_id, data, at, secrets=()):
    secrets=(*environment_secrets(),*secrets)
    phase=data.get('phase','JOB')
    phase=phase if isinstance(phase,str) and re.fullmatch(r'[A-Z_ ]{1,48}',phase) else 'JOB'
    default_level,default_message=LIFECYCLE.get(phase,('INFO','Execution stage updated'))
    level=data.get('level',default_level)
    kind=data.get('event_type',phase)
    event=dict(schema_version=1,timestamp=datetime.fromtimestamp(at,timezone.utc).isoformat(timespec='milliseconds'),
               job_id=job_id,run_id=run_id or 'cycle-'+job_id,
               machine_id=None,tray=None,node=None,loop=0,phase=phase,
               event_type=kind if isinstance(kind,str) and re.fullmatch(r'[A-Z_]{1,64}',kind) else 'STAGE',
               level=level if isinstance(level,str) and level in LEVELS else 'INFO',
               message=redact(data.get('message',default_message),secrets,600))
    for field in ('machine_id','tray','node'):
        if data.get(field) is not None: event[field]=redact(data[field],secrets,128)
    if type(data.get('loop')) is int: event['loop']=max(0,data['loop'])
    detail=data.get('detail',data.get('reason'))
    if detail: event['detail']=redact(detail,secrets)
    reference=evidence_reference(data.get('evidence'))
    if reference:
        safe=redact(reference,secrets,512)
        if safe==reference: event['evidence']=reference
    return event


def log_line(event):
    node=event.get('machine_id') or 'JOB'
    context=f"{event.get('tray') or '-'}/{event.get('node') or '-'} loop={event['loop']} {event['phase']}"
    detail=' | '+event['detail'] if event.get('detail') else ''
    evidence=' | evidence='+event['evidence'] if event.get('evidence') else ''
    return f"{event['timestamp']} #{event['sequence']} {node} [{event['level']}] {context} {event['message']}{detail}{evidence}\n"
