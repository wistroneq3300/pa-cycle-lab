# Handoff — Round-2 Functionality FINAL window items 2201-2290 (2026-09-18)

> Read FIRST: this file + SESSION_HANDOFF_ROUND2_BATCH11_2200_20260918.md +
> REVIEW_WORKFLOW_LOGIC.md (section 18 a-l / 19 m-u / 20 v-aa / 21 locked).
> This window did: Functionality rows 2203-2292 (90 cases = the last 90 rows of the sheet) review +
> 21 cells fixed in xlsx + zero-regression, report extended to `review_round_02_functionality.md`.
> **🏁 Functionality sheet is now 100% reviewed (rows 2-2292 / items 1-2290 under the row-2 convention).**

---

## 0. Deliverables this window

| file | purpose |
|---|---|
| `review_round_02_functionality.md` (61724 -> 64206 lines) | added 12th/last batch (items 2201-2290) per-case "8Q+5seg+section 18h three + verdict"; head title updated to `第 1–2290 條` + batch12 marker + cumulative line added |
| `data/REVISED_commands_merged_with_raw.xlsx` (working tree) | **21 cells actually modified** (13 `ai_commands` col15 + 2 `ai_can_execute` col13 rows 2241/2272 + 6 `ai_packages_needed` col14 rows 2203/2209/2273/2287/2290/2291), all Functionality |
| `scripts/fix_rev02_batch12.py` | this batch xlsx fixer (row-located, not code-located) |
| `scripts/gen_rev02_batch12.py` + `scripts/dump12.py` | this batch report generator + row dumper |
| `data/REVISED_commands_merged_with_raw.xlsx.bak_rev02_batch12_20260907` | pre-fix backup |

mojibake: cyrillic=0 / U+FFFD=0 (xlsx + report). git HEAD `5a60875`.

---

## 1. Review result (items 2201-2290, final Functionality window)

**verdict (section 21 locked) distribution (this batch)**:
| verdict | count |
|---|---|
| NO/PHYSICAL | 24 |
| PARTIAL | 40 |
| YES | 21 |
| UNRESOLVED | 5 |

**Cumulative (1-2290)**: NO/PHYSICAL **409** / PARTIAL **811** / YES **897** / UNRESOLVED **173** (=2290).

This block = the tail of the Functionality sheet: USB Hubs / DPoC KVM (Screen, KVM ± hub) + PCIe BW stress +
DC/AC/WR Cycle Speed&Link + Operations Factory Default/Preserve + BMC Web 2FA + NVMe E1.S LED checks +
L10 PSU LED + the whole Flyboy-BMC sanity family (GPU details/BIOS Debug Data/KVM/lsusb/ncsi-cmd/Redfish
AccountService/SessionService/UserPrivilege D-Bus/max-session/reset-nic-linkstate/GPU FW etc.) + Security mode +
Install OS + Version Check + Clear CMOS + L10 LED (heartbeat/UID) + Panel buttons + PSU fan failure +
BMC UART + Mechanical AVL (CX7/BF3) + IPM Sensor List (TEMP_HIB_PEX) + MLPerf Retinanet + Sensor Check PDB +
Leaking Check + FW package Release note + BMC Validation (FW Update/Recovery/Reject) + Reboot BMC +
Information/Jumper + I3C/I2C (TBD rows) + Thermal stress + GB Field RMA / Partner Diagnostics.

---


## 2. Defects actually fixed in xlsx this batch (21 cells)

| class | count | rows |
|---|---|---|
| WR (命令內容/完整流程與 Items 或 Procedure 不符 → 重寫) | 8 | 2203, 2209, 2241, 2273, 2277, 2287, 2290, 2291 |
| Q-LIT (ssh 內層裸雙引號 → 單引號) | 1 | 2259 |
| R5 (OOB/`ipmitool -I lanplus` 誤經 DUT-ssh 雙跳 → agent-host 直連) | 3 | 2228, 2230(含 Q-LIT), 2279(含 Q-LIT) |
| FAKE (「not directly runnable / give exact bytes」實為可跑 OOB sensor get) | 1 | 2272 |
| VERDICT (col13 判改) + PKG (col14 套件) | 2 + 6 | 2241 YES→PARTIAL; 2272 PARTIAL→YES; pkg on 2203/2209/2273/2287/2290/2291 |

col15 ai_commands unique rows = **13** (2203, 2209, 2228, 2230, 2241, 2259, 2272, 2273, 2277, 2279,
2287, 2290, 2291); col13 = **2** (2241, 2272); col14 = **6** (2203, 2209, 2273, 2287, 2290, 2291).
Total **21 cells**, all within rows 2203-2291 (inside the batch window 2203-2292). All Functionality.

**WR detail** (copy-error / incomplete-command repeats the batch9-11 pattern):
- 2203 (USB2/3 Function Check, TS "USB Hubs, Device(MCU)"): ai_commands was an M.2-FW-flash text (copy error
  from another family) + pkg listed "vendor M.2 FW flash tool". Rewrote to a DUT USB enumeration
  (`lsusb -t`/`lsusb`), pkg -> `usbutils (lsusb)`. Criteria = TBD -> report-level UNRESOLVED (but still fixed).
- 2209 (AC Cycle - Speed&Link, TS "PCIe"): ai_commands was the sibling 2207 "PCIe BW stress" text.
  Rewrote to the procedure's real flow (operator AC-cycle overnight; agent records `lspci` link speed/width
  pre/post), pkg `perftest/pciebw` -> `lspci + power control`.
- 2241 (Add HTTPBasicAuth- Redfish): ai_commands only had the baseline GET; the procedure's real test toggles
  HTTPBasicAuth (PATCH Disabled -> re-GET expect 401) then restores via factory reset. Rewrote to the full
  4-step flow; **VERDICT col13 YES->PARTIAL** (disabling a security auth method can lock out access + factory
  reset => operator approve), pkg stays `curl`.
- 2273 (MLPerf - Retinanet Offline): ai_commands was only a `lscpu`/`dmidecode` pre-check (U-fake-completion,
  section 19o) with inner grep double-quotes (Q-LIT). Rebuilt to pre-check + the real MLPerf benchmark
  (`cd ${MLPERF_DIR:?...}; ${MLPERF_RUN_CMD:?...}` for retinanet/offline, section 19r), stays YES (locked 21:
  MLPerf = YES once tool/sop given), pkg adds "MLPerf inference toolkit (operator-provided)".
- 2277 (Release note, TS "FW package check"): ai_commands was an I2C "HSC_BD" board-test text (copy error).
  Rewrote to the real release-note document check; stays NO (human doc review).
- 2287 (TH.1_Thermal Stress Test, TS "Thermal"): ai_commands was an "EC.22 PCIe Tx Equalization (LTSSM)" text
  (copy error) + pkg "NVIDIA PCIe qualification toolchain (LTSSM)". Rewrote to a full-power thermal stress +
  OOB thermal sensor poll, pkg -> `stress-ng + nvidia-smi + ipmitool (OOB temp read)`. Worst-case ambient /
  chamber is operator setup (PARTIAL).
- 2290/2291 (I3C - CPU1, TS "I3C"): ai_commands was an "E1S - Under PSB" LED-behavior text (copy error from an
  NVMe-LED row). Rewrote to the real I3C CPU1 connection check with a section-19r vendor slot
  (`${I3C_PROBE:?...}` on the BMC console), pkg `none` -> `i3c-tools (vendor/operator-provided)`.
  Criteria = TBD -> report-level UNRESOLVED (still fixed, batch11 TBD pattern).

**Q-LIT detail**: 2259 (Install OS, sheet-B Secure Boot): the embedded `grep -iE "secure boot|setup mode"`
used double quotes inside the outer ssh double-quoted remote -> single-quoted the grep pattern.

**R5 detail**:
- 2228 (IPMI selftest): the OB half (`ipmitool -I lanplus ...`) ran inside a DUT ssh; moved to agent-host OOB,
  keeping the IB half (`ipmitool mc selftest`) on the DUT (mirrors batch9 1659/1660 IB+OOB structure).
- 2230 (System Inventory): the OOB `ipmitool -I lanplus ... fru print` was wrapped in a DUT ssh with inner
  `"$BMC_IP"`/`"$BMC_USER"`/`"$BMC_PASS"` double-quotes (Q-LIT+R5) -> agent-host OOB `fru print`; the BMC
  WebUI per-category view stays operator-read.
- 2279 (BMC FW Recovery): the embedded `echo "place image..."` double-quote (Q-LIT) + `ipmitool -I lanplus`
  inside a DUT ssh (R5) -> the recovery flow is operator-staged; agent reads back the BMC state OOB from the
  agent host after recovery.

**FAKE detail**: 2272 (TEMP_HIB_PEX, TS "IPM Sensor List Commands"): "not directly runnable / give exact
  bytes" is false - the same OOB `sensor get 'TEMP_HIB_PEX'` applies, identical in nature to batch10 row 1891
  (same Test Set / sensor family, already YES). Rewrote to that + **VERDICT PARTIAL->YES** (read-only OOB
  sensor get per locked 21), pkg remains `ipmitool`.

---

## 3. Big findings this batch

1. **5 rows UNRESOLVED (report-level, NOT an xlsx edit)** - Criteria first line literal "TBD":
   2203 (USB2/3 Function Check), 2207 (PCIe BW stress), 2290/2291 (I3C - CPU1), 2292 (I2C - Cable).
   The 2203/2290/2291 ai_commands were copy errors and were still fixed; 2207's command already matched its
   own Items (no edit); 2292's command already described the Cable test correctly (no edit). The test-library
   must fill the TBD criteria before any L1 re-review of these.
2. **Functionality sheet is now 100% reviewed** under the report's row-2 convention
   (rows 2-2292 / items 1-2290). Note: tests.json counts 2291 Functionality items (row-1 numbering); the
   report has consistently used item = row-2 (batch1 used row-1 - a pre-existing off-by-one in the report's
   numbering vs the built tests.json). Flagged here for the operator; NOT an xlsx defect and not changed.
3. **Consistent-library deferral (NOT a batch12 defect)**: the in-band/OOB IPMI and sensor rows in this tail
   continue the "single command, no §18d/§20v sdr-elist fallback" style standardized in batches 4-11. When the
   library fills the expected sensor results, the fallback can be added wholesale - not per-row here.
4. **No copy-error->read-only sensor flip beyond the 2 made**: only 2241 + 2272 needed col13 changes; the rest
   of the verdicts were already consistent with locked 21 (e.g. E1.S LED rows 2214-2216 stay YES, matching the
   already-reviewed sibling 1753).

---

## 4. Zero-regression verified

- build: `python3 scripts/build_testlib_json_xlsx.py data/REVISED_commands_merged_with_raw.xlsx /tmp/tests_b12.json`
  -> **total=3112 / 6 sheets unchanged** (2291 / 202 / 60 / 459 / 88 / 12).
- cell diff vs backup (`...bak_rev02_batch12_20260907`) at delivery: exactly **21 cells** changed
  (13 Functionality col15 + 2 Functionality col13 rows 2241/2272 + 6 Functionality col14 rows
  2203/2209/2273/2287/2290/2291). All within rows 2203-2291 (within the batch window 2203-2292).
- 5 other sheets (Reliability / Performance / Compatibility / Stability / (No Main Function)): **0 diff**.
- Functionality col17 (risk) + col18 (remark) at delivery: **0 diff**.
- mojibake: cyrillic=0 / U+FFFD=0 (xlsx + report).

### 4b. batch12 follow-up amendment (post-delivery closing audit, 2026-09-18)

A full-library closing audit after delivery surfaced that the 9 WR/FAKE rows whose `ai_commands`
was rewritten in batch 12 still carried the **old pre-rewrite text in `ai_logs_output` (col16) /
`risk` (col17)** (self-contradictory: e.g. 2203 col15 = USB enumeration but col16 = "return the
flash log + FW version"). These were co-synced to match the new col15:

- amended cells: **+13** (9 col16 + 4 col17) on rows 2203, 2209, 2241, 2272, 2273, 2277, 2287,
  2290, 2291. col16 on 2209/2241/2272/2273/2277/2287/2290/2291 + col17 newly set on 2209/2241/2287 +
  col17 cleared to None on 2203 (read-only USB enum). Rows 2228/2230/2259/2279 already had consistent
  col16/col17 -> untouched.
- re-verified: diff vs `...bak_rev02_batch12_20260907` = **34 cells now** (21 batch-12 + 13 amendment),
  all Functionality, all in col13/14/15/16/17; col18 (remark) 0 diff; 5 other sheets 0 diff;
  build still **3112/6** (`/tmp/tests_b12_amend.json`). New backup
  `...bak_rev02_batch12b_pre` + fixer `scripts/fix_rev02_batch12b.py` (guarded, dry-run capable).
- mojibake: cyrillic=0 / U+FFFD=0 still.

---

## 5. NOT done (red lines, wait for operator)

- `data/tests.json` untouched (repo file; the freshly built copy is at `/tmp/tests_b12.json` only).
  No cp to prod `/srv/pa-manager-prod/`. git HEAD `5a60875`, 0 commit / 0 stage / 0 push.
- xlsx now M (batch1 37 + ... + batch11 41 + **batch12 21 cells**), new scripts `fix_rev02_batch12.py`,
  `gen_rev02_batch12.py`, `dump12.py`, 1 batch12 backup uncommitted.
- The 5 TBD rows (2203/2207/2290/2291/2292) remain UNRESOLVED until the library fills the TBD criteria.
- The row-2 vs row-1 item-numbering discrepancy (2290 report items vs 2291 built items) is flagged, not fixed.

---

## 6. Next steps

1. **Functionality sheet is DONE (100% under the report's row-2 convention)**. The full 6-sheet library
   (3112 items in tests.json) has now had its L1 round-2 Functionality pass completed.
2. Remaining work for the operator: (a) decide on the report item-numbering discrepancy (row-2 vs row-1);
   (b) fill the 5 TBD criteria (2203/2207/2290/2291/2292) in the library for a later re-review;
   (c) add the §18d/§20v sdr-elist fallback wholesale across the sensor rows;
   (d) when operator says so: `data/tests.json` sync from /tmp/tests_b12.json, commit, push.
3. No further Functionality row-by-row windows needed.

---

## One-liner

Items 2201-2290 reviewed (NO 24 / PARTIAL 40 / YES 21 / UNRESOLVED 5, cumulative 2290 - Functionality
FINAL) + **21 cells** fixed in xlsx (13 ai_commands + 2 verdict + 6 pkg; all Functionality): 8 WR (copy errors /
incomplete flows 2203/2209/2241/2273/2277/2287/2290/2291) + 1 Q-LIT (2259) + 3 R5 (2228/2230/2279, two with
inner quotes) + 1 FAKE (2272 TEMP_HIB_PEX -> OOB sensor get) + verdict flips 2241 YES->PARTIAL (auth state
change) and 2272 PARTIAL->YES (read-only sensor, sibling 1891). Zero-regression (exactly 21 cells, 5 other
sheets 0 diff). 5 TBD rows UNRESOLVED. tests.json/commit/push await operator. 🏁 Functionality 100% done.
**Post-delivery amendment (batch12b)**: closing audit co-synced stale `ai_logs_output`/`risk` on the 9
WR/FAKE rows (+13 cells -> 34 vs the batch-12 pre-fix backup); build still 3112/6. See §4b.
<｜DSML｜parameter name="summary" string="true">Create batch12 handoff file (part 1)