# PA Cycle Lab

This repository is an independent copy/integration. All work stays here.
Never modify, push to, deploy, restart, or create worktrees in pa-server-manager
or pa-server-manager-next or vera-cpu-rack-cycle. Historical copied instructions describe other systems;
they are reference material, not deployment instructions for this project.
Default execution is SYNTHETIC, with no network transport to hardware.
Live hardware acceptance requires user-specified targets and scope.
Use the project .venv, data/, runtime/, and artifacts/ directories only.
Keep passwords and credentials out of Git, argv, public API and reports.

## Restart policy for THIS repo (PA-manager-6969)

- `:6969` is a systemd service: `pa-manager-6969-web.service`. Restart with
  `systemctl restart pa-manager-6969-web.service` (NOT by killing the pid).
- After any edit to runtime Python (`integration/**`, `app/**`), restart 6969
  automatically so the change takes effect. Do not wait for the user to ask.
- Only restart the web service. Do NOT touch `pa-manager-6969-runner.service`,
  `pa-manager-6969-bridge.service`, or `:7000`.
- The "Never restart ... pa-server-manager" rule above refers to a DIFFERENT repo
  (`pa-server-manager` / `pa-server-manager-next`), not this one.
- Verify after restart: `curl -s localhost:6969/api/machine/<name>/detail` → expect
  200 / no "occupied" in reasons.

## Agent tooling: avoid "reply stops mid-way" (verified 2026-10-01)

Symptom: a reply or tool call cuts off partway with no error, the tool never runs,
and the user has to keep pressing "continue". The tail is visibly truncated
(e.g. `</ | DSDL | calls>` instead of a closed tool-call block).
Cause: a single assistant turn exceeds the output-length cap, so the tool-call XML
loses its closing half and the whole turn fails silently. This is an agent-side
output-length problem, not the app or the network.

Rules for this repo:
- One tool call per turn, one thing at a time.
- Keep `command` short; split multi-step work across turns.
- Do not write long analysis in the same turn as a tool call.
- Use `head`/`tail`/`grep` on large files; never `cat` a whole file.
- Long shell loops (e.g. `for ep in ...; do curl; done`) and multi-line heredocs
  are the main triggers. Prefer one short command per endpoint, or a script file.

Distinguishing the other failure mode: if the log shows
`Critic evaluation failed: 401` (user has to press "continue" every turn), that is
the critic issue, not truncation. Fix = `agent_settings.verification.critic_enabled:
false` in `/root/.openhands/settings.json`, then restart `agent-canvas.service`.
As of 2026-10-01 that flag is already `false` and no new 401 has appeared since the
19:13 restart, so truncation is the remaining cause.

## System Telemetry collection (2026-10-01)

Data source for machine-detail System Telemetry is `telemetry_core`, collected by
an in-process background thread (same as upstream `pa-server-manager-next`): the
worker SSHes each inventory machine with its `os_ip/os_user/os_pass` every
`TELEMETRY_INTERVAL` (default 15s), read-only (`/proc`, `nproc`, `df`, `cat
/proc/net/dev`, `uptime`, thermal/hwmon/sensors, `nvidia-smi`|`rocm-smi`).
Writes to `PA_DATA_DIR/telemetry.db` tables `os_metrics`/`net_metrics`/
`disk_metrics`/`gpu_metrics`, keyed by inventory machine NAME (not canonical
node_id).

- The worker is started in `integration/web.py` `web_lifespan` (NOT by
  `@app.on_event("startup")` on `app/main.py`: web.py overrides
  `app.router.lifespan_context`, so main.py's startup handler never runs under
  `uvicorn integration.web:app`).
- Collection runs in the Web service since 2026-10-01 (user decision: match :7000,
  no separate `run.py observe` service). The `observe` systemd unit was removed.
- `machine_telemetry` read path merges multiple history keys via
  `telemetry_core.os_series_any` because data.json slots may not store `node_id`
  (derived by `node_identity.canonical()`), so reads include name, slot key and
  every canonical node_id.

Two bugs fixed here (keep in mind when touching telemetry):
1. `machine_telemetry(name, node_id=...)` 404'd for any real node_id: it compared
   raw `machines[name]['os']` entries, which lack `node_id` until canonicalized.
   Must call `node_identity.canonical(target)` before matching.
2. `os_series_any` merge dropped GPU data: it merged only os/net/disk keys and
   kept the FIRST key's `series`, so GPU (written under machine name, queried first
   by node_id) came back empty. Now merges `series` by gpu index.

## Multi-node handoff (2026-10-01) — READ FIRST when continuing

Continuing work on **multi-node machines** (Neutrino `neutrino-n1` slots 1/2/3,
EQ3300): connection status, Overview flicker, sensor polling, diagnostics.
See `docs/HANDOFF-20261001-multinode-telemetry.md` for full context.
Still OPEN: multi-node BMC capture slow/failing (`bmc_loading` stuck), and the
select-os race. Connection-status "尚未觀測" root causes are documented there.
