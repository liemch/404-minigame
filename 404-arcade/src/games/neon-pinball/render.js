/**
 * render.js — vẽ Neon Pinball 404 theo ảnh reference: bàn dọc navy hoa
 * văn lục giác, rail neon magenta, hai ramp cong tím/xanh trên vòm,
 * biển 404 magenta, 3 bumper sao chrome, spinner nan hoa magenta,
 * slingshot neon, drop target + huy hiệu x2/x4/x8, dãy đèn multiplier
 * x1–x8, lane phóng với plunger chrome + vạch lực nét đứt, flipper
 * trắng viền hồng và bi chrome vệt cyan.
 */

import { seededRand, MONO_FONT } from "../../core/utils.js";
import {
  WORLD, BALL_R, ARC, WALLS, BUMPERS, SPINNER, SLINGS, TARGETS, RAMPS,
  FLIPPERS, FLIPPER_R, PLUNGER, MULT_LADDER,
} from "./table.js";
import { mult } from "./engine.js";

const F = (s) => `800 ${s}px ${MONO_FONT}`;

export function createPinballRenderer(canvas, box) {
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
    const k = Math.min(rect.width / WORLD.w, rect.height / WORLD.h);
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

  /* ---------- nền bàn tĩnh ---------- */
  let bgCanvas = null;

  function paintBg() {
    bgCanvas = document.createElement("canvas");
    bgCanvas.width = canvas.width;
    bgCanvas.height = canvas.height;
    const c = bgCanvas.getContext("2d");
    // nền ngoài bàn
    const og = c.createLinearGradient(0, 0, 0, bgCanvas.height);
    og.addColorStop(0, "#0a0724");
    og.addColorStop(1, "#070516");
    c.fillStyle = og;
    c.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
    c.setTransform(scale, 0, 0, scale, offX, offY);
    const rand = seededRand(1616);

    // thân bàn: khung bo tròn theo vòm
    const body = new Path2D();
    body.moveTo(28, 1440);
    body.lineTo(28, 330);
    for (const [x, y] of ARC) body.lineTo(x, y - 10);
    body.lineTo(872, 1440);
    body.closePath();
    const tg = c.createLinearGradient(0, 0, 0, WORLD.h);
    tg.addColorStop(0, "#1b1852");
    tg.addColorStop(0.6, "#151240");
    tg.addColorStop(1, "#110e36");
    c.fillStyle = tg;
    c.fill(body);

    // hoa văn lục giác mờ trong lòng bàn
    c.save();
    c.clip(body);
    c.strokeStyle = "rgba(110,100,220,.17)";
    c.lineWidth = 1.4;
    const hs = 46;
    for (let row = 0; row < 36; row++) {
      for (let col = 0; col < 14; col++) {
        const hx = col * hs * 1.5;
        const hy = row * hs * 0.87 + (col % 2 ? hs * 0.435 : 0);
        c.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI / 3) * i + Math.PI / 6;
          const px = hx + Math.cos(a) * hs * 0.5;
          const py = hy + Math.sin(a) * hs * 0.5;
          if (i === 0) c.moveTo(px, py);
          else c.lineTo(px, py);
        }
        c.closePath();
        c.stroke();
      }
    }
    // hạt pixel
    for (let i = 0; i < 60; i++) {
      c.fillStyle = rand() > 0.7 ? "rgba(32,227,255,.25)" : "rgba(150,120,255,.2)";
      c.fillRect(rand() * WORLD.w, rand() * WORLD.h, 3, 3);
    }
    c.restore();

    // rail neon magenta ngoài
    c.save();
    c.shadowColor = "#ff2ea6";
    c.shadowBlur = 18;
    c.strokeStyle = "#ff2ea6";
    c.lineWidth = 6;
    c.lineJoin = "round";
    const rail = new Path2D();
    rail.moveTo(28, 1440);
    rail.lineTo(28, 330);
    for (const [x, y] of ARC) rail.lineTo(x, y - 10);
    rail.lineTo(872, 1440);
    c.stroke(rail);
    c.restore();

    // tường trong + inlane vẽ theo WALLS
    for (const [x1, y1, x2, y2] of WALLS) {
      c.save();
      c.strokeStyle = "#2c2a5e";
      c.lineWidth = 16;
      c.lineCap = "round";
      c.beginPath();
      c.moveTo(x1, y1);
      c.lineTo(x2, y2);
      c.stroke();
      c.shadowColor = "#8a5cff";
      c.shadowBlur = 8;
      c.strokeStyle = "rgba(160,120,255,.75)";
      c.lineWidth = 3;
      c.stroke();
      c.restore();
    }

    // 2 ramp cong neon trên vòm (tím trái / xanh phải)
    const rampPath = (p0, p1, p2, tone) => {
      c.save();
      c.strokeStyle = tone;
      c.lineWidth = 13;
      c.lineCap = "round";
      c.shadowColor = tone;
      c.shadowBlur = 16;
      c.globalAlpha = 0.9;
      c.beginPath();
      c.moveTo(p0[0], p0[1]);
      c.quadraticCurveTo(p1[0], p1[1], p2[0], p2[1]);
      c.stroke();
      c.globalAlpha = 1;
      c.lineWidth = 4;
      c.strokeStyle = "rgba(240,248,255,.8)";
      c.shadowBlur = 0;
      c.stroke();
      c.restore();
    };
    rampPath([112, 470], [92, 170], [330, 66], "#9a5cff");
    rampPath([700, 445], [790, 150], [560, 56], "#3b9dff");

    // biển 404 magenta trên đỉnh
    c.save();
    c.translate(405, 128);
    c.fillStyle = "rgba(30,8,34,.92)";
    c.strokeStyle = "#ff2ea6";
    c.lineWidth = 3;
    c.shadowColor = "#ff2ea6";
    c.shadowBlur = 14;
    c.beginPath();
    c.roundRect(-92, -34, 184, 62, 9);
    c.fill();
    c.stroke();
    c.shadowBlur = 0;
    c.fillStyle = "#ff7cc8";
    c.font = F(42);
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.shadowColor = "#ff2ea6";
    c.shadowBlur = 12;
    c.fillText("404", 0, -1);
    c.restore();

    // tam giác deco quanh biển
    for (const [tx, ty, tone, s] of [
      [286, 232, "#ff2ea6", 20],
      [524, 232, "#ffd23f", 18],
      [405, 218, "#20e3ff", 16],
    ]) {
      c.save();
      c.strokeStyle = tone;
      c.lineWidth = 3;
      c.shadowColor = tone;
      c.shadowBlur = 8;
      c.beginPath();
      c.moveTo(tx, ty - s);
      c.lineTo(tx + s, ty + s * 0.8);
      c.lineTo(tx - s, ty + s * 0.8);
      c.closePath();
      c.stroke();
      c.restore();
    }

    // huy hiệu multiplier x2/x4/x8 dọc mép phải cạnh drop target
    const hexBadge = (x, y, label, on) => {
      c.save();
      c.translate(x, y);
      c.strokeStyle = on ? "#9dff3e" : "rgba(150,160,220,.5)";
      c.fillStyle = "rgba(10,10,30,.9)";
      c.lineWidth = 2.6;
      if (on) {
        c.shadowColor = "#9dff3e";
        c.shadowBlur = 10;
      }
      c.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const px = Math.cos(a) * 27;
        const py = Math.sin(a) * 27;
        if (i === 0) c.moveTo(px, py);
        else c.lineTo(px, py);
      }
      c.closePath();
      c.fill();
      c.stroke();
      c.shadowBlur = 0;
      c.fillStyle = on ? "#9dff3e" : "rgba(190,200,240,.7)";
      c.font = F(19);
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(label, 0, 1);
      c.restore();
    };
    hexBadge(652, 560, "x2", false);
    hexBadge(668, 648, "x4", true);
    hexBadge(680, 738, "x8", false);

    // vạch lực plunger (nét đứt dọc lane) + chevron vàng + nhãn
    c.save();
    c.strokeStyle = "rgba(240,246,255,.6)";
    c.lineWidth = 3;
    c.setLineDash([4, 14]);
    c.beginPath();
    c.moveTo(816, 360);
    c.lineTo(816, 1020);
    c.stroke();
    c.setLineDash([]);
    c.fillStyle = "rgba(14,12,40,.92)";
    c.strokeStyle = "rgba(255,210,63,.8)";
    c.lineWidth = 2;
    c.beginPath();
    c.roundRect(700, 968, 132, 66, 8);
    c.fill();
    c.stroke();
    c.fillStyle = "#ffd23f";
    c.font = F(17);
    c.textAlign = "center";
    c.fillText("KÉO ĐỂ", 766, 990);
    c.fillText("PHÓNG BI", 766, 1012);
    c.save();
    c.shadowColor = "#ffd23f";
    c.shadowBlur = 10;
    c.strokeStyle = "#ffd23f";
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(750, 1046);
    c.lineTo(766, 1062);
    c.lineTo(782, 1046);
    c.stroke();
    c.restore();
    c.restore();

    // chữ 404 neon dưới đáy giữa hai flipper
    c.save();
    c.fillStyle = "rgba(20,8,30,.9)";
    c.strokeStyle = "#20e3ff";
    c.lineWidth = 2.6;
    c.shadowColor = "#20e3ff";
    c.shadowBlur = 12;
    c.beginPath();
    c.roundRect(330, 1358, 150, 56, 8);
    c.fill();
    c.stroke();
    c.shadowBlur = 0;
    c.fillStyle = "#7ce6ff";
    c.font = F(36);
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.shadowColor = "#20e3ff";
    c.shadowBlur = 10;
    c.fillText("404", 405, 1388);
    c.restore();

    // chốt chrome trang trí
    for (const [px2, py2] of [[150, 500], [150, 646], [660, 500], [660, 646], [172, 1062], [172, 1192], [638, 1062], [638, 1192], [232, 1232], [578, 1232]]) {
      const pg = c.createRadialGradient(px2 - 2, py2 - 2, 1, px2, py2, 9);
      pg.addColorStop(0, "#f4f8ff");
      pg.addColorStop(1, "#5a6488");
      c.fillStyle = pg;
      c.beginPath();
      c.arc(px2, py2, 9, 0, Math.PI * 2);
      c.fill();
    }
  }

  /* ---------- phần tử động ---------- */

  function drawStar(x, y, r, tone) {
    g.save();
    g.translate(x, y);
    g.fillStyle = tone;
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI / 5) * i - Math.PI / 2;
      const rr = i % 2 === 0 ? r : r * 0.42;
      g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    g.closePath();
    g.fill();
    g.restore();
  }

  function drawBumpers(sim, time) {
    BUMPERS.forEach((b, i) => {
      const flash = sim.bumperFlash[i];
      g.save();
      g.translate(b.x, b.y);
      // quầng
      g.shadowColor = b.tone;
      g.shadowBlur = 18 + flash * 26;
      // vòng chrome ngoài
      const rg = g.createRadialGradient(-b.r * 0.3, -b.r * 0.3, b.r * 0.2, 0, 0, b.r);
      rg.addColorStop(0, "#e8eefc");
      rg.addColorStop(0.55, "#8f9ac0");
      rg.addColorStop(1, "#3c4468");
      g.fillStyle = rg;
      g.beginPath();
      g.arc(0, 0, b.r, 0, Math.PI * 2);
      g.fill();
      g.shadowBlur = 0;
      // đĩa màu trong
      const ig = g.createRadialGradient(0, -b.r * 0.2, 2, 0, 0, b.r * 0.78);
      ig.addColorStop(0, "#1c1946");
      ig.addColorStop(1, "#131034");
      g.fillStyle = ig;
      g.beginPath();
      g.arc(0, 0, b.r * 0.76, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = b.tone;
      g.lineWidth = 4.5 + flash * 2.5;
      g.shadowColor = b.tone;
      g.shadowBlur = 14 + flash * 16;
      g.stroke();
      // sao giữa
      g.shadowBlur = 10 + flash * 14;
      drawStar(0, 0, b.r * 0.48 * (1 + flash * 0.12), b.tone);
      g.restore();
      void time;
    });
  }

  function drawSpinner(sim) {
    g.save();
    g.translate(SPINNER.x, SPINNER.y);
    g.rotate(sim.spinner.rot);
    // vành ngoài
    g.strokeStyle = "rgba(255,46,166,.85)";
    g.lineWidth = 5;
    g.shadowColor = "#ff2ea6";
    g.shadowBlur = 14;
    g.beginPath();
    g.arc(0, 0, SPINNER.r, 0, Math.PI * 2);
    g.stroke();
    g.shadowBlur = 0;
    // đĩa
    const dg = g.createRadialGradient(0, 0, 4, 0, 0, SPINNER.r);
    dg.addColorStop(0, "#2a1040");
    dg.addColorStop(1, "#160a2c");
    g.fillStyle = dg;
    g.beginPath();
    g.arc(0, 0, SPINNER.r - 4, 0, Math.PI * 2);
    g.fill();
    // nan hoa
    g.strokeStyle = "#ff5ab5";
    g.lineWidth = 4;
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI / 5) * i;
      g.beginPath();
      g.moveTo(Math.cos(a) * 14, Math.sin(a) * 14);
      g.lineTo(Math.cos(a) * (SPINNER.r - 12), Math.sin(a) * (SPINNER.r - 12));
      g.stroke();
    }
    // trục chrome
    const hg = g.createRadialGradient(-3, -3, 1, 0, 0, 12);
    hg.addColorStop(0, "#f4f8ff");
    hg.addColorStop(1, "#5a6488");
    g.fillStyle = hg;
    g.beginPath();
    g.arc(0, 0, 12, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  function drawSlings(sim) {
    SLINGS.forEach((s, i) => {
      const flash = sim.slingFlash[i];
      const [a, b, c2] = s.verts;
      g.save();
      g.fillStyle = "rgba(38,24,72,.92)";
      g.beginPath();
      g.moveTo(a[0], a[1]);
      g.lineTo(b[0], b[1]);
      g.lineTo(c2[0], c2[1]);
      g.closePath();
      g.fill();
      g.strokeStyle = s.tone;
      g.lineWidth = 3.4 + flash * 3;
      g.shadowColor = s.tone;
      g.shadowBlur = 12 + flash * 22;
      g.stroke();
      g.restore();
    });
  }

  function drawTargets(sim, time) {
    TARGETS.forEach((tDef, i) => {
      const t = sim.targets[i];
      g.save();
      g.translate(tDef.x, tDef.y);
      if (!t.down) {
        g.shadowColor = "#9dff3e";
        g.shadowBlur = 10 + Math.sin(time * 5 + i) * 4;
        const tg2 = g.createRadialGradient(-3, -3, 1, 0, 0, tDef.r);
        tg2.addColorStop(0, "#d6ffa0");
        tg2.addColorStop(0.5, "#9dff3e");
        tg2.addColorStop(1, "#3f7a12");
        g.fillStyle = tg2;
        g.beginPath();
        g.arc(0, 0, tDef.r, 0, Math.PI * 2);
        g.fill();
      } else {
        g.strokeStyle = "rgba(157,255,62,.4)";
        g.lineWidth = 2;
        g.beginPath();
        g.arc(0, 0, tDef.r * 0.8, 0, Math.PI * 2);
        g.stroke();
      }
      g.restore();
    });
  }

  function drawRampSensors(sim, time) {
    RAMPS.forEach((r, i) => {
      const flash = sim.ramp.flash[i];
      g.save();
      g.translate(r.x, r.y);
      g.strokeStyle = r.tone;
      g.lineWidth = 3;
      g.globalAlpha = 0.55 + flash * 0.45;
      g.shadowColor = r.tone;
      g.shadowBlur = 10 + flash * 18;
      g.beginPath();
      g.arc(0, 0, r.r * (1 + Math.sin(time * 4 + i) * 0.05), 0, Math.PI * 2);
      g.stroke();
      // mũi tên hướng lên trong vòng
      g.fillStyle = r.tone;
      g.beginPath();
      g.moveTo(0, -r.r * 0.45);
      g.lineTo(r.r * 0.34, r.r * 0.25);
      g.lineTo(-r.r * 0.34, r.r * 0.25);
      g.closePath();
      g.fill();
      g.restore();
    });
  }

  function drawMultLights(sim, time) {
    const labels = ["x1", "x2", "x4", "x6", "x8"];
    const y = 1230;
    g.save();
    g.font = F(15);
    g.textAlign = "center";
    for (let i = 0; i < MULT_LADDER.length; i++) {
      const x = 313 + i * 46;
      const on = i <= sim.multIdx;
      g.fillStyle = on ? "#9dff3e" : "rgba(70,90,60,.5)";
      if (on) {
        g.shadowColor = "#9dff3e";
        g.shadowBlur = 9 + (i === sim.multIdx ? Math.sin(time * 6) * 4 : 0);
      }
      g.beginPath();
      g.arc(x, y, 8, 0, Math.PI * 2);
      g.fill();
      g.shadowBlur = 0;
      g.fillStyle = on ? "#c8ffa0" : "rgba(150,170,150,.5)";
      g.fillText(labels[i], x, y + 26);
    }
    g.restore();
  }

  function drawFlipper(side, sim) {
    const def = FLIPPERS[side];
    const f = sim.flippers[side];
    const tipX = def.px + Math.cos(f.angle) * def.len;
    const tipY = def.py + Math.sin(f.angle) * def.len;
    g.save();
    // viền hồng phát sáng
    g.strokeStyle = "#ff2ea6";
    g.lineCap = "round";
    g.lineWidth = FLIPPER_R * 2 + 7;
    g.shadowColor = "#ff2ea6";
    g.shadowBlur = 16;
    g.beginPath();
    g.moveTo(def.px, def.py);
    g.lineTo(tipX, tipY);
    g.stroke();
    g.shadowBlur = 0;
    // thân chrome trắng
    const fg = g.createLinearGradient(def.px, def.py - FLIPPER_R, def.px, def.py + FLIPPER_R);
    fg.addColorStop(0, "#ffffff");
    fg.addColorStop(0.6, "#dfe6f5");
    fg.addColorStop(1, "#9aa6c4");
    g.strokeStyle = fg;
    g.lineWidth = FLIPPER_R * 2;
    g.beginPath();
    g.moveTo(def.px, def.py);
    g.lineTo(tipX, tipY);
    g.stroke();
    // trục pivot
    const pg = g.createRadialGradient(def.px - 3, def.py - 3, 1, def.px, def.py, 13);
    pg.addColorStop(0, "#f4f8ff");
    pg.addColorStop(1, "#4a5478");
    g.fillStyle = pg;
    g.beginPath();
    g.arc(def.px, def.py, 13, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  function drawPlunger(sim) {
    const y = PLUNGER.y + 60 + sim.plunger.power * 40;
    g.save();
    // lò xo
    g.strokeStyle = "#8a94b8";
    g.lineWidth = 4;
    g.beginPath();
    for (let i = 0; i < 7; i++) {
      const sy = y + i * 14;
      g.moveTo(796, sy);
      g.lineTo(836, sy + 7);
    }
    g.stroke();
    // cán chrome
    const hg = g.createLinearGradient(800, 0, 832, 0);
    hg.addColorStop(0, "#e8eefc");
    hg.addColorStop(0.5, "#9aa6c4");
    hg.addColorStop(1, "#4a5478");
    g.fillStyle = hg;
    g.beginPath();
    g.roundRect(802, y - 26, 28, 30, 5);
    g.fill();
    g.fillStyle = "#2b3350";
    g.beginPath();
    g.roundRect(795, y + 96, 42, 18, 4);
    g.fill();
    // mức lực khi đang tụ
    if (sim.plunger.power > 0.01) {
      g.fillStyle = "#ffd23f";
      g.shadowColor = "#ffd23f";
      g.shadowBlur = 10;
      g.fillRect(852, 1040 - sim.plunger.power * 640, 6, sim.plunger.power * 640);
    }
    g.restore();
  }

  function drawBall(sim) {
    const b = sim.ball;
    // vệt cyan
    for (let i = 0; i < sim.trail.length; i++) {
      const t = sim.trail[i];
      const a = Math.max(0, t.life / 0.3) * 0.5;
      g.fillStyle = `rgba(60,220,255,${a.toFixed(3)})`;
      g.beginPath();
      g.arc(t.x, t.y, BALL_R * (0.4 + (i / sim.trail.length) * 0.5), 0, Math.PI * 2);
      g.fill();
    }
    g.save();
    g.shadowColor = "rgba(120,220,255,.8)";
    g.shadowBlur = 12;
    const bg = g.createRadialGradient(b.x - 5, b.y - 6, 2, b.x, b.y, BALL_R);
    bg.addColorStop(0, "#ffffff");
    bg.addColorStop(0.45, "#cfd9ec");
    bg.addColorStop(1, "#6a7694");
    g.fillStyle = bg;
    g.beginPath();
    g.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
    g.fill();
    g.restore();
    // highlight
    g.fillStyle = "rgba(255,255,255,.9)";
    g.beginPath();
    g.arc(b.x - 4.5, b.y - 5.5, 3.4, 0, Math.PI * 2);
    g.fill();
  }

  /* ---------- vẽ chính ---------- */

  function draw(sim, fx, time) {
    if (!bgCanvas || bgCanvas.width !== canvas.width) paintBg();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = "#08061c";
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.drawImage(bgCanvas, 0, 0);
    g.setTransform(scale, 0, 0, scale, offX, offY);

    drawSlings(sim);
    drawSpinner(sim);
    drawBumpers(sim, time);
    drawTargets(sim, time);
    drawRampSensors(sim, time);
    drawMultLights(sim, time);
    drawPlunger(sim);
    drawFlipper("left", sim);
    drawFlipper("right", sim);
    drawBall(sim);

    // particle
    for (const p of fx.particles) {
      g.globalAlpha = Math.max(0, p.life / p.life0);
      g.fillStyle = p.color;
      g.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    g.globalAlpha = 1;

    // đèn BALL SAVER
    if (sim.saver > 0 && sim.state === "play") {
      g.font = F(19);
      g.textAlign = "center";
      g.fillStyle = Math.floor(time * 4) % 2 === 0 ? "#ffd23f" : "rgba(255,210,63,.4)";
      g.shadowColor = "#ffd23f";
      g.shadowBlur = 10;
      g.fillText(`BALL SAVER ${Math.ceil(sim.saver)}s`, 405, 1052);
      g.shadowBlur = 0;
    }
  }

  return { fit, draw, toWorld };
}
