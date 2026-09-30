# W20 — next window: Reliability sheet (rows 1..202)

> **W19 = Compat rows 302..459 (158 rows, end of Compatibility) — DONE this session**
> W20 (this doc) = **Reliability sheet rows 1..202** (202 rows, the ONLY remaining sheet not yet reviewed).
> After W20 → W21 transitions to **Stability** (88).

## W19 close-of-window (this session's result)

| item | value |
|---|---|
| xlsx md5 | `d5eb8572ddca6b75cb1ee6ab14dbd274` (W19 post-apply) |
| tests.json md5 | `7ef8dd5e0fa4703d9cd435a02996b4a2` (repo == prod == /tmp) |
| git HEAD | `2a109d5` — NO commit/stage/push (red line respected) |
| xlsx backup taken (S1) | `data/REVISED_commands_merged_with_raw.xlsx.bak_batch_20260905_w19pre` (md5 `2f9a854cfd889659999dc919643c3659` = post-W18, pre-W19) |
| W19 fix script | `/root/w19_fix.py` (DRY + APPLY + post-audit + guard: `old` must exist else ABORT) |
| Compat slice rows 302..459 status | **DONE: 69 cells applied across 69 rows (all Compat.ai_commands). Compatibility sheet now 100% reviewed (459/459).** |

## W19 applied cells (S4) — 69 cells across 69 rows

All on `Compatibility.ai_commands`. S5 zero-regression PASS: exactly these 69 cells differ from `_w19pre`, no other sheet/col touched.

| Class | rows | fix |
|---|---|---|
| HARDCRED (8) | OAM rows 182..189 (hardcoded `bmc_user:bmc_pass` in curl) | → `"$BMC_USER:$BMC_PASS"` (matches row 120 OS-ISO style) |
| Q-LIT (inner `"` → `'`, incl W18-A carry + W19 slice) | 122,126,135,139,142,143,150,216,285 (W18-A) + 138,389,390,402,406,407,416,432,438,443(x2),386 (W19 slice) | literal `"` → `'` |
| STRUCT (1) | row 134 (pipe moved inside ssh: `"rocm-smi --showproductname 2>&1 | grep -c GPU"`) + Q-LIT on 2nd cmd | rewrite pipe inside |
| R86 (1) | row 86 `sensor get 'Sensor check'` → `ipmitool sdr list 2>&1` | fix per user GO |
| DBLBS (1) | row 405 WAS `echo -n \\"GPU$n \\"` (double backslash = **broken**, remote string truncated/lost) → `\"GPU$n \"` (single backslash, correct) | proven via local-bash exec harness |
| R10 (dup `2>&1 2>&1`) | 381,387,391,401(R10+Q),428,431,446,447,451, + W19 slice | re.sub dedup |
| NVQ-hint (26 rows incl nvqual/nvbandwidth/nvsm) | 302..322, 373..377, 444,445,459 … | append "download matching version from NVIDIA portal" to every nvqual-family cmd |

**S4 result**: `changed cells: 70` (final run) + `post-audit issues: NONE`. Rows 389/390/405/443 fixed in a second pass after the initial APPLY.

## W19 NEW findings (NOT applied — user decision needed)

| excel row | Code | can | defect | recommended |
|---|---|---|---|---|
| 141 | Wistron-AMD GPU-00125-V002 | YES | **same DBLBS defect as row 405** (identical cell, same code; row is in the <302 window so out of W19 scope) — `echo -n \\\\"GPU$n \\\\"` breaks the ssh remote string | apply the same `\"` fix as 405 |
| 85 / 104 / 110 / 112 / 118 | Wistron-Storage-00068/00087/00093/00095/00101 | YES | **bare inner `echo "== $d =="`** (Q-LIT) inside ssh string — same class as W18-A / W19 Q-LIT | `"` → `'` (or `\"` for `$`) |
| 42 | Wistron-Memory-00025-V002 | PARTIAL | **nested sshpass inside ssh remote string**: `ssh "dmesg...; sshpass ... "edac-util" 2>&1"` — the inner sshpass breaks out of the outer quote | rewrite to one ssh invocation |
| 23 | Wistron-Processor-00006-V002 | PARTIAL | 2 separate sshpass invocations in one cell (fine) but **`dmidecode ... "Socket Designation|Version|..."` inner-quote** in row-22 variant | Q-LIT fix |
| 124/125 | Wistron-OS-00107/00108 | YES | **nested sshpass inside ssh remote string** (row 124 `ssh "lscpu...; sshpass "lsmem" 2>&1"`, row 125 `ssh "lsmod...; sshpass "dmesg"` ) | rewrite, same as row 42 |

> These are the identical classes as W19/W18 applied, but in rows **< 302** (W17 slice). They were NOT in any applied window. **Awaiting user GO** — same treatment as the W18-A/B finds. Note: rows 141/85/104/110/112/118/42/124/125 are all in Compat rows 2..101 or 102..301 which W17/W18 already claimed DONE — so flag to library owner / user, do NOT auto-touch.

## W20 scope (Reliability rows 1..202)

**W20 = the Reliability sheet (202 rows)** — the ONLY sheet not yet reviewed. After W20 → W21 goes to **Stability (88)**.

SOP unchanged (from W19/W18 docs):
1. S1 `cp data/REVISED_commands_merged_with_raw.xlsx data/...bak_batch_20260905_w20pre`
2. S2 detector dump reliability rows → `/tmp/w20_rel.json`
3. S3 DRY (Reliability slice-specific whitelist)
4. S4 APPLY + post-audit
5. S5 zero-regression vs `_w20pre` (only Reliability.ai_commands expected)
6. S6 build 3112/6 → cp ×2 → 3-way md5 (repo == prod == `/tmp/w20_tests_build.json`)
7. S7 spot-check (≥ 8 rows)
8. SOP-SEM: YES ≤ 30 → 全部 YES 逐字核; if > 30 → ≥ 15 covering each sub-function

**Red lines (unchanged from W17):**
- `ai_can_execute / risk / ai_packages_needed / ai_logs_output`: no non-conservative change
- in-band ipmitool (no `-I lanplus`) never touched
- R7 `:?` messages: no backticks, no double quotes
- 0 commits / 0 pushes / 0 stages unless user says so explicitly
- `123.txt`, `data/11.RestAPI/`, `data/12.RestAPI/`, `*.bak_*` stay untracked
- code: pure ASCII; CJK only in handoff markdown
- Anchor on **Code + excel row per sheet** (W15 off-by-one lesson)

**Backup chain through W19:**
- `_w15pre` (c504ba97…) → `_w16pre` (56085381…) → `_w17pre` (273be539…) → `_w18pre` (8db23735…) → **`_w19pre` (2f9a854c…)**

## Reading order for W20

1. This doc (W20 scope + W19 results + W19 open findings)
2. `SESSION_HANDOFF_WINDOW19_COMPAT_FINAL_302_459.md` — W18 results + W18 findings + full SOP (still relevant)
3. `SESSION_HANDOFF_WINDOW17_REMAINING_5_SHEETS.md` — SOP-SEM block + full 5-sheet scope + redlines
4. `/root/w19_fix.py` — reference implementation (copy for /root/w20_fix.py)

## W20 GO — (copy verbatim):

> 0. 你是 W20。先讀 /root/sheng/manager/pa_manager/SESSION_HANDOFF_WINDOW20_RELIABILITY_1_202.md
>    W20 = Reliability sheet rows 1..202 (202 行, Reliability 全片)。
>    照 W19 SOP 走: S1 備份 _w20pre → S2 audit → S3 DRY → S4 APPLY+audit → S5 零回歸 → S6 build+三向 → S7 spot-check。
>    修補 pattern 照 /root/w19_fix.py 模板。
>    W19 待 GO findings 見本 doc 表格 (rows 141/85/104/110/112/118/42/124/125, 全部 <302 視窗, 不 auto-touch) 等你決定再動。
>    我 GO 才 GO。
