# closing pass (e): convert executed-command angle-bracket placeholders `<X>` -> `${VAR:?...}`
# on the Compatibility sheet (mirrors the round-2 ${VAR:?...} convention; section 20v R7).
# Prose/comment `<...>` (e.g. Functionality r1328 `<id>` doc, r1631 `<Disk>`, r1634 `<PXE>`) are
# documentation, NOT executed -> left untouched.
import openpyxl, re, sys

XLSX = 'data/REVISED_commands_merged_with_raw.xlsx'
SHEETS = ['Functionality', 'Reliability', 'Performance', 'Compatibility', 'Stability', '(No Main Function)']

# token -> replacement (same var name for same semantic, shared across tokens)
MAP = {
    'm2testfile': '${FIO_TARGET:?operator provides the M.2 test file path/block device (never OS/boot)}',
    'eth1': '${LINK_IFACE_1:?operator provides NIC interface 1}',
    'eth2': '${LINK_IFACE_2:?operator provides NIC interface 2}',
    'driver': '${DRIVER_NAME:?operator provides the NIC driver module name}',
    'peer': '${IPERF_PEER_IP:?operator provides the peer host IP}',
    'addr': '${IP_ADDR:?operator provides the IP address}',
    'len': '${IP_PREFIX_LEN:?operator provides the prefix length}',
    'iface': '${LINK_IFACE:?operator provides the NIC interface}',
    'mlx': '${MLX_DEVICE:?operator provides the Mellanox device (e.g. mlx5_0)}',
    'device': '${MLX_DEVICE:?operator provides the Mellanox device (e.g. mlx5_0)}',
    'fw': '${RAID_FW_FILE:?operator provides the controller FW image path}',
    'encl': '${RAID_ENCL_ID:?operator provides the enclosure id (e.g. 0)}',
    'slot': '${RAID_SLOT_ID:?operator provides the slot id (e.g. 0)}',
    'dev': '${RAID_DEVICE:?operator provides the spare block device (e.g. /dev/sdX)}',
    'server': '${IMG_SERVER_URL:?operator provides the image server base URL}',
    'iso': '${IMG_ISO_PATH:?operator provides the ISO image path on the server}',
    'image': '${GPU_FW_IMAGE:?operator provides the exact GPU FW image file}',
    'watts': '${GREEN_WATTS:?operator provides the power limit in watts}',
    'ip': '${IP_ADDR:?operator provides the IP address}',
    'pf': '${SRIOV_PF_IFACE:?operator provides the SR-IOV PF interface}',
}

wb = openpyxl.load_workbook(XLSX)
changed = {}
for sn in SHEETS:
    ws = wb[sn]
    hdr = [c.value for c in ws[1]]
    ci = {h: i for i, h in enumerate(hdr)}
    for r in range(2, ws.max_row + 1):
        aic = ws.cell(row=r, column=ci['ai_commands'] + 1).value
        if not isinstance(aic, str):
            continue
        new = aic
        hit = 0
        for tok, rep in MAP.items():
            pat = re.compile(r'<%s>' % re.escape(tok))
            new, n = pat.subn(rep, new)
            hit += n
        if hit and new != aic:
            ws.cell(row=r, column=ci['ai_commands'] + 1).value = new
            changed[(sn, r)] = hit

print('rows with placeholder conversions:', len(changed))
from collections import Counter
print('by sheet:', dict(Counter(k[0] for k in changed)))
print('rows:', sorted(k[1] for k in changed if k[0] == 'Compatibility'))

DRY = len(sys.argv) > 1 and sys.argv[1] == 'dry'
if DRY:
    print('DRY - not saved')
else:
    wb.save(XLSX)
    print('saved', XLSX)
    # re-scan: any leftover executed-command placeholders?
    leftovers = []
    for sn in ['Compatibility']:
        ws = wb[sn]
        hdr2 = [c.value for c in ws[1]]
        ci2 = {h: i for i, h in enumerate(hdr2)}
        for r in range(2, ws.max_row + 1):
            aic = ws.cell(row=r, column=ci2['ai_commands'] + 1).value or ''
            for mm in re.finditer(r'<([A-Za-z_][A-Za-z0-9_]*)>', aic):
                leftovers.append((sn, r, mm.group(1)))
    print('leftover <...> in Compatibility:', leftovers if leftovers else 'NONE')
