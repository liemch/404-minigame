/**
 * snake.js — Snake.
 * Điều khiển bằng mũi tên / WASD, vuốt hoặc d-pad trên cảm ứng.
 * Ăn táo để dài ra (+10đ × cấp); mỗi 5 quả lên cấp và tăng tốc.
 * Đâm tường hoặc tự cắn thân → kết thúc. Không cho đảo ngược hướng.
 */

import { createCanvas } from "../core/canvas.js";
import { createLoop } from "../core/loop.js";
import { createKeyboard, onSwipe } from "../core/input.js";
import { createHud } from "../core/hud.js";
import { formatScore, svgIcon } from "../core/utils.js";

const COLS = 21;
const ROWS = 21;
const CELL = 26;
const PAD = 12;
const BASE_INTERVAL = 0.155; // giây mỗi bước ở cấp 1
const MONO = '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace';

const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export function createGame() {
  let opts = null;
  let view = null;
  let ctx = null;
  let W = 0;
  let H = 0;
  let keys = null;
  let offSwipe = null;
  let dpadCleanups = [];
  let hud = null;
  let loop = null;

  let phase = "idle"; // idle | run | die | over
  let paused = false;

  let snake;    // mảng ô, phần tử 0 là ĐUÔI, cuối là ĐẦU
  let dir;      // hướng hiện tại
  let pending;  // hàng đợi hướng người chơi vừa bấm
  let food;
  let eaten;
  let score;
  let best;
  let acc;      // tích lũy thời gian cho bước di chuyển
  let dieT;
  let elapsed;
  let eatFlash; // vị trí vừa ăn để vẽ hiệu ứng
  let texts;

  const levelOf = (n) => Math.min(10, 1 + Math.floor(n / 5));
  const level = () => levelOf(eaten);
  const stepInterval = () => Math.max(0.075, BASE_INTERVAL - (level() - 1) * 0.011);

  /* ---------- Vòng đời ---------- */

  function reset() {
    snake = [
      { x: 4, y: 10 },
      { x: 5, y: 10 },
      { x: 6, y: 10 },
      { x: 7, y: 10 },
    ];
    dir = DIRS.right;
    pending = [];
    eaten = 0;
    score = 0;
    best = opts.getBest();
    acc = 0;
    dieT = 0;
    elapsed = 0;
    eatFlash = null;
    texts = [];
    spawnFood();
    hud.set("score", formatScore(0));
    hud.set("best", formatScore(best));
    hud.set("level", String(level()).padStart(2, "0"));
  }

  function spawnFood() {
    // Gom danh sách ô trống rồi chọn ngẫu nhiên — không bao giờ kẹt vô hạn
    const occupied = new Set(snake.map((c) => c.y * COLS + c.x));
    const free = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!occupied.has(y * COLS + x)) free.push({ x, y });
      }
    }
    if (free.length === 0) {
      food = null; // rắn phủ kín bàn — thắng tuyệt đối, kết thúc lượt
      finish();
      return;
    }
    food = free[Math.floor(Math.random() * free.length)];
    food.pulse = 0;
  }

  function queueDir(name) {
    if (phase !== "run" || paused) return;
    const next = DIRS[name];
    if (!next) return;
    // Giữ tối đa 2 lệnh chờ để rắn phản hồi nhạy mà không loạn
    if (pending.length < 2) pending.push(next);
  }

  function finish() {
    phase = "die";
    dieT = 0.55;
    opts.audio.play("hit");
  }

  /* ---------- Cập nhật ---------- */

  function step() {
    // Lấy lệnh hợp lệ đầu tiên (bỏ lệnh đảo ngược 180° so với hướng hiện tại)
    while (pending.length > 0) {
      const next = pending.shift();
      if (next.x === -dir.x && next.y === -dir.y) continue;
      if (next.x === dir.x && next.y === dir.y) continue;
      dir = next;
      break;
    }

    const head = snake[snake.length - 1];
    const nx = head.x + dir.x;
    const ny = head.y + dir.y;

    // Va tường
    if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) {
      finish();
      return;
    }

    const willEat = food && nx === food.x && ny === food.y;

    // Va thân (đuôi sẽ rời đi trong bước này nên không tính, trừ khi đang ăn)
    const start = willEat ? 0 : 1;
    for (let i = start; i < snake.length; i++) {
      if (snake[i].x === nx && snake[i].y === ny) {
        finish();
        return;
      }
    }

    snake.push({ x: nx, y: ny });

    if (willEat) {
      const prevLevel = level();
      eaten += 1;
      score += 10 * prevLevel;
      eatFlash = { x: nx, y: ny, t: 0 };
      opts.audio.play("eat");
      texts.push({
        x: PAD + nx * CELL + CELL / 2,
        y: PAD + ny * CELL,
        txt: `+${10 * prevLevel}`,
        color: "#4bf584",
        t: 0,
      });
      hud.set("score", formatScore(score));
      if (score > best) {
        best = score;
        hud.set("best", formatScore(best));
      }
      if (level() !== prevLevel) {
        opts.audio.play("levelup");
        hud.set("level", String(level()).padStart(2, "0"));
        texts.push({ x: W / 2, y: H / 2 - 20, txt: `CẤP ${level()}`, color: "#4bf584", t: 0, big: true });
      }
      spawnFood();
    } else {
      snake.shift(); // không ăn thì đuôi tiến lên
    }
  }

  function update(dt) {
    elapsed += dt;

    if (phase === "run") {
      acc += dt;
      const interval = stepInterval();
      while (acc >= interval && phase === "run") {
        acc -= interval;
        step();
      }
      if (food) food.pulse += dt;
    }

    if (phase === "die") {
      dieT -= dt;
      if (dieT <= 0) {
        phase = "over";
        loop.stop();
        render();
        opts.onGameOver(score);
        return;
      }
    }

    if (eatFlash) {
      eatFlash.t += dt;
      if (eatFlash.t > 0.3) eatFlash = null;
    }

    for (const t of texts) t.t += dt;
    texts = texts.filter((t) => t.t < 0.8);

    render();
  }

  /* ---------- Vẽ ---------- */

  const cellX = (gx) => PAD + gx * CELL;
  const cellY = (gy) => PAD + gy * CELL;

  function render() {
    // Nền + lưới
    ctx.fillStyle = "#07130b";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(75,245,132,.07)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(cellX(x), PAD);
      ctx.lineTo(cellX(x), H - PAD);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(PAD, cellY(y));
      ctx.lineTo(W - PAD, cellY(y));
      ctx.stroke();
    }
    // Viền bàn chơi
    ctx.strokeStyle = "rgba(75,245,132,.35)";
    ctx.lineWidth = 2;
    ctx.strokeRect(PAD - 3, PAD - 3, COLS * CELL + 6, ROWS * CELL + 6);

    // Táo (nhấp nháy theo nhịp)
    if (food) {
      const pulse = 1 + Math.sin(food.pulse * 5) * 0.1;
      const fx = cellX(food.x) + CELL / 2;
      const fy = cellY(food.y) + CELL / 2 + 1;
      ctx.fillStyle = "#ff5d6b";
      ctx.beginPath();
      ctx.arc(fx, fy, CELL * 0.36 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#4bf584";
      ctx.fillRect(fx - 1.5, fy - CELL * 0.48, 3, 6);
      ctx.fillStyle = "rgba(255,255,255,.55)";
      ctx.beginPath();
      ctx.arc(fx - 3, fy - 3, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Thân rắn: sáng dần từ đuôi lên đầu; nhấp nháy đỏ khi chết
    const dying = phase === "die" && Math.floor(dieT * 12) % 2 === 0;
    snake.forEach((cell, i) => {
      const bright = 0.4 + (i / snake.length) * 0.6;
      ctx.fillStyle = dying
        ? `rgba(255,93,107,${bright})`
        : `rgba(75,245,132,${bright.toFixed(2)})`;
      ctx.beginPath();
      ctx.roundRect(cellX(cell.x) + 2, cellY(cell.y) + 2, CELL - 4, CELL - 4, 6);
      ctx.fill();
    });

    // Đầu rắn + mắt hướng theo chiều di chuyển
    const head = snake[snake.length - 1];
    const hx = cellX(head.x);
    const hy = cellY(head.y);
    ctx.fillStyle = dying ? "#ffb3ba" : "#b9ffcb";
    ctx.beginPath();
    ctx.roundRect(hx + 1, hy + 1, CELL - 2, CELL - 2, 7);
    ctx.fill();
    ctx.fillStyle = "#061018";
    const ex = dir.x;
    const ey = dir.y;
    // Hai mắt đặt vuông góc với hướng đi
    const px = -ey;
    const py = ex;
    const c = CELL / 2;
    const eyeOff = 5.5;
    const fwd = 4;
    ctx.fillRect(hx + c + ex * fwd + px * eyeOff - 2, hy + c + ey * fwd + py * eyeOff - 2, 4, 4);
    ctx.fillRect(hx + c + ex * fwd - px * eyeOff - 2, hy + c + ey * fwd - py * eyeOff - 2, 4, 4);

    // Hiệu ứng vừa ăn
    if (eatFlash) {
      const k = eatFlash.t / 0.3;
      ctx.strokeStyle = `rgba(75,245,132,${0.7 * (1 - k)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cellX(eatFlash.x) + CELL / 2, cellY(eatFlash.y) + CELL / 2, 8 + k * 20, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Chữ nổi
    ctx.textAlign = "center";
    for (const t of texts) {
      ctx.globalAlpha = Math.max(0, 1 - t.t / 0.8);
      ctx.font = t.big ? `800 22px ${MONO}` : `700 14px ${MONO}`;
      ctx.fillStyle = t.color;
      ctx.fillText(t.txt, t.x, t.y - t.t * 36);
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- D-pad cảm ứng ---------- */

  function buildDpad(hudRoot) {
    const dpad = document.createElement("div");
    dpad.className = "dpad";
    dpad.setAttribute("aria-label", "Điều khiển cảm ứng");
    const defs = [
      ["up", "Lên", "dpad-up"],
      ["left", "Trái", "dpad-left"],
      ["right", "Phải", "dpad-right"],
      ["down", "Xuống", "dpad-down"],
    ];
    for (const [name, label, cls] of defs) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `dpad-btn ${cls}`;
      btn.setAttribute("aria-label", label);
      btn.appendChild(svgIcon("i-arrow"));
      const handler = (e) => {
        e.preventDefault();
        queueDir(name);
      };
      btn.addEventListener("pointerdown", handler);
      dpadCleanups.push(() => btn.removeEventListener("pointerdown", handler));
      dpad.appendChild(btn);
    }
    hudRoot.appendChild(dpad);
  }

  /* ---------- Interface vòng đời chuẩn ---------- */

  return {
    mount(container, options) {
      opts = options;
      W = COLS * CELL + PAD * 2;
      H = ROWS * CELL + PAD * 2;

      view = createCanvas(container, { width: W, height: H });
      ctx = view.ctx;

      hud = createHud(options.hudRoot);
      hud.addStat({ id: "score", label: "Điểm", accent: "green" });
      hud.addStat({ id: "best", label: "Kỷ lục", accent: "cyan", small: true });
      hud.addStat({ id: "level", label: "Cấp", accent: "gold", small: true, value: "01" });
      buildDpad(hud.root);

      keys = createKeyboard();
      keys.on(["ArrowUp", "KeyW"], () => queueDir("up"));
      keys.on(["ArrowDown", "KeyS"], () => queueDir("down"));
      keys.on(["ArrowLeft", "KeyA"], () => queueDir("left"));
      keys.on(["ArrowRight", "KeyD"], () => queueDir("right"));
      offSwipe = onSwipe(view.canvas, queueDir);

      loop = createLoop(update);
      reset();
      render();
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
      offSwipe();
      for (const cleanup of dpadCleanups) cleanup();
      dpadCleanups = [];
      hud.destroy();
      view.destroy();
      phase = "idle";
    },
  };
}
