# P3 — PA Agent / OpenHands 整合設計（design-first）

> 狀態：設計稿。本文件只定義架構與契約，尚未實作。
> 前置：P1（test library，commit `a7f825f`…`15f0116`）與 P2（case detail，commit `48d0430`）已完成。
> 本文件遵循 HANDOFF §6 P3 規格與使用者反覆強調的限制（見 §10）。

---

## 1. 目標與一句話架構

讓工程師在 PA 平台上，對**已選定的 Test Case** 按下「指派給 PA Agent」，由 PA 後端建立一個
**正式的 AgentRun**，交給 OpenHands 執行；PA 只呈現一個**乾淨的對話視窗**，OpenHands 完全隱形。

```
PA Frontend ──► PA Backend ──► Agent Gateway ──► OpenHands ──► SSH/Script/Tool ──► DUT
   │                                                                    ▲
   └── 只 render: Test Case Library + PA Agent Chat Drawer              │
       （絕不 iframe / embed OpenHands 的任何 UI）                被測機台
```

- **OpenHands 只是後端引擎**：PA 前端永不顯示 OpenHands 的 logo、導覽、左側對話列表或 `:3000`。
- **前端永不直接控制 OpenHands**：所有呼叫經 PA Backend 的 Agent Gateway。
- **PA 自有的 Chat Drawer**：資料來源是 PA 自己的 DB（`AgentRunContext.conversation`），
  事件由 Gateway 聚合降噪後才呈現。

---

## 2. 部署隔離（本節決定「右側對話不被洗版」）

### 2.1 問題
OpenHands 的原生對話列表會列出**所有** conversation。若 PA 與工程師本人共用同一個實例/前端，
128 個 test case 跑下去 = 128 個 session 灌進來，工程師原本的工作對話會被洗版。

### 2.2 決策：獨立實例 + 獨立前端 + 獨立儲存
| 層 | 工程師本人 | PA Agent |
|---|---|---|
| OpenHands 實例 | 現有實例（port 8001/deepseek 對應） | **獨立實例（另開 port，如 3443 relay 對應的 PA 專用）** |
| 對話儲存 / workspace | 工程師自己的 | **PA 專用目錄（nvme0n1：`/srv/...`，1.5T 可用）** |
| 前端 | 工程師本人的 OpenHands UI | **PA Chat Drawer（PA 自己畫）** |

> **重點**：換 port ≠ 隔離。必須「網路端點 + 資料儲存 + 前端」三者都在 PA 側，
> 且 **PA 前端絕不 render OpenHands 原生列表**，否則就算另開 port 一樣會被洗版。

### 2.3 資料放置（已與使用者確認）
- PA Agent 的 workspace / conversation / evidence 放 **nvme0n1（`/srv/prometheus` 同碟，
  1.6T 幾乎全空）**，**不要**放 `/mnt`（那是使用者的 model，已用 1.7T/3.5T）。
- 需設**保留策略**：evidence/log 依天數或容量上限清理（P3 實作時定門檻）。

---

## 3. 模型資源（已與使用者確認）

PA Agent 的「思考模型」= 本機 vLLM **qwen3.8-27b（`http://127.0.0.1:8001/v1`）**。

| 用途 | 模型 | Port | GPU | 已調參 |
|---|---|---|---|---|
| **PA Agent 主腦** | qwen3.8-27b | 8001 | 4,5 | `max-model-len 65536`、`--enable-prefix-caching`（TP=2） |
| 工程師本人 OpenHands | deepseek-v41-flash | 8011 | 0-3 | 不動 |
| 看圖（VL） | qwen3-vl | 8002 | 6 | 不動 |

- 27B 已於本次 session 改為 **64K + prefix caching**（`/etc/systemd/system/qwen3-27b.service`，
  備份 `qwen3-27b.service.bak-20261005-125957`）。64K 是為了兼顧「單一 case context 不會撞邊界」
  與「20 人併發」的折衷。
- **20 人同時測試評估**：機器為 7×B200 / 256 核 / 2TB RAM，硬體綽綽有餘；
  瓶頸在 vLLM 的 KV cache。64K + prefix caching 下，20 條並行對話對 2 張 B200（366GB VRAM）不成問題。
- **避免 context 撞牆的策略**：PA backend 控制送進 Agent 的內容大小（見 §5.3），
  真正的超長 case 才升級到 deepseek（256K），並接受它可能排隊。
- **策略**：不降 deepseek 的 TP，避免影響既有使用者。

---

## 4. 核心物件：AgentRun / AgentRunContext

### 4.1 生命週期
```
指派 → 建 AgentRun（PENDING） → 建 AgentRunContext（IMMUTABLE 快照）
     → OpenHands conversation（PA 專用實例） → 執行（RUNNING）
     → 需要批准/裁定（WAITING_FOR_USER） → 完成（PASS/FAIL/BLOCKED）
     → 寫回 Validation Overview（可追溯）
```

### 4.2 AgentRunContext（不可變，由 PA Backend 建立）
建立後**不再修改**，確保可重現、可稽核：

| 欄位 | 說明 | 來源 |
|---|---|---|
| `run_id` | 唯一執行 id | PA 產生 |
| `library_version` | test library schema/version | `/api/testlibrary/meta` |
| `case_variant_id` | **唯一身分**（不是 `code`） | `select_variant` |
| `testcase` | 該 case 的扁平視圖（code/items/test_set…） | test library |
| `ai_review` | 合併審查物件（完整、原樣） | `tests_gpt_merged.json` |
| `project` / `system` / `node` / `os_slot` | 目標機台 | PA machine model |
| `binding_revision` | 節點身分版本（更換節點時變動） | PA identity |
| `required_documents` | 此 run 需要的 SPEC/SOP（見 §6） | 專案文件綁定 + case 需求 |
| `user_attachments` | 使用者本次上傳 | Chat Drawer |
| `approvals` | 批准紀錄（安裝/破壞性/裁定…） | 執行中逐步產生 |
| `conversation` | OpenHands conversation 的投影 | Gateway |
| `commands` | 實際執行的指令 | Gateway |
| `evidence` | stdout/stderr/檔案 | Gateway |
| `final_result` | PASS/FAIL/BLOCKED/RUNNING/WAITING_FOR_USER/ERROR | Engine |

> **不得**用 `code` 當唯一識別；同一 `code` 可能有多個 variant（同碼多筆），一律以 `case_variant_id` 定位。

### 4.3 結果碼
`PASS` / `FAIL` / `BLOCKED` / `RUNNING` / `WAITING_FOR_USER` / `ERROR`

---

## 5. 政策引擎（在 BACKEND 強制，不在前端）

`automation_classification` 驅動行為，**前端不可繞過**：

| classification | 行為 | UI |
|---|---|---|
| FULLY AUTOMATABLE | 直接執行 | 進度 + 結果 |
| REQUIRES PACKAGE / USER CONFIRMATION | **暫停等批准**（例：`apt install fio` → [批准安裝]/[取消]） | 審批卡片 |
| MANUAL ONLY | 只引導，收集人工證據 | 步驟 + 上傳證據 |
| BLOCKED | **拒絕執行**，顯示阻擋原因（`blocked_conditions`） | 拒絕說明 |
| `end_user_decides=true` | **不可自動 PASS/FAIL**；收集證據後交工程師裁定 | [PASS]/[FAIL]/[BLOCKED] 卡片 |

其他 gating 旗標一併尊重：`destructive_actions`、`requires_human_approval`、
`user_confirmation_required`、`recovery_procedure`。

### 5.3 送入 Agent 的內容控制（避免 context 撞牆）
- 只送**此 case 需要的** `ai_review` 欄位，不整包塞。
- 專案文件（SPEC/SOP）**按需注入**（§6），不每次全塞。
- 超出 64K 的極端 case → 標記升級 deepseek。

---

## 6. 附件 / SPEC / SOP / 日誌

兩種來源，且要能**自動解析**：
1. **per-run 上傳**：使用者在此次 run 的 Chat Drawer 上傳。
2. **project-bound 共用文件**：綁在專案上（例：`Vera_CPU_SPEC.pdf`、`PCIe_SPEC.pdf`、`BMC_SOP.pdf`），
   一個 test case 可**自動取用**專案文件，不需重複上傳。

`AgentRunContext.required_documents` 記錄此 run 解析到的文件，確保可追溯。

---

## 7. PA Agent Chat Drawer

- **PA 自有的聊天 UI**：標頭顯示 `TC / target / risk`。
- 訊息輸入框；**無** OpenHands logo / 導覽 / `:3000` / 左側列表。
- **事件聚合降噪（Gateway 負責）**：

| OpenHands 事件 | 去向 |
|---|---|
| user / agent 實質對話 | Chat Drawer |
| tool call / observation（raw） | Run 詳情的 `commands`/`evidence`，**不進聊天** |
| stdout/stderr | `evidence`，收合成可展開區塊 |
| 需批准 / `end_user_decides` 節點 | Chat Drawer 的**卡片**（非一般訊息） |
| progress (step 3/12) | Chat Drawer 一則**會更新的狀態列**，不一直 append |

> 同一階段連續事件要 **coalesce** 成一則可更新訊息，避免洗版。

---

## 8. 證據 / 結果 / 可追溯

- 儲存：commands、stdout/stderr、evidence、logs、approvals、attachments、start/end time、
  result、failure reason、conversation。
- **寫回 Validation Overview**（例：`126/128 · PASS 121 · FAIL 3 · BLOCKED 2 · RUNNING 2`）。
- 可追溯鏈：
  `Test Case → Agent Run → Conversation → Commands → Evidence → Result`

---

## 9. 與被測機台（DUT）的關係

- 重 I/O 測試（如 fio）的負載在 **DUT 端**，不是 AI 主機的問題；
  但 PA 要注意 **20 個 run 同時打同一台 DUT** 的資源衝突，需在排程層去重/序列化。
- 破壞性測試（`destructive_actions=true`）必須先取得使用者對「目標裝置 + 資料遺失」的明確批准
  （見 §5），並遵守 `recovery_procedure`。

### 9.1 驗證案例（canonical）
`Wistron-Storage-00009-V003`（FIO 70/30 mix）：
- 原始 work order 標題寫 70/30 mix，但 `[global]` 實為 `rw=randwrite`、`overwrite=1`、`runtime=43200s`、無目標裝置。
- AI review 標為 **REQUIRES PACKAGE / USER CONFIRMATION、risk CRITICAL、destructive_actions=true、
  requires_human_approval=true、end_user_decides=[PASS,FAIL,BLOCKED]**。
- **此案例證明 P3 必須以批准為閘門、永不自動 PASS**（見 §5）。

---

## 10. 不可違反的限制（來自 HANDOFF §6）

- 不重新設計 Test Case library UI，不破壞現有「指派任務」流程。
- 不 iframe OpenHands；不讓前端直接控制 OpenHands。
- 不用 `code` 當唯一身分（用 `case_variant_id`；同碼多筆可區分）。
- 不把 Test Case JSON 倒進前端。
- 不讓 agent 繞過安全/批准。
- 不捏造 `tests_gpt_merged.json` 沒有的欄位。

---

## 11. 建議實作階段（供後續 session 拆票）

| 階段 | 內容 | 依賴 |
|---|---|---|
| P3-a | PA 專用 OpenHands 實例 + 儲存隔離（nvme0n1）+ PA 綁定 27B:8001 | 部署 |
| P3-b | AgentRun / AgentRunContext 資料模型 + `/api/agent/runs*`（建/查/列表） | P3-a |
| P3-c | Gateway：OpenHands conversation 橋接 + 事件聚合降噪 | P3-b |
| P3-d | 政策引擎（classification / approvals / end_user_decides，後端強制） | P3-b |
| P3-e | PA Agent Chat Drawer（前端，乾淨視窗 + 卡片） | P3-c |
| P3-f | 附件 / 專案文件綁定 + 自動解析 | P3-b |
| P3-g | 證據落地 + Validation Overview 回寫 + 可追溯 | P3-c,d |
| P3-h | 排程去重（同 DUT 並行）、保留策略 | P3-c |

> 建議逐階段交付，每階段結束跑 §12 的驗證。

---

## 12. 驗證方式（沿用 HANDOFF §8）

```bash
cd /root/sheng/PA-manager-6969
CYCLE_MODE=synthetic PYTHONPATH=engine/vera_cycle .venv/bin/python -m pytest tests/ -q   # baseline 87 failed, 0 new
CYCLE_MODE=synthetic PYTHONPATH=engine/vera_cycle .venv/bin/python -m pytest tests/test_test_library_contract.py -q
PYTHONPATH=engine/vera_cycle:engine/vera_cycle/dev/tests .venv/bin/python -m pytest engine/vera_cycle/dev/tests/test_cycle.py -q
.venv/bin/python scripts/check_runtime_manifest.py
systemctl restart pa-manager-6969-web.service
curl -s http://127.0.0.1:6969/api/testlibrary/meta | head -c 400
```
