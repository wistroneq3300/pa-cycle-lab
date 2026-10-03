# HANDOFF 2026-10-04c — Telemetry 重組：拆開安裝、修 console、搬 AI 分析、加 3 面板、診斷收合

> 分支：`astra-console-import`　｜　已 push：`origin/astra-console-import`　｜　HEAD：`10fed65`
> 環境：`/root/sheng/PA-manager-6969`（live 6969）　｜　撰寫時間：2026-10-04 CST
> 真機：EQ3300-AIAgent（7× NVIDIA B200，Driver 580.178.04，OS 1 node `fb34a37e…`）

---

## 0. 一頁摘要

| # | 做了什麼 | 狀態 | commit |
|---|---|---|---|
| 1 | **Node Exporter / DCGM 拆成兩個獨立可重試區塊**：各自有自動安裝按鈕 + 手動安裝教學；Node Exporter 失敗也繼續試 DCGM；失敗資訊回饋 agent 迭代。 | ✅ 上線+實機驗證 | `c47f4c9` |
| 2 | **修 detect_command 換行 bug**：每個 `printf` 缺 `\n` → 變數擠成一列 → 解析出空值 → 誤判缺 nvidia runtime。補 `\n` + 新增 DOCKER_BIN/NVIDIA_CTK/TOOLKIT_PKG/DAEMON_JSON 欄位。 | ✅ DCGM 由「裝不了」→ READY | `d2c8778` |
| 3 | **新增 `_runtime_diagnosis` + GPU_DIAGNOSE console 步驟**：DCGM 卡住時顯示多行診斷（nvidia runtime 未載入等）。 | ✅ | `d2c8778` |
| 4 | **DCGM 手動教學 3→6 步**：補上 NVIDIA Container Toolkit 安裝 + `nvidia-ctk runtime configure` + restart docker 警告。 | ✅ | `d2c8778` |
| 5 | **修前端 console 空白**：切節點會 `closeConsole()` 且 `eventsBusy` 被舊 generation 卡死、READY job 輪詢 15s → 顯示「正在連線」+0 行。切節點後重開 console、`eventsBusy` 無條件清、rows 空則 cursor=0、按 sequence 去重、console 開著時 1.5s 快輪詢。 | ✅ 3 場景全過 | `77927c1` |
| 6 | **AI 分析搬到 Grafana 區 + 移除 Legacy 區塊**：舊 `進階資料 · Legacy Telemetry`（含遙測 AI 分析 `#tel-ai`）整塊刪除；AI 分析改畫在 native dashboard 圖表旁，接同一 `/telemetry/analyze`；時間範圍改回舊版 9 項（10m→30d）。 | ✅ 實機驗證 | `4a707db` |
| 7 | **加 3 個圖表面板**：CPU Temperature、GPU NVLink Bandwidth、Host Memory (DIMM) ECC Errors。面板依 subsystem 分組排序。 | ✅ 實機驗證 | `7a5efdf`、`c1465a7` |
| 8 | **系統診斷可收合**：加 `▾` 收合鈕（跟系統巡檢一致），收合狀態按機台保存、重繪後不重置。 | ✅ 實機驗證 | `10fed65` |
| 9 | **巡檢涵蓋範圍解讀**（EQ3300）：找出哪些不能診斷、為什麼（見 §7）。 | ✅ 已完成分析 | —（未改程式）|

**兩句重點**：Telemetry 頁現在是「兩張獨立安裝卡（Node Exporter / DCGM）+ Grafana 圖表（11 面板）+ 遙測 AI 分析」，Legacy 區塊已移除；console 切節點不再空白；系統診斷可收合。全部已 push 到 `origin/astra-console-import`。

**未 push / 未做**：Q2 的「BMC Hostname 改走 SSH」與 Q1 的「L11 Test 硬體 checker 腳本」**尚未實作**（見 §8 PENDING）。

---

## 1. 環境與登入

- 服務：`pa-manager-6969-web`（systemd），`sudo systemctl restart pa-manager-6969-web` 重啟
- 真機 URL：`http://10.35.228.144:6969/#/machine/EQ3300-AIAgent`
- EQ3300 OS 1 node：`fb34a37e55125dadbd7b044ab0aed310`（host READY, gpu READY）
- Prometheus：`http://127.0.0.1:9090`（本機）
- venv：`/root/sheng/PA-manager-6969/.venv`
- **前端靜態檔案要改版本 tag**（`app/static/index.html` 的 `?v=`）才會強制瀏覽器重載；本次已用到 `telemetry-native.js?v=20261004-ai2`、`product-detail.js?v=20261004-diagcollapse2`

---

## 2. Telemetry 安裝拆開（兩卡片）

### 2.1 區塊結構
`app/static/js/telemetry-provision.js` 的 card() 產生兩張 `[data-comp]` 卡片：
- `host` = **Node Exporter**
- `gpu` = **DCGM**

每張卡有：狀態徽章、**「自動安裝」按鈕**（只觸發該 scope 的 job）、**手動安裝教學**（`<details>`）。

### 2.2 後端 job scope
`integration/telemetry_gpu.py`：
- `install_job(scope)` — scope ∈ `{'host','gpu','all'}`。host 失敗**不擋** gpu（獨立可重試）。
- **`detect_command`**（本次關鍵修復）：每個 `printf` 補 `\n`。新增欄位 `DOCKER_BIN`/`NVIDIA_CTK`/`NVIDIA_RUNTIME`/`TOOLKIT_PKG`/`DAEMON_JSON`。
- **`_runtime_diagnosis()`**：回傳多行診斷，輸出為 **`GPU_DIAGNOSE`** console 步驟。EQ3300 當時根因 = **nvidia runtime 未載入**（daemon.json 已配但 daemon 沒 reload）。
- **`setup_instructions()`**：DCGM 手動 6 步（含 NVIDIA Container Toolkit）。

### 2.3 fixture
`integration/telemetry_fixture.py`：`PA_DCGM_DETECT` fixture 加新欄位 + `gpu_scenarios`（含「nvidia runtime 未載入」場景）。

---

## 3. 前端 console 空白 bug（已修）

### 3.1 三個根因（都在 `telemetry-provision.js`）
1. **切節點 `select()` 會 `closeConsole()`**，且不重開 → console 空著
2. **`eventsBusy` 的 `finally` 只在 generation 相同才清** → 被新版取代後**永遠卡 true** → 之後所有 poll 被擋
3. **READY job 輪詢 15s** → 剛開 console 要等 15s 才有內容

### 3.2 修法
- `select()` 存 `wasOpen`，切完若原本開著就 `openConsole()` 重開
- `eventsBusy` 無條件清
- self-heal：`rows` 空但 `cursor>0` → `cursor=0` 重拉
- 按 `sequence` 去重
- console 開著時 1.5s 快輪詢（不管 job 是否已完成）

### 3.3 驗證腳本（可重跑）
- `/tmp/eq_stress.py`：3 場景（正常開 / 快速切節點 / 關再開）→ 全 `紀錄已更新 · READY` + 10 行
- `/tmp/eq_real.py`：用真機 URL 走完整流程

---

## 4. AI 分析搬遷 + 移除 Legacy

### 4.1 移除 Legacy
`product-detail.js` telemetry panel 原本的：
```
<div class="pd-telemetry-body">${cleanSection(telemetry,'效能遙測')}</div>   ← 移除
```
`telemetry-provision.js` 的 `legacy()` 方法（把上面包進 `進階資料 · Legacy Telemetry`）→ **整個刪除**。

### 4.2 AI 分析畫進 native dashboard
`app/static/js/telemetry-native.js`：
- constructor 加 `<section class="tn-ai">`（遙測 AI 分析 + 狀態 + 內文）
- 新增 `analyze()`：fetch `/api/machine/{name}/telemetry/analyze?minutes=…&node_id=…`，讀回 `{ok,analysis,summary}`
- `periodMinutes()`：把 `1h/6h/…` 映射成 minutes（60/360/…）
- 去重：`analysisKey`（進行中）+ `analysisDone`（完成）避免 30s 重繪重觸發
- Dashboard constructor 多接一個 `name` 參數（`telemetry-provision.js` 的 `dashboard()` 傳 `this.name`）

### 4.3 時間範圍跟舊版一致
`integration/telemetry_charts.py`：
```python
RANGES={'10m':600,'30m':1800,'1h':3600,'6h':21600,'12h':43200,'24h':86400,'2d':172800,'7d':604800,'30d':2592000}
```
（原本只有 `1h/6h/24h/7d`）。前端 `telemetry-native.js` 的 `<select>` 也改成同 9 項。

### 4.4 AI 分析後端
`app/main.py:4028` `machine_telemetry_analyze(name, minutes, node_id)`：回 `{ok, summary, analysis, minutes}`；失敗回 `{ok:false,error}`（HTTP 仍 200）。

---

## 5. 三個新圖表面板

`integration/telemetry_charts.py` 的 `queries()`，現 **11 個面板**（依 subsystem 分組）：

| 組 | 面板（id） | PromQL 來源 |
|----|-----------|-------------|
| CPU | CPU Utilization (`cpu`) | `rate(node_cpu_seconds_total{mode="idle"})` |
| CPU | **CPU Temperature (`cputemp`)** | `max(node_hwmon_temp_celsius{chip!~"nvme.*"})` |
| MEM | Memory Utilization (`memory`) | `MemAvailable/MemTotal` |
| MEM | **Host Memory (DIMM) ECC (`ecc`)** | `sum by(controller)(node_edac_correctable/uncorrectable_errors_total)` |
| GPU | GPU Utilization (`gpu`) | `DCGM_FI_DEV_GPU_UTIL` |
| GPU | GPU Temperature (`temperature`) | `DCGM_FI_DEV_GPU_TEMP` |
| GPU | GPU Power (`power`) | `DCGM_FI_DEV_POWER_USAGE` |
| GPU | **GPU NVLink Bandwidth (`nvlink`)** | `DCGM_FI_DEV_NVLINK_BANDWIDTH_TOTAL` |
| GPU | GPU HBM/VRAM (`hbm`) | `FB_USED/(FB_USED+FB_FREE)` |
| I/O | Network RX/TX (`network`) | `rate(node_network_*_bytes_total)` |
| I/O | Disk Read/Write (`disk`) | `rate(node_disk_*_bytes_total)` |

- GPU 系列 label 用 `gpu()` lambda（`max by (UUID,gpu,GPU_I_ID)`）
- **非 GPU 系列 label** 現在 fallback：`device → chip → controller`（讓 ECC 的 controller 0/1 可區分）
- 測試：`tests/test_telemetry_native_gpu.py` 面板數斷言 `8 → 11`，並檢查 11 個 id 集合

---

## 6. 系統診斷收合

`app/static/js/product-detail.js`：
- 診斷 section（原 `title('診斷資訊','系統診斷',…)`）改成帶 `pd-diagnostic-collapse` 按鈕 + `pd-diagnostic-body`（可 hidden）
- `document` 級 event delegation 監聽 `.pd-diagnostic-collapse` click（因為 section 每次 refresh 重繪）
- `diagnosticCollapsed = new Map()`（per machine name）保存收合狀態；overview 模板讀它決定 `aria-expanded`/`hidden`
- CSS：`product-detail.css` 加 `.pd-diagnostic .pd-diagnostic-collapse/-caret/-heading-actions` + `[hidden]` + heading flex
- 驗證：`/tmp/eq_diag2.py`（收合→重繪→維持收合→展開 全過）

---

## 7. 巡檢涵蓋範圍解讀（EQ3300，`L11 Test` 專案）

### 7.1 資料過舊（STALE）判定
`integration/inspection_service.py:166`：
```python
if entry['age_seconds'] > entry.get('freshness_seconds', config['stale_seconds']):
    entry['state'] = 'STALE'
```
- `age_seconds` = 該來源最近採集距現在多久
- **各來源 `freshness_seconds`（有效期限）不同**：
  | 來源 | 有效期限 |
  |------|:---:|
  | Identity / Kernel / Power / SEL / Redfish / BMC Identity / BMC Hostname | **300s（5 分）** |
  | Sensor | **660s（11 分）** |
  | Tool versions / PCIe | **1260s（21 分）** |
  | Firmware ×4 | **3660s（61 分）** |
  | （全域預設 `stale_seconds`）| **300s** |
- EQ3300 現在**全 STALE** 是因為巡檢排程 `enabled: False`（停用），上次跑完已 ~2 小時。排程 `interval_seconds=120`（啟用時每 2 分鐘跑，5 分期限的來源不會過期）。

### 7.2 「沒辦法診斷」的兩項（EQ3300）
| 項目 | 狀態 | 原因 | 能不能修 |
|------|------|------|---------|
| **Hardware 硬體檢查** | NOT_READY | `L11 Test` 專案**沒有 `l11_test_config.sh`**（見 §8 Q1）| 要寫該專案的 checker 腳本 |
| **BMC Hostname** | NOT_SUPPORTED | 走 Redfish `/redfish/v1/Managers/<x>/HostName`，該 BMC 沒回報此欄位（見 §8 Q2）| 改走 SSH 取 hostname |
| Sensor / Redfish | PARTIAL | 部分欄位讀不到，保留原始狀態 | 部分可 |
| 其餘 10 項 | STALE | 排程停用，只是過期 | 啟用排程或「立即巡檢」 |

---

## 8. PENDING（用戶問到、尚未實作）

### Q1 — Hardware 硬體檢查是哪包腳本？（尚未建）
- 路徑：`engine/vera_cycle/<project_slug>_config.sh`
- `L11 Test` → slug = `l11_test` → 需要 **`engine/vera_cycle/l11_test_config.sh`**（目前**不存在**）
- 現成範本：`engine/vera_cycle/neutrino_config.sh`、`naboo_config.sh`
- 邏輯：`integration/profiles.py:88` `checker_script_path()`，**無 fallback**（`CheckerMissing`）；腳本需含 `profile parameter contract` marker（`resolve()` 檢查 `count(marker)==1`）
- **若要做**：從 `neutrino_config.sh` 複製成 `l11_test_config.sh`，改成 L11 的硬體期望值。屬專案層級工程，需先跟用戶討論 L11 要查什麼。

### Q2 — BMC Hostname 改走 SSH（尚未改）
- 程式碼**已支援**（`engine/vera_cycle/validation_identity.py:49`）：
  ```python
  if binding['capabilities']['bmc_hostname_query'] == 'ssh_hostname':
      → transport.ssh(target,'bmc','hostname')
  else:
      → Redfish …/HostName   # EQ3300 走這，BMC 沒這欄位 → NOT_SUPPORTED
  ```
- **但目前沒有任何地方寫入 `bmc_hostname_query`**（只被讀取）。
- **若要做**：對 EQ3300 OS 1 節點 binding 寫 `capabilities = {"bmc_hostname_query":"ssh_hostname"}`（`capabilities` 是 `NODE_BINDING` 可寫欄位，`integration/inventory.py` 的 `validate_binding` 接受 dict）。前提：BMC SSH 帳密正確、BMC 有 `hostname` 指令。
- 需決定寫入方式：機台設定 UI？還是直接 API/DB？（尚無前端入口）

---

## 9. 測試與回歸

- 目標子集全綠：
  - `test_telemetry_native_gpu.py` / `test_telemetry_provision.py` / `test_telemetry_gpu_diag.py` / `test_telemetry_scope.py` → **58 passed**
- 全量：`pytest tests/ -q --ignore=tests/console` → **124 failed / 199 passed**（0 回歸 vs baseline；失敗集與起始基線相同）
- **前端 Playwright 驗證腳本**（在 `/tmp/`，可重跑）：
  - `/tmp/eq_stress.py`（console 3 場景）
  - `/tmp/eq_real.py`（真機 URL 完整流程）
  - `/tmp/eq_newlayout.py`（AI 分析 + 時間範圍 + Legacy 已移除）
  - `/tmp/eq_3panels.py`（3 新面板 + 順序）
  - `/tmp/eq_diag2.py`（系統診斷收合）
  - `/tmp/q_charts.py` / `/tmp/eq_cov.py`（查 Prometheus / 巡檢 coverage）

---

## 10. git 狀態

```
10fed65  feat: 系統診斷可收合
4a707db  feat: AI 分析搬到 native dashboard + 移除 legacy
c1465a7  chore: 面板分組 + ECC 標題
7a5efdf  feat: 加 CPU溫度/NVLink/ECC 面板
77927c1  fix:  console 切節點不清空
1096c4e  docs: 手冊補 Toolkit 步驟
d2c8778  fix:  安裝腳本換行 bug + console 診斷
04a1d84  fix:  舊 AI 分析升級排版
c47f4c9  feat: Node Exporter / DCGM 分開安裝
```
- 全部已 push 到 `origin/astra-console-import`（remote = local = `10fed65`）
- ⚠️ **`pa-cycle-lab` 沒有 `main` 分支**，預設分支是 `codex/neutrino-v1`。用戶選擇 push 到 `astra-console-import`（選項 1），**沒有**碰 main/neutrino-v1。若要進預設分支需另開 PR。
- ⚠️ `vera-cpu-rack-cycle` 是**另一個 repo**（有 main），與 `pa-cycle-lab` **歷史不同源**，別混淆。
