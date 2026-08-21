/**
 * Pixel Golf 404 — mini golf 9 hố (expansion 11–15).
 *
 * Theo ảnh reference: topbar tiêu đề + 4 nút hệ thống có nhãn; cột
 * panel nổi trái (HỐ / GẬY / PAR / ĐIỂM / GIÓ), hướng dẫn "KÉO ĐỂ NGẮM
 * / THẢ ĐỂ ĐÁNH" góc trái dưới, thanh SỨC MẠNH gradient giữa đáy.
 * Kéo ngược hướng muốn đánh (độ dài = lực, thả để đánh); bàn phím:
 * ←/→ chỉnh góc, giữ SPACE tụ lực. Physics fixed timestep trong
 * engine.js (tường/cát/bumper/cổng trượt/portal/gió/out-of-bounds).
 * Tiến trình từng hố lưu storage; điểm gửi onGameOver khi xong 9 hố.
 */

import { createExpansionFrame } from "../_shared/frame.js";
import { createKeyboard } from "../../core/input-manager.js";
import { createLoop } from "../../core/loop.js";
import { el, formatNumber } from "../../core/utils.js";
import { createHole, stepHole, shoot, drainEvents, scoreName, holePoints, MAX_SHOT } from "./engine.js";
import { COURSES } from "./courses.js";
import { createGolfRenderer, paintGolfIcon } from "./render.js";
import { PG_CSS } from "./styles.js";

const PROGRESS_KEY = "pg-progress";
const STEP = 1 / 120;
const SEGS = 26;

export function createGame() {
  let ctx = null;
  let frame = null;
  let renderer = null;
  let keys = null;
  let loop = null;
  let ro = null;
  let canvas = null;
  let stage = null;

  const TEST = typeof window !== "undefined" && window.__ARCADE_EXP11_TEST__;

  let mode = "intro"; // intro | play | paused | holedone | finished
  let holeIdx = 0;
  let hs = null; // hole state engine
  let def = null;
  let strokesArr = [];
  let points = 0;
  let acc = 0;
  let time = 0;
  let stateT = 0;
  let wallSfxT = 0;
  let nextHoleT = 0;

  // ngắm
  const aim = { active: false, sx: 0, sy: 0, angle: 0, power: 0 };
  const kb = { charging: false, t: 0, angle: 0 };
  const ui = { aim: null, trail: [] };
  const hud = { hole: null, strokes: null, par: null, score: null, wind: null, windDir: null, segs: [], marker: null };

  /* ---------------- Tiến trình ---------------- */

  function readProgress() {
    const p = ctx.storage.getPref(PROGRESS_KEY, null);
    if (
      p &&
      typeof p === "object" &&
      p.v === 1 &&
      Number.isInteger(p.hole) &&
      p.hole >= 0 &&
      p.hole < COURSES.length &&
      Array.isArray(p.strokes)
    ) {
      return { hole: p.hole, strokes: p.strokes.slice(0, p.hole), points: Number.isFinite(p.points) ? p.points : 0 };
    }
    return { hole: 0, strokes: [], points: 0 };
  }

  function saveProgress(holeNext) {
    ctx.storage.setPref(PROGRESS_KEY, { v: 1, hole: holeNext, strokes: strokesArr.slice(), points });
  }

  /* ---------------- HUD ---------------- */

  function relToPar() {
    let rel = 0;
    for (let i = 0; i < strokesArr.length; i++) rel += strokesArr[i] - COURSES[i].par;
    if (hs) rel += Math.max(0, hs.strokes - def.par);
    return rel;
  }

  function updateHud() {
    hud.hole.innerHTML = "";
    hud.hole.append(String(holeIdx + 1).padStart(2, "0"));
    const small = el("small", "", `/${String(COURSES.length).padStart(2, "0")}`);
    hud.hole.appendChild(small);
    hud.strokes.textContent = String(hs ? hs.strokes : 0).padStart(2, "0");
    hud.par.textContent = String(def.par).padStart(2, "0");
    const rel = relToPar();
    hud.score.textContent = rel > 0 ? `+${rel}` : String(rel);
    if (def.wind) {
      const mag = (Math.hypot(def.wind.x, def.wind.y) / 34).toFixed(1);
      const dir =
        Math.abs(def.wind.x) > Math.abs(def.wind.y) ? (def.wind.x > 0 ? "→" : "←") : def.wind.y > 0 ? "↓" : "↑";
      hud.wind.textContent = mag;
      hud.windDir.textContent = dir;
    } else {
      hud.wind.textContent = "0.0";
      hud.windDir.textContent = "·";
    }
  }

  function setPower(p) {
    const on = Math.round(p * SEGS);
    hud.segs.forEach((seg, i) => seg.classList.toggle("on", i < on));
    hud.marker.style.left = `${(p * 100).toFixed(1)}%`;
  }

  /* ---------------- Vòng đời hố ---------------- */

  function beginHole(idx, { fresh = false } = {}) {
    holeIdx = idx;
    def = COURSES[idx];
    hs = createHole(def);
    if (fresh) {
      strokesArr = strokesArr.slice(0, idx);
    }
    ui.trail.length = 0;
    ui.aim = null;
    aim.active = false;
    kb.charging = false;
    kb.angle = Math.atan2(def.hole.y - def.tee.y, def.hole.x - def.tee.x);
    nextHoleT = 0;
    saveProgress(idx);
    mode = "play";
    frame.clearScreen();
    frame.setPaused(false);
    ctx.onMatchStart();
    frame.banner(`HỐ ${String(idx + 1).padStart(2, "0")} — ${def.name} (PAR ${def.par})`);
    ctx.audio.play("start");
    renderer.fit();
    updateHud();
    setPower(0);
    loop.start();
  }

  function finishCampaign() {
    mode = "finished";
    const totalStrokes = strokesArr.reduce((a, b) => a + b, 0);
    const totalPar = COURSES.reduce((a, c) => a + c.par, 0);
    const rel = totalStrokes - totalPar;
    const holeInOnes = strokesArr.filter((s) => s === 1).length;
    saveProgress(0);
    ctx.storage.setPref(PROGRESS_KEY, { v: 1, hole: 0, strokes: [], points: 0 });
    const saved = ctx.onGameOver(points, { strokes: totalStrokes, rel });
    frame.overScreen({
      kicker: "// KẾT THÚC VÒNG GOLF",
      heading: "HOÀN THÀNH 9 HỐ!",
      score: points,
      saved,
      statCards: [
        { label: "TỔNG GẬY", value: totalStrokes, color: "cyan" },
        { label: "SO VỚI PAR", value: rel > 0 ? `+${rel}` : String(rel), color: rel <= 0 ? "lime" : "red" },
        { label: "HOLE-IN-ONE", value: holeInOnes, color: "gold" },
        { label: "PAR SÂN", value: totalPar, color: "violet" },
      ],
      restartLabel: "CHƠI LẠI TỪ ĐẦU",
      onRestart: () => {
        strokesArr = [];
        points = 0;
        beginHole(0);
      },
      scoreLabel: "ĐIỂM",
    });
  }

  function onSink(strokes) {
    strokesArr[holeIdx] = strokes;
    const gained = holePoints(strokes, def.par);
    points += gained;
    ctx.audio.play("pg_sink");
    frame.banner(scoreName(strokes, def.par));
    updateHud();
    if (holeIdx === COURSES.length - 1) {
      nextHoleT = 1.6;
    } else {
      saveProgress(holeIdx + 1);
      nextHoleT = 1.6;
    }
    mode = "holedone";
  }

  /* ---------------- Pause ---------------- */

  function pauseGame() {
    if (mode !== "play" && mode !== "holedone") return;
    mode = "paused";
    loop.stop();
    frame.setPaused(true);
    frame.pauseMenu({
      onResume: () => resumeGame(),
      onRestart: () => beginHole(holeIdx, { fresh: true }),
      restartLabel: "CHƠI LẠI HỐ",
      buildExtra: (box) => {
        const row = el("div", "exp-setrow");
        row.appendChild(el("span", "", "TIẾN TRÌNH"));
        const rel = relToPar();
        row.appendChild(
          el("span", "val", `HỐ ${holeIdx + 1}/9 · ${rel > 0 ? "+" : ""}${rel} PAR · ${formatNumber(points)} ĐIỂM`)
        );
        box.appendChild(row);
      },
    });
  }

  function resumeGame() {
    if (mode !== "paused") return;
    mode = hs.sunk ? "holedone" : "play";
    frame.clearScreen();
    frame.setPaused(false);
    keys.clearDown();
    aim.active = false;
    kb.charging = false;
    loop.start();
  }

  function togglePause() {
    if (mode === "play" || mode === "holedone") pauseGame();
    else if (mode === "paused") resumeGame();
  }

  /* ---------------- Intro ---------------- */

  function showIntro() {
    mode = "intro";
    loop.stop();
    const progress = readProgress();
    const extra = [];
    if (progress.hole > 0) {
      extra.push([
        "Chơi từ đầu",
        "i-restart",
        "gold",
        () => {
          strokesArr = [];
          points = 0;
          beginHole(0);
        },
      ]);
    }
    frame.intro({
      kicker: "// GIẢI GOLF PIXEL",
      heading: [["PIXEL GOLF ", ""], ["404", "pink"]],
      goal:
        "Đưa bóng vào lỗ của 9 hố với số gậy thấp nhất. Kéo ngược hướng muốn đánh — kéo càng dài lực càng mạnh. Coi chừng hố cát, cổng laser trượt, trụ bật và GIÓ; cổng không gian sẽ dịch chuyển bóng!",
      rows: [
        { keys: ["Kéo"], text: "ngắm (kéo ngược hướng đánh) — thả để đánh" },
        { keys: ["← →"], text: "chỉnh góc bằng phím" },
        { keys: ["SPACE"], text: "giữ để tụ lực, thả để đánh" },
        { keys: ["ESC"], text: "tạm dừng" },
      ],
      startLabel: progress.hole > 0 ? `TIẾP TỤC — HỐ ${String(progress.hole + 1).padStart(2, "0")}` : "BẮT ĐẦU",
      onStart: () => {
        const p = readProgress();
        strokesArr = p.strokes.slice();
        points = p.points;
        beginHole(p.hole);
      },
      extra,
    });
    const p = readProgress();
    holeIdx = p.hole;
    def = COURSES[holeIdx];
    hs = createHole(def);
    renderer.fit();
    renderer.draw(def, hs, ui, 0);
    updateHud();
  }

  /* ---------------- Sự kiện engine ---------------- */

  function handleEvents(events) {
    for (const ev of events) {
      switch (ev.type) {
        case "hit":
          ctx.audio.play("pg_hit");
          break;
        case "wall":
        case "gate":
          if (time - wallSfxT > 0.09) {
            wallSfxT = time;
            ctx.audio.play("pg_wall");
          }
          break;
        case "sand":
          ctx.audio.play("pg_sand");
          break;
        case "bumper":
          ctx.audio.play("pg_bumper");
          break;
        case "portal":
          ctx.audio.play("portal");
          break;
        case "oob":
          ctx.audio.play("pg_oob");
          frame.toast("RA NGOÀI SÂN! +1 GẬY PHẠT");
          updateHud();
          break;
        case "rest":
          updateHud();
          if (ev.sand) frame.toast("KẸT TRONG CÁT — ĐÁNH MẠNH HƠN!");
          break;
        case "sink":
          onSink(ev.strokes);
          return;
        default:
          break;
      }
    }
  }

  /* ---------------- Vòng lặp ---------------- */

  function update(dt) {
    time += dt;

    if (mode === "play" || mode === "holedone") {
      acc = Math.min(acc + dt, 0.1);
      while (acc >= STEP) {
        acc -= STEP;
        stepHole(hs, STEP);
      }
      handleEvents(drainEvents(hs));

      if (hs.moving) {
        ui.trail.push({ x: hs.ball.x, y: hs.ball.y });
        if (ui.trail.length > 20) ui.trail.shift();
      } else if (ui.trail.length) {
        ui.trail.shift();
      }

      // chỉnh góc bằng ←/→ (fallback bàn phím)
      if (mode === "play" && !hs.moving && !hs.sunk && !aim.active) {
        const left = keys.isDown("ArrowLeft") || keys.isDown("KeyA");
        const right = keys.isDown("ArrowRight") || keys.isDown("KeyD");
        if (left || right) {
          kb.angle += ((right ? 1 : 0) - (left ? 1 : 0)) * 2.4 * dt;
          if (!kb.charging) ui.aim = { angle: kb.angle, power: 0.3 };
        }
      }

      // tụ lực bằng phím Space (ping-pong 0→1→0)
      if (kb.charging && mode === "play" && !hs.moving) {
        kb.t += dt * 1.15;
        const ping = kb.t % 2;
        const p = ping < 1 ? ping : 2 - ping;
        ui.aim = { angle: kb.angle, power: p };
        setPower(p);
      }

      if (mode === "holedone") {
        nextHoleT -= dt;
        if (nextHoleT <= 0) {
          if (holeIdx === COURSES.length - 1) {
            finishCampaign();
          } else {
            beginHole(holeIdx + 1);
          }
          return;
        }
      }
    }

    renderer.draw(def, hs, ui, time);

    if (TEST) {
      stateT += dt;
      if (stateT > 0.35) {
        stateT = 0;
        window.__PG_STATE__ = {
          mode,
          hole: holeIdx + 1,
          strokes: hs ? hs.strokes : 0,
          par: def ? def.par : 0,
          moving: hs ? hs.moving : false,
          sunk: hs ? hs.sunk : false,
          x: hs ? Math.round(hs.ball.x) : 0,
          y: hs ? Math.round(hs.ball.y) : 0,
          points,
          rel: relToPar(),
        };
      }
    }
  }

  /* ---------------- Interface ---------------- */

  return {
    async mount(container, context) {
      ctx = context;

      const rootNode = container.getRootNode();
      if (rootNode instanceof ShadowRoot && !rootNode.querySelector("#pg-style")) {
        const style = document.createElement("style");
        style.id = "pg-style";
        style.textContent = PG_CSS;
        rootNode.appendChild(style);
      }

      frame = createExpansionFrame(container, ctx, {
        accent: "violet",
        title: [["PIXEL GOLF ", ""], ["404", "pink"]],
        stats: [],
        onPauseToggle: togglePause,
      });

      stage = el("div", "pg-stage");
      canvas = document.createElement("canvas");
      canvas.setAttribute("aria-label", "Sân golf Pixel Golf");
      stage.appendChild(canvas);
      frame.playfield.appendChild(stage);

      /* cột panel trái */
      const panels = el("div", "pg-panels");
      const mkPanel = (icon, label, tone) => {
        const p = el("div", "pg-panel");
        p.dataset.tone = tone;
        const cv = document.createElement("canvas");
        paintGolfIcon(cv, icon);
        p.appendChild(cv);
        const txt = el("div", "txt");
        txt.appendChild(el("div", "lbl", label));
        const val = el("div", "val", "—");
        txt.appendChild(val);
        p.appendChild(txt);
        panels.appendChild(p);
        return val;
      };
      hud.hole = mkPanel("flag", "HỐ", "cyan");
      hud.strokes = mkPanel("club", "GẬY", "green");
      hud.par = mkPanel("par", "PAR", "violet");
      hud.score = mkPanel("star", "ĐIỂM", "pink");
      hud.wind = mkPanel("wind", "GIÓ", "cyan");
      hud.windDir = el("span", "pg-wind-dir", "·");
      hud.wind.appendChild(hud.windDir);
      frame.playfield.appendChild(panels);

      /* hướng dẫn góc trái dưới */
      const help = el("div", "pg-help");
      const handSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      handSvg.setAttribute("viewBox", "0 0 24 24");
      const handPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      handPath.setAttribute(
        "d",
        "M9 11V4.5a1.5 1.5 0 0 1 3 0V10h1V6.5a1.5 1.5 0 0 1 3 0V11h1V8.5a1.5 1.5 0 0 1 3 0V14c0 4-2.5 7-6.5 7S7 18 6 15.5L4.2 11a1.4 1.4 0 0 1 2.5-1.2L8 12h1z"
      );
      handPath.setAttribute("fill", "none");
      handPath.setAttribute("stroke", "currentColor");
      handPath.setAttribute("stroke-width", "1.6");
      handSvg.appendChild(handPath);
      help.appendChild(handSvg);
      help.appendChild(el("div", "txt", "KÉO ĐỂ NGẮM\nTHẢ ĐỂ ĐÁNH"));
      help.querySelector(".txt").style.whiteSpace = "pre";
      frame.playfield.appendChild(help);

      /* thanh sức mạnh */
      const power = el("div", "pg-power");
      power.appendChild(el("div", "lbl", "SỨC MẠNH"));
      const bar = el("div", "bar");
      const segsBox = el("div", "segs");
      for (let i = 0; i < SEGS; i++) {
        const seg = el("i");
        const k = i / (SEGS - 1);
        const hue = 130 - k * 130; // xanh lá → đỏ
        seg.style.setProperty("--seg", `hsl(${hue} 95% 55%)`);
        segsBox.appendChild(seg);
        hud.segs.push(seg);
      }
      bar.appendChild(segsBox);
      hud.marker = el("div", "marker");
      bar.appendChild(hud.marker);
      power.appendChild(bar);
      frame.playfield.appendChild(power);

      renderer = createGolfRenderer(canvas, stage);
      ro = new ResizeObserver(() => {
        renderer.fit();
        if (mode !== "play" && def) renderer.draw(def, hs, ui, time);
      });
      ro.observe(stage);

      /* ngắm bằng pointer: kéo ngược hướng đánh */
      canvas.addEventListener(
        "pointerdown",
        (e) => {
          if (mode !== "play" || hs.moving || hs.sunk) return;
          e.preventDefault();
          try {
            canvas.setPointerCapture?.(e.pointerId);
          } catch {
            /* PointerEvent tổng hợp (QA) không có pointer thật */
          }
          const w = renderer.toWorld(e.clientX, e.clientY);
          aim.active = true;
          aim.sx = w.x;
          aim.sy = w.y;
          aim.power = 0;
        },
        { signal: ctx.signal }
      );
      canvas.addEventListener(
        "pointermove",
        (e) => {
          if (!aim.active) return;
          const w = renderer.toWorld(e.clientX, e.clientY);
          const dx = aim.sx - w.x;
          const dy = aim.sy - w.y;
          const d = Math.hypot(dx, dy);
          aim.power = Math.min(1, d / 230);
          aim.angle = Math.atan2(dy, dx);
          if (d > 8) {
            ui.aim = { angle: aim.angle, power: aim.power };
            setPower(aim.power);
          }
        },
        { signal: ctx.signal }
      );
      const endAim = (e) => {
        if (!aim.active) return;
        aim.active = false;
        const a = ui.aim;
        ui.aim = null;
        setPower(0);
        if (mode !== "play" || !a || a.power < 0.06) return;
        if (shoot(hs, a.angle, a.power)) {
          kb.angle = a.angle;
          updateHud();
        }
      };
      canvas.addEventListener("pointerup", endAim, { signal: ctx.signal });
      canvas.addEventListener("pointercancel", () => {
        aim.active = false;
        ui.aim = null;
        setPower(0);
      }, { signal: ctx.signal });

      /* bàn phím */
      keys = createKeyboard({ signal: ctx.signal });
      keys.on(["Space"], () => {
        if (mode !== "play" || hs.moving || hs.sunk || aim.active) return;
        if (!kb.charging) {
          kb.charging = true;
          kb.t = 0;
        }
      });
      window.addEventListener(
        "keyup",
        (e) => {
          if (e.code !== "Space" || !kb.charging) return;
          kb.charging = false;
          const a = ui.aim;
          ui.aim = null;
          setPower(0);
          if (mode === "play" && a && a.power > 0.05 && shoot(hs, a.angle, a.power)) updateHud();
        },
        { signal: ctx.signal }
      );
      keys.on(["KeyP"], () => togglePause());

      loop = createLoop(update);

      if (TEST) {
        window.__PG_TEST__ = {
          shoot: (deg, power) => {
            if (mode !== "play") return false;
            const ok = shoot(hs, (deg * Math.PI) / 180, power);
            if (ok) updateHud();
            return ok;
          },
          place: (x, y) => {
            if (!hs || hs.moving) return false;
            hs.ball.x = x;
            hs.ball.y = y;
            hs.rest = { x, y };
            return true;
          },
          hole: () => (def ? { x: def.hole.x, y: def.hole.y } : null),
          ballPos: () => (hs ? { x: hs.ball.x, y: hs.ball.y } : null),
          clientOf: (x, y) => renderer.toClient(x, y),
          maxShot: MAX_SHOT,
        };
      }

      showIntro();
    },

    start() {
      if (mode !== "intro") return;
      const p = readProgress();
      strokesArr = p.strokes.slice();
      points = p.points;
      beginHole(p.hole);
    },

    pause() {
      pauseGame();
    },

    resume() {
      resumeGame();
    },

    restart() {
      if (mode === "intro") return;
      beginHole(holeIdx, { fresh: true });
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
      hs = null;
      def = null;
      if (typeof window !== "undefined") {
        delete window.__PG_STATE__;
        delete window.__PG_TEST__;
      }
    },
  };
}
