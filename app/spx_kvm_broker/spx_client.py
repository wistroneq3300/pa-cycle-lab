# -*- coding: utf-8 -*-
"""SP-X Web login/logout client used by the broker (server-side).

The broker logs into the BMC using the kvm-operator credential ON the BMC
upstream IP, obtains the authenticated cookie set (QSESSIONID etc.), and hands
it to the browser as host-only cookies on the dedicated subdomain by the launch
endpoint. No credential ever leaves this client.

Key facts (empirically validated against MegaRAC SP-X):
  * POST /api/session must be form-urlencoded (JSON body → 403).
  * On success the server sets ONE cookie: QSESSIONID (path=/, secure, HttpOnly).
  * Response JSON carries CSRFToken, user_id, privilege — the SP-X front-end
    normally turns CSRFToken into the `garc`/`__Host-garc` client cookie.
  * The browser needs garc/__Host-garc + user_id + privilege (client cookies)
    plus QSESSIONID to run the KVM viewer against this BMC origin.
  * Formal logout: DELETE /api/session  (validated in SP-X source).
  * Login failure code 15000 = MAX_NUM_SESSIONS_ALREADY_IN_USE (session cap).
"""
from __future__ import annotations

import json
import logging
import threading
import time
from typing import Dict, Optional, Tuple

import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
log = logging.getLogger("spx_kvm_broker.spx_client")

CODE_MAX_SESSIONS = 15000

# Browser-like UA; SP-X may inspect it.
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

# Cookie names the browser must hold, host-only, on the dedicated subdomain.
REQUIRED_COOKIES = [
    "QSESSIONID",
    "__Host-garc", "garc",
    "__Host-user_id", "user_id",
    "__Host-privilege", "privilege",
]


class SpxClientError(Exception):
    def __init__(self, message, status=None, code=None, retryable=False):
        super().__init__(message)
        self.status = status
        self.code = code
        self.retryable = retryable


class RateLimitedError(SpxClientError):
    pass


class MaxSessionsError(SpxClientError):
    """code 15000 — per-BMC session cap reached. Requires alert + runbook."""

    def __init__(self, message="BMC session capacity reached (code 15000)"):
        super().__init__(message, code=CODE_MAX_SESSIONS, retryable=False)


def build_cookie_set(server_cookies: dict, login_json: dict) -> Dict[str, str]:
    """Assemble the browser cookie set from the server-set Session cookies and
    the login JSON (mirroring what the SP-X front-end does with document.cookie).
    """
    csrf = (login_json.get("CSRFToken") or "").strip()
    user_id = str(login_json.get("user_id", ""))
    privilege = str(login_json.get("privilege", ""))
    cookies: Dict[str, str] = {}
    # server-set session cookies (QSESSIONID and any others)
    for k, v in server_cookies.items():
        cookies[k] = v
    # client cookies the SP-X app expects
    if csrf:
        cookies["__Host-garc"] = csrf
        cookies["garc"] = csrf
    if user_id:
        cookies["__Host-user_id"] = user_id
        cookies["user_id"] = user_id
    if privilege:
        cookies["__Host-privilege"] = privilege
        cookies["privilege"] = privilege
    return cookies


class SpxClient:
    """A thin SP-X login handle. Each call opens one BMC Web session.

    The cookie set obtained maps 1:1 to a broker-managed session; for reuse on
    repeat launches the broker stores the cookie set in the registry.
    """

    def __init__(self, upstream_ip: str, scheme: str = "https",
                 session=None, verify=False, port: int = 0):
        if port:
            self.base = f"{scheme}://{upstream_ip}:{port}"
        else:
            self.base = f"{scheme}://{upstream_ip}"
        self.verify = verify
        self._session = session or requests.Session()
        # last cookie set seen (from server + login JSON), for reuse/refresh.
        self._server_cookies: Dict[str, str] = {}
        self._csrf: Optional[str] = None
        self._user_id = ""
        self._privilege = ""

    # -- login ---------------------------------------------------------------
    def login(self, username: str, password: str) -> Dict[str, str]:
        """Perform server-side SP-X login. Returns assembled browser cookie set.
        Raises SpxClientError / MaxSessionsError / RateLimitedError.
        """
        # warm up: GET / establishes base QSESSIONID (observed on real BMC)
        try:
            self._session.get(self.base + "/", verify=self.verify, timeout=12)
        except requests.RequestException:
            pass  # non-fatal
        headers = {
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "X-Requested-With": "XMLHttpRequest",
            "Origin": self.base,
            "Referer": self.base + "/",
            "User-Agent": UA,
        }
        try:
            r = self._session.post(
                self.base + "/api/session",
                data={"username": username, "password": password},
                headers=headers, verify=self.verify, timeout=15,
            )
        except requests.RequestException as e:
            raise SpxClientError(f"SP-X network error during login: {e}", retryable=True) from e

        self._server_cookies = dict(self._session.cookies.get_dict())

        if r.status_code != 200:
            code = self._parse_code(r)
            msg = f"SP-X login HTTP {r.status_code}"
            if code == CODE_MAX_SESSIONS:
                raise MaxSessionsError()
            raise SpxClientError(msg, status=r.status_code, code=code,
                                 retryable=r.status_code >= 500)

        try:
            js = r.json()
        except Exception:
            raise SpxClientError("SP-X login returned non-JSON", retryable=True)

        if not isinstance(js, dict):
            raise SpxClientError("SP-X login JSON malformed", retryable=True)

        # Some SP-X builds signal failure in JSON with code.
        if js.get("ok") is False:
            code = self._parse_code_js(js)
            if code == CODE_MAX_SESSIONS:
                raise MaxSessionsError()
            raise SpxClientError(
                f"SP-X login refused (json code={code})", code=code, retryable=False)

        csrf = (js.get("CSRFToken") or "").strip()
        if not csrf:
            raise SpxClientError("SP-X login: missing CSRFToken", retryable=True)

        self._csrf = csrf
        self._user_id = str(js.get("user_id", ""))
        self._privilege = str(js.get("privilege", ""))
        return build_cookie_set(self._server_cookies, js)

    # -- logout --------------------------------------------------------------
    def logout(self, cookies: Optional[Dict[str, str]] = None) -> bool:
        """Call formal logout DELETE /api/session. Return True if 2xx."""
        hdrs = {"Origin": self.base, "Referer": self.base + "/",
                "User-Agent": UA, "Accept": "application/json, text/javascript, */*; q=0.01"}
        try:
            if cookies:
                r = requests.delete(self.base + "/api/session",
                                    cookies=cookies, headers=hdrs,
                                    verify=self.verify, timeout=12)
            else:
                r = self._session.delete(self.base + "/api/session",
                                         headers=hdrs, verify=self.verify, timeout=12)
            return 200 <= r.status_code < 300
        except requests.RequestException:
            return False

    # -- helpers -------------------------------------------------------------
    def _parse_code(self, r) -> Optional[int]:
        try:
            j = r.json()
            return self._parse_code_js(j)
        except Exception:
            return None

    @staticmethod
    def _parse_code_js(js) -> Optional[int]:
        c = js.get("code")
        try:
            return int(c) if c is not None else None
        except (TypeError, ValueError):
            return None

    @property
    def csrf(self):
        return self._csrf


class LoginRateLimiter:
    """Per-server_id client-side login throttling to protect against
    hammering SP-X (cooldown + window). Mirrors spec: no unlimited retry,
    rate limit, cooldown; 15000 stops auto-login + high-priority alert.
    """

    def __init__(self, window=10.0, max_in_window=2, min_interval=5.0):
        self.window = window
        self.max_in_window = max_in_window
        self.min_interval = min_interval
        self._last: Dict[str, float] = {}
        self._hist: Dict[str, list] = {}
        self._lock = threading.Lock()

    def acquire(self, server_id: str) -> Optional[float]:
        """Return None if allowed, else seconds to wait before retrying."""
        now = time.time()
        with self._lock:
            last = self._last.get(server_id)
            if last and (now - last) < self.min_interval:
                return self.min_interval - (now - last)
            hist = [t for t in self._hist.get(server_id, []) if now - t < self.window]
            if len(hist) >= self.max_in_window:
                # oldest eligible retry time
                oldest = min(hist) if hist else now
                return (oldest + self.window) - now
            self._hist[server_id] = hist
            return None

    def record(self, server_id: str) -> None:
        now = time.time()
        with self._lock:
            hist = [t for t in self._hist.get(server_id, []) if now - t < self.window]
            hist.append(now)
            self._hist[server_id] = hist
            self._last[server_id] = now
