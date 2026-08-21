/**
 * Laser Maze 404 — puzzle dẫn tia laser 20 màn (expansion 11–15).
 *
 * Theo ảnh reference: topbar tiêu đề đóng khung + 4 nút hệ thống nhỏ;
 * sidebar TRÁI: MÀN / GƯƠNG / THỜI GIAN + chú giải 7 thành phần;
 * board lưới ở giữa; sidebar PHẢI: HOÀN TÁC / CHƠI LẠI / GỢI Ý +
 * KHO GƯƠNG (lưới slot). Nhấp ô trống đặt gương, nhấp gương xoay
 * / → \\ → gỡ; gương cố định chỉ xoay. Tia trace tức thời qua engine
 * thuần (chống vòng lặp bằng state đã thăm). Esc tạm dừng.
 * Tiến trình lưu storage; điểm gửi ctx.onGameOver mỗi màn.
 */

import { createExpansionFrame } from "../_shared/frame.js";
import { createKeyboard } from "../../core/input-manager.js";
import { createLoop } from "../../core/loop.js";
import { el, svgIcon, formatNumber, formatTime } from "../../core/utils.js";
import { makeState, cloneState, cellsOf, trace, actionAt, applySolution, parOf, nextHint } from "./engine.js";
import { LEVELS } from "./levels.js";
import { createMazeRenderer, paintMazeLegend, paintInventoryMirror } from "./render.js";
import { LM_CSS } from "./styles.js";

const PROGRESS_KEY = "lm-progress";
const UNDO_CAP = 60;

export function createGame() {
  let ctx = null;
  let frame = null;
  let renderer = null;
  let keys = null;
  let loop = null;
  let ro = null;
  let canvas = null;
  let boardBox = null;

  const TEST = typeof window !== "undefined" && window.__ARCADE_EXP11_TEST__;

  let mode = "intro"; // intro | play | paused | complete | finished
  let levelIdx = 0;
  let level = null;
  let st = null;
  let result = null;
  let cells = null;
  let history = [];
  let levelTime = 0;
  let totalScore = 0;
  let hintUsed = false;
  let time = 0;
  let stateT = 0;
  let winDelay = 0;

  const ui = { hover: null, hint: null, placed: null };
  const hud = { level: null, mirrors: null, time: null, slots: [] };

  /* ---------------- Tiến trình ---------------- */

  function readProgress() {
    const p = ctx.storage.getPref(PROGRESS_KEY, null);
    if (p && typeof p === "object" && p.v === 1 && Number.isInteger(p.level) && p.level >= 0 && p.level < LEVELS.length) {
      return { level: p.level, score: Number.isFinite(p.score) ? p.score : 0 };
    }
    return { level: 0, score: 0 };
  }

  function saveProgress(levelNext, score) {
    ctx.storage.setPref(PROGRESS_KEY, { v: 1, level: levelNext, score });
  }

  /* ---------------- HUD ---------------- */

  function retrace() {
    cells = cellsOf(level, st);
    result = trace(level, st);
    ui.placed = st.placed;
  }

  function updateHud() {
    hud.level.textContent = String(levelIdx + 1).padStart(2, "0");
    hud.mirrors.textContent = `${st.placed.size}/${level.mirrors}`;
    hud.time.textContent = formatTime(levelTime);
    const remaining = level.mirrors - st.placed.size;
    hud.slots.forEach((slot, i) => {
      const filled = i < remaining;
      slot.box.classList.toggle("empty", !filled);
      paintInventoryMirror(slot.cv, filled);
    });
  }

  function rebuildSlots() {
    const grid = hud.slotGrid;
    grid.textContent = "";
    hud.slots = [];
    for (let i = 0; i < level.mirrors; i++) {
      const box = el("div", "lm-slot");
      const cv = document.createElement("canvas");
      box.appendChild(cv);
      grid.appendChild(box);
      hud.slots.push({ box, cv });
    }
    hud.slotGrid.parentElement.style.display = level.mirrors === 0 ? "none" : "";
  }

  /* ---------------- Vòng đời màn ---------------- */

  function beginLevel(idx) {
    levelIdx = idx;
    level = LEVELS[idx];
    st = makeState();
    history = [];
    levelTime = 0;
    hintUsed = false;
    winDelay = 0;
    ui.hover = null;
    ui.hint = null;
    retrace();
    rebuildSlots();
    saveProgress(idx, totalScore);
    mode = "play";
    frame.clearScreen();
    frame.setPaused(false);
    ctx.onMatchStart();
    frame.banner(`MÀN ${String(idx + 1).padStart(2, "0")} — ${level.name}`);
    frame.toast(level.intro);
    ctx.audio.play("start");
    renderer.fit(level);
    updateHud();
    loop.start();
  }

  function starsOf(placedCount) {
    const par = parOf(level);
    if (placedCount <= par && !hintUsed) return 3;
    if (placedCount <= par + 1) return 2;
    return 1;
  }

  function finishLevel() {
    mode = "complete";
    const par = parOf(level);
    const used = st.placed.size;
    const stars = starsOf(used);
    const gained = 300 + (used <= par ? 150 : 0) + (hintUsed ? 0 : 100) + Math.max(0, 180 - Math.floor(levelTime)) * 2;
    totalScore += gained;
    ctx.audio.play("win");
    const isLast = levelIdx === LEVELS.length - 1;
    if (isLast) saveProgress(0, 0);
    else saveProgress(levelIdx + 1, totalScore);
    const saved = ctx.onGameOver(totalScore, { level: levelIdx + 1, stars });

    const statCards = [
      { label: "SAO", value: "★".repeat(stars) + "☆".repeat(3 - stars), color: "gold" },
      { label: "GƯƠNG / PAR", value: `${used}/${par}`, color: "cyan" },
      { label: "THỜI GIAN", value: formatTime(levelTime), color: "cyan" },
      { label: "ĐIỂM MÀN", value: `+${formatNumber(gained)}`, color: "lime" },
    ];
    if (isLast) {
      mode = "finished";
      frame.overScreen({
        kicker: "// CHIẾN DỊCH HOÀN TẤT",
        heading: "PHÁ GIẢI 20 MÊ CUNG!",
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
        kicker: "// MẠCH LASER KHÉP KÍN",
        heading: `MÀN ${String(levelIdx + 1).padStart(2, "0")} — HOÀN THÀNH!`,
        score: totalScore,
        saved,
        statCards,
        restartLabel: "MÀN TIẾP THEO",
        onRestart: () => beginLevel(levelIdx + 1),
        extraActions: [["Chơi lại màn", "i-restart", "cyan", () => beginLevel(levelIdx)]],
        scoreLabel: "TỔNG ĐIỂM",
      });
    }
  }

  /* ---------------- Hành động ---------------- */

  function pushHistory() {
    history.push(cloneState(st));
    if (history.length > UNDO_CAP) history.shift();
  }

  function clickCell(x, y) {
    if (mode !== "play") return;
    const snap = cloneState(st);
    const r = actionAt(level, st, x, y);
    if (!r.changed) {
      if (r.action === "denied") {
        ctx.audio.play("denied");
        if (st.placed.size >= level.mirrors) frame.toast("KHO GƯƠNG ĐÃ HẾT — GỠ BỚT GƯƠNG TRÊN BOARD");
      }
      return;
    }
    history.push(snap);
    if (history.length > UNDO_CAP) history.shift();
    ui.hint = null;
    ctx.audio.play(r.action === "place" ? "build" : r.action === "remove" ? "sell" : "switch");
    const prevOk = result.ok;
    retrace();
    updateHud();
    if (result.ok > prevOk) ctx.audio.play("checkpoint");
    if (result.done) {
      winDelay = 0.65; // cho người chơi thấy tia hoàn chỉnh
    }
  }

  function undoMove() {
    if (mode !== "play") return;
    const prev = history.pop();
    if (!prev) {
      frame.toast("KHÔNG CÒN BƯỚC HOÀN TÁC");
      ctx.audio.play("denied");
      return;
    }
    st = prev;
    ui.hint = null;
    winDelay = 0;
    ctx.audio.play("undo");
    retrace();
    updateHud();
  }

  function restartLevel() {
    if (mode !== "play" && mode !== "paused") return;
    ctx.audio.play("ui");
    beginLevel(levelIdx);
  }

  function useHint() {
    if (mode !== "play") return;
    const h = nextHint(level, st);
    if (!h) {
      frame.toast("BOARD ĐÃ KHỚP LỜI GIẢI — KIỂM TRA CÁC GƯƠNG THỪA");
      return;
    }
    if (h.kind === "place" && st.placed.size >= level.mirrors) {
      frame.toast("HẾT GƯƠNG TRONG KHO — GỠ GƯƠNG SAI TRƯỚC ĐÃ");
      ctx.audio.play("denied");
      return;
    }
    pushHistory();
    hintUsed = true;
    if (h.kind === "rotate") st.rot.set(`${h.x},${h.y}`, h.o);
    else st.placed.set(`${h.x},${h.y}`, { o: h.o });
    ui.hint = { x: h.x, y: h.y, until: time + 3.5 };
    frame.toast(h.kind === "rotate" ? "GỢI Ý: XOAY GƯƠNG PHÁT SÁNG" : "GỢI Ý: ĐẶT GƯƠNG PHÁT SÁNG");
    ctx.audio.play("ui");
    retrace();
    updateHud();
    if (result.done) winDelay = 0.65;
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
        row.appendChild(el("span", "val", `MÀN ${levelIdx + 1}/20 · ${formatNumber(totalScore)} ĐIỂM`));
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
      kicker: "// NHIỆM VỤ QUANG HỌC",
      heading: [["LASER MAZE ", ""], ["404", "pink"]],
      goal:
        "Dẫn tia laser tới MỌI bộ thu của 20 màn: đặt và xoay gương, tách chùm qua splitter, nhuộm màu tia qua kính lọc — bộ thu chỉ nhận ĐÚNG MÀU. Càng ít gương + không dùng gợi ý càng nhiều sao!",
      rows: [
        { keys: ["Click", "Chạm"], text: "ô trống: đặt gương · gương: xoay / gỡ" },
        { keys: ["U"], text: "hoàn tác bước" },
        { keys: ["R"], text: "chơi lại màn" },
        { keys: ["H"], text: "gợi ý (mất thưởng sao)" },
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
    // nền tĩnh
    levelIdx = progress.level;
    level = LEVELS[levelIdx];
    st = makeState();
    retrace();
    rebuildSlots();
    renderer.fit(level);
    renderer.draw(level, cells, result, ui, 0);
    updateHud();
  }

  /* ---------------- Vòng lặp ---------------- */

  function update(dt) {
    time += dt;
    if (mode === "play") {
      levelTime += dt;
      hud.time.textContent = formatTime(levelTime);
      if (ui.hint && time > ui.hint.until) ui.hint = null;
      if (winDelay > 0) {
        winDelay -= dt;
        if (winDelay <= 0) {
          finishLevel();
          return;
        }
      }
    }
    renderer.draw(level, cells, result, ui, time);

    if (TEST) {
      stateT += dt;
      if (stateT > 0.35) {
        stateT = 0;
        window.__LM_STATE__ = {
          mode,
          level: levelIdx + 1,
          lit: result ? result.ok : 0,
          total: result ? result.total : 0,
          mirrors: st ? st.placed.size : 0,
          limit: level ? level.mirrors : 0,
          time: Math.floor(levelTime),
          score: totalScore,
        };
      }
    }
  }

  /* ---------------- Interface ---------------- */

  return {
    async mount(container, context) {
      ctx = context;

      const rootNode = container.getRootNode();
      if (rootNode instanceof ShadowRoot && !rootNode.querySelector("#lm-style")) {
        const style = document.createElement("style");
        style.id = "lm-style";
        style.textContent = LM_CSS;
        rootNode.appendChild(style);
      }

      frame = createExpansionFrame(container, ctx, {
        accent: "cyan",
        title: [["LASER MAZE ", ""], ["404", "pink"]],
        stats: [],
        onPauseToggle: togglePause,
      });
      frame.root.classList.add("lm-mode");

      const layout = el("div", "lm-layout");

      /* Sidebar trái */
      const sideL = el("aside", "lm-side");
      const mkPanel = (parent, label, tone = "cyan") => {
        const p = el("div", "lm-panel");
        p.dataset.tone = tone;
        p.appendChild(el("div", "lbl", label));
        const v = el("div", "val", "—");
        p.appendChild(v);
        parent.appendChild(p);
        return v;
      };
      hud.level = mkPanel(sideL, "MÀN");
      hud.mirrors = mkPanel(sideL, "GƯƠNG", "white");
      hud.time = mkPanel(sideL, "THỜI GIAN");

      const legendP = el("div", "lm-panel lm-panel-legend");
      const legend = el("div", "lm-legend");
      for (const [kind, name, desc] of [
        ["source", "NGUỒN LASER", ""],
        ["receiver", "BỘ THU MỤC TIÊU", ""],
        ["mirror", "GƯƠNG XOAY", "Xoay để đổi hướng"],
        ["splitter", "BỘ TÁCH CHÙM", "Tách tia thành 2 hướng"],
        ["filter-cyan", "BỘ LỌC XANH", "Chỉ cho tia xanh đi qua"],
        ["filter-violet", "BỘ LỌC TÍM", "Chỉ cho tia tím đi qua"],
        ["blocker", "KHỐI CHẶN", "Chặn tia laser"],
      ]) {
        const row = el("div", "lm-legend-row");
        const cv = document.createElement("canvas");
        paintMazeLegend(cv, kind);
        row.appendChild(cv);
        const txt = el("div", "txt");
        txt.appendChild(el("div", "name", name));
        if (desc) txt.appendChild(el("div", "desc", desc));
        row.appendChild(txt);
        legend.appendChild(row);
      }
      legendP.appendChild(legend);
      sideL.appendChild(legendP);

      /* Board giữa */
      boardBox = el("div", "lm-board");
      canvas = document.createElement("canvas");
      canvas.setAttribute("aria-label", "Bàn chơi Laser Maze");
      boardBox.appendChild(canvas);

      /* Sidebar phải */
      const sideR = el("aside", "lm-side lm-side-right");
      const mkAction = (label, tone, iconId, fn) => {
        const b = el("button", "lm-action");
        b.type = "button";
        b.dataset.tone = tone;
        b.appendChild(svgIcon(iconId));
        b.appendChild(el("span", "", label));
        b.addEventListener("click", (e) => {
          if (e.detail > 0) b.blur();
          fn();
        });
        sideR.appendChild(b);
        return b;
      };
      mkAction("HOÀN TÁC", "blue", "i-swap", () => undoMove());
      mkAction("CHƠI LẠI", "violet", "i-restart", () => restartLevel());
      mkAction("GỢI Ý", "green", "i-target", () => useHint());

      const invP = el("div", "lm-panel lm-inv");
      invP.appendChild(el("div", "lm-inv-head", "KHO GƯƠNG"));
      hud.slotGrid = el("div", "lm-inv-grid");
      invP.appendChild(hud.slotGrid);
      sideR.appendChild(invP);

      layout.append(sideL, boardBox, sideR);
      frame.playfield.appendChild(layout);

      renderer = createMazeRenderer(canvas, boardBox);
      ro = new ResizeObserver(() => {
        if (!level) return;
        renderer.fit(level);
        if (mode !== "play") renderer.draw(level, cells, result, ui, time);
      });
      ro.observe(boardBox);

      /* Input */
      const cellAt = (e) => {
        const rect = canvas.getBoundingClientRect();
        const { t, ox, oy } = renderer.geometry();
        const x = Math.floor((e.clientX - rect.left - ox) / t);
        const y = Math.floor((e.clientY - rect.top - oy) / t);
        return { x, y };
      };
      canvas.addEventListener(
        "pointerdown",
        (e) => {
          e.preventDefault();
          const { x, y } = cellAt(e);
          clickCell(x, y);
        },
        { signal: ctx.signal }
      );
      canvas.addEventListener(
        "pointermove",
        (e) => {
          if (!level) return;
          const { x, y } = cellAt(e);
          if (x < 0 || y < 0 || x >= level.w || y >= level.h) {
            ui.hover = null;
            return;
          }
          const key = `${x},${y}`;
          const fixed = level.fixed.find((f) => f[1] === x && f[2] === y);
          const can =
            (fixed && fixed[0] === "mirror") ||
            (!fixed && (st.placed.has(key) || st.placed.size < level.mirrors));
          ui.hover = { x, y, can };
        },
        { signal: ctx.signal }
      );
      canvas.addEventListener("pointerleave", () => (ui.hover = null), { signal: ctx.signal });

      keys = createKeyboard({ signal: ctx.signal });
      keys.on(["KeyU", "KeyZ"], () => undoMove());
      keys.on(["KeyR"], () => restartLevel());
      keys.on(["KeyH"], () => useHint());
      keys.on(["KeyP"], () => togglePause());

      loop = createLoop(update);

      if (TEST) {
        window.__LM_TEST__ = {
          solve: (upTo = Infinity) => {
            if (mode !== "play") return false;
            pushHistory();
            applySolution(level, st, upTo);
            retrace();
            updateHud();
            if (result.done) winDelay = 0.3;
            return true;
          },
          // tâm ô (client px) để QA gửi PointerEvent thật vào canvas
          cellPoint: (x, y) => {
            const rect = canvas.getBoundingClientRect();
            const { t, ox, oy } = renderer.geometry();
            return { cx: rect.left + ox + x * t + t / 2, cy: rect.top + oy + y * t + t / 2 };
          },
        };
      }

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
      if (level) renderer?.fit(level);
    },

    destroy() {
      loop?.stop();
      keys?.destroy();
      ro?.disconnect();
      frame?.destroy();
      frame = null;
      renderer = null;
      level = null;
      st = null;
      if (typeof window !== "undefined") {
        delete window.__LM_STATE__;
        delete window.__LM_TEST__;
      }
    },
  };
}
