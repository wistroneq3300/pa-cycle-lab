# Premium UI Phase 2 — Approved Agent Contracts

Date: 2026-10-16 (Asia/Taipei)
Branch: `codex/premium-ui-impeccable-safe-polish`

## Scope

Phase 2 implements the approved AG-01 through AG-10 behavior without changing
the configured Agent model, Gateway address, vLLM settings, ports, SSH transport,
Terminal, Broadcast, KVM, or production credentials. All verification used
isolated SQLite stores, strict browser providers, synthetic Cycle data, and a
mock Agent Gateway. No real DUT was contacted.

## Decision trace

| Decision | Implementation | Verification |
| --- | --- | --- |
| AG-01 — one Test Case | Test Case Library uses a radio group; a new choice replaces the prior choice. `AgentRunCreateReq` forbids extra fields, including legacy `case_variant_ids`. | Browser replacement checks, Pydantic contract, HTTP 422 contract. |
| AG-02 — abnormal handling | Agent policy permits safe read-only Evidence collection and analysis, forbids automatic retry or DUT modification, and requires approval outside scope. | Gateway policy regression. |
| AG-03 — MANUAL ONLY | Agent may explain SOP, collect approved read-only PRE/POST Evidence, and analyse supplied Log; physical work remains with the engineer. | MANUAL ONLY policy regression. |
| AG-04 — tool installation | Policy requires tool, source, version, full Command, impact, and risk before approval; installation is not automatic. | Gateway policy regression. |
| AG-05 — execution report | Policy preserves `commands.txt`, raw Log, Evidence, and a concise Execution Summary on the DUT; Agent verdict remains a recommendation. | Gateway policy regression. |
| AG-06 — multiple Nodes | A durable SQLite coordinator reserves Node, controller, BMC, Power Domain, and AUX Domain scopes for Agent/Cycle formal tests. Independent Nodes remain concurrent. | Coordinator concurrency and Cycle-store integration tests. |
| AG-07 — no automatic Queue | A busy formal-test scope returns HTTP 409 with an explicit no-Queue message; resource release does not auto-start a waiting run. | Conflict and no-Queue tests. |
| AG-08 — chat while running | Normal chat and controlled read-only requests remain available. STOP must be confirmed before a replacement plan; approved plan changes are not implicit. | Gateway policy and drawer E2E. |
| AG-09 — Reboot/reconnect | Policy dispatches an approved Reboot once, waits for reconnect, then checks Node Identity, Binding, and Boot evidence; ambiguous state pauses without resending. | Gateway policy regression. |
| AG-10 — Agent judgment | Agent may provide an Evidence-backed PASS/FAIL suggestion; the engineer records the formal result. `DONE` displays `執行完成`, not PASS. | Copy/browser status contracts. |

## Formal-test coordination boundary

The new coordinator is deliberately not called by Terminal, Terminal Broadcast,
direct SSH command sessions, or KVM. Those interactive operator tools remain
independent and may be used concurrently on the same Node. Only formal PA Agent
execution and Cycle jobs acquire the new reservation.

Reservations are durable across process recovery. Terminal states release them;
`RECONCILIATION_REQUIRED` and an unconfirmed remote STOP retain them. Agent and
Cycle share the same coordinator in the production route wiring.

## STOP and idempotency

- A STOP request calls the configured Gateway pause endpoint exactly once.
- The server polls the existing event feed to confirm the remote paused state.
- An ambiguous result returns 409, retains the reservation, and is not retried.
- Repeated GO or rerun while the same run remains `RUNNING` is ignored rather
  than dispatching a second execution turn.
- Existing Cycle idempotency behavior is preserved.

## Reliability correction

`AgentRunStore` now closes every SQLite connection after its transaction. This
removes Windows file-handle leakage that prevented isolated databases from being
cleaned up and obscured regression results. Direct SQLite test handles were also
closed explicitly.

## Phase 2 regression

| Suite | Result |
| --- | --- |
| Agent route/Gateway/store/formal coordinator | PASS — 115 passed, 2 skipped |
| Python QA regression | PASS — 114 / 114 |
| Agent drawer E2E | PASS — 28 / 28 |
| Director state-truth | PASS — 7 strict scenarios |
| Director integrated walkthrough | PASS — 3 rounds × 13 / 13; no unknown/external/page errors |
| Terminal security/lifecycle, Operations, Equipment browser | PASS |
| User Guide browser | PASS |
| Rack 3D isolation | PASS |
| Hero assembly behavioral regression | PASS |
| Full Python `pytest tests -q` | FAIL — 384 passed, 141 failed, 4 skipped, 32 subtests passed |
| L10 cinematic legacy budget | FAIL — existing scene reports 2,348,724 vertices and 127 draw calls, above the test's `<2,000,000` / `<100` thresholds |

The full Python suite remains red and therefore is not a formal acceptance.
The count improved from the Phase 0 baseline (302 passed / 212 failed / 2 errors),
but many suites still require repository-external checker/profile fixtures. The
L10 budget failure was recorded without modifying 3D Geometry, materials, or
cinematic timing.

## Files changed

- Agent behavior and persistence: `integration/agent_gateway.py`,
  `integration/agent_routes.py`, `integration/agent_runs.py`
- Agent/Cycle coordination: `integration/formal_test_locks.py`,
  `integration/store.py`, `integration/web.py`, `RUNTIME_ENGINE_FILES.json`
- Single-case UI and guide: `app/static/js/app.js`,
  `app/static/js/engineering-ux.js`, `app/static/css/engineering-ux.css`,
  `app/static/index.html`, `app/static/userguide_template.html`
- Synthetic acceptance harness: `scripts/validation_console_preview.py`
- Copy report and Phase report: `docs/COPY_FINAL_B_BEFORE_AFTER.md`, this file
- Regression contracts: the Phase 2 Python and Chromium test files under
  `tests/` and `app/qa/userguide.cjs`
