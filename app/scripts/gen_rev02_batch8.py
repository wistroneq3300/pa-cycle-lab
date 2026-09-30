# Generate review_round_02_functionality.md body for the eighth 200 rows
# (Functionality rows 1403-1602, item 1401-1600). Pure ASCII in code; CJK only in
# markdown output. Uses /tmp/rows1403_1602_fixed.json (built by /tmp/dump8.py).
import json, sys

rows = json.load(open('/tmp/rows1403_1602_fixed.json'))

# rows fixed this batch (all ai_commands col15 + 1 verdict), keyed by ROW
FIXED_CMD = {
1418,1419,1420,1421,1433,1434,1435,1436,1437,1455,1456,1457,1458,1459,1460,
1465,1466,1484,1499,1516,1517,1529,1530,1531,1532,1562,1596,
}
# verdict (ai_can_execute) changed this batch
VERDICT_CHANGED = {1456}

CLASS = {
 'Q-LIT': 'Q-LIT(ssh 內層引號破碎 → 內層改單引號;含 1435 收斂嵌套 ssh);已修 xlsx',
 'DBL-SSH': 'DBL-SSH(遠端內再包一層 sshpass/ssh → 收斂單層);已修 xlsx',
 'WR': 'WR(命令內容與 Items/procedure 不符 → 依 procedure 重寫真命令);已修 xlsx',
 'FAKE': 'FAKE(假完成 echo 佔位 → ${TOOL_PATH:?} vendor tool wrapper,§十九 r);已修 xlsx',
 'R5': 'R5(Redfish curl 誤包 DUT-ssh 且引號破碎 → 移 agent-host);已修 xlsx',
 'Q-LIT+DBL-SSH': 'Q-LIT(內層引號)+DBL-SSH(嵌套 ssh);已修 xlsx',
 'WR+Q-LIT': 'WR(內容不符)+Q-LIT(引號);已修 xlsx',
}
FIX_CLASS = {
1418:'FAKE',1419:'FAKE',1420:'FAKE',1421:'FAKE',
1433:'Q-LIT',1434:'Q-LIT',
1435:'Q-LIT+DBL-SSH',
1436:'WR',1437:'WR',
1455:'WR',1456:'WR',1457:'WR',1458:'WR',1459:'WR',1460:'WR',
1465:'Q-LIT',1466:'Q-LIT',
1484:'Q-LIT',1499:'R5',
1516:'WR',1517:'WR',
1529:'Q-LIT',
1530:'WR',1531:'WR',1532:'WR',
1562:'WR',1596:'DBL-SSH',
}

def verdict_and_note(d):
    cmd = str(d['ai_commands'])
    ai = str(d['ai_can_execute'])
    crit = str(d['Criteria'])
    proc = str(d['Procedure'])
    ver = ai.upper()
    note = []
    if 'TBD' in crit or 'TBD' in proc:
        ver = 'UNRESOLVED'
        note.append('§二十一 UNRESOLVED:Procedure/Criteria 在 workbook 即 TBD,8 問答不出')
    rn = d['_row']
    if rn in FIXED_CMD:
        note.append(CLASS[FIX_CLASS.get(rn,'WR')])
    if rn in VERDICT_CHANGED:
        note.append('判定 NO→YES(md5sum 純讀、operator 給 image 一次跑完,§二十一 YES);ai_can_execute 已改')
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
out.append("\n\n---\n\n## 逐條 review(第 1401–1600 條)\n")

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
        loc = 'DUT host(ssh 穿透)'; h_exec, h_slot, h_sane = "不確定(TBD 資料)", "無法判定", "資料 TBD;8 問答不出(鎖版 §二十 aa / §二十一)"
    elif notrun:
        loc = loc0; h_exec, h_slot, h_sane = "不執行/物理(agent 不跑)", "無(operator 現場執行)", "說明性/物理,agent 不產生測試證據(§十九 q)"
    elif ai == 'NO':
        loc = loc0; h_exec, h_slot, h_sane = "物理(agent 不跑)", "無(operator 現場執行)", "L1 靜態審;物理/目視,agent 無法觸發"
    elif ai == 'PARTIAL':
        loc = loc0; h_exec, h_slot, h_sane = "有前置(需 operator 給變數/決目標/在場)", "見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判", "L1 靜態審;命令存在,引號/位置待實跑前再驗"
    else:
        loc = loc0; h_exec, h_slot, h_sane = "agent 直跑(一次給完後自跑)", "見 `${...:?}` 變數", "L1 靜態審;命令存在,引號/位置待實跑前再驗"

    out.append(f"### {item_no}/1600 — `{code}` · Items={items} · TestSet={ts}")
    out.append(f"- **ai_can_execute(現行)** = `{ai}` | **verdict(§二十一)= {ver}** | exec 模式 = `{h_exec}`")
    out.append("")
    out.append("**8 問**:")
    out.append(f"- Q1 測什麼:{items}")
    out.append(f"- Q2 位置:{loc}")
    out.append("- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)")
    out.append("- Q4 時機:單次" if 'loop' not in cmd.lower() and '500x' not in cmd.lower() and '72h' not in cmd.lower() and '24h' not in cmd.lower() and '28800' not in cmd.lower() and 'for ' not in cmd.lower() else "- Q4 時機:長時間/循環(需 operator 核准時長)")
    out.append(f"- Q5 看什麼:{crit}" if crit and 'TBD' not in crit else f"- Q5 看什麼:{items}")
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
    elif notrun or ai == 'NO':
        out.append("- 📥 變數:無(物理/說明性動作 operator 執行)")
        out.append("- ▶ 指令:`-- not runnable by agent`(物理/說明/需 pre-OS)")
        out.append("- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)")
        out.append("- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包")
    else:
        out.append("- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP")
        cmds = cmd.split('\n')
        out.append("- ▶ 指令(現行)")
        for cc in cmds[:14]:
            if cc.strip():
                out.append(f"  `{cc.strip()[:190]}`")
        out.append("- 📤 產出人:")
        out.append(f"  log 取位:{str(logs)[:140]}")
        out.append(f"  risk:{str(risk)[:140]}")
        out.append("- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)")
    out.append("")
    out.append(f"**§十八 h 三項**:執行模式=`{h_exec}` / operator slot=`{h_slot}` / 邏輯 sanity=`{h_sane}`")
    if note:
        out.append(f"**⚠️   缺陷**:{' ; '.join(note)}")
    out.append("")
    out.append("---")
    out.append("")

with open('review_round_02_body8.md', 'w') as f:
    f.write('\n'.join(out))
print('wrote review_round_02_body8.md, entries:', len(rows))
