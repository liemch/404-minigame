/**
 * engine.js — renderer WebGL thuần cho 404 Strike.
 *
 * Máy đích không có Internet nên không thể cài Three.js từ npm; module
 * này cung cấp đúng phần 404 Strike cần với API tối giản kiểu Three:
 *  - Node hierarchy (pos/rot/scale/children) + mesh (geometry, material)
 *  - Geometry: box, plane, tam giác, gem (octahedron)
 *  - Material: màu phẳng + directional light, emissive (neon), opacity,
 *    additive blend, texture từ canvas
 *  - Fog tuyến tính, camera FPS (yaw/pitch), pass riêng cho viewmodel súng
 *  - rayAABB cho đường đạn (raycasting)
 * Muốn chuyển sang Three.js sau này: thay engine.js, giữ nguyên API.
 */

/* ============================== Toán ============================== */

export function mat4Perspective(out, fovYRad, aspect, near, far) {
  const f = 1 / Math.tan(fovYRad / 2);
  out.fill(0);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) / (near - far);
  out[11] = -1;
  out[14] = (2 * far * near) / (near - far);
  return out;
}

export function mat4Identity(out) {
  out.fill(0);
  out[0] = out[5] = out[10] = out[15] = 1;
  return out;
}

export function mat4Multiply(out, a, b) {
  // out = a * b (cột-major kiểu WebGL)
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      o[c * 4 + r] =
        a[r] * b[c * 4] +
        a[4 + r] * b[c * 4 + 1] +
        a[8 + r] * b[c * 4 + 2] +
        a[12 + r] * b[c * 4 + 3];
    }
  }
  out.set(o);
  return out;
}

/** M = T * RY * RX * RZ * S — đủ cho node game. */
export function mat4Compose(out, pos, rot, scale) {
  const [x, y, z] = pos;
  const [rx, ry, rz] = rot;
  const [sx, sy, sz] = scale;
  const cy = Math.cos(ry), sy_ = Math.sin(ry);
  const cx = Math.cos(rx), sx_ = Math.sin(rx);
  const cz = Math.cos(rz), sz_ = Math.sin(rz);

  // R = RY * RX * RZ
  const r00 = cy * cz + sy_ * sx_ * sz_;
  const r01 = -cy * sz_ + sy_ * sx_ * cz;
  const r02 = sy_ * cx;
  const r10 = cx * sz_;
  const r11 = cx * cz;
  const r12 = -sx_;
  const r20 = -sy_ * cz + cy * sx_ * sz_;
  const r21 = sy_ * sz_ + cy * sx_ * cz;
  const r22 = cy * cx;

  out[0] = r00 * sx; out[1] = r10 * sx; out[2] = r20 * sx; out[3] = 0;
  out[4] = r01 * sy; out[5] = r11 * sy; out[6] = r21 * sy; out[7] = 0;
  out[8] = r02 * sz; out[9] = r12 * sz; out[10] = r22 * sz; out[11] = 0;
  out[12] = x; out[13] = y; out[14] = z; out[15] = 1;
  return out;
}

/** View matrix cho camera FPS: nghịch đảo của T(pos)*RY(yaw)*RX(pitch)*RZ(roll). */
export function mat4FpsView(out, pos, yaw, pitch, roll = 0) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  // Trục camera trong world
  let rx = [cy, 0, -sy];
  let ry = [sy * sp, cp, cy * sp];
  const rz = [sy * cp, -sp, cy * cp];
  if (roll) {
    // Xoay right/up quanh trục nhìn (camera roll — wall-run, nghiêng người)
    const cr = Math.cos(roll), sr = Math.sin(roll);
    const ax = [rx[0] * cr + ry[0] * sr, rx[1] * cr + ry[1] * sr, rx[2] * cr + ry[2] * sr];
    const ay = [ry[0] * cr - rx[0] * sr, ry[1] * cr - rx[1] * sr, ry[2] * cr - rx[2] * sr];
    rx = ax;
    ry = ay;
  }
  out[0] = rx[0]; out[4] = rx[1]; out[8] = rx[2];
  out[1] = ry[0]; out[5] = ry[1]; out[9] = ry[2];
  out[2] = rz[0]; out[6] = rz[1]; out[10] = rz[2];
  out[3] = 0; out[7] = 0; out[11] = 0;
  out[12] = -(rx[0] * pos[0] + rx[1] * pos[1] + rx[2] * pos[2]);
  out[13] = -(ry[0] * pos[0] + ry[1] * pos[1] + ry[2] * pos[2]);
  out[14] = -(rz[0] * pos[0] + rz[1] * pos[1] + rz[2] * pos[2]);
  out[15] = 1;
  return out;
}

/** Hướng nhìn từ yaw/pitch (chuẩn: yaw 0 → -Z). */
export function dirFromYawPitch(yaw, pitch) {
  const cp = Math.cos(pitch);
  return [-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp];
}

/** Ray vs AABB (slab). Trả về khoảng cách t ≥ 0 hoặc null. */
export function rayAABB(origin, dir, box) {
  let tmin = 0;
  let tmax = Infinity;
  for (let i = 0; i < 3; i++) {
    const o = origin[i];
    const d = dir[i];
    const mn = box.min[i];
    const mx = box.max[i];
    if (Math.abs(d) < 1e-9) {
      if (o < mn || o > mx) return null;
    } else {
      let t1 = (mn - o) / d;
      let t2 = (mx - o) / d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }
  return tmin;
}

/* ============================== Node ============================== */

export function createNode(opts = {}) {
  return {
    pos: opts.pos ? [...opts.pos] : [0, 0, 0],
    rot: opts.rot ? [...opts.rot] : [0, 0, 0],
    scale: opts.scale ? [...opts.scale] : [1, 1, 1],
    mesh: opts.mesh || null, // { geo, color, emissive, opacity, additive, tex }
    children: [],
    visible: true,
    _world: new Float32Array(16),
  };
}

export function addChild(parent, child) {
  parent.children.push(child);
  return child;
}

/* ============================ Shaders ============================ */

const VS = `
attribute vec3 aPos;
attribute vec3 aNormal;
attribute vec2 aUv;
uniform mat4 uProj, uView, uModel;
varying vec3 vNormal;
varying vec2 vUv;
varying float vDepth;
void main() {
  vec4 world = uModel * vec4(aPos, 1.0);
  vec4 viewPos = uView * world;
  gl_Position = uProj * viewPos;
  vDepth = -viewPos.z;
  vNormal = mat3(uModel) * aNormal;
  vUv = aUv;
}`;

const FS = `
precision mediump float;
uniform vec3 uColor;
uniform float uEmissive;
uniform float uOpacity;
uniform float uUseTex;
uniform sampler2D uTex;
uniform vec3 uFogColor;
uniform vec2 uFogRange;
uniform vec3 uLightDir;
uniform float uAmbient;
uniform float uFogOn;
varying vec3 vNormal;
varying vec2 vUv;
varying float vDepth;
void main() {
  vec4 texel = mix(vec4(1.0), texture2D(uTex, vUv), uUseTex);
  vec3 base = uColor * texel.rgb;
  float ndl = max(dot(normalize(vNormal), -normalize(uLightDir)), 0.0);
  vec3 lit = base * (uAmbient + (1.0 - uAmbient) * ndl);
  vec3 col = mix(lit, base, uEmissive);
  float fogF = clamp((uFogRange.y - vDepth) / (uFogRange.y - uFogRange.x), 0.0, 1.0);
  col = mix(uFogColor, col, max(fogF, 1.0 - uFogOn));
  gl_FragColor = vec4(col, uOpacity * texel.a);
}`;

/* ============================ Geometry ============================ */

function boxData() {
  // Hộp đơn vị (cạnh 1, tâm gốc): 6 mặt × 4 đỉnh
  const p = 0.5;
  const faces = [
    { n: [0, 0, 1],  v: [[-p,-p,p],[p,-p,p],[p,p,p],[-p,p,p]] },
    { n: [0, 0, -1], v: [[p,-p,-p],[-p,-p,-p],[-p,p,-p],[p,p,-p]] },
    { n: [1, 0, 0],  v: [[p,-p,p],[p,-p,-p],[p,p,-p],[p,p,p]] },
    { n: [-1, 0, 0], v: [[-p,-p,-p],[-p,-p,p],[-p,p,p],[-p,p,-p]] },
    { n: [0, 1, 0],  v: [[-p,p,p],[p,p,p],[p,p,-p],[-p,p,-p]] },
    { n: [0, -1, 0], v: [[-p,-p,-p],[p,-p,-p],[p,-p,p],[-p,-p,p]] },
  ];
  const pos = [];
  const nor = [];
  const uv = [];
  const idx = [];
  let base = 0;
  for (const f of faces) {
    for (let i = 0; i < 4; i++) {
      pos.push(...f.v[i]);
      nor.push(...f.n);
      uv.push(i === 1 || i === 2 ? 1 : 0, i >= 2 ? 1 : 0);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    base += 4;
  }
  return { pos, nor, uv, idx };
}

function planeData() {
  // Mặt phẳng đơn vị trên XY, pháp tuyến +Z
  return {
    pos: [-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0],
    nor: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
    uv: [0, 1, 1, 1, 1, 0, 0, 0],
    idx: [0, 1, 2, 0, 2, 3],
  };
}

function triData() {
  // Tam giác đều chỉa xuống (visor/marker), pháp tuyến +Z
  return {
    pos: [-0.5, 0.5, 0, 0.5, 0.5, 0, 0, -0.5, 0],
    nor: [0, 0, 1, 0, 0, 1, 0, 0, 1],
    uv: [0, 0, 1, 0, 0.5, 1],
    idx: [0, 1, 2],
  };
}

function cylData(segments = 14) {
  // Trụ tròn trục Y (bán kính 0.5, cao 1, tâm gốc) — cột/đế/ống neon.
  const pos = [];
  const nor = [];
  const uv = [];
  const idx = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    pos.push(c * 0.5, -0.5, s * 0.5, c * 0.5, 0.5, s * 0.5);
    nor.push(c, 0, s, c, 0, s);
    uv.push(i / segments, 1, i / segments, 0);
  }
  for (let i = 0; i < segments; i++) {
    const b = i * 2;
    idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
  }
  for (const [y, ny] of [[0.5, 1], [-0.5, -1]]) {
    const center = pos.length / 3;
    pos.push(0, y, 0);
    nor.push(0, ny, 0);
    uv.push(0.5, 0.5);
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      pos.push(Math.cos(a) * 0.5, y, Math.sin(a) * 0.5);
      nor.push(0, ny, 0);
      uv.push(0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5);
    }
    for (let i = 0; i < segments; i++) {
      if (ny > 0) idx.push(center, center + 1 + i, center + 2 + i);
      else idx.push(center, center + 2 + i, center + 1 + i);
    }
  }
  return { pos, nor, uv, idx };
}

function ringData(inner = 0.4, segments = 28) {
  // Vành khuyên phẳng trên XY (pháp tuyến +Z) — cổng tròn/portal/marker.
  const pos = [];
  const nor = [];
  const uv = [];
  const idx = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    pos.push(c * 0.5, s * 0.5, 0, c * inner, s * inner, 0);
    nor.push(0, 0, 1, 0, 0, 1);
    uv.push(i / segments, 0, i / segments, 1);
  }
  for (let i = 0; i < segments; i++) {
    const b = i * 2;
    idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
  }
  return { pos, nor, uv, idx };
}

function gemData() {
  // Octahedron (viên năng lượng giữa map)
  const v = [
    [0, 0.5, 0], [0, -0.5, 0],
    [0.5, 0, 0], [-0.5, 0, 0], [0, 0, 0.5], [0, 0, -0.5],
  ];
  const facesIdx = [
    [0, 4, 2], [0, 2, 5], [0, 5, 3], [0, 3, 4],
    [1, 2, 4], [1, 5, 2], [1, 3, 5], [1, 4, 3],
  ];
  const pos = [];
  const nor = [];
  const uv = [];
  const idx = [];
  let base = 0;
  for (const f of facesIdx) {
    const [a, b, c] = f.map((i) => v[i]);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [
      u[1] * w[2] - u[2] * w[1],
      u[2] * w[0] - u[0] * w[2],
      u[0] * w[1] - u[1] * w[0],
    ];
    const len = Math.hypot(...n) || 1;
    n[0] /= len; n[1] /= len; n[2] /= len;
    for (const p of [a, b, c]) {
      pos.push(...p);
      nor.push(...n);
      uv.push(0, 0);
    }
    idx.push(base, base + 1, base + 2);
    base += 3;
  }
  return { pos, nor, uv, idx };
}

/* ============================ Engine ============================ */

export function createEngine(canvas, opts = {}) {
  const gl =
    canvas.getContext("webgl", { antialias: true, alpha: false }) ||
    canvas.getContext("experimental-webgl", { antialias: true, alpha: false });
  if (!gl) return null; // caller hiển thị fallback "WebGL không khả dụng"

  const fogColor = opts.fogColor || [0.03, 0.052, 0.125];
  let fogNear = opts.fogNear ?? 24;
  let fogFar = opts.fogFar ?? 70;
  const farPlane = opts.far ?? 120; // opt-in: cảnh cần vẽ backdrop rất xa

  /* --- Chương trình shader --- */
  function compile(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(sh);
      gl.deleteShader(sh);
      throw new Error(`Shader lỗi: ${info}`);
    }
    return sh;
  }

  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(`Link shader lỗi: ${gl.getProgramInfoLog(prog)}`);
  }
  gl.useProgram(prog);

  const A = {
    pos: gl.getAttribLocation(prog, "aPos"),
    nor: gl.getAttribLocation(prog, "aNormal"),
    uv: gl.getAttribLocation(prog, "aUv"),
  };
  const U = {};
  for (const name of [
    "uProj", "uView", "uModel", "uColor", "uEmissive", "uOpacity",
    "uUseTex", "uTex", "uFogColor", "uFogRange", "uLightDir", "uAmbient", "uFogOn",
  ]) {
    U[name] = gl.getUniformLocation(prog, name);
  }

  gl.enable(gl.DEPTH_TEST);
  gl.disable(gl.CULL_FACE); // hình khối mỏng/tam giác nhìn được 2 mặt
  gl.uniform3fv(U.uFogColor, fogColor);
  gl.uniform2f(U.uFogRange, fogNear, fogFar);
  // Tùy chọn opt-in: game có thể chỉnh hướng nắng/ambient riêng
  // (mặc định giữ nguyên giá trị cũ để không đổi hình ảnh game khác).
  const lightDir = opts.lightDir || [-0.35, -0.8, -0.45];
  gl.uniform3f(U.uLightDir, lightDir[0], lightDir[1], lightDir[2]);
  gl.uniform1f(U.uAmbient, opts.ambient ?? 0.58);
  gl.uniform1i(U.uTex, 0);

  /* --- Geometry cache --- */
  const geos = new Map();

  function upload(name, data) {
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    const count = data.pos.length / 3;
    const inter = new Float32Array(count * 8);
    for (let i = 0; i < count; i++) {
      inter[i * 8] = data.pos[i * 3];
      inter[i * 8 + 1] = data.pos[i * 3 + 1];
      inter[i * 8 + 2] = data.pos[i * 3 + 2];
      inter[i * 8 + 3] = data.nor[i * 3];
      inter[i * 8 + 4] = data.nor[i * 3 + 1];
      inter[i * 8 + 5] = data.nor[i * 3 + 2];
      inter[i * 8 + 6] = data.uv[i * 2];
      inter[i * 8 + 7] = data.uv[i * 2 + 1];
    }
    gl.bufferData(gl.ARRAY_BUFFER, inter, gl.STATIC_DRAW);
    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(data.idx), gl.STATIC_DRAW);
    const geo = { vbo, ibo, count: data.idx.length };
    geos.set(name, geo);
    return geo;
  }

  upload("box", boxData());
  upload("plane", planeData());
  upload("tri", triData());
  upload("gem", gemData());
  upload("cyl", cylData());
  upload("ring", ringData());

  /* --- Texture từ canvas --- */
  const textures = [];
  function makeTexture(sourceCanvas) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    textures.push(tex);
    return tex;
  }

  /** Cập nhật nội dung texture (màn hình đạn trên súng...). */
  function updateTexture(tex, sourceCanvas) {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas);
  }

  /* --- Camera + kích thước --- */
  const camera = { pos: [0, 1.7, 0], yaw: 0, pitch: 0, fov: 75 };
  const proj = new Float32Array(16);
  const view = new Float32Array(16);
  const vmProj = new Float32Array(16);
  const vmView = mat4Identity(new Float32Array(16));
  let width = 1;
  let height = 1;
  let renderScale = 1;

  function resize(cssW, cssH, scale = renderScale) {
    renderScale = scale;
    const dpr = Math.min(window.devicePixelRatio || 1, 2) * renderScale;
    width = Math.max(1, Math.round(cssW * dpr));
    height = Math.max(1, Math.round(cssH * dpr));
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    gl.viewport(0, 0, width, height);
  }

  /* --- Duyệt cây node và vẽ --- */
  const IDENT = mat4Identity(new Float32Array(16));
  const opaqueList = [];
  const blendList = [];

  function collect(node, parentMat, list2) {
    if (!node.visible) return;
    mat4Compose(node._world, node.pos, node.rot, node.scale);
    if (parentMat !== IDENT) mat4Multiply(node._world, parentMat, node._world);
    if (node.mesh) {
      const m = node.mesh;
      if (m.additive || (m.opacity !== undefined && m.opacity < 1)) list2.blend.push(node);
      else list2.opaque.push(node);
    }
    for (const c of node.children) collect(c, node._world, list2);
  }

  function bindGeo(geo) {
    gl.bindBuffer(gl.ARRAY_BUFFER, geo.vbo);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, geo.ibo);
    gl.vertexAttribPointer(A.pos, 3, gl.FLOAT, false, 32, 0);
    gl.vertexAttribPointer(A.nor, 3, gl.FLOAT, false, 32, 12);
    gl.vertexAttribPointer(A.uv, 2, gl.FLOAT, false, 32, 24);
    gl.enableVertexAttribArray(A.pos);
    gl.enableVertexAttribArray(A.nor);
    gl.enableVertexAttribArray(A.uv);
  }

  let boundGeo = null;
  let passFog = 1; // 1 = pass cảnh chính (có fog), 0 = pass viewmodel
  function drawNode(node) {
    const m = node.mesh;
    const geo = geos.get(m.geo);
    if (!geo) return;
    if (boundGeo !== geo) {
      bindGeo(geo);
      boundGeo = geo;
    }
    gl.uniformMatrix4fv(U.uModel, false, node._world);
    gl.uniform3fv(U.uColor, m.color);
    gl.uniform1f(U.uEmissive, m.emissive || 0);
    gl.uniform1f(U.uOpacity, m.opacity === undefined ? 1 : m.opacity);
    gl.uniform1f(U.uUseTex, m.tex ? 1 : 0);
    // Mesh có thể opt-out fog (backdrop bầu trời...) qua m.nofog
    gl.uniform1f(U.uFogOn, passFog && !m.nofog ? 1 : 0);
    if (m.tex) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, m.tex);
    }
    gl.drawElements(gl.TRIANGLES, geo.count, gl.UNSIGNED_SHORT, 0);
  }

  function render(sceneRoot, viewmodelRoot) {
    gl.clearColor(fogColor[0], fogColor[1], fogColor[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const aspect = width / height;
    mat4Perspective(proj, (camera.fov * Math.PI) / 180, aspect, 0.08, farPlane);
    mat4FpsView(view, camera.pos, camera.yaw, camera.pitch, camera.roll || 0);
    gl.uniformMatrix4fv(U.uProj, false, proj);
    gl.uniformMatrix4fv(U.uView, false, view);
    gl.uniform2f(U.uFogRange, fogNear, fogFar);
    passFog = 1;

    const lists = { opaque: opaqueList, blend: blendList };
    opaqueList.length = 0;
    blendList.length = 0;
    collect(sceneRoot, IDENT, lists);

    boundGeo = null;
    gl.disable(gl.BLEND);
    gl.depthMask(true);
    for (const n of opaqueList) drawNode(n);

    // Pha trong suốt / cộng sáng (tracer, flash, hologram)
    gl.enable(gl.BLEND);
    gl.depthMask(false);
    for (const n of blendList) {
      if (n.mesh.additive) gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      else gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      drawNode(n);
    }
    gl.depthMask(true);
    gl.disable(gl.BLEND);

    // Pass viewmodel: xóa depth, camera riêng để súng không xuyên tường
    if (viewmodelRoot) {
      gl.clear(gl.DEPTH_BUFFER_BIT);
      mat4Perspective(vmProj, (58 * Math.PI) / 180, aspect, 0.01, 10);
      gl.uniformMatrix4fv(U.uProj, false, vmProj);
      gl.uniformMatrix4fv(U.uView, false, vmView);
      passFog = 0; // súng không bị fog

      opaqueList.length = 0;
      blendList.length = 0;
      collect(viewmodelRoot, IDENT, { opaque: opaqueList, blend: blendList });
      boundGeo = null;
      for (const n of opaqueList) drawNode(n);
      gl.enable(gl.BLEND);
      gl.depthMask(false);
      for (const n of blendList) {
        if (n.mesh.additive) gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        else gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        drawNode(n);
      }
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }
  }

  return {
    gl,
    camera,
    resize,
    render,
    makeTexture,
    updateTexture,
    setFog(near, far) {
      fogNear = near;
      fogFar = far;
    },
    get size() {
      return { width, height };
    },
    dispose() {
      for (const geo of geos.values()) {
        gl.deleteBuffer(geo.vbo);
        gl.deleteBuffer(geo.ibo);
      }
      geos.clear();
      for (const t of textures) gl.deleteTexture(t);
      textures.length = 0;
      gl.deleteProgram(prog);
      const lose = gl.getExtension("WEBGL_lose_context");
      lose?.loseContext();
    },
  };
}

/** Helper tạo mesh-node nhanh. */
export function meshNode(geo, { pos, rot, scale, color, emissive = 0, opacity, additive = false, tex = null, nofog = false } = {}) {
  return createNode({
    pos,
    rot,
    scale,
    mesh: { geo, color: color || [1, 1, 1], emissive, opacity, additive, tex, nofog },
  });
}

/** Đổi hex "#rrggbb" → [r,g,b] 0..1. */
export function hex(c) {
  const n = parseInt(c.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
