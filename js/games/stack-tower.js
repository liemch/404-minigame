/**
 * stack-tower.js — Stack Tower.
 * Khối trượt ngang qua lại; Click / Space / chạm để thả. Phần lệch so với
 * khối bên dưới bị cắt bỏ. Không còn phần giao nhau → thua.
 * Điểm = số tầng xếp được. Thả trùng khớp hoàn hảo giữ nguyên độ rộng.
 */

import { createCanvas } from "../core/canvas.js";
import { createLoop } from "../core/loop.js";
import { createKeyboard, onPointerDown } from "../core/input.js";
import { createHud } from "../core/hud.js";
import { lerp, randRange, formatScore, seededRand } from "../core/utils.js";

const BH = 32;            // chiều cao mỗi tầng
const BASE_W = 230;       // độ rộng khối nền
const PERFECT_EPS = 6;    // sai số được tính là "hoàn hảo"
const MIN_OVERLAP = 3;    // giao nhau nhỏ hơn mức này coi như trượt
const MONO = '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace';

export function createGame() {
  let opts = null;
  let view = null;
  let ctx = null;
  let W = 0;
  let H = 0;
  let keys = null;
  let offPointer = null;
  let hud = null;
  let loop = null;

  let phase = "idle"; // idle | run | die | over
  let paused = false;

  let blocks;    // các tầng đã đặt: {x, w, y(world), hue}
  let mover;     // khối đang trượt: {x, w, y, dir, speed, hue}
  let pieces;    // mảnh bị cắt đang rơi: {x, y, w, vy, vr, rot, hue}
  let particles;
  let texts;
  let floors;    // số tầng đã xếp = ĐIỂM
  let best;
  let cam;       // camera dịch dọc (screenY = worldY - cam)
  let dieT;
  let shakeT;
  let elapsed;
  let stars = [];

  const level = () => 1 + Math.floor(floors / 5);
  const moverSpeed = () => Math.min(480, 205 + floors * 9);
  const hueAt = (i) => (210 + i * 14) % 360;

  function buildStars() {
    const rand = seededRand(88);
    stars = [];
    for (let i = 0; i < 40; i++) {
      stars.push({
        x: rand() * W,
        y: rand() * H,
        r: 0.5 + rand() * 1.5,
        tw: rand() * Math.PI * 2,
      });
    }
  }

  /* ---------- Vòng đời ---------- */

  function reset() {
    const baseY = H - 92;
    blocks = [{ x: (W - BASE_W) / 2, w: BASE_W, y: baseY, hue: hueAt(0) }];
    pieces = [];
    particles = [];
    texts = [];
    floors = 0;
    best = opts.getBest();
    cam = 0;
    dieT = 0;
    shakeT = 0;
    elapsed = 0;
    spawnMover();
    hud.set("score", formatScore(floors));
    hud.set("best", formatScore(best));
    hud.set("level", String(level()).padStart(2, "0"));
  }

  function spawnMover() {
    const top = blocks[blocks.length - 1];
    const fromLeft = blocks.length % 2 === 1; // đổi hướng xuất phát mỗi tầng
    const w = top.w;
    mover = {
      w,
      y: top.y - BH,
      x: fromLeft ? 14 : W - 14 - w,
      dir: fromLeft ? 1 : -1,
      speed: moverSpeed(),
      hue: hueAt(blocks.length),
    };
  }

  function drop() {
    if (phase !== "run" || paused || !mover) return;

    const top = blocks[blocks.length - 1];
    const left = Math.max(mover.x, top.x);
    const right = Math.min(mover.x + mover.w, top.x + top.w);
    const overlap = right - left;

    if (overlap <= MIN_OVERLAP) {
      // Trượt hoàn toàn: cả khối rơi xuống → thua
      pieces.push({ x: mover.x, y: mover.y, w: mover.w, vy: 40, vr: mover.dir * 2.4, rot: 0, hue: mover.hue });
      mover = null;
      phase = "die";
      dieT = 0.85;
      if (!opts.reducedMotion) shakeT = 0.35;
      opts.audio.play("hit");
      return;
    }

    const offset = mover.x - top.x;
    if (Math.abs(offset) <= PERFECT_EPS) {
      // Hoàn hảo: khớp thẳng hàng, giữ nguyên độ rộng (thưởng nhẹ +4px, có trần)
      const w = Math.min(BASE_W, top.w + 4);
      blocks.push({ x: top.x + (top.w - w) / 2, w, y: mover.y, hue: mover.hue });
      opts.audio.play("perfect");
      texts.push({ x: W / 2, y: screenY(mover.y) - 26, txt: "PERFECT!", color: "#ffd23f", t: 0, big: true });
      sparkle(top.x + top.w / 2, mover.y + BH / 2);
    } else {
      // Cắt phần lệch: phần thừa rơi xuống
      blocks.push({ x: left, w: overlap, y: mover.y, hue: mover.hue });
      const cutW = mover.w - overlap;
      const cutX = offset > 0 ? right : mover.x;
      pieces.push({
        x: cutX,
        y: mover.y,
        w: cutW,
        vy: 30,
        vr: (offset > 0 ? 1 : -1) * randRange(1.5, 3),
        rot: 0,
        hue: mover.hue,
      });
      opts.audio.play("drop");
    }

    floors += 1;
    hud.set("score", formatScore(floors));
    hud.set("level", String(level()).padStart(2, "0"));
    if (floors > best) {
      best = floors;
      hud.set("best", formatScore(best));
    }
    if (floors % 5 === 0) {
      opts.audio.play("levelup");
      texts.push({ x: W / 2, y: screenY(mover.y) - 52, txt: `CẤP ${level()}`, color: "#b07bff", t: 0, big: true });
    }

    spawnMover();
  }

  function sparkle(x, y) {
    const count = opts.reducedMotion ? 6 : 14;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = randRange(40, 200);
      particles.push({
        x,
        y: screenY(y),
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 40,
        life: randRange(0.3, 0.55),
        t: 0,
        size: randRange(2, 4),
        color: Math.random() > 0.5 ? "#ffd23f" : "#fff3c4",
      });
    }
  }

  const screenY = (worldY) => worldY - cam;

  /* ---------- Cập nhật ---------- */

  function update(dt) {
    elapsed += dt;

    if (phase === "run" && mover) {
      // Khối trượt qua lại, chạm mép thì đổi hướng
      mover.x += mover.dir * mover.speed * dt;
      const minX = 14;
      const maxX = W - 14 - mover.w;
      if (mover.x <= minX) { mover.x = minX; mover.dir = 1; }
      if (mover.x >= maxX) { mover.x = maxX; mover.dir = -1; }
    }

    // Camera bám theo đỉnh tháp (giữ khối đang trượt ~y130 màn hình)
    const anchorY = mover ? mover.y : blocks[blocks.length - 1].y - BH;
    const camTarget = Math.min(0, anchorY - 130);
    cam = lerp(cam, camTarget, Math.min(1, dt * 6));

    // Mảnh cắt rơi tự do
    for (const piece of pieces) {
      piece.vy += 1500 * dt;
      piece.y += piece.vy * dt;
      piece.rot += piece.vr * dt;
    }
    pieces = pieces.filter((p) => screenY(p.y) < H + 80);

    if (phase === "die") {
      dieT -= dt;
      if (dieT <= 0) {
        phase = "over";
        loop.stop();
        render();
        opts.onGameOver(floors);
        return;
      }
    }

    for (const p of particles) {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 400 * dt;
    }
    particles = particles.filter((p) => p.t < p.life);

    for (const t of texts) t.t += dt;
    texts = texts.filter((t) => t.t < 0.9);

    shakeT = Math.max(0, shakeT - dt);

    render();
  }

  /* ---------- Vẽ ---------- */

  function drawBlockShape(x, y, w, hue, alpha = 1) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = `hsl(${hue} 82% 58%)`;
    ctx.fillRect(x, y, w, BH - 2);
    ctx.fillStyle = "rgba(255,255,255,.3)";
    ctx.fillRect(x, y, w, 5);
    ctx.fillStyle = "rgba(0,0,0,.28)";
    ctx.fillRect(x, y + BH - 8, w, 6);
    ctx.globalAlpha = 1;
  }

  function render() {
    ctx.save();
    if (shakeT > 0) {
      const power = shakeT * 14;
      ctx.translate(randRange(-power, power), randRange(-power, power));
    }

    // Nền tím đêm + sao
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#221046");
    bg.addColorStop(1, "#100b2c");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    for (const s of stars) {
      const a = 0.3 + 0.4 * (0.5 + 0.5 * Math.sin(elapsed * 1.6 + s.tw));
      ctx.fillStyle = `rgba(237,241,255,${a})`;
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }

    // Bệ đỡ dưới khối nền
    const base = blocks[0];
    const baseScreenY = screenY(base.y);
    ctx.fillStyle = "#0c081f";
    ctx.beginPath();
    ctx.moveTo(base.x - 30, baseScreenY + BH + 60);
    ctx.lineTo(base.x - 6, baseScreenY + BH - 2);
    ctx.lineTo(base.x + base.w + 6, baseScreenY + BH - 2);
    ctx.lineTo(base.x + base.w + 30, baseScreenY + BH + 60);
    ctx.closePath();
    ctx.fill();

    // Các tầng đã đặt (chỉ vẽ phần trong khung hình)
    for (const b of blocks) {
      const sy = screenY(b.y);
      if (sy < -BH || sy > H + BH) continue;
      drawBlockShape(b.x, sy, b.w, b.hue);
    }

    // Mảnh cắt đang rơi
    for (const piece of pieces) {
      ctx.save();
      ctx.translate(piece.x + piece.w / 2, screenY(piece.y) + BH / 2);
      ctx.rotate(piece.rot);
      drawBlockShape(-piece.w / 2, -BH / 2, piece.w, piece.hue, 0.9);
      ctx.restore();
    }

    // Khối đang trượt + đường gióng mép khối dưới
    if (mover && phase === "run") {
      const top = blocks[blocks.length - 1];
      const guideTop = screenY(mover.y) + BH;
      const guideBottom = screenY(top.y);
      ctx.strokeStyle = "rgba(176,123,255,.4)";
      ctx.setLineDash([4, 6]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(top.x, guideTop);
      ctx.lineTo(top.x, guideBottom);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(top.x + top.w, guideTop);
      ctx.lineTo(top.x + top.w, guideBottom);
      ctx.stroke();
      ctx.setLineDash([]);
      drawBlockShape(mover.x, screenY(mover.y), mover.w, mover.hue);
    }

    // Hạt lấp lánh
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // Chữ nổi
    ctx.textAlign = "center";
    for (const t of texts) {
      ctx.globalAlpha = Math.max(0, 1 - t.t / 0.9);
      ctx.font = t.big ? `800 20px ${MONO}` : `700 14px ${MONO}`;
      ctx.fillStyle = t.color;
      ctx.fillText(t.txt, t.x, t.y - t.t * 34);
    }
    ctx.globalAlpha = 1;

    // Gợi ý khi chưa thả khối nào
    if (floors === 0 && phase === "run") {
      const blink = 0.55 + 0.45 * Math.sin(elapsed * 4);
      ctx.font = `700 14px ${MONO}`;
      ctx.textAlign = "center";
      ctx.fillStyle = `rgba(176,123,255,${blink})`;
      ctx.fillText("Nhấn / Space để thả khối", W / 2, H - 26);
    }

    ctx.restore();
  }

  /* ---------- Interface vòng đời chuẩn ---------- */

  return {
    mount(container, options) {
      opts = options;
      W = 560;
      H = 640;

      view = createCanvas(container, { width: W, height: H });
      ctx = view.ctx;

      hud = createHud(options.hudRoot);
      hud.addStat({ id: "score", label: "Điểm (tầng)", accent: "violet" });
      hud.addStat({ id: "best", label: "Kỷ lục", accent: "pink", small: true });
      hud.addStat({ id: "level", label: "Cấp", accent: "cyan", small: true, value: "01" });

      keys = createKeyboard();
      keys.on(["Space"], drop);
      offPointer = onPointerDown(view.canvas, drop);

      loop = createLoop(update);
      buildStars();
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
      offPointer();
      hud.destroy();
      view.destroy();
      phase = "idle";
    },
  };
}
