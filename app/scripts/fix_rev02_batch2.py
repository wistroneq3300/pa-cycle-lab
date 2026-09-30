# Precise per-(sheet,row) ai_commands fix for Round-02 batch 2 (Functionality rows 202-401).
# Q-LIT: inner grep/echo double-quoted pattern -> single quotes inside ssh.
# fake-complete: fio --version -> real fio job-file pre-write.
# Pure ASCII only in this script. Uses python-openpyxl.
import openpyxl, sys

XLSX='data/REVISED_commands_merged_with_raw.xlsx'
SHEET='Functionality'
# key = Functionality row number; commands apply to exactly this row
FIX={
203: r'''sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "lsusb 2>&1; echo ---dmesg---; dmesg | grep -iE 'usb' | tail -20; stress-ng --udp 4 --timeout 300s 2>&1 | tail 2>&1"''',
205: r'''-- Devcie detection: verify device detection in OS sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "lsusb 2>&1; ip link 2>&1 | grep -E '^[0-9]+:' | head 2>&1" with the device present; physical setup is operator-owned.  -- USB device-detection sibling row; the OS USB tree check covers the SAME set of ports as the partner row.''',
206: r'''-- Hot Plugging: verify USB hot-plugging (insert/remove a USB key without shutdown). Operator physically plugs/unplugs the key into the host USB ports; agent watches the OS USB event + device state sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "watch -n1 'lsusb 2>&1' 2>&1 & sleep 6; kill %1 2>/dev/null; dmesg -T 2>&1 | grep -iE 'usb|new.*device|USB disconnect' | tail -20 2>&1" to confirm detect/remove.  -- USB hot-plugging sibling row; repeat the attach/detach detection check on the same rear USB ports.''',
219: r'''# DUT: SMBIOS BIOS/ROM type-3 + dmesg ROM/flash size
sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "sudo dmidecode -t 3 2>&1 | grep -iE 'Size|ROM'; dmesg 2>/dev/null | grep -iE 'ROM|flash' | grep -iE 'MB|KB' | head"''',
230: r'''sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "echo ---tpm2_getdev---; command -v tpm2_getdevices >/dev/null 2>&1 && tpm2_getdevices 2>&1 || echo 'no tpm2_getdevices'; echo ---tpm_dmesg---; dmesg | grep -iE 'tpm|trusted platform' | head -8; echo ---tpm2_selftest---; command -v tpm2_selftest >/dev/null 2>&1 && tpm2_selftest -f 2>&1 || echo 'tpm2-tools not installed' 2>&1"''',
243: r'''# DUT: pre-write fio job file, operator designates target, run + capture IOPS/BW
sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "cat > /root/HW-00258.fio <<'EOF'
[global]
bs=512
size=512M
runtime=60
time_based
direct=1
ioengine=libaio
[test]
rw=randread
iodepth=32
EOF
fio /root/HW-00258.fio --filename=${FIO_TARGET:?operator must designate an EMPTY M.2 test target, never OS/system disk}" 2>&1''',
254: r'''# DUT: pre-write fio job file, operator designates target, run + capture IOPS/BW
sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "cat > /root/HW-00269.fio <<'EOF'
[global]
bs=512
size=1G
runtime=60
time_based
direct=1
ioengine=libaio
[test]
rw=randrw
rwmixread=70
iodepth=32
EOF
fio /root/HW-00269.fio --filename=${FIO_TARGET:?operator must designate an EMPTY SSD test target, never OS/system disk}" 2>&1''',
286: r'''-- Link Flap: repeat BMC-port NIC link up/down in the OS and confirm the NIC works after 5 flips. Agent can toggle the link in software sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "sudo ip link set dev "$BMC_PORT" down 2>&1; sleep 2; sudo ip link set dev "$BMC_PORT" up 2>&1; sudo ethtool "$BMC_PORT" 2>&1 | grep -E 'Link detected|Speed' 2>&1" ; each down drops BMC connectivity, so a management out-of-band path is needed.''',
288: r'''-- MAC Address: check the BMC-port MAC address in the OS. Agent can read the OS-side MAC sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "ip link show 2>&1 | grep -Ei 'link/ether|^[0-9]+:' | head -n 40 2>&1" ; the BIOS-side MAC read is done by the operator in setup.''',
294: r'''-- Firmware Flash: flash the MLNX firmware via flint. Agent reads the current FW then flashes sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "mst start 2>&1; flint -d mlx5_0 q 2>&1 | grep -iE 'FW Version|Device ID' 2>&1" -> flash sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "flint -d mlx5_0 -y -i MLNX_FW.bin -ocr b 2>&1; echo '---after---'; flint -d mlx5_0 q 2>&1 | grep -i 'FW Version' 2>&1"; needs the correct FW bin for the device.''',
296: r'''-- Check MST & ibstat: check MLNX devices and link status with and without connection. Agent runs sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "mst status -v 2>&1 | grep -iE 'MST|mlx|ConnectX'; echo '---ibstat with loopback---'; ibstat 2>&1 | grep -iA10 'mlx' | egrep 'mlx|state' 2>&1"; requires MFT and loopback of the MLNX ports (physical).''',
300: r'''-- Link Flap: repeat InfiniBand link up/down 5x and check ibstat physical state. Agent brings the mlx IB interface up/down and reads the state sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "for i in 1 2 3 4 5; do ip link set ib0 down; sleep 2; ip link set ib0 up; sleep 3; ibstat 2>&1 | grep -iA10 'mlx' | egrep 'mlx|state'; done 2>&1" ; needs an IB interface and driver.''',
364: r'''sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "sudo dmidecode -t 0 2>&1 | grep -i 'Vendor' | head -1 2>&1"''',
365: r'''sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "sudo dmidecode -t 0 2>&1 | grep -iE 'Version|BIOS Revision' | head -2 2>&1"''',
366: r'''sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "sudo dmidecode -t 0 2>&1 | grep -i 'version' 2>&1"''',
367: r'''sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "sudo dmidecode -t 0 2>&1 | grep -i 'revision' 2>&1"''',
368: r'''sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "cat /sys/class/dmi/id/bios_version 2>&1; echo ---; sudo dmidecode -t 0 2>&1 | grep -iA1 'BIOS Information' 2>&1"''',
369: r'''sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "sudo dmidecode -s bios-release-date 2>&1; echo ---; sudo dmidecode -t 0 2>&1 | grep -i 'Release Date' 2>&1"''',
371: r'''sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "free -m 2>&1 | head -2; echo ---; sudo dmidecode -t 17 2>&1 | grep -c 'Memory Device' 2>&1"''',
}

wb=openpyxl.load_workbook(XLSX)
ws=wb[SHEET]
changed=0; missing=[]
for rownum,newcmd in FIX.items():
    code=ws.cell(row=rownum, column=1).value
    if code is None:
        missing.append(rownum); continue
    ws.cell(row=rownum, column=15, value=newcmd)
    changed+=1
if missing: print('MISSING rows:',missing)
print('changed',changed,'of',len(FIX),'on sheet',SHEET)
if changed!=len(FIX):
    sys.exit('ERROR: not all rows updated')
wb.save(XLSX)
print('saved',XLSX)
