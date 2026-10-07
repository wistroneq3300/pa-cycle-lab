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
#
# DONE means the agent stopped and produced its log — NOT that the test passed.
# The verdict (PASS/FAIL/BLOCKED) belongs to the engineer, who reads the log and
# decides outside this system, so those three are retired from the state machine
# (kept for reference, no longer produced by the gateway).
STATUS_PENDING = "PENDING"
STATUS_RUNNING = "RUNNING"
STATUS_WAITING_FOR_USER = "WAITING_FOR_USER"
STATUS_DONE = "DONE"
STATUS_ERROR = "ERROR"
# Retired: no longer assigned by the gateway (see AgentGateway._STATUS_MAP).
STATUS_PASS = "PASS"
STATUS_FAIL = "FAIL"
STATUS_BLOCKED = "BLOCKED"

# Slots the context snapshot packs from a reviewed row. The full ``ai_review``
# object is kept verbatim alongside these so nothing is lost or invented.
_TESTCASE_FIELDS = (
    "code", "sub_function", "test_set", "items", "procedure", "criteria",
    "risk", "ai_can_execute", "ai_commands", "ai_packages_needed",
    "ai_logs_output", "ai_precheck", "ai_postcheck", "ai_agent_instruction",
    # The reviewed automation classification (FULLY AUTOMATABLE / REQUIRES
    # PACKAGE / USER CONFIRMATION / MANUAL ONLY / BLOCKED). The gateway gates
    # policy on this, and it exists ONLY under ai_review — library rows have no
    # category/manual_only/mode fields — so it must be copied into the snapshot.
    "ai_automation_classification",
)

# Supplemental-context budget: each plan revision is a new immutable snapshot of
# the engineer's cumulative additions for this run. Bounded so a long discussion
# cannot grow the table without limit.
MAX_PLAN_REVISIONS = 50


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

                -- Supplemental context: engineer-supplied additions during the run
                -- (free text, SOP/SPEC references, limits, attachments). Each
                -- revision is an immutable, monotonically numbered snapshot of the
                -- *cumulative* additions. GO executes the latest revision, so a
                -- mid-discussion change cannot be silently lost by ask_agent turns.
                CREATE TABLE IF NOT EXISTS agent_run_supplemental (
                    run_id            TEXT NOT NULL REFERENCES agent_runs(run_id) ON DELETE CASCADE,
                    revision          INTEGER NOT NULL,
                    text              TEXT NOT NULL,
                    attachments_json  TEXT NOT NULL DEFAULT '[]',
                    created_at        TEXT NOT NULL,
                    PRIMARY KEY (run_id, revision)
                );

                -- Ingest dedup: one row per (run, source event id) for command and
                -- evidence entries. Appending is INSERT-OR-IGNORE against this
                -- table, so replaying the same OpenHands event never duplicates.
                CREATE TABLE IF NOT EXISTS agent_run_ingested_events (
                    run_id            TEXT NOT NULL REFERENCES agent_runs(run_id) ON DELETE CASCADE,
                    source_event_id   TEXT NOT NULL,
                    channel           TEXT NOT NULL,
                    created_at        TEXT NOT NULL,
                    PRIMARY KEY (run_id, source_event_id)
                );

                -- Attachments uploaded by the engineer during a run. The blob
                -- lives on disk under /srv/pa-agent/attachments/<run_id>/; this
                -- table is the metadata index (name, size, kind, extracted text).
                CREATE TABLE IF NOT EXISTS agent_run_attachments (
                    run_id            TEXT NOT NULL REFERENCES agent_runs(run_id) ON DELETE CASCADE,
                    attachment_id     TEXT NOT NULL,
                    name              TEXT NOT NULL,
                    mime              TEXT,
                    size              INTEGER NOT NULL DEFAULT 0,
                    kind              TEXT NOT NULL DEFAULT 'file',
                    stored_path       TEXT,
                    extracted_text    TEXT,
                    vision_supported  INTEGER NOT NULL DEFAULT 0,
                    status            TEXT NOT NULL DEFAULT 'ready',
                    error             TEXT,
                    created_at        TEXT NOT NULL,
                    PRIMARY KEY (run_id, attachment_id)
                );
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
        # The classification lives only under ai_review; lift it so the gateway
        # (which must not re-parse library internals) can gate policy on it.
        review = case.get("ai_review") if isinstance(case.get("ai_review"), dict) else {}
        if not testcase.get("ai_automation_classification"):
            testcase["ai_automation_classification"] = review.get("automation_classification")

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
        latest = self.latest_supplemental(run_id)
        result["supplemental"] = latest or {"revision": 0, "text": "", "attachments": []}
        result["plan_revision"] = (latest or {}).get("revision", 0)
        result["attachments"] = self.list_attachments(run_id)
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

    def _dedup_new(self, db, run_id, channel, items):
        """Filter ``items`` to those whose ``event_id`` has not been ingested yet.

        Dedup identity is the OpenHands source event id, recorded in
        ``agent_run_ingested_events``. Replaying the same event batch (poll
        overlap, reconnect, manual re-ingest) therefore never appends a second
        copy. Items without an ``event_id`` are always kept (they carry no
        identity to dedup on).
        """
        fresh = []
        for item in items:
            event_id = item.get("event_id") if isinstance(item, dict) else None
            if not event_id:
                fresh.append(item)
                continue
            cur = db.execute(
                "INSERT OR IGNORE INTO agent_run_ingested_events "
                "(run_id, source_event_id, channel, created_at) VALUES (?,?,?,?)",
                (run_id, str(event_id), channel, _now()),
            )
            if cur.rowcount:
                fresh.append(item)
        return fresh

    def append_commands(self, run_id, commands):
        """Append command records (tool calls), deduped by source event id."""
        if not commands:
            return 0
        with self._lock, self._connect() as db:
            fresh = self._dedup_new(db, run_id, "command", commands)
            if not fresh:
                return 0
            current = self._get_json_col(db, run_id, "commands_json")
            current.extend(fresh)
            db.execute(
                "UPDATE agent_run_state SET commands_json=?, updated_at=? WHERE run_id=?",
                (json.dumps(current, ensure_ascii=False), _now(), run_id),
            )
        return len(fresh)

    def append_evidence(self, run_id, evidence):
        """Append evidence records, deduped by source event id."""
        if not evidence:
            return 0
        with self._lock, self._connect() as db:
            fresh = self._dedup_new(db, run_id, "evidence", evidence)
            if not fresh:
                return 0
            current = self._get_json_col(db, run_id, "evidence_json")
            current.extend(fresh)
            db.execute(
                "UPDATE agent_run_state SET evidence_json=?, updated_at=? WHERE run_id=?",
                (json.dumps(current, ensure_ascii=False), _now(), run_id),
            )
        return len(fresh)

    # -- supplemental context (engineer additions during the run) ------------

    def add_supplemental(self, run_id, text, attachments=None):
        """Record a new plan revision carrying the cumulative additions.

        Returns the new revision number. ``text`` is the full accumulated
        supplemental text (not just the delta) so the latest revision is always
        self-contained: executing the latest revision can never drop an earlier
        constraint the engineer stated.
        """
        with self._lock, self._connect() as db:
            row = db.execute(
                "SELECT COALESCE(MAX(revision),0)+1 AS n FROM agent_run_supplemental "
                "WHERE run_id=?", (run_id,),
            ).fetchone()
            revision = row["n"]
            db.execute(
                "INSERT INTO agent_run_supplemental (run_id, revision, text, "
                "attachments_json, created_at) VALUES (?,?,?,?,?)",
                (run_id, revision, text,
                 json.dumps(list(attachments or []), ensure_ascii=False), _now()),
            )
            if revision > MAX_PLAN_REVISIONS:
                db.execute(
                    "DELETE FROM agent_run_supplemental WHERE run_id=? AND revision<=?",
                    (run_id, revision - MAX_PLAN_REVISIONS),
                )
        return revision

    def latest_supplemental(self, run_id):
        """Return the newest plan revision dict, or None when none exists."""
        with self._connect() as db:
            row = db.execute(
                "SELECT revision, text, attachments_json, created_at "
                "FROM agent_run_supplemental WHERE run_id=? "
                "ORDER BY revision DESC LIMIT 1", (run_id,),
            ).fetchone()
        if row is None:
            return None
        return {
            "revision": row["revision"],
            "text": row["text"],
            "attachments": json.loads(row["attachments_json"] or "[]"),
            "created_at": row["created_at"],
        }

    def list_supplemental(self, run_id):
        with self._connect() as db:
            rows = db.execute(
                "SELECT revision, text, attachments_json, created_at "
                "FROM agent_run_supplemental WHERE run_id=? ORDER BY revision",
                (run_id,),
            ).fetchall()
        return [{"revision": r["revision"], "text": r["text"],
                 "attachments": json.loads(r["attachments_json"] or "[]"),
                 "created_at": r["created_at"]} for r in rows]

    # -- attachments ---------------------------------------------------------

    def add_attachment(self, run_id, *, attachment_id, name, mime="", size=0,
                       kind="file", stored_path="", extracted_text="",
                       vision_supported=False, status="ready", error=""):
        with self._lock, self._connect() as db:
            db.execute(
                "INSERT OR REPLACE INTO agent_run_attachments (run_id, attachment_id, "
                "name, mime, size, kind, stored_path, extracted_text, vision_supported, "
                "status, error, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                (run_id, attachment_id, name, mime, int(size or 0), kind,
                 stored_path, extracted_text, 1 if vision_supported else 0,
                 status, error, _now()),
            )
        return attachment_id

    def list_attachments(self, run_id):
        with self._connect() as db:
            rows = db.execute(
                "SELECT attachment_id, name, mime, size, kind, stored_path, "
                "extracted_text, vision_supported, status, error, created_at "
                "FROM agent_run_attachments WHERE run_id=? ORDER BY created_at",
                (run_id,),
            ).fetchall()
        return [{"attachment_id": r["attachment_id"], "name": r["name"],
                 "mime": r["mime"], "size": r["size"], "kind": r["kind"],
                 "stored_path": r["stored_path"],
                 "vision_supported": bool(r["vision_supported"]),
                 "status": r["status"], "error": r["error"],
                 "created_at": r["created_at"]} for r in rows]

    def get_attachment(self, run_id, attachment_id):
        for a in self.list_attachments(run_id):
            if a["attachment_id"] == attachment_id:
                record = dict(a)
                with self._connect() as db:
                    row = db.execute(
                        "SELECT extracted_text FROM agent_run_attachments "
                        "WHERE run_id=? AND attachment_id=?",
                        (run_id, attachment_id),
                    ).fetchone()
                record["extracted_text"] = row["extracted_text"] if row else ""
                return record
        return None

    def delete_attachment(self, run_id, attachment_id):
        with self._lock, self._connect() as db:
            cur = db.execute(
                "DELETE FROM agent_run_attachments WHERE run_id=? AND attachment_id=?",
                (run_id, attachment_id),
            )
        return cur.rowcount > 0

    # -- retention -----------------------------------------------------------

    def delete_run(self, run_id):
        """Delete a run and all its child rows (context, state, messages, …)."""
        with self._lock, self._connect() as db:
            db.execute("DELETE FROM agent_run_messages WHERE run_id=?", (run_id,))
            db.execute("DELETE FROM agent_run_supplemental WHERE run_id=?", (run_id,))
            db.execute("DELETE FROM agent_run_ingested_events WHERE run_id=?", (run_id,))
            db.execute("DELETE FROM agent_run_attachments WHERE run_id=?", (run_id,))
            db.execute("DELETE FROM agent_run_state WHERE run_id=?", (run_id,))
            cur = db.execute("DELETE FROM agent_runs WHERE run_id=?", (run_id,))
        return cur.rowcount > 0

    def list_expired_runs(self, *, retention_days=None, now=None):
        """Run ids whose last activity is older than the retention window.

        Only runs that are no longer in flight are eligible: a RUNNING /
        WAITING_FOR_USER run must never be pruned while a test could still be
        in progress. Retention defaults to PA_AGENT_RETENTION_DAYS (7).
        """
        if retention_days is None:
            try:
                retention_days = int(os.environ.get("PA_AGENT_RETENTION_DAYS", "7"))
            except ValueError:
                retention_days = 7
        if now is None:
            now = datetime.datetime.now(datetime.timezone.utc)
        cutoff = (now - datetime.timedelta(days=retention_days)).replace(
            microsecond=0).isoformat()
        with self._connect() as db:
            rows = db.execute(
                "SELECT r.run_id FROM agent_runs r JOIN agent_run_state s "
                "ON s.run_id=r.run_id WHERE s.updated_at < ? "
                "AND s.status NOT IN ('RUNNING','WAITING_FOR_USER','PENDING')",
                (cutoff,),
            ).fetchall()
        return [row["run_id"] for row in rows]

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

    def claim_pending_user_message(self, run_id, text, source_event_id):
        """Adopt a locally-echoed user message when its server event arrives.

        The route records the engineer's turn immediately (``source_event_id``
        NULL) so the bubble renders before the agent replies. The same turn then
        comes back as a user ``MessageEvent`` during ingest. Without this, that
        event would be inserted as a SECOND copy of the same text. Matching the
        most recent unclaimed user row by text and stamping it with the event id
        keeps the dedupe idempotent *and* preserves the original ordering.

        Returns the adopted row's seq, or None when there is nothing to adopt
        (so the caller inserts a fresh row, e.g. turns typed outside this UI).
        """
        with self._lock, self._connect() as db:
            row = db.execute(
                "SELECT seq FROM agent_run_messages WHERE run_id=? AND role='user' "
                "AND source_event_id IS NULL AND text=? ORDER BY seq DESC LIMIT 1",
                (run_id, text),
            ).fetchone()
            if row is None:
                return None
            db.execute(
                "UPDATE agent_run_messages SET source_event_id=? "
                "WHERE run_id=? AND seq=?",
                (source_event_id, run_id, row["seq"]),
            )
            return row["seq"]

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
