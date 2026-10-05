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


class MergedLibraryContract(unittest.TestCase):
    """Merged GPT second-review schema: ai_review -> UI view, provenance preserved."""

    def merged_item(self):
        return {'code':'Wistron-HW-00001-V006','sub_function':'HW','test_set':'PCIe','items':'Check PCIe',
                'ai_review':{'automation_classification':'FULLY AUTOMATABLE',
                             'test_command':'lspci -nn',
                             'required_packages':['pciutils'],
                             'logs_to_collect':['lspci -vvv','AER'],
                             'risk_level':'LOW','end_user_decides':['PASS','FAIL','BLOCKED'],
                             'openhands_instruction':'Use read-only pciutils.'},
                'previous_ai_review':None}

    def test_merged_item_normalised_and_ai_review_preserved(self):
        lib={'sheets':{'F':{'name':'Functionality','items':[self.merged_item()]}}}
        prepare_library(lib)
        it=lib['sheets']['F']['items'][0]
        self.assertEqual(it['ai_can_execute'],'YES')
        self.assertEqual(it['ai_commands'],'lspci -nn')
        self.assertEqual(it['ai_packages_needed'],'pciutils')
        self.assertEqual(it['ai_logs_output'],'lspci -vvv\nAER')
        self.assertEqual(it['risk'],'LOW')
        # source review is never discarded
        self.assertEqual(it['ai_review']['automation_classification'],'FULLY AUTOMATABLE')
        self.assertEqual(lib['schema_version'],'tests-gpt-merged-v1')

    def test_classification_mapping(self):
        cases={'FULLY AUTOMATABLE':'YES','REQUIRES PACKAGE / USER CONFIRMATION':'PARTIAL',
               'MANUAL ONLY':'PARTIAL','BLOCKED':'NO','SOMETHING ELSE':'UNRESOLVED'}
        for cls,expect in cases.items():
            lib={'sheets':{'F':{'name':'F','items':[{'code':'C','ai_review':{'automation_classification':cls}}]}}}
            prepare_library(lib)
            self.assertEqual(lib['sheets']['F']['items'][0]['ai_can_execute'],expect,cls)

    def test_normalization_idempotent_and_variant_stable(self):
        lib={'sheets':{'F':{'name':'F','items':[self.merged_item(),self.merged_item()]}}}
        prepare_library(lib)
        first=lib['version']; ids=[i['case_variant_id'] for i in lib['sheets']['F']['items']]
        prepare_library(lib)
        self.assertEqual(lib['version'],first)
        self.assertEqual([i['case_variant_id'] for i in lib['sheets']['F']['items']],ids)

    def test_legacy_rows_untouched(self):
        lib={'sheets':{'F':{'name':'F','items':[{'code':'X','ai_can_execute':'NO','ai_commands':'foo'}]}}}
        prepare_library(lib)
        it=lib['sheets']['F']['items'][0]
        self.assertEqual(it['ai_can_execute'],'NO')
        self.assertEqual(it['ai_commands'],'foo')
        self.assertEqual(lib['schema_version'],2)


if __name__=='__main__':unittest.main()
