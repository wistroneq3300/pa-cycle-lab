# Validation Console extension documentation review

Date: 2026-10-03. Ordinary extension of the mature Wistron desktop instrument
interface. `PRODUCT.md`, incumbent `DESIGN.md`, and `.impeccable/design.json`
remain the global authority and are unchanged by this documentation pass.
This note records the local extension, not a new design system or token migration.

## Ownership and interaction boundary

- `app/static/css/validation-console.css` owns shared presentation primitives,
  including theme pairs, severity, log columns, compact desktop layout and
  reduced-motion treatment. The `--pav-*` namespace is consumed by the Console
  surfaces; declarations on `:root` do not replace the shell's existing tokens.
- `app/static/js/telemetry-provision.js` owns the Telemetry `<dialog>` inside its
  existing view: six named pipeline stages, explicit close, ESC, focus return,
  native modal background behavior and Tab wrapping. Closing dismisses the
  viewer. Same-node view restoration retains filter/pause/cursor context.
  Data Pipeline READY remains separate from Grafana visualization confirmation.
- `app/static/js/cycle-console.js` owns the inline, read-only Cycle Console,
  including Summary/Full selection, pause/follow, search, history, reconnect,
  immutable source events, evidence links and retained-log download. Viewer
  closure is separate from job lifecycle. It retains the 3,000-event buffer and
  2,000-row rendering bounds.
- `app/static/js/cycle-fleet.js` owns a read-only presentation of canonical
  targets, node snapshots and typed completion markers. One node has target
  context without a fleet selector; 2–8 nodes use compact chips; larger fleets
  add counts, chassis/status/search filters, Needs Attention and a lazy matrix.
  Completion, recovery and cumulative health remain separate written states.

No new shared JavaScript framework, engine behavior or global shell identity is
established by these presentation rules. The delivery's runtime boundary and
test accounting belong to `docs/VALIDATION_CONSOLE_REFINEMENT.md`.

## Observed local tokens and material

These values describe the shipped Console stylesheet, not additions to the
normative global frontmatter.

| Token role (`--pav-`) | Light | Dark |
|---|---|---|
| `bg` | `#f4f8fa` | `#10212b` |
| `ink` | `#193c4b` | `#dceaf0` |
| `muted` | `#526b78` | `#a2bac7` |
| `line` | `#d1dfe5` | `#304652` |
| `info` | `#176281` | `#77c8ee` |
| `pass` | `#246542` | `#9ccaa5` |
| `warn` | `#855715` | `#edc477` |
| `fail` | `#ac343b` | `#ff929c` |

The extension keeps pearl and graphite/blue-black instrument surfaces, quiet
separators, written severity labels and inherited Wistron primary actions.
Cycle log rows use `Consolas,"Cascadia Mono",monospace`, 12px/1.65, with tabular
numbers. The local heading uses 17px/1.4 at weight 650; controls and routine
supporting text use 12px. Ten-pixel column/severity labels and 11px metadata are
intentional compact instrument density, not a new global body-text scale.

Cycle's Console frame is locally 12px rounded, controls 5px and severity labels
3px. These local radius and density choices do not revise incumbent global
radii. Cycle has a 440px log viewport, a matrix bounded at 260px and attention
content bounded at 160px, with local scrolling. The surrounding page can scroll.

Telemetry uses 1240×740px caps at wider desktop sizes. The compact rule at
1450px and below fills viewport width/height minus 48px; thus its 1366×768
layout is 1318×720px. This is a local modal rule, not a global breakpoint change.
The dark backdrop uses restrained blur and translucency. Modal entry is 150ms,
new-row opacity is 100ms, and the small active indicator pulses over 2s. Reduced
motion removes those animations. Scan lines, glowing title/newest-row treatment
and a blinking cursor are not part of this extension.

Explicit local `!important` state overrides counter the inherited `.btn`
cascade for Cycle pressed controls and WARN/FAIL attention buttons. This is a
scoped compatibility repair: the shell button cascade remains unchanged.

## Evidence checked

Read `PRODUCT.md`, `DESIGN.md`, `.impeccable/design.json`, the four implementation
files above, and `docs/VALIDATION_CONSOLE_REFINEMENT.md`. Applied the installed
Impeccable `reference/document.md` and `agents/impeccable-documenter.md` ordinary
extension rule. The requested `degraded/documenter.md` is absent in this skill
installation; no substitute instruction was invented.

Inspected the following actual production frontend captures under
`artifacts/validation-console/`:

- `cycle-128-1366-dark.png`: dense fleet counts, typed pipeline, distinguishable
  amber/red attention buttons, pressed Summary/follow/ALL, and inline log.
- `cycle-1-1920-light.png`: single-target context, no redundant fleet selector,
  quiet light panel, explicit rows and evidence links.
- `telemetry-ready-1366-light.png`: compact modal, six ready stages, bounded log,
  available footer controls and visible focused close control.
- `telemetry-ready-1920-dark.png`: centered wider-desktop modal, graphite
  material, preserved Wistron action and restrained separation from background.

The artifact directory also contains both sizes and themes for Telemetry and
Cycle single/128-node states, plus 4/32-node, expanded-matrix and failure states.
`results.json` reports PASS with an empty browser-error list; `contracts.json`
reports PASS for event immutability, focus survival, evidence download,
reconnect, lazy matrix, Telemetry pause/copy and reduced-motion checks. This
documentation pass reads those results; it does not claim to rerun the suites.
The final requirement report owns exact test counts, baseline failures and
post-review verification status.

Evidence uses production frontend assets with an isolated synthetic backend,
persistent test SQLite and fake transport. Grafana iframe content is a harness
stand-in. It establishes no live hardware, installed exporter, production
Prometheus/Grafana, browser login/CSP or 128-node hardware acceptance. No design
score is inferred from passing automated checks or screenshots.

## Scoped exceptions and unreconciled record drift

The incumbent `DESIGN.md` describes the earlier Console's 400px viewport and
8px frame; its sidecar retains the earlier four-column Console snippet and
`--log-*` severity vocabulary. The current local extension has a 440px viewport,
12px frame, six columns and `--pav-*` palette. The historical modal appendix is
already non-normative. Preserve these incumbent files in this ordinary extension;
this note makes the scoped divergence explicit without silently refreshing them.

Existing shell typography, uppercase labels and compact-radius advisories are
not promoted into new global prescriptions or repaired as an unrelated redesign.
The reviewer-reported neutral attention/pressed-button cascade issue has local
source fixes and is visibly corrected in the inspected Cycle captures. This
note does not turn an inherited defect into a reusable design rule.
