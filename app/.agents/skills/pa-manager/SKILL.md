---
name: pa-manager
description: This skill should be used whenever working on the Wistron PA Server Manager codebase at /root/sheng/manager/pa_manager - reading or changing backend (main.py/telemetry_core.py), frontend (static/js/app.js, static/index.html, static/css), telemetry, rack/L10 monitoring, BMC/KVM (spx_kvm_broker), the test-library data pipeline, or the systemd service on :6969. Triggers include "改 pa_manager", "改 pa manager", "pa-server-manager", "restart pa-manager", "telemetry", "rack telemetry", "KVM broker", "spx_kvm_broker", "tests.json", "test library", and any request to edit code or data in this project.
---

# PA Server Manager - Project Work Skill

Work safely on the Wistron PA Server Manager (FastAPI backend + vanilla-JS frontend) that
manages rack components (Server/Switch/Power Shelf/PDU/CDU) data, topology and telemetry.

Read AGENTS.md at the repo root first - it is the master project-memory document (472
lines). This skill is the lean operating guide; it does not duplicate AGENTS.md.

## Iron rules (do not violate)

1. **CJK/emoji file editing - never use file_editor.** The `file_editor` tool corrupts
   UTF-8 on files containing CJK / emoji / surrogate pairs / em-dash:
   - Full-file wipe to 0 bytes (app.js) and mojibake (Cyrillic-ish garbage,
     em-dash `\u2014` double-encoded to `\u00e2\u20ac\"`).
   - Symptom check: `git show HEAD:<file>` vs worktree; count CJK 3-byte chars
     (E4-E9 start). HEAD app.js has ~6395 CJK; if it drops to single digits it is broken.
   - **Always edit such files with python**: `io.open(path,'w',encoding='utf-8',newline='\n')`,
     use `str.replace` with `assert count==1`, then verify mojibake == 0 and
     `node --check static/js/app.js`.
   - Do NOT type raw CJK into code; reuse user-provided CJK bytes or `\uXXXX` escapes.
2. **Service control is systemd, not manual nohup.** `systemctl restart|status pa-manager.service`.
   The service env sets `PA_DATA_DIR=/srv/pa-manager-prod/data`; port 6969.
   Check with `ss -tlnp | grep 6969` - must show `python3.12 (pa-manager.service)`;
   kill leftover manual uvicorn on 6969 first.
3. **Never confuse prod and dev data.** Prod = `/srv/pa-manager-prod/data/`.
   Dev samples = `./data.json`, `./telemetry.db` in the workdir.
4. **Commit/push only when the operator says so.** Record positions in dated handoff docs.
5. **Verify syntax before restart** (see Workflows below).

## Where things live

| item | path |
|---|---|
| Backend | `main.py` (FastAPI app) |
| Telemetry engine | `telemetry_core.py` |
| Frontend | `static/js/app.js`, `static/index.html`, `static/css/style.css` |
| Dev data samples | `data.json`, `telemetry.db` |
| Prod data | `/srv/pa-manager-prod/data/` (`data.json`, `telemetry.db`, `tests.json`) |
| KVM broker | `spx_kvm_broker/` (8 modules) |
| Test library xlsx (EDIT THIS for review) | `data/REVISED_commands_merged_with_raw.xlsx` |
| Build: xlsx -> tests.json | `scripts/build_testlib_json_xlsx.py` |
| Test-library review skill | `.agents/skills/pa-library-review/` (use for any tests.json / test case work) |
| GitHub repo | `https://github.com/wistroneq3300/pa-server-manager` (remote `origin`, branch `main`) |
| Docs | `docs/` (KVM broker runbooks etc.) |

## Standard dev/verify workflow

1. Backend change: verify syntax `python3 -c "import ast;ast.parse(open('main.py').read())"`
   (use `/usr/bin/python3.12`), then `systemctl restart pa-manager.service`.
2. Frontend change: always edit via python (Iron rule 1), then `node --check static/js/app.js`.
   Static files reload automatically; no backend restart needed for static-only changes.
3. Endpoint smoke: `curl -s "http://127.0.0.1:6969/api/rack/proj_k/telemetry?minutes=60"`.
4. Browser render check (headless, **no iframe** - nested iframes break under virtual-time):
   `google-chrome --headless=new --disable-gpu --no-sandbox --disable-dev-shm-usage --virtual-time-budget=90000 --dump-dom "http://<INTERNAL_IP_10>:6969/#/rack/telemetry"`.
5. Git: `git add <files> && git commit -m ... && timeout 60 git push origin main`
   (ONLY on operator instruction).

## Key architecture in one screen

- **Rack telemetry is type-based** (2026-08, major): `telemetry_core.RACK_METRIC_DEF`
  defines per-kind metrics - server=cpu_used/mem_used_pct/gpu_power, switch=port_rx/tx/temp/fan_rpm,
  powershelf=power_w/voltage/current_a/temp, pdu=power_w/voltage/current_a,
  cdu=flow_lpm/inlet_temp/outlet_temp/pressure. `collect_rack()` collectors are stubs
  (empty) until real systems/creds exist. Frontend: `static/js/app.js` `rackTelemetryHtml()`
  + `loadRackTelemetry()` (~1082-1164), chart re-init `rackTelCharts={}` on every reload.
- **L10 single-machine telemetry** is the existing format reference (get_os_series/get_gpu_series).
- **KVM**: node bridge `/ws/terminal/{name}/bmc` (SSH BMC shell), power via `ipmi_power()`
  (in-band `-I open` -> OOB lanplus `-C 17`). SP-X broker = subdomain reverse-proxy +
  server-side login + cookie handoff (`spx_kvm_broker/`). See docs/.

## Deeper reference

- **`references/architecture.md`** - detailed backend/frontend/telemetry/broker maps,
  data schema, known issues and pending items.
- **`AGENTS.md`** (repo root) - full project memory including incident history.
- For any test-library review / tests.json work: **`.agents/skills/pa-library-review/SKILL.md`**.

## Handoff / record-keeping

Write dated `SESSION_HANDOFF_<SCOPE>_<YYYYMMDD>.md` at repo root after each work window;
record every change, git state, and pending items. Update `OPENHANDS_PASTE_NEXT_WINDOW.md`
top so the next window reconnects in one read.
