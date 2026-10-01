"""SYNTHETIC only: no sockets, subprocesses or remote execution. Derived from Vera test fixture."""
from pathlib import Path
import time
from . import settings
from cycle_core import digest
from cycle_engine import CAPTURES
from cycle_transport import Command
PCI = '0000:01:00.0 Ethernet controller [0200]: Synthetic [1234:5678]\n'
SENSORS = 'Temp | 30 | degrees C | ok | na\nFan | 12000 | RPM | ok | na\n'
class SyntheticTransport:
    def __init__(self, credentials, known_hosts):
        self.known_hosts = Path(known_hosts)
        self.boots = {}
        self.calls = []
        self.uploaded = {}
        self.mismatch = False
        self.empty_baseline = False
        self.hardware_failure = False
        self.pci_drift = False
        self.sensor_drop = False
        self.sensor_reads = 0
        self.response_lost = False
        self.no_recovery = False
        self.fail_command = False
        self.power_off = False
        self.on_action = None
        self.package_missing = False

    def local_dependencies(self):
        return Command(0, 'available')

    def upload(self, target, data, remote):
        self.uploaded[target.key] = data

    def action(self, t):
        time.sleep(0.35)
        if not self.no_recovery and not self.fail_command:
            for affected in getattr(self,'affected_targets',[t]):
                self.boots[affected.key] = self.boots.get(affected.key, 0) + 1
        if self.on_action:
            self.on_action()
        return Command(1, 'rejected') if self.fail_command else Command(255, 'disconnected', 'RESPONSE_LOST') if self.response_lost else Command(0, 'accepted')

    def ssh(self, t, role, cmd, timeout=60, sudo=False):
        self.calls.append((t.key, role, cmd))
        if "printf 'HOSTNAME='" in cmd:
            name = 'wrong-host' if self.mismatch else getattr(t, role + '_hostname')
            boot = f'00000000-0000-0000-0000-{self.boots.get(t.key, 0):012d}'
            return Command(0, f'HOSTNAME={name}\nBOOT_ID={boot}\n')
        if cmd.startswith('ipmitool sel '):
            return self.oob(t, cmd.removeprefix('ipmitool '), timeout)
        if cmd.startswith('sha256sum '):
            return Command(0, digest(self.uploaded[t.key]) + ' file')
        if cmd == 'id -u':
            return Command(0, '0')
        if 'apt-get install' in cmd:
            self.package_missing = False
            return Command(0, 'installed')
        if 'MISSING=' in cmd:
            return Command(0, 'MISSING=lspci\n' if self.package_missing else '')
        if cmd in {'reboot', 'ipmitool power cycle', '/usr/bin/stbypowerctrl.sh aux_cycle'}:
            return self.action(t)
        if cmd == 'lspci -Dnn':
            return Command(0, '' if self.empty_baseline else PCI.splitlines()[0] if self.pci_drift and self.boots.get(t.key) == 1 else PCI)
        if (cmd.startswith('bash ') or cmd.startswith('MEMORY_MIN_RATIO=')):
            return Command(1, 'ISSUE|BF4_MISSING|BF4|Expected at least 1; detected 0\nRESULT|FAIL\n') if self.hardware_failure else Command(0, 'RESULT|PASS\n')
        if cmd == '/usr/bin/powerctrl.sh power_status':
            return Command(0, 'Host: Running\nChassis Power: On')
        if cmd in {value[0] for value in CAPTURES.values()} | {'dmesg -c', 'command -v mst'}:
            return Command(0, 'available\n')
        if cmd.startswith('test -f ') or cmd.startswith('rm -f '):
            return Command(0, '')
        return Command(127, 'Unsupported fake SSH command: ' + cmd)

    def oob(self, t, cmd, timeout=30):
        self.calls.append((t.key, 'oob', cmd))
        if cmd == 'sensor list':
            self.sensor_reads += 1
            text = SENSORS.splitlines()[0] if self.sensor_drop and self.sensor_reads == 2 else SENSORS
            return Command(0, text)
        if cmd == 'power soft':
            self.power_off = True
            return Command(0, 'soft sent')
        if cmd == 'power on':
            self.power_off = False
            return self.action(t)
        if cmd in {'power cycle', 'power reset'}:
            return self.action(t)
        if cmd == 'power status':
            return Command(0, 'Chassis Power is ' + ('off' if self.power_off else 'on'))
        if cmd == 'sel list':
            return Command(0, '1 | 09/29/2026 | 10:00:00 | System boot | Asserted\n')
        if cmd in {'mc info', 'sel clear'}:
            return Command(0, 'OK')
        return Command(127, 'Unsupported fake OOB command: ' + cmd)
