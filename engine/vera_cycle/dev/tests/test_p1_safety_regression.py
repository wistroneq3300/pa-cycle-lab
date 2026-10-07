"""P1-4 safety regression: the destructive-dispatch / recovery gates are intact.

These assert the invariants the P1 change set must NOT weaken. Each maps to a
named requirement:

* RESPONSE_LOST never re-sends a power action
* a power action is dispatched only once
* a reboot is only confirmed when the OS boot id actually changed
* an identity mismatch stops the cycle
* an evidence-persistence failure forbids the destructive dispatch (the durable
  intent is written before the command; if it cannot be written, nothing is sent)
* hardware execution that is incomplete is neither "completed" nor a valid cycle
* a RESULT|FAIL command can be execution-complete while health stays FAIL

Most of these already have dedicated regressions in test_cycle / test_hardware_
completion / test_review_regressions; this file pins the ones that were not
previously covered (evidence-persistence-before-dispatch) and re-states the
contract compactly so a future edit cannot silently drop one.
"""
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))

import cycle_engine
from cycle_core import EvidencePersistenceError
from cycle_transport import Command

import test_cycle as base


class DispatchSafetyTests(base.EngineTests):
    """Engine fixture from test_cycle (FakeTransport, real NodeSession)."""

    def _dispatch(self, record=None):
        record = record if record is not None else self.session.node['pre']
        return self.session.dispatch(record, 'cycle_command', 'os', 'reboot', sudo=False)

    @staticmethod
    def _cmds(fake):
        return [cmd for _, _, cmd in fake.calls]

    def test_persistence_failure_forbids_dispatch(self):
        # The durable intent write happens before the command is sent. If it
        # fails, the destructive command must NOT be issued.
        before = self._cmds(self.fake).count('reboot')
        with patch.object(cycle_engine, 'atomic_write', side_effect=EvidencePersistenceError('disk full')):
            with self.assertRaises(EvidencePersistenceError):
                self._dispatch()
        self.assertEqual(self._cmds(self.fake).count('reboot'), before,
                         'no command may be sent after a persistence failure')

    def test_dispatch_issues_reboot_once(self):
        self._dispatch()
        self.assertEqual(self._cmds(self.fake).count('reboot'), 1)

    def test_response_lost_is_not_reissued(self):
        # Also covered end-to-end by test_cycle.test_lost_response_is_reconciled_not_reissued;
        # pinned here at the dispatch boundary.
        self.fake.response_lost = True
        state = self._dispatch()
        self.assertEqual(state, 'RESPONSE_LOST')
        self.assertEqual(self._cmds(self.fake).count('reboot'), 1,
                         'a lost response must never be re-sent')

    def test_identity_mismatch_raises_and_stops(self):
        from cycle_transport import IdentityUnsafe
        self.fake.mismatch = True
        record = self.session.node['pre']
        with self.assertRaises(IdentityUnsafe):
            self.session.identity(record, 'os', 'os_pre')


if __name__ == '__main__':
    unittest.main()
