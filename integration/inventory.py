"""Local inventory edits serialized with job/control snapshot creation."""
import copy
import ipaddress
import re
import threading
from functools import wraps
from .store import Conflict, SAFE_FIELDS, target_reason

MUTEX=threading.RLock()
DECORATIVE={'order','level','rack_u','rack_side','rack_size','rack_parent'}
EDITABLE=set(SAFE_FIELDS)|DECORATIVE|{'manage_ip','expected_node_id','expected_binding_revision','os_pass','bmc_pass'}
EDITABLE-={'node_id','chassis_id','slot_id','slot_key','project_id','rack_id','revision','parent_name','display_name','synthetic'}
NODE_BINDING={'os_hostname','bmc_hostname','ipmi_cipher','power_domain','aux_domain','aux_scope_confirmed',
              'credential_ref','credential_version','controller_id','system_uri','console_id','node_serial',
              'hardware_uuid','mapping_status','capabilities','expected_identity','trust'}


def validate_binding(updates):
    for key,value in updates.items():
        if key in {'capabilities','expected_identity','trust'}:
            if not isinstance(value,dict):raise ValueError('Expected object: '+key)
        elif key=='aux_scope_confirmed':
            if type(value) is not bool:raise ValueError('Expected boolean: '+key)
        elif key=='ipmi_cipher':
            if type(value) is not int or not 0<=value<=255:raise ValueError('Invalid IPMI cipher')
        elif not isinstance(value,str):raise ValueError('Expected text: '+key)


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
    if candidate.get('os') is not None:
        # A chassis is not itself a Cycle target. Validate installed-node
        # connections without requiring a runnable Cycle profile or power scope.
        addresses=set()
        for entry in candidate['os']:
            for field in ('ip','bmc_ip'):
                if entry.get(field): ipaddress.ip_address(entry[field])
            for field,default in (('port',22),('bmc_ssh_port',22),('ipmi_port',623)):
                value=entry.get(field,default)
                if type(value) is not int or not 1<=value<=65535: raise ValueError('Invalid port: '+field)
            if entry.get('ip'):
                address=str(ipaddress.ip_address(entry['ip']))
                if address in addresses: raise ValueError('Duplicate sibling OS endpoint')
                addresses.add(address)
        for other_name,other in pa.machines.items():
            if other_name==name: continue
            for entry in other.get('os',[]) or [{'ip':other.get('os_ip')}]:
                try: address=str(ipaddress.ip_address(entry.get('ip','')))
                except ValueError: continue
                if address in addresses: raise ValueError('OS endpoint already registered')
        return
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
def mutate(pa, store, kind, name, method, body, authorize_project=None):
    if not isinstance(body,dict): raise ValueError('Expected JSON object')
    backup=(copy.deepcopy(pa.machines),copy.deepcopy(pa.projects),copy.deepcopy(pa.links),pa._seq)
    try:
        with store.tx() as db:
            if authorize_project is not None:
                authorize_project(pa.machines[name].get('project') if kind=='machines' else name)
                if 'project' in body: authorize_project(body['project'])
                if kind=='projects' and body.get('name',name)!=name: authorize_project(body['name'])
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
                    # Reuse Next's domain rules before adding Cycle binding fields.
                    candidate=pa._machine_candidate(name,body)
                    binding_updates={k:copy.deepcopy(v) for k,v in body.items() if k in NODE_BINDING}
                    if binding_updates:
                        validate_binding(binding_updates)
                        if authorize_project is not None:authorize_project(candidate.get('project'),'configure_control')
                        from .targets import public
                        if public(binding_updates)!=binding_updates:raise ValueError('Secrets are not control metadata')
                        if candidate.get('os') is not None:
                            original=pa._connection_node(pa.machines[name],body.get('expected_node_id'),body.get('expected_binding_revision'))
                            node=next(e for e in candidate['os'] if e['node_id']==original['node_id'])
                            node.update(binding_updates)
                            if pa.node_identity.binding(node)!=pa.node_identity.binding(original):
                                node['binding_revision']=int(original.get('binding_revision',1))+1
                    native={'project','order','level','mgx_type','rack_mount','rack_u','rack_size','rack_side',
                            'bmc_ip','bmc_user','bmc_port','use_c17','os_ip','os_user','os_port','ipmi_port',
                            'expected_node_id','expected_binding_revision','os_pass','bmc_pass'}
                    for field,value in body.items():
                        if field not in native and not (candidate.get('os') is not None and field in NODE_BINDING): candidate[field]=copy.deepcopy(value)
                    if set(body)-DECORATIVE:
                        validate_machine(pa,name,candidate)
                        store.assert_scopes_idle(db,candidate)
                    pa._validate_rack(candidate,name)
                    del pa.machines[name]; pa.machines[candidate['name']]=candidate
                pa._save_data()
                pa._invalidate_machine_cache(name)
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
