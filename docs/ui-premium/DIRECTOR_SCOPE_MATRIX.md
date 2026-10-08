# Director scope matrix

## Evidence boundary

- Repository: `wistroneq3300/pa-cycle-lab`
- Working branch: `codex/platform-premium-ui-v1`
- Integration baseline: `186f0373e86768aa19bab36b283c12e79ad43848`
- Hero V3 source: `63f01d1bc4ad7c18f02263c0350ebd58e7e83e89`
- Phase C/D starting point used for the current captures: `fe8208867144b28f4e057606f5e2699b228a8056`
- Latest product-code commit under review: `88cf814972c9eeccc85c6ca603f425518c5d4541` (scope-local Evidence viewer viewport fix); preceding visual hardening: `419f9ca071bdabefc2e3e23dc0582bf8154f32ee`
- Overlay Escape / IME commit: `eeed293a4afdfdbece3df69acc5d8a0eb5dec107`
- Clean broad-capture program/evidence base: `84adcef5f5383cf9737680e7f811a57eeb29783f`
- Clean three-round walkthrough harness/program: `3ef6962f793bac5f6df119ed7353a8c9a69607fc`
- Capture mode: loopback deterministic fixture, never a DUT. `hardwareDispatches` is `0` in every completed site manifest.

Historical broad/focused manifests retain their original capture-time SHA and `app.dirty` value. The final broad 100% and true-125% manifests both record exact app SHA `84adcef` with `dirty:false`; this closes capture-identity defect R23 but does not expand S08/S12/S13 beyond the named fixture states or imply live hardware/role coverage. “Captured” below means the stated fixture and state rendered without the named runtime/request error.

Evidence roots:

- First-stage Test Case / Agent before and after: `docs/ui-premium/screens/{before,after}/capture-results.json`
- Full-site 100% baseline: `docs/ui-premium/screens/director-site-before-fe82088/capture-manifest.json`
- Full-site 100% after: `docs/ui-premium/screens/director-site-after-b38646e/capture-manifest.json`
- Final clean 100% after: `docs/ui-premium/screens/director-site-final-84adcef/capture-manifest.json`
- True browser-zoom 125% baseline: `docs/ui-premium/screens/director-site-before-fe82088-zoom125/capture-manifest.json`
- True browser-zoom 125% after: `docs/ui-premium/screens/director-site-after-b38646e-zoom125/capture-manifest.json`
- Final clean true-125% after: `docs/ui-premium/screens/director-site-final-84adcef-zoom125/capture-manifest.json`
- Cycle dedicated fixture: `docs/ui-premium/screens/cycle-after/metadata.json`
- Telemetry / Inspection rounds: `docs/ui-premium/screens/director-telemetry-inspection-round{1,2}/metadata.json`
- S12 / S13 strict surface audit: `docs/ui-premium/screens/director-modal-surfaces/metadata.json`
- Modal 100% / true-125% geometry: `docs/ui-premium/screens/director-modal-zoom/{before,after}/metadata.json`
- Owner-scoped contrast matrices: `docs/ui-premium/screens/director-contrast-after{,-zoom125}/capture-manifest.json`
- Cycle baseline / true-125%: `docs/ui-premium/screens/cycle-before-fe82088/metadata.json`, `docs/ui-premium/screens/cycle-after-zoom125/metadata.json`
- 200% browser zoom: `docs/ui-premium/screens/director-zoom200/{site/capture-manifest.json,cycle/metadata.json}`
- Final three-round integrated walkthrough: `docs/ui-premium/screens/director-walkthrough-final-3ef6962/metadata.json`

## Route and tab inventory

| Route / entry | Tabs or states | Renderer / style owner | Evidence status |
|---|---|---|---|
| `#/dashboard` | Hero fixed state; attention; validation summary; recent activity | `validation-overview.js/.css`, frozen `core-scene.js`, `cinematic.js`, `hero-callouts.css` | 100% before/after captured at 1366, 1920, 3440, light/dark. Frozen-state comparison uses `progress=1`, final shot, reduced motion. |
| `#/projects`, `#/projects/{project}` | L10, L11, search/no-result, row menu | `product.js/.css`, `engineering-ux.js/.css`, `workspace-ux.js/.css` | 100% before/after captured. Return-context behavior is source-audited, not a complete browser history test. |
| `#/machine/{machine}` | Overview, Inventory, Nodes, Health, Telemetry, Validation | `product-detail.js/.css`; each feature owner below | All six tabs are source inventoried; representative states captured. S12/S13 gaps remain as listed below. |
| `#/rack/{project}` | default rack workspace | `equipment-workspace.js/.css`, frozen rack scene owners | Fixed Rack capture at identical fixture/state; no redesign. |
| `#/rack/{project}/{plane|list|telemetry}` and legacy `#/rack/{plane|list|telemetry}/{project}` | 48U plane, list, rack telemetry | `app.js`, `equipment-workspace.js/.css` | Source-audited. Not every legacy URL permutation was separately captured. |
| `#/cycle` | history / empty / paging / delete | `cycle-workspace.js/.css` | Dedicated synthetic browser harness. Full-site static harness intentionally reports S08 gap. |
| `#/cycle/new[/project/chassis/node]` | settings, scope, search, 1/4/32/128-node fixtures, PRE | `cycle-workspace.js/.css` | Dedicated synthetic harness and screenshots. |
| `#/cycle/runs/{run_id}` | run, stop, PRE confirmation, recovery/reconciliation, console, evidence/report links | `cycle-workspace.js`, `cycle-console.js`, `cycle-fleet.js`, `validation-console.css` | Dedicated synthetic harness; live execution not tested. |
| `openAssignTask(machine)` | category, list/detail, none/single/multiple selection, result viewer | `app.js`, `engineering-ux.*`, `workspace-ux.*` | Five widths × two themes in first-stage evidence; strict action assertions. |
| `PA_Agent.open(context)` | waiting, running, done-awaiting-judgment, error, reconnect, attachments, long output, reopen | `pa-agent.js`, scoped Agent rules in `style.css` | Five-width first-stage captures plus race/state-truth suites. |

## Overlay, modal, drawer, popover and menu inventory

This is a source inventory, not a claim that every row has full interaction coverage.

| Family | Concrete surfaces | Owner | Current verification |
|---|---|---|---|
| Static modal | Add system; project management; OS/BMC dual Terminal; Broadcast terminal | `index.html`, `app.js` | Add and project forms were rendered with long content and keyboard/cancel assertions; project before/after images record the scoped width fix. Terminal/Broadcast remain dedicated fake-provider evidence. Every submit-error/role combination is not covered. |
| Shared `showDialog` | confirmation; component control; add/move rack device; CDU install; rack height/promotion; topology helper; Test Library; Terminal credential/setup; connection settings; broadcast target chooser; batch power result | `app.js`, `workspace-ux.js`, `operations-ux.js`, `equipment-connections.js` | Generic focus trap, Tab/Shift+Tab, IME-safe Escape, focus restore, duplicate-submit guard and retained error pass. `uxConfirm` cancel sends zero requests; management-IP dialog cancel passes. Other owner-specific subflows are source-reviewed, not all submitted. |
| Native dialog | Inspection raw Evidence; Telemetry Exporter Console | `inspection-evidence.js`, `telemetry-provision.js` | Evidence long-loaded/403/reopen/copy-gating/focus/Escape/restore passes. Exporter READY/error/reopen presentation is covered by its dedicated Telemetry harness; full connection-loss interaction is not exhaustive. |
| Drawer | PA Agent mission workspace | `pa-agent.js` | Waiting/error/done/attachment/reconnect captures; stale response tests pass. |
| Full-window overlay | Topology editor; KVM broadcast/solo; User Guide | `topology.js`, `kvm_broadcast.js`, `userguide.js` | Topology nested-cancel draft retention and Guide/Agent regular close, IME Escape and focus return pass in the strict surface audit. KVM uses a fake provider. No live RFB/SSH. User Guide is non-modal by design (`aria-modal=false`). |
| Menus / popovers | Project row “more” menu; system operation disclosures; rack subtabs; chart legends; Cycle filters/density/severity; topology legends/editor | respective local owner | Source-audited and represented in current captures; keyboard traversal was not exhaustively recorded for every menu. |

## Role- and state-gated surface inventory

Backend authorization contracts were not changed. Gates include project/system create/edit/delete, Node edit/retire, power actions, Telemetry enable, Inspection settings/actions, Cycle create/confirm/stop/reconcile/delete, Agent run/message/attachment delete, Evidence download, and KVM launch. The UI retains backend 403/409 reasons where the tested workspace supports persistent error presentation. The loopback fixture is not a role matrix: viewer/operator/admin variants are **not all browser-tested**, so those rows remain unverified rather than PASS.

Common states inventoried from renderers are: loading, not configured, empty, search empty, not applicable, permission denied, stale, source unavailable, query/error, action failure, running, waiting for user, done, and reconnecting. Dedicated coverage exists for Agent, Telemetry, Inspection, Cycle, Evidence, and Test Library; the complete cross-product for every modal does not.

## S01–S15 review matrix

| ID | Surface and entry | Owner | Modified / retained reason | Evidence and result | Gaps / status |
|---|---|---|---|---|---|
| S01 | Shell / sidebar / topbar | `index.html`, `style.css`, product wrappers | Retained established quiet shell; shared dialog/persistent-error behavior hardened in `56d6fb1`. | `s01-shell-*` at 100% and true 125% before/after, including clean `84adcef` broad captures. No capture runtime errors. | Exhaustive keyboard focus for all nav states not run. **PARTIAL** |
| S02 | Overview outside Hero | `validation-overview.*` | Retained current hierarchy; no unsupported KPI added. Hero frozen. Owner-scoped contrast fix is in `419f9ca`. | `s02-overview-below-hero-*`; fixed Hero evidence `s02-hero-fixed-*`; targeted 100%/125% solid-background matrix has 0 true violations. | Gradient/image approximations and full WCAG remain outside the targeted audit. **PARTIAL** |
| S03 | Systems / Projects | `product.*`, `engineering-ux.*`, `workspace-ux.*` | Retained table model and L10/L11 semantics; rack-height/external wording corrected in `ee8fcd5`. | L10/L11/search-empty at 1366/1920/3440, both themes. | More-menu edge placement and every long-name permutation are not separately interaction-tested. **PARTIAL** |
| S04 | System Detail / Nodes | `product-detail.*`, `operations-ux.*` | Target strip and active OS retained; narrow-workspace operation reachability fixed in `b38646e`. | Overview/Nodes before/after captures; 1366 true-125% harness asserts a keyboard-focusable table region, zero body overflow and fully visible final action control; clean broad captures include 100% and true 125%. | Every destructive Node form/role remains untested. **PARTIAL** |
| S05 | Inventory / Sensors / Firmware | `product-detail.js`, `engineering-ux.*` | Reported memory capacity preserved in `d65d9ee`; missing counts are not converted to zero. | Inventory/Health before/after captures and pure mapping test. | Raw-output extreme-length and every device type are not separately captured. **PARTIAL** |
| S06 | Test Case / Assignment | `app.js`, `engineering-ux.*`, `workspace-ux.*` | First-stage layout retained; copy truth, multi-select wording and workflow corrected in `9459a3b`. | Five widths (1366/1600/1920/2560/3440), light/dark; strict focused state-truth suite passes. Final integrated walkthrough passes the single-Agent and multi-select Batch steps in all three rounds; no Batch Agent run is introduced. | Live Gateway/OpenHands remains untested. **VERIFIED FOR FIXTURE / INTEGRATED SYNTHETIC PATH** |
| S07 | PA Agent | `pa-agent.js`, scoped `style.css` | First-stage 36/64 mission workspace retained; attachment truth, disclosure and stale-session isolation added in `9459a3b` / `ffbd901`. | Waiting/done/error/reconnect/attachment captures; 27/27 drawer, 13/13 markdown and 5/5 race scenarios reported passing. | Live Gateway/OpenHands not used; all provider failure modes not covered. **VERIFIED FOR FIXTURE** |
| S08 | Cycle Validation | `cycle-workspace.*`, `cycle-console.js`, `cycle-fleet.js`, `validation-console.css` | Execution state, health and coverage separated; console feedback and evidence errors refined in `7f68bd9`. | Existing 100% acceptance has 15 images and action calls. Dedicated evidence adds 16 clean-baseline `fe82088` PNGs and 16 current true-125% PNGs across Create/PRE/Console/Evidence, 1366/1920, light/dark. Full-event counts for 1/4/32/128 Nodes are 6/21/145/500; 0 unknown/page/console errors. A separate 200% Cycle run adds 16 PNGs. | Synthetic loopback only; live engine/hardware is not tested. A separate run of the current acceptance harness against baseline legitimately stops after five initial images because wording changed; metadata preserves this rather than altering baseline. **VERIFIED FOR SYNTHETIC MATRICES / HARDWARE NOT TESTED** |
| S09 | Telemetry / Exporter | `telemetry-native.*`, `telemetry-provision.*` | Truth fixes in `9459a3b`; chart-first hierarchy and console presentation in `584bea7`. | Two actual visual rounds; READY/STALE/NO_DATA/QUERY_ERROR/NOT_APPLICABLE; legend/node/theme/range assertions; general Telemetry surface captured in clean 100%/true-125% broad matrices. | Live Prometheus/exporter install not used. **VERIFIED FOR FIXTURE** |
| S10 | Inspection / AI | `system-inspection.js`, `inspection-refinement.css`, `inspection-evidence.js` | Defensive optional fields and fact/AI/evidence hierarchy in `9459a3b` / `584bea7`. | Two rounds: current/recovered/AI-missing/source-error at 1366/1920. | Every archive/delete/permission variation not captured. **PARTIAL** |
| S11 | Terminal / Broadcast / KVM | existing transport modules and outer chrome | Outer frames retained and visually reviewed; transports and framebuffer frozen. | Terminal/Broadcast/KVM fake-provider frames at 100%; KVM solo and session regression suites reported passing. | No live SSH/RFB, no physical input-coordinate E2E, and keyboard shortcut isolation is source/regression only. **PARTIAL** |
| S12 | All forms / modal / drawer / popover | shared dialog plus local owners | Shared lifecycle hardened in `56d6fb1`; `eeed293` scopes overlay Escape/IME handling; `419f9ca` contains the project-only compact layout/contrast work. No request contract/default changed. | `director-modal-surfaces/metadata.json` inventories 35 surfaces and records 11/11 deterministic PASS, including PA Agent/Topology/User Guide IME Escape, regular Escape and focus restore; 0 mutations/unknown/external/page errors. Modal zoom matrix records 8/8 PASS across connection/Test Assignment, light/dark, 100%/true 125%; at 125% CSS viewport is approximately 1093×614 and footer/CTA/last focus/scroll end are measured reachable. | The inventory remains **PARTIAL** because every one of 35 owners × roles × submit/error/reopen states was not browser-exercised; Terminal/Broadcast/KVM/Cycle/Telemetry rely on dedicated harnesses. |
| S13 | Evidence / Report / SOP | `inspection-evidence.js`, Cycle artifact list, Guide/SOP entries | Loading/empty/error/truncation/copy/download semantics corrected in `9459a3b`; `88cf814` keeps the native viewer fixed to the viewport with a scoped `100dvh` body so actions remain reachable after page scroll and at 125%. | Strict surface audit passes long-loaded, 403, reopen, copy gating, focus/Escape/restore. Clean 100%/true-125% metadata asserts dialog/footer fully in viewport and `.pa-evidence-modal [data-download]` exists, is visible/focusable/in viewport; final images show footer/copy/download. Cycle evidence/report links and failure are captured separately. | Formal Report/SOP viewer and every 404/5xx/search/download state are not all captured; browser save completion cannot be asserted. **INCOMPLETE / INSPECTION EVIDENCE VERIFIED AT NAMED STATES** |
| S14 | User Guide | `userguide.js`, `userguide_template.html` | Current workflows and DONE/PASS, OK/GO, node/slot, Cycle, Telemetry, Inspection and evidence wording updated in `84a667b`. | Guide at 1366/1920/3440 light/dark plus clean true-125% 1366/1920; guide regression reported passing. | Search/error lifecycle not exhaustively captured. **PARTIAL** |
| S15 | Topology | `topology.js/.css` | Ping summary distinguishes configured/reachable from validation truth (`9459a3b`); Escape/IME guard is in `eeed293`; existing data/line semantics retained. | 100% before/after at three widths/themes; clean true-125% at 1366/1920 both themes; topology browser/IP-summary pass. Strict surface audit passes nested cancel/draft retention, IME Escape, regular Escape and focus restore. | Large-line stress and every nested confirmation are not verified. **PARTIAL** |

## Frozen regression inventory

| Frozen area | Constraint | Evidence | Result |
|---|---|---|---|
| Hero V3 | Geometry, devices, camera, lighting, timing, scroll/replay/reduced-motion/fallback unchanged | `s02-hero-fixed-*` uses the same fixture and fixed final/reduced-motion state before and after, including clean `84adcef` captures | No owner redesign is claimed; no pixel-perfect live-device comparison is inferred. |
| Rack + CDU | 48U geometry, CDU, views, water/cabling/manifold/zoom/reset unchanged | `f-rack-fixed-*` uses the same rack-network fixture and state | No redesign is claimed. Targeted contrast matrix is green for measured solid backgrounds; frozen geometry remains a separate assertion. |
| KVM framebuffer | No filter, opacity, recolor or overlay on remote pixels | fake-provider frame plus `kvm-solo-browser.cjs` / `kvm-session.cjs` | Outer chrome only; live framebuffer pixel routing was not exercised. |
| Formal Report / SOP | Data and generator unchanged | Cycle manifest-provided links and SOP reference entry | Entry/viewer presentation only; generator behavior was not modified or live-validated. |

## Program change ledger

| Commit | Files / purpose |
|---|---|
| `9459a3b` | `app.js`, `pa-agent.js`, `telemetry-native.js`, `system-inspection.js`, `inspection-evidence.js`, `cycle-workspace.js`, `topology.js`, related scoped CSS and strict state-truth test: truthful status/copy/delete/missing/truncation/evidence behavior. |
| `84a667b` | `userguide.js`, `userguide_template.html`, `app/qa/userguide.cjs`: align current workflows and lifecycle copy. |
| `56d6fb1` | shared `app.js`, `workspace-ux.js/.css`, `style.css`, modal browser test: focus, IME/Escape, busy/error retention and persistent workspace error. |
| `ffbd901` | `pa-agent.js`, race browser test: session/request identity and stale-response isolation. |
| `537adac` | `app/qa/theme-contract.cjs`: update stale contract assertions after verifying scoped layer order and localized theme labels. |
| `d65d9ee` | `product-detail.js`: preserve reported memory capacity. |
| `ee8fcd5` | `workspace-ux.js`: distinguish unavailable rack height from external placement. |
| `584bea7` | Telemetry/Inspection scoped JS/CSS, two screenshot rounds and browser harness: work-area hierarchy and state rendering. |
| `7f68bd9` | Cycle workspace/console/fleet JS/CSS, dedicated browser harness and screenshots: execution/health/coverage, Console and Evidence feedback. |
| `5e383c0` | Corrected round-1 Telemetry/Inspection baseline artifacts so round 1 points to the real `fe82088` program. |
| `b38646e` | `product-detail.css/.js`: keep Nodes actions reachable in narrow workspaces. |
| `eeed293` | Scope overlay Escape handling; add IME-safe guards for PA Agent, Topology and User Guide; remove the competing legacy global close path. |
| `419f9ca` | Owner-scoped contrast, compact modal/project layout, cache references and localized KVM/overview/topology/equipment styling. |
| `8b0fa16` | Director acceptance harnesses, test outputs, screenshot evidence and documentation; this commit itself introduces no product-code change. |
| `88cf814` | Scope-local Evidence viewer `position:fixed` / `100dvh` viewport containment; no API, data or download-contract change. |
| `84adcef` | Capture assertions for scrolled-page dialog/footer/download reachability and corrected integrated Batch-title/strict read-only Console fixture. |
| `3ef6962` | Walkthrough waits for real User Guide content before asserting; final three-round synthetic path evidence. |

The product changes are committed through `88cf814`; capture/test support is committed through `84adcef`, and the final walkthrough harness through `3ef6962`. The two final broad manifests capture clean program/evidence base `84adcef`; the three-round walkthrough records `3ef6962`, also clean. The new image/manifests and document updates still require their own reviewable evidence-only delivery commit.

## Capture facts and unresolved matrix cells

- Baseline 100%: 138 images, six failed S13 evidence-viewer captures, zero page/console/unknown/external errors on captured images.
- Historical after 100%: 144 images, zero scenario/viewport/zoom failures and zero page/console/unknown/external errors; program identity is the preserved dirty working tree.
- Final clean after 100%: 150 images across 1366/1920/3440 and both themes; app SHA `84adcef`, `dirty:false`, requested/actual zoom `1`, zero scenario/viewport/zoom/page/console/unknown/external/failed-request failures, and `hardwareDispatches:0`.
- Baseline true 125%: 92 images using MV3 `chrome.tabs.setZoom/getZoom`, actual zoom `1.25`, four S13 scenario failures, zero zoom failures.
- Historical after true 125%: 96 images, MV3 `setZoom/getZoom`, actual zoom `1.25`, zero scenario/viewport/zoom/page/console/unknown/external failures; program identity is the preserved dirty working tree.
- Final clean after true 125%: 100 images across 1366/1920 and both themes; app SHA `84adcef`, `dirty:false`, requested/actual zoom `1.25`, zero scenario/viewport/zoom/page/console/unknown/external/failed-request failures, and `hardwareDispatches:0`. S13 Evidence metadata verifies dialog/footer fully in viewport and the download control visible/focusable/in viewport.
- Owner-scoped post-hardening contrast matrices contain 68 PNGs at 100% and 68 at true 125%. Targeted solid-background violations (`backgroundApproximation:null`) are 0 in both. Remaining 473/287 findings use gradient/image background approximations; this is not a complete WCAG sign-off.
- The suspected 1366×768 / true-125% modal-footer clipping was not reproduced by the focused geometry test: 8/8 pass and footer, CTA, final focus target and scroll end are measured reachable. No extra CSS fix was made solely for the legacy screenshot.
- 200% **browser zoom** is captured: 28 site PNGs plus 16 Cycle PNGs, `chrome.tabs.getZoom() = 2`, 1366×768 screenshot / 683×384 CSS viewport, DPR 2, and no unknown/external/page errors. This is not OS text-only scaling or a physical-display test.
- Physical director display/projector and per-monitor scaling: **NOT RUN**. Registry evidence reports Windows AppliedDPI 192 / 200%, with the manifest’s stated per-monitor limitation.
- S08 is covered by dedicated deterministic 100%, true-125% and 200% Cycle harnesses; the generic full-site static harness correctly does not fabricate execution truth.
- The strict S12/S13 surface audit inventories 35 surfaces and records 11 PASS / 0 PARTIAL checks in its claimed deterministic set. It rejects all mutations and unknown/external traffic; inventory-level status remains PARTIAL because it is not every per-owner/role/submit/error cross-product.
- Final integrated walkthrough is **PASS in all three rounds**: each round completes 13/13 named steps from Overview through Guide, including failure/reopen, theme/refresh, single Agent GO→DONE awaiting judgment, multi-select Batch without Agent execution, Cycle PRE/Console/Report entry, control frames and Rack/Topology. Unknown/external/page/console errors are 0 and `staticServer.unknownRequests` is empty. It remains synthetic loopback evidence, not hardware E2E.
- S12 and S13 are not complete; their partial status remains a sign-off blocker.
