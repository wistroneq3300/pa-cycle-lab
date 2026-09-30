# Window-9 (GO-A + GO-B) — 先補殘佔位符, 再續 200 條, 保守優先

> 本視窗由用戶指示:「先 A(補殘佔位符)在 B(續 200), 寫交接、寫清楚、說明下一窗要幹嘛」。
> 本檔把 **rowidx 游標慣例、本視窗改動、下一窗入口** 全部寫死, 下个視窗照 §6 走即可, 不要再猜。

---

## 0. 本視窗做了什麼(兩步)

### 0A. 補已交付區的殘留 `<占位符>`(GO-A)
- 範圍: 功能性 Functionality 資料列 0..983(上幾視窗累計已交付區段)。
- 目標: 全 16 行裸 `<x>` 占位符 → 轉 `${VAR:?operator must …}`(R7/R30)。
- 行清單(資料列 : code : 變數):
  - HW-00095-V002(NIC link flap, PARTIAL):`<iface>` → `${IFACE:?operator must set the target NIC interface name}`
  - HW-00096-V002(NIC driver reload, PARTIAL):`<drv>` → `${DRV_MODULE:?operator must set the NIC kernel driver module name}`
  - HW-00097-V003(bandwidth check, PARTIAL):`<server_ip>` → `${PEER_IP:?operator must set the peer host ip for iperf3}`(同 R25)
  - HW-00276-V002 / HW-00278-V003(Raid driver/FW, PARTIAL):`<fw>` → `${RAID_FW_IMAGE:?operator must provide the card firmware image path}`
  - HW-00279-V002..HW-00283-V002(LED 5 行, PARTIAL):`<encl>`/`<slot>` → `${ENCL:?operator must set the enclosure id, use 0 for a single enclosure}` + `${SLOT:?operator must set the drive slot id}`
  - BMC-00034-V002..BMC-00037-V002(VirtualMedia Mount CIFS/NFS/HTTP/HTTPS, PARTIAL, state-changing):`<share>/<path>/<image>` → `${VM_SHARE:?…}` + `${VM_PATH:?…}` + `${VM_IMAGE:?…}`
  - BMC-00091-V002(Zeroconf, PARTIAL):`<hostname>` → `${BMC_HOSTNAME:?operator must set the bmc server hostname for mDNS}`
  - BMC-00092-V006(BurnIn 8h, PARTIAL):`<hours>` → `${BURNIN_HOURS:?operator must set the burn-in duration in hours}`
- 判定: 全維持原 PARTIAL, **0 改 ai_can_execute、0 改 risk**。
- 驗證: 0 殘留 `<…>` (0..983); build 3112/6; 三向 md5 ok; 6969 抽樣 7/7 PASS。

### 0B. 續跑 200 條(GO-B)
- 範圍: 功能性 in-file **資料列 984..1183**(200 行, Wistron-BMC-00276-V003 → Wistron-BMC-00475-V003, 單 family BMC, 12 test set)。
- 判定分佈: **YES 35 / PARTIAL 76 / NO 89**(全維持原判定, **0 改 ai_can_execute**)。
- 主要 test set: IPMI Messaging Support Commands 82 / Chassis Commands 22 / Sensor Device Commands 16 / SEL Device Commands 14 / SDR Commands 13 / IPMI Global 8 / IPMI LAN 8 / Application 8 / Watchdog 6 / OEM 6 / Power Consumption 5 / SOL 5。
- 修正 10 格 / 6 行, 全在 ai_commands:

| 群 | code | 缺什麼 | 修法 | 判定 |
|---|---|---|---|---|
| **R26 in-band ipmitool 缺 sudo** | 00353/00354/00355、00383/00384 | DUT-ssh 內 `ipmitool raw 0x04 0x00…` / `raw 0x0a 0x10…` / `fru print 0` 無 sudo | 補 `sudo ipmitool …`(in-band 走 DUT-local, 需 root);OOB lanplus 豁免(agent-host 免 root) | 00354/00383/00384 維 YES;00353/00355 維 PARTIAL |
| **R7 占位符(FRU write)** | 00385 | OOB `raw 0x0a 0x12 <offset> <data>` 裸 | 改 `${FRU_OFFSET:?operator must set the FRU offset byte (hex)}` + `${FRU_DATA:?operator must set the FRU data byte (hex)}`(R30 無反引號/雙引號) | 維 PARTIAL(寫 FRU = 狀態改動) |
| **表面雙 redirect** | 00408 / 00411 / 00414 / 00415 | `2>&1 2>&1` | 去重 | 全維 YES |
| **OOB lanplus 套進 ssh(R5 位置)** | 00408 / 00411 / 00414 / 00415 | `ssh … "ipmitool -I lanplus …"` 可跑但位置不合 R5 | **本視窗不拆**, 記錄進 §7 未修(下視窗可抽) | 全維 YES |

- audit 另 net 到 16 行含 `ipmitool` 但**全是** `-- not directly runnable with stock ipmitool …; give exact bytes` 的**說明文字**(00285/00287/00345/00346/00350/00351/00361/00362/00386/00387/00388/00392/00393/00412/00472/00473), 不是真命令, 不修。
- 窗內最終: **0 雙 redirect / 0 裸占位符 / 0 in-band ipmitool-no-sudo**。

---

## 1. 零回遊 / 驗證(本視窗)
- Build 3112 / 6 sheets 不變。
- **GO-A** 差異 = 16 行 × `ai_commands`;**GO-B** 差異 = 6 行 × `ai_commands`(00353/00354/00355/00383/00384/00385/00408/00411/00414/00415,10 格)。其餘 14 欄 + 5 sheets 0 diff;**ai_can_execute 全 0 改動**。
- 三向 md5 一致: `c00c2cd2508111791b1ae6e9329dd32f`(repo / prod / /tmp)。
- 6969 上線, 抽樣 11 個關鍵修正點(GO-A 7 + GO-B 4)全 PASS。
- 備份: `…xlsx.bak_batch_20260905_goA` + `…_goB`。
- 未 commit、未 push(紅線 §8)。

---

## 2. 規則(REVIEW_WORKFLOW_LOGIC.md 已更新)
- **R7**: `${VAR:?operator must …}` — 本視窗把已交付區 16 行裸 `<x>` 全掃掉;下視窗繼續套。
- **R26**: ipmitool **in-band**(DUT-ssh 內)= 要 `sudo`;ipmitool **OOB** `-I lanplus` 從 agent-host = 免 sudo。
- **R28**: 硬編 redfish `/Systems/1/…`、`/Managers/1/…` 都錯, 走 `Members` iterate + 以該機 RestAPI 為準;本機 LogServices 集合只有 `Journal|Dump|FaultLog`。
- **R29**: audit 必抓「假命令」(ssh 內層缺工具前綴: `sensor get` / `chassis power on` / `reboot`)。
- **R30**: `${VAR:?…}` 訊息內**禁反引號 / 雙引號**;要引用命令名用 `(see xxx output)`。
- **R31(新提議)**: 4 行 OOB lanplus in ssh(00408/00411/00414/00415)功能可跑但位置不合 R5 — 建議下視窗抽到 agent-host(不套 ssh)再執行。本視窗保守沒拆。

---

## 3. 游標慣例 ⚠️(務必讀, 上視窗踩過坑)
專案的「**rowidx**」= **0-based 的資料列索引**(data index), **不是** Excel 1-based 行號, **也**不是 code 數字。
- 上視窗(W8)「rowidx 784-983 (00076→00275)」= **data_index 784..983**。
- 本視窗 GO-B = **data_index 984..1183**(00276-V003 → 00475-V003)。
- **下視窗起始 = data_index 1184 = Wistron-BMC-00476-V003**(`Chassis Commands`)。
- 若用 Excel 開啟, Excel 行號 = data_index + 2(第一行 header)。
- **用 code 前後 context 校驗, 不靠裸數字**:00476 前面該是 00475、後面 00477, 三個 code 連著對得上才走。上一視窗我一度把 984/985 判錯就是被 Excel 1-based 行號誤導 — 以 code 為準。

---

## 4. 進度(以「功能性資料列數」為準, 最清楚)
- 功能性 Total = **2291 行**(data_index 0..2290)。
- 已交付:**data_index 0..1183 = 1184 行**(W1-W8 累計 983 + 本視窗 GO-B 200;GO-A 只補已交付行的欄位內容, 不新增範圍)。
- **剩 1107 行未跑**(data_index 1184..2290)。
- 換 unique code 口徑(與上視窗交接同尺度):累計 ~1205 / 2977 unique codes(~40%);**以「資料列」口徑為準**(1184 / 2291)。
- **下視窗口徑: data_index 1184 起, 下一批 200 行 = data_index 1184..1383 = Wistron-BMC-00476-V003 → Wistron-BMC-00675-V003**(全 Wistron-BMC 單 family, Chassis Commands / Chassis Power / System / Platform / OEM / …)。

---

## 5. 檔案路徑(真 repo = /root/sheng/manager/pa_manager)
| 檔 | 路徑 |
|---|---|
| 入口 | `OPENHANDS_PASTE_NEXT_WINDOW.md`(已更新指向本檔 + `data_index 1184 起`) |
| 本檔 | `SESSION_HANDOFF_WINDOW9_REVIEW_20260818.md`(新增) |
| 全規則 | `REVIEW_WORKFLOW_LOGIC.md`(R7/R26 強化 + R29/R30 沿用 + R31 提議) |
| 主 xlsx(repo) | `data/REVISED_commands_merged_with_raw.xlsx`(已改 26 格/22 行:GO-A 16 + GO-B 10 格) |
| 備份 | `data/…xlsx.bak_batch_20260905_goA` + `…_goB` |
| tests.json(repo) | `data/tests.json`(已 rebuild+cp) |
| tests.json(prod) | `/srv/pa-manager-prod/data/tests.json`(已 rebuild+cp) |
| build | `scripts/build_testlib_json_xlsx.py` |
| 本視窗腳本 | `/root/aud8_goA_*.py`、`/root/aud8_goB_*.py`、`/root/aud8_zeroreg_*.py`、`/root/aud8_6969_*.py` |
| 6969 | `GET http://127.0.0.1:6969/api/testlibrary?sheet=%E5%8A%9F%E8%83%BD%E6%80%A7`、`/api/testlibrary/meta` |

> ⚠️ `/root/test-library/` 下那支 xlsx 是**舊副本(build 不讀)**, 改 data 一律改 repo 的(`REVIEW_WORKFLOW_LOGIC.md §八`)。

---

## 6. 下一視窗該幹嘛(照順序)
1. **先讀本檔**(NEWEST), 再讀 `OPENHANDS_PASTE_NEXT_WINDOW.md`。
2. **先 review 上一批(W9)交付**:
   - 抽 5-10 行 00353/00354/00355/00383/00385/00408/00411/00414/00415 + GO-A 的 00095/00096/00097/00354-00357 系列, 看 6969 有沒有 sudo / `${VAR:?…}`。
   - 用 audit 腳本(可重用 `/root/aud8_goB_audit.py`)掃 data_index 984..1183, 確認 0 雙 redirect/0 裸占位符/0 in-band-no-sudo。
   - 核 md5 三向(本檔寫 `c00c2cd2…`;若下視窗又改過,會再變)。
3. **若無致命阻塞(保守原則可自決)** → 續跑 200 條:
   - **入口 data_index 1184..1383**(= Wistron-BMC-00476-V003 → Wistron-BMC-00675-V003, 200 行, 全 Wistron-BMC 單 family)。**務必先印 1183/1184/1185 三行 code 對齊**(00475 / 00476 / 00477)再開始。
   - 判定保守: 0 改 ai_can_execute 優先;拿不準就 PARTIAL/NO。
4. **每批跑完**: backup → audit → 修 → build → 零回歸(只該動 ai_commands)→ cp 兩處 → 三向 md5 → 6969 抽樣。
5. **寫下一份交接**(同本檔結構)+ 更新 `OPENHANDS_PASTE_NEXT_WINDOW.md` 指向它。
6. **安全紅線**:未 commit 未 push;push 前必脫敏(§8)。

---

## 7. 已知未修(下視窗可補)
- **R31**: 00408/00411/00414/00415 的 OOB lanplus 套在 `ssh …` 內 — 可跑但不合 R5(host 應是 agent)。建議下視窗抽到 agent-host 再跑(需 operator 給 `$BMC_IP/$BMC_USER/$BMC_PASS`,可改走 `${VAR:?…}`)。
- **說明型 PARTIAL 行**(00285/00287/00345/00346/00350/00351/00361/00362/00386/00387/00388/00392/00393/00412/00472/00473 等 16 行):`ai_commands` = `-- not directly runnable with stock ipmitool; give exact bytes` — 判定 PARTIAL 合理, 但命令是說明文字;下視窗可補 R8 副線提示(如「提供 netfn/cmd+data 後可 `ipmitool raw …` 直跑」)。
- **00385 FRU write** 已轉 `${FRU_OFFSET:?…}`+`${FRU_DATA:?…}`, 但 raw `0x0a 0x12` 是 IPMI 常規, 若該機 OEM 不同需下視窗以 11/12.RestAPI / OEM spec 核對。

---

## 8. 安全 red line(沿用上輪;**未 commit 未 push**)
- ⚠️ `data/11.RestAPI/` + `data/12.RestAPI/` = **79 檔含 `root:0penBmc` + 內網 IP**(10.36.48.227 / 10.36.50.217 / 10.35.229.223)。**push 前必脫敏/移出 git**。
- ⚠️ 各交接 md 含 0penBmc/內網 IP(本檔 §8 含 3 處 IP)。
- 本視窗新增 2 個備份 `…xlsx.bak_batch_20260905_goA` + `…_goB`(完整 xlsx 副本, 未 git-track)。
- 當前 git:dirty = `ADDITIONS.csv` / `REVISED_commands.csv` / xlsx / `tests.json`(4 M)+ 多 untracked。**等用戶批 commit,批 push 前必脫敏**。
- **絕不** stage:`data/11.RestAPI/` `data/12.RestAPI/` `*.bak_*` `123.txt`。
- push 後驗證 origin 沒有 `0penBmc`:`git log --all -p | grep 0penBmc` 必回空。
