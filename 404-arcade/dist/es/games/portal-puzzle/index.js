/**
 * Portal Puzzle 404 — puzzle lưới data-driven 15 màn (game 6).
 *
 * Theo plan + ảnh reference: HUD trên (MÀN / BƯỚC / THỜI GIAN / BEST +
 * cụm nút hệ thống), sidebar chú giải + mục tiêu bên trái, board canvas
 * giữa, thanh HOÀN TÁC / CHƠI LẠI / GỢI Ý (badge số lượt) bên dưới.
 * Arrow/WASD di chuyển, U hoàn tác (≥20 bước), R chơi lại màn, H gợi ý
 * từng bước (lưu sẵn trong level), Esc tạm dừng. Mobile: vuốt hoặc chạm
 * ô kề. Tiến trình màn lưu bằng storage.setPref; điểm gửi onGameOver mỗi
 * khi hoàn thành màn.
 */

import { createExpansionFrame } from "../_shared/frame.js";
import { createKeyboard, onSwipe } from "../../core/input-manager.js";
import { createLoop } from "../../core/loop.js";
import { el, svgIcon, formatNumber, formatTime } from "../../core/utils.js";
import { parseLevel, stepPure, cloneSnap } from "./engine.js";
import { LEVELS } from "./levels.js";
import { createBoardRenderer, paintLegendIcon } from "./render.js";
import { PP_CSS } from "./styles.js";

const PROGRESS_KEY = "portal-progress";
const HINTS_PER_LEVEL = 3;
const UNDO_CAP = 60;

const DIR_OF_SWIPE = { up: "U", down: "D", left: "L", right: "R" };
const DIR_LABEL = { U: "ĐI LÊN", D: "ĐI XUỐNG", L: "SANG TRÁI", R: "SANG PHẢI" };

export function createGame() {
  let ctx = null;
  let frame = null;
  let renderer = null;
  let keys = null;
  let loop = null;
  let offSwipe = null;
  let ro = null;
  let boardBox = null;
  let canvas = null;
  let hintBadge = null;
  let objectiveEl = null;

  let mode = "intro"; // intro | play | paused | complete | failed | finished
  let levelIdx = 0;
  let level = null;
  let snap = null;
  let history = [];
  let moveLog = "";
  let hintsLeft = HINTS_PER_LEVEL;
  let levelTime = 0;
  let totalScore = 0;
  let time = 0;
  let tapStart = null;

  const fx = { moveAnim: null, teleports: [], deny: null, hint: null, facing: { x: 0, y: 1 } };

  /* ---------------- Tiến trình ---------------- */

  function readProgress() {
    const p = ctx.storage.getPref(PROGRESS_KEY, null);
    if (p && typeof p === "object" && Number.isInteger(p.level) && p.level >= 0 && p.level < LEVELS.length) {
      return { level: p.level, score: Number.isFinite(p.score) ? p.score : 0 };
    }
    return { level: 0, score: 0 };
  }

  function saveProgress(levelNext, score) {
    ctx.storage.setPref(PROGRESS_KEY, { level: levelNext, score });
  }

  /* ---------------- HUD ---------------- */

  function updateHud() {
    frame.setStat("level", String(levelIdx + 1).padStart(2, "0"));
    frame.setStat("moves", `${snap.moves}/${level.maxMoves}`);
    frame.setStat("time", formatTime(levelTime));
    const best = ctx.getBest();
    frame.setStat("best", best > 0 ? formatNumber(best) : "--:--");
    const movesLeft = level.maxMoves - snap.moves;
    const valEl = frame.statBox("moves")?.querySelector(".val");
    if (valEl) valEl.style.color = movesLeft <= 3 ? "var(--red)" : "";
    if (hintBadge) {
      hintBadge.textContent = String(hintsLeft);
      if (hintsLeft === 0) hintBadge.dataset.zero = "1";
      else delete hintBadge.dataset.zero;
    }
  }

  /* ---------------- Vòng đời level ---------------- */

  function loadLevel(idx) {
    levelIdx = idx;
    const parsed = parseLevel(LEVELS[idx]);
    level = parsed.level;
    snap = parsed.snap;
    history = [];
    moveLog = "";
    hintsLeft = HINTS_PER_LEVEL;
    levelTime = 0;
    fx.moveAnim = null;
    fx.teleports = [];
    fx.deny = null;
    fx.hint = null;
    if (objectiveEl) objectiveEl.textContent = LEVELS[idx].intro;
    updateHud();
  }

  function beginLevel(idx) {
    loadLevel(idx);
    mode = "play";
    frame.clearScreen();
    frame.setPaused(false);
    ctx.onMatchStart();
    frame.banner(`MÀN ${String(idx + 1).padStart(2, "0")} — ${level.name}`);
    ctx.audio.play("start");
    loop.start();
  }

  function levelScoreOf() {
    const movesLeft = Math.max(0, level.maxMoves - snap.moves);
    const parBonus = snap.moves <= level.par ? 100 : 0;
    return 150 + movesLeft * 10 + parBonus;
  }

  function finishLevel() {
    mode = "complete";
    loop.stop();
    const gained = levelScoreOf();
    totalScore += gained;
    ctx.audio.play("win");
    const isLast = levelIdx === LEVELS.length - 1;
    if (isLast) {
      saveProgress(0, 0);
    } else {
      saveProgress(levelIdx + 1, totalScore);
    }
    const saved = ctx.onGameOver(totalScore, { level: levelIdx + 1, moves: snap.moves });

    const statCards = [
      { label: "BƯỚC", value: `${snap.moves}/${level.maxMoves}`, color: "lime" },
      { label: "TỐI ƯU (PAR)", value: level.par, color: "cyan" },
      { label: "THỜI GIAN", value: formatTime(levelTime), color: "cyan" },
      { label: "ĐIỂM MÀN", value: `+${formatNumber(gained)}`, color: "gold" },
    ];
    if (isLast) {
      mode = "finished";
      frame.overScreen({
        kicker: "// CHIẾN DỊCH HOÀN TẤT",
        heading: "HOÀN THÀNH 15 MÀN!",
        score: totalScore,
        saved,
        statCards,
        restartLabel: "CHƠI LẠI TỪ ĐẦU",
        onRestart: () => {
          totalScore = 0;
          beginLevel(0);
        },
        scoreLabel: "TỔNG ĐIỂM",
      });
    } else {
      frame.overScreen({
        kicker: "// MÀN HOÀN THÀNH",
        heading: `MÀN ${String(levelIdx + 1).padStart(2, "0")} — XONG!`,
        score: totalScore,
        saved,
        statCards,
        restartLabel: "MÀN TIẾP THEO",
        onRestart: () => beginLevel(levelIdx + 1),
        extraActions: [["Chơi lại màn", "i-restart", "cyan", () => beginLevel(levelIdx)]],
        scoreLabel: "TỔNG ĐIỂM",
      });
    }
    updateHud();
  }

  function failLevel() {
    mode = "failed";
    loop.stop();
    ctx.audio.play("bad");
    const s = frame.showScreen("failed");
    const box = frame.panel(s);
    box.appendChild(el("div", "exp-kicker", "// HẾT NĂNG LƯỢNG"));
    box.appendChild(el("h2", "exp-h1", "HẾT BƯỚC!"));
    box.appendChild(
      el("p", "exp-goal", `Bạn đã dùng hết ${level.maxMoves} bước cho màn này. Hoàn tác vài bước hoặc chơi lại màn nhé.`)
    );
    const menu = el("div", "exp-menu");
    const mk = (label, cls, fn) => {
      const b = el("button", `exp-menu-btn${cls ? ` ${cls}` : ""}`, label);
      b.type = "button";
      b.addEventListener("click", fn);
      return b;
    };
    menu.appendChild(mk("HOÀN TÁC BƯỚC CUỐI (U)", "primary", () => undoMove()));
    menu.appendChild(mk("CHƠI LẠI MÀN (R)", "", () => beginLevel(levelIdx)));
    menu.appendChild(mk("ĐỔI GAME", "", () => ctx.requestSwitch()));
    box.appendChild(menu);
  }

  /* ---------------- Hành động ---------------- */

  function move(dirChar) {
    if (mode !== "play") return;
    const from = { x: snap.player.x, y: snap.player.y };
    const r = stepPure(level, snap, dirChar);
    const d = { U: { x: 0, y: -1 }, D: { x: 0, y: 1 }, L: { x: -1, y: 0 }, R: { x: 1, y: 0 } }[dirChar];
    fx.facing = d;
    if (r.denied) {
      fx.deny = { t0: time, dx: d.x, dy: d.y };
      ctx.audio.play("denied");
      if (r.denied === "laser") frame.toast("TIA LASER CHẶN ĐƯỜNG!");
      return;
    }
    history.push({ snap: cloneSnap(snap), log: moveLog });
    if (history.length > UNDO_CAP) history.shift();
    snap = r.snap;
    moveLog += dirChar;
    fx.hint = null;

    if (r.events.teleported) {
      fx.teleports.push({ ...r.events.teleported.from, color: r.events.teleported.color, t0: time });
      fx.teleports.push({ ...r.events.teleported.to, color: r.events.teleported.color, t0: time });
      fx.moveAnim = null;
      ctx.audio.play("portal");
    } else {
      fx.moveAnim = { fx: from.x, fy: from.y, t0: time };
    }
    if (r.events.crateTeleported) {
      fx.teleports.push({ ...r.events.crateTeleported.from, color: r.events.crateTeleported.color, t0: time });
      fx.teleports.push({ ...r.events.crateTeleported.to, color: r.events.crateTeleported.color, t0: time });
      ctx.audio.play("portal");
    }
    if (r.events.toggled) ctx.audio.play("switch");
    else if (r.events.pushed) ctx.audio.play("push");
    else if (r.events.steppedSwitch) ctx.audio.play("switch");
    else ctx.audio.play("step");

    if (fx.teleports.length > 8) fx.teleports.splice(0, fx.teleports.length - 8);
    updateHud();

    if (r.completed) {
      finishLevel();
      return;
    }
    if (snap.moves >= level.maxMoves) failLevel();
  }

  function undoMove() {
    if (mode !== "play" && mode !== "failed") return;
    const prev = history.pop();
    if (!prev) {
      frame.toast("KHÔNG CÒN BƯỚC HOÀN TÁC");
      return;
    }
    snap = prev.snap;
    moveLog = prev.log;
    fx.moveAnim = null;
    fx.hint = null;
    ctx.audio.play("undo");
    if (mode === "failed") {
      mode = "play";
      frame.clearScreen();
      loop.start();
    }
    updateHud();
  }

  function useHint() {
    if (mode !== "play") return;
    if (hintsLeft <= 0) {
      frame.toast("ĐÃ DÙNG HẾT LƯỢT GỢI Ý");
      ctx.audio.play("denied");
      return;
    }
    const sol = level.hint;
    if (!sol.startsWith(moveLog)) {
      frame.toast("ĐÃ LỆCH LỜI GIẢI GỐC — HOÀN TÁC (U) HOẶC CHƠI LẠI (R) ĐỂ DÙNG GỢI Ý");
      ctx.audio.play("denied");
      return;
    }
    if (moveLog.length >= sol.length) return;
    const nextDir = sol[moveLog.length];
    hintsLeft -= 1;
    fx.hint = { dir: nextDir, until: time + 3.2 };
    frame.toast(`GỢI Ý: ${DIR_LABEL[nextDir]}`);
    ctx.audio.play("ui");
    updateHud();
  }

  /* ---------------- Pause ---------------- */

  function pauseGame() {
    if (mode !== "play") return;
    mode = "paused";
    loop.stop();
    frame.setPaused(true);
    frame.pauseMenu({
      onResume: () => resumeGame(),
      onRestart: () => beginLevel(levelIdx),
      restartLabel: "CHƠI LẠI MÀN",
      buildExtra: (box) => {
        const row = el("div", "exp-setrow");
        row.appendChild(el("span", "", "TIẾN TRÌNH"));
        row.appendChild(el("span", "val", `MÀN ${levelIdx + 1}/15 · TỔNG ${formatNumber(totalScore)} ĐIỂM`));
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

  /* ---------------- Intro ---------------- */

  function showIntro() {
    mode = "intro";
    loop.stop();
    const progress = readProgress();
    const extra = [];
    if (progress.level > 0) {
      extra.push([
        "Chơi từ đầu",
        "i-restart",
        "gold",
        () => {
          totalScore = 0;
          saveProgress(0, 0);
          beginLevel(0);
        },
      ]);
    }
    frame.intro({
      kicker: "// NHIỆM VỤ GIẢI ĐỐ",
      heading: [["PORTAL PUZZLE ", ""], ["404", "cyan"]],
      goal:
        "Đưa nhà thám hiểm đến Ô THOÁT của 15 màn chơi: đẩy thùng gỗ, kích hoạt công tắc, né tia laser và dịch chuyển qua các cổng không gian. Mỗi màn có giới hạn bước!",
      rows: [
        { keys: ["↑↓←→", "WASD"], text: "di chuyển (vuốt / chạm ô kề trên mobile)" },
        { keys: ["U"], text: "hoàn tác bước (tối đa 60 bước)" },
        { keys: ["R"], text: "chơi lại màn hiện tại" },
        { keys: ["H"], text: "gợi ý một bước (3 lượt mỗi màn)" },
        { keys: ["ESC"], text: "tạm dừng" },
      ],
      startLabel: progress.level > 0 ? `TIẾP TỤC — MÀN ${String(progress.level + 1).padStart(2, "0")}` : "BẮT ĐẦU",
      onStart: () => {
        const p = readProgress();
        totalScore = p.score;
        beginLevel(p.level);
      },
      extra,
    });
    // vẽ một khung nền tĩnh cho intro
    loadLevel(progress.level);
    renderer.fit();
    renderer.draw(level, snap, fx, 0);
  }

  /* ---------------- Vòng lặp ---------------- */

  function update(dt) {
    time += dt;
    if (mode === "play") {
      levelTime += dt;
      frame.setStat("time", formatTime(levelTime));
    }
    renderer.draw(level, snap, fx, time);
  }

  /* ---------------- Interface ---------------- */

  return {
    async mount(container, context) {
      ctx = context;

      const rootNode = container.getRootNode();
      if (rootNode instanceof ShadowRoot && !rootNode.querySelector("#pp-style")) {
        const style = document.createElement("style");
        style.id = "pp-style";
        style.textContent = PP_CSS;
        rootNode.appendChild(style);
      }

      frame = createExpansionFrame(container, ctx, {
        accent: "cyan",
        title: [["PORTAL PUZZLE ", ""], ["404", "cyan"]],
        stats: [
          { id: "level", label: "MÀN", color: "pink", value: "01" },
          { id: "moves", label: "BƯỚC", color: "lime", value: "0/12" },
          { id: "time", label: "THỜI GIAN", color: "cyan", value: "00:00" },
          { id: "best", label: "BEST", color: "gold", value: "--:--", optional: true },
        ],
        onPauseToggle: togglePause,
      });

      /* Layout: sidebar + board + action bar */
      const layout = el("div", "pp-layout");
      const side = el("aside", "pp-side");

      const objPanel = el("div", "pp-panel");
      objPanel.appendChild(el("h3", "", "MỤC TIÊU"));
      objectiveEl = el("p", "", "");
      objPanel.appendChild(objectiveEl);
      side.appendChild(objPanel);

      const legendPanel = el("div", "pp-panel");
      const legend = el("div", "pp-legend");
      const LEGEND = [
        ["player", "NHÀ THÁM HIỂM"],
        ["crate", "THÙNG GỖ"],
        ["switch-blue", "CÔNG TẮC XANH"],
        ["switch-violet", "CÔNG TẮC TÍM"],
        ["portal-cyan", "CỔNG XANH"],
        ["portal-violet", "CỔNG TÍM"],
        ["laser", "LASER"],
        ["exit", "LỐI THOÁT"],
      ];
      for (const [kind, label] of LEGEND) {
        const row = el("div", "pp-legend-row");
        const c = document.createElement("canvas");
        paintLegendIcon(c, kind);
        row.appendChild(c);
        row.appendChild(el("span", "", label));
        legend.appendChild(row);
      }
      legendPanel.appendChild(legend);
      side.appendChild(legendPanel);

      const main = el("div", "pp-main");
      boardBox = el("div", "pp-board");
      canvas = document.createElement("canvas");
      canvas.setAttribute("aria-label", "Bàn chơi Portal Puzzle");
      boardBox.appendChild(canvas);
      main.appendChild(boardBox);

      const actions = el("div", "pp-actions");
      const mkAction = (label, tone, iconId, fn, withBadge = false) => {
        const b = el("button", "pp-action");
        b.type = "button";
        b.dataset.tone = tone;
        b.appendChild(svgIcon(iconId));
        b.appendChild(el("span", "", label));
        if (withBadge) {
          hintBadge = el("span", "pp-badge", String(HINTS_PER_LEVEL));
          b.appendChild(hintBadge);
        }
        b.addEventListener("click", (e) => {
          if (e.detail > 0) b.blur();
          fn();
        });
        actions.appendChild(b);
        return b;
      };
      mkAction("HOÀN TÁC", "cyan", "i-swap", () => undoMove());
      mkAction("CHƠI LẠI", "pink", "i-restart", () => {
        if (mode === "play" || mode === "failed" || mode === "paused") beginLevel(levelIdx);
      });
      mkAction("GỢI Ý", "lime", "i-target", () => useHint(), true);
      main.appendChild(actions);

      layout.append(side, main);
      frame.playfield.appendChild(layout);

      renderer = createBoardRenderer(canvas, boardBox);
      ro = new ResizeObserver(() => {
        renderer.fit();
        if (mode !== "play") renderer.draw(level, snap, fx, time);
      });
      ro.observe(boardBox);

      /* Input */
      keys = createKeyboard({ signal: ctx.signal });
      keys.on(["ArrowUp", "KeyW"], () => move("U"), { repeat: true });
      keys.on(["ArrowDown", "KeyS"], () => move("D"), { repeat: true });
      keys.on(["ArrowLeft", "KeyA"], () => move("L"), { repeat: true });
      keys.on(["ArrowRight", "KeyD"], () => move("R"), { repeat: true });
      keys.on(["KeyU", "KeyZ"], () => undoMove());
      keys.on(["KeyR"], () => {
        if (mode === "play" || mode === "failed") beginLevel(levelIdx);
      });
      keys.on(["KeyH"], () => useHint());
      keys.on(["KeyP"], () => togglePause());

      offSwipe = onSwipe(canvas, (dir) => move(DIR_OF_SWIPE[dir]));
      canvas.addEventListener(
        "pointerdown",
        (e) => {
          tapStart = { x: e.clientX, y: e.clientY, t: performance.now() };
        },
        { signal: ctx.signal }
      );
      canvas.addEventListener(
        "pointerup",
        (e) => {
          if (!tapStart || mode !== "play") return;
          const dx = e.clientX - tapStart.x;
          const dy = e.clientY - tapStart.y;
          const dt = performance.now() - tapStart.t;
          tapStart = null;
          if (Math.hypot(dx, dy) > 12 || dt > 450) return; // đã là swipe
          const rect = canvas.getBoundingClientRect();
          const { t, ox, oy } = renderer.geometry(level);
          const gx = Math.floor((e.clientX - rect.left - ox) / t);
          const gy = Math.floor((e.clientY - rect.top - oy) / t);
          const ddx = gx - snap.player.x;
          const ddy = gy - snap.player.y;
          if (Math.abs(ddx) + Math.abs(ddy) === 1) {
            move(ddx === 1 ? "R" : ddx === -1 ? "L" : ddy === 1 ? "D" : "U");
          }
        },
        { signal: ctx.signal }
      );

      loop = createLoop(update);
      showIntro();
    },

    start() {
      if (mode !== "intro") return;
      const p = readProgress();
      totalScore = p.score;
      beginLevel(p.level);
    },

    pause() {
      pauseGame();
    },

    resume() {
      resumeGame();
    },

    restart() {
      if (mode === "intro") return;
      beginLevel(levelIdx);
    },

    resize() {
      renderer?.fit();
    },

    destroy() {
      loop?.stop();
      keys?.destroy();
      offSwipe?.();
      ro?.disconnect();
      frame?.destroy();
      frame = null;
      renderer = null;
      level = null;
      snap = null;
    },
  };
}
