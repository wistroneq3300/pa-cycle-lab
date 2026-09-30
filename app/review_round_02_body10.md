## 批次說明(第 1801–2000 條組成)

| 區段 | 約 row | 類型 | 主判定 |
|---|---|---|---|
| I2C 板卡 scan(FAN/PDB/HSC/RIO/FIO/Cable/M.2/E1S)+I3C CPU0/1(00005~00453) | 1803–1816 | DUT i2cdetect/i3cdetect | YES/PARTIAL |
| I2C 板卡 TBD(MB/BMC/SW/NV_SW/PSU/FAN/PDB/HSC/RIO/FIO/Cable/M.2)+E1S LED 誤置 | 1810–1831 | TBD + 誤置 | NO(UNRESOLVED) |
| TEMP_* Sensor List(BMC-00921~00944, UBB/GPU/LP/FH/DCSCM) | 1832–1855 | OOB sensor get | YES |
| SW BD Sensor List(STATUS_UP/LOW/PSU,TEMP_GPU 0~N/0~N_Memory)+TEMP_*(00937~00944) | 1843–1855 | OOB ipmitool(3 FAKE/R5)+sensor get | YES/PARTIAL |
| TEMP/PWR/SPD sensor 全量(00945~01007,FAN/PWR/TACH/PSU/UBB/GB/MB/OCP/CEM/NIC/DIMM) | 1856–1889 | OOB sensor get | YES |
| L10 System LED(E1S/BF3/OSFP/系统 Fault/NVLink/Pwr/ID/BMC RJ45) | 1904–1914 | 物理/目視 LED | NO |
| GB NV PVP SW(NVSSVT/NVRASTool/NVDebug)+Network(NT.1/NT.4 NVQual) | 1915–1919 | vendor tool | PARTIAL |
| GB NV PVP HW(Storage E1.S Hot-swap/SY.4..SY.8 reboot stress/SY.9/SY.10/SY.11) | 1920–1931 | OOB 電源/物理 | PARTIAL/NO |
| BIOS Sanity SMBIOS Type 11/12~45/38(00465~00490) | 1932–1949 | DUT dmidecode + grep(Q-LIT class) | YES |
| POST & Hotkey + BMC WebUI(SEL/POST/Profile/Logout/ChassisCollection/Chassis/PowerCycle) | 1950–1965 | PARTIAL(WebUI)/OoB | PARTIAL/NO |
| AMD SVM RAS(EINJState/BadPage*/GFX/PLDM UBB SMC) | 1955–1959 | Redfish/amdgpuras/pldmtool | PARTIAL |
| TaskService/CertificateService/Manager Reset/Redfish GPU/SEL log full(01001~01007) | 1966–1971 | Redfish GET(OOB) | YES |
| AMD SVM XGMI link/margin(00138/00139/00140/00038/00124)+PCIe margin | 1972–1976 | vendor tool | PARTIAL |
| Comport Console/Serial mech/Communication | 1977–1979 | 物理 + 通訊 | NO |
| Sensor Page 補集(FAN/PWR/PSU/TEMP HIB/VDD/PVDD 1~N) | 1980–2001 | OOB sensor get | YES |
| Mechanical Switch Board | 2002 | 物理 | NO |

## 第 1801–2000 條 review 統計

**verdict(§二十一 鎖版)分布(本批 200 條)**:
| verdict | 條數 | 說明 |
|---|---|---|
| NO/PHYSICAL | 25 | 目視(LED/comport)/物理(AC 100x、Tray hot-swap、E1.S 熱換、PCIe 量儀)+ TBD 板卡行 |
| PARTIAL | 28 | 前置(需 operator 給 NVQual/amdxio/pldmtool 等 vendor tool、WebUI 操作、100x stress 同意) |
| YES | 132 | 純讀:sensor get/dmidecode/OoB ipmitool/Redfish GET |
| UNRESOLVED | 15 | Procedure/Criteria 在 workbook 即 TBD(I2C 板卡 TBD) |

**瑕疵統計(本批實際修進 xlsx)**:
| class | 條數 | 對應編號(rows) |
|---|---|---|
| Q-LIT(ssh 內層裸雙引號 → 單引號 / 去內層 echo) | 11 | 1803–1809/1812/1814/1918/1919 |
| R5(OOB ipmitool/Redfish 誤包 DUT-ssh → 移 agent-host) | 7 | 1844/1845/1955/1966/1967/1969/1970 |
| WR(命令內容/感測器名稱與 Items 不符 → 依 Items/procedure 重寫) | 4 | 1843/1891/1958/1977 |
| FAKE(「not directly runnable / give exact bytes」實為可跑 Redfish) | 1 | 1962 |
| VERDICT(col13 判定改) + PKG(col14 套件行) | 2 | 1843 NO→YES + SF600→ipmitool |

> 多類在某 row 重疊,獨特 row = **23**;ai_commands col15 diff = 23 cells;ai_can_execute col13 = 1(1843);ai_packages_needed col14 = 1(1843)。**ai_commands 全 Functionality**.

**🔄 累計(第 1–2000 條)**:
| verdict | 條數 |
|---|---|
| NO/PHYSICAL | 351 |
| PARTIAL | 651 |
| YES | 835 |
| UNRESOLVED | 163 |
| 合計 | 2000 |

**✅ 本批缺陷已實際修進 xlsx**:11 Q-LIT + 7 R5 + 4 WR + 1 FAKE + 1 判定改(1843 NO→YES) + 1 pkg(1843 SF600→ipmitool)= **25 cells**。
零回歸:對 bak_rev02_batch10 逐 cell 比對,Functionality diff = 恰 25 cells(23 col15 + 1 col13 + 1 col14);5 其它 sheet 0 diff;cyrillic=0 / U+FFFD=0;git HEAD `5a60875` 未動;`data/tests.json` 未同步(等 operator)。

---

## 逐條 review(第 1801–2000 條)

### 1801/2000 — `Wistron-HW-00005-V003` · Items=I2C FAN_BD · TestSet=HW Robust
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:I2C FAN_BD
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:follow up spec criteria
- Q6 補什麼:i2c-tools
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:I2C FAN_BD
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "echo ---i2c_buses---; sudo i2cdetect -l 2>&1; echo ---scan_fan_bd---; for b in $(sudo i2cdetect -l 2>/dev/null | gre`
- 📤 產出人:
  log 取位:return FULL `i2cdetect -l` bus list + per-bus `i2cdetect -y <bus>` scan so the user confirms the FAN board I2C segment is enumerated and add
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️      缺陷**:Q-LIT(ssh 內層裸雙引號 → 單引號);已修 xlsx

---

### 1802/2000 — `Wistron-HW-00006-V003` · Items=I2C PDB_BD · TestSet=HW Robust
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:I2C PDB_BD
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:follow up spec criteria
- Q6 補什麼:i2c-tools
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:I2C PDB_BD
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "echo ---i2c_buses---; sudo i2cdetect -l 2>&1; echo ---scan_pdb_bd---; for b in $(sudo i2cdetect -l 2>/dev/null | gre`
- 📤 產出人:
  log 取位:return FULL `i2cdetect -l` bus list + per-bus `i2cdetect -y <bus>` scan so the user confirms the PDB board I2C segment is enumerated and add
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️      缺陷**:Q-LIT(ssh 內層裸雙引號 → 單引號);已修 xlsx

---

### 1803/2000 — `Wistron-HW-00007-V003` · Items=I2C HSC_BD · TestSet=HW Robust
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:I2C HSC_BD
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:follow up spec criteria
- Q6 補什麼:i2c-tools
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:I2C HSC_BD
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "echo ---i2c_buses---; sudo i2cdetect -l 2>&1; echo ---scan_hsc_bd---; for b in $(sudo i2cdetect -l 2>/dev/null | gre`
- 📤 產出人:
  log 取位:return FULL `i2cdetect -l` bus list + per-bus `i2cdetect -y <bus>` scan so the user confirms the HSC board I2C segment is enumerated and add
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️      缺陷**:Q-LIT(ssh 內層裸雙引號 → 單引號);已修 xlsx

---

### 1804/2000 — `Wistron-HW-00008-V003` · Items=I2C RIO_BD · TestSet=HW Robust
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:I2C RIO_BD
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:follow up spec criteria
- Q6 補什麼:i2c-tools
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:I2C RIO_BD
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "echo ---i2c_buses---; sudo i2cdetect -l 2>&1; echo ---scan_rio_bd---; for b in $(sudo i2cdetect -l 2>/dev/null | gre`
- 📤 產出人:
  log 取位:return FULL `i2cdetect -l` bus list + per-bus `i2cdetect -y <bus>` scan so the user confirms the RIO board I2C segment is enumerated and add
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️      缺陷**:Q-LIT(ssh 內層裸雙引號 → 單引號);已修 xlsx

---

### 1805/2000 — `Wistron-HW-00009-V003` · Items=I2C FIO_BD · TestSet=HW Robust
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:I2C FIO_BD
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:follow up spec criteria
- Q6 補什麼:i2c-tools
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:I2C FIO_BD
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "echo ---i2c_buses---; sudo i2cdetect -l 2>&1; echo ---scan_fio_bd---; for b in $(sudo i2cdetect -l 2>/dev/null | gre`
- 📤 產出人:
  log 取位:return FULL `i2cdetect -l` bus list + per-bus `i2cdetect -y <bus>` scan so the user confirms the FIO board I2C segment is enumerated and add
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️      缺陷**:Q-LIT(ssh 內層裸雙引號 → 單引號);已修 xlsx

---

### 1806/2000 — `Wistron-HW-00010-V003` · Items=I2C Cable · TestSet=HW Robust
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:I2C Cable
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:follow up spec criteria
- Q6 補什麼:i2c-tools
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:I2C Cable
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "echo ---i2c_buses---; sudo i2cdetect -l 2>&1; echo ---scan_cable---; for b in $(sudo i2cdetect -l 2>/dev/null | grep`
- 📤 產出人:
  log 取位:return FULL `i2cdetect -l` bus list + per-bus `i2cdetect -y <bus>` scan so the user confirms the cabling I2C segment is enumerated and addre
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️      缺陷**:Q-LIT(ssh 內層裸雙引號 → 單引號);已修 xlsx

---

### 1807/2000 — `Wistron-HW-00011-V003` · Items=I2C M2_BD · TestSet=HW Robust
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:I2C M2_BD
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:follow up spec criteria
- Q6 補什麼:i2c-tools
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:I2C M2_BD
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "echo ---i2c_buses---; sudo i2cdetect -l 2>&1; echo ---scan_m2_bd---; for b in $(sudo i2cdetect -l 2>/dev/null | grep`
- 📤 產出人:
  log 取位:return FULL `i2cdetect -l` bus list + per-bus `i2cdetect -y <bus>` scan so the user confirms the M.2 board I2C segment is enumerated and add
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️      缺陷**:Q-LIT(ssh 內層裸雙引號 → 單引號);已修 xlsx

---

### 1808/2000 — `Wistron-HW-00432-V002` · Items=E1S_BD1 · TestSet=I2C
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:E1S_BD1
- Q2 位置:不執行(見說明)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:follow up spec criteria
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:E1S_BD1
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 1809/2000 — `Wistron-HW-00433-V002` · Items=E1S_BD2 · TestSet=I2C
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:E1S_BD2
- Q2 位置:不執行(見說明)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:follow up spec criteria
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:E1S_BD2
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 1810/2000 — `Wistron-HW-00012-V003` · Items=I2C E1S_BD2 · TestSet=HW Robust
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:I2C E1S_BD2
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:follow up spec criteria
- Q6 補什麼:i2c-tools
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:I2C E1S_BD2
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "echo ---i2c_buses---; sudo i2cdetect -l 2>&1; echo ---scan_e1s_bd2---; for b in $(sudo i2cdetect -l 2>/dev/null | gr`
- 📤 產出人:
  log 取位:return FULL `i2cdetect -l` bus list + per-bus `i2cdetect -y <bus>` scan so the user confirms the E1.S carrier 2 I2C segment is enumerated an
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️      缺陷**:Q-LIT(ssh 內層裸雙引號 → 單引號);已修 xlsx

---

### 1811/2000 — `Wistron-HW-00434-V002` · Items=E1S_BD3 · TestSet=I2C
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:E1S_BD3
- Q2 位置:不執行(見說明)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:follow up spec criteria
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:E1S_BD3
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 1812/2000 — `Wistron-HW-00013-V003` · Items=I2C E1S_BD1 · TestSet=HW Robust
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:I2C E1S_BD1
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:follow up spec criteria
- Q6 補什麼:i2c-tools
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:I2C E1S_BD1
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "echo ---i2c_buses---; sudo i2cdetect -l 2>&1; echo ---scan_e1s_bd1---; for b in $(sudo i2cdetect -l 2>/dev/null | gr`
- 📤 產出人:
  log 取位:return FULL `i2cdetect -l` bus list + per-bus `i2cdetect -y <bus>` scan so the user confirms the E1.S carrier 1 I2C segment is enumerated an
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️      缺陷**:Q-LIT(ssh 內層裸雙引號 → 單引號);已修 xlsx

---

### 1813/2000 — `Wistron-HW-00014-V003` · Items=I3C CPU0 · TestSet=HW Robust
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:I3C CPU0
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:follow up spec criteria
- Q6 補什麼:i2c-tools (i3c support if vendor provides)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:I3C CPU0
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "echo ---i3c_cpu0---; ls /sys/bus/i3c 2>&1; sudo i3cdetect -l 2>&1; ls /sys/bus/i3c/devices 2>&1; dmesg | grep -iE 'i`
- 📤 產出人:
  log 取位:return FULL kernel/sysfs I3C presence + dmesg i3c/i2c lines so the user confirms the CPU0 I3C controller/bus is enumerated per spec; actual 
  risk:RISK: I3C probing needs vendor tooling that may not be installed; agent reports sysfs/dmesg enumeration and leaves the deep I3C probe to the
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1814/2000 — `Wistron-HW-00015-V002` · Items=I3C CPU1 · TestSet=HW Robust
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:I3C CPU1
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:follow up spec criteria
- Q6 補什麼:i2c-tools (i3c support if vendor provides)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:I3C CPU1
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "echo ---i3c_cpu1---; ls /sys/bus/i3c 2>&1; sudo i3cdetect -l 2>&1; ls /sys/bus/i3c/devices 2>&1; dmesg | grep -iE 'i`
- 📤 產出人:
  log 取位:return FULL kernel/sysfs I3C presence + dmesg i3c/i2c lines so the user confirms the CPU1 I3C controller/bus is enumerated per spec; actual 
  risk:RISK: I3C probing needs vendor tooling that may not be installed; agent reports sysfs/dmesg enumeration and leaves the deep I3C probe to the
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1815/2000 — `Wistron-HW-00439-V002` · Items=MB · TestSet=I2C
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= UNRESOLVED** | exec 模式 = `不確定(TBD 資料)`

**8 問**:
- Q1 測什麼:MB
- Q2 位置:無法判定(資料 TBD)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:MB
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:MB
- 📥 變數:無(Procedure/Criteria 即 TBD,無法推導)
- ▶ 指令:`--`(TBD,見 ai_commands)
- 📤 產出人:operator 於測試庫補 TBD 後重審,agent 未跑
- 🚧 判斷閘:UNRESOLVED,等 operator 補資料

**§十八 h 三項**:執行模式=`不確定(TBD 資料)` / operator slot=`無法判定` / 邏輯 sanity=`資料 TBD;8 問答不出(鎖版 §二十 aa / §二十一)`

---

### 1816/2000 — `Wistron-HW-00440-V002` · Items=BMC_BD · TestSet=I2C
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= UNRESOLVED** | exec 模式 = `不確定(TBD 資料)`

**8 問**:
- Q1 測什麼:BMC_BD
- Q2 位置:無法判定(資料 TBD)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:BMC_BD
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:BMC_BD
- 📥 變數:無(Procedure/Criteria 即 TBD,無法推導)
- ▶ 指令:`--`(TBD,見 ai_commands)
- 📤 產出人:operator 於測試庫補 TBD 後重審,agent 未跑
- 🚧 判斷閘:UNRESOLVED,等 operator 補資料

**§十八 h 三項**:執行模式=`不確定(TBD 資料)` / operator slot=`無法判定` / 邏輯 sanity=`資料 TBD;8 問答不出(鎖版 §二十 aa / §二十一)`

---

### 1817/2000 — `Wistron-HW-00441-V002` · Items=SW_BD · TestSet=I2C
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= UNRESOLVED** | exec 模式 = `不確定(TBD 資料)`

**8 問**:
- Q1 測什麼:SW_BD
- Q2 位置:無法判定(資料 TBD)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:SW_BD
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:SW_BD
- 📥 變數:無(Procedure/Criteria 即 TBD,無法推導)
- ▶ 指令:`--`(TBD,見 ai_commands)
- 📤 產出人:operator 於測試庫補 TBD 後重審,agent 未跑
- 🚧 判斷閘:UNRESOLVED,等 operator 補資料

**§十八 h 三項**:執行模式=`不確定(TBD 資料)` / operator slot=`無法判定` / 邏輯 sanity=`資料 TBD;8 問答不出(鎖版 §二十 aa / §二十一)`

---

### 1818/2000 — `Wistron-HW-00442-V002` · Items=NV_SWITCH_CARRIER_BD · TestSet=I2C
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= UNRESOLVED** | exec 模式 = `不確定(TBD 資料)`

**8 問**:
- Q1 測什麼:NV_SWITCH_CARRIER_BD
- Q2 位置:無法判定(資料 TBD)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:NV_SWITCH_CARRIER_BD
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:NV_SWITCH_CARRIER_BD
- 📥 變數:無(Procedure/Criteria 即 TBD,無法推導)
- ▶ 指令:`--`(TBD,見 ai_commands)
- 📤 產出人:operator 於測試庫補 TBD 後重審,agent 未跑
- 🚧 判斷閘:UNRESOLVED,等 operator 補資料

**§十八 h 三項**:執行模式=`不確定(TBD 資料)` / operator slot=`無法判定` / 邏輯 sanity=`資料 TBD;8 問答不出(鎖版 §二十 aa / §二十一)`

---

### 1819/2000 — `Wistron-HW-00443-V002` · Items=PSU_BD · TestSet=I2C
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= UNRESOLVED** | exec 模式 = `不確定(TBD 資料)`

**8 問**:
- Q1 測什麼:PSU_BD
- Q2 位置:無法判定(資料 TBD)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:PSU_BD
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:PSU_BD
- 📥 變數:無(Procedure/Criteria 即 TBD,無法推導)
- ▶ 指令:`--`(TBD,見 ai_commands)
- 📤 產出人:operator 於測試庫補 TBD 後重審,agent 未跑
- 🚧 判斷閘:UNRESOLVED,等 operator 補資料

**§十八 h 三項**:執行模式=`不確定(TBD 資料)` / operator slot=`無法判定` / 邏輯 sanity=`資料 TBD;8 問答不出(鎖版 §二十 aa / §二十一)`

---

### 1820/2000 — `Wistron-HW-00444-V002` · Items=FAN_BD · TestSet=I2C
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= UNRESOLVED** | exec 模式 = `不確定(TBD 資料)`

**8 問**:
- Q1 測什麼:FAN_BD
- Q2 位置:無法判定(資料 TBD)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:FAN_BD
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:FAN_BD
- 📥 變數:無(Procedure/Criteria 即 TBD,無法推導)
- ▶ 指令:`--`(TBD,見 ai_commands)
- 📤 產出人:operator 於測試庫補 TBD 後重審,agent 未跑
- 🚧 判斷閘:UNRESOLVED,等 operator 補資料

**§十八 h 三項**:執行模式=`不確定(TBD 資料)` / operator slot=`無法判定` / 邏輯 sanity=`資料 TBD;8 問答不出(鎖版 §二十 aa / §二十一)`

---

### 1821/2000 — `Wistron-HW-00445-V002` · Items=PDB_BD · TestSet=I2C
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= UNRESOLVED** | exec 模式 = `不確定(TBD 資料)`

**8 問**:
- Q1 測什麼:PDB_BD
- Q2 位置:無法判定(資料 TBD)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:PDB_BD
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:PDB_BD
- 📥 變數:無(Procedure/Criteria 即 TBD,無法推導)
- ▶ 指令:`--`(TBD,見 ai_commands)
- 📤 產出人:operator 於測試庫補 TBD 後重審,agent 未跑
- 🚧 判斷閘:UNRESOLVED,等 operator 補資料

**§十八 h 三項**:執行模式=`不確定(TBD 資料)` / operator slot=`無法判定` / 邏輯 sanity=`資料 TBD;8 問答不出(鎖版 §二十 aa / §二十一)`

---

### 1822/2000 — `Wistron-HW-00446-V002` · Items=HSC_BD · TestSet=I2C
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= UNRESOLVED** | exec 模式 = `不確定(TBD 資料)`

**8 問**:
- Q1 測什麼:HSC_BD
- Q2 位置:無法判定(資料 TBD)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:HSC_BD
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:HSC_BD
- 📥 變數:無(Procedure/Criteria 即 TBD,無法推導)
- ▶ 指令:`--`(TBD,見 ai_commands)
- 📤 產出人:operator 於測試庫補 TBD 後重審,agent 未跑
- 🚧 判斷閘:UNRESOLVED,等 operator 補資料

**§十八 h 三項**:執行模式=`不確定(TBD 資料)` / operator slot=`無法判定` / 邏輯 sanity=`資料 TBD;8 問答不出(鎖版 §二十 aa / §二十一)`

---

### 1823/2000 — `Wistron-HW-00447-V002` · Items=HSC_BD · TestSet=I2C
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= UNRESOLVED** | exec 模式 = `不確定(TBD 資料)`

**8 問**:
- Q1 測什麼:HSC_BD
- Q2 位置:無法判定(資料 TBD)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:HSC_BD
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:HSC_BD
- 📥 變數:無(Procedure/Criteria 即 TBD,無法推導)
- ▶ 指令:`--`(TBD,見 ai_commands)
- 📤 產出人:operator 於測試庫補 TBD 後重審,agent 未跑
- 🚧 判斷閘:UNRESOLVED,等 operator 補資料

**§十八 h 三項**:執行模式=`不確定(TBD 資料)` / operator slot=`無法判定` / 邏輯 sanity=`資料 TBD;8 問答不出(鎖版 §二十 aa / §二十一)`

---

### 1824/2000 — `Wistron-HW-00448-V002` · Items=RIO_BD · TestSet=I2C
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= UNRESOLVED** | exec 模式 = `不確定(TBD 資料)`

**8 問**:
- Q1 測什麼:RIO_BD
- Q2 位置:無法判定(資料 TBD)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:RIO_BD
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:RIO_BD
- 📥 變數:無(Procedure/Criteria 即 TBD,無法推導)
- ▶ 指令:`--`(TBD,見 ai_commands)
- 📤 產出人:operator 於測試庫補 TBD 後重審,agent 未跑
- 🚧 判斷閘:UNRESOLVED,等 operator 補資料

**§十八 h 三項**:執行模式=`不確定(TBD 資料)` / operator slot=`無法判定` / 邏輯 sanity=`資料 TBD;8 問答不出(鎖版 §二十 aa / §二十一)`

---

### 1825/2000 — `Wistron-HW-00449-V002` · Items=FIO_BD · TestSet=I2C
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= UNRESOLVED** | exec 模式 = `不確定(TBD 資料)`

**8 問**:
- Q1 測什麼:FIO_BD
- Q2 位置:無法判定(資料 TBD)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:FIO_BD
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:FIO_BD
- 📥 變數:無(Procedure/Criteria 即 TBD,無法推導)
- ▶ 指令:`--`(TBD,見 ai_commands)
- 📤 產出人:operator 於測試庫補 TBD 後重審,agent 未跑
- 🚧 判斷閘:UNRESOLVED,等 operator 補資料

**§十八 h 三項**:執行模式=`不確定(TBD 資料)` / operator slot=`無法判定` / 邏輯 sanity=`資料 TBD;8 問答不出(鎖版 §二十 aa / §二十一)`

---

### 1826/2000 — `Wistron-HW-00450-V002` · Items=Cable · TestSet=I2C
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

### 1827/2000 — `Wistron-HW-00452-V002` · Items=M2_BD · TestSet=I2C
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= UNRESOLVED** | exec 模式 = `不確定(TBD 資料)`

**8 問**:
- Q1 測什麼:M2_BD
- Q2 位置:無法判定(資料 TBD)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:M2_BD
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:M2_BD
- 📥 變數:無(Procedure/Criteria 即 TBD,無法推導)
- ▶ 指令:`--`(TBD,見 ai_commands)
- 📤 產出人:operator 於測試庫補 TBD 後重審,agent 未跑
- 🚧 判斷閘:UNRESOLVED,等 operator 補資料

**§十八 h 三項**:執行模式=`不確定(TBD 資料)` / operator slot=`無法判定` / 邏輯 sanity=`資料 TBD;8 問答不出(鎖版 §二十 aa / §二十一)`

---

### 1828/2000 — `Wistron-HW-00453-V002` · Items=CPU0 · TestSet=I3C
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= UNRESOLVED** | exec 模式 = `不確定(TBD 資料)`

**8 問**:
- Q1 測什麼:CPU0
- Q2 位置:無法判定(資料 TBD)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:CPU0
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:CPU0
- 📥 變數:無(Procedure/Criteria 即 TBD,無法推導)
- ▶ 指令:`--`(TBD,見 ai_commands)
- 📤 產出人:operator 於測試庫補 TBD 後重審,agent 未跑
- 🚧 判斷閘:UNRESOLVED,等 operator 補資料

**§十八 h 三項**:執行模式=`不確定(TBD 資料)` / operator slot=`無法判定` / 邏輯 sanity=`資料 TBD;8 問答不出(鎖版 §二十 aa / §二十一)`

---

### 1829/2000 — `Wistron-HW-00454-V002` · Items=CPU1 · TestSet=I3C
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= UNRESOLVED** | exec 模式 = `不確定(TBD 資料)`

**8 問**:
- Q1 測什麼:CPU1
- Q2 位置:無法判定(資料 TBD)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:CPU1
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:CPU1
- 📥 變數:無(Procedure/Criteria 即 TBD,無法推導)
- ▶ 指令:`--`(TBD,見 ai_commands)
- 📤 產出人:operator 於測試庫補 TBD 後重審,agent 未跑
- 🚧 判斷閘:UNRESOLVED,等 operator 補資料

**§十八 h 三項**:執行模式=`不確定(TBD 資料)` / operator slot=`無法判定` / 邏輯 sanity=`資料 TBD;8 問答不出(鎖版 §二十 aa / §二十一)`

---

### 1830/2000 — `Wistron-BMC-00921-V004` · Items=TEMP_GPU_Memory_0~N · TestSet=IPMI Sensor List Commands
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:TEMP_GPU_Memory_0~N
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
- 🎯 目的:TEMP_GPU_Memory_0~N
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'TEMP_GPU_Memory_0~N' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `TEMP_GPU_Memory_0~N`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1831/2000 — `Wistron-BMC-00922-V004` · Items=TEMP_DCSCM · TestSet=IPMI Sensor List Commands
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:TEMP_DCSCM
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
- 🎯 目的:TEMP_DCSCM
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'TEMP_DCSCM' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `TEMP_DCSCM`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1832/2000 — `Wistron-BMC-00923-V002` · Items=PCIe SW BD · TestSet=FRU
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:PCIe SW BD
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Criteria:
1. FRU data should be readable and correct.
2. FRU data should match BMC web UI.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:PCIe SW BD
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" fru print 2>&1 | grep -iA6 "PCIe Switch"`
- 📤 產出人:
  log 取位:return FULL `ipmitool fru print` output filtered to the "PCIe Switch" FRU section so user confirms the PCIe SW BD FRU data is readable and c
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1833/2000 — `Wistron-BMC-00924-V002` · Items=PDB · TestSet=FRU
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:PDB
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Criteria:
1. FRU data should be readable and correct.
2. FRU data should match BMC web UI.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:PDB
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" fru print 2>&1 | grep -iA6 "Power Distribution"`
- 📤 產出人:
  log 取位:return FULL `ipmitool fru print` output filtered to the "Power Distribution" FRU section so user confirms the PDB FRU data is readable and c
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1834/2000 — `Wistron-BMC-00925-V002` · Items=HSC · TestSet=FRU
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:HSC
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Criteria:
1. FRU data should be readable and correct.
2. FRU data should match BMC web UI.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:HSC
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" fru print 2>&1 | grep -iA6 "Hot Swap Controller"`
- 📤 產出人:
  log 取位:return FULL `ipmitool fru print` output filtered to the "Hot Swap Controller" FRU section so user confirms the HSC FRU data is readable and 
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1835/2000 — `Wistron-BMC-00926-V002` · Items=E1.S BP · TestSet=FRU
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:E1.S BP
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Criteria:
1. FRU data should be readable and correct.
2. FRU data should match BMC web UI.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:E1.S BP
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" fru print 2>&1 | grep -iA6 "E1.S Backplane"`
- 📤 產出人:
  log 取位:return FULL `ipmitool fru print` output filtered to the "E1.S Backplane" FRU section so user confirms the E1.S BP FRU data is readable and c
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1836/2000 — `Wistron-BMC-00927-V002` · Items=M.2 BD · TestSet=FRU
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:M.2 BD
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Criteria:
1. FRU data should be readable and correct.
2. FRU data should match BMC web UI.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:M.2 BD
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" fru print 2>&1 | grep -iA6 "M.2"`
- 📤 產出人:
  log 取位:return FULL `ipmitool fru print` output filtered to the "M.2" FRU section so user confirms the M.2 BD FRU data is readable and correct. No R
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1837/2000 — `Wistron-BMC-00928-V002` · Items=BMC CARD · TestSet=FRU
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:BMC CARD
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Criteria:
1. FRU data should be readable and correct.
2. FRU data should match BMC web UI.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:BMC CARD
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" fru print 2>&1 | grep -iA8 "BMC.CARD|BMC Card|CARD"`
- 📤 產出人:
  log 取位:return FULL `ipmitool fru print` output filtered to the "BMC CARD" FRU section so user confirms the BMC CARD FRU data is readable and correc
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1838/2000 — `Wistron-BMC-00929-V002` · Items=RIO BD · TestSet=FRU
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:RIO BD
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Criteria:
1. FRU data should be readable and correct.
2. FRU data should match BMC web UI.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:RIO BD
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" fru print 2>&1 | grep -iA6 "RIO"`
- 📤 產出人:
  log 取位:return FULL `ipmitool fru print` output filtered to the "RIO" FRU section so user confirms the RIO BD FRU data is readable and correct. No R
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1839/2000 — `Wistron-BMC-00930-V002` · Items=FIO BD · TestSet=FRU
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:FIO BD
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Criteria:
1. FRU data should be readable and correct.
2. FRU data should match BMC web UI.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:FIO BD
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" fru print 2>&1 | grep -iA6 "FIO"`
- 📤 產出人:
  log 取位:return FULL `ipmitool fru print` output filtered to the "FIO" FRU section so user confirms the FIO BD FRU data is readable and correct. No R
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1840/2000 — `Wistron-HW-00453-V002` · Items=FAN BD · TestSet=FRU
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:FAN BD
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Criteria:
1. FRU data should be readable and correct.
2. FRU data should match BMC web UI.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:FAN BD
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" fru print 2>&1 | grep -iA6 "Fan Board"`
- 📤 產出人:
  log 取位:return FULL `ipmitool fru print` output filtered to the "Fan Board" FRU section so user confirms the FAN BD FRU data is readable and correct
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1841/2000 — `Wistron-BMC-00001-V002` · Items=STATUS_UP_FAN 1~N · TestSet=With SW BD Sensor List 
(ipmitool command)
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:STATUS_UP_FAN 1~N
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
- 🎯 目的:STATUS_UP_FAN 1~N
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- STATUS_UP_FAN 1~N: list the upper-fan status sensor rows via ipmitool (OOB, from the agent host) and confirm names/descriptions/readings match SPEC.`
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sdr list 2>&1 | grep -Ei 'FAN|UP_FAN|RPM' | head -n 60`
- 📤 產出人:
  log 取位:operator runs the SF600 flash and records the result; agent cannot attach a physical probe via SSH.
  risk:RISK: SF600 is physical hardware flashing; human + tool only.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️      缺陷**:WR(命令內容/感測器名稱與 Items 不符 → 依 Items/procedure 重寫);已修 xlsx ; 判定已改 NO→YES(col13);pkg col14 改為 ipmitool;同批 siblings 1844/1845 同類同判定

---

### 1842/2000 — `Wistron-BMC-00002-V002` · Items=STATUS_LOW_FAN 1~N · TestSet=With SW BD Sensor List 
(ipmitool command)
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:STATUS_LOW_FAN 1~N
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
- 🎯 目的:STATUS_LOW_FAN 1~N
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- STATUS_LOW_FAN 1~N: list the low-fan status sensor rows via ipmitool (OOB, from the agent host) and confirm names/descriptions/readings match SPEC.`
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sdr list 2>&1 | grep -Ei 'FAN|LOW_FAN|RPM' | head -n 60`
- 📤 產出人:
  log 取位:return the fan SDR rows (name/description/reading) so the operator confirms they match the SPEC SDR + sensor lists.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️      缺陷**:R5(OOB ipmitool/Redfish 誤包 DUT-ssh → 移 agent-host);已修 xlsx

---

### 1843/2000 — `Wistron-BMC-00003-V002` · Items=STATUS_PSU 1~N · TestSet=With SW BD Sensor List 
(ipmitool command)
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:STATUS_PSU 1~N
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
- 🎯 目的:STATUS_PSU 1~N
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- STATUS_PSU 1~N: list the PSU sensor rows via ipmitool (OOB, from the agent host) and confirm names/descriptions/readings match SPEC.`
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sdr type 'Power Supply' 2>&1; echo ---PSU-SDR---; ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sd`
- 📤 產出人:
  log 取位:return the PSU SDR rows so the operator confirms names/descriptions/readings match the SPEC SDR + sensor lists.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️      缺陷**:R5(OOB ipmitool/Redfish 誤包 DUT-ssh → 移 agent-host);已修 xlsx

---

### 1844/2000 — `Wistron-BMC-00004-V002` · Items=TEMP_GPU 0~N · TestSet=With SW BD Sensor List
(BMC GUI)
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:TEMP_GPU 0~N
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. Sensor's name, description, and reading of SDR-List should match SPEC definition.
2. Sensor's name, description, and reading of Sensor-List should match SPEC definition.
3. BMC web information match SPEC definition.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:TEMP_GPU 0~N
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- not directly runnable with a single stock high-level command: TEMP_GPU 0~N requires raw/implementation-specific IPMI bytes + exact expected output which the library has not specified; giv`
- 📤 產出人:
  log 取位:none (awaiting exact command bytes/expected result).
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1845/2000 — `Wistron-BMC-00005-V002` · Items=TEMP_GPU 0~N_Memory · TestSet=With SW BD Sensor List
(BMC GUI)
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:TEMP_GPU 0~N_Memory
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. Sensor's name, description, and reading of SDR-List should match SPEC definition.
2. Sensor's name, description, and reading of Sensor-List should match SPEC definition.
3. BMC web information match SPEC definition.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:TEMP_GPU 0~N_Memory
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- not directly runnable with a single stock high-level command: TEMP_GPU 0~N_Memory requires raw/implementation-specific IPMI bytes + exact expected output which the library has not specifi`
- 📤 產出人:
  log 取位:none (awaiting exact command bytes/expected result).
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1846/2000 — `Wistron-BMC-00936-V002` · Items=TEMP_UBB_GPU0~7 · TestSet=Sensor Page
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:TEMP_UBB_GPU0~7
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Sensor Reading & Threshold is human reable and match with spec.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:TEMP_UBB_GPU0~7
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'TEMP_UBB_GPU0~7' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `TEMP_UBB_GPU0~7`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1847/2000 — `Wistron-BMC-00937-V002` · Items=TEMP_UBB_GPU0M~7M · TestSet=Sensor Page
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:TEMP_UBB_GPU0M~7M
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Sensor Reading & Threshold is human reable and match with spec.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:TEMP_UBB_GPU0M~7M
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'TEMP_UBB_GPU0M~7M' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `TEMP_UBB_GPU0M~7M`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1848/2000 — `Wistron-BMC-00938-V002` · Items=TEMP_UBB_HSC0~7 · TestSet=Sensor Page
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:TEMP_UBB_HSC0~7
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Sensor Reading & Threshold is human reable and match with spec.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:TEMP_UBB_HSC0~7
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'TEMP_UBB_HSC0~7' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `TEMP_UBB_HSC0~7`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1849/2000 — `Wistron-BMC-00939-V002` · Items=TEMP_UBB_RTM0~7 · TestSet=Sensor Page
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:TEMP_UBB_RTM0~7
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Sensor Reading & Threshold is human reable and match with spec.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:TEMP_UBB_RTM0~7
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'TEMP_UBB_RTM0~7' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `TEMP_UBB_RTM0~7`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1850/2000 — `Wistron-BMC-00940-V002` · Items=TEMP_UBB_IBC · TestSet=Sensor Page
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:TEMP_UBB_IBC
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Sensor Reading & Threshold is human reable and match with spec.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:TEMP_UBB_IBC
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'TEMP_UBB_IBC' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `TEMP_UBB_IBC`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1851/2000 — `Wistron-BMC-00941-V002` · Items=TEMP_UBB_BACK · TestSet=Sensor Page
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:TEMP_UBB_BACK
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Sensor Reading & Threshold is human reable and match with spec.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:TEMP_UBB_BACK
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'TEMP_UBB_BACK' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `TEMP_UBB_BACK`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1852/2000 — `Wistron-BMC-00942-V002` · Items=TEMP_UBB_FRONT · TestSet=Sensor Page
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:TEMP_UBB_FRONT
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Sensor Reading & Threshold is human reable and match with spec.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:TEMP_UBB_FRONT
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'TEMP_UBB_FRONT' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `TEMP_UBB_FRONT`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1853/2000 — `Wistron-BMC-00943-V002` · Items=TEMP_UBB_FPGA · TestSet=Sensor Page
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:TEMP_UBB_FPGA
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Sensor Reading & Threshold is human reable and match with spec.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:TEMP_UBB_FPGA
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'TEMP_UBB_FPGA' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `TEMP_UBB_FPGA`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1854/2000 — `Wistron-BMC-00944-V002` · Items=TEMP_PDB_PSU1~6 · TestSet=Sensor Page
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:TEMP_PDB_PSU1~6
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Sensor Reading & Threshold is human reable and match with spec.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:TEMP_PDB_PSU1~6
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'TEMP_PDB_PSU1~6' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `TEMP_PDB_PSU1~6`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1855/2000 — `Wistron-BMC-00945-V002` · Items=TEMP_LP1~8_Chip · TestSet=Sensor Page
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:TEMP_LP1~8_Chip
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Sensor Reading & Threshold is human reable and match with spec.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:TEMP_LP1~8_Chip
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'TEMP_LP1~8_Chip' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `TEMP_LP1~8_Chip`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1856/2000 — `Wistron-BMC-00946-V002` · Items=TEMP_LP1~8_TRX · TestSet=Sensor Page
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:TEMP_LP1~8_TRX
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Sensor Reading & Threshold is human reable and match with spec.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:TEMP_LP1~8_TRX
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'TEMP_LP1~8_TRX' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `TEMP_LP1~8_TRX`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1857/2000 — `Wistron-BMC-00947-V002` · Items=TEMP_FH11~15_Chip · TestSet=Sensor Page
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:TEMP_FH11~15_Chip
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Sensor Reading & Threshold is human reable and match with spec.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:TEMP_FH11~15_Chip
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'TEMP_FH11~15_Chip' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `TEMP_FH11~15_Chip`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1858/2000 — `Wistron-BMC-00948-V002` · Items=PWR_UBB_GPU0~7 · TestSet=Sensor Page
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:PWR_UBB_GPU0~7
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Sensor Reading & Threshold is human reable and match with spec.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:PWR_UBB_GPU0~7
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'PWR_UBB_GPU0~7' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `PWR_UBB_GPU0~7`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1859/2000 — `Wistron-BMC-00949-V002` · Items=PWR_MB_PSU1~2 · TestSet=Sensor Page
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:PWR_MB_PSU1~2
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Sensor Reading & Threshold is human reable and match with spec.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:PWR_MB_PSU1~2
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'PWR_MB_PSU1~2' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `PWR_MB_PSU1~2`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1860/2000 — `Wistron-BMC-00950-V002` · Items=PWR_PDB_PSU1~6 · TestSet=Sensor Page
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:PWR_PDB_PSU1~6
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Sensor Reading & Threshold is human readable and match with spec.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:PWR_PDB_PSU1~6
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'PWR_PDB_PSU1~6' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `PWR_PDB_PSU1~6`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1861/2000 — `Wistron-BMC-00951-V002` · Items=TEMP_MB_CPU0~1_IN · TestSet=IPMI Sensor List Commands
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:TEMP_MB_CPU0~1_IN
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
- 🎯 目的:TEMP_MB_CPU0~1_IN
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'TEMP_MB_CPU0~1_IN' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `TEMP_MB_CPU0~1_IN`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1862/2000 — `Wistron-BMC-00952-V002` · Items=TEMP_MB_OUTLET · TestSet=IPMI Sensor List Commands
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:TEMP_MB_OUTLET
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
- 🎯 目的:TEMP_MB_OUTLET
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'TEMP_MB_OUTLET' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `TEMP_MB_OUTLET`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1863/2000 — `Wistron-BMC-00953-V002` · Items=TEMP_OCP1~2 · TestSet=IPMI Sensor List Commands
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:TEMP_OCP1~2
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
- 🎯 目的:TEMP_OCP1~2
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'TEMP_OCP1~2' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `TEMP_OCP1~2`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1864/2000 — `Wistron-BMC-00954-V002` · Items=TEMP_MIDPLANE · TestSet=IPMI Sensor List Commands
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:TEMP_MIDPLANE
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
- 🎯 目的:TEMP_MIDPLANE
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'TEMP_MIDPLANE' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `TEMP_MIDPLANE`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1865/2000 — `Wistron-BMC-00955-V002` · Items=TEMP_CEMSlot1~2 · TestSet=IPMI Sensor List Commands
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:TEMP_CEMSlot1~2
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
- 🎯 目的:TEMP_CEMSlot1~2
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'TEMP_CEMSlot1~2' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `TEMP_CEMSlot1~2`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1866/2000 — `Wistron-BMC-00956-V002` · Items=TEMP_CEMBB · TestSet=IPMI Sensor List Commands
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:TEMP_CEMBB
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
- 🎯 目的:TEMP_CEMBB
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'TEMP_CEMBB' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `TEMP_CEMBB`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1867/2000 — `Wistron-BMC-00958-V003` · Items=TEMP_GB_GPU1~8 · TestSet=IPMI Sensor List Commands
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:TEMP_GB_GPU1~8
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
- 🎯 目的:TEMP_GB_GPU1~8
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'TEMP_GB_GPU1~8' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `TEMP_GB_GPU1~8`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1868/2000 — `Wistron-BMC-00959-V002` · Items=TEMP_UBB_GPU0~7 · TestSet=IPMI Sensor List Commands
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:TEMP_UBB_GPU0~7
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
- 🎯 目的:TEMP_UBB_GPU0~7
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'TEMP_UBB_GPU0~7' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `TEMP_UBB_GPU0~7`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1869/2000 — `Wistron-BMC-00960-V002` · Items=TEMP_GB_NVS1~4 · TestSet=IPMI Sensor List Commands
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:TEMP_GB_NVS1~4
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
- 🎯 目的:TEMP_GB_NVS1~4
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'TEMP_GB_NVS1~4' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `TEMP_GB_NVS1~4`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1870/2000 — `Wistron-BMC-00961-V002` · Items=TEMP_UBB_GPU0~7M · TestSet=IPMI Sensor List Commands
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:TEMP_UBB_GPU0~7M
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
- 🎯 目的:TEMP_UBB_GPU0~7M
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'TEMP_UBB_GPU0~7M' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `TEMP_UBB_GPU0~7M`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1871/2000 — `Wistron-BMC-00962-V002` · Items=TEMP_GB_HSC1~10 · TestSet=IPMI Sensor List Commands
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:TEMP_GB_HSC1~10
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
- 🎯 目的:TEMP_GB_HSC1~10
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'TEMP_GB_HSC1~10' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `TEMP_GB_HSC1~10`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1872/2000 — `Wistron-BMC-00963-V002` · Items=TEMP_UBB_HSC0~7 · TestSet=IPMI Sensor List Commands
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:TEMP_UBB_HSC0~7
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
- 🎯 目的:TEMP_UBB_HSC0~7
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'TEMP_UBB_HSC0~7' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `TEMP_UBB_HSC0~7`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1873/2000 — `Wistron-BMC-00964-V002` · Items=TEMP_STBY_HSC · TestSet=IPMI Sensor List Commands
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:TEMP_STBY_HSC
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
- 🎯 目的:TEMP_STBY_HSC
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'TEMP_STBY_HSC' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `TEMP_STBY_HSC`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1874/2000 — `Wistron-BMC-00965-V002` · Items=TEMP_GB_PCB1~4 · TestSet=IPMI Sensor List Commands
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:TEMP_GB_PCB1~4
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
- 🎯 目的:TEMP_GB_PCB1~4
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'TEMP_GB_PCB1~4' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `TEMP_GB_PCB1~4`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1875/2000 — `Wistron-BMC-00966-V002` · Items=TEMP_UBB_RTM0~7 · TestSet=IPMI Sensor List Commands
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:TEMP_UBB_RTM0~7
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
- 🎯 目的:TEMP_UBB_RTM0~7
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'TEMP_UBB_RTM0~7' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `TEMP_UBB_RTM0~7`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1876/2000 — `Wistron-BMC-00967-V002` · Items=TEMP_UBB_IBC · TestSet=IPMI Sensor List Commands
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:TEMP_UBB_IBC
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
- 🎯 目的:TEMP_UBB_IBC
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'TEMP_UBB_IBC' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `TEMP_UBB_IBC`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1877/2000 — `Wistron-BMC-00968-V002` · Items=TEMP_UBB_BACK · TestSet=IPMI Sensor List Commands
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:TEMP_UBB_BACK
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
- 🎯 目的:TEMP_UBB_BACK
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'TEMP_UBB_BACK' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `TEMP_UBB_BACK`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1878/2000 — `Wistron-BMC-00969-V002` · Items=TEMP_UBB_FRONT · TestSet=IPMI Sensor List Commands
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:TEMP_UBB_FRONT
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
- 🎯 目的:TEMP_UBB_FRONT
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'TEMP_UBB_FRONT' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `TEMP_UBB_FRONT`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1879/2000 — `Wistron-BMC-00970-V002` · Items=TEMP_UBB_FPGA · TestSet=IPMI Sensor List Commands
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:TEMP_UBB_FPGA
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
- 🎯 目的:TEMP_UBB_FPGA
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'TEMP_UBB_FPGA' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `TEMP_UBB_FPGA`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1880/2000 — `Wistron-BMC-00971-V002` · Items=TEMP_GB_INLET1~2 · TestSet=IPMI Sensor List Commands
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:TEMP_GB_INLET1~2
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
- 🎯 目的:TEMP_GB_INLET1~2
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'TEMP_GB_INLET1~2' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `TEMP_GB_INLET1~2`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1881/2000 — `Wistron-BMC-00972-V002` · Items=TEMP_GB_RTM1~8 · TestSet=IPMI Sensor List Commands
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:TEMP_GB_RTM1~8
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
- 🎯 目的:TEMP_GB_RTM1~8
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'TEMP_GB_RTM1~8' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `TEMP_GB_RTM1~8`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1882/2000 — `Wistron-BMC-00973-V002` · Items=TEMP_GB_GPU1~8_M · TestSet=IPMI Sensor List Commands
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:TEMP_GB_GPU1~8_M
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
- 🎯 目的:TEMP_GB_GPU1~8_M
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'TEMP_GB_GPU1~8_M' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `TEMP_GB_GPU1~8_M`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1883/2000 — `Wistron-BMC-00974-V002` · Items=TEMP_MB_PSU1~2 · TestSet=IPMI Sensor List Commands
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:TEMP_MB_PSU1~2
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
- 🎯 目的:TEMP_MB_PSU1~2
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'TEMP_MB_PSU1~2' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `TEMP_MB_PSU1~2`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1884/2000 — `Wistron-BMC-00975-V002` · Items=TEMP_PDB_PSU1~6 · TestSet=IPMI Sensor List Commands
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:TEMP_PDB_PSU1~6
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
- 🎯 目的:TEMP_PDB_PSU1~6
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'TEMP_PDB_PSU1~6' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `TEMP_PDB_PSU1~6`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1885/2000 — `Wistron-BMC-00976-V002` · Items=PWR_GB_HSC1~10 · TestSet=IPMI Sensor List Commands
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:PWR_GB_HSC1~10
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
- 🎯 目的:PWR_GB_HSC1~10
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'PWR_GB_HSC1~10' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `PWR_GB_HSC1~10`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1886/2000 — `Wistron-BMC-00977-V002` · Items=PWR_STBY_HSC · TestSet=IPMI Sensor List Commands
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:PWR_STBY_HSC
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
- 🎯 目的:PWR_STBY_HSC
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'PWR_STBY_HSC' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `PWR_STBY_HSC`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1887/2000 — `Wistron-BMC-00978-V002` · Items=PWR_MB_PSU1~2 · TestSet=IPMI Sensor List Commands
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:PWR_MB_PSU1~2
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
- 🎯 目的:PWR_MB_PSU1~2
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'PWR_MB_PSU1~2' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `PWR_MB_PSU1~2`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1888/2000 — `Wistron-BMC-00979-V002` · Items=PWR_PDB_PSU1~6 · TestSet=IPMI Sensor List Commands
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:PWR_PDB_PSU1~6
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
- 🎯 目的:PWR_PDB_PSU1~6
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'PWR_PDB_PSU1~6' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `PWR_PDB_PSU1~6`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1889/2000 — `Wistron-BMC-00980-V002` · Items=TEMP_HIB_PEX1~4 · TestSet=IPMI Sensor List Commands
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:TEMP_HIB_PEX1~4
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
- 🎯 目的:TEMP_HIB_PEX1~4
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'TEMP_HIB_PEX1~4' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `TEMP_LP1~8_Chip`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️      缺陷**:WR(命令內容/感測器名稱與 Items 不符 → 依 Items/procedure 重寫);已修 xlsx

---

### 1890/2000 — `Wistron-BMC-00980-V002` · Items=TEMP_LP1~8_Chip · TestSet=IPMI Sensor List Commands
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:TEMP_LP1~8_Chip
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
- 🎯 目的:TEMP_LP1~8_Chip
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'TEMP_LP1~8_Chip' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `TEMP_LP1~8_Chip`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1891/2000 — `Wistron-BMC-00981-V002` · Items=TEMP_LP1~8_TRX · TestSet=IPMI Sensor List Commands
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:TEMP_LP1~8_TRX
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
- 🎯 目的:TEMP_LP1~8_TRX
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'TEMP_LP1~8_TRX' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `TEMP_LP1~8_TRX`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1892/2000 — `Wistron-BMC-00982-V002` · Items=TEMP_FH11~15_Chip · TestSet=IPMI Sensor List Commands
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:TEMP_FH11~15_Chip
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
- 🎯 目的:TEMP_FH11~15_Chip
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'TEMP_FH11~15_Chip' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `TEMP_FH11~15_Chip`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1893/2000 — `Wistron-BMC-00983-V002` · Items=TEMP_FH11~15_TRX · TestSet=IPMI Sensor List Commands
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:TEMP_FH11~15_TRX
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
- 🎯 目的:TEMP_FH11~15_TRX
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'TEMP_FH11~15_TRX' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `TEMP_FH11~15_TRX`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1894/2000 — `Wistron-BMC-00984-V002` · Items=TEMP_FH11~15_TRX · TestSet=Sensor Page
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:TEMP_FH11~15_TRX
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Sensor Reading & Threshold is human reable and match with spec.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:TEMP_FH11~15_TRX
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'TEMP_FH11~15_TRX' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `TEMP_FH11~15_TRX`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1895/2000 — `Wistron-BMC-00985-V002` · Items=SPD_FAN1_F~SPD_FAN16_F · TestSet=IPMI Sensor List Commands
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:SPD_FAN1_F~SPD_FAN16_F
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
- 🎯 目的:SPD_FAN1_F~SPD_FAN16_F
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'SPD_FAN1_F~SPD_FAN16_F' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `SPD_FAN1_F~SPD_FAN16_F`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1896/2000 — `Wistron-BMC-00986-V002` · Items=SPD_FAN1_R~SPD_FAN16_R · TestSet=IPMI Sensor List Commands
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:SPD_FAN1_R~SPD_FAN16_R
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
- 🎯 目的:SPD_FAN1_R~SPD_FAN16_R
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'SPD_FAN1_R~SPD_FAN16_R' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `SPD_FAN1_R~SPD_FAN16_R`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1897/2000 — `Wistron-BMC-00987-V002` · Items=PWR_UBB_GPU0~7 · TestSet=IPMI Sensor List Commands
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:PWR_UBB_GPU0~7
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
- 🎯 目的:PWR_UBB_GPU0~7
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'PWR_UBB_GPU0~7' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `PWR_UBB_GPU0~7`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1898/2000 — `Wistron-BMC-00988-V002` · Items=PWR_GB_GPU1~8 · TestSet=IPMI Sensor List Commands
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:PWR_GB_GPU1~8
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
- 🎯 目的:PWR_GB_GPU1~8
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'PWR_GB_GPU1~8' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `PWR_GB_GPU1~8`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1899/2000 — `Wistron-BMC-00989-V002` · Items=PWR_GB_GPU1~8_M · TestSet=IPMI Sensor List Commands
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:PWR_GB_GPU1~8_M
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
- 🎯 目的:PWR_GB_GPU1~8_M
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'PWR_GB_GPU1~8_M' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `PWR_GB_GPU1~8_M`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1900/2000 — `Wistron-BMC-00990-V002` · Items=TEMP_GB_PEX_SW · TestSet=IPMI Sensor List Commands
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:TEMP_GB_PEX_SW
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
- 🎯 目的:TEMP_GB_PEX_SW
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'TEMP_GB_PEX_SW' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `TEMP_GB_PEX_SW`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1901/2000 — `Wistron-BMC-00991-V002` · Items=TEMP_GB_FPGA · TestSet=IPMI Sensor List Commands
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:TEMP_GB_FPGA
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
- 🎯 目的:TEMP_GB_FPGA
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'TEMP_GB_FPGA' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `TEMP_GB_FPGA`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1902/2000 — `Wistron-HW-00454-V002` · Items=E1S - Under BF3/CX8 · TestSet=L10 System - LED
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:E1S - Under BF3/CX8
- Q2 位置:不執行(見說明)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Green Solid
Green Blink
Amber Solid
Amber Blink Not Defined
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:E1S - Under BF3/CX8
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 1903/2000 — `Wistron-HW-00455-V002` · Items=E1S - Under PSB · TestSet=L10 System - LED
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:E1S - Under PSB
- Q2 位置:不執行(見說明)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Green Solid
Green Blink
Amber Solid
Amber Blink Not Defined
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:E1S - Under PSB
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 1904/2000 — `Wistron-HW-00456-V002` · Items=BF3 - Port 1 LED Check · TestSet=L10 System - LED
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:BF3 - Port 1 LED Check
- Q2 位置:不執行(見說明)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Green Solid
Green Blink
Amber Solid
Amber Blink
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:BF3 - Port 1 LED Check
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 1905/2000 — `Wistron-HW-00457-V002` · Items=BF3 - Port 2 · TestSet=L10 System - LED
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:BF3 - Port 2
- Q2 位置:不執行(見說明)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Green Solid
Green Blink
Amber Solid
Amber Blink
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:BF3 - Port 2
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 1906/2000 — `Wistron-HW-00458-V002` · Items=OSFP CH1 LED Check · TestSet=L10 System - LED
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:OSFP CH1 LED Check
- Q2 位置:不執行(見說明)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Green Solid
Green Blink
Amber Solid
Amber Blink Not Defined
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:OSFP CH1 LED Check
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 1907/2000 — `Wistron-HW-00459-V002` · Items=OSFP CH2 LED Check · TestSet=L10 System - LED
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:OSFP CH2 LED Check
- Q2 位置:不執行(見說明)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Green Solid
Green Blink
Amber Solid
Amber Blink Not Defined
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:OSFP CH2 LED Check
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 1908/2000 — `Wistron-HW-00460-V002` · Items=System Fault LED Check · TestSet=L10 System - LED
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:System Fault LED Check
- Q2 位置:不執行(見說明)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Green Solid Not Defined
Green Blink Not Defined
Amber Solid
Amber Blink
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:System Fault LED Check
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 1909/2000 — `Wistron-HW-00461-V002` · Items=NV Link LED Check · TestSet=L10 System - LED
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:NV Link LED Check
- Q2 位置:不執行(見說明)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Green Solid
Green Blink
Amber Solid
Amber Blink
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:NV Link LED Check
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 1910/2000 — `Wistron-HW-00462-V002` · Items=Power Button LED Check · TestSet=L10 System - LED
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:Power Button LED Check
- Q2 位置:不執行(見說明)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Green Solid
Green Blink
Amber Solid Not Defined
Amber Blink Not Defined
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Power Button LED Check
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 1911/2000 — `Wistron-HW-00463-V002` · Items=ID Button LED Check · TestSet=L10 System - LED
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:ID Button LED Check
- Q2 位置:不執行(見說明)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Green Solid
Green Blink
Amber Solid Not Defined
Amber Blink Not Defined
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:ID Button LED Check
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 1912/2000 — `Wistron-HW-00464-V002` · Items=BMC RJ45 LED Check · TestSet=L10 System - LED
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:BMC RJ45 LED Check
- Q2 位置:不執行(見說明)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Green Solid
Green Blink
Amber Solid
Amber Blink Not Defined
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:BMC RJ45 LED Check
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 1913/2000 — `Wistron-GB NV PVP SW-00001-V002` · Items=SW.1_NVSSVT · TestSet=System software
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:SW.1_NVSSVT
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:NVSSVT Pass rate 100%
- Q6 補什麼:NVSSVT (NVIDIA vendor run)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:SW.1_NVSSVT
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- SW.1_NVSSVT (GB SW.1_NVSSVT): complete the L0/L1 NVSSVT suites per the Grace SBIOS/FW references. Agent can dump the software stack to qualify sshpass -p "$DUT_PASS" ssh -o StrictHostKeyC`
- 📤 產出人:
  log 取位:return the OS/kernel/firmware inventory that NVSSVT qualifies + the suite pass-rate result so the user confirms the 100% target.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1914/2000 — `Wistron-GB NV PVP SW-00002-V002` · Items=SW.2_NVRASTool · TestSet=RAS  (Reliability, Availability, Serviceability)
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:SW.2_NVRASTool
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:NVRAS Pass rate 100%
- Q6 補什麼:NVRASTool (NVIDIA) + rasdaemon
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:SW.2_NVRASTool
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- SW.2_NVRASTool (GB SW.2_NVRASTool): complete the NVRASTool suites per the Grace RAS catalogs. Agent collects the in-OS RAS state sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DU`
- 📤 產出人:
  log 取位:return the RAS/EDAC inventory + dmesg error tail + the NVRASTool pass-rate so the user confirms GPG 100% NVRAS pass target.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1915/2000 — `Wistron-GB NV PVP SW-00003-V002` · Items=SW.3_NVDebug Tool · TestSet=Debug Log Collection
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:SW.3_NVDebug Tool
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:NVDebug Pass rate 100%
- Q6 補什麼:NVDebug tool (NVIDIA - install first)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:SW.3_NVDebug Tool
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- SW.3_NVDebug Tool (GB SW.3_NVDebug): run NVDebug to collect both in-band and OOB logs. Agent runs the in-band collection sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$`
- 📤 產出人:
  log 取位:return the NVDebug in-band stdout + the collected OOB log file listing so the user confirms the 100% NVDebug pass rate.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1916/2000 — `Wistron-GB NV PVP HW-00001-V003` · Items=NT.1_Network NVQual · TestSet=Network
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:NT.1_Network NVQual
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:All items passed
- Q6 補什麼:NVQual (NVIDIA tool - install first) + test topology
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:NT.1_Network NVQual
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- NT.1_Network NVQual (ConnectX EOM Test): run NVIDIA NVQual on the BlueField. NVQual is a vendor tool (operator install + license/test topology); agent provides the launch wrapper + collec`
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP"nvqual -h 2>&1 | head -n 20 2>&1"`
  `-- then run the specific NVQual NT.1 Network test per the NVIDIA docs once NVQual is installed (operator-provided).`
- 📤 產出人:
  log 取位:return the NVQual launch + the specific NT.1_Network NVQual (Wistron-GB NV PVP HW-00001-V003) test result so the user confirms the network t
  risk:RISK: NVQual runs long multi-config network tests; needs the test topology and packages installed, and full pass/fail is judged by the user.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️      缺陷**:Q-LIT(ssh 內層裸雙引號 → 單引號);已修 xlsx

---

### 1917/2000 — `Wistron-GB NV PVP HW-00002-V004` · Items=NT.4_Network NVQual · TestSet=Network
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:NT.4_Network NVQual
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:All items passed
- Q6 補什麼:NVQual (NVIDIA tool - install first) + test topology
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:NT.4_Network NVQual
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- NT.4_Network NVQual (BlueField PCIe Interface Traffic Test / NVQual Test #21): run NVIDIA NVQual on the BlueField. NVQual is a vendor tool (operator install + license/test topology); agen`
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP"nvqual -h 2>&1 | head -n 20 2>&1"`
  `-- then run NVQual test #21 per the NVIDIA docs once NVQual is installed (operator-provided).`
- 📤 產出人:
  log 取位:return the NVQual launch + the specific NT.4_Network NVQual (Wistron-GB NV PVP HW-00002-V004) test result so the user confirms the network t
  risk:RISK: NVQual runs long multi-config network tests; needs the test topology and packages installed, and full pass/fail is judged by the user.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️      缺陷**:Q-LIT(ssh 內層裸雙引號 → 單引號);已修 xlsx

---

### 1918/2000 — `Wistron-GB NV PVP HW-00465-V003` · Items=SD.1_Storage E1.S Hot swap · TestSet=Storage
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:SD.1_Storage E1.S Hot swap
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:E1.S drives enumerate after being hot swapped
- Q6 補什麼:ipmitool + ssh
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:SD.1_Storage E1.S Hot swap
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" chassis power off; sleep 10; ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" chassis power on; sleep`
- 📤 產出人:
  log 取位:DC cycle (run power off/on from the BMC) then confirm the system boots; report `uptime` and any dmesg AER/PCIe errors. This code is shared f
  risk:RISK: state-changing: powers the SUT off/on through the BMC (DC cycle), interrupting running state; confirm no jobs are running first, then 
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1919/2000 — `Wistron-GB NV PVP HW-00004-V003` · Items=SD.2_Storage NVQual · TestSet=Storage
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:SD.2_Storage NVQual
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:All test items passed
- Q6 補什麼:NVIDIA NVQual (user installs + license)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:SD.2_Storage NVQual
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- SD.2_Storage NVQual: run NVIDIA NVQual storage validation. Needs NVQual installed (license); agent launches the suite and collects per-case results once the packages/license are in place `
- 📤 產出人:
  log 取位:return the NVQual run summary (per-case pass/fail over the storage drives) so the user confirms storage validation passes.
  risk:RISK: NVQual may run destructive I/O patterns; confirm the user-designated test drives before running.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1920/2000 — `Wistron-GB NV PVP HW-00465-V003` · Items=SY.4_DC reboot test · TestSet=System
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:SY.4_DC reboot test
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:System successfully comes up after DC cycle

Boot to OS, then check dmesg log for unexpected AER errors, check PCIE enumartion for all devices, after each boot cycle.
- Q6 補什麼:ipmitool + ssh
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:SY.4_DC reboot test
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" chassis power off; sleep 10; ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" chassis power on; sleep`
- 📤 產出人:
  log 取位:DC cycle (run power off/on from the BMC) then confirm the system boots; report `uptime` and any dmesg AER/PCIe errors. This code is shared f
  risk:RISK: state-changing: powers the SUT off/on through the BMC (DC cycle), interrupting running state; confirm no jobs are running first, then 
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1921/2000 — `Wistron-GB NV PVP HW-00005-V005` · Items=SY.2_Warm reboot test · TestSet=System
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:SY.2_Warm reboot test
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:System can successfully warm reboot

Boot to OS, then check dmesg log for unexpected AER errors, check PCIE enumartion for all devices, after each boot cycle.
- Q6 補什麼:ipmitool + ssh
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:SY.2_Warm reboot test
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" chassis power cycle; sleep 180; ssh -o StrictHostKeyChecking=no "$DUT_USER@$DUT_IP" "uptime; dmesg | grep -iE 'AER|PCIe' `
- 📤 產出人:
  log 取位:issue a warm reboot via `chassis power cycle`, wait for OS boot, then confirm `uptime` shows the new boot and scan dmesg for unexpected AER/
  risk:RISK: state-changing: reboots the SUT (warm reboot) which interrupts work; ensure no jobs are running first, then verify clean boot.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1922/2000 — `Wistron-GB NV PVP HW-00466-V004` · Items=SY.3_AC reboot test · TestSet=System
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:SY.3_AC reboot test
- Q2 位置:不執行(見說明)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:System successfully comes up after AC cycle

Boot to OS, then check dmesg log for unexpected AER errors, check PCIE enumartion for all devices, after each boot cycle.
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:SY.3_AC reboot test
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 1923/2000 — `Wistron-GB NV PVP HW-00465-V003` · Items=SY.5_DC 2 reboot test · TestSet=System
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:SY.5_DC 2 reboot test
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:System successfully comes up after DC cycle

Boot to OS, then check dmesg log for unexpected AER errors, check PCIE enumartion for all devices, after each boot cycle.
- Q6 補什麼:ipmitool + ssh
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:SY.5_DC 2 reboot test
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" chassis power off; sleep 10; ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" chassis power on; sleep`
- 📤 產出人:
  log 取位:DC cycle (run power off/on from the BMC) then confirm the system boots; report `uptime` and any dmesg AER/PCIe errors. This code is shared f
  risk:RISK: state-changing: powers the SUT off/on through the BMC (DC cycle), interrupting running state; confirm no jobs are running first, then 
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1924/2000 — `Wistron-GB NV PVP HW-00465-V004` · Items=SY.6_Warm reboot stress test · TestSet=System
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:SY.6_Warm reboot stress test
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:SY.6_Warm reboot stress test
- Q6 補什麼:ipmitool + ssh
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:SY.6_Warm reboot stress test
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `for i in $(seq 1 5); do ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" chassis power cycle; sleep 240; ssh -o StrictHostKeyChecking=no "$DUT_USER@$DUT_IP" "echo cycle=$`
- 📤 產出人:
  log 取位:run a shortened warm-reboot stress loop (the spec requires 100x; agent runs a representative sub-set and reports counts of AER/dmesg hits pe
  risk:RISK: destructive/long: repeated power cycles reboots the SUT many times and interrupts all running state; full 100x takes hours. Agent runs
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1925/2000 — `Wistron-GB NV PVP HW-00010-V002` · Items=SY.7_AC reboot stress test · TestSet=System
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:SY.7_AC reboot stress test
- Q2 位置:不執行(見說明)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:SY.7_AC reboot stress test
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:SY.7_AC reboot stress test
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 1926/2000 — `Wistron-GB NV PVP HW-00011-V003` · Items=SY.8_DC reboot stress test · TestSet=System
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:SY.8_DC reboot stress test
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:SY.8_DC reboot stress test
- Q6 補什麼:ipmitool + ssh
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:SY.8_DC reboot stress test
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `for i in $(seq 1 5); do ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" chassis power off; sleep 5; ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" `
- 📤 產出人:
  log 取位:run a shortened DC-cycle stress loop via the BMC (spec wants 100x; agent runs a representative sub-set and reports boot + AER/PCIe counts pe
  risk:RISK: destructive/long: repeated DC power cycles reboots the SUT many times; full 100x is time-prohibitive. Reduced loop for smoke evidence;
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1927/2000 — `Wistron-GB NV PVP HW-00012-V002` · Items=SY.9_System Inventory check · TestSet=System
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:SY.9_System Inventory check
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Ensure complete inventory for entire Oberon chassis
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:SY.9_System Inventory check
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" fru print 2>&1; echo ---; ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sdr list 2>&1 | grep -iE "`
- 📤 產出人:
  log 取位:return FULL `ipmitool fru print` + SDR presence output so user can confirm every node in the chassis is enumerated/inventory complete. No RI
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1928/2000 — `Wistron-GB NV PVP HW-00013-V002` · Items=SY.10_Tray button functional · TestSet=System
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:SY.10_Tray button functional
- Q2 位置:不執行(見說明)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:All buttons work as expected and trigger the appropriate tray responses
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:SY.10_Tray button functional
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 1929/2000 — `Wistron-GB NV PVP HW-00014-V002` · Items=SY.11_Tray hot swap · TestSet=System
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:SY.11_Tray hot swap
- Q2 位置:不執行(見說明)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Tray is not damaged during hot swap and can succesfully boot after hot swap
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:SY.11_Tray hot swap
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 1930/2000 — `Wistron-BIOS-00473-V003` · Items=Type 11 - OEM Strings · TestSet=Sanity SMBIOS
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Type 11 - OEM Strings
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Information should be correct and still be correct after rebooting
- Q6 補什麼:dmidecode
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Type 11 - OEM Strings
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "dmidecode -t 11 2>/dev/null | grep -iA1 \"OEM Strings\""`
- 📤 產出人:
  log 取位:return FULL raw `dmidecode -t 11` output filtered to the `OEM Strings` value for that section (raw text, verbatim) so the user can diff agai
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1931/2000 — `Wistron-BIOS-00465-V003` · Items=Type 12 - System Configuration Options · TestSet=Sanity SMBIOS
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Type 12 - System Configuration Options
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Information should be correct and still be correct after rebooting
- Q6 補什麼:dmidecode
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Type 12 - System Configuration Options
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "dmidecode -t 18 2>/dev/null | grep -iA1 \"32-Bit Memory Error Information\""`
- 📤 產出人:
  log 取位:return FULL raw `dmidecode -t 18` output filtered to the `32-Bit Memory Error Information` value for that section (raw text, verbatim) so th
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1932/2000 — `Wistron-BIOS-00477-V002` · Items=Type 15 - System Event Log · TestSet=Sanity SMBIOS
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Type 15 - System Event Log
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Information should be correct and still be correct after rebooting
- Q6 補什麼:dmidecode
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Type 15 - System Event Log
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "dmidecode -t 15 2>/dev/null | grep -iA1 \"System Event Log\""`
- 📤 產出人:
  log 取位:return FULL raw `dmidecode -t 15` output filtered to the `System Event Log` value for that section (raw text, verbatim) so the user can diff
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1933/2000 — `Wistron-BIOS-00465-V003` · Items=Type 18 - 32-Bit Memory Error Information · TestSet=Sanity SMBIOS
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Type 18 - 32-Bit Memory Error Information
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Information should be correct and still be correct after rebooting
- Q6 補什麼:dmidecode
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Type 18 - 32-Bit Memory Error Information
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "dmidecode -t 18 2>/dev/null | grep -iA1 \"32-Bit Memory Error Information\""`
- 📤 產出人:
  log 取位:return FULL raw `dmidecode -t 18` output filtered to the `32-Bit Memory Error Information` value for that section (raw text, verbatim) so th
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1934/2000 — `Wistron-BIOS-00478-V002` · Items=Type 19 - Memory Array Mapped Address · TestSet=Sanity SMBIOS
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Type 19 - Memory Array Mapped Address
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Information should be correct and still be correct after rebooting
- Q6 補什麼:dmidecode
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Type 19 - Memory Array Mapped Address
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "dmidecode -t 19 2>/dev/null | grep -iA1 \"Memory Array Mapped Address\""`
- 📤 產出人:
  log 取位:return FULL raw `dmidecode -t 19` output filtered to the `Memory Array Mapped Address` value for that section (raw text, verbatim) so the us
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1935/2000 — `Wistron-BIOS-00479-V002` · Items=Type 20 - Memory Device Mapped Address · TestSet=Sanity SMBIOS
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Type 20 - Memory Device Mapped Address
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Information should be correct and still be correct after rebooting
- Q6 補什麼:dmidecode
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Type 20 - Memory Device Mapped Address
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "dmidecode -t 20 2>/dev/null | grep -iA1 \"Memory Device Mapped Address\""`
- 📤 產出人:
  log 取位:return FULL raw `dmidecode -t 20` output filtered to the `Memory Device Mapped Address` value for that section (raw text, verbatim) so the u
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1936/2000 — `Wistron-BIOS-00480-V002` · Items=Type 26 - Voltage Probe · TestSet=Sanity SMBIOS
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Type 26 - Voltage Probe
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Information should be correct and still be correct after rebooting
- Q6 補什麼:dmidecode
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Type 26 - Voltage Probe
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "dmidecode -t 26 2>/dev/null | grep -iA1 \"Voltage Probe\""`
- 📤 產出人:
  log 取位:return FULL raw `dmidecode -t 26` output filtered to the `Voltage Probe` value for that section (raw text, verbatim) so the user can diff ag
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1937/2000 — `Wistron-BIOS-00481-V002` · Items=Type 27 - Cooling Device · TestSet=Sanity SMBIOS
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Type 27 - Cooling Device
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Information should be correct and still be correct after rebooting
- Q6 補什麼:dmidecode
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Type 27 - Cooling Device
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "dmidecode -t 27 2>/dev/null | grep -iA1 \"Cooling Device\""`
- 📤 產出人:
  log 取位:return FULL raw `dmidecode -t 27` output filtered to the `Cooling Device` value for that section (raw text, verbatim) so the user can diff a
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1938/2000 — `Wistron-BIOS-00482-V002` · Items=Type 28 - Temperature Probe · TestSet=Sanity SMBIOS
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Type 28 - Temperature Probe
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Information should be correct and still be correct after rebooting
- Q6 補什麼:dmidecode
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Type 28 - Temperature Probe
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "dmidecode -t 28 2>/dev/null | grep -iA1 \"Temperature Probe\""`
- 📤 產出人:
  log 取位:return FULL raw `dmidecode -t 28` output filtered to the `Temperature Probe` value for that section (raw text, verbatim) so the user can dif
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1939/2000 — `Wistron-BIOS-00483-V002` · Items=Type 29 - Electrical Current Probe · TestSet=Sanity SMBIOS
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Type 29 - Electrical Current Probe
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Information should be correct and still be correct after rebooting
- Q6 補什麼:dmidecode
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Type 29 - Electrical Current Probe
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "dmidecode -t 29 2>/dev/null | grep -iA1 \"Electrical Current Probe\""`
- 📤 產出人:
  log 取位:return FULL raw `dmidecode -t 29` output filtered to the `Electrical Current Probe` value for that section (raw text, verbatim) so the user 
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1940/2000 — `Wistron-BIOS-00466-V003` · Items=Type 38 - IPMI Device Information · TestSet=Sanity SMBIOS
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Type 38 - IPMI Device Information
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Information should be correct and still be correct after rebooting
- Q6 補什麼:dmidecode
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Type 38 - IPMI Device Information
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "dmidecode -t 38 2>/dev/null | grep -iA1 \"IPMI Device Information\""`
- 📤 產出人:
  log 取位:return FULL raw `dmidecode -t 38` output filtered to the `IPMI Device Information` value for that section (raw text, verbatim) so the user c
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1941/2000 — `Wistron-BIOS-00484-V002` · Items=Type 40 - Additional Information · TestSet=Sanity SMBIOS
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Type 40 - Additional Information
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Information should be correct and still be correct after rebooting
- Q6 補什麼:dmidecode
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Type 40 - Additional Information
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "dmidecode -t 40 2>/dev/null | grep -iA1 \"Additional Information\""`
- 📤 產出人:
  log 取位:return FULL raw `dmidecode -t 40` output filtered to the `Additional Information` value for that section (raw text, verbatim) so the user ca
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1942/2000 — `Wistron-BIOS-00485-V002` · Items=Type 43 - TPM Device · TestSet=Sanity SMBIOS
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Type 43 - TPM Device
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Information should be correct and still be correct after rebooting
- Q6 補什麼:dmidecode
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Type 43 - TPM Device
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "dmidecode -t 43 2>/dev/null | grep -iA1 \"TPM Device\""`
- 📤 產出人:
  log 取位:return FULL raw `dmidecode -t 43` output filtered to the `TPM Device` value for that section (raw text, verbatim) so the user can diff again
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1943/2000 — `Wistron-BIOS-00486-V002` · Items=Type 44 - Processor Additional Information · TestSet=Sanity SMBIOS
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Type 44 - Processor Additional Information
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Information should be correct and still be correct after rebooting
- Q6 補什麼:dmidecode
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Type 44 - Processor Additional Information
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "dmidecode -t 44 2>/dev/null | grep -iA1 \"Processor Additional Information\""`
- 📤 產出人:
  log 取位:return FULL raw `dmidecode -t 44` output filtered to the `Processor Additional Information` value for that section (raw text, verbatim) so t
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1944/2000 — `Wistron-BIOS-00487-V002` · Items=Type 38 - IPMI Device Information · TestSet=Sanity SMBIOS
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Type 38 - IPMI Device Information
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Information should be correct and still be correct after rebooting
- Q6 補什麼:dmidecode
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Type 38 - IPMI Device Information
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "dmidecode -t 38 2>/dev/null | grep -iA1 \"IPMI Device Information\""`
- 📤 產出人:
  log 取位:return FULL raw `dmidecode -t 38` output filtered to the `IPMI Device Information` value for that section (raw text, verbatim) so the user c
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1945/2000 — `Wistron-BIOS-00488-V002` · Items=Type 18 - 32-Bit Memory Error Information · TestSet=Sanity SMBIOS
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Type 18 - 32-Bit Memory Error Information
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Information should be correct and still be correct after rebooting
- Q6 補什麼:dmidecode
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Type 18 - 32-Bit Memory Error Information
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "dmidecode -t 18 2>/dev/null | grep -iA1 \"32-Bit Memory Error Information\""`
- 📤 產出人:
  log 取位:return FULL raw `dmidecode -t 18` output filtered to the `32-Bit Memory Error Information` value for that section (raw text, verbatim) so th
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1946/2000 — `Wistron-BIOS-00489-V002` · Items=Type 39 - System Power Supply · TestSet=Sanity SMBIOS
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Type 39 - System Power Supply
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Information should be correct and still be correct after rebooting
- Q6 補什麼:dmidecode
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Type 39 - System Power Supply
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "dmidecode -t 39 2>/dev/null | grep -iA1 \"System Power Supply\""`
- 📤 產出人:
  log 取位:return FULL raw `dmidecode -t 39` output filtered to the `System Power Supply` value for that section (raw text, verbatim) so the user can d
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1947/2000 — `Wistron-BIOS-00490-V002` · Items=Type 45 - Firmware Inventory Information · TestSet=Sanity SMBIOS
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Type 45 - Firmware Inventory Information
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Information should be correct and still be correct after rebooting
- Q6 補什麼:dmidecode
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Type 45 - Firmware Inventory Information
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "dmidecode -t 45 2>/dev/null | grep -iA1 \"Firmware Inventory Information\""`
- 📤 產出人:
  log 取位:return FULL raw `dmidecode -t 45` output filtered to the `Firmware Inventory Information` value for that section (raw text, verbatim) so the
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1948/2000 — `Wistron-BMC-00992-V002` · Items=Logs - Export SEL · TestSet=BMC WebUI
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:Logs - Export SEL
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:SEL should be exported successfully
- Q6 補什麼:BMC web access (operator download) + ipmitool to mirror the SEL
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Logs - Export SEL
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- Logs - Export SEL: export the SEL log from BMC web -> Logs -> Export (download the .csv). Web-UI export is operator-driven; agent performs the equivalent read ipmitool -I lanplus -C 17 -U`
- 📤 產出人:
  log 取位:return the ipmitool SEL listing + confirm the webUI SEL export file (csv) was downloaded so the user can diff the exported SEL.
  risk:RISK: exporting is read-only; no state change -- webUI download is a human step to capture the file.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1949/2000 — `Wistron-BMC-00993-V002` · Items=Logs - Export POST Code Logs · TestSet=BMC WebUI
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:Logs - Export POST Code Logs
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:POST code logs should be exported successfully.
- Q6 補什麼:BMC web access + ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Logs - Export POST Code Logs
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- Logs - Export POST Code Logs: export the POST-code log from BMC web -> Logs -> POST Code. Web-UI export is operator capture; agent mirrors with ipmitool -I lanplus -C 17 -U "$BMC_USER" -P`
- 📤 產出人:
  log 取位:return the filtered SEL POST-code entries + confirm the webUI export file was captured so the user can compare POST codes.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1950/2000 — `Wistron-BIOS-00491-V002` · Items=Hotkey : ESC · TestSet=POST & General Hotkey
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:Hotkey : ESC
- Q2 位置:不執行(見說明)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. POST information (include BIOS version and release date) should be readable and correct.
2. SUT should boot into BIOS setup menu successfully.
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Hotkey : ESC
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 1951/2000 — `Wistron-BMC-00994-V002` · Items=Other - Profile settings · TestSet=BMC WebUI
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:Other - Profile settings
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:password can be set/change.
- Q6 補什麼:BMC web access + ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Other - Profile settings
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- Other - Profile settings: load/save the BMC profile settings via web -> Settings -> Profile. Web-UI profile save/restore is operator driven; agent reads the current settings ipmitool -I l`
- 📤 產出人:
  log 取位:return the user/channel settings read + confirm the profile export file was saved so the user can verify the profile contents match the expe
  risk:RISK: saving a custom BMC profile can overwrite current settings; only export (read) unless the user explicitly wants to load a profile.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1952/2000 — `Wistron-BMC-00995-V002` · Items=Other - Log Out · TestSet=BMC WebUI
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:Other - Log Out
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:ACCOUNT CAN BE Log out
- Q6 補什麼:none (operator webUI)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Other - Log Out
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 1953/2000 — `Wistron-AMD SVM-00024-V003` · Items=RAS Enablement by Using Out-Of-Band Method · TestSet=RAS
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:RAS Enablement by Using Out-Of-Band Method
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:EINJState should be Enabled.
- Q6 補什麼:curl (Redfish) on the BMC + BMC login; amdgpuras not strictly needed here
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:RAS Enablement by Using Out-Of-Band Method
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- RAS Enablement (AMD EINJState) via OOB Redfish from the agent host: read EINJState, and if disabled, enable it via the Redfish AMD ErrInjection action, then re-read.`
  `curl -s -k -u "$BMC_USER:$BMC_PASS" http://$BMC_IP/redfish/v1/Chassis/OAM_0 2>&1 | grep -i einjstate`
  `-- enable (write; operator approves) then re-read EINJState above.`
- 📤 產出人:
  log 取位:return the Redfish EINJState before/after so the user confirms Out-Of-Band RAS injection mode is Enabled.
  risk:RISK: enabling OOB error-injection mode changes BMC config; leave it at the project-defined state after the test.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️      缺陷**:R5(OOB ipmitool/Redfish 誤包 DUT-ssh → 移 agent-host);已修 xlsx

---

### 1954/2000 — `Wistron-AMD SVM-00036-V003` · Items=Bad Page Avoidance · TestSet=RAS
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:Bad Page Avoidance
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:• PASS = 
- AMDGPURAS tool GFX error injection command returns Bus error.
- Redfish command for CPER index retrieval shows the CPER index is increased by 1 and new CPER file is generated upon the error injected.
- The decoded result from the decoded CPER log matches the injected error type and location.
• Error location lists the OAM on which the error occurred.
• Bank matches the type of error injected: UMC.
• Errorcode ext is 0 and Errocode ext Type is On-die ECC.
• Error severity matches the type of error injected: Deferred error.
• Bank matches the type of error injected: GC.
• Errorcode ext is 62 and Errocode ext Type is GFX_IP_Poison_Error.
• Error severity matches the type of error injected: Uncorrected Error. Poison has been consumed.
• FAIL = 
- AMDGPU RAS Tool ODECC replay error injection command returns Failed.
- Q6 補什麼:AMDGPU-RAS tool (amdgpuras) + Redfish CPER access
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Bad Page Avoidance
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- Bad Page Avoidance (bad-page avoidance): clear RAS EEPROM, reload amdgpu with ras_enable=1, inject a GFX error via amdgpuras and confirm the CPER index increments + the bad page is avoide`
- 📤 產出人:
  log 取位:return the amdgpuras injection result + the Redfish CPER index before/after + decoded CPER so the user confirms the bad page was avoided per
  risk:RISK: injecting a hardware/CPU error can disrupt the SUT and may need a reboot/recovery; run only on a dedicated SUT with the exact injectio
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1955/2000 — `Wistron-AMD SVM-00037-V003` · Items=Bad Page Threshold Exceed · TestSet=RAS
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:Bad Page Threshold Exceed
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:• PASS = 
- AMDGPURAS tool GFX error injection command returns successfully.
- Redfish command for CPER index retrieval shows the CPER index is increased by 1 and new CPER file is generated upon the error injected.
- The decoded result from the decoded CPER log matches the injected error type and location.
• Error location lists the OAM on which the error occurred.
• Bank matches the type of error injected: UMC.
• Errorcode ext is 0 and Errocode ext Type is Bad Page Retirement Threshold.
• Error severity matches the type of error injected: Uncorrected recoverable error.
• Bank matches the type of error injected: UMC.
• Errorcode ext is 0 and Errocode ext Type is On-die ECC.
• Error severity matches the type of error injected: Deferred error.
• Bank matches the type of error injected: GC.
• Errorcode ext is 62 and Errocode ext Type is GFX_IP_Poison_Error.
• Error severity matches the type of error injected: Uncorrected Error. Poison has been consumed.
- Q6 補什麼:AMDGPU-RAS tool (amdgpuras) + Redfish CPER access
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Bad Page Threshold Exceed
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- Bad Page Threshold Exceed (bad-page threshold exceeded / RMA): clear RAS EEPROM, `modprobe amdgpu ras_enable=1 bad_page_threshold=<val>`, inject to exceed the threshold and confirm the CP`
- 📤 產出人:
  log 取位:return the injection result + CPER index delta + decoded CPER (bad page threshold exceeded marker) so the user confirms the threshold/RMA be
  risk:RISK: injecting a hardware/CPU error can disrupt the SUT and may need a reboot/recovery; run only on a dedicated SUT with the exact injectio
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1956/2000 — `Wistron-AMD SVM-00124-V003` · Items=Check XGMI Link Status · TestSet=XGMI Link Marging
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:Check XGMI Link Status
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:"1.XGMI link connectivity between all the nodes and forms a ring 
2. All XGMI links are trained to XGMI3: 32 Gbps x16"
- Q6 補什麼:AMDGPU-RAS tool (amdgpuras) + Redfish CPER access
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Check XGMI Link Status
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- Check XGMI Link Status: confirm XGMI link connectivity across all nodes (forms a ring) and the links train to XGMI3 32Gbps x16 via amdxio (AMD vendor tool).`
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP"sudo ./amdxio -xgmi -linkstatus 2>&1 | tail -n 40"`
  `-- amdxio is a vendor tool (operator-provided path); the operator installs it before the agent reads the ring status.`
- 📤 產出人:
  log 取位:return amdgpuras injection result + `dmesg -T | tail -100` (expected amdgpu hardware error) + decoded CPER so the user confirms the injected
  risk:RISK: injecting a hardware/CPU error can disrupt the SUT and may need a reboot/recovery; run only on a dedicated SUT with the exact injectio
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️      缺陷**:WR(命令內容/感測器名稱與 Items 不符 → 依 Items/procedure 重寫);已修 xlsx

---

### 1957/2000 — `Wistron-AMD SVM-00137-V002` · Items=PLDM Support - UBB SMC · TestSet=BMC remote management
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:PLDM Support - UBB SMC
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:The temperature and power reading is higher than before stress.
The state sensor reading result indicates UBB/SMC status correctly.
The SMC SSH access is disconnected after the SMC reset.
The GPU power limit changes to the PLDM setting value.
- Q6 補什麼:pldmtool + BMC PLDM/MCTP stack (user-provided)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:PLDM Support - UBB SMC
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- PLDM Support - UBB SMC (UBB SMC PLDM): verify PLDM support between BMC and the UBB SMC using the vendor PLDM utility / pldmtool from BMC SSH sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChe`
- 📤 產出人:
  log 取位:return the pldmtool discovery/GetPDR output so the user confirms the BMC-UBB SMC PLDM link is functional.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1958/2000 — `Wistron-BMC-00996-V002` · Items=ChassisCollection · TestSet=Chassis (Power-Control)
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:ChassisCollection
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Criteria:
Redfish responds data are readable and data are correct without any error.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:ChassisCollection
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" chassis status 2>&1`
- 📤 產出人:
  log 取位:return `ipmitool chassis status`; user judges.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1959/2000 — `Wistron-BMC-00997-V002` · Items=Chassis · TestSet=Chassis (Power-Control)
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Chassis
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Criteria:
Redfish responds data are readable and data are correct without any error.sm
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Chassis
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" chassis status 2>&1`
- 📤 產出人:
  log 取位:return `ipmitool chassis status`; user judges.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1960/2000 — `Wistron-BMC-00998-V002` · Items=Power Cycle · TestSet=Chassis (Power-Control)
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:Power Cycle
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Criteria:
1. Redfish responds data are readable and data are correct without any error.
2. SUT should be ForceRestart.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Power Cycle
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- Power Cycle (Redfish ComputerSystem.Reset ResetType=PowerCycle): POST the reset from the agent host, then read back the power state.`
  `curl -s -k -u "$BMC_USER:$BMC_PASS" -H "Content-Type: application/json" -X POST -d '{"ResetType":"PowerCycle"}' https://$BMC_IP/redfish/v1/Systems/system 2>&1`
  `sleep 60`
  `curl -s -k -u "$BMC_USER:$BMC_PASS" https://$BMC_IP/redfish/v1/Systems/system 2>&1 | jq .PowerState`
  `-- state-changing: the host reboots (R22 risk); the operator approves the power cycle before the agent runs it.`
- 📤 產出人:
  log 取位:none.
  risk:RISK: chassis-related write - user request only.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️      缺陷**:FAKE(「not directly runnable / give exact bytes」實為可跑 → 真 Redfish/命令);已修 xlsx

---

### 1961/2000 — `Wistron-BMC-00999-V002` · Items=Power State · TestSet=Power
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Power State
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Criteria:
Redfish responds data are readable and data are correct without any error.
- Q6 補什麼:curl + ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Power State
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "curl -s -k -u $BMC_USER:$BMC_PASS https://$BMC_IP/redfish/v1/Systems/system 2>&1 | grep -i powerstate; echo ---CROSS`
- 📤 產出人:
  log 取位:return the Redfish PowerState + the IPMI `power status -C 17` result together so the user cross-checks both OOB channels report the same, co
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1962/2000 — `Wistron-BMC-01000-V002` · Items=Log Service Collection · TestSet=Manager
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Log Service Collection
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Criteria:
Redfish responds data are readable and data are correct without any error.
- Q6 補什麼:curl + jq (on agent host)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Log Service Collection
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `curl -s -k -u "$BMC_USER:$BMC_PASS" -H "Content-Type: application/json" -X GET https://$BMC_IP/redfish/v1/Managers/$MANAGER/LogServices | jq`
- 📤 產出人:
  log 取位:return FULL pretty-printed (/redfish/v1/Managers/$MANAGER/LogServices) JSON so user can read/diff Log Service Collection data. No RISK (read
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1963/2000 — `Wistron-BMC-01001-V002` · Items=Log Entry · TestSet=Manager
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Log Entry
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Criteria:
Redfish responds data are readable and data are correct without any error.
- Q6 補什麼:curl + jq (on agent host)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Log Entry
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `curl -s -k -u "$BMC_USER:$BMC_PASS" -H "Content-Type: application/json" -X GET https://$BMC_IP/redfish/v1/Managers/$MANAGER/LogServices/$LOGS/Entries/$ENTRY | jq`
- 📤 產出人:
  log 取位:return FULL pretty-printed (/redfish/v1/Managers/$MANAGER/LogServices/$LOGS/Entries/$ENTRY) JSON so user can read/diff Log Entry data. No RI
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1964/2000 — `Wistron-BMC-01002-V002` · Items=Get TaskService · TestSet=TaskService
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Get TaskService
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Criteria:
1. Redfish responds data are readable and data are correct without any error.
- Q6 補什麼:curl + jq + BMC creds
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Get TaskService
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- Get TaskService: GET /redfish/v1/TaskService (+ the current Tasks list) from the agent host.`
  `curl -s -k -u "$BMC_USER:$BMC_PASS" https://$BMC_IP/redfish/v1/TaskService 2>&1 | jq .`
  `curl -s -k -u "$BMC_USER:$BMC_PASS" https://$BMC_IP/redfish/v1/TaskService/Tasks 2>&1 | jq .`
- 📤 產出人:
  log 取位:return the TaskService JSON + Tasks member list so the user confirms the task service is enabled and tasks are exposed.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️      缺陷**:R5(OOB ipmitool/Redfish 誤包 DUT-ssh → 移 agent-host);已修 xlsx

---

### 1965/2000 — `Wistron-BMC-01003-V002` · Items=Get CertificateService · TestSet=CertificateService
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Get CertificateService
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Criteria:
Redfish responds data are readable and data are correct without any error.
- Q6 補什麼:curl + jq + BMC creds
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Get CertificateService
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- Get CertificateService: GET /redfish/v1/CertificateService (+ its Actions) from the agent host.`
  `curl -s -k -u "$BMC_USER:$BMC_PASS" https://$BMC_IP/redfish/v1/CertificateService 2>&1 | jq .`
- 📤 產出人:
  log 取位:return the CertificateService JSON + its Actions so the user confirms the certificate service actions (GenerateCSR etc.) are exposed.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️      缺陷**:R5(OOB ipmitool/Redfish 誤包 DUT-ssh → 移 agent-host);已修 xlsx

---

### 1966/2000 — `Wistron-BMC-01004-V002` · Items=Get Redfish EthernetInterfaceCollection · TestSet=Manager
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Get Redfish EthernetInterfaceCollection
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Criteria:
Redfish responds data are readable and data are correct without any error.
- Q6 補什麼:curl + jq (on agent host)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Get Redfish EthernetInterfaceCollection
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `curl -s -k -u "$BMC_USER:$BMC_PASS" -H "Content-Type: application/json" -X GET https://$BMC_IP/redfish/v1/Managers/$MANAGER/EthernetInterfaces | jq`
- 📤 產出人:
  log 取位:return FULL pretty-printed (/redfish/v1/Managers/$MANAGER/EthernetInterfaces) JSON so user can read/diff Get Redfish EthernetInterfaceCollec
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1967/2000 — `Wistron-BMC-01005-V002` · Items=Get redfish BMC Cold-Reset · TestSet=ForceRestart
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Get redfish BMC Cold-Reset
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Criteria:
1. Redfish responds data are readable and data are correct without any error.
2. BMC should be reset successfully.
3. BMC network should be disconnected one time during cold reset.
- Q6 補什麼:curl + jq + BMC creds
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Get redfish BMC Cold-Reset
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- Get Redfish BMC Cold-Reset (ResetType ForceRestart): read the Manager ResetActionInfo from the agent host.`
  `curl -s -k -u "$BMC_USER:$BMC_PASS" https://$BMC_IP/redfish/v1/Managers/$MANAGER/ResetActionInfo 2>&1 | jq .`
- 📤 產出人:
  log 取位:return the ResetActionInfo JSON so the user confirms the BMC reset action/parameters are exposed by Redfish.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️      缺陷**:R5(OOB ipmitool/Redfish 誤包 DUT-ssh → 移 agent-host);已修 xlsx

---

### 1968/2000 — `Wistron-BMC-01006-V002` · Items=Get Redfish GPU · TestSet=Hardware Status-GPU
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:Get Redfish GPU
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Criteria:
Redfish responds data are readable and data are correct without any error.
- Q6 補什麼:curl + jq + BMC creds
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Get Redfish GPU
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- Get Redfish GPU: read the OEM GPU Sensor/Power/FirmwareVersion from the agent host (OEM path per the vendor RestAPI spec).`
  `curl -s -k -u "$BMC_USER:$BMC_PASS" https://$BMC_IP/redfish/v1/Managers/$MANAGER/Oem/OemManagement/GPU/Sensor 2>&1 | jq .`
  `curl -s -k -u "$BMC_USER:$BMC_PASS" https://$BMC_IP/redfish/v1/Managers/$MANAGER/Oem/OemManagement/GPU/Power 2>&1 | jq .`
  `curl -s -k -u "$BMC_USER:$BMC_PASS" https://$BMC_IP/redfish/v1/Managers/$MANAGER/Oem/OemManagement/GPU/FirmwareVersion 2>&1 | jq .`
- 📤 產出人:
  log 取位:return the GPU Redfish status/processor JSON so the user confirms GPU health state is reported.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️      缺陷**:R5(OOB ipmitool/Redfish 誤包 DUT-ssh → 移 agent-host);已修 xlsx

---

### 1969/2000 — `Wistron-BMC-01007-V002` · Items=SEL log full · TestSet=IPMI Management Commands
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:SEL log full
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:ipmi command can execute normally.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:SEL log full
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sel info 2>&1`
- 📤 產出人:
  log 取位:return `ipmitool sel info` (entries/free); user checks if full.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1970/2000 — `Wistron-AMD SVM-00138-V004` · Items=PCIe Receiver Margin Search Test · TestSet=PCIe Link Margining
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:PCIe Receiver Margin Search Test
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:• PASS = 
– Result csv file contains number of rows equal to the number of lanes tested. Example: Testing 8 OAMs, there should be 8 OAMs x16 links = 128 row of results.
- The following column value is higher or equal to criteria:
a. Total Phase (UI)
b. Total Volt (volt)
c. Margin Left (ui)
d. Margin Right (ui)
e. Margin Top (volt)
f. Margin Bottom (volt)
- No PCIe downtrain occur
- Q6 補什麼:PCIe protocol analyzer / margining tool (physical hardware)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:PCIe Receiver Margin Search Test
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 1971/2000 — `Wistron-AMD SVM-00139-V004` · Items=PCIe Retimer Upstream/Downstream Receiver Margin Test · TestSet=PCIe Link Margining
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:PCIe Retimer Upstream/Downstream Receiver Margin Test
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:• PASS = 
– Result csv file contains number of rows equal to the number of lanes tested. Example: Testing 8 OAMs, there should be 8 OAMs x16 links = 128 row of results.
- Q6 補什麼:PCIe protocol analyzer / margining tool (physical hardware)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:PCIe Retimer Upstream/Downstream Receiver Margin Test
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 1972/2000 — `Wistron-AMD SVM-00140-V003` · Items=XGMI Receiver Margin Search Test · TestSet=XGMI Link Marging
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:XGMI Receiver Margin Search Test
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:The csv file that is generated contains the following columns of information.
– Total Phase (UI)
– Total Volt (volt)
– Margin Left (ui)
– Margin Right (ui)
– Margin Left (ui)
– Margin Right (ui)
Use the following criteria to determine the outcome of the test:
• PASS = 
- Result csv file (xgmi_4PT_margin_all*.csv) contains number of rows equal to the number of lanes
tested. Example: Testing 2 x16 links, uses total 32 lanes. Resulting output file will have 32 rows of data.
- Every cell in above mentioned columns contains non-zero value.
• FAIL = 
- A value of zero ("0") is observed in any of above columns. This indicates that the lane did not
meet the screening criteria (step value).
- Result csv file (xgmi_4PT_margin_all*.csv) contains number of rows that is less than number of lanes
tested. Example: Testing 2 x16 links, uses total 32 lanes. Resulting output file will have 32 rows of
data
- Q6 補什麼:amdxio (AMD GPU tool - user-provided)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:XGMI Receiver Margin Search Test
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- XGMI Receiver Margin Search Test: XGMI receiver margin search via amdxio. Agent runs the link-status check then the margin search sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $D`
- 📤 產出人:
  log 取位:return the amdxio linkstatus + margin search output and the generated xgmi_4PT_margin_all*.csv (rows = lanes tested) so the user judges PASS
  risk:RISK: XGMI margining drives the GPU interconnect at the receiver edge; run in a maintenance window and do not co-run other GPU load.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1973/2000 — `Wistron-AMD SVM-00038-V003` · Items=AMDGPURAS Query Error Count · TestSet=RAS
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:AMDGPURAS Query Error Count
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:N/A, Only check the error count.
- Q6 補什麼:AMDGPU-RAS tool (amdgpuras)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:AMDGPURAS Query Error Count
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- AMDGPURAS Query Error Count: query per-block error counts via amdgpuras sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "for b in 0 1 2 3 7; do amdgpuras -b $b -q`
- 📤 產出人:
  log 取位:return the per-block error-count query output for the user to confirm the recorded counts. Read-only after injection - no additional RISK be
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1974/2000 — `Wistron-AMD SVM-00039-V003` · Items=Bad Page Persistent · TestSet=RAS
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:Bad Page Persistent
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:• PASS = 
- AMDGPURAS tool GFX error injection command returns Bus error.
- Redfish command for CPER index retrieval shows the CPER index is increased and new CPER file is generated upon the error injected.
- The decoded result from the decoded CPER log matches the injected error type and location.
• Error location lists the OAM on which the error occurred.
• Bank matches the type of error injected: UMC.
• Errorcode ext is 0 and Errocode ext Type is On-die ECC.
• Error severity matches the type of error injected: Deferred error.
• Bank matches the type of error injected: GC.
• Errorcode ext is 62 and Errocode ext Type is GfxGcError.
• Error severity matches the type of error injected: Uncorrected Error. Poison
has been consumed.
- The list of retired bad page addresses remains the same as the list prior to AC cycle.
- The inband CPER log matches the OAM devices and error severity level
- Q6 補什麼:AMDGPU-RAS tool (amdgpuras) + Redfish CPER access
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Bad Page Persistent
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- Bad Page Persistent (bad-page persistent): clear RAS EEPROM, load amdgpuras, inject a GFX error, verify the bad page persists across reset via the CPER/EEPROM record.`
- 📤 產出人:
  log 取位:return the injection result + CPER index + persistent page record so the user confirms the bad page is retained across power cycles.
  risk:RISK: injecting a hardware/CPU error can disrupt the SUT and may need a reboot/recovery; run only on a dedicated SUT with the exact injectio
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1975/2000 — `Wistron-HW-00472-V002` · Items=Console Test · TestSet=Comport
- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 給變數/在場)`

**8 問**:
- Q1 測什麼:Console Test
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:1. Console should be set successfully.
2. Terminal should have correct output when connecting via COM port.
- Q6 補什麼:NVIDIA PCIe qualification toolchain (LTSSM) + operator setup
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Console Test
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `-- Console Test (set the console through the COM port): the agent points the BMC serial console / SOL and reads the console stream; the physical COM-port wiring + a client terminal is the op`
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sol info 2>&1`
  `-- operator: connect the SUT COM port to a client terminal, send a command, confirm correct output (the agent cannot wire the COM link).`
- 📤 產出人:
  log 取位:return the 10000x Tx-eq redo run log + `lspci -vvv LnkSta`/dmesg sweep; user confirms link trains with no errors. Very long - confirm approv
  risk:RISK: repeated Tx equalization redos stress the PCIe link; dedicated SUT + approval.
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`有前置(需 operator 給變數/在場)` / operator slot=`見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`
**⚠️      缺陷**:WR(命令內容/感測器名稱與 Items 不符 → 依 Items/procedure 重寫);已修 xlsx

---

### 1976/2000 — `Wistron-HW-00473-V002` · Items=Serial Port mechanical check · TestSet=Comport
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:Serial Port mechanical check
- Q2 位置:不執行(見說明)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Make sure the cable can plug/unplug without any problem.
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Serial Port mechanical check
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 1977/2000 — `Wistron-HW-00474-V002` · Items=Communication check · TestSet=Comport
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:Communication check
- Q2 位置:DUT host(ssh 穿透)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Make sure the communcation work normally.
- Q6 補什麼:serial cable + client terminal (operator)
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Communication check
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---

### 1978/2000 — `Wistron-BMC-01008-V002` · Items=FAN1~N_PWM · TestSet=Sensor Page
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:FAN1~N_PWM
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Sensor Reading & Threshold is human reable and match with spec.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:FAN1~N_PWM
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'FAN1~N_PWM' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `FAN1~N_PWM`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1979/2000 — `Wistron-BMC-01009-V002` · Items=FAN1~N_TACH_INLET · TestSet=Sensor Page
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:FAN1~N_TACH_INLET
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Sensor Reading & Threshold is human reable and match with spec.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:FAN1~N_TACH_INLET
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'FAN1~N_TACH_INLET' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `FAN1~N_TACH_INLET`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1980/2000 — `Wistron-BMC-01010-V002` · Items=FAN1~N_TACH_OUTLET · TestSet=Sensor Page
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:FAN1~N_TACH_OUTLET
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Sensor Reading & Threshold is human reable and match with spec.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:FAN1~N_TACH_OUTLET
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'FAN1~N_TACH_OUTLET' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `FAN1~N_TACH_OUTLET`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1981/2000 — `Wistron-BMC-01011-V002` · Items=CPU0~N_PKG_W · TestSet=Sensor Page
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:CPU0~N_PKG_W
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Sensor Reading & Threshold is human reable and match with spec.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:CPU0~N_PKG_W
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'CPU0~N_PKG_W' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `CPU0~N_PKG_W`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1982/2000 — `Wistron-BMC-01012-V002` · Items=CPU0~N_PWR_Cap · TestSet=Sensor Page
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:CPU0~N_PWR_Cap
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Sensor Reading & Threshold is human reable and match with spec.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:CPU0~N_PWR_Cap
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'CPU0~N_PWR_Cap' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `CPU0~N_PWR_Cap`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1983/2000 — `Wistron-BMC-01013-V002` · Items=POWER DIMM Zone1~N · TestSet=Sensor Page
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:POWER DIMM Zone1~N
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Sensor Reading & Threshold is human reable and match with spec.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:POWER DIMM Zone1~N
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'POWER DIMM Zone1~N' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `POWER DIMM Zone1~N`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1984/2000 — `Wistron-BMC-01014-V002` · Items=PSU1~N_Input_W · TestSet=Sensor Page
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:PSU1~N_Input_W
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Sensor Reading & Threshold is human reable and match with spec.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:PSU1~N_Input_W
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'PSU1~N_Input_W' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `PSU1~N_Input_W`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1985/2000 — `Wistron-BMC-01015-V002` · Items=PSU1~N_Output_W · TestSet=Sensor Page
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:PSU1~N_Output_W
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Sensor Reading & Threshold is human reable and match with spec.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:PSU1~N_Output_W
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'PSU1~N_Output_W' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `PSU1~N_Output_W`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1986/2000 — `Wistron-BMC-01016-V002` · Items=HIB_SW_1~N_ODTEMP · TestSet=Sensor Page
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:HIB_SW_1~N_ODTEMP
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Sensor Reading & Threshold is human reable and match with spec.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:HIB_SW_1~N_ODTEMP
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'HIB_SW_1~N_ODTEMP' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `HIB_SW_1~N_ODTEMP`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1987/2000 — `Wistron-BMC-01017-V002` · Items=PSU_1~N_Temperature · TestSet=Sensor Page
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:PSU_1~N_Temperature
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Sensor Reading & Threshold is human reable and match with spec.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:PSU_1~N_Temperature
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'PSU_1~N_Temperature' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `PSU_1~N_Temperature`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1988/2000 — `Wistron-BMC-01018-V002` · Items=TEMP1_HIB_VR1~N · TestSet=Sensor Page
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:TEMP1_HIB_VR1~N
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Sensor Reading & Threshold is human reable and match with spec.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:TEMP1_HIB_VR1~N
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'TEMP1_HIB_VR1~N' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `TEMP1_HIB_VR1~N`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1989/2000 — `Wistron-BMC-01019-V002` · Items=TEMP2_HIB_VR1~N · TestSet=Sensor Page
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:TEMP2_HIB_VR1~N
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Sensor Reading & Threshold is human reable and match with spec.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:TEMP2_HIB_VR1~N
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'TEMP2_HIB_VR1~N' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `TEMP2_HIB_VR1~N`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1990/2000 — `Wistron-BMC-01020-V002` · Items=TEMP_NVME_B1~N · TestSet=Sensor Page
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:TEMP_NVME_B1~N
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Sensor Reading & Threshold is human reable and match with spec.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:TEMP_NVME_B1~N
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'TEMP_NVME_B1~N' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `TEMP_NVME_B1~N`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1991/2000 — `Wistron-BMC-01021-V002` · Items=TEMP_NVME_N1~N · TestSet=Sensor Page
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:TEMP_NVME_N1~N
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Sensor Reading & Threshold is human reable and match with spec.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:TEMP_NVME_N1~N
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'TEMP_NVME_N1~N' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `TEMP_NVME_N1~N`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1992/2000 — `Wistron-BMC-01022-V002` · Items=TEMP_NV_NIC_EW1~N · TestSet=Sensor Page
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:TEMP_NV_NIC_EW1~N
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Sensor Reading & Threshold is human reable and match with spec.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:TEMP_NV_NIC_EW1~N
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'TEMP_NV_NIC_EW1~N' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `TEMP_NV_NIC_EW1~N`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1993/2000 — `Wistron-BMC-01023-V002` · Items=TEMP_NV_NIC_NS1~N · TestSet=Sensor Page
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:TEMP_NV_NIC_NS1~N
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Sensor Reading & Threshold is human reable and match with spec.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:TEMP_NV_NIC_NS1~N
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'TEMP_NV_NIC_NS1~N' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `TEMP_NV_NIC_NS1~N`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1994/2000 — `Wistron-BMC-01024-V002` · Items=TEMP_HIB_1~N · TestSet=Sensor Page
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:TEMP_HIB_1~N
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Sensor Reading & Threshold is human reable and match with spec.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:TEMP_HIB_1~N
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'TEMP_HIB_1~N' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `TEMP_HIB_1~N`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1995/2000 — `Wistron-BMC-01025-V002` · Items=PVDD11_S3_P0~N_C · TestSet=Sensor Page
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:PVDD11_S3_P0~N_C
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Sensor Reading & Threshold is human reable and match with spec.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:PVDD11_S3_P0~N_C
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'PVDD11_S3_P0~N_C' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `PVDD11_S3_P0~N_C`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1996/2000 — `Wistron-BMC-01026-V002` · Items=PVDDCR_CPU0_P0~N_C · TestSet=Sensor Page
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:PVDDCR_CPU0_P0~N_C
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Sensor Reading & Threshold is human reable and match with spec.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:PVDDCR_CPU0_P0~N_C
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'PVDDCR_CPU0_P0~N_C' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `PVDDCR_CPU0_P0~N_C`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1997/2000 — `Wistron-BMC-01027-V002` · Items=PVDDCR_CPU1_P0~N_C · TestSet=Sensor Page
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:PVDDCR_CPU1_P0~N_C
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Sensor Reading & Threshold is human reable and match with spec.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:PVDDCR_CPU1_P0~N_C
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'PVDDCR_CPU1_P0~N_C' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `PVDDCR_CPU1_P0~N_C`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1998/2000 — `Wistron-BMC-01028-V002` · Items=PVDDCR_SOC_P0~N_C · TestSet=Sensor Page
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:PVDDCR_SOC_P0~N_C
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Sensor Reading & Threshold is human reable and match with spec.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:PVDDCR_SOC_P0~N_C
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'PVDDCR_SOC_P0~N_C' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `PVDDCR_SOC_P0~N_C`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 1999/2000 — `Wistron-BMC-01029-V002` · Items=PVDDIO_P0~N_C · TestSet=Sensor Page
- **ai_can_execute(現行)** = `YES` | **verdict(§二十一)= YES** | exec 模式 = `agent 直跑(一次給完後自跑)`

**8 問**:
- Q1 測什麼:PVDDIO_P0~N_C
- Q2 位置:agent-host(OOB/BMC)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:Sensor Reading & Threshold is human reable and match with spec.
- Q6 補什麼:ipmitool
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:PVDDIO_P0~N_C
- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP
- ▶ 指令(現行)
  `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" sensor get 'PVDDIO_P0~N_C' 2>&1`
- 📤 產出人:
  log 取位:return FULL raw `sensor get` value + units + status for sensor `PVDDIO_P0~N_C`; user checks value in range & state.
  risk:
- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)

**§十八 h 三項**:執行模式=`agent 直跑(一次給完後自跑)` / operator slot=`見 `${...:?}` 變數` / 邏輯 sanity=`L1 靜態審;命令存在,引號/位置待實跑前再驗`

---

### 2000/2000 — `Wistron-HW-00001-V002` · Items=Switch Board · TestSet=Mechanical -System
- **ai_can_execute(現行)** = `NO` | **verdict(§二十一)= NO** | exec 模式 = `不執行/物理(agent 不跑)`

**8 問**:
- Q1 測什麼:Switch Board
- Q2 位置:不執行(見說明)
- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)
- Q4 時機:單次
- Q5 看什麼:All components should be seated properly
- Q6 補什麼:none
- Q7 回報:R36(agent 陳述事實,operator 判)
- Q8 邊界:見 🚧

**5 段**:
- 🎯 目的:Switch Board
- 📥 變數:無(物理/說明性動作 operator 執行)
- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)
- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)
- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包

**§十八 h 三項**:執行模式=`不執行/物理(agent 不跑)` / operator slot=`無(operator 現場執行)` / 邏輯 sanity=`說明性/物理,agent 不產生測試證據(§十九 q)`

---
