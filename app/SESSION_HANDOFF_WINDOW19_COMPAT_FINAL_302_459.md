# W19 — next window of the 821-row remaining-5-sheets push

> **W18 = Compat rows 102..301 (200 rows + W17 A group) — DONE this session**
> W19 (this doc) = **Compat rows 302..460** (159 rows, end of Compatibility).
>  W20+ will continue with **Reliability** (202 rows) → **Stability** (88) → **Performance** (60) → **(No Main Function)** (12).

## W18 close-of-window (this session's result)

| item | value |
|---|---|
| xlsx md5 | `2f9a854cfd889659999dc919643c3659` (W18 post-apply) |
| tests.json md5 | `5ce2de807d71481bb80e3866c50be7a5` (repo == prod == /tmp) |
| git HEAD | `2a109d5` — NO commit/stage/push (red line respected) |
| xlsx backup taken (S1) | `data/REVISED_commands_merged_with_raw.xlsx.bak_batch_20260905_w18pre` (md5 `8db23735a20130ecbe1727ba888985cd` = post-W17, pre-W18) |
| W18 fix script | `/root/w18_fix.py` (DRY + APPLY + post-audit + guard: `old` must exist else ABORT) |
| Detector dump | `/tmp/w18_compat_200.json` (82 YES rows, 60 det-hits) |
| Semantic sampling | 15 YES rows covered across all 4 sub-functions (Storage/OS/AMD GPU/NV GPU) |
| Compat slice rows 102..301 status | **DONE: 38 R10 + 6 Q (5 W17-A + 1 W18-discovered) applied; 9 new Q-class findings; 13 other findings (incl W17 row 86 carryover); 10 placeholder PARTIAL rows KEEP (W15-1973)** |

## W18 applied 44 cells (S4)

All on `Compatibility.ai_commands`. S5 zero-regression PASS: only these 44 cells differ from `_w18pre`, no other sheet/col touched.

| Class | rows | fix |
|---|---|---|
| R10 (adjacent `2>&1 2>&1` dedup) | 38 in slice 102..301 (rows 103..124, 136/137, 156, 211..268, 283; row 124 is R10-only) + row 128 (R10+Q overlap) | `re.sub(r"(2>&1)\s+(2>&1)", "\1")` |
| Q (inner `"` breaks ssh string) | 5 W17-A (19/36/46/58/59) + 1 W18-discovered (128 `journalctl --since "1 hour ago"`) | literal `"` → `'`; `$`-var `"` → `\"` escape |
| **Total** | **44 cells** | — |

**S4 result**: `changed cells: 44 (expect 44)` + `post-audit issues: NONE`.

## W18 findings (NOT APPLIED — user decision needed)

### A. 9 NEW Q-class defects (same class as W17 A group; literal only; safe `"`→`'` fix available)

| excel row | Code | can | problem fragment | suggested fix |
|---|---|---|---|---|
| 122 | Wistron-OS-00105-V002 | PARTIAL | `echo "PXE is a network-boot flow"` | `"` → `'` |
| 126 | Wistron-OS-00109-V002 | PARTIAL | `echo "initiated"` | `"` → `'` |
| 135 | Wistron-AMD GPU-00118-V003 | YES | `grep -Ei "LnkSta:\|LnkCap:"` | `"` → `'` |
| 139 | Wistron-AMD GPU-00122-V002 | YES | `grep -iE "PCS\|error"` | `"` → `'` |
| 142 | Wistron-AMD GPU-00126-V002 | PARTIAL | `grep -i -E "iommu\|amdgpu"` | `"` → `'` |
| 143 | Wistron-AMD GPU-00127-V002 | PARTIAL | `grep -i -E "iommu\|amdgpu"` | `"` → `'` |
| 150 | Wistron-AMD GPU-00135-V002 | YES | `grep -iE "mi350\|amdgpu"` + `grep -iE "error\|fail\|warn"` (2 spots) | `"` → `'` both |
| 216 | Wistron-AMD GPU-00209-V002 | YES | `grep -i "Processing accelerators"` | `"` → `'` |
| 285 | Wistron-NV GPU-00278-V002 | PARTIAL | `grep -iE "virtual\|mellanox\|nvidia"` | `"` → `'` |

Suggestion: **GO → same fix as W17 A group** (`"` → `'` for literal content; semantics unchanged).

### B. SOP-SEM sample-discovered NEW classes (DEFECT per SOP-SEM S2/S3)

| excel row | Code | can | defect | evidence | recommended |
|---|---|---|---|---|---|
| 134 | Wistron-AMD GPU-00117-V003 | YES | **redirect + pipe outside sshpass** — `sshpass ... "rocm-smi --showproductname" 2>&1 \| grep -c GPU` (the pipe `grep -c GPU` runs against `sshpass` exit-status, not against the remote `rocm-smi` output — the count is always 0/empty). Second command's `grep -ci "Processing accelerators"` also inner-quote. | Row dump; `ai_can=YES` means AI will literally run this broken pipeline. | Rewrite: `sshpass ... "rocm-smi --showproductname 2>&1 \| grep -c GPU"` (move pipe INSIDE) + apply Q-fix to the 2nd cmd. |
| 182-189 (8 rows) | Wistron-AMD GPU-00175..00182 (OAM_0..OAM_7) | YES | **hardcoded creds in curl**: `curl -k -u bmc_user:bmc_pass https://$BMC_IP/redfish/v1/Chassis/OAM_N/Sensors` — S2 defect: bypasses the cred-var policy (`"$BMC_USER:$BMC_PASS"`) AND likely wrong user/pass in prod. | Detector flagged `bare:sensor list` (false positive for ipmitool but reveals hardcoded creds). | Rewrite: `curl -s -k -u "$BMC_USER:$BMC_PASS" ...` (matches row 120 OS-ISO-mount style). |

### C. Carryover from W17 (still open)

| excel row | Code | can | item | open action |
|---|---|---|---|---|
| 86 | Wistron-Storage-00069-V002 | YES | `sensor get 'Sensor check'` (bare, no ipmitool, sensor name likely invalid) — test case content bug (intent = Storage, cmd = generic sensor) | Awaiting library owner per W17 decision. |

### D. 10 placeholder rows — KEEP (W15-1973 policy)

`<server>/<iso>` (row 120), `<dev> <dev>` RAID (130/131/132), `<image>` VBIOS (218/219), `<image>` AGT RM-fw (226), `<watts>` nvidia-smi pl (301) — **all PARTIAL descriptions**; per W15-1973 policy "operator must supply these values" hints preserved.

### E. 5 rows `power cycle` prose (PARTIAL, desc-only, no command)

Rows 263/264/265/266 (+262 which I skipped as it's prose too) — prose says "activate after power cycle"; command absent. **KEEP** (no defect, prose is correct).

## Detector hits in W18 slice (60 total → 44 applied)

| class | count | status |
|---|---|---|
| `2>&1 2>&1` adjacent | 39 | **applied** (38 R10-only + 1 R10+Q row 128) |
| inner-`"` ssh-string break | 24 total scan-positives | 1 applied (row 128, W17-class), 9 reported (A above), 14 **not actually broken** (e.g. false-positives on `-u "$BMC_USER:$BMC_PASS"` and `$DUT_PASS` where the outer `"` of ssh closes before the inner `$` — those are separate ssh remote strings with their own quoting; see S2 sample reads) |
| `bare:sensor list` | 8 | 8 FALSE (Redfish curl, no ipmitool needed) — but see B above (creds are hardcoded) |
| `bare:fru read` | 2 | row 225 YES (`agt fru read`, R10 applied) / row 236 PARTIAL desc KEEP |
| `bare:power cycle` | 5 | prose only, KEEP |
| `placeholder-<X>` | 10 | all PARTIAL desc, KEEP (D above) |

## W18 SOP execution summary

| step | result |
|---|---|
| S1 | `_w18pre` md5 `8db23735a20130ecbe1727ba888985cd` (= post-W17) ✅ |
| S2 | detector dump `/tmp/w18_compat_200.json` — 82 YES, 60 det-hits ✅ |
| S3 | DRY = 44 cells, all rows + codes matched ✅ |
| S4 | APPLY = 44 cells, post-audit `NONE` ✅ |
| S5 | zero-regression = 44 expected, 0 unexpected, 0 other-sheet/col, PASS ✅ |
| S6 | build 3112/6 + 3-way md5 `5ce2de80…` all match ✅ |
| S7 | spot-check 44/44 fixed rows EXACT, 2 un-fixed sanity rows (135/216) verified still have defect fragment ✅ |
| SOP-SEM | 15 rows sampled (YES > 30 → ≥ 15, sub-function coverage: 2 Storage + 2 OS + 6 AMD GPU + 5 NV GPU), 2 new defect classes found (B above) |

## W19 scope (Compat rows 302..460, 159 rows)

**W19 = the FINAL slice of the Compatibility sheet** — after W19, all 459 Compat rows covered, and W20 transitions to Reliability (202 rows).

SOP unchanged:
1. S1 `cp data/REVISED_commands_merged_with_raw.xlsx data/REVISED_commands_merged_with_raw.xlsx.bak_batch_20260905_w19pre`
2. S2 detector dump rows 302..460 → `/tmp/w19_compat_final.json`
3. S3 DRY (W19 slice-specific whitelist)
4. S4 APPLY + post-audit
5. S5 zero-regression vs `_w19pre` (only Compat.ai_commands expected)
6. S6 build 3112/6 → cp ×2 → 3-way md5 (repo `data/tests.json` == prod `/srv/pa-manager-prod/data/tests.json` == `/tmp/w19_tests_build.json`)
7. S7 spot-check (≥ 8 rows)
8. SOP-SEM: YES ≤ 30 in this slice → 全部 YES 逐字核 (if > 30 → ≥ 15 covering each sub-function)

**Open from W18 (user decision) — 14 items pending GO:**
- A × 9 (Q-class literal `"`→`'` in 122/126/135/139/142/143/150/216/285)
- B × 9 (row 134 structural pipe + 8 hardcoded-cred OAM rows 182-189)
- C × 1 (row 86 carryover — library owner)

**Red lines (unchanged from W17):**
- `ai_can_execute / risk / ai_packages_needed / ai_logs_output`: no non-conservative change
- in-band ipmitool (no `-I lanplus`) never touched
- R7 `:?` messages: no backticks, no double quotes
- 0 commits / 0 pushes / 0 stages unless user says so explicitly
- `123.txt`, `data/11.RestAPI/`, `data/12.RestAPI/`, `*.bak_*` stay untracked
- code: pure ASCII; CJK only in handoff markdown
- Anchor on **Code + excel row per sheet** (W15 off-by-one lesson)

**Backup chain through W18:**
- `_w15pre` (c504ba97… = pre-W15)
- `_w16pre` (56085381… = pre-W16 STEP B)
- `_w17pre` (273be539… = pre-W17)
- **`_w18pre` (8db23735… = pre-W18, post-W17)**

## Reading order for W19

1. This doc (W19 scope + W18 results + open findings)
2. `SESSION_HANDOFF_WINDOW17_REMAINING_5_SHEETS.md` — has SOP-SEM block + full 5-sheet scope + redlines
3. `SESSION_HANDOFF_WINDOW18_REMAINING_COMPAT_102_201.md` — W17 findings (still open)
4. `/root/w18_fix.py` — reference implementation
5. `/tmp/w18_dump.py` — detector to copy (change ROW range)

## W19 GO — open with (copy verbatim):

> 0. 你是 W19。先讀 /root/sheng/manager/pa_manager/SESSION_HANDOFF_WINDOW19_COMPAT_FINAL_302_459.md
>    W19 = Compat rows 302..460 (159 行, Compatibility 視窗最後一段)。
>    W20+ 開始切到其他 4 sheets (Reliability → Stability → Performance → No Main Function)。
>    照 W18 SOP 走: S1 備份 _w19pre → S2 audit → S3 DRY → S4 APPLY+audit → S5 零回歸 → S6 build+三向 → S7 spot-check。
>    修補 pattern 照 /root/w18_fix.py 模板。
>    W18 待 GO findings 14 items (9 Q-class + 1 structural + 8 hardcoded-cred + 1 W17 遺留 row 86) 等你決定再動。
>    我 GO 才 GO。
