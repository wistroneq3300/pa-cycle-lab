#!/usr/bin/env python3
"""PreToolUse guard: block file_editor WRITE ops on files containing CJK/emoji.

Project iron rule: file_editor has corrupted such files before (mojibake / full-file
loss on app.js, index.html, *.xlsx). Edits must go through terminal + python
io.open(..., encoding="utf-8").

Reads the hook JSON payload on stdin; exits 0 (allow) or 2 (deny).
"""
import json
import re
import sys

CJK = re.compile(
    r"[\u3000-\u303f\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]"
)
EMOJI = re.compile(
    r"[\U0001F300-\U0001FAFF\u2190-\u21FF\u2600-\u27BF\u2B00-\u2BFF\uFE0F]"
)
WRITE = {"str_replace", "insert", "create", "undo_edit"}


def main():
    try:
        payload = json.load(sys.stdin)
    except Exception:
        sys.exit(0)  # cannot parse payload -> do not block

    if payload.get("tool_name") != "file_editor":
        sys.exit(0)

    ti = payload.get("tool_input") or {}
    cmd = ti.get("command") or ""
    path = ti.get("path") or ""

    if cmd not in WRITE or not path:
        sys.exit(0)

    try:
        text = open(path, "r", encoding="utf-8", errors="replace").read()
    except OSError:
        sys.exit(0)  # new file / unreadable -> cannot inspect, allow

    if CJK.search(text) or EMOJI.search(text):
        out = {
            "decision": "deny",
            "reason": (
                "file_editor is blocked on files with CJK/emoji text (project iron "
                "rule - it corrupted app.js/index.html before). Use a python script "
                "with io.open(..., encoding='utf-8') via terminal instead."
            ),
        }
        print(json.dumps(out))
        sys.exit(2)

    sys.exit(0)


if __name__ == "__main__":
    main()
