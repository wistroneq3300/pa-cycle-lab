"""Pure inventory, baseline and issue evaluation. No remote side effects."""
from __future__ import annotations

import csv
import hashlib
import ipaddress
import json
import re
import os
import tempfile
import time
from collections import Counter

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path

from cycle_dmesg import dmesg_issues

ROLES = ("bmc", "os", "lily_bmc", "lily_os")

LOG_TIMEZONE = timezone(timedelta(hours=8), name="UTC+8")

def now():
    """Return operator-facing timestamps in the rack lab timezone (UTC+8)."""
    return datetime.now(LOG_TIMEZONE).isoformat(timespec="seconds")

class EvidencePersistenceError(RuntimeError):
    """Evidence could not be saved; further destructive dispatch is forbidden."""


def atomic_write(path, text, durable=False):
    try:
        _atomic_write(path,text,durable)
    except OSError as exc:
        raise EvidencePersistenceError('Evidence persistence failure: '+type(exc).__name__) from exc


def _atomic_write(path, text, durable=False):
    path = Path(path)
    temp = None
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=path.parent,
                                         prefix=path.name+'.', suffix='.tmp', delete=False) as stream:
            temp = Path(stream.name)
            stream.write(text)
            stream.flush()
            if durable: os.fsync(stream.fileno())
        # Retry this local replace only, never the remote command that produced it.
        for attempt in range(8):
            try:
                temp.replace(path)
                if durable and os.name!='nt':
                    directory=os.open(path.parent,os.O_RDONLY)
                    try: os.fsync(directory)
                    finally: os.close(directory)
                return
            except PermissionError:
                if attempt == 7: raise
                time.sleep(min(.02 * 2**attempt, .5))
    finally:
        if temp is not None: temp.unlink(missing_ok=True)


def write_json(path, value):
    atomic_write(path, json.dumps(value, indent=2, ensure_ascii=True) + "\n")

def digest(data):
    return hashlib.sha256(data).hexdigest()

@dataclass(frozen=True)
class Target:
    tray: str
    node: str
    bmc_ip: str
    os_ip: str
    bmc_hostname: str = ""
    os_hostname: str = ""
    lily_bmc_ip: str = ""
    lily_os_ip: str = ""
    lily_bmc_hostname: str = ""
    lily_os_hostname: str = ""

    @property
    def key(self):
        return f"{self.tray}_{self.node}"

    def endpoints(self):
        return [(r, getattr(self, r + "_ip"), getattr(self, r + "_hostname"))
                for r in ROLES if getattr(self, r + "_ip")]

def load_inventory(path):
    with Path(path).open(encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream)
        required = {"tray", "node", "bmc_ip", "os_ip", "bmc_hostname", "os_hostname"}
        if not required.issubset(reader.fieldnames or []):
            raise ValueError("Inventory missing columns: " + ", ".join(sorted(required - set(reader.fieldnames or []))))
        rows = []
        seen = set()
        for line, row in enumerate(reader, 2):
            if None in row:
                raise ValueError(f"Inventory line {line}: too many columns")
            item = Target(**{k: (row.get(k) or "").strip() for k in Target.__dataclass_fields__})
            if not all(re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9.-]*", x) for x in (item.tray, item.node)):
                raise ValueError(f"Inventory line {line}: tray/node must use letters, digits, dots or hyphens")
            if item.key.lower() in seen:
                raise ValueError(f"Duplicate tray/node: {item.key}")
            seen.add(item.key.lower())
            for role, addr, host in item.endpoints():
                try:
                    ipaddress.ip_address(addr)
                except ValueError as exc:
                    raise ValueError(f"{item.key}: invalid {role} IP: {addr}") from exc
                if host and not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9.-]*", host):
                    raise ValueError(f"{item.key}: invalid {role} hostname")
            rows.append(item)
    if not rows:
        raise ValueError("Inventory has no targets")
    return rows

def select_targets(targets, selections):
    if selections == ["all"]:
        return targets
    chosen = []
    for name in selections:
        matches = [t for t in targets if name in (t.key, t.node, f"{t.tray}/{t.node}")]
        if len(matches) != 1:
            raise ValueError(f"Unknown or ambiguous target '{name}'; use tray/node")
        if matches[0] in chosen:
            raise ValueError(f"Duplicate selection: {matches[0].key}")
        chosen.append(matches[0])
    if not chosen:
        raise ValueError("Select at least one target")
    return chosen

def inventory_blocks(targets):
    blocked = {t.key: [] for t in targets}
    addresses = {}
    for t in targets:
        for role in ("bmc", "os"):
            if not getattr(t, role + "_ip"):
                blocked[t.key].append(f"Missing {role} IP")
        for role, addr, host in t.endpoints():
            if not host:
                blocked[t.key].append(f"Missing expected {role} hostname")
            addresses.setdefault(str(ipaddress.ip_address(addr)), []).append((t.key, role))
    for addr, uses in addresses.items():
        if len(uses) > 1:
            reason = f"Duplicate endpoint {addr}: " + ", ".join(f"{key}/{role}" for key, role in uses)
            for key, _ in uses:
                blocked[key].append(reason)
    return {k: v for k, v in blocked.items() if v}

# Compatibility exports: Cycle and inspection call these exact same functions.
from validation_rules import *

def node_records(node):
    """Execution order shared by summaries and reports, including START evidence."""
    return [node['pre'], *([node['start']] if node.get('start') else []), *node['loops']]


def records_health(records):
    """Retain observed severity without treating missing evidence as a PASS.

    FAIL/WARN remain visible even during pending collection. Unknown and pending
    evidence are distinguished when no observed hardware issue takes priority.
    """
    records = list(records)
    states = set()
    for record in records:
        issues = record.get('issues', [])
        valid = [i for i in issues if i.get('severity') in {'FAIL','WARN'}]
        states.add(health(valid))
        if len(valid) != len(issues):
            states.add('UNKNOWN')
    for record in records:
        value = record.get('status', 'UNKNOWN')
        states.add(value if value in {'FAIL', 'WARN', 'UNKNOWN', 'PENDING', 'PASS'} else 'UNKNOWN')
        if not record.get('finished'):
            states.add('PENDING')
    if not records:
        return 'UNKNOWN'
    return next(value for value in ('FAIL', 'WARN', 'UNKNOWN', 'PENDING', 'PASS') if value in states)


def _redfish_delta_ids(record):
    """Ids introduced this record's before->POST delta, or None if unavailable.

    Prefers the explicit top-level marker written at capture time; falls back to
    the per-service meta so records captured before the marker existed still
    classify Redfish findings against their loop delta. ``None`` means no
    comparable delta, so the caller keeps the PRE baseline.
    """
    marker = record.get('eventlog_delta_ids')
    if marker is not None:
        return {str(i) for i in marker}
    ids = set()
    seen_meta = False
    for stem in ('eventlog_meta', 'redfish_sel_meta'):
        meta = record.get(stem)
        if not meta:
            continue
        seen_meta = True
        delta = meta.get('delta') or {}
        if delta.get('status') == 'UNAVAILABLE':
            return None
        for entry in delta.get('new_entries', []):
            ids.add(str(entry.get('id', '')))
    return ids if seen_meta else None


def aggregate_issues(campaign):
    merged = {}
    for node in campaign["nodes"]:
        # Keep the PRE comparison separate from severity and causation.
        pre_keys = issue_baseline(node['pre']['issues'])
        for record in node_records(node):
            delta_ids = _redfish_delta_ids(record)
            classified = classify_against_pre([i.copy() for i in record['issues']], pre_keys)
            for item in classified:
                # Redfish findings classify against this loop's before->POST
                # delta, not the PRE baseline, so a long-lived event is NEW only
                # on the loop that introduced it. An UNAVAILABLE delta leaves the
                # marker absent, so the PRE baseline still applies.
                if delta_ids is not None and item.get('identity'):
                    event_id = item['identity'].split('|')[1] if '|' in item['identity'] else ''
                    item['per_loop_new'] = event_id in delta_ids
                    item['classification'] = 'NEW' if item['per_loop_new'] else 'KNOWN'
                    item['known_reason'] = ('' if item['per_loop_new']
                                            else 'Introduced in an earlier loop of this campaign')
                key = (node["key"], *issue_key(item))
                entry = merged.setdefault(key, {**item, "node": node["key"], "occurrences": []})
                if item["severity"] == "FAIL":
                    entry["severity"] = "FAIL"
                # NEW wins over KNOWN when the same finding is observed across
                # phases, so the group surfaces where it was first introduced.
                if entry.get('classification') != 'NEW':
                    entry['classification'] = item['classification']
                    entry['known_reason'] = item['known_reason']
                if item.get('severity_changed'):
                    entry['severity_changed'] = True
                    entry['previous_severity'] = item.get('previous_severity')
                    entry['current_severity'] = item.get('current_severity')
                entry["occurrences"].append(dict(phase=record["phase"], detail=item["detail"],
                                                  classification=item.get("classification", ""),
                                                  evidence=item.get("evidence", ""),
                                                  snippet=item.get("snippet", "")))
    return list(merged.values())
