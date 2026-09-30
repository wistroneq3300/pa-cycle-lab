# Run-2 verification: rebuild + diff vs run2_pre + shared-set recount + mojibake + nested-ssh/Q-LIT scan.
import openpyxl, subprocess, sys, re, shutil
from collections import Counter, defaultdict

XLSX = 'data/REVISED_commands_merged_with_raw.xlsx'
BAK = 'data/REVISED_commands_merged_with_raw.xlsx.bak_rev02_run2_pre'
OUT = '/tmp/tests_run2.json'
SHEETS = ['Functionality', 'Reliability', 'Performance', 'Compatibility', 'Stability', '(No Main Function)']

r = subprocess.run([sys.executable, 'scripts/build_testlib_json_xlsx.py', XLSX, OUT],
                   capture_output=True, text=True)
print(r.stdout[-300:])

shutil.copy(BAK, '/tmp/bak_run2_verify.xlsx')
wbc = openpyxl.load_workbook(XLSX, data_only=True)
wbb = openpyxl.load_workbook('/tmp/bak_run2_verify.xlsx', data_only=True)
diff = []
for sn in SHEETS:
    sc, sb = wbc[sn], wbb[sn]
    for row in range(2, max(sc.max_row, sb.max_row) + 1):
        for col in range(1, max(sc.max_column, sb.max_column) + 1):
            if sc.cell(row=row, column=col).value != sb.cell(row=row, column=col).value:
                diff.append((sn, row, col))
print('diff vs run2_pre:', len(diff), '| by col:', dict(Counter(c for _, _, c in diff)),
      '| by sheet:', dict(Counter(s for s, _, _ in diff)))

# shared ai_commands recount (non-Functionality)
sh = defaultdict(list)
for sn in SHEETS:
    if sn == 'Functionality':
        continue
    ws = wbc[sn]
    hdr = [c.value for c in ws[1]]
    ci = {h: i for i, h in enumerate(hdr)}
    for row in range(2, ws.max_row + 1):
        aic = ws.cell(row=row, column=ci['ai_commands'] + 1).value or ''
        if aic.strip():
            sh[aic].append((sn, row))
shared_rows = sum(len(v) for v in sh.values() if len(v) >= 2)
shared_sets = sum(1 for v in sh.values() if len(v) >= 2)
print('remaining shared rows:', shared_rows, 'sets:', shared_sets)

# mojibake
bad = []
for sn in SHEETS:
    ws = wbc[sn]
    hdr = [c.value for c in ws[1]]
    ci = {h: i for i, h in enumerate(hdr)}
    for row in range(2, ws.max_row + 1):
        for colname in ('ai_commands', 'Criteria'):
            v = ws.cell(row=row, column=ci[colname] + 1).value
            if isinstance(v, str) and ('\ufffd' in v or re.search(r'[\u0400-\u04ff]', v)):
                bad.append((sn, row, colname))
print('mojibake:', len(bad), bad[:3])

# nested sshpass-ssh inside an outer ssh (DBL-SSH) rescan + Q-LIT inner double-quote inside ssh remote
nl = []
for sn in SHEETS:
    ws = wbc[sn]
    hdr = [c.value for c in ws[1]]
    ci = {h: i for i, h in enumerate(hdr)}
    for row in range(2, ws.max_row + 1):
        aic = ws.cell(row=row, column=ci['ai_commands'] + 1).value or ''
        if aic.count('sshpass') > 1:
            nl.append(('DBLSSH', sn, row))
        # inner unescaped double quotes between the outer ssh "..." pair
        m = re.search(r'ssh[^\n"]*"([^"]*)"', aic)
        if m and '"' in m.group(1):
            nl.append(('QLIT', sn, row))
print('nested-ssh + inner-quote candidates:', len(nl), nl[:15])
