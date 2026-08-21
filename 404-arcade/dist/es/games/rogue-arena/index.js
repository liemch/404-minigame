/**
 * Rogue Arena — sinh tồn 3 phút trong đấu trường (game 9).
 *
 * Theo plan + ảnh reference: HUD tiêu đề trái + CẤP/XP, đồng hồ giữa,
 * ĐIỂM / HP / XP / HẠ + nút icon nhỏ bên phải; vũ khí TỰ NHẮM mục tiêu
 * gần nhất (hysteresis chống rung); XP shard hút về khi gần; LEVEL-UP
 * DỪNG THẬT gameplay và hiện 3 lựa chọn (panel trái như ảnh, bộ 8 nâng
 * cấp, không hiện cái đã max); health pickup; spawn tăng dần; boss phút
 * thứ 3. Hiệu năng: object pool + spatial hash trong engine.js.
 * Mobile: joystick ảo. 3 chỉ báo kỹ năng tròn dưới đáy như ảnh.
 */

import { createExpansionFrame } from "../_shared/frame.js";
import { createKeyboard } from "../../core/input-manager.js";
import { createLoop } from "../../core/loop.js";
import { createCanvas } from "../../core/canvas.js";
import { el, formatScore, formatTime } from "../../core/utils.js";
import { ARENA_W, ARENA_H, MATCH_TIME, UPGRADES } from "./data.js";
import { createArena } from "./engine.js";
import { createArenaRenderer, paintUpgradeIcon } from "./render.js";
import { RA_CSS } from "./styles.js";

export function createGame() {
  let ctx = null;
  let frame = null;
  let arena = null;
  let renderer = null;
  let view = null;
  let keys = null;
  let loop = null;
  let levelPanel = null;
  let abilityEls = null;
  let joyEl = null;
  let joyKnob = null;

  const TEST = typeof window !== "undefined" && window.__ARCADE_EXP5_TEST__;

  let mode = "intro"; // intro | play | levelup | paused | over
  let time = 0;
  let stateT = 0;
  let sfxT = {};
  const joy = { active: false, id: -1, cx: 0, cy: 0, mx: 0, my: 0 };
  let choiceButtons = [];

  /* ---------------- HUD ---------------- */

  function updateHud() {
    frame.setStat("level", String(arena.level).padStart(2, "0"));
    frame.setStatBar("level", (arena.xp / arena.xpToNext) * 100);
    frame.setStat("time", formatTime(Math.max(0, MATCH_TIME - arena.time)));
    frame.setStat("score", formatScore(arena.score));
    frame.setStat("hp", String(Math.max(0, Math.round(arena.player.hp))));
    frame.setStatBar("hp", (arena.player.hp / arena.player.maxHp) * 100);
    frame.setStat("xp", `${Math.round((arena.xp / arena.xpToNext) * 100)}%`);
    frame.setStatBar("xp", (arena.xp / arena.xpToNext) * 100);
    frame.setStat("kills", String(arena.kills));
  }

  function updateAbilities() {
    const p = arena.player;
    abilityEls.multishot.textContent = String(p.projectiles);
    abilityEls.pierce.textContent = String(p.pierce);
    abilityEls.speed.textContent = (p.speed / 100).toFixed(1);
  }

  /* ---------------- Level-up (pause thật) ---------------- */

  function openLevelUp() {
    mode = "levelup";
    const choices = arena.rollChoices();
    levelPanel.textContent = "";
    const inBox = el("div", "in");
    inBox.appendChild(el("h3", "", "NÂNG CẤP!"));
    inBox.appendChild(el("div", "sub", "Chọn 1 kỹ năng mới"));
    choiceButtons = choices.map((u, i) => {
      const b = el("button", "ra-choice");
      b.type = "button";
      b.dataset.tone = u.tone || "cyan";
      const ico = el("span", "ico");
      const cv = document.createElement("canvas");
      paintUpgradeIcon(cv, u.id, u.tone || "cyan");
      ico.appendChild(cv);
      b.appendChild(ico);
      b.appendChild(el("div", "nm", u.name));
      b.appendChild(el("div", "ds", u.description));
      if (Number.isFinite(u.maxLevel)) {
        const pips = el("div", "pips");
        const cur = arena.upgradeLevels[u.id] || 0;
        for (let k = 0; k < u.maxLevel; k++) {
          const p = el("i");
          if (k < cur) p.classList.add("on");
          else if (k === cur) p.classList.add("next");
          pips.appendChild(p);
        }
        b.appendChild(pips);
      }
      const kbd = el("kbd", "", String(i + 1));
      b.appendChild(kbd);
      b.addEventListener("click", () => chooseUpgrade(u));
      inBox.appendChild(b);
      return b;
    });
    levelPanel.appendChild(inBox);
    levelPanel.hidden = false;
    ctx.audio.play("levelup");
    requestAnimationFrame(() => choiceButtons[0]?.focus());
  }

  function chooseUpgrade(u) {
    arena.applyUpgrade(u);
    ctx.audio.play("upgrade");
    updateAbilities();
    if (arena.pendingLevelUps > 0) {
      openLevelUp(); // dồn nhiều cấp — chọn tiếp
      return;
    }
    levelPanel.hidden = true;
    mode = "play";
    keys.clearDown();
  }

  /* ---------------- Vòng đời ---------------- */

  function startMatch() {
    arena = createArena({ test: TEST });
    mode = "play";
    time = 0;
    frame.clearScreen();
    frame.setPaused(false);
    levelPanel.hidden = true;
    ctx.onMatchStart();
    ctx.audio.play("start");
    frame.banner("SỐNG SÓT 3 PHÚT!");
    updateHud();
    updateAbilities();
    loop.start();
  }

  function endMatch(victory) {
    mode = "over";
    levelPanel.hidden = true;
    const saved = ctx.onGameOver(arena.score, { kills: arena.kills, level: arena.level, victory });
    frame.overScreen({
      kicker: victory ? "// SỐNG SÓT THÀNH CÔNG" : "// TÍN HIỆU MẤT",
      heading: victory ? "BẠN ĐÃ SỐNG SÓT!" : "GỤC NGÃ TRONG ĐẤU TRƯỜNG",
      score: arena.score,
      saved,
      statCards: [
        { label: "THỜI GIAN", value: formatTime(Math.min(MATCH_TIME, arena.time)), color: "cyan" },
        { label: "ĐÃ HẠ", value: arena.kills, color: "red" },
        { label: "CẤP ĐẠT", value: arena.level, color: "gold" },
        { label: "XP THU THẬP", value: arena.gemsTaken, color: "green" },
      ],
      restartLabel: "CHIẾN LẠI",
      onRestart: () => startMatch(),
    });
    ctx.audio.play(victory ? "win" : "over");
  }

  function pauseGame() {
    if (mode !== "play") return;
    mode = "paused";
    loop.stop();
    frame.setPaused(true);
    frame.pauseMenu({
      onResume: () => resumeGame(),
      onRestart: () => startMatch(),
      restartLabel: "CHIẾN LẠI",
      buildExtra: (box) => {
        const row = el("div", "exp-setrow");
        row.appendChild(el("span", "", "TRẠNG THÁI"));
        row.appendChild(el("span", "val", `CẤP ${arena.level} · HẠ ${arena.kills} · CÒN ${formatTime(Math.max(0, MATCH_TIME - arena.time))}`));
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
    // đang chọn nâng cấp: Esc không thoát — phải chọn (pause thật)
  }

  /* ---------------- SFX ---------------- */

  function throttled(name, minGap) {
    if (time - (sfxT[name] || -9) < minGap) return;
    sfxT[name] = time;
    ctx.audio.play(name);
  }

  function handleEvents(events) {
    renderer.addEvents(events, arena, time);
    for (const e of events) {
      switch (e.type) {
        case "shoot":
          throttled("zap", 0.16);
          break;
        case "kill":
          throttled("squash", 0.1);
          break;
        case "gem":
          throttled("xp", 0.08);
          break;
        case "heal":
          ctx.audio.play("pickup");
          break;
        case "hurt":
          ctx.audio.play("hurt2");
          break;
        case "levelup":
          break; // xử lý qua pendingLevelUps
        case "boss":
          frame.banner("BOSS XUẤT HIỆN!");
          ctx.audio.play("wave");
          break;
        case "bossdown":
          frame.banner("BOSS BỊ HẠ! +1500");
          ctx.audio.play("record");
          break;
        case "victory":
          endMatch(true);
          break;
        case "defeat":
          endMatch(false);
          break;
      }
    }
  }

  /* ---------------- Vòng lặp ---------------- */

  function gatherInput() {
    let mx = (keys.isDown("ArrowRight") || keys.isDown("KeyD") ? 1 : 0) - (keys.isDown("ArrowLeft") || keys.isDown("KeyA") ? 1 : 0);
    let my = (keys.isDown("ArrowDown") || keys.isDown("KeyS") ? 1 : 0) - (keys.isDown("ArrowUp") || keys.isDown("KeyW") ? 1 : 0);
    if (joy.active) {
      mx += joy.mx;
      my += joy.my;
    }
    return { mx, my };
  }

  function update(dt) {
    time += dt;
    if (mode === "play") {
      arena.update(TEST ? dt * 2 : dt, gatherInput());
      handleEvents(arena.drainEvents());
      if (mode === "play" && arena.pendingLevelUps > 0) openLevelUp();
      updateHud();
      if (TEST) {
        stateT += dt;
        if (stateT > 0.4) {
          stateT = 0;
          window.__RA_STATE__ = {
            mode,
            time: Math.round(arena.time),
            hp: Math.round(arena.player.hp),
            level: arena.level,
            kills: arena.kills,
            score: arena.score,
            pending: arena.pendingLevelUps,
          };
        }
      }
    }
    renderer.draw(arena, dt, time);
  }

  /* ---------------- Intro ---------------- */

  function showIntro() {
    mode = "intro";
    loop.stop();
    frame.intro({
      kicker: "// GIAO THỨC SINH TỒN",
      heading: [["ROGUE ", ""], ["ARENA", "pink"]],
      goal:
        "Sống sót 3 PHÚT trong đấu trường. Vũ khí tự nhắm mục tiêu gần nhất — bạn chỉ cần DI CHUYỂN và né. Hút mảnh XP để lên cấp, mỗi cấp chọn 1 trong 3 nâng cấp. Boss xuất hiện ở phút thứ 3!",
      rows: [
        { keys: ["W A S D", "↑↓←→"], text: "di chuyển (mobile: joystick ảo)" },
        { keys: ["1", "2", "3"], text: "chọn nâng cấp khi lên cấp" },
        { keys: ["ESC"], text: "tạm dừng" },
      ],
      startLabel: "VÀO ĐẤU TRƯỜNG",
      onStart: () => startMatch(),
    });
    renderer.draw(arena, 0, 0);
  }

  /* ---------------- Interface ---------------- */

  return {
    async mount(container, context) {
      ctx = context;

      const rootNode = container.getRootNode();
      if (rootNode instanceof ShadowRoot && !rootNode.querySelector("#ra-style")) {
        const style = document.createElement("style");
        style.id = "ra-style";
        style.textContent = RA_CSS;
        rootNode.appendChild(style);
      }

      frame = createExpansionFrame(container, ctx, {
        accent: "pink",
        title: [["ROGUE ", ""], ["ARENA", "pink"]],
        buttonStyle: "compact",
        stats: [
          { id: "level", label: "CẤP", color: "white", value: "01", bar: true },
          { id: "time", label: "THỜI GIAN", color: "white", value: "03:00" },
          { id: "score", label: "ĐIỂM", color: "cyan", value: "000000" },
          { id: "hp", label: "HP", color: "pink", value: "100", bar: true },
          { id: "xp", label: "XP", color: "green", value: "0%", bar: true, optional: true },
          { id: "kills", label: "HẠ", color: "red", value: "0" },
        ],
        onPauseToggle: togglePause,
      });

      const stage = el("div", "ra-stage");
      frame.playfield.appendChild(stage);
      view = createCanvas(stage, { width: ARENA_W, height: ARENA_H });
      renderer = createArenaRenderer(view.ctx, { reducedMotion: ctx.reducedMotion });
      arena = createArena({ test: TEST });

      /* Panel level-up */
      levelPanel = el("aside", "ra-levelup");
      levelPanel.hidden = true;
      frame.playfield.appendChild(levelPanel);

      /* 3 chỉ báo kỹ năng dưới đáy (như ảnh) */
      const abilities = el("div", "ra-abilities");
      const mkAb = (id, tone) => {
        const box = el("div", "ra-ab");
        box.dataset.tone = tone;
        const ring = el("div", "ring");
        const cv = document.createElement("canvas");
        paintUpgradeIcon(cv, id, tone);
        ring.appendChild(cv);
        box.appendChild(ring);
        const num = el("div", "num", "0");
        box.appendChild(num);
        abilities.appendChild(box);
        return num;
      };
      abilityEls = {
        multishot: mkAb("multishot", "cyan"),
        pierce: mkAb("pierce", "violet"),
        speed: mkAb("speed", "lime"),
      };
      frame.playfield.appendChild(abilities);

      /* Joystick ảo */
      joyEl = el("div", "ra-joy");
      joyKnob = el("div", "knob");
      joyEl.appendChild(joyKnob);
      frame.playfield.appendChild(joyEl);
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      if (coarse) frame.root.dataset.touch = "1";

      const joyReset = () => {
        joy.active = false;
        joy.id = -1;
        joy.mx = 0;
        joy.my = 0;
        joyKnob.style.transform = "translate(-50%, -50%)";
      };
      joyEl.addEventListener(
        "pointerdown",
        (e) => {
          e.preventDefault();
          const r = joyEl.getBoundingClientRect();
          joy.active = true;
          joy.id = e.pointerId;
          joy.cx = r.left + r.width / 2;
          joy.cy = r.top + r.height / 2;
        },
        { signal: ctx.signal }
      );
      window.addEventListener(
        "pointermove",
        (e) => {
          if (!joy.active || e.pointerId !== joy.id) return;
          const dx = e.clientX - joy.cx;
          const dy = e.clientY - joy.cy;
          const d = Math.hypot(dx, dy);
          const max = 44;
          const k = d > max ? max / d : 1;
          joy.mx = (dx * k) / max;
          joy.my = (dy * k) / max;
          joyKnob.style.transform = `translate(calc(-50% + ${dx * k}px), calc(-50% + ${dy * k}px))`;
        },
        { signal: ctx.signal }
      );
      window.addEventListener("pointerup", (e) => {
        if (e.pointerId === joy.id) joyReset();
      }, { signal: ctx.signal });
      window.addEventListener("pointercancel", (e) => {
        if (e.pointerId === joy.id) joyReset();
      }, { signal: ctx.signal });

      /* Bàn phím */
      keys = createKeyboard({ signal: ctx.signal });
      keys.on(["Digit1"], () => {
        if (mode === "levelup") choiceButtons[0]?.click();
      });
      keys.on(["Digit2"], () => {
        if (mode === "levelup") choiceButtons[1]?.click();
      });
      keys.on(["Digit3"], () => {
        if (mode === "levelup") choiceButtons[2]?.click();
      });
      keys.on(["KeyP"], () => togglePause());

      loop = createLoop(update);
      showIntro();
    },

    start() {
      if (mode === "intro") startMatch();
    },

    pause() {
      pauseGame();
    },

    resume() {
      resumeGame();
    },

    restart() {
      if (mode === "intro") return;
      startMatch();
    },

    resize() {},

    destroy() {
      loop?.stop();
      keys?.destroy();
      view?.destroy();
      frame?.destroy();
      frame = null;
      renderer = null;
      arena = null;
      if (typeof window !== "undefined") delete window.__RA_STATE__;
    },
  };
}
