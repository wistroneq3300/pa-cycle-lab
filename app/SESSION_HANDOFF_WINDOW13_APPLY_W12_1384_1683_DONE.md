# Window-13 — di 1384..1683 review 修補 APPLY (DONE)

> Window: 2026-09-05 (W13 視窗, 用戶授權 go 後一次完成 S1–S7)
> W12 交接檔: `SESSION_HANDOFF_WINDOW12_REVIEW_1384_1683_PENDING.md` (本視窗接手)
> 備份: `data/REVISED_commands_merged_with_raw.xlsx.bak_batch_20260905_w13pre` (W12 原樣, md5 `e4ced55d…`)
> 修補腳本: `/root/w12_fix.py` (W13 修 3 處 blind spot 後執行)

---

## 1. 本視窗做了什麼

### 1.1 §3 三行複核 (S2)

| di | 判定 | 理由 |
|---|---|---|
| **1398** (BMC FW Recovery) | **KEEP** | 被包內是 OOB 但有巢狀引號; 且本質是 recovery flow placeholder, 不是單一 OOB 指令 → 保留 ssh 外殼, 功能不毀 |
| **1431** (BIOS menu FW) | **KEEP** (已存在) | `dmidecode` 是 DUT-local, ssh 外殼必要 → 正確 |
| **1482** (Reboot 5 times) | **KEEP** | 被包內是 `uptime` (DUT-local) → ssh 外殼必要; 巢狀引號 strip 不安全 |

三行**全補/保留在 KEEP 集**, 0 行 strip。

### 1.2 w12_fix.py 修補 (W13 發現 W12 的 3 處 blind spot)

W12 的 DRY 分支在 self-audit **之前 `return`**, 導致 self-audit **從未真正跑過**。W13 首次觸發 self-audit 時抓到:

| 行 | 問題 | 修法 |
|---|---|---|
| **1629–1633** (5 行, Boot Order) | W12 EDITS pattern `Systems/1 ` (帶空白)只匹配到 description 文字, **漏了 curl 發起的 URL** `Systems/1"` (引號結尾) → curl 仍 POST 到 `Systems/1` (錯 ID) | **新增 5 條 EDITS**: `redfish/v1/Systems/1"` → `redfish/v1/Systems/system"` (curl URL 真正改到)。已對照 `11.RestAPI/System` + `12.RestAPI/system`: 全庫 `Systems/1=0 hits`, `Systems/system=21 hits` → 確認正確 |
| **1497** (BMC FW Flash) | W12 誤列在 STRIP_INWIN, 但 1497 本就在 KEEP (巢狀引號, 外殼必要) → audit 假陽性 `ssh-left` | **從 STRIP_INWIN 移除** (C 修 R7 占位符保留); audit 邏輯加 `di not in KEEP` 排除 |
| **audit 邏輯** | 未排除 KEEP 行 → KEEP 行的 ssh 外殼被誤 flag | 改為 `if "sshpass" in val and di in STRIP_INWIN and di not in KEEP` |

### 1.3 DRY 驗證 (S3)

```
DRY-RUN → changed cells: 43
changed di: [1395, 1396, 1459, 1461, 1497, 1506, 1511, 1512, 1513, 1522, 1529,
  1577, 1580, 1581, 1582, 1590, 1591, 1592, 1593, 1597, 1600, 1608, 1609, 1610,
  1611, 1612, 1613, 1614, 1625, 1629, 1630, 1631, 1632, 1633, 1634, 1635,
  1671, 1672, 1673, 1678, 1679, 1680, 1681]
(與 W12 baseline 完全一致, 無漂移)

DRY APPLY to /tmp copy → post-audit issues: NONE ✓
```

### 1.4 APPLY + self-audit (S4)

```
== APPLY ==  changed cells: 43
Saved -> data/REVISED_commands_merged_with_raw.xlsx
post-audit issues: NONE
```

- xlsx md5: `e4ced55d…` (W12 基線) → **`d668c3b4bef7d2a485e20c19e6c3a3c4`** (W13 改完)

### 1.5 零回歸 (S5)

`REVISED_commands_merged_with_raw.xlsx` vs `…_w12pre` 備份:

| sheet | 總 diff cells |
|---|---|
| Functionality | **43** (全部 `ai_commands` 一欄, = 43 行) |
| Reliability | 0 |
| Performance | 0 |
| Compatibility | 0 |
| Stability | 0 |
| (No Main Function) | 0 |

**總計 43 cells, 只動 Functionality.ai_commands, 其餘 5 sheets + 17 欄全 0 diff。**

- §3 KEEP 行 (1398/1431/1482): **全 0 diff** (未被改)
- 典型 KEEP 行 (1388/1431/1432/1445/1484/1494/1500): **全 0 diff**
- 1673 (同時在 STRIP_INWIN + KEEP): 只動了 `<bmc_port>`→`${BMC_PORT:?…}` (C 修), ssh 外殼保留 ✓
- 1629–1633: `Systems/1` count 2→0, `Systems/system` count 0→2 (description + curl URL 都改到) ✓

### 1.6 build + 三向 md5 (S6)

```
wrote data/tests.json total 3112
   功能性 Functionality 2291
   可靠性 Reliability 202
   效能 Performance 60
   相容性 Compatibility 459
   穩定性 Stability 88
   無主功能 (No Main Function) 12
```

三向 md5 **全一致**:
```
db44b71d81197c095eb62c5871387c07  data/tests.json
db44b71d81197c095eb62c5871387c07  /srv/pa-manager-prod/data/tests.json
db44b71d81197c095eb62c5871387c07  /tmp/w13_tests_build.json
```

### 1.7 spot-check (S7)

13/13 行 xlsx vs tests.json `ai_commands` **完全一致 ✓**:

| di | code | 用途 |
|---|---|---|
| 1461 | Wistron-BIOS-00031-V004 | C 修 R7 占位符 `${BIOS_IMAGE:?…}` |
| 1497 | Wistron-BMC-00067-V004 | KEEP 外殼 + C 修 `${BMC_IMAGE:?…}` |
| 1590 | Wistron-BMC-00862-V002 | B 修 Systems/system |
| 1597 | Wistron-BMC-00869-V002 | B 修 Chassis Members |
| 1671 | Wistron-BMC-00944-V004 | C 修 raw 0x30 0x23 0x01 |
| 1672 | Wistron-BMC-00945-V004 | C 修 raw 0x30 0x23 0x02 |
| 1398 | Wistron-BMC-00690-V004 | §3 KEEP (ssh 外殼保留) |
| 1431 | Wistron-BIOS-00001-V003 | §3 KEEP (dmidecode DUT-local) |
| 1482 | Wistron-BIOS-00052-V003 | §3 KEEP (uptime DUT-local) |
| 1484 | Wistron-BMC-00054-V003 | in-band ipmitool (KEEP) |
| 1494 | Wistron-BMC-00064-V003 | UEFI shell (KEEP) |
| 1500 | Wistron-BMC-00070-V003 | in-band ipmitool (KEEP) |
| 1673 | Wistron-BMC-00946-V004 | C 修 `${BMC_PORT:?…}` + KEEP 外殼 |

---

## 2. 最終狀態

| 項目 | 值 |
|---|---|
| ** APPLY 狀態** | **DONE** (43 cells applied, audit NONE) |
| xlsx md5 | `d668c3b4bef7d2a485e20c19e6c3a3c4` |
| tests.json md5 | `db44b71d81197c095eb62c5871387c07` (repo == prod == /tmp) |
| git HEAD | `2a109d5` (W11 review commit) — **未 stage / 未 commit / 未 push** |
| 全庫進度 | **di 0..1683 已交付 = 1684/2291 (73.5%)** |
| W14 之後 cursor | **di 1684..1883 (200 行, 接 Wistron-BMC-00958-V003)** |

---

## 3. W14 接棒: REVIEW di 1684..1883 (200 行)

### 3.1 範圍

- Functional sheet data_index **1684..1883** (200 rows)
- di 1684 = **Wistron-BMC-00958-V003** → di 1883 = **Wistron-BMC-00974-V002**
- 下下批 (W15) cursor: di 1884 = Wistron-BMC-00975-V002

### 3.2 審計口徑 (與 W10–W13 相同)

- 規則: `REVIEW_WORKFLOW_LOGIC.md` (R5 / R26 / R27 / R28 / R30 / R31)
- 判定: YES / PARTIAL / NO + defect rows worklist
- 修補: **只動 `ai_commands` 一欄**; `ai_can_execute / risk / ai_packages_needed / ai_logs_output` 不碰
- R28 ID 對照: `data/11.RestAPI/` + `data/12.RestAPI/` (Systems/system, Managers/bmc, Chassis)
- KEEP 護欄: DUT-local (dmidecode / nvidia-smi / stress-ng / in-band ipmitool / UEFI shell / uptime) 的 ssh 外殼保留
- OOB-ssh strip: 被包內純 OOB (ipmitool -I lanplus / redfish curl) 且無巢狀引號 → strip
- 巢狀引號行 → 不 strip (保留外殼), 記入 KEEP

### 3.3 執行 SOP (S1–S8)

1. **S1 備份** xlsx → `…_w14pre` (記 md5)
2. **S2 審計** di 1684..1883 R-pattern (參 W11 `w11_fix.py` 套路)
3. **S3 DRY 驗證** → 記 changed cells
4. **S4 APPLY + self-audit** → 必須 `post-audit issues: NONE`
5. **S5 零回歸** vs `…_w14pre` (只動 200 行 × ai_commands; 其它 0 diff)
6. **S6 build + 三向 md5**
7. **S7 spot-check ≥ 13 行** (含修補行 + KEEP 行)
8. **交回**: 更新本文 + `OPENHANDS_PASTE_NEXT_WINDOW.md`

### 3.4 紅線 (與 W9–W13 相同)

- `ai_can_execute / risk / ai_packages_needed / ai_logs_output` 不保守改動
- in-band ipmitool (無 `-I lanplus`) 絕不碰
- KEEP 行 (DUT-local) 的 ssh 外殼必須保留
- 無 commit / 無 push / 無 stage 除非用戶明確要求
- `123.txt`, `data/11.RestAPI/`, `data/12.RestAPI/`, `*.bak_*` 維持 untracked

---

## 4. 檔案路徑

| 檔 | 路徑 |
|---|---|
| 本文 | `SESSION_HANDOFF_WINDOW13_APPLY_W12_1384_1683_DONE.md` |
| W12 交接 (本視窗接手) | `SESSION_HANDOFF_WINDOW12_REVIEW_1384_1683_PENDING.md` |
| 修補腳本 (W13 修 3 處後) | `/root/w12_fix.py` |
| 主 xlsx | `data/REVISED_commands_merged_with_raw.xlsx` (md5 `d668c3b4…`) |
| W13 備份 (apply 前) | `data/…xlsx.bak_batch_20260905_w13pre` |
| tests.json | `data/tests.json` + `/srv/pa-manager-prod/data/tests.json` (md5 `db44b71d…`) |
| build | `scripts/build_testlib_json_xlsx.py` |
