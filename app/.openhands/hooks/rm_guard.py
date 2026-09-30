#!/usr/bin/env python3
"""PreToolUse guard: block destructive `rm -rf` on broad/root paths.

Allows precise deletions (e.g. `rm -rf /tmp/tests_new.json`), blocks broad ones
(empty target, `/`, `~`, `*`, `.`, `./`, anything starting with `/` `~` `*` `$`,
or containing `..`).

Reads the hook JSON payload on stdin; exits 0 (allow) or 2 (deny).
"""
import json
import re
import sys


SYSTEM_TOPS = {
    "", "/", "home", "root", "etc", "usr", "var", "srv", "opt", "lib",
    "bin", "sbin", "boot", "dev", "tmp", "media", "mnt", "proc", "sys",
}


def dangerous(target):
    t = target.strip().strip("'\"")
    if not t or t in ("/", "~", "*", ".", "./", ".."):
        return True
    if t.startswith("~") or "*" in t or ".." in t:
        return True
    if t.startswith("/"):
        parts = t.lstrip("/").split("/")
        if parts[0] in SYSTEM_TOPS and len(parts) == 1:
            return True
    return False


def main():
    try:
        payload = json.load(sys.stdin)
    except Exception:
        sys.exit(0)

    if payload.get("tool_name") != "terminal":
        sys.exit(0)

    cmd = str((payload.get("tool_input") or {}).get("command", ""))

    # tokenize on shell separators, inspect each rm command
    for part in re.split(r"[;&|]", cmd):
        tokens = part.strip().split()
        if len(tokens) < 2 or tokens[0] != "rm":
            continue
        flags = tokens[1] if tokens[1].startswith("-") else ""
        if "r" in flags and "f" in flags:
            target = tokens[2] if len(tokens) > 2 else ""
            if dangerous(target):
                out = {
                    "decision": "deny",
                    "reason": (
                        "rm -rf on a broad/root path is blocked for safety. Specify "
                        "an exact, non-broad target path."
                    ),
                }
                print(json.dumps(out))
                sys.exit(2)

    sys.exit(0)


if __name__ == "__main__":
    main()
