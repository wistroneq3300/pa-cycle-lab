"""Durable inspection of existing evidence. No transport or device commands."""
import copy
import hashlib
import json
import math
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path
from .events import redact, environment_secrets


def encode(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, allow_nan=False)


def key(*parts):
    return hashlib.sha256(encode(parts).encode()).hexdigest()


DEFAULTS = dict(enabled=False, interval_seconds=120, duration_seconds=120,
                recovery_samples=2, stale_seconds=300, ai_enabled=False,
                thresholds={'cpu':90, 'memory':95, 'gpu':95, 'vram':95}, hysteresis=5)


def validate_config(previous, changes):
    if not isinstance(changes, dict) or changes.keys()-DEFAULTS.keys():
        raise ValueError('未知巡檢設定')
    result=copy.deepcopy(previous)
    for name,value in changes.items():
        if name in {'enabled','ai_enabled'}:
            if type(value) is not bool: raise ValueError(name+' 必須為布林值')
        elif name=='thresholds':
            if not isinstance(value,dict) or value.keys()-DEFAULTS['thresholds'].keys(): raise ValueError('門檻欄位無效')
            if any(type(v) not in {int,float} or not math.isfinite(v) or not 1<=v<=100 for v in value.values()): raise ValueError('使用率門檻須介於 1–100%')
            value={**result['thresholds'],**value}
        else:
            limits={'interval_seconds':(30,3600),'duration_seconds':(0,3600),'recovery_samples':(1,20),'stale_seconds':(30,3600),'hysteresis':(1,30)}
            lo,hi=limits[name]
            if type(value) is not int or not lo<=value<=hi: raise ValueError(name+' 超出允許範圍')
        result[name]=value
    return result


class InspectionStore:
    def __init__(self,path):
        self.path=Path(path); self.path.parent.mkdir(parents=True,exist_ok=True)
        with self.tx() as db:
            db.executescript('''
                CREATE TABLE IF NOT EXISTS inspection_systems(id TEXT PRIMARY KEY, data TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS inspection_items(id TEXT PRIMARY KEY, system_id TEXT NOT NULL, data TEXT NOT NULL);
                CREATE INDEX IF NOT EXISTS inspection_items_system ON inspection_items(system_id);
                CREATE TABLE IF NOT EXISTS inspection_samples(id TEXT PRIMARY KEY, system_id TEXT NOT NULL, data TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS inspection_changes(seq INTEGER PRIMARY KEY AUTOINCREMENT,
                    issue_id TEXT NOT NULL, system_id TEXT NOT NULL, at REAL NOT NULL, kind TEXT NOT NULL, data TEXT NOT NULL);
                CREATE INDEX IF NOT EXISTS inspection_changes_issue ON inspection_changes(issue_id,seq);
                CREATE TABLE IF NOT EXISTS inspection_events(id TEXT PRIMARY KEY, issue_id TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS inspection_advice(id TEXT PRIMARY KEY, system_id TEXT NOT NULL,
                    issue_id TEXT NOT NULL, state TEXT NOT NULL, data TEXT NOT NULL);
            ''')

    @contextmanager
    def tx(self,write=True):
        db=sqlite3.connect(self.path,timeout=2); db.row_factory=sqlite3.Row
        try:
            db.execute('BEGIN IMMEDIATE' if write else 'BEGIN'); yield db; db.commit()
        except BaseException:
            db.rollback(); raise
        finally: db.close()

    def system(self,system_id,db=None):
        if db is None:
            with self.tx(False) as conn: return self.system(system_id,conn)
        row=db.execute('SELECT data FROM inspection_systems WHERE id=?',(system_id,)).fetchone()
        return json.loads(row[0]) if row else dict(id=system_id,config=copy.deepcopy(DEFAULTS),last_completed_at=None,next_due=0,coverage=[])

    def save_system(self,db,item):
        db.execute('INSERT OR REPLACE INTO inspection_systems VALUES(?,?)',(item['id'],encode(item)))

    def configure(self,system_id,changes,actor,now=None):
        at=time.time() if now is None else now
        with self.tx() as db:
            item=self.system(system_id,db); item['config']=validate_config(item['config'],changes)
            item.update(configured_by=str(actor),configured_at=at,next_due=at+int(key(system_id)[:4],16)%15)
            self.save_system(db,item)
        return item

    def enabled(self):
        with self.tx(False) as db:
            return [json.loads(r[0]) for r in db.execute("SELECT data FROM inspection_systems WHERE json_extract(data,'$.config.enabled')=1")]

    def issues(self,system_id,limit=100,offset=0):
        with self.tx(False) as db:
            rows=db.execute("SELECT data FROM inspection_items WHERE system_id=? ORDER BY json_extract(data,'$.status') ASC,json_extract(data,'$.last_seen_at') DESC LIMIT ? OFFSET ?",(system_id,limit,offset)).fetchall()
        return [json.loads(r[0]) for r in rows]

    def summary(self,system_id):
        with self.tx(False) as db:
            item=self.system(system_id,db)
            counts=db.execute("SELECT json_extract(data,'$.severity') severity,count(*) n FROM inspection_items WHERE system_id=? AND json_extract(data,'$.status')='ACTIVE' GROUP BY severity",(system_id,)).fetchall()
            item['summary']={'fail':0,'warning':0}
            for row in counts: item['summary']['fail' if row['severity']=='FAIL' else 'warning']=row['n']
        return item

    def history(self,system_id,issue_id):
        with self.tx(False) as db:
            return [dict(r,data=json.loads(r['data'])) for r in db.execute('SELECT * FROM inspection_changes WHERE system_id=? AND issue_id=? ORDER BY seq DESC LIMIT 100',(system_id,issue_id))]

    def handle(self,system_id,issue_id,changes,actor):
        allowed={'acknowledged','known_issue','mute_until'}
        if not isinstance(changes,dict) or changes.keys()-allowed: raise ValueError('處理欄位無效')
        for k,v in changes.items():
            if k!='mute_until' and type(v) is not bool: raise ValueError('處理標記須為布林值')
            if k=='mute_until' and (type(v) not in {int,float} or not math.isfinite(v) or not 0<=v<=time.time()+31536000): raise ValueError('暫停通知時間無效')
        with self.tx() as db:
            row=db.execute('SELECT data FROM inspection_items WHERE id=? AND system_id=?',(issue_id,system_id)).fetchone()
            if not row: raise KeyError(issue_id)
            item=json.loads(row[0]); item.update(changes,handled_by=str(actor))
            db.execute('UPDATE inspection_items SET data=? WHERE id=?',(encode(item),issue_id))
            self.change(db,item,'HANDLED',time.time(),changes)
        return item

    def change(self,db,item,kind,at,data):
        db.execute('INSERT INTO inspection_changes(issue_id,system_id,at,kind,data) VALUES(?,?,?,?,?)',(item['id'],item['system_id'],at,kind,encode(data)))

    def advice(self,system_id,issue_id,manual=False):
        with self.tx() as db:
            row=db.execute('SELECT data FROM inspection_items WHERE id=? AND system_id=?',(issue_id,system_id)).fetchone()
            if not row: raise KeyError(issue_id)
            item=json.loads(row[0]); return self.queue_advice(db,item,manual)

    def queue_advice(self,db,item,manual=False):
        if db.execute("SELECT count(*) FROM inspection_advice WHERE state IN ('QUEUED','RUNNING')").fetchone()[0]>=16: return 'BUSY'
        evidence={k:item.get(k) for k in ('node_id','component','rule','severity','facts','evidence','fingerprint','recurrences')}
        pending=db.execute("SELECT id FROM inspection_advice WHERE issue_id=? AND state='QUEUED'",(item['id'],)).fetchone()
        if pending:
            # Coalesce to the newest evidence, without an unbounded per-issue backlog.
            db.execute('UPDATE inspection_advice SET data=? WHERE id=?',(encode(evidence),pending['id']))
            return 'PENDING'
        aid=key(item['id'],evidence,time.time() if manual else None)
        db.execute("INSERT OR IGNORE INTO inspection_advice VALUES(?,?,?,'QUEUED',?)",(aid,item['system_id'],item['id'],encode(evidence)))
        return 'QUEUED'


class InspectionEvaluator:
    def __init__(self,store,now=time.time): self.store=store; self.now=now

    def evaluate(self,system_id,observations,coverage=(),cycle_context=(),secrets=(),source_cursors=None):
        at=self.now(); secrets=(*environment_secrets(),*secrets)
        with self.store.tx() as db:
            system=self.store.system(system_id,db); config=system['config']; suppressed=[]
            for obs in sorted(observations,key=lambda o:o.get('sample_at',0)):
                ts=obs.get('sample_at')
                if type(ts) not in {int,float} or not math.isfinite(ts) or ts>at or ts<at-config['stale_seconds']: continue
                if not obs.get('node_id') or not obs.get('rule') or not obs.get('component'): continue
                iid=key(obs['node_id'],obs['component'],obs['rule'])
                state_row=db.execute('SELECT data FROM inspection_samples WHERE id=?',(iid,)).fetchone()
                state=json.loads(state_row[0]) if state_row else dict(last=-1,high_since=None,healthy_count=0)
                # Event identity includes generation + native cursor; repeated reads never count twice.
                event=obs.get('event_id')
                if event:
                    eid=key(obs['node_id'],obs.get('source'),obs.get('generation'),event)
                    if db.execute('SELECT 1 FROM inspection_events WHERE id=?',(eid,)).fetchone(): continue
                    db.execute('INSERT INTO inspection_events VALUES(?,?)',(eid,iid))
                elif ts<=state['last']: continue
                if ts<state['last']: continue
                if state['last']>=0 and ts-state['last']>config['stale_seconds']:
                    state.update(high_since=None,healthy_count=0)
                state['last']=ts
                row=db.execute('SELECT data FROM inspection_items WHERE id=?',(iid,)).fetchone()
                item=json.loads(row[0]) if row else None
                expected=any(c.get('node_id')==obs['node_id'] and c.get('phase') in {'WAITING_OFFLINE','WAITING_RECOVERY'} and c.get('started_at',at+1)<=ts<=c.get('deadline',0) for c in cycle_context)
                if obs['rule']=='connectivity.lost' and expected:
                    suppressed.append(dict(node_id=obs['node_id'],reason='EXPECTED_CYCLE_OFFLINE'))
                    continue
                kind=obs.get('kind')
                if kind=='utilization':
                    metric=obs.get('metric'); value=obs.get('value'); threshold=config['thresholds'].get(metric)
                    if threshold is None or type(value) not in {int,float} or not math.isfinite(value) or not 0<=value<=100: continue
                    active=value>=threshold; healthy=value<=threshold-config['hysteresis']; severity='WARNING'
                    if active and state['high_since'] is None: state['high_since']=ts
                    if not active: state['high_since']=None
                    active=active and ts-state['high_since']>=config['duration_seconds']
                    facts=f'{metric}: {value:g}% · 警告門檻 {threshold:g}% · 高使用率可能與測試負載相關'
                elif kind=='explicit_failure' and event and obs.get('verified_rule'):
                    active=True; healthy=False; severity='FAIL'; facts=obs.get('message','已保存的規則判定異常')
                elif kind=='verified_recovery' and obs.get('verified_rule'):
                    active=False; healthy=True; severity='FAIL'; facts='新的檢查證據符合恢復條件'
                else: continue
                state['healthy_count']=state['healthy_count']+1 if healthy else 0
                if active:
                    previous_evidence=(item.get('evidence'),item.get('fingerprint')) if item else None
                    transition=None
                    if not item:
                        item=dict(id=iid,system_id=system_id,node_id=obs['node_id'],component=obs['component'],rule=obs['rule'],first_seen_at=ts,observations=0,recurrences=0,acknowledged=False,known_issue=False,mute_until=0)
                        transition='OPENED'
                    elif item['status']=='RECOVERED':
                        transition='REOPENED'; item['recurrences']+=1
                    elif item['severity']=='WARNING' and severity=='FAIL': transition='ESCALATED'
                    elif item['severity']=='FAIL': severity='FAIL'
                    item.update(status='ACTIVE',severity=severity,last_seen_at=ts,resolved_at=None,
                                facts=redact(facts,secrets,1000),source=obs.get('source'),
                                evidence=redact(obs.get('evidence',''),secrets,1000),
                                evidence_ref=obs.get('evidence_ref'),fingerprint=obs.get('fingerprint'),observations=item['observations']+1)
                    if transition:
                        self.store.change(db,item,transition,ts,{k:item.get(k) for k in ('facts','severity','evidence','evidence_ref','fingerprint')})
                    elif severity=='FAIL' and previous_evidence!=(item['evidence'],item['fingerprint']):
                        self.store.change(db,item,'EVIDENCE_UPDATED',ts,{k:item.get(k) for k in ('facts','evidence','evidence_ref','fingerprint')})
                    if config['ai_enabled'] and severity=='FAIL' and (transition or previous_evidence!=(item['evidence'],item['fingerprint'])):
                        self.store.queue_advice(db,item)
                elif item and item['status']=='ACTIVE' and healthy and state['healthy_count']>=config['recovery_samples']:
                    item.update(status='RECOVERED',resolved_at=ts)
                    self.store.change(db,item,'RECOVERED',ts,{'facts':facts})
                if item: db.execute('INSERT OR REPLACE INTO inspection_items VALUES(?,?,?)',(iid,system_id,encode(item)))
                db.execute('INSERT OR REPLACE INTO inspection_samples VALUES(?,?,?)',(iid,system_id,encode(state)))
            if source_cursors is not None: system['source_cursors']=source_cursors
            system.update(last_completed_at=at,next_due=at+config['interval_seconds'],coverage=list(coverage),suppressed=suppressed,error=None)
            self.store.save_system(db,system)
        return self.store.summary(system_id)
