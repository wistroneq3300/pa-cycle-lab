# Handoff — Round-2 official 3112 review items 1001-1200 (2026-09-18)

> Read FIRST: this file + SESSION_HANDOFF_ROUND2_BATCH5_1000_20260918.md +
> SESSION_HANDOFF_ROUND2_BATCH2_400_20260918.md + SESSION_HANDOFF_ROUND2_SAMPLES_20260918.md +
> REVIEW_WORKFLOW_LOGIC.md (section 18 a-l / 19 m-u / 20 v-aa / 21 locked).
> This window did: Functionality rows 1003-1202 (200 cases) review + 34 cells fixed in xlsx +
> zero-regression, report extended to `review_round_02_functionality.md`.

---

## 0. Deliverables this window

| file | purpose |
|---|---|
| `review_round_02_functionality.md` (27895 -> 33327 lines) | added 6th batch (items 1001-1200) per-case "8Q+5seg + section 18h three + verdict"; head title + batch6 markers updated |
| `data/REVISED_commands_merged_with_raw.xlsx` (working tree) | **34 cells actually modified** (33 ai_commands + 1 ai_can_execute row 1195), all Functionality |
| `scripts/fix_rev02_batch6.py` | this batch xlsx fixer (row-located, not code-located) |
| `scripts/gen_rev02_batch6.py` | this batch report generator |
| `data/REVISED_commands_merged_with_raw.xlsx.bak_rev02_batch6_20260906_213414` | pre-fix backup |

mojibake: cyrillic=0 / U+FFFD=0 (xlsx + report). git HEAD `5a60875`.

---

## 1. Review result (items 1001-1200)

**verdict (section 21 locked) distribution (this batch)**:
| verdict | count |
|---|---|
| NO/PHYSICAL | 0 |
| PARTIAL | 75 |
| YES | 36 |
| UNRESOLVED | 89 |

**Cumulative (1-1200)**: NO/PHYSICAL **266** / PARTIAL **404** / YES **440** / UNRESOLVED **90** (=1200).

This block is the deep IPMI dive (all BMC): IPMI Messaging Support (IB/OOB) -> IPMI LAN -> SOL ->
Chassis -> Event -> SEL Device -> SDR (IB) -> FRU -> Sensor -> Wistron OEM (IB) -> Application (OOB) ->
Watchdog.

---

## 2. Defects actually fixed in xlsx this batch (34 cells = 33 ai_commands + 1 ai_can_execute)

| class | count | rows |
|---|---|---|
| R29 (missing `ipmitool` keyword inside DUT-ssh -> add `sudo ipmitool`) | 17 (cmd) | 1045, 1049, 1050, 1051, 1052, 1053, 1054, 1059, 1062, 1066, 1069, 1073, 1074, 1075, 1083, 1108, 1110 |
| R29+raw (add `ipmitool` + correct raw byte/proc) | 6 (cmd) | 1057, 1058, 1067, 1068, 1070, 1111 |
| WR (misassigned command, wrong target) | 4 (cmd) | 1067, 1194, 1195, 1058 |
| OOBinband (IB-title row wrongly used `-I lanplus` remote OOB -> in-band `sudo ipmitool raw`) | 7 (cmd) | 1095, 1112, 1113, 1114, 1115, 1116, 1117 |
| GUID-fix (Get Device GUID OOB wrong byte 0x0a 0x49=Set SEL Time -> 0x06 0x08) | 1 (cmd) | 1125 |
| ai NO->YES | 1 (ai_can_execute) | 1195 |

Rows overlap so unique fixed rows = 33. Only ONE `ai_can_execute` change this batch (row 1195).

**R29 details** (same class batch5 fixed, most numerous). The in-band IPMI sub-block (lan/chassis/
sel/sdr/sensor rows 1045-1111) had bare `ipmitool` subcommands inside the DUT-ssh (`"lan print"`,
`"chassis status"`, `"raw 0x00 0x2c"`, `"sel list"`, ...) with **no `ipmitool` keyword** -> `command
not found` on run. Fixed with `sudo ipmitool ` prefix; state-changing rows got read-back.

**WR details**: 1067 (Get SEL Allocation Info IB) pointed at `sensor get 'TEMP_M2'`; 1194 (Get SEL
Allocation Info OOB) pointed at `sensor get 'Status Check - STATUS'`; 1195 (Reserve SEL OOB) pointed at
a bogus `-- Screen: connect...` VGA/HDMI text (leftover from a display item). All corrected to the
procedure's raw command (1067/1194 `raw 0x0a 0x41`, 1195 `raw 0x0a 0x42`). Also 1058 Set Power Cycle
Interval had `raw 0x00 0x2c` missing the interval argument -> add `${POWER_CYCLE_INTERVAL_MS:?}`.

**OOBinband details**: 1095 Write FRU Data, 1112-1117 (FRU mfg date / i2c master / cpu capping / factory
reset / mac to EEPROM / LED control) all have IB titles but packaged `ipmitool -I lanplus ...` OOB
commands -> switched to in-band `sudo ipmitool raw <byte> ...` on the DUT.

**GUID-fix details**: 1125 Get Device GUID (OOB) used `raw 0x0a 0x49` (that byte = Set SEL Time,
netfn 0x0a/cmd 0x49 is "Get Device GUID" is 0x06 0x08). Per procedure "Send out-of-band command: ipmitool
-I lanplus ... raw 0x06 0x08" -> fixed to `raw 0x06 0x08`.

**ai change**: 1195 Reserve SEL (OOB) was mislabelled `NO` with a bogus screen-test description; the real
command is OOB `raw 0x0a 0x42` which the agent can run -> `ai_can_execute` NO->YES.

---

## 3. Big finding this batch: 89 rows are TBD -> UNRESOLVED (report-level, NOT an xlsx edit)

The IPMI Messaging Support bulk (00293-00433), the whole SDR (IB) block, and the Sensor-write block have
both Procedure During-Test and Criteria = **TBD** in the workbook. Per locked section 21 rule
(UNRESOLVED = TBD in data, 8Q cannot be answered), these 89 rows are marked **UNRESOLVED** in the report.
Their existing `ai_commands` already correctly say `-- not runnable: ...TBD...`, so there is nothing to
repair in xlsx; they need the operator/test-library to fill in the TBD bytes/end-state first, then the
row is re-reviewed at L1.

---

## 4. Zero-regression verified

- build: `python3 scripts/build_testlib_json_xlsx.py data/REVISED_commands_merged_with_raw.xlsx /tmp/tests_new.json`
  -> **total=3112 / 6 sheets unchanged** (2291 / 202 / 60 / 459 / 88 / 12).
- cell diff vs backup: exactly **34 cells** changed, all Functionality: 33 x col15 (ai_commands) + 1 x
  col13 (ai_can_execute row 1195). No other column changed.
- cyrillic=0 / U+FFFD=0 (xlsx + report).

---

## 5. NOT done (red lines, wait for operator)

- `data/tests.json` untouched (git no M, still = HEAD batch1-synced); no cp prod `/srv/pa-manager-prod/`;
  no commit / no stage / no push.
- git 0 commit / 0 stage / 0 push; xlsx now M (batch1 37 + batch2 36 + batch3 3 + batch4 10 + batch5 16 +
  **batch6 34 cells**), new scripts `fix_rev02_batch6.py`, `gen_rev02_batch6.py`, 1 batch6 backup uncommitted.
- Note: earlier stray working-tree files (data/ADDITIONS.csv / data/REVISED_commands.csv / static/* /
  OPENHANDS_PASTE_NEXT_WINDOW.md / pre-batch6 backups) not touched by this window.

---

## 6. Next window

1. Continue Functionality rows 1203-1402 (1200->1400; table total 2291, 1200 done) -> same rules.
2. row<->item alignment stays item = row-2; next batch = xlsx rows 1203-1402 / items 1201-1400. Verify
   no row/item offset first (prior windows caught 202/402 gaps).
3. New defect types fixed in-session as before: fix xlsx -> build -> zero-regression (only the batch may
   differ) -> record in handoff.
4. `data/tests.json` sync / commit / push **only when operator says so**.
5. This batch's left observation: IPMI raw/vendor-specific rows (Set LAN/SOL/Chassis Capabilities/
   Boot Options/System Info Parameters/Payload/User etc.) are PARTIAL because they need operator-supplied
   exact bytes/end-state; many still await library TBD fill-in. Consistent with the locked verdict rule.

---

## One-liner

Items 1001-1200 reviewed (NO 0 / PARTIAL 75 / YES 36 / UNRESOLVED 89, cumulative 1200) + 34 cells fixed
in xlsx (33 ai_commands incl. R29/WR/OOBinband/GUID + 1 ai NO->YES row 1195) + zero-regression
(exactly 34 cells); the IPMI-raw block has 89 TBD rows flagged UNRESOLVED (report-level, library must fill
TBD first). tests.json/commit/push await operator; next window 1200-1400.
