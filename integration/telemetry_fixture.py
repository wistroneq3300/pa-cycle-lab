"""Synthetic-only bottom-transport fixtures; never contact a DUT or monitoring host."""
import json
import time
from pathlib import Path
from cycle_transport import Command
from .inspection_fixture import FixtureTransport
from .telemetry_provision import detection_command


class FixtureMonitor:
    def __init__(self,config):
        self.config=config;self.installed=set();self.scenarios={};self.calls=[];self.gpus={};self.gpu_installed=set();self.gpu_scenarios={}
    def exporter(self,target):
        mode=self.scenarios.get(target['node_id'],'missing')
        if mode=='occupied': return 'OTHER','http-server pid=912'
        if target['node_id'] in self.installed or mode=='healthy': return 'READY','Node Exporter metrics'
        return 'UNAVAILABLE','not listening'
    def health(self,target):
        self.calls.append(('health',target['node_id']))
        if self.scenarios.get(target['node_id'])=='degraded': return 'DEGRADED','Required metrics missing'
        return ('READY','Telemetry READY: Node Exporter, Prometheus target UP, and required metrics verified.') if self.exporter(target)[0]=='READY' else ('DEGRADED','metrics missing')
    def close(self): pass
    def gpu_exporter(self,target):
        nid=target['node_id'];mode=self.gpu_scenarios.get(nid)
        if mode=='occupied': return 'OTHER','Other process'
        return ('READY','DCGM metrics') if nid in self.gpu_installed or mode=='healthy' else ('UNAVAILABLE','not listening')
    def gpu_health(self,target):
        return ('DEGRADED','GPU target DOWN') if self.gpu_scenarios.get(target['node_id'])=='down' else self.gpu_exporter(target)
    def api(self,path,params=None):
        import math,re
        expression=(params or {}).get('query','');now=time.time()
        match=re.search(r'node_id="([^"]+)"',expression);nid=match[1] if match else ''
        if nid not in self.installed and self.scenarios.get(nid)!='healthy': return {'result':[]}
        if expression.startswith('timestamp('): return {'result':[{'metric':{},'value':[now,str(now-5)]}]}
        if path=='query': return {'result':[{'metric':{},'value':[now,'43200' if 'boot_time' in expression else '1.2']} ]}
        gpu='DCGM_' in expression
        if gpu and nid not in self.gpu_installed and self.gpu_scenarios.get(nid)!='healthy':return {'result':[]}
        count=self.gpus.get(nid,0) if gpu else 1
        result=[]
        for i in range(count):
            labels={'gpu':str(i),'UUID':f'GPU-fixture-{i}'} if gpu else {'device':'eth0'} if 'network_' in expression else {'device':'nvme0n1'} if 'disk_' in expression else {}
            unit=300 if 'POWER' in expression else 50 if 'TEMP' in expression else 40
            values=[[s,str(unit+i*3+8*math.sin(s/110+i))] for s in range(int(params['start']),int(params['end'])+1,int(params['step']))]
            result.append({'metric':labels,'values':values})
        return {'result':result}


class FixtureProvisionTransport(FixtureTransport):
    def __init__(self,target,monitor):
        super().__init__(target);self.monitor=monitor;self.binding=target
    def ssh(self,target,role,command,timeout=30,sudo=False):
        self.monitor.calls.append(('ssh',self.binding['node_id'],command))
        mode=self.monitor.scenarios.get(self.binding['node_id'],'missing')
        if mode=='unreachable': return Command(255,'SSH unavailable','NOT_ISSUED')
        if command.startswith('# PA_GPU_CAPABILITY'):
            count=self.monitor.gpus.get(self.binding['node_id'],0)
            return Command(0,''.join(f'{i}, GPU-fixture-{i}, NVIDIA Test GPU, 580.0\n' for i in range(count))+'SMI_RC=0\nPCI_BEGIN\nPCI_RC=0\n')
        if command.startswith('# PA_DCGM_DETECT'):
            mode=self.monitor.gpu_scenarios.get(self.binding['node_id'])
            base='VERSION=fixture-dcgm\nDOCKER_BIN=/usr/bin/docker\nNVIDIA_CTK=/usr/bin/nvidia-ctk\nTOOLKIT_PKG=nvidia-container-toolkit 1.20.1-1\nLISTENER='+('other-process' if mode=='occupied' else '')+'\n'
            if mode in (None,'healthy'):
                base+= 'RUNTIMES={"nvidia":{}}'
            elif mode=='missing':
                base+= 'RUNTIMES={"io.containerd.runc.v2":{}}'
            elif mode=='runtime-configured-not-loaded':
                base+= 'DAEMON_JSON={"runtimes":{"nvidia":{"path":"nvidia-container-runtime"}}}\nRUNTIMES={"io.containerd.runc.v2":{}}'
            else:
                base+= 'RUNTIMES={"nvidia":{}}'
            return Command(0,base+('\nUNIT=dcgm-exporter.service\nACTIVE=inactive\n' if mode=='stopped' else ''))
        if command.startswith('docker run ') or command=='docker start pa-dcgm-exporter' or command in ('systemctl start dcgm-exporter.service','systemctl start nvidia-dcgm-exporter.service'):
            self.monitor.gpu_installed.add(self.binding['node_id']);return Command(0,'fixture DCGM ready')
        if command==detection_command(self.monitor.config.exporter_port):
            extra='UNIT=node_exporter.service\nACTIVE=inactive\nBINARY=/usr/bin/node_exporter\n' if mode=='stopped' else ''
            return Command(0,'PLATFORM=ubuntu\nSYSTEMD=yes\nVERSION=1.8.2 fixture\n'+extra+'LISTENER='+('http-server pid=912' if mode=='occupied' else ''))
        if 'apt-get' in command:
            if mode=='lost': return Command(255,'connection lost','RESPONSE_LOST')
            self.monitor.installed.add(self.binding['node_id']);return Command(0,'Package configured')
        if command.startswith('systemctl '):
            self.monitor.installed.add(self.binding['node_id']);return Command(0,'')
        return super().ssh(target,role,command,timeout,sudo)
