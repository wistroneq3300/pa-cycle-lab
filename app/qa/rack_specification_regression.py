"""Real handler tests: no live server, inventory or hardware."""
import copy
import unittest
from unittest.mock import patch
import reliability_regression as base

class RackSpecifications(unittest.TestCase):
    machine = base.Reliability.machine
    def setUp(self):
        base.Reliability.setUp(self)
        base.extract('main.py',['set_rack_specification'],self.s)
        self.s['projects'].update({'l10':{'level':'system'},'rack':{'level':'rack'}})

    def payload(self,name='node',**updates):
        m=self.s['machines'][name]
        p=dict(rack_size=4,project='rack',expected_level=m.get('level','system'),
               expected_project=m.get('project',''),expected_size=m.get('rack_size',1),expected_u=m.get('rack_u',0))
        p.update(updates)
        return p

    def test_promote_explicit_height_and_project_unplaced(self):
        self.machine(level='system',project='l10',rack_size=1,os_ip='192.0.2.1',custom='preserve')
        self.s['set_rack_specification']('node',self.payload(rack_size=8))
        m=self.s['machines']['node']
        self.assertEqual((m['level'],m['project'],m['rack_size'],m['rack_u']),('rack','rack',8,0))
        self.assertEqual((m['os_ip'],m['custom']),('192.0.2.1','preserve'))

    def test_correct_height_then_normal_placement(self):
        self.machine(rack_u=12,rack_size=1)
        self.s['set_rack_specification']('node',self.payload(rack_size=4))
        self.assertEqual(self.s['machines']['node']['rack_u'],12)
        self.s['place_machine']('node',{'rack_u':20,'expected_project':'rack'})
        self.assertEqual(self.s['machines']['node']['rack_size'],4)
        with self.assertRaises(base.ApiError):self.s['edit_machine']('node',{'rack_size':1})

    def test_collision_bounds_and_stale_snapshots_atomic(self):
        self.machine(rack_u=10)
        self.machine('other',rack_u=8,rack_size=1)
        for update in [dict(rack_size=4),dict(rack_size=11),dict(rack_size=0),dict(rack_size=49),
                       dict(rack_size=True),dict(rack_size='4'),dict(expected_size=2),
                       dict(expected_u=9),dict(expected_project='old'),dict(expected_level='system')]:
            before=copy.deepcopy(self.s['machines'])
            with self.assertRaises(base.ApiError):self.s['set_rack_specification']('node',self.payload(**update))
            self.assertEqual(self.s['machines'],before)

    def test_reject_extra_fields_wrong_project_and_nonserver_promotion(self):
        self.machine(level='system',project='l10')
        for update in [dict(mgx_type='switch'),dict(project='l10'),dict(project='missing')]:
            with self.assertRaises(base.ApiError):self.s['set_rack_specification']('node',self.payload(**update))
        self.s['machines']['node']['mgx_type']='switch'
        with self.assertRaises(base.ApiError):self.s['set_rack_specification']('node',self.payload())

    def test_empty_project_and_inferred_l10_project(self):
        self.s['projects']['empty'] = {'name':'empty'}
        self.s['projects']['legacy'] = {'name':'legacy'}
        self.machine(level='system',project='legacy')
        with self.assertRaises(base.ApiError):
            self.s['set_rack_specification']('node',self.payload(project='legacy'))
        self.s['set_rack_specification']('node',self.payload(project='empty',rack_size=2))
        self.assertEqual(self.s['machines']['node']['project'],'empty')
        self.machine('unassigned',project='',rack_size=1)
        self.s['set_rack_specification']('unassigned',self.payload('unassigned',project='',rack_size=3))
        self.assertEqual(self.s['machines']['unassigned']['rack_size'],3)

    def test_cdu_bottom_and_external_guard(self):
        self.machine(mgx_type='cdu',rack_size=4,rack_u=4)
        self.s['set_rack_specification']('node',self.payload(rack_size=6))
        self.assertEqual(self.s['machines']['node']['rack_u'],6)
        self.s['machines']['node'].update(rack_mount='external',rack_u=0,rack_size=0)
        with self.assertRaises(base.ApiError):self.s['set_rack_specification']('node',self.payload())

    def test_disk_failure_rolls_back_correction(self):
        self.machine(rack_size=1,rack_u=12);self.s['_save_data']()
        before=copy.deepcopy(self.s['machines'])
        with patch.object(base.os,'replace',side_effect=PermissionError('test')):
            with self.assertRaises(base.ApiError):self.s['set_rack_specification']('node',self.payload())
        self.assertEqual(self.s['machines'],before)

if __name__=='__main__':unittest.main()
