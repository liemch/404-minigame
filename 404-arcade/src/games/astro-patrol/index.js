/**
 * Astro Patrol 404 — bắn phi thuyền dọc 5 wave + boss (expansion 11–15).
 *
 * Theo ảnh reference: topbar ĐIỂM / KHIÊN % (thanh) / WAVE / COMBO /
 * BOSS % (thanh); thanh máu boss đầu lâu 2 bên dưới topbar; không gian
 * sao + asteroid tinh thể tím; boss lục giác mắt đỏ; joystick ảo
 * VÙNG DI CHUYỂN trái + NÚT BẮN crosshair phải. WASD/chuột di chuyển,
 * SPACE/click bắn, tùy chọn auto-fire trong pause. Engine thuần
 * (object pool + spatial grid + giới hạn đạn + khiên trước HP +
 * boss 2 phase telegraph) trong engine.js.
 */

import { createExpansionFrame } from "../_shared/frame.js";
import { createKeyboard } from "../../core/input-manager.js";
import { createLoop } from "../../core/loop.js";
import { el, svgIcon, formatScore, formatTime } from "../../core/utils.js";
import { createSim, stepSim, drainEvents, damagePlayer, spawnEnemy, spawnAsteroid, WORLD } from "./engine.js";
import { BOSS_DEF } from "./waves.js";
import { createAstroRenderer } from "./render.js";
import { AP_CSS } from "./styles.js";

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
  let bossBar = null;
  let bossFill = null;
  let bossPct = null;
  let fireBtn = null;

  const TEST = typeof window !== "undefined" && window.__ARCADE_EXP11_TEST__;

  let mode = "intro"; // intro | play | paused | over
  let sim = null;
  let acc = 0;
  let time = 0;
  let stateT = 0;
  let hudT = 0;
  let autoFire = false;

  const fx = { particles: [], rings: [] };
  const touch = { joyActive: false, joyId: -1, mx: 0, my: 0, fire: false };
  const pointer = { targetX: null, targetY: null, fire: false };

  /* ---------------- HUD ---------------- */

  function updateHud() {
    if (!sim) return;
    frame.setStat("score", formatScore(sim.score));
    frame.setStat("shield", `${Math.round(sim.player.shield)}%`);
    frame.setStatBar("shield", sim.player.shield);
    frame.setStat("wave", String(Math.min(sim.wave, 6)).padStart(2, "0"));
    frame.setStat("combo", `x${sim.combo}`);
    frame.setStat("hp", `${Math.max(0, Math.round(sim.player.hp))}%`);
    frame.setStatBar("hp", sim.player.hp);
    if (sim.boss) {
      const pct = Math.max(0, Math.round((sim.boss.hp / sim.boss.maxHp) * 100));
      frame.setStat("boss", `${pct}%`);
      frame.setStatBar("boss", pct);
      bossFill.style.width = `${pct}%`;
      bossPct.textContent = `${pct}%`;
      bossBar.classList.add("show");
    } else {
      frame.setStat("boss", "—");
      frame.setStatBar("boss", 0);
      bossBar.classList.remove("show");
    }
  }

  /* ---------------- FX ---------------- */

  function burst(x, y, color, n = 12, ringColor = null) {
    for (let i = 0; i < n; i++) {
      if (fx.particles.length > 240) break;
      const a = Math.random() * Math.PI * 2;
      const sp = 70 + Math.random() * 220;
      fx.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        rot: Math.random() * 6.3,
        size: 2.5 + Math.random() * 5,
        life: 0.4 + Math.random() * 0.4,
        life0: 0.8,
        color,
      });
    }
    if (ringColor) fx.rings.push({ x, y, r0: 6, grow: 52, life: 0.45, life0: 0.45, color: ringColor });
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
        case "shoot":
          ctx.audio.play("ap_shoot");
          break;
        case "eshoot":
          ctx.audio.play("botshot");
          break;
        case "ehit":
          ctx.audio.play("hitmark");
          burst(ev.x, ev.y, "#ffd9a0", 3);
          break;
        case "kill":
          ctx.audio.play("kill");
          burst(ev.x, ev.y, "#ffb347", 14, "rgba(255,171,61,0.8)");
          updateHud();
          break;
        case "boom":
          ctx.audio.play("boom");
          burst(ev.x, ev.y, "#a8afc8", 16, "rgba(170,180,220,0.7)");
          updateHud();
          break;
        case "shieldHit":
          ctx.audio.play("bb_steel");
          frame.toast("KHIÊN HẤP THỤ SÁT THƯƠNG!");
          updateHud();
          break;
        case "hurt":
          ctx.audio.play("hurt");
          burst(sim.player.x, sim.player.y, "#ff6a7e", 10);
          updateHud();
          break;
        case "pickup":
          ctx.audio.play("pickup");
          frame.toast(ev.kind === "shield" ? "+40 KHIÊN!" : "NÂNG CẤP HỎA LỰC!");
          updateHud();
          break;
        case "wave":
          frame.banner(`WAVE ${String(ev.n).padStart(2, "0")} — ${ev.name}`);
          ctx.audio.play("wave");
          updateHud();
          break;
        case "bossIncoming":
          frame.banner(`BOSS — ${BOSS_DEF.name}`);
          ctx.audio.play("ap_alarm");
          break;
        case "bossTelegraph":
          ctx.audio.play("vr_warn");
          break;
        case "bossPhase":
          frame.banner("BOSS PHASE 2!");
          ctx.audio.play("ap_alarm");
          break;
        case "bosshit":
          burst(ev.x, ev.y, "#c9b6ff", 2);
          break;
        case "bossDead":
          burst(WORLD.w / 2, 130, "#ffb347", 40, "rgba(255,120,80,0.9)");
          ctx.audio.play("boom");
          break;
        case "victory":
          finishMatch(true);
          return;
        case "gameOver":
          burst(sim.player.x, sim.player.y, "#ff8091", 26, "rgba(255,80,110,0.9)");
          finishMatch(false);
          return;
        default:
          break;
      }
    }
  }

  /* ---------------- Vòng đời ---------------- */

  function beginMatch() {
    sim = createSim({ test: TEST });
    sim.autoFire = autoFire;
    fx.particles.length = 0;
    fx.rings.length = 0;
    acc = 0;
    mode = "play";
    frame.clearScreen();
    frame.setPaused(false);
    ctx.onMatchStart();
    ctx.audio.play("start");
    updateHud();
    loop.start();
  }

  function finishMatch(victory) {
    mode = "over";
    const saved = ctx.onGameOver(sim.score, {
      wave: sim.wave,
      kills: sim.kills,
      maxCombo: sim.maxCombo,
      victory,
    });
    frame.overScreen({
      kicker: victory ? "// KHU VỰC AN TOÀN" : "// TÍN HIỆU MẤT",
      heading: victory ? "DẸP YÊN KHU VỰC 404!" : "TÀU BỊ PHÁ HỦY!",
      score: sim.score,
      saved,
      statCards: [
        { label: "WAVE", value: `${Math.min(sim.wave, 6)}/6`, color: "cyan" },
        { label: "TIÊU DIỆT", value: sim.kills, color: "gold" },
        { label: "COMBO MAX", value: `x${sim.maxCombo}`, color: "pink" },
        { label: "THỜI GIAN", value: formatTime(sim.time), color: "violet" },
      ],
      restartLabel: "XUẤT KÍCH LẠI",
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
      restartLabel: "XUẤT KÍCH LẠI",
      buildExtra: (box) => {
        const row = el("div", "exp-setrow");
        row.appendChild(el("span", "", "TỰ ĐỘNG BẮN"));
        const btn = el("button", "exp-menu-btn", autoFire ? "BẬT" : "TẮT");
        btn.type = "button";
        btn.style.minHeight = "34px";
        btn.style.padding = "0 22px";
        btn.addEventListener("click", () => {
          autoFire = !autoFire;
          if (sim) sim.autoFire = autoFire;
          ctx.storage.setPref("ap-autofire", autoFire);
          btn.textContent = autoFire ? "BẬT" : "TẮT";
          ctx.audio.play("ui");
        });
        row.appendChild(btn);
        box.appendChild(row);
        const prog = el("div", "exp-setrow");
        prog.appendChild(el("span", "", "TIẾN TRÌNH"));
        prog.appendChild(el("span", "val", `WAVE ${Math.min(sim.wave, 6)}/6 · ${sim.kills} kill`));
        box.appendChild(prog);
      },
    });
  }

  function resumeGame() {
    if (mode !== "paused") return;
    mode = "play";
    frame.clearScreen();
    frame.setPaused(false);
    keys.clearDown();
    touch.fire = false;
    pointer.fire = false;
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
      kicker: "// TUẦN TRA KHU VỰC 404",
      heading: [["ASTRO PATROL ", ""], ["404", "cyan"]],
      goal:
        "Sống sót qua 5 wave địch và hạ MINI-BOSS cuối. Khiên hấp thụ sát thương trước HP — nhặt lục giác khiên và tia sét để nâng hỏa lực. Né asteroid, coi chừng tàu lao và đạn quạt của boss!",
      rows: [
        { keys: ["WASD", "↑↓←→"], text: "di chuyển (hoặc rê chuột)" },
        { keys: ["SPACE", "Click"], text: "bắn (bật auto-fire trong menu tạm dừng)" },
        { keys: ["Chạm"], text: "joystick trái + NÚT BẮN phải trên mobile" },
        { keys: ["ESC"], text: "tạm dừng" },
      ],
      startLabel: "XUẤT KÍCH",
      onStart: () => beginMatch(),
    });
    sim = createSim({ test: TEST });
    renderer.fit();
    renderer.draw(sim, fx, 0);
    updateHud();
  }

  /* ---------------- Input ---------------- */

  function gatherInput() {
    const left = keys.isDown("ArrowLeft") || keys.isDown("KeyA");
    const right = keys.isDown("ArrowRight") || keys.isDown("KeyD");
    const up = keys.isDown("ArrowUp") || keys.isDown("KeyW");
    const down = keys.isDown("ArrowDown") || keys.isDown("KeyS");
    let mx = (right ? 1 : 0) - (left ? 1 : 0);
    let my = (down ? 1 : 0) - (up ? 1 : 0);
    let targetX = null;
    let targetY = null;
    if (touch.joyActive) {
      mx = touch.mx;
      my = touch.my;
    } else if (!mx && !my && pointer.targetX !== null) {
      targetX = pointer.targetX;
      targetY = pointer.targetY;
    }
    const fire = keys.isDown("Space") || touch.fire || pointer.fire;
    return { mx, my, targetX, targetY, fire };
  }

  /* ---------------- Vòng lặp ---------------- */

  function update(dt) {
    time += dt;
    if (mode === "play") {
      const input = gatherInput();
      acc = Math.min(acc + dt, 0.1);
      while (acc >= STEP && mode === "play") {
        acc -= STEP;
        stepSim(sim, input, STEP);
        if (sim.over || sim.victory) break;
      }
      handleEvents(drainEvents(sim));
      if (mode === "play") {
        hudT += dt;
        if (hudT > 0.2) {
          hudT = 0;
          updateHud();
        }
      }
    }
    stepFx(dt);
    renderer.draw(sim, fx, time);

    if (TEST && sim) {
      stateT += dt;
      if (stateT > 0.35) {
        stateT = 0;
        window.__AP_STATE__ = {
          mode,
          wave: sim.wave,
          waveState: sim.waveState,
          hp: Math.round(sim.player.hp),
          shield: Math.round(sim.player.shield),
          power: sim.player.power,
          combo: sim.combo,
          score: sim.score,
          kills: sim.kills,
          enemies: sim.enemies.length,
          queue: sim.spawnQueue.length,
          bullets: sim.bullets.length,
          ebullets: sim.ebullets.length,
          bossHp: sim.boss ? sim.boss.hp : null,
          bossPhase: sim.boss ? sim.boss.phase : null,
        };
      }
    }
  }

  /* ---------------- Interface ---------------- */

  return {
    async mount(container, context) {
      ctx = context;
      autoFire = !!ctx.storage.getPref("ap-autofire", window.matchMedia("(pointer: coarse)").matches);

      const rootNode = container.getRootNode();
      if (rootNode instanceof ShadowRoot && !rootNode.querySelector("#ap-style")) {
        const style = document.createElement("style");
        style.id = "ap-style";
        style.textContent = AP_CSS;
        rootNode.appendChild(style);
      }

      frame = createExpansionFrame(container, ctx, {
        accent: "cyan",
        title: [["ASTRO PATROL ", ""], ["404", "cyan"]],
        stats: [
          { id: "score", label: "ĐIỂM", color: "white", value: "000000" },
          { id: "shield", label: "KHIÊN", color: "cyan", value: "50%", bar: true },
          { id: "hp", label: "HP", color: "green", value: "100%", bar: true, optional: true },
          { id: "wave", label: "WAVE", color: "white", value: "01" },
          { id: "combo", label: "COMBO", color: "pink", value: "x0" },
          { id: "boss", label: "BOSS", color: "pink", value: "—", bar: true, optional: true },
        ],
        onPauseToggle: togglePause,
        buttonLabels: { home: "HOME" },
      });
      frame.root.classList.add("ap-mode");

      stage = el("div", "ap-stage");
      canvas = document.createElement("canvas");
      canvas.setAttribute("aria-label", "Không gian Astro Patrol");
      stage.appendChild(canvas);
      frame.playfield.appendChild(stage);

      /* thanh máu boss */
      bossBar = el("div", "ap-bossbar");
      bossBar.appendChild(svgIcon("i-skull"));
      const track = el("div", "track");
      bossFill = el("div", "fill");
      bossPct = el("div", "pct", "100%");
      track.appendChild(bossFill);
      track.appendChild(bossPct);
      bossBar.appendChild(track);
      bossBar.appendChild(svgIcon("i-skull"));
      frame.playfield.appendChild(bossBar);

      /* joystick ảo */
      const joy = el("div", "ap-joy");
      const pad = el("div", "pad");
      for (const dir of ["up", "down", "left", "right"]) pad.appendChild(el("i", `arr ${dir}`));
      const knob = el("div", "knob");
      pad.appendChild(knob);
      joy.appendChild(pad);
      joy.appendChild(el("div", "lbl", "VÙNG DI CHUYỂN"));
      frame.playfield.appendChild(joy);

      const joyMove = (e) => {
        const rect = pad.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        let dx = (e.clientX - cx) / (rect.width / 2);
        let dy = (e.clientY - cy) / (rect.height / 2);
        const d = Math.hypot(dx, dy);
        if (d > 1) {
          dx /= d;
          dy /= d;
        }
        touch.mx = dx;
        touch.my = dy;
        knob.style.transform = `translate(calc(-50% + ${dx * 34}px), calc(-50% + ${dy * 34}px))`;
      };
      pad.addEventListener(
        "pointerdown",
        (e) => {
          e.preventDefault();
          touch.joyActive = true;
          touch.joyId = e.pointerId;
          joyMove(e);
        },
        { signal: ctx.signal }
      );
      window.addEventListener(
        "pointermove",
        (e) => {
          if (touch.joyActive && e.pointerId === touch.joyId) joyMove(e);
        },
        { signal: ctx.signal }
      );
      const joyEnd = (e) => {
        if (e.pointerId !== touch.joyId) return;
        touch.joyActive = false;
        touch.mx = 0;
        touch.my = 0;
        knob.style.transform = "translate(-50%, -50%)";
      };
      window.addEventListener("pointerup", joyEnd, { signal: ctx.signal });
      window.addEventListener("pointercancel", joyEnd, { signal: ctx.signal });

      /* nút bắn */
      const fire = el("div", "ap-fire");
      fireBtn = el("div", "btn");
      for (const d of ["n", "s", "w", "e"]) fireBtn.appendChild(el("i", `tick ${d}`));
      fire.appendChild(fireBtn);
      fire.appendChild(el("div", "lbl", "NÚT BẮN"));
      frame.playfield.appendChild(fire);
      fireBtn.addEventListener(
        "pointerdown",
        (e) => {
          e.preventDefault();
          touch.fire = true;
          fireBtn.classList.add("held");
        },
        { signal: ctx.signal }
      );
      const fireEnd = () => {
        touch.fire = false;
        fireBtn.classList.remove("held");
      };
      window.addEventListener("pointerup", fireEnd, { signal: ctx.signal });
      window.addEventListener("pointercancel", fireEnd, { signal: ctx.signal });

      /* chuột trên canvas: rê để lái, giữ để bắn */
      canvas.addEventListener(
        "pointermove",
        (e) => {
          if (e.pointerType === "touch") return;
          const w = renderer.toWorld(e.clientX, e.clientY);
          pointer.targetX = w.x;
          pointer.targetY = w.y;
        },
        { signal: ctx.signal }
      );
      canvas.addEventListener(
        "pointerdown",
        (e) => {
          if (e.pointerType === "touch") return;
          e.preventDefault();
          pointer.fire = true;
        },
        { signal: ctx.signal }
      );
      window.addEventListener("pointerup", () => (pointer.fire = false), { signal: ctx.signal });
      canvas.addEventListener(
        "pointerleave",
        () => {
          pointer.targetX = null;
          pointer.targetY = null;
        },
        { signal: ctx.signal }
      );

      renderer = createAstroRenderer(canvas, stage);
      ro = new ResizeObserver(() => renderer.fit());
      ro.observe(stage);

      keys = createKeyboard({ signal: ctx.signal });
      keys.on(["Space"], () => {}); // đăng ký để preventDefault; trạng thái đọc qua isDown
      keys.on(["KeyP"], () => togglePause());
      keys.on(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "KeyA", "KeyD", "KeyW", "KeyS"], () => {
        pointer.targetX = null;
        pointer.targetY = null;
      });

      loop = createLoop(update);

      if (TEST) {
        window.__AP_TEST__ = {
          clearWave: () => {
            if (!sim) return false;
            sim.spawnQueue.length = 0;
            for (const e of sim.enemies) {
              e.hp = 0;
            }
            sim.enemies.length = 0;
            return true;
          },
          hitPlayer: (d) => {
            if (!sim) return false;
            sim.player.inv = 0;
            damagePlayer(sim, d);
            return true;
          },
          setBossHp: (hp) => {
            if (!sim || !sim.boss) return false;
            sim.boss.hp = hp;
            return true;
          },
          setShield: (v) => {
            if (!sim) return false;
            sim.player.shield = v;
            return true;
          },
          // dàn cảnh QA: sinh địch / asteroid tại chỗ (chỉ TEST mode)
          stage: (list) => {
            if (!sim) return false;
            for (const s of list) spawnEnemy(sim, s.type, s.x);
            return true;
          },
          rocks: (n) => {
            if (!sim) return false;
            for (let i = 0; i < n; i++) spawnAsteroid(sim, null, 30 + Math.random() * (WORLD.h - 160));
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
        delete window.__AP_STATE__;
        delete window.__AP_TEST__;
      }
    },
  };
}
