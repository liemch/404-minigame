/**
 * Neon Pinball 404 — pinball neon 3 bi (expansion 16–20).
 *
 * Theo ảnh reference: cột HUD trái (NEON PINBALL 404 / ĐIỂM / BI /
 * MULTI / BONUS), cụm nút hệ thống nổi góc phải trên, bàn dọc giữa
 * với rail magenta + bumper sao + spinner + slingshot + drop target +
 * lane phóng, hai nút FLIPPER lục giác góc dưới. Physics fixed
 * timestep chống xuyên bi trong engine.js; flipper ←/A và →/D, giữ
 * SPACE (hoặc giữ plunger) tụ lực phóng bi, ball saver sau khi phóng,
 * multiplier x2/x4/x6/x8 khi hạ đủ nhóm target, bonus tổng kết mỗi bi.
 */

import { createExpansionFrame } from "../_shared/frame.js";
import { createKeyboard } from "../../core/input-manager.js";
import { createLoop } from "../../core/loop.js";
import { el, formatScore, formatTime } from "../../core/utils.js";
import { createSim, stepSim, setFlipper, chargePlunger, drainEvents, mult } from "./engine.js";
import { BALLS_PER_GAME } from "./table.js";
import { createPinballRenderer } from "./render.js";
import { PB_CSS } from "./styles.js";

const STEP = 1 / 120;

export function createGame() {
  let ctx = null;
  let frame = null;
  let renderer = null;
  let keys = null;
  let loop = null;
  let ro = null;
  let canvas = null;
  let stage = null;
  let hud = {};

  const TEST = typeof window !== "undefined" && window.__ARCADE_EXP16_TEST__;

  let mode = "intro"; // intro | play | paused | over
  let sim = null;
  let acc = 0;
  let time = 0;
  let hudT = 0;
  let maxMult = 1;

  const fx = { particles: [] };
  const touch = { left: new Set(), right: new Set(), plunger: new Set() };

  /* ---------------- HUD ---------------- */

  function updateHud() {
    if (!sim) return;
    hud.score.textContent = formatScore(sim.score);
    hud.balls.textContent = String(sim.ballsLeft).padStart(2, "0");
    hud.mult.textContent = `x${mult(sim)}`;
    hud.bonus.textContent = `${sim.bonusPct}%`;
  }

  function burst(x, y, color, n = 10) {
    for (let i = 0; i < n; i++) {
      if (fx.particles.length > 140) break;
      const a = Math.random() * Math.PI * 2;
      const sp = 70 + Math.random() * 260;
      fx.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        size: 4 + Math.random() * 6,
        life: 0.35 + Math.random() * 0.3,
        life0: 0.65,
        color,
      });
    }
  }

  /* ---------------- Sự kiện engine ---------------- */

  function handleEvents(events) {
    for (const ev of events) {
      switch (ev.type) {
        case "flip":
          ctx.audio.play("pb_flip");
          break;
        case "launch":
          ctx.audio.play("pb_launch");
          break;
        case "bumper":
          ctx.audio.play("pb_bumper");
          burst(ev.x, ev.y, ["#20e3ff", "#ff2ea6", "#9dff3e"][ev.i], 9);
          break;
        case "sling":
          ctx.audio.play("pb_sling");
          break;
        case "spin":
          ctx.audio.play("pb_spin");
          break;
        case "target":
          ctx.audio.play("pb_target");
          break;
        case "multiplier":
          maxMult = Math.max(maxMult, ev.value);
          ctx.audio.play("upgrade");
          frame.banner(`MULTIPLIER x${ev.value}!`);
          break;
        case "ramp":
          ctx.audio.play("vr_gate");
          frame.toast(`RAMP ${ev.id === "L" ? "TRÁI" : "PHẢI"} +${500 * mult(sim)}`);
          break;
        case "rampCombo":
          ctx.audio.play("combo");
          frame.toast(`COMBO RAMP x${ev.combo}!`);
          break;
        case "saved":
          ctx.audio.play("pickup");
          frame.banner("BALL SAVER!");
          break;
        case "nudge":
          ctx.audio.play("bb_wall");
          break;
        case "drain":
          ctx.audio.play("pb_drain");
          if (ev.bonusPts > 0) frame.toast(`BONUS ${ev.bonusPct}% → +${ev.bonusPts} ĐIỂM`);
          if (sim.ballsLeft > 0) frame.banner(`BI ${sim.ballNum}/${BALLS_PER_GAME}`);
          updateHud();
          break;
        case "gameOver":
          finishMatch();
          return;
        default:
          break;
      }
    }
  }

  /* ---------------- Vòng đời ---------------- */

  function beginMatch() {
    sim = createSim();
    fx.particles.length = 0;
    acc = 0;
    maxMult = 1;
    mode = "play";
    frame.clearScreen();
    frame.setPaused(false);
    ctx.onMatchStart();
    ctx.audio.play("start");
    frame.banner(`BI 1/${BALLS_PER_GAME} — KÉO ĐỂ PHÓNG!`);
    updateHud();
    loop.start();
  }

  function finishMatch() {
    mode = "over";
    const saved = ctx.onGameOver(sim.score, { maxMult, time: sim.time });
    frame.overScreen({
      kicker: "// HẾT BI",
      heading: "GAME OVER!",
      score: sim.score,
      saved,
      statCards: [
        { label: "BI ĐÃ CHƠI", value: BALLS_PER_GAME, color: "cyan" },
        { label: "MULTI MAX", value: `x${maxMult}`, color: "lime" },
        { label: "THỜI GIAN", value: formatTime(sim.time), color: "violet" },
      ],
      restartLabel: "CHƠI LẠI",
      onRestart: () => beginMatch(),
    });
    updateHud();
  }

  function pauseGame() {
    if (mode !== "play") return;
    mode = "paused";
    loop.stop();
    frame.setPaused(true);
    frame.pauseMenu({
      onResume: () => resumeGame(),
      onRestart: () => beginMatch(),
      buildExtra: (box) => {
        const row = el("div", "exp-setrow");
        row.appendChild(el("span", "", "TIẾN TRÌNH"));
        row.appendChild(el("span", "val", `${formatScore(sim.score)} · bi ${sim.ballNum}/${BALLS_PER_GAME} · x${mult(sim)}`));
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
    touch.left.clear();
    touch.right.clear();
    touch.plunger.clear();
    loop.start();
  }

  function togglePause() {
    if (mode === "play") pauseGame();
    else if (mode === "paused") resumeGame();
  }

  function showIntro() {
    mode = "intro";
    loop.stop();
    frame.intro({
      kicker: "// BÀN PINBALL NEON",
      heading: [["NEON PINBALL ", ""], ["404", "pink"]],
      goal:
        "3 bi mỗi lượt: giữ bi sống bằng hai flipper, ăn bumper sao / slingshot / spinner, hạ đủ 3 target xanh để nâng MULTIPLIER (x2→x8), đi ramp luân phiên ăn combo. Có BALL SAVER ngắn sau khi phóng — BONUS tổng kết mỗi khi mất bi!",
      rows: [
        { keys: ["←", "A"], text: "flipper trái" },
        { keys: ["→", "D"], text: "flipper phải" },
        { keys: ["SPACE"], text: "giữ để tụ lực phóng bi — thả để phóng" },
        { keys: ["Chạm"], text: "nút FLIPPER hai góc + giữ vùng plunger" },
        { keys: ["ESC", "P"], text: "tạm dừng" },
      ],
      startLabel: "VÀO BÀN",
      onStart: () => beginMatch(),
    });
    sim = createSim();
    renderer.fit();
    renderer.draw(sim, fx, 0);
    updateHud();
  }

  /* ---------------- Vòng lặp ---------------- */

  function update(dt) {
    time += dt;
    if (mode === "play" && sim) {
      // input flipper: bàn phím + chạm
      setFlipper(sim, "left", keys.isDown("ArrowLeft") || keys.isDown("KeyA") || touch.left.size > 0);
      setFlipper(sim, "right", keys.isDown("ArrowRight") || keys.isDown("KeyD") || touch.right.size > 0);
      // plunger: giữ SPACE / giữ vùng lane
      const hold = keys.isDown("Space") || touch.plunger.size > 0;
      if (sim.state === "plunger") {
        if (hold && !sim.plunger.charging) chargePlunger(sim, true);
        else if (!hold && sim.plunger.charging) chargePlunger(sim, false);
      }

      acc = Math.min(acc + dt, 0.08);
      while (acc >= STEP && mode === "play") {
        acc -= STEP;
        stepSim(sim, STEP);
        if (sim.state === "over") break;
      }
      handleEvents(drainEvents(sim));
      if (mode === "play") {
        hudT += dt;
        if (hudT > 0.12) {
          hudT = 0;
          updateHud();
        }
      }
    }
    for (let i = fx.particles.length - 1; i >= 0; i--) {
      const p = fx.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        fx.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    if (sim) renderer.draw(sim, fx, time);

    if (TEST && sim) {
      window.__PB_STATE__ = {
        mode,
        state: sim.state,
        score: Math.floor(sim.score),
        ballNum: sim.ballNum,
        ballsLeft: sim.ballsLeft,
        mult: mult(sim),
        bonus: sim.bonusPct,
        saver: Math.round(sim.saver * 10) / 10,
        bx: Math.round(sim.ball.x),
        by: Math.round(sim.ball.y),
      };
    }
  }

  /* ---------------- Interface ---------------- */

  return {
    async mount(container, context) {
      ctx = context;

      const rootNode = container.getRootNode();
      if (rootNode instanceof ShadowRoot && !rootNode.querySelector("#pb-style")) {
        const style = document.createElement("style");
        style.id = "pb-style";
        style.textContent = PB_CSS;
        rootNode.appendChild(style);
      }

      frame = createExpansionFrame(container, ctx, {
        accent: "pink",
        title: [["NEON PINBALL ", ""], ["404", "cyan"]],
        stats: [],
        onPauseToggle: togglePause,
        attachTopbar: false, // HUD trái + nút hệ thống nổi tự bố trí
      });
      frame.root.classList.add("pb-mode");

      // cụm nút hệ thống nổi góc phải
      const sys = el("div", "pb-sys");
      sys.appendChild(frame.topbar.querySelector(".exp-btns"));
      frame.playfield.appendChild(sys);

      stage = el("div", "pb-stage");
      canvas = document.createElement("canvas");
      canvas.setAttribute("aria-label", "Bàn Neon Pinball");
      stage.appendChild(canvas);
      frame.playfield.appendChild(stage);

      /* cột HUD trái */
      const side = el("div", "pb-side");
      const logo = el("div", "pb-logo");
      const words = el("div", "words");
      words.appendChild(el("span", "w1", "NEON"));
      words.appendChild(el("span", "w2", "PINBALL"));
      logo.appendChild(words);
      logo.appendChild(el("span", "num", "404"));
      side.appendChild(logo);
      const mkPanel = (tone, label) => {
        const p = el("div", "pb-panel");
        p.dataset.tone = tone;
        p.appendChild(el("div", "lbl", label));
        const v = el("div", "val");
        p.appendChild(v);
        side.appendChild(p);
        return v;
      };
      hud.score = el("span", "", "000000");
      mkPanel("cyan", "ĐIỂM").appendChild(hud.score);
      const ballsVal = mkPanel("white", "BI");
      ballsVal.appendChild(el("i", "ballicon"));
      hud.balls = el("span", "", "03");
      ballsVal.appendChild(hud.balls);
      hud.mult = el("span", "", "x1");
      mkPanel("lime", "MULTI").appendChild(hud.mult);
      hud.bonus = el("span", "", "0%");
      mkPanel("pink", "BONUS").appendChild(hud.bonus);
      frame.playfield.appendChild(side);

      /* nút flipper hai góc */
      const mkFlipBtn = (sideName, label) => {
        const b = el("button", `pb-flipbtn ${sideName}`);
        b.type = "button";
        b.setAttribute("aria-label", label);
        const NS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(NS, "svg");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("aria-hidden", "true");
        const arrow = document.createElementNS(NS, "path");
        arrow.setAttribute(
          "d",
          sideName === "left" ? "M16 5l-7 7 7 7M9 12h11" : "M8 5l7 7-7 7M15 12H4"
        );
        arrow.setAttribute("fill", "none");
        arrow.setAttribute("stroke", "currentColor");
        arrow.setAttribute("stroke-width", "2.2");
        arrow.setAttribute("stroke-linecap", "round");
        arrow.setAttribute("stroke-linejoin", "round");
        svg.appendChild(arrow);
        b.appendChild(svg);
        b.appendChild(el("span", "", label));
        const set = sideName === "left" ? touch.left : touch.right;
        b.addEventListener(
          "pointerdown",
          (e) => {
            e.preventDefault();
            set.add(e.pointerId);
            b.classList.add("held");
          },
          { signal: ctx.signal }
        );
        const release = (e) => {
          set.delete(e.pointerId);
          if (set.size === 0) b.classList.remove("held");
        };
        window.addEventListener("pointerup", release, { signal: ctx.signal });
        window.addEventListener("pointercancel", release, { signal: ctx.signal });
        frame.playfield.appendChild(b);
      };
      mkFlipBtn("left", "FLIPPER TRÁI");
      mkFlipBtn("right", "FLIPPER PHẢI");

      /* chạm canvas: vùng plunger giữ để tụ lực, hai nửa còn lại = flipper */
      canvas.addEventListener(
        "pointerdown",
        (e) => {
          if (mode !== "play") return;
          e.preventDefault();
          const w = renderer.toWorld(e.clientX, e.clientY);
          if (sim.state === "plunger" && w.x > 700) {
            touch.plunger.add(e.pointerId);
          } else if (w.x < 405) {
            touch.left.add(e.pointerId);
          } else {
            touch.right.add(e.pointerId);
          }
        },
        { signal: ctx.signal }
      );
      const releaseAll = (e) => {
        touch.plunger.delete(e.pointerId);
        touch.left.delete(e.pointerId);
        touch.right.delete(e.pointerId);
      };
      window.addEventListener("pointerup", releaseAll, { signal: ctx.signal });
      window.addEventListener("pointercancel", releaseAll, { signal: ctx.signal });

      keys = createKeyboard({ signal: ctx.signal });
      keys.on(["ArrowLeft", "ArrowRight", "KeyA", "KeyD", "Space"], () => {});
      keys.on(["KeyP"], () => togglePause());

      renderer = createPinballRenderer(canvas, stage);
      ro = new ResizeObserver(() => renderer.fit());
      ro.observe(stage);

      loop = createLoop(update);

      if (TEST) {
        window.__PB_TEST__ = {
          launch: (p = 0.9) => {
            if (!sim || sim.state !== "plunger") return false;
            chargePlunger(sim, true);
            sim.plunger.power = p;
            chargePlunger(sim, false);
            return true;
          },
          setBall: (x, y, vx = 0, vy = 0) => {
            if (!sim) return false;
            sim.ball = { x, y, vx, vy, inLane: false };
            sim.state = "play";
            return true;
          },
          drainBall: () => {
            if (!sim) return false;
            sim.saver = 0;
            sim.ball.y = 2000;
            return true;
          },
          flip: (side, on) => setFlipper(sim, side, on),
        };
      }

      showIntro();
    },

    start() {
      if (mode === "intro") beginMatch();
    },

    pause() {
      pauseGame();
    },

    resume() {
      resumeGame();
    },

    restart() {
      if (mode === "intro") return;
      beginMatch();
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
      sim = null;
      if (typeof window !== "undefined") {
        delete window.__PB_STATE__;
        delete window.__PB_TEST__;
      }
    },
  };
}
