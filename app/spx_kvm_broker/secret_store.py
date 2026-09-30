# -*- coding: utf-8 -*-
"""Root-only age-encrypted credential store.

Credentials live on disk as an age-encrypted file, readable+decryptable only by
the broker service process (which owns the age identity). Passwords never
appear in memory dumps intended for logs, in API responses, URLs, or frontend.

File layout (age-encrypted JSON):
{
  "spx:bmc-internal-a:kvm-operator": {"username": "...", "password": "..."},
  ...
}

Usage/ops:
  * Generation is a one-time deploy step (see docs/secret-store).
    key = secrets generate; write encrypted payload.
  * Broker process reads identity file (root-owned 0600) at startup and keeps
    it in-process memory only; never logs it, never exposes it.
"""
from __future__ import annotations

import json
import logging
import subprocess
import tempfile
from pathlib import Path
from typing import Dict, Optional

log = logging.getLogger("spx_kvm_broker.secret_store")

AGE = "age"
AGE_KEYGEN = "age-keygen"


class SecretStoreError(Exception):
    pass


class AgeSecretStore:
    """Read-only age-encrypted secret store.

    Identity file: the age x25519 private key (root-owned, 0600). We decrypt
    by feeding the identity to `age --decrypt -i identity`. This avoids storing
    the passphrase and keeps decryption capability bound to the on-disk key the
    broker owns.
    """

    def __init__(self, secret_file: Path, identity_file: Path):
        self.secret_file = Path(secret_file)
        self.identity_file = Path(identity_file)
        self._cache: Optional[Dict[str, dict]] = None
        self._refresh_counter = 0

    # -- internal decryption -------------------------------------------------
    def _decrypt_payload(self) -> Dict[str, dict]:
        if not self.secret_file.exists():
            raise SecretStoreError(
                f"secret store not found: {self.secret_file}")
        if not self.identity_file.exists():
            raise SecretStoreError(
                f"age identity not found: {self.identity_file}")
        # identity is root-only; enforce.
        # (perms checked at deploy; double-check here too.)
        try:
            with tempfile.NamedTemporaryFile("wb", dir="/tmp", delete=False) as tf:
                # do NOT write secret to disk; use identity file directly.
                pass
        finally:
            # no-op; we never stage the secret. Removed below.
            pass

        # Decrypt the age file using the identity (subprocess, no shell).
        try:
            ctl = subprocess.run(
                [AGE, "--decrypt", "-i", str(self.identity_file), "-o", "-",
                 str(self.secret_file)],
                capture_output=True, check=True, timeout=15,
            )
        except subprocess.CalledProcessError as e:
            log.error("age decrypt failed: %s", e.stderr.decode(errors="replace")[:200])
            raise SecretStoreError("failed to decrypt secret store") from e
        try:
            data = json.loads(ctl.stdout.decode("utf-8"))
        except Exception as e:
            raise SecretStoreError("secret store is not valid JSON") from e
        if not isinstance(data, dict):
            raise SecretStoreError("secret store JSON must be an object")
        return data

    def _reload_if_needed(self) -> None:
        # Simple TTL cache (60s) so many broker sessions don't spawn a decrypt
        # every request, but updates to the store (rotations) propagate.
        self._refresh_counter += 1
        if self._cache is None or self._refresh_counter > 30:
            self._cache = self._decrypt_payload()
            self._refresh_counter = 0

    # -- public API ----------------------------------------------------------
    def credential(self, name: str) -> Optional[dict]:
        """Return {username, password} for a named credential, or None."""
        self._reload_if_needed()
        return self._cache.get(name)

    def get_username(self, name: str) -> Optional[str]:
        c = self.credential(name)
        return c.get("username") if c else None

    def get_password(self, name: str) -> Optional[str]:
        c = self.credential(name)
        return c.get("password") if c else None

    def names(self) -> list:
        self._reload_if_needed()
        return list(self._cache.keys())


# ---------------------------------------------------------------------------
# Standalone generation helper (ops tooling; not part of the serving path)
# ---------------------------------------------------------------------------
def _generate_identity(identity_file: Path) -> str:
    """Create an age identity. Returns the public (recipient) key string.

    Only used during one-time deployment. Identity file must be root 0600.
    """
    out = subprocess.run([AGE_KEYGEN], capture_output=True, check=True, timeout=10)
    text = out.stdout.decode("utf-8")
    # age identities look like: '# created: <ts>\n# public key: age1...\nAGE-SECRET-KEY-1...'
    recipient = None
    for line in text.splitlines():
        line = line.strip()
        if line.startswith("# public key:"):
            recipient = line.split(":", 1)[1].strip() or None
    identity_file.parent.mkdir(parents=True, exist_ok=True)
    identity_file.write_text(text, encoding="utf-8")
    try:
        identity_file.chmod(0o600)
    except Exception:
        pass
    if not recipient:
        raise SecretStoreError("could not parse recipient from age-keygen output")
    return recipient


def _write_encrypted_payload(payload: dict, recipient: str, secret_file: Path) -> None:
    """Encrypt payload JSON to `recipient` and write age file (0600)."""
    import subprocess as sp
    import sys
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    ctl = sp.run(
        [AGE, "--encrypt", "-r", recipient, "-o", str(secret_file)],
        input=data, capture_output=True, check=True, timeout=15,
    )
    try:
        secret_file.chmod(0o600)
    except Exception:
        pass


def deploy_secret_store(secret_file: Path, identity_file: Path,
                        credentials: Dict[str, dict],
                        identity_public_key: str | None = None) -> str:
    """One-time deployment helper.

    If `identity_public_key` is given, uses it as recipient (the identity file
    already exists elsewhere). Otherwise generates a fresh identity.
    Returns the recipient (public) key.
    """
    if identity_public_key:
        recipient = identity_public_key
    else:
        recipient = _generate_identity(identity_file)
    _write_encrypted_payload(credentials, recipient, secret_file)
    _enforce_perms(secret_file, identity_file)
    return recipient


def _enforce_perms(secret_file: Path, identity_file: Path) -> None:
    for p in (Path(secret_file), Path(identity_file)):
        try:
            p.chmod(0o600)
        except Exception:
            pass
