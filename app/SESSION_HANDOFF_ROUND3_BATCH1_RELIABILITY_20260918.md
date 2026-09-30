# Session Handoff — Round-3 Batch-1: Reliability sheet 200 items (2026-09-18)

> Read FIRST: `SESSION_HANDOFF_LAST_REVIEW_SKILL_20260918.md` + `AGENTS.md` +
> `.agents/skills/pa-library-review/` (the skill) + `REVIEW_WORKFLOW_LOGIC.md` (§21 locked) +
> per-case detail `review_round_03_reliability.md`.
> 本窗:以 skill 鎖定判定 + 指令品質規則複核 **Reliability sheet(202 條 ≈ 200)**;20 cells 已修進 xlsx;
> 零回歸;commit/push 待 operator。

## Scope

- **Round-3 Batch-1 = Reliability sheet**(sheet 內 row 2-203,row-2 編號 = **202 items ≈ 200 條**,operator
  「繼續 review 200 條後交接」)。
- 理由:Functionality(2291)已 round-2 100%;其他 5 sheets 是 round-1(舊規則)review;Reliability 是
  Functionality 之後第一張未達 round-2 品質門檻的表,202 條正好 ≈200。
- 本批只修 skill 明訂的缺陷(不 re-derive 全表判定、不動已一致的部分)。

## What changed (rows/sheets/cells; per-col counts)

- **20 cells,全部 Reliability**(9 rows):col13(verdict)×2 / col15(ai_commands)×7 / col16(ai_logs_output)×5 /
  col17(risk)×4 / col14(ai_packages_needed)×2。
- rows:2, 43, 44, 144, 145, 152, 154, 155, 190。
- 缺陷分類:R5×2(144/145,OOB ipmitool 誤包進 DUT ssh,145 併 Q-LIT)、R7×1(152,寫死 peer IP)、
  WR/誤植×2(154 col16+col14 是 NIC row copy、155 col16 是 I2C row copy)、SEC×1(154 col15 硬編
  `root:0penBmc` → `${BMC_USER}:${BMC_PASS}`)、VERDICT×2(2 PARTIAL→YES 唯讀;155 NO→PARTIAL
  SEL 灌滿需批准)、PROSE-clean×2(43/44「nonfatal/fatal」copy-artifact)、OOB/IB 錯配×1(190)。
- 每格 edit 皆以 `assert` 舊文原本擋(`scripts/fix_rev03_reliability.py`,dry-run 全過)。

## Verdicts summary (Reliability sheet,202 條,row-2)

- 分佈維持:PARTIAL 152 / NO 45 / YES 5 → 因 2 條翻正後為 **PARTIAL 153 / NO 44 / YES 5**(2→YES、155 NO→PARTIAL)。
- UNRESOLVED 為 report-level(本表無)。

## Verify results (build 3112/6; diff vs backup = 20 all Reliability; mojibake 0; shared recount)

- backup:`data/REVISED_commands_merged_with_raw.xlsx.bak_rev03_reliability_pre`(md5 5cc9bcb9…)。
- build:`python3 scripts/build_testlib_json_xlsx.py data/REVISED_commands_merged_with_raw.xlsx /tmp/tests_rev03_rel.json`
  → **3112 / 6 sheets 不變**(2291 / 202 / 60 / 459 / 88 / 12)。
- diff vs backup = **20 cells,全 Reliability**(col13×2/15×7/16×5/17×4/14×2);其他 5 sheets 0 diff;
  col18(remark)0 diff。
- mojibake cyrillic=0 / U+FFFD=0;literal `%s`=0;sensor-get-without-fallback=0;shared-command recount
  **17 rows / 7 sets**(Intentional,F-除外 不變);28 nested-ssh/Q-LIT = 既有 ledger,無新增。
- GATE:PASS(moji=0 pct=0 nofb=0)。

## tests.json 3-way md5

- fresh build `/tmp/tests_rev03_rel.json` = **621a189abf826d469786bac979091ef2**。
- **repo `data/tests.json` 與 prod `/srv/pa-manager-prod/` 未動**(仍 58332d99576dae23e207fb7261da1b1f,
  即 run-3 鎖版)→ 3-way sync + commit + push 待 operator。

## Opened / pending operator items

- [ ] 3-way sync tests.json(repo==prod==/tmp)+ commit + push(只在 operator 說後)。
- [ ] 建議 commit 清單(上窗提過):skill `.agents/`(5 檔)+ 各 review/handoff md + 本窗 fix script +
      歷來 fix_rev02_*/gen_rev02_*/dump*.py 均未 commit;等 operator「commit」/「push」。
- [ ] 5 TBD criteria + HW-00455-V002 merge-key + 3 prose placeholder rows:維持 library-owner / 當說明(不變)。
- [ ] Round-3 續跑:下一步可複核 **Performance(60)+ Stability(88)+ NMF(12)**(=160)或 **Compatibility(459)**
     前段;或維持 200-條窗口 → 建議下一窗做 **Compatibility row 2-201(200 條)**。待 operator 指哪個先。

## One-liner

Round-3 Batch-1 = Reliability 202 條複核;20 cells 已修(9 rows:2 判翻正 + R5×2 + R7×1 + WR/SEC×3 +
OOB/IB×1 + prose-clean×2),全 Reliability、零回歸(build 3112/6,GATE PASS,fresh md5 621a189a);
repo/prod tests.json 仍 58332d99 未動,commit/push 待 operator。
