"""Bounded, canonical-node PromQL and normalized PA chart data. Read only."""
from concurrent.futures import ThreadPoolExecutor
import json
import math
import threading
import time

RANGES={'10m':600,'30m':1800,'1h':3600,'6h':21600,'12h':43200,'24h':86400,'2d':172800,'7d':604800,'30d':2592000}
_pool=ThreadPoolExecutor(max_workers=4,thread_name_prefix='pa-prom-query')
_admission=threading.BoundedSemaphore(4)


def queries(node_id):
    s='{node_id='+json.dumps(node_id)+',instance='+json.dumps(node_id)
    end=s+'}'
    gpu=lambda metric:f'max by (UUID,gpu,GPU_I_ID) ({metric}{end})'
    return [
      ('cpu','CPU Utilization','%',False,[('CPU',f'100 * (1 - avg by (node_id) (rate(node_cpu_seconds_total{s},mode="idle"}}[5m])))')]),
      ('cputemp','CPU Temperature','°C',False,[('',f'max(node_hwmon_temp_celsius{s},chip!~"nvme.*"}})')]),
      ('memory','Memory Utilization','%',False,[('Memory',f'100 * (1 - max by(node_id)(node_memory_MemAvailable_bytes{end}) / max by(node_id)(node_memory_MemTotal_bytes{end}))')]),
      ('ecc','Host Memory (DIMM) ECC Errors','errors',False,[('Correctable',f'sum by (controller) (node_edac_correctable_errors_total{s}}})'),('Uncorrectable',f'sum by (controller) (node_edac_uncorrectable_errors_total{s}}})')]),
      ('gpu','GPU Utilization','%',True,[('',gpu('DCGM_FI_DEV_GPU_UTIL'))]),
      ('temperature','GPU Temperature','°C',True,[('',gpu('DCGM_FI_DEV_GPU_TEMP'))]),
      ('power','GPU Power','W',True,[('',gpu('DCGM_FI_DEV_POWER_USAGE'))]),
      ('nvlink','GPU NVLink Bandwidth','MB/s',True,[('',gpu('DCGM_FI_DEV_NVLINK_BANDWIDTH_TOTAL'))]),
      ('hbm','GPU HBM / VRAM','%',True,[('',f'100 * {gpu("DCGM_FI_DEV_FB_USED")} / ({gpu("DCGM_FI_DEV_FB_USED")} + {gpu("DCGM_FI_DEV_FB_FREE")})')]),
      ('network','Network RX / TX','B/s',False,[(d,f'sum by(device)(rate(node_network_{metric}_bytes_total{s},device!="lo"}}[5m]))') for d,metric in [('RX','receive'),('TX','transmit')]]),
      ('disk','Disk Read / Write','B/s',False,[(d,f'sum by(device)(rate(node_disk_{metric}_bytes_total{s},device!~"loop.*|ram.*"}}[5m]))') for d,metric in [('Read','read'),('Write','written')]])]


def finite(value):
    try: n=float(value);return n if math.isfinite(n) and abs(n)<1e15 else None
    except (ValueError,TypeError): return None


class ChartService:
    def __init__(self,monitor,clock=time.time):
        self.monitor=monitor;self.clock=clock;self.cache={};self.lock=threading.Lock();self.inflight=set()

    def read(self,target,period='1h',gpu_state=None):
        if period not in RANGES: raise ValueError('Invalid telemetry time range')
        nid=target['node_id'];key=(nid,period,gpu_state)
        with self.lock:
            cached=self.cache.get(key)
            if cached and self.clock()-cached[0]<20: return cached[1]
            if key in self.inflight: return {'state':'LOADING','panels':[],'node_id':nid}
            if not _admission.acquire(blocking=False): return {'state':'BUSY','panels':[],'node_id':nid}
            self.inflight.add(key)
        try:
            now=self.clock();start=now-RANGES[period];step=max(15,math.ceil(RANGES[period]/600))
            def fetch(expression,range_query=True):
                try:
                    params={'query':expression,'timeout':'8s'}
                    if range_query: params.update(start=start,end=now,step=step)
                    data=self.monitor.api('query_range' if range_query else 'query',params)
                    return data.get('result',[])[:64],None
                except Exception as exc: return [],type(exc).__name__
            # All range and instant requests share the same four IO workers.
            definitions=queries(nid);jobs={}
            for ident,title,unit,gpu,expressions in definitions:
                if gpu and gpu_state=='NOT_APPLICABLE': continue
                for index,(_,expr) in enumerate(expressions): jobs[(ident,index)]=_pool.submit(fetch,expr)
            selector='{node_id='+json.dumps(nid)+',instance='+json.dumps(nid)+'}'
            instant={name:_pool.submit(fetch,expr,False) for name,expr in [
                ('host','timestamp(node_exporter_build_info'+selector+')'),
                ('gpu','timestamp(DCGM_FI_DEV_GPU_UTIL'+selector+')'),
                ('uptime',f'time() - max(node_boot_time_seconds{selector})'),
                ('load',f'max(node_load1{selector})'),
                ('filesystem',f'100 * (1 - node_filesystem_avail_bytes{selector} / node_filesystem_size_bytes{selector})')]}
            ages={}
            for role,metric in [('host','node_exporter_build_info'),('gpu','DCGM_FI_DEV_GPU_UTIL')]:
                rows,err=instant[role].result()
                stamps=[finite(r.get('value',[0,None])[1]) for r in rows]
                valid=[v for v in stamps if v is not None and v<=now]
                ages[role]=max(valid) if valid else None
            panels=[]
            for ident,title,unit,gpu,expressions in definitions:
                panel=dict(id=ident,title=title,unit=unit,series=[],state='NO_DATA',sample_at=ages['gpu' if gpu else 'host'])
                if gpu and gpu_state=='NOT_APPLICABLE': panel['state']='NOT_APPLICABLE';panels.append(panel);continue
                for index,(direction,_) in enumerate(expressions):
                    rows,error=jobs[(ident,index)].result()
                    if error: panel.update(state='QUERY_ERROR',error='Prometheus query unavailable: '+error);continue
                    for row in rows:
                        labels=row.get('metric',{});values=[]
                        for stamp,value in row.get('values',[])[:602]:
                            v=finite(value)
                            if start<=float(stamp)<=now: values.append([float(stamp)*1000,v])
                        if not any(v is not None for _,v in values): continue
                        label=('GPU '+str(labels.get('gpu','?'))+(' / MIG '+str(labels['GPU_I_ID']) if 'GPU_I_ID' in labels else '')) if gpu else ' '.join(filter(None,[labels.get('device') or labels.get('chip') or labels.get('controller'),direction]))
                        panel['series'].append(dict(id=json.dumps([labels.get('UUID'),labels.get('gpu'),labels.get('GPU_I_ID'),labels.get('device'),direction]),label=label,points=values,latest=next((v for _,v in reversed(values) if v is not None),None)))
                if panel['series'] and panel['state']!='QUERY_ERROR':
                    stamp=panel['sample_at'];panel['state']='READY' if stamp is not None and 0<=now-stamp<=self.monitor.config.freshness_seconds else 'STALE'
                panels.append(panel)
            stats={}
            for key_name in ('uptime','load','filesystem'):
                rows,error=instant[key_name].result()
                stats[key_name]=[dict(labels=r.get('metric',{}),value=finite(r.get('value',[0,None])[1])) for r in rows[:32]] if not error else []
            result=dict(node_id=nid,state='READY',range=period,step=step,generated_at=now,last_sample=ages,panels=panels,stats=stats)
            with self.lock:
                if len(self.cache)>=64: self.cache.pop(next(iter(self.cache)))
                self.cache[(nid,period,gpu_state)]=(now,result)
            return result
        finally:
            with self.lock:self.inflight.discard((nid,period,gpu_state))
            _admission.release()
