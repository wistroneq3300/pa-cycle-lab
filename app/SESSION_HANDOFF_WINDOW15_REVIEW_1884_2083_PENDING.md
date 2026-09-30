# Window-15 — di 1884..2083 review (PENDING — 修補已定義並驗證, W16 來 APPLY)

> Window: 2026-08-18 (W15 視窗, 用戶 go 後完成 STEP A 全鏈 + STEP B S1–S3, S4–S8 交棒 W16)
> 上一視窗: `SESSION_HANDOFF_WINDOW14_REVIEW_1684_1883_PENDING.md` (W15 STEP A 已 APPLY 完畢)
> 備份 (本視窗 S1 完成): `data/REVISED_commands_merged_with_raw.xlsx.bak_batch_20260905_w15pre`
>   — 即 W14 95 cells 已 apply 後的基線, md5 `c504ba978a74bb98fc93dde249d2ae51` (備份與本體已核一致)
> 修補腳本 (S3 完成, **未在 repo xlsx 上跑過 — 只跑過 DRY + sandbox**): `/root/w15_fix.py`
>   — 支援 `W15_XLSX=/path/copy.xlsx` 環境變數指到副本 (sandbox 即用此方式驗證)

---

## 1. 本視窗做了什麼

### 1.1 STEP A — APPLY W14 的 95 cells (di 1684..1883) ✅ 全鏈完成

| Step | 結果 |
|---|---|
| S4 | `DRY=1` 95 cells (A72/B+D2/E14/C7) → 正式 apply: `changed cells: 95` + **`post-audit issues: NONE`** |
| S5 | vs `_w14pre`: **95 di set 與 W14 清單完全相等**; 只動 `ai_commands`; 其它 5 sheets + 17 欄 0 diff; KEEP 行 (1742/1730/1766/1828/1685) IDENTICAL |
| S6 | build **3112 / 6 sheets**; 三向 md5 **`8a3c6ca0d6375c2eb9a38cac9a238212`** (repo == prod == /tmp) 全一致 |
| S7 | 15 行 spot-check xlsx == tests.json `ai_commands` **EXACT 全中**; FULL-SWEEP 2291 行 43 個「mismatch」全部為**既有重複 code 的多變體**(dup codes 125 組), 每個 code 至少一個變體與 xlsx 相等 → **真 mismatch 0** |

> 交付狀態: **di 0..1883 (handoff 編制) = 全庫 1884/2291** 已含 W14 修補; tests.json 已是 W14 後 build。

### 1.2 STEP B S2 審計 di 1884..2083 (200 行逐行讀完 — raw dump 在 `/tmp/w15_window.txt`)

> ⚠️ **編制對齊 (重要, W16 務必沿用)**: 本庫 `di = excel_row − 2` (excel 第 1 列 = header, di 從 0 起算)。
> W14 交付已實證此對齊 (W14 di=1684 = Wistron-BMC-00958-V003 = excel row 1686)。
> **本視窗窗口 = excel rows 1886..2085** = Wistron-BMC-00975-V002 … Wistron-AMD SVM-00129-V003。
> 先前 W14 文件裡 di 邊界 (1684=00958…) 是 W14 作者的 di 標籤, 對齊後完全吻合 (00958 在 di 1684 的 +0/−1 差是 W14 dump 本身的 off-by-one, **不影響 W14 交付的 95 cells 正確性** — 已用 code 錨定核過)。
> **審計一律以 Code + excel row 為錨, 不要只信 di 標籤。**

| Cat | 行數 | 錨 (excel row / Code) | 說明 | 修法 |
|---|---|---|---|---|
| **A** bare `sensor get "X"` / `chassis status` / `sel info` 整行 | **72** | rows 1886-1903 (18), 1960/1961, 1971, 1980-2001 (21), 2010-2038 (選中 29), 2040 | ssh 內嵌層是裸 `sensor get '…'` 漏 `ipmitool` 前綴 (R29 假命令, 與 W9/W14 同款)。**其中 21 行 sensor 名含空格** (如 `'Sensor Check - MB'`, 01031-01049 + 00484/01052/01053/01054/01055/01056/01057/01059) → **regex 必須吃 `[^']+` 到引號尾, 不能 `[^'\s]+`** (W15 首版 regex 就踩了這個坑, 已修) | 整行改 OOB: `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" <cmd> 2>&1` |
| **B** `-d <device_id>` | **1** | row 1975 (Wistron-AMD SVM-00038-V003, AMDGPURAS Query, ai_can=YES) | `amdgpuras -b $b -q 1 -d <device_id>` 執行位裸占位 (R7)。**全庫唯一** 一處 `<device_id>` (已全表掃過) | R7: `${AMDGPU_DEVICE_ID:?operator must provide the amdgpuras GPU device index (library samples use -d 0/1/2/3)}` (R30-safe: 無反引號/雙引號) |
| **C** 相鄰 `2>&1 2>&1` | **12** | rows 1959, 2046, 2052, 2053, 2055, 2056, 2060, 2063, 2064, 2065, 2067, 2070 (Code: 00137-V002, 01060-V002, 01063-V003×2 處, 01064-V003, 01066-V003, 00010-V002, 00014-V002, 00017-V002, 00018-V002, 00019-V002, 00021-V002, 00114-V003) | 相鄰重複 redirect。**非相鄰** 的 `2>&1` (如 `a 2>&1; b 2>&1` / `tee f 2>&1`) 是合法, 不碰 | dedup → 單一 `2>&1` |

**總計 85 cells (A72 + B1 + C12), 全部只動 `ai_commands` 一欄。0 改 ai_can_execute / risk / ai_packages_needed / ai_logs_output。**

### 1.3 KEEP 護欄 (已核, 不改)

- rows 1917-1926 區 (GB NV PVP 00465/00466/00011/00012/00013): 已在 agent host 上 OOB-direct `ipmitool -I lanplus …; ssh "uptime; dmesg…"` → 無 wrapper 可 strip, 不碰。
- row 1960-1961 附近 curl+ipmitool 混排 (row 1963, 00994-V002 YES): 多指令 cell 非整行裸 → A regex 不命中; KEEP。
- rows 1973-1974 (00999-01000, curl `$MANAGER/$LOGS/$ENTRY` 裸佔位): **同 W14 di 1688 政策 — 判定行/佔位行保守不碰**。
- rows 2012, 2039 (2039 M.2 flash PARTIAL, 2012 01030-V002): PARTIAL 描述行, 不碰。
- rows 1922-1927, 1950, 1954, 1968-1970, 1976-1979, 2002-2009, 2012, 2039-2055 等 **~80 行 NO/PARTIAL/描述行** (KVM/GPU flash/XGMI margin/AMD error injection 等) 維原判定, 0 動 (保守優先)。
- row 1949 (01024, sensor list PARTIAL 描述中嵌 OOB): 描述行不碰。

### 1.4 DRY + sandbox 全跑驗證 (S3)

```
DRY=1 python3 /root/w15_fix.py
== DRY-RUN ==  changed cells: 85 (expect 85)
  A bare-sensor/sel/chassis->OOB : 72
  B R7 placeholder               : 1
  C cosmetic 2>&1 dedup          : 12

# sandbox (repo xlsx 的 /tmp 副本, W15_XLSX 環境變數):
cp data/REVISED_commands_merged_with_raw.xlsx /tmp/w15_sandbox.xlsx
W15_XLSX=/tmp/w15_sandbox.xlsx python3 /root/w15_fix.py
== APPLY ==  changed cells: 85  (同上 72/1/12)
Saved -> /tmp/w15_sandbox.xlsx
post-audit issues: NONE ✓
```

8 行 before/after 手動核 (rows 1886/1960/1961/1971/2010/1975/2052/2070) 全正確, 例:

```
row 1886 OLD: sshpass -p "$DUT_PASS" ssh … $DUT_USER@$DUT_IP "sensor get 'TEMP_PDB_PSU1~6'"
row 1886 NEW: ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'TEMP_PDB_PSU1~6' 2>&1

row 2010 OLD: … "sensor get 'Sensor Check - MB'"
row 2010 NEW: ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'Sensor Check - MB' 2>&1
              (含空格 sensor 名 — W15 regex 已支援)

row 1975 NEW: … amdgpuras -b $b -q 1 -d ${AMDGPU_DEVICE_ID:?operator must provide the amdgpuras GPU device index (library samples use -d 0/1/2/3)} 2>&1; done 2>&1"
```

**repo 的 xlsx 未動** — 本視窗到 S3 為止, S4–S8 交 W16。

---

## 2. 最終狀態 (W15 視窗結束時)

| 項目 | 值 |
|---|---|
| **W14 95 cells** | **已 APPLY + 五層驗證通過** (S4-NONE / S5 95-only / S6 三向 `8a3c6ca0…` / S7 EXACT 全中 + 0 真 mismatch) |
| **W15 85 cells** | **NOT APPLIED** (PENDING; DRY + sandbox self-audit NONE) |
| 修補腳本 | `/root/w15_fix.py` (DRY=1 dry / 直接跑 apply+audit; `W15_XLSX=` 可指副本) |
| xlsx md5 | `c504ba978a74bb98fc93dde249d2ae51` (W14 DONE 基線, 未動; = `_w15pre` 備份) |
| tests.json | `8a3c6ca0d6375c2eb9a38cac9a238212` (W14 後 build, repo == prod) |
| git HEAD | `2a109d5` — **未 stage / 未 commit / 未 push** |
| 全庫進度 | **di 0..1883 (1884/2291 = 82.2%) 已交付**; di 1884..2083 已 review 待 APPLY (交付後 2084/2291 = 90.9%) |
| 剩餘 | di 2084..2291 = **208 行, 即全庫最後一段** (excel rows 2086..2292, Wistron-AMD SVM-00130-V003 … Wistron-HW-00164-V003) |

---

## 3. W16 接棒: APPLY W15 修補 (di 1884..2083, 85 cells) + REVIEW di 2084..2291 (最後 208 行 = 收尾)

### 3.1 STEP A — APPLY W15 已定義的 85 cells (S4–S7)

用戶授權 go 後一次跑完:

1. **S4 APPLY**: `cd /root/sheng/manager/pa_manager && python3 /root/w15_fix.py`
   (腳本內建 save + self-audit; 期望 `changed cells: 85` + `post-audit issues: NONE`)
   若 post-audit 非 NONE → 先停, 對照 §1.2 表逐行查, 不強推。
2. **S5 零回歸**: `REVISED_commands_merged_with_raw.xlsx` vs `…_w15pre`:
   期望 **只 Functionality.ai_commands 動 85 cells**, 其餘 5 sheets + 17 欄 0 diff;
   ai_can_execute / risk / ai_packages_needed / ai_logs_output 0 diff;
   KEEP 行抽查 (rows 1963/2047/2052-adjacent/00999/01030) 0 diff。
3. **S6 build + 三向 md5**:
   `python3 scripts/build_testlib_json_xlsx.py data/REVISED_commands_merged_with_raw.xlsx /tmp/w16_tests_build.json`
   期望 **3112 / 6 sheets**; `cp` 兩份到 `/srv/pa-manager-prod/data/tests.json` + `data/tests.json`,
   三向 md5 全一致 (repo==prod==/tmp)。
4. **S7 spot-check ≥13 行** xlsx == tests.json `ai_commands` **完全相等**, 建議含:
   1886 (A head, no-space), 1903 (A 區尾), 2010 (A 含空格 sensor 名),
   1960/1961 (A chassis status), 1971 (A sel info), 2040 (A tail 01059),
   1975 (B `<device_id>`), 1959 (C pldmtool), 2052 (C ×2 處), 2070 (C tail),
   1963 (KEEP curl+ipmitool 混排), 2039 (KEEP PARTIAL), 1973-1974 (KEEP 佔位不碰), 1922 (KEEP OOB-direct)。

### 3.2 STEP B — 繼續 REVIEW di 2084..2291 (最後 208 行 = 全庫收尾) 口徑與 SOP

(與 W10–W15 完全相同)

- 規則: `REVIEW_WORKFLOW_LOGIC.md` (R5/R6/R7/R18/R19/R22/R24/R26/R27/R28/R29/R30)
- 判定: YES/PARTIAL/NO + defect worklist; **保守優先**, 0 改 ai_can_execute
- 修補: **只動 `ai_commands` 一欄**
- R28 ID 對照: `data/11.RestAPI/` + `data/12.RestAPI/`
- KEEP 護欄: DUT-local (dmidecode/nvidia-smi/stress-ng/in-band ipmitool/UEFI shell/uptime/i2c/i3c/lsblk/nvme/lspci…) 的 ssh 外殼保留; 巢狀引號行不 strip
- **R29 audit 重點**: bare `sensor get`/`chassis`/`sdr`/`sel`/`mc info` 漏 ipmitool (W14 72 + W15 72, W16 很可能還有同類殘骸 — regex 記得吃含空格 sensor 名 `[^']+`)
- **W16 是收尾視窗**: di 2084..2291 之後 全庫 2291/2291 = **100%**。S8 交棒時寫 **W17 = 全庫複掃/驗收視窗** (建議口徑: 全庫 re-run W14/W15 兩個 audit regex + KEEP 護欄 spot + tests.json 三向), 或直接寫 DONE 總結視窗 (視 W16 有沒有 defect 而定)。
- SOP: S1 備份 `…_w16pre` → S2 審計 → S3 DRY → S4 APPLY+self-audit → S5 零回歸 → S6 build+三向 → S7 spot-check → S8 交棒 (全庫收尾)
- **S5 零回歸錨定建議**: 用 Code + excel row (不用 di 標籤) 對齊, 避免 W15 這種 off-by-one 再發生。

### 3.3 紅線 (W16 全程遵守)

- `ai_can_execute / risk / ai_packages_needed / ai_logs_output` 不保守改動
- in-band ipmitool (無 `-I lanplus`) 絕不碰; KEEP 行 ssh 外殼保留
- 巢狀引號行不 strip
- 修補訊息 (R7 `:?`) 內無反引號 / 無雙引號 (R30)
- 無 commit / 無 push / 無 stage 除非用戶明確要求
- `123.txt`、`data/11.RestAPI/`、`data/12.RestAPI/`、`*.bak_*` 維持 untracked
- 程式碼一律無 CJK (本交接檔 MD 可用; 所有 .py 純 ASCII)
- **W15 教訓**: (1) di 標籤有 off-by-one 可能 → 用 Code + excel row 錨定; (2) sensor 名可含空格 → bare-command regex 用 `[^']+` 到引號尾; (3) 審計 dump 自己也要 re-align 一次再寫文件 (W15 S2 dump 第一版 di 標籤偏了, 已在 `/tmp/w15_window.txt` 用新對齊重寫)

---

## 4. 檔案路徑

| 檔 | 路徑 |
|---|---|
| 本文 (W15 PENDING) | `SESSION_HANDOFF_WINDOW15_REVIEW_1884_2083_PENDING.md` |
| 上一視窗 (W14 PENDING — 已被 W15 STEP A 消費) | `SESSION_HANDOFF_WINDOW14_REVIEW_1684_1883_PENDING.md` |
| 上一視窗 DONE (W13) | `SESSION_HANDOFF_WINDOW13_APPLY_W12_1384_1683_DONE.md` |
| 修補腳本 (待 W16 APPLY) | `/root/w15_fix.py` (DRY=1 dry / 直接跑 apply / `W15_XLSX=` 副本) |
| 200 行 raw dump (S2 審計底稿, 新對齊) | `/tmp/w15_window.txt` |
| sandbox 驗證產物 | `/tmp/w15_sandbox.xlsx` (= W14 基線 + 85 cells, self-audit NONE) |
| 主 xlsx (未動) | `data/REVISED_commands_merged_with_raw.xlsx` (md5 `c504ba97…`) |
| W15 備份 (apply 前) | `data/…xlsx.bak_batch_20260905_w15pre` (同 md5) |
| tests.json (W14 後 build) | `data/tests.json` + `/srv/pa-manager-prod/data/tests.json` (md5 `8a3c6ca0…`) |
| build | `scripts/build_testlib_json_xlsx.py` |
