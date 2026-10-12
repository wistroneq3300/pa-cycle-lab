"""Known-issue suppression and thermal/power rules for the inspection evaluator."""
import sqlite3
import tempfile
import unittest
from pathlib import Path

from integration.inspection import DEFAULTS, InspectionEvaluator, InspectionStore, key, encode
from integration.inspection_service import EvidenceSource


def build_telemetry(folder, temp=30, power=100, power_limit=700):
    dbpath = Path(folder) / 'telemetry.db'
    with sqlite3.connect(dbpath) as db:
        db.execute('CREATE TABLE os_metrics(id INTEGER, machine TEXT, ts REAL, cpu_used REAL, mem_used_pct REAL, cpu_temp_c REAL)')
        db.execute('CREATE TABLE gpu_metrics(id INTEGER, machine TEXT, ts REAL, gpu INTEGER, util REAL, mem_total REAL, mem_used REAL, temp REAL, power REAL, power_limit REAL)')
        db.execute('CREATE TABLE disk_metrics(id INTEGER, machine TEXT, ts REAL, mount TEXT, pct REAL)')
        db.execute('INSERT INTO os_metrics VALUES(1,?,?,?,?,?)', ('EQ3300-AIAgent', 1000, 10, 20, temp))
        db.execute('INSERT INTO gpu_metrics VALUES(1,?,?,?,?,?,?,?,?,?)', ('EQ3300-AIAgent', 1000, 0, 10, 100, 10, temp, power, power_limit))
        db.execute('INSERT INTO disk_metrics VALUES(1,?,?,?,?)', ('EQ3300-AIAgent', 1000, '/', 10))
    return dbpath


NODE = dict(node_id='fb34a37e55125dadbd7b044ab0aed310', label='OS 1', os_hostname='eq3300-aiagent', os_hostname_raw='EQ3300-AIAgent')


class ThermalPowerCollection(unittest.TestCase):
    def collect(self, folder, **kw):
        src = EvidenceSource(build_telemetry(folder, **kw), Path(folder) / 'missing.db', folder)
        rows, coverage, _ = src(dict(project='p', nodes=[NODE]), DEFAULTS, 1000)
        return rows, coverage

    def test_cpu_and_gpu_temperature_and_power_are_collected(self):
        with tempfile.TemporaryDirectory() as folder:
            rows, _ = self.collect(folder)
            by_metric = {}
            for r in rows:
                by_metric.setdefault(r['metric'], []).append(r)
            self.assertEqual(by_metric['cpu_temp'][0]['value'], 30)
            self.assertEqual(by_metric['cpu_temp'][0]['kind'], 'thermal')
            self.assertEqual(by_metric['cpu_temp'][0]['rule'], 'cpu_temp.temperature.high')
            self.assertEqual(by_metric['gpu_temp'][0]['kind'], 'thermal')
            # power is a share of the card limit: 100/700 ~= 14.3%
            self.assertEqual(by_metric['gpu_power'][0]['kind'], 'power')
            self.assertAlmostEqual(by_metric['gpu_power'][0]['value'], 100 * 100 / 700, places=4)

    def test_temperature_above_100_is_kept(self):
        with tempfile.TemporaryDirectory() as folder:
            rows, _ = self.collect(folder, temp=120)
            temps = [r for r in rows if r['metric'] == 'gpu_temp']
            self.assertEqual(temps[0]['value'], 120)

    def test_disabled_temperature_check_is_skipped(self):
        with tempfile.TemporaryDirectory() as folder:
            src = EvidenceSource(build_telemetry(folder), Path(folder) / 'missing.db', folder)
            config = {**DEFAULTS, 'telemetry_checks': {**DEFAULTS['telemetry_checks'], 'cpu_temp': False, 'gpu_power': False}}
            rows, _, _ = src(dict(project='p', nodes=[NODE]), config, 1000)
            metrics = {r['metric'] for r in rows}
            self.assertNotIn('cpu_temp', metrics)
            self.assertNotIn('gpu_power', metrics)
            self.assertIn('gpu_temp', metrics)

    def test_missing_temp_columns_do_not_break_collection(self):
        with tempfile.TemporaryDirectory() as folder:
            dbpath = Path(folder) / 'telemetry.db'
            with sqlite3.connect(dbpath) as db:
                db.execute('CREATE TABLE os_metrics(id INTEGER, machine TEXT, ts REAL, cpu_used REAL, mem_used_pct REAL)')
                db.execute('CREATE TABLE gpu_metrics(id INTEGER, machine TEXT, ts REAL, gpu INTEGER, util REAL, mem_total REAL, mem_used REAL)')
                db.execute('INSERT INTO os_metrics VALUES(1,?,?,?,?)', ('EQ3300-AIAgent', 1000, 10, 20))
                db.execute('INSERT INTO gpu_metrics VALUES(1,?,?,?,?,?,?)', ('EQ3300-AIAgent', 1000, 0, 10, 100, 10))
            src = EvidenceSource(dbpath, Path(folder) / 'missing.db', folder)
            rows, coverage, _ = src(dict(project='p', nodes=[NODE]), DEFAULTS, 1000)
            self.assertEqual({r['metric'] for r in rows}, {'cpu', 'memory', 'gpu', 'vram'})
            self.assertEqual([c['state'] for c in coverage if c['source'] == 'Telemetry'], ['FRESH'])


class _Clock:
    def __init__(self, t):
        self.t = t

    def __call__(self):
        return self.t


class ThermalPowerEvaluation(unittest.TestCase):
    def test_temperature_breach_opens_warning(self):
        with tempfile.TemporaryDirectory() as folder:
            store = InspectionStore(Path(folder) / 'i.db')
            store.configure('s', {'duration_seconds': 0}, 'test', now=900)
            clock = _Clock(1000)
            evaluator = InspectionEvaluator(store, now=clock)
            obs = [dict(node_id='n', component='cpu', rule='cpu_temp.temperature.high', metric='cpu_temp',
                        value=95, kind='thermal', source='telemetry', sample_at=1000, evidence='x')]
            evaluator.evaluate('s', obs)
            issues = store.issues('s', status='ACTIVE')
            self.assertEqual(len(issues), 1)
            self.assertEqual(issues[0]['severity'], 'WARNING')
            self.assertIn('°C', issues[0]['facts'])

    def test_power_breach_opens_warning_and_below_threshold_is_quiet(self):
        with tempfile.TemporaryDirectory() as folder:
            store = InspectionStore(Path(folder) / 'i.db')
            store.configure('s', {'duration_seconds': 0}, 'test', now=900)
            clock = _Clock(1000)
            evaluator = InspectionEvaluator(store, now=clock)
            quiet = [dict(node_id='n', component='gpu:0', rule='gpu_power.power.high', metric='gpu_power',
                          value=80, kind='power', source='telemetry', sample_at=1000, evidence='x')]
            evaluator.evaluate('s', quiet)
            self.assertEqual(store.issues('s', status='ACTIVE'), [])
            clock.t = 1001
            breach = [dict(quiet[0], value=98, sample_at=1001)]
            evaluator.evaluate('s', breach)
            self.assertEqual([i['rule'] for i in store.issues('s', status='ACTIVE')], ['gpu_power.power.high'])


class KnownIssueSuppression(unittest.TestCase):
    def open_issue(self, folder):
        store = InspectionStore(Path(folder) / 'i.db')
        store.configure('s', {'duration_seconds': 0}, 'test', now=900)
        clock = _Clock(1000)
        evaluator = InspectionEvaluator(store, now=clock)
        obs = [dict(node_id='n', component='cpu', rule='cpu.utilization.high', metric='cpu',
                    value=99, kind='utilization', source='telemetry', sample_at=1000, evidence='x')]
        evaluator.evaluate('s', obs)
        return store, evaluator, clock, obs

    def test_marking_known_moves_issue_out_of_active_immediately(self):
        with tempfile.TemporaryDirectory() as folder:
            store, _, _, _ = self.open_issue(folder)
            issue = store.issues('s', status='ACTIVE')[0]
            store.handle('s', issue['id'], {'known_issue': True}, 'tester')
            self.assertEqual(store.issues('s', status='ACTIVE'), [])
            self.assertEqual([i['id'] for i in store.issues('s', status='KNOWN')], [issue['id']])
            self.assertEqual(store.summary('s')['summary'], {'fail': 0, 'warning': 0})
            self.assertEqual(store.summary('s')['lifecycle_counts']['known'], 1)

    def test_next_collection_keeps_known_issue_out_of_active(self):
        with tempfile.TemporaryDirectory() as folder:
            store, evaluator, clock, obs = self.open_issue(folder)
            issue = store.issues('s', status='ACTIVE')[0]
            store.handle('s', issue['id'], {'known_issue': True}, 'tester')
            clock.t = 1001
            evaluator.evaluate('s', [dict(obs[0], sample_at=1001)])
            self.assertEqual(store.issues('s', status='ACTIVE'), [])
            known = store.issues('s', status='KNOWN')
            self.assertEqual([i['id'] for i in known], [issue['id']])
            self.assertEqual(known[0]['last_seen_at'], 1001)

    def test_clearing_known_lets_next_collection_reactivate(self):
        with tempfile.TemporaryDirectory() as folder:
            store, evaluator, clock, obs = self.open_issue(folder)
            issue = store.issues('s', status='ACTIVE')[0]
            store.handle('s', issue['id'], {'known_issue': True}, 'tester')
            store.handle('s', issue['id'], {'known_issue': False}, 'tester')
            self.assertEqual([i['id'] for i in store.issues('s', status='ACTIVE')], [issue['id']])
            clock.t = 1002
            evaluator.evaluate('s', [dict(obs[0], sample_at=1002)])
            self.assertEqual([i['id'] for i in store.issues('s', status='ACTIVE')], [issue['id']])
            self.assertEqual(store.issues('s', status='KNOWN'), [])

    def test_known_issue_still_recovers_when_healthy(self):
        with tempfile.TemporaryDirectory() as folder:
            store, evaluator, clock, obs = self.open_issue(folder)
            issue = store.issues('s', status='ACTIVE')[0]
            store.handle('s', issue['id'], {'known_issue': True}, 'tester')
            clock.t = 1002
            healthy = [dict(obs[0], value=10, sample_at=1001), dict(obs[0], value=10, sample_at=1002)]
            evaluator.evaluate('s', healthy)
            self.assertEqual(store.issues('s', status='KNOWN'), [])
            self.assertEqual([i['id'] for i in store.issues('s', status='RECOVERED')], [issue['id']])


if __name__ == '__main__':
    unittest.main()
