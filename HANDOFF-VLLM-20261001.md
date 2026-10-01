# PA Manager 6969 — VLLM 整合 Bug 修復 交接文

**日期**: 2026-10-01
**Repo**: `/root/sheng/PA-manager-6969`
**服務**: `pa-manager-6969-web.service`（port 6969）
**模式**: synthetic（無真實硬體）
**AI model**: deepseek-v41-flash

---

## 一、已修好的問題（已生效、**未 commit**）

### T1 — 感測器框「越改越短／直接不見」 ✅ 已修

**根因（多層）**：
1. `pdLoadSensorsLive()` 更新 `#pd-sensor-live` 時**覆蓋**了 `.pd-original-section` 包裝 div → 框高度結構被破壞
2. BMC `ipmitool sdr list` **偶發逾時**（原門檻 25s，實際 13–20s，BMC 忙時超 25s）→ 後端回 `error` → 前端整片空白
3. 前端**瀏覽器快取**：`index.html` 的 JS/CSS **沒有版本號**，改動永遠載不到

**修復**：

| 檔案 | 行號/位置 | 改動 |
|------|-----------|------|
| `app/main.py` | `ipmi_sensor_summary()`（~491） | `ssh_ipmi` 逾時 **25s → 45s** |
| `app/main.py` | `_fetch_sensors_async`（~2652） | 抓取失敗時**保留上次成功快取**，不再覆蓋為 error |
| `app/static/js/app.js` | `machineSensorsHtml()`（2640） | 遇 `s.error` 時**顯示明確錯誤訊息**（含重試按鈕），不再空白 |
| `app/static/js/app.js` | `sensorAnalyze()`（2711） | 重試訊息加上原因說明（逾時/連線失敗） |
| `app/static/js/product-detail.js` | `pdLoadSensorsLive()`（536） | 更新時**包 `.pd-original-section`** div；`d.error` 排除完成判定（持續重試） |
| `app/static/css/workspace-cinematic.css` | `.sdr-scroll`（114） | `max-height: **500px** !important`（使用者指定高度） |
| `app/static/css/style.css` | `.sdr-scroll`（967） | 還原回 260px（workspace 用 cinematic 覆蓋） |
| `app/static/index.html` | JS/CSS 載入行 | **加版本號** `?v=20261001-sensor-fix`（`app.js`、`product-detail.js`、`product-detail.css`、`workspace-cinematic.css`） |

**驗證結果**：
- 後端 `/sensors` 回：`loading=False, cached=True, error=None, total=228` ✅
- 手動 `ipmitool sdr list`：13.8s / 19.8s，回 228 筆 ✅
- 前端框正常顯示、500px 高度 ✅（使用者已確認「正常了」）

---

### T2 — BMC「尚未觀測」誤導文字

**狀態**：T1 修復後已**間接解決**。
- 原問題：`bmc_alive` 為 `None`（未知）時，前端顯示「BMC 尚未觀測」誤導文字
- 現已修好：`web_lifespan`（`integration/web.py:84`）啟動時觸發 `_refresh_bmc_all(machines)`，`bmc_alive` 不再停在 `None`
- 同時 `main.py:2069`：`bmc_alive is None` 時不再顯示「尚未觀測」，改顯示「BMC 狀態掃描中…」（僅 `None` 時）
- `main.py:3812`：`rack_telemetry` 對 `bmc_alive is None` 的成員標為 `state='UNKNOWN'`，不再顯示「尚未觀測」

**待驗證**：使用者未明確確認 T2 已解決（被 T1 修好後一併確認「正常了」）

---

### T3 — Sensors 卡在「抓取中」

**狀態**：T1 修復後**已解決**（根因同 T1：`sdr list` 逾時 → 後端 error → 前端停擺）
- 45s 逾時 + 保留舊快取 + 前端錯誤重試 → 不再永久卡「抓取中」

---

## 二、尚未處理 / 已知問題

### Telemetry 頁面空白 ⚠️ 未修

**根因（兩層）**：

1. **`telemetry.db` 全空**（`os_metrics` / `gpu_metrics` / `net_metrics` / `disk_metrics` 均 0 筆）
   - 因為 **`observe` 收集器服務從未部署/啟動**
   - 系統只有 3 個 systemd 服務：`web` / `runner` / `bridge`，**無 `observe`**
   - `run.py observe` 路徑存在（`integration/observation_service.py`）但沒跑

2. **後端 409 擋住查詢**（即使 DB 有資料也會觸發）
   - `machine_telemetry()`（`main.py:3760`）：
     ```python
     entries = [e for e in target['os'] if (e.get('node_id')==node_id if node_id else e.get('slot')==target.get('active_os'))]
     if len(entries) != 1 or not entries[0].get('node_id'):
         raise HTTPException(409, 'Select an existing canonical node for telemetry')
     ```
   - `EQ3300-AIAgent` 的 `os[0]`（slot=1）`node_id=None` → 觸發 409
   - 前端 `loadTelemetry()`（`app.js:2471`）`catch(e){ return; }` → **409 被吞，頁面空白無提示**

**若要修 Telemetry**，需要做：
- **(A)** 部署並啟動 `observe` 服務：`python run.py observe`（需 systemd unit，類似 `pa-manager-6969-web.service`）
- **(B)** 後端 `machine_telemetry` 加 **legacy fallback**：`node_id` 為 `None` 時不 409，改回 `key = machine name`（已有 `legacy-machine-unattributed` 概念，只是被 409 擋住）
- **(C)** 前端 `loadTelemetry` catch 加錯誤提示（不再靜默 return）

**注意**：`observe` 是獨立授權服務（`run.py` 註解：「Independent authorized service; never per Web worker」），不該在 web service 裡啟動。

---

## 三、改動檔案完整清單（`git diff --stat HEAD`）

```
AGENTS.md                              | 37 +++++++++++
LOCK-HANDOFF.md                        | 17 ++++-
app/main.py                            | 39 +++++++++---
app/static/css/style.css               | 28 ++++++++
app/static/css/workspace-cinematic.css |  2 +-
app/static/index.html                  | 28 ++++++--
app/static/js/app.js                   | 113 ++++++++++++++++++++++------
app/static/js/operations-ux.js         |  2 +-
app/static/js/product-detail.js        |  74 ++++++++++++++++-----
app/telemetry_core.py                  |   5 +-
engine/vera_cycle/cycle_transport.py   |   7 +-
integration/authorization.py           |   5 +-
integration/boundary.py                |   9 +--
integration/project_access.py          |   6 +-
integration/web.py                     | 10 +++
15 files changed, 306 insertions(+), 76 deletions(-)
```

> ⚠️ 部分檔案（`AGENTS.md`、`LOCK-HANDOFF.md`、`operations-ux.js`、`telemetry_core.py`、`cycle_transport.py`、`authorization.py`、`boundary.py`、`project_access.py`）可能是**之前別的 session 改的**，非本次 VLLM 修復。
>
> **本次 VLLM 修復直接改的檔案**：
> - `app/main.py`
> - `app/static/css/style.css`
> - `app/static/css/workspace-cinematic.css`
> - `app/static/index.html`
> - `app/static/js/app.js`
> - `app/static/js/product-detail.js`
> - `integration/web.py`（`web_lifespan` 加啟動掃描）

---

## 四、系統環境

| 項目 | 值 |
|------|-----|
| Repo 路徑 | `/root/sheng/PA-manager-6969` |
| Web service | `pa-manager-6969-web.service`（port **6969**） |
| Bridge service | `pa-manager-6969-bridge.service`（port 7002） |
| Runner service | `pa-manager-6969-runner.service`（port 7000，**別動**） |
| 7000 服務 | `pa-manager7000.service`（**別動**） |
| BMC IP | 10.35.228.145 |
| OS IP (slot 1) | 10.35.228.144 |
| OS IP (slot 2) | 10.35.229.70 |
| telemetry.db | `/root/sheng/PA-manager-6969/app/telemetry.db`（**空**） |
| AI model | deepseek-v41-flash |
| 測試機台 | EQ3300-AIAgent（2 OS slots，無 node_id） |

**重啟指令**：
```bash
systemctl restart pa-manager-6969-web.service
```
（**別** `kill PID`；**別**重啟 `pa-manager7000.service`）

---

## 五、重要提醒

1. **版本號（cache-bust）**：`index.html` 的 JS/CSS 載入行**必須帶版本號**，否則瀏覽器吃舊快取、改動看不到。改完前端記得 bump 版本。
2. **`observe` 服務未部署**：Telemetry 要工作，需要獨立 `observe` 服務跑起來。這是設計上獨立授權服務，不能在 web worker 裡啟動。
3. **未 commit**：所有改動都在 working tree，還沒 commit。使用者確認 OK 後再 commit。
4. **git 分支**：本 repo 無 branch/commit 記錄（觀察到的）。
