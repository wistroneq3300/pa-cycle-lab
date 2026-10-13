"""Source geometry checks independent of the WebGL loader.
blender --background --python assets/l10-prototype/validate_blend.py
"""
import bpy,bmesh,json
from pathlib import Path
HERE=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(HERE/'compute-board-prototype.blend'))
errors=[];objects=[];bounds={};max_height=-1e6;min_height=1e6
deps=bpy.context.evaluated_depsgraph_get()
for o in bpy.data.objects:
 if o.type!='MESH':continue
 bm=bmesh.new();bm.from_mesh(o.data)
 volume=bm.calc_volume(signed=True)
 if volume < -1e-13:errors.append(o.name+': inward surface winding')
 if any(not e.is_manifold for e in bm.edges):errors.append(o.name+': non-manifold source edge')
 bm.free()
 ev=o.evaluated_get(deps);mesh=ev.to_mesh()
 ys=[(o.matrix_world@v.co).z for v in mesh.vertices]
 min_height=min(min_height,min(ys));max_height=max(max_height,max(ys))
 bounds[o.name]=(min(ys),max(ys))
 if o.name.endswith('lapped contact surface') and abs(max(ys)-.006)>1e-6:errors.append(o.name+': changed package contact plane')
 if o.name.endswith('compliant TIM') and (abs(min(ys)-.006)>1e-6 or abs(max(ys)-.0068)>1e-6):errors.append(o.name+': TIM contact gap')
 if o.name.endswith('copper contact foot') and (abs(min(ys)-.0068)>1e-6 or abs(max(ys)-.0355)>1e-6):errors.append(o.name+': copper contact gap')
 ev.to_mesh_clear();objects.append(o.name)
if max_height>.13:errors.append('assembled asset pierces existing lid envelope')
contacts=0
for ident in ['CPU','GPU_A','GPU_B']:
 chain=['bonded footprint','bonded underfill','organic substrate','spreader shoulder','lapped contact surface','compliant TIM','copper contact foot','thin exterior surface pattern', 'U-arm copper cover' if ident=='CPU' else 'narrow stepped copper cover']
 for a,b in zip(chain,chain[1:]):
  top=bounds[ident+' '+a][1];bottom=bounds[ident+' '+b][0]
  if abs(top-bottom)>1e-6:errors.append(ident+': contact discontinuity '+a+' -> '+b)
  contacts+=1
pcb=bpy.data.materials['PCB soldermask'];principled=pcb.node_tree.nodes.get('Principled BSDF')
if not principled.inputs['Metallic'].is_linked:errors.append('PCB authored metal pad mask is disconnected')
if any('external fin' in name.lower() or 'corrugated' in name.lower()for name in objects):errors.append('Unsupported Phase 4 fin interpretation remains')
report={'sourceObjects':len(objects),'assembledMinY':min_height,'assembledMaxY':max_height,'contactPlanesVerified':3,'contactInterfacesVerified':contacts,'pcbMetalMaskLinked':principled.inputs['Metallic'].is_linked,'errors':errors}
print('L10_SOURCE_VALIDATION '+json.dumps(report))
if errors:raise RuntimeError('Source validation failed')
