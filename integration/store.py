"""Transactional job state and control-scope reservations shared by Web and runner."""
from contextlib import contextmanager
from pathlib import Path
import hashlib
import ipaddress
import json
import math
import os
import re
import sqlite3
import time
import uuid
from .settings import DATA, MODE, ENGINE, ROOT

TERMINAL = {'COMPLETE', 'INCOMPLETE', 'CANCELLED', 'BLOCKED', 'ERROR'}
SAFE_FIELDS = ('name','project','tray','node','os_ip','bmc_ip','os_hostname','bmc_hostname',
               'os_user','bmc_user','os_port','bmc_port','ipmi_cipher','power_domain','aux_domain',
               'aux_scope_confirmed','credential_ref','synthetic','mgx_type','cycle_profile')

class Conflict(ValueError):
    pass

def encode(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'))

def fingerprint(value):
    return hashlib.sha256(encode(value).encode()).hexdigest()

def engine_hash():
    manifest=ROOT/'RUNTIME_ENGINE_FILES.json'
    files=json.loads(manifest.read_text(encoding='utf-8'))['RUNTIME_ENGINE_FILES']
    # New nested runtime files cannot silently evade PRE's version guarantee.
    discovered=set()
    for folder in ('integration','engine/vera_cycle','app'):
        excluded={'dev','docs','data','tests','node_modules','__pycache__'}
        if folder=='app': excluded|={'scripts','deploy'}
        for p in (ROOT/folder).rglob('*'):
            relative=p.relative_to(ROOT)
            if any(part.startswith('.') or part in excluded for part in relative.parts): continue
            suffixes={'.py','.sh','.js','.css','.html'} | ({'.md'} if folder!='app' else set())
            if p.is_file() and (p.suffix in suffixes or p.name=='VERSION'):
                discovered.add(relative.as_posix())
    if discovered-set(files): raise Conflict('Runtime manifest is missing: '+', '.join(sorted(discovered-set(files))))
    if len(files)!=len(set(files)): raise Conflict('Duplicate runtime manifest entries')
    hashes={'RUNTIME_ENGINE_FILES.json':hashlib.sha256(manifest.read_bytes()).hexdigest()}
    for name in files:
        p=(ROOT/name).resolve()
        if not p.is_relative_to(ROOT.resolve()) or not p.is_file(): raise Conflict('Invalid runtime manifest entry: '+name)
        hashes[name]=hashlib.sha256(p.read_bytes()).hexdigest()
    return fingerprint(hashes)

def scopes(machine):
    keys = [f'machine:{machine["name"]}']
    for role in ('os','bmc'):
        if machine.get(role+'_ip'):
            keys.append('endpoint:'+str(ipaddress.ip_address(machine[role+'_ip'])))
    # Conservatively reserve a shared domain even for non-AUX operations.
    for field in ('power_domain','aux_domain'):
        if machine.get(field):
            keys.append('domain:'+machine[field])
    return sorted(set(keys))

class Store:
    def __init__(self, path=None):
        self.path = Path(path or DATA / 'jobs.sqlite3')
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.tx() as db:
            db.executescript('''
                CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY, project TEXT NOT NULL,
                    idem TEXT NOT NULL, request_hash TEXT NOT NULL, state TEXT NOT NULL,
                    updated REAL NOT NULL, data TEXT NOT NULL, UNIQUE(project,idem));
                CREATE TABLE IF NOT EXISTS locks(scope TEXT PRIMARY KEY, owner TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS events(seq INTEGER PRIMARY KEY AUTOINCREMENT,
                    job_id TEXT NOT NULL, at REAL NOT NULL, data TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS controls(id TEXT PRIMARY KEY, data TEXT NOT NULL);
            ''')

    @contextmanager
    def tx(self):
        db = sqlite3.connect(self.path, timeout=30)
        db.row_factory = sqlite3.Row
        try:
            db.execute('PRAGMA foreign_keys=ON')
            db.execute('BEGIN IMMEDIATE')
            yield db
            db.commit()
        except BaseException:
            db.rollback()
            raise
        finally:
            db.close()

    def _get(self, db, job_id):
        row = db.execute('SELECT data FROM jobs WHERE id=?',(job_id,)).fetchone()
        if row is None:
            raise KeyError(job_id)
        return json.loads(row['data'])

    def _save(self, db, job, event=None):
        job['updated_at'] = time.time()
        db.execute('UPDATE jobs SET state=?,updated=?,data=? WHERE id=?',
                   (job['state'],job['updated_at'],encode(job),job['id']))
        if event:
            db.execute('INSERT INTO events(job_id,at,data) VALUES(?,?,?)',
                       (job['id'],job['updated_at'],encode(dict(job_id=job['id'],run_id=job.get('run_id'),**event))))

    def get(self, job_id):
        with self.tx() as db:
            return self._get(db,job_id)

    def jobs(self, project=None):
        with self.tx() as db:
            query = 'SELECT data FROM jobs' + (' WHERE project=?' if project is not None else '') + ' ORDER BY updated DESC'
            return [json.loads(r[0]) for r in db.execute(query,(project,) if project is not None else ())]

    def lock_owners(self):
        with self.tx() as db:
            return dict(db.execute('SELECT scope,owner FROM locks'))

    def reserve(self, db, owner, keys):
        for key in sorted(set(keys)):
            row = db.execute('SELECT owner FROM locks WHERE scope=?',(key,)).fetchone()
            if row and row[0] != owner:
                raise Conflict(f'控制範圍已被任務占用：{row[0]} ({key})')
            db.execute('INSERT OR IGNORE INTO locks VALUES(?,?)',(key,owner))

    def begin_control(self, machine, action, on, actor):
        control = dict(id='control-'+uuid.uuid4().hex, state='CONTROL_RUNNING',
                       target={k:machine[k] for k in SAFE_FIELDS if k in machine},
                       action=action, on=on, actor=actor, dispatched=False, created_at=time.time())
        with self.tx() as db:
            self.reserve(db, control['id'], scopes(machine))
            db.execute('INSERT INTO controls VALUES(?,?)', (control['id'], encode(control)))
        return control

    def get_control(self, control_id):
        with self.tx() as db:
            row=db.execute('SELECT data FROM controls WHERE id=?',(control_id,)).fetchone()
            if row is None: raise KeyError(control_id)
            return json.loads(row[0])

    def controls(self):
        with self.tx() as db:
            return [json.loads(r[0]) for r in db.execute('SELECT data FROM controls')]

    def update_control(self, control_id, **fields):
        with self.tx() as db:
            row=db.execute('SELECT data FROM controls WHERE id=?',(control_id,)).fetchone()
            if row is None: raise KeyError(control_id)
            control=json.loads(row[0])
            if control['state'] in {'CONTROL_COMPLETE','CONTROL_FAILED'}: return control
            control.update(fields, updated_at=time.time())
            db.execute('UPDATE controls SET data=? WHERE id=?',(encode(control),control_id))
            if control['state'] in {'CONTROL_COMPLETE','CONTROL_FAILED'}:
                db.execute('DELETE FROM locks WHERE owner=?',(control_id,))
            return control

    def assert_inventory_idle(self, db, machines=(), project=None):
        names=set(machines)
        for row in db.execute('SELECT data FROM jobs'):
            job=json.loads(row[0])
            if job['state'] not in TERMINAL and (job['project']==project or names.intersection(m['name'] for m in job['targets'])):
                raise Conflict('Active Cycle Job prevents inventory change: '+job['id'])
        for row in db.execute('SELECT data FROM controls'):
            control=json.loads(row[0])
            if control['state'] not in {'CONTROL_COMPLETE','CONTROL_FAILED'} and (control['target'].get('project')==project or control['target']['name'] in names):
                raise Conflict('Unresolved manual control prevents inventory change: '+control['id'])

    def assert_scopes_idle(self, db, machine):
        # Incomplete imported inventory must remain repairable. Invalid old
        # addresses cannot match a reserved canonical IP; retain all valid scopes.
        current=dict(machine)
        for role in ('os','bmc'):
            try: ipaddress.ip_address(current.get(role+'_ip',''))
            except ValueError: current.pop(role+'_ip',None)
        for key in scopes(current):
            row=db.execute('SELECT owner FROM locks WHERE scope=?',(key,)).fetchone()
            if row: raise Conflict('Reserved control scope prevents inventory change: '+row[0])

    def compact_events(self, before):
        """Explicit maintenance only; preserve final event cursor and all evidence."""
        count=0
        with self.tx() as db:
            for row in db.execute('SELECT id,data FROM jobs WHERE updated<?',(before,)).fetchall():
                job=json.loads(row['data'])
                if job['state'] not in TERMINAL: continue
                events=db.execute('SELECT seq FROM events WHERE job_id=? ORDER BY seq',(job['id'],)).fetchall()
                if len(events)<2: continue
                last=events[-1][0]
                db.execute('DELETE FROM events WHERE job_id=? AND seq<?',(job['id'],last))
                db.execute('UPDATE events SET data=? WHERE seq=?',(encode(dict(job_id=job['id'],phase='COMPACTED',state=job['state'],removed=len(events)-1)),last))
                count+=len(events)-1
        return count

    @contextmanager
    def control(self, machine):
        """Short reservation for non-dispatch callers only; remote control uses begin_control."""
        owner = 'control-'+uuid.uuid4().hex
        with self.tx() as db:
            self.reserve(db,owner,scopes(machine))
        try:
            yield
        finally:
            with self.tx() as db:
                db.execute('DELETE FROM locks WHERE owner=?',(owner,))

    def create(self, project, request, targets, actor, mode=MODE):
        targets=[{k:m[k] for k in SAFE_FIELDS if k in m} for m in targets]
        request_hash = fingerprint(request)
        keys = [k for m in targets for k in scopes(m)]
        with self.tx() as db:
            row = db.execute('SELECT id,request_hash FROM jobs WHERE project=? AND idem=?',
                             (project,request['idempotency_key'])).fetchone()
            if row:
                if row['request_hash'] != request_hash:
                    raise Conflict('重試識別碼已用於不同設定')
                return self._get(db,row['id'])
            job_id = uuid.uuid4().hex
            self.reserve(db,job_id,keys)
            job = dict(id=job_id,project=project,state='CREATED',mode=mode,synthetic=mode=='synthetic',
                       config=request,targets=targets,created_by=actor,created_at=time.time(),
                       updated_at=time.time(),engine_hash=engine_hash(),nodes=[],health='PENDING',
                       stop_requested=False,stop_reason='',pre=None,run_id='cycle-'+job_id)
            job['source_versions']=json.loads((ROOT/'SOURCE_BASELINES.json').read_text(encoding='utf-8'))
            job['integration_version']=(ROOT/'VERSION').read_text().strip()
            db.execute('INSERT INTO jobs VALUES(?,?,?,?,?,?,?)',
                       (job_id,project,request['idempotency_key'],request_hash,'CREATED',time.time(),encode(job)))
            self._save(db,job,{'phase':'CREATED','actor':actor})
            return job

    def claim(self, job_id, worker):
        with self.tx() as db:
            job = self._get(db,job_id)
            if job['state'] != 'CREATED':
                return None
            job.update(state='PRE_RUNNING',worker=worker,worker_pid=os.getpid(),heartbeat=time.time())
            self._save(db,job,{'phase':'PRE_RUNNING'})
            return job

    def update(self, job_id, event=None, **fields):
        with self.tx() as db:
            job = self._get(db,job_id)
            if job['state'] in TERMINAL:
                return job
            job.update(fields)
            self._save(db,job,event)
            return job

    def ready(self, job_id, pre, nodes):
        with self.tx() as db:
            job = self._get(db,job_id)
            pre['version'] = fingerprint(dict(pre=pre,targets=job['targets'],config=job['config'],engine=job['engine_hash']))
            job.update(pre=pre,nodes=nodes,state='AWAITING_CONFIRMATION')
            self._save(db,job,{'phase':'AWAITING_CONFIRMATION'})

    def confirm(self, job_id, version, machine_ids, actor):
        with self.tx() as db:
            job = self._get(db,job_id)
            if job.get('confirmation') == dict(version=version,machine_ids=machine_ids,actor=actor):
                return job
            if job['state'] != 'AWAITING_CONFIRMATION' or job['stop_requested']:
                raise Conflict('任務已不在等待確認階段')
            pre = job['pre']
            if version != pre['version'] or machine_ids != pre['runnable_ids'] or engine_hash() != job['engine_hash']:
                raise Conflict('PRE、目標或引擎版本已變更，請重新建立任務')
            job.update(state='RUNNING',confirmed_by=actor,confirmed_at=time.time(),
                       confirmation=dict(version=version,machine_ids=machine_ids,actor=actor))
            self._save(db,job,{'phase':'CONFIRMED','actor':actor})
            return job

    def stop(self, job_id, actor):
        with self.tx() as db:
            job = self._get(db,job_id)
            if job['state'] in TERMINAL or job['stop_requested']:
                return job
            job.update(stop_requested=True,stopped_by=actor)
            if job['state'] == 'CREATED':
                job['state']='CANCELLED'
                db.execute('DELETE FROM locks WHERE owner=?',(job_id,))
            elif job['state'] == 'RUNNING':
                job['state']='STOP_REQUESTED'
            self._save(db,job,{'phase':'STOP_REQUESTED','actor':actor})
            return job

    def finish(self, job_id, state, reason='', **fields):
        if state not in TERMINAL:
            raise ValueError(state)
        with self.tx() as db:
            job = self._get(db,job_id)
            if job['state'] in TERMINAL:
                return job
            job.update(fields,state=state,stop_reason=reason,finished_at=time.time())
            self._save(db,job,{'phase':state,'reason':reason})
            db.execute('DELETE FROM locks WHERE owner=?',(job_id,))
            return job

    def events(self, job_id, after):
        with self.tx() as db:
            return [dict(sequence=r['seq'],time=r['at'],**json.loads(r['data'])) for r in
                    db.execute('SELECT * FROM events WHERE job_id=? AND seq>? ORDER BY seq LIMIT 500',(job_id,after))]

def validate_request(body):
    allowed={'machine_ids','cycle_profile','cycle_mode','channel','limits','boot_timeout','idempotency_key'}
    if set(body)-allowed:
        raise ValueError('不支援的設定欄位')
    ids=body.get('machine_ids')
    if not isinstance(ids,list) or not ids or len(ids)>32 or any(not isinstance(x,str) for x in ids) or len(set(ids))!=len(ids):
        raise ValueError('請選取 1–32 台不重複的機台')
    if body.get('cycle_profile') != 'neutrino' or body.get('cycle_mode') not in {'reboot','power_cycle','aux_cycle'} or body.get('channel') not in {'inband','outband'}:
        raise ValueError('Profile、cycle 模式或通道無效')
    limits=body.get('limits',{})
    if not isinstance(limits,dict) or set(limits)-{'loops','hours'}:
        raise ValueError('限制設定無效')
    loops=limits.get('loops',0); hours=limits.get('hours',0)
    if type(loops) is not int or not 0<=loops<=1000000 or type(hours) not in (int,float) or not math.isfinite(hours) or not 0<=hours<=8760 or not (loops or hours):
        raise ValueError('至少設定一項有效限制：正整數次數或正數時數')
    timeout=body.get('boot_timeout',900)
    if type(timeout) is not int or not 1<=timeout<=86400:
        raise ValueError('Boot timeout 必須介於 1–86400 秒')
    key=body.get('idempotency_key','')
    if not isinstance(key,str) or not re.fullmatch(r'[A-Za-z0-9_-]{8,100}',key):
        raise ValueError('請提供有效的重試識別碼')
    return dict(body,boot_timeout=timeout,limits=dict(loops=loops,hours=hours))

def target_reason(machine, profile, mode=MODE):
    reasons=[]
    if profile!='neutrino': reasons.append('尚未設定支援的 Neutrino profile')
    if machine.get('cycle_profile',profile)!='neutrino': reasons.append('Machine profile 必須是 Neutrino')
    if machine.get('mgx_type','server')!='server': reasons.append('僅支援 server 節點')
    for key in ('tray','node','os_hostname','bmc_hostname'):
        if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9.-]*',str(machine.get(key,''))): reasons.append('缺少或無效：'+key)
    for key in ('os_hostname','bmc_hostname'):
        host=machine.get(key,'')
        if not isinstance(host,str) or len(host)>253 or any(not re.fullmatch(r'[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?',label) for label in host.split('.')):
            reasons.append('無效 hostname：'+key)
    for role in ('os','bmc'):
        try:
            if not isinstance(machine.get(role+'_ip'),str): raise ValueError('IP must be text')
            ipaddress.ip_address(machine[role+'_ip'])
        except ValueError: reasons.append('缺少或無效：'+role+'_ip')
        if not machine.get(role+'_user'): reasons.append('缺少：'+role+'_user')
        port=machine.get(role+'_port',22)
        if type(port) is not int or not 1<=port<=65535: reasons.append('無效：'+role+'_port')
    if type(machine.get('ipmi_cipher',17)) is not int or not 0<=machine.get('ipmi_cipher',17)<=20: reasons.append('無效：ipmi_cipher')
    if not isinstance(machine.get('power_domain'),str) or not machine['power_domain'].strip(): reasons.append('缺少或無效 power_domain')
    if mode=='synthetic' and not machine.get('synthetic'): reasons.append('離線模式只接受 SYNTHETIC inventory')
    if mode=='live' and (machine.get('synthetic') or not machine.get('credential_ref')): reasons.append('實機模式需要真實 inventory 與 credential_ref')
    return reasons
