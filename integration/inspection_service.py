"""Bounded inspection service over local, already-collected evidence."""
import copy
import json
import math
import sqlite3
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path
from contextlib import contextmanager
from .inspection import InspectionStore, InspectionEvaluator, key, encode
from .events import redact, environment_secrets


@contextmanager
def readonly(path):
    db=sqlite3.connect(Path(path).resolve().as_uri()+'?mode=ro',uri=True,timeout=2)
    db.row_factory=sqlite3.Row
    deadline=time.monotonic()+2
    db.set_progress_handler(lambda:int(time.monotonic()>deadline),1000)
    try: yield db
    finally: db.close()


class EvidenceSource:
    def __init__(self,telemetry_path,cycle_path,artifacts,mode="synthetic"):
        self.mode=mode; self.telemetry_path=Path(telemetry_path); self.cycle_path=Path(cycle_path); self.artifacts=Path(artifacts)

    def __call__(self,system,config,now):
        observations=[]; coverage=[]; config['_deadline']=time.monotonic()+10
        # Never call machine_telemetry/os_series_any: their legacy name merging cannot
        # establish which physical node produced a sample after an Active OS switch.
        for node in system['nodes']:
            nid=node['node_id']; seen=[]; latest=[]; metrics=set()
            if time.monotonic()>config['_deadline']:
                coverage.append(dict(node_id=nid,source='Telemetry',state='TIMED_OUT',detail='本輪讀取時間已用完；未讀來源不視為正常。'))
                continue
            try:
                with readonly(self.telemetry_path) as db:
                    for table in ('os_metrics','gpu_metrics'):
                        last=db.execute(f'SELECT MAX(ts) FROM {table} WHERE machine=? AND ts<=?',(nid,now)).fetchone()[0]
                        if last is not None: latest.append(last)
                        rows=db.execute(f'SELECT * FROM {table} WHERE machine=? AND ts>=? AND ts<=? ORDER BY ts DESC,id DESC LIMIT 2000',
                                        (nid,now-config['stale_seconds'],now)).fetchall()
                        for row in reversed(rows):
                            values=[('cpu','cpu',row['cpu_used']),('memory','memory',row['mem_used_pct'])] if table=='os_metrics' else [
                                ('gpu','gpu:'+str(row['gpu']),row['util']),
                                ('vram','gpu:'+str(row['gpu']),100*row['mem_used']/row['mem_total'] if row['mem_total'] and row['mem_used'] is not None else None)]
                            for metric,component,value in values:
                                if type(value) in {int,float} and math.isfinite(value) and 0<=value<=100:
                                    seen.append(row['ts']); metrics.add(metric)
                                    observations.append(dict(node_id=nid,component=component,rule=metric+'.utilization.high',metric=metric,value=value,
                                    kind='utilization',source='telemetry',sample_at=row['ts'],evidence=f'{table} row {row["id"]}'))
                coverage.append(dict(node_id=nid,label=node['label'],source='Telemetry',state='FRESH' if seen else ('INVALID' if now-max(latest)<=config['stale_seconds'] else 'STALE') if latest else 'MISSING',collected_at=max(seen) if seen else max(latest) if latest else None,
                    detail='僅採用 canonical Node ID 歷史；機台名稱下的資料無法可靠歸屬節點。' if not seen else '已涵蓋使用率：'+', '.join(sorted(metrics))+'；溫度與功耗故障未涵蓋。'))
            except (sqlite3.Error,OSError):
                coverage.append(dict(node_id=nid,label=node['label'],source='Telemetry',state='UNAVAILABLE',collected_at=None,detail='尚未取得可安全讀取的節點歷史。'))
        facts,report_coverage=self.reports(system,config,now)
        observations.extend(facts); coverage.extend(report_coverage)
        coverage.append(dict(source='Sensor／SEL／kernel log',state='NOT_COVERED',detail='即時快取缺少可靠節點身分／採集世代；不啟動額外掃描。不沿用 GPU 告警通知。'))
        return observations,coverage,[]

    def reports(self,system,config,now):
        facts=[]; coverage=[]; budget=256
        cursors=config.get('_report_cursors',{})
        # Reuse a bounded set of completed native records, never infer severity from Console prose.
        try:
            with readonly(self.cycle_path) as db:
                jobs=[json.loads(r[0]) for r in db.execute('SELECT data FROM jobs WHERE project=? ORDER BY updated DESC LIMIT 20',(system['project'],))]
        except (sqlite3.Error,OSError): return facts,[dict(source='Cycle evidence',state='NOT_COVERED',detail='沒有可讀取的既有 Cycle 證據。')]
        wanted={n['node_id'] for n in system['nodes']}
        for job in jobs:
            if job.get('mode')!=self.mode: continue
            for target in job.get('targets',[]):
                nid=target.get('node_id')
                if nid not in wanted: continue
                status=next((n for n in job.get('nodes',[]) if n.get('machine_id')==nid),{})
                # Current node status may be in the normalized table.
                try:
                    with readonly(self.cycle_path) as db:
                        row=db.execute('SELECT data FROM node_status WHERE job_id=? AND node_id=?',(job['id'],nid)).fetchone()
                        if row: status=json.loads(row[0])
                except sqlite3.Error: pass
                paths=['pre_report.json','start/report.json']
                loop=status.get('loop',0)
                cursor_key=key(job['id'],nid)
                previous=cursors.get(cursor_key,0)
                if type(loop) is int and 0<loop<10000000:
                    end=min(loop,previous+64)
                    paths.extend(f'loop{i:04d}/report.json' for i in range(previous+1,end+1))
                    if end<loop: coverage.append(dict(node_id=nid,source='Cycle evidence',state='BACKLOG',detail='分批讀取歷史證據中；尚未完成全部涵蓋。'))
                base=(self.artifacts/job['id']).resolve()
                node_key=target.get('tray','')+'_'+target.get('node','')
                for tail in paths:
                    if budget<=0 or time.monotonic()>config.get('_deadline',float('inf')):
                        coverage.append(dict(node_id=nid,source='Cycle evidence',state='BACKLOG',detail='本輪讀取額度已用完；其餘證據留待後續巡檢。'))
                        break
                    budget-=1
                    path=(base/node_key/tail).resolve()
                    if not base.is_relative_to(self.artifacts.resolve()) or not path.is_relative_to(base): continue
                    try:
                        if path.stat().st_size>1024*1024: continue
                        record=json.loads(path.read_text(encoding='utf-8'))
                        if not record.get('finished'): continue
                        if tail.startswith('loop'): cursors[cursor_key]=int(tail.split('/')[0][4:])
                        stamp=datetime.fromisoformat(record['finished']).timestamp()
                        if not now-config['stale_seconds']<=stamp<=now: continue
                    except (OSError,ValueError,TypeError): continue
                    coverage.append(dict(node_id=nid,source='Cycle evidence',state='FRESH',collected_at=stamp,detail='已完成的 PRE／START／POST 核心日誌錯誤判定；未重新執行測試。其他檢查尚未納入巡檢規則。'))
                    for issue in record.get('issues',[]):
                        code=str(issue.get('code',''))
                        # Collection/auth/script errors are coverage, not hardware failures.
                        explicit=code.startswith('DMESG_') and bool(issue.get('fingerprint'))
                        # Shared BMC/SEL and ambiguous collection errors are not attributed to OS nodes.
                        if not explicit or issue.get('severity')!='FAIL': continue
                        facts.append(dict(node_id=nid,component=issue.get('component','hardware'),rule=code,kind='explicit_failure',verified_rule=True,
                            event_id=key(issue.get('fingerprint'),code,issue.get('component')),generation=issue.get('boot_id') or record.get('identities',{}).get('os',{}).get('boot_id') or job['id'],source='Cycle evidence',
                            evidence_ref={'run_id':job['id'],'record':tail},sample_at=stamp,fingerprint=issue.get('fingerprint'),message=issue.get('detail',code),evidence=str(path.relative_to(self.artifacts.resolve()))))
        if not coverage: coverage=[dict(source='Cycle evidence',state='NOT_COVERED',detail='目前沒有新的、可歸屬此系統的已完成檢查證據。')]
        return facts,coverage


class InspectionService:
    def __init__(self,path,systems,source,ai=None,clock=time.time,secrets=lambda:()):
        self.store=InspectionStore(path); self.systems=systems; self.source=source; self.ai=ai; self.clock=clock; self.secrets=secrets
        self._guard=threading.Lock(); self._active={}; self._stop=threading.Event(); self._threads=[]; self.closed=False
        self.pool=ThreadPoolExecutor(max_workers=2,thread_name_prefix='inspection')

    def resolve(self,name):
        matches=[s for s in self.systems() if s['name']==name]
        if len(matches)!=1: raise KeyError(name)
        return matches[0]

    def snapshot(self,name):
        system=self.resolve(name); result=self.store.summary(system['id'])
        result.update(name=name,project=system['project'],nodes=system['nodes'])
        for entry in result.get('coverage',[]):
            if entry.get('collected_at') is not None:
                entry['age_seconds']=max(0,self.clock()-entry['collected_at'])
                if entry.get('state')=='FRESH' and entry['age_seconds']>result['config']['stale_seconds']: entry['state']='STALE'
        with self._guard:
            active=self._active.get(system['id'])
            result['running']=bool(active and not active[0].done())
            result['delayed']=bool(result['running'] and self.clock()-active[1]>10)
        return result

    def submit(self,name,scheduled=False):
        system=self.resolve(name); sid=system['id']
        with self._guard:
            self._active={k:v for k,v in self._active.items() if not v[0].done()}
            if sid in self._active: return 'RUNNING'
            if len(self._active)>=2: return 'BUSY'
            future=self.pool.submit(self.run,system,scheduled); self._active[sid]=(future,self.clock())
        return 'ACCEPTED'

    def run(self,system,scheduled=False):
        from .runner import process_lock
        sid=system['id']; lock=self.store.path.parent/'inspection-locks'/key(sid)
        try:
            with process_lock(lock):
                saved=self.store.system(sid); config=saved['config']
                if scheduled and (not config['enabled'] or saved['next_due']>self.clock()): return None
                config['_report_cursors']=copy.deepcopy(saved.get('source_cursors',{}))
                observations,coverage,context=self.source(system,config,self.clock())
                return InspectionEvaluator(self.store,self.clock).evaluate(sid,observations,coverage,context,self.secrets(),source_cursors=config['_report_cursors'])
        except (OSError,sqlite3.Error):
            return None  # another process is still evaluating or persistence unavailable
        except Exception as exc:
            with self.store.tx() as db:
                item=self.store.system(sid,db)
                item.update(error='巡檢來源無法完成：'+type(exc).__name__,next_due=self.clock()+item['config']['interval_seconds'])
                self.store.save_system(db,item)
            return None

    def tick(self):
        enabled={s['id']:s for s in self.store.enabled()}
        for system in self.systems():
            saved=enabled.get(system['id'])
            if saved and saved['next_due']<=self.clock(): self.submit(system['name'],scheduled=True)

    def ai_once(self):
        if self.ai is None: return
        from .runner import process_lock
        try:
            with process_lock(self.store.path.parent/'inspection-ai.lock'):
                with self.store.tx() as db:
                    # A dead AI process may leave RUNNING; analysis has no device side effects.
                    db.execute("UPDATE inspection_advice SET state='UNAVAILABLE' WHERE state='RUNNING'")
                    row=db.execute("SELECT * FROM inspection_advice WHERE state='QUEUED' ORDER BY rowid LIMIT 1").fetchone()
                    if not row: return
                    db.execute("UPDATE inspection_advice SET state='RUNNING' WHERE id=?",(row['id'],))
                try:
                    answer=redact(self.ai(row['data']),(*environment_secrets(),*self.secrets()),4000)
                    state='COMPLETE'
                except Exception: answer='AI 暫時無法使用；規則判定與證據仍保留。'; state='UNAVAILABLE'
                with self.store.tx() as db:
                    db.execute('UPDATE inspection_advice SET state=?,data=? WHERE id=?',(state,encode({'text':answer,'label':'可能原因／待確認'}),row['id']))
                    itemrow=db.execute('SELECT data FROM inspection_items WHERE id=?',(row['issue_id'],)).fetchone()
                    if itemrow:
                        item=json.loads(itemrow[0]); item['analysis']={'state':state,'text':answer,'label':'可能原因／待確認',
                            'based_on':json.loads(row['data']),'completed_at':self.clock()}
                        db.execute('UPDATE inspection_items SET data=? WHERE id=?',(encode(item),row['issue_id']))
        except OSError: return

    def start(self):
        if self._threads: return
        def loop(callback):
            while not self._stop.wait(1):
                try: callback()
                except Exception: pass
        self._threads=[threading.Thread(target=loop,args=(f,),daemon=True) for f in (self.tick,self.ai_once)]
        for thread in self._threads: thread.start()

    def close(self):
        self.closed=True
        self._stop.set()
        for thread in self._threads: thread.join(timeout=2)
        self.pool.shutdown(wait=False,cancel_futures=True)
