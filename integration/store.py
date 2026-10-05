"""Transactional job state and control-scope reservations shared by Web and runner."""
from contextlib import contextmanager
from datetime import datetime
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
import threading
from .settings import DATA, MODE, ENGINE, ROOT
from .events import structured
from .profiles import checker_script_path, checker_missing_message
from cycle_core import LOG_TIMEZONE

TERMINAL = {'COMPLETE', 'INCOMPLETE', 'CANCELLED', 'BLOCKED', 'ERROR', 'RECONCILIATION_REQUIRED'}
# Store/domain lifecycle states that still represent an in-progress Cycle.  The
# older PREPARING spelling is accepted for imported history only.
IN_PROGRESS = {'CREATED', 'PRE_RUNNING', 'AWAITING_CONFIRMATION', 'RUNNING', 'STOP_REQUESTED', 'PREPARING'}
SAFE_FIELDS = ('name','project','tray','node','os_ip','bmc_ip','os_hostname','bmc_hostname',
               'os_user','bmc_user','os_port','bmc_port','ipmi_cipher','power_domain','aux_domain',
               'aux_scope_confirmed','credential_ref','synthetic','mgx_type','cycle_profile',
               'node_id','parent_name','chassis_id','slot_key','display_name','revision',
               'controller_id','system_uri','console_id','node_serial','hardware_uuid',
               'slot_id','project_id','rack_id','mapping_status','capabilities','credential_version','ipmi_port',
               'expected_identity','trust','os_password','bmc_password',
               'os_hostname_raw','bmc_hostname_raw','os_mac','bmc_mac')

class Conflict(ValueError):
    pass

def encode(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'))

def fingerprint(value):
    return hashlib.sha256(encode(value).encode()).hexdigest()

def readable_job_id(project, config):
    """Human-readable run id: <project>_<mode>_<channel>_<UTC+8 date>_<time>_<6hex>.

    Mirrors the vera-cycle campaign naming so an artifact directory can be read at
    a glance. The trailing hex keeps ids unique and the whole string URL/filesystem
    safe (only [a-z0-9_-])."""
    slug=re.sub(r'[^a-z0-9]+','_',str(project).lower()).strip('_') or 'run'
    stamp=datetime.now(LOG_TIMEZONE).strftime('%Y%m%d_%H%M%S')
    mode=re.sub(r'[^a-z0-9]+','_',str(config.get('cycle_mode','')).lower()).strip('_') or 'cycle'
    channel=re.sub(r'[^a-z0-9]+','_',str(config.get('channel','')).lower()).strip('_') or 'inband'
    return f"{slug}_{mode}_{channel}_{stamp}_{uuid.uuid4().hex[:6]}"


def snapshot_target(machine):
    from .targets import public
    return public({k:machine[k] for k in SAFE_FIELDS if k in machine})

def runtime_hash(ui=False):
    manifest=ROOT/'RUNTIME_ENGINE_FILES.json'
    files=json.loads(manifest.read_text(encoding='utf-8'))['RUNTIME_ENGINE_FILES']
    # New nested runtime files cannot silently evade PRE's version guarantee.
    discovered={'run.py','engine/vera_cycle/validation_checkers.json'}
    for folder in ('integration','engine/vera_cycle','app'):
        excluded={'dev','docs','data','tests','node_modules','__pycache__','qa','test-results'}
        if folder=='app': excluded|={'scripts','deploy'}
        for p in (ROOT/folder).rglob('*'):
            relative=p.relative_to(ROOT)
            if any(part.startswith('.') or part in excluded for part in relative.parts): continue
            suffixes={'.py','.sh','.js','.css','.html'} | ({'.md'} if folder!='app' else set())
            if p.is_file() and (p.suffix in suffixes or p.name=='VERSION'):
                discovered.add(relative.as_posix())
    missing=discovered-set(files)
    extra=set(files)-discovered
    if missing: raise Conflict('Runtime manifest is missing: '+', '.join(sorted(missing)))
    if extra: raise Conflict('Runtime manifest has extra entries: '+', '.join(sorted(extra)))
    if len(files)!=len(set(files)): raise Conflict('Duplicate runtime manifest entries')
    hashes={}
    for name in files:
        p=(ROOT/name).resolve()
        if not p.is_relative_to(ROOT.resolve()) or not p.is_file(): raise Conflict('Invalid runtime manifest entry: '+name)
        presentation=name.startswith('app/static/') or name in {'engine/vera_cycle/report.css','engine/vera_cycle/report.js'}
        if presentation == ui:
            hashes[name]=hashlib.sha256(p.read_bytes()).hexdigest()
    return fingerprint(hashes)

def engine_hash():
    return runtime_hash(ui=False)

def ui_build_hash():
    return runtime_hash(ui=True)


def scopes(machine):
    keys = [f'machine:{machine["name"]}']
    if machine.get('node_id'): keys.append('node:'+machine['node_id'])
    if machine.get('controller_id'): keys.append('controller:'+machine['controller_id'])
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
        self._transactions=threading.local()
        self.path = Path(path or DATA / 'jobs.sqlite3')
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.tx() as db:
            db.executescript('''
                CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY, project TEXT NOT NULL,
                    idem TEXT NOT NULL, request_hash TEXT NOT NULL, state TEXT NOT NULL,
                    updated REAL NOT NULL, data TEXT NOT NULL, UNIQUE(project,idem));
                CREATE INDEX IF NOT EXISTS jobs_project_updated ON jobs(project,updated DESC,id);
                CREATE INDEX IF NOT EXISTS jobs_updated ON jobs(updated DESC,id);
                CREATE TABLE IF NOT EXISTS locks(scope TEXT PRIMARY KEY, owner TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS events(seq INTEGER PRIMARY KEY AUTOINCREMENT,
                    job_id TEXT NOT NULL, at REAL NOT NULL, data TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS node_status(job_id TEXT NOT NULL, node_id TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY(job_id,node_id));
                CREATE TABLE IF NOT EXISTS actions(id TEXT PRIMARY KEY, job_id TEXT NOT NULL, data TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS controls(id TEXT PRIMARY KEY, data TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS validation_profiles(project_id TEXT PRIMARY KEY, package TEXT NOT NULL, content_hash TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS observation_status(node_id TEXT PRIMARY KEY, data TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS input_sessions(id TEXT PRIMARY KEY, updated REAL NOT NULL, data TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS artifact_index(job_id TEXT NOT NULL, artifact_id TEXT NOT NULL,
                    signature TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY(job_id,artifact_id));
                CREATE INDEX IF NOT EXISTS events_job_sequence ON events(job_id,seq);
                CREATE INDEX IF NOT EXISTS events_job_machine_sequence ON events(job_id,json_extract(data,'$.machine_id'),seq);
            ''')

    @contextmanager
    def tx(self, write=True):
        current=getattr(self._transactions,"db",None)
        if current is not None:
            yield current
            return
        db = sqlite3.connect(self.path, timeout=30)
        db.row_factory = sqlite3.Row
        try:
            db.execute('PRAGMA foreign_keys=ON')
            db.execute('BEGIN IMMEDIATE' if write else 'BEGIN')
            self._transactions.db=db
            yield db
            db.commit()
        except BaseException:
            db.rollback()
            raise
        finally:
            self._transactions.db=None
            db.close()

    def observation_status(self, node_id, value=None):
        with self.tx(write=value is not None) as db:
            if value is not None:
                db.execute('INSERT OR REPLACE INTO observation_status VALUES(?,?)',(node_id,encode(value)))
                return value
            row=db.execute('SELECT data FROM observation_status WHERE node_id=?',(node_id,)).fetchone()
            return json.loads(row[0]) if row else dict(node_id=node_id,state='NOT_CONFIGURED')

    def input_session(self, owner, value=None):
        with self.tx(write=value is not None) as db:
            if value is not None:
                db.execute('INSERT OR REPLACE INTO input_sessions VALUES(?,?,?)',(owner,time.time(),encode(value)))
                return value
            row=db.execute('SELECT data FROM input_sessions WHERE id=?',(owner,)).fetchone()
            if row is None:raise KeyError(owner)
            return json.loads(row[0])

    def input_sessions(self):
        with self.tx(write=False) as db:
            # Only outstanding reservations are operational; closed history stays in SQLite.
            return [json.loads(r[0]) for r in db.execute(
                "SELECT data FROM input_sessions WHERE id IN (SELECT DISTINCT owner FROM locks) ORDER BY updated DESC")]

    def _get(self, db, job_id):
        row = db.execute('SELECT data FROM jobs WHERE id=?',(job_id,)).fetchone()
        if row is None:
            raise KeyError(job_id)
        job=json.loads(row['data'])
        live=[json.loads(r[0]) for r in db.execute('SELECT data FROM node_status WHERE job_id=? ORDER BY node_id',(job_id,))]
        if live: job['nodes']=live
        return job

    def _save(self, db, job, event=None):
        job['updated_at'] = time.time()
        db.execute('UPDATE jobs SET state=?,updated=?,data=? WHERE id=?',
                   (job['state'],job['updated_at'],encode(job),job['id']))
        if event:
            self._event(db,job['id'],job.get('run_id'),event,at=job['updated_at'])

    def _event(self, db, job_id, run_id, event, at=None, secrets=()):
        at=time.time() if at is None else at
        payload=structured(job_id,run_id,event,at,secrets)
        return db.execute('INSERT INTO events(job_id,at,data) VALUES(?,?,?)',(job_id,at,encode(payload))).lastrowid

    def append_event(self, job_id, event, secrets=()):
        """Append only; never rewrite Job state, snapshots, locks or heartbeat."""
        with self.tx() as db:
            row=db.execute('SELECT state FROM jobs WHERE id=?',(job_id,)).fetchone()
            if row is None: raise KeyError(job_id)
            if row['state'] in TERMINAL: return None
            return self._event(db,job_id,'cycle-'+job_id,event,secrets=secrets)

    def get(self, job_id):
        with self.tx(write=False) as db:
            return self._get(db,job_id)

    def console_summary(self, job_id):
        """Read-only latest-loop markers; no action or state-machine updates.

        Loaded when a Console opens, so its bounded event tail need not retain
        every earlier completion marker. Historical health remains in job.nodes.
        """
        with self.tx(write=False) as db:
            rows=db.execute('''WITH e AS (
              SELECT seq,data,json_extract(data,'$.machine_id') AS node,
                COALESCE(json_extract(data,'$.loop'),0) AS loop,
                json_extract(data,'$.event_type') AS kind
              FROM events WHERE job_id=? AND json_extract(data,'$.machine_id') IS NOT NULL
            ), latest AS (SELECT node,MAX(loop) AS loop FROM e GROUP BY node)
            SELECT e.node,e.loop,
              MAX(CASE WHEN kind='COMMAND_DISPATCHED' THEN 1 ELSE 0 END) AS action,
              MAX(CASE WHEN kind='RECOVERY_DETECTED' THEN 1 ELSE 0 END) AS recovery,
              MAX(CASE WHEN kind='POST_COMPLETED' THEN 1 ELSE 0 END) AS post,
              MAX(CASE WHEN kind IN ('PRE_STARTED','PRE_COMPLETED','ACTION_PREPARING','COMMAND_DISPATCHING',
                'COMMAND_DISPATCHED','RESPONSE_RETURNED','RESPONSE_LOST','WAIT_OFFLINE','WAIT_RECOVERY',
                'OS_UNREACHABLE','BOOT_ID_CHANGED','RECOVERY_DETECTED','POST_STARTED','POST_COMPLETED') THEN seq END) AS stage_seq,
              MAX(CASE WHEN kind LIKE 'ISSUE_%' AND json_extract(data,'$.level') IN ('WARN','FAIL','ERROR') THEN seq END) AS issue_seq
            FROM e JOIN latest l ON e.node=l.node AND e.loop=l.loop GROUP BY e.node,e.loop''',(job_id,)).fetchall()
            result=[]
            for row in rows:
                markers=[]
                for seq in (row['stage_seq'],row['issue_seq']):
                    if seq:
                        event=db.execute('SELECT data FROM events WHERE seq=? AND job_id=?',(seq,job_id)).fetchone()
                        if event: markers.append(dict(json.loads(event[0]),sequence=seq))
                result.append(dict(machine_id=row['node'],loop=row['loop'],completed=[phase for phase,key in [('ACTION','action'),('RECOVERY','recovery'),('POST','post')] if row[key]],markers=markers))
            return {'nodes':result,'basis':'typed events, latest loop per node'}

    def jobs(self, project=None):
        with self.tx(write=False) as db:
            query = 'SELECT data FROM jobs' + (' WHERE project=?' if project is not None else '') + ' ORDER BY updated DESC'
            return [json.loads(r[0]) for r in db.execute(query,(project,) if project is not None else ())]

    def history_projects(self):
        with self.tx(write=False) as db:
            return [r[0] for r in db.execute('SELECT DISTINCT project FROM jobs')]

    def jobs_page(self, projects, offset=0, limit=25):
        if not projects: return []
        if offset<0 or not 1<=limit<=101: raise ValueError('Invalid history page')
        with self.tx(write=False) as db:
            slots=','.join('?' for _ in projects)
            query=f'SELECT data FROM jobs WHERE project IN ({slots}) ORDER BY updated DESC,id LIMIT ? OFFSET ?'
            return [json.loads(r[0]) for r in db.execute(query,(*projects,limit,offset))]

    def lock_owners(self):
        # Lock enforcement removed on this branch; callers always see nothing occupied.
        return {}

    def artifact_index(self, job_id, artifact_id=None):
        with self.tx(write=False) as db:
            query='SELECT artifact_id,signature,data FROM artifact_index WHERE job_id=?'
            args=(job_id,)
            if artifact_id is not None:
                query+=' AND artifact_id=?';args+=(artifact_id,)
            return {r['artifact_id']:(r['signature'],json.loads(r['data'])) for r in db.execute(query,args)}

    def index_artifacts(self, job_id, entries):
        if not entries: return
        with self.tx() as db:
            db.executemany('INSERT OR REPLACE INTO artifact_index VALUES(?,?,?,?)',
                [(job_id,item['artifact_id'],signature,encode(item)) for signature,item in entries])

    def reserve(self, db, owner, keys):
        # Lock enforcement removed: no reservation is written and no conflict is raised.
        # The locks table is retained so legacy DBs and leftover rows keep loading.
        return

    def begin_control(self, machine, action, on, actor, idempotency_key=None):
        control = dict(id='control-'+uuid.uuid4().hex, state='CONTROL_RUNNING',
                       target=snapshot_target(machine),
                       action=action, on=on, actor=actor, dispatched=False, created_at=time.time(),
                       idempotency_key=idempotency_key)
        with self.tx() as db:
            if idempotency_key:
                row=db.execute("SELECT data FROM controls WHERE json_extract(data,'$.actor')=? AND json_extract(data,'$.idempotency_key')=?",(actor,idempotency_key)).fetchone()
                if row:
                    existing=json.loads(row[0])
                    if any(existing[k]!=control[k] for k in ('target','action','on')):
                        raise Conflict('Idempotency key already used for a different control request')
                    return existing
            self.reserve(db, control['id'], scopes(machine))
            db.execute('INSERT INTO controls VALUES(?,?)', (control['id'], encode(control)))
        return control

    def get_control(self, control_id):
        with self.tx(write=False) as db:
            row=db.execute('SELECT data FROM controls WHERE id=?',(control_id,)).fetchone()
            if row is None: raise KeyError(control_id)
            return json.loads(row[0])

    def controls(self):
        with self.tx(write=False) as db:
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
            if (job['state'] not in TERMINAL or job['state']=='RECONCILIATION_REQUIRED') and (job['project']==project or names.intersection(n for m in job['targets'] for n in (m['name'],m.get('parent_name')))):
                raise Conflict('Active Cycle Job prevents inventory change: '+job['id'])
        for row in db.execute('SELECT data FROM controls'):
            control=json.loads(row[0])
            if control['state'] not in {'CONTROL_COMPLETE','CONTROL_FAILED'} and (control['target'].get('project')==project or bool(names.intersection((control['target']['name'],control['target'].get('parent_name'))))):
                raise Conflict('Unresolved manual control prevents inventory change: '+control['id'])

    def assert_scopes_idle(self, db, machine):
        # Lock enforcement removed: inventory changes are no longer blocked by reservations.
        return

    def compact_events(self, before, vacuum=False):
        """Explicit maintenance only; preserve final event cursor and all evidence.

        Deleting rows leaves free pages inside the SQLite file, so the file does
        not shrink until ``VACUUM`` rewrites it. ``vacuum`` runs that rewrite on
        a separate connection (SQLite forbids VACUUM inside a transaction) after
        the compaction commits.
        """
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
        if vacuum:
            db=sqlite3.connect(self.path, timeout=60)
            try:
                db.execute('VACUUM')
            finally:
                db.close()
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

    def create(self, project, request, targets, actor, mode=MODE, profile_snapshot=None):
        targets=[snapshot_target(m) for m in targets]
        request_hash = fingerprint(request)
        keys = [k for m in targets for k in scopes(m)]
        with self.tx() as db:
            row = db.execute('SELECT id,request_hash FROM jobs WHERE project=? AND idem=?',
                             (project,request['idempotency_key'])).fetchone()
            if row:
                if row['request_hash'] != request_hash:
                    raise Conflict('重試識別碼已用於不同設定')
                return self._get(db,row['id'])
            job_id = readable_job_id(project, request)
            self.reserve(db,job_id,keys)
            job = dict(id=job_id,project=project,state='CREATED',mode=mode,synthetic=mode=='synthetic',
                       config=request,targets=targets,created_by=actor,created_at=time.time(),
                       updated_at=time.time(),engine_hash=engine_hash(),nodes=[],health='PENDING',
                       stop_requested=False,stop_reason='',pre=None,run_id='cycle-'+job_id)
            job['source_versions']=json.loads((ROOT/'SOURCE_BASELINES.json').read_text(encoding='utf-8'))
            job['integration_version']=(ROOT/'VERSION').read_text().strip()
            job['ui_build_hash']=ui_build_hash()
            if profile_snapshot is not None:
                job['profile_snapshot']=profile_snapshot
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

    def blocked(self, project, config, targets, actor, reason):
        """Persist non-dispatchable native plans without acquiring unsafe scopes."""
        targets=[snapshot_target(t) for t in targets]
        with self.tx() as db:
            prior=db.execute('SELECT data FROM jobs WHERE project=? AND idem=?',(project,config['idempotency_key'])).fetchone()
            if prior:
                job=json.loads(prior[0])
                if fingerprint(job['config'])!=fingerprint(config): raise Conflict('Idempotency key already used')
                return job
            jid=readable_job_id(project, config); at=time.time()
            pre=dict(runnable_ids=[],excluded=[dict(machine_id=t['name'],reasons=[reason]) for t in targets],findings=[],baseline_hash=None)
            pre['version']=fingerprint(pre)
            job=dict(id=jid,run_id='cycle-'+jid,project=project,state='BLOCKED',mode=MODE,synthetic=MODE=='synthetic',config=config,
                     targets=targets,nodes=[],created_by=actor,created_at=at,updated_at=at,finished_at=at,stop_requested=False,
                     stop_reason=reason,health='NOT_RUN',pre=pre,engine_hash=engine_hash(),
                     source_versions=json.loads((ROOT/'SOURCE_BASELINES.json').read_text(encoding='utf-8')))
            db.execute('INSERT INTO jobs VALUES(?,?,?,?,?,?,?)',(jid,project,config['idempotency_key'],fingerprint(config),'BLOCKED',at,encode(job)))
            self._event(db,jid,job['run_id'],dict(phase='BLOCKED',detail=reason))
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
            pre['version'] = fingerprint(dict(pre=pre,targets=job['targets'],config=job['config'],engine=job['engine_hash'],
                profile=job.get('profile_snapshot',{}).get('content_hash')))
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
            if job['state']=='STOP_REQUESTED':
                self._event(db,job_id,job.get('run_id'),{'phase':'STOPPING_AFTER_ROUND'})
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
            if state!='RECONCILIATION_REQUIRED': db.execute('DELETE FROM locks WHERE owner=?',(job_id,))
            return job

    def node_update(self, job_id, node):
        with self.tx() as db:
            db.execute('INSERT OR REPLACE INTO node_status VALUES(?,?,?)',(job_id,node['machine_id'],encode(node)))

    def touch(self, job_id):
        with self.tx() as db:
            db.execute("UPDATE jobs SET data=json_set(data,'$.heartbeat',?) WHERE id=?",(time.time(),job_id))

    def intent(self, job_id, action):
        with self.tx() as db:
            job=self._get(db,job_id)
            if job['stop_requested']: raise Conflict('Stop requested before dispatch')
            if job['state']!='RUNNING': raise Conflict('Run is not dispatchable')
            db.execute('INSERT INTO actions VALUES(?,?,?)',(action['action_id'],job_id,encode(action)))
            self._event(db,job_id,job['run_id'],dict(level='CMD',phase='CYCLE',message='Action intent durably reserved',domain=action['domain']))

    def action_result(self, action_id, result):
        with self.tx() as db:
            db.execute("UPDATE actions SET data=json_set(data,'$.outcome',?) WHERE id=?",(result,action_id))

    def actions(self, job_id):
        with self.tx(write=False) as db:
            return [json.loads(r[0]) for r in db.execute('SELECT data FROM actions WHERE job_id=?',(job_id,))]

    def reconcile(self, job_id, reviewed_hash, actor, reason):
        with self.tx() as db:
            job=self._get(db,job_id)
            if job.get('reconciliation'): return job
            actions=[json.loads(r[0]) for r in db.execute('SELECT data FROM actions WHERE job_id=?',(job_id,))]
            if job['state']!='RECONCILIATION_REQUIRED' or fingerprint(actions)!=reviewed_hash:
                raise Conflict('Reconciliation review is missing or stale')
            job.update(state='INCOMPLETE',reconciliation=dict(actor=actor,reason=reason,actions_hash=reviewed_hash,at=time.time()))
            self._save(db,job,dict(phase='INCOMPLETE',message='Explicit reconciliation completed; no replay',detail=reason))
            db.execute('DELETE FROM locks WHERE owner=?',(job_id,))
            return job

    def delete_job(self, job_id):
        """Permanently remove a terminal job and every row keyed to it.

        Only terminal jobs may be deleted; an active reservation must be stopped first.
        Returns the removed project name so the caller can drop the artifact directory."""
        with self.tx() as db:
            job=self._get(db,job_id)
            if job['state'] not in TERMINAL:
                raise Conflict('Only stopped or finished runs can be deleted')
            project=job['project']
            for table in ('events','node_status','actions','artifact_index'):
                db.execute(f'DELETE FROM {table} WHERE job_id=?',(job_id,))
            db.execute('DELETE FROM locks WHERE owner=?',(job_id,))
            db.execute('DELETE FROM jobs WHERE id=?',(job_id,))
            return project

    def event_page(self, job_id, after=0, limit=500, before=None, tail=False, machine_id=None, errors_only=False, search='', until=None):
        """Read-only, indexed keyset pages. No writer reservation during polling/export."""
        limit=max(1,min(500,limit))
        db=sqlite3.connect(f'{self.path.resolve().as_uri()}?mode=ro',uri=True,timeout=5)
        db.row_factory=sqlite3.Row
        try:
            clauses=['job_id=?','seq>?']; args=[job_id,max(0,after)]
            if before is not None: clauses.append('seq<?'); args.append(before)
            if until is not None: clauses.append('seq<=?'); args.append(until)
            if machine_id: clauses.append("json_extract(data,'$.machine_id')=?"); args.append(machine_id)
            if errors_only: clauses.append("(json_extract(data,'$.level') IN ('FAIL','ERROR') OR json_extract(data,'$.phase') IN ('ERROR','BLOCKED','WORKER_LOST'))")
            if search:
                clauses.append("instr(lower(coalesce(json_extract(data,'$.message'),'') || ' ' || coalesce(json_extract(data,'$.detail'),'')),lower(?))>0")
                args.append(search[:200])
            descending=tail or before is not None
            rows=db.execute('SELECT seq,at,data FROM events WHERE '+' AND '.join(clauses)+' ORDER BY seq '+('DESC' if descending else 'ASC')+' LIMIT ?',(*args,limit+1)).fetchall()
            more=len(rows)>limit;rows=rows[:limit]
            if descending: rows.reverse()
            events=[dict(sequence=r['seq'],time=r['at'],**structured(job_id,'cycle-'+job_id,json.loads(r['data']),r['at'])) for r in rows]
            bounds=db.execute('SELECT min(seq),max(seq) FROM events WHERE job_id=?',(job_id,)).fetchone()
            compacted=db.execute("SELECT 1 FROM events WHERE job_id=? AND json_extract(data,'$.phase')='COMPACTED' LIMIT 1",(job_id,)).fetchone()
            expired=bool(after and ((bounds[1] is not None and after>bounds[1]) or (compacted and after<(bounds[0] or 0))))
            return dict(events=events,has_more=more,next_sequence=events[-1]['sequence'] if events else after,
                        oldest_sequence=events[0]['sequence'] if events else None,cursor_reset=expired,
                        history_compacted=bool(compacted))
        finally: db.close()

    def events(self, job_id, after):
        return self.event_page(job_id,after)['events']

def validate_request(body):
    allowed={'machine_ids','cycle_profile','cycle_mode','channel','limits','boot_timeout','idempotency_key','parallelism'}
    if set(body)-allowed:
        raise ValueError('不支援的設定欄位')
    ids=body.get('machine_ids')
    if not isinstance(ids,list) or not ids or len(ids)>4096 or any(not isinstance(x,str) for x in ids) or len(set(ids))!=len(ids):
        raise ValueError('請選取 1–4096 台不重複的機台')
    if not isinstance(body.get('cycle_profile'),str) or not re.fullmatch(r'[a-z][a-z0-9_-]{0,63}',body['cycle_profile']) or body.get('cycle_mode') not in {'reboot','power_cycle','aux_cycle'} or body.get('channel') not in {'inband','outband'}:
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
    parallelism=body.get('parallelism',8)
    if type(parallelism) is not int or not 1<=parallelism<=32: raise ValueError('parallelism must be 1..32')
    return dict(body,parallelism=parallelism,boot_timeout=timeout,limits=dict(loops=loops,hours=hours))

def target_reason(machine, profile, mode=MODE, require_profile=True):
    reasons=[]
    # A project may run its own <project>_config.sh (lowercase). We no longer gate on
    # profile == 'neutrino'; instead we require that the project's checker script exists.
    if require_profile and checker_script_path(machine.get('project')) is None:
        reasons.append(checker_missing_message(machine.get('project') or '(unknown)'))
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
    if mode=='live' and machine.get('synthetic'): reasons.append('實機模式需要真實 inventory')
    return reasons
