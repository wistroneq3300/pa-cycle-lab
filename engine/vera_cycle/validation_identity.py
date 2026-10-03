"""Shared identity observations. No inventory writes, issues, or actions."""
import json
import re
import uuid


def normalize_hostname(value):
    if not isinstance(value, str): return None
    value=value.strip().rstrip('.')
    if not value or len(value)>253 or any(not re.fullmatch(r'[A-Za-z0-9_](?:[A-Za-z0-9_-]{0,61}[A-Za-z0-9_])?',p) for p in value.split('.')):
        return None
    return value.lower()


def failure_status(code, raw=''):
    if code==127: return 'NOT_SUPPORTED'
    if code in (401,403) or re.search(r'authentication|unauthorized|permission(?: denied|error)|HTTP[^\n]*40[13]',raw,re.I): return 'AUTH_FAILED'
    return 'UNAVAILABLE'


def collect_identity(collector, binding, include_bmc=True):
    """Reusable by inspection or provisioning; caller owns canonical recheck.

    BMC SSH is used only with an explicit known-platform capability. Redfish
    accepts HostName on a uniquely discovered Manager, never display Name/Id.
    """
    item=collector.read('identity')
    fields=dict(re.findall(r'^(HOSTNAME|BOOT_ID)=(.*)$',item['raw'],re.M))
    raw=fields.get('HOSTNAME',''); hostname=normalize_hostname(raw)
    boot=fields.get('BOOT_ID','').strip()
    try: boot=str(uuid.UUID(boot))
    except ValueError: boot=None
    status=('SUCCESS' if hostname and boot else 'MISSING_DATA') if item['collection_status']=='SUCCESS' else failure_status(item.get('code'),item['raw'])
    result=dict(node_id=binding.get('node_id'),chassis_id=binding.get('chassis_id'),
                binding_revision=binding.get('revision'),os_ip=binding.get('os_ip'),bmc_ip=binding.get('bmc_ip'),
                os_hostname=hostname,os_hostname_raw=raw,os_boot_id=boot,os_status=status,
                bmc_hostname=None,bmc_hostname_raw=None,bmc_status='NOT_SUPPORTED',
                collected_at=item['collected_at'],source='inspection_identity',os_evidence=item)
    expected=binding.get('expected_identity') or {}
    if any(expected.get(k) or binding.get(k) for k in ('hardware_uuid','node_serial')):
        asset=collector.read('asset_identity')
        values=dict(re.findall(r'^(HARDWARE_UUID|NODE_SERIAL)=(.*)$',asset['raw'],re.M))
        for field in ('hardware_uuid','node_serial'):
            value=values.get(field.upper(),'').strip()
            if asset['collection_status']=='SUCCESS' and value: result[field]=value
        result['asset_status']=asset['collection_status']
    if not include_bmc or not binding.get('bmc_ip'): return result
    transport=collector.transport; target=collector.target
    mode=(binding.get('capabilities') or {}).get('bmc_hostname_query') or 'auto'
    # Auto is the system default: BMC hostname is read over SSH, and a BMC that
    # cannot answer `hostname` over SSH falls back to Redfish. A per-node
    # capability can pin the transport (ssh_hostname / redfish) when needed.
    if mode in ('auto','ssh_hostname'):
        if _bmc_via_ssh(transport,target,result) or mode=='ssh_hostname': return result
    _bmc_via_redfish(transport,target,binding,result)
    return result


def _bmc_via_ssh(transport,target,result):
    """Try `hostname` over BMC SSH. Returns True when it yielded a usable answer."""
    try:
        response=transport.ssh(target,'bmc','hostname',20,False)
        raw=response.output; name=normalize_hostname(raw)
        if response.code==0 and name:
            result.update(bmc_hostname=name,bmc_hostname_raw=raw,bmc_status='SUCCESS',bmc_source='bmc_ssh_hostname')
            return True
        result.update(bmc_hostname_raw=raw,bmc_status=failure_status(response.code,raw),bmc_source='bmc_ssh_hostname')
    except Exception as exc:
        result.update(bmc_status=failure_status(255,type(exc).__name__),bmc_source='bmc_ssh_hostname')
    return False


def _bmc_via_redfish(transport,target,binding,result):
    token=None
    try:
        token=transport.redfish_login(target)
        if not token:
            result['bmc_status']='UNAVAILABLE'; return
        response=transport.redfish_get(target,'/redfish/v1/Managers',token,20)
        if response.code:
            result['bmc_status']=failure_status(response.code,response.output); return
        members=json.loads(response.output).get('Members',[])
        paths=[m.get('@odata.id') for m in members if isinstance(m,dict)]
        configured=binding.get('manager_uri')
        path=configured if configured in paths else paths[0] if len(paths)==1 else None
        if not path or not re.fullmatch(r'/redfish/v1/Managers/[A-Za-z0-9_.-]+',path): return
        response=transport.redfish_get(target,path,token,20)
        if response.code: result['bmc_status']=failure_status(response.code,response.output); return
        raw=json.loads(response.output).get('HostName')
        name=normalize_hostname(raw)
        result.update(bmc_hostname=name,bmc_hostname_raw=raw,bmc_status='SUCCESS' if name else 'NOT_SUPPORTED',bmc_source=path+'/HostName')
    except Exception as exc: result['bmc_status']=failure_status(255,type(exc).__name__)
    finally:
        if token and hasattr(transport,'redfish_logout'):
            try: transport.redfish_logout(target,token)
            except Exception: pass
