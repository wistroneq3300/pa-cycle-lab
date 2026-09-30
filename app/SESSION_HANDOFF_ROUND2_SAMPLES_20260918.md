# 交接檔 — Round-2 樣本 review 討論 + 邏輯檔加 §十九(2026-09-18)

> **給下一個視窗**:先讀這份 + 依序讀 REVIEW_WORKFLOW_LOGIC.md(§十九為本輪新增)。
> 本視窗做:**與 operator 對齊 5 條樣本 + 把拍板寫成 §十九(m–u)**。
> **還沒做**:尚未正式 3112 逐條;尚未改 xlsx / tests.json / 未 commit / 未 push。

---

## 0. 本視窗交付物

| 檔案 | 作用 |
|---|---|
| `REVIEW_WORKFLOW_LOGIC.md`(533→600 行) | **新增 §十九 m–u**(operator 已拍板的樣本規則 + review 寫檔規則) |
| 本檔 | 本視窗交接(標日期 2026-09-18) |
| (尚未建) | 正式 3112 逐條 review 報告 |

**mojibake**:§十九追加後 cyrillic=0 / mojibake 0。git HEAD 仍 `c588ef2`,0 commit / 0 stage / 0 push。

---

## 1. 本輪拍板(operator 原話,已寫入 §十九 m–u)

### 打架 1 → §十九 m:判定三態保留 + 並存
- **YES / PARTIAL / NO 保留為主判定**,與 READY / NEEDS-OP / PHYSICAL(§十八 h / R38)並存、不打架。
- 白話對應:**YES ≈ READY**(拿到參數就能自動跑)、**PARTIAL ≈ NEEDS-OP**(要前置/要變動、指定目標)、**NO ≈ PHYSICAL**(要人動實體)。

### 打架 2 → §十九 n:review 寫檔規則(紅線級)
- **每一次 review 到哪,一律當場寫進 md 交接檔 + 標日期**(對話視窗一直換)。
- 邊 review 邊改 xlsx → 可(operator 認可);**push 一律等 operator 說「Push」**;commit 同紅線。

### 打架 3 → §十九 u:先抽樣、後全跑
- 每 sheet 先抽樣給 operator 拍 → 規則定案 → 才正式 3112 逐條。

### 5 條樣本 → §十九 o–t
| 樣本 | verdict | 關鍵 |
|---|---|---|
| HW-00213-V002 | NEEDS-OP | dd 補三件套(🎯/產出人/判斷閘)(s) |
| Storage-00059-V004 | NEEDS-OP | 實測 bash 補齊(o job-file 預寫法;現只寫 fio --version=假完成) |
| RAS-00374-V003 | NEEDS-OP | 資訊讀取全量抓 + 粗篩並存(p) |
| CPU-00002-V003 | NEEDS-OP | `${TOOL_PATH:?}` 依 vendor guide,不臆造 run 命令(r) |
| Long Term Stress-00067-V004 | PHYSICAL | AC 物理 → agent 只給事後檢查包(q) |

---

## 2. 新增規則要點(§十九)

- **o 假完成檢查**:題目要「跑測試」的,ai_commands 必須有真測試 bash;只寫 `fio --version`/工具檢查 = 不合格。fio 用 §十八 e job-file 預寫法。
- **p 資訊讀取題**:全量抓為主;輸出太長 → 全抓 + 粗篩並存並標明篩了甚麼(operator 原話「全抓+grep」)。
- **q 物理動作歸 PHYSICAL**:agent 不能觸發的(AC cycle/插拔/過壓)→ PHYSICAL 不是 PARTIAL;agent 只給事後證據讀取包。
- **r 白名單外工具**:`${TOOL_PATH:?}` + packages 標 operator 提供;**不臆造 vendor run 命令**,依 vendor user guide 由 operator 填(agent 給 wrapper/前置 + 抓輸出)。
- **s 每條達標三件套**:🎯 頭 + 📤 產出人 + 🚧 判斷閘,缺一 = 不合格。
- **t 樣本 verdict 一覽**(見上表)。

---

## 3. 待辦(下一視窗,依 operator 指示)

1. 【待 operator 拍】是否還有其它樣本類型要討論?(sensor fallback / redfish vendor slot 尚未以樣本舉例)
2. operator 同意後 → 依 §十九 u 進入**正式 3112 逐條 review**:
   - 每條出「8 問(Q1..Q8)+ 5 段(🎯/📥/▶/📤/🚧)+ §十八 h 三項 + verdict」,不實跑(§十八 a/j)。
   - 四類必抓:e 跑錯位置 / c 應全量卻挑行 / d sensor 無 fallback / b vendor slot 未標。
   - **每 review 到哪就寫交接檔 + 標日期(n)。**
3. 逐條產出報告檔(如 `review_round_02_<sheet>.md`)放 repo 根;operator 勾選後才落 xlsx / build / 零回歸 / push(等 Push)。

---

## 4. 紅線(沿用)

- git HEAD `c588ef2`,0 commit / 0 stage / 0 push(operator 說 commit/push 才做)。
- 改 data 只動允許欄;ai_can_execute / risk 保守。
- code pure ASCII;CJK 只寫進 markdown(l 硬規則:app.js 用 python 禁 file_editor;本視窗未動 app.js)。
- L2 只 READ;WRITE/DESTROY 先 operator approve。OOB 變數直讀磁盤 data.json(§十八 i)。

---

## 5. 狀態(本視窗結束)

| 項 | 值 |
|---|---|
| git HEAD | `c588ef2`(未 commit/stage/push) |
| REVIEW_WORKFLOW_LOGIC.md | **533→600 行,新增 §十九 m–u**,mojibake 0 |
| xlsx / tests.json | 未改(本輪純 .md 追加) |
| 正式 3112 逐條 | 尚未開始(待 operator 拍完樣本/規則) |


---

## 追加 2026-09-18 — 樣本勾選第二輪(12 條)已拍板 → 寫入 §二十

**邏輯檔**:`REVIEW_WORKFLOW_LOGIC.md` 533→656 行,新增 §二十(v–aa),mojibake 0。

**本輪拍板**(operator 對 12 條樣本逐條勾):
- **v** sensor 名稱依機型而異 → `get` not found 補 `sdr elist`/`sensor list` 整包,operator 自己對命名(Functionality F1/F2)。
- **w** `${VAR:?...}` = bash 缺值自動停 + 提示(operator 疑問解答,白話)。
- **x** DIMM error injection(R2)**YES**(原 NO):operator 給 RAS SOP 就能跑;🚧 標「可能 reboot」+ risk。
- **y** STREAM(P1)**YES**(原 PARTIAL):operator 給指令/白名單 `gcc` 編就能跑;補真正 bash。
- **z** 其餘確認:C1/C2 storcli PARTIAL+`${TOOL_PATH:?}`、R1 UPI CRC PARTIAL、P2 MLPerf PARTIAL、S1 Reboot500 PARTIAL、S2 AC1000 PHYSICAL、N1 Flash BIOS PARTIAL+WRITE/DESTROY、N2 HPL CPU-00002 **PARTIAL**。
- **aa** YES/PARTIAL/PHYSICAL/UNRESOLVED 定義(**草案,待 operator 討論拍定**):
  - YES=拿到指令/SOP 一口氣跑完、中途不需 operator 插手;會 reboot 只要備註+提前問仍可 YES。
  - PARTIAL=執行途中某步一定要 operator 人在/動手/供東西(fio 目標、HPL/MLPerf/storcli 工具、SNMP 前置、LED 現場)。
  - PHYSICAL/NO=物理動作 agent 不能做,只給事後證據包。
  - UNRESOLVED=8 問/5 段/TBD 任一缺。

**待 operator 拍定**:§二十 aa 的 YES/PARTIAL 定義(discussion open)。
**待 operator 指示**:是否還有其它樣本要討論;否則依 §十九 u 進入正式 3112 逐條。

**git**:HEAD 仍 `c588ef2`,0 commit/stage/push,本輪純 .md 追加。


---

## 追加 2026-09-18 — YES/PARTIAL/NO 定義已鎖版(§二十一)

**邏輯檔**:`REVIEW_WORKFLOW_LOGIC.md` 656→680 行,新增 **§二十一(鎖版定義)**,mojibake 0。

**鎖版定義**(operator 對 3 個邊界 case 拍定):
- 分界 = **「給完後過程中有沒有要『人』在場動手/看/批准」**,不是「要不要給東西」。
- **YES** = operator 一次性給完(碟/工具/sop/指令/參數)後 agent 自動跑到完、不需人再動手;會 reboot 只要備註風險+提前問(R22)仍 YES。例:FIO/HPL/MLPerf/storcli/STREAM/DIMM injection/dmidecode/OOB sensor。
- **PARTIAL** = 執行中某步一定要人動手/在場看/批准。例:SNMP(先配好)/LED風扇(人在場看)/Reboot500(批准時長)/AC cycle(人在現場)。
- **NO/PHYSICAL** = 要人手動物理操作(拆機/插拔/換PSU/過壓欠壓)agent 不能做,只給事後證據包。
- **UNRESOLVED** = 8問/5段/TBD 任一缺。

**3 邊界 case 拍板**:
1. reboot/改狀態 → 不算 PARTIAL,備註風險+提前問仍 YES。✅
2. 人在場看(LED/風扇)→ PARTIAL;手動拆東西 → NO。✅
3. 純資訊打爆 log → YES;但 log 很長時 agent 要幫 operator 抓「正確那段」(全抓+粗篩並存,落實 §十九 p)。✅

**判定注意**:fio/dd「要指定目標碟」→ **YES**(operator 一次給 `FIO_TARGET`),不因指定碟降 PARTIAL;仍用 `${FIO_TARGET:?}` + NEVER OS 碟。

**git**:HEAD 仍 `c588ef2`,0 commit/stage/push,本輪純 .md 追加。

**下一步(待 operator)**:定義已鎖。是否進正式 3112 逐條(= §十九 u:每 sheet 先抽 pilot 10 條給 operator 勾,過了再放量)。


---

## 追加 2026-09-18 — operator 新指示(寫入交接檔,紅線級)

**operator 在正式開跑前追加 3 條規則(本視窗寫入):**
1. **取消 pilot 10 條抽樣**。§十九 u 的「每 sheet 先抽 pilot 10 條給 operator 勾」**不再執行**;直接從頭開始正式 3112 逐條 review。
2. **每 200 條存檔一次**:review 每滿 200 條,一律當場存檔一次(寫進交接檔 `SESSION_HANDOFF_*.md` + 標日期 + 若有產出報告檔也同步落檔)。
3. **遇到 agent 無法決定/不確定的事,一律停下來問 operator;不自己決定**。這條同樣寫為紅線級。

> ⚠️ 上述 3 條已覆蓋/取代 §十九 u 的抽樣做法。正式 review 從頭(第 1 sheet 第 1 條)開始,照 §十九 n(每進度即寫檔)連續跑,期間不定時存檔。

**git**:HEAD 仍 `c588ef2`,0 commit/stage/push,本項純 .md 追加。


---

## 追加 2026-09-18 — 存檔規則更新:每 200 條自動給交接文(operator 拍板)

**新規則(取代/補充「每 200 條存檔」)**:以後每 review 完 200 條,agent **自動產出一份「可複製給下一個對話視窗」的交接文**,直接打在回覆裡(operator 照抄貼給下個視窗即可)。
- 交接文內容含:完整路徑、本批進度、verdict 統計、瑕疵表、待辦、紅線狀態。
- 不另外等 operator 要求;200 條 checkpoint 一到就自動輸出。

---


## 追加 2026-09-18 — 正式 3112 review 開跑(前 200 條已存檔)

**本視窗已開始正式 3112 逐條 review**,依 operator 指示:
- 取消 pilot 抽樣,從頭逐條;每 200 條存檔;遇無法決定就停下來問。
- 產出:`review_round_02_functionality.md`(repo 根):Functionality sheet row 2–201 共 **200 條**已逐條出「8問+5段+§十八 h 三項+§二十一 verdict」,含統計與瑕疵表。

**operator 已拍板 2 點(本輪)**:
1. **PMBus HW-00049~00056(8 條)採 B**:標 PARTIAL + 補真 `i2cget <reg>` + `${PMBUS_BUS_ADDR:?}`(§十九 o 假完成)。
   - 為何之前沒改:舊標準(R26 sudo)只把它們當「加 sudo」蓋過;「假完成」是 §十九 o 新判準,重走 3112 才首次抓到 = 規則升級,非疏漏。
2. **Q-LIT(ssh 內層 grep 雙引號)= 真缺陷**,沿用 Round-1 已拍板修法(內層改單引號),不再逐條重問。

**本批統計**:
- verdict:NO/PHYSICAL 108 / PARTIAL 76 / YES 16。
- 瑕疵:Q-LIT **29** 條(HW-00072/73/74/75、00094、00110、00116、00127/128、00148、00155、00158、00162、00184~00193、00196~00199、00201、00210);§十九 o 假完成 **8** 條(HW-00049~00056);§十八 d/c 本批未命中;§十八 b(PMBus `PMBUS_BUS_ADDR`)與假完成同批處理中。
- mojibake:cyrillic=0。git HEAD 仍 `c588ef2`,0 commit/stage/push。

**✅ 本批缺陷已實際修進 xlsx(2026-09-18,邊 review 邊改)**:
- **37 條 `ai_commands` 已改**:29 Q-LIT(內層 grep 雙引號→單引號;Redfish 類 00185~00193 的 nested-ssh curl 改 agent-host)+ 8 PMBus(HW-00049~00056 補真 `i2cget` + `${PMBUS_BUS:?}`/`${PMBUS_ADDR:?}` 取代 `PMBUS_REG_0x0xE0 NEEDS_PSU_BUS_ADDR` 佔位)。
- **零回歸已驗證**:`python3 scripts/build_testlib_json_xlsx.py data/REVISED_commands_merged_with_raw.xlsx /tmp/tests_new.json` → 2977 cases 中**僅 37 field 變更**(全 `ai_commands`)、`total`=3112/6 sheets 不變、其它欄位(ai_can_execute/risk/結構)全無變動。
- **✅ `data/tests.json` 已同步(2026-09-18,operator 指示)**:build → 零回歸(37 field/37 codes 全為本批) → 覆蓋 repo 快照 `data/tests.json` + prod `/srv/pa-manager-prod/data/tests.json` → **三向 md5 `bd8475636782df6477f452ea53c69e87` 一致**;prod spot-check 3 條(HW-00049/00050 i2cget + HW-00072 single-quote)grep 已生效。未 commit/push。

**下一視窗**:續跑 Functionality 剩余(2291-200=2091 條)or 依 operator;每 200 條存檔自動給交接文;報告檔續寫/另開。


---

## ⏭️ 狀態確認(2026-09-18):邏輯對齊完成 → 下一視窗可開始 3112 正式 review

> operator 已確認:樣本討論、規則鎖版全數完成,**下一步 = 正式 3112 逐條 review**(§十九 u)。
> 本視窗結束前狀態:**REVIEW_WORKFLOW_LOGIC.md 680 行(§一~§二十一含 m–u/v–aa/鎖版 §二十一)**,mojibake 0;git HEAD `c588ef2`,0 commit/stage/push;xlsx/tests.json 未改。

**下一視窗啟動 SOP(依 §十九 u + §二十一 鎖版定義)**:
1. **每 sheet 先抽 pilot 10 條**給 operator 勾 → 勾過才放量逐條。
2. 每條產出:「8 問(Q1..Q8)+ 5 段(🎯/📥/▶/📤/🚧)+ §十八 h 三項(執行模式/operator slot/邏輯 sanity)+ **verdict(用 §二十一 鎖版定義)**」,**不實跑**(§十八 a/j)。
3. 四類必抓:e 跑錯位置 / c 應全量卻挑行(grep 挑行)/ d sensor 無 fallback / b vendor slot 未標。
4. **每 review 到哪就寫進交接檔 + 標日期(§十九 n,紅線級)。**
5. 逐條產出報告檔(`review_round_02_<sheet>.md`,repo 根);operator 勾選後才落 xlsx / build / 零回歸 / push(等 Push)。
6. 判定以 **§二十一 鎖版定義**為準:**YES = 給完一次性自跑到底;PARTIAL = 中途要人動手/在場/批准;NO = 要人拆/物理;UNRESOLVED = 8問/5段缺**。fio/HPL/MLPerf/storcli = YES(給資料即可),不因指定碟/依vendor降PARTIAL。

**operator 已貼給本視窗的交接文**:見下方「下一視窗交接文」區塊(operator 會直接複製貼給下一個對話視窗)。
