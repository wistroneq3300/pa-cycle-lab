"""Synthetic-only bottom-transport fixtures; never contact a DUT or monitoring host."""
import json
import time
from pathlib import Path
from cycle_transport import Command
from .inspection_fixture import FixtureTransport
from .telemetry_provision import detection_command


class FixtureMonitor:
    def __init__(self,config):
        self.config=config;self.installed=set();self.scenarios={};self.calls=[]
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


class FixtureProvisionTransport(FixtureTransport):
    def __init__(self,target,monitor):
        super().__init__(target);self.monitor=monitor;self.binding=target
    def ssh(self,target,role,command,timeout=30,sudo=False):
        self.monitor.calls.append(('ssh',self.binding['node_id'],command))
        mode=self.monitor.scenarios.get(self.binding['node_id'],'missing')
        if mode=='unreachable': return Command(255,'SSH unavailable','NOT_ISSUED')
        if command==detection_command(self.monitor.config.exporter_port):
            extra='UNIT=node_exporter.service\nACTIVE=inactive\nBINARY=/usr/bin/node_exporter\n' if mode=='stopped' else ''
            return Command(0,'PLATFORM=ubuntu\nSYSTEMD=yes\nVERSION=1.8.2 fixture\n'+extra+'LISTENER='+('http-server pid=912' if mode=='occupied' else ''))
        if 'apt-get' in command:
            if mode=='lost': return Command(255,'connection lost','RESPONSE_LOST')
            self.monitor.installed.add(self.binding['node_id']);return Command(0,'Package configured')
        if command.startswith('systemctl '):
            self.monitor.installed.add(self.binding['node_id']);return Command(0,'')
        return super().ssh(target,role,command,timeout,sudo)
