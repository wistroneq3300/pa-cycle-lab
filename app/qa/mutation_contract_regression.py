"""Legacy link identity and L10 promotion contract with synthetic inventory."""
import copy
import unittest
from unittest.mock import Mock
import reliability_regression as base
from operations_regression import extract, ApiError
import legacy_links


class MutationContract(unittest.TestCase):
    def setUp(self):
        self.links=[]
        self.scope=dict(links=self.links, machines={'a':{},'b':{}}, HTTPException=ApiError, _save_data=Mock())
        extract('main.py',['add_link','delete_link','delete_machine'],self.scope)

    def test_invalid_endpoint_and_type_rejected_without_save(self):
        for body in [dict(a='a',b='missing'),dict(a='a',b='b',type='invalid')]:
            with self.assertRaises(ApiError):
                self.scope['add_link'](body)
        self.assertEqual(self.links,[])
        self.scope['_save_data'].assert_not_called()

    def test_precise_identity_does_not_delete_other_type_or_port(self):
        for kind,port in [('eth','1'),('power','1'),('eth','2')]:
            self.scope['add_link'](dict(a='a',b='b',type=kind,a_port=port,b_port='in'))
        self.assertEqual(len({link['id'] for link in self.links}),3)
        with self.assertRaises(ApiError) as error:
            self.scope['delete_link'](dict(a='a',b='b'))
        self.assertEqual(error.exception.status_code,409)
        target=self.links[1]['id']
        self.scope['delete_link']({'id':target})
        self.assertEqual([link['type'] for link in self.links],['eth','eth'])
        self.scope['delete_link'](dict(a='b',b='a',type='eth',a_port='in',b_port='2'))
        self.assertEqual(len(self.links),1)
        self.assertEqual(self.links[0]['a_port'],'1')

    def test_reverse_duplicate_and_legacy_ids_are_stable(self):
        self.scope['add_link'](dict(a='a',b='b',type='eth',a_port='1',b_port='2'))
        self.scope['add_link'](dict(a='b',b='a',type='eth',a_port='2',b_port='1'))
        self.assertEqual(len(self.links),1)
        legacy=[{k:v for k,v in link.items() if k!='id'} for link in self.links]
        legacy_links.ensure_ids(legacy)
        self.assertEqual(legacy,self.links)

    def test_delete_machine_removes_only_incident_links(self):
        self.links.extend([dict(a='a',b='b'),dict(a='b',b='c')])
        self.scope['delete_machine']('a')
        self.assertEqual(self.links,[dict(a='b',b='c')])


class PromotionContract(unittest.TestCase):
    setUp=base.Reliability.setUp
    machine=base.Reliability.machine

    def test_generic_promotion_rejected_without_inventory_changes(self):
        self.machine(level='system')
        before=copy.deepcopy(self.s['machines'])
        with self.assertRaises(base.ApiError) as error:
            self.s['edit_machine']('node',dict(level='rack',project='rack',rack_size=4))
        self.assertEqual(error.exception.status_code,422)
        self.assertEqual(before,self.s['machines'])


if __name__=='__main__':
    unittest.main()
