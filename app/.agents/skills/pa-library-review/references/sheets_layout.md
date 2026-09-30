# Sheets layout + numbering + paths

## The 6 sheets (counts as of closing, build 3112 total)

| Sheet | rows (incl header) | items |
|---|---|---|
| Functionality | 2292 | 2291 |
| Reliability | 203 | 202 |
| Performance | 61 | 60 |
| Compatibility | 460 | 459 |
| Stability | 89 | 88 |
| (No Main Function) | 13 | 12 |

## 18 columns (1-based); the review fields

1 Code, 2 Sub Function, 3 Test Set, 4 Items, 5 Procedure, 6 Criteria, 7 Bundle, 8 Branch,
9 Script, 10 Attended Time, 11 Machine Time, 12 Latest Updated,
13 ai_can_execute, 14 ai_packages_needed, 15 ai_commands, 16 ai_logs_output, 17 risk, 18 remark.

Row 1 = header; data rows start at 2.

## Numbering / off-by-one (state it in every handoff)

- Report "case numbers" use the row-2 count (e.g. "item 2290" = sheet row 2291).
- tests.json emits items with item = row-1 (e.g. row 2291 -> item 2290 is row-2 number... verify
  per build). Always specify which numbering a number means.

## Build + paths

- EDIT ONLY: `data/REVISED_commands_merged_with_raw.xlsx` (repo).
- Build: `python3 scripts/build_testlib_json_xlsx.py data/REVISED_commands_merged_with_raw.xlsx /tmp/tests_new.json`.
- Original sidecar build (do not use for xlsx edits): `scripts/build_testlib_json.py` reads
  `data/REVISED_commands.csv` + `data/ADDITIONS.csv` (from repo data/ or /root/test-library fallback).
- Prod tests.json: /srv/pa-manager-prod/data/tests.json; repo snapshot: data/tests.json.
- Runtime creds live on disk in /srv/pa-manager-prod/data/data.json (bmc_pass masked over the API).
- Do NOT edit /root/test-library/* (raw source excels).
