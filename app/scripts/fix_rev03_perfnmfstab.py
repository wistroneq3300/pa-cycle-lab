#!/usr/bin/env python3
"""Round-3 Reliability-batch-2 fixes (2026-09-18) - Performance + Stability + NMF.

Sheet row -> edits. col map: 13=ai_can_execute, 14=ai_packages_needed,
15=ai_commands, 16=ai_logs_output, 17=risk.
Every edit asserts the exact current cell text before writing.
"""
import sys
import openpyxl

XLSX = 'data/REVISED_commands_merged_with_raw.xlsx'
DRY = '--dry' in sys.argv

wb = openpyxl.load_workbook(XLSX)


def getws(name):
    return wb[name]


def setcell(ws, row, col, old, new):
    cur = ws.cell(row=row, column=col).value
    if cur is None:
        cur = ''
    if cur != old:
        raise AssertionError(
            f"{ws.title} r{row} col{col} mismatch:\n  got: {cur!r}\n  exp: {old!r}")
    if not DRY:
        ws.cell(row=row, column=col).value = new
    print(f"{ws.title:15s} r{row:4d} col{col:2d} {'DRY' if DRY else 'SET'} ({len(old)} -> {len(new)} chars)")


P = getws('Performance')
S = getws('Stability')

# =========================================================
# Performance
# =========================================================

# --- r6-r9: FIO rewrite (Q-LIT printf + invalid comma job syntax -> cmdline fio) ---
setcell(P, 6, 15,
 '-- FIO job `seqread` (rw=read, bs=512B, iodepth=1) needs fio installed and a user-designated test volume mounted; write a matching .fio job sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "printf "%s" "[global]\\nioengine=libaio\\ndirect=1\\ntime_based=1\\nruntime=60\\n[test]\\nrw=read, bs=512B, iodepth=1" > /tmp/seqread.fio && fio /tmp/seqread.fio 2>&1 | tee /tmp/seqread.log 2>&1" to capture IOPS/BW.',
 '-- FIO sequential read (100% read, QD1, bs=512B, numjobs=1) on a user-designated test volume: sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "command -v fio >/dev/null 2>&1 || { apt-get update && apt-get install -y fio; }; FIO_TARGET=${FIO_TARGET:?set to a user-designated empty test volume}; RUNTIME=${RUNTIME:-60}; fio --name=seqread --filename=$FIO_TARGET --ioengine=libaio --direct=1 --units_base=1024 --rw=read --bs=512b --iodepth=1 --numjobs=1 --ramp_time=10s --runtime=$RUNTIME --time_based --group_reporting 2>&1 | grep -E "read:|IOPS|bw=" | tail -10"')
setcell(P, 7, 15,
 '-- FIO job `seqwrite` (rw=write, bs=512B, iodepth=64) needs fio installed and a user-designated test volume mounted; write a matching .fio job sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "printf "%s" "[global]\\nioengine=libaio\\ndirect=1\\ntime_based=1\\nruntime=60\\n[test]\\nrw=write, bs=512B, iodepth=64" > /tmp/seqwrite.fio && fio /tmp/seqwrite.fio 2>&1 | tee /tmp/seqwrite.log 2>&1" to capture IOPS/BW.',
 '-- FIO sequential write (100% write, QD1, bs=512B, numjobs=1) on a user-designated test volume: sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "command -v fio >/dev/null 2>&1 || { apt-get update && apt-get install -y fio; }; FIO_TARGET=${FIO_TARGET:?set to a user-designated empty test volume}; RUNTIME=${RUNTIME:-60}; fio --name=seqwrite --filename=$FIO_TARGET --ioengine=libaio --direct=1 --units_base=1024 --rw=write --bs=512b --iodepth=1 --numjobs=1 --ramp_time=10s --runtime=$RUNTIME --time_based --group_reporting 2>&1 | grep -E "write:|IOPS|bw=" | tail -10"')
setcell(P, 8, 15,
 '-- FIO job `randwrite` (rw=randwrite, bs=512B, iodepth=1) needs fio installed and a user-designated test volume mounted; write a matching .fio job sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "printf "%s" "[global]\\nioengine=libaio\\ndirect=1\\ntime_based=1\\nruntime=60\\n[test]\\nrw=randwrite, bs=512B, iodepth=1" > /tmp/randwrite.fio && fio /tmp/randwrite.fio 2>&1 | tee /tmp/randwrite.log 2>&1" to capture IOPS/BW.',
 '-- FIO random write (100% write, QD1, bs=512B, numjobs=1) on a user-designated test volume: sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "command -v fio >/dev/null 2>&1 || { apt-get update && apt-get install -y fio; }; FIO_TARGET=${FIO_TARGET:?set to a user-designated empty test volume}; RUNTIME=${RUNTIME:-60}; fio --name=randwrite --filename=$FIO_TARGET --ioengine=libaio --direct=1 --units_base=1024 --rw=randwrite --bs=512b --iodepth=1 --numjobs=1 --ramp_time=10s --runtime=$RUNTIME --time_based --group_reporting 2>&1 | grep -E "write:|IOPS|bw=" | tail -10"')
setcell(P, 9, 15,
 '-- FIO job `randread` (rw=randread, bs=512B, iodepth=1) needs fio installed and a user-designated test volume mounted; write a matching .fio job sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "printf "%s" "[global]\\nioengine=libaio\\ndirect=1\\ntime_based=1\\nruntime=60\\n[test]\\nrw=randread, bs=512B, iodepth=1" > /tmp/randread.fio && fio /tmp/randread.fio 2>&1 | tee /tmp/randread.log 2>&1" to capture IOPS/BW.',
 '-- FIO random read (100% read, QD1, bs=512B, numjobs=1) on a user-designated test volume: sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "command -v fio >/dev/null 2>&1 || { apt-get update && apt-get install -y fio; }; FIO_TARGET=${FIO_TARGET:?set to a user-designated empty test volume}; RUNTIME=${RUNTIME:-60}; fio --name=randread --filename=$FIO_TARGET --ioengine=libaio --direct=1 --units_base=1024 --rw=randread --bs=512b --iodepth=1 --numjobs=1 --ramp_time=10s --runtime=$RUNTIME --time_based --group_reporting 2>&1 | grep -E "read:|IOPS|bw=" | tail -10"')

# --- r14/16/18/19: $SERVER_IP -> ${SERVER_IP:?...} ---
setcell(P, 14, 15,
 '-- Ethernet Performance (src=ConnectX-NIC): run iPerf Ethernet throughput for 5 min. Agent starts the server and a client run sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "iperf -s -i 60 & sleep 2; iperf -c $SERVER_IP -i 60 -t 300 2>&1 | tail -n 12; kill %1 2>/dev/null 2>&1" ; requires a second host as the iperf peer.',
 '-- Ethernet Performance (src=ConnectX-NIC): run iPerf Ethernet throughput for 5 min. Agent starts the server and a client run sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "iperf -s -i 60 & sleep 2; iperf -c ${SERVER_IP:?a reachable peer IP for the iperf client} -i 60 -t 300 2>&1 | tail -n 12; kill %1 2>/dev/null 2>&1" ; requires a second host as the iperf peer.')
setcell(P, 16, 15,
 '-- Ethernet Performance (src=BlueField-DPU): run iPerf Ethernet throughput for 5 min. Agent starts the server and a client run sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "iperf -s -i 60 & sleep 2; iperf -c $SERVER_IP -i 60 -t 300 2>&1 | tail -n 12; kill %1 2>/dev/null 2>&1" ; requires a second host as the iperf peer.',
 '-- Ethernet Performance (src=BlueField-DPU): run iPerf Ethernet throughput for 5 min. Agent starts the server and a client run sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "iperf -s -i 60 & sleep 2; iperf -c ${SERVER_IP:?a reachable peer IP for the iperf client} -i 60 -t 300 2>&1 | tail -n 12; kill %1 2>/dev/null 2>&1" ; requires a second host as the iperf peer.')
setcell(P, 18, 15,
 '-- Netperf: run Netperf (TCP/UDP) throughput. Agent builds netperf from the HP github tarball and runs sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "tar -zxf netperf-netperf-2.7.0.tar.gz 2>&1; cd netperf-2.7.0 && ./configure >/dev/null 2>&1 && make >/dev/null 2>&1 && make install >/dev/null 2>&1; netserver & sleep 2; netperf -t TCP_STREAM -H $SERVER_IP -l 60 -P 0 2>&1 | tail -n 8; kill %1 2>/dev/null 2>&1" ; needs a peer host as netserver.',
 '-- Netperf: run Netperf (TCP/UDP) throughput. Agent builds netperf from the HP github tarball and runs sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "tar -zxf netperf-netperf-2.7.0.tar.gz 2>&1; cd netperf-2.7.0 && ./configure >/dev/null 2>&1 && make >/dev/null 2>&1 && make install >/dev/null 2>&1; netserver & sleep 2; netperf -t TCP_STREAM -H ${SERVER_IP:?a reachable peer IP for netserver} -l 60 -P 0 2>&1 | tail -n 8; kill %1 2>/dev/null 2>&1" ; needs a peer host as netserver.')
setcell(P, 19, 15,
 '-- Iperf: run iperf3 throughput. Agent installs iperf3 and runs server/client sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "apt-get install -y iperf3 2>&1 | tail -n 3; iperf3 -s & sleep 2; iperf3 -c $SERVER_IP -P 4 -t 60 -i 10 --logfile /tmp/iperf.txt 2>&1; kill %1 2>/dev/null; tail -n 15 /tmp/iperf.txt 2>&1" ; needs a peer host.',
 '-- Iperf: run iperf3 throughput. Agent installs iperf3 and runs server/client sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "apt-get install -y iperf3 2>&1 | tail -n 3; iperf3 -s & sleep 2; iperf3 -c ${SERVER_IP:?a reachable peer IP for the iperf3 client} -P 4 -t 60 -i 10 --logfile /tmp/iperf.txt 2>&1; kill %1 2>/dev/null; tail -n 15 /tmp/iperf.txt 2>&1" ; needs a peer host.')

# --- r61: col14+col16 MLPerf copy-error -> NCCL (matches r48) ---
setcell(P, 61, 14,
 'MLPerf inference|training harness + LoadGen + NGC container (user provides, license) + CUDA/ROCm + Docker + model weights/dataset for MLPerf 5.0 Training llama2-70b',
 'OpenMPI 5.0.5 + NCCL-tests + libpmix/libfabric (multi-node)')
setcell(P, 61, 16,
 'return the LoadGen run log + throughput (Samples/s or queries/s) + latency (P99) + resulting final MLPerf 5.0 Training llama2-70b score vs the mlcommons/MLPerf training published value; pass/fail judged by the user vs mlcommons. Long run - confirm duration/approval.',
 'return the mpirun all_reduce_perf output (busbw/algBW per size) so the user confirms the multi-node NCCL runs without error and meets the NVIDIA performance doc spec.')
setcell(P, 61, 17,
 'RISK: MLPerf training benchmark is license-restricted, long-running and GPU-intensive; the user must provide the container/weights/dataset, and final score is judged by the user.',
 'RISK: multi-node NCCL needs 2 hosts in the cluster with password-free SSH + full GPU bandwidth; not a one-liner, requires the cluster set up first.')

# --- MLPerf verdict flips PARTIAL -> YES (locked-21 MLPerf ruling + round-2 r2273=YES) ---
MLPERF_ROWS = [21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36,
               40, 41, 42, 43, 44, 45, 46, 49, 50, 51, 52, 53, 54, 55, 56, 57,
               58, 59, 60]
for rr in MLPERF_ROWS:
    setcell(P, rr, 13, 'PARTIAL', 'YES')

# =========================================================
# Stability
# =========================================================
setcell(S, 75, 15,
 '-- Ethernet Stress: run the IB read/write tool over Ethernet for all CX7 and BF3 ports for 1 hour. Agent runs the throughput test sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "for p in $ETH_PORTS; do ib_read_bw -d $p -t 3600 2>&1 | tail -n 5; done 2>&1" ; after stress the agent checks CRC/error counters sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "ethtool -S $DUT_NIC 2>&1 | egrep -i \'crc|err\' | head -n 10 2>&1" ; needs OFED/IB tools.',
 '-- Ethernet Stress: run the IB read/write tool over Ethernet for all CX7 and BF3 ports for 1 hour. Agent runs the throughput test sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "for p in ${ETH_PORTS:?port list of the CX7/BF3 ports under test}; do ib_read_bw -d $p -t 3600 2>&1 | tail -n 5; done 2>&1" ; after stress the agent checks CRC/error counters sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "ethtool -S $DUT_NIC 2>&1 | egrep -i \'crc|err\' | head -n 10 2>&1" ; needs OFED/IB tools.')
setcell(S, 76, 15,
 '-- Infiniband Stress: run the IB read/write tool over InfiniBand for all CX7 and BF3 ports for 1 hour. Agent runs sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "for p in $IB_PORTS; do ib_read_bw -d $p -t 3600 2>&1 | tail -n 5; done 2>&1; echo \'---crc after---\'; ethtool -S $DUT_NIC 2>&1 | egrep -i \'crc|err\' | head -n 10 2>&1" ; needs OFED/IB tools + a peer IB node.',
 '-- Infiniband Stress: run the IB read/write tool over InfiniBand for all CX7 and BF3 ports for 1 hour. Agent runs sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "for p in ${IB_PORTS:?port list of the CX7/BF3 IB ports under test}; do ib_read_bw -d $p -t 3600 2>&1 | tail -n 5; done 2>&1; echo \'---crc after---\'; ethtool -S $DUT_NIC 2>&1 | egrep -i \'crc|err\' | head -n 10 2>&1" ; needs OFED/IB tools + a peer IB node.')

if not DRY:
    wb.save(XLSX)
    print('saved:', XLSX)
else:
    print('DRY-RUN - not saved')
