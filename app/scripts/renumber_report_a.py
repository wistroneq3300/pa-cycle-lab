# (a) renumber report case headers to canonical item = row - 1, total 2291.
# Stage 1: renumber `### N/M` headers (newN = pos if pos<=200 else pos+1; M -> 2291 uniform),
#          and insert the missing row-202 case (item 201) right before the old `### 201/...`
#          header (which becomes item 202).
import re, sys, shutil

REPORT = 'review_round_02_functionality.md'
HEADER_RE = re.compile(r'^(### )(\d+)/(\d+) — ')

lines = open(REPORT, encoding='utf-8').read().split('\n')

new_lines = []
pos = 0
inserted = False
renumbered = 0
for line in lines:
    m = HEADER_RE.match(line)
    if m:
        pos += 1
        old_n = int(m.group(2))
        new_n = pos if pos <= 200 else pos + 1
        new_line = HEADER_RE.sub(r'\g<1>%d/2291 — ' % new_n, line)
        new_lines.append(new_line)
        renumbered += 1
        if pos == 200:
            # insert row-202 case right after the case at position 200 (item 200)
            new_lines.append('### 201/2291 — `Wistron-HW-00211-V002` · Items=Hot Plugging · TestSet=Detection')
            new_lines.append('- **ai_can_execute(現行)** = `PARTIAL` | **verdict(§二十一)= PARTIAL** | exec 模式 = `有前置(需 operator 插拔 USB)`')
            new_lines.append('')
            new_lines.append('**8 問**:')
            new_lines.append('- Q1 測什麼:Hot Plugging')
            new_lines.append('- Q2 位置:DUT host(ssh 穿透) USB port')
            new_lines.append('- Q3 機台:待 operator 圈定實際 SUT(L2 才跑)')
            new_lines.append('- Q4 時機:單次')
            new_lines.append('- Q5 看什麼:USB 熱插拔可偵測/卸載,不需重開機(見 Criteria)')
            new_lines.append('- Q6 補什麼:usbutils + operator 實體插拔 USB 裝置')
            new_lines.append('- Q7 回報:R36(agent 陳述事實,operator 判)')
            new_lines.append('- Q8 邊界:見 🚧')
            new_lines.append('')
            new_lines.append('**5 段**:')
            new_lines.append('- 🎯 目的:Hot Plugging')
            new_lines.append('- 📥 變數:SSH 需 DUT_USER/DUT_PASS;USB 裝置由 operator 提供並插拔')
            new_lines.append('- ▶ 指令(現行)')
            new_lines.append('  `-- Hot Plugging: verify USB hot-plugging (insert/remove a USB key without shutdown). Operator physically plugs/unplugs the key into the host USB ports; agent watches the OS USB event + device state sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "watch -n1 \'lsusb 2>&1\' 2>&1 & sleep 6; kill %1; dmesg -T 2>&1 | grep -iE \'usb|new.*device|USB disconnect\' | tail -20 2>&1" to confirm detect/remove.`')
            new_lines.append('- 📤 產出人:')
            new_lines.append('  log 取位:return the dmesg USB attach/detach lines + lsusb snapshot so the user confirms the USB device was detected and removed cleanly on hot-plug; the physical plug/unplug is operator-only.')
            new_lines.append('  risk:RISK: physically hot-plugging the USB key is operator-only; agent only reads the OS USB event state.')
            new_lines.append('- 🚧 判斷閘:READ(agent 只讀 OS USB event);實體插拔為 operator(WRITE/PHYSICAL)')
            new_lines.append('')
            new_lines.append('**§十八 h 三項**:執行模式=`有前置(operator 實體插拔 USB)` / operator slot=`usbutils + operator 插拔 / DUT creds` / 邏輯 sanity=`L1 靜態審;命令引號/位置已驗,實跑前再確認`')
            new_lines.append('')
            new_lines.append('---')
            new_lines.append('')
            inserted = True
        continue
    new_lines.append(line)

# sanity
print('headers renumbered:', renumbered, '(expect 2290)')
print('row-202 case inserted:', inserted)
if renumbered != 2290 or not inserted:
    sys.exit('ABORT: unexpected header count')

open(REPORT, 'w', encoding='utf-8').write('\n'.join(new_lines))
print('wrote', REPORT)
