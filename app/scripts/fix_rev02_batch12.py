# Precise per-(sheet,row) ai_commands fix for Round-02 batch 12 (Functionality rows 2203-2292, item 2201-2290).
#
# This is the LAST window of the Functionality sheet (table total 2291 rows; 2200 done -> 90 remaining).
#
# Classes fixed:
#  WR     : command content does not match the Items/Procedure -> rewrite to the procedure's real logic
#           (copy errors: 2203 M.2-flash-text on a USB2/3 check; 2209 PCIe-BW-text on AC-Cycle;
#           2277 I2C "HSC_BD" text on a Release-note doc check; 2287 PCIe-Tx-eq text on a Thermal stress;
#           2290/2291 "E1S-LED" text on I3C CPU1 checks; 2241 HTTPBasicAuth missing the full flow;
#           2273 MLPerf only a lscpu pre-check instead of the benchmark).
#  Q-LIT  : inner unescaped double-quoted literal inside the outer ssh double-quoted string -> single-quote it.
#  R5     : OOB/`ipmitool -I lanplus` wrongly wrapped in a DUT-ssh double hop -> agent-host direct.
#  FAKE   : "not directly runnable / give exact bytes" that is actually runnable (TEMP_HIB_PEX sensor-get,
#           mirrors batch10 row 1891 same Test Set / sensor family -> YES).
#  VERDICT: col13 flip 2241 YES->PARTIAL (state-changing security toggle + factory reset, needs operator
#           approve) and 2272 PARTIAL->YES (read-only OOB sensor get, sibling 1891 is YES).
#  PKG    : col14 corrections for the rows whose ai_commands changed (2203/2209/2273/2287/2290/2291).
#
# Row-located (not code-located). python-openpyxl.
#
# Construction convention for a cell string:
#   note_lines joined by chr(10). The SSH remote is written as  ss(<remote>)  =  SSH + DQ + <remote> + DQ.
#   <remote> carries only single-quoted patterns plus, where a backslash must SURVIVE into the cell,
#   the literal backslash is emitted via the BS (chr(92)) constant so the source stays legible.
import openpyxl, sys

XLSX = 'data/REVISED_commands_merged_with_raw.xlsx'
SHEET = 'Functionality'
NL = chr(10)
BS = chr(92)
DQ = chr(34)

SSH = 'sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP'
OOB = 'ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS"'
BMC_SSH = 'sshpass -p "$BMC_PASS" ssh -o StrictHostKeyChecking=no "$BMC_USER"@"$BMC_IP"'


def ss(remote):
    return SSH + DQ + remote + DQ


def bmc_ss(remote):
    return BMC_SSH + DQ + remote + DQ


FIX = {}
CAN = {}
PKG = {}

# ---------- WR : command content does not match Items/Procedure ----------
# 2203 USB2/3 Function Check (TS "USB Hubs, Device(MCU)") had an M.2-FW-flash text (copy error).
#   Criteria = TBD -> report-level UNRESOLVED, but the copy error is still rewritten (batch11 TBD pattern).
FIX[2203] = ('-- USB2/3 Function Check: verify the USB hub/device (MCU) enumerates and USB2/USB3 ports reach '
             'the expected link speed (480M / 5Gbps) on the DUT.'
             + NL + ss("lsusb -t 2>&1 | head -n 60; lsusb 2>&1 | head -n 40 2>&1")
             + NL + '-- Criteria is TBD in the library (report-level UNRESOLVED); agent runs the enumeration read.')

# 2209 AC Cycle - Speed&Link (TS "PCIe") had the sibling 2207 "PCIe BW stress" text (copy error).
#   Real test: operator AC-cycle overnight, agent records lspci link speed/width pre/post and confirms normal.
FIX[2209] = ('-- AC Cycle - Speed&Link: the operator performs the AC power cycle (overnight); after each cycle '
             'the agent records PCIe link speed/width and confirms all speeds/link statuses are normal.'
             + NL + ss("lspci -nn 2>&1 | grep -iE 'Mellanox|Processing accelerators|VGA|3D controller'; "
                       "lspci -vv 2>&1 | grep -iE 'LnkSta:|LnkCap:' 2>&1")
             + NL + '-- AC power plug/unplug is an operator physical step; the agent reads the link state after each cycle.')

# 2228 IPMI selftest (IB + OOB): the OB part wrongly ran `ipmitool -I lanplus` inside the DUT ssh (R5).
#   -> IB via DUT ssh, OB via agent-host OOB (mirrors batch9 1659/1660 IB+OOB structure).
FIX[2228] = ('-- IPMI selftest support (IB and OOB): run the IPMI self-test in-band on the DUT and '
             'out-of-band from the agent host, then check the selftest result.'
             + NL + ss("ipmitool mc selftest 2>&1")
             + NL + OOB + ' mc selftest 2>&1')

# 2230 System Inventory: OOB `ipmitool ... fru print` was wrapped in a DUT ssh (R5) with inner "$BMC_IP"
#   double-quotes (Q-LIT) -> agent-host OOB fru print; the BMC WebUI per-category view stays operator-read.
FIX[2230] = ('-- System Inventory: read the BMC system inventory (system/processor/memory/baseboard/power/'
             'thermal/PCIe/storage/network) via OOB ipmitool-fru from the agent host.'
             + NL + OOB + ' fru print 2>&1 | head -n 60'
             + NL + '-- the BMC WebUI per-category inventory view is operator-read for the visual confirmation.')

# 2241 Add HTTPBasicAuth - Redfish: only the baseline GET was present; the real test toggles HTTPBasicAuth
#   (PATCH Disabled -> re-GET 401) then restores via factory reset. State-changing security setting (can lock
#   out access) -> operator approves. Verdict col13 YES->PARTIAL.
FIX[2241] = ('-- Add HTTPBasicAuth - Redfish: verify the HTTPBasicAuth toggle on the BMC AccountService. '
             'Baseline GET (expect 200), PATCH HTTPBasicAuth=Disabled, re-GET (expect 401), then restore '
             'via factory reset. Disabling basic auth is state-changing and can lock out access - the '
             'operator approves before the agent runs it.'
             + NL + 'curl -s -k -u "$BMC_USER:$BMC_PASS" -i https://$BMC_IP/redfish/v1/Systems 2>&1 | head -n 12'
             + NL + 'curl -s -k -u "$BMC_USER:$BMC_PASS" -H "Content-Type: application/json" -X PATCH '
                    + '-d \'{"HTTPBasicAuth":"Disabled"}\' https://$BMC_IP/redfish/v1/AccountService 2>&1'
             + NL + 'curl -s -k -u "$BMC_USER:$BMC_PASS" -i https://$BMC_IP/redfish/v1/Systems 2>&1 | head -n 12'
             + NL + '-- restore: `ipmitool raw 0x3a 0x41` (factory reset) re-enables basic auth (operator/system).')

# 2259 Install OS (sheet-B Secure Boot): the embedded `grep -iE "secure boot|setup mode"` used double quotes
#   inside the outer ssh double-quoted remote -> single-quote the grep pattern (Q-LIT).
FIX[2259] = ('-- Install OS sheet-B (Secure Boot enabled): install Windows Server with Secure Boot/TPM on the '
             'SUT. Agent pre-checks the secure-boot state from the OS; the OS install itself needs the '
             'Windows ISO + interactive setup (BIOS F1, RAID driver loading) performed by an operator.'
             + NL + ss("bootctl status 2>&1 | grep -iE 'secure boot|setup mode'; mokutil --sb-state 2>&1"))

# 2272 TEMP_HIB_PEX (TS "IPM Sensor List Commands"): the "not directly runnable / give exact bytes" text is
#   FAKE - the same OOB sensor-get as sibling row 1891 (batch10, YES) applies. Verdict col13 PARTIAL->YES.
FIX[2272] = ('-- TEMP_HIB_PEX: read the TEMP_HIB_PEX sensor via ipmitool (OOB, from the agent host) and '
             'confirm name/description/reading match SPEC.'
             + NL + OOB + " sensor get 'TEMP_HIB_PEX' 2>&1")

# 2273 MLPerf - Retinanet _Offline: the command was only a lscpu/dmidecode pre-check (U-fake-completion
#   section 19o) with inner grep double-quotes (Q-LIT). Rebuild: pre-check + the real MLPerf benchmark via
#   the operator-provided harness (section 19r, MLPerf = YES once the tool/sop are given per locked 21).
FIX[2273] = ('-- MLPerf - Retinanet Offline: pre-check the SUT inventory, then run the MLPerf inference '
             'benchmark (retinanet / offline) with the operator-provided MLPerf harness and compare the '
             'score against MLCommons v5.0.'
             + NL + ss("lscpu 2>&1 | grep -iE 'vendor|model name|architecture'; dmidecode -t 4 2>/dev/null | "
                       "grep -iE 'manufacturer|version|family' | head; nvidia-smi 2>&1 | head -n 12")
             + NL + ss('cd ${MLPERF_DIR:?operator provides the MLPerf inference toolkit path}; '
                       '${MLPERF_RUN_CMD:?operator provides the MLPerf run command for retinanet/offline} '
                       '2>&1 | tail -n 60')
             + NL + '-- MLPerf harness/CUDA/GPU driver/weights are operator-provided (licensed data).')

# 2277 Release note (TS "FW package check") had an I2C "HSC_BD" board test text (copy error) -> rewrite to
#   the real release-note document check. NO (human document review, agent does not produce it).
FIX[2277] = ('-- Release note: verify the FW package release note - general information, FW version, '
             'new features/defects fixed and known issues - is readable with no spelling errors and the '
             'FW version is correct; human document review (agent does not produce it).')

# 2279 BMC FW Recovery: inner `echo "place image..."` double-quote (Q-LIT) + `ipmitool -I lanplus` inside the
#   DUT ssh (R5) -> the recovery flow is operator-staged; the agent reads back the BMC state OOB from the
#   agent host after recovery.
FIX[2279] = ('-- BMC FW Recovery: recover the BMC from a forced corrupt/empty state via the recovery image/RoP '
             '(Recovery of Last Resort) mechanism; the recovery flow is staged by the operator (offline / BMC '
             'recovery flow). After recovery the agent reads back the BMC state from the agent host.'
             + NL + OOB + ' mc info 2>&1 | head -n 20')

# 2287 TH.1_Thermal Stress Test (TS "Thermal") had an EC.22 PCIe Tx-equalization/LTSSM text (copy error) ->
#   rewrite to the real full-power thermal stress + thermal sensor poll. Worst-case ambient/chamber is
#   operator setup (PARTIAL); agent runs the load and reads thermal sensors.
FIX[2287] = ('-- TH.1_Thermal Stress Test: run a full-power thermal stress on the DUT (CPU/GPU + external '
             'components) and confirm no thermal warnings/faults are logged. The worst-case ambient / thermal '
             'chamber is operator setup.'
             + NL + ss("stress-ng --cpu 0 --cpu-method all --timeout ${THERMAL_DURATION:?operator sets the soak "
                       "duration} 2>&1 | tail -n 15; nvidia-smi --query-gpu=name,temperature.gpu --format=csv,"
                       "noheader 2>&1")
             + NL + OOB + " sdr list 2>&1 | grep -iE 'TEMP|THERMAL' | head -n 30")

# 2290/2291 I3C CPU1 (TS "I3C") had an "E1S - Under PSB" LED text (copy error) -> rewrite to the real I3C
#   CPU1 connection check via the board/vendor i3c-tools (section 19r placeholder). Criteria = TBD ->
#   report-level UNRESOLVED, but the copy error is still rewritten (batch11 TBD pattern).
def I3C(rn):
    return ('-- I3C - CPU1: verify the I3C bus to CPU1. This is a board/vendor-specific I3C connection check '
            '(i3c-tools on the BMC console) - the operator provides the tool + exact bus/device/probe steps.'
            + NL + bmc_ss('${I3C_PROBE:?operator provides the I3C tool + bus/address probe command for CPU1} '
                          '2>&1 | head -n 40')
            + NL + '-- Criteria/Procedure are TBD in the library (report-level UNRESOLVED).')


FIX[2290] = I3C(2290)
FIX[2291] = I3C(2291)

# ---------- VERDICT (col13) + PKG (col14) ----------
CAN[2241] = 'PARTIAL'      # YES -> PARTIAL: disables a security auth method (can lock out) + factory reset
CAN[2272] = 'YES'          # PARTIAL -> YES: read-only OOB sensor get, sibling 1891 (batch10) is YES
PKG[2203] = 'usbutils (lsusb)'
PKG[2209] = 'lspci + power control'
PKG[2273] = 'util-linux (lscpu) dmidecode + MLPerf inference toolkit (operator-provided)'
PKG[2287] = 'stress-ng (install) + nvidia-smi + ipmitool (OOB temp read)'
PKG[2290] = 'i3c-tools (vendor/operator-provided)'
PKG[2291] = 'i3c-tools (vendor/operator-provided)'


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
        if dry_only:
            print('--- row %d new ai_commands ---' % r); print(v); continue
        ws.cell(row=r, column=15).value = v
        n_cmd += 1
    if dry_only:
        wb.close(); print('DRY run -- NOT saving.'); return
    for r, v in sorted(CAN.items()):
        ws.cell(row=r, column=13).value = v
        n_can += 1
    for r, v in sorted(PKG.items()):
        ws.cell(row=r, column=14).value = v
        n_pkg += 1
    wb.save(xlsx)
    wb.close()
    print('applied  col15 ai_commands: %d   col13 ai_can_execute: %d   col14 ai_packages_needed: %d' % (n_cmd, n_can, n_pkg))

    wb2 = openpyxl.load_workbook(xlsx, read_only=True)
    ws2 = wb2[SHEET]
    issues = []
    for r in sorted(FIX.keys()):
        v = ws2.cell(row=r, column=15).value
        s = '' if v is None else str(v)
        if 'ssh ' in s or 'sshpass' in s:
            if s.count('"') % 2 != 0:
                issues.append((r, 'odd double-quote count %d' % s.count('"')))
            for line in s.split('\n'):
                if 'lanplus' in line and 'ssh' in line:
                    issues.append((r, 'lanplus still inside an ssh line'))
    wb2.close()
    if issues:
        print('post-audit ISSUES:'); [print('   row', r, why) for r, why in issues]
    else:
        print('post-audit issues: NONE')


if __name__ == '__main__':
    main()
