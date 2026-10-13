"""Original low-profile cooling companion for the frozen L10 bare asset.

Run with Blender 4.5 LTS --background --factory-startup --python this-file.
This source reads, but never opens/saves/modifies, the accepted bare assets.
Coordinates are PA raw display units, not CAD dimensions or SI metres.
"""
import bpy, bmesh, ast, json, math, struct, hashlib, tempfile, os
from pathlib import Path
from mathutils import Vector
import numpy as np

HERE=Path(__file__).resolve().parent; ROOT=HERE.parents[1]
OUT=ROOT/'app/static/models/l10-cooling-v1'; OUT.mkdir(parents=True,exist_ok=True)
BARE=ROOT/'app/static/models/l10-prototype/bare-compute-boards.glb'
EXPECTED='6c78c6d9d62415de8e5888986bc5b2cd95d5a4a30d147b861f10ecc4650ecc29'
raw=BARE.read_bytes(); baseline_hash=hashlib.sha256(raw).hexdigest()
assert baseline_hash==EXPECTED,'Cooling seats require the approved immutable bare GLB'
ln=struct.unpack_from('<I',raw,12)[0]; bare=json.loads(raw[20:20+ln]); binary=raw[28+ln:]
def accessor(i):
    a=bare['accessors'][i];v=bare['bufferViews'][a['bufferView']]
    assert a['componentType']==5126 and a['type']=='VEC3'
    return np.ndarray((a['count'],3),dtype='<f4',buffer=binary,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',12),4)).astype(float)
seats=[]
aliases={'Board1/CPU':'CPU-L','Board1/GPU_A':'GPU-L-OUTER','Board1/GPU_B':'GPU-L-INNER','Board2/CPU':'CPU-R','Board2/GPU_A':'GPU-R-INNER','Board2/GPU_B':'GPU-R-OUTER'}
for n in bare['nodes']:
    component=n.get('extras',{}).get('component')
    if component not in aliases:continue
    assert not any(k in n for k in ['matrix','translation','rotation','scale'])
    pts=[]
    for p in bare['meshes'][n['mesh']]['primitives']:
        if 'exposed optical face' in bare['materials'][p['material']]['name']:pts.extend(accessor(p['attributes']['POSITION']))
    pts=np.array(pts); lo=pts.min(axis=0);hi=pts.max(axis=0);c=(lo+hi)/2
    assert hi[1]-lo[1]<1e-7
    seats.append({'id':aliases[component],'sourceComponent':component,'kind':'CPU' if '/CPU' in component else 'GPU','center':c.tolist(),'opticalMin':lo.tolist(),'opticalMax':hi.tolist(),'opticalY':float(hi[1]),'boardIndex':n['extras']['boardIndex']})
assert len(seats)==6

bpy.context.preferences.filepaths.save_version=0
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene['assetId']='l10-cooling-assembly-v1';scene['sourceBareGLBSHA256']=baseline_hash
scene['approximation']='Original conceptual liquid circuit and frame-supported clamping; no OEM CAD, hydraulic/thermal/pressure or serviceability validation.'
LAYERS=['cooling-mounts','cooling-frame','cooling','cooling-channels','cooling-plumbing','cooling-fluid']
COL={};M={};L={'board':{'x':0,'z':0,'width':1,'depth':1}}
for layer in LAYERS:
    c=bpy.data.collections.new(layer);scene.collection.children.link(c);COL[layer]=c
# Reuse reviewed pure geometry helpers only. Importing the legacy module would
# execute its destructive top-level builder; AST extraction deliberately does not.
legacy=ROOT/'assets/l10-prototype/build.py'
tree=ast.parse(legacy.read_text()); names={'coord','tag','smooth_bevel','uv_project','cube','polyprism','cylinder','screw','rounded_path'}
functions=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in names]
assert {n.name for n in functions}==names
exec(compile(ast.Module(body=functions,type_ignores=[]),str(legacy),'exec'))
def material(name,color,metal,rough):
    m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*color,1)
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough;p.inputs['Specular IOR Level'].default_value=.5
    m['authorship']='Original engineering visualization finish; not measured BRDF';M[name]=m;return m
material('Machined copper',(.56,.265,.13),1,.34)
material('Brushed nickel',(.46,.49,.49),1,.60)
material('CPU satin nickel cover',(.43,.46,.47),1,.46)
material('GPU machined nickel cover',(.43,.46,.47),1,.355)
material('Machined nickel fittings',(.44,.47,.48),1,.315)
material('Dark nickel fastener',(.115,.13,.14),.91,.36)
material('Recess oxide',(.012,.016,.018),.38,.59)
material('Anodized retention',(.024,.027,.029),.75,.47)
material('TIM',(.19,.20,.19),0,.78)
material('Coolant water tracer',(.035,.29,.34),.13,.23)
material('Elastomer hose',(.019,.022,.025),0,.65)
material('Gasket',(.011,.014,.015),0,.82)
# Fine authored fabrication finishes; no photo scan, random scratches, or broad
# decorative striping. Covers retain their existing geometry and reflectance
# hierarchy, with a finer finished perimeter around the manufactured edge.
TEX=HERE/'textures';TEX.mkdir(exist_ok=True)
y,x=np.mgrid[0:256,0:256];u=(x+.5)/256;v=(y+.5)/256
micro=.50*np.sin(x*2.19+y*.071)+.28*np.sin(x*.713-y*1.173)+.22*np.cos(x*1.671+y*2.031)
# The cross-lapped/satin finishes have no periodic machining feed. A fixed
# PCG64 field, gently filtered in both axes, provides repeatable subpixel
# roughness without the visible interference dots of crossed sine waves.
rng=np.random.Generator(np.random.PCG64(20261013))
def satin_micro():
    field=rng.standard_normal((256,256))
    for _ in range(2):
        for axis in (0,1):
            field=(np.roll(field,1,axis)+2*field+np.roll(field,-1,axis))/4
    return np.clip((field-field.mean())/field.std(),-2,2)
nickel_micro=satin_micro();cpu_micro=satin_micro()
edge=np.clip((np.minimum.reduce([u,1-u,v,1-v])-.010)/.032,0,1)
finishes=[
    ('Machined copper','cooling-machined-metal-mr',.34+.012*micro+.010*np.sin(x*1.417+y*.017)),
    ('Brushed nickel','cooling-satin-nickel-mr',.60+.006*nickel_micro),
    ('CPU satin nickel cover','cooling-cpu-cover-mr',.33*(1-edge)+edge*(.46+.006*cpu_micro)),
    ('GPU machined nickel cover','cooling-gpu-cover-mr',.29*(1-edge)+edge*(.355+.013*micro+.014*np.sin(x*1.693+y*.011)))
]
for name,image_name,rough in finishes:
    rgba=np.ones((256,256,4),dtype=np.float32);rgba[:,:,1]=np.clip(rough,.27,.65)
    img=bpy.data.images.new(image_name,width=256,height=256,alpha=True);img.colorspace_settings.name='Non-Color';img.pixels.foreach_set(rgba.ravel());img.filepath_raw=str(TEX/(image_name+'.png'));img.file_format='PNG';img.save();img.pack()
    m=M[name];m['finishProcess']='Cross-lapped satin face' if name.startswith('CPU') else 'Fine longitudinal milling' if name.startswith('GPU') else 'Fine machined copper' if name=='Machined copper' else 'Satin finished nickel tube'
    p=m.node_tree.nodes.get('Principled BSDF');tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=img;sep=m.node_tree.nodes.new('ShaderNodeSeparateColor');m.node_tree.links.new(tex.outputs['Color'],sep.inputs['Color']);m.node_tree.links.new(sep.outputs['Green'],p.inputs['Roughness']);m.node_tree.links.new(sep.outputs['Blue'],p.inputs['Metallic'])

fastener_recesses=[]
def recessed_fastener(name,layer,component,x,y,z,r,h,depth,removed_slug=None):
    """Carve a real internal hex drive; retain the reviewed exterior head."""
    head=cylinder(name,layer,component,x,y,z,r,h,'Dark nickel fastener',20)
    bpy.ops.object.select_all(action='DESELECT');head.select_set(True);bpy.context.view_layer.objects.active=head
    # Evaluate the pre-existing bevel/weighted normal stack before removing
    # only the drive volume. No contact plane or outer fastener face moves.
    for mod in list(head.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
    top=y+h/2;drive_r=r*.40;floor=top-depth
    bpy.ops.mesh.primitive_cylinder_add(vertices=6,radius=drive_r,depth=depth+.002,location=coord(x,floor+(depth+.002)/2,z))
    cutter=bpy.context.object;cutter.name=name+' temporary hex cutter'
    cutter.select_set(False);head.select_set(True);bpy.context.view_layer.objects.active=head
    mod=head.modifiers.new('Functional recessed hex drive','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter
    bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
    head.data.materials.append(M['Recess oxide']);head.data.update()
    for face in head.data.polygons:
        c=head.matrix_world@face.center
        if math.hypot(c.x-x,-c.y-z)<drive_r*1.015 and c.z<top-.00002:face.material_index=1
    head['functionalDetail']='Recessed hex drive, confined to original head bounds'
    fastener_recesses.append({'id':name,'layer':layer,'component':component,'center':[x,y,z],'radius':r,'minY':y-h/2,'maxY':top,'recessRadius':drive_r,'recessFloorY':floor,'recessDepth':depth,'removedV1Slug':removed_slug})
    return head

def pipe(name,layer,component,points,r,mat,offset=0,sides=12,inner=0):
    """Annular physical shell, or closed stream core; raw arc U and section V."""
    P=[Vector(p)for p in points]; arc=[0.]
    for a,b in zip(P,P[1:]):arc.append(arc[-1]+(b-a).length)
    verts=[]
    for i,p in enumerate(P):
        tangent=(P[min(i+1,len(P)-1)]-P[max(0,i-1)]).normalized();guide=Vector((0,1,0)) if abs(tangent.y)<.95 else Vector((1,0,0));u=tangent.cross(guide).normalized();v=tangent.cross(u).normalized()
        for radius in ([r,inner] if inner else [r]):
            for j in range(sides):verts.append(coord(*(p+radius*(u*math.cos(j*math.tau/sides)+v*math.sin(j*math.tau/sides)))))
    rings=2 if inner else 1;stride=sides*rings;faces=[]
    for i in range(len(P)-1):
      for ring in range(rings):
        for j in range(sides):
            a=i*stride+ring*sides;b=(i+1)*stride+ring*sides;k=(j+1)%sides
            face=(a+j,a+k,b+k,b+j);faces.append(face if ring==0 else tuple(reversed(face)))
    if inner:
      for i in [0,len(P)-1]:
        a=i*stride
        for j in range(sides):
            k=(j+1)%sides;face=(a+j,a+sides+j,a+sides+k,a+k);faces.append(face if i==0 else tuple(reversed(face)))
    else:
      faces.extend([tuple(range(sides-1,-1,-1)),tuple(range((len(P)-1)*sides,len(P)*sides))])
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
    o=bpy.data.objects.new(name,me);COL[layer].objects.link(o);tag(o,layer,component);me.materials.append(M[mat]);uv=me.uv_layers.new(name='UVMap')
    wall_faces=(len(P)-1)*rings*sides
    for poly in me.polygons:
        # Preserve the accepted stream core/UV contract. Physical shells need
        # a split at their planar annular ends and a real UV wrap boundary.
        poly.use_smooth=len(poly.vertices)==4 if layer=='cooling-fluid' else poly.index<wall_faces
        seam=layer!='cooling-fluid' and poly.index<wall_faces and poly.index%sides==sides-1
        for li in poly.loop_indices:
            vi=me.loops[li].vertex_index;j=vi%sides
            uv.data[li].uv=(offset+arc[vi//stride],1 if seam and j==0 else j/sides)
    o['routeId']=name;o['flowArcLength']=arc[-1];o['flowDirection']='positive U = inlet to outlet';o['boreRadius']=inner;return o,arc

def manufactured_header_normals(obj,yy,zz):
    """Restore analytic lathe normals after all six real branch booleans.

    A smoothed two-ring tube averages its end caps across its entire length;
    the booleans additionally average port walls into the long outer faces.
    Weighted normals do not recover a cylinder from those long thin faces.
    Split loop normals keep true radial exterior/bore shading, while actual
    planar end faces and machined port walls retain their own face normals.
    """
    me=obj.data;me.update();normals=[None]*len(me.loops);uv=me.uv_layers.active
    for face in me.polygons:
        c=face.center;radial=Vector((0,c.y+zz,c.z-yy));radius=radial.length
        alignment=face.normal.dot(radial.normalized()) if radius else 0
        outer=radius>.0165 and alignment>.98 and abs(face.normal.x)<1e-4
        inner=radius<.0122 and alignment<-.98 and abs(face.normal.x)<1e-4
        cylinder_face=outer or inner;face.use_smooth=cylinder_face
        # Boolean-interpolated UVs preserve the axial mapping but may bridge
        # the wrap. Reconstruct only true cylinder faces from their angle.
        values=[]
        for li in face.loop_indices:
            p=me.vertices[me.loops[li].vertex_index].co
            n=Vector((0,p.y+zz,p.z-yy)).normalized()
            normals[li]=n if outer else -n if inner else face.normal.copy()
            if cylinder_face:values.append((li,(math.atan2(-(p.z-yy),-(p.y+zz))/math.tau)%1))
        if values:
            wrap=max(v for _,v in values)-min(v for _,v in values)>.5
            for li,v in values:
                p=me.vertices[me.loops[li].vertex_index].co
                uv.data[li].uv=(p.x+1.78,v+1 if wrap and v<.5 else v)
    me.normals_split_custom_set(normals)
    obj['normalPolicy']='Analytic radial outer/bore loop normals after booleans; flat end/port faces'
    obj['uvPolicy']='Axial distance U; wrapped cylindrical V with explicit per-loop seam'

def port_ferrule(name,component,x,y,start,end):
    """Stepped compression sleeve inside the original 0.020-radius envelope."""
    profile=[(start,.0188),(start+.0012,.020),(start+.009,.020),
             (start+.0102,.0186),(end-.010,.0186),(end-.0088,.020),
             (end-.0012,.020),(end,.0188)]
    sides=48;inner=.0145;verts=[];faces=[]
    for z,r in profile:
        for radius in (r,inner):
            verts.extend(coord(x+radius*math.cos(j*math.tau/sides),y+radius*math.sin(j*math.tau/sides),z) for j in range(sides))
    for i in range(len(profile)-1):
        for ring in (0,1):
            for j in range(sides):
                k=(j+1)%sides;a=i*2*sides+ring*sides;b=(i+1)*2*sides+ring*sides
                f=(a+j,a+k,b+k,b+j);faces.append(f if ring==0 else tuple(reversed(f)))
    for i in (0,len(profile)-1):
        a=i*2*sides
        for j in range(sides):
            k=(j+1)%sides;f=(a+j,a+sides+j,a+sides+k,a+k);faces.append(f if i==0 else tuple(reversed(f)))
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update()
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
    obj=bpy.data.objects.new(name,me);COL['cooling-frame'].objects.link(obj);tag(obj,'cooling-frame',component);me.materials.append(M['Machined nickel fittings'])
    uv=me.uv_layers.new(name='UVMap');normals=[None]*len(me.loops)
    for f in me.polygons:
        longitudinal=f.index<(len(profile)-1)*2*sides
        segment=f.index//(2*sides);ring=(f.index//sides)%2
        cylindrical=longitudinal and (ring==1 or abs(profile[segment][1]-profile[segment+1][1])<1e-8)
        f.use_smooth=cylindrical
        for li in f.loop_indices:
            p=me.vertices[me.loops[li].vertex_index].co;n=Vector((p.x-x,0,p.z-y)).normalized()
            normals[li]=(-n if ring==1 else n) if cylindrical else f.normal.copy()
            vi=me.loops[li].vertex_index;j=vi%sides
            uv.data[li].uv=((-p.y-start)/(end-start),1 if longitudinal and f.index%sides==sides-1 and j==0 else j/sides)
    me.normals_split_custom_set(normals)
    obj['functionalDetail']='Compression ferrule shoulders, chamfered lips, retained open bore and original collar envelope'
    # Visible elastomer sealing band occupies the machined sleeve groove.
    pipe(name+' captured seal','cooling-frame',component,[[x,y,start+.011],[x,y,start+.014]],.0192,'Gasket',sides=48,inner=.0186)
    return obj

def bore_junction(header,point,direction,radius):
    """Open a real branch passage through an annular manifold wall."""
    # Start inside the existing bore and cut only the branch-facing wall.
    # A symmetric cutter would also create an unintended opposite-side leak.
    p=Vector(point);v=Vector(direction).normalized();a=list(p);b=list(p+v*.050)
    cutter,_=pipe('Temporary branch bore','cooling-plumbing','temporary',[a,b],radius,'Gasket',sides=20)
    bpy.ops.object.select_all(action='DESELECT');header.select_set(True);bpy.context.view_layer.objects.active=header
    mod=header.modifiers.new('Actual open branch port','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter
    bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)

def trim_branch_sleeve(branch,header_points):
    """Keep a branch sleeve from obstructing the shared manifold bore."""
    cutter,_=pipe('Temporary shared manifold bore','cooling-plumbing','temporary',header_points,.01215,'Gasket',sides=32)
    bpy.ops.object.select_all(action='DESELECT');branch.select_set(True);bpy.context.view_layer.objects.active=branch
    mod=branch.modifiers.new('Unobstructed shared manifold bore','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter
    bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)

def path(points,radius=.045):return rounded_path(points,radius,7)
routes=[];mounts=[]
def route(ident,semantic,pts,r,offset=0,from_id=None,to_id=None):
    _,arc=pipe(ident,'cooling-fluid',ident,pts,r,'Coolant water tracer',offset)
    item={'id':ident,'semantic':semantic,'points':pts,'arcLengths':arc,'length':arc[-1],'radius':r,'uvOffset':offset,'from':from_id,'to':to_id};routes.append(item);return item

# Two compact manifolds occupy the unobstructed bay between compute and fans.
SUPPLY_Z=-.43;RETURN_Z=-.33;SUPPLY_Y=.066;RETURN_Y=.100
supply_main=path([[-1.84,.036,-3.055],[-1.84,.036,-2.985],[-1.87,.066,-2.84],[-1.87,.066,SUPPLY_Z],[-1.78,.066,SUPPLY_Z]])
return_main=path([[1.78,.100,RETURN_Z],[1.87,.100,RETURN_Z],[1.87,.100,-2.84],[1.84,.036,-2.985],[1.84,.036,-3.055]])
pipe('Rear supply line','cooling-plumbing','supply',supply_main,.017,'Elastomer hose',inner=.012)
pipe('Rear return line','cooling-plumbing','return',return_main,.017,'Elastomer hose',inner=.012)
rs=route('supply-trunk','supply',supply_main,.0105,0,'supply-qd','supply-header')
header_s=[[-1.78,SUPPLY_Y,SUPPLY_Z],[1.78,SUPPLY_Y,SUPPLY_Z]]
header_r=[[-1.78,RETURN_Y,RETURN_Z],[1.78,RETURN_Y,RETURN_Z]]
manifold_s,_=pipe('Supply distribution manifold','cooling-plumbing','supply',header_s,.017,'Brushed nickel',sides=64,inner=.012)
manifold_r,_=pipe('Return collection manifold','cooling-plumbing','return',header_r,.017,'Brushed nickel',sides=64,inner=.012)
# Close the unused end of each header. The short hollow extension keeps the
# stream-core endpoint clear of the blind plug; external QDs remain open.
for side,yy,zz,semantic in [(1,SUPPLY_Y,SUPPLY_Z,'supply'),(-1,RETURN_Y,RETURN_Z,'return')]:
    pipe(semantic+' header blind-end sleeve','cooling-plumbing',semantic,[[side*1.78,yy,zz],[side*1.786,yy,zz]],.017,'Brushed nickel',sides=64,inner=.012)
    pipe(semantic+' header sealed blind plug','cooling-plumbing',semantic,[[side*1.786,yy,zz],[side*1.792,yy,zz]],.017,'Brushed nickel',sides=64)
route('supply-header','supply',header_s,.0105,rs['length'],'supply-trunk','six-plate-inlets')
route('return-header','return',header_r,.0105,0,'six-plate-outlets','return-trunk')
route('return-trunk','return',return_main,.0105,3.56,'return-header','return-qd')
# Rear connectors remain inside the legacy rear projection and avoid IO cages.
for x,semantic in [(-1.84,'supply'),(1.84,'return')]:
    pp=[[x,.036,-3.10],[x,.036,-3.015]]
    pipe(semantic+' rear QD body','cooling-plumbing',semantic,pp,.034,'Brushed nickel',sides=24,inner=.019)
    pipe(semantic+' rear QD collar','cooling-plumbing',semantic,[[x,.036,-3.067],[x,.036,-3.039]],.041,'Anodized retention',sides=24,inner=.034)

for seat in seats:
    sid=seat['id'];x,die_y,z=seat['center'];cpu=seat['kind']=='CPU';w=.548 if cpu else .558;d=.550 if cpu else .598
    dw=seat['opticalMax'][0]-seat['opticalMin'][0];dd=seat['opticalMax'][2]-seat['opticalMin'][2]
    tim_top=die_y+.0008
    cube(sid+' exact-die TIM','cooling-frame',sid,x,(die_y+tim_top)/2,z,dw,.0008,dd,'TIM',0)
    cube(sid+' stepped copper contact pedestal','cooling-frame',sid,x,(tim_top+.022)/2,z,dw,.022-tim_top,dd,'Machined copper',0)
    cube(sid+' machined copper cavity floor','cooling-frame',sid,x,.025,z,w,.006,d,'Machined copper',.0013)
    # Continuous outer wall; the front wall is split at both hydraulic ports.
    wall=.018;bottom=.028;top=.064;port_dx=.190
    for side in [-1,1]:cube(sid+' sealed side wall','cooling-frame',sid,x+side*(w-wall)/2,(bottom+top)/2,z,wall,top-bottom,d,'Machined copper',.001)
    cube(sid+' sealed rear wall','cooling-frame',sid,x,(bottom+top)/2,z-(d-wall)/2,w-2*wall,top-bottom,wall,'Machined copper',.001)
    # Low/high lintels plus three front piers leave two actual flow openings.
    front=z+(d-wall)/2
    for yy,hh in [(.031,.006),(.060,.008)]:cube(sid+' port wall lintel','cooling-frame',sid,x,yy,front,w-2*wall,hh,wall,'Machined copper',.0005)
    limits=[(-w/2+wall,-port_dx-.016),(-port_dx+.016,port_dx-.016),(port_dx+.016,w/2-wall)]
    for a,b in limits:cube(sid+' port wall pier','cooling-frame',sid,x+(a+b)/2,.045,front,b-a,.022,wall,'Machined copper',.0005)
    # Six continuous serpentine passes; this original channel design is a
    # visual engineering concept, not an asserted OEM concealed channel map.
    lane=np.linspace(-port_dx,port_dx,6);end=d/2-.055;fluid_y=.045
    channel=[[x-port_dx,fluid_y,z+d/2+.026],[x-port_dx,fluid_y,z+end]]
    for i,xx in enumerate(lane):
        target=-end if i%2==0 else end;channel.append([x+float(xx),fluid_y,z+target])
        if i<5:channel.append([x+float(lane[i+1]),fluid_y,z+target])
    channel.extend([[x+port_dx,fluid_y,z+d/2+.026]])
    channel=path(channel,.025)
    for i in range(5):
        # Divider terminates short of its U-turn at alternating ends.
        gap=.059;length=2*end-gap;shift=gap/2 if i%2==0 else -gap/2
        cube(sid+' microchannel divider '+str(i+1),'cooling-channels',sid,x+float((lane[i]+lane[i+1])/2),.046,z+shift,.032,.036,length,'Machined copper',.001)
    cover=cube(sid+' sealed nickel cover','cooling',sid,x,.0685,z,w,.009,d,'CPU satin nickel cover' if cpu else 'GPU machined nickel cover',.0018)
    # Preserve every cover plane and envelope, refining only the tiny edge
    # break: five facets resolve a continuous manufactured highlight.
    cover.modifiers['Physical edge break'].width=.0022
    cover.modifiers['Physical edge break'].segments=5
    # Compressible dark gasket follows the perimeter between rim and cover.
    for side in [-1,1]:
        cube(sid+' cover gasket side','cooling-frame',sid,x+side*(w-.011)/2,.064,z,.006,.001,d-.010,'Gasket',.0001)
        cube(sid+' cover gasket end','cooling-frame',sid,x,.064,z+side*(d-.011)/2,w-.020,.001,.006,'Gasket',.0001)
    # Four feet contact existing metal frame, avoiding invented PCB holes.
    frame_w=.605 if cpu else .603;frame_d=.605 if cpu else .645;border=.022 if cpu else .017
    fx=(frame_w-border)/2;fz=frame_d/2-.045
    for sx in [-1,1]:
      for sz in [-1,1]:
        mx=x+sx*fx;mz=z+sz*fz;mid=f'{sid}/foot/{sx}/{sz}'
        cube(mid,'cooling-mounts',sid,mx,.013,mz,.012,.018,.025,'Anodized retention',0)
        cube(mid+' clamp ear','cooling-frame',sid,x+sx*(w/2+.008),.026,mz,.044,.008,.052,'Machined copper',.001)
        cylinder(mid+' preload washer','cooling-frame',sid,mx,.031,mz,.012,.002,'Brushed nickel',24,inner=.005)
        recessed_fastener(mid+' captive fastener','cooling-frame',sid,mx,.037,mz,.0085,.010,.002,
            {'name':mid+' recessed drive','center':[mx,.0421,mz],'radius':.004,'minY':.042,'maxY':.0422})
        mounts.append({'id':mid,'seatId':sid,'min':[mx-.006,.004,mz-.0125],'max':[mx+.006,.022,mz+.0125],'contactMaterial':'CPU nickel frame' if cpu else 'Gold plated frame','contactType':'existing package frame top; generic conceptual clamp, no PCB bore'})
    for sx in [-1,1]:
      for sz in [-1,1]:
        recessed_fastener(sid+f' cover screw {sx} {sz}','cooling',sid,x+sx*(w/2-.041),.0744,z+sz*(d/2-.039),.008,.0028,.0011)
    inlet=channel[0];outlet=channel[-1]
    # Separate radial fittings seat at real openings and enclose fluid endpoints.
    for label,p in [('inlet',inlet),('outlet',outlet)]:
        port_ferrule(sid+' '+label+' port collar',sid,p[0],p[1],z+d/2-.012,p[2]+.008)
    # Hoses rise forward of each coldplate then clear every closed cover.
    inlet_pts=path([[inlet[0],SUPPLY_Y,SUPPLY_Z],[inlet[0],.100,-.56],[inlet[0],.100,inlet[2]+.16],[inlet[0],inlet[1],inlet[2]+.05],inlet],.048)
    outlet_pts=path([outlet,[outlet[0],outlet[1],outlet[2]+.05],[outlet[0],.100,outlet[2]+.16],[outlet[0],.100,RETURN_Z]],.048)
    inlet_hose,_=pipe(sid+' supply hose','cooling-plumbing',sid,inlet_pts,.0135,'Elastomer hose',inner=.0105)
    outlet_hose,_=pipe(sid+' return hose','cooling-plumbing',sid,outlet_pts,.0135,'Elastomer hose',inner=.0105)
    bore_junction(manifold_s,inlet_pts[0],Vector(inlet_pts[1])-Vector(inlet_pts[0]),.0108)
    bore_junction(manifold_r,outlet_pts[-1],Vector(outlet_pts[-2])-Vector(outlet_pts[-1]),.0108)
    trim_branch_sleeve(inlet_hose,header_s)
    trim_branch_sleeve(outlet_hose,header_r)
    offset=rs['length']+(inlet[0]+1.78)
    rin=route(sid+'/inlet','supply',inlet_pts,.0068,offset,'supply-header',sid+'/channels')
    rchannel=route(sid+'/channels','plate-channel',channel,.009,offset+rin['length'],sid+'/inlet',sid+'/outlet')
    rout=route(sid+'/outlet','return',outlet_pts,.0068,offset+rin['length']+rchannel['length'],sid+'/channels','return-header')
    seat.update({'plateWidth':w,'plateDepth':d,'timBottom':die_y,'timTop':tim_top,'copperContactBottom':tim_top,'copperContactTop':.022,'bodyBottom':.022,'coverBottom':.064,'coverTop':.073,'mountFootY':.004,'inlet':inlet,'outlet':outlet,'routeIds':[rin['id'],rchannel['id'],rout['id']]})

manufactured_header_normals(manifold_s,SUPPLY_Y,SUPPLY_Z)
manufactured_header_normals(manifold_r,RETURN_Y,RETURN_Z)
metadata={'id':'l10-cooling-assembly-v1','revision':1,'sourceBareGLBSHA256':baseline_hash,'seats':seats,'mounts':mounts,'flowRoutes':routes,'layers':LAYERS,'coordinateUnits':'PA raw normalized tray coordinates; apply shared [.688,1,.802] once','approximation':scene['approximation'],'flowInterpretation':'Original six parallel serpentine circuits. Fluid meshes visualize stream cores within sealed passages; no CFD, pressure, thermal or real coolant claim. Shared return header is a mixing volume with local arc phase; branch transport distances remain physical.','envelope':{'lidUndersideY':.125,'maxExpectedY':.117,'frontLimitZ':-.313},'builderHelperSource':'assets/l10-prototype/build.py: pure helper definitions only'}
metadata['finishRevision']=3
metadata['finishChanges']=['Post-boolean analytic cylindrical manifold normals, flat port/end faces and explicit UV seam; 64-side headers within original radius','Five-segment 0.0022 cover edge breaks inside existing cover envelope','Twelve stepped compression ferrules with chamfered lips and captured elastomer seals inside original 0.020 collar radius','All existing CPU/GPU MR finishes, manifold roughness, bare assets, contact seats, TIM, mounts, stream meshes and route contracts retained']
metadata['fastenerRecesses']=fastener_recesses
scene['assemblyContract']=json.dumps(metadata,separators=(',',':'))
# Editable source is saved before export batching; every component remains named.
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'cooling-assembly.blend'))
exports=[];deps=bpy.context.evaluated_depsgraph_get();exp=bpy.data.collections.new('DELIVERY ONLY');scene.collection.children.link(exp)
for layer,col in COL.items():
    groups={}
    for o in list(col.objects):groups.setdefault(o.get('component',layer),[]).append(o)
    for component,originals in groups.items():
        copies=[]
        for o in originals:
            me=bpy.data.meshes.new_from_object(o.evaluated_get(deps),preserve_all_data_layers=True,depsgraph=deps);c=bpy.data.objects.new(o.name,me);c.matrix_world=o.matrix_world.copy();exp.objects.link(c);copies.append(c)
        bpy.ops.object.select_all(action='DESELECT')
        for c in copies:c.select_set(True)
        bpy.context.view_layer.objects.active=copies[0];bpy.ops.object.join();o=copies[0];o.name='Cooling V1 / '+layer+' / '+component;bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
        tri=o.modifiers.new('Delivery triangles','TRIANGULATE');tri.keep_custom_normals=True;bpy.ops.object.modifier_apply(modifier=tri.name)
        o['l10Layer']=layer;o['component']=component;o['sourceComponents']=len(originals);o['coordinateUnits']=metadata['coordinateUnits'];o['approximation']=metadata['approximation'];exports.append(o)
bpy.ops.object.select_all(action='DESELECT')
for o in exports:o.select_set(True)
with tempfile.TemporaryDirectory(prefix='cooling-export-',dir=OUT) as tmp:
    p=Path(tmp)/'cooling-assembly.glb'
    bpy.ops.export_scene.gltf(filepath=str(p),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_texcoords=True,export_normals=True,export_tangents=False,export_materials='EXPORT',export_extras=True,export_animations=False,export_cameras=False,export_lights=False,export_image_format='AUTO')
    b=p.read_bytes();n=struct.unpack_from('<I',b,12)[0];doc=json.loads(b[20:20+n]);binpart=b[28+n:];doc['extras']=metadata
    for m in doc['materials']:m.pop('extensions',None)
    doc.pop('extensionsUsed',None);doc.pop('extensionsRequired',None)
    js=json.dumps(doc,separators=(',',':')).encode();js+=b' '*((-len(js))%4)
    out=struct.pack('<III',0x46546c67,2,28+len(js)+len(binpart))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(binpart),0x004e4942)+binpart
    assert hashlib.sha256(BARE.read_bytes()).hexdigest()==baseline_hash
    p.write_bytes(out);os.replace(p,OUT/'cooling-assembly.glb')
metadata.update({'sha256':hashlib.sha256(out).hexdigest(),'bytes':len(out),'file':'cooling-assembly.glb','source':'assets/l10-cooling-v1/cooling-assembly.blend','builder':'assets/l10-cooling-v1/build.py','triangles':sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes']for p in m['primitives']),'nodes':len(doc['nodes']),'materials':len(doc['materials']),'embeddedImages':len(doc.get('images',[]))})
(OUT/'assembly.json').write_text(json.dumps(metadata,indent=2)+'\n');print('COOLING_V1_RESULT '+json.dumps({k:metadata[k]for k in ['sha256','bytes','triangles','nodes','materials','embeddedImages']}),flush=True)
