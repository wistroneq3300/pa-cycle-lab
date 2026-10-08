# Director sign-off

## Status

# NOT_READY

This status is deliberate. The current build contains meaningful, tested UI/UX improvements, but the mandatory Director gate is not fully evidenced. It must not be represented as `EXEC_DEMO_READY`.

## Version and mode under review

- Branch: `codex/platform-premium-ui-v1`
- Original integration baseline: `186f0373e86768aa19bab36b283c12e79ad43848`
- Phase C/D starting point requested by the user: `fe8208867144b28f4e057606f5e2699b228a8056`
- Latest product-code commit: `88cf814972c9eeccc85c6ca603f425518c5d4541` (scope-local Evidence viewer viewport fix); overlay Escape/IME commit: `eeed293a4afdfdbece3df69acc5d8a0eb5dec107`; preceding visual hardening: `419f9ca071bdabefc2e3e23dc0582bf8154f32ee`.
- Clean broad-capture program/evidence base: `84adcef5f5383cf9737680e7f811a57eeb29783f`. Historical manifests keep their original identities; the final 100% and true-125% manifests both record this exact SHA with `dirty:false`.
- Clean three-round walkthrough harness/program: `3ef6962f793bac5f6df119ed7353a8c9a69607fc`, `dirty:false`.
- Mode: loopback synthetic/static fixtures and fake Terminal/KVM providers. Mock nature is displayed and documented.
- Hardware dispatch count in site manifests: `0`.
- Delivery branch/remote verification is recorded in the final handoff after push; this document does not invent a self-referential final commit or pre-verified remote HEAD.

## Reviewed scope

Evidence exists for the application shell, Overview, Projects, System Overview/Nodes, Inventory/Health, Test Library, PA Agent, dedicated synthetic Cycle, Telemetry, Inspection, Terminal/Broadcast/KVM outer frames, a 35-surface modal inventory with focused deterministic checks, Inspection Evidence, User Guide and Topology. Frozen Hero and Rack use fixed-state comparisons; KVM framebuffer content is not restyled. Focused 100%/125% contrast, modal geometry and 200% browser-zoom evidence are also present.

The strongest verified areas are:

- Test Library none/single/multiple workflow and truthful batch copy.
- PA Agent waiting/done/error/reconnect/attachment presentation and cross-session race isolation.
- Cycle lifecycle/health/coverage separation, 1/4/32/128-node synthetic fixtures, Console copy/error/evidence behavior.
- Telemetry AI truth, READY/STALE/NO_DATA/QUERY_ERROR/NOT_APPLICABLE, and legend visibility isolation.
- Inspection defensive AI rendering and Evidence loading/error/empty copy gating.
- Evidence viewer footer/copy/download reachability at 100% and true 125%, including opening from a scrolled page.
- Modal/overlay IME Escape, regular Escape and focus restore in the claimed 11-check set; true-125% footer/control reachability 8/8.
- Owner-scoped targeted contrast matrix: 0 exact solid-background violations at 100% and true 125%.

## Browser / viewport / zoom evidence

- Browser: Microsoft Edge / Chromium `154.0.4258.62` via Playwright.
- 100% CSS viewports: 1366×768, 1920×1080, 3440×1440; Test Case/Agent also 1600×900 and 2560×1440.
- Themes: light and dark.
- Baseline true 125%: actual `chrome.tabs.getZoom() = 1.25`, MV3 extension method; 92 images.
- Final clean 100%: 150 images across 1366/1920/3440 and both themes; requested/actual zoom `1`; exact app SHA `84adcef`, `dirty:false`, zero scenario/viewport/zoom/page/console/request failures.
- Final clean true 125%: 100 images across 1366/1920 and both themes; requested/actual zoom `1.25` through MV3 `setZoom/getZoom`; exact app SHA `84adcef`, `dirty:false`, zero scenario/viewport/zoom/page/console/request failures. Evidence footer and download control are measured inside the viewport.
- Focused modal 100%/125%: 8/8 before and 8/8 after; 125% CSS viewport approximately 1093×614, footer/CTA/final focus/scroll end reachable.
- 200% browser zoom: 28 site + 16 Cycle PNGs; actual `chrome.tabs.getZoom() = 2`, CSS viewport 683×384 at a 1366×768 screenshot viewport, DPR 2, no unknown/external/page error. This is not OS text-only scaling.
- OS scaling evidence: registry AppliedDPI 192 / 200%; manifest warns this can differ per monitor.
- Physical director display/projector: **NOT RUN**.

## Known blockers

1. S12 modal/drawer/popover matrix remains incomplete at inventory level. All 11 claimed deterministic checks pass, including PA Agent/Topology/User Guide IME Escape, but all 35 owners × roles × submit/error/reopen states were not browser-exercised; several complex surfaces rely on dedicated harnesses.
2. S13 remains incomplete at the full formal Report/SOP matrix level. Inspection Evidence now has loaded/error/reopen/copy gating plus clean 100%/true-125% footer/download reachability, and Cycle links are tested; the production formal Report viewer and every 404/5xx/search/download/save-completion state are still not fully captured.
3. The physical presentation display is untested; the dedicated Test Case/Agent true-125% five-width matrix is not complete beyond current focused/site combinations. The completed 200% run is browser zoom, not an OS text-only or physical-display test.
4. The same-scope 880-case full Python suite remains non-green. Latest full-suite run (`419f9ca`): 585 passed / 194 failed / 1 error / 26 skipped / 74 subtests passed. Exact delta is 4 FAIL → PASS and 2 PASS → FAIL. Unchanged engine hashes and repeated exact tests argue against UI attribution, but both new observations remain recorded. The later `88cf814` CSS-only Evidence fix was browser-verified but did not receive another full Python rerun.
5. Live hardware, Gateway/OpenHands, SSH, RFB, Prometheus/exporter installation and Cycle device execution were intentionally not exercised. Mock acceptance is not hardware E2E.

## Non-blocking truthful limitations

- The full-site static capture harness intentionally marks S08 as a gap instead of inventing Cycle truth; S08 has a separate deterministic fixture.
- The baseline S13 viewer failed six 100% and four 125% scenario captures. Final `84adcef` 100%/true-125% viewer captures and action-reachability assertions succeed, but this does not close the formal Report/SOP matrix.
- Optional `/api/ai/gpu-alerts` was returned as strict 404 in the first-stage fixture rather than a fabricated empty 200.
- Formal report/SOP data/generation, Hero V3, Rack/CDU geometry and KVM framebuffer pixels remain frozen.
- The targeted contrast matrix verifies solid backgrounds after `419f9ca`, but gradient/image approximation and the audit’s exclusions mean full WCAG conformance is not claimed.
- The suspected compact true-125% modal footer defect was not reproduced by the focused geometry/focus matrix; it is closed without a speculative CSS change.
- The final integrated walkthrough passes all 13 named steps in each of three rounds at `3ef6962`, including failure/reopen, theme/refresh, single Agent GO→DONE, multi-select Batch without Agent execution, Cycle/Console/Report entry, control frames, Rack/Topology and Guide. Per-round unknown/external/page/console errors are zero and `staticServer.unknownRequests` is empty; it remains synthetic loopback evidence, not hardware E2E.

## Conditions to change status

`EXEC_DEMO_READY` may be written only after all of the following are satisfied:

- **Satisfied for capture identity:** final 100% and true-125% broad manifests record exact app SHA `84adcef`, `dirty:false`, reviewed representative fixture states and zero capture/runtime/request failures; S13 footer/download reachability is explicitly asserted.
- Complete S12 and S13 evidence or an explicitly approved scope reduction by the owner.
- **Satisfied for synthetic walkthrough:** three recorded full-path rounds pass 13/13 named steps at `3ef6962` with zero unknown/external/page/console errors.
- Final handoff records the pushed delivery SHA and independently verifies the remote branch HEAD.
- No known false success, Target mismatch, inaccessible key evidence or required-workspace blocker.

Until those conditions are met, the only supportable sign-off is **NOT_READY**.
