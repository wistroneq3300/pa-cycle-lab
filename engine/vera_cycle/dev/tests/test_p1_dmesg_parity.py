"""P1-3 regression: dmesg parser parity (AER grouping, EDAC counts, NVMe).

Ported from the standalone cycle parser regressions and adapted to this
checkout's module names. Covers P1-4's required matrix:

* PCIe corrected AER, fatal/uncorrected AER
* same BDF, different AER error bit -> distinct findings (no wrong dedup)
* multi-line AER grouping (status/mask, [n] bit lines, TLP Header)
* EDAC CE count change is not a new failure; EDAC UE is a distinct, worse event
* NVMe timeout and NVMe reset failure

No network/SSH access; pure text parsing.
"""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from cycle_core import classify_against_pre, dmesg_issues, issue_baseline


def aer(name='BadTLP', bit=6, bdf='0000:01:00.0', severity='Correctable'):
    return (f'[ 1.0] pcieport {bdf}: PCIe Bus Error: severity={severity}, type=Data Link Layer, (Receiver ID)\n'
            f'[ 1.1] pcieport {bdf}:   device [8086:1234] error status/mask={1 << bit:08x}/00000000\n'
            f'[ 1.2] pcieport {bdf}:    [{bit:2d}] {name}\n')


class AERTests(unittest.TestCase):
    def test_bits_identity_and_full_raw(self):
        pre = dmesg_issues(aer())
        post = classify_against_pre(dmesg_issues(aer('BadDLLP', 7)), issue_baseline(pre))
        self.assertNotEqual(pre[0]['fingerprint'], post[0]['fingerprint'])
        self.assertEqual(post[0]['classification'], 'NEW')
        self.assertEqual(post[0]['raw_lines'], [1, 2, 3])
        self.assertEqual(post[0]['error_bits'], [{'bit': 7, 'name': 'BadDLLP'}])
        self.assertIn('00000080/00000000', post[0]['raw'])
        self.assertIn('BadDLLP', post[0]['snippet'])
        # Printk timestamp width must not change identity.
        integer_times = dmesg_issues(aer().replace('[ 1.0]', '[ 1]').replace('[ 1.1]', '[ 2]').replace('[ 1.2]', '[ 3]'))
        self.assertEqual(pre[0]['fingerprint'], integer_times[0]['fingerprint'])
        self.assertEqual(integer_times[0]['error_bits'], [{'bit': 6, 'name': 'BadTLP'}])

    def test_same_bdf_different_bit_is_not_deduped(self):
        a = dmesg_issues(aer('BadTLP', 6))[0]
        b = dmesg_issues(aer('BadDLLP', 7))[0]
        self.assertEqual(a['device'], b['device'])           # same BDF
        self.assertNotEqual(a['fingerprint'], b['fingerprint'])
        self.assertEqual((a['error_bits'][0]['bit'], b['error_bits'][0]['bit']), (6, 7))

    def test_multiline_grouping_and_event_boundaries(self):
        first = aer().splitlines()
        other = aer('BadDLLP', 7, '0000:02:00.0').splitlines()
        items = dmesg_issues('\n'.join([first[0], other[0], first[1], other[1], first[2], other[2]]))
        self.assertEqual(len(items), 2)
        self.assertEqual(items[0]['raw_lines'], [1, 3, 5])
        self.assertEqual(items[1]['raw_lines'], [2, 4, 6])
        adjacent = dmesg_issues(aer() + aer('BadDLLP', 7))
        self.assertEqual(len(adjacent), 2)
        self.assertNotEqual(adjacent[0]['fingerprint'], adjacent[1]['fingerprint'])
        # An unrelated same-device line closes the event (bounded join, not unlimited).
        items = dmesg_issues(first[0] + '\npcieport 0000:01:00.0: unrelated status\n' + first[2])
        self.assertEqual(items[0]['raw_lines'], [1])
        # Corrected vs fatal on the SAME named bit is the same event identity.
        fatal = dmesg_issues(aer(severity='Uncorrectable (Fatal)'))
        self.assertEqual(dmesg_issues(aer())[0]['fingerprint'], fatal[0]['fingerprint'])

    def test_corrected_is_warn_and_fatal_is_fail(self):
        self.assertEqual(dmesg_issues(aer(severity='Correctable'))[0]['severity'], 'WARN')
        self.assertEqual(dmesg_issues(aer(severity='Uncorrectable (Fatal)'))[0]['severity'], 'FAIL')


class EDACTests(unittest.TestCase):
    LINE = 'EDAC MC0: {} CE on DIMM1 (channel:0 address:0x123 syndrome:0x4)'

    def test_rising_ce_count_is_not_a_new_failure(self):
        pre, post = dmesg_issues(self.LINE.format(1)), dmesg_issues(self.LINE.format(5))
        self.assertEqual(pre[0]['fingerprint'], post[0]['fingerprint'])
        classify_against_pre(post, issue_baseline(pre))
        self.assertEqual(post[0]['classification'], 'KNOWN')
        self.assertEqual(post[0]['native_error_count'], 5)
        self.assertEqual(post[0]['occurrence_count'], 1)

    def test_different_dimm_or_severity_is_distinct(self):
        post = dmesg_issues(self.LINE.format(5))
        self.assertNotEqual(post[0]['fingerprint'],
                            dmesg_issues(self.LINE.format(5).replace('DIMM1', 'DIMM2'))[0]['fingerprint'])
        self.assertNotEqual(post[0]['fingerprint'],
                            dmesg_issues(self.LINE.format(5).replace(' CE ', ' UE '))[0]['fingerprint'])

    def test_ue_is_fail_and_ce_is_warn(self):
        self.assertEqual(dmesg_issues(self.LINE.format(1))[0]['severity'], 'WARN')
        self.assertEqual(dmesg_issues(self.LINE.format(1).replace(' CE ', ' UE '))[0]['severity'], 'FAIL')


class SensorNameParityTests(unittest.TestCase):
    def test_c0_and_c1_control_characters_are_malformed(self):
        # Cc covers C0 (0x00-0x1F) AND C1 (0x7F-0x9F); ord(c) < 32 misses C1.
        from cycle_core import parse_sensors, sensor_issues
        for code in (0x00, 0x7f, 0x85, 0x9d, 0x9f):
            findings = sensor_issues(parse_sensors(f'CPU{chr(code)}Temp | 30 | degrees C | ok'))
            self.assertTrue(findings, f'Control character U+{code:04X} must not pass unnoticed')
            self.assertTrue(findings[0]['code'].startswith('SENSOR_'))
        self.assertFalse(sensor_issues(parse_sensors('CPU Temp\t | 30 | degrees C | ok')))


class NVMeTests(unittest.TestCase):
    def test_io_timeout_is_detected(self):
        items = dmesg_issues('[ 5.0] nvme0n1: I/O 12 timeout, aborting\n')
        self.assertTrue(items)
        self.assertEqual(items[0]['code'], 'DMESG_NVME')

    def test_timed_out_is_detected(self):
        items = dmesg_issues('[ 5.0] nvme nvme0: I/O 12 QID 1 timeout, reset controller, timed out\n')
        self.assertTrue(items)
        self.assertEqual(items[0]['code'], 'DMESG_NVME')

    def test_controller_down_is_detected(self):
        items = dmesg_issues('[ 5.0] nvme nvme0: controller is down; will reset\n')
        self.assertTrue(items)
        self.assertEqual(items[0]['code'], 'DMESG_NVME')

    def test_reset_failure_is_detected(self):
        items = dmesg_issues('[ 5.0] nvme nvme0: resetting controller failed\n')
        self.assertTrue(items)
        self.assertEqual(items[0]['code'], 'DMESG_NVME')

    def test_non_nvme_traffic_is_ignored(self):
        self.assertEqual(dmesg_issues('[ 1.0] nvme0n1: detected capacity change from 0 to 1000\n'), [])


if __name__ == '__main__':
    unittest.main()
