"""Build original editable Blender prototype and a core-PBR glTF 2.0 asset.

blender --background --factory-startup --python assets/l10-prototype/build.py
Author textures first using author_textures.py. All measurements below use the
existing display anchors. This is NOT extracted vendor CAD or manufacturing data.
"""
import bpy, bmesh, json, math, runpy
from pathlib import Path
from mathutils import Vector

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
OUT=ROOT/'app/static/models/l10-prototype'
OUT.mkdir(parents=True,exist_ok=True)
L=json.loads((HERE/'layout.json').read_text())
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for data in list(bpy.data.materials):bpy.data.materials.remove(data)
scene=bpy.context.scene;scene.unit_settings.system='NONE'
scene['reference']='Original asset; Lenovo official top/internal image exterior guidance.'
scene['referenceConfidence']='Diagram; uncooled packages and concealed PCB are visual approximation.'
scene['coordinateContract']='Blender (x,-z,y) exports through glTF Y-up to PA (x,y,z).'
COL={}
for layer in ['board','packages','cooling-frame','cooling']:
    c=bpy.data.collections.new(layer);scene.collection.children.link(c);COL[layer]=c
M={}

def material(name,color,metal,rough,textures=None,normal_scale=.15):
    m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*color,1)
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
    # Core metallic/roughness only; suppress extension-producing defaults.
    p.inputs['Specular IOR Level'].default_value=.5
    if textures:
      for suffix,space in [('basecolor','sRGB'),('metallicroughness','Non-Color'),('normal','Non-Color')]:
        tex=m.node_tree.nodes.new('ShaderNodeTexImage')
        tex.image=bpy.data.images.load(str(HERE/'textures'/f'{textures}-{suffix}.png'),check_existing=True)
        tex.image.colorspace_settings.name=space;tex.label=suffix
        if suffix=='basecolor':m.node_tree.links.new(tex.outputs['Color'],p.inputs['Base Color'])
        elif suffix=='metallicroughness':
          sep=m.node_tree.nodes.new('ShaderNodeSeparateColor')
          m.node_tree.links.new(tex.outputs['Color'],sep.inputs['Color'])
          m.node_tree.links.new(sep.outputs['Green'],p.inputs['Roughness'])
          if metal>0:m.node_tree.links.new(sep.outputs['Blue'],p.inputs['Metallic'])
        else:
          norm=m.node_tree.nodes.new('ShaderNodeNormalMap');norm.inputs['Strength'].default_value=normal_scale
          m.node_tree.links.new(tex.outputs['Color'],norm.inputs['Color'])
          m.node_tree.links.new(norm.outputs['Normal'],p.inputs['Normal'])
    m['finishEvidence']='Original authored material; no OEM surface scan or measured roughness.'
    M[name]=m;return m

material('PCB soldermask',(.025,.09,.055),0,.48,'pcb',.20)
material('PCB laminate edge',(.09,.105,.055),0,.60)
material('Package organic laminate',(.027,.048,.025),0,.40)
material('Bonded epoxy underfill',(.012,.015,.014),0,.54)
material('Lapped package spreader',(.53,.53,.48),1,.36,'package',.10)
material('Brushed nickel',(.48,.52,.52),1,.31,'nickel',.20)
material('Machined copper',(.62,.28,.12),1,.34,'copper',.18)
material('Black polymer',(.009,.012,.013),0,.55,'polymer',.18)
material('Ferrite mold',(.080,.086,.082),0,.72)
material('Ceramic dielectric',(.24,.19,.11),0,.57)
material('Solder termination',(.54,.57,.56),.88,.27)
material('Gold contact',(.78,.54,.22),1,.25)
material('Anodized retention',(.021,.023,.025),.30,.38)
material('TIM',(.065,.071,.068),0,.74)
material('Silkscreen',(.47,.53,.39),0,.63)

def coord(x,y,z):return (x,-z,y)
def tag(o,layer,component):
    for c in list(o.users_collection):c.objects.unlink(o)
    COL[layer].objects.link(o)
    o['l10Layer']=layer;o['component']=component
    o['referenceConfidence']='visual approximation' if layer in ['board','packages'] else 'image-guided exterior; dimensions approximate'
    o['approximation']='Original mesh. No OEM CAD, concealed package topology, microchannel map or measured finish.'
    return o
def smooth_bevel(o,amount=.002,segments=1):
    if amount:
      mod=o.modifiers.new('Physical edge break','BEVEL');mod.width=amount;mod.segments=segments
      mod.affect='EDGES'
      mod=o.modifiers.new('Weighted manufactured normals','WEIGHTED_NORMAL');mod.keep_sharp=True;mod.weight=50
    return o
def uv_project(o,board=False):
    uv=o.data.uv_layers.new(name='UVMap') if not o.data.uv_layers else o.data.uv_layers.active
    for poly in o.data.polygons:
      normal=poly.normal
      for li in poly.loop_indices:
        v=o.matrix_world @ o.data.vertices[o.data.loops[li].vertex_index].co
        if board:
          u=(v.x-(L['board']['x']-L['board']['width']/2))/L['board']['width']
          t=(-v.y-(L['board']['z']-L['board']['depth']/2))/L['board']['depth']
          uv.data[li].uv=(u,1-t)
        else:
          # Object-scale normalized planar UVs; hard edges have split loops.
          c=o.data.vertices[o.data.loops[li].vertex_index].co
          axis=max(range(3),key=lambda i:abs(normal[i]))
          a,b=([1,2] if axis==0 else [0,2] if axis==1 else [0,1])
          mins=[min(v.co[i] for v in o.data.vertices) for i in range(3)]
          maxs=[max(v.co[i] for v in o.data.vertices) for i in range(3)]
          uv.data[li].uv=((c[a]-mins[a])/max(.00001,maxs[a]-mins[a]),(c[b]-mins[b])/max(.00001,maxs[b]-mins[b]))
def cube(name,layer,component,x,y,z,w,h,d,mat,bevel=.002):
    bpy.ops.mesh.primitive_cube_add(size=1,location=coord(x,y,z));o=bpy.context.object;o.name=name
    o.dimensions=(w,d,h);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(M[mat]);tag(o,layer,component);uv_project(o)
    smooth_bevel(o,min(bevel,h*.20,w*.15,d*.15) if bevel else 0,3 if min(w,d)>.25 else 1)
    return o
def polyprism(name,layer,component,points,bottom,top,mat,bevel=.003):
    # Input polygon in raw X/Z; ordering is corrected by Blender normals.
    verts=[coord(x,y,z) for y in [bottom,top] for x,z in points];n=len(points)
    faces=[tuple(range(n-1,-1,-1)),tuple(range(n,n*2))]
    for i in range(n):j=(i+1)%n;faces.append((i,j,j+n,i+n))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);COL[layer].objects.link(o);tag(o,layer,component)
    bpy.context.view_layer.objects.active=o;o.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT');o.select_set(False)
    mesh.materials.append(M[mat]);uv_project(o);smooth_bevel(o,bevel,3)
    return o
def cylinder(name,layer,component,x,y,z,r,h,mat,verts=20,inner=0):
    if inner:
      points=[];faces=[]
      for Y in [y-h/2,y+h/2]:
       for rad in [r,inner]:
        points.extend(coord(x+rad*math.cos(i*math.tau/verts),Y,z+rad*math.sin(i*math.tau/verts)) for i in range(verts))
      for i in range(verts):
       j=(i+1)%verts
       faces += [(i,j,2*verts+j,2*verts+i),(verts+j,verts+i,3*verts+i,3*verts+j),(2*verts+i,2*verts+j,3*verts+j,3*verts+i),(j,i,verts+i,verts+j)]
      mesh=bpy.data.meshes.new(name);mesh.from_pydata(points,[],faces);mesh.update()
      bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
      o=bpy.data.objects.new(name,mesh);COL[layer].objects.link(o)
    else:
      bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=r,depth=h,location=coord(x,y,z));o=bpy.context.object;o.name=name
    o.data.materials.append(M[mat]);tag(o,layer,component);uv_project(o);smooth_bevel(o,.0008,1)
    return o
def screw(name,layer,x,y,z,r=.016):
    cylinder(name+' head',layer,'retention',x,y,z,r,.012,'Brushed nickel',24)
    cylinder(name+' recessed drive',layer,'retention',x,y+.0067,z,r*.43,.0015,'Anodized retention',6)
    cylinder(name+' washer',layer,'retention',x,y-.009,z,r*1.35,.004,'Anodized retention',24,inner=r*.57)

b=L['board'];cx=b['x'];cz=b['z'];bw=b['width'];bd=b['depth'];t=b['top']
# The source object keeps real mounting through-holes. Not simply exported old JS.
pcb=cube('Primary board · drilled FR4','board','pcb',cx,(b['top']+b['bottom'])/2,cz,bw,b['top']-b['bottom'],bd,'PCB soldermask',.002)
for sx in [-1,1]:
 for sz in [-1,1]:
    x=cx+sx*(bw/2-.058);z=cz+sz*(bd/2-.062)
    bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=.014,depth=.10,location=coord(x,-.08,z))
    cut=bpy.context.object;mod=pcb.modifiers.new('Drilled M-hole','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cut
    bpy.context.view_layer.objects.active=pcb;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cut,do_unlink=True)
    cylinder('Board plated mounting annulus','board','mounting hole',x,t+.0007,z,.031,.0014,'Gold contact',24,inner=.014)
    screw('Board captive fastener','board',x,t+.007,z,.013)
uv_project(pcb,True)
# Soldermask texture only on broad PCB faces; cross section remains FR4 laminate.
pcb.data.materials.append(M['PCB laminate edge'])
for p in pcb.data.polygons:
    if abs(p.normal.z)<.7:p.material_index=1

def smd(name,x,z,w=.040,d=.025,h=.015,mat='Ceramic dielectric'):
    cube(name+' dielectric','board','terminated passive',x,t+h/2+.001,z,w*.68,h,d,mat,.001)
    for s in [-1,1]:
      cube(name+' termination','board','terminated passive',x+s*w*.41,t+h*.44+.001,z,w*.20,h*.88,d+.001,'Solder termination',.0005)
      cube(name+' solder fillet','board','solder pad',x+s*w*.43,t+.001,z,w*.28,.002,d+.007,'Solder termination',.0004)
for n,bank in enumerate(L['passiveBanks']):
 for i in range(bank['count']):
    x=bank['x']+(i*bank['pitch'] if bank['axis']=='x' else 0)
    z=bank['z']+(i*bank['pitch'] if bank['axis']=='z' else 0)
    smd(f'C{n*20+i+1}',x,z,h=.014 if n%2 else .019)
for i,(x,z) in enumerate(L['powerStages']):
    cube(f'L{i+1} ferrite power choke','board','power stage',x,t+.026,z,.112,.048,.102,'Ferrite mold',.006)
    for s in [-1,1]:cube(f'L{i+1} folded terminal','board','power stage',x,t+.007,z+s*.047,.084,.014,.018,'Solder termination',.001)
    for j in [-1,1]:
      smd(f'Q{i*2+(j+1)//2}',x+j*.047,z+.110,.055,.061,.014,'Black polymer')
    cube(f'L{i+1} witness line','board','power stage',x,t+.0504,z-.011,.047,.0008,.004,'Silkscreen',0)

# Edge connector cavity, keyed separator, spring contacts and solder tails.
# Its outboard long location is visible in the official picture; pitch is authored.
def connector(name,x,z,length,along='z'):
    w,d=(.068,length) if along=='z' else (length,.068)
    cube(name+' base','board','edge connector',x,t+.009,z,w,.018,d,'Black polymer',.002)
    for side in [-1,1]:
      cube(name+' housing wall','board','edge connector',x+(side*.030 if along=='z' else 0),t+.030,z+(side*.030 if along=='x' else 0),.012 if along=='z' else length,.039,length if along=='z' else .012,'Black polymer',.001)
    count=max(6,int(length/.033))
    for i in range(count):
      offset=-length/2+.025+i*(length-.05)/max(1,count-1)
      X=x+(offset if along=='x' else 0);Z=z+(offset if along=='z' else 0)
      cube(name+' contact','board','edge connector',X,t+.024,Z,.032 if along=='z' else .005,.007,.005 if along=='z' else .032,'Gold contact',.0004)
      for side in [-1,1]:cube(name+' solder foot','board','edge connector',X+(side*.041 if along=='z' else 0),t+.003,Z+(side*.041 if along=='x' else 0),.019 if along=='z' else .007,.006,.007 if along=='z' else .019,'Solder termination',.0006)
    for end in [-1,1]:
      cube(name+' end key','board','edge connector',x+(end*length*.49 if along=='x' else 0),t+.032,z+(end*length*.49 if along=='z' else 0),.075 if along=='z' else .018,.043,.018 if along=='z' else .075,'Black polymer',.002)
connector('Outboard management mezzanine connector',-1.727,-1.24,.73)
connector('Inboard service connector A',-.223,-1.09,.25)
connector('Inboard service connector B',-.223,-1.49,.24)
connector('Forward board connector',-.975,-.585,.44,'x')

for p in L['packages']:
    x,z,w,d=p['x'],p['z'],p['width'],p['depth'];ident=p['id']
    cube(ident+' bonded underfill','packages',ident,x,-.06375,z,w+.028,.0155,d+.028,'Bonded epoxy underfill',.002)
    cube(ident+' organic substrate','packages',ident,x,-.047,z,w+.10,.018,d+.10,'Package organic laminate',.003)
    # Layered substrate edge is construction, not decorative fake exposed BGA pins.
    for sy in [-.0515,-.0445]:
      for side in [-1,1]:
        cube(ident+' laminate edge','packages',ident,x+side*(w/2+.049),sy,z,.002,.0016,d+.086,'PCB laminate edge',0)
        cube(ident+' laminate edge','packages',ident,x,sy,z+side*(d/2+.049),w+.086,.0016,.002,'PCB laminate edge',0)
    # Truncated pin-one corner in bonded spreader flange, with raised lapped face.
    pts=[(x-w/2+.024,z-d/2),(x+w/2,z-d/2),(x+w/2,z+d/2),(x-w/2,z+d/2),(x-w/2,z-d/2+.024)]
    polyprism(ident+' spreader flange','packages',ident,pts,-.0375,-.0025,'Brushed nickel',.003)
    cube(ident+' lapped contact surface','packages',ident,x,.001,z,w-.055,.010,d-.055,'Lapped package spreader',.002)
    for side in [-1,1]:
      for i in range(7):
        X=x-w*.38+i*w*.76/6;Z=z+side*(d/2+.029)
        cube(ident+' substrate decoupler','packages',ident,X,-.0325,Z,.020,.009,.016,'Ceramic dielectric',.0007)
        for s in [-1,1]:cube(ident+' decoupler solder cap','packages',ident,X+s*.009,-.033,Z,.005,.008,.017,'Solder termination',.0004)
      for i in range(5):
        cylinder(ident+' substrate witness pad','packages',ident,x+side*(w/2+.029),-.0376,z-.16+i*.077,.006,.0008,'Gold contact',12)

    # Exact old contact-plane contract; external plate envelope is updated.
    cube(ident+' compliant TIM','cooling-frame',ident,x,.0064,z,w*.92,.0008,d*.92,'TIM',0)
    cube(ident+' copper contact foot','cooling-frame',ident,x,.02115,z,w+.082,.0287,d+.082,'Machined copper',.004)
    # Opaque retention perimeter and corners remain solid while cover ghosts.
    for sx in [-1,1]:
      for sz in [-1,1]:
        X=x+sx*(w/2+.077);Z=z+sz*(d/2+.077)
        cylinder(ident+' board preload washer','board',ident,X,-.070,Z,.026,.002,'Solder termination',20,inner=.013)
        cylinder(ident+' retention stand-off','cooling-frame',ident,X,-.0125,Z,.015,.113,'Anodized retention',20)
        cube(ident+' mounting ear','cooling-frame',ident,x+sx*(w/2+.05),.056,z+sz*(d/2+.05),.112,.034,.112,'Anodized retention',.008)
        screw(ident+' captive plate screw','cooling-frame',X,.079,Z,.017)
    if ident.startswith('GPU'):
      for side in [-1,1]:
        cube(ident+' retaining side rail','cooling-frame',ident,x+side*(w/2+.027),.053,z,.027,.028,d+.11,'Anodized retention',.003)
        cube(ident+' retaining end rail','cooling-frame',ident,x,.053,z+side*(d/2+.027),w+.11,.028,.027,'Anodized retention',.003)
      # The actual photo shows a stepped cross-shaped copper pressure/cover face.
      a,b0,c=.118,.192,.270
      outline=[(-a,-c),(a,-c),(a,-b0),(b0,-b0),(b0,-a),(c,-a),(c,a),(b0,a),(b0,b0),(a,b0),(a,c),(-a,c),(-a,b0),(-b0,b0),(-b0,a),(-c,a),(-c,-a),(-b0,-a),(-b0,-b0),(-a,-b0)]
      polyprism(ident+' stepped copper cover','cooling',ident,[(x+X,z+Z)for X,Z in outline],.036,.081,'Machined copper',.005)
      # Visible corrugated-fin surround, not invented internal coolant channels.
      for side in [-1,1]:
       for j in range(16):
        Z=z-.277+j*.037
        cube(ident+' external fin','cooling-frame',ident,x+side*.288,.065,Z,.052,.035,.008,'Brushed nickel',.0007)
    else:
      outline=[(-.34,-.27),(.34,-.27),(.34,-.19),(.28,-.19),(.28,.25),(.20,.30),(-.20,.30),(-.28,.25),(-.28,-.19),(-.34,-.19)]
      polyprism('CPU shaped copper inspection cover','cooling',ident,[(x+X,z+Z)for X,Z in outline],.036,.079,'Machined copper',.006)
      for side in [-1,1]:
        # Bent-arm exterior is photo-guided, but adapted to legacy contact anchors.
        X=x+side*.36
        pts=[(X-side*.09,-1.78),(X+side*.12,-1.78),(X+side*.12,-1.36),(X+side*.055,-1.28),(X+side*.055,-.84),(X-side*.04,-.84),(X-side*.04,-1.35),(X-side*.09,-1.43)]
        polyprism('Forward coldplate long arm','cooling-frame','photo-guided copper arm',pts,.029,.061,'Machined copper',.010)
        for j in range(18):
          cube('External corrugated arm fin','cooling-frame','external fin',X+side*.045,.078,-1.73+j*.044,.065,.033,.008,'Brushed nickel',.0007)
    # These legacy ports are required for original global pipe alignment.
    for s in [-1,1]:
      X=x+s*(.28 if ident=='CPU' else .12)
      Z=z if ident=='CPU' else z+(d+.126)/2-.03
      cylinder(ident+' coolant port collar','cooling-frame','legacy plumbing interface',X,.083,Z,.031,.034,'Brushed nickel',24,inner=.018)

# Keep editable semantic component objects and modifiers in the Blender source.
for img in bpy.data.images:
    if img.source=='FILE':img.pack()
scene['approval']='PROTOTYPE ONLY. Photorealism acceptance required before wider replacement.'
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'compute-board-prototype.blend'),compress=True)

# The same exporter also works after manual edits to the saved .blend. It keeps
# independent CPU/GPU/cover nodes, repairs cut-edge UV islands and validates the
# normal-mapped tangent contract through the repository GLB adapter test.
runpy.run_path(str(HERE/'export_gltf.py'),run_name='__main__')
