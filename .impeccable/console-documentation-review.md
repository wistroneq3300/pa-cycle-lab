# Cycle Live Console documentation review

Date: 2026-10-01. Scope: ordinary extension of the inherited PA Manager Operate surface.

## Preservation outcome

The finished console follows the incumbent system recorded in `DESIGN.md`, `.impeccable/design.json`, and `.impeccable/cycle-surface.md`. Its panel, borders, text, supporting text, neutral controls, focus ring, and light/dark selection use existing PA/Cycle variables. The inherited system font remains on controls and headings; operational rows use a scoped 12px Consolas/Courier New monospace treatment. No font package or shipping raster asset is introduced.

The console remains inside the existing Cycle dialog. Its controls wrap, and its log messages occupy a separate full-width row below 540px. The bounded log viewport is 400px high on desktop and 360px on phones. These are local console decisions, not new global layout rules. Existing job progress, report actions, and execution-versus-health distinctions remain visible in the surrounding Cycle workflow.

`DESIGN.md` and `.impeccable/design.json` were preserved. No product definition was requested; `PRODUCT.md` is absent and was not created. The only documenter write is this review. Runtime, tests, `docs/ACCEPTANCE.md`, and `docs/LIVE_CONSOLE.md` were not edited by this handoff.

## Intentional scoped additions

The user's requested terminal-like semantic colors are assigned only under `#cycle-panel .cycle-console`, with dark variants under the existing root theme selector. They do not replace the global brand or status palette. Explicit written level labels accompany each color.

| Meaning | Token | Light | Dark |
| --- | --- | --- | --- |
| PASS: green | `--log-pass` | `#18713d` | `#72dfa0` |
| INFO / CMD: cyan | `--log-info` | `#006c91` | `#72d4f4` |
| WAIT / WARN: amber | `--log-wait` | `#855300` | `#f4c56a` |
| FAIL / ERROR: red | `--log-fail` | `#bc2635` | `#ff939d` |
| PRE / POST: purple | `--log-phase` | `#7545a9` | `#c7a7fa` |

The console search placeholder explicitly consumes `--text-dim` at full opacity. This is a scoped contrast correction, consistent with the incumbent rule to use supporting-text tokens for Cycle metadata.

Read-only view controls use the inherited button vocabulary and explicit labels. Pause/close applies to the console view, with copy explaining that the job continues. Search distinguishes the buffered window from persisted history. The status line exposes the bounded window and directs the reader to Earlier history if the current anchor is evicted. Auto Scroll OFF preserves the first visible event's position while that event remains rendered. The log is keyboard focusable, has an accessible name, and avoids continuous live-region announcements; status and request errors have separate status/alert roles.

## Evidence checked

- Read incumbent `DESIGN.md`, `.impeccable/design.json`, and `.impeccable/cycle-surface.md` against `app/static/css/cycle.css`, `app/static/js/cycle-console.js`, Cycle integration in `app/static/js/cycle.js`, and the script include in `app/static/index.html`.
- Read `docs/LIVE_CONSOLE.md` for the read-only data path, polling and paging semantics, buffer limits, history recovery, and explicit offline acceptance boundary.
- Opened `.impeccable/review/console-desktop-light.png`, `console-desktop-dark.png`, `console-mobile-light.png`, and `console-mobile-dark.png`. All four show the named theme and viewport with the synthetic console, wrapped controls on mobile, readable event labels, and the bounded-history notice. These are paused fixture views; still images alone do not establish active polling behavior.
- Read the final `data/console-browser-results.json`: `passed: true`, 25 checks, `fixtureEvents: 12000`, a 3,000-event buffer, and 2,000 rendered rows. The final verification handoff clarifies that 12,000 counts delivered rows: 11,500 unique live fixture events plus 500 history rows; it does not mean 12,000 unique events. Recorded event-level contrast is at least 5.90:1 in light mode and 8.02:1 in dark mode. Search-placeholder contrast is 5.49:1 light and 6.66:1 dark.
- The final verification handoff adds three browser-only checks: a stale aborted response cannot repopulate a closed panel, automatic retry recovers persisted history after a failed read, and a valid View Evidence link returns HTTP 200. It reports that the same suite recreated the accepted screenshots at the same paths and geometry, with no UI/runtime changes. These additional checks do not broaden the existing scoped UI verdict.
- The build handoff reports a finish-review disposition of **ship** after a **fix** verdict pass, scoped to two resolved findings: placeholder contrast and Auto Scroll OFF anchoring during bounded trimming. It reports active-poll anchor displacement below 2px and history recovery for an evicted anchor. This documentation pass read the corresponding anchor/eviction implementation; it did not rerun the browser suite or issue a new whole-surface approval.

All evidence is synthetic/offline. This review makes no hardware acceptance claim. Linux/systemd deployment behavior, controller/disk behavior on the deployment host, and real Neutrino power/recovery validation remain separate live validation work.

## Existing findings and scope boundary

The handoff records one completed detector invocation. Its remaining warnings concern inherited index/global gradient text, colored shadows, stripes, and a pulsing dot. Those were reported as pre-existing and outside this extension; the index change adds the console script include only. Several inherited shadow and navigation-gradient choices are already described in the incumbent design records. No detector was rerun and no inherited styling was repaired in this documentation pass.

The console's new semantic mapping is intentionally documented here without promoting it into the global token file or sidecar. This satisfies the ordinary-extension preservation path in Impeccable new-work section 7.

Incumbent SHA-256 fingerprints recorded for preservation verification:

- `DESIGN.md`: `40BDB4151E98809D1B51A4FF5D2ED58547E5CA2E2C6F1AB6AF6B9C14F8199E25`
- `.impeccable/design.json`: `9893872CA39EF5D220139BA1D5427F93C57952BEA8F4C1B39C288F3BCCA3F3B2`
