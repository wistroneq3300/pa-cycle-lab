"""One inventory writer, shared SQLite reservations and short mutation transactions."""
import copy
from contextlib import contextmanager
import uuid
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
                    if before is not None and (after is None or execution(before) != execution(after)):
                        store.assert_inventory_idle(db, machines=[name])
                        for t in expand(name,before): store.assert_scopes_idle(db,t)
                    if after is not None and (before is None or execution(before)!=execution(after)):
                        for t in expand(name,after): store.assert_scopes_idle(db,t)
                original()
                saved = copy.deepcopy(pa.machines)
    pa._save_data = save


@contextmanager
def session(store, targets, holder):
    owner = 'session-' + uuid.uuid4().hex
    with store.tx() as db:
        store.reserve(db, owner, [s for t in targets for s in scopes(t)])
    try:
        yield owner
    finally:
        with store.tx() as db:
            db.execute('DELETE FROM locks WHERE owner=?',(owner,))
