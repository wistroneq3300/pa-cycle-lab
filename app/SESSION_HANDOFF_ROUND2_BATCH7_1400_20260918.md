# Handoff — Round-2 official 3112 review items 1201-1400 (2026-09-18)

> Read FIRST: this file + SESSION_HANDOFF_ROUND2_BATCH6_1200_20260918.md +
> SESSION_HANDOFF_ROUND2_BATCH5_1000_20260918.md + REVIEW_WORKFLOW_LOGIC.md (section 18 a-l /
> 19 m-u / 20 v-aa / 21 locked).
> This window did: Functionality rows 1203-1402 (200 cases) review + 60 cells fixed in xlsx +
> zero-regression, report extended to `review_round_02_functionality.md`.

---

## 0. Deliverables this window

| file | purpose |
|---|---|
| `review_round_02_functionality.md` (33327 -> 38955 lines) | added 7th batch (items 1201-1400) per-case "8Q+5seg+section 18h three + verdict"; head title (`1-1400`) + batch7 markers updated |
| `data/REVISED_commands_merged_with_raw.xlsx` (working tree) | **60 cells actually modified** (all `ai_commands` col15), all Functionality |
| `scripts/fix_rev02_batch7.py` | this batch xlsx fixer (row-located, not code-located) |
| `scripts/gen_rev02_batch7.py` | this batch report generator |
| `data/REVISED_commands_merged_with_raw.xlsx.bak_rev02_batch7_20260906_223603` | pre-fix backup |

mojibake: cyrillic=0 / U+FFFD=0 (xlsx + report). git HEAD `5a60875`.

---

## 1. Review result (items 1201-1400)

**verdict (section 21 locked) distribution (this batch)**:
| verdict | count |
|---|---|
| NO/PHYSICAL | 0 |
| PARTIAL | 74 |
| YES | 96 |
| UNRESOLVED | 30 |

**Cumulative (1-1400)**: NO/PHYSICAL **266** / PARTIAL **478** / YES **536** / UNRESOLVED **120** (=1400).

This block is the tail of the deep IPMI dive + the whole Redfish API surface:
SEL aux (TBD) -> SDR bulk (TBD) -> FRU -> Sensor Device -> Wistron OEM -> DCMI (IB+OOB) ->
Redfish Service root / Account / Session / Chassis / System / PCIe / Storage / Memory / Processors /
NIC / Bios / Manager / Certificate / Telemetry / Update / Event / ForceRestart / Platform ->
Debug port -> BMC Stress -> Provision (TBD) -> BMC-RoT.

---

## 2. Defects actually fixed in xlsx this batch (60 cells = 60 ai_commands col15; verdict untouched)

| class | count | rows |
|---|---|---|
| R29 (DUT-inner bare ipmitool DCMI subcommand missing `ipmitool` keyword -> add `sudo ipmitool`) | 10 (cmd) | 1256, 1258, 1260, 1262, 1264, 1266, 1268, 1270, 1272, 1274 |
| WR+R29 (DCMI non-existent subcommand -> real one per ipmitool; IB also gets `sudo ipmitool`) | 5 (cmd) | 1258, 1264, 1268, 1276, 1278 (Set) + 1284 (Get temp) |
| WR (DCMI OOB non-existent subcommand -> real: `capabilities`->`discover`, `getoobconf`->`get_conf_param`, `setoobconf`->`set_conf_param`, `mc_id_string_privilege`->`get_mc_id_string`, `activate_limit`->`activate`, `thermal get_temp`->`get_temp_reading`) | 11 (cmd) | 1257, 1259, 1261, 1263, 1265, 1277, 1279, 1285 (OOB group) |
| R5 (Redfish/OOB curl wrongly wrapped in DUT-ssh with broken nested double-quotes -> move to agent-host) | 24 (cmd) | 1286, 1296, 1297, 1298, 1323, 1324, 1325, 1332, 1333, 1334, 1335, 1365, 1366, 1367, 1368, 1369, 1370, 1371, 1372, 1373, 1374, 1375, 1377, 1378, 1379, 1380 |
| WR/R5 (mislabeled "not directly runnable ... IPMI bytes" but procedure gives a clear Redfish curl -> replace with real agent-host curl + vendor slots; Chassis section) | 13 (cmd) | 1299, 1300, 1301, 1302, 1303, 1304, 1305, 1306, 1307, 1308, 1309, 1310, 1311 |

Rows overlap (1258/1264/1268 = R29+WR), so unique fixed rows = **60**.

**R5 detail**: the 24 Redfish GETs (Service root / Session / Storage / Bios / Cert / Telemetry /
Update / Event / ForceRestart) were packaged inside `sshpass ... ssh ... "curl ..."` with broken
nested double quotes (e.g. `curl "https://$BMC_IP"` inside a `"..."` ssh string). Redfish talks to
the BMC over HTTPS only — no reason to tunnel through DUT ssh. Moved all to agent-host one-liner
(`curl -s -k -u "$BMC_USER:$BMC_PASS"`). PARTIAL/Set variants got `${...:?operator ...}` slots for the
exact payload field.

**WR/R5 detail**: Chassis rows 1299-1311 (Chassis/Assembly/Thermal/LED/PSU/Fan/Log) were mislabeled
"not directly runnable with a single stock high-level command ... exact IPMI bytes" even though the
Procedure gives a real Redfish path + `curl -X GET`. Replaced with real agent-host curl + `${CHASSIS_ID:?...}`
etc. instance slots (vendor slot per section 18b); PATCH LED (1308) gets operator-supplied `LED_STATE`.

**DCMI detail** (all verified against real `ipmitool 1.8.19` usage output on this host):
- `dcmi capabilities` does NOT exist -> `dcmi discover`.
- `getoobconf`/`setoobconf` do NOT exist -> `get_conf_param`/`set_conf_param`.
- `mc_id_string_privilege` does NOT exist -> `get_mc_id_string`/`set_mc_id_string`.
- `activate_limit` does NOT exist -> `power activate`.
- `thermal get_temp` does NOT exist -> `get_temp_reading <entity> <instance>`.
- IB rows ran `dcmi` bare inside DUT-ssh (R29, `command not found`) -> `sudo ipmitool dcmi ...`.

**ai change**: NONE this batch (conservative, same as batch5). No `ai_can_execute` cell modified.

---

## 3. Big finding this batch: 30 rows TBD -> UNRESOLVED (report-level, NOT an xlsx edit)

SEL auxiliary (00493-00496), the bulk of SDR (00497-00509), part of Sensor Device (00516-00526),
DCMI Thermal (00570-00573), and Provision (00687-00688) have Procedure/Criteria = **TBD** in the
workbook. Per locked section 21 rule (UNRESOLVED = TBD in data, 8Q cannot be answered), these 30 rows
are **UNRESOLVED** in the report. Their existing `ai_commands` already say `-- not runnable ...TBD...`
(or, for 1397/1398, have a command but the criteria is TBD), so there is nothing to repair in xlsx;
the operator/test-library must fill the TBD bytes/end-state first, then re-review at L1.

Also noted (not this batch's defects, consistent library-wide): the OOB `sensor get 'NAME'` rows
(1223-1225,1235,1237,1238) still lack the `sdr elist` fallback (section 20v) — same as batch4/5
observation, deferred to a later batch that standardizes the whole sensor block.

---

## 4. Zero-regression verified

- build: `python3 scripts/build_testlib_json_xlsx.py data/REVISED_commands_merged_with_raw.xlsx /tmp/tests_new_b7.json`
  -> **total=3112 / 6 sheets unchanged** (2291 / 202 / 60 / 459 / 88 / 12).
- cell diff vs backup: exactly **60 cells** changed, all Functionality x col15 (ai_commands). No other
  column changed; no cell outside rows 1203-1402.
- cyrillic=0 / U+FFFD=0 (xlsx + report).

---

## 5. NOT done (red lines, wait for operator)

- `data/tests.json` untouched (git no M, still = HEAD batch1-synced); no cp prod `/srv/pa-manager-prod/`;
  no commit / no stage / no push.
- git 0 commit / 0 stage / 0 push; xlsx now M (batch1 37 + batch2 36 + batch3 3 + batch4 10 + batch5 16 +
  batch6 34 + **batch7 60 cells**), new scripts `fix_rev02_batch7.py`, `gen_rev02_batch7.py`, 1 batch7
  backup uncommitted.
- Earlier stray working-tree files (data/ADDITIONS.csv / data/REVISED_commands.csv / static/* /
  OPENHANDS_PASTE_NEXT_WINDOW.md / pre-batch7 backups) not touched by this window.

---

## 6. Next window

1. Continue Functionality rows 1403-1602 (1400->1600; table total 2291, 1400 done) -> same rules.
2. row<->item alignment stays item = row-2; next batch = xlsx rows 1403-1602 / items 1401-1600. Verify
   no row/item offset first (prior windows caught 202/402 gaps).
3. New defect types fixed in-session as before: fix xlsx -> build -> zero-regression (only the batch may
   differ) -> record in handoff.
4. `data/tests.json` sync / commit / push **only when operator says so**.
5. This batch's leftover observation: the Redfish GET body is now agent-host native; but many GET rows
   still use `$MANAGER` / `$LOGS` / `$ENTRY` / `$CHASSIS_ID` etc. instance slots that the operator must
   fill per the collection listing (vendor slot, section 18b) — expected, not a defect. The OEM raw / sensor
   write rows still await library TBD fill-in (UNRESOLVED).

---

## One-liner

Items 1201-1400 reviewed (NO 0 / PARTIAL 74 / YES 96 / UNRESOLVED 30, cumulative 1400) + 60 cells fixed
in xlsx (all ai_commands: DCMI R29/WR + Redfish R5 + Chassis WR/R5) + zero-regression (exactly 60 cells);
30 TBD rows flagged UNRESOLVED (SEL/SDR/Sensor/Thermal/Provision, report-level, library must fill TBD
first). tests.json/commit/push await operator; next window 1400-1600.
