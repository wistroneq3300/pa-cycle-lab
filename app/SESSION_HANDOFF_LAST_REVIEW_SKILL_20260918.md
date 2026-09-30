# Handoff - READ FIRST for the next window (2026-09-18)

> Give this to the next conversation window as its first read. It consolidates:
> (a) the LAST real review that finished (Round-2 Functionality FINAL, items 2201-2290),
> (b) the brand-new `pa-library-review` skill built this window,
> (c) how to open a new window so the skill loads and the review can continue.
> Read AFTER this: `SESSION_HANDOFF_ROUND2_BATCH12_2290_20260918.md`
> (per-case detail) + `AGENTS.md` + `REVIEW_WORKFLOW_LOGIC.md` (§18 a-l / §19 m-u / §20 v-aa / §21 locked).

---

## 0. What THIS window did (read-only + skill build; no commits)

| item | status |
|---|---|
| Built skill `.agents/skills/pa-library-review/` (SKILL.md + 3 references + scripts/verify_review.py) | DONE, live-verified |
| Demoed the skill on 4 real cases (HW-00001 NO / HW-00083 YES / HW-00261 YES+DBLSSH flag / BMC-00159 YES+sdr fallback) | DONE (read-only) |
| Ran verify_review.py vs run-3 backup: diff 0, shared 17/7, mojibake 0, `%s` 0, sensor-fallback 0 | DONE |
| Marker appended to `OPENHANDS_PASTE_NEXT_WINDOW.md` top | DONE |
| xlsx / tests.json / git changes from this window | NONE |

**Nothing was committed or pushed this window** (repo rule: operator must say commit / push first).

---

## 1. Last real review (carry forward - it is DONE, do not redo)

- **Round-2 Functionality FINAL window**: items 2201-2290 (Functionality rows 2203-2292).
- Verdict (this batch): NO/PHYSICAL 24 / PARTIAL 40 / YES 21 / UNRESOLVED 5.
- **Cumulative (items 1-2290)**: NO/PHYSICAL 409 / PARTIAL 811 / YES 897 / UNRESOLVED 173 = 2290
  (row-2 convention). Under item=row-1 the Functionality sheet is 2291 items.
- **Functionality sheet = 100% reviewed** (rows 2-2292 / items 1-2290; the last 90 rows).
- xlsx cells fixed in that window: **21 cells** (13 col-15 ai_commands + 2 col-13 ai_can_execute
  rows 2241/2272 + 6 col-14 ai_packages_needed rows 2203/2209/2273/2287/2290/2291).
- Full per-case detail + backup name: `SESSION_HANDOFF_ROUND2_BATCH12_2290_20260918.md`;
  backup `data/REVISED_commands_merged_with_raw.xlsx.bak_rev02_batch12_20260907`.
- Closing pass (earlier) also DONE: §20v sdr-elist fallback on all 196 sensor-get rows;
  `<...>` -> `${VAR:?...}` on 34 Compatibility rows; numbering LOCKED item=row-1 (2291).

## 2. Build / tests.json state

- Build = **3112 tests / 6 sheets**: F 2291 / R 202 / P 60 / C 459 / S 88 / NMF 12.
- tests.json 3-way md5 (repo == prod == /tmp) = **58332d99576dae23e207fb7261da1b1f** (run-3 sync).
- Prod path: `/srv/pa-manager-prod/data/tests.json`; repo snapshot `data/tests.json`.
- Build (xlsx path): `python3 scripts/build_testlib_json_xlsx.py data/REVISED_commands_merged_with_raw.xlsx /tmp/tests_new.json`
- Off-by-one to always state: report uses row-2 numbering, tests.json uses item = row-1.

## 3. Git state

- HEAD on `main` = `8641a4f` (run-3 desc). History: `9e73c8d` (closing), `32fd416` (run2).
- Operator WIP left untouched in working tree: `data/ADDITIONS.csv`, `data/REVISED_commands.csv`,
  `static/*`, handoff/review docs, `123.txt`. NOT ours to commit.
- **NEW uncommitted**: `.agents/skills/pa-library-review/` (5 files). Needs operator go-ahead to commit/push.

## 4. pa-library-review skill - how to use in the next window

- **Location**: `.agents/skills/pa-library-review/` (repo level; this Agent Canvas env scans it, so it
  already appears in the Available Skills panel).
- **Files**: `SKILL.md` (5-step workflow + locked verdicts + 10 command-quality rules) /
  `references/verdict_rules.md`, `references/review_workflow.md`, `references/sheets_layout.md` /
  `scripts/verify_review.py` (self-contained regression gate).
- **First sentence for a new window** (loads everything one shot):
  > read AGENTS.md + REVIEW_WORKFLOW_LOGIC.md + .agents/skills/pa-library-review/ (the skill),
  > tell me what skills I have, then continue the review.
- **Gate command**: `python3 .agents/skills/pa-library-review/scripts/verify_review.py <xlsx> <backup>`
- **Locked verdicts (2026-09-18, do not re-derive)**: YES / PARTIAL / NO(PHYSICAL) / UNRESOLVED.
  Definitions + 3 boundary rulings in `references/verdict_rules.md`.
- Latest verify gate output (this window, vs run-3 pre backup): DIFF 0 cells; shared 17/7 (intentional);
  mojibake 0; `%s` 0; sensor-get-without-fallback 0; 28 nested-ssh (DBLSSH/Q-LIT) candidates = known
  ledger, already reviewed legit; 3 `<placeholder>` cells (row 1328 `id`, 1631 `Disk`, 1634 `PXE`) = kept doc per operator.

## 5. Operator pending items (ask/flag, do not silently do)

- [ ] Commit/push the new skill (+ any operator-approved xlsx fixes) - ONLY on operator "push" / "commit".
- [ ] 5 TBD criteria (library-owner dependency, not fabricatable) - closing pass (b).
- [ ] HW-00455-V002 merge-key misalignment - closing pass (b).
- [ ] prose `<id>/<Disk>/<PXE>` 3 placeholder rows: operator decision (currently docs).
- [ ] If option-C fresh review resumes at all (nothing to resume - Functionality 100% done).

## 6. Reference: skills I can call in this agent

Official (invokable this session, 11): add-skill, agent-canvas-environment, agent-memory,
agent-sdk-builder, code-review, docker, github, openhands-api, openhands-automation, openhands-sdk,
skill-creator. Full public cache (60): /root/.openhands/cache/skills/public-skills/skills/.
Repo skill (1): pa-library-review.
List anytime: `ls /root/.openhands/cache/skills/public-skills/skills/ | grep -vE '(md|js|ts|json)$'`
