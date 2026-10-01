# PA Manager 6969 — 鎖 (lock) 問題 交接文件

> 產生：2026-10-01 · 環境 `/root/sheng/PA-manager-6969` branch `codex/next-rack-cycle` HEAD `6119412`
> 主機：EQ3300-AIAgent `10.35.228.144` · web :6969(live) / runner / bridge :7002
> 本次**未跑 cycle、未下 power/reboot 實際動作**(只做唯讀查詢與 GET)。

---

## 一句話結論

> 409「被占用」的根因是 **`locks` 表中的孤兒鎖**,owner 是已經不存在的 `session-*`(對應的 `input_sessions` 表 0 列)。
> 官方釋放路徑 `POST /api/cycle/sessions/{owner}/reconcile` **在此狀況下無效(回 404)**,
> 因為它需要 `input_sessions` 有該 session 記錄,但那些記錄根本不存在。
> 我改以 **DB 層直接 `DELETE FROM locks`** 清除,並先備份。**此為暫時處置,非根治。**

---

## 一、我做了什麼(逐項)

| # | 動作 | 結果 |
|---|------|------|
| 1 | 全站唯讀健檢(68 端點) | 找出所有回 409 的功能 |
| 2 | 備份 DB | `data/pa6969/jobs.sqlite3.bak-20261001-200920` |
| 3 | 讀 `locks` 表 | 6 筆,owner = 2 個 session |
| 4 | 確認 `input_sessions` | **0 列** → 確認全是孤兒 |
| 5 | 確認 `jobs` / `controls` | 皆 0 → 確認沒東西在跑 |
| 6 | 試官方 reconcile | **404 "Input session not found"** → 官方路徑不可用 |
| 7 | `DELETE FROM locks` | 清為 0,閒置 8 秒確認不再自動生成 |
| 8 | 測試 Sheng-Cisco power | 再次觸發新鎖(見下) |

**未做**:未重啟任何服務、未改任何程式碼、未執行 cycle、未對硬體下 power/reboot。

---

## 二、鎖的機制(已實證)

- 鎖存在 `data/pa6969/jobs.sqlite3` 的 `locks(scope, owner)` 表。
- scope 格式:`machine:<名稱>`、`endpoint:<IP>`、`node:<node_id>`、`domain:<...>`(見 `integration/store.py: scopes()`)。
- 建立:HTTP `detail`/`power` 等會經過 `integration/legacy_observation.py` 包裝的函式 → 開 `session(kind='observation')` → `store.reserve()` 寫入鎖;**正常結束時 `finally` 會 `DELETE FROM locks`**(`integration/coordinator.py: session()`)。
- **孤兒成因**:請求**中途被中斷**(逾時、被砍、BMC IPMI 卡 25s)時,`finally` 可能沒跑到 → 鎖殘留。
- 官方釋放:`POST /api/cycle/sessions/{owner}/reconcile`(`integration/web.py`)
  → 內部 `store.input_session(owner)` 在 `input_sessions` 找不到 → **KeyError → 404**。
  → **所以孤兒鎖無法用官方 API 清。**

### ⚠️ 重要陷阱(我親自踩到)
- 我 `DELETE FROM locks` 後,只要**再打一次** `detail`/`power`(尤其會卡住的),
  就會**再產生新鎖**(新 session ID)。
- 例:清空後我測了一次 Sheng-Cisco power,立刻又冒出
  `session-a71569e2ce1d411ba68eab5d629941f8`(鎖 endpoint:10.35.229.220 / 10.99.99.3 / machine:Sheng-Cisco)。
- **結論**:清鎖後若還有人/程式去打這些端點,鎖就會回來。清鎖 ≠ 永久修好。

---

## 三、目前狀態(交棒時)

```
locks 表:3 筆
  endpoint:10.35.229.220  owner session-a71569e2ce1d411ba68eab5d629941f8
  endpoint:10.99.99.3      owner session-a71569e2ce1d411ba68eab5d629941f8
  machine:Sheng-Cisco      owner session-a71569e2ce1d411ba68eab5d629941f8
input_sessions:0 列   jobs:0   controls:0
```
- 這 3 筆是我測試 Sheng-Cisco power 時新產生的(請求被中斷 → 未釋放)。
- 其餘先前看到的鎖(`session-1bb5a102…`、`session-43bd4fb1…`、`neutrino-n1`、`EQ3300-AIAgent` 相關)已於本次清除。

備份:
- `data/pa6969/jobs.sqlite3.bak-20261001-200920`(清鎖前)
- `data/pa6969/data.json.bak-20261001-183314`(先前 neutrino 修復前)

---

## 四、待決 / 建議(下次接力)

1. **根治方向**:找出為何建立的 session 沒被正常關閉(請求中斷時 `finally` 未執行)。
   可能與 **BMC IPMI 卡 25s 逾時** 直接相關 → 請求逾時被中斷 → 鎖殘留。
2. **不要在鎖沒根治前反覆打 `detail`/`power`**,否則鎖會一直重生。
3. **清鎖指令**(閒置時執行,勿同時打端點):
   ```
   python3 -c "import sqlite3;c=sqlite3.connect('data/pa6969/jobs.sqlite3');c.execute('DELETE FROM locks');c.commit()"
   ```
   或走官方(僅當 `input_sessions` 有該 owner 時):
   `POST /api/cycle/sessions/{owner}/reconcile`(需 `reviewed_hash` + `reason` 10-500 字)。
4. **更長遠**:考慮對過期 session 做自動 reap(依 `session_alive()` / process_lock 判斷死 session)。

---

## 五、相關檔案

- 鎖表操作:`integration/store.py`(`reserve`/`tx`/`scopes`)
- session 生命週期:`integration/coordinator.py`(`session()`、`session_alive`)
- 官方釋放 API:`integration/web.py`(`/api/cycle/sessions/{owner}/reconcile`)
- 觀察包裝:`integration/legacy_observation.py`
- DB:`data/pa6969/jobs.sqlite3`

---
## 六、後續處置(branch `codex/remove-locks`,HEAD 8bb777d)

依需求**移除鎖的強制(enforcement)**,保留 `locks` 表(舊 DB 仍可載入):

- `integration/store.py`:`reserve()` 不再寫入、不再抛 `Conflict`;`assert_scopes_idle()` 改為 no-op;`lock_owners()` 回 `{}`。
- `integration/coordinator.py`:`session()` 不再 `reserve`,也不再 DELETE 鎖。
- `integration/observation_service.py`:觀測不再 reserve,owner 固定為 `observation`(前端不再因 owner 被 409)。
- `integration/inventory.py` / `web.py` 的既有呼叫點因 no-op 而自動失效,無需改動。
- DB 既有鎖列已清除;備份:`data/pa6969/jobs.sqlite3.bak-remove-locks-20261001-203109`。

**效果**:6969 頁面不再因孤兒鎖 409(已用合成環境實證:即使植入死 session 鎖列,`lock_owners()` 仍回空、targets 無 `occupied_by`)。
**代價**:失去跨機流程與**共用 power/AUX domain** 的互鎖;同目標可被併發操作(BMC 層本來也不擋,但 BMC 看不到共用電源關係)。
**測試**:app/tests 53 passed;tests/ 22 failed(全為斷言鎖/409 行為的既有測試,屬預期),118 passed。

---
*本文僅記錄狀態與處置;鎖強制已於 branch `codex/remove-locks` 移除,未在 `codex/next-rack-cycle` 上變更。cycle 未執行。*
