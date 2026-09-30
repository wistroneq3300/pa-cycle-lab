# 交接檔 — Round-1 Pilot(Functionality 10 條)做完換視窗

> **給下一個視窗**:先讀這份 + 下面 4 份(依序)。本視窗做到「Functionality 10 條 pilot 報告完成 + OOB 已通 + 澄清 bmc_pass 陷阱」。
> **還沒做的事**:只出了报告;**未改 xlsx、未改 tests.json、未 commit**。其它 5 张 sheet 的 50 条还没做。

---

## 0. 本視窗交付物(檔案路徑)

| 檔案 | 作用 |
|---|---|
| `/root/sheng/manager/pa_manager/SESSION_HANDOFF_ROUND1_PILOT_WINDOW25.md` | **本檔**,最新狀態 |
| `/root/sheng/manager/pa_manager/review_round_01_pilot_functionality.md` | **Functionality 10 條完整報告**(5 段 + Q1-Q8 + ready_state + 真機 raw)→ operator review 這份 |
| `/root/sheng/manager/pa_manager/review_round_01_pilot_selection.json` | 60 條(6 sheet × 10)抽樣結果(純欄位快照,無 CJK 風險) |
| `/root/sheng/manager/pa_manager/scripts/pilot_draw.py` | 抽樣腳本(可重現:每 sheet 10 條,分層 + 家族覆蓋) |
| `/root/sheng/manager/pa_manager/scripts/pilot_full.py` | 撈 60 條完整欄位 → `pilot_full.json`(已存 /tmp) |
| 以下 4 份 = 既有交接紅線 | `OPENHANDS_PASTE_NEXT_WINDOW.md` / `REVIEW_WORKFLOW_LOGIC.md`(§14-17) / `SESSION_HANDOFF_WINDOW24_FULL_3112_DONE.md` / `AGENTS.md` |

**主來源(唯一真相,build 讀這支)**:`data/REVISED_commands_merged_with_raw.xlsx`(md5 `c3ae506f...`)
**build → prod**:`python3 scripts/build_testlib_json_xlsx.py data/REVISED_commands_merged_with_raw.xlsx /tmp/tests_new.json`;repo `data/tests.json` == prod `/srv/pa-manager-prod/data/tests.json`(md5 `bfbc1ab1fc327cec...`)

---

## 1. 已跟 operator 拍板的事(本輪有效,不可動)

| # | 拍板 | 值 |
|---|---|---|
| **P1** | READY 三態 vs ai_can_execute | **並存**(舊 YES/PARTIAL/NO 保留,新 READY/NEEDS-OP/PHYSICAL + UNRESOLVED 另加一欄 `ready_state`) |
| **P2** | 5 段上 6969 UI | **導入 6969**,但**分區塊排版,不能一大段黏一起**(operator 要一眼看懂) |
| **P3** | L2 真機 | **EQ3300-AIAgent 自己**(agent 主機,hostname 已是它);**只跑 READ**,不重開機/不改設定 |
| **P4** | 重跑範圍 | **每 sheet 抽 10 條先給 operator review,過了才正式 3000 條全跑** |
| **P5** | 報告檔 | 出 `.md` 檔(5 段報告)放 repo 根;**xlsx 只多一欄 `ready_state`** |
| **補充** | 逐條 | **務必每條獨立判斷、不套公版**(命中規則也要逐條核) |
| **Q5** | UNRESOLVED/缺段 | **(b) 標缺 + 附「建議補啥」模板**,operator 勾了才落 xlsx |
| **bmc_pass** | EQ3300 BmC 密碼 | **真值 = `0penBmc`**(見 §3 陷阱:已驗證 OOB 通過;**6969 機器庫本就已存對,不需改**) |

---

## 2. 本輪實際做的事

1. **第 1 步完成**:讀 `build_testlib_json_xlsx.py` → 確認 xlsx 加 `ready_state` 欄**安全**(build 的 FIELD_MAP 只讀 18 欄,新欄被忽略,不進 tests.json,不報錯;md5 會變但 build 重跑後三向校驗重對)。
2. **第 2 步完成**:60 條抽樣(6 sheet × 10,分層 YES/PARTIAL/NO + 6 大家族覆蓋),分布已貼給 operator 且 operator 回「OK」。
3. **第 3 步(部分)完成**:**Functionality 10 條已逐條獨立判定 + 真機跑**,產出 `review_round_01_pilot_functionality.md`。
   - READY 3 / NEEDS-OP 2 / PHYSICAL 1 / UNRESOLVED 4(詳細見該檔總覽表)。
   - 能真的都真跑過(EQ3300 本機 read;OOB read);UNRESOLVED/PHYSICAL/PARTIAL 標明原因。
4. **OOB 通了**:operator 給 `0penBmc` 後,`power status` / `raw` / `sensor get` / `sdr list` 全部正常。**澄清**:`bmc_pass` 不是錯值,是我**用 API 讀被 mask 成 `****`** 的取法錯(見 §3)。

---

## 3. ⚠️ 重要陷阱(bmc_pass via API 被 mask)—— 務必別重蹈

**事實**:
- 6969 機器庫 `data.json` 磁盘上 `EQ3300-AIAgent.bmc_pass` = **`0penBmc`(len 7),本來就是對的**。
- `GET/POST /api/machines` **回應會把 `bmc_pass` 變成 `****`**(`main.py` 819/937/947 都有 mask,`c["bmc_pass"] = "****"`)。
- 我先前**透過 API 撈**(以為在「依 R24 從 6969 撈」)→ 拿到 `len 4` 的 `****` → OOB 連不上(`RAKP 2 HMAC is invalid`)→ **誤判成「6969 密碼存錯」**,差點讓 operator 白改一次。

**鐵證(用 6969 磁盘真值 OOB 通過)**:
```
python3 -c "... 讀 /srv/pa-manager-prod/data/data.json ... ipmitool -I lanplus -C 17 -H 10.35.228.145 -U root -P <真值> power status"
→ Chassis Power is on   (exit 0)
```

**規則(後面每個視窗都照做)**:
> **OOB 變數(BMC_USER / BMC_PASS)一律直讀磁盤 `/srv/pa-manager-prod/data/data.json` 的 `machines[<name>]`,不走 6969 API。**
> `bmc_ip/user` 等不被 mask 的欄 API 可讀,但 **`*_*pass` 絕不可靠 API 回值**。
> 本機就是 EQ3300 agent 主機,直接 `json.load(open("/srv/pa-manager-prod/data/data.json"))["machines"]["EQ3300-AIAgent"]` 即可。

---

## 4. 本輪發現的 3 種「OOB 真跑」樣板(raw 直接驗證)

| 情境 | 命令 | 真值 | 結論 |
|---|---|---|---|
| OOB 讀通 | `power status` | `Chassis Power is on` | **通道 OK** |
| OOB 讀到不存在資源 | `sensor get 'TEMP_FPGA'` | `Sensor data record "TEMP_FPGA" not found!` | 機型無此 sensor → **R18 operator 判 N/A**,命令本身對 |
| OOB 收到 BMC 拒 | `raw 0x30 0x26` | `rsp=0xc7 Request data length invalid` | **BMC 不認這條 OEM 語法**(要帶 payload?)→ **UNRESOLVED**,需 operator 給正確語法 |

→ 這 3 類是「agent 真跑」會碰到的**正/負/拒 3 種回**,報告要如實貼,operator 據此判。

---

## 5. 下一視窗要做(按 P4 走)

**A. (必做)** operator review `review_round_01_pilot_functionality.md` 後,把 **4 條 UNRESOLVED** 給答案:
| code | 缺啥 | 需 operator 給 |
|---|---|---|
| `Wistron-BMC-00535-V003` | `raw 0x30 0x26` 回 0xc7 | 正確 OEM 語法(要帶哪些 payload byte) |
| `Wistron-BMC-00544-V005` | Write 邊界 + 5 段缺 3 段 | 目標 SUT / 目標 bytes / read-back raw;明確「只在 DEMO 機跑 + operator approve + 回滾值」 |
| `Wistron-HW-00415-V002` | HEVC 預期 raw shape(原始 TBD) | 補 `ENCODE_DURATION_S` 預設 + expected raw shape |
| `Wistron-BMC-00307-V002` | 整套 TBD procedure/criteria | 先更新 test case library 的 procedure/criteria,再 review |

**B. (必做)** 依 operator 對報告的勾選,**落 xlsx `ready_state` 欄**(加 1 新欄)→ **build → 三向 md5 校驗** → **零回歸(只能差 ready_state 欄)** → **operator 說 commit 才 commit**(紅線)。

**C. (必做)** 繼續 **Compatibility 10 條**(operator 已 OK 格式) → 出完 → operator 勾 → **落 xlsx**。

**D.(之後)** 5 張 sheet 依序:Compatibility → Reliability → Stability → Performance → (No Main Function)。**每張 operator 勾過再下一張**。

**E. (最後)** 全 6 sheet 各 10 條都勾完 → **正式 3000 條全跑**(P4)→ **6969 UI 改 5 段分區塊**(P2)。

---

## 6. 紅線(不可動,沿用 W24)

- git HEAD **`c588ef2`** → **0 commit / 0 stage / 0 push**(除非 operator 明說「commit」)
- 改 data **只改 `ai_commands` / `ai_packages_needed` / `ai_logs_output` 等允許欄 + 新增 `ready_state`**;**`ai_can_execute` / `risk` 保守不改**
- `123.txt` / `data/11.RestAPI/` / `data/12.RestAPI/` / `*.bak_*` 維持 **untracked**
- code **pure ASCII**;**CJK 只寫進交接 / 報告 markdown**
- **L2 只跑 READ**,不重開機 / 不改設定 / 不觸 WRITE/DESTROY;寫 級 一律先 operator approve
- **OOB 變數直讀磁盘 `data.json`**,不信 API 回值(§3 陷阱)
- operator 給的**密碼真值 `0penBmc`** = **不要寫進任何 .md / 報告**(只在執行時取)

---

## 7. 狀態(本視窗結束)

| 項 | 值 |
|---|---|
| git HEAD | `c588ef2`(未 commit) |
| xlsx | 未改(本輪只出報告) |
| tests.json | repo == prod == `bfbc1ab1fc327cec...`(未重 build) |
| 6 張 sheet | **只有 Functionality pilot 10 條出報告**;其餘 5 張 sheet 抽樣 OK,**尚未 review** |
| OOB | **已通**(用 6969 磁盘真值) |
| 待 operator 勾 | Functionality 10 條(`review_round_01_pilot_functionality.md` §總覽表) + 4 條 UNRESOLVED 答案 |

---

_**一句話**__:Functionality 10 條報告完成,等 operator 勾;OOB 通了;`bmc_pass` 是「別走 API」的取法錯,不是存錯;下一視窗:等勾 → 落 xlsx(`ready_state`)→ build → 零回歸 → 繼續 Compatibility 10 條。_
