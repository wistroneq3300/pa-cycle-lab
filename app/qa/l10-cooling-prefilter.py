"""V3 filtered-importance GGX atlas; same source radiance/exposure as V2.

Source mip footprints integrate high-energy small emitters instead of repeatedly
aliasing a point-sampled HDR. Linear radiance is filtered before log encoding.
The original atlas remains unchanged for protected bare/Rack materials.
"""
from pathlib import Path
import importlib.util
import hashlib
import json
import sys
import numpy as np
from PIL import Image

spec = importlib.util.spec_from_file_location('original', Path(__file__).with_name('l10-prefilter-environment.py'))
original = importlib.util.module_from_spec(spec)
spec.loader.exec_module(original)

def prepare(source, destination, count=1024):
    hdr = original.read_rgbe(source) * .38
    mips = [hdr]
    while min(mips[-1].shape[:2]) > 1:
        a = mips[-1]
        mips.append((a[::2, ::2] + a[1::2, ::2] + a[::2, 1::2] + a[1::2, 1::2]) * .25)
    width, height = 512, 256
    u, v = np.meshgrid((np.arange(width)+.5)/width, (np.arange(height)+.5)/height)
    phi, theta = (u-.5)*2*np.pi, v*np.pi
    n = np.stack([np.sin(theta)*np.cos(phi), np.cos(theta), np.sin(theta)*np.sin(phi)], axis=-1).astype(np.float32)
    up = np.where((abs(n[:, :, 1]) < .99)[:, :, None], np.array([0, 1, 0]), np.array([1, 0, 0]))
    tangent = original.normalize(np.cross(up, n)).astype(np.float32)
    bitangent = np.cross(n, tangent)

    def sample(direction, pdf):
        uu = np.arctan2(direction[:, :, 2], direction[:, :, 0])/(2*np.pi)+.5
        vv = np.arccos(np.clip(direction[:, :, 1], -1, 1))/np.pi
        texel_sa = 2*np.pi*np.pi*np.maximum(np.sin(vv*np.pi), .002)/(hdr.shape[0]*hdr.shape[1])
        lod = np.clip(.5*np.log2(1/(count*max(pdf, 1e-8)*texel_sa)), 0, len(mips)-1)
        result = np.zeros_like(direction)
        for level, texture in enumerate(mips):
            weight = np.maximum(0, 1-abs(lod-level))
            if not np.any(weight):
                continue
            use = weight > 0
            x, y = uu[use]*texture.shape[1]-.5, vv[use]*texture.shape[0]-.5
            xi, yi = np.floor(x).astype(int), np.floor(y).astype(int)
            fx, fy = (x-xi)[:, None], (y-yi)[:, None]
            y0, y1 = np.clip(yi, 0, texture.shape[0]-1), np.clip(yi+1, 0, texture.shape[0]-1)
            a = texture[y0, xi % texture.shape[1]]*(1-fx)+texture[y0, (xi+1) % texture.shape[1]]*fx
            b = texture[y1, xi % texture.shape[1]]*(1-fx)+texture[y1, (xi+1) % texture.shape[1]]*fx
            result[use] += (a*(1-fy)+b*fy)*weight[use, None]
        return result

    strips = []
    for level in range(7):
        total, weights = np.zeros_like(n), np.zeros((height, width, 1), np.float32)
        rough = max(.045, level/5)
        for i in range(count):
            xi = (i+.5)/count
            radical = int(f'{i:032b}'[::-1], 2)/2**32
            angle = 2*np.pi*radical
            if level == 6:
                cosine = np.sqrt(1-xi)
                pdf = cosine/np.pi
            else:
                a2 = rough**4
                cosine = np.sqrt((1-xi)/(1+(a2-1)*xi))
                distribution = a2/(np.pi*(cosine*cosine*(a2-1)+1)**2)
                pdf = distribution/4
            sine = np.sqrt(max(0, 1-cosine*cosine))
            h = tangent*(np.cos(angle)*sine)+bitangent*(np.sin(angle)*sine)+n*cosine
            direction = h if level == 6 else original.normalize(2*cosine*h-n)
            weight = np.ones_like(weights) if level == 6 else np.maximum(np.sum(n*direction, axis=-1, keepdims=True), 0)
            total += sample(direction, pdf)*weight
            weights += weight
        strips.append(total/np.maximum(weights, 1e-5))
        print(f'Filtered GGX {level}/6 complete', flush=True)
    radiance = np.concatenate(strips)
    encoded = np.log2(1+np.clip(radiance, 0, 32)*16)/np.log2(513)
    output = Path(destination)
    output.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(np.uint8(np.round(encoded*255)), 'RGB').save(output)
    metadata = dict(source='https://polyhaven.com/a/studio_small_09', author='Sergej Majboroda', license='CC0',
        source_sha256=hashlib.sha256(Path(source).read_bytes()).hexdigest(), source_exposure=.38,
        width=width, strip_height=height, strips=7, samples=count, source_mip_levels=len(mips),
        roughness=[.045,.2,.4,.6,.8,1], last_strip='cosine-weighted irradiance / pi',
        encoding='opaque RGB log2(1 + radiance * 16) / log2(513), range 32',
        derivation='GGX importance sampling with PDF/solid-angle source mip footprints in linear radiance; periodic longitude and clamped latitude; same source illumination and exposure as original atlas',
        scope='Cooling companion and lid only; original bare/Rack atlas retained')
    output.with_suffix('.json').write_text(json.dumps(metadata, indent=2)+'\n', encoding='utf-8')
    print(json.dumps(metadata, indent=2), flush=True)

if __name__ == '__main__':
    prepare(sys.argv[1], sys.argv[2])
