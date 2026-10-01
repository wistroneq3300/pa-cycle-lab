import copy
import unittest
from types import SimpleNamespace
from unittest.mock import Mock
from operations_regression import extract, ApiError
from test_library_contract import prepare_library, select_variant


class LibraryContract(unittest.TestCase):
    def setUp(self):
        self.data={'sheets':{'Functional':{'name':'Functionality','items':[
            {'code':'DUP','procedure':'procedure A','criteria':'criteria A','ai_can_execute':'UNRESOLVED'},
            {'code':'DUP','procedure':'procedure B','criteria':'criteria B','ai_can_execute':'NO'}]}}}

    def test_variant_identity_stable_and_content_sensitive(self):
        prepare_library(self.data)
        rows=self.data['sheets']['Functional']['items']
        first=[r['case_variant_id'] for r in rows]
        self.assertEqual(len(set(first)),2)
        rows.reverse()
        prepare_library(self.data)
        self.assertEqual([r['case_variant_id'] for r in rows],first[::-1])
        rows[0]['criteria']='new criteria'
        prepare_library(self.data)
        self.assertNotEqual(rows[0]['case_variant_id'],first[1])

    def test_ambiguous_code_rejected_and_id_selects_exact_variant(self):
        prepare_library(self.data)
        with self.assertRaises(ValueError):select_variant(self.data,'DUP')
        identity=self.data['sheets']['Functional']['items'][1]['case_variant_id']
        self.assertEqual(select_variant(self.data,'DUP',identity)['criteria'],'criteria B')
        with self.assertRaises(ValueError):select_variant(self.data,'OTHER',identity)
        self.assertIsNone(select_variant(self.data,'DUP','stale-id'))

    def test_exact_duplicate_rows_get_distinct_stable_ids(self):
        rows=self.data['sheets']['Functional']['items']
        rows.append(copy.deepcopy(rows[0]))
        prepare_library(self.data)
        before=copy.deepcopy(self.data)
        prepare_library(self.data)
        self.assertEqual(self.data,before)
        self.assertEqual(len({r['case_variant_id'] for r in rows}),3)

    def test_advice_handler_rejects_ambiguity_before_llm(self):
        scope=dict(_load_testlib=lambda:self.data,HTTPException=ApiError,_llm_chat=Mock(return_value='advice'))
        extract('main.py',['ai_testlib_advice','api_testlibrary_meta'],scope)
        req=SimpleNamespace(code='DUP',case_variant_id='',log='fixture',machine='node')
        with self.assertRaises(ApiError):scope['ai_testlib_advice'](req)
        scope['_llm_chat'].assert_not_called()
        req.case_variant_id=self.data['sheets']['Functional']['items'][1]['case_variant_id']
        result=scope['ai_testlib_advice'](req)
        self.assertEqual(result['case_variant_id'],req.case_variant_id)
        prompt=scope['_llm_chat'].call_args.args[1]
        self.assertIn('criteria B',prompt)
        self.assertNotIn('criteria A',prompt)
        meta=scope['api_testlibrary_meta']()
        self.assertEqual((meta['sheets'][0]['no'],meta['sheets'][0]['unresolved']),(1,1))


if __name__=='__main__':unittest.main()
