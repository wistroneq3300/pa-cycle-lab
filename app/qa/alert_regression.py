"""Real alert functions, in-memory SQLite, no workers or external LLM calls."""
import sqlite3
import time
import unittest
import threading
from pathlib import Path
from test_support import WorkspaceTemporaryDirectory
from contextlib import contextmanager
from unittest.mock import Mock
from operations_regression import extract


class Alerts(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.db.row_factory = sqlite3.Row
        self.addCleanup(self.db.close)
        self.queue = Mock(side_effect=lambda *args: self.assertFalse(self.db.in_transaction))
        self.scope = dict(_conn=lambda: self.db, time=time, GPU_ALERT_WINDOW=2,
                          GPU_TEMP_ALERT=88, GPU_UTIL_ALERT=50, _queue_gpu_alert_advice=self.queue)
        extract('telemetry_core.py', ['init_db', 'evaluate_gpu_alerts', 'get_active_gpu_alerts', '_enrich_gpu_alert'], self.scope)
        self.scope['init_db']()

    def metrics(self, temperature=95, util=0, age=0, gpu=0):
        self.db.execute('INSERT INTO gpu_metrics(ts,machine,gpu,temp,util) VALUES(?,?,?,?,?)',
                        (time.time()-age, 'node', gpu, temperature, util))
        self.db.commit()

    def evaluate(self):
        self.scope['evaluate_gpu_alerts']('node')
        return self.scope['get_active_gpu_alerts']()

    def test_persistent_overheat_preserves_alert_identity_and_creation_time(self):
        self.metrics()
        first = self.evaluate()[0]
        self.db.execute('UPDATE gpu_alerts SET ts=ts-600, created_at=created_at-600, last_seen_at=last_seen_at-600')
        self.db.commit()
        again = self.evaluate()
        self.assertEqual(len(again), 1)
        self.assertFalse(again[0]['stale'])
        self.assertAlmostEqual(again[0]['created_at'], first['created_at']-600)
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM gpu_alerts').fetchone()[0], 1)
        self.assertEqual(self.queue.call_count, 1)

    def test_missing_telemetry_remains_active_and_stale_until_observed_recovery(self):
        self.metrics()
        self.evaluate()
        self.db.execute('DELETE FROM gpu_metrics')
        self.db.execute('UPDATE gpu_alerts SET last_seen_at=last_seen_at-600')
        self.db.commit()
        self.assertTrue(self.evaluate()[0]['stale'])
        self.metrics(temperature=30)
        self.assertEqual(self.evaluate(), [])
        row = self.db.execute('SELECT * FROM gpu_alerts').fetchone()
        self.assertEqual(row['status'], 'clear')
        self.assertIsNotNone(row['resolved_at'])

    def test_temperature_without_utilization_still_alerts(self):
        self.metrics(util=None)
        self.assertEqual(self.evaluate()[0]['kind'], 'high_temp')

    def test_multiple_alerts_commit_before_queue_and_llm(self):
        self.metrics(util=90)
        self.metrics(util=90, gpu=1)
        self.assertEqual(len(self.evaluate()), 3)
        self.assertEqual(self.queue.call_count, 3)
        def llm(*args):
            self.assertFalse(self.db.in_transaction)
            self.metrics(temperature=30, gpu=2)
            return 'synthetic advice'
        self.scope['_alert_llm'] = llm
        for call in self.queue.call_args_list:
            self.scope['_enrich_gpu_alert'](*call.args)
        self.assertTrue(all(r['text']=='synthetic advice' for r in self.scope['get_active_gpu_alerts']()))

    def test_delayed_advice_does_not_reopen_resolved_alert(self):
        self.metrics()
        self.evaluate()
        args = self.queue.call_args.args
        self.db.execute('DELETE FROM gpu_metrics')
        self.db.commit()
        self.metrics(temperature=30)
        self.evaluate()
        self.scope['_alert_llm'] = Mock(return_value='late advice')
        self.scope['_enrich_gpu_alert'](*args)
        self.assertEqual(self.scope['get_active_gpu_alerts'](), [])

    def test_migration_is_idempotent_for_existing_alerts(self):
        self.db.execute('DROP TABLE gpu_alerts')
        self.db.execute('CREATE TABLE gpu_alerts(id INTEGER PRIMARY KEY, ts REAL, machine TEXT, gpu INTEGER, kind TEXT, status TEXT, value REAL, threshold REAL, text TEXT)')
        self.db.execute("INSERT INTO gpu_alerts VALUES(1,100,'node',0,'high_temp','active',95,88,'original')")
        self.db.commit()
        self.scope['init_db']()
        self.scope['init_db']()
        row = self.db.execute('SELECT * FROM gpu_alerts').fetchone()
        self.assertEqual((row['created_at'],row['last_seen_at'],row['text']), (100,100,'original'))

    def test_slow_llm_does_not_hold_database_write_lock(self):
        with WorkspaceTemporaryDirectory() as directory:
            database = str(Path(directory) / 'alerts.db')
            @contextmanager
            def connect():
                conn = sqlite3.connect(database, timeout=0.2)
                conn.row_factory = sqlite3.Row
                try:
                    with conn:
                        yield conn
                finally:
                    conn.close()
            self.scope['_conn'] = connect
            self.scope['init_db']()
            with connect() as conn:
                conn.execute("INSERT INTO gpu_alerts(id,status,text) VALUES(1,'active','fallback')")
            started, release = threading.Event(), threading.Event()
            failures = []
            def llm(*args):
                started.set()
                if not release.wait(3):
                    raise TimeoutError('test deadline')
                return 'advice'
            self.scope['_alert_llm'] = llm
            def enrich():
                try:
                    self.scope['_enrich_gpu_alert'](1,'node',0,'high_temp',95,88)
                except Exception as exc:
                    failures.append(exc)
            thread = threading.Thread(target=enrich)
            thread.start()
            try:
                self.assertTrue(started.wait(2))
                with connect() as writer:
                    writer.execute("INSERT INTO gpu_metrics(machine,ts,temp) VALUES('other',1,30)")
            finally:
                release.set()
                thread.join(3)
            self.assertFalse(thread.is_alive())
            self.assertEqual(failures, [])


if __name__ == '__main__':
    unittest.main()
