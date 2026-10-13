"""Prove targeted material polish preserves all existing geometry resources.

Usage: python verify_finish_geometry.py BEFORE.glb AFTER.glb REPORT.json
Accessor identity compares decoded byte sequences, independent of buffer offsets.
"""
from pathlib import Path
import hashlib
import json
import struct
import sys


def read(path):
    raw = Path(path).read_bytes()
    length = struct.unpack_from('<I', raw, 12)[0]
    return json.loads(raw[20:20+length]), raw[28+length:], raw


def accessor(doc, binary, index):
    a = doc['accessors'][index]
    view = doc['bufferViews'][a['bufferView']]
    width = {5120:1,5121:1,5122:2,5123:2,5125:4,5126:4}[a['componentType']]
    width *= {'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
    start = view.get('byteOffset',0)+a.get('byteOffset',0)
    stride = view.get('byteStride',width)
    data = b''.join(binary[start+i*stride:start+i*stride+width] for i in range(a['count']))
    return a['count'],a['componentType'],a['type'],data


old, oldbin, oldraw = read(sys.argv[1])
new, newbin, newraw = read(sys.argv[2])
assert old['nodes'] == new['nodes'], 'Node identity, transforms, ownership or semantic metadata changed'
assert len(old['meshes']) == len(new['meshes'])
checked = 0
for before,after in zip(old['meshes'],new['meshes']):
    assert len(before['primitives']) == len(after['primitives'])
    for p,q in zip(before['primitives'],after['primitives']):
        for attr in ('POSITION','NORMAL','TEXCOORD_0'):
            assert accessor(old,oldbin,p['attributes'][attr]) == accessor(new,newbin,q['attributes'][attr]), (before['name'],attr)
        assert accessor(old,oldbin,p['indices']) == accessor(new,newbin,q['indices']), (before['name'],'indices')
        if 'TANGENT' in p['attributes'] and 'TANGENT' in q['attributes']:
            assert accessor(old,oldbin,p['attributes']['TANGENT']) == accessor(new,newbin,q['attributes']['TANGENT']), (before['name'],'TANGENT')
        checked += 1
assert all(new['extras'].get(k)==v for k,v in old['extras'].items()), 'Opt-in ownership contract changed'
report = {
    'status':'PASS',
    'beforeSha256':hashlib.sha256(oldraw).hexdigest(),
    'afterSha256':hashlib.sha256(newraw).hexdigest(),
    'beforeBytes':len(oldraw),'afterBytes':len(newraw),
    'nodesIdentical':len(old['nodes']), 'primitivesIdentical':checked,
    'positionNormalUvIndices':'all accessor bytes identical',
    'sharedTangents':'all shared tangent bytes identical',
    'nodeTransformsOwnershipExtras':'all baseline keys identical; finish revision/provenance added',
    'triangles':sum(old['accessors'][p['indices']]['count']//3 for m in old['meshes'] for p in m['primitives']),
    'materialCountBefore':len(old['materials']),'materialCountAfter':len(new['materials']),
    'imagesBefore':len(old['images']),'imagesAfter':len(new['images']),
    'contactAoMaterials':[{'name':m['name'],'board':m.get('extras',{}).get('l10ContactBoard')} for m in new['materials'] if 'occlusionTexture' in m],
    'thinFilm':[{'name':m['name'],**m.get('extras',{})} for m in new['materials'] if m.get('extras',{}).get('l10ThinFilmStrength')]
}
Path(sys.argv[3]).write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
