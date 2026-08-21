/**
 * Typing Rush 404 — gõ phím tốc độ (expansion 11–15).
 *
 * Theo ảnh reference: topbar ĐIỂM / WPM / CHÍNH XÁC / COMBO / THỜI GIAN;
 * chữ rơi trong khung neon (target đang gõ viền vàng-xanh, phần đã gõ
 * đổi màu cyan, chevron rơi phía trên); DANGER LINE đỏ; bàn phím QWERTY
 * ảo sáng phím kế tiếp; panel HEAT MAP tần suất phím góc phải dưới;
 * nền mưa ký tự matrix theo màu lane. 3 độ khó + chế độ thích ứng.
 * Engine thuần trong engine.js (fold Unicode tiếng Việt, WPM ký tự/5,
 * target lock tất định). Ưu tiên desktop — mobile hiện nhãn tối ưu.
 */

import { createExpansionFrame } from "../_shared/frame.js";
import { createLoop } from "../../core/loop.js";
import { el, formatScore, formatTime } from "../../core/utils.js";
import { createSession, stepSession, typeChar, backspace, metrics, drainEvents, activeWord, fold, LANES } from "./engine.js";
import { sessionConfig, DIFFICULTIES } from "./difficulty.js";
import { buildKeyboard, buildHeatmap } from "./keyboard.js";
import { TR_CSS } from "./styles.js";

const DIFF_KEY = "tr-diff";
const STATS_KEY = "tr-stats";
const TONES = ["cyan", "violet", "magenta", "white"];
const RAIN_COLORS = ["#20e3ff", "#9a5cff", "#39d353", "#dfe6ff", "#ff2ee6", "#ffd23f"];
const RAIN_GLYPHS = "01<>/{}[]#$%&*+=?!absdefkxyz404";

export function createGame() {
  let ctx = null;
  let frame = null;
  let loop = null;
  let ro = null;

  const TEST = typeof window !== "undefined" && window.__ARCADE_EXP11_TEST__;

  let mode = "intro"; // intro | play | paused | over
  let sess = null;
  let diffId = "normal";
  let time = 0;
  let stateT = 0;
  let heatT = 0;

  let rainCv = null;
  let rainG = null;
  let fieldEl = null;
  let dangerEl = null;
  let flashEl = null;
  let bottomEl = null;
  let kb = null;
  let heat = null;
  const wordEls = new Map(); // id → node
  const rainCols = [];
  let dangerY = 400;

  /* ---------------- HUD ---------------- */

  function updateHud() {
    if (!sess) return;
    const m = metrics(sess);
    frame.setStat("score", formatScore(sess.score));
    frame.setStat("wpm", String(m.wpm));
    frame.setStat("acc", `${m.acc}%`);
    frame.setStat("combo", `x${sess.combo}`);
    frame.setStat("lives", "♥".repeat(Math.max(0, sess.lives)) || "—");
    frame.setStat("time", formatTime(sess.elapsed));
  }

  /* ---------------- Layout đo đạc ---------------- */

  function relayout() {
    const rect = frame.playfield.getBoundingClientRect();
    if (rect.width < 4) return;
    const bottomH = bottomEl.getBoundingClientRect().height || 210;
    dangerY = Math.max(160, rect.height - bottomH - 34);
    dangerEl.style.top = `${dangerY}px`;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    rainCv.width = Math.floor(rect.width * dpr);
    rainCv.height = Math.floor(dangerY * dpr);
    rainCv.style.height = `${dangerY}px`;
    rainG = rainCv.getContext("2d");
    rainG.scale(dpr, dpr);
    rainG.fillStyle = "rgba(5,8,20,1)";
    rainG.fillRect(0, 0, rect.width, dangerY);
    rainCols.length = 0;
    const colW = 21;
    for (let x = colW / 2; x < rect.width; x += colW) {
      rainCols.push({ x, y: Math.random() * dangerY, speed: 55 + Math.random() * 130 });
    }
  }

  function laneX(lane) {
    const rect = frame.playfield.getBoundingClientRect();
    const margin = rect.width * 0.09;
    return margin + ((lane + 0.5) / LANES) * (rect.width - margin * 2);
  }

  /* ---------------- Word DOM ---------------- */

  function wordNode(w) {
    let node = wordEls.get(w.id);
    if (!node) {
      node = el("div", "tr-word");
      node.dataset.tone = TONES[w.id % TONES.length];
      node.appendChild(el("span", "tag", "</>"));
      node.appendChild(el("span", "done", ""));
      node.appendChild(el("span", "rest", ""));
      // 4 ngoặc góc hiện khi là mục tiêu đang gõ (như ảnh)
      for (const c of ["tl", "tr", "bl", "br"]) node.appendChild(el("i", `ck ${c}`));
      fieldEl.appendChild(node);
      wordEls.set(w.id, node);
    }
    return node;
  }

  function syncWords() {
    const seen = new Set();
    for (const w of sess.words) {
      seen.add(w.id);
      const node = wordNode(w);
      node.querySelector(".done").textContent = w.text.slice(0, w.typed);
      node.querySelector(".rest").textContent = w.text.slice(w.typed);
      node.classList.toggle("active", sess.active === w.id);
      node.style.left = `${laneX(w.lane)}px`;
      node.style.top = `${28 + w.y * (dangerY - 62)}px`;
    }
    for (const [id, node] of wordEls) {
      if (!seen.has(id) && !node.classList.contains("pop")) {
        node.remove();
        wordEls.delete(id);
      }
    }
    // phím kế tiếp: theo target đang gõ, không thì từ gần danger nhất
    let next = null;
    const act = activeWord(sess);
    if (act) next = act.folded[act.typed];
    else if (sess.words.length) {
      const closest = [...sess.words].sort((a, b) => b.y - a.y)[0];
      next = closest.folded[0];
    }
    kb.setNext(next || null);
  }

  function popWord(id) {
    const node = wordEls.get(id);
    if (!node) return;
    node.classList.add("pop");
    wordEls.delete(id);
    setTimeout(() => node.remove(), 320);
  }

  /* ---------------- Mưa ký tự ---------------- */

  function stepRain(dt) {
    if (!rainG) return;
    const rect = frame.playfield.getBoundingClientRect();
    rainG.fillStyle = "rgba(5, 8, 20, 0.15)";
    rainG.fillRect(0, 0, rect.width, dangerY);
    rainG.font = "700 14px monospace";
    rainG.textAlign = "center";
    for (let i = 0; i < rainCols.length; i++) {
      const col = rainCols[i];
      col.y += col.speed * dt;
      if (col.y > dangerY + 50) {
        col.y = -40 - Math.random() * 140;
        col.speed = 55 + Math.random() * 130;
      }
      const color = RAIN_COLORS[i % RAIN_COLORS.length];
      const glyph = (k) => RAIN_GLYPHS[(((i * 7 + k) % RAIN_GLYPHS.length) + RAIN_GLYPHS.length) % RAIN_GLYPHS.length];
      const step = Math.floor(col.y / 15);
      // đầu vệt màu đậm + đuôi mờ dần (vệt matrix như ảnh, trắng chỉ thi thoảng)
      rainG.fillStyle = i % 6 === 0 ? "#dff6ff" : `${color}ee`;
      rainG.fillText(glyph(step), col.x, col.y);
      rainG.fillStyle = `${color}88`;
      rainG.fillText(glyph(step - 1), col.x, col.y - 15);
      rainG.fillStyle = `${color}44`;
      rainG.fillText(glyph(step - 2), col.x, col.y - 30);
      rainG.fillStyle = `${color}1e`;
      rainG.fillText(glyph(step - 3), col.x, col.y - 45);
    }
  }

  /* ---------------- Sự kiện engine ---------------- */

  function handleEvents(events) {
    for (const ev of events) {
      switch (ev.type) {
        case "complete":
          ctx.audio.play("tr_word");
          if (ev.combo > 0 && ev.combo % 10 === 0) {
            ctx.audio.play("combo");
            frame.banner(`COMBO x${ev.combo}!`);
          }
          popWord(ev.id);
          updateHud();
          break;
        case "error": {
          ctx.audio.play("tr_err");
          const node = wordEls.get(ev.id);
          if (node) {
            node.classList.remove("shake");
            void node.offsetWidth;
            node.classList.add("shake");
          }
          updateHud();
          break;
        }
        case "stray":
          ctx.audio.play("tr_err");
          updateHud();
          break;
        case "danger":
          ctx.audio.play("tr_danger");
          flashEl.classList.remove("on");
          void flashEl.offsetWidth;
          flashEl.classList.add("on");
          frame.toast(`"${ev.text}" CHẠM DANGER LINE! -1 MẠNG`);
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
    sess = createSession(sessionConfig(diffId));
    for (const node of wordEls.values()) node.remove();
    wordEls.clear();
    time = 0;
    heatT = 0;
    mode = "play";
    frame.clearScreen();
    frame.setPaused(false);
    ctx.onMatchStart();
    frame.banner(`SẴN SÀNG — ${DIFFICULTIES[diffId].label}`);
    ctx.audio.play("start");
    relayout();
    updateHud();
    loop.start();
  }

  function finishMatch() {
    mode = "over";
    const m = metrics(sess);
    const stats = ctx.storage.getPref(STATS_KEY, null) || { v: 1, bestWpm: 0 };
    stats.bestWpm = Math.max(stats.bestWpm || 0, m.wpm);
    ctx.storage.setPref(STATS_KEY, stats);
    const saved = ctx.onGameOver(sess.score, { wpm: m.wpm, acc: m.acc, words: sess.wordsDone });
    frame.overScreen({
      kicker: "// PHIÊN GÕ KẾT THÚC",
      heading: "HẾT MẠNG!",
      score: sess.score,
      saved,
      statCards: [
        { label: "WPM", value: m.wpm, color: "cyan" },
        { label: "RAW WPM", value: m.rawWpm, color: "violet" },
        { label: "CHÍNH XÁC", value: `${m.acc}%`, color: "lime" },
        { label: "TỪ HOÀN THÀNH", value: sess.wordsDone, color: "gold" },
        { label: "LỖI GÕ", value: sess.typedWrong, color: "red" },
        { label: "COMBO MAX", value: `x${sess.maxCombo}`, color: "pink" },
      ],
      restartLabel: "GÕ LẠI",
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
      restartLabel: "GÕ LẠI",
      buildExtra: (box) => {
        const m = metrics(sess);
        const row = el("div", "exp-setrow");
        row.appendChild(el("span", "", "PHIÊN HIỆN TẠI"));
        row.appendChild(el("span", "val", `${m.wpm} WPM · ${m.acc}% · ${sess.wordsDone} từ`));
        box.appendChild(row);
      },
    });
  }

  function resumeGame() {
    if (mode !== "paused") return;
    mode = "play";
    frame.clearScreen();
    frame.setPaused(false);
    loop.start();
  }

  function togglePause() {
    if (mode === "play") pauseGame();
    else if (mode === "paused") resumeGame();
  }

  function showIntro() {
    mode = "intro";
    loop.stop();
    const stats = ctx.storage.getPref(STATS_KEY, null);
    const box = frame.intro({
      kicker: "// THỬ THÁCH TỐC KÝ",
      heading: [["TYPING RUSH ", ""], ["404", "pink"]],
      goal:
        "Các từ rơi dần về DANGER LINE — gõ chính xác để phá hủy chúng. Ký tự đầu khóa mục tiêu, gõ hết từ để ăn điểm và giữ combo. Hỗ trợ tiếng Việt: gõ có dấu hoặc không dấu đều được!",
      rows: [
        { keys: ["A–Z"], text: "gõ ký tự — từ khớp sẽ được khóa làm mục tiêu" },
        { keys: ["⌫"], text: "lùi một ký tự của từ đang gõ" },
        { keys: ["ESC"], text: "tạm dừng" },
      ],
      startLabel: "BẮT ĐẦU GÕ",
      onStart: () => beginMatch(),
      note: stats?.bestWpm ? `KỶ LỤC WPM CỦA BẠN: ${stats.bestWpm} · Tối ưu cho máy tính có bàn phím.` : "Tối ưu cho máy tính có bàn phím.",
    });
    // chèn hàng chọn độ khó trước nút CTA
    const diffRow = el("div", "tr-diffs");
    const chips = new Map();
    for (const d of Object.values(DIFFICULTIES)) {
      const chip = el("button", "tr-diff", d.label);
      chip.type = "button";
      chip.addEventListener("click", () => {
        diffId = d.id;
        ctx.storage.setPref(DIFF_KEY, diffId);
        for (const [id, c] of chips) c.classList.toggle("sel", id === diffId);
        ctx.audio.play("ui");
      });
      chips.set(d.id, chip);
      diffRow.appendChild(chip);
    }
    chips.get(diffId)?.classList.add("sel");
    const cta = box.querySelector(".exp-cta");
    box.insertBefore(diffRow, cta);
  }

  /* ---------------- Vòng lặp ---------------- */

  function update(dt) {
    time += dt;
    if (mode === "play") {
      stepSession(sess, dt);
      handleEvents(drainEvents(sess));
      if (mode !== "play") return;
      syncWords();
      frame.setStat("time", formatTime(sess.elapsed));
      heatT += dt;
      if (heatT > 0.8) {
        heatT = 0;
        heat.update(sess.keyHeat);
        updateHud();
      }
    }
    stepRain(dt);

    if (TEST && sess) {
      stateT += dt;
      if (stateT > 0.3) {
        stateT = 0;
        const m = metrics(sess);
        window.__TR_STATE__ = {
          mode,
          score: sess.score,
          wpm: m.wpm,
          acc: m.acc,
          combo: sess.combo,
          lives: sess.lives,
          targets: sess.words.length,
          wordsDone: sess.wordsDone,
          errors: sess.typedWrong,
          active: sess.active,
        };
      }
    }
  }

  /* ---------------- Interface ---------------- */

  return {
    async mount(container, context) {
      ctx = context;

      const rootNode = container.getRootNode();
      if (rootNode instanceof ShadowRoot && !rootNode.querySelector("#tr-style")) {
        const style = document.createElement("style");
        style.id = "tr-style";
        style.textContent = TR_CSS;
        rootNode.appendChild(style);
      }

      diffId = ctx.storage.getPref(DIFF_KEY, "normal");
      if (!DIFFICULTIES[diffId]) diffId = "normal";

      frame = createExpansionFrame(container, ctx, {
        accent: "cyan",
        title: [["TYPING RUSH ", ""], ["404", "pink"]],
        stats: [
          { id: "score", label: "ĐIỂM", color: "cyan", value: "000000" },
          { id: "wpm", label: "WPM", color: "cyan", value: "0" },
          { id: "acc", label: "CHÍNH XÁC", color: "white", value: "100%" },
          { id: "combo", label: "COMBO", color: "pink", value: "x0" },
          { id: "lives", label: "MẠNG", color: "red", value: "♥♥♥", optional: true },
          { id: "time", label: "THỜI GIAN", color: "white", value: "00:00" },
        ],
        onPauseToggle: togglePause,
      });
      frame.root.classList.add("tr-mode");

      rainCv = document.createElement("canvas");
      rainCv.className = "tr-rain";
      frame.playfield.appendChild(rainCv);

      fieldEl = el("div", "tr-field");
      frame.playfield.appendChild(fieldEl);

      dangerEl = el("div", "tr-danger");
      dangerEl.appendChild(el("div", "warn"));
      dangerEl.appendChild(el("div", "line"));
      dangerEl.appendChild(el("div", "lbl", "« DANGER LINE »"));
      dangerEl.appendChild(el("div", "line"));
      dangerEl.appendChild(el("div", "warn"));
      frame.playfield.appendChild(dangerEl);

      flashEl = el("div", "tr-flash");
      frame.playfield.appendChild(flashEl);

      /* trang trí hai bên như ảnh: cột code trái + "404" glitch phải */
      const decoL = el("div", "tr-deco left");
      for (const s of ["0x1F4A::OK", "SYS.CHECK ▒", "NODE_404", "0b110101", "TX >> RX", "GLITCH:0.4", "MEM 87%", "PING 12ms", "#A4F ░░", "RUN_"]) {
        decoL.appendChild(el("div", "ln", s));
      }
      const decoR = el("div", "tr-deco right");
      decoR.appendChild(el("div", "big", "404"));
      for (const s of ["ERR ▒▒", "SIGNAL LOST", "REBOOT ░"]) decoR.appendChild(el("div", "ln", s));
      frame.playfield.appendChild(decoL);
      frame.playfield.appendChild(decoR);

      bottomEl = el("div", "tr-bottom");
      const kbBox = el("div");
      kbBox.style.flex = "1";
      kbBox.style.minWidth = "0";
      kb = buildKeyboard(kbBox);
      bottomEl.appendChild(kbBox);
      const heatBox = el("div");
      heat = buildHeatmap(heatBox);
      bottomEl.appendChild(heatBox.firstChild);
      frame.playfield.appendChild(bottomEl);

      if (window.matchMedia("(pointer: coarse)").matches) {
        frame.playfield.appendChild(el("div", "tr-note", "TỐI ƯU CHO MÁY TÍNH"));
      }

      ro = new ResizeObserver(() => relayout());
      ro.observe(frame.playfield);

      // gõ phím: bắt trực tiếp keydown (cần e.key cho Unicode)
      window.addEventListener(
        "keydown",
        (e) => {
          if (mode !== "play") return;
          const t = e.target;
          if (t instanceof Element && t.closest("button, a, input, select, textarea")) return;
          if (e.ctrlKey || e.metaKey || e.altKey) return;
          if (e.key === "Backspace") {
            e.preventDefault();
            if (backspace(sess)) {
              ctx.audio.play("ui");
              syncWords();
            }
            return;
          }
          if (e.key.length === 1) {
            if (e.key === " ") e.preventDefault();
            const r = typeChar(sess, e.key);
            kb.flash(fold(e.key), r.result !== "error" && r.result !== "stray");
            if (r.result === "advance" || r.result === "lock") ctx.audio.play("tr_key");
            handleEvents(drainEvents(sess));
            if (mode === "play") syncWords();
          }
        },
        { signal: ctx.signal }
      );

      loop = createLoop(update);

      if (TEST) {
        window.__TR_TEST__ = {
          words: () => (sess ? sess.words.map((w) => ({ id: w.id, text: w.text, typed: w.typed, y: w.y, lane: w.lane })) : []),
          rush: () => {
            if (!sess || !sess.words.length) return false;
            const closest = [...sess.words].sort((a, b) => b.y - a.y)[0];
            closest.y = 0.995;
            return true;
          },
          metrics: () => (sess ? metrics(sess) : null),
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
      relayout();
    },

    destroy() {
      loop?.stop();
      ro?.disconnect();
      frame?.destroy();
      frame = null;
      sess = null;
      wordEls.clear();
      if (typeof window !== "undefined") {
        delete window.__TR_STATE__;
        delete window.__TR_TEST__;
      }
    },
  };
}
