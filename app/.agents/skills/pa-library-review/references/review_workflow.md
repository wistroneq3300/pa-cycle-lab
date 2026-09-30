# Review workflow - condensed rule bible (see repo REVIEW_WORKFLOW_LOGIC.md for full)

## Per-case review SOP (every case, no batching)

1. Locate: read `items` (AUTHORITATIVE title), `procedure` (old manual doc, background only),
   `script` (old gitlab, reference), current `ai_commands`.
2. Classify the blocking archetype (4 types in verdict_rules.md).
3. Decide YES / PARTIAL / NO / UNRESOLVED (locked table).
4. Rewrite the fields: ai_commands (real runnable bash, or `-- not runnable by agent: <reason>`),
   ai_packages_needed, ai_logs_output, risk, ai_can_execute.
5. Write to the REPO xlsx only (`data/REVISED_commands_merged_with_raw.xlsx`), never
   `/root/test-library/*`.
6. Build -> zero-regression verify -> 3-way sync -> handoff. Commit/push only on instruction.

## The 8 questions (Q1..Q8) - a case is DONE only when all 8 are answerable

Q1 What raw value does the operator judge against? (purpose)
Q2 Evidence source: DUT OS / BMC OOB / Redfish / KVM / physical? (location)
Q3 Which machine + how do DUT_IP / BMC_IP resolve?
Q4 Timing: single-shot / loop / operator does X first / before-after two beats?
Q5 What exact raw format / log path after run?
Q6 What does the operator provide - concrete variable list + example values?
Q7 How do I report the raw result? (fixed format)
Q8 If state-changing/destructive: where do I STOP and ask? rollback path?

Any of Q1-Q8 unanswerable -> KEEP / UNRESOLVED (R39), and state which question is missing.

## The 5 segments (the "verdict report" shape)

1. purpose (qa) 2. variables table (in) 3. command to run (do) 4. expected output (out)
5. judge gate READ / STATE / WRITE / DESTROY / PHYSICAL + rollback.

## Review-done three-piece set (for every case that actually runs, s)

qa header comment + expected-output segment + judge-gate segment. Missing any = NOT done (KEEP).

## Key rules to enforce while reviewing (R-summary)

- R5/R16/e: command runs on the AGENT host; DUT-side tools wrap in ssh to the DUT; OOB BMC
  (ipmitool lanplus / redfish / curl $BMC_IP) on agent host. DUT-side command on agent host =
  HIGH-priority defect.
- R7/b/r: model/version-specific params = `${VAR:?operator ...}`; never invent vendor run cmds.
- R12: operator acts first physically, agent reads evidence -> PARTIAL (read-half runnable).
- R13: apt-unavailable tools -> `${TOOL_PATH:?}` + packages "operator-provided" -> PARTIAL.
  Whitelist check every new tool (apt search on Ubuntu 24.04). DCGM/NVIDIA driver self-installable.
- R14: same SMBIOS type split into N rows -> repeated command allowed (intentional).
- R15: RAS - read state = YES; needs trigger/proprietary run = PARTIAL; needs physical = NO.
- R17/R28/R11: Redfish multi-resource -> GET .../Members then iterate; no hard-coded single ID.
- c/p: info reads grab WHOLE raw output; huge output = full-log + coarse-filter, state what filtered.
- d/v: `sensor get 'X'` always append fallback `; echo ---SDR-FALLBACK---; ipmitool ... sdr elist
  2>&1 | head -100`.
- e/o: fio/dd that must RUN A TEST needs the real test bash (job-file pre-write method), never a
  bare version-check. Step1 ssh-write a `.fio` job `[test]` target blank; step2
  `fio /root/<code>.fio --filename=${FIO_TARGET:?one EMPTY volume, NEVER OS/boot}`; step3 capture log.
- f: sudo missing is NOT a defect (SUT users are root); keep where a tool needs /dev/mem etc.
- g: keep `#` (purpose) header comments.
- i: read bmc_user/bmc_pass from DISK (`/srv/pa-manager-prod/data/data.json`), not via the API
  (pass is masked to **** over API). Never write real passwords into md/reports.
- a/j: logic-only review, no live-run as evidence; a single-machine run is NOT evidence for the
  whole (cross-model) library; live runs are L2, only on operator-named machines.
- Q-LIT: outer ssh `"..."` must not contain unescaped inner double quotes (use single quotes inside
  or a heredoc). `ssh"cmd` missing space, doubled `2>&1 2>&1`, doubled `-k -k` are defects.
- Nested-ssh: `sshpass` >1 in a command is usually wrong; verify.

## Four defect classes to hunt every pass

1. Wrong placement - DUT-side action not wrapped in ssh (runs on agent host / wrong disk). (e)
2. Filtered-to-few-lines when the spec needs the whole output. (c/p)
3. `sensor get` with no sdr fallback. (d/v)
4. Vendor slot not marked (hard-coded model-specific values). (b/r)

Guard: write every xlsx edit as a python script with `assert` on the exact old text; never
blind-regex the workbook.
