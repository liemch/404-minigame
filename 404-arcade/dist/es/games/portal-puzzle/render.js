/**
 * render.js — vẽ board Portal Puzzle 404 bằng Canvas 2D theo ảnh
 * reference: nền navy, tường bevel slate, robot trắng mắt cyan, thùng
 * gỗ chữ X, công tắc tròn xanh/tím, cổng xoáy cyan/tím nối nhau bằng
 * nét đứt, laser đỏ lõi trắng, ô thoát xanh lá phát sáng.
 */

import { DIRS, computeBeams, exitOpen, colorActive } from "./engine.js";

const COL = {
  bgOut: "#05081a",
  floorA: "#111834",
  floorB: "#0e142d",
  floorLine: "rgba(96, 128, 210, 0.14)",
  wallTop: "#3a4877",
  wallFace: "#232d55",
  wallDark: "#161d3c",
  cyan: "#20e3ff",
  violet: "#9a5cff",
  blue: "#3b7bff",
  lime: "#a8ff3e",
  green: "#4df77f",
  red: "#ff4f64",
  wood: "#96622e",
  woodDark: "#5f3c17",
  woodLight: "#c08a4a",
  robot: "#eef2ff",
};

/* ---------------- Các painter nguyên tử (theo ô, gốc 0,0, cạnh t) ---------------- */

function drawFloor(g, x, y, t, alt) {
  g.fillStyle = alt ? COL.floorA : COL.floorB;
  g.fillRect(x, y, t, t);
  g.strokeStyle = COL.floorLine;
  g.lineWidth = 1;
  g.strokeRect(x + 0.5, y + 0.5, t - 1, t - 1);
  // đinh tán 4 góc mờ
  g.fillStyle = "rgba(96,128,210,0.16)";
  const o = Math.max(2, t * 0.07);
  g.fillRect(x + o, y + o, 1.6, 1.6);
  g.fillRect(x + t - o - 1.6, y + o, 1.6, 1.6);
  g.fillRect(x + o, y + t - o - 1.6, 1.6, 1.6);
  g.fillRect(x + t - o - 1.6, y + t - o - 1.6, 1.6, 1.6);
}

function drawWall(g, x, y, t) {
  g.fillStyle = COL.wallDark;
  g.fillRect(x, y, t, t);
  const b = Math.max(2, t * 0.14);
  g.fillStyle = COL.wallFace;
  g.fillRect(x + 1, y + 1, t - 2, t - 2);
  g.fillStyle = COL.wallTop;
  g.fillRect(x + 1, y + 1, t - 2, b);
  g.fillRect(x + 1, y + 1, b, t - 2);
  g.fillStyle = COL.wallDark;
  g.fillRect(x + t - 1 - b * 0.6, y + 2, b * 0.6, t - 3);
  g.fillRect(x + 2, y + t - 1 - b * 0.6, t - 3, b * 0.6);
}

function drawExit(g, x, y, t, open, time) {
  const cx = x + t / 2;
  const cy = y + t / 2;
  const pulse = open ? 0.7 + Math.sin(time * 3.2) * 0.3 : 0.25;
  const color = open ? COL.green : "rgba(120,160,140,0.75)";
  g.save();
  if (open) {
    g.shadowColor = COL.green;
    g.shadowBlur = t * 0.5 * pulse;
  }
  g.strokeStyle = color;
  g.lineWidth = Math.max(2, t * 0.08);
  const m = t * 0.16;
  g.strokeRect(x + m, y + m, t - m * 2, t - m * 2);
  // kim cương lồng nhau (như icon trong ảnh)
  g.beginPath();
  g.moveTo(cx, y + m * 1.7);
  g.lineTo(x + t - m * 1.7, cy);
  g.lineTo(cx, y + t - m * 1.7);
  g.lineTo(x + m * 1.7, cy);
  g.closePath();
  g.stroke();
  g.fillStyle = color;
  const d = t * 0.09;
  g.fillRect(cx - d, cy - d, d * 2, d * 2);
  g.restore();
  // tam giác chỉ xuống phía trên ô (chỉ khi mở)
  if (open) {
    const bob = Math.sin(time * 4) * t * 0.06;
    g.fillStyle = `rgba(77,247,127,${0.55 + Math.sin(time * 4) * 0.2})`;
    g.beginPath();
    g.moveTo(cx - t * 0.14, y - t * 0.3 + bob);
    g.lineTo(cx + t * 0.14, y - t * 0.3 + bob);
    g.lineTo(cx, y - t * 0.12 + bob);
    g.closePath();
    g.fill();
  }
}

function drawSwitch(g, x, y, t, color, mode, active, time) {
  const cx = x + t / 2;
  const cy = y + t / 2;
  const c = color === "blue" ? COL.blue : COL.violet;
  const r = t * 0.3;
  // đế
  g.fillStyle = "#0a0f24";
  g.beginPath();
  if (mode === "toggle") {
    const rr = r * 1.25;
    g.roundRect(cx - rr, cy - rr, rr * 2, rr * 2, rr * 0.35);
  } else {
    g.arc(cx, cy, r * 1.3, 0, Math.PI * 2);
  }
  g.fill();
  g.strokeStyle = "rgba(96,128,210,0.4)";
  g.lineWidth = 1.4;
  g.stroke();
  // lõi phát sáng
  g.save();
  g.shadowColor = c;
  g.shadowBlur = active ? t * 0.55 : t * 0.18;
  g.fillStyle = c;
  g.globalAlpha = active ? 1 : 0.55;
  g.beginPath();
  g.arc(cx, cy, r * (active ? 0.82 : 0.62), 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 1;
  g.fillStyle = "rgba(255,255,255,0.85)";
  g.beginPath();
  g.arc(cx - r * 0.22, cy - r * 0.22, r * 0.2, 0, Math.PI * 2);
  g.fill();
  g.restore();
  if (active) {
    g.strokeStyle = c;
    g.globalAlpha = 0.5 + Math.sin(time * 5) * 0.25;
    g.lineWidth = 1.6;
    g.beginPath();
    g.arc(cx, cy, r * 1.15, 0, Math.PI * 2);
    g.stroke();
    g.globalAlpha = 1;
  }
}

function drawPortal(g, x, y, t, color, time) {
  const cx = x + t / 2;
  const cy = y + t / 2;
  const c = color === "cyan" ? COL.cyan : COL.violet;
  const rx = t * 0.3;
  const ry = t * 0.38;
  g.save();
  g.translate(cx, cy);
  // lòng cổng tối
  g.fillStyle = "#04060f";
  g.beginPath();
  g.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  g.fill();
  // vòng ngoài phát sáng
  g.shadowColor = c;
  g.shadowBlur = t * 0.4;
  g.strokeStyle = c;
  g.lineWidth = Math.max(2, t * 0.09);
  g.beginPath();
  g.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  g.stroke();
  g.shadowBlur = 0;
  // xoáy bên trong
  g.strokeStyle = `rgba(255,255,255,0.65)`;
  g.lineWidth = 1.4;
  for (let i = 0; i < 2; i++) {
    const a = time * 2.4 + i * Math.PI;
    g.beginPath();
    g.ellipse(0, 0, rx * 0.55, ry * 0.55, 0, a, a + Math.PI * 0.9);
    g.stroke();
  }
  // hạt sáng bay quanh
  const pa = time * 3 + (color === "cyan" ? 0 : 2);
  g.fillStyle = c;
  g.beginPath();
  g.arc(Math.cos(pa) * rx * 0.95, Math.sin(pa) * ry * 0.95, 1.8, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

function drawCrate(g, x, y, t) {
  const m = t * 0.12;
  const s = t - m * 2;
  g.fillStyle = COL.wood;
  g.fillRect(x + m, y + m, s, s);
  g.strokeStyle = COL.woodDark;
  g.lineWidth = Math.max(2, t * 0.07);
  g.strokeRect(x + m + 1, y + m + 1, s - 2, s - 2);
  // chữ X ván gỗ
  g.strokeStyle = COL.woodLight;
  g.lineWidth = Math.max(2, t * 0.09);
  g.beginPath();
  g.moveTo(x + m + 3, y + m + 3);
  g.lineTo(x + m + s - 3, y + m + s - 3);
  g.moveTo(x + m + s - 3, y + m + 3);
  g.lineTo(x + m + 3, y + m + s - 3);
  g.stroke();
  // đinh 4 góc
  g.fillStyle = COL.woodDark;
  const o = m + 2.5;
  for (const [bx, by] of [[o, o], [t - o, o], [o, t - o], [t - o, t - o]]) {
    g.beginPath();
    g.arc(x + bx, y + by, Math.max(1.2, t * 0.035), 0, Math.PI * 2);
    g.fill();
  }
  // bóng đỉnh
  g.fillStyle = "rgba(255,255,255,0.14)";
  g.fillRect(x + m, y + m, s, Math.max(2, t * 0.08));
}

function drawEmitter(g, x, y, t, dir, on, time) {
  const cx = x + t / 2;
  const cy = y + t / 2;
  g.fillStyle = "#2a0d16";
  g.fillRect(x + 2, y + 2, t - 4, t - 4);
  g.strokeStyle = on ? COL.red : "rgba(255,79,100,0.4)";
  g.lineWidth = 2;
  g.strokeRect(x + 3, y + 3, t - 6, t - 6);
  // vấu hướng bắn
  const d = DIRS[dir];
  g.fillStyle = on ? COL.red : "rgba(255,79,100,0.4)";
  g.fillRect(cx + d.x * t * 0.28 - t * 0.1, cy + d.y * t * 0.28 - t * 0.1, t * 0.2, t * 0.2);
  // thấu kính
  g.save();
  if (on) {
    g.shadowColor = COL.red;
    g.shadowBlur = t * (0.35 + Math.sin(time * 8) * 0.1);
  }
  g.fillStyle = on ? "#ff8391" : "#5d2733";
  g.beginPath();
  g.arc(cx, cy, t * 0.16, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

function drawRobot(g, x, y, t, facing, time, dying) {
  const cx = x + t / 2;
  const bob = Math.sin(time * 3.4) * t * 0.035;
  const cy = y + t / 2 + bob;
  const w = t * 0.58;
  const h = t * 0.52;
  g.save();
  // quầng sáng chân
  g.fillStyle = "rgba(32,227,255,0.18)";
  g.beginPath();
  g.ellipse(cx, y + t * 0.86, t * 0.3, t * 0.1, 0, 0, Math.PI * 2);
  g.fill();
  // chân
  g.fillStyle = "#b9c3de";
  g.fillRect(cx - w * 0.32, cy + h * 0.34, w * 0.22, t * 0.16);
  g.fillRect(cx + w * 0.1, cy + h * 0.34, w * 0.22, t * 0.16);
  // thân
  g.fillStyle = dying ? "#ffb3ba" : COL.robot;
  g.beginPath();
  g.roundRect(cx - w / 2, cy - h / 2, w, h, t * 0.14);
  g.fill();
  // tai anten
  g.fillStyle = "#b9c3de";
  g.fillRect(cx - w * 0.62, cy - h * 0.18, w * 0.14, h * 0.36);
  g.fillRect(cx + w * 0.48, cy - h * 0.18, w * 0.14, h * 0.36);
  // visor
  const fx = (facing?.x || 0) * t * 0.05;
  const fy = (facing?.y || 0) * t * 0.04;
  g.fillStyle = "#0a1224";
  g.beginPath();
  g.roundRect(cx - w * 0.34 + fx, cy - h * 0.3 + fy, w * 0.68, h * 0.42, t * 0.08);
  g.fill();
  // mắt cyan
  g.save();
  g.shadowColor = COL.cyan;
  g.shadowBlur = t * 0.22;
  g.fillStyle = COL.cyan;
  const blink = Math.sin(time * 1.7) > 0.97 ? 0.25 : 1;
  const ew = t * 0.075;
  const eh = t * 0.1 * blink;
  g.fillRect(cx - w * 0.18 + fx - ew / 2, cy - h * 0.1 + fy - eh / 2, ew, eh);
  g.fillRect(cx + w * 0.18 + fx - ew / 2, cy - h * 0.1 + fy - eh / 2, ew, eh);
  g.restore();
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

    // nền ngoài board: chấm sao mờ
    g.fillStyle = COL.bgOut;
    g.fillRect(0, 0, cw, ch);
    g.fillStyle = "rgba(96,128,210,0.1)";
    for (let i = 0; i < 40; i++) {
      const sx = ((i * 97) % 173) / 173 * cw;
      const sy = ((i * 61) % 149) / 149 * ch;
      g.fillRect(sx, sy, 1.5, 1.5);
    }

    const { t, ox, oy } = geometry(level);
    const px = (gx) => ox + gx * t;
    const py = (gy) => oy + gy * t;

    const beams = computeBeams(level, snap);
    const open = exitOpen(level, snap);

    // đế board
    g.fillStyle = "#0a1026";
    g.beginPath();
    g.roundRect(ox - 8, oy - 8, level.w * t + 16, level.h * t + 16, 10);
    g.fill();
    g.strokeStyle = "rgba(58,72,119,0.8)";
    g.lineWidth = 2;
    g.stroke();

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
      g.globalAlpha = 0.3;
      g.setLineDash([6, 8]);
      g.lineDashOffset = -time * 22;
      g.lineWidth = 2;
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
          const flick = 0.75 + Math.sin(time * 26) * 0.12;
          g.save();
          g.lineCap = "round";
          g.strokeStyle = `rgba(255,42,63,${0.3 * flick})`;
          g.lineWidth = t * 0.3;
          g.beginPath();
          g.moveTo(x0, y0);
          g.lineTo(x1, y1);
          g.stroke();
          g.strokeStyle = `rgba(255,79,100,${0.85 * flick})`;
          g.lineWidth = t * 0.12;
          g.beginPath();
          g.moveTo(x0, y0);
          g.lineTo(x1, y1);
          g.stroke();
          g.strokeStyle = `rgba(255,240,244,${0.9 * flick})`;
          g.lineWidth = Math.max(1.4, t * 0.04);
          g.beginPath();
          g.moveTo(x0, y0);
          g.lineTo(x1, y1);
          g.stroke();
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
      g.lineWidth = 2.4;
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
