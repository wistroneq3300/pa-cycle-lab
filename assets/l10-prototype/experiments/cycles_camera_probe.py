"""Bounded offline feasibility probe; never exports/replaces application assets.

Run from the repository root with Blender 4.5 LTS:
  blender --background --factory-startup --python-exit-code 1 --python \
    assets/l10-prototype/experiments/cycles_camera_probe.py

Frozen Phase 4 GLB, actual Phase 4 cooling camera, matching display transfer,
and the existing HDR. Only the board is rendered. WebGL's analytic fill/specular
terms and complete scene are NOT reproduced; this is not a quality A/B or a
demonstration of a seamless handoff. No production files are written.
"""
import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Matrix, Vector
import hashlib
import json
import math
from pathlib import Path
import struct
import time
import zlib
import numpy as np

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'artifacts/l10-phase5/offline'
OUT.mkdir(parents=True, exist_ok=True)
GLB = ROOT / 'artifacts/l10-phase5/baseline/phase4-compute-board.glb'
HDR = ROOT / 'artifacts/l10-phase3/studio_small_09_1k.hdr'
EVIDENCE = ROOT / 'docs/screenshots/l10-cinematic/phase4/evidence/comparison-summary.json'
summary = json.loads(EVIDENCE.read_text(encoding='utf-8'))
capture = next(p for p in summary['pairs'] if p['id'] == '03-cooling')['after']
assert capture['progress'] == .354 and capture['inspection'] == 'cooling'
assert all(capture['scene']['l10'][k] == 0 for k in ('boardLift', 'packageLift', 'coolingLift'))
assert hashlib.sha256(GLB.read_bytes()).hexdigest() == summary['assetSHA256']
width, height = capture['canvas']['width'], capture['canvas']['height']
pose = np.array([-5.3, 4.65, 7.0], np.float32).astype(float)
scale = np.array([.688, 1, .802], np.float32).astype(float)
# Native glTF +Y up / +Z front -> Blender +Z up / -Y front.
C = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))
model = Matrix.Diagonal((*scale, 1.0)) @ Matrix.Translation(Vector(pose))
blender_model = C @ model @ C.inverted()

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
load_start = time.perf_counter()
bpy.ops.import_scene.gltf(filepath=str(GLB))
load_seconds = time.perf_counter() - load_start
objects = [o for o in bpy.context.scene.objects if o.type == 'MESH']
assert len(objects) == 8, 'Frozen single-board semantic contract changed'
for obj in objects:
    # Importer has already converted glTF Y-up coordinates into Blender Z-up.
    obj.matrix_world = blender_model @ obj.matrix_world
    obj['experiment_only'] = True

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.render.threads_mode = 'FIXED'
scene.render.threads = 8
scene.cycles.samples = 32
scene.cycles.use_adaptive_sampling = False
scene.cycles.use_denoising = True
scene.cycles.seed = 29
scene.cycles.max_bounces = 8
scene.render.resolution_x, scene.render.resolution_y = width, height
scene.render.resolution_percentage = 100
scene.render.pixel_aspect_x = scene.render.pixel_aspect_y = 1
scene.render.film_transparent = True
scene.view_settings.view_transform = 'Raw'
scene.view_settings.look = 'None'
scene.view_settings.exposure = 0
scene.view_settings.gamma = 1

camera_data = bpy.data.cameras.new('Recorded WebGL camera — no reframing')
camera = bpy.data.objects.new('Recorded WebGL camera — no reframing', camera_data)
scene.collection.objects.link(camera)
scene.camera = camera
eye = Vector(capture['scene']['camera']['eye'])
target = Vector(capture['scene']['camera']['target'])
eye_b, target_b = C @ eye.to_4d(), C @ target.to_4d()
camera.location = eye_b.xyz
camera.rotation_euler = (target_b.xyz - eye_b.xyz).to_track_quat('-Z', 'Y').to_euler()
camera_data.sensor_fit = 'VERTICAL'
camera_data.sensor_height = 24
camera_data.lens = camera_data.sensor_height / (2 * math.tan(.5 / 2))
camera_data.clip_start, camera_data.clip_end = .15, 180
bpy.context.view_layer.update()

# Explicit UV arithmetic reproduces core-scene.environmentStrip(direction)
# orientation before its roughness prefilter. HDR rows use top-left origin;
# Blender image texture UVs use bottom-left, hence 1-acos(y)/pi below.
world = bpy.data.worlds.new('Existing Studio Small 09 — source exposure .38')
scene.world = world
world.use_nodes = True
nodes, links = world.node_tree.nodes, world.node_tree.links
nodes.clear()
coords = nodes.new('ShaderNodeTexCoord')
separate = nodes.new('ShaderNodeSeparateXYZ')
links.new(coords.outputs['Generated'], separate.inputs[0])

def math_node(operation, left, right=None):
    node = nodes.new('ShaderNodeMath')
    node.operation = operation
    for value, socket in ((left, node.inputs[0]), (right, node.inputs[1])):
        if value is None:
            continue
        if isinstance(value, (int, float)):
            socket.default_value = value
        else:
            links.new(value, socket)
    return node.outputs[0]

# b=(X,-Z,Y); shader d=(Z,Y,-X) then rotation in d.xy.
dx = math_node('ADD', math_node('MULTIPLY', separate.outputs['Y'], -.796084),
               math_node('MULTIPLY', separate.outputs['Z'], -.605186))
dy = math_node('ADD', math_node('MULTIPLY', separate.outputs['Z'], .796084),
               math_node('MULTIPLY', separate.outputs['Y'], -.605186))
dz = math_node('MULTIPLY', separate.outputs['X'], -1)
u = math_node('ADD', math_node('DIVIDE', math_node('ARCTAN2', dz, dx), 2 * math.pi), .5)
v = math_node('SUBTRACT', 1, math_node('DIVIDE', math_node('ARCCOSINE', dy), math.pi))
uv = nodes.new('ShaderNodeCombineXYZ')
links.new(u, uv.inputs['X'])
links.new(v, uv.inputs['Y'])
texture = nodes.new('ShaderNodeTexImage')
texture.image = bpy.data.images.load(str(HDR), check_existing=True)
texture.image.colorspace_settings.name = 'Linear Rec.709'
texture.interpolation = 'Linear'
texture.extension = 'REPEAT'
links.new(uv.outputs[0], texture.inputs['Vector'])
background = nodes.new('ShaderNodeBackground')
background.inputs['Strength'].default_value = .38
links.new(texture.outputs['Color'], background.inputs['Color'])
world_output = nodes.new('ShaderNodeOutputWorld')
links.new(background.outputs[0], world_output.inputs['Surface'])

def webgl_project(raw):
    # CPU reconstruction of Float32Array perspective/lookAt in core-scene.js.
    e, t = np.asarray(eye), np.asarray(target)
    back = e - t
    back /= np.linalg.norm(back)
    right = np.array([back[2], 0, -back[0]])
    right /= np.linalg.norm(right)
    up = np.cross(back, right)
    view = np.eye(4)
    view[:3, :3] = np.array([right, up, back])
    view[:3, 3] = -view[:3, :3] @ e
    f, near, far = 1 / math.tan(.25), .15, 180
    projection = np.zeros((4, 4))
    projection[0, 0], projection[1, 1] = f / (width / height), f
    projection[2, 2] = (far + near) / (near - far)
    projection[2, 3] = 2 * far * near / (near - far)
    projection[3, 2] = -1
    vp = (projection.astype(np.float32).astype(float) @ view.astype(np.float32).astype(float)).astype(np.float32).astype(float)
    transformed = (np.asarray(raw) + pose) * scale
    clip = vp @ np.append(transformed, 1)
    ndc = clip[:3] / clip[3]
    return [(ndc[0] * .5 + .5) * width, (1 - (ndc[1] * .5 + .5)) * height]

landmarks = {
    'PCB rear left': [-1.83, -.0715, -2.84],
    'PCB rear right': [-.10, -.0715, -2.84],
    'PCB front left': [-1.83, -.0715, -.52],
    'PCB front right': [-.10, -.0715, -.52],
    'CPU contact centre': [-.965, .0068, -1.10],
    'GPU A contact centre': [-1.39, .0068, -2.18],
    'GPU B contact centre': [-.55, .0068, -2.18],
    'CPU collar top': [-.965 - .28, .100, -1.10],
}
measured = []
for name, raw in landmarks.items():
    reference = webgl_project(raw)
    world_point = C @ model @ Vector((*raw, 1))
    ndc = world_to_camera_view(scene, camera, world_point.xyz)
    rendered = [ndc.x * width, (1 - ndc.y) * height]
    measured.append(dict(name=name, raw=raw, webglPixels=reference, blenderPixels=rendered,
                         errorPixels=math.dist(reference, rendered)))
max_error = max(p['errorPixels'] for p in measured)
assert max_error < .01, f'Camera transfer failed: {max_error} px'

scene.render.image_settings.file_format = 'OPEN_EXR'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.image_settings.color_depth = '32'
scene.render.image_settings.exr_codec = 'ZIP'
scene.render.filepath = str(OUT / 'cooling-cycles-linear.exr')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'camera-probe.blend'), compress=True)
started = time.perf_counter()
bpy.ops.render.render(write_still=True)
render_seconds = time.perf_counter() - started
exr = bpy.data.images.load(scene.render.filepath, check_existing=False)
pixels = np.empty(width * height * 4, np.float32)
exr.pixels.foreach_get(pixels)
pixels = pixels.reshape(height, width, 4)[::-1].copy()
alpha = np.clip(pixels[:, :, 3:4], 0, 1)
linear = np.maximum(pixels[:, :, :3] / np.maximum(alpha, 1e-8), 0)
# Exact existing GLSL displayTransform; no AgX, exposure retiming or contrast.
rgb = np.power(np.clip((linear * (2.51 * linear + .03)) /
                      (linear * (2.43 * linear + .59) + .14), 0, 1), 1 / 2.2)
rgba = np.rint(np.concatenate([rgb, alpha], axis=2) * 255).astype(np.uint8)

def save_png(path, rgba):
    def chunk(kind, payload):
        return struct.pack('>I', len(payload)) + kind + payload + struct.pack('>I', zlib.crc32(kind + payload) & 0xffffffff)
    scanlines = b''.join(b'\0' + row.tobytes() for row in rgba)
    payload = b'\x89PNG\r\n\x1a\n'
    payload += chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0))
    payload += chunk(b'IDAT', zlib.compress(scanlines, 6)) + chunk(b'IEND', b'')
    path.write_bytes(payload)

png = OUT / 'cooling-cycles-existing-display.png'
save_png(png, rgba)
result = dict(
    status='NOT ADOPTED — camera projection only; lighting/scene/handoff not matched',
    baseline='031830a1c7faf5484b358e0964551e8656e1d852',
    assetSHA256=hashlib.sha256(GLB.read_bytes()).hexdigest(),
    hdrSHA256=hashlib.sha256(HDR.read_bytes()).hexdigest(),
    blender=bpy.app.version_string, engine='Cycles CPU', threads=8, samples=32, denoised=True,
    viewport={'width': 3440, 'height': 1440, 'notRendered': True},
    renderedCanvas={'width': width, 'height': height, 'alpha': True, 'scope': 'single GLB only'},
    recordedCamera=capture['scene']['camera'], primaryPose=pose.tolist(), modelScale=scale.tolist(),
    progress=.354, referenceStage='03-cooling',
    loadSeconds=load_seconds, renderAndEXRWriteSeconds=render_seconds,
    outputs={'pngBytes': png.stat().st_size, 'exrBytes': Path(scene.render.filepath).stat().st_size},
    maxProjectionErrorPixels=max_error, landmarks=measured,
    illumination={'hdrSourceExposure': .38, 'newLights': 0, 'orientation': 'explicit core-scene sampler UV arithmetic',
                  'strictMatch': False, 'missing': ['analytic key diffuse .82 and GGX specular .48',
                   'front diffuse fill .22', 'service reflection lobe .42 and diffuse .35',
                   'final shader radiance factor .91', 'complete chassis/hoses/rack shadow casters'],
                  'different': ['Cycles multiple-bounce integration vs WebGL split-sum IBL',
                    'native HDR vs 512x256 prefiltered log-encoded strips', 'Cycles BSDF vs custom material BRDF']},
    displayTransform='Existing GLSL rational ACES approximation then pow(1/2.2); no AgX',
    acceptance='Not evidence of photorealism improvement or video-to-interactive continuity',
)
(OUT / 'probe-result.json').write_text(json.dumps(result, indent=2) + '\n')
print('OFFLINE_PROBE_RESULT ' + json.dumps(result), flush=True)
