"""Redfish session lifecycle regressions (Item 1 / Item 2).

Covers the two review items that apply to both the standalone and this Astra
checkout:

* P1 - a login that succeeds must always be released, even when discovery
  raises *after* the token was issued (the previous shape logged in inside
  ``_redfish_discover`` and only entered the ``try`` afterwards).
* P2 - a logout failure returned as a non-zero ``Command`` (HTTP 500, timeout)
  must be surfaced as a WARN, must not downgrade a valid collection and must
  never trigger another power/cycle action.

No network access; the fake transport models the BMC session table.
"""
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


class RedfishSessionCase(unittest.TestCase):
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

    def logouts(self):
        return [c for c in self.fake.calls if c[1] == 'redfish-logout']

    def enter_session(self, record=None):
        """Enter the real context manager (the seam under test)."""
        return self.session._redfish_session(record if record is not None else self.session.node['pre'])

    def collect(self):
        record = self.session.node['pre']
        self.session.collect_redfish(record)
        self.session.finish(record)
        return record

    def logout_codes(self, record):
        return [i for i in record['issues'] if i['code'] == 'REDFISH_LOGOUT_FAILED']


# --- Item 1: a successful login must always be released --------------------
class SessionLifecycleTests(RedfishSessionCase):
    def test_systems_http_500_still_attempts_logout(self):
        # (A) login succeeds, /Systems returns HTTP 500 -> discovery raises, yet
        #     the session that was just opened must still be released.
        self.fake.systems = Command(500, 'server error', 'HTTP_ERROR', http_status=500)
        with self.assertRaises(RuntimeError):
            with self.enter_session():
                pass
        self.assertEqual(self.fake.logins, 1)
        self.assertEqual(len(self.logouts()), 1)

    def test_systems_malformed_json_still_attempts_logout(self):
        # (B) login succeeds, /Systems body is malformed.
        self.fake.systems = Command(0, '{"Members": [')
        with self.assertRaises(RuntimeError):
            with self.enter_session():
                pass
        self.assertEqual(self.fake.logins, 1)
        self.assertEqual(len(self.logouts()), 1)

    def test_collection_exception_still_runs_cleanup(self):
        # (C) An exception raised by the caller after the token was issued must
        #     still trigger cleanup.
        with self.assertRaises(ValueError):
            with self.enter_session():
                raise ValueError('entry collection blew up')
        self.assertEqual(self.fake.logins, 1)
        self.assertEqual(len(self.logouts()), 1)

    def test_repeated_collections_do_not_accumulate_sessions(self):
        # (D) Every login is matched by a logout; the BMC session table is empty.
        for _ in range(3):
            self.session.collect_redfish(self.session.node['pre'])
        self.assertEqual(len(self.logouts()), self.fake.logins)
        self.assertEqual(self.fake.live_sessions, set())

    def test_login_failure_does_not_fake_logout(self):
        # (E) When login itself fails there is no session to release.
        self.fake.redfish_fail = True
        with self.assertRaises(RuntimeError):
            with self.enter_session():
                pass
        self.assertEqual(self.fake.logins, 0)
        self.assertEqual(self.logouts(), [])

    def test_cleanup_failure_does_not_mask_discovery_exception(self):
        # (C/E) Cleanup never masks the original discovery exception.
        self.fake.systems = Command(500, 'server error', 'HTTP_ERROR', http_status=500)
        self.fake.logout_raises = RuntimeError('logout transport exploded')
        with self.assertRaises(RuntimeError) as ctx:
            with self.enter_session():
                pass
        self.assertIn('Systems unavailable', str(ctx.exception))


# --- Item 2: a returned non-zero logout is not a silent success ------------
class LogoutCommandTests(RedfishSessionCase):
    def test_http_500_logout_command_is_warn(self):
        # (A) transport returns Command(code=500) instead of raising.
        self.fake.logout_result = Command(500, 'server error', 'HTTP_ERROR', http_status=500)
        record = self.collect()
        warn = self.logout_codes(record)
        self.assertEqual(len(warn), 1)
        self.assertEqual(warn[0]['severity'], 'WARN')
        self.assertNotEqual(record['status'], 'FAIL')
        self.assertNotIn('REDFISH_COLLECTION_FAILED', [i['code'] for i in record['issues']])

    def test_timeout_logout_keeps_collection_and_original_issue(self):
        # (B) RESPONSE_LOST / timeout: keep the collection result.
        self.fake.logout_result = Command(124, 'timeout', 'RESPONSE_LOST')
        record = self.collect()
        self.assertEqual(len(self.logout_codes(record)), 1)
        self.assertNotIn('REDFISH_COLLECTION_FAILED', [i['code'] for i in record['issues']])

    def test_logout_raise_does_not_override_original_exception(self):
        # (C) A raising logout must not mask a discovery/collection failure.
        self.fake.systems = Command(500, 'server error', 'HTTP_ERROR', http_status=500)
        self.fake.logout_raises = RuntimeError('logout exploded')
        with self.assertRaises(RuntimeError) as ctx:
            with self.enter_session():
                pass
        self.assertIn('Systems unavailable', str(ctx.exception))

    def test_logout_failure_does_not_trigger_power_action(self):
        # (D) A failed logout must not re-send any power/cycle command.
        actions = []
        self.fake.on_action = lambda: actions.append(1)
        self.fake.logout_result = Command(500, 'server error', 'HTTP_ERROR', http_status=500)
        self.session.precheck()
        self.session.start()
        record = self.session.one_loop(1)
        self.assertEqual(len(actions), 1, "exactly the loop's own cycle action may occur")
        self.assertGreaterEqual(len(self.logout_codes(record)), 1)


if __name__ == '__main__':
    unittest.main()
