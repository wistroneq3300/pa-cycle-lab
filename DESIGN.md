---
name: PA Cycle Lab — Next native workspace
description: Wistron desktop engineering surfaces with a scoped native Cycle workspace.
colors:
  wistron-blue: "#006c93"
  wistron-green: "#a1cc56"
  light-bg: "#edf0ef"
  light-panel: "#f7f8f6"
  light-text: "#18333f"
  light-border: "#becbd0"
  dark-bg: "#091017"
  dark-panel: "#111b23"
  dark-text: "#e7edf0"
  dark-border: "#30414b"
  cycle-link-light: "#006c93"
  cycle-link-dark: "#b8e6f8"
  cycle-muted-light: "#45616d"
  cycle-muted-dark: "#abc0ca"
  cycle-warning-light: "#785016"
  cycle-warning-dark: "#f3cc87"
  cycle-failure-light: "#9a302b"
  cycle-failure-dark: "#ffb4ae"
  log-pass-light: "#18713d"
  log-pass-dark: "#72dfa0"
  log-info-light: "#006c91"
  log-info-dark: "#72d4f4"
  log-wait-light: "#855300"
  log-wait-dark: "#f4c56a"
  log-failure-light: "#bc2635"
  log-failure-dark: "#ff939d"
  log-phase-light: "#7545a9"
  log-phase-dark: "#c7a7fa"
typography:
  body:
    fontFamily: '"Segoe UI Variable","Segoe UI","Microsoft JhengHei",sans-serif'
    fontSize: "13px"
  cycle-body:
    fontSize: "14px"
    lineHeight: 1.6
  cycle-headline:
    fontSize: "28px"
  cycle-title:
    fontSize: "19px"
  cycle-node-title:
    fontSize: "15px"
  control:
    fontSize: "12px"
  console:
    fontFamily: 'Consolas,"Courier New",monospace'
    fontSize: "12px"
    lineHeight: 1.65
rounded:
  button: "5px"
  field: "6px"
  panel: "8px"
spacing:
  label-gap: "6px"
  tool-gap: "8px"
  action-gap: "12px"
  form-gap: "16px"
  console-inset: "18px"
components:
  cycle-field-light:
    backgroundColor: "{colors.light-panel}"
    textColor: "{colors.light-text}"
    rounded: "{rounded.field}"
    padding: "9px"
  cycle-field-dark:
    backgroundColor: "{colors.dark-panel}"
    textColor: "{colors.dark-text}"
    rounded: "{rounded.field}"
    padding: "9px"
  cycle-node:
    rounded: "{rounded.field}"
    padding: "12px"
  cycle-console:
    rounded: "{rounded.panel}"
    padding: "{spacing.console-inset}"
    typography: "{typography.console}"
---

# Design System: PA Cycle Lab — Next native workspace

## Overview

The existing PA Server Manager Next desktop is the visual authority: Wistron
blue and green, graphite equipment surfaces in dark mode, and pearl / brushed
metal application surfaces in light mode. Cycle is an ordinary extension of
that application. The Rack 3D equipment materials and existing imagery retain
their identity; the separate design-preview proposal is not a production spec.

This document merges the native extension into the existing record. The original
modal documentation is preserved verbatim in the historical appendix below and
is non-normative for current native routes. [PRODUCT.md](PRODUCT.md) defines the
product boundary; [.impeccable/native-cycle-surface.md](.impeccable/native-cycle-surface.md)
owns the route-specific surface contract. No new visual identity was introduced.

The production stylesheet order in `app/static/index.html` is authoritative:
`style.css`, `product.css`, `cinematic.css`, then `wistron-light.css` and the
remaining scoped workspaces. Do not extract base `style.css` values alone and
mistake them for the rendered Next theme. The final Cycle extension is
`app/static/css/cycle-workspace.css`.

**Key Characteristics:**

- Familiar Next navigation, green primary actions and blue links.
- Compact engineering content, written states and local table/log scrolling.
- Theme-aware Cycle accents without changing global equipment materials.
- One native route owner, with a read-only Console inside the current page.

## Colors

### Primary

Wistron blue identifies links and selected controls; Wistron green identifies
primary actions. The light primary button is the existing green gradient with
dark text, not the earlier modal's solid teal-and-white button. Dark mode retains
Next's corresponding green gradient and its existing highlight/border treatment.

### Neutral

Pearl page and panel surfaces support dark blue text in light mode. Graphite page
and raised instrument surfaces support pale text in dark mode. The frontmatter
records the actual final theme variables, not official corporate CI claims.

### Semantic accents

Cycle links, supporting text, warnings and failures use scoped pairs. Console
severity has its own theme-aware pairs: INFO/CMD blue, PASS green, WAIT/WARN amber,
FAIL/ERROR red, PRE/POST purple. Every row keeps its written level. COMPLETE is an
execution label, never an implicit green hardware verdict. The current console
placeholder explicitly uses the scoped supporting-text color because an inherited
light-theme `!important` placeholder rule would otherwise override it.

## Typography

The final shell inherits the Segoe UI Variable / Segoe UI / Microsoft JhengHei
system stack. No remote font or display-font pairing was added. Cycle raises body
text slightly above the shell and uses independent headline, title and node-title
sizes shown in frontmatter; these are observed roles, not an invented type scale.

Console rows use the monospace role and tabular numerals. Timestamps, node identity,
loop, phase and severity remain visible text. Long identifiers wrap within their
local content region rather than increasing the whole page width.

## Layout

The inherited desktop shell supplies sidebar, topbar and content padding. Cycle
has a maximum content width of 1800px. Its header and action rows wrap; configuration
uses four `minmax(140px,1fr)` columns. Chassis selection uses a 160px label column
with an auto-fit node grid, each node column at least 190px wide.

The selector matrix scrolls locally at a maximum 48vh. Run tables scroll locally
at a maximum 58vh with sticky headers. The Console has a 400px scroll viewport,
a wrapping toolbar and local node-filter overflow. These values describe this
surface, not a global layout prescription. Desktop acceptance targets are
1366×768 and 1920×1080, in both themes; mobile acceptance is not claimed.

Navigation belongs to Next's hash router: `#/cycle`, `#/cycle/new` and
`#/cycle/runs/{id}`. The explicit Rack validation group, chassis task card and
OS-node entries enter the same workspace. Mount/dispose owns this view's polling,
requests and single Console instance; it is not a replacement shell or modal.

## Elevation & Depth

Next's inherited buttons retain their shallow gradient, inset highlight and
small shadow. Light application surfaces use the existing pearl shadow; dark
surfaces keep graphite layering. Cycle itself adds borders and tonal panels for
node selection, summary and Console without a new global elevation system.
Equipment depth remains controlled by the existing Rack 3D implementation.

## Shapes

Controls retain the inherited gently squared button radius. Cycle fields and
node panels use the field radius; the Console uses the panel radius. Selected
nodes gain the scoped link-color border. Table and log separators remain visible
in both themes, and focus has an offset outline rather than color alone.

## Components

### Cycle refinement, October 2026

Cycle keeps the Next shell and Wistron palette. The run summary separates
execution, cumulative health, exercised coverage, environment and Worker status.
The progress table shows five primary columns; each node disclosure retains
attempts, POST, boot, issue and coverage details. Updates retain the same DOM
nodes and focus. Loop position and valid cycles remain separate measurements.

Console uses grouped view/output, filters and history controls, aligned column
guides and 13px event text. Empty, filtered, paused, disconnected and completed
views have explicit wording. A small 2.8-second breathing indicator marks an
active stream; a reconciliation indicator repeats only three times. Reduced
motion disables these effects. No animation indicates hardware PASS.

Evidence starts with named root reports; node and phase disclosures retain every
original download link and filename. The create action stays reachable at the
bottom of the selection workspace. All styling is scoped to `#cycle-workspace`.
Acceptance screenshots: `docs/screenshots/cycle-refinement/` (synthetic only).

### Buttons and fields

Native `.btn` and `.btn.primary` keep Next's gradients, minimum 36px button height,
hover lift and disabled treatment. Cycle fields are at least 40px high and native
checkboxes are 18px square. Labels remain explicit. Focus uses a 2px scoped link
outline with 3px offset; existing theme focus rules remain applicable.

### Target matrix and run table

Selection is grouped by chassis with a stable node label, endpoint and visible
eligibility reason. Search preserves checked nodes. Whole-rack selection and
search-result selection remain separate actions. The run table uses tabular
counts and native disclosures. Polling preserves open disclosures and focused
node summaries. Empty, blocked and disconnected states use explanation text.

### PRE and lifecycle summary

PRE findings, excluded targets, affected scope and reviewed version are displayed
together. Start confirmation belongs to that version. Lifecycle, hardware health,
coverage and worker freshness are separate labels. A failed initial load replaces
the loading state and exposes retry; a browser connection error does not assert
that the worker stopped.

### Read-only Console

The Console opens inside the run workspace and can close independently of the
worker. Follow, pause view, filters, search, history, copy and full download are
explicit tools. Scrolling upward preserves position and shows new-output context.
Only the current Console is mounted; browser history is bounded while persistent
history remains server-side. Rows use text content rather than HTML or a shell
connection. Console color never determines the run's result.

### Image provenance

The shipping raster assets were inherited from PA Server Manager Next commit
`a8a083beee7e48ebc9272233b7ac790f808b6d59` from upstream `static/img/`, copied into this repository's `app/static/img/`:

- `wistronlogo.png`: existing Wistron identity image; retained as supplied upstream.
- `server-hero.png`: existing concept-server illustration / 3D fallback, not a
  photographic statement about tested hardware. Its upstream image-generation
  provenance and original prompt are retained in
  `app/static/img/server-hero-prompt.md`.
- `ui-bg.jpg`: existing background asset retained for upstream compatibility;
  current native Cycle does not introduce it as a new background.

No raster was generated, edited or commissioned for this integration. Import
provenance does not establish a new license or imply hardware validation.
Acceptance screenshots are synthetic UI evidence, not shipping interface assets.

## Do's and Don'ts

### Do:

- Do inherit the final Next theme cascade and preserve Rack materials.
- Do keep Cycle-specific layout and color changes inside its workspace.
- Do keep state labels, focus and failure/retry feedback readable in both themes.
- Do preserve selections, disclosure state and focus during incremental updates.

### Don't:

- Don't promote the separate design preview into the production visual authority.
- Don't treat COMPLETE, a green UI element or synthetic data as hardware PASS.
- Don't replace the native workspace with the historical modal composition.
- Don't add an input connection to the read-only Cycle Console.

<details>
<summary>Historical lab modal documentation — retained record, not current native guidance</summary>

The following is preserved verbatim as historical source material. Its YAML is
quoted and must not be parsed as the current design token contract.

````markdown
---
name: PA Cycle Lab
description: Inherited PA Manager visual system with a scoped Cycle Test extension.
colors:
  w-green: "#0a7d78"
  w-green-bright: "#00a878"
  bg: "#f4f6f8"
  bg-panel: "#ffffff"
  bg-panel-2: "#f0f3f6"
  bg-hover: "#eef3f7"
  border: "#dde4ea"
  border-soft: "#e8edf1"
  text: "#1c2733"
  text-dim: "#5c6b77"
  text-faint: "#8a98a5"
  sidebar-bg: "#0a2540"
  sidebar-text: "#c6d6e4"
  accent-blue: "#0a6cff"
  green: "#16a34a"
  green-bg: "rgba(22,163,74,.12)"
  red: "#dc2626"
  red-bg: "rgba(220,38,38,.12)"
  amber: "#d97706"
  amber-bg: "rgba(217,119,6,.12)"
  cycle-link: "#0057cc"
  cycle-notice: "#086f6a"
  dark-bg: "#0e141b"
  dark-bg-panel: "#151d26"
  dark-bg-panel-2: "#1b2530"
  dark-bg-hover: "#212c38"
  dark-border: "#273440"
  dark-border-soft: "#1e2933"
  dark-text: "#dbe4ec"
  dark-text-dim: "#96a4b0"
  dark-text-faint: "#677684"
  dark-sidebar-bg: "#0a1626"
  dark-sidebar-text: "#b7c9da"
  dark-accent-blue: "#3b9bff"
  dark-cycle-link: "#69b5ff"
  dark-cycle-notice: "#2bd3b5"
typography:
  body:
    fontFamily: '"Segoe UI","Noto Sans TC","Microsoft JhengHei",Arial,sans-serif'
    fontSize: "13px"
  cycle-headline:
    fontSize: "26px"
    lineHeight: 1.3
  cycle-headline-mobile:
    fontSize: "22px"
  cycle-title:
    fontSize: "19px"
  cycle-subtitle:
    fontSize: "16px"
  cycle-label:
    fontSize: "13px"
    fontWeight: 600
  button-label:
    fontSize: "12px"
    fontWeight: 600
  mono:
    fontFamily: "Consolas,Menlo,monospace"
    fontSize: "11.5px"
rounded:
  input: "6px"
  control: "8px"
  card: "10px"
  project-dialog: "12px"
  badge: "20px"
spacing:
  label-gap: "8px"
  control-gap: "12px"
  compact-inset: "16px"
  field-gap: "18px"
  cycle-inset: "28px"
  cycle-column-gap: "32px"
components:
  cycle-button:
    backgroundColor: "{colors.bg-panel}"
    textColor: "{colors.text}"
    typography: "{typography.button-label}"
    rounded: "{rounded.control}"
    padding: "8px 14px"
  cycle-button-primary:
    backgroundColor: "{colors.w-green}"
    textColor: "#fff"
    typography: "{typography.button-label}"
    rounded: "{rounded.control}"
    padding: "8px 14px"
  cycle-input:
    backgroundColor: "{colors.bg-panel}"
    textColor: "{colors.text}"
    rounded: "{rounded.input}"
    padding: "8px 10px"
  pa-card:
    backgroundColor: "{colors.bg-panel}"
    textColor: "{colors.text}"
    rounded: "{rounded.card}"
    padding: "16px 18px"
  pa-badge-green:
    backgroundColor: "{colors.green-bg}"
    textColor: "{colors.green}"
    rounded: "{rounded.badge}"
    padding: "2px 9px"
  cycle-history-selected:
    backgroundColor: "{colors.bg-panel-2}"
    textColor: "{colors.text}"
    padding: "16px 12px"
---

# Design System: PA Cycle Lab

## Overview

The copied PA Manager interface is the visual authority. This document records its compact system typography, navy text and navigation, teal actions, pale panels, bordered tables, and existing dark theme. It does not establish a new visual identity. The descriptive direction comes from the approved [Cycle surface contract](.impeccable/cycle-surface.md), with product and source context in [README](README.md) and [source baselines](SOURCE_BASELINES.md).

The source of implementation truth is [PA CSS](app/static/css/style.css), extended by [Cycle CSS](app/static/css/cycle.css) and [Cycle interaction code](app/static/js/cycle.js). The frontmatter captures a reused subset of observed values, not an exhaustive replacement stylesheet. `dark-` entries document the values assigned to the corresponding unsuffixed CSS custom properties when the root theme is dark. Components in frontmatter show light-mode assignments; runtime components consume theme variables.

**Key Characteristics:**

- Inherited PA navigation, typography, surface colors, and action vocabulary.
- Compact operational content with explicit text labels and local table scrolling.
- Cycle-specific geometry and accessible states remain scoped to its dialog.
- No new raster assets. Existing PA imagery is inherited; review screenshots are evidence, not shipping interface assets.

## Colors

### Primary

The existing `w-green` teal and brighter companion identify PA actions. The PA primary button uses their gradient; Cycle deliberately uses a solid `w-green` fill with white text, including hover. This scoped override does not change other PA screens.

### Neutral

The `bg`, `bg-panel`, and `bg-panel-2` family separates the page, panels, and inset surfaces. `border` and `border-soft` divide dense content. `text` is primary content; `text-dim` supports metadata. The inherited faint-text token is recorded for existing PA components, while Cycle supporting text uses `text-dim`.

Navy sidebar colors and the inherited dark-theme counterparts remain governed by PA. Cycle uses the same theme switch and does not define another theme system.

### Semantic and scoped accents

Green, red, and amber retain their existing status roles. Cycle uses a red border for errors while keeping the error message in the normal text color. State, stage, and health remain written labels rather than color-only indicators.

`accent-blue` supplies the Cycle keyboard focus ring. The dialog-local `cycle-link` and `cycle-notice` colors provide distinct light/dark treatments for links and the environment notice. Keep these additions local; they do not replace global PA link or brand colors.

## Typography

The PA system font stack supports Latin and Traditional Chinese content; Cycle inherits it without loading another font. Body text remains compact. Cycle headings use the headline, title, and subtitle roles in frontmatter; the headline contracts on phones. Labels use the observed semibold role. Paragraphs inside Cycle use a line height of 1.6, while table metadata uses 1.5.

The inherited `mono` utility is intended for identifiers and technical values. Cycle's native `code` elements are not assigned that utility and retain their browser monospace treatment. Cycle tables explicitly use tabular numerals. Do not infer a display-font pairing or a mathematical type scale from these independent sizes.

## Layout

The inherited application shell has a fixed-width sidebar (236px), a sticky topbar (56px), and a flexible main region. Its main content padding is 20px vertically and 22px horizontally. Existing PA breakpoint behavior remains in the inherited stylesheet.

Cycle is a native modal dialog, centered at `min(1480px,96vw)` with a height and maximum height of 94vh. The shell uses the Cycle inset token. Its desktop grid combines a flexible content column with a 260px job-history column, separated by the Cycle column gap. Main sections use 26px vertical padding and a bottom divider. Configuration fields form three columns with the field-gap token.

At a maximum width of 900px, history stacks below the main column and fields form two columns. At 540px and below, the dialog fills the viewport using 100dvh, corners become square, the inset becomes compact, the header stacks, and fields form one column. Tables retain a minimum width of 620px and scroll inside their own containers. Opening the dialog locks background page scrolling.

The selected job is moved before selection/configuration content. This is a Cycle surface behavior, not a new global page-ordering rule.

## Elevation & Depth

PA combines bordered tonal surfaces with modest shadows. Standard cards and buttons use the inherited small shadow, and selected PA hover surfaces use the large shadow. Both values change with theme and are recorded in the sidecar. The inherited primary button also supplies a teal shadow to Cycle's primary action; the scoped solid-fill override does not remove it.

Cycle sections use dividers rather than separate elevated cards. The native dialog has a dark translucent backdrop (`rgba(10,25,40,.6)`) and no additional custom dialog shadow. Job-history selection uses an inset teal outline and a secondary panel fill. These treatments preserve the parent interface's material vocabulary.

## Shapes

PA uses gently rounded controls, cards, and project containers, with pill-shaped status badges. Frontmatter records the observed radii. Cycle reuses the control radius for table wrappers and PRE notices, the input radius for fields, and the project/dialog radius for the desktop dialog. The full-screen phone dialog is square. These are extracted values, not a newly imposed global radius scale.

## Components

### Buttons

Cycle buttons inherit PA typography, padding, radius, shadow, brief transition, and hover lift. The scoped overrides enforce a minimum height of 40px, wrapping labels, theme-aware neutral backgrounds, and solid primary fill. Neutral hover uses the secondary panel surface; the inherited hover lift remains. Disabled controls use reduced opacity (0.55) and the not-allowed cursor. Keyboard focus uses a 3px `accent-blue` outline with a 3px offset across the dialog.

### Inputs / Fields

Cycle fields have a panel fill, a one-pixel border, minimum height of 40px, and inherited font. Labels stack above fields with the label-gap token. Checkboxes are native controls sized at 18px and accented with `w-green`; inaccessible targets are disabled and have an accompanying reason. These differ from the original PA input's secondary-panel fill and must remain scoped.

### Navigation

PA sidebar navigation retains transparent resting rows, white hover text, and the existing green-tinted active gradient with an inset bright-green marker. Cycle adds a project-row entry and an in-dialog history list. History selection has a visible outline and `aria-pressed`; polling preserves the focused job button when rebuilding history. It does not create a replacement application sidebar.

### Cards / Containers and chips

PA cards remain bordered panel surfaces with the card radius, original padding, and theme shadow. Existing green, red, and amber badges retain their pill silhouette and written status label. Cycle's content sections are divided regions rather than a new card library; its PRE notice is an inset secondary-panel container.

### Tables and disclosures

Cycle tables use native table semantics, 13px text, tabular numbers, 12px cell padding, row/column headers, tinted header rows, and panel-colored bodies. Bordered wrappers contain horizontal scrolling. Supporting metadata is stacked within cells. PRE findings and excluded nodes use native disclosures; findings are initially open.

### Dialog and job states

The dialog has an accessible title. Opening focuses the return button; closing or Escape restores the opener. Closing the view leaves persisted work intact. Runner updates use a status region and request errors an alert region.

Creation, PRE approval, running, graceful stop, and terminal states control the visible actions. PRE acceptance names the specific findings and fixed runnable targets. Execution completion and hardware health are shown separately. The report link and evidence list remain direct, labeled actions. These are documented existing interactions, not additional backend requirements.

## Do's and Don'ts

### Do:

- Do inherit PA theme variables, system fonts, and existing primitives.
- Do keep Cycle-only colors, layout, focus, and control overrides inside the Cycle surface.
- Do preserve visible target, state, and health labels alongside operational actions.
- Do contain wide tables within local scrolling regions on narrow screens.
- Do preserve keyboard focus during refresh and restore the opener on close.

### Don't:

- Don't turn this local extension into a global PA redesign.
- Don't promote the Cycle dialog composition into a requirement for every screen.
- Don't conflate execution completion with hardware health.
- Don't add raster imagery or a new font identity to this documented scope.

````
</details>
