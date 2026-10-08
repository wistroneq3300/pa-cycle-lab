# Director sign-off

## Status

# NOT_READY

This status is deliberate. The current build contains meaningful, tested UI/UX improvements, but the mandatory Director gate is not fully evidenced. It must not be represented as `EXEC_DEMO_READY`.

## Version and mode under review

- Branch: `codex/platform-premium-ui-v1`
- Original integration baseline: `186f0373e86768aa19bab36b283c12e79ad43848`
- Phase C/D starting point requested by the user: `fe8208867144b28f4e057606f5e2699b228a8056`
- Latest committed product program: `419f9ca071bdabefc2e3e23dc0582bf8154f32ee`; overlay Escape/IME commit: `eeed293a4afdfdbece3df69acc5d8a0eb5dec107`.
- Broad/focused manifests retain capture-time `b38646e`, `eeed293` or `419f9ca` with `dirty:true`; they are **not immutable final-release-SHA captures**.
- Mode: loopback synthetic/static fixtures and fake Terminal/KVM providers. Mock nature is displayed and documented.
- Hardware dispatch count in site manifests: `0`.
- Final branch commit and verified remote HEAD: **PENDING root integration/commit/push**.

## Reviewed scope

Evidence exists for the application shell, Overview, Projects, System Overview/Nodes, Inventory/Health, Test Library, PA Agent, dedicated synthetic Cycle, Telemetry, Inspection, Terminal/Broadcast/KVM outer frames, a 35-surface modal inventory with focused deterministic checks, Inspection Evidence, User Guide and Topology. Frozen Hero and Rack use fixed-state comparisons; KVM framebuffer content is not restyled. Focused 100%/125% contrast, modal geometry and 200% browser-zoom evidence are also present.

The strongest verified areas are:

- Test Library none/single/multiple workflow and truthful batch copy.
- PA Agent waiting/done/error/reconnect/attachment presentation and cross-session race isolation.
- Cycle lifecycle/health/coverage separation, 1/4/32/128-node synthetic fixtures, Console copy/error/evidence behavior.
- Telemetry AI truth, READY/STALE/NO_DATA/QUERY_ERROR/NOT_APPLICABLE, and legend visibility isolation.
- Inspection defensive AI rendering and Evidence loading/error/empty copy gating.
- Modal/overlay IME Escape, regular Escape and focus restore in the claimed 11-check set; true-125% footer/control reachability 8/8.
- Owner-scoped targeted contrast matrix: 0 exact solid-background violations at 100% and true 125%.

## Browser / viewport / zoom evidence

- Browser: Microsoft Edge / Chromium `154.0.4258.62` via Playwright.
- 100% CSS viewports: 1366×768, 1920×1080, 3440×1440; Test Case/Agent also 1600×900 and 2560×1440.
- Themes: light and dark.
- Baseline true 125%: actual `chrome.tabs.getZoom() = 1.25`, MV3 extension method; 92 images.
- After true 125%: 96 images, requested/actual `1.25`, zero capture/runtime/zoom failures; the app identity is still dirty and therefore not final-SHA evidence.
- Focused modal 100%/125%: 8/8 before and 8/8 after; 125% CSS viewport approximately 1093×614, footer/CTA/final focus/scroll end reachable.
- 200% browser zoom: 28 site + 16 Cycle PNGs; actual `chrome.tabs.getZoom() = 2`, CSS viewport 683×384 at a 1366×768 screenshot viewport, DPR 2, no unknown/external/page error. This is not OS text-only scaling.
- OS scaling evidence: registry AppliedDPI 192 / 200%; manifest warns this can differ per monitor.
- Physical director display/projector: **NOT RUN**.

## Known blockers

1. S12 modal/drawer/popover matrix remains incomplete at inventory level. All 11 claimed deterministic checks pass, including PA Agent/Topology/User Guide IME Escape, but all 35 owners × roles × submit/error/reopen states were not browser-exercised; several complex surfaces rely on dedicated harnesses.
2. S13 is incomplete. Inspection Evidence and Cycle links are tested, but formal Report/SOP viewer states and every 403/404/5xx/long/search/download state are not fully captured.
3. The 100% and true-125% after screenshot manifests are tied to a dirty working tree rather than the final clean SHA.
4. The physical presentation display is untested; the dedicated Test Case/Agent true-125% five-width matrix is not complete beyond current focused/site combinations. The completed 200% run is browser zoom, not an OS text-only or physical-display test.
5. The same-scope 880-case full Python suite remains non-green. Final: 585 passed / 194 failed / 1 error / 26 skipped / 74 subtests passed. Exact delta is 4 FAIL → PASS and 2 PASS → FAIL. Unchanged engine hashes and repeated exact tests argue against UI attribution, but both new observations remain recorded.
6. The required integrated walkthrough is **FAIL in all three recorded rounds**. The first eight steps pass consistently, including persistent Evidence 503→reopen success and single Agent GO→DONE awaiting judgment. The multi-select Batch CTA copy is correct, but its click produces no recognizable confirm/result within 15 seconds; Cycle, Terminal/KVM, Rack, Topology and Guide are consequently NOT-RUN in the continuous path. Static external/page/unknown counts are zero, but provider trace was not harvested and is not independent proof.
7. Live hardware, Gateway/OpenHands, SSH, RFB, Prometheus/exporter installation and Cycle device execution were intentionally not exercised. Mock acceptance is not hardware E2E.

## Non-blocking truthful limitations

- The full-site static capture harness intentionally marks S08 as a gap instead of inventing Cycle truth; S08 has a separate deterministic fixture.
- The baseline S13 viewer failed six 100% and four 125% scenario captures. The current after 100% viewer succeeds, but this does not close the formal report matrix.
- Optional `/api/ai/gpu-alerts` was returned as strict 404 in the first-stage fixture rather than a fabricated empty 200.
- Formal report/SOP data/generation, Hero V3, Rack/CDU geometry and KVM framebuffer pixels remain frozen.
- The targeted contrast matrix verifies solid backgrounds after `419f9ca`, but gradient/image approximation and the audit’s exclusions mean full WCAG conformance is not claimed.
- The suspected compact true-125% modal footer defect was not reproduced by the focused geometry/focus matrix; it is closed without a speculative CSS change.

## Conditions to change status

`EXEC_DEMO_READY` may be written only after all of the following are attached to the final clean commit:

- Final 100% and true-125% after manifests with exact SHA, no dirty flag, and reviewed images.
- Complete S12 and S13 evidence or an explicitly approved scope reduction by the owner.
- Three recorded **passing** full-path walkthroughs; the current 3/3 Batch-stop result does not satisfy this condition.
- Final action parity and test results updated with the pushed SHA and remote HEAD.
- No known false success, Target mismatch, inaccessible key evidence or required-workspace blocker.

Until those conditions are met, the only supportable sign-off is **NOT_READY**.
