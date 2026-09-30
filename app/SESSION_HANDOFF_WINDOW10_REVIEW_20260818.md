# Window-10 — 續跑 data_index 1184..1383(Wistron-BMC-00476→00675, 200 行)

> 本視窗由用戶指示:「繼續 200 條」。
> 用戶拍板(重要):`0penBmc` / 內網 IP = 本機 6969 機台庫的 OS/BMC 實運作資料,
> **非洩漏、非脫敏標的**;`data/11+12.RestAPI/` 是 canonical redfish 路徑參考。
> 紅線調整見 §8。

---

## 0. 本視窗做了什麼

- 範圍: 功能性 Functionality **data_index 1184..1383**(200 行, Wistron-BMC-00476-V003 → Wistron-BMC-00675-V003,
  單 family BMC, 28 test set:DCMI 30 / Manager 27 / Wistron OEM 17 / Sensor 16 / SEL 14 / SDR 13 / Chassis 13 /
  Account service 9 / System 8 / Bios 6 / Certificate 5 / Platform 5 / ... ForceRestart 1)。
- 判定分佈: **YES 98 / PARTIAL 73 / NO 29**(全維持原判定,**0 改 ai_can_execute**)。
- 修 **24 格(24 行)全在 `ai_commands`**, 分 3 群:

### A. 表面雙/三 redirect 去重(12 行)
| code | 缺什麼 | 修 |
|---|---|---|
| 00480 / 00481 / 00482(Event Commands) | `2>&1 2>&1` | 去重 |
| 00510 / 00511(FRU Inventory) | `2>&1 2>&1 2>&1` | 去重 |
| 00622 / 00623 / 00624(Bios) | `2>&1 2>&1` | 去重 |
| 00655 / 00658 / 00659(Certificate) | `2>&1 2>&1` | 去重 |

### B. R28 canonical Redfish 路徑(11+12.RestAPI 核實)(7 行, 多行同時含去重)
> 核實來源:`data/11.RestAPI/Storage/Storage.txt` + `data/12.RestAPI/Storage/Storage.txt` → `Systems/system/Storage[/1]`;
> `data/12.RestAPI/BMC FW update/bmc fw update.txt` + `data/11.RestAPI/BMC update/*` → **HttpPushUri** flow;
> `data/12.RestAPI/BMC Cold-Reset/BMC Cold-Reset.txt` → `Managers/bmc/Actions/Manager.Reset`。

| code | 錯處 | 修法 |
|---|---|---|
| 00613 | `Systems/1/Storage` | → `Systems/system/Storage` |
| 00614 | `Systems/1/Storage/<StorageId>` | → `Systems/system/Storage/${STORAGE_ID:?operator must set the Storage collection member id from the Storage collection listing}` |
| 00615 | `Systems/1/Storage (enumerate …)` | → `Systems/system/Storage (…)` |
| 00619 | `Systems/1/Processors/CPU0`(硬編)+ 雙 `2>&1` | → 多行 agent-host curl:collection + `Processors/${PROC_ID:?…}`;R7 占位符 |
| 00620 | `Systems/1/NetworkInterfaces/{NICId}` | → `Systems/system/NetworkInterfaces/${NIC_ID:?…}`;R7 |
| 00621 | 同上 | 同上 |
| 00670 | `Managers/1/Actions/Manager.Reset` | → `Managers/bmc/Actions/Manager.Reset` |

### C. R7 裸占位符(`${VAR:?operator must …}`, R30 無反引號)(5 行)
| code | 原 | 改 |
|---|---|---|
| 00512(FRU write OOB) | `raw 0x0a 0x12 <offset> <data>` | `${FRU_OFFSET:?…}` + `${FRU_DATA:?…}`(mirror 00385 寫法) |
| 00656(Account create) | `{"UserName":"<new>","Password":"<pwd>",…}` | `${NEW_ACCOUNT_NAME:?…}` + `${NEW_ACCOUNT_PASS:?…}` |
| 00662(Telemetry SubmitTest) | `"MetricReportDefinitionName":"<def>"` | `${METRIC_REPORT_DEF:?operator must set the Telemetry MetricReportDefinition name}` |
| 00668(EventService sub) | `"Destination":"https://<listener>/event"` | `${EVENT_LISTENER_URL:?operator must set the event listener destination URL}` |

### B+C+R31 三重(1 行)
| code | 問題 | 修 |
|---|---|---|
| **00666**(POST Update BMC Firmware) | (1) 路徑寫 `Actions/UpdateService.Update` — 11+12.RestAPI 實際走 **HttpPushUri** flow;(2) `-F "UpdateParameters={...};@<img>"` 是假語法;(3) 套在 `ssh DUT …` 內但 image 在 agent host | 整格重寫:agent-host 直接跑 `curl -sk -u "$BMC_USER:$BMC_PASS"`:`GET UpdateService → jq .HttpPushUri` → `POST -T "${BMC_IMAGE:?…}" "$BMC_IP$URI"` → 可選 `PATCH UpdateService` 觸發 ApplyTime → verify `FirmwareInventory/bmc_active`。維持 PARTIAL + state-changing |

### 不修的(保守)
- 9 行 `-- not directly runnable with stock ipmitool…; give exact bytes`(00477/00478/00488/00489/00513/00514/00515/00519/00520):全是**說明文字**不是假命令,判定 PARTIAL 合理,不修(同 7-window 的 R31 說明型未修群)。
- 5 行 OOB lanplus 套 ssh(00480-00482/00510-00511)與 prior-window 的 00408/00411/00414/00415 同款:功能可跑、位置不合 R5 → 記 §7 未修(可下視窗一批抽到 agent-host)。

---

## 1. 零回遊 / 驗證
- Build 3112 / 6 sheets 不變(功能性 2291 / 可靠性 202 / 效能 60 / 相容性 459 / 穩定性 88 / 無主功能 12)。
- **零回歸**: vs backup 差異 = **24 rows × `ai_commands` 一欄**;其餘 17 欄 + 5 sheets 0 diff;**ai_can_execute 全 0 改動**。
- 三向 md5 一致: `c3e747d365cf2d70d71c77db6f5c7335`(repo `data/tests.json` == prod `/srv/pa-manager-prod/data/tests.json` == `/tmp/tests_new.json`)。
- 6969 alive(http 200);抽樣 **13/13 PASS**(00480/00481/00510/00512/00613/00614/00619/00620/00656/00662/00666/00668/00670)。
- 備份: `data/REVISED_commands_merged_with_raw.xlsx.bak_batch_20260905_window10`(本視窗改前快照,含 24 行修改後狀態;原始窗口前快照在 `…_goB`)。
- 窗內最終: **0 雙 redirect / 0 裸占位符(1326 的 `<id>` 是 comment 說明,非 bash) / 0 `Systems/1` / 0 `Managers/1`**。
- 未 commit、未 push(§8)。

---

## 2. 規則(REVIEW_WORKFLOW_LOGIC.md, 本視窗沿用 + 1 處補強)
- **R28/B**: 11+12.RestAPI 補核實兩條 canonical:
  * **UpdateService flash = HttpPushUri**(不是 `Actions/UpdateService.Update`):token → `GET /UpdateService` 取 `.HttpPushUri` → `POST -T <image> $BMC_IP$URI` → 可選 `PATCH /UpdateService` `{HttpPushUriOptions:{HttpPushUriApplyTime:{ApplyTime:...}}}`。
  * Managers canonical ID 本機 = **`bmc`**(Cold-Reset / ResetActionInfo 都走 `Managers/bmc/…`)。
- **R29/C**: 假命令 + 裸占位符 audit;`<x>` 一律 `${X:?operator must …}`。
- **R30**: `:?` 訊息內無反引號/雙引號。
- **R31(下視窗候選)**: OOB lanplus in ssh 8 行(00408/00411/00414/00415 + 00480/00481/00482/00510/00511, 實際 9 行)→ 抽到 agent-host。

---

## 3. 游標慣例 ⚠️(不變, 務必照辦)
- **rowidx = 0-based 資料列索引(data index)**, 不是 Excel 1-based 行號, 不是 code 數字。
- Excel 行號 = data_index + 2(header)。
- **本視窗 = data_index 1184..1383**(00476-V003 → 00675-V003)。**游標校驗**:1383=00675 / 1384=00676 / 1385=00677,三碼連著對得上。
- **下視窗起始 = data_index 1384 = Wistron-BMC-00676-V003**。用 code 前後 context 校驗, 不靠裸數字。

---

## 4. 進度
- 功能性 Total = **2291 行**(data_index 0..2290)。
- 已交付: **data_index 0..1383 = 1384 行**(W1-W9 累計 1184 + 本視窗 200)。
- **剩 907 行未跑**(data_index 1384..2290)。
- 換 unique code 口徑: 累計 ~1400 / 2977(~47%);**以「資料列」口徑為準(1384 / 2291)**。
- **下視窗口徑: data_index 1384..1583 = Wistron-BMC-00676-V003 → Wistron-BMC-00875-V003(200 行, 全 Wistron-BMC)**。

---

## 5. 檔案路徑
| 檔 | 路徑 |
|---|---|
| 入口 | `OPENHANDS_PASTE_NEXT_WINDOW.md`(已更新指向本檔 + `data_index 1384 起`) |
| 本檔 | `SESSION_HANDOFF_WINDOW10_REVIEW_20260818.md`(新增) |
| 全規則 | `REVIEW_WORKFLOW_LOGIC.md`(R28 canonical 兩條補強) |
| 主 xlsx(repo) | `data/REVISED_commands_merged_with_raw.xlsx`(本視窗改 27 格 / 24 行, 全 ai_commands;24 = A12+B7+C5-1 重疊 00666) |
| 備份 | `data/…xlsx.bak_batch_20260905_window10`(改前) + `…_goB`(上視窗快照) |
| tests.json(repo) | `data/tests.json`(已 rebuild+cp) |
| tests.json(prod) | `/srv/pa-manager-prod/data/tests.json`(已 rebuild+cp) |
| build | `scripts/build_testlib_json_xlsx.py` |
| 本視窗腳本 | `/root/w10_fix.py`(24 格修 + 1374 整格 rewrite)、`/root/w10_fix2.py`(1327/1328/1329 重寫) |
| 6969 | `GET http://127.0.0.1:6969/api/testlibrary?sheet=%E5%8A%9F%E8%83%BD%E6%80%A7&code=<code>`、`/api/testlibrary/meta` |

---

## 6. 下一視窗該幹嘛(照順序)
1. **先讀本檔**(NEWEST), 再讀 `OPENHANDS_PASTE_NEXT_WINDOW.md`。
2. **先 review 上一批(W10)交付**:
   - 6969 抽 13 關鍵修正點(00480/00481/00510/00512/00613/00614/00619/00620/00656/00662/00666/00668/00670), 看無 dbl-redirect / 無 `Systems/1` / 無 `Managers/1` / 00666 有 HttpPushUri。
   - 用 audit 腳本掃 data_index 1184..1383, 確認 0 dbl / 0 裸 `<x>`(1326 comment 例外)/ 0 `Systems/1` / 0 `Managers/1`。
   - 核 3 向 md5(本檔寫 `c3e747d3…`;若下視窗又改過, 會再變)。
3. **若無致命阻塞(保守原則可自決)** → 續跑 200 條:
   - **入口 data_index 1384..1583**(= Wistron-BMC-00676-V003 → 00875-V003, 200 行, 全 Wistron-BMC)。**務必先印 1383/1384/1385 三行 code 對齊**(00675 / 00676 / 00677)再開始。
   - 判定保守: 0 改 ai_can_execute 優先;拿不準就 PARTIAL/NO。
4. **每批跑完**: backup → audit → 修 → build → 零回歸(只該動 ai_commands)→ cp 兩處 → 三向 md5 → 6969 抽樣。
5. **寫下一份交接**(同本檔結構)+ 更新 `OPENHANDS_PASTE_NEXT_WINDOW.md` 指向它。
6. **安全紅線**: 未 commit 未 push;push 前**不需要**對 `0penBmc` 做脫敏(§8)。

---

## 7. 已知未修(下視窗可補)
- **R31(9 行 OOB lanplus in ssh)**: 00408 / 00411 / 00414 / 00415(prior-window)+ 00480 / 00481 / 00482 / 00510 / 00511(本視窗)= 9 行。可跑但不合 R5(host 應是 agent)。下視窗可抽到 agent-host 再執行(R5/R31);需 operator 給 `$BMC_IP/$BMC_USER/$BMC_PASS`(已在 6969 機台庫,見 R24)。
- **說明型 PARTIAL 行(≥25 行)**: 00285/00287/00345-351/00361-362/00386-388/00392-393/00412/00472-473(prior-window 16 行)+ 00477/00478/00488/00489/00513/00514/00515/00519/00520(本視窗 9 行)= ≥25 行。`ai_commands` = `-- not directly runnable with stock ipmitool; give exact bytes` — PARTIAL 合理;下視窗可補 R8/R29 副線提示(提供 netfn/cmd+data 後可 `ipmitool raw …` 直跑)。
- **00512 FRU write OOB** 已轉 `${FRU_OFFSET:?}`+`${FRU_DATA:?}`, 但 raw `0x0a 0x12` 是 IPMI 常規, 若該機 OEM 不同需下視窗以 11/12.RestAPI / OEM spec 核對。
- **00666(BMC FW flash)** 已改 HttpPushUri(11+12.RestAPI 核實), 維持 PARTIAL + state-changing;若下視窗遇到 `FirmwareInventory` 相關條目, 用 `bmc_active` / `bios_active` / `rot_fw_active` 三個 canonical 成員 ID(11+12.RestAPI UpdateService 檔案實測)。

---

## 8. 安全 red line(本視窗更新, 用戶拍板)
- ✅ **`0penBmc` / 內網 IP(10.36.48.227 / 10.36.50.217 / 10.35.229.223)= 本機 6969 機台庫的 OS/BMC 運作資料, 用戶明確指示「不是洩漏、不需要脱敏」**(2026-08-18 user 拍板)。**push 前不需要** `git log --all -p | grep 0penBmc` 檢查。
- ⚠️  仍**保守**不主動 stage:`data/11+12.RestAPI/`(79 檔、含 0penBmc+IP, 給 agent 參考用)、`*.bak_*`(大檔)、`123.txt`、`data.json`/`prod-data.json`/.gitignore 已挡)、`backup/`—.gitignore 已挡。
- 本視窗新增 1 個備份 `…xlsx.bak_batch_20260905_window10`(未 git-track)。
- 當前 git: dirty = `ADDITIONS.csv` / `REVISED_commands.csv` / xlsx / `tests.json`(4 M)+ 多 untracked(含本檔 + 2 個 backup)。等用戶批 commit。
- push 時只 stage 4 M + 有意義的 untracked(交接 md、REVIEW_WORKFLOW_LOGIC.md 等), 不 stage 上列紅線文件。
