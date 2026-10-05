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
from .agent_runs import AgentRunStore


class AgentRunCreateReq(BaseModel):
    case_variant_id: str = Field(..., description="Test-library variant identity (not `code`)")
    node_id: str = Field("", description="Installed node identity to run against (optional)")
    expected_binding_revision: str = Field("", description="Bind the run to this revision (optional)")
    required_documents: list = Field(default_factory=list)
    user_attachments: list = Field(default_factory=list)


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

    app.include_router(router)
    return store
