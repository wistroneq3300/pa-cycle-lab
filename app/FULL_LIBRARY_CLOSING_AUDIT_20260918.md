# Full-Library Closing Audit — 2026-09-18 (after Functionality batch-12 FINAL)

Read-only audit over the whole 6-sheet library (3112 rows) AFTER the round-2 Functionality
batch-12 final window + the batch12b co-sync amendment. Purpose: the planned "full-library final
verification" (W17-style) now that every sheet is reviewed.

Scope: xlsx `data/REVISED_commands_merged_with_raw.xlsx`. tests.json / git / prod NOT touched.

---

## 1. Build / counts

- `build_testlib_json_xlsx.py` -> **3112 / 6 sheets** unchanged:
  Functionality 2291 / Reliability 202 / Performance 60 / Compatibility 459 / Stability 88 / (No Main Function) 12.
- `ai_can_execute` distribution over 3112 rows: **PARTIAL 1354 / YES 1067 / NO 691**.
  (UNRESOLVED is report-level only, not a col13 value.)

## 2. Zero-regression (batch-12 tail verified independently)

- Diff vs `...bak_rev02_batch12_20260907` = **34 cells**, all Functionality:
  13 col15 + 2 col13 (2241/2272) + 6 col14 + **13 batch12b amendment (9 col16 + 4 col17)**.
- Rows 2203-2291 only; col18 (remark) 0 diff; 5 other sheets 0 diff; mojibake cyrillic=0 / U+FFFD=0.
- git HEAD `5a60875`; 0 staged / 0 commit / 0 push; `data/tests.json` repo file UNTOUCHED.

## 3. Whole-library defect-scan results

| check | result |
|---|---|
| R10 dup `2>&1 2>&1` | **0 residual** (W24 had cleared all; confirmed) |
| R29 bare ipmitool-subcommand without prefix | **0** (a heuristic pass falsely flagged 10; precise pass = 0) |
| Q-LIT unescaped inner double-quote in ssh remote | **0 genuine** (2 heuristic hits both false - r866 single-quote-wrapped remote + r2273 already single-quoted) |
| R7 leftover `<PLACEHOLDER>` in executed command | **2 Functionality** (see §4) + **~30 Compatibility rows** (style, see §5) |
| mojibake (cyrillic / U+FFFD) | **0** across all ai_commands + criteria |
| sensor-get rows WITHOUT `sdr elist` fallback (§20v operator item) | **196 rows** (Functionality 195 + Compatibility 1) |

## 4. Round-2 Functionality R7 residuals (small, exact)

- `r1957` `Wistron-AMD SVM-00037-V003` (RAS Bad Page Threshold Exceed, PARTIAL):
  `modprobe amdgpu ras_enable=1 bad_page_threshold=<val>` -> `<val>` is in the executed command.
  Should be `bad_page_threshold=${BAD_PAGE_THRESHOLD:?operator provides the amdgpu RAS threshold value}`.
- `r2090` `Wistron-AMD SVM-00134-V003` (Bad Page Threshold Exceed: Default RMA Threshold, PARTIAL): identical pattern.
- Both are in already-reviewed round-2 windows (batch10 1803-2002 / batch11 2003-2202) - a batch10/11 blind spot,
  NOT a batch-12 regression. Fix = 2 col15 cells.

## 5. Cross-sheet `<...>` placeholder style (operator decision)

- Compatibility sheet (~30 rows: fio targets r14-17, networking r49-51/66-68/396-398/439-443,
  storage r94-101, OS raid r130-132, GPU fw r218-219/226/351, mlxconfig r68/301) uses literal
  `<m2testfile> <eth1> <driver> <peer> <addr> <len> <iface> <mlx> <fw> <encl> <slot> <server> <iso>
  <dev> <image> <watts> <ip> <device> <pf>` **inside executed commands**.
- Round-2 converted this pattern to `${VAR:?operator ...}` on Functionality, but never touched the
  other 5 sheets (round-2 was Functionality-only; W-series kept `<...>`).
- These are NOT clickable in the 6969 UI and leave the operator guessing. Operator decision:
  wholesale `<X>` -> `${X:?...}` conversion on the other sheets (mirrors W14's cleanup), or keep.

## 6. Batch-12 row 2207/2292 KEEP confirmed

- `2207` PCIe BW stress: col15 already matches its own Items (no copy error) - correctly untouched by batch12.
- `2292` I2C Cable: col15 already describes the cable test correctly - correctly untouched.
- Both remain UNRESOLVED only because Criteria = TBD (library must fill first).

## 7. Closing pass (2026-09-18, operator GO "全都做") - items a-e executed

1. (a) Report item-numbering => **LOCKED: item = row - 1, Functionality = 2291 items** (matches tests.json).
   Headers renumbered 1/2291 .. 2291/2291; the missing row-202 (Wistron-HW-00211 Hot Plugging,
   PARTIAL) added as item 201; head title + convention note + final cumulative (NO 409 / PARTIAL 812 /
   YES 897 / UNRESOLVED 173 = 2291) + closing marker all updated. Historical per-batch summary blocks
   (## 第 A-B 條 / head def-blocks) kept as recorded (they used row-2 numbers); note explains.
2. (b) 5 TBD criteria (2203/2207/2290/2291/2292): source excels ALSO have Criteria=TBD for these rows, and
   2290/2291's Wistron-HW-00455-V002 maps to a different (LED/E1S) row in source - a merge-key
   mis-assignment. NOT fabricatable -> left UNRESOLVED, documented as test-library-owner dependency.
3. (c) §20v sdr-elist fallback => **DONE 196 rows** (Functionality 195 + Compatibility 1) via
   `scripts/fix_rev02_closing_sdr.py` (`... sensor get ... 2>&1; echo ---SDR-FALLBACK---; ... sdr elist 2>&1 | head -100`).
4. (d) R7 residuals r1957/r2090 => **DONE** `bad_page_threshold=${BAD_PAGE_THRESHOLD:?operator provides ...}`.
5. (e) Compatibility `<...>` placeholders => **DONE 34 rows** `<X>` -> `${VAR:?...}` via
   `scripts/fix_rev02_closing_e_placeholders.py`; 0 leftovers. Prose/doc `<Disk>/<PXE>/<id>` untouched.
6. Also fixed: row-202 Q-LIT (inner unescaped double-quote in the ssh remote -> single-quoted).
7. (f) batch12b col16/17 amendment kept (not reverted).
8. (g) tests.json sync + commit + push: PENDING (final step, after full verification).

## 8. Closing-pass delta vs `bak_rev02_closing_pre`

- 233 cells changed, ALL col15 (ai_commands): Functionality 198 (195 sdr-fallback + 2 <val> + 1 row-202
  Q-LIT) + Compatibility 35 (1 sdr-fallback + 34 placeholders). col13/14/16/17 = 0 diff.
- Build re-verified: 3112 / 6 sheets unchanged.


## 9. Run-2 cleanup (de-dup shared/mismatched ai_commands) — 43 cells, all col15

- Scope: 43 sets / 113 rows share exact ai_commands across the 5 non-Functionality sheets. Fixed the WR
  copy-errors + nested-ssh/Q-LIT defects; KEPT the legit shared families (60 rows) + TBD placeholders.
- Fixed 43 cells, ALL col15: Functionality 3 (nested-ssh r192/r1390, missing-space r2273) / Reliability 4
  (shared-WR r154/155 + nested-ssh r150/143) / Performance 5 (NCCL r61 + FIO r10-13) / Compatibility 31
  (shared-set WR rewrites + DCGM family cmd + nested-ssh r42/124).
- Cumulative vs bak_rev02_closing_pre = 276 cells (all col15): F201 / R4 / P5 / C66. Build 3112/6; mojibake 0.
- tests.json 3-way md5 = 5cb015cea6f7ba7f062811e114965455 (repo == prod == /tmp).


## 10. Operator decisions (2026-09-18)
- 5 TBD criteria (2203/2207/2290/2291/2292): operator 裁示「放著,test case 寫 TBD」,不補。
- 2290/2291 merge-key mis-assignment (Wistron-HW-00455-V002 -> E1S/LED source): operator 裁示「放著」。
- prose <id>/<Disk>/<PXE> placeholders: operator 裁示「當說明」,保留為文案。


## 11. Run-3: per-item desc differentiation for legit shared families (2026-09-18)
- operator GO 下一 run -> 60 個合法共享 row 補上各自 Items 的 '--' 開頭描述(僅 col15 文字,命令本文不動)。
- 51 行補/改 desc;修掉寫入時未格式化之 LED x13 + M.2 x2(內文曾含字面 %s)改正。
- diff vs run2_pre = 93 cells(col15):F3/R5/P5/C79/NMF1。殘餘 shared = 17 rows / 7 sets 全屬刻意相同(NVTOP TBD x5、ErrInjection x2、UMC x2、FIO-mix 同配對 x8)。
- 累計 vs bak_rev02_closing_pre = 324 cells(col15):F201/R5/P5/C112/NMF1。build 3112/6;mojibake 0;'%s' remnants 0。
- tests.json 3-way md5 58332d99576dae23e207fb7261da1b1f(repo==prod==/tmp)。
