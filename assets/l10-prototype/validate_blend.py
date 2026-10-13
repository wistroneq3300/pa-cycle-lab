"""Source geometry checks independent of the WebGL loader.
blender --background --python assets/l10-prototype/validate_blend.py
"""
import bpy,bmesh,json,math
from mathutils import Vector
from pathlib import Path
HERE=Path(__file__).resolve().parent
layout=json.loads((HERE/'layout.json').read_text())
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
service={}
if layout.get('serviceGeometry'):
 s=layout['serviceGeometry'];fan_frames=0;open_rays=0;visible_latches=0;seated_rotors=0
 for i,(x,y,z) in enumerate(s['fanCenters'],1):
  owned=[o for o in bpy.data.objects if o.type=='MESH' and o.get('component')=='fan-cartridge-'+str(i)]
  if not owned:errors.append('missing fan cartridge '+str(i));continue
  for o in owned:
   ev=o.evaluated_get(deps);me=ev.to_mesh()
   for v in me.vertices:
    p=o.matrix_world@v.co;raw=(p.x,p.z,-p.y)
    if any(abs(raw[a]-[x,y,z][a])>s['fanEnvelope'][a]/2+1e-6 for a in range(3)):
     errors.append(o.name+': fan envelope exceeded');break
   ev.to_mesh_clear()
  for side,label in [(1,'front'),(-1,'rear')]:
   frame=bpy.data.objects['Fan '+str(i)+' '+label+' open frame'];fan_frames+=1
   # Direct geometry ray through the aperture. This would hit an applied disc
   # or a solid box face at the old opening position.
   origin=Vector((x+.050/.688,-(z+side*.245),y+.010))
   direction=Vector((0,side,0))
   hit=frame.ray_cast(origin,direction,distance=.035)[0]
   if hit:errors.append(frame.name+': axial opening blocked')
   else:open_rays+=1
  duct=bpy.data.objects['Fan '+str(i)+' hollow axial duct']
  if duct.ray_cast(Vector((x+.050/.688,-(z+.245),y+.010)),Vector((0,1,0)),distance=.490)[0]:errors.append(duct.name+': axial bore is capped')
  latch_ray=bpy.context.scene.ray_cast(deps,Vector((x+.075,-(z+.128),.120)),Vector((0,0,-1)),distance=.060)
  if not latch_ray[0] or latch_ray[4].name!='Fan '+str(i)+' recessed top latch':errors.append('Fan '+str(i)+': top cover obscures latch')
  else:visible_latches+=1
  hub=bpy.data.objects['Fan '+str(i)+' internal motor hub']
  radial=[math.hypot(((hub.matrix_world@v.co).x-x)*.688,(hub.matrix_world@v.co).z-y)for v in hub.data.vertices]
  if min(radial)<s['bladeRootRadiusWorld']+1e-4:errors.append('Fan '+str(i)+': rotor blades do not meet hub around full circumference')
  else:seated_rotors+=1
 # Full sampled conductor paths must stay clear of the existing power chips,
 # CMOS and crossover; rear boot and terminal must meet their retained anchors.
 r=s['cableRadius'];cable_samples=0
 for path in s['cablePaths']:
  for x,y,z in path:
   cable_samples+=1
   if y+r>=s['coolingCrossoverMinY']:errors.append('cable enters cooling crossover clearance')
   if z<.6 and abs(x)+r>.065:errors.append('cable leaves compute-board corridor')
   if math.hypot(x+.30,z-.97)<.071+r and -.050-r<y<-.004+r:errors.append('cable enters CMOS')
   for k in range(7):
    if abs(x-(.14+k*.061))<.0215+r and .71-r<z<1.07+r and -.0065-r<y<.0185+r:errors.append('cable enters PDB power chip')
 terminal=bounds['PDB cable terminal housing']
 if abs(terminal[0]+.0055)>1e-6:errors.append('PDB terminal does not meet existing board top')
 boot=bpy.data.objects['Rear busbar socket cable boot']
 boot_rear=min(-(boot.matrix_world@v.co).y for v in boot.data.vertices)
 if abs(boot_rear-s['rearSocketInnerZ'])>1e-6:errors.append('rear cable boot fails to reach socket')
 service={'fanCount':len(s['fanCenters']),'openFrames':fan_frames,'openApertureRays':open_rays,'unobstructedDucts':len(s['fanCenters']),'visibleRecessedLatches':visible_latches,'seatedRotors':seated_rotors,'cableCount':len(s['cablePaths']),'clearanceSamples':cable_samples,'rearSocketContact':boot_rear,'pdbTerminalBottom':terminal[0]}
report={'sourceObjects':len(objects),'assembledMinY':min_height,'assembledMaxY':max_height,'contactPlanesVerified':3,'contactInterfacesVerified':contacts,'pcbMetalMaskLinked':principled.inputs['Metallic'].is_linked,'serviceGeometry':service,'errors':errors}
print('L10_SOURCE_VALIDATION '+json.dumps(report))
if errors:raise RuntimeError('Source validation failed')
