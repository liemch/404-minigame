/**
 * render.js — vẽ thế giới Neon Drift 404: thành phố neon tối, mặt đường
 * asphalt với 2 mép phát sáng hồng/cyan, vạch giữa đứt, chevron chỉ
 * hướng, cổng CHECKPOINT lime, pickup lục giác năng lượng, xe người
 * chơi cyan-hồng với vệt drift, xe cản vàng, minimap góc trái.
 */

import { TRACK_WIDTH, HALF_W } from "./track.js";

const ROAD = "#131120";
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

  function buildStatic() {
    staticW = track.bbox.maxX + 90;
    staticH = track.bbox.maxY + 90;
    staticLayer = document.createElement("canvas");
    staticLayer.width = Math.round(staticW * STATIC_SCALE);
    staticLayer.height = Math.round(staticH * STATIC_SCALE);
    const s = staticLayer.getContext("2d");
    s.scale(STATIC_SCALE, STATIC_SCALE);

    // decor thành phố
    for (const b of track.decor) {
      s.fillStyle = "#0d0a20";
      s.fillRect(b.x, b.y, b.w, b.h);
      s.strokeStyle = b.color;
      s.globalAlpha = 0.5;
      s.lineWidth = 2;
      s.strokeRect(b.x, b.y, b.w, b.h);
      s.globalAlpha = 0.38;
      s.fillStyle = b.color;
      if (b.vertical) {
        for (let i = 0; i < b.windows; i++) {
          const wx = b.x + 10 + (i * (b.w - 20)) / Math.max(1, b.windows - 1);
          s.fillRect(wx - 2, b.y + 8, 4, b.h - 16);
        }
      } else {
        for (let i = 0; i < b.windows; i++) {
          const wy = b.y + 10 + (i * (b.h - 20)) / Math.max(1, b.windows - 1);
          s.fillRect(b.x + 8, wy - 2, b.w - 16, 4);
        }
      }
      s.globalAlpha = 1;
    }

    // mặt đường + mép glow
    s.lineJoin = "round";
    s.lineCap = "round";
    s.strokeStyle = ROAD;
    s.lineWidth = TRACK_WIDTH;
    s.stroke(track.paths.road);
    s.strokeStyle = "rgba(255,255,255,0.03)";
    s.lineWidth = TRACK_WIDTH - 26;
    s.stroke(track.paths.road);
    s.lineWidth = 9;
    s.strokeStyle = "rgba(255,46,230,0.28)";
    s.stroke(track.paths.edgeL);
    s.lineWidth = 3;
    s.strokeStyle = ROAD_EDGE_PINK;
    s.stroke(track.paths.edgeL);
    s.lineWidth = 9;
    s.strokeStyle = "rgba(32,227,255,0.26)";
    s.stroke(track.paths.edgeR);
    s.lineWidth = 3;
    s.strokeStyle = ROAD_EDGE_CYAN;
    s.stroke(track.paths.edgeR);

    // mũi tên chỉ hướng
    for (const a of track.arrows) {
      s.save();
      s.translate(a.x, a.y);
      s.rotate(a.angle);
      s.fillStyle = "rgba(32,227,255,0.5)";
      for (let k = 0; k < 2; k++) {
        s.beginPath();
        s.moveTo(k * 14 - 4, -10);
        s.lineTo(k * 14 + 8, 0);
        s.lineTo(k * 14 - 4, 10);
        s.lineTo(k * 14, 0);
        s.closePath();
        s.fill();
      }
      s.restore();
    }
  }

  function drawDashes(time) {
    g.strokeStyle = "rgba(240,244,255,0.5)";
    g.lineWidth = 4;
    g.lineJoin = "round";
    g.setLineDash([26, 34]);
    g.lineDashOffset = -time * 40;
    g.stroke(track.paths.road);
    g.setLineDash([]);
  }

  function drawGate(cp, state, time) {
    // state: "next" | "done" | "idle"
    const i = cp.si;
    const p = track.pts[i];
    const n = track.normals[i];
    const lx = p[0] + n[0] * (HALF_W + 8);
    const ly = p[1] + n[1] * (HALF_W + 8);
    const rx = p[0] - n[0] * (HALF_W + 8);
    const ry = p[1] - n[1] * (HALF_W + 8);
    const color = state === "next" ? LIME : state === "done" ? "rgba(120,140,190,0.5)" : "#9a5cff";
    const glow = state === "next" ? 0.9 + Math.sin(time * 5) * 0.1 : 0.55;

    // vạch ngang đường
    g.strokeStyle = color;
    g.globalAlpha = state === "next" ? 0.75 : 0.3;
    g.lineWidth = state === "next" ? 7 : 4;
    g.setLineDash(state === "next" ? [16, 10] : [8, 12]);
    g.beginPath();
    g.moveTo(lx, ly);
    g.lineTo(rx, ry);
    g.stroke();
    g.setLineDash([]);
    g.globalAlpha = 1;

    // hai trụ cổng
    for (const [px, py] of [[lx, ly], [rx, ry]]) {
      g.fillStyle = "#151230";
      g.fillRect(px - 9, py - 24, 18, 34);
      g.strokeStyle = color;
      g.globalAlpha = glow;
      g.lineWidth = 2;
      g.strokeRect(px - 9, py - 24, 18, 34);
      g.globalAlpha = 1;
      g.fillStyle = color;
      g.globalAlpha = glow;
      g.beginPath();
      g.moveTo(px - 4, py - 16);
      g.lineTo(px + 5, py - 10);
      g.lineTo(px - 4, py - 4);
      g.closePath();
      g.fill();
      g.globalAlpha = 1;
    }

    // banner CHECKPOINT (luôn nằm ngang để dễ đọc, như ảnh reference)
    if (state === "next") {
      const mx = (lx + rx) / 2;
      const my = (ly + ry) / 2;
      const label = cp.order === 8 ? "FINISH" : "CHECKPOINT";
      const bw = label.length * 11 + 26;
      g.save();
      g.translate(mx, my - 52);
      g.fillStyle = "rgba(10,14,8,0.92)";
      g.fillRect(-bw / 2, -12, bw, 24);
      g.strokeStyle = LIME;
      g.lineWidth = 2;
      g.strokeRect(-bw / 2, -12, bw, 24);
      g.fillStyle = LIME;
      g.font = "800 15px 'JetBrains Mono', monospace";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.shadowColor = LIME;
      g.shadowBlur = 12;
      g.fillText(label, 0, 1);
      g.shadowBlur = 0;
      // hai chân nối xuống trụ
      g.strokeStyle = "rgba(168,255,62,0.5)";
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(lx - mx, 52 - 24);
      g.lineTo(-bw / 2 + 8, 12);
      g.moveTo(rx - mx, 52 - 24);
      g.lineTo(bw / 2 - 8, 12);
      g.stroke();
      g.restore();
    }
  }

  function drawPickup(p, time) {
    if (p.taken) return;
    const bob = Math.sin(time * 3 + p.pulse) * 3;
    const r = 16 + Math.sin(time * 4 + p.pulse) * 1.5;
    g.save();
    g.translate(p.x, p.y + bob);
    g.fillStyle = "rgba(28,46,8,0.92)";
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
    g.strokeStyle = "rgba(168,255,62,0.28)";
    g.lineWidth = 8;
    hex(r);
    g.stroke();
    g.strokeStyle = LIME;
    g.lineWidth = 3;
    hex(r);
    g.fill();
    g.stroke();
    // tia sét
    g.fillStyle = LIME;
    g.beginPath();
    g.moveTo(2, -9);
    g.lineTo(-5, 2);
    g.lineTo(-0.5, 2);
    g.lineTo(-2, 9);
    g.lineTo(5, -2);
    g.lineTo(0.5, -2);
    g.closePath();
    g.fill();
    g.restore();
  }

  function drawTrafficCar(t) {
    g.save();
    g.translate(t.x, t.y);
    g.rotate(t.angle);
    g.fillStyle = "rgba(0,0,0,0.4)";
    g.beginPath();
    g.ellipse(0, 3, 20, 12, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#e8b616";
    g.beginPath();
    g.roundRect(-18, -10, 36, 20, 6);
    g.fill();
    g.fillStyle = "#1a1406";
    g.beginPath();
    g.roundRect(-6, -8, 14, 16, 4);
    g.fill();
    g.fillStyle = "#fff2b0";
    g.fillRect(15, -8, 4, 5);
    g.fillRect(15, 3, 4, 5);
    g.fillStyle = "#b3140a";
    g.fillRect(-19, -8, 3, 5);
    g.fillRect(-19, 3, 3, 5);
    // tam giác cảnh báo trên nóc
    g.fillStyle = "#241c04";
    g.beginPath();
    g.moveTo(-13, 6);
    g.lineTo(-5, 6);
    g.lineTo(-9, -1);
    g.closePath();
    g.fill();
    g.restore();
  }

  function drawPlayerCar(car, time) {
    g.save();
    g.translate(car.x, car.y);
    g.rotate(car.heading + car.steerVisual * 0.1);
    // bóng + underglow hồng
    g.shadowColor = "#ff2ee6";
    g.shadowBlur = 18;
    g.fillStyle = "rgba(255,46,230,0.32)";
    g.beginPath();
    g.ellipse(0, 0, 22, 13, 0, 0, Math.PI * 2);
    g.fill();
    g.shadowBlur = 0;
    // thân xe
    g.fillStyle = "#dfe8ff";
    g.beginPath();
    g.roundRect(-19, -10, 38, 20, 7);
    g.fill();
    // mui + kính
    g.fillStyle = "#0b1226";
    g.beginPath();
    g.roundRect(-4, -7.5, 13, 15, 5);
    g.fill();
    // sọc cyan
    g.fillStyle = "#20e3ff";
    g.fillRect(-19, -10, 30, 2.6);
    g.fillRect(-19, 7.4, 30, 2.6);
    // mũi hồng
    g.fillStyle = "#ff2ee6";
    g.beginPath();
    g.roundRect(12, -9, 7, 18, 3);
    g.fill();
    // đèn pha
    g.fillStyle = "#eafcff";
    g.fillRect(17, -8, 3, 4.6);
    g.fillRect(17, 3.4, 3, 4.6);
    // đèn hậu
    g.fillStyle = "#ff3b57";
    g.fillRect(-20, -8, 3, 4.6);
    g.fillRect(-20, 3.4, 3, 4.6);
    // lửa nitro
    if (car.nitroActive) {
      const f = 10 + Math.sin(time * 40) * 4;
      g.fillStyle = "rgba(32,227,255,0.9)";
      g.beginPath();
      g.moveTo(-20, -4);
      g.lineTo(-20 - f, 0);
      g.lineTo(-20, 4);
      g.closePath();
      g.fill();
      g.fillStyle = "rgba(255,255,255,0.9)";
      g.beginPath();
      g.moveTo(-20, -2);
      g.lineTo(-20 - f * 0.55, 0);
      g.lineTo(-20, 2);
      g.closePath();
      g.fill();
    }
    g.restore();
  }

  function drawTrails(trails) {
    // vệt drift: các đoạn nối tiếp mờ dần (hồng → cyan theo tuổi)
    for (const tr of trails) {
      const a = Math.max(0, tr.life);
      if (a <= 0) continue;
      g.strokeStyle = tr.nitro
        ? `rgba(32,227,255,${0.5 * a})`
        : `rgba(255,46,230,${0.55 * a})`;
      g.lineWidth = 5 * a + 1;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(tr.x0, tr.y0);
      g.lineTo(tr.x1, tr.y1);
      g.stroke();
    }
  }

  function drawSparks(sparks) {
    for (const s of sparks) {
      if (s.life <= 0) continue;
      g.fillStyle = `rgba(255,210,80,${s.life})`;
      g.fillRect(s.x - 1.5, s.y - 1.5, 3, 3);
    }
  }

  /* ---------- khung hình chính ---------- */

  function draw(state, time) {
    const { car, cam, traffic, trails, sparks, nextCp, shake } = state;
    if (W === 0) fit();
    if (!staticLayer) buildStatic();
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // nền
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0c0722");
    bg.addColorStop(1, "#060414");
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);

    const z = zoom();
    const sx = shake ? (Math.random() - 0.5) * shake : 0;
    const sy = shake ? (Math.random() - 0.5) * shake : 0;
    g.setTransform(dpr * z, 0, 0, dpr * z, dpr * (W / 2 - (cam.x + sx) * z), dpr * (H / 2 - (cam.y + sy) * z));

    // lưới nền mờ (chỉ vùng nhìn thấy)
    g.strokeStyle = "rgba(90,80,180,0.08)";
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
    g.drawImage(staticLayer, 0, 0, staticW, staticH);
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
    g.strokeStyle = "rgba(255,46,230,0.9)";
    g.lineWidth = 2.4;
    g.stroke(outline);
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
