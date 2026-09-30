## 批次說明(第 2001–2200 條組成)

| 區段 | 約 row | 類型 | 主判定 |
|---|---|---|---|
| Mechanical System/AVL(DC-SCM/OSFP/Mellanox CX8/BF3/CX9/BF4)+SF600 flash | 2003–2009 | 物理/目視 | NO |
| Sensor check 全量(MB/Proc/OSFP/PCIE/CX8/NM/RETIMER/PDB/HSC/TEMP/INTB/LAN/NIC/PCIE_SW/VOLT/AMP/CPU_DIMM/WATCHDOG/STATUS/PSU/POWER/GB/GPU...) | 2010–2040 | OOB sensor get | YES(2 判改) |
| Storage M.2 FW flash(+/-)+BIOS C/P-state | 2041–2044 | 物理 flash / DUT 讀 | PARTIAL |
| PCIe Switch FW flash(誤置 DC-Cycle 文字) | 2045 | DUT vendor tool | PARTIAL |
| BMC remove Mgmt(UBB/OAM Telemetry/FW/Health/SMC/Log/Power,BMC VNIC 192.168.31.1) | 2050–2055 | DUT 側 Redfish | PARTIAL |
| AMD System Stress(AMD-SMI/AGFHC PCIe/XGMI/HBM/GFX/miniHPL/maxPower)+GPU thermal/maxpower+reboot | 2056–2067 | DUT 只讀 + vendor tool | PARTIAL |
| AMD RAS amdgpuras 全系 EINJ/UMC/GFX/XGMI/PCIe/SDMA poison/threshold | 2047/2070–2091 | DUT in-band 注入 | PARTIAL |
| BMC Dimm usage(BMC shell 直連) | 2092 | agent-host→BMC | PARTIAL |
| LC Tray Leak(小漏/自測/斷線)+Power EDPp | 2093–2098 | 物理 + OOB ipmitool | NO/PARTIAL |
| GB NV PVP PCIe EOM/SpeedChange/LTSSM hot-reset | 2099–2122 | vendor NVQual/LTSSM | PARTIAL |
| HGX NV PVP PCIe/NVLink/Storage/Networking(HGX EC.x/NT.x)+HMC/USB/SY/DG/SSVT/NVRAS/NVDebug | 2122–2156 | vendor tool | PARTIAL |
| GB NV PVP I2C(IC.1~7)/SPI(SP.1~2)/UART(UA.1~3)/USB(US.1~6) | 2157–2175 | 物理+BMC/DUT 讀 | PARTIAL/NO |
| BIOS default/Change default - Intel(Processor~APM) | 2176–2189 | 互動 BIOS | NO |
| Mechanical AVL(CX9/BF4)+Vendor ID+PCIe Slot+Display+EGM | 2190–2197 | 物理/目視 + DUT 讀 | NO/PARTIAL |
| MODS Test(CPUDVFS/Thermal/USB MCTP/NVMe)+Telemetry INA/OVRM | 2198–2202 | vendor MODS(OOB sensor 讀) | PARTIAL(5 TBD→UNRESOLVED) |

## 第 2001–2200 條 review 統計

**verdict(§二十一 鎖版)分布(本批 200 條)**:
| verdict | 條數 | 說明 |
|---|---|---|
| NO/PHYSICAL | 34 | 目視(Mechanical/LED)/物理(SPI/UART/USB/LC leak)+ BIOS pre-OS 互動 |
| PARTIAL | 120 | 前置(NVQual/LTSSM/AGFHC/amdxio/amdsmi/MODS/NVSSVT/NVRAS/partnerdiag 等 vendor tool、BIOS 改、SMC reset 寫、BMC VNIC) |
| YES | 41 | 純讀:sensor get/OOB ipmitool/只讀 ssh |
| UNRESOLVED | 5 | MODS Test + Telemetry INA/OVRM 5 行 Criteria/During-Test 即 TBD |

**瑕疵統計(本批實際修進 xlsx)**:
| class | 條數 | 對應編號(rows) |
|---|---|---|
| Q-LIT(ssh 內層雙引號 → 單引號 / 遠端迴圈變數逸出) | 29 | 2049/2066/2105/2123/2125/2149/2151/2154/2155/2166/2167/2168/2169–2174/2194/2198–2201 + BMC-VNIC 2050–2055 |
| Q-LIT+DBL-SSH(收斂雙層 sshpass 為一跳) | 2 | 2043/2044 |
| R5(BMC shell 誤經 DUT 雙跳 → agent-host 直連) | 1 | 2092 |
| WR(sensor 名/命令內容與 Items 不符 → 重寫) | 5 | 2012/2028/2039/2045/2202 |
| VERDICT(col13 判改) + PKG(col14 套件) | 2+2 | 2012 PARTIAL→YES、2039 NO→YES + pkg→ipmitool |

> 多類在某 row 重疊,獨特 row = **37**;ai_commands col15 diff = 37 cells;ai_can_execute col13 = 2(2012/2039);ai_packages_needed col14 = 2(2012/2039)。**全 Functionality**.

**🔄 累計(第 1–2200 條)**:
| verdict | 條數 |
|---|---|
| NO/PHYSICAL | 385 |
| PARTIAL | 771 |
| YES | 876 |
| UNRESOLVED | 168 |
| 合計 | 2200 |

**✅ 本批缺陷已實際修進 xlsx**:29 Q-LIT + 2 Q-LIT+DBL-SSH + 1 R5 + 5 WR + 2 判改(2012/2039)+ 2 pkg = **41 cells**(37 col15 + 2 col13 + 2 col14)。
零回歸:對 bak_rev02_batch11 逐 cell 比對,Functionality diff = 恰 41 cells;5 其它 sheet 0 diff;cyrillic=0 / U+FFFD=0;git HEAD `5a60875` 未動;`data/tests.json` 未同步(等 operator)。

---

## 逐條 review(第 2001–2200 條)

### 2001/2200 — `Wistron-HW-00002-V002` · Items=DC-SCM · TestSet=Mechanical -System
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:DC-SCM
- Q2 位置:不執行(見說明)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:All components should be seated properly
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:DC-SCM
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 2002/2200 — `Wistron-HW-00003-V002` · Items=OSFP Module · TestSet=Mechanical -System
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:OSFP Module
- Q2 位置:不執行(見說明)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:All components should be seated properly
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:OSFP Module
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 2003/2200 — `Wistron-HW-00001-V002` · Items=Mellanox - CX8 Cable · TestSet=Mechanical -AVL
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:Mellanox - CX8 Cable
- Q2 位置:不執行(見說明)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:All components should be seated properly
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Mellanox - CX8 Cable
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 2004/2200 — `Wistron-HW-00002-V002` · Items=Mellanox - CX8 Board · TestSet=Mechanical -AVL
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:Mellanox - CX8 Board
- Q2 位置:不執行(見說明)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:All components should be seated properly
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Mellanox - CX8 Board
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 2005/2200 — `Wistron-HW-00003-V002` · Items=Mellanox - BF3 Cable · TestSet=Mechanical -AVL
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

### 2006/2200 — `Wistron-HW-00004-V002` · Items=Mellanox - BF3 Board · TestSet=Mechanical -AVL
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

### 2007/2200 — `Wistron-BMC-00001-V002` · Items=Flash by SF600 · TestSet=Sanity BMC Flash
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:Flash by SF600
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. Make sure the ROM can work normally after stress
- Q6 補什麼:SF600 physical flash tool (hardware)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Flash by SF600
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 2008/2200 — `Wistron-BMC-01031-V002` · Items=Sensor Check - MB · TestSet=Sensor check
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Sensor Check - MB
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:"1. Sensor's name, description, and reading of SDR-List should match SPEC definition.
2. Sensor's name, description, and reading of Sensor-List should match SPEC definition.
3. BMC web information match SPEC definition."
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Sensor Check - MB
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'Sensor Check - MB' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `Sensor Check - MB`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2009/2200 — `Wistron-BMC-01032-V002` · Items=Sensor Check - Processor · TestSet=Sensor check
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Sensor Check - Processor
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:"1. Sensor's name, description, and reading of SDR-List should match SPEC definition.
2. Sensor's name, description, and reading of Sensor-List should match SPEC definition.
6. BMC web information match SPEC definition."
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Sensor Check - Processor
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'Sensor Check - Processor' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `Sensor Check - Processor`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2010/2200 — `Wistron-HW-00482-V002` · Items=Sensor Check - PCH · TestSet=Sensor check
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Sensor Check - PCH
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:"1. Sensor's name, description, and reading of SDR-List should match SPEC definition.
2. Sensor's name, description, and reading of Sensor-List should match SPEC definition.
10. BMC web information match SPEC definition."
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Sensor Check - PCH
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- Sensor Check - PCH: read the PCH sensor via ipmitool (OOB, from the agent host) and confirm name/description/reading match SPEC.`
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'Sensor Check - PCH' 2>&1`
- 📤 產出人:
  log 取位:return the MODS NVMe/E1.S R/W test output so the user confirms the drive read/write passed; exact command after MODS install.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️      缺陷**:WR(命令內容/感測器名稱與 Items 不符 → 依 Items/procedure 重寫);已修 xlsx ; 判定已改 col13 PARTIAL→YES(col15 重寫為同類只讀 sensor get);pkg col14 改為 ipmitool

---

### 2011/2200 — `Wistron-BMC-01033-V002` · Items=Sensor Check - OSFP · TestSet=Sensor check
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Sensor Check - OSFP
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:"1. Sensor's name, description, and reading of SDR-List should match SPEC definition.
2. Sensor's name, description, and reading of Sensor-List should match SPEC definition.
13. BMC web information match SPEC definition."
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Sensor Check - OSFP
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'Sensor Check - OSFP' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `Sensor Check - OSFP`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2012/2200 — `Wistron-BMC-01034-V002` · Items=Sensor Check - PCIE · TestSet=Sensor check
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Sensor Check - PCIE
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. Sensor's name, description, and reading of SDR-List should match SPEC definition.
2. Sensor's name, description, and reading of Sensor-List should match SPEC definition.
15. BMC web information match SPEC definition.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Sensor Check - PCIE
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'Sensor Check - PCIE' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `Sensor Check - PCIE`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2013/2200 — `Wistron-BMC-01035-V002` · Items=Sensor Check - CX8 · TestSet=Sensor check
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Sensor Check - CX8
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. Sensor's name, description, and reading of SDR-List should match SPEC definition.
2. Sensor's name, description, and reading of Sensor-List should match SPEC definition.
17. BMC web information match SPEC definition.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Sensor Check - CX8
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'Sensor Check - CX8' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `Sensor Check - CX8`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2014/2200 — `Wistron-BMC-01036-V002` · Items=Sensor Check - NM · TestSet=Sensor check
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Sensor Check - NM
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:"1. Sensor's name, description, and reading of SDR-List should match SPEC definition.
2. Sensor's name, description, and reading of Sensor-List should match SPEC definition.
18. BMC web information match SPEC definition."
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Sensor Check - NM
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'Sensor Check - NM' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `Sensor Check - NM`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2015/2200 — `Wistron-BMC-01037-V002` · Items=Sensor Check - RETIMER · TestSet=Sensor check
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Sensor Check - RETIMER
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:"1. Sensor's name, description, and reading of SDR-List should match SPEC definition.
2. Sensor's name, description, and reading of Sensor-List should match SPEC definition.
19. BMC web information match SPEC definition."
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Sensor Check - RETIMER
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'Sensor Check - RETIMER' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `Sensor Check - RETIMER`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2016/2200 — `Wistron-BMC-01038-V002` · Items=Sensor Check - PDB · TestSet=Sensor check
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

### 2017/2200 — `Wistron-BMC-01039-V002` · Items=Sensor Check - HSC · TestSet=Sensor check
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Sensor Check - HSC
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. Sensor's name, description, and reading of SDR-List should match SPEC definition.
2. Sensor's name, description, and reading of Sensor-List should match SPEC definition.
22. BMC web information match SPEC definition.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Sensor Check - HSC
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'Sensor Check - HSC' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `Sensor Check - HSC`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2018/2200 — `Wistron-BMC-01040-V002` · Items=Sensor Check - TEMP_AMBIENT · TestSet=Sensor check
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Sensor Check - TEMP_AMBIENT
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. Sensor's name, description, and reading of SDR-List should match SPEC definition.
2. Sensor's name, description, and reading of Sensor-List should match SPEC definition.
24. BMC web information match SPEC definition.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Sensor Check - TEMP_AMBIENT
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'Sensor Check - TEMP_AMBIENT' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `Sensor Check - TEMP_AMBIENT`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2019/2200 — `Wistron-BMC-01041-V002` · Items=Sensor Check - INTB · TestSet=Sensor check
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Sensor Check - INTB
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. Sensor's name, description, and reading of SDR-List should match SPEC definition.
2. Sensor's name, description, and reading of Sensor-List should match SPEC definition.
25. BMC web information match SPEC definition.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Sensor Check - INTB
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'Sensor Check - INTB' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `Sensor Check - INTB`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2020/2200 — `Wistron-BMC-01042-V002` · Items=Sensor Check - LAN · TestSet=Sensor check
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Sensor Check - LAN
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. Sensor's name, description, and reading of SDR-List should match SPEC definition.
2. Sensor's name, description, and reading of Sensor-List should match SPEC definition.
26. BMC web information match SPEC definition.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Sensor Check - LAN
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'Sensor Check - LAN' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `Sensor Check - LAN`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2021/2200 — `Wistron-BMC-01043-V002` · Items=Sensor Check - INTEL_NIC · TestSet=Sensor check
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Sensor Check - INTEL_NIC
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. Sensor's name, description, and reading of SDR-List should match SPEC definition.
2. Sensor's name, description, and reading of Sensor-List should match SPEC definition.
27. BMC web information match SPEC definition.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Sensor Check - INTEL_NIC
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'Sensor Check - INTEL_NIC' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `Sensor Check - INTEL_NIC`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2022/2200 — `Wistron-BMC-01044-V002` · Items=Sensor Check - NIC_QSFP · TestSet=Sensor check
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Sensor Check - NIC_QSFP
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. Sensor's name, description, and reading of SDR-List should match SPEC definition.
2. Sensor's name, description, and reading of Sensor-List should match SPEC definition.
28. BMC web information match SPEC definition.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Sensor Check - NIC_QSFP
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'Sensor Check - NIC_QSFP' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `Sensor Check - NIC_QSFP`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2023/2200 — `Wistron-BMC-01045-V002` · Items=Sensor Check - PCIE_SW · TestSet=Sensor check
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Sensor Check - PCIE_SW
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. Sensor's name, description, and reading of SDR-List should match SPEC definition.
2. Sensor's name, description, and reading of Sensor-List should match SPEC definition.
29. BMC web information match SPEC definition.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Sensor Check - PCIE_SW
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'Sensor Check - PCIE_SW' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `Sensor Check - PCIE_SW`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2024/2200 — `Wistron-BMC-01046-V002` · Items=Sensor Check - VOLT · TestSet=Sensor check
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Sensor Check - VOLT
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. Sensor's name, description, and reading of SDR-List should match SPEC definition.
2. Sensor's name, description, and reading of Sensor-List should match SPEC definition.
31. BMC web information match SPEC definition.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Sensor Check - VOLT
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'Sensor Check - VOLT' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `Sensor Check - VOLT`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2025/2200 — `Wistron-BMC-01047-V002` · Items=Sensor Check - AMP · TestSet=Sensor check
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Sensor Check - AMP
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. Sensor's name, description, and reading of SDR-List should match SPEC definition.
2. Sensor's name, description, and reading of Sensor-List should match SPEC definition.
44. BMC web information match SPEC definition.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Sensor Check - AMP
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'Sensor Check - AMP' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `Sensor Check - AMP`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2026/2200 — `Wistron-HW-00483-V002` · Items=Power Reading Check - PWR · TestSet=Sensor check
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Power Reading Check - PWR
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. Sensor's name, description, and reading of SDR-List should match SPEC definition.
2. Sensor's name, description, and reading of Sensor-List should match SPEC definition.
46. BMC web information match SPEC definition.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Power Reading Check - PWR
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'Power Reading Check - PWR' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `Sensor Check - PDB`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️      缺陷**:WR(命令內容/感測器名稱與 Items 不符 → 依 Items/procedure 重寫);已修 xlsx

---

### 2027/2200 — `Wistron-BMC-01048-V002` · Items=Power Reading - Processor · TestSet=Sensor check
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Power Reading - Processor
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. Sensor's name, description, and reading of SDR-List should match SPEC definition.
2. Sensor's name, description, and reading of Sensor-List should match SPEC definition.
55. BMC web information match SPEC definition.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Power Reading - Processor
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'Power Reading - Processor' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `Power Reading - Processor`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2028/2200 — `Wistron-BMC-01049-V002` · Items=Power Reading - CPU_DIMM · TestSet=Sensor check
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Power Reading - CPU_DIMM
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. Sensor's name, description, and reading of SDR-List should match SPEC definition.
2. Sensor's name, description, and reading of Sensor-List should match SPEC definition.
56. BMC web information match SPEC definition.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Power Reading - CPU_DIMM
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'Power Reading - CPU_DIMM' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `Power Reading - CPU_DIMM`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2029/2200 — `Wistron-BMC-01050-V002` · Items=WATCHDOG2 · TestSet=Sensor check
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:WATCHDOG2
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. Sensor's name, description, and reading of SDR-List should match SPEC definition.
2. Sensor's name, description, and reading of Sensor-List should match SPEC definition.
69. BMC web information match SPEC definition.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:WATCHDOG2
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'WATCHDOG2' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `WATCHDOG2`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2030/2200 — `Wistron-BMC-00484-V003` · Items=Status Check - STATUS · TestSet=Sensor check
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Status Check - STATUS
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. Sensor's name, description, and reading of SDR-List should match SPEC definition.
2. Sensor's name, description, and reading of Sensor-List should match SPEC definition.
71. BMC web information match SPEC definition.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Status Check - STATUS
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'Status Check - STATUS' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `Status Check - STATUS`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2031/2200 — `Wistron-BMC-01052-V002` · Items=REDUNDANCY_PSU · TestSet=Sensor check
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:REDUNDANCY_PSU
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. Sensor's name, description, and reading of SDR-List should match SPEC definition.
2. Sensor's name, description, and reading of Sensor-List should match SPEC definition.
77. BMC web information match SPEC definition.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:REDUNDANCY_PSU
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'REDUNDANCY_PSU' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `REDUNDANCY_PSU`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2032/2200 — `Wistron-BMC-01053-V002` · Items=Check POWER · TestSet=Sensor check
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Check POWER
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. Sensor's name, description, and reading of SDR-List should match SPEC definition.
2. Sensor's name, description, and reading of Sensor-List should match SPEC definition.
78. BMC web information match SPEC definition.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Check POWER
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'Check POWER' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `Check POWER`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2033/2200 — `Wistron-BMC-01054-V002` · Items=Check Config - SYSTEM_CONFIG · TestSet=Sensor check
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Check Config - SYSTEM_CONFIG
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. Sensor's name, description, and reading of SDR-List should match SPEC definition.
2. Sensor's name, description, and reading of Sensor-List should match SPEC definition.
79. BMC web information match SPEC definition.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Check Config - SYSTEM_CONFIG
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'Check Config - SYSTEM_CONFIG' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `Check Config - SYSTEM_CONFIG`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2034/2200 — `Wistron-BMC-01055-V002` · Items=Sensor Check - GB · TestSet=Sensor check
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Sensor Check - GB
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. Sensor's name, description, and reading of SDR-List should match SPEC definition.
2. Sensor's name, description, and reading of Sensor-List should match SPEC definition.
80. BMC web information match SPEC definition.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Sensor Check - GB
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'Sensor Check - GB' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `Sensor Check - GB`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2035/2200 — `Wistron-BMC-01056-V002` · Items=Check GB_SXM · TestSet=Sensor check
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Check GB_SXM
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. Sensor's name, description, and reading of SDR-List should match SPEC definition.
2. Sensor's name, description, and reading of Sensor-List should match SPEC definition.
94. BMC web information match SPEC definition.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Check GB_SXM
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'Check GB_SXM' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `Check GB_SXM`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2036/2200 — `Wistron-BMC-01057-V002` · Items=Check GPU - GPU · TestSet=Sensor check
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Check GPU - GPU
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. Sensor's name, description, and reading of SDR-List should match SPEC definition.
2. Sensor's name, description, and reading of Sensor-List should match SPEC definition.
99. BMC web information match SPEC definition.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Check GPU - GPU
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'Check GPU - GPU' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `Check GPU - GPU`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2037/2200 — `Wistron-BMC-01058-V002` · Items=Check Status - GB · TestSet=Sensor check
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Check Status - GB
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. Sensor's name, description, and reading of SDR-List should match SPEC definition.
2. Sensor's name, description, and reading of Sensor-List should match SPEC definition.
102. BMC web information match SPEC definition.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Check Status - GB
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- Check Status - GB: read the GB status sensor via ipmitool (OOB, from the agent host) and confirm name/description/reading match SPEC.`
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'Check Status - GB' 2>&1`
- 📤 產出人:
  log 取位:operator launches KVM from the BMC web UI without a USB hub and confirms the KVM works normally; agent cannot operate the web KVM console.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️      缺陷**:WR(命令內容/感測器名稱與 Items 不符 → 依 Items/procedure 重寫);已修 xlsx ; 判定已改 col13 NO→YES(col15 重寫為同類只讀 sensor get);pkg col14 改為 ipmitool

---

### 2038/2200 — `Wistron-BMC-01059-V002` · Items=Check FW Ready · TestSet=Sensor check
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Check FW Ready
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. Sensor's name, description, and reading of SDR-List should match SPEC definition.
2. Sensor's name, description, and reading of Sensor-List should match SPEC definition.
105. BMC web information match SPEC definition.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Check FW Ready
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'Check FW Ready' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `Check FW Ready`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2039/2200 — `Wistron-HW-00484-V002` · Items=Firmware-Flash · TestSet=Storage basic function - M.2
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:Firmware-Flash
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Flash FW shoube be successfully and no error report.
- Q6 補什麼:vendor M.2 FW flash tool + image (user provides)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Firmware-Flash
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- M.2 firmware flash needs the user-supplied FW image + vendor flash tool; agent runs the flash and verifies the FW version is updated.`
- 📤 產出人:
  log 取位:return the flash log + FW version after update so user confirms the new FW is active.
  risk:RISK: M.2 FW flash is state-changing and can brick the drive; flash only the user-specified image on a spare/ready drive.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2040/2200 — `Wistron-HW-00485-V002` · Items=Firmware-Flash Negative · TestSet=Storage basic function - M.2
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:Firmware-Flash Negative
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:After flashing FW is interrupted, NvMe device should still work normally.
- Q6 補什麼:vendor M.2 FW flash tool + image (user provides)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Firmware-Flash Negative
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- M.2 firmware flash (negative test: corrupted/wrong image should fail cleanly) needs the user-supplied FW image + vendor flash tool; agent runs the flash and verifies the flash fails as ex`
- 📤 產出人:
  log 取位:return the flash log showing the corrupted-image flash failed cleanly and the prior FW is intact while the SUT still boots.
  risk:RISK: M.2 FW flash is state-changing and can brick the drive; flash only the user-specified image on a spare/ready drive.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2041/2200 — `Wistron-BIOS-00492-V002` · Items=C-state (Core States) · TestSet=Feature
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:C-state (Core States)
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. When Package C state limit is C0/C1, PC2 and PC6 should show "0" in Intel tool's log.
2. When Package C state limit is C2, PC2 should have value and PC6 should show "0" in Intel tool's log.
3. When Package C state limit is C6, PC2 and PC6 should have value in Intel tool's log.
- Q6 補什麼:linux-tools (turbostat) + lscpu + cpupower
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:C-state (Core States)
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- C-state (Core States): verify CPU C-states are enabled/working. C-state config is a BIOS CPU-setting (human); the OS residency read is automated.`
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP"lscpu 2>&1 | grep -i -E 'c-state|model name'; grep . /sys/devices/system/cpu/cpu0/cpuidle/state*/name 2>&1; turbostat`
- 📤 產出人:
  log 取位:return the cpuidle state names + turbostat residency so the user confirms C-states are enabled and the package reaches idle states.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️      缺陷**:Q-LIT+DBL-SSH(內層引號 + 收斂雙層 sshpass-ssh 為一跳);已修 xlsx

---

### 2042/2200 — `Wistron-BIOS-00493-V002` · Items=P-state (Performance States) · TestSet=Feature
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:P-state (Performance States)
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. When Turbo Mode is enabled, CPU frequency should exceed its base frequency during stress.
2. When Turbo Mode is enabled, CPU frequency should keep its base frequency during stress.
- Q6 補什麼:cpupower + lscpu
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:P-state (Performance States)
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- P-state (Performance States): verify CPU P-states/OS performance states. P-state config is a BIOS CPU-setting; the OS governor read is automated.`
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP"lscpu | grep -i -E 'MHz|min|max'; cpupower frequency-info 2>&1 | grep -iE 'driver|governor|hardware limits' | head 2>`
- 📤 產出人:
  log 取位:return the CPU freq governor + min/max frequencies so the user confirms P-states/OS performance states are active and scaling.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️      缺陷**:Q-LIT+DBL-SSH(內層引號 + 收斂雙層 sshpass-ssh 為一跳);已修 xlsx

---

### 2043/2200 — `Wistron-HW-00486-V002` · Items=Flash PCIe Switch Firmware · TestSet=PCIe Switch Firmware
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:Flash PCIe Switch Firmware
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. The firmware should be updated without any error and worked as expected.
- Q6 補什麼:lspci + power/reboot control
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Flash PCIe Switch Firmware
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- Flash PCIe Switch Firmware: run the vendor PCIe-switch FW flash tool (g4Xdiagnostics) with the FW image, then verify the updated FW version via the tool/lspci.`
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP"unzip -o /opt/g4Xd/g4Xdiagnostics_linux.zip -d /opt/g4Xd/ >/dev/null 2>&1; cd /opt/g4Xd && sudo ./g4Xdiag flash ${SW_`
  `-- g4Xdiagnostics is a vendor tool (operator provides the tool + FW image on the DUT).`
- 📤 產出人:
  log 取位:return link speed/width (LnkSta) after each DC cycle so user verifies it trains back correctly. Long - confirm approval.
  risk:RISK: DC power cycling is destructive - operator present + approval.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️      缺陷**:WR(命令內容/感測器名稱與 Items 不符 → 依 Items/procedure 重寫);已修 xlsx

---

### 2044/2200 — `Wistron-BMC-01060-V002` · Items=GPU management - Event Log · TestSet=GPU management
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:GPU management - Event Log
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:The GPU should not have warning and critical event.
- Q6 補什麼:nvidia-smi + NVSM
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:GPU management - Event Log
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- GPU management - Event Log: read the GPU event/error log sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "nvidia-smi --query-gpu=name,ecc.errors.corrected.volatil`
- 📤 產出人:
  log 取位:return the ECC counter + nvsm alerts so the user confirms no unexpected GPU errors/events are present.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2045/2200 — `Wistron-AMD SVM-00141-V005` · Items=PCIe Correctable Link CRC TX · TestSet=RAS
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:PCIe Correctable Link CRC TX
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Terminal:
Example 1: AMDGPURAS tool PCIe error injection command returns Error Inject Successfully.
Remark/ Criteria: Refer to step 4 from Execution Steps.
Example 2: AER reports [BadTLP] at downstream port.
pcieport 0000:02:03.0: [ 6] BadTLP
pcieport 0000:00:01.1: AER: aer_status: 0x00000000, aer_mask: 0x00002000
pcieport 0000:00:01.1: AER: aer_layer=Transaction Layer, aer_agent=Receiver ID
pcieport 0000:02:03.0: AER: aer_status: 0x00000040, aer_mask: 0x00002000
Remark/ Criteria: Refer to step 5 from Execution Steps.

BMC Terminal:
Example: System Event Log matches the type of error injection being injected.
Remark/ Criteria: Refer to step 2 in SEL check.
- Q6 補什麼:AMDGPU-RAS tool (amdgpuras) + Redfish CPER access
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:PCIe Correctable Link CRC TX
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- PCIe Correctable Link CRC TX (in-band error injection): via amdgpuras, inject the named PCIe Correctable Link CRC TX error and check dmesg/CPER for the expected handler report. Needs the `
- 📤 產出人:
  log 取位:return amdgpuras injection result + `dmesg -T | tail -100` (expected amdgpu hardware error) + decoded CPER so the user confirms the injected
  risk:RISK: injecting a hardware/CPU error can disrupt the SUT and may need a reboot/recovery; run only on a dedicated SUT with the exact injectio
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2046/2200 — `Wistron-AMD SVM-00487-V003` · Items=PCIe Link 4-Point Screen Test · TestSet=PCIe Link Margining
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:PCIe Link 4-Point Screen Test
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:• PASS = 
– Result csv file contains number of rows equal to the number of lanes tested. Example: Testing 8 OAMs, there should be 8 OAMs x16 links = 128 row of results.
- The following column is <=5:
a. Left Offset ErrCnt
b. Right Offset ErrCnt
c. Top Offset ErrCnt
d. Bottom Offset ErrCnt
- The following column matches with test parameters:
a. Margin Left Offset
b. Margin Right Offset
c. Margin TopOffset
d. Margin Bottom Offset
- No PCIe downtrain occur
- Q6 補什麼:PCIe protocol analyzer / margining tool (physical hardware)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:PCIe Link 4-Point Screen Test
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 2047/2200 — `Wistron-AMD SVM-00488-V003` · Items=XGMI 4 Point Screen Test · TestSet=XGMI Link Marging
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:XGMI 4 Point Screen Test
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:• PASS = 
- Result csv file contains number of rows equal to the number of lanes
tested. For -all parameter, there are 56 link x 16 lane = 896 rows of results.
- The following column is <=5:
a. Left Offset ErrCnt
b. Right Offset ErrCnt
c. Top Offset ErrCnt
d. Bottom Offset ErrCnt
- The following column matches with test parameters:
a. Margin Left Offset
b. Margin Right Offset
c. Margin TopOffset
d. Margin Bottom Offset
- The following column is not 0:
a. Total Phase (UI)
b. Total Volt (volt)
c. Margin Left (ui)
d. Margin Right (ui)
e. Margin Top (volt)
f. Margin Bottom (volt)
- Q6 補什麼:amdxio (AMD GPU tool - user-provided)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:XGMI 4 Point Screen Test
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- XGMI 4 Point Screen Test: XGMI 4-point screen test via amdxio. Agent runs the link status then the 4pt screen test on all links`
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP"sudo ./amdxio -xgmi -linkstatus 2>&1 | tail -n 20; echo ---4pt---; sudo ./amdxio -margin -xgmi -all -ber=10 -errcnt=5`
  `-- amdxio is a vendor tool (operator-provided on the DUT).`
- 📤 產出人:
  log 取位:return the amdxio 4pt screen-test CSV (56 links x 16 lanes = 896 rows for -all) so the user confirms each offset ErrCnt column is <=5 and of
  risk:RISK: the XGMI 4pt screen sweep stresses the interconnect margins; maintenance-window only, no other GPU load concurrently.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️      缺陷**:Q-LIT(ssh 內層裸雙引號 → 單引號 / 遠端迴圈變數 \$ 逸出);已修 xlsx

---

### 2048/2200 — `Wistron-AMD SVM-01061-V003` · Items=Telemetry Data for UBB/OAM · TestSet=BMC remove management
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Telemetry Data for UBB/OAM
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:PASS:
- The reading is between the lower or upper limit, and the returned value is not NULL or zero.
- No failures occur from the stress test and run according to the Pass/Fail criteria.
- Q6 補什麼:curl (BMC has it)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Telemetry Data for UBB/OAM
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- Telemetry Data for UBB/OAM: query UBB/OAM Redfish TelemetryService metric report over the BMC VNIC (192.168.31.1, reachable from the DUT host), then check the readings are within the lowe`
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP"curl -s -k -u '$BMC_USER:$BMC_PASS' http://192.168.31.1/redfish/v1/TelemetryService/MetricReports/All 2>&1"`
- 📤 產出人:
  log 取位:return the full ALL MetricReports JSON (732 sensor readings incl temp/voltage/current/power/status) so the user confirms each reading is wit
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️      缺陷**:Q-LIT(ssh 內層裸雙引號 → 單引號 / 遠端迴圈變數 \$ 逸出);已修 xlsx

---

### 2049/2200 — `Wistron-AMD SVM-01062-V003` · Items=Collect UBB FW Info and Update UBB FW · TestSet=BMC remove management
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:Collect UBB FW Info and Update UBB FW
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:PASS:
- All UBB FW versions returned match release note versions
1. IFWI
2. Retimers
3. RM
4. SMC
5. UBB_FPGA
6. SMC_FPGA
7. ROT
- The PLDM file must be uploaded and flashed completely without failure
- Q6 補什麼:UBB FW image + PLDM upload tooling (user-provided)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Collect UBB FW Info and Update UBB FW
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- Collect UBB FW Info and Update UBB FW: collect UBB FW info via Redfish FirmwareInventory (BMC VNIC), then update UBB FW; the flash/update step needs the new FW image + upload action (oper`
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP"curl -s -k -u '$BMC_USER:$BMC_PASS' http://192.168.31.1/redfish/v1/UpdateService/FirmwareInventory 2>&1; echo ---reti`
- 📤 產出人:
  log 取位:return the full FirmwareInventory JSON list + retimer_active fields so the user verifies all UBB FW versions (IFWI/Retimers/RM/SMC/UBB_FPGA/
  risk:RISK: UBB FW update re-flashes GPU baseboard firmware components; do not auto-run without the approved FW image; human verifies version matc
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️      缺陷**:Q-LIT(ssh 內層裸雙引號 → 單引號 / 遠端迴圈變數 \$ 逸出);已修 xlsx

---

### 2050/2200 — `Wistron-AMD SVM-01063-V003` · Items=Health Check on UBB and OAM · TestSet=BMC remove management
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Health Check on UBB and OAM
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:PASS:
- Redfish successfully returning all statuses for UBB and OAM0-7.
• ‘’Health” = “OK”
• “HealthRollup” = “OK”
• “State” = “Enabled” (When driver is loaded.)
- Q6 補什麼:amdgpu kernel module (present on GPU driver stack) + curl
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Health Check on UBB and OAM
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- Health Check on UBB and OAM: health-check UBB and OAM0-7 via Redfish Chassis (BMC VNIC). Load amdgpu first.`
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP"modprobe amdgpu 2>&1; curl -s -k -u '$BMC_USER:$BMC_PASS' http://192.168.31.1/redfish/v1/Chassis/UBB 2>&1; for OAM in`
- 📤 產出人:
  log 取位:return the full Redfish Chassis JSON for UBB and OAM0-7 so the user confirms Health=OK, HealthRollup=OK, State=Enabled for each.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️      缺陷**:Q-LIT(ssh 內層裸雙引號 → 單引號 / 遠端迴圈變數 \$ 逸出);已修 xlsx

---

### 2051/2200 — `Wistron-AMD SVM-01064-V003` · Items=SMC Reset and Set DateTime · TestSet=BMC remove management
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:SMC Reset and Set DateTime
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:PASS:
- Redfish successfully force reset the SMC.
- The Redfish time is updated and in sync with the BMC time.
- Q6 補什麼:curl
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:SMC Reset and Set DateTime
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- SMC Reset and Set DateTime: force-reset the SMC and set DateTime via Redfish Manager/AMC (BMC VNIC); setting DateTime is a state write (operator approves).`
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP"curl -s -k -u '$BMC_USER:$BMC_PASS' -X POST -d '{\"ResetType\":\"ForceRestart\"}' http://192.168.31.1/redfish/v1/Mana`
- 📤 產出人:
  log 取位:return the ForceRestart POST response, the ping boot result, and the Manager/AMC JSON (DateTime) so the user confirms the SMC restarted and 
  risk:RISK: SMC ForceRestart briefly resets the UBB baseboard management controller; may cause a short OOB gap - do not run during any active test
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️      缺陷**:Q-LIT(ssh 內層裸雙引號 → 單引號 / 遠端迴圈變數 \$ 逸出);已修 xlsx

---

### 2052/2200 — `Wistron-AMD SVM-01065-V003` · Items=Log Collection · TestSet=BMC remove management
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Log Collection
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:The test result should be 'No show error'
- Q6 補什麼:curl
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Log Collection
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- Log Collection: collect SMC/system logs via Redfish LogServices (BMC VNIC): list LogServices then dump EventLog entries.`
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP"curl -s -k -u '$BMC_USER:$BMC_PASS' http://192.168.31.1/redfish/v1/Systems/UBB/LogServices 2>&1; curl -s -k -u '$BMC_`
- 📤 產出人:
  log 取位:return the LogServices list + the saved event.log (full SMC EventLog entries) so the user confirms no error/abnormal entries are present.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️      缺陷**:Q-LIT(ssh 內層裸雙引號 → 單引號 / 遠端迴圈變數 \$ 逸出);已修 xlsx

---

### 2053/2200 — `Wistron-AMD SVM-01066-V003` · Items=Power Management · TestSet=BMC remove management
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:Power Management
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:PASS:
- The Power Limit Watts (SetPoint) value should be successfully configured using either OOB or In-Band
method.
- The Max Power Test should meet the Pass/Fail Criteria, and the power should attain the Power
Capping value.
- Q6 補什麼:ROCm (rocm-smi) for in-band power capping
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Power Management
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- Power Management: manage the Power Limit Watts for UBB/OAM via OOB Redfish (BMC VNIC) plus in-band ROCm; first read the current EnvironmentMetrics SetPoint for each OAM; the actual power-`
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP"for OAM in 0 1 2 3 4 5 6 7; do curl -s -k -u '$BMC_USER:$BMC_PASS' http://192.168.31.1/redfish/v1/Chassis/OAM_\$OAM/E`
- 📤 產出人:
  log 取位:return the EnvironmentMetrics SetPoint (current Max Power Limit) for each OAM so the user confirms the value; the power-capping write is don
  risk:RISK: changing GPU power capping affects thermal/power behaviour of the OAM modules; do not auto-run, apply with careful intent and reset af
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️      缺陷**:Q-LIT(ssh 內層裸雙引號 → 單引號 / 遠端迴圈變數 \$ 逸出);已修 xlsx

---

### 2054/2200 — `Wistron-AMD SVM-00010-V002` · Items=AMD-SMI Topology · TestSet=System Stress
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:AMD-SMI Topology
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:The test result should be 'No show error'
- Q6 補什麼:AMD-SMI (amdsmi, must install)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:AMD-SMI Topology
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "amd-smi topology 2>&1"`
- 📤 產出人:
  log 取位:return full `amd-smi topology` output (CPU/GPU to device-index mapping) for the user to confirm no errors and the expected topology.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2055/2200 — `Wistron-AMD SVM-00011-V002` · Items=PCIe Bandwidth Test · TestSet=System Stress
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:PCIe Bandwidth Test
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:PASS: 
- AGFHC return Status: PASS 
- Actual bandwidth value higher than the target bandwidth value in test log
- Q6 補什麼:AMD AGFHC tool (/opt/amd/agfhc, user installs)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:PCIe Bandwidth Test
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- PCIe Bandwidth Test (PCIe bandwidth): sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "sudo /opt/amd/agfhc/agfhc -l 2>&1; sudo /opt/amd/agfhc/agfhc -r pcie_lvl2 2`
- 📤 產出人:
  log 取位:return the AGFHC pcie_lvl2 log + Status (PASS) + measured bandwidth so the user confirms it exceeds the target. Sustained bandwidth test - c
  risk:RISK: AGFHC PCIe bandwidth test runs sustained link I/O; dedicated SUT + approval.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2056/2200 — `Wistron-AMD SVM-00012-V002` · Items=XGMI Bandwidth Test · TestSet=System Stress
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:XGMI Bandwidth Test
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:PASS: 
- AGFHC return Status: PASS 
- Actual bandwidth value higher than the target bandwidth value in test log
- Q6 補什麼:AMD AGFHC tool (/opt/amd/agfhc)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:XGMI Bandwidth Test
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- XGMI Bandwidth Test (XGMI bandwidth): sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "sudo /opt/amd/agfhc/agfhc -l 2>&1; sudo /opt/amd/agfhc/agfhc -r xgmi_lvl2 2`
- 📤 產出人:
  log 取位:return the AGFHC xgmi_lvl2 log + Status (PASS) + measured XGMI bandwidth so the user confirms it exceeds target.
  risk:RISK: XGMI bandwidth test disturbs the GPU fabric; dedicated SUT + approval.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2057/2200 — `Wistron-AMD SVM-00013-V002` · Items=Memory Stress – AGFHC HBM Test · TestSet=System Stress
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:Memory Stress – AGFHC HBM Test
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:• PASS = 
- The output will display: Program exiting with return code AGFHC_SUCCESS [0].
- No dmesg content generated within the dmesg_test.log
- HBM exerciser complete with no miscompare 
- RAS counter with 0 value
- Bandwidth reading met specific criteria 
• FAIL = 
- The output show Status: FAIL
- dmesg content is generated within the dmesg_test.log
- Q6 補什麼:AMD AGFHC tool (/opt/amd/agfhc)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Memory Stress – AGFHC HBM Test
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- Memory Stress – AGFHC HBM Test (HBM memory stress): sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "sudo /opt/amd/agfhc/agfhc -r hbm_lvl1 2>&1; echo ---HBM-BW---`
- 📤 產出人:
  log 取位:return the AGFHC hbm_lvl1 + hbm_bw output (should end with AGFHC_SUCCESS [0]) + a dmesg_after_check so the user confirms no HBM errors/misco
  risk:RISK: HBM stress runs heavy memory I/O on GPUs; dedicated SUT + approval.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2058/2200 — `Wistron-AMD SVM-00014-V002` · Items=XGMI Stress · TestSet=System Stress
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:XGMI Stress
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:• PASS = 
- TransferBench completed with no CPER file generated.
• FAIL = 
- new CPER file generated during the test
- Q6 補什麼:TransferBench (user provides) + Redfish CPER query
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:XGMI Stress
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- XGMI Stress (XGMI stress): run + record the CPER index before/after and ensure no new CPER file. sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "date; echo ---; `
- 📤 產出人:
  log 取位:return the CPER index before/after the XGMI stress and the stress summary so the user confirms no new CPER (PASS) vs CPER generated (FAIL).
  risk:RISK: XGMI stress is high-load; dedicated SUT + approval.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2059/2200 — `Wistron-AMD SVM-00015-V002` · Items=GFX Stress – AGFHC GFX Stress Workload · TestSet=System Stress
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:GFX Stress – AGFHC GFX Stress Workload
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:• PASS = 
- The output will display: Program exiting with return code AGFHC_SUCCESS [0].
- No dmesg content generated within the dmesg_test.log
• FAIL = 
-  At the end of the run , the output will show a summary of the test run with none 0 return code.
- Q6 補什麼:AMD AGFHC tool (/opt/amd/agfhc)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:GFX Stress – AGFHC GFX Stress Workload
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- GFX Stress – AGFHC GFX Stress Workload (GFX stress AGFHC): sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "sudo /opt/amd/agfhc/agfhc -r gfx_lvl1 2>&1 | tee /tmp/`
- 📤 產出人:
  log 取位:return the AGFHC gfx_lvl1 log (should end AGFHC_SUCCESS [0]) + post-run dmesg check so the user confirms no failure/miscompare.
  risk:RISK: GFX stress loads GPUs heavily; dedicated SUT + approval.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2060/2200 — `Wistron-AMD SVM-00016-V002` · Items=GFX Stress – miniHPL Stress Workload · TestSet=System Stress
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:GFX Stress – miniHPL Stress Workload
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Pass: The output will display: Program exiting with return code AGFHC_SUCCESS 10].
Fail: At the end of the run, the output will show a summary of the test run, total time, log directory, and a return code.
Example of failure from any test run:
Program exiting with return code PROG FAIL IN TEST EXECUTON [13
Example of a common program error:
Program exiting with return code PROG GENERAL ERROR [1]
Remark/ Criteria: Output may defer depends on the test command run. Ensure no Failed text in the run results. If failure is found, details will be available in the logs. Refer to the Logs Generated section above.
= Note: The return/status code at the end of the test run will guide users for the next step.
Refer to the AMD GPU Field Health Check user guide document, section Status codes for the description of the errors.
Pass:
miniHPL
PASS: minihpl-1-1
[00: 01:16/00:01:25]
Remark/ Criteria: The timeout failure can be further identified in the result.json logs.
Refer to the Logs Generated section above.
- Q6 補什麼:AMD AGFHC tool (/opt/amd/agfhc)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:GFX Stress – miniHPL Stress Workload
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- GFX Stress – miniHPL Stress Workload (GFX stress miniHPL): sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "sudo /opt/amd/agfhc/agfhc -t minihpl 2>&1 | tee /tmp/a`
- 📤 產出人:
  log 取位:return the minihpl output (should end with AGFHC_SUCCESS [0]) + the summary (total time, log dir) so the user confirms no failure/miscompare
  risk:RISK: HPL stress loads the GPUs heavily; dedicated SUT + approval.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2061/2200 — `Wistron-AMD SVM-00017-V002` · Items=GFX Stress – rocBLAS Based Workload - AGFHC Max Power · TestSet=System Stress
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:GFX Stress – rocBLAS Based Workload - AGFHC Max Power
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:• PASS = 
- AGFHC return Success.
- Test log shows no miscompare.
- Check with DMESG to determine no failure during test run.
• FAIL = 
- AGFHC return Failed
- Test log shows miscompare 
- DMESG error seen during test run start.
- Q6 補什麼:AMD AGFHC tool + AMD-SMI (amdsmi)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:GFX Stress – rocBLAS Based Workload - AGFHC Max Power
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- GFX Stress – rocBLAS Based Workload - AGFHC Max Power (AGFHC max-power GFX): sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "sudo /opt/amd/agfhc/agfhc -t gfx_max`
- 📤 產出人:
  log 取位:return the gfx_maxpower log (AGFHC Success, no miscompare) + the amd-smi monitor stream (per-GPU utilization/power) so the user confirms no 
  risk:RISK: max-power GFX run draws high power/heat; dedicated SUT with adequate cooling + approval.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2062/2200 — `Wistron-AMD SVM-00018-V002` · Items=GPU Thermal Test · TestSet=Power Thermal
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:GPU Thermal Test
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:No system hangs or unintended resets should occur 
GPUs should not overheat nor go offline. 
Review the DMESG log for any GPU throttling messages. 
GPU can reach Power Cap value
- Q6 補什麼:rocm-smi (ROCm) + amdgpu driver
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:GPU Thermal Test
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- GPU Thermal Test: GPU thermal test on the AMD UBB/OAM. Load driver and read per-OAM thermal via ROCm sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "modprobe amd`
- 📤 產出人:
  log 取位:return rocm-smi --showtemp (per-sensor junction/mem temperature) so the user confirms temperatures are within the thermal limits during the 
  risk:RISK: long thermal test sustains high load/temperature; ensure cooling and monitor temps; do not auto-run without a temperature-safe setup.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2063/2200 — `Wistron-AMD SVM-00019-V002` · Items=Max Power Test · TestSet=Power Thermal
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:Max Power Test
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:• PASS = 
- Check with latest dmesg printout to ensure no failures asserted.
- GPU reach the power cap consistently
- Minimal power consumption should be at least >= 90% of TDP
• FAIL = 
-  DMESG error seen during rocHPL run start.
-  one or more runs did not meet the power cap target
- Q6 補什麼:rocprof/rocm-smi (ROCm) + a GPU power load tool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Max Power Test
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- Max Power Test: Max Power test on the AMD UBB/OAM. Measure peak power under full GPU load via ROCm power API sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "rocm`
- 📤 產出人:
  log 取位:return rocm-smi --showpower per-GPU power readings during full load so the user confirms peak power meets the Max Power pass criteria.
  risk:RISK: Max Power test runs GPUs at full load; monitor power/thermal closely and do not auto-run without the approved load recipe.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2064/2200 — `Wistron-AMD SVM-00020-V003` · Items=Post-Boot Stress · TestSet=Reboot Stress Testing
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:Post-Boot Stress
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Remark/ Criteria: Output may defer depending on the test command run.
Ensure there is no Failed in the run results. If failure is found, provide the logs to your AMD representative
- Q6 補什麼:rocm-smi (ROCm)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Post-Boot Stress
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- Post-Boot Stress: after each reboot run an OS/GPU health sweep on the AMD SVM. Agent can run the per-boot checks (dmesg errors, amdgpu state)`
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP"dmesg -l err 2>&1 | tail -n 40; echo ---; rocm-smi 2>&1 | head -n 20 2>&1"`
  `-- automating the reboot loop itself needs a reboot controller (operator).`
- 📤 產出人:
  log 取位:return the post-boot dmesg error tail + rocm-smi state so the user confirms the SVM boots clean and drivers come up each cycle.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️      缺陷**:Q-LIT(ssh 內層裸雙引號 → 單引號 / 遠端迴圈變數 \$ 逸出);已修 xlsx

---

### 2065/2200 — `Wistron-AMD SVM-00021-V002` · Items=Reboot · TestSet=Reboot Stress Testing
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:Reboot
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Pass:
- The system able to perform power cycle completion without any failure. 100 cycles are recommended.
- The dmesg.log contains no error message (e.g. “hardware error”, “previous boot”, “fatal”, “fault”).
• No soft lock.
• No hard lock.
• No MCE errors
- There is no mismatch on output log from basic health check. 
- Post-Boot Stress test Pass.
- Q6 補什麼:none (systemctl)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Reboot
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- Reboot: system reboot stress on the AMD SVM. A single reboot can be issued sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "sync && systemctl reboot 2>&1"; a mult`
- 📤 產出人:
  log 取位:return the reboot command output + the recorded boot count/timestamps so the user confirms the system reboots reliably across the loop.
  risk:RISK: reboot interrupts all running services; run reboot stress only in a maintenance window.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2066/2200 — `Wistron-AMD SVM-00022-V002` · Items=DC Cycle System Sequence Check · TestSet=Reboot Stress Testing
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:DC Cycle System Sequence Check
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Pass:
- The system able to perform power cycle completion without any failure. 100 cycles are recommended.
- The dmesg.log contains no error message (e.g. “hardware error”, “previous boot”, “fatal”, “fault”).
• No soft lock.
• No hard lock.
• No MCE errors
- There is no mismatch on output log from basic health check. 
- Post-Boot Stress test Pass.
- Q6 補什麼:human at the machine (DC power control)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:DC Cycle System Sequence Check
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 2067/2200 — `Wistron-AMD SVM-00023-V002` · Items=AC Power Cycle System Sequence Check · TestSet=Reboot Stress Testing
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:AC Power Cycle System Sequence Check
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Pass:
- The system able to perform power cycle completion without any failure. 100 cycles are recommended.
- The dmesg.log contains no error message (e.g. “hardware error”, “previous boot”, “fatal”, “fault”).
• No soft lock.
• No hard lock.
• No MCE errors
- There is no mismatch on output log from basic health check. 
- Post-Boot Stress test Pass.
- Q6 補什麼:human at the machine (AC power control)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:AC Power Cycle System Sequence Check
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 2068/2200 — `Wistron-AMD SVM-00114-V003` · Items=AMDGPURAS Tool Version/Help Text · TestSet=RAS
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:AMDGPURAS Tool Version/Help Text
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:The test result should be 'No show error'
- Q6 補什麼:AMDGPU-RAS tool (amdgpuras, must install)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:AMDGPURAS Tool Version/Help Text
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "amdgpuras --help 2>&1; echo ---VERSION---; amdgpuras --version 2>&1"`
- 📤 產出人:
  log 取位:return full `amdgpuras --help` + `--version` output so the user confirms the tool version/usage. No RISK (read-only).
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2069/2200 — `Wistron-AMD SVM-00115-V003` · Items=UMC Correctable ODECC · TestSet=RAS
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:UMC Correctable ODECC
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:• PASS = 
- AMDGPURAS tool UMC error injection command returns successfully
- Redfish command for CPER index retrieval shows the CPER index is increased by 1 and new CPER file is generated upon the error injected.
- The decoded result from the decoded CPER log matches the injected error type and location.
• Error location lists the OAM on which the error occurred.
• Bank matches the type of error injected: UMC.
• Errorcode ext is 0 and Errocode ext Type is HBMEccErr (On-die ECC).
• Error severity matches the type of error you injected: Corrected error.
- The inband CPER log matches the OAM devices and error severity level
- Q6 補什麼:AMDGPU-RAS tool (amdgpuras) + Redfish CPER access
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:UMC Correctable ODECC
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- UMC Correctable ODECC (in-band error injection): via amdgpuras, inject the named UMC Correctable ODECC error and check dmesg/CPER for the expected handler report. Needs the exact amdgpura`
- 📤 產出人:
  log 取位:return amdgpuras injection result + `dmesg -T | tail -100` (expected amdgpu hardware error) + decoded CPER so the user confirms the injected
  risk:RISK: injecting a hardware/CPU error can disrupt the SUT and may need a reboot/recovery; run only on a dedicated SUT with the exact injectio
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2070/2200 — `Wistron-AMD SVM-00116-V003` · Items=UMC Replay Correctable ODECC · TestSet=RAS
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:UMC Replay Correctable ODECC
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:• PASS = 
- AMDGPURAS tool UMC error injection command returns successfully
- Redfish command for CPER index retrieval shows the CPER index is increased by 1 and new CPER file is generated upon the error injected.
- The decoded result from the decoded CPER log matches the injected error type and location.
• Error location lists the OAM on which the error occurred.
• Bank matches the type of error injected: UMC.
• Errorcode ext is 0 and Errocode ext Type is HBMEccErr (On-die ECC).
• Error severity matches the type of error you injected: Corrected error.
- The inband CPER log matches the OAM devices and error severity level
- Q6 補什麼:AMDGPU-RAS tool (amdgpuras) + Redfish CPER access
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:UMC Replay Correctable ODECC
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- UMC Replay Correctable ODECC (in-band error injection): via amdgpuras, inject the named UMC Replay Correctable ODECC error and check dmesg/CPER for the expected handler report. Needs the `
- 📤 產出人:
  log 取位:return amdgpuras injection result + `dmesg -T | tail -100` (expected amdgpu hardware error) + decoded CPER so the user confirms the injected
  risk:RISK: injecting a hardware/CPU error can disrupt the SUT and may need a reboot/recovery; run only on a dedicated SUT with the exact injectio
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2071/2200 — `Wistron-AMD SVM-00117-V003` · Items=UMC Replay Correctable CRC Read · TestSet=RAS
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:UMC Replay Correctable CRC Read
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:• PASS = 
- AMDGPURAS tool UMC error injection command returns successfully
- Redfish command for CPER index retrieval shows the CPER index is increased by 1 and new CPER file is generated upon the error injected.
- The decoded result from the decoded CPER log matches the injected error type and location.
• Error location lists the OAM on which the error occurred.
• Bank matches the type of error injected: UMC.
• Errorcode ext is 15 and Errocode ext Type is EndToEndCrcErr (End-to-end CRC).
• Error severity matches the type of error injected: Corrected error.
- The inband CPER log matches the OAM devices and error severity level
- Q6 補什麼:AMDGPU-RAS tool (amdgpuras) + Redfish CPER access
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:UMC Replay Correctable CRC Read
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- UMC Replay Correctable CRC Read (in-band error injection): via amdgpuras, inject the named UMC Replay Correctable CRC Read error and check dmesg/CPER for the expected handler report. Need`
- 📤 產出人:
  log 取位:return amdgpuras injection result + `dmesg -T | tail -100` (expected amdgpu hardware error) + decoded CPER so the user confirms the injected
  risk:RISK: injecting a hardware/CPU error can disrupt the SUT and may need a reboot/recovery; run only on a dedicated SUT with the exact injectio
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2072/2200 — `Wistron-AMD SVM-00118-V003` · Items=GFX Correctable · TestSet=RAS
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:GFX Correctable
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:• PASS = 
- AMDGPURAS tool GFX error injection command returns successfully
- Redfish command for CPER index retrieval shows the CPER index is increased by 1 and new CPER file is generated upon the error injected.
- The decoded result from the decoded CPER log matches the injected error type and location.
• Error location lists the OAM on which the error occurred.
• Bank matches the type of error injected: GC.
• Errorcode ext is 58 and Errocode ext Type is GFX_IP_Correctable_Error.
• Error severity matches the type of error injected: Corrected error.
- The inband CPER log matches the OAM devices and error severity level
- Q6 補什麼:AMDGPU-RAS tool (amdgpuras) + Redfish CPER access
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:GFX Correctable
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- GFX Correctable (in-band error injection): via amdgpuras, inject the named GFX Correctable error and check dmesg/CPER for the expected handler report. Needs the exact amdgpuras invocation`
- 📤 產出人:
  log 取位:return amdgpuras injection result + `dmesg -T | tail -100` (expected amdgpu hardware error) + decoded CPER so the user confirms the injected
  risk:RISK: injecting a hardware/CPU error can disrupt the SUT and may need a reboot/recovery; run only on a dedicated SUT with the exact injectio
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2073/2200 — `Wistron-AMD SVM-00119-V003` · Items=XGMI Correctable · TestSet=RAS
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:XGMI Correctable
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:• PASS = 
- AMDGPURAS tool XGMI error injection command returns successfully
- Redfish command for CPER index retrieval shows the CPER index is increased by 1 and new CPER file is generated upon the error injected.
- The decoded result from the decoded CPER log matches the injected error type and location.
• Error location lists the OAM on which the error occurred.
• Bank matches the type of error injected: XGMI.
• Errorcode ext is 6 and Errocode ext Type is BERExceededErr.
• Error severity matches the type of error injected: Corrected error.
- The inband CPER log matches the OAM devices and error severity level
- Q6 補什麼:AMDGPU-RAS tool (amdgpuras) + Redfish CPER access
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:XGMI Correctable
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- XGMI Correctable (in-band error injection): via amdgpuras, inject the named XGMI Correctable error and check dmesg/CPER for the expected handler report. Needs the exact amdgpuras invocati`
- 📤 產出人:
  log 取位:return amdgpuras injection result + `dmesg -T | tail -100` (expected amdgpu hardware error) + decoded CPER so the user confirms the injected
  risk:RISK: injecting a hardware/CPU error can disrupt the SUT and may need a reboot/recovery; run only on a dedicated SUT with the exact injectio
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2074/2200 — `Wistron-AMD SVM-00120-V003` · Items=PCIe Correctable Link CRC RX · TestSet=RAS
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:PCIe Correctable Link CRC RX
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Terminal:
Example 1: AMDGPURAS tool PCIe error injection command returns Error Inject Successfully.
Remark/ Criteria: Refer to step 4 from Execution Steps.
Example 2: AER reports [BadTLP] at downstream port.
pcieport 0000:02:03.0: [ 6] BadTLP
pcieport 0000:00:01.1: AER: aer_status: 0x00000000, aer_mask: 0x00002000
pcieport 0000:00:01.1: AER: aer_layer=Transaction Layer, aer_agent=Receiver ID
pcieport 0000:02:03.0: AER: aer_status: 0x00000040, aer_mask: 0x00002000
Remark/ Criteria: Refer to step 5 from Execution Steps.

BMC Terminal:
Example: System Event Log matches the type of error injection being injected.
Remark/ Criteria: Refer to step 2 in SEL check.
- Q6 補什麼:AMDGPU-RAS tool (amdgpuras) + Redfish CPER access
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:PCIe Correctable Link CRC RX
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- PCIe Correctable Link CRC RX (in-band error injection): via amdgpuras, inject the named PCIe Correctable Link CRC RX error and check dmesg/CPER for the expected handler report. Needs the `
- 📤 產出人:
  log 取位:return amdgpuras injection result + `dmesg -T | tail -100` (expected amdgpu hardware error) + decoded CPER so the user confirms the injected
  risk:RISK: injecting a hardware/CPU error can disrupt the SUT and may need a reboot/recovery; run only on a dedicated SUT with the exact injectio
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2075/2200 — `Wistron-AMD SVM-00121-V003` · Items=UMC Uncorrectable Address Or Command Parity Single Shot · TestSet=RAS
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:UMC Uncorrectable Address Or Command Parity Single Shot
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:• PASS = 
- AMDGPURAS tool UMC error injection command returns successfully.
- Redfish command for CPER index retrieval shows the CPER index is increased by 1 and new CPER file is generated upon the error injected.
- The decoded result from the decoded CPER log matches the injected error type and location.
• Error location lists the OAM on which the error occurred.
• Bank matches the type of error injected: UMC.
• Errorcode ext is 4 and Errocode ext Type is AddressCommandParityErr.
• Error severity matches the type of error injected: Uncorrected system fatal error.
- The inband CPER log matches the OAM devices and error severity level
- Q6 補什麼:AMDGPU-RAS tool (amdgpuras) + Redfish CPER access
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:UMC Uncorrectable Address Or Command Parity Single Shot
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- UMC Uncorrectable Address Or Command Parity Single Shot (in-band error injection): via amdgpuras, inject the named UMC Uncorrectable Address Or Command Parity Single Shot error and check `
- 📤 產出人:
  log 取位:return amdgpuras injection result + `dmesg -T | tail -100` (expected amdgpu hardware error) + decoded CPER so the user confirms the injected
  risk:RISK: injecting a hardware/CPU error can disrupt the SUT and may need a reboot/recovery; run only on a dedicated SUT with the exact injectio
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2076/2200 — `Wistron-AMD SVM-00122-V003` · Items=UMC Uncorrectable Address Or Command Parity Persistent · TestSet=RAS
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:UMC Uncorrectable Address Or Command Parity Persistent
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:• PASS = 
- AMDGPURAS tool UMC error injection command returns successfully.
- Redfish command for CPER index retrieval shows the CPER index is increased by 1 and new CPER file is generated upon the error injected.
- The decoded result from the decoded CPER log matches the injected error type and location.
• Error location lists the OAM on which the error occurred.
• Bank matches the type of error injected: UMC.
• Errorcode ext is 4 and Errocode ext Type is AddressCommandParityErr.
• Error severity matches the type of error injected: Uncorrected system fatal error.
- The inband CPER log matches the OAM devices and error severity level
- Q6 補什麼:AMDGPU-RAS tool (amdgpuras) + Redfish CPER access
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:UMC Uncorrectable Address Or Command Parity Persistent
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- UMC Uncorrectable Address Or Command Parity Persistent (in-band error injection): via amdgpuras, inject the named UMC Uncorrectable Address Or Command Parity Persistent error and check dm`
- 📤 產出人:
  log 取位:return amdgpuras injection result + `dmesg -T | tail -100` (expected amdgpu hardware error) + decoded CPER so the user confirms the injected
  risk:RISK: injecting a hardware/CPU error can disrupt the SUT and may need a reboot/recovery; run only on a dedicated SUT with the exact injectio
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2077/2200 — `Wistron-AMD SVM-00123-V003` · Items=SDMA Uncorrectable · TestSet=RAS
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:SDMA Uncorrectable
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:• PASS = 
- AMDGPURAS tool SDMA error injection command returns successfully.
- Redfish command for CPER index retrieval shows the CPER index is increased by 1 and new CPER file is generated upon the error injected.
- The decoded result from the decoded CPER log matches the injected error type and location.
• Error location lists the OAM on which the error occurred.
• Bank matches the type of error injected: SDMA.
• Errorcode ext is 59 and Errocode ext Type is GfxSdmaError.
• Error severity matches the type of error injected: Uncorrected system fatal error.
- The inband CPER log matches the OAM devices and error severity level
- Q6 補什麼:AMDGPU-RAS tool (amdgpuras) + Redfish CPER access
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:SDMA Uncorrectable
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- SDMA Uncorrectable (in-band error injection): via amdgpuras, inject the named SDMA Uncorrectable error and check dmesg/CPER for the expected handler report. Needs the exact amdgpuras invo`
- 📤 產出人:
  log 取位:return amdgpuras injection result + `dmesg -T | tail -100` (expected amdgpu hardware error) + decoded CPER so the user confirms the injected
  risk:RISK: injecting a hardware/CPU error can disrupt the SUT and may need a reboot/recovery; run only on a dedicated SUT with the exact injectio
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2078/2200 — `Wistron-AMD SVM-00124-V003` · Items=GFX Uncorrectable · TestSet=RAS
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:GFX Uncorrectable
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:• PASS = 
- AMDGPURAS tool GFX error injection command returns successfully.
- Redfish command for CPER index retrieval shows the CPER index is increased by 1 and new CPER file is generated upon the error injected.
- The decoded result from the decoded CPER log matches the injected error type and location.
• Error location lists the OAM on which the error occurred.
• Bank matches the type of error injected: GC.
• Errorcode ext is 59 and Errocode ext Type is GfxGcError.
• Error severity matches the type of error injected: Uncorrected system fatal error.
- The inband CPER log matches the OAM devices and error severity level
- Q6 補什麼:AMDGPU-RAS tool (amdgpuras) + Redfish CPER access
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:GFX Uncorrectable
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- GFX Uncorrectable (in-band error injection): via amdgpuras, inject the named GFX Uncorrectable error and check dmesg/CPER for the expected handler report. Needs the exact amdgpuras invoca`
- 📤 產出人:
  log 取位:return amdgpuras injection result + `dmesg -T | tail -100` (expected amdgpu hardware error) + decoded CPER so the user confirms the injected
  risk:RISK: injecting a hardware/CPU error can disrupt the SUT and may need a reboot/recovery; run only on a dedicated SUT with the exact injectio
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2079/2200 — `Wistron-AMD SVM-00125-V003` · Items=MMHUB Uncorrectable · TestSet=RAS
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:MMHUB Uncorrectable
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:• PASS = 
- AMDGPURAS tool MMHUB error injection command returns successfully.
- Redfish command for CPER index retrieval shows the CPER index is increased by 1 and new CPER file is generated upon the error injected.
- The decoded result from the decoded CPER log matches the injected error type and location.
• Error location lists the OAM on which the error occurred.
• Bank matches the type of error injected: MMHUB.
• Errorcode ext is 59 and Errocode ext Type is GfxMmhubError.
• Error severity matches the type of error injected: Uncorrected system fatal error.
- The inband CPER log matches the OAM devices and error severity level
- Q6 補什麼:AMDGPU-RAS tool (amdgpuras) + Redfish CPER access
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:MMHUB Uncorrectable
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- MMHUB Uncorrectable (in-band error injection): via amdgpuras, inject the named MMHUB Uncorrectable error and check dmesg/CPER for the expected handler report. Needs the exact amdgpuras in`
- 📤 產出人:
  log 取位:return amdgpuras injection result + `dmesg -T | tail -100` (expected amdgpu hardware error) + decoded CPER so the user confirms the injected
  risk:RISK: injecting a hardware/CPU error can disrupt the SUT and may need a reboot/recovery; run only on a dedicated SUT with the exact injectio
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2080/2200 — `Wistron-AMD SVM-00126-V003` · Items=XGMI Uncorrectable · TestSet=RAS
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:XGMI Uncorrectable
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:• PASS = 
- AMDGPURAS tool XGMI error injection command returns successfully.
- Redfish command for CPER index retrieval shows the CPER index is increased by 1 and new CPER file is generated upon the error injected.
- The decoded result from the decoded CPER log matches the injected error type and location.
• Error location lists the OAM and AID on which the error occurred.
• Bank matches the type of error injected: XGMI.
• Errorcode ext is 0 and Errocode ext Type is DataLossErr.
• Error severity matches the type of error injected: Uncorrected system fatal error.
- The inband CPER log matches the OAM devices and error severity level
- Q6 補什麼:AMDGPU-RAS tool (amdgpuras) + Redfish CPER access
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:XGMI Uncorrectable
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- XGMI Uncorrectable (in-band error injection): via amdgpuras, inject the named XGMI Uncorrectable error and check dmesg/CPER for the expected handler report. Needs the exact amdgpuras invo`
- 📤 產出人:
  log 取位:return amdgpuras injection result + `dmesg -T | tail -100` (expected amdgpu hardware error) + decoded CPER so the user confirms the injected
  risk:RISK: injecting a hardware/CPU error can disrupt the SUT and may need a reboot/recovery; run only on a dedicated SUT with the exact injectio
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2081/2200 — `Wistron-AMD SVM-00127-V003` · Items=PCIe Uncorrectable End-to-End CRC TX · TestSet=RAS
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:PCIe Uncorrectable End-to-End CRC TX
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Terminal:
Example 1: AMDGPURAS tool PCIe error injection command returns Error Inject
Remark/ Criteria: Refer to step 4 from Execution Steps.
Example 2: AER reports [ECRC] downstream port.
pcieport 0000:02:03.0: PCIe Bus Error: severity=Uncorrectable (Fatal),
pcieport 0000:02:03.0: [19] ECRC (First)
Full GPU Recovery DPC
PCIe Link reset
AER reports device recovery successful.
amdgpu 0000:88:00.0: amdgpu: Link reset
amdgpu 0000:f9:00.0: amdgpu: GPU link reset
amdgpu 0000:08:00.0: amdgpu: PCIe error recovery succeeded
amdgpu 0000:98:00.0: amdgpu: GPU reset(x) succeeded!
pcieport 0000:02:03.0: AER: device recovery successful
Remark/ Criteria: Refer to step 5 from Execution Steps.
BMC Terminal:
Example:
System Event Log matches the type of error injection being injected.
Remark/ Criteria: Refer to step 2 in SEL check.
- Q6 補什麼:AMDGPU-RAS tool (amdgpuras) + Redfish CPER access
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:PCIe Uncorrectable End-to-End CRC TX
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- PCIe Uncorrectable End-to-End CRC TX (in-band error injection): via amdgpuras, inject the named PCIe Uncorrectable End-to-End CRC TX error and check dmesg/CPER for the expected handler re`
- 📤 產出人:
  log 取位:return amdgpuras injection result + `dmesg -T | tail -100` (expected amdgpu hardware error) + decoded CPER so the user confirms the injected
  risk:RISK: injecting a hardware/CPU error can disrupt the SUT and may need a reboot/recovery; run only on a dedicated SUT with the exact injectio
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2082/2200 — `Wistron-AMD SVM-00128-V003` · Items=PCIe Uncorrectable End-to-End CRC RX · TestSet=RAS
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:PCIe Uncorrectable End-to-End CRC RX
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Terminal:
Example 1: AMDGPURAS tool PCIe error injection command returns Error Inject
Remark/ Criteria: Refer to step 4 from Execution Steps.
Example 2: AER reports [ECRC] downstream port.
pcieport 0000:02:03.0: PCIe Bus Error: severity=Uncorrectable (Fatal),
pcieport 0000:02:03.0: [19] ECRC (First)
Full GPU Recovery DPC
PCIe Link reset
AER reports device recovery successful.
amdgpu 0000:88:00.0: amdgpu: Link reset
amdgpu 0000:f9:00.0: amdgpu: GPU link reset
amdgpu 0000:08:00.0: amdgpu: PCIe error recovery succeeded
amdgpu 0000:98:00.0: amdgpu: GPU reset(x) succeeded!
pcieport 0000:02:03.0: AER: device recovery successful
Remark/ Criteria: Refer to step 5 from Execution Steps.
BMC Terminal:
Example:
System Event Log matches the type of error injection being injected.
Remark/ Criteria: Refer to step 2 in SEL check.
- Q6 補什麼:AMDGPU-RAS tool (amdgpuras) + Redfish CPER access
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:PCIe Uncorrectable End-to-End CRC RX
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- PCIe Uncorrectable End-to-End CRC RX (in-band error injection): via amdgpuras, inject the named PCIe Uncorrectable End-to-End CRC RX error and check dmesg/CPER for the expected handler re`
- 📤 產出人:
  log 取位:return amdgpuras injection result + `dmesg -T | tail -100` (expected amdgpu hardware error) + decoded CPER so the user confirms the injected
  risk:RISK: injecting a hardware/CPU error can disrupt the SUT and may need a reboot/recovery; run only on a dedicated SUT with the exact injectio
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2083/2200 — `Wistron-AMD SVM-00129-V003` · Items=GFX Poison Consumption Handling With ODECC · TestSet=RAS
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:GFX Poison Consumption Handling With ODECC
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:• PASS = 
- AMDGPURAS tool GFX error injection command returns successfully.
- Redfish command for CPER index retrieval shows the CPER index is increased by 1 and new CPER file is generated upon the error injected.
- The decoded result from the decoded CPER log matches the injected error type and location.
• Error location lists the OAM on which the error occurred.
• Bank matches the type of error injected: UMC.
• Errorcode ext is 0 and Errocode ext Type is On-die ECC.
• Error severity matches the type of error injected: Deferred error.
• Error location lists the OAM on which the error occurred.
• Bank matches the type of error injected: GC.
• Errorcode ext is 62 and Errocode ext Type is GfxGcError.
• Error severity matches the type of error injected: Uncorrected Error. Poison has been consumed.
- The inband CPER log matches the OAM devices and error severity level
- Q6 補什麼:AMDGPU-RAS tool (amdgpuras) + Redfish CPER access
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:GFX Poison Consumption Handling With ODECC
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- GFX Poison Consumption Handling With ODECC (in-band error injection): via amdgpuras, inject the named GFX Poison Consumption Handling With ODECC error and check dmesg/CPER for the expecte`
- 📤 產出人:
  log 取位:return amdgpuras injection result + `dmesg -T | tail -100` (expected amdgpu hardware error) + decoded CPER so the user confirms the injected
  risk:RISK: injecting a hardware/CPU error can disrupt the SUT and may need a reboot/recovery; run only on a dedicated SUT with the exact injectio
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2084/2200 — `Wistron-AMD SVM-00130-V003` · Items=GFX Poison Consumption Handling with CRC Write · TestSet=RAS
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:GFX Poison Consumption Handling with CRC Write
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:• PASS = 
- AMDGPURAS tool GFX error injection command returns successfully.
- Redfish command for CPER index retrieval shows the CPER index is increased and new CPER file is generated upon the error injected.
- The decoded result from the decoded CPER log matches the injected error type and location.
• Error location lists the OAM on which the error occurred.
• Bank matches the type of error injected: UMC.
• Errorcode ext is 15 and Errocode ext Type is End-to-end ECC.
• Error severity matches the type of error injected: Deferred error.
• Error location lists the OAM on which the error occurred.
• Bank matches the type of error injected: GC.
• Errorcode ext is 62 and Errocode ext Type is GfxGcError.
• Error severity matches the type of error injected: Uncorrected Error. Poison has been consumed.
- The inband CPER log matches the OAM devices and error severity level
- Q6 補什麼:AMDGPU-RAS tool (amdgpuras) + Redfish CPER access
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:GFX Poison Consumption Handling with CRC Write
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- GFX Poison Consumption Handling with CRC Write (in-band error injection): via amdgpuras, inject the named GFX Poison Consumption Handling with CRC Write error and check dmesg/CPER for the`
- 📤 產出人:
  log 取位:return amdgpuras injection result + `dmesg -T | tail -100` (expected amdgpu hardware error) + decoded CPER so the user confirms the injected
  risk:RISK: injecting a hardware/CPU error can disrupt the SUT and may need a reboot/recovery; run only on a dedicated SUT with the exact injectio
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2085/2200 — `Wistron-AMD SVM-00131-V003` · Items=SDMA Poison Consumption Handling with CRC Write · TestSet=RAS
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:SDMA Poison Consumption Handling with CRC Write
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:• PASS = 
- AMDGPURAS tool SDMA error injection command returns successfully.
- Redfish command for CPER index retrieval shows the CPER index is increased and new CPER file is generated upon the error injected.
- The decoded result from the decoded CPER log matches the injected error type and location.
• Error location lists the OAM on which the error occurred.
• Bank matches the type of error injected: UMC.
• Errorcode ext is 15 and Errocode ext Type is End-to-end CRC.
• Error severity matches the type of error injected: Deferred error.
• Error location lists the OAM on which the error occurred.
• Bank matches the type of error injected: SDMA.
• Errorcode ext is 62 and Errocode ext Type is GfxSdmaError.
• Error severity matches the type of error injected: Uncorrected Error. Poison has been consumed.
- The inband CPER log matches the OAM devices and error severity level
- Q6 補什麼:AMDGPU-RAS tool (amdgpuras) + Redfish CPER access
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:SDMA Poison Consumption Handling with CRC Write
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- SDMA Poison Consumption Handling with CRC Write (in-band error injection): via amdgpuras, inject the named SDMA Poison Consumption Handling with CRC Write error and check dmesg/CPER for t`
- 📤 產出人:
  log 取位:return amdgpuras injection result + `dmesg -T | tail -100` (expected amdgpu hardware error) + decoded CPER so the user confirms the injected
  risk:RISK: injecting a hardware/CPU error can disrupt the SUT and may need a reboot/recovery; run only on a dedicated SUT with the exact injectio
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2086/2200 — `Wistron-AMD SVM-00132-V003` · Items=SDMA Poison Consumption Handling with ODECC · TestSet=RAS
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:SDMA Poison Consumption Handling with ODECC
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:• PASS = 
- AMDGPURAS tool SDMA error injection command returns successfully.
- Redfish command for CPER index retrieval shows the CPER index is increased and new CPER file is generated upon the error injected.
- The decoded result from the decoded CPER log matches the injected error type and location.
• Error location lists the OAM on which the error occurred.
• Bank matches the type of error injected: UMC.
• Errorcode ext is 0 and Errocode ext Type is On-die ECC.
• Error severity matches the type of error injected: Deferred error.
• Error location lists the OAM on which the error occurred.
• Bank matches the type of error injected: SDMA.
• Errorcode ext is 62 and Errocode ext Type is GfxSdmaError.
• Error severity matches the type of error injected: Uncorrected Error. Poison has been consumed.
- The inband CPER log matches the OAM devices and error severity level
- Q6 補什麼:AMDGPU-RAS tool (amdgpuras) + Redfish CPER access
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:SDMA Poison Consumption Handling with ODECC
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- SDMA Poison Consumption Handling with ODECC (in-band error injection): via amdgpuras, inject the named SDMA Poison Consumption Handling with ODECC error and check dmesg/CPER for the expec`
- 📤 產出人:
  log 取位:return amdgpuras injection result + `dmesg -T | tail -100` (expected amdgpu hardware error) + decoded CPER so the user confirms the injected
  risk:RISK: injecting a hardware/CPU error can disrupt the SUT and may need a reboot/recovery; run only on a dedicated SUT with the exact injectio
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2087/2200 — `Wistron-AMD SVM-00133-V003` · Items=UMC Defer CRC Write · TestSet=RAS
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:UMC Defer CRC Write
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:• PASS = 
- AMDGPURAS tool UMC error injection command returns successfully.
- Redfish command for CPER index retrieval shows the CPER index is increased and new CPER file is generated upon the error injected.
- The decoded result from the decoded CPER log matches the injected error type and location.
• Error location lists the OAM on which the error occurred.
• Bank matches the type of error injected: UMC.
• Errorcode ext is 15 and Errocode ext Type is End-to-end CRC.
• Error severity matches the type of error injected: Deferred error.
- The inband CPER log matches the OAM devices and error severity level
- Q6 補什麼:AMDGPU-RAS tool (amdgpuras) + Redfish CPER access
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:UMC Defer CRC Write
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- UMC Defer CRC Write (in-band error injection): via amdgpuras, inject the named UMC Defer CRC Write error and check dmesg/CPER for the expected handler report. Needs the exact amdgpuras in`
- 📤 產出人:
  log 取位:return amdgpuras injection result + `dmesg -T | tail -100` (expected amdgpu hardware error) + decoded CPER so the user confirms the injected
  risk:RISK: injecting a hardware/CPU error can disrupt the SUT and may need a reboot/recovery; run only on a dedicated SUT with the exact injectio
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2088/2200 — `Wistron-AMD SVM-00134-V003` · Items=Bad Page Threshold Exceed: Default RMA Threshold · TestSet=RAS
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:Bad Page Threshold Exceed: Default RMA Threshold
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Terminal
Example:
AMDGPURAS tool GFX error injection command returns Bus error.
Remark/ Criteria: Refer to step 12.
BMC Terminal
Example:
Redfish command for CPER index retrieval shows the CPER index is increased and new
CPER files are generated upon the error injected.
Redfish dump entries show:
The resource property OAM_X has detected critical errors of type 'HBM bad page count limit exceeded'
Remark/ Criteria: Refer to step 2 and step 4 respectively
- Q6 補什麼:AMDGPU-RAS tool (amdgpuras) + Redfish CPER access
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Bad Page Threshold Exceed: Default RMA Threshold
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- Bad Page Threshold Exceed: Default RMA Threshold (bad-page threshold exceeded / RMA): clear RAS EEPROM, `modprobe amdgpu ras_enable=1 bad_page_threshold=<val>`, inject to exceed the thres`
- 📤 產出人:
  log 取位:return the injection result + CPER index delta + decoded CPER (bad page threshold exceeded marker) so the user confirms the threshold/RMA be
  risk:RISK: injecting a hardware/CPU error can disrupt the SUT and may need a reboot/recovery; run only on a dedicated SUT with the exact injectio
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2089/2200 — `Wistron-AMD SVM-00135-V003` · Items=HBM CE Threshold Exceed · TestSet=RAS
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:HBM CE Threshold Exceed
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Terminal
Example:
AMDGPURAS tool UMC error injection command returns successfully.
Remark/ Criteria: Refer to step 8.
BMC Terminal
Example:
Redfish command for CPER index retrieval shows the CPER index is increased and new
CPER files are generated upon the error injected.
Redfish dump entries show:
Sensor 'GPU_X_HBM_CE' reading of 2 (CE) is above the 2 upper caution threshold.
Remark/ Criteria: Refer to step 2 and step 4 respectively.
- Q6 補什麼:AMDGPU-RAS tool (amdgpuras) + Redfish CPER access
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:HBM CE Threshold Exceed
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- HBM CE Threshold Exceed (in-band error injection): via amdgpuras, inject the named HBM CE Threshold Exceed error and check dmesg/CPER for the expected handler report. Needs the exact amdg`
- 📤 產出人:
  log 取位:return amdgpuras injection result + `dmesg -T | tail -100` (expected amdgpu hardware error) + decoded CPER so the user confirms the injected
  risk:RISK: injecting a hardware/CPU error can disrupt the SUT and may need a reboot/recovery; run only on a dedicated SUT with the exact injectio
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2090/2200 — `Wistron-BMC-01067-V002` · Items=Check BMC Dimm usage rate under idle · TestSet=BMC Dimm usage
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:Check BMC Dimm usage rate under idle
- Q2 位置:agent-host(BMC shell 直連)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Check dimm usage is smooth with no abnormal increases or decreases
- Q6 補什麼:BMC shell access + top/free
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Check BMC Dimm usage rate under idle
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- Check BMC Dimm usage rate under idle: log into the BMC shell and sample process memory to confirm no abnormal growth (agent-host -> BMC shell, OOB).`
  `sshpass -p "$BMC_PASS" ssh -o StrictHostKeyChecking=no "$BMC_USER"@"$BMC_IP""top -b -n 1 2>&1 | grep -Ei 'redfish' | head -n 5; free -m 2>&1; cat /proc/meminfo 2>&1 | head -n 5 2>&1"`
- 📤 產出人:
  log 取位:return the BMC top redfish line + free/meminfo so the operator confirms DIMM usage is smooth with no abnormal increase/decrease.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️      缺陷**:R5(BMC shell 經 DUT 雙跳誤連 → 移 agent-host 直連 BMC);已修 xlsx

---

### 2091/2200 — `Wistron-GB NV PVP HW-00017-V003` · Items=LC.1_LC Tray Leak - Small Leak Detection · TestSet=Liquid Cooled
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:LC.1_LC Tray Leak - Small Leak Detection
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Ensure tray can detect leaks and turn off and the correct signals are sent via the BMC
- Q6 補什麼:none (physical leak test - human)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:LC.1_LC Tray Leak - Small Leak Detection
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 2092/2200 — `Wistron-HW-00470-V002` · Items=LC.2_LC Tray Leak - Self Test · TestSet=Liquid Cooled
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:LC.2_LC Tray Leak - Self Test
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Ensure tray can detect leaks and turn off and the correct signals are sent via the BMC
- Q6 補什麼:ipmitool + BMC creds (+ vendor leak-test utility if required)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:LC.2_LC Tray Leak - Self Test
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- LC.2_LC Tray Leak - Self Test: trigger the LC-tray leak self-test and read the sensor status ipmitool -I lanplus -C 17 -U "$BMC_USER" -P "$BMC_PASS" -H "$BMC_IP" sensor list 2>&1 | grep -`
- 📤 產出人:
  log 取位:return the leak sensors + SEL so the user confirms the LC-tray self-test result is reported correctly (no leak asserted). (source sheet: HW-
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2093/2200 — `Wistron-GB NV PVP HW-00018-V002` · Items=LC.2_LC Tray Leak - Self Test · TestSet=Liquid Cooled
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:LC.2_LC Tray Leak - Self Test
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Ensure tray can detect leaks and turn off and the correct signals are sent via the BMC
- Q6 補什麼:ipmitool + BMC creds (+ vendor leak-test utility if required)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:LC.2_LC Tray Leak - Self Test
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- LC.2_LC Tray Leak - Self Test: trigger the LC-tray leak self-test and read the sensor status ipmitool -I lanplus -C 17 -U "$BMC_USER" -P "$BMC_PASS" -H "$BMC_IP" sensor list 2>&1 | grep -`
- 📤 產出人:
  log 取位:return the leak sensors + SEL so the user confirms the LC-tray self-test result is reported correctly (no leak asserted). (source sheet: GB-
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2094/2200 — `Wistron-HW-00471-V002` · Items=LC.3_LC Tray Leak - Disconnect Sensor Fault · TestSet=Liquid Cooled
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:LC.3_LC Tray Leak - Disconnect Sensor Fault
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Ensure tray can detect a sensor fault and the correct signals are sent via the BMC
- Q6 補什麼:none (physical disconnect - human)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:LC.3_LC Tray Leak - Disconnect Sensor Fault
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 2095/2200 — `Wistron-GB NV PVP HW-00019-V002` · Items=LC.3_LC Tray Leak - Disconnect Sensor Fault · TestSet=Liquid Cooled
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:LC.3_LC Tray Leak - Disconnect Sensor Fault
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Ensure tray can detect a sensor fault and the correct signals are sent via the BMC
- Q6 補什麼:none (physical disconnect - human)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:LC.3_LC Tray Leak - Disconnect Sensor Fault
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 2096/2200 — `Wistron-GB NV PVP HW-00020-V002` · Items=PW.1_Power EDPp · TestSet=Power
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:PW.1_Power EDPp
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Run system in different scenarios such under load and see that EDPp requirements for the product are met
- Q6 補什麼:NVQual/HMC tooling (user provides) + power instrumentation
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:PW.1_Power EDPp
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- PW.1_Power EDPp (NVQual EDPp input-power peak): needs the NVQual HMC test harness; run system under load scenarios and measure input power against the EDPp requirement - agent needs the N`
- 📤 產出人:
  log 取位:return the NVQual EDPp power measurement + pass/fail vs the product EDPp requirement; needs the user-supplied harness.
  risk:RISK: EDP power testing runs high-load scenarios; adequate cooling + the NVQual harness required.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2097/2200 — `Wistron-GB NV PVP HW-00021-V002` · Items=EC.1_PCIe EOM · TestSet=PCIe
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:EC.1_PCIe EOM
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Test#17 in NVQual performs 50 loops of EOM, ensure test pass without fail.
- Q6 補什麼:NVIDIA PCIe qualification toolchain (LTSSM/NVQual) + operator setup
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:EC.1_PCIe EOM
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- EC.1_PCIe EOM (50x PCIe EOM margin loops via NVQual; PASS EOM per vendor spec): ltssm test requires the NVIDIA PCIe qualification toolchain (LTSSM/NVQual) and operator setup on the SUT th`
- 📤 產出人:
  log 取位:return the LTSSM run log (per-iteration results) + `lspci -vvv LnkSta`/dmesg sweep; user confirms train to expected speed/width with no erro
  risk:RISK: repeated PCIe training/speed-change is state-changing and stresses the link; dedicated SUT + approval.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2098/2200 — `Wistron-GB NV PVP HW-00022-V002` · Items=EC.2_PCIe hot reset · TestSet=PCIe
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:EC.2_PCIe hot reset
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Link can hot reset and train back to expected width and speed with no Errors
- Q6 補什麼:NVIDIA PCIe qualification toolchain (LTSSM/NVQual) + operator setup
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:EC.2_PCIe hot reset
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- EC.2_PCIe hot reset (10000x Hot Reset - SBR with training): ltssm test requires the NVIDIA PCIe qualification toolchain (LTSSM/NVQual) and operator setup on the SUT then run the LTSSM loo`
- 📤 產出人:
  log 取位:return the LTSSM run log (per-iteration results) + `lspci -vvv LnkSta`/dmesg sweep; user confirms train to expected speed/width with no erro
  risk:RISK: repeated PCIe training/speed-change is state-changing and stresses the link; dedicated SUT + approval.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2099/2200 — `Wistron-GB NV PVP HW-00023-V002` · Items=EC.3_PCIe Speed Change 12 · TestSet=PCIe
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:EC.3_PCIe Speed Change 12
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Train to expected width and speed with no Errors
- Q6 補什麼:NVIDIA PCIe qualification toolchain (LTSSM/NVQual) + operator setup
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:EC.3_PCIe Speed Change 12
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- EC.3_PCIe Speed Change 12 (500x Speed Change Gen1-Gen2): ltssm test requires the NVIDIA PCIe qualification toolchain (LTSSM/NVQual) and operator setup on the SUT then run the LTSSM loop a`
- 📤 產出人:
  log 取位:return the LTSSM run log (per-iteration results) + `lspci -vvv LnkSta`/dmesg sweep; user confirms train to expected speed/width with no erro
  risk:RISK: repeated PCIe training/speed-change is state-changing and stresses the link; dedicated SUT + approval.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2100/2200 — `Wistron-GB NV PVP HW-00024-V002` · Items=EC.4_PCIe Speed Change 13 · TestSet=PCIe
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:EC.4_PCIe Speed Change 13
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Train to expected width and speed with no Errors
- Q6 補什麼:NVIDIA PCIe qualification toolchain (LTSSM/NVQual) + operator setup
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:EC.4_PCIe Speed Change 13
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- EC.4_PCIe Speed Change 13 (500x Speed Change Gen1-Gen3): ltssm test requires the NVIDIA PCIe qualification toolchain (LTSSM/NVQual) and operator setup on the SUT then run the LTSSM loop a`
- 📤 產出人:
  log 取位:return the LTSSM run log (per-iteration results) + `lspci -vvv LnkSta`/dmesg sweep; user confirms train to expected speed/width with no erro
  risk:RISK: repeated PCIe training/speed-change is state-changing and stresses the link; dedicated SUT + approval.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2101/2200 — `Wistron-GB NV PVP HW-00025-V002` · Items=EC.5_PCIe Speed Change 14 · TestSet=PCIe
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:EC.5_PCIe Speed Change 14
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Train to expected width and speed with no Errors
- Q6 補什麼:NVIDIA PCIe qualification toolchain (LTSSM/NVQual) + operator setup
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:EC.5_PCIe Speed Change 14
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- EC.5_PCIe Speed Change 14 (500x Speed Change Gen1-Gen4): ltssm test requires the NVIDIA PCIe qualification toolchain (LTSSM/NVQual) and operator setup on the SUT then run the LTSSM loop a`
- 📤 產出人:
  log 取位:return the LTSSM run log (per-iteration results) + `lspci -vvv LnkSta`/dmesg sweep; user confirms train to expected speed/width with no erro
  risk:RISK: repeated PCIe training/speed-change is state-changing and stresses the link; dedicated SUT + approval.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2102/2200 — `Wistron-GB NV PVP HW-00026-V002` · Items=EC.6_PCIe Speed Change 15 · TestSet=PCIe
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:EC.6_PCIe Speed Change 15
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Train to expected width and speed with no Errors
- Q6 補什麼:NVIDIA PCIe qualification toolchain (LTSSM/NVQual) + operator setup
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:EC.6_PCIe Speed Change 15
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- EC.6_PCIe Speed Change 15 (500x Speed Change Gen1-Gen5): ltssm test requires the NVIDIA PCIe qualification toolchain (LTSSM/NVQual) and operator setup on the SUT then run the LTSSM loop a`
- 📤 產出人:
  log 取位:return the LTSSM run log (per-iteration results) + `lspci -vvv LnkSta`/dmesg sweep; user confirms train to expected speed/width with no erro
  risk:RISK: repeated PCIe training/speed-change is state-changing and stresses the link; dedicated SUT + approval.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2103/2200 — `Wistron-HGX NV PVP SW-00004-V003` · Items=SW.4_DOCA Performance · TestSet=NVIDIA NVNetPerf
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:SW.4_DOCA Performance
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:The result meet the networking configuration criteria.
- Q6 補什麼:DOCA SDK + NVNetPerf (NVIDIA - install first)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:SW.4_DOCA Performance
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- SW.4_DOCA Performance: run the NVNetPerf test suites to qualify DOCA networking performance. Agent can pre-check the DOCA/network stack`
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP"docactl --version 2>&1; ethtool -i $DUT_NIC 2>&1 | head -n 6; ibstat 2>&1 | grep -iE 'state|link' 2>&1"`
  `-- the full NVNetPerf suite is a long benchmark needing the vendor test setup (operator provides DOCA SDK + NVNetPerf).`
- 📤 產出人:
  log 取位:return the DOCA/network inventory + the NVNetPerf suite results so the user confirms they meet the networking configuration criteria.
  risk:RISK: NVNetPerf runs long network benchmarks; needs the full DOCA/SmartNIC topology and setup, not a one-liner.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️      缺陷**:Q-LIT(ssh 內層裸雙引號 → 單引號 / 遠端迴圈變數 \$ 逸出);已修 xlsx

---

### 2104/2200 — `Wistron-GB NV PVP HW-00473-V005` · Items=EC.7_PCIe Speed Change 23 · TestSet=PCIe
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:EC.7_PCIe Speed Change 23
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Train to expected width and speed with no Errors
- Q6 補什麼:NVIDIA PCIe qualification toolchain (LTSSM/NVQual) + operator setup
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:EC.7_PCIe Speed Change 23
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- EC.7_PCIe Speed Change 23 (500x Speed Change Gen2-Gen3): ltssm test requires the NVIDIA PCIe qualification toolchain (LTSSM/NVQual) and operator setup on the SUT then run the LTSSM loop a`
- 📤 產出人:
  log 取位:return the LTSSM run log (per-iteration results) + `lspci -vvv LnkSta`/dmesg sweep; user confirms train to expected speed/width with no erro
  risk:RISK: repeated PCIe training/speed-change is state-changing and stresses the link; dedicated SUT + approval.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2105/2200 — `Wistron-GB NV PVP HW-00028-V002` · Items=EC.8_PCIe Speed Change 24 · TestSet=PCIe
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:EC.8_PCIe Speed Change 24
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Train to expected width and speed with no Errors
- Q6 補什麼:NVIDIA PCIe qualification toolchain (LTSSM/NVQual) + operator setup
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:EC.8_PCIe Speed Change 24
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- EC.8_PCIe Speed Change 24 (500x Speed Change Gen2-Gen4): ltssm test requires the NVIDIA PCIe qualification toolchain (LTSSM/NVQual) and operator setup on the SUT then run the LTSSM loop a`
- 📤 產出人:
  log 取位:return the LTSSM run log (per-iteration results) + `lspci -vvv LnkSta`/dmesg sweep; user confirms train to expected speed/width with no erro
  risk:RISK: repeated PCIe training/speed-change is state-changing and stresses the link; dedicated SUT + approval.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2106/2200 — `Wistron-GB NV PVP HW-00029-V002` · Items=EC.9_PCIe Speed Change 25 · TestSet=PCIe
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:EC.9_PCIe Speed Change 25
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:LTSSM - 500x Speed Change (Gen2 - Gen5)
- Q6 補什麼:NVIDIA PCIe qualification toolchain (LTSSM/NVQual) + operator setup
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:EC.9_PCIe Speed Change 25
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- EC.9_PCIe Speed Change 25 (500x Speed Change Gen2-Gen5): ltssm test requires the NVIDIA PCIe qualification toolchain (LTSSM/NVQual) and operator setup on the SUT then run the LTSSM loop a`
- 📤 產出人:
  log 取位:return the LTSSM run log (per-iteration results) + `lspci -vvv LnkSta`/dmesg sweep; user confirms train to expected speed/width with no erro
  risk:RISK: repeated PCIe training/speed-change is state-changing and stresses the link; dedicated SUT + approval.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2107/2200 — `Wistron-GB NV PVP HW-00030-V002` · Items=EC.10_PCIe Speed Change 34 · TestSet=PCIe
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:EC.10_PCIe Speed Change 34
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Train to expected width and speed with no Errors
- Q6 補什麼:NVIDIA PCIe qualification toolchain (LTSSM/NVQual) + operator setup
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:EC.10_PCIe Speed Change 34
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- EC.10_PCIe Speed Change 34 (500x Speed Change Gen3-Gen4): ltssm test requires the NVIDIA PCIe qualification toolchain (LTSSM/NVQual) and operator setup on the SUT then run the LTSSM loop `
- 📤 產出人:
  log 取位:return the LTSSM run log (per-iteration results) + `lspci -vvv LnkSta`/dmesg sweep; user confirms train to expected speed/width with no erro
  risk:RISK: repeated PCIe training/speed-change is state-changing and stresses the link; dedicated SUT + approval.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2108/2200 — `Wistron-GB NV PVP HW-00031-V002` · Items=EC.11_PCIe Speed Change 35 · TestSet=PCIe
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:EC.11_PCIe Speed Change 35
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Train to expected width and speed with no Errors
- Q6 補什麼:NVIDIA PCIe qualification toolchain (LTSSM/NVQual) + operator setup
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:EC.11_PCIe Speed Change 35
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- EC.11_PCIe Speed Change 35 (500x Speed Change Gen3-Gen5): ltssm test requires the NVIDIA PCIe qualification toolchain (LTSSM/NVQual) and operator setup on the SUT then run the LTSSM loop `
- 📤 產出人:
  log 取位:return the LTSSM run log (per-iteration results) + `lspci -vvv LnkSta`/dmesg sweep; user confirms train to expected speed/width with no erro
  risk:RISK: repeated PCIe training/speed-change is state-changing and stresses the link; dedicated SUT + approval.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2109/2200 — `Wistron-GB NV PVP HW-00032-V002` · Items=EC.12_PCIe Speed Change 45 · TestSet=PCIe
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:EC.12_PCIe Speed Change 45
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:LTSSM - 500x Speed Change (Gen4 - Gen5)
- Q6 補什麼:NVIDIA PCIe qualification toolchain (LTSSM/NVQual) + operator setup
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:EC.12_PCIe Speed Change 45
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- EC.12_PCIe Speed Change 45 (500x Speed Change Gen4-Gen5): ltssm test requires the NVIDIA PCIe qualification toolchain (LTSSM/NVQual) and operator setup on the SUT then run the LTSSM loop `
- 📤 產出人:
  log 取位:return the LTSSM run log (per-iteration results) + `lspci -vvv LnkSta`/dmesg sweep; user confirms train to expected speed/width with no erro
  risk:RISK: repeated PCIe training/speed-change is state-changing and stresses the link; dedicated SUT + approval.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2110/2200 — `Wistron-GB NV PVP HW-00033-V002` · Items=EC.13_PCIe Speed Change 16 · TestSet=PCIe
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:EC.13_PCIe Speed Change 16
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Train to expected width and speed with no Errors
- Q6 補什麼:NVIDIA PCIe qualification toolchain (LTSSM/NVQual) + operator setup
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:EC.13_PCIe Speed Change 16
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- EC.13_PCIe Speed Change 16 (500x Speed Change Gen1-Gen6): ltssm test requires the NVIDIA PCIe qualification toolchain (LTSSM/NVQual) and operator setup on the SUT then run the LTSSM loop `
- 📤 產出人:
  log 取位:return the LTSSM run log (per-iteration results) + `lspci -vvv LnkSta`/dmesg sweep; user confirms train to expected speed/width with no erro
  risk:RISK: repeated PCIe training/speed-change is state-changing and stresses the link; dedicated SUT + approval.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2111/2200 — `Wistron-GB NV PVP HW-00034-V003` · Items=EC.15_PCIe Speed Change 36 · TestSet=PCIe
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:EC.15_PCIe Speed Change 36
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Train to expected width and speed with no Errors
- Q6 補什麼:NVIDIA PCIe qualification toolchain (LTSSM/NVQual) + operator setup
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:EC.15_PCIe Speed Change 36
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- EC.15_PCIe Speed Change 36 (500x Speed Change Gen3-Gen6): ltssm test requires the NVIDIA PCIe qualification toolchain (LTSSM/NVQual) and operator setup on the SUT then run the LTSSM loop `
- 📤 產出人:
  log 取位:return the LTSSM run log (per-iteration results) + `lspci -vvv LnkSta`/dmesg sweep; user confirms train to expected speed/width with no erro
  risk:RISK: repeated PCIe training/speed-change is state-changing and stresses the link; dedicated SUT + approval.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2112/2200 — `Wistron-GB NV PVP HW-00035-V002` · Items=EC.14_PCIe Speed Change 26 · TestSet=PCIe
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:EC.14_PCIe Speed Change 26
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Train to expected width and speed with no Errors
- Q6 補什麼:NVIDIA PCIe qualification toolchain (LTSSM/NVQual) + operator setup
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:EC.14_PCIe Speed Change 26
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- EC.14_PCIe Speed Change 26 (500x Speed Change Gen2-Gen6): ltssm test requires the NVIDIA PCIe qualification toolchain (LTSSM/NVQual) and operator setup on the SUT then run the LTSSM loop `
- 📤 產出人:
  log 取位:return the LTSSM run log (per-iteration results) + `lspci -vvv LnkSta`/dmesg sweep; user confirms train to expected speed/width with no erro
  risk:RISK: repeated PCIe training/speed-change is state-changing and stresses the link; dedicated SUT + approval.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2113/2200 — `Wistron-GB NV PVP HW-00036-V002` · Items=EC.16_PCIe Speed Change 46 · TestSet=PCIe
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:EC.16_PCIe Speed Change 46
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Train to expected width and speed with no Errors
- Q6 補什麼:NVIDIA PCIe qualification toolchain (LTSSM/NVQual) + operator setup
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:EC.16_PCIe Speed Change 46
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- EC.16_PCIe Speed Change 46 (500x Speed Change Gen4-Gen6): ltssm test requires the NVIDIA PCIe qualification toolchain (LTSSM/NVQual) and operator setup on the SUT then run the LTSSM loop `
- 📤 產出人:
  log 取位:return the LTSSM run log (per-iteration results) + `lspci -vvv LnkSta`/dmesg sweep; user confirms train to expected speed/width with no erro
  risk:RISK: repeated PCIe training/speed-change is state-changing and stresses the link; dedicated SUT + approval.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2114/2200 — `Wistron-GB NV PVP HW-00037-V002` · Items=EC.17_PCIe Speed Change 56 · TestSet=PCIe
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:EC.17_PCIe Speed Change 56
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Train to expected width and speed with no Errors
- Q6 補什麼:NVIDIA PCIe qualification toolchain (LTSSM/NVQual) + operator setup
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:EC.17_PCIe Speed Change 56
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- EC.17_PCIe Speed Change 56 (500x Speed Change Gen5-Gen6): ltssm test requires the NVIDIA PCIe qualification toolchain (LTSSM/NVQual) and operator setup on the SUT then run the LTSSM loop `
- 📤 產出人:
  log 取位:return the LTSSM run log (per-iteration results) + `lspci -vvv LnkSta`/dmesg sweep; user confirms train to expected speed/width with no erro
  risk:RISK: repeated PCIe training/speed-change is state-changing and stresses the link; dedicated SUT + approval.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2115/2200 — `Wistron-GB NV PVP HW-00038-V002` · Items=EC.18_PCIe link enable disable · TestSet=PCIe
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:EC.18_PCIe link enable disable
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:After link re-enable ensure link trains to expected width and speed with no Errors
- Q6 補什麼:NVIDIA PCIe qualification toolchain (LTSSM/NVQual) + operator setup
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:EC.18_PCIe link enable disable
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- EC.18_PCIe link enable disable (link enable/disable cycles): ltssm test requires the NVIDIA PCIe qualification toolchain (LTSSM/NVQual) and operator setup on the SUT then run the LTSSM lo`
- 📤 產出人:
  log 取位:return the LTSSM run log (per-iteration results) + `lspci -vvv LnkSta`/dmesg sweep; user confirms train to expected speed/width with no erro
  risk:RISK: repeated PCIe training/speed-change is state-changing and stresses the link; dedicated SUT + approval.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2116/2200 — `Wistron-GB NV PVP HW-00039-V002` · Items=EC.19_PCIe retrain · TestSet=PCIe
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:EC.19_PCIe retrain
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Link can successfully retrain without any errors
- Q6 補什麼:NVIDIA PCIe qualification toolchain (LTSSM/NVQual) + operator setup
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:EC.19_PCIe retrain
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- EC.19_PCIe retrain (PCIe retrain): ltssm test requires the NVIDIA PCIe qualification toolchain (LTSSM/NVQual) and operator setup on the SUT then run the LTSSM loop and verify no link/erro`
- 📤 產出人:
  log 取位:return the LTSSM run log (per-iteration results) + `lspci -vvv LnkSta`/dmesg sweep; user confirms train to expected speed/width with no erro
  risk:RISK: repeated PCIe training/speed-change is state-changing and stresses the link; dedicated SUT + approval.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2117/2200 — `Wistron-GB NV PVP HW-00040-V002` · Items=EC.20_PCIe L1 transitions · TestSet=PCIe
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:EC.20_PCIe L1 transitions
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Link can successfully execute L1 transitions without error
- Q6 補什麼:NVIDIA PCIe qualification toolchain (LTSSM/NVQual) + operator setup
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:EC.20_PCIe L1 transitions
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- EC.20_PCIe L1 transitions (PCIe L1 power-state transitions): ltssm test requires the NVIDIA PCIe qualification toolchain (LTSSM/NVQual) and operator setup on the SUT then run the LTSSM lo`
- 📤 產出人:
  log 取位:return the LTSSM run log (per-iteration results) + `lspci -vvv LnkSta`/dmesg sweep; user confirms train to expected speed/width with no erro
  risk:RISK: repeated PCIe training/speed-change is state-changing and stresses the link; dedicated SUT + approval.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2118/2200 — `Wistron-GB NV PVP HW-00041-V002` · Items=EC.21_PCIe D3 transitions · TestSet=PCIe
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:EC.21_PCIe D3 transitions
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Link can successfully execute D3 transitions without error
- Q6 補什麼:NVIDIA PCIe qualification toolchain (LTSSM/NVQual) + operator setup
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:EC.21_PCIe D3 transitions
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- EC.21_PCIe D3 transitions (PCIe D3 power-state transitions): ltssm test requires the NVIDIA PCIe qualification toolchain (LTSSM/NVQual) and operator setup on the SUT then run the LTSSM lo`
- 📤 產出人:
  log 取位:return the LTSSM run log (per-iteration results) + `lspci -vvv LnkSta`/dmesg sweep; user confirms train to expected speed/width with no erro
  risk:RISK: repeated PCIe training/speed-change is state-changing and stresses the link; dedicated SUT + approval.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2119/2200 — `Wistron-HW-00472-V002` · Items=EC.22_PCIe Tx Equalization Test · TestSet=PCIe
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:EC.22_PCIe Tx Equalization Test
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Train to expected width and speed with no Errors
- Q6 補什麼:NVIDIA PCIe qualification toolchain (LTSSM) + operator setup
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:EC.22_PCIe Tx Equalization Test
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- EC.22_PCIe Tx Equalization Test (LTSSM 10000x Tx Eq Redo): run the LTSSM Tx-eq redo loop and confirm no training/link errors.`
- 📤 產出人:
  log 取位:return the 10000x Tx-eq redo run log + `lspci -vvv LnkSta`/dmesg sweep; user confirms link trains with no errors. Very long - confirm approv
  risk:RISK: repeated Tx equalization redos stress the PCIe link; dedicated SUT + approval.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2120/2200 — `Wistron-HGX NV PVP HW-00001-V002` · Items=EC.2_PCIe link up and NVIDIA device enumeration · TestSet=PCIe
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:EC.2_PCIe link up and NVIDIA device enumeration
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:All items should be passed without system hang or reboot.
- Q6 補什麼:NVIDIA PCIe/GPU qualification toolchain + operator for power cycles
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:EC.2_PCIe link up and NVIDIA device enumeration
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- EC.2_PCIe link up and NVIDIA device enumeration (link up + lspci/device enumeration of NVIDIA devices): PCIe qualification on an HGX NV PVP platform (NVIDIA toolchain + GPU device control`
- 📤 產出人:
  log 取位:return the per-iteration result + `lspci -vvv LnkSta`/`nvidia-smi -L`/dmesg evidence; user confirms no errors. Very long - confirm approval.
  risk:RISK: link up + lspci/device enumeration of NVIDIA devices; power-cycle or device-reset is destructive - dedicated SUT + operator + approval
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2121/2200 — `Wistron-GB NV PVP HW-00042-V002` · Items=NT.2_Network NVQual · TestSet=Network
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:NT.2_Network NVQual
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:All tests pass
- Q6 補什麼:NVQual (NVIDIA tool - install first) + test topology
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:NT.2_Network NVQual
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- NT.2_Network NVQual: run the NVIDIA NVQual network test on the BlueField.`
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP"nvqual -h 2>&1 | head -n 15 2>&1"`
  `-- NVQual is a vendor tool (operator install + license/test topology); agent provides the launch wrapper + collects output, then runs the specific NVQual network test per the NVIDIA docs.`
- 📤 產出人:
  log 取位:return the NVQual launch + the specific NT.2_Network NVQual (Wistron-GB NV PVP HW-00042-V002) test result so the user confirms the network t
  risk:RISK: NVQual runs long multi-config network tests; needs the test topology and packages installed, and full pass/fail is judged by the user.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️      缺陷**:Q-LIT(ssh 內層裸雙引號 → 單引號 / 遠端迴圈變數 \$ 逸出);已修 xlsx

---

### 2122/2200 — `Wistron-HGX NV PVP HW-00002-V002` · Items=EC.3_PCIe BER (bit error rate) · TestSet=PCIe
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:EC.3_PCIe BER (bit error rate)
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:All items should be passed without system hang or reboot.
- Q6 補什麼:NVIDIA PCIe/GPU qualification toolchain + operator for power cycles
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:EC.3_PCIe BER (bit error rate)
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- EC.3_PCIe BER (bit error rate) (PCIe BER test): PCIe qualification on an HGX NV PVP platform (NVIDIA toolchain + GPU device control) to run this sub-test and verify PCIe link/device statu`
- 📤 產出人:
  log 取位:return the per-iteration result + `lspci -vvv LnkSta`/`nvidia-smi -L`/dmesg evidence; user confirms no errors. Very long - confirm approval.
  risk:RISK: PCIe BER test; power-cycle or device-reset is destructive - dedicated SUT + operator + approval.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2123/2200 — `Wistron-GB NV PVP HW-00043-V002` · Items=NT.3_Network NVQual · TestSet=Network
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:NT.3_Network NVQual
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:ConnectX/BlueField Thermal Test
- Q6 補什麼:NVQual (NVIDIA tool - install first) + test topology
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:NT.3_Network NVQual
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- NT.3_Network NVQual: run the NVIDIA NVQual network test on the BlueField.`
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP"nvqual -h 2>&1 | head -n 15 2>&1"`
  `-- NVQual is a vendor tool (operator install + license/test topology); agent provides the launch wrapper + collects output, then runs the specific NVQual network/test per the NVIDIA docs.`
- 📤 產出人:
  log 取位:return the NVQual launch + the specific NT.3_Network NVQual (Wistron-GB NV PVP HW-00043-V002) test result so the user confirms the network t
  risk:RISK: NVQual runs long multi-config network tests; needs the test topology and packages installed, and full pass/fail is judged by the user.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️      缺陷**:Q-LIT(ssh 內層裸雙引號 → 單引號 / 遠端迴圈變數 \$ 逸出);已修 xlsx

---

### 2124/2200 — `Wistron-HGX NV PVP HW-00003-V002` · Items=EC.4_PCIe bandwidth · TestSet=PCIe
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:EC.4_PCIe bandwidth
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:All items should be passed without system hang or reboot.
- Q6 補什麼:NVIDIA PCIe/GPU qualification toolchain + operator for power cycles
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:EC.4_PCIe bandwidth
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- EC.4_PCIe bandwidth (PCIe bandwidth test): PCIe qualification on an HGX NV PVP platform (NVIDIA toolchain + GPU device control) to run this sub-test and verify PCIe link/device status eac`
- 📤 產出人:
  log 取位:return the per-iteration result + `lspci -vvv LnkSta`/`nvidia-smi -L`/dmesg evidence; user confirms no errors. Very long - confirm approval.
  risk:RISK: PCIe bandwidth test; power-cycle or device-reset is destructive - dedicated SUT + operator + approval.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2125/2200 — `Wistron-HGX NV PVP HW-00004-V002` · Items=EC.5_Link Interoperability: SBR Hot Reset · TestSet=PCIe
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:EC.5_Link Interoperability: SBR Hot Reset
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:All items should be passed without system hang or reboot.
- Q6 補什麼:NVIDIA PCIe/GPU qualification toolchain + operator for power cycles
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:EC.5_Link Interoperability: SBR Hot Reset
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- EC.5_Link Interoperability: SBR Hot Reset (SBR hot-reset interoperability): PCIe qualification on an HGX NV PVP platform (NVIDIA toolchain + GPU device control) to run this sub-test and v`
- 📤 產出人:
  log 取位:return the per-iteration result + `lspci -vvv LnkSta`/`nvidia-smi -L`/dmesg evidence; user confirms no errors. Very long - confirm approval.
  risk:RISK: SBR hot-reset interoperability; power-cycle or device-reset is destructive - dedicated SUT + operator + approval.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2126/2200 — `Wistron-HGX NV PVP HW-00005-V002` · Items=EC.6_Link Interoperability: Tx Eq Redo · TestSet=PCIe
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:EC.6_Link Interoperability: Tx Eq Redo
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:All items should be passed without system hang or reboot.
- Q6 補什麼:NVIDIA PCIe/GPU qualification toolchain + operator for power cycles
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:EC.6_Link Interoperability: Tx Eq Redo
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- EC.6_Link Interoperability: Tx Eq Redo (Tx equalization redo): PCIe qualification on an HGX NV PVP platform (NVIDIA toolchain + GPU device control) to run this sub-test and verify PCIe li`
- 📤 產出人:
  log 取位:return the per-iteration result + `lspci -vvv LnkSta`/`nvidia-smi -L`/dmesg evidence; user confirms no errors. Very long - confirm approval.
  risk:RISK: Tx equalization redo; power-cycle or device-reset is destructive - dedicated SUT + operator + approval.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2127/2200 — `Wistron-HGX NV PVP HW-00006-V002` · Items=EC.7_Link Interoperability: Link Enable/Disable · TestSet=PCIe
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:EC.7_Link Interoperability: Link Enable/Disable
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:All items should be passed without system hang or reboot.
- Q6 補什麼:NVIDIA PCIe/GPU qualification toolchain + operator for power cycles
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:EC.7_Link Interoperability: Link Enable/Disable
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- EC.7_Link Interoperability: Link Enable/Disable (link enable/disable): PCIe qualification on an HGX NV PVP platform (NVIDIA toolchain + GPU device control) to run this sub-test and verify`
- 📤 產出人:
  log 取位:return the per-iteration result + `lspci -vvv LnkSta`/`nvidia-smi -L`/dmesg evidence; user confirms no errors. Very long - confirm approval.
  risk:RISK: link enable/disable; power-cycle or device-reset is destructive - dedicated SUT + operator + approval.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2128/2200 — `Wistron-HGX NV PVP HW-00007-V002` · Items=EC.8_Link Interoperability: PCIe Link Retrain · TestSet=PCIe
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:EC.8_Link Interoperability: PCIe Link Retrain
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:All items should be passed without system hang or reboot.
- Q6 補什麼:NVIDIA PCIe/GPU qualification toolchain + operator for power cycles
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:EC.8_Link Interoperability: PCIe Link Retrain
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- EC.8_Link Interoperability: PCIe Link Retrain (PCIe link retrain): PCIe qualification on an HGX NV PVP platform (NVIDIA toolchain + GPU device control) to run this sub-test and verify PCI`
- 📤 產出人:
  log 取位:return the per-iteration result + `lspci -vvv LnkSta`/`nvidia-smi -L`/dmesg evidence; user confirms no errors. Very long - confirm approval.
  risk:RISK: PCIe link retrain; power-cycle or device-reset is destructive - dedicated SUT + operator + approval.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2129/2200 — `Wistron-HGX NV PVP HW-00008-V002` · Items=EC.9_PCIe AER Check · TestSet=PCIe
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:EC.9_PCIe AER Check
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:All items should be passed without system hang or reboot.
- Q6 補什麼:NVIDIA PCIe/GPU qualification toolchain + operator for power cycles
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:EC.9_PCIe AER Check
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- EC.9_PCIe AER Check (PCIe AER error check): PCIe qualification on an HGX NV PVP platform (NVIDIA toolchain + GPU device control) to run this sub-test and verify PCIe link/device status ea`
- 📤 產出人:
  log 取位:return the per-iteration result + `lspci -vvv LnkSta`/`nvidia-smi -L`/dmesg evidence; user confirms no errors. Very long - confirm approval.
  risk:RISK: PCIe AER error check; power-cycle or device-reset is destructive - dedicated SUT + operator + approval.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2130/2200 — `Wistron-HGX NV PVP HW-00009-V002` · Items=EC.10_Link Interoperability: PCIe Gen Speed Changes · TestSet=PCIe
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:EC.10_Link Interoperability: PCIe Gen Speed Changes
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:All items should be passed without system hang or reboot.
- Q6 補什麼:NVIDIA PCIe/GPU qualification toolchain + operator for power cycles
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:EC.10_Link Interoperability: PCIe Gen Speed Changes
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- EC.10_Link Interoperability: PCIe Gen Speed Changes (PCIe Gen speed changes): PCIe qualification on an HGX NV PVP platform (NVIDIA toolchain + GPU device control) to run this sub-test and`
- 📤 產出人:
  log 取位:return the per-iteration result + `lspci -vvv LnkSta`/`nvidia-smi -L`/dmesg evidence; user confirms no errors. Very long - confirm approval.
  risk:RISK: PCIe Gen speed changes; power-cycle or device-reset is destructive - dedicated SUT + operator + approval.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2131/2200 — `Wistron-HGX NV PVP HW-00010-V002` · Items=EC.11_L1 PCIe Power Management · TestSet=PCIe
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:EC.11_L1 PCIe Power Management
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:All items should be passed without system hang or reboot.
- Q6 補什麼:NVIDIA PCIe/GPU qualification toolchain + operator for power cycles
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:EC.11_L1 PCIe Power Management
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- EC.11_L1 PCIe Power Management (L1 power management): PCIe qualification on an HGX NV PVP platform (NVIDIA toolchain + GPU device control) to run this sub-test and verify PCIe link/device`
- 📤 產出人:
  log 取位:return the per-iteration result + `lspci -vvv LnkSta`/`nvidia-smi -L`/dmesg evidence; user confirms no errors. Very long - confirm approval.
  risk:RISK: L1 power management; power-cycle or device-reset is destructive - dedicated SUT + operator + approval.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2132/2200 — `Wistron-HGX NV PVP HW-00011-V002` · Items=EC.12_D3 Power Management · TestSet=PCIe
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:EC.12_D3 Power Management
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:All items should be passed without system hang or reboot.
- Q6 補什麼:NVIDIA PCIe/GPU qualification toolchain + operator for power cycles
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:EC.12_D3 Power Management
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- EC.12_D3 Power Management (D3 power management): PCIe qualification on an HGX NV PVP platform (NVIDIA toolchain + GPU device control) to run this sub-test and verify PCIe link/device stat`
- 📤 產出人:
  log 取位:return the per-iteration result + `lspci -vvv LnkSta`/`nvidia-smi -L`/dmesg evidence; user confirms no errors. Very long - confirm approval.
  risk:RISK: D3 power management; power-cycle or device-reset is destructive - dedicated SUT + operator + approval.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2133/2200 — `Wistron-HGX NV PVP HW-00012-V002` · Items=NL.1_NVLink enumeration and full NVLink fabric topology · TestSet=NVLink
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:NL.1_NVLink enumeration and full NVLink fabric topology
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:All items should be passed without system hang or reboot.
- Q6 補什麼:NVQual (NVIDIA - install first) + nvidia-smi
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:NL.1_NVLink enumeration and full NVLink fabric topology
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- NL.1_NVLink enumeration and full NVLink fabric topology: NVQual Test #9 enumerates NVLink + the full fabric topology. Agent first dumps the current topology sshpass -p "$DUT_PASS" ssh -o `
- 📤 產出人:
  log 取位:return the nvidia-smi nvlink -s (link status) + topo -m (matrix) output + the NVQual #9 result so the user confirms the full NVLink fabric t
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2134/2200 — `Wistron-HGX NV PVP HW-00013-V002` · Items=NL.2_NVLink bandwidth · TestSet=NVLink
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:NL.2_NVLink bandwidth
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:All items should be passed without system hang or reboot.
- Q6 補什麼:NVQual (NVIDIA - install first) + nvidia-smi
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:NL.2_NVLink bandwidth
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- NL.2_NVLink bandwidth: NVQual Test #9 measures NVLink bandwidth. Agent first samples the link counters sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "nvidia-smi`
- 📤 產出人:
  log 取位:return the NVLink counter/bandwidth sample + the NVQual #9 result so the user confirms NVLink bandwidth passes.
  risk:RISK: NVQual #9 runs a heavy NVLink throughput test; do not co-run other GPU workloads.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2135/2200 — `Wistron-HGX NV PVP HW-00014-V002` · Items=SD.1_Storage SSD stress test · TestSet=Storage
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:SD.1_Storage SSD stress test
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:All items should be passed without system hang or reboot.
- Q6 補什麼:fio (install) + user-designated test volume
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:SD.1_Storage SSD stress test
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- SD.1_Storage SSD stress test (SSD stress): long SSD stress/fio run needs a user-designated test volume + fio installed; agent writes and runs the matching fio job on the chosen drive and `
- 📤 產出人:
  log 取位:return the full fio output (read/write BW + IOPS) for the SSD stress run so the user compares against the SSD spec; confirm the runtime/targ
  risk:RISK: sustained destructive I/O on the drive; run only against a user-designated test volume.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2136/2200 — `Wistron-HGX NV PVP HW-00015-V002` · Items=EC.17_Sequential SSD FIO Test · TestSet=Storage
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:EC.17_Sequential SSD FIO Test
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:All items should be passed without system hang or reboot.
- Q6 補什麼:fio (install) + user-designated test volume
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:EC.17_Sequential SSD FIO Test
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- EC.17_Sequential SSD FIO Test (Sequential SSD FIO): long SSD stress/fio run needs a user-designated test volume + fio installed; agent writes and runs the matching fio job on the chosen d`
- 📤 產出人:
  log 取位:return the full fio output (read/write BW + IOPS) for the Sequential SSD FIO run so the user compares against the SSD spec; confirm the runt
  risk:RISK: sustained destructive I/O on the drive; run only against a user-designated test volume.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2137/2200 — `Wistron-HGX NV PVP HW-00016-V002` · Items=NT.1_BlueField Eye Margin Test · TestSet=Networking
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:NT.1_BlueField Eye Margin Test
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:All items should be passed without system hang or reboot.
- Q6 補什麼:NVQual (NVIDIA qualification tool, user installs) + target NIC
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:NT.1_BlueField Eye Margin Test
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- NT.1_BlueField Eye Margin Test (BlueField/ConnectX PCIe eye margin): runs an NVQual test module that measures PCIe eye margin; needs the NVQual tooling + the target NIC. Agent needs the e`
- 📤 產出人:
  log 取位:return the NVQual eye-margin module output (pass items) so the user confirms all items pass without system hang or reboot.
  risk:RISK: eye-margin testing exercises the PCIe link; dedicated SUT + the NVQual harness.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2138/2200 — `Wistron-HGX NV PVP HW-00017-V002` · Items=NT.3_BlueField PCIe Interface Traffic Test · TestSet=Networking
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:NT.3_BlueField PCIe Interface Traffic Test
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:All items should be passed without system hang or reboot.
- Q6 補什麼:NVQual (user installs) + ConnectX/BlueField + GPU Direct config
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:NT.3_BlueField PCIe Interface Traffic Test
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- NT.3_BlueField PCIe Interface Traffic Test (PCIe GPU Direct traffic): a NVQual GPU-direct networking test; needs NVQual tooling + the ConnectX/BlueField + GPU-direct configuration. Agent `
- 📤 產出人:
  log 取位:return the NVQual GPU-direct traffic output so the user confirms all items pass without hang/reboot in PCIe mode.
  risk:RISK: GPU Direct traffic saturates NIC/GPU buffers; dedicated SUT + harness.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2139/2200 — `Wistron-HGX NV PVP HW-00018-V002` · Items=NT.4_ConnectX PCIe Eye Margin Test · TestSet=Networking
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:NT.4_ConnectX PCIe Eye Margin Test
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:All items should be passed without system hang or reboot.
- Q6 補什麼:NVQual (NVIDIA qualification tool, user installs) + target NIC
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:NT.4_ConnectX PCIe Eye Margin Test
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- NT.4_ConnectX PCIe Eye Margin Test (BlueField/ConnectX PCIe eye margin): runs an NVQual test module that measures PCIe eye margin; needs the NVQual tooling + the target NIC. Agent needs t`
- 📤 產出人:
  log 取位:return the NVQual eye-margin module output (pass items) so the user confirms all items pass without system hang or reboot.
  risk:RISK: eye-margin testing exercises the PCIe link; dedicated SUT + the NVQual harness.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2140/2200 — `Wistron-HGX NV PVP HW-00019-V002` · Items=NT.6_ConnectX / BlueField Thermal Test · TestSet=Networking
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:NT.6_ConnectX / BlueField Thermal Test
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:All items should be passed without system hang or reboot.
- Q6 補什麼:NVQual (user installs) + the NIC temperature readout via `mget_temp`/sensors
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:NT.6_ConnectX / BlueField Thermal Test
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- NT.6_ConnectX / BlueField Thermal Test (ConnectX/BlueField thermal): a NVQual thermal test that runs the NIC under load and reads temperatures; needs NVQual + the NIC. Agent runs the modu`
- 📤 產出人:
  log 取位:return the NVQual thermal module output + NIC temperature so the user confirms all items pass and temps stay in spec without hang.
  risk:RISK: thermal test runs sustained load producing heat; adequate airflow + dedicated SUT.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2141/2200 — `Wistron-HGX NV PVP HW-00020-V002` · Items=NT.7_ConnectX-8 GPU Direct Test in IB XDR networking mode (1x 800G IB XDR) · TestSet=Networking
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:NT.7_ConnectX-8 GPU Direct Test in IB XDR networking mode (1x 800G IB XDR)
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:All items should be passed without system hang or reboot.
- Q6 補什麼:NVQual (user installs) + ConnectX/BlueField + GPU Direct config
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:NT.7_ConnectX-8 GPU Direct Test in IB XDR networking mode (1x 800G IB XDR)
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- NT.7_ConnectX-8 GPU Direct Test in IB XDR networking mode (1x 800G IB XDR) (IB XDR GPU Direct traffic): a NVQual GPU-direct networking test; needs NVQual tooling + the ConnectX/BlueField `
- 📤 產出人:
  log 取位:return the NVQual GPU-direct traffic output so the user confirms all items pass without hang/reboot in IB XDR mode.
  risk:RISK: GPU Direct traffic saturates NIC/GPU buffers; dedicated SUT + harness.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2142/2200 — `Wistron-HGX NV PVP HW-00021-V002` · Items=NT.8_ConnectX-8 GPU Direct Test in Dual port ethernet networking mode (2x 400G ETH) · TestSet=Networking
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:NT.8_ConnectX-8 GPU Direct Test in Dual port ethernet networking mode (2x 400G ETH)
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:All items should be passed without system hang or reboot.
- Q6 補什麼:NVQual (user installs) + ConnectX/BlueField + GPU Direct config
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:NT.8_ConnectX-8 GPU Direct Test in Dual port ethernet networking mode (2x 400G ETH)
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- NT.8_ConnectX-8 GPU Direct Test in Dual port ethernet networking mode (2x 400G ETH) (dual-port ethernet GPU Direct traffic): a NVQual GPU-direct networking test; needs NVQual tooling + th`
- 📤 產出人:
  log 取位:return the NVQual GPU-direct traffic output so the user confirms all items pass without hang/reboot in dual-port ethernet mode.
  risk:RISK: GPU Direct traffic saturates NIC/GPU buffers; dedicated SUT + harness.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2143/2200 — `Wistron-HGX NV PVP HW-00022-V002` · Items=EC.13_GPU Device Reset: 25x Cold AC Cycles · TestSet=PCIe
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:EC.13_GPU Device Reset: 25x Cold AC Cycles
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Ensure all GPU PCIe links train to the max supported Gen speed x16 with no correctable or uncorrectable errors logged.
- Q6 補什麼:NVIDIA PCIe/GPU qualification toolchain + operator for power cycles
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:EC.13_GPU Device Reset: 25x Cold AC Cycles
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- EC.13_GPU Device Reset: 25x Cold AC Cycles (25 cold AC power cycles): PCIe qualification on an HGX NV PVP platform (NVIDIA toolchain + GPU device control) to run this sub-test and verify `
- 📤 產出人:
  log 取位:return the per-iteration result + `lspci -vvv LnkSta`/`nvidia-smi -L`/dmesg evidence; user confirms no errors. Very long - confirm approval.
  risk:RISK: 25 cold AC power cycles; power-cycle or device-reset is destructive - dedicated SUT + operator + approval.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2144/2200 — `Wistron-HGX NV PVP HW-00023-V003` · Items=EC.14_GPU Device Reset: 25x Cold DC Cycles · TestSet=PCIe
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:EC.14_GPU Device Reset: 25x Cold DC Cycles
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Ensure all GPU PCIe links train to the max supported Gen speed x16 with no correctable or uncorrectable errors logged.
- Q6 補什麼:NVIDIA PCIe/GPU qualification toolchain + operator for power cycles
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:EC.14_GPU Device Reset: 25x Cold DC Cycles
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- EC.14_GPU Device Reset: 25x Cold DC Cycles (25 cold DC (S5) cycles): PCIe qualification on an HGX NV PVP platform (NVIDIA toolchain + GPU device control) to run this sub-test and verify P`
- 📤 產出人:
  log 取位:return the per-iteration result + `lspci -vvv LnkSta`/`nvidia-smi -L`/dmesg evidence; user confirms no errors. Very long - confirm approval.
  risk:RISK: 25 cold DC (S5) cycles; power-cycle or device-reset is destructive - dedicated SUT + operator + approval.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2145/2200 — `Wistron-HGX NV PVP HW-00024-V002` · Items=EC.15_GPU Device Reset: 25x Warm Reboot Cycles · TestSet=PCIe
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:EC.15_GPU Device Reset: 25x Warm Reboot Cycles
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Ensure all GPU PCIe links train to the max supported Gen speed x16 with no correctable or uncorrectable errors logged.
- Q6 補什麼:NVIDIA PCIe/GPU qualification toolchain + operator for power cycles
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:EC.15_GPU Device Reset: 25x Warm Reboot Cycles
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- EC.15_GPU Device Reset: 25x Warm Reboot Cycles (25 warm reboot cycles): PCIe qualification on an HGX NV PVP platform (NVIDIA toolchain + GPU device control) to run this sub-test and verif`
- 📤 產出人:
  log 取位:return the per-iteration result + `lspci -vvv LnkSta`/`nvidia-smi -L`/dmesg evidence; user confirms no errors. Very long - confirm approval.
  risk:RISK: 25 warm reboot cycles; power-cycle or device-reset is destructive - dedicated SUT + operator + approval.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2146/2200 — `Wistron-HGX NV PVP HW-00025-V002` · Items=EC.16_ConnectX-8 PCIe Qualification · TestSet=PCIe
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:EC.16_ConnectX-8 PCIe Qualification
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:All items should be passed without system hang or reboot.
- Q6 補什麼:NVIDIA PCIe/GPU qualification toolchain + operator for power cycles
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:EC.16_ConnectX-8 PCIe Qualification
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- EC.16_ConnectX-8 PCIe Qualification (ConnectX-8 PCIe qualification): PCIe qualification on an HGX NV PVP platform (NVIDIA toolchain + GPU device control) to run this sub-test and verify P`
- 📤 產出人:
  log 取位:return the per-iteration result + `lspci -vvv LnkSta`/`nvidia-smi -L`/dmesg evidence; user confirms no errors. Very long - confirm approval.
  risk:RISK: ConnectX-8 PCIe qualification; power-cycle or device-reset is destructive - dedicated SUT + operator + approval.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2147/2200 — `Wistron-HGX NV PVP HW-00026-V002` · Items=US.1_USB2.0 Interface between HMC and BMC · TestSet=HMC
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:US.1_USB2.0 Interface between HMC and BMC
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:The USB2.0 link between HMC and BMC enumerates to high speed through dmesg.
- Q6 補什麼:usbutils (lsusb)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:US.1_USB2.0 Interface between HMC and BMC
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- US.1_USB2.0 Interface between HMC and BMC: verify the HMC-BMC USB2.0 link enumerates to high speed. Agent checks the USB tree for the HMC management port`
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP"lsusb -t 2>&1; dmesg 2>&1 | grep -iE 'usb 2-?[0-9]|SuperSpeed|high-speed usb' | tail -n 20 2>&1"`
- 📤 產出人:
  log 取位:return the lsusb -t tree + the USB high-speed enumeration dmesg lines so the user confirms the HMC-BMC USB2.0 link enumerates at high speed.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️      缺陷**:Q-LIT(ssh 內層裸雙引號 → 單引號 / 遠端迴圈變數 \$ 逸出);已修 xlsx

---

### 2148/2200 — `Wistron-HGX NV PVP HW-00027-V002` · Items=SY.1_Power cycling and reboot testing · TestSet=Power
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:SY.1_Power cycling and reboot testing
- Q2 位置:agent-host(BMC shell 直連)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:There are no issues pertaining to PCIe, Infiniband/Ethernet, power sequencing, I2C, and USB check.
- Q6 補什麼:ipmitool + controllable PDU (operator)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:SY.1_Power cycling and reboot testing
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- SY.1_Power cycling and reboot testing: 1000x AC + 1000x DC power cycles + 1000x reboots is a long physical power-cycle stress needing PDU/AC control (operator) + IPMI DC cycles; agent aut`
- 📤 產出人:
  log 取位:return per-DC-cycle status + post-check (PCIe/Infiniband/Ethernet/I2C/USB) so the user confirms no sequencing issues across the cycles; AC-c
  risk:RISK: thousands of power cycles is long-running and physically disruptive; dedicated SUT + operator PDU control + approval.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2149/2200 — `Wistron-HGX NV PVP HW-00028-V002` · Items=SY.2_CPU Motherboard · TestSet=CPU
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:SY.2_CPU Motherboard
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Contact your CPU vendor for validation and test guidance.
- Q6 補什麼:dmidecode + pciutils + util-linux
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:SY.2_CPU Motherboard
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- SY.2_CPU Motherboard: validate the CPU motherboard per CPU-vendor guidance; agent runs the generic platform health sweep`
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP"lscpu 2>&1 | grep -E 'Model name|Socket|Core'; dmidecode -t 4 2>&1 | grep -iE 'Version|Manufacturer'; lspci 2>&1 | gr`
- 📤 產出人:
  log 取位:return the CPU model/socket/core count + dmidecode processor version + accelerator enumeration so the user confirms the CPU motherboard is p
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️      缺陷**:Q-LIT(ssh 內層裸雙引號 → 單引號 / 遠端迴圈變數 \$ 逸出);已修 xlsx

---

### 2150/2200 — `Wistron-HGX NV PVP HW-00029-V002` · Items=DG.1_Partner Field Diagnostics (Level 2) · TestSet=Fielddiag
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:DG.1_Partner Field Diagnostics (Level 2)
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:All items should be passed without system hang or reboot.
- Q6 補什麼:partnerdiag (NVIDIA diagnostic package - user-provided)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:DG.1_Partner Field Diagnostics (Level 2)
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- DG.1_Partner Field Diagnostics (Level 2): run the partner Field Diagnostics Level 2: sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "./partnerdiag --field --leve`
- 📤 產出人:
  log 取位:return the partnerdiag field-level2 output (per-item PASS/FAIL) so the user confirms all items pass without system hang or reboot.
  risk:RISK: partnerdiag runs low-level HW diagnostics incl NVLink/PCIe; run in a maintenance window and do not interrupt.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2151/2200 — `Wistron-HGX NV PVP HW-00030-V002` · Items=DG.2_Partner Manufacturing Diagnostics · TestSet=Mfgdiag
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:DG.2_Partner Manufacturing Diagnostics
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:All items should be passed without system hang or reboot.
- Q6 補什麼:partnerdiag + spec_blackwell-hgx-8-gpu_partner_mfg.json (user-provided)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:DG.2_Partner Manufacturing Diagnostics
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- DG.2_Partner Manufacturing Diagnostics (HGX DG.2 Partner Mfg Diagnostics): run sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "./partnerdiag --mfg --run_spec=spe`
- 📤 產出人:
  log 取位:return the partnerdiag manufacturing output (per-item PASS/FAIL) so the user confirms all items pass without system hang/reboot.
  risk:RISK: manufacturing diagnostics exercise all HW (NVLink/GPUs/PCIe); long run - maintenance window only.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2152/2200 — `Wistron-HGX NV PVP SW-00002-V002` · Items=SW.1_System software · TestSet=NVSSVT
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:SW.1_System software
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:NVSSVT pass rate 100%
- Q6 補什麼:NVSSVT (NVIDIA tool - install first) + NVIDIA driver/container stack
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:SW.1_System software
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- SW.1_System software: run the NVSSVT system-software qualification suites (L0/L1). The agent can collect the software/OS inventory that NVSSVT validates`
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP"nvidia-smi 2>&1 | head -n 12; echo ---; uname -r; cat /etc/os-release 2>&1 | grep -E 'PRETTY_NAME' 2>&1"`
  `-- the full NVSSVT suite is a multi-test vendor-run needing the NVSSVT package (operator provides).`
- 📤 產出人:
  log 取位:return the pre-run inventory (driver version, kernel, OS) + the NVSSVT suite pass-rate so the user confirms the 100% NVSSVT pass target; exa
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️      缺陷**:Q-LIT(ssh 內層裸雙引號 → 單引號 / 遠端迴圈變數 \$ 逸出);已修 xlsx

---

### 2153/2200 — `Wistron-HGX NV PVP SW-00003-V002` · Items=SW.2_Server RAS Capability · TestSet=NVRASTool
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:SW.2_Server RAS Capability
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:NVRAS pass rate 100%
- Q6 補什麼:NVRASTool (NVIDIA - install first) + rasdaemon
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:SW.2_Server RAS Capability
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- SW.2_Server RAS Capability: run the NVRAS server-RAS-capability suites. Agent first collects the RAS-relevant OS state`
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP"rasdaemon --help 2>&1 | head -n 5; ls /sys/devices/system/edac/ 2>&1; dmesg 2>&1 | grep -iE 'ras|edac' | tail -n 10 2`
  `-- the full NVRAS validation needs the NVIDIA NVRAS tool suites (operator provides).`
- 📤 產出人:
  log 取位:return the RAS-related dmesg/edac inventory + the NVRAS suite pass-rate so the user confirms the 100% NVRAS pass target.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️      缺陷**:Q-LIT(ssh 內層裸雙引號 → 單引號 / 遠端迴圈變數 \$ 逸出);已修 xlsx

---

### 2154/2200 — `Wistron-HGX NV PVP SW-00004-V002` · Items=SW.3_Debug Log Collection · TestSet=NVDebug Tool
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:SW.3_Debug Log Collection
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:All logs can capture without issues.
- Q6 補什麼:NVDebug tool (NVIDIA - install first)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:SW.3_Debug Log Collection
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- SW.3_Debug Log Collection: follow NVDebug procedures to capture all logs in-band and OOB. Agent can trigger the in-band log capture tooling sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChec`
- 📤 產出人:
  log 取位:return the NVDebug in-band capture stdout + the list of collected log files (in-band + OOB) so the user confirms all logs are captured witho
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2155/2200 — `Wistron-GB NV PVP HW-00044-V005` · Items=IC.1_BMC I2C-2, and 1P functional · TestSet=I2C
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:IC.1_BMC I2C-2, and 1P functional
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:BMC can successfully communicate with I2C devices on first HPM
- Q6 補什麼:BMC console (i2cdetect/i2cget built-in)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:IC.1_BMC I2C-2, and 1P functional
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- IC.1_BMC I2C-2, and 1P functional is a physical I2C-connection test; the agent can partially verify device reachability on BMC I2C bus I2C-2 via `i2cdetect -y I2C-2` / `i2cget` on the BMC`
- 📤 產出人:
  log 取位:return the full `i2cdetect -y I2C-2` address map so the user confirms each expected I2C device responds; physical connection + photos by ope
  risk:RISK: probing I2C requires care not to disturb live connectors; do not force I2C operations that could write to EEPROM. Connection integrity
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2156/2200 — `Wistron-GB NV PVP HW-00045-V003` · Items=IC.2_BMC I2C-7, and 2P functional · TestSet=I2C
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:IC.2_BMC I2C-7, and 2P functional
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:BMC can successfully communicate with I2C devices on second HPM
- Q6 補什麼:BMC console (i2cdetect/i2cget built-in)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:IC.2_BMC I2C-7, and 2P functional
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- IC.2_BMC I2C-7, and 2P functional is a physical I2C-connection test; the agent can partially verify device reachability on BMC I2C bus I2C-7 via `i2cdetect -y I2C-7` / `i2cget` on the BMC`
- 📤 產出人:
  log 取位:return the full `i2cdetect -y I2C-7` address map so the user confirms each expected I2C device responds; physical connection + photos by ope
  risk:RISK: probing I2C requires care not to disturb live connectors; do not force I2C operations that could write to EEPROM. Connection integrity
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2157/2200 — `Wistron-GB NV PVP HW-00046-V002` · Items=IC.3_BMC I2C-1 SSIF functional · TestSet=I2C
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:IC.3_BMC I2C-1 SSIF functional
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:SSIF Bus between SMA and BMC is functional
- Q6 補什麼:BMC console (i2cdetect/i2cget built-in)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:IC.3_BMC I2C-1 SSIF functional
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- IC.3_BMC I2C-1 SSIF functional is a physical I2C-connection test; the agent can partially verify device reachability on BMC I2C bus I2C-1 via `i2cdetect -y I2C-1` / `i2cget` on the BMC co`
- 📤 產出人:
  log 取位:return the full `i2cdetect -y I2C-1` address map so the user confirms each expected I2C device responds; physical connection + photos by ope
  risk:RISK: probing I2C requires care not to disturb live connectors; do not force I2C operations that could write to EEPROM. Connection integrity
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2158/2200 — `Wistron-GB NV PVP HW-00047-V002` · Items=IC.4_BMC I2C-9 and PDB · TestSet=I2C
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:IC.4_BMC I2C-9 and PDB
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:BMC can successfully communicate with I2C devices on PDB
- Q6 補什麼:BMC console (i2cdetect/i2cget built-in)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:IC.4_BMC I2C-9 and PDB
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- IC.4_BMC I2C-9 and PDB is a physical I2C-connection test; the agent can partially verify device reachability on BMC I2C bus I2C-9 via `i2cdetect -y I2C-9` / `i2cget` on the BMC console (c`
- 📤 產出人:
  log 取位:return the full `i2cdetect -y I2C-9` address map so the user confirms each expected I2C device responds; physical connection + photos by ope
  risk:RISK: probing I2C requires care not to disturb live connectors; do not force I2C operations that could write to EEPROM. Connection integrity
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2159/2200 — `Wistron-GB NV PVP HW-00048-V002` · Items=IC.5_HMC I2C-1, and 1P functional · TestSet=I2C
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:IC.5_HMC I2C-1, and 1P functional
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:HMC can successfully communicate with I2C devices on first HPM
- Q6 補什麼:BMC console (i2cdetect/i2cget built-in)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:IC.5_HMC I2C-1, and 1P functional
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- IC.5_HMC I2C-1, and 1P functional is a physical I2C-connection test; the agent can partially verify device reachability on BMC I2C bus I2C-1 via `i2cdetect -y I2C-1` / `i2cget` on the BMC`
- 📤 產出人:
  log 取位:return the full `i2cdetect -y I2C-1` address map so the user confirms each expected I2C device responds; physical connection + photos by ope
  risk:RISK: probing I2C requires care not to disturb live connectors; do not force I2C operations that could write to EEPROM. Connection integrity
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2160/2200 — `Wistron-GB NV PVP HW-00049-V002` · Items=IC.6_HMC I2C-7, and 2P functional · TestSet=I2C
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:IC.6_HMC I2C-7, and 2P functional
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:HMC can successfully communicate with I2C devices on second HPM
- Q6 補什麼:BMC console (i2cdetect/i2cget built-in)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:IC.6_HMC I2C-7, and 2P functional
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- IC.6_HMC I2C-7, and 2P functional is a physical I2C-connection test; the agent can partially verify device reachability on BMC I2C bus I2C-7 via `i2cdetect -y I2C-7` / `i2cget` on the BMC`
- 📤 產出人:
  log 取位:return the full `i2cdetect -y I2C-7` address map so the user confirms each expected I2C device responds; physical connection + photos by ope
  risk:RISK: probing I2C requires care not to disturb live connectors; do not force I2C operations that could write to EEPROM. Connection integrity
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2161/2200 — `Wistron-GB NV PVP HW-00050-V002` · Items=IC.7_CPU and RTC · TestSet=I2C
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:IC.7_CPU and RTC
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:CPU/OS can successfully communicate with RTC and read time
- Q6 補什麼:BMC console (i2cdetect/i2cget built-in)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:IC.7_CPU and RTC
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- IC.7_CPU and RTC is a physical I2C-connection test; the agent can partially verify device reachability on BMC I2C bus (RTC bus) via `i2cdetect -y (RTC bus)` / `i2cget` on the BMC console `
- 📤 產出人:
  log 取位:return the full `i2cdetect -y (RTC bus)` address map so the user confirms each expected I2C device responds; physical connection + photos by
  risk:RISK: probing I2C requires care not to disturb live connectors; do not force I2C operations that could write to EEPROM. Connection integrity
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2162/2200 — `Wistron-GB NV PVP HW-00051-V002` · Items=SP.1_SPI functional - BMC and BMC EROT · TestSet=SPI
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:SP.1_SPI functional - BMC and BMC EROT
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Devices can successfully communicate over SPI
- Q6 補什麼:BMC EROT firmware/scope (operator/vendor)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:SP.1_SPI functional - BMC and BMC EROT
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 2163/2200 — `Wistron-GB NV PVP HW-00052-V002` · Items=SPI.2_SPI functional - CPU and TPM · TestSet=SPI
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:SPI.2_SPI functional - CPU and TPM
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Devices can successfully communicate over SPI
- Q6 補什麼:TPM firmware/SPI test tooling (operator)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:SPI.2_SPI functional - CPU and TPM
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 2164/2200 — `Wistron-GB NV PVP HW-00053-V002` · Items=UA.1_UART CPU to USB-C · TestSet=UART
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:UA.1_UART CPU to USB-C
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:UART is functioning normally and can send and receive traffic over UART
- Q6 補什麼:usbserial/tty drivers (present)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:UA.1_UART CPU to USB-C
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- UA.1_UART CPU to USB-C: verify UART CPU-to-USB-C connectivity. Agent can enumerate the USB-C serial adapters`
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP"dmesg 2>&1 | grep -iE 'cp210x|ftdi|usb 1-' | tail -n 15; ls /dev/ttyUSB* /dev/ttyACM* 2>&1"`
  `-- a functional send/receive traffic loop needs a physical USB-C connection (operator).`
- 📤 產出人:
  log 取位:return the dmesg serial-adapter probe + the /dev/ttyUSB*/ttyACM* list so the user confirms the CPU UART enumerates to the USB-C port; the tr
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️      缺陷**:Q-LIT(ssh 內層裸雙引號 → 單引號 / 遠端迴圈變數 \$ 逸出);已修 xlsx

---

### 2165/2200 — `Wistron-GB NV PVP HW-00054-V002` · Items=UA.2_UART BMC to USB-C · TestSet=UART
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:UA.2_UART BMC to USB-C
- Q2 位置:agent-host(BMC shell 直連)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:UART is functioning normally and can send and receive traffic over UART
- Q6 補什麼:serial drivers (present)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:UA.2_UART BMC to USB-C
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- UA.2_UART BMC to USB-C: verify UART BMC-to-USB-C connectivity. Agent lists the serial devices under BMC`
  `sshpass -p "$BMC_PASS" ssh -o StrictHostKeyChecking=no "$BMC_USER"@"$BMC_IP""ls /dev/ttyS* /dev/ttyUSB* 2>&1; dmesg 2>&1 | grep -iE 'serial|ttyS|usb' | tail -n 12 2>&1"`
  `-- a send/receive loop needs an operator on the USB-C console.`
- 📤 產出人:
  log 取位:return the BMC serial device listing + dmesg probe lines so the user confirms the BMC UART is present on the USB-C port; traffic test judged
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️      缺陷**:Q-LIT(ssh 內層裸雙引號 → 單引號 / 遠端迴圈變數 \$ 逸出);已修 xlsx

---

### 2166/2200 — `Wistron-GB NV PVP HW-00055-V002` · Items=UA.3_UART HMC to USB-C · TestSet=UART
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:UA.3_UART HMC to USB-C
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:UART is functioning normally and can send and receive traffic over UART
- Q6 補什麼:serial drivers (present)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:UA.3_UART HMC to USB-C
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- UA.3_UART HMC to USB-C: verify UART HMC-to-USB-C. Agent checks the HMC serial/console device state`
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP"ls /dev/ttyACM* /dev/ttyUSB* 2>&1; dmesg 2>&1 | grep -iE 'acm|usb' | tail -n 12 2>&1"`
  `-- a bidirectional UART traffic test needs a physical terminal on the USB-C connector (operator).`
- 📤 產出人:
  log 取位:return the USB-C serial device listing + dmesg probe lines so the user confirms the HMC UART is present; the send/receive evidence is captur
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️      缺陷**:Q-LIT(ssh 內層裸雙引號 → 單引號 / 遠端迴圈變數 \$ 逸出);已修 xlsx

---

### 2167/2200 — `Wistron-GB NV PVP HW-00056-V002` · Items=US.1_USB BMC to HMC USB Hub functional · TestSet=USB
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:US.1_USB BMC to HMC USB Hub functional
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:USB hub is detected (pass)
- Q6 補什麼:usbutils (lsusb)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:US.1_USB BMC to HMC USB Hub functional
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- US.1_USB BMC to HMC USB Hub functional: verifying the USB hub/port link + downstream devices is a physical check (the hub/port is on the BMC/HPM/PCI board); agent reads the OS USB topolog`
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP"lsusb 2>&1 | grep -iE 'hub|usb' | head -n 40 2>&1"`
  `-- once the BMC/port link is active; the physical connection/link-up is operator-observed.`
- 📤 產出人:
  log 取位:return `lsusb` output showing the hub/downstream devices so the user confirms the USB hub is detected; physical link state is operator-verif
  risk:RISK: physical USB link check needs a person; agent only reads the detected topology.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️      缺陷**:Q-LIT(ssh 內層裸雙引號 → 單引號 / 遠端迴圈變數 \$ 逸出);已修 xlsx

---

### 2168/2200 — `Wistron-GB NV PVP HW-00057-V002` · Items=US.2_USB BMC to HPM USB Hub functional · TestSet=USB
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:US.2_USB BMC to HPM USB Hub functional
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:USB hub is detected (pass)
- Q6 補什麼:usbutils (lsusb)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:US.2_USB BMC to HPM USB Hub functional
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- US.2_USB BMC to HPM USB Hub functional: verifying the USB hub/port link + downstream devices is a physical check (the hub/port is on the BMC/HPM/PCI board); agent reads the OS USB topolog`
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP"lsusb 2>&1 | grep -iE 'hub|usb' | head -n 40 2>&1"`
  `-- once the BMC/port link is active; the physical connection/link-up is operator-observed.`
- 📤 產出人:
  log 取位:return `lsusb` output showing the hub/downstream devices so the user confirms the USB hub is detected; physical link state is operator-verif
  risk:RISK: physical USB link check needs a person; agent only reads the detected topology.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️      缺陷**:Q-LIT(ssh 內層裸雙引號 → 單引號 / 遠端迴圈變數 \$ 逸出);已修 xlsx

---

### 2169/2200 — `Wistron-GB NV PVP HW-00058-V003` · Items=US.3_USB BMC to Bay B CX9 USB Hub functional · TestSet=USB
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:US.3_USB BMC to Bay B CX9 USB Hub functional
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:USB hub is detected (pass)
- Q6 補什麼:usbutils (lsusb)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:US.3_USB BMC to Bay B CX9 USB Hub functional
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- US.3_USB BMC to Bay B CX9 USB Hub functional: verifying the USB hub/port link + downstream devices is a physical check (the hub/port is on the BMC/HPM/PCI board); agent reads the OS USB t`
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP"lsusb 2>&1 | grep -iE 'hub|usb' | head -n 40 2>&1"`
  `-- once the BMC/port link is active; the physical connection/link-up is operator-observed.`
- 📤 產出人:
  log 取位:return `lsusb` output showing the hub/downstream devices so the user confirms the USB hub is detected; physical link state is operator-verif
  risk:RISK: physical USB link check needs a person; agent only reads the detected topology.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️      缺陷**:Q-LIT(ssh 內層裸雙引號 → 單引號 / 遠端迴圈變數 \$ 逸出);已修 xlsx

---

### 2170/2200 — `Wistron-GB NV PVP HW-00059-V002` · Items=US.4_USB BMC to BF4 USB Hub functional · TestSet=USB
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:US.4_USB BMC to BF4 USB Hub functional
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:USB hub is detected (pass)
- Q6 補什麼:usbutils (lsusb)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:US.4_USB BMC to BF4 USB Hub functional
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- US.4_USB BMC to BF4 USB Hub functional: verifying the USB hub/port link + downstream devices is a physical check (the hub/port is on the BMC/HPM/PCI board); agent reads the OS USB topolog`
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP"lsusb 2>&1 | grep -iE 'hub|usb' | head -n 40 2>&1"`
  `-- once the BMC/port link is active; the physical connection/link-up is operator-observed.`
- 📤 產出人:
  log 取位:return `lsusb` output showing the hub/downstream devices so the user confirms the USB hub is detected; physical link state is operator-verif
  risk:RISK: physical USB link check needs a person; agent only reads the detected topology.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️      缺陷**:Q-LIT(ssh 內層裸雙引號 → 單引號 / 遠端迴圈變數 \$ 逸出);已修 xlsx

---

### 2171/2200 — `Wistron-GB NV PVP HW-00060-V002` · Items=US.5_USB CPU to USB port on Front IO board functional · TestSet=USB
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:US.5_USB CPU to USB port on Front IO board functional
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:USB port is detected (pass)
- Q6 補什麼:usbutils (lsusb)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:US.5_USB CPU to USB port on Front IO board functional
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- US.5_USB CPU to USB port on Front IO board functional: verifying the USB hub/port link + downstream devices is a physical check (the hub/port is on the BMC/HPM/PCI board); agent reads the`
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP"lsusb 2>&1 | grep -iE 'hub|usb' | head -n 40 2>&1"`
  `-- once the BMC/port link is active; the physical connection/link-up is operator-observed.`
- 📤 產出人:
  log 取位:return `lsusb` output showing the hub/downstream devices so the user confirms the USB hub is detected; physical link state is operator-verif
  risk:RISK: physical USB link check needs a person; agent only reads the detected topology.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️      缺陷**:Q-LIT(ssh 內層裸雙引號 → 單引號 / 遠端迴圈變數 \$ 逸出);已修 xlsx

---

### 2172/2200 — `Wistron-GB NV PVP HW-00061-V002` · Items=US.6_USB CPU to USB controller (ETH SW)  functional · TestSet=USB
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:US.6_USB CPU to USB controller (ETH SW)  functional
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:USB port is detected (pass)
- Q6 補什麼:usbutils (lsusb)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:US.6_USB CPU to USB controller (ETH SW)  functional
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- US.6_USB CPU to USB controller (ETH SW)  functional: verifying the USB hub/port link + downstream devices is a physical check (the hub/port is on the BMC/HPM/PCI board); agent reads the O`
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP"lsusb 2>&1 | grep -iE 'hub|usb' | head -n 40 2>&1"`
  `-- once the BMC/port link is active; the physical connection/link-up is operator-observed.`
- 📤 產出人:
  log 取位:return `lsusb` output showing the hub/downstream devices so the user confirms the USB hub is detected; physical link state is operator-verif
  risk:RISK: physical USB link check needs a person; agent only reads the detected topology.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️      缺陷**:Q-LIT(ssh 內層裸雙引號 → 單引號 / 遠端迴圈變數 \$ 逸出);已修 xlsx

---

### 2173/2200 — `Wistron-GB NV PVP HW-00062-V002` · Items=SY.1_BMC Ports functional · TestSet=System
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:SY.1_BMC Ports functional
- Q2 位置:不執行(見說明)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:All ports work
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:SY.1_BMC Ports functional
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 2174/2200 — `Wistron-BIOS-00493-V004` · Items=Socket Configuration-Processor Configuration · TestSet=BIOS default setting - Intel
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:Socket Configuration-Processor Configuration
- Q2 位置:不執行(見說明)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. No error log happen.
2. Normal reboot ,no hang、crash happen.
3. Check your setting still exist.
4. The default setting should matches SPEC.
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Socket Configuration-Processor Configuration
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 2175/2200 — `Wistron-BIOS-00494-V004` · Items=Socket Configuration-Common Refcode Configuration · TestSet=BIOS default setting - Intel
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:Socket Configuration-Common Refcode Configuration
- Q2 位置:不執行(見說明)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. No error log happen.
2. Normal reboot ,no hang、crash happen.
3. Check your setting still exist.
4. The default setting should matches SPEC.
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Socket Configuration-Common Refcode Configuration
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 2176/2200 — `Wistron-BIOS-00495-V004` · Items=Socket Configuration-Uncore Configuration · TestSet=BIOS default setting - Intel
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:Socket Configuration-Uncore Configuration
- Q2 位置:不執行(見說明)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. No error log happen.
2. Normal reboot ,no hang、crash happen.
3. Check your setting still exist.
4. The default setting should matches SPEC.
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Socket Configuration-Uncore Configuration
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 2177/2200 — `Wistron-BIOS-00496-V004` · Items=Socket Configuration-Memory Configuration · TestSet=BIOS default setting - Intel
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:Socket Configuration-Memory Configuration
- Q2 位置:不執行(見說明)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. No error log happen.
2. Normal reboot ,no hang、crash happen.
3. Check your setting still exist.
4. The default setting should matches SPEC.
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Socket Configuration-Memory Configuration
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 2178/2200 — `Wistron-BIOS-00497-V004` · Items=Socket Configuration-Security Configuration · TestSet=BIOS default setting - Intel
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:Socket Configuration-Security Configuration
- Q2 位置:不執行(見說明)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. No error log happen.
2. Normal reboot ,no hang、crash happen.
3. Check your setting still exist.
4. The default setting should matches SPEC.
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Socket Configuration-Security Configuration
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 2179/2200 — `Wistron-BIOS-00498-V004` · Items=Socket Configuration-IIO Configuration · TestSet=BIOS default setting - Intel
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:Socket Configuration-IIO Configuration
- Q2 位置:不執行(見說明)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. No error log happen.
2. Normal reboot ,no hang、crash happen.
3. Check your setting still exist.
4. The default setting should matches SPEC.
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Socket Configuration-IIO Configuration
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 2180/2200 — `Wistron-BIOS-00499-V003` · Items=Socket Configuration-Advanced Power Management Configuration · TestSet=BIOS default setting - Intel
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:Socket Configuration-Advanced Power Management Configuration
- Q2 位置:不執行(見說明)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. No error log happen.
2. Normal reboot ,no hang、crash happen.
3. Check your setting still exist.
4. The default setting should matches SPEC.
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Socket Configuration-Advanced Power Management Configuration
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 2181/2200 — `Wistron-BIOS-00500-V003` · Items=Socket Configuration-Processor Configuration · TestSet=Change BIOS default setting - Intel
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:Socket Configuration-Processor Configuration
- Q2 位置:不執行(見說明)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. No error log happen.
2. Normal reboot ,no hang、crash happen.
3. Check your setting still exist.
4. The default setting should matches SPEC.
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Socket Configuration-Processor Configuration
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 2182/2200 — `Wistron-BIOS-00501-V002` · Items=Socket Configuration-Common Refcode Configuration · TestSet=Change BIOS default setting - Intel
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:Socket Configuration-Common Refcode Configuration
- Q2 位置:不執行(見說明)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. No error log happen.
2. Normal reboot ,no hang、crash happen.
3. Check your setting still exist.
4. The default setting should matches SPEC.
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Socket Configuration-Common Refcode Configuration
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 2183/2200 — `Wistron-BIOS-00502-V002` · Items=Socket Configuration-Uncore Configuration · TestSet=Change BIOS default setting - Intel
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:Socket Configuration-Uncore Configuration
- Q2 位置:不執行(見說明)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. No error log happen.
2. Normal reboot ,no hang、crash happen.
3. Check your setting still exist.
4. The default setting should matches SPEC.
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Socket Configuration-Uncore Configuration
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 2184/2200 — `Wistron-BIOS-00503-V002` · Items=Socket Configuration-Memory Configuration · TestSet=Change BIOS default setting - Intel
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:Socket Configuration-Memory Configuration
- Q2 位置:不執行(見說明)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. No error log happen.
2. Normal reboot ,no hang、crash happen.
3. Check your setting still exist.
4. The default setting should matches SPEC.
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Socket Configuration-Memory Configuration
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 2185/2200 — `Wistron-BIOS-00504-V002` · Items=Socket Configuration-Security Configuration · TestSet=Change BIOS default setting - Intel
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:Socket Configuration-Security Configuration
- Q2 位置:不執行(見說明)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. No error log happen.
2. Normal reboot ,no hang、crash happen.
3. Check your setting still exist.
4. The default setting should matches SPEC.
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Socket Configuration-Security Configuration
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 2186/2200 — `Wistron-BIOS-00505-V002` · Items=Socket Configuration-IIO Configuration · TestSet=Change BIOS default setting - Intel
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:Socket Configuration-IIO Configuration
- Q2 位置:不執行(見說明)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. No error log happen.
2. Normal reboot ,no hang、crash happen.
3. Check your setting still exist.
4. The default setting should matches SPEC.
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Socket Configuration-IIO Configuration
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 2187/2200 — `Wistron-BIOS-00506-V002` · Items=Socket Configuration-Advanced Power Management Configuration · TestSet=Change BIOS default setting - Intel
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:Socket Configuration-Advanced Power Management Configuration
- Q2 位置:不執行(見說明)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. No error log happen.
2. Normal reboot ,no hang、crash happen.
3. Check your setting still exist.
4. The default setting should matches SPEC.
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Socket Configuration-Advanced Power Management Configuration
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 2188/2200 — `Wistron-HW-00470-V004` · Items=Mellanox - CX9 Board · TestSet=Mechanical -AVL
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:Mellanox - CX9 Board
- Q2 位置:不執行(見說明)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:All components should be seated properly
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Mellanox - CX9 Board
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 2189/2200 — `Wistron-HW-00471-V004` · Items=Mellanox - BF4 Cable · TestSet=Mechanical -AVL
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:Mellanox - BF4 Cable
- Q2 位置:不執行(見說明)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:All components should be seated properly
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Mellanox - BF4 Cable
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 2190/2200 — `Wistron-HW-00472-V003` · Items=Mellanox - CX9 Cable · TestSet=Mechanical -AVL
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:Mellanox - CX9 Cable
- Q2 位置:不執行(見說明)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:All components should be seated properly
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Mellanox - CX9 Cable
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 2191/2200 — `Wistron-HW-00473-V002` · Items=Mellanox - BF4 Board · TestSet=Mechanical -AVL
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:Mellanox - BF4 Board
- Q2 位置:不執行(見說明)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:All components should be seated properly
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Mellanox - BF4 Board
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 2192/2200 — `Wistron-HW-00475-V002` · Items=Vendor ID · TestSet=Processor
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Vendor ID
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. CPU can be install  in motherboard normally.
2. CPU information can check in setup menu and follow spec. (for example : socket 0 ,1)
3. CPU information can check in OS successfully.
- Q6 補什麼:util-linux (lscpu) dmidecode
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Vendor ID
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- Vendor ID: read CPU vendor/model/architecture + dmidecode type-4 manufacturer/version/family.`
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP"lscpu 2>&1 | grep -iE 'vendor|model name|architecture'; dmidecode -t 4 2>/dev/null | grep -iE 'manufacturer|version|f`
- 📤 產出人:
  log 取位:return FULL Vendor ID output (lscpu 2>&1 | grep -iE "vendor|model name|architecture") so the user confirms the value(s) match the spec/datas
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️      缺陷**:Q-LIT(ssh 內層裸雙引號 → 單引號 / 遠端迴圈變數 \$ 逸出);已修 xlsx

---

### 2193/2200 — `Wistron-HW-00476-V003` · Items=PCIe Slot · TestSet=PCIe
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:PCIe Slot
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. PCIe device information should show correctly in BIOS, uEFI shell and OS
2. Link status and speed should match the SPEC definition.
- Q6 補什麼:lspci (pciutils)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:PCIe Slot
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "lspci 2>&1"`
- 📤 產出人:
  log 取位:return full `lspci` output so user verifies every expected PCIe slot/device is enumerated. No RISK (read-only).
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2194/2200 — `Wistron-HW-00477-V002` · Items=Display function · TestSet=Front and Rear Panel
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:Display function
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Screen can display w/o error.
- Q6 補什麼:xrandr
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Display function
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "echo ---connectors---; for c in /sys/class/drm/card*-*/status; do echo $c=$(cat $c 2>/dev/null); done; echo ---modes`
- 📤 產出人:
  log 取位:return FULL DRM connector status + `xrandr --query` modes so the user confirms the display function/connectors are correctly enumerated; a v
  risk:RISK: read-only connector/mode enumeration; visual verification is operator part.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2195/2200 — `Wistron-HW-00478-V002` · Items=Extended GPU Memory (EGM) · TestSet=NV GPU - Software Validation - Software Features
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:Extended GPU Memory (EGM)
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Criteria:
1. System should boot into OS successfully.
2. User can select Enable/disable properly.
3.  Memory size on enable EGM is larger than disable EGM.
- Q6 補什麼:nvidia-smi (driver); BIOS setting by user
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Extended GPU Memory (EGM)
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- Extended GPU Memory (EGM) test enables/disables a BIOS feature + verify memory size in OS; agent checks OS visibility after user sets BIOS: sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChec`
- 📤 產出人:
  log 取位:return memory.total before/after EGM enable so user confirms memory size changes as expected on enable.
  risk:RISK: requires BIOS setting change + reboot; coordinate with operator.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2196/2200 — `Wistron-HW-00479-V002` · Items=CPUDVFS Test · TestSet=MODS Test
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= UNRESOLVED** | exec 模式 = `不確定(TBD 資料)`

**8 問**:
- Q1 測什麼:CPUDVFS Test
- Q2 位置:無法判定(資料 TBD)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:CPUDVFS Test
- Q6 補什麼:MODS (Memory/CPU test tool) - install first
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:CPUDVFS Test
- 📥 變數:無(Procedure/Criteria 即 TBD,無法推導)
- ▶ 指令:`--`(TBD,見 ai_commands)
- 📤 產出人:operator 於測試庫補 TBD 後重審,agent 未跑
- 🚧 判斷閘:UNRESOLVED,等 operator 補資料

**§十八 h 三項**:執行模式=`不確定(TBD 資料)` / operator slot=`無法判定` / 邏輯 sanity=`資料 TBD;8 問答不出(鎖版 §二十 aa / §二十一)`
**⚠️      缺陷**:Q-LIT(ssh 內層裸雙引號 → 單引號 / 遠端迴圈變數 \$ 逸出);已修 xlsx

---

### 2197/2200 — `Wistron-HW-00480-V002` · Items=CPU Thermal Stress Test · TestSet=MODS Test
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= UNRESOLVED** | exec 模式 = `不確定(TBD 資料)`

**8 問**:
- Q1 測什麼:CPU Thermal Stress Test
- Q2 位置:無法判定(資料 TBD)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:CPU Thermal Stress Test
- Q6 補什麼:MODS + adequate cooling (install first)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:CPU Thermal Stress Test
- 📥 變數:無(Procedure/Criteria 即 TBD,無法推導)
- ▶ 指令:`--`(TBD,見 ai_commands)
- 📤 產出人:operator 於測試庫補 TBD 後重審,agent 未跑
- 🚧 判斷閘:UNRESOLVED,等 operator 補資料

**§十八 h 三項**:執行模式=`不確定(TBD 資料)` / operator slot=`無法判定` / 邏輯 sanity=`資料 TBD;8 問答不出(鎖版 §二十 aa / §二十一)`
**⚠️      缺陷**:Q-LIT(ssh 內層裸雙引號 → 單引號 / 遠端迴圈變數 \$ 逸出);已修 xlsx

---

### 2198/2200 — `Wistron-HW-00481-V002` · Items=USB2.0 MCTP Function · TestSet=MODS Test
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= UNRESOLVED** | exec 模式 = `不確定(TBD 資料)`

**8 問**:
- Q1 測什麼:USB2.0 MCTP Function
- Q2 位置:無法判定(資料 TBD)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:USB2.0 MCTP Function
- Q6 補什麼:MODS (install first)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:USB2.0 MCTP Function
- 📥 變數:無(Procedure/Criteria 即 TBD,無法推導)
- ▶ 指令:`--`(TBD,見 ai_commands)
- 📤 產出人:operator 於測試庫補 TBD 後重審,agent 未跑
- 🚧 判斷閘:UNRESOLVED,等 operator 補資料

**§十八 h 三項**:執行模式=`不確定(TBD 資料)` / operator slot=`無法判定` / 邏輯 sanity=`資料 TBD;8 問答不出(鎖版 §二十 aa / §二十一)`
**⚠️      缺陷**:Q-LIT(ssh 內層裸雙引號 → 單引號 / 遠端迴圈變數 \$ 逸出);已修 xlsx

---

### 2199/2200 — `Wistron-HW-00482-V002` · Items=NVMe/E1.S Read/Write test · TestSet=MODS Test
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= UNRESOLVED** | exec 模式 = `不確定(TBD 資料)`

**8 問**:
- Q1 測什麼:NVMe/E1.S Read/Write test
- Q2 位置:無法判定(資料 TBD)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:NVMe/E1.S Read/Write test
- Q6 補什麼:MODS (install first)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:NVMe/E1.S Read/Write test
- 📥 變數:無(Procedure/Criteria 即 TBD,無法推導)
- ▶ 指令:`--`(TBD,見 ai_commands)
- 📤 產出人:operator 於測試庫補 TBD 後重審,agent 未跑
- 🚧 判斷閘:UNRESOLVED,等 operator 補資料

**§十八 h 三項**:執行模式=`不確定(TBD 資料)` / operator slot=`無法判定` / 邏輯 sanity=`資料 TBD;8 問答不出(鎖版 §二十 aa / §二十一)`
**⚠️      缺陷**:Q-LIT(ssh 內層裸雙引號 → 單引號 / 遠端迴圈變數 \$ 逸出);已修 xlsx

---

### 2200/2200 — `Wistron-HW-00483-V002` · Items=Telemetry INA(INA3221) / OVRM(NCP45495XMNTWG) · TestSet=MODS Test
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= UNRESOLVED** | exec 模式 = `不確定(TBD 資料)`

**8 問**:
- Q1 測什麼:Telemetry INA(INA3221) / OVRM(NCP45495XMNTWG)
- Q2 位置:無法判定(資料 TBD)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Telemetry INA(INA3221) / OVRM(NCP45495XMNTWG)
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Telemetry INA(INA3221) / OVRM(NCP45495XMNTWG)
- 📥 變數:無(Procedure/Criteria 即 TBD,無法推導)
- ▶ 指令:`--`(TBD,見 ai_commands)
- 📤 產出人:operator 於測試庫補 TBD 後重審,agent 未跑
- 🚧 判斷閘:UNRESOLVED,等 operator 補資料

**§十八 h 三項**:執行模式=`不確定(TBD 資料)` / operator slot=`無法判定` / 邏輯 sanity=`資料 TBD;8 問答不出(鎖版 §二十 aa / §二十一)`
**⚠️      缺陷**:WR(命令內容/感測器名稱與 Items 不符 → 依 Items/procedure 重寫);已修 xlsx

---
