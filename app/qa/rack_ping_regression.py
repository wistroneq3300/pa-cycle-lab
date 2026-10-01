"""Rack reachability aggregation with synthetic targets; no live ICMP or storage."""
import copy
import datetime
import ipaddress
import time
from collections import Counter
from pathlib import Path

import reliability_regression as base
import equipment_policy


class RackPingRegression(base.unittest.TestCase):
    setUp = base.Reliability.setUp

    def handlers(self):
        self.s.update(equipment_policy=equipment_policy, ipaddress=ipaddress,
                      datetime=datetime, time=time, ThreadPoolExecutor=base.ThreadPoolExecutor)
        self.calls = []
        self.failed = set()
        self.s['ping_check'] = self.probe
        base.extract('main.py', ['_rack_ping_ip', '_rack_ping_plan', 'rack_ping'], self.s)

    def probe(self, ip, timeout):
        self.calls.append((ip, timeout))
        return ip not in self.failed

    def machine(self, name='server-1', **fields):
        machine = dict(name=name, mgx_type='server', level='rack', project='rack',
                       rack_u=1, rack_size=1, os_ip='', bmc_ip='')
        machine.update(fields)
        self.s['machines'][name] = machine
        return machine

    def topology(self, name='server-1', ips=None, project='rack'):
        nodes = [dict(id=f'n{i}', name=f'Node {i + 1}', host_os=ip,
                      host_bmc=f'198.51.100.{i + 1}', dpu_os=f'203.0.113.{i + 1}',
                      dpu_bmc='') for i, ip in enumerate(ips or [])]
        document = self.s['projects'].setdefault(project, {}).setdefault('topology',
            {'racks': [{'id': 'rack1', 'devices': []}]})
        document['racks'][0]['devices'].append(dict(id=name, inventory=name, nodes=nodes))
        return nodes

    def result(self, **kwargs):
        return {node['name']: node for node in self.s['rack_ping'](**kwargs)['nodes']}

    def test_four_host_nodes_aggregate_without_bmc_or_dpu_masking_failure(self):
        self.handlers()
        self.machine(os_ip='192.0.2.99', bmc_ip='192.0.2.100', os_pass='do-not-return')
        self.topology(ips=['192.0.2.1', '192.0.2.2', '192.0.2.3', '192.0.2.4'])
        self.failed.add('192.0.2.4')
        before = copy.deepcopy((self.s['machines'], self.s['projects']))
        disk = Path(self.s['DATA_FILE']).read_bytes()
        node = self.result(project='rack')['server-1']
        self.assertEqual(node['rack_ping_state'], 'partial')
        self.assertEqual(node['rack_ping_source'], 'topology_host_os')
        self.assertEqual(node['ping_counts'], {'configured': 4, 'alive': 3, 'down': 1})
        self.assertIsNone(node['os_alive'])
        self.assertIsNone(node['bmc_alive'])
        self.assertEqual(Counter(ip for ip, _ in self.calls)['192.0.2.4'], 2)
        self.assertFalse(any(ip.startswith(('198.51.100.', '203.0.113.')) for ip, _ in self.calls))
        self.assertNotIn('os_pass', node)
        self.assertEqual((self.s['machines'], self.s['projects']), before)
        self.assertEqual(Path(self.s['DATA_FILE']).read_bytes(), disk)

    def test_failed_os_stays_down_without_extra_bmc_probe_and_missing_os_stays_unknown(self):
        self.handlers()
        self.machine('failed-os', os_ip='192.0.2.1', bmc_ip='192.0.2.2')
        self.machine('bmc-only', bmc_ip='192.0.2.2')
        self.failed.add('192.0.2.1')
        results = self.result(project='rack')
        self.assertEqual(results['failed-os']['rack_ping_state'], 'down')
        self.assertFalse(results['failed-os']['os_alive'])
        self.assertIsNone(results['failed-os']['bmc_alive'])
        self.assertEqual(results['bmc-only']['rack_ping_state'], 'unknown')
        self.assertEqual(results['bmc-only']['ping_counts']['configured'], 0)
        self.assertIsNone(results['bmc-only']['bmc_alive'])
        self.assertEqual(Counter(ip for ip, _ in self.calls), {'192.0.2.1': 2})

    def test_inventory_os_slots_are_used_before_legacy_primary_os(self):
        self.handlers()
        self.machine(os_ip='192.0.2.99', os=[
            {'slot': 1, 'ip': '192.0.2.1'},
            {'slot': 2, 'ip': '192.0.2.2'},
        ])
        self.failed.add('192.0.2.2')
        node = self.result(project='rack')['server-1']
        self.assertEqual(node['rack_ping_source'], 'inventory_os_slots')
        self.assertEqual(node['rack_ping_state'], 'partial')
        self.assertEqual(node['ping_counts'], {'configured': 2, 'alive': 1, 'down': 1})
        self.assertEqual([target['node_name'] for target in node['ping_targets']],
                         ['OS Slot 1', 'OS Slot 2'])
        self.assertNotIn(('192.0.2.99', 1), self.calls)

    def test_topology_values_override_same_slot_and_inventory_fills_missing_slots(self):
        self.handlers()
        self.machine(os_ip='192.0.2.99', os=[
            {'slot': 1, 'ip': '192.0.2.1'},
            {'slot': 2, 'ip': '192.0.2.2'},
        ])
        self.topology(ips=['192.0.2.10', ''])
        node = self.result(project='rack')['server-1']
        self.assertEqual(node['rack_ping_source'], 'topology_host_os+inventory_os_slots')
        self.assertEqual([target['ip'] for target in node['ping_targets']],
                         ['192.0.2.10', '192.0.2.2'])
        self.assertNotIn(('192.0.2.1', 1), self.calls)
        self.assertNotIn(('192.0.2.99', 1), self.calls)

    def test_powered_equipment_uses_management_ip_and_excludes_blank_l10_and_unplaced(self):
        self.handlers()
        self.machine('switch', mgx_type='switch', os_ip='192.0.2.1', bmc_ip='192.0.2.2')
        self.machine('power', mgx_type='powershelf', bmc_ip='192.0.2.3')
        self.machine('cdu', mgx_type='cdu', rack_mount='external', rack_u=0, os_ip='192.0.2.4')
        self.machine('unconfigured', mgx_type='pdu')
        self.machine('blank', mgx_type='blanking', os_ip='not-an-ip')
        self.machine('l10', level='system', os_ip='192.0.2.5')
        self.machine('unplaced', rack_u=0, os_ip='192.0.2.6')
        self.machine('other', project='other', os_ip='192.0.2.7')
        self.failed.add('192.0.2.1')
        results = self.result(project='rack')
        self.assertEqual(set(results), {'switch', 'power', 'cdu', 'unconfigured'})
        self.assertEqual(results['switch']['rack_ping_state'], 'down')
        self.assertEqual(results['power']['rack_ping_state'], 'up')
        self.assertEqual(results['cdu']['rack_ping_state'], 'up')
        self.assertEqual(results['power']['ping_targets'][0]['field'], 'bmc_ip')
        self.assertEqual(results['unconfigured']['rack_ping_state'], 'unknown')
        self.assertEqual({ip for ip, _ in self.calls}, {'192.0.2.1', '192.0.2.3', '192.0.2.4'})
        self.assertEqual(self.result(name='blank'), {})

    def test_empty_topology_host_ips_fall_back_to_legacy_os_without_matching_display_name(self):
        self.handlers()
        self.machine(os_ip='192.0.2.1')
        self.topology(ips=['', ''])
        self.topology(name='unrelated', ips=['192.0.2.2'])
        self.s['projects']['rack']['topology']['racks'][0]['devices'][1]['name'] = 'server-1'
        result = self.result(project='rack')['server-1']
        self.assertEqual(result['rack_ping_source'], 'legacy_os')
        self.assertEqual(result['rack_ping_state'], 'up')
        self.assertEqual(self.calls, [('192.0.2.1', 1)])

    def test_invalid_address_or_unknown_machine_does_not_start_any_probe(self):
        self.handlers()
        self.machine(os_ip='192.0.2.1')
        self.topology(ips=['--version'])
        for request, code in (({'project': 'rack'}, 422), ({'name': 'missing'}, 404)):
            with self.assertRaises(base.ApiError) as error:
                self.s['rack_ping'](**request)
            self.assertEqual(error.exception.status_code, code)
        self.assertEqual(self.calls, [])

    def test_legacy_null_topology_falls_back_without_crashing_rack_ping(self):
        self.handlers()
        self.machine(os_ip='192.0.2.1')
        for topology in (None, {'racks': None}, {'racks': [None, {'devices': None}]},
                         {'racks': [{'devices': [{'inventory': 'server-1', 'nodes': None}]}]}):
            with self.subTest(topology=topology):
                self.s['projects']['rack']['topology'] = topology
                result = self.result(project='rack')['server-1']
                self.assertEqual(result['rack_ping_source'], 'legacy_os')
                self.assertEqual(result['rack_ping_state'], 'up')
                self.assertEqual(result['ping_counts']['configured'], 1)

    def test_more_than_512_targets_deduplicate_across_four_node_servers_and_equipment(self):
        self.handlers()
        for index in range(128):
            name = f'server-{index}'
            ips = [f'10.{index // 64}.{index % 64}.{i + 1}' for i in range(4)]
            self.machine(name, os_ip=ips[0])
            self.topology(name, ips)
        self.machine('cdu', mgx_type='cdu', rack_mount='external', rack_u=0, os_ip='192.0.2.1')
        self.machine('power', mgx_type='powershelf', os_ip='192.0.2.2')
        self.machine('switch', mgx_type='switch', os_ip='192.0.2.3')
        worker_limits = []
        def pool(max_workers):
            worker_limits.append(max_workers)
            return base.ThreadPoolExecutor(max_workers=max_workers)
        self.s['ThreadPoolExecutor'] = pool
        result = self.s['rack_ping'](project='rack')
        self.assertEqual(worker_limits, [64])
        self.assertEqual(result['unique_ips'], 515)
        self.assertEqual(len(self.calls), 515)
        self.assertEqual(sum(node['ping_counts']['configured'] for node in result['nodes']), 515)
        self.assertTrue(all(node['rack_ping_state'] == 'up' for node in result['nodes']))
        self.assertIn('checked_at', result)

    def test_batch_size_limit_rejects_before_probing(self):
        self.handlers()
        self.machine()
        self.topology(ips=[f'10.0.{i // 256}.{i % 256}' for i in range(2049)])
        with self.assertRaises(base.ApiError) as error:
            self.s['rack_ping'](project='rack')
        self.assertEqual(error.exception.status_code, 422)
        self.assertEqual(self.calls, [])
