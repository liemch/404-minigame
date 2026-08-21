/**
 * VOID RUNNER 404 — parkour 3D góc nhìn thứ nhất (desktop-first).
 *
 * Theo plan: chạy / sprint / nhảy (coyote + buffer) / trượt / wall-run
 * qua 8 zone (xuất phát → nhảy → wall-run → trượt → platform động →
 * laser → leap cuối → đích) trên các công trình lơ lửng giữa thành phố
 * cyber. 8 checkpoint, respawn + penalty khi rơi/chạm laser, energy
 * shard + combo, timer mm:ss.mmm + best time. HUD/start/pause/results
 * dựng đúng theo 5 ảnh reference. Renderer: engine WebGL thuần dùng
 * chung với 404 Strike (máy offline không cài được Three.js).
 */

import { createEngine } from "../strike/engine.js";
import { createWorld } from "./world.js";
import { createPlayer } from "./player.js";
import { createGloves } from "./gloves.js";
import { createVrFx } from "./fx.js";
import { createVrHud } from "./hud.js";
import { createVrScreens } from "./screens.js";
import { VOID_RUNNER_CSS } from "./styles.js";
import { createKeyboard } from "../../core/input-manager.js";
import {
  VR_COLORS, VR_MOVE, VR_ENERGY, VR_DIFFICULTY, VR_QUALITY_SCALE,
  VR_TOTAL_CHECKPOINTS, VR_SETTINGS_KEY, VR_BEST_TIME_KEY,
} from "./config.js";

export function createGame() {
  let ctx = null;
  let wrap = null;
  let canvas = null;
  let engine = null;
  let world = null;
  let player = null;
  let gloves = null;
  let fx = null;
  let hud = null;
  let screens = null;
  let keys = null;
  let ro = null;

  let destroyed = false;
  let rafId = 0;
  let lastT = 0;

  // blocked | idle | run | paused (trong run) | over
  let mode = "blocked";
  let paused = false;
  let dying = false;

  let locked = false;
  let lockHintAt = 0;

  let lookDx = 0;
  let lookDy = 0;
  let slideHeld = false;

  const TEST = typeof window !== "undefined" && window.__ARCADE_VOIDRUNNER_TEST__;

  const settings = {
    difficulty: "normal",
    quality: "auto",
    volume: 80,
    sensitivity: 1.25,
    fov: 90,
    shake: true,
    reduceMotion: false,
  };
  const motion = { reduced: false };
  let autoScale = 0.82;
  let fpsAccum = 0;
  let fpsFrames = 0;
  let fpsTimer = 0;

  // Trạng thái lượt chạy
  let runTime = 0;          // giây (gồm penalty)
  let checkpointCount = 0;  // 0..7 cổng đã qua (đích = 8)
  let energy = VR_ENERGY.start;
  let energyDelay = 0;
  let combo = 0;
  let comboIdleT = 0;
  let maxCombo = 0;
  let shardsGot = 0;
  let falls = 0;
  let maxSpeed = 0;
  let bonusScore = 0;
  let idleAngle = 0;

  /* ================= Cài đặt ================= */

  function syncMotion() {
    motion.reduced = !!(ctx.reducedMotion || settings.reduceMotion);
  }

  function loadSettings() {
    const saved = ctx.storage.getPref(VR_SETTINGS_KEY, null);
    if (saved && typeof saved === "object") Object.assign(settings, saved);
    if (ctx.config?.quality && ctx.config.quality !== "auto" && !saved?.quality) {
      settings.quality = ctx.config.quality;
    }
    ctx.audio.setVolume(settings.volume / 100);
    syncMotion();
  }

  function persistSettings() {
    ctx.storage.setPref(VR_SETTINGS_KEY, { ...settings });
  }

  function currentScale() {
    if (settings.quality === "auto") return autoScale;
    return VR_QUALITY_SCALE[settings.quality] ?? 0.82;
  }

  /** Bloom theo thang chất lượng: tắt ở low; auto tắt khi autoScale đã tụt đáy. */
  function bloomWanted() {
    if (settings.quality === "low") return false;
    if (settings.quality === "auto") return autoScale > VR_QUALITY_SCALE.low + 0.001;
    return true;
  }

  function applyQuality() {
    if (!engine || !wrap) return;
    engine.resize(wrap.clientWidth, wrap.clientHeight, currentScale());
    engine.setBloom?.(bloomWanted());
  }

  function applySettings(partial) {
    if (partial.volume !== undefined) ctx.audio.setVolume(partial.volume / 100);
    if (partial.quality !== undefined) applyQuality();
    if (partial.reduceMotion !== undefined) syncMotion();
    if (partial.difficulty !== undefined && world) {
      world.setLaserScale(VR_DIFFICULTY[settings.difficulty].laserScale);
    }
    persistSettings();
  }

  function getBestTime() {
    const v = ctx.storage.getPref(VR_BEST_TIME_KEY, 0);
    return typeof v === "number" && v > 0 ? v : 0;
  }

  /* ================= Pointer lock ================= */

  /**
   * Canvas nằm trong Shadow DOM của <arcade-404>. Theo spec Pointer Lock 2.0,
   * document.pointerLockElement bị retarget về shadow HOST (<arcade-404>)
   * chứ không phải canvas — so sánh trực tiếp với canvas luôn sai và game
   * sẽ tự pause ngay sau khi khóa chuột thành công. Phải đọc thêm
   * pointerLockElement của ShadowRoot chứa canvas.
   */
  function isLockedToCanvas() {
    if (!canvas) return false;
    if (document.pointerLockElement === canvas) return true; // không shadow DOM / môi trường mock
    const root = canvas.getRootNode();
    return root instanceof ShadowRoot && root.pointerLockElement === canvas;
  }

  function requestLock() {
    if (locked || !canvas || destroyed) return;
    const onRejected = () => {
      if (mode !== "run" || paused || destroyed) return;
      const now = performance.now();
      if (now - lockHintAt > 2500) {
        lockHintAt = now;
        hud?.toast("NHẤP VÀO MÀN HÌNH ĐỂ KHÓA CHUỘT", "cyan");
      }
    };
    try {
      const p = canvas.requestPointerLock();
      if (p && typeof p.catch === "function") p.catch(onRejected);
    } catch {
      onRejected();
    }
  }

  function exitLock() {
    if (document.pointerLockElement) {
      try {
        document.exitPointerLock();
      } catch {
        /* bỏ qua */
      }
    }
  }

  /* ================= Vòng chạy ================= */

  function resetRunState() {
    runTime = 0;
    checkpointCount = 0;
    energy = VR_ENERGY.start;
    energyDelay = 0;
    combo = 0;
    comboIdleT = 0;
    maxCombo = 0;
    shardsGot = 0;
    falls = 0;
    maxSpeed = 0;
    bonusScore = 0;
    dying = false;
  }

  function startRun() {
    if (!engine) return;
    mode = "run";
    paused = false;
    slideHeld = false;
    resetRunState();

    world.resetRun();
    world.setLaserScale(VR_DIFFICULTY[settings.difficulty].laserScale);
    world.setMarker(null);
    world.setBackdrop(false); // hoàng hôn chỉ dành cho start screen
    for (const tn of world.course.tunnels) tn.passed = false;
    player.reset(world.course.spawn);
    engine.setFog(30, 106);

    screens.hideAll();
    hud.show(true);
    hud.dim(false);
    hud.setTime(0);
    hud.setCheckpoint(0, VR_TOTAL_CHECKPOINTS);
    hud.setSpeed(0);
    hud.setEnergy(100);
    hud.setCombo(0);
    hud.syncSound();

    requestLock();
    ctx.onMatchStart?.();
  }

  function pauseRun() {
    if (mode !== "run" || paused) return;
    paused = true;
    slideHeld = false;
    exitLock();
    hud.dim(true);
    screens.showPause();
  }

  function resumeRun() {
    if (mode !== "run" || !paused) return;
    paused = false;
    keys.clearDown();
    screens.hideAll();
    hud.dim(false);
    requestLock();
  }

  /** Respawn tại checkpoint gần nhất. penalty=true khi rơi/chạm laser. */
  function respawn(penalty) {
    if (dying) return;
    dying = true;
    if (penalty) {
      falls += 1;
      combo = 0;
      hud.setCombo(0);
      const pen = VR_DIFFICULTY[settings.difficulty].penalty;
      runTime += pen;
      hud.penalty(pen);
      if (settings.shake) player.shake(1);
      ctx.audio.play("vr_fall");
    }
    hud.respawnFade(() => {
      if (destroyed) return;
      const rs = world.course.respawns[Math.min(checkpointCount, world.course.respawns.length - 1)];
      player.reset(rs);
      world.resetMoverPhase();
      world.setMarker(null);
      dying = false;
      ctx.audio.play("vr_respawn");
    });
  }

  function finishRun() {
    if (mode !== "run") return;
    mode = "over";
    paused = false;
    exitLock();
    hud.dim(true);
    ctx.audio.play("vr_finish");

    const timeMs = Math.round(runTime * 1000);
    const prevBest = getBestTime();
    const newBestTime = prevBest === 0 || timeMs < prevBest;
    if (newBestTime) ctx.storage.setPref(VR_BEST_TIME_KEY, timeMs);
    const bestMs = newBestTime ? timeMs : prevBest;

    const timeBonus = Math.max(0, Math.round((150000 - timeMs) / 10));
    const score = Math.max(100, timeBonus + bonusScore + maxCombo * 150 - falls * 200);
    const saved = ctx.onGameOver(score, { timeMs, falls, maxCombo, shards: shardsGot });

    screens.showResults({
      timeMs,
      bestMs,
      newBestTime,
      score,
      saved,
      shards: shardsGot,
      shardTotal: world.shardTotal,
      maxCombo,
      falls,
      maxSpeed,
    });
  }

  function addCombo(n = 1) {
    combo += n;
    comboIdleT = 0;
    maxCombo = Math.max(maxCombo, combo);
    hud.setCombo(combo);
  }

  /* ================= Vòng lặp chính ================= */

  function frame(t) {
    if (destroyed) return;
    rafId = requestAnimationFrame(frame);
    const dt = Math.min((t - lastT) / 1000, 0.05);
    lastT = t;

    const cam = engine.camera;
    const playing = mode === "run" && !paused && !dying;

    world.update(dt, { playing, camPos: cam.pos });
    world.setPlayerShadow(playing ? player.pos : null);

    if (mode === "idle") {
      // Nền sống cho start screen: đứng trên nóc nhìn dọc course về phía
      // hoàng hôn (đúng bố cục ảnh reference start), thấy găng tay + gate.
      idleAngle += dt;
      cam.pos[0] = 5 + Math.sin(idleAngle * 0.2) * 0.8;
      cam.pos[1] = 8.6 + Math.sin(idleAngle * 0.34) * 0.25;
      cam.pos[2] = 21;
      cam.yaw = 0.1 + Math.sin(idleAngle * 0.13) * 0.04;
      cam.pitch = -0.15 + Math.sin(idleAngle * 0.27) * 0.015;
      cam.roll = 0;
      cam.fov = 78;
    } else if (mode === "run" && !paused) {
      if (!dying) {
        runTime += dt;
        hud.setTime(runTime);

        /* ----- Input ----- */
        const forward = (keys.isDown("KeyW") || keys.isDown("ArrowUp") ? 1 : 0) - (keys.isDown("KeyS") || keys.isDown("ArrowDown") ? 1 : 0);
        const strafe = (keys.isDown("KeyD") || keys.isDown("ArrowRight") ? 1 : 0) - (keys.isDown("KeyA") || keys.isDown("ArrowLeft") ? 1 : 0);
        const sprintHeld = keys.isDown("ShiftLeft") || keys.isDown("ShiftRight");
        const slideNow = slideHeld || keys.isDown("ControlLeft") || keys.isDown("ControlRight") || keys.isDown("KeyC");

        const st = player.update(dt, {
          forward,
          strafe,
          sprintHeld,
          sprintAllowed: energy > 1,
          slideHeld: slideNow,
        });

        maxSpeed = Math.max(maxSpeed, st.speed);

        /* ----- Sự kiện movement → âm thanh + combo ----- */
        const ev = st.ev;
        if (ev.jumped) ctx.audio.play("vr_jump");
        if (ev.wallJumped) {
          ctx.audio.play("vr_walljump");
          addCombo(1);
          hud.toast("WALL RUN!", "cyan");
        }
        if (ev.landed > 3) ctx.audio.play("vr_land");
        if (ev.slideStart) ctx.audio.play("vr_slide");
        if (ev.wallStart) {
          ctx.audio.play("vr_wall");
          if (settings.shake) player.shake(0.25);
        }
        if (ev.wallEnd && !ev.wallJumped && st.grounded === false) addCombo(1);
        if (ev.step) ctx.audio.play("vr_step");

        /* ----- Năng lượng ----- */
        const draining = sprintHeld && energy > 1 && forward > 0 && st.speed > 7.2 && !st.sliding;
        if (draining) {
          energy = Math.max(0, energy - VR_ENERGY.sprintDrain * dt);
          energyDelay = VR_ENERGY.regenDelay;
        } else {
          energyDelay -= dt;
          if (energyDelay <= 0) energy = Math.min(VR_ENERGY.max, energy + VR_ENERGY.regen * dt);
        }

        /* ----- Tương tác thế giới ----- */
        const got = world.checkShards(player.pos);
        if (got > 0) {
          shardsGot += got;
          energy = Math.min(VR_ENERGY.max, energy + VR_ENERGY.shardGain * got);
          bonusScore += got * (100 + combo * 25);
          addCombo(got);
          ctx.audio.play("vr_shard");
          fx.burst([player.pos[0], player.pos[1] + 1, player.pos[2]], VR_COLORS.lime, 10);
        }

        const gate = world.checkGate(player.pos, checkpointCount + 1);
        if (gate > 0) {
          checkpointCount = gate;
          bonusScore += 250;
          addCombo(1);
          hud.setCheckpoint(checkpointCount, VR_TOTAL_CHECKPOINTS);
          hud.toast(`CHECKPOINT ${checkpointCount}/${VR_TOTAL_CHECKPOINTS}`, "lime");
          ctx.audio.play("vr_gate");
          fx.burst([player.pos[0], player.pos[1] + 1.6, player.pos[2]], VR_COLORS.lime, 14, 1.3);
          if (checkpointCount >= 7) {
            world.setPortalActive(true);
            hud.toast("PORTAL MỞ — VỀ ĐÍCH!", "magenta");
          }
        }

        if (st.grounded) {
          const pad = world.checkPad(player.pos);
          if (pad) {
            const dir = pad.axis === "z" ? [0, 0, pad.dir] : [pad.dir, 0, 0];
            player.boost(dir);
            ctx.audio.play("vr_boost");
            hud.toast("BOOST!", "cyan");
            if (settings.shake) player.shake(0.5);
          }
        }

        // Trượt qua cổng tròn → combo (đi qua tâm tunnel khi đang trượt)
        if (st.sliding) {
          for (const tn of world.course.tunnels) {
            if (tn.passed) continue;
            const d = Math.abs(player.pos[0] - tn.x) + Math.abs(player.pos[2] - tn.z);
            if (d < 1.3) {
              tn.passed = true;
              addCombo(1);
              hud.toast("SLIDE!", "magenta");
              ctx.audio.play("vr_slide");
            }
          }
        }

        // Laser
        const h = st.sliding ? VR_MOVE.crouchH : VR_MOVE.standH;
        if (world.checkLaser(player.pos, h, VR_MOVE.capsuleR)) {
          hud.damageFlash();
          ctx.audio.play("vr_zap");
          respawn(true);
        } else if (world.laserWarnNear(player.pos)) {
          ctx.audio.play("vr_warn");
        }

        // Rơi khỏi map
        if (st.fell) respawn(true);

        // Đích
        if (world.checkPortal(player.pos)) {
          finishRun();
          return;
        }

        /* ----- Combo nhạt dần khi đứng yên ----- */
        if (st.speed < 1 && st.grounded) {
          comboIdleT += dt;
          if (comboIdleT > 3 && combo > 0) {
            combo = 0;
            hud.setCombo(0);
          }
        } else {
          comboIdleT = 0;
        }

        /* ----- HUD + camera feel ----- */
        hud.setSpeed(st.speed);
        hud.setEnergy(energy);

        const fovBase = settings.fov;
        const speedK = motion.reduced ? 0 : Math.max(0, (st.speed - VR_MOVE.walk) / (VR_MOVE.boostSpeed - VR_MOVE.walk)) * 9;
        cam.fov += (fovBase + speedK - cam.fov) * Math.min(1, dt * 6);

        fx.setWind(Math.max(0, (st.speed - 9) / 10));

        // Landing marker khi bay đủ lâu
        if (player.airborne && player.vel[1] < 2) {
          const lp = player.predictLanding();
          if (lp) world.setMarker(lp[0], lp[1], lp[2]);
          else world.setMarker(null);
        } else {
          world.setMarker(null);
        }

        gloves.update(dt, {
          speed: st.speed,
          grounded: st.grounded,
          sliding: st.sliding,
          wallRun: st.wallRun,
          boosting: st.boosting,
          landed: ev.landed,
          lookDx,
          lookDy,
        });
      }

      /* ----- Quality auto ----- */
      if (settings.quality === "auto") {
        fpsAccum += dt;
        fpsFrames += 1;
        fpsTimer += dt;
        if (fpsTimer > 2.4) {
          const fps = fpsFrames / fpsAccum;
          if (fps < 46 && autoScale > 0.62) {
            autoScale = Math.max(0.62, autoScale - 0.2);
            applyQuality();
          } else if (fps > 70 && autoScale < 1) {
            autoScale = Math.min(1, autoScale + 0.18);
            applyQuality();
          }
          fpsAccum = 0;
          fpsFrames = 0;
          fpsTimer = 0;
        }
      }
    }

    fx.update(dt, cam);
    lookDx = 0;
    lookDy = 0;

    engine.render(world.root, mode === "run" || mode === "idle" ? gloves.viewmodel : null);
  }

  /* ================= Interface vòng đời ================= */

  return {
    async mount(container, context) {
      ctx = context;
      const shadowRoot = container.getRootNode();

      if (shadowRoot instanceof ShadowRoot && !shadowRoot.querySelector("#void-runner-style")) {
        const style = document.createElement("style");
        style.id = "void-runner-style";
        style.textContent = VOID_RUNNER_CSS;
        shadowRoot.appendChild(style);
      }

      wrap = document.createElement("div");
      wrap.className = "vr-root";
      container.appendChild(wrap);

      loadSettings();

      const actions = {
        enterRun: () => startRun(),
        resume: () => resumeRun(),
        restart: () => startRun(),
        restartCheckpoint: () => {
          if (mode !== "run") return;
          resumeRun();
          respawn(false);
        },
        switchGame: () => ctx.requestSwitch(),
        goHome: () => ctx.requestHome(),
        applySettings: (partial) => applySettings(partial),
      };

      screens = createVrScreens(wrap, { settings, actions, getBestTime });

      const isCoarse = window.matchMedia("(pointer: coarse)").matches;
      const isSmall = Math.min(window.innerWidth, window.innerHeight) < 620;
      if (isCoarse && isSmall) {
        mode = "blocked";
        screens.showNotice("mobile");
        return;
      }

      canvas = document.createElement("canvas");
      canvas.className = "vr-canvas";
      wrap.insertBefore(canvas, wrap.firstChild);

      try {
        // far lớn (opt-in) để vẽ backdrop hoàng hôn rất xa ở start screen.
        // bloom: opt-in — bật/tắt runtime theo thang chất lượng (applyQuality).
        engine = createEngine(canvas, { fogNear: 34, fogFar: 112, fogColor: VR_COLORS.fog, far: 400, bloom: true });
      } catch {
        engine = null;
      }
      if (!engine) {
        mode = "blocked";
        canvas.remove();
        screens.showNotice("webgl");
        ctx.audio.play("bad");
        return;
      }

      world = createWorld(engine);
      world.setLaserScale(VR_DIFFICULTY[settings.difficulty].laserScale);
      player = createPlayer(world, engine.camera, motion);
      gloves = createGloves(motion);
      fx = createVrFx(world.root, motion);
      hud = createVrHud(wrap, {
        onPause: () => pauseRun(),
        onToggleSound: () => ctx.audio.setEnabled(!ctx.audio.enabled),
        soundOn: () => ctx.audio.enabled,
        onSwitch: () => ctx.requestSwitch(),
        onHome: () => ctx.requestHome(),
      });

      /* ----- Input ----- */
      keys = createKeyboard({ signal: ctx.signal });
      keys.on(["Space"], () => {
        if (mode === "run" && !paused && !dying) player.queueJump();
      });
      keys.on(["KeyR"], () => {
        if (mode !== "run") return;
        if (paused) resumeRun();
        respawn(false);
      });
      keys.on(["KeyP"], () => {
        if (mode !== "run") return;
        if (paused) resumeRun();
        else pauseRun();
      });
      keys.on(["KeyQ"], () => {
        // Assist wall-run: giữ đà rơi nhẹ để dễ bám tường (theo plan, tùy chọn)
        if (mode === "run" && !paused && player.airborne && player.vel[1] < 0) {
          player.vel[1] = Math.max(player.vel[1], -1.2);
        }
      });

      const sig = { signal: ctx.signal };

      window.addEventListener(
        "keydown",
        (e) => {
          if (e.code !== "Escape" || mode !== "run") return;
          if (!locked) {
            e.preventDefault();
            if (paused) resumeRun();
            else pauseRun();
          }
        },
        sig
      );

      document.addEventListener(
        "pointerlockchange",
        () => {
          locked = isLockedToCanvas();
          if (!locked && mode === "run" && !paused) pauseRun();
        },
        sig
      );

      document.addEventListener(
        "pointerlockerror",
        () => {
          locked = false;
          if (mode === "run" && !paused) {
            const now = performance.now();
            if (now - lockHintAt > 2500) {
              lockHintAt = now;
              hud?.toast("NHẤP VÀO MÀN HÌNH ĐỂ KHÓA CHUỘT", "cyan");
            }
          }
        },
        sig
      );

      canvas.addEventListener(
        "pointerdown",
        (e) => {
          if (mode !== "run" || paused) return;
          e.preventDefault();
          if (e.button === 0 && !locked) requestLock();
        },
        sig
      );

      wrap.addEventListener("contextmenu", (e) => e.preventDefault(), sig);

      window.addEventListener(
        "pointermove",
        (e) => {
          if (mode !== "run" || paused || dying) return;
          // Có lock: movementX/Y chuẩn FPS; mất lock vẫn nhìn được bằng
          // chuột thường (headless/cooldown Esc) — game không bao giờ đơ.
          const dx = e.movementX || 0;
          const dy = e.movementY || 0;
          player.look(dx, dy, settings.sensitivity);
          lookDx += dx;
          lookDy += dy;
        },
        sig
      );

      /* ----- Kích thước ----- */
      ro = new ResizeObserver(() => {
        if (wrap.clientWidth > 0) applyQuality();
      });
      ro.observe(wrap);
      applyQuality();

      /* ----- Test hook (QA headless) ----- */
      if (TEST) {
        window.__VR_DEBUG__ = {
          teleport: (cp) => {
            checkpointCount = Math.max(0, Math.min(7, cp));
            for (let i = 1; i <= checkpointCount; i++) world.activateGateSilent(i);
            hud.setCheckpoint(checkpointCount, VR_TOTAL_CHECKPOINTS);
            if (checkpointCount >= 7) world.setPortalActive(true);
            const rs = world.course.respawns[checkpointCount];
            player.reset(rs);
          },
          finish: () => {
            checkpointCount = 7;
            world.setPortalActive(true);
            finishRun();
          },
          die: () => respawn(true),
          place: (x, y, z, yaw = 0) => player.reset({ pos: [x, y, z], yaw }),
          state: () => ({
            mode, paused, runTime, checkpointCount, energy, combo, falls,
            pos: [...player.pos],
            grounded: player.grounded,
            sliding: player.sliding,
            wallRun: player.wallRunning,
          }),
        };
      }

      /* ----- Idle: cảnh 3D sống + start screen ----- */
      mode = "idle";
      engine.setFog(40, 118);
      world.setBackdrop(true);
      screens.showStart();

      lastT = performance.now();
      rafId = requestAnimationFrame(frame);
    },

    start() {
      if (mode === "blocked") return;
      startRun();
    },

    pause() {
      pauseRun();
    },

    resume() {
      resumeRun();
    },

    restart() {
      if (mode === "blocked") return;
      startRun();
    },

    resize() {
      applyQuality();
    },

    async destroy() {
      destroyed = true;
      cancelAnimationFrame(rafId);
      ro?.disconnect();
      keys?.destroy();
      exitLock();
      hud?.destroy();
      screens?.destroy();
      engine?.dispose();
      wrap?.remove();
      if (TEST && window.__VR_DEBUG__) delete window.__VR_DEBUG__;
      wrap = null;
      canvas = null;
      engine = null;
      world = null;
      player = null;
      gloves = null;
      fx = null;
      hud = null;
      screens = null;
    },
  };
}
