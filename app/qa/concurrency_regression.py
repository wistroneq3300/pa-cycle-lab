"""Synthetic concurrency checks; no main import and no device network access."""
import copy
import threading
import time
import unittest
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace
from unittest.mock import Mock, patch

import operations_regression as operations
import probe_budget


class Concurrency(unittest.TestCase):
    def setUp(self):
        fixture = operations.Operations()
        fixture.setUp()
        self.s, self.m = fixture.s, fixture.m
        self.connection_body=fixture.connection_body

    def test_slow_probe_releases_inventory_lock_and_rejects_stale_commit(self):
        entered, release = threading.Event(), threading.Event()
        def probe(*args, **kwargs):
            entered.set()
            self.assertTrue(release.wait(3))
            return 'node',0,''
        self.s['ssh_run'] = probe
        body = self.connection_body(new_os_ip='new', os_user='manual', os_pass='explicit', os_port=22)
        with ThreadPoolExecutor(1) as pool:
            future = pool.submit(self.s['change_os_ip'], 'node', body)
            try:
                self.assertTrue(entered.wait(3))
                acquired = self.s['_DATA_LOCK'].acquire(timeout=1)
                self.assertTrue(acquired, 'network probe held inventory lock')
                if acquired:
                    try:
                        self.m['os_ip'] = 'concurrent-change'
                    finally:
                        self.s['_DATA_LOCK'].release()
            finally:
                release.set()
            with self.assertRaises(operations.ApiError) as error:
                future.result(timeout=3)
            self.assertEqual(error.exception.status_code, 409)
        self.assertEqual(self.m['os_ip'], 'concurrent-change')
        self.s['_save_data'].assert_not_called()

    def test_failed_connection_save_restores_slots_and_credentials(self):
        snapshot = copy.deepcopy(self.m)
        self.s['_save_data'].side_effect = OSError('synthetic storage failure')
        with self.assertRaises(OSError):
            self.s['_commit_connection']('node', snapshot, {'os_ip': 'new', 'os_pass': 'explicit'}, self.m['os'][1]['node_id'],self.s['node_identity'].binding(self.m['os'][1]))
        self.assertEqual(self.m, snapshot)

    def test_safe_response_uses_cache_and_never_probes(self):
        self.s['ping_check'] = Mock(side_effect=AssertionError('unexpected probe'))
        self.s['_status_cache'] = {('os', 'node'): False}
        self.s['_status_observed'] = {('os', 'node'): 123}
        result = self.s['_bmc_safe'](self.m)
        self.assertIs(result['os_alive'], False)
        self.assertEqual(result['connectivity']['os']['observed_at'], 123)
        self.s['ping_check'].assert_not_called()

    def test_force_requests_join_background_scan(self):
        entered, release = threading.Event(), threading.Event()
        def refresh(force=False):
            entered.set()
            self.assertTrue(release.wait(3))
        scope = dict(threading=threading, time=time, _STATUS_TIME=0, _STATUS_TTL=30,
                     _STATUS_LOCK=threading.Lock(), _refresh_status=Mock(side_effect=refresh))
        operations.extract('main.py', ['_kick_status_scan'], scope)
        scope['_kick_status_scan']()
        self.assertTrue(entered.wait(3))
        with ThreadPoolExecutor(4) as pool:
            calls = [pool.submit(scope['_kick_status_scan'], True) for _ in range(4)]
            time.sleep(.1)
            self.assertTrue(all(not call.done() for call in calls))
            release.set()
            for call in calls:
                call.result(timeout=3)
        self.assertEqual(scope['_refresh_status'].call_count, 1)

    def test_ping_budget_shared_across_concurrent_callers(self):
        active = peak = 0
        lock = threading.Lock()
        def run(*args, **kwargs):
            nonlocal active, peak
            with lock:
                active += 1
                peak = max(peak, active)
            time.sleep(.01)
            with lock:
                active -= 1
            return SimpleNamespace(returncode=0)
        scope = {'subprocess': SimpleNamespace(run=run)}
        operations.extract('main.py', ['ping_check'], scope)
        with patch.object(probe_budget, 'ping_slot', threading.BoundedSemaphore(3)):
            with ThreadPoolExecutor(24) as pool:
                self.assertTrue(all(pool.map(scope['ping_check'], ['synthetic'] * 48)))
        self.assertEqual(peak, 3)


if __name__ == '__main__':
    unittest.main()
