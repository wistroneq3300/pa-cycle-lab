# SESSION HANDOFF -- T4 re-review (STATE after batch-1 completion: 2125/3001, remaining 876)

> Paste this file's content into a fresh OpenHands chat to continue.
> Read source-of-truth docs FIRST (in order):
>   1. /root/test-library/SESSION_HANDOFF_T4_REVIEW_START.md            (T4 framework + 5 locked samples + USER RULES = gold standard)
>   2. /root/test-library/SESSION_HANDOFF_T4_STATE_AFTER_System_Webclusters_Ops_Platform.md (prior batch state)
>   3. /root/test-library/SESSION_HANDOFF_ASSIGN_TASK_20260903.md       (Option C step 2 spec, strict per-case rules)
>   4. /root/test-library/AI_TESTCASE_PROJECT_CONTEXT.md                (project plan/context)
>   5. /root/sheng/manager/pa_manager/AGENTS.md                          (incl. Option C Step 2 section)
> The FULL grind workflow + USER RULES live in SESSION_HANDOFF_T4_REVIEW_START.md.

Repo: `/root/sheng/manager/pa_manager` (service pa-manager; branch main, HEAD committed+pushed)
Service reads ONLY `/srv/pa-manager-prod/data/tests.json` (mtime-cached, no restart needed).
Build inputs (do NOT modify originals):
  RAW=   /root/test-library/TestCaseLibrary_Wistron.xlsx
  REVIEW=/root/test-library/AI_Simplified_Review_20260828/TestCaseLibrary_Wistron_Simplified_AI_Review_20260828.xlsx
T4 sidecar overlay: /root/test-library/REVISED_commands.csv  (keyed by 'code')

---

## STATE AT END OF THIS WINDOW (script-verified)

CSV:   /root/test-library/REVISED_commands.csv
Rows:  2125 data rows, all unique codes.  (backups .bak2..bak11 exist)
Workbook: 3112 rows total (6 sheets: 功能性 2291 / 可靠性 202 / 效能 60 / 相容性 459 / 穩定性 88 / 無主功能 12).

DONE:   2125 unique codes in the CSV.
REMAINING: 876 instances across 326 test_sets (see /tmp/t4/remaining_sets.txt, regenerated 9/4 00:46).

Whole-CSV classification:  YES 892 / PARTIAL 747 / NO 486.
tests.json overlay state:  CSV-covered 2236, remaining-default 876  (= 3112 total).
  raw-CJK among CSV-covered codes: 0 | cyrillic: 0.
  raw-CJK among remaining-default codes: 875 (REVIEW placeholder, mid-grind, expected to drop).

Summary of domains already ground (from prior state files + this close-out):
  Display, L10 System - LED, BMC Web, Memory, System/Redfish, Mechanical-System, Webclusters,
  FRU/Check-FRU, Account, Main Page, BMC Logs, Version Check, ME Check, Operations (KVM/SOL/media GUI),
  Platform/Save-and-Exit, plus the earlier Storage/PCIe/Sensor/Flash/Inventory/Flyboy/I2C/NVTOPs.
NOTE: the '1811' figure in OPENHANDS_PASTE_NEXT_WINDOW.md is a stale mid-session checkpoint;
  the verified live state is 2125 done / 876 remaining as recorded here.

## anti-template (NEW-STRICT) status

Whole-CSV byte-identical command groups: 119.  All are PRE-EXISTING / legit cross-sheet duplicates
  (same device/sensor/type in two sheets, or prior-window BMC-Web pairs, NVTOP/DCGM TBD groups).
  This window introduced ZERO new groups ("NEW byte-identical groups: 0") and zero duplicate among
  the 315 newly-added codes (all byte-unique).
LESSON (kept): even visually-different items can collide when they reduce to the same ipmitool/curl/
  Redfish call. ALWAYS run the byte-identical command check (group by ai_commands) over your batches
  and confirm 0 groups among your own codes before moving on.

## CURRENT GENERATORS in /tmp/t4/  (all runnable; reuse as reference)

  genlib.py  -> load_rows(), done_codes(), load_rev_map(), append(out) [never overwrites],
                SSH(cmd), SH(cmd) helpers.
  per-domain generators (gen_display/gen_l10led/gen_bmcweb/gen_memory/gen_system/gen_webclusters/
  gen_operations/gen_platform_saveexit + earlier Storage/PCIe/Sensor/Flash/Inventory/Flyboy/I2C/
  NVGPU/AMD). apply_csv.py / restore_good.py / dump_set.py helpers. remaining_sets.txt (fresh).
Run with: /tmp/t4venv/bin/python <gen>.py  (has openpyxl; recreate via python3 -m venv /tmp/t4venv
  && /tmp/t4venv/bin/pip install openpyxl if wiped). genlib.append() never overwrites -> re-runs safe.
The 5 LOCKED codes are already in the CSV and must never change:
  Wistron-BIOS-00149-V006, Wistron-BMC-00293-V002, Wistron-NV GPU-00316-V003,
  Wistron-HW-00001-V006, Wistron-Performance CPU-00001-V003.

## GRIND WORKFLOW (how to continue - READ CAREFULLY)

Write set-scoped GENERATORS in /tmp/t4 that read the REVIEW workbook (SRC in genlib), emit real
per-case commands, and append via genlib.append(). CRITICAL RULES:
  - STRICTLY scope each generator to its OWN test_sets (`def R(*ts)` checking `code not in done`
    + `test_set in ts`). Missing guard pollutes other domains.
  - Honest classification: read-only read = YES. Write/destructive = PARTIAL + RISK:.
    Fault-injection/physical/environmental/interactive = NO (or PARTIAL) with concrete reason.
    TBD proc+crit = NO (do NOT fabricate).
  - ai_logs_output must give RAW/full output for diffs, NOT a short label.
  - Commands wrapped: `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "<CMD>"`
  - BMC/Redfish: RF='curl -s -k -u "$BMC_USER:$BMC_PASS" ...'; IPMI='ipmitool -I lanplus -H "$BMC_IP" ...'
  - Multi-step/install/license/flash tasks are NOT one sshpass line; state prerequisites and
    "discuss exact steps after packages are in place".
  - NO (physical/visual) must give a FULL concrete reason why agent can't.
  - RISK lines prefixed RISK:.
  - ANTI-TEMPLATE (NEW-STRICT): same Redfish/ipmi path or same "not runnable" boilerplate must carry
    a per-case unique component/filter/code so NO two new ai_commands are byte-identical. Run the
    byte-identical group check over your touched codes before moving on.
  - After each batch: verify only owned codes changed, locked intact, 0 byte-identical among your
    new rows, 0 cyrillic (0xD0-0xD2), 0 raw CJK (0x4E00-0x9FFF) in the codes YOU touched.

## NEXT BIG BUCKETS (by remaining count; full list in /tmp/t4/remaining_sets.txt)

    33 MLPerf (long benchmark -> PARTIAL)     28 RAS
    12 AMD CPU RAS - PMIC Error               12 Storage-SSD
    11 Mechanical -AVL                        11 NV WAT tool
    10 UFM                                     9 TPM
     8 LDAP / Application Commands / System Stress / NV CPU RAS -PCIE error injection / Processor - Info
    ...plus many smaller sets (total 326 sets / 876 instances)
Recommended next generator targets (self-contained, high count): RAS (28), MLPerf (33), Storage-SSD,
  Processor - Information, TPM, LDAP, Mechanical -AVL/-Cable, Flash BIOS, BMC LED Test, NIC,
  System Stress / GPU Stress - Power-Cycle / Power Restore Policy. Dedicate a window to MLPerf/RAS.

## BUILD / VERIFY / SHIP (end-of-grind)

Build:  /tmp/tx/venv/bin/python /root/sheng/manager/pa_manager/scripts/build_testlib_json.py
  (reads RAW+REVIEW+REVISED_commands.csv+ADDITIONS.csv, overlays ai_can_execute/commands/packages/
  logs/risk by code, writes /srv/pa-manager-prod/data/tests.json; mtime-cached, no restart needed).
  Last build: OK, tests.json total 3112 (functionality 2291 / reliability 202 / performance 60 /
  compatibility 459 / stability 88 / no-main 12). Remaining REVIEW-default codes still CJK mid-grind -
  expected; STRICT_NO_TEMPLATE warns on CJK boilerplate + legit cross-sheet dups (accept mid-grind).
Verify: 0 raw-CJK (or only the user's own CJK from 123.txt) + 0 cyrillic in ADDED regions;
  anti-template ~0 new byte-identical commands among your own codes; locked 5 intact.
Commit+push in repo /root/sheng/manager/pa_manager only when the user asks to commit.

## CJK SAFETY (HARD RULE, always)
Never type raw CJK into code. Use \uXXXX escapes or reuse user's CJK bytes from
/root/sheng/manager/pa_manager/123.txt. Verify added regions 0 raw-CJK and 0 cyrillic
(0xD0-0xD2 bytes). User explicitly requires this rule ("CJK 安全規則").
