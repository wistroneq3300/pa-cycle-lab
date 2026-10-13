"""Append a service-only IO export to the verified immutable Phase 5 core GLB.

Re-evaluating Blender bevel UVs can produce tiny floating-point UV changes that
alter MikkTSpace handedness. Service work must not modify those existing normal
map responses. Preserve their original binary accessors/materials/images, and
copy only the declared IO primitives. This is not tangent repair or validation
bypass. Full/manual core exports intentionally do not use this preservation mode.
"""
import copy
import hashlib
import json
import struct
import subprocess

BASELINE_COMMIT='3ce4b9c6e5467abe9d27050e5af0240b07fff3dc'
BASELINE_SHA256='fe898a419c0f613bd003ef964e921dcc7c43771c4ed841bdbcd92da695857bc7'


def append_service(root, current_doc, current_binary):
    before=subprocess.run(['git','show',BASELINE_COMMIT+':app/static/models/l10-prototype/compute-board.glb'],cwd=root,capture_output=True,check=True).stdout
    if hashlib.sha256(before).hexdigest()!=BASELINE_SHA256:
        raise RuntimeError('Frozen core GLB hash mismatch: refusing a service-only replacement')
    n,kind=struct.unpack_from('<II',before,12)
    if kind!=0x4e4f534a:raise RuntimeError('Frozen GLB JSON chunk missing')
    doc=json.loads(before[20:20+n]);bin_n,bin_kind=struct.unpack_from('<II',before,20+n)
    if bin_kind!=0x004e4942:raise RuntimeError('Frozen GLB BIN chunk missing')
    binary=bytearray(before[28+n:28+n+bin_n])
    io=[node for node in current_doc['nodes']if node.get('extras',{}).get('l10Layer')=='io']
    if len(io)!=1 or io[0].get('children'):raise RuntimeError('Expected one independent service IO node')
    baseline_layers={node.get('extras',{}).get('l10Layer')for node in doc['nodes']}
    if baseline_layers!={'board','packages','cooling-frame','cooling'}:raise RuntimeError('Frozen baseline does not contain exactly the four original hardware layers')
    view_map={};accessor_map={};material_map={}
    original_materials={m['name']:i for i,m in enumerate(doc['materials'])}

    def copy_view(index):
        if index in view_map:return view_map[index]
        view=copy.deepcopy(current_doc['bufferViews'][index])
        if view.get('buffer',0)!=0:raise RuntimeError('Service export must have one embedded binary buffer')
        start=view.get('byteOffset',0);end=start+view['byteLength']
        if end>len(current_binary):raise RuntimeError('Service buffer view exceeds binary data')
        binary.extend(b'\0'*((-len(binary))%4));view['byteOffset']=len(binary)
        binary.extend(current_binary[start:end]);view['buffer']=0
        new=len(doc['bufferViews']);doc['bufferViews'].append(view);view_map[index]=new;return new

    def copy_accessor(index):
        if index in accessor_map:return accessor_map[index]
        a=copy.deepcopy(current_doc['accessors'][index])
        if a.get('sparse'):raise RuntimeError('Sparse service accessors are unsupported')
        a['bufferView']=copy_view(a['bufferView'])
        new=len(doc['accessors']);doc['accessors'].append(a);accessor_map[index]=new;return new

    def copy_material(index):
        if index in material_map:return material_map[index]
        m=current_doc['materials'][index];name=m['name']
        if name in original_materials:
            new=original_materials[name]
        else:
            # Current service-only additions are untextured matte polymers.
            # Existing copper/nickel/elastomer reuse the frozen PBR resources.
            if 'Texture' in json.dumps(m) or m.get('extensions'):
                raise RuntimeError('New service material textures/extensions need an explicit resource mapping')
            new=len(doc['materials']);doc['materials'].append(copy.deepcopy(m))
        material_map[index]=new;return new

    mesh=copy.deepcopy(current_doc['meshes'][io[0]['mesh']])
    for primitive in mesh['primitives']:
        primitive['attributes']={key:copy_accessor(value)for key,value in primitive['attributes'].items()}
        primitive['indices']=copy_accessor(primitive['indices'])
        primitive['material']=copy_material(primitive['material'])
    node=copy.deepcopy(io[0]);node['mesh']=len(doc['meshes']);doc['meshes'].append(mesh)
    node_index=len(doc['nodes']);doc['nodes'].append(node)
    doc['scenes'][doc.get('scene',0)]['nodes'].append(node_index)
    binary.extend(b'\0'*((-len(binary))%4));doc['buffers'][0]['byteLength']=len(binary)
    doc['extras']=copy.deepcopy(current_doc.get('extras',{}))
    evidence={'commit':BASELINE_COMMIT,'sha256':BASELINE_SHA256,'preservedNodes':8,
              'preservedPrimitives':44,'method':'Original core JSON resources and binary accessor/image bytes retained; IO resources appended only'}
    doc['extras']['preservedCore']=evidence
    return doc,bytes(binary),evidence
