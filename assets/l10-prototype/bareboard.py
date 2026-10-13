"""Original, evidence-guided bare board study. No vendor pixels/CAD are imported.

blender --background --factory-startup --python assets/l10-prototype/bareboard.py

The NVIDIA Figure 7 photograph supplies package-face and component-zone evidence,
not Lenovo package dimensions/netlists. Existing PA board/package anchors remain
authoritative. Normalized scene coordinates are NOT manufacturing dimensions.
"""
import bpy, bmesh, json, math, struct, hashlib, sys, os, tempfile
import numpy as np
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
from bare_finish import finish_maps, contact_occlusion
from preserve_finish_geometry import retain_geometry
ROOT = HERE.parents[1]
OUT = ROOT / 'app/static/models/l10-prototype'
TEX = HERE / 'textures'
L = json.loads((HERE / 'layout.json').read_text())
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for m in list(bpy.data.materials): bpy.data.materials.remove(m)
scene = bpy.context.scene
scene['assetId'] = 'dual-bare-compute-boards-r2'
scene['reference'] = 'NVIDIA Figure 7 visible packages and functional zones; retained Lenovo-based PA anchors'
scene['limits'] = 'Original visual approximation. No OEM CAD, chip floorplan, HBM count/layout, socket or serviceability claim.'
COL = {}
for layer in ['board', 'packages', 'network']:
    c = bpy.data.collections.new(layer); scene.collection.children.link(c); COL[layer] = c
M = {}

def image(name, values, linear=False):
    h,w,_ = values.shape
    img=bpy.data.images.new(name,width=w,height=h,alpha=True)
    img.colorspace_settings.name='Non-Color' if linear else 'sRGB'
    img.pixels.foreach_set(values.astype(np.float32).ravel())
    img.filepath_raw=str(TEX/(name+'.png'));img.file_format='PNG';img.save()
    return img

# Shared deterministic finish authoring changes only material/image resources.
finish=finish_maps(image)
pcb_img,pcb_mr,pcb_n=finish['pcb']
silicon={kind:finish[kind] for kind in ['cpu','gpu','network']}
gold_mr=finish['gold_mr'];metal_n=finish['metal_n']

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
        norm=m.node_tree.nodes.new('ShaderNodeNormalMap');norm.inputs['Strength'].default_value=.35
        m.node_tree.links.new(tex(normal).outputs['Color'],norm.inputs['Color']);m.node_tree.links.new(norm.outputs['Normal'],p.inputs['Normal'])
    m['authorship']='Original finish; no vendor image textures or measured BRDF';M[name]=m;return m

mat('Black solder mask',(.023,.027,.024),0,.5,pcb_img,pcb_mr,pcb_n)
mat('Black reverse solder mask',(.023,.027,.024),0,.5,pcb_img,pcb_mr)
mat('Laminate cut edge',(.066,.071,.050),0,.68)
mat('Package substrate',(.019,.024,.020),0,.44,finish['substrate_base'],finish['substrate_mr'])
mat('Bonded underfill',(.007,.009,.008),0,.58)
mat('Gold plated frame',(.58,.50,.29),.96,.25,None,gold_mr,metal_n)
mat('Gold board contacts',(.63,.47,.22),.96,.27)
mat('CPU nickel frame',(.46,.49,.49),.94,.26,None,finish['nickel_mr'])
for kind in ['cpu','gpu','network']:
    m=mat(kind.upper()+' exposed optical face',(.27,.3,.3),.72,.24,*silicon[kind])
    m['l10ThinFilmStrength']={'cpu':.21,'gpu':.23,'network':.20}[kind]
    m['l10ThinFilmThickness']={'cpu':410.,'gpu':455.,'network':390.}[kind]
    m['l10ThinFilmThicknessMap']='metallicRoughnessTexture.r: .5 = authored nm; [0,1] = [.88,1.12] multiplier; not AO'
mat('Die cut edge',(.11,.13,.14),.60,.28)
mat('Molded IC body',(.019,.021,.022),0,.57,finish['molding_base'],finish['molding_mr'])
mat('Ferrite power stage',(.052,.055,.056),0,.69,finish['ferrite_base'],finish['ferrite_mr'])
mat('Passive ceramic',(.17,.14,.095),0,.29,None,finish['ceramic_mr'])
mat('Solder fillet',(.48,.50,.51),.92,.24,None,finish['solder_mr'])
mat('Connector polymer',(.011,.014,.015),0,.48)
mat('Silkscreen ink',(.40,.44,.40),0,.65)
mat('Etched top marking',(.060,.066,.061),0,.61)
mat('Buried copper witness',(.026,.033,.029),0,.38)
mat('Dark nickel fastener',(.24,.26,.26),.91,.34)

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
    # Direct mesh creation avoids thousands of whole-scene operator/dependency
    # updates for tiny passives. Shape, UV axes and bevel contract are unchanged.
    me=bpy.data.meshes.new(name)
    me.from_pydata([(-w/2,-d/2,-h/2),(w/2,-d/2,-h/2),(w/2,d/2,-h/2),(-w/2,d/2,-h/2),(-w/2,-d/2,h/2),(w/2,-d/2,h/2),(w/2,d/2,h/2),(-w/2,d/2,h/2)],[],[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])
    me.update();o=bpy.data.objects.new(name,me);COL[layer].objects.link(o);o.location=coord(x,y,z)
    o.data.materials.append(M[material]);tag(o,layer,component,bi);uv(o)
    if bevel:
        mod=o.modifiers.new('Manufactured edge break','BEVEL');mod.width=min(bevel,h*.22);mod.segments=2 if max(w,d)>=.08 else 1
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
def topface(name,bi,x,y,z,w,d,kind='gpu',layer='packages',component=None):
    me=bpy.data.meshes.new(name);me.from_pydata([coord(x-w/2,y,z-d/2),coord(x+w/2,y,z-d/2),coord(x+w/2,y,z+d/2),coord(x-w/2,y,z+d/2)],[],[(0,3,2,1)]);me.update()
    o=bpy.data.objects.new(name,me);COL[layer].objects.link(o);me.materials.append(M[kind.upper()+' exposed optical face']);tag(o,layer,component or name.rsplit(' / ',1)[0],bi);uv(o)
    return o

def ribbon(name,layer,component,bi,path,y,width=.002):
    # Shallow solder-mask witness over copper. This is local visual completion,
    # not an invented visible gold netlist or an exposed high-current conductor.
    verts=[];faces=[]
    for (x0,z0),(x1,z1) in zip(path,path[1:]):
        length=math.hypot(x1-x0,z1-z0)
        nx=-(z1-z0)/length*width/2;nz=(x1-x0)/length*width/2;k=len(verts)
        verts.extend([coord(x0+nx,y,z0+nz),coord(x1+nx,y,z1+nz),coord(x1-nx,y,z1-nz),coord(x0-nx,y,z0-nz)]);faces.append((k,k+1,k+2,k+3))
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update()
    o=bpy.data.objects.new(name,me);COL[layer].objects.link(o);me.materials.append(M['Buried copper witness']);tag(o,layer,component,bi);uv(o)
    return o

def plated_smd(name,layer,component,bi,x,y,z,w,d,h=.008,material='Passive ceramic'):
    # The solder pads touch the board; the ceramic/moulding occupies the centre,
    # with two real end caps. No unsupported floating silver rectangles.
    box(name+' body',layer,component,bi,x,y+h/2,z,w*.68,h,d,material,.0008)
    for side in [-1,1]:
        box(name+' solder pad',layer,component,bi,x+side*w*.405,y+.0006,z,w*.22,.0012,d+.003,'Solder fillet',.0002)
        box(name+' plated cap',layer,component,bi,x+side*w*.415,y+h*.40,z,w*.17,h*.80,d+.0005,'Solder fillet',.0003)

def qfn(name,layer,component,bi,x,y,z,w,d,h=.015,material='Molded IC body'):
    box(name+' solder seat',layer,component,bi,x,y+.001,z,w+.006,.002,d+.006,'Bonded underfill',.0005)
    box(name+' moulded body',layer,component,bi,x,y+.002+h/2,z,w,h,d,material,.0017)
    # Sparse visible perimeter pad groups imply lead pitch at this scale without
    # pretending to reconstruct the pin count of an undisclosed chip.
    for side in [-1,1]:
        for k in range(4):
            box(name+' solder toe',layer,component,bi,x+side*(w/2+.001),y+.002,z+(k-1.5)*d*.20,.008,.003,d*.10,'Solder fillet',.0003)
    box(name+' etched witness',layer,component,bi,x-w*.15,y+.002+h+.0001,z-d*.2,w*.32,.0002,.002,'Etched top marking',0)

def mounting_fastener(name,layer,component,bi,x,y,z):
    ring(name+' washer',layer,component,bi,x,y+.001,z,.023,.009,.002,'CPU nickel frame')
    ring(name+' recessed hex head',layer,component,bi,x,y+.0035,z,.015,.006,.005,'Dark nickel fastener')
    box(name+' recess floor',layer,component,bi,x,y+.0011,z,.012,.0002,.012,'Bonded underfill',0)

for bi,dx in [(0,0),(1,1.93)]:
    print('Building compute board',bi+1,flush=True)
    b=L['board'];cx=b['x']+dx;cz=b['z'];t=b['top'];prefix=f'Board{bi+1}'
    pcb=box(prefix+' / routed FR4','board','pcb',bi,cx,(t+b['bottom'])/2,cz,b['width'],t-b['bottom'],b['depth'],'Black solder mask',0)
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
    pcb.data.materials.append(M['Black reverse solder mask'])
    for p in pcb.data.polygons:
        p.material_index=2 if p.normal.z<-.5 else 1 if abs(p.normal.z)<.5 else 0
    edge=pcb.modifiers.new('Single PCB edge break after bores','BEVEL');edge.width=.0005;edge.segments=1;edge.material=1
    weighted=pcb.modifiers.new('PCB weighted normals','WEIGHTED_NORMAL');weighted.keep_sharp=True

    def B(name,x,z,w,d,h=.02,material='Molded IC body',y=None):
        return box(prefix+' / '+name,'board',name,bi,x+dx,t+h/2+.001 if y is None else y,z,w,h,d,material)
    def smd(name,x,z,w=.026,d=.019,h=.008):
        plated_smd(prefix+' / '+name,'board',name,bi,x+dx,t,z,w,d,h)
    # Photo-visible conditioning: two outer GPU VRM strips, the middle GPU
    # strip, and a transverse CPU supply band. Pitch is approximate; the zone
    # topology is intentional. Repetition here models actual repeated phases.
    for gx in [-1.755,-.965,-.175]:
      for i,z in enumerate([-2.53,-2.385,-2.24,-2.095,-1.95]):
        B('GPU supply molded power stage',gx,z,.088,.105,.031,'Ferrite power stage')
        B('GPU supply driver',gx,z+.058,.060,.023,.012)
        for s in [-1,1]:B('Power terminal',gx+s*.045,z,.013,.064,.010,'Solder fillet')
        B('Choke pressed top seam',gx,z-.021,.052,.0018,.0004,'Etched top marking',t+.0322)
        sides=[-1] if gx<-1.7 else [1] if gx>-.2 else [-1,1]
        for side in sides:
            smd('Phase decoupling pair',gx+side*.057,z-.025,.019,.024,.010)
            smd('Phase decoupling pair',gx+side*.057,z+.014,.019,.018,.007)
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
    # Low-relief short fan-outs connect photographed functional regions. They
    # remain under solder mask and terminate beneath component pads; hidden
    # multilayer routing is deliberately not fabricated.
    for x in [-1.60,-1.43,-1.26,-1.09,-.84,-.67,-.50,-.33]:
        for offset in [-.009,0,.009]:
            ribbon(prefix+' CPU supply copper witness','board','mask-covered fanout',bi,[(x+dx+offset,-1.51),(x+dx+offset,-1.47),(x+dx+offset+.026,-1.444)],t+.0002,.0016)
    for x,z in [(-1.665,-.69),(-.49,-.66),(-1.53,-2.655),(-.66,-2.655)]:
        for i in range(3):
            ribbon(prefix+' local controller fanout','board','mask-covered fanout',bi,[(x+dx-.02+i*.008,z+.024),(x+dx-.02+i*.008,z+.048),(x+dx-.04+i*.008,z+.068)],t+.0002,.0013)

    for p in L['packages']:
        ident=p['id'];x=p['x']+dx+(.010 if bi==1 and ident!='CPU' else 0);z=p['z'];w=p['width'];d=p['depth'];name=prefix+'/'+ident
        def P(label,X,Y,Z,W,H,D,material,bevel=.0015):
            return box(name+' / '+label,'packages',name,bi,X,Y,Z,W,H,D,material,bevel)
        box(name+' bonded footprint','board','bonded footprint',bi,x,t+.001,z,w+.045,.002,d+.045,'Bonded underfill')
        P('underfill',x,-.0617,z,w+.022,.0176,d+.022,'Bonded underfill')
        P('organic package substrate',x,-.0475,z,w+.056,.0108,d+.056,'Package substrate')
        P('bonded inner support',x,-.0303,z,w-.095,.0236,d-.095,'Package substrate',.001)
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
        P('die bonded edge',x,-.0065,z,dw+.012,.024,dd+.012,'Die cut edge',.0015)
        topface(name+' / exposed silicon',bi,x,.0056,z,dw-.001,dd-.001,'cpu' if ident=='CPU' else 'gpu')
        # GPU exposes broad gold-toned shoulder regions in the reference. These
        # are uniform contact appearance, not invented separate HBM die meshes.
        if ident!='CPU':
            for side in [-1,1]:
                # Preserve the public-photo shoulder silhouette. Two shallow
                # seams add substrate/metal layering without inventing HBM die
                # count, BGA solder balls or a socket/service mechanism.
                P('contact shoulder seat',x+side*.203,-.0145,z,.102,.008,.387,'Package substrate',.0007)
                P('visible contact shoulder',x+side*.203,-.007,z,.094,.007,.375,'Gold plated frame',.001)
                for zz in [-.101,.101]:P('shoulder fine machined witness',x+side*.203,-.0034,z+zz,.084,.00015,.0007,'Die cut edge',0)
        for side in [-1,1]:
          for k in range(7 if ident=='CPU' else 9):
            count=7 if ident=='CPU' else 9;xx=x+(k-(count-1)/2)*.026
            P('substrate termination',xx,-.037,z+side*(d/2-.029),.015,.007,.009,'Solder fillet',.0003)
        # Small perimeter bypasses are visible in Figure 7; they do not simulate
        # BGA/socket contacts or imply removable CPU/GPU modules.
        if ident=='CPU':
          for side in [-1,1]:
            for k in range(6):P('package bypass',x+side*.175,-.034,z-.11+k*.044,.019,.007,.013,'Passive ceramic',.0003)

# Three user-selected concept network adapters. Package/board details borrow
# photographic material vocabulary only; they are not claimed BF3/CX7 OEM CAD.
# Cages, lids, screws and animation remain owned by the existing WebGL scene.
for card_id,cx,cz,w,d,bottom,top in [
    ('BF3-L',-1.29,1.825,.90,2.51,-.104,-.092),
    ('BF3-R',1.29,1.825,.90,2.51,-.104,-.092),
    ('CX7-R',1.3505,2.60,.50,.90,.0185,.0275)]:
    print('Building network card',card_id,flush=True)
    bi=0 if card_id=='BF3-L' else 1
    pcb=box(card_id+' / black multilayer PCB','network',card_id,bi,cx,(bottom+top)/2,cz,w,top-bottom,d,'Black solder mask',0)
    pcb.data.materials.append(M['Laminate cut edge'])
    pcb.data.materials.append(M['Black reverse solder mask'])
    for poly in pcb.data.polygons:
        poly.material_index=2 if poly.normal.z<-.5 else 1 if abs(poly.normal.z)<.5 else 0
    lower=card_id.startswith('BF3')
    holes=[(cx+sx*.38,z) for sx in [-1,1] for z in [.65,2.66]] if lower else [(cx+sx*.213,2.19) for sx in [-1,1]]
    for x,z in holes:
        bpy.ops.mesh.primitive_cylinder_add(vertices=20,radius=.011 if lower else .008,depth=.06,location=coord(x,(top+bottom)/2,z))
        cut=bpy.context.object;mod=pcb.modifiers.new('Open mounting bore','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cut
        bpy.context.view_layer.objects.active=pcb;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cut,do_unlink=True)
        ring(card_id+' / plated mounting annulus','network',card_id,bi,x,top+.001,z,.022 if lower else .015,.011 if lower else .008,.002,'Gold board contacts')
    uv(pcb)
    # Boolean sidewalls are created after the initial material assignment; make
    # their laminate surface explicit rather than inheriting top solder mask.
    for poly in pcb.data.polygons:
        poly.material_index=2 if poly.normal.z<-.5 else 1 if abs(poly.normal.z)<.5 else 0
    edge=pcb.modifiers.new('Single PCB edge break after bores','BEVEL');edge.width=.00035;edge.segments=1;edge.material=1
    weighted=pcb.modifiers.new('PCB weighted normals','WEIGHTED_NORMAL');weighted.keep_sharp=True
    def N(label,x,z,ww,dd,hh=.014,material='Molded IC body',yy=None):
        return box(card_id+' / '+label,'network',card_id,bi,x,top+hh/2+.001 if yy is None else yy,z,ww,hh,dd,material,.001)
    chip_z=1.44 if lower else 2.435
    chip_w,chip_d=(.47,.52) if lower else (.26,.25)
    # Different DPU and NIC package silhouettes, low profile to respect the
    # pre-existing 1U envelope. CPU/GPU counts are unaffected by these ASICs.
    chip_base=top+.005;substrate_h=.010 if lower else .007
    N('bonded ASIC underfill',cx,chip_z,chip_w+.018,chip_d+.018,.005,'Bonded underfill',top+.0025)
    N('ASIC organic substrate',cx,chip_z,chip_w,chip_d,substrate_h,'Package substrate',chip_base+substrate_h/2)
    frame_y=chip_base+substrate_h+.009
    frame_h=.018;frame_border=.018 if lower else .013
    for side in [-1,1]:
        N('gold plated package frame',cx+side*(chip_w/2-frame_border/2),chip_z,frame_border,chip_d,frame_h,'Gold plated frame',frame_y)
        N('gold plated package frame',cx,chip_z+side*(chip_d/2-frame_border/2),chip_w-frame_border*2,frame_border,frame_h,'Gold plated frame',frame_y)
    die_w,die_d=(.273,.284) if lower else (.140,.144)
    die_top=top+.058 if lower else top+.053
    die_base=chip_base+substrate_h
    N('bonded ASIC die cut edge',cx,chip_z,die_w+.007,die_d+.007,die_top-die_base,'Die cut edge',(die_top+die_base)/2)
    topface(card_id+' / visible ASIC optical surface',bi,cx,die_top+.0001,chip_z,die_w,die_d,'network','network',card_id)
    for side in [-1,1]:
        for k in range(6 if lower else 4):
            count=6 if lower else 4
            plated_smd(card_id+' ASIC bypass','network',card_id,bi,cx+side*(chip_w*.36),chip_base+substrate_h,chip_z+(k-(count-1)/2)*(.054 if lower else .037),.019 if lower else .012,.025 if lower else .019,.004)
    if lower:
        # Photo-inspired memory shoulders, supply phases and high-speed front
        # connector conditioning are different functional zones, not an even
        # carpet of identical decorative components.
        for side in [-1,1]:
            for z in [1.22,1.46,1.70]:qfn(card_id+' memory device','network',card_id,bi,cx+side*.323,top,z,.105,.183,.019)
        for x,z in [(-.17,.98),(.01,.98),(.19,.98),(-.155,1.895),(.045,1.895)]:
            qfn(card_id+' peripheral memory','network',card_id,bi,cx+x,top,z,.138,.126,.020)
        for index,x in enumerate([-.23,-.055,.12]):
            N('inductor supply phase',cx+x,.777,.103,.098,.026,'Ferrite power stage')
            qfn(card_id+' supply driver','network',card_id,bi,cx+x,top,.886,.066,.048,.012)
            for offset in [-.049,.048]:plated_smd(card_id+' power bypass','network',card_id,bi,cx+x+offset,top,.682,.027,.048,.014)
        for x,z,ww,dd in [(-.23,2.21,.136,.15),(.09,2.13,.142,.136),(.25,2.36,.112,.111),(-.13,2.48,.087,.115)]:
            qfn(card_id+' controller and clock','network',card_id,bi,cx+x,top,z,ww,dd,.020)
            for offset in [-.047,0,.047]:plated_smd(card_id+' local termination','network',card_id,bi,cx+x+offset,top,z+dd/2+.027,.022,.019,.007)
        for x,z in [(-.24,2.04),(.24,2.02),(-.35,2.26),(.35,2.17),(.04,2.41),(-.28,2.51),(.10,2.67)]:
            for i,(dx,dz) in enumerate([(0,0),(.038,.006),(.003,.037)]):plated_smd(card_id+' signal conditioning','network',card_id,bi,cx+x+dx,top,z+dz,.023,.020,.008 if i==0 else .006)
        for x in [-.24,.0,.24]:
            for lane in [-.010,0,.010]:ribbon(card_id+' front signal mask witness','network',card_id,bi,[(cx+x+lane,2.53),(cx+x+lane,2.65),(cx+x+lane+.035,2.685),(cx+x+lane+.035,2.77)],top+.0002,.0015)
        # Plated front contact field lies behind the separately-owned cages.
        for x in ([-.23,.16] if card_id=='BF3-L' else [-.295,.08]):
            N('connector insulator foot',cx+x,2.767,.255,.030,.023,'Connector polymer')
            for k in range(8):N('connector gold contact',cx+x+(k-3.5)*.026,2.756,.010,.011,.0015,'Gold board contacts',top+.024)
        for x,z in [(-.35,.94),(.32,2.46),(-.30,2.72)]:
            N('assembly ink witness',cx+x,z,.045,.003,.0003,'Silkscreen ink',top+.00025)
            ring(card_id+' local test via','network',card_id,bi,cx+x+.018,top+.0008,z+.014,.005,.0015,.0016,'Gold board contacts')
    else:
        # The compact upper NIC is seated above the lower card. Keep every part
        # behind z=2.7915 so the two retained metal cages remain unobstructed.
        for x,z in [(-.205,2.342),(.205,2.342),(-.205,2.491),(.205,2.491)]:
            qfn(card_id+' signal controller','network',card_id,bi,cx+x,top,z,.062,.087,.012)
        for x in [-.116,0,.116]:
            N('NIC supply choke',cx+x,2.681,.069,.060,.017,'Ferrite power stage')
            plated_smd(card_id+' NIC decoupling','network',card_id,bi,cx+x,top,2.729,.032,.018,.008)
        for side in [-1,1]:
            for z in [2.567,2.603]:plated_smd(card_id+' high speed termination','network',card_id,bi,cx+side*.205,top,z,.023,.019,.007)
        for x in [-.07,.07]:qfn(card_id+' NIC auxiliary control','network',card_id,bi,cx+x,top,2.193,.071,.052,.011)
        for x in [-.114,.115]:
            for lane in [-.008,0,.008]:ribbon(card_id+' NIC pair mask witness','network',card_id,bi,[(cx+x+lane,2.55),(cx+x+lane,2.60),(cx+x+lane*.5,2.625)],top+.0002,.0012)

contact_occlusion(image,COL,M)

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
        key=(o.get('boardIndex',-1),o['component'] if layer in {'packages','network'} else layer)
        groups.setdefault(key,[]).append(o)
    for (bi,key),originals in groups.items():
        copies=[]
        for original in originals:
            ev=original.evaluated_get(deps);me=bpy.data.meshes.new_from_object(ev,preserve_all_data_layers=True,depsgraph=deps)
            copy=bpy.data.objects.new(original.name,me);copy.matrix_world=original.matrix_world.copy();export_col.objects.link(copy);copies.append(copy)
            # Boolean and bevel faces did not exist when the source was UV'd.
            # Reproject each evaluated original before joining: otherwise newly
            # generated edge faces can inherit collapsed UVs and zero tangents.
            # The unchanged service layer retains its accepted UVs verbatim.
            if layer!='io':uv(copy)
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
# Stage on the destination volume. A rejected/missing baseline or interrupted
# export must never replace the published GLB with an unvalidated candidate.
# Authored maps and the editable .blend are intentionally still saved above.
with tempfile.TemporaryDirectory(prefix='.bare-finish-',dir=str(OUT)) as staging:
    candidate=Path(staging)/path.name
    bpy.ops.export_scene.gltf(filepath=str(candidate),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_texcoords=True,export_normals=True,export_tangents=True,export_materials='EXPORT',export_extras=True,export_animations=False,export_cameras=False,export_lights=False,export_image_format='AUTO',export_draco_mesh_compression_enable=False)
    data=candidate.read_bytes();ln=struct.unpack_from('<I',data,12)[0];doc=json.loads(data[20:20+ln]);binary=data[28+ln:]
    doc['extras']={'id':'dual-bare-compute-boards-r2','prototypeRevision':5,'replacesComputeBoards':[0,1],'replacesServiceGeometry':True,'replacesNetworking':True,'networkCards':['BF3-L','BF3-R','CX7-R'],'bareBoardOnly':True,'packageCount':6,'cpuCount':2,'gpuCount':4,'coordinateUnits':'Existing PA raw units. Shared renderer scale [.688,1,.802] required.','approval':'OPT-IN visual study, not photorealism accepted','referenceConfidence':'User photographs and Figure 7 inform visible package faces and functional zones. Retained PA positions and dimensions; ASIC die patterns, concealed structure and network package geometry are original concept approximations, not OEM CAD or chip floorplans.'}
    for mesh in doc['meshes']:
        for primitive in mesh['primitives']:
            if 'normalTexture' not in doc['materials'][primitive['material']]:primitive['attributes'].pop('TANGENT',None)
    for material in doc['materials']:
        if material['name'].startswith('Black solder mask / '):
            material.setdefault('extras',{})['l10ContactBoard']=material['name'].split(' / ')[1].replace(' contact AO','')
            material['name']='Black solder mask'
    doc,binary=retain_geometry(ROOT,doc,binary)
    doc['extras']['acceptance85FinishRevision']=2
    js=json.dumps(doc,separators=(',',':')).encode();js+=b' '*((-len(js))%4)
    blob=struct.pack('<III',0x46546c67,2,28+len(js)+len(binary))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(binary),0x004e4942)+binary
    candidate.write_bytes(blob)
    os.replace(candidate,path)
triangles=sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes'] for p in m['primitives'])
print('BARE_BOARD_ASSET_RESULT '+json.dumps({'id':doc['extras']['id'],'sha256':hashlib.sha256(blob).hexdigest(),'bytes':len(blob),'triangles':triangles,'nodes':len(doc['nodes']),'primitives':sum(len(m['primitives']) for m in doc['meshes']),'materials':len(doc['materials']),'images':len(doc.get('images',[])),'sourceObjects':sum(len(c.objects) for c in COL.values()),'layers':['board','packages','io','network']}))
