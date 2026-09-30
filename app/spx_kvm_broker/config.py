# -*- coding: utf-8 -*-
"""Broker configuration & inventory allowlist.

The inventory maps portal server_id -> the single allowed BMC upstream and its
KVM operator credential *reference*. Credentials are NOT stored here; they are
referenced by name and read from the root-only encrypted secret store at
runtime by the broker service process.

Security invariants enforced elsewhere:
  - No BMC password / token / CSRF in this file, in API responses, logs or URLs.
  - `server_id` allowlist is the ONLY way to reach a BMC. There is no path for a
    user-supplied arbitrary BMC URL/IP.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Optional

# ---------------------------------------------------------------------------
# Filesystem / deployment locations
# ---------------------------------------------------------------------------

# Root-only secret store (age-encrypted). Owner root:portal-service-group, 0600.
# See docs/spx-kvm-secret-store.md / secret-store deployment guide.
DEFAULT_SECRET_FILE = "/etc/portal/secrets/spx-bmc-credentials.age"

# Age-encrypted symmetric passphrase is NOT used; we use an age identity
# (X25519 recipient + private key) so only the broker process that holds the
# identity can decrypt. Identity kept on-disk, root-owned 0600.
DEFAULT_IDENTITY_FILE = "/etc/portal/secrets/spx-bmc-identity.txt"

# Session registry DB (SQLite). Root-owned 0600 dir/file.
DEFAULT_REGISTRY_DB = "/var/lib/portal/spx-session-registry.db"

# Audit log (structured JSONL). Must NOT contain credentials/tokens.
DEFAULT_AUDIT_LOG = "/var/log/portal/spx-kvm-broker-audit.log"


@dataclass
class BMCTarget:
    """One allowed BMC behind a dedicated subdomain."""
    server_id: str                 # canonical id used by portal inventory
    bmc_subdomain: str             # bmc-<server-id>.kvm.lab.example.internal
    upstream_ip: str               # BMC IP (only reachable via this allowlist)
    kvm_operator_cred_name: str    # name in the secret store (not the password)
    # Per-BMC knobs
    max_broker_sessions: int = 1
    login_cooldown_seconds: int = 5
    upstream_port: int = 0         # 0 = default (443/https 80/http); used in tests


@dataclass
class BrokerConfig:
    # Launch-id parameters
    launch_ttl_seconds: int = 30            # TTL <= 60s per spec
    # Session lifecycle
    session_idle_timeout_seconds: int = 900
    session_ttl_seconds: int = 1800
    # Login hardening (code 15000 protection)
    login_rate_limit_window: float = 10.0   # seconds
    login_rate_limit_max: int = 2           # max logins in window per server_id
    login_cooldown_seconds: int = 5
    # BMC Web URL base used by broker when logging in server-side.
    # We always log in against the BMC upstream IP; cookies are then handed to
    # the browser scoped to the dedicated subdomain. (BMC sees the subdomain.)
    bmc_scheme: str = "https"
    # Files
    secret_file: Path = Path(DEFAULT_SECRET_FILE)
    identity_file: Path = Path(DEFAULT_IDENTITY_FILE)
    registry_db: Path = Path(DEFAULT_REGISTRY_DB)
    audit_log: Path = Path(DEFAULT_AUDIT_LOG)

    # Populated at startup from env/secret; not serialized.
    targets: Dict[str, BMCTarget] = field(default_factory=dict, repr=False)

    def load_targets_from_env(self) -> None:
        """Load inventory allowlist from env var JSON (deployment-supplied).

        Env format (JSON):
          SPX_KVM_TARGETS=[{"server_id":..., "bmc_subdomain":...,
                            "upstream_ip":..., "kvm_operator_cred_name":...}]
        The env var holds structure + cred *names*, never passwords.
        """
        raw = os.environ.get("SPX_KVM_TARGETS")
        if not raw:
            raise RuntimeError("SPX_KVM_TARGETS inventory is not configured")
        import json
        items = json.loads(raw)
        if not isinstance(items, list):
            raise RuntimeError("SPX_KVM_TARGETS must be a JSON list")
        for it in items:
            t = BMCTarget(
                server_id=it["server_id"],
                bmc_subdomain=it["bmc_subdomain"],
                upstream_ip=it["upstream_ip"],
                kvm_operator_cred_name=it.get("kvm_operator_cred_name",
                                              f"spx:{it['server_id']}:kvm-operator"),
                max_broker_sessions=int(it.get("max_broker_sessions", 1)),
                login_cooldown_seconds=int(it.get("login_cooldown_seconds", 5)),
            )
            self.targets[t.server_id] = t

    def get_target(self, server_id: str) -> Optional[BMCTarget]:
        """Allowlist lookup only. Returns None for unknown server_id."""
        return self.targets.get(server_id)

    def find_target_by_subdomain(self, subdomain: str) -> Optional[BMCTarget]:
        for t in self.targets.values():
            if t.bmc_subdomain == subdomain:
                return t
        return None
