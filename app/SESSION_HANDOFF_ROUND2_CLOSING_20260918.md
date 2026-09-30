# Session Handoff — Round-2 Closing (Functionality 100% + closing pass a-e + tests.json sync)

日期:2026-09-18。本窗口完成 Round-2 Functionality **收官後之收尾**(operator GO「全都做 做完再交接」),並已 sync `tests.json`(repo==prod==/tmp)、**commit + push**。

---

## 1. State at window end

- **xlsx**: `data/REVISED_commands_merged_with_raw.xlsx` 已含 batch12(21 cells)+ batch12b(13 cells)+ **closing pass(233 cells)**。
- **Report**: `review_round_02_functionality.md` = 64235 行(`### 1/2291` … `### 2291/2291`)。
- **tests.json**: 3-way md5 `9ab9e51a165e38d0c8d37a2b71bc61b6`(repo `data/tests.json` == `/srv/pa-manager-prod/data/tests.json` == `/tmp/tests_closing.json`)。
- **git**: HEAD(PRE) `5a60875` → 本次已 commit(新 HEAD 見 `git log -1`)並 push。僅包入慣例檔(見 §7)。

## 2. Closing pass (a–e) 執行摘要

| item | 內容 | 結果 |
|---|---|---|
| (a) | 條號約定 LOCK **item = row − 1,Functionality = 2291** | report 逐條清單重編 `1/2291..2291/2291`;補 row-202(HW-00211 Hot Plugging,PARTIAL)為 item 201;頭 title+convention 註記+末累計 NO409/PART812/YES897/UNRES173=2291 全更新。歷史批次「## 第 A–B 條」區段保留 row−2 紀錄,頭註記說明 |
| (b) | 5 條 TBD criteria(2203/2207/2290/2291/2292) | **source excel 亦為 TBD**;2290/2291 之 HW-00455-V002 在 source 對應的是別行(E1S/LED)→ **merge-key 錯位**,非本窗口可補 → 列為 library owner 依賴 |
| (c) | §20v sdr-elist fallback | **196 rows**(Functionality 195 + Compatibility 1),`scripts/fix_rev02_closing_sdr.py`(`... sdr elist 2>&1 \| head -100`) |
| (d) | r1957/r2090 `<val>` | → `bad_page_threshold=${BAD_PAGE_THRESHOLD:?operator provides the amdgpu RAS bad-page threshold value}` |
| (e) | Compatibility `<...>` placeholder | **34 rows** `<X>` → `${VAR:?...}`(`scripts/fix_rev02_closing_e_placeholders.py`),0 leftovers;prose/doc `<Disk>/<PXE>/<id>` 保留 |
| + | row-202 Q-LIT | 內層未逸出雙引號(`watch -n1 "lsusb…"`/`grep "usb|…"`)→ 單引號 |

## 3. Closing-pass delta(對 `bak_rev02_closing_pre`)

- **233 cells,全部 col15(ai_commands)**:Functionality 198(195 sdr-fallback + 2 `<val>` + 1 row-202)+ Compatibility 35(1 sdr-fallback + 34 placeholder)。
- col13/14/16/17 = 0 diff;mojibake(cyrillic/U+FFFD)=0;build **3112 / 6 sheets 不變**(F2291/R202/P60/C459/S88/N12)。

## 4. Build / tests.json

- `scripts/build_testlib_json_xlsx.py data/REVISED_commands_merged_with_raw.xlsx /tmp/tests_closing.json` → 3112 / 6。
- 已同步 repo + prod(3-way md5 如上)。`git status` 應見 `data/tests.json` 為 M。

## 5. 已知開放事項(交予 owner / 下窗口)

1. **5 條 TBD criteria + merge-key 錯位**(2203/2207/2290/2291/2292):source 亦缺,需 library owner 補 Criteria 並釐清 HW-00455-V002 對行。
2. **Cross-sheet Q-LIT / 已知列**(W22/23「Open user-GO items」,非 round-2 Functionality 範圍):Compat rows 42/124/125/85/104/110/112/118/141、Reliability 143/150/151/152/154、No-Main-Function r4;另 stray `sudo dmidecode -t memory 2>&1 2>&1`。closing 掃描確認為**既有** workstream,未自動改(避免跨 sheet scope creep)。→ 如需可下一窗口逐條清。
3. **prod 其它檔**:`/srv/pa-manager-prod` 其餘 deploy(static/CSV)非本窗口職責,未動。

## 6. Scripts(新增,均已 commit)

`scripts/fix_rev02_closing_sdr.py`、`fix_rev02_closing_d_row202.py`、`fix_rev02_closing_e_placeholders.py`、`verify_closing.py`、`renumber_report_a.py`。

## 7. Commit 內容(慣例:僅包實效檔)

`data/REVISED_commands_merged_with_raw.xlsx`、`data/tests.json`、`review_round_02_functionality.md`、本 handoff、`FULL_LIBRARY_CLOSING_AUDIT_20260918.md`、closing scripts、`OPENHANDS_PASTE_NEXT_WINDOW.md`。備份 `.bak*`、其它 session docs 未包。
