"""Publish material resources while retaining the accepted geometry verbatim.

Blender can change service-mesh UV rounding and tangent vertex splitting during
re-export. The targeted finish build verifies each material primitive's physical
triangles, then retains every accepted geometry accessor, including UV/tangents.
This is not a general modeling exporter and rejects physical geometry changes.
"""
import copy
import hashlib
import json
import struct
import subprocess
import numpy as np

BASELINE_COMMIT = '08dbc28af276c6b62e30f9502d6befe4aa4ce145'
BASELINE_SHA256 = '7e4f3f83dca2b963121981ccaabfd84cae5c0486811f5cafeedc21502f982d6a'


def retain_geometry(root, current, current_binary):
    raw = subprocess.run(['git','show',BASELINE_COMMIT+':app/static/models/l10-prototype/bare-compute-boards.glb'],
                         cwd=root,capture_output=True,check=True).stdout
    if hashlib.sha256(raw).hexdigest() != BASELINE_SHA256:
        raise RuntimeError('Accepted geometry baseline hash mismatch')
    length = struct.unpack_from('<I',raw,12)[0]
    baseline = json.loads(raw[20:20+length]); binary = raw[28+length:]
    if baseline['nodes'] != current['nodes']:
        raise RuntimeError('Node identity/transforms/ownership changed in a finish-only build')

    def data(doc, blob, index):
        a = doc['accessors'][index]; view = doc['bufferViews'][a['bufferView']]
        dtype = {5123:'<u2',5125:'<u4',5126:'<f4'}[a['componentType']]
        size = {'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
        start = view.get('byteOffset',0)+a.get('byteOffset',0)
        stride = view.get('byteStride',np.dtype(dtype).itemsize*size)
        return np.ndarray((a['count'],size),dtype=dtype,buffer=blob,offset=start,strides=(stride,np.dtype(dtype).itemsize)).copy()

    def triangles(doc, blob, p):
        vertices = data(doc,blob,p['attributes']['POSITION'])
        indices = data(doc,blob,p['indices']).ravel()
        xyz = vertices[indices].reshape(-1,3,3)
        # Unordered geometric triangles tolerate tangent-driven duplicate
        # vertices but cannot conceal new, removed or shifted physical faces.
        ordered = np.sort(xyz.view([('x','<f4'),('y','<f4'),('z','<f4')]).reshape(-1,3),axis=1).view('<f4').reshape(-1,9)
        return ordered[np.lexsort(ordered.T[::-1])]

    if len(baseline['meshes']) != len(current['meshes']):
        raise RuntimeError('Mesh count changed')
    meshes = copy.deepcopy(baseline['meshes'])
    for original, candidate, target in zip(baseline['meshes'],current['meshes'],meshes):
        if len(original['primitives']) != len(candidate['primitives']):
            raise RuntimeError('Primitive count changed')
        for p,q,result in zip(original['primitives'],candidate['primitives'],target['primitives']):
            if not np.array_equal(triangles(baseline,binary,p),triangles(current,current_binary,q)):
                raise RuntimeError('Physical triangles changed: '+original['name'])
            result['material'] = q['material']
            if 'normalTexture' in current['materials'][q['material']] and 'TANGENT' not in result['attributes']:
                raise RuntimeError('New normal-map topology requires an explicit geometry revision')
    output = copy.deepcopy(current)
    output['meshes'] = meshes
    output['accessors'] = copy.deepcopy(baseline['accessors'])
    output['bufferViews'] = []
    packed = bytearray(); remap = {}

    def append_view(doc,blob,index,source):
        key = (source,index)
        if key in remap: return remap[key]
        view = copy.deepcopy(doc['bufferViews'][index]); start = view.get('byteOffset',0)
        packed.extend(b'\0'*((-len(packed))%4));view['byteOffset']=len(packed)
        packed.extend(blob[start:start+view['byteLength']]);view['buffer']=0
        remap[key] = len(output['bufferViews']);output['bufferViews'].append(view)
        return remap[key]
    for a in output['accessors']:
        a['bufferView'] = append_view(baseline,binary,a['bufferView'],'accepted')
    for im in output['images']:
        im['bufferView'] = append_view(current,current_binary,im['bufferView'],'finish')
    packed.extend(b'\0'*((-len(packed))%4));output['buffers']=[{'byteLength':len(packed)}]
    output.setdefault('extras',{})['targetedFinishRevision']=1
    output['extras']['preservedGeometry']={'commit':BASELINE_COMMIT,'sha256':BASELINE_SHA256,
        'method':'Physical triangles verified; original geometry accessor bytes retained',
        'nodes':len(baseline['nodes']),'primitives':sum(len(m['primitives']) for m in meshes)}
    print('GEOMETRY_RETENTION physical triangles verified; all accepted geometry accessor bytes retained',flush=True)
    return output,bytes(packed)
