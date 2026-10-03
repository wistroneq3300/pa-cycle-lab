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
                deep_seconds=600, sensor_seconds=300, firmware_seconds=1800,
                readiness_seconds=600, retention_days=30,
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
            limits={'interval_seconds':(30,3600),'duration_seconds':(0,3600),'recovery_samples':(1,20),'stale_seconds':(30,3600),'hysteresis':(1,30),
                    'deep_seconds':(60,86400),'sensor_seconds':(30,86400),'firmware_seconds':(60,604800),'readiness_seconds':(30,3600),'retention_days':(1,365)}
            lo,hi=limits[name]
            if type(value) is not int or not lo<=value<=hi: raise ValueError(name+' 超出允許範圍')
        result[name]=value
    return result


class InspectionStore:
    def __init__(self,path):
        self.path=Path(path); self.path.parent.mkdir(parents=True,exist_ok=True)
        with self.tx() as db:
            previous_version=db.execute('PRAGMA user_version').fetchone()[0]
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
                CREATE TABLE IF NOT EXISTS inspection_snapshots(id TEXT PRIMARY KEY,system_id TEXT NOT NULL,node_id TEXT NOT NULL,collected_at REAL NOT NULL,data TEXT NOT NULL);
                CREATE INDEX IF NOT EXISTS inspection_snapshots_system ON inspection_snapshots(system_id,collected_at);
                CREATE TABLE IF NOT EXISTS inspection_nodes(id TEXT PRIMARY KEY,system_id TEXT NOT NULL,data TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS inspection_progress(system_id TEXT NOT NULL,node_id TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(system_id,node_id));
            ''')
            columns={r[1] for r in db.execute('PRAGMA table_info(inspection_advice)')}
            for name,spec in [('priority','INTEGER NOT NULL DEFAULT 1'),('created_at','REAL NOT NULL DEFAULT 0'),('worker_slot','INTEGER')]:
                if name not in columns: db.execute(f'ALTER TABLE inspection_advice ADD COLUMN {name} {spec}')
            # Older single-worker jobs had no slot. They are advisory and can be
            # retried after migration; device operations are never involved.
            db.execute("UPDATE inspection_advice SET state='QUEUED' WHERE state='RUNNING' AND worker_slot IS NULL")
            if previous_version<3:
                # Keep legacy records, but only the newest pending analysis per
                # issue is eligible. This migration never removes issue history.
                pending=db.execute("SELECT id,issue_id FROM inspection_advice WHERE state='QUEUED' ORDER BY rowid DESC").fetchall()
                seen=set()
                for row in pending:
                    if row['issue_id'] in seen: db.execute("UPDATE inspection_advice SET state='SUPERSEDED' WHERE id=?",(row['id'],))
                    seen.add(row['issue_id'])
                db.execute("UPDATE inspection_advice SET priority=0 WHERE issue_id IN (SELECT id FROM inspection_items WHERE json_extract(data,'$.severity')='FAIL')")
            db.execute('CREATE INDEX IF NOT EXISTS inspection_advice_pending ON inspection_advice(state,priority,created_at)')
            db.execute('PRAGMA user_version=3')

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
        item=json.loads(row[0]) if row else dict(id=system_id,config=copy.deepcopy(DEFAULTS),last_completed_at=None,next_due=0,coverage=[])
        item['config']={**copy.deepcopy(DEFAULTS),**item['config']}
        return item

    def node_state(self,system_id):
        with self.tx(False) as db:
            return {r['id']:json.loads(r['data']) for r in db.execute('SELECT id,data FROM inspection_nodes WHERE system_id=?',(system_id,))}

    def progress(self,system_id,node_id,data):
        with self.tx() as db:
            db.execute('INSERT OR REPLACE INTO inspection_progress VALUES(?,?,?)',(system_id,node_id,encode(data)))

    def snapshot_record(self,system_id,snapshot_id):
        with self.tx(False) as db:
            row=db.execute('SELECT data FROM inspection_snapshots WHERE id=? AND system_id=?',(snapshot_id,system_id)).fetchone()
            if not row: raise KeyError(snapshot_id)
            return json.loads(row[0])

    def prune(self,system_id,evidence_root,now):
        """Bounded retention; evidence referenced by issue/history is pinned."""
        root=Path(evidence_root).resolve(); removed=[]
        with self.tx() as db:
            config=self.system(system_id,db)['config']; cutoff=now-config['retention_days']*86400
            rows=db.execute('''SELECT id,data FROM inspection_snapshots WHERE system_id=? AND collected_at<?
                AND id NOT IN (SELECT json_extract(data,'$.evidence_ref.snapshot_id') FROM inspection_items WHERE system_id=? AND json_extract(data,'$.evidence_ref.snapshot_id') IS NOT NULL)
                AND id NOT IN (SELECT json_extract(data,'$.evidence_ref.snapshot_id') FROM inspection_changes WHERE system_id=? AND json_extract(data,'$.evidence_ref.snapshot_id') IS NOT NULL)
                ORDER BY collected_at LIMIT 200''',(system_id,cutoff,system_id,system_id)).fetchall()
            pinned={v.get('evidence_ref',{}).get('snapshot_id') for r in db.execute('SELECT data FROM inspection_nodes WHERE system_id=?',(system_id,))
                    for v in json.loads(r[0]).get('sources',{}).values()}
            # Analysis keeps the exact evidence it used, including older versions.
            for row in db.execute('SELECT data FROM inspection_advice WHERE system_id=?',(system_id,)):
                advice=json.loads(row[0])
                for basis in (advice.get('input',{}),advice.get('next_input',{}),advice.get('outcome',{}).get('based_on',{})):
                    pinned.add((basis.get('evidence_ref') or {}).get('snapshot_id'))
            for row in rows:
                if row['id'] in pinned: continue
                removed.append(json.loads(row['data'])['raw_evidence'])
                db.execute('DELETE FROM inspection_snapshots WHERE id=?',(row['id'],))
            # Several judgments can reference one acquisition, without copying it.
            removed=[rel for rel in set(removed) if not db.execute("SELECT 1 FROM inspection_snapshots WHERE json_extract(data,'$.raw_evidence')=? LIMIT 1",(rel,)).fetchone()]
        for rel in removed:
            path=(root/rel).resolve()
            if path.is_relative_to(root): path.unlink(missing_ok=True)
        return len(removed)

    def save_system(self,db,item):
        db.execute('INSERT OR REPLACE INTO inspection_systems VALUES(?,?)',(item['id'],encode(item)))

    def configure(self,system_id,changes,actor,now=None):
        at=time.time() if now is None else now
        with self.tx() as db:
            item=self.system(system_id,db); item['config']=validate_config(item['config'],changes)
            item.update(configured_by=str(actor),configured_at=at,next_due=at+int(key(system_id)[:4],16)%15)
            self.save_system(db,item)
            if item['config']['ai_enabled']: self.backfill_advice(db,system_id)
        return item

    def enabled(self):
        with self.tx(False) as db:
            return [json.loads(r[0]) for r in db.execute("SELECT data FROM inspection_systems WHERE json_extract(data,'$.config.enabled')=1")]

    def archive_recovered(self,now):
        with self.tx() as db:
            rows=db.execute("SELECT data FROM inspection_items WHERE json_extract(data,'$.status')='RECOVERED' AND json_extract(data,'$.resolved_at')<? LIMIT 500",(now-7*86400,)).fetchall()
            for row in rows:
                item=json.loads(row[0]); item.update(status='ARCHIVED',archived_at=now)
                db.execute('UPDATE inspection_items SET data=? WHERE id=?',(encode(item),item['id']))
                self.change(db,item,'ARCHIVED',now,{'resolved_at':item['resolved_at']})

    def backfill_advice(self,db,system_id):
        # Re-queue active issues with no structured result: never analysed, or
        # analysed by an older revision that only stored free text (COMPLETE with
        # no result). Failed analyses are left alone so they are not retried in a loop.
        rows=db.execute("SELECT data FROM inspection_items WHERE system_id=? AND json_extract(data,'$.status')='ACTIVE' "
                        "AND (json_extract(data,'$.analysis.state') IS NULL "
                        "OR json_extract(data,'$.analysis.state')='NOT_REQUESTED' "
                        "OR (json_extract(data,'$.analysis.state')='COMPLETE' AND json_extract(data,'$.analysis.result') IS NULL)) LIMIT 100",(system_id,)).fetchall()
        for row in rows: self.queue_advice(db,json.loads(row[0]))

    def issues(self,system_id,limit=100,offset=0,status='all',node_id='',search=''):
        where='system_id=?'; args=[system_id]
        if status=='current': where+=" AND json_extract(data,'$.status') IN ('ACTIVE','RECOVERED')"
        elif status in ('ACTIVE','RECOVERED','ARCHIVED'): where+=" AND json_extract(data,'$.status')=?";args.append(status)
        if node_id:
            where+=" AND (json_extract(data,'$.node_id')=? OR EXISTS(SELECT 1 FROM json_each(json_extract(data,'$.affected_nodes')) WHERE value=?))";args.extend([node_id,node_id])
        if search:
            where+=" AND (json_extract(data,'$.facts') LIKE ? OR json_extract(data,'$.component') LIKE ? OR json_extract(data,'$.rule') LIKE ?)";args.extend(['%'+search[:200]+'%']*3)
        with self.tx(False) as db:
            rows=db.execute("SELECT data FROM inspection_items WHERE "+where+" ORDER BY json_extract(data,'$.status') ASC,json_extract(data,'$.last_seen_at') DESC LIMIT ? OFFSET ?",(*args,limit,offset)).fetchall()
        return [json.loads(r[0]) for r in rows]

    def summary(self,system_id):
        with self.tx(False) as db:
            item=self.system(system_id,db)
            counts=db.execute("SELECT json_extract(data,'$.severity') severity,count(*) n FROM inspection_items WHERE system_id=? AND json_extract(data,'$.status')='ACTIVE' GROUP BY severity",(system_id,)).fetchall()
            item['summary']={'fail':0,'warning':0}
            for row in counts: item['summary']['fail' if row['severity']=='FAIL' else 'warning']=row['n']
            item['lifecycle_counts']={}
            for state in ('RECOVERED','ARCHIVED'):
                item['lifecycle_counts'][state.lower()]=db.execute("SELECT count(*) FROM inspection_items WHERE system_id=? AND json_extract(data,'$.status')=?",(system_id,state)).fetchone()[0]
            item['progress']=[dict(node_id=r['node_id'],**json.loads(r['data'])) for r in db.execute('SELECT node_id,data FROM inspection_progress WHERE system_id=?',(system_id,))]
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
        from .inspection_advice import queue
        return queue(self,db,item,manual)


class InspectionEvaluator:
    def __init__(self,store,now=time.time): self.store=store; self.now=now

    def evaluate(self,system_id,observations,coverage=(),cycle_context=(),secrets=(),source_cursors=None,batch=None):
        at=self.now(); secrets=(*environment_secrets(),*secrets)
        with self.store.tx() as db:
            system=self.store.system(system_id,db); config=system['config']; suppressed=[]
            for obs in sorted(observations,key=lambda o:o.get('sample_at',0)):
                ts=obs.get('sample_at')
                event=obs.get('event_id')
                if type(ts) not in {int,float} or not math.isfinite(ts) or ts>at or (not event and ts<at-obs.get('freshness_seconds',config['stale_seconds'])): continue
                if not obs.get('node_id') or not obs.get('rule') or not obs.get('component'): continue
                parts=[obs['node_id'],obs['component'],obs['rule']]
                if obs.get('identity_version'): parts.extend([obs['identity_version'],obs.get('fingerprint') if event else None])
                iid=key(*parts)
                state_row=db.execute('SELECT data FROM inspection_samples WHERE id=?',(iid,)).fetchone()
                state=json.loads(state_row[0]) if state_row else dict(last=-1,high_since=None,healthy_count=0)
                # Event identity includes generation + native cursor; repeated reads never count twice.
                event=obs.get('event_id')
                if event:
                    eid=key(obs['node_id'],obs.get('source'),obs.get('generation'),event)
                    if db.execute('SELECT 1 FROM inspection_events WHERE id=?',(eid,)).fetchone(): continue
                    db.execute('INSERT INTO inspection_events VALUES(?,?)',(eid,iid))
                elif ts<=state['last']: continue
                if not event and ts<state['last']: continue
                if state['last']>=0 and ts-state['last']>obs.get('freshness_seconds',config['stale_seconds']):
                    state.update(high_since=None,healthy_count=0)
                state['last']=max(state['last'],ts)
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
                elif kind in {'finding','state'} and obs.get('verified_rule'):
                    verdict=obs.get('severity')
                    active=verdict in {'FAIL','WARN','WARNING'}
                    healthy=kind=='state' and verdict=='PASS' and obs.get('recovery_supported',False)
                    severity='FAIL' if verdict=='FAIL' else 'WARNING'
                    facts=obs.get('message','規則判定')
                elif kind=='verified_recovery' and obs.get('verified_rule'):
                    active=False; healthy=True; severity='FAIL'; facts='新的檢查證據符合恢復條件'
                else: continue
                state['healthy_count']=state['healthy_count']+1 if healthy else 0
                if active:
                    previous_evidence=(item.get('facts'),item.get('fingerprint')) if item else None
                    transition=None
                    if not item:
                        item=dict(id=iid,system_id=system_id,node_id=obs['node_id'],component=obs['component'],rule=obs['rule'],first_seen_at=ts,observations=0,recurrences=0,acknowledged=False,known_issue=False,mute_until=0)
                        transition='OPENED'
                    elif item['status'] in ('RECOVERED','ARCHIVED'):
                        transition='REOPENED'; item['recurrences']+=1
                    elif item['severity']=='WARNING' and severity=='FAIL': transition='ESCALATED'
                    elif item['severity']=='FAIL': severity='FAIL'
                    item.update(status='ACTIVE',severity=severity,last_seen_at=max(ts,item.get('last_seen_at',ts)),resolved_at=None,
                                facts=redact(facts,secrets,1000),source=obs.get('source'),observation_kind=kind,
                                evidence=redact(obs.get('evidence',''),secrets,1000),
                                evidence_ref=obs.get('evidence_ref'),fingerprint=obs.get('fingerprint'),observations=item['observations']+1)
                    item.update(occurrences=item.get('occurrences',0)+(1 if event and obs.get('countable',True) else 0),source_time=obs.get('source_time'),
                                occurrence_precision=obs.get('occurrence_precision'),
                                historical=obs.get('historical',False),affected_nodes=obs.get('affected_nodes',[]),
                                rule_version=obs.get('identity_version'),native_severity=obs.get('native_severity'))
                    if transition:
                        self.store.change(db,item,transition,ts,{k:item.get(k) for k in ('facts','severity','evidence','evidence_ref','fingerprint')})
                    elif event:
                        self.store.change(db,item,'OCCURRED',ts,dict(event_id=event,source_time=obs.get('source_time'),
                            evidence=item.get('evidence'),evidence_ref=item.get('evidence_ref'),facts=item.get('facts')))
                    elif severity=='FAIL' and previous_evidence!=(item['facts'],item['fingerprint']):
                        self.store.change(db,item,'EVIDENCE_UPDATED',ts,{k:item.get(k) for k in ('facts','evidence','evidence_ref','fingerprint')})
                    if config['ai_enabled'] and (transition or previous_evidence!=(item['facts'],item['fingerprint']) or not item.get('analysis')):
                        self.store.queue_advice(db,item)
                elif item and item['status']=='ACTIVE' and healthy and state['healthy_count']>=config['recovery_samples']:
                    item.update(status='RECOVERED',resolved_at=ts)
                    self.store.change(db,item,'RECOVERED',ts,{'facts':facts})
                if item: db.execute('INSERT OR REPLACE INTO inspection_items VALUES(?,?,?)',(iid,system_id,encode(item)))
                db.execute('INSERT OR REPLACE INTO inspection_samples VALUES(?,?,?)',(iid,system_id,encode(state)))
            if source_cursors is not None: system['source_cursors']=source_cursors
            if batch:
                for snapshot in batch.get('snapshots',[]):
                    db.execute('INSERT INTO inspection_snapshots VALUES(?,?,?,?,?)',(snapshot['snapshot_id'],system_id,snapshot['node_id'],snapshot['collected_at'],encode(snapshot)))
                for nid,state in batch.get('states',{}).items():
                    db.execute('INSERT OR REPLACE INTO inspection_nodes VALUES(?,?,?)',(nid,system_id,encode(state)))
                system.update(batch.get('summary',{}))
                db.execute('DELETE FROM inspection_progress WHERE system_id=?',(system_id,))
            cadence=min(config[k] for k in ('interval_seconds','sensor_seconds','deep_seconds','firmware_seconds'))
            system.update(last_completed_at=at,next_due=system.get('source_next_due',at+cadence) if batch else at+cadence,coverage=list(coverage),suppressed=suppressed,error=None)
            self.store.save_system(db,system)
        return self.store.summary(system_id)
