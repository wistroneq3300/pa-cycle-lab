# Handoff — Round-2 official 3112 review items 1601-1800 (2026-09-18)

> Read FIRST: this file + SESSION_HANDOFF_ROUND2_BATCH8_1600_20260918.md +
> REVIEW_WORKFLOW_LOGIC.md (section 18 a-l / 19 m-u / 20 v-aa / 21 locked).
> This window did: Functionality rows 1603-1802 (200 cases) review + 44 cells fixed in xlsx +
> zero-regression, report extended to `review_round_02_functionality.md`.

---

## 0. Deliverables this window

| file | purpose |
|---|---|
| `review_round_02_functionality.md` (44530 -> 50204 lines) | added 9th batch (items 1601-1800) per-case "8Q+5seg+section 18h three + verdict"; head title (`1-1800`) + batch9 markers updated |
| `data/REVISED_commands_merged_with_raw.xlsx` (working tree) | **44 cells actually modified** (all `ai_commands` col15), all Functionality |
| `scripts/fix_rev02_batch9.py` | this batch xlsx fixer (row-located, not code-located) |
| `scripts/gen_rev02_batch9.py` | this batch report generator |
| `data/REVISED_commands_merged_with_raw.xlsx.bak_rev02_batch9_20260907_002703` | pre-fix backup |

mojibake: cyrillic=0 / U+FFFD=0 (xlsx + report). git HEAD `5a60875`.

---

## 1. Review result (items 1601-1800)

**verdict (section 21 locked) distribution (this batch)**:
| verdict | count |
|---|---|
| NO/PHYSICAL | 16 |
| PARTIAL | 78 |
| YES | 82 |
| UNRESOLVED | 24 |

**Cumulative (1-1800)**: NO/PHYSICAL **326** / PARTIAL **623** / YES **703** / UNRESOLVED **148** (=1800).

This block = BMC Operations (Factory reset / KVM / Firmware / OEM FW / SOL / Virtual media) + boot
settings + boot order + power policy + LAN + SDR/FRU/SEL + time/NTP + sensor check (M.2/E1.S/CX7/BF3/PSU)
+ BMC port/UID/SOL/UART + Account + the whole TEMP_/PWR_/FAN sensor family + CPU/DIMM/PCIe/ACS/BDF +
BRCM switch + TPM + NVMe/DOCA/DPU + LED/LinkFlap/AC/Warm-Cold reboot/Stress + Mechanical/Display/Codec/Gaming
+ I2C MB/BMC/SW/PSU boards.

---

## 2. Defects actually fixed in xlsx this batch (44 cells = 44 ai_commands col15)

| class | count | rows |
|---|---|---|
| WR (command content / sensor-name does not match Items/procedure -> rewrite to the real logic) | 22 | 1628, 1629, 1630, 1633, 1635, 1657, 1668, 1678, 1686, 1693-1704, 1762 |
| WR+L (LED-control case wrongly held a temp-sensor command -> real Redfish indicator-LED) | 1 | 1617 |
| Q-LIT (ssh-inner bare double-quote -> single-quote) | 9 | 1650, 1732, 1733, 1735, 1759, 1799-1802 |
| Q-LIT+DBL-SSH (inner quote + collapsed nested sshpass ssh) | 2 | 1648, 1736 |
| R5 (OOB ipmitool/curl wrongly wrapped in DUT-ssh -> agent-host) | 3 | 1744, 1745, 1765 |
| FAKE ("not directly runnable" placeholder that is actually runnable -> real IPMI/Redfish) | 7 | 1659, 1660, 1677, 1687, 1688, 1689, 1737 |

Unique rows fixed = **44** (all ai_commands col15). col13 ai_can_execute **not touched** this batch.
All Functionality.

**WR detail** (biggest class):
- Sensor-name mismatch (14): rows 1693-1704 + 1686 held `sensor get` with a WRONG sensor name copied
  from another block (e.g. 1693 TEMP_VR_Zone1~6 had `TEMP_GB_PCB1~4`, 1700 PSU1~4_FAN had
  `TEMP_GB_RTM1~8`, 1701-1704 UPPER/LOWER_FAN had GPU/PSU/PDB/HSC temps) -> corrected sensor arg =
  the Items name. Read-only, stays YES.
- 1617 LED light control: had `sensor get 'TEMP_M2'` -> real Redfish `IndicatorLED` Lit toggle + read-back.
- 1668 Manually FAN speed: had temp-sensor cmd -> OEM `raw 0x30 0x31 0x01 <PWM>` set + SDR read + auto-restore.
- 1678 BIOS version(IB/OOB): had `PWR_PDB_PSU` sensor -> real OEM `raw 0x30 0x25` (BIOS version) IB+OOB.
- 1657 Set BMC time: `sel time set` without the value -> `${BMC_TIME:?}` + read-back.
- 1628/1629/1630 (Power Policy always-off / always-on / last-state): all copied "Last-State" raw bytes
  -> rewrite to the policy they claim via OOB `chassis policy always-off/always-on/previous` + verify;
  AC cycle + swap-CPU steps remain operator-physical (note added).
- 1633/1635 (Boot Order to BIOS / BIOS for all future-boot): used `Usb` override target -> real OOB
  `chassis bootdev setup [options=efiboot[,persistent]]` read-back; entering BIOS/pre-OS is operator-visual.
- 1762 Link Flap: ran on the DUT host with `$DUT_USER@$DUT_IP` + local ping -> uses DPU OOB ssh
  (`$DPU_USER@$DPU_IP`) + `${MGT_NIC:?}` / `${PEER_IP:?}` slots.

**Q-LIT+DBL-SSH detail**: 1648 (PROCHOT CPU) and 1736 (switch FW check) each nested a second
`sshpass ... ssh` inside the first ssh string + inner double-quoted greps -> collapsed to one hop and
single-quoted the inner `grep -i 'CPU MHz'` / `grep -iE 'Capabilities|ROM'`.

**R5 detail**: 1744/1745 (FAN auto/manual) and 1765 (Cold Reboot) ran OOB `ipmitool ...` inside the
DUT-ssh string with broken inner quotes -> moved the OOB reads/sets to agent-host lines.

**FAKE detail**:
- 1659/1660 (Get/Reserve SDR Repository Info IB+OOB) and 1677 (Set BIOS Config) said "not directly
  runnable / needs raw" -> actually runnable: `sdr info` / `sdr` reservation / `raw 0x30 0x01 <rev bytes>`.
- 1687/1688/1689 (ForceOff / GracefulShutdown / On) said "needs raw IPMI bytes" but the procedure is a
  Redfish `ComputerSystem.Reset` -> real curl `{"ResetType":...}` + `power status` read-back.
- 1737 (FW Flash) had a placeholder `echo "run switch FW flash utility ..."` -> `${SW_FLASH_TOOL:?}` /
  `${SW_FW_IMAGE:?}` vendor-tool wrapper (section 19r) + post-flash lspci read-back.

**verdict (col13) unchanged this batch**: all 44 are ai_commands content fixes; the original
ai_can_execute values (mostly YES/PARTIAL) remain correct, and the UNRESOLVED rows are TBD in the
workbook, not command errors.

---

## 3. Big finding this batch: 24 rows UNRESOLVED (report-level, NOT an xlsx edit)

Rows whose Criteria/Procedure are TBD in the workbook, so per locked section 21 they are UNRESOLVED
(8 questions cannot be answered): **1737** (criteria TBD, noted above; its command was still fixed) and
**1776** (nv logo), **1777/1778/1779** (Display mode off/scalable/enabled — proc+crit TBD),
**1780-1791** (Encode/Decode H.264/H.265/HEVC/AV1/MPEG-1/MPEG-2/VC-1/VP8/VP9),
**1792** (Elden Ring), **1793-1798** (3DMark/Furmark display). The xlsx `ai_commands` already describe
the codec/ffmpeg/nvidia-smi reads or mark the task not-runnable-by-agent; the test-library must fill
the TBD expected bitstream/quality/display criteria, then re-review at L1.

Also deferred (consistent-library note, NOT a batch9 defect): the OOB `sensor get 'NAME'` rows
(1692-1727) still use single `sensor get` without the §20v / §18d `sdr elist` fallback when the name
is not found — the exact same whole-sensor-block pattern noted in batch4/5/7/8, to be standardized
in a later batch (not a per-row defect here).

---

## 4. Zero-regression verified

- build: `python3 scripts/build_testlib_json_xlsx.py data/REVISED_commands_merged_with_raw.xlsx /tmp/tests_new_b9.json`
  -> **total=3112 / 6 sheets unchanged** (2291 / 202 / 60 / 459 / 88 / 12).
- cell diff vs backup (`...bak_rev02_batch9_20260907_002703`): exactly **44 cells** changed, all
  Functionality col15 (ai_commands), rows 1617-1802 (all within batch rows 1603-1802). No col13 / no
  other column changed.
- cyrillic=0 / U+FFFD=0 (xlsx + report).

---

## 5. NOT done (red lines, wait for operator)

- `data/tests.json` untouched (git no M, still = HEAD batch1-synced); no cp prod `/srv/pa-manager-prod/`;
  no commit / no stage / no push.
- git 0 commit / 0 stage / 0 push; xlsx now M (batch1 37 + ... + batch8 28 + **batch9 44 cells**),
  new scripts `fix_rev02_batch9.py`, `gen_rev02_batch9.py`, 1 batch9 backup uncommitted.
- Earlier stray working-tree files (data/ADDITIONS.csv / data/REVISED_commands.csv / static/* /
  OPENHANDS_PASTE_NEXT_WINDOW.md / pre-batch9 backups) not touched by this window.

---

## 6. Next window

1. Continue Functionality rows 1803-2002 (1800->2000; table total 2291, 1800 done) -> same rules.
2. row<->item alignment stays item = row-2; next batch = xlsx rows 1803-2002 / items 1801-2000. Verify
   no row/item offset first (prior windows caught 202/402 gaps).
3. New defect types fixed in-session as before: fix xlsx -> build -> zero-regression (only the batch may
   differ) -> record in handoff.
4. `data/tests.json` sync / commit / push **only when operator says so**.
5. This batch's leftover observation: the `sensor get 'NAME'` + the codec/gaming/display TBD rows need
   the library to standardize the §20v fallback (sensor) and fill the TBD expected bitstream/quality
   (display/codec) before L1 re-review. The DPU rows (1759/1762/1760) use `${DPU_USER/DPU_IP/...}`
   instance slots (section 18b) the operator fills from the collection listing — expected, not a defect.

---

## One-liner

Items 1601-1800 reviewed (NO 16 / PARTIAL 78 / YES 82 / UNRESOLVED 24, cumulative 1800) + 44 cells fixed
in xlsx (all ai_commands: 22 WR + 1 WR+L + 9 Q-LIT + 2 Q-LIT+DBL-SSH + 3 R5 + 7 FAKE) + zero-regression
(exactly 44 cells); 24 TBD rows flagged UNRESOLVED (sensor/display/codec/gaming library must fill first).
tests.json/commit/push await operator; next window 1800-2000.
