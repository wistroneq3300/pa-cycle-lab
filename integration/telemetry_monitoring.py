"""Configurable Prometheus/file_sd/Grafana integration; never changes services."""
from dataclasses import dataclass
import ipaddress
import json
import math
import os
from pathlib import Path
import re
import tempfile
import threading
import time
from urllib.parse import urlencode, urlsplit
import httpx

_file_lock = threading.RLock()
REQUIRED = ('node_exporter_build_info','node_cpu_seconds_total','node_memory_MemTotal_bytes','node_filesystem_size_bytes','node_network_receive_bytes_total')


@dataclass(frozen=True)
class MonitoringConfig:
    prometheus_url: str = ''
    file_sd: str = ''
    grafana_url: str = ''
    dashboard_uid: str = 'pa-node-telemetry'
    exporter_port: int = 9100
    verify_seconds: float = 90
    poll_seconds: float = 5
    freshness_seconds: float = 120

    @classmethod
    def environment(cls):
        cfg = cls(prometheus_url=os.getenv('PA_PROMETHEUS_URL','').rstrip('/'),
                  file_sd=os.getenv('PA_PROMETHEUS_FILE_SD',''),
                  grafana_url=os.getenv('PA_GRAFANA_URL','').rstrip('/'),
                  dashboard_uid=os.getenv('PA_GRAFANA_DASHBOARD_UID','pa-node-telemetry'),
                  exporter_port=int(os.getenv('PA_NODE_EXPORTER_PORT','9100')),
                  verify_seconds=float(os.getenv('PA_TELEMETRY_VERIFY_SECONDS','90')))
        for url in (cfg.prometheus_url,cfg.grafana_url):
            if url:
                p=urlsplit(url)
                if p.scheme not in ('http','https') or not p.hostname or p.username or p.password or p.query or p.fragment:
                    raise ValueError('Monitoring URL must be an HTTP(S) base URL without credentials/query')
        if not re.fullmatch(r'[A-Za-z0-9_-]{1,64}',cfg.dashboard_uid): raise ValueError('Invalid dashboard UID')
        if not 1<=cfg.exporter_port<=65535 or not 1<=cfg.verify_seconds<=600: raise ValueError('Invalid monitoring limits')
        return cfg

    def ready(self):
        return bool(self.prometheus_url and self.file_sd)

    def dashboard(self, node_id, theme='light'):
        if not self.grafana_url: return None
        return self.grafana_url+'/d/'+self.dashboard_uid+'/pa-node?'+urlencode({'var-node_id':node_id,'theme':theme,'kiosk':'','from':'now-1h','to':'now','refresh':'30s','timezone':'Asia/Taipei'})


def address(host, port):
    # Canonical inventory endpoint, never a client-provided URL.
    try:
        ip=ipaddress.ip_address(host)
        return f'[{ip}]:{port}' if ip.version==6 else f'{ip}:{port}'
    except ValueError:
        if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9.-]{0,252}',host): raise ValueError('Invalid canonical OS endpoint')
        return f'{host}:{port}'


def register_target(config, target):
    """One exclusive PA service writer; preserve every non-PA file_sd group."""
    path=Path(config.file_sd)
    with _file_lock:
        rows=json.loads(path.read_text(encoding='utf-8')) if path.exists() else []
        if not isinstance(rows,list) or any(not isinstance(r,dict) or not isinstance(r.get('targets'),list) for r in rows):
            raise ValueError('Existing file_sd is invalid; file unchanged')
        endpoint=address(target['os_ip'],config.exporter_port)
        # Adopt an existing POC endpoint in the dedicated PA file without a
        # duplicate scrape. Preserve its labels and other members of its group.
        inherited={};kept=[];adopted=0
        for row in rows:
            labels=row.get('labels',{})
            ours=labels.get('pa_managed')=='true' and labels.get('node_id')==target['node_id']
            if ours: inherited.update(labels);continue
            if endpoint in row['targets']:
                if labels.get('node_id') not in (None,target['node_id']) or adopted:
                    raise ValueError('Endpoint belongs to another node or duplicate target groups')
                adopted+=1;inherited.update(labels)
                remaining=[x for x in row['targets'] if x!=endpoint]
                if remaining: kept.append(dict(row,targets=remaining))
            elif labels.get('node_id')==target['node_id']:
                raise ValueError('Node already has a different unmanaged endpoint')
            else: kept.append(row)
        rows=kept
        rows.append({'targets':[endpoint],'labels':{**inherited,'pa_managed':'true','node_id':target['node_id'],
                     'chassis_id':target['chassis_id'],'project_id':str(target.get('project_id') or target['project']),
                     'hostname':str(target.get('os_hostname') or target.get('node') or ''),
                     'pa_binding':target['revision']}})
        path.parent.mkdir(parents=True,exist_ok=True)
        fd, name=tempfile.mkstemp(prefix='.pa-targets-',suffix='.json',dir=path.parent)
        try:
            with os.fdopen(fd,'w',encoding='utf-8') as out:
                json.dump(rows,out,ensure_ascii=False,indent=2);out.write('\n');out.flush();os.fsync(out.fileno())
            os.chmod(name,0o644)
            os.replace(name,path)
        finally:
            if os.path.exists(name): os.unlink(name)


class MonitoringClient:
    def __init__(self, config, http=None, clock=time.time):
        self.config=config; self.http=http or httpx.Client(timeout=8,follow_redirects=False,trust_env=False); self.clock=clock

    def close(self): self.http.close()

    def get(self, url, params=None):
        # Bound responses before parsing. No response body is put into events.
        with self.http.stream('GET',url,params=params) as response:
            response.raise_for_status(); chunks=[]; size=0
            for chunk in response.iter_bytes():
                size+=len(chunk)
                if size>8*1024*1024: raise ValueError('Monitoring response too large')
                chunks.append(chunk)
        return b''.join(chunks).decode('utf-8',errors='replace')

    def exporter(self, target):
        try:
            text=self.get('http://'+address(target['os_ip'],self.config.exporter_port)+'/metrics')
            if re.search(r'^node_exporter_build_info(?:\{[^\n]*\})?\s+1(?:\.0)?\s*$',text,re.M):
                return 'READY','Node Exporter metrics responding'
            return 'OTHER','Port responds without Node Exporter metrics'
        except Exception as exc:
            return 'UNAVAILABLE','Metrics unavailable: '+type(exc).__name__

    def api(self, path, params=None):
        body=json.loads(self.get(self.config.prometheus_url+'/api/v1/'+path,params))
        if body.get('status')!='success': raise ValueError('Prometheus query failed')
        return body['data']

    def health(self, target):
        if not self.config.ready(): return 'NOT_CONFIGURED','Central monitoring endpoint and target file are not configured.'
        try:
            endpoint=address(target['os_ip'],self.config.exporter_port)
            rows=self.api('targets',{'state':'active'}).get('activeTargets',[])
            matches=[r for r in rows if r.get('labels',{}).get('node_id')==target['node_id'] and
                     r.get('labels',{}).get('pa_binding')==target['revision'] and
                     urlsplit(r.get('scrapeUrl','')).netloc==endpoint]
            if len(matches)!=1 or matches[0].get('health')!='up':
                return 'DEGRADED','Prometheus has not confirmed an UP target for the current node binding.'
            exporter,_=self.exporter(target)
            if exporter!='READY': return 'DEGRADED','Node Exporter metrics could not be verified.'
            selector='{node_id='+json.dumps(target['node_id'])+',pa_binding='+json.dumps(target['revision'])+'}'
            missing=[]
            for metric in REQUIRED:
                result=self.api('query',{'query':'timestamp('+metric+selector+')'}).get('result',[])
                # timestamp(metric) returns the sample time, not query evaluation time.
                stamps=[float(r.get('value',[0,'nan'])[1]) for r in result]
                if not stamps or any(not math.isfinite(t) or not 0<=self.clock()-t<=self.config.freshness_seconds for t in stamps): missing.append(metric)
            if missing: return 'DEGRADED','Required metrics are missing or stale: '+', '.join(missing)
            return 'READY','Telemetry READY: Node Exporter, Prometheus target UP, and required metrics verified.'
        except Exception as exc:
            return 'DEGRADED','Central monitoring verification did not complete: '+type(exc).__name__
