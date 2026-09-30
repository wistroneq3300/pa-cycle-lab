# -*- coding: utf-8 -*-
"""Stage-1 EnvOperatorPortal auth provider tests.

The operator identity comes ONLY from environment (SPX_OPERATOR_ID / ROLES),
never from the request — so a client cannot self-assign a role. The provider stays
fail-closed: no SPX_OPERATOR_ID set => anonymous (denied).
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from spx_kvm_broker import rbac


def _provider(monkeypatch, operator_id=None, roles=None):
    if operator_id is None:
        monkeypatch.delenv("SPX_OPERATOR_ID", raising=False)
    else:
        monkeypatch.setenv("SPX_OPERATOR_ID", operator_id)
    if roles is None:
        monkeypatch.delenv("SPX_OPERATOR_ROLES", raising=False)
    else:
        monkeypatch.setenv("SPX_OPERATOR_ROLES", roles)
    return rbac.EnvOperatorPortal()


def test_no_operator_id_is_fail_closed(monkeypatch):
    p = _provider(monkeypatch, operator_id=None)
    assert p.authenticate({}, {}, {}) is None


def test_default_role_is_operator(monkeypatch):
    p = _provider(monkeypatch, operator_id="op1", roles=None)
    u = p.authenticate({}, {}, {})
    assert u is not None and u.user_id == "op1"
    assert rbac.ROLE_OPERATOR in u.roles


def test_multi_roles_parsed(monkeypatch):
    p = _provider(monkeypatch, operator_id="op1", roles="admin,operator")
    u = p.authenticate({}, {}, {})
    assert u is not None
    assert rbac.ROLE_ADMIN in u.roles and rbac.ROLE_OPERATOR in u.roles


def test_viewer_only_is_denied(monkeypatch):
    p = _provider(monkeypatch, operator_id="op1", roles="viewer")
    u = p.authenticate({}, {}, {})
    assert u is not None
    assert rbac.rbac_allows(u, "bmc-internal-a") is False


def test_identity_ignores_request_input(monkeypatch):
    """A client-supplied header/cookie must NOT be able to set the role."""
    p = _provider(monkeypatch, operator_id="op1", roles="operator")
    u = p.authenticate({"X-User-Role": "admin"}, {"role": "admin"},
                       {"r": "admin"})
    assert u.user_id == "op1"
    assert u.roles == ["operator"]
