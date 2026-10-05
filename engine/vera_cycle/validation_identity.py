"""Shared identity observations. No inventory writes, issues, or actions."""
import ipaddress
import json
import re
import uuid


def _mac(value):
    value=(value or '').lower().strip()
    if not re.fullmatch(r'(?:[0-9a-f]{2}:){5}[0-9a-f]{2}',value): return None
    if value in ('00:00:00:00:00:00','ff:ff:ff:ff:ff:ff'): return None
    return value


def _ip(value):
    try: return ipaddress.ip_address(str(value).split('%')[0])
    except (ValueError,AttributeError): return None


def os_mac_from_ip(text,expected_ip):
    """link/ether of the interface carrying the registered OS IP (never guessed)."""
    target=_ip(expected_ip)
    if target is None: return None
    for block in re.split(r'(?=^\d+: )',text or '',flags=re.M):
        mac=re.search(r'\blink/ether\s+(\S+)',block)
        addrs=re.findall(r'\binet6?\s+([^/\s]+)',block)
        if mac and _mac(mac[1]) and target in [_ip(a) for a in addrs]: return _mac(mac[1])
    return None


def bmc_mac_from_ip(text,expected_ip):
    """MAC of the ipmitool lan channel whose IP Address matches the registered BMC IP."""
    target=_ip(expected_ip)
    if target is None: return None
    for block in re.split(r'(?=^---CHANNEL \d+---$)',text or '',flags=re.M):
        address=re.search(r'^\s*IP Address\s*:\s*(\S+)\s*$',block,re.M)
        mac=re.search(r'^\s*MAC Address\s*:\s*(\S+)\s*$',block,re.M)
        if address and mac and _ip(address[1])==target and _mac(mac[1]): return _mac(mac[1])
    return None


LAN_CHANNELS='for ch in 0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do printf "%s\\n" "---CHANNEL $ch---"; timeout 2 ipmitool lan print "$ch" 2>/dev/null; done'


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
                os_mac=None,bmc_mac=None,
                collected_at=item['collected_at'],source='inspection_identity',os_evidence=item)
    expected=binding.get('expected_identity') or {}
    if any(expected.get(k) or binding.get(k) for k in ('hardware_uuid','node_serial')):
        asset=collector.read('asset_identity')
        values=dict(re.findall(r'^(HARDWARE_UUID|NODE_SERIAL)=(.*)$',asset['raw'],re.M))
        for field in ('hardware_uuid','node_serial'):
            value=values.get(field.upper(),'').strip()
            if asset['collection_status']=='SUCCESS' and value: result[field]=value
        result['asset_status']=asset['collection_status']
    transport=collector.transport; target=collector.target
    try:
        text=transport.ssh(target,'os','ip a',20,False).output
        result['os_mac']=os_mac_from_ip(text,binding.get('os_ip'))
    except Exception:
        result['os_mac']=None
    if not include_bmc or not binding.get('bmc_ip'): return result
    try:
        lan=transport.ssh(target,'os',LAN_CHANNELS,45,False).output
        result['bmc_mac']=bmc_mac_from_ip(lan,binding.get('bmc_ip'))
    except Exception:
        result['bmc_mac']=None
    mode=(binding.get('capabilities') or {}).get('bmc_hostname_query') or 'auto'
    # BMC hostname is read over SSH only. A BMC that is unreachable or powered
    # off simply yields no hostname; there is no Redfish fallback by default.
    # A per-node capability can still pin Redfish ('redfish') for the rare BMC
    # that only exposes HostName over Redfish.
    if mode=='redfish':
        _bmc_via_redfish(transport,target,binding,result)
        return result
    _bmc_via_ssh(transport,target,result)
    return result


def _bmc_via_ssh(transport,target,result):
    """Read `hostname` over BMC SSH. Returns True when it yielded a usable answer."""
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
