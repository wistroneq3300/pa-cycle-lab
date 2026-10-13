"""Reference-bounded fan cartridges and insulated central power cable.

Only the cassette placement, dark closed tops and central multi-conductor cable
corridor are established by the Lenovo internal photograph/top diagram. Rotor
pitch/count, hidden duct internals, connector pinout and exact cable section are
original mechanical approximations, never an OEM reconstruction or CAD import.
The existing renderer supplies the unchanged IO assembly animation.
"""
import math
import bpy
import bmesh
from mathutils import Vector


def build_service_geometry(api):
    cube, tube, rounded = api['cube'], api['tube'], api['rounded_path']
    coord, tag, uv_project = api['coord'], api['tag'], api['uv_project']
    M, COL, L = api['M'], api['COL'], api['L']
    api['material']('Service matte polymer', (.021,.023,.024), 0, .64)
    api['material']('Fan rotor polymer', (.018,.019,.020), 0, .69)

    def mesh(name, component, vertices, faces, material, smooth=False):
        me=bpy.data.meshes.new(name)
        me.from_pydata([coord(*p)for p in vertices], [], faces);me.update()
        bm=bmesh.new();bm.from_mesh(me)
        bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
        bm.to_mesh(me);bm.free()
        o=bpy.data.objects.new(name,me);COL['io'].objects.link(o)
        tag(o,'io',component);me.materials.append(M[material]);uv_project(o)
        for p in me.polygons:p.use_smooth=smooth
        o['referenceConfidence']='Visible Lenovo cassette/cable arrangement; internal rotor, section and retention detail are visual approximation.'
        return o

    def axial_ring(name, component, x, y, z0, z1, inner, outer=None, rectangle=None):
        # +Z is the fan axis. Correct raw X for the unchanged common X=.688
        # scene transform so the aperture is circular after integration.
        count=40;verts=[]
        for z in [z0,z1]:
            for surface in ['outer','inner']:
                for i in range(count):
                    a=i*math.tau/count;c,s=math.cos(a),math.sin(a)
                    if surface=='outer' and rectangle:
                        reach=min(rectangle[0]/max(abs(c),1e-12), rectangle[1]/max(abs(s),1e-12))
                        X,Y=reach*c,reach*s
                    else:
                        r=inner if surface=='inner' else outer
                        X,Y=r*c/.688,r*s
                    verts.append((x+X,y+Y,z))
        faces=[]
        for i in range(count):
            j=(i+1)%count
            faces.extend([(i,j,2*count+j,2*count+i),
                          (count+j,count+i,3*count+i,3*count+j),
                          (2*count+i,2*count+j,3*count+j,3*count+i),
                          (j,i,count+i,count+j)])
        return mesh(name,component,verts,faces,'Service matte polymer')

    fan_x=[-1.69,-1.27,-.85,-.43,.43,.85,1.27,1.69]
    fan_y=-.012;fan_z=.055
    for index,x in enumerate(fan_x,1):
        key='fan-cartridge-'+str(index)
        name='Fan '+str(index)+' '
        # Four thin walls, not a solid body with an applied circular disc.
        for side in [-1,1]:
            cube(name+'side shell', 'io',key,x+side*.1785,fan_y,fan_z,.008,.198,.480,'Service matte polymer',.0015)
            # Separate front/rear clamshell sections leave a narrow real seam.
            for half in [-1,1]:
                if side>0 and half>0:
                    # Four closed strips leave a real recessed latch pocket.
                    # A solid cover above the latch would make the modeled
                    # service control invisible despite passing an envelope test.
                    for x0,x1,z0,z1 in [(-.1745,.038,.056,.283),(.112,.1745,.056,.283),(.038,.112,.056,.130),(.038,.112,.237,.283)]:
                        cube(name+'top latch-pocket strip','io',key,x+(x0+x1)/2,.083,(z0+z1)/2,x1-x0,.008,z1-z0,'Service matte polymer',.0012)
                else:
                    cube(name+('top'if side>0 else'bottom')+' cover half','io',key,x,fan_y+side*.095,fan_z+half*.1145,.349,.008,.227,'Service matte polymer',.0014)
        for side in [-1,1]:
            z=fan_z+side*.231
            axial_ring(name+('front'if side>0 else'rear')+' open frame',key,x,fan_y,z-.009,z+.009,.078,rectangle=(.1785,.091))
        # The hollow axial tube ends behind the open frames. No end caps cross
        # its aperture; its real wall encloses the rotor volume.
        axial_ring(name+'hollow axial duct',key,x,fan_y,fan_z-.222,fan_z+.222,.078,.082)
        hub=tube(name+'internal motor hub','io',key,[[x,fan_y,fan_z-.029],[x,fan_y,fan_z+.042]],.025,'Fan rotor polymer',24)
        # Opening/blades already compensate the common scene X scale. Apply the
        # same rule to the hub, with real overlap at the .023 blade root radius.
        for v in hub.data.vertices:v.co.x=x+(v.co.x-x)/.688
        hub.data.update()
        # Original restrained rotor: seven bent blades are explicitly an
        # approximation. They sit INSIDE the duct, with finite edge thickness.
        for blade in range(7):
            base=blade*math.tau/7;outline=[]
            for radius,angle,pitch in [(.023,-.05,-.006),(.047,.01,-.003),(.072,.15,.007),(.072,.46,-.009),(.047,.43,-.015),(.023,.30,-.012)]:
                a=base+angle;outline.append((x+radius*math.cos(a)/.688,fan_y+radius*math.sin(a),fan_z+pitch))
            verts=[(X,Y,Z+side*.0016)for side in [-1,1]for X,Y,Z in outline]
            n=len(outline);faces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]
            for i in range(n):j=(i+1)%n;faces.append((i,j,j+n,i+n))
            o=mesh(name+'pitched rotor blade '+str(blade+1),key,verts,faces,'Fan rotor polymer')
            o['approximation']='Original seven-blade visual approximation, not an identified OEM rotor or airflow specification.'
        # Rear motor supports are mechanically joined to the duct wall.
        for spoke in range(4):
            a=spoke*math.tau/4+math.pi/4
            p0=[x+.019*math.cos(a)/.688,fan_y+.019*math.sin(a),fan_z+.036]
            p1=[x+.080*math.cos(a)/.688,fan_y+.080*math.sin(a),fan_z+.036]
            tube(name+'internal stator support','io',key,[p0,p1],.0036,'Fan rotor polymer',8)
        # A small retained latch, not a floating block/large blue-grey top.
        cube(name+'recessed top latch','io',key,x+.075,.081,fan_z+.128,.066,.008,.092,'Anodized retention',.0015)
        cube(name+'latch hinge','io',key,x+.075,.079,fan_z+.173,.082,.010,.010,'Anodized retention',.001)
        for side in [-1,1]:
            for end in [-1,1]:
                # Short seated heads stay inside the old .198-high envelope.
                api['cylinder'](name+'top captive screw','io',key,x+side*.153,.0835,fan_z+end*.192,.0065,.007,'Brushed nickel',16)
                api['cylinder'](name+'recessed screw drive','io',key,x+side*.153,.08685,fan_z+end*.192,.0028,.00015,'Anodized retention',6)

    # Six black insulated conductors keep to the narrow compute-board corridor.
    # Opposite X/Z ordering at the terminal makes concentric bends, avoiding the
    # intersecting corner paths that parallel translated L-shaped tubes create.
    paths=[];radius=.0085
    for i in range(6):
        x=-.045+i*.018;end_z=1.215-i*.017
        points=[[x,.026,-2.895],[x,.026,-2.70],[x,.026,.74],[x,.026,end_z],[.218,.026,end_z]]
        path=rounded(points,.100,12);paths.append(path)
        tube('Central insulated conductor '+str(i+1),'io','central-power-cable',path,radius,'Elastomer coolant hose',12)
        # Each conductor enters a short molded strain relief, not exposed pins.
        tube('PDB conductor strain relief '+str(i+1),'io','central-power-cable',[[.176,.026,end_z],[.214,.026,end_z]],.0105,'Service matte polymer',12)
    # Socket inner face is z=-2.949: this rear boot actually reaches it.
    cube('Rear busbar socket cable boot','io','central-power-cable',0,.020,-2.905,.134,.046,.088,'Service matte polymer',.004)
    # Mechanical cable combs grip the insulated conductors along the corridor.
    for z in [-2.58,-.94,.49]:
        cube('Central cable keeper base','io','central-power-cable',0,.012,z,.126,.006,.025,'Anodized retention',.001)
        for side in [-1,1]:
            cube('Central cable keeper side','io','central-power-cable',side*.060,.024,z,.006,.024,.025,'Anodized retention',.001)
        cube('Central cable keeper bridge','io','central-power-cable',0,.036,z,.126,.004,.025,'Anodized retention',.001)
    # Existing PDB top is -.0055; this compact landing occupies its verified
    # unpopulated forward strip z>1.10. It never intersects CMOS or power chips.
    cube('PDB cable terminal housing','io','central-power-cable',.280,.015,1.175,.180,.041,.130,'Service matte polymer',.003)
    for z in [1.128,1.222]:
        cube('PDB terminal mounting foot','io','central-power-cable',.380,.001, z,.026,.013,.022,'Anodized retention',.001)
        api['cylinder']('PDB terminal captive screw','io','central-power-cable',.380,.010,z,.0065,.006,'Brushed nickel',16)

    L['serviceGeometry']={
        'revision':1,'replaces':'Eight legacy fan cartridges, central long busbar and oversized forward block only',
        'fanCenters':[[x,fan_y,fan_z]for x in fan_x],
        'fanEnvelope':[.365,.198,.480],
        'fanOpeningRadiusWorld':.078,'rotorHubRadiusWorld':.025,'bladeRootRadiusWorld':.023,'fanInternalRotor':'Original seven-blade visual approximation; no OEM blade count claim',
        'cableRadius':radius,'cablePaths':paths,'rearSocketInnerZ':-2.949,
        'terminalBounds':{'min':[.190,-.0055,1.110],'max':[.370,.0355,1.240]},
        'pdbBounds':{'min':[.05,-.0765,.565],'max':[.61,-.0055,1.295]},
        'powerChipMaxZ':1.07,'cmosX':-.30,'cmosZ':.97,
        'coolingCrossoverMinY':.082,'cableMaxY':.043,
        'approximation':'Photograph-guided exterior placement and flexible cable topology; hidden fan internals, cable section, connector pinout and exact manufacturing geometry are not verified.'
    }
