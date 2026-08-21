/**
 * render.js — vẽ Astro Patrol 404 theo ảnh reference: nền sao + tinh
 * vân tím parallax, asteroid đá xám điểm tinh thể tím, tàu người chơi
 * trắng-xanh lửa cyan, địch tam giác đèn xanh lá / tím, boss lục giác
 * mắt đỏ, đạn cyan / cam / hồng, pickup lục giác khiên & tia sét.
 */

import { WORLD, PLAYER_R } from "./engine.js";
import { seededRand } from "../../core/utils.js";

export function createAstroRenderer(canvas, box) {
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
    const k = Math.max(rect.width / WORLD.w, rect.height / WORLD.h);
    scale = k * dpr;
    offX = (rect.width * dpr - WORLD.w * scale) / 2;
    offY = (rect.height * dpr - WORLD.h * scale) / 2;
  }

  function toWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) * dpr - offX) / scale,
      y: ((clientY - rect.top) * dpr - offY) / scale,
    };
  }

  /* ---------- nền tĩnh ---------- */
  let bgCanvas = null;

  function paintBg() {
    bgCanvas = document.createElement("canvas");
    bgCanvas.width = canvas.width;
    bgCanvas.height = canvas.height;
    const c = bgCanvas.getContext("2d");
    const grad = c.createLinearGradient(0, 0, 0, bgCanvas.height);
    grad.addColorStop(0, "#0a0824");
    grad.addColorStop(0.5, "#0d0a2e");
    grad.addColorStop(1, "#070619");
    c.fillStyle = grad;
    c.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
    c.setTransform(scale, 0, 0, scale, offX, offY);
    const rand = seededRand(4404);
    // tinh vân
    for (const [x, y, r, col] of [
      [200, 180, 260, "rgba(110,50,200,0.13)"],
      [760, 420, 300, "rgba(160,40,180,0.10)"],
      [500, 90, 220, "rgba(40,90,220,0.10)"],
    ]) {
      const ng = c.createRadialGradient(x, y, 10, x, y, r);
      ng.addColorStop(0, col);
      ng.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = ng;
      c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // sao xa (lớp tĩnh)
    for (let i = 0; i < 90; i++) {
      c.fillStyle = rand() > 0.85 ? "rgba(180,200,255,0.7)" : "rgba(150,160,220,0.35)";
      c.fillRect(rand() * WORLD.w, rand() * WORLD.h, 1.6, 1.6);
    }
  }

  /* ---------- vẽ thành phần ---------- */

  const rocks = new Map(); // seed → offscreen asteroid sprite

  function rockSprite(a) {
    let spr = rocks.get(a.seed);
    if (spr) return spr;
    const s = Math.ceil(a.r * 2.4);
    spr = document.createElement("canvas");
    spr.width = s;
    spr.height = s;
    const c = spr.getContext("2d");
    const rand = seededRand(a.seed);
    c.translate(s / 2, s / 2);
    // khối đá đa giác
    c.beginPath();
    const n = 9;
    for (let i = 0; i < n; i++) {
      const ang = (Math.PI * 2 * i) / n;
      const rr = a.r * (0.78 + rand() * 0.3);
      c.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
    }
    c.closePath();
    const rg = c.createLinearGradient(-a.r, -a.r, a.r, a.r);
    rg.addColorStop(0, "#8a8fa8");
    rg.addColorStop(0.55, "#585e75");
    rg.addColorStop(1, "#2e3245");
    c.fillStyle = rg;
    c.fill();
    c.strokeStyle = "rgba(20,22,38,0.8)";
    c.lineWidth = 2;
    c.stroke();
    // hố lõm
    for (let i = 0; i < 4; i++) {
      const ang = rand() * Math.PI * 2;
      const rr = rand() * a.r * 0.5;
      c.fillStyle = "rgba(28,30,48,0.55)";
      c.beginPath();
      c.arc(Math.cos(ang) * rr, Math.sin(ang) * rr, 2 + rand() * a.r * 0.2, 0, Math.PI * 2);
      c.fill();
    }
    // tinh thể tím
    if (rand() > 0.4) {
      const ang = rand() * Math.PI * 2;
      const cx = Math.cos(ang) * a.r * 0.4;
      const cy = Math.sin(ang) * a.r * 0.4;
      c.fillStyle = "#b45cff";
      c.beginPath();
      c.moveTo(cx, cy - 7);
      c.lineTo(cx + 5, cy);
      c.lineTo(cx, cy + 7);
      c.lineTo(cx - 5, cy);
      c.closePath();
      c.fill();
      c.fillStyle = "rgba(240,210,255,0.8)";
      c.fillRect(cx - 1.4, cy - 4, 2.8, 4);
    }
    rocks.set(a.seed, spr);
    return spr;
  }

  function drawPlayer(p, time) {
    if (!p.alive) return;
    if (p.inv > 0 && Math.floor(time * 14) % 2 === 0) return; // nhấp nháy i-frame
    g.save();
    g.translate(p.x, p.y);
    const bank = Math.max(-0.32, Math.min(0.32, p.vx / 900));
    g.rotate(bank);
    // lửa động cơ
    const fl = 14 + Math.sin(time * 30) * 4;
    const fg = g.createLinearGradient(0, 14, 0, 14 + fl + 10);
    fg.addColorStop(0, "rgba(120,240,255,0.95)");
    fg.addColorStop(0.5, "rgba(60,160,255,0.55)");
    fg.addColorStop(1, "rgba(60,160,255,0)");
    g.fillStyle = fg;
    g.beginPath();
    g.moveTo(-5, 13);
    g.lineTo(0, 13 + fl + 8);
    g.lineTo(5, 13);
    g.closePath();
    g.fill();
    // cánh
    g.fillStyle = "#8fa6c8";
    g.beginPath();
    g.moveTo(-4, -2);
    g.lineTo(-20, 12);
    g.lineTo(-6, 12);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(4, -2);
    g.lineTo(20, 12);
    g.lineTo(6, 12);
    g.closePath();
    g.fill();
    // thân trắng
    const bg2 = g.createLinearGradient(-6, 0, 8, 0);
    bg2.addColorStop(0, "#f4f8ff");
    bg2.addColorStop(1, "#c3d2ea");
    g.fillStyle = bg2;
    g.beginPath();
    g.moveTo(0, -20);
    g.quadraticCurveTo(9, -4, 7, 12);
    g.lineTo(-7, 12);
    g.quadraticCurveTo(-9, -4, 0, -20);
    g.closePath();
    g.fill();
    g.strokeStyle = "rgba(40,60,110,0.55)";
    g.lineWidth = 1.2;
    g.stroke();
    // buồng lái cyan
    g.save();
    g.shadowColor = "#20e3ff";
    g.shadowBlur = 7;
    g.fillStyle = "#20e3ff";
    g.beginPath();
    g.ellipse(0, -5, 3.2, 6, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
    // khiên
    if (p.shield > 0) {
      g.strokeStyle = `rgba(64,200,255,${0.16 + (p.shield / 100) * 0.2})`;
      g.lineWidth = 2.4;
      g.beginPath();
      g.ellipse(0, -2, 26, 30, 0, 0, Math.PI * 2);
      g.stroke();
    }
    g.restore();
  }

  function drawEnemy(e, time) {
    g.save();
    g.translate(e.x, e.y);
    if (e.type === "scout") {
      g.rotate(Math.sin(e.t * 2.4 + e.sway) * 0.2);
      g.fillStyle = "#1d2436";
      g.beginPath();
      g.moveTo(0, 16);
      g.lineTo(-14, -12);
      g.lineTo(0, -5);
      g.lineTo(14, -12);
      g.closePath();
      g.fill();
      g.strokeStyle = "rgba(90,110,150,0.8)";
      g.lineWidth = 1.4;
      g.stroke();
      // đèn xanh lá
      g.save();
      g.shadowColor = "#4df77f";
      g.shadowBlur = 6;
      g.fillStyle = "#4df77f";
      g.fillRect(-11, -11, 5, 2.6);
      g.fillRect(6, -11, 5, 2.6);
      g.restore();
    } else if (e.type === "shooter") {
      g.fillStyle = "#241a3e";
      g.beginPath();
      g.moveTo(0, 18);
      g.lineTo(-17, -8);
      g.lineTo(-6, -14);
      g.lineTo(6, -14);
      g.lineTo(17, -8);
      g.closePath();
      g.fill();
      g.strokeStyle = "rgba(154,92,255,0.8)";
      g.lineWidth = 1.6;
      g.stroke();
      g.save();
      g.shadowColor = "#9a5cff";
      g.shadowBlur = 7;
      g.fillStyle = "#b9a0ff";
      g.fillRect(-12, -8, 6, 3);
      g.fillRect(6, -8, 6, 3);
      g.restore();
      // nòng đỏ
      g.fillStyle = "#ff4f64";
      g.beginPath();
      g.arc(0, 8, 4 + Math.sin(time * 6) * 0.8, 0, Math.PI * 2);
      g.fill();
    } else {
      // charger: tam giác tím nhọn, telegraph nhấp nháy đỏ
      const warn = e.state === "aim";
      g.rotate(e.state === "dash" ? Math.atan2(e.vy, e.vx) - Math.PI / 2 : 0);
      g.fillStyle = warn && Math.floor(time * 10) % 2 === 0 ? "#59162e" : "#2a1236";
      g.beginPath();
      g.moveTo(0, 18);
      g.lineTo(-13, -14);
      g.lineTo(0, -7);
      g.lineTo(13, -14);
      g.closePath();
      g.fill();
      g.strokeStyle = warn ? "#ff4f64" : "rgba(228,92,255,0.85)";
      g.lineWidth = 1.8;
      g.stroke();
      g.save();
      g.shadowColor = warn ? "#ff4f64" : "#e45cff";
      g.shadowBlur = 8;
      g.fillStyle = warn ? "#ff4f64" : "#e45cff";
      g.beginPath();
      g.arc(0, 0, 3.4, 0, Math.PI * 2);
      g.fill();
      g.restore();
      if (warn) {
        g.strokeStyle = "rgba(255,79,100,0.5)";
        g.setLineDash([5, 6]);
        g.beginPath();
        g.moveTo(0, 18);
        g.lineTo(0, 130);
        g.stroke();
        g.setLineDash([]);
      }
    }
    g.restore();
  }

  function drawBoss(boss, time) {
    g.save();
    g.translate(boss.x, boss.y);
    const r = boss.r;
    const p2 = boss.phase === 2;
    // quầng
    g.save();
    g.shadowColor = p2 ? "#ff2e96" : "#9a5cff";
    g.shadowBlur = 26;
    // thân lục giác lớn
    g.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i + Math.PI / 6;
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath();
    const bg2 = g.createLinearGradient(0, -r, 0, r);
    bg2.addColorStop(0, "#3a4260");
    bg2.addColorStop(0.5, "#242b45");
    bg2.addColorStop(1, "#141a30");
    g.fillStyle = bg2;
    g.fill();
    g.restore();
    g.strokeStyle = p2 ? "rgba(255,80,150,0.85)" : "rgba(140,150,210,0.7)";
    g.lineWidth = 2.6;
    g.stroke();
    // pod súng hai bên
    for (const s of [-1, 1]) {
      g.fillStyle = "#1b2138";
      g.beginPath();
      g.roundRect(s * (r - 6) - 12, -14, 24, 34, 6);
      g.fill();
      g.strokeStyle = "rgba(120,130,180,0.6)";
      g.lineWidth = 1.4;
      g.stroke();
      g.fillStyle = boss.telegraph > 0 ? "#ffb347" : "#5a6488";
      g.fillRect(s * (r - 6) - 4, 16, 8, 9);
    }
    // vòng lõi
    g.strokeStyle = "rgba(150,160,220,0.5)";
    g.lineWidth = 2;
    g.beginPath();
    g.arc(0, 0, r * 0.55, 0, Math.PI * 2);
    g.stroke();
    g.save();
    g.rotate(boss.sway);
    g.strokeStyle = p2 ? "rgba(255,46,150,0.55)" : "rgba(154,92,255,0.5)";
    g.setLineDash([10, 8]);
    g.beginPath();
    g.arc(0, 0, r * 0.72, 0, Math.PI * 2);
    g.stroke();
    g.setLineDash([]);
    g.restore();
    // mắt đỏ (telegraph phóng to + nhấp nháy)
    const eyeR = r * 0.26 + (boss.telegraph > 0 ? Math.sin(time * 22) * 3 + 3 : 0);
    g.save();
    g.shadowColor = "#ff2438";
    g.shadowBlur = 18;
    const eg = g.createRadialGradient(0, 0, 2, 0, 0, eyeR);
    eg.addColorStop(0, "#ffd9de");
    eg.addColorStop(0.4, "#ff4453");
    eg.addColorStop(1, "#7a0f22");
    g.fillStyle = eg;
    g.beginPath();
    g.arc(0, 0, eyeR, 0, Math.PI * 2);
    g.fill();
    g.restore();
    g.restore();
  }

  function drawPickup(pk, time) {
    g.save();
    g.translate(pk.x + Math.sin(pk.phase) * 5, pk.y);
    const tone = pk.kind === "shield" ? "#3b9dff" : "#ff2e96";
    g.save();
    g.shadowColor = tone;
    g.shadowBlur = 12;
    g.strokeStyle = tone;
    g.lineWidth = 2.4;
    g.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      g.lineTo(Math.cos(a) * 15, Math.sin(a) * 15);
    }
    g.closePath();
    g.stroke();
    g.fillStyle = "rgba(8,10,26,0.9)";
    g.fill();
    g.restore();
    if (pk.kind === "shield") {
      g.fillStyle = tone;
      g.beginPath();
      g.moveTo(0, -8);
      g.lineTo(7, -4);
      g.lineTo(7, 2);
      g.quadraticCurveTo(7, 7, 0, 9);
      g.quadraticCurveTo(-7, 7, -7, 2);
      g.lineTo(-7, -4);
      g.closePath();
      g.fill();
    } else {
      g.fillStyle = tone;
      g.beginPath();
      g.moveTo(2.4, -9);
      g.lineTo(-5, 1.6);
      g.lineTo(-0.6, 1.6);
      g.lineTo(-2.4, 9);
      g.lineTo(5, -1.6);
      g.lineTo(0.6, -1.6);
      g.closePath();
      g.fill();
    }
    g.restore();
  }

  /* ---------- vẽ chính ---------- */

  function draw(sim, fx, time) {
    if (!bgCanvas || bgCanvas.width !== canvas.width) paintBg();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(bgCanvas, 0, 0);
    g.setTransform(scale, 0, 0, scale, offX, offY);

    // 2 lớp sao parallax cuộn xuống
    const rand = seededRand(77);
    for (let layer = 0; layer < 2; layer++) {
      const speed = layer === 0 ? 26 : 60;
      const n = layer === 0 ? 40 : 26;
      g.fillStyle = layer === 0 ? "rgba(190,205,255,0.4)" : "rgba(240,246,255,0.75)";
      for (let i = 0; i < n; i++) {
        const x = rand() * WORLD.w;
        const y = (rand() * WORLD.h + time * speed) % WORLD.h;
        g.fillRect(x, y, layer === 0 ? 1.6 : 2.2, layer === 0 ? 1.6 : 3);
      }
    }

    for (const a of sim.asteroids) {
      const spr = rockSprite(a);
      g.save();
      g.translate(a.x, a.y);
      g.rotate(a.rot);
      g.drawImage(spr, -spr.width / 2, -spr.height / 2);
      g.restore();
    }

    for (const pk of sim.pickups) drawPickup(pk, time);
    for (const e of sim.enemies) drawEnemy(e, time);
    if (sim.boss) drawBoss(sim.boss, time);

    // đạn người chơi (cyan capsule)
    for (const b of sim.bullets) {
      g.save();
      g.shadowColor = "#20e3ff";
      g.shadowBlur = 8;
      const lg = g.createLinearGradient(b.x, b.y - 12, b.x, b.y + 6);
      lg.addColorStop(0, "#eaffff");
      lg.addColorStop(1, "#20b3e8");
      g.fillStyle = lg;
      g.beginPath();
      g.roundRect(b.x - 2.4, b.y - 12, 4.8, 18, 2.4);
      g.fill();
      g.restore();
    }

    // đạn địch
    for (const b of sim.ebullets) {
      g.save();
      if (b.kind === "orange") {
        g.shadowColor = "#ffab3d";
        g.shadowBlur = 8;
        const og = g.createRadialGradient(b.x, b.y, 0.5, b.x, b.y, 6);
        og.addColorStop(0, "#fff3d9");
        og.addColorStop(0.5, "#ffab3d");
        og.addColorStop(1, "rgba(255,120,40,0)");
        g.fillStyle = og;
        g.beginPath();
        g.arc(b.x, b.y, 6, 0, Math.PI * 2);
        g.fill();
      } else {
        g.shadowColor = "#ff2e96";
        g.shadowBlur = 8;
        g.fillStyle = "#ff5ab5";
        g.save();
        g.translate(b.x, b.y);
        g.rotate(Math.atan2(b.vy, b.vx) + Math.PI / 2);
        g.beginPath();
        g.ellipse(0, 0, 3.4, 7, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
      g.restore();
    }

    drawPlayer(sim.player, time);

    // particle fx
    for (const pt of fx.particles) {
      g.globalAlpha = Math.max(0, pt.life / pt.life0);
      g.fillStyle = pt.color;
      g.save();
      g.translate(pt.x, pt.y);
      g.rotate(pt.rot || 0);
      g.fillRect(-pt.size / 2, -pt.size / 2, pt.size, pt.size);
      g.restore();
    }
    g.globalAlpha = 1;
    for (const ring of fx.rings) {
      const t = 1 - ring.life / ring.life0;
      g.strokeStyle = ring.color;
      g.globalAlpha = Math.max(0, ring.life / ring.life0);
      g.lineWidth = 3 * (1 - t) + 0.8;
      g.beginPath();
      g.arc(ring.x, ring.y, ring.r0 + t * ring.grow, 0, Math.PI * 2);
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  return { fit, draw, toWorld };
}
