#!/usr/bin/env python3
"""Round-3 Reliability sheet fixes (2026-09-18) - guarded, dry-run capable.

Fixes targeted, skill-mandated defects found in the round-3 Reliability re-review.
col map (1-based): 13=ai_can_execute, 14=ai_packages_needed, 15=ai_commands,
16=ai_logs_output, 17=risk.

Every edit asserts the exact current cell text before writing (never blind-regex).
"""
import sys
import openpyxl

XLSX = 'data/REVISED_commands_merged_with_raw.xlsx'
DRY = '--dry' in sys.argv

wb = openpyxl.load_workbook(XLSX)
ws = wb['Reliability']


def setcell(row, col, old, new):
    cur = ws.cell(row=row, column=col).value
    if cur is None:
        cur = ''
    if cur != old:
        raise AssertionError(
            f"r{row} col{col} mismatch:\n  got: {cur!r}\n  exp: {old!r}")
    if not DRY:
        ws.cell(row=row, column=col).value = new
    print(f"r{row:4d} col{col:2d}  {'DRY' if DRY else 'SET'} ({len(old)} -> {len(new)} chars)")


# --- r2: BERT/ERST/HEST is a pure read-only OS info check -> YES (locked §21) ---
setcell(2, 13, 'PARTIAL', 'YES')

# --- r43: prose copy-artifact "uncorrectable-non-fatal nonfatal" ---
setcell(43, 15,
 '-- Memory slot 1~N: inject an AMD CPU RAS uncorrectable-non-fatal nonfatal error via the AMD RAS tool (amdgpuras/AmdMemoryErrorTool), then verify the error is logged sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "dmesg | tail -n 40; rasdaemon -r 2>&1"; fault-injection is interactive.',
 '-- Memory slot 1~N: inject an AMD CPU RAS uncorrectable non-fatal error via the AMD RAS tool (amdgpuras/AmdMemoryErrorTool), then verify the error is logged sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "dmesg | tail -n 40; rasdaemon -r 2>&1"; fault-injection is interactive.')
setcell(43, 16,
 'return the dmesg error log + rasdaemon record so the user confirms the nonfatal uncorrectable-non-fatal error was captured and (for correctable) the slot/memory stayed functional.',
 'return the dmesg error log + rasdaemon record so the user confirms the uncorrectable non-fatal error was captured and (for correctable) the slot/memory stayed functional.')
setcell(43, 17,
 'RISK: uncorrectable-non-fatal fault injection stresses the memory controller/platform and may reset it; run per AMD guidance with packages installed first and discuss exact steps after setup.',
 'RISK: uncorrectable non-fatal fault injection stresses the memory controller/platform and may reset it; run per AMD guidance with packages installed first and discuss exact steps after setup.')

# --- r44: prose copy-artifact "uncorrectable/fatal fatal" ---
setcell(44, 15,
 '-- Memory slot 1~N: inject an AMD CPU RAS uncorrectable/fatal fatal error via the AMD RAS tool (amdgpuras/AmdMemoryErrorTool), then verify the error is logged sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "dmesg | tail -n 40; rasdaemon -r 2>&1"; fault-injection is interactive.',
 '-- Memory slot 1~N: inject an AMD CPU RAS uncorrectable fatal error via the AMD RAS tool (amdgpuras/AmdMemoryErrorTool), then verify the error is logged sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "dmesg | tail -n 40; rasdaemon -r 2>&1"; fault-injection is interactive.')
setcell(44, 16,
 'return the dmesg error log + rasdaemon record so the user confirms the fatal uncorrectable/fatal error was captured and (for correctable) the slot/memory stayed functional.',
 'return the dmesg error log + rasdaemon record so the user confirms the uncorrectable fatal error was captured and (for correctable) the slot/memory stayed functional.')
setcell(44, 17,
 'RISK: uncorrectable/fatal fault injection stresses the memory controller/platform and may reset it; run per AMD guidance with packages installed first and discuss exact steps after setup.',
 'RISK: uncorrectable fatal fault injection stresses the memory controller/platform and may reset it; run per AMD guidance with packages installed first and discuss exact steps after setup.')

# --- r144: R5 - OOB ipmitool (agent-host) was wrongly wrapped in a DUT ssh ---
setcell(144, 15,
 '-- Uboot flash: plug the BMC UART console and flash the BMC image through the uBoot TFTP/sf flow. The flash steps are done over the physical BMC UART console by an operator; the agent can only help stage the image and verify the BMC responds afterwards sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "ipmitool -I lanplus -C 17 -H \'$BMC_IP\' -U \'$BMC_USER\' -P \'$BMC_PASS\' mc info 2>&1 | grep -Ei \'Firmware Revision\' 2>&1" .',
 '-- Uboot flash: plug the BMC UART console and flash the BMC image through the uBoot TFTP/sf flow. The flash steps are done over the physical BMC UART console by an operator; the agent only stages the image and verifies the BMC responds afterwards OOB from the agent host: ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" mc info 2>&1 | grep -Ei \'Firmware Revision\' 2>&1')

# --- r145: R5 + Q-LIT - OOB ipmitool inside DUT ssh with inner double quotes ---
setcell(145, 15,
 '-- Debugport flash: change the debug-port jumper, flash the BMC encrypted ROM via the AST2600 uart_fw_py tool, then restore the jumper. A physical jumper + UART flashing flow done by an operator; the agent can only verify the BMC comes back sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" mc info 2>&1 | grep -Ei \'Firmware Revision\' 2>&1" .',
 '-- Debugport flash: change the debug-port jumper, flash the BMC encrypted ROM via the AST2600 uart_fw_py tool, then restore the jumper. A physical jumper + UART flashing flow done by an operator; the agent only verifies the BMC comes back OOB from the agent host: ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" mc info 2>&1 | grep -Ei \'Firmware Revision\' 2>&1')

# --- r152: hard-coded peer IP -> ${PEER_IP:?...} vendor slot ---
setcell(152, 15,
 '-- NIC TX/RX check under OS: run TX/RX traffic on the NIC sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "ip -s link show 2>&1 | grep -A3 -E \'TX|RX\'; ethtool -S eth0 2>&1 | head -n 40; echo \'traffic test needs a peer\'; ping -c5 192.168.0.1 2>&1"; full throughput needs a peer/traffic generator.',
 '-- NIC TX/RX check under OS: run TX/RX traffic on the NIC sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "ip -s link show 2>&1 | grep -A3 -E \'TX|RX\'; ethtool -S eth0 2>&1 | head -n 40; echo \'traffic test needs a peer\'; ping -c5 ${PEER_IP:?operator provides a reachable peer IP for the NIC TX/RX check} 2>&1"; full throughput needs a peer/traffic generator.')

# --- r154: col16/pkgs copied from the NIC row; hard-coded BMC cred -> vars ---
setcell(154, 14,
 'iproute2 + ethtool + a reachable peer',
 'curl + BMC Redfish credentials')
setcell(154, 15,
 '-- HMC firmware readiness under stress: loop the listed HGX firmware-inventory Redfish GETs 100 times and confirm BMC stays functional + no errors. for i in $(seq 1 100); do curl -k -u root:0penBmc -H "Content-Type: application/json" -s -o /dev/null -w "%{http_code}\n" https://$BMC_IP/redfish/v1/UpdateService/FirmwareInventory/HGX_FW_BMC_0; done 2>&1',
 '-- HMC firmware readiness under stress: loop the listed HGX firmware-inventory Redfish GETs 100 times and confirm BMC stays functional + no errors. for i in $(seq 1 100); do curl -k -u "${BMC_USER}:${BMC_PASS}" -H "Content-Type: application/json" -s -o /dev/null -w "%{http_code}\n" https://$BMC_IP/redfish/v1/UpdateService/FirmwareInventory/HGX_FW_BMC_0; done 2>&1')
setcell(154, 16,
 'return the per-NIC TX/RX counters + ethtool stats so the user confirms packets are transmitted/received without errors.',
 'return the 100-loop HTTP status code summary + any firmware-inventory error, so the user confirms the BMC stayed responsive and reported no error under repeated Redfish GETs.')

# --- r155: col16 copied from an I2C row; verdict NO->PARTIAL (agent-runnable) ---
setcell(155, 13, 'NO', 'PARTIAL')
setcell(155, 16,
 'operator probes the named I2C links + collects result photos; agent can only check bus device presence on the BMC console, not the mechanical connection integrity.',
 'return the synthetic SEL-append result + SEL fullness (sel info) + BMC mc info, so the user confirms the SEL filled up and the BMC still responds after it is full.')
setcell(155, 17, '',
 'RISK: filling the BMC SEL to full can degrade BMC logging; run on a dedicated SUT and clear the SEL after verifying.')

# --- r190: item says "Out Of Band" but uses the in-band template -> OOB ---
setcell(190, 14,
 'AMDGPU-RAS tool (amdgpuras, must install)',
 'AMDGPU-RAS tool (OOB mode) + BMC Redfish access')
setcell(190, 15,
 '-- In-band error injection (Out of Band: UMC Correctable ODECC) via the amdgpuras tool: this targets a real GPU hardware error path and needs the exact amdgpuras invocation the user/FAE supplies for this unit+type. Agent then confirms injection succeeded and checks dmesg for the expected amdgpu hardware error.',
 '-- Out-of-band UMC Correctable ODECC error injection requires the amdgpuras OOB (BMC/Redfish) path + a Redfish query for the CPER index afterwards. Agent must confirm the exact OOB injection command with the user (board/component + target), then run injection and Redfish CPER check.')
setcell(190, 16,
 'return amdgpuras injection result (should show "Error inject successfully") + `dmesg -T | tail -100` showing the expected amdgpu hardware error, so user can confirm the injected error was handled per spec.',
 'return amdgpuras injection result (should return success) + the Redfish CPER/index readout (via sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "curl -k -u bmc_user:bmc_pass https://$BMC_IP/redfish/v1/Systemsystem/LogServices/CPER/Entries 2>&1" ) so user confirms a CPER entry was recorded.')
setcell(190, 17,
 'RISK: hardware error injection can cause GPU errors/ECCs and may need a reboot; run only on a dedicated SUT and confirm the exact injection command/target with the user/FAE.',
 'RISK: injecting an uncorrectable/hardware error can disrupt active GPUs / require recovery; run only on a dedicated SUT and confirm the exact injection target with the user/FAE.')

if not DRY:
    wb.save(XLSX)
    print('saved:', XLSX)
else:
    print('DRY-RUN - not saved')
