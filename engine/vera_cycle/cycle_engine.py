"""Campaign node execution, with immutable PRE and durable evidence."""
from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime
import re
import shlex
import time
from pathlib import Path

from cycle_core import (
    EvidencePersistenceError,
    atomic_write,
    classify_against_pre,
    compare_sensors,
    config_issues,
    dmesg_issues,
    health,
    issue,
    issue_baseline,
    missing_sensors,
    nic_slot_issues,
    now,
    filter_pci_verbose,
    merge_pci_devices,
    parse_pci,
    parse_pci_verbose,
    parse_hardware_checks,
    parse_sensors,
    pci_issues,
    redfish_collection,
    redfish_delta,
    redfish_entries,
    redfish_member_kind,
    redfish_page_next_link,
    redfish_verdict,
    sel_delta,
    sel_records,
    sensor_issues,
    write_json,
)
from cycle_transport import Command, IdentityUnsafe
from validation_collectors import Operation, execute_operation, OPERATIONS, core_version
from validation_rules import _entry_field

PACKAGES = {"lspci": "pciutils", "dmidecode": "dmidecode", "nvme": "nvme-cli",
            "ipmitool": "ipmitool", "lsusb": "usbutils", "ip": "iproute2"}
IDENTITY = "printf 'HOSTNAME='; hostname; printf 'BOOT_ID='; cat /proc/sys/kernel/random/boot_id"
CAPTURES = {
    "pci": ("lspci -Dnn", False), "pci_tree": ("lspci -Dtv", False),
    "pci_verbose": ("lspci -Dvvv", True), "pci_config": ("lspci -Dxxx", True),
    "disks": ("lsblk", False), "nvme": ("nvme list", True),
    "usb": ("lsusb", False), "memory": ("free -m", False),
    "network": ("ip address show", False), "dmesg": ("dmesg", True),
    "firmware": ("dmidecode -t bios", True),
    "system": ("uname -a; cat /etc/os-release; lscpu", False),
}

def new_record(phase):
    return dict(phase=phase, started=now(), finished=None, status="PENDING", issues=[],
                evidence=[], commands={}, identities={}, pci={}, pci_devices={}, sensors=[], action=[], recovery={},
                # Marks records written by the SEL evidence-aware schema. The
                # renderer uses this to distinguish an unfinished new record
                # from an old record that never retained SEL metadata.
                sel_evidence_schema=1)

class NodeSession:
    def __init__(self, target, transport, root, run_id, script, script_hash, options, rules):
        self.target, self.transport, self.root = target, transport, Path(root)
        self.run_id, self.script, self.script_hash = run_id, script, script_hash
        self.options, self.rules = options, rules
        self.remote = f"/var/tmp/vera-{run_id}-{target.key}-{script_hash[:12]}.sh"
        # Optional stage reporter set by the campaign; keeps one_loop silent when
        # a NodeSession is driven directly (tests, dry-run).
        self.progress = None
        self.dispatch_guard = None
        self.observer = None
        self._observed_record = None
        self._observed_issues = {}
        self.node = dict(key=target.key, target=target.__dict__, blocked=[], active=True,
                         pre=new_record("PRE"), loops=[], completed=0, attempts=0, boot_confirmed=0, valid_cycles=0, stop_reason="", stage="")
        self.baseline = None
        self.pre_issue_keys = {}
        self.upload_attempted = False
        self.script_verified = False
        # Set true only when the hardware script is confirmed to have run to
        # completion (transport RETURNED, a single legal RESULT, and that RESULT
        # is the last line). A verified file+SHA is NOT execution proof, so this
        # gates post_complete/completed/valid_cycle independently of health.
        self.hardware_execution_complete = False
        self.dmesg_seen = {}
        self.expected_boot = None
        self.cleanup_safe = True

    def safe_error(self, exc):
        redact=getattr(self.transport,'redact',None)
        return redact(str(exc)) if redact else type(exc).__name__

    def event(self, record, level, kind, message, detail='', evidence='', phase=None):
        """Optional structured observer; does not execute or retry any command."""
        if self.observer:
            self.observer(dict(level=level,event_type=kind,message=message,detail=detail,evidence=evidence,
                               phase=phase or ('PRE' if record['phase']=='PRE' else 'START' if record['phase']=='START' else 'CYCLE'),
                               loop=record.get('loop',0),tray=self.target.tray,node=self.target.node))

    def issue_events(self, record):
        if not self.observer: return
        if self._observed_record is not record:
            self._observed_record=record; self._observed_issues={}
        for index,item in enumerate(record['issues']):
            classification='PRE_EXISTING' if record['phase']=='PRE' else item.get('classification','NEW')
            signature=(item['severity'],classification,item.get('occurrence_count',1))
            if self._observed_issues.get(index)==signature: continue
            self.event(record,item['severity'],'ISSUE_'+classification,
                       f"{classification} issue: {item['code']} ({item['component']})",
                       detail=item.get('detail',''),evidence=item.get('evidence',''),
                       phase='PRE' if record['phase']=='PRE' else 'POST' if record.get('post_started') else 'CYCLE')
            self._observed_issues[index]=signature

    def stage(self, text):
        """Report the current phase for this node so the operator can see where
        the loop is, or where it is stuck. Evidence failures stop execution."""
        self.node["stage"] = text
        if self.progress:
            try:
                self.progress(f"{self.target.key} | {text}")
            except EvidencePersistenceError:
                raise
            except Exception:
                pass

    def folder(self, record):
        if record["phase"] == "START":
            return self.root / self.target.key / "start"
        return self.root / self.target.key / ("" if record["phase"] == "PRE" else f"loop{record['loop']:04d}")

    def cleanup_remote(self):
        """Remove the temporary hardware script this run pushed to the node.
        Best effort: a node that is offline or reprovisioned must not turn
        teardown into an error. Only this run's own file is touched, and a
        node that was never used (blocked at PRE) is not contacted at all."""
        if self.node["blocked"] or not self.cleanup_safe:
            return
        script = shlex.quote(self.remote)
        try:
            self.transport.ssh(self.target, "os", f"rm -f {script}", 30, True)
        except Exception:
            pass

    def persist(self, record):
        if record["phase"] == "PRE":
            classify_against_pre(record["issues"], set())
        else:
            classify_against_pre(record["issues"], self.pre_issue_keys)
        write_json(self.folder(record) / ("pre_report.json" if record["phase"] == "PRE" else "report.json"), record)
        self.issue_events(record)

    def finish(self, record, preserve_timing=False):
        finished = record.get("finished") if preserve_timing else None
        record.update(status=health(record["issues"]), finished=finished or now())
        began = record.get("cycle_started", record["started"])
        record["duration_seconds"] = max(0, (datetime.fromisoformat(record["finished"]) - datetime.fromisoformat(began)).total_seconds())
        record['check_summary'] = {name: ('PASS' if command.get('valid') else 'FAIL')
                                   for name, command in record['commands'].items()}
        record['check_summary'].update(record.get('hardware_checks', {}))
        # Redfish logs report their own worst-severity verdict; a service that is
        # simply absent (merged BMC build) stays PASS rather than a failure.
        for stem in ('eventlog', 'redfish_sel'):
            meta = record.get(f'{stem}_meta')
            if not meta:
                continue
            if not meta.get('present'):
                record['check_summary'][stem] = 'PASS'
            elif meta.get('verdict'):
                record['check_summary'][stem] = meta['verdict']
        for item in record['issues']:
            code, component = item['code'], item['component']
            stem = ('dmesg' if code.startswith('DMESG_') or 'dmesg' in component else
                    'sensor' if code.startswith('SENSOR_') else
                    'pci' if code in {'PCI_DRIFT', 'PCI_EMPTY'} else
                    'eventlog' if code.startswith('REDFISH_') and component == 'eventlog' else
                    'redfish_sel' if code.startswith('REDFISH_') and component == 'redfish_sel' else
                    component if component in record['commands'] else
                    'recovery' if component == 'recovery' else 'hardware')
            if record['check_summary'].get(stem) != 'FAIL':
                record['check_summary'][stem] = item['severity']
        record['dmesg_delta'] = {severity: sum(i.get('occurrence_count', 1) for i in record['issues']
                                            if i['code'].startswith('DMESG_') and i['severity'] == severity)
                                  for severity in ('WARN', 'FAIL')}
        if record['commands'].get('hardware', {}).get('state') == 'BLOCKED':
            record['check_summary']['hardware'] = 'BLOCKED'
        self.persist(record)
        return record

    def add(self, record, code, component, detail, severity="FAIL", evidence="", snippet=""):
        record["issues"].append(issue(code, component, detail, severity, evidence, snippet))

    def command(self, record, stem, role, cmd, sudo=False, timeout=90, check=True,
                save_evidence=True, record_command=True, include_output=True, filter_output=None, acquired=None):
        collection=stem in CAPTURES or stem in {'sensor','sensor_retry','sensor_confirm','sel','hardware','bmc_firmware','power','host_power'}
        phase='POST' if record.get('post_started') else 'PRE' if record['phase']=='PRE' else 'CYCLE'
        if collection: self.event(record,'POST' if phase=='POST' else 'PRE' if phase=='PRE' else 'INFO','COLLECTION_STARTED','Collecting '+stem,phase=phase)
        try:
            result = acquired if acquired is not None else execute_operation(self.transport,self.target,Operation(role,cmd,sudo,timeout))
        except IdentityUnsafe:
            raise
        except (ConnectionError, TimeoutError, OSError) as exc:
            if not check:
                raise
            result = Command(255, self.safe_error(exc), 'NOT_ISSUED')
        evidence = ""
        if save_evidence:
            filename = f"pre_{stem}.txt" if record["phase"] == "PRE" else f"{stem}.txt"
            path = self.folder(record) / filename
            evidence = path.relative_to(self.root).as_posix()
            body = result.output if include_output else "[Command output suppressed; status retained in this evidence file.]\n"
            if filter_output is not None:
                body = filter_output(body)
            atomic_write(path, f"UTC+8: {now()}\nRole: {role}\nCommand: {cmd}\nExit: {result.code}\nState: {result.state}\nDuration: {result.duration:.2f}s\n\n{body}")
            record["evidence"].append(evidence)
        ipmi_error = (role == "oob" or cmd.startswith("ipmitool ")) and bool(re.search(r"(?:Get .+ command failed|Unable to establish|Error:|No response from|Invalid command)", result.output, re.I))
        valid = result.code == 0 and not ipmi_error
        if record_command:
            record["commands"][stem] = {"command": cmd, "role": role, "code": result.code, "state": result.state, "evidence": evidence, "valid": valid, "output_excerpt": result.output[-2000:] if not valid else ""}
        if check and result.code != 0:
            self.add(record, "COLLECTION_FAILED", stem, f"Exit {result.code} ({result.state}); see evidence", evidence=evidence)
            record['issues'][-1]['snippet'] = result.output[-2000:]
        elif check and ipmi_error:
            self.add(record, "IPMI_REPORTED_ERROR", stem, "IPMI reported a transport/command error despite exit zero; see evidence", evidence=evidence)
            record['issues'][-1]['snippet'] = result.output[-2000:]
        self.persist(record)
        if collection:
            self.event(record,'INFO' if valid else 'WARN','COLLECTION_FINISHED',
                       'Collection returned: '+stem,detail=f'exit={result.code}; state={result.state}; collection success is not hardware health',
                       evidence=evidence,phase=phase)
        return result

    def identity(self, record, role, stem=None, timeout=30, save_evidence=True, record_command=True, observe=True):
        if observe: self.event(record,'INFO','IDENTITY_CHECK',role.upper()+' identity check')
        result = self.command(record, stem or (role + "_identity"), role, IDENTITY, timeout=timeout,
                              check=False, save_evidence=save_evidence, record_command=record_command)
        if result.code:
            raise ConnectionError(f"{role} identity unavailable: exit {result.code} ({result.state})")
        values = dict(re.findall(r"^(HOSTNAME|BOOT_ID)=(.*)$", result.output, re.M))
        expected = getattr(self.target, role + "_hostname")
        actual = values.get("HOSTNAME", "").strip()
        if not expected or actual.lower().rstrip(".") != expected.lower().rstrip("."):
            raise IdentityUnsafe(f"{role} hostname mismatch: expected '{expected}', received '{actual}'")
        if role == "os" and not re.fullmatch(r"[0-9a-fA-F-]{36}", values.get("BOOT_ID", "").strip()):
            raise IdentityUnsafe("OS did not provide a valid boot ID")
        record["identities"][role] = dict(hostname=actual, boot_id=values.get("BOOT_ID", "").strip())
        if observe: self.event(record,'PASS','IDENTITY_VERIFIED',role.upper()+' identity verified',evidence=record['commands'].get(stem or role+'_identity',{}).get('evidence',''))
        return record["identities"][role]

    def dependencies(self, record):
        self.event(record,'PRE','DEPENDENCY_CHECK','Checking OS dependencies')
        probe = "; ".join(f"command -v {tool} >/dev/null 2>&1 || printf 'MISSING={tool}\\n'" for tool in PACKAGES)
        result = self.command(record, "dependencies", "os", probe, check=False)
        if result.code:
            self.add(record, "DEPENDENCY_CHECK", "packages", "Could not inspect OS dependencies")
            return
        missing = re.findall(r"^MISSING=(\w+)$", result.output, re.M)
        if missing:
            packages = " ".join(sorted({PACKAGES[name] for name in missing}))
            cmd = "command -v apt-get >/dev/null && apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y " + packages
            installed = self.command(record, "package_install", "os", cmd, sudo=True, timeout=900, check=False)
            if installed.code:
                self.add(record, "PACKAGE_INSTALL_FAILED", "packages", f"Automatic install failed for {packages}; exit {installed.code}")
            # The subsequent full capture is always after the installation attempt.
            verified = self.command(record, "dependencies_after_install", "os", probe, check=False)
            if verified.code or "MISSING=" in verified.output:
                self.add(record, "DEPENDENCY_MISSING", "packages", "Required OS tools remain unavailable; see installation evidence")
        mst = self.command(record, "mst_available", "os", "command -v mst", check=False)
        if mst.code:
            self.add(record, "MST_MISSING", "MST", "mst is expected in the OS image; automatic MFT installation is disabled")
        self.event(record,'PRE','DEPENDENCY_CHECK_COMPLETE','Dependency checks completed; findings retained in PRE',evidence=record['commands'].get('dependencies',{}).get('evidence',''))

    def ensure_verified_script(self, record):
        """Upload once; all later executions require the same safe file and SHA."""
        self.script_verified = False
        if not self.upload_attempted:
            self.upload_attempted = True
            self.transport.upload(self.target, self.script, self.remote)
        remote = shlex.quote(self.remote)
        safety = self.command(record, 'script_safety', 'os',
                              f'test -f {remote} && test ! -L {remote} && '
                              f'test "$(stat -c %u:%a {remote})" = "$(id -u):700"')
        if safety.code:
            raise RuntimeError('Hardware script type, owner or permissions are unsafe')
        verify = self.command(record, 'script_sha256', 'os', 'sha256sum ' + remote)
        words = verify.output.split()
        if verify.code or not words or words[0] != self.script_hash:
            raise RuntimeError('Remote hardware script hash verification failed; no execution')
        self.script_verified = True

    def collect_dmesg(self, record, stem, clear=False, save_evidence=None, evidence_stem=None,
                      wipe_only=False):
        # The plain ``dmesg`` read only establishes the baseline count; its
        # buffer is re-read verbatim by ``dmesg -c`` moments later, so keeping
        # both files would double the largest evidence artefact. Only the
        # clear variant is retained on disk, and events seen by the non-clear
        # read cite that retained file instead.
        #
        # ``wipe_only`` uses ``dmesg -C`` to discard the buffer without reading
        # its contents, so the pre-clear backlog never becomes a finding.
        if save_evidence is None:
            save_evidence = clear and not wipe_only
        command = 'dmesg -C' if wipe_only else 'dmesg -c' if clear else 'dmesg'
        result = self.command(record, stem, 'os', command, sudo=True,
                              save_evidence=save_evidence)
        if result.code:
            return
        if wipe_only:
            self.dmesg_seen = {}
            return
        boot = record['identities'].get('os', {}).get('boot_id', '')
        events = dmesg_issues(result.output)
        counts = {}
        for event in events:
            # printk timestamp + exact raw content distinguishes repetitions;
            # a multiset also preserves identical repeated lines in one read.
            key = (boot, event['raw'])
            counts[key] = counts.get(key, 0) + 1
            if counts[key] <= self.dmesg_seen.get(key, 0):
                continue
            retention = record['commands'][stem]['evidence']
            if not retention and evidence_stem:
                folder = self.folder(record).relative_to(self.root).as_posix()
                retention = f'{folder}/{evidence_stem}.txt'
            event.update(boot_id=boot, phase=stem, evidence=retention)
            record['issues'].append(event)
        if clear:
            self.dmesg_seen = {}
        else:
            self.dmesg_seen = counts

    def capture(self, record, post=False):
        record['shared_core_version']=core_version()
        # Reset per capture: an earlier phase's complete execution must never
        # carry over into this loop's verdict.
        self.hardware_execution_complete = False
        record['hardware_execution_complete'] = False
        self.event(record,'POST' if post else 'PRE','BASELINE_COLLECTION' if not post else 'POST_STARTED',
                   'Collecting PRE baseline' if not post else 'POST started',phase='POST' if post else 'PRE')
        self.collect_dmesg(record, 'dmesg', evidence_stem='dmesg_clear')
        shared_pci=b'VALIDATION_PCI_INPUT' in self.script
        pci_acquisition=None
        for stem, (cmd, sudo) in CAPTURES.items():
            if stem == 'dmesg':
                continue
            # ``pci_verbose`` is parsed in full from the in-memory output; only
            # the on-disk evidence is narrowed to link-bearing end devices so
            # the artefact stays reviewable without duplicating hardware.txt.
            if shared_pci and stem in {'pci','pci_verbose'}:
                cmd,sudo=OPERATIONS['pci'].command,True
            result = self.command(record, stem, "os", cmd, sudo=sudo,
                                  filter_output=filter_pci_verbose if stem == 'pci_verbose' else None,
                                  acquired=pci_acquisition if shared_pci and stem=='pci_verbose' else None)
            if stem=='pci': pci_acquisition=result
            if stem == "pci":
                record["pci"] = parse_pci(result.output) if result.code == 0 else {}
                record["pci_devices"] = merge_pci_devices(record["pci"], record.get("pci_verbose", {}))
                if not record["pci"]:
                    self.add(record, "PCI_EMPTY", "PCIe", "No valid full-BDF PCI inventory")
                elif post:
                    findings=pci_issues(self.baseline["pci"], record["pci"])
                    record["issues"] += findings
                    self.event(record,'FAIL' if findings else 'PASS','PCI_COMPARISON',
                               'PCI differs from PRE baseline' if findings else 'PCI baseline matched',
                               evidence=record['commands']['pci']['evidence'],phase='POST')
            elif stem == "pci_verbose" and result.code == 0:
                record["pci_verbose"] = parse_pci_verbose(result.output)
                record["pci_devices"] = merge_pci_devices(record.get("pci", {}), record["pci_verbose"])
        try:
            self.ensure_verified_script(record)
        except IdentityUnsafe:
            raise
        except Exception as exc:
            if isinstance(exc, EvidencePersistenceError): raise
            self.add(record, 'SCRIPT_VALIDATION_FAILED', 'hardware', self.safe_error(exc))
            record['commands']['hardware'] = dict(valid=False, state='BLOCKED', evidence='')
            self.node.update(active=False, stop_reason='Hardware script validation failed')
            if not post:
                self.node['blocked'].append('Cannot run the verified hardware script')
        if self.script_verified:
            ratio = getattr(self.options, 'memory_min_ratio', 0.9)
            prefix=f"MEMORY_MIN_RATIO={ratio} "
            if shared_pci:
                from cycle_core import digest
                raw=(pci_acquisition.output if pci_acquisition.code==0 else '').encode()
                remote_pci=self.remote+'.'+record['phase'].lower()+'.'+digest(raw)[:16]+'.pci'
                # Shared bytes are data, not a second checker upload. Failed PCI
                # collection is never replaced with a hidden second lspci call.
                if pci_acquisition.code==0:
                    self.transport.upload(self.target,raw,remote_pci)
                    verified=self.command(record,'pci_snapshot_verify','os','sha256sum '+shlex.quote(remote_pci),check=False)
                    if verified.code or verified.output.split()[:1]!=[digest(raw)]:
                        raise EvidencePersistenceError('Shared PCI snapshot integrity verification failed')
                prefix+='VALIDATION_PCI_INPUT='+shlex.quote(remote_pci)+' '
            try:
                config = self.command(record, "hardware", "os", prefix+"bash " + shlex.quote(self.remote), sudo=True, timeout=180, check=False)
            finally:
                if shared_pci and pci_acquisition.code==0:
                    try: self.transport.ssh(self.target,'os','rm -f '+shlex.quote(remote_pci),30,True)
                    except Exception: pass  # owned temporary data only; never retry an action
            findings = config_issues(config.output, config.code)
            record["issues"] += findings
            # Execution completion is a separate question from health: a script
            # that ran fully and reported RESULT|FAIL (exit 1) IS complete, while
            # a timeout/RESPONSE_LOST/truncated run is NOT, regardless of what
            # findings it produced. Only a transport RETURNED with exactly one
            # legal RESULT, matching the exit code, sitting on the last line
            # proves the run reached its end.
            lines = [line.strip() for line in config.output.splitlines() if line.strip()]
            results = [line for line in lines if line.startswith('RESULT|')]
            expected_result = {0: 'RESULT|PASS', 1: 'RESULT|FAIL'}.get(config.code)
            self.hardware_execution_complete = bool(
                config.state == 'RETURNED' and expected_result and results == [expected_result]
                and lines and lines[-1] == expected_result
                and not (config.code == 0 and findings))
            record['hardware_execution_complete'] = self.hardware_execution_complete
            if not self.hardware_execution_complete:
                self.add(record, 'HARDWARE_EXECUTION_INCOMPLETE', 'hardware',
                         f'Execution not confirmed: state={config.state}, exit={config.code}, final result={results}',
                         evidence=record['commands']['hardware']['evidence'])
                self.node.update(active=False, stop_reason='Hardware script execution incomplete')
                if not post:
                    self.node['blocked'].append('Hardware script execution incomplete')
            record['hardware_checks'], record['hardware_check_details'] = parse_hardware_checks(config.output, findings)
            # Pull the per-slot NIC inventory out of the CHECK|NIC_SLOT lines so
            # the PRE baseline can name exactly which NIC is removed or degraded
            # after a loop, instead of only reporting a lower card count.
            record['nic_slots'] = {}
            for line in config.output.splitlines():
                if not line.startswith('CHECK|NIC_SLOT|'):
                    continue
                values = dict(c.split('=', 1) for c in line.split('|')[2:] if '=' in c)
                if 'slot' in values:
                    record['nic_slots'][values['slot'].lower()] = values.get('state', 'PRESENT')
            # Compare the NIC slot inventory against the PRE baseline so a card
            # that is present at PRE but absent (removed) or degraded (non-Vera
            # device type) after a loop is named by BDF, not just counted.
            if post and self.baseline and 'nic' in self.baseline:
                record['issues'] += nic_slot_issues(self.baseline['nic'], record.get('nic_slots', {}))
        sensor = self.command(record, "sensor", "oob", "sensor list")
        record["sensors"] = parse_sensors(sensor.output) if record['commands']['sensor']['valid'] else []
        if post:
            valid = record['commands']['sensor']['valid']
            if not valid:
                retry = self.command(record, 'sensor_retry', 'oob', 'sensor list')
                valid = record['commands']['sensor_retry']['valid']
                if valid:
                    record['sensors'] = parse_sensors(retry.output)
            confirmation = None
            if valid and missing_sensors(self.baseline["sensors"], record["sensors"]):
                retry = self.command(record, "sensor_confirm", "oob", "sensor list")
                if record['commands']['sensor_confirm']['valid']:
                    confirmation = parse_sensors(retry.output)
                else:
                    valid = False
                    self.add(record, 'SENSOR_CONFIRM_FAILED', 'sensors', 'Reread failed; sensor disappearance cannot be confirmed from a failed collection')
            if valid:
                record["issues"] += compare_sensors(self.baseline["sensors"], record["sensors"], confirmation)
                self.event(record,'POST','SENSOR_COMPARISON','Sensor comparison against PRE completed',phase='POST',evidence=record['commands']['sensor']['evidence'])
            else:
                record['issues'] += sensor_issues(record['sensors'])
        else:
            record["issues"] += sensor_issues(record["sensors"])
        sel = self.sel_command(record, "sel", "list", save_evidence=True)
        sel_meta = self._sel_metadata(record, 'sel', sel.output, 'POST' if post else 'PRE')
        if post:
            record['sel_post_meta'] = sel_meta
        else:
            record['sel_collection'] = sel_meta
        if post:
            valid = record['commands']['sel']['valid'] and record.get('sel_before_valid', False)
            record['sel_status'] = 'REVIEW REQUIRED' if valid else 'COLLECTION FAILED'
            record['sel_structured'] = sel_records(sel.output) if valid else None
            record['sel_events'] = sel_delta(record.get('sel_before', ''), sel.output).splitlines() if valid else None
            if valid:
                path = self.folder(record) / "sel_delta.txt"
                atomic_write(path, "\n".join(record['sel_events']) or "No new SEL records.\n")
                record['evidence'].append(path.relative_to(self.root).as_posix())
                record['sel_delta_meta'] = dict(phase='LOOP', status='COMPARED', valid=True,
                                                new_event_count=len(record['sel_events']),
                                                evidence=path.relative_to(self.root).as_posix(),
                                                reason='Before-cycle and POST SEL snapshots were valid')
            else:
                reason = 'Before-cycle SEL collection was unavailable'
                if not record['commands']['sel'].get('valid', False):
                    reason = 'POST SEL collection was unavailable or malformed'
                record['sel_delta_meta'] = dict(phase='LOOP', status='UNAVAILABLE', valid=False,
                                                new_event_count=None, evidence='', reason=reason)
            record.pop('sel_before', None)
        # Redfish EventLog/SEL: collection failure is a finding, but an absent
        # service (merged build) or a benign entry is not. Verdict is by worst
        # severity; POST adds a content delta against the before-cycle snapshot.
        try:
            self.collect_redfish(record)
        except Exception as exc:
            self.add(record, 'REDFISH_UNAVAILABLE', 'eventlog',
                     f'Redfish BMC log collection unavailable: {exc}')
            for stem in ('eventlog', 'redfish_sel'):
                record.setdefault('commands', {}).setdefault(stem, {"command": "redfish", "role": "oob",
                    "code": 255, "state": "NOT_ISSUED", "evidence": "", "valid": False, "output_excerpt": str(exc)})
        if post:
            self._redfish_loop_delta(record)
        self.command(record, "bmc_firmware", "oob", "mc info")
        power = self.command(record, "power", "oob", "power status")
        record["power_on"] = record['commands']['power']['valid'] and bool(re.search(r"Chassis Power is on", power.output, re.I))
        if not record["power_on"]:
            self.add(record, "POWER_NOT_ON", "power", "BMC did not confirm chassis power on")
        bmc = self.command(record, "host_power", "bmc", "/usr/bin/powerctrl.sh power_status")
        if bmc.code == 0 and not ("Host: Running" in bmc.output and "Chassis Power: On" in bmc.output):
            self.add(record, "HOST_NOT_RUNNING", "power", "BMC power_status did not confirm Host: Running and Chassis Power: On")
        if post:
            self.collect_dmesg(record, 'dmesg_clear', clear=True)
        for item in record["issues"]:
            if not item.get("evidence"):
                component = item["component"]
                stem = component if component in record['commands'] else "sensor" if item["code"].startswith("SENSOR") else "pci" if item["code"] == "PCI_DRIFT" else "dmesg" if component == "dmesg" else "hardware"
                item["evidence"] = record["commands"].get(stem, {}).get("evidence", "")

    # --- Redfish BMC log services (EventLog / SEL) -----------------------
    # Different vendors' OpenBMC builds use different resource IDs and may or
    # may not expose a separate SEL service, so nothing here is hard-coded:
    # we discover the System id and its LogServices, then fetch whatever exists.

    # Bound pagination so an anomalous BMC nextLink cannot loop forever.
    REDFISH_MAX_PAGES = 20

    def _redfish_discover(self, token):
        """Return dict(system_id, services={name: odata_id}, token, listing_valid, reason).

        A failed or unreadable discovery is NOT the same as an empty service
        list: ``listing_valid`` stays false and callers must not conclude that
        any particular service is absent. Only a successfully read, structurally
        valid LogServices collection lets us say a service is NOT PRESENT.

        The caller owns the session: ``token`` is the already-issued X-Auth-Token
        and is reused for every request below (never a second login), so the
        caller can guarantee its release even if any of these steps raise.
        """
        systems = self.transport.redfish_get(self.target, "/redfish/v1/Systems", token)
        if systems.code or not systems.output:
            raise RuntimeError("Redfish /Systems unavailable")
        payload = self._redfish_json(systems.output)
        members, valid, reason = redfish_collection(payload)
        if not valid or not members:
            raise RuntimeError(reason or "Redfish /Systems returned no members")
        first = members[0] if isinstance(members[0], dict) else {}
        system_id = str(first.get("@odata.id", "")).rstrip("/").split("/")[-1]
        if not system_id:
            raise RuntimeError("Redfish /Systems member has no @odata.id")
        listing_path = f"/redfish/v1/Systems/{system_id}/LogServices"
        collected = self._redfish_fetch_collection(listing_path, token, expect='reference')
        if not (collected['valid'] and collected['complete']):
            return dict(system_id=system_id, services={}, token=token, listing_valid=False,
                        reason=collected.get('reason') or "LogServices listing incomplete")
        mapping = {}
        for entry in collected['entries']:
            path = str(entry.get('path') or entry.get('odata_id') or '')
            if path:
                mapping[path.rstrip("/").split("/")[-1]] = path
        return dict(system_id=system_id, services=mapping, token=token, listing_valid=True, reason="")

    def _redfish_token(self):
        return self.transport.redfish_login(self.target)

    def _redfish_logout(self, token, record=None):
        """Release a Redfish session, downgrading logout failure to evidence.

        A logout that fails (or a BMC that does not expose a DELETE path) must
        never turn a valid collection into a FAIL and must never re-trigger any
        power/cycle action. The worst case is a WARN finding so an operator can
        see the leak instead of it silently exhausting the BMC session table.

        A transport-level failure (HTTP 500, timeout, lost response) is returned
        as a non-zero ``Command`` rather than raised, so the return value is
        inspected too: any unconfirmed release is a WARN, never a silent
        success.
        """
        if not token:
            return
        try:
            result = self.transport.redfish_logout(self.target, token)
            released = result is None or not getattr(result, 'code', 1)
            reason = None if released else f"state={getattr(result, 'state', 'UNKNOWN')}, exit={getattr(result, 'code', '?')}"
        except Exception as exc:
            released, reason = False, str(exc)
        if released:
            return
        if record is not None:
            self.add(record, 'REDFISH_LOGOUT_FAILED', 'redfish',
                     f'Redfish session logout not confirmed; session may remain open on the BMC: {reason}',
                     severity='WARN')

    @contextmanager
    def _redfish_session(self, record=None):
        """Discover a session and guarantee logout, whatever the caller does.

        The login happens *before* the ``try`` so its token can be released in
        ``finally`` even when discovery itself raises: the previous shape logged
        in inside ``_redfish_discover`` and only entered the ``try`` afterwards,
        so a /Systems failure leaked one BMC session per collection. When login
        itself fails there is no session to release and no fabricated logout.
        """
        token = self._redfish_token()
        try:
            disc = self._redfish_discover(token)
            yield disc
        finally:
            self._redfish_logout(token, record=record)

    @staticmethod
    def _redfish_json(text):
        import json as _json
        start = text.find("{")
        if start < 0:
            return None
        try:
            return _json.loads(text[start:])
        except ValueError:
            return None

    @staticmethod
    def _redfish_valid_entry(item):
        """True when a referenced member is a structurally valid LogEntry.

        A JSON-decoded object that carries no event identity/content (e.g. an
        empty ``{}`` or a payload missing both Id and Message) is unreadable: it
        is not "an event with no problems". Treating it as a valid OK entry would
        let a malformed referenced member turn a collection into a false PASS, so
        it must fail closed instead. A vendor entry with an unknown/blank
        Severity is still valid - only the identity/content keys are required,
        so a legacy ``{Id, Message, Severity:""}`` entry is never misjudged.
        """
        return isinstance(item, dict) and any(k in item for k in ("Id", "Message"))

    def _redfish_stem(self, name):
        return 'eventlog' if name == 'EventLog' else 'redfish_sel'

    def _redfish_fetch_collection(self, path, token, expect='entry'):
        """Fetch a (possibly paginated) Redfish collection.

        Follows ``Members@odata.nextLink`` until the collection is complete.
        Returns dict(entries, valid, complete, reason, pages). A page-1 success
        with a failing page 2 is INCOMPLETE, never a complete PASS; the entries
        already gathered are retained for evidence.

        ``expect`` selects how members are interpreted:

          * ``'entry'``  - log entries. Expanded objects are normalised; bare
            ``@odata.id`` references are fetched and normalised. Entries are
            normalised on *every* return path - including failure paths - so the
            evidence writer always sees id/severity/message instead of raw vendor
            keys and never renders a blank line for an event it did receive.

          * ``'reference'`` - a service listing whose members are ``@odata.id``
            links (the LogServices case). The links are kept as ``path`` values,
            not fetched, so the caller can address the service directly.
        """
        entries = []
        seen = set()
        pages = 0
        current = path
        while current and current not in seen:
            if pages >= self.REDFISH_MAX_PAGES:
                return dict(entries=entries, valid=True, complete=False,
                            reason=f"pagination exceeded {self.REDFISH_MAX_PAGES} pages", pages=pages)
            seen.add(current)
            pages += 1
            result = self.transport.redfish_get(self.target, current, token)
            if result.code:
                return dict(entries=entries, valid=False, complete=False,
                            reason=f"collection page failed: HTTP {getattr(result, 'http_status', 0) or result.code} ({result.state})",
                            pages=pages, failed_path=current)
            payload = self._redfish_json(result.output)
            members, valid, reason = redfish_collection(payload)
            if not valid:
                return dict(entries=entries, valid=False, complete=False,
                            reason=f"collection page unreadable: {reason}", pages=pages, failed_path=current)
            resolved, bad = self._redfish_resolve_members(members, token, expect)
            if bad:
                # A member we cannot interpret is not "zero events".
                return dict(entries=entries, valid=False, complete=False,
                            reason=f"collection page has unusable member: {bad}", pages=pages, failed_path=current)
            entries.extend(resolved)
            link = redfish_page_next_link(payload)
            if not link:
                return dict(entries=entries, valid=True, complete=True,
                            reason="", pages=pages)
            # A relative nextLink (e.g. "/redfish/v1/...") is used verbatim; an
            # absolute URL is reduced to its path so the request still goes to
            # the same BMC endpoint over the authenticated session.
            current = self._redfish_link_path(link)
        if current in seen:
            return dict(entries=entries, valid=True, complete=False,
                        reason="pagination loop detected (repeated nextLink)", pages=pages)
        return dict(entries=entries, valid=True, complete=True, reason="", pages=pages)

    def _redfish_resolve_members(self, members, token, expect='entry'):
        """Normalise members according to ``expect``.

        Returns ``(entries, problem)``. ``problem`` is a message when a member is
        neither an expanded entry nor a resolvable reference - the caller must
        treat that collection as unreadable rather than as zero events.
        """
        entries = []
        for index, member in enumerate(members):
            kind = redfish_member_kind(member)
            if kind == "entry":
                entry = self._redfish_normalise_entry(member)
                if expect == 'reference':
                    # An expanded service object: keep its own address.
                    entry['path'] = str(member.get("@odata.id", "") or "")
                entries.append(entry)
                continue
            if kind == "reference":
                ref = str(member.get("@odata.id", "") or "").strip()
                if expect == 'reference':
                    entries.append(dict(path=ref))
                    continue
                result = self.transport.redfish_get(self.target, self._redfish_link_path(ref), token)
                if result.code:
                    return entries, f"reference {ref} could not be fetched (HTTP {getattr(result, 'http_status', 0) or result.code})"
                target = self._redfish_json(result.output)
                if not self._redfish_valid_entry(target):
                    # A referenced member that is unreadable (truncated JSON,
                    # empty object, or missing both Id and Message) is a
                    # collection integrity failure, not "an event with nothing
                    # wrong". Fail closed so it can never become a false PASS.
                    return entries, f"reference {ref} is not a valid LogEntry"
                entries.append(self._redfish_normalise_entry(target))
                continue
            return entries, f"Members[{index}] has no Id/Severity/Message and no @odata.id"
        return entries, ""

    @staticmethod
    def _redfish_link_path(link):
        link = link.strip()
        if link.startswith("http://") or link.startswith("https://"):
            from urllib.parse import urlsplit
            split = urlsplit(link)
            return split.path + (("?" + split.query) if split.query else "")
        return link

    @staticmethod
    def _redfish_normalise_entry(item):
        """Normalise one validated member object to the lowercase entry schema."""
        severity = str(item.get("Severity", "") or "")
        return dict(
            id=str(item.get("Id", "") or ""),
            severity=severity,
            severity_key=severity.strip().lower(),
            created=str(item.get("Created", "") or ""),
            message=str(item.get("Message", "") or ""),
            resolved=bool(item.get("Resolved", False)),
        )

    def collect_redfish(self, record, clear=False, history=False):
        """Fetch EventLog and (if present) SEL for this node.

        Called once per phase. On ``clear`` the same entries are fetched first
        (already handled by callers storing evidence) and then each service is
        cleared. Three states are kept distinct:

          * a service confirmed absent (valid listing, no such member) is
            NOT PRESENT / PASS  - the merged-BMC layout, not a failure;
          * a service whose discovery or collection failed is UNAVAILABLE /
            FAIL - "we do not know", never "we confirmed there is nothing";
          * a service collected successfully with severity Critical/Warning
            contributes a canonical FAIL/WARN issue so the record status and
            campaign health reflect it (not just the Redfish sub-verdict).

        ``history=True`` is the pre-PRE clean-state read: the entries fetched
        here are the pre-existing backlog that is about to be cleared, so they
        are evidence of the clean-up step only. They must NOT enter the PRE
        baseline's issue list or health (clean-start policy), and their evidence
        goes to a separate file so the later post-clear capture of
        ``pre_eventlog.txt`` cannot overwrite it. Collection/clear failures
        still surface - only the *historical event findings* are suppressed.
        """
        with self._redfish_session(record) as disc:
            record['redfish_system_id'] = disc['system_id']
            record['redfish_services'] = sorted(disc['services'])
            if history:
                record['redfish_preclear'] = {}
            found = []
            for name in ('EventLog', 'SEL'):
                path = disc['services'].get(name)
                stem = self._redfish_stem(name)
                if not path:
                    if disc['listing_valid']:
                        # Confirmed absent on a readable listing: not a failure. Note
                        # it so the report can explain a merged/split layout.
                        record['commands'][stem] = {"command": f"redfish {name}", "role": "oob",
                                                    "code": 0, "state": "NOT_PRESENT", "evidence": "",
                                                    "valid": True, "output_excerpt": ""}
                        record[f'{stem}_meta'] = dict(phase='COLLECT', status='NOT PRESENT', present=False,
                                                      verdict='PASS', counts={"Critical": 0, "Warning": 0, "OK": 0, "Other": 0},
                                                      entries=[], complete=True, valid=True,
                                                      reason=f'No {name} log service on this BMC')
                    else:
                        # Discovery failed: we cannot tell whether the service exists.
                        record['commands'][stem] = {"command": f"redfish {name}", "role": "oob",
                                                    "code": 1, "state": "UNAVAILABLE", "evidence": "",
                                                    "valid": False, "output_excerpt": disc.get('reason', '')}
                        record[f'{stem}_meta'] = dict(phase='COLLECT', status='UNAVAILABLE', present=None,
                                                      verdict='FAIL', counts={"Critical": 0, "Warning": 0, "OK": 0, "Other": 0},
                                                      entries=[], complete=False, valid=False,
                                                      reason=disc.get('reason') or 'Redfish LogServices discovery failed')
                        self.add(record, 'REDFISH_UNAVAILABLE', stem,
                                 f'Redfish {name} service could not be discovered; see reason',
                                 snippet=disc.get('reason', ''))
                    record[f'{stem}_entries'] = []
                    continue
                entries_path = path + "/Entries"
                fetched = self._redfish_fetch_collection(entries_path, disc['token'])
                entries = fetched['entries']
                valid = fetched['valid']
                complete = fetched['complete']
                verdict, counts = redfish_verdict(entries) if (valid and complete) else (
                    "FAIL", {"Critical": 0, "Warning": 0, "OK": 0, "Other": 0})
                evidence = self._write_redfish_evidence(record, stem, name, entries_path, fetched, verdict, counts,
                                                        history=history)
                record['commands'][stem] = {"command": f"redfish {name} ({entries_path})", "role": "oob",
                                            "code": 0 if (valid and complete) else 1,
                                            "state": 'COLLECTED' if (valid and complete) else 'UNAVAILABLE',
                                            "evidence": evidence, "valid": valid and complete,
                                            "output_excerpt": "" if (valid and complete) else fetched.get('reason', '')}
                record[f'{stem}_meta'] = dict(phase='COLLECT', status='COLLECTED' if (valid and complete) else 'FAILED',
                                              present=True, verdict=verdict, counts=counts, evidence=evidence,
                                              entries=entries, path=entries_path, complete=complete, valid=valid,
                                              reason='' if (valid and complete) else fetched.get('reason', 'Redfish collection incomplete'))
                record[f'{stem}_entries'] = entries
                if history:
                    # Record the pre-clear backlog as diagnostic metadata only; it is
                    # not a PRE finding (it is about to be cleared).
                    record['redfish_preclear'][stem] = dict(
                        status=record[f'{stem}_meta']['status'], counts=counts, evidence=evidence,
                        entry_count=len(entries), valid=valid, complete=complete)
                if not (valid and complete):
                    self.add(record, 'REDFISH_COLLECTION_FAILED', stem,
                             f'Redfish {name} collection failed or incomplete; see evidence',
                             evidence=evidence, snippet=fetched.get('reason', ''))
                elif not history:
                    # Propagate severity into the canonical issue model so record
                    # status and campaign health cannot stay PASS behind a failing
                    # EventLog/SEL sub-verdict. Pre-clear history is excluded.
                    self._redfish_severity_issues(record, name, stem, entries, evidence)
                if clear and valid and complete:
                    self._redfish_clear_service(record, name, path, disc['token'], stem)
            if history:
                # The clear-state read is diagnosis only; it must not define the
                # baseline meta/verdict. Restore the pre-clear keys so the later
                # post-clear capture() populates the real PRE baseline.
                for name in ('EventLog', 'SEL'):
                    stem = self._redfish_stem(name)
                    record.pop(f'{stem}_meta', None)
                    record.pop(f'{stem}_entries', None)
            self.persist(record)

    def _redfish_severity_issues(self, record, name, stem, entries, evidence):
        """Emit one FAIL/WARN issue per distinct Critical/Warning entry.

        Event identity (Id + message, severity excluded), the vendor message and
        the evidence file are kept so the finding is traceable and classifies as
        KNOWN/NEW against the loop's before-cycle -> POST delta. collect_redfish
        runs more than once per record (PRE clean-state, then capture), so an
        already-recorded finding is not added again.
        """
        existing = {(i['code'], i['component'], i['detail']) for i in record['issues']}
        for entry in entries:
            severity = str(entry.get('severity_key', ''))
            if severity not in ('critical', 'warning'):
                continue
            code = 'REDFISH_CRITICAL' if severity == 'critical' else 'REDFISH_WARNING'
            level = 'FAIL' if severity == 'critical' else 'WARN'
            detail = f"Redfish {name}: {entry.get('id','')} {entry.get('message','')}".strip()
            if (code, stem, detail) in existing:
                continue
            existing.add((code, stem, detail))
            self.add(record, code, stem, detail, severity=level, evidence=evidence,
                     snippet=f"{entry.get('id','')} | {entry.get('severity','')} | {entry.get('created','')} | {entry.get('message','')}")
            # Comparison identity is the event (source + Id + message) and must
            # NOT include severity, so the same event going Warning -> Critical
            # is recognised as the same finding (reported as an escalation, not
            # a second unrelated issue). ``identity`` drives issue_key; the issue
            # code stays as the current severity so the report and recovery
            # journal keep their existing shape.
            record['issues'][-1]['identity'] = f"{name}|{entry.get('id','')}|{entry.get('message','')}"

    def _write_redfish_evidence(self, record, stem, name, entries_path, fetched, verdict, counts, history=False):
        # Plain-text transcript (header + one line per entry), not JSON: keep a
        # .txt suffix so the file is served as text/plain rather than parsed as
        # application/json by the browser's JSON viewer.
        if record['phase'] == 'PRE':
            suffix = f"pre_{stem}_preclear.txt" if history else f"pre_{stem}.txt"
        else:
            suffix = f"{stem}.txt" if not history else f"{stem}_preclear.txt"
        path = self.folder(record) / suffix
        # Entries are already normalised to the lowercase schema by
        # _redfish_fetch_collection; read both spellings so a raw entry that
        # slipped through a failure path still renders its Id/Severity/Message.
        entries = fetched.get('entries', [])
        lines = [f"UTC+8: {now()}", "Role: oob", f"Source: Redfish {name}",
                 f"Path: {entries_path}", f"Pages: {fetched.get('pages', 0)}",
                 f"Valid: {fetched.get('valid', False)}", f"Complete: {fetched.get('complete', False)}",
                 f"Entries: {len(entries)}", f"Verdict: {verdict}",
                 f"Counts: Critical={counts['Critical']} Warning={counts['Warning']} OK={counts['OK']}",
                 f"Reason: {fetched.get('reason', '')}",
                 ""]
        for entry in entries:
            lines.append(" | ".join(str(_entry_field(entry, field)) for field in ('id', 'severity', 'created', 'message')))
        if not (fetched.get('valid') and fetched.get('complete')):
            lines.append("[incomplete or unreadable collection; reason above]")
        atomic_write(path, "\n".join(lines) + "\n")
        rel = path.relative_to(self.root).as_posix()
        record['evidence'].append(rel)
        return rel

    def _redfish_clear_service(self, record, name, path, token, stem):
        result = self.transport.redfish_clear(self.target, path + "/Actions/LogService.ClearLog", token)
        ok = result.code == 0
        record[f'{stem}_clear'] = dict(status='SUCCEEDED' if ok else 'FAILED', command=f"ClearLog {name}",
                                       code=result.code, state=result.state)
        if not ok:
            self.add(record, 'REDFISH_CLEAR_FAILED', stem,
                     f'Redfish {name} clear failed: state={result.state} exit={result.code}', severity='WARN')

    def _redfish_before_snapshot(self, record):
        """Capture the pre-cycle EventLog/SEL entries for delta comparison.

        Stored on the LOOP record (not as a separate command) since it is a
        lightweight read; failure leaves the field absent and the delta is
        reported as unavailable rather than silently empty. Each service records
        its own validity/completeness. A failed read is marked UNAVAILABLE with
        ``valid=False`` rather than left as an empty snapshot, so the later delta
        can never mistake "we failed to read" for "read fine, no entries".
        """
        try:
            with self._redfish_session(record) as disc:
                snapshot = {"available": True, "eventlog": [], "sel": [],
                            "eventlog_valid": False, "sel_valid": False}
                for name, key in (('EventLog', 'eventlog'), ('SEL', 'sel')):
                    path = disc['services'].get(name)
                    if not path:
                        # Only a confirmed-absent service (valid discovery) is "not
                        # applicable"; a service we could not discover stays invalid.
                        snapshot[key + '_valid'] = bool(disc['listing_valid'])
                        continue
                    fetched = self._redfish_fetch_collection(path + "/Entries", disc['token'])
                    snapshot[key] = fetched['entries']
                    snapshot[key + '_valid'] = bool(fetched['valid'] and fetched['complete'])
        except Exception as exc:
            record['redfish_before'] = dict(available=False, reason=str(exc), eventlog=[], sel=[],
                                            eventlog_valid=False, sel_valid=False)
            record['redfish_before_meta'] = dict(phase='BEFORE_CYCLE', status='UNAVAILABLE', reason=str(exc),
                                                 eventlog_valid=False, sel_valid=False)
            self.persist(record)
            return
        record['redfish_before'] = snapshot
        record['redfish_before_meta'] = dict(phase='BEFORE_CYCLE',
                                             status='COLLECTED' if (snapshot['eventlog_valid'] or snapshot['sel_valid']) else 'UNAVAILABLE',
                                             available=True,
                                             eventlog_count=len(snapshot['eventlog']), sel_count=len(snapshot['sel']),
                                             eventlog_valid=snapshot['eventlog_valid'], sel_valid=snapshot['sel_valid'])
        self.persist(record)

    def _redfish_loop_delta(self, record):
        """Compare POST entries with the before-cycle snapshot for each service.

        COMPARED is only meaningful when BOTH the before-cycle and the POST
        collection are valid and complete for that service; otherwise the delta
        is UNAVAILABLE with a new_count of ``None`` (never 0, which would read as
        "compared successfully and found nothing new").
        """
        before = record.get('redfish_before') or {}
        for name, stem, key in (('EventLog', 'eventlog', 'eventlog'), ('SEL', 'redfish_sel', 'sel')):
            meta = record.get(f'{stem}_meta')
            if not meta:
                continue
            current = record.get(f'{stem}_entries') or []
            if meta.get('present') is False:
                meta['delta'] = dict(status='UNAVAILABLE', new_count=None, new_entries=[],
                                     reason='Service not present on this BMC')
                continue
            before_valid = bool(before.get('available') and before.get(key + '_valid'))
            post_valid = bool(meta.get('valid') and meta.get('complete'))
            if not before_valid or not post_valid:
                reason = ('Before snapshot unavailable or incomplete' if not before_valid
                          else 'POST snapshot unavailable or incomplete')
                meta['delta'] = dict(status='UNAVAILABLE', new_count=None, new_entries=[],
                                     reason=reason)
                continue
            new = redfish_delta(before.get(key, []), current)
            meta['delta'] = dict(status='COMPARED', new_count=len(new), new_entries=new,
                                 reason='Before-cycle and POST snapshots compared by content')
            # Record the ids introduced this loop so findings can classify
            # against the per-loop delta rather than the (cleared) PRE baseline.
            # Only COMPARED deltas feed classification; an UNAVAILABLE delta
            # leaves the marker unset so nothing is mislabelled NEW. A sorted
            # list keeps the record JSON-serialisable.
            ids = {str(e.get('id', '')) for e in new}
            merged_ids = set(record.get('eventlog_delta_ids', [])) | ids
            record['eventlog_delta_ids'] = sorted(merged_ids)
            if new:
                path = self.folder(record) / f"{stem}_delta.txt"
                atomic_write(path, "\n".join(
                    f"{e.get('id','')} | {e.get('severity','')} | {e.get('message','')}" for e in new) + "\n")
                record['evidence'].append(path.relative_to(self.root).as_posix())
        self.persist(record)

    def _prepare_clean_state(self, record):
        """Clear dmesg, IPMI SEL and Redfish logs before the PRE baseline.

        Each source is probed first: a source we cannot read is skipped (never
        wiped blind) and recorded as CLEAR_SKIPPED. A source that reads fine is
        cleared so PRE captures a clean baseline. Redfish clear happens inside
        collect_redfish(clear=True) at PRE time, driven from here.
        """
        # dmesg: probe with a read, then wipe only (`dmesg -C`); the pre-PRE
        # backlog is discarded without being parsed, so it never becomes a finding.
        probe = self.command(record, "pre_dmesg_probe", "os", "dmesg", sudo=True, check=False)
        if probe.code == 0:
            self.collect_dmesg(record, "pre_dmesg_clear", wipe_only=True)
        else:
            self.add(record, 'CLEAR_SKIPPED', 'dmesg', 'PRE dmesg read failed; original was not cleared', severity='WARN')
        # IPMI SEL: probe with a list, then clear.
        listed = self.sel_command(record, "pre_sel_probe", "list", save_evidence=False)
        if record['commands']['pre_sel_probe']['valid']:
            self.sel_command(record, "pre_sel_clear", "clear", save_evidence=False)
        else:
            self.add(record, 'CLEAR_SKIPPED', 'sel', 'PRE SEL read failed; original was not cleared', severity='WARN')
        # Redfish EventLog/SEL: collect_redfish(clear=True, history=True) fetches
        # the pre-existing backlog (evidence only, not a PRE finding) and then
        # clears it, so the clean-state backlog cannot leak into the PRE baseline.
        try:
            self.collect_redfish(record, clear=True, history=True)
        except Exception as exc:
            self.add(record, 'CLEAR_SKIPPED', 'eventlog',
                     f'Redfish logs could not be read/cleared before PRE: {exc}', severity='WARN')

    def precheck(self):
        record = self.node["pre"]
        self.event(record,'PRE','PRE_STARTED','PRE started')
        self.persist(record)
        try:
            for role, _, _ in self.target.endpoints():
                self.identity(record, role)
            uid = self.command(record, "root_uid", "os", "id -u", sudo=True, check=False)
            if uid.code or uid.output.strip() != "0":
                self.add(record, "ROOT_UNAVAILABLE", "privileges", "Root execution is unavailable; privileged checks may fail")
            self.dependencies(record)
            # Clean-start policy: clear dmesg, IPMI SEL and the BMC Redfish logs
            # BEFORE the PRE baseline is captured, so the baseline (and every
            # later loop delta) reflect only this campaign. Each log is probed
            # first so a log we cannot read is never wiped blind.
            self._prepare_clean_state(record)
            self.capture(record)
            # Sensor parse/health failures remain visible PRE FAIL findings. The
            # operator must be able to review them and decide whether to run;
            # only the PCI baseline is required to keep cycle comparisons safe.
            if not record["pci"]:
                self.node["blocked"].append("PRE PCI baseline is unavailable")
            self.baseline = dict(pci=record["pci"].copy(), sensors=[r.copy() for r in record["sensors"]],
                                 nic=dict(record.get("nic_slots", {})))
            self.pre_issue_keys = issue_baseline(record["issues"])
            self.expected_boot = record['identities']['os']['boot_id']
        except Exception as exc:
            if isinstance(exc, EvidencePersistenceError): raise
            if isinstance(exc, IdentityUnsafe):
                self.cleanup_safe = False
            self.node["blocked"].append(self.safe_error(exc))
            self.add(record, "PRE_BLOCKED", "identity", self.safe_error(exc))
        # PRE timing ends when the PRE capture finishes. Clearing dmesg/SEL is
        # campaign preparation and must not inflate the displayed PRE duration.
        self.finish(record, preserve_timing=True)
        blocked=bool(self.node['blocked'])
        self.event(record,'ERROR' if blocked else record['status'],'PRE_BLOCKED' if blocked else 'PRE_COMPLETED',
                   'PRE BLOCKED; no cycle command permitted' if blocked else 'PRE completed; health '+record['status']+'; operator confirmation still required',
                   evidence=(self.folder(record)/'pre_report.json').relative_to(self.root).as_posix())
        return self.node

    def sel_command(self, record, stem, action, **kwargs):
        inband = self.options.channel == 'inband'
        result = self.command(record, stem, 'os' if inband else 'oob',
                              ('ipmitool sel ' if inband else 'sel ') + action,
                              sudo=inband, **kwargs)
        if action == 'list' and record['commands'][stem]['valid']:
            lines = [line.strip() for line in result.output.splitlines() if line.strip()]
            empty = len(lines) == 1 and lines[0].lower().rstrip('.') == 'sel has no entries'
            records = bool(lines) and all(re.match(r'^[0-9a-f]+\s*\|', line, re.I) for line in lines)
            if not empty and not records:
                record['commands'][stem].update(valid=False, output_excerpt=result.output[-2000:])
                self.add(record, 'SEL_FORMAT_ERROR', stem, 'SEL list returned empty or unrecognized output; event count is unavailable', evidence=record['commands'][stem]['evidence'])
                record['issues'][-1]['snippet'] = result.output[-2000:] or '(empty output)'
                self.persist(record)
        return result

    def _sel_metadata(self, record, stem, output, phase):
        command = record.get('commands', {}).get(stem, {})
        lines = [line.strip() for line in output.splitlines() if line.strip()]
        event_count = sum(1 for line in lines if '|' in line and re.match(r'^[0-9a-f]+\s*\|', line, re.I))
        valid = bool(command.get('valid'))
        return dict(phase=phase, status='COLLECTED' if valid else 'FAILED', valid=valid,
                    command=command.get('command', ('ipmitool sel list' if self.options.channel == 'inband' else 'sel list')),
                    state=command.get('state', 'UNKNOWN'), code=command.get('code'),
                    evidence=command.get('evidence', ''), event_count=event_count if valid else None,
                    reason='' if valid else 'SEL command failed or returned an unrecognized format')

    def start(self):
        record = new_record('START')
        self.node['start'] = record
        try:
            for role, _, _ in self.target.endpoints():
                self.identity(record, role)
            if self.expected_boot and record['identities']['os']['boot_id'] != self.expected_boot:
                raise IdentityUnsafe('OS rebooted while awaiting PRE approval; reviewed baseline is no longer current')
        except IdentityUnsafe:
            self.cleanup_safe = False
            raise
        # Log clearing moved to PRE (_prepare_clean_state): the baseline and all
        # loop deltas now reflect a clean start. START only re-verifies identity.
        self.finish(record)

    def wait_boot(self, record, old_boot, deadline):
        attempts = 0
        boot_changed = False
        offline_seen=False; began=time.monotonic()
        self.event(record,'WAIT','WAIT_OFFLINE','Waiting for OS transition and recovery; offline may be too brief to observe',phase='RECOVERY')
        while time.monotonic() < deadline:
            attempts += 1
            os_verified=False
            try:
                current = self.identity(
                    record, "os", timeout=min(20, max(1, deadline - time.monotonic())),
                    save_evidence=False, record_command=False,
                    observe=False,
                )
                os_verified=True
                if current["boot_id"] != old_boot:
                    if not boot_changed:
                        if not offline_seen: self.event(record,'INFO','OFFLINE_NOT_OBSERVED','No offline sample observed; changed boot ID is required evidence',phase='RECOVERY')
                        self.event(record,'PASS','BOOT_ID_CHANGED','OS boot identity changed',phase='RECOVERY')
                    boot_changed = True
                    record["recovery"].update(boot_changed=True, new_boot_id=current["boot_id"], attempts=attempts)
                    # Aux cycles can leave the BMC or Lily SSH service behind the
                    # host boot. Retry transient transport failures to the same
                    # deadline, without requiring their boot IDs to change.
                    for role, _, _ in self.target.endpoints():
                        if role != 'os':
                            remaining = deadline - time.monotonic()
                            if remaining <= 0:
                                raise ConnectionError('Recovery deadline reached')
                            self.identity(record, role, timeout=min(20, remaining),
                                          save_evidence=False, record_command=False,observe=False)
                    self.event(record,'PASS','RECOVERY_DETECTED',f'OS recovered; selected endpoint identities verified ({time.monotonic()-began:.1f} sec)',phase='RECOVERY')
                    return True
            except IdentityUnsafe:
                raise
            except ConnectionError:
                if not os_verified and not offline_seen:
                    offline_seen=True
                    self.event(record,'INFO','OS_UNREACHABLE','OS offline probe: SSH unreachable; this alone does not prove power state',phase='RECOVERY')
                    self.event(record,'WAIT','WAIT_RECOVERY','Waiting for OS recovery and changed boot identity',phase='RECOVERY')
            time.sleep(min(self.options.poll_interval, max(0, deadline - time.monotonic())))
        record["recovery"].update(boot_changed=boot_changed, attempts=attempts)
        self.add(record, "BOOT_TIMEOUT", "recovery", f"Selected endpoints did not recover with a changed OS boot ID within {self.options.boot_timeout}s")
        self.node.update(active=False, stop_reason="Boot recovery timeout")
        return False

    def dispatch(self, record, label, role, cmd, sudo=False, timeout=30):
        self.event(record,'INFO','ACTION_PREPARING','Preparing cycle action; verifying dispatch reservation')
        if self.dispatch_guard: self.dispatch_guard()
        # Persist durable intent before sending the one and only command.
        import json
        atomic_write(self.folder(record)/(label+'_intent.json'),
                     json.dumps(dict(command=cmd,role=role,state='DISPATCH_INTENT')), durable=True)
        record.setdefault("cycle_started", now())
        self.event(record,'CMD','COMMAND_DISPATCHING','Dispatching once: '+cmd,detail='Intent recorded; acknowledgement pending')
        result = self.command(record, label, role, cmd, sudo=sudo, timeout=timeout, check=False)
        if record['commands'][label]['valid']:
            state = "SENT"
        elif result.state in {"RESPONSE_LOST", "NOT_ISSUED"}:
            state = result.state
        else:
            state = "COMMAND_FAILED"
        record["action"].append(dict(command=cmd, role=role, state=state, code=result.code))
        if state in {"NOT_ISSUED", "COMMAND_FAILED"}:
            self.add(record, "CYCLE_COMMAND_FAILED", "cycle", f"{cmd}: {state}, exit {result.code}")
        self.persist(record)
        if state!='NOT_ISSUED': self.event(record,'CMD','COMMAND_DISPATCHED','Command dispatch attempted once: '+cmd,detail='Dispatch is not proof of recovery')
        self.event(record,'WARN' if state=='RESPONSE_LOST' else 'ERROR' if state in {'NOT_ISSUED','COMMAND_FAILED'} else 'INFO',
                   state if state in {'RESPONSE_LOST','NOT_ISSUED','COMMAND_FAILED'} else 'RESPONSE_RETURNED',
                   'Command response lost; outcome ambiguous; no retry' if state=='RESPONSE_LOST' else 'Response returned; boot and power verification still required' if state=='SENT' else 'Command '+state,
                   evidence=record['commands'][label].get('evidence',''))
        return state

    def one_loop(self, number):
        record = new_record(f"LOOP {number}")
        record["loop"] = number
        self.node["loops"].append(record)
        self.persist(record)
        limit=getattr(self.options,'loop_limit',0)
        self.event(record,'INFO','LOOP_STARTED',f'Loop {number} / {limit or "time limit"} started')
        try:
            # Re-verify every selected endpoint before issuing another power action.
            for role, _, _ in self.target.endpoints():
                self.identity(record, role, role + "_before_cycle",
                              save_evidence=False, record_command=False)
            if self.expected_boot and record['identities']['os']['boot_id'] != self.expected_boot:
                raise IdentityUnsafe('Unexpected OS boot transition between captures')
            # This read is the only capture of events that arrive before the
            # power action, so it must keep its own evidence file.
            self.collect_dmesg(record, 'before_action_dmesg', save_evidence=True)
            before = self.sel_command(record, 'sel_before', 'list', save_evidence=True)
            record['sel_before_valid'] = record['commands']['sel_before']['valid']
            record['sel_before'] = before.output if record['sel_before_valid'] else ''
            record['sel_before_meta'] = self._sel_metadata(record, 'sel_before', before.output, 'BEFORE_CYCLE')
            self._redfish_before_snapshot(record)
            old_boot = record["identities"]["os"]["boot_id"]
            record["recovery"]["old_boot_id"] = old_boot
            deadline = time.monotonic() + self.options.boot_timeout
            mode, channel = self.options.cycle_mode, self.options.channel
            # Short label for the stage line; "sent" (not "issued") so operators
            # never read it as a problem report.
            cycle_label = {"aux_cycle": "aux cycle", "reboot": "reboot",
                           "power_cycle": "power cycle"}.get(mode, mode)
            self.node["attempts"] += 1
            if mode == "aux_cycle":
                state = self.dispatch(record, "cycle_command", "bmc", "/usr/bin/stbypowerctrl.sh aux_cycle")
            elif mode == "reboot" and channel == "outband":
                state = self.dispatch(record, "cycle_command", "oob", "power reset")
            else:
                inband = channel == "inband"
                if mode == "reboot":
                    command = "reboot"
                elif inband:
                    command = "ipmitool power cycle"
                else:
                    command = "power cycle"
                state = self.dispatch(record, "cycle_command", "os" if inband else "oob", command, sudo=inband)
            if state in {"SENT", "RESPONSE_LOST"}:
                self.stage(f"{cycle_label} sent")
                self.stage("waiting OS boot")
                recovered = self.wait_boot(record, old_boot, deadline)
                if not recovered:
                    raise ConnectionError('Boot recovery was not confirmed; POST hardware execution blocked')
            else:
                self.stage(f"{cycle_label} not sent")
                recovered = False
                record["recovery"]["boot_changed"] = False
            # Even a rejected power action receives POST while the OS is available.
            self.identity(record, "os", "os_after_cycle",
                          save_evidence=False, record_command=False)
            for role, _, _ in self.target.endpoints():
                if role != "os":
                    self.identity(record, role, role + "_after_cycle",
                                  save_evidence=False, record_command=False)
            if recovered and record['identities']['os']['boot_id'] != record['recovery']['new_boot_id']:
                raise IdentityUnsafe('Additional OS boot transition before POST')
            post_boot = record['identities']['os']['boot_id']
            record['boot_confirmed'] = bool(recovered)
            self.node['boot_confirmed'] += int(recovered)
            self.stage("OS up, system check running")
            record['post_started']=True
            self.capture(record, post=True)
            self.identity(record, 'os', 'os_after_checks')
            if record['identities']['os']['boot_id'] != post_boot:
                raise IdentityUnsafe('Additional OS boot transition during POST')
            self.expected_boot = post_boot
            self.stage("system check done")
            if recovered and record.get("power_on"):
                for action in record["action"]:
                    if action["state"] == "RESPONSE_LOST":
                        action["state"] = "RECONCILED"
                        self.add(record, "COMMAND_RECONCILED", "cycle", "Reply lost; changed OS boot ID and power-on state confirmed recovery", "WARN")
                        self.event(record,'WARN','COMMAND_RECONCILED','Previously ambiguous command reconciled by changed boot ID and power-on evidence',phase='POST')
            elif any(a["state"] == "RESPONSE_LOST" for a in record["action"]):
                self.add(record, "COMMAND_UNCONFIRMED", "cycle", "Lost response could not be reconciled with boot and power evidence")
            record['independent_checks_complete'] = True
            record["post_complete"] = self.hardware_execution_complete
            self.node["completed"] += int(record['post_complete'])
            record['boot_confirmed'] = bool(recovered)
            record['valid_cycle'] = bool(recovered and record.get('power_on') and self.script_verified and self.hardware_execution_complete)
            self.node['valid_cycles'] += int(record['valid_cycle'])
        except Exception as exc:
            if isinstance(exc, EvidencePersistenceError): raise
            code = "IDENTITY_UNSAFE" if isinstance(exc, IdentityUnsafe) else "NODE_UNAVAILABLE"
            if isinstance(exc, IdentityUnsafe):
                self.cleanup_safe = False
            self.add(record, code, "recovery", self.safe_error(exc))
            self.node.update(active=False, stop_reason=self.safe_error(exc))
            record["post_complete"] = False
            # BMC evidence can still explain a failed OS recovery; never touch an
            # endpoint whose identity just failed verification.
            if not isinstance(exc, IdentityUnsafe):
                try:
                    self.identity(record, "bmc", "bmc_failure_identity")
                    self.sel_command(record, "failure_sel", "list")
                    self.command(record, "failure_power", "oob", "power status")
                except Exception as bmc_exc:
                    if isinstance(bmc_exc, EvidencePersistenceError): raise
                    self.add(record, "BMC_UNAVAILABLE", "recovery", self.safe_error(bmc_exc))
        result = self.finish(record)
        counts={name:sum(i.get('classification')==name for i in record['issues']) for name in ('NEW','KNOWN')}
        self.event(record,record['status'] if record.get('post_complete') else 'ERROR','POST_COMPLETED' if record.get('post_complete') else 'POST_INCOMPLETE',
                   f"Loop {number} {'POST completed' if record.get('post_complete') else 'POST incomplete'}; health {record['status']}",
                   detail='; '.join(f'{value} {name}' for name,value in counts.items()),phase='POST',
                   evidence=(self.folder(record)/'report.json').relative_to(self.root).as_posix())
        self.stage("DONE")
        return result
