# Cycle Live Console

This is a read-only observability extension of the Neutrino V1 cycle workflow.
It neither issues commands nor owns job state. Persistent jobs, PRE confirmation,
scope reservations, worker isolation, stop-after-round and evidence remain owned
by the existing Store/Runner/NodeSession architecture.

## Changed files

| Area | Files |
| --- | --- |
| Typed events, persistence, API, route boundary | `integration/events.py`, `integration/store.py`, `integration/web.py`, `integration/boundary.py` |
| Optional engine observer and worker integration | `engine/vera_cycle/cycle_engine.py`, `integration/runner.py` |
| Inline Console, progress, scoped themes and script loading | `app/static/js/cycle-console.js`, `app/static/js/cycle.js`, `app/static/css/cycle.css`, `app/static/index.html` |
| Feature and browser/process regression | `tests/test_console.py`, `tests/console-browser.cjs`, `tests/browser.cjs`, `tests/process_smoke.py` |
| Isolated copied PA test harness/dependencies and offline credential fixture | `tests/legacy_smoke.py`, `tests/requirements.txt`, `app/tests/test_broker_api.py` |
| Version and PRE runtime identity | `VERSION`, `RUNTIME_ENGINE_FILES.json` |
| Documentation and design-preservation review | `docs/LIVE_CONSOLE.md`, `docs/ACCEPTANCE.md`, `.impeccable/console-documentation-review.md` |

## Data path

`NodeSession observer → runner → Store.append_event → SQLite events → GET API → Console`

The optional observer records operational milestones and classified findings.
Transport stdout is not streamed into the browser. Each event is normalized and
redacted **before insertion**, inside the existing SQLite transaction boundary.
Lifecycle events are committed together with their corresponding job transition.
An observability write failure is an evidence persistence failure: the worker
fails closed and never retries a destructive action to recreate a missing log.

Schema version 1 retains `sequence` and numeric `time` in API responses and adds:

| Field | Meaning |
| --- | --- |
| `timestamp` | Server UTC timestamp, ISO 8601 milliseconds |
| `job_id`, `run_id` | Server-owned persistent job/run identity |
| `machine_id`, `tray`, `node` | Nullable for job-wide events |
| `loop`, `phase` | Round and explicit operational phase |
| `event_type`, `level`, `message` | Typed milestone, semantic level, human-readable message |
| `detail`, `evidence` | Optional bounded detail and secured relative artifact reference |

Levels are `INFO`, `CMD`, `WAIT`, `PASS`, `WARN`, `FAIL`, `ERROR`, `PRE`, `POST`.
They are explicit values; the UI does not infer them from message text.
Old event rows are normalized at read time; historical milestones that were not
recorded by older versions cannot be reconstructed.

Events cover PRE identity/dependencies/baseline, loop and action preparation,
dispatch intent/attempt, response, recovery, boot identity, POST collections and
comparison, PRE-relative NEW/KNOWN/WORSENED findings, stop, worker loss and terminal
states. `COMMAND_DISPATCHING` means durable intent, not acceptance.
`COMMAND_DISPATCHED` means one dispatch attempt, not successful recovery.
`RESPONSE_LOST` is WARN and explicitly ambiguous; it never becomes command PASS.
Boot recovery and later power evidence reconcile ambiguity without another action.
An unreachable SSH probe alone is not proof of power-off. Fast boots can have no
observed offline sample; the console reports that fact and the required boot-ID
change. Job COMPLETE is INFO and remains separate from hardware health.

## API and paging

All routes retain existing project scoping and authentication. Route classification
only adds the explicit read-only download endpoint.

- `GET /api/projects/{project}/cycle/jobs/{job_id}/events`
  accepts `after` (exclusive sequence), `limit` (1–500), `tail`, `before`
  (exclusive older cursor), `machine_id`, `errors_only`, and `search` (max 200).
  Returns `events`, `has_more`, `next_sequence`, `oldest_sequence`.
- `GET /api/projects/{project}/cycle/jobs/{job_id}/events/download`
  streams a plain-text attachment through the sequence present when download
  starts. It reads at most 500 rows per batch, without holding a transaction for
  the lifetime of the download. It exports all retained events, not only the view.

Sequences are global SQLite AUTOINCREMENT values. A job's sequence can have gaps;
clients must use returned values, not assume consecutive integers. Sequence is
the ordering authority even if the controller clock changes. Writers serialize
through SQLite; per-node events preserve execution order. Terminal publication
follows node work; append-only observer writes are rejected after terminal state.

Job/sequence and job/machine/sequence indexes support keyset paging. Event reads
use short read-only connections, not writer reservations. Explicit history search
uses parameterized substring matching within the selected job; an absent match
can scan that job's retained history. It is not part of normal polling and is not
a claim of unlimited database search capacity.

## Browser behavior and bounds

The button opens a panel inside the existing Cycle dialog. Existing job/status
polling remains at **1,500 ms**, including while Console is closed or paused.
The Console initially loads the most recent 500 events and polls with
`after=<last_sequence>` every **1,500 ms**. Backlog pages catch up sequentially
every 250 ms; requests never overlap, have a 15-second timeout, and have revision
and abort guards against stale responses after closing or switching jobs.

The live buffer holds at most **3,000 events**, the DOM at most **2,000 rows**, and
an explicit historical page at most **500 events**. Incremental renders reuse
existing rows. Node/error/search changes filter the buffered window locally.
ERROR ONLY means FAIL or ERROR; WARN ambiguity stays visible in ALL.
Search history applies the filters to persisted history. Earlier history starts
immediately before the first displayed event. Return to live restores the live
buffer and catches up from its cursor. No browser filter deletes saved evidence.

Pause View stops Console fetch/render updates; Resume catches up. It does not call
a job-control API. Closing stops Console polling, while reopening resumes it.
Browser refresh or Web restart restores history from SQLite. Copy copies visible
rows; Download exports retained history. There is no clear/delete-events control.
Auto Scroll can be turned off; incoming rows preserve the first visible event's
position. When that event leaves the bounded window, a notice points to Earlier
history instead of silently pretending the reading position was retained.
Explicit level text accompanies scoped light/dark
semantic colors, and timestamps are identified as UTC.

## Security and failure review

- The observer passes backend credential values into normalization; environment
  secrets and authorization/credential assignments are also redacted. Redaction
  precedes truncation, preventing a clipped partial password from escaping.
- Event payloads use a field allowlist and bounded text; arbitrary credential or
  environment objects are not serialized. ANSI/control/bidirectional characters
  are stripped. Existing transport output redaction and IPMI `-E` remain intact.
- API and download reuse the normalized stream with `Cache-Control: no-store`.
  Browser event content is built with `textContent`, never event-supplied HTML.
- Evidence references must be relative public artifact names. Both event API and
  download verify them with the existing resolved-root/private-path artifact
  boundary, including symlink escape protection. Links use that same artifact API.
- No worker control, remote shell, websocket, automatic command replay or new
  credential store is introduced. Legacy remote routes remain disabled.
- Full evidence remains in the existing artifacts. Console history follows the
  existing explicit terminal-event compaction policy; no new automatic retention
  or artifact deletion is enabled.

See [acceptance results](ACCEPTANCE.md). All local validation is synthetic/offline.
Linux/systemd, disk/controller behavior on the deployment host and real Neutrino
power/recovery acceptance remain separate live validation work.
