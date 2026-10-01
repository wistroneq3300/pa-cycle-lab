"""One inventory writer, shared SQLite reservations and short mutation transactions."""
import copy
from contextlib import contextmanager
import uuid
import os
import time
from .targets import expand, public, inventory
from .store import Conflict, fingerprint, scopes


def execution(machine):
    # Pure display/selection/placement changes do not redirect an immutable run.
    ignored = {'name', 'label', 'active_os', 'os_alive', 'bmc_alive', 'order', 'rack_u', 'rack_side'}
    if machine.get('os') is not None:
        ignored |= {'os_ip','os_user','os_pass','os_port','bmc_ip','bmc_user','bmc_pass','bmc_port'}
    clean = {k:v for k,v in machine.items() if k not in ignored}
    if 'os' in clean:
        clean['os'] = sorted(({k:v for k,v in e.items() if k != 'label'} for e in clean['os']), key=lambda e:e.get('slot',0))
    return fingerprint(clean)


def install(pa, store_getter):
    saved = copy.deepcopy(pa.machines)
    original = pa._save_data
    def save():
        nonlocal saved
        with pa._DATA_LOCK:
            store = store_getter()
            with store.tx() as db:
                inventory(pa)  # Duplicate installed node IDs cannot be published.
                chassis=[m['chassis_id'] for m in pa.machines.values() if m.get('chassis_id')]
                if len(chassis)!=len(set(chassis)): raise Conflict('Duplicate chassis identity')
                for name in set(saved) | set(pa.machines):
                    before, after = saved.get(name), pa.machines.get(name)
                    from .legacy_observation import caller
                    if caller.get() is not None and before!=after:
                        from fastapi import HTTPException
                        for target in (before,after):
                            if target is not None and not pa._project_allowed(target.get('project'),'operate'):
                                raise HTTPException(403,'Inventory project permission changed before commit')
                    if before is not None and (after is None or execution(before) != execution(after)):
                        store.assert_inventory_idle(db, machines=[name])
                        for t in expand(name,before): store.assert_scopes_idle(db,t)
                    if after is not None and (before is None or execution(before)!=execution(after)):
                        for t in expand(name,after): store.assert_scopes_idle(db,t)
                original()
                saved = copy.deepcopy(pa.machines)
    pa._save_data = save


@contextmanager
def session(store, targets, holder, kind='input'):
    owner = 'session-' + uuid.uuid4().hex
    from contextlib import ExitStack
    from .runner import process_lock
    with ExitStack() as stack:
        if kind=='input':stack.enter_context(process_lock(session_lock_path(store,owner)))
        with store.tx() as db:
            record=dict(id=owner,holder=holder,targets=public(targets),state='OPEN',created_at=time.time(),owner_pid=os.getpid())
            if kind=='input':store.input_session(owner,record)
        try:yield owner
        finally:
            with store.tx() as db:
                if kind=='input':store.input_session(owner,dict(record,state='CLOSED',closed_at=time.time()))


def session_lock_path(store,owner):
    from pathlib import Path
    return Path(store.path).parent/'runtime'/(owner+'.lock')


def session_alive(store,owner):
    from .runner import process_lock
    try:
        with process_lock(session_lock_path(store,owner)):return False
    except (OSError,BlockingIOError):return True
