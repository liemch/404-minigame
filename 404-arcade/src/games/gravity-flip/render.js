/**
 * render.js — vẽ Gravity Flip 404 theo ảnh reference: hành lang kim loại
 * navy với dải neon hồng/cyan trên tường, gai neon hồng ở sàn/trần,
 * tinh thể xanh, xe đệm từ hồng có mũi tên lime, nhân vật vuông trắng
 * với vệt hạt (lime khi trọng lực xuống, cyan khi lên) và chỉ báo đảo
 * trọng lực dạng chevron.
 */

import { seededRand } from "../../core/utils.js";
import { WORLD, SPIKE, PLATFORM, PLAYER } from "./engine.js";

export function createFlipRenderer(canvas, box) {
  const g = canvas.getContext("2d");
  let dpr = 1;
  let scale = 1;
  let W = 0; // kích thước CSS px
  let H = 0;
  let viewW = 0; // bề rộng nhìn thấy theo tọa độ thế giới

  function fit() {
    const rect = box.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    W = rect.width;
    H = rect.height;
    scale = H / WORLD.h;
    viewW = W / scale;
  }

  /* ---------- lớp trang trí ---------- */

  function drawBackdrop(camX, time) {
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#0b0e2a");
    grad.addColorStop(0.5, "#0a0d26");
    grad.addColorStop(1, "#080a20");
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);

    // lớp mạch điện + pixel parallax 0.4
    const par = camX * 0.4;
    const tile = 640;
    const first = Math.floor(par / tile) - 1;
    for (let i = first; i < first + Math.ceil(W / (tile * scale)) + 3; i++) {
      const rand = seededRand(900 + ((i % 97) + 97) % 97);
      const bx = (i * tile - par) * scale;
      // cụm pixel
      for (let k = 0; k < 8; k++) {
        g.fillStyle = rand() > 0.72 ? "rgba(32,227,255,.3)" : "rgba(120,110,220,.2)";
        g.fillRect(bx + rand() * tile * scale, (170 + rand() * 540) * scale, 2.4, 2.4);
      }
      // chevron lớn mờ giữa hành lang
      if (rand() > 0.35) {
        const cy = (300 + rand() * 300) * scale;
        const cxx = bx + rand() * tile * scale * 0.7;
        const s = (26 + rand() * 22) * scale;
        g.strokeStyle = rand() > 0.5 ? "rgba(32,227,255,.22)" : "rgba(154,92,255,.2)";
        g.lineWidth = 6 * scale;
        for (const off of [0, s * 0.9]) {
          g.beginPath();
          g.moveTo(cxx + off, cy - s);
          g.lineTo(cxx + off + s, cy);
          g.lineTo(cxx + off, cy + s);
          g.stroke();
        }
      }
      // trace mạch
      g.strokeStyle = "rgba(60,90,200,.12)";
      g.lineWidth = 1.4;
      let x = bx + rand() * tile * scale;
      let y = (200 + rand() * 480) * scale;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 3; k++) {
        const len = (30 + rand() * 90) * scale;
        if (rand() > 0.5) x += rand() > 0.5 ? len : -len;
        else y += rand() > 0.5 ? len : -len;
        g.lineTo(x, y);
      }
      g.stroke();
    }

    // vạch tốc độ mờ chạy ngang
    g.strokeStyle = "rgba(150,190,255,.1)";
    g.lineWidth = 1.6;
    for (let i = 0; i < 5; i++) {
      const y = (200 + i * 130) * scale;
      const sx = W - (((time * 900 + i * 377) % (W + 260)) - 130);
      g.beginPath();
      g.moveTo(sx, y);
      g.lineTo(sx + 70, y);
      g.stroke();
    }
  }

  /** Dải tường kim loại trên/dưới với neon hồng + cyan. */
  function drawWalls(camX) {
    for (const side of ["top", "bot"]) {
      const y0 = side === "top" ? 0 : WORLD.floor * scale;
      const bh = side === "top" ? WORLD.ceil * scale : H - WORLD.floor * scale;
      const wg = g.createLinearGradient(0, y0, 0, y0 + bh);
      if (side === "top") {
        wg.addColorStop(0, "#1a1d42");
        wg.addColorStop(1, "#141736");
      } else {
        wg.addColorStop(0, "#141736");
        wg.addColorStop(1, "#1a1d42");
      }
      g.fillStyle = wg;
      g.fillRect(0, y0, W, bh);

      // tấm panel + đèn theo thế giới (parallax 1)
      const panel = 300;
      const first = Math.floor(camX / panel) - 1;
      for (let i = first; i < first + Math.ceil(viewW / panel) + 3; i++) {
        const rand = seededRand(500 + ((i % 89) + 89) % 89);
        const px = (i * panel - camX) * scale;
        g.strokeStyle = "rgba(38,46,100,.95)";
        g.lineWidth = 2.4;
        g.beginPath();
        g.moveTo(px, y0);
        g.lineTo(px, y0 + bh);
        g.stroke();
        // dải neon hồng / cyan ngẫu nhiên ổn định
        const mid = y0 + bh * (side === "top" ? 0.36 : 0.64);
        if (rand() > 0.25) {
          const tone = rand() > 0.5 ? "rgba(255,46,166,.9)" : "rgba(32,227,255,.85)";
          g.save();
          g.shadowColor = tone;
          g.shadowBlur = 9;
          g.strokeStyle = tone;
          g.lineWidth = 3.4;
          g.beginPath();
          g.moveTo(px + 30 * scale, mid);
          g.lineTo(px + (30 + 90 + rand() * 110) * scale, mid);
          g.stroke();
          g.restore();
        }
        // tấm ốp nhỏ + lỗ thông gió
        g.fillStyle = "rgba(24,28,66,.9)";
        g.fillRect(px + 24 * scale, y0 + bh * 0.52, 110 * scale, bh * 0.3);
        g.strokeStyle = "rgba(60,72,140,.5)";
        g.lineWidth = 1.2;
        g.strokeRect(px + 24 * scale, y0 + bh * 0.52, 110 * scale, bh * 0.3);
        g.fillStyle = "rgba(8,10,26,.95)";
        for (let k = 0; k < 3; k++) {
          g.fillRect(px + (46 + k * 26) * scale, y0 + bh * 0.14, 16 * scale, 5 * scale);
        }
        // chevron cảnh báo tím ở panel lẻ
        if (rand() > 0.62) {
          g.strokeStyle = "rgba(154,92,255,.6)";
          g.lineWidth = 4 * scale;
          const ay = y0 + bh * (side === "top" ? 0.7 : 0.32);
          for (const off of [0, 18 * scale]) {
            g.beginPath();
            g.moveTo(px + 200 * scale + off, ay - 11 * scale);
            g.lineTo(px + 212 * scale + off, ay);
            g.lineTo(px + 200 * scale + off, ay + 11 * scale);
            g.stroke();
          }
        }
      }

      // viền neon cyan mép trong
      const edge = side === "top" ? WORLD.ceil * scale : WORLD.floor * scale;
      g.save();
      g.shadowColor = "#20e3ff";
      g.shadowBlur = 10;
      g.strokeStyle = "rgba(32,227,255,.9)";
      g.lineWidth = 2.6;
      g.beginPath();
      g.moveTo(0, edge);
      g.lineTo(W, edge);
      g.stroke();
      g.restore();
    }
  }

  const wx = (x, camX) => (x - camX) * scale;
  const wy = (y) => y * scale;

  function drawSpikes(seg, camX, time) {
    for (const run of seg.spikes) {
      if (run.x + run.w < camX - 60 || run.x > camX + viewW + 60) continue;
      const n = Math.floor(run.w / SPIKE.step);
      const up = run.side === "floor";
      const baseY = up ? WORLD.floor : WORLD.ceil;
      const glow = 0.75 + Math.sin(time * 5 + run.x) * 0.2;
      for (let i = 0; i < n; i++) {
        const x0 = wx(run.x + i * SPIKE.step, camX);
        const x1 = wx(run.x + (i + 1) * SPIKE.step, camX);
        const tipY = wy(baseY + (up ? -SPIKE.h : SPIKE.h));
        g.save();
        g.shadowColor = "#ff2ea6";
        g.shadowBlur = 9;
        g.fillStyle = "#2a0a26";
        g.strokeStyle = `rgba(255,46,166,${glow.toFixed(2)})`;
        g.lineWidth = 2.2;
        g.beginPath();
        g.moveTo(x0 + 2, wy(baseY));
        g.lineTo((x0 + x1) / 2, tipY);
        g.lineTo(x1 - 2, wy(baseY));
        g.closePath();
        g.fill();
        g.stroke();
        g.restore();
      }
    }
  }

  function drawShards(seg, camX, time) {
    for (const sh of seg.shards) {
      if (sh.taken || sh.x < camX - 60 || sh.x > camX + viewW + 60) continue;
      const bob = Math.sin(time * 2.4 + sh.phase) * 7;
      const x = wx(sh.x, camX);
      const y = wy(sh.y + bob);
      const s = 21 * scale;
      g.save();
      g.translate(x, y);
      g.shadowColor = "#3b9dff";
      g.shadowBlur = 12;
      const cg = g.createLinearGradient(0, -s, 0, s);
      cg.addColorStop(0, "#bfe9ff");
      cg.addColorStop(0.5, "#4fb2ff");
      cg.addColorStop(1, "#1d5fd6");
      g.fillStyle = cg;
      g.beginPath();
      g.moveTo(0, -s);
      g.lineTo(s * 0.62, 0);
      g.lineTo(0, s);
      g.lineTo(-s * 0.62, 0);
      g.closePath();
      g.fill();
      g.shadowBlur = 0;
      g.fillStyle = "rgba(240,250,255,.85)";
      g.beginPath();
      g.moveTo(0, -s);
      g.lineTo(s * 0.24, -s * 0.3);
      g.lineTo(-s * 0.24, -s * 0.3);
      g.closePath();
      g.fill();
      g.restore();
    }
  }

  function drawShieldPickup(seg, camX, time) {
    const sp = seg.shield;
    if (!sp || sp.taken || sp.x < camX - 60 || sp.x > camX + viewW + 60) return;
    const x = wx(sp.x, camX);
    const y = wy(sp.y + Math.sin(time * 2.2) * 6);
    g.save();
    g.translate(x, y);
    g.shadowColor = "#3b9dff";
    g.shadowBlur = 12;
    g.strokeStyle = "#3b9dff";
    g.lineWidth = 2.6;
    g.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      g.lineTo(Math.cos(a) * 20 * scale, Math.sin(a) * 20 * scale);
    }
    g.closePath();
    g.stroke();
    g.fillStyle = "rgba(8,10,26,.9)";
    g.fill();
    g.shadowBlur = 0;
    g.fillStyle = "#3b9dff";
    const s = 12 * scale;
    g.beginPath();
    g.moveTo(0, -s);
    g.lineTo(s * 0.8, -s * 0.5);
    g.lineTo(s * 0.8, s * 0.25);
    g.quadraticCurveTo(s * 0.8, s * 0.7, 0, s);
    g.quadraticCurveTo(-s * 0.8, s * 0.7, -s * 0.8, s * 0.25);
    g.lineTo(-s * 0.8, -s * 0.5);
    g.closePath();
    g.fill();
    g.restore();
  }

  function drawPlatform(p, camX, time) {
    if (p.x + p.w < camX - 80 || p.x > camX + viewW + 80) return;
    const x = wx(p.x, camX);
    const y = wy(p.y);
    const w = p.w * scale;
    const h = PLATFORM.h * scale;
    g.save();
    // thân xe đệm tối
    g.fillStyle = "#1a1432";
    g.beginPath();
    g.roundRect(x, y, w, h, 8 * scale);
    g.fill();
    g.strokeStyle = "rgba(120,100,200,.5)";
    g.lineWidth = 1.6;
    g.stroke();
    // mặt trên phát sáng hồng
    g.save();
    g.shadowColor = "#ff2ea6";
    g.shadowBlur = 14;
    const tg = g.createLinearGradient(0, y - 4 * scale, 0, y + 8 * scale);
    tg.addColorStop(0, "#ff7cc8");
    tg.addColorStop(1, "#ff2ea6");
    g.fillStyle = tg;
    g.beginPath();
    g.roundRect(x + 3 * scale, y - 4 * scale, w - 6 * scale, 9 * scale, 4 * scale);
    g.fill();
    g.restore();
    // mũi tên lime giữa thân
    g.strokeStyle = "#9dff3e";
    g.lineWidth = 4.5 * scale;
    g.shadowColor = "#9dff3e";
    g.shadowBlur = 7;
    const cy = y + h * 0.55;
    for (let k = 0; k < 4; k++) {
      const ax = x + w / 2 - 34 * scale + k * 20 * scale;
      g.beginPath();
      g.moveTo(ax, cy - 8 * scale);
      g.lineTo(ax + 11 * scale, cy);
      g.lineTo(ax, cy + 8 * scale);
      g.stroke();
    }
    g.shadowBlur = 0;
    // bánh đệm dưới
    g.fillStyle = "#0c0e24";
    for (const fx of [0.16, 0.84]) {
      g.beginPath();
      g.arc(x + w * fx, y + h + 4 * scale, 7 * scale, 0, Math.PI * 2);
      g.fill();
    }
    // cửa sổ nhỏ
    g.fillStyle = "rgba(32,227,255,.35)";
    g.fillRect(x + 14 * scale, y + h * 0.4, 18 * scale, 6 * scale);
    g.fillRect(x + w - 34 * scale, y + h * 0.4, 18 * scale, 6 * scale);
    g.restore();
    void time;
  }

  function drawPlayer(sim, camX, time) {
    const x = wx(sim.x, camX);
    const y = wy(sim.y);
    const s = PLAYER.size * scale;
    const blink = sim.inv > 0 && Math.floor(time * 14) % 2 === 0;
    if (blink) return;
    g.save();
    g.translate(x, y);
    g.rotate(sim.rot + (sim.grounded === null ? Math.sin(time * 9) * 0.12 : 0));
    // khiên
    if (sim.shield) {
      g.strokeStyle = "rgba(59,157,255,.7)";
      g.lineWidth = 2.6;
      g.shadowColor = "#3b9dff";
      g.shadowBlur = 12;
      g.beginPath();
      g.arc(0, 0, s * 0.86, 0, Math.PI * 2);
      g.stroke();
      g.shadowBlur = 0;
    }
    // thân vuông trắng
    g.shadowColor = "rgba(220,235,255,.7)";
    g.shadowBlur = 10;
    const bg = g.createLinearGradient(0, -s / 2, 0, s / 2);
    bg.addColorStop(0, "#f4f7ff");
    bg.addColorStop(1, "#c9d5ef");
    g.fillStyle = bg;
    g.beginPath();
    g.roundRect(-s / 2, -s / 2, s, s, 6 * scale);
    g.fill();
    g.shadowBlur = 0;
    g.strokeStyle = "rgba(70,90,150,.6)";
    g.lineWidth = 1.6;
    g.stroke();
    // visor tối + mắt cyan
    g.fillStyle = "#0c1226";
    g.beginPath();
    g.roundRect(-s * 0.32, -s * 0.22, s * 0.64, s * 0.3, 4 * scale);
    g.fill();
    g.save();
    g.shadowColor = "#20e3ff";
    g.shadowBlur = 7;
    g.fillStyle = "#20e3ff";
    g.fillRect(-s * 0.18, -s * 0.13, s * 0.1, s * 0.12);
    g.fillRect(s * 0.08, -s * 0.13, s * 0.1, s * 0.12);
    g.restore();
    // antenna
    g.strokeStyle = "#8ea4cc";
    g.lineWidth = 2.4;
    g.beginPath();
    g.moveTo(s * 0.18, -s / 2);
    g.lineTo(s * 0.3, -s * 0.78);
    g.stroke();
    g.fillStyle = "#ff2ea6";
    g.beginPath();
    g.arc(s * 0.3, -s * 0.82, 3.4 * scale, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  /** Chevron chỉ hướng đảo tiếp theo (cyan lên / lime xuống) cạnh nhân vật. */
  function drawFlipIndicator(sim, camX, time) {
    if (sim.grounded === null || sim.over) return;
    const x = wx(sim.x, camX);
    const dirUp = sim.g === 1;
    const tone = dirUp ? "#20e3ff" : "#9dff3e";
    const baseY = dirUp ? wy(sim.y) - 66 * scale : wy(sim.y) + 66 * scale;
    const pulse = (Math.sin(time * 6) + 1) / 2;
    g.save();
    g.strokeStyle = tone;
    g.globalAlpha = 0.45 + pulse * 0.5;
    g.lineWidth = 4 * scale;
    g.shadowColor = tone;
    g.shadowBlur = 8;
    for (let k = 0; k < 2; k++) {
      const yy = baseY + (dirUp ? -k * 16 * scale : k * 16 * scale);
      g.beginPath();
      g.moveTo(x - 13 * scale, yy + (dirUp ? 8 : -8) * scale);
      g.lineTo(x, yy - (dirUp ? 8 : -8) * scale);
      g.lineTo(x + 13 * scale, yy + (dirUp ? 8 : -8) * scale);
      g.stroke();
    }
    g.restore();
  }

  /** Huy hiệu ⇕ mép trái như reference. */
  function drawFlipBadge(time) {
    const x = 56 * scale + 10;
    const y = H / 2;
    const r = 26 * scale;
    g.save();
    g.globalAlpha = 0.85;
    g.strokeStyle = "rgba(220,235,255,.85)";
    g.lineWidth = 2.4;
    g.shadowColor = "rgba(150,220,255,.8)";
    g.shadowBlur = 8 + Math.sin(time * 3) * 3;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = "rgba(8,12,30,.72)";
    g.fill();
    g.shadowBlur = 0;
    g.strokeStyle = "#eef4ff";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(x, y - r * 0.55);
    g.lineTo(x, y + r * 0.55);
    g.stroke();
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(x - r * 0.3, y + s * r * 0.25);
      g.lineTo(x, y + s * r * 0.6);
      g.lineTo(x + r * 0.3, y + s * r * 0.25);
      g.stroke();
    }
    g.restore();
  }

  /* ---------- vẽ chính ---------- */

  function draw(sim, fx, time) {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const camX = sim.x - viewW * 0.3;

    drawBackdrop(camX, time);

    // vệt hạt sau nhân vật (lime xuống / cyan lên)
    for (const t of fx.trail) {
      const a = Math.max(0, t.life / t.life0);
      g.globalAlpha = a * 0.85;
      g.fillStyle = t.g === 1 ? "#9dff3e" : "#20e3ff";
      const s = (3 + a * 4) * scale;
      g.fillRect(wx(t.x, camX) - s / 2, wy(t.y) - s / 2, s, s);
    }
    g.globalAlpha = 1;

    for (const seg of sim.segments) {
      for (const p of seg.platforms) drawPlatform(p, camX, time);
      drawShards(seg, camX, time);
      drawShieldPickup(seg, camX, time);
    }

    drawWalls(camX);
    for (const seg of sim.segments) drawSpikes(seg, camX, time);

    drawFlipIndicator(sim, camX, time);
    if (!sim.over) drawPlayer(sim, camX, time);
    drawFlipBadge(time);

    // particle nổ / nhặt
    for (const pt of fx.particles) {
      g.globalAlpha = Math.max(0, pt.life / pt.life0);
      g.fillStyle = pt.color;
      g.fillRect(wx(pt.x, camX) - pt.size / 2, wy(pt.y) - pt.size / 2, pt.size * scale, pt.size * scale);
    }
    g.globalAlpha = 1;
  }

  return { fit, draw };
}
