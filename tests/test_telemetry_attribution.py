"""Telemetry attribution and per-metric toggle behaviour for the inspection source."""
import sqlite3
import tempfile
import unittest
from pathlib import Path

from integration.inspection import DEFAULTS
from integration.inspection_service import EvidenceSource


def build_db(folder, machines=('EQ3300-AIAgent',), with_disk=True, with_gpu=True):
    dbpath = Path(folder) / 'telemetry.db'
    with sqlite3.connect(dbpath) as db:
        db.execute('CREATE TABLE os_metrics(id INTEGER, machine TEXT, ts REAL, cpu_used REAL, mem_used_pct REAL)')
        if with_gpu:
            db.execute('CREATE TABLE gpu_metrics(id INTEGER, machine TEXT, ts REAL, gpu INTEGER, util REAL, mem_total REAL, mem_used REAL)')
        if with_disk:
            db.execute('CREATE TABLE disk_metrics(id INTEGER, machine TEXT, ts REAL, mount TEXT, pct REAL)')
        for i, name in enumerate(machines):
            db.execute('INSERT INTO os_metrics VALUES(?,?,?,?,?)', (i + 1, name, 1000, 42, 55))
            if with_gpu:
                db.execute('INSERT INTO gpu_metrics VALUES(?,?,?,?,?,?,?)', (i + 1, name, 1000, 0, 30, 100, 40))
            if with_disk:
                db.execute('INSERT INTO disk_metrics VALUES(?,?,?,?,?)', (i + 1, name, 1000, '/', 91))
    return dbpath


class TelemetryAttribution(unittest.TestCase):
    def source(self, folder, **kw):
        return EvidenceSource(build_db(folder, **kw), Path(folder) / 'missing.db', folder)

    def test_hostname_raw_resolves_even_when_node_id_is_a_hash(self):
        with tempfile.TemporaryDirectory() as folder:
            src = self.source(folder)
            system = dict(project='p', nodes=[dict(node_id='fb34a37e55125dadbd7b044ab0aed310', slot=1,
                        label='OS 1', os_hostname='eq3300-aiagent', os_hostname_raw='EQ3300-AIAgent')])
            rows, coverage, _ = src(system, DEFAULTS, 1000)
            self.assertEqual({r['node_id'] for r in rows}, {'fb34a37e55125dadbd7b044ab0aed310'})
            self.assertEqual([c['state'] for c in coverage if c['source'] == 'Telemetry'], ['FRESH'])
            self.assertEqual({r['metric'] for r in rows}, {'cpu', 'memory', 'gpu', 'vram', 'disk'})

    def test_case_insensitive_hostname_still_resolves(self):
        with tempfile.TemporaryDirectory() as folder:
            src = self.source(folder)
            system = dict(project='p', nodes=[dict(node_id='deadbeef', label='OS 1',
                        os_hostname='eq3300-aiagent', os_hostname_raw='eq3300-aiagent')])
            rows, coverage, _ = src(system, DEFAULTS, 1000)
            self.assertTrue(rows)
            self.assertEqual([c['state'] for c in coverage if c['source'] == 'Telemetry'], ['FRESH'])

    def test_unknown_hostname_is_missing_not_guessed(self):
        with tempfile.TemporaryDirectory() as folder:
            src = self.source(folder)
            system = dict(project='p', nodes=[dict(node_id='ghost', label='OS 1',
                        os_hostname='no-such-host', os_hostname_raw='no-such-host')])
            rows, coverage, _ = src(system, DEFAULTS, 1000)
            self.assertEqual(rows, [])
            self.assertEqual([c['state'] for c in coverage if c['source'] == 'Telemetry'], ['MISSING'])

    def test_disabled_metric_produces_no_observation(self):
        with tempfile.TemporaryDirectory() as folder:
            src = self.source(folder)
            system = dict(project='p', nodes=[dict(node_id='fb34a37e55125dadbd7b044ab0aed310', label='OS 1',
                        os_hostname='eq3300-aiagent', os_hostname_raw='EQ3300-AIAgent')])
            config = {**DEFAULTS, 'telemetry_checks': {'cpu': False, 'memory': True, 'gpu': False, 'vram': True, 'disk': True}}
            rows, coverage, _ = src(system, config, 1000)
            self.assertEqual({r['metric'] for r in rows}, {'memory', 'vram', 'disk'})
            self.assertEqual([c['state'] for c in coverage if c['source'] == 'Telemetry'], ['FRESH'])

    def test_disk_metric_carries_mount_as_component(self):
        with tempfile.TemporaryDirectory() as folder:
            src = self.source(folder)
            system = dict(project='p', nodes=[dict(node_id='fb34a37e55125dadbd7b044ab0aed310', label='OS 1',
                        os_hostname='eq3300-aiagent', os_hostname_raw='EQ3300-AIAgent')])
            rows, _, _ = src(system, DEFAULTS, 1000)
            disk = [r for r in rows if r['metric'] == 'disk']
            self.assertEqual([(r['component'], r['value']) for r in disk], [('disk:/', 91)])
            self.assertEqual(disk[0]['rule'], 'disk.utilization.high')

    def test_missing_disk_table_does_not_break_os_metrics(self):
        with tempfile.TemporaryDirectory() as folder:
            src = self.source(folder, with_disk=False)
            system = dict(project='p', nodes=[dict(node_id='fb34a37e55125dadbd7b044ab0aed310', label='OS 1',
                        os_hostname='eq3300-aiagent', os_hostname_raw='EQ3300-AIAgent')])
            rows, coverage, _ = src(system, DEFAULTS, 1000)
            self.assertEqual({r['metric'] for r in rows}, {'cpu', 'memory', 'gpu', 'vram'})
            self.assertEqual([c['state'] for c in coverage if c['source'] == 'Telemetry'], ['FRESH'])

    def test_stale_history_is_reported_stale_with_matched_name(self):
        with tempfile.TemporaryDirectory() as folder:
            src = self.source(folder)
            system = dict(project='p', nodes=[dict(node_id='fb34a37e55125dadbd7b044ab0aed310', label='OS 1',
                        os_hostname='eq3300-aiagent', os_hostname_raw='EQ3300-AIAgent')])
            rows, coverage, _ = src(system, DEFAULTS, 1000 + DEFAULTS['stale_seconds'] + 1)
            self.assertEqual(rows, [])
            entry = [c for c in coverage if c['source'] == 'Telemetry'][0]
            self.assertEqual(entry['state'], 'STALE')
            self.assertIn('EQ3300-AIAgent', entry['detail'])


class TelemetryCheckConfig(unittest.TestCase):
    def test_defaults_include_disk_and_checks(self):
        self.assertEqual(DEFAULTS['thresholds']['disk'], 90)
        self.assertEqual(DEFAULTS['thresholds']['cpu_temp'], 85)
        self.assertEqual(DEFAULTS['thresholds']['gpu_power'], 95)
        self.assertEqual(set(DEFAULTS['telemetry_checks']), {'cpu', 'memory', 'gpu', 'vram', 'disk', 'cpu_temp', 'gpu_temp', 'gpu_power'})

    def test_validate_accepts_partial_telemetry_checks(self):
        from integration.inspection import validate_config
        config = validate_config(DEFAULTS, {'telemetry_checks': {'gpu': False}})
        self.assertFalse(config['telemetry_checks']['gpu'])
        self.assertTrue(config['telemetry_checks']['cpu'])

    def test_validate_rejects_unknown_check_and_non_bool(self):
        from integration.inspection import validate_config
        with self.assertRaises(ValueError):
            validate_config(DEFAULTS, {'telemetry_checks': {'network': True}})
        with self.assertRaises(ValueError):
            validate_config(DEFAULTS, {'telemetry_checks': {'cpu': 'yes'}})

    def test_old_stored_config_gains_new_nested_keys(self):
        from integration.inspection import InspectionStore
        with tempfile.TemporaryDirectory() as folder:
            store = InspectionStore(Path(folder) / 'i.db')
            store.configure('s', {'enabled': False}, 'test', now=900)
            system = store.system('s')
            self.assertEqual(system['config']['thresholds']['disk'], 90)
            self.assertTrue(system['config']['telemetry_checks']['disk'])


if __name__ == '__main__':
    unittest.main()
