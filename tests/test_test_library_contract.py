"""Contract tests over the shipped test-library dataset (data/<instance>/tests.json).

These assert the real artefact invariants the assignment flow depends on:
variant identity is unique, duplicate codes stay distinguishable, and the merged
GPT second-review schema survives normalisation. They skip when no dataset is
present so the suite still runs on a bare checkout.
"""
import json
import os
import sys
import unittest
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'app'))

from test_library_contract import prepare_library, select_variant, MERGED_SCHEMA  # noqa: E402


def _dataset_path():
    override = os.environ.get('PA_TESTLIB_FILE')
    if override and os.path.exists(override):
        return override
    data_dir = os.path.join(ROOT, 'data')
    if os.path.isdir(data_dir):
        for name in sorted(os.listdir(data_dir)):
            candidate = os.path.join(data_dir, name, 'tests.json')
            if os.path.exists(candidate):
                return candidate
    repo_copy = os.path.join(ROOT, 'app', 'data', 'tests.json')
    return repo_copy if os.path.exists(repo_copy) else None


class ShippedLibrary(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.path = _dataset_path()
        if not cls.path:
            raise unittest.SkipTest('no tests.json dataset present')
        with open(cls.path, encoding='utf-8') as fh:
            cls.library = json.load(fh)
        prepare_library(cls.library)
        cls.items = [it for sheet in cls.library['sheets'].values() for it in sheet.get('items', [])]

    def test_rows_present(self):
        self.assertGreaterEqual(len(self.items), 1)
        self.assertEqual(self.library.get('total', len(self.items)), len(self.items))

    def test_every_row_has_unique_case_variant_id(self):
        ids = [it['case_variant_id'] for it in self.items]
        self.assertEqual(len(ids), len(set(ids)))

    def test_duplicate_codes_are_resolvable_only_by_variant_id(self):
        counts = Counter(it['code'] for it in self.items)
        dup_code = next((c for c, n in counts.items() if n > 1), None)
        if dup_code is None:
            self.skipTest('dataset has no duplicate codes')
        with self.assertRaises(ValueError):
            select_variant(self.library, dup_code)
        variant = next(it['case_variant_id'] for it in self.items if it['code'] == dup_code)
        self.assertIsNotNone(select_variant(self.library, dup_code, variant))

    def test_merged_schema_kept_and_normalised(self):
        reviewed = [it for it in self.items if isinstance(it.get('ai_review'), dict)]
        if not reviewed:
            self.skipTest('legacy dataset (no ai_review)')
        self.assertEqual(self.library.get('schema_version'), MERGED_SCHEMA)
        # ai_review survives, and a flat view is derived for the existing UI
        for it in reviewed[:200]:
            self.assertIn('automation_classification', it['ai_review'])
            self.assertIn(it['ai_can_execute'], {'YES', 'PARTIAL', 'NO', 'UNRESOLVED'})

    def test_version_is_stable_across_reloads(self):
        before = self.library['version']
        with open(self.path, encoding='utf-8') as fh:
            again = json.load(fh)
        prepare_library(again)
        self.assertEqual(again['version'], before)

    def test_stage_fields_present_for_merged_rows(self):
        reviewed = [it for it in self.items if isinstance(it.get('ai_review'), dict)]
        if not reviewed:
            self.skipTest('legacy dataset (no ai_review)')
        pre = sum(1 for it in reviewed if it.get('ai_precheck'))
        post = sum(1 for it in reviewed if it.get('ai_postcheck'))
        self.assertGreater(pre, len(reviewed) * 0.9)
        self.assertGreater(post, len(reviewed) * 0.9)
        # identity excludes injected stage fields -> reload keeps same ids
        def key(it):
            return (it.get('code'), it.get('test_set'), it.get('items'))
        before = {key(it): it['case_variant_id'] for it in reviewed[:500]}
        with open(self.path, encoding='utf-8') as fh:
            again = json.load(fh)
        prepare_library(again)
        rows = [it for sheet in again['sheets'].values() for it in sheet.get('items', [])]
        after = {key(it): it['case_variant_id'] for it in rows}
        mismatches = [k for k, v in before.items() if after.get(k) != v]
        self.assertEqual(mismatches, [])


if __name__ == '__main__':
    unittest.main()
