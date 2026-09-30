# Generate review_round_02_functionality.md body for the seventh 200 rows
# (Functionality rows 1203-1402, item 1201-1400).
# Pure ASCII in code; CJK only in markdown output. Uses /tmp/rows1203_1402.json.
import json, re

rows = json.load(open('/tmp/rows1203_1402.json'))

# rows fixed in this batch (all ai_commands col15), keyed by ROW (matches fix_rev02_batch7.py)
FIXED_CMD = {
1256,1257,1258,1259,1260,1261,1262,1263,1264,1265,1266,1268,1270,1272,1274,1276,
1277,1278,1279,1284,1285,1286,1296,1297,1298,1299,1300,1301,1302,1303,1304,1305,
1306,1307,1308,1309,1310,1311,1323,1324,1325,1332,1333,1334,1335,1365,1366,1367,
1368,1369,1370,1371,1372,1373,1374,1375,1377,1378,1379,1380,
}

CLASSNAME = {
 'R29': 'R29(DUT 內層 ipmitool 關鍵字缺失 → 補 `sudo ipmitool`);已修 xlsx',
 'WR': 'WR(DCMI 子命令不存在 → 依 ipmitool 實測改用真子命令);已修 xlsx',
 'R5': 'R5(Redfish/OOB curl 誤包 DUT-ssh 且引號破碎 → 移 agent-host);已修 xlsx',
 'WR/R5': 'WR/R5(誤標「不可跑 IPMI bytes」實為 Redfish GET → 改真 agent-host curl);已修 xlsx',
 'R29+WR': 'R29(DUT 內層 ipmitool 關鍵字缺失)+WR(DCMI 子命令不存在);已修 xlsx',
}

# classification of the fix for each row
FIX_CLASS = {
1256:'R29',1257:'WR',1258:'R29+WR',1259:'WR',1260:'R29',1261:'WR',1262:'R29',1263:'WR',
1264:'R29+WR',1265:'WR',1266:'R29',1268:'R29+WR',1270:'R29',1272:'R29',1274:'R29',1276:'R29+WR',
1277:'WR',1278:'R29+WR',1279:'WR',1284:'R29',1285:'WR',
1286:'R5',1296:'R5',1297:'R5',1298:'R5',1299:'WR/R5',1300:'WR/R5',1301:'WR/R5',1302:'WR/R5',
1303:'WR/R5',1304:'WR/R5',1305:'WR/R5',1306:'WR/R5',1307:'WR/R5',1308:'WR/R5',1309:'WR/R5',
1310:'WR/R5',1311:'WR/R5',1323:'R5',1324:'R5',1325:'R5',1332:'R5',1333:'R5',1334:'R5',1335:'R5',
1365:'R5',1366:'R5',1367:'R5',1368:'R5',1369:'R5',1370:'R5',1371:'R5',1372:'R5',1373:'R5',
1374:'R5',1375:'R5',1377:'R5',1378:'R5',1379:'R5',1380:'R5',
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
    if rn in FIXED_CMD:
        note.append(CLASSNAME[FIX_CLASS.get(rn, 'R29')])
    return ver, note


def locate(cmd):
    notrun = cmd.lstrip().startswith('-- not runnable')
    if notrun:
        return '物理/目視(agent 不跑)'
    if 'sshpass' in cmd and 'ipmitool' in cmd:
        return 'DUT host(ssh 穿透)'
    if 'sshpass' in cmd:
        return '混合(ssh + Redfish curl,已移 agent-host)'.replace('混合', 'DUT/agent host')
    if 'ipmitool -I lanplus' in cmd or 'curl' in cmd or 'BMC_IP' in cmd:
        return 'agent-host(OOB/BMC)'
    return 'DUT host(ssh 穿透)'


out = []
out.append("\n\n---\n\n## 逐條 review(第 1201–1400 條)\n")

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
        loc = loc0; h_exec, h_slot = "有前置(需 operator 給變數/決目標/在場)", "見 `${...:?}` 變數;OOB/BIOS/Redfish 前置或現場判"
    else:
        loc = loc0; h_exec, h_slot = "agent 直跑(一次給完後自跑)", "見 `${...:?}` 變數"

    out.append(f"### {item_no}/1400 — `{code}` · Items={items} · TestSet={ts}")
    out.append(f"- **ai_can_execute(現行)** = `{ai}` | **verdict(§二十一)= {ver}** | exec 模式 = `{h_exec}`")
    out.append("")
    out.append("**8 問**:")
    out.append(f"- Q1 測什麼:{items}")
    out.append(f"- Q2 位置:{loc}")
    out.append("- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)")
    out.append("- Q4 時機:單次" if 'loop' not in cmd.lower() and '500x' not in cmd.lower() and '72h' not in cmd.lower() and '24h' not in cmd.lower() else "- Q4 時機:長時間/循環(需 operator 核准時長)")
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
        h_sane = "資料 TBD;8 問答不出(鎖版 §二十 aa / §二十一)"
    elif notrun:
        out.append("- 📥 變數:無(物理動作 operator 執行)")
        out.append("- ▶ 指令:`-- not runnable by agent`(物理/目視)")
        out.append("- 📤 產出人:operator 事後照片/證據,agent 不產生(§十九 q)")
        out.append("- 🚧 判斷閘:PHYSICAL/NO,agent 給事後證據包")
        h_sane = "物理/目視,agent 無法 SSH 觸發;維持現判"
    else:
        out.append("- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS;OOB/Redfish 需 BMC_USER/BMC_PASS/BMC_IP")
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
        out.append(f"**⚠️  缺陷**:{' ; '.join(note)}")
    out.append("")
    out.append("---")
    out.append("")

with open('review_round_02_body7.md', 'w') as f:
    f.write('\n'.join(out))
print('wrote review_round_02_body7.md, entries:', len(rows))
