"""Variant identity, provenance and a UI-facing view for reviewed test-library rows.

The library may be delivered in either of two schemas:

* legacy flat rows (``ai_can_execute`` / ``ai_commands`` / ``ai_packages_needed``
  / ``ai_logs_output`` / ``risk``), or
* the merged GPT second-review schema (``schema_version`` =
  ``tests-gpt-merged-v1``) where the same information lives under a nested
  ``ai_review`` object plus review provenance in ``merge_metadata``.

``prepare_library`` normalises both into a stable, UI-friendly view *without
touching the source fields*, so ``ai_review`` survives intact for downstream
consumers (PA Agent) while the existing library UI keeps working unchanged.
"""
import hashlib
import json

MERGED_SCHEMA = 'tests-gpt-merged-v1'

# Fields the contract injects *for merged rows*; excluded from the identity hash so
# case_variant_id stays stable across contract versions. Legacy rows keep the
# original hashing (only case_variant_id excluded) so their ids do not churn.
_DERIVED_FIELDS = frozenset({
    'case_variant_id', 'ai_can_execute', 'ai_commands', 'ai_packages_needed',
    'ai_logs_output', 'ai_precheck', 'ai_postcheck', 'ai_agent_instruction', 'risk',
})

# automation_classification -> the legacy tri-state badge the library UI shows.
_CLASS_TO_LEGACY = {
    'FULLY AUTOMATABLE': 'YES',
    'REQUIRES PACKAGE / USER CONFIRMATION': 'PARTIAL',
    'MANUAL ONLY': 'PARTIAL',
    'BLOCKED': 'NO',
}


def _as_lines(value):
    """Render a list of steps (or a plain string) as newline-joined text."""
    if value is None:
        return ''
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (list, tuple)):
        return '\n'.join(str(v).strip() for v in value if str(v).strip())
    return str(value).strip()


def normalize_item(item):
    """Fill the legacy flat fields from a merged ``ai_review`` when present.

    Never overwrites a value that is already set, so legacy rows and previously
    normalised rows are left untouched (keeps ``prepare_library`` idempotent).
    """
    review = item.get('ai_review')
    if not isinstance(review, dict):
        return item
    classification = review.get('automation_classification')
    if not item.get('ai_can_execute') and classification:
        item['ai_can_execute'] = _CLASS_TO_LEGACY.get(classification, 'UNRESOLVED')
    if not item.get('ai_packages_needed'):
        item['ai_packages_needed'] = _as_lines(review.get('required_packages'))
    if not item.get('ai_logs_output'):
        item['ai_logs_output'] = _as_lines(review.get('logs_to_collect'))
    if not item.get('ai_commands'):
        # The merged review keeps a natural-language test_command plus explicit
        # pre/post step lists. Surface each stage as its own field so the
        # assignment output can present them in order without losing any stage.
        item['ai_commands'] = _as_lines(review.get('test_command'))
    if not item.get('ai_precheck'):
        item['ai_precheck'] = _as_lines(review.get('pre_check_commands'))
    if not item.get('ai_postcheck'):
        item['ai_postcheck'] = _as_lines(review.get('post_check_commands'))
    if not item.get('ai_agent_instruction'):
        item['ai_agent_instruction'] = _as_lines(review.get('openhands_instruction'))
    if not item.get('risk'):
        item['risk'] = review.get('risk_level') or ''
    return item


def prepare_library(library):
    merged = False
    for label, sheet in library.get('sheets', {}).items():
        for item in sheet.get('items', []):
            if isinstance(item.get('ai_review'), dict):
                merged = True
                normalize_item(item)
    seen = set()
    for label, sheet in library.get('sheets', {}).items():
        for item in sheet.get('items', []):
            if isinstance(item.get('ai_review'), dict):
                skip = _DERIVED_FIELDS
            else:
                skip = {'case_variant_id'}
            payload = {key: value for key, value in item.items() if key not in skip}
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
    library['schema_version'] = library.get('schema_version') or (MERGED_SCHEMA if merged else 2)
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
