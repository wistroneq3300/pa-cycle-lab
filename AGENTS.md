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
- Verify after restart: `curl -s localhost:6969/api/machine/<name>/detail` ŌåÆ expect
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

## Multi-node handoff (2026-10-01) ŌĆö READ FIRST when continuing

Continuing work on **multi-node machines** (Neutrino `neutrino-n1` slots 1/2/3,
EQ3300): connection status, Overview flicker, sensor polling, diagnostics.
See `docs/HANDOFF-20261001-multinode-telemetry.md` for full context.
Still OPEN: multi-node BMC capture slow/failing (`bmc_loading` stuck), and the
select-os race. Connection-status "Õ░Üµ£¬Ķ¦ĆµĖ¼" root causes are documented there.

## Cycle command per-project (esp. aux) ŌĆö TODO, not started (2026-10-02)

User requirement: cycle power/reboot commands should be **per-project**, because
projects differ mainly in **aux_cycle** (some use BMC standby controller, others
hook a **PDU**). Current state (all projects share ONE table; aux is hardcoded):

- Actions come from `integration/profiles.py` `default_package()` ŌĆö the same 6
  actions for every project: `reboot:inband`(`['reboot']`), `reboot:outband`
  (ipmi `['power','reset']`), `power_cycle:inband`(`['ipmitool','power','cycle']`),
  `power_cycle:outband`(ipmi `['power','cycle']`), and `aux_cycle:inband/outband`
  = `['/usr/bin/stbypowerctrl.sh','aux_cycle']` (executor=ssh, role=bmc).
- **aux is hardcoded in TWO places**: `integration/profiles.py:30` (argv) AND
  `engine/vera_cycle/cycle_engine.py:550`
  (`self.dispatch(record,"cycle_command","bmc","/usr/bin/stbypowerctrl.sh aux_cycle")`).
  Both assume aux == BMC standby controller, so a PDU-based aux project cannot run.
- `validate()` (profiles.py) currently **locks** executor to `ipmi`/`ssh` and
  forces ipmi argv to equal the default byte-for-byte (anti-injection). Supporting
  a PDU aux requires relaxing this ŌĆö security-relevant, needs explicit user OK.

Plan (agreed so far, confirm before building):
1. Make ONLY `aux_cycle` per-project-configurable; keep reboot/power_cycle shared.
2. Prefer a structured `<project>_commands.json` (schema-validated) over free txt.
3. Variables already exist for the "OOB needs `-C 17` + creds" pain: `ipmi_cipher`
   (`-C 17`), `credential_ref` (creds, not plaintext), `os_ip/bmc_ip/*_hostname`.
   BMC IP is read from OS via `ipmitool lan print`; BMC hostname needs SSH to BMC.

OPEN questions to ask the user before implementing:
- Which aux variants to support (BMC standby / PDU-over-ssh / PDU-over-ipmi)? Need
  1ŌĆō2 concrete examples (exact command, transport, whether `-C 17`).
- OK to relax `validate()` for the aux action? (enables arbitrary-argv risk)
- Format: `<project>_commands.json` (recommended) vs plain txt.
- Order: this vs. the "hostname ń▓ŠńĘ╗ńēł" (on job-create, probe os/bmc hostname,
  write back to the node's own `os[slot]` in `data/pa6969/data.json`, block run if
  probe fails) ŌĆö see that item below.

## Hostname live-probe on job create ("ń▓ŠńĘ╗ńēł") ŌĆö TODO, partially done (2026-10-02)

User wants: when building a cycle job, **live-probe each selected node** and fill
`os_hostname` / `bmc_hostname` into that node's OWN slot in `data/pa6969/data.json`
(overwrite). If the probe fails for any selected node, **block the run** (no start).
Decision: (c) probe at job-create time; "µēōÕŗŠÕō¬ÕĆŗµŖōÕō¬ÕĆŗ"; simplest-but-pretty UI.

Probe steps per node: SSH OS `hostname` ŌåÆ `os_hostname`; OS `ipmitool lan print`
ŌåÆ BMC IP (verify); SSH BMC `hostname` ŌåÆ `bmc_hostname`.

DONE already (code): `app/main.py add_machine` now stores the SSH-grabbed OS
hostname into `os_hostname` (machine-level + primary slot) and best-effort BMC
hostname into `bmc_hostname`. Filled Neutrino `data.json` slots 1/2/3
(os=n1/n2/n3, bmc=vc-256-bmc-n1 / vc-256-bmc-n3 / vc-256-bmc-n3; n2==n3 BMC name
flagged to confirm ŌĆö possibly a shared BMC). Backup:
`data/pa6969/data.json.bak-20261002-014948`.

STILL TODO: the on-job-create probe API + frontend status/error display + block.
Multi-OS machines store hostnames at SLOT level (`os[i]`), not machine level ŌĆö
must locate the node via `node_id`. Cycle UI (cycle.js) ALREADY has mode/channel/
loops/hours/timeout form; only the hostname probe column/status is new.

## Cycle UI project routing bug ŌĆö FIXED (2026-10-02)

Symptom: clicking "Verification Cycle" on the Neutrino project showed another
project's error (e.g. `µēŠõĖŹÕł░ checker Ķģ│µ£¼ .../eq3300_config.sh`) ŌĆö a stale/wrong
project. Root cause was in `app/static/js/cycle-workspace.js` (the active cycle
view; it overrides `cycle.js`'s `openCycleTest` because it loads last):
1. `openCycleTest`/`openChassisCycle` built the hash from `project_id` only; many
   projects have no `project_id`, so the URL carried a stale/empty id.
2. `wizard()` matched `inventory.find(p=>p.project_id===route[0])` and threw
   "Project unavailable" when there was no project_id.
3. When the new hash equalled the current hash, `hashchange` did not fire, so the
   view never re-mounted and the previous project stayed on screen.

Fixed: route now falls back to the project NAME when there is no project_id;
`wizard()` also falls back to matching by name; `openCycleTest`/`openChassisCycle`
force `mount()` when the hash is unchanged. Bumped cache-buster in `index.html` to
`cycle-workspace.js?v=20261002-projroute1`. `node --check` passes; web restarted.

NOTE: TWO cycle UIs coexist ŌĆö `cycle.js` (old modal) and `cycle-workspace.js`
(Next-style hash router, active). This duplication is the source of the confusion
and is worth consolidating later.

## L11 system broadcast + slot label fix (2026-10-02)

- Added a second "­¤ōĪ ń│╗ńĄ▒Õ╗ŻµÆŁ" button next to "’╝ŗ µ¢░Õó×Ķć│µ®¤µ½ā" on the L11 (rack) tab
  of the System/Projects page (`app/static/js/app.js`). `systemBroadcastDialog(level)`
  is now level-aware: `level="system"` (L10) lists non-rack machines; `level="rack"`
  (L11) lists rack machines, expanding multi-OS chassis into per-node keys
  (`name#slot`) like the in-rack dialog. `setProjectLevelFilter()` toggles both
  `sys-btn-broadcast` (L10) and `sys-btn-broadcast-rack` (L11).
- Fixed Neutrino broadcast list showing "OS 1": slot 1's `label` was empty in
  `data/pa6969/data.json`, so the UI fell back to `e.label || ('OS '+slot)` = "OS 1".
  Set slot 1 label = `neutrino-n1` (matches its os_hostname). data.json is
  gitignored, so this fix is local-only.

## BMC log sources differ by vendor ŌĆö SEL vs Event (2026-10-02)

When reading BMC logs, the IPMI SEL and the Redfish Event log are DIFFERENT
sources, and which one carries cycle-relevant events depends on the BMC vendor:
- **NVIDIA (VR200 NVL, e.g. 10.35.228.155, FW 26.09)**: `ipmitool sel` = real
  hardware SEL (was empty/0 entries); cycle events (Host0 powered on, BMC boot,
  CPLD/BlueField errors) live in the **Redfish Event log**
  (`/redfish/v1/Systems/System_0/LogServices/EventLog/Entries`, 22 entries incl.
  2 Critical + 1 Warning). ŌåÆ **For NVIDIA, watch the Event log (SEL is empty).**
- **Wistron (e.g. 10.35.228.145, FW 3.08)**: `ipmitool sel` content is effectively
  the OpenBMC event (sel Ōēł event). Uses standard Redfish ids `system`/`bmc`
  (not `System_0`/`BMC_0`), and has NO SEL LogService (has EventLog + Journal).
- Redfish base differs per vendor ŌåÆ always discover ids via
  `GET /redfish/v1/Systems` and `GET /redfish/v1/Managers`; never hardcode.
- Cycle engine currently diffs SEL per loop; for NVIDIA targets that delta will be
  empty, so an **Event-log delta** would be needed (not yet implemented).





## PENDING work (2026-10-02, second round) - READ docs/HANDOFF-20261002b-cycle-ui-and-pending.md

Cycle per-project checker works; Neutrino enters the wizard but still cannot RUN. Pending:
(1) tray bound to project name (targets/control), (2) power_domain per-node (each independent),
(3) credential_ref - cycle uses provider.credentials() not data.json, and
local_provider._credentials() returns {} (stub); needs (P) credentials.json or (Q) read
data.json, both require editing local_provider.py, (4) mapping_status=confirmed (only via
data.json; node_id auto-regenerated, cannot be hidden), (5) drop Profile quantities from
freeze() so config.sh is the single source of expectations, (6) aux per-project (PDU),
(7) hostname live-probe on job create. This round also: removed Profile field from cycle UI
(hidden input kept), replaced loop/hour limits with a single limit-type menu (loop N run /
hr N hours, no default), hid parallel-domain cap (parallelism now backend default 8), fixed
/api/cycle/inventory so a project without a checker no longer 404s the whole list (shows the
project with a missing-file error), and fixed naboo-01's colliding BMC IPs in data.json.
NOT COMMITTED yet.

## Cycle per-project follow-up - DONE 2026-10-02 (second round)

Resolved the Neutrino "can't run a cycle" blockers (was 4 per node, now 1):

1. **tray / node are DERIVED, never stored** (`integration/targets.py expand()`):
   `tray = parent.tray or parent.project or name`; `node = slot.os_hostname or slot.node
   or slot.label or 'n'+slot`. `Target.key = "{tray}_{node}"` (cycle_core.py:87 untouched) ->
   log folders become `Neutrino_neutrino-n1`. Deleting/renaming a project updates tray
   automatically; nothing to keep in sync in data.json.
2. **power_domain is auto-derived too**: `{project}-{node}` (e.g. `Neutrino-neutrino-n1`),
   not written to data.json, and hidden from the cycle UI. Rationale: every node is its own
   domain (independent aux per node), so the value only needs to be unique. The backend
   same-domain checks (`store.py:540`, `web.py:182/373`) are LEFT INTACT — they just never
   fire. If a real shared busbar appears, supply an explicit `power_domain` in inventory and
   the guard works again. NO `-pd` suffix anywhere (kept out of logs).
3. **credential_ref removed** (internal lab, user accepts credential exposure):
   `runner.py` no longer calls `provider.credentials()`; it reads `os_password`/`bmc_password`
   straight from the target. `store.py` blocker now only requires a non-synthetic inventory
   for live. `targets.py` maps slot `pass`/`bmc_pass` (and machine-level `os_pass`/`bmc_pass`
   for single-OS machines) into `os_password`/`bmc_password` (added to SAFE_FIELDS). Same
   change in `web.py control_transport` and `observation_service.py`.
4. **mapping_status=confirmed still PENDING**: user will confirm when about to test the
   selector; verify by SSH into each OS that hostname matches its BMC IP first. Until then
   each node keeps the single remaining blocker "Physical slot/action scope mapping needs
   confirmation".
5. **Profile quantities removed from freeze()** (`integration/profiles.py`): freeze() no
   longer injects `CPU_MIN/DIMM_EXPECTED/...` into the checker's `# PROFILE_PARAMETERS`
   block, so `<project>_config.sh` is the single source of counts. `PROFILE_*_ENABLED` /
   `PROFILE_*_MODE` are still injected (config.sh defaults them to enabled/its own mode, so
   behaviour is unchanged). The action table still lives in the profile (not config.sh).
6. **aux per-project (PDU) - NOT NEEDED YET, recorded for later**: all current projects use
   a power shelf + busbar and run aux via BMC (`stbypowerctrl.sh aux_cycle`), so no work now.
   When a PDU project appears: aux is hardcoded in TWO places (`integration/profiles.py:30`
   argv and `engine/vera_cycle/cycle_engine.py:550` dispatch), and `validate()` locks
   executor to ipmi/ssh with an exact ipmi argv — supporting a PDU aux needs that relaxation
   (security-relevant). Ask the user for the exact PDU command/transport and json-vs-txt first.
7. **hostname live-probe on job create DONE** (`integration/web.py`): in LIVE mode,
   `create_job` calls `_probe_hostnames(chosen)` which SSHes each selected node's OS
   (`hostname`), then its BMC (`hostname`, after a ping check); `_writeback_hostnames()`
   overwrites that node's OWN slot in data.json (located by node_id). ANY node failing to
   probe blocks the whole job (Conflict listing every failure). Reasoning behind this:
   `add_machine` already grabbed BMC hostname best-effort; on job-create both OS and BMC are
   now REQUIRED, per user's "抓失敗擋住".

CYCLE_MODE is `live` for the 6969 service, so step 7's probe really hits hardware on job
create — do not create a job just to "test" while the user is not ready.

NOT COMMITTED yet (this round): targets.py, store.py, runner.py, web.py,
observation_service.py, profiles.py, app/static/js/cycle-workspace.js.

## Telemetry reorg + diagnostic collapse (2026-10-04) — READ when touching Telemetry/inspection UI

Branch `astra-console-import`, ALL PUSHED to `origin/astra-console-import` (HEAD `10fed65`).
Full context: `docs/HANDOFF-20261004c-telemetry-console-and-diagnostic.md`.

What landed (9 items, all verified on real EQ3300):
1. **Node Exporter / DCGM split into 2 independent, retryable cards** — each has its own
   auto-install button + manual steps; a host (Node Exporter) failure does NOT block gpu (DCGM).
   `integration/telemetry_gpu.py` `install_job(scope)` where scope in {host,gpu,all}.
2. **detect_command `\n` bug fixed** — each `printf` was missing `\n`, so
   `VERSION=LISTENER=DOCKER_BIN=...` collapsed onto one line → parsed as empty → misreported
   "nvidia runtime missing". Added `\n` + fields DOCKER_BIN/NVIDIA_CTK/TOOLKIT_PKG/DAEMON_JSON.
3. **`_runtime_diagnosis()`** → multi-line `GPU_DIAGNOSE` console step (EQ3300 root cause was
   daemon.json configured nvidia runtime but daemon not reloaded).
4. **DCGM manual steps 3→6** (added NVIDIA Container Toolkit install + `nvidia-ctk runtime
   configure` + restart-docker warning).
5. **Frontend console blank bug fixed** (`telemetry-provision.js`): node switch called
   `closeConsole()` and never reopened; `eventsBusy` stayed true after a superseded generation;
   READY jobs polled 15s. Now: reopen on switch, clear `eventsBusy` unconditionally, self-heal
   cursor when rows empty, dedup by sequence, 1.5s fast-poll while console open.
6. **AI analysis moved into the native Grafana dashboard; Legacy Telemetry block removed.**
   The old `進階資料 · Legacy Telemetry` (which held the 遙測 AI analysis `#tel-ai`) is gone.
   AI analysis now renders in `telemetry-native.js` next to the charts, wired to the same
   `/api/machine/{name}/telemetry/analyze`; time-range selector restored to the legacy 9 options
   (10m..30d). Charts RANGES expanded accordingly (`integration/telemetry_charts.py`).
7. **3 new chart panels**: CPU Temperature (`cputemp`, max of non-NVMe `node_hwmon_temp_celsius`),
   GPU NVLink Bandwidth (`nvlink`, `DCGM_FI_DEV_NVLINK_BANDWIDTH_TOTAL`), Host Memory (DIMM) ECC
   (`ecc`, `node_edac_correctable/uncorrectable_errors_total` by controller). Panels grouped by
   subsystem. Native test panel count 8→11.
8. **System diagnostic section now collapsible** (`product-detail.js`): `pd-diagnostic-collapse`
   caret, per-machine `diagnosticCollapsed` Map so it survives re-render, body hides when collapsed.
9. **Inspection coverage explained** (analysis only, no code): see handoff §7.

STALE rule: `integration/inspection_service.py:166` — a source is STALE when
`age_seconds > freshness_seconds` (per-source: 300s most, 660s sensor, 1260s tools/pcie,
3660s firmware; global default `stale_seconds`=300). EQ3300 shows all STALE because its
inspection schedule is `enabled:false`.

STILL PENDING (user asked, NOT implemented):
- Q1: Hardware checker = `engine/vera_cycle/<project_slug>_config.sh`. `L11 Test` needs
  `l11_test_config.sh` (ABSENT → Hardware NOT_READY). Templates: `neutrino_config.sh`,
  `naboo_config.sh`. No fallback (`CheckerMissing`); script needs the profile contract marker.
- Q2: BMC Hostname can go over SSH — `engine/vera_cycle/validation_identity.py:49` already
  supports it via `binding.capabilities.bmc_hostname_query=='ssh_hostname'`, but NOTHING writes
  that capability yet. EQ3300 takes the Redfish path, whose BMC lacks `HostName` → NOT_SUPPORTED.
  To fix: set `capabilities={"bmc_hostname_query":"ssh_hostname"}` on the OS-1 node binding
  (`NODE_BINDING` writable dict; `integration/inventory.py validate_binding`). No UI entry yet.

Repo note: `pa-cycle-lab` has NO `main` branch (default is `codex/neutrino-v1`); all work went to
`astra-console-import`. `vera-cpu-rack-cycle` is a SEPARATE repo (has main) with unrelated history.

## Node identity MAC guard + connection hostnames (2026-10-05, commit 349d4ba)

- `validation_overview` (/api/validation/overview) crashed with KeyError on targets lacking
  `node_id` (non-node machines: blanking panels, switches). Middleware maps KeyError to a
  generic 404, so the dashboard showed empty. Fixed by filtering targets with `node_id`.
- Identity hostname changes are now guarded by MAC: `collect_identity` records `os_mac`/`bmc_mac`
  (matched to the REGISTERED os_ip/bmc_ip via `ip a` / `ipmitool lan print`). `identity_sync`
  accepts a hostname change only while the same MAC is present; a MAC mismatch (or an unreadable
  MAC after a baseline exists) blocks with IDENTITY_REQUIRES_CONFIRMATION. First observation
  records the MAC baseline in data.json (one durable write). Raw, case-preserving hostnames are
  stored as `os_hostname_raw`/`bmc_hostname_raw` (note: `normalize_hostname` lowercases).
- 連線狀態 panel now shows a small Hostname tag for OS/BMC (raw case), with a warning variant
  when it differs from the system name.
- Telemetry manual install instructions restored (host+gpu) from `host_setup`/`gpu_setup`.
- Removed the legacy "既有效能圖表" collapsible (`tp-legacy`) from the Telemetry panel.
- Pre-existing test failures (~87) in this checkout are fixture/env gaps (missing checker scripts,
  run2 engine variant) — NOT caused by this work; keep the diff of `pytest tests/ -q` before/after.
