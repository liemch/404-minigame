/**
 * render.js — vẽ Pixel Golf 404 theo ảnh reference: nền vũ trụ pixel
 * với cây / tinh thể / tượng đài neon, sân cỏ teal ca-rô viền gạch tím,
 * hố cát vàng, bumper vòng neon, cổng trượt laser đỏ, cặp cổng không
 * gian hồng–cyan kèm chevron, lỗ cờ trắng, bóng trắng + khung ngắm
 * xanh lá, mũi tên ngắm nét đứt.
 */

import { WORLD_W, WORLD_H } from "./courses.js";
import { pointInPoly, gateSegment, BALL_R, PORTAL_R } from "./engine.js";
import { seededRand } from "../../core/utils.js";

export function createGolfRenderer(canvas, box) {
  const g = canvas.getContext("2d");
  let dpr = 1;
  let scale = 1;
  let offX = 0;
  let offY = 0;

  function fit() {
    const rect = box.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    const k = Math.min(rect.width / WORLD_W, rect.height / WORLD_H);
    scale = k * dpr;
    offX = (rect.width * dpr - WORLD_W * scale) / 2;
    offY = (rect.height * dpr - WORLD_H * scale) / 2;
  }

  function toWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const px = (clientX - rect.left) * dpr;
    const py = (clientY - rect.top) * dpr;
    return { x: (px - offX) / scale, y: (py - offY) / scale };
  }

  function toClient(x, y) {
    const rect = canvas.getBoundingClientRect();
    return { cx: rect.left + (offX + x * scale) / dpr, cy: rect.top + (offY + y * scale) / dpr };
  }

  /* ---------- nền + sân (cache theo hố) ---------- */
  let bgCanvas = null;
  let bgHoleId = -1;

  function px(c, x, y, s, color) {
    c.fillStyle = color;
    c.fillRect(Math.round(x), Math.round(y), s, s);
  }

  function drawPlant(c, x, y, rand) {
    const kind = rand();
    if (kind < 0.35) {
      // xương rồng pixel
      const col = rand() > 0.5 ? "#2fbf71" : "#7a4fd0";
      for (let i = 0; i < 4; i++) px(c, x, y - i * 4, 4, col);
      px(c, x - 4, y - 8, 4, col);
      px(c, x + 4, y - 12, 4, col);
      px(c, x, y - 16, 4, rand() > 0.5 ? "#ff5ad2" : col);
    } else if (kind < 0.62) {
      // tinh thể
      const col = rand() > 0.5 ? "#20e3ff" : "#ff2ee6";
      px(c, x, y, 5, col);
      px(c, x + 3, y - 5, 5, col);
      px(c, x - 3, y - 4, 4, `${col}aa`);
      px(c, x + 1, y - 10, 4, "#ffffffcc");
    } else if (kind < 0.85) {
      // hoa nhỏ
      const col = ["#ffd23f", "#ff5ad2", "#4df77f"][Math.floor(rand() * 3)];
      px(c, x, y, 3, col);
      px(c, x - 3, y + 2, 3, `${col}88`);
      px(c, x + 3, y + 2, 3, `${col}88`);
    } else {
      // tượng đài neon
      const col = ["#d7ff3e", "#ff2ee6", "#20e3ff"][Math.floor(rand() * 3)];
      c.fillStyle = "#191d33";
      c.fillRect(x - 6, y - 22, 12, 22);
      c.fillStyle = col;
      c.fillRect(x - 3, y - 17, 6, 6);
      c.fillStyle = "#242847";
      c.fillRect(x - 8, y - 4, 16, 4);
    }
  }

  function paintBg(def) {
    bgCanvas = document.createElement("canvas");
    bgCanvas.width = canvas.width;
    bgCanvas.height = canvas.height;
    const c = bgCanvas.getContext("2d");
    c.fillStyle = "#0a0a24";
    c.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
    c.setTransform(scale, 0, 0, scale, offX, offY);

    const rand = seededRand(9000 + def.id * 77);
    // sao + hạt pixel nền
    for (let i = 0; i < 90; i++) {
      const x = rand() * WORLD_W;
      const y = rand() * WORLD_H;
      c.fillStyle = rand() > 0.8 ? "rgba(122,63,212,0.5)" : "rgba(160,175,235,0.28)";
      c.fillRect(x, y, 2, 2);
    }
    // cây cối / tinh thể ngoài sân
    for (let i = 0; i < 26; i++) {
      const x = 24 + rand() * (WORLD_W - 48);
      const y = 30 + rand() * (WORLD_H - 50);
      if (pointInPoly(def.poly, x, y)) continue;
      let clear = true;
      for (const p of def.poly) {
        if (Math.hypot(p[0] - x, p[1] - y) < 26) clear = false;
      }
      if (clear) drawPlant(c, x, y, rand);
    }

    // sân cỏ ca-rô teal
    c.save();
    c.beginPath();
    c.moveTo(def.poly[0][0], def.poly[0][1]);
    for (let i = 1; i < def.poly.length; i++) c.lineTo(def.poly[i][0], def.poly[i][1]);
    c.closePath();
    c.clip();
    c.fillStyle = "#157f6d";
    c.fillRect(0, 0, WORLD_W, WORLD_H);
    const t = 32;
    c.fillStyle = "#1b937e";
    for (let y = 0; y < WORLD_H / t; y++) {
      for (let x = 0; x < WORLD_W / t; x++) {
        if ((x + y) % 2 === 0) c.fillRect(x * t, y * t, t, t);
      }
    }
    // đốm pixel cỏ
    for (let i = 0; i < 130; i++) {
      const x = rand() * WORLD_W;
      const y = rand() * WORLD_H;
      c.fillStyle = rand() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(6,40,34,0.25)";
      c.fillRect(x, y, 3, 3);
    }
    // viền sáng trong mép sân
    c.restore();

    // hố cát
    for (const s of def.sand || []) {
      c.save();
      c.beginPath();
      c.moveTo(def.poly[0][0], def.poly[0][1]);
      for (let i = 1; i < def.poly.length; i++) c.lineTo(def.poly[i][0], def.poly[i][1]);
      c.closePath();
      c.clip();
      c.fillStyle = "#caa15a";
      c.beginPath();
      c.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#dfb977";
      c.beginPath();
      c.arc(s.x - s.r * 0.14, s.y - s.r * 0.14, s.r * 0.82, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "#8a6a33";
      c.lineWidth = 2.4;
      c.beginPath();
      c.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      c.stroke();
      const r2 = seededRand(s.x * 7 + s.y);
      c.fillStyle = "rgba(138,106,51,0.5)";
      for (let i = 0; i < 14; i++) {
        const a = r2() * Math.PI * 2;
        const rr = r2() * s.r * 0.75;
        c.fillRect(s.x + Math.cos(a) * rr, s.y + Math.sin(a) * rr, 3, 3);
      }
      c.restore();
    }

    // tường gạch tím: cạnh poly + tường trong
    const wallSegs = [];
    for (let i = 0; i < def.poly.length; i++) {
      const a = def.poly[i];
      const b = def.poly[(i + 1) % def.poly.length];
      wallSegs.push([a[0], a[1], b[0], b[1]]);
    }
    for (const w of def.walls || []) wallSegs.push(w);
    for (const [x1, y1, x2, y2] of wallSegs) {
      const len = Math.hypot(x2 - x1, y2 - y1);
      const a = Math.atan2(y2 - y1, x2 - x1);
      c.save();
      c.translate(x1, y1);
      c.rotate(a);
      // bóng đổ
      c.fillStyle = "rgba(4,4,16,0.55)";
      c.fillRect(-7, 4, len + 14, 8);
      // thân tường
      const wg = c.createLinearGradient(0, -8, 0, 8);
      wg.addColorStop(0, "#9a5ae8");
      wg.addColorStop(0.55, "#6c2fc4");
      wg.addColorStop(1, "#4a1f8a");
      c.fillStyle = wg;
      c.fillRect(-7, -8, len + 14, 16);
      // khối gạch
      c.strokeStyle = "rgba(30,10,60,0.65)";
      c.lineWidth = 1.6;
      for (let d = 0; d < len + 14; d += 26) {
        c.beginPath();
        c.moveTo(-7 + d, -8);
        c.lineTo(-7 + d, 8);
        c.stroke();
      }
      c.strokeStyle = "rgba(220,180,255,0.5)";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(-7, -8);
      c.lineTo(len + 7, -8);
      c.stroke();
      c.restore();
    }

    bgHoleId = def.id;
  }

  /* ---------- vẽ động ---------- */

  function drawPortal(cxy, color, time, flip) {
    g.save();
    g.translate(cxy.x, cxy.y);
    g.rotate(Math.sin(time * 1.4) * 0.08);
    g.shadowColor = color;
    g.shadowBlur = 16;
    g.strokeStyle = color;
    g.lineWidth = 5;
    g.beginPath();
    g.ellipse(0, 0, PORTAL_R * (flip ? 0.72 : 0.78), PORTAL_R * 1.15, 0, 0, Math.PI * 2);
    g.stroke();
    g.shadowBlur = 0;
    g.strokeStyle = "rgba(255,255,255,0.65)";
    g.lineWidth = 1.6;
    g.beginPath();
    g.ellipse(0, 0, PORTAL_R * 0.45, PORTAL_R * 0.8, 0, 0, Math.PI * 2);
    g.stroke();
    g.restore();
  }

  function draw(def, hs, ui, time) {
    if (!bgCanvas || bgHoleId !== def.id || bgCanvas.width !== canvas.width) paintBg(def);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(bgCanvas, 0, 0);
    g.setTransform(scale, 0, 0, scale, offX, offY);

    // bumper vòng neon + mũi tên quay
    for (const b of def.bumpers || []) {
      g.save();
      g.translate(b.x, b.y);
      g.fillStyle = "#12102c";
      g.beginPath();
      g.arc(0, 0, b.r, 0, Math.PI * 2);
      g.fill();
      g.shadowColor = "#ff2ee6";
      g.shadowBlur = 12;
      g.strokeStyle = "#ff2ee6";
      g.lineWidth = 3.4;
      g.beginPath();
      g.arc(0, 0, b.r - 2, 0, Math.PI * 2);
      g.stroke();
      g.shadowBlur = 0;
      g.strokeStyle = "#ffd23f";
      g.lineWidth = 2;
      g.beginPath();
      g.arc(0, 0, b.r * 0.55, 0, Math.PI * 2);
      g.stroke();
      g.rotate(time * 1.6);
      g.fillStyle = "rgba(255,210,63,0.9)";
      for (let i = 0; i < 4; i++) {
        g.rotate(Math.PI / 2);
        g.beginPath();
        g.moveTo(b.r * 0.78, 0);
        g.lineTo(b.r * 0.58, -4);
        g.lineTo(b.r * 0.58, 4);
        g.closePath();
        g.fill();
      }
      g.restore();
    }

    // cổng trượt: trụ + thanh laser đỏ
    for (const gate of def.gates || []) {
      for (const [px2, py2] of [[gate.x1, gate.y1], [gate.x2, gate.y2]]) {
        g.fillStyle = "#241645";
        g.fillRect(px2 - 7, py2 - 7, 14, 14);
        g.strokeStyle = "#9a5ae8";
        g.lineWidth = 2;
        g.strokeRect(px2 - 7, py2 - 7, 14, 14);
        g.fillStyle = "#ff3b4f";
        g.fillRect(px2 - 2.4, py2 - 2.4, 4.8, 4.8);
      }
      const [x1, y1, x2, y2] = gateSegment(gate, hs ? hs.time : time);
      g.save();
      g.shadowColor = "#ff2e4d";
      g.shadowBlur = 12;
      g.strokeStyle = "rgba(255,46,77,0.95)";
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(x1, y1);
      g.lineTo(x2, y2);
      g.stroke();
      g.shadowBlur = 0;
      g.strokeStyle = "rgba(255,240,244,0.9)";
      g.lineWidth = 1.6;
      g.stroke();
      g.restore();
      // mũi tên chỉ hướng trượt
      const mx = (gate.x1 + gate.x2) / 2;
      const my = (gate.y1 + gate.y2) / 2;
      g.fillStyle = "rgba(255,120,140,0.8)";
      const vert = Math.abs(gate.y2 - gate.y1) > Math.abs(gate.x2 - gate.x1);
      for (const s of [-1, 1]) {
        g.beginPath();
        if (vert) {
          g.moveTo(mx + 16, my + s * 14);
          g.lineTo(mx + 22, my + s * 8);
          g.lineTo(mx + 28, my + s * 14);
        } else {
          g.moveTo(mx + s * 14, my + 16);
          g.lineTo(mx + s * 8, my + 22);
          g.lineTo(mx + s * 14, my + 28);
        }
        g.closePath();
        g.fill();
      }
    }

    // portal + chevron nối
    for (const p of def.portals || []) {
      drawPortal(p.a, "#ff2ee6", time, false);
      drawPortal(p.b, "#20e3ff", time, true);
      const dx = p.b.x - p.a.x;
      const dy = p.b.y - p.a.y;
      const d = Math.hypot(dx, dy);
      const ux = dx / d;
      const uy = dy / d;
      const k = ((time * 40) % 26);
      g.fillStyle = "rgba(120,230,255,0.75)";
      for (let dd = PORTAL_R + 14 + k; dd < d - PORTAL_R - 12; dd += 26) {
        const cx2 = p.a.x + ux * dd;
        const cy2 = p.a.y + uy * dd;
        g.save();
        g.translate(cx2, cy2);
        g.rotate(Math.atan2(uy, ux));
        g.beginPath();
        g.moveTo(-4, -6);
        g.lineTo(4, 0);
        g.lineTo(-4, 6);
        g.lineTo(-1, 0);
        g.closePath();
        g.fill();
        g.restore();
      }
    }

    // lỗ + cờ
    const hole = def.hole;
    g.save();
    g.shadowColor = "#20e3ff";
    g.shadowBlur = 10 + 4 * Math.sin(time * 3);
    g.fillStyle = "#04101c";
    g.beginPath();
    g.ellipse(hole.x, hole.y, 12, 9, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
    g.strokeStyle = "rgba(32,227,255,0.75)";
    g.lineWidth = 2;
    g.beginPath();
    g.ellipse(hole.x, hole.y, 12, 9, 0, 0, Math.PI * 2);
    g.stroke();
    // cột cờ
    g.strokeStyle = "#e8f0ff";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(hole.x, hole.y - 2);
    g.lineTo(hole.x, hole.y - 52);
    g.stroke();
    const wave = Math.sin(time * 4) * 3;
    g.fillStyle = "#f4f7ff";
    g.beginPath();
    g.moveTo(hole.x, hole.y - 52);
    g.lineTo(hole.x - 26, hole.y - 44 + wave);
    g.lineTo(hole.x, hole.y - 36);
    g.closePath();
    g.fill();

    if (!hs) return;
    const ball = hs.ball;

    // vệt bóng
    if (ui.trail) {
      for (let i = 0; i < ui.trail.length; i++) {
        const tr = ui.trail[i];
        g.fillStyle = `rgba(255,255,255,${(i / ui.trail.length) * 0.3})`;
        g.beginPath();
        g.arc(tr.x, tr.y, 3, 0, Math.PI * 2);
        g.fill();
      }
    }

    // khung ngắm xanh quanh bóng khi đứng yên
    if (!hs.moving && !hs.sunk) {
      const r = BALL_R + 7 + Math.sin(time * 4) * 1.5;
      g.strokeStyle = "#3dff9c";
      g.lineWidth = 2;
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        g.beginPath();
        g.moveTo(ball.x + sx * r, ball.y + sy * (r - 6));
        g.lineTo(ball.x + sx * r, ball.y + sy * r);
        g.lineTo(ball.x + sx * (r - 6), ball.y + sy * r);
        g.stroke();
      }
    }

    // mũi tên ngắm nét đứt
    if (ui.aim && ui.aim.power > 0.03 && !hs.moving && !hs.sunk) {
      const { angle, power } = ui.aim;
      const len = 60 + power * 170;
      const ex = ball.x + Math.cos(angle) * len;
      const ey = ball.y + Math.sin(angle) * len;
      g.save();
      g.strokeStyle = "rgba(255,255,255,0.9)";
      g.lineWidth = 3;
      g.setLineDash([10, 9]);
      g.lineDashOffset = -time * 30;
      g.beginPath();
      g.moveTo(ball.x + Math.cos(angle) * 14, ball.y + Math.sin(angle) * 14);
      g.lineTo(ex, ey);
      g.stroke();
      g.setLineDash([]);
      // đầu mũi tên
      g.translate(ex, ey);
      g.rotate(angle);
      g.fillStyle = "rgba(255,255,255,0.95)";
      g.beginPath();
      g.moveTo(12, 0);
      g.lineTo(-4, -8);
      g.lineTo(-4, 8);
      g.closePath();
      g.fill();
      g.restore();
    }

    // bóng
    if (!hs.sunk) {
      g.save();
      g.shadowColor = "rgba(0,0,0,0.6)";
      g.shadowBlur = 4;
      g.shadowOffsetY = 3;
      const bg2 = g.createRadialGradient(ball.x - 2, ball.y - 3, 1, ball.x, ball.y, BALL_R + 1);
      bg2.addColorStop(0, "#ffffff");
      bg2.addColorStop(0.7, "#dbe6f5");
      bg2.addColorStop(1, "#9fb2cc");
      g.fillStyle = bg2;
      g.beginPath();
      g.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  }

  return { fit, draw, toWorld, toClient };
}

/** Icon panel trái (cờ / gậy / par / sao / gió) — canvas nhỏ pixel. */
export function paintGolfIcon(canvas, kind) {
  canvas.width = 44;
  canvas.height = 44;
  const c = canvas.getContext("2d");
  c.scale(2, 2);
  if (kind === "flag") {
    c.strokeStyle = "#e8f0ff";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(8, 19);
    c.lineTo(8, 3);
    c.stroke();
    c.fillStyle = "#20e3ff";
    c.beginPath();
    c.moveTo(8, 3);
    c.lineTo(18, 7);
    c.lineTo(8, 11);
    c.closePath();
    c.fill();
  } else if (kind === "club") {
    c.strokeStyle = "#4df77f";
    c.lineWidth = 2.4;
    c.beginPath();
    c.moveTo(14, 3);
    c.lineTo(8, 16);
    c.stroke();
    c.fillStyle = "#4df77f";
    c.beginPath();
    c.roundRect(4, 15, 9, 4, 2);
    c.fill();
  } else if (kind === "par") {
    c.strokeStyle = "#9a5cff";
    c.lineWidth = 2;
    c.beginPath();
    c.arc(11, 11, 7.4, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    c.arc(11, 11, 3.6, 0, Math.PI * 2);
    c.stroke();
  } else if (kind === "star") {
    c.fillStyle = "#ff5ad2";
    c.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      const a2 = a + Math.PI / 5;
      c.lineTo(11 + Math.cos(a) * 8, 11 + Math.sin(a) * 8);
      c.lineTo(11 + Math.cos(a2) * 3.6, 11 + Math.sin(a2) * 3.6);
    }
    c.closePath();
    c.fill();
  } else if (kind === "wind") {
    c.strokeStyle = "#20e3ff";
    c.lineWidth = 2;
    for (const [y, len] of [[6, 10], [11, 14], [16, 8]]) {
      c.beginPath();
      c.moveTo(3, y);
      c.lineTo(3 + len, y);
      c.stroke();
      c.beginPath();
      c.arc(3 + len, y - 1.6, 1.8, 0.6, Math.PI * 1.8);
      c.stroke();
    }
  }
}
