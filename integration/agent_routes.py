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

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from . import targets as targets_module
from .agent_gateway import AgentGateway
from .agent_runs import AgentRunStore


class AgentRunCreateReq(BaseModel):
    case_variant_id: str = Field(..., description="Test-library variant identity (not `code`)")
    node_id: str = Field("", description="Installed node identity to run against (optional)")
    expected_binding_revision: str = Field("", description="Bind the run to this revision (optional)")
    required_documents: list = Field(default_factory=list)
    user_attachments: list = Field(default_factory=list)


class AgentRunStartReq(BaseModel):
    auto_run: bool = Field(True, description="Start the agent immediately after creating the conversation")
    workspace_dir: str = Field("", description="Override the agent workspace directory (optional)")


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
                run_id, workspace_dir=req.workspace_dir or None, auto_run=req.auto_run)
        except KeyError:
            raise HTTPException(404, "unknown run_id")
        except Exception as exc:  # agent-server unreachable / rejected
            store.update_state(run_id, status="ERROR", failure_reason=str(exc))
            raise HTTPException(502, f"agent gateway failed: {exc}")
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

    app.include_router(router)
    return store
