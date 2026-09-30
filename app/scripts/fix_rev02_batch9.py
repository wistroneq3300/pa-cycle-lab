# Precise per-(sheet,row) ai_commands fix for Round-02 batch 9 (Functionality rows 1603-1802, item 1601-1800).
#
# Classes fixed (all ai_commands col15; no ai_can_execute change except noted):
#  WR   : sensor-name / command content mismatch vs Items-procedure -> rewrite to the procedure's real logic.
#  Q-LIT: ssh inner bare double-quoted grep/echo breaks the outer ssh string -> single-quote the inner pattern.
#  DBL-SSH: nested `sshpass ... ssh` inside an outer ssh string -> collapse to a single ssh hop.
#  FAKE : placeholder `echo ...`/"not directly runnable" that is actually runnable -> real bash command.
#
# Pure ASCII only. Row-located (not code-located). Uses python-openpyxl.
# NOTE: literal bash `${VAR:?...}` braces must NOT go through str.format(); we inline strings via concatenation.
import openpyxl, sys

XLSX = 'data/REVISED_commands_merged_with_raw.xlsx'
SHEET = 'Functionality'

SSH = 'sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP'
OOB = 'ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS"'
SENSOR = OOB + ' sensor get'

FIX = {}

# =====================================================================
# WR: sensor-name mismatch -> sensor arg = Items (read-only sensor get)
# =====================================================================
FIX[1686] = SENSOR + " 'TEMP_DIMM_Zone1~4' 2>&1"   # Monitor DIMM Temperature (matches row 1707 sensor name)
FIX[1693] = SENSOR + " 'TEMP_VR_Zone1~6' 2>&1"
FIX[1694] = SENSOR + " 'TEMP_SWITCH0~1' 2>&1"
FIX[1695] = SENSOR + " 'TEMP_SW_VR' 2>&1"
FIX[1696] = SENSOR + " 'TEMP_CX7_1~4_Chip' 2>&1"
FIX[1697] = SENSOR + " 'TEMP_CX7_1~4_Trans' 2>&1"
FIX[1698] = SENSOR + " 'TEMP_BF3_Chip' 2>&1"
FIX[1699] = SENSOR + " 'TEMP_BF3_Trans' 2>&1"
FIX[1700] = SENSOR + " 'PSU1~4_FAN' 2>&1"
FIX[1701] = SENSOR + " 'UPPER_FAN1~5_F' 2>&1"
FIX[1702] = SENSOR + " 'UPPER_FAN1~5_R' 2>&1"
FIX[1703] = SENSOR + " 'LOWER_FAN1~5_F' 2>&1"
FIX[1704] = SENSOR + " 'LOWER_FAN1~5_R' 2>&1"

# =====================================================================
# WR: LED / manual-fan / BIOS-version rows held a temp-sensor command ->
# rewrite to the real procedure logic.
# =====================================================================
# 1617 LED light control (turn on/off LED) -> Redfish indicator LED action
FIX[1617] = ('-- Inventory and LEDs - LED light control: toggle the system Identify/UID indicator LED on/off via Redfish and read back the state; LED visibility needs a person at the machine.\n'
  + 'curl -s -k -u "$BMC_USER:$BMC_PASS" -H "Content-Type: application/json" -X POST '
  + '-d \'{"IndicatorLED":"Lit"}\' https://$BMC_IP/redfish/v1/Chassis/system 2>&1\n'
  + 'sleep 2\n'
  + 'curl -s -k -u "$BMC_USER:$BMC_PASS" https://$BMC_IP/redfish/v1/Chassis/system | jq -r \'.IndicatorLED\' 2>&1\n'
  + '-- LED colour/blink is operator-visual; agent returns the read-back state.')

# 1668 Manually FAN speed control -> set manual fan duty via OEM raw + restore auto
FIX[1668] = ('-- Manually FAN speed control: set a manual fan duty (OEM raw), read back the FAN speed via SDR, then restore auto-control.\n'
  + OOB + ' raw 0x30 0x31 0x01 ${FAN_DUTY_HEX:?operator must set 0x00-0x64 hex byte, see manual} 2>&1\n'
  + OOB + ' sdr list 2>&1 | grep -iE \'fan\'; sleep 10\n'
  + OOB + ' sdr list 2>&1 | grep -iE \'fan\'\n'
  + '-- ---restore auto---\n'
  + OOB + ' raw 0x30 0x81 0x1 0xf8 0x0 0x24 0x32 2>&1')

# 1678 BIOS version (IB and OOB) -> OEM raw 0x30 0x25 (BIOS version) read
FIX[1678] = ('-- BIOS version(IB and OOB): read the BIOS version via the OEM IPMI raw command in-band and out-of-band.\n'
  + 'sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "raw 0x30 0x25 2>&1" 2>&1\n'
  + OOB + ' raw 0x30 0x25 2>&1')

# 1657 Set BMC time -> real `sel time set` with user-specified time + readback
FIX[1657] = ('-- Set BMC time: set the BMC SEL time to a user-specified value, then read it back.\n'
  + SSH + " \"sel time set \\\"\${BMC_TIME:?operator must set the time as MM/DD/YYYY HH:MM:SS}\\\" 2>&1; sel time get 2>&1\"")

# =====================================================================
# WR: Power Policy rows 1628/1629/1630 all copied "Last-State" text ->
# rewrite to real policy they claim (always-off / always-on / last-state).
# =====================================================================
FIX[1628] = ('-- Power Policy - Always power off: set the AC power-loss policy to always-off (OOB chassis policy), verify, then note the physical AC-cycle step needs the operator.\n'
  + OOB + ' chassis policy always-off 2>&1\n'
  + OOB + ' chassis status 2>&1 | grep -iE \'Power Restore\'\n'
  + '-- state-changing; the AC unplug/replug + swap-CPU steps are operator-physical (agent cannot cycle AC/swap CPU).')
FIX[1629] = ('-- Power Policy - Always power on: set the AC power-loss policy to always-on (OOB chassis policy), verify, then note the physical AC-cycle step needs the operator.\n'
  + OOB + ' chassis policy always-on 2>&1\n'
  + OOB + ' chassis status 2>&1 | grep -iE \'Power Restore\'\n'
  + '-- state-changing; the AC unplug/replug + swap-CPU steps are operator-physical (agent cannot cycle AC/swap CPU).')
FIX[1630] = ('-- Power Policy - Last state: set the AC power-loss policy to last-state (previous, OOB chassis policy), verify, then note the physical AC-cycle step needs the operator.\n'
  + OOB + ' chassis policy previous 2>&1\n'
  + OOB + ' chassis status 2>&1 | grep -iE \'Power Restore\'\n'
  + '-- state-changing; the AC unplug/replug step is operator-physical (agent cannot cycle AC).')

# =====================================================================
# WR: Boot Order rows 1633/1635 used "Usb" target for a BIOS boot ->
# fix to the correct Redfish BootSourceOverrideTarget / IPMI bootdev.
# =====================================================================
FIX[1633] = ('-- Boot Order - Set boot option to BIOS: set the one-time boot option to BIOS Setup via IPMI, reboot, and confirm the host enters BIOS.\n'
  + OOB + ' chassis bootdev setup options=efiboot 2>&1\n'
  + OOB + ' chassis bootparam get 5 2>&1\n'
  + '-- state-changing/pre-OS; agent reads back the boot option; entering BIOS Setup is a pre-OS visual step the operator confirms.')
FIX[1635] = ('-- Boot Order - Set boot option to BIOS for all future-boot: set a persistent boot option to BIOS Setup via IPMI, reboot twice, and confirm it persists.\n'
  + OOB + ' chassis bootdev setup options=efiboot,persistent 2>&1\n'
  + OOB + ' chassis bootparam get 5 2>&1\n'
  + '-- state-changing/pre-OS; agent reads back the boot option; entering BIOS + the persistent-boot POST message is operator-visual.')

# =====================================================================
# FAKE: "not directly runnable" / placeholder that is actually runnable ->
# real bash (SDR repo info / Reserve SDR / Set BIOS config / ForceOff / On / GracefulShutdown).
# =====================================================================
FIX[1659] = ('-- Get SDR Repository Info (IB and OOB): read the SDR repository info via the raw command in-band and out-of-band; byte 2 of the response should be 0x51.\n'
  + 'sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "raw 0x0a 0x20 2>&1" 2>&1\n'
  + OOB + ' raw 0x0a 0x20 2>&1')
FIX[1660] = ('-- Reserve SDR Repository (IB and OOB): reserve the SDR repository via the raw command in-band and out-of-band; returns a reservation ID.\n'
  + 'sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "raw 0x0a 0x22 2>&1" 2>&1\n'
  + OOB + ' raw 0x0a 0x22 2>&1')
FIX[1677] = ('-- Set BIOS Configuration(IB and OOB): send the OEM Set BIOS Configuration raw command with the user-specified BIOS revision bytes (state-changing).\n'
  + 'sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "raw 0x30 0x01 ${BIOS_MAJOR:?operator must set the BIOS major revision byte} ${BIOS_MINOR:?operator must set the BIOS minor revision byte} ${BIOS_ITER:?operator must set the BIOS iteration byte} 2>&1" 2>&1\n'
  + OOB + ' raw 0x30 0x01 ${BIOS_MAJOR:?} ${BIOS_MINOR:?} ${BIOS_ITER:?} 2>&1')
# ForceOff/On/GracefulShutdown via Redfish ComputerSystem.Reset (the proc already shows Redfish actions)
FIX[1687] = ('-- ForceOff: POST a Redfish ForceOff reset to the System and read back the power state.\n'
  + 'curl -s -k -u "$BMC_USER:$BMC_PASS" -H "Content-Type: application/json" -X POST '
  + '-d \'{"ResetType":"ForceOff"}\' https://$BMC_IP/redfish/v1/Systems/system/Actions/ComputerSystem.Reset 2>&1\n'
  + OOB + ' power status 2>&1')
FIX[1688] = ('-- GracefulShutdown: POST a Redfish GracefulShutdown reset to the System and read back the power state.\n'
  + 'curl -s -k -u "$BMC_USER:$BMC_PASS" -H "Content-Type: application/json" -X POST '
  + '-d \'{"ResetType":"GracefulShutdown"}\' https://$BMC_IP/redfish/v1/Systems/system/Actions/ComputerSystem.Reset 2>&1\n'
  + OOB + ' power status 2>&1')
FIX[1689] = ('-- On: POST a Redfish On reset to the System and read back the power state.\n'
  + 'curl -s -k -u "$BMC_USER:$BMC_PASS" -H "Content-Type: application/json" -X POST '
  + '-d \'{"ResetType":"On"}\' https://$BMC_IP/redfish/v1/Systems/system/Actions/ComputerSystem.Reset 2>&1\n'
  + OOB + ' power status 2>&1')

# =====================================================================
# Q-LIT (+DBL-SSH) rows: collapse nested ssh / single-quote inner literals.
# =====================================================================
# 1648 PROCHOT CPU - nested sshpass ssh + inner double-quote -> single ssh + single-quoted greps
FIX[1648] = ('-- PROCHOT Thermal Throttling - CPU: read core temps + CPU clock during a load; PROCHOT assertion needs controlled heating (operator).\n'
  + SSH + ' "grep -H . /sys/class/thermal/thermal_zone*/temp 2>&1; lscpu 2>&1 | grep -i \'CPU MHz\'" 2>&1')

# 1650 PROCHOT GPU - inner double-quote greps -> single-quote
FIX[1650] = ('-- PROCHOT Thermal Throttling - GPU: read GPU temp + clock throttle during a load; physical heating to assert PROCHOT is operator.\n'
  + SSH + ' "nvidia-smi --query-gpu=name,temperature.gpu,clocks.throttle_reasons.gpu_idle,clocks.sm --format=csv 2>&1; nvidia-smi -q -d CLOCK 2>&1 | grep -i -E \'Throttle\'" 2>&1')

# 1732/1733 Speed&Width / ACS - inner $PCIE_BUS double-quote + grep pattern -> single-quote
FIX[1732] = ('-- Speed & Width: read PCIe link speed/width (LnkSta/LnkCap) of the target PCIe bus.\n'
  + SSH + ' "lspci -s \'${PCIE_BUS:?operator must set the target PCIe bus}\' -vvv 2>&1 | grep -E \'LnkSta:|LnkCap:\'" 2>&1')
FIX[1733] = ('-- ACS Check: read the ACS control lines of the target PCIe bus (SrcValid+ enabled / SrcValid- disabled).\n'
  + SSH + ' "lspci -s \'${PCIE_BUS:?operator must set the target PCIe bus}\' -vvv 2>&1 | grep -i \'ACS\'" 2>&1')

# 1735 Check PCIe switch - inner grep pattern double-quote -> single-quote
FIX[1735] = ('-- Check PCIe: check the BRCM PCIe switch is enumerated (device/vendor ID present).\n'
  + SSH + ' "lspci -nn 2>&1 | grep -i -E \'PLX|switch|PEX|PCI bridge\'" 2>&1')

# 1736 Check Firmware - nested sshpass+ssh + inner quotes -> collapse to one ssh + single-quoted greps
FIX[1736] = ('-- Check Firmware: read the BRCM switch firmware version (lspci vendor ROM + SW info via the switch vendor utility if present).\n'
  + SSH + ' "lspci -vv -d 1d0f: 2>&1 | grep -iE \'Capabilities|ROM\'; dmidecode -t 41 2>&1 | tail -n 30" 2>&1')

# 1737 FW Flash - placeholder echo -> vendor-tool wrapper (section 19r)
FIX[1737] = ('-- FW Flash: flash the PCIe switch firmware via the switch vendor utility (DediProg) with the user-designated image; state-changing.\n'
  + SSH + ' "${SW_FLASH_TOOL:?operator must provide the BRCM switch flash utility path} ${SW_FW_IMAGE:?operator must provide the switch firmware image path}" 2>&1\n'
  + '-- ---post-flash read-back---\n'
  + SSH + ' "lspci -vv -d 1d0f: 2>&1 | grep -iE \'Capabilities|ROM\'" 2>&1')

# 1744 FAN speed change(Auto) - OOB fan/power reads belong at agent-host, load runs on the DUT via ssh
FIX[1744] = ('-- FAN speed change(Auto): idle then load the SUT and snapshot fan RPM + power via OOB (agent-host); fan response is read-only.\n'
  + SSH + " \"stress-ng --cpu \$(nproc) --timeout 30 2>&1 | tail -3\" &\n"
  + 'sleep 5\n'
  + "echo '---fan_idle---'\n"
  + OOB + " sdr list 2>&1 | grep -iE 'fan'\n"
  + OOB + " sensor list 2>&1 | grep -iE 'power' | head\n"
  + 'wait\n'
  + "echo '---post---'\n"
  + OOB + " sdr list 2>&1 | grep -iE 'fan'")

# 1745 FAN speed change(Manual) - OOB raw fan-duty set + read + restore, all at agent-host
FIX[1745] = ('-- FAN speed change(Manual): set manual fan duty (OEM raw, agent-host OOB), read back FAN RPM, then restore auto-control; state-changing.\n'
  + "echo '---fan_manual---'\n"
  + OOB + " raw 0x30 0x31 0x01 ${FAN_DUTY_HEX:?operator must set 0x00-0x64 hex byte, see manual} >/dev/null 2>&1\n"
  + OOB + " sdr list 2>&1 | grep -iE 'fan'\n"
  + 'sleep 10\n'
  + OOB + " sdr list 2>&1 | grep -iE 'fan'\n"
  + "echo '---restore---'\n"
  + OOB + " raw 0x30 0x81 0x1 0xf8 0x0 0x24 0x32 2>&1")

# 1759 DPU Connection - inner cut -d" " double-quote -> single-quote command substitution
FIX[1759] = ('-- DPU Connection: check the BlueField DPU is present and read its -vvv detail.\n'
  + SSH + ' "update-pciids 2>&1; lspci 2>&1 | grep -i BlueField; BDF=\$(lspci 2>/dev/null | grep -i BlueField | head -1 | cut -d\' \' -f1); lspci -s \$BDF -vvv 2>&1 | head -n 30" 2>&1')

# 1762 Link Flap - runs on the DPU OS (ssh ubuntu@OOB_IP); local double-quoted for-loop vars
FIX[1762] = ('-- Link Flap: repeat the DPU management-LAN link up/down 5x on the DPU OS and ping the port IP.\n'
  + 'sshpass -p "$DPU_PASS" ssh -o StrictHostKeyChecking=no $DPU_USER@$DPU_IP '
  + '"for i in 1 2 3 4 5; do ip link set ${MGT_NIC:?operator must set DPU mgmt NIC} down; sleep 2; ip link set ${MGT_NIC} up; sleep 3; ping -c2 -W2 ${PEER_IP:?operator must set peer IP} 2>&1 | tail -n 2; done" 2>&1')

# 1765 Cold Reboot - record lspci on DUT (ssh), power cycle via OOB at agent-host; inner double-quote fixed
FIX[1765] = ('-- Cold Reboot: cold-reboot stress - record lspci/lsblk/nvme on the DUT, then power off/on via OOB (agent-host), looped for the long-term count.\n'
  + SSH + " \"lspci -vv > /tmp/cold_lspci.txt; lsblk > /tmp/cold_lsblk.txt; nvme list > /tmp/cold_nvme.txt 2>&1; echo recorded\" 2>&1\n"
  + OOB + " chassis power off 2>&1\n"
  + 'sleep 30\n'
  + OOB + ' chassis power on 2>&1')

# 1799/1800/1801/1802 I2C - inner grep pattern double-quote -> single-quote (4 rows)
I2C_SCAN = ' "echo ---i2c_buses---; sudo i2cdetect -l 2>&1; echo ---scan---; for b in \$(sudo i2cdetect -l 2>/dev/null | grep -oE \'i2c-[0-9]+\' | cut -d- -f2); do sudo i2cdetect -y \$b 2>/dev/null | head -20; done" 2>&1'
FIX[1799] = ('-- I2C MB: enumerate and scan the motherboard I2C segment (read-only).\n' + SSH + I2C_SCAN)
FIX[1800] = ('-- I2C BMC_BD: enumerate and scan the BMC-board I2C segment (read-only).\n' + SSH + I2C_SCAN)
FIX[1801] = ('-- I2C SW_BD: enumerate and scan the switch-board I2C segment (read-only).\n' + SSH + I2C_SCAN)
FIX[1802] = ('-- I2C PSU_BD: enumerate and scan the PSU-board I2C segment (read-only).\n' + SSH + I2C_SCAN)

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

if missing:
    print('MISSING rows:', missing)
print('changed', changed, 'of', len(FIX), 'cmd rows on sheet', SHEET, '->', sorted(FIX.keys()))
if missing:
    sys.exit('ERROR: some rows missing')
wb.save(XLSX)
print('saved', XLSX)
