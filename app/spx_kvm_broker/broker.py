# -*- coding: utf-8 -*-
"""SP-X KVM auto-login broker — service orchestration.

Endpoints (mounted under two origins):
  * Portal backend (existing app) exposes:
       POST /api/kvm/launch            -> mints launch_id (RBAC-gated)
  * BMC dedicated-subdomain vhost (nginx location = /__spx_launch) exposes:
       POST /__spx_launch              -> consumes launch_id, server-side BMC
                                          login, returns host-only Set-Cookie +
                                          302 to the BMC subdomain root.

No BMC credential / token / CSRF / session detail is ever sent to the browser.
The browser only ever receives: (a) an opaque single-use launch_id, and (b) the
authenticated host-only BMC cookies on the BMC subdomain (which are exactly what
a normal in-browser login would create).
"""
from __future__ import annotations

import json
import logging
import threading
import time
from typing import Optional, Union

from fastapi import Request
from fastapi.responses import JSONResponse, RedirectResponse, Response

from .config import BrokerConfig, BMCTarget
from .registry import SessionRegistry, new_broker_session_id, new_launch_id
from .secret_store import AgeSecretStore
from .spx_client import (MaxSessionsError, RateLimitedError, LoginRateLimiter,
                         SpxClient, SpxClientError)

log = logging.getLogger("spx_kvm_broker")

Responseish = Union[JSONResponse, RedirectResponse, Response]

# Set of cookie names that are safe & host-only & Secure for the launch response.
# __Host- prefixed cookies require host-only + Secure + Path=/ (no Domain) —
# exactly our dedicated subdomain handoff.


class Audit:
    """Structured audit logger (JSONL). Never contains secrets."""

    def __init__(self, path):
        self._path = str(path)
        self._fh = None
        self._lock = threading.Lock()

    def _open(self):
        if self._fh is None:
            import os
            self._fh = open(self._path, "a", encoding="utf-8")
            try:
                os.chmod(self._path, 0o640)
            except Exception:
                pass

    def emit(self, event: str, server_id: str = "", portal_user: str = "",
             detail: str = ""):
        rec = {
            "ts": time.time(),
            "event": event,
            "server_id": server_id,
            "portal_user": portal_user,
            "detail": detail,
        }
        line = json.dumps(rec, ensure_ascii=False)
        with self._lock:
            try:
                self._open()
                self._fh.write(line + "\n")
                self._fh.flush()
            except Exception:
                log.error("audit write failed: %s", event)


class Broker:
    def __init__(self, config: BrokerConfig,
                 store: AgeSecretStore, registry: SessionRegistry):
        self.cfg = config
        self.store = store
        self.reg = registry
        self.rates = LoginRateLimiter(
            window=config.login_rate_limit_window,
            max_in_window=config.login_rate_limit_max,
            min_interval=config.login_cooldown_seconds,
        )
        self.audit = Audit(config.audit_log)
        # A high-priority "15000" alert latch, cleared by ops runbook.
        self._max_sessions_flag: dict[str, float] = {}
        self._flag_lock = threading.Lock()

    # =======================================================================
    # Portal backend: POST /api/kvm/launch
    # =======================================================================
    def mint_launch(self, portal_user_id: str, portal_session_id: str,
                    server_id: str, request: Request) -> dict:
        """Validate allowlist + RBAC (called after RBAC middleware) and mint a
        single-use launch_id. Returns dict to include in JSON response; no secret.
        """
        target = self.cfg.get_target(server_id)
        if target is None:
            self.audit.emit("launch_unknown_server", server_id=server_id,
                            portal_user=portal_user_id)
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="unknown server")

        launch_id = new_launch_id()
        self.reg.put_launch(
            launch_id=launch_id,
            server_id=server_id,
            bmc_subdomain=target.bmc_subdomain,
            portal_user_id=portal_user_id,
            portal_session_id=portal_session_id,
            redirect_host=target.bmc_subdomain,
            ttl_seconds=self.cfg.launch_ttl_seconds,
        )
        self.audit.emit("launch_minted", server_id=server_id,
                        portal_user=portal_user_id,
                        detail=f"subdomain={target.bmc_subdomain}")
        return {
            "launch_id": launch_id,
            "bmc_subdomain": target.bmc_subdomain,   # opaque capability holder
            "ttl_seconds": self.cfg.launch_ttl_seconds,
        }

    # =======================================================================
    # BMC subdomain: POST /__spx_launch
    # =======================================================================
    async def handle_launch(self, request: Request) -> Responseish:
        """Consume a launch_id and produce authenticated BMC cookies + redirect.

        The browser must send the launch_id in the POST body (never URL).
        """
        # Accept launch_id in the POST body either as JSON or form-encoded.
        # (HTML <form> submit uses application/x-www-form-urlencoded; the portal
        #  JS uses JSON. Never read launch_id from URL/query.)
        ctype = (request.headers.get("content-type") or "").lower()
        if "application/json" in ctype:
            try:
                body = await request.json()
            except Exception:
                return JSONResponse({"ok": False, "error": "bad_request"},
                                    status_code=400)
        else:
            body = dict(await request.form())
        launch_id = (body.get("launch_id") or "").strip() if isinstance(body, dict) else ""
        if not launch_id:
            return JSONResponse({"ok": False, "error": "missing_launch_id"},
                                status_code=400)

        host = request.headers.get("host", "")
        # Determine intended BMC subdomain from Host; must match the launch binding.
        target = self.cfg.find_target_by_subdomain(host)
        if target is None:
            self.audit.emit("launch_bad_host", detail=host)
            return JSONResponse({"ok": False, "error": "forbidden"},
                                status_code=403)

        # Consume (TTL + single-use atomically)
        rec = self.reg.consume_launch(launch_id)
        if rec is None:
            self.audit.emit("launch_invalid", server_id=target.server_id,
                            detail="expired_or_used")
            return JSONResponse({"ok": False, "error": "invalid_launch_id"},
                                status_code=403)

        # Verify binding: launch.server_id/bmc_subdomain must match this target.
        if rec["server_id"] != target.server_id or \
           rec["bmc_subdomain"] != target.bmc_subdomain:
            self.audit.emit("launch_binding_mismatch", server_id=target.server_id)
            return JSONResponse({"ok": False, "error": "forbidden"},
                                status_code=403)

        portal_user = rec["portal_user_id"]
        portal_session = rec["portal_session_id"]

        # Reuse an existing active broker session for the same portal user+BMC?
        try:
            cookies = self._reuse_or_login(target, portal_user, portal_session)
        except MaxSessionsError as e:
            self._flag_max_sessions(target.server_id)
            self.audit.emit("login_max_sessions", server_id=target.server_id,
                            portal_user=portal_user, detail="code 15000")
            return JSONResponse({"ok": False, "error": "bmc_session_cap",
                                 "detail": "BMC 已達 session 上限（code 15000），請聯絡管理員 / consult runbook"},
                                status_code=503)
        except RateLimitedError as e:
            wait = getattr(e, "retry_after", 5)
            self.audit.emit("login_rate_limited", server_id=target.server_id,
                            portal_user=portal_user, detail=f"retry_after={wait}")
            return JSONResponse({"ok": False, "error": "rate_limited",
                                 "retry_after": wait}, status_code=429)
        except SpxClientError as e:
            self.audit.emit("login_failed", server_id=target.server_id,
                            portal_user=portal_user,
                            detail=e.message if hasattr(e, "message") else str(e))
            return JSONResponse({"ok": False, "error": "login_failed",
                                 "retryable": bool(getattr(e, "retryable", False))},
                                status_code=503)

        # Redirect the browser to the BMC subdomain root with the authenticated
        # cookies as host-only Set-Cookie attributes.
        scheme = "https"
        redirect_url = f"{scheme}://{host}/"
        resp = RedirectResponse(redirect_url, status_code=302)
        for name, value in cookies.items():
            if name not in REQUIRED_COOKIES_SET:
                continue
            httponly = (name == "QSESSIONID")
            resp.set_cookie(
                key=name, value=value, path="/", secure=True,
                httponly=httponly, samesite="lax",
                # no `domain` attr => host-only cookie on this subdomain
            )
        self.audit.emit("launch_handoff_ok", server_id=target.server_id,
                        portal_user=portal_user, detail=f"redirect={redirect_url}")
        return resp

    def _reuse_or_login(self, target: BMCTarget, portal_user: str,
                        portal_session: str) -> dict:
        """Return a fresh cookie set, reusing an existing valid session.

        Spec: '同一 Portal user 對同一 BMC 重複 launch 時，若 broker session 有效則重用'.
        """
        # 1) reuse existing active session for this exact portal user+browser
        active = self.reg.active_session_for(target.server_id, portal_user,
                                             portal_session)
        if active:
            cookies = json.loads(active.cookies_json)
            # sanity: still has QSESSIONID
            if cookies.get("QSESSIONID"):
                self.reg.touch_session(active.broker_session_id,
                                       self.cfg.session_ttl_seconds)
                self.audit.emit("session_reused", server_id=target.server_id,
                                portal_user=portal_user)
                return cookies

        # 2) per-BMC cap: at most `max_broker_sessions` active broker sessions.
        cur = self.reg.any_active_session_for_server(target.server_id)
        if cur:
            # different portal user already holds the slot OR same-server reuse
            # policy: since cap=1, and this is a *different* portal_user, we must
            # not steal blindly — but spec allows reuse of a valid session.
            # If it's the same user it was handled above; if different user, we
            # log out the old one (it's a single-shared BMC anyway) after
            # respecting the fact that BMC only allows a few sessions.
            if cur.portal_user_id != portal_user:
                # We'll log the old session out (cleanup) so the new user can
                # take the slot. This is the "session lifecycle" stewardship.
                self._cleanup_session(cur)

        # 3) enforce rate limit / cooldown
        wait = self.rates.acquire(target.server_id)
        if wait is not None:
            e = RateLimitedError("login rate limited")
            e.retry_after = wait
            raise e

        # 4) perform login
        self.rates.record(target.server_id)
        cred_name = target.kvm_operator_cred_name
        cred = self.store.credential(cred_name)
        if cred is None:
            raise SpxClientError(f"credential not found: {cred_name}")
        client = SpxClient(target.upstream_ip, scheme=self.cfg.bmc_scheme,
                           port=target.upstream_port)
        cookies = client.login(cred["username"], cred["password"])

        # 5) persist broker session
        bsid = new_broker_session_id()
        self.reg.put_session(
            bsid=bsid, server_id=target.server_id,
            bmc_subdomain=target.bmc_subdomain,
            portal_user_id=portal_user, portal_session_id=portal_session,
            cookies=cookies, ttl_seconds=self.cfg.session_ttl_seconds,
        )
        self.audit.emit("session_created", server_id=target.server_id,
                        portal_user=portal_user, detail=f"bsid={bsid[:8]}")
        return cookies

    def _cleanup_session(self, sess):
        """Log out a broker session at the BMC (formal DELETE /api/session)."""
        try:
            cookies = json.loads(sess.cookies_json)
            client = SpxClient("", scheme=self.cfg.bmc_scheme)
            # logout needs the upstream IP; recover from server_id target
            target = self.cfg.get_target(sess.server_id)
            if target:
                client = SpxClient(target.upstream_ip, scheme=self.cfg.bmc_scheme,
                                   port=target.upstream_port)
                ok = client.logout(cookies)
                self.audit.emit("session_logged_out",
                                server_id=sess.server_id,
                                portal_user=sess.portal_user_id,
                                detail=f"ok={ok}")
        except Exception as e:
            log.warning("cleanup logout failed: %s", e)
        finally:
            self.reg.mark_stale(sess.broker_session_id)

    # -- maintenance ---------------------------------------------------------
    def sweep_idle_and_expired(self):
        """Periodic cleanup: expire stale sessions by logging them out at BMC,
        purge used/expired launch_ids."""
        now = time.time()
        self.reg.purge_launches(now)
        for sess in self.reg.stale_eligible(now):
            self._cleanup_session(sess)

    # -- code 15000 alert ----------------------------------------------------
    def _flag_max_sessions(self, server_id: str):
        with self._flag_lock:
            self._max_sessions_flag[server_id] = time.time()

    def max_sessions_flag(self, server_id: str) -> Optional[float]:
        with self._flag_lock:
            return self._max_sessions_flag.get(server_id)


REQUIRED_COOKIES_SET = {
    "QSESSIONID", "__Host-garc", "garc", "__Host-user_id", "user_id",
    "__Host-privilege", "privilege",
}
