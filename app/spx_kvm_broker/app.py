# -*- coding: utf-8 -*-
"""FastAPI wiring for the SP-X KVM auto-login broker.

Two routers:
  * broker_router   — BMC subdomain `/__spx_launch` (post cookie handoff).
  * portal_router   — Portal backend `/api/kvm/launch` (mint launch_id, RBAC).

The same FastAPI app can be mounted at both; the BMC vhost only exposes the
broker router (nginx location = /__spx_launch), the Portal app exposes the
portal router. For this PoC deployment a single uvicorn process hosts both; the
nginx BMC vhost has a `location = /__spx_launch` proxying to this app, and the
Portal app (main.py) imports the portal router.

Usage:
    uvicorn spx_kvm_broker.app:app  (broker endpoint)
"""
from __future__ import annotations

import json
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

try:  # optional: starlette session middleware for request.session portal binding
    from starlette.middleware.sessions import SessionMiddleware
except Exception:  # pragma: no cover
    SessionMiddleware = None

from .broker import Broker
from .config import BrokerConfig
from .rbac import EnvOperatorPortal, NoAuthPortal, PortalAuth, PortalUser, rbac_allows
from .registry import SessionRegistry
from .secret_store import AgeSecretStore

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("spx_kvm_broker.app")


def build_stores():
    """Construct config/store/registry/broker from env (see docs/deploy)."""
    cfg = BrokerConfig()
    # Override files from env for easy deployment
    for key, attr in (("SPX_SECRET_FILE", "secret_file"),
                      ("SPX_IDENTITY_FILE", "identity_file"),
                      ("SPX_REGISTRY_DB", "registry_db"),
                      ("SPX_AUDIT_LOG", "audit_log")):
        v = os.environ.get(key)
        if v:
            setattr(cfg, attr, Path(v))
    cfg.load_targets_from_env()
    store = AgeSecretStore(secret_file=cfg.secret_file,
                           identity_file=cfg.identity_file)
    registry = SessionRegistry(db_path=cfg.registry_db)
    broker = Broker(config=cfg, store=store, registry=registry)
    return cfg, store, registry, broker


_cfg, _store, _registry, _broker = build_stores()

# Re-exported for Portal backend (main.py) to mount the launch route.
portal_router = None  # set below after app creation


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    try:
        _registry.close()
    except Exception:
        pass


# Session middleware enables request.session (needed for portal_session binding).
# Secret comes from env; override in prod. A random one is generated each boot
# for dev so the broker is still functional out of the box.
import secrets as _secrets
_SESSION_SECRET = os.environ.get("SPX_SESSION_SECRET", _secrets.token_hex(32))

app = FastAPI(title="SP-X KVM Auto-Login Broker", lifespan=lifespan)
if SessionMiddleware is not None:
    app.add_middleware(SessionMiddleware, secret_key=_SESSION_SECRET)


# ---- Portal auth seam (must be replaced by real Portal auth in production) --
def current_user(request: Request) -> PortalUser:
    headers = dict(request.headers)
    cookies = dict(request.cookies)
    query = dict(request.query_params)
    # Default: fail-closed (NoAuthPortal). Wire a real provider here.
    provider_path = os.environ.get("SPX_PORTAL_AUTH")
    user = _resolve_auth(provider_path, headers, cookies, query)
    if user is None:
        raise HTTPException(status_code=401, detail="not authenticated")
    return user


def _resolve_auth(provider_path, headers, cookies, query) -> PortalUser | None:
    if provider_path and provider_path == "operator":
        return EnvOperatorPortal().authenticate(headers, cookies, query)
    if provider_path and provider_path != "noauth":
        # Allow injecting a callable provider if the Portal backend supplies one.
        mod_name, _, fn = provider_path.partition(":")
        try:
            import importlib
            mod = importlib.import_module(mod_name)
            provider = getattr(mod, fn or "get_portal_auth")
            return provider().authenticate(headers, cookies, query)
        except Exception as e:
            log.error("portal auth provider failed: %s", e)
            return None
    return NoAuthPortal().authenticate(headers, cookies, query)


# ---- Pydantic contract -----------------------------------------------------
class LaunchBody(BaseModel):
    server_id: str


# ---- Portal routes ---------------------------------------------------------
@app.post("/api/kvm/launch")
async def api_kvm_launch(body: LaunchBody, request: Request):
    """Portal-authenticated launch mint. RBAC-gated, allowlist-validated."""
    user = current_user(request)  # 401 if unauthenticated
    if not rbac_allows(user, body.server_id):
        raise HTTPException(status_code=403, detail="forbidden: insufficient role")
    portal_session_id = ""
    try:
        portal_session_id = str(request.session.get("sid", ""))
    except Exception:
        portal_session_id = ""  # session middleware absent: no portal session binding
    result = _broker.mint_launch(
        portal_user_id=user.user_id,
        portal_session_id=portal_session_id,
        server_id=body.server_id,
        request=request,
    )
    return {"ok": True, **result}


# ---- BMC subdomain routes --------------------------------------------------
@app.post("/__spx_launch")
async def bmc_spx_launch(request: Request):
    """BMC subdomain: consume launch_id, hand off authenticated host-only
    cookies, redirect to BMC subdomain root."""
    return await _broker.handle_launch(request)


@app.get("/__spx_health")
async def health():
    return {"ok": True, "event": "broker-health"}
