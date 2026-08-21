/**
 * Cyber Goal 404 — đá luân lưu arcade vs CPU (expansion 16–20).
 *
 * Theo ảnh reference: topbar TỶ SỐ (cyan-hồng) / LƯỢT; panel COMBO,
 * GIÓ, POWER dọc bên trái; panel SPIN bên phải; thanh "KÉO ĐỂ NGẮM ·
 * THẢ ĐỂ SÚT" dưới đáy; khung thành neon 4 vòng mục tiêu + thủ môn
 * polygon bay người. Kéo xác định hướng/độ cao, độ dài kéo = power,
 * tốc độ ngang lúc thả = spin; bàn phím: mũi tên ngắm + giữ SPACE tụ
 * lực. 10 lượt (5 mỗi bên) + sudden death, 3 difficulty, gió ở mức khó.
 */

import { createExpansionFrame } from "../_shared/frame.js";
import { createKeyboard } from "../../core/input-manager.js";
import { createLoop } from "../../core/loop.js";
import { el } from "../../core/utils.js";
import {
  createMatch,
  stepMatch,
  playerShoot,
  drainEvents,
  flightPos,
  DIFFS,
  KICKS_TOTAL,
  GOAL,
  SPOT,
} from "./engine.js";
import { createGoalRenderer } from "./render.js";
import { CG_CSS } from "./styles.js";

export function createGame() {
  let ctx = null;
  let frame = null;
  let renderer = null;
  let keys = null;
  let loop = null;
  let ro = null;
  let canvas = null;
  let stage = null;
  let scoreSpans = null;

  const TEST = typeof window !== "undefined" && window.__ARCADE_EXP16_TEST__;

  let mode = "intro"; // intro | play | paused | over
  let m = null;
  let time = 0;
  let diff = "normal";

  const fx = { particles: [] };

  /** Trạng thái ngắm (con trỏ hoặc bàn phím). */
  const aim = { active: false, tx: 800, ty: 400, power: 0, spin: 0 };
  const drag = { on: false, id: -1, sx: 0, sy: 0, trace: [] };
  let charging = false; // giữ SPACE tụ lực
  let chargeT = 0;

  /* ---------------- HUD ---------------- */

  function updateHud() {
    if (!m) return;
    scoreSpans.player.textContent = String(m.playerGoals);
    scoreSpans.cpu.textContent = String(m.cpuGoals);
    frame.setStat(
      "round",
      m.suddenDeath ? "SD" : `${String(Math.min(m.kicks + 1, KICKS_TOTAL)).padStart(2, "0")}/${KICKS_TOTAL}`
    );
  }

  function burst(x, y, color, n = 16) {
    for (let i = 0; i < n; i++) {
      if (fx.particles.length > 200) break;
      const a = Math.random() * Math.PI * 2;
      const sp = 80 + Math.random() * 320;
      fx.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        size: 4 + Math.random() * 7,
        life: 0.4 + Math.random() * 0.4,
        life0: 0.8,
        color,
      });
    }
  }

  /* ---------------- Sự kiện engine ---------------- */

  function handleEvents(events) {
    for (const ev of events) {
      switch (ev.type) {
        case "kick":
          ctx.audio.play("cg_kick");
          break;
        case "goal":
          if (ev.who === "player") {
            ctx.audio.play("cg_goal");
            frame.banner("VÀO!!!");
            if (ev.pts) frame.toast(`+${ev.pts} ĐIỂM${m.combo > 1 ? ` · COMBO x${m.combo}` : ""}`);
            burst(m.flight.tx, m.flight.ty, "#9dff3e", 26);
            burst(m.flight.tx, m.flight.ty, "#20e3ff", 14);
          } else {
            ctx.audio.play("bad");
            frame.banner("ĐỐI THỦ GHI BÀN");
          }
          updateHud();
          break;
        case "save":
          ctx.audio.play("cg_save");
          if (ev.who === "player") frame.banner("BỊ CẢN PHÁ!");
          else {
            frame.banner("CẢN PHÁ! +75");
            burst(m.flight.tx, m.flight.ty, "#3defff", 20);
          }
          updateHud();
          break;
        case "miss":
          ctx.audio.play("miss");
          frame.banner(ev.who === "player" ? "RA NGOÀI!" : "ĐỐI THỦ SÚT HỎNG");
          updateHud();
          break;
        case "post":
          ctx.audio.play("cg_post");
          frame.banner("TRÚNG CỘT!");
          burst(m.flight.tx, m.flight.ty, "#eef4ff", 12);
          updateHud();
          break;
        case "ringHit":
          frame.toast("TRÚNG VÙNG MỤC TIÊU +50");
          break;
        case "suddenDeath":
          ctx.audio.play("ap_alarm");
          frame.banner("SUDDEN DEATH!");
          updateHud();
          break;
        case "over":
          finishMatch(ev.win);
          return;
        default:
          break;
      }
    }
  }

  /* ---------------- Ngắm & sút ---------------- */

  function resetAim() {
    aim.active = false;
    aim.tx = GOAL.cx;
    aim.ty = 400;
    aim.power = 0;
    aim.spin = 0;
  }

  function shootNow() {
    if (!m || m.turn !== "player" || m.phase !== "aim") return;
    playerShoot(m, { tx: aim.tx, ty: aim.ty, power: aim.power, spin: aim.spin });
    resetAim();
  }

  function updateDragAim(e) {
    const w = renderer.toWorld(e.clientX, e.clientY);
    const dx = w.x - drag.sx;
    const dy = w.y - drag.sy;
    aim.active = true;
    aim.tx = Math.max(260, Math.min(1340, GOAL.cx + dx * 2.2));
    aim.ty = Math.max(150, Math.min(600, 430 + dy * 2.0));
    aim.power = Math.max(0.12, Math.min(1, Math.hypot(dx, dy) / 330));
    // spin: vận tốc ngang của con trỏ trong ~90ms cuối
    const now = performance.now();
    drag.trace.push({ x: w.x, t: now });
    while (drag.trace.length > 2 && now - drag.trace[0].t > 90) drag.trace.shift();
    const first = drag.trace[0];
    const dt = Math.max(16, now - first.t);
    aim.spin = Math.max(-1, Math.min(1, ((w.x - first.x) / dt) * 0.9));
  }

  /* ---------------- Vòng đời ---------------- */

  function beginMatch() {
    m = createMatch(diff);
    fx.particles.length = 0;
    resetAim();
    charging = false;
    mode = "play";
    frame.clearScreen();
    frame.setPaused(false);
    ctx.onMatchStart();
    ctx.audio.play("cg_whistle");
    frame.banner("LƯỢT CỦA BẠN!");
    updateHud();
    loop.start();
  }

  function finishMatch(win) {
    mode = "over";
    const saved = ctx.onGameOver(m.score, {
      playerGoals: m.playerGoals,
      cpuGoals: m.cpuGoals,
      win,
    });
    frame.overScreen({
      kicker: `// TỶ SỐ ${m.playerGoals} - ${m.cpuGoals} · ${DIFFS[diff].label}`,
      heading: win ? "CHIẾN THẮNG!" : "THẤT BẠI!",
      score: m.score,
      saved,
      statCards: [
        { label: "TỶ SỐ", value: `${m.playerGoals} - ${m.cpuGoals}`, color: "cyan" },
        { label: "BÀN THẮNG", value: m.goals, color: "lime" },
        { label: "CẢN PHÁ", value: m.saves, color: "violet" },
        { label: "COMBO MAX", value: `x${m.maxCombo}`, color: "pink" },
      ],
      restartLabel: "ĐÁ LẠI",
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
      restartLabel: "ĐÁ LẠI",
      buildExtra: (box) => {
        const row = el("div", "exp-setrow");
        row.appendChild(el("span", "", "TỶ SỐ"));
        row.appendChild(el("span", "val", `BẠN ${m.playerGoals} - ${m.cpuGoals} CPU · lượt ${Math.min(m.kicks + 1, KICKS_TOTAL)}`));
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
    charging = false;
    drag.on = false;
    loop.start();
  }

  function togglePause() {
    if (mode === "play") pauseGame();
    else if (mode === "paused") resumeGame();
  }

  function showIntro() {
    mode = "intro";
    loop.stop();
    const box = frame.intro({
      kicker: "// SÂN VẬN ĐỘNG CYBER",
      heading: [["CYBER GOAL ", ""], ["404", "pink"]],
      goal:
        "Đá luân lưu 5 lượt mỗi bên vs CPU (hòa → sudden death). KÉO để ngắm — độ dài kéo là LỰC, quẹt ngang lúc thả tạo SPIN, chú ý GIÓ ở mức khó. Ghi bàn liên tiếp để nhân COMBO, nhắm 4 vòng mục tiêu ở góc để ăn điểm thưởng!",
      rows: [
        { keys: ["Kéo", "Thả"], text: "kéo để ngắm · thả để sút (dài = mạnh)" },
        { keys: ["↑↓←→"], text: "chỉnh điểm ngắm bằng bàn phím" },
        { keys: ["SPACE"], text: "giữ tụ lực — thả để sút · Q/E chỉnh spin" },
        { keys: ["ESC", "P"], text: "tạm dừng" },
      ],
      startLabel: "VÀO TRẬN",
      onStart: () => beginMatch(),
    });
    // hàng chọn difficulty chèn trước nút CTA
    const diffRow = el("div", "cg-diffrow");
    const btns = new Map();
    for (const [key, cfg] of Object.entries(DIFFS)) {
      const b = el("button", "cg-diffbtn", cfg.label);
      b.type = "button";
      b.addEventListener("click", () => {
        diff = key;
        ctx.storage.setPref("cg-diff", key);
        ctx.audio.play("ui");
        for (const [k2, b2] of btns) b2.classList.toggle("on", k2 === key);
      });
      btns.set(key, b);
      diffRow.appendChild(b);
    }
    btns.get(diff)?.classList.add("on");
    const cta = box.querySelector(".exp-cta");
    box.insertBefore(diffRow, cta);

    m = createMatch(diff);
    renderer.fit();
    renderer.draw(m, aim, fx, 0);
    updateHud();
  }

  /* ---------------- Vòng lặp ---------------- */

  function update(dt) {
    time += dt;
    if (mode === "play" && m) {
      // bàn phím: ngắm + tụ lực
      if (m.turn === "player" && m.phase === "aim") {
        const spd = 460 * dt;
        let moved = false;
        if (keys.isDown("ArrowLeft")) { aim.tx -= spd; moved = true; }
        if (keys.isDown("ArrowRight")) { aim.tx += spd; moved = true; }
        if (keys.isDown("ArrowUp")) { aim.ty -= spd; moved = true; }
        if (keys.isDown("ArrowDown")) { aim.ty += spd; moved = true; }
        if (keys.isDown("KeyQ")) { aim.spin = Math.max(-1, aim.spin - 1.6 * dt); moved = true; }
        if (keys.isDown("KeyE")) { aim.spin = Math.min(1, aim.spin + 1.6 * dt); moved = true; }
        if (moved) {
          aim.active = true;
          aim.tx = Math.max(260, Math.min(1340, aim.tx));
          aim.ty = Math.max(150, Math.min(600, aim.ty));
        }
        const spaceHeld = keys.isDown("Space");
        if (spaceHeld) {
          if (!charging) {
            charging = true;
            chargeT = 0;
            aim.active = true;
          }
          chargeT += dt;
          const cyc = chargeT * 1.15;
          aim.power = 0.12 + 0.88 * Math.abs(Math.sin(cyc * Math.PI * 0.5)); // ping-pong 0.12..1
        } else if (charging) {
          charging = false;
          shootNow();
        }
      }
      stepMatch(m, dt);
      handleEvents(drainEvents(m));
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
      p.vy += 300 * dt;
    }
    if (m) renderer.draw(m, aim, fx, time);

    if (TEST && m) {
      window.__CG_STATE__ = {
        mode,
        phase: m.phase,
        turn: m.turn,
        kicks: m.kicks,
        playerGoals: m.playerGoals,
        cpuGoals: m.cpuGoals,
        combo: m.combo,
        score: m.score,
        suddenDeath: m.suddenDeath,
        over: m.over,
        flightK: m.flight ? flightPos(m.flight).k : null,
      };
    }
  }

  /* ---------------- Interface ---------------- */

  return {
    async mount(container, context) {
      ctx = context;
      diff = ctx.storage.getPref("cg-diff", "normal");
      if (!DIFFS[diff]) diff = "normal";

      const rootNode = container.getRootNode();
      if (rootNode instanceof ShadowRoot && !rootNode.querySelector("#cg-style")) {
        const style = document.createElement("style");
        style.id = "cg-style";
        style.textContent = CG_CSS;
        rootNode.appendChild(style);
      }

      frame = createExpansionFrame(container, ctx, {
        accent: "pink",
        title: [["CYBER GOAL ", ""], ["404", "pink"]],
        stats: [
          { id: "scoreline", label: "TỶ SỐ", color: "white", value: "0 - 0" },
          { id: "round", label: "LƯỢT", color: "white", value: `01/${KICKS_TOTAL}` },
        ],
        onPauseToggle: togglePause,
      });
      frame.root.classList.add("cg-mode");

      // tỷ số hai màu: bạn (cyan) - CPU (hồng)
      const scoreVal = frame.statBox("scoreline")?.querySelector(".val");
      scoreVal.textContent = "";
      const sp = el("span", "cg-sc-p", "0");
      const sep = el("span", "cg-sc-sep", " - ");
      const sc = el("span", "cg-sc-c", "0");
      scoreVal.append(sp, sep, sc);
      scoreSpans = { player: sp, cpu: sc };

      stage = el("div", "cg-stage");
      canvas = document.createElement("canvas");
      canvas.setAttribute("aria-label", "Sân đá luân lưu Cyber Goal");
      stage.appendChild(canvas);
      frame.playfield.appendChild(stage);

      /* kéo-thả để sút */
      canvas.addEventListener(
        "pointerdown",
        (e) => {
          if (mode !== "play" || !m || m.turn !== "player" || m.phase !== "aim") return;
          e.preventDefault();
          const w = renderer.toWorld(e.clientX, e.clientY);
          drag.on = true;
          drag.id = e.pointerId;
          drag.sx = w.x;
          drag.sy = w.y;
          drag.trace.length = 0;
          updateDragAim(e);
        },
        { signal: ctx.signal }
      );
      window.addEventListener(
        "pointermove",
        (e) => {
          if (drag.on && e.pointerId === drag.id) updateDragAim(e);
        },
        { signal: ctx.signal }
      );
      const endDrag = (e) => {
        if (!drag.on || e.pointerId !== drag.id) return;
        drag.on = false;
        const w = renderer.toWorld(e.clientX, e.clientY);
        const len = Math.hypot(w.x - drag.sx, w.y - drag.sy);
        if (len >= 46) shootNow();
        else resetAim();
      };
      window.addEventListener("pointerup", endDrag, { signal: ctx.signal });
      window.addEventListener("pointercancel", endDrag, { signal: ctx.signal });

      keys = createKeyboard({ signal: ctx.signal });
      keys.on(["Space", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "KeyQ", "KeyE"], () => {});
      keys.on(["KeyP"], () => togglePause());

      renderer = createGoalRenderer(canvas, stage);
      ro = new ResizeObserver(() => renderer.fit());
      ro.observe(stage);

      loop = createLoop(update);

      if (TEST) {
        window.__CG_TEST__ = {
          shoot: (tx, ty, power, spin = 0) => {
            if (!m || m.turn !== "player" || m.phase !== "aim") return false;
            return playerShoot(m, { tx, ty, power, spin });
          },
          setDiff: (d) => {
            if (DIFFS[d]) diff = d;
            return diff;
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
      m = null;
      if (typeof window !== "undefined") {
        delete window.__CG_STATE__;
        delete window.__CG_TEST__;
      }
    },
  };
}
