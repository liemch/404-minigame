/**
 * Stealth Escape 404 — puzzle lén lút theo lượt (expansion 16–20).
 *
 * Theo ảnh reference: cụm nút hệ thống góc trái trên, tiêu đề giữa;
 * sidebar trái MÀN / BÁO ĐỘNG (thanh %) / THỜI GIAN / KEYCARD + chú
 * giải; hàng nút HOÀN TÁC / CHƠI LẠI / GỢI Ý dưới đáy; bản đồ ô vuông
 * với cone tầm nhìn đỏ, tuyến tuần tra đỏ nét đứt, đường gợi ý xanh.
 * Turn-based: đi 1 ô → guard bước 1 → camera xoay → tính LOS → alarm →
 * thắng/thua. Undo 40 lượt, 15 level JSON đã xác minh có lời giải.
 */

import { createExpansionFrame } from "../_shared/frame.js";
import { createKeyboard } from "../../core/input-manager.js";
import { createLoop } from "../../core/loop.js";
import { el, svgIcon, formatTime, formatNumber } from "../../core/utils.js";
import {
  loadLevel,
  createRun,
  doTurn,
  undoTurn,
  computeCones,
  findPath,
  nextObjective,
  allKeys,
} from "./engine.js";
import { LEVELS } from "./levels.js";
import { createStealthRenderer } from "./render.js";
import { SE_CSS } from "./styles.js";

const HINT_COST = 100; // trừ vào điểm thưởng màn

export function createGame() {
  let ctx = null;
  let frame = null;
  let renderer = null;
  let keys = null;
  let loop = null;
  let ro = null;
  let canvas = null;
  let stage = null;
  let side = {};

  const TEST = typeof window !== "undefined" && window.__ARCADE_EXP16_TEST__;

  let mode = "intro"; // intro | play | paused | over
  let time = 0;
  let levelIdx = 0;
  let level = null;
  let st = null;
  let timeLeft = 0;
  let totalScore = 0;
  let totalTurns = 0;
  let tries = 0;
  let hintsUsed = 0;
  let freezeT = 0; // khóa input khi fail/clear màn
  let pendingNext = null; // 'retry' | 'next' | 'win'

  const view = {
    level: null,
    st: null,
    cones: [],
    prevP: { x: 0, y: 0 },
    moveAnim: 1,
    hintPath: null,
    hintT: 0,
    spotFlash: 0,
  };

  /* ---------------- HUD sidebar ---------------- */

  function updateHud() {
    if (!st) return;
    side.level.textContent = String(levelIdx + 1).padStart(2, "0");
    side.alarm.textContent = `${st.alarm}%`;
    side.alarmBar.style.width = `${st.alarm}%`;
    side.time.textContent = formatTime(timeLeft);
    side.keys.textContent = `${countKeys()}/${level.keycards.length || 0}`;
  }

  function countKeys() {
    let n = 0;
    for (let i = 0; i < level.keycards.length; i++) if (st.keyMask & (1 << i)) n += 1;
    return n;
  }

  /* ---------------- Vòng đời level ---------------- */

  function startLevel(idx, { resetTries = false } = {}) {
    levelIdx = idx;
    level = loadLevel(LEVELS[idx]);
    st = createRun(level);
    timeLeft = level.time;
    if (resetTries) tries = 0;
    freezeT = 0;
    pendingNext = null;
    view.level = level;
    view.st = st;
    view.prevP = { x: st.px, y: st.py };
    view.moveAnim = 1;
    view.hintPath = null;
    view.hintT = 0;
    view.cones = computeCones(level, st, 0);
    frame.banner(`MÀN ${String(idx + 1).padStart(2, "0")} — ${level.name.toUpperCase()}`);
    updateHud();
  }

  function failLevel(reason) {
    ctx.audio.play(reason === "alarm" ? "ap_alarm" : "se_caught");
    frame.banner(reason === "alarm" ? "BÁO ĐỘNG TỐI ĐA!" : reason === "time" ? "HẾT GIỜ!" : "BỊ BẮT!");
    tries += 1;
    view.spotFlash = 1;
    freezeT = 1.3;
    pendingNext = "retry";
  }

  function clearLevel() {
    const bonus =
      400 + Math.max(0, level.par * 2 - st.turns) * 15 + Math.ceil(timeLeft) * 2 - hintsUsed * HINT_COST;
    const gained = Math.max(100, bonus);
    totalScore += gained;
    totalTurns += st.turns;
    hintsUsed = 0;
    // mở khóa màn kế tiếp (lưu tiến trình)
    const unlocked = ctx.storage.getPref("se-level", 0);
    if (levelIdx + 1 > unlocked) ctx.storage.setPref("se-level", levelIdx + 1);
    ctx.audio.play("win");
    frame.banner(`THOÁT! +${gained} ĐIỂM`);
    freezeT = 1.5;
    pendingNext = levelIdx + 1 >= LEVELS.length ? "win" : "next";
    updateHud();
  }

  function beginMatch(fromLevel = 0) {
    totalScore = 0;
    totalTurns = 0;
    tries = 0;
    hintsUsed = 0;
    mode = "play";
    frame.clearScreen();
    frame.setPaused(false);
    ctx.onMatchStart();
    ctx.audio.play("start");
    startLevel(fromLevel, { resetTries: true });
    loop.start();
  }

  function finishMatch() {
    mode = "over";
    const saved = ctx.onGameOver(totalScore, { levels: LEVELS.length, tries });
    frame.overScreen({
      kicker: "// NHIỆM VỤ HOÀN TẤT",
      heading: "TẨU THOÁT THÀNH CÔNG!",
      score: totalScore,
      saved,
      statCards: [
        { label: "MÀN", value: `${LEVELS.length}/${LEVELS.length}`, color: "cyan" },
        { label: "TỔNG LƯỢT", value: totalTurns, color: "lime" },
        { label: "LẦN BỊ BẮT", value: tries, color: "pink" },
      ],
      restartLabel: "CHƠI LẠI TỪ ĐẦU",
      onRestart: () => beginMatch(0),
    });
  }

  /* ---------------- Hành động ---------------- */

  function act(action) {
    if (mode !== "play" || freezeT > 0 || !st || st.caught || st.won) return;
    const before = { x: st.px, y: st.py };
    const res = doTurn(level, st, action);
    if (!res.ok) {
      if (res.events.some((e) => e.type === "blocked")) ctx.audio.play("denied");
      return;
    }
    view.prevP = before;
    view.moveAnim = 0;
    view.cones = computeCones(level, st, st.turns);
    if (view.hintT > 0) view.hintT = 0.01; // đi tiếp → ẩn dần gợi ý

    for (const ev of res.events) {
      switch (ev.type) {
        case "moved":
          ctx.audio.play("step");
          break;
        case "key":
          ctx.audio.play("se_key");
          frame.toast(`KEYCARD ${countKeys()}/${level.keycards.length}`);
          break;
        case "unlock":
          ctx.audio.play("switch");
          frame.toast("CỬA & LỐI THOÁT ĐÃ MỞ!");
          break;
        case "terminal":
          ctx.audio.play("switch");
          frame.toast("BÁO ĐỘNG ĐÃ ĐƯỢC TẮT!");
          break;
        case "spotted":
          ctx.audio.play("se_alert");
          view.spotFlash = 1;
          frame.toast(`BỊ PHÁT HIỆN! BÁO ĐỘNG ${st.alarm}%`);
          break;
        case "caught":
          failLevel(ev.reason);
          break;
        case "won":
          clearLevel();
          break;
        default:
          break;
      }
    }
    updateHud();
  }

  function doUndo() {
    if (mode !== "play" || freezeT > 0) return;
    if (!undoTurn(st)) {
      ctx.audio.play("denied");
      return;
    }
    ctx.audio.play("undo");
    view.prevP = { x: st.px, y: st.py };
    view.moveAnim = 1;
    view.cones = computeCones(level, st, st.turns);
    updateHud();
  }

  function doHint() {
    if (mode !== "play" || freezeT > 0 || !st) return;
    const target = nextObjective(level, st);
    const path = findPath(level, st, target.x, target.y);
    if (!path) {
      ctx.audio.play("denied");
      return;
    }
    hintsUsed += 1;
    view.hintPath = path;
    view.hintT = 4;
    ctx.audio.play("mm_hint");
    frame.toast(
      `GỢI Ý: ${target.kind === "key" ? "KEYCARD" : "LỐI THOÁT"} · -${HINT_COST} điểm thưởng màn`
    );
  }

  function restartLevel() {
    if (mode !== "play") return;
    ctx.audio.play("ui");
    tries += 1;
    hintsUsed = 0;
    startLevel(levelIdx);
  }

  /* ---------------- Pause / intro ---------------- */

  function pauseGame() {
    if (mode !== "play") return;
    mode = "paused";
    loop.stop();
    frame.setPaused(true);
    frame.pauseMenu({
      onResume: () => resumeGame(),
      onRestart: () => beginMatch(levelIdx),
      restartLabel: "CHƠI LẠI MÀN",
      buildExtra: (box) => {
        const row = el("div", "exp-setrow");
        row.appendChild(el("span", "", "TIẾN TRÌNH"));
        row.appendChild(
          el("span", "val", `Màn ${levelIdx + 1}/${LEVELS.length} · ${st.turns} lượt · ${formatNumber(totalScore)} điểm`)
        );
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
    const unlocked = Math.min(ctx.storage.getPref("se-level", 0), LEVELS.length - 1);
    frame.intro({
      kicker: "// NHIỆM VỤ LÉN LÚT",
      heading: [["STEALTH ESCAPE ", "cyan"], ["404", "pink"]],
      goal:
        "Di chuyển theo lượt: né cone tầm nhìn của robot tuần tra và camera, lấy đủ KEYCARD để mở cửa rồi đến LỐI THOÁT. Bị thấy +25% báo động — 100% là bị bắt. Vùng khuất chỉ lộ khi guard đứng sát. 15 màn, mọi màn đều giải được!",
      rows: [
        { keys: ["WASD", "↑↓←→"], text: "đi 1 ô · SPACE đứng yên chờ 1 lượt" },
        { keys: ["Chạm"], text: "chạm ô kề để đi, chạm chính mình để chờ" },
        { keys: ["U"], text: "hoàn tác (tối đa 40 lượt) · R chơi lại màn" },
        { keys: ["H"], text: "gợi ý đường đi (trừ điểm thưởng)" },
        { keys: ["ESC", "P"], text: "tạm dừng" },
      ],
      startLabel: unlocked > 0 ? `TIẾP TỤC — MÀN ${String(unlocked + 1).padStart(2, "0")}` : "BẮT ĐẦU",
      onStart: () => beginMatch(unlocked),
      extra: unlocked > 0 ? [["Chơi từ màn 1", "i-restart", "gold", () => beginMatch(0)]] : [],
    });
    level = loadLevel(LEVELS[unlocked]);
    st = createRun(level);
    timeLeft = level.time;
    view.level = level;
    view.st = st;
    view.prevP = { x: st.px, y: st.py };
    view.cones = computeCones(level, st, 0);
    renderer.fit();
    renderer.draw(view, 0);
    updateHud();
  }

  /* ---------------- Vòng lặp ---------------- */

  function update(dt) {
    time += dt;
    if (mode === "play") {
      if (freezeT > 0) {
        freezeT -= dt;
        if (freezeT <= 0) {
          if (pendingNext === "retry") startLevel(levelIdx);
          else if (pendingNext === "next") startLevel(levelIdx + 1);
          else if (pendingNext === "win") {
            finishMatch();
            return;
          }
        }
      } else {
        timeLeft -= dt;
        if (timeLeft <= 0) {
          timeLeft = 0;
          failLevel("time");
        }
      }
      if (view.hintT > 0) view.hintT -= dt;
    }
    view.moveAnim = Math.min(1, view.moveAnim + dt / 0.14);
    if (view.spotFlash > 0) view.spotFlash -= dt * 1.6;
    renderer.draw(view, time);

    if (TEST && st) {
      window.__SE_STATE__ = {
        mode,
        level: levelIdx + 1,
        turns: st.turns,
        alarm: st.alarm,
        keys: countKeys(),
        keysTotal: level.keycards.length,
        px: st.px,
        py: st.py,
        caught: st.caught,
        won: st.won,
        score: totalScore,
        timeLeft: Math.round(timeLeft),
      };
    }
  }

  /* ---------------- Interface ---------------- */

  return {
    async mount(container, context) {
      ctx = context;

      const rootNode = container.getRootNode();
      if (rootNode instanceof ShadowRoot && !rootNode.querySelector("#se-style")) {
        const style = document.createElement("style");
        style.id = "se-style";
        style.textContent = SE_CSS;
        rootNode.appendChild(style);
      }

      frame = createExpansionFrame(container, ctx, {
        accent: "cyan",
        title: [["STEALTH ESCAPE ", "cyan"], ["404", "pink"]],
        stats: [],
        buttonStyle: "compact",
        buttonsFirst: true,
        onPauseToggle: togglePause,
      });
      frame.root.classList.add("se-mode");

      stage = el("div", "se-stage");
      canvas = document.createElement("canvas");
      canvas.setAttribute("aria-label", "Bản đồ Stealth Escape");
      stage.appendChild(canvas);
      frame.playfield.appendChild(stage);

      /* sidebar trái */
      const sideEl = el("div", "se-side");
      const mkPanel = (tone, label) => {
        const p = el("div", "se-panel");
        p.dataset.tone = tone;
        p.appendChild(el("div", "lbl", label));
        const v = el("div", "val");
        p.appendChild(v);
        sideEl.appendChild(p);
        return { p, v };
      };
      const lv = mkPanel("cyan", "MÀN");
      side.level = el("span", "", "01");
      lv.v.appendChild(side.level);

      const al = mkPanel("pink", "BÁO ĐỘNG");
      side.alarm = el("span", "", "0%");
      al.v.appendChild(side.alarm);
      const bar = el("div", "bar");
      side.alarmBar = el("i");
      bar.appendChild(side.alarmBar);
      al.p.appendChild(bar);

      const tm = mkPanel("cyan", "THỜI GIAN");
      side.time = el("span", "", "00:00");
      tm.v.appendChild(side.time);

      const kc = mkPanel("lime", "KEYCARD");
      side.keys = el("span", "", "0/0");
      kc.v.appendChild(side.keys);
      kc.v.appendChild(el("i", "cardicon"));

      const legend = el("div", "se-legend");
      for (const [cls, label] of [
        ["you", "BẠN"],
        ["guard", "ROBOT TUẦN TRA"],
        ["cam", "CAMERA"],
        ["route", "TUYẾN TUẦN TRA"],
        ["path", "ĐƯỜNG DỰ ĐỊNH"],
        ["wall", "TƯỜNG"],
        ["shadow", "VÙNG KHUẤT"],
        ["vision", "TẦM NHÌN"],
      ]) {
        const row = el("div", "row");
        row.appendChild(el("i", `ic ${cls}`));
        row.appendChild(el("span", "", label));
        legend.appendChild(row);
      }
      sideEl.appendChild(legend);
      frame.playfield.appendChild(sideEl);

      /* hàng nút dưới */
      const actions = el("div", "se-actions");
      const mkBtn = (tone, label, iconBuild, fn) => {
        const b = el("button", "se-btn");
        b.type = "button";
        b.dataset.tone = tone;
        iconBuild(b);
        b.appendChild(el("span", "", label));
        b.addEventListener("click", () => {
          b.blur();
          fn();
        });
        actions.appendChild(b);
        return b;
      };
      mkBtn(
        "cyan",
        "HOÀN TÁC",
        (b) => {
          const NS = "http://www.w3.org/2000/svg";
          const svg = document.createElementNS(NS, "svg");
          svg.setAttribute("viewBox", "0 0 24 24");
          svg.setAttribute("aria-hidden", "true");
          const p = document.createElementNS(NS, "path");
          p.setAttribute("d", "M11 6 5 11l6 5v-3.4h4.2a3.9 3.9 0 0 1 0 7.8H9v2.6h6.2a6.5 6.5 0 0 0 0-13H11z");
          p.setAttribute("fill", "currentColor");
          svg.appendChild(p);
          b.appendChild(svg);
        },
        () => doUndo()
      );
      mkBtn("violet", "CHƠI LẠI", (b) => b.appendChild(svgIcon("i-restart")), () => restartLevel());
      mkBtn(
        "lime",
        "GỢI Ý",
        (b) => {
          const NS = "http://www.w3.org/2000/svg";
          const svg = document.createElementNS(NS, "svg");
          svg.setAttribute("viewBox", "0 0 24 24");
          svg.setAttribute("aria-hidden", "true");
          const p = document.createElementNS(NS, "path");
          p.setAttribute(
            "d",
            "M12 2.6a6.6 6.6 0 0 0-3.6 12.1c.5.36.8.9.8 1.5v.9h5.6v-.9c0-.6.3-1.14.8-1.5A6.6 6.6 0 0 0 12 2.6zM9.4 18.6h5.2v1.5H9.4zM10.2 21.1h3.6v1.3h-3.6z"
          );
          p.setAttribute("fill", "currentColor");
          svg.appendChild(p);
          b.appendChild(svg);
        },
        () => doHint()
      );
      frame.playfield.appendChild(actions);

      /* input chạm */
      canvas.addEventListener(
        "pointerdown",
        (e) => {
          if (mode !== "play" || !level) return;
          e.preventDefault();
          const cell = renderer.cellAt(e.clientX, e.clientY, level);
          if (!cell) return;
          const dx = cell.x - st.px;
          const dy = cell.y - st.py;
          if (dx === 0 && dy === 0) act("wait");
          else if (Math.abs(dx) + Math.abs(dy) === 1) act({ dx, dy });
        },
        { signal: ctx.signal }
      );

      keys = createKeyboard({ signal: ctx.signal });
      keys.on(["ArrowUp", "KeyW"], () => act({ dx: 0, dy: -1 }), { repeat: true });
      keys.on(["ArrowDown", "KeyS"], () => act({ dx: 0, dy: 1 }), { repeat: true });
      keys.on(["ArrowLeft", "KeyA"], () => act({ dx: -1, dy: 0 }), { repeat: true });
      keys.on(["ArrowRight", "KeyD"], () => act({ dx: 1, dy: 0 }), { repeat: true });
      keys.on(["Space"], () => act("wait"), { repeat: true });
      keys.on(["KeyU"], () => doUndo(), { repeat: true });
      keys.on(["KeyR"], () => restartLevel());
      keys.on(["KeyH"], () => doHint());
      keys.on(["KeyP"], () => togglePause());

      renderer = createStealthRenderer(canvas, stage);
      ro = new ResizeObserver(() => renderer.fit());
      ro.observe(stage);

      loop = createLoop(update);

      if (TEST) {
        window.__SE_TEST__ = {
          move: (dx, dy) => act({ dx, dy }),
          wait: () => act("wait"),
          undo: () => doUndo(),
          hint: () => doHint(),
          gotoLevel: (i) => {
            if (mode === "play" && i >= 0 && i < LEVELS.length) {
              startLevel(i);
              return true;
            }
            return false;
          },
          winLevel: () => {
            if (mode !== "play" || !st) return false;
            st.keyMask = (1 << level.keycards.length) - 1;
            st.px = level.exit.x;
            st.py = level.exit.y;
            st.won = true;
            clearLevel();
            updateHud();
            return true;
          },
        };
      }

      showIntro();
    },

    start() {
      if (mode === "intro") beginMatch(Math.min(ctx.storage.getPref("se-level", 0), LEVELS.length - 1));
    },

    pause() {
      pauseGame();
    },

    resume() {
      resumeGame();
    },

    restart() {
      if (mode === "intro") return;
      beginMatch(levelIdx);
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
      st = null;
      level = null;
      if (typeof window !== "undefined") {
        delete window.__SE_STATE__;
        delete window.__SE_TEST__;
      }
    },
  };
}
