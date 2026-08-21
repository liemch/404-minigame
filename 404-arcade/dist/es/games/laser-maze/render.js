/**
 * render.js — vẽ board Laser Maze 404 theo ảnh reference: lưới ô tối,
 * nguồn laser đỏ đồng tâm, bộ thu vòng tròn màu + badge check xanh,
 * gương thanh chéo ánh thép kèm mũi tên xoay, bộ tách chùm chữ thập đỏ,
 * kính lọc khung vuông màu, khối chặn giằng X, tia laser phát sáng.
 */

import { BEAM_COLORS, REFLECT } from "./engine.js";
import { loadSprites } from "./assets.js";

const TILE_LINE = "rgba(140, 158, 205, 0.28)";

/* Sprite cắt từ ảnh tham chiếu — nạp 1 lần ở mức module; mọi hàm vẽ
   fallback nét vector cũ cho tới khi ảnh decode xong. */
const readyFns = new Set();
let spritesReady = false;
const IMGS = loadSprites(() => {
  spritesReady = true;
  for (const fn of readyFns) fn();
  readyFns.clear();
});

/* Biến thể đổi màu (hue-rotate) pre-render vào offscreen canvas:
   receiver gốc màu xanh dương, filter gốc màu hồng tím như ảnh. */
const tintCache = new Map();
function tinted(key, deg) {
  const img = IMGS[key];
  if (!img) return null;
  if (!deg) return img;
  const ck = `${key}|${deg}`;
  let cv = tintCache.get(ck);
  if (!cv) {
    cv = document.createElement("canvas");
    cv.width = img.width;
    cv.height = img.height;
    const c = cv.getContext("2d");
    c.filter = `hue-rotate(${deg}deg)`;
    c.drawImage(img, 0, 0);
    tintCache.set(ck, cv);
  }
  return cv;
}

// góc hue từ sprite gốc → màu hệ thống tia
const RECEIVER_HUE = { red: -57, cyan: 0, violet: 68 };
const FILTER_HUE = { violet: -35, cyan: -118 };

export function createMazeRenderer(canvas, box) {
  const g = canvas.getContext("2d");
  let dpr = 1;
  let t = 40; // cạnh ô (css px)
  let ox = 0;
  let oy = 0;
  let W = 0;
  let H = 0;

  function fit(level) {
    const rect = box.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = rect.width;
    H = rect.height;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    t = Math.floor(Math.min((W - 36) / level.w, (H - 36) / level.h));
    t = Math.max(22, Math.min(86, t));
    ox = Math.floor((W - level.w * t) / 2);
    oy = Math.floor((H - level.h * t) / 2);
  }

  function geometry() {
    return { t, ox, oy };
  }

  const cx = (x) => ox + x * t + t / 2;
  const cy = (y) => oy + y * t + t / 2;

  /* ---------- thành phần ---------- */

  function tileBase(x, y, fill = "rgba(14, 18, 34, 0.95)", stroke = "rgba(140,160,210,0.4)") {
    const px = ox + x * t + 2;
    const py = oy + y * t + 2;
    // bóng đổ nhẹ cho ô linh kiện nổi khối
    g.fillStyle = "rgba(3,5,14,0.55)";
    g.beginPath();
    g.roundRect(px + 1.5, py + 2.5, t - 4, t - 4, 6);
    g.fill();
    g.fillStyle = fill;
    g.strokeStyle = stroke;
    g.lineWidth = 1.6;
    g.beginPath();
    g.roundRect(px, py, t - 4, t - 4, 6);
    g.fill();
    g.stroke();
    // highlight mép trên
    g.strokeStyle = "rgba(255,255,255,0.09)";
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(px + 5, py + 2);
    g.lineTo(px + t - 9, py + 2);
    g.stroke();
  }

  function drawSource(x, y, dir, time) {
    if (IMGS.source) {
      const X = cx(x);
      const Y = cy(y);
      const s = t * 1.08;
      const ang = { R: 0, D: Math.PI / 2, L: Math.PI, U: -Math.PI / 2 }[dir] || 0;
      g.save();
      g.translate(X, Y);
      g.rotate(ang);
      g.drawImage(IMGS.source, -s / 2, -s / 2, s, s);
      g.restore();
      // nhịp sáng lõi đỏ (phần động vẽ code)
      const pulse2 = 0.35 + 0.3 * Math.sin(time * 5);
      g.save();
      g.globalCompositeOperation = "lighter";
      const gl = g.createRadialGradient(X, Y, 1, X, Y, t * 0.22);
      gl.addColorStop(0, `rgba(255,120,130,${pulse2})`);
      gl.addColorStop(1, "rgba(255,60,80,0)");
      g.fillStyle = gl;
      g.fillRect(X - t * 0.25, Y - t * 0.25, t * 0.5, t * 0.5);
      g.restore();
      return;
    }
    tileBase(x, y, "#251016", "rgba(255,90,110,0.6)");
    const X = cx(x);
    const Y = cy(y);
    const pulse = 0.75 + 0.25 * Math.sin(time * 5);
    g.strokeStyle = `rgba(255,59,79,${0.9 * pulse})`;
    g.lineWidth = 2.6;
    g.beginPath();
    g.arc(X, Y, t * 0.29, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = "rgba(255,120,135,0.5)";
    g.lineWidth = 1.4;
    g.beginPath();
    g.arc(X, Y, t * 0.2, 0, Math.PI * 2);
    g.stroke();
    g.save();
    g.shadowColor = "#ff3b4f";
    g.shadowBlur = 16;
    g.fillStyle = "#ff6a76";
    g.beginPath();
    g.arc(X, Y, t * 0.13, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#ffe1e5";
    g.beginPath();
    g.arc(X, Y, t * 0.055, 0, Math.PI * 2);
    g.fill();
    g.restore();
    // họng phát theo hướng
    const d = { U: [0, -1], R: [1, 0], D: [0, 1], L: [-1, 0] }[dir];
    g.fillStyle = "rgba(255,90,104,0.95)";
    g.fillRect(X + d[0] * t * 0.33 - 3.4, Y + d[1] * t * 0.33 - 3.4, 6.8, 6.8);
  }

  function drawReceiver(x, y, need, litOk, time) {
    // receiver tia gốc (đỏ) hiển thị vòng xanh lá như legend ảnh reference
    const col = need === "red" ? "#4df77f" : BEAM_COLORS[need] || "#4df77f";
    const spr = tinted("receiver", RECEIVER_HUE[need] ?? 0);
    if (spr) {
      const X = cx(x);
      const Y = cy(y);
      const s = t * 1.02;
      g.save();
      if (litOk) {
        g.shadowColor = col;
        g.shadowBlur = 10 + 4 * Math.sin(time * 7);
      } else {
        g.globalAlpha = 0.82;
      }
      g.drawImage(spr, X - s / 2, Y - s / 2, s, s);
      g.restore();
      if (litOk && IMGS.badge) {
        const bs = t * 0.42;
        g.drawImage(IMGS.badge, X + t * 0.4 - bs / 2, Y + t * 0.21 - bs / 2, bs, bs);
      }
      return;
    }
    tileBase(x, y, "rgba(8,12,24,0.94)", litOk ? "rgba(77,247,127,0.6)" : `${col}55`);
    const X = cx(x);
    const Y = cy(y);
    const pulse = litOk ? 0.9 + 0.1 * Math.sin(time * 7) : 0.7;
    g.save();
    if (litOk) {
      g.shadowColor = col;
      g.shadowBlur = 18;
    }
    g.strokeStyle = col;
    g.globalAlpha = pulse;
    g.lineWidth = 3.6;
    g.beginPath();
    g.arc(X, Y, t * 0.31, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = 2.2;
    g.beginPath();
    g.arc(X, Y, t * 0.19, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = col;
    g.beginPath();
    g.arc(X, Y, t * 0.085, 0, Math.PI * 2);
    g.fill();
    g.restore();
    g.globalAlpha = 1;
    // badge check khi thỏa màu
    if (litOk) {
      const bx = X + t * 0.28;
      const by = Y + t * 0.28;
      g.fillStyle = "#20d96a";
      g.beginPath();
      g.arc(bx, by, t * 0.13, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "#04270f";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(bx - t * 0.06, by);
      g.lineTo(bx - t * 0.015, by + t * 0.05);
      g.lineTo(bx + t * 0.065, by - t * 0.05);
      g.stroke();
    }
  }

  function drawMirror(x, y, o, rotatable, hintGlow, time) {
    const spr = o === "/" ? IMGS.mirrorFs : IMGS.mirrorBs;
    if (spr) {
      const X = cx(x);
      const Y = cy(y);
      const s = t * 0.97;
      g.save();
      if (hintGlow) {
        g.shadowColor = "#a8ff3e";
        g.shadowBlur = 13 + 5 * Math.sin(time * 6);
      }
      g.drawImage(spr, X - s / 2, Y - s / 2, s, s);
      g.restore();
      return;
    }
    tileBase(x, y, "#141926", "rgba(160,185,230,0.42)");
    const X = cx(x);
    const Y = cy(y);
    const r = t * 0.33;
    const a = o === "/" ? -Math.PI / 4 : Math.PI / 4;
    g.save();
    g.translate(X, Y);
    g.rotate(a);
    if (hintGlow) {
      g.shadowColor = "#a8ff3e";
      g.shadowBlur = 12 + 5 * Math.sin(time * 6);
    } else {
      g.shadowColor = "rgba(190,225,255,0.55)";
      g.shadowBlur = 7;
    }
    const grad = g.createLinearGradient(0, -4.6, 0, 4.6);
    grad.addColorStop(0, "#f2f9ff");
    grad.addColorStop(0.5, "#a9cdf2");
    grad.addColorStop(1, "#5d7fa8");
    g.fillStyle = grad;
    g.beginPath();
    g.roundRect(-r, -4.2, r * 2, 8.4, 4.2);
    g.fill();
    g.restore();
    // vệt shine
    g.strokeStyle = "rgba(255,255,255,0.75)";
    g.lineWidth = 1.6;
    g.beginPath();
    const sx = o === "/" ? 1 : -1;
    g.moveTo(X - sx * r * 0.5, Y + r * 0.5 - 2);
    g.lineTo(X + sx * r * 0.25, Y - r * 0.25 - 2);
    g.stroke();
    // mũi tên xoay góc trên phải
    if (rotatable) {
      const ax = X + t * 0.28;
      const ay = Y - t * 0.28;
      g.strokeStyle = "rgba(140,220,255,0.9)";
      g.lineWidth = 1.6;
      g.beginPath();
      g.arc(ax, ay, t * 0.1, -Math.PI * 0.2, Math.PI * 1.1);
      g.stroke();
      g.fillStyle = "rgba(140,220,255,0.9)";
      g.beginPath();
      const tipA = -Math.PI * 0.2;
      const tx = ax + Math.cos(tipA) * t * 0.1;
      const ty = ay + Math.sin(tipA) * t * 0.1;
      g.moveTo(tx + 3, ty - 2);
      g.lineTo(tx - 3, ty - 3);
      g.lineTo(tx + 1, ty + 4);
      g.closePath();
      g.fill();
    }
  }

  function drawSplitter(x, y, o, time) {
    if (IMGS.splitter) {
      const X = cx(x);
      const Y = cy(y);
      const s = t * 1.02;
      g.drawImage(IMGS.splitter, X - s / 2, Y - s / 2, s, s);
      // chữ thập + chấm sáng giữa (phần động vẽ code như cũ)
      const r2 = t * 0.24;
      g.strokeStyle = "rgba(255,140,155,0.75)";
      g.lineWidth = 1.8;
      g.beginPath();
      g.moveTo(X - r2, Y);
      g.lineTo(X + r2, Y);
      g.moveTo(X, Y - r2);
      g.lineTo(X, Y + r2);
      g.stroke();
      g.strokeStyle = "rgba(255,170,185,0.5)";
      g.lineWidth = 2.6;
      const a2 = o === "/" ? -Math.PI / 4 : Math.PI / 4;
      g.beginPath();
      g.moveTo(X - Math.cos(a2) * r2 * 0.8, Y - Math.sin(a2) * r2 * 0.8);
      g.lineTo(X + Math.cos(a2) * r2 * 0.8, Y + Math.sin(a2) * r2 * 0.8);
      g.stroke();
      g.save();
      g.shadowColor = "#ff8091";
      g.shadowBlur = 8 + 3 * Math.sin(time * 5);
      g.fillStyle = "#fff";
      g.beginPath();
      g.arc(X, Y, 3.4, 0, Math.PI * 2);
      g.fill();
      g.restore();
      return;
    }
    tileBase(x, y, "#1a0f14", "rgba(255,110,130,0.5)");
    const X = cx(x);
    const Y = cy(y);
    const r = t * 0.26;
    g.strokeStyle = "rgba(255,120,135,0.9)";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(X - r, Y);
    g.lineTo(X + r, Y);
    g.moveTo(X, Y - r);
    g.lineTo(X, Y + r);
    g.stroke();
    // chỉ báo hướng phản xạ (thanh chéo mờ)
    g.strokeStyle = "rgba(255,170,185,0.5)";
    g.lineWidth = 3;
    const a = o === "/" ? -Math.PI / 4 : Math.PI / 4;
    g.beginPath();
    g.moveTo(X - Math.cos(a) * r * 0.8, Y - Math.sin(a) * r * 0.8);
    g.lineTo(X + Math.cos(a) * r * 0.8, Y + Math.sin(a) * r * 0.8);
    g.stroke();
    g.save();
    g.shadowColor = "#ff8091";
    g.shadowBlur = 8 + 3 * Math.sin(time * 5);
    g.fillStyle = "#fff";
    g.beginPath();
    g.arc(X, Y, 3.2, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  function drawFilter(x, y, color) {
    const col = BEAM_COLORS[color];
    const spr = tinted("filter", FILTER_HUE[color] ?? 0);
    if (spr) {
      const X = cx(x);
      const Y = cy(y);
      const s = t * 1.04;
      g.save();
      g.shadowColor = col;
      g.shadowBlur = 8;
      g.drawImage(spr, X - s / 2, Y - (s * 1.03) / 2, s, s * 1.03);
      g.restore();
      return;
    }
    tileBase(x, y, "rgba(10,14,28,0.95)", `${col}55`);
    const X = cx(x);
    const Y = cy(y);
    const r = t * 0.26;
    g.save();
    g.shadowColor = col;
    g.shadowBlur = 14;
    g.strokeStyle = col;
    g.lineWidth = 4;
    g.beginPath();
    g.roundRect(X - r, Y - r, r * 2, r * 2, 4);
    g.stroke();
    g.restore();
    g.strokeStyle = `${col}77`;
    g.lineWidth = 1.6;
    g.beginPath();
    g.roundRect(X - r * 0.55, Y - r * 0.55, r * 1.1, r * 1.1, 2);
    g.stroke();
    g.fillStyle = `${col}22`;
    g.beginPath();
    g.roundRect(X - r, Y - r, r * 2, r * 2, 4);
    g.fill();
  }

  function drawBlocker(x, y) {
    if (IMGS.blocker) {
      const X = cx(x);
      const Y = cy(y);
      const s = t * 1.06;
      g.drawImage(IMGS.blocker, X - s / 2, Y - (s * 0.955) / 2, s, s * 0.955);
      return;
    }
    tileBase(x, y, "#1d2230", "rgba(115,125,150,0.55)");
    const X = cx(x);
    const Y = cy(y);
    const r = t * 0.27;
    // tấm kim loại lõm giữa
    g.fillStyle = "rgba(46,52,70,0.9)";
    g.beginPath();
    g.roundRect(X - r - 3, Y - r - 3, r * 2 + 6, r * 2 + 6, 4);
    g.fill();
    g.strokeStyle = "rgba(140,150,178,0.8)";
    g.lineWidth = 3.6;
    g.beginPath();
    g.moveTo(X - r, Y - r);
    g.lineTo(X + r, Y + r);
    g.moveTo(X + r, Y - r);
    g.lineTo(X - r, Y + r);
    g.stroke();
    g.strokeStyle = "rgba(24,28,42,0.9)";
    g.lineWidth = 1.2;
    g.stroke();
    g.fillStyle = "rgba(175,185,210,0.85)";
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      g.beginPath();
      g.arc(X + sx * r, Y + sy * r, 2.3, 0, Math.PI * 2);
      g.fill();
    }
  }

  /* ---------- vẽ chính ---------- */

  function draw(level, cells, result, ui, time) {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);

    // panel board + ngoặc góc cyan
    g.fillStyle = "rgba(9, 12, 26, 0.72)";
    g.beginPath();
    g.roundRect(ox - 12, oy - 12, level.w * t + 24, level.h * t + 24, 10);
    g.fill();
    g.strokeStyle = "rgba(70, 100, 160, 0.3)";
    g.lineWidth = 1;
    g.stroke();
    g.strokeStyle = "rgba(32,227,255,0.75)";
    g.lineWidth = 2.4;
    const bx0 = ox - 12;
    const by0 = oy - 12;
    const bx1 = ox + level.w * t + 12;
    const by1 = oy + level.h * t + 12;
    for (const [px, py, sx, sy] of [[bx0, by0, 1, 1], [bx1, by0, -1, 1], [bx0, by1, 1, -1], [bx1, by1, -1, -1]]) {
      g.beginPath();
      g.moveTo(px + sx * 20, py);
      g.lineTo(px, py);
      g.lineTo(px, py + sy * 20);
      g.stroke();
    }

    // lưới ô: sprite khối slate cắt từ ảnh, tile kín board (fallback vector)
    for (let y = 0; y < level.h; y++) {
      for (let x = 0; x < level.w; x++) {
        if (IMGS.floor) {
          g.drawImage(IMGS.floor, ox + x * t, oy + y * t, t, t);
          continue;
        }
        const px = ox + x * t + 2;
        const py = oy + y * t + 2;
        const tg = g.createLinearGradient(0, py, 0, py + t - 4);
        tg.addColorStop(0, "#2b3247");
        tg.addColorStop(1, "#1c2233");
        g.fillStyle = tg;
        g.beginPath();
        g.roundRect(px, py, t - 4, t - 4, 5);
        g.fill();
        g.strokeStyle = TILE_LINE;
        g.lineWidth = 1;
        g.stroke();
        // highlight mép trên nhẹ
        g.strokeStyle = "rgba(255,255,255,0.06)";
        g.beginPath();
        g.moveTo(px + 4, py + 1.4);
        g.lineTo(px + t - 8, py + 1.4);
        g.stroke();
      }
    }

    // hover
    if (ui.hover) {
      const { x, y, can } = ui.hover;
      g.fillStyle = can ? "rgba(32,227,255,0.14)" : "rgba(255,80,100,0.08)";
      g.strokeStyle = can ? "rgba(32,227,255,0.5)" : "rgba(255,80,100,0.3)";
      g.lineWidth = 1.6;
      g.beginPath();
      g.roundRect(ox + x * t + 1.5, oy + y * t + 1.5, t - 3, t - 3, 4);
      g.fill();
      g.stroke();
    }

    // tia laser (dưới thành phần một chút nhưng trên lưới)
    const pulse = 0.8 + 0.2 * Math.sin(time * 6);
    for (const s of result.segs) {
      const col = BEAM_COLORS[s.color];
      let x2 = cx(s.x2);
      let y2 = cy(s.y2);
      if (s.cut) {
        x2 = cx(s.x1) + (x2 - cx(s.x1)) * (1 - s.cut);
        y2 = cy(s.y1) + (y2 - cy(s.y1)) * (1 - s.cut);
      }
      g.save();
      g.globalAlpha = pulse;
      // quầng ngoài mềm
      g.strokeStyle = col;
      g.globalAlpha = pulse * 0.22;
      g.lineWidth = 9;
      g.beginPath();
      g.moveTo(cx(s.x1), cy(s.y1));
      g.lineTo(x2, y2);
      g.stroke();
      // lõi đậm phát sáng
      g.globalAlpha = pulse;
      g.shadowColor = col;
      g.shadowBlur = 12;
      g.lineWidth = 4;
      g.stroke();
      g.shadowBlur = 0;
      g.strokeStyle = "rgba(255,255,255,0.85)";
      g.lineWidth = 1.4;
      g.stroke();
      g.restore();
    }

    // thành phần
    for (const f of level.fixed) {
      const [kind, x, y, a] = f;
      const key = `${x},${y}`;
      if (kind === "source") drawSource(x, y, a, time);
      else if (kind === "receiver") {
        const litSet = result.lit.get(key);
        drawReceiver(x, y, a, !!(litSet && litSet.has(a)), time);
      } else if (kind === "mirror") {
        const cell = cells.get(key);
        drawMirror(x, y, cell.o, true, ui.hint && ui.hint.x === x && ui.hint.y === y, time);
      } else if (kind === "splitter") drawSplitter(x, y, a, time);
      else if (kind === "filter") drawFilter(x, y, a);
      else if (kind === "blocker") drawBlocker(x, y);
    }
    for (const [key, p] of ui.placed) {
      const [x, y] = key.split(",").map(Number);
      drawMirror(x, y, p.o, true, ui.hint && ui.hint.x === x && ui.hint.y === y, time);
    }
  }

  return { fit, draw, geometry };
}

/** Icon chú giải sidebar trái (~30px): sprite thật, vẽ lại khi decode xong. */
export function paintMazeLegend(canvas, kind) {
  const repaint = () => paintMazeLegendNow(canvas, kind);
  repaint();
  if (!spritesReady) readyFns.add(repaint);
}

function paintMazeLegendNow(canvas, kind) {
  canvas.width = 56;
  canvas.height = 56;
  const c = canvas.getContext("2d");
  c.scale(2, 2);
  const sprMap = {
    source: IMGS.source,
    receiver: tinted("receiver", RECEIVER_HUE.red),
    mirror: IMGS.mirrorFs,
    splitter: IMGS.splitter,
    "filter-cyan": tinted("filter", FILTER_HUE.cyan),
    "filter-violet": tinted("filter", FILTER_HUE.violet),
    blocker: IMGS.blocker,
  };
  if (sprMap[kind]) {
    c.drawImage(sprMap[kind], 0.5, 0.5, 27, 27);
    if (kind === "splitter") {
      c.strokeStyle = "rgba(255,140,155,0.9)";
      c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(7.5, 14);
      c.lineTo(20.5, 14);
      c.moveTo(14, 7.5);
      c.lineTo(14, 20.5);
      c.stroke();
      c.fillStyle = "#fff";
      c.beginPath();
      c.arc(14, 14, 1.9, 0, Math.PI * 2);
      c.fill();
    }
    return;
  }
  c.fillStyle = "#141927";
  c.strokeStyle = "rgba(120,140,190,0.4)";
  c.beginPath();
  c.roundRect(1, 1, 26, 26, 5);
  c.fill();
  c.stroke();
  const X = 14;
  const Y = 14;
  if (kind === "source") {
    c.strokeStyle = "#ff3b4f";
    c.lineWidth = 1.6;
    c.beginPath();
    c.arc(X, Y, 7, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = "#ff5a68";
    c.beginPath();
    c.arc(X, Y, 3, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "rgba(255,90,104,0.9)";
    c.beginPath();
    c.moveTo(X + 7, Y);
    c.lineTo(X + 13, Y);
    c.stroke();
  } else if (kind === "receiver") {
    c.strokeStyle = "#4df77f";
    c.lineWidth = 2;
    c.beginPath();
    c.arc(X, Y, 7.5, 0, Math.PI * 2);
    c.stroke();
    c.lineWidth = 1.4;
    c.beginPath();
    c.arc(X, Y, 4.4, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = "#4df77f";
    c.beginPath();
    c.arc(X, Y, 1.8, 0, Math.PI * 2);
    c.fill();
  } else if (kind === "mirror") {
    c.save();
    c.translate(X, Y);
    c.rotate(-Math.PI / 4);
    const grad = c.createLinearGradient(0, -2, 0, 2);
    grad.addColorStop(0, "#e8f4ff");
    grad.addColorStop(1, "#5d7fa8");
    c.fillStyle = grad;
    c.beginPath();
    c.roundRect(-8, -2.4, 16, 4.8, 2.4);
    c.fill();
    c.restore();
    c.strokeStyle = "rgba(140,220,255,0.9)";
    c.lineWidth = 1.2;
    c.beginPath();
    c.arc(21, 7, 3, -0.5, 3.4);
    c.stroke();
  } else if (kind === "splitter") {
    c.strokeStyle = "rgba(255,120,135,0.95)";
    c.lineWidth = 1.8;
    c.beginPath();
    c.moveTo(X - 7, Y);
    c.lineTo(X + 7, Y);
    c.moveTo(X, Y - 7);
    c.lineTo(X, Y + 7);
    c.stroke();
    c.fillStyle = "#fff";
    c.beginPath();
    c.arc(X, Y, 2.2, 0, Math.PI * 2);
    c.fill();
  } else if (kind === "filter-cyan" || kind === "filter-violet") {
    const col = kind === "filter-cyan" ? "#20e3ff" : "#9a5cff";
    c.strokeStyle = col;
    c.lineWidth = 2.6;
    c.shadowColor = col;
    c.shadowBlur = 5;
    c.beginPath();
    c.roundRect(X - 6.5, Y - 6.5, 13, 13, 2);
    c.stroke();
  } else if (kind === "blocker") {
    c.strokeStyle = "rgba(130,140,165,0.85)";
    c.lineWidth = 2.4;
    c.beginPath();
    c.moveTo(X - 6, Y - 6);
    c.lineTo(X + 6, Y + 6);
    c.moveTo(X + 6, Y - 6);
    c.lineTo(X - 6, Y + 6);
    c.stroke();
  }
}

/** Icon gương trong KHO GƯƠNG (slot vuông): sprite tile gương như ảnh. */
export function paintInventoryMirror(canvas, filled) {
  // lưu trạng thái mới nhất lên canvas để repaint khi asset sẵn sàng
  canvas.__lmFilled = filled;
  paintInventoryMirrorNow(canvas, filled);
  if (!spritesReady && !canvas.__lmQueued) {
    canvas.__lmQueued = true;
    readyFns.add(() => paintInventoryMirrorNow(canvas, canvas.__lmFilled));
  }
}

function paintInventoryMirrorNow(canvas, filled) {
  canvas.width = 76;
  canvas.height = 76;
  const c = canvas.getContext("2d");
  c.scale(2, 2);
  c.clearRect(0, 0, 38, 38);
  if (!filled) return;
  if (IMGS.mirrorFs) {
    c.drawImage(IMGS.mirrorFs, 1, 1, 36, 36);
    return;
  }
  c.save();
  c.translate(19, 20);
  c.rotate(-Math.PI / 4);
  const grad = c.createLinearGradient(0, -3, 0, 3);
  grad.addColorStop(0, "#e8f4ff");
  grad.addColorStop(0.5, "#9fc3e8");
  grad.addColorStop(1, "#5d7fa8");
  c.fillStyle = grad;
  c.beginPath();
  c.roundRect(-11, -3.2, 22, 6.4, 3.2);
  c.fill();
  c.restore();
  c.strokeStyle = "rgba(140,220,255,0.9)";
  c.lineWidth = 1.5;
  c.beginPath();
  c.arc(29, 9, 4, -0.4, 3.5);
  c.stroke();
  c.fillStyle = "rgba(140,220,255,0.9)";
  c.beginPath();
  c.moveTo(32.6, 6.4);
  c.lineTo(29.4, 6);
  c.lineTo(31.8, 9.6);
  c.closePath();
  c.fill();
}

export { REFLECT };
