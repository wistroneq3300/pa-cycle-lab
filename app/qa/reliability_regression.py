from test_support import WorkspaceTemporaryDirectory
"""Isolated real-function regressions; temporary storage, no service or hardware."""
import ast
import copy
import datetime
import json
import os
from pathlib import Path
import sys
import tempfile
import threading
import time
import unittest
from functools import wraps
from types import SimpleNamespace
from unittest.mock import patch
from concurrent.futures import ThreadPoolExecutor

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import network_identity as net


class ApiError(Exception):
    def __init__(self, status_code, detail):
        self.status_code, self.detail = status_code, detail


def extract(file, names, scope):
    import node_identity
    scope.setdefault("node_identity",node_identity)
    tree = ast.parse((ROOT / file).read_text(encoding='utf-8-sig'))
    if file == 'main.py':
        scope.setdefault('os', os)
        names = [*names, *(n for n in ('_machine_allowed', '_project_allowed', '_machine_candidate') if n not in names)]
        if '_invalidate_machine_cache' not in names and '_invalidate_machine_cache' not in scope:
            names = [*names, '_invalidate_machine_cache']
    nodes = []
    for n in tree.body:
        if isinstance(n, ast.FunctionDef) and n.name in names:
            n.decorator_list = [d for d in n.decorator_list if isinstance(d, ast.Name)
                                and d.id == '_data_transaction']
            nodes.append(n)
    exec(compile(ast.Module(body=nodes, type_ignores=[]), file, 'exec'), scope)


class Reliability(unittest.TestCase):
    def setUp(self):
        self.tmp = WorkspaceTemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.s = dict(copy=copy, tempfile=tempfile, wraps=wraps, os=os, json=json,
                      datetime=datetime, HTTPException=ApiError, _DATA_LOCK=threading.RLock(),
                      machines={}, projects={'rack': {'name': 'rack'}}, links=[], _seq=1,
                      DATA_FILE=str(Path(self.tmp.name) / 'data.json'),
                      AddRackPassive=SimpleNamespace, AddProject=SimpleNamespace,
                      _bmc_safe=lambda m: dict(m), _is_masked=lambda s: False,
                      telemetry_core=SimpleNamespace(kind_of=lambda m, n='':
                          m.get('mgx_type') or ('cdu' if (n or m.get('name','')).lower().startswith('cdu') else 'server')))
        extract('main.py', ['_data_transaction', '_save_data', '_rack_integer',
                '_validate_rack', 'edit_machine', 'place_machine', 'set_cdu_installation', 'add_rack_passive', 'add_project'], self.s)
        self.s['_save_data']()

    def machine(self, name='node', **kw):
        m = dict(name=name, level='rack', project='rack', rack_u=0, rack_size=1, rack_side='front')
        m.update(kw)
        self.s['machines'][name] = m

    def test_disk_failure_rolls_back_memory_and_preserves_file(self):
        self.machine()
        self.s['_save_data']()
        before = Path(self.s['DATA_FILE']).read_bytes()
        with patch.object(os, 'replace', side_effect=PermissionError('simulated')):
            with self.assertRaises(ApiError) as err:
                self.s['edit_machine']('node', {'rack_u': 5})
        self.assertEqual(err.exception.status_code, 503)
        self.assertEqual(self.s['machines']['node']['rack_u'], 0)
        self.assertEqual(Path(self.s['DATA_FILE']).read_bytes(), before)
        self.assertEqual(list(Path(self.tmp.name).glob('*.tmp')), [])

    def test_create_and_fsync_failures(self):
        for target, method in ((tempfile, 'NamedTemporaryFile'), (os, 'fsync')):
            with patch.object(target, method, side_effect=OSError('simulated')):
                with self.assertRaises(ApiError):
                    self.s['add_project'](SimpleNamespace(name='new', desc=''))
            self.assertNotIn('new', self.s['projects'])
        self.assertEqual(list(Path(self.tmp.name).glob('*.tmp')), [])

    def test_invalid_patch_is_all_or_nothing(self):
        self.machine(rack_u=10)
        self.s['projects']['other'] = {}
        for body in ({'rack_u': 2, 'rack_size': 4, 'project': 'other'},
                     {'rack_u': -1}, {'rack_u': 49}, {'rack_size': 0},
                     {'rack_size': 49}, {'rack_u': 1.5}, {'rack_u': True},
                     {'rack_u': '2'}, {'rack_side': 'both'}):
            before = copy.deepcopy(self.s['machines'])
            with self.assertRaises(ApiError):
                self.s['edit_machine']('node', body)
            self.assertEqual(self.s['machines'], before)

    def test_full_height_and_unplacement(self):
        self.machine(rack_size=48)
        self.s['edit_machine']('node', {'rack_u': 48})
        self.s['edit_machine']('node', {'rack_u': 0})
        self.assertEqual(self.s['machines']['node']['rack_u'], 0)

    def test_overlap_cross_face_and_adjacency(self):
        self.machine('a', rack_u=8, rack_size=4)
        self.machine('b', rack_size=4)
        with self.assertRaises(ApiError):
            self.s['edit_machine']('b', {'rack_u': 5, 'rack_side': 'rear'})
        self.s['edit_machine']('b', {'rack_u': 4, 'rack_size': 4})
        self.s['edit_machine']('a', {'rack_u': 8})

    def test_passive_creation_rollback(self):
        self.machine('a', rack_u=8, rack_size=4)
        body = SimpleNamespace(name='b', mgx_type='pdu', project='rack',
                               rack_u=5, rack_size=1, rack_side='rear', manage_ip='')
        with self.assertRaises(ApiError):
            self.s['add_rack_passive'](body)
        self.assertNotIn('b', self.s['machines'])
        self.assertEqual(self.s['_seq'], 1)

    def test_concurrent_placement_only_one_commits(self):
        self.machine('a')
        self.machine('b')
        def place(name):
            try:
                self.s['edit_machine'](name, {'rack_u': 8})
                return True
            except ApiError:
                return False
        with ThreadPoolExecutor(2) as ex:
            self.assertEqual(sum(ex.map(place, ['a', 'b'])), 1)
        disk = json.loads(Path(self.s['DATA_FILE']).read_text())
        self.assertEqual(disk['machines'], self.s['machines'])

    def test_every_inventory_writer_is_transactional(self):
        tree = ast.parse((ROOT / 'main.py').read_text(encoding='utf-8'))
        for n in tree.body:
            # The optimistic connection commit has its own locked rollback contract,
            # exercised with concurrent probes and failed saves in concurrency_regression.
            if isinstance(n, ast.FunctionDef) and n.name not in ('_save_data', '_commit_connection') and any(
                isinstance(x, ast.Call) and isinstance(x.func, ast.Name) and x.func.id == '_save_data'
                for x in ast.walk(n)):
                self.assertIn('_data_transaction', [d.id for d in n.decorator_list if isinstance(d, ast.Name)])

    def test_telemetry_equal_device_weight_and_missing_minutes(self):
        rows = []
        for metric in ('power_w', 'temp'):
            rows.extend(dict(ts=120+i*15, machine='a', kind='pdu', metric=metric, value=100)
                        for i in range(4))
            rows.append(dict(ts=120, machine='b', kind='pdu', metric=metric, value=200))
            rows.append(dict(ts=240, machine='a', kind='pdu', metric=metric, value=50))
        class Conn:
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def execute(self, *args): return self
            def fetchall(self): return rows
        scope = dict(time=time, os=os, _conn=Conn, RACK_METRIC_DEF={}, kind_of=lambda m,n='':'pdu',
                     _load_machines=lambda:{n:dict(project='rack', level='rack', rack_u=i+1) for i,n in enumerate(('a','b'))})
        extract('telemetry_core.py', ['is_rack_member', 'get_rack_series'], scope)
        h = scope['get_rack_series']('rack', 60)['pdu']['history']
        self.assertEqual(h['power_w']['values'], [300, 50])
        self.assertEqual(h['temp']['values'], [150, 50])
        self.assertEqual(h['power_w']['ts'], [120, 240])
        self.assertEqual(h['power_w']['contributors'], [2, 1])


class NetworkIdentity(unittest.TestCase):
    def test_bmc_ssh_fallback_uses_device_port(self):
        calls = []
        def ssh(*args, **kwargs):
            calls.append(args)
            return ('---CHANNEL 2---\nIP Address : 192.0.2.22\n'
                    'MAC Address : 02:aa:bb:cc:dd:ee\n', 0, '')
        result = net.collect(dict(bmc_ip='192.0.2.22', bmc_user='test',
                                  bmc_pass='test-only', bmc_port=623), ssh)
        self.assertEqual(calls[0][3], 22)
        self.assertEqual(result['bmc']['channel'], 2)
        self.assertIsNone(result['os'])

    def test_no_credentials_means_unknown_without_network(self):
        self.assertEqual(net.collect({}, lambda *a, **k:self.fail('unexpected SSH')),
                         {'os': None, 'bmc': None})

    def test_exact_interface_and_ambiguity(self):
        text = ('2: eth0: <UP>\n    link/ether 02:11:22:33:44:55\n    inet 192.0.2.10/24\n'
                '3: eth1: <UP>\n    link/ether 02:aa:bb:cc:dd:ee\n    inet 192.0.2.11/24\n')
        self.assertEqual(net.os_mac(text, '192.0.2.11')['mac'], '02:aa:bb:cc:dd:ee')
        self.assertIsNone(net.os_mac(text, '192.0.2.1'))
        self.assertIsNone(net.os_mac(text+text, '192.0.2.11'))

    def test_channel_and_ip_must_match(self):
        text = ('---CHANNEL 1---\nIP Address Source : DHCP Address\nIP Address : 192.0.2.21\n'
                'MAC Address : 02:11:22:33:44:55\n---CHANNEL 8---\n'
                'IP Address : 192.0.2.22\nMAC Address : 02:aa:bb:cc:dd:ee\n')
        self.assertEqual(net.bmc_mac(text, '192.0.2.22')['channel'], 8)
        self.assertIsNone(net.bmc_mac(text, '192.0.2.2'))
        self.assertIsNone(net.bmc_mac(text+text, '192.0.2.22'))


if __name__ == '__main__':
    unittest.main(verbosity=2)
