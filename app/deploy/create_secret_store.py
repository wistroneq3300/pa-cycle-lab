# -*- coding: utf-8 -*-
"""One-time deployment helper for the root-only age-encrypted secret store.

Usage (run as root):
    sudo SPX_CRED='{"spx:bmc-internal-a:kvm-operator":{"username":"...","password":"..."}}' \
        python3 deploy/create_secret_store.py

Produces:
    /etc/portal/secrets/spx-bmc-credentials.age   (encrypted, 0600, root)
    /etc/portal/secrets/spx-bmc-identity.txt      (age identity, 0600, root)

The broker group (portal-svc) does NOT hold the identity key directly; instead
a small setgid/privexec shim is documented in the secret-store guide. For this
lab deployment the service may read the identity via group read on a root:portal-svc
identity (see docs). NEVER check secrets into git.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

# Allow running as script regardless of cwd
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from spx_kvm_broker.secret_store import deploy_secret_store  # noqa: E402

SECRET_FILE = Path(os.environ.get("SPX_SECRET_FILE",
                                  "/etc/portal/secrets/spx-bmc-credentials.age"))
IDENTITY_FILE = Path(os.environ.get("SPX_IDENTITY_FILE",
                                    "/etc/portal/secrets/spx-bmc-identity.txt"))


def main():
    raw = os.environ.get("SPX_CRED")
    if not raw:
        print("SPX_CRED env not set (JSON dict). abort.", file=sys.stderr)
        sys.exit(2)
    try:
        creds = json.loads(raw)
    except Exception as e:
        print(f"invalid SPX_CRED: {e}", file=sys.stderr)
        sys.exit(2)
    if not isinstance(creds, dict):
        print("SPX_CRED must be a JSON object", file=sys.stderr)
        sys.exit(2)
    recipient = deploy_secret_store(SECRET_FILE, IDENTITY_FILE, creds)
    print(f"OK secret store @ {SECRET_FILE}")
    print(f"OK age identity   @ {IDENTITY_FILE}")
    print(f"RECIPIENT(public) = {recipient}")
    print("Files are 0600 root. Keep them out of git/backups/logs.")


if __name__ == "__main__":
    main()
