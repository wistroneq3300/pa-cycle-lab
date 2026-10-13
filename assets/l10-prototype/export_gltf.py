"""Re-export an edited .blend without rebuilding authored source geometry.
blender --background --python assets/l10-prototype/export_gltf.py
"""
import bpy, json, struct, hashlib
from pathlib import Path
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1]
OUT=ROOT/'app/static/models/l10-prototype';OUT.mkdir(parents=True,exist_ok=True)
L=json.loads((HERE/'layout.json').read_text())
bpy.ops.wm.open_mainfile(filepath=str(HERE/'compute-board-prototype.blend'))
COL={name:bpy.data.collections[name]for name in ['board','packages','cooling-frame','cooling']}
export_col=bpy.data.collections.new('GLB EXPORT BATCHES');bpy.context.scene.collection.children.link(export_col)
exports=[];deps=bpy.context.evaluated_depsgraph_get()

def repair_board_edge_uv(mesh):
    """Give manufactured cut/bevel faces their own non-collapsed UV islands.

    Flat top/bottom preserve the full unique board map. The old inherited planar
    UV on a 25-thou edge could collapse MikkTSpace; do not invent replacement
    tangent vectors in the runtime. Edge faces use FR4, not stretched circuitry.
    """
    uv=mesh.uv_layers.active
    for poly in mesh.polygons:
      if abs(poly.normal.z)>.99999:continue
      poly.material_index=1
      points=[mesh.vertices[mesh.loops[li].vertex_index].co for li in poly.loop_indices]
      ranges=[max(v[i]for v in points)-min(v[i]for v in points)for i in range(3)]
      axes=sorted(range(3),key=lambda i:ranges[i],reverse=True)[:2]
      for li in poly.loop_indices:
        v=mesh.vertices[mesh.loops[li].vertex_index].co
        uv.data[li].uv=tuple((v[i]-min(p[i]for p in points))/max(1e-12,ranges[i])for i in axes)

for layer,col in COL.items():
  groups={}
  for o in list(col.objects):
    key=o.get('component','')if layer in ['packages','cooling']else layer
    groups.setdefault(key,[]).append(o)
  for key,originals in groups.items():
    copies=[]
    for o in originals:
      ev=o.evaluated_get(deps);me=bpy.data.meshes.new_from_object(ev,preserve_all_data_layers=True,depsgraph=deps)
      if o.name.startswith('Primary board'):repair_board_edge_uv(me)
      copy=bpy.data.objects.new(o.name,me);copy.matrix_world=o.matrix_world.copy();export_col.objects.link(copy);copies.append(copy)
    bpy.ops.object.select_all(action='DESELECT')
    for o in copies:o.select_set(True)
    bpy.context.view_layer.objects.active=copies[0];bpy.ops.object.join();joined=copies[0]
    joined.name='L10 prototype / '+layer+(' / '+key if key!=layer else '')
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    tri=joined.modifiers.new('Delivery triangles for tangent space','TRIANGULATE');tri.keep_custom_normals=True
    bpy.ops.object.modifier_apply(modifier=tri.name)
    joined['l10Layer']=layer;joined['component']=key;joined['sourceComponents']=len(originals)
    joined['referenceConfidence']='image-guided exterior; hidden topology is visual approximation'
    joined['approximation']='Original mesh; no OEM CAD, unpublished package floorplan or interior microchannels.'
    joined['coordinateUnits']='Normalized PA raw scene units, NOT glTF SI meters; common runtime scale [.688,1,.802] still applies.'
    joined['contract']='One left board, three integrated packages. Independent visual layers do not imply field serviceability.'
    exports.append(joined)
bpy.ops.object.select_all(action='DESELECT')
for o in exports:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'compute-board.glb'),export_format='GLB',use_selection=True,
 export_apply=True,export_yup=True,export_texcoords=True,export_normals=True,export_tangents=True,
 export_materials='EXPORT',export_extras=True,export_animations=False,export_cameras=False,export_lights=False,
 export_image_format='AUTO',export_draco_mesh_compression_enable=False)
data=(OUT/'compute-board.glb').read_bytes();ln,typ=struct.unpack_from('<II',data,12);doc=json.loads(data[20:20+ln])
# Normal-free materials have no use for a tangent attribute. Omit it rather than
# shipping unused degenerate vectors generated on collapsed physical edge seams.
# Normal-mapped primitives are never repaired or exempted by this export step.
for mesh in doc['meshes']:
 for p in mesh['primitives']:
  if 'normalTexture' not in doc['materials'][p['material']]:p['attributes'].pop('TANGENT',None)
js=json.dumps(doc,separators=(',',':'),ensure_ascii=False).encode('utf-8');js+=b' '*((-len(js))%4)
binchunk=data[20+ln:]
data=struct.pack('<III',0x46546c67,2,20+len(js)+len(binchunk))+struct.pack('<II',len(js),0x4e4f534a)+js+binchunk
(OUT/'compute-board.glb').write_bytes(data)
triangles=sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes']for p in m['primitives'])
manifest={
 'id':L['id'],'file':'compute-board.glb','sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data),
 'generator':bpy.app.version_string,'triangles':triangles,'nodes':len(doc['nodes']),'meshes':len(doc['meshes']),
 'primitives':sum(len(m['primitives'])for m in doc['meshes']),'materials':len(doc['materials']),'embeddedImages':len(doc.get('images',[])),
 'source':'assets/l10-prototype/compute-board-prototype.blend','build':'assets/l10-prototype/build.py',
 'export':'assets/l10-prototype/export_gltf.py','layers':['board','packages','cooling-frame','cooling'],
 'units':'Normalized PA raw scene units, NOT glTF SI meters; renderer common [.688,1,.802] editorial transform remains required.',
 'contact':L['contact'],'references':['https://pubs.lenovo.com/gb300-nvl72/zh-TW/compute_tray_top_view','https://lenovopress.lenovo.com/lp2357-lenovo-nvidia-gb300-nvl72-rack-scale-ai'],
 'approximation':L['approximation'],'assetApproval':'PROTOTYPE / NOT PHOTOREALISM ACCEPTED',
 'textureMethod':'Original deterministic UV-mapped fabrication appearance; not photo scans, vendor textures or random scatter',
 'limitations':['No measured PBR material data','No uncovered official package/PCB view','Legacy local coolant port anchors retained; no OEM hydraulic reconstruction'],
 'extensionsUsed':doc.get('extensionsUsed',[]),'extensionsRequired':doc.get('extensionsRequired',[])
}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('L10_PROTOTYPE_RESULT '+json.dumps(manifest))
