# OpenHands Hooks for pa_server_manager

These hooks enforce this repo's iron rules across **every conversation** that works
on this repository (Cloud / CLI / local GUI). They are loaded automatically at
conversation start from `.openhands/hooks.json`.

## Registered hooks

| File | Event / matcher | Behavior |
|---|---|---|
| `cjk_guard.py` | `PreToolUse` / `file_editor` | **Deny** `str_replace`, `insert`, `create`, `undo_edit` on files containing CJK/emoji text. Forces the python `io.open(..., encoding='utf-8')` path. |
| `push_guard.py` | `PreToolUse` / `terminal` | **Deny** `git push` unless the operator explicitly approves. Escape hatch: prefix the command with `OPERATOR_OK=1`. |
| `rm_guard.py` | `PreToolUse` / `terminal` | **Deny** destructive `rm -rf` on broad/root paths (empty, `/`, `~`, `*`, `.`, `..`, or paths starting with `/ ~ * $`). |
| `session_start.py` | `SessionStart` | Injects the iron rules + current git state into every new conversation. |

## Hook protocol (OpenHands)

- Payload JSON arrives on **stdin**.
- Exit code: `0` = allow, `2` = deny (block).
- Optional JSON on stdout: `{"decision": "allow|deny", "reason": "..."}` overrides
  the exit code and gives the UI a human-readable reason.

See https://docs.openhands.dev/openhands/usage/customization/hooks

## Testing

Each script can be tested standalone by piping a fake payload:

```bash
echo '{"tool_name":"file_editor","tool_input":{"command":"str_replace","path":"static/js/app.js"}}' \
  | .openhands/hooks/cjk_guard.py ; echo "exit=$?"
```
