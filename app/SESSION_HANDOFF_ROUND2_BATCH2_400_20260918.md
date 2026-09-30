# 交接檔 — Round-2 正式 3112 review 第 201–400 條(2026-09-18)

> 給下一個視窗:先讀本檔 + SESSION_HANDOFF_ROUND2_SAMPLES_20260918.md + REVIEW_WORKFLOW_LOGIC.md(§十八 a–l / §十九 m–u / §二十 v–aa / §二十一 鎖版)。
> 本視窗做:**Functionality row 202–401 共 200 條 review + 36 條缺陷實際修進 xlsx + 零回歸驗證**,報告續寫 `review_round_02_functionality.md`。

---

## 0. 本視窗交付物

| 檔案 | 作用 |
|---|---|
| `review_round_02_functionality.md`(5459→11088 行) | 新增第二批(第 201–400 條)逐條「8問+5段+§十八 h 三項+verdict」+ 批次說明/統計/累計 |
| `data/REVISED_commands_merged_with_raw.xlsx`(working tree) | **36 條 `ai_commands` 已實際修改**(見下) |
| `scripts/fix_rev02_batch2.py` / `fix_rev02_batch2b.py` | 本批改 xlsx 的腳本(row 定位,非 code 定位,避一碼多行誤改) |
| `scripts/gen_rev02_batch2.py` | 本批報告產生器 |
| `data/REVISED_commands_merged_with_raw.xlsx.bak_rev02_batch2_20260906_004303` | 修改前備份 |

**mojibake**:cyrillic=0 / U+FFFD=0。**git HEAD `5a60875`**。

---

## 1. 本批 200 條 review 結果(第 201–400 條)

**verdict(§二十一 鎖版)分布(本批)**:
| verdict | 條數 |
|---|---|
| NO/PHYSICAL | 52 |
| PARTIAL | 93 |
| YES | 55 |

**累計(第 1–400 條)**:NO/PHYSICAL **160** / PARTIAL **169** / YES **71**(=400)。

**本批區塊**:USB(203–207)→ ME/SPS(208–218)→ BIOS-ROM/FW/Recovery/Bitlocker(219–247)→ SSD/NVMe(244–252)→ RAID(258–269)→ HDD/SAS-SATA(270–285)→ NIC/MLNX/GPU(286–331)→ AC/Warm/Cold reboot(330–332)→ BIOS 全家族 00002~00069(334–401)。

---

## 2. 本批缺陷已實際修進 xlsx(36 條 `ai_commands`,2026-09-18)

| class | 條數 | 對應編號 |
|---|---|---|
| Q-LIT(ssh 內層 grep 雙引號→單引號) | 21 | HW-00212/14/15、00228、00239、00301/03、00310/11/12/16/17/18、BIOS-00003、00031/32/33/34/36/38、00055 |
| E-DQ(ssh 內層 echo 雙引號→單引號) | 14 | 同上多數 + BIOS-00011/00056、00056、HW-00235/50/54、00261/67/86/92/94、00300/10/12 |
| DBL-SSH(遠端內再包一層 sshpass/ssh → 收斂單層) | 9 | BIOS-00003、00055、HW-00261/86/94、00310/17/18/19 |
| R5(OOB ipmitool lanplus 誤包 DUT-ssh → 移 agent host) | 3 | HW-00250、00254、BIOS-00011(BMC recovery 類) |
| §十九 o 假完成(fio --version → 真 job-file 預寫法) | 2 | HW-00258、00269 |
| §十八 b(vendor slot 未標) | **未改** | ME(intelmetool/mei-amt-check)/NVSM/DCGM 等依 §十九 r 標 `${TOOL_PATH:?}`、operator 提供;本批僅記註 |

> 多類在某些 row 重疊,故**獨特 row = 36**。判定(ai_can_execute)本批**全未改**,只修 `ai_commands` 內文。

---

## 3. 零回歸已驗證

- build:`python3 scripts/build_testlib_json_xlsx.py data/REVISED_commands_merged_with_raw.xlsx /tmp/tests_new.json` → **total=3112 / 6 sheets 不變**。
- 對 HEAD(git `5a60875` 已含 batch1 的 37 條)xlsx:恰 **36 cells** 變動,全部 **Functionality sheet × col 15(ai_commands)**,其它欄位(ai_can_execute/risk/ai_logs_output/結構)零變動。
- cyrillic=0 / U+FFFD=0。

---

## 4. git / data 現況(⚠️ 紅線)

- **HEAD = `5a60875`**(commit: batch1 37 條 + sync tests.json)——已比上份交接往前(上一份交接說 HEAD `c588ef2`,現在 batch1 已被 operator commit+sync)。
- **當前 working tree**:xlsx 已 M(本批 36 條);`review_round_02_functionality.md` 已 M;新增 3 scripts + 1 backup(untracked)。
- **`data/tests.json` 未被本視窗改動**(git status 無 M)——仍 = HEAD(batch1 已 sync 版本)。**未 cp /srv/pa-manager-prod / 未 commit / 未 push。**
- **依 §十九 n / 紅線:push/commit/tests.json 同步一律等 operator 說才做。本視窗 0 commit / 0 stage / 0 push。**
- 本視窗碰的檔案:僅 `data/REVISED_commands_merged_with_raw.xlsx`(col15 36 cells)、`review_round_02_functionality.md`、新增 3 scripts + 1 backup。其它 working-tree 未 commit 檔(`data/ADDITIONS.csv` / `data/REVISED_commands.csv` / `static/*` / `OPENHANDS_PASTE_NEXT_WINDOW.md`)為先前遺留/非本視窗所改,不動。

---

## 5. 下一視窗任務

1. 續跑 Functionality row 402–601(**400→600**,全表 2291,已完成 400)→ 每 200 條存檔 + 自動給交接文(規則沿用)。
2. 遇新類型缺陷照樣「邊 review 邊改 xlsx」:改完 build → 零回歸(只能差該批)→ 記進交接檔 + 註明已修。
3. `data/tests.json` 同步 / commit / push **一律等 operator 說才做**(§五 SOP / 交接紅線)。
4. 報告檔 `review_round_02_functionality.md` 續寫(加第 3 批 stats + 逐條)。

> 注意:本批抓到 batch1 沒有的**新類缺陷**(E-DQ / DBL-SSH / R5 / fio-fake)——非疏漏,是「跨區塊才出現的寫法」;規則全沿用 Round-1/本輪已拍板,不需再問 operator。

---

## 一句話

第 201–400 條 review 完畢(NO 52 / PARTIAL 93 / YES 55,累計 400)+ 36 條缺陷已實際修進 xlsx(21 Q-LIT + 14 E-DQ + 9 DBL-SSH + 3 R5 + 2 fio-fake)+ 零回歸通過(恰 36 cells 全 ai_commands);tests.json/commit/push 等 operator。下一視窗續跑 400–600。
