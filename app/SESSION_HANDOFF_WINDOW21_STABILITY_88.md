# W21 — next window: Stability sheet (rows 1..88)

> **W20 = Reliability sheet rows 1..202 (202 rows) — DONE this session**
> W21 (this doc) = **Stability sheet (88 rows)**. After W21 → W22 = Performance (60) → then (No Main Function) (12). After that the full 6-sheet library (3112 rows) is 100% reviewed.

## W20 close-of-window (this session's result)

| item | value |
|---|---|
| xlsx md5 (post-apply) | `9d2b85add9bfcfcd52d2406b3c5aed54` |
| tests.json md5 (repo == prod == /tmp) | `857c49c9e17b098569db6cfa6b09bf40` |
| git HEAD | `c588ef2` (W19 was committed by user between windows) — **NO commit/stage/push this window** (red line respected) |
| xlsx backup taken (S1) | `data/REVISED_commands_merged_with_raw.xlsx.bak_batch_20260905_w20pre` (md5 `d5eb8572ddca6b75cb1ee6ab14dbd274` = post-W19, pre-W20) |
| W20 fix script | `/root/w20_fix.py` (DRY + APPLY + post-audit + guard; Q-LIT regex + R10 dedup; NESTED-exclude set) |
| W20 detector | `/tmp/w20_dump.py` (± 134 hits → classified) |
| Reliability sheet rows 1..202 status | **DONE: 126 cells applied across 126 rows (all Reliability.ai_commands). Reliability sheet now 100% reviewed (202/202).** |

## W20 applied cells (S4+S5) — 126 cells across 126 rows, all Reliability.ai_commands

S5 zero-regression PASS: exactly these 126 cells differ from `_w20pre`, no other sheet/col touched.

| Class | rows (excel rows 2..203) | fix |
|---|---|---|
| Q-LIT (inner literal `"` → `'` in grep/egrep/echo/cut inside ssh remote) | ~107 rows: 2..41,45..99,144,145,149(Q+L),156..178 (sample: 2,5,13,22,42→R10,61,74,88,99,145,149,156,160,170) | literal `"` → `'` |
| R10 (dup `2>&1 2>&1`) | 42,43,44,55..60,146,147,148,149(+Q),189 | re.sub dedup `2>&1 2>&1`→`2>&1` |

**Changed-cell verification**: `rows:126 cells:126 cols:{'ai_commands':126}`, all ai_commands-only. post-audit `dup-still-present: NONE`.

## W20 NEW findings (NOT applied — user decision needed)

| excel row | Code | can | defect | recommended |
|---|---|---|---|---|
| 143 | Wistron-HW Robust-00021-V002 | YES | **nested sshpass inside ssh remote string**: `ssh "... rasdaemon -r ...; sshpass -p ... "rasdaemon -r ..." 2>&1"` — inner sshpass breaks the outer quote (same class as W19 find rows 42/124/125) | rewrite to one ssh invocation |
| 150 | Wistron-HW Robust-00028-V002 | YES | **nested sshpass inside ssh** (NIC/Mellanox): `ssh "... ibstat ...; sshpass ... "mst status 2>&1; ibstat ...""` | rewrite, same as 143 |
| 151 | Wistron-HW Robust-00029-V002 | YES | **nested sshpass inside ssh** + inner `grep "AER|PCIe Bus Error"` / `grep -iE "aer|pci"` Q-LIT (not applied inside NESTED) | rewrite + Q-fix inner literals |
| 152/154 | Wistron-HW Robust-00465-V003 (dup code) | PARTIAL | **nested sshpass inside ssh** + `echo "traffic test needs a peer"` Q + `grep -A3 -E "TX\|RX"` Q + dup `2>&1 2>&1` (all inside the nested-ssh block, so not auto-touched) | rewrite + apply inner Q-LIT/R10 once structure fixed |

> These 5 rows carry the **NESTED structural defect** (nested `sshpass` invoked *inside* an outer `ssh "... "` remote string). Same class as W19's open findings (rows 42/124/125 in Compatibility). **Awaiting user GO** — recommended fix = collapse to a single ssh+sshpass, then apply inner Q-LIT (`"`→`'`) and R10 dedup on the combined command. Do NOT auto-touch.
>
> Detector false-positives on this sheet (verified benign, NOT defects): rows 112/113 (`echo $d` shell-var loop, legit) and 153 (clean dd/cp/md5sum ssh string); also many detector `inner-quote` hits that were just prose double-quotes in the `-- ...` description prefix before the ssh block (all fixed rows verified clean).

## W21 scope (Stability, 88 rows)

**W21 = the Stability sheet (88 rows, ai_can=0).** After W21 → W22 = Performance (60) → W23 = (No Main Function) (12) → then W17/18/19/20's "full 6-sheet 3112 = 100%" is reached.

SOP unchanged (from W19/W20 docs):
1. S1 `cp data/REVISED_commands_merged_with_raw.xlsx data/...bak_batch_20260905_w21pre`
2. S2 detector dump stability rows → `/tmp/w21_stab.json`
3. S3 DRY (Stability-specific whitelist)
4. S4 APPLY + post-audit
5. S5 zero-regression vs `_w21pre` (only Stability.ai_commands expected)
6. S6 build 3112/6 → copy fresh build to `data/tests.json` + `/tmp/` → 3-way md5 (repo `data/tests.json` == prod `/srv/pa-manager-prod/data/tests.json` == `/tmp/w21_tests_build.json`)
7. S7 spot-check (YES ≤ 30 → all YES verbatim; else ≥15)
8. SOP-SEM: YES ≤ 30 → 全部 YES 逐字核

**Red lines (unchanged from W17-W20):**
- `ai_can_execute / risk / ai_packages_needed / ai_logs_output`: no non-conservative change
- in-band ipmitool (no `-I lanplus`) never touched
- R7 `:?` messages: no backticks, no double quotes
- 0 commits / 0 pushes / 0 stages unless user says so explicitly
- `123.txt`, `data/11.RestAPI/`, `data/12.RestAPI/`, `*.bak_*` stay untracked
- code: pure ASCII; CJK only in handoff markdown
- Anchor on **Code + excel row per sheet** (W15 off-by-one lesson)

**Backup chain through W20:**
- `_w15pre` (c504ba97…) → `_w16pre` (56085381…) → `_w17pre` (273be539…) → `_w18pre` (8db23735…) → `_w19pre` (2f9a854c…) → **`_w20pre` (d5eb8572…)**

## Reading order for W21

1. This doc (W21 scope + W20 results + W20 open findings)
2. `SESSION_HANDOFF_WINDOW20_RELIABILITY_1_202.md` — W19 results + full SOP (stays relevant)
3. `SESSION_HANDOFF_WINDOW17_REMAINING_5_SHEETS.md` — SOP-SEM block + full 5-sheet scope + redlines
4. `/root/w20_fix.py` — reference implementation (copy for /root/w21_fix.py)

## W21 GO — (copy verbatim):

> 0. 你是 W21。先讀 /root/sheng/manager/pa_manager/SESSION_HANDOFF_WINDOW21_STABILITY_88.md
>    W21 = Stability sheet (88 行, ai_can=0)。
>    照 W20 SOP 走: S1 備份 _w21pre → S2 audit → S3 DRY → S4 APPLY+audit → S5 零回歸 → S6 build+三向 → S7 spot-check。
>    修補 pattern 照 /root/w20_fix.py 模板。
>    W20 待 GO findings 見本 doc 表格 (5 NESTED rows 143/150/151/152/154, 全部 Reliability, 不 auto-touch) 等你決定再動。
>    我 GO 才 GO。
