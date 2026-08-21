/**
 * render.js — vẽ board Portal Puzzle 404 bằng Canvas 2D.
 *
 * Đồ họa chính dùng SPRITE cắt từ ảnh tham chiếu portal-puzzle-404.png
 * (xem assets.js): sàn slab navy, tường slab có đinh tán, robot trắng
 * mắt cyan, thùng gỗ 3D, công tắc tròn xanh/tím, cổng đứng cyan/tím,
 * đầu phát laser, ô thoát xanh lá. Khi ảnh chưa kịp decode, mỗi painter
 * tự fallback về nét vẽ vector cũ nên game luôn chạy được.
 * Phần ĐỘNG (tia laser, nét đứt nối cổng, hạt sáng, hiệu ứng teleport,
 * mũi tên gợi ý, glow trạng thái) vẫn vẽ code cho khớp gameplay.
 */

import { DIRS, computeBeams, exitOpen, colorActive } from "./engine.js";
import { loadImages, ready } from "./assets.js";

const IMG = loadImages();
const IMG_READY = Promise.allSettled(
  Object.values(IMG).map((im) => (im.decode ? im.decode().catch(() => {}) : null))
);

const COL = {
  bgOut: "#04071a",
  floorA: "#161c40",
  floorB: "#121734",
  grout: "#090d24",
  wallTop: "#39456f",
  wallTopHi: "#4a588c",
  wallFace: "#20284e",
  wallDark: "#111737",
  cyan: "#20e3ff",
  violet: "#a95cff",
  blue: "#3b7bff",
  lime: "#a8ff3e",
  green: "#3dff77",
  red: "#ff2a3f",
  wood: "#a06a2f",
  woodDark: "#5f3c17",
  woodLight: "#d29a55",
  woodShade: "#7c4f1f",
  robot: "#f2f5ff",
};

/* ---------------- Các painter nguyên tử (theo ô, gốc 0,0, cạnh t) ---------------- */

function drawFloor(g, x, y, t, alt) {
  const im = alt ? IMG.floorA : IMG.floorB;
  if (ready(im)) {
    g.drawImage(im, x, y, t, t);
    return;
  }
  // fallback vector
  g.fillStyle = COL.grout;
  g.fillRect(x, y, t, t);
  const gap = Math.max(1.5, t * 0.045);
  const s = t - gap * 2;
  const r = t * 0.09;
  g.fillStyle = alt ? COL.floorA : COL.floorB;
  g.beginPath();
  g.roundRect(x + gap, y + gap, s, s, r);
  g.fill();
  g.fillStyle = "rgba(160,190,255,0.07)";
  g.beginPath();
  g.roundRect(x + gap, y + gap, s, Math.max(2, t * 0.06), r);
  g.fill();
  g.fillStyle = "rgba(0,0,14,0.26)";
  g.beginPath();
  g.roundRect(x + gap, y + gap + s - Math.max(2, t * 0.08), s, Math.max(2, t * 0.08), r * 0.7);
  g.fill();
}

/* Tường: slab đá vector có đinh tán — khớp phong cách rim slab của ảnh
   tham chiếu hơn texture gạch nhỏ (board tham chiếu không có tường trong). */
function drawWall(g, x, y, t) {
  g.fillStyle = COL.wallDark;
  g.fillRect(x, y, t, t);
  const gap = Math.max(1, t * 0.03);
  const s = t - gap * 2;
  const r = t * 0.12;
  const lip = Math.max(3, t * 0.2);
  g.fillStyle = COL.wallFace;
  g.beginPath();
  g.roundRect(x + gap, y + gap + lip * 0.4, s, s - lip * 0.4, r);
  g.fill();
  const grad = g.createLinearGradient(x, y, x, y + t);
  grad.addColorStop(0, COL.wallTopHi);
  grad.addColorStop(1, COL.wallTop);
  g.fillStyle = grad;
  g.beginPath();
  g.roundRect(x + gap, y + gap, s, s - lip, r);
  g.fill();
  g.strokeStyle = "rgba(190,210,255,0.22)";
  g.lineWidth = 1;
  g.beginPath();
  g.roundRect(x + gap + 1, y + gap + 1, s - 2, s - lip - 2, r * 0.8);
  g.stroke();
  g.fillStyle = "rgba(12,18,44,0.75)";
  const o = Math.max(3, t * 0.15);
  const d = Math.max(1.6, t * 0.05);
  for (const [bx, by] of [[o, o], [t - o, o], [o, t - o - lip * 0.7], [t - o, t - o - lip * 0.7]]) {
    g.beginPath();
    g.arc(x + bx, y + by, d, 0, Math.PI * 2);
    g.fill();
  }
}

function drawExit(g, x, y, t, open, time) {
  const cx = x + t / 2;
  const cy = y + t / 2;
  const pulse = open ? 0.75 + Math.sin(time * 3.2) * 0.25 : 0.45;
  if (ready(IMG.exit)) {
    // pad nền tối + sprite khung xanh
    g.fillStyle = "rgba(8,16,10,0.55)";
    g.beginPath();
    g.roundRect(x + t * 0.08, y + t * 0.08, t * 0.84, t * 0.84, t * 0.1);
    g.fill();
    const w = t * 1.12;
    const h = w * (119 / 145);
    g.save();
    g.globalAlpha = open ? 0.9 + pulse * 0.1 : 0.55;
    if (open) {
      g.shadowColor = COL.green;
      g.shadowBlur = t * 0.3 * pulse;
    }
    g.drawImage(IMG.exit, cx - w / 2, cy - h / 2, w, h);
    g.restore();
  } else {
    const color = open ? COL.green : "rgba(80,225,130,0.75)";
    const m = t * 0.13;
    g.save();
    g.fillStyle = open ? `rgba(61,255,119,${0.1 + pulse * 0.08})` : "rgba(61,255,119,0.07)";
    g.beginPath();
    g.roundRect(x + m, y + m, t - m * 2, t - m * 2, t * 0.1);
    g.fill();
    g.shadowColor = COL.green;
    g.shadowBlur = t * 0.45 * pulse;
    g.strokeStyle = color;
    g.lineWidth = Math.max(2.4, t * 0.075);
    g.beginPath();
    g.roundRect(x + m, y + m, t - m * 2, t - m * 2, t * 0.1);
    g.stroke();
    g.lineWidth = Math.max(2, t * 0.055);
    g.beginPath();
    g.moveTo(cx, y + m * 2.1);
    g.lineTo(x + t - m * 2.1, cy);
    g.lineTo(cx, y + t - m * 2.1);
    g.lineTo(x + m * 2.1, cy);
    g.closePath();
    g.stroke();
    g.restore();
  }
  // tam giác chỉ xuống phía trên ô (chỉ khi mở)
  if (open) {
    const bob = Math.sin(time * 4) * t * 0.06;
    g.save();
    g.globalAlpha = 0.6 + Math.sin(time * 4) * 0.25;
    if (ready(IMG.exitTri)) {
      const w = t * 0.42;
      const h = w * (36 / 52);
      g.shadowColor = COL.green;
      g.shadowBlur = t * 0.2;
      g.drawImage(IMG.exitTri, cx - w / 2, y - t * 0.36 + bob, w, h);
    } else {
      g.shadowColor = COL.green;
      g.shadowBlur = t * 0.25;
      g.fillStyle = COL.green;
      g.beginPath();
      g.moveTo(cx - t * 0.16, y - t * 0.34 + bob);
      g.lineTo(cx + t * 0.16, y - t * 0.34 + bob);
      g.lineTo(cx, y - t * 0.13 + bob);
      g.closePath();
      g.fill();
    }
    g.restore();
  }
}

function drawSwitch(g, x, y, t, color, mode, active, time) {
  const cx = x + t / 2;
  const cy = y + t / 2;
  const c = color === "blue" ? COL.blue : COL.violet;
  const im = color === "blue" ? IMG.switchBlue : IMG.switchViolet;
  if (ready(im)) {
    const w = t * 0.96;
    const h = w * (70 / 83);
    g.save();
    if (active) {
      g.shadowColor = c;
      g.shadowBlur = t * 0.34;
    } else {
      g.globalAlpha = 0.82;
    }
    g.drawImage(im, cx - w / 2, cy - h / 2, w, h);
    g.restore();
    if (active) {
      g.strokeStyle = c;
      g.globalAlpha = 0.55 + Math.sin(time * 5) * 0.25;
      g.lineWidth = 1.8;
      g.beginPath();
      g.ellipse(cx, cy, t * 0.4, t * 0.32, 0, 0, Math.PI * 2);
      g.stroke();
      g.globalAlpha = 1;
    }
    void mode;
    return;
  }
  // fallback vector
  const r = t * 0.3;
  g.fillStyle = "#0a0f26";
  g.beginPath();
  g.arc(cx, cy, r * 1.32, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "rgba(120,150,230,0.5)";
  g.lineWidth = 1.6;
  g.stroke();
  g.save();
  g.shadowColor = c;
  g.shadowBlur = active ? t * 0.6 : t * 0.22;
  const core = g.createRadialGradient(cx - r * 0.2, cy - r * 0.2, r * 0.05, cx, cy, r * 0.85);
  core.addColorStop(0, "rgba(255,255,255,0.95)");
  core.addColorStop(0.35, c);
  core.addColorStop(1, color === "blue" ? "#123a8f" : "#3d1a80");
  g.fillStyle = core;
  g.globalAlpha = active ? 1 : 0.78;
  g.beginPath();
  g.arc(cx, cy, r * (active ? 0.8 : 0.66), 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 1;
  g.restore();
}

function drawPortal(g, x, y, t, color, time) {
  const c = color === "cyan" ? COL.cyan : COL.violet;
  const im = color === "cyan" ? IMG.portalCyan : IMG.portalViolet;
  if (ready(im)) {
    const w = t * (color === "cyan" ? 1.04 : 0.95);
    const h = w * (im.naturalHeight / im.naturalWidth);
    const dx = x + (t - w) / 2;
    const dy = y + t * 1.02 - h;
    g.save();
    g.shadowColor = c;
    g.shadowBlur = t * (0.16 + Math.sin(time * 2.4) * 0.05);
    g.drawImage(im, dx, dy, w, h);
    g.restore();
    // hạt sáng bay quanh vành (động)
    const cx = x + t / 2;
    const cy = dy + h * 0.42;
    const pa = time * 3 + (color === "cyan" ? 0 : 2);
    g.save();
    g.fillStyle = c;
    g.shadowColor = c;
    g.shadowBlur = 6;
    g.beginPath();
    g.arc(cx + Math.cos(pa) * t * 0.26, cy + Math.sin(pa) * t * 0.36, Math.max(1.5, t * 0.028), 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(cx + Math.cos(pa + 2.4) * t * 0.3, cy + Math.sin(pa + 2.4) * t * 0.3, Math.max(1.1, t * 0.02), 0, Math.PI * 2);
    g.fill();
    g.restore();
    return;
  }
  // fallback vector
  const cx = x + t / 2;
  const cy = y + t * 0.46;
  const cDark = color === "cyan" ? "#0a5566" : "#3a1a66";
  const rx = t * 0.24;
  const ry = t * 0.38;
  g.save();
  g.translate(cx, cy);
  const inner = g.createRadialGradient(0, 0, ry * 0.08, 0, 0, ry);
  inner.addColorStop(0, "#050814");
  inner.addColorStop(0.72, cDark);
  inner.addColorStop(1, c);
  g.fillStyle = inner;
  g.beginPath();
  g.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  g.fill();
  g.shadowColor = c;
  g.shadowBlur = t * 0.42;
  g.strokeStyle = c;
  g.lineWidth = Math.max(2.4, t * 0.075);
  g.beginPath();
  g.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  g.stroke();
  g.restore();
}

function drawCrate(g, x, y, t) {
  // bóng đổ (động theo kích thước ô)
  g.fillStyle = "rgba(0,0,10,0.4)";
  g.beginPath();
  g.ellipse(x + t / 2, y + t * 0.92, t * 0.4, t * 0.07, 0, 0, Math.PI * 2);
  g.fill();
  if (ready(IMG.crate)) {
    const w = t * 0.97;
    const h = w * (95 / 88);
    g.drawImage(IMG.crate, x + (t - w) / 2, y + t * 1.02 - h, w, h);
    return;
  }
  // fallback vector
  const m = t * 0.1;
  const s = t - m * 2;
  const r = t * 0.05;
  const grad = g.createLinearGradient(x, y, x, y + t);
  grad.addColorStop(0, COL.woodLight);
  grad.addColorStop(0.25, COL.wood);
  grad.addColorStop(1, COL.woodShade);
  g.fillStyle = grad;
  g.beginPath();
  g.roundRect(x + m, y + m, s, s, r);
  g.fill();
  const inset = m + Math.max(2.5, t * 0.055);
  const bw = Math.max(3, t * 0.12);
  g.strokeStyle = COL.woodDark;
  g.lineCap = "round";
  g.lineWidth = bw + 2;
  g.beginPath();
  g.moveTo(x + inset, y + inset);
  g.lineTo(x + t - inset, y + t - inset);
  g.moveTo(x + t - inset, y + inset);
  g.lineTo(x + inset, y + t - inset);
  g.stroke();
  g.strokeStyle = COL.woodLight;
  g.lineWidth = bw;
  g.beginPath();
  g.moveTo(x + inset, y + inset);
  g.lineTo(x + t - inset, y + t - inset);
  g.moveTo(x + t - inset, y + inset);
  g.lineTo(x + inset, y + t - inset);
  g.stroke();
  g.strokeStyle = COL.woodDark;
  g.lineWidth = Math.max(2.4, t * 0.075);
  g.beginPath();
  g.roundRect(x + m + 1, y + m + 1, s - 2, s - 2, r);
  g.stroke();
}

function drawEmitter(g, x, y, t, dir, on, time) {
  const cx = x + t / 2;
  const cy = y + t / 2;
  if (ready(IMG.emitter)) {
    const d = DIRS[dir];
    const ang = Math.atan2(d.y, d.x) - Math.PI / 2; // sprite gốc: mũi hướng XUỐNG
    g.save();
    g.translate(cx, cy);
    g.rotate(ang);
    if (on) {
      g.shadowColor = COL.red;
      g.shadowBlur = t * (0.24 + Math.sin(time * 8) * 0.08);
    } else {
      g.globalAlpha = 0.72;
    }
    const w = t * 0.92;
    const h = w * (67 / 72);
    g.drawImage(IMG.emitter, -w / 2, -h / 2, w, h);
    g.restore();
    return;
  }
  // fallback vector
  const m = t * 0.14;
  const s = t - m * 2;
  const grad = g.createLinearGradient(x, y, x, y + t);
  grad.addColorStop(0, "#4a1620");
  grad.addColorStop(1, "#22090f");
  g.fillStyle = grad;
  g.beginPath();
  g.roundRect(x + m, y + m, s, s, t * 0.08);
  g.fill();
  g.strokeStyle = on ? COL.red : "rgba(255,79,100,0.45)";
  g.lineWidth = Math.max(2, t * 0.05);
  g.stroke();
  const d = DIRS[dir];
  g.fillStyle = on ? COL.red : "rgba(255,79,100,0.4)";
  g.beginPath();
  g.roundRect(cx + d.x * t * 0.3 - t * 0.11, cy + d.y * t * 0.3 - t * 0.11, t * 0.22, t * 0.22, t * 0.04);
  g.fill();
  const lens = g.createRadialGradient(cx, cy, t * 0.02, cx, cy, t * 0.17);
  lens.addColorStop(0, on ? "#fff2f4" : "#8f4450");
  lens.addColorStop(1, on ? "#c01f30" : "#3a141c");
  g.fillStyle = lens;
  g.beginPath();
  g.arc(cx, cy, t * 0.17, 0, Math.PI * 2);
  g.fill();
}

function drawRobot(g, x, y, t, facing, time, dying) {
  const cx = x + t / 2;
  const bob = Math.sin(time * 3.4) * t * 0.03;
  // bóng + quầng cyan dưới chân (động)
  g.fillStyle = "rgba(0,0,12,0.45)";
  g.beginPath();
  g.ellipse(cx, y + t * 0.88, t * 0.3, t * 0.09, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "rgba(32,227,255,0.16)";
  g.beginPath();
  g.ellipse(cx, y + t * 0.88, t * 0.36, t * 0.12, 0, 0, Math.PI * 2);
  g.fill();
  if (ready(IMG.robot)) {
    const w = t * 0.86;
    const h = w * (98 / 82);
    g.save();
    if (dying) g.globalAlpha = 0.6;
    g.drawImage(IMG.robot, cx - w / 2, y + t * 0.94 - h + bob, w, h);
    g.restore();
    void facing;
    return;
  }
  // fallback vector
  const cy = y + t * 0.47 + bob;
  const w = t * 0.72;
  const h = t * 0.62;
  g.save();
  const grad = g.createLinearGradient(cx, cy - h / 2, cx, cy + h / 2);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(0.7, dying ? "#ffb3ba" : COL.robot);
  grad.addColorStop(1, "#c9d2ea");
  g.fillStyle = grad;
  g.beginPath();
  g.roundRect(cx - w / 2, cy - h / 2, w, h, t * 0.16);
  g.fill();
  const fx = (facing?.x || 0) * t * 0.05;
  const fy = (facing?.y || 0) * t * 0.04;
  g.fillStyle = "#0a1224";
  g.beginPath();
  g.roundRect(cx - w * 0.36 + fx, cy - h * 0.32 + fy, w * 0.72, h * 0.46, t * 0.1);
  g.fill();
  g.save();
  g.shadowColor = COL.cyan;
  g.shadowBlur = t * 0.2;
  g.fillStyle = COL.cyan;
  const er = t * 0.055;
  g.beginPath();
  g.ellipse(cx - w * 0.17 + fx, cy - h * 0.09 + fy, er, er, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(cx + w * 0.17 + fx, cy - h * 0.09 + fy, er, er, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
  g.restore();
}

/* ---------------- Renderer chính ---------------- */

export function createBoardRenderer(canvas, container) {
  const g = canvas.getContext("2d");
  let dpr = 1;
  let cw = 0;
  let ch = 0;
  let lastArgs = null;

  function fit() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cw = container.clientWidth;
    ch = container.clientHeight;
    canvas.width = Math.max(1, Math.round(cw * dpr));
    canvas.height = Math.max(1, Math.round(ch * dpr));
  }

  /** Trả về hình học ô hiện tại để index.js quy đổi tọa độ chạm. */
  function geometry(level) {
    const pad = 18;
    const t = Math.max(16, Math.min(76, Math.floor(Math.min((cw - pad * 2) / level.w, (ch - pad * 2) / level.h))));
    const ox = Math.floor((cw - t * level.w) / 2);
    const oy = Math.floor((ch - t * level.h) / 2);
    return { t, ox, oy };
  }

  // khung tĩnh (intro) vẽ trước khi ảnh decode xong → vẽ lại 1 lần khi sẵn sàng
  IMG_READY.then(() => {
    if (lastArgs && canvas.isConnected) draw(...lastArgs);
  });

  function draw(level, snap, fx, time) {
    lastArgs = [level, snap, fx, time];
    if (cw === 0) fit();
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, cw, ch);

    // nền ngoài board: nebula + chấm sao mờ
    g.fillStyle = COL.bgOut;
    g.fillRect(0, 0, cw, ch);
    const neb = g.createRadialGradient(cw * 0.5, ch * 0.4, 60, cw * 0.5, ch * 0.4, Math.max(cw, ch) * 0.7);
    neb.addColorStop(0, "rgba(50,70,160,0.1)");
    neb.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = neb;
    g.fillRect(0, 0, cw, ch);
    g.fillStyle = "rgba(120,150,230,0.14)";
    for (let i = 0; i < 60; i++) {
      const sx = ((i * 97) % 173) / 173 * cw;
      const sy = ((i * 61) % 149) / 149 * ch;
      const tw = 0.7 + Math.sin(time * 1.2 + i) * 0.3;
      g.globalAlpha = tw;
      g.fillRect(sx, sy, 1.6, 1.6);
    }
    g.globalAlpha = 1;

    const { t, ox, oy } = geometry(level);
    const px = (gx) => ox + gx * t;
    const py = (gy) => oy + gy * t;
    const bw = level.w * t;
    const bh = level.h * t;

    const beams = computeBeams(level, snap);
    const open = exitOpen(level, snap);

    // đế board: khối tối bo góc + viền kép
    g.save();
    g.shadowColor = "rgba(0,0,0,0.7)";
    g.shadowBlur = 26;
    g.shadowOffsetY = 10;
    g.fillStyle = "#0a1029";
    g.beginPath();
    g.roundRect(ox - 14, oy - 14, bw + 28, bh + 28, 18);
    g.fill();
    g.restore();

    // rim slab quanh board (texture từ ảnh) — như phiến đá viền trong reference
    if (ready(IMG.wallStrip)) {
      const sh = Math.max(8, t * 0.3);
      const sw = sh * (132 / 55);
      g.save();
      g.beginPath();
      g.roundRect(ox - sh - 2, oy - sh - 2, bw + sh * 2 + 4, bh + sh * 2 + 4, 14);
      g.clip();
      for (let sx2 = ox - sh - 2; sx2 < ox + bw + sh; sx2 += sw) {
        g.drawImage(IMG.wallStrip, sx2, oy - sh - 2, sw, sh);
        g.drawImage(IMG.wallStrip, sx2, oy + bh + 2, sw, sh);
      }
      // hai cạnh đứng (xoay 90°)
      g.translate(ox - 2, oy - 2);
      g.rotate(Math.PI / 2);
      for (let k = -sh; k < bh + sh; k += sw) g.drawImage(IMG.wallStrip, k, 0, sw, sh);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.translate(ox + bw + 2 + sh, oy - 2);
      g.rotate(Math.PI / 2);
      for (let k = -sh; k < bh + sh; k += sw) g.drawImage(IMG.wallStrip, k, 0, sw, sh);
      g.restore();
    } else {
      g.strokeStyle = "rgba(90,110,180,0.7)";
      g.lineWidth = 2;
      g.beginPath();
      g.roundRect(ox - 14, oy - 14, bw + 28, bh + 28, 18);
      g.stroke();
    }
    g.strokeStyle = "rgba(40,55,110,0.9)";
    g.lineWidth = 1.2;
    g.beginPath();
    g.roundRect(ox - 9, oy - 9, bw + 18, bh + 18, 13);
    g.stroke();

    // vạch neon trang trí quanh chân board (cyan / hồng / tím như ảnh)
    const deco = [
      [0.06, 0.16, COL.cyan], [0.2, 0.07, "#ff2ee6"], [0.34, 0.1, COL.violet],
      [0.52, 0.14, COL.cyan], [0.7, 0.08, "#ff2ee6"], [0.84, 0.11, COL.cyan],
    ];
    g.lineCap = "round";
    for (const [k, len, c] of deco) {
      g.strokeStyle = c;
      g.globalAlpha = 0.5 + Math.sin(time * 2 + k * 20) * 0.2;
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(ox + bw * k, oy + bh + 22);
      g.lineTo(ox + bw * (k + len), oy + bh + 22);
      g.stroke();
      g.beginPath();
      g.moveTo(ox + bw * (k + 0.03), oy - 22);
      g.lineTo(ox + bw * (k + len - 0.02), oy - 22);
      g.stroke();
    }
    g.globalAlpha = 1;

    // sàn + tường
    for (let y = 0; y < level.h; y++) {
      for (let x = 0; x < level.w; x++) {
        const s = level.solid[y * level.w + x];
        if (s === 2) continue; // void
        if (s === 1) drawWall(g, px(x), py(y), t);
        else drawFloor(g, px(x), py(y), t, (x + y) % 2 === 0);
      }
    }

    // nét đứt nối cặp cổng (như ảnh)
    g.save();
    const seen = new Set();
    for (let i = 0; i < level.portals.length; i++) {
      const p = level.portals[i];
      if (seen.has(i) || seen.has(p.pair)) continue;
      seen.add(i);
      const q = level.portals[p.pair];
      const c = p.color === "cyan" ? COL.cyan : COL.violet;
      g.strokeStyle = c;
      g.shadowColor = c;
      g.shadowBlur = 6;
      g.globalAlpha = 0.55;
      g.setLineDash([Math.max(5, t * 0.14), Math.max(7, t * 0.18)]);
      g.lineDashOffset = -time * 26;
      g.lineWidth = Math.max(2.4, t * 0.05);
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(px(p.x) + t / 2, py(p.y) + t / 2);
      g.lineTo(px(q.x) + t / 2, py(q.y) + t / 2);
      g.stroke();
    }
    g.restore();

    // ô thoát
    drawExit(g, px(level.exit.x), py(level.exit.y), t, open, time);

    // công tắc
    for (const sw of level.switches) {
      let active;
      if (sw.mode === "toggle") {
        let ti = 0;
        for (const other of level.switches) {
          if (other.mode !== "toggle") continue;
          if (other === sw) break;
          ti++;
        }
        active = snap.toggles[ti];
      } else {
        active =
          (snap.player.x === sw.x && snap.player.y === sw.y) ||
          snap.crates.some((c) => c.x === sw.x && c.y === sw.y);
      }
      drawSwitch(g, px(sw.x), py(sw.y), t, sw.color, sw.mode, active, time);
    }

    // cổng
    for (const p of level.portals) drawPortal(g, px(p.x), py(p.y), t, p.color, time);

    // tia laser (vẽ dưới thùng để thùng che tia)
    for (const l of level.lasers) {
      const on = !(l.off && colorActive(level, snap, l.off));
      if (on) {
        const d = DIRS[l.dir];
        let bx = l.x + d.x;
        let by = l.y + d.y;
        let len = 0;
        while (beams.has(by * level.w + bx)) {
          len++;
          bx += d.x;
          by += d.y;
        }
        if (len > 0) {
          const x0 = px(l.x) + t / 2 + d.x * t * 0.34;
          const y0 = py(l.y) + t / 2 + d.y * t * 0.34;
          const x1 = px(l.x + d.x * len) + t / 2 + d.x * t * 0.5;
          const y1 = py(l.y + d.y * len) + t / 2 + d.y * t * 0.5;
          const flick = 0.78 + Math.sin(time * 26) * 0.12;
          g.save();
          g.lineCap = "round";
          g.strokeStyle = `rgba(255,42,63,${0.16 * flick})`;
          g.lineWidth = t * 0.5;
          g.beginPath();
          g.moveTo(x0, y0);
          g.lineTo(x1, y1);
          g.stroke();
          g.strokeStyle = `rgba(255,42,63,${0.32 * flick})`;
          g.lineWidth = t * 0.26;
          g.beginPath();
          g.moveTo(x0, y0);
          g.lineTo(x1, y1);
          g.stroke();
          g.shadowColor = COL.red;
          g.shadowBlur = t * 0.3;
          g.strokeStyle = `rgba(255,64,84,${0.92 * flick})`;
          g.lineWidth = t * 0.12;
          g.beginPath();
          g.moveTo(x0, y0);
          g.lineTo(x1, y1);
          g.stroke();
          g.shadowBlur = 0;
          g.strokeStyle = `rgba(255,244,246,${0.95 * flick})`;
          g.lineWidth = Math.max(1.6, t * 0.045);
          g.beginPath();
          g.moveTo(x0, y0);
          g.lineTo(x1, y1);
          g.stroke();
          const k = ((time * 1.6) % 1);
          g.fillStyle = "rgba(255,255,255,0.9)";
          g.beginPath();
          g.arc(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, Math.max(1.8, t * 0.045), 0, Math.PI * 2);
          g.fill();
          g.restore();
        }
      }
      drawEmitter(g, px(l.x), py(l.y), t, l.dir, on, time);
    }

    // thùng
    for (const c of snap.crates) drawCrate(g, px(c.x), py(c.y), t);

    // hiệu ứng teleport
    for (const tp of fx.teleports) {
      const k = (time - tp.t0) / 0.45;
      if (k > 1) continue;
      const c = tp.color === "cyan" ? COL.cyan : COL.violet;
      g.strokeStyle = c;
      g.globalAlpha = (1 - k) * 0.85;
      g.lineWidth = 2.6;
      g.beginPath();
      g.arc(px(tp.x) + t / 2, py(tp.y) + t / 2, t * (0.2 + k * 0.55), 0, Math.PI * 2);
      g.stroke();
      g.globalAlpha = 1;
    }

    // robot (kèm animation trượt + rung khi bị chặn)
    let rx = snap.player.x;
    let ry = snap.player.y;
    if (fx.moveAnim) {
      const k = Math.min(1, (time - fx.moveAnim.t0) / 0.09);
      rx = fx.moveAnim.fx + (snap.player.x - fx.moveAnim.fx) * k;
      ry = fx.moveAnim.fy + (snap.player.y - fx.moveAnim.fy) * k;
      if (k >= 1) fx.moveAnim = null;
    }
    let shakeX = 0;
    let shakeY = 0;
    if (fx.deny && time - fx.deny.t0 < 0.24) {
      const kk = (time - fx.deny.t0) / 0.24;
      const amp = Math.sin(kk * Math.PI * 4) * (1 - kk) * t * 0.07;
      shakeX = fx.deny.dx * amp;
      shakeY = fx.deny.dy * amp;
    }
    drawRobot(g, px(rx) + shakeX, py(ry) + shakeY, t, fx.facing, time, false);

    // mũi tên gợi ý
    if (fx.hint && time < fx.hint.until) {
      const d = DIRS[fx.hint.dir];
      const hx = px(snap.player.x + d.x) + t / 2;
      const hy = py(snap.player.y + d.y) + t / 2;
      const a = 0.55 + Math.sin(time * 6) * 0.35;
      g.save();
      g.translate(hx, hy);
      g.rotate(Math.atan2(d.y, d.x));
      g.fillStyle = `rgba(168,255,62,${a})`;
      g.shadowColor = COL.lime;
      g.shadowBlur = 10;
      g.beginPath();
      g.moveTo(t * 0.22, 0);
      g.lineTo(-t * 0.1, -t * 0.2);
      g.lineTo(-t * 0.1, t * 0.2);
      g.closePath();
      g.fill();
      g.restore();
    }
  }

  return { fit, geometry, draw };
}

/* ---------------- Icon chú giải sidebar (canvas nhỏ) ---------------- */

const LEGEND_SPRITE = {
  player: "robot",
  crate: "crate",
  "switch-blue": "switchBlue",
  "switch-violet": "switchViolet",
  "portal-cyan": "portalCyan",
  "portal-violet": "portalViolet",
  laser: "emitter",
  exit: "exit",
};

export function paintLegendIcon(canvas, kind) {
  const size = 26;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  const g = canvas.getContext("2d");
  g.scale(dpr, dpr);
  const t = size;
  const im = IMG[LEGEND_SPRITE[kind]];
  if (ready(im)) {
    // fit-contain sprite vào canvas
    const k = Math.min(size / im.naturalWidth, size / im.naturalHeight);
    const w = im.naturalWidth * k;
    const h = im.naturalHeight * k;
    g.drawImage(im, (size - w) / 2, (size - h) / 2, w, h);
    return;
  }
  // sprite chưa decode xong: vẽ fallback vector rồi vẽ lại khi sẵn sàng
  if (!canvas.__ppRetry) {
    canvas.__ppRetry = true;
    IMG_READY.then(() => {
      if (canvas.isConnected) paintLegendIcon(canvas, kind);
    });
  }
  switch (kind) {
    case "player":
      drawRobot(g, 0, 0, t, { x: 0, y: 0 }, 1.2, false);
      break;
    case "crate":
      drawCrate(g, 0, 0, t);
      break;
    case "switch-blue":
      drawSwitch(g, 0, 0, t, "blue", "hold", true, 1);
      break;
    case "switch-violet":
      drawSwitch(g, 0, 0, t, "violet", "hold", true, 1);
      break;
    case "portal-cyan":
      drawPortal(g, 0, 0, t, "cyan", 1.1);
      break;
    case "portal-violet":
      drawPortal(g, 0, 0, t, "violet", 2.3);
      break;
    case "laser":
      drawEmitter(g, 0, 0, t, "D", true, 1);
      break;
    case "exit":
      drawExit(g, 0, 0, t, true, 1.3);
      break;
  }
}
