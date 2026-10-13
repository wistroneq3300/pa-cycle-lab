"""Deterministic finish maps and geometry-grounded contact occlusion.

These are authored PBR approximations, not measured surfaces or die floorplans.
No geometry, camera, light, emission or component population is changed here.
"""
import math
import bpy
import numpy as np
from mathutils import Vector


def finish_maps(image):
    n = 1024
    v, u = np.mgrid[0:n, 0:n].astype(np.float32) / (n - 1)
    rng = np.random.default_rng(20261013)

    def noise():
        return rng.uniform(-1, 1, (n, n)).astype(np.float32)

    def soften(a, steps):
        for _ in range(steps):
            a = (a * 4 + np.roll(a, 1, 0) + np.roll(a, -1, 0)
                 + np.roll(a, 1, 1) + np.roll(a, -1, 1)) / 8
        return a

    def rgba():
        return np.ones((n, n, 4), np.float32)

    def half(pixels):
        # Area averaging prevents high frequency noise aliasing. Scalar PBR
        # channels do not need the silicon colour maps' close-up resolution.
        return pixels.reshape(n//2,2,n//2,2,4).mean(axis=(1,3))

    grain = soften(noise(), 1)
    resin = soften(noise(), 12)

    def mr(name, rough, metal, optical_thickness=1):
        pixels = rgba()
        # Optical materials reserve unused MR.r for normalized thin-film
        # thickness: .5 is authored nm, [0,1] maps to [.88,1.12] * authored nm.
        # This is not AO: contact occlusion has its own separate texture.
        pixels[:, :, 0] = optical_thickness
        pixels[:, :, 1] = rough
        pixels[:, :, 2] = metal
        return image(name, half(pixels), True)

    def normal(name, height, amount):
        gy, gx = np.gradient(height)
        pixels = rgba()
        pixels[:, :, 0] = .5 - gx * amount
        pixels[:, :, 1] = .5 - gy * amount
        return image(name, half(pixels), True)

    # Isotropic resin microtexture: no weave, repeated lines or periodic grain.
    pcb = rgba()
    pcb[:, :, :3] = np.array([.049, .055, .051])[None, None, :]
    pcb[:, :, :3] += (grain * .0018 + resin * .004)[:, :, None]
    maps = {
        'pcb': (image('bare-pcb-soldermask', half(pcb)),
                mr('bare-pcb-metallicroughness', .39 + grain * .025 + resin * .045, 0),
                normal('bare-pcb-micro-normal', grain * .013 + resin * .018, .8)),
    }

    for kind in ('cpu','gpu','network'):
        # Heterogeneous optical density, not a measured floorplan or HBM count.
        # The types refer to visual motifs: repeated logic, densely etched
        # parallel arrays, and paired I/O streets. Region means stay within
        # .006 sRGB; only fine structure/optical thickness makes them distinct.
        regions={
            'cpu':[(.065,.065,.59,.68,6,14,'logic'),(.677,.065,.258,.68,4,25,'array'),
                   (.065,.775,.87,.16,20,3,'io')],
            'gpu':[(.065,.065,.17,.87,3,33,'array'),(.255,.065,.455,.415,6,9,'logic'),
                   (.255,.505,.455,.43,5,11,'logic'),(.73,.065,.205,.66,4,26,'array'),
                   (.73,.752,.205,.183,8,4,'io')],
            'network':[(.065,.065,.54,.58,5,8,'logic'),(.632,.065,.303,.87,5,23,'array'),
                       (.065,.676,.54,.259,14,4,'io')]
        }[kind]
        density=np.zeros_like(u);polish=grain*.004;relief=np.zeros_like(u)
        thickness=np.full_like(u,.5)
        for region,(x,y,w,h,columns,rows,style) in enumerate(regions):
            a=(u-x)/w;b=(v-y)/h;inside=(a>0)&(a<1)&(b>0)&(b<1)
            cx=np.floor(a*columns);cy=np.floor(b*rows)
            fu=np.mod(a*columns,1);fv=np.mod(b*rows,1)
            street=(fu<.026)|(fu>.974)|(fv<.038)|(fv>.962)
            cell=np.mod(cx*7+cy*11+np.floor(cy/4)*3,17)/16-.5
            if style=='logic':
                # Off-centre dense comb, smaller register island and partial
                # perimeter witness give each cell substructure, not a grid.
                comb=(np.mod(fu*11,1)<.20)&(fu>.12)&(fu<.62)&(fv>.18)&(fv<.79)
                island=((fu>.69)&(fu<.88)&(fv>.20)&(fv<.54))
                cross=(np.mod(fv*8,1)<.16)&(fu>.69)&(fu<.88)
                ring=((abs(fu-.095)<.012)|(abs(fu-.915)<.012))&(fv>.10)&(fv<.88)
                pattern=comb*.025+island*.011+cross*.020+ring*.030
                film=cell*.28+comb*.15-island*.13
                tone=.006
            elif style=='array':
                # Fine horizontal word lines with narrow vertical decoder
                # streets. Different aspect/frequency from the logic motifs.
                comb=(np.mod(fv*10,1)<.20)&(fu>.10)&(fu<.87)
                decoder=(fu>.90)|(abs(fu-.48)<.021)
                pattern=comb*.030+decoder*.020
                film=cell*.19-comb*.15+decoder*.13
                tone=.003
            else:
                paired=(abs(fu-.30)<.045)|(abs(fu-.58)<.045)
                jog=((fv>.33)&(fv<.42)&(fu>.30)&(fu<.78))
                pattern=paired*.030+jog*.020
                film=cell*.21+paired*.18-jog*.12
                tone=0
            density+=inside*(tone+cell*.012-street*.026-pattern)
            polish+=inside*(street*.010+pattern*.24+(region%3)*.003)
            relief+=inside*(street*.00065+pattern*.018)
            thickness+=inside*(film+.07*np.sin(a*9.1+b*4.3)+(region%3-1)*.07)
        guard=((abs(u-.039)<.0015)|(abs(u-.961)<.0015)|
               (abs(v-.039)<.0015)|(abs(v-.961)<.0015))
        guard&=(u>.036)&(u<.964)&(v>.036)&(v<.964)
        density-=guard*.060
        thickness=np.clip(thickness,.12,.88)
        silicon = rgba()
        # Silicon's neutral reflectance is higher than the earlier paint-like
        # F0 approximation. Colour dispersion remains reflection-only at runtime.
        pigments = {'cpu': [.535,.551,.560], 'gpu': [.540,.554,.570],
                    'network': [.528,.545,.560]}
        for k, base in enumerate(pigments[kind]):
            silicon[:, :, k] = base + density + grain*.001
        maps[kind] = (
            image('bare-'+kind+'-silicon-finish', silicon),
            mr('bare-'+kind+'-silicon-metallicroughness',
               .111 + polish, .90, thickness),
            normal('bare-'+kind+'-silicon-normal', relief, .5))

    # A lapped metal has one machining direction; stochastic line spacing
    # avoids the old sine beat pattern without inventing random scratches.
    lines = rng.uniform(-1, 1, (n, 1)).astype(np.float32)
    lines = (lines + np.roll(lines, 1, 0) + np.roll(lines, -1, 0)) / 3
    machining = np.broadcast_to(lines, (n,n)) * .009 + grain*.002
    maps['gold_mr'] = mr('bare-gold-metallicroughness', .205 + lines*.015 + resin*.018, .96)
    maps['metal_n'] = normal('bare-metal-machining-normal', machining, .65)
    for name, rough, variation, metal in [
            ('substrate',.44,.055,0), ('molding',.57,.045,0),
            ('ceramic',.29,.027,0), ('ferrite',.69,.055,0),
            ('nickel',.26,.024,.94), ('solder',.24,.031,.92)]:
        if name=='molding':
            edge=np.minimum.reduce([u,v,1-u,1-v])
            top=np.clip((edge-.035)/.13,0,1)
            rough=.62-.09*top*top*(3-2*top)
        maps[name+'_mr'] = mr('bare-'+name+'-metallicroughness',
                              rough + grain*variation + resin*variation, metal)

    # Generic laser/mould witnesses, not logos or fabricated vendor numbers.
    # These texture details refine existing component bodies without adding
    # duplicate geometry, random components, emissive markings or a fake BOM.
    molding=rgba();molding[:,:,:3]=[.146,.157,.164]
    molding[:,:,:3]+=(grain*.0025+resin*.007)[:,:,None]
    dot=((u-.14)**2+(v-.16)**2)<.027**2
    laser=np.zeros_like(u,dtype=bool)
    # Two unbranded groups of segmented laser witnesses. Shapes deliberately
    # do not transcribe a vendor mark, part identifier, rating or lot number.
    strokes=[[(0,0,0,.065),(0,.065,.038,.065),(.038,.065,.038,.025),(0,.025,.038,.025)],
             [(0,0,.038,0),(.038,0,.038,.065),(0,.033,.038,.033)],
             [(0,0,0,.065),(0,0,.038,0),(0,.065,.038,.065)],
             [(0,0,.038,0),(.038,0,.038,.065),(0,.065,.038,.065),(.004,.033,.034,.033)]]
    for row in range(2):
        for col in range(6 if row==0 else 4):
            x=.255+col*.078;y=.35+row*.155
            for ax,ay,bx,by in strokes[(col+row)%len(strokes)]:
                if ax==bx:
                    laser|=(abs(u-(x+ax))<.006)&(v>y+min(ay,by)-.004)&(v<y+max(ay,by)+.004)
                else:
                    laser|=(abs(v-(y+ay))<.006)&(u>x+min(ax,bx)-.004)&(u<x+max(ax,bx)+.004)
    molding[:,:,:3]+=(dot*.075+laser*.130)[:,:,None]
    maps['molding_base']=image('bare-molding-finish',half(molding))
    ferrite=rgba();ferrite[:,:,:3]=[.242,.250,.255]
    ferrite[:,:,:3]+=(grain*.002+resin*.008)[:,:,None]
    maps['ferrite_base']=image('bare-ferrite-finish',half(ferrite))
    substrate=rgba();substrate[:,:,:3]=[.137,.162,.142]
    substrate[:,:,:3]+=(grain*.003+resin*.007)[:,:,None]
    substrate_fanout=(np.mod((u+v)*48,1)<.12)&((u<.15)|(u>.85)|(v<.13)|(v>.87))
    substrate[:,:,:3]+=substrate_fanout[:,:,None]*.008
    maps['substrate_base']=image('bare-substrate-finish',half(substrate))
    return maps


def board_surface(image, suffix, lo, hi, parts, bounds):
    """Small assembly courtyards/designators anchored to existing real meshes.

    No full circuit netlist, arbitrary component islands or decorative traces.
    Reference designators are original editorial assembly witnesses, not a BOM.
    """
    n=512; width,depth=hi[0]-lo[0],hi[1]-lo[1]
    rng=np.random.default_rng(731)
    base=np.ones((n,n,4),np.float32);base[:,:,:3]=[.049,.055,.051]
    base[:,:,:3]+=rng.uniform(-.001,.001,(n,n,1))
    occupied=np.zeros((n,n),bool)

    def pixel(x,y):
        return int(round((x-lo[0])/width*(n-1))),int(round((y-lo[1])/depth*(n-1)))

    for o in parts:
        a,b=bounds[o.name]
        if b[2]<=hi[2]+.001:continue
        x0,y0=pixel(a[0],a[1]);x1,y1=pixel(b[0],b[1])
        occupied[max(0,y0):min(n,y1+1),max(0,x0):min(n,x1+1)]=True
    silk=np.zeros((n,n),np.float32);copper=np.zeros_like(silk)

    def line(target,x0,y0,x1,y1,value):
        steps=max(abs(x1-x0),abs(y1-y0),1)
        xx=np.rint(np.linspace(x0,x1,steps+1)).astype(int)
        yy=np.rint(np.linspace(y0,y1,steps+1)).astype(int)
        valid=(xx>=0)&(xx<n)&(yy>=0)&(yy<n)
        target[yy[valid],xx[valid]]=np.maximum(target[yy[valid],xx[valid]],value)

    glyphs={
        '0':['111','101','101','101','111'],'1':['010','110','010','010','111'],
        '2':['110','001','010','100','111'],'3':['110','001','010','001','110'],
        '4':['101','101','111','001','001'],'5':['111','100','110','001','110'],
        '6':['011','100','111','101','111'],'7':['111','001','010','010','010'],
        '8':['111','101','111','101','111'],'9':['111','101','111','001','110'],
        'U':['101','101','101','101','111'],'L':['100','100','100','100','111'],
        'C':['111','100','100','100','111']}

    def label(x,y,text):
        if x<2 or y<2 or x+len(text)*4>=n-2 or y+5>=n-2:return
        if occupied[y-1:y+7,x-1:x+len(text)*4+1].any():return
        for k,char in enumerate(text):
            for row,bits in enumerate(glyphs[char]):
                for col,bit in enumerate(bits):
                    if bit=='1':silk[y+4-row,x+k*4+col]=.67

    counts={'U':0,'L':0,'C':0};detail_count=0
    for o in parts:
        if not o.data.materials:continue
        material=o.data.materials[0].name
        a,b=bounds[o.name];w,d=b[0]-a[0],b[1]-a[1]
        if a[2]>hi[2]+.008 or b[2]<hi[2]+.008:continue
        code='U' if material=='Molded IC body' else 'L' if material=='Ferrite power stage' else 'C' if material=='Passive ceramic' else None
        if not code or min(w,d)<.021 or max(w,d)>.26:continue
        counts[code]+=1
        if code=='C' and counts[code]%5:continue
        x0,y0=pixel(a[0]-.005,a[1]-.005);x1,y1=pixel(b[0]+.005,b[1]+.005)
        corner=max(2,min(5,(x1-x0)//4,(y1-y0)//4))
        for xx,yy,sx,sy in [(x0,y0,1,1),(x1,y0,-1,1),(x0,y1,1,-1),(x1,y1,-1,-1)]:
            line(silk,xx,yy,xx+sx*corner,yy,.38)
            line(silk,xx,yy,xx,yy+sy*corner,.38)
        label(x0,y0-7,code+str(counts[code]).zfill(2))
        detail_count+=1
    # Only tiny mask-covered escapes beside the existing QFN solder toes.
    # They stop locally instead of asserting hidden multilayer connections.
    bodies=[o for o in parts if 'moulded body' in o.name]
    for o in parts:
        if 'solder toe' not in o.name or not bodies:continue
        a,b=bounds[o.name];x=(a[0]+b[0])/2;y=(a[1]+b[1])/2
        body=min(bodies,key=lambda q:abs(x-(bounds[q.name][0][0]+bounds[q.name][1][0])/2)+abs(y-(bounds[q.name][0][1]+bounds[q.name][1][1])/2))
        c,e=bounds[body.name];sx=1 if x>(c[0]+e[0])/2 else -1
        x0,y0=pixel(x,y);x1,y1=pixel(x+sx*.014,y)
        line(copper,x0,y0,x1,y1,1)
    silk[occupied]=0;copper[occupied]=0
    base[:,:,:3]+=silk[:,:,None]*np.array([.19,.20,.18])+copper[:,:,None]*.021
    print('PCB_SURFACE '+suffix+' anchoredWitnesses='+str(detail_count),flush=True)
    return image('bare-'+suffix+'-pcb-finish',base)


def contact_occlusion(image, collections, materials):
    """Bake local horizon AO from the existing component mesh bounds.

    Each board has its own height field in its existing UV coordinates. Sixteen
    azimuths sample a maximum .075 scene-unit radius; no random dark islands.
    Bounds conservatively approximate existing parts, so this is contact AO,
    not a ray-traced shadow map or an assertion of hidden physical geometry.
    """
    bpy.context.view_layer.update()
    sources = [o for layer in ('board','packages','network') for o in collections[layer].objects]
    boards = [o for o in sources if 'routed FR4' in o.name or 'black multilayer PCB' in o.name]
    bounds = {}
    for o in sources:
        corners = np.array([tuple(o.matrix_world @ Vector(c)) for c in o.bound_box])
        bounds[o.name] = (corners.min(axis=0), corners.max(axis=0))

    group = bpy.data.node_groups.new('glTF Material Output', 'ShaderNodeTree')
    group.interface.new_socket(name='Occlusion', in_out='INPUT', socket_type='NodeSocketFloat')
    group.nodes.new('NodeGroupInput')
    for pcb in boards:
        lo, hi = bounds[pcb.name]
        width, depth = hi[0]-lo[0], hi[1]-lo[1]
        n = 1024
        height = np.zeros((n,n), np.float32)
        objects = 0
        parts=[]
        for o in sources:
            if o == pcb or o.get('boardIndex') != pcb.get('boardIndex'):
                continue
            a,b = bounds[o.name]
            if b[2] <= hi[2]+.0008 or a[2] > hi[2]+.085:
                continue
            if b[0] <= lo[0] or a[0] >= hi[0] or b[1] <= lo[1] or a[1] >= hi[1]:
                continue
            x0,x1 = np.clip(np.array([(a[0]-lo[0])/width,(b[0]-lo[0])/width])*(n-1),0,n-1).astype(int)
            y0,y1 = np.clip(np.array([(a[1]-lo[1])/depth,(b[1]-lo[1])/depth])*(n-1),0,n-1).astype(int)
            height[y0:y1+1,x0:x1+1] = np.maximum(height[y0:y1+1,x0:x1+1], b[2]-hi[2])
            objects += 1
            parts.append(o)
        occlusion = np.zeros_like(height)
        for angle in np.arange(16)*math.tau/16:
            horizon = np.zeros_like(height)
            for distance in [.002,.004,.007,.011,.017,.026,.040,.058,.075]:
                dx = int(round(math.cos(angle)*distance/width*(n-1)))
                dy = int(round(math.sin(angle)*distance/depth*(n-1)))
                if not dx and not dy:
                    continue
                neighbour = np.roll(height, (dy,dx), axis=(0,1))
                if dx>0: neighbour[:,:dx]=0
                elif dx<0: neighbour[:,dx:]=0
                if dy>0: neighbour[:dy,:]=0
                elif dy<0: neighbour[dy:,:]=0
                angle_slope = neighbour/ max(distance,.002)
                # Restrict to immediate contact: distant tall packages should
                # not introduce a broad black halo across exposed soldermask.
                weight = math.exp(-distance/.035)
                horizon = np.maximum(horizon, angle_slope*angle_slope/(1+angle_slope*angle_slope)*weight)
            occlusion += horizon/16
        ao = np.ones((n,n,4), np.float32)
        ao[:,:,:3] = (1-np.minimum(.63,occlusion*.95))[:,:,None]
        suffix = pcb.name.split(' / ')[0].lower()
        ao_image = image('bare-'+suffix+'-contact-occlusion', ao, True)
        material = materials['Black solder mask'].copy()
        material.name = 'Black solder mask / '+suffix+' contact AO'
        pcb_finish=board_surface(image,suffix,lo,hi,parts,bounds)
        principled=material.node_tree.nodes.get('Principled BSDF')
        # Replace the top colour image, keeping the accepted substrate UVs and
        # roughness/normal response. Reverse soldermask stays unprinted.
        principled.inputs['Base Color'].links[0].from_node.image=pcb_finish
        texture = material.node_tree.nodes.new('ShaderNodeTexImage'); texture.image = ao_image
        output = material.node_tree.nodes.new('ShaderNodeGroup'); output.node_tree = group
        material.node_tree.links.new(texture.outputs['Color'], output.inputs['Occlusion'])
        pcb.data.materials[0] = material
        print('CONTACT_AO '+suffix+' sourceObjects='+str(objects)+' min='+str(float(ao[:,:,0].min())),flush=True)
