# HANDOFF 2026-10-03b — 節點範圍巡檢（per-node inspection）+ 巡檢卡片收闔

> 分支：`astra-console-import`　｜　已 push：`origin/astra-console-import`　｜　HEAD：`5cd930d`
> 環境：`/root/sheng/PA-manager-6969`（live 6969）　｜　撰寫時間：2026-10-03 22:43 CST

---

## 0. 一頁摘要

| # | 做了什麼 | 狀態 |
|---|---|---|
| 1 | **巡檢改成「只看當前節點」**：一台機器（L11 rack entry）常有多個 OS slot（Neutrino 有 n1/n2/n3），原本巡檢一次展開全部節點，導致 log 混在一起、還會掃到沒上電的節點。現在**巡檢範圍 = 當前選取的節點（`active_os`）**。 | ✅ 已上線並實機驗證 |
| 2 | **系統巡檢卡片可收闔**：標題列加 `▾` 收闔鈕，點一下收起整塊（含「資料來源與涵蓋範圍」長清單）。 | ✅ 已上線並實機驗證 |
| 3 | **測試更新**：route 測試改為反映單節點行為，並新增「切換 active_os → 巡檢範圍跟著變」的測試。 | ✅ 70 PASS / 35 FAIL（0 回歸） |
| 4 | **Push**：`astra-console-import` 推到 `origin`（新分支）。 | ✅ |

**兩句重點**：巡檢現在是「你在哪個節點，就只巡那個節點」；巡檢區塊可以整塊收起來。

---

## 1. 背景與根因

### 1.1 問題現象
- 使用者反映：巡檢結果「一次列出所有節點、log 混在一起」，且常常**失敗在某個沒上電的節點**（例如 `boba-pa-1`，另一台實體機、目前無電）。
- 檢視後確認：**一台 PA 機器（`pa.machines[name]`）可擁有 1..N 個 OS slot**。
  - `neutrino-n1` → slot 1 = `neutrino-n1`、slot 2 = `neutrino-n2`、slot 3 = `neutrino-n3`
  - `EQ3300-AIAgent` → slot 1 = `OS 1`（本機）、slot 2 = `boba-pa-1`（獨立機、關機）

### 1.2 根因
- `integration/inspection_routes.py` 的 `targets(system)` 無條件呼叫 `integration/targets.py:expand()`，**展開全部非空 OS slot**。
- `systems()` 產生的 `system['nodes']` 也**列出全部節點**。
- 因此 `plan` / `summary` / `coverage` / 問題清單全部是「多節點合併」，新舊節點混在一起。
- 這與 Vera 的 cycle 不同：cycle 有「選擇節點」概念，巡檢卻沒有。

### 1.3 節點選取機制（既有）
- **節點選擇 = 機器的 `active_os`**（整數 slot 號），不是額外狀態。
- 前端：`app/static/js/product-detail.js` 的節點下拉 `<select>`（`requestedOs = b.active_os`）。
- 後端：`POST /api/machines/{name}/select-os`（body `{"slot": N}`）會把 slot 同步到機台層級欄位。
- 資料層：`inspection_snapshots / nodes / items / progress` **本來就帶 `node_id`**，所以「單節點」只需要在查詢側收斂範圍，**不需改 DB schema**。

---

## 2. 解法（本次改動）

### 2.1 後端 — `integration/inspection_routes.py`

**(a) `systems()`：帶出 `active_os` 並收斂 `nodes`**
```python
active_os=machine.get('active_os')
nodes=[dict(...) for e in canonical['os'] if not e.get('empty')]
if active_os is not None:
    scoped=[n for n in nodes if n['slot']==active_os]
    if scoped: nodes=scoped
result.append(dict(..., active_os=active_os, nodes=nodes))
```

**(b) `targets(system)`：展開後只留選中 slot**
```python
active=parent.get('active_os')
if active is not None:
    scoped=[t for t in result if t.get('slot_key')=='N'+str(active)]
    if scoped: result=scoped
```

**⚠️ 關鍵細節（踩過的坑）**：
- target 的 `slot_id` 是 **hash 字串**（例：`970e20934bca543e...`），**不是** `active_os` 的數字。
- 正確比對是用 **`slot_key`**（值為 `"N1"` / `"N2"` / `"N3"`）：`t.get('slot_key')=='N'+str(active)`。
- 一開始誤用 `slot_id==active` → 過濾後 **0 個節點**，務必注意。

**Fallback 行為**：若 `active_os` 為 `None` 或對應 slot 找不到 → **保留全部節點**（維持舊行為，避免空清單）。

---

### 2.2 前端 — `app/static/js/system-inspection.js`

- `card()` 標題列改為可收闔按鈕：
```html
<h2><button type="button" class="pd-inspection-collapse" data-collapse
    aria-expanded="true" aria-controls="pd-inspection-body" title="收闔系統巡檢">
    <span class="pd-inspection-caret" aria-hidden="true">▾</span>系統巡檢</button></h2>
```
- 內容全部包進 `<div class="pd-inspection-body" id="pd-inspection-body"> ... </div>`（在 `</section>` 前關閉）。
- `mount()` 增加事件：
```js
find('[data-collapse]').onclick=()=>{
  const body=find('[data-inspection-body]')||document.getElementById('pd-inspection-body');
  const button=find('[data-collapse]');const open=button.getAttribute('aria-expanded')!=='false';
  button.setAttribute('aria-expanded',open?'false':'true');
  if(body)body.hidden=open;
  root.classList.toggle('pd-inspection-collapsed',open);
};
```

### 2.3 樣式 — `app/static/css/product-detail.css`
```css
.pd-inspection .pd-inspection-collapse{display:inline-flex;align-items:center;gap:8px;padding:0;background:none;border:0;color:inherit;font:inherit;font-size:18px;cursor:pointer}
.pd-inspection .pd-inspection-caret{display:inline-block;font-size:12px;color:var(--p-muted,#91a3b3);transition:transform .15s ease}
.pd-inspection .pd-inspection-collapse[aria-expanded="false"] .pd-inspection-caret{transform:rotate(-90deg)}
.pd-inspection .pd-inspection-collapse:hover{color:#76b8ce}
```

### 2.4 測試 — `tests/test_identity_sync.py`
- 既有 `test_real_route_service_collects_and_syncs_without_cycle`：`identity_history` 斷言由 `8` 改為 `2`，並加上 `len(payload['nodes'])==1` 與 `payload['nodes'][0]['slot']==1`。
  - 原因：測試 fixture 的 `box` 有 4 個 slot 且 `active_os=1`；新行為只巡 slot 1，故 4×2=8 → 1×2=2。
- 新增 `test_inspection_scopes_to_active_os`：逐一切換 slot 1..4，驗證 `svc.resolve('box')['nodes']` 只含該 slot；再設 `active_os=None`，驗證回到全部 4 個。

---

## 3. 實測證據

### 3.1 後端（真 6969）
```
neutrino-n1, active_os=3 → plan.nodes = ['neutrino-n3']，coverage 只 1 個 node_id（b675874fef0c）✅
neutrino-n1, active_os=1 → plan.nodes = ['neutrino-n1'] ✅
EQ3300-AIAgent           → 只 'OS 1'，不再掃 boba-pa-1 ✅
```
巡檢跑完（active_os=3）：`running=False`, `coverage 筆數=24`, **coverage 涉及的 node 只有 1 個**。

切換驗證：`POST /api/machines/neutrino-n1/select-os {"slot":1}` → HTTP 200 → `plan.nodes=['neutrino-n1']`，`data.json` 的 `active_os` 變 1。**選哪個節點就巡哪個，證實。**

### 3.2 前端（瀏覽器實測）
- `▾ 系統巡檢` 收闔鈕出現，點擊：內容全隱藏，頁面高度 `1667 → 1288`；再點：`1288 → 1667`。✅
- 註：舊分頁可能因快取看不到按鈕，**開新分頁 / Ctrl+Shift+R** 即正常。

### 3.3 測試
| 範圍 | 結果 |
|---|---|
| `tests/test_identity_sync.py`（含新測試） | 25 passed |
| inspection 相關（`-k inspection`） | 38 passed |
| 完整（telemetry/shared/identity/integration/console） | **70 passed / 35 failed**（baseline 69/35，**0 新失敗**，多 1 個是新增測試）|

> 既有 35 個失敗為 baseline 既有（如 `test_console.py::test_structured_persistence_reopen_and_refresh`），**與本次無關**。

### 3.4 附帶驗證：Cycle Console 的 `<mode> sent`（前一輪改動，本次一併複驗）
- 真 job（Neutrino, `cycle_mode=reboot`, id `22b805c94eba4e2b8e399824b915d7e5`, 500 events, 3 節點）：
  fold 後每個節點各一行 → `neutrino-n1 → reboot sent`, `neutrino-n2 → reboot sent`, `neutrino-n3 → reboot sent`（共 3 行）。
- preview job（`power_cycle`, 4 節點）：`DC Power Cycle sent`（每節點一行）。
- 機制：`COMMAND_DISPATCHING` 與 `COMMAND_DISPATCHED` 皆折成 `${modeLabel(cycle_mode)} sent`，以 `seenStage` 去重、`detail` 清空。

---

## 4. Commit 記錄（本次 session 相關）

| commit | 說明 |
|---|---|
| `21c4d93` | (上游 Astra) Refine PA Telemetry modal and scalable Cycle execution console |
| `d10388d` | ui: 還原 Cycle console 的單行 `<mode> sent` dispatch 顯示 |
| `67d6e1c` | ui: 補 `.lc-single-target` CSS |
| **`1cc7ce2`** | **inspection: scope to the selected node and make the card collapsible**（本體改動） |
| **`5cd930d`** | **test: inspection scopes to active_os**（測試） |

已 push：`origin/astra-console-import` = `5cd930d`。

---

## 5. 相關檔案地圖

| 檔案 | 角色 |
|---|---|
| `integration/inspection_routes.py` | 巡檢路由；`systems()`、`targets()` — **本次改動核心** |
| `integration/targets.py` | `expand(name,parent)` 展開 OS slot → target；`slot_key`/`slot_id` 來源 |
| `integration/inspection_service.py` | `resolve()` / `snapshot()` — 巡檢服務 |
| `integration/inspection_collection.py` | `IndependentSource` 採集 |
| `app/static/js/system-inspection.js` | 巡檢卡片（`card()`/`mount()`）— **本次加收闔** |
| `app/static/js/product-detail.js` | 節點下拉、`active_os` 讀取、掛載 `SystemInspection.card()`（約 line 158） |
| `app/static/css/product-detail.css` | `.pd-inspection*` 樣式 — **本次加 collapse** |
| `tests/test_identity_sync.py` | 巡檢 route 測試 — **本次更新 + 新增** |
| `app/static/js/cycle-console.js` | Cycle Console fold（`${mode} sent`，約 line 130-135） |
| `engine/vera_cycle/console_log.py` | 後端 `_MODE_LABELS` / `_stage(... f"{self._mode} sent")` |

---

## 6. 已知限制 / 待辦 / 風險

### 6.1 本次改動的已知限制
1. **排程巡檢也跟隨 `active_os`**：背景排程巡檢（`submit(system['name'], scheduled=True)`）同樣走 `targets()`，所以**「目前選哪個節點，排程就巡哪個」**。若日後希望「每個節點各自排程」，需要另做 per-node 設定（尚未做）。
2. **`active_os` 是共用狀態**：它是機器層級的欄位，其他功能（Terminal / KVM / Telemetry）也用它。所以「切換節點」會**同時改變巡檢範圍與其他 tab 的對象** — 這是刻意的（單一選取來源），但需留意。
3. **`active_os=None` 時退回全部節點**：目前正常情況 `active_os` 必有值，此 fallback 只為安全。
4. **UI 收闔狀態不持久化**：重整後預設為展開；未存 localStorage。

### 6.2 待你（使用者）確認
- [ ] **Ctrl+Shift+R** 於 6969 實機確認：`▾ 系統巡檢` 收闔、以及切換節點後巡檢只掃該節點。
- [ ] 「排程是否也要 per-node 各自設定」— 目前是跟隨 active_os，若不符預期再議。

### 6.3 其他既有待辦（**非本次**，來自上一份交接 `HANDOFF-20261003a`）
- [ ] ⚠️ **VACUUM 未做** — events DB 壓縮不釋放磁碟，建議加進 service。
- [ ] ⚠️ **`runtime_manifest.py` vs `store.py` 規則不一致** — 未修。
- [ ] systemd unit 不在 repo 內（只在本機 `/etc/systemd/system/`）。

---

## 7. 維運 / 重啟指令備忘

```bash
# 6969 服務
sudo systemctl restart pa-manager-6969-web
systemctl is-active pa-manager-6969-web

# 驗證巡檢範圍（只應列出 1 個節點）
curl -s "http://127.0.0.1:6969/api/machine/neutrino-n1/inspection/plan" \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print([n['label'] for n in d['nodes']])"

# 切換節點（會同時改變巡檢範圍）
curl -s -X POST "http://127.0.0.1:6969/api/machines/neutrino-n1/select-os" \
  -H "Content-Type: application/json" -d '{"slot":1}'
```

**注意**：後端（`inspection_routes.py`）改動需 **restart service**；前端 JS/CSS 只要瀏覽器強制重載即可。

---

## 8. 環境注意事項（重要）

- Repo：`/root/sheng/PA-manager-6969`，分支 `astra-console-import`。
- **勿 push** `/root/sheng/vera-cycle`；可 push 的 vera fork 在 `/root/vera-cycle`。
- `origin` = `https://github.com/wistroneq3300/pa-cycle-lab.git`。
- 有一顆**既存的舊 stash**：`stash@{0}: On codex/remove-locks: wip-before-remove-locks` — **請勿誤刪**（本次作業中一度被 `git stash` 波及，已用 `git reset --hard` 還原，stash 本身完好）。
- Port 3000 的服務（PID 2274158）**未動**。
