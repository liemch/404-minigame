/**
 * Rhythm Hack — game nhịp điệu 4 lane D/F/J/K (game 10).
 *
 * Theo plan + ảnh reference: highway phối cảnh 4 lane màu, panel ĐIỂM /
 * COMBO / CHÍNH XÁC bên trái, SYSTEM REPAIR (tim pixel + tiến trình) và
 * TERMINAL bên phải, hàng phím D F J K dưới đáy (đồng thời là 4 vùng
 * chạm). Nhạc chiptune TỰ TỔNG HỢP đồng bộ với chart; đồng hồ chuẩn là
 * audioContext.currentTime (pause = suspend → không bao giờ lệch nhịp).
 * Judgement ±45/±90/±140ms, scoring 1000/700/400 + combo multiplier có
 * trần, accuracy trọng số, calibration offset ±150ms trong pause menu.
 */

import { createExpansionFrame } from "../_shared/frame.js";
import { createKeyboard } from "../../core/input-manager.js";
import { createLoop } from "../../core/loop.js";
import { el, formatScore, formatTime } from "../../core/utils.js";
import { SONG, buildSong } from "./chart.js";
import { createMusic } from "./audio.js";
import { createJudge } from "./engine.js";
import { createHighwayRenderer, paintHeart, LANE_COLORS } from "./render.js";
import { RH_CSS } from "./styles.js";

const OFFSET_KEY = "rhythm-offset";
const KEY_LANES = { KeyD: 0, KeyF: 1, KeyJ: 2, KeyK: 3 };
const JUDGE_LABEL = { perfect: "PERFECT", great: "GREAT", good: "GOOD" };
const JUDGE_COLOR = { perfect: "#20e3ff", great: "#9a5cff", good: "#ffd23f", miss: "#ff3b4f" };

const TERMINAL_SCRIPT = [
  [2, "> Scanning system...", "ok"],
  [7, "> Detecting errors...", "ok"],
  [14, "> Uploading patches...", "ok"],
  [24, "> Synchronizing...", "info"],
  [36, "> Defragmenting core...", "ok"],
  [48, "> System improving...", "info"],
];

export function createGame() {
  let ctx = null;
  let frame = null;
  let renderer = null;
  let canvas = null;
  let keys = null;
  let loop = null;
  let song = null;
  let judge = null;
  let music = null;

  let scoreEl = null;
  let comboEl = null;
  let accEl = null;
  let heartCanvas = null;
  let progressFill = null;
  let progressPct = null;
  let termLines = null;
  let keyEls = [];

  const TEST = typeof window !== "undefined" && window.__ARCADE_EXP5_TEST__;

  let mode = "intro"; // intro | play | paused | over
  let offsetMs = 0;
  let heartStep = -1;
  let termIdx = 0;
  let autoIdx = 0;
  let missSfxT = 0;
  let stateT = 0;
  let time = 0;

  /* ---------------- HUD panels ---------------- */

  function updatePanels() {
    const st = judge.state;
    scoreEl.textContent = formatScore(st.score);
    comboEl.textContent = `×${st.combo}`;
    accEl.textContent = `${judge.accuracy().toFixed(1)}%`;
  }

  function termLog(text, cls) {
    const span = el("span", cls, text);
    termLines.insertBefore(span, termLines.lastElementChild);
    while (termLines.children.length > 7) termLines.removeChild(termLines.firstElementChild);
  }

  function updateSidePanels(songTime) {
    const progress = Math.max(0, Math.min(1, songTime / song.duration));
    const step = Math.floor(progress * 40);
    if (step !== heartStep) {
      heartStep = step;
      paintHeart(heartCanvas, progress);
      progressFill.style.width = `${Math.round(progress * 100)}%`;
      progressPct.textContent = `${Math.round(progress * 100)}%`;
    }
    while (termIdx < TERMINAL_SCRIPT.length && TERMINAL_SCRIPT[termIdx][0] <= songTime) {
      const [, text, cls] = TERMINAL_SCRIPT[termIdx];
      termLog(text, cls);
      termIdx++;
    }
  }

  /* ---------------- Nhấn lane ---------------- */

  function hitLane(lane) {
    if (mode !== "play") return;
    renderer.press(lane);
    keyEls[lane]?.classList.add("held");
    const songTime = music.now();
    if (songTime < -0.05) return;
    const r = judge.onKey(lane, songTime + offsetMs / 1000);
    if (r) {
      renderer.pop(JUDGE_LABEL[r.judgement], JUDGE_COLOR[r.judgement]);
      renderer.burst(lane, LANE_COLORS[lane], r.judgement === "perfect" ? 14 : 8);
      if (judge.state.combo > 0 && judge.state.combo % 50 === 0) {
        termLog(`> Combo x${judge.state.combo} — stable`, "info");
      }
      updatePanels();
    }
  }

  function releaseLane(lane) {
    keyEls[lane]?.classList.remove("held");
  }

  /* ---------------- Vòng đời ---------------- */

  function startMatch() {
    song = buildSong({ test: TEST });
    judge = createJudge(song.notes, SONG);
    music?.stop();
    music = createMusic(ctx.audio.getContext(), song.music);
    autoIdx = 0;
    termIdx = 0;
    heartStep = -1;
    mode = "play";
    frame.clearScreen();
    frame.setPaused(false);
    termLines.textContent = "";
    termLines.appendChild(el("span", "cursor", "_ Working..."));
    ctx.onMatchStart();
    updatePanels();
    music.start(TEST ? 1.2 : 3 * song.beat + 0.2);
    loop.start();
    if (!music.hasAudio) frame.toast("KHÔNG CÓ WEBAUDIO — CHẠY CHẾ ĐỘ IM LẶNG");
  }

  function endMatch() {
    mode = "over";
    music.pause();
    const st = judge.state;
    const acc = judge.accuracy();
    const rank = acc >= 95 ? "S" : acc >= 88 ? "A" : acc >= 75 ? "B" : acc >= 60 ? "C" : "D";
    const saved = ctx.onGameOver(st.score, { accuracy: Math.round(acc * 10) / 10, maxCombo: st.maxCombo, rank });
    frame.overScreen({
      kicker: "// VÁ HỆ THỐNG HOÀN TẤT",
      heading: `HẠNG ${rank} — ${acc.toFixed(1)}%`,
      score: st.score,
      saved,
      statCards: [
        { label: "PERFECT", value: st.counts.perfect, color: "cyan" },
        { label: "GREAT", value: st.counts.great, color: "violet" },
        { label: "GOOD", value: st.counts.good, color: "gold" },
        { label: "MISS", value: st.counts.miss, color: "red" },
        { label: "COMBO CAO NHẤT", value: `×${st.maxCombo}`, color: "pink" },
      ],
      restartLabel: "CHƠI LẠI BÀI",
      onRestart: () => startMatch(),
    });
    ctx.audio.play(acc >= 75 ? "win" : "over");
  }

  function pauseGame() {
    if (mode !== "play") return;
    mode = "paused";
    music.pause(); // suspend audio clock — chart không lệch
    loop.stop();
    frame.setPaused(true);
    frame.pauseMenu({
      onResume: () => resumeGame(),
      onRestart: () => startMatch(),
      restartLabel: "CHƠI LẠI BÀI",
      buildExtra: (box) => {
        const row = el("div", "exp-setrow");
        row.appendChild(el("span", "", "CĂN CHỈNH ĐỘ TRỄ"));
        const val = el("span", "val", `${offsetMs > 0 ? "+" : ""}${offsetMs}ms`);
        row.appendChild(val);
        box.appendChild(row);
        const range = document.createElement("input");
        range.type = "range";
        range.className = "exp-range";
        range.min = "-150";
        range.max = "150";
        range.step = "5";
        range.value = String(offsetMs);
        range.setAttribute("aria-label", "Căn chỉnh độ trễ âm thanh (ms)");
        const paint = () => {
          const pct = ((Number(range.value) + 150) / 300) * 100;
          range.style.setProperty("--fill", `${pct}%`);
          val.textContent = `${Number(range.value) > 0 ? "+" : ""}${range.value}ms`;
        };
        paint();
        range.addEventListener("input", () => {
          offsetMs = Number(range.value);
          ctx.storage.setPref(OFFSET_KEY, offsetMs);
          paint();
        });
        box.appendChild(range);
        const note = el("div", "exp-setrow");
        note.appendChild(el("span", "", "NOTE TRỄ SO VỚI NHẠC → KÉO DƯƠNG"));
        box.appendChild(note);
      },
    });
  }

  function resumeGame() {
    if (mode !== "paused") return;
    mode = "play";
    frame.clearScreen();
    frame.setPaused(false);
    keys.clearDown();
    music.resume();
    loop.start();
  }

  function togglePause() {
    if (mode === "play") pauseGame();
    else if (mode === "paused") resumeGame();
  }

  /* ---------------- Vòng lặp ---------------- */

  function update(dt) {
    time += dt;
    const songTime = music.now();

    if (mode === "play") {
      // autoplay cho QA tự động (chỉ khi TEST)
      if (TEST && window.__RH_AUTOPLAY__) {
        const jt = songTime + offsetMs / 1000;
        while (autoIdx < song.notes.length && song.notes[autoIdx].time <= jt) {
          if (!judge.isDone(autoIdx)) {
            const n = song.notes[autoIdx];
            const r = judge.onKey(n.lane, n.time);
            if (r) {
              renderer.press(n.lane);
              renderer.pop(JUDGE_LABEL[r.judgement], JUDGE_COLOR[r.judgement]);
              renderer.burst(n.lane, LANE_COLORS[n.lane], 6);
            }
          }
          autoIdx++;
        }
        updatePanels();
      }

      // quét miss theo đồng hồ audio
      const missed = judge.tick(songTime + offsetMs / 1000);
      if (missed.length) {
        for (const i of missed) {
          renderer.miss(song.notes[i].lane);
        }
        renderer.pop("MISS", JUDGE_COLOR.miss);
        termLog("> Patch failed!", "fail");
        if (time - missSfxT > 0.35) {
          missSfxT = time;
          ctx.audio.play("miss");
        }
        updatePanels();
      }

      frame.setStat("time", formatTime(Math.max(0, songTime)));
      frame.setStatBar("time", (songTime / song.duration) * 100);
      updateSidePanels(songTime);

      if (songTime > song.duration + 0.8) {
        endMatch();
        return;
      }

      if (TEST) {
        stateT += dt;
        if (stateT > 0.4) {
          stateT = 0;
          window.__RH_STATE__ = {
            mode,
            songTime: Math.round(songTime * 100) / 100,
            score: judge.state.score,
            combo: judge.state.combo,
            judged: judge.state.judged,
            miss: judge.state.counts.miss,
            acc: Math.round(judge.accuracy() * 10) / 10,
            hasAudio: music.hasAudio,
          };
        }
      }
    }

    renderer.draw(songTime, song.notes, judge, song.beat, dt);
  }

  /* ---------------- Intro ---------------- */

  function showIntro() {
    mode = "intro";
    loop.stop();
    frame.intro({
      kicker: "// GIAO THỨC SỬA CHỮA",
      heading: [["RHYTHM ", ""], ["HACK", "cyan"]],
      goal:
        `Bài "${SONG.title}" — ${SONG.bpm} BPM, nhạc chiptune tổng hợp trực tiếp. Nhấn đúng lúc note chạm VẠCH SÁNG để vá hệ thống: PERFECT ±45ms · GREAT ±90ms · GOOD ±140ms. Miss sẽ reset combo!`,
      rows: [
        { keys: ["D", "F", "J", "K"], text: "đánh 4 lane theo nhịp" },
        { keys: ["Chạm"], text: "chạm 4 phím / 4 vùng lane trên tablet" },
        { keys: ["ESC"], text: "tạm dừng (có chỉnh độ trễ ±ms)" },
      ],
      startLabel: "BẮT ĐẦU HACK",
      onStart: () => startMatch(),
      note: "Mẹo: nếu cảm giác note lệch so với nhạc, mở TẠM DỪNG và kéo thanh CĂN CHỈNH ĐỘ TRỄ.",
    });
    renderer.fit();
    renderer.draw(-1, song.notes, judge, song.beat, 0);
  }

  /* ---------------- Interface ---------------- */

  return {
    async mount(container, context) {
      ctx = context;
      offsetMs = Number(ctx.storage.getPref(OFFSET_KEY, 0)) || 0;

      const rootNode = container.getRootNode();
      if (rootNode instanceof ShadowRoot && !rootNode.querySelector("#rh-style")) {
        const style = document.createElement("style");
        style.id = "rh-style";
        style.textContent = RH_CSS;
        rootNode.appendChild(style);
      }

      frame = createExpansionFrame(container, ctx, {
        accent: "cyan",
        title: [["RHYTHM ", ""], ["HACK", "cyan"]],
        buttonStyle: "inline",
        buttonLabels: { pause: "PAUSE", resume: "RESUME", sound: "SOUND", switch: "ĐỔI GAME", home: "HOME" },
        stats: [{ id: "time", label: "THỜI GIAN", color: "cyan", value: "00:00", bar: true }],
        onPauseToggle: togglePause,
      });

      const layout = el("div", "rh-layout");

      /* Cột trái: ĐIỂM / COMBO / CHÍNH XÁC */
      const left = el("div", "rh-col");
      const mkStat = (label, tone, initial) => {
        const p = el("div", "rh-panel");
        p.dataset.tone = tone;
        const inBox = el("div", "in");
        inBox.appendChild(el("div", "lbl", label));
        const v = el("div", "val", initial);
        inBox.appendChild(v);
        const eq = el("div", "eq");
        for (let i = 0; i < 9; i++) {
          const bar = el("i");
          bar.style.height = `${20 + ((i * 37) % 70)}%`;
          eq.appendChild(bar);
        }
        inBox.appendChild(eq);
        p.appendChild(inBox);
        left.appendChild(p);
        return v;
      };
      scoreEl = mkStat("ĐIỂM", "cyan", "000000");
      comboEl = mkStat("COMBO", "pink", "×0");
      accEl = mkStat("CHÍNH XÁC", "lime", "100.0%");

      /* Giữa: highway + hàng phím */
      const stage = el("div", "rh-stage");
      const cbox = el("div", "rh-canvasbox");
      canvas = document.createElement("canvas");
      canvas.setAttribute("aria-label", "Highway 4 lane Rhythm Hack");
      cbox.appendChild(canvas);
      stage.appendChild(cbox);

      const keysRow = el("div", "rh-keys");
      const KEY_DEF = [["D", "cyan"], ["F", "violet"], ["J", "pink"], ["K", "lime"]];
      keyEls = KEY_DEF.map(([label, tone], lane) => {
        const b = el("button", "rh-key", label);
        b.type = "button";
        b.dataset.tone = tone;
        b.setAttribute("aria-label", `Lane ${label}`);
        b.addEventListener(
          "pointerdown",
          (e) => {
            e.preventDefault();
            hitLane(lane);
          },
          { signal: ctx.signal }
        );
        b.addEventListener("pointerup", () => releaseLane(lane), { signal: ctx.signal });
        b.addEventListener("pointercancel", () => releaseLane(lane), { signal: ctx.signal });
        keysRow.appendChild(b);
        return b;
      });
      stage.appendChild(keysRow);

      /* Cột phải: SYSTEM REPAIR + TERMINAL */
      const right = el("div", "rh-col right");
      const repair = el("div", "rh-side");
      repair.appendChild(el("h3", "", "// SYSTEM REPAIR"));
      const heartBox = el("div", "rh-heartbox");
      heartCanvas = document.createElement("canvas");
      heartBox.appendChild(heartCanvas);
      repair.appendChild(heartBox);
      const progRow = el("div", "rh-progress-row");
      progRow.appendChild(el("span", "", "REPAIR PROGRESS"));
      const prog = el("div", "rh-progress");
      progressFill = el("i");
      prog.appendChild(progressFill);
      progRow.appendChild(prog);
      progressPct = el("span", "rh-progress-pct", "0%");
      progRow.appendChild(progressPct);
      repair.appendChild(progRow);
      right.appendChild(repair);

      const term = el("div", "rh-side rh-term");
      term.appendChild(el("h3", "", "// TERMINAL"));
      termLines = el("div", "lines");
      termLines.appendChild(el("span", "cursor", "_ Working..."));
      term.appendChild(termLines);
      right.appendChild(term);

      layout.append(left, stage, right);
      frame.playfield.appendChild(layout);

      renderer = createHighwayRenderer(canvas, cbox);
      const ro = new ResizeObserver(() => renderer.fit());
      ro.observe(cbox);
      this._ro = ro;

      // chạm trực tiếp lên highway (4 vùng lane)
      canvas.addEventListener(
        "pointerdown",
        (e) => {
          e.preventDefault();
          hitLane(renderer.laneFromClientX(e.clientX));
        },
        { signal: ctx.signal }
      );
      window.addEventListener(
        "pointerup",
        () => {
          for (let i = 0; i < 4; i++) releaseLane(i);
        },
        { signal: ctx.signal }
      );

      keys = createKeyboard({ signal: ctx.signal });
      for (const [code, lane] of Object.entries(KEY_LANES)) {
        keys.on([code], () => hitLane(lane)); // repeat=false mặc định — key repeat không tạo hit
      }
      window.addEventListener(
        "keyup",
        (e) => {
          if (KEY_LANES[e.code] !== undefined) releaseLane(KEY_LANES[e.code]);
        },
        { signal: ctx.signal }
      );
      keys.on(["KeyP"], () => togglePause());

      song = buildSong({ test: TEST });
      judge = createJudge(song.notes, SONG);
      paintHeart(heartCanvas, 0);

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

    resize() {
      renderer?.fit();
    },

    destroy() {
      loop?.stop();
      keys?.destroy();
      music?.stop(); // disconnect bus + resume ctx nếu đang suspend
      this._ro?.disconnect();
      frame?.destroy();
      frame = null;
      renderer = null;
      judge = null;
      song = null;
      if (typeof window !== "undefined") delete window.__RH_STATE__;
    },
  };
}
