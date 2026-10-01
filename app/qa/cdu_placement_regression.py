from test_support import WorkspaceTemporaryDirectory
"""CDU installation contracts against actual backend functions, temporary storage only."""
import copy
import json
import os
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from concurrent.futures import ThreadPoolExecutor
import unittest

import reliability_regression as base


class CduPlacement(unittest.TestCase):
    setUp = base.Reliability.setUp
    machine = base.Reliability.machine

    def create(self, name='CDU-01', **kw):
        body = dict(name=name, mgx_type='cdu', project='rack', rack_mount='external',
                    rack_u=1, rack_size=1, rack_side='front', manage_ip='192.0.2.40')
        body.update(kw)
        return self.s['add_rack_passive'](SimpleNamespace(**body))['machine']

    def reject_unchanged(self, callback, status=None):
        before = copy.deepcopy(self.s['machines'])
        disk = Path(self.s['DATA_FILE']).read_bytes()
        seq = self.s['_seq']
        with self.assertRaises(base.ApiError) as err:
            callback()
        if status is not None:
            self.assertEqual(err.exception.status_code, status)
        self.assertEqual(self.s['machines'], before)
        self.assertEqual(Path(self.s['DATA_FILE']).read_bytes(), disk)
        self.assertEqual(self.s['_seq'], seq)

    def test_external_has_no_u_even_with_full_rack(self):
        self.machine('full', rack_u=48, rack_size=48)
        cdu = self.create()
        self.assertEqual((cdu['rack_u'], cdu['rack_size']), (0, 0))
        self.assertEqual(cdu['rack_mount'], 'external')
        self.assertEqual(cdu['bmc_ip'], '192.0.2.40')
        self.assertEqual(self.s['machines']['full']['rack_size'], 48)

    def test_one_cdu_includes_pending_and_both_installations(self):
        for mount, top, size in [('internal', 0, 4), ('internal', 4, 4), ('external', 0, 0)]:
            self.s['machines'].clear()
            self.create(rack_mount=mount, rack_u=top, rack_size=size)
            for new_mount in ['external', 'internal']:
                self.reject_unchanged(lambda: self.create('CDU-02', rack_mount=new_mount,
                                                         rack_u=0, rack_size=4), 409)

    def test_external_requires_rack_cdu_and_valid_project(self):
        for changes in [dict(project=''), dict(project='missing'), dict(mgx_type='server'),
                        dict(mgx_type='blanking'), dict(rack_mount='sideways')]:
            self.reject_unchanged(lambda: self.create(**changes), 400)
        self.create()
        for changes in [{'level': 'system'}, {'mgx_type': 'server'}, {'project': ''}]:
            self.reject_unchanged(lambda: self.s['edit_machine']('CDU-01', changes), 400)

    def test_internal_bottom_and_occupied_bottom(self):
        self.reject_unchanged(lambda: self.create(rack_mount='internal', rack_size=4, rack_u=10), 400)
        self.machine('blank', mgx_type='blanking', rack_u=4, rack_size=4)
        self.reject_unchanged(lambda: self.create(rack_mount='internal', rack_size=4, rack_u=4), 409)
        self.s['machines'].clear()
        cdu = self.create(rack_mount='internal', rack_size=4, rack_u=4)
        self.assertEqual(cdu['rack_u'], cdu['rack_size'])
        self.machine('above')
        self.s['edit_machine']('above', {'rack_u': 5})
        self.reject_unchanged(lambda: self.s['edit_machine']('above', {'rack_u': 4}), 409)

    def test_existing_cdu_specs_fixed_and_placement_retains_identity(self):
        cdu = self.create(rack_mount='internal', rack_u=4, rack_size=4)
        original_id = cdu['id']
        for body in [{'rack_mount':'external'}, {'rack_size':5}, {'mgx_type':'server'}]:
            self.reject_unchanged(lambda: self.s['edit_machine']('CDU-01', body), 400)
        for u in [0, 4]:
            self.s['place_machine']('CDU-01', {'rack_u':u,'expected_project':'rack'})
            m = self.s['machines']['CDU-01']
            self.assertEqual((m['id'],m['bmc_ip'],m['rack_size']), (original_id,'192.0.2.40',4))

    def test_project_transfer_and_kind_change_cannot_create_second_cdu(self):
        self.create()
        self.s['projects']['other'] = {'name': 'other'}
        self.create('CDU-02', project='other')
        self.reject_unchanged(lambda: self.s['edit_machine']('CDU-02', {'project':'rack'}), 409)
        self.machine('switch', mgx_type='switch', rack_u=0)
        self.reject_unchanged(lambda: self.s['edit_machine']('switch', {'mgx_type':'cdu'}), 400)

    def test_conversion_disk_failure_rolls_back_mount_and_u(self):
        self.create(rack_mount='internal', rack_u=4, rack_size=4)
        with patch.object(os, 'replace', side_effect=OSError('simulated save failure')):
            self.reject_unchanged(lambda: self.s['edit_machine']('CDU-01', {'rack_u':0}), 503)

    def test_explicit_installation_conversion_preserves_identity_and_conflicts(self):
        cdu = self.create()
        body = dict(rack_mount='internal',rack_size=4,expected_project='rack')
        self.machine('bottom',rack_u=4,rack_size=4)
        self.reject_unchanged(lambda:self.s['set_cdu_installation']('CDU-01',body),409)
        del self.s['machines']['bottom']
        self.s['set_cdu_installation']('CDU-01',body)
        result=self.s['machines']['CDU-01']
        self.assertEqual((result['rack_u'],result['rack_size']), (4,4))
        self.assertEqual((result['id'],result['bmc_ip']), (cdu['id'],cdu['bmc_ip']))
        self.reject_unchanged(lambda:self.s['set_cdu_installation']('CDU-01',{**body,'rack_size':5}),400)
        self.s['set_cdu_installation']('CDU-01',dict(rack_mount='external',expected_project='rack'))
        self.assertEqual(self.s['machines']['CDU-01']['rack_size'],0)

    def test_installation_rejects_stale_project_and_rolls_back_disk_failure(self):
        self.create()
        body = dict(rack_mount='internal',rack_size=4,expected_project='rack')
        self.reject_unchanged(lambda:self.s['set_cdu_installation']('CDU-01',{**body,'expected_project':'other'}),409)
        with patch.object(os,'replace',side_effect=OSError('save failed')):
            self.reject_unchanged(lambda:self.s['set_cdu_installation']('CDU-01',body),503)

    def test_concurrent_external_creations_only_one_commits(self):
        def create(name):
            try:
                self.create(name)
                return True
            except base.ApiError:
                return False
        with ThreadPoolExecutor(2) as pool:
            self.assertEqual(sum(pool.map(create, ['CDU-A', 'CDU-B'])), 1)
        self.assertEqual(len(self.s['machines']), 1)
        self.assertEqual(json.loads(Path(self.s['DATA_FILE']).read_text())['machines'], self.s['machines'])

    def test_internal_large_u_boundaries(self):
        for size in [1, 4, 6, 20, 48]:
            self.s['machines'].clear()
            cdu = self.create(rack_mount='internal', rack_u=size, rack_size=size)
            self.assertEqual(cdu['rack_u']-cdu['rack_size']+1, 1)
        self.reject_unchanged(lambda: self.s['edit_machine']('CDU-01', {'rack_size':49, 'rack_u':49}), 400)

    def test_external_present_in_rack_telemetry_without_unplaced_components(self):
        self.create()
        self.machine('server', rack_u=8, mgx_type='server')
        self.machine('pending', rack_u=0, mgx_type='switch')
        self.machine('blank', rack_u=2, mgx_type='blanking')
        core = self.s['telemetry_core']
        membership = {'kind_of': core.kind_of}
        base.extract('telemetry_core.py', ['is_rack_member'], membership)
        core.is_rack_member = membership['is_rack_member']
        core.init_db = lambda: None
        core.get_rack_series = lambda *a: {}
        core.RACK_METRIC_DEF = {'cdu': {'flow_lpm': {'label':'Flow','unit':'L/min'}}}
        base.extract('main.py', ['rack_telemetry'], self.s)
        result = self.s['rack_telemetry']('rack')
        self.assertEqual(result['kinds_count'], {'server':1, 'cdu':1})
        self.assertEqual({m['name'] for m in result['components']}, {'server','CDU-01'})
        self.assertEqual(result['data']['cdu']['machines'], [])
        self.assertIn('flow_lpm', result['data']['cdu']['defs'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
