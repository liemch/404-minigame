/**
 * render.js — vẽ Cyber Defense theo ảnh reference: bảng mạch PCB navy
 * với trace cyan, tuyến đường tối viền xanh phát sáng + chevron chạy,
 * pad bát giác lime dấu "+", 5 kiểu tháp có chevron cấp, 4 kiểu bot với
 * thanh máu đỏ, CORE khối lập phương cyan + badge %, đạn/tia/nổ/xung.
 */

import { seededRand } from "../../core/utils.js";
import { WORLD_W, WORLD_H, CORE, PADS, PAD_R, TOWERS, pointAt } from "./data.js";

const BG = "#071021";
const TRACE = "rgba(32, 120, 200, 0.16)";
const PATH_FILL = "#0d1b3a";
const PATH_EDGE = "#2f7bff";

export function createDefenseRenderer(g, paths) {
  let staticLayer = null;
  const fx = []; // hiệu ứng tạm: {kind, x, y, t, ttl, ...}
  const floats = []; // chữ nổi +9⚡

  /* ---------------- lớp tĩnh ---------------- */

  function buildStatic() {
    staticLayer = document.createElement("canvas");
    const S = 1.3;
    staticLayer.width = WORLD_W * S;
    staticLayer.height = WORLD_H * S;
    const s = staticLayer.getContext("2d");
    s.scale(S, S);

    s.fillStyle = BG;
    s.fillRect(0, 0, WORLD_W, WORLD_H);

    // trace mạch in: đường gấp khúc + chấm hàn (seeded)
    const rand = seededRand(2077);
    s.strokeStyle = TRACE;
    s.fillStyle = "rgba(32,120,200,0.22)";
    s.lineWidth = 1.6;
    for (let i = 0; i < 70; i++) {
      let x = rand() * WORLD_W;
      let y = rand() * WORLD_H;
      s.beginPath();
      s.moveTo(x, y);
      const segs = 2 + Math.floor(rand() * 3);
      for (let k = 0; k < segs; k++) {
        const len = 30 + rand() * 90;
        if (rand() > 0.5) x += rand() > 0.5 ? len : -len;
        else y += rand() > 0.5 ? len : -len;
        s.lineTo(x, y);
      }
      s.stroke();
      s.beginPath();
      s.arc(x, y, 2.4, 0, Math.PI * 2);
      s.fill();
    }
    // vi mạch chữ nhật mờ
    for (let i = 0; i < 12; i++) {
      const w = 40 + rand() * 70;
      const h = 26 + rand() * 40;
      const x = rand() * (WORLD_W - w);
      const y = rand() * (WORLD_H - h);
      s.strokeStyle = "rgba(32,120,200,0.12)";
      s.strokeRect(x, y, w, h);
      s.fillStyle = "rgba(32,120,200,0.05)";
      s.fillRect(x, y, w, h);
    }

    // tuyến đường: nền tối + viền xanh glow
    s.lineJoin = "round";
    s.lineCap = "round";
    for (const lane of [paths.A, paths.B]) {
      const path = new Path2D();
      path.moveTo(lane.nodes[0][0], lane.nodes[0][1]);
      for (let i = 1; i < lane.nodes.length; i++) path.lineTo(lane.nodes[i][0], lane.nodes[i][1]);
      s.strokeStyle = "rgba(47,123,255,0.3)";
      s.lineWidth = 54;
      s.stroke(path);
      s.strokeStyle = PATH_FILL;
      s.lineWidth = 44;
      s.stroke(path);
      s.strokeStyle = PATH_EDGE;
      s.lineWidth = 2.4;
      // hai mép
      s.globalAlpha = 0.85;
      s.save();
      s.translate(0, -22);
      s.stroke(path);
      s.translate(0, 44);
      s.stroke(path);
      s.restore();
      s.globalAlpha = 1;
    }

    // mũi tên hồng ở 2 cửa vào (như ảnh)
    for (const lane of [paths.A, paths.B]) {
      const [x, y] = lane.nodes[0];
      s.fillStyle = "#ff4fd8";
      for (let k = 0; k < 3; k++) {
        s.globalAlpha = 1 - k * 0.28;
        s.beginPath();
        s.moveTo(x + 14 + k * 16, y - 12);
        s.lineTo(x + 30 + k * 16, y);
        s.lineTo(x + 14 + k * 16, y + 12);
        s.lineTo(x + 20 + k * 16, y);
        s.closePath();
        s.fill();
      }
      s.globalAlpha = 1;
    }

    // pad bát giác lime với dấu +
    for (const p of PADS) {
      s.save();
      s.translate(p.x, p.y);
      s.strokeStyle = "rgba(190,255,80,0.55)";
      s.fillStyle = "rgba(190,255,80,0.06)";
      s.lineWidth = 2;
      s.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI / 4) * i + Math.PI / 8;
        const x = Math.cos(a) * PAD_R;
        const y = Math.sin(a) * PAD_R;
        if (i === 0) s.moveTo(x, y);
        else s.lineTo(x, y);
      }
      s.closePath();
      s.fill();
      s.stroke();
      s.strokeStyle = "rgba(190,255,80,0.5)";
      s.lineWidth = 3;
      s.beginPath();
      s.moveTo(-8, 0);
      s.lineTo(8, 0);
      s.moveTo(0, -8);
      s.lineTo(0, 8);
      s.stroke();
      s.restore();
    }
  }

  /* ---------------- painter con ---------------- */

  function drawChevrons(time) {
    g.fillStyle = "rgba(120,180,255,0.5)";
    for (const lane of [paths.A, paths.B]) {
      const spacing = 95;
      const offset = (time * 46) % spacing;
      for (let d = offset; d < lane.totalLen - 30; d += spacing) {
        const i = Math.floor(d / lane.step);
        const p = lane.pts[i];
        const q = lane.pts[Math.min(lane.pts.length - 1, i + 3)];
        const a = Math.atan2(q[1] - p[1], q[0] - p[0]);
        g.save();
        g.translate(p[0], p[1]);
        g.rotate(a);
        g.beginPath();
        g.moveTo(-5, -7);
        g.lineTo(4, 0);
        g.lineTo(-5, 7);
        g.lineTo(-1, 0);
        g.closePath();
        g.fill();
        g.restore();
      }
    }
  }

  function drawTower(t, sim, time, selected) {
    const def = TOWERS[t.type];
    const st = sim.stats(t);
    g.save();
    g.translate(t.x, t.y);

    // range circle khi được chọn (nét đứt như ảnh)
    if (selected) {
      g.strokeStyle = "rgba(32,227,255,0.75)";
      g.setLineDash([10, 8]);
      g.lineDashOffset = -time * 26;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(0, 0, st.range, 0, Math.PI * 2);
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = "rgba(32,227,255,0.05)";
      g.fill();
    }

    // bệ bát giác
    g.fillStyle = "#0c142c";
    g.strokeStyle = def.color;
    g.lineWidth = 2;
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI / 4) * i + Math.PI / 8;
      if (i === 0) g.moveTo(Math.cos(a) * 24, Math.sin(a) * 24);
      else g.lineTo(Math.cos(a) * 24, Math.sin(a) * 24);
    }
    g.closePath();
    g.fill();
    g.stroke();

    // chevron cấp trên bệ
    g.strokeStyle = def.color;
    g.lineWidth = 2;
    for (let l = 0; l <= t.level; l++) {
      const y = 15 - l * 5;
      g.beginPath();
      g.moveTo(-6, y + 3);
      g.lineTo(0, y - 2);
      g.lineTo(6, y + 3);
      g.stroke();
    }

    // tháp pháo xoay theo mục tiêu
    const aim = t.aimAt ? Math.atan2(t.aimAt.y - t.y, t.aimAt.x - t.x) : -Math.PI / 2;
    g.save();
    g.translate(0, -6);
    if (t.type === "rapid" || t.type === "sniper") {
      g.rotate(aim);
      g.fillStyle = def.color;
      const len = t.type === "sniper" ? 24 : 15;
      g.fillRect(2, -4.5, len, 3);
      if (t.type === "rapid") g.fillRect(2, 1.5, len, 3);
      else g.fillRect(2, 0.5, len, 3);
      g.fillStyle = "#dff6ff";
      g.beginPath();
      g.arc(0, 0, 7.5, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = def.color;
      g.stroke();
    } else if (t.type === "slow") {
      // cuộn tesla: trụ + vòng
      g.fillStyle = "#171232";
      g.fillRect(-5, -16, 10, 18);
      g.strokeStyle = def.color;
      for (let k = 0; k < 3; k++) {
        g.beginPath();
        g.ellipse(0, -4 - k * 5, 8 - k * 1.5, 3, 0, 0, Math.PI * 2);
        g.stroke();
      }
      g.fillStyle = def.color;
      g.beginPath();
      g.arc(0, -18, 4 + Math.sin(time * 6) * 0.8, 0, Math.PI * 2);
      g.fill();
    } else if (t.type === "blast") {
      g.rotate(aim);
      g.fillStyle = "#2a1030";
      g.strokeStyle = def.color;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(0, 0, 9, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = def.color;
      g.fillRect(4, -5, 14, 10);
    } else if (t.type === "nova") {
      g.fillStyle = "#15240a";
      g.strokeStyle = def.color;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(0, -4, 9, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = def.color;
      g.globalAlpha = 0.6 + Math.sin(time * 5) * 0.3;
      g.beginPath();
      g.arc(0, -4, 4.5, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
    }
    g.restore();
    g.restore();
  }

  function drawEnemy(e, time) {
    g.save();
    g.translate(e.x, e.y);
    const bob = Math.sin(time * 7 + e.id) * 1.2;
    g.translate(0, bob);

    if (e.type === "tank") {
      g.fillStyle = "#131a33";
      g.strokeStyle = "#4a5b8f";
      g.lineWidth = 2;
      g.beginPath();
      g.roundRect(-15, -13, 30, 26, 5);
      g.fill();
      g.stroke();
      g.fillStyle = "#0a0f22";
      g.fillRect(-17, -13, 5, 26);
      g.fillRect(12, -13, 5, 26);
      g.fillStyle = "#ff4f64";
      g.beginPath();
      g.arc(0, 0, 4.5, 0, Math.PI * 2);
      g.fill();
    } else if (e.type === "fast") {
      g.fillStyle = "#161230";
      g.strokeStyle = "#7a5cff";
      g.lineWidth = 1.8;
      g.beginPath();
      g.moveTo(11, 0);
      g.lineTo(-8, -8);
      g.lineTo(-4, 0);
      g.lineTo(-8, 8);
      g.closePath();
      g.fill();
      g.stroke();
      g.fillStyle = "#ff4f64";
      g.fillRect(2, -1.6, 4, 3.2);
    } else {
      g.fillStyle = "#121830";
      g.strokeStyle = e.type === "shield" ? "#20e3ff" : "#44507f";
      g.lineWidth = 1.8;
      g.beginPath();
      g.roundRect(-10, -9, 20, 18, 4);
      g.fill();
      g.stroke();
      g.fillStyle = "#ff4f64";
      g.fillRect(-4, -3, 8, 4);
      // chân nhỏ
      g.fillStyle = "#0a0f22";
      g.fillRect(-9, 9, 5, 3);
      g.fillRect(4, 9, 5, 3);
    }

    // bong bóng khiên
    if (e.maxShield > 0 && e.shield > 0) {
      g.strokeStyle = `rgba(32,227,255,${0.35 + (e.shield / e.maxShield) * 0.4})`;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(0, 0, e.r + 5, 0, Math.PI * 2);
      g.stroke();
    }

    // thanh máu đỏ (như ảnh)
    const w = 24;
    g.fillStyle = "rgba(10,10,20,0.8)";
    g.fillRect(-w / 2, -e.r - 10, w, 4);
    g.fillStyle = "#ff3b4f";
    g.fillRect(-w / 2, -e.r - 10, w * Math.max(0, e.hp / e.maxHp), 4);
    if (e.maxShield > 0 && e.shield > 0) {
      g.fillStyle = "#20e3ff";
      g.fillRect(-w / 2, -e.r - 14, w * (e.shield / e.maxShield), 2.5);
    }
    g.restore();
  }

  function drawCore(sim, time) {
    const { x, y } = CORE;
    g.save();
    g.translate(x, y);
    // vòng lục giác đế
    g.strokeStyle = "rgba(32,227,255,0.5)";
    g.lineWidth = 2;
    for (const r of [44, 56]) {
      g.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i + time * (r === 44 ? 0.25 : -0.18);
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r * 0.9;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.closePath();
      g.stroke();
    }
    // khối lập phương wireframe xoay
    const rot = time * 0.8;
    const s3 = 20;
    const pts = [];
    for (let i = 0; i < 8; i++) {
      const sx = i & 1 ? 1 : -1;
      const sy = i & 2 ? 1 : -1;
      const sz = i & 4 ? 1 : -1;
      const rx = sx * Math.cos(rot) - sz * Math.sin(rot);
      const rz = sx * Math.sin(rot) + sz * Math.cos(rot);
      pts.push([rx * s3, sy * s3 * 0.85 - rz * 6]);
    }
    const edges = [[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7]];
    const hurt = sim.core / sim.coreMax;
    g.strokeStyle = hurt > 0.4 ? "#20e3ff" : "#ff4f64";
    g.lineWidth = 2;
    g.save();
    g.shadowColor = g.strokeStyle;
    g.shadowBlur = 14;
    g.beginPath();
    for (const [a, b] of edges) {
      g.moveTo(pts[a][0], pts[a][1]);
      g.lineTo(pts[b][0], pts[b][1]);
    }
    g.stroke();
    g.restore();

    // badge CORE % (như ảnh)
    const pct = Math.round((sim.core / sim.coreMax) * 100);
    g.translate(0, -76);
    g.fillStyle = "rgba(8,14,28,0.92)";
    g.strokeStyle = pct > 40 ? "#a8ff3e" : "#ff4f64";
    g.lineWidth = 1.6;
    g.beginPath();
    g.roundRect(-38, -16, 76, 32, 4);
    g.fill();
    g.stroke();
    g.fillStyle = "#8fa3c8";
    g.font = "700 10px 'JetBrains Mono', monospace";
    g.textAlign = "center";
    g.fillText("CORE", 0, -3);
    g.fillStyle = pct > 40 ? "#a8ff3e" : "#ff4f64";
    g.font = "800 14px 'JetBrains Mono', monospace";
    g.fillText(`${pct}%`, 0, 12);
    g.restore();
  }

  function drawProjectile(p) {
    if (p.kind === "blast") {
      g.fillStyle = "#ff4fd8";
      g.beginPath();
      g.arc(p.x, p.y, 5, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "rgba(255,79,216,0.45)";
      g.lineWidth = 2;
      g.beginPath();
      g.arc(p.x, p.y, 8, 0, Math.PI * 2);
      g.stroke();
    } else {
      const dx = p.lastX - p.x;
      const dy = p.lastY - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const col = p.kind === "sniper" ? "#ffd23f" : "#20e3ff";
      g.strokeStyle = col;
      g.lineWidth = 3;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(p.x - (dx / d) * 10, p.y - (dy / d) * 10);
      g.lineTo(p.x, p.y);
      g.stroke();
    }
  }

  /* ---------------- hiệu ứng ---------------- */

  function addEvents(events, time) {
    for (const e of events) {
      if (e.type === "zap") fx.push({ kind: "zap", ...e, t: time, ttl: 0.14 });
      else if (e.type === "boom") fx.push({ kind: "boom", x: e.x, y: e.y, r: e.r, t: time, ttl: 0.4 });
      else if (e.type === "pulse") fx.push({ kind: "pulse", x: e.x, y: e.y, r: e.r, t: time, ttl: 0.5 });
      else if (e.type === "kill") {
        fx.push({ kind: "burst", x: e.x, y: e.y, t: time, ttl: 0.35 });
        floats.push({ x: e.x, y: e.y - 14, text: `+${e.reward}⚡`, t: time, ttl: 0.9, color: "#a8ff3e" });
      } else if (e.type === "hit") fx.push({ kind: "spark", x: e.x, y: e.y, t: time, ttl: 0.14 });
      else if (e.type === "build") fx.push({ kind: "buildring", x: e.x, y: e.y, t: time, ttl: 0.4 });
      else if (e.type === "upgrade") fx.push({ kind: "buildring", x: e.x, y: e.y, t: time, ttl: 0.4 });
      else if (e.type === "sell") floats.push({ x: e.x, y: e.y, text: `+${e.refund}⚡`, t: time, ttl: 0.9, color: "#ffd23f" });
      else if (e.type === "shieldbreak") fx.push({ kind: "spark", x: e.x, y: e.y, t: time, ttl: 0.2 });
      else if (e.type === "corehit") fx.push({ kind: "coreflash", t: time, ttl: 0.3 });
    }
  }

  function drawFx(time) {
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i];
      const k = (time - f.t) / f.ttl;
      if (k > 1) {
        fx.splice(i, 1);
        continue;
      }
      if (f.kind === "zap") {
        g.strokeStyle = `rgba(154,92,255,${1 - k})`;
        g.lineWidth = 2.4;
        g.beginPath();
        g.moveTo(f.x0, f.y0);
        const mx = (f.x0 + f.x1) / 2 + (Math.random() - 0.5) * 14;
        const my = (f.y0 + f.y1) / 2 + (Math.random() - 0.5) * 14;
        g.lineTo(mx, my);
        g.lineTo(f.x1, f.y1);
        g.stroke();
      } else if (f.kind === "boom") {
        g.strokeStyle = `rgba(255,79,216,${1 - k})`;
        g.lineWidth = 4 * (1 - k) + 1;
        g.beginPath();
        g.arc(f.x, f.y, f.r * (0.3 + k * 0.7), 0, Math.PI * 2);
        g.stroke();
        g.fillStyle = `rgba(255,120,220,${0.35 * (1 - k)})`;
        g.beginPath();
        g.arc(f.x, f.y, f.r * k, 0, Math.PI * 2);
        g.fill();
      } else if (f.kind === "pulse") {
        g.strokeStyle = `rgba(168,255,62,${1 - k})`;
        g.lineWidth = 3;
        g.beginPath();
        g.arc(f.x, f.y, f.r * k, 0, Math.PI * 2);
        g.stroke();
      } else if (f.kind === "burst") {
        g.fillStyle = `rgba(255,140,80,${1 - k})`;
        for (let j = 0; j < 6; j++) {
          const a = (Math.PI / 3) * j;
          const d = 4 + k * 18;
          g.fillRect(f.x + Math.cos(a) * d - 1.5, f.y + Math.sin(a) * d - 1.5, 3, 3);
        }
      } else if (f.kind === "spark") {
        g.fillStyle = `rgba(160,230,255,${1 - k})`;
        g.fillRect(f.x - 2, f.y - 2, 4, 4);
      } else if (f.kind === "buildring") {
        g.strokeStyle = `rgba(168,255,62,${1 - k})`;
        g.lineWidth = 2.4;
        g.beginPath();
        g.arc(f.x, f.y, 12 + k * 26, 0, Math.PI * 2);
        g.stroke();
      } else if (f.kind === "coreflash") {
        g.fillStyle = `rgba(255,60,80,${0.22 * (1 - k)})`;
        g.fillRect(0, 0, WORLD_W, WORLD_H);
      }
    }
    // chữ nổi
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i];
      const k = (time - f.t) / f.ttl;
      if (k > 1) {
        floats.splice(i, 1);
        continue;
      }
      g.globalAlpha = 1 - k;
      g.fillStyle = f.color;
      g.font = "800 13px 'JetBrains Mono', monospace";
      g.textAlign = "center";
      g.fillText(f.text, f.x, f.y - k * 26);
      g.globalAlpha = 1;
    }
  }

  /* ---------------- khung hình ---------------- */

  function draw(sim, ui, time) {
    if (!staticLayer) buildStatic();
    g.clearRect(0, 0, WORLD_W, WORLD_H);
    g.drawImage(staticLayer, 0, 0, WORLD_W, WORLD_H);
    drawChevrons(time);

    // ghost xây tháp trên pad đang trỏ
    if (ui.buildType && ui.hoverPad) {
      const p = ui.hoverPad;
      const def = TOWERS[ui.buildType];
      const ok = ui.canPlace;
      g.strokeStyle = ok ? "rgba(168,255,62,0.8)" : "rgba(255,79,100,0.8)";
      g.setLineDash([8, 6]);
      g.lineWidth = 2;
      g.beginPath();
      g.arc(p.x, p.y, def.levels[0].range, 0, Math.PI * 2);
      g.stroke();
      g.setLineDash([]);
      g.globalAlpha = 0.55;
      drawTower({ type: ui.buildType, level: 0, x: p.x, y: p.y, aimAt: null }, sim, time, false);
      g.globalAlpha = 1;
    }

    for (const t of sim.towers) drawTower(t, sim, time, t.id === ui.selectedId);
    for (const e of sim.enemies) drawEnemy(e, time);
    for (const p of sim.projectiles) drawProjectile(p);
    drawCore(sim, time);
    drawFx(time);
  }

  return { draw, addEvents };
}

/* ---------------- icon tháp cho build bar ---------------- */

export function paintTowerIcon(canvas, type) {
  const size = 44;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  const g = canvas.getContext("2d");
  g.scale(dpr, dpr);
  const def = TOWERS[type];
  g.translate(size / 2, size / 2 + 4);
  // bệ
  g.fillStyle = "#0c142c";
  g.strokeStyle = def.color;
  g.lineWidth = 2;
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI / 4) * i + Math.PI / 8;
    if (i === 0) g.moveTo(Math.cos(a) * 16, Math.sin(a) * 16);
    else g.lineTo(Math.cos(a) * 16, Math.sin(a) * 16);
  }
  g.closePath();
  g.fill();
  g.stroke();
  g.translate(0, -5);
  if (type === "rapid" || type === "sniper") {
    g.rotate(-Math.PI / 3);
    g.fillStyle = def.color;
    g.fillRect(2, -3.5, type === "sniper" ? 17 : 11, 2.6);
    if (type === "rapid") g.fillRect(2, 1, 11, 2.6);
    g.fillStyle = "#dff6ff";
    g.beginPath();
    g.arc(0, 0, 5.5, 0, Math.PI * 2);
    g.fill();
  } else if (type === "slow") {
    g.fillStyle = "#171232";
    g.fillRect(-4, -11, 8, 13);
    g.strokeStyle = def.color;
    for (let k = 0; k < 3; k++) {
      g.beginPath();
      g.ellipse(0, -2 - k * 4, 6.5 - k, 2.4, 0, 0, Math.PI * 2);
      g.stroke();
    }
    g.fillStyle = def.color;
    g.beginPath();
    g.arc(0, -13, 3, 0, Math.PI * 2);
    g.fill();
  } else if (type === "blast") {
    g.rotate(-Math.PI / 3);
    g.fillStyle = "#2a1030";
    g.strokeStyle = def.color;
    g.beginPath();
    g.arc(0, 0, 6.5, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = def.color;
    g.fillRect(3, -3.5, 10, 7);
  } else {
    g.fillStyle = "#15240a";
    g.strokeStyle = def.color;
    g.beginPath();
    g.arc(0, -2, 6.5, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = def.color;
    g.beginPath();
    g.arc(0, -2, 3, 0, Math.PI * 2);
    g.fill();
  }
}
