"""Shared pure parsing and validation. No transport, database or orchestrator imports."""
import re
import hashlib
import json
from collections import Counter
from cycle_dmesg import dmesg_issues

def issue(code, component, detail, severity="FAIL", evidence="", snippet=""):
    return dict(code=code, component=component, detail=detail, severity=severity, evidence=evidence,
                snippet=snippet)

def health(issues):
    return "FAIL" if any(i["severity"] == "FAIL" for i in issues) else "WARN" if issues else "PASS"

def parse_policy(text):
    rules = []
    for line in text.splitlines():
        cells = [v.strip() for v in line.strip().strip("|").split("|")]
        if len(cells) == 6 and cells[3] in {"KNOWN", "NEW"} and cells[5].lower() == "yes":
            rules.append(dict(zip(("project", "code", "component", "classification", "reason", "active"), cells, strict=True)))
    return rules

def classify(items, project, rules):
    for item in items:
        item.update(classification="NEW", known_reason="")
        for rule in rules:
            if all(rule[k] in ("*", v) for k, v in (("project", project), ("code", item["code"]), ("component", item["component"]))):
                item.update(classification=rule["classification"], known_reason=rule["reason"])
                break
    return items

def issue_key(item):
    # ``identity`` lets a family whose issue *code* changes with severity (e.g. a
    # Redfish event going Warning -> Critical) still compare as the same event,
    # so it classifies WORSENED instead of NEW. Families without an identity keep
    # the original code+component(+fingerprint) key.
    if item.get('identity'):
        return ('identity', item['component'], item['identity'])
    return (item['code'], item['component'], item['fingerprint']) if item.get('fingerprint') else (item['code'], item['component'])


def issue_baseline(items):
    result = {}
    for item in items:
        value = result.setdefault(issue_key(item), dict(count=0, severity='WARN', native_rank=0))
        value['count'] += item.get('occurrence_count', 1)
        rank = {'info': 0, 'corrected': 1, 'recoverable': 2, 'unknown': 3,
                'uncorrected': 4, 'uncorrectable': 4, 'fatal': 5}
        value['native_rank'] = max(value['native_rank'], rank.get(item.get('native_severity'), 0))
        if item['severity'] == 'FAIL':
            value['severity'] = 'FAIL'
    return result


def classify_against_pre(items, pre_keys):
    """PRE comparison describes observations, never cycle causation."""
    counts = issue_baseline(items)
    for item in items:
        key = issue_key(item)
        item["classification"] = "KNOWN" if key in pre_keys else "NEW"
        item["known_reason"] = "Present in PRE baseline" if key in pre_keys else ""
        if isinstance(pre_keys, dict) and key in pre_keys:
            old, current = pre_keys[key], counts[key]
            if (current['count'] > old['count'] or current['native_rank'] > old.get('native_rank', 0)
                    or (current['severity'] == 'FAIL' and old['severity'] != 'FAIL')):
                item.update(classification='WORSENED', known_reason='Count or severity increased relative to PRE')
    return items

def parse_sensors(text):
    """Keep incomplete and puzzling rows so the evaluator cannot silently pass them."""
    rows = []
    for lineno, line in enumerate(text.splitlines(), 1):
        if not line.strip():
            continue
        if "|" not in line:
            # ipmitool exit code 0 does not guarantee table rows; a stray
            # diagnostic line must surface instead of quietly shrinking the list.
            rows.append(dict(name=line.strip(), reading="", unit="", status="", line=lineno,
                             raw=line,
                             format_error=f"Expected a table row; received: {line.strip()}"))
            continue
        cells = [v.strip() for v in line.split("|")]
        fields = cells + [""] * max(0, 4 - len(cells))
        row = dict(name=fields[0] or "(unnamed sensor)", reading=fields[1],
                   unit=fields[2], status=fields[3].lower(), line=lineno, raw=line)
        row['thresholds']=dict(zip(('lower_nonrecoverable','lower_critical','lower_noncritical','upper_noncritical','upper_critical','upper_nonrecoverable'),cells[4:10]))
        if len(cells) < 4 or not cells[0]:
            row["format_error"] = f"Expected sensor name, reading, unit and status; received: {line.strip()}"
        rows.append(row)
    return rows

def _known_no_reading(row, unreadable):
    """Recognize only documented Vera no-value rows, not generic ``na``.

    Garbled names (U+FFFD replacement characters) are deliberately NOT
    whitelisted: a corrupted sensor name means the row cannot be trusted, so
    it must surface as SENSOR_UNREADABLE rather than pass as known-good.
    """
    reading = row["reading"].strip().lower()
    status = row["status"].strip().lower()
    if reading not in unreadable or status not in unreadable:
        return False
    return bool(re.fullmatch(r'PrMo\d+CP\d+CorUti\d*', row['name'], re.I))

def _snippet(row):
    """One-line, greppable pointer back to the exact evidence row."""
    raw = (row.get("raw") or "").strip()
    line = row.get("line")
    if raw and line:
        return f"line {line}: {raw}"
    return raw or (f"line {line}" if line else "")

def sensor_issues(rows):
    found = []
    if not rows:
        return [issue("SENSOR_EMPTY", "sensors", "No valid sensor rows returned")]
    failures = {"cr", "critical", "nr", "non-recoverable", "non recoverable", "lcr", "ucr", "lnr", "unr"}
    warnings = {"nc", "non-critical", "non critical", "lnc", "unc"}
    unreadable = {"ns", "na", "n/a", "no reading", "unknown", ""}
    counts = Counter(r["name"] for r in rows)
    for name, count in counts.items():
        if count <= 1:
            continue
        dup_rows = [r for r in rows if r["name"] == name]
        found.append(issue("SENSOR_DUPLICATE", name,
                           f"{count} rows share this sensor name; review each row", "WARN",
                           snippet="\n".join(_snippet(r) for r in dup_rows)))
    for r in rows:
        if '\ufffd' in r['name'] or any(ord(c) < 32 for c in r['name']):
            found.append(issue('SENSOR_NAME_MALFORMED', r['name'], 'Sensor identity contains invalid characters', snippet=_snippet(r)))
            continue
        if r.get("format_error"):
            found.append(issue("SENSOR_MALFORMED", r["name"], r["format_error"], snippet=_snippet(r)))
            continue
        state = r["status"]
        if state in failures:
            found.append(issue("SENSOR_CRITICAL", r["name"], f"Status {state}; reading {r['reading']}", snippet=_snippet(r)))
        elif state in warnings:
            found.append(issue("SENSOR_NONCRITICAL", r["name"], f"Status {state}; reading {r['reading']}", "WARN", snippet=_snippet(r)))
        elif _known_no_reading(r, unreadable):
            # Vera emits these platform-defined no-value rows while healthy.
            # Keep the raw row in evidence, but do not turn it into a failure.
            continue
        elif state in unreadable or r["reading"].lower() in unreadable:
            found.append(issue("SENSOR_UNREADABLE", r["name"], f"Status {state or '(empty)'}; reading {r['reading']}", snippet=_snippet(r)))
        elif r["unit"].strip().lower() == "discrete" and re.fullmatch(r"0x[0-9a-f]+", state):
            # ipmitool reports discrete states as hexadecimal bit fields (for
            # example 0x0100); threshold status names do not apply here.
            continue
        elif state not in {"ok", "0x0000"}:
            found.append(issue("SENSOR_UNRECOGNIZED", r["name"], f"Unrecognized status {state}; review raw sensor output", snippet=_snippet(r)))
    return found

def missing_sensors(baseline, current):
    return Counter(r["name"] for r in baseline) - Counter(r["name"] for r in current)

def compare_sensors(baseline, initial, confirmation=None):
    items = sensor_issues(initial)
    missing = missing_sensors(baseline, initial)
    if confirmation is not None:
        items += sensor_issues(confirmation)
    remaining = missing_sensors(baseline, confirmation) if confirmation is not None else missing
    baseline_by_name = {}
    for row in baseline:
        baseline_by_name.setdefault(row["name"], []).append(row)
    for name, count in missing.items():
        gone = "\n".join(_snippet(r) for r in baseline_by_name.get(name, []))
        if remaining[name]:
            items.append(issue("SENSOR_MISSING", name,
                               f"Missing {remaining[name]} baseline row(s) after confirmation",
                               snippet=gone))
        else:
            items.append(issue("SENSOR_RECOVERED", name,
                               f"Missing {count} row(s) returned on immediate reread", "WARN",
                               snippet=gone))
    # Confirmation can reveal a different disappeared row; never silently discard it.
    for name, count in (remaining - missing).items():
        gone = "\n".join(_snippet(r) for r in baseline_by_name.get(name, []))
        items.append(issue("SENSOR_MISSING", name,
                           f"Missing {count} baseline row(s) in confirmation", snippet=gone))
    return items

def parse_pci(text):
    rows = {}
    for line in text.splitlines():
        match = re.match(r"^([0-9a-f]{4}:[0-9a-f]{2}:[0-9a-f]{2}\.[0-7])\s+(.*)$", line, re.I)
        if match:
            bdf, description = match[1].lower(), match[2].strip()
            ids = re.search(r"\[([0-9a-f]{4}:[0-9a-f]{4})\]", description, re.I)
            if not ids:
                continue
            class_match = re.match(r"(.*?)\s+\[([0-9a-f]{4})\]:\s*(.*?)\s+\[[0-9a-f]{4}:[0-9a-f]{4}\]", description, re.I)
            if class_match:
                class_name, class_id, device_name = (v.strip() for v in class_match.groups())
            else:
                class_name = description.split(" [", 1)[0].strip()
                class_id = ""
                device_name = class_name
            rows[bdf] = dict(id=ids[1].lower(), raw=line.strip(), device_name=device_name,
                             raw_name=device_name,
                             class_name=class_name, class_id=class_id.lower())
    return rows

def parse_pci_verbose(text):
    """Parse only link/device facts already returned by ``lspci -Dvvv``.

    This is deliberately a bounded parser.  It never probes a device and it
    leaves an unknown link state visible when a verbose block is incomplete.
    """
    rows, current = {}, None
    for line in text.splitlines():
        header = re.match(r"^([0-9a-f]{4}:[0-9a-f]{2}:[0-9a-f]{2}\.[0-7])\s+(.*)$", line, re.I)
        if header:
            current = header[1].lower()
            rows[current] = dict(bdf=current, verbose_available=True, capabilities_seen=False,
                                 device_name_explicit=False, access_denied=False,
                                 device_name=header[2].strip(),
                                 pcie_type=None, link_capability=None, link_current=None,
                                 link_result='UNKNOWN', link_reason='Link capability was not classified')
            continue
        if not current:
            continue
        item = rows[current]
        serial = re.search(r'\[SN\]\s+Serial number:\s*(.*)',line)
        if serial: item['serial']=serial[1].strip() or None
        if re.search(r"access denied|permission denied", line, re.I):
            item.update(access_denied=True, link_result='UNKNOWN', link_reason='lspci verbose output was access denied')
            continue
        if re.search(r"^\s*Capabilities:\s*", line, re.I):
            item['capabilities_seen'] = True
        express = re.search(r"Capabilities:\s*\[[^]]+\]\s+Express\s+\([^)]*\)\s+(.+?)(?:,|$)", line, re.I)
        if express:
            item['pcie_type'] = express[1].strip()
            continue
        cap = re.search(r"\bLnkCap:\s*(.*)$", line, re.I)
        if cap:
            item['link_capability'] = cap[1].strip()
            continue
        sta = re.search(r"\bLnkSta:\s*(.*)$", line, re.I)
        if sta:
            item['link_current'] = sta[1].strip()
            continue
        name = re.search(r"^\s*DeviceName:\s*(.*)$", line, re.I)
        if name and name[1].strip():
            item['device_name'] = name[1].strip()
            item['device_name_explicit'] = True

    endpoint_re = re.compile(r"(?:Legacy\s+)?Endpoint$", re.I)
    integrated_re = re.compile(r"Root Complex Integrated Endpoint|Root Complex Event Collector", re.I)
    for item in rows.values():
        pcie_type = item.get('pcie_type') or ''
        current_link = item.get('link_current') or ''
        capability = item.get('link_capability') or ''
        if current_link:
            if re.search(r"Speed\s+unknown|Width\s+x0\b", current_link, re.I):
                item.update(link_result='FAIL', link_reason='Current link reports unknown speed or x0 width')
            elif re.search(r"down[\s-]*grad|degrad", current_link, re.I):
                item.update(link_result='FAIL', link_reason='Current link is reported as downgraded')
            elif not re.search(r"Speed\s+\S+.*Width\s+x\d+", current_link, re.I):
                item.update(link_result='FAIL', link_reason='Current link status does not include a usable speed and width')
            else:
                item.update(link_result='PASS', link_reason='Current link status was evaluated')
        elif integrated_re.search(pcie_type) and not capability:
            item.update(link_result='N/A', link_reason='This integrated device has no reported physical link capability')
        elif endpoint_re.search(pcie_type) or capability:
            item.update(link_result='FAIL', link_reason='Required LnkSta is missing from the verbose record')
        elif pcie_type:
            item.update(link_result='N/A', link_reason='This PCIe type does not expose an end-device link check')
        else:
            item.update(link_result='UNKNOWN', link_reason='Verbose record is insufficient to determine link applicability')
    return rows

def filter_pci_verbose(text):
    """Reduce an ``lspci -Dvvv`` dump to the end-device blocks the report shows.

    Kept blocks are exactly those the cycle report renders as PCIe End Device
    rows: any device that is not a PCI bridge. Bridges and other switch fabric
    are dropped, while their full plain-text form remains embedded in
    ``hardware.txt`` via the hardware script's own ``lspci`` evidence. Whole
    blank-line-separated blocks are kept so each surviving record stays a
    valid, self-contained lspci entry.
    """
    blocks, current = [], []
    for line in text.splitlines():
        if not line.strip():
            if current:
                blocks.append(current)
                current = []
            continue
        current.append(line)
    if current:
        blocks.append(current)

    header_re = re.compile(r"^([0-9a-f]{4}:[0-9a-f]{2}:[0-9a-f]{2}\.[0-7])\s+(.*)$", re.I)
    kept = []
    for block in blocks:
        header = header_re.match(block[0])
        if not header:
            continue
        descriptor = header[2]
        # Mirrors cycle_report._pci_devices: PCI bridge class 06 and anything
        # whose descriptor names a bridge are switch fabric, not end devices.
        class_id = re.search(r"\[([0-9a-f]{4})\]", descriptor, re.I)
        if class_id and class_id[1].startswith('06'):
            continue
        if 'bridge' in descriptor.lower():
            continue
        kept.append('\n'.join(block))
    return '\n\n'.join(kept) + ('\n' if kept else '')

def merge_pci_devices(pci, verbose):
    """Join the two already-captured lspci views without inventing devices."""
    merged = {}
    for bdf, base in (pci or {}).items():
        item = dict(base)
        base_name = item.get('device_name')
        item.setdefault('raw_name', base_name or base.get('raw', bdf))
        item.setdefault('device_name', base.get('raw', bdf))
        item.setdefault('class_name', '')
        item.setdefault('class_id', '')
        verbose_item = (verbose or {}).get(bdf, {})
        item.update(verbose_item)
        if verbose_item and not verbose_item.get('device_name_explicit') and base_name:
            item['device_name'] = base_name
        if item.get('access_denied') and not str(item.get('class_id', '')).startswith('06'):
            if re.search(r'Root Complex Integrated Endpoint|Root Complex Event Collector', str(item.get('pcie_type') or ''), re.I):
                item.update(link_result='UNKNOWN', link_reason='Access denied; RCiEP/RCEC link applicability cannot be confirmed')
            else:
                item.update(link_result='FAIL', link_reason='Access denied while reading the PCIe link record')
        item['bdf'] = bdf
        # A complete verbose record for a display function can prove that no
        # PCIe Express/link capability was advertised.  Keep this conditional
        # on the captured capabilities evidence; a truncated/unknown record
        # must remain UNKNOWN rather than being guessed as N/A.
        if (item.get('link_result') == 'UNKNOWN' and item.get('verbose_available')
                and item.get('capabilities_seen') and str(item.get('class_id', '')).lower() == '0300'
                and not item.get('pcie_type') and not item.get('link_capability')
                and not item.get('link_current')):
            item.update(link_result='N/A',
                        link_reason='Verbose record shows no PCIe Express/link capability for this display function')
        merged[bdf] = item
    return merged

def pci_issues(baseline, current):
    found = []
    for bdf in sorted(baseline.keys() | current.keys()):
        old, new = baseline.get(bdf), current.get(bdf)
        if (old or {}).get('id') != (new or {}).get('id'):
            old_id = old["id"] if old else "absent"
            new_id = new["id"] if new else "absent"
            lines = []
            if old: lines.append(f"PRE  {old['raw']}")
            if new: lines.append(f"POST {new['raw']}")
            found.append(issue("PCI_DRIFT", bdf, f"PRE {old_id} -> POST {new_id}",
                               snippet="\n".join(lines)))
    return found

def nic_slot_issues(baseline, current):
    """Compare the PRE NIC slot inventory against the current loop's.

    ``baseline``/``current`` map a NIC slot BDF (the upstream root port that owns
    the card) to its ``state`` string as emitted by the hardware script's
    ``CHECK|NIC_SLOT|slot=<bdf>|state=<PRESENT|DEGRADED|MISSING>`` lines.

    A slot that was healthy at PRE and is now absent is a real removal
    (NIC_MISSING); a slot that flipped to a non-Vera device type is
    present-but-degraded (NIC_DEGRADED). Both name the BDF, so a report can say
    exactly which NIC dropped instead of only "one fewer card".
    """
    found = []
    for bdf in sorted(set(baseline) | set(current)):
        old, new = baseline.get(bdf), current.get(bdf)
        if new is None:
            new = 'MISSING'
        if old is None:
            old = 'MISSING'
        if old == new:
            # PRESENT->PRESENT is healthy; DEGRADED->DEGRADED and
            # MISSING->MISSING are pre-existing states, not new degradations.
            continue
        if new == 'PRESENT':
            # DEGRADED->PRESENT and MISSING->PRESENT are recoveries. A card
            # coming back or healing must never be reported as a degradation.
            continue
        if new == 'DEGRADED':
            # e.g. PRESENT->DEGRADED is present-but-degraded. (DEGRADED->DEGRADED
            # was already filtered by old == new.)
            found.append(issue("NIC_DEGRADED", "NIC",
                               f"root port {bdf} -> downstream NIC changed state at PRE={old} -> POST={new} "
                               f"(degraded slot {bdf})",
                               snippet=f"PRE NIC slot {bdf} state={old}; POST state={new}"))
            continue
        # new == 'MISSING': a slot that was healthy or degraded at PRE and is now
        # gone is a real removal (MISSING->MISSING was filtered by old == new).
        found.append(issue("NIC_MISSING", "NIC",
                           f"PRE NIC at slot {bdf} is absent after the loop (missing slot {bdf})",
                           snippet=f"PRE NIC slot {bdf} state={old}; POST absent"))
    return found

def _check_snippet(line):
    """Turn a ``CHECK|<component>|key=value|...`` line into a one-line pointer
    to what the hardware script measured. A missing device has no offending
    row to quote, so the measured counts are the useful evidence."""
    fields = line.split("|")
    if len(fields) < 3:
        return ""
    values = {}
    for field in fields[2:]:
        if "=" in field:
            key, _, value = field.partition("=")
            values[key] = value
    if not values:
        return ""
    actual = values.pop("actual", "")
    expected = values.pop("minimum", values.pop("exact", ""))
    if not actual and not expected:
        return f"{fields[1]}: " + ", ".join(f"{k}={v}" for k, v in values.items())
    head = f"measured {fields[1]} actual={actual}" + (f", expected {expected}" if expected else "")
    sources = values.pop("sources", "")
    extras = ", ".join(f"{k}={v}" for k, v in values.items())
    tail = "; ".join(x for x in (extras, f"sources: {sources}" if sources else "") if x)
    return head + (f" — {tail}" if tail else "")

def config_issues(text, code):
    items = []
    checks = {}
    for line in text.splitlines():
        if line.startswith("CHECK|"):
            fields = line.split("|")
            if len(fields) >= 3:
                snippet = _check_snippet(line)
                checks.setdefault(fields[1], snippet)
                # Some checks (for example PCIE_DOWNGRADE) key the issue by BDF,
                # not by the check name, so index those under the BDF too.
                for field in fields[2:]:
                    if field.startswith("bdf="):
                        checks.setdefault(field[4:], snippet)
        elif line.startswith("ISSUE|"):
            fields = line.split("|", 3)
            if len(fields) == 4:
                items.append(issue(fields[1], fields[2], fields[3], snippet=checks.get(fields[2], "")))
    if code != 0 and not items:
        items.append(issue("CONFIG_FAILED", "hardware", f"Hardware script exited {code}"))
    if "RESULT|FAIL" in text and not items:
        items.append(issue("CONFIG_FAILED", "hardware", "Hardware script returned RESULT|FAIL"))
    if "RESULT|" not in text:
        items.append(issue("CONFIG_INCOMPLETE", "hardware", "Hardware script did not return a final structured result"))
    # Legacy scripts may omit structured issues. Only fall back to prose when no
    # structured PCIe signal exists (an ISSUE|PCIE_* finding or a CHECK|PCIE_LINK
    # line), otherwise the structured data is authoritative and guessing from the
    # raw lspci dump would duplicate findings under the wrong BDF.
    structured_pcie = any(
        str(i.get('code', '')).startswith('PCIE_') for i in items
    ) or 'CHECK|PCIE_LINK' in text
    if not structured_pcie:
        # Walk the verbose dump one device block at a time: only an explicitly
        # identified Express Endpoint contributes, and its LnkSta must belong to
        # that same block. A BDF embedded in the line (bdf=...) always wins.
        bdf, endpoint = "", False
        for line in text.splitlines():
            header = re.match(r"^([0-9a-f]{4}:[0-9a-f]{2}:[0-9a-f]{2}\.[0-7])\s", line, re.I)
            if header:
                bdf, endpoint = header[1], False
                continue
            inline = re.search(r"\bbdf=([0-9a-f]{4}:[0-9a-f]{2}:[0-9a-f]{2}\.[0-7])\b", line, re.I)
            if re.search(r"Express.*(?:Legacy\s+)?Endpoint", line):
                endpoint = True
                continue
            if endpoint and "LnkSta:" in line:
                link_code = "PCIE_DOWNGRADE" if re.search(r"down[\s-]*grad|degrad", line, re.I) else "PCIE_LINK_UNAVAILABLE" if re.search(r"Speed\s+unknown|Width\s+x0\b", line, re.I) else None
                component = inline[1] if inline else bdf
                if link_code and not any(i['code'] == link_code and i['component'] == component for i in items):
                    items.append(issue(link_code, component, line.strip(), snippet=_check_snippet(line) or line.strip()))
    return items

def parse_hardware_checks(text, findings):
    """Parse ``CHECK|`` lines into (checks, details).

    ``checks`` keeps the PASS/FAIL/UNSUPPORTED state per check key (what the
    report badges); ``details`` keeps the measured key=value pairs and the raw
    line so the report's "Measured detail" column can render them. A check whose
    component (or a related component such as CPU for CPU_ONLINE) already has a
    finding is downgraded to FAIL.
    """
    checks = {}
    details = {}
    for line in text.splitlines():
        if not line.startswith('CHECK|'):
            continue
        cells = line.split('|')
        name = cells[1]
        values = dict(c.split('=', 1) for c in cells[2:] if '=' in c)
        if name == 'NIC_SLOT' and 'slot' in values:
            # The per-slot NIC inventory is tracked separately (record['nic_slots'])
            # and reported through NIC_MISSING / NIC_DEGRADED findings whose
            # component is 'NIC'. Emitting a NIC_SLOT check here would badge PASS
            # while the NIC finding is FAIL, because 'NIC_SLOT' never matches the
            # 'NIC' finding component. Skip it so the report has one authority.
            continue
        component = values.get('bdf', name)
        state = 'UNSUPPORTED' if values.get('state') == 'unsupported' else 'PASS'
        related = {'CPU_ONLINE': 'CPU', 'MEMORY_VISIBLE': 'DIMM', 'BF4_IDENTITIES': 'BF4'}.get(name, component)
        if any(i['component'] in {component, related} for i in findings):
            state = 'FAIL'
        key = f'{name}/{component}' if 'bdf' in values else name
        checks[key] = state
        details[key] = dict(name=name, values=values, raw=line, status=state)
    return checks, details

def _sel_identity(*values):
    return hashlib.sha256(json.dumps(values,sort_keys=True,ensure_ascii=False).encode()).hexdigest()


def sel_records(text):
    result=[]
    for line in text.splitlines():
        cells=[c.strip() for c in line.split('|')]
        if len(cells)<4: continue
        record_id=cells[0]; description=' | '.join(cells[3:])
        deassert=bool(re.search(r'deassert',description,re.I))
        # OEM/unknown SEL has no universal severity contract. Preserve for review,
        # and do not invent FAIL from the mere presence of a record.
        critical=bool(re.search(r'uncorrectable|non-recoverable|fatal|upper critical|lower critical',description,re.I))
        warning=bool(re.search(r'correctable|non-critical|threshold',description,re.I))
        severity='INFO' if deassert else 'FAIL' if critical else 'WARN' if warning else 'UNKNOWN'
        result.append(dict(record_id=record_id,source_time=' '.join(cells[1:3]),message=description,
                           raw=line,severity=severity,assertion=not deassert,
                           fingerprint=_sel_identity(cells[3],re.sub(r'\b(?:upper|lower) critical\b','critical',description))))
    return result


def sel_delta(previous, current):
    # Complete record text includes record ID and timestamp; reused IDs remain visible.
    old = Counter(line.strip() for line in previous.splitlines() if "|" in line)
    result = []
    for line in current.splitlines():
        key = line.strip()
        if "|" not in key:
            continue
        if old[key]:
            old[key] -= 1
        else:
            result.append(line)
    return "\n".join(result) + ("\n" if result else "")

# Redfish log entries carry a vendor Severity of OK/Warning/Critical. Rank them
# like dmesg native severity so both sources share one "worst wins" verdict.
REDFISH_SEVERITY_RANK = {"ok": 0, "warning": 1, "critical": 2}

def redfish_member_kind(member):
    """Classify one Redfish collection member.

    Returns "entry" for an expanded object (has Id/Severity/Message), "reference"
    for a bare ``@odata.id`` link, or "unknown" for anything else. An unknown
    member is not "zero events": the caller must treat the collection as
    unreadable rather than silently dropping it.
    """
    if not isinstance(member, dict):
        return "unknown"
    if member.get("@odata.id") and not any(k in member for k in ("Id", "Severity", "Message")):
        return "reference"
    if any(k in member for k in ("Id", "Severity", "Message")):
        return "entry"
    return "unknown"

def redfish_collection(payload):
    """Strictly validate a Redfish collection payload.

    Returns ``(members, valid, reason)``. A structurally broken collection
    (non-dict, missing/non-list ``Members``, or a member that is neither an
    expanded entry nor a reference - e.g. ``[null, 7]``) is invalid, and callers
    must not conclude that any particular service is absent. Only a successfully
    read, structurally valid collection lets us say a service is NOT PRESENT.
    """
    if not isinstance(payload, dict):
        return [], False, "payload is not a JSON object"
    members = payload.get("Members")
    if not isinstance(members, list):
        return [], False, "collection has no Members list"
    for index, member in enumerate(members):
        if redfish_member_kind(member) == "unknown":
            return [], False, f"Members[{index}] is neither an entry nor a reference"
    return members, True, ""

def redfish_page_next_link(payload):
    """Return the ``Members@odata.nextLink`` of a collection page, or "".

    LogServices and log-entry collections can be paginated; a nextLink on page 1
    must be followed or a service that only appears on page 2 is wrongly reported
    as NOT PRESENT.
    """
    if not isinstance(payload, dict):
        return ""
    link = payload.get("Members@odata.nextLink")
    return str(link) if link else ""

# Redfish members arrive with vendor casing (Id/Severity/Created/Message) and
# are normalised to lowercase once; read either spelling so no evidence line is
# blanked when a raw entry reaches a writer through a failure path.
_REDFISH_FIELDS = {'id': ('id', 'Id'), 'severity': ('severity', 'Severity'),
                   'created': ('created', 'Created'), 'message': ('message', 'Message'),
                   'severity_key': ('severity_key', 'Severity')}

def _entry_field(entry, field):
    if not isinstance(entry, dict):
        return ""
    for key in _REDFISH_FIELDS.get(field, (field,)):
        if key in entry and entry[key] is not None:
            return entry[key]
    return ""

def redfish_entries(payload):
    """Parse a Redfish LogService Entries collection into normalised records.

    Accepts the decoded JSON payload (dict) and returns a list of entries with
    the fields needed for comparison and display. Vendor id/severity/message are
    kept verbatim; missing pieces become empty strings rather than guesses.
    """
    if not isinstance(payload, dict):
        return []
    members = payload.get("Members")
    if not isinstance(members, list):
        return []
    entries = []
    for item in members:
        if not isinstance(item, dict):
            continue
        severity = str(item.get("Severity", "") or "")
        entries.append(dict(
            id=str(item.get("Id", "") or ""),
            severity=severity,
            severity_key=severity.strip().lower(),
            created=str(item.get("Created", "") or ""),
            message=str(item.get("Message", "") or ""),
            resolved=bool(item.get("Resolved", False)),
        ))
    return entries

def redfish_verdict(entries):
    """Return (verdict, counts) for a list of parsed Redfish entries.

    Worst severity wins, matching dmesg policy: any Critical -> FAIL, else any
    Warning -> WARN, else PASS (including empty). ``counts`` tallies each raw
    severity so console summaries can show Critical/Warning/OK breakdowns.
    """
    counts = {"Critical": 0, "Warning": 0, "OK": 0, "Other": 0}
    worst = 0
    for entry in entries:
        key = entry.get("severity_key") or ""
        rank = REDFISH_SEVERITY_RANK.get(key, 0)
        if key == "critical":
            counts["Critical"] += 1
        elif key == "warning":
            counts["Warning"] += 1
        elif key == "ok":
            counts["OK"] += 1
        else:
            counts["Other"] += 1
        worst = max(worst, rank)
    verdict = "FAIL" if worst >= 2 else "WARN" if worst == 1 else "PASS"
    return verdict, counts

def redfish_delta(previous, current):
    """Return entries present in ``current`` but not ``previous``.

    Comparison uses Id + Message + Severity so a reused Id with new content is
    still reported. Timestamps are deliberately excluded: RTC-less BMCs (e.g.
    2000-01-03) make time-based diffing unreliable.
    """
    def key(entry):
        return (entry.get("id", ""), entry.get("message", ""), entry.get("severity", ""))
    old = Counter(key(e) for e in previous)
    result = []
    for entry in current:
        k = key(entry)
        if old[k]:
            old[k] -= 1
        else:
            result.append(entry)
    return result
