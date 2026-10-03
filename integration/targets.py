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
        target = {k: copy.deepcopy(parent[k]) for k in SAFE_FIELDS if k in parent}
        # Only fill node when inventory already has a usable value; otherwise leave it
        # absent (an unset node is a legitimate blocker) rather than adopting a machine
        # name that may contain spaces/invalid chars.
        node = target.get('node') or target.get('os_hostname')
        if node: target['node'] = node
        target['tray'] = target.get('tray') or target.get('project') or name
        target['power_domain'] = target.get('power_domain') or (str(target.get('project') or name) + '-' + str(node or name))
        # Single-OS machines keep credentials at the machine level (legacy names).
        if parent.get('os_pass') and not target.get('os_password'):
            target['os_password'] = parent['os_pass']
        if parent.get('bmc_pass') and not target.get('bmc_password'):
            target['bmc_password'] = parent['bmc_pass']
        yield target
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
        # 實體 slot 以 'pass' 存 OS 密碼（legacy 欄位名），映射到統一安全欄位 os_password。
        if entry.get('pass') and not target.get('os_password'):
            target['os_password'] = entry['pass']
        if entry.get('bmc_pass') and not target.get('bmc_password'):
            target['bmc_password'] = entry['bmc_pass']
        # tray/node are derived, never stored: tray = owning project, node = OS hostname
        # (falling back to the slot's node, then the synthetic 'n<slot>'). Never use the
        # label: it is a display string that may contain spaces/invalid node characters.
        node = entry.get('os_hostname') or entry.get('node') or 'n' + str(slot)
        target.update(name=node_id, node_id=node_id, parent_name=name,
                      chassis_id=parent.get('chassis_id') or identity(parent),
                      slot_id=entry['slot_id'], slot_key='N' + str(slot), node=node,
                      tray=parent.get('tray') or parent.get('project') or name,
                      display_name=name + ' / ' + entry.get('label', 'N' + str(slot)),
                      os_ip=entry.get('ip', ''), os_user=entry.get('user', ''),
                      os_port=entry.get('port', 22), bmc_ip=entry.get('bmc_ip', ''),
                      bmc_user=entry.get('bmc_user', ''), bmc_port=entry.get('bmc_ssh_port', 22))
        # Every node is its own power domain by default; a real shared domain can be
        # supplied explicitly in inventory when one busbar powers several nodes.
        target['power_domain'] = target.get('power_domain') or parent.get('power_domain') or (str(target.get('project') or name) + '-' + str(node))
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


def resolve_control_target(pa, url_target, body):
    """Legacy chassis URLs must bind to an explicit installed node and revision."""
    from .store import Conflict
    for field in ('node_id', 'expected_binding_revision', 'idempotency_key'):
        if not isinstance(body.get(field), str) or not 1 <= len(body[field]) <= 128:
            raise ValueError('Required control field: ' + field)
    target = resolve_target(pa, body['node_id'])
    if url_target not in {target['name'], target.get('parent_name')}:
        raise Conflict('URL and requested node do not match')
    if target.get('revision') != body['expected_binding_revision']:
        raise Conflict('Target binding changed; review the current node before dispatch')
    expected = body.get('expected_target')
    if expected is not None:
        if not isinstance(expected, dict) or expected.get('node_id') != target['node_id'] or expected.get('expected_binding_revision') != target['revision']:
            raise Conflict('Displayed target differs from the requested binding')
    return target
