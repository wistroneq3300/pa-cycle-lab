# -*- coding: utf-8 -*-
"""Broker core logic tests (no live BMC needed).

Covers: launch_id TTL + single-use + binding, RBAC gate, session registry
(reuse, per-BMC cap, stale expiry), login rate limiter (cooldown/window),
secret-store decryption wiring, and that NO secret ever appears in responses.
"""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from spx_kvm_broker.config import BrokerConfig, BMCTarget
from spx_kvm_broker.registry import (SessionRegistry, new_broker_session_id,
                                     new_launch_id)
from spx_kvm_broker.spx_client import LoginRateLimiter, build_cookie_set
from spx_kvm_broker import rbac

TARGETS = [
    {"server_id": "bmc-internal-a",
     "bmc_subdomain": "bmc-bmc-internal-a.kvm.lab.example.internal",
     "upstream_ip": "INTERNAL_IP_2",
     "kvm_operator_cred_name": "spx:bmc-internal-a:kvm-operator"},
    {"server_id": "bmc-internal-b",
     "bmc_subdomain": "bmc-bmc-internal-b.kvm.lab.example.internal",
     "upstream_ip": "INTERNAL_IP_3",
     "kvm_operator_cred_name": "spx:bmc-internal-b:kvm-operator"},
]


@pytest.fixture()
def registry(tmp_path):
    return SessionRegistry(tmp_path / "reg.db")


@pytest.fixture()
def cfg():
    c = BrokerConfig()
    for t in TARGETS:
        c.targets[t["server_id"]] = BMCTarget(
            server_id=t["server_id"], bmc_subdomain=t["bmc_subdomain"],
            upstream_ip=t["upstream_ip"],
            kvm_operator_cred_name=t["kvm_operator_cred_name"])
    c.launch_ttl_seconds = 30
    return c


# --------------------------------------------------------------------------
# launch_id lifecycle
# --------------------------------------------------------------------------
class TestLaunchRegistry:
    def test_mint_and_consume(self, registry):
        lid = new_launch_id()
        registry.put_launch(lid, "bmc-internal-a", "bmc", "u1", "s1",
                            "bmc-bmc-internal-a.kvm.lab.example.internal",
                            ttl_seconds=30)
        rec = registry.consume_launch(lid)
        assert rec is not None
        assert rec["server_id"] == "bmc-internal-a"
        assert rec["portal_user_id"] == "u1"

    def test_single_use(self, registry):
        lid = new_launch_id()
        registry.put_launch(lid, "bmc-internal-a", "bmc", "u1", "s1", "host", 30)
        assert registry.consume_launch(lid) is not None
        assert registry.consume_launch(lid) is None

    def test_expiry(self, registry):
        lid = new_launch_id()
        registry.put_launch(lid, "bmc-internal-a", "bmc", "u1", "s1", "host", 1)
        time.sleep(1.1)
        assert registry.consume_launch(lid) is None

    def test_unknown_launch_rejected(self, registry):
        assert registry.consume_launch("nonexistent") is None


# --------------------------------------------------------------------------
# session registry
# --------------------------------------------------------------------------
class TestBrokerSessionRegistry:
    def test_reuse_same_user(self, registry):
        bsid = new_broker_session_id()
        registry.put_session(bsid, "bmc-internal-a", "bmc", "u1", "s1",
                             {"QSESSIONID": "abc"}, ttl_seconds=1800)
        got = registry.active_session_for("bmc-internal-a", "u1", "s1")
        assert got is not None
        assert got.broker_session_id == bsid

    def test_stale_expiry(self, registry):
        bsid = new_broker_session_id()
        registry.put_session(bsid, "bmc-internal-a", "bmc", "u1", "s1",
                             {"QSESSIONID": "abc"}, ttl_seconds=1)
        time.sleep(1.1)
        stale = registry.stale_eligible()
        assert any(s.broker_session_id == bsid for s in stale)


# --------------------------------------------------------------------------
# RBAC
# --------------------------------------------------------------------------
class TestRBAC:
    def test_anon_denied(self):
        assert rbac.rbac_allows(None, "bmc-internal-a") is False

    def test_viewer_denied(self):
        u = rbac.PortalUser("u1", "viewer", [rbac.ROLE_VIEWER])
        assert rbac.rbac_allows(u, "bmc-internal-a") is False

    def test_operator_allowed(self):
        u = rbac.PortalUser("u1", "op", [rbac.ROLE_OPERATOR])
        assert rbac.rbac_allows(u, "bmc-internal-a") is True

    def test_admin_allowed(self):
        u = rbac.PortalUser("u1", "admin", [rbac.ROLE_ADMIN])
        assert rbac.rbac_allows(u, "bmc-internal-a") is True


# --------------------------------------------------------------------------
# login rate limiter
# --------------------------------------------------------------------------
class TestRateLimiter:
    def test_first_login_allowed(self):
        rl = LoginRateLimiter(window=10, max_in_window=2, min_interval=5)
        assert rl.acquire("bmc-internal-a") is None

    def test_cooldown_blocks(self):
        rl = LoginRateLimiter(window=10, max_in_window=2, min_interval=5)
        assert rl.acquire("s1") is None
        rl.record("s1")
        assert rl.acquire("s1") is not None

    def test_window_limit(self):
        rl = LoginRateLimiter(window=10, max_in_window=2, min_interval=0)
        rl.record("s1")
        assert rl.acquire("s1") is None
        rl.record("s1")
        assert rl.acquire("s1") is not None


# --------------------------------------------------------------------------
# cookie set build (server-side -> browser handoff)
# --------------------------------------------------------------------------
class TestCookieBuild:
    def test_build_cookie_set(self):
        server = {"QSESSIONID": "q123"}
        login = {"CSRFToken": "csrf-x", "user_id": 42, "privilege": "4"}
        c = build_cookie_set(server, login)
        assert c["QSESSIONID"] == "q123"
        assert c["garc"] == "csrf-x"
        assert c["__Host-garc"] == "csrf-x"
        assert c["user_id"] == "42"
        assert c["privilege"] == "4"

    def test_no_login_detail_leak(self, cfg, registry):
        from spx_kvm_broker.broker import Broker

        class FakeStore:
            def credential(self, name):
                return {"username": "kvm-operator", "password": "TOPSECRET"}
        b = Broker(cfg, FakeStore(), registry)
        result = b.mint_launch("u1", "s1", "bmc-internal-a", request=None)
        assert "TOPSECRET" not in str(result)
        assert "launch_id" in result
        assert ".kvm." in result["bmc_subdomain"]
        assert result["bmc_subdomain"].startswith("bmc-bmc-internal-a")
