"""Local inventory edits serialized with job/control snapshot creation."""
import copy
import ipaddress
import re
import threading
from functools import wraps
from .store import Conflict, SAFE_FIELDS, target_reason

MUTEX=threading.RLock()
DECORATIVE={'order','level','rack_u','rack_side','rack_size','rack_parent'}
EDITABLE=set(SAFE_FIELDS)|DECORATIVE|{'manage_ip'}


def synchronized(fn):
    @wraps(fn)
    def wrapped(*args,**kwargs):
        with MUTEX: return fn(*args,**kwargs)
    return wrapped


def local_write(pa,fn):
    @wraps(fn)
    @synchronized
    def wrapped(*args,**kwargs):
        backup=(copy.deepcopy(pa.machines),copy.deepcopy(pa.projects),copy.deepcopy(pa.links),pa._seq)
        try: return fn(*args,**kwargs)
        except BaseException:
            pa.machines,pa.projects,pa.links,pa._seq=backup
            raise
    return wrapped


def validate_machine(pa, name, candidate):
    for key in set(SAFE_FIELDS)-{'os_port','bmc_port','ipmi_port','ipmi_cipher','synthetic','aux_scope_confirmed','capabilities','expected_identity','trust'}:
        if key in candidate and not isinstance(candidate[key],str): raise ValueError('Expected text: '+key)
    for key in ('synthetic','aux_scope_confirmed'):
        if key in candidate and type(candidate[key]) is not bool: raise ValueError('Expected boolean: '+key)
    new_name=candidate['name']
    if not isinstance(new_name,str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,127}',new_name):
        raise ValueError('Invalid machine name')
    if any(n!=name and n.casefold()==new_name.casefold() for n in pa.machines):
        raise ValueError('Machine name must be unique')
    project=candidate.get('project')
    if project not in pa.projects: raise ValueError('Project does not exist')
    profile=candidate.get('cycle_profile',pa.projects[project].get('cycle_profile'))
    if profile not in {None,'','neutrino'}: raise ValueError('Only Neutrino cycle profile is supported')
    if candidate.get('mgx_type','server')!='server': return
    if profile!='neutrino' and pa.projects[project].get('cycle_profile')!='neutrino': return
    if profile!='neutrino' or pa.projects[project].get('cycle_profile')!='neutrino':
        raise ValueError('Machine and project profiles must agree')
    reasons=target_reason(candidate,profile,mode='inventory')
    if reasons: raise ValueError('; '.join(reasons))
    endpoints={str(ipaddress.ip_address(candidate[r+'_ip'])) for r in ('os','bmc')}
    if len(endpoints)!=2: raise ValueError('OS and BMC endpoints must differ')
    pair=(candidate['tray'].casefold(),candidate['node'].casefold())
    for other_name,other in pa.machines.items():
        if other_name==name: continue
        for role in ('os','bmc'):
            try: address=str(ipaddress.ip_address(other.get(role+'_ip','')))
            except ValueError: continue
            if address in endpoints: raise ValueError('Inventory endpoint must be unique')
        if other.get('project')==project and other.get('mgx_type','server')=='server' and pair==(str(other.get('tray','')).casefold(),str(other.get('node','')).casefold()):
            raise ValueError('Tray/node must be unique in project')


@synchronized
def mutate(pa, store, kind, name, method, body):
    if not isinstance(body,dict): raise ValueError('Expected JSON object')
    backup=(copy.deepcopy(pa.machines),copy.deepcopy(pa.projects),copy.deepcopy(pa.links),pa._seq)
    try:
        with store.tx() as db:
            if kind=='machines':
                if name not in pa.machines: raise KeyError(name)
                if method=='DELETE':
                    store.assert_inventory_idle(db,machines=[name])
                    store.assert_scopes_idle(db,pa.machines[name])
                    pa.delete_machine(name)
                else:
                    if set(body)-EDITABLE: raise ValueError('Unsupported inventory field')
                    if set(body)-DECORATIVE:
                        store.assert_inventory_idle(db,machines=[name])
                        store.assert_scopes_idle(db,pa.machines[name])
                    candidate=dict(pa.machines[name],**body)
                    if set(body)-DECORATIVE:
                        validate_machine(pa,name,candidate)
                        store.assert_scopes_idle(db,candidate)
                    pa._validate_rack(candidate,name)
                    del pa.machines[name]; pa.machines[candidate['name']]=candidate
                pa._save_data()
                from .targets import public
                safe=public(pa.machines.get(body.get('name',name),{}))
                return dict(ok=True,machine=safe)
            if kind=='projects':
                if name not in pa.projects: raise KeyError(name)
                if method=='DELETE':
                    store.assert_inventory_idle(db,project=name)
                    return pa.delete_project(name)
                if set(body)-{'name','desc','cycle_profile'}: raise ValueError('Unsupported project field')
                rename=body.get('name',name)
                if not isinstance(rename,str) or not rename.strip(): raise ValueError('Project name required')
                profile=body.get('cycle_profile',pa.projects[name].get('cycle_profile'))
                if profile not in {None,'','neutrino'}: raise ValueError('Only Neutrino cycle profile is supported')
                if rename.strip()!=name or 'cycle_profile' in body: store.assert_inventory_idle(db,project=name)
                if 'cycle_profile' in body: pa.projects[name]['cycle_profile']=profile
                return pa.edit_project(name,pa.AddProject(name=rename,desc=body.get('desc','')))
    except BaseException:
        pa.machines,pa.projects,pa.links,pa._seq=backup
        raise
