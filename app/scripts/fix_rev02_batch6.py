# Precise per-(sheet,row) fix for Round-02 batch 6 (Functionality rows 1003-1202, item 1001-1200).
# Covers the IPMI deep sub-block.
# R29 : bare ipmitool subcommand (missing the `ipmitool` keyword) inside DUT-ssh -> add `sudo ipmitool`.
# WR  : wrong/misassigned command for the test item (SEL-alloc/reserve rows pointed at sensor-get/screen)
#       -> replace with the procedure's raw command.
# OOBinband: IB-title rows whose command wrongly used `ipmitool -I lanplus ...` -> in-band `sudo ipmitool raw`.
# GUID-fix : Get Device GUID (OOB) had wrong netfn/cmd byte 0x0a 0x49 (=Set SEL Time) -> 0x06 0x08.
# One verdict cell: row 1195 Reserve SEL (OOB) mislabelled NO (bogus screen test) -> YES (OOB raw, agent-runnable).
# Pure ASCII only in this script. Uses python-openpyxl.
import openpyxl, sys

XLSX = 'data/REVISED_commands_merged_with_raw.xlsx'
SHEET = 'Functionality'
DUT = 'sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "'
OOB = 'ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" '

FIX_CMD = {
# ---- R29: IB rows with bare ipmitool subcommand (add sudo ipmitool; state-changing adds read-back) ----
1045: DUT + 'sudo ipmitool lan print 2>&1"',
1049: DUT + 'sudo ipmitool sol info 2>&1"',
1050: DUT + 'sudo ipmitool chassis capability 2>&1"',
1051: DUT + 'sudo ipmitool chassis status 2>&1"',
1052: DUT + 'sudo ipmitool chassis power on 2>&1; sleep 5; sudo ipmitool chassis power status 2>&1"',
1053: DUT + 'sudo ipmitool chassis power reset 2>&1; sleep 60; sudo ipmitool chassis power status 2>&1"',
1054: DUT + 'sudo ipmitool chassis identify 2>&1"',
1059: DUT + 'sudo ipmitool chassis restart-cause 2>&1"',
1062: DUT + 'sudo ipmitool chassis poh 2>&1"',
1066: DUT + 'sudo ipmitool sel info 2>&1"',
1069: DUT + 'sudo ipmitool sel list 2>&1"',
1073: DUT + 'sudo ipmitool sel clear 2>&1; sleep 2; sudo ipmitool sel info 2>&1"',
1074: DUT + 'sudo ipmitool sel time get 2>&1"',
1075: DUT + 'sudo ipmitool sel time set $(date +%s) 2>&1; sudo ipmitool sel time get 2>&1"',
1083: DUT + 'sudo ipmitool sdr list -v 2>&1"',
1108: DUT + 'sudo ipmitool sensor get \'*\' 2>&1"',
1110: DUT + 'sudo ipmitool sensor info 2>&1"',
# ---- WR: wrong/misassigned command replaced by the procedure's raw command ----
1057: DUT + 'sudo ipmitool raw 0x00 0x06 ${POWER_RESTORE_POLICY:?operator must set policy byte 0=always-off 1=previous 2=always-on} 2>&1; sleep 5; sudo ipmitool raw 0x00 0x01 2>&1"',
1058: DUT + 'sudo ipmitool raw 0x00 0x2c ${POWER_CYCLE_INTERVAL_MS:?operator must set the power cycle interval in ms} 2>&1; sudo ipmitool raw 0x00 0x2d 2>&1"',
1067: DUT + 'sudo ipmitool raw 0x0a 0x41 2>&1"',
1068: DUT + 'sudo ipmitool raw 0x0a 0x42 2>&1"',
1070: DUT + 'sudo ipmitool raw 0x0a 0x44 0x01 0 0x02 0x01 0x01 0x01 0x01 0x20 0 0x04 ${SENSOR_TYPE:?operator must set the sensor type byte} 0x40 0x81 0x0b 0 0 2>&1; sleep 2; sudo ipmitool sel list 2>&1"',
1095: DUT + 'sudo ipmitool raw 0x0a 0x12 ${FRU_OFFSET:?operator must set the FRU offset byte (hex)} ${FRU_DATA:?operator must set the FRU data byte (hex)} 2>&1; sudo ipmitool fru print 0 2>&1"',
1111: DUT + 'sudo ipmitool raw 0x04 0x30 ${SENSOR_NUMBER:?operator must set the sensor number byte} 2>&1"',
# ---- OOB-inband: IB-title rows whose command wrongly used lanplus -> in-band sudo ipmitool raw ----
1112: DUT + 'sudo ipmitool raw 0x30 0x24 ${MFG_DATE_BYTES:?operator must set the FRU mfg date bytes} 2>&1"',
1113: DUT + 'sudo ipmitool raw 0x30 0x25 ${REQUEST_BYTES:?operator must set the i2c request bytes (bus/addr/readcount/data)} 2>&1"',
1114: DUT + 'sudo ipmitool raw 0x30 0x26 2>&1"',
1115: DUT + 'sudo ipmitool raw 0x30 0x41 2>&1; sleep 10; sudo ipmitool mc info 2>&1"',
1116: DUT + 'sudo ipmitool raw 0x30 0x40 ${ETH_SELECT:?operator must set 0=eth0 1=eth1} 2>&1; sudo ipmitool lan print 2>&1"',
1117: DUT + 'sudo ipmitool raw 0x30 0x23 0x03 2>&1"',
# ---- GUID-fix: Get Device GUID (OOB) byte correction ----
1125: OOB + 'raw 0x06 0x08 2>&1',
# ---- WR (OOB): Get SEL Allocation Info (OOB) / Reserve SEL (OOB) were misassigned ----
1194: OOB + 'raw 0x0a 0x41 2>&1',
1195: OOB + 'raw 0x0a 0x42 2>&1',
}

# rows whose ai_can_execute (col13) must change: 1195 Reserve SEL (OOB) NO -> YES
FIX_AI = {1195: 'YES'}

wb = openpyxl.load_workbook(XLSX)
ws = wb[SHEET]
changed = 0
missing = []
for rownum, newcmd in FIX_CMD.items():
    if ws.cell(row=rownum, column=1).value is None:
        missing.append(rownum)
        continue
    ws.cell(row=rownum, column=15, value=newcmd)
    changed += 1
aich = 0
for rownum, newai in FIX_AI.items():
    if ws.cell(row=rownum, column=1).value is None:
        missing.append(rownum)
        continue
    ws.cell(row=rownum, column=13, value=newai)
    aich += 1
if missing:
    print('MISSING rows:', missing)
print('cmd cells changed', changed, 'of', len(FIX_CMD), '| ai cells changed', aich, 'of', len(FIX_AI), 'on sheet', SHEET)
if changed != len(FIX_CMD) or aich != len(FIX_AI):
    sys.exit('ERROR: not all rows updated')
wb.save(XLSX)
print('saved', XLSX)
