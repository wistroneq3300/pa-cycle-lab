/* =========================================================================
 * rack-scene.js — 資料驅動 48U 機櫃（Rack Manager / L11）
 * -------------------------------------------------------------------------
 * 取代「寫死的 showpiece」。你放什麼，3D 就長什麼：
 *   - 每個元件依真實資料 (mgx_type, rack_u, rack_size, rack_side) 定位與定尺寸
 *   - 每種元件有獨立視覺語彙（Server/Switch(SN2000)/CDU/PDU/PowerShelf/Storage/Blanking）
 *   - 純 WebGL，零外部模型/貼圖，所有反光皆 shader 即時計算
 * 不覆寫 core-scene.js（舊版保留於 core-scene.old.js）。
 *
 * 掛載 API（與 core-scene 相容的出入口）：
 *   window.PARackScene.mount(canvas, { project, members, opts })
 *     -> { setProject, setMode, select, getState, resize, destroy }
 * ========================================================================= */
(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
  const mix = (a, b, t) => a + (b - a) * t;
  const ease = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

  // ---- 世界/機櫃常數 ----
  const RACK_W = 0.6;      // 19" 機箱內寬(半寬0.3)
  const RACK_D = 0.7;      // 深度(半)
  const U_H = 0.089;       // 每 U 高度(世界單位), 48U ≈ 4.27
  const RAILS_X = 0.315;   // 前方直立導軌位置

  // ---- 材質金屬度/色彩 (沿用 core-scene 的視覺語言) ----
  const M = {
    mServer:     0.85,   // 高金屬
    mChassis:    0.35,
    mPlastic:    0.05,
    mPort:       0.90,
    mBlank:      0.30,
    mCable:      0.05,
  };
  const C = {
    silver:  [.43,.47,.51], lid:    [.50,.53,.57], edge:  [.66,.69,.71],
    dark:    [.07,.09,.11], graphite:[.13,.16,.19], panel: [.20,.23,.26],
    copper:  [.50,.28,.16], blue:   [.15,.36,.55], green:[.25,.55,.30],
    amber:   [.80,.60,.15], white:  [.85,.87,.90],
  };

  // =========================================================================
  //  程序化 mesh builder（輸出 interleaved float32: pos3+normal3+color4+mat2 = 12 floats/vertex）
  // =========================================================================
  function builder() {
    const d = [];
    function push(p, n, c, metal, mat2) {
      d.push(p[0], p[1], p[2], n[0], n[1], n[2], c[0], c[1], c[2], 1, metal, mat2);
    }
    // 六面體
    function box(cx, cy, cz, hx, hy, hz, color, metal = M.mChassis, mat2 = 0) {
      const x0 = cx - hx, x1 = cx + hx, y0 = cy - hy, y1 = cy + hy, z0 = cz - hz, z1 = cz + hz;
      const f = (a, b, cc, dd, n) => {
        const idx = [a, b, cc, dd];
        const F = [[0, 1, 2], [0, 2, 3]];
        F.forEach(t => t.forEach(i => push(idx[i], n, color, metal, mat2)));
      };
      // +z 前
      f([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]);
      // -z 後
      f([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [0, 0, -1]);
      // +x
      f([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [1, 0, 0]);
      // -x
      f([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]);
      // +y
      f([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], [0, 1, 0]);
      // -y
      f([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0]);
    }
    // 一層薄板（單面 +z）
    function plate(cx, cy, cz, hx, hy, dz, color, metal, mat2 = 0) {
      const n = [0, 0, 1];
      const x0 = cx - hx, x1 = cx + hx, y0 = cy - hy, y1 = cy + hy, z = cz + dz;
      push([x0, y0, z], n, color, metal, mat2); push([x1, y0, z], n, color, metal, mat2); push([x1, y1, z], n, color, metal, mat2);
      push([x0, y0, z], n, color, metal, mat2); push([x1, y1, z], n, color, metal, mat2); push([x0, y1, z], n, color, metal, mat2);
    }
    // 小立方體單點（狀態燈/LED/把手）
    function cube(cx, cy, cz, s, color, metal = M.mPlastic, mat2 = 0) { box(cx, cy, cz, s / 2, s / 2, s / 2, color, metal, mat2); }
    return { box, plate, cube, data: () => new Float32Array(d), count: d.length / 12 };
  }

  // =========================================================================
  //  元件產生器（依 U 數與特性調整比例）— 每個回傳 { data, box }，box 為 OBB 半長供 raycast
  // =========================================================================
  const COMPONENTS = {
    // 機身 + 前方兩片把手 + 中間狀態燈；U 數高則拉長
    server(u, b) {
      const hy = (u * U_H) / 2, z = 0.06;
      b.box(0, 0, 0, RACK_W - 0.05, hy, RACK_D * 0.9, u >= 2 ? C.edge : C.silver, M.mServer, 0);
      // 前面板
      b.plate(0, 0, RACK_D * 0.9, RACK_W - 0.05, hy - 0.006, 0.002, u >= 2 ? C.lid : C.silver, M.mServer);
      // 把手（左右各一）
      b.box(-(RACK_W - 0.06), 0, RACK_D * 0.9, 0.02, hy * 0.8, 0.012, C.edge, M.mServer);
      b.box((RACK_W - 0.06), 0, RACK_D * 0.9, 0.02, hy * 0.8, 0.012, C.edge, M.mServer);
      // 導軌（上下前緣）
      b.box(0, hy - 0.004, 0.05, RACK_W, 0.008, 0.012, C.graphite, M.mServer);
      b.box(0, -hy + 0.004, 0.05, RACK_W, 0.008, 0.012, C.graphite, M.mServer);
      // 狀態燈列（前方中線，依高度數量增）
      const nled = Math.max(1, Math.round(u * 2));
      for (let i = 0; i < nled; i++) {
        const y = -hy + 0.02 + (i / Math.max(1, nled - 1)) * (2 * hy - 0.04);
        b.cube(-(RACK_W - 0.14), y, RACK_D * 0.9 + 0.004, 0.012, i % 3 === 0 ? C.green : (i % 3 === 1 ? C.amber : C.blue));
      }
      return { half: [RACK_W, hy, RACK_D] };
    },

    // NVIDIA SN2000 風格 1U 交換器：一整排連接埠陣列 + 品牌標誌 + 系統 LED
    switch(u, b) {
      const hy = (u * U_H) / 2;
      b.box(0, 0, 0, RACK_W - 0.03, hy, RACK_D * 0.8, C.dark, M.mServer);
      b.plate(0, 0, RACK_D * 0.8, RACK_W - 0.03, hy - 0.006, 0.003, C.graphite, M.mChassis);
      // SN2000 正面連接埠陣列（一整排 high-metal 方塊 = SFP/OSFP port）
      const ports = 16, pw = (RACK_W * 2 - 0.1) / ports;
      for (let i = 0; i < ports; i++) {
        const x = -(RACK_W - 0.06) + pw / 2 + i * pw;
        b.box(x, 0, RACK_D * 0.8 + 0.006, pw * 0.32, hy * 0.62, 0.014, C.dark, M.mPort);
      }
      // NVIDIA 標誌（前方左側小亮塊）
      b.cube(-(RACK_W - 0.14), 0, RACK_D * 0.8 + 0.01, 0.04, C.green, M.mPlastic);
      // 系統 / 電源 LED（右側）
      b.cube(RACK_W - 0.06, hy * 0.35, RACK_D * 0.8 + 0.008, 0.02, C.white, M.mPlastic);
      b.cube(RACK_W - 0.06, -hy * 0.35, RACK_D * 0.8 + 0.008, 0.02, C.amber, M.mPlastic);
      return { half: [RACK_W, hy, RACK_D] };
    },

    // CDU（冷卻液分配單元）：前面板控制面板 + 上下冷卻接頭 + 管路
    cdu(u, b) {
      const hy = (u * U_H) / 2;
      b.box(0, 0, 0, RACK_W - 0.03, hy, RACK_D * 0.85, C.graphite, M.mChassis);
      b.plate(0, 0, RACK_D * 0.85, RACK_W - 0.03, hy - 0.01, 0.003, C.panel, M.mChassis);
      // 控制面板（中央螢幕 + 按鈕/狀態燈）
      b.plate(0, 0, RACK_D * 0.85 + 0.006, RACK_W * 0.5, hy * 0.4, 0.002, [0.05, .08, .12], M.mPlastic);
      b.cube(0, 0, RACK_D * 0.85 + 0.012, 0.03, C.green, M.mPlastic); // 電源指示
      b.cube(-(RACK_W * 0.6), 0, RACK_D * 0.85 + 0.01, 0.03, C.amber, M.mPlastic);
      b.cube((RACK_W * 0.6), 0, RACK_D * 0.85 + 0.01, 0.03, C.blue, M.mPlastic);
      // 冷卻接頭（上下各一排，copper 圓柱近似 = box）
      b.box(0, hy - 0.02, RACK_D * 0.85, RACK_W * 0.5, 0.03, 0.02, C.copper, M.mServer);
      b.box(0, -hy + 0.02, RACK_D * 0.85, RACK_W * 0.5, 0.03, 0.02, C.copper, M.mServer);
      // 管路（左右）
      b.box(-RACK_W, 0, 0.1, 0.015, hy, 0.015, C.copper, M.mServer);
      b.box(RACK_W, 0, 0.1, 0.015, hy, 0.015, C.copper, M.mServer);
      return { half: [RACK_W, hy, RACK_D] };
    },

    // Power Shelf：前排一整排 PSU 模組（把手+LED）
    powershelf(u, b) {
      const hy = (u * U_H) / 2;
      b.box(0, 0, 0, RACK_W - 0.03, hy, RACK_D * 0.7, C.lid, M.mServer);
      b.plate(0, 0, RACK_D * 0.7, RACK_W - 0.03, hy - 0.006, 0.002, C.silver, M.mServer);
      // PSU 模組列
      const n = Math.max(2, Math.round(u * 2)), pw = (RACK_W * 2 - 0.08) / n;
      for (let i = 0; i < n; i++) {
        const x = -(RACK_W - 0.05) + pw / 2 + i * pw;
        b.box(x, 0, RACK_D * 0.7 + 0.006, pw * 0.36, hy * 0.8, 0.02, C.dark, M.mServer);
        b.cube(x + pw * 0.1, hy * 0.4, RACK_D * 0.7 + 0.012, 0.014, C.green, M.mPlastic);
      }
      return { half: [RACK_W, hy, RACK_D] };
    },

    // 側掛 PDU（zero-U）：前方一整排電源插座 + 上下輸入接頭
    pdu(u, b) {
      const hy = 8 * U_H / 2; // 側掛型高度固定為整櫃常見 8U 區段（依資料調整）
      b.box(0, 0, 0, 0.03, hy, 0.03, C.lid, M.mPlastic);
      b.plate(0, 0, 0.032, 0.015, hy - 0.01, 0.002, C.panel, M.mPlastic);
      const n = Math.round(hy / 0.02), spacing = (2 * hy - 0.04) / Math.max(1, n - 1);
      for (let i = 0; i < n; i++) {
        const y = -hy + 0.02 + i * spacing;
        b.box(0, y, 0.036, 0.012, 0.008, 0.004, [0.8, .82, .86], M.mPort); // C13/C19 插座
      }
      b.cube(0, hy - 0.015, 0.036, 0.02, [0.5, .52, .56], M.mPort); // 輸入接頭
      b.cube(0, -hy + 0.015, 0.036, 0.02, [0.5, .52, .56], M.mPort);
      return { half: [0.03, hy, 0.04] };
    },

    // Storage：前方磁碟槽陣列 + 抽取把手
    storage(u, b) {
      const hy = (u * U_H) / 2;
      b.box(0, 0, 0, RACK_W - 0.03, hy, RACK_D * 0.7, C.lid, M.mServer);
      b.plate(0, 0, RACK_D * 0.7, RACK_W - 0.03, hy - 0.006, 0.002, C.silver, M.mServer);
      // 磁碟槽（一排小格）
      const rows = Math.max(1, Math.round(u * 3)), cols = 5, cw = (RACK_W * 2 - 0.12) / cols;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const y = -hy + 0.02 + (r / Math.max(1, rows - 1)) * (2 * hy - 0.05);
        const x = -(RACK_W - 0.08) + cw / 2 + c * cw;
        b.box(x, y, RACK_D * 0.7 + 0.004, cw * 0.3, U_H * 0.018, 0.01, C.dark, M.mPort);
      }
      return { half: [RACK_W, hy, RACK_D] };
    },

    // Blanking Panel：平整、略淡的金屬擋板，不冒充設備
    blanking(u, b) {
      const hy = (u * U_H) / 2;
      b.box(0, 0, 0, RACK_W - 0.04, hy, 0.008, [.36, .39, .42], M.mBlank);
      return { half: [RACK_W, hy, 0.012] };
    },
  };

  const TYPE_ALIAS = {
    server: 'server', switch: 'switch', cdu: 'cdu', powershelf: 'powershelf',
    pdu: 'pdu', storage: 'storage', blanking: 'blanking',
  };
  function typeOf(m) {
    const t = String(m.mgx_type || m.type || 'server').toLowerCase().replace(/[^a-z]/g, '');
    return TYPE_ALIAS[t] || 'server';
  }
  // Blanking Panel 名稱特判
  function realType(m) {
    if (/blanking/i.test(m.name || '')) return 'blanking';
    if (/cdu/i.test(m.name || '')) return 'cdu';
    if (/switch|sn2000|sn[0-9]/i.test(m.name || '')) return 'switch';
    if (/power.?shelf|psu/i.test(m.name || '')) return 'powershelf';
    if (/pdu/i.test(m.name || '')) return 'pdu';
    if (/storage|disk|nas/i.test(m.name || '')) return 'storage';
    return typeOf(m);
  }

  // =========================================================================
  //  U 定位：把 rack_u/rack_size 換算成元件中心 y 座標（U48 在頂、U0/1 在底）
  // =========================================================================
  const ROW_BOTTOM = 0;      // 機櫃最底(U1 底) 世界 y
  const RACK_TOP_H = 48 * U_H;
  function uCenterY(rack_u, size) {
    // rack_u = 該元件占用最高的 U 編號；元件涵蓋 [rack_u-size+1, rack_u]
    const bottomU = (rack_u || 1) - ((size || 1) - 1);
    const bottomY = ROW_BOTTOM + (bottomU - 1) * U_H;
    return bottomY + ((size || 1) * U_H) / 2;
  }
  function uToY(u) { // U 編號的中線（u≥1）
    return ROW_BOTTOM + (u - 1) * U_H + U_H / 2;
  }

  // =========================================================================

  // =========================================================================
  //  WebGL vertex/fragment shader（實時反光：Lambert+半球+鏡面+Fresnel+柔光箱）
  // =========================================================================
  const VERTEX = `
    attribute vec3 aPosition; attribute vec3 aNormal; attribute vec4 aColor; attribute vec2 aMaterial;
    uniform mat4 uViewProjection; uniform mat4 uModel; uniform mat4 uPart; uniform float uOpacity;
    varying vec3 vPosition; varying vec3 vLocal; varying vec3 vNormal; varying vec4 vColor; varying vec2 vMaterial;
    void main(){
      vLocal = aPosition;
      mat4 model = uModel * uPart;
      vec4 world = model * vec4(aPosition, 1.0);
      vPosition = world.xyz; vNormal = mat3(model) * aNormal;
      vColor = vec4(aColor.rgb, aColor.a * uOpacity); vMaterial = aMaterial;
      gl_Position = uViewProjection * world;
    }`;
  const FRAGMENT = `
    precision highp float;
    varying vec3 vPosition; varying vec3 vLocal; varying vec3 vNormal; varying vec4 vColor; varying vec2 vMaterial;
    uniform vec3 uEye; uniform float uLightTheme;
    void main(){
      if (vMaterial.y < -0.5) { gl_FragColor = vColor; return; }
      vec3 N = normalize(vNormal), V = normalize(uEye - vPosition), R = reflect(-V, N);
      vec3 key = normalize(vec3(-.58,.88,.72)), fill = normalize(vec3(.74,.40,-.35));
      float metal = vMaterial.x;
      float lambert = max(dot(N, key), 0.0), hemisphere = .50 + .30 * (N.y * .5 + .5);
      float brush = .992 + .008 * sin(vLocal.z * 440.0 + vLocal.x * 17.0);
      vec3 base = vColor.rgb * 1.7 * (hemisphere + lambert * .95 + max(dot(N,fill),0.0) * .25) * brush;
      float overhead = pow(max(dot(R, normalize(vec3(-.46,.67,-.59))), 0.0), 18.0);
      float side     = pow(max(dot(R, normalize(vec3(-.83,.30,.42))), 0.0), 24.0);
      float back     = pow(max(dot(R, normalize(vec3(.72,.42,-.65))), 0.0), 22.0);
      float spec     = pow(max(dot(N, normalize(key + V)), 0.0), 95.0);
      float fresnel  = pow(1.0 - max(dot(N, V), 0.0), 4.0);
      base += vec3(.88,.92,.94) * (overhead * .42 + side * .30 + spec * .38) * metal;
      vec3 ceiling = vPosition + R * ((16.0 - vPosition.y) / max(R.y, .08));
      float softbox = (1.0 - smoothstep(4.0,7.0,abs(ceiling.x+7.0))) * (1.0 - smoothstep(9.0,15.0,abs(ceiling.z+19.0)));
      base += vec3(.83,.89,.92) * softbox * smoothstep(.10,.30,R.y) * metal * .15;
      base += vec3(.35,.60,.69) * (back * .30 + fresnel * .055) * metal;
      base += vColor.rgb * uLightTheme * .075;
      gl_FragColor = vec4(pow(max(base, vec3(0.0)), vec3(.84)), vColor.a);
    }`;

  function multiply(a, b) { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c*4+r] = a[r]*b[c*4] + a[4+r]*b[c*4+1] + a[8+r]*b[c*4+2] + a[12+r]*b[c*4+3]; return o; }
  function perspective(fov, aspect, near, far) { const f = 1/Math.tan(fov/2), nf = 1/(near-far); return new Float32Array([f/aspect,0,0,0, 0,f,0,0, 0,0,(far+near)*nf,-1, 0,0,2*far*near*nf,0]); }
  const _sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
  const _dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const _cross=(a,b)=>[a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  const _norm=v=>{const l=Math.hypot(v[0],v[1],v[2])||1;return[v[0]/l,v[1]/l,v[2]/l];};
  function lookAt(e, t) {
    const z = _norm(_sub(e,t)), x = _norm(_cross([0,1,0], z)), y = _cross(z, x);
    return new Float32Array([x[0],y[0],z[0],0, x[1],y[1],z[1],0, x[2],y[2],z[2],0, -_dot(x,e),-_dot(y,e),-_dot(z,e),1]);
  }
  const translation = (x=0,y=0,z=0)=>new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1]);
  function rotation(y, x) { const cy=Math.cos(y), sy=Math.sin(y), cx=Math.cos(x), sx=Math.sin(x); return new Float32Array([cy,0,-sy,0, sy*sx,cx,cy*sx,0, sy*cx,-sx,cy*cx,0, 0,0,0,1]); }

  // =========================================================================
  //  mount — 資料驅動掛載
  // =========================================================================
  function mount(canvas, cfg = {}) {
    const noop = () => {};
    const st = {
      project: cfg.project || '', members: cfg.members || [],
      mode: cfg.mode || 'view',
      selected: null, selectedI: -1,
      extract: 0, extractI: -1,
      yaw: cfg.yaw || 0.6, pitch: cfg.pitch || 0.30,
      drag: null,
    };
    let parts = [], program = null, frame = 0, disposed = false, light = 0, ready = false;
    const attributes = {}, uniforms = {}, partsInfo = [];
    let gl = null, ro = null;

    const fail = reason => { canvas.dataset.rackState = 'fallback'; canvas.dataset.rackError = String(reason); };

    try { gl = canvas.getContext('webgl', { alpha:true, antialias:true, depth:true, premultipliedAlpha:false, powerPreference:'low-power', preserveDrawingBuffer:true }); }
    catch (e) { fail(e.message); return noop; }
    if (!gl) { fail('WebGL unavailable'); return noop; }

    function compile(type, src) {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(s));
      return s;
    }
    function setupShader() {
      const vs = compile(gl.VERTEX_SHADER, VERTEX), fs = compile(gl.FRAGMENT_SHADER, FRAGMENT);
      program = gl.createProgram(); gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(program));
      gl.deleteShader(vs); gl.deleteShader(fs);
      ['aPosition','aNormal','aColor','aMaterial'].forEach(n => attributes[n] = gl.getAttribLocation(program, n));
      ['uViewProjection','uModel','uPart','uOpacity','uEye','uLightTheme'].forEach(n => uniforms[n] = gl.getUniformLocation(program, n));
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.CULL_FACE);
      gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.clearColor(0.06,0.08,0.10,1);
    }

    function uploadMesh(mesh) {
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, mesh.data, gl.STATIC_DRAW);
      return { buffer: buf, count: mesh.data.length / 12 };
    }
    function drawMesh(mesh, matrix) {
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer);
      let offset = 0;
      [['aPosition',3],['aNormal',3],['aColor',4],['aMaterial',2]].forEach(([name,size]) => {
        gl.enableVertexAttribArray(attributes[name]);
        gl.vertexAttribPointer(attributes[name], size, gl.FLOAT, false, 48, offset); offset += size * 4;
      });
      gl.uniformMatrix4fv(uniforms.uPart, false, matrix);
      gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
    }

    const RH = 48 * U_H;

    function build() {
      const rack = builder();
      const col = C.graphite;
      rack.box(-RAILS_X, RH/2, RACK_D*0.95, 0.012, RH/2, 0.012, col, M.mServer);
      rack.box( RAILS_X, RH/2, RACK_D*0.95, 0.012, RH/2, 0.012, col, M.mServer);
      rack.box(-RACK_W-0.03, RH/2, 0, 0.012, RH/2, RACK_D, col, M.mChassis);
      rack.box( RACK_W+0.03, RH/2, 0, 0.012, RH/2, RACK_D, col, M.mChassis);
      rack.box(0, RH, 0, RACK_W+0.03, 0.012, RACK_D, col, M.mChassis);
      rack.box(0, 0, 0, RACK_W+0.03, 0.012, RACK_D, col, M.mChassis);
      rack.box(0, RH/2, -RACK_D-0.02, RACK_W+0.03, RH/2, 0.01, [.05,.07,.09], M.mChassis);
      const rackMesh = uploadMesh({ data: rack.data() });
      parts.push({ gpu: rackMesh, type: '__rack' });
      partsInfo.length = 0;
      for (const m of st.members) {
        const t = realType(m);
        const u = m.rack_u || 1, size = m.rack_size || 1;
        const b = builder(); let half;
        try { half = COMPONENTS[t](size, b) || { half: [RACK_W, size*U_H/2, RACK_D] }; }
        catch (e) { half = { half: [RACK_W, size*U_H/2, RACK_D] }; }
        const cy = uCenterY(u, size);
        const d = b.data(), n = d.length / 12, out = new Float32Array(n * 12);
        for (let i = 0; i < n; i++) {
          out[i*12]   = d[i*12];     out[i*12+1] = d[i*12+1] + cy; out[i*12+2] = d[i*12+2];
          out[i*12+3] = d[i*12+3];   out[i*12+4] = d[i*12+4];     out[i*12+5] = d[i*12+5];
          out[i*12+6] = d[i*12+6];   out[i*12+7] = d[i*12+7];     out[i*12+8] = d[i*12+8];   out[i*12+9] = d[i*12+9];
          out[i*12+10] = d[i*12+10]; out[i*12+11]= d[i*12+11];
        }
        parts.push({ gpu: uploadMesh({ data: out }), type: t, name: m.name });
        const halfArr = (half && half.half) || half || [RACK_W, size * U_H / 2, RACK_D];
        partsInfo.push({ m, type: t, half: halfArr, cy, u, size, name: m.name, z0: 0 });
      }
      canvas.dataset.rackCount = String(st.members.length);
      canvas.dataset.rackVertices = String(parts.length > 1 ? parts.slice(1).reduce((a, p) => a + p.gpu.count, 0) : 0);
      canvas.dataset.rackState = 'ready';
    }

    function requestDraw() { if (!disposed && !program) return; if (!frame) frame = requestAnimationFrame(frameLoop); }
    function draw() {
      const rect = canvas.getBoundingClientRect();
      canvas.dataset.rackDrawCalls = String((canvas.dataset.rackDrawCalls | 0) + 1);
      canvas.dataset.rackRect = `${Math.round(rect.width)}x${Math.round(rect.height)}`;
      if (rect.width < 1 || rect.height < 1) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.7);
      const w = Math.max(1, Math.round(rect.width * dpr)), h = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      const aspect = w / h;
      const cam = camera(aspect);
      const eye = cam.eye, view = cam.view;
      const model = rotation(st.yaw * 0.0, st.pitch * 0.0); // 先固定正面
      gl.viewport(0, 0, w, h);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(program);
      gl.uniformMatrix4fv(uniforms.uViewProjection, false, cam.vp);
      gl.uniform3fv(uniforms.uEye, new Float32Array(eye));
      gl.uniform1f(uniforms.uLightTheme, light);
      gl.uniform1f(uniforms.uOpacity, 1.0);
      gl.uniformMatrix4fv(uniforms.uModel, false, model);
      drawMesh(parts[0].gpu, [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
      for (let i = 1; i < parts.length; i++) {
        const p = parts[i];
        let zoff = 0;
        if (st.extractI >= 0 && st.extractI === i - 1) zoff = st.extract * 0.22;
        gl.uniformMatrix4fv(uniforms.uPart, false, translation(0, 0, zoff));
        drawMesh(p.gpu, [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
      }
      if (!ready && !gl.getError()) ready = true;
    }
    function frameLoop() {
      frame = 0;
      if (disposed || !program) return;
      if (st.extractI >= 0) {
        const target = st.selectedI === st.extractI ? 1 : 0;
        st.extract += clamp((target - st.extract) * 0.18, -0.05, 0.05);
        if (Math.abs(target - st.extract) < 0.01) { st.extract = target; if (target === 0) { st.extractI = -1; st.extract = 0; } }
      }
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) { requestDraw(); return; } // canvas 尚未布局，下一幀再試
      draw();
      if (st.extractI >= 0 || st.drag) requestDraw();
      else if (st.rerender) { st.rerender = false; requestDraw(); }
    }

    // ---- raycast 點選 ----
    function inverse4(m) {
      const o = new Float32Array(16);
      const s = new Float32Array([
        m[5]*m[10]*m[15]-m[5]*m[11]*m[14]-m[9]*m[6]*m[15]+m[9]*m[7]*m[14]+m[13]*m[6]*m[11]-m[13]*m[7]*m[10],
       -m[1]*m[10]*m[15]+m[1]*m[11]*m[14]+m[9]*m[2]*m[15]-m[9]*m[3]*m[14]-m[13]*m[2]*m[11]+m[13]*m[3]*m[10],
        m[1]*m[6]*m[15]-m[1]*m[7]*m[14]-m[5]*m[2]*m[15]+m[5]*m[3]*m[14]+m[13]*m[2]*m[7]-m[13]*m[3]*m[6],
       -m[1]*m[6]*m[11]+m[1]*m[7]*m[10]+m[5]*m[2]*m[11]-m[5]*m[3]*m[10]-m[9]*m[2]*m[7]+m[9]*m[3]*m[6],
       -m[4]*m[10]*m[15]+m[4]*m[11]*m[14]+m[8]*m[6]*m[15]-m[8]*m[7]*m[14]-m[12]*m[6]*m[11]+m[12]*m[7]*m[10],
        m[0]*m[10]*m[15]-m[0]*m[11]*m[14]-m[8]*m[2]*m[15]+m[8]*m[3]*m[14]+m[12]*m[2]*m[11]-m[12]*m[3]*m[10],
       -m[0]*m[6]*m[15]+m[0]*m[7]*m[14]+m[4]*m[2]*m[15]-m[4]*m[3]*m[14]-m[12]*m[2]*m[7]+m[12]*m[3]*m[6],
        m[0]*m[6]*m[11]-m[0]*m[7]*m[10]-m[4]*m[2]*m[11]+m[4]*m[3]*m[10]+m[8]*m[2]*m[7]-m[8]*m[3]*m[6],
        m[4]*m[9]*m[15]-m[4]*m[11]*m[13]-m[8]*m[5]*m[15]+m[8]*m[7]*m[13]+m[12]*m[5]*m[11]-m[12]*m[7]*m[9],
       -m[0]*m[9]*m[15]+m[0]*m[11]*m[13]+m[8]*m[1]*m[15]-m[8]*m[3]*m[13]-m[12]*m[1]*m[11]+m[12]*m[3]*m[9],
        m[0]*m[5]*m[15]-m[0]*m[7]*m[13]-m[4]*m[1]*m[15]+m[4]*m[3]*m[13]+m[12]*m[1]*m[7]-m[12]*m[3]*m[5],
       -m[0]*m[5]*m[11]+m[0]*m[7]*m[9]+m[4]*m[1]*m[11]-m[4]*m[3]*m[9]-m[8]*m[1]*m[7]+m[8]*m[3]*m[5],
       -m[4]*m[9]*m[14]+m[4]*m[10]*m[13]+m[8]*m[5]*m[14]-m[8]*m[6]*m[13]-m[12]*m[5]*m[10]+m[12]*m[6]*m[9],
        m[0]*m[9]*m[14]-m[0]*m[10]*m[13]-m[8]*m[1]*m[14]+m[8]*m[2]*m[13]+m[12]*m[1]*m[10]-m[12]*m[2]*m[9],
       -m[0]*m[5]*m[14]+m[0]*m[6]*m[13]+m[4]*m[1]*m[14]-m[4]*m[2]*m[13]-m[12]*m[1]*m[6]+m[12]*m[2]*m[5],
        m[0]*m[5]*m[10]-m[0]*m[6]*m[9]-m[4]*m[1]*m[10]+m[4]*m[2]*m[9]+m[8]*m[1]*m[6]-m[8]*m[2]*m[5]]);
      const det = m[0]*s[0]+m[1]*s[4]+m[2]*s[8]+m[3]*s[12];
      if (Math.abs(det) < 1e-12) return new Float32Array(16);
      const inv = 1 / det;
      for (let i = 0; i < 16; i++) o[i] = s[i] * inv;
      return o;
    }
    function mul4(m, v) {
      return [m[0]*v[0]+m[4]*v[1]+m[8]*v[2]+m[12]*v[3],
              m[1]*v[0]+m[5]*v[1]+m[9]*v[2]+m[13]*v[3],
              m[2]*v[0]+m[6]*v[1]+m[10]*v[2]+m[14]*v[3],
              m[3]*v[0]+m[7]*v[1]+m[11]*v[2]+m[15]*v[3]];
    }
    function rayAABB(o, d, mn, mx) {
      let tmin = 0, tmax = 1e9;
      for (let i = 0; i < 3; i++) {
        if (Math.abs(d[i]) < 1e-9) { if (o[i] < mn[i] || o[i] > mx[i]) return -1; }
        else { let t1 = (mn[i]-o[i])/d[i], t2 = (mx[i]-o[i])/d[i]; if (t1>t2){const q=t1;t1=t2;t2=q;} tmin=Math.max(tmin,t1); tmax=Math.min(tmax,t2); if (tmin>tmax) return -1; }
      }
      return tmin;
    }
    // 共用相機：draw() 與 pick() 使用同一組 framing，點選射線與畫面一致
    function camera(aspect) {
      const hf = 0.5;                         // 半 FOV(rad) ≈ 28.6°
      const targetH = RH + 0.8;               // 機櫃高 4.27 + 上下邊距 ≈ 5.07 → 約 84% 填滿
      const dist = (targetH / 2) / Math.tan(hf);
      const eye = [dist * .25, RH/2, dist];   // 平視機櫃中心
      const view = lookAt(eye, [0, RH/2, 0]);
      return { eye, view, vp: multiply(perspective(2 * hf, aspect, .1, 120), view) };
    }
    function pick(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = 1 - ((clientY - rect.top) / rect.height) * 2;
      const aspect = rect.width / rect.height;
      const invVP = inverse4(camera(aspect).vp);
      const near = mul4(invVP, [ndcX, ndcY, -1, 1]);
      const far  = mul4(invVP, [ndcX, ndcY,  1, 1]);
      const o = [near[0]/near[3], near[1]/near[3], near[2]/near[3]];
      const d = [far[0]/far[3]-o[0], far[1]/far[3]-o[1], far[2]/far[3]-o[2]];
      let best = -1, bestT = Infinity;
      for (let i = 0; i < partsInfo.length; i++) {
        const pi = partsInfo[i], h = pi.half;
        const c = [0, pi.cy, 0];
        const tt = rayAABB(o, d, [c[0]-h[0], c[1]-h[1], c[2]-h[2]], [c[0]+h[0], c[1]+h[1], c[2]+h[2]]);
        if (tt >= 0 && tt < bestT) { bestT = tt; best = i; }
      }
      return best;
    }

    function onDown(e) {
      if (e.button !== 0 && e.isPrimary === false) return;
      st.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, yaw: st.yaw, pitch: st.pitch, moved: 0 };
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      canvas.focus({ preventScroll: true });
    }
    function onMove(e) {
      if (!st.drag || e.pointerId !== st.drag.id) return;
      const dx = e.clientX - st.drag.x, dy = e.clientY - st.drag.y;
      st.drag.moved = Math.max(st.drag.moved, Math.hypot(dx, dy));
      if (st.mode === 'view') {
        st.yaw = st.drag.yaw + dx * .008;
        st.pitch = clamp(st.drag.pitch + dy * .007, -1.5, 1.5);
        canvas.dataset.rackDragging = 'true';
      }
      requestDraw();
    }
    function onUp(e) {
      if (!st.drag || e.pointerId !== st.drag.id) return;
      try { if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId); } catch (_) {}
      const wasClick = st.drag.moved < 6;
      st.drag = null;
      canvas.dataset.rackDragging = 'false';
      if (wasClick) select(pick(e.clientX, e.clientY));
    }
    function onKey(e) {
      if (st.mode !== 'view') return;
      const step = e.shiftKey ? .24 : .12;
      const map = { ArrowLeft: [step,0], ArrowRight: [-step,0], ArrowUp: [0,-step], ArrowDown: [0,step] };
      if (map[e.key]) { st.yaw += map[e.key][0]; st.pitch = clamp(st.pitch + map[e.key][1], -1.5, 1.5); e.preventDefault(); requestDraw(); }
      else if (e.key === 'Home' || e.key.toLowerCase() === 'r') { st.yaw = .6; st.pitch = .3; requestDraw(); }
    }

    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('lostpointercapture', onUp);
    canvas.addEventListener('keydown', onKey);
    try { ro = new ResizeObserver(requestDraw); ro.observe(canvas); } catch (_) { window.addEventListener('resize', requestDraw, { passive: true }); }

    function select(i) {
      st.selectedI = i;
      st.selected = (i >= 0 && i < partsInfo.length) ? partsInfo[i].name : null;
      st.extractI = i; st.extract = 0;
      canvas.dataset.rackSelected = st.selected || '';
      canvas.dispatchEvent(new CustomEvent('rack-select', { bubbles: true, detail: st.selectedI >= 0 ? Object.assign({ _type: partsInfo[st.selectedI].type, _half: partsInfo[st.selectedI].half, _cy: partsInfo[st.selectedI].cy }, partsInfo[st.selectedI].m) : null }));
      requestDraw();
    }
    function resetBuffers() {
      parts.forEach(p => gl.deleteBuffer(p.gpu.buffer)); parts = []; ready = false;
      try { build(); } catch (err) { fail(err.message); }
    }

    try { setupShader(); build(); requestDraw(); }
    catch (err) { fail(err.message); return noop; }

    const api = {
      supported: true,
      setProject(project, members) { st.project = project; st.members = members || []; resetBuffers(); requestDraw(); },
      setMembers(members) { st.members = members || []; resetBuffers(); requestDraw(); },
      setMode(mode) { st.mode = mode === 'edit' ? 'edit' : 'view'; canvas.dataset.rackMode = st.mode; if (st.mode === 'edit') { st.yaw = 0; st.pitch = 0; } requestDraw(); },
      select(name) { const i = partsInfo.findIndex(p => p.name === name); if (i >= 0) select(i); },
      resetOrbit() { st.yaw = .6; st.pitch = .3; requestDraw(); },
      setTheme(v) { light = (v === true || v === 'light') ? 1 : 0; requestDraw(); },
      setPointer() {},
      getState() { return { supported: true, mode: st.mode, selected: st.selected, count: st.members.length, yaw: st.yaw, pitch: st.pitch, disposed }; },
      resize: requestDraw,
      destroy() {
        if (disposed) return; disposed = true;
        if (frame) cancelAnimationFrame(frame); frame = 0;
        parts.forEach(p => gl.deleteBuffer(p.gpu.buffer)); parts = [];
        if (program) gl.deleteProgram(program); program = null;
        if (ro) ro.disconnect();
        canvas.dataset.rackState = 'disposed';
        delete canvas.paRackScene;
      },
    };
    canvas.paRackScene = api;
    return api;
  }

  window.PARackScene = Object.freeze({ mount, uCenterY, uToY, realType, U_H });
})();
