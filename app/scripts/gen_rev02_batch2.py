# Generate review_round_02_functionality.md body for second 200 rows (Functionality rows 202-401).
# Pure ASCII in code; CJK only in markdown output. Uses /tmp/rows202_401.json.
import json, re

rows = json.load(open('/tmp/rows202_401.json'))

def verdict_and_note(d):
    items = d['Items']
    ai = d['ai_can_execute']
    cmd = d['ai_commands']
    c = d['Criteria']
    notrun = cmd.startswith('-- not runnable')
    ver = ai.upper()
    note = []
    # Q-LIT: ssh ... ".... grep ... "pattern" ...." -> inner double-quoted pattern
    if 'sshpass' in cmd and 'grep' in cmd:
        m = re.search(r'grep\s+(-[A-Za-z]+E?\s+)?"([^"]+)"', cmd)
        if m:
            note.append('Q-LIT:ssh 內層 grep pattern 用雙引號 → 改單引號(Round-1 已拍板),避免 agent-host 端字串切爆')
    # Echo nested double quote inside ssh
    if 'sshpass' in cmd and re.search(r'echo\s+"', cmd):
        note.append('E-DQ:ssh 內層 echo 字串用雙引號 → 改單引號,避免外層參數被切斷')
    # DBL-SSH nested self ssh
    if cmd.count('sshpass') > 1:
        note.append('DBL-SSH:遠端字串內再包一層 sshpass/ssh → 收斂成單層 ssh(避免無謂的二次 ssh + 引號錯亂)')
    # R5: OOB ipmitool lanplus wrongly inside DUT ssh
    if 'sshpass' in cmd and 'ssh ' in cmd and 'ipmitool -I lanplus' in cmd:
        note.append('R5:OOB ipmitool lanplus 包在 DUT ssh 內 → 移到 agent host 執行(遠端無需二次工具)')
    # PMBus fake-complete
    if 'PMBUS_REG_0x0xE0' in cmd or 'NEEDS_PSU_BUS_ADDR' in cmd:
        note.append('§十九 o 假完成:命令僅列 hwmon/i2c 設備名,未讀實際 PMBus register → 需補真 i2cget <reg> + ${PMBUS_BUS_ADDR:?}')
    # fio --version fake-complete
    if re.search(r'fio\s+--version', cmd):
        note.append('§十九 o 假完成:命令只有 fio --version 工具檢查 → 需補真 fio job 測試(§十八 e 預寫法)')
    # sensor 'get' without sdr fallback (d)
    if 'sensor get' in cmd and "sdr" not in cmd and "sensor list" not in cmd:
        note.append('§十八 d:sensor get 未附 fallback → 同一命令補 sdr elist/sensor list 整包')
    return ver, note

out = []
out.append("\n\n---\n\n## 逐條 review(第 201–400 條)\n")
[out.append(line) for line in []]

for i, d in enumerate(rows, 201):
    code = d['Code']
    ai = d['ai_can_execute']
    items = d['Items']
    ts = d['Test Set']
    pack = d['ai_packages_needed']
    cmd = d['ai_commands']
    logs = d['ai_logs_output']
    crit = d['Criteria']
    risk = d['risk']
    notrun = cmd.startswith('-- not runnable')
    ver, note = verdict_and_note(d)

    # location
    if notrun:
        loc = '物理/目視(agent 不跑)'
    elif 'sshpass' in cmd and 'ipmitool -I lanplus' in cmd:
        loc = 'agent-host(OOB/BMC) / DUT 混合'
    elif 'sshpass' in cmd:
        loc = 'DUT host(ssh 穿透)'
    elif 'ipmitool -I lanplus' in cmd or 'curl' in cmd or 'BMC_IP' in cmd or '-H "$BMC_IP"' in cmd:
        loc = 'agent-host(OOB/BMC)'
    else:
        loc = 'DUT host(ssh 穿透)'

    # exec mode (H-1), based on ai
    if notrun:
        h_exec, h_slot, h_sane = "物理(agent 不跑)", "無(operator 現場執行)", "物理目視,agent 無法 SSH 觸發"
    elif ai == 'NO':
        h_exec, h_slot = "物理(agent 不跑)", "無(operator 現場執行)"
    elif ai == 'PARTIAL':
        h_exec, h_slot = "有前置(需 operator 給變數/決目標/在場)", "見 `${...:?}` 變數;PMBus/vendor tool 標 bus/vendor slot"
    else:
        h_exec, h_slot = "agent 直跑(一次給完後自跑)", "見 `${...:?}` 變數"

    out.append(f"### {i}/400 — `{code}` · Items={items} · TestSet={ts}")
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
        h_sane = "物理目視,agent 無法 SSH 觸發;維持 NO"
    else:
        out.append("- 📥 變數:見 ai_commands 內 `${...:?}` 提示;SSH 需 DUT_USER/DUT_PASS")
        cmds = cmd.split('\n')
        out.append("- ▶ 指令(現行)")
        for cc in cmds[:12]:
            if cc.strip():
                out.append(f"  `{cc.strip()[:170]}`")
        out.append("- 📤 產出人:")
        out.append(f"  log 取位:{logs[:140]}")
        out.append(f"  risk:{risk[:140]}")
        out.append("- 🚧 判斷閘:READ/WRITE 視命令;agent 不實跑(L1)")
        h_sane = "L1 靜態審;命令存在,引號/位置待實跑前再驗"
    out.append("")
    out.append(f"**§十八 h 三項**:執行模式=`{h_exec}` / operator slot=`{h_slot}` / 邏輯 sanity=`{h_sane}`")
    if note:
        out.append(f"**⚠️  缺陷**:{' ; '.join(note)}")
    out.append("")
    out.append("---")
    out.append("")

with open('review_round_02_body2.md', 'w') as f:
    f.write('\n'.join(out))
print('wrote review_round_02_body2.md, entries:', len(rows))
