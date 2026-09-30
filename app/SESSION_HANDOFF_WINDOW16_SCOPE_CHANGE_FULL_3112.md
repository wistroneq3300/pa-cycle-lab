# W16 scope change — user directive: review ALL 3112 rows (6 sheets), not just Functionality

> 2026-08-18 — user instruction to W16 (supersedes "STEP B = closing window" in
> `SESSION_HANDOFF_WINDOW15_REVIEW_1884_2083_PENDING.md` §3.2).

## New scope

W16 = **full-library window**:

| Part | What | Status at handoff |
|---|---|---|
| STEP A | APPLY W15's 85 cells (di 1884..2083) + S5 zero-regression + S6 build/3-way md5 + S7 spot-check | unchanged, SOP still valid |
| STEP B | REVIEW Functionality di 2084..2291 (excel rows 2086..2292, 208 rows) | unchanged, SOP still valid |
| **STEP C (NEW)** | REVIEW the other **5 sheets = 821 rows** (never audited by any window) | see below |
| S8 | handoff = W17 full-library final verification (all 6 sheets + 3-way md5) + DONE recap | re-scoped |

After W16: **3112/3112 = 100%** (previous "100%" claim meant Functionality-only; corrected here).

## STEP C audit inventory (measured on c504ba97... baseline, read-only)

All 5 sheets: 18 cols, same layout as Functionality. `ai_commands` filled on every row.

| sheet | data rows | ai_can=YES | rough bare-command hits (sensor get/chassis/sel/sdr/mc info, cell w/o ipmitool) |
|---|---|---|---|
| Reliability | 202 | 5 | 2 (W11 already added -C 17 to these 2) |
| Performance | 60 | 0 | 0 |
| Compatibility | 459 | 162 | 2 (need per-row audit) |
| Stability | 88 | 0 | 0 |
| (No Main Function) | 12 | 1 | 0 |
| **total** | **821** | **168** | |

Priority in STEP C: rows with `ai_can=YES` first (168 rows will actually execute), then
PARTIAL/NO rows for defects (bare commands / R7 placeholders / R28 paths / adjacent 2>&1)
same as W10-W15; conservative, ai_commands-only edits, 0 changes to ai_can_execute.

## Rules carried over (no exceptions)

- `REVIEW_WORKFLOW_LOGIC.md` R5/R6/R7/R18/R19/R22/R24/R26/R27/R28/R29/R30 + R31 (W11 cipher -C 17)
- Anchor on **Code + excel row per sheet**, not di labels (W15 off-by-one lesson)
- bare-command regex must allow spaces in sensor names: `[^']+` up to closing quote
- in-band ipmitool (no `-I lanplus`) never strip; KEEP guards (DUT-local ssh shells,
  nested quotes, $MANAGER/$LOGS/$ENTRY placeholders, NO/PARTIAL description rows)
- ai_can_execute / risk / ai_packages_needed / ai_logs_output: no non-conservative change
- R30: no backticks / double quotes inside `${VAR:?...}` messages
- no commit / push / stage unless user explicitly asks; bak_*/123.txt/RestAPI stay untracked
- S5 zero-regression each apply: vs sheet-specific `_w16pre` backup, changed cells must match
  the fix list EXACTLY; all other sheets 0 diff
- S6 build 3112 / 6 sheets + 3-way md5 (repo == prod == /tmp) after every apply batch
- code pure ASCII; CJK only in markdown handoff docs

## Status at write time (unchanged baseline)

- xlsx `c504ba97...` = `_w15pre`; tests.json `8a3c6ca0...` repo==prod; git HEAD 2a109d5 clean worklog
- W15 PENDING doc remains the authoritative SOP for STEP A; this doc only ADDS STEP C + re-scopes S8

## UPDATE (W16 session, after GO)

- **STEP A DONE**: 85 cells applied (post-audit NONE; vs _w15pre exactly 85 Functionality.ai_commands cells, 0 other; build 3112/6; 3-way md5 d254e8f7...; spot-check 16/16 EXACT).
- **STEP B DONE**: Functionality di 2084..2291 reviewed, 20 cells applied (A2 R29 / C15 R10 / D6 sshpass var; post-audit NONE; vs _w16pre exactly 20 cells, 0 other; build 3112/6; 3-way md5 65e003bb4d968621ce9a6b23f931cfff; spot-check 25/25 EXACT).
- Functionality = 2291/2291 (100%). W16 session ends here per user; **STEP C handed to W17**.
- W17 entry: SESSION_HANDOFF_WINDOW17_REMAINING_5_SHEETS.md.
