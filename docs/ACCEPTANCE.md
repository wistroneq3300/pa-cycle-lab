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
