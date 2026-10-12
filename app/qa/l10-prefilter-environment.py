"""Offline GGX environment preparation. Requires numpy/Pillow; no runtime fetch.

Input: CC0 Studio Small 09, Sergej Majboroda / Poly Haven (1k RGBE).
Usage: python app/qa/l10-prefilter-environment.py source.hdr destination.png
Output: six GGX roughness strips + cosine-weighted irradiance, opaque log RGB.
This processes real radiance, not an image of the modeled hardware.
"""
from pathlib import Path
import hashlib
import json
import sys
import numpy as np
from PIL import Image


def read_rgbe(path):
    with open(path, 'rb') as f:
        while f.readline().strip():
            pass
        axis_y, height, axis_x, width = f.readline().decode().split()
        assert (axis_y, axis_x) == ('-Y', '+X')
        height, width = int(height), int(width)
        pixels = np.empty((height, width, 4), np.uint8)
        for y in range(height):
            header = f.read(4)
            assert header[:2] == b'\x02\x02' and header[2] * 256 + header[3] == width
            for channel in range(4):
                x = 0
                while x < width:
                    count = f.read(1)[0]
                    if count > 128:
                        count -= 128
                        pixels[y, x:x+count, channel] = f.read(1)[0]
                    else:
                        pixels[y, x:x+count, channel] = np.frombuffer(f.read(count), np.uint8)
                    x += count
    return pixels[:, :, :3].astype(np.float32) * np.exp2(pixels[:, :, 3:4].astype(np.float32) - 136)


def normalize(v):
    return v / np.maximum(np.linalg.norm(v, axis=-1, keepdims=True), 1e-8)


def prepare(source, destination):
    hdr = read_rgbe(source)
    # Fixed exposure recorded in provenance, preserving relative light intensities.
    hdr *= .38
    width, height, count = 512, 256, 256
    u, v = np.meshgrid((np.arange(width)+.5)/width, (np.arange(height)+.5)/height)
    phi, theta = (u-.5)*2*np.pi, v*np.pi
    n = np.stack([np.sin(theta)*np.cos(phi), np.cos(theta), np.sin(theta)*np.sin(phi)], axis=-1).astype(np.float32)
    up = np.where((abs(n[:, :, 1]) < .99)[:, :, None], np.array([0, 1, 0]), np.array([1, 0, 0]))
    tangent = normalize(np.cross(up, n)).astype(np.float32)
    bitangent = np.cross(n, tangent)

    def sample(direction):
        x = (np.arctan2(direction[:, :, 2], direction[:, :, 0]) / (2*np.pi)+.5)*hdr.shape[1]-.5
        y = np.arccos(np.clip(direction[:, :, 1], -1, 1))/np.pi*hdr.shape[0]-.5
        xi, yi = np.floor(x).astype(int), np.floor(y).astype(int)
        fx, fy = (x-xi)[:, :, None], (y-yi)[:, :, None]
        y0, y1 = np.clip(yi, 0, hdr.shape[0]-1), np.clip(yi+1, 0, hdr.shape[0]-1)
        a = hdr[y0, xi % hdr.shape[1]]*(1-fx)+hdr[y0, (xi+1) % hdr.shape[1]]*fx
        b = hdr[y1, xi % hdr.shape[1]]*(1-fx)+hdr[y1, (xi+1) % hdr.shape[1]]*fx
        return a*(1-fy)+b*fy

    strips = []
    for level in range(7):
        total = np.zeros_like(n)
        weights = np.zeros((height, width, 1), np.float32)
        roughness = max(.045, level/5)
        for i in range(count):
            xi = (i+.5)/count
            radical = int(f'{i:032b}'[::-1], 2)/2**32
            angle = 2*np.pi*radical
            if level == 6:
                cosine = np.sqrt(1-xi)
            else:
                a2 = roughness**4
                cosine = np.sqrt((1-xi)/(1+(a2-1)*xi))
            sine = np.sqrt(max(0, 1-cosine*cosine))
            h = tangent*(np.cos(angle)*sine)+bitangent*(np.sin(angle)*sine)+n*cosine
            direction = h if level == 6 else normalize(2*cosine*h-n)
            weight = np.ones_like(weights) if level == 6 else np.maximum(np.sum(n*direction, axis=-1, keepdims=True), 0)
            total += sample(direction)*weight
            weights += weight
        strips.append(total / np.maximum(weights, 1e-5))
        print(f'Prefilter {level}/6 complete', flush=True)
    radiance = np.concatenate(strips)
    # Opaque RGB avoids browser image-decoder alpha premultiplication destroying
    # low-alpha RGBM mantissas. A log transfer preserves dark radiance precision.
    encoded = np.log2(1+np.clip(radiance, 0, 32)*16)/np.log2(513)
    output = Path(destination)
    output.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(np.uint8(np.round(encoded*255)), 'RGB').save(output)
    metadata = dict(source='https://polyhaven.com/a/studio_small_09', author='Sergej Majboroda', license='CC0',
                    source_sha256=hashlib.sha256(Path(source).read_bytes()).hexdigest(), encoding='opaque RGB log2(1 + radiance * 16) / log2(513), range 32',
                    width=width, strip_height=height, strips=7, samples=count, source_exposure=.38,
                    roughness=[.045, .2, .4, .6, .8, 1], last_strip='cosine-weighted irradiance / pi',
                    derivation='Offline importance-sampled GGX; original source HDR retained in ignored artifacts, no OEM model assets.')
    output.with_suffix('.json').write_text(json.dumps(metadata, indent=2)+'\n', encoding='utf-8')
    print(json.dumps(metadata, indent=2))


if __name__ == '__main__':
    prepare(sys.argv[1], sys.argv[2])
