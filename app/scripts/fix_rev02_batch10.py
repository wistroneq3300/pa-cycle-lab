# Precise per-(sheet,row) ai_commands fix for Round-02 batch 10 (Functionality rows 1803-2002, item 1801-2000).
#
# Classes fixed (all ai_commands col15 unless noted):
#  Q-LIT : inner unescaped double-quoted literal inside the outer ssh double-quoted string -> single-quote it.
#  R5    : OOB ipmitool / Redfish wrongly wrapped in a DUT-ssh string (runs on the wrong host) -> move to the agent host.
#  WR    : command content does not match the Items/Procedure -> rewrite to the procedure's real logic.
#  FAKE  : "not directly runnable / give exact bytes" placeholder that is actually runnable (Redfish) -> real command.
#  VERDICT : 1843 NO->YES (its SF600-flash text was a copy error; the real test is a read-only sensor list, same as siblings 1844/1845). pkg col14 corrected to ipmitool.
#
# Pure ASCII in the cell text where the original is ASCII. Row-located (not code-located). python-openpyxl.
import openpyxl, sys

XLSX = 'data/REVISED_commands_merged_with_raw.xlsx'
SHEET = 'Functionality'

SSH = 'sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP'
OOB = 'ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS"'

FIX = {}     # row -> new ai_commands (col15)
CAN = {}     # row -> new ai_can_execute (col13)   [batch10: only 1843]
PKG = {}     # row -> new ai_packages_needed (col14) [batch10: only 1843]

# =====================================================================
# Q-LIT : I2C board scan rows -- inner `grep -oE "i2c-[0-9]+"` double-quotes
#         break the outer ssh double-quoted string -> single-quote them.
# =====================================================================
def I2C(tag):
    body = ('"echo ---i2c_buses---; sudo i2cdetect -l 2>&1; echo ---scan_%s---; '
            'for b in $(sudo i2cdetect -l 2>/dev/null | grep -oE \'i2c-[0-9]+\' | cut -d- -f2); '
            'do sudo i2cdetect -y $b 2>/dev/null | head -20; done 2>&1"') % tag
    return SSH + ' ' + body

FIX[1803] = I2C('fan_bd')
FIX[1804] = I2C('pdb_bd')
FIX[1805] = I2C('hsc_bd')
FIX[1806] = I2C('rio_bd')
FIX[1807] = I2C('fio_bd')
FIX[1808] = I2C('cable')
FIX[1809] = I2C('m2_bd')
FIX[1812] = I2C('e1s_bd2')
FIX[1814] = I2C('e1s_bd1')

# =====================================================================
# Q-LIT : NVQual rows -- inner `echo "NVQual ..."` double-quotes broke the
#         outer ssh string -> drop the nested echo (clean single command),
#         keep the vendor-tool note (NVQual = operator-provided, PARTIAL).
# =====================================================================
FIX[1918] = ('-- NT.1_Network NVQual (ConnectX EOM Test): run NVIDIA NVQual on the BlueField. '
             'NVQual is a vendor tool (operator install + license/test topology); agent provides the launch wrapper + collects output.\n'
             + SSH + '"nvqual -h 2>&1 | head -n 20 2>&1"\n'
             '-- then run the specific NVQual NT.1 Network test per the NVIDIA docs once NVQual is installed (operator-provided).')
FIX[1919] = ('-- NT.4_Network NVQual (BlueField PCIe Interface Traffic Test / NVQual Test #21): run NVIDIA NVQual on the BlueField. '
             'NVQual is a vendor tool (operator install + license/test topology); agent provides the launch wrapper + collects output.\n'
             + SSH + '"nvqual -h 2>&1 | head -n 20 2>&1"\n'
             '-- then run NVQual test #21 per the NVIDIA docs once NVQual is installed (operator-provided).')

# =====================================================================
# R5 : OOB ipmitool / Redfish commands were wrapped inside a DUT-ssh string
#      (run on the wrong host) -> move to the agent host, single-quote inner patterns.
# =====================================================================
FIX[1843] = ('-- STATUS_UP_FAN 1~N: list the upper-fan status sensor rows via ipmitool (OOB, from the agent host) and confirm names/descriptions/readings match SPEC.\n'
             + OOB + " sdr list 2>&1 | grep -Ei 'FAN|UP_FAN|RPM' | head -n 60")
FIX[1844] = ('-- STATUS_LOW_FAN 1~N: list the low-fan status sensor rows via ipmitool (OOB, from the agent host) and confirm names/descriptions/readings match SPEC.\n'
             + OOB + " sdr list 2>&1 | grep -Ei 'FAN|LOW_FAN|RPM' | head -n 60")
FIX[1845] = ('-- STATUS_PSU 1~N: list the PSU sensor rows via ipmitool (OOB, from the agent host) and confirm names/descriptions/readings match SPEC.\n'
             + OOB + " sdr type 'Power Supply' 2>&1; echo ---PSU-SDR---; "
             + OOB + " sdr list 2>&1 | grep -Ei 'PSU|STATUS' | head -n 40")

# RAS EINJState (OOB Redfish) -- was inside a DUT ssh string -> agent host
FIX[1955] = ('-- RAS Enablement (AMD EINJState) via OOB Redfish from the agent host: read EINJState, and if disabled, enable it via the Redfish AMD ErrInjection action, then re-read.\n'
             + 'curl -s -k -u "$BMC_USER:$BMC_PASS" http://$BMC_IP/redfish/v1/Chassis/OAM_0 2>&1 | grep -i einjstate\n'
             '-- enable (write; operator approves) then re-read EINJState above.')

# Redfish GETs (TaskService / CertificateService / Manager Reset / GPU OEM)
# -- were inside a DUT ssh string -> agent host.
FIX[1966] = ('-- Get TaskService: GET /redfish/v1/TaskService (+ the current Tasks list) from the agent host.\n'
             + 'curl -s -k -u "$BMC_USER:$BMC_PASS" https://$BMC_IP/redfish/v1/TaskService 2>&1 | jq .\n'
             + 'curl -s -k -u "$BMC_USER:$BMC_PASS" https://$BMC_IP/redfish/v1/TaskService/Tasks 2>&1 | jq .')
FIX[1967] = ('-- Get CertificateService: GET /redfish/v1/CertificateService (+ its Actions) from the agent host.\n'
             + 'curl -s -k -u "$BMC_USER:$BMC_PASS" https://$BMC_IP/redfish/v1/CertificateService 2>&1 | jq .')
FIX[1969] = ('-- Get Redfish BMC Cold-Reset (ResetType ForceRestart): read the Manager ResetActionInfo from the agent host.\n'
             + 'curl -s -k -u "$BMC_USER:$BMC_PASS" https://$BMC_IP/redfish/v1/Managers/$MANAGER/ResetActionInfo 2>&1 | jq .')
FIX[1970] = ('-- Get Redfish GPU: read the OEM GPU Sensor/Power/FirmwareVersion from the agent host (OEM path per the vendor RestAPI spec).\n'
             + 'curl -s -k -u "$BMC_USER:$BMC_PASS" https://$BMC_IP/redfish/v1/Managers/$MANAGER/Oem/OemManagement/GPU/Sensor 2>&1 | jq .\n'
             + 'curl -s -k -u "$BMC_USER:$BMC_PASS" https://$BMC_IP/redfish/v1/Managers/$MANAGER/Oem/OemManagement/GPU/Power 2>&1 | jq .\n'
             + 'curl -s -k -u "$BMC_USER:$BMC_PASS" https://$BMC_IP/redfish/v1/Managers/$MANAGER/Oem/OemManagement/GPU/FirmwareVersion 2>&1 | jq .')

# =====================================================================
# WR : command content does not match the Items/Procedure -> rewrite to the
#      procedure's real logic.
# =====================================================================
# 1891: Items "TEMP_HIB_PEX1~4" but the sensor arg was the sibling row's "TEMP_LP1~8_Chip".
FIX[1891] = OOB + " sensor get 'TEMP_HIB_PEX1~4' 2>&1"

# 1958: Items "Check XGMI Link Status" (amdxio) but the command was a GFX error-injection text.
FIX[1958] = ('-- Check XGMI Link Status: confirm XGMI link connectivity across all nodes (forms a ring) and the links train to XGMI3 32Gbps x16 via amdxio (AMD vendor tool).\n'
             + SSH + '"sudo ./amdxio -xgmi -linkstatus 2>&1 | tail -n 40"\n'
             '-- amdxio is a vendor tool (operator-provided path); the operator installs it before the agent reads the ring status.')

# 1977: Items "Console Test" (COM-port console) but the command was a PCIe Tx-eq/LTSSM text.
FIX[1977] = ('-- Console Test (set the console through the COM port): the agent points the BMC serial console / SOL and reads the console stream; the physical COM-port wiring + a client terminal is the operator\'s part.\n'
             + OOB + ' sol info 2>&1\n'
             '-- operator: connect the SUT COM port to a client terminal, send a command, confirm correct output (the agent cannot wire the COM link).')

# =====================================================================
# FAKE : "not directly runnable / give exact bytes" that is actually runnable
#        (procedure is a Redfish ComputerSystem.Reset) -> real command.
#        (verdict col13 kept PARTIAL -- it is a WRITE/power-cycle that needs operator approve)
# =====================================================================
FIX[1962] = ('-- Power Cycle (Redfish ComputerSystem.Reset ResetType=PowerCycle): POST the reset from the agent host, then read back the power state.\n'
             + "curl -s -k -u \"$BMC_USER:$BMC_PASS\" -H \"Content-Type: application/json\" -X POST -d '{\"ResetType\":\"PowerCycle\"}' https://$BMC_IP/redfish/v1/Systems/system 2>&1\n"
             + "sleep 60\n"
             + "curl -s -k -u \"$BMC_USER:$BMC_PASS\" https://$BMC_IP/redfish/v1/Systems/system 2>&1 | jq .PowerState\n"
             '-- state-changing: the host reboots (R22 risk); the operator approves the power cycle before the agent runs it.')

# =====================================================================
# VERDICT change (col13): 1843 NO->YES. Its original command was SF600-flash
# text (a copy error in the "With SW BD Sensor List" block); the real test,
# exactly like sibling rows 1844/1845 (both YES), is a read-only fan-status
# sensor list the agent can run from the agent host. pkg col14 -> ipmitool.
# =====================================================================
CAN[1843] = 'YES'
PKG[1843] = 'ipmitool'


def main():
    xlsx = sys.argv[1] if len(sys.argv) > 1 else XLSX
    dry_only = (sys.argv[2] == 'dry') if len(sys.argv) > 2 else False
    wb = openpyxl.load_workbook(xlsx)
    if SHEET not in wb.sheetnames:
        print('ERROR: sheet %r not in workbook' % SHEET); sys.exit(2)
    ws = wb[SHEET]
    n_cmd = n_can = n_pkg = 0
    for r, v in sorted(FIX.items()):
        cur = ws.cell(row=r, column=15).value
        if cur is not None and str(cur) == v:
            print('row %d: unchanged (already correct)' % r); continue
        ws.cell(row=r, column=15).value = v
        n_cmd += 1
    for r, v in sorted(CAN.items()):
        ws.cell(row=r, column=13).value = v
        n_can += 1
    for r, v in sorted(PKG.items()):
        ws.cell(row=r, column=14).value = v
        n_pkg += 1
    print('applied  col15 ai_commands: %d   col13 ai_can_execute: %d   col14 ai_packages_needed: %d' % (n_cmd, n_can, n_pkg))
    if dry_only:
        print('DRY run -- NOT saving.'); wb.close(); return
    wb.save(xlsx)
    wb.close()

    # post-audit: reload the fixed rows and check for the defect signatures
    wb2 = openpyxl.load_workbook(xlsx, read_only=True)
    ws2 = wb2[SHEET]
    issues = []
    for r in sorted(FIX.keys()):
        v = ws2.cell(row=r, column=15).value
        s = '' if v is None else str(v)
        # a defect = an odd number of literal double-quotes (unbalanced) inside an ssh double-quoted command
        if 'ssh ' in s or 'sshpass' in s:
            # count double-quotes that are NOT part of the sshpass -p "$.."/$DUT... var refs and NOT JSON/echo literals we intended
            if s.count('"') % 2 != 0:
                issues.append((r, 'odd double-quote count %d' % s.count('"')))
    wb2.close()
    if issues:
        print('post-audit ISSUES:'); [print('   row', r, why) for r, why in issues]
    else:
        print('post-audit issues: NONE')


if __name__ == '__main__':
    main()
