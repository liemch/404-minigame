/**
 * render.js — vẽ Cyber Defense theo ảnh reference: bảng mạch PCB navy
 * với trace sáng + chip + via, tuyến đường tối viền xanh phát sáng đều
 * hai bên + chevron chạy, pad bát giác lime dấu "+", 5 kiểu tháp nhiều
 * lớp (nòng đôi / cuộn tesla / pháo nổ...) có chevron cấp, 4 kiểu bot
 * robot mắt đỏ với thanh máu, CORE khối lập phương cyan trong khung lục
 * giác lớn + badge %, đạn/tia/nổ/xung có glow.
 */

import { seededRand } from "../../core/utils.js";
import { WORLD_W, WORLD_H, CORE, PADS, PAD_R, TOWERS, pointAt } from "./data.js";

const BG = "#061024";
const TRACE = "rgba(38, 130, 215, 0.2)";
const PATH_FILL = "#0d1c3e";
const PATH_EDGE = "#3f8cff";

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
    // vùng sáng nhẹ giữa bo mạch
    const glow = s.createRadialGradient(WORLD_W / 2, WORLD_H / 2, 100, WORLD_W / 2, WORLD_H / 2, 800);
    glow.addColorStop(0, "rgba(30,80,170,0.1)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    s.fillStyle = glow;
    s.fillRect(0, 0, WORLD_W, WORLD_H);

    // trace mạch in: đường gấp khúc + chấm hàn (seeded)
    const rand = seededRand(2077);
    s.lineWidth = 1.6;
    for (let i = 0; i < 95; i++) {
      let x = rand() * WORLD_W;
      let y = rand() * WORLD_H;
      const bright = rand() > 0.8;
      s.strokeStyle = bright ? "rgba(50,160,255,0.3)" : TRACE;
      s.fillStyle = bright ? "rgba(60,180,255,0.4)" : "rgba(38,130,215,0.26)";
      s.beginPath();
      s.moveTo(x, y);
      const segs = 2 + Math.floor(rand() * 4);
      for (let k = 0; k < segs; k++) {
        const len = 30 + rand() * 100;
        if (rand() > 0.5) x += rand() > 0.5 ? len : -len;
        else y += rand() > 0.5 ? len : -len;
        s.lineTo(x, y);
      }
      s.stroke();
      s.beginPath();
      s.arc(x, y, 2.6, 0, Math.PI * 2);
      s.fill();
      // vòng via quanh chấm hàn
      s.beginPath();
      s.arc(x, y, 4.6, 0, Math.PI * 2);
      s.stroke();
    }
    // vi mạch chữ nhật + chân pin
    for (let i = 0; i < 12; i++) {
      const w = 42 + rand() * 66;
      const h = 28 + rand() * 40;
      const x = rand() * (WORLD_W - w);
      const y = rand() * (WORLD_H - h);
      s.strokeStyle = "rgba(38,130,215,0.15)";
      s.lineWidth = 1.2;
      s.strokeRect(x, y, w, h);
      s.fillStyle = "rgba(38,130,215,0.05)";
      s.fillRect(x, y, w, h);
      s.fillStyle = "rgba(38,130,215,0.18)";
      const pins = Math.floor(w / 14);
      for (let p = 0; p < pins; p++) {
        s.fillRect(x + 5 + p * 14, y - 4, 5, 4);
        s.fillRect(x + 5 + p * 14, y + h, 5, 4);
      }
    }

    // tuyến đường: viền phát sáng đều 2 bên + lòng tối + kết cấu
    s.lineJoin = "round";
    s.lineCap = "round";
    for (const lane of [paths.A, paths.B]) {
      const path = new Path2D();
      path.moveTo(lane.nodes[0][0], lane.nodes[0][1]);
      for (let i = 1; i < lane.nodes.length; i++) path.lineTo(lane.nodes[i][0], lane.nodes[i][1]);
      // quầng ngoài
      s.strokeStyle = "rgba(63,140,255,0.14)";
      s.lineWidth = 64;
      s.stroke(path);
      s.strokeStyle = "rgba(63,140,255,0.3)";
      s.lineWidth = 54;
      s.stroke(path);
      // mép sáng
      s.strokeStyle = PATH_EDGE;
      s.lineWidth = 50;
      s.stroke(path);
      // lòng đường tối
      s.strokeStyle = PATH_FILL;
      s.lineWidth = 44;
      s.stroke(path);
      // kết cấu giữa lòng
      s.strokeStyle = "rgba(120,180,255,0.06)";
      s.lineWidth = 26;
      s.stroke(path);
      // vạch tim đường mờ
      s.strokeStyle = "rgba(120,180,255,0.14)";
      s.lineWidth = 1.6;
      s.setLineDash([10, 14]);
      s.stroke(path);
      s.setLineDash([]);
    }

    // mũi tên hồng ở 2 cửa vào (như ảnh)
    for (const lane of [paths.A, paths.B]) {
      const [x, y] = lane.nodes[0];
      s.save();
      s.shadowColor = "#ff4fd8";
      s.shadowBlur = 12;
      s.fillStyle = "#ff4fd8";
      for (let k = 0; k < 3; k++) {
        s.globalAlpha = 1 - k * 0.26;
        s.beginPath();
        s.moveTo(x + 12 + k * 18, y - 14);
        s.lineTo(x + 30 + k * 18, y);
        s.lineTo(x + 12 + k * 18, y + 14);
        s.lineTo(x + 19 + k * 18, y);
        s.closePath();
        s.fill();
      }
      s.restore();
      s.globalAlpha = 1;
    }

    // pad bát giác lime với dấu +
    for (const p of PADS) {
      s.save();
      s.translate(p.x, p.y);
      const oct = (r) => {
        s.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (Math.PI / 4) * i + Math.PI / 8;
          const x = Math.cos(a) * r;
          const y = Math.sin(a) * r;
          if (i === 0) s.moveTo(x, y);
          else s.lineTo(x, y);
        }
        s.closePath();
      };
      // quầng mờ
      s.strokeStyle = "rgba(190,255,80,0.14)";
      s.lineWidth = 6;
      oct(PAD_R + 2);
      s.stroke();
      // viền chính + nền
      s.strokeStyle = "rgba(190,255,80,0.7)";
      s.fillStyle = "rgba(190,255,80,0.06)";
      s.lineWidth = 2.2;
      oct(PAD_R);
      s.fill();
      s.stroke();
      // viền trong đứt
      s.strokeStyle = "rgba(190,255,80,0.3)";
      s.lineWidth = 1.2;
      s.setLineDash([5, 5]);
      oct(PAD_R - 6);
      s.stroke();
      s.setLineDash([]);
      // dấu +
      s.strokeStyle = "rgba(190,255,80,0.75)";
      s.lineWidth = 3.2;
      s.lineCap = "round";
      s.beginPath();
      s.moveTo(-9, 0);
      s.lineTo(9, 0);
      s.moveTo(0, -9);
      s.lineTo(0, 9);
      s.stroke();
      s.restore();
    }
  }

  /* ---------------- painter con ---------------- */

  function drawChevrons(time) {
    g.fillStyle = "rgba(140,200,255,0.6)";
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
        g.moveTo(-6, -8);
        g.lineTo(5, 0);
        g.lineTo(-6, 8);
        g.lineTo(-1.5, 0);
        g.closePath();
        g.fill();
        g.restore();
      }
    }
  }

  function octPath(r) {
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI / 4) * i + Math.PI / 8;
      if (i === 0) g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath();
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

    // vòng xung quanh THÁP GIẢM TỐC (như ảnh: vòng tím lan tỏa)
    if (t.type === "slow") {
      for (let k = 0; k < 2; k++) {
        const ph = ((time * 0.55 + k * 0.5) % 1);
        g.strokeStyle = `rgba(154,92,255,${0.34 * (1 - ph)})`;
        g.lineWidth = 2.2;
        g.beginPath();
        g.arc(0, 0, st.range * (0.25 + ph * 0.75), 0, Math.PI * 2);
        g.stroke();
      }
    }

    // bóng đổ
    g.fillStyle = "rgba(0,0,0,0.45)";
    g.beginPath();
    g.ellipse(0, 8, 24, 11, 0, 0, Math.PI * 2);
    g.fill();

    // bệ bát giác 2 tầng
    const baseGrad = g.createLinearGradient(0, -24, 0, 24);
    baseGrad.addColorStop(0, "#152048");
    baseGrad.addColorStop(1, "#0a1128");
    g.fillStyle = baseGrad;
    g.strokeStyle = def.color;
    g.lineWidth = 2.2;
    octPath(25);
    g.fill();
    g.save();
    g.shadowColor = def.color;
    g.shadowBlur = 9;
    g.stroke();
    g.restore();
    g.strokeStyle = `rgba(255,255,255,0.14)`;
    g.lineWidth = 1;
    octPath(19);
    g.stroke();

    // chevron cấp trên bệ
    g.strokeStyle = def.color;
    g.lineWidth = 2.4;
    g.lineCap = "round";
    for (let l = 0; l <= t.level; l++) {
      const y = 16 - l * 5.5;
      g.beginPath();
      g.moveTo(-6.5, y + 3);
      g.lineTo(0, y - 2.4);
      g.lineTo(6.5, y + 3);
      g.stroke();
    }

    // tháp pháo xoay theo mục tiêu
    const aim = t.aimAt ? Math.atan2(t.aimAt.y - t.y, t.aimAt.x - t.x) : -Math.PI / 2;
    g.save();
    g.translate(0, -7);
    if (t.type === "rapid" || t.type === "sniper") {
      g.rotate(aim);
      // nòng
      g.fillStyle = def.color;
      const len = t.type === "sniper" ? 26 : 17;
      if (t.type === "rapid") {
        g.fillRect(3, -5.5, len, 3.4);
        g.fillRect(3, 2.1, len, 3.4);
        g.fillStyle = "#eafcff";
        g.fillRect(len - 1, -5.5, 4, 3.4);
        g.fillRect(len - 1, 2.1, 4, 3.4);
      } else {
        g.fillRect(3, -2, len, 4);
        g.fillStyle = "#fff3c8";
        g.fillRect(len - 1, -2, 5, 4);
      }
      // thân đầu pháo
      const headGrad = g.createRadialGradient(-2, -2, 1, 0, 0, 10);
      headGrad.addColorStop(0, "#f2fbff");
      headGrad.addColorStop(0.6, "#b8ccdd");
      headGrad.addColorStop(1, "#5d7488");
      g.fillStyle = headGrad;
      g.beginPath();
      g.arc(0, 0, 8.5, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = def.color;
      g.lineWidth = 2;
      g.stroke();
      g.fillStyle = def.color;
      g.beginPath();
      g.arc(0, 0, 3, 0, Math.PI * 2);
      g.fill();
    } else if (t.type === "slow") {
      // cuộn tesla: trụ + vòng + cầu điện
      g.fillStyle = "#1a1440";
      g.beginPath();
      g.roundRect(-5.5, -17, 11, 19, 3);
      g.fill();
      g.strokeStyle = def.color;
      g.lineWidth = 2;
      for (let k = 0; k < 3; k++) {
        g.beginPath();
        g.ellipse(0, -4 - k * 5.5, 9 - k * 1.6, 3.4, 0, 0, Math.PI * 2);
        g.stroke();
      }
      g.save();
      g.shadowColor = def.color;
      g.shadowBlur = 12;
      const orb = g.createRadialGradient(-1, -20, 0.5, 0, -19, 6);
      orb.addColorStop(0, "#ffffff");
      orb.addColorStop(0.5, "#c9a6ff");
      orb.addColorStop(1, def.color);
      g.fillStyle = orb;
      g.beginPath();
      g.arc(0, -19, 4.6 + Math.sin(time * 6) * 0.9, 0, Math.PI * 2);
      g.fill();
      g.restore();
    } else if (t.type === "blast") {
      g.rotate(aim);
      // nòng pháo lớn
      g.fillStyle = "#33123d";
      g.strokeStyle = def.color;
      g.lineWidth = 2;
      g.beginPath();
      g.roundRect(2, -6, 17, 12, 3);
      g.fill();
      g.stroke();
      g.save();
      g.shadowColor = def.color;
      g.shadowBlur = 8;
      g.fillStyle = def.color;
      g.fillRect(15, -6, 4.5, 12);
      g.restore();
      // thân
      const bodyGrad = g.createRadialGradient(-2, -2, 1, 0, 0, 11);
      bodyGrad.addColorStop(0, "#ffd9f4");
      bodyGrad.addColorStop(0.55, "#c86bb0");
      bodyGrad.addColorStop(1, "#5d2050");
      g.fillStyle = bodyGrad;
      g.beginPath();
      g.arc(0, 0, 10, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = def.color;
      g.stroke();
    } else if (t.type === "nova") {
      g.fillStyle = "#16260a";
      g.strokeStyle = def.color;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(0, -4, 10, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      // 4 vấu tỏa
      g.lineWidth = 2.4;
      for (let k = 0; k < 4; k++) {
        const a = (Math.PI / 2) * k + time * 0.8;
        g.beginPath();
        g.moveTo(Math.cos(a) * 10, -4 + Math.sin(a) * 10);
        g.lineTo(Math.cos(a) * 15, -4 + Math.sin(a) * 15);
        g.stroke();
      }
      g.save();
      g.shadowColor = def.color;
      g.shadowBlur = 10;
      g.fillStyle = def.color;
      g.globalAlpha = 0.7 + Math.sin(time * 5) * 0.3;
      g.beginPath();
      g.arc(0, -4, 4.6, 0, Math.PI * 2);
      g.fill();
      g.restore();
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
    // bóng
    g.fillStyle = "rgba(0,0,0,0.4)";
    g.beginPath();
    g.ellipse(0, e.r * 0.75, e.r * 0.9, e.r * 0.32, 0, 0, Math.PI * 2);
    g.fill();

    const eye = (x, y, w = 4, h = 3) => {
      g.save();
      g.shadowColor = "#ff2a3f";
      g.shadowBlur = 6;
      g.fillStyle = "#ff4152";
      g.fillRect(x - w / 2, y - h / 2, w, h);
      g.restore();
    };

    if (e.type === "tank") {
      // xích 2 bên
      g.fillStyle = "#080d1e";
      g.beginPath();
      g.roundRect(-18, -14, 6, 28, 3);
      g.fill();
      g.beginPath();
      g.roundRect(12, -14, 6, 28, 3);
      g.fill();
      // thân
      const grad = g.createLinearGradient(0, -13, 0, 13);
      grad.addColorStop(0, "#1e2952");
      grad.addColorStop(1, "#0e1430");
      g.fillStyle = grad;
      g.strokeStyle = "#55679f";
      g.lineWidth = 2;
      g.beginPath();
      g.roundRect(-14, -13, 28, 26, 5);
      g.fill();
      g.stroke();
      // tấm giáp
      g.strokeStyle = "rgba(120,140,200,0.35)";
      g.lineWidth = 1.2;
      g.strokeRect(-9, -8, 18, 16);
      eye(-4.5, -2, 4.5, 3.5);
      eye(4.5, -2, 4.5, 3.5);
      g.fillStyle = "#3a4670";
      g.fillRect(-3, 5, 6, 4);
    } else if (e.type === "fast") {
      g.rotate(Math.sin(time * 9 + e.id) * 0.08);
      const grad = g.createLinearGradient(-8, 0, 11, 0);
      grad.addColorStop(0, "#241a4d");
      grad.addColorStop(1, "#121036");
      g.fillStyle = grad;
      g.strokeStyle = "#8a68ff";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(12, 0);
      g.lineTo(-9, -9);
      g.lineTo(-4.5, 0);
      g.lineTo(-9, 9);
      g.closePath();
      g.fill();
      g.stroke();
      eye(3, 0, 5, 3);
      // vệt phản lực
      g.fillStyle = "rgba(138,104,255,0.4)";
      g.beginPath();
      g.moveTo(-9, -3);
      g.lineTo(-15 - Math.sin(time * 20 + e.id) * 3, 0);
      g.lineTo(-9, 3);
      g.closePath();
      g.fill();
    } else {
      // basic / shield: robot hộp
      const grad = g.createLinearGradient(0, -9, 0, 10);
      grad.addColorStop(0, "#1c2547");
      grad.addColorStop(1, "#0d1330");
      g.fillStyle = grad;
      g.strokeStyle = e.type === "shield" ? "#20e3ff" : "#4d5c8f";
      g.lineWidth = 2;
      g.beginPath();
      g.roundRect(-10, -9, 20, 18, 4);
      g.fill();
      g.stroke();
      // đầu nhỏ
      g.fillStyle = "#161d3c";
      g.beginPath();
      g.roundRect(-6, -13, 12, 6, 2);
      g.fill();
      // anten
      g.strokeStyle = "rgba(120,140,200,0.6)";
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(0, -13);
      g.lineTo(0, -16.5);
      g.stroke();
      eye(-3.6, -2, 3.6, 3.2);
      eye(3.6, -2, 3.6, 3.2);
      // sọc bụng
      g.fillStyle = "rgba(120,140,200,0.3)";
      g.fillRect(-6, 4, 12, 2);
      // chân nhỏ
      g.fillStyle = "#080d1e";
      g.fillRect(-8.5, 9, 5.5, 3.4);
      g.fillRect(3, 9, 5.5, 3.4);
    }

    // bong bóng khiên
    if (e.maxShield > 0 && e.shield > 0) {
      const a = 0.32 + (e.shield / e.maxShield) * 0.4;
      g.strokeStyle = `rgba(32,227,255,${a})`;
      g.fillStyle = `rgba(32,227,255,${a * 0.12})`;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(0, 0, e.r + 6, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }

    // thanh máu đỏ (như ảnh)
    const w = 26;
    g.fillStyle = "rgba(6,8,18,0.9)";
    g.fillRect(-w / 2 - 1, -e.r - 12, w + 2, 6);
    g.strokeStyle = "rgba(255,80,100,0.35)";
    g.lineWidth = 1;
    g.strokeRect(-w / 2 - 1, -e.r - 12, w + 2, 6);
    g.fillStyle = "#ff3b4f";
    g.fillRect(-w / 2, -e.r - 11, w * Math.max(0, e.hp / e.maxHp), 4);
    if (e.maxShield > 0 && e.shield > 0) {
      g.fillStyle = "#20e3ff";
      g.fillRect(-w / 2, -e.r - 15.5, w * (e.shield / e.maxShield), 2.6);
    }
    g.restore();
  }

  function drawCore(sim, time) {
    const { x, y } = CORE;
    const hurt = sim.core / sim.coreMax;
    const cc = hurt > 0.4 ? "#20e3ff" : "#ff4f64";
    g.save();
    g.translate(x, y);

    // quầng sáng nền
    const halo = g.createRadialGradient(0, 0, 8, 0, 0, 95);
    halo.addColorStop(0, hurt > 0.4 ? "rgba(32,227,255,0.22)" : "rgba(255,79,100,0.22)");
    halo.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = halo;
    g.beginPath();
    g.arc(0, 0, 95, 0, Math.PI * 2);
    g.fill();

    // khung lục giác kim loại tĩnh (2 lớp như ảnh)
    const hex = (r, squish = 0.92, rot = 0) => {
      g.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i + rot;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r * squish;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.closePath();
    };
    g.fillStyle = "rgba(10,18,40,0.85)";
    g.strokeStyle = "rgba(90,130,200,0.6)";
    g.lineWidth = 5;
    hex(66, 0.92, Math.PI / 6);
    g.fill();
    g.stroke();
    g.strokeStyle = "rgba(140,190,255,0.35)";
    g.lineWidth = 1.6;
    hex(58, 0.92, Math.PI / 6);
    g.stroke();
    // đèn chấm trên khung
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i + Math.PI / 6;
      g.save();
      g.shadowColor = cc;
      g.shadowBlur = 6;
      g.fillStyle = cc;
      g.beginPath();
      g.arc(Math.cos(a) * 66, Math.sin(a) * 66 * 0.92, 2.6, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }

    // vòng lục giác quay
    g.strokeStyle = "rgba(32,227,255,0.55)";
    g.lineWidth = 2;
    for (const r of [42, 50]) {
      hex(r, 0.9, time * (r === 42 ? 0.25 : -0.18));
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
    // mặt mờ
    g.fillStyle = hurt > 0.4 ? "rgba(32,227,255,0.1)" : "rgba(255,79,100,0.1)";
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    g.lineTo(pts[1][0], pts[1][1]);
    g.lineTo(pts[3][0], pts[3][1]);
    g.lineTo(pts[2][0], pts[2][1]);
    g.closePath();
    g.fill();
    g.strokeStyle = cc;
    g.lineWidth = 2;
    g.save();
    g.shadowColor = cc;
    g.shadowBlur = 16;
    g.beginPath();
    for (const [a, b] of edges) {
      g.moveTo(pts[a][0], pts[a][1]);
      g.lineTo(pts[b][0], pts[b][1]);
    }
    g.stroke();
    g.restore();

    // badge CORE % (như ảnh)
    const pct = Math.round((sim.core / sim.coreMax) * 100);
    g.translate(0, -88);
    g.save();
    g.shadowColor = pct > 40 ? "#a8ff3e" : "#ff4f64";
    g.shadowBlur = 10;
    g.fillStyle = "rgba(8,14,28,0.94)";
    g.strokeStyle = pct > 40 ? "#a8ff3e" : "#ff4f64";
    g.lineWidth = 1.8;
    g.beginPath();
    g.roundRect(-40, -17, 80, 34, 5);
    g.fill();
    g.stroke();
    g.restore();
    g.fillStyle = "#8fa3c8";
    g.font = "700 10px 'JetBrains Mono', monospace";
    g.textAlign = "center";
    g.fillText("CORE", 0, -4);
    g.fillStyle = pct > 40 ? "#a8ff3e" : "#ff4f64";
    g.font = "800 15px 'JetBrains Mono', monospace";
    g.fillText(`${pct}%`, 0, 12);
    g.restore();
  }

  function drawProjectile(p) {
    if (p.kind === "blast") {
      g.save();
      g.shadowColor = "#ff4fd8";
      g.shadowBlur = 10;
      const orb = g.createRadialGradient(p.x - 1, p.y - 1, 0.5, p.x, p.y, 6);
      orb.addColorStop(0, "#ffffff");
      orb.addColorStop(0.5, "#ff9be8");
      orb.addColorStop(1, "#ff4fd8");
      g.fillStyle = orb;
      g.beginPath();
      g.arc(p.x, p.y, 5.5, 0, Math.PI * 2);
      g.fill();
      g.restore();
      g.strokeStyle = "rgba(255,79,216,0.4)";
      g.lineWidth = 2;
      g.beginPath();
      g.arc(p.x, p.y, 8.5, 0, Math.PI * 2);
      g.stroke();
    } else {
      const dx = p.lastX - p.x;
      const dy = p.lastY - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const col = p.kind === "sniper" ? "#ffd23f" : "#20e3ff";
      // quầng
      g.strokeStyle = p.kind === "sniper" ? "rgba(255,210,63,0.3)" : "rgba(32,227,255,0.3)";
      g.lineWidth = 6;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(p.x - (dx / d) * 12, p.y - (dy / d) * 12);
      g.lineTo(p.x, p.y);
      g.stroke();
      // lõi
      g.strokeStyle = col;
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(p.x - (dx / d) * 10, p.y - (dy / d) * 10);
      g.lineTo(p.x, p.y);
      g.stroke();
      g.fillStyle = "#ffffff";
      g.beginPath();
      g.arc(p.x, p.y, 1.6, 0, Math.PI * 2);
      g.fill();
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
        g.save();
        g.shadowColor = "#9a5cff";
        g.shadowBlur = 8;
        g.strokeStyle = `rgba(178,124,255,${1 - k})`;
        g.lineWidth = 2.6;
        g.beginPath();
        g.moveTo(f.x0, f.y0);
        const mx = (f.x0 + f.x1) / 2 + (Math.random() - 0.5) * 16;
        const my = (f.y0 + f.y1) / 2 + (Math.random() - 0.5) * 16;
        g.lineTo(mx, my);
        g.lineTo(f.x1, f.y1);
        g.stroke();
        g.strokeStyle = `rgba(255,255,255,${(1 - k) * 0.7})`;
        g.lineWidth = 1;
        g.stroke();
        g.restore();
      } else if (f.kind === "boom") {
        g.strokeStyle = `rgba(255,79,216,${1 - k})`;
        g.lineWidth = 4 * (1 - k) + 1;
        g.beginPath();
        g.arc(f.x, f.y, f.r * (0.3 + k * 0.7), 0, Math.PI * 2);
        g.stroke();
        const boom = g.createRadialGradient(f.x, f.y, 1, f.x, f.y, f.r * k + 2);
        boom.addColorStop(0, `rgba(255,220,250,${0.5 * (1 - k)})`);
        boom.addColorStop(1, `rgba(255,79,216,${0.12 * (1 - k)})`);
        g.fillStyle = boom;
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
        g.fillStyle = `rgba(255,150,90,${1 - k})`;
        for (let j = 0; j < 8; j++) {
          const a = (Math.PI / 4) * j;
          const d = 4 + k * 20;
          g.fillRect(f.x + Math.cos(a) * d - 1.8, f.y + Math.sin(a) * d - 1.8, 3.6, 3.6);
        }
        g.fillStyle = `rgba(255,240,200,${(1 - k) * 0.8})`;
        g.beginPath();
        g.arc(f.x, f.y, 5 * (1 - k), 0, Math.PI * 2);
        g.fill();
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
  const baseGrad = g.createLinearGradient(0, -16, 0, 16);
  baseGrad.addColorStop(0, "#152048");
  baseGrad.addColorStop(1, "#0a1128");
  g.fillStyle = baseGrad;
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
  g.save();
  g.shadowColor = def.color;
  g.shadowBlur = 6;
  g.stroke();
  g.restore();
  g.translate(0, -5);
  if (type === "rapid" || type === "sniper") {
    g.rotate(-Math.PI / 3);
    g.fillStyle = def.color;
    g.fillRect(2, -4.5, type === "sniper" ? 18 : 12, 2.8);
    if (type === "rapid") g.fillRect(2, 1.2, 12, 2.8);
    const headGrad = g.createRadialGradient(-1, -1, 0.5, 0, 0, 7);
    headGrad.addColorStop(0, "#f2fbff");
    headGrad.addColorStop(1, "#5d7488");
    g.fillStyle = headGrad;
    g.beginPath();
    g.arc(0, 0, 6, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = def.color;
    g.lineWidth = 1.6;
    g.stroke();
  } else if (type === "slow") {
    g.fillStyle = "#1a1440";
    g.fillRect(-4.5, -12, 9, 14);
    g.strokeStyle = def.color;
    g.lineWidth = 1.8;
    for (let k = 0; k < 3; k++) {
      g.beginPath();
      g.ellipse(0, -2 - k * 4.2, 7 - k, 2.6, 0, 0, Math.PI * 2);
      g.stroke();
    }
    g.save();
    g.shadowColor = def.color;
    g.shadowBlur = 7;
    g.fillStyle = def.color;
    g.beginPath();
    g.arc(0, -14, 3.4, 0, Math.PI * 2);
    g.fill();
    g.restore();
  } else if (type === "blast") {
    g.rotate(-Math.PI / 3);
    g.fillStyle = "#33123d";
    g.strokeStyle = def.color;
    g.lineWidth = 1.8;
    g.beginPath();
    g.roundRect(2, -4.5, 12, 9, 2);
    g.fill();
    g.stroke();
    const bodyGrad = g.createRadialGradient(-1, -1, 0.5, 0, 0, 8);
    bodyGrad.addColorStop(0, "#ffd9f4");
    bodyGrad.addColorStop(1, "#5d2050");
    g.fillStyle = bodyGrad;
    g.beginPath();
    g.arc(0, 0, 7, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = def.color;
    g.stroke();
  } else {
    g.fillStyle = "#16260a";
    g.strokeStyle = def.color;
    g.lineWidth = 1.8;
    g.beginPath();
    g.arc(0, -2, 7, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.save();
    g.shadowColor = def.color;
    g.shadowBlur = 6;
    g.fillStyle = def.color;
    g.beginPath();
    g.arc(0, -2, 3.2, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
}
