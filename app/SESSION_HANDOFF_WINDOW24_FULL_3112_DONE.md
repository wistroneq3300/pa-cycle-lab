# W24 — FULL LIBRARY DONE: 3112/3112 = 100% reviewed

> **W22 (Performance 60) + W23 ((No Main Function) 12) — DONE this session.**
> With these two windows, every one of the 6 sheets is 100% reviewed:
> Functionality 2291 · Compatibility 459 · Reliability 202 · Stability 88 · Performance 60 · (No Main Function) 12 = **3112/3112 = 100%**.

## W22 close-of-window (Performance, 60 rows, ai_can=0 YES / 60 PARTIAL)

| item | value |
|---|---|
| xlsx md5 (post-W22) | `04ce86869f6a6ccb55f8f74013af98d3` (pre-W23 = post-W22) |
| tests.json md5 (post-W22, 3-way repo==prod==/tmp) | `7d2d7464dfdd4b17b0409d6246feaaff` |
| git HEAD | `c588ef2` — **NO commit/stage/push** (red line respected all session) |
| xlsx backup (S1) | `data/REVISED_commands_merged_with_raw.xlsx.bak_batch_20260905_w22pre` (md5 `d7aa858f…` = post-W21, pre-W22) |
| W22 fix script / detector | `/root/w22_fix.py` / `/root/w22_dump.py` (`SHEET=Performance`) |
| Performance sheet rows 1..60 status | **DONE: 4 cells applied across 4 rows (all Performance.ai_commands). Performance sheet now 60/60 = 100%.** |

### W22 applied cells (S4+S5) — 4 cells across 4 rows, all Performance.ai_commands

S5 zero-regression PASS: exactly these 4 cells differ from `_w22pre`, no other sheet/col touched.

| excel row | Code | class | fix |
|---|---|---|---|
| 17 | Wistron-Performance Networking-00032-V004 | Q-LIT ×3 | `egrep -i "crc\|err"` → `'crc\|err'` (×2: before/after) + `echo "---run---"`→`'---run---'` + `echo "---after---"`→`'---after---'` |
| 37 | Wistron-Performance GPU-00053-V003 | Q-LIT | `grep -iE "tensorflow\|pytorch\|jax"` → `'tensorflow\|pytorch\|jax'` |
| 39 | Wistron-Performance GPU-00055-V004 | Q-LIT | `grep -iE "xGMI\|read\|write\|b/w"` → `'xGMI\|read\|write\|b/w'` |
| 47 | Wistron-Performance Networking-00001-V004 | R10 | `ib_write_bw -d mlx5_0 --report_gbits 2>&1 2>&1` → `2>&1` |

**Verification**: `rows:4 cells:4 cols:{'ai_commands':4}`; post-audit `dup-still-present: NONE`; DRY=4, mismatch 0, manual 0; xlsx==json 60/60 EXACT; 4 changed rows EXACT (all fixes present).

## W23 close-of-window ((No Main Function), 12 rows, ai_can=1 YES / 8 PARTIAL / 3 NO)

| item | value |
|---|---|
| xlsx md5 (post-W23) | `04ce86869f6a6ccb55f8f74013af98d3` (**UNCHANGED** — W23 applied 0 cells) |
| tests.json md5 (post-W23, 3-way) | `7d2d7464dfdd4b17b0409d6246feaaff` (**UNCHANGED** — rebuild identical) |
| xlsx backup (S1) | `data/REVISED_commands_merged_with_raw.xlsx.bak_batch_20260905_w23pre` (md5 `04ce8686…` = post-W22, pre-W23) |
| (No Main Function) rows 1..12 status | **DONE: 0 cells applied (0 auto-fixable defects). Sheet now 12/12 = 100%.** |

### W23 decision record (S3/S4/S5)

- **0 auto-applicable cells.** All 12 rows' `ai_commands` are prose/description or non-auto-fixable → xlsx-vs-`_w23pre` diff = **0** (verified). No R10, no bare command, no NESTED, no placeholder.
- 11 rows (rows 2/3/5/6/7/8/9/10/11/12/13) are prose: 9 Web-UI Flash / GDS (Redfish) descriptions + 2 "follow up external spec" (rows 12/13) + row 2 GDS prose. ai_can=PARTIAL/NO — no executable single-command line to fix.
- **Row 4 (the ONLY ai_can=YES) — SOP-SEM verbatim read → PASS, KEEP**:
  - S1 command-vs-intent: Procedure = "Run `dmidecode --type 46` under OS"; ai_commands runs exactly `sshpass … ssh … "dmidecode --type 46 2>&1; echo …"` = pure read. ✓
  - S2 parameters: `dmidecode --type 46` correct SMBIOS Type 46. ✓
  - S3 YES justification: pure read, no admin/hardware side-effect → YES stands. ✓
  - S4 output: logs = "full dmidecode --type 46 output" → matches. ✓
  - S5 side-effect: read-only, no risk. ✓
  - Inner literal `echo "---exit $?---"` contains `$?` (**Q_VAR**). It is **intentional** — single-quoting would prevent `$?` expansion and break the exit-code echo. NOT a defect; do NOT change. Flagged for the record (below).

## Full-library completion ledger (W24)

All 6 sheets now 100% reviewed (window records W16→W23):

| sheet | rows | % | window |
|---|---|---|---|
| Functionality | 2291 | 100% | W14/W15/W16 |
| Compatibility | 459 | 100% | W17/W18/W19 |
| Reliability | 202 | 100% | W20 |
| Stability | 88 | 100% | W21 |
| Performance | 60 | 100% | W22 |
| (No Main Function) | 12 | 100% | W23 |
| **total** | **3112** | **100%** | |

## FINAL state (as of W24)

| item | value |
|---|---|
| xlsx md5 (post-W24 cleanup) | `c3ae506f7bf1606d11a13f956c7b0215` |
| tests.json md5 (repo `data/tests.json` == prod `/srv/pa-manager-prod/data/tests.json`) | `bfbc1ab1fc327cec` (post-W24, 3112/6 sheets) |
| git HEAD | `c588ef2` — **NO commit/stage/push** (red line respected W11–W24) |
| backup chain | `_w16pre`(56085381…) → `_w17pre`(273be539…) → `_w18pre`(8db23735…) → `_w19pre`(2f9a854c…) → `_w20pre`(d5eb8572…) → `_w21pre`(9d2b85ad…) → `_w22pre`(d7aa858f…) → `_w23pre`(04ce8686…) → `_w24pre`(04ce8686… post-W23) |

## Outstanding findings — RESOLVED in W24 cleanup (user GO 1/2/3/4)

Found in W16–W23 and left for owner. **All GO items below were applied in W24** (`/root/w24_fix.py`, `DRY=1` verified first). No auto-touch happened before user's GO.

| where | rows | defect class | W24 action |
|---|---|---|---|
| Compatibility | **124** | nested sshpass inside ssh remote → collapse + inner Q-LIT | ✅ REWRITE |
| Functionality | **173** | nested sshpass inside ssh (Speed status) | ✅ REWRITE |
| Reliability | **150** | nested sshpass inside ssh + inner Q-LIT | ✅ REWRITE |
| Reliability | **151 / 153** (dup code 00465) | nested sshpass + dup `2>&1 2>&1` + inner echo/grep Q-LIT | ✅ REWRITE (both copies) |
| Reliability | **143** | inner `"$BMC_*"` → `'$BMC_*'` (literal) | ✅ Q-LIT rewrite |
| Reliability | **152** | add `mountpoint -q /mnt/usb` guard before dd | ✅ GUARD added |
| Compatibility | **42/85/104/110/112/118 / 125**, **141** | previously flagged | **re-checked = NOT broken / intended** → KEEP (no edit) |
| (No Main Function) | 4 | `echo "---exit $?---"` Q_VAR | **KEEP** (intentional, `$?` must expand) |

### W24 applied (final, verified)

- **Targeted whole-cell rewrites**: 7 cells across 7 logical rows (Compatibility 124; Functionality 173; Reliability 143/150/151/152/153).
- **R10 cross-sheet cleanup**: every `2>&1 2>&1` collapsed to `2>&1` — **117 cells in `ai_commands` + 1 cell in `ai_logs_output` (Functionality data row 1394, Wistron-BMC-00685-V003)** cleared; **0 remaining in any column across all 6 sheets** (audit after apply).
- Verification: 3112 rows total preserved (Functionality 2291 / Compatibility 459 / Reliability 202 / Stability 88 / Performance 60 / (No Main Function) 12); build re-ran clean; repo `data/tests.json` == prod `/srv/pa-manager-prod/data/tests.json` == new md5.

## Red lines honored (full session W11–W24)

- ai_can_execute / risk / ai_packages_needed / ai_logs_output: no non-conservative change.
- in-band ipmitool (no `-I lanplus`) never touched.
- R7 `:?` messages: no backticks, no double quotes.
- 0 commits / 0 pushes / 0 stages (user never said "commit").
- `123.txt`, `data/11.RestAPI/`, `data/12.RestAPI/`, `*.bak_*` stay untracked.
- Code pure ASCII; CJK only in handoff markdown.
- Anchored on Code + excel row per sheet.

## W24 (= full-library completion + cleanup applied)

The library is 3112/3112 = 100% reviewed. **W24 cleanup (user GO 1/2/3/4) applied and verified** — all open nesting/Q-LIT/R10 findings above resolved, R10 `2>&1 2>&1` residue cleared workbook-wide. No more row-by-row windows needed. Recommended next step (user decision): a **full-library final verification** (re-run every W14–W24 audit regex over all 3112 rows + KEEP guards + 3-way md5), and/or **commit** the accumulated W20–W24 changes (currently uncommitted on top of `c588ef2`).
