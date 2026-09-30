# Window-14 — di 1684..1883 review (PENDING — 修補已定義並驗證, W15 來 APPLY)

> Window: 2026-08-18 (W14 視窗, 用戶 go 後一次完成 S1–S3, S4–S8 交棒 W15)
> 上一視窗: `SESSION_HANDOFF_WINDOW13_APPLY_W12_1384_1683_DONE.md` (W13 DONE, 已讀)
> 備份 (S1 完成): `data/REVISED_commands_merged_with_raw.xlsx.bak_batch_20260905_w14pre`
>   — 現 xlsx 仍是 W13 DONE 基線, md5 `d668c3b4bef7d2a485e20c19e6c3a3c4` (與 _w14pre 一致, S1 已核)
> 修補腳本 (S2/S3 完成, **未在 repo xlsx 上跑過**): `/root/w14_fix.py`

---

## 1. 本視窗做了什麼

### 1.1 範圍 (S2)

- Functional sheet data_index **1684..1883** (200 rows)
- di 1684 = **Wistron-BMC-00958-V003** → di 1883 = **Wistron-BMC-00974-V002** (單 family BMC + 中段 HW 區)
- 下下批 W15 cursor: di 1884

### 1.2 審計結果 (S2, 全 200 行已逐行讀過 — raw dump 在 `/tmp/w14_window.txt`)

| Cat | 行數 | 說明 | 修法 |
|---|---|---|---|
| **A** bare `sensor get 'X'` | **72** | di 1684 + 1690..1720 + 1830/1831 + 1846..1883。ssh 內嵌層是裸 `sensor get 'TEMP_…'`, 漏 `ipmitool` 前綴 → DUT 上直接 `command not found` (與 W9 di 857-866 同款 R29 假命令, 當時漏修)。judge 全 YES | **整行改 OOB**: `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'X' 2>&1` (W9 di=867-869 已交付的 template, 同庫一致) |
| **D** `\$ACC_ID` | **1** | di 1689 (Wistron-BMC-00963-V003, curl DELETE)。`\$ACC_ID` 轉義後 URL 命中字面 `$ACC_ID` → 永遠 400/404 | R7: `${ACC_ID:?operator must provide the numeric account ID to delete (see GET /redfish/v1/AccountService/Accounts)}` |
| **B** `<DUTY>` | **1** | di 1743 (Wistron-HW-00377-V003), `raw 0x30 0x31 0x01 <DUTY>` exec 位裸占位 | R7: `${FAN_DUTY_HEX:?operator must set 0x00-0x64 hex byte, see manual}` (R30: 訊息內無反引號/雙引號, 已避) |
| **E** 漏 `sudo` | **14** | di 1797-1807, 1810, 1812, 1813。i2cdetect / i3cdetect DUT 內執行, R26 (os_user 不一定 root)。1714 已有 sudo 不碰 | 每個 i2cdetect/i3cdetect 實例前補 `sudo` (1797 行 3 處全補, 已核) |
| **C** `2>&1 2>&1` | **7** | di 1726/1727/1729/1738/1748/1750/1753 表面層重複 | dedup → `2>&1` |

**總計 95 cells (95 di), 全部只動 `ai_commands` 一欄。0 改 ai_can_execute / risk / ai_packages_needed / ai_logs_output。**

### 1.3 KEEP 護欄 (已核, 不改)

- di 1742 / 1743 (Wistron-HW-00376/00377): 被包內容是 OOB lanplus 但 **巢狀引號** (`-H "$BMC_IP"` + `;` 多指令) → 依 W13 巢狀引號規則 **不 strip**, 保留 ssh 外殼。1743 另補 `<DUTY>` (B)。
- 其餘 DUT-local 行 (dmidecode / lspci / nvme / lsblk / stress-ng / i2c / i3c / dmesg / uptime 等 ~100 行) 全 KEEP 外殼, 0 動。
- **in-band ipmitool (無 `-I lanplus`) 0 碰。**
- OOB-direct 12 行 (1688/1689 curl redfish + 1828..1840 ipmitool lanplus 已在 agent host) 無 wrapper, 不需 strip; 1689 只修 D。
- 85 行 NO/`-- not runnable` (物理/視覺/GPU 顯卡/編解碼 等) 維原判定, 0 動 (保守優先)。
- 1688 `POST /AccountService/Accounts` (建帳號, 字面 testuser/ChangeMe123) — PARTIAL, 判定不改, 命令留作「operator 決定要跑時長這樣」參照, 不碰。

### 1.4 DRY + sandbox 全跑驗證 (S3)

```
DRY=1 python3 /root/w14_fix.py
== DRY-RUN ==  changed cells: 95
  A bare-sensor->OOB     : 72
  B/D R7 placeholder      : 2
  E sudo i2c/i3cdetect   : 14
  C cosmetic 2>&1 dedup  : 7
changed di: [1684,1689,1690..1720,1726,1727,1729,1738,1743,1748,1750,1753,
             1797..1807,1810,1812,1813,1830,1831,1846..1883]   (95 di)

# sandbox 全跑 (repo xlsx 的 /tmp 副本, 非 repo 本體):
python3 /tmp/w14_fix_sandbox.py
== APPLY ==  changed cells: 95   (同上分類 72/2/14/7)
Saved -> /tmp/w14_sandbox.xlsx
post-audit issues: NONE ✓
```

8 行 before/after 手動 preview 全正確 (1684/1689/1726/1743/1748/1797/1813/1865), 例:

```
1684 OLD: sshpass -p "$DUT_PASS" ssh ... "sensor get 'TEMP_GB_GPU1~8'"
1684 NEW: ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'TEMP_GB_GPU1~8' 2>&1

1797 NEW: ... "echo ---i2c_buses---; sudo i2cdetect -l 2>&1; ... $(sudo i2cdetect -l ...); do sudo i2cdetect -y $b ..."
            (3 處 i2cdetect 全 sudo, non-sudo=0 已核)
```

**repo 的 xlsx 未動** — 本視窗到 S3 為止, S4–S8 交 W15。

---

## 2. 最終狀態 (W14 視窗結束時)

| 項目 | 值 |
|---|---|
| **APPLY 狀態** | **NOT APPLIED** (PENDING; 95 cells 已定義 + DRY + sandbox self-audit NONE) |
| 修補腳本 | `/root/w14_fix.py` (DRY=1 dry / 直接跑 apply+S4 self-audit) |
| xlsx md5 | `d668c3b4bef7d2a485e20c19e6c3a3c4` (W13 DONE 基線, 未動) |
| 備份 | `data/…xlsx.bak_batch_20260905_w14pre` (同 md5, S1 已記) |
| git HEAD | `2a109d5` — **未 stage / 未 commit / 未 push** |
| 全庫進度 | **di 0..1683 已交付 = 1684/2291 (73.5%)**; di 1684..1883 已 review 待 APPLY (交付後 1884/2291 = 82.2%) |

---

## 3. W15 接棒: APPLY W14 修補 (di 1684..1883) + REVIEW di 1884..2083

### 3.1 STEP A — APPLY W14 已定義的 95 cells (S4–S7)

用戶授權 go 後一次跑完:

1. **S4 APPLY**: `cd /root/sheng/manager/pa_manager && python3 /root/w14_fix.py`
   (腳本內建 save + self-audit; 期望輸出 `changed cells: 95` + `post-audit issues: NONE`)
   若 post-audit 非 NONE → 先停, 對照 §1.2 表逐行查, 不強推。
2. **S5 零回歸**: `REVISED_commands_merged_with_raw.xlsx` vs `…_w14pre`:
   期望 **只 Functionality.ai_commands 動 95 cells**, 其餘 5 sheets + 17 欄 0 diff;
   ai_can_execute / risk / ai_packages_needed / ai_logs_output 0 diff。
   KEEP 行抽查 (1742/1730/1766/1800/1828) 0 diff。
3. **S6 build + 三向 md5**:
   `python3 scripts/build_testlib_json_xlsx.py data/REVISED_commands_merged_with_raw.xlsx /tmp/w15_tests_build.json`
   期望 3112 / 6 sheets; `cp` 兩份到 `/srv/pa-manager-prod/data/tests.json` + `data/tests.json`, 三向 md5 全一致 (repo==prod==/tmp)。
4. **S7 spot-check ≥13 行** xlsx == tests.json `ai_commands` 完全一致, 建議含:
   1684 (A 改 OOB), 1720 (A 尾), 1846/1883 (A 區尾), 1689 (D), 1743 (B + KEEP 外殼保留),
   1726/1753 (C), 1797/1813/1806 (E sudo), 1730 (KEEP 未動), 1742 (KEEP 巢狀引號),
   1828 (OOB-direct 未動), 1685 (NO 未動)。

### 3.2 STEP B — 繼續 REVIEW di 1884..2083 (200 行) 口徑與 SOP

(與 W10–W14 完全相同)

- 規則: `REVIEW_WORKFLOW_LOGIC.md` (R5/R6/R7/R18/R19/R22/R24/R26/R27/R28/R29/R30)
- 判定: YES/PARTIAL/NO + defect worklist; **保守優先**, 0 改 ai_can_execute
- 修補: **只動 `ai_commands` 一欄**
- R28 ID 對照: `data/11.RestAPI/` + `data/12.RestAPI/` (Systems/system, Managers/bmc…)
- KEEP 護欄: DUT-local (dmidecode/nvidia-smi/stress-ng/in-band ipmitool/UEFI shell/uptime/i2c/i3c/lsblk/nvme/lspci…) 的 ssh 外殼保留; 巢狀引號行不 strip
- S29 audit 重點: bare `sensor get` / `chassis` / `sdr` 漏 ipmitool (本窗口正抓了 72 行, 下窗口很可能還有同類殘骸)
- SOP: S1 備份 `…_w15pre` → S2 審計 → S3 DRY → S4 APPLY+self-audit → S5 零回歸 → S6 build+三向 → S7 spot-check → S8 交棒
- **W16 cursor: di 2084** (W15 交付 di 0..2083 = 2084/2291 = 90.9%)

### 3.3 紅線 (W15 全程遵守)

- `ai_can_execute / risk / ai_packages_needed / ai_logs_output` 不保守改動
- in-band ipmitool (無 `-I lanplus`) 絕不碰; KEEP 行 ssh 外殼保留
- 巢狀引號行不 strip
- 修補訊息 (R7 `:?`) 內無反引號 / 無雙引號 (R30)
- 無 commit / 無 push / 無 stage 除非用戶明確要求
- `123.txt`、`data/11.RestAPI/`、`data/12.RestAPI/`、`*.bak_*` 維持 untracked
- 程式碼一律無 CJK (本交接檔 MD 可用; 所有 .py 純 ASCII)

---

## 4. 檔案路徑

| 檔 | 路徑 |
|---|---|
| 本文 (W14 PENDING) | `SESSION_HANDOFF_WINDOW14_REVIEW_1684_1883_PENDING.md` |
| 上一視窗 (W13 DONE) | `SESSION_HANDOFF_WINDOW13_APPLY_W12_1384_1683_DONE.md` |
| 修補腳本 (待 W15 APPLY) | `/root/w14_fix.py` (DRY=1 dry / 直接跑 apply) |
| 200 行 raw dump (S2 審計底稿) | `/tmp/w14_window.txt` (可重建: 讀 xlsx di 1684..1883 ai_commands) |
| 主 xlsx | `data/REVISED_commands_merged_with_raw.xlsx` (md5 `d668c3b4…` 未動) |
| W14 備份 (apply 前) | `data/…xlsx.bak_batch_20260905_w14pre` (同 md5) |
| tests.json | `data/tests.json` + `/srv/pa-manager-prod/data/tests.json` (md5 `db44b71d…` W13 build) |
| build | `scripts/build_testlib_json_xlsx.py` |
