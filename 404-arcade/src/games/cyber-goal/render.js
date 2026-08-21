/**
 * render.js — vẽ Cyber Goal 404 theo ảnh reference: sân cyber phối cảnh
 * lưới cyan, khán đài neon + skyline, khung thành neon với lưới lục
 * giác và 4 vòng mục tiêu (magenta/lime), thủ môn polygon bay người,
 * bóng trắng viền neon với quỹ đạo nét đứt; panel COMBO / GIÓ / POWER
 * trái, SPIN phải và thanh "KÉO ĐỂ NGẮM · THẢ ĐỂ SÚT" dưới đáy.
 */

import { seededRand, MONO_FONT } from "../../core/utils.js";
import { WORLD, GOAL, SPOT, ZONES, flightPos } from "./engine.js";

const F = (w) => `800 ${w}px ${MONO_FONT}`;

export function createGoalRenderer(canvas, box) {
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
    bgCanvas = null;
  }

  function toWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) * dpr - offX) / scale,
      y: ((clientY - rect.top) * dpr - offY) / scale,
    };
  }

  /* ---------- nền tĩnh (skyline + khán đài + sân) ---------- */
  let bgCanvas = null;

  function paintBg() {
    bgCanvas = document.createElement("canvas");
    bgCanvas.width = canvas.width;
    bgCanvas.height = canvas.height;
    const c = bgCanvas.getContext("2d");
    c.setTransform(scale, 0, 0, scale, offX, offY);
    const rand = seededRand(1904);

    // trời đêm
    const sky = c.createLinearGradient(0, 0, 0, 340);
    sky.addColorStop(0, "#0a0728");
    sky.addColorStop(1, "#181040");
    c.fillStyle = sky;
    c.fillRect(-200, -200, WORLD.w + 400, 560);

    // skyline neon phía xa
    for (let i = 0; i < 42; i++) {
      const bw = 26 + rand() * 60;
      const bh = 60 + rand() * 190;
      const x = -100 + i * ((WORLD.w + 200) / 42) + rand() * 20;
      c.fillStyle = "rgba(16,12,44,.96)";
      c.fillRect(x, 320 - bh, bw, bh);
      const tone = rand() > 0.5 ? "rgba(255,46,166,.5)" : "rgba(32,227,255,.5)";
      c.strokeStyle = tone;
      c.lineWidth = 1.2;
      c.strokeRect(x, 320 - bh, bw, bh);
      for (let wy = 320 - bh + 8; wy < 310; wy += 12) {
        if (rand() > 0.55) {
          c.fillStyle = tone;
          c.fillRect(x + 4, wy, bw - 8, 2);
        }
      }
    }
    // quầng sáng chân trời
    const hg = c.createLinearGradient(0, 250, 0, 340);
    hg.addColorStop(0, "rgba(255,46,166,0)");
    hg.addColorStop(1, "rgba(255,46,166,.22)");
    c.fillStyle = hg;
    c.fillRect(-200, 250, WORLD.w + 400, 90);

    // khán đài hai bên với đám đông chấm
    for (const side of [-1, 1]) {
      c.save();
      const x0 = side === -1 ? -140 : WORLD.w - 500;
      c.beginPath();
      if (side === -1) {
        c.moveTo(x0, 180);
        c.lineTo(x0 + 640, 265);
        c.lineTo(x0 + 640, 420);
        c.lineTo(x0, 560);
      } else {
        c.moveTo(x0 + 640, 180);
        c.lineTo(x0, 265);
        c.lineTo(x0, 420);
        c.lineTo(x0 + 640, 560);
      }
      c.closePath();
      c.fillStyle = "#141034";
      c.fill();
      c.clip();
      for (let i = 0; i < 260; i++) {
        const px = x0 + rand() * 640;
        const py = 190 + rand() * 340;
        c.fillStyle =
          rand() > 0.9
            ? "rgba(255,46,166,.8)"
            : rand() > 0.8
              ? "rgba(32,227,255,.8)"
              : `rgba(${90 + rand() * 60},${90 + rand() * 70},${150 + rand() * 70},.55)`;
        c.fillRect(px, py, 3.2, 3.2);
      }
      c.restore();
      // viền neon khán đài
      c.strokeStyle = "rgba(255,46,166,.75)";
      c.lineWidth = 3;
      c.beginPath();
      if (side === -1) {
        c.moveTo(x0, 178);
        c.lineTo(x0 + 640, 263);
      } else {
        c.moveTo(x0 + 640, 178);
        c.lineTo(x0, 263);
      }
      c.stroke();
      c.strokeStyle = "rgba(32,227,255,.6)";
      c.beginPath();
      if (side === -1) {
        c.moveTo(x0, 562);
        c.lineTo(x0 + 640, 422);
      } else {
        c.moveTo(x0 + 640, 562);
        c.lineTo(x0, 422);
      }
      c.stroke();
    }

    // mặt sân: gradient tối + lưới phối cảnh cyan
    const fg = c.createLinearGradient(0, 330, 0, WORLD.h);
    fg.addColorStop(0, "#141243");
    fg.addColorStop(0.5, "#100e38");
    fg.addColorStop(1, "#0a0928");
    c.fillStyle = fg;
    c.fillRect(-200, 330, WORLD.w + 400, WORLD.h - 330 + 200);

    const vpX = 800;
    const vpY = 205;
    c.strokeStyle = "rgba(32,227,255,.2)";
    c.lineWidth = 1.6;
    for (let i = -14; i <= 14; i++) {
      c.beginPath();
      c.moveTo(vpX + i * 340, WORLD.h + 60);
      c.lineTo(vpX + i * 44, vpY + 160);
      c.stroke();
    }
    let gap = 14;
    let y = 372;
    while (y < WORLD.h + 40) {
      c.strokeStyle = `rgba(32,227,255,${(0.1 + (y - 330) / WORLD.h * 0.2).toFixed(2)})`;
      c.beginPath();
      c.moveTo(-200, y);
      c.lineTo(WORLD.w + 200, y);
      c.stroke();
      gap *= 1.32;
      y += gap;
    }
    // vạch 16m50 + vòng cung quanh chấm đá
    c.strokeStyle = "rgba(120,220,255,.4)";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(180, 640);
    c.lineTo(340, 560);
    c.lineTo(1260, 560);
    c.lineTo(1420, 640);
    c.stroke();
    c.beginPath();
    c.ellipse(SPOT.x, SPOT.y - 18, 330, 96, 0, Math.PI * 0.06, Math.PI * 0.94);
    c.stroke();
    // quầng sáng quanh chấm phạt đền
    const sg = c.createRadialGradient(SPOT.x, SPOT.y, 20, SPOT.x, SPOT.y, 240);
    sg.addColorStop(0, "rgba(60,120,255,.2)");
    sg.addColorStop(1, "rgba(60,120,255,0)");
    c.fillStyle = sg;
    c.fillRect(SPOT.x - 240, SPOT.y - 240, 480, 480);
  }

  /* ---------- khung thành + vòng mục tiêu ---------- */

  function drawGoalFrame(time) {
    const L = GOAL.left - 18;
    const R = GOAL.right + 18;
    const T = GOAL.bar - 14;
    const B = GOAL.ground;
    const depth = 46; // lùi vào trong của khung sau

    // lưới lục giác
    g.save();
    g.beginPath();
    g.rect(L, T, R - L, B - T);
    g.clip();
    g.strokeStyle = "rgba(90,140,220,.22)";
    g.lineWidth = 1.3;
    const hs = 26;
    for (let row = 0; row < 16; row++) {
      for (let col = 0; col < 32; col++) {
        const hx = L + col * hs * 1.5;
        const hy = T + row * hs * 0.88 + (col % 2 ? hs * 0.44 : 0);
        g.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI / 3) * i + Math.PI / 6;
          const px = hx + Math.cos(a) * hs * 0.5;
          const py = hy + Math.sin(a) * hs * 0.5;
          if (i === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        g.closePath();
        g.stroke();
      }
    }
    g.restore();

    // khung sau (chiều sâu) + dây góc
    g.strokeStyle = "rgba(140,180,240,.4)";
    g.lineWidth = 3;
    g.strokeRect(L + depth, T + depth * 0.8, R - L - depth * 2, B - T - depth * 0.8);
    g.beginPath();
    g.moveTo(L, T); g.lineTo(L + depth, T + depth * 0.8);
    g.moveTo(R, T); g.lineTo(R - depth, T + depth * 0.8);
    g.moveTo(L, B); g.lineTo(L + depth, B);
    g.moveTo(R, B); g.lineTo(R - depth, B);
    g.stroke();

    // cột + xà neon trắng-cyan
    g.save();
    g.shadowColor = "#8ff4ff";
    g.shadowBlur = 16 + Math.sin(time * 2) * 3;
    g.strokeStyle = "#e9fbff";
    g.lineWidth = 9;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(L, B);
    g.lineTo(L, T);
    g.lineTo(R, T);
    g.lineTo(R, B);
    g.stroke();
    g.restore();
    g.strokeStyle = "rgba(32,227,255,.8)";
    g.lineWidth = 2.4;
    g.beginPath();
    g.moveTo(L, B);
    g.lineTo(L, T);
    g.lineTo(R, T);
    g.lineTo(R, B);
    g.stroke();

    // 4 vòng mục tiêu góc
    const rings = [
      ["LH", "#ff2ea6"],
      ["RH", "#9dff3e"],
      ["LL", "#9dff3e"],
      ["RL", "#ff2ea6"],
    ];
    for (const [zone, tone] of rings) {
      const z = ZONES[zone];
      const pulse = 1 + Math.sin(time * 3 + z.x) * 0.045;
      g.save();
      g.translate(z.x, z.y);
      g.scale(pulse, pulse);
      g.shadowColor = tone;
      g.shadowBlur = 14;
      g.strokeStyle = tone;
      g.lineWidth = 5;
      g.beginPath();
      g.arc(0, 0, 46, 0, Math.PI * 2);
      g.stroke();
      g.lineWidth = 3;
      g.globalAlpha = 0.8;
      g.beginPath();
      g.arc(0, 0, 30, 0, Math.PI * 2);
      g.stroke();
      g.globalAlpha = 1;
      g.fillStyle = tone;
      g.beginPath();
      g.arc(0, 0, 10, 0, Math.PI * 2);
      g.fill();
      g.shadowBlur = 0;
      // ngoặc góc kiểu HUD
      g.lineWidth = 3.4;
      g.strokeStyle = "rgba(240,248,255,.8)";
      const k = 62;
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        g.beginPath();
        g.moveTo(sx * k, sy * (k - 18));
        g.lineTo(sx * k, sy * k);
        g.lineTo(sx * (k - 18), sy * k);
        g.stroke();
      }
      g.restore();
    }
  }

  /* ---------- thủ môn polygon ---------- */

  function drawKeeper(m, time, isOurs) {
    const kp = m.keeper;
    const idleX = GOAL.cx;
    const idleY = 452;
    let x = idleX;
    let y = idleY;
    let rot = 0;
    let stretch = 0;
    if (kp.diving) {
      const z = ZONES[kp.zone];
      const e = 1 - Math.pow(1 - kp.t, 2.4); // ease-out
      x = idleX + (z.x - idleX) * e;
      y = idleY + (z.y + 26 - idleY) * e;
      rot = (z.x < idleX ? -1 : z.x > idleX ? 1 : 0) * e * 1.25;
      stretch = e;
    } else {
      x += Math.sin(time * 1.7) * 14 + kp.lean * 60;
      rot = Math.sin(time * 1.7) * 0.05 + kp.lean * 0.14;
    }

    const body = isOurs ? "#0e2438" : "#0d1030";
    const edge = isOurs ? "rgba(61,239,255,.9)" : "rgba(120,140,220,.75)";
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    const armSpread = 0.5 + stretch * 0.9;
    // bóng đổ nhỏ
    g.fillStyle = "rgba(0,0,0,.3)";
    g.beginPath();
    g.ellipse(0, 110 - stretch * 40, 70, 14, 0, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 2.4;
    g.strokeStyle = edge;
    // chân
    g.fillStyle = body;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(s * 10, 30);
      g.lineTo(s * (34 + stretch * 30), 96 - stretch * 20);
      g.lineTo(s * (16 + stretch * 26), 100 - stretch * 16);
      g.lineTo(s * 2, 40);
      g.closePath();
      g.fill();
      g.stroke();
    }
    // thân polygon
    g.beginPath();
    g.moveTo(-30, -34);
    g.lineTo(30, -34);
    g.lineTo(40, 10);
    g.lineTo(14, 40);
    g.lineTo(-14, 40);
    g.lineTo(-40, 10);
    g.closePath();
    g.fill();
    g.stroke();
    // facet sáng trên ngực
    g.fillStyle = "rgba(90,130,220,.3)";
    g.beginPath();
    g.moveTo(-30, -34);
    g.lineTo(30, -34);
    g.lineTo(0, 4);
    g.closePath();
    g.fill();
    // tay dang rộng
    g.fillStyle = body;
    for (const s of [-1, 1]) {
      const ax = s * (52 + stretch * 46);
      const ay = -40 - armSpread * 34 - (s === 1 ? stretch * 26 : 0);
      g.beginPath();
      g.moveTo(s * 24, -30);
      g.lineTo(ax, ay);
      g.lineTo(ax + s * 12, ay + 14);
      g.lineTo(s * 26, -12);
      g.closePath();
      g.fill();
      g.stroke();
      // găng
      g.fillStyle = "#e8f2ff";
      g.beginPath();
      g.arc(ax + s * 6, ay + 4, 9, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = body;
    }
    // đầu + visor
    g.fillStyle = "#e8eefc";
    g.beginPath();
    g.moveTo(-14, -66);
    g.lineTo(14, -66);
    g.lineTo(18, -46);
    g.lineTo(0, -36);
    g.lineTo(-18, -46);
    g.closePath();
    g.fill();
    g.stroke();
    g.save();
    g.shadowColor = isOurs ? "#3defff" : "#ff2ea6";
    g.shadowBlur = 8;
    g.fillStyle = isOurs ? "#3defff" : "#ff2ea6";
    g.fillRect(-11, -58, 22, 5);
    g.restore();
    // mảnh vỡ polygon khi bay người
    if (stretch > 0.25) {
      g.fillStyle = "rgba(60,90,180,.5)";
      for (let i = 0; i < 5; i++) {
        const a = i * 1.7 + time * 2;
        const d = 70 + i * 16;
        g.beginPath();
        g.moveTo(Math.cos(a) * d, Math.sin(a) * d * 0.5);
        g.lineTo(Math.cos(a) * d + 10, Math.sin(a) * d * 0.5 + 5);
        g.lineTo(Math.cos(a) * d + 2, Math.sin(a) * d * 0.5 + 11);
        g.closePath();
        g.fill();
      }
    }
    g.restore();
  }

  /* ---------- bóng ---------- */

  function drawBall(x, y, r, time) {
    g.save();
    g.translate(x, y);
    // bóng đổ
    g.fillStyle = "rgba(0,0,0,.35)";
    g.beginPath();
    g.ellipse(0, r * 1.16, r * 0.9, r * 0.24, 0, 0, Math.PI * 2);
    g.fill();
    // rim neon hai bên (magenta trái / cyan phải)
    for (const [tone, sx] of [["rgba(255,46,166,.75)", -1], ["rgba(32,227,255,.75)", 1]]) {
      g.strokeStyle = tone;
      g.lineWidth = r * 0.16;
      g.shadowColor = tone;
      g.shadowBlur = r * 0.5;
      g.beginPath();
      g.arc(0, 0, r * 1.02, sx === -1 ? Math.PI * 0.6 : -Math.PI * 0.4, sx === -1 ? Math.PI * 1.4 : Math.PI * 0.4);
      g.stroke();
    }
    g.shadowBlur = 0;
    // thân bóng trắng
    const bg = g.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.14, 0, 0, r);
    bg.addColorStop(0, "#ffffff");
    bg.addColorStop(0.72, "#dfe7f5");
    bg.addColorStop(1, "#9fb0cf");
    g.fillStyle = bg;
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.fill();
    // hoa văn ngũ giác
    const rot = time * 0.6;
    g.fillStyle = "#181f30";
    const pent = (px, py, pr, a0) => {
      g.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = a0 + (Math.PI * 2 * i) / 5;
        const vx = px + Math.cos(a) * pr;
        const vy = py + Math.sin(a) * pr;
        if (i === 0) g.moveTo(vx, vy);
        else g.lineTo(vx, vy);
      }
      g.closePath();
      g.fill();
    };
    g.save();
    g.beginPath();
    g.arc(0, 0, r * 0.97, 0, Math.PI * 2);
    g.clip();
    pent(0, 0, r * 0.34, rot);
    for (let i = 0; i < 5; i++) {
      const a = rot + (Math.PI * 2 * i) / 5 + Math.PI / 5;
      pent(Math.cos(a) * r * 0.82, Math.sin(a) * r * 0.82, r * 0.26, a);
    }
    g.restore();
    g.restore();
  }

  /* ---------- panel HUD trong sân ---------- */

  function cutPanel(x, y, w, h, tone, glow = 0.16) {
    g.save();
    g.fillStyle = "rgba(7,10,28,.88)";
    g.strokeStyle = tone;
    g.lineWidth = 2.2;
    g.shadowColor = tone;
    g.shadowBlur = 14;
    g.globalAlpha = 1;
    const cut = 12;
    g.beginPath();
    g.moveTo(x + cut, y);
    g.lineTo(x + w - cut, y);
    g.lineTo(x + w, y + cut);
    g.lineTo(x + w, y + h - cut);
    g.lineTo(x + w - cut, y + h);
    g.lineTo(x + cut, y + h);
    g.lineTo(x, y + h - cut);
    g.lineTo(x, y + cut);
    g.closePath();
    g.fill();
    g.shadowBlur = 0;
    g.stroke();
    g.restore();
    void glow;
  }

  function drawSidePanels(m, aim, time) {
    g.textAlign = "center";
    g.textBaseline = "middle";

    // COMBO (lime)
    cutPanel(66, 92, 190, 96, "rgba(157,255,62,.8)");
    g.fillStyle = "#eef4ff";
    g.font = F(23);
    g.fillText("COMBO", 161, 118);
    g.fillStyle = "#9dff3e";
    g.shadowColor = "#9dff3e";
    g.shadowBlur = 14;
    g.font = F(52);
    g.fillText(`x${m.combo}`, 161, 160);
    g.shadowBlur = 0;

    // GIÓ (cyan)
    cutPanel(66, 206, 190, 86, "rgba(32,227,255,.7)");
    g.fillStyle = "#bfd2ee";
    g.font = F(19);
    g.textAlign = "left";
    g.fillText("GIÓ", 86, 230);
    g.fillStyle = "#eef4ff";
    g.font = F(30);
    g.fillText(m.wind.toFixed(1), 86, 264);
    // ô mũi tên hướng gió
    const ax = 178;
    const ay = 248;
    g.fillStyle = "rgba(10,26,52,.9)";
    g.strokeStyle = "rgba(32,227,255,.8)";
    g.lineWidth = 2;
    g.beginPath();
    g.roundRect(ax - 26, ay - 22, 60, 44, 6);
    g.fill();
    g.stroke();
    g.save();
    g.translate(ax + 4, ay);
    if (m.wind < 0) g.scale(-1, 1);
    g.fillStyle = "#20e3ff";
    g.shadowColor = "#20e3ff";
    g.shadowBlur = 8;
    g.beginPath();
    g.moveTo(-14, -9);
    g.lineTo(4, -9);
    g.lineTo(4, -15);
    g.lineTo(18, 0);
    g.lineTo(4, 15);
    g.lineTo(4, 9);
    g.lineTo(-14, 9);
    g.closePath();
    g.fill();
    g.restore();
    // chấm gauge nhỏ dưới
    g.fillStyle = "rgba(32,227,255,.5)";
    for (let i = 0; i < 8; i++) g.fillRect(86 + i * 13, 280, 7, 3);

    // POWER (dọc, đỏ trên → lục dưới)
    cutPanel(60, 316, 128, 392, "rgba(120,160,255,.55)");
    g.fillStyle = "#eef4ff";
    g.font = F(21);
    g.textAlign = "center";
    g.fillText("POWER", 124, 344);
    const barX = 100;
    const barY = 366;
    const barH = 318;
    const segN = 16;
    g.strokeStyle = "rgba(140,170,230,.5)";
    g.lineWidth = 1.6;
    g.strokeRect(barX - 6, barY - 6, 60, barH + 12);
    const power = aim ? aim.power : 0;
    for (let i = 0; i < segN; i++) {
      const segY = barY + barH - (i + 1) * (barH / segN) + 2;
      const frac = i / (segN - 1);
      const on = power >= (i + 0.5) / segN;
      const hue = 120 - frac * 120; // lục → đỏ
      g.fillStyle = on ? `hsl(${hue} 90% 55%)` : `hsla(${hue} 60% 40% / .22)`;
      if (on) {
        g.shadowColor = `hsl(${hue} 90% 55%)`;
        g.shadowBlur = 8;
      }
      g.fillRect(barX, segY, 48, barH / segN - 5);
      g.shadowBlur = 0;
    }
    // badge % cạnh mức hiện tại
    const py = Math.max(barY + 16, barY + barH - power * barH);
    g.fillStyle = "rgba(8,12,30,.95)";
    g.strokeStyle = "rgba(200,220,255,.7)";
    g.beginPath();
    g.roundRect(152, py - 17, 74, 34, 5);
    g.fill();
    g.stroke();
    g.fillStyle = "#eef4ff";
    g.font = F(21);
    g.fillText(`${Math.round(power * 100)}%`, 189, py + 1);
    g.beginPath();
    g.moveTo(152, py);
    g.lineTo(142, py - 6);
    g.lineTo(142, py + 6);
    g.closePath();
    g.fill();

    // SPIN (phải)
    cutPanel(1368, 300, 178, 300, "rgba(120,160,255,.55)");
    g.fillStyle = "#eef4ff";
    g.font = F(23);
    g.fillText("SPIN", 1457, 330);
    // gauge vòng cung quanh bóng nhỏ
    const scx = 1457;
    const scy = 428;
    const spin = aim ? aim.spin : 0;
    g.lineWidth = 9;
    const arc = (a0, a1, tone) => {
      g.strokeStyle = tone;
      g.beginPath();
      g.arc(scx, scy, 62, a0, a1);
      g.stroke();
    };
    arc(Math.PI * 0.75, Math.PI * 1.5, "rgba(32,227,255,.75)");
    arc(Math.PI * 1.5, Math.PI * 2.25, "rgba(255,210,63,.75)");
    // kim chỉ spin
    const na = Math.PI * 1.5 + spin * Math.PI * 0.7;
    g.save();
    g.translate(scx + Math.cos(na) * 78, scy + Math.sin(na) * 78);
    g.rotate(na + Math.PI / 2);
    g.fillStyle = "#eef4ff";
    g.beginPath();
    g.moveTo(0, -10);
    g.lineTo(8, 6);
    g.lineTo(-8, 6);
    g.closePath();
    g.fill();
    g.restore();
    drawBall(scx, scy, 40, time * 0.4 + spin * 2);
    g.fillStyle = "#eef4ff";
    g.font = F(19);
    const spinLabel = spin > 0.18 ? "SIDE SPIN »" : spin < -0.18 ? "« SIDE SPIN" : "TOP SPIN";
    g.fillText(spinLabel, 1457, 522);
    // chevron lime
    g.strokeStyle = "#9dff3e";
    g.lineWidth = 5;
    g.shadowColor = "#9dff3e";
    g.shadowBlur = 8;
    for (let k = 0; k < 2; k++) {
      g.beginPath();
      g.moveTo(scx - 20, 556 + k * 14);
      g.lineTo(scx, 544 + k * 14);
      g.lineTo(scx + 20, 556 + k * 14);
      g.stroke();
    }
    g.shadowBlur = 0;
  }

  /** Thanh hướng dẫn kéo-thả dưới đáy. */
  function drawAimBar(m, time) {
    if (m.turn !== "player" || m.phase !== "aim") return;
    const x = 470;
    const w = 660;
    const y = 796;
    const h = 62;
    cutPanel(x, y, w, h, "rgba(150,190,255,.6)");
    g.font = F(27);
    g.textBaseline = "middle";
    const parts = [
      ["KÉO", "#20e3ff"],
      [" ĐỂ NGẮM · ", "#eef4ff"],
      ["THẢ", "#ffd23f"],
      [" ĐỂ SÚT", "#eef4ff"],
    ];
    let tw = 0;
    for (const [t] of parts) tw += g.measureText(t).width;
    let tx = x + w / 2 - tw / 2;
    g.textAlign = "left";
    for (const [t, tone] of parts) {
      g.fillStyle = tone;
      g.shadowColor = tone;
      g.shadowBlur = tone === "#eef4ff" ? 0 : 10;
      g.fillText(t, tx, y + 24);
      g.shadowBlur = 0;
      tx += g.measureText(t).width;
    }
    // hàng trượt nét đứt + bàn tay
    g.strokeStyle = "rgba(180,200,240,.7)";
    g.fillStyle = "rgba(180,200,240,.7)";
    g.lineWidth = 2.6;
    g.setLineDash([9, 8]);
    g.beginPath();
    g.moveTo(x + 60, y + 50);
    g.lineTo(x + w - 60, y + 50);
    g.stroke();
    g.setLineDash([]);
    for (const s of [-1, 1]) {
      const ex = s === -1 ? x + 44 : x + w - 44;
      g.beginPath();
      g.moveTo(ex, y + 50);
      g.lineTo(ex - s * 14, y + 42);
      g.lineTo(ex - s * 14, y + 58);
      g.closePath();
      g.fill();
    }
    // bàn tay nhỏ đưa qua lại
    const hx = x + w / 2 + Math.sin(time * 2.2) * 60;
    g.save();
    g.translate(hx, y + 50);
    g.fillStyle = "#eef4ff";
    g.shadowColor = "rgba(32,227,255,.8)";
    g.shadowBlur = 10;
    g.beginPath();
    g.roundRect(-7, -12, 6.5, 20, 3);
    g.fill();
    g.beginPath();
    g.roundRect(-10, 0, 20, 14, 6);
    g.fill();
    g.restore();
  }

  /* ---------- vẽ chính ---------- */

  function draw(m, aim, fx, time) {
    if (!bgCanvas || bgCanvas.width !== canvas.width) paintBg();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = "#0a0928";
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.drawImage(bgCanvas, 0, 0);
    g.setTransform(scale, 0, 0, scale, offX, offY);

    drawGoalFrame(time);
    drawKeeper(m, time, m.turn === "cpu");

    // quỹ đạo ngắm (nét đứt cyan cong lên vùng ngắm)
    if (m.turn === "player" && m.phase === "aim" && aim && aim.active) {
      g.save();
      g.strokeStyle = "rgba(61,239,255,.85)";
      g.lineWidth = 5;
      g.shadowColor = "#20e3ff";
      g.shadowBlur = 10;
      g.setLineDash([2, 26]);
      g.lineDashOffset = -time * 90;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(SPOT.x, SPOT.y - 40);
      const mx = (SPOT.x + aim.tx) / 2 + aim.spin * 130;
      const my = (SPOT.y + aim.ty) / 2 - 190 * (1 - aim.power * 0.4);
      g.quadraticCurveTo(mx, my, aim.tx, aim.ty);
      g.stroke();
      g.setLineDash([]);
      // reticle điểm ngắm
      g.strokeStyle = "#3defff";
      g.lineWidth = 3;
      g.beginPath();
      g.arc(aim.tx, aim.ty, 26, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.moveTo(aim.tx - 40, aim.ty);
      g.lineTo(aim.tx - 14, aim.ty);
      g.moveTo(aim.tx + 14, aim.ty);
      g.lineTo(aim.tx + 40, aim.ty);
      g.moveTo(aim.tx, aim.ty - 40);
      g.lineTo(aim.tx, aim.ty - 14);
      g.moveTo(aim.tx, aim.ty + 14);
      g.lineTo(aim.tx, aim.ty + 40);
      g.stroke();
      g.restore();
    }

    // bóng: ở chấm khi chờ, bay theo flight khi sút
    if (m.phase === "flight" || m.phase === "result") {
      const f = m.flight;
      if (f) {
        const p = flightPos(f);
        // vệt quỹ đạo
        g.save();
        g.strokeStyle = "rgba(61,239,255,.6)";
        g.lineWidth = 4;
        g.setLineDash([3, 20]);
        g.beginPath();
        g.moveTo(f.sx, f.sy - 40);
        for (let k = 0.1; k <= p.k; k += 0.08) {
          const q = flightPos({ ...f, t: k * f.dur });
          g.lineTo(q.x, q.y);
        }
        g.stroke();
        g.restore();
        let alpha = 1;
        if (m.phase === "result" && (f.outcome === "miss" || f.outcome === "post")) {
          alpha = Math.max(0, m.resultT / 1.45);
        }
        g.globalAlpha = alpha;
        drawBall(p.x, p.y, 54 * p.scale, time * 3);
        g.globalAlpha = 1;
      }
    } else {
      drawBall(SPOT.x, SPOT.y - 44, 54, time * 0.5);
    }

    // particle
    for (const pt of fx.particles) {
      g.globalAlpha = Math.max(0, pt.life / pt.life0);
      g.fillStyle = pt.color;
      g.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    g.globalAlpha = 1;

    drawSidePanels(m, aim, time);
    drawAimBar(m, time);

    // banner lượt CPU
    if (m.turn === "cpu" && m.phase === "aim") {
      g.font = F(30);
      g.textAlign = "center";
      g.fillStyle = "#ff7cc8";
      g.shadowColor = "#ff2ea6";
      g.shadowBlur = 14;
      g.fillText("LƯỢT ĐỐI THỦ...", 800, 826);
      g.shadowBlur = 0;
    }
  }

  return { fit, draw, toWorld };
}
