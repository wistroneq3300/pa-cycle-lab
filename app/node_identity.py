"""Canonical node identities, explicit physical slots and previewable migration.

No I/O or device access. Legacy slot positions are recorded, never asserted as
verified physical mappings. Replacing an installed node requires a new node ID.
"""
import copy
import hashlib
import json
import uuid


def stable(kind, value):
    return uuid.uuid5(uuid.NAMESPACE_URL, 'pa-next/' + kind + '/' + str(value)).hex


def canonical(machine):
    m = copy.deepcopy(machine)
    m.setdefault('chassis_id', stable('chassis', m.get('id', m.get('name'))))
    entries = m.get('os')
    if entries is None:
        entries = []
        if m.get('os_ip'):
            entry=dict(slot=1, ip=m['os_ip'], user=m.get('os_user', ''),
                                port=m.get('os_port', 22), label='OS 1',
                                **{'pass': m.get('os_pass', '')},
                                bmc_ip=m.get('bmc_ip', ''), bmc_user=m.get('bmc_user', ''),
                                bmc_pass=m.get('bmc_pass', ''),
                                bmc_ssh_port=m.get('bmc_ssh_port') or (m.get('bmc_port') if m.get('bmc_port')!=623 else 22) or 22)
            for field in ('node_id','slot_id','os_hostname','bmc_hostname','credential_ref','credential_version',
                          'expected_identity','trust','ipmi_cipher','ipmi_port','power_domain','aux_domain',
                          'aux_scope_confirmed','capabilities','controller_id','system_uri','console_id',
                          'node_serial','hardware_uuid'):
                if field in m: entry[field]=copy.deepcopy(m[field])
            entries.append(entry)
    slots, ids = set(), set()
    for e in entries:
        slot = e.get('slot')
        if type(slot) is not int or slot < 1 or slot in slots:
            raise ValueError('Invalid or duplicate physical slot; mapping review required')
        slots.add(slot)
        e.setdefault('slot_id', stable('slot', m['chassis_id'] + ':' + str(slot)))
        e.setdefault('node_id', stable('installed-node', e['slot_id']))
        if e['node_id'] in ids:
            raise ValueError('Duplicate node identity')
        ids.add(e['node_id'])
        e.setdefault('mapping_status', 'needs_confirmation')
        e.setdefault('bmc_ssh_port', 22)
        e.setdefault('ipmi_port', 623)
        e.setdefault('binding_revision', 1)
    m['os'] = entries
    m.setdefault('physical_slots', [])
    known = {s['slot'] for s in m['physical_slots']}
    m['physical_slots'].extend(dict(slot=e['slot'], slot_id=e['slot_id']) for e in entries if e['slot'] not in known)
    return m


def slot_entry(machine, slot):
    if type(slot) is not int or slot < 1:
        raise ValueError('Invalid physical slot')
    matches = [e for e in machine.get('os', []) if e.get('slot') == slot]
    if len(matches) != 1:
        raise ValueError('Physical slot is empty, missing or ambiguous')
    return matches[0]


def binding(entry):
    fields = ('node_id', 'slot_id', 'ip', 'user', 'port', 'bmc_ip', 'bmc_user',
              'bmc_ssh_port', 'ipmi_port', 'ipmi_cipher', 'credential_ref',
              'credential_version', 'os_hostname', 'bmc_hostname', 'expected_identity',
              'capabilities', 'power_domain', 'aux_domain', 'controller_id', 'system_uri',
              'mapping_status', 'trust')
    return hashlib.sha256(json.dumps({k: entry.get(k) for k in fields}, sort_keys=True).encode()).hexdigest()


def migrate(document):
    out = copy.deepcopy(document)
    chassis, nodes = set(), set()
    for name, project in out.get('projects', {}).items():
        project.setdefault('project_id', stable('project', name))
        project.setdefault('rack_id', stable('rack', project['project_id']))
    for name, machine in out.get('machines', {}).items():
        if machine.get('mgx_type', 'server') != 'server':
            continue
        m = canonical(dict(machine, name=name))
        if m['chassis_id'] in chassis:
            raise ValueError('Duplicate chassis ID; repair inventory before migration')
        chassis.add(m['chassis_id'])
        for e in m['os']:
            if e['node_id'] in nodes:
                raise ValueError('Duplicate installed node ID')
            nodes.add(e['node_id'])
        out['machines'][name] = m
    out['node_schema_version'] = 1
    return out
