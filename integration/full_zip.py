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


class FullZipService:
    def __init__(self,store,artifacts):
        self.store=store;self.artifacts=Path(artifacts);self.output=self.artifacts/'.full-zips'
        self.output.mkdir(parents=True,exist_ok=True)
        self.pool=ThreadPoolExecutor(max_workers=1,thread_name_prefix='cycle-full-zip')
        self.guard=threading.Lock();self.active={}

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

    def request(self,job,confirm=False):
        state=job.get('state')
        if state in REVIEW and not confirm: raise ValueError('此任務狀態需確認資料一致性後才能準備 Full ZIP。')
        if state not in ALLOWED|REVIEW:
            if state=='STOP_REQUESTED': raise ValueError('任務正在安全收尾，尚不能準備 Full ZIP。')
            raise ValueError('僅 COMPLETE／INCOMPLETE 或已確認的異常終態可下載 Full ZIP。')
        root=self.artifacts/job['id']
        if not root.is_dir(): raise ValueError('此任務尚無可交付的 Artifact 目錄。')
        with self.guard:
            active=self.active.get(job['id'])
            if active and not active.done(): return self.store.export_status(job['id'])
            self.store.export_status(job['id'],{'state':'PREPARING','files_completed':0,'file_count':0,
                                                'original_size':0,'zip_size':None,'requested_at':time.time()})
            self.active[job['id']]=self.pool.submit(self._build,job['id'],root)
        return self.status(job['id'])

    def _build(self,job_id,root):
        part=self.path(job_id).with_suffix('.zip.part')
        try:
            with report_writer_lock(root,wait=True):
                if not (root/'CYCLE_REVIEW_REPORT.html').is_file():
                    raise RuntimeError('Final HTML report is not available')
                files=[path for path in sorted(root.rglob('*')) if path.is_file() and path.resolve().is_relative_to(root.resolve())
                       and deliverable(path.relative_to(root))]
                manifest=[];total=0
                for path in files:
                    relative=path.relative_to(root).as_posix();size=path.stat().st_size;total+=size
                    manifest.append({'path':relative,'size':size,'sha256':digest_file(path)})
                self.store.export_status(job_id,{'state':'COMPRESSING','file_count':len(files),'files_completed':0,
                                                 'original_size':total,'zip_size':None,'started_at':time.time()})
                with zipfile.ZipFile(part,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6,allowZip64=True) as archive:
                    for index,path in enumerate(files,1):
                        archive.write(path,path.relative_to(root).as_posix())
                        self.store.export_status(job_id,{'state':'COMPRESSING','file_count':len(files),'files_completed':index,
                                                         'original_size':total,'zip_size':None,'started_at':time.time()})
                    manifest_bytes=json.dumps({'run_id':job_id,'created_at':time.time(),'files':manifest},ensure_ascii=False,indent=2).encode('utf-8')
                    archive.writestr('FULL_ZIP_MANIFEST.json',manifest_bytes)
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
