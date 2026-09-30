# -*- coding: utf-8 -*-
"""Run-2: de-dup shared/mismatched ai_commands across the 5 non-Functionality sheets.

Only col15 (ai_commands) is modified. Every edit is guarded by an exact
old-text match so nothing unintended changes. TBD-placeholder sets are left as-is.
"""
import openpyxl

XLSX = 'data/REVISED_commands_merged_with_raw.xlsx'
SHEETS = ['Functionality', 'Reliability', 'Performance', 'Compatibility', 'Stability', '(No Main Function)']
wb = openpyxl.load_workbook(XLSX)

SSH = 'sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP '

# (sheet, row) -> new ai_commands
FIX = {
    # --- SET 16: r155 (Stress Test - Full SEL Volume) had copied r131's I2C placeholder ---
    ('Reliability', 155): ('-- stress the BMC SEL until full: generate a synthetic SEL entry with '
                           '`ipmitool raw 0x0a 0x44 0x01 0 0x02 0x01 0x01 0x01 0x01 0x20 0 0x04 0 0x40 0x81 0x0b 0 0`, '
                           'then check SEL fullness with `ipmitool sel info`, then confirm BMC function (mc info / '
                           'Redfish version) still works after SEL is full. ' + SSH +
                           '"ipmitool raw 0x0a 0x44 0x01 0 0x02 0x01 0x01 0x01 0x01 0x20 0 0x04 0 0x40 0x81 0x0b 0 0 2>&1; '
                           'echo ---; ipmitool sel info 2>&1; echo ---; ipmitool mc info 2>&1"'),
    # --- SET 17: r154 (HMC Firmware readiness) had copied r152's NIC TX/RX command ---
    ('Reliability', 154): ('-- HMC firmware readiness under stress: loop the listed HGX firmware-inventory Redfish GETs '
                           '100 times and confirm BMC stays functional + no errors. ' +
                           'for i in $(seq 1 100); do ' +
                           'curl -k -u root:0penBmc -H "Content-Type: application/json" -s -o /dev/null -w "%{http_code}\n" '
                           'https://$BMC_IP/redfish/v1/UpdateService/FirmwareInventory/HGX_FW_BMC_0; done 2>&1'),
    # --- SET 19: r61 (Multi-Node NCCL) had copied r49's MLPerf command ---
    ('Performance', 61): ('-- Multi-Node NCCL: set password-free SSH between the two SUTs, install OpenMPI deps, '
                          'then run the NVIDIA multi-node NCCL benchmark and compare to spec. '
                          'ssh-keygen -t rsa -b 4096 -N "" -f /root/.ssh/id_rsa 2>&1; ssh-copy-id root@${SUT2_IP:?multi-node peer IP} 2>&1; '
                          'apt-get install -y libpmix-dev libfabric-dev libev-dev zlib1g-dev 2>&1'),
    # --- SET 24: r437 (Memory Stress - Intel PTAT) had copied r35's BIOS placeholder ---
    ('Compatibility', 437): ('-- Memory stress via Intel PTAT: run the PTAT memory test for 1 hour and confirm the '
                             'system stays workable with no error in system log. ' + SSH +
                             '"command -v ptat >/dev/null 2>&1 || echo PTAT_MISSING; ptat -mt 3 -mtsize 4500mb 2>&1"'),
    # --- SET 26: r436 (DD Hard Drive Space Fullness) had copied r88's IOmeter ---
    ('Compatibility', 436): ('-- DD hard-drive space-fullness test: fill all available HDDs/NVMe with dd until full, '
                             'then warm reboot, then cold reboot, and confirm no errors. ' + SSH +
                             '"for d in $(lsblk -dpno NAME | grep -E \'nvme|sd\'); do dd if=/dev/zero of=$d bs=1M status=none; done 2>&1; '
                             'echo FILLED; df -h 2>&1"'),
    # --- SET 29: r137 (PCIe Link Status via amdxio) copied r136's xGMI linkstatus ---
    ('Compatibility', 137): ('-- GPU PCIe link status via amdxio: check no downgrade. ' + SSH +
                             '"amdxio -i=2,6,10,14,18,22,26,30 -pcie -list -ports 2>&1"'),
    # --- SET 30: r402 (PCIe Device Check) copied r139's xGMI PCS error ---
    ('Compatibility', 402): ('-- PCIe device presence check: confirm all 8 OAM GPUs (AMD 7xxx) are enumerated under OS. ' + SSH +
                             '"lspci | grep 7xxx 2>&1"'),
    # --- SET 31: r406 (XGMI BW Test - A2A Stress) copied r142's IOMMU-enable driver check ---
    ('Compatibility', 406): ('-- XGMI/PCIe device-to-device bidirectional saturation via RCCL TransferBench: '
                             'run p2p transfers from 1K up to 1G and record bidirectional bandwidth; '
                             'pass/fail per AGFHC definitions. ' + SSH +
                             '"for s in 1K 2K 4K 8K 16K 32K 64K 128K 256K 512K 1M 2M 4M 8M 16M 32M 64M 128M 256M 512M 1G; '
                             'do USE_GPU_DMA=1 ./TransferBench p2p $s 2>&1 | tail -5; done"'),
    # --- SET 32: r407 (AGFHC level 3) copied r143's IOMMU-disable driver check ---
    ('Compatibility', 407): ('-- AMD GPU Field Health Check - Level 3: install AGFHC and run all-lvl3 validation '
                             '(about 30 min); expect exit code AGFHC_SUCCESS [0]. ' + SSH +
                             '"command -v agfhc >/dev/null 2>&1 || sudo ./install 2>&1; sudo ./agfhc -r all_lvl3 2>&1 | tail -30"'),
    # --- SET 33: r145 (upgrade driver) copied r408's Agfhc single pass ---
    ('Compatibility', 145): ('-- upgrade the amdgpu driver: install/overwrite the newer driver package and confirm the '
                             'driver loads without issue. ' + SSH +
                             '"sudo amdgpu-install --upgrade --nonroot 2>&1 | tail -20; echo ---; modprobe amdgpu 2>&1; '
                             'dmesg -T | grep -iE \'amdgpu.*error|fail\' | tail -20"'),
    # --- SET 34: r146 (downgrade driver) copied r409's AGFHC level 5 ---
    ('Compatibility', 146): ('-- downgrade the amdgpu driver: install the specified older driver package and confirm '
                             'the driver loads without issue. ' + SSH +
                             '"sudo amdgpu-install --uninstall 2>&1 | tail -10; sudo amdgpu-install --nonroot 2>&1 | tail -20; '
                             'modprobe amdgpu 2>&1; dmesg -T | grep -iE \'amdgpu.*error|fail\' | tail -20"'),
    # --- SET 35: r413 (touch /tmp/gpu_caution1) copied r148's Large Transfer bidi ---
    ('Compatibility', 413): ('-- GPU over-temperature caution test (BMC console): touch /tmp/gpu_caution1 to force the '
                             'dummy GPU temp to 101C, check SDR log + dmesg/sel for the expected critical alert and '
                             'full-speed fans, then rm the flag to reset. BMC-console only. ' + SSH +
                             '"touch /tmp/gpu_caution1 2>&1; sleep 5; sdr list 2>&1 | grep -i -A1 GPU; dmesg -T | tail -20"'),
    # --- SET 36: r414 (touch /tmp/gpu_caution2) copied r149's D2D bidi ---
    ('Compatibility', 414): ('-- GPU over-temperature test (BMC console): touch /tmp/gpu_caution2 to force the dummy GPU '
                             'temp to 104C, confirm SDR/dmesg/sel alert + power-off sequence after 60s, then rm the flag '
                             'and AC-cycle to confirm system powers on without issue. BMC-console only. ' + SSH +
                             '"touch /tmp/gpu_caution2 2>&1; sleep 65; sdr list 2>&1 | grep -i -A1 GPU; sel list 2>&1 | tail -20"'),
    # --- SET 37: r150 (GFX DGEMM) copied r416's dmesg scrubbing ---
    ('Compatibility', 150): ('-- GFX DGEMM exerciser via ROCm Validation Suite: run the gst dgemm workload (60 s) and '
                             'confirm no errors. ' + SSH +
                             '"/opt/rocm/bin/rvs -c /opt/rocm/share/rocm-validation-suite/conf/dgemm.conf 2>&1 | tail -30"'),
    # --- SET 38: r151 (GFX SGEMM) copied r417's UBB FRU ---
    ('Compatibility', 151): ('-- GFX SGEMM exerciser via ROCm Validation Suite: run the gst sgemm workload (60 s) and '
                             'confirm no errors. ' + SSH +
                             '"/opt/rocm/bin/rvs -c /opt/rocm/share/rocm-validation-suite/conf/sgemm.conf 2>&1 | tail -30"'),
    # --- SET 39: r156 (Peak Power Test) copied r431's amd-smi list ---
    ('Compatibility', 156): ('-- peak power test: run the CoralGEMM workload to push all GPUs to high stress, then '
                             'sample system power-supply consumption and record the max (check BMC sensors). ' + SSH +
                             '"./gemm R_64F R_64F R_64F R_64F OP_N OP_T 8640 8640 8640 8640 8640 8640 36 1200 2>&1 | tail -20; '
                             'echo ---POWER---; sensors 2>&1 | grep -iE \'watt|power|pwr\' | head -40"'),
    # --- SET 40: r169/r170 - differentiate desc (both PLDM) ---
    ('Compatibility', 169): ('-- PLDM firmware update via BMC web (boot into OS): user flashes via BMC web UI '
                             'GPU management > Firmware; agent helps via Redfish UpdateService where available and '
                             'verifies the firmware version after flash.'),
    ('Compatibility', 170): ('-- PLDM firmware update via BMC web (standby / power-off): user keeps system in standby '
                             'and flashes via BMC web UI; agent helps via Redfish UpdateService where available and '
                             'verifies the firmware version after flash.'),
    # --- SET 42: r246 (VBIOS) / r248 (NVswitch) differentiate ---
    ('Compatibility', 246): ('-- check all GPU VBIOS firmware versions. ' + SSH +
                             '"nvidia-smi --query-gpu=name,index,vbios_version --format=csv 2>&1; echo ---; '
                             'nvflash --version 2>&1"'),
    ('Compatibility', 248): ('-- check all LS10 NVswitch firmware versions. ' + SSH +
                             '"nvidia-smi -q -d NVSWITCH 2>&1 | grep -iE \'nvswitch|firmware|version\' | head -60"'),
    # --- SET 1 (DCGM family): command matched to the shared procedure ---
    ('Compatibility', 352): ('-- DCGM - Denylist check: enable persistence mode, run DCGM diagnostics '
                             '(procedure: dcgmi diag -v -r 4) and confirm every sub-test PASSes. ' + SSH +
                             '"nvidia-smi -pm 1 2>&1; systemctl start nvidia-dcgm 2>&1; dcgmi diag -v -r 4 2>&1 | tail -30"'),
    ('Compatibility', 353): ('-- DCGM - NVML Library check: enable persistence mode, run DCGM diagnostics '
                             '(procedure: dcgmi diag -v -r 4) and confirm every sub-test PASSes. ' + SSH +
                             '"nvidia-smi -pm 1 2>&1; systemctl start nvidia-dcgm 2>&1; dcgmi diag -v -r 4 2>&1 | tail -30"'),
    ('Compatibility', 354): ('-- DCGM - CUDA Main Library check: enable persistence mode, run DCGM diagnostics '
                             '(procedure: dcgmi diag -v -r 4) and confirm every sub-test PASSes. ' + SSH +
                             '"nvidia-smi -pm 1 2>&1; systemctl start nvidia-dcgm 2>&1; dcgmi diag -v -r 4 2>&1 | tail -30"'),
    ('Compatibility', 355): ('-- DCGM - Permissions and OS Blocks check: enable persistence mode, run DCGM diagnostics '
                             '(procedure: dcgmi diag -v -r 4) and confirm every sub-test PASSes. ' + SSH +
                             '"nvidia-smi -pm 1 2>&1; systemctl start nvidia-dcgm 2>&1; dcgmi diag -v -r 4 2>&1 | tail -30"'),
    ('Compatibility', 356): ('-- DCGM - Persistence Mode check: enable persistence mode, run DCGM diagnostics '
                             '(procedure: dcgmi diag -v -r 4) and confirm every sub-test PASSes. ' + SSH +
                             '"nvidia-smi -pm 1 2>&1; systemctl start nvidia-dcgm 2>&1; dcgmi diag -v -r 4 2>&1 | tail -30"'),
    ('Compatibility', 357): ('-- DCGM - Environment Variables check: enable persistence mode, run DCGM diagnostics '
                             '(procedure: dcgmi diag -v -r 4) and confirm every sub-test PASSes. ' + SSH +
                             '"nvidia-smi -pm 1 2>&1; systemctl start nvidia-dcgm 2>&1; dcgmi diag -v -r 4 2>&1 | tail -30"'),
    ('Compatibility', 358): ('-- DCGM - Page Retirement/Row Remap check: enable persistence mode, run DCGM diagnostics '
                             '(procedure: dcgmi diag -v -r 4) and confirm every sub-test PASSes. ' + SSH +
                             '"nvidia-smi -pm 1 2>&1; systemctl start nvidia-dcgm 2>&1; dcgmi diag -v -r 4 2>&1 | tail -30"'),
    ('Compatibility', 359): ('-- DCGM - Graphics Processes check: enable persistence mode, run DCGM diagnostics '
                             '(procedure: dcgmi diag -v -r 4) and confirm every sub-test PASSes. ' + SSH +
                             '"nvidia-smi -pm 1 2>&1; systemctl start nvidia-dcgm 2>&1; dcgmi diag -v -r 4 2>&1 | tail -30"'),
    ('Compatibility', 360): ('-- DCGM - Inforom check: enable persistence mode, run DCGM diagnostics '
                             '(procedure: dcgmi diag -v -r 4) and confirm every sub-test PASSes. ' + SSH +
                             '"nvidia-smi -pm 1 2>&1; systemctl start nvidia-dcgm 2>&1; dcgmi diag -v -r 4 2>&1 | tail -30"'),
    # --- SET 13: r448 (nvbandwidth) / r449 (GDS) copied r363's DCGM diag -r 5 ---
    ('Compatibility', 448): ('-- nvbandwidth NVIDIA bandwidth test: run the nvbandwidth suite and compare the result to '
                             'spec. ' + SSH +
                             '"command -v nvbandwidth 2>&1; nvbandwidth 2>&1 | grep -iE \'GPU|NVLink|PCIe|GB/s|Bandwidth\' | tail -40"'),
    ('Compatibility', 449): ('-- GDS function: create dummy data and run the gdsio GDS benchmark across CPU, then '
                             'compare GDS vs non-GDS bandwidth. ' + SSH +
                             '"dd if=/dev/zero of=${NVME_FILE:?path on NVMe, e.g. /nvme11n1/dd1G} bs=1G count=1 2>&1; '
                             'tools/gdsio -f ${NVME_FILE:?path} -d 4 -w 1 -s 1G -i 1M -x 0 -I 0 -T 60 2>&1 | tail -30"'),
    # --- SET 3: r37 (Dmidecode Info Check) copied the memory-family dmidecode -t memory; its own Proc is proc+cache ---
    ('Compatibility', 37): ('-- dmidecode information check in Linux OS: dump Type 4 (processor) and Type 7 (cache) and '
                            'compare family/manufacturer/version/clocks/cores/threads/sizes to the CPU spec. ' + SSH +
                            '"dmidecode -t processor > /tmp/type4.txt 2>&1; dmidecode -t cache > /tmp/type7.txt 2>&1; '
                            'cat /tmp/type4.txt /tmp/type7.txt"'),
    # --- Performance FIO seq/rand rows: use each item's own fio config ---
    ('Performance', 10): ('-- FIO sequential read (100% read, QD1, bs=512B, numjobs=1) on a user-designated test target: '
                          + SSH + '"command -v fio >/dev/null 2>&1 || { apt-get update && apt-get install -y fio; }; '
                          'FIO_TARGET=${FIO_TARGET:?set to a user-designated empty test volume}; RUNTIME=${RUNTIME:-60}; '
                          'fio --name=seqread --filename=$FIO_TARGET --ioengine=libaio --direct=1 --units_base=1024 '
                          '--rw=read --bs=512b --iodepth=1 --numjobs=1 --ramp_time=10s --runtime=$RUNTIME --time_based '
                          '--group_reporting 2>&1 | grep -E \'read:\|IOPS\|bw=\' | tail -10"'),
    ('Performance', 11): ('-- FIO sequential write (100% write, QD1, bs=512B, numjobs=1) on a user-designated test target: '
                          + SSH + '"command -v fio >/dev/null 2>&1 || { apt-get update && apt-get install -y fio; }; '
                          'FIO_TARGET=${FIO_TARGET:?set to a user-designated empty test volume}; RUNTIME=${RUNTIME:-60}; '
                          'fio --name=seqwrite --filename=$FIO_TARGET --ioengine=libaio --direct=1 --units_base=1024 '
                          '--rw=write --bs=512b --iodepth=1 --numjobs=1 --ramp_time=10s --runtime=$RUNTIME --time_based '
                          '--group_reporting 2>&1 | grep -E \'write:\|IOPS\|bw=\' | tail -10"'),
    ('Performance', 12): ('-- FIO random write (100% write, QD1, bs=512B, numjobs=1) on a user-designated test target: '
                          + SSH + '"command -v fio >/dev/null 2>&1 || { apt-get update && apt-get install -y fio; }; '
                          'FIO_TARGET=${FIO_TARGET:?set to a user-designated empty test volume}; RUNTIME=${RUNTIME:-60}; '
                          'fio --name=randwrite --filename=$FIO_TARGET --ioengine=libaio --direct=1 --units_base=1024 '
                          '--rw=randwrite --bs=512b --iodepth=1 --numjobs=1 --ramp_time=10s --runtime=$RUNTIME --time_based '
                          '--group_reporting 2>&1 | grep -E \'write:\|IOPS\|bw=\' | tail -10"'),
    ('Performance', 13): ('-- FIO random read (100% read, QD1, bs=512B, numjobs=1) on a user-designated test target: '
                          + SSH + '"command -v fio >/dev/null 2>&1 || { apt-get update && apt-get install -y fio; }; '
                          'FIO_TARGET=${FIO_TARGET:?set to a user-designated empty test volume}; RUNTIME=${RUNTIME:-60}; '
                          'fio --name=randread --filename=$FIO_TARGET --ioengine=libaio --direct=1 --units_base=1024 '
                          '--rw=randread --bs=512b --iodepth=1 --numjobs=1 --ramp_time=10s --runtime=$RUNTIME --time_based '
                          '--group_reporting 2>&1 | grep -E \'read:\|IOPS\|bw=\' | tail -10"'),
}

# (sheet, row) -> expected old ai_commands (guard). If mismatch, skip.
OLD = {
    ('Reliability', 155): "-- not runnable by agent: testing the physical I2C connection/link between the named components (FPGA 1 and HMC I2C-2) is a hardware-integrity check that requires probing/soldering the actual I2C traces and collecting photos per the criteria; the agent cannot touch the hardware or take photos over SSH.",
    ('Reliability', 154): '-- NIC TX/RX check under OS: run TX/RX traffic on the NIC ' + SSH + '"ip -s link show 2>&1 | grep -A3 -E \'TX|RX\'; ethtool -S eth0 2>&1 | head -n 40; echo \'traffic test needs a peer\'; ping -c5 192.168.0.1 2>&1"; full throughput needs a peer/traffic generator.',
    ('Performance', 61): "-- MLPerf 5.0 Training llama2-70b: requires the MLPerf training container/harness (NGC or local build) + CUDA/ROCm matching the GPU vendor + the model weights/dataset for MLPerf 5.0 Training llama2-70b first; this is not a one-line benchmark. Agent sets up the environment (after the user provides the NGC container image + model weights/licence), launches the MLPerf 5.0 Training llama2-70b run with the MLPerf LoadGen harness in Server/Offline mode and captures throughput+latency, then computes the official score.",
    ('Compatibility', 437): '-- not runnable by agent: "Information Check in BIOS" requires entering interactive BIOS setup and reading the memory page, which the agent cannot do over SSH.',
    ('Compatibility', 436): '-- IOmeter benchmark is a GUI-driven tool typically run interactively; needs IOmeter installed + a workload config. Agent can launch the configured IOmeter worker headless if a scriptable config is provided.',
    ('Compatibility', 137): SSH + '"amdxio -i Src(S:B:D.F) 2>&1"',
    ('Compatibility', 402): SSH + '"amdxio 2>&1 | grep -iE \'PCS|error\' 2>&1"',
    ('Compatibility', 406): '-- verify the amdgpu driver loads with IOMMU enable: check the kernel cmdline (iommu.passthrough/amd_iommu) then confirm modprobe state: ' + SSH + '"dmesg -T | grep -i -E \'iommu|amdgpu\' | head -40 2>&1"',
    ('Compatibility', 407): '-- verify the amdgpu driver loads with IOMMU disable: check the kernel cmdline (iommu.passthrough/amd_iommu) then confirm modprobe state: ' + SSH + '"dmesg -T | grep -i -E \'iommu|amdgpu\' | head -40 2>&1"',
    ('Compatibility', 145): '-- Agfhc single pass: run the AGFHC (AMD GPU Filed Health Check) harness for a single pass on the DUT and capture the health result.',
    ('Compatibility', 146): '-- AMD GPU Filed Health check - Level 5: run the AGFHC level-5 field-health check on the DUT and capture the result.',
    ('Compatibility', 413): '-- Large Transfer Bidirectional Bandwidth Test is a long-running benchmark/workload needing the AMD toolchain (ROCm, AGFHC harness, ROCm Validation Suite, RCCL etc.) compiled/installed on DUT with a matching config; not a one-liner. After setup, run the mi300_bandwidth_bidi harness and compare the resulting metric vs the AMD GPU spec/reference.',
    ('Compatibility', 414): '-- Device-to-Device Bidirectional Saturation Testing is a long-running benchmark/workload needing the AMD toolchain (ROCm, AGFHC harness, ROCm Validation Suite, RCCL etc.) compiled/installed on DUT with a matching config; not a one-liner. After setup, run the d2d_bidi_sat harness and compare the resulting metric vs the AMD GPU spec/reference.',
    ('Compatibility', 150): SSH + '"dmesg -T 2>&1 | grep -iE \'mi350|amdgpu\' | grep -iE \'error|fail|warn\' 2>&1"',
    ('Compatibility', 151): '-- read the UBB FRU in-band via ipmitool and out-of-band via BMC Redfish; agent runs ' + SSH + '"ipmitool fru list 2>&1 | grep -i -A1 ubb 2>&1" and the equivalent Redfish FRU query.',
    ('Compatibility', 156): SSH + '"amd-smi list 2>&1"',
    ('Compatibility', 169): '-- PLDM firmware update via the BMC web (boot-to-OS PLDM path) needs the user-supplied firmware image + a BMC-initiated flash; agent helps via the Redfish UpdateService step where available and verifies version after flash.',
    ('Compatibility', 170): '-- PLDM firmware update via the BMC web (boot-to-OS PLDM path) needs the user-supplied firmware image + a BMC-initiated flash; agent helps via the Redfish UpdateService step where available and verifies version after flash.',
    ('Compatibility', 246): SSH + '"nvflash --version 2>&1"',
    ('Compatibility', 248): SSH + '"nvflash --version 2>&1"',
    ('Compatibility', 352): SSH + '"dcgmi diag -r 1 2>&1"',
    ('Compatibility', 353): SSH + '"dcgmi diag -r 1 2>&1"',
    ('Compatibility', 354): SSH + '"dcgmi diag -r 1 2>&1"',
    ('Compatibility', 355): SSH + '"dcgmi diag -r 1 2>&1"',
    ('Compatibility', 356): SSH + '"dcgmi diag -r 1 2>&1"',
    ('Compatibility', 357): SSH + '"dcgmi diag -r 1 2>&1"',
    ('Compatibility', 358): SSH + '"dcgmi diag -r 1 2>&1"',
    ('Compatibility', 359): SSH + '"dcgmi diag -r 1 2>&1"',
    ('Compatibility', 360): SSH + '"dcgmi diag -r 1 2>&1"',
    ('Compatibility', 448): SSH + '"dcgmi diag -r 5 2>&1"',
    ('Compatibility', 449): SSH + '"dcgmi diag -r 5 2>&1"',
    ('Compatibility', 37): SSH + '"dmidecode -t memory 2>&1"',
    ('Performance', 10): '-- M.2 FIO benchmark: run a config-matched fio job against the M.2 test target and capture IOPS/BW: ' + SSH + '"fio --version 2>&1"',
    ('Performance', 11): '-- M.2 FIO benchmark: run a config-matched fio job against the M.2 test target and capture IOPS/BW: ' + SSH + '"fio --version 2>&1"',
    ('Performance', 12): '-- M.2 FIO benchmark: run a config-matched fio job against the M.2 test target and capture IOPS/BW: ' + SSH + '"fio --version 2>&1"',
    ('Performance', 13): '-- M.2 FIO benchmark: run a config-matched fio job against the M.2 test target and capture IOPS/BW: ' + SSH + '"fio --version 2>&1"',
    ('Compatibility', 1370): '',  # sentinel never matches
}

ci = {}
for sn in SHEETS:
    ws = wb[sn]
    hdr = [c.value for c in ws[1]]
    ci[sn] = {h: i for i, h in enumerate(hdr)}

applied = 0
skipped = 0
for (sn, r), new in FIX.items():
    ws = wb[sn]
    col15 = ws.cell(row=r, column=ci[sn]['ai_commands'] + 1)
    cur = col15.value
    if cur is None:
        cur = ''
    if (sn, r) in OLD and cur.strip() != OLD[(sn, r)].strip():
        skipped += 1
        print('SKIP (old mismatch) %s r%d' % (sn, r))
        continue
    col15.value = new
    applied += 1
    print('APPLIED %s r%d' % (sn, r))

wb.save(XLSX)
print('total applied:', applied, 'skipped:', skipped)
