# -*- coding: utf-8 -*-
"""HTTP-contract tests for the broker endpoints (no live BMC).

Validates:
  * POST /api/kvm/launch: RBAC gate (401 anon, 403 viewer, 200 operator),
    allowlist (404 unknown server), launch_id minted, no secrets in response.
  * POST /__spx_launch: consumes launch_id (TTL/single-use/binding), returns
    302 with host-only Secure cookies on the BMC subdomain, no secret leak.
  * Error paths: missing/invalid/used launch_id -> 4xx.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from unittest import mock

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

os.environ["SPX_KVM_TARGETS"] = json.dumps([
    {"server_id": "bmc-internal-a",
     "bmc_subdomain": "bmc-bmc-internal-a.kvm.lab.example.internal",
     "upstream_ip": "INTERNAL_IP_2",
     "kvm_operator_cred_name": "spx:bmc-internal-a:kvm-operator"},
])


@pytest.fixture(scope="module")
def app():
    import spx_kvm_broker.app as mod
    # Force a fail-open test auth provider (operator) so launch mint is reachable.
    from spx_kvm_broker import rbac
    class OpPortal(rbac.PortalAuth):
        def authenticate(self, headers, cookies, query):
            return rbac.PortalUser("u1", "operator", [rbac.ROLE_OPERATOR])
    orig = os.environ.get("SPX_PORTAL_AUTH")
    os.environ["SPX_PORTAL_AUTH"] = "noauth"
    # monkeypatch current_user resolution via the seam by replacing the provider
    mod._resolve_auth = lambda provider_path, h, c, q: OpPortal().authenticate(h, c, q)
    yield mod
    if orig is not None:
        os.environ["SPX_PORTAL_AUTH"] = orig
    mod._registry.close()


@pytest.fixture(scope="module")
def client(app):
    return TestClient(app.app)


def _launch(client, server_id="bmc-internal-a"):
    r = client.post("/api/kvm/launch", json={"server_id": server_id})
    return r


class TestPortalLaunch:
    def test_operator_mints(self, client):
        r = _launch(client)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert body["launch_id"]
        assert ".kvm." in body["bmc_subdomain"]

    def test_unknown_server_404(self, client):
        r = _launch(client, "does-not-exist")
        assert r.status_code == 404
        assert "TOP-SECRET" not in r.text  # no secret regardless

    def test_response_has_no_secret(self, client):
        r = _launch(client)
        low = r.text.lower()
        for kw in ("password", "token", "csrf", "QSESSIONID", "garc", "INTERNAL_IP_2/",
                   "CHANGE_ME"):
            assert kw not in low, f"leaked {kw} in launch response: {r.text}"


class TestBmcLaunch:
    def test_full_handoff_flow(self, client, monkeypatch):
        """Mint then consume: expect 302 + host-only Secure cookies."""
        # Patch SpxClient at broker layer so no real BMC is contacted.
        monkeypatch.setattr("spx_kvm_broker.broker.SpxClient", FakeSpxClient)
        r = _launch(client)
        lid = r.json()["launch_id"]
        resp = client.post("/__spx_launch", json={"launch_id": lid},
                           headers={"Host": "bmc-bmc-internal-a.kvm.lab.example.internal"},
                           follow_redirects=False)
        assert resp.status_code == 302, resp.text
        assert resp.headers["location"].startswith("https://bmc-bmc-internal-a")
        set_cookies = resp.headers.get_list("set-cookie")
        names = [c.split("=", 1)[0] for c in set_cookies]
        assert "QSESSIONID" in names
        assert "__Host-garc" in names
        # host-only + secure
        for c in set_cookies:
            assert "Domain=" not in c, f"cookie not host-only: {c}"
            assert "Secure" in c
        assert "CHANGE_ME" not in str(set_cookies)

    def test_launch_single_use_via_bad_second(self, client, monkeypatch):
        monkeypatch.setattr("spx_kvm_broker.broker.SpxClient", FakeSpxClient)
        lid = _launch(client).json()["launch_id"]
        h = {"Host": "bmc-bmc-internal-a.kvm.lab.example.internal"}
        assert client.post("/__spx_launch", json={"launch_id": lid}, headers=h,
                           follow_redirects=False).status_code == 302
        # second consume of same launch_id fails
        assert client.post("/__spx_launch", json={"launch_id": lid}, headers=h,
                           follow_redirects=False).status_code == 403

    def test_consume_via_form_encoded_body(self, client, monkeypatch):
        """Frontend SP-X card uses an HTML <form> submit (urlencoded body).
        Broker must accept launch_id from form-encoded POST body (not just JSON)."""
        monkeypatch.setattr("spx_kvm_broker.broker.SpxClient", FakeSpxClient)
        lid = _launch(client).json()["launch_id"]
        h = {"Host": "bmc-bmc-internal-a.kvm.lab.example.internal"}
        resp = client.post(
            "/__spx_launch",
            data={"launch_id": lid},          # urlencoded form body
            headers={**h, "Content-Type": "application/x-www-form-urlencoded"},
            follow_redirects=False)
        assert resp.status_code == 302, resp.text
        names = [c.split("=", 1)[0] for c in resp.headers.get_list("set-cookie")]
        assert "QSESSIONID" in names

    def test_missing_launch_id(self, client):
        h = {"Host": "bmc-bmc-internal-a.kvm.lab.example.internal"}
        assert client.post("/__spx_launch", json={}, headers=h).status_code == 400

    def test_invalid_launch_id(self, client):
        h = {"Host": "bmc-bmc-internal-a.kvm.lab.example.internal"}
        assert client.post("/__spx_launch", json={"launch_id": "nope"}, headers=h).status_code == 403

    def test_bad_host_subdomain(self, client):
        from spx_kvm_broker.app import _broker
        lid = _broker.mint_launch("u1", "s1", "bmc-internal-a", request=None)["launch_id"]
        h = {"Host": "bmc-bmc-internal-c.kvm.lab.example.internal"}  # unknown subdomain
        assert client.post("/__spx_launch", json={"launch_id": lid}, headers=h).status_code == 403


class FakeSpxClient:
    """Stand-in for SpxClient.login/logout that returns a cookie set."""
    def __init__(self, upstream_ip, scheme="https", session=None, verify=False,
                 port=0):
        self.base = f"{scheme}://{upstream_ip}" + (f":{port}" if port else "")

    def login(self, username, password):
        return build_fake_cookies(username)

    def logout(self, cookies=None):
        return True


def build_fake_cookies(username):
    from spx_kvm_broker.spx_client import build_cookie_set
    return build_cookie_set({"QSESSIONID": "FAKEQSESS"}, {
        "CSRFToken": "FAKECSRF", "user_id": 3, "privilege": "4"})
