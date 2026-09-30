# PA Server Manager - Architecture Reference

Detailed map of the codebase. Companion to SKILL.md and AGENTS.md (repo root).

## Backend (main.py, FastAPI)

- Power control: `ipmi_power(m, action)` at ~line 304. In-band `ipmitool -I open` first,
  falls back to OOB lanplus `-C 17`. Actions: on/off/cycle/reset/status.
- Test library API: `GET /api/testlibrary` (~857), `/api/testlibrary/meta` (~871),
  `/api/testlibrary/export` (~888). Reads prod `tests.json`.
- Machine edit: `POST /api/machines/{name}/change-os-ip` (~587) - only changes OS IP,
  requires ping-ok + SSH hostname match (anti-DHCP-drift).
- WebSocket terminal bridge: `/ws/terminal/{name}/{kind}` (~1747) proxies to
  `/ws/terminal/{name}/{kind}` target bridge. **Known fixed bug** (2026-08): proxy used to
  drop the `?host=&user=&pass=&port=` query params from the browser, breaking passive /
  custom-cred connections ("未設定連線資訊"). Query now forwarded.
- Rack telemetry: `GET /api/rack/{project}/telemetry` (~2203), plus
  `/api/rack/{project}/telemetry/analyze` (~2249).

## Telemetry engine (telemetry_core.py)

- `RACK_METRIC_DEF` (~93): per-kind metric definitions (label/unit/color).
  - server: cpu_used, mem_used_pct, gpu_power
  - switch: port_rx, port_tx, temp, fan_rpm
  - powershelf: power_w, voltage, current_a, temp
  - pdu: power_w, voltage, current_a
  - cdu: flow_lpm, inlet_temp, outlet_temp, pressure
  - storage/network also defined
- `kind_of(m, name)` (~140): determine kind from mgx_type / name fallback; blanking -> blanking.
- `_job(item)` (~579): dispatch by kind - server -> collect_gpu/collect_os; others -> collect_rack.
- `store_rack(ts, name, kind, rows)` (~607): writes EAV table `rack_metrics(ts,machine,kind,metric,value)`.
- `collect_rack(m, kind)` (~617): **stub** (returns empty) until real systems/creds exist.
  Implement per vendor/model when machines are online (switch `show interfaces`...,
  powershelf/pdu SNMP..., cdu flow/temp/pressure...).
- `get_os_series(name, minutes)` (~657) and `get_gpu_series(name, minutes)` (~673):
  L10 single-machine series (the format reference for the rack level).
- `get_rack_series(project, minutes)` (~709): aggregates per project; servers reuse os/gpu_metrics,
  other kinds from rack_metrics. Returns `{kind: {defs, machines(per-machine latest), history}}`.

## Frontend (static/js/app.js)

- `mgxTypeOf(m)` (~658): component-kind detection (mirrors backend `kind_of`; keep in sync).
- Rack views: devicesView "plane" | "list" | "telemetry". `rackSubviewTabs()` (~1163)
  builds the tab bar. `rackTelemetryHtml()` (~1234) container + `loadRackTelemetry()` (~1337).
- `rackTelKindBlock(kind, count)` (~1303): one collapsible `.rt-kind` block per kind;
  data -> per-metric canvas lines + per-machine latest table (bars);
  no data -> "waiting for real system" placeholder.
- `rackTelCharts = {}` (~1219): **must be reset on every load** - canvas nodes are rebuilt by
  innerHTML so old Chart.js instances hang on dead nodes.
- Deep-links: `#/rack/telemetry/{project}` etc.
- Chart.js vendor bundle: `static/vendor/chartjs/chart.umd.min.js`.
- CSS: `.rt-kind-*`, `.rt-bars-*`, `.rt-bar-*` in `style.css` (~673).

## KVM / BMC

- Terminal: BMC text console via node bridge `/ws/terminal/{name}/bmc` (SSH `client.shell()`).
- Power: backend `ipmi_power()` (in-band `-I open` -> OOB lanplus `-C 17`; fleet_l = OpenBMC).
- SP-X KVM broker (`spx_kvm_broker/`): subdomain reverse-proxy per BMC
  (`bmc-<sid>.kvm.lab.example.internal`), server-side login, host-only cookie handoff,
  launch_id in POST body only. Modules: config.py, secret_store.py (age-encrypted root-only
  credentials, `/etc/portal/secrets/spx-bmc-credentials.age`), registry.py (SQLite session
  registry, launch_id TTL/single-use/binding), spx_client.py, broker.py (mint/consume,
  RBAC, session reuse/rotation, rate-limit, per-BMC cap, audit), rbac.py, app.py.
- Nginx: BMC vhost location `/__spx_launch` -> broker; portal vhost `/api/kvm/launch` -> broker
  (`/etc/nginx/conf.d/bmc_proxy.conf`). Service `deploy/spx-broker.service` (127.0.0.1:18992).
- Tests: `/usr/bin/python3.12 -m pytest tests/ -q` (30 tests, in-process mock SP-X in tests/mock_spx.py).
- Known blocker: test BMC hit SP-X session cap (code 15000) - see
  `docs/runbook-spx-session-cap-15000.md`. Portal backend has no auth/RBAC; broker currently
  fail-open (`SPX_PORTAL_AUTH=noauth`); real RBAC goes through `app.py _resolve_auth` seam.

## Data layout

- `machine`: name -> dict with level/project/rack_u/rack_size/os_ip/os_user/os_pass/
  bmc_ip/.../mgx_type(blanking/server/switch/powershelf/pdu/cdu/...).
- prod_k is the only L11 rack project (server 33 / switch 2 / powershelf 3, rest blanking);
  fleet_l / node_i / host_e / node_h / client_c are L10 single-machine projects.
- Prod machine data: `/srv/pa-manager-prod/data/data.json`; telemetry DB:
  `/srv/pa-manager-prod/data/telemetry.db`.

## Known current state / pending (from AGENTS.md)

- proj_k 43 machines currently all offline -> rack telemetry shows placeholders; data appears
  automatically once SSH collection works again.
- Pending when real systems/creds exist: implement `collect_rack` per vendor/model for
  switch/powershelf/pdu/cdu (cdu = flow_lpm/inlet_temp/outlet_temp/pressure).
- The test library has been fully re-reviewed (round-3 locked, 3112/6 sheets) - see
  `agent skill pa-library-review` and `REVIEW_WORKFLOW_LOGIC.md`.
