# Telemetry 空白問題 — 交接文

日期：2026-10-01
Repo：/root/sheng/PA-manager-6969
分支：codex/remove-locks
服務：pa-manager-6969-web.service（port 6969）

## 一、目標

讓 L11 單機詳情頁 → `EQ3300-AIAgent` 的 Telemetry（`os_metrics` 表）有資料可顯示。

## 二、已查明的事實

### 1. 機台與節點

- 機台 `EQ3300-AIAgent`，project=`L11 Test`，`active_os=1`
- slot 1 → node_id `fb34a37e55125dadbd7b044ab0aed310`（10.35.228.144，SSH 可收集）
- slot 2 → node_id `ec506335b2065cf387e90ad900dc69b5`（10.35.229.70，SSH 收集失敗）

### 2. 兩份 DB（關鍵坑）

| DB 路徑 | os_metrics | 說明 |
|---------|-----------|------|
| `app/telemetry.db` | 9 筆 | 早期腳本 import 順序錯誤寫入的 DB（非 web 讀取的） |
| `data/pa6969/telemetry.db` | 1 筆（node_id=fb34a37e...）| **web service 實際讀取的 DB** |

web service 環境變數 `CYCLE_INSTANCE=data/pa6969` → `PA_DATA_DIR=data/pa6969` → `telemetry_core.DB_FILE=data/pa6969/telemetry.db`。

### 3. `telemetry_core.py` 的 import 順序陷阱

`telemetry_core.py` 在 **import 時**就把 `DB_FILE` 快照（`_data_dir()` 讀 `PA_DATA_DIR`）。
`PA_DATA_DIR` 是由 `integration/settings.py` 在 import 時 `os.environ.setdefault(...)` 設定的。

**結論**：任何腳本/服務，若要讓 `telemetry_core.DB_FILE` 指向 `data/pa6969/telemetry.db`，**必須先 `import integration.settings`（或等價地設定 `PA_DATA_DIR` 環境變數）再 `import telemetry_core`**。web service 因先載入 `integration.web` 所以自然正確；手動腳本若順序錯了會寫進 `app/telemetry.db`（已遇到）。

### 4. 已修的三個 bug

| # | 檔案 | 內容 |
|---|------|------|
| a | `integration/targets.py` | `SAFE_FIELDS` 加 `os_password`；`expand()` 明確把 slot 的 `pass` 對應到 `os_password` |
| b | `integration/observation_service.py` | 建 `Target(...)` 改用關鍵字參數（原位置參數把 `os_ip` 放到 `bmc_ip`、`bmc_ip` 放到 `os_ip`，導致 `gaierror`） |
| c | `app/main.py` `machine_telemetry` | `read_keys` 加 canonical 展開：用 `node_identity.canonical(target)` 取得所有 slot 實際 `node_id` 一併讀取，避免 data.json slot `node_id` 為 `null` 時漏讀 |

### 5. 驗證結果

- `data/pa6969/telemetry.db` 有 1 筆 os_metrics（node_id=fb34a37e...）
- API `GET /api/machine/EQ3300-AIAgent/telemetry?minutes=120`（不帶 node_id）→ HTTP 200，os rows=1、disk mounts=6 ✅
- API 帶 `node_id=fb34a37e...` → HTTP 404（待查：URL 編碼 / 機台名格式問題）

### 6. 尚未確認 / 待修

1. **前端 `loadTelemetry` 實際請求的 URL 與 `node_id` 格式**：`operationTarget(name).node_id` 到底回傳什麼？目前未確認（上次準備看 `app/static/js/operations-ux.js:10` 時被打斷）。
2. **observe 收集器尚未部署為 systemd 服務**：現在只有手動跑過一次，所以 DB 只有一筆。要持續有資料，需要獨立 systemd unit（`CYCLE_MODE=live`、`CYCLE_INSTANCE=data/pa6969`、`CYCLE_PROVIDER=integration.local_provider`、`ExecStart=run.py observe`）。**不能放進 web service 裡跑**（設計上是獨立授權服務）。
3. **前端 `loadTelemetry` catch 靜默 return**：`app/static/js/app.js` 的 `loadTelemetry` 裡 `catch (e) { return; }` 會吞掉錯誤，頁面空白無提示。需加明確錯誤訊息（含重試按鈕）。
4. **前端版本號（cache-bust）**：`app/static/index.html` 的 JS/CSS 載入行需帶 `?v=...`，改完前端記得 bump。
5. **slot 2 收集失敗**：10.35.229.70 SSH 回「No valid OS sample collected」，可能是該主機憑證/帳密問題，非程式 bug。

### 7. 上游 repo 對照（wistroneq3300/pa-server-manager-next）

- 上游**沒有** observe / `run.py` / `observation_service.py`；只有 `pa-manager.service`（web）+ `telemetry_core.py` + `scripts/seed_simulated_telemetry.py`。
- 上游 telemetry 資料是**模擬資料**灌進 `rack_metrics` 表（Rack Telemetry 頁：switch/powershelf/cdu/server）。
- 本機 repo（pa-cycle-lab）多出了「真實 SSH 收集」的 observe 機制（`run.py observe`）。
- 若 synthetic 環境不該依賴真實 SSH，可考慮照上游做法，對 `os_metrics` 也灌模擬資料，讓頁面有東西顯示。

## 三、改動檔案清單（本次 telemetry 相關，未 commit）

```
integration/targets.py          # SAFE_FIELDS 加 os_password；expand() 明確映射 pass→os_password
integration/observation_service.py  # Target 建建立改關鍵字參數
app/main.py                     # machine_telemetry read_keys 加 canonical node_id 展開
app/telemetry_core.py           # os_series_any 通用化（>2 個 key）
scripts/observe_once.py         # 新增：一次性 observe 驗證腳本（注意 import 順序）
```

## 四、重啟 / 驗證指令

```bash
# 重啟 web（別 kill PID；別動 pa-manager7000.service / runner / bridge）
systemctl restart pa-manager-6969-web.service

# 手動跑一次 observe（注意：先 import integration.settings 再 import telemetry_core）
cd /root/sheng/PA-manager-6969 && \
  env CYCLE_MODE=live CYCLE_INSTANCE=data/pa6969 CYCLE_PROVIDER=integration.local_provider \
  .venv/bin/python scripts/observe_once.py

# 查 DB
sqlite3 data/pa6969/telemetry.db "select count(*) from os_metrics;"

# 查 API
curl -s "http://localhost:6969/api/machine/EQ3300-AIAgent/telemetry?minutes=120&kind=all" \
  | python3 -c "import json,sys;d=json.load(sys.stdin);print('os',len(d['os']['os']),'net',len(d['os']['net']),'disk',len(d['os']['disk']))"
```

## 五、下一步（按優先序）

1. 看 `app/static/js/operations-ux.js` 的 `operationTarget`，確認前端 telemetry 請求用的 `node_id` 格式；對齊後端 404 問題。
2. 部署 observe systemd unit（獨立授權服務）。
3. 前端 `loadTelemetry` catch 加錯誤提示。
4. bump `index.html` 版本號。
5. 確認 slot 2 憑證問題（可選）。
