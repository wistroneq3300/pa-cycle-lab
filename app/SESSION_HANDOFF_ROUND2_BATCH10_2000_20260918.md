# Handoff — Round-2 official 3112 review items 1801-2000 (2026-09-18)

> Read FIRST: this file + SESSION_HANDOFF_ROUND2_BATCH9_1800_20260918.md +
> REVIEW_WORKFLOW_LOGIC.md (section 18 a-l / 19 m-u / 20 v-aa / 21 locked).
> This window did: Functionality rows 1803-2002 (200 cases) review + 25 cells fixed in xlsx +
> zero-regression, report extended to `review_round_02_functionality.md`.

---

## 0. Deliverables this window

| file | purpose |
|---|---|
| `review_round_02_functionality.md` (50206 -> 55835 lines) | added 10th batch (items 1801-2000) per-case "8Q+5seg+section 18h three + verdict"; head title (`1-2000`) + batch10 cumulative line added |
| `data/REVISED_commands_merged_with_raw.xlsx` (working tree) | **25 cells actually modified** (23 `ai_commands` col15 + 1 `ai_can_execute` col13 row 1843 + 1 `ai_packages_needed` col14 row 1843), all Functionality |
| `scripts/fix_rev02_batch10.py` | this batch xlsx fixer (row-located, not code-located) |
| `scripts/gen_rev02_batch10.py` + `scripts/dump10.py` | this batch report generator + row dumper |
| `data/REVISED_commands_merged_with_raw.xlsx.bak_rev02_batch10_20260907_100146` | pre-fix backup |

mojibake: cyrillic=0 / U+FFFD=0 (xlsx + report). git HEAD `5a60875`.

---

## 1. Review result (items 1801-2000)

**verdict (section 21 locked) distribution (this batch)**:
| verdict | count |
|---|---|
| NO/PHYSICAL | 25 |
| PARTIAL | 28 |
| YES | 132 |
| UNRESOLVED | 15 |

**Cumulative (1-2000)**: NO/PHYSICAL **351** / PARTIAL **651** / YES **835** / UNRESOLVED **163** (=2000).

This block = I2C board scan (FAN/PDB/HSC/RIO/FIO/Cable/M.2/E1S) + I2C board connection TBD (MB/BMC/
SW/NV_SWITCH/PSU/FAN/PDB/HSC/RIO/FIO/Cable/M.2) + the big UBB/GB/MB/OCP/CEM/NIC/VDD/PVDD sensor family
(TEMP_*/PWR_*/SPD_*/FAN_*/PSU_*/CPU0~N / Power DIMM Zone / PVDD* P0~N) + L10 System LED block +
GB NV PVP (NVSSVT/NVRASTool/NVDebug + NVQual + 7 SY reboot/DC/AC stress + tray hot-swap/button) +
BIOS Sanity SMBIOS Type 11..45 dmidecode + BMC WebUI (SEL/POST/Profile/Logout) + Redfish
(Chassis/Power Cycle/Log/TaskService/CertService/Manager Reset/GPU OEM) + AMD SVM (EINJState/
Bad Page x3/XGMI+PCIe margin/pldmtool UBB SMC) + Comport (Console/Serial/Comm).

---

## 2. Defects actually fixed in xlsx this batch (25 cells)

| class | count | rows |
|---|---|---|
| Q-LIT (ssh inner bare double-quote -> single-quote / drop inner echo) | 11 | 1803, 1804, 1805, 1806, 1807, 1808, 1809, 1812, 1814, 1918, 1919 |
| R5 (OOB ipmitool/Redfish wrongly wrapped in DUT-ssh -> move to agent-host) | 7 | 1844, 1845, 1955, 1966, 1967, 1969, 1970 |
| WR (command content / sensor-name mismatch vs Items/procedure -> rewrite) | 4 | 1843, 1891, 1958, 1977 |
| FAKE ("not directly runnable / give exact bytes" that is actually runnable -> real Redfish) | 1 | 1962 |
| VERDICT+PKG (col13 NO->YES + col14 SF600->ipmitool, on 1843) | 2 cells | 1843 (col13) + 1843 (col14) |

col15 ai_commands unique rows = **23** (44 in batch9 -> 23 here, all within rows 1803-1977);
col13 ai_can_execute = **1** (row 1843); col14 ai_packages_needed = **1** (row 1843). All Functionality.

**WR detail** (biggest class):
- 1843 (STATUS_UP_FAN 1~N, "With SW BD Sensor List"): the ai_commands was SF600-flash physical text —
  a copy error. It sits in the exact same sensor-list block as 1844 (STATUS_LOW_FAN) + 1845 (STATUS_PSU),
  both of which use `ipmitool sdr list | grep -Ei 'FAN|...'`. Rewrote 1843 to `sdr list | grep -Ei
  'FAN|UP_FAN|RPM'` (agent-host, OOB, from the agent host) and flipped its verdict NO->YES (same as the
  two siblings) + pkg col14 SF600->ipmitool. col13 ai_can_execute for 1843 was `NO` purely because the
  old command was SF600; the *real* test is a read-only sensor-list command, agent-runnable.
- 1891 (Wistron-BMC-00980-V002, TEMPs list, Items=TEMP_HIB_PEX1~4): sensor arg was the sibling row's
  `TEMP_LP1~8_Chip` (batch9's 1693-1704 / 1686 WR pattern again — same family, different block).
  Corrected to `sensor get 'TEMP_HIB_PEX1~4'`.
- 1958 (AMD SVM-00124-V003, "Check XGMI Link Status"): ai_commands was a GFX error-injection text from
  a different RAS case. Rewrote to `amdxio -xgmi -linkstatus | tail -n 40` on the DUT host (vendor tool
  slot stays operator-provided).
- 1977 (HW-00472-V002, "Console Test"): ai_commands was a PCIe LTSSM Tx-eq redo text from a different
  HW PVP case. Rewrote to `ipmitool sol info` + a note that the physical COM-port wiring is operator's.

**Q-LIT detail**:
- 1803-1809 + 1812 + 1814 (9 I2C bus-scan rows): the inner `grep -oE "i2c-[0-9]+"` had **unescaped
  double-quotes** inside the outer ssh double-quoted command string — the inner `"` terminates the outer
  string. Fixed: `grep -oE 'i2c-[0-9]+'` (single quotes).
- 1918 + 1919 (NVQual NT.1/NT.4): the inner `echo "NVQual launch per NVIDIA docs"; nvqual -h ...` had
  the same issue. Dropped the nested echo + kept `nvqual -h 2>&1 | head -n 20` as a clean single command
  inside the outer ssh string (NVQual is a vendor tool, operator-provided).

**R5 detail**:
- 1844 (STATUS_LOW_FAN) + 1845 (STATUS_PSU): OOB ipmitool commands were wrapped inside a DUT-ssh string
  with inner unescaped double-quotes (the ssh host runs ipmitool against its own BMC over the BMC IP, not
  the operator's agent host — wrong host + wrong env vars). Moved both to the agent-host OOB directly,
  single-quoted the inner grep pattern.
- 1955 (AMD EINJState RAS Enablement): OOB Redfish `curl ... http://$BMC_IP/redfish/v1/Chassis/OAM_0`
  was inside a DUT-ssh string. Moved to agent-host Redfish; enablement is the operator's WRITE step.
- 1966 (TaskService) + 1967 (CertificateService) + 1969 (Manager Reset ActionInfo) + 1970 (GPU OEM):
  OOB Redfish GETs were inside a DUT-ssh string. All four moved to agent-host, no SSH wrapper.

**FAKE detail**:
- 1962 (Redfish Chassis Power Cycle): the ai_commands was `-- not directly runnable with stock ipmitool
  high-level (Power Cycle); give exact bytes.` — the workbook's own procedure shows the exact Redfish
  POST (`/redfish/v1/Systems/system/Actions/ComputerSystem.Reset` ResetType=PowerCycle), so the command
  IS directly runnable. Rewrote to a real Redfish POST + `PowerState` read-back, state-changing / R22
  risk flagged (operator approves before the agent runs it). Verdict col13 stayed PARTIAL (state-changing
  power cycle requires operator approval + a full host-reboot — the "operator 在場/批准" class).

---

## 3. Big finding this batch: 15 rows UNRESOLVED (report-level, NOT an xlsx edit)

Rows where BOTH Criteria AND Procedure are literal "TBD" (empty test description):
**1817-1831** (all 15 rows; the I2C board connection tests Wistron-HW-00439-V002 .. Wistron-HW-00454-V002).
The xlsx `ai_commands` for these rows is still the batch-9-era `-- not runnable by agent` explanatory
text (two of them, rows 1830-1831, carry a working `ipmitool fru print` probe); either way the test
PROCEDURE is TBD, so the 8 questions cannot be answered -> UNRESOLVED per locked section 21. The
test-library must fill in the TBD expected results before L1 re-review. NOT an xlsx defect.

Also deferred (not a batch10 defect, consistent-library note): the §20v `sensor get 'NAME'` + `sdr
elist` fallback pattern — still not applied to the OOB sensor rows in this batch (80 rows spanning
1832-1890 + 1980-2001 use a single bare `sensor get 'NAME'` with no fallback). Same class as batch
4/5/7/8/9 deferral; to be standardized in a later batch when the library fills in the expected results.

---

## 4. Zero-regression verified

- build: `python3 scripts/build_testlib_json_xlsx.py data/REVISED_commands_merged_with_raw.xlsx /tmp/tests_b10.json`
  -> **total=3112 / 6 sheets** (2291 / 202 / 60 / 459 / 88 / 12) unchanged.
- cell diff vs backup (`...bak_rev02_batch10_20260907_100146`): exactly **25 cells** changed
  (23 Functionality col15 + 1 Functionality col13 row 1843 + 1 Functionality col14 row 1843).
  All within rows 1803-1977 (within the batch window 1803-2002).
- 5 other sheets (Reliability / Performance / Compatibility / Stability / (No Main Function)): **0 diff**.
- Functionality col17 (risk) + col18 (remark): **0 diff**.
- mojibake: cyrillic=0 / U+FFFD=0 (xlsx + report).

---

## 5. NOT done (red lines, wait for operator)

- `data/tests.json` untouched (repo file; the freshly built copy is at `/tmp/tests_b10.json` only).
  No cp to prod `/srv/pa-manager-prod/`. git HEAD `5a60875`, 0 commit / 0 stage / 0 push.
- xlsx now M (batch1 37 + ... + batch9 44 + **batch10 25 cells**), new scripts `fix_rev02_batch10.py`,
  `gen_rev02_batch10.py`, `dump10.py`, 1 batch10 backup uncommitted.
- The I2C-TBD rows (1817-1831) + the codec/gaming/display TBD from batch 9 remain UNRESOLVED until the
  library fills in the expected bitstream/quality.

---

## 6. Next window

1. Functionality rows 2003-2202 (next 200; table total 2291, 2000 done) -> same rules.
2. row<->item alignment stays item = row-2; next batch = xlsx rows 2003-2202 / items 2001-2200.
   The sheet is 2292 rows; after items 2201-2290 (rows 2203-2292) the Functionality sheet is done.
3. Same four-defect-class pattern: Q-LIT / R5 / WR / FAKE + VERDICT+PKG where a copy-error text
   (same SF600/PCIe-LTSSM/GFX-injection cross-contamination) was found again.
4. `data/tests.json` sync / commit / push **only when operator says so**.

---

## One-liner

Items 1801-2000 reviewed (NO 25 / PARTIAL 28 / YES 132 / UNRESOLVED 15, cumulative 2000) + **25 cells**
fixed in xlsx (23 ai_commands + 1 verdict + 1 pkg; all Functionality): 11 Q-LIT (I2C grep + NVQual
inner-quote) + 7 R5 (OOB ipmitool/Redfish out-of-DUT-ssh) + 4 WR (sensor-name + 3 cross-contaminated
text blocks) + 1 FAKE (Redfish Power Cycle) + 1 verdict/pkg pair on 1843. Zero-regression (exactly 25
cells, 5 other sheets 0 diff). 15 TBD rows flagged UNRESOLVED (sensor/I2C library must fill TBD first).
tests.json/commit/push await operator; next batch rows 2003-2202.
