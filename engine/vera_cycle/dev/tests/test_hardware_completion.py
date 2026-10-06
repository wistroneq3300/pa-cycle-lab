"""Hardware execution-complete gate regressions (Item 3).

The hardware script is uploaded and its file+SHA verified before every run, but
"verified" only means the *file* is the expected one - it is not proof that the
script ran to the end. A timeout, a lost response, a truncated run, a missing or
duplicated/mismatched RESULT must therefore never be counted as a completed or
valid cycle.

Completion and health are separate: ``RESULT|FAIL`` with a legal exit 1 is a
*complete* run (hardware was checked and answered), while an execution that
never finished is *incomplete* no matter how healthy the partial output looks.

No network access; the fake transport serves the hardware script output.
"""
import contextlib
import io
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parent))

from cycle_core import digest, parse_policy
from cycle_engine import NodeSession
from cycle_transport import Command

import test_cycle as base


class HardwareCase(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.options = SimpleNamespace(project='neutrino', cycle_mode='power_cycle', channel='inband',
                                       boot_timeout=.03, poll_interval=.001, loops=1, hours=0, cycle=True,
                                       config_script=base.BASE/'neutrino_config.sh',
                                       issue_policy=base.BASE/'issue_policy.md',
                                       output=self.root/'output', sensor_retry_delay=0)
        self.fake = base.FakeTransport({}, self.root/'ssh')
        self.session = NodeSession(base.target(), self.fake, self.root, 'test', b'script', digest(b'script'),
                                   self.options, parse_policy(self.options.issue_policy.read_text()))

    def tearDown(self):
        self.temp.cleanup()

    def serve_hardware(self, command):
        """Make the fake return ``command`` for the hardware script call."""
        original = self.fake.ssh

        def ssh(t, role, cmd, timeout=60, sudo=False):
            if cmd.startswith('bash ') or cmd.startswith('MEMORY_MIN_RATIO='):
                self.fake.calls.append((t.key, role, cmd))
                return command
            return original(t, role, cmd, timeout, sudo)
        self.fake.ssh = ssh

    def capture_pre(self):
        """Run a PRE capture (script_verified path) and return the record."""
        record = self.session.node['pre']
        self.session.capture(record)
        return record

    def codes(self, record):
        return [i['code'] for i in record['issues']]


class IncompleteExecutionTests(HardwareCase):
    """Every way the script can fail to finish must mark execution incomplete."""

    def assert_incomplete(self, record):
        self.assertFalse(self.session.hardware_execution_complete)
        self.assertFalse(record['hardware_execution_complete'])
        self.assertIn('HARDWARE_EXECUTION_INCOMPLETE', self.codes(record))
        self.assertEqual(self.session.node['active'], False)
        self.assertEqual(self.session.node['stop_reason'],
                         'Hardware script execution incomplete')

    def test_timeout_exit_124_is_incomplete(self):
        # (A) SHA is correct but the script timed out.
        self.serve_hardware(Command(124, '', 'RESPONSE_LOST'))
        self.assert_incomplete(self.capture_pre())

    def test_response_lost_is_incomplete(self):
        # (A) transport lost the reply entirely.
        self.serve_hardware(Command(255, '', 'RESPONSE_LOST'))
        self.assert_incomplete(self.capture_pre())

    def test_missing_trailing_result_is_incomplete(self):
        # (B) the script was interrupted before emitting its final RESULT.
        self.serve_hardware(Command(0, 'CHECK|NIC|actual=8|minimum=8\n'))
        self.assert_incomplete(self.capture_pre())

    def test_duplicate_result_is_incomplete(self):
        # (C) two RESULT lines: the end of the run cannot be trusted.
        self.serve_hardware(Command(0, 'RESULT|PASS\nnoise\nRESULT|PASS\n'))
        self.assert_incomplete(self.capture_pre())

    def test_illegal_result_token_is_incomplete(self):
        # (C) an unknown RESULT token is not a legal completion signal.
        self.serve_hardware(Command(0, 'RESULT|MAYBE\n'))
        self.assert_incomplete(self.capture_pre())

    def test_exit_result_mismatch_is_incomplete(self):
        # (C) exit 0 must pair with RESULT|PASS; RESULT|FAIL is a mismatch.
        self.serve_hardware(Command(0, 'RESULT|FAIL\n'))
        self.assert_incomplete(self.capture_pre())

    def test_exit1_with_pass_is_mismatch_incomplete(self):
        self.serve_hardware(Command(1, 'RESULT|PASS\n'))
        self.assert_incomplete(self.capture_pre())

    def test_result_not_on_last_line_is_incomplete(self):
        # (B) trailing output after RESULT means the script did not end there.
        self.serve_hardware(Command(0, 'RESULT|PASS\ntrailing garbage\n'))
        self.assert_incomplete(self.capture_pre())


class CompleteExecutionTests(HardwareCase):
    """A run that genuinely finished counts as complete - health is separate."""

    def test_clean_pass_is_complete(self):
        # (D) normal RESULT|PASS with exit 0.
        self.serve_hardware(Command(0, 'CHECK|NIC|actual=8|minimum=8\nRESULT|PASS\n'))
        record = self.capture_pre()
        self.assertTrue(self.session.hardware_execution_complete)
        self.assertTrue(record['hardware_execution_complete'])
        self.assertNotIn('HARDWARE_EXECUTION_INCOMPLETE', self.codes(record))
        self.assertTrue(self.session.node['active'])

    def test_complete_fail_is_still_complete(self):
        # (D) RESULT|FAIL + legal exit 1 = hardware was checked and answered;
        #     completion is true even though health is FAIL.
        self.serve_hardware(Command(1, 'ISSUE|BF4_MISSING|BF4|Expected at least 1; detected 0\nRESULT|FAIL\n'))
        record = self.capture_pre()
        self.assertTrue(self.session.hardware_execution_complete)
        self.assertIn('BF4_MISSING', self.codes(record))
        self.assertNotIn('HARDWARE_EXECUTION_INCOMPLETE', self.codes(record))

    def test_incomplete_does_not_persist_into_next_capture(self):
        # Each capture resets the state: an incomplete PRE must not make a later
        # complete capture inherit "incomplete" (and vice-versa).
        self.serve_hardware(Command(124, '', 'RESPONSE_LOST'))
        first = self.session.node['pre']
        self.session.capture(first)
        self.assertFalse(self.session.hardware_execution_complete)
        # A fresh, complete run on the same session must clear the flag.
        self.session.node['active'] = True
        self.serve_hardware(Command(0, 'RESULT|PASS\n'))
        second = self.session.node['pre']
        self.session.capture(second)
        self.assertTrue(self.session.hardware_execution_complete)


class CycleAccountingTests(HardwareCase):
    """Incomplete execution must not add completed/valid cycles or dispatch more."""

    def ready(self):
        self.session.precheck()
        self.session.start()

    def test_incomplete_cycle_is_not_completed_or_valid(self):
        # (E) A loop whose hardware run never finished must not count.
        self.ready()
        self.serve_hardware(Command(124, '', 'RESPONSE_LOST'))
        record = self.session.one_loop(1)
        self.assertFalse(record.get('post_complete'))
        self.assertEqual(self.session.node['completed'], 0)
        self.assertEqual(self.session.node['valid_cycles'], 0)
        self.assertFalse(self.session.node['active'])

    def test_complete_fail_cycle_is_completed_but_health_fails(self):
        # (D/E) complete RESULT|FAIL: completed++ and valid_cycle true, even
        # though the campaign health is FAIL.
        self.ready()
        self.serve_hardware(Command(1, 'ISSUE|BF4_MISSING|BF4|Expected at least 1; detected 0\nRESULT|FAIL\n'))
        record = self.session.one_loop(1)
        self.assertTrue(record.get('post_complete'))
        self.assertTrue(record.get('valid_cycle'))
        self.assertEqual(self.session.node['completed'], 1)
        self.assertEqual(self.session.node['valid_cycles'], 1)

    def test_incomplete_does_not_dispatch_next_round(self):
        # (E) The node is deactivated so the campaign must not queue another
        # round for it. Campaign stops with an INCOMPLETE state.
        with contextlib.redirect_stdout(io.StringIO()):
            code = base.campaign(self.options, [base.target()], {},
                                 confirm=lambda _: 'yes',
                                 transport_factory=lambda *a: self.fake,
                                 runtime_root=self.root/'runtime')
        # The default fake hardware output is a *complete* RESULT|FAIL, so the
        # campaign completes; now force an incomplete run and confirm no extra
        # round is dispatched for the node.
        self.serve_hardware(Command(124, '', 'RESPONSE_LOST'))
        calls_before = len(self.fake.calls)
        with contextlib.redirect_stdout(io.StringIO()):
            base.campaign(self.options, [base.target()], {},
                          confirm=lambda _: 'yes',
                          transport_factory=lambda *a: self.fake,
                          runtime_root=self.root/'runtime2')
        hardware_calls = [c for c in self.fake.calls[calls_before:]
                          if c[2].startswith('bash ') or c[2].startswith('MEMORY_MIN_RATIO=')]
        # One attempt (1 loop) only; the node is deactivated after the incomplete
        # first loop, so no second hardware run is issued.
        self.assertEqual(len(hardware_calls), 1)


if __name__ == '__main__':
    unittest.main()
