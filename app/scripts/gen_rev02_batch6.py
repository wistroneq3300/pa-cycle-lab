# Generate review_round_02_functionality.md body for sixth 200 rows
# (Functionality rows 1003-1202, item 1001-1200).
# Pure ASCII in code; CJK only in markdown output. Uses /tmp/rows1003_1202.json.
# This block is the IPMI deep-dive: messaging/session/SDR/sensor/FRU/wistron-OEM/application.
import json, re

rows = json.load(open('/tmp/rows1003_1202.json'))

# rows fixed in this batch, keyed by ROW (matches fix_rev02_batch6.py)
FIXED_CMD = {
1045,1049,1050,1051,1052,1053,1054,1057,1058,1059,1062,1066,1067,1068,1069,
1070,1073,1074,1075,1083,1095,1108,1110,1111,1112,1113,1114,1115,1116,1117,
1125,1194,1195,
}
FIXED_AI = {1195}
AI_CHANGE_NOTE = {1195: 'ai_can_execute:NO→YES(原誤植 Screen 目視題;實為 OOB raw 0x0a 0x42,agent 可跑)'}

# classification of the fix for each row
FIX_CLASS = {
1045:'R29',1049:'R29',1050:'R29',1051:'R29',1052:'R29',1053:'R29',1054:'R29',
1059:'R29',1062:'R29',1066:'R29',1069:'R29',1073:'R29',1074:'R29',1075:'R29',
1083:'R29',1108:'R29',1110:'R29',
1057:'R29+raw',1058:'R29+raw+WR',1067:'WR(misassigned)',1068:'WR(misassigned)',
1070:'R29+raw+WR',1095:'OOBinband',1111:'R29+raw+WR',
1112:'OOBinband',1113:'OOBinband',1114:'OOBinband',1115:'OOBinband',1116:'OOBinband',1117:'OOBinband',
1125:'GUID-fix',1194:'WR(misassigned)',1195:'WR(misassigned)+AI',
}
CLASSNAME = {
 'R29':'R29(DUT 內層 ipmitool 關鍵字缺失 → 補 `sudo ipmitool`)',
 'R29+raw':'R29(DUT 內層 ipmitool 缺失)+依 procedure 改正確 raw byte',
 'R29+raw+WR':'WR+依 procedure 改正確 raw 指令(R29 另補 `ipmitool` 關鍵字)',
 'WR(misassigned)':'WR(指令與題目不符,誤植其它 sensor/screen 命令 → 依 procedure 校正)',
 'OOBinband':'OOBinband(IB 題卻包 lanplus 遠端 OOB → 改 DUT 本機 `sudo ipmitool raw`)',
 'GUID-fix':'GUID-fix(Get Device GUID 誤用 0x0a 0x49=Set SEL Time byte → 改 0x06 0x08)',
 'WR(misassigned)+AI':'WR(誤植 Screen 目視題 → 依 procedure 改 OOB raw)+ai_can_execute:NO→YES',
}


def verdict_and_note(d):
    cmd = str(d['ai_commands'])
    ai = str(d['ai_can_execute'])
    c = str(d['Criteria'])
    p = str(d['Procedure'])
    ver = ai.upper()
    note = []
    if 'TBD' in c or 'TBD' in p:
        ver = 'UNRESOLVED'
        note.append('§二十一 UNRESOLVED:Procedure/Criteria 在 workbook 即 TBD,8 問答不出')
    rn = d['_row']
    fixed_flag = None
    if rn in FIXED_CMD or rn in FIXED_AI:
        tags = []
        if rn in FIXED_CMD:
            tags.append(CLASSNAME[FIX_CLASS.get(rn, 'R29')] + ';已修 xlsx')
        if rn in FIXED_AI:
            tags.append(AI_CHANGE_NOTE.get(rn, 'ai 判定已修 xlsx'))
        fixed_flag = ' ; '.join(tags)
        note.append(fixed_flag)
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
out.append("\n\n---\n\n## 逐條 review(第 1001–1200 條)\n")

for d in rows:
    code = d['Code']
    ai = str(d['ai_can_execute'])
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
    loc0 = locate(cmd)
    if ver == 'UNRESOLVED':
        loc = 'DUT host(ssh 穿透)'; h_exec, h_slot = "不確定(TBD 資料)", "無法判定"
    elif notrun:
        loc = '物理/目視(agent 不跑)'; h_exec, h_slot = "物理(agent 不跑)", "無(operator 現場執行)"
    elif ai == 'NO':
        loc = loc0; h_exec, h_slot = "物理(agent 不跑)", "無(operator 現場執行)"
    elif ai == 'PARTIAL':
        loc = loc0; h_exec, h_slot = "有前置(需 operator 給變數/決目標/在場)", "見 `${...:?}` 變數;OOB/BIOS 前置或現場判"
    else:
        loc = loc0; h_exec, h_slot = "agent 直跑(一次給完後自跑)", "見 `${...:?}` 變數"

    out.append(f"### {item_no}/1200 — `{code}` · Items={items} · TestSet={ts}")
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
    if ver == 'UNRESOLVED':
        out.append("- 📥 變數:無(Procedure/Criteria 即 TBD,無法推導)")
        out.append("- ▶ 指令:`-- not runnable`(TBD,見 ai_commands)")
        out.append("- 📤 產出人:operator 於測試庫補 TBD 後重審,agent 未跑")
        out.append("- 🚧 判斷閘:UNRESOLVED,等 operator 補資料")
        h_sane = "資料 TBD;8 問答不出(鎖版 §二十 aa / §二十一)"
    elif notrun:
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
                out.append(f"  `{cc.strip()[:190]}`")
        out.append("- 📤 產出人:")
        out.append(f"  log 取位:{str(logs)[:140]}")
        out.append(f"  risk:{str(risk)[:140]}")
        out.append("- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)")
        h_sane = "L1 靜態審;命令存在,引號/位置待實跑前再驗"
    out.append("")
    out.append(f"**§十八 h 三項**:執行模式=`{h_exec}` / operator slot=`{h_slot}` / 邏輯 sanity=`{h_sane}`")
    if note:
        out.append(f"**⚠️     缺陷**:{' ; '.join(note)}")
    out.append("")
    out.append("---")
    out.append("")

with open('review_round_02_body6.md', 'w') as f:
    f.write('\n'.join(out))
print('wrote review_round_02_body6.md, entries:', len(rows))
