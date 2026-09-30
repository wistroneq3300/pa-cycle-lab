# PA Server Manager Code Review — 2026-09-20

## Scope and assumptions

This review focuses on functional correctness, data consistency, long-running reliability, and maintainability. The application is assumed to be used by a trusted internal department, so deployment security findings are intentionally not the primary focus of this document.

Reviewed areas:

- `main.py`
- `telemetry_core.py`
- KVM and terminal bridge integration
- Test-library lookup behavior
- JSON persistence
- Existing automated-test coverage

No application code was changed as part of this review.

## Executive summary

The current codebase is syntactically valid and the main architecture is understandable, but several edge cases can produce incorrect telemetry results, repeated alerts, misleading API success responses, or selection of the wrong test case. The first four findings below should be addressed before expanding telemetry or AI-assisted test execution.

## Findings

### 1. High — Telemetry AI analysis divides by zero with one sample

Location: `main.py`, `machine_telemetry_analyze()`, nested `trend_desc()` (around lines 2764-2770).

`trend_desc()` divides a series into two halves. When `vals` contains exactly one item, `half` becomes `1`, while `len(vals) - half` becomes `0`:

```python
half = max(1, len(vals) // 2)
a = sum(vals[:half]) / half
b = sum(vals[half:]) / (len(vals) - half)
```

Impact:

- A newly monitored machine may return HTTP 500 from `/api/machine/{name}/telemetry/analyze`.
- A narrow time window containing one sample produces the same failure.
- Partial telemetry series can fail even when the endpoint has otherwise valid data.

Recommendation:

- Return a neutral value such as `"insufficient data"` or `"stable"` when fewer than two values exist.
- Add unit tests for zero, one, two, and odd-numbered sample counts.

### 2. High — Persistent GPU alerts are incorrectly cleared and recreated

Location: `telemetry_core.py`, `evaluate_gpu_alerts()` (around lines 357-403).

When an alert remains active, the function skips insertion but does not refresh the existing alert timestamp. The stale-alert cleanup later uses that original timestamp and clears the alert even if the condition is still present.

Impact:

- A continuously hot or busy GPU can be marked clear incorrectly.
- The following collection cycle creates a new alert for the same condition.
- AI alert text is regenerated periodically, creating unnecessary inference work.
- `gpu_alerts` accumulates repeated active/clear records for one continuous incident.

Recommendation:

- Track `last_seen_at` separately from `created_at`, or update the active row whenever the condition remains true.
- Only clear an alert when the current evaluation no longer contains its key.
- Add a state-transition test covering `normal -> active -> still active -> clear`.

### 3. Medium-high — Unmounted rack devices can still affect rack telemetry

Locations:

- `main.py`, `rack_telemetry()` (around lines 2627-2630)
- `telemetry_core.py`, `get_rack_series()` (around lines 818-819)

The API component list includes only rack members whose `rack_u > 0`. However, `get_rack_series()` selects every machine in the project with `level == "rack"`, including machines that were removed from the rack and now have `rack_u == 0`.

Impact:

- The displayed component count can disagree with graph values.
- An unmounted device can continue contributing to rack averages and totals.
- Operators may diagnose the wrong physical rack state.

Recommendation:

- Apply the same membership predicate in both layers, preferably through one shared helper.
- Add a test containing mounted, unmounted, L10, and blanking members in the same project.

### 4. Medium-high — Duplicate test codes can select the wrong case for AI advice

Location: `main.py`, `ai_testlib_advice()` (around lines 997-1004).

The current `data/tests.json` contains:

- 3,112 rows
- 125 duplicated `code` values
- 260 rows involved in duplicate-code groups

The advice endpoint accepts only `code` and stops at the first matching row. Consequently, a request originating from another row with the same code may use the wrong procedure, criteria, commands, and risk metadata.

Impact:

- AI recommendations may be valid for a different test item.
- The UI can display the correct row while the backend analyzes another row.

Recommendation:

- Assign every generated test row a stable unique identifier.
- Send that identifier to `/api/ai/testlib-advice`.
- As an interim measure, require `sheet` plus a row discriminator such as `items`, `test_set`, or source-row index.
- Return a conflict response when a code is ambiguous instead of silently selecting the first match.

### 5. Medium — Rack metrics bypass configured retention

Location: `telemetry_core.py`, `prune()` (around lines 665-670).

The retention job deletes old rows from `gpu_metrics`, `os_metrics`, `net_metrics`, and `disk_metrics`, but not from `rack_metrics`. Historical `gpu_alerts` are also never pruned.

Impact:

- Once switch, PDU, power-shelf, or CDU collectors are enabled, `rack_metrics` grows indefinitely.
- Database size and query latency will gradually increase.
- `TELEMETRY_RETENTION` does not describe actual retention behavior.

Recommendation:

- Include `rack_metrics` in normal metric retention.
- Define a separate, explicit retention policy for cleared alerts.
- Add an index and maintenance test that verifies old rows are removed from every time-series table.

### 6. Medium — Persistence failures are reported as successful API operations

Location: `main.py`, `_save_data()` (around lines 92-100).

`_save_data()` catches every exception and only prints an error. Callers continue returning successful API responses. All writers also share the fixed temporary filename `data.json.tmp` without a write lock.

Impact:

- Disk-full, permission, or rename failures appear successful in the UI.
- Changes can exist in process memory but disappear after restart.
- Concurrent write requests can race on the same temporary file.
- A failed persistence operation has no structured monitoring signal.

Recommendation:

- Serialize mutations and persistence with a process-level lock.
- Write to a uniquely named temporary file in the same directory, flush and `fsync`, then atomically replace the destination.
- Let failures propagate as an HTTP 5xx response and revert the in-memory mutation where practical.
- Add concurrent-write and forced-write-failure tests.

### 7. Low — Project descriptions cannot be cleared

Location: `main.py`, `edit_project()` (around lines 1684-1692).

Both update branches use `body.desc or existing_description`. An intentionally empty description is therefore treated as "keep the old value".

Recommendation:

- Distinguish an omitted field from an explicitly supplied empty string, for example with a dedicated patch model and Pydantic field-set tracking.

## Test coverage observations

Existing tests cover the SP-X broker and NVIDIA/AMD GPU parsers. They do not currently cover:

- Main API mutation and persistence behavior
- Telemetry trend edge cases
- GPU alert state transitions
- Rack membership consistency
- Retention across every telemetry table
- Duplicate test-code disambiguation

Suggested next test modules:

- `tests/test_telemetry_analysis.py`
- `tests/test_gpu_alert_lifecycle.py`
- `tests/test_rack_telemetry_membership.py`
- `tests/test_data_persistence.py`
- `tests/test_testlib_identity.py`

## Recommended implementation order

1. Fix the single-sample telemetry crash.
2. Correct the GPU alert lifecycle.
3. Introduce unique test-row identity and reject ambiguous advice requests.
4. Unify rack membership filtering.
5. Make persistence failures visible and serialize writes.
6. Complete telemetry and alert retention.
7. Add regression tests before further collector or AI feature expansion.

## Validation performed during review

- Python source syntax was checked with in-memory `compile()` across the main modules.
- `static/js/app.js` passed `node --check`.
- `static/js/kvm_broadcast.js` passed `node --check`.
- The worktree was clean and synchronized with `origin/main` before this report was created.
- Full pytest execution was not performed in the review environment because pytest and the project runtime dependencies were not installed there.

