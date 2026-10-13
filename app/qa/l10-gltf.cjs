/* CPU contract tests for the GLB adapter; real image/shader validation belongs
 * to the browser prototype evidence, not a mocked renderer. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const sandbox = { window: {}, ArrayBuffer, Uint8Array, Float32Array, Float64Array, DataView, TextDecoder, URL, Blob, Math, Number, Set, Map };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../static/js/l10-gltf.js'), 'utf8'), sandbox);
const api = sandbox.window.PAL10GLTF;
const near = (a, b, tolerance = 1e-6) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
const arrayNear = (a, b) => { assert.equal(a.length, b.length); a.forEach((v, i) => near(v, b[i])); };
let passes = 0;
async function test(name, run) { await run(); passes++; console.log(`PASS ${name}`); }
function fixture() {
  const chunks = [];
  const doc = { asset: { version: '2.0', generator: 'L10 adapter test fixture' }, buffers: [{ byteLength: 0 }], bufferViews: [], accessors: [], meshes: [{ primitives: [{ attributes: {} }] }], nodes: [{ extras: { l10Layer: 'board' }, children: [1], translation: [2, 3, 4] }, { name: 'board-surface', mesh: 0, scale: [2, 3, 4] }], scenes: [{ nodes: [0] }], scene: 0 };
  function addView(raw, extra = {}) {
    const data = Buffer.from(raw.buffer || raw, raw.byteOffset || 0, raw.byteLength || raw.length);
    const byteOffset = chunks.reduce((n, b) => n + b.length, 0), padded = Buffer.alloc(Math.ceil(data.length / 4) * 4);
    data.copy(padded); chunks.push(padded);
    doc.bufferViews.push({ buffer: 0, byteOffset, byteLength: data.length, ...extra });
    return doc.bufferViews.length - 1;
  }
  function addAccessor(values, type, componentType = 5126, extra = {}) {
    const typeSize = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[type];
    doc.accessors.push({ bufferView: addView(values), componentType, count: values.length / typeSize, type, ...extra });
    return doc.accessors.length - 1;
  }
  const spec = doc.meshes[0].primitives[0];
  spec.attributes.POSITION = addAccessor(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 'VEC3');
  spec.attributes.NORMAL = addAccessor(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]), 'VEC3');
  spec.attributes.TEXCOORD_0 = addAccessor(new Float32Array([0, 0, 1, 0, 0, 1]), 'VEC2');
  spec.attributes.TANGENT = addAccessor(new Float32Array([1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1]), 'VEC4');
  spec.indices = addAccessor(new Uint16Array([0, 1, 2]), 'SCALAR', 5123);
  function png() {
    const bufferView = addView(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]));
    doc.images = doc.images || []; doc.images.push({ bufferView, mimeType: 'image/png' });
    doc.textures = doc.textures || []; doc.textures.push({ source: doc.images.length - 1 });
    return { index: doc.textures.length - 1 };
  }
  function bytes() {
    const bin = Buffer.concat(chunks); doc.buffers[0].byteLength = bin.length;
    const json = Buffer.from(JSON.stringify(doc)), jsonPadded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32);
    json.copy(jsonPadded);
    const header = Buffer.alloc(20), binHeader = Buffer.alloc(8);
    header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + jsonPadded.length + bin.length, 8);
    header.writeUInt32LE(jsonPadded.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
    binHeader.writeUInt32LE(bin.length); binHeader.writeUInt32LE(0x004e4942, 4);
    const result = Buffer.concat([header, jsonPadded, binHeader, bin]);
    return result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength);
  }
  return { doc, spec, addView, addAccessor, png, bytes };
}
const decode = async () => ({ width: 4, height: 4 });
async function reject(mutator, pattern, options = {}) {
  const f = fixture(); mutator(f); await assert.rejects(api.parse(f.bytes(), { decodeImage: decode, ...options }), pattern);
}
(async () => {
  await test('hierarchy + TRS are baked; animation layer is inherited', async () => {
    const f = fixture(), result = await api.parse(f.bytes()), p = result.primitives[0];
    assert.equal(p.layer, 'board'); assert.equal(p.name, 'board-surface#0'); assert.equal(p.data.length, 36);
    arrayNear(p.data.slice(0, 3), [2, 3, 4]); arrayNear(p.data.slice(12, 15), [4, 3, 4]); arrayNear(p.data.slice(24, 27), [2, 6, 4]);
    arrayNear(p.nodeMatrix, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    assert.equal(result.metadata.strideFloats, 12); assert.equal(result.metadata.vertexCount, 3);
  });
  await test('glTF default metallic-roughness is preserved, not guessed', async () => {
    const result = await api.parse(fixture().bytes()), m = result.primitives[0].material;
    assert.equal(m.metallicFactor, 1); assert.equal(m.roughnessFactor, 1); assert.equal(m.alphaMode, 'OPAQUE');
    assert.equal(m.baseColorTexture, null); arrayNear(m.baseColorFactor, [1, 1, 1, 1]);
  });
  await test('inverse-transpose normal and Gram-Schmidt tangent under nonuniform scale', async () => {
    const f = fixture(), v = Math.SQRT1_2;
    f.spec.attributes.NORMAL = f.addAccessor(new Float32Array([v, v, 0, v, v, 0, v, v, 0]), 'VEC3');
    f.spec.attributes.TANGENT = f.addAccessor(new Float32Array([v, -v, 0, 1, v, -v, 0, 1, v, -v, 0, 1]), 'VEC4');
    const data = (await api.parse(f.bytes())).primitives[0].data, length = Math.hypot(.5, 1 / 3);
    arrayNear(data.slice(3, 6), [.5 / length, (1 / 3) / length, 0]);
    near(data[3] * data[8] + data[4] * data[9] + data[5] * data[10], 0); near(Math.hypot(...data.slice(8, 11)), 1);
  });
  await test('mirrored transforms correct triangle winding and tangent handedness', async () => {
    const f = fixture(); f.doc.nodes[1].scale = [-2, 3, 4];
    const data = (await api.parse(f.bytes())).primitives[0].data;
    arrayNear(data.slice(12, 15), [2, 6, 4]); arrayNear(data.slice(24, 27), [0, 3, 4]);
    assert.equal(data[11], -1); assert.equal(data[23], -1); near(data[8], -1);
    const ab = [data[12] - data[0], data[13] - data[1]], ac = [data[24] - data[0], data[25] - data[1]];
    assert.ok(ab[0] * ac[1] - ab[1] * ac[0] > 0, 'CCW matches transformed +Z normal');
  });
  await test('matrix transform and quaternion rotation are supported', async () => {
    const f = fixture(); delete f.doc.nodes[1].scale;
    f.doc.nodes[1].matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 4, 5, 6, 1];
    f.doc.nodes[0].rotation = [0, 0, Math.SQRT1_2, Math.SQRT1_2];
    arrayNear((await api.parse(f.bytes())).primitives[0].data.slice(0, 3), [-3, 7, 10]);
  });
  await test('accessor offsets, byte strides, and normalized unsigned UVs', async () => {
    const f = fixture(), view = f.addView(new Uint16Array([999, 0, 0, 999, 999, 65535, 0, 999, 999, 0, 65535, 999]), { byteStride: 8 });
    f.doc.accessors.push({ bufferView: view, byteOffset: 2, componentType: 5123, normalized: true, count: 3, type: 'VEC2' });
    f.spec.attributes.TEXCOORD_0 = f.doc.accessors.length - 1;
    const data = (await api.parse(f.bytes())).primitives[0].data;
    arrayNear(data.slice(6, 8), [0, 0]); arrayNear(data.slice(18, 20), [1, 0]); arrayNear(data.slice(30, 32), [0, 1]);
  });
  await test('nonindexed triangles and optional UV/tangent fallback', async () => {
    const f = fixture(); delete f.spec.indices; delete f.spec.attributes.TEXCOORD_0; delete f.spec.attributes.TANGENT;
    const data = (await api.parse(f.bytes())).primitives[0].data;
    arrayNear(data.slice(6, 8), [0, 0]); near(Math.hypot(...data.slice(8, 11)), 1);
  });
  await test('embedded image is deduplicated, channels/samplers/factors retained, disposal idempotent', async () => {
    const f = fixture(), texture = f.png(); let decoded = 0, closed = 0;
    f.doc.samplers = [{ magFilter: 9728, minFilter: 9984, wrapS: 33648, wrapT: 33071 }]; f.doc.textures[0].sampler = 0;
    f.doc.materials = [{ name: 'Authored surface', pbrMetallicRoughness: { baseColorFactor: [.2, .3, .4, .8], metallicFactor: .8, roughnessFactor: .4, baseColorTexture: texture, metallicRoughnessTexture: texture }, normalTexture: { ...texture, scale: .25 }, occlusionTexture: { ...texture, strength: .6 }, doubleSided: true, alphaMode: 'MASK', alphaCutoff: .3 }]; f.spec.material = 0;
    const result = await api.parse(f.bytes(), { decodeImage: async () => { decoded++; return { width: 4, height: 4, close() { closed++; } }; } });
    const m = result.primitives[0].material;
    assert.equal(decoded, 1); assert.equal(m.normalTexture, m.baseColorTexture); assert.equal(m.metallicRoughnessTexture, m.occlusionTexture);
    assert.equal(m.baseColorSampler.wrapS, 33648); assert.equal(m.baseColorSampler.minFilter, 9984);
    assert.equal(m.normalScale, .25); assert.equal(m.occlusionStrength, .6); assert.equal(m.metallicFactor, .8); assert.equal(m.roughnessFactor, .4);
    assert.equal(m.colorSpaces.baseColor, 'srgb'); assert.equal(m.colorSpaces.metallicRoughness, 'linear'); assert.equal(m.doubleSided, true); assert.equal(m.alphaCutoff, .3);
    result.disposeImages(); result.disposeImages(); assert.equal(closed, 1);
  });
  await test('material failures close already decoded images', async () => {
    let closed = 0;
    await reject(f => { const t = f.png(); f.doc.materials = [{ pbrMetallicRoughness: { baseColorTexture: t }, normalTexture: { index: 99 } }]; f.spec.material = 0; }, /texture index/, { decodeImage: async () => ({ width: 4, height: 4, close() { closed++; } }) });
    assert.equal(closed, 1);
  });
  await test('silicon optical finish is bounded, opt-in and defaults to zero', async () => {
    const f=fixture();f.spec.material=0;f.doc.materials=[{extras:{l10ThinFilmStrength:.15,l10ThinFilmThickness:400}}];
    const m=(await api.parse(f.bytes())).primitives[0].material;
    assert.equal(m.thinFilmStrength,.15);assert.equal(m.thinFilmThickness,400);
    assert.equal((await api.parse(fixture().bytes())).primitives[0].material.thinFilmStrength,0);
    for(const value of [-.01,.26,'0.1'])await reject(f=>{f.spec.material=0;f.doc.materials=[{extras:{l10ThinFilmStrength:value}}];},/thin-film strength/);
    for(const value of [249,651,'400'])await reject(f=>{f.spec.material=0;f.doc.materials=[{extras:{l10ThinFilmThickness:value}}];},/thin-film thickness/);
  });
  await test('malformed GLB lengths, magic, chunks and JSON fail closed', async () => {
    for (const [offset, value, pattern] of [[0, 0, /version 2/], [4, 1, /version 2/], [8, 25, /declared length/], [12, 0xfffffff0, /chunk length/], [16, 0, /first chunk/]]) {
      const bytes = fixture().bytes(); new DataView(bytes).setUint32(offset, value, true); await assert.rejects(api.parse(bytes), pattern);
    }
    const bytes = fixture().bytes(); new Uint8Array(bytes)[20] = 0; await assert.rejects(api.parse(bytes), /invalid JSON/);
  });
  await test('external buffers/images and unsupported extensions rejected', async () => {
    await reject(f => { f.doc.buffers[0].uri = 'remote.bin'; }, /external URI/);
    await reject(f => { const t = f.png(); f.doc.images[0].uri = 'https://other/image.png'; f.doc.materials = [{ pbrMetallicRoughness: { baseColorTexture: t } }]; f.spec.material = 0; }, /embedded PNG/);
    await reject(f => { f.doc.extensionsRequired = ['KHR_draco_mesh_compression']; }, /required extensions/);
    await reject(f => { f.doc.materials = [{ extensions: { KHR_materials_clearcoat: {} } }]; f.spec.material = 0; }, /material extensions/);
    await reject(f => { const t = f.png(); t.extensions = { KHR_texture_transform: { offset: [.2, 0] } }; f.doc.materials = [{ pbrMetallicRoughness: { baseColorTexture: t } }]; f.spec.material = 0; }, /textureInfo extensions/);
  });
  await test('skins, animation, morphs, vertex colors and unsupported primitive modes rejected', async () => {
    await reject(f => { f.doc.skins = [{}]; }, /skins/);
    await reject(f => { f.doc.animations = [{}]; }, /animation/);
    await reject(f => { f.spec.targets = [{}]; }, /morph/);
    await reject(f => { f.spec.attributes.COLOR_0 = 0; }, /vertex attribute/);
    await reject(f => { f.spec.mode = 5; }, /TRIANGLES/);
  });
  await test('out-of-bounds views/accessors/indices and nonfinite values rejected', async () => {
    await reject(f => { f.doc.bufferViews[0].byteLength = 100000; }, /bufferView exceeds/);
    await reject(f => { f.doc.accessors[0].count = 1000; }, /accessor exceeds/);
    await reject(f => { f.doc.accessors[0].byteOffset = 1; }, /alignment/);
    await reject(f => { f.doc.bufferViews[0].byteStride = 8; }, /byteStride/);
    await reject(f => { f.spec.indices = f.addAccessor(new Uint32Array([0, 1, 99999]), 'SCALAR', 5125); }, /out of range/);
    await reject(f => { f.spec.attributes.POSITION = f.addAccessor(new Float32Array([NaN, 0, 0, 1, 0, 0, 0, 1, 0]), 'VEC3'); }, /nonfinite/);
    await reject(f => { f.doc.accessors[0].sparse = {}; }, /sparse/);
  });
  await test('hierarchy cycles/multiple parents/missing layers/singular transforms rejected', async () => {
    await reject(f => { f.doc.nodes[1].children = [0]; }, /cycle/);
    await reject(f => { f.doc.scenes[0].nodes.push(1); }, /multiple parents/);
    await reject(f => { delete f.doc.nodes[0].extras; }, /l10Layer/);
    await reject(f => { f.doc.nodes[0].extras.l10Layer = 'unknown'; }, /unknown/);
    await reject(f => { f.doc.nodes[1].scale = [0, 1, 1]; }, /singular/);
    await reject(f => { f.doc.nodes[1].rotation = [0, 0, 0, 2]; }, /normalized/);
  });
  await test('normal maps require authored tangent/UV; unsupported lighting factors rejected', async () => {
    await reject(f => { f.doc.materials = [{ normalTexture: f.png() }]; f.spec.material = 0; delete f.spec.attributes.TANGENT; }, /authored TANGENT/);
    await reject(f => { f.doc.materials = [{ normalTexture: f.png() }]; f.spec.material = 0; delete f.spec.attributes.TEXCOORD_0; }, /TEXCOORD_0/);
    await reject(f => { f.doc.materials = [{ emissiveFactor: [1, 0, 0] }]; f.spec.material = 0; }, /emissive/);
    await reject(f => { f.doc.materials = [{ pbrMetallicRoughness: { roughnessFactor: -1 } }]; f.spec.material = 0; }, /factors/);
  });
  await test('WebGL 1 NPOT sampler requirements are explicit', async () => {
    const make = () => { const f = fixture(); f.doc.materials = [{ pbrMetallicRoughness: { baseColorTexture: f.png() } }]; f.spec.material = 0; return f; };
    const bad = make(); await assert.rejects(api.parse(bad.bytes(), { decodeImage: async () => ({ width: 3, height: 5 }) }), /NPOT/);
    const good = make(); good.doc.samplers = [{ wrapS: 33071, wrapT: 33071, minFilter: 9729 }]; good.doc.textures[0].sampler = 0;
    assert.equal((await api.parse(good.bytes(), { decodeImage: async () => ({ width: 3, height: 5 }) })).metadata.imageCount, 1);
  });
  await test('network loader enforces same-origin HTTP(S), no redirects, status and byte budget', async () => {
    sandbox.window.location = { href: 'https://pa.test/overview', origin: 'https://pa.test' };
    let calls = 0;
    sandbox.fetch = async (url, options) => {
      calls++; assert.equal(url, 'https://pa.test/static/board.glb'); assert.equal(options.credentials, 'same-origin'); assert.equal(options.redirect, 'error');
      return { ok: true, status: 200, url, headers: { get: () => null }, arrayBuffer: async () => fixture().bytes() };
    };
    await assert.rejects(api.load('https://other.test/model.glb'), /same-origin/);
    await assert.rejects(api.load('data:model/gltf-binary;base64,AA=='), /same-origin/);
    assert.equal(calls, 0); assert.equal((await api.load('/static/board.glb')).metadata.vertexCount, 3); assert.equal(calls, 1);
    sandbox.fetch = async () => ({ ok: false, status: 404 });
    await assert.rejects(api.load('/static/board.glb'), /404/);
    sandbox.fetch = async () => ({ ok: true, url: 'https://pa.test/static/board.glb', headers: { get: () => 65 * 1024 * 1024 } });
    await assert.rejects(api.load('/static/board.glb'), /byte budget/);
  });
  if (process.argv[2] === '--asset') {
    assert.ok(process.argv[3], '--asset requires a GLB path');
    await test('actual exported GLB structure and declared controllable hardware layers', async () => {
      const source = fs.readFileSync(path.resolve(process.argv[3]));
      const result = await api.parse(source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength), {
        // This is structural image inspection, not a claim of browser decoding.
        // Actual PNG rendering/color space/normal mapping is verified in Chrome.
        decodeImage: async (bytes, mimeType) => {
          assert.equal(mimeType, 'image/png', 'prototype pipeline currently exports PNG');
          assert.ok(bytes.length >= 24, 'PNG IHDR is present');
          const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
          assert.equal(header.getUint32(12, false), 0x49484452, 'first PNG chunk is IHDR');
          return { width: header.getUint32(16, false), height: header.getUint32(20, false) };
        }
      });
      const bare=result.metadata.extras.bareBoardOnly===true;
      if(bare)assert.deepEqual(Array.from(result.metadata.extras.replacesComputeBoards),[0,1]);
      const expectedLayers=bare?['board','packages']:['board','cooling','cooling-frame','packages'];
      if(result.metadata.extras.replacesServiceGeometry===true)expectedLayers.push('io');
      if(result.metadata.extras.replacesNetworking===true){
        assert.ok(bare,'Networking ownership is restricted to the bare-board candidate');
        assert.deepEqual(Array.from(result.metadata.extras.networkCards),['BF3-L','BF3-R','CX7-R']);expectedLayers.push('network');
      }
      assert.deepEqual([...result.metadata.layers].sort(),expectedLayers.sort());
      const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
      for (const p of result.primitives) for (let k = 0; k < 3; k++) { bounds.min[k] = Math.min(bounds.min[k], p.bounds.min[k]); bounds.max[k] = Math.max(bounds.max[k], p.bounds.max[k]); }
      console.log(JSON.stringify({ structuralAsset: process.argv[3], ...result.metadata, bounds, texturePrimitives: result.primitives.filter(p => p.material.baseColorTexture).length, normalMappedPrimitives: result.primitives.filter(p => p.material.normalTexture).length, alphaModes: [...new Set(result.primitives.map(p => p.material.alphaMode))] }, null, 2));
      result.disposeImages();
    });
  }
  console.log(`PASS ${passes} GLB adapter groups: bounded parser, transforms, material/texture fidelity, cleanup and rejection paths`);
})().catch(error => { console.error(error); process.exitCode = 1; });
