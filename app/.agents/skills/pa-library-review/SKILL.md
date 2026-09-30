---
name: pa-library-review
description: Use when reviewing the Wistron AI test-case library (REVISED_commands_merged_with_raw.xlsx -> tests.json) case by case. Covers per-case verdicts (YES/PARTIAL/NO/UNRESOLVED), rewriting ai_commands to be unique and directly runnable (Q-LIT quotes, nested-ssh, vendor slots ${VAR:?}, fio job-file pre-write, full-output + coarse-filter, sdr fallback, agent-host vs DUT placement), zero-regression verification (build 3112/6 sheets, cell diff all col15, mojibake 0, shared-recount), 3-way tests.json sync (repo==prod==/tmp), and writing dated handoff docs. Triggers: [test library review, ai_commands, ai_can_execute, verdict, tests.json, testcase, 逐條 review, 測試庫, 判定, re-review]
---

# PA Test-Library Review

One-case-at-a-time review of the Wistron test-case library so every case has a **unique,
directly-runnable command** (or an explicit reason it cannot be automated), with **zero
regression** against the rest of the library.

## Where things live (single source of truth)

| item | path |
|---|---|
| GitHub repo | `https://github.com/wistroneq3300/pa-server-manager` (git remote `origin`; commit/push only on operator say) |
| Working xlsx (EDIT THIS) | `data/REVISED_commands_merged_with_raw.xlsx` (repo root) |
| Build: xlsx -> tests.json | `python3 scripts/build_testlib_json_xlsx.py data/REVISED_commands_merged_with_raw.xlsx /tmp/tests_new.json` |
| Prod tests.json | `/srv/pa-manager-prod/data/tests.json` |
| Repo snapshot | `data/tests.json` |
| Build inputs (sidecar) | `data/REVISED_commands.csv` + `data/ADDITIONS.csv` (only for original `build_testlib_json.py`) |
| Do NOT edit | `/root/test-library/*` (raw source excels; build does NOT read them for the xlsx path) |
| Live app check | `curl -s http://127.0.0.1:6969/api/testlibrary` (or prod port) |

6 sheets x 18 columns. **col indexes (1-based): 13=ai_can_execute, 14=ai_packages_needed,
15=ai_commands, 16=ai_logs_output, 17=risk, 18=remark.** Row 1 = header; data rows start at 2.
**Off-by-one**: report "case numbers" use row-2 while tests.json uses item = row-1. State which
numbering you mean in every handoff. See `references/sheets_layout.md`.

## The 5-step workflow (run every window)

1. **Re-align with the rule bible** - read `REVIEW_WORKFLOW_LOGIC.md` (repo root) every new window;
   it IS the operator-approved spec. Also read `references/verdict_rules.md` + `references/review_workflow.md`.
2. **Scope the batch** - enumerate exact rows/items (sheet + row + Code). Back up first:
   `cp data/REVISED_commands_merged_with_raw.xlsx data/...xlsx.bak_rev0X_pre`.
3. **Review each case** - per-case: read items/procedure/criteria, run the 8 questions
   (references/review_workflow.md), decide the verdict, edit ONLY needed cells. Write every edit as a
   python script with a guarded assert on the exact old text; never blind-regex the xlsx.
4. **Verify gate** - `python3 scripts/verify_review.py <xlsx> <backup>` (in scripts/). Gate: build
   3112/6 sheets unchanged; diff vs backup only intended cells (state per-sheet + per-col); mojibake
   (cyrillic/U+FFFD) == 0; shared-command recount == intentional-only; literal `%s` == 0.
5. **Sync + handoff** - 3-way sync `cp /tmp/tests_new.json data/tests.json /srv/pa-manager-prod/data/tests.json`,
   print md5 of all three (must be equal; write the hash into the handoff). Write a dated
   `SESSION_HANDOFF_<SCOPE>_<DATE>.md` (template below). **Commit/push ONLY when the operator says so.**

## Verdicts (locked, 2026-09-18 - do not improvise)

- **YES** - operator supplies missing inputs **once** (target disk/tool/SOP/params), then agent runs
  to completion with no human in the loop. State-change/reboot is still YES if a risk note + ask-first
  (R22) is present.
- **PARTIAL** - even with a SOP, some step needs an operator hand/presence/approval mid-run
  (LED/fan visual watch, Reboot-500 12h approval, AC needs a person, SNMP pre-config). NOTE: fio/dd
  target-disk is NOT partial - giving a disk is a one-time input -> YES.
- **NO / PHYSICAL** - requires a human physical action (disassembly, hot-plug, over/under-voltage);
  agent gives only a post-action evidence readout pack.
- **UNRESOLVED** - any of the 8 questions unanswered / 5 segments missing / data TBD.

Full locked table + 3 boundary rulings + archetypes: `references/verdict_rules.md`.

## Command-quality rules (the real defects to catch)

Executed on the **agent host**; DUT-side tools go through
`sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "<cmd>"` (R5/R16).

1. **Placement (R5/R16/e)** - commands acting on a DUT disk/tool MUST be wrapped in ssh to the DUT;
   OOB BMC (ipmitool lanplus / redfish / curl $BMC_IP) runs on the agent host. Running DUT-side
   commands on the agent host is a HIGH-priority defect.
2. **Quotes (Q-LIT)** - outer ssh `"..."` must not contain unescaped inner double quotes
   (`echo "== $d =="` inside the outer quotes is broken). Use single quotes inside, or a heredoc.
   `ssh"lscpu` (missing space) and doubled `2>&1 2>&1` / doubled `-k -k` are defects.
3. **Vendor slots (R7/b/r)** - model/version-specific params must be `${VAR:?operator ...}` prompts,
   listed in the variables table. Never invent vendor run commands; use `${VENDOR_TOOL:?}` /
   `${HPL_RUN:?}` and provide only the wrapper + output capture.
4. **fio/dd fake-completion (o)** - a test that must run a test cannot ship a bare version-check
   (`fio --version`). fio uses the **job-file pre-write method** (e): step1 ssh-write a `.fio` job
   with `[test]` target blank; step2 operator gives `--filename=${FIO_TARGET:?one EMPTY volume,
   NEVER OS/boot}`; agent runs + captures log.
5. **Full output + coarse filter (c/p)** - info-read cases grab the WHOLE raw output
   (`lscpu`, `dmidecode -t N`). Huge output (sdr/dmesg): full-log + coarse-filter both, and say what
   was filtered + how to get the full output.
6. **sensor fallback (d/v)** - `sensor get 'X'` must append the same-command fallback
   `; echo ---SDR-FALLBACK---; ipmitool ... sdr elist 2>&1 | head -100` (sensor names vary by model).
7. **Nested-ssh / double-ssh** - `sshpass` appearing >1 in one command (outer ssh then another sshpass
   inside) is usually wrong; genuine sequential/multi-ssh is rare. Verify each.
8. **No shared template remnants** - after run-2/run-3 the library is de-duplicated; a shared identical
   command across sheets must now be intentional (see shared recount in verify).
9. **`-- not runnable by agent:`** - for NO cases, replace the command with an explicit one-line reason
   (no fake ipmitool). `--` prose-prefixed commands are the OLD template style; replace with real bash
   or the reason (R7).
10. **sudo** - os_user is usually root (f: missing sudo not a defect), keep sudo where a tool needs
    /dev/mem etc.

## Verify gate (must all pass before handoff)

Run `python3 scripts/verify_review.py <xlsx> <backup_xlsx>` (self-contained).
Gate: build total 3112 / 6 sheets unchanged; diff vs backup only intended cells; mojibake == 0;
shared-command recount == intentional-only; literal `%s` == 0. Print 3-way md5 after sync. Update the
round report doc (repo root, e.g. `review_round_02_functionality.md`) with head progress + batch marker.

## Handoff template (write every window, dated)

```markdown
# Session Handoff - <SCOPE> (<DATE>)
## Scope
## What changed (rows/sheets/cells; per-col counts)
## Verdicts summary (per-sheet NO/PARTIAL/YES/UNRESOLVED totals)
## Verify results (build 3112/6; diff vs <backup> = N all col15; mojibake 0; shared recount)
## tests.json 3-way md5 = <hash> (repo == prod == /tmp)
## Opened / pending operator items
```

## Hard rules

- **CJK-safety**: never type raw CJK into code/overlay scripts. `file_editor` is unsafe on files with
  CJK/emoji - edit the xlsx and repo files with python scripts (io.open utf-8); verify mojibake == 0
  after every batch.
- **commit/push ONLY on operator instruction**; record every review position in a dated md as you go.
- Back up the xlsx before each batch; keep backups as diff baselines.
- Keep the operator's locked verdict table verbatim in handoffs; do not re-derive it.
