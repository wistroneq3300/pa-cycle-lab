/* A deliberately bounded glTF 2.0 / GLB adapter for the PA WebGL 1 renderer.
 * No scene engine, external resources, vendor CAD, or extension guessing.
 * Geometry is expanded and node transforms are baked. Runtime animation still
 * owns the four semantic L10 layers. Images are NOT flipped or color converted:
 * the renderer must decode sRGB base color and sample MR/normal/AO as linear.
 */
(() => {
  'use strict';
  const LAYERS = new Set(['board', 'packages', 'cooling-frame', 'cooling']);
  const COMPONENTS = {
    5120: [1, 'getInt8', 127, true], 5121: [1, 'getUint8', 255, false],
    5122: [2, 'getInt16', 32767, true], 5123: [2, 'getUint16', 65535, false],
    5125: [4, 'getUint32', 4294967295, false], 5126: [4, 'getFloat32', 1, true]
  };
  const SIZES = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
  const MAX_BYTES = 64 * 1024 * 1024, MAX_VERTICES = 3000000;
  const fail = message => { throw new Error(`L10 GLB: ${message}`); };
  const check = (condition, message) => { if (!condition) fail(message); };
  const integer = value => Number.isSafeInteger(value) && value >= 0;
  const identity = () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const numbers = (value, length, label) => {
    check(Array.isArray(value) && value.length === length && value.every(Number.isFinite), `${label} must have ${length} finite numbers`);
    return value;
  };
  function ref(list, index, label) {
    check(Array.isArray(list) && integer(index) && index < list.length, `invalid ${label} index`);
    return list[index];
  }
  function noExtensions(object, label) {
    check(!object.extensions || Object.keys(object.extensions).length === 0, `${label} extensions are unsupported`);
  }
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  function unit(a, label) {
    const length = Math.hypot(...a);
    check(Number.isFinite(length) && length > 1e-12, `${label} is degenerate`);
    return a.map(v => v / length);
  }
  function multiply(a, b) {
    const result = new Float64Array(16);
    for (let column = 0; column < 4; column++) for (let row = 0; row < 4; row++) {
      for (let k = 0; k < 4; k++) result[column * 4 + row] += a[k * 4 + row] * b[column * 4 + k];
    }
    return result;
  }
  function localMatrix(node) {
    if (node.matrix !== undefined) {
      check(node.translation === undefined && node.rotation === undefined && node.scale === undefined, 'node cannot mix matrix and TRS');
      const m = numbers(node.matrix, 16, 'node matrix');
      check(m[3] === 0 && m[7] === 0 && m[11] === 0 && m[15] === 1, 'node matrix must be affine');
      return new Float64Array(m);
    }
    const t = numbers(node.translation || [0, 0, 0], 3, 'translation');
    const s = numbers(node.scale || [1, 1, 1], 3, 'scale');
    const q = numbers(node.rotation || [0, 0, 0, 1], 4, 'rotation');
    check(Math.abs(Math.hypot(...q) - 1) < 1e-4, 'rotation quaternion must be normalized');
    const [x, y, z, w] = q;
    return new Float64Array([
      (1 - 2 * (y * y + z * z)) * s[0], 2 * (x * y + z * w) * s[0], 2 * (x * z - y * w) * s[0], 0,
      2 * (x * y - z * w) * s[1], (1 - 2 * (x * x + z * z)) * s[1], 2 * (y * z + x * w) * s[1], 0,
      2 * (x * z + y * w) * s[2], 2 * (y * z - x * w) * s[2], (1 - 2 * (x * x + y * y)) * s[2], 0,
      t[0], t[1], t[2], 1
    ]);
  }
  function glbDocument(buffer) {
    check(buffer instanceof ArrayBuffer && buffer.byteLength >= 20 && buffer.byteLength <= MAX_BYTES, 'invalid or oversized ArrayBuffer');
    const view = new DataView(buffer);
    check(view.getUint32(0, true) === 0x46546c67 && view.getUint32(4, true) === 2, 'expected GLB version 2');
    check(view.getUint32(8, true) === buffer.byteLength, 'GLB declared length does not match payload');
    let offset = 12, json = null, binary = null, chunks = 0;
    while (offset < buffer.byteLength) {
      check(offset + 8 <= buffer.byteLength, 'truncated chunk header');
      const length = view.getUint32(offset, true), type = view.getUint32(offset + 4, true);
      offset += 8;
      check(length % 4 === 0 && offset + length <= buffer.byteLength, 'invalid chunk length');
      if (chunks === 0) {
        check(type === 0x4e4f534a, 'JSON must be the first chunk');
        try { json = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(buffer, offset, length))); }
        catch (error) { fail(`invalid JSON: ${error.message}`); }
      } else {
        check(chunks === 1 && type === 0x004e4942, 'only one embedded BIN chunk is supported');
        binary = new Uint8Array(buffer, offset, length);
      }
      offset += length; chunks++;
    }
    check(json && binary, 'JSON and BIN chunks are required');
    check(json.asset && json.asset.version === '2.0' && (!json.asset.minVersion || json.asset.minVersion === '2.0'), 'unsupported glTF version');
    check(!json.extensionsRequired || json.extensionsRequired.length === 0, 'required extensions are unsupported');
    noExtensions(json, 'document');
    check(!json.skins || json.skins.length === 0, 'skins are unsupported');
    check(!json.animations || json.animations.length === 0, 'glTF animation is unsupported; use L10 layer controller');
    check(Array.isArray(json.buffers) && json.buffers.length === 1, 'exactly one embedded buffer is required');
    const declared = json.buffers[0];
    check(declared.uri === undefined && integer(declared.byteLength) && declared.byteLength <= binary.length && binary.length - declared.byteLength <= 3, 'invalid embedded buffer size or external URI');
    noExtensions(declared, 'buffer');
    return { json, binary: binary.subarray(0, declared.byteLength) };
  }
  async function decodeBrowserImage(bytes, mimeType) {
    const blob = new Blob([bytes], { type: mimeType });
    if (typeof createImageBitmap === 'function') {
      return createImageBitmap(blob, { imageOrientation: 'none', premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
    }
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob), image = new Image();
      image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
      image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('L10 GLB: image decode failed')); };
      image.src = url;
    });
  }
  async function parse(buffer, options = {}) {
    const { json, binary } = glbDocument(buffer), imageCache = new Map(), materialCache = new Map();
    const decodedImages = [], primitives = [];
    let vertexCount = 0, sourceVertexCount = 0, imagePixels = 0;
    function bufferView(index) {
      const bv = ref(json.bufferViews, index, 'bufferView');
      noExtensions(bv, 'bufferView');
      const start = bv.byteOffset || 0;
      check(bv.buffer === 0 && integer(start) && integer(bv.byteLength) && start + bv.byteLength <= binary.byteLength, 'bufferView exceeds buffer');
      return { definition: bv, bytes: binary.subarray(start, start + bv.byteLength), start };
    }
    function accessor(index, expectedType, label) {
      const a = ref(json.accessors, index, `${label} accessor`);
      noExtensions(a, 'accessor');
      check(!a.sparse, 'sparse accessors are unsupported');
      check(a.type === expectedType && integer(a.count) && a.count > 0 && a.count <= MAX_VERTICES, `${label} accessor shape/count is invalid`);
      const component = COMPONENTS[a.componentType], width = SIZES[a.type];
      check(component && width, `${label} component type is unsupported`);
      const { definition: bv, bytes, start } = bufferView(a.bufferView);
      const byteOffset = a.byteOffset || 0, packed = component[0] * width, stride = bv.byteStride || packed;
      check(integer(byteOffset) && byteOffset % component[0] === 0 && (start + byteOffset) % component[0] === 0, `${label} accessor alignment is invalid`);
      check(integer(stride) && stride >= packed && stride % component[0] === 0 && (!bv.byteStride || stride <= 252), `${label} byteStride is invalid`);
      check(byteOffset + (a.count - 1) * stride + packed <= bytes.byteLength, `${label} accessor exceeds bufferView`);
      check(a.normalized === undefined || typeof a.normalized === 'boolean', `${label} normalized flag is invalid`);
      check(!a.normalized || [5120, 5121, 5122, 5123].includes(a.componentType), `${label} normalized component type is invalid`);
      const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), values = new Float64Array(a.count * width);
      for (let i = 0; i < a.count; i++) for (let c = 0; c < width; c++) {
        let v = dv[component[1]](byteOffset + i * stride + c * component[0], true);
        if (a.normalized) v = component[3] ? Math.max(v / component[2], -1) : v / component[2];
        check(Number.isFinite(v), `${label} contains nonfinite values`);
        values[i * width + c] = v;
      }
      return { values, definition: a };
    }
    async function image(index) {
      if (imageCache.has(index)) return imageCache.get(index);
      const pending = (async () => {
        const spec = ref(json.images, index, 'image'); noExtensions(spec, 'image');
        check(spec.uri === undefined && ['image/png', 'image/jpeg'].includes(spec.mimeType), 'only embedded PNG/JPEG images are supported');
        const view = bufferView(spec.bufferView);
        check(view.definition.byteStride === undefined, 'image bufferView cannot have byteStride');
        const bytes = view.bytes;
        check(spec.mimeType === 'image/png' ? bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v) : bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255, 'image signature does not match MIME type');
        const decoded = await (options.decodeImage || decodeBrowserImage)(bytes, spec.mimeType);
        decodedImages.push(decoded);
        check(integer(decoded.width) && integer(decoded.height) && decoded.width > 0 && decoded.height > 0 && decoded.width <= 8192 && decoded.height <= 8192, 'image dimensions are unsupported');
        imagePixels += decoded.width * decoded.height;
        check(imagePixels <= 64 * 1024 * 1024, 'decoded images exceed pixel budget');
        return decoded;
      })();
      imageCache.set(index, pending); return pending;
    }
    async function texture(info) {
      if (info === undefined) return { image: null, sampler: null };
      noExtensions(info, 'textureInfo');
      check(info.texCoord === undefined || info.texCoord === 0, 'only TEXCOORD_0 is supported');
      const spec = ref(json.textures, info.index, 'texture'); noExtensions(spec, 'texture');
      const s = spec.sampler === undefined ? {} : ref(json.samplers, spec.sampler, 'sampler');
      noExtensions(s, 'sampler');
      const sampler = { magFilter: s.magFilter === undefined ? 9729 : s.magFilter, minFilter: s.minFilter === undefined ? 9987 : s.minFilter, wrapS: s.wrapS === undefined ? 10497 : s.wrapS, wrapT: s.wrapT === undefined ? 10497 : s.wrapT };
      check([9728, 9729].includes(sampler.magFilter) && [9728, 9729, 9984, 9985, 9986, 9987].includes(sampler.minFilter) && [33071, 33648, 10497].includes(sampler.wrapS) && [33071, 33648, 10497].includes(sampler.wrapT), 'unsupported sampler value');
      const decoded = await image(spec.source);
      const powerOfTwo = n => (n & (n - 1)) === 0;
      check((powerOfTwo(decoded.width) && powerOfTwo(decoded.height)) || (sampler.wrapS === 33071 && sampler.wrapT === 33071 && [9728, 9729].includes(sampler.minFilter)), 'WebGL 1 NPOT images require clamp wrapping and non-mip filtering');
      return { image: decoded, sampler };
    }
    async function material(index) {
      const key = index === undefined ? -1 : index;
      if (materialCache.has(key)) return materialCache.get(key);
      const pending = (async () => {
        const m = index === undefined ? {} : ref(json.materials, index, 'material'); noExtensions(m, 'material');
        check(!m.emissiveTexture && (!m.emissiveFactor || numbers(m.emissiveFactor, 3, 'emissiveFactor').every(v => v === 0)), 'emissive materials are unsupported');
        const pbr = m.pbrMetallicRoughness || {}; noExtensions(pbr, 'PBR material');
        const factor = numbers(pbr.baseColorFactor || [1, 1, 1, 1], 4, 'baseColorFactor').slice();
        check(factor.every(v => v >= 0 && v <= 1), 'base color factors must be in [0,1]');
        const metallic = pbr.metallicFactor === undefined ? 1 : pbr.metallicFactor, roughness = pbr.roughnessFactor === undefined ? 1 : pbr.roughnessFactor;
        check([metallic, roughness].every(v => Number.isFinite(v) && v >= 0 && v <= 1), 'metallic/roughness factors must be in [0,1]');
        const alphaMode = m.alphaMode || 'OPAQUE', alphaCutoff = m.alphaCutoff === undefined ? .5 : m.alphaCutoff;
        check(['OPAQUE', 'MASK', 'BLEND'].includes(alphaMode) && Number.isFinite(alphaCutoff) && alphaCutoff >= 0 && alphaCutoff <= 1, 'invalid alpha mode/cutoff');
        check(m.doubleSided === undefined || typeof m.doubleSided === 'boolean', 'invalid doubleSided flag');
        const normalScale = m.normalTexture && m.normalTexture.scale !== undefined ? m.normalTexture.scale : 1;
        const occlusionStrength = m.occlusionTexture && m.occlusionTexture.strength !== undefined ? m.occlusionTexture.strength : 1;
        check(Number.isFinite(normalScale) && Number.isFinite(occlusionStrength) && occlusionStrength >= 0 && occlusionStrength <= 1, 'invalid normal scale/occlusion strength');
        // Sequential decode avoids unowned asynchronous images if one texture fails.
        const base = await texture(pbr.baseColorTexture), normal = await texture(m.normalTexture), mr = await texture(pbr.metallicRoughnessTexture), ao = await texture(m.occlusionTexture);
        return {
          name: m.name || `material-${key}`, baseColorFactor: factor, metallicFactor: metallic, roughnessFactor: roughness,
          baseColorTexture: base.image, baseColorSampler: base.sampler,
          normalTexture: normal.image, normalSampler: normal.sampler, normalScale,
          metallicRoughnessTexture: mr.image, metallicRoughnessSampler: mr.sampler,
          occlusionTexture: ao.image, occlusionSampler: ao.sampler, occlusionStrength,
          alphaMode, alphaCutoff, doubleSided: !!m.doubleSided,
          colorSpaces: { baseColor: 'srgb', normal: 'linear', metallicRoughness: 'linear', occlusion: 'linear' }, texCoord: 0
        };
      })();
      materialCache.set(key, pending); return pending;
    }
    async function primitive(spec, world, layer, name) {
      noExtensions(spec, 'primitive');
      check(spec.mode === undefined || spec.mode === 4, 'only TRIANGLES are supported');
      check(!spec.targets || spec.targets.length === 0, 'morph targets are unsupported');
      check(spec.attributes && Object.keys(spec.attributes).every(k => ['POSITION', 'NORMAL', 'TEXCOORD_0', 'TANGENT'].includes(k)), 'unsupported vertex attribute');
      const pos = accessor(spec.attributes.POSITION, 'VEC3', 'POSITION'), normal = accessor(spec.attributes.NORMAL, 'VEC3', 'NORMAL');
      check(pos.definition.componentType === 5126 && normal.definition.componentType === 5126, 'POSITION/NORMAL must use FLOAT');
      const count = pos.definition.count;
      check(normal.definition.count === count, 'NORMAL count differs from POSITION');
      const uv = spec.attributes.TEXCOORD_0 === undefined ? null : accessor(spec.attributes.TEXCOORD_0, 'VEC2', 'TEXCOORD_0');
      const tangent = spec.attributes.TANGENT === undefined ? null : accessor(spec.attributes.TANGENT, 'VEC4', 'TANGENT');
      check(!uv || (uv.definition.count === count && (uv.definition.componentType === 5126 || ([5121, 5123].includes(uv.definition.componentType) && uv.definition.normalized))), 'TEXCOORD_0 requires FLOAT or normalized unsigned integers');
      check(!tangent || (tangent.definition.count === count && tangent.definition.componentType === 5126), 'TANGENT requires matching FLOAT accessor');
      const mat = await material(spec.material), textured = mat.baseColorTexture || mat.normalTexture || mat.metallicRoughnessTexture || mat.occlusionTexture;
      check(!textured || uv, 'textured primitive requires TEXCOORD_0');
      check(!mat.normalTexture || tangent, 'normal-mapped primitive requires authored TANGENT');
      let indices;
      if (spec.indices !== undefined) {
        const idx = accessor(spec.indices, 'SCALAR', 'indices');
        check([5121, 5123, 5125].includes(idx.definition.componentType) && !idx.definition.normalized, 'indices must be unsigned integers');
        const bv = ref(json.bufferViews, idx.definition.bufferView, 'indices bufferView');
        check(bv.byteStride === undefined, 'indices cannot be interleaved');
        indices = idx.values;
      } else indices = Array.from({ length: count }, (_, i) => i);
      check(indices.length % 3 === 0 && indices.every(i => integer(i) && i < count), 'triangle indices are invalid or out of range');
      vertexCount += indices.length; sourceVertexCount += count;
      check(vertexCount <= MAX_VERTICES && primitives.length < 2048, 'expanded geometry exceeds budget');
      const a = Array.from(world.slice(0, 3)), b = Array.from(world.slice(4, 7)), c = Array.from(world.slice(8, 11));
      const ca = cross(b, c), cb = cross(c, a), cc = cross(a, b), determinant = dot(a, ca);
      check(Number.isFinite(determinant) && Math.abs(determinant) > 1e-12, 'singular node transform');
      const direction = v => [a[0] * v[0] + b[0] * v[1] + c[0] * v[2], a[1] * v[0] + b[1] * v[1] + c[1] * v[2], a[2] * v[0] + b[2] * v[1] + c[2] * v[2]];
      const data = new Float32Array(indices.length * 12), min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
      for (let output = 0; output < indices.length; output++) {
        const slot = determinant < 0 && output % 3 !== 0 ? output + (output % 3 === 1 ? 1 : -1) : output;
        const i = indices[slot], p = direction(pos.values.subarray(i * 3, i * 3 + 3));
        p[0] += world[12]; p[1] += world[13]; p[2] += world[14];
        const n0 = normal.values.subarray(i * 3, i * 3 + 3);
        const n = unit([0, 1, 2].map(k => (ca[k] * n0[0] + cb[k] * n0[1] + cc[k] * n0[2]) / determinant), `${name} vertex ${i} normal`);
        const t0 = tangent ? tangent.values.subarray(i * 4, i * 4 + 3) : cross(Math.abs(n0[1]) < .9 ? [0, 1, 0] : [1, 0, 0], Array.from(n0));
        const transformed = direction(t0), projection = dot(n, transformed);
        const t = unit(transformed.map((v, k) => v - projection * n[k]), `${name} vertex ${i} tangent`);
        const hand = tangent ? tangent.values[i * 4 + 3] : 1;
        check(hand === 1 || hand === -1, 'tangent handedness must be +/-1');
        data.set([...p, ...n, uv ? uv.values[i * 2] : 0, uv ? uv.values[i * 2 + 1] : 0, ...t, hand * (determinant < 0 ? -1 : 1)], output * 12);
        for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], p[k]); max[k] = Math.max(max[k], p[k]); }
      }
      check(data.every(Number.isFinite), 'baked geometry exceeds finite FLOAT range');
      primitives.push({ name, layer, data, material: mat, nodeMatrix: identity(), sourceNodeMatrix: new Float32Array(world), bounds: { min, max } });
    }
    const visited = new Set();
    async function node(index, parent, inheritedLayer, depth = 0) {
      check(depth <= 128, 'node hierarchy exceeds supported depth');
      check(!visited.has(index), 'node hierarchy contains a cycle or multiple parents'); visited.add(index);
      const n = ref(json.nodes, index, 'node'); noExtensions(n, 'node');
      check(n.skin === undefined && n.weights === undefined, 'skin/morph node is unsupported');
      check(n.camera === undefined, 'camera nodes are unsupported; renderer owns camera');
      const layer = n.extras && n.extras.l10Layer !== undefined ? n.extras.l10Layer : inheritedLayer;
      check(layer === undefined || LAYERS.has(layer), 'unknown extras.l10Layer');
      const world = multiply(parent, localMatrix(n));
      if (n.mesh !== undefined) {
        check(LAYERS.has(layer), 'mesh requires inherited extras.l10Layer');
        const mesh = ref(json.meshes, n.mesh, 'mesh'); noExtensions(mesh, 'mesh');
        check(mesh.weights === undefined && Array.isArray(mesh.primitives) && mesh.primitives.length > 0, 'invalid or morph mesh');
        for (let i = 0; i < mesh.primitives.length; i++) await primitive(mesh.primitives[i], world, layer, `${n.name || mesh.name || `node-${index}`}#${i}`);
      }
      check(n.children === undefined || Array.isArray(n.children), 'node children must be an array');
      for (const child of n.children || []) await node(child, world, layer, depth + 1);
    }
    function disposeImages() {
      for (const image of decodedImages.splice(0)) if (typeof image.close === 'function') image.close();
    }
    try {
      check(Array.isArray(json.nodes) && json.nodes.length > 0 && json.nodes.length <= 4096, 'invalid node count');
      const scene = ref(json.scenes, json.scene === undefined ? 0 : json.scene, 'scene'); noExtensions(scene, 'scene');
      check(Array.isArray(scene.nodes) && scene.nodes.length > 0, 'default scene is empty');
      for (const root of scene.nodes) await node(root, identity(), undefined);
      check(primitives.length > 0, 'no renderable geometry');
      return { primitives, metadata: { asset: json.asset, extras: json.extras || {}, bytes: buffer.byteLength, primitiveCount: primitives.length, vertexCount, sourceVertexCount, imageCount: decodedImages.length, imagePixels, layers: [...new Set(primitives.map(p => p.layer))], coordinateSystem: 'glTF Y-up; node transforms baked; UV/image origin unchanged', strideFloats: 12 }, disposeImages };
    } catch (error) { disposeImages(); throw error; }
  }
  async function load(url) {
    const resolved = new URL(url, window.location.href);
    check(['http:', 'https:'].includes(resolved.protocol) && resolved.origin === window.location.origin, 'asset URL must be same-origin HTTP(S)');
    const response = await fetch(resolved.href, { credentials: 'same-origin', redirect: 'error' });
    check(response.ok, `asset request failed (${response.status})`);
    if (response.url) check(new URL(response.url).origin === resolved.origin, 'asset redirected outside origin');
    const length = Number(response.headers.get('content-length'));
    check(!length || length <= MAX_BYTES, 'asset exceeds byte budget');
    return parse(await response.arrayBuffer());
  }
  window.PAL10GLTF = Object.freeze({ load, parse, version: 1 });
})();
