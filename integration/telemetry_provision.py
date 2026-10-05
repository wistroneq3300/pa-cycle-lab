"""Optional, bounded Telemetry provisioning. Independent of browser and Cycle jobs."""
from concurrent.futures import ThreadPoolExecutor
import re
import shlex
import threading
import time
from cycle_core import Target
from validation_collectors import Collector
from validation_identity import collect_identity
from .telemetry_monitoring import register_target

UNITS=('node_exporter.service','node-exporter.service','prometheus-node-exporter.service')


def identity_reason(reason):
    """English console explanation without changing the shared Identity API."""
    reasons={
        '原設備已移除或更名，請重新確認目前目標':'The original system was removed or renamed. Confirm the current target.',
        'Chassis 身分已變更':'Chassis identity changed.',
        '原 Node 已移除，請確認實體槽位':'The original node was removed. Confirm its physical slot.',
        '連線設定版本已變更':'The endpoint binding revision changed.',
        'Node 已退役或槽位為空':'The node is retired or the slot is empty.',
        '採集期間連線設定已變更，保留原名稱':'The endpoint binding changed during collection. Stored hostname is unchanged.',
        '觀測與目前 Node／連線版本不一致':'The observation does not match the current node and binding revision.',
        '來源回報資產識別不一致':'The observed asset identity does not match this node.',
    }
    for prefix, english in (('無法取得既有資產識別以確認目標：','Expected asset identity could not be verified: '),('實體資產識別不一致：','Hardware asset identity mismatch: ')):
        if reason.startswith(prefix): return english+reason[len(prefix):]
    return reasons.get(reason,'Canonical target identity could not be confirmed. Review the node binding before retrying.')


def detection_command(port):
    return '''set -eu
printf 'PLATFORM='; . /etc/os-release; printf '%s\\n' "$ID"
test -d /run/systemd/system || { echo 'SYSTEMD=no'; exit 0; }
echo 'SYSTEMD=yes'
for u in node_exporter.service node-exporter.service prometheus-node-exporter.service; do
  if test "$(systemctl show "$u" --property=LoadState --value)" = loaded; then
    printf 'UNIT=%s\\n' "$u"
    printf 'ACTIVE='; systemctl is-active "$u" || true
    printf 'ENABLED='; systemctl is-enabled "$u" || true
    break
  fi
done
printf 'BINARY='; command -v node_exporter || command -v prometheus-node-exporter || true
printf 'VERSION='; (node_exporter --version 2>&1 || prometheus-node-exporter --version 2>&1) | head -n 1 || true
printf 'LISTENER='; ss -H -ltnp 'sport = :EXPORTER_PORT'
'''.replace('EXPORTER_PORT',str(int(port)))


def parse_detection(text):
    fields={}
    for line in text.splitlines():
        key, sep, value=line.partition('=')
        if sep and key in {'PLATFORM','SYSTEMD','UNIT','ACTIVE','ENABLED','BINARY','VERSION','LISTENER'}: fields[key]=value.strip()
    return fields


class ProvisionFailure(Exception):
    def __init__(self,message,state='ERROR'): super().__init__(message);self.state=state


class ProvisionService:
    """One owner per PA instance. SQLite work is short; IO never holds a DB lock.

    Dedicated thread workers survive browser closure, not Web process death.
    A process restart marks in-flight jobs INTERRUPTED instead of replaying them.
    Queued (never dispatched) jobs may still start after restart.
    """
    def __init__(self,store,resolve,transport,identity_sync,monitor,config,workers=2,sleep=time.sleep):
        self.store=store;self.resolve=resolve;self.transport=transport;self.identity_sync=identity_sync
        self.monitor=monitor;self.config=config;self.sleep=sleep;self.workers=workers
        self.stop_event=threading.Event();self.pool=None;self.thread=None;self.pending={};self.mutex=threading.RLock()
        self.last_health={}
        from .telemetry_charts import ChartService
        self.charts=ChartService(monitor)

    def start(self):
        with self.mutex:
            if self.thread and self.thread.is_alive(): return
            self.store.recover();self.stop_event.clear()
            self.pool=ThreadPoolExecutor(max_workers=self.workers,thread_name_prefix='telemetry-provision')
            self.thread=threading.Thread(target=self._loop,name='telemetry-scheduler',daemon=True);self.thread.start()

    def close(self):
        self.stop_event.set()
        if self.thread: self.thread.join(timeout=3)
        if self.pool: self.pool.shutdown(wait=True,cancel_futures=True)
        self.monitor.close()

    def _loop(self):
        while not self.stop_event.is_set():
            try: self.tick()
            except Exception: pass  # A DB outage must never cause an unjournaled dispatch.
            self.stop_event.wait(.5)

    def tick(self):
        with self.mutex:
            self.pending={k:v for k,v in self.pending.items() if not v.done()}
            available=self.workers-len(self.pending)
            if available<=0: return
            jobs=self.store.queued(available)
            for job in jobs:
                if self.store.claim(job['job_id']): self.pending[job['job_id']]=self.pool.submit(self.execute,job['job_id'])

    def enable(self,node_id,key,revision,scope='all'):
        if not isinstance(key,str) or not re.fullmatch(r'[A-Za-z0-9_.:-]{8,128}',key): raise ValueError('需要有效的 idempotency_key')
        target=self.resolve(node_id)
        if revision!=target['revision']: raise ValueError('節點連線設定已變更，請重新載入。')
        if not self.config.ready(): raise ValueError('請先設定 PA_PROMETHEUS_URL 與 PA_PROMETHEUS_FILE_SD。')
        return self.store.create(target,key,scope)[0]

    def binding(self,target):
        current=self.resolve(target['node_id'])
        if current['revision']!=target['revision'] or current['chassis_id']!=target['chassis_id']:
            raise ProvisionFailure('IDENTITY_REQUIRES_CONFIRMATION: Node binding changed. Installation was not continued.')

    def execute(self,job_id):
        job=self.store.get(job_id);target=None
        try:
            target=self.resolve(job['node_id'])
            if target['revision']!=job['binding'] or target['project']!=job['project']: raise ProvisionFailure('IDENTITY_REQUIRES_CONFIRMATION: Node binding changed while queued.')
            wire=self.transport(target)
            node=Target(tray=target.get('tray',''),node=target.get('node',target['node_id']),os_ip=target['os_ip'],bmc_ip=target.get('bmc_ip',''))
            self.store.step(job_id,'IDENTITY','Verifying SSH access and node identity.')
            observation=collect_identity(Collector(wire,node),target,include_bmc=False)
            if observation['os_status']!='SUCCESS':
                raise ProvisionFailure('OS identity could not be verified over SSH. Stored identity and other functions are unchanged.','UNREACHABLE')
            outcome=self.identity_sync(target,observation)
            if outcome['status']=='IDENTITY_REQUIRES_CONFIRMATION': raise ProvisionFailure('IDENTITY_REQUIRES_CONFIRMATION: '+identity_reason(outcome['reason']))
            # Auto Sync may legitimately update hostname/revision; resolve the same ID.
            current=self.resolve(job['node_id'])
            allowed=outcome.get('binding_revision',target['revision'])
            if current['revision']!=allowed: raise ProvisionFailure('IDENTITY_REQUIRES_CONFIRMATION: Node binding changed after identity synchronization.')
            target=current
            self.store.step(job_id,'IDENTITY','Node identity verified. SSH access confirmed.','PASS')
            if outcome['status']=='AUTO_SYNC': self.store.step(job_id,'IDENTITY','Hostname updated through Shared Identity Auto Sync.','INFO')
            def command(step,text,cmd,timeout=30):
                self.binding(target)
                if self.stop_event.is_set(): raise ProvisionFailure('Worker stopping. Remaining steps have not been dispatched.','INTERRUPTED')
                self.store.step(job_id,step,text)
                result=wire.ssh(node,'os',cmd,timeout,True)
                if result.code!=0:
                    state='INTERRUPTED' if result.state=='RESPONSE_LOST' else 'ERROR'
                    detail=wire.redact(result.output) if hasattr(wire,'redact') else result.output
                    raise ProvisionFailure(f'{text} failed (exit {result.code}): {detail}',state)
                return result.output
            scope=job.get('scope') or 'all'
            components=self.store.components(target['node_id'])
            exporter_version=components.get('node_exporter_version','')
            # ---- Host (Node Exporter) phase: run for scope all/host ----
            if scope in ('all','host'):
                state,detail,facts=self.execute_host(job_id,target,command)
                host_state=state;exporter_version=facts.get('VERSION','')
                merged=dict(self.store.components(target['node_id']))
                merged.update(host=host_state,prometheus=host_state,node_exporter_version=exporter_version)
                self.store.components(target['node_id'],merged)
                if scope=='host':
                    self.store.health(target,host_state,detail,job_id);self.store.finish(job_id,host_state,detail);return
            else:
                # GPU-only job: confirm host readiness live so an existing but
                # previously-recorded host is still accepted. Never installs host.
                live_state,live_detail=self.monitor.health(target)
                host_state=live_state
                if not components:
                    merged=dict(host=live_state,prometheus=live_state)
                    self.store.components(target['node_id'],merged)
            # ---- GPU (DCGM) phase: run for scope all/gpu ----
            current_components=self.store.components(target['node_id'])
            if host_state!='READY':
                # Host monitoring is a soft precondition, not a blocker: the user
                # may install GPU telemetry on its own even when host is unfinished.
                self.store.step(job_id,'GPU_VERIFY','Host telemetry is not READY; continuing with GPU telemetry as requested.','INFO')
            pending=dict(self.store.components(target['node_id']));pending['gpu']={'state':'PROVISIONING','detail':'Checking GPU telemetry','gpus':[]}
            self.store.components(target['node_id'],pending)
            from .telemetry_gpu import provision
            try:
                gpu=provision(self,target,job_id,command)
                if gpu['state']=='VERIFYING':
                    deadline=time.monotonic()+self.config.verify_seconds
                    while True:
                        self.binding(target);gpu['state'],gpu['detail']=self.monitor.gpu_health(target)
                        if gpu['state']=='READY' or time.monotonic()>=deadline: break
                        if self.stop_event.wait(self.config.poll_seconds): break
            except ProvisionFailure as exc:
                if 'IDENTITY_REQUIRES_CONFIRMATION' in str(exc) or exc.state=='INTERRUPTED': raise
                gpu=dict(state='DEGRADED',detail=self.store.clean(str(exc)),gpus=[])
            except Exception as exc:
                gpu=dict(state='DEGRADED',detail='GPU setup incomplete: '+type(exc).__name__+'. Review the manual installation guidance.',gpus=[])
            self.store.step(job_id,'GPU_VERIFY',gpu['detail'],'PASS' if gpu['state']=='READY' else 'INFO' if gpu['state']=='NOT_APPLICABLE' else 'WARN')
            merged=dict(self.store.components(target['node_id']));merged['gpu']=gpu
            self.store.components(target['node_id'],merged)
            if host_state=='READY' and gpu['state'] not in ('READY','NOT_APPLICABLE'):
                state='DEGRADED';detail='Host telemetry READY. GPU telemetry requires attention: '+gpu['detail']
            else:
                state=host_state;detail='Telemetry READY: host' + (' and GPU' if gpu['state']=='READY' else '') + ' monitoring verified.'
            self.store.health(target,state,detail,job_id);self.store.finish(job_id,state,detail)
        except ProvisionFailure as exc:
            if target: self.store.health(target,exc.state,str(exc),job_id)
            self.store.finish(job_id,exc.state,str(exc))
        except Exception as exc:
            # Never stringify an unknown command/HTTP exception with credentials.
            detail='Provisioning did not complete: '+type(exc).__name__+'. Check the service logs and monitoring configuration.'
            if target: self.store.health(target,'ERROR',detail,job_id)
            self.store.finish(job_id,'ERROR',detail)

    def execute_host(self,job_id,target,command):
        """Node Exporter phase: detect, reuse or install, register, verify. Returns (state, detail, facts)."""
        facts=parse_detection(command('DETECT','Inspecting Node Exporter, service, and listener.',detection_command(self.config.exporter_port)))
        exporter,detail=self.monitor.exporter(target)
        self.store.step(job_id,'DETECT','Version: '+facts.get('VERSION','not available'),'INFO')
        if self.config.preferred_exporter_version:
            self.store.step(job_id,'DETECT','Preferred / validated version: '+self.config.preferred_exporter_version+'. Healthy existing exporters are never automatically upgraded.','INFO')
        if exporter=='OTHER' or (exporter!='READY' and facts.get('LISTENER')):
            raise ProvisionFailure('Port is in use and cannot be verified as a healthy Node Exporter. No process was stopped. '+facts.get('LISTENER',detail))
        if exporter=='READY':
            self.store.step(job_id,'DETECT','Node Exporter verified. Existing installation retained.','PASS')
            self.store.step(job_id,'START','No service change required; existing exporter endpoint is healthy.','PASS')
        else:
            unit=facts.get('UNIT')
            if unit:
                if unit not in UNITS: raise ProvisionFailure('The existing exporter service could not be identified.')
                if facts.get('ACTIVE')=='active': raise ProvisionFailure('Exporter service is active, but metrics are unreachable. Check its listen address and firewall.','DEGRADED')
                command('START','Starting the existing Node Exporter service.','systemctl start '+unit)
            else:
                if facts.get('BINARY'): raise ProvisionFailure('Exporter binary exists without a recognized service. Files are preserved; check the service configuration.')
                if facts.get('PLATFORM') not in ('ubuntu','debian') or facts.get('SYSTEMD')!='yes':
                    raise ProvisionFailure('Automatic installation supports Ubuntu/Debian with systemd. On other platforms, prepare Node Exporter before enabling Telemetry.')
                if self.config.exporter_port!=9100: raise ProvisionFailure('New installations use port 9100. Prepare the exporter service first when using a custom port.')
                command('INSTALL','Installing Node Exporter from the system package repository.',
                        'env DEBIAN_FRONTEND=noninteractive apt-get update && env DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends prometheus-node-exporter',300)
                unit='prometheus-node-exporter.service'
                command('START','Enabling and starting the Node Exporter service.','systemctl enable --now '+unit,60)
            self.store.step(job_id,'START','Service start completed. Verifying the metrics endpoint.','PASS')
            self.store.step(job_id,'EXPORTER','Waiting for Node Exporter metrics.')
            for _ in range(10):
                self.binding(target);exporter,_=self.monitor.exporter(target)
                if exporter=='READY': break
                if self.stop_event.wait(1): raise ProvisionFailure('Worker stopping. Recheck the exporter status before continuing.','INTERRUPTED')
            if exporter!='READY': raise ProvisionFailure('Node Exporter metrics remain unavailable after the service start.','DEGRADED')
        self.store.step(job_id,'EXPORTER','Node Exporter /metrics endpoint verified.','PASS')
        self.binding(target)
        self.store.step(job_id,'REGISTER','Publishing the node target to Prometheus.')
        register_target(self.config,target)
        self.store.step(job_id,'REGISTER','Target configuration published. Waiting for a scrape.','PASS')
        self.store.step(job_id,'VERIFY','Awaiting target UP and fresh required metrics.')
        deadline=time.monotonic()+self.config.verify_seconds
        while True:
            self.binding(target);state,detail=self.monitor.health(target)
            if state=='READY' or time.monotonic()>=deadline: break
            if self.stop_event.wait(self.config.poll_seconds): raise ProvisionFailure('Verification interrupted. Enable Telemetry again to check the current state.','INTERRUPTED')
        return state,detail,facts

    def snapshot(self,node_id):
        target=self.resolve(node_id);job=self.store.latest(node_id);row=self.store.node(node_id)
        state='NOT_CONFIGURED';detail='此節點目前尚未啟用 Telemetry。';checked=None;stale=False
        if row:
            state=row['state'];detail=row['detail'];checked=row['checked_at']
            if row['binding']!=target['revision']: state='DEGRADED';detail='連線設定已變更，請重新啟用以確認目前節點。'
            elif state=='READY' and time.time()-checked>self.config.freshness_seconds:
                # The stored verdict is still READY; only its age lapsed. Report it as a
                # soft staleness hint instead of a health failure, so a node that is
                # actually healthy never shows up as "needs attention" just for idling.
                stale=True
                detail='已就緒；資料可能已過期，背景正在重新確認中央監控狀態。'
        if job and job['state'] in ('QUEUED','PROVISIONING'): state='PROVISIONING';detail='啟用作業進行中，關閉頁面不會停止。'
        elif job and job['state']=='INTERRUPTED': state='ERROR';detail=job['error']
        components=self.store.components(node_id)
        if not components and row:
            # Jobs recorded before the component split have no per-component state.
            # Fall back to the node-level result so existing hosts stay READY.
            if state in ('READY','DEGRADED'):
                components=dict(host=state,prometheus=state)
            elif state in ('ERROR','UNREACHABLE','INTERRUPTED'):
                components=dict(host=state)
        return dict(node_id=node_id,chassis_id=target['chassis_id'],label=target.get('display_name'),hostname=target.get('os_hostname'),
                    slot=target['slot_key'],os_ip=target['os_ip'],binding_revision=target['revision'],state=state,detail=detail,stale=stale,
                    checked_at=checked,job=job,components=components,configured=self.config.ready(),dashboard_url=self.config.dashboard(node_id),
                    host_setup=self.host_setup(target),gpu_setup=self.gpu_setup(target))

    def host_setup(self,target):
        from .telemetry_monitoring import address
        port=self.config.exporter_port
        return dict(prometheus_url=self.config.prometheus_url,file_sd=self.config.file_sd,
                    exporter_url='http://'+address(target['os_ip'],port)+'/metrics',port=port,
                    detection='. /etc/os-release; echo "$PRETTY_NAME"; systemctl --version | head -n1',
                    installation='sudo apt-get update && sudo apt-get install -y --no-install-recommends prometheus-node-exporter && sudo systemctl enable --now prometheus-node-exporter',
                    check_on_node='curl -sf http://127.0.0.1:'+str(port)+'/metrics | head -n1',
                    check_on_manager='curl --fail --max-time 10 '+shlex.quote('http://'+address(target['os_ip'],port)+'/metrics'),
                    documentation='https://github.com/prometheus/node_exporter#installation-and-usage')

    def gpu_setup(self,target):
        from .telemetry_gpu import setup_instructions
        return setup_instructions(self.config,target)

    def refresh(self,node_id):
        # Read-only monitoring checks are coalesced and run off-request, never SSH/install.
        with self.mutex:
            if not self.pool or self.stop_event.is_set() or time.monotonic()-self.last_health.get(node_id,-100)<30: return
            if len(self.pending)>=self.workers or self.store.latest(node_id) and self.store.latest(node_id)['state'] in ('QUEUED','PROVISIONING'): return
            self.last_health[node_id]=time.monotonic()
            def check():
                target=self.resolve(node_id);old=self.store.node(node_id)
                if not old or old['state'] not in ('READY','DEGRADED'): return
                state,detail=self.monitor.health(target)
                components=self.store.components(node_id)
                if components:
                    components.update(host=state,prometheus=state)
                    gpu=components.get('gpu',{})
                    if gpu.get('state') in ('READY','DEGRADED','VERIFYING') and gpu.get('gpus'):
                        gpu['state'],gpu['detail']=self.monitor.gpu_health(target)
                    self.store.components(node_id,components)
                    if state=='READY' and gpu.get('state') not in ('READY','NOT_APPLICABLE'):
                        state='DEGRADED';detail='Host telemetry READY. GPU telemetry requires attention.'
                self.binding(target);self.store.health(target,state,detail,old.get('job_id'))
            self.pending['health:'+node_id]=self.pool.submit(check)
