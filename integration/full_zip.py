"""Independent, persistent Full Run ZIP preparation; never runs in a Cycle worker."""
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import threading
import time
import zipfile

try:
    from cycle_storage import report_writer_lock
except ModuleNotFoundError:  # Direct module tests do not preload integration.settings.
    from engine.vera_cycle.cycle_storage import report_writer_lock


ALLOWED={'COMPLETE','INCOMPLETE'}
REVIEW={'ERROR','RECONCILIATION_REQUIRED'}
BUSY={'PREPARING','COMPRESSING'}


def deliverable(path):
    parts=Path(path).parts
    forbidden=('credential','password','secret','private_key','id_rsa','id_ed25519')
    return bool(parts) and not any(part.startswith('.') or any(word in part.lower() for word in forbidden) for part in parts) \
        and Path(path).suffix.lower() not in {'.lock','.tmp','.part','.zip'}


def digest_file(path):
    digest=hashlib.sha256()
    with Path(path).open('rb') as source:
        for chunk in iter(lambda:source.read(1024*1024),b''): digest.update(chunk)
    return digest.hexdigest()


def file_signature(path):
    stat=Path(path).stat()
    return stat.st_size,stat.st_mtime_ns


def read_final_object(path,label):
    try: value=json.loads(Path(path).read_text(encoding='utf-8'))
    except (OSError,ValueError,UnicodeError) as exc: raise ValueError(label+' 無法一致讀取。') from exc
    if not isinstance(value,dict): raise ValueError(label+' 格式無效。')
    return value


def default_worker_active(job_id):
    from .runner import alive
    return alive(job_id)


class FullZipService:
    def __init__(self,store,artifacts,worker_active=None):
        self.store=store;self.artifacts=Path(artifacts);self.output=self.artifacts/'.full-zips'
        self.output.mkdir(parents=True,exist_ok=True)
        self.pool=ThreadPoolExecutor(max_workers=1,thread_name_prefix='cycle-full-zip')
        self.guard=threading.Lock();self.active={};self.worker_active=worker_active or default_worker_active

    def status(self,job_id):
        record=self.store.export_status(job_id)
        if not record: return {'job_id':job_id,'state':'NOT_REQUESTED'}
        if record.get('state')=='READY' and not self.path(job_id).is_file():
            return self.store.export_status(job_id,{'state':'FAILED','error':'ZIP 檔案已不存在，請重新準備。'})
        if record.get('state') in BUSY:
            with self.guard: active=self.active.get(job_id)
            if not active or active.done():
                return self.store.export_status(job_id,{'state':'FAILED','error':'ZIP 準備工作已中斷，可重新嘗試。'})
        return record

    def path(self,job_id):
        return self.output/(job_id+'.zip')

    def validate_ready(self,job,root):
        try: active=self.worker_active(job['id'])
        except Exception as exc: raise ValueError('無法確認 Runner 已停止，拒絕準備 Full ZIP。') from exc
        if active: raise ValueError('Runner 仍在執行或持有任務鎖，不能準備 Full ZIP。')
        report=root/'CYCLE_REVIEW_REPORT.html'
        if not report.is_file() or report.stat().st_size==0: raise ValueError('Final HTML report 尚未完成。')
        if job.get('state') not in REVIEW: return
        campaign=read_final_object(root/'campaign.json','campaign.json')
        final=read_final_object(root/'job_final.json','job_final.json')
        state=job['state']
        if campaign.get('state')!=state or final.get('state')!=state:
            raise ValueError('異常終態與 final snapshots 不一致，拒絕正式封存。')
        if final.get('id')!=job['id']:
            raise ValueError('Job ID 與 job_final.json 不一致，拒絕正式封存。')
        if job.get('run_id') and campaign.get('run_id')!=job['run_id']:
            raise ValueError('Run ID 與 campaign.json 不一致，拒絕正式封存。')
        evidence=any(path.is_file() and len(path.relative_to(root).parts)>1 and deliverable(path.relative_to(root))
                     for path in root.rglob('*'))
        if not evidence: raise ValueError('異常終態缺少可驗證的 Run Evidence，拒絕正式封存。')

    def request(self,job,confirm=False):
        state=job.get('state')
        if state in REVIEW and not confirm: raise ValueError('此任務狀態需確認資料一致性後才能準備 Full ZIP。')
        if state not in ALLOWED|REVIEW:
            if state=='STOP_REQUESTED': raise ValueError('任務正在安全收尾，尚不能準備 Full ZIP。')
            raise ValueError('僅 COMPLETE／INCOMPLETE 或已確認的異常終態可下載 Full ZIP。')
        root=self.artifacts/job['id']
        if not root.is_dir(): raise ValueError('此任務尚無可交付的 Artifact 目錄。')
        try:
            with report_writer_lock(root): self.validate_ready(job,root)
        except RuntimeError as exc:
            raise ValueError('Report Writer 仍在寫入或狀態無法確認，不能準備 Full ZIP。') from exc
        with self.guard:
            active=self.active.get(job['id'])
            if active and not active.done(): return self.store.export_status(job['id'])
            self.store.export_status(job['id'],{'state':'PREPARING','files_completed':0,'file_count':0,
                                                'original_size':0,'zip_size':None,'requested_at':time.time()})
            self.active[job['id']]=self.pool.submit(self._build,dict(job),root)
        return self.status(job['id'])

    def _build(self,job,root):
        job_id=job['id']
        part=self.path(job_id).with_suffix('.zip.part')
        try:
            with report_writer_lock(root,wait=True):
                self.validate_ready(job,root)
                files=[path for path in sorted(root.rglob('*')) if path.is_file() and path.resolve().is_relative_to(root.resolve())
                       and deliverable(path.relative_to(root))]
                manifest=[];total=0;signatures={}
                for path in files:
                    relative=path.relative_to(root).as_posix();before=file_signature(path);digest=digest_file(path)
                    if file_signature(path)!=before: raise RuntimeError('Evidence changed while preparing the manifest')
                    size=before[0];total+=size;signatures[path]=before
                    manifest.append({'path':relative,'size':size,'sha256':digest})
                self.store.export_status(job_id,{'state':'COMPRESSING','file_count':len(files),'files_completed':0,
                                                 'original_size':total,'zip_size':None,'started_at':time.time()})
                with zipfile.ZipFile(part,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6,allowZip64=True) as archive:
                    for index,path in enumerate(files,1):
                        if file_signature(path)!=signatures[path]: raise RuntimeError('Evidence changed before compression')
                        archive.write(path,path.relative_to(root).as_posix())
                        if file_signature(path)!=signatures[path]: raise RuntimeError('Evidence changed during compression')
                        self.store.export_status(job_id,{'state':'COMPRESSING','file_count':len(files),'files_completed':index,
                                                         'original_size':total,'zip_size':None,'started_at':time.time()})
                    manifest_bytes=json.dumps({'run_id':job_id,'created_at':time.time(),'files':manifest},ensure_ascii=False,indent=2).encode('utf-8')
                    archive.writestr('FULL_ZIP_MANIFEST.json',manifest_bytes)
                with zipfile.ZipFile(part) as archive:
                    for item in manifest:
                        digest=hashlib.sha256()
                        with archive.open(item['path']) as source:
                            for chunk in iter(lambda:source.read(1024*1024),b''): digest.update(chunk)
                        if digest.hexdigest()!=item['sha256']: raise RuntimeError('ZIP content does not match its manifest')
                part.replace(self.path(job_id));size=self.path(job_id).stat().st_size
                self.store.export_status(job_id,{'state':'READY','file_count':len(files),'files_completed':len(files),
                                                 'original_size':total,'zip_size':size,'manifest_sha256':hashlib.sha256(manifest_bytes).hexdigest(),
                                                 'ready_at':time.time()})
        except Exception as exc:
            part.unlink(missing_ok=True)
            self.store.export_status(job_id,{'state':'FAILED','error':'Full ZIP 準備失敗：'+type(exc).__name__})

    def remove(self,job_id):
        self.path(job_id).unlink(missing_ok=True)

    def close(self):
        self.pool.shutdown(wait=False,cancel_futures=True)
