# Session Handoff — Round-3 Batch-2: Performance + Stability + NMF (2026-09-18)

> Read FIRST: `SESSION_HANDOFF_LAST_REVIEW_SKILL_20260918.md` + `AGENTS.md` +
> `.agents/skills/pa-library-review/` + `REVIEW_WORKFLOW_LOGIC.md` (§21 locked) +
> per-case detail `review_round_03_reliability.md`(batch-1)。
> 本窗:複核 **Performance(60)+ Stability(88)+ NMF(12)= 160 條**,48 cells 已修進 xlsx;零回歸。
> 上一窗(Round-3 Batch-1)已收掉 **Reliability(202)**。剩下僅 **Compatibility(459)**。

## Scope

- Round-3 續跑:Performance + Stability + (No Main Function) 全複核(160 條)。Compatibility(459)另開後續窗口。
- 複核標準:skill 鎖定判定(§21)+ 指令品質規則(R5/R7/Q-LIT/vendor slot/col14-17 同步)。

## What changed (rows/sheets/cells; per-col counts)

- **48 cells** = Performance 46 + Stability 2。
  - col15(ai_commands)×10 = r6-9 fio 重寫(Q-LIT + 非法 job 格式)+ r14/16/18/19 `${SERVER_IP:?}` + Stability r75/76 `${ETH_PORTS:?}`/`${IB_PORTS:?}`。
  - col13(verdict)×35 = **Performance 35 條 MLPerf PARTIAL→YES**(鎖定-21 MLPerf ruling + round-2 Functionality r2273=YES 一致)。
  - col14/16/17×3 = Performance r61(Multi-Node NCCL)col14/16/17 是 MLPerf copy-error → 修成 NCCL(對齊 r48)。
- 每格 edit 皆 `assert` 舊文原本擋(`scripts/fix_rev03_perfnmfstab.py`,dry-run 全過、CJK 0/cyrillic 0)。

## 判定維持(review 後逐類)

- **Performance**:
  - SPECcpu2017(r2)= PARTIAL(授權/operator 提供,維持;round-2 Functionality 無對照故照綁 verdict_rules 授權=PARTIAL)。
  - HPL(r3)/STREAM(r4)/MLC(r5)= PARTIAL(維持;round-2 Functionality 對照:STREAM=PARTIAL、HPL=PARTIAL)。
  - FIO SSD/M.2(r6-13)= PARTIAL(維持;r6-9 僅修指令品質,fio target-disk 給一次 → 部分 round-2 為 YES,但此處
    43200s 長時程 + 需 approval → 維持 PARTIAL,與 7/10 Functionality fio 多數一致)。
  - Networking(r14-20)= PARTIAL(peer host 需求;僅修 undefined `$SERVER_IP`)。
  - **MLPerf 35 條(r21-36,40-46,49-60)= YES**(operator 一次提供 container/weights,agent 跑完 LoadGen→回報,
    無 mid-run 人手;風險 note + ask-first 已有 → 鎖定-21 YES;與 round-2 Functionality 唯一 MLPerf r2273=YES 一致)。
    - ⚠ operator 若仍想保留 PARTIAL(因「confirm duration/approval」),可整批退回——已列在 report。
  - Minigo(r37)/clpeak(r38)/xGMI(r39)/ib_write_bw(r47)/NCCL×2(r48,r61)= PARTIAL(長時程/peer/multi-node)。
- **Stability**:Margin 66 條(r2-65? 實際 r2-65 為 40C/0C ±5% chamber)= NO 全對(環境/實體,agent 不能設 chamber)。
  Long-term r66-89(stress/AC/Reboot/BurnIn/WAT)= PARTIAL(需 person/PDU/approval;鎖定:AC/Reboot/BurnIn=PARTIAL)全對。
  僅修 r75/76 的 undefined `${ETH_PORTS}`/`${IB_PORTS}`。
- **NMF(12)**:GDS(r2)/Flash×6(r5-11)= PARTIAL(經 web UI / operator 手動 step,合理);LTSSM(r3)/PDB_BD(r12)/
  E1S_BD1(r13)= NO(需 spec procedure,合理);Type-46 dmidecode(r4)= YES(純 read,對)。
  **0 edits**(NMF 已一致)。

## Verify results (build 3112/6; diff vs backup = 48 = 預期集合;mojibake 0)

- backup:`data/REVISED_commands_merged_with_raw.xlsx.bak_rev03_perfstnmf_pre`(md5 81b37bb3…)。
- build:「/tmp/tests_rev03_pns.json」→ **3112 / 6 sheets 不變**(2291/202/60/459/88/12)。
- diff = **48 cells** = Performance 46 + Stability 2:col15×10(col13×35 OK)、col14/16/17×3;其他 sheets 0 diff。
- mojibake 0 / literal `%s` 0 / sensor-fallback 0;**shared recount 17 rows/7 sets**(F-除外 不變);
  28 nested-ssh/Q-LIT = 既有 ledger(本批無新增,r6-9 fio 已解 Q-LIT)。

## tests.json 3-way md5

- fresh build `/tmp/tests_rev03_pns.json` = **f5cb9cfa29ac6489ba4025446d98268d**。
- **repo `data/tests.json` 與 prod 未動**(仍 58332d99576dae23e207fb7261da1b1f)→ 3-way sync + commit + push 待 operator。

## 全庫 review 進度(round-3 品質)

| 表 | 條數 | round-3 狀態 |
|---|---|---|
| Functionality | 2291 | ✅(round-2/closing/run2/run3) |
| Reliability | 202 | ✅ Batch-1 |
| Performance | 60 | ✅ 本窗 |
| Stability | 88 | ✅ 本窗 |
| (No Main Function) | 12 | ✅ 本窗 |
| **Compatibility** | **459** | ⏳ **唯一剩餘 — 下批** |

## Opened / pending operator items

- [ ] 3-way sync tests.json(repo==prod==/tmp)+ commit + push(只在 operator 說後)。
- [ ] **MLPerf 35 條 PARTIAL→YES** 整批判定:locked-21 明確 YES + round-2 r2273 一致;operator 若覺不妥可退回
      (一條 sed 即可回去)——已列入 report。
- [ ] Round-3 續跑:**下一窗 = Compatibility(459)**,建議拆 200+200+59。
- [ ] 既有待辦不變:5 TBD criteria、HW-00455 merge-key、3 placeholder rows(operator 已裁示保留)。

## One-liner

Round-3 Batch-2 = Performance(60)+Stability(88)+NMF(12)複核;48 cells 已修(fio Q-LIT/語法×4、$SERVER_IP×4、
NCCL copy×3、**MLPerf×35→YES**、ETH/IB_PORTS×2),全這兩表、零回歸(build 3112/6,GATE PASS,fresh md5 f5cb9cfa);
repo/prod tests.json 未動;剩下就是 Compatibility(459)。
