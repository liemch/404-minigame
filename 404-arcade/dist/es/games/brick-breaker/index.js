/**
 * Brick Breaker 404 — game phá gạch 10 màn (expansion 11–15).
 *
 * Theo ảnh reference: tiêu đề hộp góc trái trên; sân chơi khung neon
 * cyan bên trái; sidebar PHẢI gồm cụm nút TẠM DỪNG / ÂM THANH /
 * ĐỔI GAME / TRANG CHỦ (lưới 2×2) + panel ĐIỂM / MẠNG (tim pixel) /
 * MÀN / COMBO (thanh 10 nấc) + chú giải 4 loại gạch.
 * Điều khiển: chuột rê / A D / mũi tên, SPACE hoặc click thả bóng,
 * mobile kéo paddle trực tiếp (touch-action none). Esc tạm dừng.
 * Logic thuần trong engine.js (substep chống xuyên); tiến trình màn
 * lưu storage.setPref; điểm gửi ctx.onGameOver mỗi khi xong màn.
 */

import { createExpansionFrame } from "../_shared/frame.js";
import { createKeyboard } from "../../core/input-manager.js";
import { createLoop } from "../../core/loop.js";
import { el, formatScore, formatNumber } from "../../core/utils.js";
import { createMatch, stepMatch, drainEvents, damageBrick, WORLD, MAX_LIVES, CELL } from "./engine.js";
import { LEVELS } from "./levels.js";
import { createBrickRenderer, paintBrickLegend } from "./render.js";
import { BB_CSS } from "./styles.js";

const PROGRESS_KEY = "bb-progress";
const STEP = 1 / 120;
const POWER_LABEL = {
  multi: "BÓNG X2!",
  wide: "PADDLE RỘNG!",
  slow: "BÓNG CHẬM!",
  laser: "PADDLE LASER!",
  life: "+1 MẠNG!",
};

/** Tim pixel 7×6 vẽ vào canvas nhỏ (image-rendering: pixelated). */
function paintHeart(canvas, on) {
  canvas.width = 7;
  canvas.height = 6;
  const c = canvas.getContext("2d");
  c.clearRect(0, 0, 7, 6);
  const rows = [".XX.XX.", "XXXXXXX", "XXXXXXX", ".XXXXX.", "..XXX..", "...X..."];
  c.fillStyle = on ? "#ff4f7e" : "rgba(120,60,90,0.35)";
  for (let y = 0; y < 6; y++) {
    for (let x = 0; x < 7; x++) {
      if (rows[y][x] === "X") c.fillRect(x, y, 1, 1);
    }
  }
  if (on) {
    c.fillStyle = "#ffc4d6";
    c.fillRect(1, 1, 1, 1);
  }
}

export function createGame() {
  let ctx = null;
  let frame = null;
  let renderer = null;
  let keys = null;
  let loop = null;
  let ro = null;
  let canvas = null;
  let stage = null;

  const TEST = typeof window !== "undefined" && window.__ARCADE_EXP11_TEST__;

  let mode = "intro"; // intro | play | paused | complete | over | finished
  let levelIdx = 0;
  let m = null; // match engine
  let acc = 0;
  let time = 0;
  let stateT = 0;
  let launchQueued = false;
  let pointerX = null; // tọa độ thế giới theo con trỏ (null = dùng phím)

  const fx = { particles: [], rings: [] };
  const hud = { score: null, hearts: null, level: null, combo: null, segs: [] };

  /* ---------------- Tiến trình ---------------- */

  function readProgress() {
    const p = ctx.storage.getPref(PROGRESS_KEY, null);
    if (
      p &&
      typeof p === "object" &&
      p.v === 1 &&
      Number.isInteger(p.level) &&
      p.level >= 0 &&
      p.level < LEVELS.length
    ) {
      return { level: p.level, score: Number.isFinite(p.score) ? p.score : 0 };
    }
    return { level: 0, score: 0 };
  }

  function saveProgress(level, score) {
    ctx.storage.setPref(PROGRESS_KEY, { v: 1, level, score });
  }

  /* ---------------- HUD sidebar ---------------- */

  function updateHud() {
    if (!m) return;
    hud.score.textContent = formatScore(m.score);
    hud.level.textContent = String(levelIdx + 1).padStart(2, "0");
    hud.combo.textContent = `x${m.combo}`;
    hud.segs.forEach((seg, i) => seg.classList.toggle("on", i < Math.min(m.combo, 10)));
    const slots = Math.max(3, m.lives);
    hud.hearts.forEach((cv, i) => {
      cv.style.display = i < Math.max(slots, 3) && i < MAX_LIVES ? "" : "none";
      paintHeart(cv, i < m.lives);
    });
  }

  /* ---------------- FX ---------------- */

  function burst(x, y, btype) {
    const color =
      btype === CELL.EXPLOSIVE ? "#ff7cc0" : btype === CELL.REINFORCED ? "#b48cff" : "#7ce6ff";
    const n = 12;
    for (let i = 0; i < n; i++) {
      if (fx.particles.length > 220) break;
      const a = Math.random() * Math.PI * 2;
      const sp = 90 + Math.random() * 240;
      fx.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 60,
        rot: Math.random() * 6.3,
        vr: (Math.random() - 0.5) * 9,
        size: 3 + Math.random() * 6,
        life: 0.5 + Math.random() * 0.35,
        life0: 0.85,
        color,
      });
    }
  }

  function stepFx(dt) {
    for (let i = fx.particles.length - 1; i >= 0; i--) {
      const p = fx.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        fx.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 420 * dt;
      p.rot += p.vr * dt;
    }
    for (let i = fx.rings.length - 1; i >= 0; i--) {
      fx.rings[i].life -= dt;
      if (fx.rings[i].life <= 0) fx.rings.splice(i, 1);
    }
  }

  /* ---------------- Sự kiện engine ---------------- */

  function handleEvents(events) {
    for (const ev of events) {
      switch (ev.type) {
        case "paddle":
          ctx.audio.play("bb_paddle");
          updateHud();
          break;
        case "wall":
          ctx.audio.play("bb_wall");
          break;
        case "crack":
          ctx.audio.play("bb_crack");
          burst(ev.x, ev.y, CELL.REINFORCED);
          updateHud();
          break;
        case "break":
          ctx.audio.play("bb_brick");
          burst(ev.x, ev.y, ev.btype);
          updateHud();
          break;
        case "boom":
          ctx.audio.play("boom");
          fx.rings.push({ x: ev.x, y: ev.y, life: 0.5, life0: 0.5, color: "#ff7cc0" });
          break;
        case "steel":
          ctx.audio.play("bb_steel");
          break;
        case "power":
          ctx.audio.play("bb_power");
          frame.toast(POWER_LABEL[ev.power] || "POWER-UP!");
          updateHud();
          break;
        case "laserShot":
          ctx.audio.play("bb_laser");
          break;
        case "launch":
          ctx.audio.play("jump");
          break;
        case "ballDrop":
          if (ev.remaining > 0) ctx.audio.play("drop");
          break;
        case "lifeLost":
          if (ev.lives > 0) {
            ctx.audio.play("bb_lose");
            frame.banner("MẤT MẠNG!");
          }
          updateHud();
          break;
        case "gameOver":
          finishMatch(false);
          return;
        case "cleared":
          finishLevel();
          return;
        default:
          break;
      }
    }
  }

  /* ---------------- Vòng đời màn ---------------- */

  function beginLevel(idx, { lives = 3, score = 0 } = {}) {
    levelIdx = idx;
    m = createMatch(LEVELS[idx], { lives, score });
    fx.particles.length = 0;
    fx.rings.length = 0;
    acc = 0;
    launchQueued = false;
    pointerX = null;
    saveProgress(idx, score);
    mode = "play";
    frame.clearScreen();
    frame.setPaused(false);
    ctx.onMatchStart();
    frame.banner(`MÀN ${String(idx + 1).padStart(2, "0")} — ${LEVELS[idx].name}`);
    ctx.audio.play("start");
    updateHud();
    loop.start();
  }

  function finishLevel() {
    mode = "complete";
    loop.stop();
    const bonus = m.lives * 150;
    m.score += bonus;
    ctx.audio.play("win");
    const isLast = levelIdx === LEVELS.length - 1;
    if (isLast) saveProgress(0, 0);
    else saveProgress(levelIdx + 1, m.score);
    const saved = ctx.onGameOver(m.score, { level: levelIdx + 1, maxCombo: m.maxCombo });

    const statCards = [
      { label: "GẠCH ĐÃ PHÁ", value: m.bricksBroken, color: "cyan" },
      { label: "COMBO CAO NHẤT", value: `x${m.maxCombo}`, color: "lime" },
      { label: "POWER-UP", value: m.powerupsTaken, color: "violet" },
      { label: "THƯỞNG MẠNG", value: `+${formatNumber(bonus)}`, color: "gold" },
    ];
    if (isLast) {
      mode = "finished";
      frame.overScreen({
        kicker: "// CHIẾN DỊCH HOÀN TẤT",
        heading: "PHÁ ĐẢO 10 MÀN!",
        score: m.score,
        saved,
        statCards,
        restartLabel: "CHƠI LẠI TỪ ĐẦU",
        onRestart: () => beginLevel(0, { lives: 3, score: 0 }),
        scoreLabel: "TỔNG ĐIỂM",
      });
    } else {
      const nextLives = m.lives;
      const nextScore = m.score;
      frame.overScreen({
        kicker: "// MÀN HOÀN THÀNH",
        heading: `MÀN ${String(levelIdx + 1).padStart(2, "0")} — SẠCH GẠCH!`,
        score: m.score,
        saved,
        statCards,
        restartLabel: "MÀN TIẾP THEO",
        onRestart: () => beginLevel(levelIdx + 1, { lives: nextLives, score: nextScore }),
        extraActions: [["Chơi lại màn", "i-restart", "cyan", () => beginLevel(levelIdx, { lives: 3, score: readProgress().score })]],
        scoreLabel: "TỔNG ĐIỂM",
      });
    }
    updateHud();
  }

  function finishMatch() {
    mode = "over";
    loop.stop();
    const saved = ctx.onGameOver(m.score, { level: levelIdx + 1, maxCombo: m.maxCombo });
    const entryScore = readProgress().score;
    frame.overScreen({
      kicker: "// HẾT MẠNG",
      heading: "GAME OVER!",
      score: m.score,
      saved,
      statCards: [
        { label: "MÀN ĐẠT ĐƯỢC", value: String(levelIdx + 1).padStart(2, "0"), color: "cyan" },
        { label: "GẠCH ĐÃ PHÁ", value: m.bricksBroken, color: "violet" },
        { label: "COMBO CAO NHẤT", value: `x${m.maxCombo}`, color: "lime" },
      ],
      restartLabel: "CHƠI LẠI MÀN",
      onRestart: () => beginLevel(levelIdx, { lives: 3, score: entryScore }),
    });
  }

  /* ---------------- Pause ---------------- */

  function pauseGame() {
    if (mode !== "play") return;
    mode = "paused";
    loop.stop();
    frame.setPaused(true);
    frame.pauseMenu({
      onResume: () => resumeGame(),
      onRestart: () => beginLevel(levelIdx, { lives: 3, score: readProgress().score }),
      restartLabel: "CHƠI LẠI MÀN",
      buildExtra: (box) => {
        const row = el("div", "exp-setrow");
        row.appendChild(el("span", "", "TIẾN TRÌNH"));
        row.appendChild(el("span", "val", `MÀN ${levelIdx + 1}/10 · ${formatNumber(m.score)} ĐIỂM · ${m.lives} MẠNG`));
        box.appendChild(row);
      },
    });
  }

  function resumeGame() {
    if (mode !== "paused") return;
    mode = "play";
    frame.clearScreen();
    frame.setPaused(false);
    keys.clearDown();
    launchQueued = false;
    loop.start();
  }

  function togglePause() {
    if (mode === "play") pauseGame();
    else if (mode === "paused") resumeGame();
  }

  /* ---------------- Intro ---------------- */

  function showIntro() {
    mode = "intro";
    loop.stop();
    const progress = readProgress();
    const extra = [];
    if (progress.level > 0) {
      extra.push(["Chơi từ đầu", "i-restart", "gold", () => beginLevel(0, { lives: 3, score: 0 })]);
    }
    frame.intro({
      kicker: "// NHIỆM VỤ PHÁ GẠCH",
      heading: [["BRICK BREAKER ", "cyan"], ["404", "pink"]],
      goal:
        "Phản xạ quả cầu bằng paddle để phá sạch gạch qua 10 màn. Gạch tím cần 2 cú đánh, gạch hồng NỔ lan 8 ô quanh nó, gạch thép không thể phá. Hứng power-up rơi xuống: bóng x2, paddle rộng, bóng chậm, laser, +1 mạng!",
      rows: [
        { keys: ["Chuột"], text: "rê để lái paddle (mobile: kéo trực tiếp)" },
        { keys: ["← →", "A D"], text: "di chuyển bằng phím" },
        { keys: ["SPACE", "Click"], text: "thả bóng" },
        { keys: ["ESC"], text: "tạm dừng" },
      ],
      startLabel:
        progress.level > 0 ? `TIẾP TỤC — MÀN ${String(progress.level + 1).padStart(2, "0")}` : "BẮT ĐẦU",
      onStart: () => {
        const p = readProgress();
        beginLevel(p.level, { lives: 3, score: p.score });
      },
      extra,
    });
    // khung nền tĩnh cho intro
    m = createMatch(LEVELS[progress.level], { lives: 3, score: progress.score });
    levelIdx = progress.level;
    renderer.fit();
    renderer.draw(m, fx, 0);
    updateHud();
  }

  /* ---------------- Vòng lặp ---------------- */

  function gatherInput() {
    const left = keys.isDown("ArrowLeft") || keys.isDown("KeyA");
    const right = keys.isDown("ArrowRight") || keys.isDown("KeyD");
    const move = (right ? 1 : 0) - (left ? 1 : 0);
    const input = {
      move,
      targetX: move !== 0 ? null : pointerX,
      launch: launchQueued || keys.isDown("Space"),
    };
    launchQueued = false;
    return input;
  }

  function update(dt) {
    time += dt;
    if (mode === "play") {
      acc = Math.min(acc + dt, 0.1);
      const input = gatherInput();
      while (acc >= STEP && mode === "play") {
        acc -= STEP;
        stepMatch(m, input, STEP);
        input.launch = false;
        if (m.cleared || m.over) break;
      }
      // trail bóng
      for (const ball of m.balls) {
        if (!ball.trail) ball.trail = [];
        if (!ball.stuck) {
          ball.trail.push({ x: ball.x, y: ball.y });
          if (ball.trail.length > 15) ball.trail.shift();
        } else {
          ball.trail.length = 0;
        }
      }
      handleEvents(drainEvents(m));
    }
    stepFx(dt);
    renderer.draw(m, fx, time);

    if (TEST) {
      stateT += dt;
      if (stateT > 0.35) {
        stateT = 0;
        window.__BB_STATE__ = {
          mode,
          score: m ? m.score : 0,
          lives: m ? m.lives : 0,
          level: levelIdx + 1,
          bricksLeft: m ? m.breakableLeft : 0,
          balls: m ? m.balls.length : 0,
          ballStuck: m ? m.balls.some((b) => b.stuck) : false,
          combo: m ? m.combo : 0,
          paddleX: m ? Math.round(m.paddle.x) : 0,
          powerups: m ? m.powerups.length : 0,
        };
      }
    }
  }

  /* ---------------- Interface ---------------- */

  return {
    async mount(container, context) {
      ctx = context;

      const rootNode = container.getRootNode();
      if (rootNode instanceof ShadowRoot && !rootNode.querySelector("#bb-style")) {
        const style = document.createElement("style");
        style.id = "bb-style";
        style.textContent = BB_CSS;
        rootNode.appendChild(style);
      }

      frame = createExpansionFrame(container, ctx, {
        accent: "cyan",
        title: [["BRICK BREAKER ", "cyan"], ["404", "pink"]],
        stats: [],
        attachTopbar: false,
        onPauseToggle: togglePause,
      });

      /* Bố cục theo ảnh: main (tiêu đề + sân) trái, sidebar phải */
      const layout = el("div", "bb-layout");
      const main = el("div", "bb-main");
      const head = el("div", "bb-head");
      const titleBox = el("div", "bb-titlebox");
      const titleEl = frame.topbar.querySelector(".exp-title");
      titleBox.appendChild(titleEl);
      head.appendChild(titleBox);
      main.appendChild(head);

      stage = el("div", "bb-stage");
      canvas = document.createElement("canvas");
      canvas.setAttribute("aria-label", "Sân chơi Brick Breaker");
      stage.appendChild(canvas);
      main.appendChild(stage);

      const side = el("aside", "bb-side");
      side.appendChild(frame.topbar.querySelector(".exp-btns"));

      const mkPanel = (tone, label) => {
        const p = el("div", "bb-panel");
        p.dataset.tone = tone;
        if (label) p.appendChild(el("div", "lbl", label));
        side.appendChild(p);
        return p;
      };

      const scoreP = mkPanel("cyan", "ĐIỂM");
      hud.score = el("div", "val", "000000");
      scoreP.appendChild(hud.score);

      const livesP = mkPanel("pink", "MẠNG");
      const heartsBox = el("div", "bb-hearts");
      hud.hearts = [];
      for (let i = 0; i < MAX_LIVES; i++) {
        const cv = document.createElement("canvas");
        heartsBox.appendChild(cv);
        hud.hearts.push(cv);
      }
      livesP.appendChild(heartsBox);

      const levelP = mkPanel("cyan", "MÀN");
      hud.level = el("div", "val", "01");
      levelP.appendChild(hud.level);

      const comboP = mkPanel("lime", "COMBO");
      hud.combo = el("div", "val", "x0");
      comboP.appendChild(hud.combo);
      const segBox = el("div", "bb-comboseg");
      hud.segs = [];
      for (let i = 0; i < 10; i++) {
        const seg = el("i");
        segBox.appendChild(seg);
        hud.segs.push(seg);
      }
      comboP.appendChild(segBox);

      const legendP = mkPanel("cyan", "");
      legendP.classList.add("bb-panel-legend");
      const legend = el("div", "bb-legend");
      for (const [kind, label] of [
        ["normal", "GẠCH THƯỜNG"],
        ["reinforced", "GẠCH TĂNG CƯỜNG"],
        ["explosive", "GẠCH NỔ"],
        ["steel", "GẠCH BẤT HOẠI"],
      ]) {
        const row = el("div", "bb-legend-row");
        const cv = document.createElement("canvas");
        paintBrickLegend(cv, kind);
        row.appendChild(cv);
        row.appendChild(el("span", "", label));
        legend.appendChild(row);
      }
      legendP.appendChild(legend);

      layout.append(main, side);
      frame.playfield.appendChild(layout);

      renderer = createBrickRenderer(canvas, stage);
      ro = new ResizeObserver(() => {
        renderer.fit();
        if (mode !== "play") renderer.draw(m, fx, time);
      });
      ro.observe(stage);

      /* Input */
      keys = createKeyboard({ signal: ctx.signal });
      keys.on(["Space"], () => {
        if (mode === "play") launchQueued = true;
      });
      keys.on(["KeyP"], () => togglePause());
      keys.on(["ArrowLeft", "ArrowRight", "KeyA", "KeyD"], () => {
        pointerX = null; // phím ưu tiên lại điều khiển
      });

      const toWorldX = (e) => {
        const rect = canvas.getBoundingClientRect();
        return ((e.clientX - rect.left) / rect.width) * WORLD.w;
      };
      canvas.addEventListener(
        "pointermove",
        (e) => {
          pointerX = toWorldX(e);
        },
        { signal: ctx.signal }
      );
      canvas.addEventListener(
        "pointerdown",
        (e) => {
          e.preventDefault();
          pointerX = toWorldX(e);
          if (mode === "play") launchQueued = true;
        },
        { signal: ctx.signal }
      );

      loop = createLoop(update);

      if (TEST) {
        window.__BB_TEST__ = {
          clearTo: (n) => {
            if (!m || mode !== "play") return false;
            const targets = m.lv.bricks.filter((b) => b.alive && b.type !== CELL.UNBREAKABLE);
            for (const b of targets) {
              if (m.breakableLeft <= n) break;
              damageBrick(m, b, 9);
            }
            return true;
          },
          dropBalls: () => {
            if (!m) return false;
            for (const b of m.balls) {
              b.stuck = false;
              b.y = WORLD.h + 100;
              b.vy = 200;
            }
            return true;
          },
        };
      }

      showIntro();
    },

    start() {
      if (mode !== "intro") return;
      const p = readProgress();
      beginLevel(p.level, { lives: 3, score: p.score });
    },

    pause() {
      pauseGame();
    },

    resume() {
      resumeGame();
    },

    restart() {
      if (mode === "intro") return;
      beginLevel(levelIdx, { lives: 3, score: readProgress().score });
    },

    resize() {
      renderer?.fit();
    },

    destroy() {
      loop?.stop();
      keys?.destroy();
      ro?.disconnect();
      frame?.destroy();
      frame = null;
      renderer = null;
      m = null;
      if (typeof window !== "undefined") {
        delete window.__BB_STATE__;
        delete window.__BB_TEST__;
      }
    },
  };
}
