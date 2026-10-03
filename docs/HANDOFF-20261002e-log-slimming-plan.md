# HANDOFF 2026-10-02e — Log 瘦身計畫（PA-6969 + vera）

> 狀態：**計畫待確認**（尚未修改任何程式碼）
> 目標：在**不損失「整機完整 check」可見性**的前提下，壓縮 cycle 產出的 log 容量。

---

## 0. 背景與目標

生產環境：L11 rack，**128 hosts × 500 cycles**。現有 log 過大（推算 ~115 GB）。
使用者最終要求：

1. **完整資訊要看得到**——「整機完整 check」以 `hardware.txt` 為準（它已包含 CPU/DIMM/NVMe/MST/PCIe/BIOS + 判定）。
2. **只簡化輸出**，不刪除「唯一來源」的資訊。
3. 改動要同步 **3 份**（見 §7）。

---

## 1. 現況盤點（真機資料，單一 loop）

來源：`data/pa6969/artifacts/3e0230c0816e404d933dff4893d794ad/Neutrino_neutrino-n1/loop0001/`

| 檔案 | 單檔大小 | 誰產生 | 內容 |
|---|---|---|---|
| `hardware.txt` | 291 KB | `bash neutrino_config.sh`（all mode） | **整機 check 完整包**：PCI-inventory / CPU / CPU-online / DIMM / OS-memory / NVMe / MST / **PCIe-links（lspci -vvv, 4766 行）** / BIOS-firmware / [Pass]/[Fail] |
| `dmesg_clear.txt` | 284 KB | `dmesg -c` | 核心環形緩衝（讀+清） |
| `dmesg.txt` | 283 KB | `dmesg` | 核心環形緩衝（**與 `-c` 99.9% 相同**：3937/3940 行） |
| `pci_verbose.txt` | 266 KB | `lspci -Dvvv`（引擎 CAPTURES） | PCIe 完整樹（27 裝置） |
| `report.json` | 107 KB | 引擎每圈 | 單圈完整記錄（**= campaign.json nodes[].loops[] 100% 重複**） |
| `sensor.txt` | 29 KB | `sensor list` | 感測器 |
| `pci_config.txt` | 24 KB | `lspci -Dxxx` | config space |
| `pci.txt` | 2 KB | `lspci -Dnn` | 裝置清單（一行/裝置） |

### 1.1 Job 層級（total，3 台 × 33 圈）

| 檔名 | 總容量 | 檔案數 |
|---|---|---|
| `cycle_summary.json` | 29.3 MB | ×1 |
| `campaign.json` | 29.1 MB | ×1 |
| `hardware.txt` | 28.1 MB | ×99 |
| `dmesg_clear.txt` | 27.5 MB | ×99 |
| `dmesg.txt` | 27.4 MB | ×99 |
| `pci_verbose.txt` | 25.7 MB | ×99 |
| `report.json` | 23.3 MB | ×102 |

---

## 2. 已驗證的「重複」關係（真機實測）

| 重複對 | 證據 | 可去 |
|---|---|---|
| `dmesg.txt` ≈ `dmesg_clear.txt` | 3937/3940 行相同（99.9%） | ✅ |
| `hardware.txt`[PCIe-links] ≈ `pci_verbose.txt` | 同為 lspci `-vvv`；hardware 版 4765 行 / pci_verbose 版 4739 行，內容 99% 相同 | ✅（二選一） |
| `campaign.json` ⊂ `cycle_summary.json` | `cycle_summary = {**campaign, "summary": result}`；summary 只佔 1.23%（248 KB / 20 MB） | ✅ |
| `report.json` ⊆ `campaign.json` | 34/34 欄位完全相同 | ⚠️ 見 §5 |
| `pci.txt` 不重複但**不含 link 細節** | `-Dnn` 只有一行標題，**無 LnkCap/LnkSta/Express** | 保留（小） |

### 2.1 重要澄清（pci_verbose 的角色）

- 引擎**判定**用 `link_check`（在 config.sh 內，吃 config.sh 自己撈的 `lspci -Dvv`）——**不讀 `pci_verbose.txt`**。
- 引擎**報告 4 行**用 `parse_pci_verbose(result.output)`（**記憶體 output**）——**不讀檔案**。
- `pci_verbose.txt` **唯一用途 = 報告 Evidence 欄的超連結**（給人點開看）。
- **沒有任何程式碼「重新讀取」`pci_verbose.txt` 的內容**（已 grep 驗證）。

→ 因此 `pci_verbose.txt` 可安全精簡為 endpoint-only，**前提**：報告 Evidence 連結改指向 `hardware.txt`（見 §3-變更4）。

---

## 3. 變更清單（4 項程式變更 + 1 項腳本變更）

### 變更 1 — dmesg 只留 `-c`

- **檔案**：`engine/vera_cycle/cycle_engine.py`
- **位置**：`collect_dmesg()`（L288）與呼叫點 L312（`self.collect_dmesg(record, 'dmesg')`）
- **做法**：POST 收集階段不再另存 `dmesg.txt`（`dmesg` 讀），只保留 `dmesg_clear.txt`（`dmesg -c`）。
- **注意**：需保留 `collect_dmesg` 的**解析行為**（dmesg 事件偵測），只是**不寫 `dmesg.txt` 證據檔**。→ 以 `save_evidence=False` 或改寫檔名策略。
- **風險**：低。`dmesg -c` 內容 = `dmesg` 內容 + 清空。
- **省幅**：~17 GB

### 變更 2 — `cycle_summary.json` 只留 summary

- **檔案**：`engine/vera_cycle/cycle_report.py` L657
- **現況**：`write_json(root / "cycle_summary.json", {**campaign, "summary": result})`
- **做法**：只寫「頂層摘要欄位 + summary」，**不重存 `nodes[].loops[]`**。
  - 保留：`run_id/job_id/project/started/finished/tool_version/state/stop_reason/cycle_mode/channel/limits/script_sha256/summary` + `nodes[].{key,completed,blocked,...}`（去掉重量級 `loops[]`）
  - 或改為 `{"summary": result, "campaign_ref": "campaign.json"}`。
- **注意**：`test_cycle.py::test_campaign_reports_are_consistent_and_escaped` 讀 `data['state']`、`data['summary']['health']`、`data['nodes'][0]['completed']`、`data['nodes'][0]['pre']['issues'][0]` → **必須保留這些欄位**（或同步改測試）。
- **風險**：低（`cycle_summary.json` 只被**一個測試**讀，App 不讀）。
- **省幅**：~18 GB（每 job 29 MB → ~0.25 MB；128 台若同一 job → 一次省 ~29 MB，屬 job 級非 per-host）

### 變更 3 — `pci_verbose.txt` 只留 endpoint

- **檔案**：`engine/vera_cycle/cycle_engine.py`
- **位置**：`command()` 寫證據處（L200-206）與 `capture()` 的 `pci_verbose` 分支（L328-330）
- **做法**：
  - **記憶體 `result.output`（全量）照舊** → 餵 `parse_pci_verbose` 判定/報告（**不改**）
  - **寫檔時**對 `pci_verbose` stem 套用過濾 → 只寫 endpoint 區塊
  - 新增過濾函式 `filter_pci_verbose(text)`，**判定規則必須與 `parse_pci_verbose` 完全同源**（Express Endpoint / Integrated Endpoint / Event Collector + 需有 `LnkSta`），避免漏殺。
- **紅線**：過濾後的內容**絕不可餵 `link_check`**（→ `PCIE_INVENTORY_UNSTABLE` 假警報）。本次設計**不碰** link_check 的輸入。
- **風險**：中（過濾器正確性）。
- **省幅**：~15 GB（266 KB → ~14 KB）

### 變更 4 — 報告 PCIe Evidence 連結改指 `hardware.txt`

- **檔案**：`engine/vera_cycle/cycle_report.py`
- **位置**：`_pci_link_evidence()`（L302）與 L380 `evidence=...pci_verbose...evidence`
- **做法**：Evidence 連結優先指向 `hardware`（若存在），fallback `pci`。
- **理由**：變更 3 後 `pci_verbose.txt` 只含 endpoint；完整 PCIe 在 `hardware.txt`。
- **風險**：低。

### 變更 5 — config.sh 三次 lspci 合併為一次 `lspci -Dvvv -nn`

- **檔案**：`neutrino_config.sh`（3 份，見 §7）
- **現況**（真機驗證）：
  | 行 | 指令 | 用途 | 印到 |
  |---|---|---|---|
  | L214 | `lspci -Dnn` | PCI inventory | `[Evidence] PCI-inventory` |
  | L163 | `lspci -Dvv` | link_check 判定 | `[Evidence] PCIe-links` |
  | L123 | `lspci -Dvvv` | BF4 VPD serial | `[Evidence] BF4-identity` |
- **做法**：改為**只撈一次** `lspci -Dvvv -nn`，三個消費端共用同一份輸出：
  - `link_check` 吃該份（regex 為「行首 BDF」比對，`-vvv` 每區塊首行符合 → 相容）
  - BF4 identities 吃該份（含 `[SN] Serial number:`）
  - PCI-inventory 從該份萃取「每個裝置首行」即可（`-Dvvv -nn` 首行含 BDF + `[class]` + `[vendor:dev]`）
- **真機驗證結果**（10.35.228.148，已跑）：
  - `lspci -Dvvv -nn` = 4738 行 / 272,966 bytes
  - ① BDF+class：27 裝置 ✅（與 `-Dnn` 一致）
  - ② Express/LnkSta：✅
  - ③ Serial number：✅（`[SN] Serial number: ...`）
- **風險**：**中**——`link_check` 的輸入格式由「純 `-vv`」變成「`-vvv -nn`」；需回歸測試 `PCIE_INVENTORY_UNSTABLE`、endpoint 判定、BF4 判定。
- **效益**：**執行時間**（3 次 → 1 次 lspci）+ `hardware.txt` 少量縮減。**主要非省容量**。

---

## 4. 預期效益（128 hosts × 500 cycles 推估）

| 變更 | 省幅 | 資訊損失 |
|---|---|---|
| 1. dmesg 只留 `-c` | ~17 GB | 無 |
| 2. cycle_summary 只留 summary | job 級 ~29 MB/次 | 無（campaign 有全） |
| 3. pci_verbose endpoint-only | ~15 GB | **bridge/VGA 的 lspci 細節**（改由 `hardware.txt` 提供） |
| 4. 報告連結改指 hardware | - | 無（連結仍有效） |
| 5. config.sh 合併 lspci | 執行時間 | 無 |
| **合計** | **~32 GB+（約 28%）** | 完整 check 仍可從 `hardware.txt` 取得 |

> 註：若之後也要精簡 `hardware.txt`（變更 6，**本計畫不含**），可再省 ~13 GB，但會**失去唯一完整 lspci 來源**——本次不做。

---

## 5. 明確「不做」的項目（保留）

| 檔案 | 理由 |
|---|---|
| `campaign.json` | crash recovery journal（`runner.py:444 recover()` 讀它）|
| `report.json` | crash recovery + rebuild 讀 `loop*/report.json`（`cycle_report.py:700`, `runner.py:452`）|
| `hardware.txt` | **使用者的「整機完整 check」唯一來源** |
| `CYCLE_REVIEW_REPORT.html` | 最終報告 |
| `dmesg_clear.txt` | dmesg 保留版 |
| `pci.txt` | 裝置清單（小，且變更 4 會用到）|

---

## 6. 驗收標準（改完後要驗）

1. `engine/vera_cycle/dev/tests/` 全綠（現況 126 passed, 53 subtests）。
2. `test_campaign_reports_are_consistent_and_escaped` 需同步調整（變更 2）。
3. **真機**跑 1 圈，確認：
   - `dmesg.txt` 不再產生；`dmesg_clear.txt` 存在。
   - `pci_verbose.txt` 只含 endpoint 區塊。
   - 報告 4 行 PCIe 表**與改前一致**（device_name/class/link/result）。
   - 報告 Evidence 連結可開（指向 `hardware.txt`）。
   - `link_check` 結果不變（無 `PCIE_INVENTORY_UNSTABLE`）。
   - `hardware_checks`（PCIE_LINK/...）不變。
4. `cycle_summary.json` 仍能被測試/工具讀取所需欄位。

---

## 7. 要改的副本（⚠️ 待使用者確認「哪 3 份」）

目前磁碟上有 **4 個**獨立副本：

| 副本 | 路徑 | 行數 | sha256(前12) | mtime |
|---|---|---|---|---|
| **A** | `/root/sheng/PA-manager-6969/engine/vera_cycle/` | 238 | `27fd56d76220` | 2026-10-02 23:15 |
| **B** | `/root/sheng/pa-cycle-lab/engine/vera_cycle/` | 211 | `4a54125f4663` | 2026-10-01 09:40 |
| **C** | `/root/sheng/vera-cycle/` | 220 | `f8fa49902f64` | 2026-10-02 15:39 |
| **D** | `/root/vera-cycle/` | 220 | `f8fa49902f64` | 2026-10-02 15:39 |

> C 與 D 同 sha（`f8fa4990`）。使用者聲稱要改「3 份：6969 + sheng/vera-cycle + ？」。
> **待確認**：第三份是 B（pa-cycle-lab）還是 D（/root/vera-cycle）？

### 各副本需改的檔案

| 變更 | PA-6969 (`A`) | sheng/vera-cycle (`C`) | 根 vera-cycle (`D`) / pa-cycle-lab (`B`) |
|---|---|---|---|
| 1 dmesg | `cycle_engine.py` | 同 | 同 |
| 2 summary | `cycle_report.py` | 同 | 同 |
| 3 pci_verbose | `cycle_engine.py` | 同 | 同 |
| 4 報告連結 | `cycle_report.py` | 同 | 同 |
| 5 config.sh | `neutrino_config.sh` | 同 | 同 |

> ⚠️ 各副本的這些檔案**內容版本不同**（如 config.sh 行數 238/211/220），**不能無腦覆蓋**——需逐份套用同一邏輯。

---

## 8. 執行順序建議

1. **先在 PA-6969 (`A`) 落地全部變更** + 跑測試 + 真機驗 1 圈。
2. 驗收通過後，**逐份套用到 C、D（/ B）**。
3. 每份套用後跑該副本的測試。
4. **不要**在驗收前改 3 份（避免同時壞）。

---

## 9. 未解問題（Open Questions）

1. **第三份副本**是 B 還是 D？（§7）
2. 變更 2 的 `cycle_summary.json` 新格式：**A) 保留節點摘要去掉 loops** / **B) 只寫 summary + 引用 campaign.json**？（建議 B）
3. 變更 1 的 dmesg：**A) 完全不寫 `dmesg.txt`** / **B) 寫但內容指向 `-c`**？（建議 A）
4. 變更 5 的 `-Dnn` inventory：**從 `-Dvvv -nn` 萃取首行** 是否可接受（BDF/class/vendor 皆一致）？

---

## 10. 現況測試基線

- `engine/vera_cycle/dev/tests/`：**126 passed, 53 subtests passed**
- 相關新檔：`dev/tests/test_pci_endpoint_table.py`（7 tests）
- 本計畫**尚未**修改任何程式碼。
