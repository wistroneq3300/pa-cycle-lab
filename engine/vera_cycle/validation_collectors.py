"""Explicit observation operations shared by Cycle and independent inspection.

Importing this module performs no IO. No action dispatcher is exposed here.
Caller owns persistence, credentials, scheduling and comparison context.
"""
from dataclasses import dataclass, asdict
import hashlib
import json
import re
import shlex
import time
from pathlib import Path
from cycle_transport import Command

# Per-LogService entry cap. Some BMCs (e.g. Manager Journal) return a single
# 1000-entry page; keep the newest 500 so one noisy service cannot crowd the
# report. Reaching it is recorded as a coverage limit (not completeness).
REDFISH_ENTRIES_PER_SERVICE = 500

# LogService display priority (most actionable first); anything unlisted sorts
# after these, alphabetically. Used only for the coverage label ordering.
REDFISH_SERVICE_PRIORITY = ("EventLog", "SEL", "Journal", "HostLogger")


@dataclass(frozen=True)
class Operation:
    role: str
    command: str
    sudo: bool = False
    timeout: int = 30
    max_bytes: int = 2097152


OPERATIONS = {
    'identity': Operation('os', "printf 'HOSTNAME='; hostname; printf 'BOOT_ID='; cat /proc/sys/kernel/random/boot_id"),
    'asset_identity': Operation('os', "printf 'HARDWARE_UUID='; cat /sys/class/dmi/id/product_uuid; printf 'NODE_SERIAL='; cat /sys/class/dmi/id/product_serial", True),
    'pci': Operation('os', 'lspci -Dvv -nn', True, 60),
    'kernel_snapshot': Operation('os', 'dmesg', True),
    'sensor': Operation('oob', 'sensor list'),
    'sel': Operation('oob', 'sel list'),
    'sel_info': Operation('oob', 'sel info'),
    'bmc_identity': Operation('oob', 'mc guid'),
    'bmc_firmware': Operation('oob', 'mc info'),
    'power': Operation('oob', 'power status'),
    'host_power': Operation('bmc', '/usr/bin/powerctrl.sh power_status'),
    'firmware': Operation('os', 'dmidecode -t bios', True),
    'system': Operation('os', 'uname -a; cat /etc/os-release; lscpu'),
    'drivers': Operation('os', 'cat /proc/modules'),
    'tools': Operation('os', 'lspci --version; dmidecode --version; nvme version; ipmitool -V; uname -r'),
    'CPU': Operation('os', 'dmidecode -t processor', True),
    'CPU-online': Operation('os', 'lscpu --all -p=CPU,SOCKET,ONLINE'),
    'DIMM': Operation('os', 'dmidecode -t memory', True),
    'OS-memory': Operation('os', 'cat /proc/meminfo'),
    'NVMe': Operation('os', 'nvme list', True),
    'MST': Operation('os', 'mst status -v', True),
    'BIOS-firmware': Operation('os', 'dmidecode -t bios', True),
    'GPU': Operation('os', 'nvidia-smi -L'),
    'gpu': Operation('os', 'nvidia-smi --query-gpu=uuid,name,driver_version,utilization.gpu,memory.used,memory.total --format=csv,noheader,nounits'),
}
HARDWARE_INPUTS = ('CPU','CPU-online','DIMM','OS-memory','NVMe','MST','BIOS-firmware','GPU')


def core_version():
    root=Path(__file__).parent
    names=('validation_collectors.py','validation_identity.py','validation_rules.py','validation_events.py','validation_checker.py','validation_transport.py','validation_checkers.json','cycle_dmesg.py')
    digest=hashlib.sha256()
    for name in names:
        path=root/name
        if path.exists(): digest.update(name.encode()+b'\0'+path.read_bytes().replace(b'\r\n',b'\n'))
    return digest.hexdigest()


def plan():
    return {name:asdict(op) for name,op in OPERATIONS.items()}


def execute_operation(transport,target,op):
    """The shared transport invocation; Cycle supplies its own evidence lifecycle."""
    return (transport.oob(target,op.command,op.timeout) if op.role=='oob' else
            transport.ssh(target,op.role,op.command,op.timeout,op.sudo))


class Collector:
    """One acquisition batch. Repeated requests for an operation reuse its bytes."""
    def __init__(self, transport, target, clock=time.time,progress=None):
        self.transport=transport; self.target=target; self.clock=clock; self.cache={}
        self.progress=progress

    def read(self,name,refresh=False):
        if not refresh and name in self.cache: return self.cache[name]
        op=OPERATIONS[name]
        start=self.clock()
        if self.progress: self.progress(name,'COLLECTING',start)
        try:
            result=execute_operation(self.transport,self.target,op)
        except Exception as exc:
            cause=exc.__cause__ or exc
            auth='Authentication' in type(cause).__name__
            result=Command(401 if auth else 255,'Authentication failed' if auth else 'Observation failed: '+type(exc).__name__,'NOT_ISSUED')
        data=result.output.encode('utf-8',errors='replace')
        truncated=len(data)>op.max_bytes
        text=data[:op.max_bytes].decode('utf-8',errors='replace')
        status='TRUNCATED' if truncated else 'SUCCESS' if result.code==0 else 'NOT_SUPPORTED' if result.code==127 else 'FAILED'
        if status=='SUCCESS' and not text.strip() and name not in {'sel','kernel_snapshot'}: status='MISSING_DATA'
        if op.role=='oob' and re.search(r'Get .+ command failed|Unable to establish|Error:|No response from|Invalid command',text,re.I): status='FAILED'
        item=dict(collector_name=name,collector_version=1,requested_at=start,collected_at=self.clock(),
                  completed_at=self.clock(),duration=max(0,self.clock()-start),collection_status=status,
                  code=result.code,raw=text,truncated=truncated,command=op.command,role=op.role)
        self.cache[name]=item
        if self.progress: self.progress(name,status,self.clock())
        return item

    def kernel(self,cursor=None,limit=512):
        # Forward iteration from the saved cursor, never tail to the newest page.
        if cursor and (not isinstance(cursor,str) or len(cursor)>1024 or '\n' in cursor): raise ValueError('Invalid journal cursor')
        command='journalctl -k --no-pager -o json --output-fields=MESSAGE,__CURSOR,__REALTIME_TIMESTAMP,__MONOTONIC_TIMESTAMP,_BOOT_ID'
        command+=' --after-cursor='+shlex.quote(cursor) if cursor else ''
        command+=' | head -n '+str(max(1,min(512,int(limit))))
        # pipefail ensures missing journalctl/cursor failures are not hidden by head.
        try: result=self.transport.ssh(self.target,'os','bash -o pipefail -c '+shlex.quote(command),30,True)
        except Exception as exc: result=Command(255,type(exc).__name__)
        rows=[]
        if len(result.output.encode('utf-8'))>2097152:
            # Never advance past an unpersisted/truncated journal page.
            return dict(source='journal',rows=[],raw=result.output[:2097152],collection_status='TRUNCATED',cursor=cursor,backlog=True,gap=True)
        try:
            for line in result.output.splitlines():
                if line.strip():
                    row=json.loads(line)
                    if not row.get('__CURSOR') or not isinstance(row.get('MESSAGE'),str): raise ValueError('Missing journal envelope')
                    rows.append(row)
        except (ValueError,TypeError): rows=[]
        # SIGPIPE from the bounded producer is expected only with a full valid page.
        if (result.code==0 or result.code==141 and len(rows)==limit) and (rows or not result.output.strip()):
            return dict(source='journal',rows=rows,raw=result.output,collection_status='SUCCESS',
                        cursor=rows[-1]['__CURSOR'] if rows else cursor,backlog=len(rows)>=limit,gap=False)
        fallback=self.read('kernel_snapshot')
        return dict(source='dmesg',raw=fallback['raw'],collection_status=fallback['collection_status'],
                    cursor=None,backlog=False,gap=True,reason='Journal unavailable or cursor invalid; read-only ring snapshot cannot prove complete coverage')

    def redfish(self,system_uri=None,max_pages=16,resume=None):
        """Discover Systems and Managers. Never choose an arbitrary first System."""
        token=self.transport.redfish_login(self.target)
        try: return self._redfish_pages(token,system_uri,max_pages,resume)
        finally:
            logout=getattr(self.transport,'redfish_logout',None)
            if logout:
                try: logout(self.target,token)
                except Exception: pass  # collection evidence is still valid

    def _redfish_pages(self,token,system_uri,max_pages,resume):
        raw=[]; raw_bytes=0
        deadline=time.monotonic()+90
        def get(path):
            nonlocal raw_bytes
            if not isinstance(path,str) or not path.startswith('/redfish/v1/') or '..' in path or '://' in path:
                raise ValueError('Invalid Redfish resource link')
            if time.monotonic()>=deadline or len(raw)>=64: raise OSError('Redfish batch budget exhausted')
            result=self.transport.redfish_get(self.target,path,token,timeout=max(1,min(30,int(deadline-time.monotonic()))))
            entry=dict(path=path,code=result.code,body=result.output[:2097152])
            size=len(json.dumps(entry,ensure_ascii=False).encode('utf-8'))
            if raw_bytes+size>1572864: raise OSError('Redfish batch output limit; resume this page next time')
            raw_bytes+=size
            raw.append(entry)
            if result.code: raise OSError('Redfish resource unavailable')
            if len(result.output.encode('utf-8'))>2097152: raise OSError('Redfish page output limit exceeded')
            return json.loads(result.output[result.output.find('{'):])
        services=[]; unavailable=[]; entries=[]; next_pages={}; complete=True; truncated=[]
        def members(path):
            result=[]; seen=set()
            while path:
                if path in seen: raise OSError('Repeated discovery page')
                seen.add(path); payload=get(path); result.extend(payload.get('Members',[]))
                path=payload.get('Members@odata.nextLink') or payload.get('@odata.nextLink')
            return result
        for kind in ('Systems','Managers'):
            try: resources=members('/redfish/v1/'+kind)
            except (ValueError,OSError): unavailable.append(kind); continue
            if kind=='Systems' and system_uri:
                resources=[m for m in resources if m.get('@odata.id')==system_uri]
                if not resources: unavailable.append('configured System missing')
            elif kind=='Systems' and len(resources)>1:
                unavailable.append('multiple Systems: system_uri required'); continue
            for member in resources:
                resource=member.get('@odata.id','').rstrip('/')
                try: listing=members(resource+'/LogServices')
                except (ValueError,OSError): unavailable.append(resource); continue
                for service in listing:
                    path=service.get('@odata.id','').rstrip('/')
                    if path: services.append(path)
        for service in sorted(set(services)):
            path=(resume or {}).get(service) or service+'/Entries'; seen=set(); pages=0; rows=[]
            while path and pages<max_pages:
                if path in seen: complete=False; unavailable.append('repeated page '+path); next_pages[service]=path; break
                seen.add(path); pages+=1
                try: payload=get(path)
                except (ValueError,OSError): complete=False; next_pages[service]=path; break
                rows.extend(r for r in payload.get('Members',[]) if isinstance(r,dict))
                path=payload.get('Members@odata.nextLink') or payload.get('@odata.nextLink')
            if path: next_pages[service]=path; complete=False
            # Some BMCs (e.g. Manager Journal) return thousands of entries
            # oldest-first. Keep the newest REDFISH_ENTRIES_PER_SERVICE (ISO-8601
            # Created sorts lexicographically); entries without a timestamp keep
            # their original order at the tail. Overflow is a coverage limit.
            if len(rows)>REDFISH_ENTRIES_PER_SERVICE:
                indexed=list(enumerate(rows))
                indexed.sort(key=lambda i:(i[1].get('Created') or '', i[0]), reverse=True)
                rows=[r for _,r in indexed[:REDFISH_ENTRIES_PER_SERVICE]]
                complete=False
                truncated.append(service)
                # Never resume a capped service: a later page holds older
                # entries, so resuming would skip the newest ones. Re-read from
                # page 1 next run and trim to the newest cap again.
                next_pages.pop(service, None)
            entries.extend(dict(row,_service=service) for row in rows)
        reason='; '.join(unavailable)
        if truncated:
            reason=(reason+'; ' if reason else '')+f'kept newest {REDFISH_ENTRIES_PER_SERVICE} entries per service: '+', '.join(sorted(truncated))
        # Short names of the LogServices actually read, ordered by importance
        # (EventLog/SEL/Journal first, then the rest alphabetically) so the
        # coverage line and its "top 3" collapse lead with the useful logs.
        service_names=sorted(
            {p.rstrip('/').rsplit('/',1)[-1] for p in services},
            key=lambda n:(REDFISH_SERVICE_PRIORITY.index(n) if n in REDFISH_SERVICE_PRIORITY else len(REDFISH_SERVICE_PRIORITY),n),
        )
        return dict(entries=entries,raw=json.dumps(raw,ensure_ascii=False),services=services,next_pages=next_pages,
                    truncated=sorted(truncated),service_names=service_names,
                    collection_status='PARTIAL' if not complete or unavailable and services else 'SUCCESS' if services else 'FAILED' if unavailable else 'NOT_SUPPORTED',
                    reason=reason,complete=complete,backlog=bool(next_pages))
