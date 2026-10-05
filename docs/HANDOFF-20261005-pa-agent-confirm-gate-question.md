# PA Agent confirm-gate：現況、問題與待決策

> 日期：2026-10-05
> 分支：`astra-console-import`
> 用途：把「PA Agent 進場確認流程」的**實際行為**與**期望行為**寫清楚，供外部審閱（GPT / 同事）。

---

## 1. 我們要的流程（期望）

1. 上一步（選測項）按下按鈕 → **進入 PA Agent**（不是「產生指令」）。
2. AgentRun 建立為 `PENDING` → **真的不動**（不自動執行）。
3. **PA Agent 自動讀取左欄的「執行計畫」**，主動用對話講出：
   - 它打算怎麼測（步驟、目標節點、風險）
   - 例如：「我將對 `10.35.228.144` 執行 `lspci -nn` 盤點 → 以 BDF 查 `-vvv` → 抽出 vendor/device、LnkCap/LnkSta 與 SPEC 比對 → 產出報告」
4. 使用者審閱後，在對話框打 **`OK` / `GO`**（或 `開始`/`執行`）→ Enter 送出。
5. **只有此時**才 `startRun()` → Agent 才 SSH 連線開跑。

一句話：**先出計畫 → 人回 GO → 才開跑。**

---

## 2. 實際發生的行為（問題）

實測（2026-10-05，`Check PCIe` / `Wistron-HW-00318-V002`）觀察到的時間軸：

| 時間 | 事件 |
|---|---|
| 開窗 | 顯示 `待審閱 · AgentRun 已建立（PENDING）`，並宣稱「PA Agent **不會**自動執行」 |
| `21:21:45` | 使用者打「你評估一下」 |
| `21:21:45` | **整包 `build_instruction` 內文**（系統級指令）被當成「使用者的訊息」貼進對話 |
| `21:22:40` | PA Agent 回「**執行完成**。以下是測試報告…」，**已 SSH 跑完 204 條指令** |

也就是：

- **狀態文字與事實矛盾**：畫面說 `PENDING / 待審閱 / 不會自動執行`，實際上 agent **已經連線 SSH 執行完畢**。
- **沒有「先出計畫」關卡**：開窗後 agent 不會主動講計畫。
- **沒有「等 GO」關卡**：使用者打任何字（本例為「你評估一下」）就被當作 `user_note` 並**附帶啟動**（`startRun` 帶 `auto_run:true`）→ 直接開跑。
- **instruction 被當成使用者訊息**：`build_instruction()` 產生的系統級內容，貼進對話時角色顯示成「你」（使用者），語意錯亂。

---

## 3. 根因（程式碼層）

- `integration/agent_gateway.py`
  - `build_instruction()`：把案例內容組成一段**要給 agent 的啟動訊息**，但**沒有**任何「先講計畫、等工程師回 GO 才執行」的開場語。
  - run 建立後，只要有 `startRun`（`auto_run:true`）就送出 instruction 給 agent，agent 具備 terminal 工具 → 直接執行。
  - `_is_manual_only` 之外，並無「計畫模式（plan-only）」分支。
- `app/static/js/pa-agent.js`
  - `startRun()`（約 L235）：按下按鈕即 `POST /runs/{id}/start`，body `{ auto_run: true, user_note }` → 直接執行。
  - 開窗**不會**先建立 plan-only run，也**不會**由 agent 主動輸出計畫。
  - Enter 目前**只換行**、不送出（`wireInput()`，約 L113）→ 也無法用「打 GO + Enter」開跑。
- 文案與事實不符：
  - 「PA Agent 不會自動執行」（實際上會）。
  - 舊版殘留文案「下一步僅產生指令文字，不連線執行」（實際上會連線執行）。
  - 這些字串**不在本 repo**（grep 不到），推測來自 PA agent-server（18010）自身的 system prompt / 開場語 / AGENTS.md。

---

## 4. 待決策

### D1：進場後要「先出計畫」還是「直接開跑」？
- **(甲) 先出計畫**（我們的目標）：開窗先建立 plan-only run（`auto_run:false`），agent 主動講計畫；使用者回 `OK/GO` 才 `startRun()`。
- **(乙) 直接開跑**：開窗即執行；則所有「待審閱 / PENDING / 不會自動執行」文案必須刪除（因為是假的）。

> 目前傾向 **(甲)**。

### D2：`OK/GO` 的關鍵詞範圍
建議接受：`OK` / `GO` / `開始` / `執行` / `可以` / `run`。是否增減？

### D3：上一頁按鈕命名
`產生指令 (N)` 語意不符（它其實是「交給 PA Agent」）。擬改名為 `交給 PA Agent 執行` 或 `進入 PA Agent`。要用哪個？

### D4：PA agent-server（18010）能力確認
實測顯示 agent **能自行 SSH 連 DUT 執行**（204 條指令為其執行）。故「僅產生指令文字、不連線執行」為**錯誤文案**。是否確認 agent 一律允許自行 SSH？（影響安全邊界與授權策略）

---

## 5. 建議修法（若採 D1 = 甲）

1. `agent_gateway.py`
   - `build_instruction()` 開頭加：「**請先以繁體中文說明你打算如何執行本測項（步驟、目標節點、風險），然後停下來等待工程師回覆 `OK` 或 `GO`；在收到 `OK/GO` 之前不要執行任何指令。**」
   - `start_run()` 增加 `plan_only` 參數：`plan_only=true` 時 `auto_run:false`，只送計畫請求。
2. `pa-agent.js`
   - 開窗流程：建立 run → 以 `plan_only` 請 agent 出計畫 → 渲染對話。
   - Enter 偵測：輸入為 `OK/GO/開始/執行/可以/run` → 呼叫 `startRun()`；否則顯示「請輸入 OK / GO 開始執行」。
   - 移除/修正假文案（`PENDING 不會自動執行`、`不連線執行`）。
3. 上一步按鈕改名（D3）。

---

## 6. 相關檔案

- `app/static/js/pa-agent.js` — 前端 drawer、`open()`、`createRun()`、`startRun()`、`wireInput()`。
- `app/static/js/app.js` — 觸發點：`PA_Agent.open()`（約 L3580 / L3585 / L3842 / L3856）。
- `integration/agent_gateway.py` — `build_instruction()`、`start_run()`、`_is_manual_only()`。
- `app/main.py` — PA agent 路由。
- `tests/pa-agent-drawer-e2e.cjs` — e2e（含舊流程註解 `確認產生指令`）。
- `tests/test_agent_routes.py` — 路由測試。

---

## 7. 未解 CI 問題

- CI job：**「Runtime manifest / consistency」** 失敗（尚未取得 log 內容，待補）。
