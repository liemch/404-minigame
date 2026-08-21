/**
 * bug-hunter.js — Bug Hunter.
 * Bọ xuất hiện ngẫu nhiên trên "bo mạch"; click/chạm để tiêu diệt trong
 * 30 giây. 4 loại bọ với điểm/tốc độ khác nhau; bọ đỏ phát sáng TRỪ điểm.
 * Hạ liên tiếp (không trượt) để tăng chuỗi combo nhận điểm thưởng.
 */

import { createCanvas } from "../../core/canvas.js";
import { createLoop } from "../../core/loop.js";
import { onPointerDown } from "../../core/input-manager.js";
import { createHud } from "../../core/hud.js";
import { clamp, lerp, randRange, formatScore } from "../../core/utils.js";

const ROUND_TIME = 30;
const MONO = '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace';

/* Các loại bọ: điểm, tốc độ, kích thước, tuổi thọ, trọng số xuất hiện */
const BUG_TYPES = [
  { id: "green",  color: "#4bf584", points: 10,  speed: [40, 75],   r: 19, ttl: 4.6, weight: 42, danger: false },
  { id: "yellow", color: "#ffd23f", points: 25,  speed: [85, 125],  r: 17, ttl: 3.6, weight: 28, danger: false },
  { id: "blue",   color: "#3be8ff", points: 50,  speed: [135, 175], r: 14, ttl: 2.9, weight: 13, danger: false },
  { id: "red",    color: "#ff5d6b", points: -40, speed: [60, 105],  r: 19, ttl: 4.2, weight: 17, danger: true },
];
const TOTAL_WEIGHT = BUG_TYPES.reduce((sum, t) => sum + t.weight, 0);

function rollType() {
  let roll = Math.random() * TOTAL_WEIGHT;
  for (const type of BUG_TYPES) {
    roll -= type.weight;
    if (roll <= 0) return type;
  }
  return BUG_TYPES[0];
}

export function createGame() {
  let opts = null;
  let view = null;
  let ctx = null;
  let W = 0;
  let H = 0;
  let hud = null;
  let loop = null;
  let offPointer = null;

  let phase = "idle"; // idle | run | over
  let paused = false;

  let bugs;
  let particles;
  let texts;
  let rings; // hiệu ứng vòng lan khi bấm
  let score;
  let combo;
  let comboTimer;
  let timeLeft;
  let spawnTimer;
  let elapsed;

  // Tham chiếu tới vòng đếm giờ trong HUD
  let ringEl = null;
  let ringProgress = null;
  let ringNum = null;
  const RING_LEN = 2 * Math.PI * 30;

  /* ---------- HUD: vòng đếm thời gian bằng SVG ---------- */

  function buildTimeRing() {
    const NS = "http://www.w3.org/2000/svg";
    const box = document.createElement("div");
    box.className = "hud-stat";
    box.dataset.accent = "lime";

    const label = document.createElement("span");
    label.className = "hud-label";
    label.textContent = "Thời gian";
    box.appendChild(label);

    const wrap = document.createElement("div");
    wrap.className = "hud-time-ring";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 72 72");
    const track = document.createElementNS(NS, "circle");
    track.setAttribute("class", "ring-track");
    track.setAttribute("cx", "36");
    track.setAttribute("cy", "36");
    track.setAttribute("r", "30");
    const progress = document.createElementNS(NS, "circle");
    progress.setAttribute("class", "ring-progress");
    progress.setAttribute("cx", "36");
    progress.setAttribute("cy", "36");
    progress.setAttribute("r", "30");
    progress.setAttribute("transform", "rotate(-90 36 36)");
    progress.setAttribute("stroke-dasharray", String(RING_LEN));
    svg.append(track, progress);
    wrap.appendChild(svg);

    const num = document.createElement("div");
    num.className = "hud-time-num";
    num.textContent = String(ROUND_TIME);
    const unit = document.createElement("small");
    unit.textContent = "giây";
    num.appendChild(unit);
    wrap.appendChild(num);

    box.appendChild(wrap);
    hud.addCustom(box);

    ringEl = box;
    ringProgress = progress;
    ringNum = num;
  }

  function updateTimeRing() {
    const frac = clamp(timeLeft / ROUND_TIME, 0, 1);
    ringProgress.setAttribute("stroke-dashoffset", String(RING_LEN * (1 - frac)));
    // Chỉ cập nhật text node đầu (giữ nguyên <small>giây</small>)
    const secs = String(Math.max(0, Math.ceil(timeLeft)));
    if (ringNum.firstChild.nodeValue !== secs) ringNum.firstChild.nodeValue = secs;
    ringEl.classList.toggle("time-warn", timeLeft <= 10 && timeLeft > 5);
    ringEl.classList.toggle("time-danger", timeLeft <= 5);
  }

  /* ---------- Vòng đời ---------- */

  function reset() {
    bugs = [];
    particles = [];
    texts = [];
    rings = [];
    score = 0;
    combo = 0;
    comboTimer = 0;
    timeLeft = ROUND_TIME;
    spawnTimer = 0.3;
    elapsed = 0;
    hud.set("score", formatScore(0));
    hud.set("combo", "×0");
    updateTimeRing();
  }

  function spawnBug() {
    const type = rollType();
    const margin = 55;
    bugs.push({
      type,
      x: randRange(margin, W - margin),
      y: randRange(margin, H - margin),
      dir: Math.random() * Math.PI * 2,
      speed: randRange(type.speed[0], type.speed[1]),
      r: type.r,
      age: 0,
      ttl: type.ttl,
      legPhase: Math.random() * 10,
      dead: false,
      deadT: 0,
    });
  }

  function onTap(e) {
    if (phase !== "run" || paused) return;
    const { x, y } = view.pos(e);

    // Duyệt ngược để ưu tiên con bọ vẽ trên cùng
    for (let i = bugs.length - 1; i >= 0; i--) {
      const bug = bugs[i];
      if (bug.dead) continue;
      const dx = bug.x - x;
      const dy = bug.y - y;
      const slop = bug.r + 13; // nới hitbox cho dễ chạm trên mobile
      if (dx * dx + dy * dy > slop * slop) continue;

      bug.dead = true;
      bug.deadT = 0.28;

      if (bug.type.danger) {
        // Bọ đỏ: trừ điểm + mất chuỗi combo
        score = Math.max(0, score + bug.type.points);
        combo = 0;
        comboTimer = 0;
        opts.audio.play("bad");
        texts.push({ x: bug.x, y: bug.y - 18, txt: String(bug.type.points), color: "#ff5d6b", t: 0, big: true });
        splat(bug.x, bug.y, "#ff5d6b");
      } else {
        combo += 1;
        comboTimer = 2.5;
        const bonus = Math.min(50, (combo - 1) * 5); // thưởng chuỗi, có trần
        const total = bug.type.points + bonus;
        score += total;
        opts.audio.play(combo > 0 && combo % 5 === 0 ? "combo" : "squash");
        texts.push({ x: bug.x, y: bug.y - 18, txt: `+${total}`, color: bug.type.color, t: 0 });
        if (combo >= 5 && combo % 5 === 0) {
          texts.push({ x: W / 2, y: H / 2 - 30, txt: `COMBO ×${combo}!`, color: "#ffd23f", t: 0, big: true });
        }
        splat(bug.x, bug.y, bug.type.color);
      }

      hud.set("score", formatScore(score));
      hud.set("combo", `×${combo}`);
      return;
    }

    // Bấm hụt: mất chuỗi combo + vòng lan báo hiệu
    combo = 0;
    comboTimer = 0;
    hud.set("combo", "×0");
    rings.push({ x, y, t: 0 });
  }

  function splat(x, y, color) {
    const count = opts.reducedMotion ? 5 : 10;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = randRange(50, 220);
      particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: randRange(0.25, 0.5),
        t: 0,
        size: randRange(2, 4.5),
        color,
      });
    }
  }

  /* ---------- Cập nhật ---------- */

  function update(dt) {
    elapsed += dt;

    if (phase === "run") {
      timeLeft -= dt;
      updateTimeRing();
      if (timeLeft <= 0) {
        timeLeft = 0;
        phase = "over";
        loop.stop();
        render();
        opts.onGameOver(score);
        return;
      }

      // Combo hết hạn nếu ngừng hạ bọ quá lâu
      if (combo > 0) {
        comboTimer -= dt;
        if (comboTimer <= 0) {
          combo = 0;
          hud.set("combo", "×0");
        }
      }

      // Spawn nhanh dần về cuối trận
      spawnTimer -= dt;
      const alive = bugs.filter((b) => !b.dead).length;
      if (spawnTimer <= 0 && alive < 8) {
        spawnBug();
        const progress = 1 - timeLeft / ROUND_TIME;
        spawnTimer = lerp(0.85, 0.42, progress);
      }

      // Bọ bò lang thang, chạm mép thì quay đầu
      for (const bug of bugs) {
        if (bug.dead) {
          bug.deadT -= dt;
          continue;
        }
        bug.age += dt;
        bug.legPhase += dt * bug.speed * 0.3;
        bug.dir += randRange(-1.4, 1.4) * dt;
        bug.x += Math.cos(bug.dir) * bug.speed * dt;
        bug.y += Math.sin(bug.dir) * bug.speed * dt;
        const m = 30;
        if (bug.x < m) { bug.x = m; bug.dir = Math.PI - bug.dir; }
        if (bug.x > W - m) { bug.x = W - m; bug.dir = Math.PI - bug.dir; }
        if (bug.y < m) { bug.y = m; bug.dir = -bug.dir; }
        if (bug.y > H - m) { bug.y = H - m; bug.dir = -bug.dir; }
      }
      // Xóa bọ đã bị đập xong animation hoặc hết tuổi thọ (tự chui xuống đất)
      bugs = bugs.filter((b) => (b.dead ? b.deadT > 0 : b.age < b.ttl));
    }

    for (const p of particles) {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.98;
      p.vy *= 0.98;
    }
    particles = particles.filter((p) => p.t < p.life);

    for (const t of texts) t.t += dt;
    texts = texts.filter((t) => t.t < 0.85);

    for (const r of rings) r.t += dt;
    rings = rings.filter((r) => r.t < 0.3);

    render();
  }

  /* ---------- Vẽ ---------- */

  function drawBoard() {
    ctx.fillStyle = "#0c1322";
    ctx.fillRect(0, 0, W, H);

    // Lưới "bo mạch"
    ctx.strokeStyle = "rgba(200,245,66,.06)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y <= H; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // Bốn góc ngoặc trang trí
    ctx.strokeStyle = "rgba(200,245,66,.45)";
    ctx.lineWidth = 2;
    const L = 22;
    const P = 10;
    const corners = [
      [P, P, 1, 1],
      [W - P, P, -1, 1],
      [P, H - P, 1, -1],
      [W - P, H - P, -1, -1],
    ];
    for (const [cx, cy, sx, sy] of corners) {
      ctx.beginPath();
      ctx.moveTo(cx + sx * L, cy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx, cy + sy * L);
      ctx.stroke();
    }
  }

  function drawBug(bug) {
    const spawnScale = Math.min(1, bug.age / 0.22);
    const despawnScale = bug.ttl - bug.age < 0.4 ? (bug.ttl - bug.age) / 0.4 : 1;
    const scale = bug.dead ? 1 : spawnScale * Math.max(0.05, despawnScale);

    ctx.save();
    ctx.translate(bug.x, bug.y);

    if (bug.dead) {
      // Bẹp dí + mờ dần
      const k = Math.max(0, bug.deadT / 0.28);
      ctx.globalAlpha = k;
      ctx.rotate(bug.dir + Math.PI / 2);
      ctx.scale(1.25, 0.45);
    } else {
      ctx.rotate(bug.dir + Math.PI / 2);
      ctx.scale(scale, scale);
    }

    const color = bug.type.color;

    // Quầng cảnh báo của bọ đỏ (đập vào là mất điểm)
    if (bug.type.danger && !bug.dead) {
      const pulse = 0.55 + 0.45 * Math.sin(elapsed * 7 + bug.legPhase);
      ctx.fillStyle = `rgba(255,93,107,${0.13 + 0.1 * pulse})`;
      ctx.beginPath();
      ctx.arc(0, 0, bug.r + 12 + pulse * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(255,93,107,${0.4 + 0.3 * pulse})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, bug.r + 10, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Chân co duỗi theo nhịp bò
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    for (let i = -1; i <= 1; i++) {
      const swing = Math.sin(bug.legPhase + i * 1.1) * 3;
      ctx.beginPath();
      ctx.moveTo(-bug.r * 0.5, i * bug.r * 0.42);
      ctx.lineTo(-bug.r * 0.95, i * bug.r * 0.58 + swing);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(bug.r * 0.5, i * bug.r * 0.42);
      ctx.lineTo(bug.r * 0.95, i * bug.r * 0.58 - swing);
      ctx.stroke();
    }

    // Thân + đầu
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, bug.r * 0.1, bug.r * 0.62, bug.r * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -bug.r * 0.85, bug.r * 0.38, 0, Math.PI * 2);
    ctx.fill();

    // Vạch cánh + chấm
    ctx.strokeStyle = "rgba(5,7,15,.55)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -bug.r * 0.4);
    ctx.lineTo(0, bug.r * 0.9);
    ctx.stroke();
    ctx.fillStyle = "rgba(5,7,15,.4)";
    ctx.beginPath();
    ctx.arc(-bug.r * 0.28, bug.r * 0.05, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(bug.r * 0.28, bug.r * 0.35, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Mắt
    if (!bug.dead) {
      ctx.fillStyle = "#061018";
      ctx.beginPath();
      ctx.arc(-bug.r * 0.16, -bug.r * 0.95, 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(bug.r * 0.16, -bug.r * 0.95, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function render() {
    drawBoard();

    for (const bug of bugs) drawBug(bug);

    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // Vòng lan khi bấm hụt
    for (const r of rings) {
      const k = r.t / 0.3;
      ctx.strokeStyle = `rgba(200,245,66,${0.5 * (1 - k)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 6 + k * 22, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.textAlign = "center";
    for (const t of texts) {
      ctx.globalAlpha = Math.max(0, 1 - t.t / 0.85);
      ctx.font = t.big ? `800 22px ${MONO}` : `700 15px ${MONO}`;
      ctx.fillStyle = t.color;
      ctx.fillText(t.txt, t.x, t.y - t.t * 40);
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- Interface vòng đời chuẩn ---------- */

  return {
    mount(container, options) {
      opts = options;
      const compact = container.clientWidth > 0 && container.clientWidth < 560;
      W = compact ? 720 : 960;
      H = compact ? 560 : 540;

      view = createCanvas(container, { width: W, height: H, className: "crosshair" });
      ctx = view.ctx;

      hud = createHud(options.hudRoot);
      buildTimeRing();
      hud.addStat({ id: "score", label: "Điểm", accent: "cyan" });
      hud.addStat({ id: "combo", label: "Combo", accent: "gold", small: true, value: "×0" });

      offPointer = onPointerDown(view.canvas, onTap);
      loop = createLoop(update);
      reset();
      // Vài con bọ "mồi" cho khung hình giới thiệu
      for (let i = 0; i < 3; i++) spawnBug();
      render();
    },

    start() {
      if (phase === "run") return;
      reset();
      for (let i = 0; i < 3; i++) spawnBug();
      phase = "run";
      paused = false;
      loop.start();
    },

    pause() {
      if (paused || phase === "over") return;
      paused = true;
      loop.stop();
    },

    resume() {
      if (!paused) return;
      paused = false;
      if (phase !== "over") loop.start();
    },

    restart() {
      paused = false;
      reset();
      for (let i = 0; i < 3; i++) spawnBug();
      phase = "run";
      loop.start();
    },

    destroy() {
      loop.stop();
      offPointer();
      hud.destroy();
      view.destroy();
      phase = "idle";
    },
  };
}
