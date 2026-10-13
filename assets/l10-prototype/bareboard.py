"""Original, evidence-guided bare board study. No vendor pixels/CAD are imported.

blender --background --factory-startup --python assets/l10-prototype/bareboard.py

The NVIDIA Figure 7 photograph supplies package-face and component-zone evidence,
not Lenovo package dimensions/netlists. Existing PA board/package anchors remain
authoritative. Normalized scene coordinates are NOT manufacturing dimensions.
"""
import bpy, bmesh, json, math, struct, hashlib
import numpy as np
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUT = ROOT / 'app/static/models/l10-prototype'
TEX = HERE / 'textures'
L = json.loads((HERE / 'layout.json').read_text())
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for m in list(bpy.data.materials): bpy.data.materials.remove(m)
scene = bpy.context.scene
scene['assetId'] = 'dual-bare-compute-boards-r1'
scene['reference'] = 'NVIDIA Figure 7 visible packages and functional zones; retained Lenovo-based PA anchors'
scene['limits'] = 'Original visual approximation. No OEM CAD, chip floorplan, HBM count/layout, socket or serviceability claim.'
COL = {}
for layer in ['board', 'packages']:
    c = bpy.data.collections.new(layer); scene.collection.children.link(c); COL[layer] = c
M = {}

def image(name, values, linear=False):
    h,w,_ = values.shape
    img=bpy.data.images.new(name,width=w,height=h,alpha=True)
    img.colorspace_settings.name='Non-Color' if linear else 'sRGB'
    img.pixels.foreach_set(values.astype(np.float32).ravel())
    img.filepath_raw=str(TEX/(name+'.png'));img.file_format='PNG';img.save()
    return img

# Authored optical finish, deliberately not a fabricated chip floorplan. The
# fine intersecting polish structure changes highlights, not electrical claims.
n=512;v,u=np.mgrid[0:n,0:n].astype(np.float32)/(n-1)
grain=.5+.5*np.sin(u*1919+np.sin(v*271)*.24)*np.sin(v*1559)
pcb=np.ones((n,n,4),np.float32)
pcb[:,:,:3]=np.stack([.057+.004*grain,.063+.004*grain,.061+.004*grain],axis=-1)
pcb_img=image('bare-pcb-soldermask',pcb)
mr=np.ones_like(pcb);mr[:,:,0]=1;mr[:,:,1]=.48+.035*grain;mr[:,:,2]=0
pcb_mr=image('bare-pcb-metallicroughness',mr,True)
sil=np.ones_like(pcb)
# Small, muted wavelength-like tint differences; no glowing rainbow/emission.
bands=.5+.5*np.sin(u*4.8+v*3.1)
polish=.5+.5*np.sin(u*351)*np.sin(v*227)
# Core renderer decodes this PNG as sRGB. Calibrate the authored pigment here,
# not scene exposure. Fine optical witness lines are a surface approximation,
# not a reconstructed transistor floorplan, HBM map or extra component meshes.
vertical=np.exp(-np.square(np.sin(u*math.pi*23)*6))
horizontal=np.exp(-np.square(np.sin(v*math.pi*37)*6))
witness=(vertical*.032+horizontal*.023)
sil[:,:,0]=.395+.036*bands+.025*polish-witness
sil[:,:,1]=.442+.023*np.sin(v*4.2)+.022*polish-witness
sil[:,:,2]=.428+.044*(1-bands)+.022*polish-witness
sil_img=image('bare-silicon-finish',sil)
mr[:,:,1]=.245+.027*grain;mr[:,:,2]=.68
sil_mr=image('bare-silicon-metallicroughness',mr,True)
nm=np.ones_like(pcb);nm[:,:,0]=.5+.012*np.sin(u*351);nm[:,:,1]=.5+.009*np.sin(v*227);nm[:,:,2]=.9997
sil_n=image('bare-silicon-normal',nm,True)

def mat(name,color,metal=0,rough=.5,base=None,mr=None,normal=None):
    m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*color,1)
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
    p.inputs['Specular IOR Level'].default_value=.5
    def tex(img):
        node=m.node_tree.nodes.new('ShaderNodeTexImage');node.image=img;return node
    if base:m.node_tree.links.new(tex(base).outputs['Color'],p.inputs['Base Color'])
    if mr:
        sep=m.node_tree.nodes.new('ShaderNodeSeparateColor');m.node_tree.links.new(tex(mr).outputs['Color'],sep.inputs['Color'])
        m.node_tree.links.new(sep.outputs['Green'],p.inputs['Roughness']);m.node_tree.links.new(sep.outputs['Blue'],p.inputs['Metallic'])
    if normal:
        norm=m.node_tree.nodes.new('ShaderNodeNormalMap');norm.inputs['Strength'].default_value=.12
        m.node_tree.links.new(tex(normal).outputs['Color'],norm.inputs['Color']);m.node_tree.links.new(norm.outputs['Normal'],p.inputs['Normal'])
    m['authorship']='Original finish; no vendor image textures or measured BRDF';M[name]=m;return m

mat('Black solder mask',(.023,.027,.024),0,.5,pcb_img,pcb_mr)
mat('Laminate cut edge',(.066,.071,.050),0,.68)
mat('Package substrate',(.014,.018,.017),0,.40)
mat('Bonded underfill',(.007,.009,.008),0,.58)
mat('Gold plated frame',(.58,.50,.29),.90,.31)
mat('Gold board contacts',(.63,.47,.22),.92,.36)
mat('CPU nickel frame',(.41,.44,.44),.91,.29)
mat('Silicon exposed optical face',(.27,.3,.3),.72,.24,sil_img,sil_mr,sil_n)
mat('Die cut edge',(.11,.13,.14),.60,.28)
mat('Molded IC body',(.014,.017,.018),0,.61)
mat('Ferrite power stage',(.044,.048,.050),0,.59)
mat('Passive ceramic',(.15,.13,.09),0,.55)
mat('Solder fillet',(.43,.46,.47),.90,.29)
mat('Connector polymer',(.009,.012,.013),0,.50)
mat('Silkscreen ink',(.40,.44,.40),0,.65)
mat('Etched top marking',(.060,.066,.061),0,.61)

def coord(x,y,z):return x,-z,y
def tag(o,layer,component,board):
    for c in list(o.users_collection):c.objects.unlink(o)
    COL[layer].objects.link(o);o['l10Layer']=layer;o['component']=component;o['boardIndex']=board
    return o
def uv(o):
    mesh=o.data;lay=mesh.uv_layers.new(name='UVMap') if not mesh.uv_layers else mesh.uv_layers.active
    bounds=[(min(v.co[i] for v in mesh.vertices),max(v.co[i] for v in mesh.vertices)) for i in range(3)]
    for p in mesh.polygons:
        axis=max(range(3),key=lambda i:abs(p.normal[i]));a,b=([1,2] if axis==0 else [0,2] if axis==1 else [0,1])
        for li in p.loop_indices:
            c=mesh.vertices[mesh.loops[li].vertex_index].co
            lay.data[li].uv=((c[a]-bounds[a][0])/max(1e-9,bounds[a][1]-bounds[a][0]),(c[b]-bounds[b][0])/max(1e-9,bounds[b][1]-bounds[b][0]))
def box(name,layer,component,bi,x,y,z,w,h,d,material,bevel=.0015):
    bpy.ops.mesh.primitive_cube_add(size=1,location=coord(x,y,z));o=bpy.context.object;o.name=name
    o.dimensions=(w,d,h);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(M[material]);tag(o,layer,component,bi);uv(o)
    if bevel:
        mod=o.modifiers.new('Manufactured edge break','BEVEL');mod.width=min(bevel,h*.22);mod.segments=2
        mod=o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL');mod.keep_sharp=True
    return o
def ring(name,layer,component,bi,x,y,z,r,inner,h,material):
    N=24;verts=[];faces=[]
    for yy in [y-h/2,y+h/2]:
        for rr in [r,inner]:verts.extend(coord(x+rr*math.cos(i*math.tau/N),yy,z+rr*math.sin(i*math.tau/N)) for i in range(N))
    for i in range(N):
        j=(i+1)%N;faces.extend([(i,j,2*N+j,2*N+i),(N+j,N+i,3*N+i,3*N+j),(2*N+i,2*N+j,3*N+j,3*N+i),(j,i,N+i,N+j)])
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update()
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
    o=bpy.data.objects.new(name,me);COL[layer].objects.link(o);me.materials.append(M[material]);tag(o,layer,component,bi);uv(o)
    return o
def topface(name,bi,x,y,z,w,d):
    me=bpy.data.meshes.new(name);me.from_pydata([coord(x-w/2,y,z-d/2),coord(x+w/2,y,z-d/2),coord(x+w/2,y,z+d/2),coord(x-w/2,y,z+d/2)],[],[(0,3,2,1)]);me.update()
    o=bpy.data.objects.new(name,me);COL['packages'].objects.link(o);me.materials.append(M['Silicon exposed optical face']);tag(o,'packages',name.rsplit(' / ',1)[0],bi);uv(o)
    return o

for bi,dx in [(0,0),(1,1.93)]:
    b=L['board'];cx=b['x']+dx;cz=b['z'];t=b['top'];prefix=f'Board{bi+1}'
    pcb=box(prefix+' / routed FR4','board','pcb',bi,cx,(t+b['bottom'])/2,cz,b['width'],t-b['bottom'],b['depth'],'Black solder mask',.002)
    # Real cut-out mounting bores, with plated annuli. Locations follow the
    # retained PA outline; diameters are visual approximation, not OEM drawings.
    for sx in [-1,1]:
      for sz in [-1,1]:
        x=cx+sx*(b['width']/2-.052);z=cz+sz*(b['depth']/2-.055)
        bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=.016,depth=.1,location=coord(x,t,z))
        cut=bpy.context.object;mod=pcb.modifiers.new('Through mounting bore','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cut
        bpy.context.view_layer.objects.active=pcb;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cut,do_unlink=True)
        ring(prefix+' plated mounting annulus','board','mount',bi,x,t+.001,z,.028,.016,.002,'Gold board contacts')
    uv(pcb)
    pcb.data.materials.append(M['Laminate cut edge'])
    for p in pcb.data.polygons:
        if abs(p.normal.z)<.5:p.material_index=1

    def B(name,x,z,w,d,h=.02,material='Molded IC body',y=None):
        return box(prefix+' / '+name,'board',name,bi,x+dx,t+h/2+.001 if y is None else y,z,w,h,d,material)
    def smd(name,x,z,w=.026,d=.019,h=.008):
        B(name,x,z,w*.67,d,h,'Passive ceramic')
        for side in [-1,1]:B(name+' termination',x+side*w*.41,z,w*.19,d+.001,h*.8,'Solder fillet')
    # Photo-visible conditioning: two outer GPU VRM strips, the middle GPU
    # strip, and a transverse CPU supply band. Pitch is approximate; the zone
    # topology is intentional. Repetition here models actual repeated phases.
    for gx in [-1.755,-.965,-.175]:
      for i,z in enumerate([-2.53,-2.385,-2.24,-2.095,-1.95]):
        B('GPU supply molded power stage',gx,z,.088,.105,.031,'Ferrite power stage')
        B('GPU supply driver',gx,z+.058,.060,.023,.012)
        for s in [-1,1]:B('Power terminal',gx+s*.045,z,.013,.064,.010,'Solder fillet')
    for i,x in enumerate([-1.60,-1.43,-1.26,-1.09,-.84,-.67,-.50,-.33]):
        B('CPU supply choke',x,-1.67,.110,.084,.030,'Ferrite power stage')
        B('CPU supply driver',x,-1.565,.067,.043,.016)
        smd('CPU supply bypass',x,-1.51,.041,.024,.013)
    # Distinct CPU-flanking low-profile memory/control packages are visible in
    # Figure 7. They are appearance references, not claimed Lenovo BOM/SKU.
    for x in [-1.60,-1.415,-.515,-.33]:
      for z in [-1.335,-1.105,-.875]:
        B('CPU side memory control package',x,z,.156,.192,.019)
        B('Faint package marking',x,z+.018,.067,.003,.0005,'Etched top marking',t+.0208)
    # Edge connector geometry has a cavity, gold contacts and keyed end stops.
    for x,z,length,axis in [(-1.778,-1.085,.60,'z'),(-.151,-1.06,.45,'z'),(-1.365,-2.768,.50,'x'),(-.574,-2.768,.46,'x'),(-.967,-.579,.49,'x')]:
        w,d=(.060,length) if axis=='z' else (length,.060)
        B('Keyed connector base',x,z,w,d,.012,'Connector polymer')
        for s in [-1,1]:
            B('Connector shroud',x+s*(w/2-.007) if axis=='z' else x,z+s*(d/2-.007) if axis=='x' else z,.014 if axis=='z' else w,d if axis=='z' else .014,.041,'Connector polymer')
        count=int(length/.037)
        for k in range(count):
            q=(k+.5)/count-.5
            B('Connector gold spring',x+q*length*.87 if axis=='x' else x,z+q*length*.87 if axis=='z' else z,.009 if axis=='x' else .028,.028 if axis=='x' else .009,.022,'Gold board contacts')
    # Asymmetrical local support islands, based on visible small-part density,
    # kept out of chip footprints and edge keepouts. No random trace/netlist.
    for i,(x,z) in enumerate([(-1.665,-.69),(-1.405,-.66),(-.49,-.66),(-.255,-.71),(-1.53,-2.655),(-.66,-2.655),(-1.09,-2.675)]):
        B('Support controller',x,z,.065,.050,.016)
        for j,(xx,zz,w,d) in enumerate([(-.057,-.016,.023,.018),(-.058,.021,.020,.015),(.054,-.012,.021,.015),(.048,.026,.027,.017),(0,.053,.032,.022)]):
            smd('Controller passive',x+xx,z+zz,w,d)
    # Silkscreen corner witnesses and orientation dot are restrained; no fictive
    # circuit traces crossing components. Plated test points are local only.
    for x,z in [(-1.70,-1.47),(-.25,-1.47),(-1.69,-.57),(-.27,-2.66)]:
        B('Assembly witness',x,z,.029,.002,.0006,'Silkscreen ink',t+.0005)
        ring(prefix+' local test pad','board','test pad',bi,x+dx+.037,t+.0008,z,.007,.002,.0016,'Gold board contacts')

    for p in L['packages']:
        ident=p['id'];x=p['x']+dx+(.010 if bi==1 and ident!='CPU' else 0);z=p['z'];w=p['width'];d=p['depth'];name=prefix+'/'+ident
        def P(label,X,Y,Z,W,H,D,material,bevel=.0015):
            return box(name+' / '+label,'packages',name,bi,X,Y,Z,W,H,D,material,bevel)
        box(name+' bonded footprint','board','bonded footprint',bi,x,t+.001,z,w+.045,.002,d+.045,'Bonded underfill')
        P('underfill',x,-.0617,z,w+.022,.0176,d+.022,'Bonded underfill')
        P('organic package substrate',x,-.0475,z,w+.056,.0108,d+.056,'Package substrate')
        P('bonded inner support',x,-.0263,z,w-.095,.0316,d-.095,'Package substrate',.001)
        for sy in [-.0515,-.0455]:
            for s in [-1,1]:P('laminate edge',x+s*(w/2+.027),sy,z,.0012,.001,d+.054,'Laminate cut edge',0)
        # A bezel is made from four slim metal strips, never a solid silver lid.
        # CPU has a smaller exposed die, GPU a long optical contact face. The
        # unverified HBM arrangement is intentionally not reconstructed.
        fw,fd=(w-.035,d-.035) if ident=='CPU' else (w-.007,d-.015)
        material='CPU nickel frame' if ident=='CPU' else 'Gold plated frame'
        border=.022 if ident=='CPU' else .017
        for side in [-1,1]:
            P('perimeter frame',x+side*(fw/2-border/2),-.019,z,border,.046,fd,material,.002)
            P('perimeter frame',x,-.019,z+side*(fd/2-border/2),fw-border*2,.046,border,material,.002)
        dw,dd=(.210,.292) if ident=='CPU' else (.254,.438)
        P('die bonded edge',x,-.007,z,dw+.012,.023,dd+.012,'Die cut edge',.0015)
        P('die contact surface',x,.003,z,dw,.005,dd,'Die cut edge',.0007)
        topface(name+' / exposed silicon',bi,x,.0056,z,dw-.001,dd-.001)
        # GPU exposes broad gold-toned shoulder regions in the reference. These
        # are uniform contact appearance, not invented separate HBM die meshes.
        if ident!='CPU':
            for side in [-1,1]:P('visible contact shoulder',x+side*.203,-.007,z,.094,.007,.375,'Gold plated frame',.001)
        for side in [-1,1]:
          for k in range(7 if ident=='CPU' else 9):
            count=7 if ident=='CPU' else 9;xx=x+(k-(count-1)/2)*.026
            P('substrate termination',xx,-.037,z+side*(d/2-.029),.015,.007,.009,'Solder fillet',.0003)
        # Small perimeter bypasses are visible in Figure 7; they do not simulate
        # BGA/socket contacts or imply removable CPU/GPU modules.
        if ident=='CPU':
          for side in [-1,1]:
            for k in range(6):P('package bypass',x+side*.175,-.034,z-.11+k*.044,.019,.007,.013,'Passive ceramic',.0003)

# Append the already accepted service geometry without reconstructing it. This
# preserves the eight axial fans and insulated central power harness precisely.
with bpy.data.libraries.load(str(HERE/'compute-board-prototype.blend'),link=False) as (src,dst):
    dst.collections=['io']
io=dst.collections[0];scene.collection.children.link(io);COL['io']=io
# Keep the editable source and bake delivery groups by semantic animation layer.
for img in bpy.data.images:
    if img.source in {'FILE','GENERATED'} and img.size[0] and img.size[1]:
        img.pack()
        if not img.packed_file:raise RuntimeError('Unable to pack authored image: '+img.name)
        if img.filepath:img.filepath='//textures/'+Path(bpy.path.abspath(img.filepath)).name
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'bare-compute-boards.blend'))
exports=[];deps=bpy.context.evaluated_depsgraph_get()
export_col=bpy.data.collections.new('GLB delivery batches');scene.collection.children.link(export_col)
for layer,col in COL.items():
    groups={}
    for o in col.objects:
        key=(o.get('boardIndex',-1),o['component'] if layer=='packages' else layer)
        groups.setdefault(key,[]).append(o)
    for (bi,key),originals in groups.items():
        copies=[]
        for original in originals:
            ev=original.evaluated_get(deps);me=bpy.data.meshes.new_from_object(ev,preserve_all_data_layers=True,depsgraph=deps)
            copy=bpy.data.objects.new(original.name,me);copy.matrix_world=original.matrix_world.copy();export_col.objects.link(copy);copies.append(copy)
        bpy.ops.object.select_all(action='DESELECT')
        for o in copies:o.select_set(True)
        bpy.context.view_layer.objects.active=copies[0];bpy.ops.object.join();o=copies[0]
        o.name=f'Bare Board {bi+1} / {layer} / {key}'
        bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
        tri=o.modifiers.new('Delivery triangles','TRIANGULATE');tri.keep_custom_normals=True;bpy.ops.object.modifier_apply(modifier=tri.name)
        o['l10Layer']=layer;o['boardIndex']=bi;o['component']=key;o['sourceComponents']=len(originals)
        o['approximation']='Original image-guided visual study; anchored Lenovo-based arrangement; no OEM CAD or hidden package floorplan.'
        exports.append(o)
bpy.ops.object.select_all(action='DESELECT')
for o in exports:o.select_set(True)
path=OUT/'bare-compute-boards.glb'
bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_texcoords=True,export_normals=True,export_tangents=True,export_materials='EXPORT',export_extras=True,export_animations=False,export_cameras=False,export_lights=False,export_image_format='AUTO',export_draco_mesh_compression_enable=False)
data=path.read_bytes();ln=struct.unpack_from('<I',data,12)[0];doc=json.loads(data[20:20+ln]);binary=data[28+ln:]
doc['extras']={'id':'dual-bare-compute-boards-r1','prototypeRevision':4,'replacesComputeBoards':[0,1],'replacesServiceGeometry':True,'bareBoardOnly':True,'packageCount':6,'cpuCount':2,'gpuCount':4,'coordinateUnits':'Existing PA raw units. Shared renderer scale [.688,1,.802] required.','approval':'OPT-IN visual study, not photorealism accepted','referenceConfidence':'Figure 7 visible package face and functional zones; retained PA Lenovo-based positions; dimensions and unseen details approximate.'}
for mesh in doc['meshes']:
    for primitive in mesh['primitives']:
        if 'normalTexture' not in doc['materials'][primitive['material']]:primitive['attributes'].pop('TANGENT',None)
js=json.dumps(doc,separators=(',',':')).encode();js+=b' '*((-len(js))%4)
blob=struct.pack('<III',0x46546c67,2,28+len(js)+len(binary))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(binary),0x004e4942)+binary
path.write_bytes(blob)
triangles=sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes'] for p in m['primitives'])
print('BARE_BOARD_ASSET_RESULT '+json.dumps({'id':doc['extras']['id'],'sha256':hashlib.sha256(blob).hexdigest(),'bytes':len(blob),'triangles':triangles,'nodes':len(doc['nodes']),'primitives':sum(len(m['primitives']) for m in doc['meshes']),'materials':len(doc['materials']),'images':len(doc.get('images',[])),'sourceObjects':sum(len(c.objects) for c in COL.values()),'layers':['board','packages','io']}))
