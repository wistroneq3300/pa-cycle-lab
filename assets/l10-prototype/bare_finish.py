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

    def mr(name, rough, metal):
        pixels = rgba()
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

    regions = {
        'cpu': [(.065,.065,.40,.19,0),(.515,.065,.42,.19,1),
                (.065,.295,.24,.40,1),(.35,.295,.285,.40,0),(.68,.295,.255,.40,1),
                (.065,.735,.56,.20,0),(.67,.735,.265,.20,1)],
        'gpu': [(.065,.07,.25,.86,1),(.365,.07,.57,.255,0),
                (.365,.37,.265,.255,1),(.675,.37,.26,.255,0),(.365,.675,.57,.255,0)],
        'network': [(.07,.07,.32,.31,1),(.44,.07,.49,.31,0),
                    (.07,.425,.55,.235,0),(.67,.425,.26,.505,1),
                    (.07,.705,.245,.225,1),(.365,.705,.255,.225,0)]
    }
    for kind, fields in regions.items():
        density = np.zeros_like(u)
        polish = np.zeros_like(u)
        relief = np.zeros_like(u)
        for index, (x, y, w, h, orient) in enumerate(fields):
            inside = (u > x) & (u < x+w) & (v > y) & (v < y+h)
            a, b = (u-x)/w, (v-y)/h
            if orient:
                a, b = b, a
            # Unequal field reflectance plus multiple fine conductor scales.
            # None of the regions labels a claimed core, HBM or memory count.
            rows = np.exp(-np.square(np.sin(a*math.pi*(47+index*7))*6))
            buses = np.exp(-np.square(np.sin(b*math.pi*(11+index*2))*9))
            fine = np.sin(a*math.pi*251) * np.sin(b*math.pi*119)
            density += inside * ((index % 3 - 1)*.021 + .014
                                 - rows*.035 - buses*.021 + fine*.006)
            polish += inside * ((index % 3)*.012 + rows*.025 + buses*.017)
            relief += inside * (rows*.0018 + buses*.0012)
        guard = ((abs(u-.035)<.001) | (abs(u-.965)<.001)
                 | (abs(v-.035)<.001) | (abs(v-.965)<.001))
        density -= guard*.052
        silicon = rgba()
        pigments = {'cpu': [.396,.423,.430], 'gpu': [.385,.417,.431],
                    'network': [.402,.426,.428]}
        for k, base in enumerate(pigments[kind]):
            silicon[:, :, k] = base + density + grain*.001
        maps[kind] = (
            image('bare-'+kind+'-silicon-finish', silicon),
            mr('bare-'+kind+'-silicon-metallicroughness',
               .165 + polish + grain*.005, .78),
            normal('bare-'+kind+'-silicon-normal', relief, .5))

    # A lapped metal has one machining direction; stochastic line spacing
    # avoids the old sine beat pattern without inventing random scratches.
    lines = rng.uniform(-1, 1, (n, 1)).astype(np.float32)
    lines = (lines + np.roll(lines, 1, 0) + np.roll(lines, -1, 0)) / 3
    machining = np.broadcast_to(lines, (n,n)) * .009 + grain*.002
    maps['gold_mr'] = mr('bare-gold-metallicroughness', .245 + lines*.025 + resin*.018, .96)
    maps['metal_n'] = normal('bare-metal-machining-normal', machining, .65)
    for name, rough, variation, metal in [
            ('substrate',.44,.055,0), ('molding',.57,.045,0),
            ('ceramic',.29,.027,0), ('ferrite',.69,.055,0),
            ('nickel',.26,.024,.94), ('solder',.24,.031,.92)]:
        maps[name+'_mr'] = mr('bare-'+name+'-metallicroughness',
                              rough + grain*variation + resin*variation, metal)
    return maps


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
        texture = material.node_tree.nodes.new('ShaderNodeTexImage'); texture.image = ao_image
        output = material.node_tree.nodes.new('ShaderNodeGroup'); output.node_tree = group
        material.node_tree.links.new(texture.outputs['Color'], output.inputs['Occlusion'])
        pcb.data.materials[0] = material
        print('CONTACT_AO '+suffix+' sourceObjects='+str(objects)+' min='+str(float(ao[:,:,0].min())),flush=True)
