/**
 * render.js — vẽ thế giới Neon Drift 404.
 *
 * Đồ họa chính dùng SPRITE cắt từ ảnh tham chiếu neon-drift-404.png
 * (assets.js): xe người chơi neon, xe cản vàng, pickup lục giác, trụ +
 * banner + rào ca-rô của cổng CHECKPOINT, mảng nhà neon ốp vào decor,
 * asphalt làm pattern mặt đường. Khi ảnh chưa decode xong, mỗi painter
 * fallback về nét vẽ vector cũ. Phần ĐỘNG (vệt drift, lửa nitro, tia
 * lửa, vạch giữa chạy, minimap, mép neon đường) vẫn vẽ code.
 */

import { seededRand } from "../../core/utils.js";
import { TRACK_WIDTH, HALF_W } from "./track.js";
import { loadImages, ready } from "./assets.js";

const IMG = loadImages();
let assetsReady = false;
Promise.allSettled(Object.values(IMG).map((im) => (im.decode ? im.decode().catch(() => {}) : null))).then(() => {
  assetsReady = true;
});

const ROAD = "#15121f";
const ROAD_EDGE_PINK = "#ff2ee6";
const ROAD_EDGE_CYAN = "#20e3ff";
const LIME = "#a8ff3e";

const STATIC_SCALE = 1.6;

export function createDriftRenderer(canvas, container, track) {
  const g = canvas.getContext("2d");
  let dpr = 1;
  let W = 0;
  let H = 0;
  let staticLayer = null;
  let staticW = 0;
  let staticH = 0;

  function fit() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = container.clientWidth;
    H = container.clientHeight;
    canvas.width = Math.max(1, Math.round(W * dpr));
    canvas.height = Math.max(1, Math.round(H * dpr));
  }

  function zoom() {
    // Zoom sát như ảnh reference: mặt đường chiếm ~1/3 chiều cao màn hình
    return Math.max(1.1, Math.min(2.0, Math.min(W, H) / 480));
  }

  /* ---------- lớp TĨNH pre-render (decor + đường + mép neon + mũi tên) ----------
     Vẽ một lần vào offscreen canvas — mỗi frame chỉ drawImage, giữ 60 FPS. */

  let staticOX = 0;
  let staticOY = 0;
  let staticWithAssets = false;

  function buildStatic() {
    const b = track.decorBounds || { x0: 0, y0: 0, x1: track.bbox.maxX + 90, y1: track.bbox.maxY + 90 };
    staticOX = b.x0;
    staticOY = b.y0;
    staticW = b.x1 - b.x0;
    staticH = b.y1 - b.y0;
    staticLayer = document.createElement("canvas");
    staticLayer.width = Math.round(staticW * STATIC_SCALE);
    staticLayer.height = Math.round(staticH * STATIC_SCALE);
    const s = staticLayer.getContext("2d");
    s.scale(STATIC_SCALE, STATIC_SCALE);
    s.translate(-staticOX, -staticOY);
    staticWithAssets = assetsReady;

    // decor thành phố: ốp texture nhà neon cắt từ ảnh tham chiếu
    const useBldg = ready(IMG.bldgA) && ready(IMG.bldgB) && ready(IMG.bldgC);
    const wrand = seededRand(1313);
    for (const b of track.decor) {
      // bóng khối
      s.fillStyle = "rgba(0,0,0,0.5)";
      s.fillRect(b.x + 5, b.y + 6, b.w, b.h);
      if (useBldg) {
        const pick = [IMG.bldgA, IMG.bldgB, IMG.bldgC][Math.floor(wrand() * 3)];
        // cover-fit: crop texture giữ tỉ lệ, không méo cửa sổ
        const k = Math.max(b.w / pick.naturalWidth, b.h / pick.naturalHeight);
        const sw2 = b.w / k;
        const sh2 = b.h / k;
        s.drawImage(pick, (pick.naturalWidth - sw2) / 2, (pick.naturalHeight - sh2) / 2, sw2, sh2, b.x, b.y, b.w, b.h);
        // viền neon mảnh theo màu lô đất cho hòa palette
        s.strokeStyle = b.color;
        s.globalAlpha = 0.4;
        s.lineWidth = 1.6;
        s.strokeRect(b.x, b.y, b.w, b.h);
        s.globalAlpha = 1;
        if (wrand() > 0.55) {
          s.strokeStyle = b.color;
          s.globalAlpha = 0.9;
          s.lineWidth = 3;
          s.beginPath();
          s.moveTo(b.x + 4, b.y - 4);
          s.lineTo(b.x + b.w * (0.4 + wrand() * 0.5), b.y - 4);
          s.stroke();
          s.globalAlpha = 1;
        }
        continue;
      }
      // fallback vector: thân nhà + viền neon + lưới cửa sổ
      const grad = s.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
      grad.addColorStop(0, "#100d24");
      grad.addColorStop(1, "#0a081a");
      s.fillStyle = grad;
      s.fillRect(b.x, b.y, b.w, b.h);
      s.strokeStyle = b.color;
      s.globalAlpha = 0.16;
      s.lineWidth = 6;
      s.strokeRect(b.x, b.y, b.w, b.h);
      s.globalAlpha = 0.85;
      s.lineWidth = 1.8;
      s.strokeRect(b.x, b.y, b.w, b.h);
      s.globalAlpha = 1;
      const cell = 15;
      const cols = Math.max(1, Math.floor((b.w - 12) / cell));
      const rows = Math.max(1, Math.floor((b.h - 12) / cell));
      const ox = b.x + (b.w - cols * cell) / 2 + 3;
      const oy = b.y + (b.h - rows * cell) / 2 + 3;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const roll = wrand();
          if (roll < 0.42) continue;
          const lit = roll > 0.86;
          s.fillStyle = b.color;
          s.globalAlpha = lit ? 0.95 : 0.32;
          s.fillRect(ox + c * cell, oy + r * cell, cell - 6, cell - 6);
        }
      }
      s.globalAlpha = 1;
    }

    // gờ tối dưới mặt đường (tạo khối)
    s.lineJoin = "round";
    s.lineCap = "round";
    s.strokeStyle = "rgba(0,0,0,0.55)";
    s.lineWidth = TRACK_WIDTH + 18;
    s.stroke(track.paths.road);
    // mặt đường asphalt (texture từ ảnh nếu có)
    s.strokeStyle = ROAD;
    s.lineWidth = TRACK_WIDTH;
    s.stroke(track.paths.road);
    if (ready(IMG.road)) {
      const pat = s.createPattern(IMG.road, "repeat");
      if (pat) {
        s.strokeStyle = pat;
        s.globalAlpha = 0.9;
        s.lineWidth = TRACK_WIDTH;
        s.stroke(track.paths.road);
        s.globalAlpha = 1;
      }
    }
    // kết cấu: dải sáng mờ giữa đường + gờ tối gần mép
    s.strokeStyle = "rgba(255,255,255,0.045)";
    s.lineWidth = TRACK_WIDTH - 34;
    s.stroke(track.paths.road);
    s.strokeStyle = "rgba(0,0,0,0.35)";
    s.lineWidth = TRACK_WIDTH - 8;
    s.setLineDash([3, 90]);
    s.stroke(track.paths.road);
    s.setLineDash([]);

    // mép neon nhiều lớp: TRÁI hồng, PHẢI cyan
    const edgeGlow = (path, rgb, core) => {
      s.strokeStyle = `rgba(${rgb},0.1)`;
      s.lineWidth = 22;
      s.stroke(path);
      s.strokeStyle = `rgba(${rgb},0.3)`;
      s.lineWidth = 10;
      s.stroke(path);
      s.strokeStyle = core;
      s.lineWidth = 3.2;
      s.stroke(path);
      s.strokeStyle = "rgba(255,255,255,0.55)";
      s.lineWidth = 1;
      s.stroke(path);
    };
    edgeGlow(track.paths.edgeL, "255,46,230", ROAD_EDGE_PINK);
    edgeGlow(track.paths.edgeR, "32,227,255", ROAD_EDGE_CYAN);

    // mũi tên chevron đôi chỉ hướng (xen kẽ cyan / hồng như ảnh)
    let ai = 0;
    for (const a of track.arrows) {
      const color = ai % 3 === 2 ? "255,46,230" : "32,227,255";
      ai += 1;
      s.save();
      s.translate(a.x, a.y);
      s.rotate(a.angle);
      for (let k = 0; k < 2; k++) {
        s.fillStyle = `rgba(${color},0.18)`;
        s.beginPath();
        s.moveTo(k * 18 - 7, -14);
        s.lineTo(k * 18 + 10, 0);
        s.lineTo(k * 18 - 7, 14);
        s.lineTo(k * 18 - 1, 0);
        s.closePath();
        s.fill();
        s.fillStyle = `rgba(${color},0.85)`;
        s.beginPath();
        s.moveTo(k * 18 - 5, -11);
        s.lineTo(k * 18 + 8, 0);
        s.lineTo(k * 18 - 5, 11);
        s.lineTo(k * 18, 0);
        s.closePath();
        s.fill();
      }
      s.restore();
    }
  }

  function drawDashes(time) {
    g.strokeStyle = "rgba(238,243,255,0.62)";
    g.lineWidth = 4.5;
    g.lineJoin = "round";
    g.setLineDash([30, 36]);
    g.lineDashOffset = -time * 40;
    g.stroke(track.paths.road);
    g.setLineDash([]);
  }

  function drawGate(cp, state, time) {
    // state: "next" | "done" | "idle"
    const i = cp.si;
    const p = track.pts[i];
    const n = track.normals[i];
    const lx = p[0] + n[0] * (HALF_W + 10);
    const ly = p[1] + n[1] * (HALF_W + 10);
    const rx = p[0] - n[0] * (HALF_W + 10);
    const ry = p[1] - n[1] * (HALF_W + 10);
    const color = state === "next" ? LIME : state === "done" ? "rgba(120,140,190,0.5)" : "#9a5cff";
    const glow = state === "next" ? 0.9 + Math.sin(time * 5) * 0.1 : 0.55;
    const useSprites = ready(IMG.pillarL) && ready(IMG.pillarR) && ready(IMG.fence);

    // vạch ngang đường
    g.strokeStyle = color;
    g.globalAlpha = state === "next" ? 0.8 : 0.3;
    g.lineWidth = state === "next" ? 7 : 4;
    g.setLineDash(state === "next" ? [16, 10] : [8, 12]);
    g.beginPath();
    g.moveTo(lx, ly);
    g.lineTo(rx, ry);
    g.stroke();
    g.setLineDash([]);
    g.globalAlpha = 1;

    if (useSprites) {
      // rào ca-rô chạy dọc vạch cổng (sprite tile theo chiều dài)
      const gateLen = Math.hypot(rx - lx, ry - ly);
      const fh = 24;
      const fw = fh * (137 / 56);
      g.save();
      g.translate(lx, ly);
      g.rotate(Math.atan2(ry - ly, rx - lx));
      g.globalAlpha = state === "next" ? 0.95 : state === "done" ? 0.3 : 0.55;
      for (let d = 8; d < gateLen - 8; d += fw) {
        g.drawImage(IMG.fence, d, -fh + 4, Math.min(fw, gateLen - 8 - d), fh);
      }
      g.restore();
      // hai trụ neon (sprite đứng, chân đặt tại mép đường)
      for (const [px, py, im] of [[lx, ly, IMG.pillarL], [rx, ry, IMG.pillarR]]) {
        g.fillStyle = "rgba(0,0,0,0.5)";
        g.beginPath();
        g.ellipse(px, py + 6, 15, 6, 0, 0, Math.PI * 2);
        g.fill();
        const h = 86;
        const w = h * (im.naturalWidth / im.naturalHeight);
        g.save();
        g.globalAlpha = state === "next" ? 1 : state === "done" ? 0.35 : 0.7;
        if (state === "next") {
          g.shadowColor = LIME;
          g.shadowBlur = 10 * glow;
        }
        g.drawImage(im, px - w / 2, py + 10 - h, w, h);
        g.restore();
        // đèn đỉnh trụ (động)
        g.save();
        g.shadowColor = state === "next" ? LIME : "#9a5cff";
        g.shadowBlur = 10;
        g.fillStyle = state === "next" ? LIME : "#9a5cff";
        g.beginPath();
        g.arc(px, py + 8 - h, 3.2, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
    } else {
      // fallback vector: trụ ca-rô
      for (const [px, py] of [[lx, ly], [rx, ry]]) {
        g.fillStyle = "rgba(0,0,0,0.5)";
        g.beginPath();
        g.ellipse(px, py + 8, 14, 6, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "#12102a";
        g.fillRect(px - 11, py - 34, 22, 44);
        const on = state === "next" ? "rgba(168,255,62,0.9)" : state === "done" ? "rgba(120,140,190,0.45)" : "rgba(154,92,255,0.75)";
        for (let ry2 = 0; ry2 < 5; ry2++) {
          for (let rx2 = 0; rx2 < 2; rx2++) {
            if ((rx2 + ry2) % 2 === 0) continue;
            g.fillStyle = on;
            g.fillRect(px - 10 + rx2 * 10, py - 33 + ry2 * 8.6, 9.5, 8);
          }
        }
        g.save();
        if (state === "next") {
          g.shadowColor = LIME;
          g.shadowBlur = 12 * glow;
        }
        g.strokeStyle = color;
        g.globalAlpha = glow;
        g.lineWidth = 2;
        g.strokeRect(px - 11, py - 34, 22, 44);
        g.restore();
        g.globalAlpha = 1;
      }
    }

    // banner CHECKPOINT (luôn nằm ngang để dễ đọc, như ảnh reference)
    if (state === "next") {
      const mx = (lx + rx) / 2;
      const my = (ly + ry) / 2;
      const label = cp.order === 8 ? "FINISH" : "CHECKPOINT";
      if (label === "CHECKPOINT" && ready(IMG.banner)) {
        const bw2 = 158;
        const bh2 = bw2 * (91 / 229);
        g.save();
        g.translate(mx, my - 86);
        g.shadowColor = LIME;
        g.shadowBlur = 14 * glow;
        g.drawImage(IMG.banner, -bw2 / 2, -bh2 / 2, bw2, bh2);
        g.restore();
        return;
      }
      const bw = label.length * 12 + 34;
      g.save();
      g.translate(mx, my - 60);
      g.strokeStyle = "rgba(168,255,62,0.5)";
      g.lineWidth = 1.8;
      g.beginPath();
      g.moveTo(lx - mx, 60 - 34);
      g.lineTo(-bw / 2 + 8, 13);
      g.moveTo(rx - mx, 60 - 34);
      g.lineTo(bw / 2 - 8, 13);
      g.stroke();
      g.save();
      g.shadowColor = LIME;
      g.shadowBlur = 18 * glow;
      g.fillStyle = "rgba(9,14,6,0.94)";
      g.beginPath();
      g.roundRect(-bw / 2, -15, bw, 30, 5);
      g.fill();
      g.strokeStyle = LIME;
      g.lineWidth = 2.4;
      g.stroke();
      g.restore();
      g.fillStyle = "rgba(168,255,62,0.8)";
      for (let k = 0; k < 2; k++) {
        for (let r = 0; r < 3; r++) {
          if ((k + r) % 2 === 0) continue;
          g.fillRect(-bw / 2 + 4 + k * 5, -13 + r * 9, 5, 8);
          g.fillRect(bw / 2 - 14 + k * 5, -13 + r * 9, 5, 8);
        }
      }
      g.fillStyle = LIME;
      g.font = "800 16px 'JetBrains Mono', monospace";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.shadowColor = LIME;
      g.shadowBlur = 14;
      g.fillText(label, 0, 1);
      g.restore();
    }
  }

  function drawPickup(p, time) {
    if (p.taken) return;
    const bob = Math.sin(time * 3 + p.pulse) * 3;
    const r = 17 + Math.sin(time * 4 + p.pulse) * 1.5;
    if (ready(IMG.pickup)) {
      const w = r * 2.9;
      const h = w * (95 / 92);
      g.save();
      g.translate(p.x, p.y + bob);
      g.shadowColor = LIME;
      g.shadowBlur = 8 + Math.sin(time * 4 + p.pulse) * 4;
      g.drawImage(IMG.pickup, -w / 2, -h / 2, w, h);
      g.restore();
      return;
    }
    g.save();
    g.translate(p.x, p.y + bob);
    const hex = (rr) => {
      g.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const x = Math.cos(a) * rr;
        const y = Math.sin(a) * rr;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.closePath();
    };
    // glow rẻ: viền dày mờ thay cho shadowBlur
    g.strokeStyle = "rgba(168,255,62,0.14)";
    g.lineWidth = 14;
    hex(r);
    g.stroke();
    g.strokeStyle = "rgba(168,255,62,0.4)";
    g.lineWidth = 7;
    hex(r);
    g.stroke();
    // lõi tối + viền sáng
    g.fillStyle = "rgba(20,34,6,0.95)";
    g.strokeStyle = LIME;
    g.lineWidth = 3;
    hex(r);
    g.fill();
    g.stroke();
    g.strokeStyle = "rgba(220,255,170,0.5)";
    g.lineWidth = 1.2;
    hex(r * 0.72);
    g.stroke();
    // tia sét
    g.save();
    g.shadowColor = LIME;
    g.shadowBlur = 8;
    g.fillStyle = LIME;
    g.beginPath();
    g.moveTo(2.5, -10);
    g.lineTo(-5.5, 2.4);
    g.lineTo(-0.5, 2.4);
    g.lineTo(-2.5, 10);
    g.lineTo(5.5, -2.4);
    g.lineTo(0.5, -2.4);
    g.closePath();
    g.fill();
    g.restore();
    g.restore();
  }

  function drawTrafficCar(t) {
    g.save();
    g.translate(t.x, t.y);
    g.rotate(t.angle);
    // bóng
    g.fillStyle = "rgba(0,0,0,0.45)";
    g.beginPath();
    g.ellipse(0, 4, 22, 13, 0, 0, Math.PI * 2);
    g.fill();
    if (ready(IMG.traffic)) {
      const s = 74;
      g.drawImage(IMG.traffic, -s / 2, -s / 2, s, s);
      g.restore();
      return;
    }
    // bánh xe
    g.fillStyle = "#0a0a12";
    g.fillRect(-14, -12.5, 9, 4);
    g.fillRect(6, -12.5, 9, 4);
    g.fillRect(-14, 8.5, 9, 4);
    g.fillRect(6, 8.5, 9, 4);
    // thân vàng gradient
    const grad = g.createLinearGradient(0, -11, 0, 11);
    grad.addColorStop(0, "#ffd94d");
    grad.addColorStop(0.5, "#e8b616");
    grad.addColorStop(1, "#a67f0e");
    g.fillStyle = grad;
    g.beginPath();
    g.roundRect(-19, -11, 38, 22, 7);
    g.fill();
    g.strokeStyle = "rgba(60,44,4,0.8)";
    g.lineWidth = 1.4;
    g.stroke();
    // kính trước + sau
    g.fillStyle = "#141006";
    g.beginPath();
    g.roundRect(3, -8.5, 8, 17, 3);
    g.fill();
    g.beginPath();
    g.roundRect(-11, -8.5, 7, 17, 3);
    g.fill();
    // nóc + biển cảnh báo tam giác
    g.fillStyle = "#c79a10";
    g.beginPath();
    g.roundRect(-4, -7.5, 7, 15, 2.5);
    g.fill();
    g.fillStyle = "#241c04";
    g.beginPath();
    g.moveTo(-3.5, 5);
    g.lineTo(3.5, 5);
    g.lineTo(0, -1.5);
    g.closePath();
    g.fill();
    g.strokeStyle = "#ffd94d";
    g.lineWidth = 1;
    g.stroke();
    // đèn pha + đèn hậu glow
    g.save();
    g.shadowColor = "#fff2b0";
    g.shadowBlur = 8;
    g.fillStyle = "#fff2b0";
    g.fillRect(17, -8.5, 3.4, 5);
    g.fillRect(17, 3.5, 3.4, 5);
    g.restore();
    g.save();
    g.shadowColor = "#ff3b2a";
    g.shadowBlur = 8;
    g.fillStyle = "#ff4b30";
    g.fillRect(-20, -8.5, 3, 5);
    g.fillRect(-20, 3.5, 3, 5);
    g.restore();
    g.restore();
  }

  function drawPlayerCar(car, time) {
    g.save();
    g.translate(car.x, car.y);
    g.rotate(car.heading + car.steerVisual * 0.1);
    // bóng
    g.fillStyle = "rgba(0,0,0,0.5)";
    g.beginPath();
    g.ellipse(0, 3, 23, 13, 0, 0, Math.PI * 2);
    g.fill();
    // underglow hồng
    g.save();
    g.shadowColor = "#ff2ee6";
    g.shadowBlur = 22;
    g.fillStyle = "rgba(255,46,230,0.4)";
    g.beginPath();
    g.ellipse(0, 0, 23, 14, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
    if (ready(IMG.car)) {
      const s = 96;
      g.drawImage(IMG.car, -s / 2 + 2, -s / 2, s, s);
      // lửa nitro (động, vẽ code ở đuôi xe)
      if (car.nitroActive) {
        const f = 14 + Math.sin(time * 40) * 5;
        g.save();
        g.shadowColor = "#20e3ff";
        g.shadowBlur = 14;
        g.fillStyle = "rgba(32,227,255,0.9)";
        g.beginPath();
        g.moveTo(-26, -4.5);
        g.lineTo(-26 - f, 0);
        g.lineTo(-26, 4.5);
        g.closePath();
        g.fill();
        g.fillStyle = "rgba(255,255,255,0.95)";
        g.beginPath();
        g.moveTo(-26, -2.2);
        g.lineTo(-26 - f * 0.55, 0);
        g.lineTo(-26, 2.2);
        g.closePath();
        g.fill();
        g.restore();
      }
      g.restore();
      return;
    }
    // bánh xe
    g.fillStyle = "#05060c";
    g.fillRect(-15, -13, 10, 4.5);
    g.fillRect(6, -13, 10, 4.5);
    g.fillRect(-15, 8.5, 10, 4.5);
    g.fillRect(6, 8.5, 10, 4.5);
    // thân xe tối
    const grad = g.createLinearGradient(0, -11, 0, 11);
    grad.addColorStop(0, "#1c2547");
    grad.addColorStop(0.5, "#101731");
    grad.addColorStop(1, "#0a0f22");
    g.fillStyle = grad;
    g.beginPath();
    g.roundRect(-20, -11, 40, 22, 8);
    g.fill();
    g.strokeStyle = "rgba(32,227,255,0.6)";
    g.lineWidth = 1.2;
    g.stroke();
    // mui sáng
    g.fillStyle = "#dfe8ff";
    g.beginPath();
    g.roundRect(-8, -8, 15, 16, 5);
    g.fill();
    // kính chắn gió tối
    g.fillStyle = "#0b1226";
    g.beginPath();
    g.roundRect(4, -7, 9, 14, 4);
    g.fill();
    g.beginPath();
    g.roundRect(-11, -7, 5, 14, 2.5);
    g.fill();
    // sọc cyan phát sáng dọc mui
    g.save();
    g.shadowColor = "#20e3ff";
    g.shadowBlur = 7;
    g.fillStyle = "#20e3ff";
    g.fillRect(-8, -1.4, 15, 2.8);
    g.restore();
    // viền hông cyan
    g.fillStyle = "rgba(32,227,255,0.85)";
    g.fillRect(-18, -11.4, 30, 2);
    g.fillRect(-18, 9.4, 30, 2);
    // mũi hồng
    g.save();
    g.shadowColor = "#ff2ee6";
    g.shadowBlur = 9;
    g.fillStyle = "#ff2ee6";
    g.beginPath();
    g.roundRect(13, -9.5, 7, 19, 3);
    g.fill();
    g.restore();
    // cánh gió sau
    g.fillStyle = "#151d3c";
    g.beginPath();
    g.roundRect(-21, -10, 4, 20, 2);
    g.fill();
    g.strokeStyle = "rgba(255,46,230,0.7)";
    g.lineWidth = 1;
    g.stroke();
    // đèn pha
    g.save();
    g.shadowColor = "#eafcff";
    g.shadowBlur = 10;
    g.fillStyle = "#eafcff";
    g.fillRect(18, -8, 3, 4.6);
    g.fillRect(18, 3.4, 3, 4.6);
    g.restore();
    // đèn hậu
    g.save();
    g.shadowColor = "#ff3b57";
    g.shadowBlur = 8;
    g.fillStyle = "#ff3b57";
    g.fillRect(-21.5, -8, 3, 4.6);
    g.fillRect(-21.5, 3.4, 3, 4.6);
    g.restore();
    // lửa nitro
    if (car.nitroActive) {
      const f = 12 + Math.sin(time * 40) * 5;
      g.save();
      g.shadowColor = "#20e3ff";
      g.shadowBlur = 14;
      g.fillStyle = "rgba(32,227,255,0.9)";
      g.beginPath();
      g.moveTo(-21, -4.5);
      g.lineTo(-21 - f, 0);
      g.lineTo(-21, 4.5);
      g.closePath();
      g.fill();
      g.fillStyle = "rgba(255,255,255,0.95)";
      g.beginPath();
      g.moveTo(-21, -2.2);
      g.lineTo(-21 - f * 0.55, 0);
      g.lineTo(-21, 2.2);
      g.closePath();
      g.fill();
      g.restore();
    }
    g.restore();
  }

  function drawTrails(trails) {
    // vệt drift liền mạch: nối các điểm neo (có x1b) thành 2 polyline
    // song song, mỗi đoạn 2 lớp — quầng rộng mờ + lõi sáng (nitro = cyan)
    g.lineCap = "round";
    let prev = null;
    for (const tr of trails) {
      if (tr.x1b === undefined) continue; // bỏ segment nối cũ, chỉ dùng neo
      if (prev) {
        const a = Math.max(0, tr.life);
        const gap = Math.hypot(tr.x1 - prev.x1, tr.y1 - prev.y1);
        if (a > 0 && gap < 46) {
          const glow = tr.nitro ? `rgba(32,227,255,${0.16 * a})` : `rgba(255,46,230,${0.2 * a})`;
          const core = tr.nitro ? `rgba(110,240,255,${0.75 * a})` : `rgba(255,90,238,${0.8 * a})`;
          for (const [x0, y0, x1, y1] of [
            [prev.x1, prev.y1, tr.x1, tr.y1],
            [prev.x1b, prev.y1b, tr.x1b, tr.y1b],
          ]) {
            g.strokeStyle = glow;
            g.lineWidth = 13 * a + 3;
            g.beginPath();
            g.moveTo(x0, y0);
            g.lineTo(x1, y1);
            g.stroke();
            g.strokeStyle = core;
            g.lineWidth = 4.5 * a + 1;
            g.beginPath();
            g.moveTo(x0, y0);
            g.lineTo(x1, y1);
            g.stroke();
          }
        }
      }
      prev = tr;
    }
  }

  function drawSparks(sparks) {
    for (const s of sparks) {
      if (s.life <= 0) continue;
      g.fillStyle = `rgba(255,210,80,${s.life})`;
      g.fillRect(s.x - 2, s.y - 2, 4, 4);
      g.fillStyle = `rgba(255,255,255,${s.life * 0.7})`;
      g.fillRect(s.x - 1, s.y - 1, 2, 2);
    }
  }

  /* ---------- khung hình chính ---------- */

  function draw(state, time) {
    const { car, cam, traffic, trails, sparks, nextCp, shake } = state;
    if (W === 0) fit();
    // dựng lại lớp tĩnh 1 lần khi sprite decode xong (frame đầu có thể là vector)
    if (!staticLayer || (assetsReady && !staticWithAssets)) buildStatic();
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // nền
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0d0824");
    bg.addColorStop(0.55, "#080617");
    bg.addColorStop(1, "#05040f");
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);

    const z = zoom();
    const sx = shake ? (Math.random() - 0.5) * shake : 0;
    const sy = shake ? (Math.random() - 0.5) * shake : 0;
    g.setTransform(dpr * z, 0, 0, dpr * z, dpr * (W / 2 - (cam.x + sx) * z), dpr * (H / 2 - (cam.y + sy) * z));

    // lưới nền mờ (chỉ vùng nhìn thấy)
    g.strokeStyle = "rgba(90,80,180,0.09)";
    g.lineWidth = 1;
    const gs = 130;
    const halfVW = W / (2 * z) + gs;
    const halfVH = H / (2 * z) + gs;
    const x0 = Math.floor((cam.x - halfVW) / gs) * gs;
    const y0 = Math.floor((cam.y - halfVH) / gs) * gs;
    g.beginPath();
    for (let x = x0; x < cam.x + halfVW; x += gs) {
      g.moveTo(x, y0);
      g.lineTo(x, cam.y + halfVH);
    }
    for (let y = y0; y < cam.y + halfVH; y += gs) {
      g.moveTo(x0, y);
      g.lineTo(cam.x + halfVH, y);
    }
    g.stroke();

    // lớp tĩnh pre-render (decor + đường + mép + mũi tên)
    g.drawImage(staticLayer, staticOX, staticOY, staticW, staticH);
    drawDashes(time);

    for (const cp of track.checkpoints) {
      const st = cp.order === nextCp ? "next" : cp.order < nextCp ? "done" : "idle";
      drawGate(cp, st, time);
    }
    for (const p of track.pickups) drawPickup(p, time);
    drawTrails(trails);
    for (const t of traffic) drawTrafficCar(t);
    drawSparks(sparks);
    drawPlayerCar(car, time);

    // vignette nhẹ cho chiều sâu (vẽ trong hệ tọa độ màn hình)
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const vig = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(2,2,10,0.42)");
    g.fillStyle = vig;
    g.fillRect(0, 0, W, H);
  }

  return { fit, draw, get size() { return { W, H }; } };
}

/* ---------------- Minimap (canvas nhỏ góc trái như ảnh) ---------------- */

export function createMinimap(canvas, track) {
  const g = canvas.getContext("2d");
  const CW = 128;
  const CH = 92;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = CW * dpr;
  canvas.height = CH * dpr;

  const { minX, minY, maxX, maxY } = track.bbox;
  const s = Math.min((CW - 16) / (maxX - minX), (CH - 16) / (maxY - minY));
  const ox = (CW - (maxX - minX) * s) / 2 - minX * s;
  const oy = (CH - (maxY - minY) * s) / 2 - minY * s;
  const mx = (x) => x * s + ox;
  const my = (y) => y * s + oy;

  const outline = new Path2D();
  outline.moveTo(mx(track.pts[0][0]), my(track.pts[0][1]));
  for (let i = 1; i < track.count; i += 3) outline.lineTo(mx(track.pts[i][0]), my(track.pts[i][1]));
  outline.closePath();

  function draw(car, traffic, nextCp, time) {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, CW, CH);
    g.save();
    g.shadowColor = "#ff2ee6";
    g.shadowBlur = 5;
    g.strokeStyle = "rgba(255,46,230,0.9)";
    g.lineWidth = 2.4;
    g.stroke(outline);
    g.restore();
    // checkpoint kế tiếp nhấp nháy lime
    for (const cp of track.checkpoints) {
      const p = track.pts[cp.si];
      if (cp.order === nextCp) {
        g.fillStyle = `rgba(168,255,62,${0.6 + Math.sin(time * 6) * 0.4})`;
        g.beginPath();
        g.arc(mx(p[0]), my(p[1]), 3.4, 0, Math.PI * 2);
        g.fill();
      } else {
        g.fillStyle = cp.order < nextCp ? "rgba(120,140,190,0.5)" : "rgba(154,92,255,0.7)";
        g.fillRect(mx(p[0]) - 1.5, my(p[1]) - 1.5, 3, 3);
      }
    }
    for (const t of traffic) {
      g.fillStyle = "#e8b616";
      g.fillRect(mx(t.x) - 1.5, my(t.y) - 1.5, 3, 3);
    }
    g.save();
    g.shadowColor = "#4df77f";
    g.shadowBlur = 6;
    g.fillStyle = "#4df77f";
    g.beginPath();
    g.arc(mx(car.x), my(car.y), 4, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  return { draw };
}
