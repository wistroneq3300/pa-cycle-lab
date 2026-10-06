"""New-node hostname must land in data.json (not just show in the UI).

Regression: a node added via ``POST /api/machines/{name}/os`` was persisted
*without* ``os_hostname``/``bmc_hostname``, and the ``.../probe`` endpoint that
fetches the hostname never wrote it back. The Cycle picker then derived the
node name through the ``os_hostname or 'n'+slot`` fallback, so a freshly added
node appeared as ``n4`` and was rejected as "缺少或無效 hostname".

No network: SSH/BMC access is faked at the ``web.pa.ssh_run`` seam.
"""
import unittest
from unittest.mock import patch

import test_integration as base
from integration import web
from integration import targets
from scripts.native_demo import fixture


class NodeHostnamePersistence(unittest.TestCase):
    setUp = base.IntegrationTests.setUp
    tearDown = base.IntegrationTests.tearDown

    def _load(self, nodes=4):
        doc = fixture(nodes=nodes)
        web.pa.machines = doc['machines']
        web.pa.projects = doc['projects']
        web.pa._save_data()
        return web.pa.machines['chassis-01']

    def _reload(self):
        """Read data.json back from disk the way the process would on restart."""
        import json
        from integration.settings import DATA
        disk = json.loads((DATA / 'data.json').read_text(encoding='utf-8'))
        return disk['machines']

    def test_add_os_persists_supplied_hostnames_to_disk(self):
        # (A) A node added with explicit hostnames must be written to data.json
        #     with those hostnames, not dropped.
        self._load()
        response = self.client.post('/api/machines/chassis-01/os', json=dict(
            ip='192.0.2.249', user='planned', **{'pass': 'PW'},
            port=2345, bmc_ip='198.18.9.9', bmc_user='bmc', bmc_pass='BPW',
            bmc_ssh_port=2205, ipmi_port=2623, label='neutrino-n0',
            os_hostname='neutrino-n0', bmc_hostname='vc-256-bmc-n0'))
        self.assertEqual(response.status_code, 200, response.text)
        disk = self._reload()
        entry = next(e for e in disk['chassis-01']['os'] if e['os_hostname'] == 'neutrino-n0')
        self.assertEqual(entry['os_hostname'], 'neutrino-n0')
        self.assertEqual(entry['bmc_hostname'], 'vc-256-bmc-n0')

    def test_probe_writes_hostname_back_and_persists(self):
        # (B) The probe endpoint fetches the hostname via SSH; that hostname must
        #     be written into the slot AND saved, so a node that was added blank
        #     becomes a valid Cycle target without any further manual edit.
        machine = self._load()
        entry = machine['os'][3]                 # slot 4
        entry.pop('os_hostname', None)
        entry.pop('bmc_hostname', None)
        entry['bmc_ip'] = ''
        entry['label'] = 'OS 4'
        web.pa._save_data()

        def fake_ssh(host, user, password, port, command, timeout=8):
            if command.strip() == 'hostname':
                return 'neutrino-n0', 0, ''
            return '', 0, ''

        with patch.object(web.pa, 'ssh_run', side_effect=fake_ssh), \
             patch.object(web.pa, '_probe_bmc_ip', return_value=('198.18.4.4', True, '')):
            response = self.client.post('/api/machines/chassis-01/os/4/probe')
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()['hostname'], 'neutrino-n0')

        disk = self._reload()
        slot4 = next(e for e in disk['chassis-01']['os'] if e['slot'] == 4)
        self.assertEqual(slot4['os_hostname'], 'neutrino-n0')
        self.assertEqual(slot4['label'], 'neutrino-n0')
        self.assertEqual(slot4['bmc_ip'], '198.18.4.4')

    def test_probe_does_not_overwrite_operator_bmc_ip(self):
        # An operator-supplied BMC IP is authoritative; the probe must not clobber it.
        machine = self._load()
        entry = machine['os'][3]
        entry['bmc_ip'] = '203.0.113.7'
        entry.pop('os_hostname', None)
        web.pa._save_data()

        with patch.object(web.pa, 'ssh_run', return_value=('neutrino-n0', 0, '')), \
             patch.object(web.pa, '_probe_bmc_ip', return_value=('198.18.4.4', True, '')):
            response = self.client.post('/api/machines/chassis-01/os/4/probe')
        self.assertEqual(response.status_code, 200, response.text)
        disk = self._reload()
        slot4 = next(e for e in disk['chassis-01']['os'] if e['slot'] == 4)
        self.assertEqual(slot4['bmc_ip'], '203.0.113.7')

    def test_probe_failure_does_not_fabricate_hostname(self):
        # If SSH fails there is nothing to persist: the endpoint reports the error
        # and leaves the entry without a hostname (no invented identity).
        machine = self._load()
        entry = machine['os'][3]
        entry.pop('os_hostname', None)
        web.pa._save_data()
        with patch.object(web.pa, 'ssh_run', return_value=(None, 255, 'denied')):
            response = self.client.post('/api/machines/chassis-01/os/4/probe')
        self.assertEqual(response.status_code, 200, response.text)
        self.assertFalse(response.json()['ok'])
        disk = self._reload()
        slot4 = next(e for e in disk['chassis-01']['os'] if e['slot'] == 4)
        self.assertFalse(slot4.get('os_hostname'))

    def test_patch_sets_and_clears_hostname_and_versions_binding(self):
        machine = self._load()
        entry = machine['os'][3]
        entry.pop('os_hostname', None)
        web.pa._save_data()
        before = web.pa.node_identity.binding(
            next(e for e in web.pa.machines['chassis-01']['os'] if e['slot'] == 4))

        response = self.client.patch('/api/machines/chassis-01/os/4',
                                     json=dict(os_hostname='neutrino-n0'))
        self.assertEqual(response.status_code, 200, response.text)
        disk = self._reload()
        slot4 = next(e for e in disk['chassis-01']['os'] if e['slot'] == 4)
        self.assertEqual(slot4['os_hostname'], 'neutrino-n0')
        after = web.pa.node_identity.binding(
            next(e for e in web.pa.machines['chassis-01']['os'] if e['slot'] == 4))
        self.assertNotEqual(before, after, 'identity change must version the binding')

        # Empty string clears it again.
        response = self.client.patch('/api/machines/chassis-01/os/4',
                                     json=dict(os_hostname=''))
        self.assertEqual(response.status_code, 200, response.text)
        disk = self._reload()
        slot4 = next(e for e in disk['chassis-01']['os'] if e['slot'] == 4)
        self.assertFalse(slot4.get('os_hostname'))

    def test_cycle_inventory_uses_hostname_and_falls_back_only_without_it(self):
        # The behaviour that surfaced the bug: a node with no hostname is named
        # n<slot> and flagged; once a hostname is present the derived node uses it.
        machine = self._load()
        entry = machine['os'][3]
        entry.pop('os_hostname', None)
        web.pa._save_data()

        class PA:
            pass

        pa = PA()
        pa.machines = web.pa.machines
        pa.projects = web.pa.projects
        rows = [t for t in targets.inventory(pa) if t.get('parent_name') == 'chassis-01']
        slot4 = next(t for t in rows if t.get('slot_key') == 'N4')
        self.assertEqual(slot4['node'], 'n4', 'missing hostname must fall back to n<slot>')

        # Provide the hostname: the derived node name follows, no n<slot> fallback.
        self.client.patch('/api/machines/chassis-01/os/4', json=dict(os_hostname='neutrino-n0'))
        pa.machines = web.pa.machines
        rows = [t for t in targets.inventory(pa) if t.get('parent_name') == 'chassis-01']
        slot4 = next(t for t in rows if t.get('slot_key') == 'N4')
        self.assertEqual(slot4['node'], 'neutrino-n0')


if __name__ == '__main__':
    unittest.main()
