# Generate the round-02 report block for the tenth 200 rows
# (Functionality rows 1803-2002, item 1801-2000) -> review_round_02_body10.md
# Pure ASCII Python source; CJK only in the markdown body string constants.
import json, re

rows = json.load(open('/tmp/rows1803_2002.json'))

FIXED_CMD = {1803,1804,1805,1806,1807,1808,1809,1812,1814,1843,1844,1845,1891,
             1918,1919,1955,1958,1962,1966,1967,1969,1970,1977}
VERDICT_CHANGED = {1843}   # NO -> YES (SF600 flash copy-error -> same read-only pattern as siblings 1844/1845)

FIX_CLASS = {
 'Q-LIT': [1803,1804,1805,1806,1807,1808,1809,1812,1814,1918,1919],
 'R5':    [1844,1845,1955,1966,1967,1969,1970],
 'WR':    [1843,1891,1958,1977],
 'FAKE':  [1962],
}
CLASS_DESC = {
 'WR':    'WR(命令內容/感測器名稱與 Items 不符 → 依 Items/procedure 重寫);已修 xlsx',
 'Q-LIT': 'Q-LIT(ssh 內層裸雙引號 → 單引號);已修 xlsx',
 'R5':    'R5(OOB ipmitool/Redfish 誤包 DUT-ssh → 移 agent-host);已修 xlsx',
 'FAKE':  'FAKE(「not directly runnable / give exact bytes」實為可跑 → 真 Redfish/命令);已修 xlsx',
}
def row_class(rn):
    for cls, lst in FIX_CLASS.items():
        if rn in lst: return cls
    return None

def verdict_of(row):
    """verdict after this batch (1843 changed NO->YES by the fix).

    UNRESOLVED only when the workbook leaves BOTH Criteria AND Procedure as literal 'TBD'
    (no actual test described). A 'TBD' that merely appears as a reference-note inside a
    fully-described criterion (e.g. 'NVIDIA Vera Rubin NVL72 System Validation Guide
    (NVOnline: TBD)') does NOT make the row UNRESOLVED -- the test itself is clear."""
    rn = row['_row']
    ai = str(row.get('ai_can_execute','')).strip()
    crit = (str(row.get('Criteria','')) or '').strip()
    proc = (str(row.get('Procedure','')) or '').strip()
    if rn in VERDICT_CHANGED:
        return 'YES'
    def literal_tbd(s): return s == '' or s.upper() in ('TBD', 'TBD.', 'TBD ')
    if literal_tbd(crit) or literal_tbd(proc):
        return 'UNRESOLVED'
    return ai.upper() if ai.upper() in ('YES','PARTIAL','NO') else 'UNRESOLVED'

def locate(cmd):
    cmd = str(cmd).lstrip()
    if cmd.startswith('-- not runnable'):
        return '不執行(見說明)'
    if 'sshpass' in cmd:
        return 'DUT host(ssh 穿透)'
    if 'ipmitool -I lanplus' in cmd or 'BMC_IP' in cmd:
        return 'agent-host(OOB/BMC)'
    if 'curl' in cmd:
        return 'agent-host(REDfish/curl)'
    return 'DUT host(ssh 穿透)'

def build_row_md(row):
    rn = row['_row']
    code = row.get('Code','')
    items = row.get('Items','')
    ts = row.get('Test Set','')
    pack = row.get('ai_packages_needed','') or ''
    cmd = str(row.get('ai_commands','')) or ''
    logs = row.get('ai_logs_output','') or ''
    crit = row.get('Criteria','') or ''
    risk = row.get('risk','') or ''
    ai_now = str(row.get('ai_can_execute','') or '').strip()
    item_no = rn - 2
    ver = verdict_of(row)
    notrun = cmd.lstrip().startswith('-- not runnable')
    fixed = rn in FIXED_CMD

    if ver == 'UNRESOLVED':
        h_exec, h_slot, h_sane = "不確定(TBD 資料)", "無法判定", "資料 TBD;8 問答不出(鎖版 §二十 aa / §二十一)"
    elif notrun or (ver == 'NO' and not fixed):
        h_exec, h_slot, h_sane = "不執行/物理(agent 不跑)", "無(operator 現場執行)", "說明性/物理,agent 不產生測試證據(§十九 q)"
    elif ver == 'PARTIAL':
        h_exec, h_slot, h_sane = "有前置(需 operator 給變數/在場)", "見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判", "L1 靜態審;命令存在,引號/位置待實跑前再驗"
    else:
        h_exec, h_slot, h_sane = "agent 直跑(一次給完後自跑)", "見 `${...:?}` 變數", "L1 靜態審;命令存在,引號/位置待實跑前再驗"

    note = []
    cls = row_class(rn)
    if cls:
        note.append(CLASS_DESC[cls])
    if rn in VERDICT_CHANGED:
        note.append('判定已改 NO→YES(col13);pkg col14 改為 ipmitool;同批 siblings 1844/1845 同類同判定')

    out = []
    out.append(f"### {item_no}/2000 — `{code}` · Items={items} · TestSet={ts}")
    out.append(f"- **ai_can_execute(現行)** = `{ai_now}` | **verdict(§二十一)= {ver}** | exec 模式 = `{h_exec}`")
    out.append("")
    out.append("**8 問**:")
    out.append(f"- Q1 測什麼:{items}")
    loc = '不執行(見說明)' if notrun else locate(cmd)
    out.append(f"- Q2 位置:{loc if ver != 'UNRESOLVED' else '無法判定(資料 TBD)'}")
    out.append("- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)")
    out.append("- Q4 時機:單次")
    out.append(f"- Q5 看什麼:{crit if crit and 'TBD' not in crit else items}")
    out.append(f"- Q6 補什麼:{pack if pack else '無額外套件'}")
    out.append("- Q7 回報:R36(agent 陳述事實,operator 判)")
    out.append("- Q8 邊界:見 🚧")
    out.append("")
    out.append("**5 段**:")
    out.append(f"- 🎯 目的:{items}")
    if ver == 'UNRESOLVED':
        out.append("- 📥 變數:無(Procedure/Criteria 即 TBD,無法推導)")
        out.append("- ▶ 指令:`--`(TBD,見 ai_commands)")
        out.append("- 📤 產出人:operator 於測試庫補 TBD 後重審,agent 未跑")
        out.append("- 🚧 判斷閘:UNRESOLVED,等 operator 補資料")
    elif notrun or ver == 'NO':
        out.append("- 📥 變數:無(物理/說明性動作 operator 執行)")
        out.append("- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)")
        out.append("- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)")
        out.append("- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包")
    else:
        out.append("- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP")
        out.append("- ▶ 指令(現行)")
        for cc in cmd.split('\n'):
            if cc.strip():
                out.append(f"  `{cc.strip()[:190]}`")
        out.append("- 📤 產出人:")
        out.append(f"  log 取位:{str(logs)[:140]}")
        out.append(f"  risk:{str(risk)[:140]}")
        out.append("- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)")
    out.append("")
    out.append(f"**§十八 h 三項**:執行模式=`{h_exec}` / operator slot=`{h_slot}` / 邏輯 sanity=`{h_sane}`")
    if note:
        out.append(f"**⚠️      缺陷**:{' ; '.join(note)}")
    out.append("")
    out.append("---")
    out.append("")
    return "\n".join(out)

# ---------- batch description + statistics (head section) ----------
# verdicts computed AFTER the 1843 fix (col13 is already updated in the row dict)
from collections import Counter
vd = Counter(verdict_of(r) for r in rows)
nNO    = vd.get('NO', 0)
nPAR   = vd.get('PARTIAL', 0)
nYES   = vd.get('YES', 0)
nUNR   = vd.get('UNRESOLVED', 0)

# cumulative (from batch9: 1-1800 NO 326 / PARTIAL 623 / YES 703 / UNRESOLVED 148)
cNO   = 326 + nNO
cPAR  = 623 + nPAR
cYES  = 703 + nYES
cUNR  = 148 + nUNR
assert cNO + cPAR + cYES + cUNR == 2000, (cNO,cPAR,cYES,cUNR)

head = []
head.append("## 批次說明(第 1801–2000 條組成)")
head.append("")
head.append("| 區段 | 約 row | 類型 | 主判定 |")
head.append("|---|---|---|---|")
head.append("| I2C 板卡 scan(FAN/PDB/HSC/RIO/FIO/Cable/M.2/E1S)+I3C CPU0/1(00005~00453) | 1803–1816 | DUT i2cdetect/i3cdetect | YES/PARTIAL |")
head.append("| I2C 板卡 TBD(MB/BMC/SW/NV_SW/PSU/FAN/PDB/HSC/RIO/FIO/Cable/M.2)+E1S LED 誤置 | 1810–1831 | TBD + 誤置 | NO(UNRESOLVED) |")
head.append("| TEMP_* Sensor List(BMC-00921~00944, UBB/GPU/LP/FH/DCSCM) | 1832–1855 | OOB sensor get | YES |")
head.append("| SW BD Sensor List(STATUS_UP/LOW/PSU,TEMP_GPU 0~N/0~N_Memory)+TEMP_*(00937~00944) | 1843–1855 | OOB ipmitool(3 FAKE/R5)+sensor get | YES/PARTIAL |")
head.append("| TEMP/PWR/SPD sensor 全量(00945~01007,FAN/PWR/TACH/PSU/UBB/GB/MB/OCP/CEM/NIC/DIMM) | 1856–1889 | OOB sensor get | YES |")
head.append("| L10 System LED(E1S/BF3/OSFP/系统 Fault/NVLink/Pwr/ID/BMC RJ45) | 1904–1914 | 物理/目視 LED | NO |")
head.append("| GB NV PVP SW(NVSSVT/NVRASTool/NVDebug)+Network(NT.1/NT.4 NVQual) | 1915–1919 | vendor tool | PARTIAL |")
head.append("| GB NV PVP HW(Storage E1.S Hot-swap/SY.4..SY.8 reboot stress/SY.9/SY.10/SY.11) | 1920–1931 | OOB 電源/物理 | PARTIAL/NO |")
head.append("| BIOS Sanity SMBIOS Type 11/12~45/38(00465~00490) | 1932–1949 | DUT dmidecode + grep(Q-LIT class) | YES |")
head.append("| POST & Hotkey + BMC WebUI(SEL/POST/Profile/Logout/ChassisCollection/Chassis/PowerCycle) | 1950–1965 | PARTIAL(WebUI)/OoB | PARTIAL/NO |")
head.append("| AMD SVM RAS(EINJState/BadPage*/GFX/PLDM UBB SMC) | 1955–1959 | Redfish/amdgpuras/pldmtool | PARTIAL |")
head.append("| TaskService/CertificateService/Manager Reset/Redfish GPU/SEL log full(01001~01007) | 1966–1971 | Redfish GET(OOB) | YES |")
head.append("| AMD SVM XGMI link/margin(00138/00139/00140/00038/00124)+PCIe margin | 1972–1976 | vendor tool | PARTIAL |")
head.append("| Comport Console/Serial mech/Communication | 1977–1979 | 物理 + 通訊 | NO |")
head.append("| Sensor Page 補集(FAN/PWR/PSU/TEMP HIB/VDD/PVDD 1~N) | 1980–2001 | OOB sensor get | YES |")
head.append("| Mechanical Switch Board | 2002 | 物理 | NO |")
head.append("")
head.append("## 第 1801–2000 條 review 統計")
head.append("")
head.append("**verdict(§二十一 鎖版)分布(本批 200 條)**:")
head.append("| verdict | 條數 | 說明 |")
head.append("|---|---|---|")
head.append(f"| NO/PHYSICAL | {nNO} | 目視(LED/comport)/物理(AC 100x、Tray hot-swap、E1.S 熱換、PCIe 量儀)+ TBD 板卡行 |")
head.append(f"| PARTIAL | {nPAR} | 前置(需 operator 給 NVQual/amdxio/pldmtool 等 vendor tool、WebUI 操作、100x stress 同意) |")
head.append(f"| YES | {nYES} | 純讀:sensor get/dmidecode/OoB ipmitool/Redfish GET |")
head.append(f"| UNRESOLVED | {nUNR} | Procedure/Criteria 在 workbook 即 TBD(I2C 板卡 TBD) |")
head.append("")
head.append("**瑕疵統計(本批實際修進 xlsx)**:")
head.append("| class | 條數 | 對應編號(rows) |")
head.append("|---|---|---|")
head.append("| Q-LIT(ssh 內層裸雙引號 → 單引號 / 去內層 echo) | 11 | 1803–1809/1812/1814/1918/1919 |")
head.append("| R5(OOB ipmitool/Redfish 誤包 DUT-ssh → 移 agent-host) | 7 | 1844/1845/1955/1966/1967/1969/1970 |")
head.append("| WR(命令內容/感測器名稱與 Items 不符 → 依 Items/procedure 重寫) | 4 | 1843/1891/1958/1977 |")
head.append("| FAKE(「not directly runnable / give exact bytes」實為可跑 Redfish) | 1 | 1962 |")
head.append("| VERDICT(col13 判定改) + PKG(col14 套件行) | 2 | 1843 NO→YES + SF600→ipmitool |")
head.append("")
head.append(f"> 多類在某 row 重疊,獨特 row = **{len(FIXED_CMD)}**;ai_commands col15 diff = 23 cells;ai_can_execute col13 = 1(1843);ai_packages_needed col14 = 1(1843)。**ai_commands 全 Functionality**.")
head.append("")
head.append("**🔄 累計(第 1–2000 條)**:")
head.append("| verdict | 條數 |")
head.append("|---|---|")
head.append(f"| NO/PHYSICAL | {cNO} |")
head.append(f"| PARTIAL | {cPAR} |")
head.append(f"| YES | {cYES} |")
head.append(f"| UNRESOLVED | {cUNR} |")
head.append(f"| 合計 | 2000 |")
head.append("")
head.append("**✅ 本批缺陷已實際修進 xlsx**:11 Q-LIT + 7 R5 + 4 WR + 1 FAKE + 1 判定改(1843 NO→YES) + 1 pkg(1843 SF600→ipmitool)= **25 cells**。")
head.append("零回歸:對 bak_rev02_batch10 逐 cell 比對,Functionality diff = 恰 25 cells(23 col15 + 1 col13 + 1 col14);5 其它 sheet 0 diff;cyrillic=0 / U+FFFD=0;git HEAD `5a60875` 未動;`data/tests.json` 未同步(等 operator)。")
head.append("")
head.append("---")
head.append("")
head.append("## 逐條 review(第 1801–2000 條)")
head.append("")

body = "\n".join(head)
for r in rows:
    body += "\n" + build_row_md(r)

open('review_round_02_body10.md','w').write(body)
print("wrote review_round_02_body10.md entries:", len(rows))
print("verdicts: NO={NO} PARTIAL={PA} YES={YE} UNRESOLVED={UN} (sum={T})".format(
    NO=nNO,PA=nPAR,YE=nYES,UN=nUNR,T=nNO+nPAR+nYES+nUNR))
print("cumulative 1..2000: NO={n0} PARTIAL={pa} YES={ye} UNRESOLVED={un}".format(n0=cNO,pa=cPAR,ye=cYES,un=cUNR))
print("fixed rows (col15):", sorted(FIXED_CMD))
