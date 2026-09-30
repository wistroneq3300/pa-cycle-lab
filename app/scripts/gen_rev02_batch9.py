# Generate review_round_02_functionality.md body for the ninth 200 rows
# (Functionality rows 1603-1802, item 1601-1800).
# Pure ASCII in code; CJK only in markdown output. Uses /tmp/rows1603_1802.json (built by dump9.py).
import json

rows = json.load(open('/tmp/rows1603_1802.json'))

# rows fixed this batch (all ai_commands col15, keyed by ROW)
FIXED_CMD = {
1617,1628,1629,1630,1633,1635,1648,1650,1657,1659,1660,1668,1677,1678,1686,1687,1688,1689,
1693,1694,1695,1696,1697,1698,1699,1700,1701,1702,1703,1704,1732,1733,1735,1736,1737,1744,
1745,1759,1762,1765,1799,1800,1801,1802,
}
VERDICT_CHANGED = set()

CLASS = {
 'WR': 'WR(命令/感測器名稱與 Items 不符 → 依 procedure/Items 重寫);已修 xlsx',
 'WR+L': 'WR(命令內容與 Items 不符)+LED 物理/目視尾段;已修 xlsx',
 'Q-LIT': 'Q-LIT(ssh 內層引號破碎 → 內層改單引號);已修 xlsx',
 'Q-LIT+DBL-SSH': 'QLIT(內層引號)+DBL-SSH(嵌套 ssh 收斂單層);已修 xlsx',
 'FAKE': 'FAKE(「not directly runnable」實為可跑 → 真 bash IPMI/Redfish);已修 xlsx',
 'R5': 'R5(OOB ipmitool/curl 誤包 DUT-ssh → 移 agent-host);已修 xlsx',
 'WR+R5': 'WR(內容不符)+R5(OOB 誤包 ssh → agent-host);已修 xlsx',
}
FIX_CLASS = {
1617:'WR+L',1628:'WR',1629:'WR',1630:'WR',1633:'WR',1635:'WR',
1648:'Q-LIT+DBL-SSH',1650:'Q-LIT',1657:'WR',1659:'FAKE',1660:'FAKE',1668:'WR',
1677:'FAKE',1678:'WR',1686:'WR',1687:'FAKE',1688:'FAKE',1689:'FAKE',
1693:'WR',1694:'WR',1695:'WR',1696:'WR',1697:'WR',1698:'WR',1699:'WR',1700:'WR',
1701:'WR',1702:'WR',1703:'WR',1704:'WR',
1732:'Q-LIT',1733:'Q-LIT',1735:'Q-LIT',1736:'Q-LIT+DBL-SSH',1737:'FAKE',
1744:'R5',1745:'R5',1759:'Q-LIT',1762:'WR',1765:'R5',
1799:'Q-LIT',1800:'Q-LIT',1801:'Q-LIT',1802:'Q-LIT',
}

def verdict_and_note(d):
    cmd = str(d.get('ai_commands',''))
    ai = str(d.get('ai_can_execute',''))
    crit = str(d.get('Criteria',''))
    proc = str(d.get('Procedure',''))
    ver = ai.upper()
    note = []
    if 'TBD' in crit or 'TBD' in proc:
        ver = 'UNRESOLVED'
        note.append('§二十一 UNRESOLVED:Procedure/Criteria 在 workbook 即 TBD,8 問答不出')
    rn = d['_row']
    if rn in FIXED_CMD:
        note.append(CLASS[FIX_CLASS.get(rn,'WR')])
    if rn in VERDICT_CHANGED:
        note.append('判定已改')
    return ver, note

def locate(cmd):
    if cmd.lstrip().startswith('-- not runnable'):
        return '不執行(見說明)'
    if 'sshpass' in cmd:
        return 'DUT host(ssh 穿透)'
    if 'ipmitool -I lanplus' in cmd or 'curl' in cmd or 'BMC_IP' in cmd:
        return 'agent-host(OOB/BMC)'
    return 'DUT host(ssh 穿透)'

out = []
out.append("\n\n---\n\n## 逐條 review(第 1601–1800 條)\n")

for d in rows:
    code = d.get('Code','')
    ai = str(d.get('ai_can_execute',''))
    items = d.get('Items','')
    ts = d.get('Test Set','')
    pack = d.get('ai_packages_needed','')
    cmd = str(d.get('ai_commands',''))
    logs = d.get('ai_logs_output','')
    crit = d.get('Criteria','')
    risk = d.get('risk','')
    rn = d['_row']
    item_no = rn - 2
    notrun = cmd.lstrip().startswith('-- not runnable')
    ver, note = verdict_and_note(d)

    if ver == 'UNRESOLVED':
        loc0 = 'DUT host(ssh 穿透)'
        h_exec, h_slot, h_sane = "不確定(TBD 資料)", "無法判定", "資料 TBD;8 問答不出(鎖版 §二十 aa / §二十一)"
    elif notrun:
        loc0 = locate(cmd)
        h_exec, h_slot, h_sane = "不執行/物理(agent 不跑)", "無(operator 現場執行)", "說明性/物理,agent 不產生測試證據(§十九 q)"
    elif ai == 'NO':
        loc0 = locate(cmd)
        h_exec, h_slot, h_sane = "物理(agent 不跑)", "無(operator 現場執行)", "L1 靜態審;物理/目視,agent 無法觸發"
    elif ai == 'PARTIAL':
        loc0 = locate(cmd)
        h_exec, h_slot, h_sane = "有前置(需 operator 給變數/在場)", "見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判", "L1 靜態審;命令存在,引號/位置待實跑前再驗"
    else:
        loc0 = locate(cmd)
        h_exec, h_slot, h_sane = "agent 直跑(一次給完後自跑)", "見 `${...:?}` 變數", "L1 靜態審;命令存在,引號/位置待實跑前再驗"

    out.append(f"### {item_no}/1800 — `{code}` · Items={items} · TestSet={ts}")
    out.append(f"- **ai_can_execute(現行)** = `{ai}` | **verdict(§二十一)= {ver}** | exec 模式 = `{h_exec}`")
    out.append("")
    out.append("**8 問**:")
    out.append(f"- Q1 測什麼:{items}")
    out.append(f"- Q2 位置:{loc0}")
    out.append("- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)")
    out.append("- Q4 時機:單次")
    out.append(f"- Q5 看什麼:{crit}" if crit and 'TBD' not in crit else f"- Q5 看什麼:{items}")
    out.append(f"- Q6 補什麼:{pack}" if pack else "- Q6 補什麼:無額外套件")
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
    elif notrun or ai == 'NO':
        out.append("- 📥 變數:無(物理/說明性動作 operator 執行)")
        out.append("- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)")
        out.append("- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)")
        out.append("- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包")
    else:
        out.append("- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP")
        cmds = cmd.split('\n')
        out.append("- ▶ 指令(現行)")
        for cc in cmds[:16]:
            if cc.strip():
                out.append(f"  `{cc.strip()[:190]}`")
        out.append("- 📤 產出人:")
        out.append(f"  log 取位:{str(logs)[:140]}")
        out.append(f"  risk:{str(risk)[:140]}")
        out.append("- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)")
    out.append("")
    out.append(f"**§十八 h 三項**:執行模式=`{h_exec}` / operator slot=`{h_slot}` / 邏輯 sanity=`{h_sane}`")
    if note:
        out.append(f"**⚠️     缺陷**:{' ; '.join(note)}")
    out.append("")
    out.append("---")
    out.append("")

with open('review_round_02_body9.md', 'w') as f:
    f.write('\n'.join(out))
print('wrote review_round_02_body9.md, entries:', len(rows))
