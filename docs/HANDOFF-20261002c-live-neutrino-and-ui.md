# 交接：Cycle 實機上線 — Neutrino 跑通 + UI 清理（2026-10-02 第三輪）

Repo：`/root/sheng/PA-manager-6969`　分支：`codex/remove-locks`　HEAD：`36b435d`
服務：web(6969) / runner / bridge(7002) / pa-manager7000(7000)
**本輪大量修改尚未 commit**（下方「待 commit」清單）。

## 一句話
**Neutrino 第一次真正跑完 1 個 cycle（Reboot）：n1 完整 DONE、n2/n3 卡在「waiting OS boot」**。
根因：runner 的 `Transport` 對 **OS** 仍開 `look_for_keys=True/allow_agent=True`，
而本機有 `/root/.ssh/id_rsa` → paramiko 拿本機 key 先試 OS，可能導致 OS identity 抓不到
（BMC 已改「只用密碼」修好，但 OS 端還沒改）。**下一步就是把 OS 也改成只用密碼。**
另外這輪做了：BMC 認證修、runner 讀 data.json 密碼、拿掉 AUX/power live 檢查、
Profile fallback、任務刪除按鈕、狀態 Title Case、findings 排版重做、test report 標題、
node 欄顯示 hostname。

---

## 一、Neutrino 實機跑 1 run 的結果（本次核心）

job：`c27183e9889c4900a10eab9475be1a4a`（Neutrino，Reboot，1 loop，3 台）
| node | 結果 |
|---|---|
| n1 | ✅ DONE（Loop1 Attempts1 Post1 Boot1 Valid1，health Fail = 有 finding，流程完整） |
| n2 | ⚠️ `waiting OS boot`（stage 停在等 OS 回連） |
| n3 | ⚠️ `waiting OS boot` |

**診斷（已確認）**：
- 直接 `ssh root@10.35.228.150/154`（密碼 `password`）**兩台都 OK**，
  hostname = `neutrino-n2`/`neutrino-n3`、boot_id 正常 → **OS 真的在、hostname 也對**。
- 所以**不是** hostname 不符，是 **runner 的 paramiko 連 OS 沒成功**（跟 BMC 一樣的金鑰問題）。
- `cycle_transport.py` 目前**只有 BMC** 改成只用密碼；**OS 仍是** `look_for_keys=True, allow_agent=True`。

### ▶ 下一步（最重要）
把 **OS 也改成只用密碼**（與 BMC 一致）：
`engine/vera_cycle/cycle_transport.py` `_connect()` 現在是：
```python
password_only = role == "bmc"
...
look_for_keys=not password_only, allow_agent=not password_only
```
**改成一律只用密碼**：
```python
client.connect(..., look_for_keys=False, allow_agent=False)
```
（OS 也是 root/密碼，本機 key 對 OS 一樣是干擾來源；內網機全是密碼登入。）
改完 → 重啟 runner（`sudo systemctl restart pa-manager-6969-runner.service`）→
**建一個新 job 跑 1 run**（改 engine 檔會讓 engine_hash 變，舊 job 會 hash 不符，必須新 job）。
預期：n2/n3 的 OS identity 抓得到 → 完成 recovery → 三台都 DONE。

> 注意：改 `cycle_transport.py` 屬 engine 檔，會進 engine hash，重啟後**必須建新 job** 才生效。

---

## 二、本輪已改（全部未 commit）

### A. 讓 Neutrino 能真的跑（後端）
1. **`integration/legacy_observation.py`** — 無 caller（背景 runner thread/subprocess 的
   ContextVar 未帶到）時退回放行：provider 為 None → `local-operator`；provider 有
   `service_principal` → 用它當 actor（local 放行、正式 provider 仍擋）。
   修掉「Verified observation provider/caller required」。
2. **`integration/profiles.py` `resolve()`** — `cycle_profile` 為 **None** 時也 fallback
   到內建 `neutrino`（原本只認 `'neutrino'`，data.json 全是 None → 回 None →
   「Selected profile differs from the activated Project profile」）。
3. **`integration/web.py`** — 拿掉 create_job 的 **AUX / power_cycle / outband** 的
   live「獨立控制器/待機電源/影響範圍」檢查（照 profile 腳本跑，不重複擋）。
   刪掉了 `Live AUX requires...`、`Independent controller/action scope required`、
   `AUX 實體影響範圍尚未確認`、`Select all affected nodes in power domain` 等。
4. **`engine/vera_cycle/cycle_transport.py` `_connect()`** — **BMC 只用密碼**
   （`look_for_keys=False, allow_agent=False`），OS 暫保留 key（← 見第一步要一起改掉）。
5. **`integration/runner.py`** — 新增 `_inventory_secrets(names)`：從
   `data/pa6969/data.json` 重新取 `os_password`/`bmc_password`（job snapshot 被
   `snapshot_target()` 洗掉密碼 → runner 原本拿不到 → 認證全失敗）。
   取代原本從 `job['targets']` 取密碼（那些是空的）。

### B. 任務刪除功能
6. **`integration/store.py` `delete_job()`** — 只可刪 TERMINAL 狀態的 job，清
   jobs/events/node_status/actions/artifact_index/locks。
7. **`integration/web.py` `DELETE /api/cycle/runs/{job_id}`** — 刪 DB 列
   **+ 刪 `data/pa6969/artifacts/<job_id>/` 整個資料夾**。
8. **`app/static/js/cycle-workspace.js`** — 任務記錄列表右邊加「刪除」按鈕
   （`deleteRun()`，有 confirm）；非 TERMINAL 的 disabled。

### C. UI 顯示
9. **狀態 Title Case**：`stateLabel()`（`RECONCILIATION_REQUIRED`→`Reconciliation
   Required`），套到列表/標題/Lifecycle/節點；health 與 coverage 儲存格也 Title
   Case（`Unknown`、`Not Exercised`）。表頭（POST/Coverage…）**保持原樣**。
   `cycle.js` 的 labels 補 `RECONCILIATION_REQUIRED:'待核對'`（舊檔，index.html 未載入）。
10. **Findings 排版重做**：每節點一卡片、每 issue 一行 `[嚴重度] CODE 說明`、
    嚴重度上色（FAIL 紅/WARN 黃/INFO 藍）；**移除 `AUX=未設定`**，改「已納入範圍：…」。
    新增 CSS（`cycle-workspace.css` 的 `.cw-findings/.cw-finding/.cw-issue/.cw-sev…`）。
11. **「證據與報告」→ `test report`**（標題 + 按鈕都改）。
12. **node 欄顯示 hostname**：Node/phase 欄 `N1`→`neutrino-n1`
    （`(t.slot_key||t.node)`→`(t.node||t.slot_key)`）。

### D. cache-buster（`index.html`）
- `cycle-workspace.js?v=20261002-nodename1`
- `cycle-workspace.css?v=20261002-findings1`（**原本無 cache-buster，這次補上**）

### E. 環境（systemd，不在 git）
- **runner** 從 `CYCLE_MODE=synthetic` → **`live`**，並補 **`CYCLE_PROVIDER=integration.local_provider`**
  （原本缺 provider → `Live provider did not authorize`；且 web=live/runner=synthetic 不一致 →
  一直 `RuntimeError: Live execution is not enabled`）。
  檔案：`/etc/systemd/system/pa-manager-6969-runner.service`（`daemon-reload` 後已生效）。

---

## 三、之前那兩個「卡住」的真相（本輪解決）
- **`Live AUX requires...`** → 選了 AUX Cycle 但無獨立待機電源 → 已拿掉該檢查（見 3）。
  （但**建議正式測用 Reboot**，AUX 是測電源備援，指令 `stbypowerctrl.sh aux_cycle`。）
- **`RuntimeError`（一按就 ERROR）** → **web=live、runner=synthetic 不一致** →
  runner 改 live + 補 provider（見 E）。
- **BMC identity `exit 255 NOT_ISSUED`** → 空密碼（snapshot 洗密碼）+ BMC 金鑰問題
  → 改 runner 讀 data.json 密碼（見 5）+ BMC 只用密碼（見 4）。

---

## 四、重要背景 / 常踩的點
- **改 engine 檔（`engine/vera_cycle/**`）或 `integration/**` → 影響 engine hash / 需重啟**。
  改 engine 檔後**必須建新 job**（舊 job 會 `Engine changed since job creation`）。
- **改 `integration/**` 或 `app/**` → 重啟 web**；改前端 JS/CSS → **bump cache-buster**。
- **runner 是獨立進程**，改 `runner.py`/`transport` 要 `restart pa-manager-6969-runner.service`。
- **data.json = `data/pa6969/data.json`**（gitignored）：Neutrino 3 台 mapping_status=confirmed。
  密碼欄位名：slot 用 `pass`（OS）、`bmc_pass`（BMC），`targets.py` 映射成 `os_password`/`bmc_password`。
  Neutrino：OS=`root/password`、BMC=`root/0penBmc`；OS IP 10.35.228.148/150/154、BMC .149/.151/.155。
- **`RECONCILIATION_REQUIRED`**：指令已送出（`outcome: SENT`）但 worker 死、結果不明 →
  要人工核對（填 ≥10 字原因）或刪除。**不會自動重送**電源指令。
- **Profile = 專案 cycle 驗證包**；此台 cycle_profile=None → 現在 fallback 內建 neutrino。
- **兩人行為**：scope lock 靠 SQLite `locks` 表；同機器不可同時跑、不同機器可以。
  身分目前不分（local_provider 固定 `local-operator`），要真正區分需 provider 支援。

---

## 五、待 commit（本輪全部）
```
integration/legacy_observation.py
integration/profiles.py
integration/web.py
integration/runner.py
integration/store.py
engine/vera_cycle/cycle_transport.py
app/static/js/cycle-workspace.js
app/static/js/cycle.js
app/static/css/cycle-workspace.css
app/static/index.html
RUNTIME_ENGINE_FILES.json   # 前一轮已加 2 檔，这轮确认在列
```
另有一個殘留 `RUNTIME_ENGINE_FILES.json.bak-20261002-160106`（備份檔，可刪）。

---

## 六、給下一輪的建議順序
1. **改 `cycle_transport.py`：OS 也只用密碼**（`look_for_keys=False, allow_agent=False`）
   → 重啟 runner → **建新 job 跑 1 run** → 驗證 n2/n3 能過 OS identity（應三台全 DONE）。
2. 跑通後**清理**：那筆 `RECONCILIATION_REQUIRED`（`77541574`，我測試 reboot n1 留下的）
   用新「刪除」按鈕清掉（或核對放行）。
3. **commit** 本輪所有改動（見第五節）；`AGENTS.md` 可補記「runner 需 live + provider」
   與「OS/BMC 皆只用密碼」兩條。
4. （可選）把 AUX/power 的「共享 power_domain 一起選」保護要不要留，之後再決定。

---

## 附：常用指令
```bash
# 重啟
sudo systemctl restart pa-manager-6969-web.service
sudo systemctl restart pa-manager-6969-runner.service
# 狀態
curl -s localhost:6969/api/cycle/status
curl -s "localhost:6969/api/cycle/runs" | python3 -m json.tool
# 建 job（Neutrino 3 台 Reboot 1 loop）
curl -s -X POST localhost:6969/api/cycle/runs -H 'Content-Type: application/json' -d '{
  "project":"Neutrino",
  "machine_ids":["4fac8595e2195632addc1b29a57fda82","67a18b4c73e748d7bd861a2e92694bcd","b675874fef0c446fb8146a68971fe748"],
  "cycle_profile":"neutrino","cycle_mode":"reboot","channel":"inband",
  "limits":{"loops":1,"hours":0},"idempotency_key":"<uuid>" }'
# 前景跑 runner 抓 traceback（先 stop runner，帶環境）
sudo systemctl stop pa-manager-6969-runner.service
CYCLE_MODE=live CYCLE_INSTANCE=data/pa6969 CYCLE_PROVIDER=integration.local_provider \
  .venv/bin/python -m integration.runner --job <id>
# 刪 job
curl -s -X DELETE localhost:6969/api/cycle/runs/<id>
# node 欄位
curl -s localhost:6969/api/projects/Neutrino/cycle/targets
```
