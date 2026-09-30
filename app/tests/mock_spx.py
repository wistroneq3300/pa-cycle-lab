# -*- coding: utf-8 -*-
"""In-process mock MegaRAC SP-X server used by tests/test_e2e_mock.py.

Simulates observed real behavior on the lab BMC:
* GET / -> 200 (welcome page, no cookie)
* POST /api/session (application/x-www-form-urlencoded) -> 200 + Set-Cookie
  QSESSIONID (path=/, Secure, HttpOnly, HOST-ONLY i.e. no Domain attr). JSON
  payload includes CSRFToken / user_id / privilege (which the front-end JS uses
  to write __Host-garc / user_id / privilege cookies -- we model the full set).
* DELETE /api/session -> 200 and releases the QSESSIONID.
* Configurable session cap: logins beyond MAX_WEB_SESSIONS return
  401 {"error":"Could not login","code":15000}.
"""
import json
import threading
import time
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

_lock = threading.Lock()
_active: list = []
_MAX_WEB_SESSIONS = 2


class _H(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *a):
        pass

    def _read(self):
        n = int(self.headers.get("Content-Length", 0) or 0)
        return self.rfile.read(n) if n else b""

    def _reply(self, code, body, ctype="application/json", cookies=()):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        for c in cookies:
            self.send_header("Set-Cookie", c)
        self.end_headers()
        if body:
            self.wfile.write(body)

    def do_GET(self):
        if self.path in ("/", "/index.html"):
            if "QSESSIONID=" in self.headers.get("Cookie", ""):
                self._reply(200, b"<html>SP-X DASHBOARD</html>", ctype="text/html")
            else:
                self._reply(200, b"<html>SP-X LOGIN PAGE</html>", ctype="text/html")
            return
        self._reply(404, b"{}")

    def do_POST(self):
        if self.path == "/api/session":
            body = self._read().decode("utf-8", "replace")
            q = urllib.parse.parse_qs(body)
            user = (q.get("username") or [""])[0]
            pw = (q.get("password") or [""])[0]
            if not user or pw == "fail":
                self._reply(401, json.dumps({"error": "Could not login", "code": 1005}).encode())
                return
            with _lock:
                if len(_active) >= _MAX_WEB_SESSIONS:
                    self._reply(401, json.dumps({"error": "Could not login", "code": 15000}).encode())
                    return
                qsid = f"QS{int(time.time()*1000)}{len(_active)}"
                _active.append(qsid)
            payload = {"CSRFToken": f"csrf-{qsid}", "user_id": 7,
                       "privilege": "252", "extendedpriv": "0"}
            self._reply(200, json.dumps(payload).encode(),
                        cookies=[f"QSESSIONID={qsid}; path=/; Secure; HttpOnly"])
            return
        self._reply(404, b"{}")

    def do_DELETE(self):
        if self.path == "/api/session":
            ck = self.headers.get("Cookie", "")
            qsid = None
            for part in ck.split(";"):
                part = part.strip()
                if part.startswith("QSESSIONID="):
                    qsid = part.split("=", 1)[1]
            with _lock:
                if qsid in _active:
                    _active.remove(qsid)
            self._reply(200, b"")
            return
        self._reply(404, b"{}")


def active_count():
    with _lock:
        return len(_active)


def start(port=18888, max_sessions=2):
    global _MAX_WEB_SESSIONS, _active
    with _lock:
        _MAX_WEB_SESSIONS = max_sessions
        _active = []
    srv = ThreadingHTTPServer(("127.0.0.1", port), _H)
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    return srv


def stop(srv):
    srv.shutdown()
