# HANDOFF 2026-10-03a — Live Console 摘要檢視 + 事件留存排程

> 狀態：**已完成並 push**（UI commit `95ca9b5`）+ **排程已上線**（systemd timer 啟用中）
> 承接：`HANDOFF-20261002d-transport-race-and-report-upgrade.md`、`HANDOFF-20261002e-log-slimming-plan.md`
> 前提：生產環境 L11 rack，**128 hosts × 500 cycles**

---

## 0. 這次做了什麼（一頁摘要）

| # | 項目 | 結果 |
|---|---|---|
| 1 | Live Console 太吵（一坨） | 加 **Summary / Full 切換**（預設 Summary），**只改前端** |
| 2 | 節點卡片 `N1 · neutrino-n1 / neutrino-n1` 三重複 | 改成**只顯示 hostname** |
| 3 | 怕 events 表一直長大 | 建立 **systemd timer 每 2 週自動壓縮** |
| 4 | 128×500 資料量未知 | **估算 ≈ 224 萬筆 ≈ 0.75–1 GB** |

**已 push**：`95ca9b5`（branch `cycle/live-neutrino-redfish-hostname`）

---

## 1. Live Console：Summary / Full 切換

### 背景

使用者反映：**Live Console 是一坨**。要求「**跟 vera 一樣的簡化版**」，並確認要
**預設簡化 + 可切換回完整原始事件**。

### 根因（重要）

**系統有兩個不同的「console」**，之前一直搞混：

| | 讀什麼 | 內容 | 檔案 |
|---|---|---|---|
| **Live Console**（app 內，`#cycle-workspace`） | `/events` API → **原始事件流** | ❌ 一坨 | 無（即時） |
| **HTML 報告的 Console 面板** | `console.log` | ✅ 簡化版 | `console_log.py` 產 |

`console_log.py`（`integration/runner.py:27` import）**只餵給 HTML 報告**，
**不是** Live Console。所以使用者打開 app 的 Live Console，看到的**還是原始一坨**。

### 解法（**只改前端，不存檔**）

在 `app/static/js/cycle-console.js` 加 `fold(events)`：

- **丟掉** `COLLECTION_STARTED` / `COLLECTION_FINISHED`（「Collecting X / Collection returned: X」配對）
- **相位摺疊**：`PHASE_LABELS` 把事件翻成短句
  （`COMMAND_DISPATCHED`→`aux cycle sent`、`WAIT_OFFLINE`→`waiting OS boot`、
  `POST_COMPLETED`→`system check done` …），且**同一節點重複的相位只留一次**
- **`LOOP_STARTED` 去重**（3 台各發一次，只顯示一次）
- **一律保留**：`ISSUE_*`、`FAIL` / `WARN` / `ERROR`
- **controller 事件**（`PRE_STARTED` / `CONFIRMED` …）翻成完整句子

**關鍵**：`fold()` 產生的是**衍生資料**，**永不改動 buffer** →
切回 Full **完全無損**。**純顯示層，後端零改動。**

### UI

工具列新增按鈕（Auto-scroll 與 Pause 之間）：

```
[ALL] [neutrino-n1] … [Auto-scroll] [Summary] [Pause] [搜尋] [!] [☰] [↑] [●] [⇩]
```

`Summary` ↔ `Full` 切換，`aria-pressed` 同步。

### 實測（Node 單元測試 + 瀏覽器）

- 單元測試 `fold()`：**7/7 PASS**（合成流 20 → 8 行）
- 瀏覽器（合成 86 筆事件）：
  - **Summary**：`Showing 26 of 86`，短句、無 Collecting 噪音
  - **Full**：`Showing 86 of 86`，完整原始事件
- 淺色 / 深色主題都驗證過

---

## 2. 節點卡片只顯示 hostname

### 問題

`integration/targets.py:69` 組成 `display_name = name + ' / ' + label`；
`app/static/js/cycle-workspace.js:86` 再用 `${slot_key} · ${display_name}` 顯示
→ 變成 `N1 · neutrino-n1 / neutrino-n1`（**同一名字重複 3 次**）。

### 修法

`cycle-workspace.js` 卡片 `<strong>` 改為只顯示 hostname：

```
<strong>neutrino-n1</strong>
<span>10.35.228.148:22</span>
<small>可進入 PRE；硬體尚未驗證</small>
```

**順帶**：console 節點按鈕在 `tray` 為空時不再顯示前置 `/`（`/neutrino-n1` → `neutrino-n1`）。

---

## 3. Events 表會長大 → 每 2 週自動壓縮

### 背景

**真正會長大的是 DB 的 `events` 表**（`data/pa6969/jobs.sqlite3`），
不是 UI、不是 `console.log`。它**存每一個原始事件**（append-only journal）。

### 估算（128 × 500）

```
每節點每 loop ≈ 35 筆事件（Collecting 配對占 57%）
128 × 500 × 35 ≈ 224 萬筆
× ≈ 337 bytes/筆 ≈ 0.75 ~ 1 GB
```

### 既有工具

`scripts/compact_events.py`（`store.compact_events()`，`integration/store.py:284`）：
- **預設乾跑**，`--apply` 才真刪
- 只對 **已結束（TERMINAL）且早於 `--days`** 的 job 動手
- 每個 job **只留最後一筆**（`phase=COMPACTED`, `removed=N`）
- **不刪報告、不刪證據檔**

### 新增排程（**systemd timer**）

| 檔案 | 內容 |
|---|---|
| `/etc/systemd/system/pa-manager-6969-compact-events.service` | oneshot：`scripts/compact_events.py --days 30 --apply` |
| `/etc/systemd/system/pa-manager-6969-compact-events.timer` | `OnCalendar=*-*-1,15 04:30` ≈ 每 2 週 |

**關鍵環境變數**（**必須**，否則會指到錯的 DB）：
```
CYCLE_MODE=live
CYCLE_INSTANCE=data/pa6969      # ← settings.py 用它決定 DATA 目錄
CYCLE_PROVIDER=integration.local_provider
PYTHONUTF8=1
```

結果：`DATA=/root/sheng/PA-manager-6969/data/pa6969`
     `DB  =/root/sheng/PA-manager-6969/data/pa6969/jobs.sqlite3` ✅

### 驗證

| 測試 | 結果 |
|---|---|
| 乾跑 `--days 30` | ✅ exit 0 |
| DB 路徑 | ✅ `data/pa6969/jobs.sqlite3` |
| Timer 語法 | ✅ 下次 `2026-10-15 04:30` |
| **實跑 service** | ✅ `status=0/SUCCESS`、`Events removed: 0` |

### 維運指令

```bash
systemctl list-timers "pa-manager*"                          # 下次執行
systemctl start pa-manager-6969-compact-events.service       # 手動跑一次
journalctl -u pa-manager-6969-compact-events -n 20           # 紀錄
systemctl disable --now pa-manager-6969-compact-events.timer # 停用
```

備註：`systemctl edit --full` 可改 `--days`（service）或 `OnCalendar`（timer）。

---

## 4. 已知待辦 / 風險

1. **`VACUUM` 未做** ⚠️
   `compact_events` 只 `DELETE` 資料列，**SQLite 檔不會縮小**。要真正釋放空間得 `VACUUM`。
   → **建議在 service 加一步 `VACUUM`**（尚未做）。

2. **`scripts/runtime_manifest.py` 與 `integration/store.py` 規則不一致** ⚠️
   產生器**沒排除 `test-results/`**，檢查器**有**。
   → 若重跑 `runtime_manifest.py` 會混入 test-results 檔。**未修**。

3. **UI 尚未在實機 Ctrl+Shift+R 確認**
   已加 cache-buster（`cycle-console.js?v=20261003-summary1`、
   `cycle-workspace.js?v=20261003-hostname1`、`cycle.css?v=...`）。
   → **待使用者硬重新整理後回報**。

4. **Repo 是否納入版控未明**
   本 checkout 有正常 git remote（`wistroneq3300/pa-cycle-lab`），
   但 `/etc/systemd/system/` 下的 unit **不在 repo 內**（只在本機）。

---

## 5. Commit 記錄（branch `cycle/live-neutrino-redfish-hostname`）

```
95ca9b5  ui: add a Summary view to the Live Console, show hostnames on node cards   ← 本次
fd984a2  docs: add log-slimming handoff plan
54833f5  naboo_config: reject malformed lscpu rows in cpu_check
b84e154  ui: redesign the Cycle Live Console
c9fbd01  console: write a human-readable console transcript per job
0378171  engine: cut cycle evidence size (dmesg/pci/summary) and unify PCI capture
e922748  docs: keep the two latest handoffs; add 20261002d
```

**本次改動檔案（`95ca9b5`）**：
- `app/static/js/cycle-console.js`
- `app/static/js/cycle-workspace.js`
- `app/static/index.html`

---

## 6. 相關檔案地圖

| 用途 | 路徑 |
|---|---|
| Live Console 前端邏輯 | `app/static/js/cycle-console.js` |
| 節點選擇 UI | `app/static/js/cycle-workspace.js` |
| Console 樣式（run 頁） | `app/static/css/cycle-workspace.css` |
| Console 樣式（報告頁） | `app/static/css/cycle.css` |
| 簡化逐字稿產生器 | `engine/vera_cycle/console_log.py` |
| 事件寫入（journal） | `integration/store.py`（`append_event`, `compact_events`） |
| 事件 API | `integration/web.py`（`/events`, `/events/download`） |
| 壓縮腳本 | `scripts/compact_events.py` |
| 壓縮排程 | `/etc/systemd/system/pa-manager-6969-compact-events.{service,timer}` |
| 目標/Target 組裝 | `integration/targets.py` |
