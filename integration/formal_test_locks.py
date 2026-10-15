"""Durable Agent/Cycle execution exclusion without touching interactive sessions.

These reservations apply only to formal PA Agent and Cycle test execution.
Terminal, Broadcast, direct SSH command sessions, and KVM never call this module
and therefore remain independent, concurrent operator tools.
"""
from __future__ import annotations

from pathlib import Path
import ipaddress
import sqlite3
import time


class FormalTestBusy(ValueError):
    """A formal test already owns the requested Node or shared resource."""


def _value(target, key):
    value = (target or {}).get(key)
    return str(value).strip() if value is not None else ""


def formal_scopes(target):
    """Return only formal-test scopes required by AG-06.

    A stable Node identity is always reserved. Shared controller, BMC endpoint,
    power-domain, and AUX-domain identities are added when inventory provides
    them, preventing two different Nodes from colliding on common hardware.
    """
    target = target or {}
    node = _value(target, "node_id") or _value(target, "name")
    scopes = {f"node:{node}"} if node else set()
    controller = _value(target, "controller_id")
    if controller:
        scopes.add(f"controller:{controller}")
    bmc = _value(target, "bmc_ip")
    if bmc:
        try:
            bmc = str(ipaddress.ip_address(bmc))
        except ValueError:
            pass
        scopes.add(f"bmc:{bmc.lower()}")
    for field in ("power_domain", "aux_domain"):
        domain = _value(target, field)
        if domain:
            scopes.add(f"domain:{domain}")
    return sorted(scopes)


class FormalTestCoordinator:
    """Small cross-process SQLite coordinator shared by Agent and Cycle."""

    def __init__(self, path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        db = self._connect()
        try:
            db.executescript(
                """
                CREATE TABLE IF NOT EXISTS formal_test_locks(
                    scope TEXT PRIMARY KEY,
                    owner TEXT NOT NULL,
                    kind TEXT NOT NULL,
                    node_id TEXT NOT NULL,
                    acquired_at REAL NOT NULL
                );
                CREATE INDEX IF NOT EXISTS formal_test_locks_owner
                    ON formal_test_locks(owner);
                """
            )
            db.commit()
        finally:
            db.close()

    def _connect(self):
        db = sqlite3.connect(self.path, timeout=30)
        db.row_factory = sqlite3.Row
        return db

    def acquire(self, owner, kind, targets):
        owner = str(owner).strip()
        kind = str(kind).strip().upper()
        rows = []
        for target in targets or []:
            node = _value(target, "node_id") or _value(target, "name") or "unknown"
            rows.extend((scope, owner, kind, node, time.time())
                        for scope in formal_scopes(target))
        rows = list({row[0]: row for row in rows}.values())
        if not owner or not rows:
            raise ValueError("A formal test requires an owner and stable Node identity")
        db = self._connect()
        try:
            db.execute("BEGIN IMMEDIATE")
            placeholders = ",".join("?" for _ in rows)
            scopes = [row[0] for row in rows]
            conflicts = db.execute(
                f"SELECT scope,owner,kind,node_id FROM formal_test_locks "
                f"WHERE scope IN ({placeholders}) AND owner<>? ORDER BY scope",
                (*scopes, owner),
            ).fetchall()
            if conflicts:
                held = conflicts[0]
                raise FormalTestBusy(
                    "Node 或共用 Power Domain / BMC 資源正在執行正式測試"
                    f"（{held['kind']} · {held['node_id']}）。未建立自動 Queue；"
                    "資源釋放後仍須由工程師重新確認。"
                )
            db.executemany(
                "INSERT OR IGNORE INTO formal_test_locks"
                "(scope,owner,kind,node_id,acquired_at) VALUES(?,?,?,?,?)",
                rows,
            )
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    def release(self, owner):
        db = self._connect()
        try:
            db.execute("DELETE FROM formal_test_locks WHERE owner=?", (str(owner),))
            db.commit()
        finally:
            db.close()

    def owns(self, owner):
        db = self._connect()
        try:
            return db.execute(
                "SELECT 1 FROM formal_test_locks WHERE owner=? LIMIT 1",
                (str(owner),),
            ).fetchone() is not None
        finally:
            db.close()

    def rows(self):
        db = self._connect()
        try:
            return [dict(row) for row in db.execute(
                "SELECT scope,owner,kind,node_id,acquired_at "
                "FROM formal_test_locks ORDER BY scope"
            )]
        finally:
            db.close()

    def prune(self, prefix, valid_owners):
        """Remove only settled owners of one subsystem after process recovery."""
        prefix = str(prefix)
        valid = {str(owner) for owner in valid_owners}
        db = self._connect()
        try:
            rows = db.execute(
                "SELECT DISTINCT owner FROM formal_test_locks WHERE owner LIKE ?",
                (prefix + "%",),
            ).fetchall()
            stale = [row["owner"] for row in rows if row["owner"] not in valid]
            db.executemany("DELETE FROM formal_test_locks WHERE owner=?",
                           [(owner,) for owner in stale])
            db.commit()
        finally:
            db.close()
        return stale
