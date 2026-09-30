# Precise per-(sheet,row) ai_commands fix for Round-02 batch 8 (Functionality rows 1403-1602, item 1401-1600).
#
# Classes fixed (all ai_commands col15; ONE ai_can_execute change row 1456):
#  Q-LIT : ssh inner bare double-quoted grep/echo breaks the outer ssh string -> single-quote the inner pattern.
#  DBL-SSH: nested `sshpass ... ssh` inside an outer ssh string -> collapse to a single ssh hop.
#  R5    : Redfish curl (agent-host BMC access) wrongly wrapped in DUT-ssh -> move to agent-host one-liner.
#  WR    : misassigned/wrong command (content does not match the Items/procedure) -> rewrite to the procedure's real logic.
#  FAKE  : placeholder `echo ...` (no real test) + vendor tool -> ${TOOL_PATH:?} wrapper (section 19r).
#
# Pure ASCII only. Row-located (not code-located). Uses python-openpyxl.
# NOTE: literal bash `${VAR:?...}` braces must NOT go through str.format(); we inline the ssh
# token directly via string concatenation instead of .format() on strings that contain `${...}`.
import openpyxl, sys

XLSX = 'data/REVISED_commands_merged_with_raw.xlsx'
SHEET = 'Functionality'

SSH = 'sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP'
OOB = 'ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS"'
RF_GET = 'curl -s -k -u "$BMC_USER:$BMC_PASS" -H "Content-Type: application/json" -X GET https://$BMC_IP'

FIX = {}

# ---- Q-LIT: inner grep/echo double-quote -> single-quote; 1435 also collapses nested ssh ----
FIX[1433] = ('-- BIOS Menu - FW Version Check: read the BIOS firmware version from OS + the BMC-reported BIOS.\n'
  + SSH + ' "dmidecode -s bios-version 2>&1; dmidecode -t 0 2>&1 | grep -iE \'Version|Release Date\' 2>&1" 2>&1\n'
  + OOB + ' fru print 2>&1 | head -40')
FIX[1434] = ('-- BIOS Menu - Date: read the BIOS build/release date.\n'
  + SSH + ' "dmidecode -t 0 2>&1 | grep -iE \'Release Date\' 2>&1" 2>&1')
FIX[1435] = ('-- BIOS Menu - CPU / DIMM / HDD / PCIe Card: enumerate CPU/DIMM/HDD/PCIe and cross-check with the OS; the BIOS-menu view is a BIOS screenshot step.\n'
  + SSH + ' "lscpu 2>&1 | grep -iE \'Model name|Socket\'; dmidecode -t memory 2>&1 | grep -iE \'Size|Speed|Type:\'; lsblk 2>&1; lspci 2>&1 | head -n 30" 2>&1')
FIX[1465] = SSH + ' "dmidecode -t 0 2>&1 | grep -i \'version\' 2>&1"'
FIX[1466] = SSH + ' "dmidecode -t 0 2>&1 | grep -i \'revision\' 2>&1"'
FIX[1484] = ('-- Reboot 5 times: perform 5 OOB power cycles, confirming each reboot reaches the OS.\n'
  + 'for i in 1 2 3 4 5; do\n'
  + '  ' + OOB + ' chassis power cycle 2>&1\n'
  + '  sleep 60\n'
  + '  ' + SSH + ' "echo \'reboot $i\'; uptime 2>&1" 2>&1\n'
  + 'done')
FIX[1529] = ('-- Idle 8 hrs: let the SUT idle 8h and confirm no spontaneous errors; agent monitors the OS log + BMC SEL over the period.\n'
  + SSH + ' "sleep 28800; grep -iE \'error|panic|oops|fail\' /var/log/messages 2>&1 | tail -40" 2>&1')

# ---- DBL-SSH: collapse nested ssh (1596) ----
FIX[1596] = ('-- GPU management - Versions: list the GPU firmware/driver versions on the DUT.\n'
  + SSH + ' "nvidia-smi --query-gpu=name,driver_version,vbios_version --format=csv 2>&1; nvsm show version 2>&1" 2>&1')

# ---- R5: Redfish curl moved from DUT-ssh to agent-host (1499) ----
FIX[1499] = (
  '-- FW Flash by Redfish - BMC: flash the BMC firmware via Redfish UpdateService using the user-designated BMC image; state-changing.\n'
  + 'curl -s -k -u "$BMC_USER:$BMC_PASS" -X POST -H "Content-Type: multipart/form-data" '
  + '-F "UpdateParameters=${BMC_FW_UPDPARA:?optional};@${BMC_IMAGE:?operator must provide a BMC .ima image path}" '
  + '"https://$BMC_IP/redfish/v1/UpdateService/Actions/UpdateService.Update" 2>&1\n'
  + RF_GET + '/UpdateService/FirmwareInventory | jq -r \'.Members[].Id\' 2>&1')

# ---- WR: rewrite wrong command to the procedure's real logic ----
FIX[1436] = ('-- BMC Web UI - BIOS Version: read the BIOS version shown in the BMC (Redfish FirmwareInventory) and in the OS.\n'
  + RF_GET + '/UpdateService/FirmwareInventory | jq -r \'.Members[].@odata.id\' 2>&1\n'
  + SSH + ' "dmidecode -s bios-version 2>&1" 2>&1')
FIX[1437] = ('-- Event Log - Check Event Log: boot the system and read the OS + BMC event logs; confirm a clean boot with no error entries.\n'
  + SSH + ' "uptime 2>&1; dmesg -T 2>&1 | tail -n 40" 2>&1\n'
  + OOB + ' sel list 2>&1 | tail -n 40')
FIX[1455] = ('-- FW package check - Release Note: review the firmware release note (general info, FW version, new features/defects fixed, known issues); documentation review only.\n'
  + '-- not runnable by agent: release-note content is a documentation review performed by the operator/test owner.')
FIX[1456] = ('-- FW File checksum: verify the FW image integrity with md5sum using the user-designated image; no state change.\n'
  + 'md5sum ${FW_IMAGE:?operator must provide the FW image path to checksum} 2>&1')
FIX[1457] = ('-- BIOS Flash Method - Upgrade: flash the BIOS to the latest version, reboot, and confirm the version in BIOS/OS. State-changing, pre-OS UEFI/AMI flash.\n'
  + '-- not runnable by agent: flashing the BIOS ROM is a state-changing/pre-OS action requiring the user image + interactive UEFI flash; agent only reads back the version afterwards.')
FIX[1458] = ('-- BIOS Flash Method - Same Version: re-flash the BIOS to the same version, reboot, and confirm the version. State-changing, pre-OS UEFI/AMI flash.\n'
  + '-- not runnable by agent: flashing the BIOS ROM is state-changing/pre-OS; agent only reads back the version afterwards.')
FIX[1459] = ('-- BIOS Flash Method - Downgrade: flash the BIOS to the previous version, reboot, and confirm the version. State-changing, pre-OS UEFI/AMI flash.\n'
  + '-- not runnable by agent: flashing the BIOS ROM is state-changing/pre-OS; agent only reads back the version afterwards.')
FIX[1460] = ('-- Flash by SF600: flash the BIOS via the SF600 hardware programmer, reboot, and confirm the version. Requires physical SF600 hookup + user image.\n'
  + '-- not runnable by agent: flashing via the SF600 hardware programmer is a physical hookup action; agent only reads back the version afterwards.')
FIX[1516] = ('-- Dedicated NIC: read the BMC dedicated-NIC LAN config + MAC and confirm a single bounded channel.\n'
  + OOB + ' lan print 2>&1 | grep -iE \'MAC|Channel|Addr\'\n'
  + RF_GET + '/Managers/bmc/EthernetInterfaces | jq -r \'.Members[].@odata.id\' 2>&1')
FIX[1517] = ('-- LED: plug the network cable and check the BMC port link status + link LED.\n'
  + RF_GET + '/Managers/bmc/EthernetInterfaces | jq -r \'.Members[]?|.Id+": "+.LinkStatus\' 2>&1\n'
  + OOB + ' lan print 2>&1 | grep -iE \'Link|Speed|MAC\' 2>&1')
FIX[1562] = ('-- ACPI Settings - AC Loss Control: read/set the AC-loss power-restore policy via OOB chassis policy to match the BIOS setting; verifying the cycle-behavior after a real AC loss needs the operator to cut/restore AC (physical).\n'
  + OOB + ' chassis policy always-off 2>&1\n'
  + OOB + ' chassis status 2>&1 | grep -iE \'Power|Last Power\' 2>&1')

# ---- WR + vendor-tool wrapper for AMD SVM rows (section 19r: no invented vendor run cmd) ----
FIX[1530] = ('-- Check WAFL Link Status: run the AMD XIO tool to check the WAFL link status (2 WAFL links from each GPU, Link Speed 2 GT/s, Link Width 1).\n'
  + SSH + " \"cd ${AMD_XIO_DIR:?operator must set the amdxio tool directory} && ./amdxio -wafl -linkstatus 2>&1\" 2>&1")
FIX[1531] = ('-- High-Bandwidth Memory (HBM) Thermal Stress Test: collect all-8-GPU power via the AGT PM logger and run the BabelStream (hip-stream) workload on each GPU.\n'
  + SSH + " \"cd ${AGT_DIR:?operator must set the AGT tool directory} && ./agt -i=0,5,10,15,20,25,30,35 -unilog=PM -unilogallgroups -unilogperiod=1000 -unilogoutput=pm_hbm.csv 2>&1\" 2>&1 &\n"
  + 'for dev in 0 1 2 3 4 5 6 7; do ' + SSH + " \"ROCR_VISIBLE_DEVICES=$dev ./hip-stream --device $dev -e -s $((825*1024*1024)) -n 15000 --dot-only 2>&1 | tail -n 5\" 2>&1 & done\n"
  + 'wait')
FIX[1532] = ('-- Individual GPU Thermal Test: read per-GPU temp/power/clk via amd-smi and run the Coralgemm gemm thermal workload on one GPU.\n'
  + SSH + ' "amd-smi monitor -w 5 2>&1 | head -n 60" 2>&1\n'
  + SSH + " \"cd ${GSTOOL_DIR:?operator must set the gemm/AGT tool directory} && ROCR_VISIBLE_DEVICES=${GPU_ID:?operator must set the GPU index 0-7} ./gemm R_64F R_64F R_64F R_64F OP_N OP_T 8640 8640 8640 8640 8640 8640 96 900 strided 2>&1 | tail -n 40\" 2>&1")

# ---- FAKE: placeholder echo -> vendor-tool wrapper (section 19r) ----
FIX[1418] = ('-- Mi300 GPU FRU write-protect: verify the Mi300 GPU FRU write-protect is enabled via the AMD write-protect utility.\n'
  + SSH + " \"${GPU_FRU_WP_TOOL:?operator must provide the AMD Mi300 GPU FRU write-protect utility path} --status 2>&1\" 2>&1")
FIX[1419] = ('-- GPU VBIOS FW write-protect: verify the GPU VBIOS FW write-protect is enabled via the AMD write-protect utility.\n'
  + SSH + " \"${GPU_VBIOS_WP_TOOL:?operator must provide the AMD GPU VBIOS FW write-protect utility path} --status 2>&1\" 2>&1")
FIX[1420] = ('-- SW FW write-protect: verify the SW FW write-protect is enabled via the AMD write-protect utility.\n'
  + SSH + " \"${SW_FW_WP_TOOL:?operator must provide the AMD SW FW write-protect utility path} --status 2>&1\" 2>&1")
FIX[1421] = ('-- Software write-protect disable: set the software write-protect to disabled via the vendor utility; state-changing security setting.\n'
  + SSH + " \"${SW_WP_TOOL:?operator must provide the AMD software write-protect utility path} --disable 2>&1; ${SW_WP_TOOL} --status 2>&1\" 2>&1")

# Verdict (ai_can_execute) changes this batch - single exception, row 1456 (see header).
VERDICT = {1456: 'YES'}

wb = openpyxl.load_workbook(XLSX)
ws = wb[SHEET]
changed = 0
missing = []
for rownum, newcmd in FIX.items():
    code = ws.cell(row=rownum, column=1).value
    if code is None:
        missing.append(rownum)
        continue
    ws.cell(row=rownum, column=15, value=newcmd)
    changed += 1
vchanged = 0
for rownum, newv in VERDICT.items():
    ws.cell(row=rownum, column=13, value=newv)
    vchanged += 1
if missing:
    print('MISSING rows:', missing)
print('changed', changed, 'of', len(FIX), 'cmd rows +', vchanged, 'verdict rows (', sorted(VERDICT), ') on sheet', SHEET)
if changed != len(FIX):
    sys.exit('ERROR: not all rows updated')
wb.save(XLSX)
print('saved', XLSX)
