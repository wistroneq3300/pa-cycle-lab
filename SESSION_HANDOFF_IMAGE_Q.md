# SESSION HANDOFF — Image-question + attachment UX fixes (PA Agent)

> 換對話視窗時，把這個檔案「整份」貼成第一則訊息即可。
> Path: `/root/sheng/PA-manager-6969/SESSION_HANDOFF_IMAGE_Q.md`

## 0. TL;DR for the next agent

- Repo: `/root/sheng/PA-manager-6969` = `github.com/wistroneq3300/pa-cycle-lab`
- Branch: **`codex/platform-premium-ui-v1`** (NOT the `astra-console-import` branch that the older `HANDOFF.md` describes — ignore that file for this work)
- Service: port **6969**, systemd unit **`pa-manager-6969-web.service`**
  - env: `CYCLE_INSTANCE=data/pa6969`, `CYCLE_MODE=live`, `PA_AGENT_VISION_ENABLED=true`
  - restart: `systemctl restart pa-manager-6969-web.service`
  - health: `curl -s -o /dev/null -w '%{http_code}' http://localhost:6969/api/projects` → expect `200`
- **Status: code changes DONE, NOT committed yet.** User (Chinese-speaking) is testing via the UI themselves.
- User's requirement phrase: **"全GO"** (approve all / just do it). Behaviour target: **"just like OpenHands"**.
- **Hard constraint: delete must NOT remove DUT logs.**

## 1. What this session changed (the 3 fixes)

Goal: when the engineer uploads an image and asks a question, the experience must match the
OpenHands chat UI. Three concrete problems were fixed:

### Fix A — an image question must be sent only after the run settles
Problem: a question ("看的到圖嗎?") sent while the agent was still mid-turn (writing the entry
plan) got folded into that turn, and the plan answered instead of the question. Also,
`ask_agent` drops images, so an image question can only ride the **message endpoint**.

Implementation — `integration/agent_routes.py`:
- New helper `_ask_with_images_loop(store, gateway, run_id, text, images, *, max_iters=None)`.
  - Waits until `run["status"] != "RUNNING"` (bounded by `_SYNC_MAX_ITERS`, sleeping `_SYNC_INTERVAL`)
    so the picture is not absorbed by an in-flight turn.
  - Then `gateway.send_user_message(run_id, text, attachments=images)`.
  - Then `_sync_messages_loop(...)` to collect the reply.
- The non-approval send block builds `turn_atts = store.list_unconsumed_attachments(run_id)`,
  persists the user message with `turn_atts`, and if any are images dispatches the turn through
  `_ask_with_images_loop` instead of the plain ask path.

### Fix B — each bubble shows only ITS OWN attachments (no repeats)
Problem: every message bubble re-rendered the run's whole attachment list, so the same image
appeared on every turn, and the agent re-read the same picture on every question.

Implementation:
- `integration/agent_runs.py`: new `list_unconsumed_attachments(run_id)` — returns attachments whose
  `attachment_id` is NOT referenced by any `agent_run_messages.attachments_json`. First send after an
  upload "claims" it; later turns do not. `status='failed'` uploads are excluded.
- `integration/agent_routes.py`: sends use `turn_atts` (this turn's new uploads) for both the
  `has_image`/image-part decision and the persisted message.
- `integration/agent_gateway.py`: `_image_parts(run, attachments=None)` — when `attachments` is given
  it embeds ONLY those; when omitted (execution turns) it falls back to all run attachments.
- `app/static/js/pa-agent.js`: `sendMessage()` optimistic bubble is built from **`state.uploads`**
  (this turn only), and `state.uploads` is cleared after a successful send
  (`state.uploads = []; renderAttachmentStrip(state._attachments);`).

### Fix C — remove the "已上傳" status label
- `app/static/js/pa-agent.js` `renderAttachmentStrip()`: a `ready` attachment now renders **no**
  status text (only `IMG/FILE + name + size + ✕`). Status labels remain only for transient/problem
  states: `上傳中 / 上傳失敗(+重試) / 無法解析 / 模型不支援圖片解析`.
- NOTE: one `已上傳` string still exists in the JS but it is inside an `addError(...)` diagnostic
  ("附件已上傳，但清單同步失敗…"), shown only if the post-upload list-sync request itself fails.
  This is intentional and is NOT a status chip. Leave it.

## 2. Files touched this session

| File | Change |
|---|---|
| `integration/agent_gateway.py` | added `send_user_message(run_id, text, attachments=None)` + `_MESSAGE_ENDPOINT` env; `_image_parts(run, attachments=None)` |
| `integration/agent_routes.py` | added `_ask_with_images_loop`; send block uses `turn_atts`/`list_unconsumed_attachments` |
| `integration/agent_runs.py` | added `list_unconsumed_attachments(run_id)` |
| `app/static/js/pa-agent.js` | optimistic bubble uses `state.uploads` only; clear uploads after send; strip drops `已上傳` for ready |
| `app/static/index.html` | cache busters bumped: `style.css?v=20261008-premium-ui8`, `pa-agent.js?v=20261008-agent-fixes5` |
| `tests/test_pa_agent_fixes.py`, `tests/test_agent_routes.py` | tests for the above |

Also modified in the working tree (earlier UI work, not part of these 3 fixes):
`app/static/css/engineering-ux.css`, `hero-callouts.css`, `style.css`, `workspace-cinematic.css`.
Untracked: `e2e_vl_test.py`.

## 3. Verification already done

- `node --check app/static/js/pa-agent.js` → ok
- `python -c "ast.parse(...)"` on the 3 py files → ok
- `pytest tests/test_pa_agent_fixes.py tests/test_agent_routes.py tests/test_agent_gateway.py tests/test_agent_runs.py -q`
  → **96 passed**
- Live store-level check of `list_unconsumed_attachments`:
  upload one → `['one.png']`; send → `[]`; upload two → `['two.png']`; send claims only `['two.png']`;
  plain follow-up → `[]`; failed upload excluded. ✅
- `delete_run(run_id)` only deletes rows from `agent_run_messages / supplemental / ingested_events /
  attachments / state / runs` — **no filesystem/rmtree, DUT logs untouched.** ✅
- Service restarted, `systemctl is-active` = active, `/api/projects` = 200, `/` = 200.
- Served JS confirmed to contain the new logic (`state.uploads` optimistic + clear-after-send).

## 4. NOT yet done / open items

- **No commit made.** Everything is uncommitted on `codex/platform-premium-ui-v1`.
  Working tree also has unrelated CSS + the old HANDOFF-era edits staged in the same branch.
- **Browser tool failed to start a session** in this environment, so the visual check was done by
  comparing the user's OpenHands screenshot against the served JS/DOM structure, not a live render.
  User is doing the UI pass themselves.
- If user reports any remaining mismatch (spacing, thumbnail shape, send-button style), it will be a
  CSS/JS polish in `pa-agent.js` `attachmentChips()` / `renderAttachmentStrip()` and `style.css`.

## 5. Quick commands for the next agent

```bash
cd /root/sheng/PA-manager-6969
git --no-pager status -s
git --no-pager diff --stat
systemctl restart pa-manager-6969-web.service && sleep 8 && systemctl is-active pa-manager-6969-web.service
.venv/bin/python -m pytest tests/test_pa_agent_fixes.py tests/test_agent_routes.py tests/test_agent_gateway.py tests/test_agent_runs.py -q
```

## 6. Reusable context from this session

- OpenHands reference (user's screenshot): image thumbnails render **inside the message bubble**,
  clickable to open the original, **no "uploaded" status text**, flat rounded bubbles (~8px),
  circular send button with an up-arrow.
- User language: Traditional Chinese. Reply in Chinese. "全GO" = proceed without asking.
- Keep the delete-doesn't-touch-DUT-logs constraint in mind for any retention/cleanup change.
