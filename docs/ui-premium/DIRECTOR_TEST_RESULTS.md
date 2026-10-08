# Director test results

## Environment and safety boundary

- Host: Windows, Asia/Taipei; Python 3.12 project virtual environment.
- Browser: Microsoft Edge / Chromium `154.0.4258.62` through Playwright.
- UI fixture: loopback static/synthetic providers. No DUT, SSH, RFB, power, firmware, exporter installation or live Cycle dispatch.
- Baseline program: `fe8208867144b28f4e057606f5e2699b228a8056` for Director Phase C/D.
- Current committed product program: `419f9ca071bdabefc2e3e23dc0582bf8154f32ee` (`eeed293` is the preceding overlay Escape/IME commit).
- Broad/focused manifests retain their capture-time SHA and `dirty` value; none is relabelled as clean-final-SHA evidence.

## Python baseline / final

Raw JUnit:

- `docs/ui-premium/director-baseline-pytest.xml`
- `docs/ui-premium/director-after-pytest.xml`
- Final current run: `docs/ui-premium/director-final-pytest.xml`
- Focused green suite: `docs/ui-premium/director-state-truth-pytest.xml`

Recorded commands:

```powershell
$env:PYTHONPATH = 'app;engine/vera_cycle;engine/vera_cycle/dev/tests'
$env:CYCLE_MODE = 'synthetic'
$env:PYTHONUTF8 = '1'
.\.venv\Scripts\python.exe -m pytest -q --junitxml=docs\ui-premium\director-baseline-pytest.xml
.\.venv\Scripts\python.exe -m pytest -q --junitxml=docs\ui-premium\director-final-pytest.xml
```

The baseline was rerun with the same 880-case collection as after; the earlier partial 499-case XML is no longer used for parity.

| Run | Total | Passed | Failed | Error | Skipped | Subtests passed | JUnit suite time |
|---|---:|---:|---:|---:|---:|---:|---:|
| Baseline `fe82088` | 880 | 583 | 196 | 1 | 26 | 74 | 844.664 s |
| Intermediate `b38646e + working tree` | 880 | 582 | 197 | 1 | 26 | 74 | 168.578 s |
| Final product `419f9ca` | 880 | 585 | 194 | 1 | 26 | 74 | 186.596 s |
| Focused state-truth | 57 | 57 | 0 | 0 | 0 | 0 | 14.778 s |

Exact `classname::name` status-map comparison from baseline to final records four FAIL → PASS and two PASS → FAIL keys.

FAIL → PASS:

- `EngineTests::test_campaign_reports_are_consistent_and_escaped`
- `EngineTests::test_run_id_uses_rack_timezone`
- `DispatchSafetyTests::test_campaign_reports_are_consistent_and_escaped`
- `DispatchSafetyTests::test_run_id_uses_rack_timezone`

PASS → FAIL:

- `EngineTests::test_graceful_stop_keeps_current_loop_post`
- `DispatchSafetyTests::test_sensor_transport_failure_is_not_missing_hardware`

The final run still cannot be called green. Attribution evidence is recorded separately:

- `engine/vera_cycle/dev/tests/test_cycle.py` and `neutrin_cycle.py` have identical SHA-256 values in baseline and current worktrees.
- Exact sensor-transport reruns are baseline 10/10 PASS and current 10/10 PASS; the full-suite failure did not reproduce in those focused repetitions.
- Exact graceful-stop reruns are current 9/10 PASS and baseline 6/10 PASS, demonstrating pre-existing timing variability.
- Therefore neither observed PASS → FAIL is attributed to the UI commits, but both remain in the final JUnit result and are not relabelled PASS.

Failure evidence includes distinct categories and is not collapsed into a generic “environment” label:

- Windows temporary SQLite/file cleanup failures (`WinError 32` / `PermissionError`) in Agent Gateway tests.
- Windows CP950 `UnicodeDecodeError` in Vera Cycle report/timezone paths.
- Missing setup/environment prerequisites that produce downstream HTTP expectation failures.
- The two observed engine timing/scheduling assertions above.

No assertion was deleted, skipped or weakened to make the suite green. Baseline and final full suites remain non-green; final has three fewer failures in aggregate, with the exact status changes disclosed above.

## Focused Python suite

`director-state-truth-pytest.xml` covers 57 Telemetry, Inspection and related backend tests and is green: 57 passed, 0 failed/error/skipped. It is supporting evidence, not a substitute for the failing full suite.

## JavaScript / browser suites

| Suite | Result recorded in this task | Coverage / limitation |
|---|---|---|
| `tests/director-state-truth-browser.cjs` | PASS, 7 strict scenarios | D01/D02, clipboard denial, attachment DELETE failure, output disclosure, Evidence lifecycle, optional Inspection fields, Cycle confirm/delete, missing counters; strict mocks/no hardware. |
| `tests/pa-agent-markdown.cjs` | PASS 13/13 | Markdown and XSS cases. |
| `tests/pa-agent-drawer-e2e.cjs` | PASS 27/27 | Drawer workflow/state presentation. |
| `tests/pa-agent-session-race-browser.cjs` | PASS 5/5 | stale active/history/attachment/poll and same-case reopen. |
| `tests/director-modal-lifecycle-browser.cjs` | PASS | role/focus trap/IME Escape/focus restore/busy/error retention for shared dialog. |
| `tests/director-modal-surface-browser.cjs` | 11 PASS / 0 PARTIAL checks; inventory report remains PARTIAL | Inventories 35 surfaces. Exercised generic/add/project/management-IP/Evidence and PA Agent/Topology/Guide IME-safe Escape, regular Escape and focus restore; 0 mutations, unknown reads, external requests and page errors. Every owner/role/error submit cross-product is not claimed. |
| `tests/director-modal-zoom-browser.cjs` | PASS 8/8 before and 8/8 after | Connection and Test Assignment, light/dark, 100%/true 125%. At 125%, CSS viewport ≈1093×614; footer/CTA/last focus/scroll end measured reachable. The suspected clipping defect was not reproduced. |
| `tests/director-telemetry-inspection-browser.cjs` | PASS | READY/STALE/NO_DATA/QUERY_ERROR/NOT_APPLICABLE, legend visibility isolation, defensive AI and two screenshot rounds. |
| `tests/director-cycle-browser.cjs` | PASS | synthetic create/confirm/stop/reconcile/delete, Console, copy denial, Evidence error, and 1/4/32/128 fixtures. |
| `tests/director-cycle-evidence.cjs` | PASS for current true-125% and 200%; baseline limitation recorded | 16 baseline + 16 true-125% + 16 200% PNGs. Full-event rows 6/21/145/500 for 1/4/32/128 Nodes; 0 unknown/page/console errors. Baseline current-contract wording mismatch is preserved; no DUT dispatch. |
| `app/qa/topology-ip-summary.cjs` | PASS | Reachability wording does not become validation PASS. |
| `app/qa/topology-browser.cjs` | PASS | Deterministic topology fixture, no page errors. |
| `app/qa/kvm-solo-browser.cjs`, `kvm-session.cjs` | PASS | Fake RFB/session behavior; not live framebuffer coordinate E2E. |
| `terminal_lifecycle_regression.cjs`, `terminal_security_regression.cjs` | PASS | Existing lifecycle/security contract; no live SSH. |
| `operations_regression.cjs`, `theme-palette.cjs`, `userguide.cjs` | PASS | Existing operations/theme/guide contracts. |
| `theme-contract.cjs` | PASS 5/5 after test correction | Old test incorrectly assumed prior CSS ordering/English theme title; product behavior was source-checked before updating assertion. |
| hardware identity pure mapping | PASS after `d65d9ee` | Reported memory capacity remains the main value. |
| `tests/director-walkthrough-browser.cjs` | FAIL in all 3 rounds | First eight steps pass consistently: Overview/theme/refresh, Project→System→Node→Inventory, Inspection Evidence 503 persistent then reopen success, Telemetry READY, single Agent GO→DONE awaiting judgment, Agent close/reopen. Multi-select Batch CTA wording is correct, but click produces no recognizable confirm/result within 15 seconds. Later Cycle/Terminal/KVM/Rack/Topology/Guide steps are NOT-RUN. |

Executed suites that are not green release evidence:

- `app/qa/appearance-interaction.cjs`: only the first Hero orbit check passed; remaining assumptions use older Hero/Rack selectors/timing and one fixture 404. Frozen Hero/Rack code was not changed to satisfy the stale selectors.
- `app/qa/acceptance.cjs`: failures include old assumptions such as five tabs instead of the current six and older Hero/Rack/Test counts. The Director harness is the current scoped evidence; this legacy suite still needs contract maintenance.
- `app/qa/workspace-ux.cjs`: failed early on old selector assumptions.
- Full hardware browser test has a separate existing global/detail L10/L11 expectation mismatch; the isolated value mapping is green.
- `tests/production-copy-browser.cjs`: **NOT RUN** against the general 9196 fixture because it had no completed Cycle run. The deterministic Director Cycle harness was used instead; no DUT task was created for test convenience.

## Screenshot / viewport runs

| Manifest | Images | Zoom | Result / important gaps |
|---|---:|---:|---|
| `screens/before/capture-results.json` and `screens/after/capture-results.json` | 50 before / 70 after PNGs | 100% | Test Case/Agent at five widths, light/dark. 66 after assertions pass. Optional `GET /api/ai/gpu-alerts` is recorded and strictly 404, not silently mocked. |
| `screens/director-site-before-fe82088/capture-manifest.json` | 138 | 100% | 6 S13 evidence capture failures; S08 gap, S12/S13 partial; captured images have zero page/console/unknown/external errors. |
| `screens/director-site-after-b38646e/capture-manifest.json` | 144 | 100% | 0 scenario/viewport/zoom failures and 0 page/console/unknown/external errors; S08 gap and S12/S13 partial remain; app is dirty. |
| `screens/director-site-before-fe82088-zoom125/capture-manifest.json` | 92 | true 125% | MV3 `chrome.tabs.setZoom/getZoom`; actual 1.25; 4 S13 scenario failures, 0 zoom failures. |
| `screens/director-site-after-b38646e-zoom125/capture-manifest.json` | 96 | true 125% | Actual 1.25; 0 scenario/viewport/zoom/page/console/network/unknown failures; app is dirty. Covers 1366/1920 light/dark, not 3440 at 125%. |
| `screens/cycle-after/metadata.json` | 15 | 100% | 1366/1920, light/dark, 1/4/32/128 synthetic data, zero page errors/unknown requests. |
| Telemetry/Inspection round metadata | 20 total round images | 100% | Two rounds, 1366 dark and 1920 light, no browser errors. |
| `screens/director-modal-surfaces/metadata.json` | 11 PNGs | 100% | 10 current-state captures plus one preserved project-before; 11/11 deterministic checks PASS. Inventory-level result remains PARTIAL because dedicated/owner cross-products are separate. |
| `screens/director-modal-zoom/{before,after}/metadata.json` | 8 before / 8 after | 100% + true 125% | Both phases 8/8 PASS; light/dark connection and Test Assignment; zero mutations/unknown/external/page/console errors; measured footer/control/focus reachability. |
| `screens/cycle-before-fe82088/metadata.json` | 16 | 100% | Clean baseline Create/PRE/Console/Evidence at 1366/1920, both themes. Separately, running the current acceptance harness against baseline stops after five initial images because baseline wording differs; that limitation is preserved and does not erase this 16-image evidence set. |
| `screens/cycle-after-zoom125/metadata.json` | 16 | true 125% | Actual zoom 1.25; same surface matrix; 1/4/32/128 full-event rows 6/21/145/500; no unknown/page/console errors; synthetic only. |
| `screens/director-contrast-after{,-zoom125}/capture-manifest.json` | 68 + 68 | 100% + true 125% | Owner-scoped post-hardening matrix; targeted solid-background violations are 0. Gradient/image-approximated findings and full-WCAG exclusions remain. |
| `screens/director-zoom200/site/capture-manifest.json` | 28 | true 200% browser zoom | Actual `getZoom=2`; 1366×768 screenshot / 683×384 CSS viewport / DPR 2; no scenario/viewport/zoom/page/console/unknown/external failure; static S08/S12/S13 limitations remain explicit. |
| `screens/director-zoom200/cycle/metadata.json` | 16 | true 200% browser zoom | Create/PRE/Console/Evidence; actual zoom 2, CSS viewport 683×384, DPR 2; PASS synthetic fixture. |
| `screens/director-walkthrough/metadata.json` | 6 screenshots | 100% | Three consistent FAIL rounds at `419f9ca + dirty`. Evidence-error and Agent-DONE images exist for each round. Static external/page/unknown counts are 0; provider trace was not harvested and is not independent proof. |

Pending at document time:

- Final clean-SHA 100% recapture.
- Final clean-SHA true-125% recapture. The current after-125 manifest is working-tree evidence only.
- Test Case / Agent true-125% beyond the site harness’s 1366/1920 combinations; the five-width dedicated set remains 100%.
- Physical director display/projector.
- Three **passing** complete continuous walkthroughs. Three attempts were recorded, but all fail at the Batch transition and stop before later surfaces.

The completed 200% evidence is **browser zoom**, not an OS text-only setting and not a physical-display validation.

## Contrast

The broad site harness uses computed foreground/background alpha composition with WCAG 2.x thresholds, but excludes/approximates several cases and is explicitly partial. It exposed 393 exact solid-background failures at 100% and 130 at true 125%. After owner-scoped `419f9ca` hardening, focused matrices of 68 PNGs each report **0 targeted findings with `backgroundApproximation:null`**. They still contain 473/287 gradient/image-approximated findings and exclude image/canvas/SVG/video, disabled content, opacity/filter/blend and pseudo-element cases. Result: **targeted solid-background matrix verified; full WCAG PASS not claimed**.

## Result

- Full Python status-map delta: 4 FAIL → PASS and 2 PASS → FAIL. The two new engine observations are not attributed to UI after unchanged engine hashes and focused reruns, but they remain recorded; the suite is not green.
- Full Python suite: non-green.
- Focused UI truth/race/lifecycle/modal/zoom/targeted-contrast suites: green for their named fixtures.
- Integrated walkthrough: FAIL 3/3 at multi-select Batch transition; later required surfaces NOT-RUN.
- Required full-site final-SHA, complete S12 owner/role/error and S13 coverage, physical display and a passing continuous walkthrough: incomplete.

Overall test disposition: **NOT_READY**.
