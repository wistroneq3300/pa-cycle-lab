# Wistron PA Server Manager

A centralized **web management console** for **AI GPU servers** (and racks). It unifies **L10 (System Level / single node)** and **L11 (Rack Level / whole rack)** monitoring and control in a single view.

- Backend: **FastAPI (Python 3.12)**; Frontend: **vanilla JavaScript** (no framework, no build step).
- No agent required on managed hosts — everything works over **SSH** (OS) and **IPMI / BMC**.
- Historical telemetry (sensors / hardware health) is persisted in **SQLite**.
- In-browser terminal (xterm.js) is provided by a separate **node/ssh2 bridge** service.

> This README is both the **deployment guide** and the **handover doc for OpenHands / AI agents**.
> If you have a clean clone, follow "Deployment Guide" to bring the whole site up.

---

## 0. Fresh Conversation Quick-Start (for OpenHands / AI agents)

When a NEW conversation picks up this repo, read these FIRST (in this order). They are
the source-of-truth handoffs: framework + USER RULES (gold standard), the COMPLETE state,
the assign-task spec, and the project blueprint.

- `/root/test-library/SESSION_HANDOFF_T4_REVIEW_START.md`              (T4 framework + 5 locked samples + USER RULES -- gold standard)
- `/root/test-library/SESSION_HANDOFF_T4_REVIEW_FINAL_WITH_REMARK.md`  (LATEST/FINAL state: 2977/2977 done; + remark col for 125 multi-row codes)
- `/root/test-library/SESSION_HANDOFF_T4_STATE_AFTER_COMPLETE_2977.md` (prior COMPLETE handoff)
- `/root/test-library/SESSION_HANDOFF_ASSIGN_TASK_20260903.md`         (Option C step 2 spec, strict per-case rules)
- `/root/test-library/AI_TESTCASE_PROJECT_CONTEXT.md`                  (project plan / context)
- `AGENTS.md`                                                          (project knowledge + CJK safety rule)

Key facts for a fresh window:
- **Service**: pa-manager. It reads ONLY `/srv/pa-manager-prod/data/tests.json` (mtime-cached; no restart needed).
- **Build inputs (in repo now)**: `data/REVISED_commands.csv` + `data/ADDITIONS.csv`. Rebuild:
  ```
  /tmp/tx/venv/bin/python scripts/build_testlib_json.py
  ```
- **Test-library state**: 2977 unique codes = 100% of workbook; remaining 0 row-instances;
  whole-CSV can_execute YES 1001 / PARTIAL 1311 / NO 665; byte-identical groups 119 (all pre-existing, 0 new);
  locked 5 intact byte-for-byte vs bak17; build 3112 / 6 sheets / verify_build2 0 bad.
- `REVISED_commands.csv` now has **7 columns** (trailing `remark` marks the 125 multi-row codes; metadata only, NOT in tests.json).
  **CAUTION**: `genlib.append()` writes only its fixed 6 columns -> re-running a `gen_*.py` that carries a `remark` key raises
  `ValueError`; fix genlib first. Backups: bak22 (pre-remark) / bak23 (with remark).
- **Add NEW test cases** to `data/ADDITIONS.csv` (one row per case), never to `REVISED_commands.csv`.

**CJK SAFETY (HARD RULE)**: never type raw CJK into code; use `\uXXXX` escapes or reuse bytes from
`/root/sheng/manager/pa_manager/123.txt`. Verify 0 raw-CJK (0x4E00-0x9FFF) and 0 cyrillic (0xD0-0xD2)
in added regions. Pre-existing CJK in the workbook `procedure`/`criteria` is fine (not our overlay).

---

## 1. Feature Overview

### 1.1 Unified Overview Dashboard
- Aggregate view of all managed systems: KPI cards (managed / Rack / System / online rate / power ON·OFF / offline), a SUT Health big-number panel, and a donut chart of the 4 machine states (OS-online / BMC-only / offline / unknown), plus project cards.

### 1.2 L10 System Level (single node)
- Add / manage individual servers over OS SSH (IP / user / password / port); hostname auto-probed on add.
- BMC support: BMC IP can be auto-probed from the OS via `ipmitool` (`use_c17` maps to newer OpenBMC cipher 17).
- View OS info, hardware inventory (CPU / DIMM / SSD / **GPU** / NIC), sensors, **sensor AI diagnosis**, and BMC power on/off/AUX/reboot.
- **GPU (NVIDIA + AMD)**: hardware inventory shows GPU count, model and VRAM, plus per-card **GPU FW / VBIOS**. Telemetry plots per-card util / temp / power / VRAM.
  - NVIDIA via `nvidia-smi`; AMD Instinct (e.g. MI300X OAM) via `rocm-smi` + `amd-smi` (`telemetry_core.parse_amdgpu`).
- **Telemetry viewer**: SQLite history + charts (CPU / Load / DIMM / SSD / NIC / GPU) + **Telemetry AI analysis** (2–3 line 繁中 readability of the selected window, local Ollama).
- **BMC power badge**: live chassis power state with color coding.

### 1.3 L11 Rack Level (rack view)
- Rack floor plan (U slots, **numbered bottom-up**) for servers / switches / power shelves / PDUs / CDUs / storage.
- Empty-slot **"+"** adds a system (only shows **existing L11 systems of the same project, placed outside the rack**; U count is locked to that system's `rack_size`, not editable).
- Occupancy checks: avoids occupied U ranges; multi-U devices need contiguous free slots.
- **Rack topology map**: draws node ↔ switch/PDU/CDU links as an SVG connection diagram.
  - The **"New Topology / Simulate Topology" buttons are currently paused** — they show a "此功能待開發" popup (see `topoTodo()` in `app.js`). (Original implementations `linkAddDialog()` / `rackDemoTopo()` are still fully preserved in `app.js`; point the button `onclick` back to them to re-enable.)
- Topology toolbar: "expand/collapse" (`.topo-compact`), "delete all" (clear this project's links), SVG height-limited scrolling.
- **Rack Telemetry** (whole-rack, per component type — the rack view's *Telemetry* sub-tab):
  - Grouped by kind — **Server** (CPU / 記憶體 / GPU 功耗) · **Switch** (port 流量 / 溫度 / fan) · **Power Shelf / PDU** (功耗 / 電壓 / 電流) · **CDU** (水流量 / 水溫 / 水壓).
  - Each type block is collapsible (per-block toggle + "全部收合/展開"); a per-machine latest-value table (機台 × 指標) plus whole-rack line charts over a selectable window (10 分鐘 → 24 小時).
  - **Rack AI analysis**: 2–3 line 繁中 read of the whole-rack summary (same local-Ollama pattern as L10).
  - Data path: backend SSH-collects per machine (`telemetry_core.get_rack_series`); project-name match is case-insensitive (e.g. `MyRack` and `myrack` resolve to the same rack).

### 1.4 Projects
- Group machines by project (e.g. NCP / H100 / Miramar); L10 and L11 tabs are independent.
- Each project has its own status; system cards can be collapsed/expanded.

### 1.5 Web Terminal (xterm)
- Operate the **OS / BMC** SSH terminal directly in the browser.
- Runs via the separate **pa-terminal-bridge** (node + `ssh2`, port 6968), event-driven to avoid paramiko concurrency crashes.
- Passwords are not trusted from the frontend: the bridge always reads real credentials from `data.json` using `name + kind`.

### 1.6 System Broadcast (L10 tab)
- List L10 systems with OS grouped by project, and send one command to many hosts' OS shells at once.
- Command history `bcLog` records only **time + command**, **not** the target host list.

### 1.7 AI Copilot & AI Analysis
- **AI Copilot** (`/api/copilot`): natural-language assistant wired to a **local Ollama** (`qwen3.8:27b`).
- **AI analysis** is reused across several surfaces (all local Ollama, 繁中):
  - **Sensor AI diagnosis** (`/api/machine/{name}/sensors/analyze`) — L10 detail.
  - **Telemetry AI analysis** (`/api/machine/{name}/telemetry/analyze`) — L10, the selected time window.
  - **Rack AI analysis** (`/api/rack/{project}/telemetry/analyze`) — the whole-rack telemetry summary.
  - **Diagnostics / AI analysis** (`/api/machine/{name}/diagnose`).

### 1.8 KVM (single + broadcast/sync)
- **Single KVM**: browser noVNC → `/ws/kvm/{name}` → backend proxy to that BMC's RFB; BMC credentials stay server-side (`kvm_bridge.py`).
- **KVM broadcast / 同步**: one keystroke/mouse fans out to many same-project machines. Flow:
  1. Front-end first calls **`GET /api/kvm/basecode?project=<專案>`** to detect each BMC basecode (OpenBMC / OneTree / ...), returns `sync_ok` + reason.
  2. `sync_ok` true → the "📺 KVM 同步" button (project card) is enabled; one input then broadcasts to the online syncable set.
  3. Mixed protocols (RFB + IVTP), or all-IVTP (SP-X key/mouse sync not yet implemented) → `sync_ok=false`, button disabled with a reason.
- **SP-X KVM auto-login broker** (`spx_kvm_broker/`, own uvicorn / port 18992): auto-login + dedicated-subdomain KVM for SP-X (IVTP) machines.
  - Config `deploy/broker_env.sh`, systemd `deploy/spx-broker.service`, start `deploy/start_broker.sh`.
  - Background: `docs/spx-kvm-auto-login-evaluation.md`, `docs/regression-spx-kvm-broker.md`, `docs/rollback-spx-kvm-broker.md`, `docs/runbook-spx-session-cap-15000.md`.

### 1.9 Deep-link URLs
- `#/` — overview.
- `#/rack` / `#/rack/{project}` / `#/rack/{project}/{subview}` (subview: `plane` | `telemetry`).
- `#/projects/{name}` — locate + flash-highlight that project's card.
- Legacy `#/rack/{subview}/{project}` still works for compatibility.
- F5 / refresh keeps the current project + subview state.

### 1.10 In-browser User Guide
- Top-bar book icon (or press `?`) opens a **draggable / resizable / maximizable** floating window with a full, searchable user guide of every feature.
- Pure frontend: content is an HTML template + `static/js/userguide.js` (no backend, no new dependencies).
- Window position / size / minimize / last-close state persist in `localStorage`; built-in search filters sections.

---

## 2. System Architecture (read before deploying)

```
Browser (index.html + app.js + xterm.js + noVNC)
   |
   | HTTP (REST)    /api/*
   | WebSocket      /ws/*
   v
pa-manager  ----(FastAPI, uvicorn)----  port 6969 (prod) / 8788 (trial)
   |  * REST API + telemetry collection; reads/writes data.json & telemetry.db
   |  * AI: local Ollama (qwen3.8:27b) — copilot + every AI-analysis endpoint
   |  * proxies /ws/terminal/*, /ws/rack-broadcast → bridge; /ws/kvm/* → BMC RFB
   v
pa-terminal-bridge  ----(node + ssh2)----  port 6968
   |  * actually opens SSH connections to each host (OS / BMC)
   |
   |    spx_kvm_broker (uvicorn, port 18992) — SP-X/IVTP auto-login + dedicated-subdomain KVM
   v
Managed hosts  (OS over SSH, BMC over IPMI/Redfish, KVM over RFB)
```

- `pa-manager`: Python backend — data, REST, telemetry, AI (local Ollama), and proxies WebSockets.
- `pa-terminal-bridge`: Node (ssh2) service that opens the real SSH channels; **without it the web terminal is unavailable** (everything else still works).
- `spx_kvm_broker`: separate uvicorn process (port 18992) for SP-X / IVTP KVM auto-login + dedicated-subdomain KVM. **Optional** — only needed for SP-X machines.
- Ollama (local LLM, `qwen3.8:27b`): needed for the AI Copilot and all AI-analysis endpoints; if down, those lines show empty text while the rest of the console works.
- Data: the machine list lives in `data.json`, telemetry history in SQLite `telemetry.db`.

---

## 3. Directory Layout

```
pa_server_manager/
├── main.py                 # FastAPI backend (main program)
├── telemetry_core.py       # telemetry collection core (OS/GPU/switch/CDU/...)
├── kvm_bridge.py           # KVM proxy (browser noVNC → BMC RFB) + basecode detect
├── requirements.txt        # Python dependencies
├── run.sh                  # dev / trial launch script
├── pa-manager.service      # systemd unit (production, port 6969)
├── backup_prod.sh          # daily backup script
├── scripts/
│   └── seed_simulated_telemetry.py
├── spx_kvm_broker/         # SP-X (IVTP) KVM auto-login broker (own uvicorn / port 18992)
├── deploy/                 # SP-X broker ops: broker_env.sh, spx-broker.service, start_broker.sh
├── docs/                   # SP-X KVM runbooks / evaluation / regression / rollback
├── static/
│   ├── index.html          # frontend entry
│   ├── css/style.css
│   ├── js/app.js           # frontend logic (all features live here)
│   ├── img/
│   └── vendor/             # chartjs / xterm / noVNC
├── terminal_bridge/        # Node terminal bridge (ssh2 + ws)
│   ├── server.js
│   ├── package.json
│   └── package-lock.json    # run `npm ci` after clone
├── tests/                  # pytest (parsers, GPU parsers, ...)
└── AGENTS.md               # project knowledge for OpenHands (development)
```

---

## 4. Deployment Guide (for anyone with a clean clone)

> Environment requirements: **Linux**, **Python 3.12**, **Node.js 18+** (npm).
> The steps below assume a fresh machine and fresh clone — follow them top to bottom.

### Step 1 — Get the code

```bash
git clone https://github.com/wistroneq3300/pa-server-manager.git
cd pa-server-manager
```

### Step 2 — Python environment + dependencies

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

> Use Python 3.12 if possible. If the system default differs, call it out explicitly with `python3.12`.

### Step 3 — Node terminal bridge dependencies

```bash
cd terminal_bridge
npm ci            # installs from package-lock.json (ssh2 + ws)
cd ..
```

> If `npm ci` is not available, `npm install` works too.

### Step 3b — Local Ollama (for the AI features — optional)

> Optional, but without it the AI Copilot and every AI-analysis box (sensor / telemetry / rack)
> just show empty text; everything else works fine.

```bash
curl -fsSL https://ollama.com/install.sh | sh        # install Ollama once
ollama pull qwen3.8:27b                                # model the code expects (main.py OLLAMA_MODEL)
ollama serve &                                         # or run as a systemd service
```

### Step 4 — Prepare a data directory

The program picks its data location from the environment variable `PA_DATA_DIR`
(if unset, it uses the directory the program lives in).

For production, keep data in a dedicated folder (separate from any trial instance):

```bash
export PA_DATA_DIR=/srv/pa-server-manager-data
mkdir -p "$PA_DATA_DIR"
```

**First launch**: the data directory may be empty — after it is online you simply
use "Add System" on the web UI to create machines.
(If migrating an existing site, copy the old `data.json` and `telemetry.db` into `$PA_DATA_DIR/`.)

### Step 5 — Launch (trial vs production)

**Trial mode (default port 8788, handy for testing):**

```bash
source .venv/bin/activate
PORT=8788 bash run.sh
# http://localhost:8788/
```

**Production mode (recommended: systemd, persistent + boot-enabled):**

Sample unit files are provided: `pa-manager.service` and `pa-terminal-bridge.service`:

```bash
# Install the units
sudo cp pa-manager.service pa-terminal-bridge.service /etc/systemd/system/
#   WARNING: edit BOTH files — WorkingDirectory, the ExecStart python path, and
#   Environment PA_DATA_DIR — to this machine's actual paths.

sudo systemctl daemon-reload
sudo systemctl enable --now pa-terminal-bridge   # start the node bridge first
sudo systemctl enable --now pa-manager           # then the python backend
sudo systemctl status pa-manager pa-terminal-bridge
```

> Both services must run, and **pa-terminal-bridge must be able to read the same
> `$PA_DATA_DIR/data.json`** (it reads credentials from that same file).

**Optional — SP-X KVM auto-login broker** (only if you manage **SP-X / IVTP** machines):

```bash
cp deploy/broker_env.sh /etc/pa-broker.env        # edit tokens / endpoints
sudo cp deploy/spx-broker.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now spx-broker            # uvicorn on port 18992
```

> Non-SP-X (plain OpenBMC RFB) KVM does **not** need the broker — `pa-manager` proxies straight to the BMC.

### Step 6 — Verify

- Open http://<host>:6969/ — the UI should load.
- In "System Manager", add a system (OS IP/user/password), then open its web
  terminal to confirm SSH works.
- If Ollama is running, open a machine's / rack's Telemetry view and confirm the
  AI-analysis line fills in with a 繁中 summary.
- (SP-X only) confirm the broker: `sudo systemctl status spx-broker` and a KVM sync test.

---

## 5. Operations

### Backup
- Daily auto-backup: `backup_prod.sh` (keeps 14 copies). Enable via cron:
  ```bash
  crontab -e
  # daily 02:00, backup production data
  0 2 * * * /srv/.../backup_prod.sh >> /tmp/pa_backup.log 2>&1
  ```
- Manual backup: copy `$PA_DATA_DIR/` (contains `data.json` + `telemetry.db`).

### Update
```bash
cd pa-server-manager
git pull
# if python deps changed : pip install -r requirements.txt
# if node deps changed :   cd terminal_bridge && npm ci
sudo systemctl restart pa-manager pa-terminal-bridge
```

### Roll back
```bash
git log --oneline
git checkout <commit you want to roll back to>
sudo systemctl restart pa-manager pa-terminal-bridge
```

---

## 6. Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `PA_DATA_DIR` | program directory | folder that holds `data.json` & `telemetry.db` (trial/prod isolation) |
| `PORT` | 8788 | uvicorn port for run.sh; production uses service (6969) |
| `TELEMETRY_INTERVAL` | - | telemetry collection interval (seconds) |
| `MONITOR_MACHINES` | all with OS in data.json | restrict which machines are monitored |
| `TERM_BRIDGE_PORT` | 6968 | node terminal bridge port |
| `TERM_BRIDGE_HOST` | 0.0.0.0 | node terminal bridge bind address |
| `IPMI_CIPHER` | 17 | ipmitool cipher (use 17 for newer OpenBMC) |
| `IPMI_CIPHER_NO17` | 3 | cipher used when a machine has `use_c17=false` |
| `TELEMETRY_MAX_MIN` | 43200 | hard cap (minutes) on how far back telemetry series are fetched |

> Note: the AI model/endpoint are hard-coded in `main.py` — `OLLAMA_URL` (default `http://127.0.0.1:11434`) and `OLLAMA_MODEL` (default `qwen3.8:27b`).

---

## 7. REST API Overview

| Method | Path | Description |
|---|---|---|
| POST | `/api/machines` | Add machine (SSH-validated, auto hostname, level, rack_size) |
| POST | `/api/machines/probe-bmc` | Probe BMC IP via ipmitool |
| GET | `/api/machines` | List machines (passwords masked) |
| DELETE | `/api/machines/{name}` | Remove machine |
| GET | `/api/machine/{name}` | Machine detail |
| GET | `/api/machine/{name}/detail` | OS info + hardware inventory |
| GET | `/api/machine/{name}/sensors` | Sensor readings |
| GET | `/api/machine/{name}/sensors/analyze` | Sensor AI diagnosis |
| GET/POST | `/api/machine/{name}/power` | Read / control BMC power |
| POST | `/api/machine/{name}/aux`, `/reboot` | AUX power / reboot (BMC) |
| GET | `/api/machine/{name}/telemetry` | Telemetry history (SQLite) |
| GET | `/api/machine/{name}/telemetry/analyze` | Telemetry AI analysis (local Ollama) |
| GET/POST | `/api/machine/{name}/diagnose` | Diagnostics / AI analysis |
| GET | `/api/rack/ping` | Rack-level ping sweep |
| GET | `/api/rack/{project}/telemetry` | Whole-rack telemetry (by component type) |
| GET | `/api/rack/{project}/telemetry/analyze` | Rack AI analysis (local Ollama) |
| POST/GET/DELETE | `/api/rack/passive`, `/api/links` | Rack elements & links |
| GET/POST/DELETE | `/api/projects` | Project management (+ `/api/projects/reorder`, `/api/machines/reorder`) |
| POST | `/api/copilot` | AI Copilot |
| GET | `/api/kvm/basecode` | Detect per-machine BMC basecode + whether KVM sync is possible |

WebSocket:
- `/ws/terminal/{name}/{kind}` — OS/BMC terminal (kind = `os` | `bmc`), proxied two-way to the bridge.
- `/ws/rack-broadcast` — rack broadcast terminal (same-project multi-host).
- `/ws/kvm/{name}` — single KVM (noVNC) proxied to the BMC RFB; plus KVM-broadcast sync across a project.

---

## 8. Data & Security Notes

- Machine list is stored in `data.json`; telemetry in SQLite `telemetry.db`; isolated per instance by `PA_DATA_DIR`.
- **Credentials are stored in plaintext in `data.json`.** There is no login / RBAC yet.
  **Add authentication before exposing to a broader audience**, and consider
  encrypting passwords at rest (`ADMIN_PERMISSION_BLUEPRINT.md` is an unimplemented auth blueprint).
- `prod-data.json` (an old snapshot that contained plaintext real-machine credentials)
  has been **removed from version control and added to `.gitignore`** — it will not leak with a clone.
- Managed hosts need no agent, but you do need their SSH and IPMI credentials to be managed by this system.

---

## 9. Troubleshooting

| Symptom | Cause / Fix |
|---|---|
| Web terminal won't connect | pa-terminal-bridge is down or wrong port: `sudo systemctl status pa-terminal-bridge`; make sure it can read `$PA_DATA_DIR/data.json` credentials |
| `python: command not found` | venv not built or not activated: `source .venv/bin/activate` |
| Power on/off fails | wrong BMC credentials, or cipher mismatch; set `IPMI_CIPHER` (17 for OpenBMC) |
| Page 403 / unreachable | service not running: `sudo systemctl status pa-manager` |
| No telemetry data | host offline or not connected; wait for next collection (tune `TELEMETRY_INTERVAL`) |

---

## 10. For OpenHands / Developers

- The repo has an `AGENTS.md` with project knowledge and development caveats — read it before continuing work.
- Frontend logic is all in `static/js/app.js` (~170KB, no framework, no build).
- The `index.html` modals/DOM and `style.css` styling are under version control.
- **When editing strings that contain emoji, prefer doing the edit with a Python script**,
  to avoid an editor surrogate-pair issue that can wipe the whole file (historical lesson; see AGENTS.md for details).

---

## 11. Test Library: Build Inputs & How to Add a New Case

The test library is a CSV overlay (keyed by `code`) merged at build time onto the source workbooks to produce `tests.json`, which the app reads (mtime-cached, no restart).

**Files (prefer the repo copy in `data/`; the build falls back to `/root/test-library/` if absent):**
- `data/REVISED_commands.csv` — the 2977 reviewed cases (per unique `code`): columns `code,ai_can_execute,ai_commands,ai_packages_needed,ai_logs_output,risk,remark`. The trailing `remark` column is metadata only and does NOT flow into `tests.json`.
- `data/ADDITIONS.csv` — **add NEW test cases here** (one row per new case). Same 7-column schema (`remark` optional), plus optional `sub_function,test_set,items,procedure,criteria` columns. Rows here are appended to the "Functionality" sheet as brand-new cases.

**How to add a new test case:** append a row to `data/ADDITIONS.csv` with a unique `code` and fill the `ai_*` fields (and `risk` if applicable). Do NOT touch the source workbooks (`RAW`/`REVIEW` in `/root/test-library/`). Then rebuild:
```bash
/tmp/tx/venv/bin/python scripts/build_testlib_json.py
```
**Do NOT** put new cases in `REVISED_commands.csv` (that file is the overlay for existing codes).
Note: cloning this repo alone cannot rebuild `tests.json` because the source Excebooks live under `/root/test-library/`.
