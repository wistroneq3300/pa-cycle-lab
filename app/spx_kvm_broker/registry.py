# -*- coding: utf-8 -*-
"""Session registry: broker-managed BMC Web sessions + launch_ids (SQLite).

Stores (per spec):
  launch_ids: id, server_id, bmc_subdomain, portal_user_id, portal_session_id,
              used_at, created_at, expires_at, redirect_host
  broker_sessions: server_id, bmc_subdomain, portal_user_id, portal_session_id,
              broker_session_id, cookies_blob, created_at, last_seen_at,
              expires_at, state

No credentials are stored. broker_session_id is an opaque server-side handle
(the BMCSession id), not the BMC password. The authenticated BMC cookies are
stored in cookies_blob ONLY to allow reuse/refresh on repeat launches; they are
kept root-only and never returned to the browser in any plaintext form.

Concurrency is handled by SQLite with WAL and IMMEDIATE transactions guarded by
a single-process writer lock. The broker is intended to run as a single
service process (uvicorn workers=1). Cross-process coordination would need a
shared store; out of scope for this PoC deployment.
"""
from __future__ import annotations

import json
import secrets
import sqlite3
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

ST_ACTIVE = "active"
ST_STALE = "stale"


@dataclass
class BrokerSession:
    broker_session_id: str
    server_id: str
    bmc_subdomain: str
    portal_user_id: str
    portal_session_id: str
    cookies_json: str
    created_at: float
    last_seen_at: float
    expires_at: float
    state: str


class SessionRegistry:
    def __init__(self, db_path: Path):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute("PRAGMA busy_timeout=5000")
        self._init_schema()

    def _init_schema(self):
        with self._lock:
            cur = self._conn.cursor()
            cur.executescript(
                """
                CREATE TABLE IF NOT EXISTS launch_ids (
                    id TEXT PRIMARY KEY,
                    server_id TEXT NOT NULL,
                    bmc_subdomain TEXT NOT NULL,
                    portal_user_id TEXT NOT NULL,
                    portal_session_id TEXT NOT NULL,
                    redirect_host TEXT NOT NULL,
                    created_at REAL NOT NULL,
                    expires_at REAL NOT NULL,
                    used_at REAL
                );
                CREATE TABLE IF NOT EXISTS broker_sessions (
                    broker_session_id TEXT PRIMARY KEY,
                    server_id TEXT NOT NULL,
                    bmc_subdomain TEXT NOT NULL,
                    portal_user_id TEXT NOT NULL,
                    portal_session_id TEXT NOT NULL,
                    cookies_json TEXT NOT NULL,
                    created_at REAL NOT NULL,
                    last_seen_at REAL NOT NULL,
                    expires_at REAL NOT NULL,
                    state TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_launch_expires ON launch_ids(expires_at);
                CREATE INDEX IF NOT EXISTS idx_sess_server ON broker_sessions(server_id, state);
                """
            )
            self._conn.commit()

    # -- launch_id -----------------------------------------------------------
    def put_launch(self, launch_id: str, server_id: str, bmc_subdomain: str,
                   portal_user_id: str, portal_session_id: str,
                   redirect_host: str, ttl_seconds: int) -> None:
        now = time.time()
        with self._lock:
            self._conn.execute(
                "UPDATE launch_ids SET used_at=? WHERE expires_at<? ",
                (now, now))
            self._conn.execute(
                "INSERT INTO launch_ids"
                "(id,server_id,bmc_subdomain,portal_user_id,portal_session_id,"
                "redirect_host,created_at,expires_at,used_at) "
                "VALUES (?,?,?,?,?,?,?,?,NULL)",
                (launch_id, server_id, bmc_subdomain, portal_user_id,
                 portal_session_id, redirect_host, now, now + ttl_seconds))
            self._conn.commit()

    def consume_launch(self, launch_id: str, now: float | None = None) -> Optional[dict]:
        """Atomically validate TTL + single-use, return the launch record and
        mark it used. Returns None if invalid/used/expired/servers mismatch.
        The caller must verify RBAC binding against the requestor again.
        """
        now = now or time.time()
        with self._lock:
            self._conn.execute("BEGIN IMMEDIATE")
            row = self._conn.execute(
                "SELECT id,server_id,bmc_subdomain,portal_user_id,"
                "portal_session_id,redirect_host,expires_at,used_at "
                "FROM launch_ids WHERE id=?", (launch_id,)).fetchone()
            if not row:
                self._conn.rollback()
                return None
            record = {
                "id": row[0], "server_id": row[1], "bmc_subdomain": row[2],
                "portal_user_id": row[3], "portal_session_id": row[4],
                "redirect_host": row[5], "expires_at": row[6], "used_at": row[7],
            }
            if record["used_at"] is not None:
                self._conn.rollback()
                return None  # already used (single-use violation)
            if now > record["expires_at"]:
                self._conn.execute("UPDATE launch_ids SET used_at=? WHERE id=?",
                                   (now, launch_id))
                self._conn.commit()
                return None  # expired
            # single-use consume
            self._conn.execute("UPDATE launch_ids SET used_at=? WHERE id=?",
                               (now, launch_id))
            self._conn.commit()
            return record

    def purge_launches(self, now: float | None = None) -> int:
        now = now or time.time()
        with self._lock:
            n = self._conn.execute(
                "DELETE FROM launch_ids WHERE expires_at < ? OR used_at IS NOT NULL",
                (now,)).rowcount
            self._conn.commit()
            return n

    # -- broker sessions -----------------------------------------------------
    def active_session_for(self, server_id: str, portal_user_id: str,
                           portal_session_id: str) -> Optional[BrokerSession]:
        with self._lock:
            row = self._conn.execute(
                "SELECT broker_session_id,server_id,bmc_subdomain,portal_user_id,"
                "portal_session_id,cookies_json,created_at,last_seen_at,"
                "expires_at,state FROM broker_sessions"
                " WHERE server_id=? AND portal_user_id=? AND portal_session_id=?"
                " AND state='active' ORDER BY last_seen_at DESC LIMIT 1",
                (server_id, portal_user_id, portal_session_id)).fetchone()
        return self._row_to_session(row) if row else None

    def any_active_session_for_server(self, server_id: str) -> Optional[BrokerSession]:
        """Active broker-managed session regardless of which portal user holds it.
        Used for per-BMC cap enforcement (max=1)."""
        with self._lock:
            row = self._conn.execute(
                "SELECT broker_session_id,server_id,bmc_subdomain,portal_user_id,"
                "portal_session_id,cookies_json,created_at,last_seen_at,"
                "expires_at,state FROM broker_sessions"
                " WHERE server_id=? AND state='active' ORDER BY last_seen_at DESC LIMIT 1",
                (server_id,)).fetchone()
        return self._row_to_session(row) if row else None

    def put_session(self, bsid: str, server_id: str, bmc_subdomain: str,
                    portal_user_id: str, portal_session_id: str,
                    cookies: dict, ttl_seconds: int) -> None:
        now = time.time()
        cookies_json = json.dumps(cookies)
        with self._lock:
            self._conn.execute(
                "INSERT OR REPLACE INTO broker_sessions"
                "(broker_session_id,server_id,bmc_subdomain,portal_user_id,"
                "portal_session_id,cookies_json,created_at,last_seen_at,"
                "expires_at,state) VALUES (?,?,?,?,?,?,?,?,?,?)",
                (bsid, server_id, bmc_subdomain, portal_user_id, portal_session_id,
                 cookies_json, now, now, now + ttl_seconds, ST_ACTIVE))
            self._conn.commit()

    def touch_session(self, bsid: str, extend_ttl_seconds: int | None = None) -> None:
        now = time.time()
        with self._lock:
            if extend_ttl_seconds:
                self._conn.execute(
                    "UPDATE broker_sessions SET last_seen_at=?, expires_at=? WHERE broker_session_id=?",
                    (now, now + extend_ttl_seconds, bsid))
            else:
                self._conn.execute(
                    "UPDATE broker_sessions SET last_seen_at=? WHERE broker_session_id=?",
                    (now, bsid))
            self._conn.commit()

    def mark_stale(self, bsid: str) -> None:
        with self._lock:
            self._conn.execute(
                "UPDATE broker_sessions SET state=? WHERE broker_session_id=?",
                (ST_STALE, bsid))
            self._conn.commit()

    def mark_all_stale_for_subdomain(self, bmc_subdomain: str) -> None:
        with self._lock:
            self._conn.execute(
                "UPDATE broker_sessions SET state=? WHERE bmc_subdomain=? AND state='active'",
                (ST_STALE, bmc_subdomain))
            self._conn.commit()

    def get_session(self, bsid: str) -> Optional[BrokerSession]:
        with self._lock:
            row = self._conn.execute(
                "SELECT broker_session_id,server_id,bmc_subdomain,portal_user_id,"
                "portal_session_id,cookies_json,created_at,last_seen_at,"
                "expires_at,state FROM broker_sessions WHERE broker_session_id=?",
                (bsid,)).fetchone()
        return self._row_to_session(row) if row else None

    def stale_eligible(self, now: float | None = None) -> List[BrokerSession]:
        """Sessions that are stale/expired and should be logged out at BMC."""
        now = now or time.time()
        with self._lock:
            rows = self._conn.execute(
                "SELECT broker_session_id,server_id,bmc_subdomain,portal_user_id,"
                "portal_session_id,cookies_json,created_at,last_seen_at,"
                "expires_at,state FROM broker_sessions"
                " WHERE state='active' AND expires_at<?",
                (now,)).fetchall()
        return [self._row_to_session(r) for r in rows]

    def list_all(self) -> List[BrokerSession]:
        with self._lock:
            rows = self._conn.execute(
                "SELECT broker_session_id,server_id,bmc_subdomain,portal_user_id,"
                "portal_session_id,cookies_json,created_at,last_seen_at,"
                "expires_at,state FROM broker_sessions ORDER BY created_at DESC").fetchall()
        return [self._row_to_session(r) for r in rows]

    @staticmethod
    def _row_to_session(row) -> BrokerSession:
        return BrokerSession(
            broker_session_id=row[0], server_id=row[1], bmc_subdomain=row[2],
            portal_user_id=row[3], portal_session_id=row[4], cookies_json=row[5],
            created_at=row[6], last_seen_at=row[7], expires_at=row[8], state=row[9],
        )

    def close(self):
        with self._lock:
            try:
                self._conn.close()
            except Exception:
                pass


def new_launch_id() -> str:
    return secrets.token_urlsafe(24)


def new_broker_session_id() -> str:
    return secrets.token_hex(16)
