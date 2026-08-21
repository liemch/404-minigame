/**
 * world.js — dựng map "404 Strike" theo Level Map reference:
 *  - Kích thước 60m × 40m, lưới 2m.
 *  - KHU CAO phía bắc (+3m) với cầu thang trung tâm, cột tím.
 *  - SÂN TRUNG TÂM có viền neon cyan + 8 vật cản + trụ năng lượng.
 *  - HÀNH LANG TRÁI/PHẢI với vật cản và vòng tuần tra (đường đứt đỏ).
 *  - 8 cổng spawn bot (đỏ) hai bên, ĐIỂM XUẤT PHÁT (xanh) phía nam.
 *  - Đèn neon: sọc cyan, thanh đỏ dọc tường, bảng "404" tím phát sáng.
 * Xuất: scene root, colliders (AABB), groundHeightAt, patrol loops,
 * vị trí spawn, hàm update (hiệu ứng động) và resolveMove (va chạm).
 */

import { createNode, addChild, meshNode, hex } from "./engine.js";
import { seededRand } from "../../core/utils.js";

export const MAP = {
  halfX: 30,
  halfZ: 20,
  wallH: 4,
  platform: { x1: -8, x2: 8, z1: -20, z2: -14, h: 3 },
  ramp: { x1: -2, x2: 2, z1: -14, z2: -11 }, // từ y=3 (z1) xuống y=0 (z2)
};

const C = {
  wall: "#151b38",
  wallDark: "#10152e",
  crate: "#171e3d",
  cyan: "#20e3ff",
  violet: "#9a5cff",
  magenta: "#ff4fd8",
  lime: "#a8ff3e",
  red: "#ff4f64",
  gold: "#ffd23f",
  floorLine: "#1a2350",
};

/* ============================ Texture ============================ */

function floorTexture(engine) {
  const cv = document.createElement("canvas");
  cv.width = 1024;
  cv.height = 683; // tỉ lệ 60:40
  const ctx = cv.getContext("2d");
  const rand = seededRand(60);

  ctx.fillStyle = "#0e1434";
  ctx.fillRect(0, 0, cv.width, cv.height);

  // Ô 2m với sắc thái ngẫu nhiên nhẹ (panel công nghiệp)
  const cw = cv.width / 30;
  const ch = cv.height / 20;
  for (let gy = 0; gy < 20; gy++) {
    for (let gx = 0; gx < 30; gx++) {
      const v = rand();
      if (v > 0.55) {
        ctx.fillStyle = `rgba(255,255,255,${(v - 0.55) * 0.045})`;
        ctx.fillRect(gx * cw, gy * ch, cw, ch);
      } else if (v < 0.16) {
        ctx.fillStyle = "rgba(0,0,0,0.16)";
        ctx.fillRect(gx * cw, gy * ch, cw, ch);
      }
    }
  }

  // Sân trung tâm tối hơn một chút
  ctx.fillStyle = "rgba(4,6,18,0.5)";
  ctx.fillRect(((30 - 13) / 60) * cv.width + cw * 6.5 * 0, ((20 - 9) / 40) * cv.height, (26 / 60) * cv.width, (18 / 40) * cv.height);

  // Lưới 2m (mờ — nền phải đọc là sàn panel đặc, không phải lưới TRON)
  ctx.strokeStyle = "rgba(70,95,200,0.12)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 30; i++) {
    ctx.beginPath();
    ctx.moveTo(i * cw, 0);
    ctx.lineTo(i * cw, cv.height);
    ctx.stroke();
  }
  for (let i = 0; i <= 20; i++) {
    ctx.beginPath();
    ctx.moveTo(0, i * ch);
    ctx.lineTo(cv.width, i * ch);
    ctx.stroke();
  }

  // Sọc cảnh báo vàng trước các cổng spawn hai bên
  ctx.save();
  ctx.fillStyle = "rgba(255,210,63,0.5)";
  for (const gz of [-16, -6, 6, 16]) {
    for (const side of [-1, 1]) {
      const px = ((side === -1 ? 2.2 : 60 - 3.4) / 60) * cv.width;
      const pz = ((gz + 20 - 1) / 40) * cv.height;
      for (let s = 0; s < 4; s++) {
        ctx.fillRect(px + s * 8, pz, 4, (2 / 40) * cv.height);
      }
    }
  }
  ctx.restore();

  return engine.makeTexture(cv);
}

function wallTexture(engine) {
  const cv = document.createElement("canvas");
  cv.width = 256;
  cv.height = 128;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#1b2248";
  ctx.fillRect(0, 0, 256, 128);
  // Mối ghép panel
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = 2;
  for (let x = 0; x <= 256; x += 64) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 128); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(0, 88); ctx.lineTo(256, 88); ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  ctx.fillRect(0, 0, 256, 10);
  // Đinh tán
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  for (let x = 12; x < 256; x += 64) {
    ctx.fillRect(x, 96, 3, 3);
    ctx.fillRect(x + 40, 96, 3, 3);
  }
  return engine.makeTexture(cv);
}

function crateTexture(engine, trim = "#20e3ff", hazard = false) {
  const cv = document.createElement("canvas");
  cv.width = 128;
  cv.height = 128;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#151b38";
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = trim;
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, 116, 116);
  ctx.globalAlpha = 0.28;
  ctx.strokeRect(18, 18, 92, 92);
  ctx.globalAlpha = 1;
  if (hazard) {
    // Tam giác cảnh báo vàng (theo asset sheet vật cản/đạn)
    ctx.fillStyle = "rgba(255,210,63,0.9)";
    ctx.beginPath();
    ctx.moveTo(64, 38);
    ctx.lineTo(92, 86);
    ctx.lineTo(36, 86);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#151b38";
    ctx.font = "700 34px monospace";
    ctx.textAlign = "center";
    ctx.fillText("!", 64, 80);
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.fillRect(30, 58, 68, 12);
  }
  return engine.makeTexture(cv);
}

function signTexture(engine) {
  const cv = document.createElement("canvas");
  cv.width = 512;
  cv.height = 180;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#0d1230";
  ctx.fillRect(0, 0, 512, 180);
  ctx.strokeStyle = "rgba(32,227,255,0.8)";
  ctx.lineWidth = 5;
  ctx.strokeRect(8, 8, 496, 164);
  ctx.font = "800 120px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "#9a5cff";
  ctx.shadowBlur = 42;
  ctx.fillStyle = "#b07bff";
  ctx.fillText("404", 256, 96);
  ctx.shadowBlur = 0;
  return engine.makeTexture(cv);
}

function blobTexture(engine) {
  const cv = document.createElement("canvas");
  cv.width = 64;
  cv.height = 64;
  const ctx = cv.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  g.addColorStop(0, "rgba(0,0,0,0.55)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return engine.makeTexture(cv);
}

/* ============================ Dựng map ============================ */

export function createWorld(engine) {
  const root = createNode();
  const colliders = [];
  const dynamic = { markers: [], gem: null, gateGlows: [] };

  const texFloor = floorTexture(engine);
  const texWall = wallTexture(engine);
  const texCrate = crateTexture(engine, C.cyan, false);
  const texCrateHazard = crateTexture(engine, C.cyan, true);
  const texSign = signTexture(engine);
  const texBlob = blobTexture(engine);

  const box = (x, y, z, w, h, d, color, opts = {}) => {
    const n = meshNode("box", {
      pos: [x, y, z],
      scale: [w, h, d],
      color: hex(color),
      ...opts,
    });
    addChild(root, n);
    return n;
  };

  const addCollider = (x, z, w, d, y0 = 0, y1 = 4) => {
    colliders.push({
      min: [x - w / 2, y0, z - d / 2],
      max: [x + w / 2, y1, z + d / 2],
    });
  };

  /* ---- Sàn ---- */
  const floor = meshNode("plane", {
    pos: [0, 0, 0],
    rot: [-Math.PI / 2, 0, 0],
    scale: [60, 40, 1],
    color: [1, 1, 1],
    tex: texFloor,
  });
  addChild(root, floor);

  /* ---- Tường bao ---- */
  const wall = (x, z, w, h, d) => {
    const n = box(x, h / 2, z, w, h, d, "#ffffff", { tex: texWall });
    addCollider(x, z, w, d, 0, h);
    return n;
  };
  wall(-20, -20.5, 20, 4, 1); // bắc trái
  wall(20, -20.5, 20, 4, 1);  // bắc phải
  wall(0, -20.5, 20, 7, 1);   // bắc giữa (cao, giữ bảng 404)
  wall(0, 20.5, 60, 4, 1);    // nam
  wall(-30.5, 0, 1, 4, 40);   // tây
  wall(30.5, 0, 1, 4, 40);    // đông

  // Sọc neon cyan chạy dọc đỉnh tường
  for (const [x, z, w, d] of [
    [0, -19.9, 59, 0.12], [0, 19.9, 59, 0.12],
    [-29.9, 0, 0.12, 39], [29.9, 0, 0.12, 39],
  ]) {
    box(x, 3.82, z, w, 0.08, d, C.cyan, { emissive: 0.9 });
  }

  // Thanh đèn đỏ dọc trên tường (theo gameplay reference)
  for (const [x, z] of [
    [-29.85, -10], [-29.85, 10], [29.85, -10], [29.85, 10],
    [-16, -20.35], [16, -20.35], [-8, 20.35], [8, 20.35],
  ]) {
    box(x, 2.2, z, Math.abs(x) > 25 ? 0.14 : 0.5, 2.6, Math.abs(x) > 25 ? 0.5 : 0.14, C.red, { emissive: 1 });
  }

  /* ---- Bảng 404 (tường bắc, nhìn về phía nam) ---- */
  const sign = meshNode("plane", {
    pos: [0, 4.6, -19.95],
    scale: [12, 4.2, 1],
    color: [1, 1, 1],
    tex: texSign,
    emissive: 1,
  });
  addChild(root, sign);

  /* ---- KHU CAO (bục +3m) + cầu thang ---- */
  const P = MAP.platform;
  const pw = P.x2 - P.x1;
  const pd = P.z2 - P.z1;
  box((P.x1 + P.x2) / 2, P.h - 0.25, (P.z1 + P.z2) / 2, pw, 0.5, pd, C.wall, { tex: texWall });
  // Chân bục
  box((P.x1 + P.x2) / 2, (P.h - 0.5) / 2, (P.z1 + P.z2) / 2, pw, P.h - 0.5, pd, C.wallDark);
  // Viền neon tím mép bục
  box(0, P.h + 0.02, P.z2 - 0.05, pw, 0.06, 0.12, C.violet, { emissive: 0.95 });

  // Collider mặt nam bục (chừa lối cầu thang x∈[-2,2])
  addCollider((-8 + -2) / 2, P.z2, 6, 0.4, 0, P.h);
  addCollider((8 + 2) / 2, P.z2, 6, 0.4, 0, P.h);
  // Hông đông/tây của bục
  addCollider(P.x1, (P.z1 + P.z2) / 2, 0.4, pd, 0, P.h);
  addCollider(P.x2, (P.z1 + P.z2) / 2, 0.4, pd, 0, P.h);

  // Cầu thang: 6 bậc nhìn thấy + lan can thấp hai bên
  const R = MAP.ramp;
  const steps = 6;
  for (let i = 0; i < steps; i++) {
    const t = (i + 0.5) / steps;
    const sz = (R.z2 - R.z1) / steps;
    const h = P.h * (1 - t);
    box(0, h / 2, R.z1 + (i + 0.5) * sz, R.x2 - R.x1, h, sz, C.wallDark, { tex: texWall });
  }
  box(R.x1 - 0.15, 0.9, (R.z1 + R.z2) / 2, 0.3, 1.8, R.z2 - R.z1, C.wall);
  box(R.x2 + 0.15, 0.9, (R.z1 + R.z2) / 2, 0.3, 1.8, R.z2 - R.z1, C.wall);
  addCollider(R.x1 - 0.15, (R.z1 + R.z2) / 2, 0.3, R.z2 - R.z1, 0, 3.2);
  addCollider(R.x2 + 0.15, (R.z1 + R.z2) / 2, 0.3, R.z2 - R.z1, 0, 3.2);

  // Cột tím hai bên khu cao (theo level map)
  for (const [x, z] of [[-7.4, -14.4], [7.4, -14.4], [-7.4, -19.4], [7.4, -19.4]]) {
    box(x, P.h + 1.3, z, 0.5, 2.6, 0.5, C.violet, { emissive: 0.75 });
  }
  // Vật cản trên khu cao (trang trí)
  box(-5, P.h + 0.6, -17.5, 1.8, 1.2, 1.8, "#ffffff", { tex: texCrate });
  box(5, P.h + 0.6, -17.5, 1.8, 1.2, 1.8, "#ffffff", { tex: texCrateHazard });

  /* ---- Viền neon sân trung tâm (cyan) ---- */
  for (const [x, z, w, d] of [
    [0, -9, 26, 0.14], [0, 9, 26, 0.14], [-13, 0, 0.14, 18], [13, 0, 0.14, 18],
  ]) {
    box(x, 0.03, z, w, 0.05, d, C.cyan, { emissive: 0.85 });
  }
  // Vạch hành lang
  box(-16.2, 0.03, 0, 0.1, 0.04, 28, C.cyan, { emissive: 0.4 });
  box(16.2, 0.03, 0, 0.1, 0.04, 28, C.cyan, { emissive: 0.4 });

  /* ---- Trụ năng lượng trung tâm ---- */
  box(0, 0.35, 0, 1.3, 0.7, 1.3, C.wallDark, { tex: texWall });
  addCollider(0, 0, 1.5, 1.5, 0, 1.4);
  const gem = meshNode("gem", {
    pos: [0, 1.35, 0],
    scale: [0.9, 1.25, 0.9],
    color: hex(C.violet),
    emissive: 1,
  });
  addChild(root, gem);
  dynamic.gem = gem;

  /* ---- Tường ngăn hành lang (có cửa) ---- */
  for (const side of [-1, 1]) {
    for (const zc of [-8.5, 8.5]) {
      const n = box(side * 15, 1.6, zc, 0.9, 3.2, 9, "#ffffff", { tex: texWall });
      addCollider(side * 15, zc, 0.9, 9, 0, 3.2);
      // Viền cyan mép cửa
      box(side * 15, 1.6, zc - 4.55, 0.95, 3.2, 0.1, C.cyan, { emissive: 0.5 });
      box(side * 15, 1.6, zc + 4.55, 0.95, 3.2, 0.1, C.cyan, { emissive: 0.5 });
      void n;
    }
  }

  /* ---- Vật cản (crate 2×1.4×2, theo asset sheet) ---- */
  const crate = (x, z, stack = 1, hazard = false) => {
    for (let i = 0; i < stack; i++) {
      box(x, 0.7 + i * 1.4, z, 2, 1.4, 2, "#ffffff", {
        tex: hazard && i === stack - 1 ? texCrateHazard : texCrate,
      });
      // Viền phát sáng mép trên
      box(x, 1.42 + i * 1.4, z, 2.04, 0.05, 2.04, C.cyan, { emissive: 0.55 });
    }
    addCollider(x, z, 2, 2, 0, 1.4 * stack);
  };

  // Sân trung tâm: 2 hàng × 4 (một vài chồng đôi)
  crate(-10, -5); crate(-4, -5, 2, true); crate(4, -5); crate(10, -5);
  crate(-10, 5); crate(-4, 5); crate(4, 5, 1, true); crate(10, 5, 2);
  // Hành lang trái
  crate(-24, -10); crate(-19, -13, 1, true); crate(-26, -2, 2); crate(-20, 3); crate(-24, 9); crate(-19, 13);
  // Hành lang phải
  crate(24, -10, 1, true); crate(19, -13); crate(26, -2); crate(20, 3, 2); crate(24, 9); crate(19, 13, 1, true);
  // Các góc gần khu cao / điểm xuất phát
  crate(-13, -17); crate(13, -17, 2); crate(-25, -17); crate(25, -17);
  crate(-13, 16); crate(13, 16);

  /* ---- Cổng spawn bot (8, hai bên, theo level map) ---- */
  const botGates = [];
  const gateNode = (x, z, side) => {
    const g = createNode({ pos: [x, 0, z], rot: [0, side < 0 ? Math.PI / 2 : -Math.PI / 2, 0] });
    // Khung cổng tím
    for (const dz of [-1.1, 1.1]) {
      addChild(g, meshNode("box", { pos: [0, 1.3, dz], scale: [0.28, 2.6, 0.28], color: hex(C.violet), emissive: 0.85 }));
    }
    addChild(g, meshNode("box", { pos: [0, 2.62, 0], scale: [0.28, 0.26, 2.5], color: hex(C.violet), emissive: 0.85 }));
    // Màng sáng bên trong cổng
    const glow = meshNode("plane", {
      pos: [0.02, 1.3, 0],
      rot: [0, Math.PI / 2, 0],
      scale: [2.1, 2.5, 1],
      color: hex(C.magenta),
      emissive: 1,
      opacity: 0.22,
      additive: true,
    });
    addChild(g, glow);
    dynamic.gateGlows.push(glow);
    // Marker tam giác đỏ lộn ngược (cảnh báo)
    const marker = meshNode("tri", {
      pos: [0, 3.35, 0],
      rot: [0, Math.PI / 2, 0],
      scale: [0.7, 0.7, 1],
      color: hex(C.red),
      emissive: 1,
    });
    addChild(g, marker);
    dynamic.markers.push(marker);
    addChild(root, g);
    return g;
  };

  for (const z of [-16, -6, 6, 16]) {
    gateNode(-29, z, -1);
    botGates.push({ pos: [-27.5, 0, z], side: -1, loop: "left" });
  }
  for (const z of [-16, -6, 6, 16]) {
    gateNode(29, z, 1);
    botGates.push({ pos: [27.5, 0, z], side: 1, loop: "right" });
  }

  /* ---- Điểm xuất phát người chơi (cổng xanh phía nam) ---- */
  const pg = createNode({ pos: [0, 0, 19.4] });
  for (const dx of [-1.5, 1.5]) {
    addChild(pg, meshNode("box", { pos: [dx, 1.4, 0], scale: [0.3, 2.8, 0.3], color: hex(C.lime), emissive: 0.8 }));
  }
  addChild(pg, meshNode("box", { pos: [0, 2.82, 0], scale: [3.3, 0.26, 0.3], color: hex(C.lime), emissive: 0.8 }));
  addChild(root, pg);
  // Pad xuất phát viền lime
  for (const [x, z, w, d] of [
    [0, 14.6, 5, 0.12], [0, 19, 5, 0.12], [-2.5, 16.8, 0.12, 4.5], [2.5, 16.8, 0.12, 4.5],
  ]) {
    box(x, 0.03, z, w, 0.05, d, C.lime, { emissive: 0.8 });
  }

  /* ---- Bóng blob dưới trụ (texture chung cho bot dùng lại) ---- */

  /* ---- Vòng tuần tra (theo đường đứt đỏ trên level map) ---- */
  const patrols = {
    left: [[-27, -15], [-17.5, -15], [-17.5, 15], [-27, 15]],
    right: [[27, -15], [17.5, -15], [17.5, 15], [27, 15]],
    court: [[-11, -7], [11, -7], [11, 7], [-11, 7]],
  };

  /* ---- Độ cao mặt đất (bục + dốc cầu thang) ---- */
  function groundHeightAt(x, z) {
    const p = MAP.platform;
    if (x >= p.x1 && x <= p.x2 && z <= p.z2 && z >= p.z1) return p.h;
    const r = MAP.ramp;
    if (x >= r.x1 && x <= r.x2 && z > r.z1 && z <= r.z2) {
      return p.h * ((r.z2 - z) / (r.z2 - r.z1));
    }
    return 0;
  }

  /* ---- Va chạm di chuyển: đẩy hình tròn (r) ra khỏi AABB ---- */
  function resolveMove(pos, radius, height = 1.8) {
    for (const c of colliders) {
      if (pos[1] + height <= c.min[1] || pos[1] >= c.max[1] - 0.05) continue;
      const nx = Math.max(c.min[0], Math.min(pos[0], c.max[0]));
      const nz = Math.max(c.min[2], Math.min(pos[2], c.max[2]));
      const dx = pos[0] - nx;
      const dz = pos[2] - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= radius * radius) continue;
      if (d2 > 1e-9) {
        const d = Math.sqrt(d2);
        pos[0] = nx + (dx / d) * radius;
        pos[2] = nz + (dz / d) * radius;
      } else {
        // Tâm nằm trong hộp: đẩy ra theo trục gần nhất
        const left = Math.abs(pos[0] - c.min[0]);
        const right = Math.abs(c.max[0] - pos[0]);
        const near = Math.abs(pos[2] - c.min[2]);
        const far = Math.abs(c.max[2] - pos[2]);
        const m = Math.min(left, right, near, far);
        if (m === left) pos[0] = c.min[0] - radius;
        else if (m === right) pos[0] = c.max[0] + radius;
        else if (m === near) pos[2] = c.min[2] - radius;
        else pos[2] = c.max[2] + radius;
      }
    }
    // Giữ trong tường bao
    pos[0] = Math.max(-29.4, Math.min(29.4, pos[0]));
    pos[2] = Math.max(-19.4, Math.min(19.4, pos[2]));
  }

  /* ---- Hiệu ứng động ---- */
  let time = 0;
  function update(dt) {
    time += dt;
    if (dynamic.gem) {
      dynamic.gem.rot[1] += dt * 1.4;
      dynamic.gem.pos[1] = 1.35 + Math.sin(time * 2) * 0.08;
    }
    const pulse = 0.75 + 0.25 * Math.sin(time * 5);
    for (const m of dynamic.markers) {
      m.scale[0] = 0.7 * pulse;
      m.scale[1] = 0.7 * pulse;
    }
    for (const g of dynamic.gateGlows) {
      g.mesh.opacity = 0.14 + 0.1 * Math.sin(time * 3 + g.pos[2]);
    }
  }

  return {
    root,
    colliders,
    patrols,
    botGates,
    playerSpawn: { pos: [0, 0, 16.5], yaw: 0 },
    pickupSpots: {
      health: [[-13, 0], [13, 0]],
      ammo: [[0, -7.6], [0, 7.6]],
    },
    groundHeightAt,
    resolveMove,
    update,
    texBlob,
  };
}
