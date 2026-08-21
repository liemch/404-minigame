/**
 * Memory Matrix 404 — lật thẻ tìm cặp theo màn (expansion 16–20).
 *
 * Theo ảnh reference: topbar MÀN / LƯỢT / CẶP / THỜI GIAN / COMBO;
 * lưới thẻ neon giữa-trái (úp: hoa văn mạch + chữ 404 tím, mở: viền
 * cyan, match: viền lime + tick); sidebar phải GỢI Ý (bóng đèn, còn
 * n lượt) + CHƠI LẠI. 4 kích thước bàn theo plan: 4×3 → 4×4 → 5×4 →
 * 6×4, thời gian giảm dần. Tối đa 2 thẻ mở, khóa input khi so khớp,
 * combo khi match liên tiếp, hint mở nhanh toàn bộ nhưng trừ điểm.
 */

import { createExpansionFrame } from "../_shared/frame.js";
import { createKeyboard } from "../../core/input-manager.js";
import { createLoop } from "../../core/loop.js";
import { el, svgIcon, formatTime, formatNumber } from "../../core/utils.js";
import { makeBoard, flipCard, closeOpen, boardCleared, SCORE } from "./engine.js";
import { createMatrixRenderer } from "./render.js";
import { MM_CSS } from "./styles.js";

const FLIP_SPEED = 5; // tốc độ nội suy lật thẻ (1/s)
const WRONG_HOLD = 0.8; // thời gian giữ cặp sai trước khi úp lại
const HINTS_PER_RUN = 3;

export function createGame() {
  let ctx = null;
  let frame = null;
  let renderer = null;
  let keys = null;
  let loop = null;
  let ro = null;
  let canvas = null;
  let stage = null;
  let hintBtn = null;
  let gemCount = null;

  const TEST = typeof window !== "undefined" && window.__ARCADE_EXP16_TEST__;

  let mode = "intro"; // intro | play | paused | over
  let time = 0;
  let hudT = 0;

  /** Trạng thái một lượt chơi */
  const state = {
    board: null,
    level: 1,
    score: 0,
    moves: 0,
    hints: HINTS_PER_RUN,
    combo: 0,
    maxCombo: 0,
    matches: 0,
    cursor: 0,
    cursorOn: false,
    hintT: 0,
    levelClearT: 0,
    fx: [],
  };

  /* ---------------- HUD ---------------- */

  function updateHud() {
    const b = state.board;
    if (!b) return;
    frame.setStat("level", String(state.level).padStart(2, "0"));
    frame.setStat("moves", String(state.moves));
    frame.setStat("pairs", `${String(b.found).padStart(2, "0")}/${String(b.pairs).padStart(2, "0")}`);
    frame.setStat("time", formatTime(b.timeLeft));
    frame.setStat("combo", `x${state.combo}`);
    if (gemCount) gemCount.textContent = String(state.hints);
    if (hintBtn) hintBtn.disabled = state.hints <= 0 || mode !== "play";
  }

  /* ---------------- Luật ---------------- */

  function tryFlip(idx) {
    const b = state.board;
    if (mode !== "play" || !b || state.levelClearT > 0 || state.hintT > 0) return;
    const res = flipCard(b, idx);
    if (res === null) return;
    ctx.audio.play("mm_flip");
    if (res === "open") return;

    state.moves += 1;
    if (res === "match") {
      state.combo += 1;
      state.maxCombo = Math.max(state.maxCombo, state.combo);
      state.matches += 1;
      const gained = SCORE.match + (state.combo - 1) * SCORE.comboStep;
      state.score += gained;
      ctx.audio.play("mm_match");
      if (state.combo >= 2) {
        ctx.audio.play("combo");
        frame.toast(`COMBO x${state.combo} · +${gained} ĐIỂM`);
      }
      // vòng lan lime quanh 2 thẻ vừa match
      for (const c of b.cards) {
        if (c.flash > 0) state.fx.push({ idx: c.idx, life: 0.5, life0: 0.5 });
      }
      if (boardCleared(b)) beginLevelClear();
    } else {
      // cặp sai: khóa input, úp lại sau WRONG_HOLD
      state.combo = 0;
      b.lock = WRONG_HOLD;
      ctx.audio.play("mm_wrong");
    }
    updateHud();
  }

  function useHint() {
    if (mode !== "play" || state.hints <= 0 || state.hintT > 0) return;
    const b = state.board;
    if (!b || b.lock > 0 || state.levelClearT > 0) return;
    state.hints -= 1;
    state.hintT = 1.4;
    state.score = Math.max(0, state.score - SCORE.hintCost);
    ctx.audio.play("mm_hint");
    frame.toast(`GỢI Ý: LỘ BÀI 1.4s · -${SCORE.hintCost} ĐIỂM`);
    updateHud();
  }

  function beginLevelClear() {
    const b = state.board;
    const bonus = Math.ceil(b.timeLeft) * SCORE.timeBonusPerSec;
    state.score += bonus;
    state.levelClearT = 1.7;
    ctx.audio.play("levelup");
    frame.banner(`MÀN ${String(state.level).padStart(2, "0")} XONG · +${bonus}`);
    updateHud();
  }

  function nextLevel() {
    state.level += 1;
    state.board = makeBoard(state.level, TEST ? 404 + state.level : null);
    state.cursor = 0;
    state.fx.length = 0;
    frame.toast(`MÀN ${String(state.level).padStart(2, "0")} — ${state.board.cols}×${state.board.rows}`);
    updateHud();
  }

  /* ---------------- Vòng đời ---------------- */

  function beginMatch() {
    state.board = makeBoard(1, TEST ? 404 : null);
    state.level = 1;
    state.score = 0;
    state.moves = 0;
    state.hints = HINTS_PER_RUN;
    state.combo = 0;
    state.maxCombo = 0;
    state.matches = 0;
    state.cursor = 0;
    state.cursorOn = false;
    state.hintT = 0;
    state.levelClearT = 0;
    state.fx.length = 0;
    mode = "play";
    frame.clearScreen();
    frame.setPaused(false);
    ctx.onMatchStart();
    ctx.audio.play("start");
    updateHud();
    loop.start();
  }

  function finishMatch() {
    mode = "over";
    loop.stop();
    const saved = ctx.onGameOver(state.score, {
      level: state.level,
      matches: state.matches,
      maxCombo: state.maxCombo,
    });
    frame.overScreen({
      kicker: "// HẾT GIỜ",
      heading: "BỘ NHỚ QUÁ TẢI!",
      score: state.score,
      saved,
      statCards: [
        { label: "MÀN ĐẠT", value: String(state.level).padStart(2, "0"), color: "cyan" },
        { label: "CẶP ĐÚNG", value: state.matches, color: "lime" },
        { label: "LƯỢT LẬT", value: state.moves, color: "pink" },
        { label: "COMBO MAX", value: `x${state.maxCombo}`, color: "gold" },
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
        row.appendChild(
          el("span", "val", `MÀN ${state.level} · ${state.board.found}/${state.board.pairs} cặp · ${formatNumber(state.score)} điểm`)
        );
        box.appendChild(row);
      },
    });
    updateHud();
  }

  function resumeGame() {
    if (mode !== "paused") return;
    mode = "play";
    frame.clearScreen();
    frame.setPaused(false);
    keys.clearDown();
    updateHud();
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
      kicker: "// KIỂM TRA BỘ NHỚ",
      heading: [["MEMORY MATRIX ", ""], ["404", "cyan"]],
      goal:
        "Lật thẻ tìm cặp biểu tượng giống nhau trước khi hết giờ. Bàn lớn dần theo màn (4×3 → 6×4), thời gian ngày càng gắt. Match liên tiếp để ăn COMBO — có 3 lượt GỢI Ý lộ bài nhưng bị trừ điểm!",
      rows: [
        { keys: ["Click", "Chạm"], text: "lật thẻ" },
        { keys: ["↑↓←→", "Enter"], text: "chọn thẻ + lật bằng bàn phím" },
        { keys: ["H"], text: `gợi ý (lộ bài, -${SCORE.hintCost} điểm)` },
        { keys: ["ESC", "P"], text: "tạm dừng" },
      ],
      startLabel: "BẮT ĐẦU",
      onStart: () => beginMatch(),
    });
    state.board = makeBoard(1, 404);
    renderer.fit();
    renderer.draw(state, 0);
    updateHud();
  }

  /* ---------------- Vòng lặp ---------------- */

  function update(dt) {
    time += dt;
    const b = state.board;
    if (mode === "play" && b) {
      // đồng hồ chỉ chạy khi không trong màn hình "xong màn"
      if (state.levelClearT > 0) {
        state.levelClearT -= dt;
        if (state.levelClearT <= 0) nextLevel();
      } else {
        b.timeLeft -= dt;
        if (b.timeLeft <= 0) {
          b.timeLeft = 0;
          finishMatch();
          return;
        }
      }
      // khóa cặp sai
      if (b.lock > 0) {
        b.lock -= dt;
        if (b.lock <= 0) {
          b.lock = 0;
          closeOpen(b);
        }
      }
      if (state.hintT > 0) state.hintT -= dt;
      hudT += dt;
      if (hudT > 0.2) {
        hudT = 0;
        updateHud();
      }
    }
    // nội suy lật thẻ + hiệu ứng
    if (b) {
      for (const c of b.cards) {
        const target = c.state === "down" ? 0 : 1;
        c.anim += (target - c.anim) * Math.min(1, dt * FLIP_SPEED);
        if (Math.abs(c.anim - target) < 0.01) c.anim = target;
        if (c.flash > 0) c.flash -= dt;
      }
    }
    for (let i = state.fx.length - 1; i >= 0; i--) {
      state.fx[i].life -= dt;
      if (state.fx[i].life <= 0) state.fx.splice(i, 1);
    }
    renderer.draw(state, time);

    if (TEST && b) {
      window.__MM_STATE__ = {
        mode,
        level: state.level,
        score: state.score,
        moves: state.moves,
        found: b.found,
        pairs: b.pairs,
        combo: state.combo,
        lock: b.lock,
        timeLeft: Math.round(b.timeLeft),
      };
    }
  }

  /* ---------------- Interface ---------------- */

  return {
    async mount(container, context) {
      ctx = context;

      const rootNode = container.getRootNode();
      if (rootNode instanceof ShadowRoot && !rootNode.querySelector("#mm-style")) {
        const style = document.createElement("style");
        style.id = "mm-style";
        style.textContent = MM_CSS;
        rootNode.appendChild(style);
      }

      frame = createExpansionFrame(container, ctx, {
        accent: "cyan",
        title: [["MEMORY MATRIX ", ""], ["404", "cyan"]],
        stats: [
          { id: "level", label: "MÀN", color: "cyan", value: "01" },
          { id: "moves", label: "LƯỢT", color: "pink", value: "0" },
          { id: "pairs", label: "CẶP", color: "white", value: "00/06" },
          { id: "time", label: "THỜI GIAN", color: "cyan", value: "00:54" },
          { id: "combo", label: "COMBO", color: "lime", value: "x0", optional: true },
        ],
        onPauseToggle: togglePause,
      });
      frame.root.classList.add("mm-mode");

      stage = el("div", "mm-stage");
      canvas = document.createElement("canvas");
      canvas.setAttribute("aria-label", "Bàn thẻ Memory Matrix");
      stage.appendChild(canvas);
      frame.playfield.appendChild(stage);

      /* sidebar GỢI Ý + CHƠI LẠI */
      const side = el("div", "mm-side");
      const hintPanel = el("div", "mm-panel");
      hintPanel.dataset.tone = "violet";
      hintPanel.appendChild(el("div", "ttl", "GỢI Ý"));
      hintBtn = el("button", "act");
      hintBtn.type = "button";
      hintBtn.setAttribute("aria-label", "Dùng gợi ý (lộ bài, trừ điểm)");
      {
        // icon bóng đèn tự vẽ (sprite chung không có sẵn)
        const NS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(NS, "svg");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("aria-hidden", "true");
        const path = document.createElementNS(NS, "path");
        path.setAttribute(
          "d",
          "M12 2.6a6.6 6.6 0 0 0-3.6 12.1c.5.36.8.9.8 1.5v.9h5.6v-.9c0-.6.3-1.14.8-1.5A6.6 6.6 0 0 0 12 2.6zM9.4 18.6h5.2v1.5H9.4zM10.2 21.1h3.6v1.3h-3.6z"
        );
        path.setAttribute("fill", "currentColor");
        svg.appendChild(path);
        for (const [x, y] of [[19.6, 4.2], [21, 7.6], [3, 5.4]]) {
          const r = document.createElementNS(NS, "rect");
          r.setAttribute("x", x);
          r.setAttribute("y", y);
          r.setAttribute("width", "1.5");
          r.setAttribute("height", "1.5");
          r.setAttribute("fill", "currentColor");
          svg.appendChild(r);
        }
        hintBtn.appendChild(svg);
      }
      hintBtn.addEventListener("click", () => {
        hintBtn.blur();
        useHint();
      });
      hintPanel.appendChild(hintBtn);
      const gems = el("div", "gems");
      gems.appendChild(el("i"));
      gemCount = el("span", "", String(HINTS_PER_RUN));
      gems.appendChild(gemCount);
      hintPanel.appendChild(gems);
      side.appendChild(hintPanel);

      const restartPanel = el("div", "mm-panel");
      restartPanel.dataset.tone = "cyan";
      restartPanel.appendChild(el("div", "ttl", "CHƠI LẠI"));
      const restartBtn = el("button", "act");
      restartBtn.type = "button";
      restartBtn.setAttribute("aria-label", "Chơi lại từ màn 1");
      restartBtn.appendChild(svgIcon("i-restart"));
      restartBtn.addEventListener("click", () => {
        restartBtn.blur();
        if (mode === "play" || mode === "paused") beginMatch();
      });
      restartPanel.appendChild(restartBtn);
      side.appendChild(restartPanel);
      frame.playfield.appendChild(side);

      /* input con trỏ */
      canvas.addEventListener(
        "pointerdown",
        (e) => {
          e.preventDefault();
          state.cursorOn = false;
          const idx = renderer.hitTest(e.clientX, e.clientY, state.board);
          if (idx >= 0) tryFlip(idx);
        },
        { signal: ctx.signal }
      );

      /* bàn phím */
      keys = createKeyboard({ signal: ctx.signal });
      const moveCursor = (dc, dr) => {
        if (mode !== "play" || !state.board) return;
        const b = state.board;
        state.cursorOn = true;
        const c = Math.max(0, Math.min(b.cols - 1, (state.cursor % b.cols) + dc));
        const r = Math.max(0, Math.min(b.rows - 1, Math.floor(state.cursor / b.cols) + dr));
        state.cursor = r * b.cols + c;
        ctx.audio.play("ui");
      };
      keys.on(["ArrowLeft", "KeyA"], () => moveCursor(-1, 0), { repeat: true });
      keys.on(["ArrowRight", "KeyD"], () => moveCursor(1, 0), { repeat: true });
      keys.on(["ArrowUp", "KeyW"], () => moveCursor(0, -1), { repeat: true });
      keys.on(["ArrowDown", "KeyS"], () => moveCursor(0, 1), { repeat: true });
      keys.on(["Enter", "Space"], () => {
        if (mode === "play" && state.cursorOn) tryFlip(state.cursor);
      });
      keys.on(["KeyH"], () => useHint());
      keys.on(["KeyP"], () => togglePause());

      renderer = createMatrixRenderer(canvas, stage);
      ro = new ResizeObserver(() => renderer.fit());
      ro.observe(stage);

      loop = createLoop(update);

      if (TEST) {
        window.__MM_TEST__ = {
          deck: () => state.board?.cards.map((c) => c.icon.id) || [],
          flip: (i) => tryFlip(i),
          setTime: (t) => {
            if (state.board) state.board.timeLeft = t;
            return true;
          },
          hint: () => useHint(),
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
      state.board = null;
      if (typeof window !== "undefined") {
        delete window.__MM_STATE__;
        delete window.__MM_TEST__;
      }
    },
  };
}
