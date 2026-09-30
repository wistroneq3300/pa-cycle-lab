# Generate the round-02 report block for the eleventh 200 rows
# (Functionality rows 2003-2202, item 2001-2200) -> review_round_02_body11.md
# Pure ASCII Python source; CJK only in the markdown body string constants.
import json

rows = json.load(open('/tmp/rows2003_2202.json'))

FIXED_CMD = {2012, 2028, 2039, 2043, 2044, 2045, 2049, 2050, 2051, 2052, 2053,
             2054, 2055, 2066, 2092, 2105, 2123, 2125, 2149, 2151, 2154, 2155,
             2166, 2167, 2168, 2169, 2170, 2171, 2172, 2173, 2174, 2194, 2198,
             2199, 2200, 2201, 2202}
VERDICT_CHANGED = {2012: 'YES', 2039: 'YES'}   # PARTIAL/NO -> YES (read-only sensor get, sibling-consistent)

FIX_CLASS = {
 'Q-LIT':    [2049,2066,2105,2123,2125,2149,2151,2154,2155,2166,2167,2168,
              2169,2170,2171,2172,2173,2174,2194,2198,2199,2200,2201,2050,2051,2052,2053,2054,2055],
 'Q-LIT+DBL':[2043,2044],
 'R5':       [2092],
 'WR':       [2012,2028,2039,2045,2202],
}
CLASS_DESC = {
 'WR':        'WR(命令內容/感測器名稱與 Items 不符 → 依 Items/procedure 重寫);已修 xlsx',
 'Q-LIT':     'Q-LIT(ssh 內層裸雙引號 → 單引號 / 遠端迴圈變數 \$ 逸出);已修 xlsx',
 'Q-LIT+DBL': 'Q-LIT+DBL-SSH(內層引號 + 收斂雙層 sshpass-ssh 為一跳);已修 xlsx',
 'R5':        'R5(BMC shell 經 DUT 雙跳誤連 → 移 agent-host 直連 BMC);已修 xlsx',
}

def row_class(rn):
    for cls, lst in FIX_CLASS.items():
        if rn in lst:
            return cls
    return None

def verdict_of(row):
    rn = row['_row']
    ai = str(row.get('ai_can_execute', '')).strip()
    crit = (str(row.get('Criteria', '')) or '').strip()
    proc = (str(row.get('Procedure', '')) or '').strip()
    if rn in VERDICT_CHANGED:
        return VERDICT_CHANGED[rn]
    def literal_tbd(s):
        first = s.split('\n')[0].strip()
        return first == '' or first.upper() in ('TBD', 'TBD.', 'TBD ')
    if literal_tbd(crit) or literal_tbd(proc):
        return 'UNRESOLVED'
    return ai.upper() if ai.upper() in ('YES', 'PARTIAL', 'NO') else 'UNRESOLVED'

def locate(cmd):
    cmd = str(cmd).lstrip()
    if cmd.startswith('-- not runnable'):
        return '不執行(見說明)'
    if 'sshpass' in cmd and ('BMC_PASS' in cmd and 'BMC_USER' in cmd and 'BMC_IP' in cmd):
        return 'agent-host(BMC shell 直連)'
    if 'sshpass' in cmd:
        return 'DUT host(ssh 穿透)'
    if 'ipmitool -I lanplus' in cmd or 'BMC_IP' in cmd:
        return 'agent-host(OOB/BMC)'
    return 'DUT host(ssh 穿透)'

def build_row_md(row):
    rn = row['_row']
    code = row.get('Code', '')
    items = row.get('Items', '')
    ts = row.get('Test Set', '')
    pack = row.get('ai_packages_needed', '') or ''
    cmd = str(row.get('ai_commands', '')) or ''
    logs = row.get('ai_logs_output', '') or ''
    crit = row.get('Criteria', '') or ''
    risk = row.get('risk', '') or ''
    ai_now = str(row.get('ai_can_execute', '') or '').strip()
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
        note.append('判定已改 col13 %s→YES(col15 重寫為同類只讀 sensor get);pkg col14 改為 ipmitool' % ('NO' if rn == 2039 else 'PARTIAL'))

    out = []
    out.append(f"### {item_no}/2200 — `{code}` · Items={items} · TestSet={ts}")
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
from collections import Counter
vd = Counter(verdict_of(r) for r in rows)
nNO    = vd.get('NO', 0)
nPAR   = vd.get('PARTIAL', 0)
nYES   = vd.get('YES', 0)
nUNR   = vd.get('UNRESOLVED', 0)

# cumulative (from batch10: 1-2000 NO 351 / PARTIAL 651 / YES 835 / UNRESOLVED 163)
cNO  = 351 + nNO
cPAR = 651 + nPAR
cYES = 835 + nYES
cUNR = 163 + nUNR
assert cNO + cPAR + cYES + cUNR == 2200, (cNO, cPAR, cYES, cUNR)

head = []
head.append("## 批次說明(第 2001–2200 條組成)")
head.append("")
head.append("| 區段 | 約 row | 類型 | 主判定 |")
head.append("|---|---|---|---|")
head.append("| Mechanical System/AVL(DC-SCM/OSFP/Mellanox CX8/BF3/CX9/BF4)+SF600 flash | 2003–2009 | 物理/目視 | NO |")
head.append("| Sensor check 全量(MB/Proc/OSFP/PCIE/CX8/NM/RETIMER/PDB/HSC/TEMP/INTB/LAN/NIC/PCIE_SW/VOLT/AMP/CPU_DIMM/WATCHDOG/STATUS/PSU/POWER/GB/GPU...) | 2010–2040 | OOB sensor get | YES(2 判改) |")
head.append("| Storage M.2 FW flash(+/-)+BIOS C/P-state | 2041–2044 | 物理 flash / DUT 讀 | PARTIAL |")
head.append("| PCIe Switch FW flash(誤置 DC-Cycle 文字) | 2045 | DUT vendor tool | PARTIAL |")
head.append("| BMC remove Mgmt(UBB/OAM Telemetry/FW/Health/SMC/Log/Power,BMC VNIC 192.168.31.1) | 2050–2055 | DUT 側 Redfish | PARTIAL |")
head.append("| AMD System Stress(AMD-SMI/AGFHC PCIe/XGMI/HBM/GFX/miniHPL/maxPower)+GPU thermal/maxpower+reboot | 2056–2067 | DUT 只讀 + vendor tool | PARTIAL |")
head.append("| AMD RAS amdgpuras 全系 EINJ/UMC/GFX/XGMI/PCIe/SDMA poison/threshold | 2047/2070–2091 | DUT in-band 注入 | PARTIAL |")
head.append("| BMC Dimm usage(BMC shell 直連) | 2092 | agent-host→BMC | PARTIAL |")
head.append("| LC Tray Leak(小漏/自測/斷線)+Power EDPp | 2093–2098 | 物理 + OOB ipmitool | NO/PARTIAL |")
head.append("| GB NV PVP PCIe EOM/SpeedChange/LTSSM hot-reset | 2099–2122 | vendor NVQual/LTSSM | PARTIAL |")
head.append("| HGX NV PVP PCIe/NVLink/Storage/Networking(HGX EC.x/NT.x)+HMC/USB/SY/DG/SSVT/NVRAS/NVDebug | 2122–2156 | vendor tool | PARTIAL |")
head.append("| GB NV PVP I2C(IC.1~7)/SPI(SP.1~2)/UART(UA.1~3)/USB(US.1~6) | 2157–2175 | 物理+BMC/DUT 讀 | PARTIAL/NO |")
head.append("| BIOS default/Change default - Intel(Processor~APM) | 2176–2189 | 互動 BIOS | NO |")
head.append("| Mechanical AVL(CX9/BF4)+Vendor ID+PCIe Slot+Display+EGM | 2190–2197 | 物理/目視 + DUT 讀 | NO/PARTIAL |")
head.append("| MODS Test(CPUDVFS/Thermal/USB MCTP/NVMe)+Telemetry INA/OVRM | 2198–2202 | vendor MODS(OOB sensor 讀) | PARTIAL(5 TBD→UNRESOLVED) |")
head.append("")
head.append("## 第 2001–2200 條 review 統計")
head.append("")
head.append("**verdict(§二十一 鎖版)分布(本批 200 條)**:")
head.append("| verdict | 條數 | 說明 |")
head.append("|---|---|---|")
head.append(f"| NO/PHYSICAL | {nNO} | 目視(Mechanical/LED)/物理(SPI/UART/USB/LC leak)+ BIOS pre-OS 互動 |")
head.append(f"| PARTIAL | {nPAR} | 前置(NVQual/LTSSM/AGFHC/amdxio/amdsmi/MODS/NVSSVT/NVRAS/partnerdiag 等 vendor tool、BIOS 改、SMC reset 寫、BMC VNIC) |")
head.append(f"| YES | {nYES} | 純讀:sensor get/OOB ipmitool/只讀 ssh |")
head.append(f"| UNRESOLVED | {nUNR} | MODS Test + Telemetry INA/OVRM 5 行 Criteria/During-Test 即 TBD |")
head.append("")
head.append("**瑕疵統計(本批實際修進 xlsx)**:")
head.append("| class | 條數 | 對應編號(rows) |")
head.append("|---|---|---|")
head.append("| Q-LIT(ssh 內層雙引號 → 單引號 / 遠端迴圈變數逸出) | 29 | 2049/2066/2105/2123/2125/2149/2151/2154/2155/2166/2167/2168/2169–2174/2194/2198–2201 + BMC-VNIC 2050–2055 |")
head.append("| Q-LIT+DBL-SSH(收斂雙層 sshpass 為一跳) | 2 | 2043/2044 |")
head.append("| R5(BMC shell 誤經 DUT 雙跳 → agent-host 直連) | 1 | 2092 |")
head.append("| WR(sensor 名/命令內容與 Items 不符 → 重寫) | 5 | 2012/2028/2039/2045/2202 |")
head.append("| VERDICT(col13 判改) + PKG(col14 套件) | 2+2 | 2012 PARTIAL→YES、2039 NO→YES + pkg→ipmitool |")
head.append("")
head.append(f"> 多類在某 row 重疊,獨特 row = **{len(FIXED_CMD)}**;ai_commands col15 diff = 37 cells;ai_can_execute col13 = 2(2012/2039);ai_packages_needed col14 = 2(2012/2039)。**全 Functionality**.")
head.append("")
head.append("**🔄 累計(第 1–2200 條)**:")
head.append("| verdict | 條數 |")
head.append("|---|---|")
head.append(f"| NO/PHYSICAL | {cNO} |")
head.append(f"| PARTIAL | {cPAR} |")
head.append(f"| YES | {cYES} |")
head.append(f"| UNRESOLVED | {cUNR} |")
head.append(f"| 合計 | 2200 |")
head.append("")
head.append("**✅ 本批缺陷已實際修進 xlsx**:29 Q-LIT + 2 Q-LIT+DBL-SSH + 1 R5 + 5 WR + 2 判改(2012/2039)+ 2 pkg = **41 cells**(37 col15 + 2 col13 + 2 col14)。")
head.append("零回歸:對 bak_rev02_batch11 逐 cell 比對,Functionality diff = 恰 41 cells;5 其它 sheet 0 diff;cyrillic=0 / U+FFFD=0;git HEAD `5a60875` 未動;`data/tests.json` 未同步(等 operator)。")
head.append("")
head.append("---")
head.append("")
head.append("## 逐條 review(第 2001–2200 條)")
head.append("")

body = "\n".join(head)
for r in rows:
    body += "\n" + build_row_md(r)

open('review_round_02_body11.md', 'w').write(body)
print("wrote review_round_02_body11.md entries:", len(rows))
print("verdicts: NO={NO} PARTIAL={PA} YES={YE} UNRESOLVED={UN} (sum={T})".format(
    NO=nNO, PA=nPAR, YE=nYES, UN=nUNR, T=nNO+nPAR+nYES+nUNR))
print("cumulative 1..2200: NO={n0} PARTIAL={pa} YES={ye} UNRESOLVED={un}".format(n0=cNO, pa=cPAR, ye=cYES, un=cUNR))
print("fixed rows (col15):", sorted(FIXED_CMD))
