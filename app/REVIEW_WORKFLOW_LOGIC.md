# 測試庫逐條 REVIEW 邏輯（一條一條 review 的規則 + SOP）

> 這是「2977 條逐條 review、不套版」工作的**規則與決策記錄**，下一個對話視窗請先讀本檔。
> 目的：每條獨立判斷它的「主要阻塞類型」，決定 YES/PARTIAL/NO，並重寫可執行指令。
> 本檔記錄『怎麼判 + 已定的規則 + 已改的清單』，不是 code。

---

## 一、目標與範圍
- **2977 unique codes**（3112 行，其中 125 個 code 是一碼多行）逐條獨立 review。
- 每條**獨立判斷**，不套模板（同一張表會跑出 YES / PARTIAL / NO 三種不同結論）。
- 每條產出 5 個欄位的判定：
  `ai_can_execute`（YES/PARTIAL/NO）、`ai_commands`、`ai_packages_needed`、`ai_logs_output`、`risk`。
- 現況分佈（review 前，2025 snapshot）：YES 1062 / PARTIAL 1355 / NO 695（行數含一碼多行）。

## 二、Review 一條的 SOP（每條都走）
1. **定位 + 讀原資料**：拿 code 讀 `items`（標題，**以此為準**）/ `procedure`（舊人工步驟，作背景）/ `script`（gitlab 舊自動化腳本，作參考）/ 現有 `ai_commands`。
2. **判斷主要阻塞類型**（見三、4 種 archetype），想清楚「這條要跑成什麼、需要誰提供什麼、有沒有物理/破壊/授權障礙」。
3. **定 YES / PARTIAL / NO**（見五、判定原則）。
4. **改欄位**：`ai_commands`（可直接貼 shell 的指令，或 `-- not runnable by agent: 原因`）、`ai_packages_needed`、`ai_logs_output`、`risk`、`ai_can_execute`。
5. **落 data**：改 **repo 的** `data/REVISED_commands_merged_with_raw.xlsx`（見八、主來源警示）。
6. **build + 零回歸 + 上線**：build → 零回歸（只應差這一條）→ 覆蓋 prod → 6969 驗證 → 同步 `data/tests.json` 快照 → commit+push（視使用者要求）。
7. **記入本檔「已改清單」**（六）。

## 三、4 種阻塞 archetype（核心：不套版，先分類再下結論）
| 類型 | 例子 | 典型判定 | 理由 |
|---|---|---|---|
| **1. 資源/授權**（agent 取不到） | SPECcpu2017（授權軟體、`apt` 裝不了、要 user 提供 archive+binary+config）、要 user 提供的 driver/工具 | **PARTIAL**（需 user 提供）或 **NO** | agent 無法合法取得授權/proprietary 套件 |
| **2. 物理/硬體動作** | 過壓/欠壓（over/under voltage）、4-corner（需特定電壓+溫度條件）、AC/power cycle、插拔、故障注入、讀 blackbox 故障記錄 | **NO** | agent 沒有物理手、無法注入故障/調硬體條件 |
| **3. 破壊性 / 需指定非 OS 目標** | fio、dd wipe | **PARTIAL** | agent **不自己挑目標碟**；`FIO_TARGET` 由 user 指定「空/可清空測試卷」，**NEVER OS 碟/**/boot/使用中卷**；需確認 runtime |
| **4. 純軟體、只讀/安全** | `dmidecode`、`sensors`、`dmesg`、`stress-ng` 單線、讀 SMBIOS | **YES** | 安全、可直接跑；**需 root 的指令要加 `sudo`** |

## 四、已討論定的規則（從 00009 / 00149 學到）
- **判定 pass/fail 由「使用者」做；agent 只負責輸出 log/原始值**供 diff → 命令**不需要**內建 pass/fail 比對（例如 00149 不用做 reboot 前後比對，只要抓一次原始值）。
- **DUT_USER / DUT_PASS / DUT_IP**：由使用者在「目標機台」訊息補 OS 帳號密碼 → agent 用 `sshpass -p "$DUT_PASS" ssh $DUT_USER@$DUT_IP "..."` 變數形式即可，不用寫死。
- **需 root 權限的指令**（如 `dmidecode` 讀 `/dev/mem`）→ **要加 `sudo`**（`os_user` 不一定是 root）。
- **以 `items` 標題為準**，`procedure` 是舊人工作業單（留作參考，UI 已降級顯示為「原始手作業單」）。
- **fio 類**：`FIO_TARGET` 必須 user 指定空卷、`RUNTIME` 預設 60s（原 item 可能 43200s 需人工確認）、`bs=512`（bytes，非 512B/512b）。

## 五、YES / PARTIAL / NO 判定原則
- **YES** = 純軟體 + 安全 + agent 可一次貼上跑完並回 log。
- **PARTIAL** = 需 user 先提供/指定（授權軟體、指定測試目标、確認 runtime）；agent 把「待 user 填參數即可跑」的命令備好。
- **NO** = 物理/破壊/需人工手動（故障注入、插拔、調電壓溫度、讀 blackbox），agent 做不到 → 寫 `-- not runnable by agent: 原因`。
- **保守優先**：拿不准就 PARTIAL/NO，寧可少標 YES，不誤傷 OS 碟/物理硬體。

## 六、已改清單（review 記錄，逐條累积）
| code | sheet | 改動 | 判定 | 備註 |
|---|---|---|---|---|
| Wistron-Storage-00009/10/11/12/17/18/19/20-V003 | 相容性 | `ai_commands` 重寫成乾淨可執行 fio job：`FIO_TARGET` user 指定空卷、`RUNTIME` 預設 60s、heredoc 寫 job、NEVER OS 碟 | **PARTIAL** | items 筆誤已修；同一樣板複製的 8 條 |
| **Wistron-BIOS-00149-V006** | 功能性 | `ai_commands` 加 `sudo`（`sudo dmidecode -t 0`，dmidecode 需 root 讀 /dev/mem） | **YES** | 只讀 SMBIOS Type 0，非破壊；判定交 user（抓原始值即可） |
| **Wistron-HW-00015-V002** | 功能性 | 加 `sudo`（`sudo i3cdetect`） | **PARTIAL** | I3C CPU1，R26 os_user 非 root |
| **Wistron-HW-00049~00056**（8 條） | 功能性 | 加 `sudo`（`sudo i2cdetect`） | **PARTIAL** | CRPS Capability/PEC reporting，R26 |
| **Wistron-HW-00070-V004** | 功能性 | 加 `sudo`（`sudo ipmitool`） | **PARTIAL** | CRPS FW upgrade/downgrade，R26 |
| **Wistron-HW-00083~00088**（6 條） | 功能性 | 加 `sudo`（`sudo dmidecode -t memory`） | **YES** | RDIMM/3DS/MRDIMM/Slot/1DPC/Full memory，R26 |
| **Wistron-HW-00102-V003** | 功能性 | 加 `sudo`（`sudo ipmitool`） | **PARTIAL** | L10 Onboard power LED，R26 |
| **Wistron-HW-00103-V004** | 功能性 | 加 `sudo`（`sudo ipmitool`） | **PARTIAL** | L10 UID front+rear，R26 |
| **Wistron-HW-00113-V004** | 功能性 | `${FAN_DUTY:?operator must set fan duty (0x00=0% .. 0x64=100%)}` R7 強提示 + read-back | **PARTIAL** | Manually FAN speed control，R7 |
| **Wistron-HW-00116-V005** | 功能性 | `ipmitool -I lanplus sdr list` 移到 agent host；DUT 只跑 `sudo stress-ng --cpu` | **PARTIAL** | Fan speed change·power assume，R5 host-placement |
| **Wistron-HW-00213-V002** | 功能性 | `dd of=${USB_BENCH_TMP:?operator set a SCRATCH file, never OS/system disk}` R7 + R3 | **PARTIAL** | USB benchmark，R3/R7 |
| **Wistron-HW-00228-V002** | 功能性 | DUT `sudo dmidecode -t 3 | grep Size\|ROM` R26 加 sudo + dmesg 獨立 | **YES** | ROM Size，R26 |
| **Wistron-HW-00230-V002** | 功能性 | `ipmitool -I lanplus mc info` 移到 agent host，.bin 尺寸 operator 提供 | **PARTIAL** | BMC ROM Size，R5 |
| **Wistron-HW-00233-V004** | 功能性 | `ipmitool -I lanplus raw 0x30 0x22` 移到 agent host | **YES** | IPL Command（CPLD I2C），R5 |
| **Wistron-HW-00273-V003** | 功能性 | DUT `sudo storcli show all` R26 加 sudo | **YES** | Raid Card info，R26 |
| **Wistron-HW-00274-V002** | 功能性 | DUT `sudo storcli /c0 show` 同上 | **YES** | Raid function，R26 |
| **Wistron-HW-00263-V002 / 00264-V003 / 00265-V003**（3 條） | 功能性 | `ipmitool -I lanplus raw 0x3a 0x0e ...` 移到 agent host；LED 觀察改由 operator | **PARTIAL** | SSD LED (Present/Access/Busy/Locate)，R5 |
| **Wistron-HW-00287-V002 / 00288-V002 / 00289-V002 / 00290-V002 / 00291-V002**（5 條） | 功能性 | 同上 R5 | **PARTIAL** | HDD LED (Present/Access/Busy/Rebuild/Locate)，R5 |
| **Wistron-HW-00295-V002 / 00296-V002 / 00297-V002 / 00298-V002 / 00299-V002**（5 條） | 功能性 | 同上 R5 | **PARTIAL** | SAS/SATA LED (Present/Access/Busy/Rebuild/Locate)，R5 |
| **功能性 in-file rowidx 284-783**（500 行；HW-00301→BIOS-00003→BMC-00075 跨 3 family，60+ test set） | 功能性 | **R26 sudo x242**：DUT-ssh 內 `dmidecode` 221 + `ipmitool`(sdr/sel/sensor 讀) 20 + `ethtool` 2 漏 `sudo`；修：加 `sudo`（保留 `-t N` 參數 + grep pipeline）。**OOB lanplus 12 條自動豁免**（`-I lanplus -H "$BMC_IP"` 模式，agent-host 執行不需 root）。**R7 placeholder x12**：`Wistron-BMC-00039..00050-V002`（SNMP 類）裸 `<community>` / `<BMC_IP>` → `${SNMP_COMMUNITY:?operator must set SNMP community (v2c) or v3 creds}` + `"$BMC_IP"` | **YES 219 / PARTIAL 35**（0 改 ai_can_execute，全在 ai_commands 欄修內文） | 7 window 累計 808/2977 (27.1%)；build 3112/6 sheet 不變；零回遊 254 rows × ai_commands 一欄；6969 已生效 |
| **未改的判定** | 功能性 | 本批 135 NO + 272 YES + 93 PARTIAL 全維持原判定（保守優先）。**YES** = SMBIOS 209 條 read-only dmidecode + Firmware Inventory 讀取 + DCGM 讀 + UEFI shell 只讀 類；**PARTIAL** = UEFI Setup / BMC FW flash via Redfish (R6+R22+R27) / BIOS setting 改 / SNMP 設 community (需 operator 給 v2c/v3 憑證) / iperf peer (R25) / GPU stress 長時間 (R23)；**NO** = BIOS-RoT recovery corrupt reject (R8) / AC cycle / Firmware Recovery / UEFI 多步需 KVM | **NO 135 / PARTIAL 93 / YES 272** | 保守原則：拿不准 → 維原判定只改欄內容 |
| **功能性 in-file rowidx 784-983**（200 行；Wistron-BMC-00076-V003 → Wistron-BMC-00275-V003 單 family，15 test set：Sensor Page 38 / Inventory 33 / BMC Web 20 / BMC Networking 17 / Assert-DeAssert 15 / BMC Logs 10 / Operations 10 / LDAP 8 / BMC User Account 8 / …） | 功能性 | **R29 假命令修 42**：Sensor Page 38 行 `"sensor get 'X'"` 裸字面（漏 `ipmitool`，DUT 上會 `command not found`）→ 改 OOB `ipmitool -I lanplus ... sensor get 'X'`（R5，與相鄰 857-866 同款）；Chassis 4 行 `"chassis status/power on/soft/reset"` → OOB `ipmitool chassis ...` + `chassis status` read-back（980 讀取維 YES、981-983 維 PARTIAL+risk）+ 981-983 補 R19 BEFORE/AFTER + risk "STATE-CHANGING" 標。**830 redfish 硬編 `/Systems/1/LogServices/PlatformLog`** → canonical `Managers/bmc/LogServices{,/Journal|Dump|FaultLog,Entries}`（11/12.RestAPI 兩份核實），多服務名加 `//[]`+`2>/dev/null` 容錯（R18）。**836 NTP `Managers/1/NetworkProtocol` + 變數在 DUT 內未定義** → `Managers/bmc/NetworkProtocol` + 移 agent-host + `${NTP_SERVER:?...}`（R5+R7+R28）。**803 內層裸 `reboot`** → `sudo reboot`（R26）。**R7 佔位符修 12**：925-932 LDAP openbmctool `<connection>/<ldap_server>/<group>/<cert_file>`、938-940 IPMI account `<id>/<name>/<pwd>/<newname>/<level>`、914 VirtualMedia `$VIRTMEDIA_HOST` → `${VAR:?...}`（R30 訊息內避反引號）。**表面層 9**：`2>&1 2>&1`×8 行、curl 雙 `-k`×2 行（822/831）→ 去重 | **0 改 ai_can_execute**。全 200 行判定維持：YES 98 / PARTIAL 85 / NO 17。改動範圍=66 rows × (ai_commands 全修 + 部分 ai_logs_output/risk) | audit 抓到的 42 條假命令是上上批 template 殘骸（SMBIOS 大批量時遺留），本批已掃 200 條全乾淨；build 3112/6 sheet 不變；零回遊 66 rows × 三欄；md5 三對（repo tests.json + prod tests.json + /tmp）一致；6969 上線，6 個關鍵修正（00159/0122/0128/0273/0217/0230）6 spot-check 全 PASS，其中 0159（sensor OOB）+ 0122（LogServices canonical）+ 0217（LDAP_server 變數）是硬傷級別修復 |

### 00149 完整分析範例（供後續對照怎麼「不套版」想）
- **原始 procedure**：`Check the information of test item`（很籠統）→ 真正指令靠背景（test_set=SMBIOS）推 `dmidecode`。
- **我的**：`sshpass ... ssh ... "sudo dmidecode -t 0"`（SMBIOS Type 0 = BIOS Information，含 Vendor/BIOS Version/Release Date）。
- **分析結論**：✅ 工具對、只讀安全、YES 合理；⚠️ 缺口1 = 漏 `sudo`（**已修**）；⚠️ 缺口2 = criteria 要「reboot 後仍正確」但只拍一次快照（**依規則不用管**：判定交 user）；⚠️ 缺口3 = DUT 三變數（**依規則 user 補，OK**）。

## 七、UI 顯示邏輯（`assignTaskCopy()`，app.js ~3118）
- **4 區塊分層**（已上線，cache-bust `v=20260908c`）：
  1. `▶ 本次要跑的指令`（`┌─┐` 框框、可視化）
  2. `🔎 原始手作業單`（降級、標「留作參考，非本次要跑」）
  3. `✅ 判定標準`
- **YES** → 指令框；**PARTIAL** → 指令框 + 「需確認硬體/目标」；**NO** → 「▶ 參考指令」框（不可直接跑）。
- `collapseBlank`：收縮 2 個以上連續空行成 1 個；命令/流程/標準都保留單行換行。

## 八、主來源與 build（⚠️ 重要）
- **主來源 = repo 的** `/root/sheng/manager/pa_manager/data/REVISED_commands_merged_with_raw.xlsx`（build 讀這支）。
- ⚠️ `/root/test-library/REVISED_commands_merged_with_raw.xlsx` 是**另一份同內容檔案**（build 不讀它）；00149 我一度誤改到它、已還原。**改 data 一律改 repo 的**。
- build：`python3 scripts/build_testlib_json_xlsx.py data/REVISED_commands_merged_with_raw.xlsx /tmp/tests_new.json`
- 上線 SOP（§五，SESSION_HANDOFF_8FIO_MERGE_XLSX.md）：build → 零回歸 → `cp /tmp/tests_new.json /srv/pa-manager-prod/data/tests.json` → 6969 驗證（meta + code 過濾）→ 同步 `data/tests.json` 快照 → commit+push。

## 九、下一步（待使用者指示）
- [ ] 依二、SOP **逐條 review** 2977 條（先 pilot 一批跨 6 sheet、涵蓋 4 種 archetype，出「判定建議報告」給 user 勾，認可後再放大/並行）。
- [ ] commit+push 本 session 的 00149 + UI 排版改動（待 user 確認）。
- [ ] 每改一批都跑零回歸（只應差該批）+ 6969 驗證。

## 十、2026-09-04 補規則(第二輪,從 6 條隨機樣本抽出)

### R5. **命令運行位置統一 = agent host**
- 所有命令都**從 agent host(GPU AI server)跑**,需要 DUT 側工具時**穿透 `ssh`**(agent 與 DUT 同紅魚網域、可直連)。
- `ai_logs_output` **不再需要** 標 "agent-side/DUT-side"(位置固定)。
- 反例/注意: 00618 目前寫法是「ssh 進去後在 DUT 上 curl BMC」——**要改**成「agent host 上 curl $BMC_IP」(DUT 只當 ssh 跳板或不需要)。

### R6. **破壞性/影響生產的命令一律不自動跑**(含 Link Flap、fio、BIOS/fw update、USB hotplug、ip link down 等)
- 這些就算 agent **有能力**寫出可跑的 bash,**也統一不自動化**。
- 命令在 `ai_commands` 仍可寫出(作為「如果 operator 決定要跑,長這樣」的參照),但**執行要 operator 明確同意並現場監督**(agent 不自己觸發)。
- 這套規則覆蓋 R1(判定)、覆蓋 R3(命令格式): 這類 case **預設 ai_can_execute=PARTIAL**,即使命令本身是可跑的。
- **例外**: 純讀的 case(00149 dmidecode、00618 redfish GET 等)不受影響,仍 YES。

### R7. **PARTIAL 的「可執行命令」= 真正的 bash,用 `${VAR:?user must set ...}` 強提示缺的變數**
- **不再**用 `-- 說明 + 命令` 的混寫(那是上一代遺留的樣板)。
- 缺的變數用 `${DUT_NIC:?pick a NON-admin NIC}` 強提示,像 00009 的 `FIO_TARGET` 那套。
- **目前符合此模式的候選**: 666 條 PARTIAL 是「`-- 說明` + shell 命令」混寫(已出報告,待逐條改)。
- 但 R6 優先: 即使符合 R7 的 bash 形式,若屬「破壞性/影響生產」,仍標 PARTIAL、不自動跑。

### R8. **「嚴守 spec 原路徑」為主,但要在 ai_logs_output 附帶提示其它通道**
- spec 寫 "via serial" → 主判定 **NO**(agent 插不了實體線)。
- 但 **`ai_logs_output` 要提一句**:「另外, Wistron 多數機台也可走 Redfish/BMC 刷 BIOS(如 `/redfish/v1/UpdateService/update`),可作備用參考」。
- **前提規則**: 所有目標 server 都是 Linux,80% 是 Ubuntu(影響命令/包管理器的選法)。
- **不**: 把「能走另一條路」當理由把 NO 升級成 PARTIAL/YES——因為**這條的意義是測「這條路徑」本身**(如同 00009 是測「fio 能不能寫 NVMe」不是測「NVMe 有沒有壞」)。

### R9. 補上:「spec 意義」vs「達成目的」的判斷準則
- 若**spec 的「路徑/工具/條件」本身就是被測對象**(serial 通道、4-corner 條件、fio 寫入)→ 以 spec 為準。
- 若 spec 的**目的是「達到結果」**, 工具只是手段(如"confirm CPU count", tools: 無特定指定) → 可以挑 agent 覺得最合適的工具(`lscpu` 或 `dmidecode` 或 `ipmitool`)。
- 這類 case 要 **review 時逐條判** — 見 R10。

### R10. **逐條 review 的 4 個必問問題**(每條 review 前都要過一遍)
1. **這是「測 spec 指定的路徑/工具/條件」還是「達成某目的」?** (R9)
2. **命令是純讀 or 破壞/改變狀態?** (R6: 後者一律 PARTIAL 不自動跑)
3. **命令缺的變數, 誰提供?** (R7: 用 `${VAR:?...}` 強提示)
4. **spec 要求的路徑, 我認識另一條路能達成嗎?** (R8: 有就**提示**, 但**不升判定**)

### R11. (補) **同一測試可能對應多條 redfish 路徑/多重資源** — 命令要**能列出所有**, 不要硬編一個
- 反面教材: 00618 硬編 `/redfish/v1/Systems/1/Processors/CPU0`, 多 CPU 就漏; 應先 `GET .../Members` 拿清單, 再逐個 GET。
- 這類 case 要特別檢查「有沒有 list 接口」, 用 list 接口再 iterate。

## 十一、2026-09-04 第三輪邊界(Q5/Q6/Q7 拍板 + RAS/NVIDIA 提示)

### R12. **operator 先動手、agent 只讀證據 → PARTIAL**
- 例子:00123 Fan Fail(先弄壞風扇→讀 SEL)、00128 USB Hot-Plug(先插拔→讀 dmesg/lsusb)、故障注入類。
- **判定 = PARTIAL**(不是 NO):agent 的「**讀取證據**」部分是可跑的,命令寫成「**operator 做完 X 後**跑這條抓 log」。
- `ai_commands` = 可執行 bash(讀證據那步);`ai_logs_output` 標明「**需 operator 先完成物理動作 X**」。
- 這類**不**歸入 R6(不自動跑),因為 agent 本身**不觸發**物理動作,只讀取 → 可以自動跑「讀取」那半段。

### R13. **apt 裝不到的工具 → `${TOOL_PATH:?operator 提供套件路徑}` + packages 註明「授權/專屬、需 operator 提供」 → PARTIAL**
- 建**白名單**(已知 apt 裝不到的):

  **✅ apt 裝得到（Ubuntu 24.04 已核實）→ 正常命令 apt install**：
  dmidecode、stress-ng、iperf3、rasdaemon、smartmontools、ipmitool、lshw、pciutils(lspci)、iproute2(ip)、curl、jq

  **❌ apt 裝不到（真白名單 → operator 提供 / 廠商專屬）：**
  - **RAID/HBA 控制器工具**：`storcli`(Broadcom MegaRAID)、`sas3ircu`(LSI SAS)、`ssacli`(Microsemi SAS)、`megaraid` — 都要從原廠網站下
  - **AMD 專屬**：`amdsst`（AMD System Stress Test）、AMD 專屬 RAS 套件
  - **NVIDIA DCGM**：`dcgmi`（要 NVIDIA repo；**可自裝**，不屬 operator 提供）
  - **I3C bus**：`i3c-tools`（不在標準 repo）
  - **授權軟體**：SPEC CPU (SPECCPU2017)、SPECpower
  - **固件映像**：PSU FW image、BIOS image、BMC image（需 operator 提供對應機型檔案）
  - **NVIDIA driver/CUDA**：官方 deb/rpm 可自裝（URL: https://developer.nvidia.com/cuda-downloads?target_os=Linux&target_arch=x86_64&Distribution=Ubuntu&target_version=22.04&target_type=deb_local）→ agent 有能力自己找並安裝，**不屬 operator 提供**
  - 註：`mcelog` 在 Ubuntu 24.04 已由 `rasdaemon` 取代（換工具，不算「裝不到」）

  **⚠️ 此白名單以 Ubuntu 24.04 noble 實際 `apt-cache search` 核實為準**（不是猜），每遇新工具先 search 確認再決定歸哪類。
- 白名單**會越列越長**,每遇一個新工具就補進本節;review 前先查此清單。
- **重要**:R13 不與 R6 衝突 —— 若該工具「**執行**」時是破坏性(如 AMDSST 滿載壓力、firmware flash),**仍**標 PARTIAL 不自動跑(R6 優先);若該工具只是「查狀態」(如 NVIDIA `nvidia-smi` 讀取),可 YES。

### R14. **同一 sheet 內同一 SMBIOS type 拆 N 行 → 允許重複命令**(A 方案)
> 補充:**跨 sheet 的同一 code** 是另一回事 → 見 R20
- 00149 系列(如 `-t 0/17/memory` 拆成 Vendor/Serial/Size/Speed... 多測項)→ **每測項獨立命令、獨立 log、獨立判定**,允許重複 `dmidecode -t X`。
- 理由:使用者「自己慢慢看」更清楚,判定逐個可勾選;**不**做合併(工程量大、打破一碼對一指令)。
- 副作用:`dmidecode -t memory` 現庫已重複 10 次、`-t 17` 又一堆,review 時**保留重複**(不用去重)。

### R15. **RAS (Reliability, Availability, Serviceability) 測試** — 補充
- RAS 大部分**要工具**:AMD RAS(AMDSST/AMD 專屬)、Intel RAS(`rasdaemon` + 特定 MCA plugin + MSR 工具)、NVIDIA GPU RAS(ECC/error counting via `nvidia-smi` / DCGM)。
- **NVIDIA driver/CUDA 可自裝**: Ubuntu + x86_64 + deb/rpm,從 CUDA downloads 頁挑對應版本 → agent **可自動**安裝(不算 R13 的「operator 提供」)。
- RAS 類**判定**:
  - 讀取/ECC 狀態(`nvidia-smi -q -d ECC`、`rasdaemon` 讀 log)→ 純讀 → **YES**
  - 需觸發 / 需專屬工具執行 → **PARTIAL**(工具)或 **NO**(需物理)
- review 到 RAS 條目時先問:① 這台是 AMD/Intel/NVIDIA? ② 要「讀」還是「跑壓力」? ③ 工具是否已在 R13 白名單?

### R16. **命令執行環境的通用假設**(review 時直接套,不用回頭問)
- 所有目標 server = **Linux,80% Ubuntu**(+20% 其它 EL/Debian 系)。
- 命令假設 bash + coreutils + `sudo`(若需 root);`apt` 作為主要包管理器,EL 系換 `yum/dnf`。
- Redfish 網域 **agent 可直連**(不用跳 DUT);DUT 側 OS 工具用 `ssh` 穿透。
- 時區/語言: 命令輸出假設英文;log 檔 UTF-8。

## 十二、2026-09-04 第四輪（Q8~Q12 拍板）

### R17. **Redfish 多機器層 → 先 `GET .../Members` 拿 ID 再 iterate；具體 ID 寫「請參考 BMC SPEC/機型 handoff」**
- 00618 這種 `/redfish/v1/Systems/1/Processors/CPU0` → 改成：
  ```bash
  SYS=$(curl -sk -u "$BMC_USER:$BMC_PASS" "https://$BMC_IP/redfish/v1/Systems/Members" \
        | jq -r '.Members[0].@odata.id' | xargs basename)
  curl -sk -u "$BMC_USER:$BMC_PASS" "https://$BMC_IP/redfish/v1/Systems/$SYS/Processors"
  ```
- **注意**：每機台 BMC 路徑/ID 可能不同 → `ai_logs_output` 標「**系統/處理器 ID 以該機 BMC SPEC 為準**」。BIOS 類也同理。
- **R11 升級**：不只 iterate Members，還要把「路徑可能因機型而異」這個提示**寫進 ai_logs_output**。

### R18. **硬件缺失 → 命令照跑，輸出「找不到」，让 user 自己判 N/A**（A）
- 例：`PCIe slot check (x16 on slot 1 to 10)` 但機台只有 4 槽 → 照跑、`lspci` 會顯示「slot 5-10 無裝置」→ user 判 N/A 或 PASS。
- **不**做 pre-check 跳過；**不**標 NO。
- 命令裡用 2>/dev/null 吞 stderr，避免 log 噪音。

### R19. **before/after 雙 snapshot → agent 負責拍兩張**（A）
- 例 Driver reload、Link Flap、FW upgrade、stress 前後 dmesg。
- `ai_commands` 要包含：
  1. `echo "=== BEFORE ===" && <command> > /tmp/<code>_before.log 2>&1`
  2. `<action>`（reload/flap/upgrade）
  3. `echo "=== AFTER ===" && <command> > /tmp/<code>_after.log 2>&1`
  4. `echo "=== DIFF ===" && diff /tmp/<code>_before.log /tmp/<code>_after.log`
- user 只判「diff 裡的變化是否符合預期」，**不用自己記 before**。

### R20. **同一 code 跨多 sheet → 每 sheet 獨立 review**（B）
- 同一 `Wistron-HW-00080-V003`（CPU stress）可能同時出現在「功能性」和「效能/性能」兩張 sheet → **兩處獨立**（因為 sheet 的判定視角不同：功能性=「能不能跑通」、效能=「跑多快」）。
- 同一 code 跨 sheet 的 `ai_commands` **可以不一樣**（例如功能性只需一次 stress、效能可能要 3 次 + 取平均）。
- 但**同一 sheet 同一 code 的多行**(如 `-t memory` 10 行) → 依 R14 **允許重複**。

### R21. **log 存 DUT 本地，`ai_logs_output` 必須給完整路徑**
- 格式：`/var/log/<code>_<timestamp>.log`（或 `/var/log/pa-manager/<code>_<timestamp>.log`，看 user 偏好）。
- **不**存 agent host（agent 是 GPU server，不應累積 DUT 產物）。
- `ai_logs_output` 最後一句要寫：`Log saved to: /var/log/<code>_<timestamp>.log`，让 user 知道去哪找。
- **timestamp 格式**：`%Y%m%d_%H%M%S`（如 `20260904_192500`）。
- **清理**：不自動清；user 自行決定保留時間。

## 十三、2026-09-04 第五輪（Q13~Q18 拍板）

### R22. **reboot / AC cycle（472 條）→ agent 可跑，但『跑前』必須先問 operator**
- agent **可以**自己下 `sudo reboot` 並輪詢 ping 等回來，但**執行前要先問 operator**：① 可不可由 agent 觸發 reboot？② reboot 前後要各抓哪些資料？③ 回來時間預判（30s~2min）？
- 這類**屬 R6（影響生產）** → `ai_can_execute=PARTIAL`，`ai_logs_output` 標「**需 operator 同意後才觸發 reboot**」。
- 命令結構：`BEFORE 快照 → 問 operator → sudo reboot → ping 輪詢 → AFTER 快照`（R19 的 before/after 在此適用）。

### R23. **長時間(>72h, 194 條)→ 分兩段，跑前先問**
- **≤12h**：命令預設跑 60s sanity 快測 + `ai_logs_output` 標「原 spec X 小時；要跑完整時長請 operator 確認」。**跑 60s 前也要先問 operator「是否先跑 60s 確認沒問題」**。
- **>12h**：**一律先問 operator 才跑**（不預設啟動），`RUNTIME="${RUNTIME:-60}"` 保底，spec 時長寫在 `ai_logs_output`/`risk`。
- 這類命令**都**標 PARTIAL（需 operator 確認時長 + 現場監督）。

### R24. **OS / BMC 的 IP + 帳號 + 密碼都是公開的，可從 6969 機器庫撈 + operator 補充**（C）
- **6969 API 為第一來源**：`GET /api/machines/{name}` → `os_ip/os_user/os_pass` + `bmc_ip/bmc_user/bmc_pass`。
- 6969 缺的欄位（如部分機台 `bmc_user/pass` 空）→ 才問 operator 補。
- **命令用 `${DUT_IP} ${DUT_USER} ${DUT_PASS} ${BMC_IP} ${BMC_USER} ${BMC_PASS}` 變數**，來源標「6969 /api/machines/{name}」。
- **⚠️ 安全**：實際帳密值**不寫進任何 MD/commit**；只在執行時從 6969 或 operator 取得。

### R25. **peer / second host（23 條）→ operator 給 `$PEER_IP`**（A）
- `${PEER_IP:?operator 需提供對端 host}`；peer 的**選擇是有意的**（測哪對 host），agent **不自己挑**。
- review 時這 23 條 → PARTIAL（需 operator 提供對端）。

### R26. **sudo：依 `os_user` 判斷**（C）
- `os_user == root` → **不加 sudo**；`os_user != root` → **加 sudo**。
- 判定來源：6969 `/api/machines/{name}.os_user`。
- 修正 00149：若該機 `os_user=root`，`sudo dmidecode` 的 `sudo` 可去（但保留也無害，先維持加 sudo 安全一致）。

### R27. **BMC Redfish：`curl -s -k -u`**（A，跳 TLS 驗證）
> **canonical 路徑參考 = 兩份**：`data/11.RestAPI/`（BMC=10.36.48.227）+ `data/12.RestAPI/`（NS=BMC 10.36.50.217，folder 命名略異：Processors/system/Bios/Chassis/BMCFWupdate）。兩份**互相印證路徑一致**，視為 Wistron/OpenBMC 標準路徑。review redfish case 前**兩份都查**；folder 對照：Processor(11)↔Processors(12)、System(11)↔system(12)、BMCupdate(11)↔BMCFWupdate(12) 等。
  （Wistron 實際測過的 redfish 命令 + 回應 JSON，按 Service 分資料夾：Processor/Memory/System/Bios/Chassis/UpdateService/Account...；**11 + 12 兩份都查**）。
  - **重要真實路徑**（review 時以這份為準，**case 內指令不一定對**）：
    - Service root: `https://<bmc>/redfish/v1/`
    - System: `/redfish/v1/Systems/system`（**小寫 `system`**，不是 `1`！）
    - Processors: `/redfish/v1/Systems/system/Processors`（先拿 Collection→Members→個別）
    - Memory: `/redfish/v1/Systems/system/Memory`
  - review 任何 redfish case 前**先查 `11.RestAPI/<Service>/` + `12.RestAPI/<Service>/`** 對應的真實命令 + 路徑（不一致時以該機 BMC SPEC 為準並標註）。
- `ai_logs_output` 標「跳過 TLS 驗證（BMC 自簽憑證）」。
- 帳密：`-u "$BMC_USER:$BMC_PASS"`（來源 6969，**不硬編實際值**）。

### R28. **review 前必查：redfish case → 先看 `11` + `12.RestAPI/`；命令與此衝突時以這**兩份**真實路徑為準**
- case 內原本的 redfish 指令**可能路徑錯**（如 00618 用 `Systems/1`，實為 `Systems/system`）→ review 時**以 `11`/`12.RestAPI` 的真實路徑修正**。
- 這比 R9「嚴守 spec 路徑」**優先級更高**：因為 spec 的「路徑/命令」若寫法過時，要用「已知正確的 redfish 命令」取代，目的仍是完成該測項。
- **Batch-200 補充（20260905 window-8, rowidx 784-983）**：11/12.RestAPI 已核實 `Managers/bmc/LogServices{,/Journal|Dump|FaultLog,Entries}` 與 `Managers/bmc/NetworkProtocol`（NTP 在該路徑 `.NTP.NTPServers`）。**LogServices 集合在本機台只有 Journal/Dump/FaultLog 三個**→ 命令裡多服務名（SEL/EventLog/PlatformLog/...）用 `// []` + `2>/dev/null` 容錯（R18 精神：找不到就空、user 判 N/A），別 404 報錯。

### R29. **audit 時抓「假命令」(bare sub-command)**
- review/audit 時必抓：`ssh ... "bare-word ..."` 內層缺工具前綴（例：`"sensor get 'X'"` 漏 `ipmitool`、`"chassis power on"` 漏 `ipmitool`、`"reboot"` 漏 `sudo`）。這類行在 DUT 上直接 `command not found`，是上一輪批量改動遺留的 template 殘骸。
- 抓法：regex 抽 `ssh ... $DUT_USER@$DUT_IP "INNER"` 的 INNER，看開頭 token 是否在 known-tools 白名單（ipmitool/sudo/avahi-browse/curl/bash/cat/ls/echo/grep/lscpu/...）；不在→標記。
- 修法：sensor/chassis 類全走 OOB lanplus（R5 agent-host 執行，免 sudo）；DUT-local 類補 `sudo`（R26）。

### R30. **`${VAR:?user must ...}` 訊息裡禁放反引號 / 雙引號**
- 938-940 踩坑：訊息寫 「numeric from `user list`」→ bash 會把反引號當 command substitution 執行 `user list`，直接崩。
- 規則：`:?` 訊息內**只用單字和冒號**，要引用命令名用「(see user list output)」。整個訊息若含 `${...}` 巢式（`${BMC_CONN:?...${BMC_USER}:${BMC_IP}...}`）是合法的（bash 允許 `:?` 內再展開變數），但要保證**沒有反引號/雙引號**。

## 十四、第十六輪(2026-09-05,review 終點重構：R31~R40)

> 本輪是**終點定義變更**，R1~R30 是「format proxy」(命令格式/工具/路徑),本輪補上真目標——
> **貼給 operator 的指令,operator 一看就知道: 測什麼 / 在哪跑 / 要我給什麼 / 跑完去哪判 / 破壊時我在哪停 / 回報長什麼樣**。
> 不零變數即可貼,而是**資訊完整度**達標。

> ### ⭐ 已由 operator 確認的核心模型(2026-09-05, 新視窗第一件事抓這個)
> **6969/UI = 派工單 · OpenHands(agent) = 執行者 · operator = 判定者。**
> review 的終點 = **6969 上按「指派」, 把測項丟給 OpenHands, agent 看得懂 / 能跑的跑 / 不能跑的明確說要啥 / 跑完回報, 不越界。PASS/FAIL 永遠 operator 判。**
>
> **三態指派語義(agent 拿到後怎麼做):**
> | 6969 UI 狀態 | agent 動作 | 對應欄 |
> |---|---|---|
> | **可自動執行 (READY)** | 直接跑 → 抓 raw → 回報(只陳述事實, 不判 PASS/FAIL) | `ai_can=YES` / READ 邊界 |
> | **需前置 (NEEDS-OP)** | **清楚明列**要啥: 套件(哪些 apt 裝得到 / 哪些要 operator 給)、變數(6969 撈或 operator 補)、目標卷/對端/時長、operator approve 點。**不猜、不硬跑** | `ai_can=PARTIAL` + `ai_packages_needed` + `ai_commands` 的 `${VAR:?}` |
> | **無法自動 (NO / PHYSICAL)** | UI 上就**明確顯示「無法自動執行 + 原因」**(物理插拔 / over-voltage / 需 operator 現場);**不貼假可執行 bash** | `ai_can=NO` |
> | operator 額外貼 spec | 才**另外**做 spec-vs-raw 比對 + 給觀察;**判定仍是 operator** | — (額外動作, 非預設) |
>
> **agent 的邊界(不可做):** ① 不判 PASS/FAIL(只陳述事實+貼 raw+給 operator 一句話 criteria 提示); ② 不自動升級邊界(READ→WRITE / WRITE→DESTROY 要 operator 明確 approve); ③ 不猜 目標卷/對端/時長(用 `${VAR:?operator ...}` 強提示); ④ 不套版(每條獨立判, 非「命中 regex 就改」); ⑤ 白名單外的套件/授權**不臆造命令**, 明確標「operator 提供」。
>
> **5 欄 → 6969 UI 視角映射(現行架構對得上):**
> `ai_can_execute`(YES/PARTIAL/NO) → 6969 三態(可自動/需前置/無法自動); `ai_commands` → 指派貼給 agent 的 bash(要自帶 R31 5 段); `ai_packages_needed` → 需前置類**明列**缺的套件(白名單內 apt / 白名單外 operator 給, **兩類分開寫**); `ai_logs_output` → raw 長啥樣 + log 去路 + **operator 判的 criteria**(agent 不判); `risk` → 執行邊界(READ/STATE/WRITE/DESTROY/PHYSICAL)+ rollback。
>
> → R31~R40 不是新規則, 是把以上「6969 → agent → operator」這條鏈**寫清楚**讓三邊不模糊。

### R31. review 的真正終點 = 「5 段資訊完整度」(取代"命令格式"作驗收指標)

貼給 operator 的「▶ 本次要跑的指令」區塊,一條測項要**自帶**以下 5 段(順序固定、缺一段=KEEP 並標缺哪項):

| # | 段 | 內容 | 例 |
|---|---|---|---|
| 1 | 🎯 **目的** | 一句話: 測什麼 / 抓哪幾個 raw 值給 operator 判 | 「讀 DUT DMAR table (IOMMU), 抓 IOMMU mode + 裝置清單」 |
| 2 | 📥 **需 operator 提供的變數** | 表格: 變數名 / 來源(6969/你) / 期望型/範圍 / 怎麼填 | 見 R35 格式 |
| 3 | ▶ **指令** | bash + 頭註解(R32) + 變數 `:?` 提示 | — |
| 4 | 📤 **產出人** | 預期 raw 輸出長啥樣(≤20 行範例或結構描述) + `Log saved to: /var/log/<code>_<ts>.log` | 「IOMMU=enabled / dmar 行 3~5 條」 |
| 5 | 🚧 **判斷閘** | READ/STATE/WRITE/DESTROY/PHYSICAL + rollback 路徑 + **agent 在哪個 step 停下來問** | 「WRITE: 執行前 ask operator, rollback = revert 到 .bak」 |

### R32. **命令頭註解(每貼出命令區塊最上面一行)**

```bash
# 🎯 <code> | <測什麼一句話> | <抓哪個/哪些 raw 值> | <在哪: agent-host / DUT / Redfish / 物理> | <判定由 operator 完成>
```
operator 掃一眼就懂,不需翻 ai_logs_output。

### R33. **執行邊界 5 類 → 對應的 operator 閘**

| 類別 | 動作 | 閘位 |
|---|---|---|
| **READ** | 純讀(不改變任何狀態) | 無閘,agent 自動跑 |
| **STATE** | 改 state 但**可逆**(fan/led/iommu toggle) | **執行前 ask** + rollback 寫明 |
| **WRITE** | 寫 config 需重啟/需 operator 確認 | **執行前 ask** + rollback 寫明 |
| **DESTROY** | wipe / flash / unbootable | **執行前 ask** + operator 確認目標 + **明確 rollback 路徑** |
| **PHYSICAL** | 插拔 / 換 PSU / overvoltage | **agent 不跑**; operator 做完我給「事後證據讀取命令包」 |

> R6「破壊不自動跑」升級為 5 類精確閘。R22(reboot ask)→ STATE/WRITE 位。

### R34. **每條 review 必產出 5 段**(取代舊「ai_* 五欄」貼出結構)

UI 側可將 5 段渲染成 5 個卡片(取代目前「▶指令/🔎手作業單/✅判定標準」3 區塊)。
`ai_can_execute`/`risk`/`ai_logs_output`/`ai_packages_needed` 保留(是資料庫欄位);
**5 段是「貼給 operator 視角的」渲染格式**(可從 4 欄 + items + procedure 組合算出),不改 xlsx。

### R35. **變數表標準格式**

```
| 變數         | 來源        | 期望型/範圍         | 怎麼填 |
|--------------|-------------|---------------------|------|
| FIO_TARGET   | 你(選空 NVMe) | /dev/nvmeXnY 或 /dev/sdX  | 選一塊你確定可 wipes 的卷; NEVER OS/boot/使用中 |
| RUNTIME      | 你 / 預設 60    | 60..43200 秒          | 60 = sanity 快測; 完整時長 43200 |
```

規則:
- 每一個 `${VAR:?...}` 都必須在此表出現,訊息(R30)只放一句話提示,細節在表。
- 來源 6969 的欄(R24: DUT_IP/USER/PASS/BMC_*)在表格裡寫「6969 撈」即可,不需 operator 再給。
- 表放在 ▶ 指令**之前**,operator 先補再執行。

### R36. **agent 回報 operator 的標準格式**(跑完)

```
✅ <code> <測什麼> 跑完  ·  <wall time>
📊 Raw(貼回 ≤ 20 行, 剩餘在 log):
   <raw>
🔍 我(openhands)的觀察(只陳述事實, 不判 PASS/FAIL):
   <事實 1>
   <事實 2>
👉 你要做的判斷(依 ai_logs_output criteria):
   <一句話>
📤 Log saved to: /var/log/<code>_<ts>.log
```
- **agent 只陳述事實**,不給 PASS/FAIL(R10 精神: 判定 operator 做)。
- Raw 貼回若超過 20 行,只貼頭尾 + 「…(剩餘在 log)」。

### R37. **3000 條再跑: 3 層跑法**

| 層 | 範圍 | 工具 | 產物 | 何時 |
|---|---|---|---|---|
| **L1 靜態** | 3000 全 | 本 agent + R31~R36 | 每條 verdict 報告(🎯/📥/▶/📤/🚧 5 段) | 純 review,不需真機 |
| **L2 live READ** | operator 指定 1~5 台 SIT 機 | 真機 | raw 輸出 + 6969 變數解得出 + redfish 路徑通 | operator 拍板後 |
| **L3 operator 監督** | STATE/WRITE/DESTROY 抽選 | 真機 + operator 現場 | 每 step operator approve | 一批一批 |

**L1 輸出格式**: markdown 逐條(🎯/📥/▶/📤/🚧 5 段)+ 頂部 verdict(READY / NEEDS-OP / PHYSICAL / UNRESOLVED)。
報告檔: `review_round_NN_<scope>.md` 放 repo 根(不進 data/, 避免 build 誤讀)。

### R38. **READY 三態(貼出時的分層, 與 ai_can_execute 正交)**

| 態 | 意思 | 例 |
|---|---|---|
| **READY** | operator 只需**填變數**(可全在 6969 撈)→ agent 能跑 | `sudo dmidecode -t N` |
| **NEEDS-OP** | 除變數, 還有 **operator 判斷**(目標卷/對端/時長/同意 STATE/WRITE/DESTROY) | fio / reboot / stress |
| **PHYSICAL** | agent 不跑; operator 做完, agent 給「事後證據讀取命令包」 | 插拔 / 換 PSU / overvoltage |
| **UNRESOLVED** | 5 段任一缺、或 8 問任一無法答 | R39 KEEP 類 |

`ai_can_execute`(YES/PARTIAL/NO)保留作「執行能力」,與 READY 三態**並存但不重疊**。
READY 態是「**貼出視角**」(operator 拿到時的狀態),由 L1 review 產出。

### R39. **KEEP 條件(不是 "過 regex 就改", 是 "8 問任一缺")**

8 問(見 §十五 Q1..Q8)全過才算達標。任一問有缺 → **KEEP 現狀並明確標出缺哪問**(不強改),讓 operator 決定「補 or 留」。
反例(不要): 看到 `2>&1 2>&1` 就無腦去重(可能語意正確)。
正例(要): 5 段中「📤 產出人」段缺失 → 標「缺 U5: 無預期 raw 格式」,KEEP。

### R40. **audit = 8 問逐條過, 不是盲跑 regex**

- 每條獨立推, 出「🎯/📥/▶/📤/🚧 5 段 + READY 態」的 verdict 報告。
- 報告**不進** repo data/(避免 build 誤讀 + 避免污染 md5 三向校驗)。
- 報告 = operator 的「挑單」, operator 挑完才決定是否改 xlsx。

## 十五、1 條測項要達標的 8 個必答問題(Q1..Q8)

| # | 問題 | 對應 5 段 | 缺了會怎樣 |
|---|---|---|---|
| **Q1** | 測什麼 — 抓什麼 raw 值給 operator 判? | 🎯 目的 | 跑完 operator 不知拿什麼比 |
| **Q2** | 從哪取證據 — DUT OS / BMC OOB / Redfish / KVM / 物理? | 🚧 判斷閘 | 位置錯 = 跑錯目標 |
| **Q3** | 在哪台機跑 + `DUT_IP/BMC_IP` 怎麼解? | 📥 變數表 | 不知從 6969 哪台撈 |
| **Q4** | 執行時機 — 單次 / 循環 / operator 先做 X / before-after 兩拍? | 🚧 判斷閘 | 拍一次漏判 |
| **Q5** | 跑完看什麼 — 具體 raw 格式或 log 路徑? | 📤 產出人 | operator 無從對答 |
| **Q6** | 要 operator 提供什麼 — 具體變數清單 + 每個值長啥樣? | 📥 變數表 | 貼上立刻卡 |
| **Q7** | 我拿 raw 後怎麼回報? | (R36 固定格式) | 無閉環 |
| **Q8** | 若 狀態-改/破壊: 我在哪 step 停下來問 operator? rollback 路徑? | 🚧 + 📥 | 誤觸生產 |

→ **review 一條 = 逐一核 8 問 → 產出 5 段 → 定 READY 態**。8 問任一無法答 → KEEP(R39)。

## 十六、3000 條再跑方案(待 operator 拍板)

1. **L1 靜態 review**: 全 3000 條逐條出「5 段 + 8 問 + READY 態」報告, 不進 repo data/, 產 `review_round_25_full_3000.md`。
2. **L2 live READ**: 抽 operator 指定 1~5 台 SIT 機, 跑 **READY 態的 READ 類**實機驗證(6969 變數、redfish 路徑、工具白名單、sudo)。
3. **L3 operator 監督**: STATE/WRITE/DESTROY 抽選, operator 一批一批 approve 我邊跑邊問邊報。

### 待 operator 拍(5 件事, 拍完才動)

- [ ] **P1**: READY 三態(R38)與 `ai_can_execute` 並存或替換?
- [ ] **P2**: 5 段 UI(R34)進哪輪改 app.js; 還是先用 md 報告(1 窗口如 W25 Functionality 0-200)讓 operator 驗?
- [ ] **P3**: L2 live 用哪 1~5 台 SIT 真機? (只跑 READ 類)
- [ ] **P4**: 3000 條重跑順序: Functionality 先, 還是 6 sheet 都從「READY 態」抽?
- [ ] **P5**: 報告檔命名/位置: `review_round_NN_<scope>.md` in repo 根, OK?

## 十七、operator 視角 SOP(從「貼出」到「operator judgment」)

```
[operator 點]  指派測項 <code>
  ↓ UI 給 [operator] 渲染的:
  1. 🎯 目的 (一句話)
  2. 📥 需 operator 提供的變數 (表格)
  3. ▶ 本次要跑的指令 (bash + 頭註解, ${VAR:?} 提示)
  4. 📤 產出人 (預期 raw + log 路徑)
  5. 🚧 判斷閘 (READ/STATE/WRITE/DESTROY/PHYSICAL + rollback)
[operator 填變數]  →  點 GO
  ↓ [agent] 檢查 5 段齊 → L2 只讀類直接跑 / 其它類 ask
[agent 跑完]  →  回報 R36 格式  →  [operator judgment]
```

**agent 邊界**: 判 READ/STATE/WRITE/DESTROY/PHYSICAL 5 類中的邊界,**agent 不能自我升級**(READ→WRITE / WRITE→DESTROY),只能 operator 明確 approve。

## 十八、第十七輪(2026-09-18,Pilot 後規則修訂 — W25 Functionality 10 條 + operator 澄清)

> 來源:Round-1 pilot 出報告(`review_round_01_pilot_functionality.md`)後,operator 逐例澄清。
> 本輪主題:**3112 條 library 是跨機型/跨 vendor 通用的** —— 命令正確性 = **邏輯判斷**(執行模式 + operator slot + 靜態 sanity),**不拿單機實跑當證據**。
> 狀態:a–l 已拍板;k 表(暫定重分類)⚠️ 待重走 3112 時逐條確認,不是定案。

### a. ⭐ 核心認知變更:library 跨機型通用(取代「以 EQ3300 實跑結果定判定」)
- 命令「對不對」= 邏輯上對(執行模式對、slot 標對、bash 靜態無誤),**不是**「EQ3300 跑通就對 / 跑不通就 UNRESOLVED」。
- 單機實跑(EQ3300)只能當「那台的行為參考」,**不能**當其他機型的證據,更不能用單機 raw 結果改判定。
- 後果:「OOB 跑一次 → 0xc7 / not found → 據此判 UNRESOLVED / N/A」的流程**廢棄**;改由 b/c/d 處理。

### b. ⭐ 新概念:**vendor slot(依機型而異的欄位)**
同一條 test case,某些參數**必然隨機型/BIOS/BMC 版本而變**,這些叫 vendor slot:
- OEM raw 的 **payload bytes**(`raw 0x30 0x26` 該不該帶 payload,各 vendor BMC spec 不同 → operator 對該機 BMC spec 給值)
- **sensor name**(各機型 temperature sensor 命名不一)
- **redfish path / resource ID**(R17/R28 精神,本輪升為普遍原則)
- **vendor tool 及其參數**(nvsm / rocm rvs / i3c-tools / storcli…)

規則:
1. 命令寫法對的,slot 用 `${VAR:?operator ...}` 標出 → 維持 READY/NEEDS-OP,operator 按機型填值;
2. **不因為**單機實跑出 0xc7 / not found 就降 UNRESOLVED —— 那是「這台機沒這資源/不這語法」,不是命令錯;
3. ai_logs_output 標「本值依機型而定,對照該機 <BMC spec / SMBIOS / SDR> 填」;
4. 變數表與 6969 通用變數(R24)分開列,來源欄寫「operator(依機型 slot)」。

### c. 純資訊讀取題:**抓全部原始輸出,不 grep 挑行**
- `lscpu` / `lspci -nn` / `dmidecode -t N`(整 Type)→ 直接全量抓,raw 整份丟回,operator 自己對 spec 欄位。
- 輸出會爆炸的(完整 `lspci -vvv`、`sdr list` 數百行)→ 可以粗篩,但**要標明篩了什麼**,或補「要完整版請跑 X」。
- 舊「grep -iE 挑幾行」寫法 → 重走 3112 時逐條轉全量抓。

### d. sensor `get` 找不到 → 同一條命令自動補抓整包
- `sensor get 'X'` 回 not found → **同 bash 內 fallback** `sdr elist` 全量 sensor 清單一起丟回,operator 自己對命名(接 b)。
- 範式:`ipmitool ... sensor get 'TEMP_FPGA' 2>&1; echo ---SDR-FALLBACK---; ipmitool ... sdr elist 2>&1 | head -100`
- agent 不判「有沒有這 sensor」;回值都抓齊,operator 對。

### e. 跑在 DUT 的命令必須包 ssh + job-file 預寫法
- **Defect「跑錯地方」**:操作 DUT 上磁碟/工具的命令沒包 `sshpass ... ssh $DUT_USER@$DUT_IP` → agent 端會跑在 agent 本機 → **錯機+錯磁碟,高優先 defect**,重走時逐條抓。
- **job-file 預寫法**(fio 等「只差 target」題,範例 `Wistron-Storage-00009-V003` 已與 operator 逐字過):
  1. 第 1 步 agent 把 job 檔參數**全部預寫死**上 DUT(`ssh ... 'cat > /root/<code>.fio' <<EOF ... EOF`,`[test]` 段留空,不含 target);
  2. 第 2 步 operator 給 target → agent `fio /root/<code>.fio --filename=${FIO_TARGET:?one EMPTY volume, never OS/boot}` 執行 + log;
  3. operator 只說一句「寫哪顆»;agent 不猜 target;job 檔在 DUT 本機。

### f. sudo:降級,不再當 defect 報
- operator 確認:**6969 登記的 SUT 基本都用 root** → sudo 加不加對執行沒差。
- 重走 3112:「缺 sudo」不再列 defect(可選保留);報告不拿這當問題講。R26 降為「背景假設」。

### g. `# 🎯` 頭註解:保留(operator 2026-09-18 確認,不取消)

### h. 每條 review 的口徑(operator 認可,取代 A/B/C 名詞)
1. **執行模式**:agent 直跑 / 有前置(operator 先做 X)/ 物理(agent 不跑)三選一;
2. **operator slot**:明列要給的變數(6969 通用 vs vendor slot,見 b);
3. **邏輯 sanity(靜態,不實跑)**:bash 語法/引號、跑的位置(e)、5 段 + 🎯 頭(g)、slot 提示(R7)、intent 與題目一致。

### i. OOB 變數直讀磁盤(修 R24 取法)
- `GET/POST /api/machines` 把 `bmc_pass` mask 成 `****`(main.py 819/937/947)→ 走 API 會拿到 `****`,OOB 連不上,誤判「6969 存錯」。
- **規則**:`bmc_user/pass` 一律直讀磁盤 `/srv/pa-manager-prod/data/data.json` → `machines[<name>]`;ip/user 等不 mask 欄 API 可讀,pass 例外。
- 密碼實值不寫入任何 md/報告(執行時才取)。

### j. 實跑定位(修 R37 L2 精神)
- L1 靜態 review **不實跑**;實跑 = L2,operator 明確圈定「在某台驗」才跑。
- W25 那 3 類 raw(power status / sensor not found / 0xc7)**僅供參考**,不作 3112 任何一條的判定依據。

### k. W25 Functionality 10 條暫定重分類(⚠️ 待重走逐條確認,非定案)
| code | 舊(W25) | 新框架暫定 | 依據 |
|---|---|---|---|
| HW-00073 | READY(修引號) | READY + 全量 lscpu | c |
| BIOS-00300 | READY | READY,-t 18 整 Type 全量 | c |
| BMC-00535 | UNRESOLVED | **NEEDS-OP + vendor slot `OEM_RAW_PAYLOAD`** | b |
| BMC-00980 | READY | READY + fallback sdr elist | d |
| HW-00015 | NEEDS-OP | NEEDS-OP(i3c-tools = vendor tool slot) | b |
| BMC-00039 | NEEDS-OP | NEEDS-OP | — |
| BMC-00544 | UNRESOLVED | **NEEDS-OP + WRITE 閘 + slots**(`DEMO_SUT`/`BIOS_REV_BYTES`/`READBACK_RAW`) | b |
| HW-00415 | UNRESOLVED | **NEEDS-OP + slots**(`ENCODER_TOOL`/`DURATION`/`EXPECTED_SHAPE`) | b |
| HW-00001 | PHYSICAL | PHYSICAL | — |
| BMC-00307 | UNRESOLVED | **UNRESOLVED(library 原始 procedure/criteria 即 TBD)** | — |

### l. UI 需求(新增,P2 範圍):指派區塊程式碼語法高亮
- 現狀:6969「指派可執行指令」浮窗命令區塊全白字、無高亮,operator 反映難看。
- 目標(operator 指認樣子,對照對話視窗的 markdown 預覽風):`#` 註解=綠、`$VAR`/`${VAR:?...}`=橘、`[global]/[test]` 區塊標記=淺藍、其餘關鍵字分色。
- 落點:`static/js/app.js` `assignTaskCopy()`(~L3118)+ 指派浮窗渲染;純前端,不動資料欄。
- ⚠️ 本檔 CJK 硬規則:app.js **禁用 file_editor 直接改**,python 腳本替換;改完 `node --check` + CJK 3-byte 數比對(不減少)。(由本視窗執行,若未完成,下視窗接手。)

### 重走 3112 的總口徑(本輪定)
1. 每條照 §十五 8 問 + 5 段 + h 的三項出 verdict,**不實跑**(a/j);
2. 重走時四類必抓:跑錯位置(e)/ 應全量抓卻在挑行(c)/ sensor 無 fallback(d)/ vendor slot 未標(b);
3. **開跑前先與 operator 逐節走完整份 §一~§十八 邏輯重對齊**(每節:現行衝突 / 疑問 / 提案 → operator 拍);對齊結論**即時追加本檔**;
4. 已過 3112:放寬類(f)不回頭重查;收緊類(c/d/e 影響命令寫法)由重走自然帶到。


---

## 十九、第十八輪(2026-09-18,樣本 review 拍板 + review 規格修正)

> 來源:與 operator 逐例對齊 5 條樣本 + 打架 1/2/3 拍板。以下規則 operator 已拍定,寫入本檔(可加、不可擅改)。
> 關係:§十八 a–l 仍有效;本節 m–u 是對 a–l 的落實 / 補強,兩者並存。k 表仍待重走 3112 時逐條確認。

### m. ⭐ 判定三態保留 + 輔助視角並存(打架 1 拍板)
- YES / PARTIAL / NO **保留為主判定**,與 READY / NEEDS-OP / PHYSICAL(§十八 h / R38)**並存、不打架**。
- 白話判定對應(operator 原話):
  - **YES** = 我(agent)拿到參數/指令就能自己跑 → 自動跑。
  - **PARTIAL** = 要前置 / 會變動(設環境溫度、要 cycle、要 update fw...) → 需 operator 前置或指定目標。
  - **NO** = 要人動實體(插拔 / 過壓 / AC cycle...),agent 做不到。
- 對應新框架:**YES ≈ READY**;**PARTIAL ≈ NEEDS-OP**;**NO ≈ PHYSICAL**。
- report 時以三態為主判定,輔以 READY 態標示(§十八 h 三項照出)。

### n. ✅ review 進度寫檔規則(打架 2 拍板,**紅線級**)
- **每一次 review 到哪裡,一律當場寫進 md 交接檔**(SESSION_HANDOFF_*.md),**並標日期**。
  對話視窗會一直換,不寫下一個視窗就看不到做到哪。
- 邊 review 邊改 xlsx → **可**(operator 認可);但 **push 到 GitHub 一律等 operator 說「Push」才 push**。
- commit 同紅線:operator 說 commit 才 commit。

### o. ⭐ 假完成檢查(最該補的一類;樣本 Storage-00059-V004)
- 凡「題目要**跑某個測試**」的條目,`ai_commands` **必須含真正能跑的測試 bash**;只寫 `fio --version` / 工具版本檢查 = **不合格**(U-假完成)。
- fio 這類依 §十八 e **job-file 預寫法**:agent 先把 `.fio` job 檔預寫好、`[test]` 段留空,
  operator 給 target(`/dev/nvmeXnY`)→ agent 跑 `fio /root/<code>.fio --filename=${FIO_TARGET:?...}`。
- 判定:缺真測試 bash → **KEEP / UNRESOLVED** + 標「U-假完成:ai_commands 只有工具檢查,需補真測試」。

### p. ⭐ 資訊讀取題:全量抓 + 粗篩並存(§十八 c 精修;operator 原話「全抓+grep」)
- 純資訊讀取題一律「**全量抓**」為主;輸出**太長**(dmesg / sdr list 數百行)→
  **全抓 + 粗篩並存**:全量存 log、粗篩貼 operator,並**標明篩了甚麼**;operator 要完整版再跑「完整版命令」。
- 不 grep 到只留幾行而漏掉 operator 需要的整段。
- RAS-00374(BERT/ERST/HEST)= **全抓 dmesg + 整份 sys/firmware/acpi/tables/ 列出 + 粗篩標示**(operator 看長度對)。

### q. ⭐ 物理動作歸 PHYSICAL(§十四 / §十八 j 補強)
- agent **不能觸發**的物理動作(AC cycle 1000 次、插拔、過壓、換 PSU)→ **PHYSICAL,不是 PARTIAL**。
- agent 角色 = 只提供「**事後證據讀取包**」(operator 做完物理動作後,agent 跑檢查命令)。
- PARTIAL 只留「agent 真能跑,但需前置 / 需指定目標」。
- Stability Long Term Stress-00067(AC 1000)→ **PHYSICAL**。

### r. ⭐ 白名單外工具(vendor tool):`${TOOL_PATH:?}` + **不臆造 vendor 命令**(R13 落實)
- 白名單外 / 授權 / 專屬工具(HPL、SPECcpu、i3c-tools...)→ `ai_commands` 用 `${TOOL_PATH:?...}` + packages 標「operator 提供」。
- **agent 不臆造 vendor 專屬 run 命令**:真正的執行命令依 vendor user guide(如 AMD HPL user guide),
  **agent 不會自己知道** → 用 `${VENDOR_TOOL:?...}` / `${HPL_RUN:?...}` 讓 operator 依 guide 填;
  **agent 提供 wrapper / 前置(依賴安裝、環境) + 抓輸出**那半段即可。
- HPL CPU-00002 = 實例:前置(裝 hpl tarball)+ `run ${HPL_RUN:?依 AMD performance user guide}` + 抓 Gflops。僅描述無實際命令 = 不合格,同 o。

### s. 每條達標三件套(適用所有「有實際跑」的條目)
- 🎯 頭註解(R32)+ 📤 產出人(R31 段4)+ 🚧 判斷閘(R31 段5),**缺一 = 不合格** → KEEP 並標缺哪樣。
- 樣本 HW-00213(dd USB):缺 🎯 / 產出人 / 判斷閘 → 需補齊才達標。

### t. 樣本 verdict 一覽(已拍板)
| 樣本 code | sheet | verdict | 關鍵(缺/改) |
|---|---|---|---|
| HW-00213-V002 | Functionality | NEEDS-OP | dd 補三件套(s) |
| Storage-00059-V004 | Compatibility | NEEDS-OP | 實測 bash 補齊(o job-file 預寫法) |
| RAS-00374-V003 | Reliability | NEEDS-OP | 全量抓 + 粗篩並存(p) |
| CPU-00002-V003 | Performance | NEEDS-OP | `${VARIABLE_TOOL:?}` 依 guide,不臆造(r) |
| Long Term Stress-00067-V004 | Stability | PHYSICAL | AC 物理 → agent 只給事後檢查包(q) |

### u. 正式 3112 逐條 review 前的最後門檻
- 每 sheet 先抽樣給 operator 拍(如上)→ 規則定案後才正式逐條。
- 逐條產出:「8 問(Q1..Q8)+ 5 段(🎯/📥/▶/📤/🚧)+ §十八 h 三項(執行模式/operator slot/邏輯 sanity)+ verdict」,**不實跑**(§十八 a/j)。
- 四類必抓:跑錯位置(e)/ 應全量卻挑行(c)/ sensor 無 fallback(d)/ vendor slot 未標(b)。
- **每 review 到哪就寫進交接檔並標日期(n)。**


---

## 二十、樣本勾選第二輪(2026-09-18)+ operator 拍板 + YES/PARTIAL 定義草案

> 來源:operator 對 12 條樣本逐條勾選。已確認項目記入本節;YES/PARTIAL 定義為**草案(待 operator 拍定,未鎖)**。

### v. sensor 名稱因機型而異 → 撈不到就補 `sdr`(Functionality F1/F2 拍板)
- sensor `get 'XXX'` 的名稱**不一定每台都一樣**(依機型 / BMC 版本而異)。
- 規則:`sensor get 'XXX'` **回 not found → 同一命令內 fallback 補整包** `sdr elist` / `sensor list`,把全 sensor 清單丟給 operator 自己對命名(落實 §十八 d)。
- 適用 BMC-00056 / 00159 等「讀 sensor」題。

### w. `${VAR:?...}` 是什麼(operator 疑問,白話說明)
- bash 的「缺值自動停 + 提示」保險栓:執行時變數 VAR 沒被填值 → **當場停住**並秀出 `VAR: <:?後文字>`。
- agent 不會用空值 / 瞎猜值去跑;缺什麼一眼看到要補。例:`run ${HPL_RUN:?請填 HPL 執行指令}`。
- 每個 `${VAR:?}` 都要在「📥 需 operator 提供的變數」表列出(R35)。
- 它**不改判定**,只是把缺的講清楚。

### x. DIMM error injection(R2)→ YES(operator 拍板)
- operator:只要使用者把 RAS injection 的 **SOP 給 agent,agent 就能跑** → 判定 **YES**(原 NO 改)。
- 但**備註**:此類可能導致 **系統 reboot / 影響可用性** → 🚧 判斷閘標「可能 reboot」+ risk 標明。

### y. STREAM(P1)→ YES(operator 拍板)
- operator:operator 給 run 指令 / SOP(或白名單內 `gcc` 編)→ agent 就能跑 → **YES**(原 PARTIAL 改)。
- 指令要補真正可跑 bash(`gcc stream.c && ./stream`,§十九 o 假完成檢查)。

### z.(其餘 OK 確認)
| code | verdict | 備註 |
|---|---|---|
| C1/C2 storcli | 維持 | vendor slot 未標 → 補 `${TOOL_PATH:?}` + `/c0` 依 RAID 卡(§十九 r) |
| R1 UPI CRC | PARTIAL | vendor 專屬 harness,`${VAR:?}` + operator |
| P2 MLPerf SDXL | PARTIAL | harness/weights 需 operator(無異議) |
| S1 Reboot 500 | PARTIAL | 需 operator 同意時長 |
| S2 AC 1000 | PHYSICAL | §十九 q |
| N1 Flash BIOS downgrade | PARTIAL | + risk 標 WRITE/DESTROY(rollback) |
| N2 HPL CPU-00002 | **PARTIAL** | operator 確認 PARTIAL |

### aa. YES / PARTIAL / PHYSICAL / UNRESOLVED 定義(草案,待 operator 討論後拍定)
> 依 operator 對樣本的逐條反應歸納。此為草案,operator 可改。

- **YES** = operator 給出完整 run 指令 / SOP(或工具在白名單、agent 從 spec 推得命令)後,agent 能**照 SOP 一口氣執行完並回報,中途不需 operator 再插手**。即使**會改狀態 / reboot**,只要**備註風險 + 提前問**(R22),仍可 YES。
  - 例:STREAM(給指令)、DIMM error injection(給 SOP)、dmidecode 純讀、OOB sensor 讀。
  - ≈ §十八 h「執行模式 = agent 直跑」。

- **PARTIAL** = 就算拿到 SOP,**執行途中某一步一定要 operator 人在或動手 / 提供東西**,agent 才跑不完:
  - 要指定目標碟/端(選哪顆 → fio 的 `FIO_TARGET`);
  - 要 operator 給工具/授權/機型專屬參數(HPL tarball、MLPerf harness、storcli 依 RAID、i3c-tools);
  - 前置是 operator 動作(先配 SNMP、先 unlock BIOS、先插拔);
  - operator 要在場看(LED 顏色 / 風扇轉)。
  - 例:fio、HPL、MLPerf、SNMP、LED、Reboot 500。
  - ≈「執行模式 = 有前置」。

- **PHYSICAL / NO** = 觸發動作本身是**物理**,agent 完全不能做(AC cycle、插拔、換 PSU、過壓/欠壓)→ agent 只提供「事後證據讀取包」(§十九 q)。例:AC 1000、hotplug。

- **UNRESOLVED** = 8 問任一答不出 / 5 段任一缺 / 資料 TBD(§十五 Q1..Q8)。


---

## 二十一、YES / PARTIAL / NO 定義(鎖版,2026-09-18 operator 拍定)

> 取代 §二十 aa 草案。operator 對 3 個邊界 case 全部答覆後鎖版。分界不是「要不要給東西」,而是「給完後,執行過程中有沒有需要『人』在場動手/一直看/批准」。

### 定義一覽(鎖版)
| 判定 | 定義 | 例子 |
|---|---|---|
| **YES** | operator **一次性給完**缺的輸入(目標碟 / 工具 / SOP / 指令 / 參數)後,agent **自動跑到完並回報**,中間不需 operator 的人再動手或在場。**即使會改狀態 / reboot,只要備註風險 + 提前問(R22),仍 YES。** | FIO(給碟)、HPL/MLPerf/storcli(給資料/sop)、STREAM(給指令)、DIMM error injection(給 RAS sop)、dmidecode、OOB sensor 讀 |
| **PARTIAL** | 拿到 SOP 後,**執行中某一步一定要 operator 的人動手 / 在場看 / 批准**才跑得下去。 | SNMP(你先配好)、LED/風扇(人在場看顏色)、Reboot 500(同意 12h 時長)、AC cycle(要人在現場操作) |
| **NO / PHYSICAL** | **要人手動物理操作**(拆機 / 插拔 / 調硬體 / 過壓欠壓),agent 完全不能做,只給「事後證據讀取包」(§十九 q)。 | 手動拆裝、換 PSU、過壓欠壓、熱插拔 |
| **UNRESOLVED** | 8 問任一答不出 / 5 段任一缺 / 資料 TBD(§十五)。 | — |

### 3 個邊界 case 拍板(operator 逐條答)
1. **reboot / 改狀態 算不算 PARTIAL?** → **不算**。「備註風險(🚧 可能 reboot)+ 提前問」的仍是 **YES**(DIMM injection 為例)。✅
2. **operator 要在場看(LED/風扇)= PARTIAL 還 NO?** → **PARTIAL**(agent 能下 LED 指令,但要人在場看);但**要手動拆東西 = NO**。✅
3. **純資訊但會打爆 log(STREAM/sensor)= 都 YES?** → **YES**;但 **log 很長時,agent 要盡量幫 operator 抓「正確的那段」**,不是整坨丟(落地 §十九 p:全抓 + 粗篩並存,粗篩標明)。✅

### 判定注意(fio 等 target 題)
- fio / dd 這類「要指定目標碟」→ **YES**(operator 一次給 `FIO_TARGET` = 選哪顆空碟 → agent 跑)。不因「要指定碟」就降 PARTIAL;只有「跑的中途還要人動手/在場/批准」才是 PARTIAL。
- 但目標碟仍用 `${FIO_TARGET:?...}` 強提示,NEVER OS/系統碟(§十九 o,風險不變)。
