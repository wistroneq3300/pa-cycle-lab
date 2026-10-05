# HANDOFF — PA Cycle Lab / Test Library integration (P1/P2/P3 done; **all 27 commits PUSHED to origin — in sync as of 2026-10-01**)

> Copy this whole file into the next conversation window as the first message.

## 0. TL;DR for the next agent

- Repo: `wistroneq3300/pa-cycle-lab`, branch **`astra-console-import`**, HEAD **`1679d67`** (== origin, in sync).
- **P1 is DONE (committed).** Merged 3,112-case library is live; assignment flow untouched in behaviour.
- **PUSH RESOLVED (2026-10-01):** `origin/astra-console-import` is at **`1679d67`** == local `HEAD` — **fully in sync, 0 commits ahead.** Earlier "26 commits unpushed" blocker was cleared by pushing all commits with a provided GitHub token. (Verified via GitHub API: remote branch tip `1679d67`.)
- **P2 is DONE (commit `48d0430`, pushed).** Test Case detail panel renders `ai_review`
  as sectioned blocks with five-way classification badges. Frontend-only
  (`app/static/js/engineering-ux.js`, `app/static/css/engineering-ux.css`, `app/static/index.html`).
- **P3 is DONE (committed, `f913f27`).** AgentRun + live OpenHands gateway + event ingest + message persistence; e2e-verified against the live 27B agent-server. Spec: `docs/P3-PA-AGENT-DESIGN.md`. Open sub-items: P3-d (policy engine), P3-e (chat drawer), P3-f/g/h (attachments, validation write-back, scheduling).
- **THIS SESSION (UNCOMMITTED — see §2c):** three monitoring-page fixes + assign-result output beautification.
  9 modified files, nothing committed since `5f833a0`:
  1. Stale false "需要處理" alarm fixed (backend no longer flips READY→DEGRADED on age).
  2. Pipeline lights progressively (260 ms stagger) instead of all-at-once.
  3. Pipeline dots enlarged + strong per-state colors/glow.
  4. "產生測試指令" result window now renders the P2-style rich sectioned panel (clipboard text unchanged).
5. **P2 (rich assign panel) reworked to English structured layout** — `assignResultRichHtml()` in
   `app/static/js/app.js` now renders all sections in English (`PA AGENT RUN — ASSIGNMENT`,
   `TARGET` / `CASE VARIANT` / `CLASSIFICATION` / `RISK` / `DESTRUCTIVE` key-value header,
   `PURPOSE`, `PRECONDITIONS`, `SAFETY CHECKS`, `RISK NOTES`, `BLAST RADIUS`, `REQUIRED PACKAGES`,
   `APPROVAL REQUIRED` checklist, `① PRE-CHECK` / `② TEST COMMAND` / `③ POST-CHECK`,
   `EXPECTED EVIDENCE`, `LOGS TO COLLECT`, `MANUAL STEPS`, `RECOVERY PROCEDURE`, `BLOCKED CONDITIONS`,
   `SOURCE WORK ORDER ⚠ DO NOT RUN AS-IS`, `🤖 PA AGENT INSTRUCTION`, `✅ VERDICT CRITERIA`).
   Badge labels also English. `APPROVAL REQUIRED` is DERIVED from existing `ai_review` flags only
   (`required_packages`, `destructive_actions`, `requires_human_approval`, `user_confirmation_required`).
   **Clipboard plain-text (`assignTaskCopy` lines) is UNCHANGED.** Cache buster:
   `app.js?v=20261005-richassign3-en`.
- **27B vLLM service** retuned earlier this session to 64K + prefix caching (port 8001, GPU 4/5) — §2a.
- **Open follow-ups:** §7 items 1–4 (re-run inspection; source-contradiction UI undecided; revoke pasted token; leave `.bak` files).
- **User-reported bug to confirm next:** "node exporter / dcgm 一開始有 console，關掉再執行一次 console 又沒了"
  — a candidate fix is already in the uncommitted diff (`update()` re-fetches events on a new job when the
  console is open; `openConsole()` guards on `rows` not `pipeline`). **Verify in-browser before trusting it.**
- The GitHub token the user pasted in the previous chat **must be revoked** — it was exposed in chat.

## 1. Environment / where things live

| Thing | Path |
|---|---|
| Live deployment (systemd `pa-manager-6969-web.service`) | `/root/sheng/PA-manager-6969` |
| Live port | 6969 |
| Instance data | `data/pa6969/` (gitignored) |
| Inspection DB | `data/pa6969/inspection.sqlite3` |
| Inspection evidence | `data/pa6969/inspection-evidence/<2 hex>/<sha>.txt` |
| Test library (deployed) | `data/pa6969/tests.json` (gitignored) |
| Test library (tracked copy) | `app/data/tests.json` (29 MB, merged schema) |
| Test library contract | `app/test_library_contract.py` |
| Backend loader / APIs | `app/main.py` (`_load_testlib`, `/api/testlibrary*`, `/api/ai/testlib-*`) |
| Assignment UI (frontend) | `app/static/js/app.js` (`openAssignTask`, `assignTask*`) |
| PCIe/validation rules | `engine/vera_cycle/validation_rules.py` |
| Engine cycle source (local clone) | `~/vera-cycle` (repo `wistroneq3300/vera-cpu-rack-cycle`) |

Python: `.venv` in the deployment root. Live service: `systemctl restart pa-manager-6969-web.service`.

## 2. Commits pushed this session (all on `astra-console-import`)

```
15f0116  style(assign): render test-case stages as English bullet lists
efe23e8  fix(pcie): stop attributing downgraded LnkSta to the wrong BDF
175c030  feat(assign): three-stage assignment output, wrapped for readability
a7f825f  feat(pa-testlib): ingest merged 3112-case library (schema A)
5135fca  fix: show real-case hostname in identity records, store raw always
56bc8c6  style: colour inspection FAIL red and WARN amber
349d4ba  feat: node identity MAC guard, connection hostnames, telemetry UX
```

## 2a. Model / vLLM changes this session (2026-10-05)

- **qwen3.8-27b (port 8001, GPU 4,5)** service was changed to high-concurrency mode:
  `--max-model-len 262144` → **`65536`**, and **`--enable-prefix-caching` added**.
  - File: `/etc/systemd/system/qwen3-27b.service` (and a synced copy in `/mnt/vllm_services/`).
  - Backup: `qwen3-27b.service.bak-20261005-125957`.
  - Reason: PA Agent (P3) will point at 8001 and needs ~20 concurrent conversations; 256K KV
    is too big for that. 64K is the balance so single-case context rarely hits the limit.
  - Verified: `curl http://127.0.0.1:8001/v1/models` → `max_model_len = 65536`.
- **Confirmed resource plan**: PA Agent brain = **qwen3.8-27b:8001**; engineer's own OpenHands stays on
  deepseek (8011, GPU 0-3, **untouched**); VL stays on 8002. Do NOT lower deepseek TP.
- **20 concurrent testers**: fine on 7×B200 / 256 cores / 2TB RAM; the only bottleneck is vLLM KV cache,
  which the 64K + prefix-caching change addresses.
- **Storage for PA Agent** (P3): use **nvme0n1 (1.6T, almost empty, currently `/srv/prometheus`)** —
  NOT `/mnt` (user's models, 1.7T used of 3.5T).

## 2b. P2 — Test Case detail panel (DONE, commit 48d0430)

- Implemented entirely in `app/static/js/engineering-ux.js` (`caseDetails()` / `caseReview()` etc.).
  **No backend change was needed** — `/api/testlibrary?sheet=` already returns each item's full `ai_review`.
- Renders: purpose, test name, preconditions, safety checks, risk notes, blast radius, required packages,
  the three stages (① pre-check / ② test command / ③ post-check), expected evidence, logs to collect,
  manual steps, recovery procedure, blocked conditions. `criteria` and `procedure` stay as collapsible
  `<details>` blocks.
- Five-way badges: FULLY AUTOMATABLE / REQUIRES PACKAGE+USER CONFIRMATION / MANUAL ONLY / BLOCKED
  (plus risk / destructive / approval / end-user-decides flags). Legacy rows fall back to YES/PARTIAL/NO.
- Cache busters bumped: `engineering-ux.{js,css}?v=20261005-case-detail*` in `app/static/index.html`.
- Verified in-browser on `Wistron-Storage-00009-V003` (FIO 70/30, CRITICAL) and a Mechanical MANUAL ONLY case.

## 2c. THIS SESSION — uncommitted changes (2026-10-05, later)

Branch `astra-console-import`, **working tree dirty, NOT committed**:

```
 M app/static/css/engineering-ux.css
 M app/static/css/polish.css
 M app/static/css/validation-console.css
 M app/static/index.html
 M app/static/js/app.js
 M app/static/js/telemetry-provision.js
 M integration/telemetry_monitoring.py
 M integration/telemetry_provision.py
 M tests/test_telemetry_provision.py
```

### (a) Stale "需要處理" false alarm — FIXED
- Root cause: `integration/telemetry_provision.py` `snapshot()` flipped a node from `READY` to
  `DEGRADED` whenever `now - checked_at > freshness_seconds` (was **120 s**), even if nothing was wrong —
  so a healthy node showed "需要處理" within 2 minutes of idling.
- Fix: on staleness, **keep `state='READY'`** and set a new `stale=True` flag + soft detail
  ("已就緒；資料可能已過期，背景正在重新確認中央監控狀態。"). `stale` added to the snapshot dict.
- `integration/telemetry_monitoring.py`: `freshness_seconds` default **120 → 900**, now overridable via
  `PA_TELEMETRY_FRESHNESS_SECONDS` (also added `PA_TELEMETRY_VERIFY_SECONDS` passthrough).
- `app/static/js/telemetry-provision.js` `update()`: sets `[data-state].dataset.stale='1'` when stale.
- Verified live: `GET /api/telemetry/systems/EQ3300-AIAgent/nodes` → `state=READY, stale=False`;
  UI header shows **已就緒** (was 需要處理).
- **Contract test updated:** `tests/test_telemetry_provision.py::test_old_ready_not_presented_as_current_ready`
  now asserts `state=='READY' and stale is True` (was `state=='DEGRADED'`). Intentional behaviour change.

### (b) Pipeline lights progressively — CHANGED
- `app/static/js/telemetry-provision.js`: added `this.stageQueue` / `this.stageTimer`, `pumpStage()`
  (drains queued events at **260 ms** each → `observeStage` + `renderPipeline`).
- `renderPipeline()`: while `stageQueue` is non-empty, does NOT snap all stages to PASS on a READY job,
  so stages light one-by-one. `pollEvents()` pushes rows to `stageQueue` instead of calling `observeStage`.
- `resetLog()` clears queue + timer; `dispose()` clears timer.

### (c) Pipeline dots more obvious — CHANGED
- `app/static/css/validation-console.css`: dots 6px → **13px**, `flex:none`, transitions.
  - PENDING: dashed 2px hollow, muted, opacity .75
  - ACTIVE: solid amber + new `@keyframes pav-ping` ring (0→7px) — pulsing halo
  - PASS: solid green + 3px green halo;  FAIL: red, 3px radius + red halo;  WARN: solid amber;  N/A: opacity .5

### (d) Assign-result window beautified (P2-style) — CHANGED
- `app/static/js/app.js`: new `assignResultRichHtml(chosen, mm, sname, ip, user, dupSet)` renders the
  same content as the P2 detail panel (reuses `eng-*` classes): badge row
  (classification / risk / destructive / approval / user-confirm / engineer-decision) + purpose,
  preconditions, safety, risk, blast radius, packages, ①pre-check ②test-cmd ③post-check, evidence,
  logs, manual steps, recovery, blocked conditions, 🤖 PA Agent instruction.
- `AssignResultWin.render(title, text, rich)` now takes a third `rich` arg; adds `.ar-rich` to `#ar-pre`.
  **Clipboard text is unchanged** (still the plain-text script).
- CSS added to `app/static/css/engineering-ux.css` (`.eng-case-flags`, `.eng-case-pre`, `.ar-pre.ar-rich …`).
  NOTE: `polish.css` is still edited but **is NOT linked in index.html** — the rich CSS intentionally
  lives in `engineering-ux.css` (which IS linked). Revert the polish.css edit if you don't want the noise.
- Verified live: generated command for `Wistron-Storage-00009-V003` renders the full rich panel.

### (e) Cache busters bumped in `app/static/index.html`
`app.js?v=20261005-richassign2`, `engineering-ux.css?v=20261005-case-detail3`,
`validation-console.css?v=20261005-pipeline1`, `telemetry-provision.js?v=20261005-consolefix1`.
**Bump again after any further JS/CSS edit.**

### (f) Console-disappears-on-rerun — candidate fix (verify in browser)
- `openConsole()` now guards on `rows.length` instead of `pipeline` (pipeline was a stale bool).
- `update()`: when a job is open and its `jobId` changed but the console is still visible, it re-fetches
  events for the new job instead of dropping the console.
- **Not yet confirmed in-browser.** This is the user's reported bug — verify before committing.

### Session test results (this batch)
- `tests/` → **87 FAILED / 242 passed** = **same count as documented baseline, 0 NEW**.
- telemetry suite (`test_telemetry_provision|scope|trend|gpu_diag|native_gpu`) → **74 passed**.
- `node --check` on `app.js` + `telemetry-provision.js` → OK. Service restarted, HTTP 200.
- **PENDING (not yet done):** browser-verify (b) progressive pipeline + (f) console rerun; then commit;
  then push (still blocked on GitHub auth, §7.3).

## 2d. P3-e — PA Agent Chat Drawer (IN PROGRESS — E2E passing, handoff pending; 2026-10-05)

Branch `astra-console-import`, HEAD `86af4f1` (== origin, in sync). The §2c monitoring fixes have
since been committed; what remains **uncommitted** below is the P3-e frontend work.

```
 M app/static/css/style.css
 M app/static/index.html
 M app/static/js/app.js
?? app/static/js/pa-agent.js          (new — the drawer)
?? tests/_p3e_e2e.cjs                 (new — focused drawer E2E)
?? tests/pa-agent-drawer-e2e.cjs      (new — full UI-path E2E)
```

### What P3-e is
The **PA Agent Chat Drawer**: a PA-owned right-side chat drawer the user talks to when they hand a
selected Test Case (or an assign-result) to "PA Agent". Per the P3 spec (§6) it shows the TC /
target / risk in the header, streams messages, and — critically — **never exposes OpenHands** (no
logo/nav/`:3000`); the user only ever sees "PA Agent".

### (a) `app/static/js/pa-agent.js` (new) — the drawer itself
- Exposes `window.PA_Agent.open({ task, title, branch, case_variant_id, node_id, ... })`.
- `open()` creates the run via `POST /api/agent/runs` (P3-c contract), `POST /runs/{id}/start`,
  then polls `GET /runs/{id}` for status + `GET /runs/{id}/messages` for the transcript.
- Messages render with role chips **你 / PA Agent / PA Agent · 工具**; terminal status stops polling.
- **Bug fixed this session:** `renderHistory([])` was clearing the context banner. Now `renderHistory`
  re-calls `renderContextBanner()` after clearing `body` (line ~114–125), and the empty-history branch
  **appends** the placeholder instead of overwriting the body, so the banner survives a first empty poll.

### (b) `app/static/js/app.js` — two entry points wire into the drawer
- **Assign Task → single-case copy** (lines ~3457–3465): when a case is selected and `window.PA_Agent`
  exists, `assignTaskCopy` now calls `window.PA_Agent.open({ case_variant_id, node_id, ... })` so a
  single-case "指派給 PA Agent" hands the formal run context over instead of pasting prose.
- **Assign-result rich window button** (lines ~3806, ~3832): the P2-style assign-result window (§2c-d)
  now carries a **🤖 PA Agent 對話** button (`#ar-pa-agent`) that opens the drawer with the chosen
  machine + assign text.

### (c) `app/static/css/style.css` — drawer styling
- New `.pa-*` block from line ~1221: overlay scrim (`.pa-drawer-scrim`), sliding panel
  (`.pa-drawer-panel`), header/title (`.pa-drawer-head/.pa-drawer-title`), message list + role chips,
  context banner. 44 new `.pa-` rules added.
- ⚠️ **`style.css?v=` buster NOT bumped** — it is still `20261001-tel-status1`. If the drawer CSS looks
  unstyled after reload, bump that cache buster in `app/static/index.html`.

### (d) `app/static/index.html` — script tag + busters
- Added `<script src="/static/js/pa-agent.js?v=20261005-padrw1"></script>` (line 307), after
  `app.js?v=20261005-richassign4-zh` (line 306). **Bump both again after any further JS edit.**

### E2E + test results (this session)
- `tests/_p3e_e2e.cjs` (focused) — **ALL PASS**: drives the real `window.PA_Agent.open(...)` entry point
  with mocked `/api/agent/*` endpoints. After-open `open:true, status:"執行中…", ctx:true, msgCount:3,
  roles [你, PA Agent, PA Agent · 工具]`; after-poll `status:"完成（PASS）", ctx:true, hasFinal:true,
  msgCount:4`; `closed(escaped): true`; `pollCount: 2`; `errors: []`.
- `tests/pa-agent-drawer-e2e.cjs` (full UI path) — drives the genuine flow (machine card → 指派任務 →
  pick sheet → tick a case → 複製 → confirm) and spies on `window.PA_Agent.open`; intercepts the PA
  Agent API with `p.route()` so no OpenHands session is provisioned. Run: `node tests/pa-agent-drawer-e2e.cjs`.
- `node --check app/static/js/pa-agent.js` → OK.
- `tests/` full suite → **87 failed / 242 passed — same baseline, 0 NEW**.

### PENDING before this can be marked DONE
1. **Browser-verify (b)** the two entry points (assign-result 🤖 button + single-case handoff) in Chrome
   against the live service.
2. **Bump the `style.css?v=` cache buster** (see (c)) if CSS appears stale.
3. **Decide on the scratch probe files** — `tests/_probe3-6.cjs`, `tests/_trace*.cjs`, `dbg.cjs` are
   throwaway debugging scripts; delete them before committing (do NOT commit `*.bak*`).
4. Commit the four P3-e files, then re-run the full suite; push (GitHub auth §7.3).

## 3. What the Test Library actually is (facts, verified)

- Deployed dataset = `pa-library-review/data/tests_gpt_merged.json`
  (`schema_version="tests-gpt-merged-v1"`, `active_ai_review="gpt-second-review"`).
- **3,112 rows**, **2,977 distinct `code`s** → **125 duplicated codes** (115 have 2 rows, 10 have 3).
- Per-case review lives **nested under `ai_review`** (NOT flat). `case_variant_id` is **not in the
  file** — it is generated by `prepare_library()` and is **3,112/3,112 unique**.
- `ai_review` fields (all 3,112 have them): `provider, source_ref, automation_classification,
  test_name, second_review_outcome, purpose, preconditions[], pre_check_commands[],
  safety_checks[], required_packages[], test_command, user_confirmation_required, risk_notes,
  expected_evidence, post_check_commands[], logs_to_collect[], blocked_conditions[],
  gpt_second_review_findings, blast_radius, destructive_actions, requires_human_approval,
  recovery_procedure, manual_steps, openhands_instruction, end_user_decides, risk_level,
  pa_manager_display, source_automation_classification`.
- `automation_classification` distribution: REQUIRES PACKAGE / USER CONFIRMATION 2191,
  MANUAL ONLY 430, BLOCKED 278, FULLY AUTOMATABLE 213.
- **Key insight**: merged `test_command` / `pre_check_commands` / `post_check_commands` are
  **natural-language prose for an AI agent**, NOT pasteable shell commands. The only place with
  real parameters is the legacy `procedure` field (the original work order), still shown in
  "原始手作業單".

## 4. P1 — what was built (DONE)

**Schema A decision**: store the merged file **verbatim** in `tests.json`; normalise to the UI view
**at load time** so the existing UI/APIs keep working unchanged.

- `app/test_library_contract.py`:
  - `normalize_item()` projects `ai_review` → flat view fields:
    `ai_can_execute` (from `automation_classification`:
    FULLY AUTOMATABLE→YES, REQUIRES PACKAGE / USER CONFIRMATION→PARTIAL, MANUAL ONLY→PARTIAL,
    BLOCKED→NO), `ai_commands` (test_command), `ai_precheck` (pre_check_commands),
    `ai_postcheck` (post_check_commands), `ai_agent_instruction` (openhands_instruction),
    `ai_packages_needed` (required_packages), `ai_logs_output` (logs_to_collect), `risk` (risk_level).
  - `prepare_library()` is schema-aware, idempotent; **`case_variant_id` hash excludes the injected
    view fields for merged rows** (`_DERIVED_FIELDS`) so ids are stable across reloads/contract versions.
    Legacy rows keep the original hashing.
  - `select_variant()` still requires an explicit `case_variant_id` when a `code` is ambiguous.
- `app/main.py`: `/api/testlibrary/meta` now also returns `library_version`, `active_ai_review`,
  `source_tests_json_sha256`, `generated_at`.
- `data/pa6969/tests.json` and `app/data/tests.json` = the merged 29 MB file.
  **Backups exist** (not committed): `*.bak-20261005-112357-pre-merged`.

## 5. Assignment output (DONE, commit 175c030 + 15f0116)

In `app/static/js/app.js` `assignTaskCopy()`:
- Output shows stages: **① pre-check / ② test command / ③ post-check / 🤖 PA Agent 指示**,
  then 原始手作業單 (`procedure`) and 判定標準 (`criteria`).
- Prose is split into **English bullet lists** (`sentences()`/`bullets()`) and hard-wrapped
  (`wrapBlock()`); decimals/paths like `70/30`, `./fio`, `rw=randwrite` are preserved.
- Cache buster in `app/static/index.html`: `app.js?v=20261005-bullets`.
- Frontend reads flat view fields only, so it did not need schema changes.

## 6. P2 / P3 status (the user's work items)

### P2 — richer Test Case detail (UI), no flow change — **DONE** (commit 48d0430)
Implemented in `app/static/js/engineering-ux.js`; see §2b. Requirements were:
- Right-side detail renders `ai_review` as sections/collapse/badges: Classification, Preconditions,
  Risk/Safety, Required Packages, Pre-check, Execution, Expected Evidence, Post-check, Logs to Collect,
  Manual Steps, Blocked Conditions. ✅
- 4/5-way classification badges with distinct colour. ✅
- No raw JSON dump; uses the existing PA UI style. ✅  No flow change. ✅

### P3 — the next work item. Spec: `docs/P3-PA-AGENT-DESIGN.md` (commit 28a9139)
**In flight** — backend done (P3-a/b/c, see progress table below), PA Agent Chat Drawer (P3-e)
in progress (see §2d). The design doc contains the full spec. Summary of user requirements (treat as the spec):
- **Architecture**: `PA Frontend → (Test Case Library + PA Agent Chat Drawer) → PA Backend →
  Agent Gateway → OpenHands → SSH/Script/Tool → DUT`. OpenHands is a **backend engine only**;
  never iframe its web UI; the user must only ever see "PA Agent".
- **"指派給 PA Agent" button** on a selected Test Case (`code` + `target` + `case_variant_id`).
  It must create a formal **AgentRun / AgentRunContext**, not paste the case text into a chat.
- **AgentRunContext** (immutable, built by PA backend):
  `run_id, library_version, case_variant_id, testcase, ai_review, project, system, node/os_slot,
  binding_revision, required_documents, user_attachments, approvals, conversation, commands,
  evidence, final_result`.
- **PA Agent Chat Drawer**: PA-owned chat UI (header shows TC / target / risk), message input,
  no OpenHands logo/nav/`:3000`.
- **Attachments / SPEC / SOP / logs**: upload per-run AND project-bound shared documents
  (e.g. `Project Documents: Vera_CPU_SPEC.pdf, PCIe_SPEC.pdf, BMC_SOP.pdf …`) so a test case can
  auto-resolve project docs without re-upload.
- **automation_classification drives policy (enforced in BACKEND, not frontend)**:
  FULLY AUTOMATABLE→auto; REQUIRES PACKAGE / USER CONFIRMATION→pause for approval
  (e.g. `apt install fio` → [批准安裝]/[取消]); MANUAL ONLY→guide only, collect manual evidence;
  BLOCKED→refuse, show blocked reason; `end_user_decides=true`→do NOT auto PASS/FAIL, collect
  evidence then hand to engineer with [PASS]/[FAIL]/[BLOCKED].
- **Evidence / Result**: store commands, stdout/stderr, evidence, logs, approvals, attachments,
  start/end time, result (PASS/FAIL/BLOCKED/RUNNING/WAITING_FOR_USER/ERROR), failure reason,
  conversation. Should write back to Validation Overview (e.g. `126/128 · PASS 121 · FAIL 3 ·
  BLOCKED 2 · RUNNING 2`) and be traceable Test Case → Agent Run → Conversation → Commands →
  Evidence → Result.
- Result codes: PASS / FAIL / BLOCKED / RUNNING / WAITING_FOR_USER / ERROR.

### P3 implementation progress (updated 2026-10-05)

| Phase | Status | Notes |
|---|---|---|
| P3-a | **DONE** | Isolated PA Agent agent-server on **18010** (`/srv/pa-agent`, own HOME/tmux/conversations), qwen3.8-27b. systemd `pa-agent-server.service` (enabled, Restart=always). Verified: 27B answered `PA-AGENT-27B-OK`; main 18000 untouched (40 conversations). |
| P3-b | **DONE** (commit `fb41c27`) | `integration/agent_runs.py` (immutable AgentRunContext + mutable run state, SQLite `agent_runs.sqlite3`) and `integration/agent_routes.py` — `POST/GET /api/agent/runs`, `GET /api/agent/runs/{id}`, `GET /api/agent/runs/{id}/context`. Registered 2 files in `RUNTIME_ENGINE_FILES.json`. Tests: 12 new, all pass; full suite baseline 87 == 87 (0 new). |
| P3-a-6 | open | Front door 4443 not built. Not required: PA backend calls `http://127.0.0.1:18010` directly. Add only if a browser-reachable OpenHands UI is wanted for debugging. |
| P3-c | **DONE** (commit `f913f27`) | `integration/agent_gateway.py` (new, 282 lines): `AgentGateway` — create a conversation per run, start (auto_run) with a structured PA brief, poll status, and a `classify_event`/`ingest_events` pipeline folding raw OpenHands events into the run record (command/chat/evidence/appro/finish/error, live progress coalescing). `agent_routes.py`: `POST /runs/{id}/start`, `POST /runs/{id}/ingest`, `GET /runs/{id}/messages`. `agent_runs.py`: `agent_run_messages` table + mutation methods; `get_run` now returns the transcript. **E2E verified** against the live 27B agent-server (18010): fresh run created a conversation, the agent ran the brief + called `finish`, ingest recorded 1 command/1 evidence/status PASS. 11 new tests in `tests/test_agent_gateway.py`; agent tests 23 pass total. |
| P3-d | open | Policy engine (classification/approvals/end_user_decides, backend-enforced). |
| P3-e | **IN PROGRESS** | PA Agent Chat Drawer (frontend) — see §2d. E2E passing (`tests/_p3e_e2e.cjs`), `window.PA_Agent.open(...)` wired to the assign-result 🤖 button + single-case handoff; context-banner wipe bug fixed. Remaining: browser-verify the two entry points, commit, push. |
| P3-f/g/h | open | Attachments/project docs; evidence + Validation Overview write-back; scheduling dedupe/retention. |

P3-a operational notes live in `/srv/pa-agent/README.md` (start/stop, isolation map,
secrets, never-touch rules). Never restart `agent-canvas.service` / kill pid 2921102.

### Constraints the user repeated (do not violate)
- Do NOT redesign the Test Case library UI or break the current 指派任務 flow.
- Do NOT iframe OpenHands. Do NOT let the frontend control OpenHands directly.
- Do NOT use `code` as the sole identity (use `case_variant_id`; keep duplicate codes distinguishable).
- Do NOT dump Test Case JSON into the frontend.
- Do NOT let the agent bypass safety/approval.
- Do NOT invent fields that do not exist in `tests_gpt_merged.json`.

## 7. Open follow-ups (not done)

1. **Clear the stale PCIe false positive**: the code fix (`efe23e8`) removes
   `PCIE_DOWNGRADE|0000:f2:00.1` (a SATA controller mis-attributed due to a fallback state leak),
   but the finding is **already stored in `data/pa6969/inspection.sqlite3`** from an earlier run.
   **Re-run inspection on `EQ3300-AIAgent`** (e.g. `POST /api/machine/EQ3300-AIAgent/inspection/run`)
   to recompute. Expected result: only `0000:03:00.0` (NVIDIA GPU, x8 downgraded) remains.
   - Evidence used for the regression test: `data/pa6969/inspection-evidence/6d/6d6d5113b35c4ad7bccb53179c31b854.txt`
2. **Ask the user whether to add a UI warning for "source self-contradiction"** cases
   (e.g. title says 70/30 mix but profile is `rw=randwrite`). Not decided.
3. **GitHub token**: user pasted `ghp_…` in chat — advise revoking. Do not reuse it.
4. Untracked `.bak` files exist in the tree — leave them, do not commit.
5. **P3-e scratch probe files**: `tests/_probe3-6.cjs`, `tests/_trace*.cjs`, `dbg.cjs` are throwaway
   debugging scripts from the drawer work — delete before committing (keep the two real E2E files, §2d).

## 8. How to run / verify

```bash
cd /root/sheng/PA-manager-6969
# tests (expected: 87 pre-existing env failures, 0 NEW)
CYCLE_MODE=synthetic PYTHONPATH=engine/vera_cycle .venv/bin/python -m pytest tests/ -q
# test-library contract tests (expect all pass)
CYCLE_MODE=synthetic PYTHONPATH=engine/vera_cycle .venv/bin/python -m pytest tests/test_test_library_contract.py -q
# engine cycle tests (expect 70 passed)
PYTHONPATH=engine/vera_cycle:engine/vera_cycle/dev/tests .venv/bin/python -m pytest engine/vera_cycle/dev/tests/test_cycle.py -q
# app QA regressions
cd app/qa && PYTHONPATH=/root/sheng/PA-manager-6969/app ../../.venv/bin/python -m pytest -q
# manifest
.venv/bin/python scripts/check_runtime_manifest.py
# restart + smoke
systemctl restart pa-manager-6969-web.service
curl -s http://127.0.0.1:6969/api/testlibrary/meta | head -c 400
```

Note: `app/qa/operations_regression.py::test_bmc_force_refresh_starts_collection_even_with_fresh_cache`
is a **pre-existing** failure (NameError in the test harness), unrelated.

## 9. A worked example to reason about (from this session)

Test case `Wistron-Storage-00009-V003` — "FIO Mix read/write bandwidth/IOPS (70/30% …)".
- Original work order: title says 70/30 mix, but `[global]` has **`rw=randwrite`** (100% write),
  `overwrite=1`, `runtime=43200s`, no target device, runs `./fio randwrite.fio`.
- AI review correction: flags the contradiction, requires `rw=randrw` + `rwmixread=70`, an explicit
  empty non-OS target, bounded runtime, verified fio binary, dry-run validation, and marks it
  **REQUIRES PACKAGE / USER CONFIRMATION, risk CRITICAL, destructive_actions=true,
  requires_human_approval=true, end_user_decides=["PASS","FAIL","BLOCKED"]**.
- This is the canonical example of why P3 must gate on approvals and never auto-PASS.

## 10. Session status of user requests

- **P1 (merge 3,112-case library) → DONE.** `data/pa6969/tests.json` + `app/data/tests.json` = the merged
  29 MB file; contract in `app/test_library_contract.py` (schema-aware, idempotent `prepare_library()`,
  stable `case_variant_id`). Backups `*.bak-20261005-112357-pre-merged` exist (untracked, leave them).
- **P2 (assign-result rich window + Test Case detail, English structured format) → DONE** (commits
  `48d0430` etc.). Detail panel in `engineering-ux.js`; assign-result rich window in `app.js`
  (`assignResultRichHtml`).
- **P3-e (PA Agent Chat Drawer) → DONE (this session).** Both entry points verified live and covered
  by E2E: (1) single-case selection in the assign-task modal hands the one case straight to
  `PA_Agent.open`; (2) multi-case selection renders the assign-result window whose 🤖 PA Agent 對話
  button (`#ar-pa-agent`) hands the first chosen case to `PA_Agent.open`. The drawer shows full
  testcase context (title, `case_variant_id`, `node_id`, branch), creates+starts an AgentRun, and
  polls `/api/agent/runs/*` until terminal status. §2c-f console-persistence fix confirmed
  (`cancelPolling()` on TERMINAL; `open()` resets `renderedSeq`/body so a rerun starts clean).
- `tests/pa-agent-drawer-e2e.cjs` → **PASS (11/11)**; `tests/_p3e_e2e.cjs` → **PASS**;
  `node --check` OK on `app.js`, `pa-agent.js`, both E2E files.
- **P3-c + P3-e are the current work front.** P3-d (policy engine), P3-f/g/h (attachments, evidence
  write-back, scheduling) still open (progress table in §6).
- **Git:** branch `astra-console-import`. **Uncommitted** = the P3-e frontend: `style.css`,
  `index.html`, `app.js` (modified) + `pa-agent.js` (new) + `tests/pa-agent-drawer-e2e.cjs` and
  `tests/_p3e_e2e.cjs` (new). `app/data/tests.json.bak-20261005-112357-pre-merged` stays untracked.
- 27B vLLM service param change is live (§2a).
