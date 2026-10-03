# Native Telemetry and Inspection refinement — 2026-10-04

## Delivery boundary

Built on the user's photo version, `astra-console-import` at
`2d8d6739d1c4b4640d0ab7d1048fe6e423aa9ad4`. This supersedes the older request
to work on `codex/system-inspection-ux`. No feature branch or worktree was added.
The existing local checkout was clean before selecting the photo branch.

The user's active-OS inspection scope, collapsible inspection card, existing
Cycle console changes, Terminal/KVM/Test shortcuts and six system tabs remain.
No Cycle engine/runner/PRE/POST/recovery/action changes; no upstream repository,
production inventory, monitoring service or real DUT was operated.

## What changed

| Area | Before | Now |
|---|---|---|
| Telemetry main surface | Grafana iframe | PA Chart.js panels through canonical-node backend Prometheus queries |
| Grafana | Embedded primary view | Existing integration retained as advanced-analysis link |
| GPU setup | Host Node Exporter only | Detect NVIDIA capability, reuse DCGM or use configured container path |
| GPU setup failure | No GPU extension | Host charts remain usable; GPU reason and manual connection guide |
| CPU-only | Host metrics | Host READY, GPU NOT_APPLICABLE; no DCGM requirement |
| Evidence | Download-oriented | Bounded read-only modal with source/time, search, copy and full download |
| AI | Selective FAIL, small backlog, plain text | All active Warning/FAIL when enabled; structured advisory; durable priority queue |
| AI refresh | Reanalysis could leave stale card | Bounded polling, owner/remount-safe update and focus restoration |
| Issues | Active/recovered | Active/recovered/archived; archive after seven recovered days, no deletion |

## Telemetry implementation and configuration

`integration/telemetry_gpu.py` extends the existing identity-verified,
journaled Provision Job. All console events remain English. Detection uses
`nvidia-smi` and numeric PCI class/vendor evidence, not project labels. Missing
tools or an NVIDIA GPU without a working driver is unavailable, not CPU-only.

Healthy DCGM is retained regardless of preferred version. Existing known
systemd services or the PA-owned stopped container can be started. An occupied
or unverified port is left untouched. Automatic creation supports an **already
configured Docker NVIDIA runtime** and a configured pinned image. It does not
install/upgrade a driver, Docker or Container Toolkit, reboot, or kill processes.

| Setting | Meaning |
|---|---|
| `PA_PROMETHEUS_URL` | Existing backend Prometheus API URL |
| `PA_PROMETHEUS_FILE_SD` | Existing dedicated PA target file; configurable, not hardcoded |
| `PA_GRAFANA_URL` | Browser-reachable advanced-analysis URL |
| `PA_DCGM_EXPORTER_PORT` | GPU scrape port, default 9400 |
| `PA_DCGM_EXPORTER_IMAGE` | Platform-compatible fixed image tag/digest; empty means no automatic installation |
| `PA_NODE_EXPORTER_PORT` | Existing host scrape port, default 9100 |
| `PA_NODE_EXPORTER_PREFERRED_VERSION` | Existing informational preferred version; no automatic healthy exporter upgrade |

DCGM image/driver compatibility must be checked for the actual GPU platform.
See [NVIDIA installation and compatibility guidance](https://docs.nvidia.com/datacenter/dcgm/latest/installation/install-dcgm-exporter.html).
The image used by offline fixtures is test configuration, not a statement of
validation on the user's hardware.

### Manual GPU installation and connection

When GPU setup is incomplete, the page provides a collapsible guide containing:

1. Current PA browser address and backend-configured Prometheus address.
2. Canonical node `/metrics` URL, current configured image and read-only checks.
3. A container command for the existing NVIDIA runtime, or a clearly marked
   version placeholder if no compatible image is configured; an official guide link.
4. A `curl` check to run on the PA/Prometheus host.
5. Instructions to press **啟用 Telemetry** again to reuse the exporter and register it.

Prometheus **pulls** from the GPU server. DCGM does not push to the PA browser URL.
If Prometheus runs elsewhere, network reachability must be checked from that
host. The guide is text only; opening/copying it executes nothing. Installation
failure affects GPU status, never the availability of host charts.
Host readiness is saved before GPU work begins, so a slow optional GPU setup
does not delay the already verified Host state.

`telemetry_monitoring.py` atomically manages Host and GPU target rows by
`(node_id, exporter role)`. Host keeps its existing label shape; GPU adds
`pa_exporter=gpu`. Both use stable `instance=node_id`, chassis/project/slot.
IP is only the scrape address; hostname and binding revision are not target
identity labels. Repeated enable does not duplicate targets. Role-specific
unregister preserves the other role and unrelated targets. There is one PA
file_sd writer per controller; no new distributed ownership contract is claimed.

New PA-created DCGM containers use `--no-hostname`. An independently installed
exporter may still emit mutable `Hostname` labels. PA logical queries aggregate
by UUID/GPU, but those legacy raw Prometheus series can split on hostname change.
Before deploying, check the installed exporter's labels; configure its supported
no-hostname option, or an appropriate central `metric_relabel_configs` rule for
the GPU scrape job. This task did not change or reload central Prometheus config.

### Native charts

`integration/telemetry_charts.py` owns fixed PromQL. Browser requests only:

`GET /api/telemetry/nodes/{node_id}/charts?period=1h|6h|24h|7d`

All queries bind `node_id` and `instance` to the canonical node. Eight panels:
CPU idle-rate complement; Memory available/total ratio; per-GPU utilization;
FB used/(used+free); GPU temperature; GPU power; network receive/transmit byte
rates; disk read/write byte rates. GPU series retain UUID, index and MIG instance
when available. Network/disk legends use device and direction. Uptime, load and
filesystem usage are compact stats. Exact PromQL lives in `queries()`.

Four global HTTP workers, four admitted dashboard batches, a 20-second/64-entry
cache, eight-second query timeout, at most 64 series per response and 602 points
per series bound work. Non-finite/DCGM sentinel values are not charted as valid.
Metric sample time is distinct from page refresh. Panels expose NO_DATA, STALE,
QUERY_ERROR and NOT_APPLICABLE. Grafana availability does not determine Host READY.

`telemetry-native.js` owns chart disposal and 30-second polling. Existing
`telemetry-provision.js` continues to own the durable-job modal and event cursor.
Legacy Telemetry is retained, collapsed when Host is ready even if GPU is degraded.

## Inspection AI and lifecycle

`inspection_advice.py` is advisory orchestration using the existing `_llm_chat`.
It does not connect to DUTs, run diagnostic tools or modify rule verdicts.
Inputs include project/node, component/rule/severity, observations, occurrence/
recurrence context, source time and a masked raw excerpt up to 8 KB, selected
from a bounded 256 KB prefix. The excerpt limit/offset is recorded. Relevant
content beyond that prefix is not claimed to have been analyzed.

Structured result: possible causes, recommended checks, conclusion, confidence
note and evidence basis. Traditional Chinese SIT prompt treats utilization as
possible workload, not hardware failure. Analysis stores its exact `based_on`.

SQLite backlog has no 16-item discard limit. Two OS-locked worker slots claim
FAIL before WARNING without holding a write transaction during inference.
An issue has one active/pending analysis; changes while running coalesce into
the next material input. Repeat utilization values, timestamps and evidence
paths do not alone retrigger inference. New issues, escalation, recurrence,
changed facts/fingerprint and explicit reanalysis can trigger it.

Safe categories: CONNECTION_ERROR, TIMEOUT, MODEL_ERROR, INVALID_RESPONSE,
SERVICE_UNAVAILABLE, INTERNAL_ERROR. A failed unchanged analysis remains visible
and can be retried manually; it is not retried every inspection tick. Process
restart recovers abandoned advisory work via OS ownership, never Cycle locks.

The additive inspection DB v3 migration adds priority/created_at/worker_slot,
preserves old results and marks superseded legacy pending jobs without deletion.
Issue handling flags/history remain. Recovered issues older than seven days
become ARCHIVED in bounded batches; active issues remain visible. Recurrence
reopens the same issue. Referenced issue/history/advice evidence remains pinned
against snapshot pruning. This is retention, not an automatic data purge.

UI filters/search run in SQL before pagination. AI polling backs off from 1.5
to 10 seconds, ends on terminal state or after three minutes, and stops on
unmount. A long backlog gets an explicit update action. Re-rendering the parent
detail preserves expanded cards and pending analyses; manual retry updates the
currently mounted owner rather than a detached card.

## Raw evidence

`GET /api/machine/{name}/inspection/evidence/{snapshot_id}/view` reuses existing
project access and artifact containment; returns masked text up to 256 KB plus
source/time/truncation. Full download remains the existing endpoint. No rule or
evidence file is modified. `inspection-evidence.js` renders raw content with
`textContent`, local scrolling, text search/copy, native dialog keyboard handling
and focus restoration even across the existing detail refresh.

## Actual verification

All executed tests use temporary synthetic storage/fake transport; no real LLM.
Commands run with the repository `.venv`, `PYTHONUTF8=1`, `CYCLE_MODE=synthetic`
and a unique `CYCLE_INSTANCE=data/refinement-*`.

| Run | Actual result |
|---|---|
| Telemetry + inspection refinement + existing telemetry/shared/identity (6 files) | 105 passed |
| Independent inspection + validation edge cases, with bundled Git/MSYS Bash | 32 passed |
| Vera `engine/vera_cycle/dev/tests` | 113 passed, 16 skipped; 35 subtests passed separately |
| Original `app/tests` | 53 passed |
| Photo base vs current identical broad six-suite run | Both 71 passed / 37 failed outcomes; same 32 unique failing test IDs, no new or resolved failures |
| `tests/telemetry_process.py` | PASS: killed isolated fixture Web during install intent; restart INTERRUPTED, 0 replayed commands |
| `tests/refinement-browser.cjs` | PASS: real UI/ASGI/SQLite/fake bottom transport, 5 scenario groups, zero page errors |

Do not sum these rows: existing test IDs overlap across targeted and comparison
runs. JUnit files retain individual IDs. Broad inherited failures include old
`Neutrino Demo` checker-resolution fixtures and two tests expecting the prior
standalone observation reservation architecture. Assertions were not weakened.
Only the two older Inspection AI tests were adapted to the explicitly requested
all-Warning analysis and one-active/coalesced queue contract.

The first edge-case run without a Bash path had three environmental failures;
the corrected Bash run passed all 32. This is Windows + Git/MSYS Bash evidence,
not Linux/systemd or live DCGM validation. Vera skip reasons remain in JUnit.

Reproduce backend tests:

```text
.venv/Scripts/python.exe -m pytest tests/test_telemetry_native_gpu.py tests/test_telemetry_provision.py tests/test_inspection.py tests/test_inspection_advice_refinement.py tests/test_shared_validation.py tests/test_identity_sync.py -q
.venv/Scripts/python.exe -m pytest app/tests -q
.venv/Scripts/python.exe tests/telemetry_process.py
```

For Bash suites set `VALIDATION_BASH` to a working `sh`/`bash` and prepend its
tool directory to PATH. Vera imports require repository and engine/vera_cycle
on PYTHONPATH. The comparison uses a `git archive` source export of the exact
base, not a reset or extra worktree.

## Browser replay and artifacts

Start only an isolated preview with `CYCLE_MODE=synthetic`, a new
`CYCLE_INSTANCE=data/telemetry-preview-refinement-<unique>`, and
`PA_PREVIEW_URL=http://127.0.0.1:<unused-port>`:

```text
.venv/Scripts/python.exe -m uvicorn scripts.refinement_preview:create_app --factory --host 127.0.0.1 --port <unused-port>
node tests/refinement-browser.cjs
```

Use installed Playwright via `PLAYWRIGHT_MODULE` if it is not in the normal Node
module path. The script records successful video, closes the context to flush
the WebM, and saves trace, screenshots and real backend fixture results under
`artifacts/native-refinement/`. No API success data is painted into the DOM.

Recorded scenarios: 8 GPUs and 7-day query; close/reopen Provision; raw modal
keyboard/search/copy; AI timeout and retry updating without F5; user-selected
single-node inspection retained; GPU port conflict with Host charts still ready;
manual setup guidance; CPU-only READY/N/A; existing four-node Cycle console.
Light/dark at 1366×768 and 1920×1080 were captured and reviewed. Terminal/KVM/Test
entry visibility was checked, not real remote connections.

Small screenshots are in `docs/screenshots/native-refinement/`. Video/trace/raw
test results are exported separately; they are offline acceptance artifacts,
not live system evidence. No aesthetic score substitutes for these checks.

## Deployment gates and rollback

Not deployed. Validate the actual Linux GPU/driver/DCGM image/runtime pairing,
ports/reachability, real Prometheus metric names and exporter labels, actual
LLM output quality, and company service environment before rollout. No central
service ports or configurations were changed by this work.

Disable inspection AI using its existing settings to stop new automatic
analysis requests; existing durable backlog is retained. Inspection scheduling
has its existing enable switch. Host Telemetry remains independent of GPU setup.
To disable automatic DCGM creation, leave `PA_DCGM_EXPORTER_IMAGE` empty.

Rollback code with a normal revert of this delivery commit in a separately
reviewed change; keep DB/evidence backups. The extra columns/table are additive.
Before running old code against the same inspection DB, export/preserve new
ARCHIVED states and structured AI results: old UI does not understand all new
states. Do not delete the DB or evidence to roll back. Removing code does not
uninstall exporters or remove file_sd targets; that requires an explicit operator
decision. No rollback/deployment was performed during this task.
