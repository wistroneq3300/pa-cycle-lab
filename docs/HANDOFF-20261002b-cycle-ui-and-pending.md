# 交接：Cycle 依專案 + Neutrino 上線進度（2026-10-02 第二輪）

Repo：`/root/sheng/PA-manager-6969`　分支：`codex/remove-locks`
服務：`pa-manager-6969-web.service`（6969）。只重啟 web，不動 runner/bridge/7000。

---

## 一句話
Cycle 已能「依專案選 checker」並正常進入 Neutrino，但 Neutrino **還不能真的跑 cycle**（缺
power_domain / credential_ref / mapping_status / tray 等 blocker）。本輪又做了：inventory 修正、
Profile 從 UI 移除、限制改成選單、並行上限隱藏。**全部尚未 commit**。

---

## 本輪已改（尚未 commit）
程式：
- `integration/web.py` `native_inventory`：沒 `<project>_config.sh` 的專案**仍在清單**（帶 error
  訊息），不再讓單一專案 404 拖垮整個 inventory。（= 使用者選項 B）
- `app/static/js/cycle-workspace.js`：
  - 移除 **Profile** 欄位（改成 hidden input 帶後端值，送 job 一致性檢查照常）
  - 「Loop 上限 + 小時上限」→ **限制方式選單**（`loop 幾 run` / `hr 幾小時`）+ 數值，**無預設**、
    未選未填擋住；送出 `{loops:N,hours:0}` 或 `{loops:0,hours:N}`（一次只一個）
  - 移除「**並行 domain 上限**」欄位，送出**不帶 parallelism**（後端預設 8）
  - 缺 checker 的專案顯示 `#cw-project-error`
- `app/static/js/cycle.js`：舊 modal 也移除 Profile 顯示行
- `app/static/index.html`：cache-buster `cycle-workspace.js?v=20261002-hideparallel1`
資料（gitignored，不會進 git）：
- `data/pa6969/data.json`：`naboo-01` slot2/3/4 的 bmc_ip 從 `10.35.228.146/147/148`
  （撞 Neutrino）改成 `10.10.20.2/3/4`。備份 `*.bak-*-prenabooip`。
- 之前已改：Neutrino slot1 label=`neutrino-n1`（不再顯示「OS 1」）

---

## Neutrino 目前 blocker（每台 4 條）
```
缺少或無效：tray
缺少或無效 power_domain
實機模式需要真實 inventory 與 credential_ref
Physical slot/action scope mapping needs confirmation
```
（n1 的「Inventory endpoint 重複：os」已解，見上。os_hostname/bmc_hostname 也已解。）

---

## 已決定但「還沒做」的（新對話請照這個做）

1. **tray 綁專案名（動態）**
   - 使用者決定：**組 target 時 tray = 該機台所屬 `project` 名**（例如 Neutrino），**不改 data.json**
   - 位置：`integration/targets.py`（組 target 處）、可能 `integration/control.py:64/97`、`observation_service.py:49`
   - 目的：`Target.key = {tray}_{node}` → log 檔名好看（`Neutrino_neutrino-n1`）
   - ⚠️ 注意：`cycle_core.py Target.key` 目前 `f"{tray}_{node}"`；node 也要綁 hostname

2. **power_domain（使用者決定：各接各的）**
   - 每台各自一個 domain（可單獨切）；填進 `data.json` 每台 slot 的 `power_domain`
   - 建議值如 `Neutrino-n1-pd` / `-n2` / `-n3`（或使用者指定）

3. **credential_ref（待使用者決定 (P)/(Q)）**
   - 現況：`data.json` 每台 `credential_ref=None` → live 被擋
   - 重要事實：**cycle 執行不吃 data.json 帳密**！`runner.py:178` 用
     `provider.credentials(credential_ref)`，而 `integration/local_provider._credentials()` **回傳 `{}`**
     （空殼）。`integration/credentials.py` 讀 `data/pa6969/credentials.json`（0600 檢查），但檔不存在。
   - **(P)** 建 `data/pa6969/credentials.json` + 改 `local_provider._credentials` 讀它（正規、安全）
   - **(Q)** 改 `local_provider._credentials` 直接讀 data.json 帳密（省事、破壞隔離）
   - **兩者都要改 `local_provider.py`**（它現在是空殼）。BMC 帳密已知 `root/0penBmc`；OS 帳密待使用者給。

4. **mapping_status → confirmed（待使用者確認後設）**
   - 沒有任何 UI/API 可設，只能改 `data.json`：把 3 台 slot 的 `mapping_status` 設 `confirmed`
   - 前提：使用者確認「3 台 node_id 對應實體正確」
   - node_id 是 `f(chassis_id, slot)` 自動生成（`node_identity.canonical()`），拿掉會自動長回來
     （`setdefault`），**無法靠刪除繞過**，只能明確設 `confirmed`

5. **Profile 數量刪除（後端，使用者說「多餘可刪」）**
   - 現況：`freeze()` 把 profile 的數量 `CPU_MIN=2…` **注入** config.sh 的 `# PROFILE_PARAMETERS`，
     bash 後者覆蓋前者 → **實際數量以 Profile 為準**（使用者以為 config.sh 為準）
   - 使用者要：**config.sh 當唯一數量來源** → `freeze()` 不再注入數量（保留 `PROFILE_*_ENABLED/_MODE`？待定）
   - ⚠️ 注意：`PROFILE_*_ENABLED/_MODE` 開關/模式也來自 profile，config.sh 靠它決定要不要檢查
   - 動作表（reboot/aux 執行方式）**不在 config.sh**，在 profile → 若要整個拔 profile 需搬家（= aux 那題）

6. **aux cycle 依專案（未做，AGENTS.md 有記）**
   - aux 寫死在 `integration/profiles.py:30` + `engine/vera_cycle/cycle_engine.py:550`
     （`/usr/bin/stbypowerctrl.sh aux_cycle`，BMC standby）
   - 使用者：有些專案 aux 接 **PDU** → 要依專案不同
   - 待確認：PDU 實際指令/transport；是否放寬 `validate()`（安全）；格式（json vs txt）

7. **hostname 精緻版（未做）**
   - 建 job 時現場抓 os/bmc hostname → 寫回該 node 的 `os[slot]`（覆蓋）→ 抓失敗擋住
   - 已做：`add_machine` 存 hostname、Neutrino 3 台已補

---

## 重要背景（避免踩雷）
- **Profile 是什麼**：一個專案的 cycle 驗證設定包（期望值 8 項 + 動作表 + checker 指向）。這台
  `cycle_profile=None` → fallback 內建 neutrino profile。使用者覺得多餘：因為數量其實 config.sh 也有。
- **BMC log 因廠牌而異**（AGENTS.md 有記）：
  - NVIDIA(155)：`ipmitool sel`=真 SEL（空）；cycle 事件在 **Redfish Event log**
    `/redfish/v1/Systems/System_0/LogServices/EventLog/Entries`
  - Wistron(145)：`ipmitool sel`≈event；Redfish id 是 `system`/`bmc`
  - Redfish base 因廠牌不同 → 先 `GET /redfish/v1/Systems`、`/Managers` 探 id
- **data.json = `data/pa6969/data.json`**（6969 inventory 來源，gitignored）
- 改完 `integration/**` 或 `app/**` 要**重啟 web**；改前端 JS 要**bump cache-buster**

---

## 待 commit（本輪所有改動）
`integration/web.py`、`app/static/js/cycle-workspace.js`、`app/static/js/cycle.js`、
`app/static/index.html`、`AGENTS.md`（+ 之後的 targets.py 等）。尚未 commit / push。
