"""Read-only MAC evidence. No inference from IP, ARP, NIC order or OUI."""
import ipaddress
import re


def _ip(value):
    try:
        return ipaddress.ip_address(value.split('%')[0])
    except (ValueError, AttributeError):
        return None


def _mac(value):
    value = value.lower().strip()
    if not re.fullmatch(r'(?:[0-9a-f]{2}:){5}[0-9a-f]{2}', value):
        return None
    if value in ('00:00:00:00:00:00', 'ff:ff:ff:ff:ff:ff'):
        return None
    return value


def os_mac(text, expected_ip):
    target = _ip(expected_ip)
    if target is None:
        return None
    matches = []
    for block in re.split(r'(?=^\d+: )', text, flags=re.M):
        header = re.match(r'\d+: ([^:]+):', block)
        mac = re.search(r'\blink/ether\s+(\S+)', block)
        addresses = re.findall(r'\binet6?\s+([^/\s]+)', block)
        if header and mac and target in [_ip(x) for x in addresses] and _mac(mac[1]):
            matches.append({'mac': _mac(mac[1]), 'interface': header[1], 'ip': expected_ip,
                            'source': 'ip a'})
    return matches[0] if len(matches) == 1 else None


def bmc_mac(text, expected_ip):
    target = _ip(expected_ip)
    if target is None:
        return None
    matches = []
    for block in re.split(r'(?=^---CHANNEL \d+---$)', text, flags=re.M):
        channel = re.match(r'---CHANNEL (\d+)---', block)
        address = re.search(r'^\s*IP Address\s*:\s*(\S+)\s*$', block, re.M)
        mac = re.search(r'^\s*MAC Address\s*:\s*(\S+)\s*$', block, re.M)
        if channel and address and mac and _ip(address[1]) == target and _mac(mac[1]):
            matches.append({'mac': _mac(mac[1]), 'channel': int(channel[1]),
                            'ip': expected_ip, 'source': 'ipmitool lan print'})
    return matches[0] if len(matches) == 1 else None


# timeout bounds each channel; if unavailable, no guessed result is returned.
LAN_COMMAND = ('for ch in 0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do '
               'printf "%s\\n" "---CHANNEL $ch---"; '
               'timeout 2 ipmitool lan print "$ch" 2>/dev/null; done')


def collect(machine, ssh_run):
    result = {'os': None, 'bmc': None}
    if machine.get('os_ip') and machine.get('os_user') and machine.get('os_pass'):
        text, rc, _ = ssh_run(machine['os_ip'], machine['os_user'], machine['os_pass'],
                             machine.get('os_port') or 22, 'ip a', timeout=10)
        if rc == 0:
            result['os'] = os_mac(text or '', machine['os_ip'])
        if machine.get('bmc_ip'):
            text, _, _ = ssh_run(machine['os_ip'], machine['os_user'], machine['os_pass'],
                                machine.get('os_port') or 22, LAN_COMMAND, timeout=40)
            result['bmc'] = bmc_mac(text or '', machine['bmc_ip'])
    if (result['bmc'] is None and machine.get('bmc_ip')
            and machine.get('bmc_user') and machine.get('bmc_pass')):
        # Legacy records can store the IPMI port here; it is not an SSH port.
        port = machine.get('bmc_port') or 22
        if port == 623:
            port = 22
        text, _, _ = ssh_run(machine['bmc_ip'], machine['bmc_user'], machine['bmc_pass'],
                            port, LAN_COMMAND, timeout=40)
        result['bmc'] = bmc_mac(text or '', machine['bmc_ip'])
    return result
