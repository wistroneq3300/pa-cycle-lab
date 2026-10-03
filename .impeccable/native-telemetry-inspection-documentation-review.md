# Native Telemetry and Inspection documentation review

Date: 2026-10-04. Mode: Operate. Verdict: documentation complete for this scoped extension, including GPU manual setup help; visual ship disposition accepted with the limits below.

## Overview

The incumbent PA Server Manager Next Wistron desktop remains the visual authority. `DESIGN.md`, `.impeccable/design.json`, and `.impeccable/native-cycle-surface.md` remain intact. This record describes an ordinary Telemetry / Inspection extension; it neither replaces the visual world nor promotes the separate design preview into production authority. The historical modal appendix in DESIGN.md remains historical.

The documenter workflow in `C:/Users/kobei/.codex/skills/impeccable/reference/document.md` informed the extraction. The assigned scope explicitly limits writing to this review, so this is an additive implementation record rather than a global DESIGN.md refresh or regenerated component sidecar. No new qualitative identity decision is required.

Source provenance: `app/static/js/telemetry-native.js`, `telemetry-provision.js`, `system-inspection.js`, and `inspection-evidence.js`; scoped styles `app/static/css/telemetry-native.css` and `inspection-refinement.css`; inherited status tokens in `app/static/css/telemetry-provision.css`. The rendered final theme cascade described by DESIGN.md remains authoritative over isolated base stylesheet values.

## Colors

Primary actions and links inherit the incumbent Wistron green / blue language. Panels, evidence, text, borders, and secondary labels resolve existing `--card`, `--bg`, `--text`, `--border`, and `--muted` variables; chart panels fall back from `--card` to `--bg`. Graphite dark and light application materials are retained.

Telemetry status text inherits its existing workspace tokens: information, warning, and failure use `--tp-info`, `--tp-warn`, and `--tp-fail`. Their light values are #176281, #855715, and #ac343b; dark values are #77c8ee, #edc477, and #ff929c. These are source-derived workspace values, not additions to the global palette.

The chart renderer owns an eight-color categorical series palette (#2785ad, #329780, #ba8533, #8566b0, #bf6473, #547eb8, #878537, #7c7470). It repeats by series index, with written series identities and latest values in the legend. Chart ink / grid colors are local literals: light #526975 / #e4ecef, dark #afc1cc / #263b47. These visualization values do not imply health classifications.

Evidence focus uses a local #2c8ba7 outline. AI unavailable/error text resolves `--danger` with #c34650 as fallback. These literals remain recorded as scoped drift rather than silently normalized into global tokens.

## Typography

Application prose inherits the system font identity. Telemetry titles use 19px; panel titles use 14px / 650; status and legend text use 11px. Legend values use `ui-monospace, Consolas, monospace` with tabular numerals. Inspection advisory sections use 13px prose with 12px supporting basis/state text. The evidence heading is 20px, and its selectable preformatted text uses 12px / 1.75 monospace. These values describe the actual local implementation, not a replacement type ramp.

## Layout

Telemetry presents eight chart areas in the reviewed state. The renderer is driven by the returned panel list rather than a hard-coded eight-panel frontend array. The two-column grid has a 20px gap, 16px panel insets, and 180px plots. At viewport widths of at least 1700px, plot height becomes 220px and grid gap 24px; at 1100px or below it becomes one column. Legends wrap and scroll within 92px. Node statistics wrap above the chart grid.

Inspection keeps rule facts, observation timing, source evidence, advisory analysis, and issue actions within the native detail surface. The analysis places possible causes and recommended checks in two columns; conclusion, confidence, and basis span both columns. At 1100px or below this becomes one column.

The raw-evidence dialog is bounded to the smaller of 1160px or viewport width minus 48px and the smaller of 740px or viewport height minus 48px. Its header, search toolbar, status, scrollable text region, and footer provide a stable reading structure. Desktop acceptance covers 1920 and 1366 widths only; responsive CSS does not establish mobile acceptance.

## Elevation & Depth

Chart and analysis regions use inherited tonal surfaces and borders rather than a new shadow system. The evidence dialog adds a translucent dark backdrop (`rgb(8 20 28 / 64%)`). It has no new explicit shadow. No image asset or decorative raster was introduced by these components.

## Shapes

Actual scoped corners are 12px for chart panels, 10px for the advisory region, and 14px for the evidence dialog; search fields use 6px. The larger values are outside the incumbent documented global radius scale and remain local observations.

## Components

- **Native Telemetry dashboard:** the provision surface mounts and disposes one chart owner. It offers 1h, 6h, 24h, and 7d periods, node metadata, freshness labels, and explicit loading/no-data/stale/query-error/not-applicable states. Theme changes repaint chart axes. Multi-GPU series have written labels, latest values, and button legends with `aria-pressed`; buttons toggle visibility. The current repaint rebuilds legends, so persistent manual hiding across refreshes is not claimed. Refresh is scheduled every 30 seconds; these code observations are not backend correctness certification.
- **Structured advisory analysis:** possible causes, recommended checks, conclusion, confidence, and analysis basis are readable sections rather than raw JSON. Queued, running, complete, unavailable, and error states remain written. The existing wording states that AI suggestions do not alter rule determinations. Analysis completion is not hardware PASS. Reanalysis updates the advisory region, while saved issue facts and evidence remain separately visible.
- **Native raw-evidence reader:** a native dialog renders evidence through `textContent` in a selectable, scrollable preformatted region. Search and next-match operate on the loaded text; copy operates on that text; the download action addresses the complete evidence. The UI explicitly identifies the 256 KB preview limit when the response is truncated. Close and Escape abort loading and restore focus to the opener or surviving evidence action. Native modal behavior and explicit Tab wrapping are implemented; screenshots alone do not verify keyboard behavior.
- **GPU manual setup help:** an inline native disclosure before the chart grid explains GPU monitoring failures while preserving independently usable Host READY charts. It is hidden for GPU READY, NOT_APPLICABLE, and VERIFYING states, or missing setup metadata; CPU-only nodes remain not applicable. Content comes from snapshot `gpu_setup` metadata and the actual PA `location.origin`: configured central Prometheus, canonical node metrics endpoint, detection command, configured pinned Docker command or an explicit version placeholder, official NVIDIA documentation link, and a curl check from the PA / central monitoring host. The guide identifies Prometheus pull behavior, existing runtime prerequisites, healthy exporter reuse, and re-enabling Telemetry to register and verify the same node. It does not claim that displaying these instructions installs or validates the exporter.

The added disclosure retains inherited border and information-link colors, an 8px corner radius, 14px / 16px padding, and 13px / 1.7 prose. Commands use wrapping 12px / 1.7 monospace text with a 12px inset, allowing long endpoints to remain readable. Its neutral one-pixel border is the final state: the review-requested removal of a three-pixel left stripe was implemented before recapture. This is a scoped help component, not a new warning decoration or global material rule.

## Do's and Don'ts

- Preserve the incumbent final light/dark cascade and scope future changes to these surfaces.
- Keep written freshness, series identity, advisory status, and evidence provenance adjacent to their data.
- Treat this file as a descriptive extension record; do not infer authorization to rewrite the global design contract.
- Do not equate advisory completion, a rendered chart, or a green status with equipment health certification.

`artifacts/refinement-design-detector.json` reports seven advisory findings: Telemetry radius 12px and type size 11px; Inspection colors #2c8ba7 and #c34650, radii 14px and 10px, and heading size 20px. They are recorded above without modifying runtime or incumbent global design files. The detector's scope is limited: chart JavaScript literals are also documented here even though absent from its CSS advisory list. A documented observation does not automatically make an exception globally normative.

The independent visual reviewer supplied a **ship** disposition for all 12 valid screenshots, with no material fix requested. Evidence is `artifacts/native-refinement/{native-telemetry,inspection-ai,raw-evidence}-{1920,1366}-{light,dark}.png`: three surfaces, two desktop widths, and two themes. These are application capture artifacts, not shipping raster design assets. This documentation review verified the matrix filenames and extracted source values; it relies on that independent reviewer for screenshot visual acceptance.

The 2026-10-04 addition contributes four further captures: `artifacts/native-refinement/gpu-manual-help-{1920,1366}-{light,dark}.png`. The independent reviewer requested removal of the help disclosure's three-pixel left stripe; all four captures were regenerated after removal, and the reviewer reported the fix resolved with a scoped ship disposition. The final evidence matrix therefore contains 16 screenshots across four surfaces, two widths, and two themes. The parent task also reports five browser scenario groups PASS with zero errors. This is supplied browser verification evidence, distinct from the visual review; this documentation pass inspected the final help source and confirmed the four filenames, without rerunning those scenarios.

The disposition is explicitly **visual only**. It does not certify production queries, real hardware telemetry, inspection rules, AI factual accuracy, permissions, clipboard/download behavior, or complete accessibility. No additional backend or operational acceptance is inferred. The documentation gate is complete for this scoped state; the seven advisory token differences remain disclosed without a global rewrite.
