"""AgentRun / AgentRunContext storage for PA Agent (P3-b).

P3 splits a PA Agent execution into two halves:

* **AgentRunContext** — an immutable snapshot built once by the PA backend from
  the test library and the current machine binding. It is never mutated after
  creation so a run is reproducible and auditable.
* **AgentRun state** — the mutable side (status, approvals, conversation ref,
  commands, evidence, final result) that the Gateway/engine advance over time.

Both live in one SQLite database (``agent_runs.sqlite3`` under the instance data
dir) so writes are transactional. The context is stored as a JSON blob and the
table is guarded against updates; the mutable state is stored separately.

This module is deliberately free of OpenHands concerns: P3-c wires the Gateway
that consumes a run; P3-b only creates and exposes runs.
"""
from __future__ import annotations

import datetime
import hashlib
import json
import os
import sqlite3
import threading
import uuid
from pathlib import Path

CONTEXT_SCHEMA_VERSION = 1

# Run lifecycle. PENDING and RUNNING are in-flight; the rest are terminal except
# WAITING_FOR_USER, which pauses for an operator decision.
STATUS_PENDING = "PENDING"
STATUS_RUNNING = "RUNNING"
STATUS_WAITING_FOR_USER = "WAITING_FOR_USER"
STATUS_PASS = "PASS"
STATUS_FAIL = "FAIL"
STATUS_BLOCKED = "BLOCKED"
STATUS_ERROR = "ERROR"

# Slots the context snapshot packs from a reviewed row. The full ``ai_review``
# object is kept verbatim alongside these so nothing is lost or invented.
_TESTCASE_FIELDS = (
    "code", "sub_function", "test_set", "items", "procedure", "criteria",
    "risk", "ai_can_execute", "ai_commands", "ai_packages_needed",
    "ai_logs_output", "ai_precheck", "ai_postcheck", "ai_agent_instruction",
)


def _now() -> str:
    return datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat()


def context_hash(context: dict) -> str:
    """Stable digest of a context, used to prove it was not mutated after creation."""
    raw = json.dumps(context, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


class AgentRunStore:
    """SQLite-backed store for AgentRun contexts and their mutable state."""

    def __init__(self, path=None):
        base = os.environ.get("PA_DATA_DIR") or str(Path(__file__).resolve().parents[1] / "data")
        self.path = Path(path or (Path(base) / "agent_runs.sqlite3"))
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._init_schema()

    def _connect(self):
        conn = sqlite3.connect(self.path, timeout=30)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        return conn

    def _init_schema(self):
        with self._lock, self._connect() as db:
            db.executescript(
                """
                CREATE TABLE IF NOT EXISTS agent_runs (
                    run_id            TEXT PRIMARY KEY,
                    case_variant_id   TEXT NOT NULL,
                    library_version   TEXT NOT NULL,
                    context_json      TEXT NOT NULL,
                    context_hash      TEXT NOT NULL,
                    created_at        TEXT NOT NULL,
                    created_by        TEXT
                );
                CREATE INDEX IF NOT EXISTS idx_agent_runs_variant
                    ON agent_runs(case_variant_id);
                CREATE INDEX IF NOT EXISTS idx_agent_runs_created
                    ON agent_runs(created_at);

                CREATE TABLE IF NOT EXISTS agent_run_state (
                    run_id            TEXT PRIMARY KEY REFERENCES agent_runs(run_id) ON DELETE CASCADE,
                    status            TEXT NOT NULL,
                    conversation_ref  TEXT,
                    final_result      TEXT,
                    failure_reason    TEXT,
                    started_at        TEXT,
                    ended_at          TEXT,
                    updated_at        TEXT NOT NULL,
                    approvals_json    TEXT NOT NULL DEFAULT '[]',
                    commands_json     TEXT NOT NULL DEFAULT '[]',
                    evidence_json     TEXT NOT NULL DEFAULT '[]'
                );

                CREATE TABLE IF NOT EXISTS agent_run_messages (
                    run_id            TEXT NOT NULL REFERENCES agent_runs(run_id) ON DELETE CASCADE,
                    seq               INTEGER NOT NULL,
                    role              TEXT NOT NULL,
                    kind              TEXT NOT NULL,
                    text              TEXT NOT NULL,
                    source_event_id   TEXT,
                    created_at        TEXT NOT NULL,
                    PRIMARY KEY (run_id, seq)
                );
                CREATE INDEX IF NOT EXISTS idx_agent_messages_run
                    ON agent_run_messages(run_id, seq);
                """
            )

    # -- context construction ------------------------------------------------

    def build_context(self, library, variant_id, *, target=None,
                      required_documents=None, user_attachments=None, run_id=None):
        """Assemble an immutable AgentRunContext from the test library.

        ``library`` must already have been prepared (``prepare_library``); the
        variant is located by ``case_variant_id`` only, never by ``code``.
        """
        from test_library_contract import select_variant

        case = select_variant(library, variant_id=variant_id)
        if case is None:
            raise KeyError("unknown case_variant_id")

        variant = case.get("case_variant_id") or variant_id
        testcase = {field: case.get(field) for field in _TESTCASE_FIELDS}
        testcase["sheet"] = case.get("sheet")

        return {
            "schema_version": CONTEXT_SCHEMA_VERSION,
            "run_id": run_id or str(uuid.uuid4()),
            "library_version": library.get("version"),
            "case_variant_id": variant,
            "code": case.get("code"),
            "testcase": testcase,
            "ai_review": case.get("ai_review"),
            "target": target or {},
            "required_documents": list(required_documents or []),
            "user_attachments": list(user_attachments or []),
            "created_at": _now(),
        }

    # -- persistence ---------------------------------------------------------

    def create_run(self, context, *, created_by=None):
        """Persist a new run. The context blob is written once and sealed."""
        run_id = context["run_id"]
        digest = context_hash(context)
        with self._lock, self._connect() as db:
            exists = db.execute(
                "SELECT 1 FROM agent_runs WHERE run_id=?", (run_id,)
            ).fetchone()
            if exists:
                raise ValueError("run_id already exists")
            db.execute(
                "INSERT INTO agent_runs (run_id, case_variant_id, library_version, "
                "context_json, context_hash, created_at, created_by) VALUES (?,?,?,?,?,?,?)",
                (run_id, context["case_variant_id"], context["library_version"],
                 json.dumps(context, ensure_ascii=False), digest,
                 context.get("created_at") or _now(), created_by),
            )
            db.execute(
                "INSERT INTO agent_run_state (run_id, status, updated_at) VALUES (?,?,?)",
                (run_id, STATUS_PENDING, _now()),
            )
        return run_id

    def get_run(self, run_id):
        with self._connect() as db:
            run = db.execute(
                "SELECT * FROM agent_runs WHERE run_id=?", (run_id,)
            ).fetchone()
            if run is None:
                return None
            state = db.execute(
                "SELECT * FROM agent_run_state WHERE run_id=?", (run_id,)
            ).fetchone()
        context = json.loads(run["context_json"])
        result = {
            "run_id": run["run_id"],
            "case_variant_id": run["case_variant_id"],
            "library_version": run["library_version"],
            "context_hash": run["context_hash"],
            "created_at": run["created_at"],
            "created_by": run["created_by"],
            "context": context,
            "status": state["status"] if state else STATUS_PENDING,
            "conversation_ref": state["conversation_ref"] if state else None,
            "final_result": state["final_result"] if state else None,
            "failure_reason": state["failure_reason"] if state else None,
            "approvals": json.loads(state["approvals_json"]) if state else [],
            "commands": json.loads(state["commands_json"]) if state else [],
            "evidence": json.loads(state["evidence_json"]) if state else [],
            "started_at": state["started_at"] if state else None,
            "ended_at": state["ended_at"] if state else None,
            "updated_at": state["updated_at"] if state else None,
        }
        result["messages"] = self.list_messages(run_id)
        return result

    # -- mutable state (advanced by the Gateway) -----------------------------

    def _get_json_col(self, db, run_id, column):
        row = db.execute(
            f"SELECT {column} FROM agent_run_state WHERE run_id=?", (run_id,)
        ).fetchone()
        return json.loads(row[column]) if row and row[column] else []

    def update_state(self, run_id, *, status=None, conversation_ref=None,
                     final_result=None, failure_reason=None,
                     started_at=None, ended_at=None):
        """Patch mutable run state. Only supplied fields change."""
        fields, params = {}, []
        for name, value in (
            ("status", status), ("conversation_ref", conversation_ref),
            ("final_result", final_result), ("failure_reason", failure_reason),
            ("started_at", started_at), ("ended_at", ended_at),
        ):
            if value is not None:
                fields[name] = value
        fields["updated_at"] = _now()
        assignments = ", ".join(f"{k}=?" for k in fields)
        params = list(fields.values()) + [run_id]
        with self._lock, self._connect() as db:
            cur = db.execute(
                f"UPDATE agent_run_state SET {assignments} WHERE run_id=?", params
            )
            if cur.rowcount == 0:
                raise KeyError("unknown run_id")

    def append_commands(self, run_id, commands):
        """Append command records (tool calls) to the run's evidence trail."""
        if not commands:
            return
        with self._lock, self._connect() as db:
            current = self._get_json_col(db, run_id, "commands_json")
            current.extend(commands)
            db.execute(
                "UPDATE agent_run_state SET commands_json=?, updated_at=? WHERE run_id=?",
                (json.dumps(current, ensure_ascii=False), _now(), run_id),
            )

    def append_evidence(self, run_id, evidence):
        if not evidence:
            return
        with self._lock, self._connect() as db:
            current = self._get_json_col(db, run_id, "evidence_json")
            current.extend(evidence)
            db.execute(
                "UPDATE agent_run_state SET evidence_json=?, updated_at=? WHERE run_id=?",
                (json.dumps(current, ensure_ascii=False), _now(), run_id),
            )

    def record_approval(self, run_id, approval):
        """Record an approval request or decision (kind/status/...)."""
        with self._lock, self._connect() as db:
            current = self._get_json_col(db, run_id, "approvals_json")
            current.append(approval)
            db.execute(
                "UPDATE agent_run_state SET approvals_json=?, updated_at=? WHERE run_id=?",
                (json.dumps(current, ensure_ascii=False), _now(), run_id),
            )

    def add_message(self, run_id, *, role, text, kind="message",
                    source_event_id=None):
        """Append a chat message. ``source_event_id`` dedups replays/coalescing."""
        with self._lock, self._connect() as db:
            if source_event_id:
                dup = db.execute(
                    "SELECT 1 FROM agent_run_messages WHERE run_id=? AND source_event_id=?",
                    (run_id, source_event_id),
                ).fetchone()
                if dup:
                    return None
            row = db.execute(
                "SELECT COALESCE(MAX(seq),0)+1 AS n FROM agent_run_messages WHERE run_id=?",
                (run_id,),
            ).fetchone()
            seq = row["n"]
            db.execute(
                "INSERT INTO agent_run_messages (run_id, seq, role, kind, text, "
                "source_event_id, created_at) VALUES (?,?,?,?,?,?,?)",
                (run_id, seq, role, kind, text, source_event_id, _now()),
            )
        return seq

    def update_message_text(self, run_id, seq, text):
        """Update an existing chat message in place (progress line coalescing)."""
        with self._lock, self._connect() as db:
            db.execute(
                "UPDATE agent_run_messages SET text=? WHERE run_id=? AND seq=?",
                (text, run_id, seq),
            )

    def list_messages(self, run_id, limit=500):
        with self._connect() as db:
            rows = db.execute(
                "SELECT seq, role, kind, text, created_at FROM agent_run_messages "
                "WHERE run_id=? ORDER BY seq LIMIT ?", (run_id, int(limit)),
            ).fetchall()
        return [dict(r) for r in rows]

    def list_runs(self, *, case_variant_id=None, status=None, limit=100):
        clauses, params = [], []
        if case_variant_id:
            clauses.append("r.case_variant_id=?")
            params.append(case_variant_id)
        if status:
            clauses.append("s.status=?")
            params.append(status)
        where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
        sql = (
            "SELECT r.run_id, r.case_variant_id, r.library_version, r.created_at, "
            "r.created_by, s.status, s.final_result "
            "FROM agent_runs r JOIN agent_run_state s ON s.run_id=r.run_id "
            f"{where} ORDER BY r.created_at DESC LIMIT ?"
        )
        params.append(int(limit))
        with self._connect() as db:
            rows = db.execute(sql, params).fetchall()
        return [dict(row) for row in rows]

    def verify_context(self, run_id):
        """Return True when the stored context still matches its sealed hash."""
        with self._connect() as db:
            run = db.execute(
                "SELECT context_json, context_hash FROM agent_runs WHERE run_id=?",
                (run_id,),
            ).fetchone()
        if run is None:
            return False
        return context_hash(json.loads(run["context_json"])) == run["context_hash"]
