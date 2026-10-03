# Native Next × Vera acceptance — 2026-10-01

## 2026-10-03 Shared Validation / independent inspection / Identity Auto Sync

Current round is documented separately in [SHARED_VALIDATION_ACCEPTANCE.md](SHARED_VALIDATION_ACCEPTANCE.md), based on `d6fa3af`. It includes paired baseline/current test IDs, actual process fault tests, production UI connected to isolated service/fake transport, A/B/C/D videos and 1366/1920 light/dark captures. See [SHARED_VALIDATION.md](SHARED_VALIDATION.md) and [IDENTITY_AUTO_SYNC.md](IDENTITY_AUTO_SYNC.md) for maintenance and source ownership. The older totals and retained-lock descriptions below are historical; this branch's pre-existing disabled reservation behavior was preserved. No deployment or real hardware acceptance is claimed.

## 2026-10-03 UI compatibility on `cycle/live-neutrino-redfish-hostname`

Baseline `1a51f2a`; earlier UI branch was not merged. Runtime diff limited to `app/static/js/cycle-workspace.js`, `app/static/css/cycle-workspace.css` and two cache-busters in `app/static/index.html`.

Run `node tests/cycle-ui-compat-browser.cjs` with `PLAYWRIGHT_MODULE` pointing at installed Playwright and `PA_CYCLE_BASE_URL=http://127.0.0.1:9188`. This requires the isolated synthetic preview with inventory and a completed synthetic job; the test first verifies synthetic capabilities. It serves this branch's real HTML/static files, compares the baseline and current workspace, and intercepts every mutation. Existing synthetic GET responses supply fixtures. This is browser/UI contract acceptance, **not a new backend or hardware run**.

Checks: loop/hour payload parity; no implicit defaults; invalid input sends no create; explicit node selection survives search; confirm version/targets unchanged; stop unchanged; deletion cancellation sends nothing and approval sends the same DELETE; Summary/Full remains functional with unchanged Console source; hidden Profile and absence of parallel control retained; keyed details/focus survive polling; all secondary counters retained; artifact link count unchanged and search works; four desktop/theme screenshots and reduced-motion.

Before implementation the new summary assertion failed on the old UI. Visual verification also caught reduced-motion handling of console pseudo-elements; scoped CSS was extended. Screenshot captures explicitly reset scroll to avoid fixed-header artifacts in full-page captures.

Final result: **1 browser comparison workflow PASS / 0 FAIL / 0 SKIP** (multiple assertions, not counted as separate tests). JavaScript syntax and whitespace checks PASS. Eight current-branch screenshots captured; creation light and run dark inspected directly. No previous-branch PASS totals are reused here.

`git diff --exit-code 1a51f2a -- integration engine app/main.py app/static/js/cycle-console.js` verifies no backend, engine or Console logic change. No full Python/Vera suite, live provider, Linux/systemd or hardware acceptance is claimed in this UI-only round. Earlier test totals are historical and are not added to this round.

## Platform regression round — local/offline acceptance

Base bb6f22c1795a79557e55b39650d859c26400b568; local changes only. The prior delivery table below must not be used as current acceptance.

- Full integration suite: **137 PASS / 0 FAIL / 0 SKIP**, `data/platform-integration-verified.txt` (361.664 seconds). Subsequent user-requested multiuser tests: **3 new PASS**, `data/platform-multiuser-verified.txt`; reported separately, not a claimed 140-test full run. No backend changes after the full run.
- Next Python QA: **109 PASS / 0 FAIL / 0 SKIP**, `data/platform-next-final.txt`. Broker: **53 PASS / 0 FAIL / 0 SKIP**, two inherited warnings, `data/platform-broker-final.txt`.
- Vera: **101 PASS / 0 FAIL / 14 SKIP**, 115 discovered, `data/platform-vera-final.txt`. Skips remain 13 Bash fixtures and one Linux/root cross-UID case; no substitute shell used to declare these passed.
- Four Next JavaScript suites passed: Terminal security, Terminal lifecycle, operations, equipment. Real WebSocket Terminal/KVM hard-Web-death plus separate fake bridge hard-death are three tests included in the full integration total; they use real ASGI/server processes, not real DUTs.
- Process lifecycle PASS, `data/platform-process-release.txt`: Web and scheduler PIDs changed, Worker PID unchanged, Console history/cursor retained, stopped INCOMPLETE after two rounds. Crash injections **4 PASS**, `data/platform-crash-release.txt`: before intent zero dispatch, during command/after response/during POST one dispatch each; RECONCILIATION_REQUIRED and reservations retained.
- Native Edge/Playwright flow PASS, `data/platform-native-browser-final.txt`: 128-node selection, one chassis/four nodes, two rounds/eight valid cycles, PRE/confirm, Console and navigation. Console load/reconnect/copy/download PASS, `data/platform-console-final.txt`; 10,500+ fixture with 3000 buffer/2000 rendered. Cycle long-name/blocked/empty/error/theme states PASS, `data/platform-ui-states-final.txt`.
- New tests reproduce wrong-node/stale edits, credential binding versions, guarded enrollment, real background thread/pool actor propagation, historical health, fair hour admission, SQL pagination, artifact hash reuse/direct lookup, original PA project filtering and actual Copilot tool scope.
- `tests/platform-*-browser.cjs` check real DOM/request paths for manual request identity, text-safe Copilot, stable Project links, keyed run focus, sparse/single-node edit and theme retention. They use an isolated synthetic loopback preview and bottom-layer mocks where stated.
- `tests/platform-captures.cjs`: 40 screenshots in `docs/screenshots/platform-regression/`; dashboard, Projects, Rack, six Chassis tabs and node edit at both sizes/light-dark. `capture-results.json` records 36 principal views with no page errors or document overflow. Visual inspection also moved Cycle below general task assignment, made its button secondary, corrected AUX/AC language and distinguished unconfigured/unobserved BMC. Representative coverage, not every plugin or hardware session visual acceptance.
- Latest selection UI: one Cycle entry per context, then explicit checkboxes; no nodes selected by default for chassis entry. Single/all/subset and search preservation pass in `tests/platform-selection-browser.cjs`. Two callers on independent nodes each reserve their own run; same-node race produces one CREATED reservation and one persisted BLOCKED attempt; shared-controller nodes also block. BLOCKED requests are audit records, not submitted power actions.
- Migration preview: 32 chassis/128 synthetic nodes, idempotent, input unchanged (`data/platform-migration-verified.json`). Synthetic confirmed mapping is fixture data, not physical validation.
- Before-fix failures are retained in `data/platform-permissions-before.txt`, `data/platform-metadata-before.txt`, `data/platform-metadata-binding-before.txt`. An actual Copilot route initially hung because the broad POST inventory lock waited on its observation pool; transaction wrapping is now restricted to local mutation routes. It is not a Store.tx re-entry deadlock.
- Additional failures were not erased: the actual proxy test exposed missing Path import; a no-profile-snapshot worker failed with UnboundLocalError (`data/platform-legacy-profile-before.txt`), then passed after removal of the shadowing import (`data/platform-legacy-profile-after.txt`). First crash rerun timed out because of that worker error (`data/platform-crash-final.txt`); corrected rerun passes. A 137-test run had one hash-fixture error after adding run.py to the manifest (`data/platform-integration-release.txt`); fixture now includes and tests the entry point, and the full 137 rerun passes. Initial multiuser assertions incorrectly expected HTTP 409; the existing native contract persists HTTP 200/BLOCKED audit records. Tests now verify state, single lock owner and zero actions rather than removing that contract.
- No current Linux/systemd/provider deployment or live hardware acceptance. User-reported N2/N3 GPIO instability is deferred, with evidence and hardware FAIL semantics retained.


This section records the current native integration. Everything below the historical separator belongs to earlier lab deliveries and is not evidence for this build. All new execution used synthetic endpoints, fake transports and temporary storage. No real SSH/IPMI/power/AUX/package installation, field service restart or production database access was performed.

## Previous delivery execution record (not this regression round)

| Check | Result | Local evidence |
|---|---|---|
| Full integration/unit suite | 99 full-suite PASS / 0 FAIL / 0 SKIP; final port change: 4 targeted PASS (1 new + 3 reruns), 100 distinct integration cases | `data/native-final-99.log`, `data/native-port-routes.log` |
| Next inherited QA | 109 PASS / 0 FAIL / 0 SKIP | `data/next-port-release.log` |
| Vera regression | 101 PASS / 0 FAIL / 14 SKIP, 115 discovered | `data/vera-final3.log` |
| Inherited broker/pytest fixtures | 53 PASS / 0 FAIL / 0 SKIP | `data/native-legacy-final.log` |
| Next JavaScript regressions | 4 suites PASS: Terminal security/lifecycle, operations, equipment | `app/qa/*_regression.cjs` |
| Actual separate Web/scheduler/worker lifecycle | PASS; Web and scheduler PID changed, same worker; persistent Console cursor; stopped INCOMPLETE | `data/native-process-release.log` |
| Actual process crash injections | 4 PASS / 0 FAIL: before intent, during dispatch, after response, during POST; retained reservations and no replay | `data/native-crash-release.log` |
| Native Edge/Playwright route flow | PASS: 128 targets, one chassis/four nodes, PRE-confirm, 8 valid cycles, console/reload/back/dispose | `data/native-browser-release.log` |
| Desktop states and theme captures | PASS: 1366×768 / 1920×1080, light/dark, long names, blocked/empty/error/retry, keyboard focus after polling | `data/native-ui-release.log` |
| Long Console and reconnect | PASS: 10,500+ event fixture, 3000 buffer/2000 rendered, cursor incremental/history, late response, text safety, filters, no job mutation | `data/native-console-release.log` |
| Contrast | Light placeholder 6.19:1; dark 9.23:1; severity labels retained | `data/console-browser-results.json` |
| Migration preview | 32 chassis/128 nodes idempotent; legacy two nodes both remain mapping-needs-confirmation; input unchanged | `data/native-migration-preview.json`, `data/native-legacy-migration-preview.json` |
| Syntax/whitespace | 119 first-party Python files parsed, 6 changed JS entry points checked; diff whitespace checked | inherited offline builder escape warnings noted, not hardware tests |
| Independent UI review / documentation | ship / documented; all four original findings resolved; 3 raster assets byte-identical to pinned Next | `.impeccable/native-documentation-review.md`, DESIGN.md |

The full integration tests include route-level create-vs-binding edit serialization, idempotency, active selection, strict power boolean, shared scope and SEL collection, per-target credentials/ports, script/identity/boot blockers, response-lost ambiguity, evidence persistence fault injection, artifact traversal/symlink exclusion, nested secret redaction, and 128-node queued stop. Shared four-node/two-round fake power yields two domain actions and eight node POST records. Independent four-node/two-round reboot yields eight actions and eight POST records. These are not hardware acceptance.

## Commands and harness notes

Run from the repository root with `PYTHONUTF8=1`:

```powershell
.venv/Scripts/python.exe -m unittest discover -s tests -p 'test_*.py'
.venv/Scripts/python.exe -m unittest discover -s app/qa -p '*_regression.py'
$env:PYTHONPATH='engine/vera_cycle'
.venv/Scripts/python.exe -m unittest discover -s engine/vera_cycle/dev/tests -p 'test_*.py'
.venv/Scripts/python.exe tests/legacy_smoke.py
.venv/Scripts/python.exe tests/process_smoke.py
.venv/Scripts/python.exe tests/native_crash_smoke.py
```

For Node QA use `app` as cwd, then run `node qa/terminal_security_regression.cjs`, `terminal_lifecycle_regression.cjs`, `operations_regression.cjs`, `equipment_regression.cjs`. Playwright uses a local Edge and the isolated 32×4 demo described in README: `node tests/native-browser.cjs`, `node tests/native-ui-states.cjs`, `node tests/native-console-smoke.cjs`. Set `PLAYWRIGHT_MODULE` when Playwright is provided from a shared runtime. Tests do not contact devices. Copied AST-based Next tests remain supplementary: actual ASGI/worker/browser tests establish this integration's contracts.

Failed development runs are retained locally, not relabeled as passing: the initial 128-target test's 10-second post-confirm wait expired during START collection, so it now waits for the actual dispatch signal (bounded 180 seconds). A late fixture-order failure was fixed by publishing synthetic fixture inventory through `_save_data`, as real API writes do. A Vera rerun initially omitted PYTHONPATH and could not import the engine; the correct command above passed. One Next QA rerun encountered Windows/OneDrive `PermissionError` on atomic replace, correctly failed closed; the subsequent unmodified rerun passed all 109. No safety check was removed to make these pass.

## Remaining acceptance gates

The 14 Vera skips are 13 Bash script fixtures (Bash absent on this Windows host) and one Linux/root cross-UID test. Run them on a prepared Linux controller. Real systemd KillMode=process, controller reboot, service account/artifact/credential permissions and field storage faults remain unverified. Actual process tests here ran on Windows; mocked disk-full/read-only tests do not establish Linux deployment acceptance.

No live authentication/credential/identity provider is installed. Shared live power/AUX selector and physical mappings remain blocked pending platform evidence. Legacy per-machine telemetry is not reinterpreted as four-node history. No company SSO, production deployment, hardware PASS or full rack qualification is claimed. See [native integration guide](NATIVE_INTEGRATION.md) for the four-node field gate.

## Desktop screenshots

[Light wizard](screenshots/native-cycle/wizard-1366-light.png) · [Dark wizard](screenshots/native-cycle/wizard-1920-dark.png) · [Light run](screenshots/native-cycle/run-1366-light.png) · [Dark run](screenshots/native-cycle/run-1920-dark.png). All screenshots are synthetic.

---

# Historical lab acceptance — retained verbatim below

# Neutrino V1 acceptance — 2026-10-01

This is an **offline local delivery**. No SSH/IPMI/power/AUX/package installation
was sent to a real machine. All cycle execution evidence is SYNTHETIC.

## Executed checks

| Check | Result |
| --- | --- |
| Integration unittest suite | 20 PASS |
| Copied Vera regression suite | 115 discovered: 101 PASS, 14 SKIP, zero failures |
| Actual process lifecycle smoke | PASS: Web PID changed, worker PID unchanged, reconnect RUNNING, stop after both nodes completed round 3 |
| Edge / Playwright flow | PASS: project entry, fixed checkbox selection through search, PRE approval, two-node/two-round completion, reports, reload, Escape |
| UI regression fixes | PASS: stale artifact response discarded on job switch, old links cleared, keyboard history focus survives polling |
| Viewports | 1440×1000 desktop; 390×844 mobile with local table scrolling; dark theme capture |
| Impeccable detector | No findings (`[]`); reviewer separately identified and verified fixes for interaction and contrast |

The 14 skips are 13 Bash hardware-script fixture tests (no Bash installed on this
Windows host) and one Linux-root cross-UID lock test. They are not claimed as passes.
Run those on a prepared Linux controller before live acceptance.

Local detailed evidence: `data/integration-test.log`, `data/engine-test.log`,
`data/process-smoke-results.json`, `data/browser-results.json`, `.impeccable/review/`.
These runtime outputs are ignored by Git; this record is committed.

## Handoff acceptance matrix

| ID | Status / evidence / limit |
| --- | --- |
| A01 | PASS isolation: only remote read operations; no original checkout touched. No original local status was applicable. |
| A02 | PASS offline: independent Git, project venv, isolated data/runtime/artifacts, loopback port 9180. Subsequent user-authorized publication uses only the new `wistroneq3300/pa-cycle-lab` origin, now public at the user's request. |
| A03 | PASS browser: Cycle Test button inside each project-management row. |
| A04 | PASS: rejects missing, duplicate, foreign-project and unsupported targets. |
| A05 | PASS: explicit neutrino profile, server-only selection, no browser script path/command. |
| A06 | PASS: snapshots survive inventory edits and project movement; search never expands submitted selection. |
| A07 | PASS: PRE findings/exclusions, version and ordered runnable IDs; stale/mismatched confirmation rejected. |
| A08 | PASS: n0 missing hostnames visible; occupied domain and unsupported profile reasons visible. |
| A09 | PASS: same key returns same job, changed payload conflicts, transactional reservations. |
| A10 | PASS: actual independent Web process killed/restarted; same live worker queried afterward. |
| A11 | PASS: hard-killed worker produces INCOMPLETE with retained PRE/journal, cannot be claimed for replay. |
| A12 | PASS: stop during first node action still completes POST for both queued nodes, no next round. |
| A13 | PASS offline: shared lock store for Cycle and manual control; arbitrary legacy remote interfaces disabled. |
| A14 | BLOCKED for shared domains / live validation: unknown or partial AUX scope rejected. Shared AUX/power-domain dispatch unsupported. Independent explicitly configured domains tested only synthetically. |
| A15 | PASS offline: Reboot/DC/AUX × Inband/Outband through real NodeSession; no AUX fallback. |
| A16 | PASS regression: existing verified script reused; missing/corrupt script stops node without re-upload (new upstream policy). |
| A17 | PASS offline: per-node phase/round/time, expected boot wait, pending until POST complete. |
| A18 | PASS: first-this-round versus unique count tests; COMPLETE + FAIL test; report preserves KNOWN/NEW/WORSENED. |
| A19 | PASS: hardware/collection failure remains FAIL; incomplete POST never zero/PASS. |
| A20 | PASS offline: JSON/HTML/evidence, source SHA, tool/integration version, script hash and target/config snapshots; scoped artifact routing. |
| A21 | PASS tested paths: passwords excluded from job snapshots; per-target secrets never argv; transport successful output redaction; private host-key files not downloadable. |
| A22 | PARTIAL: project/machine metadata, Test Library and copied shell retained. Legacy SSH add/probe, terminal/KVM/broadcast and AI remote operations disabled pending shared-lock integration. No original service operated. |

## Remaining hardware/deployment validation

- User-designated Neutrino endpoint identity, credentials, SSH ports, IPMI cipher and network behavior.
- Physical power/AUX impact map; shared-domain orchestration requires further implementation.
- Real persistence of `/var/tmp` across cycle; missing script deliberately stops execution.
- Linux service deployment, cross-UID behavior, controller dependency installation and actual power recovery.
- No rack scale/concurrency capacity claim; worker pool bound is 32, not a hardware capacity measurement.
- Multi-user Basic authentication is supported for trusted lab operators; per-project RBAC is not implemented.
- Original systems remain outside the new lock guarantee; dedicated targets or coordinated exclusive use required.
## Run2 hardening — 2026-10-01

Baseline `d3240929aacbe7ecfdf358a04765ff8c6e619f6e`; branch `codex/run2-hardening`;
version `0.1.1-neutrino-v1-run2`. Earlier acceptance above describes the initial
integration; Run2 strengthens its active-inventory and manual-control behavior.

| Validation | Actual result |
| --- | --- |
| Integration / Run2 unittest | **58 PASS**: existing 20 retained, 38 new regressions; 43.799s |
| Copied engine unittest | **101 PASS, 14 SKIP**, 115 discovered; 7.989s. 13 Bash fixture skips and 1 Linux-root cross-UID skip |
| Isolated process smoke | **PASS (SYNTHETIC)**: Web and scheduler killed/restarted; same worker PID; 3 completed rounds, graceful INCOMPLETE stop; instance `data/process-smoke-e77ee120f16948f38fe5288909a98556` |
| Playwright / Edge | **PASS (SYNTHETIC)**: same isolated instance, job `d67fbef3d2ff4e89994c6934ca9accf0` COMPLETE; PRE/confirm/report/reload/responsive/dark checks, zero page errors |
| Syntax / patch checks | Python compileall, browser JS syntax, git diff --check passed |
| Actual Linux/systemd/controller reboot | **NOT RUN** |
| Actual hardware / rack qualification | **NOT RUN; no Hardware PASS claim** |

Fault-injection tests intentionally print `Evidence persistence failure` when
SQLite terminal writes are unavailable. These are expected test scenarios, not
silent test errors. No test used real SSH/IPMI transport to a hardware target.

See [Run2 item-by-item review](RUN2_HARDENING.md) and
[Linux acceptance procedure](LINUX_ACCEPTANCE.md). Evidence logs are local,
Git-ignored `data/run2-integration-test.log` and `data/run2-engine-test.log`.

## Cycle Live Console — 2026-10-01

Based on completed Run2 `53ee74fad800c32c012369b87b501119184f68b0`, branch
`codex/live-console`, version `0.1.2-neutrino-v1-console`. Only pa-cycle-lab changed.
The source repositories remain untouched. Architecture/API documentation is in
[LIVE_CONSOLE.md](LIVE_CONSOLE.md).

| Validation | Final result |
| --- | --- |
| Cycle integration + Run2 + Console unit/regression | **74 PASS, 0 FAIL, 0 SKIP** in 133.659s: existing 58 plus 16 Console tests |
| Vera full regression | **101 PASS, 0 FAIL, 14 SKIP**, 115 discovered, 7.888s |
| Copied PA unit/mock pytest suite | **42 PASS, 0 FAIL, 0 SKIP**, 3.09s; two dependency deprecation warnings |
| Total Python tests | **217 PASS, 0 FAIL, 14 SKIP** |
| Independent process lifecycle smoke | **PASS, SYNTHETIC**: Web and scheduler replaced; worker PID unchanged, history preserved and incremental cursor valid; stop after round 2 → INCOMPLETE |
| Edge / Playwright | **PASS, SYNTHETIC**: original flow and 25 Console checks; zero page errors |
| Persistent long-log test | **PASS**: 100,000-row fixture, indexed 500-row tail bounded below 5s, filtered history and snapshot-limited streaming download |
| Browser long-log test | **PASS**: 11,500 unique events plus a 500-row history page; live buffer ≤3,000 and DOM ≤2,000; no HTML execution |
| Active-reading behavior | **PASS**: Auto Scroll OFF retains visible event within 2px during incoming pages; evicted anchor shows history-recovery notice |
| Themes / responsive | **PASS**: 1440×1000 and 390×844, both themes, no dialog horizontal overflow; level contrast ≥5.90:1 light / ≥8.02:1 dark; placeholder 5.49:1 / 6.66:1 |
| Security / concurrency / ordering review | No unresolved P0/P1 found in reviewed changes; field allowlist, before-write redaction, escaped UI text, secured evidence refs, append transaction ordering and terminal guards tested |
| Syntax / whitespace | Python compile, JS syntax and `git diff --check` passed |
| Linux/systemd and live hardware | **NOT RUN; no Hardware PASS claim** |

The 14 skips remain 13 Bash fixture tests (Bash absent on this Windows host) and
one Linux-root cross-UID test. A Vera regression using a 30ms synthetic boot
deadline failed under simultaneous test load; the targeted test and subsequent
complete standalone Vera suite passed. No timeout or safety gate was weakened.

Corrections found and verified during this feature review:

- Paused history now identifies itself as a history view.
- Earlier history starts before the rendered window, including buffered rows
  that were not rendered; it does not skip them.
- A fresh UI reviewer found low dark-placeholder contrast and reading-position
  drift at the DOM limit. Both were corrected, regression-tested and scored
  **resolved** in a scoped **ship** verdict; this is not hardware acceptance.
- The inherited broker HTTP fixture previously fell through to a deployment age
  credential file despite using a fake SP-X client. Its test-only credential cache
  now uses dummy data. No production credential handling or remote-route gate
  changed. Missing pytest/form-parser test dependencies were installed in `.venv`.

The Console tests cover SQLite reopen/refresh persistence, cursor paging, local
and server node/error/search filters, credential/environment/header redaction,
streamed download, unsafe artifact paths, concurrent writers, terminal ordering,
stop-after-round, worker-loss INCOMPLETE, response-loss ambiguity, and event-write
failure after dispatch without retry. Browser checks additionally cover paused
view while a job completes, copied/downloaded logs, stale aborted responses,
automatic recovery after a failed read, evidence links, and close/reopen.

Reproduction (project `.venv`, no hardware):

```text
python -m unittest discover -s tests -p test_*.py -v
# From engine/vera_cycle, using the same venv interpreter:
python -m unittest discover -s dev/tests -v
# From repository root:
python -m pip install -r tests/requirements.txt
python tests/legacy_smoke.py
# Set PLAYWRIGHT_MODULE to the local Playwright package, then:
python tests/process_smoke.py --browser
```

`legacy_smoke.py` confines inherited broker paths and pytest temporary files to
this repository and denies non-loopback socket connections. Testing the copied
broker module in isolation does not enable Legacy KVM/SSH/Terminal/AI routes in
PA Cycle Lab. The normal Cycle integration suite still tests those route blocks.

Local ignored evidence: `data/console-integration-test.log`,
`data/console-engine-test.log`, `data/console-legacy-test.log`,
`data/console-process-test.log`, `data/process-smoke-results.json`,
`data/console-browser-results.json`, `data/browser-results.json`, and
`.impeccable/review/console-{desktop,mobile}-{light,dark}.png`.
Final process instance: `data/process-smoke-b4de3a015cdc4147807f70a83c64b1c8`.

Remaining acceptance: actual Linux service restarts/SIGKILL/controller reboot,
KillMode=process, cross-UID/service-account and credential/artifact permissions,
real disk-full/read-only behavior, and user-designated Neutrino target identity,
physical power/AUX scope, reboot recovery and hardware evidence. Offline fault
injection and synthetic success do not substitute for these checks.


## 2026-10-03 Validation Console refinement

See [the scoped acceptance report](VALIDATION_CONSOLE_REFINEMENT.md) for current commands, paired baseline failures, browser scenarios, screenshots, video/trace and live gates. Historical PASS counts above are not reused as this delivery's result.
