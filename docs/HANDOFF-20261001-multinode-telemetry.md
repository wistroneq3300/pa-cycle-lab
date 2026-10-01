# 交接文件：6969 多節點 Telemetry / 連線狀態 / 閃爍問題

日期：2026-10-01
Repo：`/root/sheng/PA-manager-6969`
分支：`codex/remove-locks`（**尚未 commit**，一堆 modified 檔）
服務：`pa-manager-6969-web.service`（uvicorn `integration.web:app`，port 6969，`PA_DATA_DIR=data/pa6969`，`CYCLE_MODE=synthetic`）

---

## 0. 一句話總結

EQ3300-AIAgent 專案已驗收 OK。**現在卡在 Neutrino 專案的多節點（n1/n2/n3）**：
切 node 後連線狀態/資料「撈不到」→ 前端 Overview 狂閃。
本輪已修：切 node 後「尚未觀測」（已驗證 OK）、閃爍前端修法（未驗證）、BMC pending 逾時（未驗證）。
**尚未解決的核心**：多節點切換後 **BMC 抓取很慢 / 抓不到**（`bmc_loading: True`、`fw:0`），以及切換請求的 race。

---

## 1. 環境事實

- 服務全 active：`pa-manager-6969-web`、`-runner`、`-bridge`、`pa-manager7000`。
- 重啟方式（**只重啟 web，別 kill PID，別動 runner/bridge/7000**）：
  ```
  systemctl restart pa-manager-6969-web.service
  ```
- 前端改動要 **Ctrl+Shift+R**（版號 cache-bust 在 `app/static/index.html`）。
- 後端（`app/main.py`、`integration/web.py`）改動要重啟 web。

---

## 2. Neutrino 專案事實

- 專案名稱：**Neutrino**（注意你打的是 netruino/neutrino，正式名是 `Neutrino`）。
- 機台名：**`neutrino-n1`**（機框名），內含 **3 個 node**：
  | slot | label | OS IP | BMC IP |
  |---|---|---|---|
  | 1 | OS 1 | 10.35.228.148 | 10.35.228.149 |
  | 2 | neutrino-n2 | 10.35.228.150 | 10.35.228.151 |
  | 3 | neutrino-n3 | 10.35.228.154 | 10.35.228.155 |
- 三者 **OS ping 都通、BMC ping 都通**（ICMP）。
- 但 **BMC FW/power 抓取（`ipmi_fw_list` / `ipmi_power`）對 slot1/slot2 很慢或失敗**（回 `bmc_loading: True`、`fw:0`）；slot3 曾成功（`fw:12`、`power: Chassis Power is on`）。

---

## 3. 本輪已做的改動（**全部未 commit**）

### 3.1 連線狀態「尚未觀測」→ 已修 ✅（已驗證）

**症狀**：切到 n2/n3 後「連線狀態」OS/BMC 顯示「尚未觀測」，但右上角 ping 顯示可達。

**根因**：
1. `integration/web.py` 在 synthetic 模式把 `ping_check` / `_kick_status_scan` 整個閹掉 → `_status_cache` 永遠空。
2. `app/main.py` `list_machines` 有 `if CYCLE_MODE != "synthetic"` gate，synthetic 不掃描。
3. 切 node 時 `machine_select_os` 呼叫 `_invalidate_machine_cache(name)` 清掉狀態快取，但**沒有補 ping**。

**修法**：
- `integration/web.py`：`if MODE=='synthetic':` 區塊改成只剩 `pass`（不再覆寫 ping/scan），並加註解。
- `app/main.py` `list_machines`：移除 synthetic gate，一律 `_kick_status_scan(force=force_scan)`。
- `app/main.py` 新增 `_ping_selected_node(name)`：對目前選定 node 的 `os_ip`/`bmc_ip` 同步 ping 一次並寫回 `_status_cache`/`_status_observed`；在 `machine_select_os` 清快取後呼叫。

**驗證**：切 slot 1/2/3 後 `detail` 都回 `os_alive: True`、`bmc_alive: True`、有 `observed_at`。

⚠️ **副作用**：這讓 synthetic 也會對**所有機台發 ICMP ping**（唯讀）。與 repo 原「SYNTHETIC 不做網路」原則相反，是使用者要求「真實資料」。

### 3.2 多節點 Overview 狂閃 → 已改前端（**未完整驗證**）

**症狀**：多節點機台（EQ3300/neutrino）在 Overview 分頁每 ~3 秒閃一下。

**根因**：`app/main.py` `machineLoadDetail`…（更正：前端 `app/static/js/app.js` 的 `machineLoadDetail`）
後端只要 BMC 還在抓就回 `bmc_loading: True`，前端**每 3 秒重抓 detail 並 `setView("machine")` 整頁重繪**。

**修法**（`app/static/js/app.js` `machineLoadDetail`）：
- 新增 `silent` 參數：靜默輪詢時**不重繪**，只有 BMC 資料（`fw`/`power`/`bmc_loading`）真的變了才 `setView("machine")` 一次。
- 新增 `bmcPollTries`：輪詢次數上限 12 次，避免無限重抓。

### 3.3 後端 BMC pending 逾時 → 已改（**未驗證**）

**修法**（`app/main.py`）：
- 新增 `_bmc_pending_since = {}`、`_BMC_PENDING_TTL = 90`。
- detail 端點：若 `name in _bmc_pending` 但已超過 90 秒 → 清 pending、回 `bmc_loading: False`（停止前端無限輪詢）。
- `_bmc_pending` 背景執行緒 `finally` 時一併 `_bmc_pending_since.pop(name)`。
- `_invalidate_machine_cache` 也清 `_bmc_pending` / `_bmc_pending_since`（切 node 時）。

### 3.4 感測器一直「掃描中」+ 閃爍 → 已改（未驗證）

`app/static/js/product-detail.js` `pdLoadSensorsLive`：
- 「抓取中」文字只寫一次（`dataset.pdWait` 守衛），不再每 2 秒整塊 `innerHTML` 重繪。
- 加重試上限（8 次 / 30 秒），逾時顯示明確結束訊息。
- 抓錯時顯示明確錯誤（不再無聲 return）。

### 3.5 系統診斷殘留上一節點結果 → 已改（未驗證）

`app/static/js/app.js`：
- `diagStore` key 從「機台名」改成「**機台名 + active slot**」（新增 `diagKey()`）。切 node 後自然隔離。

### 3.6 文案改動（前幾輪，已完成）

- `app/static/js/product.js`：副標「工程工作空間」→「系統工作區」；大標「專案工作空間」→「系統工作區」；「同一套工程視野」→「同一套視野」。
- `app/static/js/workspace-ux.js`、`equipment-workspace.js`：首頁「工程工作區」→「系統工作區」（unicode escape `\u5de5\u7a0b...` → `\u7cfb\u7d71...`）。
- **英文 `ENGINEERING WORKSPACE` 依使用者要求維持不動。**

### 3.7 更早（telemetry 基礎建設，先前 session）

- `app/main.py`、`integration/web.py`：在 `web_lifespan` 啟動 in-process telemetry worker（`telemetry_core.start_worker()`）。
- `app/telemetry_core.py`：`os_series_any` merge 修 GPU series。
- `app/main.py` `machine_telemetry`：canonical node_id 匹配（修 404）。
- `app/static/js/app.js` loadTelemetry 加錯誤/空資料提示。
- 詳見 `docs/TELEMETRY-HANDOFF.md`。

---

## 4. 版號（`app/static/index.html`，本輪）

| 檔案 | 版號 |
|---|---|
| `app.js` | `v=20261001-anticlick1` |
| `product-detail.js` | `v=20261001-multi-node-fix1` |
| `engineering-ux.js` | `v=20261001-noreadout1` |
| `engineering-ux.css` | `v=20261001-noreadout1` |
| `workspace-ux.js` | `v=20261001-sysworkspace1` |
| `workspace-ux.css` | `v=20261001-teltime1` |
| `equipment-workspace.js` | `v=20261001-sysworkspace1` |
| `product.js` | `v=20261001-sysworkspace1` |

---

## 5. 尚未解決 / 待續（**下一輪重點**）

### 5.1 多節點 BMC 撈不到（核心問題）
- slot1/slot2 切過去後 `bmc_loading` 一直 True、`fw:0`、`power` 空。
- 需查：`ipmi_fw_list` / `ipmi_power` 對這些 BMC（10.35.228.149 / .151）為何慢/失敗。
  - 可能：BMC 帳密錯、IPMI 走 lanplus 不通、`bmc_user`/`bmc_pass` 沒帶到。
  - 檢查點：`app/main.py` `ipmi_fw_list`/`ipmi_power` 實作；`_bmc_fw_cache`/`_bmc_pwr_cache` 是否寫入成功。
  - 快速驗證：日誌 `journalctl -u pa-manager-6969-web.service --since "5 min ago" | grep -i ipmi`。
- 使用者原話：「應該是撈不到資料 所以網頁狂閃爍 應該一直在撈」。

### 5.2 切 node 的 race（觀察到）
- 連續 `POST select-os` 1/2/3，回傳 `active_os` 是 2/3/3（交錯）。
- `_ping_selected_node` 是**同步 ping**，讓 `machine_select_os` API 變慢 → 可能造成連續切換交錯。
- 待確認是否需改成「背景 ping」。

### 5.3 驗證 3.2/3.3/3.4/3.5 的修法是否真的止閃
- 需在瀏覽器實測 neutrino 切 n1↔n2↔n3：
  1. Overview 是否還閃
  2. Sensors 是否還一直掃描
  3. 診斷是否還殘留

### 5.4 EQ3300 已知的 slot2 問題（非本輪）
- slot2（`ec506335b2065cf387e90ad900dc69b5`, 10.35.229.70）SSH 收集失敗「No valid OS sample collected」，可能憑證/帳密問題。

---

## 6. 關鍵程式位置速查

| 功能 | 檔案 / 函式 |
|---|---|
| 機台 detail（含 BMC loading） | `app/main.py` `machine_detail`（約 2600-2665） |
| 切換 node | `app/main.py` `machine_select_os`（約 1242） |
| 狀態快取掃描 | `app/main.py` `_refresh_status` / `_kick_status_scan` / `_ping_selected_node` |
| 清快取 | `app/main.py` `_invalidate_machine_cache`（約 1825） |
| 前端 detail 輪詢 | `app/static/js/app.js` `machineLoadDetail`（約 2800） |
| 前端單機頁渲染 | `app/static/js/product-detail.js` |
| 感測器即時載入 | `app/static/js/product-detail.js` `pdLoadSensorsLive`（約 534） |
| 診斷 | `app/static/js/app.js` `diagBodyFill`/`runDiagnose`（約 3141+） |
| telemetry worker | `app/telemetry_core.py` + `integration/web.py` `web_lifespan` |
| synthetic 開關 | `integration/web.py` 約 line 33 |

---

## 7. 常用驗證指令

```bash
# 切 node（1/2/3）
curl -s -X POST "http://localhost:6969/api/machines/neutrino-n1/select-os" \
  -H "Content-Type: application/json" -d '{"slot":2}'

# 看 detail（alive / bmc_loading / fw / power）
curl -s "http://localhost:6969/api/machine/neutrino-n1/detail" | python3 -m json.tool | head -40

# 看 web 日誌
journalctl -u pa-manager-6969-web.service --since "3 min ago" --no-pager | tail -50

# 重啟
systemctl restart pa-manager-6969-web.service
```

---

## 8. 待使用者決策

1. **多節點 BMC 撈不到**要修到什麼程度？（真的接上 IPMI 抓，或失敗就明確顯示「BMC 讀取失敗」不重試？）
2. 3.1 的「synthetic 也 ping 所有機台」是否接受？（目前是，唯讀）
3. 是否要把本輪改動 commit？

---

## 10. 【本輪後續】5.1 根因已找到並修正 ✅（2026-10-01 稍晚）

### 結論
「多節點切換後 BMC 撈不到 / 一直閃」**不是網路或帳密問題**，是「慢指令走錯路徑 + 逾時太短 + 切節點丟棄結果」。

### 實測數據（neutrino-n1 slot2，240 筆感測器）
| 路徑 | 耗時 | 結果 |
|---|---|---|
| OS 本機 `ssh ... ipmitool -I open sdr list` | **128 秒** | 240 筆 |
| BMC OOB `ipmitool -I lanplus -C 17 sdr list` | **11.5 秒** | 240 筆 |
| `ipmitool lanplus chassis power status` | 0.3 秒 | 全部成功 |

原程式碼 `ipmi_sensor_summary` 先走 OS 本機 `-I open`（timeout=45 → 128s 必逾時），
fallback OOB 又只給 `_ipmi_run_any(timeout=6)`（實際要 11.5s → 又逾時）。
→ 感測器永遠抓不到 → 前端每 3 秒重試無限輪迴 → **狂閃**。

### 修改（本輪）
1. `app/main.py` 新增 `_ipmi_oob(m, sub_args, timeout=40)`：慢指令**直接走 BMC OOB lanplus**。
2. `ipmi_sensor_summary`：改用 `_ipmi_oob(timeout=40)`，OOB 失敗才退回 OS 本機。
3. `_fetch_sensors_async`：`if machines.get(name) != m: return` → 改成只比對 `os_ip`
   （切 node 會改 machine dict，用全 dict 比較會把抓完的結果整批丟棄 → 快取永遠空）。
4. detail `_bg`（BMC fw/power）比照辦理，只比 `os_ip`。
5. `app/static/js/product-detail.js` `pdLoadSensorsLive`：`MAX_WAIT 30s/8 tries` → `60s/25 tries`
   （實際抓取約 20s，避免誤判逾時）。
6. 版號 `product-detail.js` → `v=20261001-sensor-oob1`。

### 驗證結果（已驗證 ✅）
- slot 1/2/3 切換後，感測器約 15~20 秒載入完成：`loading=False, total=240, ok=240`。
- detail：`fw_count=12`、`power="Chassis Power is on"`、`bmc_loading` 不再卡 True。
- 三節點皆通過。

### 仍待觀察
- 首次載入仍需約 15~20 秒（BMC sdr list 本質較慢），屬正常；期間前端顯示「抓取中」不應再誤報逾時。

---

## 9. 注意事項（repo 規則）

- **不要**改/重啟 `pa-server-manager-next`（上游）；只有使用者明確說「7000 可以改」才動。
- `AGENTS.md` 有詳細規則：只重啟 `pa-manager-6969-web.service`，不動 runner/bridge/7000。
- 密碼/憑證不進 Git、不進 argv、不進公開 API。
- 一輪一個工具呼叫，避免回覆被截斷（見 AGENTS.md「reply stops mid-way」）。
