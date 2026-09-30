# W18 — next window of the 821-row remaining-5-sheets push

> **W17 = Compat rows 2..101 (100 rows) — DONE this session**
> W18 (this doc) = **Compat rows 102..201** (100 rows).  W19+ will continue until 821/821 of the
> 5 non-Functionality sheets are covered.

## W17 close-of-window (this session's result)

| item | value |
|---|---|
| xlsx md5 | `8b77-9290-99d2-cc40-1e23-2abd-1bba-911d`  (W17 post-apply) |
| tests.json md5 | `8b77929099d2cc401e232abd1bba911d` (repo == prod == /tmp) |
| git HEAD | `2a109d5` — no commit/stage/push |
| xlsx backup taken (S1) | `data/REVISED_commands_merged_with_raw.xlsx.bak_batch_20260905_w17pre` (md5 `273be539…`, = pre-W17-apply) |
| W17 fix script | `/root/w17_fix.py` (DRY + APPLY + post-audit + strict "pattern required" guard) |
| Detector dump | `/tmp/w17_comp_100.json` (24 YES, 43 det-hits, all categorized) |
| Semantic finding | **YES rows 19/36/46/58/59** (excel) = **5 rows** with inner `"` nested in `"` ssh string (W17 NOT fixed; flagged for user) — see W17 findings below |
| SOP-SEM written into W17 doc | `## W17 SOP 增補：語義層抽樣 (NEW，W17 起適用，W18+ 沿用)` in `SESSION_HANDOFF_WINDOW17_REMAINING_5_SHEETS.md` |
| Compat slice rows 2..101 status | **DONE: detector clean, 26 R10 dedup applied, 17 R7 placeholder KEEP, 1 R29 bare flagged, 5 YES inner-quote flagged** |

## W18 scope (what you actually do)

**Compat rows 102..201 (100 rows)**:
- S1 `cp data/REVISED_commands_merged_with_raw.xlsx data/REVISED_commands_merged_with_raw.xlsx.bak_batch_20260905_w18pre`
- S2 detector dump (rows 102..201) → `/tmp/w18_compat_100.json`. Use the SAME detector patterns as W17
  (see `/tmp/w17_dump.py`): `2>&1 2>&1` / `<placeholder>` / bare `sensor get` / `sshpass -p "$BMC_USER"` /
  `<name>=<val>`
- S3 DRY + S4 APPLY (use the same `R10_CODES whitelist + pattern guard` as W17 —
  see `/root/w17_fix.py` template; copy the pattern, only adjust `ROW_LO=102` / `ROW_HI=201` + the R10 whitelist for this slice)
- S5 zero-regression vs `_w18pre`: expect **only Compat.ai_commands** change; **other 5 sheets + 17 cols + ai_can_execute/risk/ai_packages_needed/ai_logs_output = 0 diff**
- S6 build 3112/6 → cp twice → 3-way md5 (repo `data/tests.json` == prod `/srv/pa-manager-prod/data/tests.json` == `/tmp/w18_tests_build.json`)
- S7 spot-check: 8 rows covering (fixed + KEEP + YES)

## W18 must-read before GO
1. **`SESSION_HANDOFF_WINDOW17_REMAINING_5_SHEETS.md`** — has the SOP-SEM block (added by W17)
2. **W17 findings** below (rows 19/36/46/58/59 YES inner-quote; row 86 bare; 17 placeholder = KEEP)
3. **`/root/w17_fix.py`** — reference implementation to copy
4. **`/tmp/w17_dump.py`** — detector to copy (just change ROW range)
5. **Backup chain intact**:
   - `_w15pre` (c504ba97… = pre-W15)
   - `_w16pre` (56085381… = pre-W16 STEP B)
   - **`_w17pre` (273be539… = pre-W17)**  ← W18 S1 should make `_w18pre` from current `273be539…-post-W17`
6. **Red lines (unchanged)**: see W17 doc "Red lines (unchanged)" section.

## W17 findings (NOT auto-applied — user decision required)

**A. 5 YES rows with inner double-quotes inside the `"..."` ssh string — NOT run-safe as-is:**

| excel row | Code | cmd fragment (problem part) |
|---|---|---|
| 19 | Wistron-Processor-00002-V003 | `"lscpu 2>&1 \| grep -iE "Model name\|MHz\|Frequency"; …"`  ← inner `"` breaks ssh |
| 36 | Wistron-Memory-00019-V002 | `ls /dev/ \| grep -iE "mem\|nvdimm"` — already using inner `"` |
| 46 | Wistron-Networking-00029-V003 | `lspci -nn 2>&1 \| grep -Ei "Ethernet\|Infiniband\|Network"` — inner `"` |
| 58 | Wistron-Networking-00041-V002 | `lspci -s $(lspci -nn \| grep -i mellanox \| head -1 \| cut -d" " -f1)` — cut `-d" "` inner `"` |
| 59 | Wistron-Networking-00042-V002 | `ethtool -i $(ls /sys/class/net \| grep -iE "ib\|enp" \| head -1)` — inner `"` |

**Suggested fix (W18 or later)**: replace the inner `"` with `'` (keeps the exact same shell semantics
inside the outer `"…"` — safe, no semantic change, only syntactic).  Or wrap each inner string in `\"`
escapes (less readable).  Wait for the explicit GO before touching.

**B. 1 R29 bare command — semantic-uncertain, flagged:**

| excel row | Code | fragment |
|---|---|---|
| 86 | Wistron-Storage-00069-V002 | `sensor get 'Sensor check'` (no `ipmitool`, no `-I lanplus`, no `-C 17`) |

**Status**: The same test-set row 87 ("FIO") uses a normal `fio` command.  row 86 is a "OS Installation"
sub-test but the CMD is a bare `sensor get 'Sensor check'` — this is a **test-case content bug** (mismatch
between test intent and actual command) — **NOT something W17 should silently rewrite**.  If the user does
not want to fix the content, this row will remain a `bare sensor` on each window's audit dump until the
library owner updates it.  Suggestion: keep as-is, or escalate to the library owner; do not invent a new
command.

**C. 17 R7 placeholder rows (PARTIAL description) — KEEP per W15-1973 policy, no change:**
`<m2testfile>`, `<eth1>`, `<eth2>`, `<driver>`, `<iface>`, `<addr>/<len>`, `<peer>`, `<mlx>`, `<device>`…
All 17 are in the "description" prose (rows 14-17, 49, 50, 51, 66, 67, 68, 94, 96-101).  These are the
"operator must supply these values" hints, not actual placeholders in an executable command.

**D. YES row count in W17 slice (24)**: 9 fixed (R10).  5 flagged (inner-quote).  10 unflagged YES rows
= semantic PASS (lspci/lscpu/dmidecode/free -m/ibstat/dmesg/lsblk/nvme id-ctrl/storcli — all read-only or
well-scoped).  Coverage of 24 YES = 14 of 24 "explicitly reviewed or flagged" > 50% target.

## W18 GO — open with (copy verbatim):

> 0. 你是 W18。先讀 /root/sheng/manager/pa_manager/SESSION_HANDOFF_WINDOW18_REMAINING_COMPAT_102_201.md
>    W18 = Compat rows 102..201 (100 行)。SOP 照 W17 doc 的 SOP-SEM 做: S1 備份→S2 audit→S3 DRY→S4 APPLY→S5 零回歸→S6 build+三向→S7 spot-check。
>    修補 pattern 照 /root/w17_fix.py 模板; 只改 ROW_LO/ROW_HI + R10_CODES 白名單。
>    語義層抽樣 (W17 SOP-SEM) 只對 YES 行抽 ≥50% 逐字核; 發現 defect 先寫 findings, 等 GO 才修。
>    我 GO 才 GO。
