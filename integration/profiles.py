"""Local administrator-owned validation packages; never accept commands from Web clients.

Activation stores a complete validated package in SQLite. A run freezes the package,
checker and policy under the same transaction as its reservations.
"""
import copy
import json
import re
import shlex
from .settings import ENGINE

# Measurement semantics are checker contracts, not UI labels for physical parts.
MEASUREMENTS = {
    'cpu': ('CPU_MIN','populated_cpu_packages','packages',2,'minimum','CPU'),
    'dimm': ('DIMM_EXPECTED','installed_memory_devices','devices',16,'exact','DIMM'),
    'nvme': ('NVMe_MIN','unique_nvme_controllers','controllers',2,'minimum','NVMe'),
    'nic': ('NIC_MIN','mst_vera_unique_bdf','pci_functions',22,'minimum','NIC'),
    'bf4': ('BF4_EXPECTED','vpd_unique_board_serial','physical_cards',1,'exact','BF4'),
    'pcie_fabric': ('PCIEFAB_MIN','nvidia_bridge_functions','pci_functions',20,'minimum','PCIeFAB'),
    'usb': ('USB_MIN','usb_controller_functions','pci_functions',1,'minimum','USB'),
    'bmc': ('BMC_MIN','ast1150_functions','pci_functions',1,'minimum','BMC'),
}


def default_package():
    actions={}
    for mode in ('reboot','power_cycle','aux_cycle'):
        for channel in ('inband','outband'):
            role='bmc' if mode=='aux_cycle' else 'os' if channel=='inband' else 'oob'
            argv=['/usr/bin/stbypowerctrl.sh','aux_cycle'] if mode=='aux_cycle' else (
                ['reboot'] if mode=='reboot' and channel=='inband' else
                ['power','reset' if mode=='reboot' else 'cycle'])
            if mode=='power_cycle' and channel=='inband':argv=['ipmitool','power','cycle']
            actions[mode+':'+channel]=dict(executor='ipmi' if role=='oob' else 'ssh',
                endpoint_role=role,argv=argv,sudo=role=='os',timeout=30,
                scope='node' if mode=='reboot' and channel=='inband' else 'aux_domain' if mode=='aux_cycle' else 'power_domain',
                selector='existing-verified-binding',recovery='boot-id-change')
    return dict(schema_version=1,profile_id='neutrino',revision=1,
        expectations={key:dict(measurement=v[1],unit=v[2],value=v[3],mode=v[4],enabled=True)
                      for key,v in MEASUREMENTS.items()},
        thresholds=dict(memory_min_ratio=.9),actions=actions,hooks=[])


def validate(package):
    p=copy.deepcopy(package)
    if not isinstance(p,dict) or set(p)!=set(default_package()):raise ValueError('Invalid profile fields')
    if p['schema_version']!=1 or type(p['revision']) is not int or p['revision']<1:raise ValueError('Invalid profile revision/schema')
    if not isinstance(p['profile_id'],str) or not re.fullmatch(r'[a-z][a-z0-9_-]{0,63}',p['profile_id']):raise ValueError('Invalid profile ID')
    if set(p['expectations'])!=set(MEASUREMENTS):raise ValueError('Every measurement needs an explicit expectation')
    for key,spec in MEASUREMENTS.items():
        e=p['expectations'][key]
        if set(e)!={'measurement','unit','value','mode','enabled'} or (e['measurement'],e['unit'])!=spec[1:3]:raise ValueError('Incorrect measurement/unit: '+key)
        if type(e['enabled']) is not bool or type(e['value']) is not int or not 0<=e['value']<=1000000 or e['mode'] not in {'exact','minimum'}:raise ValueError('Invalid expectation: '+key)
    if set(p['thresholds'])!={'memory_min_ratio'} or type(p['thresholds']['memory_min_ratio']) not in (int,float) or not 0<p['thresholds']['memory_min_ratio']<=1:raise ValueError('Invalid memory threshold')
    if p['hooks']!=[]:raise ValueError('Additional checker hooks are not supported by schema 1; do not silently ignore them')
    defaults=default_package()['actions']
    if set(p['actions'])!=set(defaults):raise ValueError('Every mode/channel needs an explicit action')
    for key,a in p['actions'].items():
        d=defaults[key]
        if set(a)!=set(d):raise ValueError('Invalid action fields')
        for field in ('executor','endpoint_role','scope','selector','recovery','sudo'):
            if a[field]!=d[field] or (field=='sudo' and type(a[field]) is not bool):raise ValueError('Unsupported action contract: '+field)
        if type(a['timeout']) is not int or not 1<=a['timeout']<=300:raise ValueError('Invalid action timeout')
        argv=a['argv']
        if not isinstance(argv,list) or not argv or any(not isinstance(x,str) or not re.fullmatch(r'[A-Za-z0-9_./:=+-]{1,256}',x) for x in argv):raise ValueError('Action requires literal argv without shell syntax or secrets')
        # Executable identity and adapter semantics cannot be swapped by configuration.
        if argv[0]!=d['argv'][0] or (a['executor']=='ipmi' and argv!=d['argv']):raise ValueError('Unsupported executor command')
    return p


def checker_slug(project_name):
    """Project name -> filesystem-safe slug (case-insensitive) used to pick the checker script.

    Spaces / punctuation collapse to a single '_'; e.g. 'L11 Test' -> 'l11_test',
    'Drogan Curv' -> 'drogan_curv', 'Vader-OTS' -> 'vader-ots'.
    """
    return re.sub(r'[^a-z0-9_-]', '_', str(project_name or '').lower()).strip('_')


def checker_script_path(project_name):
    """Return the per-project checker script Path for a project name, or None if absent.

    Never falls back to another project's script: a missing file means the caller must
    surface an explicit error rather than silently run the wrong expectations.
    """
    if not project_name:
        return None
    path = ENGINE / (checker_slug(project_name) + '_config.sh')
    return path if path.is_file() else None


def checker_missing_message(project_name):
    slug = checker_slug(project_name)
    return f'找不到 checker 腳本 {ENGINE}/{slug}_config.sh，請先放置該專案的 {slug}_config.sh'


class CheckerMissing(ValueError):
    """The selected project has no <project>_config.sh; surfaced as HTTP 404, never a fallback."""


def freeze(package, source, project_name=None):
    from .store import fingerprint
    p = validate(package)
    path = checker_script_path(project_name)
    if path is None:
        raise CheckerMissing(checker_missing_message(project_name))
    script = path.read_text(encoding='utf-8').replace('\r\n', '\n')
    # Counts come from the project's own checker (<project>_config.sh): the profile no
    # longer injects CPU_MIN/DIMM_EXPECTED/... . Only the enable/mode switches are frozen.
    parameters=[]
    for key,spec in MEASUREMENTS.items():
        e=p['expectations'][key]
        parameters.extend([f'PROFILE_{spec[5]}_ENABLED={int(e["enabled"])}',f'PROFILE_{spec[5]}_MODE={e["mode"]}'])
    parameters.append('MEMORY_MIN_RATIO='+str(p['thresholds']['memory_min_ratio']))
    marker='# PROFILE_PARAMETERS'
    if script.count(marker)!=1:raise ValueError('Checker does not expose the reviewed profile parameter contract')
    script=script.replace(marker,marker+'\n'+'\n'.join(parameters))
    frozen=dict(package=p,checker=script,policy=(ENGINE/'issue_policy.md').read_text(encoding='utf-8'),source=source)
    return dict(frozen,content_hash=fingerprint(frozen))


def activate(store,project_id,package):
    from .store import encode, fingerprint, Conflict
    if not isinstance(project_id,str) or not project_id.strip():raise ValueError('Stable project ID required')
    p=validate(package)
    with store.tx() as db:
        old=db.execute('SELECT package FROM validation_profiles WHERE project_id=?',(project_id,)).fetchone()
        if old:
            previous=json.loads(old[0])
            if previous==p:return p
            if p['revision']<=previous['revision']:raise Conflict('Activation requires a newer revision')
        db.execute('INSERT OR REPLACE INTO validation_profiles VALUES(?,?,?)',(project_id,encode(p),fingerprint(p)))
    return p


def resolve(db,project_id,legacy_profile=None,project_name=None):
    row=db.execute('SELECT package FROM validation_profiles WHERE project_id=?',(project_id,)).fetchone() if project_id else None
    if row:return freeze(json.loads(row[0]),'activated:'+project_id,project_name)
    if legacy_profile=='neutrino':return freeze(default_package(),'bundled:neutrino',project_name)
    return None


def action(snapshot,mode,channel):
    a=snapshot['package']['actions'][mode+':'+channel]
    return a['endpoint_role'],shlex.join(a['argv']),a['sudo'],a['timeout']
