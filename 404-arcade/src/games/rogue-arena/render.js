/**
 * render.js — vẽ Rogue Arena theo ảnh reference: sàn đấu tối với vòng
 * tròn đồng tâm phát sáng giữa sàn, khung tường + dải neon góc hồng/cyan
 * dày, robot trắng mắt cyan có quầng sáng lớn, đạn sao chổi cyan, enemy
 * khối wireframe neon (tam giác hồng / khối đỏ tâm ngắm / khối tím) luôn
 * kèm thanh máu đỏ, gem XP kim cương xanh glow, hex XP lime, hex hồi
 * máu, boss kim tự tháp đỏ, chữ nổi "+N XP".
 */

import { ARENA_W, ARENA_H, WALL } from "./data.js";

export function createArenaRenderer(g, { reducedMotion = false } = {}) {
  let staticLayer = null;
  const parts = []; // hạt {x,y,vx,vy,life,color,size}
  const floats = []; // chữ nổi
  const rings = []; // vòng nổ

  /* ---------------- lớp tĩnh ---------------- */

  function buildStatic() {
    staticLayer = document.createElement("canvas");
    const S = 1.2;
    staticLayer.width = ARENA_W * S;
    staticLayer.height = ARENA_H * S;
    const s = staticLayer.getContext("2d");
    s.scale(S, S);

    const cx = ARENA_W / 2;
    const cy = ARENA_H / 2;

    // sàn
    const bg = s.createRadialGradient(cx, cy, 80, cx, cy, 760);
    bg.addColorStop(0, "#0e1434");
    bg.addColorStop(0.6, "#090e24");
    bg.addColorStop(1, "#05081a");
    s.fillStyle = bg;
    s.fillRect(0, 0, ARENA_W, ARENA_H);

    // lưới mờ
    s.strokeStyle = "rgba(90, 110, 200, 0.08)";
    s.lineWidth = 1;
    for (let x = WALL; x < ARENA_W; x += 68) {
      s.beginPath();
      s.moveTo(x, WALL);
      s.lineTo(x, ARENA_H - WALL);
      s.stroke();
    }
    for (let y = WALL; y < ARENA_H; y += 68) {
      s.beginPath();
      s.moveTo(WALL, y);
      s.lineTo(ARENA_W - WALL, y);
      s.stroke();
    }
    // chấm giao lưới
    s.fillStyle = "rgba(110,140,230,0.14)";
    for (let x = WALL; x < ARENA_W; x += 68) {
      for (let y = WALL; y < ARENA_H; y += 68) {
        s.fillRect(x - 1, y - 1, 2, 2);
      }
    }

    // vòng tròn đồng tâm giữa sàn (như ảnh: emblem lớn phát sáng)
    const emblem = s.createRadialGradient(cx, cy, 20, cx, cy, 230);
    emblem.addColorStop(0, "rgba(60,120,255,0.14)");
    emblem.addColorStop(0.7, "rgba(50,100,230,0.05)");
    emblem.addColorStop(1, "rgba(0,0,0,0)");
    s.fillStyle = emblem;
    s.beginPath();
    s.arc(cx, cy, 235, 0, Math.PI * 2);
    s.fill();
    s.lineWidth = 2;
    for (const [r, a] of [[70, 0.22], [120, 0.18], [175, 0.14], [228, 0.12]]) {
      s.strokeStyle = `rgba(110, 150, 255, ${a})`;
      s.beginPath();
      s.arc(cx, cy, r, 0, Math.PI * 2);
      s.stroke();
    }
    // vành khắc vạch (segmented ring)
    s.strokeStyle = "rgba(110,150,255,0.2)";
    s.lineWidth = 7;
    for (let i = 0; i < 24; i++) {
      const a0 = (Math.PI / 12) * i + 0.03;
      const a1 = a0 + Math.PI / 12 - 0.1;
      s.beginPath();
      s.arc(cx, cy, 200, a0, a1);
      s.stroke();
    }
    // trục chữ thập
    s.strokeStyle = "rgba(100, 140, 255, 0.14)";
    s.lineWidth = 1.6;
    s.beginPath();
    s.moveTo(cx - 245, cy);
    s.lineTo(cx + 245, cy);
    s.moveTo(cx, cy - 245);
    s.lineTo(cx, cy + 245);
    s.stroke();
    // vạch tick quanh vành ngoài
    s.strokeStyle = "rgba(110,150,255,0.3)";
    s.lineWidth = 2;
    for (let i = 0; i < 36; i++) {
      const a = (Math.PI / 18) * i;
      s.beginPath();
      s.moveTo(cx + Math.cos(a) * 240, cy + Math.sin(a) * 240);
      s.lineTo(cx + Math.cos(a) * 248, cy + Math.sin(a) * 248);
      s.stroke();
    }

    // tường
    const wallGrad = s.createLinearGradient(0, 0, 0, ARENA_H);
    wallGrad.addColorStop(0, "#0c1128");
    wallGrad.addColorStop(1, "#080c1e");
    s.fillStyle = wallGrad;
    s.fillRect(0, 0, ARENA_W, WALL);
    s.fillRect(0, ARENA_H - WALL, ARENA_W, WALL);
    s.fillRect(0, 0, WALL, ARENA_H);
    s.fillRect(ARENA_W - WALL, 0, WALL, ARENA_H);
    s.strokeStyle = "rgba(110, 130, 210, 0.4)";
    s.lineWidth = 2;
    s.strokeRect(WALL, WALL, ARENA_W - WALL * 2, ARENA_H - WALL * 2);
    // vạch kỹ thuật trên tường
    s.fillStyle = "rgba(110,130,210,0.24)";
    for (let x = 60; x < ARENA_W - 60; x += 120) {
      s.fillRect(x, WALL / 2 - 2, 34, 4);
      s.fillRect(x, ARENA_H - WALL / 2 - 2, 34, 4);
    }
    for (let y = 80; y < ARENA_H - 80; y += 140) {
      s.fillRect(WALL / 2 - 2, y, 4, 30);
      s.fillRect(ARENA_W - WALL / 2 - 2, y, 4, 30);
    }

    // dải neon góc: trái hồng, phải cyan (như ảnh) — 2 lớp L dày + glow
    const corner = (x, y, dx, dy, rgb) => {
      const L = 150;
      // quầng
      s.strokeStyle = `rgba(${rgb},0.18)`;
      s.lineWidth = 17;
      s.lineCap = "round";
      s.beginPath();
      s.moveTo(x + dx * L, y);
      s.lineTo(x, y);
      s.lineTo(x, y + dy * L);
      s.stroke();
      // lõi
      s.strokeStyle = `rgba(${rgb},0.95)`;
      s.lineWidth = 6;
      s.beginPath();
      s.moveTo(x + dx * L, y);
      s.lineTo(x, y);
      s.lineTo(x, y + dy * L);
      s.stroke();
      // L phụ bên trong
      const o = 16;
      s.strokeStyle = `rgba(${rgb},0.5)`;
      s.lineWidth = 3;
      s.beginPath();
      s.moveTo(x + dx * (L * 0.55), y + dy * o);
      s.lineTo(x + dx * o, y + dy * o);
      s.lineTo(x + dx * o, y + dy * (L * 0.55));
      s.stroke();
    };
    corner(WALL + 8, WALL + 8, 1, 1, "255,46,150");
    corner(WALL + 8, ARENA_H - WALL - 8, 1, -1, "255,46,150");
    corner(ARENA_W - WALL - 8, WALL + 8, -1, 1, "32,227,255");
    corner(ARENA_W - WALL - 8, ARENA_H - WALL - 8, -1, -1, "32,227,255");

    // thanh neon giữa cạnh trái/phải (như ảnh có đèn dọc)
    s.lineCap = "round";
    s.strokeStyle = "rgba(255,46,150,0.65)";
    s.lineWidth = 4;
    s.beginPath();
    s.moveTo(WALL + 8, ARENA_H / 2 - 60);
    s.lineTo(WALL + 8, ARENA_H / 2 + 60);
    s.stroke();
    s.strokeStyle = "rgba(32,227,255,0.65)";
    s.beginPath();
    s.moveTo(ARENA_W - WALL - 8, ARENA_H / 2 - 60);
    s.lineTo(ARENA_W - WALL - 8, ARENA_H / 2 + 60);
    s.stroke();
  }

  /* ---------------- entity painter ---------------- */

  function drawPlayer(p, time) {
    g.save();
    g.translate(p.x, p.y);
    // quầng sáng lớn quanh người chơi (như ảnh)
    const aura = g.createRadialGradient(0, 0, 6, 0, 0, 64);
    aura.addColorStop(0, "rgba(60,200,255,0.3)");
    aura.addColorStop(0.55, "rgba(40,140,255,0.12)");
    aura.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = aura;
    g.beginPath();
    g.arc(0, 0, 64, 0, Math.PI * 2);
    g.fill();
    // vòng sáng dưới chân
    g.strokeStyle = "rgba(32,227,255,0.5)";
    g.lineWidth = 2;
    g.beginPath();
    g.arc(0, 7, 21, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = "rgba(32,227,255,0.2)";
    g.beginPath();
    g.arc(0, 7, 26, 0, Math.PI * 2);
    g.stroke();
    // nhấp nháy khi bất tử
    if (p.ifr > 0 && Math.floor(time * 14) % 2 === 0) g.globalAlpha = 0.45;
    const bob = Math.sin(time * 5) * 1.4;
    g.translate(0, bob);
    // chân
    g.fillStyle = "#8f9ec4";
    g.beginPath();
    g.roundRect(-9, 9, 7, 8, 2);
    g.fill();
    g.beginPath();
    g.roundRect(2, 9, 7, 8, 2);
    g.fill();
    // thân trắng
    const body = g.createLinearGradient(0, -14, 0, 12);
    body.addColorStop(0, "#ffffff");
    body.addColorStop(0.75, "#e8edff");
    body.addColorStop(1, "#c2cbe8");
    g.fillStyle = body;
    g.beginPath();
    g.roundRect(-12, -13, 24, 24, 7);
    g.fill();
    g.strokeStyle = "rgba(90,110,160,0.45)";
    g.lineWidth = 1;
    g.stroke();
    // vai
    g.fillStyle = "#b9c3de";
    g.beginPath();
    g.roundRect(-17, -7, 6, 12, 2);
    g.fill();
    g.beginPath();
    g.roundRect(11, -7, 6, 12, 2);
    g.fill();
    // anten
    g.strokeStyle = "#b9c3de";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, -13);
    g.lineTo(0, -18);
    g.stroke();
    g.save();
    g.shadowColor = "#20e3ff";
    g.shadowBlur = 7;
    g.fillStyle = "#20e3ff";
    g.beginPath();
    g.arc(0, -19.5, 2.2, 0, Math.PI * 2);
    g.fill();
    g.restore();
    // visor cyan
    g.fillStyle = "#0a1224";
    g.beginPath();
    g.roundRect(-8, -9, 16, 9.5, 4);
    g.fill();
    g.save();
    g.shadowColor = "#20e3ff";
    g.shadowBlur = 9;
    g.fillStyle = "#20e3ff";
    g.beginPath();
    g.roundRect(-5.5, -6.6, 11, 4, 2);
    g.fill();
    g.restore();
    // đèn ngực
    g.fillStyle = "rgba(32,227,255,0.7)";
    g.fillRect(-2.6, 3, 5.2, 2.4);
    g.restore();
  }

  function drawOrbits(p, time) {
    if (p.orbit <= 0) return;
    for (let i = 0; i < p.orbit; i++) {
      const a = p.orbitAngle + (i * Math.PI * 2) / p.orbit;
      const ox = p.x + Math.cos(a) * 56;
      const oy = p.y + Math.sin(a) * 56;
      g.save();
      g.shadowColor = "#9a5cff";
      g.shadowBlur = 12;
      const orb = g.createRadialGradient(ox - 2, oy - 2, 1, ox, oy, 9);
      orb.addColorStop(0, "#ffffff");
      orb.addColorStop(0.5, "#c9a6ff");
      orb.addColorStop(1, "#9a5cff");
      g.fillStyle = orb;
      g.beginPath();
      g.arc(ox, oy, 8, 0, Math.PI * 2);
      g.fill();
      g.restore();
      void time;
    }
  }

  function hpBar(e) {
    const w = Math.max(24, e.r * 1.8);
    g.fillStyle = "rgba(6,8,18,0.85)";
    g.fillRect(-w / 2 - 1, -e.r - 13, w + 2, 5.5);
    g.strokeStyle = "rgba(255,80,100,0.3)";
    g.lineWidth = 1;
    g.strokeRect(-w / 2 - 1, -e.r - 13, w + 2, 5.5);
    g.fillStyle = "#ff2e4f";
    g.fillRect(-w / 2, -e.r - 12, w * Math.max(0, e.hp / e.maxHp), 3.5);
  }

  function drawEnemy(e, time) {
    g.save();
    g.translate(e.x, e.y);
    const flash = e.hitFlash > 0;

    if (e.type === "chaser") {
      // kim tự tháp hồng wireframe (như ảnh)
      g.rotate(Math.sin(time * 3 + e.id) * 0.18);
      g.save();
      g.shadowColor = "#ff2e96";
      g.shadowBlur = 14;
      g.fillStyle = flash ? "#ffd7ec" : "rgba(50,8,38,0.9)";
      g.strokeStyle = "#ff2e96";
      g.lineWidth = 2.6;
      g.beginPath();
      g.moveTo(0, -e.r);
      g.lineTo(e.r * 0.95, e.r * 0.75);
      g.lineTo(-e.r * 0.95, e.r * 0.75);
      g.closePath();
      g.fill();
      g.stroke();
      g.restore();
      // cạnh trong wireframe
      g.strokeStyle = "rgba(255,46,150,0.75)";
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(0, -e.r);
      g.lineTo(0, e.r * 0.75);
      g.moveTo(0, -e.r * 0.15);
      g.lineTo(e.r * 0.95, e.r * 0.75);
      g.moveTo(0, -e.r * 0.15);
      g.lineTo(-e.r * 0.95, e.r * 0.75);
      g.stroke();
      // đỉnh sáng
      g.fillStyle = "#ff7dc0";
      for (const [vx, vy] of [[0, -e.r], [e.r * 0.95, e.r * 0.75], [-e.r * 0.95, e.r * 0.75]]) {
        g.beginPath();
        g.arc(vx, vy, 1.8, 0, Math.PI * 2);
        g.fill();
      }
    } else if (e.type === "shooter") {
      // khối lập phương đỏ có tâm ngắm (như ảnh)
      g.rotate(Math.sin(time * 2 + e.id) * 0.12);
      g.save();
      g.shadowColor = "#ff3b4f";
      g.shadowBlur = 12;
      g.fillStyle = flash ? "#ffe2e2" : "rgba(46,6,12,0.92)";
      g.strokeStyle = "#ff3b4f";
      g.lineWidth = 2.4;
      g.beginPath();
      g.roundRect(-e.r, -e.r, e.r * 2, e.r * 2, 3);
      g.fill();
      g.stroke();
      g.restore();
      // wireframe 3D: mặt sau lệch
      g.strokeStyle = "rgba(255,59,79,0.5)";
      g.lineWidth = 1.4;
      const o = e.r * 0.36;
      g.strokeRect(-e.r + o, -e.r + o, e.r * 2 - o * 2, e.r * 2 - o * 2);
      g.beginPath();
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        g.moveTo(sx * e.r, sy * e.r);
        g.lineTo(sx * (e.r - o), sy * (e.r - o));
      }
      g.stroke();
      // tâm ngắm
      g.save();
      g.shadowColor = "#ff8091";
      g.shadowBlur = 6;
      g.strokeStyle = "#ff8091";
      g.lineWidth = 1.8;
      g.beginPath();
      g.arc(0, 0, e.r * 0.42, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = "#ffb3bd";
      g.beginPath();
      g.arc(0, 0, e.r * 0.14, 0, Math.PI * 2);
      g.fill();
      g.restore();
    } else if (e.type === "tank") {
      // khối tím lớn wireframe
      g.rotate(Math.sin(time * 1.4 + e.id) * 0.06);
      g.save();
      g.shadowColor = "#9a5cff";
      g.shadowBlur = 14;
      g.fillStyle = flash ? "#f0e2ff" : "rgba(28,12,54,0.92)";
      g.strokeStyle = "#9a5cff";
      g.lineWidth = 3;
      g.beginPath();
      g.roundRect(-e.r, -e.r, e.r * 2, e.r * 2, 4);
      g.fill();
      g.stroke();
      g.restore();
      const o = e.r * 0.4;
      g.strokeStyle = "rgba(154,92,255,0.55)";
      g.lineWidth = 1.8;
      g.strokeRect(-e.r + o, -e.r + o, e.r * 2 - o * 2, e.r * 2 - o * 2);
      g.beginPath();
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        g.moveTo(sx * e.r, sy * e.r);
        g.lineTo(sx * (e.r - o), sy * (e.r - o));
      }
      g.stroke();
      g.save();
      g.shadowColor = "#c9a6ff";
      g.shadowBlur = 8;
      g.fillStyle = "#c9a6ff";
      g.beginPath();
      g.arc(0, 0, 4, 0, Math.PI * 2);
      g.fill();
      g.restore();
    } else if (e.type === "boss") {
      g.rotate(Math.sin(time * 1.6) * 0.08);
      g.save();
      g.shadowColor = "#ff3b4f";
      g.shadowBlur = 26;
      g.fillStyle = flash ? "#ffd7d7" : "rgba(56,8,16,0.94)";
      g.strokeStyle = "#ff3b4f";
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(0, -e.r);
      g.lineTo(e.r, e.r * 0.8);
      g.lineTo(-e.r, e.r * 0.8);
      g.closePath();
      g.fill();
      g.stroke();
      g.restore();
      g.strokeStyle = "rgba(255,59,79,0.7)";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(0, -e.r * 0.45);
      g.lineTo(e.r * 0.5, e.r * 0.45);
      g.lineTo(-e.r * 0.5, e.r * 0.45);
      g.closePath();
      g.stroke();
      g.beginPath();
      g.moveTo(0, -e.r);
      g.lineTo(0, e.r * 0.8);
      g.stroke();
      // mắt đỏ
      g.save();
      g.shadowColor = "#ff3b4f";
      g.shadowBlur = 10;
      g.fillStyle = "#ff6272";
      g.beginPath();
      g.arc(0, e.r * 0.1, 5, 0, Math.PI * 2);
      g.fill();
      g.restore();
      // thanh máu boss
      const w = 90;
      g.fillStyle = "rgba(8,8,16,0.85)";
      g.fillRect(-w / 2, -e.r - 18, w, 7);
      g.fillStyle = "#ff3b4f";
      g.fillRect(-w / 2 + 1, -e.r - 17, (w - 2) * Math.max(0, e.hp / e.maxHp), 5);
    }

    // thanh máu đỏ luôn hiển thị (như ảnh, trừ boss đã có)
    if (e.type !== "boss") hpBar(e);
    g.restore();
  }

  function drawBolt(b) {
    const a = Math.atan2(b.vy, b.vx);
    g.save();
    g.translate(b.x, b.y);
    g.rotate(a);
    // đuôi sao chổi dài
    const tail = g.createLinearGradient(-26, 0, 6, 0);
    tail.addColorStop(0, "rgba(32,227,255,0)");
    tail.addColorStop(0.7, "rgba(32,227,255,0.3)");
    tail.addColorStop(1, "rgba(120,240,255,0.55)");
    g.fillStyle = tail;
    g.beginPath();
    g.ellipse(-9, 0, 17, 4.6, 0, 0, Math.PI * 2);
    g.fill();
    // lõi sáng
    g.save();
    g.shadowColor = "#20e3ff";
    g.shadowBlur = 9;
    const core = g.createLinearGradient(-8, 0, 8, 0);
    core.addColorStop(0, "#20e3ff");
    core.addColorStop(1, "#eafcff");
    g.fillStyle = core;
    g.beginPath();
    g.ellipse(0, 0, 8.5, 2.8, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
    g.restore();
  }

  function drawEbolt(b, time) {
    g.save();
    g.translate(b.x, b.y);
    g.save();
    g.shadowColor = "#ff3b6e";
    g.shadowBlur = 8;
    g.fillStyle = "rgba(255,59,110,0.32)";
    g.beginPath();
    g.arc(0, 0, 7.5 + Math.sin(time * 12) * 1, 0, Math.PI * 2);
    g.fill();
    const core = g.createRadialGradient(-1, -1, 0.5, 0, 0, 4);
    core.addColorStop(0, "#ffd9e2");
    core.addColorStop(1, "#ff5d7d");
    g.fillStyle = core;
    g.beginPath();
    g.arc(0, 0, 3.8, 0, Math.PI * 2);
    g.fill();
    g.restore();
    g.restore();
  }

  function drawGem(gem, time) {
    g.save();
    g.translate(gem.x, gem.y + Math.sin(time * 4 + gem.x) * 2);
    if (gem.heal) {
      // hex hồi máu xanh lá (như ảnh)
      g.save();
      g.shadowColor = "#4df77f";
      g.shadowBlur = 10;
      g.strokeStyle = "#4df77f";
      g.fillStyle = "rgba(10,40,20,0.92)";
      g.lineWidth = 2.2;
      hexPath(13);
      g.fill();
      g.stroke();
      g.fillStyle = "#4df77f";
      g.fillRect(-2, -6.5, 4, 13);
      g.fillRect(-6.5, -2, 13, 4);
      g.restore();
    } else if (gem.big) {
      // hex XP lime (như ảnh)
      g.save();
      g.shadowColor = "#a8ff3e";
      g.shadowBlur = 10;
      g.strokeStyle = "#a8ff3e";
      g.fillStyle = "rgba(30,46,8,0.94)";
      g.lineWidth = 2.2;
      hexPath(14);
      g.fill();
      g.stroke();
      g.fillStyle = "#a8ff3e";
      g.font = "800 10px 'JetBrains Mono', monospace";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("XP", 0, 0.5);
      g.restore();
    } else {
      // kim cương xanh glow
      const c = gem.value >= 3 ? "#7dc4ff" : "#20e3ff";
      g.save();
      g.shadowColor = c;
      g.shadowBlur = 9;
      g.fillStyle = c;
      g.beginPath();
      g.moveTo(0, -8);
      g.lineTo(5.5, 0);
      g.lineTo(0, 8);
      g.lineTo(-5.5, 0);
      g.closePath();
      g.fill();
      g.restore();
      g.fillStyle = "rgba(255,255,255,0.85)";
      g.beginPath();
      g.moveTo(0, -8);
      g.lineTo(5.5, 0);
      g.lineTo(0, 0);
      g.closePath();
      g.fill();
    }
    g.restore();

    function hexPath(r) {
      g.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.closePath();
    }
  }

  /* ---------------- hiệu ứng ---------------- */

  function burst(x, y, color, n) {
    const count = reducedMotion ? Math.ceil(n / 2) : n;
    for (let i = 0; i < count; i++) {
      if (parts.length > 260) break;
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 180;
      parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.55, color, size: 2 + Math.random() * 2.6 });
    }
  }

  function addEvents(events, arena, time) {
    for (const e of events) {
      switch (e.type) {
        case "kill":
          burst(e.x, e.y, e.big ? "#ff3b4f" : "#ff2e96", e.big ? 18 : 10);
          burst(e.x, e.y, "#ffd9ec", e.big ? 6 : 3);
          break;
        case "hit":
          if (!reducedMotion && parts.length < 240) {
            parts.push({ x: e.x, y: e.y, vx: 0, vy: -30, life: 0.2, color: "#9ff1ff", size: 2 });
          }
          break;
        case "gem":
          if (e.big || e.value >= 3) {
            floats.push({ x: e.x, y: e.y - 10, text: `+${e.value * 10} XP`, t: time, ttl: 0.8, color: "#20e3ff" });
          }
          break;
        case "heal":
          floats.push({ x: e.x, y: e.y - 10, text: "+30 HP", t: time, ttl: 0.9, color: "#4df77f" });
          break;
        case "hurt":
          rings.push({ x: arena.player.x, y: arena.player.y, r0: 14, r1: 44, t: time, ttl: 0.3, color: "255,59,79" });
          break;
        case "levelup":
          rings.push({ x: arena.player.x, y: arena.player.y, r0: 16, r1: 90, t: time, ttl: 0.55, color: "255,210,63" });
          break;
        case "bossdown":
          burst(e.x, e.y, "#ffd23f", 30);
          break;
      }
    }
  }

  function drawFx(dt, time) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0) {
        parts.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      g.globalAlpha = Math.min(1, p.life * 2.4);
      g.fillStyle = p.color;
      g.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      g.globalAlpha = 1;
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      const k = (time - r.t) / r.ttl;
      if (k > 1) {
        rings.splice(i, 1);
        continue;
      }
      g.strokeStyle = `rgba(${r.color},${1 - k})`;
      g.lineWidth = 3;
      g.beginPath();
      g.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * k, 0, Math.PI * 2);
      g.stroke();
    }
    g.textAlign = "center";
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
      g.fillText(f.text, f.x, f.y - k * 24);
      g.globalAlpha = 1;
    }
  }

  /* ---------------- khung hình ---------------- */

  function draw(arena, dt, time) {
    if (!staticLayer) buildStatic();
    g.clearRect(0, 0, ARENA_W, ARENA_H);
    g.drawImage(staticLayer, 0, 0, ARENA_W, ARENA_H);

    for (const gem of arena.gems.items) if (gem.alive) drawGem(gem, time);
    for (const b of arena.bolts.items) if (b.alive) drawBolt(b);
    for (const e of arena.enemies.items) if (e.alive) drawEnemy(e, time);
    for (const b of arena.ebolts.items) if (b.alive) drawEbolt(b, time);
    drawOrbits(arena.player, time);
    drawPlayer(arena.player, time);
    drawFx(dt, time);

    // viền đỏ khi máu thấp
    if (arena.player.hp <= 30 && !arena.over) {
      const a = 0.16 + Math.sin(time * 5) * 0.08;
      const grad = g.createRadialGradient(ARENA_W / 2, ARENA_H / 2, ARENA_H / 3, ARENA_W / 2, ARENA_H / 2, ARENA_H / 1.1);
      grad.addColorStop(0, "rgba(255,40,60,0)");
      grad.addColorStop(1, `rgba(255,40,60,${a})`);
      g.fillStyle = grad;
      g.fillRect(0, 0, ARENA_W, ARENA_H);
    }
  }

  return { draw, addEvents };
}

/** Icon nâng cấp cho card level-up + chỉ báo kỹ năng (canvas nhỏ). */
export function paintUpgradeIcon(canvas, id, tone) {
  const size = 34;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  const g = canvas.getContext("2d");
  g.scale(dpr, dpr);
  const colors = {
    cyan: "#20e3ff", pink: "#ff2e96", violet: "#9a5cff",
    lime: "#a8ff3e", green: "#4df77f", gold: "#ffd23f",
  };
  const c = colors[tone] || "#20e3ff";
  g.translate(size / 2, size / 2);
  g.strokeStyle = c;
  g.fillStyle = c;
  g.lineWidth = 2.4;
  g.lineJoin = "round";
  g.lineCap = "round";
  g.shadowColor = c;
  g.shadowBlur = 5;
  switch (id) {
    case "damage": // đầu đạn
      g.beginPath();
      g.moveTo(0, -10);
      g.lineTo(7, 2);
      g.lineTo(3, 2);
      g.lineTo(3, 10);
      g.lineTo(-3, 10);
      g.lineTo(-3, 2);
      g.lineTo(-7, 2);
      g.closePath();
      g.fill();
      break;
    case "firerate": // 3 vạch tốc độ
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.moveTo(-9 + i * 7, -8);
        g.lineTo(-3 + i * 7, 0);
        g.lineTo(-9 + i * 7, 8);
        g.stroke();
      }
      break;
    case "multishot": // tia sét (như ảnh TIA CHỚP)
      g.beginPath();
      g.moveTo(3, -11);
      g.lineTo(-6, 2);
      g.lineTo(-0.5, 2);
      g.lineTo(-3, 11);
      g.lineTo(6, -2);
      g.lineTo(0.5, -2);
      g.closePath();
      g.fill();
      break;
    case "pierce": // 4 mũi tên tỏa (như ảnh LAN TỎA)
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        g.beginPath();
        g.moveTo(dx * 3, dy * 3);
        g.lineTo(dx * 10, dy * 10);
        g.stroke();
        g.beginPath();
        g.moveTo(dx * 10 + (dy - dx) * 3.4, dy * 10 + (-dx - dy) * 3.4);
        g.lineTo(dx * 12, dy * 12);
        g.lineTo(dx * 10 + (-dy - dx) * 3.4, dy * 10 + (dx - dy) * 3.4);
        g.stroke();
      }
      break;
    case "speed": // chevron đôi (như ảnh TỐC ĐỘ)
      for (let i = 0; i < 2; i++) {
        g.beginPath();
        g.moveTo(-8, 6 - i * 8);
        g.lineTo(0, -1 - i * 8 + 4);
        g.lineTo(8, 6 - i * 8);
        g.stroke();
      }
      break;
    case "maxhp": // khiên
      g.beginPath();
      g.moveTo(0, -10);
      g.lineTo(9, -6);
      g.lineTo(9, 2);
      g.quadraticCurveTo(9, 9, 0, 12);
      g.quadraticCurveTo(-9, 9, -9, 2);
      g.lineTo(-9, -6);
      g.closePath();
      g.stroke();
      g.fillRect(-1.5, -5, 3, 8);
      g.fillRect(-4.5, -2, 9, 3);
      break;
    case "magnet": // nam châm chữ U
      g.beginPath();
      g.arc(0, -1, 7.5, Math.PI, 0, false);
      g.moveTo(-7.5, -1);
      g.lineTo(-7.5, 8);
      g.moveTo(7.5, -1);
      g.lineTo(7.5, 8);
      g.stroke();
      g.fillRect(-9.5, 6, 4, 4);
      g.fillRect(5.5, 6, 4, 4);
      break;
    case "orbit": // quỹ đạo + vệ tinh
      g.beginPath();
      g.ellipse(0, 0, 10, 5.5, -0.5, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.arc(0, 0, 3.4, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.arc(8, -4, 2.6, 0, Math.PI * 2);
      g.fill();
      break;
    default: // repair — cờ lê đơn giản
      g.beginPath();
      g.arc(-4, -4, 5, 0.5, Math.PI * 1.6);
      g.stroke();
      g.beginPath();
      g.moveTo(-1, -1);
      g.lineTo(8, 8);
      g.stroke();
      break;
  }
}
