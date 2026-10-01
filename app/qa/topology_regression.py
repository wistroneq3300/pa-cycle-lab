"""Topology isolation, persistence, validation and concurrent edit regressions."""
import copy
import datetime
import ipaddress
import json
import time
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
import reliability_regression as base
import topology_policy


class TopologyRegression(base.unittest.TestCase):
    setUp = base.Reliability.setUp

    def handlers(self):
        self.s['topology_policy'] = topology_policy
        self.s.update(ipaddress=ipaddress, time=time, datetime=datetime,
                      ThreadPoolExecutor=base.ThreadPoolExecutor,
                      _TOPOLOGY_PING_FIELDS=('host_os', 'host_bmc', 'dpu_os', 'dpu_bmc'))
        base.extract('main.py', ['get_project_topology', 'put_project_topology', 'ping_project_topology',
                    '_topology_ping_targets', 'edit_project', '_load_data'], self.s)

    def doc(self):
        node = dict(id='n1', name='Node 1', bf4='BF4 #1', host_os='192.0.2.1',
                    host_bmc='', dpu_os='2001:db8::1', dpu_bmc='')
        a = dict(id='server', name='Server', kind='server', inventory='node', nodes=[node],
                 ports=[dict(id='host', name='RJ45 #1', role='host', nodes=['n1'])])
        b = dict(id='switch', name='Switch', kind='switch', inventory='', nodes=[],
                 ports=[dict(id='p1', name='1', role='other', nodes=[])])
        link = dict(id='l1', a=dict(device='server', port='host'), b=dict(device='switch', port='p1'),
                    network='host', state='planned', note='VLAN 10')
        return dict(revision=0, racks=[dict(id='rack1', name='Rack 1', devices=[a, b], links=[link])])

    def test_persist_reload_and_project_isolation(self):
        self.handlers()
        self.s['projects']['other'] = {'name': 'other'}
        before = copy.deepcopy(self.s['machines'])
        result = self.s['put_project_topology']('rack', self.doc())
        self.assertEqual(result['revision'], 1)
        self.assertEqual(self.s['machines'], before)
        self.assertEqual(self.s['get_project_topology']('other'), dict(revision=0, racks=[]))
        self.s['_load_data']()
        self.assertEqual(self.s['get_project_topology']('rack'), result)
        result['racks'].clear()
        self.assertEqual(len(self.s['get_project_topology']('rack')['racks']), 1)

    def test_stale_revision_and_missing_project(self):
        self.handlers()
        self.s['put_project_topology']('rack', self.doc())
        for name, doc, status in [('rack', self.doc(), 409), ('missing', self.doc(), 404)]:
            with self.assertRaises(base.ApiError) as err:
                self.s['put_project_topology'](name, doc)
            self.assertEqual(err.exception.status_code, status)

    def test_malformed_documents_and_port_reuse_are_atomic(self):
        self.handlers()
        variants = []
        for mutate in [
            lambda r: r['links'][0]['b'].update(port='missing'),
            lambda r: r['devices'][0]['ports'][0].update(nodes=['missing']),
            lambda r: r['devices'][0]['nodes'][0].update(host_os='bad IP'),
            lambda r: r['links'].append({**r['links'][0], 'id': 'l2'}),
            lambda r: r['links'][0].update(state='online'),
            lambda r: r['devices'].append(copy.deepcopy(r['devices'][0])),
            lambda r: r['devices'][0].update(ports=None),
            lambda r: r['devices'][0]['ports'][0].update(nodes=[{}]),
        ]:
            doc = self.doc(); mutate(doc['racks'][0]); variants.append(doc)
        before = Path(self.s['DATA_FILE']).read_bytes()
        for doc in variants:
            with self.assertRaises(base.ApiError) as err:
                self.s['put_project_topology']('rack', doc)
            self.assertEqual(err.exception.status_code, 422)
            self.assertNotIn('topology', self.s['projects']['rack'])
            self.assertEqual(Path(self.s['DATA_FILE']).read_bytes(), before)

    def test_disk_failure_rolls_back(self):
        self.handlers()
        before = Path(self.s['DATA_FILE']).read_bytes()
        with patch.object(base.os, 'replace', side_effect=OSError('disk full')):
            with self.assertRaises(base.ApiError):
                self.s['put_project_topology']('rack', self.doc())
        self.assertNotIn('topology', self.s['projects']['rack'])
        self.assertEqual(Path(self.s['DATA_FILE']).read_bytes(), before)

    def test_concurrent_writers_only_one_commits(self):
        self.handlers()
        def write(_):
            try:
                return self.s['put_project_topology']('rack', self.doc())['revision']
            except base.ApiError as exc:
                return exc.status_code
        with base.ThreadPoolExecutor(max_workers=2) as pool:
            self.assertEqual(sorted(pool.map(write, range(2))), [1, 409])

    def test_project_rename_preserves_topology_and_unknown_fields(self):
        self.handlers()
        saved = self.s['put_project_topology']('rack', self.doc())
        self.s['projects']['rack']['level'] = 'rack'
        self.s['edit_project']('rack', SimpleNamespace(name='renamed', desc='new'))
        self.assertEqual(self.s['get_project_topology']('renamed'), saved)
        self.assertEqual(self.s['projects']['renamed']['level'], 'rack')

    def test_multiple_racks_and_credentials_are_not_stored(self):
        self.handlers()
        doc = self.doc()
        second = copy.deepcopy(doc['racks'][0]); second['id'] = 'rack2'; doc['racks'].append(second)
        doc['racks'][0]['devices'][0]['password'] = 'secret'
        result = self.s['put_project_topology']('rack', doc)
        self.assertNotIn('secret', json.dumps(result))
        self.assertEqual(len(result['racks']), 2)

    def test_power_and_cooling_management_network_roles_are_valid(self):
        self.handlers()
        doc = self.doc(); rack = doc['racks'][0]
        rack['links'] = []
        switch = rack['devices'][1]
        switch['ports'] = [
            dict(id='power-port', name='33', role='power', nodes=[]),
            dict(id='cooling-port', name='36', role='cooling', nodes=[]),
        ]
        for role in ('power', 'cooling'):
            device = dict(id=role, name=role.title(), kind='other', inventory=role,
                          nodes=[], ports=[dict(id='management', name='Management',
                                               role=role, nodes=[])])
            rack['devices'].append(device)
            rack['links'].append(dict(id='link-' + role,
                a=dict(device=role, port='management'),
                b=dict(device='switch', port=role + '-port'),
                network=role, state='confirmed', note=''))
        result = self.s['put_project_topology']('rack', doc)
        saved = result['racks'][0]
        self.assertEqual([link['network'] for link in saved['links']], ['power', 'cooling'])
        self.assertEqual([port['role'] for port in saved['devices'][1]['ports']],
                         ['power', 'cooling'])

    def test_ping_deduplicates_ips_retries_failures_and_does_not_persist_results(self):
        self.handlers()
        doc = self.doc()
        server = doc['racks'][0]['devices'][0]
        server['nodes'].append(dict(id='n2', name='Node 2', bf4='BF4 #2',
                                   host_os='192.0.2.2', host_bmc='192.0.2.1',
                                   dpu_os='2001:db8::2', dpu_bmc=''))
        server['ports'][0]['nodes'].append('n2')
        switch = doc['racks'][0]['devices'][1]
        switch['inventory'] = 'switch-1'
        self.s['machines']['switch-1'] = dict(name='switch-1', project='rack',
                                               mgx_type='switch', os_ip='192.0.2.3')
        saved = self.s['put_project_topology']('rack', doc)
        calls = []
        self.s['ping_check'] = lambda ip, timeout: calls.append((ip, timeout)) or ip == '192.0.2.1'
        result = self.s['ping_project_topology']('rack', {'rack_id': 'rack1'})
        self.assertEqual(result['summary'], {'configured': 3, 'unique_ips': 3, 'alive': 1, 'down': 2})
        self.assertEqual(calls.count(('192.0.2.1', 1)), 1)
        self.assertEqual(calls.count(('192.0.2.2', 1)), 2)
        self.assertEqual(calls.count(('192.0.2.3', 1)), 2)
        self.assertFalse(any('2001:db8' in ip for ip, _ in calls))
        self.assertEqual(result['targets'][-1]['field'], 'primary_ip')
        self.assertEqual(self.s['get_project_topology']('rack'), saved)

    def test_ping_supports_512_targets_and_rejects_unknown_rack(self):
        self.handlers()
        doc = self.doc(); rack = doc['racks'][0]; rack['links'] = []
        rack['devices'] = []
        for group in range(8):
            nodes = [dict(id=f'n{group}-{i}', name=f'Node {group}-{i}', bf4='',
                host_os=f'10.{group}.{i // 254}.{i % 254 + 1}', host_bmc='', dpu_os='', dpu_bmc='')
                for i in range(64)]
            rack['devices'].append(dict(id=f'server-{group}', name=f'Server {group}', kind='server',
                inventory='', nodes=nodes, ports=[dict(id='host', name='RJ45', role='host',
                nodes=[node['id'] for node in nodes])]))
        self.s['put_project_topology']('rack', doc)
        self.s['ping_check'] = lambda ip, timeout: True
        result = self.s['ping_project_topology']('rack', {'rack_id': 'rack1'})
        self.assertEqual(result['summary']['configured'], 512)
        self.assertEqual(result['summary']['alive'], 512)
        with self.assertRaises(base.ApiError) as err:
            self.s['ping_project_topology']('rack', {'rack_id': 'missing'})
        self.assertEqual(err.exception.status_code, 404)

    def test_ping_uses_inventory_os_slots_when_saved_node_ips_are_empty(self):
        self.handlers()
        doc = self.doc(); node = doc['racks'][0]['devices'][0]['nodes'][0]
        node.update(host_os='', host_bmc='', dpu_os='', dpu_bmc='')
        self.s['machines']['node'] = dict(name='node', project='rack', mgx_type='server',
            os_ip='192.0.2.99', os=[{'slot': 1, 'ip': '192.0.2.11'},
                                    {'slot': 2, 'ip': '192.0.2.12'}])
        self.s['put_project_topology']('rack', doc)
        self.s['ping_check'] = lambda ip, timeout: ip.endswith('.11')
        result = self.s['ping_project_topology']('rack', {'rack_id': 'rack1'})
        self.assertEqual(result['summary'],
                         {'configured': 2, 'unique_ips': 2, 'alive': 1, 'down': 1})
        self.assertEqual([target['node_name'] for target in result['targets']],
                         ['OS Slot 1', 'OS Slot 2'])
        self.assertEqual(result['targets'][0]['node_id'], node['id'])
        self.assertEqual({target['field'] for target in result['targets']}, {'host_os'})

    def test_ping_merges_saved_host_os_with_missing_inventory_slots(self):
        self.handlers()
        doc = self.doc(); server = doc['racks'][0]['devices'][0]
        server['nodes'].append(dict(id='n2', name='Node 2', bf4='BF4 #2',
                                   host_os='', host_bmc='', dpu_os='', dpu_bmc=''))
        server['ports'][0]['nodes'].append('n2')
        self.s['machines']['node'] = dict(name='node', project='rack', mgx_type='server',
            os_ip='192.0.2.99', os=[{'slot': 1, 'ip': '192.0.2.11'},
                                    {'slot': 2, 'ip': '192.0.2.12'}])
        self.s['put_project_topology']('rack', doc)
        self.s['ping_check'] = lambda ip, timeout: True
        result = self.s['ping_project_topology']('rack', {'rack_id': 'rack1'})
        self.assertEqual([target['ip'] for target in result['targets']],
                         ['192.0.2.1', '192.0.2.12'])
        self.assertEqual([target['node_id'] for target in result['targets']], ['n1', 'n2'])
