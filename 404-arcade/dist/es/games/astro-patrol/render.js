/**
 * render.js — vẽ Astro Patrol 404 theo ảnh reference: nền sao dày +
 * tinh vân tím hồng parallax, asteroid đá xanh-xám điểm cụm tinh thể
 * tím phát sáng, tàu người chơi trắng-xanh 2 luồng lửa cyan, địch
 * tam giác neon xanh lá / tím / hồng, boss lục giác giáp nhiều lớp
 * mắt đỏ đồng tâm + pod súng cam, đạn cyan / cam / hồng phát sáng,
 * pickup lục giác khiên xanh & tia sét hồng.
 */

import { WORLD, PLAYER_R } from "./engine.js";
import { seededRand } from "../../core/utils.js";
import { loadSprites } from "./assets.js";

/* Sprite cắt từ ảnh tham chiếu — nạp 1 lần ở mức module; render fallback
   nét vẽ vector cũ cho tới khi từng ảnh decode xong. */
const readyFns = new Set();
let spritesReady = false;
const IMGS = loadSprites(() => {
  spritesReady = true;
  for (const fn of readyFns) fn();
  readyFns.clear();
});

/* Biến thể xoay màu (charger = shooter ngả magenta, boss phase 2 ngả hồng). */
const tintCache = new Map();
function tinted(key, img, filter) {
  let cv = tintCache.get(key);
  if (!cv) {
    cv = document.createElement("canvas");
    cv.width = img.width;
    cv.height = img.height;
    const c = cv.getContext("2d");
    c.filter = filter;
    c.drawImage(img, 0, 0);
    tintCache.set(key, cv);
  }
  return cv;
}

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
    // contain: thấy trọn thế giới (boss không bị cắt); nền sao phủ toàn canvas
    const k = Math.min(rect.width / WORLD.w, rect.height / WORLD.h);
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
    const W = bgCanvas.width;
    const H = bgCanvas.height;
    const grad = c.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#0c0930");
    grad.addColorStop(0.5, "#100b38");
    grad.addColorStop(1, "#080620");
    c.fillStyle = grad;
    c.fillRect(0, 0, W, H);
    const rand = seededRand(4404);
    // tinh vân tím hồng đậm như ảnh (tọa độ theo tỉ lệ canvas)
    for (const [fx, fy, fr, col] of [
      [0.18, 0.3, 0.42, "rgba(120,50,220,0.26)"],
      [0.82, 0.68, 0.46, "rgba(190,40,190,0.2)"],
      [0.52, 0.14, 0.36, "rgba(50,90,230,0.19)"],
      [0.3, 0.9, 0.42, "rgba(150,40,220,0.2)"],
      [0.92, 0.18, 0.32, "rgba(90,40,200,0.17)"],
    ]) {
      const x = fx * W;
      const y = fy * H;
      const r = fr * H;
      const ng = c.createRadialGradient(x, y, 10, x, y, r);
      ng.addColorStop(0, col);
      ng.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = ng;
      c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // sao xa dày đặc nhiều màu — phủ toàn canvas
    const sk = Math.max(1, (W * H) / (1280 * 720));
    for (let i = 0; i < 300 * sk; i++) {
      const r = rand();
      c.fillStyle =
        r > 0.94 ? "rgba(140,220,255,0.9)" : r > 0.87 ? "rgba(255,150,230,0.7)" : r > 0.72 ? "rgba(200,210,255,0.65)" : "rgba(150,160,220,0.32)";
      const s = (r > 0.9 ? 2.4 : 1.6) * dpr;
      c.fillRect(rand() * W, rand() * H, s, s);
    }
    // vài sao chữ thập lấp lánh
    for (let i = 0; i < 9; i++) {
      const x = rand() * W;
      const y = rand() * H;
      c.fillStyle = "rgba(220,235,255,0.7)";
      c.fillRect(x - 3.4 * dpr, y, 8.4 * dpr, 1.6 * dpr);
      c.fillRect(x, y - 3.4 * dpr, 1.6 * dpr, 8.4 * dpr);
    }
  }

  /* ---------- asteroid sprite ---------- */

  const rocks = new Map(); // seed → offscreen asteroid sprite

  // khi asset decode xong: dựng lại sprite đá từ ảnh thật
  if (!spritesReady) readyFns.add(() => rocks.clear());

  function rockSprite(a) {
    let spr = rocks.get(a.seed);
    if (spr) return spr;
    const variants = [IMGS.rockA, IMGS.rockB, IMGS.rockC, IMGS.rockD].filter(Boolean);
    if (variants.length === 4) {
      // đá thật cắt từ ảnh: chọn biến thể theo seed, scale về bán kính hitbox
      const im = variants[Math.abs(Math.floor(a.seed)) % 4];
      const d = Math.ceil(a.r * 2.3);
      spr = document.createElement("canvas");
      spr.width = d;
      spr.height = Math.ceil(d * (im.height / im.width));
      const c = spr.getContext("2d");
      c.imageSmoothingEnabled = true;
      c.imageSmoothingQuality = "high";
      c.drawImage(im, 0, 0, spr.width, spr.height);
      rocks.set(a.seed, spr);
      return spr;
    }
    const s = Math.ceil(a.r * 3);
    spr = document.createElement("canvas");
    spr.width = s;
    spr.height = s;
    const c = spr.getContext("2d");
    const rand = seededRand(a.seed);
    c.translate(s / 2, s / 2);
    // viền sáng tím mờ quanh đá
    c.save();
    c.shadowColor = "rgba(150,90,230,0.5)";
    c.shadowBlur = a.r * 0.4;
    // khối đá đa giác
    const n = 10;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const ang = (Math.PI * 2 * i) / n;
      const rr = a.r * (0.76 + rand() * 0.3);
      pts.push([Math.cos(ang) * rr, Math.sin(ang) * rr]);
    }
    c.beginPath();
    for (const [px, py] of pts) c.lineTo(px, py);
    c.closePath();
    const rg = c.createLinearGradient(-a.r, -a.r, a.r, a.r);
    rg.addColorStop(0, "#8d93b5");
    rg.addColorStop(0.5, "#565d7d");
    rg.addColorStop(1, "#262b42");
    c.fillStyle = rg;
    c.fill();
    c.restore();
    c.strokeStyle = "rgba(18,20,36,0.85)";
    c.lineWidth = 2;
    c.beginPath();
    for (const [px, py] of pts) c.lineTo(px, py);
    c.closePath();
    c.stroke();
    // vân đá góc cạnh (đường gãy nối đỉnh)
    c.strokeStyle = "rgba(24,27,46,0.5)";
    c.lineWidth = 1.4;
    for (let i = 0; i < 3; i++) {
      const p1 = pts[Math.floor(rand() * n)];
      const p2 = pts[Math.floor(rand() * n)];
      c.beginPath();
      c.moveTo(p1[0], p1[1]);
      c.lineTo((p1[0] + p2[0]) * 0.3, (p1[1] + p2[1]) * 0.3);
      c.lineTo(p2[0], p2[1]);
      c.stroke();
    }
    // rim light phía trên-trái
    c.strokeStyle = "rgba(200,215,255,0.4)";
    c.lineWidth = 2.2;
    c.beginPath();
    for (let i = 5; i <= 8; i++) c.lineTo(pts[i % n][0], pts[i % n][1]);
    c.stroke();
    // hố lõm
    for (let i = 0; i < 5; i++) {
      const ang = rand() * Math.PI * 2;
      const rr = rand() * a.r * 0.52;
      const cr = 2 + rand() * a.r * 0.2;
      c.fillStyle = "rgba(25,27,46,0.6)";
      c.beginPath();
      c.arc(Math.cos(ang) * rr, Math.sin(ang) * rr, cr, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "rgba(140,150,190,0.25)";
      c.beginPath();
      c.arc(Math.cos(ang) * rr, Math.sin(ang) * rr - cr * 0.4, cr * 0.55, 0, Math.PI * 2);
      c.fill();
    }
    // cụm tinh thể tím phát sáng (đá to có 2–3 cụm)
    const nCry = a.r > 30 ? 3 : a.r > 22 ? 2 : rand() > 0.35 ? 1 : 0;
    for (let k = 0; k < nCry; k++) {
      const ang = rand() * Math.PI * 2;
      const cx = Math.cos(ang) * a.r * 0.42;
      const cy = Math.sin(ang) * a.r * 0.42;
      c.save();
      c.shadowColor = "#c26bff";
      c.shadowBlur = 10;
      for (let j = 0; j < 3; j++) {
        const dx = cx + (rand() - 0.5) * 9;
        const dy = cy + (rand() - 0.5) * 9;
        const h = 5 + rand() * 6;
        c.fillStyle = j === 0 ? "#b45cff" : rand() > 0.5 ? "#d18aff" : "#8f3ae8";
        c.beginPath();
        c.moveTo(dx, dy - h);
        c.lineTo(dx + h * 0.55, dy);
        c.lineTo(dx, dy + h * 0.7);
        c.lineTo(dx - h * 0.55, dy);
        c.closePath();
        c.fill();
      }
      c.restore();
      c.fillStyle = "rgba(245,220,255,0.9)";
      c.fillRect(cx - 1.2, cy - 5, 2.4, 4.4);
    }
    rocks.set(a.seed, spr);
    return spr;
  }

  /* ---------- tàu / địch / boss ---------- */

  function drawPlayer(p, time) {
    if (!p.alive) return;
    if (p.inv > 0 && Math.floor(time * 14) % 2 === 0) return; // nhấp nháy i-frame
    if (IMGS.player) {
      // tiêm kích trắng-xanh cắt từ ảnh (lửa động cơ nướng sẵn) + nhịp glow đuôi
      g.save();
      g.translate(p.x, p.y);
      const bank2 = Math.max(-0.32, Math.min(0.32, p.vx / 900));
      g.rotate(bank2);
      const w = PLAYER_R * 2 * 2.05;
      const h = w * (IMGS.player.height / IMGS.player.width);
      g.drawImage(IMGS.player, -w / 2, -h * 0.42, w, h);
      // lửa đuôi nhấp nháy (phần động vẽ code hòa với sprite)
      const fl = 0.55 + Math.sin(time * 30) * 0.25;
      const fg = g.createRadialGradient(0, h * 0.42, 1, 0, h * 0.42, 13);
      fg.addColorStop(0, `rgba(160,240,255,${0.5 * fl})`);
      fg.addColorStop(1, "rgba(60,140,255,0)");
      g.fillStyle = fg;
      g.fillRect(-14, h * 0.42 - 14, 28, 30);
      if (p.shield > 0) {
        g.strokeStyle = `rgba(64,200,255,${0.18 + (p.shield / 100) * 0.22})`;
        g.lineWidth = 2.2;
        g.beginPath();
        g.ellipse(0, -2, 27, 31, 0, 0, Math.PI * 2);
        g.stroke();
      }
      g.restore();
      return;
    }
    g.save();
    g.translate(p.x, p.y);
    const bank = Math.max(-0.32, Math.min(0.32, p.vx / 900));
    g.rotate(bank);
    g.scale(1.3, 1.3);
    // 2 luồng lửa động cơ cyan như ảnh
    const fl = 15 + Math.sin(time * 30) * 4;
    for (const s of [-1, 1]) {
      const fx0 = s * 4.6;
      const fg = g.createLinearGradient(0, 12, 0, 12 + fl + 10);
      fg.addColorStop(0, "rgba(150,245,255,0.95)");
      fg.addColorStop(0.45, "rgba(70,180,255,0.6)");
      fg.addColorStop(1, "rgba(60,140,255,0)");
      g.fillStyle = fg;
      g.beginPath();
      g.moveTo(fx0 - 3.2, 12);
      g.lineTo(fx0, 12 + fl + 8);
      g.lineTo(fx0 + 3.2, 12);
      g.closePath();
      g.fill();
    }
    // cánh xám xanh
    g.fillStyle = "#8fa6c8";
    g.beginPath();
    g.moveTo(-4, -2);
    g.lineTo(-21, 12);
    g.lineTo(-6, 12);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(4, -2);
    g.lineTo(21, 12);
    g.lineTo(6, 12);
    g.closePath();
    g.fill();
    // mũi cánh đỏ
    g.fillStyle = "#ff5d7e";
    g.beginPath();
    g.moveTo(-21, 12);
    g.lineTo(-15.5, 12);
    g.lineTo(-18, 8.4);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(21, 12);
    g.lineTo(15.5, 12);
    g.lineTo(18, 8.4);
    g.closePath();
    g.fill();
    // thân trắng
    const bg2 = g.createLinearGradient(-6, 0, 8, 0);
    bg2.addColorStop(0, "#f6faff");
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
    // sọc thân
    g.strokeStyle = "rgba(90,140,200,0.5)";
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(-5, 6);
    g.lineTo(5, 6);
    g.stroke();
    // buồng lái cyan
    g.save();
    g.shadowColor = "#20e3ff";
    g.shadowBlur = 9;
    g.fillStyle = "#20e3ff";
    g.beginPath();
    g.ellipse(0, -5, 3.4, 6.4, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(235,255,255,0.9)";
    g.beginPath();
    g.ellipse(-0.8, -7.4, 1.2, 2.2, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
    // khiên
    if (p.shield > 0) {
      g.strokeStyle = `rgba(64,200,255,${0.18 + (p.shield / 100) * 0.22})`;
      g.lineWidth = 2.2;
      g.beginPath();
      g.ellipse(0, -2, 27, 31, 0, 0, Math.PI * 2);
      g.stroke();
    }
    g.restore();
  }

  function drawEnemy(e, time) {
    if (IMGS.scout && IMGS.shooter) {
      // địch cắt từ ảnh: scout xanh lá, shooter tím, charger = shooter ngả magenta
      g.save();
      g.translate(e.x, e.y);
      if (e.type === "scout") {
        g.rotate(Math.sin(e.t * 2.4 + e.sway) * 0.2);
        const w = 42;
        const h = w * (IMGS.scout.height / IMGS.scout.width);
        g.drawImage(IMGS.scout, -w / 2, -h / 2, w, h);
      } else if (e.type === "shooter") {
        const w = 46;
        const h = w * (IMGS.shooter.height / IMGS.shooter.width);
        g.drawImage(IMGS.shooter, -w / 2, -h / 2, w, h);
        // nòng đỏ nhấp nháy (động)
        g.save();
        g.shadowColor = "#ff4f64";
        g.shadowBlur = 7;
        g.fillStyle = "rgba(255,79,100,0.9)";
        g.beginPath();
        g.arc(0, h * 0.3, 3.4 + Math.sin(time * 6) * 0.8, 0, Math.PI * 2);
        g.fill();
        g.restore();
      } else {
        const warn = e.state === "aim";
        g.rotate(e.state === "dash" ? Math.atan2(e.vy, e.vx) - Math.PI / 2 : 0);
        const im = tinted("charger", IMGS.shooter, "hue-rotate(55deg) saturate(1.25)");
        const w = 46;
        const h = w * (im.height / im.width);
        if (warn && Math.floor(time * 10) % 2 === 0) {
          g.save();
          g.shadowColor = "#ff4f64";
          g.shadowBlur = 16;
          g.drawImage(im, -w / 2, -h / 2, w, h);
          g.restore();
        } else {
          g.drawImage(im, -w / 2, -h / 2, w, h);
        }
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
      return;
    }
    g.save();
    g.translate(e.x, e.y);
    g.scale(1.22, 1.22);
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
      g.save();
      g.shadowColor = "#4df77f";
      g.shadowBlur = 7;
      g.strokeStyle = "rgba(77,247,127,0.85)";
      g.lineWidth = 1.6;
      g.stroke();
      g.restore();
      // đèn xanh lá + vàng như ảnh
      g.save();
      g.shadowColor = "#4df77f";
      g.shadowBlur = 8;
      g.fillStyle = "#4df77f";
      g.fillRect(-11.5, -11, 5.4, 2.8);
      g.fillRect(6.1, -11, 5.4, 2.8);
      g.fillStyle = "#ffd23f";
      g.fillRect(-2.4, 5, 4.8, 3);
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
      g.save();
      g.shadowColor = "#9a5cff";
      g.shadowBlur = 8;
      g.strokeStyle = "rgba(154,92,255,0.9)";
      g.lineWidth = 1.8;
      g.stroke();
      g.restore();
      g.save();
      g.shadowColor = "#9a5cff";
      g.shadowBlur = 8;
      g.fillStyle = "#c4a8ff";
      g.fillRect(-12.5, -8, 6.4, 3.2);
      g.fillRect(6.1, -8, 6.4, 3.2);
      g.fillStyle = "#20e3ff";
      g.fillRect(-2.2, -12, 4.4, 2.6);
      g.restore();
      // nòng đỏ
      g.save();
      g.shadowColor = "#ff4f64";
      g.shadowBlur = 7;
      g.fillStyle = "#ff4f64";
      g.beginPath();
      g.arc(0, 8, 4.2 + Math.sin(time * 6) * 0.8, 0, Math.PI * 2);
      g.fill();
      g.restore();
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
      g.save();
      g.shadowColor = warn ? "#ff4f64" : "#e45cff";
      g.shadowBlur = 8;
      g.strokeStyle = warn ? "#ff4f64" : "rgba(228,92,255,0.9)";
      g.lineWidth = 1.9;
      g.stroke();
      g.restore();
      g.save();
      g.shadowColor = warn ? "#ff4f64" : "#e45cff";
      g.shadowBlur = 9;
      g.fillStyle = warn ? "#ff4f64" : "#e45cff";
      g.beginPath();
      g.arc(0, 0, 3.6, 0, Math.PI * 2);
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

  function hexPath(c, r, rot = Math.PI / 6) {
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i + rot;
      c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    c.closePath();
  }

  function drawBoss(boss, time) {
    g.save();
    g.translate(boss.x, boss.y);
    const r = boss.r * 1.32; // giáp vẽ to hơn hitbox cho bề thế như ảnh
    const p2 = boss.phase === 2;

    if (IMGS.boss) {
      // thiết giáp lục giác cắt từ ảnh; phase 2 ngả hồng + telegraph chớp đỏ
      const im = p2 ? tinted("boss2", IMGS.boss, "hue-rotate(38deg) saturate(1.2) brightness(1.05)") : IMGS.boss;
      const w = r * 3.35;
      const h = w * (im.height / im.width);
      g.save();
      g.shadowColor = p2 ? "#ff2e96" : "#9a5cff";
      g.shadowBlur = 30;
      g.drawImage(im, -w / 2, -h * 0.5, w, h);
      g.restore();
      // mắt đỏ nhấp nháy khi telegraph (động)
      if (boss.telegraph > 0) {
        const eyeR = r * 0.3 + Math.sin(time * 22) * 3 + 4;
        const eg = g.createRadialGradient(0, 0, 2, 0, 0, eyeR);
        eg.addColorStop(0, "rgba(255,241,243,0.85)");
        eg.addColorStop(0.5, "rgba(255,68,83,0.55)");
        eg.addColorStop(1, "rgba(255,36,56,0)");
        g.fillStyle = eg;
        g.beginPath();
        g.arc(0, 0, eyeR, 0, Math.PI * 2);
        g.fill();
      }
      // vòng nét đứt quay quanh lõi (động)
      g.save();
      g.rotate(boss.sway);
      g.strokeStyle = p2 ? "rgba(255,46,150,0.5)" : "rgba(154,92,255,0.45)";
      g.setLineDash([11, 9]);
      g.lineWidth = 2.4;
      g.beginPath();
      g.arc(0, 0, r * 0.72, 0, Math.PI * 2);
      g.stroke();
      g.restore();
      g.restore();
      return;
    }

    // quầng
    g.save();
    g.shadowColor = p2 ? "#ff2e96" : "#9a5cff";
    g.shadowBlur = 34;
    hexPath(g, r);
    const bg2 = g.createLinearGradient(0, -r, 0, r);
    bg2.addColorStop(0, "#454e70");
    bg2.addColorStop(0.5, "#272e4c");
    bg2.addColorStop(1, "#131830");
    g.fillStyle = bg2;
    g.fill();
    g.restore();
    g.strokeStyle = p2 ? "rgba(255,80,150,0.9)" : "rgba(150,160,220,0.8)";
    g.lineWidth = 3;
    hexPath(g, r);
    g.stroke();

    // lớp giáp trong + đường ghép tấm
    hexPath(g, r * 0.78);
    const ig = g.createLinearGradient(0, -r * 0.78, 0, r * 0.78);
    ig.addColorStop(0, "#3a4364");
    ig.addColorStop(1, "#1a2038");
    g.fillStyle = ig;
    g.fill();
    g.strokeStyle = "rgba(120,130,180,0.5)";
    g.lineWidth = 1.6;
    g.stroke();
    g.strokeStyle = "rgba(90,100,150,0.35)";
    g.lineWidth = 1.2;
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i + Math.PI / 6;
      g.beginPath();
      g.moveTo(Math.cos(a) * r * 0.78, Math.sin(a) * r * 0.78);
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      g.stroke();
    }
    // đèn cam ở các đỉnh giáp
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i + Math.PI / 6;
      const lx = Math.cos(a) * r * 0.88;
      const ly = Math.sin(a) * r * 0.88;
      g.save();
      g.shadowColor = "#ffab3d";
      g.shadowBlur = 8;
      g.fillStyle = boss.telegraph > 0 && Math.floor(time * 12) % 2 === 0 ? "#ffd9a0" : "#ffab3d";
      g.fillRect(lx - 2.6, ly - 2.6, 5.2, 5.2);
      g.restore();
    }

    // pod súng hai bên + cánh nhỏ
    for (const s of [-1, 1]) {
      // cánh tam giác
      g.fillStyle = "#222944";
      g.beginPath();
      g.moveTo(s * (r * 0.82), -r * 0.34);
      g.lineTo(s * (r * 1.28), 4);
      g.lineTo(s * (r * 0.82), r * 0.3);
      g.closePath();
      g.fill();
      g.strokeStyle = "rgba(130,140,195,0.55)";
      g.lineWidth = 1.6;
      g.stroke();
      // đèn cánh
      g.save();
      g.shadowColor = p2 ? "#ff2e96" : "#9a5cff";
      g.shadowBlur = 8;
      g.fillStyle = p2 ? "#ff5ab5" : "#b9a0ff";
      g.fillRect(s * (r * 1.08) - 2.4, -2, 4.8, 8);
      g.restore();
      // pod súng
      g.fillStyle = "#1b2138";
      g.beginPath();
      g.roundRect(s * (r * 0.72) - 13, -16, 26, 40, 7);
      g.fill();
      g.strokeStyle = "rgba(120,130,180,0.65)";
      g.lineWidth = 1.6;
      g.stroke();
      // nòng cam
      g.save();
      g.shadowColor = "#ffab3d";
      g.shadowBlur = boss.telegraph > 0 ? 14 : 6;
      g.fillStyle = boss.telegraph > 0 ? "#ffcf80" : "#7a5a3a";
      g.fillRect(s * (r * 0.72) - 5, 18, 10, 11);
      g.restore();
    }

    // vòng lõi
    g.strokeStyle = "rgba(150,160,220,0.55)";
    g.lineWidth = 2.2;
    g.beginPath();
    g.arc(0, 0, r * 0.52, 0, Math.PI * 2);
    g.stroke();
    g.save();
    g.rotate(boss.sway);
    g.strokeStyle = p2 ? "rgba(255,46,150,0.6)" : "rgba(154,92,255,0.55)";
    g.setLineDash([11, 9]);
    g.lineWidth = 2.4;
    g.beginPath();
    g.arc(0, 0, r * 0.68, 0, Math.PI * 2);
    g.stroke();
    g.setLineDash([]);
    g.restore();

    // mắt đỏ đồng tâm (telegraph phóng to + nhấp nháy)
    const eyeR = r * 0.3 + (boss.telegraph > 0 ? Math.sin(time * 22) * 3 + 3 : 0);
    g.fillStyle = "#151022";
    g.beginPath();
    g.arc(0, 0, eyeR + 7, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "rgba(255,68,83,0.55)";
    g.lineWidth = 2;
    g.beginPath();
    g.arc(0, 0, eyeR + 7, 0, Math.PI * 2);
    g.stroke();
    g.save();
    g.shadowColor = "#ff2438";
    g.shadowBlur = 26;
    const eg = g.createRadialGradient(0, 0, 2, 0, 0, eyeR);
    eg.addColorStop(0, "#fff1f3");
    eg.addColorStop(0.32, "#ff8d97");
    eg.addColorStop(0.62, "#ff4453");
    eg.addColorStop(1, "#7a0f22");
    g.fillStyle = eg;
    g.beginPath();
    g.arc(0, 0, eyeR, 0, Math.PI * 2);
    g.fill();
    g.restore();
    // chấm phản quang
    g.fillStyle = "rgba(255,255,255,0.85)";
    g.beginPath();
    g.arc(-eyeR * 0.3, -eyeR * 0.34, eyeR * 0.16, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  function drawPickup(pk, time) {
    const sprite = pk.kind === "shield" ? IMGS.pickShield : IMGS.pickBolt;
    if (sprite) {
      // huy hiệu tròn neon cắt từ ảnh + chấm sáng quay quanh (động)
      g.save();
      g.translate(pk.x + Math.sin(pk.phase) * 5, pk.y);
      const tone2 = pk.kind === "shield" ? "#2ec7ff" : "#ff2e96";
      const pulse2 = 1 + Math.sin(time * 5 + pk.phase) * 0.08;
      g.scale(pulse2, pulse2);
      const w = 48;
      const h = w * (sprite.height / sprite.width);
      g.drawImage(sprite, -w / 2, -h / 2, w, h);
      g.fillStyle = `${tone2}aa`;
      for (let i = 0; i < 3; i++) {
        const a = time * 2.4 + (i * Math.PI * 2) / 3;
        g.fillRect(Math.cos(a) * 25 - 1.6, Math.sin(a) * 25 - 1.6, 3.2, 3.2);
      }
      g.restore();
      return;
    }
    g.save();
    g.translate(pk.x + Math.sin(pk.phase) * 5, pk.y);
    const tone = pk.kind === "shield" ? "#2ec7ff" : "#ff2e96";
    const pulse = 1 + Math.sin(time * 5 + pk.phase) * 0.08;
    g.scale(pulse, pulse);
    g.save();
    g.shadowColor = tone;
    g.shadowBlur = 16;
    g.strokeStyle = tone;
    g.lineWidth = 2.8;
    hexPath(g, 17, -Math.PI / 6);
    g.fillStyle = "rgba(8,10,26,0.92)";
    g.fill();
    g.stroke();
    g.restore();
    // vòng chấm sáng quay quanh
    g.fillStyle = `${tone}aa`;
    for (let i = 0; i < 3; i++) {
      const a = time * 2.4 + (i * Math.PI * 2) / 3;
      g.fillRect(Math.cos(a) * 23 - 1.6, Math.sin(a) * 23 - 1.6, 3.2, 3.2);
    }
    g.save();
    g.shadowColor = tone;
    g.shadowBlur = 8;
    if (pk.kind === "shield") {
      g.fillStyle = tone;
      g.beginPath();
      g.moveTo(0, -9);
      g.lineTo(7.6, -4.4);
      g.lineTo(7.6, 2.2);
      g.quadraticCurveTo(7.6, 7.6, 0, 10);
      g.quadraticCurveTo(-7.6, 7.6, -7.6, 2.2);
      g.lineTo(-7.6, -4.4);
      g.closePath();
      g.fill();
      g.fillStyle = "rgba(10,20,40,0.85)";
      g.beginPath();
      g.moveTo(0, -5.6);
      g.lineTo(4.4, -2.8);
      g.lineTo(4.4, 1.8);
      g.quadraticCurveTo(4.4, 5, 0, 6.6);
      g.closePath();
      g.fill();
    } else {
      g.fillStyle = tone;
      g.beginPath();
      g.moveTo(2.8, -10);
      g.lineTo(-5.6, 1.8);
      g.lineTo(-0.7, 1.8);
      g.lineTo(-2.8, 10);
      g.lineTo(5.6, -1.8);
      g.lineTo(0.7, -1.8);
      g.closePath();
      g.fill();
    }
    g.restore();
    g.restore();
  }

  /* ---------- vẽ chính ---------- */

  function draw(sim, fx, time) {
    if (!bgCanvas || bgCanvas.width !== canvas.width) paintBg();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(bgCanvas, 0, 0);

    // 3 lớp sao parallax cuộn xuống — phủ toàn canvas
    const rand = seededRand(77);
    const CW = canvas.width;
    const CH = canvas.height;
    for (let layer = 0; layer < 3; layer++) {
      const speed = (layer === 0 ? 22 : layer === 1 ? 52 : 92) * dpr;
      const n = layer === 0 ? 64 : layer === 1 ? 40 : 20;
      g.fillStyle =
        layer === 0 ? "rgba(190,205,255,0.4)" : layer === 1 ? "rgba(235,242,255,0.7)" : "rgba(255,255,255,0.9)";
      for (let i = 0; i < n; i++) {
        const x = rand() * CW;
        const y = (rand() * CH + time * speed) % CH;
        const s = (layer === 0 ? 1.6 : layer === 1 ? 2.2 : 2.6) * dpr;
        g.fillRect(x, y, s, layer === 2 ? 5 * dpr : s);
      }
    }
    g.setTransform(scale, 0, 0, scale, offX, offY);

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

    // đạn người chơi (cyan capsule + vệt)
    for (const b of sim.bullets) {
      g.save();
      // vệt mờ phía sau
      const tg = g.createLinearGradient(b.x, b.y + 4, b.x, b.y + 26);
      tg.addColorStop(0, "rgba(90,220,255,0.5)");
      tg.addColorStop(1, "rgba(90,220,255,0)");
      g.fillStyle = tg;
      g.fillRect(b.x - 1.6, b.y + 4, 3.2, 22);
      g.shadowColor = "#20e3ff";
      g.shadowBlur = 10;
      const lg = g.createLinearGradient(b.x, b.y - 13, b.x, b.y + 7);
      lg.addColorStop(0, "#f0ffff");
      lg.addColorStop(1, "#1fb4ec");
      g.fillStyle = lg;
      g.beginPath();
      g.roundRect(b.x - 2.7, b.y - 13, 5.4, 20, 2.7);
      g.fill();
      g.restore();
    }

    // đạn địch
    for (const b of sim.ebullets) {
      g.save();
      if (b.kind === "orange") {
        g.shadowColor = "#ffab3d";
        g.shadowBlur = 10;
        const og = g.createRadialGradient(b.x, b.y, 0.5, b.x, b.y, 7);
        og.addColorStop(0, "#fff6e0");
        og.addColorStop(0.45, "#ffab3d");
        og.addColorStop(1, "rgba(255,120,40,0)");
        g.fillStyle = og;
        g.beginPath();
        g.arc(b.x, b.y, 7, 0, Math.PI * 2);
        g.fill();
      } else {
        g.shadowColor = "#ff2e96";
        g.shadowBlur = 10;
        g.save();
        g.translate(b.x, b.y);
        g.rotate(Math.atan2(b.vy, b.vx) + Math.PI / 2);
        const mg = g.createLinearGradient(0, -8, 0, 8);
        mg.addColorStop(0, "#ffd7ef");
        mg.addColorStop(1, "#ff3aa4");
        g.fillStyle = mg;
        g.beginPath();
        g.ellipse(0, 0, 3.8, 8, 0, 0, Math.PI * 2);
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
