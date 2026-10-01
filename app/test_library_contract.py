"""Variant identity and artifact version for reviewed test-library rows."""
import hashlib
import json


def prepare_library(library):
    seen = set()
    for label, sheet in library.get('sheets', {}).items():
        for item in sheet.get('items', []):
            payload = {key: value for key, value in item.items() if key != 'case_variant_id'}
            raw = json.dumps([sheet.get('name', label), payload], sort_keys=True, ensure_ascii=False, separators=(',', ':'))
            base = 'case-' + hashlib.sha256(raw.encode()).hexdigest()[:24]
            identity, index = base, 1
            while identity in seen:
                index += 1
                identity = f'{base}-{index}'
            item['case_variant_id'] = identity
            seen.add(identity)
    raw = json.dumps(library.get('sheets', {}), sort_keys=True, ensure_ascii=False, separators=(',', ':'))
    library['version'] = hashlib.sha256(raw.encode()).hexdigest()
    library['schema_version'] = 2
    return library


def select_variant(library, code='', variant_id=''):
    prepare_library(library)
    matches = []
    for label, sheet in library.get('sheets', {}).items():
        for item in sheet.get('items', []):
            if variant_id:
                if item['case_variant_id'] != variant_id:
                    continue
                if code and item.get('code') != code:
                    raise ValueError('Variant does not match the supplied code')
            elif item.get('code') != code:
                continue
            matches.append({**item, 'sheet': label})
    if len(matches) > 1:
        raise ValueError('Multiple test variants; supply case_variant_id')
    return matches[0] if matches else None
