"""Stable identities and precise matching for the legacy inventory links API."""
import hashlib
import json


def signature(link):
    endpoints = sorted([(str(link.get('a') or ''), str(link.get('a_port') or '')),
                        (str(link.get('b') or ''), str(link.get('b_port') or ''))])
    return json.dumps([link.get('type') or 'eth', endpoints], separators=(',', ':'))


def ensure_ids(links):
    used = {link['id'] for link in links if link.get('id')}
    for link in links:
        if link.get('id'):
            continue
        base = 'legacy-' + hashlib.sha256(signature(link).encode()).hexdigest()[:24]
        candidate, index = base, 1
        while candidate in used:
            candidate = f'{base}-{index}'
            index += 1
        link['id'] = candidate
        used.add(candidate)


def matches(link, query):
    if query.get('id'):
        return link.get('id') == query['id']
    if {link.get('a'), link.get('b')} != {query.get('a'), query.get('b')}:
        return False
    if 'type' in query and link.get('type', 'eth') != query['type']:
        return False
    reversed_order = query.get('a') == link.get('b')
    for field, reverse in [('a_port','b_port'), ('b_port','a_port')]:
        if field in query and (query[field] or '') != (link.get(reverse if reversed_order else field) or ''):
            return False
    return True
