# Precise per-(sheet,row) ai_commands fix for Round-02 batch 4 (Functionality rows 603-802, item 601-800).
# Q-LIT: inner grep double-quoted pattern -> single quotes inside ssh.
# E-DQ: inner echo double-quoted string -> single quotes inside ssh.
# R26 : DUT-local ipmitool lacking sudo -> add sudo (matches sibling sensor rows).
# e   : PCIe for-loop variables expanded at agent-host -> run whole block on DUT.
# Pure ASCII only in this script. Uses python-openpyxl.
import openpyxl, sys

XLSX = 'data/REVISED_commands_merged_with_raw.xlsx'
SHEET = 'Functionality'

FIX = {
691: r'''-- RDIMM: install full memory population and confirm memory size/speed/slot show correctly in BIOS and OS. Agent can read the OS-side memory sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "sudo dmidecode -t memory 2>&1 | grep -Ei 'Size|Speed|Locator|Part Number' | head -n 60; lsmem 2>&1" ; installing the full population is physical and the BIOS view is operator-read.''',
696: r'''-- WOL function test: WOL function test. Agent (as the wake client from the peer host) sends the magic packet sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "sudo ethtool $DUT_NIC 2>&1; echo 'client sends magic packet'; ether-wake -i $DUT_NIC $DUT_MAC 2>&1"; the SUT must be in S5 (graceful shutdown), which needs an operator to set S5/WOL in the OS+BIOS and to unplug/re-plug AC for the disable case.''',
703: r'''-- PCIe ACS_Status: read PCIe ACS status on the DUT. sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "sudo lspci -D -vvv 2>&1 | grep -B1 -Ei 'ACSCtl|SrcValid' 2>&1"; an ACS-enabled port shows SrcValid+ and disabled shows SrcValid-.''',
704: r'''-- MSI-X status: read PCIe MSI-X status for each device on the DUT. sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "sudo lspci -D -vvv 2>&1 | grep -B1 -Ei 'MSI-X|Enable' 2>&1"; reports MSI-X Enable+/- per device.''',
705: r'''-- AMISCE linux: use AMISCE linux under OS to export/import BIOS settings. Agent runs the export/import sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "./SCELNX_64 /o /s cfg.txt 2>&1; echo '---import---'; ./SCELNX_64 /i /s cfg.txt 2>&1" then reboot and verify in setup; requires the AMISCE SCELNX_64 binary copied to the DUT first.''',
787: r'''sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "sudo ipmitool sdr elist 2>&1; echo ---; sudo ipmitool sensor list 2>&1"''',
788: r'''sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "sudo ipmitool sdr elist 2>&1; echo ---; sudo ipmitool sensor list 2>&1"''',
789: r'''sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "sudo ipmitool sdr elist 2>&1; echo ---; sudo ipmitool sensor list 2>&1"''',
790: r'''sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "sudo ipmitool sdr elist 2>&1; echo ---; sudo ipmitool sensor list 2>&1"''',
801: r'''-- Zeroconf discoverable through systemd-networkd: confirm the BMC/server hostname is discoverable as http://${BMC_HOSTNAME:?operator must set the bmc server hostname for mDNS}.local (mDNS). Agent can check the mDNS/Zeroconf visibility from the client sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "avahi-browse -rt _http._tcp 2>&1 | grep -Ei '= .*_http|hostname' | head -n 30; systemctl is-active avahi-daemon 2>&1" ; needs avahi/zeroconf set up on the BMC side.''',
}

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
print('changed', changed, 'of', len(FIX), 'on sheet', SHEET)
if changed != len(FIX):
    sys.exit('ERROR: not all rows updated')
wb.save(XLSX)
print('saved', XLSX)
