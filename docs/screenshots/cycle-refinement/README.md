# Cycle desktop refinement

Captured by `tests/cycle-refinement-browser.cjs` against the isolated synthetic
service. Desktop sizes: 1366×768 and 1920×1080, both Next themes. Wizard/run
images include the full scrollable page, so their image height can exceed the
viewport. Console images show the viewport at the Console panel.

- `wizard-*`: one chassis selected through the real checkbox UI.
- `run-*`: completed synthetic four-node run; five-column progress summary.
- `console-*`: persisted structured events, read-only Console.
- `evidence-1920-dark.png`: root reports first; node/phase evidence disclosures.
- `running-console-synthetic-fixture.png`: browser response fixture changes
  presentation to RUNNING; no command is dispatched. The test verifies active
  animation and that reduced-motion stops it.

No image is evidence of live hardware qualification. Next's surrounding shell
is inherited and was not redesigned in this refinement.
