# PA Manager Premium UI / UX — Final Delivery Report

Date: 2026-10-16 (Asia/Taipei)

Branch: `codex/premium-ui-impeccable-safe-polish`

Requested base: `27324648ede1d60e9f862858fd530ce4a8d9519a`

The final commit SHA is reported after the immutable Phase 3 commit is created.
No commit was made on `main`; no force push, reset, history rewrite, untracked
material deletion, production setting change, or real DUT operation was used.

## Phase delivery map

| Phase | Commit | Main file groups |
| --- | --- | --- |
| 0 — baseline | `a830b704f0abb4ce62519871ed9e41ebc7b04ae1` | Baseline audit, repository state, regression record |
| 1 — reliability/copy | `dc33c5c57d712faf89fae9480c3e542e4a598abc` | Dashboard copy, Thinking Indicator, refresh-state preservation, Telemetry Console, BMC race fixes |
| 2 — Agent contracts | `195515cdf0e5d17b52bad0c52831daad16010a86` | Single Test Case, Agent policy, durable Agent/Cycle coordination, STOP/GO/recovery/idempotency tests |
| 3 — polish/final QA | Reported by final handoff | Manual Telemetry AI, responsive polish, Hero controls, Chromium evidence, final reports |

Detailed file lists are in `PREMIUM_UI_PHASE0_BASELINE.md`,
`PREMIUM_UI_PHASE2_AGENT_CONTRACTS.md`, and
`PREMIUM_UI_PHASE3_AUDIT_POLISH.md`. The complete Before/After wording table is
in `COPY_FINAL_B_BEFORE_AFTER.md`.

## AG-01 through AG-10 traceability

| Decision | Status | Evidence |
| --- | --- | --- |
| AG-01 single Test Case | PASS | Radio selection replaces the prior selection; backend rejects legacy multi-case payloads; drawer E2E 28/28 |
| AG-02 abnormal handling | PASS | Read-only Evidence permitted; no automatic retry/DUT mutation; out-of-scope approval policy tested |
| AG-03 MANUAL ONLY | PASS | SOP/Evidence/Log assistance retained; physical action remains with engineer |
| AG-04 tool installation | PASS | Tool/source/version/Command/impact/risk approval contract tested |
| AG-05 execution report | PASS | `commands.txt`, raw Log, Evidence, Execution Summary, and engineer-owned result retained |
| AG-06 multiple Nodes | PASS | Durable Node/controller/BMC/power/AUX coordination; independent Nodes stay concurrent |
| AG-07 no automatic Queue | PASS | Busy scope returns conflict; release does not auto-start a waiting test |
| AG-08 chat while running | PASS | Chat/read-only checks remain; plan replacement requires STOP confirmation |
| AG-09 Reboot/reconnect | PASS | One dispatch, reconnect wait, identity/binding/boot checks, pause on ambiguity |
| AG-10 Agent judgment | PASS | Evidence-backed suggestion only; `執行完成` is not PASS |

## Recoverable prior engineering decisions

| Decision available in repository/task | Status |
| --- | --- |
| Agent GO final confirmation | PASS — conversational OK/GO gate retained |
| STOP immediately requests pause and confirms remote state | PASS |
| Idempotency | PASS — duplicate GO/rerun and Cycle operations remain guarded |
| Plan Mode controlled read-only behavior | PASS — plan-first Agent flow retained |
| Formal Node test mutual exclusion | PASS |
| Run recovery | PASS — durable Run and reservation state |
| Backend management password | PRESERVED — no production credential/config change |
| Dashboard first six Issues | PASS — existing `slice(0, 6)` retained |
| Refresh failure keeps old data | PASS — stale state exposes last update time |
| Manual Telemetry AI Analysis | PASS — explicit engineer action, no polling trigger |
| Large SPEC/Log on DUT, read-only by path | PRESERVED — no upload/transport expansion or DUT deletion added |
| Global Top 5 | PASS — backend ordering unchanged and basis displayed |
| Project/OS/Node/Run isolation | PASS in targeted contracts |
| Agent conversation seven-day cleanup; DUT raw Log not deleted | PRESERVED — existing retention default remains seven days and no DUT log deletion was added |
| Company login API deferred | PASS — not implemented |

The repository and supplied task do not contain the original wording and IDs for
all items collectively called the “other 26 decisions.” Missing source decisions
are `SKIP — source decision text unavailable`; no behavior was invented for them.

## PASS / FAIL / SKIP summary

### PASS

- COPY-FINAL B and approved Dashboard terminology.
- Thinking Indicator lifecycle separated from Run state.
- Polling no longer resets disclosure, Tab, search, scroll, modal, input, or focus
  in the repaired surfaces.
- Telemetry exporter independence, six stages, READY/PARTIAL/FAIL, persisted Log,
  and backend continuation after the Console closes.
- AG-01 through AG-10 targeted contracts.
- Required Chromium resolutions and light/dark capture matrix.
- Mock Terminal/SSH/Broadcast lifecycle, KVM state machine, Cycle, Agent,
  Telemetry, Inspection state-truth, and Rack isolation.

### FAIL

- Full Python suite: 384 passed, 141 failed, 4 skipped, 32 subtests passed.
- Legacy L10 performance budget: 2,348,724 vertices / 127 draw calls exceeds the
  old test threshold. It was not hidden by changing geometry or widening limits.
- The final long Hero behavior invocation did not terminate; other Hero/Rack and
  full visual matrix checks completed.

### SKIP

- Selected sustainable Data Center Poster and its two-second transition: the
  approved source asset/provenance is absent. No substitute image was used.
- Real DUT, real SSH/BMC/KVM, physical GPU performance, Prometheus/Grafana
  production integration, and real exporter installation.
- Unavailable original text for the remainder of the “26 decisions.”

## Functionality preservation confirmation

No new reservation, read-only mode, or connection block was added to SSH,
OS/BMC Terminal, Terminal Broadcast, independent sessions, command execution, or
KVM. The formal reservation coordinator is called only by Agent/Cycle test work.
Cycle, Agent Gateway/API, Local AI connection settings, Telemetry collection,
Inspection polling, Prometheus/Grafana configuration, Project Config, Evidence,
Console, and report paths were not disabled or reduced by Phase 3.

Because the full regression is not green and the approved Hero Poster is absent,
this delivery must not be described as formal production acceptance.
