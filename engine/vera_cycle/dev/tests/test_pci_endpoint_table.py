"""Offline regressions for the PCIe endpoint link table in the HTML report.

The report renders one row per captured PCI function. These tests pin the data
pipeline (parse_pci -> parse_pci_verbose -> merge_pci_devices -> _render_pci_group)
so a display function with no PCIe capability stays UNSUPPORTED and never becomes
a fabricated PASS.
"""
import unittest

from cycle_core import merge_pci_devices, parse_hardware_checks, parse_pci, parse_pci_verbose
from cycle_engine import new_record
from cycle_report import _hardware_detail, _pci_summary, _render_pci_group


PCI = """0002:02:00.0 VGA compatible controller [0300]: ASPEED Technology, Inc. ASPEED Graphics Family [1a03:2000]
0002:21:00.0 USB controller [0c03]: Renesas Electronics Corp. uPD720201 USB 3.0 Host Controller [1912:0014]
0004:01:00.0 Non-Volatile memory controller [0108]: KIOXIA Corporation NVMe SSD Controller XD8 [1e0f:002e]
000c:01:00.0 Non-Volatile memory controller [0108]: KIOXIA Corporation Device [1e0f:001c]
0002:00:00.0 PCI bridge [0604]: Fabric bridge [10de:2f95]
"""

VERBOSE = """0002:02:00.0 VGA compatible controller
\tCapabilities: [50] MSI: Enable+
\tDeviceName: Embedded Video Controller
0002:21:00.0 USB controller
\tCapabilities: [a0] Express (v2) Endpoint
\tLnkCap: Speed 5GT/s, Width x1
\tLnkSta: Speed 5GT/s, Width x1
0004:01:00.0 Non-Volatile memory controller
\tCapabilities: [80] Express (v2) Endpoint
\tLnkCap: Speed 32GT/s, Width x4
\tLnkSta: Speed 32GT/s, Width x4
000c:01:00.0 Non-Volatile memory controller
\tCapabilities: [80] Express (v2) Endpoint
\tLnkCap: Speed 16GT/s, Width x4
\tLnkSta: Speed 16GT/s, Width x4
0002:00:00.0 PCI bridge
\tCapabilities: [80] Express (v2) Root Port
\tLnkSta: Speed 16GT/s, Width x16
"""


class PciEndpointTableTests(unittest.TestCase):
    def test_endpoint_rows_are_data_driven(self):
        devices = merge_pci_devices(parse_pci(PCI), parse_pci_verbose(VERBOSE))
        record = new_record('PRE')
        record.update(pci=parse_pci(PCI), pci_devices=devices,
                      commands={'pci': {'valid': True, 'evidence': 'pre_pci.txt'},
                                'pci_verbose': {'valid': True, 'evidence': 'pre_pci_verbose.txt'}},
                      check_summary={'pci': 'PASS', 'pci_verbose': 'PASS'},
                      hardware_checks={'PCIE_LINK/0002:02:00.0': 'UNSUPPORTED',
                                       'PCIE_LINK/0002:21:00.0': 'PASS',
                                       'PCIE_LINK/0004:01:00.0': 'PASS',
                                       'PCIE_LINK/000c:01:00.0': 'PASS'},
                      status='PASS', finished='2026-10-01T10:00:01+08:00')
        devices_out, counts, evaluated, result = _pci_summary(record)
        self.assertEqual([d['bdf'] for d in devices_out],
                         ['0002:02:00.0', '0002:21:00.0', '0004:01:00.0', '000c:01:00.0'])
        self.assertEqual(evaluated, 3)
        # The display function is counted as N/A + UNSUPPORTED combined.
        self.assertEqual(counts['N/A'] + counts['UNSUPPORTED'], 1)
        self.assertEqual(result, 'PASS')
        self.assertEqual(devices['000c:01:00.0']['device_name'], 'KIOXIA Corporation Device')
        self.assertEqual(devices['0002:02:00.0']['link_result'], 'N/A')
        page = _render_pci_group(record)
        self.assertIn('PCIe Endpoint Link Validation', page)
        self.assertIn('ASPEED Technology', page)
        self.assertIn('000c:01:00.0', page)
        self.assertIn('Expected:</strong> Not configured', page)
        # The hardware script result is authoritative: a display function with
        # no PCIe link is shown as UNSUPPORTED, never fabricated into a PASS row.
        self.assertIn('class="badge unsupported">UNSUPPORTED', page)
        self.assertIn('PCIE_LINK/0002:02:00.0=UNSUPPORTED', page)
        self.assertNotIn('class="badge n/a"', page)
        # Exactly three endpoint rows are PASS; the fourth row is UNSUPPORTED.
        self.assertEqual(page.count('class="badge pass">PASS</span><br>'), 3)

    def test_another_project_shape_has_no_sample_defaults(self):
        base = parse_pci('000a:09:00.0 Ethernet controller [0200]: Acme Adapter [abcd:1234]\n')
        verbose = parse_pci_verbose('''000a:09:00.0 Ethernet controller
 Capabilities: [80] Express (v2) Endpoint
 LnkCap: Speed 8GT/s, Width x2
 LnkSta: Speed 8GT/s, Width x2
''')
        record = new_record('PRE')
        record.update(pci=base, pci_devices=merge_pci_devices(base, verbose),
                      commands={'pci': {'valid': True, 'evidence': 'pre_pci.txt'},
                                'pci_verbose': {'valid': True, 'evidence': 'pre_pci_verbose.txt'}},
                      status='PASS', finished='2026-10-01T10:00:01+08:00')
        html = _render_pci_group(record)
        self.assertIn('000a:09:00.0', html)
        self.assertIn('Acme Adapter', html)
        self.assertNotIn('0002:02:00.0', html)

    def test_missing_lnksta_is_fail_not_pass(self):
        missing = parse_pci_verbose("""0000:01:00.0 Non-Volatile memory controller
 Capabilities: [80] Express (v2) Endpoint
 LnkCap: Speed 16GT/s, Width x4
""")
        self.assertEqual(missing['0000:01:00.0']['link_result'], 'FAIL')

    def test_integrated_endpoint_without_link_is_na(self):
        rciep = parse_pci_verbose("""0000:01:00.0 Controller
 Capabilities: [80] Express (v2) Root Complex Integrated Endpoint
""")
        self.assertEqual(rciep['0000:01:00.0']['link_result'], 'N/A')

    def test_access_denied_is_fail_not_guessed(self):
        denied = merge_pci_devices(
            parse_pci('0000:02:00.0 Ethernet controller [0200]: Adapter [1234:5678]\n'),
            parse_pci_verbose('0000:02:00.0 Ethernet controller\n Capabilities: <access denied>\n'))
        self.assertEqual(denied['0000:02:00.0']['link_result'], 'FAIL')

    def test_unusable_lnksta_is_fail(self):
        unusable = parse_pci_verbose("""0000:03:00.0 Controller
 Capabilities: [80] Express (v2) Endpoint
 LnkSta: DLActive-
""")
        self.assertEqual(unusable['0000:03:00.0']['link_result'], 'FAIL')

    def test_display_without_capabilities_stays_unsupported(self):
        # No Capabilities line at all -> the parser cannot conclude "no PCIe
        # capability", so the device must remain UNKNOWN, never N/A or PASS.
        vga = parse_pci_verbose("""0000:04:00.0 VGA compatible controller
 Kernel driver in use: ast
""")
        self.assertEqual(vga['0000:04:00.0']['link_result'], 'UNKNOWN')


class HardwareCheckDetailTests(unittest.TestCase):
    """CHECK| parsing must keep the measured values, not just the state.

    The HTML report's "Measured detail" column reads hardware_check_details;
    if parsing drops it every hardware row renders as "—" (the regression this
    pins).
    """

    TEXT = (
        'CHECK|CPU|actual=2|minimum=2\n'
        'CHECK|CPU_ONLINE|logical=352|online=352|sockets=2|row_errors=0|missing_socket=0\n'
        'CHECK|MEMORY_VISIBLE|installed_kib=1610612736|visible_kib=1599501312|minimum_ratio=0.9\n'
        'CHECK|BF4|actual=0|exact=1|pci_functions=0\n'
        'CHECK|PCIE_LINK|bdf=0004:01:00.0|state=evaluated|lnksta=LnkSta: Speed 32GT/s, Width x4\n'
    )

    def test_details_kept_for_every_check(self):
        checks, details = parse_hardware_checks(self.TEXT, [])
        for key in ('CPU', 'CPU_ONLINE', 'MEMORY_VISIBLE', 'BF4', 'PCIE_LINK/0004:01:00.0'):
            self.assertIn(key, checks)
            self.assertIn(key, details)
            self.assertIn('values', details[key])
            self.assertTrue(details[key]['values'])
            self.assertEqual(details[key]['status'], checks[key])

    def test_report_renders_measured_detail_from_parsed_values(self):
        _, details = parse_hardware_checks(self.TEXT, [])
        record = {'hardware_check_details': details, 'hardware_checks': {}, 'commands': {}}
        self.assertEqual(_hardware_detail(record, 'CPU'), 'actual=2 · minimum=2')
        self.assertIn('visible_kib=', _hardware_detail(record, 'MEMORY_VISIBLE'))
        self.assertIn('pci_functions=0', _hardware_detail(record, 'BF4'))

    def test_finding_downgrades_state_but_keeps_values(self):
        findings = [{'component': 'BF4', 'severity': 'FAIL'}]
        checks, details = parse_hardware_checks(self.TEXT, findings)
        self.assertEqual(checks['BF4'], 'FAIL')
        self.assertEqual(details['BF4']['status'], 'FAIL')
        self.assertEqual(details['BF4']['values']['actual'], '0')

    def test_nic_slot_check_is_not_emitted_contradicting_nic_finding(self):
        # P1-4: NIC_SLOT is inventoried separately and reported through NIC_*
        # findings whose component is 'NIC'. A NIC_SLOT check badge would always
        # read PASS (its component never matches 'NIC'), contradicting a NIC FAIL.
        # It must not be emitted into the hardware checks at all.
        text = ('CHECK|NIC_SLOT|slot=0002:00:00.0|state=PRESENT|device_type=Vera\n'
                'CHECK|NIC_SLOT|slot=0003:00:00.0|state=DEGRADED|device_type=NA\n'
                'CHECK|CPU|actual=2|minimum=2\n')
        findings = [{'component': 'NIC', 'severity': 'FAIL'}]
        checks, details = parse_hardware_checks(text, findings)
        self.assertNotIn('NIC_SLOT', checks)
        self.assertNotIn('NIC_SLOT', details)
        # The unrelated check is still parsed normally.
        self.assertIn('CPU', checks)


if __name__ == '__main__':
    unittest.main()
