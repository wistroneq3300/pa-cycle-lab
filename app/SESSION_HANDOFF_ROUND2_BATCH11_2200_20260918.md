# Handoff — Round-2 official 3112 review items 2001-2200 (2026-09-18)

> Read FIRST: this file + SESSION_HANDOFF_ROUND2_BATCH10_2000_20260918.md +
> REVIEW_WORKFLOW_LOGIC.md (section 18 a-l / 19 m-u / 20 v-aa / 21 locked).
> This window did: Functionality rows 2003-2202 (200 cases) review + 37 cells fixed in xlsx +
> zero-regression, report extended to `review_round_02_functionality.md`.

---

## 0. Deliverables this window

| file | purpose |
|---|---|
| `review_round_02_functionality.md` (55835 -> 61721 lines) | added 11th batch (items 2001-2200) per-case "8Q+5seg+section 18h three + verdict"; head title (`1-2200`) + batch11 marker + cumulative line added |
| `data/REVISED_commands_merged_with_raw.xlsx` (working tree) | **41 cells actually modified** (37 `ai_commands` col15 + 2 `ai_can_execute` col13 row 2012/2039 + 2 `ai_packages_needed` col14 row 2012/2039), all Functionality |
| `scripts/fix_rev02_batch11.py` | this batch xlsx fixer (row-located, not code-located) |
| `scripts/gen_rev02_batch11.py` + `scripts/dump11.py` | this batch report generator + row dumper |
| `data/REVISED_commands_merged_with_raw.xlsx.bak_rev02_batch11_20260907_120511` | pre-fix backup |

mojibake: cyrillic=0 / U+FFFD=0 (xlsx + report). git HEAD `5a60875`.

---

## 1. Review result (items 2001-2200)

**verdict (section 21 locked) distribution (this batch)**:
| verdict | count |
|---|---|
| NO/PHYSICAL | 34 |
| PARTIAL | 120 |
| YES | 41 |
| UNRESOLVED | 5 |

**Cumulative (1-2200)**: NO/PHYSICAL **385** / PARTIAL **771** / YES **876** / UNRESOLVED **168** (=2200).

This block = the tail of the Functionality sheet: Mechanical (DC-SCM/OSFP/Mellanox CX8/BF3/CX9/BF4 + SF600
flash) + the whole "Sensor check" family (MB/Processor/OSFP/PCIE/CX8/NM/RETIMER/PDB/HSC/TEMP/INTB/LAN/
INTEL_NIC/NIC_QSFP/PCIE_SW/VOLT/AMP/CPU_DIMM/WATCHDOG/STATUS/REDUNDANCY/POWER/SYSTEM_CONFIG/GB/GPU/GB_SXM/FW)
+ M.2 FW flash + BIOS C/P-state + PCIe Switch FW flash + AMD BMC-remove-management (UBB/OAM Telemetry/FW/
Health/SMC/Log/Power, BMC VNIC 192.168.31.1) + AMD System Stress (AMD-SMI/AGFHC) + AMD RAS (amdgpuras
EINJ full family) + BMC Dimm usage + GB NV PVP (LC leak/Power EDPp/PCIe EOM-SpeedChange/LTSSM/NVQual/
I2C/SPI/UART/USB) + HGX NV PVP (PCIe/NVLink/Storage/Networking/HMC/USB/CPU/DG/SY/SW NVSSVT/NVRAS/NVDebug)
+ BIOS default/Change-default Intel + MODS Test + Telemetry INA/OVRM.

---

## 2. Defects actually fixed in xlsx this batch (41 cells)

| class | count | rows |
|---|---|---|
| Q-LIT (ssh 內層雙引號 → 單引號 / 遠端迴圈變數 \$ 逸出) | 29 | 2049, 2066, 2105, 2123, 2125, 2149, 2151, 2154, 2155, 2166, 2167, 2168, 2169-2174, 2194, 2198-2201 + BMC-VNIC 2050-2055 |
| Q-LIT+DBL-SSH (內層引號 + 收斂雙層 sshpass 為一跳) | 2 | 2043, 2044 |
| R5 (BMC shell 誤經 DUT 雙跳 → agent-host 直連) | 1 | 2092 |
| WR (sensor 名/命令內容與 Items 不符 → 依 Items/procedure 重寫) | 5 | 2012, 2028, 2039, 2045, 2202 |
| VERDICT (col13 判改) + PKG (col14 套件) | 2+2 | 2012 PARTIAL→YES, 2039 NO→YES + pkg→ipmitool |

col15 ai_commands unique rows = **37** (44 in batch9, 23 in batch10 -> 37 here, all within rows 2012-2202);
col13 ai_can_execute = **2** (rows 2012, 2039); col14 ai_packages_needed = **2** (rows 2012, 2039).
All Functionality.

**WR detail** (biggest story — copy-error repeats from batch9/10):
- 2012 (Sensor Check - PCH, TS "Sensor check"): the ai_commands was a NVMe/E1.S MODS read/write text from
  the batch-10 MODS block (HW-00482). Same `sensor get` block as 2011/2013 (both YES). Rewrote to
  `sensor get 'Sensor Check - PCH'` (agent-host OOB), flipped col13 PARTIAL->YES + pkg->ipmitool.
- 2039 (Check Status - GB, TS "Sensor check"): the ai_commands was a "KVM - Without USB hub" BMC-web-UI text
  from a different family. Same sensor block. Rewrote to `sensor get 'Check Status - GB'`, flipped col13
  NO->YES (read-only sensor read) + pkg->ipmitool.
- 2028 (Power Reading Check - PWR): sensor arg was the sibling row's `'Sensor Check - PDB'` -> corrected to
  `'Power Reading Check - PWR'` (same family, kept YES).
- 2045 (Flash PCIe Switch Firmware): the ai_commands was a "DC Cycle - Speed&Link" text from a different HW
  PVP block -> rewrote to the real g4Xdiagnostics flash wrapper (`unzip ... g4Xdiag flash ${SW_FW_IMAGE:?}`).
- 2202 (Telemetry INA/OVRM): the ai_commands was `sensor get 'Sensor Check - PDB'` -> rewrote to
  `sdr list | grep -Ei 'INA|OVRM|PWR'` (read the telemetry current/power sensors).

**Q-LIT detail**:
- General DUT-ssh rows (24): 2049 (amdxio 4pt), 2066 (Post-Boot echo), 2105 (DOCA), 2123/2125 (NVQual echo),
  2149 (USB2.0), 2151 (SY.2 grep -E), 2154 (NVSSVT echo--), 2155 (NVRAS), 2166/2167/2168 (UART dmesg grep),
  2169-2174 (USB hub grep -iE), 2194 (Vendor ID), 2198-2201 (MODS echo) — inner `echo "..."` / `grep ... "..."`
  double-quotes broke the outer ssh string -> single-quoted; the nested `echo "..."` markers were dropped and
  replaced with single-quoted `echo ---...---` or removed.
- BMC-VNIC block 2050-2055 (6 rows): these query the DUT-side BMC VNIC 192.168.31.1, reachable ONLY from the
  DUT host -> they STAY on the DUT (NOT R5). The inner `-u "$BMC_USER:$BMC_PASS"` double-quote broke the outer
  ssh string -> single-quoted `-u '$BMC_USER:$BMC_PASS'`. Remote loop vars that must expand on the DUT were
  escaped as `\$OAM` (would otherwise expand agent-side). 2053's JSON `-d '{\"ResetType\":\"ForceRestart\"}'`
  was emitted with escaped `\"` so it survives inside the outer double-quoted ssh string.

**Q-LIT+DBL-SSH detail**: 2043 (C-state) + 2044 (P-state) each had TWO sequential sshpass-ssh hops + inner
double-quoted greps -> collapsed to ONE hop + single-quoted the inner grep (matches batch9 Q-LIT+DBL pattern).

**R5 detail**: 2092 (BMC Dimm usage) reached the BMC shell via a nested sshpass-inside-sshpass double hop
(DUT-host -> BMC) with the inner `"$BMC_USER"@"$BMC_IP"` unwrapped -> moved to agent-host direct BMC SSH
(`BMC_SSH`), single-quoted the grep.

**VERDICT logic (mirrors batch10 row 1843)**: 2012 + 2039 both held a copy-error text; the *real* test (same
sensor-read block as their siblings) is a read-only `sensor get` the agent runs from the agent host, so
col13 flipped to YES and col14 pkg->ipmitool. This was NOT flagged UNRESOLVED because their Criteria/Procedure
are fully described (only the MODS+Telemetry rows 2198-2202 have literal TBD).

---

## 3. Big finding this batch: 5 rows UNRESOLVED (report-level, NOT an xlsx edit)

Rows whose Criteria are literal "TBD" (and Procedure has "During Test: TBD"): **2198 (CPUDVFS Test),
2199 (CPU Thermal Stress Test), 2200 (USB2.0 MCTP Function), 2201 (NVMe/E1.S Read/Write test), 2202
(Telemetry INA/OVRM)** — all in the MODS Test / Telemetry block. The xlsx `ai_commands` were still fixed
(2198-2201 = MODS vendor wrapper with inner-quote fix; 2202 = real INA/OVRM sdr read), but the test
CRITERIA is TBD so the 8 questions cannot be answered -> UNRESOLVED per locked section 21. The test-library
must fill the TBD Before each L1 re-review. NOT an xlsx defect.

Also deferred (consistent-library note, NOT a batch11 defect): the OOB `sensor get 'NAME'` rows in the
2010-2040 "Sensor check" block (30+ rows) still use a single `sensor get` with no §20v/§18d `sdr elist`
fallback — the exact same whole-sensor-block deferral noted in batches 4/5/7/8/9/10, to be standardized in
a later batch when the library fills expected results.

---

## 4. Zero-regression verified

- build: `python3 scripts/build_testlib_json_xlsx.py data/REVISED_commands_merged_with_raw.xlsx /tmp/tests_b11.json`
  -> **total=3112 / 6 sheets unchanged** (2291 / 202 / 60 / 459 / 88 / 12).
- cell diff vs backup (`...bak_rev02_batch11_20260907_120511`): exactly **41 cells** changed
  (37 Functionality col15 + 2 Functionality col13 row 2012/2039 + 2 Functionality col14 row 2012/2039).
  All within rows 2012-2202 (within the batch window 2003-2202).
- 5 other sheets (Reliability / Performance / Compatibility / Stability / (No Main Function)): **0 diff**.
- Functionality col17 (risk) + col18 (remark): **0 diff**.
- mojibake: cyrillic=0 / U+FFFD=0 (xlsx + report).

---

## 5. NOT done (red lines, wait for operator)

- `data/tests.json` untouched (repo file; the freshly built copy is at `/tmp/tests_b11.json` only).
  No cp to prod `/srv/pa-manager-prod/`. git HEAD `5a60875`, 0 commit / 0 stage / 0 push.
- xlsx now M (batch1 37 + ... + batch10 25 + **batch11 41 cells**), new scripts `fix_rev02_batch11.py`,
  `gen_rev02_batch11.py`, `dump11.py`, 1 batch11 backup uncommitted.
- The MODS/Telemetry TBD rows (2198-2202) remain UNRESOLVED until the library fills the TBD criteria.

---

## 6. Next window

1. Functionality rows 2203-2292 (last 90 rows; table total 2291, 2200 done) -> same rules. After items
   2201-2290 (rows 2203-2292) the Functionality sheet is 100% done (90 remaining cases).
2. row<->item alignment stays item = row-2; next window = xlsx rows 2203-2292 / items 2201-2290.
3. Same four-defect-class pattern: Q-LIT / R5 / WR / FAKE + VERDICT+PKG where a copy-error text is found.
4. `data/tests.json` sync / commit / push **only when operator says so**.
5. This batch's leftover observation: the `sensor get 'NAME'` + the MODS/Telemetry TBD rows need the library
   to standardize the §20v fallback (sensor) and fill the TBD criteria before L1 re-review.

---

## One-liner

Items 2001-2200 reviewed (NO 34 / PARTIAL 120 / YES 41 / UNRESOLVED 5, cumulative 2200) + **41 cells**
fixed in xlsx (37 ai_commands + 2 verdict + 2 pkg; all Functionality): 29 Q-LIT (incl. BMC-VNIC 2050-2055)
+ 2 Q-LIT+DBL-SSH (C/P-state collapse) + 1 R5 (BMC shell double-hop) + 5 WR (sensor-name/command copy errors
2012/2028/2039/2045/2202) + 2 verdict/pkg pairs on 2012 (PARTIAL->YES) + 2039 (NO->YES). Zero-regression
(exactly 41 cells, 5 other sheets 0 diff). 5 MODS/Telemetry TBD rows flagged UNRESOLVED. tests.json/commit/
push await operator; next window rows 2203-2292 (Functionality finish).
