"""Read-only PA Next slot adapter. Never resolve through the selected parent OS."""
import copy
import uuid
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"app"))
import node_identity
from .store import SAFE_FIELDS, fingerprint


def identity(parent, slot=None):
    seed = str(parent.get('chassis_id') or parent.get('id') or parent['name'])
    return uuid.uuid5(uuid.NAMESPACE_URL, 'pa-cycle-lab/chassis/' + seed +
                      (('/slot/' + str(slot)) if slot is not None else '')).hex


def expand(name, parent):
    parent = dict(parent, name=name)
    if parent.get('os') is not None: parent = node_identity.canonical(parent)
    entries = parent.get('os')
    if entries == []:
        return  # Canonical empty chassis is not an implicit primary node.
    if entries is None:
        yield {k: copy.deepcopy(parent[k]) for k in SAFE_FIELDS if k in parent}
        return
    seen = set()
    for entry in entries:
        if not isinstance(entry, dict):
            raise ValueError('Invalid OS slot record: ' + name)
        slot = entry.get('slot')
        if type(slot) is not int or slot < 1 or slot in seen:
            raise ValueError('OS slots must have unique positive physical positions: ' + name)
        seen.add(slot)
        if entry.get('empty'):
            continue
        node_id = entry.get('node_id') or identity(parent, slot)
        target = {k: copy.deepcopy(parent[k]) for k in (
            'project', 'project_id', 'rack_id', 'tray', 'synthetic', 'mgx_type', 'cycle_profile') if k in parent}
        # Safety/identity/control scope belongs to the installed node. No active-OS fallback.
        for key in SAFE_FIELDS:
            if key in entry:
                target[key] = copy.deepcopy(entry[key])
        target.update(name=node_id, node_id=node_id, parent_name=name,
                      chassis_id=parent.get('chassis_id') or identity(parent),
                      slot_id=entry['slot_id'], slot_key='N' + str(slot), node=entry.get('node') or 'n' + str(slot),
                      display_name=name + ' / ' + entry.get('label', 'N' + str(slot)),
                      os_ip=entry.get('ip', ''), os_user=entry.get('user', ''),
                      os_port=entry.get('port', 22), bmc_ip=entry.get('bmc_ip', ''),
                      bmc_user=entry.get('bmc_user', ''), bmc_port=entry.get('bmc_ssh_port', 22))
        target['revision'] = node_identity.binding(entry)
        yield target


def inventory(pa):
    result = []
    for name, parent in pa.machines.items():
        project = pa.projects.get(parent.get('project'), {})
        extra={k:v for k,v in dict(project_id=project.get('project_id'),rack_id=parent.get('rack_id') or project.get('rack_id')).items() if v is not None}
        result.extend(expand(name, dict(parent,**extra)))
    ids = [t['name'] for t in result]
    if len(ids) != len(set(ids)):
        raise ValueError('Duplicate installed node identity')
    return result


def resolve_target(pa, node_id, expected_revision=None):
    target = next((t for t in inventory(pa) if t['name'] == node_id), None)
    if target is None:
        raise KeyError(node_id)
    if expected_revision is not None and target.get('revision') != expected_revision:
        raise ValueError('Target revision changed; refresh and confirm again')
    return target


def public(value):
    """Recursively redact imported inventory, including nested slots."""
    if isinstance(value, dict):
        return {k: public(v) for k, v in value.items()
                if not any(term in k.lower() for term in ('pass', 'secret', 'token', 'authorization', 'private_key', 'privatekey', 'environment', 'headers'))}
    if isinstance(value, list):
        return [public(v) for v in value]
    return value
