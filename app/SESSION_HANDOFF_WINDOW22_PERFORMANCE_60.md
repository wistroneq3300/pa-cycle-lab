# W22 — next window: Performance sheet (60 rows)

> **W21 = Stability sheet (88 rows, ai_can=0) — DONE this session**
> W22 (this doc) = **Performance sheet (60 rows)**. After W22 → W23 = (No Main Function) (12), then the full 6-sheet library (3112 rows) is 100% reviewed.

## W21 close-of-window (this session's result)

| item | value |
|---|---|
| xlsx md5 (post-apply) | `d7aa858f91098c6f762c31f2a7d17fe9` (pre-W22) |
| tests.json md5 (repo == prod == /tmp) | `6d441e17944a988c6ac4876daa537399` |
| git HEAD | `c588ef2` — **NO commit/stage/push this window** (red line respected) |
| xlsx backup taken (S1) | `data/REVISED_commands_merged_with_raw.xlsx.bak_batch_20260905_w21pre` (md5 `9d2b85add9bfcfcd52d2406b3c5aed54` = post-W20, pre-W21) |
| W21 fix script | `/root/w21_fix.py` (DRY + APPLY + post-audit; Q-LIT regex + R10 dedup; no NESTED-exclude set — none found in Stability) |
| W21 detector | `/root/w21_dump.py` (dumps 88 rows → `/tmp/w21_stab.json`) |
| Stability sheet rows 1..88 status | **DONE: 5 cells applied across 5 rows (all Stability.ai_commands). Stability sheet now 100% reviewed (88/88).** |

## W21 applied cells (S4+S5) — 5 cells across 5 rows, all Stability.ai_commands

S5 zero-regression PASS: exactly these 5 cells differ from `_w21pre`, no other sheet/col touched.

| excel row | Code | class | fix |
|---|---|---|---|
| 70 | Wistron-Long Term Stress-00069-V004 | R10 | `systemctl reboot 2>&1 2>&1` → `2>&1` |
| 71 | Wistron-Long Term Stress-00070-V003 | R10 | `systemctl reboot 2>&1 2>&1` → `2>&1` |
| 72 | Wistron-Long Term Stress-00071-V003 | Q-LIT | `echo "hibernate disabled"` → `echo 'hibernate disabled'` (inside ssh remote) |
| 75 | Wistron-Long Term Stress-00074-V002 | Q-LIT+R10 | `egrep -i "crc\|err"` → `egrep -i 'crc\|err'` AND `done 2>&1 2>&1` → `2>&1` |
| 76 | Wistron-Long Term Stress-00075-V002 | Q-LIT | `echo "---crc after---"` → `echo '---crc after---'` AND `egrep -i "crc\|err"` → `egrep -i 'crc\|err'` (both inside ssh remote) |

**Changed-cell verification**: `rows:5 cells:5 cols:{'ai_commands':5}`, all ai_commands-only. post-audit `dup-still-present: NONE`. DRY=5, mismatch 0, manual 0 (no Q-VAR: none of the inner literals contained `$` or `\`).

## W21 audit note (detector hits — all verified, none left open)

- Only 6 detector-hit rows (68, 70, 71, 72, 75, 76). Rows 70/71/72/75/76 fixed as above. **Row 68 was a FALSE-POSITIVE**, verified benign, KEEP:
  - row 68 (Wistron-Long Term Stress-00067-V004, AC Cycle) — the `inband_ipmitool` hit is only the *prose word* "…can read BMC SEL via ipmitool…" in the `-- …` description prefix; ai_can=PARTIAL, human/PDU-only test (1000 AC cycles). No executable ipmitool command → not a defect, untouched.
- **No NESTED (nested-sshpass-inside-ssh) rows in Stability.** Detector found zero. So unlike W20/W19, this window opens NO new NESTED findings.
- No in-band ipmitool command actually executed; no `-C 17` gaps; no R28 redfish path; no R7 placeholder in ai_commands.

## SOP-SEM (W21)

Stability has **ai_can=YES = 0** (66 NO / 22 PARTIAL). Per W17 SOP-SEM rule "YES ≤ 5 → all read": **0 YES → detector-only window, no verbatim semantic sampling required.** Semantic layer = N/A (all Stability rows are description-heavy, ai_can is NO/PARTIAL, nothing the agent would auto-run). Detector false-positive row 68 was human-verified (see above).

## W22 scope (Performance, 60 rows)

**W22 = the Performance sheet (60 rows, ai_can=0).** After W22 → W23 = (No Main Function) (12) → full 3112/6 = 100% reviewed.

SOP unchanged (from W19/W20/W21 docs):
1. S1 `cp data/REVISED_commands_merged_with_raw.xlsx data/...bak_batch_20260905_w22pre` (baseline md5 to be `d7aa858f…`)
2. S2 detector dump performance rows → `/tmp/w22_perf.json` (use `/root/w21_dump.py` pattern with SHEET="Performance")
3. S3 DRY (Performance-specific whitelist)
4. S4 APPLY + post-audit
5. S5 zero-regression vs `_w22pre` (only Performance.ai_commands expected)
6. S6 build 3112/6 → cp to repo `data/tests.json` + `/tmp/w22_tests_build.json` + prod `/srv/pa-manager-prod/data/tests.json` → 3-way md5
7. S7 spot-check (EXACT xlsx==tests.json on all changed rows + full 88-consistency pattern)
8. SOP-SEM: YES ≤ 30 → 全部 YES 逐字核 (if 0 YES → detector-only as in W21)

**Red lines (unchanged from W17-W21):**
- `ai_can_execute / risk / ai_packages_needed / ai_logs_output`: no non-conservative change
- in-band ipmitool (no `-I lanplus`) never touched
- R7 `:?` messages: no backticks, no double quotes
- 0 commits / 0 pushes / 0 stages unless user says so explicitly
- `123.txt`, `data/11.RestAPI/`, `data/12.RestAPI/`, `*.bak_*` stay untracked
- code: pure ASCII; CJK only in handoff markdown
- Anchor on **Code + excel row per sheet** (W15 off-by-one lesson)

**Backup chain through W21:**
- `_w16pre` (56085381…) → `_w17pre` (273be539…) → `_w18pre` (8db23735…) → `_w19pre` (2f9a854c…) → `_w20pre` (d5eb8572…) → **`_w21pre` (9d2b85ad…)**

## Reading order for W22

1. This doc (W22 scope + W21 results)
2. `SESSION_HANDOFF_WINDOW21_STABILITY_88.md` — W20 results + full SOP + W20 open findings (they persist; see below)
3. `SESSION_HANDOFF_WINDOW17_REMAINING_5_SHEETS.md` — SOP-SEM block + full 5-sheet scope + redlines
4. `/root/w21_fix.py` — reference implementation (copy for /root/w22_fix.py)

## Still-open findings spanning prior windows (user-decision items, NOT touched by W20/W21)

These carry over; each is in a sheet already claimed DONE but the finding row was deliberately left for user GO (structural / semantics, never auto-touched):

| window | rows | defect class |
|---|---|---|
| W19 | Compat 42/124/125 | nested sshpass inside ssh remote string |
| W19 | Compat 141 | DBLBS `echo -n \\"GPU$n \\"` (same as fixed row 405) |
| W19 | Compat 85/104/110/112/118 | bare inner `echo "== $d =="` Q-LIT |
| W20 | Reliability 143/150/151/152/154 | nested sshpass inside ssh (+ inner Q-LIT / dup `2>&1 2>&1`) |

> None of these is in Performance (W22). They are logged here so the library owner can GO them at the end (any window), or defer to a dedicated full-library follow-up.

## W22 GO — (copy verbatim):

> 0. 你是 W22。先讀 /root/sheng/manager/pa_manager/SESSION_HANDOFF_WINDOW22_PERFORMANCE_60.md
>    W22 = Performance sheet (60 行, ai_can=0)。
>    照 W21 SOP 走: S1 備份 _w22pre → S2 audit → S3 DRY → S4 APPLY+audit → S5 零回歸 → S6 build+三向 → S7 spot-check。
>    修補 pattern 照 /root/w21_fix.py 模板。
>    W18-W21 待 GO findings 見本 doc 開頭承接表 (都外於 Performance 視窗, 不 auto-touch) 等用戶決定再動。
>    我 GO 才 GO。
