## 批次說明(第 2201–2290 條組成 — Functionality 表最終視窗)

| 區段 | 約 row | 類型 | 主判定 |
|---|---|---|---|
| USB Hubs/Device(MCU) USB2/3 + DPoC KVM Screen(KVM 無/有 hub) | 2203–2206 | 實體/USB 列舉 + 目視 | PARTIAL/NO(1 TBD) |
| PCIe BW stress + DC/AC/WR Cycle Speed&Link | 2207–2210 | DUT 讀 + operator cycle | PARTIAL(1 TBD) |
| Operations Factory Default/Preserve + BMC Web 2FA | 2211–2213 | Redfish POST + Web | PARTIAL |
| NVMe E1.S LED Check(power/read-write/ready-to-remove) | 2214–2216 | DUT 讀+operator 目視 | YES |
| L10 PSU LED + Flyboy-BMC sanity(GPU/BIOS Debug Data/KVM/lsusb/ncsi-cmd/Redfish/D-Bus/busctl) | 2217–2257 | BMC console/Redfish 只讀 + web 前置 | YES/PARTIAL 混合 |
| Security mode + Install OS + Version Check + Clear CMOS + L10 LED + Panel/Jumper/Mechanical | 2258–2271 | BIOS/物理/目視 | NO/PARTIAL |
| IPM Sensor List(TEMP_HIB_PEX)+ MLPerf Retinanet + Sensor Check PDB + Leaking + FW pkg Release note | 2272–2277 | OOB sensor get / vendor MLPerf / 目視 | YES/NO(FAKE 判改 2272) |
| BMC Validation(FW Update/Recovery/Reject downgrade/corrupt)+ Reboot BMC | 2278–2282 | BMC flash 前置 | PARTIAL |
| Information/Jumper(I2C/I3C TBD 行)+ Thermal stress + GB Field RMA/Mfgdiag | 2283–2292 | 物理/目視 + vendor diag | NO/PARTIAL(3 TBD→UNRESOLVED) |

## 第 2201–2290 條 review 統計

**verdict(§二十一 鎖版)分布(本批 90 條)**:
| verdict | 條數 | 說明 |
|---|---|---|
| NO/PHYSICAL | 24 | 目視(Mechanical/AVL/Jumper/PSU LED/Release note)+ 物理(AC/DC cycle、按鈕、leak) |
| PARTIAL | 40 | 前置(BMC web/BIOS/install/fw update/i3c/thermal chamber/vendor diag + 2 判改之一 2241) |
| YES | 21 | 純讀:sensor get/OOB ipmitool/只讀 ssh/Redfish GET + 2272 判改 |
| UNRESOLVED | 5 | 2203/2207/2290/2291/2292 Criteria/During-Test 即 TBD |

**瑕疵統計(本批實際修進 xlsx)**:
| class | 條數 | 對應編號(rows) |
|---|---|---|
| WR(命令內容/完整流程與 Items 不符 → 重寫) | 8 | 2203/2209/2241/2273/2277/2287/2290/2291 |
| Q-LIT(ssh 內層裸雙引號 → 單引號) | 1 | 2259 |
| R5(OOB/`lanplus` 誤經 DUT-ssh 雙跳 → agent-host 直連;含 2230/2279 內層引號) | 3 | 2228/2230/2279 |
| FAKE(「not directly runnable」實為可跑 OOB sensor get) | 1 | 2272 |
| VERDICT(col13 判改)+ PKG(col14 套件) | 2+6 | 2241 YES→PARTIAL、2272 PARTIAL→YES + pkg |

> 多類在某 row 重疊,獨特 row = **13**;ai_commands col15 diff = 13 cells;ai_can_execute col13 = 2(2241/2272);ai_packages_needed col14 = 6。**全 Functionality.**(行內 row-2 = 條號:2203→2201 … 2292→2290)

**🔄 累計(第 1–2290 條)**:
| verdict | 條數 |
|---|---|
| NO/PHYSICAL | 409 |
| PARTIAL | 811 |
| YES | 897 |
| UNRESOLVED | 173 |
| 合計 | 2290 |

**✅ 本批缺陷已實際修進 xlsx**:8 WR + 1 Q-LIT + 3 R5(含雙類)+ 1 FAKE + 2 判改(2241/2272)+ 6 pkg = **21 cells**(13 col15 + 2 col13 + 6 col14)。
零回歸:對 bak_rev02_batch12 逐 cell 比對,Functionality diff = 恰 21 cells;5 其它 sheet 0 diff;cyrillic=0 / U+FFFD=0;git HEAD `5a60875` 未動;`data/tests.json` 未同步(等 operator)。

**🏁 Functionality 表收官**:row 2–2292 / items 1–2290 全數 review 完;後續只剩 5 張其它 sheet 已於 W17–W24 完成,全庫 3112 條 L1 完成。

---

## 逐條 review(第 2201–2290 條)

### 2201/2290 — `Wistron-HW-00484-V002` · Items=USB2/3 Function Check · TestSet=USB Hubs, Device(MCU)
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= UNRESOLVED** | exec 模式 = `不確定(TBD 資料)`

**8 問**:
- Q1 測什麼:USB2/3 Function Check
- Q2 位置:無法判定(資料 TBD)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:USB2/3 Function Check
- Q6 補什麼:usbutils (lsusb)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:USB2/3 Function Check
- 📥 變數:無(Procedure/Criteria 即 TBD,無法推導)
- ▶ 指令:`--`(TBD,見 ai_commands)
- 📤 產出人:operator 於測試庫補 TBD 後重審,agent 未跑
- 🚧 判斷閘:UNRESOLVED,等 operator 補資料

**§十八 h 三項**:執行模式=`不確定(TBD 資料)` / operator slot=`無法判定` / 邏輯 sanity=`資料 TBD;8 問答不出(鎖版 §二十 aa / §二十一)`
**⚠️       缺陷**:WR(命令內容與 Items/Procedure 不符 → 依 procedure 重寫);已修 xlsx

---

### 2202/2290 — `Wistron-BMC-00485-V003` · Items=Screen · TestSet=DPoC for BMC KVM function check
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:Screen
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:The monitor screen should display normally.
- Q6 補什麼:VGA/HDMI monitor + Type-C hub (operator)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Screen
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 2203/2290 — `Wistron-BMC-01058-V002` · Items=KVM - Without USB hub · TestSet=DPoC for BMC KVM function check
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:KVM - Without USB hub
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:KVM should work normally.
- Q6 補什麼:BMC web UI (operator)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:KVM - Without USB hub
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 2204/2290 — `Wistron-BMC-00486-V002` · Items=KVM - With USB hub · TestSet=DPoC for BMC KVM function check
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:KVM - With USB hub
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:KVM should work normally.
- Q6 補什麼:BMC web UI + USB hub + VGA monitor (operator)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:KVM - With USB hub
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 2205/2290 — `Wistron-HW-00487-V002` · Items=BW stress test. · TestSet=PCIe
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= UNRESOLVED** | exec 模式 = `不確定(TBD 資料)`

**8 問**:
- Q1 測什麼:BW stress test.
- Q2 位置:無法判定(資料 TBD)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:BW stress test.
- Q6 補什麼:PCIe bandwidth test tool (e.g. perftest/pciebw)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:BW stress test.
- 📥 變數:無(Procedure/Criteria 即 TBD,無法推導)
- ▶ 指令:`--`(TBD,見 ai_commands)
- 📤 產出人:operator 於測試庫補 TBD 後重審,agent 未跑
- 🚧 判斷閘:UNRESOLVED,等 operator 補資料

**§十八 h 三項**:執行模式=`不確定(TBD 資料)` / operator slot=`無法判定` / 邏輯 sanity=`資料 TBD;8 問答不出(鎖版 §二十 aa / §二十一)`

---

### 2206/2290 — `Wistron-HW-00486-V002` · Items=DC Cycle - Speed&Link · TestSet=PCIe
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:DC Cycle - Speed&Link
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:All PCIe speeds and link statuses are normal
- Q6 補什麼:lspci + power/reboot control
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:DC Cycle - Speed&Link
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- DC Cycle - Speed&Link: run repeated DC (cold) cycles and capture lspci link speed/width after each cycle.`
- 📤 產出人:
  log 取位:return link speed/width (LnkSta) after each DC cycle so user verifies it trains back correctly. Long - confirm approval.
  risk:RISK: DC power cycling is destructive - operator present + approval.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2207/2290 — `Wistron-HW-00487-V002` · Items=AC Cycle - Speed&Link · TestSet=PCIe
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:AC Cycle - Speed&Link
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:All PCIe speeds and link statuses are normal.
- Q6 補什麼:lspci + power control
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:AC Cycle - Speed&Link
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- AC Cycle - Speed&Link: the operator performs the AC power cycle (overnight); after each cycle the agent records PCIe link speed/width and confirms all speeds/link statuses are normal.`
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP"lspci -nn 2>&1 | grep -iE 'Mellanox|Processing accelerators|VGA|3D controller'; lspci -vv 2>&1 | grep -iE 'LnkSta:|Ln`
  `-- AC power plug/unplug is an operator physical step; the agent reads the link state after each cycle.`
- 📤 產出人:
  log 取位:return the bandwidth-stress run output so user confirms it meets the expected PCIe bandwidth. Long - confirm approval.
  risk:RISK: sustained high PCIe traffic; ensure cooling + approval.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️       缺陷**:WR(命令內容與 Items/Procedure 不符 → 依 procedure 重寫);已修 xlsx

---

### 2208/2290 — `Wistron-HW-00488-V003` · Items=WR Cycle - Speed&Link · TestSet=PCIe
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:WR Cycle - Speed&Link
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:All PCIe speeds and link statuses are normal
- Q6 補什麼:lspci + power/reboot control
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:WR Cycle - Speed&Link
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- WR Cycle - Speed&Link: run repeated warm-reboot cycles and capture lspci link speed/width after each cycle.`
- 📤 產出人:
  log 取位:return link speed/width (LnkSta) after each warm-reboot so user verifies it trains back correctly. Long - confirm approval.
  risk:RISK: repeated warm reboots is destructive - operator present + approval.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2209/2290 — `Wistron-BMC-01061-V002` · Items=Factory Default · TestSet=Operations
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:Factory Default
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Criteria:
1.Confirm that items checked on the "Preserve" page cannot be restored/changed back to their default values.
- Q6 補什麼:curl + ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Factory Default
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `curl -s -k -u "$BMC_USER:$BMC_PASS" -X POST https://$BMC_IP/redfish/v1/Managers/bmc/Actions/Manager.Reset -d '{"ResetType":"FactoryReset"}' -w "\nHTTP %{http_code}\n"; sleep 120; ipmitool -I`
- 📤 產出人:
  log 取位:perform the Factory Default restore of the BMC, then confirm the firmware version/settings return to factory defaults by reading the Manager
  risk:RISK: DESTRUCTIVE: Factory Default wipes all BMC settings back to factory; confirm with user + have recovery access ready.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2210/2290 — `Wistron-BMC-01062-V002` · Items=Preserve · TestSet=Operations
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:Preserve
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Criteria:
1.Confirm that the checked items are displayed on the 'Factory Default' page."
2.Confirm that items checked on the "Preserve" page cannot be restored/changed back to their default values.
- Q6 補什麼:curl + ipmitool + jq
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Preserve
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `curl -s -k -u "$BMC_USER:$BMC_PASS" -X POST https://$BMC_IP/redfish/v1/Managers/bmc/Actions/Manager.Reset -d '{"ResetType":"PreserveSettings"}' -w "\nHTTP %{http_code}\n"; sleep 120; ipmitoo`
- 📤 產出人:
  log 取位:perform the BMC restore that preserves settings (Preserve mode), then confirm the preserved items are retained and the BMC comes back withou
  risk:RISK: state-changing: BMC restore/reset; confirm the exact items to preserve and the desired reset type with the user first.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2211/2290 — `Wistron-BMC-01063-V002` · Items=2FA(Two Factor Authentication) · TestSet=BMC Web
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:2FA(Two Factor Authentication)
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Criteria:
Once the user enter the correct verification code, the login will be successful and it will navigate to Overview page.
- Q6 補什麼:browser/automation + TOTP/second factor
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:2FA(Two Factor Authentication)
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- "2FA(Two Factor Authentication)": enable/verify 2FA (two-factor auth) for BMC web login. Enabling 2FA is state-changing and can lock accounts; agent sets it up per user instructions and v`
- 📤 產出人:
  log 取位:return the 2FA enrollment state + a verification login result so user confirms 2FA works.
  risk:RISK: enabling 2FA can lock everyone out of the BMC if the factor is lost; ensure a recovery path and confirm before enabling.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2212/2290 — `Wistron-HW-00489-V003` · Items=All E1.s NVMe LED Check - Hard drive power · TestSet=NVMe - E1.S
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:All E1.s NVMe LED Check - Hard drive power
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Criteria:
1. Check system spec define LED function
2.The LED should be solid green when the drive is powered.
- Q6 補什麼:lsblk + nvme-cli (install)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:All E1.s NVMe LED Check - Hard drive power
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "lsblk -o NAME,SERIAL,MODEL,SIZE,TRAN 2>&1 ; nvme list 2>&1"`
- 📤 產出人:
  log 取位:return nvme list + lsblk for all NVMe devices so user confirms each E1.S/M.2 drive enumerates with correct serial/model/size. No RISK (read-
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2213/2290 — `Wistron-HW-00490-V002` · Items=All E1.s NVMe LED Check - Hard drive read/write · TestSet=NVMe - E1.S
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:All E1.s NVMe LED Check - Hard drive read/write
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. Check system spec define LED function
2. The LED should flicker green to indicate activity during drive read/write operations.
- Q6 補什麼:lsblk + nvme-cli (install)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:All E1.s NVMe LED Check - Hard drive read/write
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "lsblk -o NAME,SERIAL,MODEL,SIZE,TRAN 2>&1 ; nvme list 2>&1"`
- 📤 產出人:
  log 取位:return nvme list + lsblk for all NVMe devices so user confirms each E1.S/M.2 drive enumerates with correct serial/model/size. No RISK (read-
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2214/2290 — `Wistron-HW-00491-V002` · Items=All E1.s NVMe LED Check - Hard drive ready to remove · TestSet=NVMe - E1.S
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:All E1.s NVMe LED Check - Hard drive ready to remove
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. Check system spec define LED function.
2. When the drive is ready to remove, the LED should be solid white, with the amber and green LEDs off.
- Q6 補什麼:lsblk + nvme-cli (install)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:All E1.s NVMe LED Check - Hard drive ready to remove
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "lsblk -o NAME,SERIAL,MODEL,SIZE,TRAN 2>&1 ; nvme list 2>&1"`
- 📤 產出人:
  log 取位:return nvme list + lsblk for all NVMe devices so user confirms each E1.S/M.2 drive enumerates with correct serial/model/size. No RISK (read-
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2215/2290 — `Wistron-HW-00492-V002` · Items=PSU LED Check · TestSet=L10 System - LED
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:PSU LED Check
- Q2 位置:不執行(見說明)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. Confirm the LED behavior matches the spec.
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:PSU LED Check
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 2216/2290 — `Wistron-BMC Sanity-00001-V002` · Items=Add ADDC function · TestSet=Flyboy-BMC sanity
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:Add ADDC function
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1.Check BMC event log display correct information for RAS
- Q6 補什麼:AMD RAS Error Injection Tool + HDT (user provisioned)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Add ADDC function
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- requires the AMD RAS Error Injection Tool (with HDT/RDIMM-ECC setup) to inject an ADDC error, then verify the BMC event/SEL log shows the correct RAS record. Agent needs the exact injecti`
- 📤 產出人:
  log 取位:return the injection result + `ipmitool sel list` / BMC event-log filtered to the ADDC RAS entry so user confirms the log displays correct i
  risk:RISK: fault injection via a hardware error-injection tool can disturb the OS; run only on a dedicated SUT with the exact tool command from u
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2217/2290 — `Wistron-BMC Sanity-00002-V003` · Items=Set/Get BIOS Debug Data (IB/OOB) · TestSet=Flyboy-BMC sanity
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:Set/Get BIOS Debug Data (IB/OOB)
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. Command should be sent without any error.
2. Parameters should be shown correctly.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Set/Get BIOS Debug Data (IB/OOB)
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- set/get BIOS Debug Data is state-changing. IB: `ipmitool raw 0x3a 0x70 0x00` (disable) or `0x01` (enable), then `ipmitool raw 0x3a 0x70` to get; OOB: same via `-I lanplus -H $BMC_IP -U $B`
- 📤 產出人:
  log 取位:return the set + get raw bytes (must send without error) and the read-back parameter so user confirms it matches the state set.
  risk:RISK: changes the BIOS debug-data enable state; confirm target state and restore after the check
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2218/2290 — `Wistron-BMC Sanity-00003-V002` · Items=Check GPU details in BMC GUI/Redfish when host is OFF · TestSet=Flyboy-BMC sanity
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:Check GPU details in BMC GUI/Redfish when host is OFF
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. GPU details should be displayed correctly based on your config
2.Ensure that the previously displayed GPU details are no longer present after AC
- Q6 補什麼:ipmitool + curl (Redfish)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Check GPU details in BMC GUI/Redfish when host is OFF
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- requires powering the SUT off and an AC off/deassert (operator), then reading the GPU details from BMC GUI/Redfish while host is off and after re-power; agent can issue `ipmitool chassis `
- 📤 產出人:
  log 取位:return the Redfish GPU-inventory JSON while host is off and re-powered so user confirms GPU details match config and are absent after AC. GU
  risk:RISK: powering off + AC cycle is operator-dependent; confirm timing so the check does not disrupt other tests
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2219/2290 — `Wistron-BMC Sanity-00493-V003` · Items=Upgrade / Downgrade GPU firmware without AC restart · TestSet=Flyboy-BMC sanity
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:Upgrade / Downgrade GPU firmware without AC restart
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. Ensure GPU firmware can be flashed successfully without AC restart
2.Check GPU firmware version
- Q6 補什麼:browser/automation + user-provided GPU firmware image
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Upgrade / Downgrade GPU firmware without AC restart
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- GPU firmware upgrade/downgrade via the BMC web GPU-management Firmware page (no AC cycle after). Agent needs the exact user-provided GPU firmware image, drives the web upload/flash, then `
- 📤 產出人:
  log 取位:return flash status + GPU firmware version before/after (via BMC Redfish FirmwareInventory / web) so user confirms a successful flash withou
  risk:RISK: GPU firmware flash is state-changing and can brick the GPU if interrupted; flash only the user-specified image and never interrupt mid
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2220/2290 — `Wistron-BMC Sanity-00005-V001` · Items=Import BIOS config page · TestSet=Flyboy-BMC sanity
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:Import BIOS config page
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:After loading, reboot into BIOS setup and check your setting still exist.
- Q6 補什麼:browser/automation to BMC web
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Import BIOS config page
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- import a BIOS config through the BMC web Configure page: change a BIOS setting to non-default, tick Reboot Host Immediately, save+reboot, then verify the setting persists on re-entry to B`
- 📤 產出人:
  log 取位:return the BIOS setting value before import, the import status, and the setting after reboot/BIOS re-entry so user confirms it persists.
  risk:RISK: rebooting + BIOS setting change can interrupt other tests; confirm the SUT is dedicated and the exact setting to change
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2221/2290 — `Wistron-BMC Sanity-00006-V002` · Items=KVM - Status check during power off · TestSet=Flyboy-BMC sanity
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:KVM - Status check during power off
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Check the KVM status should display "Connected," and the main screen should show "POWER OFF" when SUT power off.
- Q6 補什麼:ipmitool + KVM client/automation
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:KVM - Status check during power off
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- power the SUT off (agent can `ipmitool chassis power off`), launch KVM and confirm it shows "Connected" with a "POWER OFF" screen. KVM screen is visual; agent captures KVM/video + power s`
- 📤 產出人:
  log 取位:return the KVM status text + a screenshot showing the POWER OFF main screen for user confirmation.
  risk:RISK: powering the SUT off affects availability; confirm the SUT is free before powering off
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2222/2290 — `Wistron-BMC Sanity-00007-V001` · Items=Check lsusb under BMC console · TestSet=Flyboy-BMC sanity
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Check lsusb under BMC console
- Q2 位置:agent-host(BMC shell 直連)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Confirm each command completes without error and returns the expected output.
- Q6 補什麼:BMC console (lsusb built-in)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Check lsusb under BMC console
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `sshpass -p "$BMC_PASS" ssh -o StrictHostKeyChecking=no $BMC_USER@$BMC_IP "lsusb 2>&1"`
- 📤 產出人:
  log 取位:return FULL raw `lsusb` output from the BMC console so user confirms it completes without error. No RISK (read-only).
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2223/2290 — `Wistron-BMC Sanity-00008-V002` · Items=BMC Shell (SSH) - Verify access control settings · TestSet=Flyboy-BMC sanity
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:BMC Shell (SSH) - Verify access control settings
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1.Confirm that user login into BMC Console via ssh, it should be allowed to access when"BMC Shell (via SSH)" to "enabled"
2.Confirm that user login into BMC Console via ssh, it should be not allowed to access when"BMC Shell (via SSH)" to "disabled"
- Q6 補什麼:browser/automation to BMC web + ssh client
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:BMC Shell (SSH) - Verify access control settings
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- toggling the "BMC Shell (via SSH)" policy is state-changing: set enabled in BMC web Security>Policies, verify SSH login works, then disable and verify blocked. Agent drives the web toggle`
- 📤 產出人:
  log 取位:return SSH login success/failure for both policy states so user confirms access control is enforced.
  risk:RISK: changing access-control policy can lock the agent out of BMC; restore the policy to the original state after the check
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2224/2290 — `Wistron-BMC Sanity-00009-V002` · Items=Check ncsi-cmd output · TestSet=Flyboy-BMC sanity
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Check ncsi-cmd output
- Q2 位置:agent-host(BMC shell 直連)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Command should be sent successfully. 
Ensure that a response is outputted.
- Q6 補什麼:BMC console (ncsi-cmd built-in)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Check ncsi-cmd output
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `sshpass -p "$BMC_PASS" ssh -o StrictHostKeyChecking=no $BMC_USER@$BMC_IP "ncsi-cmd -m 12 --package 0 --channel 0 raw 0x00 2>&1"`
- 📤 產出人:
  log 取位:return FULL raw `ncsi-cmd -m 12 --package 0 --channel 0 raw 0x00` output so user confirms the command is sent successfully with a response. 
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2225/2290 — `Wistron-BMC Sanity-00010-V001` · Items=Max Session Service Information · TestSet=Flyboy-BMC sanity
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Max Session Service Information
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1.Check Max Session Service Information
- Q6 補什麼:curl + jq
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Max Session Service Information
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `curl -s -k -u "$BMC_USER:$BMC_PASS" -X GET https://$BMC_IP/redfish/v1/SessionService 2>&1 | jq`
- 📤 產出人:
  log 取位:return the FULL SessionService JSON (incl SessionServiceType / MaxSessions per protocol where exposed) so user confirms KVM=2/Redfish=20/SSH
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2226/2290 — `Wistron-BMC Sanity-00011-V001` · Items=IPMI selftest support Command · TestSet=Flyboy-BMC sanity
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:IPMI selftest support Command
- Q2 位置:agent-host(BMC shell 直連)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1.Check selftest result
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:IPMI selftest support Command
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- IPMI selftest support (IB and OOB): run the IPMI self-test in-band on the DUT and out-of-band from the agent host, then check the selftest result.`
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP"ipmitool mc selftest 2>&1"`
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" mc selftest 2>&1`
- 📤 產出人:
  log 取位:return FULL `ipmitool mc selftest` output (IB and OOB) so user confirms the selftest result. No RISK (read-only).
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️       缺陷**:R5(OOB/`ipmitool -I lanplus` 誤經 DUT-ssh 雙跳 → agent-host 直連);已修 xlsx

---

### 2227/2290 — `Wistron-BMC Sanity-00012-V001` · Items=Check BMC firmware version via ipmitool mc info · TestSet=Flyboy-BMC sanity
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Check BMC firmware version via ipmitool mc info
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. Result should be correct
2. Command should work without any error.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Check BMC firmware version via ipmitool mc info
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "ipmitool mc info 2>&1"`
- 📤 產出人:
  log 取位:return FULL raw `ipmitool mc info` output so user can check the Firmware Revision bytes match the BMC fw number. No RISK (read-only).
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2228/2290 — `Wistron-BMC-01064-V001` · Items=System Inventory · TestSet=System Inventory
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:System Inventory
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. Data should be readable and correct.
- Q6 補什麼:ipmitool fru
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:System Inventory
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- System Inventory: read the BMC system inventory (system/processor/memory/baseboard/power/thermal/PCIe/storage/network) via OOB ipmitool-fru from the agent host.`
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" fru print 2>&1 | head -n 60`
  `-- the BMC WebUI per-category inventory view is operator-read for the visual confirmation.`
- 📤 產出人:
  log 取位:return the ipmitool fru print so the operator confirms the data is readable and correct across all inventory categories.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️       缺陷**:Q-LIT+R5(內層引號 + OOB 雙跳 → agent-host);已修 xlsx

---

### 2229/2290 — `Wistron-BMC Sanity-00013-V001` · Items=Upgrade and Downgrade PSU firmware by Redfish · TestSet=Flyboy-BMC sanity
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:Upgrade and Downgrade PSU firmware by Redfish
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1.Check PSU firmware version correct
- Q6 補什麼:curl/Redfish + user-provided PSU firmware image
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Upgrade and Downgrade PSU firmware by Redfish
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- PSU firmware upgrade/downgrade: powers off the system, then follows the Delta PSU Update SOP via Redfish to flash PSU firmware; agent needs the exact user-provided PSU image and the updat`
- 📤 產出人:
  log 取位:return the Redfish update/task result + PSU firmware version before/after so user confirms correct PSU firmware.
  risk:RISK: PSU firmware flash is state-changing and can require an AC cycle; flash only the user-specified image with the system powered off
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2230/2290 — `Wistron-BMC Sanity-00014-V001` · Items=Check bootdevice unique name in BIOS setup · TestSet=Flyboy-BMC sanity
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:Check bootdevice unique name in BIOS setup
- Q2 位置:不執行(見說明)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Check OS in boot order display unique name in BIOS, ex: ubuntu 22.04.
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Check bootdevice unique name in BIOS setup
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 2231/2290 — `Wistron-BMC Sanity-00015-V002` · Items=Restrict avahi functionality to eth0 only via checking journactl · TestSet=Flyboy-BMC sanity
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Restrict avahi functionality to eth0 only via checking journactl
- Q2 位置:agent-host(BMC shell 直連)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. Command should work without any error.
2. Ensure avahi function only work on eth0.
- Q6 補什麼:BMC console (journalctl built-in)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Restrict avahi functionality to eth0 only via checking journactl
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `sshpass -p "$BMC_PASS" ssh -o StrictHostKeyChecking=no $BMC_USER@$BMC_IP "journalctl | grep -i avahi 2>&1"`
- 📤 產出人:
  log 取位:return FULL raw `journalctl | grep -i avahi` output so user confirms avahi only works on eth0. No RISK (read-only).
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2232/2290 — `Wistron-BMC Sanity-00016-V001` · Items=Verify BMC serial log excludes "restore_uboot_env_data" · TestSet=Flyboy-BMC sanity
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:Verify BMC serial log excludes "restore_uboot_env_data"
- Q2 位置:不執行(見說明)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Check the log not exists "restore_uboot_env_data".
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Verify BMC serial log excludes "restore_uboot_env_data"
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 2233/2290 — `Wistron-BMC Sanity-00017-V001` · Items=Reset form after OEM Firmware update completes · TestSet=Flyboy-BMC sanity
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:Reset form after OEM Firmware update completes
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:After a successful firmware update, confirm that the selected device and file entries are cleared from the form.
- Q6 補什麼:browser/automation to BMC web + user-provided firmware image
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Reset form after OEM Firmware update completes
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- perform an OEM firmware update through the BMC web Operations>OEM Firmware page, confirm a successful pop-up, then check the selected device/file entries are cleared from the form. Intera`
- 📤 產出人:
  log 取位:return the flash-success status + the form-state after update (selected device/file cleared) so user confirms the form resets.
  risk:RISK: OEM firmware flash is state-changing; flash only the user-specified image on a dedicated SUT
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2234/2290 — `Wistron-BMC Sanity-00018-V001` · Items=Check generate CSR function · TestSet=Flyboy-BMC sanity
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:Check generate CSR function
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1.Check CSR type on BMC web
- Q6 補什麼:browser/automation to BMC web
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Check generate CSR function
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- generate a CSR through the BMC web Security>Certificates page and confirm the CSR type is correct; interactive web step that writes a CSR (certificate request). Agent drives the web gener`
- 📤 產出人:
  log 取位:return the generated CSR + its CSR type/country fields so user confirms CSR type is correct.
  risk:RISK: generating a CSR is state-changing (writes a key/request); confirm and avoid overwriting an existing production CSR
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2235/2290 — `Wistron-BMC Sanity-00019-V001` · Items=Check KVM sessions  status after refresh · TestSet=Flyboy-BMC sanity
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:Check KVM sessions  status after refresh
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1.Check user still login BMC web after press F5
- Q6 補什麼:browser/automation to BMC web
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Check KVM sessions  status after refresh
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- login to the BMC web, press Refresh then F5 and confirm the session persists; interactive browser/session check. Agent drives the browser refresh and confirms the login state.`
- 📤 產出人:
  log 取位:return the login/session state before and after Refresh/F5 so user confirms the user stays logged in.
  risk:RISK: no RISK besides keeping a browser session open; restore to the expected session state after check
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2236/2290 — `Wistron-BMC Sanity-00020-V001` · Items=GPU times sync with BMC time · TestSet=Flyboy-BMC sanity
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:GPU times sync with BMC time
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1.check timestamps of GPU log on BMC web matching BMC time
- Q6 補什麼:curl/D-Bus + BMC web
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:GPU times sync with BMC time
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- compare GPU event-log timestamps with the BMC clock on the BMC web GPU-management Event Logs page; read-only compare but requires the GPU event-log + BMC time readout and a visual/GUI cro`
- 📤 產出人:
  log 取位:return the BMC time and the GPU event-log timestamps so user confirms they match.
  risk:RISK: none
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2237/2290 — `Wistron-BMC Sanity-00021-V001` · Items=Add user account value- Redfish · TestSet=Flyboy-BMC sanity
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:Add user account value- Redfish
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1.Check value can be set successfully
- Q6 補什麼:curl + jq
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Add user account value- Redfish
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- add a new user via Redfish AccountService (state-changing), then GET the account list to confirm the value was set; agent uses `POST https://$BMC_IP/redfish/v1/AccountService/Accounts` th`
- 📤 產出人:
  log 取位:return the POST http code + the account list JSON so user confirms the new user value was set.
  risk:RISK: adding a user account changes BMC access control; use a clearly-named throwaway account and remove it after the check
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2238/2290 — `Wistron-BMC Sanity-00022-V001` · Items=Get header data- Redfish · TestSet=Flyboy-BMC sanity
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Get header data- Redfish
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1.Check value get successfully
- Q6 補什麼:curl + jq
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Get header data- Redfish
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `curl -s -k -u "$BMC_USER:$BMC_PASS" -X GET https://$BMC_IP/redfish/v1 2>&1 | jq`
- 📤 產出人:
  log 取位:return the FULL `GET /redfish/v1` JSON so user confirms data is retrieved with no duplicates. No RISK (read-only).
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2239/2290 — `Wistron-BMC Sanity-00023-V001` · Items=Add HTTPBasicAuth- Redfish · TestSet=Flyboy-BMC sanity
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:Add HTTPBasicAuth- Redfish
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1.Check value can be set successfully
- Q6 補什麼:curl
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Add HTTPBasicAuth- Redfish
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- Add HTTPBasicAuth - Redfish: verify the HTTPBasicAuth toggle on the BMC AccountService. Baseline GET (expect 200), PATCH HTTPBasicAuth=Disabled, re-GET (expect 401), then restore via fact`
  `curl -s -k -u "$BMC_USER:$BMC_PASS" -i https://$BMC_IP/redfish/v1/Systems 2>&1 | head -n 12`
  `curl -s -k -u "$BMC_USER:$BMC_PASS" -H "Content-Type: application/json" -X PATCH -d '{"HTTPBasicAuth":"Disabled"}' https://$BMC_IP/redfish/v1/AccountService 2>&1`
  `curl -s -k -u "$BMC_USER:$BMC_PASS" -i https://$BMC_IP/redfish/v1/Systems 2>&1 | head -n 12`
  `-- restore: `ipmitool raw 0x3a 0x41` (factory reset) re-enables basic auth (operator/system).`
- 📤 產出人:
  log 取位:return the FULL headers body of `curl -k -u root:0penBmc https://$BMC_IP/redfish/v1/Systems -i` so user confirms it returns "HTTP/1.1 200 OK
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️       缺陷**:WR(命令內容與 Items/Procedure 不符 → 依 procedure 重寫);已修 xlsx ; 判定改 col13 YES→PARTIAL(完整流程含 Disable HTTPBasicAuth 狀態寫入 + factory reset,需 operator 批准)

---

### 2240/2290 — `Wistron-BMC Sanity-00024-V001` · Items=KVM session timeout check · TestSet=Flyboy-BMC sanity
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:KVM session timeout check
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1.Check session information via redfish get
2.Session should be closed on close KVM after 5 minutes.
- Q6 補什麼:browser/automation + curl
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:KVM session timeout check
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- launch KVM, read the SessionService Sessions via Redfish, then close KVM and wait ~5 minutes to confirm the session expires. Time-dependent interactive check; agent drives KVM open/close `
- 📤 產出人:
  log 取位:return the session list while KVM is open and after close+5min so user confirms the session is closed on timeout.
  risk:RISK: none; the 5-minute wait is a normal session-timeout check
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2241/2290 — `Wistron-BMC Sanity-00025-V001` · Items=Check UserPrivilege in D-Bus/IPMI privilege · TestSet=Flyboy-BMC sanity
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Check UserPrivilege in D-Bus/IPMI privilege
- Q2 位置:agent-host(BMC shell 直連)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1.Check UserPrivilege mtach in D-Bus/IPMI privilege
- Q6 補什麼:BMC console (busctl + ipmitool built-in)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Check UserPrivilege in D-Bus/IPMI privilege
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `sshpass -p "$BMC_PASS" ssh -o StrictHostKeyChecking=no $BMC_USER@$BMC_IP "busctl introspect xyz.openbmc_project.User.Manager /xyz/openbmc_project/user/root --verbose 2>&1; echo ---; ipmitool`
- 📤 產出人:
  log 取位:return FULL `busctl introspect` privilege output + `ipmitool user list 1` so user confirms UserPrivilege matches in D-Bus and IPMI. No RISK 
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2242/2290 — `Wistron-BMC Sanity-00026-V001` · Items=Check Profile settings on BMC web · TestSet=Flyboy-BMC sanity
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:Check Profile settings on BMC web
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. Data should be readable and correct.
- Q6 補什麼:browser/automation to BMC web
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Check Profile settings on BMC web
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- read the logged-in user Profile settings (User Privilege, Timezone display preference) on the BMC web and confirm data correctness, incl. F5 refresh behavior. Interactive web/GUI read; ag`
- 📤 產出人:
  log 取位:return the profile settings (privilege + timezone) shown before and after F5 so user confirms data is readable/correct.
  risk:RISK: none; read-only GUI inspection
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2243/2290 — `Wistron-BMC Sanity-00027-V001` · Items=IPMI chassis power diag  Command · TestSet=Flyboy-BMC sanity
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:IPMI chassis power diag  Command
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1.Check chassis power diag result
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:IPMI chassis power diag  Command
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "ipmitool chassis power diag 2>&1"`
- 📤 產出人:
  log 取位:return FULL raw `ipmitool chassis power diag` output so user confirms the chassis power diag result. No RISK (read-only diagnostic).
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2244/2290 — `Wistron-BMC Sanity-00028-V001` · Items=Check liquid leak status · TestSet=Flyboy-BMC sanity
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:Check liquid leak status
- Q2 位置:不執行(見說明)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1.Check BMC sel log
2.Check system status
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Check liquid leak status
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 2245/2290 — `Wistron-BMC Sanity-00029-V001` · Items=Check Boot Type status · TestSet=Flyboy-BMC sanity
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Check Boot Type status
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1.Check Boot Type status should be udfi
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Check Boot Type status
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "ipmitool chassis bootparam get 5 2>&1"`
- 📤 產出人:
  log 取位:return FULL raw `ipmitool chassis bootparam get 5` output so user confirms the Boot Type is UEFI. No RISK (read-only).
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2246/2290 — `Wistron-BMC Sanity-00030-V001` · Items=Check DBud data · TestSet=Flyboy-BMC sanity
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Check DBud data
- Q2 位置:agent-host(BMC shell 直連)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. Data should be readable and correct.
- Q6 補什麼:BMC console (busctl built-in)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Check DBud data
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `sshpass -p "$BMC_PASS" ssh -o StrictHostKeyChecking=no $BMC_USER@$BMC_IP "busctl introspect xyz.openbmc_project.State.BIOS.OEM /xyz/openbmc_project/state/bios --verbose 2>&1"`
- 📤 產出人:
  log 取位:return FULL `busctl introspect xyz.openbmc_project.State.BIOS.OEM ... --verbose` output so user confirms the data is readable/correct. No RI
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2247/2290 — `Wistron-BMC Sanity-00031-V001` · Items=Check CPU  threshold log severity · TestSet=Flyboy-BMC sanity
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:Check CPU  threshold log severity
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1.Check BMC sel log
- Q6 補什麼:stress-ng + ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Check CPU  threshold log severity
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- requires setting BIOS CPU to performance mode, running `stress-ng` to push the CPU, then checking the BMC SEL for the CPU threshold event severity. Stress is long-running; agent runs stre`
- 📤 產出人:
  log 取位:return the CPU threshold SEL entries (severity) + the stress-ng summary so user confirms the correct threshold log severity.
  risk:RISK: running CPU stress raises temperature/clock; ensure adequate cooling and that the SUT is dedicated
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2248/2290 — `Wistron-BMC Sanity-00032-V001` · Items=Get AutoVideoSettings-Redfish · TestSet=Flyboy-BMC sanity
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Get AutoVideoSettings-Redfish
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. Data should be readable and correct.
- Q6 補什麼:curl + jq
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Get AutoVideoSettings-Redfish
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `curl -s -k -u "$BMC_USER:$BMC_PASS" -X GET https://$BMC_IP/redfish/v1/Managers/bmc/Oem/Ami/AutoVideoSettings 2>&1 | jq`
- 📤 產出人:
  log 取位:return the FULL AutoVideoSettings JSON so user confirms the data is readable/correct. No RISK (read-only).
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2249/2290 — `Wistron-BMC Sanity-00033-V001` · Items=HTTPS error response code -Redfish · TestSet=Flyboy-BMC sanity
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:HTTPS error response code -Redfish
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. Data should be show "HTTP code 503"
- Q6 補什麼:curl + ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:HTTPS error response code -Redfish
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- run a power-cycle stress while repeatedly GETting /redfish/v1/Systems to confirm an "HTTP 503" during power-off; power cycling is operator/agent-controlled (`ipmitool chassis power off/on`
- 📤 產出人:
  log 取位:return the sequence of HTTP response codes (showing HTTP 503 during power-off) so user confirms the error response is correct.
  risk:RISK: power-cycle stress takes the SUT offline repeatedly; confirm the SUT is dedicated and the cycle count/interval
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2250/2290 — `Wistron-BMC Sanity-00034-V001` · Items=BIOS message registry version · TestSet=Flyboy-BMC sanity
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:BIOS message registry version
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. Data should be readable and correct.
- Q6 補什麼:curl (Redfish EventService)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:BIOS message registry version
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- POST a test event to the EventService (SubmitTestEvent) to exercise the BIOS message registry, then read back the event/registry version. POST is a state-changing test action on the event`
- 📤 產出人:
  log 取位:return the POST http code + the resulting event log entry so user confirms the BIOS message registry version is correct.
  risk:RISK: submitting a test event writes to the BMC event log; confirm and clear/note the test entry after
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2251/2290 — `Wistron-BMC Sanity-00035-V001` · Items=Check /redfish/v1 data without 'Wistron' · TestSet=Flyboy-BMC sanity
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Check /redfish/v1 data without 'Wistron'
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. Data should be readable and correct.
- Q6 補什麼:curl + grep
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Check /redfish/v1 data without 'Wistron'
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `curl -s -k -u "$BMC_USER:$BMC_PASS" -X GET https://$BMC_IP/redfish/v1 2>&1 | grep -i wistron || echo "no Wistron string found"`
- 📤 產出人:
  log 取位:return the FULL `GET /redfish/v1` output (or "no Wistron string found") so user confirms no data includes "Wistron". No RISK (read-only).
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2252/2290 — `Wistron-BMC Sanity-00036-V001` · Items=MaxSess and SessTimeOut function · TestSet=Flyboy-BMC sanity
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:MaxSess and SessTimeOut function
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. MaxSess and SessTimeOu should match spec
- Q6 補什麼:ssh client (multiple concurrent sessions)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:MaxSess and SessTimeOut function
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- open 6 concurrent SSH sessions to the BMC console and check whether the 6th is denied per MaxSess; concurrent-session testing. Agent opens the sessions and reports how many are accepted.`
- 📤 產出人:
  log 取位:return the number of accepted/rejected sessions when 6 are opened simultaneously so user confirms the MaxSess limit.
  risk:RISK: none; opens test sessions that close immediately
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2253/2290 — `Wistron-BMC Sanity-00037-V001` · Items=Check NIC link status and link speed after reset-nic-linkstate · TestSet=Flyboy-BMC sanity
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:Check NIC link status and link speed after reset-nic-linkstate
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. Data should be readable and correct.
- Q6 補什麼:BMC console (reset-nic-linkstate built-in)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Check NIC link status and link speed after reset-nic-linkstate
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- running `reset-nic-linkstate 1` on the BMC console resets the NIC link state (state-changing on the BMC network), then check the NIC link status/speed. Agent runs the command and reads ba`
- 📤 產出人:
  log 取位:return the reset-nic-linkstate output + the NIC link status/speed read-back so user confirms it is correct.
  risk:RISK: resetting NIC link state briefly drops the BMC network path; plan around loss of BMC connectivity
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2254/2290 — `Wistron-BMC Sanity-00038-V001` · Items=Set CbsCmnApbdisDfPstate -Redfish · TestSet=Flyboy-BMC sanity
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:Set CbsCmnApbdisDfPstate -Redfish
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. Data should be readable and correct.
- Q6 補什麼:curl + jq (Redfish)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Set CbsCmnApbdisDfPstate -Redfish
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- GET then PATCH the BIOS setting CbsCmnApbdisDfPstate via Redfish (`GET /redfish/v1/Systems/system/Bios`, then `PATCH` it) to set the pstate disable value; state-changing BIOS setting.`
- 📤 產出人:
  log 取位:return the Redfish GET bios JSON filtered to CbsCmnApbdisDfPstate (before/after) + the PATCH http code so user confirms the value was set co
  risk:RISK: changing a BIOS setting is state-changing and persists across reboot; confirm the desired value and revert after the check
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2255/2290 — `Wistron-BMC Sanity-00039-V001` · Items=Check GPU firmware-Redfish · TestSet=Flyboy-BMC sanity
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Check GPU firmware-Redfish
- Q2 位置:agent-host(BMC shell 直連)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. Data should be readable and correct.
- Q6 補什麼:BMC console (curl built-in)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Check GPU firmware-Redfish
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `sshpass -p "$BMC_PASS" ssh -o StrictHostKeyChecking=no $BMC_USER@$BMC_IP "curl -X GET http://192.168.31.1/redfish/v1/UpdateService/FirmwareInventory/ 2>&1"`
- 📤 產出人:
  log 取位:return FULL raw `curl -X GET http://192.168.31.1/redfish/v1/UpdateService/FirmwareInventory/` output so user confirms the GPU FW is correct.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2256/2290 — `Wistron-HW-00243-V003` · Items=Security mode · TestSet=Security mode
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:Security mode
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. Security mode can be changed successfully.
- Q6 補什麼:mokutil + tpm2-tools (for read-only state check)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Security mode
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- Security mode (sheet-B): change Secure Boot mode/TPM via the BIOS Security page. Agent can read the current secure-boot/TPM state from OS sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecki`
- 📤 產出人:
  log 取位:return the secure-boot state (mokutil --sb-state) + TPM device presence so the user confirms the current state before the operator changes t
  risk:RISK: changing Secure Boot mode needs TPM physical-presence assertion (jumper/switch) and BIOS setup access - operator/setup page required; 
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2257/2290 — `Wistron-HW-00244-V004` · Items=Install OS · TestSet=Security mode
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:Install OS
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1.SUT can install OS, DD and FW successfully with Security boot Enabled
2. CSM disabled and secure boot Standard Mode. And then reboot into OS normal without any warning/error.
- Q6 補什麼:Windows Server ISO + install media; mokutil (for pre-check)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Install OS
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- Install OS sheet-B (Secure Boot enabled): install Windows Server with Secure Boot/TPM on the SUT. Agent pre-checks the secure-boot state from the OS; the OS install itself needs the Windo`
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP"bootctl status 2>&1 | grep -iE 'secure boot|setup mode'; mokutil --sb-state 2>&1"`
- 📤 產出人:
  log 取位:return the pre-install secure-boot status (SecureBoot state + Setup Mode) so the user confirms CSM disabled / Secure Boot Standard Mode befo
  risk:RISK: OS install wipes the boot disk; do not auto-run without an approved ISO and backup of the current OS.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️       缺陷**:Q-LIT(ssh 內層裸雙引號 → 單引號);已修 xlsx

---

### 2258/2290 — `Wistron-BMC-00848-V003` · Items=Check BMC version · TestSet=Version Check
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Check BMC version
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. All BMC versions should be correct.
- Q6 補什麼:ipmitool + curl + jq / dmidecode
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Check BMC version
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" mc info 2>&1 | grep -iE "firmware revision"`
- 📤 產出人:
  log 取位:return the `ipmitool mc info` firmware revision line so user confirms the BMC version. No RISK.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2259/2290 — `Wistron-HW-00180-V003` · Items=Clear CMOS · TestSet=Function Check
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:Clear CMOS
- Q2 位置:不執行(見說明)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. Switch to another side , systerm still can power onsuccessfully.
2. Switch need functionaly.
3. Switch to orginal side , system should not hang or create error log.
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Clear CMOS
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 2260/2290 — `Wistron-HW-00167-V004` · Items=BMC heart beat LED · TestSet=L10 System - LED
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:BMC heart beat LED
- Q2 位置:不執行(見說明)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. LED working mode need to match SPEC
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:BMC heart beat LED
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 2261/2290 — `Wistron-HW-00374-V004` · Items=UID LED with Blue LED · TestSet=L10 System - LED
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:UID LED with Blue LED
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. UID LED should be turned on with Blue color via cmd: ipmitool raw 0x00 0x04 0 0x01
2. UID LED should blink at 1Hz with Blue color via cmd: ipmitool raw 0x00 0x04 0x0f 0
3. UID LED should be turned off via cmd: ipmitool raw 0x00 0x04 0 0
- Q6 補什麼:ipmitool (or curl for Redfish)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:UID LED with Blue LED
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- UID LED with Blue LED: drive the UID/identify LED with `ipmitool chassis identify <on|off>` (or Redfish IndicatorLED PATCH), then confirm color (Blue) + blink on/off. Agent can toggle and`
- 📤 產出人:
  log 取位:return the `ipmitool chassis identify` result + indicator-LED state readback (and note the LED color seen) so user confirms the Blue UID LED
  risk:RISK: turning the UID LED on/off changes an indicator state; restore it to Off after the check.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2262/2290 — `Wistron-HW-00370-V004` · Items=Power Button · TestSet=Front and Rear Panel
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:Power Button
- Q2 位置:不執行(見說明)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. Node should power on after pressing power button when power status is off.
2. Power Button Blink with correct Freq.
3. Power Button Blink with correct Freq.
4. Node should boot into OS successfully when power on.
5. Node should be force off after pressing power button and hold over 4 seconds when power status is on.
6. Node should be gracefully shutdown after pressing power button 1 seconds when power status is on and boot ingo OS.
7. Node that is off should be power on and the node that is on should keep on state after pressing power button one time.
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Power Button
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 2263/2290 — `Wistron-HW-00371-V004` · Items=UID Button · TestSet=Front and Rear Panel
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:UID Button
- Q2 位置:不執行(見說明)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. UID should be ON after press UID button when UID is off
2. UID should be OFF after press UID button when UID is on
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:UID Button
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 2264/2290 — `Wistron-HW-00382-V005` · Items=Power-Supply Fan Failure · TestSet=Power Supply - L10 : Function
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:Power-Supply Fan Failure
- Q2 位置:不執行(見說明)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. PSU information in sensor list and SEL of BMC should be correct when PSU FAN is jammed
2. PSU LED should be amber flash when FAN failure.
3. PSU LED should be GREEN after removed the obstruction and replug power cord.
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Power-Supply Fan Failure
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 2265/2290 — `Wistron-HW-00304-V005` · Items=BMC UART debugging · TestSet=Debug Console
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:BMC UART debugging
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. Output of console should be human readable 
2. Should be able to control SUT in console mode via keyboard.
- Q6 補什麼:physical USB-UART debug cable (human)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:BMC UART debugging
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 2266/2290 — `Wistron-HW-00024-V003` · Items=Mellanox - CX7 Cable · TestSet=Mechanical -AVL
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:Mellanox - CX7 Cable
- Q2 位置:不執行(見說明)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:All components should be seated properly
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Mellanox - CX7 Cable
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 2267/2290 — `Wistron-HW-00025-V003` · Items=Mellanox - CX7 Board · TestSet=Mechanical -AVL
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:Mellanox - CX7 Board
- Q2 位置:不執行(見說明)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:All components should be seated properly
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Mellanox - CX7 Board
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 2268/2290 — `Wistron-HW-00026-V003` · Items=Mellanox - BF3 Cable · TestSet=Mechanical -AVL
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:Mellanox - BF3 Cable
- Q2 位置:不執行(見說明)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:All components should be seated properly
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Mellanox - BF3 Cable
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 2269/2290 — `Wistron-HW-00027-V003` · Items=Mellanox - BF3 Board · TestSet=Mechanical -AVL
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:Mellanox - BF3 Board
- Q2 位置:不執行(見說明)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:All components should be seated properly
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Mellanox - BF3 Board
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 2270/2290 — `Wistron-BMC-00957-V002` · Items=TEMP_HIB_PEX · TestSet=IPM Sensor List Commands
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:TEMP_HIB_PEX
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. Sensor's name, description, and reading of SDR-List should match SPEC definition.
2. Sensor's name, description, and reading of Sensor-List should match SPEC definition.
3. BMC web information match SPEC definition.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:TEMP_HIB_PEX
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- TEMP_HIB_PEX: read the TEMP_HIB_PEX sensor via ipmitool (OOB, from the agent host) and confirm name/description/reading match SPEC.`
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'TEMP_HIB_PEX' 2>&1`
- 📤 產出人:
  log 取位:none (awaiting exact command bytes/expected result).
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️       缺陷**:FAKE(「not directly runnable / give exact bytes」實為可跑的 OOB sensor get → 真命令);已修 xlsx ; 判定改 col13 PARTIAL→YES(OOB 只讀 sensor get,同區 1891 已是 YES);pkg 維持 ipmitool

---

### 2271/2290 — `Wistron-HW-00475-V002` · Items=MLPerf - Retinanet _Offline · TestSet=MLPerf
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:MLPerf - Retinanet _Offline
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. The mlperf inference can be executed without error. 

2. To compare score with mlcommons.
- Q6 補什麼:util-linux (lscpu) dmidecode + MLPerf inference toolkit (operator-provided)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:MLPerf - Retinanet _Offline
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- MLPerf - Retinanet Offline: pre-check the SUT inventory, then run the MLPerf inference benchmark (retinanet / offline) with the operator-provided MLPerf harness and compare the score agai`
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP"lscpu 2>&1 | grep -iE 'vendor|model name|architecture'; dmidecode -t 4 2>/dev/null | grep -iE 'manufacturer|version|f`
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP"cd ${MLPERF_DIR:?operator provides the MLPerf inference toolkit path}; ${MLPERF_RUN_CMD:?operator provides the MLPerf`
  `-- MLPerf harness/CUDA/GPU driver/weights are operator-provided (licensed data).`
- 📤 產出人:
  log 取位:return FULL Vendor ID output (lscpu 2>&1 | grep -iE "vendor|model name|architecture") so the user confirms the value(s) match the spec/datas
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️       缺陷**:WR(命令內容與 Items/Procedure 不符 → 依 procedure 重寫);已修 xlsx

---

### 2272/2290 — `Wistron-HW-00483-V002` · Items=Sensor Check - PDB · TestSet=Sensor check
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Sensor Check - PDB
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. Sensor's name, description, and reading of SDR-List should match SPEC definition.
2. Sensor's name, description, and reading of Sensor-List should match SPEC definition.
21. BMC web information match SPEC definition.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Sensor Check - PDB
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'Sensor Check - PDB' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `Sensor Check - PDB`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2273/2290 — `Wistron-BMC-00694-V003` · Items=Leaky sensor line · TestSet=Leaking Check
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:Leaky sensor line
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. Leaky sensor should record a warning or error message.
2. System should have correct behavior ex: shutdown in 1 min.
3. Sensor should recover after leaky sensor line detection is dry.
- Q6 補什麼:none (physical leak-test - human)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Leaky sensor line
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 2274/2290 — `Wistron-BMC-00693-V003` · Items=Connector leaky sensor · TestSet=Leaking Check
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:Connector leaky sensor
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. Leaky sensor should record a warning or error message.
2. System should have correct behavior ex: shutdown in 1 min.
3. Sensor should recover after connector is dry.
- Q6 補什麼:none (physical liquid-leak test - human)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Connector leaky sensor
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 2275/2290 — `Wistron-HW-00447-V002` · Items=Release note · TestSet=FW package check
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Release note
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Criteria:
1. All information should be readable and no spelling error
2. FW Version should be correct
3. Description of new features, defect fixed and known issues should be clear
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Release note
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️       缺陷**:WR(命令內容與 Items/Procedure 不符 → 依 procedure 重寫);已修 xlsx

---

### 2276/2290 — `Wistron-HW-00245-V003` · Items=BMC FW Update · TestSet=BMC Validation
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:BMC FW Update
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. AST1060 check BMC verify ok and BMC boot up success
- Q6 補什麼:a deliberately corrupt / older BMC image (user-provided) + curl + BMC creds
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:BMC FW Update
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- BMC FW Update: attempt to update the BMC with a corrupt update image / an older (downgrade) image and confirm the BMC rejects it (ipmitool -I lanplus -C 17 -U "$BMC_USER" -P "$BMC_PASS" -`
- 📤 產出人:
  log 取位:return the UpdateService POST error + the pre/post BMC version (unchanged) so the user confirms the bad/downgrade image was rejected without
  risk:RISK: using a corrupt/older image is safe only because it must be rejected; never flash a working newer image in this test.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2277/2290 — `Wistron-HW-00246-V003` · Items=BMC FW Recovery · TestSet=BMC Validation
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:BMC FW Recovery
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. AST1060 checks BMC verify ok and BMC boot up success
- Q6 補什麼:recovery image + BMC recovery process (user-staged)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:BMC FW Recovery
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- BMC FW Recovery: recover the BMC from a forced corrupt/empty state via the recovery image/RoP (Recovery of Last Resort) mechanism; the recovery flow is staged by the operator (offline / B`
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" mc info 2>&1 | head -n 20`
- 📤 產出人:
  log 取位:return the recovery flow output + the post-recovery BMC version so the user confirms the BMC came back from the forced-bad state. (context: 
  risk:RISK: firmware recovery deliberately breaks/interrupts the component; only run under user direction with the recovery image and console, nev
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️       缺陷**:Q-LIT+R5(內層引號 + OOB 雙跳 → agent-host);已修 xlsx

---

### 2278/2290 — `Wistron-HW-00248-V003` · Items=Reject BMC FW Downgrade · TestSet=BMC Validation
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:Reject BMC FW Downgrade
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. Confirm that platform blocks the update.
- Q6 補什麼:a deliberately corrupt / older BMC image (user-provided) + curl + BMC creds
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Reject BMC FW Downgrade
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- Reject BMC FW Downgrade: attempt to update the BMC with a corrupt update image / an older (downgrade) image and confirm the BMC rejects it (ipmitool -I lanplus -C 17 -U "$BMC_USER" -P "$B`
- 📤 產出人:
  log 取位:return the UpdateService POST error + the pre/post BMC version (unchanged) so the user confirms the bad/downgrade image was rejected without
  risk:RISK: using a corrupt/older image is safe only because it must be rejected; never flash a working newer image in this test.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2279/2290 — `Wistron-HW-00247-V003` · Items=Reject BMC Update with Corrupt Update Image · TestSet=BMC Validation
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:Reject BMC Update with Corrupt Update Image
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. AST1060 should reject the update
- Q6 補什麼:a deliberately corrupt / older BMC image (user-provided) + curl + BMC creds
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Reject BMC Update with Corrupt Update Image
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- Reject BMC Update with Corrupt Update Image: attempt to update the BMC with a corrupt update image / an older (downgrade) image and confirm the BMC rejects it (ipmitool -I lanplus -C 17 -`
- 📤 產出人:
  log 取位:return the UpdateService POST error + the pre/post BMC version (unchanged) so the user confirms the bad/downgrade image was rejected without
  risk:RISK: using a corrupt/older image is safe only because it must be rejected; never flash a working newer image in this test.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2280/2290 — `Wistron-BMC-00878-V003` · Items=Operations - Reboot BMC · TestSet=Operations
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:Operations - Reboot BMC
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. During BMC reboot, BMC-IP should disconnected.
2. After BMC reboot, BMC-IP should become connected, and BMC functions should be workable.
- Q6 補什麼:ipmitool/curl + BMC creds
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Operations - Reboot BMC
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- Operations - Reboot BMC: reboot the BMC via ipmitool -I lanplus -C 17 -U "$BMC_USER" -P "$BMC_PASS" -H "$BMC_IP" mc reset cold 2>&1 or Redfish Manager.Reset; state-changing.`
- 📤 產出人:
  log 取位:return the reset command response + after ~60s confirm the BMC returns (ping + ipmitool -I lanplus -U "$BMC_USER" -P "$BMC_PASS" -H "$BMC_IP
  risk:RISK: BMC reset drops the out-of-band session; run with a console path and no critical job in flight.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2281/2290 — `Wistron-HW-00176-V003` · Items=Location check · TestSet=Information
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:Location check
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. Make sure Switch location is correct.
- Q6 補什麼:physical access to the switch (operator)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Location check
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 2282/2290 — `Wistron-HW-00165-V003` · Items=Location Check · TestSet=Jumper
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:Location Check
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. Make sure Jumoer location is correct.
- Q6 補什麼:none (physical inspection - human)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Location Check
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 2283/2290 — `Wistron-HW-00163-V003` · Items=Jumper check · TestSet=Jumper
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:Jumper check
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. Jumper should match with system spec.
- Q6 補什麼:none (physical inspection - human)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Jumper check
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 2284/2290 — `Wistron-HW-00164-V003` · Items=Function Check · TestSet=Jumper
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:Function Check
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. Switch jumper to another pin , systerm still can power on successfully.2. Jumper need functionaly.3. Switch jumper to default pin , system should not hang or create error log.
- Q6 補什麼:none (physical jumper action - human)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Function Check
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 2285/2290 — `Wistron-HW-00472-V002` · Items=TH.1_Thermal Stress Test · TestSet=Thermal
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:TH.1_Thermal Stress Test
- Q2 位置:agent-host(BMC shell 直連)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Test successfully complete without triggering any thremal warnings or faults
- Q6 補什麼:stress-ng (install) + nvidia-smi + ipmitool (OOB temp read)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:TH.1_Thermal Stress Test
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- TH.1_Thermal Stress Test: run a full-power thermal stress on the DUT (CPU/GPU + external components) and confirm no thermal warnings/faults are logged. The worst-case ambient / thermal ch`
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP"stress-ng --cpu 0 --cpu-method all --timeout ${THERMAL_DURATION:?operator sets the soak duration} 2>&1 | tail -n 15; `
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sdr list 2>&1 | grep -iE 'TEMP|THERMAL' | head -n 30`
- 📤 產出人:
  log 取位:return the 10000x Tx-eq redo run log + `lspci -vvv LnkSta`/dmesg sweep; user confirms link trains with no errors. Very long - confirm approv
  risk:RISK: repeated Tx equalization redos stress the PCIe link; dedicated SUT + approval.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️       缺陷**:WR(命令內容與 Items/Procedure 不符 → 依 procedure 重寫);已修 xlsx

---

### 2286/2290 — `Wistron-GB NV PVP HW-00015-V003` · Items=Field RMA Diagnostics · TestSet=Fieldding
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:Field RMA Diagnostics
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:When completed, the diagnostic will return 0 to the shell if completed
normally. If an error occurs, it will return 1 to the shell, and if a retest is
required it will return 2. It will also print “PASS”, “FAIL”, or “RETEST” to
the screen.
PASS – The hardware passes the diagnostics
FAIL – The hardware has failed the diagnostics
RETEST – The hardware setup has failed the pre-check portion of the
diagnostics and a warning message appears describing the problem.
Correct the problem per the pre-check message and then test again.
- Q6 補什麼:NVIDIA field-RMA diagnostic package (user-provided); Python 3.10 + glibc 2.12+
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Field RMA Diagnostics
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- Field RMA Diagnostics: run the GB field RMA diagnostics (Python-based, supported kernels listed). Agent runs the diagnostic executable sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=`
- 📤 產出人:
  log 取位:return the diagnostic exit code + the printed PASS/FAIL/RETEST marker so the user confirms the hardware passes (0/PASS) or sees the FAIL/RET
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2287/2290 — `Wistron-GB NV PVP HW-00489-V003` · Items=Partner Diagnostics · TestSet=Mfgdiag
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:Partner Diagnostics
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:PASS – The hardware passes the diagnostics
FAIL – The hardware has failed the diagnostics
- Q6 補什麼:partnerdiag + spec_cx8aas_board_partner_mfg.json (user-provided)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Partner Diagnostics
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- Partner Diagnostics (GB Partner Mfg Diagnostics): cd to the diag directory and run sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "./partnerdiag --mfg --run_spec`
- 📤 產出人:
  log 取位:return the partnerdiag manufacturing output (PASS/FAIL/RETEST printed at end) so the user confirms the hardware passes manufacturing.
  risk:RISK: manufacturing diag exercises the board hardware; run in a maintenance window.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2288/2290 — `Wistron-HW-00455-V002` · Items=CPU1 · TestSet=I3C
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= UNRESOLVED** | exec 模式 = `不確定(TBD 資料)`

**8 問**:
- Q1 測什麼:CPU1
- Q2 位置:無法判定(資料 TBD)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:CPU1
- Q6 補什麼:i3c-tools (vendor/operator-provided)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:CPU1
- 📥 變數:無(Procedure/Criteria 即 TBD,無法推導)
- ▶ 指令:`--`(TBD,見 ai_commands)
- 📤 產出人:operator 於測試庫補 TBD 後重審,agent 未跑
- 🚧 判斷閘:UNRESOLVED,等 operator 補資料

**§十八 h 三項**:執行模式=`不確定(TBD 資料)` / operator slot=`無法判定` / 邏輯 sanity=`資料 TBD;8 問答不出(鎖版 §二十 aa / §二十一)`
**⚠️       缺陷**:WR(命令內容與 Items/Procedure 不符 → 依 procedure 重寫);已修 xlsx

---

### 2289/2290 — `Wistron-HW-00455-V002` · Items=CPU1 · TestSet=I3C
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= UNRESOLVED** | exec 模式 = `不確定(TBD 資料)`

**8 問**:
- Q1 測什麼:CPU1
- Q2 位置:無法判定(資料 TBD)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:CPU1
- Q6 補什麼:i3c-tools (vendor/operator-provided)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:CPU1
- 📥 變數:無(Procedure/Criteria 即 TBD,無法推導)
- ▶ 指令:`--`(TBD,見 ai_commands)
- 📤 產出人:operator 於測試庫補 TBD 後重審,agent 未跑
- 🚧 判斷閘:UNRESOLVED,等 operator 補資料

**§十八 h 三項**:執行模式=`不確定(TBD 資料)` / operator slot=`無法判定` / 邏輯 sanity=`資料 TBD;8 問答不出(鎖版 §二十 aa / §二十一)`
**⚠️       缺陷**:WR(命令內容與 Items/Procedure 不符 → 依 procedure 重寫);已修 xlsx

---

### 2290/2290 — `Wistron-HW-00451-V002` · Items=Cable · TestSet=I2C
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= UNRESOLVED** | exec 模式 = `不確定(TBD 資料)`

**8 問**:
- Q1 測什麼:Cable
- Q2 位置:無法判定(資料 TBD)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Cable
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Cable
- 📥 變數:無(Procedure/Criteria 即 TBD,無法推導)
- ▶ 指令:`--`(TBD,見 ai_commands)
- 📤 產出人:operator 於測試庫補 TBD 後重審,agent 未跑
- 🚧 判斷閘:UNRESOLVED,等 operator 補資料

**§十八 h 三項**:執行模式=`不確定(TBD 資料)` / operator slot=`無法判定` / 邏輯 sanity=`資料 TBD;8 問答不出(鎖版 §二十 aa / §二十一)`

---
