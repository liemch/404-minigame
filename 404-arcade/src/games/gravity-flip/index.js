/**
 * Gravity Flip 404 — endless runner một chạm (expansion 16–20).
 *
 * Theo ảnh reference: topbar ĐIỂM / QUÃNG ĐƯỜNG / NĂNG LƯỢNG (thanh
 * lime + %) / COMBO hồng; hành lang kim loại neon, gai hồng sàn/trần,
 * tinh thể xanh, xe đệm từ hồng mũi tên lime, nhân vật vuông trắng có
 * vệt hạt; thanh "CHẠM ĐỂ ĐẢO TRỌNG LỰC" dưới đáy. Nhân vật tự chạy —
 * chạm/Space đảo trọng lực (chỉ khi đang bám bề mặt), generator ghép
 * segment theo safeEntry/safeExit nên không có đường bất khả thi.
 */

import { createExpansionFrame } from "../_shared/frame.js";
import { createKeyboard } from "../../core/input-manager.js";
import { createLoop } from "../../core/loop.js";
import { el, formatScore, formatTime } from "../../core/utils.js";
import { createSim, stepSim, tryFlip, drainEvents } from "./engine.js";
import { createFlipRenderer } from "./render.js";
import { GF_CSS } from "./styles.js";

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
  let hintBar = null;

  const TEST = typeof window !== "undefined" && window.__ARCADE_EXP16_TEST__;

  let mode = "intro"; // intro | play | paused | over
  let sim = null;
  let acc = 0;
  let time = 0;
  let hudT = 0;
  let trailT = 0;

  const fx = { trail: [], particles: [] };

  /* ---------------- HUD ---------------- */

  function updateHud() {
    if (!sim) return;
    frame.setStat("score", formatScore(sim.score));
    frame.setStat("dist", `${Math.floor(sim.dist)}m`);
    frame.setStat("energy", `${Math.round(sim.energy)}%`);
    frame.setStatBar("energy", sim.energy);
    frame.setStat("combo", `x${sim.combo}`);
  }

  /* ---------------- FX ---------------- */

  function burst(x, y, color, n = 14) {
    for (let i = 0; i < n; i++) {
      if (fx.particles.length > 160) break;
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 240;
      fx.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        size: 3 + Math.random() * 5,
        life: 0.4 + Math.random() * 0.35,
        life0: 0.75,
        color,
      });
    }
  }

  function stepFx(dt) {
    for (let i = fx.trail.length - 1; i >= 0; i--) {
      fx.trail[i].life -= dt;
      if (fx.trail[i].life <= 0) fx.trail.splice(i, 1);
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
  }

  /* ---------------- Sự kiện engine ---------------- */

  function handleEvents(events) {
    for (const ev of events) {
      switch (ev.type) {
        case "flip":
          ctx.audio.play("gf_flip");
          if (sim.flips >= 3) hintBar?.classList.add("dim");
          break;
        case "land":
          ctx.audio.play("gf_land");
          break;
        case "shard":
          ctx.audio.play("coin");
          burst(ev.x, ev.y, "#7cc8ff", 7);
          updateHud();
          break;
        case "shield":
          ctx.audio.play("pickup");
          frame.toast("KHIÊN NĂNG LƯỢNG!");
          break;
        case "shieldHit":
          ctx.audio.play("bb_steel");
          frame.toast("KHIÊN VỠ — THOÁT HIỂM!");
          burst(sim.x, sim.y, "#3b9dff", 16);
          break;
        case "dead":
          ctx.audio.play("crash");
          burst(sim.x, sim.y, "#ff5a8e", 26);
          burst(sim.x, sim.y, "#eef4ff", 12);
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
    fx.trail.length = 0;
    fx.particles.length = 0;
    acc = 0;
    mode = "play";
    hintBar?.classList.remove("dim");
    frame.clearScreen();
    frame.setPaused(false);
    ctx.onMatchStart();
    ctx.audio.play("start");
    updateHud();
    loop.start();
  }

  function finishMatch() {
    mode = "over";
    const saved = ctx.onGameOver(sim.score, {
      dist: Math.floor(sim.dist),
      shards: sim.shards,
      maxCombo: sim.maxCombo,
    });
    frame.overScreen({
      kicker: "// MẤT TÍN HIỆU",
      heading: "VA CHẠM!",
      score: sim.score,
      saved,
      statCards: [
        { label: "QUÃNG ĐƯỜNG", value: `${Math.floor(sim.dist)}m`, color: "cyan" },
        { label: "TINH THỂ", value: sim.shards, color: "lime" },
        { label: "COMBO MAX", value: `x${sim.maxCombo}`, color: "pink" },
        { label: "THỜI GIAN", value: formatTime(sim.time), color: "violet" },
      ],
      restartLabel: "CHẠY LẠI",
      onRestart: () => beginMatch(),
    });
  }

  function pauseGame() {
    if (mode !== "play") return;
    mode = "paused";
    loop.stop();
    frame.setPaused(true);
    frame.pauseMenu({
      onResume: () => resumeGame(),
      onRestart: () => beginMatch(),
      restartLabel: "CHẠY LẠI",
      buildExtra: (box) => {
        const row = el("div", "exp-setrow");
        row.appendChild(el("span", "", "TIẾN TRÌNH"));
        row.appendChild(el("span", "val", `${Math.floor(sim.dist)}m · ${sim.shards} tinh thể · x${sim.maxCombo}`));
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
      kicker: "// HÀNH LANG TRỌNG LỰC",
      heading: [["GRAVITY FLIP ", ""], ["404", "cyan"]],
      goal:
        "Nhân vật tự chạy — chạm để ĐẢO TRỌNG LỰC giữa sàn và trần. Né gai neon, nhặt tinh thể để đầy thanh NĂNG LƯỢNG và giữ COMBO x6. Khiên hiếm đỡ được một cú va chạm. Tốc độ tăng dần theo quãng đường!",
      rows: [
        { keys: ["Chạm", "Click"], text: "đảo trọng lực (chỉ khi đang bám bề mặt)" },
        { keys: ["SPACE", "↑", "W"], text: "đảo trọng lực bằng bàn phím" },
        { keys: ["ESC", "P"], text: "tạm dừng" },
      ],
      startLabel: "CHẠY!",
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
    if (mode === "play") {
      acc = Math.min(acc + dt, 0.1);
      while (acc >= STEP && mode === "play") {
        acc -= STEP;
        stepSim(sim, STEP);
        if (sim.over) break;
      }
      handleEvents(drainEvents(sim));
      if (mode === "play") {
        // vệt hạt phía sau nhân vật
        trailT += dt;
        if (trailT > 0.035) {
          trailT = 0;
          fx.trail.push({ x: sim.x - 26, y: sim.y + (Math.random() - 0.5) * 10, g: sim.g, life: 0.55, life0: 0.55 });
          if (fx.trail.length > 60) fx.trail.shift();
        }
        hudT += dt;
        if (hudT > 0.15) {
          hudT = 0;
          updateHud();
        }
      }
    }
    stepFx(dt);
    renderer.draw(sim, fx, time);

    if (TEST && sim) {
      window.__GF_STATE__ = {
        mode,
        dist: Math.floor(sim.dist),
        score: Math.floor(sim.score),
        combo: sim.combo,
        energy: Math.round(sim.energy),
        grounded: sim.grounded === null ? null : typeof sim.grounded === "string" ? sim.grounded : "platform",
        g: sim.g,
        shield: sim.shield,
        over: sim.over,
      };
    }
  }

  /* ---------------- Interface ---------------- */

  return {
    async mount(container, context) {
      ctx = context;

      const rootNode = container.getRootNode();
      if (rootNode instanceof ShadowRoot && !rootNode.querySelector("#gf-style")) {
        const style = document.createElement("style");
        style.id = "gf-style";
        style.textContent = GF_CSS;
        rootNode.appendChild(style);
      }

      frame = createExpansionFrame(container, ctx, {
        accent: "cyan",
        title: [["GRAVITY FLIP ", ""], ["404", "cyan"]],
        stats: [
          { id: "score", label: "ĐIỂM", color: "cyan", value: "000000" },
          { id: "dist", label: "QUÃNG ĐƯỜNG", color: "white", value: "0m" },
          { id: "energy", label: "NĂNG LƯỢNG", color: "lime", value: "0%", bar: true },
          { id: "combo", label: "COMBO", color: "pink", value: "x1", optional: true },
        ],
        onPauseToggle: togglePause,
      });
      frame.root.classList.add("gf-mode");

      stage = el("div", "gf-stage");
      canvas = document.createElement("canvas");
      canvas.setAttribute("aria-label", "Hành lang Gravity Flip");
      stage.appendChild(canvas);
      frame.playfield.appendChild(stage);

      /* thanh CHẠM ĐỂ ĐẢO TRỌNG LỰC */
      hintBar = el("div", "gf-hint");
      {
        const NS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(NS, "svg");
        svg.setAttribute("class", "hand");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("aria-hidden", "true");
        const p1 = document.createElementNS(NS, "path");
        p1.setAttribute(
          "d",
          "M12.6 8.6V4.9a1.7 1.7 0 0 0-3.4 0v8.6l-2-1.9a1.8 1.8 0 0 0-2.6 2.5l4.3 5.1c.66.78 1.63 1.2 2.65 1.2h2.9a3.7 3.7 0 0 0 3.7-3.7v-4.4a1.9 1.9 0 0 0-1.9-1.9h-3.65z"
        );
        p1.setAttribute("fill", "currentColor");
        svg.appendChild(p1);
        const p2 = document.createElementNS(NS, "path");
        p2.setAttribute("d", "M6.2 5.6a5 5 0 0 1 9.4-.4M4.4 8.2a7.4 7.4 0 0 1 .5-3.4");
        p2.setAttribute("fill", "none");
        p2.setAttribute("stroke", "#20e3ff");
        p2.setAttribute("stroke-width", "1.5");
        p2.setAttribute("stroke-linecap", "round");
        svg.appendChild(p2);
        hintBar.appendChild(svg);
      }
      const txt = el("div", "txt", "CHẠM ĐỂ ");
      txt.appendChild(el("b", "", "ĐẢO TRỌNG LỰC"));
      hintBar.appendChild(txt);
      frame.playfield.appendChild(hintBar);

      /* input: chạm bất kỳ đâu trên sân */
      stage.addEventListener(
        "pointerdown",
        (e) => {
          e.preventDefault();
          if (mode === "play") tryFlip(sim);
        },
        { signal: ctx.signal }
      );

      keys = createKeyboard({ signal: ctx.signal });
      keys.on(["Space", "ArrowUp", "KeyW"], () => {
        if (mode === "play") tryFlip(sim);
      });
      keys.on(["KeyP"], () => togglePause());

      renderer = createFlipRenderer(canvas, stage);
      ro = new ResizeObserver(() => renderer.fit());
      ro.observe(stage);

      loop = createLoop(update);

      if (TEST) {
        window.__GF_TEST__ = {
          flip: () => (mode === "play" ? tryFlip(sim) : false),
          kill: () => {
            if (!sim || sim.over) return false;
            sim.shield = false;
            sim.inv = 0;
            sim.over = true;
            sim.events.push({ type: "dead" });
            return true;
          },
          addEnergy: (v) => {
            if (!sim) return false;
            sim.energy = Math.min(100, sim.energy + v);
            return true;
          },
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
        delete window.__GF_STATE__;
        delete window.__GF_TEST__;
      }
    },
  };
}
