"""Inventory-to-placement lifecycle against real handlers, isolated storage."""
import copy
import unittest
import reliability_regression as base

class PlacementContract(unittest.TestCase):
    setUp = base.Reliability.setUp
    machine = base.Reliability.machine

    def test_place_move_remove_readd_preserves_all_specs(self):
        for kind,size in [('blanking',5),('pdu',3),('server',8),('switch',2)]:
            self.s['machines'].clear()
            self.machine(mgx_type=kind,rack_size=size,bmc_ip='192.0.2.10',id=42)
            expected=copy.deepcopy(self.s['machines']['node'])
            for u in [size,48,0,size]:
                self.s['place_machine']('node',{'rack_u':u,'expected_project':'rack'})
                expected['rack_u']=u
                self.assertEqual(self.s['machines']['node'],expected)

    def test_tampering_and_stale_project_rejected_atomically(self):
        self.machine(mgx_type='blanking',rack_size=5)
        for payload in [dict(rack_u=5,rack_size=1),dict(rack_u=5,mgx_type='server'),dict(rack_u=5,expected_project='other'),dict(rack_u=4),dict(rack_u=True)]:
            payload.setdefault('expected_project','rack')
            before=copy.deepcopy(self.s['machines'])
            with self.assertRaises(base.ApiError):
                self.s['place_machine']('node',payload)
            self.assertEqual(self.s['machines'],before)
        for payload in [dict(rack_size=1),dict(mgx_type='server')]:
            with self.assertRaises(base.ApiError):self.s['edit_machine']('node',payload)

    def test_level_roundtrip_preserves_height_and_type(self):
        self.machine(mgx_type='server',rack_size=8,rack_u=8)
        self.s['edit_machine']('node',dict(level='system',rack_u=0))
        self.s['projects']['rack']['level']='rack'
        base.extract('main.py',['set_rack_specification'],self.s)
        self.s['set_rack_specification']('node',dict(rack_size=8,project='rack',expected_level='system',
            expected_project='rack',expected_size=8,expected_u=0))
        self.assertEqual(self.s['machines']['node']['rack_size'],8)
        self.assertEqual(self.s['machines']['node']['mgx_type'],'server')
        self.s['place_machine']('node',dict(rack_u=8,expected_project='rack'))

    def test_collision_uses_stored_height(self):
        self.machine('occupied',rack_u=10,rack_size=2)
        self.machine(rack_size=5)
        with self.assertRaises(base.ApiError):self.s['place_machine']('node',dict(rack_u=12,expected_project='rack'))
        self.s['place_machine']('node',dict(rack_u=8,expected_project='rack'))

if __name__=='__main__': unittest.main(verbosity=2)
