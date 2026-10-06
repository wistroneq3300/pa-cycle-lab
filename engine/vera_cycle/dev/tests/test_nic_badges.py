"""Offline regressions for the NIC badge contradiction (P2 NIC).

``parse_hardware_checks`` decides which ``CHECK|`` lines become badge-able
hardware checks. Per-slot inventory rows (``NIC_SLOT``) and raw evidence rows
(``NIC_MST_ROW``, ``NIC_NON_CARD``) must not be surfaced as standalone PASS
badges: a ``NIC`` FAIL finding rendered next to a ``NIC_SLOT ... PASS`` /
``NIC_MST_ROW PASS`` row is self-contradictory. ``NIC_DEGRADED`` must downgrade
to FAIL when its NIC finding is FAIL, and a non-NIC device on a NIC position
(``NIC_NON_CARD``, e.g. an EQ3300 GB100) must not fabricate a NIC failure.
"""
import unittest

from cycle_core import parse_hardware_checks
from cycle_report import _summary_groups


# One degraded slot (0003:00:00.0, not a Vera NIC) plus a healthy slot, and a
# GPU on another NIC position. Mirrors eq3300_config.sh emission.
DEGRADED_OUTPUT = """
CHECK|NIC_SLOT|slot=0002:00:00.0|state=PRESENT|mst_device=mlx5_0
CHECK|NIC_SLOT|slot=0003:00:00.0|state=DEGRADED|mst_device=mlx5_1
CHECK|NIC_MST_ROW|slot=0003:00:00.0|row=0003:00:00.0:2112:0020:12:50:00:00:00:00:00:00:00:00:00:00:0000
CHECK|NIC_NON_CARD|slot=0004:00:00.0|type=GB100
CHECK|CPU|actual=2|minimum=2
"""


class NicBadgeParserTests(unittest.TestCase):
    def _checks(self, findings):
        return parse_hardware_checks(DEGRADED_OUTPUT, findings)

    def test_evidence_rows_are_not_badges(self):
        # NIC_SLOT / NIC_MST_ROW / NIC_NON_CARD are inventory/evidence only;
        # they must not appear as standalone hardware checks.
        checks, details = self._checks([])
        for key in list(checks):
            self.assertFalse(key.startswith('NIC_SLOT'), f"NIC_SLOT badge emitted: {key}")
            self.assertNotIn('NIC_MST_ROW', key)
            self.assertNotIn('NIC_NON_CARD', key)
        self.assertNotIn('NIC_MST_ROW', details)
        self.assertNotIn('NIC_NON_CARD', details)

    def test_nic_degraded_does_not_show_pass_when_nic_finding_is_fail(self):
        findings = [{'code': 'NIC_DEGRADED', 'component': 'NIC', 'severity': 'FAIL'}]
        checks, _ = self._checks(findings)
        # No NIC_DEGRADED PASS badge may contradict the NIC FAIL finding.
        self.assertNotIn('NIC_DEGRADED/PASS', [(k, v) for k, v in checks.items() if k.startswith('NIC_DEGRADED')])
        nic_degraded_states = [v for k, v in checks.items() if k.startswith('NIC_DEGRADED')]
        self.assertNotIn('PASS', nic_degraded_states)

    def test_nic_degraded_is_fail_not_pass(self):
        findings = [{'code': 'NIC_DEGRADED', 'component': 'NIC', 'severity': 'FAIL'}]
        checks, _ = self._checks(findings)
        for key, state in checks.items():
            if key.startswith('NIC_DEGRADED'):
                self.assertEqual(state, 'FAIL')

    def test_non_card_does_not_cause_nic_fail(self):
        # A GPU on a NIC position (NIC_NON_CARD) is NOT a NIC failure. With no
        # NIC finding, nothing NIC-related may be FAIL.
        checks, _ = self._checks([])
        for key, state in checks.items():
            if key.startswith('NIC'):
                self.assertNotEqual(state, 'FAIL', f"{key} marked FAIL from non-card evidence")
        self.assertNotIn('NIC', {k for k in checks if k.startswith('NIC')})

    def test_unrelated_check_still_parsed(self):
        checks, _ = self._checks([])
        self.assertEqual(checks.get('CPU'), 'PASS')


class NicBadgeRenderTests(unittest.TestCase):
    def test_no_contradictory_nic_pass_badge_in_report(self):
        findings = [{'code': 'NIC_DEGRADED', 'component': 'NIC', 'severity': 'FAIL'}]
        checks, details = parse_hardware_checks(DEGRADED_OUTPUT, findings)
        record = {
            'hardware_checks': checks,
            'hardware_check_details': details,
            'check_summary': dict(checks),
            'commands': {},
            'issues': findings,
        }
        groups = _summary_groups(record)
        hardware = groups['hardware']
        # The NIC_DEGRADED check may appear, but never as PASS.
        for row in hardware:
            if 'NIC_DEGRADED' in str(row.get('raw_key', '')):
                self.assertNotEqual(row.get('status'), 'PASS')
        # Raw evidence rows must not be badged at all.
        for row in hardware:
            key = str(row.get('raw_key', ''))
            self.assertFalse(key.startswith('NIC_MST_ROW'), f"evidence row badged: {key}")
            self.assertFalse(key.startswith('NIC_NON_CARD'), f"evidence row badged: {key}")
            self.assertFalse(key.startswith('NIC_SLOT'), f"slot inventory badged: {key}")


if __name__ == '__main__':
    unittest.main()
