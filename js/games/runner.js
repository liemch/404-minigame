/**
 * runner.js — Endless Runner.
 * Nhân vật tự chạy qua thành phố neon; Space / ↑ / W / chạm để nhảy.
 * Né chướng ngại vật, thu thập tinh thể (+25đ). Tốc độ tăng dần có giới hạn.
 */

import { createCanvas } from "../core/canvas.js";
import { createLoop } from "../core/loop.js";
import { createKeyboard, onPointerDown, holdTracker } from "../core/input.js";
import { createHud } from "../core/hud.js";
import { clamp, randRange, formatScore, seededRand } from "../core/utils.js";

const GRAVITY = 2500;
const JUMP_V = -930;
const JUMP_CUT = 2600; // trọng lực bổ sung khi nhả nút sớm (nhảy thấp)
const SPEED_MIN = 330;
const SPEED_MAX = 750;
const MONO = '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace';

export function createGame() {
  let opts = null;
  let view = null;
  let ctx = null;
  let W = 0;
  let H = 0;
  let groundY = 0;
  let keys = null;
  let offPointer = null;
  let hold = null;
  let hud = null;
  let loop = null;

  let phase = "idle"; // idle | run | die | over
  let paused = false;

  let player;
  let obstacles;
  let coins;
  let particles;
  let texts;
  let speed;
  let score;
  let best;
  let dist;
  let elapsed;
  let obstacleGap;
  let coinGap;
  let dieT;
  let flashT;
  let shakeT;
  let dustT;

  let stars = [];
  let layers = [];
  let skyGrad = null;

  /* ---------- Sinh cảnh nền (một lần khi mount) ---------- */

  function buildBackground() {
    const rand = seededRand(2024);
    stars = [];
    for (let i = 0; i < 46; i++) {
      stars.push({
        x: rand() * W,
        y: rand() * (groundY - 130),
        r: 0.6 + rand() * 1.4,
        tw: rand() * Math.PI * 2,
        cyan: rand() > 0.75,
      });
    }

    // Hai lớp nhà cao tầng với parallax khác nhau
    layers = [
      { color: "#120e35", parallax: 0.22, minH: 90, maxH: 190, buildings: [] },
      { color: "#1c1548", parallax: 0.45, minH: 50, maxH: 130, buildings: [] },
    ];
    for (const layer of layers) {
      let x = 0;
      while (x < W) {
        const bw = 34 + rand() * 60;
        const bh = layer.minH + rand() * (layer.maxH - layer.minH);
        const windows = [];
        for (let wy = 8; wy < bh - 8; wy += 12) {
          for (let wx = 5; wx < bw - 7; wx += 10) {
            if (rand() > 0.78) {
              windows.push({ wx, wy, cyan: rand() > 0.5 });
            }
          }
        }
        layer.buildings.push({ x, w: bw, h: bh, windows });
        x += bw + 6 + rand() * 16;
      }
    }

    skyGrad = ctx.createLinearGradient(0, 0, 0, H);
    skyGrad.addColorStop(0, "#241150");
    skyGrad.addColorStop(0.6, "#171040");
    skyGrad.addColorStop(1, "#0d0b28");
  }

  /* ---------- Vòng đời ---------- */

  function reset() {
    player = {
      x: Math.round(W * 0.15),
      y: groundY - 40,
      w: 32,
      h: 40,
      vy: 0,
      grounded: true,
      coyote: 0,
      buffer: 0,
      rot: 0,
    };
    obstacles = [];
    coins = [];
    particles = [];
    texts = [];
    speed = SPEED_MIN;
    score = 0;
    best = opts.getBest();
    dist = 0;
    elapsed = 0;
    obstacleGap = 620; // quãng đường tới vật cản đầu tiên
    coinGap = 380;
    dieT = 0;
    flashT = 0;
    shakeT = 0;
    dustT = 0;
    hud.set("score", formatScore(0));
    hud.set("best", formatScore(best));
  }

  function jumpInput() {
    if (phase !== "run" || paused) return;
    player.buffer = 0.12; // đệm phím: nhấn sớm một chút vẫn nhảy khi chạm đất
  }

  function die() {
    phase = "die";
    dieT = 0.62;
    flashT = 0.16;
    if (!opts.reducedMotion) shakeT = 0.35;
    player.vy = -430; // bật nhẹ lên khi trúng vật cản
    player.grounded = false;
    opts.audio.play("hit");
    burst(player.x + player.w / 2, player.y + player.h / 2, 16, ["#3be8ff", "#ff58c7", "#edf1ff"]);
  }

  /* ---------- Spawn ---------- */

  function spawnObstacle() {
    const roll = Math.random();
    let obstacle;
    if (speed > 430 && roll < 0.18) {
      obstacle = { type: "dspike", x: W + 80, w: 64, h: 30 };
    } else if (roll < 0.5) {
      obstacle = { type: "spike", x: W + 80, w: 34, h: 32 };
    } else if (roll < 0.78) {
      obstacle = { type: "spike", x: W + 80, w: 30, h: 42 };
    } else {
      obstacle = { type: "block", x: W + 80, w: 28, h: 56 };
    }
    obstacle.y = groundY - obstacle.h;
    obstacles.push(obstacle);
    const minGap = clamp(speed * 0.55, 250, 480);
    obstacleGap = randRange(minGap, minGap + 280);
  }

  function spawnCoins() {
    let baseY = groundY - randRange(85, 160);
    // Nếu vừa có vật cản mọc gần vị trí spawn thì đẩy tinh thể lên cao
    const conflict = obstacles.some((o) => o.x > W - 40 && o.x < W + 220);
    if (conflict) baseY = groundY - 168;
    for (let i = 0; i < 3; i++) {
      coins.push({
        x: W + 80 + i * 38,
        y: baseY - Math.sin((i / 2) * Math.PI) * 12,
        r: 9,
        phase: i * 0.7,
      });
    }
    coinGap = randRange(520, 1050);
  }

  function burst(x, y, count, colors) {
    const total = opts.reducedMotion ? Math.ceil(count / 2) : count;
    for (let i = 0; i < total; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = randRange(60, 260);
      particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 60,
        life: randRange(0.3, 0.6),
        t: 0,
        size: randRange(2, 5),
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }

  /* ---------- Cập nhật ---------- */

  function update(dt) {
    elapsed += dt;

    if (phase === "run") {
      speed = Math.min(SPEED_MAX, SPEED_MIN + elapsed * 8.5);
      dist += speed * dt;
      if (dist > W * 840) dist -= W * 840; // giữ độ chính xác float khi chơi lâu

      score += dt * (10 + speed * 0.022);
      hud.set("score", formatScore(score));
      if (score > best) {
        best = Math.floor(score);
        hud.set("best", formatScore(best));
      }

      // --- Vật lý nhân vật ---
      player.buffer -= dt;
      player.coyote -= dt;
      if (player.buffer > 0 && (player.grounded || player.coyote > 0)) {
        player.vy = JUMP_V;
        player.grounded = false;
        player.coyote = 0;
        player.buffer = 0;
        opts.audio.play("jump");
      }
      player.vy += GRAVITY * dt;
      // Nhả nút sớm → rơi nhanh hơn → kiểm soát độ cao cú nhảy
      const held =
        keys.isDown("Space") || keys.isDown("ArrowUp") || keys.isDown("KeyW") || hold.isHeld();
      if (player.vy < 0 && !held) player.vy += JUMP_CUT * dt;

      player.y += player.vy * dt;
      if (player.y >= groundY - player.h) {
        if (!player.grounded) burst(player.x + 8, groundY - 2, 4, ["rgba(59,232,255,.7)"]);
        player.y = groundY - player.h;
        player.vy = 0;
        player.grounded = true;
        player.coyote = 0.09;
      } else if (player.grounded) {
        player.grounded = false;
        player.coyote = 0.09;
      }

      // Bụi chân khi chạy trên đất
      dustT -= dt;
      if (player.grounded && dustT <= 0 && !opts.reducedMotion) {
        dustT = 0.08;
        particles.push({
          x: player.x + 2,
          y: groundY - 3,
          vx: -randRange(40, 90),
          vy: -randRange(10, 50),
          life: 0.35,
          t: 0,
          size: 2.5,
          color: "rgba(59,232,255,.5)",
        });
      }

      // --- Spawn theo quãng đường ---
      obstacleGap -= speed * dt;
      if (obstacleGap <= 0) spawnObstacle();
      coinGap -= speed * dt;
      if (coinGap <= 0) spawnCoins();

      // --- Va chạm ---
      const px = player.x + 5;
      const py = player.y + 4;
      const pw = player.w - 10;
      const ph = player.h - 8;
      for (const o of obstacles) {
        // Hitbox thu nhỏ cho gai (hình tam giác) để công bằng hơn
        const inset = o.type !== "block" ? 0.22 : 0.05;
        const ox = o.x + o.w * inset;
        const oy = o.y + o.h * 0.25;
        const ow = o.w * (1 - inset * 2);
        const oh = o.h * 0.75;
        if (px < ox + ow && px + pw > ox && py < oy + oh && py + ph > oy) {
          die();
          break;
        }
      }
      if (phase === "run") {
        for (const c of coins) {
          if (c.taken) continue;
          const dx = c.x - clamp(c.x, px, px + pw);
          const dy = c.y - clamp(c.y, py, py + ph);
          if (dx * dx + dy * dy < c.r * c.r * 2.4) {
            c.taken = true;
            score += 25;
            opts.audio.play("coin");
            burst(c.x, c.y, 8, ["#ffd23f", "#fff3c4"]);
            texts.push({ x: c.x, y: c.y - 14, txt: "+25", color: "#ffd23f", t: 0 });
          }
        }
      }
    }

    if (phase === "die") {
      // Nhân vật lộn nhào rơi xuống
      player.vy += GRAVITY * dt;
      player.y += player.vy * dt;
      player.x -= 55 * dt;
      player.rot += 9 * dt;
      dieT -= dt;
      if (dieT <= 0) {
        phase = "over";
        loop.stop();
        render();
        opts.onGameOver(Math.floor(score));
        return;
      }
    }

    // Vật thể trôi về bên trái theo tốc độ nền
    const move = (phase === "run" ? speed : speed * 0.25) * dt;
    for (const o of obstacles) o.x -= move;
    for (const c of coins) {
      c.x -= move;
      c.phase += dt * 5;
    }
    obstacles = obstacles.filter((o) => o.x > -120);
    coins = coins.filter((c) => c.x > -40 && !c.taken);

    for (const p of particles) {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 500 * dt;
    }
    particles = particles.filter((p) => p.t < p.life);

    for (const t of texts) t.t += dt;
    texts = texts.filter((t) => t.t < 0.8);

    flashT = Math.max(0, flashT - dt);
    shakeT = Math.max(0, shakeT - dt);

    render();
  }

  /* ---------- Vẽ ---------- */

  function drawBackground() {
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);

    for (const s of stars) {
      const a = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(elapsed * 2 + s.tw));
      ctx.fillStyle = s.cyan ? `rgba(59,232,255,${a})` : `rgba(237,241,255,${a})`;
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }

    // Mặt trời synthwave
    const sunX = W * 0.72;
    const sunY = 105;
    const sunR = 52;
    const sun = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
    sun.addColorStop(0, "#ffd23f");
    sun.addColorStop(1, "#ff58c7");
    ctx.save();
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = sun;
    ctx.fillRect(sunX - sunR, sunY - sunR, sunR * 2, sunR * 2);
    ctx.fillStyle = "#171040";
    for (let i = 0; i < 5; i++) ctx.fillRect(sunX - sunR, sunY + 6 + i * 11, sunR * 2, 4);
    ctx.restore();

    // Nhà cao tầng (2 lớp parallax)
    for (const layer of layers) {
      const off = (dist * layer.parallax) % W;
      for (const pass of [0, 1]) {
        ctx.save();
        ctx.translate(pass * W - off, 0);
        for (const b of layer.buildings) {
          ctx.fillStyle = layer.color;
          ctx.fillRect(b.x, groundY - b.h, b.w, b.h);
          for (const w of b.windows) {
            ctx.fillStyle = w.cyan ? "rgba(59,232,255,.4)" : "rgba(255,210,63,.32)";
            ctx.fillRect(b.x + w.wx, groundY - b.h + w.wy, 3, 4);
          }
        }
        ctx.restore();
      }
    }

    // Mặt đường
    ctx.fillStyle = "#0a0820";
    ctx.fillRect(0, groundY, W, H - groundY);
    ctx.fillStyle = "rgba(59,232,255,.28)";
    ctx.fillRect(0, groundY - 1, W, 4);
    ctx.fillStyle = "#3be8ff";
    ctx.fillRect(0, groundY, W, 2);
    // Vạch kẻ trôi theo tốc độ
    ctx.fillStyle = "rgba(59,232,255,.22)";
    const tickOff = dist % 48;
    for (let x = -tickOff; x < W; x += 48) {
      ctx.fillRect(x, groundY + 12, 18, 2);
    }
    ctx.fillStyle = "rgba(59,232,255,.08)";
    ctx.fillRect(0, groundY + 26, W, 1);
  }

  function drawObstacle(o) {
    if (o.type === "block") {
      ctx.fillStyle = "#b07bff";
      ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.fillStyle = "rgba(255,255,255,.3)";
      ctx.fillRect(o.x, o.y, o.w, 4);
      ctx.fillStyle = "rgba(5,7,15,.4)";
      for (let y = o.y + 12; y < o.y + o.h; y += 12) ctx.fillRect(o.x, y, o.w, 3);
      return;
    }
    const spikes = o.type === "dspike" ? 2 : 1;
    const sw = o.w / spikes;
    for (let i = 0; i < spikes; i++) {
      const sx = o.x + i * sw;
      ctx.fillStyle = "#ff58c7";
      ctx.beginPath();
      ctx.moveTo(sx, o.y + o.h);
      ctx.lineTo(sx + sw / 2, o.y);
      ctx.lineTo(sx + sw, o.y + o.h);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(5,7,15,.45)";
      ctx.beginPath();
      ctx.moveTo(sx + sw * 0.28, o.y + o.h);
      ctx.lineTo(sx + sw / 2, o.y + o.h * 0.34);
      ctx.lineTo(sx + sw * 0.72, o.y + o.h);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawCoin(c) {
    const s = 0.55 + 0.45 * Math.abs(Math.sin(c.phase));
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.scale(s, 1);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = "#ffd23f";
    ctx.fillRect(-7, -7, 14, 14);
    ctx.fillStyle = "rgba(255,255,255,.7)";
    ctx.fillRect(-7, -7, 5, 5);
    ctx.restore();
  }

  function drawPlayer() {
    const { x, y, w, h } = player;
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(player.rot);

    // Chân (2 nhịp khi chạy, co lại khi bay)
    ctx.fillStyle = "#22b8cf";
    if (player.grounded && phase === "run") {
      const step = Math.sin(dist * 0.06);
      ctx.fillRect(-10 + step * 4, h / 2 - 10, 7, 10);
      ctx.fillRect(3 - step * 4, h / 2 - 10, 7, 10);
    } else {
      ctx.fillRect(-10, h / 2 - 8, 7, 7);
      ctx.fillRect(3, h / 2 - 8, 7, 7);
    }

    // Thân robot
    ctx.fillStyle = "#3be8ff";
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h - 8, 5);
    ctx.fill();
    // Kính che mặt + mắt
    ctx.fillStyle = "#061018";
    ctx.fillRect(-w / 2 + 5, -h / 2 + 8, w - 10, 9);
    ctx.fillStyle = "#eafcff";
    ctx.fillRect(w / 2 - 13, -h / 2 + 10, 5, 5);
    // Đèn ăng-ten
    ctx.fillStyle = "#ff58c7";
    ctx.fillRect(-2, -h / 2 - 5, 4, 5);
    ctx.restore();
  }

  function render() {
    ctx.save();
    if (shakeT > 0) {
      const power = shakeT * 16;
      ctx.translate(randRange(-power, power), randRange(-power, power));
    }

    drawBackground();
    for (const c of coins) drawCoin(c);
    for (const o of obstacles) drawObstacle(o);

    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    drawPlayer();

    ctx.font = `700 15px ${MONO}`;
    ctx.textAlign = "center";
    for (const t of texts) {
      ctx.globalAlpha = Math.max(0, 1 - t.t / 0.8);
      ctx.fillStyle = t.color;
      ctx.fillText(t.txt, t.x, t.y - t.t * 42);
    }
    ctx.globalAlpha = 1;

    if (flashT > 0) {
      ctx.fillStyle = `rgba(255,255,255,${(flashT / 0.16) * 0.5})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  /* ---------- Interface vòng đời chuẩn ---------- */

  return {
    mount(container, options) {
      opts = options;
      // Màn hình hẹp (mobile dọc) dùng khung vuông hơn cho dễ nhìn
      const compact = container.clientWidth > 0 && container.clientWidth < 560;
      W = compact ? 720 : 960;
      H = compact ? 470 : 420;
      groundY = H - 76;

      view = createCanvas(container, { width: W, height: H });
      ctx = view.ctx;

      hud = createHud(options.hudRoot);
      hud.addStat({ id: "score", label: "Điểm", accent: "cyan" });
      hud.addStat({ id: "best", label: "Kỷ lục", accent: "violet", small: true });

      keys = createKeyboard();
      keys.on(["Space", "ArrowUp", "KeyW"], jumpInput);
      offPointer = onPointerDown(view.canvas, jumpInput);
      hold = holdTracker(view.canvas);

      loop = createLoop(update);
      buildBackground();
      reset();
      render(); // khung hình tĩnh phía sau overlay hướng dẫn
    },

    start() {
      if (phase === "run") return;
      reset();
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
      phase = "run";
      loop.start();
    },

    destroy() {
      loop.stop();
      keys.destroy();
      offPointer();
      hold.off();
      hud.destroy();
      view.destroy();
      phase = "idle";
    },
  };
}
