# 交接文件：Neutrino Cycle 上線 + Cycle UI 修復（2026-10-02）

日期：2026-10-02
Repo：`/root/sheng/PA-manager-6969`
分支：`codex/remove-locks`（**本輪改動尚未 commit**）
服務：`pa-manager-6969-web.service`（port 6969）、`-runner`、`-bridge`(7002)、`pa-manager7000`（不要動）

今天的目標是「把 Neutrino cycle 透過 6969 跑起來」，**尚未達成**（卡在 inventory + 前端路
由 bug 已修但還沒重驗）。今天**沒有實際跑 cycle**（會切電/重開機），全部只用唯讀 GET 驗證。

---

## 0. 本輪改了什麼（檔案清單）

```
AGENTS.md                          (+ 記憶：aux 待辦、hostname 探測、路由 bug)
app/main.py                        (add_machine 存 os_hostname/bmc_hostname)
app/static/index.html              (cycle-workspace.js 加 cache-buster)
app/static/js/cycle-workspace.js   (修專案路由 bug)
engine/vera_cycle/naboo_config.sh  (升級成 profile contract 格式)
integration/profiles.py            (checker_script_path 等 + freeze/resolve 帶 project)
integration/runner.py              (依 job['project'] 選腳本)
integration/store.py               (target_reason 放開 neutrino 綁死)
integration/web.py                 (404 + project_name 傳遞)
data/pa6969/data.json              (Neutrino 3 台填 os_hostname/bmc_hostname)  ← 資料，非程式
```

未 commit。若要 commit，建議分兩個 commit：(1) cycle per-project 後端 (2) 前端路由 + 資料。

---

## 1. Cycle checker 依專案選擇（已完成，已驗證）

- 選哪個專案 → 跑 `engine/vera_cycle/<slug>_config.sh`（slug = `re.sub(r'[^a-z0-9_-]','_', name.lower()).strip('_')`）
- 找不到 → **HTTP 404**「找不到 checker 腳本 …/<slug>_config.sh，請先放置該專案的 …」
- **不 fallback** 到 neutrino
- 放開 `target_reason` 的「profile 必須是 neutrino」（改為「該專案有 _config.sh 就放行」）
- 現況：只有 `neutrino_config.sh`、`naboo_config.sh` 存在；其餘 8 專案選了會 404

驗證結果（唯讀 GET）：
- `GET /api/projects/Neutrino/cycle/targets` → 200
- `GET /api/projects/Naboo/cycle/targets` → 200
- `GET /api/projects/Boba_fett/cycle/targets` → 404（缺 boba_fett_config.sh）
- `POST .../Boba_fett/cycle/jobs` → 404，且**不建 job**

---

## 2. Cycle UI 專案路由 bug（已修，待明天重驗）

**症状**：在 Neutrino 專案點「驗證 Cycle」→ 顯示 `…/eq3300_config.sh` 的錯誤（專案跳錯）。

**根因**（`app/static/js/cycle-workspace.js`，它最後載入、覆蓋掉 `cycle.js` 的 `openCycleTest`）：
1. `openCycleTest`/`openChassisCycle` 只用 `project_id` 組 hash；很多專案**沒有 project_id** → URL 帶到空的/殘留的 id。
2. `wizard()` 用 `inventory.find(p=>p.project_id===route[0])` → 沒有 project_id 就 throw。
3. 新 hash 等於舊 hash 時 `hashchange` 不觸發 → 不 re-mount → 停在舊專案。

**修法**：
- route 沒 project_id 時 fallback 用專案**名稱**
- `wizard()` 也 fallback 用名稱找
- `openCycleTest`/`openChassisCycle` 若 hash 沒變 → 強制 `mount()`
- `index.html` cache-buster → `cycle-workspace.js?v=20261002-projroute1`

`node --check` 通過；web 已重啟；`index` / targets / JS 都 200。

**待明天驗**：實際點 Neutrino → 驗證 Cycle，確認載到對的專案。

**待討論**：**兩套 cycle UI 並存**（`cycle.js` 舊 modal + `cycle-workspace.js` 新 hash router），
是混亂來源，值得整併。

---

## 3. Hostname（資料 + 加系統行為）

- `app/main.py add_machine`：加系統時抓到 OS hostname → 存進 `os_hostname`（機台層 + slot 層）；
  BMC hostname 為 **best-effort**（SSH 進 BMC 跑 `hostname`，抓不到留空不擋）。
- `data/pa6969/data.json` Neutrino slot 1/2/3 已填：
  | slot | os_hostname | bmc_hostname |
  |---|---|---|
  | 1 | neutrino-n1 | vc-256-bmc-n1 |
  | 2 | neutrino-n2 | vc-256-bmc-n3 |
  | 3 | neutrino-n3 | vc-256-bmc-n3 |
  - **n2/n3 的 bmc_hostname 相同 → 待使用者確認**（可能 shared BMC，或 CSV 打錯）
- 備份：`data/pa6969/data.json.bak-20261002-014948`

**尚未定案**（使用者說明天討論）：
- 「精緻版」hostname 探測：建 job 時現場抓 hostname、寫回該 node 的 `os[slot]`、抓失敗**擋住不跑**。
- tray：使用者傾向「**tray 綁定專案名稱**（Neutrino 專案 → tray=Neutrino）」，node 綁 hostname，
  讓 log 檔名好看（`Target.key = {tray}_{node}`）。**尚未定案/尚未做**。

---

## 4. Neutrino cycle 目前還缺什麼（未達成的原因）

`GET /api/projects/Neutrino/cycle/targets` → 3 台 node 全部 blocked，每台 reasons：
| # | reason | 要填什麼 |
|---|---|---|
| 1 | `缺少或無效：tray` | tray（tray 處理方式待定，見第 3 節）|
| 2 | `缺少或無效 power_domain` | 電源域（三台同域還是各一域？待使用者確認）|
| 3 | `實機模式需要真實 inventory 與 credential_ref` | **live 必填**，憑證（待使用者準備）|
| 4 | `Physical slot/action scope mapping needs confirmation` | `mapping_status` → `confirmed`（要查怎麼設）|
| 5 | `Inventory endpoint 重複：os`（**只有 n1**）| n1 的 OS IP 跟別台撞（要查哪台）|

- mode = **live**
- 已解掉：`os_hostname`/`bmc_hostname`（第 3 節已填，重啟後生效）
- `credential_ref` / `power_domain` / `mapping_status` / n1 IP 重複 **都還沒處理**

**建 job 時每條非空 reason 都會 Conflict 擋**，所以要全部清掉才能跑。

---

## 5. aux cycle 依專案（已記錄在 AGENTS.md，未實作）

背景：cycle 的 reboot/power_cycle 4 種大多專案通用，**差異主要在 aux_cycle**
（有人 BMC standby、有人接 **PDU**）。現況 aux **寫死在兩處**：
`integration/profiles.py:30` + `engine/vera_cycle/cycle_engine.py:550`（都是
`/usr/bin/stbypowerctrl.sh aux_cycle`，BMC standby）。要支援 PDU 需放寬 `validate()`
（安全風險，需使用者明確認可）。

**明天要討論的**：
- aux 要支援哪些做法（BMC standby / PDU-over-ssh / PDU-over-ipmi）？給 1~2 個實際例子
- 格式：`<專案>_commands.json`（建議，可驗證）vs 純 txt
- 變數：`ipmi_cipher`(-C 17)、`credential_ref`(帳密)、IP/hostname 都已有欄位

---

## 6. 明天待辦（依優先序建議）

1. **重驗 cycle-workspace.js 路由修復**：點 Neutrino → 驗證 Cycle，確認不會跳錯專案。
2. **討論 cycle 頁面呈現**（使用者指定明天討論）—— 含 tray 綁專案名 / node 綁 hostname / log 檔名。
3. **Neutrino inventory 補齊**（power_domain / credential_ref / mapping / n1 IP 重複）→ 目標真能跑 cycle。
4. **aux 依專案**（第 5 節）—— 先確認需求再動手。
5. **精緻版 hostname 探測**（建 job 時抓 + 擋）。

---

## 7. 環境速查 / 規則

- 重啟（**只動 web**）：`systemctl restart pa-manager-6969-web.service`
- 唯讀查 targets：`curl -s http://localhost:6969/api/projects/<專案>/cycle/targets`
- 6969 = `.venv/bin/python -m uvicorn integration.web:app`（CYCLE_MODE=live, CYCLE_INSTANCE=data/pa6969）
- **不要動**：7000 / runner / bridge
- 密碼/憑證不進 Git/argv/公開 API
- repo 規則：一次一個工具呼叫，避免回覆被截斷（見 AGENTS.md）
