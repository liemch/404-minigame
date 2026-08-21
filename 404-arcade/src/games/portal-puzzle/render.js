/**
 * render.js — vẽ board Portal Puzzle 404 bằng Canvas 2D theo ảnh
 * reference: phiến đá navy bevel lớn, tường slab slate có đinh tán,
 * robot trắng mắt cyan, thùng gỗ ván chéo 3D, công tắc tròn phát sáng
 * xanh/tím, cổng dịch chuyển ĐỨNG có khung kim loại nối nhau bằng nét
 * đứt, laser đỏ lõi trắng glow mạnh, ô thoát xanh lá rực, viền neon
 * cyan/hồng chạy quanh chân board.
 */

import { DIRS, computeBeams, exitOpen, colorActive } from "./engine.js";

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
  // mạch tối giữa các phiến đá
  g.fillStyle = COL.grout;
  g.fillRect(x, y, t, t);
  const gap = Math.max(1.5, t * 0.045);
  const s = t - gap * 2;
  const r = t * 0.09;
  g.fillStyle = alt ? COL.floorA : COL.floorB;
  g.beginPath();
  g.roundRect(x + gap, y + gap, s, s, r);
  g.fill();
  // gradient khối nhẹ (sáng góc trên trái)
  const grad = g.createLinearGradient(x, y, x + t, y + t);
  grad.addColorStop(0, "rgba(150,180,255,0.05)");
  grad.addColorStop(0.5, "rgba(150,180,255,0)");
  grad.addColorStop(1, "rgba(0,0,12,0.2)");
  g.fillStyle = grad;
  g.beginPath();
  g.roundRect(x + gap, y + gap, s, s, r);
  g.fill();
  // highlight mảnh cạnh trên
  g.fillStyle = "rgba(160,190,255,0.07)";
  g.beginPath();
  g.roundRect(x + gap, y + gap, s, Math.max(2, t * 0.06), r);
  g.fill();
  // bóng đổ cạnh dưới
  g.fillStyle = "rgba(0,0,14,0.26)";
  g.beginPath();
  g.roundRect(x + gap, y + gap + s - Math.max(2, t * 0.08), s, Math.max(2, t * 0.08), r * 0.7);
  g.fill();
}

function drawWall(g, x, y, t) {
  // nền tối
  g.fillStyle = COL.wallDark;
  g.fillRect(x, y, t, t);
  const gap = Math.max(1, t * 0.03);
  const s = t - gap * 2;
  const r = t * 0.12;
  const lip = Math.max(3, t * 0.2); // mặt bên lộ phía dưới
  // mặt bên (tối hơn, lộ dưới)
  g.fillStyle = COL.wallFace;
  g.beginPath();
  g.roundRect(x + gap, y + gap + lip * 0.4, s, s - lip * 0.4, r);
  g.fill();
  // mặt trên (slate sáng)
  const grad = g.createLinearGradient(x, y, x, y + t);
  grad.addColorStop(0, COL.wallTopHi);
  grad.addColorStop(1, COL.wallTop);
  g.fillStyle = grad;
  g.beginPath();
  g.roundRect(x + gap, y + gap, s, s - lip, r);
  g.fill();
  // viền sáng mảnh trên mặt
  g.strokeStyle = "rgba(190,210,255,0.22)";
  g.lineWidth = 1;
  g.beginPath();
  g.roundRect(x + gap + 1, y + gap + 1, s - 2, s - lip - 2, r * 0.8);
  g.stroke();
  // đinh tán 4 góc mặt trên
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
  const color = open ? COL.green : "rgba(80,225,130,0.75)";
  const m = t * 0.13;
  g.save();
  // pad nền xanh mờ
  g.fillStyle = open ? `rgba(61,255,119,${0.1 + pulse * 0.08})` : "rgba(61,255,119,0.07)";
  g.beginPath();
  g.roundRect(x + m, y + m, t - m * 2, t - m * 2, t * 0.1);
  g.fill();
  g.shadowColor = COL.green;
  g.shadowBlur = t * 0.45 * pulse;
  // khung ngoài
  g.strokeStyle = color;
  g.lineWidth = Math.max(2.4, t * 0.075);
  g.beginPath();
  g.roundRect(x + m, y + m, t - m * 2, t - m * 2, t * 0.1);
  g.stroke();
  // kim cương lồng nhau
  g.lineWidth = Math.max(2, t * 0.055);
  g.beginPath();
  g.moveTo(cx, y + m * 2.1);
  g.lineTo(x + t - m * 2.1, cy);
  g.lineTo(cx, y + t - m * 2.1);
  g.lineTo(x + m * 2.1, cy);
  g.closePath();
  g.stroke();
  // lõi kim cương đặc
  g.fillStyle = color;
  const d = t * 0.1;
  g.beginPath();
  g.moveTo(cx, cy - d * 1.4);
  g.lineTo(cx + d * 1.4, cy);
  g.lineTo(cx, cy + d * 1.4);
  g.lineTo(cx - d * 1.4, cy);
  g.closePath();
  g.fill();
  g.restore();
  // tam giác chỉ xuống phía trên ô (chỉ khi mở)
  if (open) {
    const bob = Math.sin(time * 4) * t * 0.06;
    g.save();
    g.shadowColor = COL.green;
    g.shadowBlur = t * 0.25;
    g.fillStyle = `rgba(61,255,119,${0.6 + Math.sin(time * 4) * 0.25})`;
    g.beginPath();
    g.moveTo(cx - t * 0.16, y - t * 0.34 + bob);
    g.lineTo(cx + t * 0.16, y - t * 0.34 + bob);
    g.lineTo(cx, y - t * 0.13 + bob);
    g.closePath();
    g.fill();
    g.restore();
  }
}

function drawSwitch(g, x, y, t, color, mode, active, time) {
  const cx = x + t / 2;
  const cy = y + t / 2;
  const c = color === "blue" ? COL.blue : COL.violet;
  const r = t * 0.3;
  // đế kim loại tối
  g.fillStyle = "#0a0f26";
  g.beginPath();
  if (mode === "toggle") {
    const rr = r * 1.3;
    g.roundRect(cx - rr, cy - rr, rr * 2, rr * 2, rr * 0.32);
  } else {
    g.arc(cx, cy, r * 1.32, 0, Math.PI * 2);
  }
  g.fill();
  g.strokeStyle = "rgba(120,150,230,0.5)";
  g.lineWidth = 1.6;
  g.stroke();
  // 4 vấu nhỏ trên đế
  g.fillStyle = "rgba(120,150,230,0.35)";
  for (let i = 0; i < 4; i++) {
    const a = (Math.PI / 2) * i + Math.PI / 4;
    g.beginPath();
    g.arc(cx + Math.cos(a) * r * 1.12, cy + Math.sin(a) * r * 1.12, Math.max(1.2, t * 0.03), 0, Math.PI * 2);
    g.fill();
  }
  // lõi phát sáng
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
  if (active) {
    g.strokeStyle = c;
    g.globalAlpha = 0.55 + Math.sin(time * 5) * 0.25;
    g.lineWidth = 1.8;
    g.beginPath();
    g.arc(cx, cy, r * 1.14, 0, Math.PI * 2);
    g.stroke();
    g.globalAlpha = 1;
  }
}

function drawPortal(g, x, y, t, color, time) {
  const cx = x + t / 2;
  const cy = y + t * 0.46;
  const c = color === "cyan" ? COL.cyan : COL.violet;
  const cDark = color === "cyan" ? "#0a5566" : "#3a1a66";
  const rx = t * 0.24;
  const ry = t * 0.38;
  g.save();
  // đế kim loại
  g.fillStyle = "#0c1230";
  g.beginPath();
  g.roundRect(cx - t * 0.33, y + t * 0.8, t * 0.66, t * 0.13, t * 0.03);
  g.fill();
  g.strokeStyle = `rgba(120,150,230,0.4)`;
  g.lineWidth = 1.2;
  g.stroke();
  g.fillStyle = c;
  g.globalAlpha = 0.7;
  g.fillRect(cx - t * 0.22, y + t * 0.845, t * 0.44, Math.max(1.5, t * 0.03));
  g.globalAlpha = 1;

  g.translate(cx, cy);
  // hào quang phía sau
  const halo = g.createRadialGradient(0, 0, ry * 0.2, 0, 0, ry * 1.35);
  halo.addColorStop(0, `${c}55`);
  halo.addColorStop(1, `${c}00`);
  g.fillStyle = halo;
  g.beginPath();
  g.ellipse(0, 0, rx * 2, ry * 1.35, 0, 0, Math.PI * 2);
  g.fill();
  // lòng cổng tối + xoáy màu
  const inner = g.createRadialGradient(0, 0, ry * 0.08, 0, 0, ry);
  inner.addColorStop(0, "#050814");
  inner.addColorStop(0.72, cDark);
  inner.addColorStop(1, c);
  g.fillStyle = inner;
  g.beginPath();
  g.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  g.fill();
  // vòng ngoài phát sáng kép
  g.shadowColor = c;
  g.shadowBlur = t * 0.42;
  g.strokeStyle = c;
  g.lineWidth = Math.max(2.4, t * 0.075);
  g.beginPath();
  g.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  g.stroke();
  g.shadowBlur = 0;
  g.strokeStyle = "rgba(255,255,255,0.8)";
  g.lineWidth = Math.max(1, t * 0.02);
  g.beginPath();
  g.ellipse(0, 0, rx * 0.82, ry * 0.85, 0, 0, Math.PI * 2);
  g.stroke();
  // xoáy bên trong
  g.strokeStyle = "rgba(255,255,255,0.55)";
  g.lineWidth = 1.4;
  for (let i = 0; i < 2; i++) {
    const a = time * 2.6 + i * Math.PI;
    g.beginPath();
    g.ellipse(0, 0, rx * 0.5, ry * 0.52, 0, a, a + Math.PI * 0.9);
    g.stroke();
  }
  // hạt sáng bay quanh
  const pa = time * 3 + (color === "cyan" ? 0 : 2);
  g.fillStyle = c;
  g.shadowColor = c;
  g.shadowBlur = 6;
  g.beginPath();
  g.arc(Math.cos(pa) * rx * 1.05, Math.sin(pa) * ry * 1.02, Math.max(1.6, t * 0.032), 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.arc(Math.cos(pa + 2.4) * rx * 1.15, Math.sin(pa + 2.4) * ry * 0.9, Math.max(1.2, t * 0.022), 0, Math.PI * 2);
  g.fill();
  g.restore();
}

function drawCrate(g, x, y, t) {
  const m = t * 0.1;
  const s = t - m * 2;
  const r = t * 0.05;
  // bóng đổ
  g.fillStyle = "rgba(0,0,10,0.4)";
  g.beginPath();
  g.ellipse(x + t / 2, y + t - m * 0.6, s * 0.5, t * 0.07, 0, 0, Math.PI * 2);
  g.fill();
  // thân gỗ với gradient
  const grad = g.createLinearGradient(x, y, x, y + t);
  grad.addColorStop(0, COL.woodLight);
  grad.addColorStop(0.25, COL.wood);
  grad.addColorStop(1, COL.woodShade);
  g.fillStyle = grad;
  g.beginPath();
  g.roundRect(x + m, y + m, s, s, r);
  g.fill();
  // vân gỗ ngang mờ
  g.strokeStyle = "rgba(60,36,10,0.35)";
  g.lineWidth = 1;
  for (let i = 1; i <= 3; i++) {
    const yy = y + m + (s * i) / 4;
    g.beginPath();
    g.moveTo(x + m + 2, yy);
    g.lineTo(x + m + s - 2, yy);
    g.stroke();
  }
  // ván chéo chữ X (sáng, có viền tối)
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
  // khung viền ngoài
  g.strokeStyle = COL.woodDark;
  g.lineWidth = Math.max(2.4, t * 0.075);
  g.beginPath();
  g.roundRect(x + m + 1, y + m + 1, s - 2, s - 2, r);
  g.stroke();
  g.strokeStyle = "rgba(230,180,120,0.5)";
  g.lineWidth = 1;
  g.beginPath();
  g.roundRect(x + m + Math.max(3, t * 0.09), y + m + Math.max(3, t * 0.09), s - Math.max(6, t * 0.18), s - Math.max(6, t * 0.18), r * 0.6);
  g.stroke();
  // đinh 4 góc
  g.fillStyle = "#2c1c08";
  const o = m + Math.max(3, t * 0.075);
  for (const [bx, by] of [[o, o], [t - o, o], [o, t - o], [t - o, t - o]]) {
    g.beginPath();
    g.arc(x + bx, y + by, Math.max(1.4, t * 0.035), 0, Math.PI * 2);
    g.fill();
  }
  // bóng sáng đỉnh
  g.fillStyle = "rgba(255,235,200,0.2)";
  g.beginPath();
  g.roundRect(x + m, y + m, s, Math.max(2, t * 0.06), r);
  g.fill();
}

function drawEmitter(g, x, y, t, dir, on, time) {
  const cx = x + t / 2;
  const cy = y + t / 2;
  const m = t * 0.14;
  const s = t - m * 2;
  // thân khối kim loại đỏ sẫm
  const grad = g.createLinearGradient(x, y, x, y + t);
  grad.addColorStop(0, "#4a1620");
  grad.addColorStop(1, "#22090f");
  g.fillStyle = grad;
  g.beginPath();
  g.roundRect(x + m, y + m, s, s, t * 0.08);
  g.fill();
  g.strokeStyle = on ? COL.red : "rgba(255,79,100,0.45)";
  g.lineWidth = Math.max(2, t * 0.05);
  if (on) {
    g.save();
    g.shadowColor = COL.red;
    g.shadowBlur = t * 0.28;
    g.stroke();
    g.restore();
  } else {
    g.stroke();
  }
  // sọc cảnh báo 2 bên
  g.fillStyle = on ? "rgba(255,110,120,0.85)" : "rgba(255,110,120,0.35)";
  g.fillRect(x + m + 2, y + m + 2, s - 4, Math.max(1.5, t * 0.045));
  // vấu hướng bắn
  const d = DIRS[dir];
  g.fillStyle = on ? COL.red : "rgba(255,79,100,0.4)";
  g.beginPath();
  g.roundRect(cx + d.x * t * 0.3 - t * 0.11, cy + d.y * t * 0.3 - t * 0.11, t * 0.22, t * 0.22, t * 0.04);
  g.fill();
  // thấu kính phát sáng
  g.save();
  if (on) {
    g.shadowColor = COL.red;
    g.shadowBlur = t * (0.4 + Math.sin(time * 8) * 0.12);
  }
  const lens = g.createRadialGradient(cx, cy, t * 0.02, cx, cy, t * 0.17);
  lens.addColorStop(0, on ? "#fff2f4" : "#8f4450");
  lens.addColorStop(0.55, on ? "#ff8391" : "#5d2733");
  lens.addColorStop(1, on ? "#c01f30" : "#3a141c");
  g.fillStyle = lens;
  g.beginPath();
  g.arc(cx, cy, t * 0.17, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

function drawRobot(g, x, y, t, facing, time, dying) {
  const cx = x + t / 2;
  const bob = Math.sin(time * 3.4) * t * 0.03;
  const cy = y + t * 0.47 + bob;
  const w = t * 0.72;
  const h = t * 0.62;
  g.save();
  // bóng + quầng cyan dưới chân
  g.fillStyle = "rgba(0,0,12,0.45)";
  g.beginPath();
  g.ellipse(cx, y + t * 0.88, t * 0.3, t * 0.09, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "rgba(32,227,255,0.16)";
  g.beginPath();
  g.ellipse(cx, y + t * 0.88, t * 0.36, t * 0.12, 0, 0, Math.PI * 2);
  g.fill();
  // chân
  g.fillStyle = "#aeb9d8";
  g.beginPath();
  g.roundRect(cx - w * 0.34, cy + h * 0.32, w * 0.24, t * 0.18, t * 0.05);
  g.fill();
  g.beginPath();
  g.roundRect(cx + w * 0.1, cy + h * 0.32, w * 0.24, t * 0.18, t * 0.05);
  g.fill();
  // tai / vai
  g.fillStyle = "#c3cde8";
  g.beginPath();
  g.roundRect(cx - w * 0.64, cy - h * 0.2, w * 0.16, h * 0.4, t * 0.05);
  g.fill();
  g.beginPath();
  g.roundRect(cx + w * 0.48, cy - h * 0.2, w * 0.16, h * 0.4, t * 0.05);
  g.fill();
  // thân trắng với gradient
  const grad = g.createLinearGradient(cx, cy - h / 2, cx, cy + h / 2);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(0.7, dying ? "#ffb3ba" : COL.robot);
  grad.addColorStop(1, "#c9d2ea");
  g.fillStyle = grad;
  g.beginPath();
  g.roundRect(cx - w / 2, cy - h / 2, w, h, t * 0.16);
  g.fill();
  g.strokeStyle = "rgba(90,110,160,0.4)";
  g.lineWidth = 1;
  g.stroke();
  // anten
  g.strokeStyle = "#c3cde8";
  g.lineWidth = Math.max(1.5, t * 0.035);
  g.beginPath();
  g.moveTo(cx, cy - h / 2);
  g.lineTo(cx, cy - h / 2 - t * 0.1);
  g.stroke();
  g.fillStyle = COL.cyan;
  g.save();
  g.shadowColor = COL.cyan;
  g.shadowBlur = t * 0.14;
  g.beginPath();
  g.arc(cx, cy - h / 2 - t * 0.12, Math.max(1.6, t * 0.04), 0, Math.PI * 2);
  g.fill();
  g.restore();
  // visor
  const fx = (facing?.x || 0) * t * 0.05;
  const fy = (facing?.y || 0) * t * 0.04;
  g.fillStyle = "#0a1224";
  g.beginPath();
  g.roundRect(cx - w * 0.36 + fx, cy - h * 0.32 + fy, w * 0.72, h * 0.46, t * 0.1);
  g.fill();
  // mắt cyan tròn phát sáng
  g.save();
  g.shadowColor = COL.cyan;
  g.shadowBlur = t * 0.2;
  g.fillStyle = COL.cyan;
  const blink = Math.sin(time * 1.7) > 0.97 ? 0.3 : 1;
  const er = t * 0.055;
  g.beginPath();
  g.ellipse(cx - w * 0.17 + fx, cy - h * 0.09 + fy, er, er * blink, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(cx + w * 0.17 + fx, cy - h * 0.09 + fy, er, er * blink, 0, 0, Math.PI * 2);
  g.fill();
  // miệng nhỏ
  g.fillRect(cx - w * 0.08 + fx, cy + h * 0.02 + fy, w * 0.16, Math.max(1.2, t * 0.025));
  g.restore();
  // ngực đèn nhỏ
  g.fillStyle = "rgba(90,110,160,0.5)";
  g.fillRect(cx - w * 0.1, cy + h * 0.26, w * 0.2, Math.max(1.2, t * 0.03));
  g.restore();
}

/* ---------------- Renderer chính ---------------- */

export function createBoardRenderer(canvas, container) {
  const g = canvas.getContext("2d");
  let dpr = 1;
  let cw = 0;
  let ch = 0;

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

  function draw(level, snap, fx, time) {
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
    g.strokeStyle = "rgba(90,110,180,0.7)";
    g.lineWidth = 2;
    g.beginPath();
    g.roundRect(ox - 14, oy - 14, bw + 28, bh + 28, 18);
    g.stroke();
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
          // quầng ngoài rộng
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
          // thân tia
          g.shadowColor = COL.red;
          g.shadowBlur = t * 0.3;
          g.strokeStyle = `rgba(255,64,84,${0.92 * flick})`;
          g.lineWidth = t * 0.12;
          g.beginPath();
          g.moveTo(x0, y0);
          g.lineTo(x1, y1);
          g.stroke();
          g.shadowBlur = 0;
          // lõi trắng
          g.strokeStyle = `rgba(255,244,246,${0.95 * flick})`;
          g.lineWidth = Math.max(1.6, t * 0.045);
          g.beginPath();
          g.moveTo(x0, y0);
          g.lineTo(x1, y1);
          g.stroke();
          // hạt sáng chạy dọc tia
          const dist = Math.hypot(x1 - x0, y1 - y0);
          const k = ((time * 1.6) % 1);
          g.fillStyle = "rgba(255,255,255,0.9)";
          g.beginPath();
          g.arc(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, Math.max(1.8, t * 0.045), 0, Math.PI * 2);
          g.fill();
          void dist;
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

export function paintLegendIcon(canvas, kind) {
  const size = 26;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  const g = canvas.getContext("2d");
  g.scale(dpr, dpr);
  const t = size;
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
