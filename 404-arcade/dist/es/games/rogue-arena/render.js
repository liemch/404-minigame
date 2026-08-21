/**
 * render.js — vẽ Rogue Arena theo ảnh reference: sàn đấu tối với vòng
 * tròn đồng tâm giữa, khung tường + dải neon góc hồng/cyan, robot trắng
 * mắt cyan, tia điện xanh tỏa ra, enemy hình học neon (tam giác hồng /
 * khối đỏ có tâm ngắm / khối tím), gem XP kim cương xanh, hex XP lime,
 * hex hồi máu, boss kim tự tháp đỏ, chữ nổi "+N XP".
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

    // sàn
    const bg = s.createRadialGradient(ARENA_W / 2, ARENA_H / 2, 80, ARENA_W / 2, ARENA_H / 2, 720);
    bg.addColorStop(0, "#0d1330");
    bg.addColorStop(1, "#060a1c");
    s.fillStyle = bg;
    s.fillRect(0, 0, ARENA_W, ARENA_H);

    // lưới mờ
    s.strokeStyle = "rgba(90, 110, 200, 0.07)";
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

    // vòng tròn đồng tâm giữa sàn (như ảnh)
    s.strokeStyle = "rgba(100, 140, 255, 0.12)";
    s.lineWidth = 2;
    for (const r of [70, 120, 170]) {
      s.beginPath();
      s.arc(ARENA_W / 2, ARENA_H / 2, r, 0, Math.PI * 2);
      s.stroke();
    }
    s.strokeStyle = "rgba(100, 140, 255, 0.1)";
    s.beginPath();
    s.moveTo(ARENA_W / 2 - 190, ARENA_H / 2);
    s.lineTo(ARENA_W / 2 + 190, ARENA_H / 2);
    s.moveTo(ARENA_W / 2, ARENA_H / 2 - 190);
    s.lineTo(ARENA_W / 2, ARENA_H / 2 + 190);
    s.stroke();

    // tường
    s.fillStyle = "#0a0e22";
    s.fillRect(0, 0, ARENA_W, WALL);
    s.fillRect(0, ARENA_H - WALL, ARENA_W, WALL);
    s.fillRect(0, 0, WALL, ARENA_H);
    s.fillRect(ARENA_W - WALL, 0, WALL, ARENA_H);
    s.strokeStyle = "rgba(110, 130, 210, 0.35)";
    s.lineWidth = 2;
    s.strokeRect(WALL, WALL, ARENA_W - WALL * 2, ARENA_H - WALL * 2);
    // vạch kỹ thuật trên tường
    s.fillStyle = "rgba(110,130,210,0.2)";
    for (let x = 60; x < ARENA_W - 60; x += 120) {
      s.fillRect(x, WALL / 2 - 2, 34, 4);
      s.fillRect(x, ARENA_H - WALL / 2 - 2, 34, 4);
    }

    // dải neon góc: trái hồng, phải cyan (như ảnh)
    const corner = (x, y, dx, dy, color) => {
      s.strokeStyle = color;
      s.lineWidth = 5;
      s.beginPath();
      s.moveTo(x + dx * 130, y);
      s.lineTo(x, y);
      s.lineTo(x, y + dy * 130);
      s.stroke();
      s.strokeStyle = color.replace("1)", "0.35)");
      s.lineWidth = 11;
      s.beginPath();
      s.moveTo(x + dx * 130, y);
      s.lineTo(x, y);
      s.lineTo(x, y + dy * 130);
      s.stroke();
    };
    corner(WALL + 6, WALL + 6, 1, 1, "rgba(255,46,150,1)");
    corner(WALL + 6, ARENA_H - WALL - 6, 1, -1, "rgba(255,46,150,1)");
    corner(ARENA_W - WALL - 6, WALL + 6, -1, 1, "rgba(32,227,255,1)");
    corner(ARENA_W - WALL - 6, ARENA_H - WALL - 6, -1, -1, "rgba(32,227,255,1)");
  }

  /* ---------------- entity painter ---------------- */

  function drawPlayer(p, time) {
    g.save();
    g.translate(p.x, p.y);
    // vòng sáng dưới chân
    g.strokeStyle = "rgba(32,227,255,0.35)";
    g.lineWidth = 2;
    g.beginPath();
    g.arc(0, 6, 20, 0, Math.PI * 2);
    g.stroke();
    // nhấp nháy khi bất tử
    if (p.ifr > 0 && Math.floor(time * 14) % 2 === 0) g.globalAlpha = 0.45;
    const bob = Math.sin(time * 5) * 1.4;
    g.translate(0, bob);
    // chân
    g.fillStyle = "#8f9ec4";
    g.fillRect(-8, 8, 6, 7);
    g.fillRect(2, 8, 6, 7);
    // thân trắng
    g.fillStyle = "#e8edff";
    g.beginPath();
    g.roundRect(-11, -12, 22, 22, 6);
    g.fill();
    // vai
    g.fillStyle = "#b9c3de";
    g.fillRect(-15, -6, 5, 10);
    g.fillRect(10, -6, 5, 10);
    // visor cyan
    g.fillStyle = "#0a1224";
    g.beginPath();
    g.roundRect(-7, -8, 14, 8, 3);
    g.fill();
    g.save();
    g.shadowColor = "#20e3ff";
    g.shadowBlur = 8;
    g.fillStyle = "#20e3ff";
    g.fillRect(-5, -6, 10, 3.4);
    g.restore();
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
      g.shadowBlur = 10;
      g.fillStyle = "#b98cff";
      g.beginPath();
      g.arc(ox, oy, 8, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#eadffd";
      g.beginPath();
      g.arc(ox - 2, oy - 2, 3, 0, Math.PI * 2);
      g.fill();
      g.restore();
      void time;
    }
  }

  function drawEnemy(e, time) {
    g.save();
    g.translate(e.x, e.y);
    const flash = e.hitFlash > 0;

    if (e.type === "chaser") {
      const a = Math.atan2(0, 1);
      void a;
      g.rotate(Math.sin(time * 3 + e.id) * 0.15);
      g.fillStyle = flash ? "#ffd7ec" : "#3d1030";
      g.strokeStyle = "#ff2e96";
      g.lineWidth = 2.4;
      g.beginPath();
      g.moveTo(0, -e.r);
      g.lineTo(e.r * 0.95, e.r * 0.75);
      g.lineTo(-e.r * 0.95, e.r * 0.75);
      g.closePath();
      g.fill();
      g.stroke();
      g.strokeStyle = "rgba(255,46,150,0.6)";
      g.beginPath();
      g.moveTo(0, -e.r * 0.5);
      g.lineTo(e.r * 0.45, e.r * 0.45);
      g.lineTo(-e.r * 0.45, e.r * 0.45);
      g.closePath();
      g.stroke();
    } else if (e.type === "shooter") {
      g.rotate(Math.sin(time * 2 + e.id) * 0.1);
      g.fillStyle = flash ? "#ffe2e2" : "#38080c";
      g.strokeStyle = "#ff3b4f";
      g.lineWidth = 2.4;
      g.beginPath();
      g.roundRect(-e.r, -e.r, e.r * 2, e.r * 2, 4);
      g.fill();
      g.stroke();
      // icon tâm ngắm (như ảnh)
      g.strokeStyle = "#ff8091";
      g.lineWidth = 1.8;
      g.beginPath();
      g.arc(0, 0, e.r * 0.5, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.arc(0, 0, e.r * 0.18, 0, Math.PI * 2);
      g.stroke();
    } else if (e.type === "tank") {
      g.fillStyle = flash ? "#f0e2ff" : "#241040";
      g.strokeStyle = "#9a5cff";
      g.lineWidth = 3;
      g.beginPath();
      g.roundRect(-e.r, -e.r, e.r * 2, e.r * 2, 5);
      g.fill();
      g.stroke();
      g.strokeStyle = "rgba(154,92,255,0.55)";
      g.lineWidth = 2;
      g.strokeRect(-e.r * 0.55, -e.r * 0.55, e.r * 1.1, e.r * 1.1);
      g.fillStyle = "#c9a6ff";
      g.beginPath();
      g.arc(0, 0, 3.4, 0, Math.PI * 2);
      g.fill();
    } else if (e.type === "boss") {
      g.rotate(Math.sin(time * 1.6) * 0.08);
      g.save();
      g.shadowColor = "#ff3b4f";
      g.shadowBlur = 22;
      g.fillStyle = flash ? "#ffd7d7" : "#3c0a12";
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
      // thanh máu boss
      const w = 90;
      g.fillStyle = "rgba(8,8,16,0.85)";
      g.fillRect(-w / 2, -e.r - 18, w, 7);
      g.fillStyle = "#ff3b4f";
      g.fillRect(-w / 2 + 1, -e.r - 17, (w - 2) * Math.max(0, e.hp / e.maxHp), 5);
    }

    // thanh máu nhỏ (trừ boss đã có)
    if (e.type !== "boss" && e.hp < e.maxHp) {
      const w = e.r * 1.7;
      g.fillStyle = "rgba(8,8,16,0.8)";
      g.fillRect(-w / 2, -e.r - 9, w, 3.4);
      g.fillStyle = "#ff3b4f";
      g.fillRect(-w / 2, -e.r - 9, w * Math.max(0, e.hp / e.maxHp), 3.4);
    }
    g.restore();
  }

  function drawBolt(b) {
    const a = Math.atan2(b.vy, b.vx);
    g.save();
    g.translate(b.x, b.y);
    g.rotate(a);
    g.fillStyle = "rgba(32,227,255,0.28)";
    g.beginPath();
    g.ellipse(-6, 0, 13, 4.5, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#9ff1ff";
    g.beginPath();
    g.ellipse(0, 0, 8, 2.6, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  function drawEbolt(b, time) {
    g.save();
    g.translate(b.x, b.y);
    g.fillStyle = "rgba(255,59,110,0.32)";
    g.beginPath();
    g.arc(0, 0, 7 + Math.sin(time * 12) * 1, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#ff5d7d";
    g.beginPath();
    g.arc(0, 0, 3.6, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  function drawGem(gem, time) {
    g.save();
    g.translate(gem.x, gem.y + Math.sin(time * 4 + gem.x) * 2);
    if (gem.heal) {
      // hex hồi máu xanh lá (như ảnh)
      g.strokeStyle = "#4df77f";
      g.fillStyle = "rgba(10,40,20,0.9)";
      g.lineWidth = 2;
      hexPath(12);
      g.fill();
      g.stroke();
      g.fillStyle = "#4df77f";
      g.fillRect(-1.8, -6, 3.6, 12);
      g.fillRect(-6, -1.8, 12, 3.6);
    } else if (gem.big) {
      // hex XP lime (như ảnh)
      g.strokeStyle = "#a8ff3e";
      g.fillStyle = "rgba(30,46,8,0.92)";
      g.lineWidth = 2;
      hexPath(13);
      g.fill();
      g.stroke();
      g.fillStyle = "#a8ff3e";
      g.font = "800 9px 'JetBrains Mono', monospace";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("XP", 0, 0.5);
    } else {
      // kim cương xanh
      const c = gem.value >= 3 ? "#7dc4ff" : "#20e3ff";
      g.fillStyle = c;
      g.beginPath();
      g.moveTo(0, -7);
      g.lineTo(5, 0);
      g.lineTo(0, 7);
      g.lineTo(-5, 0);
      g.closePath();
      g.fill();
      g.fillStyle = "rgba(255,255,255,0.7)";
      g.beginPath();
      g.moveTo(0, -7);
      g.lineTo(5, 0);
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
      if (parts.length > 230) break;
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 160;
      parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5, color, size: 2 + Math.random() * 2 });
    }
  }

  function addEvents(events, arena, time) {
    for (const e of events) {
      switch (e.type) {
        case "kill":
          burst(e.x, e.y, e.big ? "#ff3b4f" : "#ff2e96", e.big ? 16 : 8);
          break;
        case "hit":
          if (!reducedMotion && parts.length < 220) {
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
          burst(e.x, e.y, "#ffd23f", 26);
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
