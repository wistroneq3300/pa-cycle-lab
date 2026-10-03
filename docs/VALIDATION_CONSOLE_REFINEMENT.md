# PA Validation Console refinement — 2026-10-03

Base: `3f109f594b5e2202200b0a8cfb77577490d450a8`.
Delivery: **codex/system-inspection-ux**, existing worktree only.
No deployment, production restart, real DUT operation, central monitoring change,
new branch, merge, or upstream repository edit. This is offline acceptance, not
live hardware or Grafana installation acceptance.

## Delivery map

| # | Requested item | Implementation / evidence |
|---|---|---|
| 1 | Telemetry modal architecture | Native `<dialog>` owned by the existing Telemetry view. At 1920: up to 1240×740; at 1366: viewport minus 48px (1318×720). Native inert background plus explicit Tab wrap, ESC, focus return. |
| 2 | Pipeline mapping | IDENTITY → Identity; DETECT → Exporter; INSTALL/START → Service; EXPORTER → Metrics; REGISTER/VERIFY → Prometheus. READY confirms all six. Publishing a target is not proof of target UP. PASS/ACTIVE/PENDING/WARN/FAIL come from structured steps, not log parsing. |
| 3 | Close/reopen | Close only the viewer. Existing provision worker and SQLite events continue. Same-node remount preserves viewer state, cursor, pause/search/scroll; retry with a new job resets the cursor. Browser refresh restores history from SQLite. |
| 4 | Grafana panels | Nine panels: CPU, memory, load, uptime, filesystem used, disk read/write, network RX/TX. First four share the top row. JSON supplied; not imported into the installed Grafana. |
| 5 | PromQL | See table below and the versioned dashboard JSON. Real metric labels, no generic device label on CPU/memory. |
| 6 | Stable metric identity | `instance=node_id`, `node_id`, `chassis_id`, `project_id`, physical `slot`, `pa_managed`. Missing stable project ID stays empty rather than substituting a mutable project display name. |
| 7 | IP continuity | IP is only the scrape endpoint. Explicit enable/retry revalidates identity then updates file_sd; stable labels and dashboard node variable remain unchanged. This does not add automatic inventory-edit registration. |
| 8 | Hostname continuity | Display metadata comes from PA. It is not a metric target label; rename leaves the dashboard query unchanged. |
| 9 | Binding revision | Retained in PA job/target validation. Removed from long-term metric labels and metric selectors. Current endpoint and unique UP target are still checked. |
| 10 | Visualization state | Pipeline READY is separate from visualization. Missing Grafana URL is SETUP REQUIRED; configured cross-origin iframe remains “待確認” because iframe load cannot prove login/embedding succeeded. External Grafana link remains available. No reinstall for visualization failure. |
| 11 | Exporter versions | Detected version appears in the log. `PA_NODE_EXPORTER_PREFERRED_VERSION` records the operator's preferred/validated version; a healthy different version is retained, never automatically upgraded. This setting does not itself certify a version. |
| 12 | Single node | Target context and pipeline, no fleet selector/matrix. |
| 13 | 2–8 nodes | Compact status/filter chips; no duplicate selector. |
| 14 | 32/128 nodes | Fleet counts, status/chassis filters, all-target text search, Needs Attention, expandable matrix. |
| 15 | Fleet count source | Canonical job targets + current node snapshots. Historical FAIL/WARN remains visible; completed/healthy requires PASS and a completed POST state. Unknown remains unconfirmed. |
| 16 | Pipeline count source | PRE runnable IDs plus typed completion markers; ACTION requires COMMAND_DISPATCHED, recovery requires RECOVERY_DETECTED (a changed OS boot ID alone does not prove all endpoints recovered), POST requires POST_COMPLETED. COMMAND_DISPATCHING is only intent. Counts describe the latest loop in the selected scope, not a global rack barrier or a hardware PASS. |
| 17 | Needs Attention | Structured cumulative node health and latest ISSUE_* message; not keyword matching. First 12 attention entries shown, full fleet remains filterable. |
| 18 | Matrix rendering | Target topology groups by chassis/tray; no fixed four-node assumption. Collapsed matrix builds no node chips. Expanded groups create only their own chips inside a bounded scroll region. |
| 19 | Performance | Synthetic 1/4/32/128 jobs, 128 all-healthy and mixed 10 recovery/2 WARN/2 FAIL, >2,400 additional events. Measured browser timings in `results.json` include Playwright interaction overhead and an 80ms settle wait; not a production SLA. |
| 20 | Summary/Full | Separate pressed controls, same immutable events. Summary preserves WARN/FAIL/ERROR even for normally folded collection steps. Preparing a dispatch is no longer described as sent. |
| 21 | History/search/evidence | Cursor polling, reconnect, search, errors, 500-event history pages, Older/Live, existing evidence links and complete retained-log download preserved. Live buffer 3,000 / rendered rows 2,000. |
| 22 | Removed styling | Removed scan-line background, blinking/glowing caret, newest-row glow and title glow. Shared graphite/blue-black palette, restrained severity badges, tabular monospace rows. Reduced-motion disables modal/live/new-row animation. |
| 23 | Cycle backend boundary | Only a read-only summary method/API and missing runtime-manifest entries. No engine, runner, action, PRE/POST/recovery/stop logic, schema or event sequence changes. See boundary section below. |
| 24–25 | Themes/sizes | Actual production frontend screenshots: Telemetry and Cycle single/128 at 1920×1080 and 1366×768, light/dark. Additional 4/32/matrix/failure captures. |
| 26 | Browser tests | `validation-console-browser.cjs` and `validation-console-contracts.cjs`; real isolated ASGI, persistent SQLite and fake bottom transport. Includes focus, retry, remount, interruption, history and high-throughput interactions. |
| 27 | Telemetry regression | 34 tests, including stable labels across hostname/IP/binding changes and preferred-version no-upgrade. Real process interruption remains INTERRUPTED with zero replay. |
| 28 | Cycle regression | Vera 113 PASS / 16 SKIP (35 passing subtests are not extra test IDs). Older Integration/Console fixtures retain their baseline failures; see exact comparison below. |
| 29 | Shared Validation | Shared Validation + Identity suites: 28 PASS; combined with Telemetry: 62 PASS. No shared core or Identity implementation edits. |
| 30 | 128-node acceptance | UI/SQLite synthetic only, no claim of 128 parallel hardware qualification. |
| 31 | Artifacts | Screenshot index below; local `artifacts/validation-console/acceptance.webm`, `trace.zip`, JSON, XML and text results. Export archive is outside Git. |
| 32 | Git | Final SHA is reported with the delivery commit and remote verification; only this existing branch is pushed. |

## PromQL / dashboard maintenance

All selectors include `node_id="$node_id"`; no IP, hostname or binding selector.
`$__rate_interval` is Grafana's range variable.

| Panel | Expression (selector abbreviated as `{node_id=…}`) | Legend / unit |
|---|---|---|
| CPU | `100 * (1 - avg by (node_id) (rate(node_cpu_seconds_total{node_id=…,mode="idle"}[$__rate_interval])))` | node_id / percent |
| Memory | `100 * (1 - max by (node_id)(node_memory_MemAvailable_bytes{node_id=…}) / max by (node_id)(node_memory_MemTotal_bytes{node_id=…}))` | node_id / percent |
| Load | `max by (node_id)(node_load1{node_id=…})` | node_id / load |
| Uptime | `time() - max by (node_id)(node_boot_time_seconds{node_id=…})` | node_id / seconds |
| Filesystem | `100 * (1 - max by (mountpoint)(node_filesystem_avail_bytes{…}) / max by (mountpoint)(node_filesystem_size_bytes{…}))` | mountpoint / percent; excludes tmpfs, overlay, squashfs, /run |
| Disk read/write | `sum by (device)(rate(node_disk_read_bytes_total{…}[$__rate_interval]))`, corresponding `written_bytes_total` | device / bytes/sec |
| Network RX/TX | `sum by (device)(rate(node_network_receive_bytes_total{…,device!="lo"}[$__rate_interval]))`, corresponding `transmit_bytes_total` | device / bytes/sec |

Canonical source: `deploy/telemetry/pa-node-telemetry.json`. CPU/memory legends
are not `device` or `mountpoint`. No GPU/DCGM installation added.

**Existing-series migration:** removing old mutable labels and introducing a
stable instance is a one-time new label set. Prometheus does not rewrite old
samples. The dashboard's node_id query can still read old node-tagged history;
old POC samples without node_id cannot be reconstructed by this UI. Subsequent
hostname/IP/binding changes keep identical labels, as the file_sd regression
proves. Previously injected relabel rules that force an IP instance, hostname or
pa_binding must be reviewed in the actual monitoring environment before rollout.
The existing health check reports DEGRADED until the stable current target is UP;
no monitoring service config was silently modified.

References: [Prometheus configuration / labels](https://prometheus.io/docs/prometheus/latest/configuration/configuration/),
[Grafana embedding configuration](https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/).

## Runtime and compatibility boundaries

`cycle-fleet.js` is a read-only frontend projection. Shared code is confined to
CSS primitives; no shared JS framework extraction. `cycle-console.js` owns its
inline view; `telemetry-provision.js` owns its modal. Both remain readonly.

New GET `/api/projects/{project}/cycle/jobs/{job_id}/console-summary` returns
`nodes[{machine_id,loop,completed[],markers[]}]` and `basis`. It reuses existing
project access and evidence-path handling. `Store.console_summary()` reads
typed events under a read transaction, and writes neither job state nor events.
It runs once when the viewer opens, not once per node or every poll. This
recovers stage counts when earlier completion events are outside the bounded
tail. Subsequent events update the same projection. If summary retrieval fails,
the tail still works and missing markers remain unconfirmed.

The previous delivery omitted its Telemetry runtime files from
`RUNTIME_ENGINE_FILES.json`. Real Cycle creation exposed that omission; this
delivery lists those files and the new frontend assets. The manifest/hash guard
is preserved. Presentation files remain in the UI hash; Python runtime changes
change the execution hash. Existing PRE confirmation must be rerun following a
runtime-version deployment, as before. No old PRE hash is bypassed.

Telemetry adds explicit success events for service decision, metrics response
and target publication. Commands, worker model, request payload, idempotency,
restart handling and database schema remain unchanged. A service-decision PASS
for an already healthy endpoint does not claim a newly started systemd service.

## Actual verification and known baseline failures

Commands (use the repository venv; all data is isolated):

```text
python -m pytest tests/test_telemetry_provision.py tests/test_shared_validation.py tests/test_identity_sync.py -q
python -m pytest tests/test_telemetry_provision.py tests/test_shared_validation.py tests/test_identity_sync.py tests/test_integration.py tests/test_console.py -q
python -m pytest engine/vera_cycle/dev/tests -q
python tests/telemetry_process.py
node tests/validation-console-browser.cjs
node tests/validation-console-contracts.cjs
```

The combined five-file suite was also run from a **non-Git archive of the base
commit** using the same venv. No branch/worktree was created or switched.
Base: **65 PASS / 35 FAIL**; current: **69 PASS / 35 FAIL** in pytest's raw
subtest accounting. The 35 failures represent **30 unique failing test IDs**,
identical before/after, **zero newly failing IDs**, four added passing tests.
Most failures are old `Neutrino Demo` fixtures without the now-required
`neutrino_demo_config.sh`; retained reservation/input expectation failures also
exist. They were not skipped, assertions weakened, or fixture fallbacks added.
`regression-comparison.json` contains the exact IDs. Targeted reruns are not
added to totals. This is not an all-repository green claim.

Vera was run on Windows with the existing MSYS shell. Its 16 platform skips are
retained. Linux systemd, installed Prometheus/Grafana, actual browser login/CSP,
real Node Exporter installation and real DUT behavior remain unverified.

## Reproduce and export

Use a new `data/telemetry-preview-*` instance name and a free loopback port.
The harness refuses non-synthetic configuration, forbids real Paramiko connect,
replaces device/monitor IO, and does not start a Cycle runner. Its test routes
are not registered in the production app.

```powershell
$env:PYTHONUTF8='1'
$env:CYCLE_MODE='synthetic'
$env:CYCLE_INSTANCE='data/telemetry-preview-validation-review-01'
$env:PA_PREVIEW_URL='http://127.0.0.1:19487'
.venv/Scripts/python.exe -m uvicorn scripts.validation_console_preview:create_app --factory --host 127.0.0.1 --port 19487
# Separate shell: configure PLAYWRIGHT_MODULE / PLAYWRIGHT_BROWSERS_PATH for installed tools.
node tests/validation-console-browser.cjs
node tests/validation-console-contracts.cjs
```

Browser video is real production UI → isolated backend; Grafana iframe content
is a harness stand-in. Campaign stage events are synthetic journal fixtures,
not a claimed executed hardware Cycle. Video records at 1920×1080; the same
session also captures 1366 screens. Successful video is finalized on context
close. `trace.zip` contains snapshots; no real credentials are used.

Screenshots: [`screenshots/validation-console/`](screenshots/validation-console/).
Local bundle: `artifacts/validation-console-delivery.zip` (video, trace, tests and
captures). Large media is intentionally excluded from Git; copy this archive to
transfer the review evidence. It is not a hosted public download.

## Rollback and remaining gates

Review before any deployment. A normal revert of this one commit rolls back
the refinement; no DB migration exists. Do not overwrite production data.
If stable-label registration has already been deployed, coordinate reverting
the target manager/dashboard and file_sd labels; this development task never
touched `/etc/prometheus`, the installed Grafana, or port 3000.

Keeping Telemetry unenabled sends no installation requests. Closing either
Console stops only the viewer. Legacy Telemetry stays available under Advanced
data when READY and remains open when not configured. Terminal, KVM, Power,
Test Assignment, six system tabs, Shared Validation, Inspection and Identity
sources are unchanged. Their complete platform/live acceptance is not claimed
by this scoped UI/browser suite.

### Final evidence index

- [Browser results and measured timings](acceptance/validation-console/results.json): 32-node filter 198ms; 128-node filter 276ms, including Playwright click and 80ms settle.
- [Supplemental interaction contracts](acceptance/validation-console/contracts.json).
- [Baseline/current failing test IDs](acceptance/validation-console/regression-comparison.json).
- [All screenshots](screenshots/validation-console/README.md).
- Independent visual review: initial **fix** for semantic chip colors and pressed-state visibility; verdict pass **ship**, scoped to those two fixes being resolved. No numerical design score or full-platform approval inferred.
