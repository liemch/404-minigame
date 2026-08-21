/**
 * world.js — dựng map "404 Strike" theo Level Map + Gameplay reference:
 *  - Kích thước 60m × 40m, lưới 2m, tông ghi-xanh công nghiệp SÁNG RÕ
 *    (không phải wireframe neon tối) như ảnh gameplay.
 *  - KHU CAO phía bắc (+3m) với cầu thang trung tâm, cột tím, cổng 404
 *    lớn có khung + biển "404" tím phát sáng.
 *  - SÂN TRUNG TÂM viền neon cyan + vật cản crate viền cyan/cảnh báo
 *    vàng + trụ năng lượng.
 *  - Sàn panel bê-tông ghi xanh có đường mạch neon cyan uốn khúc.
 *  - HÀNH LANG TRÁI/PHẢI, cổng vòm có số "04", cổng spawn bot dạng
 *    tunnel tối + khung tím + thanh đèn đỏ dọc.
 *  - Silhouette nhà xưởng/tháp tối phía sau tường bao lấp kín chân trời.
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

/* Bảng màu theo gameplay reference: ghi-xanh sáng + neon có kiểm soát */
const C = {
  floor: "#4c5468",
  wall: "#333c58",
  wallDark: "#262d47",
  panelDark: "#1d2338",
  crate: "#2b3350",
  cyan: "#2fe2ff",
  violet: "#8b5cff",
  magenta: "#ff4fd8",
  lime: "#a8ff3e",
  red: "#ff4655",
  gold: "#ffd23f",
};

/* ============================ Texture ============================ */

function floorTexture(engine) {
  const cv = document.createElement("canvas");
  cv.width = 2048;
  cv.height = 1366; // tỉ lệ 60:40 (~34 px/m)
  const ctx = cv.getContext("2d");
  const rand = seededRand(60);
  const kx = cv.width / 60;   // px trên 1m theo X
  const kz = cv.height / 40;  // px trên 1m theo Z
  const px = (x) => (x + 30) * kx;
  const pz = (z) => (z + 20) * kz;

  // Nền bê-tông ghi xanh
  ctx.fillStyle = "#4a5166";
  ctx.fillRect(0, 0, cv.width, cv.height);

  // Ô panel 2m với sắc thái lệch nhẹ
  for (let gz = 0; gz < 20; gz++) {
    for (let gx = 0; gx < 30; gx++) {
      const v = rand();
      if (v > 0.6) {
        ctx.fillStyle = `rgba(228,236,255,${(v - 0.6) * 0.14})`;
        ctx.fillRect(gx * 2 * kx, gz * 2 * kz, 2 * kx, 2 * kz);
      } else if (v < 0.2) {
        ctx.fillStyle = `rgba(8,12,26,${(0.2 - v) * 0.6})`;
        ctx.fillRect(gx * 2 * kx, gz * 2 * kz, 2 * kx, 2 * kz);
      }
    }
  }

  // Vết ố loang nhẹ (đỡ phẳng)
  for (let i = 0; i < 26; i++) {
    const sx = rand() * cv.width;
    const sz = rand() * cv.height;
    const r = 40 + rand() * 150;
    const g = ctx.createRadialGradient(sx, sz, 4, sx, sz, r);
    g.addColorStop(0, `rgba(10,14,30,${0.05 + rand() * 0.08})`);
    g.addColorStop(1, "rgba(10,14,30,0)");
    ctx.fillStyle = g;
    ctx.fillRect(sx - r, sz - r, r * 2, r * 2);
  }

  // Mối ghép panel 2m (mảnh) + mối lớn 10m (hơi đậm hơn)
  ctx.strokeStyle = "rgba(12,16,32,0.35)";
  ctx.lineWidth = 2;
  for (let i = 0; i <= 30; i++) {
    ctx.beginPath(); ctx.moveTo(i * 2 * kx, 0); ctx.lineTo(i * 2 * kx, cv.height); ctx.stroke();
  }
  for (let i = 0; i <= 20; i++) {
    ctx.beginPath(); ctx.moveTo(0, i * 2 * kz); ctx.lineTo(cv.width, i * 2 * kz); ctx.stroke();
  }
  ctx.strokeStyle = "rgba(8,10,24,0.45)";
  ctx.lineWidth = 3;
  for (let i = 0; i <= 6; i++) {
    ctx.beginPath(); ctx.moveTo(i * 10 * kx, 0); ctx.lineTo(i * 10 * kx, cv.height); ctx.stroke();
  }
  for (let i = 0; i <= 4; i++) {
    ctx.beginPath(); ctx.moveTo(0, i * 10 * kz); ctx.lineTo(cv.width, i * 10 * kz); ctx.stroke();
  }

  // Sân trung tâm tối hơn một chút (đọc rõ ranh giới)
  ctx.fillStyle = "rgba(12,15,32,0.3)";
  ctx.fillRect(px(-13), pz(-9), 26 * kx, 18 * kz);

  // Đường mạch neon cyan uốn khúc (như ảnh gameplay)
  const circuit = (pts, color = "rgba(64,230,255,0.95)", w = 6, blur = 22) => {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.shadowColor = "#2fe2ff";
    ctx.shadowBlur = blur;
    ctx.beginPath();
    pts.forEach(([x, z], i) => {
      if (i === 0) ctx.moveTo(px(x), pz(z));
      else ctx.lineTo(px(x), pz(z));
    });
    ctx.stroke();
    ctx.restore();
  };

  // Viền sân trung tâm (glow — line 3D emissive đặt chồng lên trên)
  circuit([[-13, -9], [13, -9], [13, 9], [-13, 9], [-13, -9]], "rgba(64,230,255,0.9)", 9, 30);
  // Mạch uốn từ điểm xuất phát vào sân
  circuit([[2.5, 19], [2.5, 13.5], [7, 13.5], [7, 9]], "rgba(64,230,255,0.95)", 8, 26);
  circuit([[-2.5, 19], [-2.5, 12], [-9, 12], [-9, 9]], "rgba(64,230,255,0.95)", 8, 26);
  // Mạch trong sân: uốn quanh trụ trung tâm (như ảnh gameplay)
  circuit([[-9, 9], [-7, 7], [-7, 2.2], [-2.2, 2.2]], "rgba(64,230,255,0.85)", 8, 24);
  circuit([[7, 9], [7, 3.5], [2.6, 3.5], [2.6, -1], [7.5, -1], [7.5, -7]], "rgba(64,230,255,0.85)", 8, 24);
  circuit([[-2.2, -2.2], [-6, -2.2], [-6, -7]], "rgba(64,230,255,0.75)", 7, 22);
  // Mạch hành lang trái/phải chạy dọc
  circuit([[-16.2, 15], [-16.2, -2], [-20, -6], [-20, -15]], "rgba(64,230,255,0.8)", 7, 20);
  circuit([[16.2, 15], [16.2, -2], [20, -6], [20, -15]], "rgba(64,230,255,0.8)", 7, 20);
  // Mạch quanh khu cao
  circuit([[-7, -11], [-4, -11], [-4, -13.8]], "rgba(139,92,255,0.85)", 7, 20);
  circuit([[7, -11], [4, -11], [4, -13.8]], "rgba(139,92,255,0.85)", 7, 20);

  // Sọc cảnh báo vàng trước các cổng spawn hai bên
  ctx.save();
  ctx.fillStyle = "rgba(255,210,63,0.65)";
  for (const gz of [-16, -6, 6, 16]) {
    for (const side of [-1, 1]) {
      const x0 = side === -1 ? -29 : 26.6;
      for (let s = 0; s < 5; s++) {
        ctx.save();
        ctx.translate(px(x0 + s * 0.55), pz(gz));
        ctx.rotate(0.5);
        ctx.fillRect(0, -1.1 * kz, 0.22 * kx, 2.2 * kz);
        ctx.restore();
      }
    }
  }
  ctx.restore();

  // Pad xuất phát: nền lime mờ
  ctx.fillStyle = "rgba(168,255,62,0.06)";
  ctx.fillRect(px(-2.5), pz(14.6), 5 * kx, 4.4 * kz);

  return engine.makeTexture(cv);
}

function wallTexture(engine) {
  const cv = document.createElement("canvas");
  cv.width = 1024;
  cv.height = 256;
  const ctx = cv.getContext("2d");
  const rand = seededRand(31);

  // Box của engine có UV lật dọc so với canvas → lật lại để vẽ như thường
  ctx.translate(0, cv.height);
  ctx.scale(1, -1);

  // Nền panel ghi xanh
  ctx.fillStyle = "#333b57";
  ctx.fillRect(0, 0, cv.width, cv.height);

  // 8 cột panel với sắc thái lệch + bevel
  const cw = cv.width / 8;
  for (let i = 0; i < 8; i++) {
    const v = rand();
    if (v > 0.5) {
      ctx.fillStyle = `rgba(226,236,255,${(v - 0.5) * 0.12})`;
      ctx.fillRect(i * cw, 0, cw, cv.height);
    } else {
      ctx.fillStyle = `rgba(10,14,30,${(0.5 - v) * 0.3})`;
      ctx.fillRect(i * cw, 0, cw, cv.height);
    }
    // Bevel sáng mép trái panel
    ctx.fillStyle = "rgba(226,236,255,0.1)";
    ctx.fillRect(i * cw + 2, 6, 3, cv.height - 12);
  }

  // Mối ghép dọc
  ctx.strokeStyle = "rgba(8,10,24,0.8)";
  ctx.lineWidth = 4;
  for (let i = 0; i <= 8; i++) {
    ctx.beginPath(); ctx.moveTo(i * cw, 0); ctx.lineTo(i * cw, cv.height); ctx.stroke();
  }
  // Băng ngang dưới (ốp chân tường tối)
  ctx.fillStyle = "rgba(14,18,36,0.85)";
  ctx.fillRect(0, cv.height - 52, cv.width, 52);
  ctx.fillStyle = "rgba(226,236,255,0.07)";
  ctx.fillRect(0, cv.height - 52, cv.width, 4);
  // Băng sáng đỉnh tường
  ctx.fillStyle = "rgba(226,236,255,0.12)";
  ctx.fillRect(0, 0, cv.width, 10);
  // Khe thoát khí + đinh tán
  ctx.fillStyle = "rgba(10,13,28,0.9)";
  for (let i = 0; i < 8; i++) {
    if (rand() > 0.5) {
      const x = i * cw + cw / 2 - 26;
      for (let s = 0; s < 4; s++) ctx.fillRect(x, 58 + s * 12, 52, 5);
    }
  }
  ctx.fillStyle = "rgba(8,10,22,0.9)";
  for (let i = 0; i < 8; i++) {
    ctx.fillRect(i * cw + 10, 16, 5, 5);
    ctx.fillRect((i + 1) * cw - 15, 16, 5, 5);
    ctx.fillRect(i * cw + 10, cv.height - 70, 5, 5);
    ctx.fillRect((i + 1) * cw - 15, cv.height - 70, 5, 5);
  }
  return engine.makeTexture(cv);
}

function crateTexture(engine, hazard = false) {
  const cv = document.createElement("canvas");
  cv.width = 256;
  cv.height = 256;
  const ctx = cv.getContext("2d");

  // Box của engine có UV lật dọc so với canvas → lật lại để vẽ như thường
  ctx.translate(0, 256);
  ctx.scale(1, -1);

  // Thân crate ghi xanh có bevel
  ctx.fillStyle = "#353e60";
  ctx.fillRect(0, 0, 256, 256);
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, "rgba(226,236,255,0.12)");
  g.addColorStop(0.5, "rgba(226,236,255,0)");
  g.addColorStop(1, "rgba(8,10,24,0.35)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);

  // Panel giữa lõm tối
  ctx.fillStyle = "rgba(13,17,36,0.75)";
  ctx.fillRect(36, 36, 184, 184);
  ctx.fillStyle = "rgba(226,236,255,0.08)";
  ctx.fillRect(36, 36, 184, 5);

  // Viền neon cyan phát sáng (mép crate như ảnh)
  ctx.save();
  ctx.strokeStyle = "rgba(80,232,255,0.98)";
  ctx.lineWidth = 10;
  ctx.shadowColor = "#2fe2ff";
  ctx.shadowBlur = 22;
  ctx.strokeRect(10, 10, 236, 236);
  ctx.restore();
  ctx.strokeStyle = "rgba(64,228,255,0.3)";
  ctx.lineWidth = 3;
  ctx.strokeRect(30, 30, 196, 196);

  // Bu-lông 4 góc
  ctx.fillStyle = "rgba(8,10,22,0.95)";
  for (const [bx, by] of [[20, 20], [228, 20], [20, 228], [228, 228]]) {
    ctx.beginPath(); ctx.arc(bx + 4, by + 4, 5, 0, Math.PI * 2); ctx.fill();
  }

  if (hazard) {
    // Tam giác cảnh báo vàng (asset sheet vật cản)
    ctx.save();
    ctx.shadowColor = "#ffd23f";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "rgba(255,214,74,0.95)";
    ctx.beginPath();
    ctx.moveTo(128, 66);
    ctx.lineTo(186, 172);
    ctx.lineTo(70, 172);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#1a2038";
    ctx.font = "800 62px monospace";
    ctx.textAlign = "center";
    ctx.fillText("!", 128, 160);
  } else {
    // Vạch mã hiệu + chấm cyan
    ctx.fillStyle = "rgba(226,236,255,0.25)";
    ctx.fillRect(62, 112, 132, 16);
    ctx.fillStyle = "rgba(64,228,255,0.8)";
    ctx.fillRect(62, 140, 52, 8);
    ctx.fillStyle = "rgba(139,92,255,0.8)";
    ctx.fillRect(124, 140, 26, 8);
  }
  return engine.makeTexture(cv);
}

function signTexture(engine) {
  const cv = document.createElement("canvas");
  cv.width = 1024;
  cv.height = 360;
  const ctx = cv.getContext("2d");

  // Panel nền tối
  ctx.fillStyle = "#171c33";
  ctx.fillRect(0, 0, cv.width, cv.height);
  const g = ctx.createLinearGradient(0, 0, 0, cv.height);
  g.addColorStop(0, "rgba(139,92,255,0.16)");
  g.addColorStop(0.55, "rgba(139,92,255,0.03)");
  g.addColorStop(1, "rgba(139,92,255,0.12)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, cv.width, cv.height);

  // Khung cyan hai lớp
  ctx.save();
  ctx.strokeStyle = "rgba(64,228,255,0.9)";
  ctx.lineWidth = 8;
  ctx.shadowColor = "#2fe2ff";
  ctx.shadowBlur = 22;
  ctx.strokeRect(14, 14, cv.width - 28, cv.height - 28);
  ctx.restore();
  ctx.strokeStyle = "rgba(64,228,255,0.25)";
  ctx.lineWidth = 3;
  ctx.strokeRect(34, 34, cv.width - 68, cv.height - 68);

  // Chữ 404 pixel-tím phát sáng (2 lớp glow)
  ctx.font = "800 250px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.save();
  ctx.shadowColor = "#8b5cff";
  ctx.shadowBlur = 70;
  ctx.fillStyle = "#7748f0";
  ctx.fillText("404", cv.width / 2, cv.height / 2 + 12);
  ctx.restore();
  ctx.save();
  ctx.shadowColor = "#c9a6ff";
  ctx.shadowBlur = 24;
  ctx.fillStyle = "#a97fff";
  ctx.fillText("404", cv.width / 2, cv.height / 2 + 12);
  ctx.restore();
  return engine.makeTexture(cv);
}

/** Bảng số "04" tím trên panel tối (trang trí cổng vòm như ảnh). */
function numberTexture(engine) {
  const cv = document.createElement("canvas");
  cv.width = 256;
  cv.height = 300;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "rgba(16,20,40,0.001)"; // trong suốt — vẽ lên tường sẵn có
  ctx.clearRect(0, 0, 256, 300);
  ctx.font = "800 150px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.save();
  ctx.shadowColor = "#8b5cff";
  ctx.shadowBlur = 30;
  ctx.fillStyle = "#8e66e8";
  ctx.fillText("04", 128, 128);
  ctx.restore();
  // Mũi tên tam giác tím chỉ xuống
  ctx.save();
  ctx.shadowColor = "#8b5cff";
  ctx.shadowBlur = 16;
  ctx.fillStyle = "rgba(142,102,232,0.85)";
  ctx.beginPath();
  ctx.moveTo(100, 228);
  ctx.lineTo(156, 228);
  ctx.lineTo(128, 268);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  return engine.makeTexture(cv);
}

/** Mặt tối bên trong cổng spawn (tunnel sâu hút). */
function tunnelTexture(engine) {
  const cv = document.createElement("canvas");
  cv.width = 128;
  cv.height = 128;
  const ctx = cv.getContext("2d");
  const g = ctx.createRadialGradient(64, 60, 6, 64, 64, 82);
  g.addColorStop(0, "#05070f");
  g.addColorStop(0.7, "#0a0e1e");
  g.addColorStop(1, "#141a30");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  // Vạch sáng đáy tunnel
  ctx.fillStyle = "rgba(255,70,85,0.5)";
  ctx.fillRect(18, 108, 92, 4);
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
  const texCrate = crateTexture(engine, false);
  const texCrateHazard = crateTexture(engine, true);
  const texSign = signTexture(engine);
  const texNumber = numberTexture(engine);
  const texTunnel = tunnelTexture(engine);
  const texBlob = blobTexture(engine);

  const box = (x, y, z, w, h, d, color, opts = {}) => {
    const n = meshNode("box", {
      pos: [x, y, z],
      scale: [w, h, d],
      color: typeof color === "string" ? hex(color) : color,
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
    addCollider(x, z, w, d, 0, Math.min(h, 4));
    return n;
  };
  wall(-20, -20.5, 20, 4.6, 1); // bắc trái
  wall(20, -20.5, 20, 4.6, 1);  // bắc phải
  wall(0, 20.5, 60, 4.2, 1);    // nam
  wall(-30.5, 0, 1, 4.4, 40);   // tây
  wall(30.5, 0, 1, 4.4, 40);    // đông

  // Sọc neon cyan chạy dọc đỉnh tường
  for (const [x, y, z, w, d] of [
    [-20, 4.42, -19.94, 20, 0.14], [20, 4.42, -19.94, 20, 0.14],
    [0, 4.02, 19.94, 59, 0.14],
    [-29.94, 4.22, 0, 0.14, 39], [29.94, 4.22, 0, 0.14, 39],
  ]) {
    box(x, y, z, w, 0.09, d, C.cyan, { emissive: 0.95 });
  }

  // Thanh đèn đỏ dọc trên tường (theo gameplay reference)
  for (const [x, z] of [
    [-29.8, -12], [-29.8, 12], [29.8, -12], [29.8, 12],
    [-24, -20.3], [-16, -20.3], [16, -20.3], [24, -20.3],
    [-12, 20.3], [12, 20.3],
  ]) {
    box(x, 2.5, z, Math.abs(x) > 25 ? 0.18 : 0.6, 2.8, Math.abs(x) > 25 ? 0.6 : 0.18, C.red, { emissive: 1 });
  }
  // Vài thanh tím ngắn xen kẽ
  for (const [x, z] of [[-8, -20.3], [8, -20.3], [-29.8, 3], [29.8, -3]]) {
    box(x, 3, z, Math.abs(x) > 25 ? 0.16 : 0.5, 1.6, Math.abs(x) > 25 ? 0.5 : 0.16, C.violet, { emissive: 0.9 });
  }

  /* ---- Cổng 404 lớn (tường bắc, nhìn về phía nam) ---- */
  // Khung cổng: 2 trụ + header trên biển
  box(0, 3.5, -20.4, 17, 7, 1.2, C.wallDark, { tex: texWall });
  box(-8, 4, -19.9, 1.4, 8, 1.6, C.panelDark);
  box(8, 4, -19.9, 1.4, 8, 1.6, C.panelDark);
  box(0, 7.6, -19.9, 17.4, 0.9, 1.6, C.panelDark);
  // Neon viền trụ cổng
  box(-8, 4, -19.05, 0.16, 7.6, 0.1, C.cyan, { emissive: 0.85 });
  box(8, 4, -19.05, 0.16, 7.6, 0.1, C.cyan, { emissive: 0.85 });
  box(0, 7.18, -19.05, 16.6, 0.12, 0.1, C.violet, { emissive: 0.9 });
  // Biển 404
  const sign = meshNode("plane", {
    pos: [0, 4.7, -19.78],
    scale: [13.5, 4.75, 1],
    color: [1, 1, 1],
    tex: texSign,
    emissive: 1,
  });
  addChild(root, sign);
  // Đèn đỏ hai bên biển
  box(-10.5, 4.2, -19.85, 0.5, 3, 0.24, C.red, { emissive: 1 });
  box(10.5, 4.2, -19.85, 0.5, 3, 0.24, C.red, { emissive: 1 });

  /* ---- Silhouette nhà xưởng phía sau tường (lấp chân trời) ---- */
  {
    const rand = seededRand(4404);
    const bg = (x, z, w, h, d, tint) => {
      box(x, h / 2, z, w, h, d, tint);
      if (rand() > 0.45) {
        const nc = rand() > 0.6 ? C.cyan : rand() > 0.35 ? C.violet : C.red;
        box(x, h + 0.06, z, rand() > 0.5 ? w * 0.9 : 0.2, 0.12, rand() > 0.5 ? 0.2 : d * 0.9, nc, { emissive: 0.85 });
      }
    };
    // Bắc: khối lớn hai bên cổng 404
    bg(-17, -24.5, 12, 10, 6, C.panelDark);
    bg(17, -24.5, 12, 11.5, 6, C.panelDark);
    bg(-27, -23.5, 8, 8.4, 5, "#1a2036");
    bg(27, -23.5, 8, 9, 5, "#1a2036");
    bg(0, -26, 14, 12.5, 6, "#161b30");
    // Đông/Tây: dãy khối so le
    for (const side of [-1, 1]) {
      bg(side * 34.5, -12, 6, 9.5, 9, C.panelDark);
      bg(side * 35.5, 2, 7, 7.8, 10, "#1a2036");
      bg(side * 34, 14, 5, 10.4, 8, "#161b30");
    }
    // Nam: thấp hơn (ít che tầm nhìn)
    bg(-18, 24.5, 12, 7, 6, "#1a2036");
    bg(18, 24.5, 12, 7.8, 6, C.panelDark);
    bg(0, 25.5, 10, 9, 5, "#161b30");
    // Ống khói / tháp anten
    for (const [tx, tz, th] of [[-10, -25.5, 14], [23, -26, 13], [-33.5, -6, 12], [34, 8, 13]]) {
      box(tx, th / 2, tz, 1.5, th, 1.5, "#141a2e");
      box(tx, th + 0.2, tz, 0.4, 0.4, 0.4, C.red, { emissive: 1 });
    }
  }

  /* ---- KHU CAO (bục +3m) + cầu thang ---- */
  const P = MAP.platform;
  const pw = P.x2 - P.x1;
  const pd = P.z2 - P.z1;
  box((P.x1 + P.x2) / 2, P.h - 0.25, (P.z1 + P.z2) / 2, pw, 0.5, pd, "#ffffff", { tex: texWall });
  // Chân bục
  box((P.x1 + P.x2) / 2, (P.h - 0.5) / 2, (P.z1 + P.z2) / 2, pw, P.h - 0.5, pd, C.wallDark, { tex: texWall });
  // Viền neon tím mép bục
  box(0, P.h + 0.02, P.z2 - 0.05, pw, 0.07, 0.14, C.violet, { emissive: 0.95 });

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
  box(R.x1 - 0.15, 1.84, (R.z1 + R.z2) / 2, 0.32, 0.06, R.z2 - R.z1, C.cyan, { emissive: 0.7 });
  box(R.x2 + 0.15, 1.84, (R.z1 + R.z2) / 2, 0.32, 0.06, R.z2 - R.z1, C.cyan, { emissive: 0.7 });
  addCollider(R.x1 - 0.15, (R.z1 + R.z2) / 2, 0.3, R.z2 - R.z1, 0, 3.2);
  addCollider(R.x2 + 0.15, (R.z1 + R.z2) / 2, 0.3, R.z2 - R.z1, 0, 3.2);

  // Cột tím hai bên khu cao (theo level map)
  for (const [x, z] of [[-7.4, -14.4], [7.4, -14.4], [-7.4, -19.4], [7.4, -19.4]]) {
    box(x, P.h + 1.3, z, 0.62, 2.6, 0.62, C.panelDark);
    box(x, P.h + 1.3, z, 0.3, 2.7, 0.3, C.violet, { emissive: 0.85 });
    box(x, P.h + 2.72, z, 0.72, 0.18, 0.72, C.wallDark);
  }
  // Vật cản trên khu cao (trang trí)
  box(-5, P.h + 0.7, -17.5, 1.9, 1.4, 1.9, "#ffffff", { tex: texCrate });
  box(5, P.h + 0.7, -17.5, 1.9, 1.4, 1.9, "#ffffff", { tex: texCrateHazard });

  /* ---- Viền neon sân trung tâm (cyan, chồng lên vạch texture) ---- */
  for (const [x, z, w, d] of [
    [0, -9, 26, 0.16], [0, 9, 26, 0.16], [-13, 0, 0.16, 18], [13, 0, 0.16, 18],
  ]) {
    box(x, 0.04, z, w, 0.06, d, C.cyan, { emissive: 0.9 });
  }

  /* ---- Trụ năng lượng trung tâm ---- */
  box(0, 0.4, 0, 1.5, 0.8, 1.5, C.wallDark, { tex: texWall });
  box(0, 0.84, 0, 1.1, 0.08, 1.1, C.violet, { emissive: 0.8 });
  addCollider(0, 0, 1.5, 1.5, 0, 1.4);
  const gem = meshNode("gem", {
    pos: [0, 1.35, 0],
    scale: [0.62, 0.92, 0.62],
    color: hex(C.violet),
    emissive: 1,
  });
  addChild(root, gem);
  // Quầng sáng tím quanh gem
  const gemGlow = meshNode("gem", {
    pos: [0, 1.35, 0],
    scale: [0.78, 1.1, 0.78],
    color: hex(C.violet),
    emissive: 1,
    opacity: 0.13,
    additive: true,
  });
  addChild(root, gemGlow);
  dynamic.gem = gem;
  dynamic.gemGlow = gemGlow;

  /* ---- Tường ngăn hành lang (có cửa vòm + số 04) ---- */
  for (const side of [-1, 1]) {
    for (const zc of [-8.5, 8.5]) {
      box(side * 15, 1.7, zc, 0.9, 3.4, 9, "#ffffff", { tex: texWall });
      addCollider(side * 15, zc, 0.9, 9, 0, 3.4);
      // Trụ neon cyan mảnh ở mép cửa (2 góc tường)
      box(side * 15 + side * 0.35, 1.7, zc - 4.52, 0.14, 3.3, 0.14, C.cyan, { emissive: 0.8 });
      box(side * 15 + side * 0.35, 1.7, zc + 4.52, 0.14, 3.3, 0.14, C.cyan, { emissive: 0.8 });
      box(side * 15 - side * 0.35, 1.7, zc - 4.52, 0.14, 3.3, 0.14, C.cyan, { emissive: 0.5 });
      box(side * 15 - side * 0.35, 1.7, zc + 4.52, 0.14, 3.3, 0.14, C.cyan, { emissive: 0.5 });
      // Nóc + header vòm trên cửa (phía sân)
      box(side * 15, 3.5, zc, 1.1, 0.24, 9.4, C.panelDark);
      // Bảng số "04" tím quay vào sân
      const num = meshNode("plane", {
        pos: [side * (15 - 0.48), 2, zc],
        rot: [0, side < 0 ? Math.PI / 2 : -Math.PI / 2, 0],
        scale: [1.7, 2, 1],
        color: [1, 1, 1],
        tex: texNumber,
        emissive: 1,
        opacity: 0.98,
      });
      addChild(root, num);
    }
    // Header nối 2 tường ngăn (cửa giữa) — vòm như ảnh
    box(side * 15, 3.35, 0, 1.1, 0.35, 8.2, C.panelDark);
    box(side * 15, 3.16, 0, 1.14, 0.08, 8.2, C.red, { emissive: 0.85 });
  }

  /* ---- Vật cản (crate 2×1.4×2, theo asset sheet) ---- */
  const crate = (x, z, stack = 1, hazard = false) => {
    for (let i = 0; i < stack; i++) {
      box(x, 0.7 + i * 1.4, z, 2, 1.4, 2, "#ffffff", {
        tex: hazard && i === stack - 1 ? texCrateHazard : texCrate,
      });
      // Viền phát sáng mép trên
      box(x, 1.415 + i * 1.4, z, 2.06, 0.05, 2.06, C.cyan, { emissive: 0.7 });
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
  // Khung nhìn từ spawn: crate hai bên lối vào sân
  crate(-7, 11.5); crate(7, 11.5, 1, true);

  /* ---- Cổng spawn bot (8, hai bên — tunnel tối + khung tím) ---- */
  const botGates = [];
  const gateNode = (x, z, side) => {
    const g = createNode({ pos: [x, 0, z], rot: [0, side < 0 ? Math.PI / 2 : -Math.PI / 2, 0] });
    // Mặt tối "sâu hút" của tunnel (áp sát tường)
    addChild(g, meshNode("plane", {
      pos: [-0.35, 1.42, 0],
      rot: [0, Math.PI / 2, 0],
      scale: [2.35, 2.8, 1],
      color: [1, 1, 1],
      tex: texTunnel,
      emissive: 1,
    }));
    // Khung cổng tím (trụ + header)
    for (const dz of [-1.3, 1.3]) {
      addChild(g, meshNode("box", { pos: [0, 1.45, dz], scale: [0.5, 2.9, 0.34], color: hex(C.panelDark) }));
      addChild(g, meshNode("box", { pos: [0.19, 1.45, dz], scale: [0.12, 2.8, 0.14], color: hex(C.violet), emissive: 0.95 }));
    }
    addChild(g, meshNode("box", { pos: [0, 3, 0], scale: [0.5, 0.4, 2.96], color: hex(C.panelDark) }));
    addChild(g, meshNode("box", { pos: [0.19, 2.88, 0], scale: [0.12, 0.14, 2.6], color: hex(C.violet), emissive: 0.95 }));
    // Thanh đỏ cảnh báo hai bên cổng
    addChild(g, meshNode("box", { pos: [0.12, 1.5, -1.85], scale: [0.12, 2.2, 0.12], color: hex(C.red), emissive: 1 }));
    addChild(g, meshNode("box", { pos: [0.12, 1.5, 1.85], scale: [0.12, 2.2, 0.12], color: hex(C.red), emissive: 1 }));
    // Màng sáng bên trong cổng
    const glow = meshNode("plane", {
      pos: [0.03, 1.4, 0],
      rot: [0, Math.PI / 2, 0],
      scale: [2.3, 2.6, 1],
      color: hex(C.magenta),
      emissive: 1,
      opacity: 0.16,
      additive: true,
    });
    addChild(g, glow);
    dynamic.gateGlows.push(glow);
    // Marker tam giác đỏ lộn ngược (cảnh báo)
    const marker = meshNode("tri", {
      pos: [0, 3.7, 0],
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
    gateNode(-29.4, z, -1);
    botGates.push({ pos: [-27.5, 0, z], side: -1, loop: "left" });
  }
  for (const z of [-16, -6, 6, 16]) {
    gateNode(29.4, z, 1);
    botGates.push({ pos: [27.5, 0, z], side: 1, loop: "right" });
  }

  /* ---- Điểm xuất phát người chơi (cổng xanh phía nam) ---- */
  const pg = createNode({ pos: [0, 0, 19.4] });
  for (const dx of [-1.6, 1.6]) {
    addChild(pg, meshNode("box", { pos: [dx, 1.4, 0], scale: [0.4, 2.8, 0.4], color: hex(C.panelDark) }));
    addChild(pg, meshNode("box", { pos: [dx, 1.4, 0.14], scale: [0.16, 2.7, 0.14], color: hex(C.lime), emissive: 0.9 }));
  }
  addChild(pg, meshNode("box", { pos: [0, 2.92, 0], scale: [3.6, 0.34, 0.4], color: hex(C.panelDark) }));
  addChild(pg, meshNode("box", { pos: [0, 2.86, 0.14], scale: [3.3, 0.14, 0.14], color: hex(C.lime), emissive: 0.9 }));
  addChild(root, pg);
  // Pad xuất phát viền lime
  for (const [x, z, w, d] of [
    [0, 14.6, 5, 0.14], [0, 19, 5, 0.14], [-2.5, 16.8, 0.14, 4.5], [2.5, 16.8, 0.14, 4.5],
  ]) {
    box(x, 0.04, z, w, 0.06, d, C.lime, { emissive: 0.85 });
  }

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
      if (dynamic.gemGlow) {
        dynamic.gemGlow.rot[1] = dynamic.gem.rot[1];
        dynamic.gemGlow.pos[1] = dynamic.gem.pos[1];
        dynamic.gemGlow.mesh.opacity = 0.14 + 0.08 * Math.sin(time * 3);
      }
    }
    const pulse = 0.75 + 0.25 * Math.sin(time * 5);
    for (const m of dynamic.markers) {
      m.scale[0] = 0.7 * pulse;
      m.scale[1] = 0.7 * pulse;
    }
    for (const g of dynamic.gateGlows) {
      g.mesh.opacity = 0.12 + 0.08 * Math.sin(time * 3 + g.pos[2]);
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
