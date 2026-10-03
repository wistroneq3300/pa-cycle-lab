# Telemetry provision acceptance — 2026-10-03

Base: `f361560a73128e0ad5075e0835e4773ff12db0e7`.
Branch: `codex/system-inspection-ux`. The delivery commit contains this report;
use `git log -1` for its SHA. All verification below used isolated Windows
storage, fake OS/BMC transport and loopback preview services. No production
service, monitoring configuration or DUT was modified.

## Results

| Verification | Actual result | Evidence |
|---|---|---|
| New Python route/service/store/monitoring tests | 30 PASS | `tests/test_telemetry_provision.py` |
| Existing Inspection/shared validation/identity targeted regressions | 77 PASS | Combined run: 104 PASS, comprising these 77 plus the then-current 27 provision tests |
| Vera engine regressions | 113 PASS, 16 SKIP; 35 subtests recorded separately | `vera-regression.txt` |
| Legacy PA/broker suite | 53 PASS | `pa-regression.txt` |
| Production UI → ASGI → fake transport | PASS, four scenario groups | `results.json`, `backend.json`, `trace.zip` |
| Console pause/copy, parent remount, node-switch isolation | PASS | `console-regressions.json` |
| Child Web process killed during INSTALL, same DB reopened | PASS: INTERRUPTED, preserved events, zero replay | `process-results.json` |
| Desktop views | 1920×1080 and 1366×768, light/dark; English console output | Screens below |

Do not add targeted reruns to these counts. The new 30-test suite, browser and
process tests were rerun after English console messages were introduced. The
existing 77, Vera and PA suites are the earlier runs in this same task; their
code was unchanged by that copy adjustment. No all-repository green claim is
made. Inherited failures documented in PROJECT_STATUS remain outside this
targeted run. Vera's first invocation failed collection because its import path
was missing; that output remains `vera-initial-import-error.txt`, followed by
the corrected command's result. Existing SKIPs were retained, not added here.

## Commands

Use the worktree venv and `PYTHONUTF8=1`. Set `CYCLE_MODE=synthetic` and a new
isolated `CYCLE_INSTANCE` directory. Run from the repository root:

```text
.venv/Scripts/python.exe -m pytest tests/test_telemetry_provision.py -q
.venv/Scripts/python.exe -m pytest tests/test_inspection.py tests/test_shared_validation.py tests/test_independent_inspection.py tests/test_validation_edges.py tests/test_identity_sync.py tests/test_telemetry_provision.py -q
.venv/Scripts/python.exe -m pytest engine/vera_cycle/dev/tests -q
.venv/Scripts/python.exe -m pytest app/tests -q
.venv/Scripts/python.exe tests/telemetry_process.py
node tests/telemetry-provision-browser.cjs
node tests/telemetry-console-browser.cjs
```

For Vera set `PYTHONPATH` to `engine/vera_cycle`; the Windows run used MSYS Bash
through `VALIDATION_BASH` and PATH. For PA set `PYTHONPATH` to `app`. MSYS test
success does not validate Linux service installation. The browser scripts use
Playwright Chromium with channel `msedge`; set `PLAYWRIGHT_MODULE` to the
installed Playwright module and `PA_PREVIEW_URL` to the fresh isolated preview
from [the demonstration instructions](TELEMETRY_PROVISION.md). Run the main
browser test once on a fresh instance, then its console follow-up on that
instance. Test-only fixture endpoints are absent from the production app.

## Verified contracts

- Canonical node/revision checks and Shared Identity Auto Sync precede install.
  Hostname rename is supported; stale/retired targets do not get an install.
- Concurrent requests and timeout retries reuse the active job and persistent
  idempotency aliases. Four nodes retain distinct transport targets.
- Healthy exporter is retained, stopped service is started, conflicting listener
  is preserved. Missing exporter installation is exercised only by fake SSH.
- Prometheus UP, binding/endpoint labels and fresh required metrics are checked
  using a mocked HTTP transport running the real response parser.
- Atomic file_sd publication preserves unrelated entries and adopts a matching
  unowned POC target without duplicate scraping. Corrupt/conflicting data is not
  silently overwritten.
- Console output is English; UTC+8 appears in downloaded logs. Raw remote
  evidence is masked but not translated. Events are persistent/incremental,
  text-only, with 2,000 rendered rows and a complete streaming download.
- Paused Copy copies the displayed snapshot. Parent re-render preserves reading
  state. Changing Node clears the previous Node's log immediately.
- Terminal/KVM/test assignment and six tabs remain present. Browser tests assert
  zero Cycle jobs. Existing API payloads and Cycle engine files are unchanged.

## Screens and downloadable artifacts

Committed representative captures:

- [Before enable, 1920 light](screenshots/telemetry-provision/before-enable-1920-light.png)
- [English console, 1920 light](screenshots/telemetry-provision/ready-1920-light.png)
- [English console, 1920 dark](screenshots/telemetry-provision/ready-1920-dark.png)
- [1366 light](screenshots/telemetry-provision/ready-1366-light.png)
- [1366 dark](screenshots/telemetry-provision/ready-1366-dark.png)
- [Occupied port](screenshots/telemetry-provision/occupied-1366-dark.png)
- [Degraded monitoring](screenshots/telemetry-provision/degraded-1366-dark.png)

Full artifacts are under `artifacts/telemetry-provision/` in the development
worktree: `telemetry-acceptance.webm` (1920×1080), `trace.zip`, backend/results
JSON and test outputs. Large video/trace files are not committed. The delivery
provides a local artifact link; GitHub-only reviewers can reproduce them with
the scripts above or request the exported archive. The Grafana frame shown is
an explicitly identified offline endpoint fixture, not an actual Grafana query.
The recording uses accelerated fake transport responses, not hardware timings.

## Remaining live gates

No real Ubuntu/Debian apt/systemd installation, package-lock contention,
service-account permissions, firewall, central Prometheus relabel rules,
Grafana datasource import/login/embedding, or Linux service lifecycle was
validated. Supported automatic installation is currently Ubuntu/Debian with
systemd on port 9100; other platforms can use an existing healthy exporter.
The worker runs in the single Web process: browser closure is harmless, Web
death interrupts it without automatic install replay. Existing queued jobs can
start on restart. A lost SSH response can leave a remote package manager running;
this implementation does not claim remote rollback or cancellation.

No new provision occurs without explicit Enable. See the maintenance guide for
configuration and rollback. No deployment or real hardware operation performed.
