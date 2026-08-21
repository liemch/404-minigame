/**
 * Neon Drift 404 — đua xe drift top-down (game 7).
 *
 * Theo plan + ảnh reference: HUD ĐIỂM / KỶ LỤC / NITRO % / COMBO ×N /
 * CHECKPOINT 03/08 + cụm nút hệ thống; minimap góc trái trên; vòng đua
 * neon khép kín với 8 checkpoint ĐÚNG THỨ TỰ; drift (Space) ăn combo;
 * nitro (Shift) có thanh %; pickup năng lượng +100đ; 4 xe cản chạy theo
 * path; va chạm giảm tốc + reset combo; kết thúc khi qua vạch đích hoặc
 * hết giờ (75s), thưởng thời gian dư. Physics fixed-timestep 1/120s.
 * Mobile: nút ◀ ▶ + NITRO tròn, xe tự ga.
 */

import { createExpansionFrame } from "../_shared/frame.js";
import { createKeyboard } from "../../core/input-manager.js";
import { createLoop } from "../../core/loop.js";
import { el, formatScore, formatNumber, formatTime } from "../../core/utils.js";
import { buildTrack } from "./track.js";
import { createCar, createTraffic, stepCar, stepTraffic, STEP } from "./physics.js";
import { createDriftRenderer, createMinimap } from "./render.js";
import { ND_CSS } from "./styles.js";

const RACE_TIME = 75;

export function createGame() {
  let ctx = null;
  let frame = null;
  let renderer = null;
  let minimap = null;
  let keys = null;
  let loop = null;
  let ro = null;
  let canvas = null;
  let mmCanvas = null;
  let nitroBtn = null;

  const TEST = typeof window !== "undefined" && window.__ARCADE_EXP5_TEST__;

  let track = null;
  let car = null;
  let traffic = [];
  let mode = "intro"; // intro | countdown | race | paused | over
  let pausedFrom = "race";
  let time = 0;
  let acc = 0;
  let countdownT = 0;
  let raceTime = RACE_TIME;
  let score = 0;
  let best = 0;
  let combo = 1;
  let maxCombo = 1;
  let comboProgress = 0;
  let nextCp = 1;
  let pickupsTaken = 0;
  let crashes = 0;
  let shake = 0;
  let scrapeSfxT = 0;
  let trailT = 0;
  let stateT = 0;

  const cam = { x: 0, y: 0 };
  const trails = [];
  const sparks = [];
  const touch = { steer: 0, nitro: false, active: false, steerHeldT: 0 };

  /* ---------------- HUD ---------------- */

  function updateHud() {
    frame.setStat("score", formatScore(score));
    frame.setStat("best", formatScore(Math.max(best, score)));
    frame.setStat("nitro", `${Math.round(car.nitro)}%`);
    frame.setStatBar("nitro", car.nitro);
    frame.setStat("combo", `×${combo}`);
    frame.setStat("cp", `${String(Math.min(nextCp - 1, 8)).padStart(2, "0")}/08`);
    if (nitroBtn) {
      if (car.nitro <= 0.5) nitroBtn.dataset.empty = "1";
      else delete nitroBtn.dataset.empty;
    }
  }

  /* ---------------- Vòng đời trận ---------------- */

  function resetRace() {
    car = createCar(track);
    traffic = createTraffic(track, 4);
    for (const p of track.pickups) p.taken = false;
    trails.length = 0;
    sparks.length = 0;
    raceTime = TEST ? 18 : RACE_TIME;
    score = 0;
    combo = 1;
    maxCombo = 1;
    comboProgress = 0;
    nextCp = 1;
    pickupsTaken = 0;
    crashes = 0;
    shake = 0;
    best = ctx.getBest();
    cam.x = car.x;
    cam.y = car.y;
  }

  function startRace() {
    resetRace();
    mode = "countdown";
    countdownT = TEST ? 0.4 : 3.2;
    frame.clearScreen();
    frame.setPaused(false);
    ctx.onMatchStart();
    ctx.audio.play("start");
    loop.start();
    updateHud();
  }

  function finishRace(completed) {
    if (mode === "over") return;
    mode = "over";
    const bonus = completed ? Math.ceil(Math.max(0, raceTime)) * 100 : 0;
    score += bonus;
    updateHud();
    const saved = ctx.onGameOver(score, { checkpoints: nextCp - 1, maxCombo, crashes });
    frame.setPaused(false);
    frame.overScreen({
      kicker: completed ? "// VỀ ĐÍCH" : "// HẾT GIỜ",
      heading: completed ? "HOÀN THÀNH VÒNG ĐUA!" : "HẾT GIỜ!",
      score,
      saved,
      statCards: [
        { label: "CHECKPOINT", value: `${nextCp - 1}/8`, color: "lime" },
        { label: "COMBO CAO NHẤT", value: `×${maxCombo}`, color: "pink" },
        { label: "NĂNG LƯỢNG", value: pickupsTaken, color: "cyan" },
        completed
          ? { label: "THƯỞNG THỜI GIAN", value: `+${formatNumber(bonus)}`, color: "gold" }
          : { label: "VA CHẠM", value: crashes, color: "red" },
      ],
      restartLabel: "ĐUA LẠI",
      onRestart: () => startRace(),
    });
    ctx.audio.play(completed ? "win" : "over");
  }

  /* ---------------- Pause ---------------- */

  function pauseGame() {
    if (mode !== "race" && mode !== "countdown") return;
    pausedFrom = mode;
    mode = "paused";
    loop.stop();
    frame.setPaused(true);
    frame.pauseMenu({
      onResume: () => resumeGame(),
      onRestart: () => startRace(),
      restartLabel: "ĐUA LẠI",
      buildExtra: (box) => {
        const row = el("div", "exp-setrow");
        row.appendChild(el("span", "", "TIẾN ĐỘ"));
        row.appendChild(el("span", "val", `CP ${nextCp - 1}/8 · ${formatTime(raceTime)} còn lại`));
        box.appendChild(row);
      },
    });
  }

  function resumeGame() {
    if (mode !== "paused") return;
    mode = pausedFrom;
    frame.clearScreen();
    frame.setPaused(false);
    keys.clearDown();
    touch.steer = 0;
    touch.nitro = false;
    loop.start();
  }

  function togglePause() {
    if (mode === "race" || mode === "countdown") pauseGame();
    else if (mode === "paused") resumeGame();
  }

  /* ---------------- Gameplay ---------------- */

  function gatherInputs() {
    const left = keys.isDown("ArrowLeft") || keys.isDown("KeyA");
    const right = keys.isDown("ArrowRight") || keys.isDown("KeyD");
    const up = keys.isDown("ArrowUp") || keys.isDown("KeyW");
    const down = keys.isDown("ArrowDown") || keys.isDown("KeyS");
    const drift = keys.isDown("Space");
    const nitro = keys.isDown("ShiftLeft") || keys.isDown("ShiftRight");

    let steer = (right ? 1 : 0) - (left ? 1 : 0) + touch.steer;
    steer = Math.max(-1, Math.min(1, steer));
    let throttle = (up ? 1 : 0) - (down ? 1 : 0);
    if (touch.active) throttle = Math.max(throttle, 1); // mobile tự ga
    // mobile: giữ lái lâu ở tốc độ cao → auto drift nhẹ
    const autoDrift = touch.active && Math.abs(touch.steer) > 0 && touch.steerHeldT > 0.4 && car.speed > 230;
    return { steer, throttle, drift: drift || autoDrift, nitro: nitro || touch.nitro };
  }

  function onCheckpoint(order) {
    score += 500;
    ctx.audio.play("checkpoint");
    if (order === 8) {
      frame.banner("FINISH!");
      finishRace(true);
    } else {
      frame.banner(`CHECKPOINT ${String(order).padStart(2, "0")}/08`);
    }
  }

  function simulate() {
    const inputs = gatherInputs();
    const ev = stepCar(car, track, inputs, null);

    // tiến độ checkpoint (đúng thứ tự, threshold theo mẫu tích lũy)
    while (nextCp <= 8) {
      const cp = track.checkpoints[nextCp - 1];
      const thresh = cp.order === 8 ? track.count : cp.si;
      if (car.trackPos >= thresh - 2) {
        nextCp += 1;
        onCheckpoint(cp.order);
        if (mode !== "race") return;
      } else break;
    }

    // pickup năng lượng
    for (const p of track.pickups) {
      if (p.taken) continue;
      const dx = car.x - p.x;
      const dy = car.y - p.y;
      if (dx * dx + dy * dy < 27 * 27) {
        p.taken = true;
        pickupsTaken += 1;
        score += 100;
        car.nitro = Math.min(100, car.nitro + 30);
        ctx.audio.play("pickup");
      }
    }

    // drift → điểm + combo tăng dần
    if (car.drifting) {
      score += 130 * combo * STEP;
      comboProgress += STEP;
      if (comboProgress > 1.1) {
        comboProgress = 0;
        if (combo < 9) {
          combo += 1;
          maxCombo = Math.max(maxCombo, combo);
          ctx.audio.play("combo");
        }
      }
    }

    // va chạm
    const hitTraffic = stepTraffic(traffic, track, car);
    if (hitTraffic || ev.hardWall) {
      crashes += 1;
      combo = 1;
      comboProgress = 0;
      shake = 9;
      ctx.audio.play("crash");
    } else if (ev.wallScrape) {
      if (time - scrapeSfxT > 0.5) {
        scrapeSfxT = time;
        ctx.audio.play("squash");
      }
      if (sparks.length < 40) {
        sparks.push({ x: car.x, y: car.y, life: 0.5 });
      }
    }
  }

  function update(dt) {
    time += dt;

    if (mode === "countdown") {
      countdownT -= dt;
      const n = Math.ceil(countdownT);
      if (countdownT <= 0) {
        mode = "race";
        frame.banner("GO!");
        ctx.audio.play("wave");
      } else if (n <= 3 && Math.ceil(countdownT + dt) !== n) {
        frame.banner(String(n));
        ctx.audio.play("ui");
      }
    }

    if (mode === "race") {
      raceTime -= dt;
      if (raceTime <= 0) {
        raceTime = 0;
        finishRace(false);
      } else {
        acc = Math.min(acc + dt, 0.12);
        while (acc >= STEP && mode === "race") {
          acc -= STEP;
          simulate();
        }
      }
      if (touch.steer !== 0) touch.steerHeldT += dt;
      else touch.steerHeldT = 0;
    }

    // vệt drift / nitro
    if ((mode === "race" || mode === "countdown") && (car.drifting || car.nitroActive) && car.speed > 120) {
      trailT += dt;
      if (trailT > 0.012) {
        trailT = 0;
        const back = 15;
        const bx = car.x - Math.cos(car.heading) * back;
        const by = car.y - Math.sin(car.heading) * back;
        const px = -Math.sin(car.heading) * 7;
        const py = Math.cos(car.heading) * 7;
        const last = trails[trails.length - 1];
        const nitroCol = car.nitroActive && !car.drifting;
        if (last && last.fresh) {
          trails.push({ x0: last.x1, y0: last.y1, x1: bx + px, y1: by + py, life: 1, nitro: nitroCol, fresh: true });
          trails.push({ x0: last.x1b, y0: last.y1b, x1: bx - px, y1: by - py, life: 1, nitro: nitroCol, fresh: true, b: true });
        }
        trails.push({ x0: bx + px, y0: by + py, x1: bx + px, y1: by + py, x1b: bx - px, y1b: by - py, life: 1, nitro: nitroCol, fresh: true });
        if (trails.length > 360) trails.splice(0, trails.length - 360);
      }
    }
    for (const tr of trails) tr.life -= dt * 0.6;
    for (const s of sparks) s.life -= dt * 1.8;
    while (sparks.length && sparks[0].life <= 0) sparks.shift();
    while (trails.length && trails[0].life <= 0) trails.shift();

    shake = Math.max(0, shake - dt * 26);

    // camera bám xe + nhìn trước theo vận tốc
    const lead = 0.32;
    cam.x += (car.x + car.vx * lead - cam.x) * Math.min(1, dt * 4.2);
    cam.y += (car.y + car.vy * lead - cam.y) * Math.min(1, dt * 4.2);

    if (mode === "race" || mode === "countdown") {
      frame.setStat("time", formatTime(raceTime));
      updateHud();
    }

    renderer.draw({ car, cam, traffic, trails, sparks, nextCp, shake }, time);
    minimap.draw(car, traffic, nextCp, time);

    if (TEST) {
      stateT += dt;
      if (stateT > 0.4) {
        stateT = 0;
        window.__ND_STATE__ = {
          mode,
          score: Math.floor(score),
          nextCp,
          speed: Math.round(car.speed),
          nitro: Math.round(car.nitro),
          time: Math.round(raceTime),
          trackPos: Math.round(car.trackPos),
        };
      }
    }
  }

  /* ---------------- Intro ---------------- */

  function showIntro() {
    mode = "intro";
    loop.stop();
    frame.intro({
      kicker: "// GIẢI ĐUA NEON",
      heading: [["NEON ", "cyan"], ["DRIFT ", "pink"], ["404", "lime"]],
      goal:
        "Hoàn thành vòng đua qua 8 CHECKPOINT đúng thứ tự trước khi hết 75 giây. Drift để dồn combo điểm, nhặt lục giác năng lượng để nạp NITRO. Va chạm sẽ reset combo!",
      rows: [
        { keys: ["↑", "W"], text: "tăng tốc (mobile: tự ga)" },
        { keys: ["← →", "A D"], text: "đánh lái (mobile: nút ◀ ▶)" },
        { keys: ["SPACE"], text: "drift / phanh tay — giữ để ôm cua" },
        { keys: ["SHIFT"], text: "nitro (nút tròn trên mobile)" },
        { keys: ["ESC"], text: "tạm dừng" },
      ],
      startLabel: "VÀO ĐƯỜNG ĐUA",
      onStart: () => startRace(),
    });
    // khung nền tĩnh cho intro
    resetRace();
    renderer.fit();
    renderer.draw({ car, cam, traffic, trails, sparks, nextCp, shake: 0 }, 0);
    minimap.draw(car, traffic, 1, 0);
  }

  /* ---------------- Interface ---------------- */

  return {
    async mount(container, context) {
      ctx = context;
      track = buildTrack();

      const rootNode = container.getRootNode();
      if (rootNode instanceof ShadowRoot && !rootNode.querySelector("#nd-style")) {
        const style = document.createElement("style");
        style.id = "nd-style";
        style.textContent = ND_CSS;
        rootNode.appendChild(style);
      }

      frame = createExpansionFrame(container, ctx, {
        accent: "pink",
        title: [["NEON ", "cyan"], ["DRIFT ", "pink"], ["404", "lime"]],
        stats: [
          { id: "score", label: "ĐIỂM", color: "white", value: "000000" },
          { id: "best", label: "KỶ LỤC", color: "white", value: "000000", optional: true },
          { id: "nitro", label: "NITRO", color: "cyan", value: "55%", bar: true },
          { id: "combo", label: "COMBO", color: "pink", value: "×1" },
          { id: "cp", label: "CHECKPOINT", color: "lime", value: "00/08" },
          { id: "time", label: "THỜI GIAN", color: "gold", value: "01:15", optional: true },
        ],
        onPauseToggle: togglePause,
      });

      canvas = document.createElement("canvas");
      canvas.className = "exp-canvas";
      canvas.setAttribute("aria-label", "Đường đua Neon Drift");
      frame.playfield.appendChild(canvas);

      // minimap panel (góc trái trên như ảnh)
      const mmBox = el("div", "nd-minimap");
      mmCanvas = document.createElement("canvas");
      mmBox.appendChild(mmCanvas);
      frame.playfield.appendChild(mmBox);

      // cụm nút cảm ứng (◀ ▶ + NITRO)
      const touchBox = el("div", "nd-touch");
      const mkSteer = (dir, label) => {
        const b = el("button", "nd-steer", label);
        b.type = "button";
        b.setAttribute("aria-label", dir < 0 ? "Rẽ trái" : "Rẽ phải");
        const down = (e) => {
          e.preventDefault();
          touch.steer = dir;
          b.classList.add("held");
        };
        const up = () => {
          if (touch.steer === dir) touch.steer = 0;
          b.classList.remove("held");
        };
        b.addEventListener("pointerdown", down, { signal: ctx.signal });
        b.addEventListener("pointerup", up, { signal: ctx.signal });
        b.addEventListener("pointercancel", up, { signal: ctx.signal });
        b.addEventListener("pointerleave", up, { signal: ctx.signal });
        return b;
      };
      touchBox.appendChild(mkSteer(-1, "◀"));
      touchBox.appendChild(mkSteer(1, "▶"));
      nitroBtn = el("button", "nd-nitro");
      nitroBtn.type = "button";
      nitroBtn.setAttribute("aria-label", "Nitro");
      const bolt = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      bolt.setAttribute("viewBox", "0 0 24 24");
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", "M13 2 5 14h5l-2 8 9-13h-5l1-7z");
      path.setAttribute("fill", "currentColor");
      bolt.appendChild(path);
      nitroBtn.appendChild(bolt);
      nitroBtn.appendChild(el("span", "", "NITRO"));
      const nDown = (e) => {
        e.preventDefault();
        touch.nitro = true;
        nitroBtn.classList.add("held");
      };
      const nUp = () => {
        touch.nitro = false;
        nitroBtn.classList.remove("held");
      };
      nitroBtn.addEventListener("pointerdown", nDown, { signal: ctx.signal });
      nitroBtn.addEventListener("pointerup", nUp, { signal: ctx.signal });
      nitroBtn.addEventListener("pointercancel", nUp, { signal: ctx.signal });
      touchBox.appendChild(nitroBtn);
      frame.playfield.appendChild(touchBox);

      const coarse = window.matchMedia("(pointer: coarse)").matches;
      if (coarse) frame.root.dataset.touch = "1";
      touch.active = coarse;
      // chạm vào canvas cũng bật chế độ touch (máy lai)
      canvas.addEventListener(
        "pointerdown",
        (e) => {
          if (e.pointerType === "touch" && !touch.active) {
            touch.active = true;
            frame.root.dataset.touch = "1";
          }
        },
        { signal: ctx.signal }
      );

      renderer = createDriftRenderer(canvas, frame.playfield, track);
      minimap = createMinimap(mmCanvas, track);
      ro = new ResizeObserver(() => renderer.fit());
      ro.observe(frame.playfield);

      keys = createKeyboard({ signal: ctx.signal });
      keys.on(["KeyP"], () => togglePause());
      keys.on(["KeyR"], () => {
        if (mode === "race" || mode === "over") startRace();
      });

      loop = createLoop(update);
      showIntro();
    },

    start() {
      if (mode === "intro") startRace();
    },

    pause() {
      pauseGame();
    },

    resume() {
      resumeGame();
    },

    restart() {
      if (mode === "intro") return;
      startRace();
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
      minimap = null;
      track = null;
      if (typeof window !== "undefined") delete window.__ND_STATE__;
    },
  };
}
