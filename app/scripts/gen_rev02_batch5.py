# Generate review_round_02_functionality.md body for fifth 200 rows (Functionality rows 803-1002, item 801-1000).
# Pure ASCII in code; CJK only in markdown output. Uses /tmp/rows803_1002.json.
import json, re

rows = json.load(open('/tmp/rows803_1002.json'))

# rows fixed in this batch, keyed by ROW number (matches fix_rev02_batch5.py FIX keys)
FIXED = {
833: 'C',
834: 'C',
814: 'D',
815: 'D',
987: 'D',
988: 'D',
990: 'D',
986: 'E',
992: 'E',
993: 'E',
994: 'E',
998: 'E',
999: 'E',
1000: 'E',
1001: 'E',
1002: 'E',
}

CLASSNAME = {
    'C': 'Q-LIT(grep 裸雙引號→單引號)',
    'D': 'R5(OOB ipmitool lanplus / Redfish curl 誤包 DUT-ssh → 移 agent-host)',
    'E': 'R29(DUT 內層 ipmitool 關鍵字缺失 / raw byte 錯 → 補 `sudo ipmitool`)',
}


def verdict_and_note(d):
    cmd = str(d['ai_commands'])
    ai = d['ai_can_execute']
    c = str(d['Criteria'])
    p = str(d['Procedure'])
    ver = ai.upper()
    note = []
    if 'TBD' in c or 'TBD' in p:
        ver = 'UNRESOLVED'
        note.append('§二十一 UNRESOLVED:Procedure/Criteria 在 workbook 即 TBD,8 問答不出')
    rn = d['_row']  # row number
    fixed_flag = None
    if rn in FIXED:
        fixed_flag = CLASSNAME[FIXED[rn]] + ';已修 xlsx'
        note.append(fixed_flag)
    # Q-LIT still present (post-fix should be none; skip rows already flagged)
    if 'sshpass' in cmd and fixed_flag is None:
        for m in re.finditer(r'grep\s+(?:-[A-Za-z0-9]+E?\s+)?"([^"]+)"', cmd):
            raw = m.group(0)
            qi = raw.find('"')
            if qi != -1 and (qi == 0 or raw[qi-1] != '\\'):
                note.append('Q-LIT:ssh 內層 grep pattern 用裸雙引號 → 改單引號')
                break
    return ver, note


def locate(cmd):
    notrun = cmd.lstrip().startswith('-- not runnable')
    if notrun:
        return '物理/目視(agent 不跑)'
    if 'sshpass' in cmd and 'ipmitool -I lanplus' in cmd:
        return 'agent-host(OOB/BMC) / DUT 混合'
    if 'sshpass' in cmd:
        return 'DUT host(ssh 穿透)'
    if 'ipmitool -I lanplus' in cmd or 'curl' in cmd or 'BMC_IP' in cmd:
        return 'agent-host(OOB/BMC)'
    return 'DUT host(ssh 穿透)'


out = []
out.append("\n\n---\n\n## 逐條 review(第 801–1000 條)\n")

for d in rows:
    code = d['Code']
    ai = d['ai_can_execute']
    items = d['Items']
    ts = d['Test Set']
    pack = d['ai_packages_needed']
    cmd = str(d['ai_commands'])
    logs = d['ai_logs_output']
    crit = d['Criteria']
    risk = d['risk']
    rn = d['_row']
    item_no = rn - 2
    notrun = cmd.lstrip().startswith('-- not runnable')
    ver, note = verdict_and_note(d)
    loc = locate(cmd)

    if notrun:
        h_exec, h_slot = "物理(agent 不跑)", "無(operator 現場執行)"
    elif ai == 'NO':
        h_exec, h_slot = "物理(agent 不跑)", "無(operator 現場執行)"
    elif ai == 'PARTIAL':
        h_exec, h_slot = "有前置(需 operator 給變數/決目標/在場)", "見 `${...:?}` 變數;OOB/BIOS 前置或現場判"
    else:
        h_exec, h_slot = "agent 直跑(一次給完後自跑)", "見 `${...:?}` 變數"

    out.append(f"### {item_no}/1000 — `{code}` · Items={items} · TestSet={ts}")
    out.append(f"- **ai_can_execute(現行)** = `{ai}` | **verdict(§二十一)= {ver}** | exec 模式 = `{h_exec}`")
    out.append("")
    out.append("**8 問**:")
    out.append(f"- Q1 測什麼:{items}")
    out.append(f"- Q2 位置:{loc}")
    out.append("- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)")
    out.append("- Q4 時機:單次")
    out.append(f"- Q5 看什麼:{crit}" if crit else f"- Q5 看什麼:{items}")
    out.append(f"- Q6 補什麼:{pack}" if pack else "- Q6 補什麼:無額外套件")
    out.append("- Q7 回報:R36(agent 陳述事實,operator 判)")
    out.append("- Q8 邊界:見 🚧")
    out.append("")
    out.append("**5 段**:")
    out.append(f"- 🎯 目的:{items}")
    if notrun:
        out.append("- 📥 變數:無(物理動作 operator 執行)")
        out.append("- ▶ 指令:`-- not runnable by agent`(物理/目視)")
        out.append("- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)")
        out.append("- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包")
        h_sane = "物理/目視,agent 無法 SSH 觸發;維持現判"
    else:
        out.append("- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB 需 BMC_USER/BMC_PASS/BMC_IP")
        cmds = cmd.split('\n')
        out.append("- ▶ 指令(現行)")
        for cc in cmds[:12]:
            if cc.strip():
                out.append(f"  `{cc.strip()[:170]}`")
        out.append("- 📤 產出人:")
        out.append(f"  log 取位:{str(logs)[:140]}")
        out.append(f"  risk:{str(risk)[:140]}")
        out.append("- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)")
        h_sane = "L1 靜態審;命令存在,引號/位置待實跑前再驗"
    out.append("")
    out.append(f"**§十八 h 三項**:執行模式=`{h_exec}` / operator slot=`{h_slot}` / 邏輯 sanity=`{h_sane}`")
    if note:
        out.append(f"**⚠️    缺陷**:{' ; '.join(note)}")
    out.append("")
    out.append("---")
    out.append("")

with open('review_round_02_body5.md', 'w') as f:
    f.write('\n'.join(out))
print('wrote review_round_02_body5.md, entries:', len(rows))
