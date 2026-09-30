# Window-12 — di 1384..1683 (300 rows) Review + ssh+lanplus 剝除 (PENDING — 未 APPLY)

> Window: 2026-09-05 12:29–13:37 (本視窗於寫交接檔時 OpenHands 卡死中斷, 交接檔由後續視窗補完)
> Backup: `data/REVISED_commands_merged_with_raw.xlsx.bak_batch_20260905_w12pre`
> Scope: Functional data_index 1384..1683 (300 rows, Wistron-BMC-00676-V003 → 00955-V003 + BIOS/HW/AMD 混入)
> 決定記錄: 用戶 12:42 選 A (本視窗執行) + 選項 1 (65/72 個 ssh+lanplus 剝除 pass 併入本視窗一起做)

---

## 0. 狀態總覽 (誠實: 本視窗未套用任何改動)

| 指標 | 值 |
|---|---|
| **APPLY 狀態** | **未 APPLY**。`w12_fix.py` 只跑到 DRY-RUN (`changed cells: 43, DRY: NOT saved.`) |
| xlsx md5 | `e4ced55db39a3eb399c7b8a546e0c4f5` == `…_w12pre` 備份 → workbook 未被改 |
| tests.json | repo == prod == `/srv/pa-manager-prod/data/tests.json`, md5 `a93b9341e5d0b7f5cc5352753df737c2` (W11 的 build, W12 未 rebuild) |
| git | HEAD = `2a109d5` (W11 review commit); 未 stage / 未 commit / 未 push |
| 未上線 | 是 — prod 仍是 W11 版本 |
| 審計結果 | YES 122 / PARTIAL 127 / NO 51 (di 1384..1683); defect rows 61 |
| dry-run 改動清單 | 43 cells (全部 Functionality `ai_commands` only), 見 §2 |

## 1. 本視窗產物 (`/root/`)

| 檔案 | 用途 | 狀態 |
|---|---|---|
| `w12_scan.py` / `w12_scan2.py` | 掃 ssh+lanplus: 寬鬆 65 / strict 72 行 (Functionality 63/70 + Reliability 2) | 完成的分析 |
| `w12_audit.py` / `w12_audit2.py` | di 1384..1683 R-pattern 審計 → 61 行 defect worklist (§3) | 完成的分析 |
| `w12_sshall.py` / `w12_classify.py` | STRIP/KEEP/MIXED 自動分類 (初版, 已被 w12_fix.py 手動核實集取代) | 完成 |
| `w12_inwin.py` / `w12_pull36.py` | Redfish ID 對照 data/11+12.RestAPI (Managers/bmc, Systems/system, Chassis) | 完成的分析 |
| **`w12_fix.py`** | **主修補腳本** (A/B/C/D 四類, §2), 含 KEEP 護欄 + self-audit | **DRY-RUN 過, 未 APPLY** |

## 2. `w12_fix.py` 改動定義 (DRY-RUN = 43 cells)

只動 **Functionality sheet 的 `ai_commands` 一欄**; `ai_can_execute / risk / ai_packages_needed / ai_logs_output` 不碰。

**A) OOB-ssh strip** — 拿掉 `sshpass … ssh … $DUT_USER@$DUT_IP "…"` 外殼 (被包內容是 OOB-only: ipmitool -I lanplus / redfish, 可在 agent host 直接跑):
手動核實 STRIP_INWIN = 38 行: `1395 1396 1459 1461 1497 1506 1511 1512 1513 1577 1580 1581 1582 1590 1591 1592 1593 1597 1600 1608 1609 1610 1611 1612 1613 1614 1625 1629 1630 1631 1632 1633 1634 1635 1678 1679 1680 1681`

**B) R28 id 修正** (對照 data/11+12.RestAPI 真實 ID):
- `redfish/v1/Systems/1` → `Systems/system` (di 1590/1591/1592/1593/1625/1629/1630/1631/1632/1633)
- `redfish/v1/Managers/1` → `Managers/bmc` (di 1511/1512/1513/1577/1634/1635)
- di 1597: `Chassis/1/Power` → `Chassis` + `jq '.Members[].Name'` (R18 model-specific)

**C) R7 占位符** (bare `<placeholder>` → `${VAR:?…}`, R30 無反引號):
- di 1461 `@<bios>.cap` → `${BMC_BIOS_UPDPARA:?optional};@${BIOS_IMAGE:?operator must provide a BIOS .cap image path}`
- di 1497 `@<bmc>.ima` → `${BMC_FW_UPDPARA:?optional};@${BMC_IMAGE:?…}`
- di 1522 `BurnInTest -t <hours>` → `-${BURNIN_HOURS:?…}`
- di 1529 `bad_page_threshold=<val>` → `${BAD_PAGE_THRESHOLD:?…}`
- di 1671/1672 `raw 0x30 0x23 <val>` → 0x01 (on) / 0x02 (blink) 實際值
- di 1673 `ethtool -s <bmc_port>` → `${BMC_PORT:?…}`

**D) 美觀** — `2>&1 2>&1` → `2>&1` (只在本已改的行, 保持 diff 可審計)

**DRY-RUN 結果 (W13 適用前的 baseline):**
```
changed cells: 43
changed di: [1395, 1396, 1459, 1461, 1497, 1506, 1511, 1512, 1513, 1522, 1529, 1577, 1580, 1581, 1582,
 1590, 1591, 1592, 1593, 1597, 1600, 1608, 1609, 1610, 1611, 1612, 1613, 1614, 1625, 1629, 1630, 1631,
 1632, 1633, 1634, 1635, 1671, 1672, 1673, 1678, 1679, 1680, 1681]
```

**KEEP 護欄 (絕不可剝 ssh 的 DUT-local 行, 摘錄):** 1388, 1431-1452, 1480, 1483, 1494-1497, 1525, 1527, 1538, 1540-1542, 1594-1596, 1646, 1648, in-band DUT ipmitool/sensor/sel 行 (1484-1492, 1500, 1507-1510, 1615, 1639, 1640, 1649, 1654-1655, 1659-1664, 1666, 1669-1670, 1674, 1676), 1416-1419。完整集在 `w12_fix.py` KEEP 常數。

## 3. W13 待複核 (R31 flag 但未被 strip 的行 — 必須逐行人工確認)

| di | code | items | 原因 |
|---|---|---|---|
| 1398 | Wistron-BMC-00690-V004 | BMC FW Recovery | defect worklist 標 R31, 但不在 STRIP_INWIN 也不在 KEEP → **W13 確認被包內容是 OOB(該剝) 還是 DUT-local(該補進 KEEP)** |
| 1431 | Wistron-BIOS-00001-V003 | BIOS Menu - FW Version Check | 在 KEEP (DUT-local BIOS), 建議抽查確認 |
| 1482 | Wistron-BIOS-00052-V003 | Reboot 5 times | 標 R31 但未列入任一集 → 同 1398 處理 |

## 4. W13 執行步驟 (S1–S5, 照 W11 SOP)

1. **S1 備份**: `cp data/REVISED_commands_merged_with_raw.xlsx …_bak_batch_<date>_w13pre` (記 md5)
2. **S2 複核 §3 三行** (1398/1431/1482): 讀原 cell, 決定 strip 或補 KEEP; 如有變更 → 更新 `w12_fix.py` STRIP_INWIN/KEEP 後再走
3. **S3 DRY 驗證不漂移**: `DRY=1 python3 /root/w12_fix.py` → 必須仍是 43 cells + 同一 di 清單 (含 S2 可能的新增)
4. **S4 APPLY + self-audit**: `python3 /root/w12_fix.py` → 看 `post-audit issues: NONE`
5. **S5 零回歸**: vs `…_w12pre` 備份 — diff 必須 = §2 列出的行 × ai_commands 一欄; KEEP 行 0 diff (ssh 外殼完整保留); in-band ipmitool 0 被動; 其它 17 欄 + 5 sheets 0 diff
6. **S6 build + 三向 md5** (repo / prod / 臨時)
7. **S7 6969 spot-check ≥ 13 行**: 至少含 1597 (Chassis Members), 1590 (Systems/system), 1461/1497 (R7 占位符), 1671/1672 (UID raw), 3 行 KEEP (1484/1494/1500 ssh 外殼仍在 + in-band 未動), §3 決定項 1398/1482
8. 交回: 更新本文 + `OPENHANDS_PASTE_NEXT_WINDOW.md`, 狀態改為 DONE, 記錄 build md5

## 5. 進度 (全庫)

- 已交付並 build 上線: di 0..1383 (W11 止, build 3112/6 sheets, md5 `a93b9341…`)
- **W12 = di 1384..1683 已 review 完 + 修補方案定案 (43 cells), 待 APPLY**
- APPLY + build 後: 已交付 di 0..1683 = 1684 / 2291 (73.5%)
- **W13 之後的 review cursor: di 1684..1883 (下一批 200 行, 接 Wistron-BMC-00956-V003)**

## 6. 紅線 (與 W9–W11 相同)

- `ai_can_execute / risk / ai_packages_needed / ai_logs_output` 不保守改動
- in-band ipmitool (無 `-I lanplus`) 絕不碰
- KEEP 行 (DUT-local: dmidecode / nvidia-smi / stress-ng / UEFI shell / in-band ipmitool) 的 ssh 外殼必須保留
- 無 commit / 無 push / 無 stage 除非用戶明確要求
- `123.txt`, `data/11.RestAPI/`, `data/12.RestAPI/`, `*.bak_*` 維持 untracked
