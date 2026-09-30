# Window-11 — ipmitool OOB `-C 17` + R31 ssh 拆包 (DONE)

> Executed: 2026-08-22
> Backup: `data/REVISED_commands_merged_with_raw.xlsx.bak_batch_20260905_w11pre`

---

## 0. 結果總覽

| 指標 | 值 |
|---|---|
| 改動 cells（`ai_commands` only） | **336** (334 Functionality + 2 Reliability) |
| R31 整格重寫 | **9** (全部 Functionality) |
| `-C 17` 插入 invocation 數 | **419**（含 multi-invocation cells, 如 di=816 有 5 個） |
| 已含 `-C 17`、跳過 | **6 command cells** (di 1641/1642/1643/1678/1961/2226) + 1 prose-only mention (di 2217) |
| 未改 in-band ipmitool | **全部 untouched**（strict check: 0 in-band token 被加 `-C 17`） |
| 其它 17 欄（ai_can_execute / risk / …） | **0 diff**（zero-regression 確認） |
| build | **3112 / 6 sheets** (不変) |
| 三向 md5 | `a93b9341e5d0b7f5cc5352753df737c2` (repo == prod == /tmp) |
| 6969 spot-check | **13/13 PASS** |
| S6 真機驗證 (EQ3300-AIAgent 10.35.228.145) | **PASS**: Device ID 32 / FW 3.08 / Wistron Corporation |

---

## 1. 改動明細

### 1.1 T1 — 全庫 `-C 17` 插入 (327 行)

- 位置: `ipmitool -I lanplus` 之後、`-H`/`-U`/`-P`/其它 flag 之前。
- 只處理 invocation (有 `ipmitool -I lanplus <space>`), 不碰 prose 提及。
- Multi-invocation cells: 每個 invocation 都插 (ex 如 di=816 有 5 個 `ipmitool -I lanplus` → 全部 5 個都加 `-C 17`)。
- 已含 `-C 17` 的 6 invocation cells 跳過 (不重複加)。

### 1.2 T2 — R31 整格重寫 (9 行, 含在 336 內)

| data_index | code | 原 | 改 |
|---|---|---|---|
| 1116 | 00408 | `sshpass … ipmitool -I lanplus … mc info` | `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" mc info 2>&1` |
| 1119 | 00411 | ssh 包 selftest | `ipmitool … selftest 2>&1` |
| 1122 | 00414 | ssh 包 power status | `ipmitool … power status 2>&1` |
| 1123 | 00415 | ssh 包 raw 0x0a 0x49 | `ipmitool … raw 0x0a 0x49 2>&1` |
| 1188 | **00480** | ssh 包 hard-coded `0x12 0x82 0x01` | `… raw 0x04 0x00 ${RECV_BYTES_HEX:?operator must provide the event receiver request data bytes in hex} 2>&1` |
| 1189 | 00481 | ssh 包 raw 0x04 0x01 | `ipmitool … raw 0x04 0x01 2>&1` |
| 1190 | **00482** | ssh 包 hard-coded `0x00 0x10 0x00` | `… raw 0x04 0x02 ${EVENT_BYTES_HEX:?operator must provide the platform event request data bytes in hex} 2>&1` |
| 1218 | 00510 | ssh 包 raw 0x0a 0x10 0 | `ipmitool … raw 0x0a 0x10 0 2>&1` |
| 1219 | 00511 | ssh 包 fru print 0 | `ipmitool … fru print 0 2>&1` |

改後全 9 行: 無 `sshpass` / 無 `$DUT_USER@$DUT_IP` / 有 `-C 17`。
00480 / 00482 額外: 有 `${RECV_BYTES_HEX:?…}` / `${EVENT_BYTES_HEX:?…}` (R7 placeholder + R30 無反引號)。

### 1.3 Reliability 2 行 (含在 336 內)

| data_index | code | 改 |
|---|---|---|
| 142 | Robust-00022 | 原 `ipmitool -I lanplus` 加 `-C 17` |
| 143 | Robust-00023 | 同上 |

(這 2 行仍保留 ssh 包外殼 — 不在 R31 拆包範圍, 只加 `-C 17`。)

---

## 2. 驗證對照

### 2.1 零回歸 (vs `…_w11pre` backup)
- 差異 = **336 行 × `ai_commands` 一欄**; 其餘 17 欄 + 其它 5 sheets = 0 diff。
- `ai_can_execute` **0 改動**; `risk` / `ai_packages_needed` / `ai_logs_output` 0 diff。
- in-band ipmitool segment (無 `-I lanplus`): **0 被加 `-C 17`** (strict token-by-token vs backup 比對)。
- 無 `-C 17 -C 17` 重複 (0 cells)。

### 2.2 6969 spot-check (13 PASS)
```
R31 00408 [Wistron-BMC-00408-V003] : PASS (無 ssh, 有 -C 17)
R31 00411 : PASS
R31 00414 : PASS
R31 00415 : PASS
R31 00480 : PASS (有 RECV_BYTES_HEX)
R31 00481 : PASS
R31 00482 : PASS (有 EVENT_BYTES_HEX)
R31 00510 : PASS
R31 00511 : PASS
IB  00353 / 00354 / 00384 : in-band 未加 -C 17 (PASS)
T1  00099 [Wistron-BMC-00099-V004] : 有 -C 17 (PASS)
```

### 2.3 真機驗証
```
$ ipmitool -I lanplus -C 17 -H 10.35.228.145 -U root -P 0penBmc mc info
Device ID                 : 32
Firmware Revision         : 3.08
IPMI Version              : 2.0
Manufacturer Name         : Wistron Corporation
PASS
```

---

## 3. 未 commit / 未 push / 未 stage

- Working tree: `data/REVISED_commands_merged_with_raw.xlsx` (M) + `data/tests.json` (M).
- NOT staged: `123.txt`, `data/11.RestAPI/`, `data/12.RestAPI/`, `*.bak_*`.
- md5 = `a93b9341e5d0b7f5cc5352753df737c2` (repo == prod == /tmp, 3-way 一致).

---

## 4. 剩餘 ssh 包 + lanplus 組合（不在本視窗 R31 9 行範圍內）

全庫掃還有 **65 cells** 仍含 `sshpass … ssh … "ipmitool -I lanplus …"` 組合,
本視窗只拆了 TASK 明示的 9 行（00408/00411/00414/00415/00480/00481/00482/00510/00511）。
其餘 65 個跨 HW/BIOS/BMC 各 family:

- **Reliability 2**: di=142 `Wistron-HW Robust-00022-V002` / di=143 `Wistron-HW Robust-00023-V002`
  — ssh 包只套 `ipmitool -I lanplus … mc info | grep Firmware Revision` 驗證段,
    功能可用但位置不合 R5。
- **Functionality 63** (含 HW/BIOS/BMC):
  Ex 樣本:
  - di=1842 `Wistron-BMC-00002-V002` STATUS_LOW_FAN (含 in-band `ipmitool sensor list` + ssh lanplus `sensor get`)
  - di=1843 `Wistron-BMC-00003-V002` STATUS_PSU (同上)
  - di=111/164/174-182 (HW 群)
  - di=233/237/246-282/331/342/378 (HW/BIOS 群)
  - di=736/737/812/813/911/985/986/988 (BMC-00028/00029/00104/00105/00203/00277/00278/00280)
  - di=1398/1431/1482/1506/1595-1597/1600/1608-1614/1625/1678/1742-1743/1763 (BMC/BIOS/HW 各)
  - di=1961/2148/2226/2228/2277 (BMC/NV/HW)

是否要拆由後續視窗用戶拍板; 拆包方式(去 sshpass 外殼→agent-host 直跑)同本視窗 W11 9 行套路,
只要 operator 確認「agent 可直連 BMC」即安全, 不需新规则。

---

## 5. 下視窗口徑 (不變)

- **data_index 1384..1583** = Wistron-BMC-00676-V003 → Wistron-BMC-00875-V003 (200 rows)
- 游標校驗: di 1383 = 00675 / 1384 = 00676 / 1385 = 00677 (連號對得上)
- 判定分佈不變: YES 98 / PARTIAL 73 / NO 29 (di 0..1383)
- 規則: REVIEW_WORKFLOW_LOGIC.md (R5/R26/R27/R28/R30/R31)

---

## 6. 檔案路徑
| 檔 | 路徑 |
|---|---|
| 入口 | `OPENHANDS_PASTE_NEXT_WINDOW.md` (已更新指向本檔) |
| 本檔 | `SESSION_HANDOFF_WINDOW11_TASK_CIPHER_R31_DONE.md` |
| 任務書 | `SESSION_HANDOFF_WINDOW11_TASK_CIPHER_R31.md` |
| 主 xlsx | `data/REVISED_commands_merged_with_raw.xlsx` (本視窗 336 行改了 `ai_commands`) |
| 備份 | `data/…xlsx.bak_batch_20260905_w11pre` (W10 後 / W11 改前 快照) |
| tests.json | `data/tests.json` + `/srv/pa-manager-prod/data/tests.json` (md5 `a93b9341…`) |
| build | `scripts/build_testlib_json_xlsx.py` |
| W11 腳本 | `/root/w11_fix.py` |
