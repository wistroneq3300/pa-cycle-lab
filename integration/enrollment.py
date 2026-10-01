"""Explicitly authorized, bounded enrollment probes using caller supplied secrets.

Probe before entering the inventory mutation. The legacy handler can consume only
these exact results; it cannot expand the endpoint, command or credential set.
"""
from contextvars import ContextVar
import ipaddress
import re
import uuid
from fastapi import HTTPException
from cycle_core import Target
from cycle_transport import Transport
from .settings import RUNTIME
from .targets import inventory
from .coordinator import session
from .store import Conflict, fingerprint

current = ContextVar('approved_enrollment', default=None)
DISCOVER_BMC = 'ipmitool lan print 2>/dev/null; ipmitool lan print 1 2>/dev/null; command -v ipmitool'


def request_plan(path, body, pa):
    if not isinstance(body, dict): raise ValueError('Enrollment body must be an object')
    endpoints=[]
    def add(host,user,password,port,commands):
        if not host: return
        try: ipaddress.ip_address(host)
        except ValueError: raise ValueError('Enrollment requires a literal IP address')
        if type(port) is not int or not 1<=port<=65535: raise ValueError('Invalid enrollment SSH port')
        if not isinstance(user,str) or not isinstance(password,str) or '**' in password:
            raise ValueError('Explicit enrollment credentials required')
        if not user or not password: raise ValueError('Explicit enrollment credentials required')
        endpoints.append(dict(host=host,user=user,password=password,port=port,commands=commands))
    project=body.get('project')
    if path=='/api/machines':
        add(body.get('os_ip'),body.get('os_user'),body.get('os_pass'),body.get('os_port',22),['hostname'])
        if body.get('bmc_ip') and body.get('bmc_user') and body.get('bmc_pass'):
            add(body['bmc_ip'],body['bmc_user'],body['bmc_pass'],body.get('bmc_port',22),['echo ok','ipmitool lan print 2>/dev/null'])
        for node in body.get('os') or []:
            add(node.get('ip'),node.get('user'),node.get('pass',node.get('pass_')),node.get('port',22),['hostname'])
    elif path=='/api/machines/probe-bmc':
        if body.get('machine_name'): return None  # Registered-target observation uses the existing provider guard.
        add(body.get('os_ip'),body.get('os_user'),body.get('os_pass'),body.get('os_port',22),['hostname',DISCOVER_BMC])
    else:
        match=re.fullmatch(r'/api/machines/([^/]+)/change-(os|bmc)-ip',path)
        if not match: return None
        machine=pa.machines.get(match[1])
        if machine is None: raise KeyError(match[1])
        pa._connection_node(machine,body.get('expected_node_id'),body.get('expected_binding_revision'))
        project=machine.get('project')
        role=match[2]
        add(body.get('new_'+role+'_ip'),body.get(role+'_user'),body.get(role+'_pass'),
            body.get('os_port' if role=='os' else 'bmc_ssh_port',22),['hostname'])
    if len({e['host'] for e in endpoints})!=len(endpoints): raise ValueError('Duplicate enrollment endpoint')
    if project not in pa.projects: raise ValueError('Enrollment requires an existing project')
    if not 1<=len(endpoints)<=64: raise ValueError('Enrollment requires 1..64 explicit endpoints')
    return dict(project=project,purpose=path,endpoints=endpoints)


def prepare(plan, pa, store, provider, actor):
    approve=getattr(provider,'approve_enrollment',None)
    if not provider or not actor or not callable(approve):
        raise HTTPException(503,'Verified enrollment provider required')
    public=dict(project=plan['project'],purpose=plan['purpose'],
                endpoints=[{k:v for k,v in e.items() if k!='password'} for e in plan['endpoints']])
    if not provider.authorize(actor,plan['project'],'enroll') or not approve(actor,public):
        raise HTTPException(403,'Enrollment scope denied')
    with pa._DATA_LOCK:
        hosts={e['host'] for e in plan['endpoints']}
        registered=[t for t in inventory(pa) if hosts & {t.get('os_ip'),t.get('bmc_ip')}]
        if any(not provider.authorize(actor,t.get('project'),'read') for t in registered):
            raise HTTPException(403,'Registered endpoint belongs to a forbidden project')
        probes=[dict(name='enroll-'+uuid.uuid4().hex,os_ip=e['host']) for e in plan['endpoints']]
    results={}
    with session(store,[*registered,*probes],str(actor),kind='enrollment'):
        for e in plan['endpoints']:
            target=Target('enrollment',fingerprint(dict(host=e['host'],port=e['port']))[:16],e['host'],e['host'])
            transport=Transport({'os':e['password']},RUNTIME/'enrollment-host-keys',users={'os':e['user']},ports={'os':e['port']})
            for command in e['commands']:
                result=transport.ssh(target,'os',command,timeout=25)
                key=(e['host'],e['user'],e['password'],e['port'],command)
                # Transport redacts output. Keep all secrets in this transient context only.
                output=result.output
                for endpoint in plan['endpoints']:
                    output=output.replace(endpoint['password'],'[REDACTED]')
                results[key]=(output.strip(),result.code,'' if result.code==0 else 'Enrollment probe failed: '+result.state)
    return results


def consume(host,user,password,port,command,timeout=8):
    results=current.get()
    if results is None: raise Conflict('No approved enrollment context')
    if not isinstance(timeout,(int,float)) or not 0<timeout<=25:
        raise Conflict('Enrollment timeout exceeds approved bound')
    key=(host,user,password,port,command)
    if key not in results: raise Conflict('Endpoint, credential or command is outside the enrollment manifest')
    return results[key]
