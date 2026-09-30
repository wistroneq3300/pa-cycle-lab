#!/usr/bin/env python3
"""SessionStart hook: inject project iron rules + git state into every new
conversation on this repository (non-blocking context injection).
"""
import json
import os
import subprocess
import sys


def git_state(d):
    branch = "?"
    unpushed = ""
    try:
        out = subprocess.run(
            ["git", "-C", d, "status", "-sb"],
            capture_output=True, text=True, timeout=5,
        )
        if out.stdout.strip():
            branch = out.stdout.strip().splitlines()[0]
        out2 = subprocess.run(
            ["git", "-C", d, "log", "origin/main..HEAD", "--oneline"],
            capture_output=True, text=True, timeout=5,
        )
        unpushed = out2.stdout.strip()
    except Exception:
        pass
    return branch, unpushed


def main():
    d = os.environ.get("OPENHANDS_PROJECT_DIR", "")
    branch, unpushed = git_state(d)

    txt = (
        "Project iron rules for this repo (see .agents/skills/: pa-manager, pa-library-review):\n"
        "- file_editor is UNSAFE on files with CJK/emoji text (app.js, index.html, *.xlsx). "
        "Use terminal + python io.open(..., encoding='utf-8'); a PreToolUse hook enforces this.\n"
        "- git push requires the operator to EXPLICITLY say 'push' (a PreToolUse hook enforces "
        "this; prefix the approved command with OPERATOR_OK=1).\n"
        "- Test library single source of truth: data/REVISED_commands_merged_with_raw.xlsx -> "
        "scripts/build_testlib_json_xlsx.py -> tests.json. Back up the xlsx (.bak_...) before "
        "each batch edit.\n"
        "- Service: pa-manager on :6969 via systemd (pa-manager.service).\n"
        f"Current git: {branch}"
        + (f" | unpushed: {unpushed}" if unpushed else "")
        + "."
    )
    print(json.dumps({"additionalContext": txt}, ensure_ascii=False))
    sys.exit(0)


if __name__ == "__main__":
    main()
