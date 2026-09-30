# W17 — REMAINING SCOPE: 5 non-Functionality sheets = 821 rows

> **W17 視窗本輪範圍**（用戶指令 2026-08-18）：Compatibility sheet 前 100 行 (excel rows 2..101, 100 行)。W18+ 視窗續掃。
> 每視窗 100 行；**3112 行覆蓋 = 需要 W17 + W18+ 共 ~ 31 視窗**（本視窗 = 1/31 進度）。

## W17 SOP 增補：語義層抽樣 (NEW，W17 起適用，W18+ 沿用)

> **背景**：W9-W16 的「detector 全跑 + 白名單逐行點名 + 零回歸 + 三向 md5 + spot-check」流程對「**模式性 defect**」（假命令、bare command、重複 redirect、占位寫錯、sshpass 變體）很強，但**抓不到語義層錯誤**——即「命令格式對、能跑，但**用錯 sensor 名 / 用錯 Redfish path / 判定 YES 但這型機器其實不支持 / 該加 read-back 沒加 / 邏輯跑偏**」。
> 語義層靠**人讀懂**才能發現，純 detector 保證不到。以下 SOP 補上這一層。

### 語義層抽樣規則 (W17 SOP-SEM)

1. **抽樣範圍**：只對本視窗 `ai_can_execute=YES` 的**會真執行**的行做；PARTIAL/NO 描述行**不做逐字語義讀**（保守 + 成本），但會被 detector 掃到（如 R29 bare / R10 dup / R7 placeholder）仍照修。
2. **抽樣數量**：若視窗 YES 行 ≤5 → 全讀；若 YES 行 6-30 → 抽 ≥50%；若 YES 行 >30 → 抽 ≥15 行（覆蓋每個 Sub Function / Test Set 至少 1 行，優先抽「風險高」行如 power cycle / user create / sensor threshold）。
3. **讀法**：每抽到 1 行，**人工把 4 欄一起讀** —
   - `Description` / `Procedure` / `Criteria` (原始測試意圖)
   - `ai_commands` (AI 要跑的實際命令)
   對以下 5 類語義缺陷**逐字核**：
   - **S1 命令 vs 意圖**：命令是否真的在測 `Procedure` 說的事 (例: 說 "test power cycle recovery" 但命令只 `power off` 沒有 `power on` + read-back)
   - **S2 參數合理性**：sensor 名 / 端口 / UUID / path 是否合理 (例: `sensor get 'TEMP_PDB_PSU1'` 這型機器真的叫這名？)
   - **S3 判定合理性**：`ai_can_execute=YES` 的依據是否站得住 (例: 需要 BMC admin 權限但 `BMC_USER` 可能無權 → 應 PARTIAL)
   - **S4 輸出合理性**：`ai_logs_output` 是否描述得對 (例: 命令回傳數字但 logs 說是 "string")
   - **S5 副作用合理性**：命令是否會造成不可逆 / 高風險 (例: `power off` 不 read-back = 高風險應標 risk)
4. **判定輸出**：抽到的每行**逐字**輸出 5 類核對結果 (PASS / DEFECT)。DEFECT 行**不強推改**，先寫到「W17 語義 findings」表（在 W17 視窗末尾的 `SESSION_HANDOFF_WINDOW17_SEM_FINDINGS.md`），**交用戶 GO 才修**。
5. **紅線**（沿用）：`ai_can_execute / risk / ai_packages_needed / ai_logs_output` 保守不改；只有 `ai_commands` 可改且**僅修 detector 已確認 + 語義層已核**的缺陷。

### 語義抽樣 ≠ 全庫重跑

**不是**「重跑 3112 行逐字語義」——**是**「每個視窗抽樣 100 行內的 YES 行做深讀」。31 視窗 × 每視窗抽 ≥50% YES ≈ 全庫覆蓋，但每視窗成本可控。

### W17 視窗實例 (本輪)

- 範圍：Compatibility rows 2..101 (100 行)
- YES 行分布：TBD (dump 後填)
- 若 YES 行 = 0 → 語義層 0 抽樣 → 本視窗 = detector only → 0 改 = 正常結果
- 若 YES 行 = N → 按 SOP-SEM 抽樣 ≥min(50%N, 15) 行 逐字語義讀

> W16 (this session) completed STEP A (apply W15's 85 cells, di 1884..2083) + STEP B (audit di 2084..2291, 20 cells). Functionality is now 2291/2291 = 100% covered.
> The user's directive is full-library 3112 rows. Remaining = STEP C only.

## Status at W16 close

| item | value |
|---|---|
| xlsx md5 | `273be53906782e9b410e14fc7a5f202c` (W16 STEP B final) |
| tests.json md5 | `65e003bb4d968621ce9a6b23f931cfff` (repo == prod == /tmp) |
| git HEAD | `2a109d5` — no commit/stage/push |
| _w15pre backup | `data/…xlsx.bak_batch_20260905_w15pre` (md5 `c504ba97…`, pre-W15-apply baseline) |
| _w16pre backup | `data/…xlsx.bak_batch_20260905_w16pre` (md5 `56085381…`, = STEP A 完成後 / STEP B 前) |
| W17 snapshot (to take) | W17 S1 應另存 `_w17pre` = 当前本體 md5 `273be539…` (= _w16pre + STEP B 20 cells) |
| STEP B dump | `/tmp/w16_stepB_window.txt` (200 rows) |
| STEP B sandbox | `/tmp/w16_sandbox.xlsx` (= W15 85 cells + W16 STEP B 20 cells) |
| W16 scripts | `/root/w15_fix.py` (STEP A), `/root/w16_fix.py` (STEP B) |

## STEP C scope (W17)

5 sheets, 821 rows, **all never audited by any W9-W16 window**. Same rules as Functionality (R5/R7/R10/R18/R19/R22/R24/R26/R27/R28/R29/R30/R31 + KEEP guards). Audit detectors carried from W15/W16 (bare commands, `2>&1 2>&1`, `<placeholder>`, `sshpass -p "$BMC_USER"`, in-band vs OOB, R28 redfish path, R31 `-C 17`):

| sheet | rows | ai_can=YES | rough bare-command hits (cell w/o ipmitool) | notes |
|---|---|---|---|---|
| **Compatibility** | 459 | **162** | 2 | LARGEST, most YES rows → do FIRST |
| **Reliability** | 202 | 5 | 2 (already have -C 17 per W11) | |
| **Stability** | 88 | 0 | 0 | description-heavy |
| **Performance** | 60 | 0 | 0 | description-heavy |
| **(No Main Function)** | 12 | 1 | 0 | tiny |
| **total** | **821** | **168** | | |

## Suggested W17 per-sheet SOP (identical to W10-W16)

Per sheet:
1. **S1** snapshot `data/…xlsx.bak_batch_20260905_w17_<sheet>`
2. **S2** dump + full audit (dump to `/tmp/w17_<sheet>.txt`), flag:
   - bare `sensor get / chassis status / sel info / sdr list / mc info` (segment has no ipmitool) — R29
   - `2>&1 2>&1` adjacent duplicates — R10
   - bare `<PLACEHOLDER>` in ai_commands — R7 (PARTIAL description rows are KEEP by W14-1688 / W15-1973 policy)
   - `sshpass -p "$BMC_USER"` anomaly — same class as W16 D-finding
   - in-band `ipmitool ... sensor get/chassis/sel/...` without `-I lanplus` — KEEP (per R26+KEEP)
   - R28 redfish non-canonical paths (`/Systems/1`, `/Managers/1`) if present
   - R31: `-I lanplus` without `-C 17` (W11 already did this for Functionality + Reliability; re-verify)
3. **S3** DRY with the W16 pattern (script under `/root/w17_fix.py` per sheet, or a single script with sheet param)
4. **S4** APPLY + self-audit (expect post-audit NONE)
5. **S5** zero-regression vs `_w17_<sheet>` snapshot (expected cells = flagged count)
6. **S6** build 3112/6 + cp twice + 3-way md5
7. **S7** spot-check: all YES rows (or ≥15 rows if YES count is bigger) EXACT
8. **S8** after all 5 sheets: DONE handoff `SESSION_HANDOFF_WINDOW17_FULL_3112_DONE.md` + optional W18 = 全庫 final verification window.

## Red lines (unchanged)

- ai_can_execute / risk / ai_packages_needed / ai_logs_output: no non-conservative change
- in-band ipmitool (no `-I lanplus`) never touched
- nested-quote ssh shells KEEP
- R7 `:?` messages: no backticks, no double quotes
- 0 commits / 0 pushes / 0 stages unless user says so explicitly
- `123.txt`, `data/11.RestAPI/`, `data/12.RestAPI/`, `*.bak_*` stay untracked
- code: pure ASCII; CJK only in handoff markdown
- Anchor on **Code + excel row per sheet** (W15 off-by-one lesson)
- bare-command regex allows spaces in sensor names: `[^']+` up to closing quote

## Reading order for W17

1. This doc (W17 scope)
2. `SESSION_HANDOFF_WINDOW16_SCOPE_CHANGE_FULL_3112.md` (original directive + inventory)
3. `REVIEW_WORKFLOW_LOGIC.md` (rules R1-R30 + R31)
4. `SESSION_HANDOFF_WINDOW15_REVIEW_1884_2083_PENDING.md` §1.2 + §3 (regex + sandbox + KEEP guard references)
5. Latest `_w17pre_*` backup = current `data/REVISED_commands_merged_with_raw.xlsx.bak_batch_20260905_w16pre` md5 `273be53906782e9b410e14fc7a5f202c`
6. `/root/w15_fix.py`, `/root/w16_fix.py` — reference implementations (DRY + sandbox + strict post-audit pattern)

## W16 STEP B defect list (applied, verified)

- A (R29) 2 rows: 2202/2274 (Wistron-HW-00483-V002, duplicate) — `sensor get 'Sensor Check - PDB'` whole-cell rewrite to OOB ipmitool
- C (R10) 15 rows: 2135, 2150, 2166, 2195, 2214, 2215, 2216, 2228 (x2), 2229, 2243, 2245, 2247, 2248, 2257, 2259 — adjacent `2>&1 2>&1` dedup
- D (anomalous var) 6 rows: 2224, 2226, 2233, 2243, 2248, 2257 — `sshpass -p "$BMC_USER"` → `"$BMC_PASS"` (username `$BMC_USER` unchanged)
- KEEP: 2090 (Wistron-AMD SVM-00134-V003, `<val>` in PARTIAL description — W15-1973 placeholder policy); 3 rows (2243/2248/2257) got both C+D
- Union = 20 rows = 20 ai_commands cells; other 5 sheets + 17 cols 0 diff; 25/25 spot-check EXACT
