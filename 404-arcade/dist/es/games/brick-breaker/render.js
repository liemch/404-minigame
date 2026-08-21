/**
 * render.js — vẽ Brick Breaker 404 theo ảnh reference: nền bảng mạch
 * navy có quầng sáng, khung neon cyan bo góc, gạch texture 3D 4 loại
 * (cyan nứt băng / tím-khiên / hồng-nổ / thép-X) pre-render sprite,
 * bóng cầu sáng có chuỗi hạt trail, paddle viền tím lõi cyan phát
 * sáng, power-up rơi kèm vệt lấp lánh + chevron, particle vỡ gạch.
 */

import { WORLD, BALL_R, PADDLE_Y, PADDLE_H, CELL } from "./engine.js";
import { seededRand, MONO_FONT } from "../../core/utils.js";
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

const COLORS = {
  frame: "#20e3ff",
  bg0: "#060a24",
  bg1: "#0c1238",
  normalA: "#6fe9ff",
  normalB: "#0f9ad6",
  reinA: "#a674ff",
  reinB: "#5526c9",
  expA: "#ff5ec2",
  expB: "#c9186e",
  steelA: "#454c66",
  steelB: "#1c2132",
  ball: "#eaf9ff",
  paddleRim: "#a86bff",
  paddleBody0: "#3a1d7a",
  paddleBody1: "#1c0d45",
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
    brickCache.clear();
  }

  // khi asset decode xong: vẽ lại sprite gạch + nền có texture thật
  if (!spritesReady) {
    readyFns.add(() => {
      brickCache.clear();
      bgCanvas = null;
    });
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

    // texture bảng mạch cắt từ ảnh tham chiếu, tile phủ nền (blend screen)
    if (IMGS.bgTile) {
      const pat = c.createPattern(IMGS.bgTile, "repeat");
      c.save();
      c.globalCompositeOperation = "screen";
      c.globalAlpha = 0.68;
      const k = 148 / IMGS.bgTile.width; // 1 tile ≈ 148 world px
      c.scale(k, k);
      c.fillStyle = pat;
      c.fillRect(0, 0, WORLD.w / k, WORLD.h / k);
      c.restore();
    }

    // quầng sáng mờ cyan / tím như ảnh
    for (const [x, y, r, col] of [
      [WORLD.w * 0.24, WORLD.h * 0.34, 300, "rgba(32,120,255,0.10)"],
      [WORLD.w * 0.78, WORLD.h * 0.6, 320, "rgba(110,40,220,0.10)"],
      [WORLD.w * 0.5, WORLD.h * 0.12, 260, "rgba(32,200,255,0.07)"],
    ]) {
      const gl = c.createRadialGradient(x, y, 10, x, y, r);
      gl.addColorStop(0, col);
      gl.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = gl;
      c.fillRect(x - r, y - r, r * 2, r * 2);
    }

    const rand = seededRand(404);
    // lưới chấm
    c.fillStyle = "rgba(70,120,215,0.13)";
    for (let y = 18; y < WORLD.h; y += 30) {
      for (let x = 18; x < WORLD.w; x += 30) c.fillRect(x, y, 2, 2);
    }
    // trace mạch in + pad tròn
    c.strokeStyle = "rgba(46,140,240,0.17)";
    c.lineWidth = 1.6;
    for (let i = 0; i < 34; i++) {
      let x = rand() * WORLD.w;
      let y = rand() * WORLD.h;
      c.beginPath();
      c.moveTo(x, y);
      for (let k2 = 0; k2 < 3; k2++) {
        const len = 30 + rand() * 100;
        if (rand() > 0.5) x += rand() > 0.5 ? len : -len;
        else y += rand() > 0.5 ? len : -len;
        c.lineTo(x, y);
      }
      c.stroke();
      c.fillStyle = "rgba(60,160,250,0.26)";
      c.beginPath();
      c.arc(x, y, 2.6, 0, Math.PI * 2);
      c.fill();
    }
    // vài điểm sáng nhấp nháy tĩnh
    for (let i = 0; i < 26; i++) {
      const x = rand() * WORLD.w;
      const y = rand() * WORLD.h;
      c.fillStyle = rand() > 0.6 ? "rgba(120,220,255,0.35)" : "rgba(160,120,255,0.3)";
      c.fillRect(x, y, 2.4, 2.4);
    }
    // vignette
    const vg = c.createRadialGradient(WORLD.w / 2, WORLD.h / 2, WORLD.h * 0.32, WORLD.w / 2, WORLD.h / 2, WORLD.h * 0.95);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(2,4,14,0.5)");
    c.fillStyle = vg;
    c.fillRect(0, 0, WORLD.w, WORLD.h);
  }

  /* ---------- gạch: pre-render sprite theo (type|hp|w|h) ---------- */

  const brickCache = new Map();
  const SS = 2; // supersample sprite

  function brickColors(type) {
    if (type === CELL.NORMAL) return [COLORS.normalA, COLORS.normalB];
    if (type === CELL.REINFORCED) return [COLORS.reinA, COLORS.reinB];
    if (type === CELL.EXPLOSIVE) return [COLORS.expA, COLORS.expB];
    return [COLORS.steelA, COLORS.steelB];
  }

  function glowOf(type) {
    if (type === CELL.NORMAL) return "rgba(60,210,255,0.55)";
    if (type === CELL.REINFORCED) return "rgba(150,90,255,0.5)";
    if (type === CELL.EXPLOSIVE) return "rgba(255,70,180,0.55)";
    return "rgba(90,100,130,0.35)";
  }

  function brickAsset(type) {
    if (type === CELL.NORMAL) return IMGS.brickNormal;
    if (type === CELL.REINFORCED) return IMGS.brickRein;
    if (type === CELL.EXPLOSIVE) return IMGS.brickBoom;
    return IMGS.brickSteel;
  }

  function paintBrickSprite(type, hp, w, h) {
    const cv = document.createElement("canvas");
    cv.width = Math.ceil((w + 12) * SS);
    cv.height = Math.ceil((h + 12) * SS);
    const c = cv.getContext("2d");
    c.scale(SS, SS);
    c.translate(6, 6);

    // sprite thật cắt từ ảnh tham chiếu (fallback vector khi chưa decode)
    const asset = brickAsset(type);
    if (asset) {
      c.save();
      c.shadowColor = glowOf(type);
      c.shadowBlur = 7;
      c.drawImage(asset, 0, 0, w, h);
      c.restore();
      if (type === CELL.REINFORCED && hp < 2) {
        // vết nứt khi khiên đã trúng 1 phát (phần động vẽ code)
        const cx0 = w / 2;
        const cy0 = h / 2;
        c.strokeStyle = "rgba(12,4,34,0.7)";
        c.lineWidth = 1.6;
        c.beginPath();
        c.moveTo(4, 4);
        c.lineTo(cx0 - 4, cy0);
        c.lineTo(6, h - 4);
        c.moveTo(w - 5, 3);
        c.lineTo(cx0 + 5, cy0 + 3);
        c.lineTo(w - 8, h - 3);
        c.stroke();
        c.strokeStyle = "rgba(255,255,255,0.25)";
        c.lineWidth = 0.8;
        c.beginPath();
        c.moveTo(5, 5);
        c.lineTo(cx0 - 3, cy0 + 1);
        c.stroke();
      }
      return cv;
    }

    const [ca, cb] = brickColors(type);

    // quầng glow quanh gạch
    c.save();
    c.shadowColor = glowOf(type);
    c.shadowBlur = 7;
    c.fillStyle = cb;
    c.beginPath();
    c.roundRect(0, 0, w, h, 5);
    c.fill();
    c.restore();

    // thân gradient
    const grad = c.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, ca);
    grad.addColorStop(1, cb);
    c.fillStyle = grad;
    c.beginPath();
    c.roundRect(0, 0, w, h, 5);
    c.fill();

    // bevel trên/dưới
    c.fillStyle = "rgba(255,255,255,0.4)";
    c.beginPath();
    c.roundRect(2, 2, w - 4, 3.4, 2);
    c.fill();
    c.fillStyle = "rgba(0,0,14,0.34)";
    c.beginPath();
    c.roundRect(2, h - 6, w - 4, 4, 2);
    c.fill();
    // bevel cạnh trái/phải
    c.fillStyle = "rgba(255,255,255,0.14)";
    c.fillRect(1.6, 4, 2, h - 9);
    c.fillStyle = "rgba(0,0,14,0.2)";
    c.fillRect(w - 3.6, 4, 2, h - 9);

    const rand = seededRand(type * 131 + Math.round(w) * 7 + hp);
    const cx = w / 2;
    const cy = h / 2;

    if (type === CELL.NORMAL) {
      // texture nứt băng như ảnh
      c.strokeStyle = "rgba(8,62,96,0.5)";
      c.lineWidth = 1.2;
      for (let i = 0; i < 3; i++) {
        let x = 6 + rand() * (w - 12);
        let y = 4 + rand() * 4;
        c.beginPath();
        c.moveTo(x, y);
        for (let s = 0; s < 3; s++) {
          x += (rand() - 0.5) * 14;
          y += 4 + rand() * (h / 3.4);
          c.lineTo(x, y);
        }
        c.stroke();
      }
      c.strokeStyle = "rgba(230,255,255,0.4)";
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(w * 0.2, h * 0.34);
      c.lineTo(w * 0.36, h * 0.3);
      c.moveTo(w * 0.6, h * 0.62);
      c.lineTo(w * 0.76, h * 0.56);
      c.stroke();
      // đốm sáng
      c.fillStyle = "rgba(255,255,255,0.22)";
      for (let i = 0; i < 4; i++) c.fillRect(3 + rand() * (w - 8), 4 + rand() * (h - 8), 2, 2);
    } else if (type === CELL.REINFORCED) {
      // icon khiên
      c.save();
      c.shadowColor = "rgba(255,255,255,0.65)";
      c.shadowBlur = 5;
      c.fillStyle = hp >= 2 ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.5)";
      c.beginPath();
      c.moveTo(cx, cy - 8);
      c.lineTo(cx + 6.4, cy - 5);
      c.lineTo(cx + 6.4, cy + 2);
      c.quadraticCurveTo(cx + 6.4, cy + 6.4, cx, cy + 9.4);
      c.quadraticCurveTo(cx - 6.4, cy + 6.4, cx - 6.4, cy + 2);
      c.lineTo(cx - 6.4, cy - 5);
      c.closePath();
      c.fill();
      c.restore();
      c.strokeStyle = cb;
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(cx, cy - 5.4);
      c.lineTo(cx, cy + 6.4);
      c.stroke();
      if (hp < 2) {
        c.strokeStyle = "rgba(12,4,34,0.65)";
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(4, 4);
        c.lineTo(cx - 4, cy);
        c.lineTo(6, h - 4);
        c.moveTo(w - 5, 3);
        c.lineTo(cx + 5, cy + 3);
        c.lineTo(w - 8, h - 3);
        c.stroke();
      }
    } else if (type === CELL.EXPLOSIVE) {
      // icon nổ 8 cánh
      c.save();
      c.translate(cx, cy);
      c.shadowColor = "rgba(255,255,255,0.8)";
      c.shadowBlur = 6;
      c.fillStyle = "rgba(255,255,255,0.95)";
      c.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI / 4) * i;
        c.lineTo(Math.cos(a) * 8.6, Math.sin(a) * 8.6);
        c.lineTo(Math.cos(a + Math.PI / 8) * 3.6, Math.sin(a + Math.PI / 8) * 3.6);
      }
      c.closePath();
      c.fill();
      c.restore();
      c.fillStyle = COLORS.expB;
      c.beginPath();
      c.arc(cx, cy, 2.5, 0, Math.PI * 2);
      c.fill();
    } else {
      // thép bất hoại: tấm kim loại + giằng X + đinh tán
      c.strokeStyle = "rgba(16,18,30,0.6)";
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(3, h * 0.5);
      c.lineTo(w - 3, h * 0.5);
      c.stroke();
      c.strokeStyle = "rgba(158,168,196,0.8)";
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(7, 5);
      c.lineTo(w - 7, h - 5);
      c.moveTo(w - 7, 5);
      c.lineTo(7, h - 5);
      c.stroke();
      c.strokeStyle = "rgba(30,34,52,0.9)";
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(7, 5);
      c.lineTo(w - 7, h - 5);
      c.moveTo(w - 7, 5);
      c.lineTo(7, h - 5);
      c.stroke();
      c.fillStyle = "rgba(186,196,222,0.9)";
      for (const [rx, ry] of [[5.4, 5.4], [w - 5.4, 5.4], [5.4, h - 5.4], [w - 5.4, h - 5.4]]) {
        c.beginPath();
        c.arc(rx, ry, 2, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "rgba(40,44,64,0.9)";
        c.fillRect(rx - 0.7, ry - 0.7, 1.4, 1.4);
        c.fillStyle = "rgba(186,196,222,0.9)";
      }
    }

    // viền ngoài
    c.strokeStyle = "rgba(4,8,22,0.7)";
    c.lineWidth = 1.4;
    c.beginPath();
    c.roundRect(0.6, 0.6, w - 1.2, h - 1.2, 5);
    c.stroke();
    return cv;
  }

  function brickSprite(b) {
    const w = Math.round(b.w - 4);
    const h = Math.round(b.h - 4);
    const key = `${b.type}|${b.type === CELL.REINFORCED ? b.hp : 0}|${w}x${h}`;
    let spr = brickCache.get(key);
    if (!spr) {
      spr = paintBrickSprite(b.type, b.hp, w, h);
      brickCache.set(key, spr);
    }
    return spr;
  }

  function drawBrick(c, b, time) {
    const spr = brickSprite(b);
    const w = Math.round(b.w - 4);
    const h = Math.round(b.h - 4);
    c.drawImage(spr, b.x + 2 - 6, b.y + 2 - 6, w + 12, h + 12);
    if (b.type === CELL.EXPLOSIVE) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 4 + b.gx * 1.3);
      c.strokeStyle = `rgba(255,130,200,${0.2 + pulse * 0.35})`;
      c.lineWidth = 1.2;
      c.beginPath();
      c.roundRect(b.x + 3.5, b.y + 3.5, b.w - 7, b.h - 7, 4);
      c.stroke();
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
    c.lineWidth = 2.2;
    if (type === "multi") {
      c.font = `800 14px ${MONO_FONT}`;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText("x2", 0, 1);
    } else if (type === "wide") {
      c.beginPath();
      c.moveTo(-11, 0);
      c.lineTo(11, 0);
      c.stroke();
      for (const s of [-1, 1]) {
        c.beginPath();
        c.moveTo(s * 11, 0);
        c.lineTo(s * 5.4, -4.4);
        c.moveTo(s * 11, 0);
        c.lineTo(s * 5.4, 4.4);
        c.stroke();
      }
    } else if (type === "slow") {
      c.beginPath();
      c.arc(0, 0, 7.4, 0, Math.PI * 2);
      c.stroke();
      c.beginPath();
      c.moveTo(0, -4.4);
      c.lineTo(0, 0);
      c.lineTo(4.4, 2);
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
    // vệt lấp lánh rơi phía trên (như ảnh: mưa sáng vàng)
    c.strokeStyle = tone;
    c.lineWidth = 2;
    for (const [dx, l0, l1, a] of [[-8, 18, 34, 0.3], [-3, 24, 46, 0.5], [2, 20, 40, 0.4], [7, 16, 30, 0.3]]) {
      c.globalAlpha = a;
      c.beginPath();
      c.moveTo(dx, -l0);
      c.lineTo(dx, -l1);
      c.stroke();
    }
    c.globalAlpha = 0.85;
    c.fillStyle = tone;
    for (const [dx, dy] of [[-6, -26], [4, -38], [0, -20]]) c.fillRect(dx, dy, 2.4, 2.4);
    c.globalAlpha = 1;
    // thân: sprite thật từ ảnh cho x2 / wide, còn lại vẽ vector như cũ
    const sprite = p.type === "multi" ? IMGS.powX2 : p.type === "wide" ? IMGS.powWide : null;
    if (sprite) {
      if (p.type === "multi") c.drawImage(sprite, -22, -22, 44, 44);
      else c.drawImage(sprite, -26, -16.5, 52, 33);
    } else {
      c.shadowColor = tone;
      c.shadowBlur = 16;
      c.fillStyle = "rgba(6,10,26,0.95)";
      c.strokeStyle = tone;
      c.lineWidth = 2.8;
      c.beginPath();
      if (p.type === "wide" || p.type === "laser") c.roundRect(-18, -12, 36, 24, 12);
      else c.arc(0, 0, 16, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.shadowBlur = 0;
      drawPowerGlyph(c, p.type);
    }
    // chevron rơi phía dưới
    const cv = (time * 26) % 10;
    c.strokeStyle = tone;
    c.globalAlpha = 0.9;
    c.lineWidth = 3;
    c.lineJoin = "round";
    c.beginPath();
    c.moveTo(-7, 21 + cv * 0.4);
    c.lineTo(0, 27 + cv * 0.4);
    c.lineTo(7, 21 + cv * 0.4);
    c.stroke();
    c.globalAlpha = 0.45;
    c.beginPath();
    c.moveTo(-7, 29 + cv * 0.4);
    c.lineTo(0, 35 + cv * 0.4);
    c.lineTo(7, 29 + cv * 0.4);
    c.stroke();
    c.globalAlpha = 1;
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
    g.lineWidth = 2.6;
    g.shadowColor = COLORS.frame;
    g.shadowBlur = 14;
    g.beginPath();
    g.roundRect(4, 4, WORLD.w - 8, WORLD.h - 8, 16);
    g.stroke();
    g.shadowBlur = 0;
    g.strokeStyle = "rgba(32,227,255,0.3)";
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
      g.strokeStyle = "rgba(255,240,255,0.9)";
      g.lineWidth = 1.2;
      g.stroke();
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

    // trail bóng: dải sáng + chuỗi hạt cầu như ảnh
    for (const ball of m.balls) {
      if (!ball.trail || ball.trail.length < 2) continue;
      // dải sáng mảnh nối các điểm
      g.save();
      g.strokeStyle = "rgba(110,215,255,0.3)";
      g.lineWidth = 2.6;
      g.lineJoin = "round";
      g.shadowColor = "#54c8ff";
      g.shadowBlur = 8;
      g.beginPath();
      g.moveTo(ball.trail[0].x, ball.trail[0].y);
      for (let i = 1; i < ball.trail.length; i++) g.lineTo(ball.trail[i].x, ball.trail[i].y);
      g.lineTo(ball.x, ball.y);
      g.stroke();
      g.restore();
      // chuỗi hạt: cách 3 điểm một hạt, to dần về phía bóng
      for (let i = 0; i < ball.trail.length; i += 3) {
        const tr = ball.trail[i];
        const k = i / ball.trail.length;
        g.save();
        g.shadowColor = "#7ce6ff";
        g.shadowBlur = 10;
        g.globalAlpha = 0.28 + k * 0.6;
        const r = BALL_R * (0.3 + k * 0.55);
        const bd = g.createRadialGradient(tr.x - 1, tr.y - 1, 0.5, tr.x, tr.y, r);
        bd.addColorStop(0, "#ffffff");
        bd.addColorStop(1, "#48b8e8");
        g.fillStyle = bd;
        g.beginPath();
        g.arc(tr.x, tr.y, r, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
      g.globalAlpha = 1;
    }

    // bóng: sprite cầu sáng cắt từ ảnh (fallback gradient vector)
    for (const ball of m.balls) {
      if (IMGS.ball) {
        const dr = BALL_R * 3; // sprite gồm cả quầng glow
        g.save();
        g.translate(ball.x, ball.y);
        // vệt sáng baked trong sprite lệch ~0.26rad — xoay ngược chiều bay
        if (!ball.stuck && (ball.vx || ball.vy)) g.rotate(Math.atan2(-ball.vy, -ball.vx) - 0.26);
        g.drawImage(IMGS.ball, -dr, -dr, dr * 2, dr * 2);
        g.restore();
      } else {
        g.save();
        g.shadowColor = "#7ce6ff";
        g.shadowBlur = 22;
        const bg2 = g.createRadialGradient(ball.x - 2.4, ball.y - 3, 1, ball.x, ball.y, BALL_R + 2);
        bg2.addColorStop(0, "#ffffff");
        bg2.addColorStop(0.5, COLORS.ball);
        bg2.addColorStop(1, "#3fb2e6");
        g.fillStyle = bg2;
        g.beginPath();
        g.arc(ball.x, ball.y, BALL_R + 1, 0, Math.PI * 2);
        g.fill();
        g.restore();
        // chấm bóng láng
        g.fillStyle = "rgba(255,255,255,0.9)";
        g.beginPath();
        g.arc(ball.x - BALL_R * 0.34, ball.y - BALL_R * 0.4, BALL_R * 0.3, 0, Math.PI * 2);
        g.fill();
      }
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

    // paddle: sprite thật cắt từ ảnh (fallback vector khi chưa decode)
    const p = m.paddle;
    const px = p.x - p.w / 2;
    const rr = PADDLE_H / 2 + 1;
    // quầng dưới paddle
    const under = g.createRadialGradient(p.x, PADDLE_Y + PADDLE_H, 4, p.x, PADDLE_Y + PADDLE_H, p.w * 0.6);
    under.addColorStop(0, "rgba(150,90,255,0.3)");
    under.addColorStop(1, "rgba(150,90,255,0)");
    g.fillStyle = under;
    g.fillRect(px - 30, PADDLE_Y - 6, p.w + 60, PADDLE_H + 34);
    if (IMGS.paddle) {
      const dh = PADDLE_H + 16; // sprite gồm cả viền neon dày hơn hitbox
      const dw = p.w + 16;
      g.save();
      g.shadowColor = COLORS.paddleRim;
      g.shadowBlur = 16;
      g.drawImage(IMGS.paddle, p.x - dw / 2, PADDLE_Y + PADDLE_H / 2 - dh / 2, dw, dh);
      g.restore();
      if (m.timers.laser > 0) {
        // lõi đổi màu hồng khi laser active (phần động vẽ code)
        g.save();
        g.shadowColor = "#ff2ee6";
        g.shadowBlur = 12;
        g.fillStyle = "#ff2ee6";
        g.beginPath();
        g.roundRect(p.x - p.w * 0.21, PADDLE_Y + PADDLE_H / 2 - 3.2, p.w * 0.42, 6.4, 3.2);
        g.fill();
        g.restore();
      }
    } else {
      // thân
      g.save();
      g.shadowColor = COLORS.paddleRim;
      g.shadowBlur = 20;
      const pg = g.createLinearGradient(0, PADDLE_Y, 0, PADDLE_Y + PADDLE_H);
      pg.addColorStop(0, COLORS.paddleBody0);
      pg.addColorStop(1, COLORS.paddleBody1);
      g.fillStyle = pg;
      g.beginPath();
      g.roundRect(px, PADDLE_Y, p.w, PADDLE_H, rr);
      g.fill();
      g.restore();
      // viền tím sáng
      g.strokeStyle = COLORS.paddleRim;
      g.lineWidth = 2.4;
      g.save();
      g.shadowColor = COLORS.paddleRim;
      g.shadowBlur = 10;
      g.beginPath();
      g.roundRect(px + 1, PADDLE_Y + 1, p.w - 2, PADDLE_H - 2, rr - 1);
      g.stroke();
      g.restore();
      // highlight trên
      g.strokeStyle = "rgba(230,214,255,0.5)";
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(px + 10, PADDLE_Y + 3.4);
      g.lineTo(px + p.w - 10, PADDLE_Y + 3.4);
      g.stroke();
      // lõi cyan giữa
      g.save();
      g.shadowColor = m.timers.laser > 0 ? "#ff2ee6" : COLORS.frame;
      g.shadowBlur = 12;
      g.fillStyle = m.timers.laser > 0 ? "#ff2ee6" : COLORS.frame;
      g.beginPath();
      g.roundRect(p.x - p.w * 0.21, PADDLE_Y + PADDLE_H / 2 - 3.2, p.w * 0.42, 6.4, 3.2);
      g.fill();
      g.fillStyle = "rgba(255,255,255,0.85)";
      g.beginPath();
      g.roundRect(p.x - p.w * 0.1, PADDLE_Y + PADDLE_H / 2 - 1.2, p.w * 0.2, 2.4, 1.2);
      g.fill();
      g.restore();
      // vát mũi hai đầu
      g.fillStyle = "rgba(210,180,255,0.9)";
      for (const s of [-1, 1]) {
        g.beginPath();
        g.moveTo(p.x + s * (p.w / 2 - 5), PADDLE_Y + 4);
        g.lineTo(p.x + s * (p.w / 2 - 13), PADDLE_Y + PADDLE_H / 2);
        g.lineTo(p.x + s * (p.w / 2 - 5), PADDLE_Y + PADDLE_H - 4);
        g.closePath();
        g.fill();
      }
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

/** Icon chú giải sidebar (30×22): dùng sprite thật, vẽ lại khi decode xong. */
export function paintBrickLegend(canvas, kind) {
  const repaint = () => paintLegendNow(canvas, kind);
  repaint();
  if (!spritesReady) readyFns.add(repaint);
}

function paintLegendNow(canvas, kind) {
  canvas.width = 60;
  canvas.height = 44;
  const c = canvas.getContext("2d");
  c.scale(2, 2);
  const assetMap = {
    normal: IMGS.brickNormal,
    reinforced: IMGS.brickRein,
    explosive: IMGS.brickBoom,
    steel: IMGS.brickSteel,
  };
  if (assetMap[kind]) {
    c.drawImage(assetMap[kind], 1, 1, 28, 20);
    return;
  }
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
  c.fillStyle = "rgba(255,255,255,0.35)";
  c.fillRect(3, 3, 24, 2);
  c.fillStyle = "rgba(0,0,14,0.3)";
  c.fillRect(3, 17, 24, 2);
  const cx = 15;
  const cy = 11;
  c.fillStyle = "rgba(255,255,255,0.92)";
  c.strokeStyle = "rgba(255,255,255,0.85)";
  if (kind === "normal") {
    c.strokeStyle = "rgba(8,62,96,0.55)";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(8, 4);
    c.lineTo(11, 11);
    c.lineTo(9, 18);
    c.moveTo(20, 4);
    c.lineTo(18, 12);
    c.stroke();
  } else if (kind === "reinforced") {
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
    c.strokeStyle = "rgba(158,168,196,0.95)";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(5, 4);
    c.lineTo(25, 18);
    c.moveTo(25, 4);
    c.lineTo(5, 18);
    c.stroke();
    c.fillStyle = "rgba(186,196,222,0.9)";
    for (const [rx, ry] of [[4, 4], [26, 4], [4, 18], [26, 18]]) {
      c.beginPath();
      c.arc(rx, ry, 1.4, 0, Math.PI * 2);
      c.fill();
    }
  }
}
