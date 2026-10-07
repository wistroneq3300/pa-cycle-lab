"""P1 regression: Redfish severity findings and referenced-entry integrity.

P1-1 - ``NodeSession.add`` must accept and forward ``snippet`` so a real
       Redfish Warning/Critical becomes a canonical WARN/FAIL finding with its
       evidence instead of raising TypeError and being swallowed into a generic
       REDFISH_UNAVAILABLE.
P1-2 - a referenced collection member whose body is unreadable (truncated JSON,
       an empty ``{}``, or an object missing both Id and Message) is a
       collection integrity failure, never a silent PASS. A valid entry with an
       unknown/blank severity stays a valid event.

No network access; the fake transport models the BMC Redfish surface.
"""
import json
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

EVENTLOG = '/redfish/v1/Systems/System_0/LogServices/EventLog'
SEL = '/redfish/v1/Systems/System_0/LogServices/SEL'


def entry(i, sev, msg='x'):
    return {"Id": str(i), "Severity": sev, "Created": "2000-01-03T04:44:02Z", "Message": msg}


class FakeRedfish(base.FakeTransport):
    """FakeTransport whose EventLog/SEL members are controllable.

    ``eventlog_members`` is the raw ``Members`` list served for
    ``EventLog/Entries``; ``reference_bodies`` maps a referenced path to the raw
    body returned for it. This lets a test drive bare ``@odata.id`` references
    through the real fetch/normalise path.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.eventlog_members = []
        self.sel_members = []
        self.reference_bodies = {}

    def redfish_get(self, target, path, token, timeout=30):
        self.calls.append((target.key, 'redfish', path))
        if path in self.reference_bodies:
            return Command(0, self.reference_bodies[path])
        if path == '/redfish/v1/Systems':
            return Command(0, json.dumps({"Members": [{"@odata.id": "/redfish/v1/Systems/System_0"}]}))
        if path.endswith('/LogServices'):
            members = [{"@odata.id": EVENTLOG}]
            if self.redfish_sel_present:
                members.append({"@odata.id": SEL})
            return Command(0, json.dumps({"Members": members}))
        if path.endswith('/EventLog/Entries'):
            return Command(0, json.dumps({"Members": self.eventlog_members}))
        if path.endswith('/SEL/Entries'):
            return Command(0, json.dumps({"Members": self.sel_members}))
        return Command(127, 'Unsupported fake Redfish path: ' + path)


class RedfishCase(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.options = SimpleNamespace(project='neutrino', cycle_mode='power_cycle', channel='inband',
                                       boot_timeout=.03, poll_interval=.001, loops=1, hours=0, cycle=True,
                                       config_script=base.BASE/'neutrino_config.sh',
                                       issue_policy=base.BASE/'issue_policy.md',
                                       output=self.root/'output', sensor_retry_delay=0)
        self.fake = FakeRedfish({}, self.root/'ssh')
        self.session = NodeSession(base.target(), self.fake, self.root, 'test', b'script', digest(b'script'),
                                   self.options, parse_policy(self.options.issue_policy.read_text()))

    def tearDown(self):
        self.temp.cleanup()

    def collect(self):
        record = self.session.node['pre']
        self.session.collect_redfish(record)
        self.session.finish(record)
        return record


# --- P1-1: severity propagation to the canonical issue model ---------------
class SeverityPropagationTests(RedfishCase):
    def test_warning_eventlog_is_a_canonical_warn_finding(self):
        self.fake.eventlog_members = [entry(1, 'OK', 'boot'), entry(2, 'Warning', 'fan slow')]
        record = self.collect()
        self.assertEqual(record['eventlog_meta']['verdict'], 'WARN')
        findings = [i for i in record['issues'] if i['code'] == 'REDFISH_WARNING']
        self.assertEqual(len(findings), 1)
        self.assertEqual(findings[0]['severity'], 'WARN')
        # P1-1: the snippet/evidence must survive (no TypeError -> REDFISH_UNAVAILABLE).
        self.assertIn('fan slow', findings[0]['snippet'])
        self.assertTrue(findings[0]['evidence'])
        self.assertFalse([i for i in record['issues'] if i['code'] == 'REDFISH_UNAVAILABLE'])

    def test_critical_eventlog_is_a_canonical_fail_finding(self):
        self.fake.eventlog_members = [entry(1, 'OK', 'boot'), entry(2, 'Critical', 'CPLD_0 error')]
        record = self.collect()
        self.assertEqual(record['eventlog_meta']['verdict'], 'FAIL')
        findings = [i for i in record['issues'] if i['code'] == 'REDFISH_CRITICAL']
        self.assertEqual(len(findings), 1)
        self.assertEqual(findings[0]['severity'], 'FAIL')
        self.assertIn('CPLD_0 error', findings[0]['snippet'])
        self.assertTrue(findings[0]['evidence'])
        self.assertFalse([i for i in record['issues'] if i['code'] == 'REDFISH_UNAVAILABLE'])

    def test_add_forwards_snippet_to_the_issue(self):
        record = self.session.node['pre']
        self.session.add(record, 'X', 'c', 'detail', severity='WARN', evidence='e', snippet='s')
        self.assertEqual(record['issues'][-1], dict(code='X', component='c', detail='detail',
                                                     severity='WARN', evidence='e', snippet='s'))

    def test_clean_eventlog_stays_pass_without_findings(self):
        self.fake.eventlog_members = [entry(1, 'OK', 'boot')]
        record = self.collect()
        self.assertEqual(record['eventlog_meta']['verdict'], 'PASS')
        self.assertEqual([i for i in record['issues'] if i['code'].startswith('REDFISH_')], [])


# --- P1-2: referenced entry integrity --------------------------------------
class ReferencedEntryTests(RedfishCase):
    REF = EVENTLOG + '/Entries/42'

    def _reference_only(self, body):
        self.fake.eventlog_members = [{"@odata.id": self.REF}]
        if body is not None:
            self.fake.reference_bodies[self.REF] = body

    def test_reference_truncated_json_is_collection_failure(self):
        self._reference_only('{')
        record = self.collect()
        meta = record['eventlog_meta']
        self.assertFalse(meta['valid'])
        self.assertFalse(meta['complete'])
        self.assertNotEqual(meta['verdict'], 'PASS')
        self.assertTrue([i for i in record['issues'] if i['code'] == 'REDFISH_COLLECTION_FAILED'])

    def test_reference_empty_object_is_collection_failure(self):
        # A successfully decoded empty JSON object is unreadable, not "no events".
        self._reference_only('{}')
        record = self.collect()
        meta = record['eventlog_meta']
        self.assertFalse(meta['valid'])
        self.assertNotEqual(meta['verdict'], 'PASS')
        self.assertTrue([i for i in record['issues'] if i['code'] == 'REDFISH_COLLECTION_FAILED'])

    def test_reference_missing_identity_is_collection_failure(self):
        self._reference_only(json.dumps({"Severity": "OK"}))
        record = self.collect()
        meta = record['eventlog_meta']
        self.assertFalse(meta['valid'])
        self.assertNotEqual(meta['verdict'], 'PASS')

    def test_reference_valid_warning_is_a_warn_finding(self):
        self._reference_only(json.dumps(entry(42, 'Warning', 'via reference')))
        record = self.collect()
        self.assertEqual(record['eventlog_meta']['verdict'], 'WARN')
        self.assertTrue([i for i in record['issues'] if i['code'] == 'REDFISH_WARNING'])

    def test_reference_valid_critical_is_a_fail_finding(self):
        self._reference_only(json.dumps(entry(42, 'Critical', 'via reference')))
        record = self.collect()
        self.assertEqual(record['eventlog_meta']['verdict'], 'FAIL')
        self.assertTrue([i for i in record['issues'] if i['code'] == 'REDFISH_CRITICAL'])

    def test_reference_valid_ok_is_pass(self):
        self._reference_only(json.dumps(entry(42, 'OK', 'fine')))
        record = self.collect()
        self.assertEqual(record['eventlog_meta']['verdict'], 'PASS')
        self.assertTrue(record['eventlog_meta']['valid'])

    def test_reference_valid_unknown_severity_is_not_collection_failure(self):
        # A vendor entry with an unknown/blank severity is a VALID event, not an
        # integrity failure - it must not be reported as a collection failure.
        self._reference_only(json.dumps({"Id": "42", "Severity": "", "Message": "vendor note"}))
        record = self.collect()
        meta = record['eventlog_meta']
        self.assertTrue(meta['valid'])
        self.assertTrue(meta['complete'])
        self.assertFalse([i for i in record['issues'] if i['code'] == 'REDFISH_COLLECTION_FAILED'])

    def test_one_malformed_member_makes_whole_collection_fail(self):
        good = EVENTLOG + '/Entries/1'
        self.fake.eventlog_members = [{"@odata.id": good}, {"@odata.id": self.REF}]
        self.fake.reference_bodies[good] = json.dumps(entry(1, 'OK', 'fine'))
        self.fake.reference_bodies[self.REF] = '{}'
        record = self.collect()
        meta = record['eventlog_meta']
        self.assertFalse(meta['valid'])
        self.assertNotEqual(meta['verdict'], 'PASS')


if __name__ == '__main__':
    unittest.main()
