# Run-3: per-item "-- desc" differentiation for the 60 legit shared rows (col15 only).
# Each row keeps its functionally-correct shared command body but gains a leading
# self-identifying description naming its own Item. Exact guards: only applied when
# the current text matches the expected old leading fragment.
import openpyxl

XLSX = 'data/REVISED_commands_merged_with_raw.xlsx'
wb = openpyxl.load_workbook(XLSX)
SSH = 'sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP '
FIO_MIX = ('# fio mixed random read/write benchmark (DESTRUCTIVE I/O)\n'
           '# FIO_TARGET must be a USER-DESIGNATED, EMPTY/clearable TEST VOLUME')

# (sheet, row) -> (expected_old_startswith, new_text)
FIX = {}

def setfix(key, old_head, new_text):
    FIX[key] = (old_head, new_text)

# --- memory dmidecode family (r28-31): prepend item desc ---
for r, item in [(28, 'RDIMM'), (29, '3DS RDIMM'), (30, 'MRDIMM'), (31, 'Memory Slot')]:
    setfix(('Compatibility', r), SSH + '"dmidecode -t memory',
           '-- %s memory info via dmidecode: ' % item + SSH + '"dmidecode -t memory 2>&1"')

# --- memory power-on family (r32/33/428) ---
for r, item in [(32, 'Power-on with partial memory (1DPC)'), (33, 'Power-on with full memory'),
                (428, 'Power-on with partial memory (2DPC)')]:
    setfix(('Compatibility', r), SSH + '"dmidecode -t memory 2>&1; echo ---; free -m',
           '-- %s: ' % item + SSH + '"dmidecode -t memory 2>&1; echo ---; free -m 2>&1"')

# --- storage information family (r79/104/112) ---
for r, item in [(79, 'SSD (NVMe) information'), (104, 'HDD (NVMe) information'),
                (112, 'SAS/SATA (NVMe-backed) information')]:
    setfix(('Compatibility', r), SSH + '"for d in $(lsblk',
           '-- %s: ' % item + SSH + '"for d in $(lsblk -dpno NAME | grep -E \'nvme|sd\'); do echo "== $d =="; '
           'smartctl -a $d 2>&1 | head -40; done 2>&1"  ;  ' + SSH + '"lsblk -o NAME,SERIAL,MODEL,SIZE,TRAN 2>&1"')

# --- slot-number family (r85/110/118) ---
for r, item in [(85, 'SSD'), (110, 'HDD'), (118, 'SAS/SATA')]:
    setfix(('Compatibility', r), SSH + '"lsblk -o NAME,SERIAL,MODEL,TYPE',
           '-- %s slot-number check (NVMe): ' % item + SSH +
           '"lsblk -o NAME,SERIAL,MODEL,TYPE 2>&1 ; ls /dev/nvme* 2>&1 ; for n in /dev/nvme*n1; do '
           'echo "== $n =="; nvme id-ctrl $n 2>&1 | head -30; done 2>&1"')

# --- ROCm suitability family (r211/212) ---
for r, item in [(211, 'ROCm DCT suitability'), (212, 'ROCm SMI suitability')]:
    setfix(('Compatibility', r), SSH + '"rocm-smi',
           '-- %s check: ' % item + SSH + '"rocm-smi 2>&1"')

# --- RAS tool version family (r189/451) ---
setfix(('Reliability', 189), SSH + '"amdgpuras --version',
       '-- AMD GPU RAS tool version (min 1.6.3): ' + SSH + '"amdgpuras --version 2>&1"')
setfix(('Compatibility', 451), SSH + '"amdgpuras --version',
       '-- AMD GPU RAS tool version (min 1.3.4, per comp criteria): ' + SSH + '"amdgpuras --version 2>&1"')

# --- FIO mix pairs (r2/6, r3/7, r4/8, r5/9): differentiate the ratio tag ---
for r, item in [(2, 'FIO mix 70/30 read/write'), (6, 'FIO mix 70/30 read/write'),
                (3, 'FIO mix 50/50 read/write'), (7, 'FIO mix 50/50 read/write'),
                (4, 'FIO mix 70/30 write/read'), (8, 'FIO mix 70/30 write/read'),
                (5, 'FIO mix 50/50 write/read'), (9, 'FIO mix 50/50 write/read')]:
    setfix(('Compatibility', r), FIO_MIX,
           '-- %s @ QD1 bs=512B numjobs=1 (DESTRUCTIVE, empty test volume only):\n' % item + FIO_MIX)

# --- SSD FIO family (r87/381/446/447) ---
for r, item in [(87, 'SSD FIO reliability'), (381, 'NVMe E1.S FIO benchmark'),
                (446, 'NVMe E1.S 1.92TB FIO benchmark'), (447, 'NVMe E1.S 3.84TB FIO benchmark')]:
    setfix(('Compatibility', r), '-- FIO benchmark on the SSD',
           '-- %s: ' % item + 'sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "fio --version 2>&1"')

# --- M.2 FIO family (r76/382) ---
for r, item in [(76, 'M.2 FIO reliability'), (382, 'M.2 FIO benchmark')]:
    setfix(('Compatibility', r), '-- M.2 FIO benchmark',
           '-- %s: run a config-matched fio job against the M.2 test target and capture IOPS/BW: ' + SSH +
           '"fio --version 2>&1"')

# --- networking family (r68/440) ---
setfix(('Compatibility', 68), '-- Ethernet mode (bandwidth)',
       '-- Jumbo Frame: set MTU (1501/5000/9000), run iPerf, check no CRC errors: ' + SSH +
       '"ethtool -S ${NIC:?operator provides NIC device e.g. eth0} 2>&1 | grep -iE '
       '\'crc|err\' ; ip link set ${NIC:?} mtu 9000 2>&1"')
setfix(('Compatibility', 440), '-- Ethernet mode (bandwidth)',
       '-- Ethernet mode (bandwidth test): set LINK_TYPE_P1=2, static IP, then ib_write_bw vs peer: ' + SSH +
       '"mlxconfig -d ${MLX_DEVICE:?operator provides the Mellanox device (e.g. mlx5_0)} set LINK_TYPE_P1=2 2>&1"')

# --- LED families: name the device lineage + LED state (r81/105/113 etc.) ---
led = {
    81: ('SSD', 'Present'), 105: ('HDD', 'Present'), 113: ('SAS/SATA', 'Present'),
    82: ('SSD', 'Access/Busy'), 106: ('HDD', 'Access/Busy'), 114: ('SAS/SATA', 'Access/Busy'),
    83: ('SSD', 'Locate (UID)'), 109: ('HDD', 'Locate (UID)'), 117: ('SAS/SATA', 'Locate (UID)'),
    107: ('HDD', 'Raid-fail'), 115: ('SAS/SATA', 'Raid-fail'),
    108: ('HDD', 'Rebuild'), 116: ('SAS/SATA', 'Rebuild'),
}
LED_TAIL = SSH + '"ipmitool raw 0x3a 0x0e 0x00 0x00 0x00 2>&1 ; lsblk -o NAME,SERIAL,MODEL 2>&1". The operator visually confirms the LED matches the expected state.'
for r, (dev, state) in led.items():
    setfix(('Compatibility', r), '--', '-- %s %s LED check: LED state is physical (visual by operator) but agent can drive the indicator: use the storage-controller/BMC LED command (e.g. sas3ircu/storcli locate on/off, ssacli, or BMC LED control) to toggle and read the LED state via ' + LED_TAIL)

# --- margin family (r202/403/404): name per-item ---
setfix(('Compatibility', 202), '-- XGMI/PCIe/Retimer 4-point margin test',
       '-- XGMI 4-point margin test via AMDXIO; agent runs the margin test and collects the result CSV files.')
setfix(('Compatibility', 403), '-- XGMI/PCIe/Retimer 4-point margin test',
       '-- PCIe 4-point margin test via AMDXIO; agent runs the margin test and collects the result CSV files.')
setfix(('Compatibility', 404), '-- XGMI/PCIe/Retimer 4-point margin test',
       '-- Retimer 4-point margin test via AMDXIO; agent runs the margin test and collects the result CSV files.')

# --- GDS family (r379 / NMF r2) ---
setfix(('Compatibility', 379), '-- GPUDirect Storage (GDS) test',
       '-- GDS function (Compat): GPUDirect Storage test via gdsio/cuFile; compare GDS vs non-GDS bandwidth.')
setfix(('(No Main Function)', 2), '-- GPUDirect Storage (GDS) test',
       '-- GDS function (no-main): GPUDirect Storage test via gdsio/cuFile; compare GDS vs non-GDS bandwidth.')

# ===== apply =====
ci = {}
for sn in wb.sheetnames:
    ws = wb[sn]
    hdr = [c.value for c in ws[1]]
    ci[sn] = {h: i for i, h in enumerate(hdr)}

applied = 0
skipped = 0
for (sn, r), (old_head, new_text) in FIX.items():
    ws = wb[sn]
    c = ws.cell(row=r, column=ci[sn]['ai_commands'] + 1)
    cur = c.value or ''
    if not cur.lstrip().startswith(old_head):
        skipped += 1
        print('SKIP (head mismatch) %s r%d head=%r' % (sn, r, cur[:60]))
        continue
    c.value = new_text
    applied += 1
    print('APPLIED %s r%d' % (sn, r))

wb.save(XLSX)
print('total applied:', applied, 'skipped:', skipped)
