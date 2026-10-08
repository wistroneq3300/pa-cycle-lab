# Director visual review

## Method and limitations

The review used rendered PNGs, not design mockups or ImageGen. Baseline and after use the same `director-static-preview-v1/rack-network/fake-provider-v1` fixture. Hero is fixed at final progress with reduced motion; Rack uses the same rack-network fixture. Full-site screenshots were generated at 1366×768, 1920×1080 and 3440×1440, light/dark, 100% browser zoom. Test Case / Agent additionally have 1600×900 and 2560×1440 first-stage captures. Later focused matrices add true 125% modal/Cycle/contrast evidence and 200% browser-zoom site/Cycle evidence.

The original site manifests exposed real solid-background contrast failures. Owner-scoped hardening in `419f9ca` is followed by focused 100%/true-125% matrices with zero targeted solid-background violations. The audit remains partial—not full WCAG—and S12/S13 plus clean-final-SHA evidence remain incomplete, so this is not a whole-site visual PASS.

## First review round: findings

The following are concrete findings from rendered or dedicated-fixture views, not generic design adjectives.

| Area | Evidence viewed | Finding |
|---|---|---|
| Test Case | `screens/before/test-case-{category,none,single,multiple}-*` | Long criteria competed with the list; selection vs inspected state and next action were not sufficiently distinct at compact desktop. |
| PA Agent | `screens/before/pa-agent-waiting-*` | Context, conversation and composer did not read as one mission workspace; long tool/evidence output had no visible disclosure of the preview boundary. |
| Telemetry READY | `director-telemetry-inspection-round1/telemetry-ready-1920-light.png` | Two large exporter/setup cards controlled the first viewport even when both sources were READY. AI appeared before the charts; readiness/current values were compressed into one dense text line. |
| Telemetry exceptional states | Round-1 `telemetry-{stale,no-data,query-error,not-applicable}-1366-dark.png` | State copy was present, but operational priority and component distinction needed a quieter, consistent hierarchy. |
| Inspection | Round-1 `inspection-current-1920-light.png` and `inspection-error-1366-dark.png` | Severity, long component/rule ID, observed fact, evidence source and AI result ran together. The long identifier dominated scanning; AI failure needed clearer separation from the rule verdict. |
| Cycle | Source-backed first review plus 1366/1920 dedicated fixture | Summary could collapse task lifecycle, hardware health and coverage; fleet filtering did not scale calmly to 128 nodes; Pause/close Console wording and copy/evidence error feedback were too easy to misunderstand. A round-1 Cycle PNG set was not preserved, so this is not claimed as an image pair. |
| System Nodes | `director-site-before-fe82088/s04-system-nodes-1366x768-{light,dark}.png` | At compact desktop the operation side region could become visually clipped and make actions hard to reach. |
| Evidence viewer | Baseline manifest scenario failures | All six baseline evidence-viewer capture attempts timed out waiting for the loaded state, so baseline evidence is a recorded failure rather than a fabricated screenshot. |
| Shared dialog / project modal | Source review plus `director-modal-surfaces/05-project-management-long.png` | Common dialog needed a defined focus lifecycle and IME-safe Escape. The actual 500px project modal forced a long project name to wrap nearly word-by-word and compressed the action column. One modal still could not stand in for the entire S12 inventory. |

## Second review round: implemented changes and recheck

| Area | What changed | Round-2 evidence and observed improvement | Remaining issue |
|---|---|---|---|
| Test Case | Viewport-aware list/detail, stronger criteria priority, selection/inspection distinction, exact none/single/multiple CTA. | `screens/after/test-case-*` across five widths/themes; current site `s06-*`. Initial detail viewport exposes criteria and the action bar stays tied to selection. | Full library load failure is not represented at every size. |
| PA Agent | Stable context strip, 36/64 workspace, reading-first Agent messages, neutral DONE, persistent error/reconnect, output preview disclosure/full loaded expansion. | `screens/after/pa-agent-{waiting,done,error,reconnect,attachments}-*`; current `s07-pa-agent-*`. DONE reads “待工程師判定,” not PASS. | Live provider behavior is deliberately untested. |
| Telemetry | READY order changed to Node/time/freshness → metrics/charts → AI → exporter setup. Readiness values became a readable grid; chart legends use stable series identity. | `director-telemetry-inspection-round2/telemetry-ready-1920-light.png`: charts and actual values now occupy the primary work area; setup falls below. Exceptional-state screenshots retain explicit state/reason. | At 1366 the first viewport necessarily clips below-fold setup; this is intentional content priority, not removal. Contrast findings still need owner-by-owner work. |
| Inspection | Long rule ID moved to a separate monospace row; observed fact, timestamps, source evidence and AI auxiliary judgment are separate blocks. | Round-2 `inspection-current-1920-light.png`, `inspection-ai-missing-1920-light.png`, `inspection-error-1366-dark.png`, `inspection-recovered-1920-light.png`. Missing optional fields do not show literals. | Complete archive/delete/role matrix not captured. |
| Cycle | Lifecycle/health/coverage split; 1/4-node chips and 128-node summary/filter/matrix refined; Console labels say pause view/close does not stop; evidence and clipboard failures persist. | In addition to `cycle-after/*`, I reviewed `cycle-before-fe82088/run-console-1366-dark.png` and `cycle-after-zoom125/run-console-1366-dark.png`: current view separates Health PASS/WARN/FAIL, stages and console controls more clearly. Baseline and true-125% each have 16 PNGs; full-event counts are 6/21/145/500 for 1/4/32/128 Nodes. A 200% set adds 16 PNGs. | Synthetic loopback only; no live engine/hardware run. Baseline current-contract wording mismatch is preserved in metadata. |
| System Nodes | Local grid minimum width/overflow and side-operation behavior adjusted, without changing target or handlers. | `director-site-after-b38646e/s04-system-nodes-1366x768-*` compared with baseline. Actions remain reachable in the reviewed compact layout; true-125 harness also asserts focusable region, zero body overflow and visible final action. | After captures are tied to a dirty working tree; clean-SHA recapture remains. |
| Modal surfaces | `eeed293` removes the competing legacy Escape closer and adds scoped IME guards; `419f9ca` keeps the project-only compact layout/contrast fix. | I reviewed the project before/after plus true-125% connection and Test Assignment images. At approximately 1093×614 CSS viewport, the footer and CTA remain visible and the body owns scrolling. Strict audit has 11/11 deterministic PASS, including Agent/Topology/Guide IME Escape and focus restore; focused modal zoom is 8/8 PASS. | All 35 owner × role × submit/error/reopen combinations are not covered, so inventory-level S12 remains PARTIAL. |
| Evidence viewer | Explicit loading/loaded-empty/error/truncated states; copy disabled until loaded non-empty; source/time/preview/full download copy clarified. | After site has `s13-evidence-viewer-*` at all six 100% combinations. I also viewed `director-modal-surfaces/07-evidence-loaded-long.png` and `08-evidence-source-error.png`: long raw data stays inside the viewer, while 403 preserves the reason and disabled copy controls. Strict checks cover reopen/focus/Escape/restore. | Formal Report/SOP full state matrix incomplete. |
| User Guide | Workflow names and safety semantics aligned with current UI, including single vs multi, OK/GO and DONE vs PASS. | `s14-user-guide-*` at 1366/1920/3440, both themes. Reading width remains bounded. | Search/error lifecycle not exhaustive. |
| Topology | Kept existing line semantics; Ping summary now says reachability rather than validation success. | `s15-topology-*` at three widths/themes. The strict surface audit also renders the long unsaved editor and passes nested cancel/draft retention, IME-safe Escape, regular Escape and focus restore. | Large-line stress and every nested-confirmation permutation remain unclaimed. |
| Terminal / Broadcast / KVM | Existing outer frames retained; Target/state and “全部顯示” vs “廣播全部” remain distinct. Framebuffer is not themed. | `s11-{terminal,broadcast,kvm}-frame-*`, fake provider only. | No live transport/input coordinate verification. |

## Full-site retained-area review

The 100% after manifest contains 144 images and reports no scenario, viewport, browser-zoom, page, console, unknown-request or external-request failure. This is useful capture integrity evidence, but the following retained areas are only accepted **for the fixture and viewport shown**:

- S01 shell: active navigation remains quiet and aligned; long-route variants are not all separately tested.
- S02 below-Hero summary: no fake health/AI score was introduced. Hero remains frozen.
- S03 project tables: wide screens are used by the table instead of converting rows into cards.
- S05 inventory: long fixture values wrap without replacing missing data with zero.
- S11 remote-control surfaces: the provider labels itself as a design preview/fake provider; no remote pixels were restyled.
- S15 topology: planned lines, Ping result and unconfigured management addresses remain different concepts.

## Frozen-region review

- Hero baseline/after images use the same final/reduced-motion state. No claim is based on different animation frames.
- Rack baseline/after images use the same fixture. No Rack/CDU geometry redesign is claimed.
- KVM captures use a fake provider. No filter, opacity, recolor or decorative framebuffer overlay was added.
- Formal report and SOP generation/data were not changed; only entry/viewer presentation is in review scope.

## Zoom and contrast review

- True 125% **baseline** is proven by the MV3 extension manifest: requested `1.25`, actual `chrome.tabs.getZoom() = 1.25`, 92 captures, zero zoom failures. It is not device-scale-factor substitution.
- True 125% **after**: 96 images using the same MV3 method, requested/actual `1.25`, zero scenario/viewport/zoom/page/console/unknown/external failures. The manifest still records a dirty working tree rather than the final clean SHA.
- The suspected 1366×768 / true-125% modal-footer issue is closed as **not reproduced** by measured evidence, not by visual assumption: the focused 8/8 matrix verifies backdrop/top point, modal, footer, CTA, final focus and body scroll-end reachability. The legacy image lacked rect/source hashes; no speculative CSS fix was added for it.
- 200% browser zoom is exercised with 28 site PNGs and 16 Cycle PNGs. `chrome.tabs.getZoom() = 2`; screenshot viewport 1366×768 maps to 683×384 CSS px with DPR 2. I reviewed the 200% PA Agent and Cycle Console captures: content reflows/scrolls and controls remain legible, but the desktop composition is intentionally not preserved. This is browser zoom—not OS text-only scaling or a physical-display pass.
- The original broad manifests recorded 393 exact-background failures at 100% and 130 at 125%. After `419f9ca`, the focused 68-PNG 100% and 68-PNG true-125% matrices have **0 targeted solid-background violations**. They still report 473/287 gradient/image-approximated findings and exclude several media/effect cases, so full WCAG is not claimed.
- Physical director display/projector was not tested. Windows registry reports AppliedDPI 192 / 200%, explicitly noted as potentially different from per-monitor scaling.

## Integrated walkthrough review

`screens/director-walkthrough/metadata.json` records three consistent FAIL rounds on `419f9ca + dirty`. The first eight steps pass in every round: Overview/theme/refresh; Project→System→Node→Inventory; persistent Inspection Evidence 503 followed by successful reopen; Telemetry READY; single-case Agent GO→DONE awaiting judgment; and Agent close/reopen. I reviewed `round-1-evidence-error.png` and `round-1-agent-done.png`: the source error remains explicit, and DONE remains neutral “待工程師判定,” not PASS.

The ninth step fails in every round: multi-select Batch CTA wording is correct, but clicking it does not produce a recognizable confirm/result within 15 seconds. The run stops on that failure, so Cycle, Terminal/KVM, Rack, Topology and Guide are **NOT-RUN** in the integrated path. Static external/page/unknown counts are zero, but the provider trace was not harvested and is not treated as independent proof.

## Review conclusion

The reviewed work materially improves information order and truthful feedback in Test Case, Agent, Cycle, Telemetry, Inspection and Evidence. It also preserves the established shell, projects, control frames and topology without inventing data. The targeted contrast and modal/zoom defects now have supporting closure evidence. The visual review is nevertheless **not complete enough for EXEC_DEMO_READY**: the integrated walkthrough fails 3/3 at Batch and never reaches later required surfaces; S12’s full owner/role/error matrix and S13 remain incomplete; final broad captures are not tied to a clean final SHA; the physical display is untested; and the full suite is red.
