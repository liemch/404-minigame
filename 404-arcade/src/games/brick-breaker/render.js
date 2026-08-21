/**
 * render.js — vẽ Brick Breaker 404 theo ảnh reference: nền bảng mạch
 * navy, khung neon cyan bo góc, gạch bevel 4 loại (cyan / tím-khiên /
 * hồng-nổ / xám-X), bóng phát sáng có vệt trail, paddle tím lõi cyan,
 * power-up rơi kèm mũi tên chevron, particle vỡ gạch.
 */

import { WORLD, BALL_R, PADDLE_Y, PADDLE_H, CELL } from "./engine.js";
import { seededRand, MONO_FONT } from "../../core/utils.js";

const COLORS = {
  frame: "#20e3ff",
  bg0: "#070a22",
  bg1: "#0a0e2e",
  normalA: "#4fe3ff",
  normalB: "#1490c2",
  reinA: "#9a6bff",
  reinB: "#5c2bd9",
  expA: "#ff4fae",
  expB: "#c9186e",
  steelA: "#4a5168",
  steelB: "#262b3d",
  ball: "#eaf9ff",
  paddleA: "#8a5cff",
  paddleB: "#4d21a8",
};

export function createBrickRenderer(canvas, box) {
  const g = canvas.getContext("2d");
  let scale = 1;
  let dpr = 1;

  function fit() {
    const rect = box.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const k = Math.min(rect.width / WORLD.w, rect.height / WORLD.h);
    const cssW = Math.floor(WORLD.w * k);
    const cssH = Math.floor(WORLD.h * k);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    scale = (cssW / WORLD.w) * dpr;
  }

  /* ---------- nền bảng mạch (vẽ 1 lần vào offscreen) ---------- */
  let bgCanvas = null;

  function paintBg() {
    bgCanvas = document.createElement("canvas");
    bgCanvas.width = canvas.width;
    bgCanvas.height = canvas.height;
    const c = bgCanvas.getContext("2d");
    c.scale(scale, scale);
    const grad = c.createLinearGradient(0, 0, 0, WORLD.h);
    grad.addColorStop(0, COLORS.bg1);
    grad.addColorStop(1, COLORS.bg0);
    c.fillStyle = grad;
    c.fillRect(0, 0, WORLD.w, WORLD.h);

    const rand = seededRand(404);
    // lưới chấm mờ
    c.fillStyle = "rgba(64,110,200,0.10)";
    for (let y = 20; y < WORLD.h; y += 34) {
      for (let x = 20; x < WORLD.w; x += 34) c.fillRect(x, y, 2, 2);
    }
    // trace mạch in
    c.strokeStyle = "rgba(32,120,220,0.13)";
    c.lineWidth = 1.6;
    for (let i = 0; i < 26; i++) {
      let x = rand() * WORLD.w;
      let y = rand() * WORLD.h;
      c.beginPath();
      c.moveTo(x, y);
      for (let k2 = 0; k2 < 3; k2++) {
        const len = 30 + rand() * 90;
        if (rand() > 0.5) x += rand() > 0.5 ? len : -len;
        else y += rand() > 0.5 ? len : -len;
        c.lineTo(x, y);
      }
      c.stroke();
      c.fillStyle = "rgba(40,140,240,0.22)";
      c.beginPath();
      c.arc(x, y, 2.4, 0, Math.PI * 2);
      c.fill();
    }
    // vignette
    const vg = c.createRadialGradient(WORLD.w / 2, WORLD.h / 2, WORLD.h * 0.3, WORLD.w / 2, WORLD.h / 2, WORLD.h * 0.95);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(2,4,14,0.55)");
    c.fillStyle = vg;
    c.fillRect(0, 0, WORLD.w, WORLD.h);
  }

  /* ---------- gạch ---------- */

  function brickColors(b) {
    if (b.type === CELL.NORMAL) return [COLORS.normalA, COLORS.normalB];
    if (b.type === CELL.REINFORCED) return [COLORS.reinA, COLORS.reinB];
    if (b.type === CELL.EXPLOSIVE) return [COLORS.expA, COLORS.expB];
    return [COLORS.steelA, COLORS.steelB];
  }

  function drawBrick(c, b, time) {
    const pad = 2;
    const x = b.x + pad;
    const y = b.y + pad;
    const w = b.w - pad * 2;
    const h = b.h - pad * 2;
    const [ca, cb] = brickColors(b);
    const grad = c.createLinearGradient(0, y, 0, y + h);
    grad.addColorStop(0, ca);
    grad.addColorStop(1, cb);
    c.fillStyle = grad;
    c.beginPath();
    c.roundRect(x, y, w, h, 4);
    c.fill();
    // bevel
    c.fillStyle = "rgba(255,255,255,0.28)";
    c.fillRect(x + 2, y + 2, w - 4, 3);
    c.fillStyle = "rgba(0,0,10,0.3)";
    c.fillRect(x + 2, y + h - 5, w - 4, 3);
    c.strokeStyle = "rgba(4,8,20,0.65)";
    c.lineWidth = 1.4;
    c.beginPath();
    c.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, 4);
    c.stroke();

    const cx = x + w / 2;
    const cy = y + h / 2;
    if (b.type === CELL.NORMAL) {
      // vân nứt mờ
      c.strokeStyle = "rgba(6,40,60,0.4)";
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(x + w * 0.22, y + 4);
      c.lineTo(x + w * 0.34, cy);
      c.lineTo(x + w * 0.24, y + h - 4);
      c.moveTo(x + w * 0.72, y + 4);
      c.lineTo(x + w * 0.62, cy + 2);
      c.stroke();
    } else if (b.type === CELL.REINFORCED) {
      // icon khiên
      c.fillStyle = b.hp >= 2 ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.45)";
      c.beginPath();
      c.moveTo(cx, cy - 8);
      c.lineTo(cx + 6, cy - 5);
      c.lineTo(cx + 6, cy + 2);
      c.quadraticCurveTo(cx + 6, cy + 6, cx, cy + 9);
      c.quadraticCurveTo(cx - 6, cy + 6, cx - 6, cy + 2);
      c.lineTo(cx - 6, cy - 5);
      c.closePath();
      c.fill();
      if (b.hp < 2) {
        // đã nứt
        c.strokeStyle = "rgba(10,4,30,0.6)";
        c.lineWidth = 1.4;
        c.beginPath();
        c.moveTo(x + 4, y + 4);
        c.lineTo(cx - 3, cy);
        c.lineTo(x + 6, y + h - 4);
        c.moveTo(x + w - 5, y + 3);
        c.lineTo(cx + 4, cy + 3);
        c.stroke();
      }
    } else if (b.type === CELL.EXPLOSIVE) {
      // icon nổ 8 cánh
      c.save();
      c.translate(cx, cy);
      c.fillStyle = "rgba(255,255,255,0.92)";
      c.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI / 4) * i;
        const r1 = 8;
        const r2 = 3.4;
        c.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
        c.lineTo(Math.cos(a + Math.PI / 8) * r2, Math.sin(a + Math.PI / 8) * r2);
      }
      c.closePath();
      c.fill();
      c.fillStyle = COLORS.expB;
      c.beginPath();
      c.arc(0, 0, 2.4, 0, Math.PI * 2);
      c.fill();
      c.restore();
      // nhấp nháy nhẹ
      const pulse = 0.5 + 0.5 * Math.sin(time * 4 + b.gx * 1.3);
      c.strokeStyle = `rgba(255,120,190,${0.25 + pulse * 0.3})`;
      c.lineWidth = 1;
      c.beginPath();
      c.roundRect(x + 1.5, y + 1.5, w - 3, h - 3, 3);
      c.stroke();
    } else {
      // bất hoại: giằng X + đinh tán
      c.strokeStyle = "rgba(140,150,175,0.65)";
      c.lineWidth = 2.4;
      c.beginPath();
      c.moveTo(x + 6, y + 5);
      c.lineTo(x + w - 6, y + h - 5);
      c.moveTo(x + w - 6, y + 5);
      c.lineTo(x + 6, y + h - 5);
      c.stroke();
      c.fillStyle = "rgba(170,180,205,0.8)";
      for (const [rx, ry] of [[x + 5, y + 5], [x + w - 5, y + 5], [x + 5, y + h - 5], [x + w - 5, y + h - 5]]) {
        c.beginPath();
        c.arc(rx, ry, 1.8, 0, Math.PI * 2);
        c.fill();
      }
    }
  }

  /* ---------- power-up ---------- */

  const POWER_TONE = {
    multi: "#4df77f",
    wide: "#ffd23f",
    slow: "#20e3ff",
    laser: "#ff2ee6",
    life: "#ff5d7e",
  };

  function drawPowerGlyph(c, type) {
    c.fillStyle = "#fff";
    c.strokeStyle = "#fff";
    c.lineWidth = 2;
    if (type === "multi") {
      c.font = `800 13px ${MONO_FONT}`;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText("x2", 0, 1);
    } else if (type === "wide") {
      c.beginPath();
      c.moveTo(-10, 0);
      c.lineTo(10, 0);
      c.stroke();
      for (const s of [-1, 1]) {
        c.beginPath();
        c.moveTo(s * 10, 0);
        c.lineTo(s * 5, -4);
        c.moveTo(s * 10, 0);
        c.lineTo(s * 5, 4);
        c.stroke();
      }
    } else if (type === "slow") {
      c.beginPath();
      c.arc(0, 0, 7, 0, Math.PI * 2);
      c.stroke();
      c.beginPath();
      c.moveTo(0, -4);
      c.lineTo(0, 0);
      c.lineTo(4, 2);
      c.stroke();
    } else if (type === "laser") {
      c.beginPath();
      c.moveTo(-4, -8);
      c.lineTo(-4, 8);
      c.moveTo(4, -8);
      c.lineTo(4, 8);
      c.stroke();
    } else {
      // life: trái tim
      c.beginPath();
      c.moveTo(0, 6);
      c.bezierCurveTo(-9, -1, -6, -8, 0, -3);
      c.bezierCurveTo(6, -8, 9, -1, 0, 6);
      c.fill();
    }
  }

  function drawPowerup(c, p, time) {
    const tone = POWER_TONE[p.type] || "#fff";
    const sway = Math.sin(p.phase) * 5;
    c.save();
    c.translate(p.x + sway, p.y);
    // vệt lấp lánh phía trên
    c.strokeStyle = tone;
    c.globalAlpha = 0.35;
    c.lineWidth = 2;
    for (const dx of [-6, 0, 6]) {
      c.beginPath();
      c.moveTo(dx, -20 - (dx === 0 ? 8 : 0));
      c.lineTo(dx, -34 - (dx === 0 ? 10 : 0));
      c.stroke();
    }
    c.globalAlpha = 1;
    // thân: wide/laser dạng viên nang, còn lại hình tròn
    c.shadowColor = tone;
    c.shadowBlur = 14;
    c.fillStyle = "rgba(6,10,26,0.95)";
    c.strokeStyle = tone;
    c.lineWidth = 2.4;
    c.beginPath();
    if (p.type === "wide" || p.type === "laser") c.roundRect(-17, -11, 34, 22, 11);
    else c.arc(0, 0, 15, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.shadowBlur = 0;
    drawPowerGlyph(c, p.type);
    // chevron rơi phía dưới
    const cv = (time * 26) % 10;
    c.strokeStyle = tone;
    c.globalAlpha = 0.85;
    c.lineWidth = 2.6;
    c.beginPath();
    c.moveTo(-6, 20 + cv * 0.4);
    c.lineTo(0, 25 + cv * 0.4);
    c.lineTo(6, 20 + cv * 0.4);
    c.stroke();
    c.restore();
  }

  /* ---------- vẽ chính ---------- */

  function draw(m, fx, time) {
    if (!bgCanvas || bgCanvas.width !== canvas.width || bgCanvas.height !== canvas.height) paintBg();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(bgCanvas, 0, 0);
    g.setTransform(scale, 0, 0, scale, 0, 0);

    // khung neon bo góc
    g.strokeStyle = COLORS.frame;
    g.lineWidth = 2.4;
    g.shadowColor = COLORS.frame;
    g.shadowBlur = 12;
    g.beginPath();
    g.roundRect(4, 4, WORLD.w - 8, WORLD.h - 8, 16);
    g.stroke();
    g.shadowBlur = 0;
    g.strokeStyle = "rgba(32,227,255,0.28)";
    g.lineWidth = 1;
    g.beginPath();
    g.roundRect(9, 9, WORLD.w - 18, WORLD.h - 18, 12);
    g.stroke();
    // ngoặc góc
    g.strokeStyle = COLORS.frame;
    g.lineWidth = 3;
    for (const [cx, cy, sx, sy] of [[4, 4, 1, 1], [WORLD.w - 4, 4, -1, 1], [4, WORLD.h - 4, 1, -1], [WORLD.w - 4, WORLD.h - 4, -1, -1]]) {
      g.beginPath();
      g.moveTo(cx + sx * 26, cy);
      g.lineTo(cx + sx * 4, cy);
      g.quadraticCurveTo(cx, cy, cx, cy + sy * 4);
      g.lineTo(cx, cy + sy * 26);
      g.stroke();
    }

    // gạch
    for (const b of m.lv.bricks) {
      if (b.alive) drawBrick(g, b, time);
    }

    // đạn laser
    for (const L of m.lasers) {
      g.strokeStyle = "#ff2ee6";
      g.shadowColor = "#ff2ee6";
      g.shadowBlur = 8;
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(L.x, L.y);
      g.lineTo(L.x, L.y + 16);
      g.stroke();
      g.shadowBlur = 0;
    }

    // power-up
    for (const p of m.powerups) drawPowerup(g, p, time);

    // particle
    for (const pt of fx.particles) {
      g.globalAlpha = Math.max(0, pt.life / pt.life0);
      g.fillStyle = pt.color;
      g.save();
      g.translate(pt.x, pt.y);
      g.rotate(pt.rot);
      g.fillRect(-pt.size / 2, -pt.size / 2, pt.size, pt.size * 0.7);
      g.restore();
    }
    g.globalAlpha = 1;

    // vòng nổ
    for (const ring of fx.rings) {
      const t = 1 - ring.life / ring.life0;
      g.strokeStyle = ring.color;
      g.globalAlpha = Math.max(0, ring.life / ring.life0);
      g.lineWidth = 3.4 * (1 - t) + 0.6;
      g.beginPath();
      g.arc(ring.x, ring.y, 8 + t * 64, 0, Math.PI * 2);
      g.stroke();
    }
    g.globalAlpha = 1;

    // trail bóng
    for (const ball of m.balls) {
      if (!ball.trail) continue;
      for (let i = 0; i < ball.trail.length; i++) {
        const tr = ball.trail[i];
        const a = (i / ball.trail.length) * 0.5;
        const r = BALL_R * (0.35 + (i / ball.trail.length) * 0.55);
        g.fillStyle = `rgba(90,210,255,${a.toFixed(3)})`;
        g.beginPath();
        g.arc(tr.x, tr.y, r, 0, Math.PI * 2);
        g.fill();
      }
    }

    // bóng
    for (const ball of m.balls) {
      g.save();
      g.shadowColor = "#7ce6ff";
      g.shadowBlur = 16;
      const bg2 = g.createRadialGradient(ball.x - 2, ball.y - 3, 1, ball.x, ball.y, BALL_R + 1);
      bg2.addColorStop(0, "#ffffff");
      bg2.addColorStop(0.55, COLORS.ball);
      bg2.addColorStop(1, "#48b8e8");
      g.fillStyle = bg2;
      g.beginPath();
      g.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
      g.fill();
      g.restore();
      // mũi tên phóng khi bóng dính paddle
      if (ball.stuck) {
        const bob = Math.sin(time * 5) * 4;
        g.strokeStyle = "rgba(140,230,255,0.8)";
        g.setLineDash([5, 7]);
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(ball.x, ball.y - 16);
        g.lineTo(ball.x, ball.y - 74 - bob);
        g.stroke();
        g.setLineDash([]);
        g.beginPath();
        g.moveTo(ball.x - 7, ball.y - 66 - bob);
        g.lineTo(ball.x, ball.y - 78 - bob);
        g.lineTo(ball.x + 7, ball.y - 66 - bob);
        g.stroke();
      }
    }

    // paddle (tím phát sáng, lõi cyan — theo ảnh)
    const p = m.paddle;
    const px = p.x - p.w / 2;
    g.save();
    g.shadowColor = COLORS.paddleA;
    g.shadowBlur = 18;
    const pg = g.createLinearGradient(0, PADDLE_Y, 0, PADDLE_Y + PADDLE_H);
    pg.addColorStop(0, COLORS.paddleA);
    pg.addColorStop(1, COLORS.paddleB);
    g.fillStyle = pg;
    g.beginPath();
    g.roundRect(px, PADDLE_Y, p.w, PADDLE_H, 9);
    g.fill();
    g.restore();
    g.strokeStyle = "rgba(220,190,255,0.75)";
    g.lineWidth = 1.4;
    g.beginPath();
    g.roundRect(px + 0.5, PADDLE_Y + 0.5, p.w - 1, PADDLE_H - 1, 9);
    g.stroke();
    // lõi cyan giữa
    g.save();
    g.shadowColor = COLORS.frame;
    g.shadowBlur = 10;
    g.fillStyle = m.timers.laser > 0 ? "#ff2ee6" : COLORS.frame;
    g.beginPath();
    g.roundRect(p.x - p.w * 0.2, PADDLE_Y + PADDLE_H / 2 - 3, p.w * 0.4, 6, 3);
    g.fill();
    g.restore();
    // vát mũi hai đầu
    g.fillStyle = "rgba(230,214,255,0.85)";
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(p.x + s * (p.w / 2 - 4), PADDLE_Y + 3);
      g.lineTo(p.x + s * (p.w / 2 - 12), PADDLE_Y + PADDLE_H / 2);
      g.lineTo(p.x + s * (p.w / 2 - 4), PADDLE_Y + PADDLE_H - 3);
      g.closePath();
      g.fill();
    }
    // súng laser hai đầu paddle khi active
    if (m.timers.laser > 0) {
      g.fillStyle = "#ff2ee6";
      for (const s of [-1, 1]) {
        g.fillRect(p.x + s * (p.w / 2 - 12) - 2.4, PADDLE_Y - 8, 4.8, 9);
      }
    }
  }

  return { fit, draw, get scale() { return scale; }, get dpr() { return dpr; } };
}

/** Icon chú giải sidebar (canvas nhỏ 30×22 kiểu gạch tương ứng). */
export function paintBrickLegend(canvas, kind) {
  canvas.width = 60;
  canvas.height = 44;
  const c = canvas.getContext("2d");
  c.scale(2, 2);
  const map = {
    normal: [COLORS.normalA, COLORS.normalB],
    reinforced: [COLORS.reinA, COLORS.reinB],
    explosive: [COLORS.expA, COLORS.expB],
    steel: [COLORS.steelA, COLORS.steelB],
  };
  const [ca, cb] = map[kind];
  const grad = c.createLinearGradient(0, 0, 0, 22);
  grad.addColorStop(0, ca);
  grad.addColorStop(1, cb);
  c.fillStyle = grad;
  c.beginPath();
  c.roundRect(1, 1, 28, 20, 3);
  c.fill();
  c.fillStyle = "rgba(255,255,255,0.3)";
  c.fillRect(3, 3, 24, 2);
  const cx = 15;
  const cy = 11;
  c.fillStyle = "rgba(255,255,255,0.9)";
  c.strokeStyle = "rgba(255,255,255,0.85)";
  if (kind === "reinforced") {
    c.beginPath();
    c.moveTo(cx, cy - 5);
    c.lineTo(cx + 4, cy - 3);
    c.lineTo(cx + 4, cy + 1);
    c.quadraticCurveTo(cx + 4, cy + 4, cx, cy + 6);
    c.quadraticCurveTo(cx - 4, cy + 4, cx - 4, cy + 1);
    c.lineTo(cx - 4, cy - 3);
    c.closePath();
    c.fill();
  } else if (kind === "explosive") {
    c.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI / 4) * i;
      c.lineTo(cx + Math.cos(a) * 5.4, cy + Math.sin(a) * 5.4);
      c.lineTo(cx + Math.cos(a + Math.PI / 8) * 2.2, cy + Math.sin(a + Math.PI / 8) * 2.2);
    }
    c.closePath();
    c.fill();
  } else if (kind === "steel") {
    c.strokeStyle = "rgba(150,160,185,0.9)";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(5, 4);
    c.lineTo(25, 18);
    c.moveTo(25, 4);
    c.lineTo(5, 18);
    c.stroke();
  }
}
