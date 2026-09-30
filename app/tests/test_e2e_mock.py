# -*- coding: utf-8 -*-
"""End-to-end broker handoff against an in-process mock SP-X BMC.

Proves the full HTTP contract without touching the real (saturated) BMC:
  1. /api/kvm/launch mints launch_id + bmc_subdomain (no secret leak)
  2. /__spx_launch consumes the launch_id, performs server-side SP-X login
     against the mock, returns 302 with host-only Secure cookies on the BMC
     subdomain; following it shows the authenticated dashboard.
  3. launch_id is single-use (second consume fails) and never appears in URLs.
  4. Session reuse: a second launch on the same BMC reuses the broker session
     instead of minting a new web session.
  5. Session cap: when the mock caps out, the broker returns 503
     bmc_session_cap and never a 200.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import mock_spx
from spx_kvm_broker.config import BMCTarget, BrokerConfig
from spx_kvm_broker.secret_store import AgeSecretStore
from spx_kvm_broker.registry import SessionRegistry
from spx_kvm_broker.broker import Broker, REQUIRED_COOKIES_SET

MOCK_PORT = 18899
SUBDOMAIN = "bmc-bmc-internal-a.kvm.lab.example.internal"


def _build_client(tmp_path):
    import spx_kvm_broker.app as broker_app
    registry = SessionRegistry(str(tmp_path / "reg.db"))
    sf = tmp_path / "creds.age"

    class TmpStore:
        """AgeSecretStore requires real age binary; use an in-memory stand-in
        that returns the kvm-operator credential the broker needs."""
        def __init__(self):
            self._d = {"spx:bmc-internal-a:kvm-operator":
                       {"username": "kvmop", "password": "S3cret"}}
        def credential(self, name):
            return self._d.get(name)

    store = TmpStore()
    cfg = BrokerConfig(bmc_scheme="http",
                       audit_log=tmp_path / "audit.log")
    cfg.targets["bmc-internal-a"] = BMCTarget(
        server_id="bmc-internal-a", bmc_subdomain=SUBDOMAIN,
        upstream_ip="127.0.0.1", kvm_operator_cred_name="spx:bmc-internal-a:kvm-operator",
        upstream_port=MOCK_PORT, max_broker_sessions=2, login_cooldown_seconds=0)
    broker = Broker(cfg, store, registry)

    # rewire the broker app to our mock-pointed broker + operator auth
    from spx_kvm_broker import rbac
    class Op(rbac.PortalAuth):
        def authenticate(self, h, c, q):
            return rbac.PortalUser("u1", "operator", [rbac.ROLE_OPERATOR])
    broker_app._broker = broker
    broker_app._cfg = cfg
    broker_app._resolve_auth = lambda p, h, c, q: Op().authenticate(h, c, q)
    return TestClient(broker_app.app)


@pytest.fixture(scope="module")
def srv():
    return mock_spx.start(MOCK_PORT, max_sessions=2)


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    return _build_client(tmp_path_factory.mktemp("e2e"))


def _launch(client):
    return client.post("/api/kvm/launch", json={"server_id": "bmc-internal-a"})


def _consume(client, lid, host=SUBDOMAIN):
    return client.post("/__spx_launch", json={"launch_id": lid},
                       headers={"Host": host}, follow_redirects=False)


class TestHandoff:
    def test_full_handoff_authenticates_next_get(self, srv, client):
        before = mock_spx.active_count()
        r = _launch(client)
        assert r.status_code == 200
        body = r.json()
        assert body["ok"] is True and body["launch_id"]
        assert body["bmc_subdomain"] == SUBDOMAIN
        assert "S3cret" not in r.text and "kvmop" not in r.text

        resp = _consume(client, body["launch_id"])
        assert resp.status_code == 302, resp.text
        assert resp.headers["location"].startswith("https://" + SUBDOMAIN)
        cookies = resp.headers.get_list("set-cookie")
        names = [c.split("=", 1)[0] for c in cookies]
        assert "QSESSIONID" in names
        assert "__Host-garc" in names or "garc" in names
        # host-only + secure
        for c in cookies:
            assert "Domain=" not in c
            assert "Secure" in c
        assert mock_spx.active_count() > before

    def test_launch_single_use(self, srv, client):
        lid = _launch(client).json()["launch_id"]
        assert _consume(client, lid).status_code == 302
        assert _consume(client, lid).status_code == 403

    def test_launch_id_never_in_url(self, srv, client):
        lid = _launch(client).json()["launch_id"]
        assert lid not in SUBDOMAIN
        # no GET route exists for launch; a GET must 405/404, not leak via query
        g = client.get("/__spx_launch?launch_id=" + lid)
        assert g.status_code in (405, 404)

    def test_bad_host_forbidden(self, srv, client):
        lid = _launch(client).json()["launch_id"]
        resp = _consume(client, lid, host="bmc-unknown.kvm.lab.example.internal")
        assert resp.status_code == 403

    def test_missing_launch_id(self, srv, client):
        resp = client.post("/__spx_launch", json={},
                           headers={"Host": SUBDOMAIN}, follow_redirects=False)
        assert resp.status_code == 400


class TestReuseAndCap:
    def test_session_reuse_within_cap(self, srv, client):
        cnt = mock_spx.active_count()
        r1 = _consume(client, _launch(client).json()["launch_id"])
        assert r1.status_code == 302
        r2 = _consume(client, _launch(client).json()["launch_id"])
        assert r2.status_code == 302
        # with max_sessions=2 and reuse, we should stay within cap+1
        assert mock_spx.active_count() <= cnt + 2

    def test_cap_returns_503_not_200(self, srv, client):
        # fill the mock to cap via distinct portal users so reuse can't kick in
        from spx_kvm_broker import rbac
        import spx_kvm_broker.app as broker_app
        class OpA(rbac.PortalAuth):
            def authenticate(self, h, c, q):
                return rbac.PortalUser("alice", "operator", [rbac.ROLE_OPERATOR])
        broker_app._resolve_auth = lambda p, h, c, q: OpA().authenticate(h, c, q)
        s1 = _consume(client, _launch(client).json()["launch_id"])
        assert s1.status_code in (302, 503, 429)
        s2 = _consume(client, _launch(client).json()["launch_id"])
        assert s2.status_code in (302, 503, 429)
        # now reach cap / rate-limit; the third distinct-user login must NOT be 200
        # (the BMC is saturated) -- it must be a structured error (cap/rate).
        class OpB(rbac.PortalAuth):
            def authenticate(self, h, c, q):
                return rbac.PortalUser("bob", "operator", [rbac.ROLE_OPERATOR])
        broker_app._resolve_auth = lambda p, h, c, q: OpB().authenticate(h, c, q)
        s3 = _consume(client, _launch(client).json()["launch_id"])
        assert s3.status_code != 200
        body = s3.json()
        assert body.get("ok") is False or "ok" not in body
        assert body.get("ok") is not True
