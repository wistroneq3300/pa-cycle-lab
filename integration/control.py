"""Durable, single-dispatch manual control. Recovery performs read-only probes."""
import re
import time
from cycle_core import Target
from cycle_engine import IDENTITY
from .settings import RUNTIME
from .store import Conflict


def validate(action, body):
    if action not in {'power', 'reboot'}:
        raise Conflict('Legacy AUX control is disabled')
    if not isinstance(body, dict):
        raise ValueError('Request must be an object')
    metadata = {'node_id', 'expected_binding_revision', 'idempotency_key', 'expected_target'}
    payload = {k:v for k,v in body.items() if k not in metadata}
    if action == 'power' and (set(payload) != {'on'} or type(payload['on']) is not bool):
        raise ValueError('Manual power requires a strict boolean on field')
    if action == 'reboot' and payload:
        raise ValueError('Manual reboot accepts target metadata only')
    for key in metadata - {'expected_target'}:
        if key in body and (not isinstance(body[key], str) or not 1 <= len(body[key]) <= 128):
            raise ValueError('Invalid ' + key)


def identity(transport, target, role):
    check=getattr(transport,'verify_identity',None)
    if check is not None and not check(role): raise Conflict('Provider rejected hardware identity/trust binding')
    result=transport.ssh(target, role, IDENTITY, timeout=15)
    values=dict(re.findall(r'^([A-Z_]+)=(.*)$', result.output, re.M))
    if result.code or result.state != 'RETURNED' or values.get('HOSTNAME','').strip().lower() != getattr(target, role+'_hostname').lower():
        raise Conflict('Target identity mismatch or unavailable')
    if role=='os' and not re.fullmatch(r'[0-9a-fA-F-]{36}',values.get('BOOT_ID','').strip()):
        raise Conflict('Invalid OS boot identity')
    return values


def verify(store, control, transport, target, timeout=120):
    deadline=time.monotonic()+timeout
    while True:
        try:
            identity(transport,target,'bmc')
            power=transport.oob(target,'power status',timeout=15)
            expected='on' if control['action']=='reboot' or control['on'] else 'off'
            matched=power.code==0 and power.state=='RETURNED' and bool(re.fullmatch(r'Chassis Power is '+expected, power.output.strip(), re.I))
            if matched and expected=='on':
                current=identity(transport,target,'os')
                if control['action']=='reboot':
                    boot=current.get('BOOT_ID','').strip()
                    matched=bool(boot and boot != control.get('boot_before'))
            if matched:
                return store.update_control(control['id'],state='CONTROL_COMPLETE',reason='Identity and requested power/boot state reconciled')
        except (Conflict, OSError, RuntimeError):
            pass  # Read-only verification can retry; dispatch never can.
        if time.monotonic()>=deadline:
            return store.update_control(control['id'],state='CONTROL_AMBIGUOUS',reason='Outcome unresolved; reservation retained; read-only reconciliation required')
        time.sleep(min(2,max(0,deadline-time.monotonic())))


def execute(store, machine, action, body, actor, transport, timeout=120, prepared=None):
    from .runner import process_lock
    validate(action,body)
    control=prepared or store.begin_control(machine,action,body.get('on'),actor)
    target=Target(**{k:machine[k] for k in ('tray','node','bmc_ip','os_ip','bmc_hostname','os_hostname')})
    with process_lock(RUNTIME/(control['id']+'.lock')):
        # Reconciliation may have closed a reservation before this worker acquired
        # its OS lock. Never dispatch from a stale prepared record or replay intent.
        control=store.get_control(control['id'])
        if control['state']!='CONTROL_RUNNING' or control['dispatched']: return control
        try:
            identity(transport,target,'bmc')
            before=identity(transport,target,'os') if action=='reboot' else {}
            if action=='reboot' and not before.get('BOOT_ID','').strip():
                raise Conflict('Missing pre-dispatch boot identity')
            # Commit intent BEFORE dispatch. A crash at any later point retains locks.
            control=store.update_control(control['id'],dispatched=True,boot_before=before.get('BOOT_ID','').strip(),state='CONTROL_VERIFYING')
            result=(transport.ssh(target,'os','reboot',sudo=True) if action=='reboot'
                    else transport.oob(target,'power '+('on' if body['on'] else 'off')))
            control=store.update_control(control['id'],outcome=result.state,exit_code=result.code)
            if result.state=='NOT_ISSUED':
                return store.update_control(control['id'],state='CONTROL_FAILED',reason='Command was not issued')
            return verify(store,control,transport,target,timeout)
        except Exception as exc:
            # Do not persist exception text: third party clients may include credentials.
            state='CONTROL_AMBIGUOUS' if control['dispatched'] else 'CONTROL_FAILED'
            return store.update_control(control['id'],state=state,reason=type(exc).__name__+'; '+('outcome unresolved; reservation retained' if control['dispatched'] else 'identity/preparation failed; no command issued'))


def reconcile(store, control_id, transport, timeout=120):
    from .runner import process_lock
    with process_lock(RUNTIME/(control_id+'.lock')):
        control=store.get_control(control_id)
        if control['state'] in {'CONTROL_COMPLETE','CONTROL_FAILED'}: return control
        if not control['dispatched']:
            return store.update_control(control_id,state='CONTROL_FAILED',reason='Interrupted before dispatch intent; no command issued')
        machine=control['target']
        target=Target(**{k:machine[k] for k in ('tray','node','bmc_ip','os_ip','bmc_hostname','os_hostname')})
        return verify(store,control,transport,target,timeout)
