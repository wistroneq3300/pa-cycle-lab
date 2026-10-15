# PA Manager Premium UI / UX — Phase 0 Baseline

Date: 2026-10-16 (Asia/Taipei)
Branch: `codex/premium-ui-impeccable-safe-polish`
Baseline commit: `27324648ede1d60e9f862858fd530ce4a8d9519a`

## Repository safety check

- Fetched the remote before work.
- The local and remote target branch both resolved to the requested baseline commit.
- The target branch had no newer commits, tracked modifications, or untracked files before work began.
- No work was performed on `main`, no history was rewritten, and no untracked material was removed.
- All validation in this phase used fixtures, browser route providers, and mock services. No real DUT, BMC, KVM, SSH endpoint, Prometheus, Grafana, vLLM, or Agent Gateway was contacted.

## Product and skill context

The Impeccable skill, `PRODUCT.md`, `DESIGN.md`, and repository `AGENTS.md` were reviewed before implementation. The permitted direction is refinement of the existing Wistron blue/green premium desktop UI—not a redesign. Existing Terminal, Broadcast, KVM, Cycle, Agent, Telemetry, Inspection, and 3D cinematic behavior is treated as a preservation boundary.

## Baseline regression

| Suite | Baseline result | Notes |
|---|---:|---|
| Python `pytest tests -q` | FAIL — 302 passed, 212 failed, 4 skipped, 2 errors, 32 subtests passed | Many failures depend on absent project checker/profile fixtures; Windows also reported locked temporary SQLite files. These are baseline results, not accepted as final validation. |
| Python `unittest app/qa/*_regression.py` | FAIL — 113 passed, 1 error | `operations_regression` exposed a real `NameError`: `_bmc_pending_since` is referenced by the BMC force-refresh path but is undefined. |
| Terminal security browser contract | PASS | Mock-only; no socket or external network access. |
| Terminal lifecycle browser contract | PASS | Mock-only. |
| Operations browser contract | PASS | Mock-only. |
| Equipment browser contract | PASS | Mock-only. |
| Chromium static production capture | PARTIAL — 150 screenshots produced | 1366×768, 1920×1080, and 3440×1440; light and dark themes. No viewport overflow or scenario navigation failures. The strict provider intentionally rejected one unregistered Telemetry AI request, and the scanner produced both genuine low-contrast findings and false positives where it did not resolve gradient button backgrounds. |

Baseline screenshots and machine-readable capture data are stored under `artifacts/premium-final/phase0-audit/` and remain local evidence rather than product source.

## Impeccable audit

### Health score

| Dimension | Score | Baseline evidence |
|---|---:|---|
| Accessibility | 2 / 4 | Keyboard-oriented controls are present, but small navigation arrows, micro labels, and some muted text need contrast/focus review. |
| Performance | 3 / 4 | Polling and WebGL budgets exist, but some updates still replace larger DOM regions than necessary. |
| Responsive layout | 3 / 4 | The three required desktop viewports showed no horizontal overflow; dense layouts still need final readability review. |
| Theming | 3 / 4 | Light/dark tokens are coherent, with residual hard-coded and gradient-scanner edge cases. |
| Visual integrity | 3 / 4 | Strong Wistron identity and consistent shells; state wording and several interaction details reduce trust. |
| **Total** | **14 / 20 — Good** | The design is structurally sound and should be refined rather than replaced. |

### Findings by severity

#### P0 — blocking

- No visual-audit P0 was found. Functional regression failures must still be resolved before final acceptance.

#### P1 — high priority

- Agent thinking UI is derived from Run `RUNNING` / `PENDING`, allowing background polling to recreate a completed thinking bubble.
- Test Case assignment supports multiple selection even though the approved rule requires exactly one Test Case.
- Telemetry provisioning clears the visible console model when reopened or remounted, even though backend events remain available.
- Machine-detail background rerendering can reset disclosure, focus, form, and scroll state.
- BMC force refresh has an undefined `_bmc_pending_since` state and fails the Python operations regression.
- Agent safety/operation prompts do not yet express all approved manual-only, evidence, retry, install-approval, reboot, and result-ownership rules.
- The selected Wistron sustainable Data Center Poster is absent from the repository. `app/static/img/server-hero.png` is a server-chassis fallback and must not be substituted. HERO-01 poster integration is therefore blocked pending the selected asset and its provenance.

#### P2 — medium priority

- User-facing copy mixes technical English with inconsistent Chinese wording and does not consistently distinguish empty, stale, and failed states.
- Dashboard headings and scope language do not yet match COPY-03 through COPY-08.
- Some icon-only navigation affordances and micro labels have low contrast, especially in light mode.
- Telemetry provisioning exposes component state but does not present the required six-stage model and explicit overall `READY` / `PARTIAL` / `FAIL` summary.

#### P3 — polish

- A few dense control rows can use tighter alignment and clearer grouping at 3440×1440.
- Mixed English/Chinese metadata should follow one repeatable hierarchy without changing technical identifiers.

### Positive findings

- Existing typography, restrained Wistron blue/green palette, card construction, and light/dark themes provide a coherent premium foundation.
- The 3D cinematic remained visible and stable in the baseline captures; no geometry, materials, cooling, busbar, rack inventory, or cinematic timing changes are justified by the audit.
- Agent Drawer, Terminal, Broadcast, KVM, Telemetry, Inspection, modal, evidence, and topology surfaces are present in the captured production graph.
- Terminal and Broadcast browser contracts confirm their existing independent interaction model; they must remain outside Agent/Cycle reservation policy.

## Preservation boundary for implementation

The implementation phases must not change model selection, ports, Gateway/vLLM connectivity, production configuration, SSH connection behavior, or 3D geometry and animation internals. Agent/Cycle mutual exclusion may apply only to formal test execution on the same Node or shared power/BMC resources; it must not reserve or block Terminal, Broadcast, independent user sessions, SSH command execution, or KVM.

## Decision traceability status

The repository and task provide enough evidence to implement AG-01 through AG-10 and the explicitly summarized P0/P1/P2 decisions. The repository does not contain the full original wording or identifiers for every item described collectively as the “other 26 decisions.” Final traceability will therefore map every recoverable decision verbatim and list any unavailable original decision text as `SKIP — source decision text unavailable`, without inventing requirements.

## Phase 0 conclusion

Phase 0 establishes a reproducible mock-only baseline. It is not a product acceptance: the complete baseline suite is red, the Data Center Poster is missing, and the identified P1 regressions remain to be fixed in later phases.
