# Generate the round-02 report block for the final window of the Functionality sheet
# (Functionality rows 2203-2292, items 2201-2290) -> review_round_02_body12.md
# Pure ASCII Python source; CJK only in the markdown body string constants.
import json

rows = json.load(open('/tmp/rows2203_2292.json'))

FIXED_CMD = {2203, 2209, 2228, 2230, 2241, 2259, 2272, 2273, 2277, 2279, 2287, 2290, 2291}
VERDICT_CHANGED = {2241: 'PARTIAL', 2272: 'YES'}   # YES->PARTIAL (state-changing auth toggle) / PARTIAL->YES (OOB sensor get)

FIX_CLASS = {
 'R5':       [2228, 2230, 2279],
 'Q-LIT':    [2259],
 'WR':       [2203, 2209, 2241, 2273, 2277, 2287, 2290, 2291],
 'FAKE':     [2272],
}
CLASS_DESC = {
 'WR':      'WR(命令內容與 Items/Procedure 不符 → 依 procedure 重寫);已修 xlsx',
 'Q-LIT':   'Q-LIT(ssh 內層裸雙引號 → 單引號);已修 xlsx',
 'R5':      'R5(OOB/`ipmitool -I lanplus` 誤經 DUT-ssh 雙跳 → agent-host 直連);已修 xlsx',
 'FAKE':    'FAKE(「not directly runnable / give exact bytes」實為可跑的 OOB sensor get → 真命令);已修 xlsx',
}
# rows with both Q-LIT and R5 aspects
DUAL = {2230: 'Q-LIT+R5', 2279: 'Q-LIT+R5'}

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
    if rn in DUAL:
        note.append('Q-LIT+%s(內層引號 + OOB 雙跳 → agent-host);已修 xlsx' % ('R5' if DUAL[rn].endswith('R5') else ''))
    elif cls:
        note.append(CLASS_DESC[cls])
    if rn in VERDICT_CHANGED:
        if rn == 2241:
            note.append('判定改 col13 YES→PARTIAL(完整流程含 Disable HTTPBasicAuth 狀態寫入 + factory reset,需 operator 批准)')
        else:
            note.append('判定改 col13 PARTIAL→YES(OOB 只讀 sensor get,同區 1891 已是 YES);pkg 維持 ipmitool')

    out = []
    out.append(f"### {item_no}/2290 — `{code}` · Items={items} · TestSet={ts}")
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
        out.append(f"**⚠️       缺陷**:{' ; '.join(note)}")
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

# cumulative (from batch11: 1-2200 NO 385 / PARTIAL 771 / YES 876 / UNRESOLVED 168)
cNO  = 385 + nNO
cPAR = 771 + nPAR
cYES = 876 + nYES
cUNR = 168 + nUNR
assert cNO + cPAR + cYES + cUNR == 2290, (cNO, cPAR, cYES, cUNR)

head = []
head.append("## 批次說明(第 2201–2290 條組成 — Functionality 表最終視窗)")
head.append("")
head.append("| 區段 | 約 row | 類型 | 主判定 |")
head.append("|---|---|---|---|")
head.append("| USB Hubs/Device(MCU) USB2/3 + DPoC KVM Screen(KVM 無/有 hub) | 2203–2206 | 實體/USB 列舉 + 目視 | PARTIAL/NO(1 TBD) |")
head.append("| PCIe BW stress + DC/AC/WR Cycle Speed&Link | 2207–2210 | DUT 讀 + operator cycle | PARTIAL(1 TBD) |")
head.append("| Operations Factory Default/Preserve + BMC Web 2FA | 2211–2213 | Redfish POST + Web | PARTIAL |")
head.append("| NVMe E1.S LED Check(power/read-write/ready-to-remove) | 2214–2216 | DUT 讀+operator 目視 | YES |")
head.append("| L10 PSU LED + Flyboy-BMC sanity(GPU/BIOS Debug Data/KVM/lsusb/ncsi-cmd/Redfish/D-Bus/busctl) | 2217–2257 | BMC console/Redfish 只讀 + web 前置 | YES/PARTIAL 混合 |")
head.append("| Security mode + Install OS + Version Check + Clear CMOS + L10 LED + Panel/Jumper/Mechanical | 2258–2271 | BIOS/物理/目視 | NO/PARTIAL |")
head.append("| IPM Sensor List(TEMP_HIB_PEX)+ MLPerf Retinanet + Sensor Check PDB + Leaking + FW pkg Release note | 2272–2277 | OOB sensor get / vendor MLPerf / 目視 | YES/NO(FAKE 判改 2272) |")
head.append("| BMC Validation(FW Update/Recovery/Reject downgrade/corrupt)+ Reboot BMC | 2278–2282 | BMC flash 前置 | PARTIAL |")
head.append("| Information/Jumper(I2C/I3C TBD 行)+ Thermal stress + GB Field RMA/Mfgdiag | 2283–2292 | 物理/目視 + vendor diag | NO/PARTIAL(3 TBD→UNRESOLVED) |")
head.append("")
head.append("## 第 2201–2290 條 review 統計")
head.append("")
head.append("**verdict(§二十一 鎖版)分布(本批 90 條)**:")
head.append("| verdict | 條數 | 說明 |")
head.append("|---|---|---|")
head.append(f"| NO/PHYSICAL | {nNO} | 目視(Mechanical/AVL/Jumper/PSU LED/Release note)+ 物理(AC/DC cycle、按鈕、leak) |")
head.append(f"| PARTIAL | {nPAR} | 前置(BMC web/BIOS/install/fw update/i3c/thermal chamber/vendor diag + 2 判改之一 2241) |")
head.append(f"| YES | {nYES} | 純讀:sensor get/OOB ipmitool/只讀 ssh/Redfish GET + 2272 判改 |")
head.append(f"| UNRESOLVED | {nUNR} | 2203/2207/2290/2291/2292 Criteria/During-Test 即 TBD |")
head.append("")
head.append("**瑕疵統計(本批實際修進 xlsx)**:")
head.append("| class | 條數 | 對應編號(rows) |")
head.append("|---|---|---|")
head.append("| WR(命令內容/完整流程與 Items 不符 → 重寫) | 8 | 2203/2209/2241/2273/2277/2287/2290/2291 |")
head.append("| Q-LIT(ssh 內層裸雙引號 → 單引號) | 1 | 2259 |")
head.append("| R5(OOB/`lanplus` 誤經 DUT-ssh 雙跳 → agent-host 直連;含 2230/2279 內層引號) | 3 | 2228/2230/2279 |")
head.append("| FAKE(「not directly runnable」實為可跑 OOB sensor get) | 1 | 2272 |")
head.append("| VERDICT(col13 判改)+ PKG(col14 套件) | 2+6 | 2241 YES→PARTIAL、2272 PARTIAL→YES + pkg |")
head.append("")
head.append(f"> 多類在某 row 重疊,獨特 row = **{len(FIXED_CMD)}**;ai_commands col15 diff = 13 cells;ai_can_execute col13 = 2(2241/2272);ai_packages_needed col14 = 6。**全 Functionality.**(行內 row-2 = 條號:2203→2201 … 2292→2290)")
head.append("")
head.append("**🔄 累計(第 1–2290 條)**:")
head.append("| verdict | 條數 |")
head.append("|---|---|")
head.append(f"| NO/PHYSICAL | {cNO} |")
head.append(f"| PARTIAL | {cPAR} |")
head.append(f"| YES | {cYES} |")
head.append(f"| UNRESOLVED | {cUNR} |")
head.append(f"| 合計 | 2290 |")
head.append("")
head.append("**✅ 本批缺陷已實際修進 xlsx**:8 WR + 1 Q-LIT + 3 R5(含雙類)+ 1 FAKE + 2 判改(2241/2272)+ 6 pkg = **21 cells**(13 col15 + 2 col13 + 6 col14)。")
head.append("零回歸:對 bak_rev02_batch12 逐 cell 比對,Functionality diff = 恰 21 cells;5 其它 sheet 0 diff;cyrillic=0 / U+FFFD=0;git HEAD `5a60875` 未動;`data/tests.json` 未同步(等 operator)。")
head.append("")
head.append("**🏁 Functionality 表收官**:row 2–2292 / items 1–2290 全數 review 完;後續只剩 5 張其它 sheet 已於 W17–W24 完成,全庫 3112 條 L1 完成。")
head.append("")
head.append("---")
head.append("")
head.append("## 逐條 review(第 2201–2290 條)")
head.append("")

body = "\n".join(head)
for r in rows:
    body += "\n" + build_row_md(r)

open('review_round_02_body12.md', 'w').write(body)
print("wrote review_round_02_body12.md entries:", len(rows))
print("verdicts: NO={NO} PARTIAL={PA} YES={YE} UNRESOLVED={UN} (sum={T})".format(
    NO=nNO, PA=nPAR, YE=nYES, UN=nUNR, T=nNO+nPAR+nYES+nUNR))
print("cumulative 1..2290: NO={n0} PARTIAL={pa} YES={ye} UNRESOLVED={un}".format(n0=cNO, pa=cPAR, ye=cYES, un=cUNR))
print("fixed rows (col15):", sorted(FIXED_CMD))
