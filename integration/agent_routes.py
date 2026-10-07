"""PA Agent run endpoints (P3-b).

Mounted from ``integration/web.py`` via :func:`install`. These endpoints create
and read formal AgentRun records. They never talk to OpenHands — the Gateway that
consumes a run is P3-c, and policy enforcement is P3-d.

Design rules (from docs/P3-PA-AGENT-DESIGN.md):

* A run is identified by ``case_variant_id``; ``code`` is never the identity.
* ``POST /api/agent/runs`` builds the **immutable** AgentRunContext and creates a
  run. The context is a snapshot: it is written once and can be hash-verified.
* The frontend never receives the raw test-library JSON; it receives only the
  fields the run needs, through the run endpoints.
"""
from __future__ import annotations

import os
import threading
import time
import uuid

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from . import targets as targets_module
from .agent_gateway import AgentGateway, classify_user_intent
from .agent_runs import (
    AgentRunStore, STATUS_DONE, STATUS_PASS, STATUS_FAIL, STATUS_BLOCKED,
    STATUS_ERROR, STATUS_WAITING_FOR_USER,
)

# Terminal run statuses: once a run is in one of these, its OpenHands conversation
# has finished producing new events and the background sync can stop. PASS/FAIL/
# BLOCKED are retired but kept here so any pre-existing run still settles.
_TERMINAL_STATUSES = {
    STATUS_DONE, STATUS_ERROR, STATUS_PASS, STATUS_FAIL, STATUS_BLOCKED,
}
_SYNC_INTERVAL = float(os.environ.get("PA_AGENT_SYNC_INTERVAL", "2.0"))
# Execution sync budget: a long test case (e.g. a 10-minute FIO run) must keep
# syncing until it is truly terminal. At 2s/iter, 3600 iters ~= 2 hours.
_SYNC_MAX_ITERS = int(os.environ.get("PA_AGENT_SYNC_MAX_ITERS", "3600"))
# An execution is considered idle (and thus safe to stop syncing) after this many
# consecutive ticks with no status change *and* the run already left RUNNING.
_SYNC_IDLE_STOP = int(os.environ.get("PA_AGENT_SYNC_IDLE_STOP", "3"))


def _spawn_sync(store, gateway, run_id):
    threading.Thread(
        target=_sync_run_loop, args=(store, gateway, run_id),
        name=f"pa-agent-sync-{run_id}", daemon=True,
    ).start()


def _sync_run_loop(store, gateway, run_id):
    """Background sync: fold the run's OpenHands events into run state.

    Execution-aware (P0-6): the loop keeps ingesting while the run is RUNNING and
    only stops when the run reaches a terminal status (DONE/ERROR) or
    WAITING_FOR_USER — NOT on the first agent message. This is what makes a long
    test case (agent talks, then works for 10 minutes) reliably deliver its final
    result instead of stopping after the opening line.

    The loop is idempotent and safe to run alongside the post-message sync: ingest
    dedups by source event id. It also survives agent-server blips by skipping a
    tick rather than aborting, so a transient failure does not strand the run.
    """
    idle = 0
    last_status = None
    for _ in range(_SYNC_MAX_ITERS):
        try:
            summary = gateway.ingest(run_id)
        except Exception:  # agent-server blip — skip this tick, keep trying
            time.sleep(_SYNC_INTERVAL)
            continue
        run = store.get_run(run_id)
        if run is None:
            return
        status = run.get("status")
        if status in _TERMINAL_STATUSES or status == STATUS_WAITING_FOR_USER:
            return
        # If the agent went quiet while still RUNNING, stop after a few ticks so
        # a stuck run does not pin a thread forever. A status change resets it.
        if status == last_status:
            idle += 1
            if idle >= _SYNC_IDLE_STOP:
                return
        else:
            idle = 0
            last_status = status
        time.sleep(_SYNC_INTERVAL)


def _sync_messages_loop(store, gateway, run_id, *, min_seq=0, max_iters=None):
    """Ingest after an engineer chat turn until the agent's turn is delivered.

    Unlike the old version, this does NOT stop at the first agent message: a long
    execution emits an opening line and then keeps working. It stops when the run
    reaches a terminal / WAITING_FOR_USER status, or when a new agent message has
    arrived AND the run has settled (no longer RUNNING), or after the iteration
    budget.
    """
    budget = max_iters if max_iters is not None else _SYNC_MAX_ITERS
    seen_agent_reply = False
    for _ in range(budget):
        try:
            gateway.ingest(run_id)
        except Exception:  # agent-server blip — keep trying for the bounded window
            time.sleep(_SYNC_INTERVAL)
            continue
        run = store.get_run(run_id)
        if run is None:
            return
        status = run.get("status")
        messages = store.list_messages(run_id)
        if any(m.get("seq", 0) > min_seq and m.get("role") == "agent" for m in messages):
            seen_agent_reply = True
        if status in _TERMINAL_STATUSES or status == STATUS_WAITING_FOR_USER:
            return
        # A delivered reply while no longer RUNNING means the turn is complete
        # (e.g. a question answered without an agent loop). Do not idle forever.
        if seen_agent_reply and status != "RUNNING":
            return
        time.sleep(_SYNC_INTERVAL)


def _cleanup_expired_attachments(run_id):
    """Remove a run's on-disk attachment directory (best effort)."""
    import shutil
    for base in (_attachments_root(),):
        path = os.path.join(base, run_id)
        if os.path.isdir(path):
            shutil.rmtree(path, ignore_errors=True)


def _attachments_root():
    return os.environ.get("PA_AGENT_ATTACHMENTS_DIR", "/srv/pa-agent/attachments")


def _run_retention_purge(store):
    """Delete runs older than the retention window and their attachment blobs.

    Runs still in flight (RUNNING / WAITING_FOR_USER / PENDING) are never
    eligible, so a long test cannot be pruned mid-run. Attachment files are
    removed from disk too, so closing/finishing a test actually frees space.
    """
    for run_id in store.list_expired_runs():
        _cleanup_expired_attachments(run_id)
        store.delete_run(run_id)


class AgentRunCreateReq(BaseModel):
    case_variant_id: str = Field(..., description="Test-library variant identity (not `code`)")
    node_id: str = Field("", description="Installed node identity to run against (optional)")
    expected_binding_revision: str = Field("", description="Bind the run to this revision (optional)")
    required_documents: list = Field(default_factory=list)
    user_attachments: list = Field(default_factory=list)


class AgentRunStartReq(BaseModel):
    auto_run: bool = Field(True, description="Start the agent immediately after creating the conversation")
    workspace_dir: str = Field("", description="Override the agent workspace directory (optional)")
    user_note: str = Field("", description="Free-text instruction from the user, appended to the agent brief")
    mode: str = Field("execute", description="'plan' presents the plan and waits for GO; 'execute' runs as before")


class AgentRunMessageReq(BaseModel):
    text: str = Field(..., description="Engineer chat turn to append to the run's conversation")


class AgentRunIngestReq(BaseModel):
    events: list = Field(default_factory=list, description="Raw OpenHands events to fold in (optional live poll)")


def _target_snapshot(pa, node_id, expected_revision):
    if not node_id:
        return {}
    try:
        target = targets_module.resolve_target(pa, node_id)
    except KeyError:
        raise HTTPException(404, f"unknown node_id: {node_id}")
    if expected_revision and target.get("revision") != expected_revision:
        raise HTTPException(409, "Target binding changed; review the current node before dispatch")
    return {
        "node_id": target.get("name"),
        "project": target.get("project"),
        "system": target.get("parent_name") or target.get("name"),
        "os_slot": target.get("slot"),
        "binding_revision": target.get("revision"),
        "chassis_id": target.get("chassis_id"),
        # Connection details the agent needs to reach the DUT. Pulled from the
        # machines DATA JSON via targets.inventory(); without these the agent has
        # no target to SSH to and will fabricate results.
        "os_ip": target.get("os_ip") or "",
        "os_user": target.get("os_user") or "",
        "os_port": target.get("os_port") or 22,
        "os_password": target.get("os_password") or "",
        "bmc_ip": target.get("bmc_ip") or "",
        "bmc_user": target.get("bmc_user") or "",
        "bmc_password": target.get("bmc_password") or "",
    }


def install(app, pa, store_getter=None):
    router = APIRouter()
    store = AgentRunStore()
    gateway = AgentGateway(store)

    def _library():
        library = pa._load_testlib()
        if library is None:
            raise HTTPException(404, "Test library not available (missing tests.json)")
        return library

    @router.post("/api/agent/runs")
    def create_run(req: AgentRunCreateReq, request: Request):
        library = _library()
        target = _target_snapshot(pa, req.node_id, req.expected_binding_revision)
        actor = getattr(request.state, "actor", None)
        if isinstance(actor, dict):
            created_by = actor.get("subject") or actor.get("name")
        else:
            created_by = actor if isinstance(actor, str) else None
        try:
            context = store.build_context(
                library, req.case_variant_id, target=target,
                required_documents=req.required_documents,
                user_attachments=req.user_attachments,
            )
        except KeyError:
            raise HTTPException(404, f"unknown case_variant_id: {req.case_variant_id}")
        try:
            run_id = store.create_run(context, created_by=created_by)
        except ValueError:
            raise HTTPException(409, "run_id already exists")
        return {"ok": True, "run": store.get_run(run_id)}

    @router.get("/api/agent/runs")
    def list_runs(case_variant_id: str = "", status: str = "", limit: int = 100):
        rows = store.list_runs(
            case_variant_id=case_variant_id or None,
            status=status or None,
            limit=min(max(limit, 1), 500),
        )
        return {"ok": True, "runs": rows}

    @router.get("/api/agent/runs/{run_id}")
    def get_run(run_id: str):
        run = store.get_run(run_id)
        if run is None:
            raise HTTPException(404, "unknown run_id")
        run["context_verified"] = store.verify_context(run_id)
        return {"ok": True, "run": run}

    @router.get("/api/agent/runs/{run_id}/context")
    def get_context(run_id: str):
        run = store.get_run(run_id)
        if run is None:
            raise HTTPException(404, "unknown run_id")
        return {"ok": True, "context": run["context"],
                "context_verified": store.verify_context(run_id)}

    @router.post("/api/agent/runs/{run_id}/start")
    def start_run(run_id: str, req: AgentRunStartReq):
        if store.get_run(run_id) is None:
            raise HTTPException(404, "unknown run_id")
        try:
            conversation_id = gateway.start_run(
                run_id, workspace_dir=req.workspace_dir or None, auto_run=req.auto_run,
                user_note=req.user_note or "", mode=req.mode or "execute")
        except KeyError:
            raise HTTPException(404, "unknown run_id")
        except Exception as exc:  # agent-server unreachable / rejected
            store.update_state(run_id, status="ERROR", failure_reason=str(exc))
            raise HTTPException(502, f"agent gateway failed: {exc}")
        # Kick off the background event sync so the Chat Drawer's /messages poll
        # actually receives the run's output. Without this, agent_run_messages
        # stays empty (only a manual POST /ingest would fill it) and the drawer
        # shows "執行中…" with a blank body.
        if req.auto_run:
            _spawn_sync(store, gateway, run_id)
        return {"ok": True, "run_id": run_id, "conversation_ref": conversation_id,
                "run": store.get_run(run_id)}

    @router.post("/api/agent/runs/{run_id}/ingest")
    def ingest_events(run_id: str, req: AgentRunIngestReq):
        if store.get_run(run_id) is None:
            raise HTTPException(404, "unknown run_id")
        try:
            summary = gateway.ingest(run_id, events=req.events or None)
        except ValueError as exc:
            raise HTTPException(409, str(exc))
        except Exception as exc:
            raise HTTPException(502, f"agent gateway failed: {exc}")
        return {"ok": True, "summary": summary, "run": store.get_run(run_id)}

    @router.get("/api/agent/runs/{run_id}/messages")
    def get_messages(run_id: str, limit: int = 500):
        if store.get_run(run_id) is None:
            raise HTTPException(404, "unknown run_id")
        return {"ok": True, "messages": store.list_messages(run_id, limit=limit)}

    @router.get("/api/agent/active")
    def active_run(case_variant_id: str = "", node_id: str = ""):
        """Find the in-flight run for a Test Case so a reopen can resume it.

        Close ≠ cancel (P1-5): the drawer may reopen a Test Case and must land on
        the SAME AgentRun (with its conversation, status, evidence) rather than
        silently creating a new one. Only non-terminal runs are returned.
        """
        if not case_variant_id:
            raise HTTPException(422, "case_variant_id is required")
        runs = store.list_runs(case_variant_id=case_variant_id, limit=50)
        live = [r for r in runs
                if r.get("status") not in _TERMINAL_STATUSES]
        if node_id:
            live = [r for r in live
                    if (store.get_run(r["run_id"]) or {}).get("context", {})
                    .get("target", {}).get("node_id") == node_id] or live
        if not live:
            return {"ok": True, "run": None}
        return {"ok": True, "run": store.get_run(live[0]["run_id"])}

    @router.post("/api/agent/runs/{run_id}/messages")
    def post_message(run_id: str, req: AgentRunMessageReq):
        """Append an engineer chat turn and route it by *state-aware* intent.

        Intents travel different paths (see ``classify_user_intent``):

        * ``go`` — only valid while WAITING_FOR_USER; starts a fresh execution
          turn built from the LATEST confirmed plan revision (P0-2). A GO while
          already RUNNING does not start a second execution (P0-4).
        * ``rerun`` — an explicit re-run request; starts an execution turn.
        * ``cancel`` — marks the run cancelled (STOP/CANCEL).
        * ``question`` — recorded as supplemental context AND answered via
          ``ask_agent`` (single LLM call, no tool loop). Non-approval turns never
          trigger execution.

        The turn is always recorded locally first, so the chat renders it even
        before any agent output. A gateway failure is surfaced as 502.
        """
        run = store.get_run(run_id)
        if run is None:
            raise HTTPException(404, "unknown run_id")
        text = (req.text or "").strip()
        if not text:
            raise HTTPException(422, "text is required")
        if not run.get("conversation_ref"):
            raise HTTPException(409, "run has no conversation; start it first")
        intent = classify_user_intent(text)
        status = run.get("status") or "PENDING"

        # State-aware gating (P0-4). Only WAITING_FOR_USER accepts a go; a GO
        # arriving while RUNNING must not launch a second execution.
        if intent == "go" and status == "RUNNING":
            store.add_message(run_id, role="user", text=text)
            return {"ok": True, "run_id": run_id, "intent": "ignored_running",
                    "messages": store.list_messages(run_id)}

        before = store.list_messages(run_id)
        min_seq = max([m.get("seq", 0) for m in before] or [0])
        store.add_message(run_id, role="user", text=text)

        if intent == "cancel":
            store.record_approval(run_id, {"kind": "cancel", "status": "approved",
                                           "text": text, "created_at": None})
            store.update_state(run_id, status="ERROR", failure_reason="Cancelled by engineer")
            return {"ok": True, "run_id": run_id, "intent": intent,
                    "messages": store.list_messages(run_id)}

        if intent in ("go", "rerun"):
            # P0-2: execute the latest confirmed plan revision, not the original.
            try:
                gateway.run_execution(run_id, trigger=intent)
            except Exception as exc:  # agent-server unreachable / rejected
                raise HTTPException(502, f"agent gateway failed: {exc}")
            threading.Thread(
                target=_sync_messages_loop, args=(store, gateway, run_id),
                kwargs={"min_seq": min_seq}, name=f"pa-agent-msg-{run_id}", daemon=True,
            ).start()
        else:
            # Non-approval turn: record it as supplemental context (so a
            # constraint stated mid-discussion is not lost) and answer it without
            # an agent loop.
            _record_supplemental(store, run_id, run, text)
            try:
                answer = gateway.ask_agent(run_id, text)
            except Exception as exc:  # agent-server unreachable / rejected
                raise HTTPException(502, f"agent gateway failed: {exc}")
            if answer:
                store.add_message(run_id, role="agent", text=answer)

        return {"ok": True, "run_id": run_id, "intent": intent,
                "messages": store.list_messages(run_id)}

    @router.post("/api/agent/runs/{run_id}/supplemental")
    def add_supplemental(run_id: str, req: AgentRunMessageReq):
        """Record an engineer addition as a new plan revision (cumulative)."""
        run = store.get_run(run_id)
        if run is None:
            raise HTTPException(404, "unknown run_id")
        text = (req.text or "").strip()
        if not text:
            raise HTTPException(422, "text is required")
        revision = _record_supplemental(store, run_id, run, text)
        return {"ok": True, "run_id": run_id, "revision": revision,
                "supplemental": store.latest_supplemental(run_id)}

    @router.post("/api/agent/runs/{run_id}/attachments")
    async def upload_attachment(run_id: str, name: str, request: Request,
                                kind: str = "file", mime: str = ""):
        """Store an attachment for the run and index its metadata (P1-1).

        The blob is written under the attachments root (default
        /srv/pa-agent/attachments/<run_id>/). Text-like files get their content
        extracted so the agent can actually read them; images are stored but
        flagged vision_supported=False (the current model cannot parse them), so
        the UI can say so honestly instead of pretending the image was understood.
        """
        run = store.get_run(run_id)
        if run is None:
            raise HTTPException(404, "unknown run_id")
        data = await request.body()
        if not data:
            raise HTTPException(422, "empty attachment")
        max_bytes = int(os.environ.get("PA_AGENT_MAX_ATTACHMENT_BYTES", str(20 * 1024 * 1024)))
        if len(data) > max_bytes:
            raise HTTPException(413, f"attachment exceeds {max_bytes} bytes")
        folder = os.path.join(_attachments_root(), run_id)
        os.makedirs(folder, exist_ok=True)
        safe_name = os.path.basename(name or "attachment")
        attachment_id = f"{int(time.time() * 1000)}-{uuid.uuid4().hex[:8]}"
        stored_path = os.path.join(folder, f"{attachment_id}__{safe_name}")
        with open(stored_path, "wb") as fh:
            fh.write(data)
        extracted, status, error = _extract_attachment(safe_name, mime, data, kind)
        store.add_attachment(
            run_id, attachment_id=attachment_id, name=safe_name, mime=mime,
            size=len(data), kind=kind, stored_path=stored_path,
            extracted_text=extracted, vision_supported=(kind == "image" and _VISION_ENABLED),
            status=status, error=error,
        )
        return {"ok": True, "run_id": run_id,
                "attachment": store.get_attachment(run_id, attachment_id)}

    @router.get("/api/agent/runs/{run_id}/attachments")
    def list_attachments(run_id: str):
        if store.get_run(run_id) is None:
            raise HTTPException(404, "unknown run_id")
        return {"ok": True, "attachments": store.list_attachments(run_id)}

    @router.delete("/api/agent/runs/{run_id}/attachments/{attachment_id}")
    def delete_attachment(run_id: str, attachment_id: str):
        meta = store.get_attachment(run_id, attachment_id)
        if meta is None:
            raise HTTPException(404, "unknown attachment")
        if meta.get("stored_path") and os.path.exists(meta["stored_path"]):
            try:
                os.remove(meta["stored_path"])
            except OSError:
                pass
        store.delete_attachment(run_id, attachment_id)
        return {"ok": True, "run_id": run_id, "attachment_id": attachment_id}

    @router.post("/api/agent/maintenance/purge")
    def purge_expired():
        """Delete runs past the retention window and free their attachment blobs.

        Retention defaults to PA_AGENT_RETENTION_DAYS (7). Runs still in flight
        are never purged (see AgentRunStore.list_expired_runs).
        """
        before = len(store.list_runs(limit=500))
        _run_retention_purge(store)
        after = len(store.list_runs(limit=500))
        return {"ok": True, "purged": before - after}

    app.include_router(router)
    return store


# Text-like attachments whose content can be handed to the agent verbatim.
_TEXT_MIMES = {
    "text/plain", "text/markdown", "text/csv", "text/log", "application/json",
    "application/x-ndjson", "application/csv",
}
_TEXT_EXTS = {".txt", ".log", ".md", ".json", ".csv"}
_IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp"}
# The current PA model (qwen3.8-27b) has no vision; set True only when a
# vision-capable profile is wired so the UI can stop showing the caveat.
_VISION_ENABLED = os.environ.get("PA_AGENT_VISION_ENABLED", "").lower() in {"1", "true", "yes"}


def _extract_attachment(name, mime, data, kind):
    """Return ``(extracted_text, status, error)`` for an uploaded attachment.

    Text-like files are decoded (utf-8 with replacement) so the agent can read
    them. PDFs are attempted via ``pdftotext`` when available. Images and other
    binaries are stored but not parsed — status stays ``ready`` for images with
    an empty extraction, so the UI can honestly render "uploaded, not parsed".
    """
    import shutil
    import subprocess
    ext = os.path.splitext(name or "")[1].lower()
    if kind == "image" or ext in _IMAGE_EXTS or (mime or "").startswith("image/"):
        return "", "ready", ""
    is_text = ext in _TEXT_EXTS or (mime or "") in _TEXT_MIMES or (mime or "").startswith("text/")
    if is_text:
        try:
            return data.decode("utf-8", "replace"), "ready", ""
        except Exception as exc:  # pragma: no cover - decode is total
            return "", "error", str(exc)
    if ext == ".pdf":
        tool = shutil.which("pdftotext")
        if not tool:
            return "", "unparsed", "pdftotext not available"
        try:
            proc = subprocess.run([tool, "-", "-"], input=data,
                                  capture_output=True, timeout=30)
            if proc.returncode == 0:
                return proc.stdout.decode("utf-8", "replace"), "ready", ""
            return "", "unparsed", proc.stderr.decode("utf-8", "replace")[:500]
        except Exception as exc:
            return "", "unparsed", str(exc)
    return "", "unparsed", "unsupported file type"


def _record_supplemental(store, run_id, run, text):
    """Append ``text`` to the run's cumulative supplemental context (P0-2).

    The stored revision is the accumulated text, so executing it never drops an
    earlier constraint. Returns the new revision number.
    """
    prior = store.latest_supplemental(run_id)
    accumulated = (prior or {}).get("text", "")
    if accumulated:
        accumulated = accumulated.rstrip() + "\n" + text
    else:
        accumulated = text
    attachments = [a["attachment_id"] for a in store.list_attachments(run_id)]
    return store.add_supplemental(run_id, accumulated, attachments=attachments)
