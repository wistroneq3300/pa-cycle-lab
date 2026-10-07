# Screen matrix

All captures use synthetic or explicitly mocked data. Edge `154.0.4258.62`, browser zoom 100%, light/dark themes. The strict Test Case/Agent fixture returns 404 for unknown APIs and records them.

## Test Case and PA Agent

Root: `docs/ui-premium/screens/`

| Surface / state | Widths | Before | After | Result |
|---|---|---|---|---|
| Test Case category | 1366, 1600, 1920, 2560, 3440 | `before/test-case-category-*` | `after/test-case-category-*` | 20 images |
| Test Case no selection | all five | `before/test-case-none-*` | `after/test-case-none-*` | 20 images; disabled CTA asserted after |
| Test Case single selection | all five | `before/test-case-single-*` | `after/test-case-single-*` | 20 images; Agent CTA asserted after |
| Test Case multiple selection | all five | `before/test-case-multiple-*` | `after/test-case-multiple-*` | 20 images; batch CTA asserted after |
| PA Agent waiting / plan | all five | `before/pa-agent-waiting-*` | `after/pa-agent-waiting-*` | 20 images |
| PA Agent done-not-pass | all five | — | `after/pa-agent-done-*` | 10 images |
| Attachment parse states | 1366, 1920 | — | `after/pa-agent-attachments-*` | 4 images |
| ERROR with backend reason | 1366, 1920 | — | `after/pa-agent-error-*` | 4 images |
| Temporary reconnect | 1366 | — | `after/pa-agent-reconnect-*` | 2 images |

Counts: 50 baseline PNGs, 70 after PNGs, 10 viewport/theme records and 66 after assertions with zero failed assertions. Capture metadata is in each phase's `capture-results.json`. The expected optional unknown request was `GET /api/ai/gpu-alerts`; it received strict 404 rather than a permissive empty 200.

The automated matrix additionally asserts at 1366 that the complete criteria block is inside the initial detail viewport. Canonical active-node identity/IP, search composition wiring, focus/caret restoration, selected-vs-inspected state and stale attachment isolation are also asserted. A true 125% browser-zoom pass and screenshot are not claimed.

## Platform regression

Root: `docs/screenshots/platform-regression/`

| Surface | Widths / themes | Evidence | Result |
|---|---|---|---|
| Frozen Overview Hero | 1366, 1920 / light, dark | `dashboard-*` | no page error or overflow; Hero owners unchanged |
| Systems / projects | 1366, 1920 / light, dark | `projects-*` | no page error or overflow |
| Frozen Rack | 1366, 1920 / light, dark | `rack-*` | no page error or overflow; scene owners unchanged |
| System Overview / Inventory / Health / Telemetry / Validation / Nodes | 1366, 1920 / light, dark | `chassis-{overview,hardware,sensors,telemetry,tasks,osslots}-*` | no page error or overflow |
| Node edit state | 1366, 1920 / light, dark | `node-edit-*` | rendered with synthetic target only |

There are 36 machine-readable platform records in `capture-results.json`; all have `errors: []` and `overflow: false`. The baseline versions of these tracked files remain available at `186f0373e86768aa19bab36b283c12e79ad43848:<path>` and the working-tree files are the after captures.

Cycle, Telemetry and Inspection retain their existing checked-in synthetic screenshot suites under `docs/screenshots/live-branch-ui/`, `docs/screenshots/telemetry-provision/` and `docs/screenshots/system-inspection/`. Terminal/Broadcast/KVM content was not connected to a live endpoint and no new framebuffer capture is claimed.
