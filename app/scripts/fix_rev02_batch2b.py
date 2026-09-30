# Precise per-(sheet,row) ai_commands fix for Round-02 batch 2b (Functionality rows 202-401).
# Same defect classes as batch2a:
#  - Q-LIT: inner double-quoted grep/echo pattern -> single quotes (parse-breaking inside outer ssh arg)
#  - DBL-SSH: nested self-ssh (second sshpass/ssh inside the remote string) -> collapse to one ssh layer
#  - R5: OOB ipmitool lanplus wrongly wrapped inside DUT-ssh -> run on agent host
# Pure ASCII only in this script. Uses python-openpyxl.
import openpyxl, sys

XLSX='data/REVISED_commands_merged_with_raw.xlsx'
SHEET='Functionality'
# key = Functionality xlsx row; commands apply to exactly this row
FIX={
235: r'''-- BIOS FW Recovery: recover the BIOS from a forced corrupt/empty state using the recovery image/RoP (Recovery of Last Resort) mechanism; operator stages the image offline / via the BMC recovery flow. Agent only reads back BMC controller info after recovery (OOB, agent host): ipmitool -I lanplus -C 17 -U "$BMC_USER" -P "$BMC_PASS" -H "$BMC_IP" mc info 2>&1 | head -20''',
239: r'''-- AST1060 FW Recovery: recover the AST1060 from a forced corrupt/empty state using the recovery image/RoP (Recovery of Last Resort) mechanism; operator stages the image offline / via the BMC recovery flow. Agent only reads back BMC controller info after recovery (OOB, agent host): ipmitool -I lanplus -C 17 -U "$BMC_USER" -P "$BMC_PASS" -H "$BMC_IP" mc info 2>&1 | head -20''',
344: r'''-- Bios FW recovery(only offline): recover the BIOS-RoT from a forced corrupt/empty state using the recovery image/RoP (Recovery of Last Resort) mechanism; operator stages the image offline / via the BMC recovery flow. Agent only reads back BMC controller info after recovery (OOB, agent host): ipmitool -I lanplus -C 17 -U "$BMC_USER" -P "$BMC_PASS" -H "$BMC_IP" mc info 2>&1 | head -20''',
246: r'''sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "for d in $(lsblk -dpno NAME | grep -E 'nvme|sd'); do echo === $d ===; smartctl -a $d 2>&1 | head -40; done 2>&1"  ;  sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "lsblk -o NAME,SERIAL,MODEL,SIZE,TRAN 2>&1"''',
252: r'''sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "lsblk -o NAME,SERIAL,MODEL,TYPE 2>&1 ; ls /dev/nvme* 2>&1 ; for n in /dev/nvme*n1; do echo === $n ===; nvme id-ctrl $n 2>&1 | head -30; done 2>&1"''',
271: r'''sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "for d in $(lsblk -dpno NAME | grep -E 'nvme|sd'); do echo === $d ===; smartctl -a $d 2>&1 | head -40; done 2>&1"  ;  sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "lsblk -o NAME,SERIAL,MODEL,SIZE,TRAN 2>&1"''',
277: r'''sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "lsblk -o NAME,SERIAL,MODEL,TYPE 2>&1 ; ls /dev/nvme* 2>&1 ; for n in /dev/nvme*n1; do echo === $n ===; nvme id-ctrl $n 2>&1 | head -30; done 2>&1"''',
279: r'''sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "for d in $(lsblk -dpno NAME | grep -E 'nvme|sd'); do echo === $d ===; smartctl -a $d 2>&1 | head -40; done 2>&1"  ;  sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "lsblk -o NAME,SERIAL,MODEL,SIZE,TRAN 2>&1"''',
285: r'''sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "lsblk -o NAME,SERIAL,MODEL,TYPE 2>&1 ; ls /dev/nvme* 2>&1 ; for n in /dev/nvme*n1; do echo === $n ===; nvme id-ctrl $n 2>&1 | head -30; done 2>&1"''',
226: r'''-- Flash stress: CPLD flash stress (flash + reboot + verify) repeated 100 times. Agent can run the flash+reboot+verify loop in software sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "for i in $(seq 1 100); do echo === cycle $i $(date) ===; flash_cpld $CPLD_IMG 2>&1 | tail -n 2; sync; systemctl reboot >/dev/null 2>&1; sleep 20; done 2>&1" ; needs the CPLD flash tool + a reboot-loop controller.''',
295: r'''-- Check PCIe: check the ConnectX-7 PCIe device ID, vendor ID, speed and bandwidth sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "lspci -nn 2>&1 | grep -i 'Mellanox\|15b3'; lspci -s $(lspci -nn 2>/dev/null | grep -i 'Mellanox\|15b3' | head -1 | cut -d' ' -f1) -vvv 2>&1 | grep -iE 'LnkCap|LnkSta|DeviceName|Device' 2>&1".''',
301: r'''-- Driver Flash & Check: flash/check the GPU driver + firmware sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "nvidia-smi --query-gpu=driver_version,vbios_version --format=csv 2>&1; nvidia-smi -q 2>&1 | grep -iE 'Driver Version|VBios' | head 2>&1"; driver install is a multi-step package setup.''',
302: r'''-- Check PCIe: check the GPU PCIe link sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "lspci | grep -i -E 'NVIDIA' 2>&1; lspci -vv -s $(lspci | grep -i nvidia | head -n1 | cut -d' ' -f1) 2>&1 | grep -iE 'LnkSta|LnkCap' | head -n 4 2>&1".''',
303: r'''-- Check ROM version: read the GPU ROM/BIOS version sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "nvidia-smi --query-gpu=name,vbios_version --format=csv 2>&1; command -v nvsm >/dev/null 2>&1 && nvsm show version 2>&1 || echo 'nvsm not installed' 2>&1".''',
336: r'''-- BIOS Menu - CPU / DIMM / HDD / PCIe Card: enumerate CPU/DIMM/HDD/PCIe in the BIOS menu and cross-check the OS sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "lscpu 2>&1 | grep -iE 'Model name|Socket'; sudo dmidecode -t memory 2>&1 | grep -iE 'Size|Speed|Type:'; lsblk 2>&1; lspci 2>&1 | head -n 30"; the BIOS-menu view is a BIOS screenshot step.''',
388: r'''-- Secure Boot: verify the Secure Boot state sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "mokutil --sb-state 2>&1; dmesg | grep -iE 'Secure boot|secureboot' | head -n 10 2>&1"; enabling/disabling Secure Boot itself is a BIOS-Security-page UI change (human step), the OS state read is automated.''',
389: r'''-- Setup Prompt Timeout: Setup Prompt Timeout is a BIOS setup item; verifying it requires the operator to change it in the BIOS UI and observe the boot delay. The agent can read the current default: echo 'BIOS setup value read only at console'; but the UI interaction is human.''',
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
