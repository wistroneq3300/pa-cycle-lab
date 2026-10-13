"""Read-only Final RC source/packed-PBR/protected-file and manifold normal audit.

Run Blender --background --python-exit-code 1 --python this-file.
No source asset is saved or modified by this audit.
"""
import bpy, bmesh, json, math, hashlib, subprocess, struct
from collections import Counter, defaultdict
import numpy as np
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
source=ROOT/'assets/l10-cooling-v1/cooling-assembly.blend'
destination=ROOT/'docs/screenshots/l10-cinematic/final-rc/evidence/source-portability.json'
def sha(data):return hashlib.sha256(data).hexdigest()
def historical(path):return subprocess.check_output(['git','show','108ffbc5b4bc4faf4eb4f1ebf785ebd3b1c89a5c:'+path],cwd=ROOT)
source_hash=sha(source.read_bytes())
bpy.ops.wm.open_mainfile(filepath=str(source))
rows=[]
for name,yy,zz in [('Supply distribution manifold',.066,-.43),('Return collection manifold',.100,-.33)]:
    ob=bpy.data.objects[name];me=ob.data;me.update();normals=me.corner_normals
    angles=[];axial=[];seams=[];smooth_caps=0;outer_faces=0;cap_faces=0
    for face in me.polygons:
        if abs(face.normal.x)>.98:
            cap_faces+=1;smooth_caps+=int(face.use_smooth)
        center=face.center;radius=math.hypot(center.z-yy,-center.y-zz)
        if radius<.015 or abs(face.normal.x)>.95:continue
        outer_faces+=1
        uv=[me.uv_layers.active.data[i].uv.y for i in face.loop_indices]
        if max(uv)-min(uv)>.5:seams.append(face.index)
        for li in face.loop_indices:
            v=me.vertices[me.loops[li].vertex_index].co
            if abs(math.hypot(v.z-yy,-v.y-zz)-.017)>.0004:continue
            radial=Vector((0,v.y+zz,v.z-yy)).normalized();n=normals[li].vector
            angles.append(math.degrees(math.acos(max(-1,min(1,radial.dot(n))))));axial.append(abs(n.x))
    rows.append({'object':name,'vertices':len(me.vertices),'faces':len(me.polygons),'outerFaces':outer_faces,'outerCornerCount':len(angles),'radialNormalErrorDegrees':{'max':max(angles),'mean':sum(angles)/len(angles),'over5':sum(a>5 for a in angles)},'maxUnphysicalAxialNormal':max(axial),'capFaces':cap_faces,'smoothedCapFaces':smooth_caps,'outerUVWrapCrossingFaces':len(seams),'customNormals':me.has_custom_normals})
for row in rows:
    assert row['radialNormalErrorDegrees']['max']<.1,row
    assert row['maxUnphysicalAxialNormal']<.00001,row
    assert row['smoothedCapFaces']==row['outerUVWrapCrossingFaces']==0,row

def overlap_area(a,b):
    """Convex triangle intersection after a dominant-axis projection."""
    def signed(p,q,r):return (q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0])
    subject=list(a);orientation=1 if signed(*b)>0 else -1
    for e in range(3):
        p,q=b[e],b[(e+1)%3];clipped=[]
        for i,x in enumerate(subject):
            y=subject[(i+1)%len(subject)];dx=orientation*signed(p,q,x);dy=orientation*signed(p,q,y)
            if dx>=0:clipped.append(x)
            if (dx<0)!=(dy<0):
                t=dx/(dx-dy);clipped.append([x[k]+t*(y[k]-x[k]) for k in (0,1)])
        subject=clipped
        if len(subject)<3:return 0
    return abs(sum(subject[i][0]*subject[(i+1)%len(subject)][1]-subject[(i+1)%len(subject)][0]*subject[i][1] for i in range(len(subject))))/2

topology=[];outside=[];interface_caps=[]
for semantic,yy,zz in [('supply',.066,-.43),('return',.100,-.33)]:
    names=[('Supply distribution manifold' if semantic=='supply' else 'Return collection manifold'),semantic+' header blind-end sleeve',semantic+' header sealed blind plug']
    for name in names:
        ob=bpy.data.objects[name];me=ob.data;me.calc_loop_triangles();bm=bmesh.new();bm.from_mesh(me)
        keys=[];degenerate=0
        for tri in me.loop_triangles:
            p=[ob.matrix_world@me.vertices[i].co for i in tri.vertices]
            keys.append(tuple(sorted(tuple(round(float(v),8)for v in point)for point in p)))
            cross=(p[1]-p[0]).cross(p[2]-p[0]);area=cross.length/2
            if area<1e-14:degenerate+=1;continue
            n=cross.normalized();center=sum(p,Vector())/3;radial=Vector((0,center.y+zz,center.z-yy))
            entry={'name':name,'points':p,'normal':n,'d':n.dot(p[0]),'area':area,'semantic':semantic}
            if radial.length>.0165 and abs(n.x)<1e-4 and n.dot(radial.normalized())>.98:outside.append(entry)
            if abs(n.x)>.99 and abs(abs(center.x)-1.78)<1e-6 or abs(n.x)>.99 and abs(abs(center.x)-1.786)<1e-6:interface_caps.append(entry)
        duplicates=sum(n-1 for n in Counter(keys).values()if n>1)
        row={'object':name,'triangles':len(keys),'duplicatePositionTriangles':duplicates,'degenerateTriangles':degenerate,'boundaryEdges':sum(e.is_boundary for e in bm.edges),'nonmanifoldEdges':sum(not e.is_manifold for e in bm.edges)}
        bm.free();topology.append(row)
        assert duplicates==degenerate==row['boundaryEdges']==row['nonmanifoldEdges']==0,row
groups=defaultdict(list)
for tri in outside:groups[(tri['semantic'],tuple(round(float(v),5) for v in tri['normal']))].append(tri)
near=[];tested=0
for group in groups.values():
    for i,a in enumerate(group):
        for b in group[i+1:]:
            gap=abs(a['d']-b['d'])
            if gap>1e-5:continue
            if any(max(p[k]for p in a['points'])<=min(p[k]for p in b['points'])+1e-9 or max(p[k]for p in b['points'])<=min(p[k]for p in a['points'])+1e-9 for k in (0,1,2)):continue
            drop=max(range(3),key=lambda k:abs(a['normal'][k]));axes=[k for k in (0,1,2)if k!=drop]
            area=overlap_area([[p[k]for k in axes]for p in a['points']],[[p[k]for k in axes]for p in b['points']]);tested+=1
            if area>1e-10:near.append({'objects':[a['name'],b['name']],'normalGap':gap,'projectedOverlapArea':area})
assert not near,near[:10]
interfaces=defaultdict(lambda:{'objects':set(),'triangles':0,'totalFaceArea':0})
for tri in interface_caps:
    key=(tri['semantic'],round(sum(p.x for p in tri['points'])/3,6));r=interfaces[key];r['objects'].add(tri['name']);r['triangles']+=1;r['totalFaceArea']+=tri['area']
interface_rows=[{'semantic':key[0],'x':key[1],'objects':sorted(value['objects']),'triangles':value['triangles'],'totalFaceArea':value['totalFaceArea']}for key,value in interfaces.items()if len(value['objects'])>1]
surface_audit={'topology':topology,'exteriorTriangles':len(outside),'nearCoplanarThreshold':1e-5,'overlapAreaThreshold':1e-10,'projectedCandidatePairsTested':tested,'unexpectedExteriorNearCoincidentPairs':near,'matingEndCapInterfaces':interface_rows,'limitation':'The preserved blind-end sleeve/plug assemblies contain opposing internal mating caps at x=1.780/1.786 (supply) and -1.780/-1.786 (return). They are recorded, not claimed absent. The exposed cylindrical walls have no measured duplicate/near-coincident positive-area faces; this focused audit is not an arbitrary global self-intersection certification.'}
images=[]
for im in list(bpy.data.images):
    if im.name in ['Render Result','Viewer Node']:continue
    assert im.packed_file,im.name+' must be packed'
    ext=source.parent/'textures'/(im.name+'.png')
    original=np.array(im.pixels[:],dtype=np.float32)
    disk=bpy.data.images.load(str(ext),check_existing=False);disk.colorspace_settings.name=im.colorspace_settings.name
    decoded=np.array(disk.pixels[:],dtype=np.float32)
    assert np.array_equal(original,decoded),im.name+' packed/external mismatch'
    if im.name!='cooling-socket-contact-ao':assert sha(ext.read_bytes())==sha(historical(ext.relative_to(ROOT).as_posix())),im.name+' accepted MR map changed'
    rough=original.reshape(-1,4)[:,1]
    images.append({'name':im.name,'packed':True,'width':im.size[0],'height':im.size[1],'externalSHA256':sha(ext.read_bytes()),'decodedPixelsSHA256':sha(original.tobytes()),'packedExternalPixelIdentical':True,'baselineTextureBytesIdentical':im.name!='cooling-socket-contact-ao',('decodedAO' if im.name=='cooling-socket-contact-ao' else 'decodedRoughness'):{'min':float(rough.min()),'max':float(rough.max()),'mean':float(rough.mean())}})
    bpy.data.images.remove(disk)
glb=ROOT/'app/static/models/l10-cooling-v1/cooling-assembly.glb';raw=glb.read_bytes();length=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+length]);binary=raw[28+length:]
assert json.loads(bpy.context.scene['assemblyContract'])==doc['extras'],'Editable-source contract differs from delivered GLB'
contract=json.loads((glb.parent/'assembly.json').read_text())
assert contract['sha256']==sha(raw)
assert doc['extras']['finishRevision']==4
assert doc['extras']['socketContactAO']['samplesPerTexel']==48
assert doc['extras']['socketContactAO']['rayTests']>100000
socket_material=next(m for m in doc['materials']if m['name']=='Machined nickel fittings')
assert socket_material.get('occlusionTexture'),'Ray-traced socket AO must actually be exported'
assert all('occlusionTexture' not in m for m in doc['materials']if m['name']!='Machined nickel fittings'),'Socket AO must not leak to other materials'
for key in doc['extras']:assert contract[key]==doc['extras'][key],key
embedded=[]
for im in doc['images']:
    view=doc['bufferViews'][im['bufferView']];data=binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]
    digest=sha(data);assert digest in [im['externalSHA256'] for im in images]
    embedded.append({'name':im['name'],'sha256':digest,'equalsPackedAndExternal':True})
materials=[]
for material in doc['materials']:
    source_mat=bpy.data.materials[material['name']];p=source_mat.node_tree.nodes.get('Principled BSDF');pbr=material.get('pbrMetallicRoughness',{})
    for field,socket,default in [('metallicFactor','Metallic',1),('roughnessFactor','Roughness',1)]:
        if not p.inputs[socket].is_linked:assert abs(p.inputs[socket].default_value-pbr.get(field,default))<1e-6,(source_mat.name,field)
    if not p.inputs['Base Color'].is_linked:assert np.allclose(p.inputs['Base Color'].default_value,pbr.get('baseColorFactor',[1]*4),atol=1e-6)
    assert not any(material.get('emissiveFactor',[0,0,0])) and 'emissiveTexture' not in material
    emission=p.inputs.get('Emission Color');strength=p.inputs.get('Emission Strength')
    assert not strength.is_linked and not emission.is_linked
    assert strength.default_value==0 or np.array_equal(list(emission.default_value)[:3],[0,0,0])
    assert 'normalTexture' not in material,'V3 deliberately has no tangent-space normal dependency'
    materials.append({'name':source_mat.name,'scalarSourceMatchesExport':True,'zeroEmission':True,'normalTexture':False})
protected=[]
tracked=subprocess.check_output(['git','ls-files','assets/l10-prototype','app/static/models/l10-prototype'],cwd=ROOT,text=True).splitlines()
for path in tracked:
    if not (ROOT/path).is_file():continue
    data=(ROOT/path).read_bytes();baseline=historical(path)
    text_file=Path(path).suffix in {'.json','.py','.md','.js','.cjs'}
    # Git may check out text metadata as CRLF. Binary geometry/PBR sources
    # remain strict byte-for-byte; metadata follows Git's LF text identity.
    assert (data.replace(b'\r\n',b'\n') if text_file else data)==(baseline.replace(b'\r\n',b'\n') if text_file else baseline),path+' protected baseline changed'
    protected.append({'path':path,'sha256':sha(data),'baselineIdentical':True,'comparison':'LF-normalized text' if text_file else 'exact binary bytes','tracked':True})
untracked={'assets/l10-prototype/compute-board-prototype.blend1':'01b5856ab7261a1ca0a8b9904ec8e82bccd611cfd3cbb687235e99b55b563e85','assets/l10-prototype/textures/surface-normal.png':'6309b50efb72caed7d2c651cef994b57946026879d54fcc611fab351b22994d5'}
for path,expected in untracked.items():
    digest=sha((ROOT/path).read_bytes());assert digest==expected,path+' untracked original changed'
    protected.append({'path':path,'sha256':digest,'preexistingUntrackedIdentical':True,'tracked':False})
assert sha(source.read_bytes())==source_hash,'Read-only audit changed the source'
report={'result':'PASS','source':source.relative_to(ROOT).as_posix(),'sourceSHA256':source_hash,'glbSHA256':sha(raw),'scriptSHA256':sha(Path(__file__).read_bytes()),'readOnly':True,'measurements':rows,'interpretation':'Straight manifold exterior normals should be radial with zero axial X component; annular end faces must remain planar; texture seam quads must not span most of V.','images':images,'embeddedImages':embedded,'materials':materials,'protectedHashes':protected,'sourceAndGLBContractsIdentical':True,'sourceObjects':len([o for o in bpy.data.objects if o.type=='MESH']),'editableLayerObjectCounts':{k:len(bpy.data.collections[k].objects)for k in doc['extras']['layers']}}
report['manifoldSurfaceAudit']=surface_audit
destination.parent.mkdir(parents=True,exist_ok=True);destination.write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'result':report['result'],'sourceSHA256':source_hash,'glbSHA256':report['glbSHA256'],'packedImages':len(images),'materials':len(materials),'protectedFiles':len(protected),'output':destination.relative_to(ROOT).as_posix()},indent=2))
