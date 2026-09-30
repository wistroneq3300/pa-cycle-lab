# Handoff — Round-2 official 3112 review items 1401-1600 (2026-09-18)

> Read FIRST: this file + SESSION_HANDOFF_ROUND2_BATCH7_1400_20260918.md +
> SESSION_HANDOFF_ROUND2_BATCH6_1200_20260918.md + REVIEW_WORKFLOW_LOGIC.md (section 18 a-l /
> 19 m-u / 20 v-aa / 21 locked).
> This window did: Functionality rows 1403-1602 (200 cases) review + 28 cells fixed in xlsx +
> zero-regression, report extended to `review_round_02_functionality.md`.

---

## 0. Deliverables this window

| file | purpose |
|---|---|
| `review_round_02_functionality.md` (38955 -> 44530 lines) | added 8th batch (items 1401-1600) per-case "8Q+5seg+section 18h three + verdict"; head title (`1-1600`) + batch8 markers updated |
| `data/REVISED_commands_merged_with_raw.xlsx` (working tree) | **28 cells actually modified** (27 `ai_commands` col15 + 1 `ai_can_execute` col13 row 1456), all Functionality |
| `scripts/fix_rev02_batch8.py` | this batch xlsx fixer (row-located, not code-located) |
| `scripts/gen_rev02_batch8.py` | this batch report generator |
| `data/REVISED_commands_merged_with_raw.xlsx.bak_rev02_batch8_20260906_232958` | pre-fix backup |

mojibake: cyrillic=0 / U+FFFD=0 (xlsx + report). git HEAD `5a60875`.

---

## 1. Review result (items 1401-1600)

**verdict (section 21 locked) distribution (this batch)**:
| verdict | count |
|---|---|
| NO/PHYSICAL | 44 |
| PARTIAL | 67 |
| YES | 85 |
| UNRESOLVED | 4 |

**Cumulative (1-1600)**: NO/PHYSICAL **310** / PARTIAL **545** / YES **621** / UNRESOLVED **124** (=1600).

This block = FRU Inventory read -> GPU write-protect (+ peltier/unsupported-CPU/DIMM fault injection)
-> hot-plug -> the whole BIOS Sanity/BASIC family (Menu / Flash / Hotkey / SMBIOS Type 1-46 / Advanced)
-> BMC read (SDR/sensor/LAN/LED + Web/Redfish CRUD) -> AMD SVM GPU thermal/stress.

---

## 2. Defects actually fixed in xlsx this batch (28 cells = 27 ai_commands col15 + 1 ai_can_execute col13)

| class | count | rows |
|---|---|---|
| FAKE (placeholder `echo <vendor-msg>` -> real vendor-tool wrapper `${TOOL_PATH:?operator ...}`, section 19r) | 4 (cmd) | 1418, 1419, 1420, 1421 |
| Q-LIT (ssh inner grep/echo bare double-quote -> single-quote) | 7 (cmd) | 1433, 1434, 1435, 1465, 1466, 1484, 1529 |
| Q-LIT+DBL-SSH (1435 also collapsed a nested ssh) | see above | 1435 |
| DBL-SSH (nested `sshpass ... ssh` inside a remote ssh -> collapse to single hop) | 2 (cmd) | 1435, 1596 |
| R5 (Redfish curl wrongly wrapped in DUT-ssh with broken nested quotes -> agent-host) | 1 (cmd) | 1499 |
| WR (command content does not match Items/procedure -> rewrite to the real procedure logic) | 14 (cmd) | 1436, 1437, 1455, 1456, 1457, 1458, 1459, 1460, 1516, 1517, 1530, 1531, 1532, 1562 |
| verdict NO->YES | 1 (ai_can_execute) | 1456 |

Unique rows fixed = 27 (ai_commands) + 1 verdict row = **28 cells**. All Functionality.

**WR detail** (biggest class):
- 1436/1437 (BMC WebUI BIOS Version / Event Log check) had copied the AMI-tool upgrade/downgrade
  text -> rewritten to Redfish FirmwareInventory + `dmidecode -s bios-version`, and OS+BMC log read.
- 1455 (FW package Release Note) had copied a BIOS "Change Opt." hotkey text -> is a doc review,
  `-- not runnable by agent`.
- 1457/1458/1459 (BIOS Flash Method Upgrade/Same/Downgrade) had copied "Optimized Defaults /
  Save&Exit" hotkey text -> rewritten as state-changing pre-OS UEFI/AMI flash, `-- not runnable by agent`.
- 1460 (Flash by SF600) -> physical programmer hookup, `-- not runnable by agent`.
- 1516/1517 (Dedicated NIC / LED) had a bogus `dcmi power reading` / LED text -> rewritten to real
  OOB `lan print` + Redfish `EthernetInterfaces` read.
- 1562 (ACPI AC Loss Control) had copied the "Flash BIOS multi-time" text -> rewritten to `chassis
  policy` + `chassis status` OOB, operator still cuts/restores AC (physical tail).
- 1530/1531/1532 (AMD SVM WAFL / HBM / thermal) each had copied the previous RAS-injection text
  (SDMA/bad-page/PCIe-CRC) -> rewritten to the real procedure: amdxio `-wafl -linkstatus`, AGT PM
  logger + hip-stream BabelStream, amd-smi + coralgemm gemm; vendor tools are `${AMD_XIO_DIR:?}` /
  `${AGT_DIR:?}` / `${GSTOOL_DIR:?}` slots (section 19r, no invented vendor run cmd).

**FAKE detail**: 1418-1421 (Mi300 GPU FRU / VBIOS / SW FW write-protect) had a placeholder
`echo "check ... via vendor utility"` (a fake-completion, section 19o) -> replaced with a
`${GPU_FRU_WP_TOOL:?}` / `${SW_WP_TOOL:?}` wrapper the operator fills with the AMD util path.

**Q-LIT detail**: 1433/1434/1435/1465/1466/1484/1529 ssh-inner `grep -i "X"` / `echo "X"` broke the
outer ssh string -> single-quoted the inner pattern. 1435/1596 also had a nested second `sshpass ssh`
inside the first -> collapsed to a single hop.

**R5 detail**: 1499 (BMC FW flash via Redfish) wrapped a `curl -X POST ... multipart` inside DUT-ssh
with broken nested quotes -> moved to agent-host one-liner + a FirmwareInventory GET read-back.

**verdict change**: 1456 (FW File checksum) was `NO` only because its ai_commands held a misassigned
"General Help hotkey" text; the real command is `md5sum ${FW_IMAGE:?...}` which is safe/read-only and
runs in one shot once the operator gives the image -> NO->YES (matches locked-section-21 YES-class; same
as batch6's single row 1195 NO->YES precedent).

---

## 3. Big finding this batch: 4 rows TBD -> UNRESOLVED (report-level, NOT an xlsx edit)

1539 (Flash BIOS multi-time: criteria TBD), 1575/1576/1577 (DF Common Options / Memory Addressing /
Link-xGMI: procedure AND criteria TBD). Per locked section 21 rule these are **UNRESOLVED** (8Q cannot
be answered). The xlsx `ai_commands` already say TBD/cannot-classify, so nothing to repair; the
test-library must fill the TBD bytes/end-state, then re-review at L1.

Also consistent-libarary note (deferred, not a batch8 defect): the OOB `sensor get 'NAME'` / GPU-sensor
rows (1495/1500/1501/1503/1504/1507/1518/1519 etc.) still describe `sdr elist` + `sensor list` but the
sensor-name-fallback (`sdr elist` when `get` not-found, section 20v) is a whole-sensor-block pattern to
be standardized in a later batch, same as batch4/5/7 observations.

---

## 4. Zero-regression verified

- build: `python3 scripts/build_testlib_json_xlsx.py data/REVISED_commands_merged_with_raw.xlsx /tmp/tests_new_b8.json`
  -> **total=3112 / 6 sheets unchanged** (2291 / 202 / 60 / 459 / 88 / 12).
- cell diff vs backup: exactly **28 cells** changed, all Functionality: 27 x col15 (ai_commands) + 1 x
  col13 (ai_can_execute row 1456). No other column changed; no cell outside rows 1403-1602 (min 1418, max 1596).
- cyrillic=0 / U+FFFD=0 (xlsx + report).

---

## 5. NOT done (red lines, wait for operator)

- `data/tests.json` untouched (git no M, still = HEAD batch1-synced); no cp prod `/srv/pa-manager-prod/`;
  no commit / no stage / no push.
- git 0 commit / 0 stage / 0 push; xlsx now M (batch1 37 + batch2 36 + batch3 3 + batch4 10 + batch5 16 +
  batch6 34 + batch7 60 + **batch8 28 cells**), new scripts `fix_rev02_batch8.py`, `gen_rev02_batch8.py`,
  1 batch8 backup uncommitted.
- Earlier stray working-tree files (data/ADDITIONS.csv / data/REVISED_commands.csv / static/* /
  OPENHANDS_PASTE_NEXT_WINDOW.md / pre-batch8 backups) not touched by this window.

---

## 6. Next window

1. Continue Functionality rows 1603-1802 (1600->1800; table total 2291, 1600 done) -> same rules.
2. row<->item alignment stays item = row-2; next batch = xlsx rows 1603-1802 / items 1601-1800. Verify
   no row/item offset first (prior windows caught 202/402 gaps).
3. New defect types fixed in-session as before: fix xlsx -> build -> zero-regression (only the batch may
   differ) -> record in handoff.
4. `data/tests.json` sync / commit / push **only when operator says so**.
5. This batch's leftover observation: many Redfish/BMC-web rows use `${...:?}` instance slots
   (session/networking/account/cert) the operator must fill from the collection listing (vendor slot,
   section 18b) - expected, not a defect. The AMD SVM rows need the amdxio/AGT/gemm binaries (vendor
   slots) before they can actually run.

---

## One-liner

Items 1401-1600 reviewed (NO 44 / PARTIAL 67 / YES 85 / UNRESOLVED 4, cumulative 1600) + 28 cells fixed
in xlsx (27 ai_commands: 4 FAKE + 7 Q-LIT + 2 DBL-SSH + 1 R5 + 14 WR + 1 verdict row 1456 NO->YES) +
zero-regression (exactly 28 cells); 4 TBD rows flagged UNRESOLVED (BIOS flash multi-time / DF / memory
addressing / xGMI, library must fill TBD first). tests.json/commit/push await operator; next window 1600-1800.
