#!/usr/bin/env python3
"""PreToolUse guard: block `git push` until the operator explicitly approves.

Project iron rule: commit/push ONLY on operator instruction. When the operator has
clearly said "push", the agent re-runs the same command prefixed with OPERATOR_OK=1
(an env assignment, harmless to git) to satisfy the guard.

Reads the hook JSON payload on stdin; exits 0 (allow) or 2 (deny).
"""
import json
import re
import sys

PUSH_RE = re.compile(r"(^|[;&|\s])git\s+push(\s|$)")


def main():
    try:
        payload = json.load(sys.stdin)
    except Exception:
        sys.exit(0)

    if payload.get("tool_name") != "terminal":
        sys.exit(0)

    cmd = str((payload.get("tool_input") or {}).get("command", ""))

    if "OPERATOR_OK=1" in cmd:
        sys.exit(0)  # explicitly approved by operator

    if PUSH_RE.search(cmd):
        out = {
            "decision": "deny",
            "reason": (
                "git push is blocked until the operator explicitly says to push "
                "(project iron rule). Once approved, re-run as: "
                "OPERATOR_OK=1 <same git push command>"
            ),
        }
        print(json.dumps(out))
        sys.exit(2)

    sys.exit(0)


if __name__ == "__main__":
    main()
