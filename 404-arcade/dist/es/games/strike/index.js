/**
 * 404 Strike — mini FPS 3D (desktop-first).
 *
 * MVP theo plan: map digital-industrial nguyên bản (Level Map), góc nhìn
 * thứ nhất, WASD + mouse look + Pointer Lock, click trái bắn / phải ngắm,
 * R thay đạn, Space nhảy, Shift chạy, Esc tạm dừng. Một khẩu rifle hư cấu
 * 30/120, raycasting, hitbox đầu/thân, bot theo wave với state machine,
 * trận 90 giây, HP/ammo/timer/wave/score/combo/high-score.
 * Mobile hiển thị "Tối ưu cho máy tính"; WebGL lỗi có fallback.
 *
 * Màn hình chờ: cảnh 3D live với bot tuần tra + camera bay quanh map
 * (không dùng ảnh tĩnh — toàn bộ dựng bằng WebGL).
 */

import { createEngine, dirFromYawPitch, rayAABB } from "./engine.js";
import { createWorld } from "./world.js";
import { createPlayer } from "./player.js";
import { createWeapon } from "./weapon.js";
import { createBots } from "./bots.js";
import { createFx } from "./fx.js";
import { createPickups } from "./pickups.js";
import { createStrikeHud } from "./hud.js";
import { createScreens } from "./screens.js";
import { STRIKE_CSS } from "./styles.js";
import { createKeyboard } from "../../core/input-manager.js";

const SETTINGS_KEY = "strike-settings";
const QUALITY_SCALE = { low: 0.62, medium: 0.82, high: 1 };

export function createGame() {
  let ctx = null;
  let wrap = null;
  let canvas = null;
  let engine = null;
  let world = null;
  let fx = null;
  let bots = null;
  let weapon = null;
  let player = null;
  let pickups = null;
  let hud = null;
  let screens = null;
  let keys = null;
  let ro = null;

  let destroyed = false;
  let rafId = 0;
  let lastT = 0;

  // idle (màn hình chờ) | match | paused | over | blocked
  let mode = "blocked";
  let paused = false;

  let locked = false;
  let expectUnlock = false; // chờ unlock do exitLock() chủ động (không phải Esc)
  let lockHintAt = 0; // chống spam toast "nhấp để khóa chuột"

  let firing = false;
  let adsHeld = false;
  let lookDx = 0;
  let lookDy = 0;

  const TEST = typeof window !== "undefined" && window.__ARCADE_STRIKE_TEST__;
  // Hook QA: true → trận 12s; { time: n } → tùy chỉnh thời lượng trận test
  const MATCH_TIME = TEST ? (typeof TEST === "object" && TEST.time > 0 ? TEST.time : 12) : 90;

  const settings = {
    difficulty: "normal",
    quality: "auto",
    volume: 80,
    sensitivity: 60,
    shake: true,
  };
  let autoScale = 0.82; // scale hiện tại khi quality = auto
  let fpsAccum = 0;
  let fpsFrames = 0;
  let fpsTimer = 0;

  // Trạng thái trận
  let matchTime = MATCH_TIME;
  let wave = 0;
  let waveElapsed = 0;
  let score = 0;
  let combo = 0;
  let comboT = 0;
  let kills = 0;
  let headshots = 0;
  let shots = 0;
  let hits = 0;
  let recentFire = 0;
  let spawnQueue = [];
  let idleAngle = 0;

  /* ================= Cài đặt ================= */

  function loadSettings() {
    const saved = ctx.storage.getPref(SETTINGS_KEY, null);
    if (saved && typeof saved === "object") Object.assign(settings, saved);
    if (ctx.config?.quality && ctx.config.quality !== "auto" && !saved?.quality) {
      settings.quality = ctx.config.quality;
    }
    ctx.audio.setVolume(settings.volume / 100);
  }

  function persistSettings() {
    ctx.storage.setPref(SETTINGS_KEY, { ...settings });
  }

  function currentScale() {
    if (settings.quality === "auto") return autoScale;
    return QUALITY_SCALE[settings.quality] ?? 0.82;
  }

  /** Bloom theo thang chất lượng: tắt ở low; auto tắt khi autoScale đã tụt đáy. */
  function bloomWanted() {
    if (settings.quality === "low") return false;
    if (settings.quality === "auto") return autoScale > QUALITY_SCALE.low + 0.001;
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
    persistSettings();
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

  /**
   * Yêu cầu khóa chuột. KHÔNG latch trạng thái thất bại: Chrome có
   * cooldown ~1,3s sau khi người chơi thoát lock bằng Esc, nên yêu cầu
   * ngay sau đó (bấm "Tiếp tục") có thể bị từ chối. Khi đó game vẫn chạy
   * với mouse-look thường và tự khóa lại ở cú click kế tiếp trên canvas.
   */
  function requestLock() {
    if (locked || !canvas || destroyed) return;
    const onRejected = () => {
      if (mode !== "match" || paused || destroyed) return;
      const now = performance.now();
      if (now - lockHintAt > 2500) {
        lockHintAt = now;
        hud?.toast("NHẤP VÀO MÀN HÌNH ĐỂ KHÓA TÂM NGẮM");
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
      // Thoát lock CHỦ ĐỘNG (pause/kết thúc trận): sự kiện pointerlockchange
      // tương ứng có thể về trễ một task — đánh dấu để handler không hiểu
      // nhầm là người chơi Esc rồi tự pause lại ngay sau khi resume.
      expectUnlock = true;
      try {
        document.exitPointerLock();
      } catch {
        expectUnlock = false;
      }
    }
  }

  /* ================= Wave & spawn ================= */

  function startNextWave() {
    wave += 1;
    waveElapsed = 0;
    hud.setWave(wave);
    hud.waveBanner(wave);
    ctx.audio.play("wave");
    const count = Math.min(3 + wave, 8);
    const gates = [...world.botGates].sort(() => Math.random() - 0.5);
    spawnQueue = [];
    for (let i = 0; i < count; i++) {
      const gate = gates[i % gates.length];
      spawnQueue.push({
        delay: TEST ? i * 0.15 : 0.4 + i * 0.55,
        gate,
        // 1/3 số bot tiến vào sân trung tâm (arena sống động như reference)
        loop: i % 3 === 2 ? "court" : gate.loop,
      });
    }
  }

  function processSpawns(dt) {
    for (const q of spawnQueue) q.delay -= dt;
    while (spawnQueue.length && spawnQueue[0].delay <= 0) {
      const q = spawnQueue.shift();
      bots.spawn(q.gate, settings.difficulty, q.loop);
    }
  }

  /* ================= Bắn ================= */

  function fireOnce() {
    const shot = weapon.tryFire();
    if (!shot) return;
    shots += 1;
    recentFire = Math.min(1, recentFire + 0.34);
    player.addRecoil(shot.recoil);

    const cam = engine.camera;
    const origin = [cam.pos[0], cam.pos[1], cam.pos[2]];
    const dir = dirFromYawPitch(cam.yaw, cam.pitch);
    // Tản đạn
    dir[0] += (Math.random() - 0.5) * shot.spread * 2;
    dir[1] += (Math.random() - 0.5) * shot.spread * 2;
    dir[2] += (Math.random() - 0.5) * shot.spread * 2;
    const len = Math.hypot(...dir);
    dir[0] /= len; dir[1] /= len; dir[2] /= len;

    // Chạm tường/vật cản gần nhất
    let tWorld = null;
    for (const c of world.colliders) {
      const t = rayAABB(origin, dir, c);
      if (t !== null && (tWorld === null || t < tWorld)) tWorld = t;
    }

    const hitBot = bots.raycast(origin, dir);
    let endPoint;

    if (hitBot && (tWorld === null || hitBot.t < tWorld) && hitBot.t < 90) {
      hits += 1;
      endPoint = [
        origin[0] + dir[0] * hitBot.t,
        origin[1] + dir[1] * hitBot.t,
        origin[2] + dir[2] * hitBot.t,
      ];
      const dmg = hitBot.isHead ? 50 : 22;
      hud.hitmarker(hitBot.isHead);
      ctx.audio.play(hitBot.isHead ? "headshot" : "hitmark");
      fx.burst(endPoint, hitBot.isHead ? "#ffd23f" : "#9a5cff", 6);
      bots.damage(hitBot.bot, dmg, hitBot.isHead);
    } else if (tWorld !== null) {
      endPoint = [
        origin[0] + dir[0] * tWorld,
        origin[1] + dir[1] * tWorld,
        origin[2] + dir[2] * tWorld,
      ];
      fx.burst(endPoint, "#20e3ff", 4);
    } else {
      endPoint = [origin[0] + dir[0] * 70, origin[1] + dir[1] * 70, origin[2] + dir[2] * 70];
    }

    // Tracer xuất phát từ đầu nòng (lệch phải-dưới tâm nhìn)
    const right = [Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)];
    const muzzle = [
      origin[0] + dir[0] * 0.55 + right[0] * 0.2 * (1 - weapon.adsBlend),
      origin[1] + dir[1] * 0.55 - 0.14 * (1 - weapon.adsBlend),
      origin[2] + dir[2] * 0.55 + right[2] * 0.2 * (1 - weapon.adsBlend),
    ];
    fx.tracer(muzzle, endPoint, "#ffe9b0");

    // Tiếng súng khiến bot gần đó lao tới
    bots.aggro(player.pos, 26);
  }

  function onBotKilled(bot, isHead) {
    kills += 1;
    if (isHead) {
      headshots += 1;
      hud.showHeadshot();
    }
    combo = comboT > 0 ? combo + 1 : 1;
    comboT = 4;
    const mult = Math.min(3, 1 + (combo - 1) * 0.25);
    const base = isHead ? 150 : 100;
    score += Math.round((base * mult) / 10) * 10;
    hud.setScore(score);
    hud.setCombo(combo);
  }

  function onPlayerHit(dmg, fromPos) {
    if (mode !== "match" || paused) return;
    player.hp -= dmg;
    hud.setHp(player.hp);
    hud.damageFlash();
    if (settings.shake) player.shake(0.8);
    ctx.audio.play("hurt");
    void fromPos;
    if (player.hp <= 0) endMatch();
  }

  /* ================= Vòng trận ================= */

  function startMatch() {
    if (!engine) return;
    mode = "match";
    paused = false;
    firing = false;
    adsHeld = false;

    matchTime = MATCH_TIME;
    wave = 0;
    score = 0;
    combo = 0;
    comboT = 0;
    kills = 0;
    headshots = 0;
    shots = 0;
    hits = 0;
    spawnQueue = [];

    bots.clearAll();
    pickups.reset();
    player.reset(world.playerSpawn);
    weapon.reset();

    screens.hideAll();
    hud.show(true);
    hud.dim(false);
    hud.setScore(0);
    hud.setCombo(0);
    hud.setHp(100);
    hud.setTime(matchTime);
    hud.setAmmo(weapon.mag, weapon.reserve);

    startNextWave();
    requestLock();
    ctx.onMatchStart?.();
  }

  function pauseMatch() {
    if (mode !== "match" || paused) return;
    paused = true;
    firing = false;
    adsHeld = false;
    exitLock();
    hud.dim(true);
    screens.showPause();
  }

  function resumeMatch() {
    if (mode !== "match" || !paused) return;
    paused = false;
    keys.clearDown();
    screens.hideAll();
    hud.dim(false);
    requestLock();
  }

  function endMatch() {
    if (mode !== "match") return;
    mode = "over";
    paused = false;
    firing = false;
    exitLock();
    hud.dim(true);

    const accuracy = shots > 0 ? Math.round((hits / shots) * 100) : 0;
    const saved = ctx.onGameOver(score, { kills, headshots, wave });
    screens.showOver({ score, saved, kills, headshots, accuracy, wave });
  }

  /* ================= Vòng lặp chính ================= */

  function frame(t) {
    if (destroyed) return;
    rafId = requestAnimationFrame(frame);
    const dt = Math.min((t - lastT) / 1000, 0.05);
    lastT = t;

    world.update(dt);
    fx.update(dt);

    const cam = engine.camera;

    if (mode === "idle") {
      // Nền sống cho start screen: góc nhìn thứ nhất từ điểm xuất phát
      // (đúng bố cục ảnh reference — thấy súng + sân + bảng 404)
      idleAngle += dt;
      cam.pos[0] = Math.sin(idleAngle * 0.3) * 0.35;
      cam.pos[1] = 1.66 + Math.sin(idleAngle * 0.55) * 0.03;
      cam.pos[2] = 15.2;
      cam.yaw = Math.sin(idleAngle * 0.17) * 0.05;
      cam.pitch = -0.02 + Math.sin(idleAngle * 0.4) * 0.012;
      cam.fov = 72;
      bots.update(dt, null, { camX: cam.pos[0], camZ: cam.pos[2] });
    } else if (mode === "match" && !paused) {
      matchTime -= dt;
      waveElapsed += dt;
      hud.setTime(matchTime);
      if (matchTime <= 0) {
        hud.setTime(0);
        endMatch();
        return;
      }

      // Input di chuyển
      const forward = (keys.isDown("KeyW") || keys.isDown("ArrowUp") ? 1 : 0) - (keys.isDown("KeyS") || keys.isDown("ArrowDown") ? 1 : 0);
      const strafe = (keys.isDown("KeyD") || keys.isDown("ArrowRight") ? 1 : 0) - (keys.isDown("KeyA") || keys.isDown("ArrowLeft") ? 1 : 0);
      const run = keys.isDown("ShiftLeft") || keys.isDown("ShiftRight");
      const pState = player.update(dt, { forward, strafe, run });

      // Súng + FOV ngắm
      weapon.update(dt, {
        adsHeld,
        moveSpeed: pState.moveSpeed,
        lookDx,
        lookDy,
        reducedMotion: ctx.reducedMotion,
      });
      const fovTarget = adsHeld && !weapon.reloading ? 56 : 75;
      cam.fov += (fovTarget - cam.fov) * Math.min(1, dt * 10);

      if (firing) fireOnce();
      recentFire = Math.max(0, recentFire - dt * 1.6);

      // Bot + vật phẩm
      const playerState = {
        eye: player.eye(),
        pos: [player.pos[0], player.pos[1], player.pos[2]],
        speed: pState.moveSpeed,
      };
      bots.update(dt, playerState, { camX: cam.pos[0], camZ: cam.pos[2] });
      const picked = pickups.update(dt, player.pos);
      for (const type of picked) {
        if (type === "health") {
          player.hp = Math.min(100, player.hp + 30);
          hud.setHp(player.hp);
          hud.toast("+30 HP");
        } else {
          weapon.addReserve(60);
          hud.toast("+60 ĐẠN");
        }
      }

      // Wave kế tiếp khi dọn sạch hoặc quá lâu
      if (spawnQueue.length === 0 && (bots.aliveCount() === 0 || waveElapsed > (TEST ? 4 : 25))) {
        startNextWave();
      }
      processSpawns(dt);

      // Combo hết hạn
      if (comboT > 0) {
        comboT -= dt;
        if (comboT <= 0) {
          combo = 0;
          hud.setCombo(0);
        }
      }

      // Tâm ngắm mở rộng khi chạy/bắn, khép khi ngắm
      const spread = adsHeld ? 1 : 5 + pState.moveSpeed * 1.1 + recentFire * 9;
      hud.setCrosshair(spread, !(adsHeld && !weapon.reloading));
      hud.setAmmo(weapon.mag, weapon.reserve);

      // Quality auto: đo fps và hạ/tăng scale
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

    lookDx = 0;
    lookDy = 0;

    engine.render(world.root, mode === "match" || mode === "idle" ? weapon.viewmodel : null);
  }

  /* ================= Interface vòng đời ================= */

  return {
    async mount(container, context) {
      ctx = context;
      const shadowRoot = container.getRootNode();

      // CSS của Strike chỉ inject khi game được mount (lazy)
      if (shadowRoot instanceof ShadowRoot && !shadowRoot.querySelector("#strike-style")) {
        const style = document.createElement("style");
        style.id = "strike-style";
        style.textContent = STRIKE_CSS;
        shadowRoot.appendChild(style);
      }

      wrap = document.createElement("div");
      wrap.className = "sk-root";
      container.appendChild(wrap);

      loadSettings();

      const actions = {
        enterMatch: () => startMatch(),
        resume: () => resumeMatch(),
        restart: () => startMatch(),
        switchGame: () => ctx.requestSwitch(),
        goHome: () => ctx.requestHome(),
        applySettings: (partial) => applySettings(partial),
      };

      screens = createScreens(wrap, { settings, actions });

      // Mobile: theo plan, hiển thị nhãn tối ưu desktop
      const isCoarse = window.matchMedia("(pointer: coarse)").matches;
      const isSmall = Math.min(window.innerWidth, window.innerHeight) < 620;
      if (isCoarse && isSmall) {
        mode = "blocked";
        screens.showNotice("mobile");
        return;
      }

      canvas = document.createElement("canvas");
      canvas.className = "sk-canvas";
      wrap.insertBefore(canvas, wrap.firstChild);

      try {
        // Ambient/hướng nắng opt-in: arena sáng rõ như gameplay reference.
        // bloom: opt-in — bật/tắt runtime theo thang chất lượng (applyQuality).
        engine = createEngine(canvas, {
          fogNear: 30,
          fogFar: 88,
          ambient: 0.62,
          lightDir: [-0.3, -0.85, -0.42],
          bloom: true,
          // Map nhiều neon diện tích lớn → bloom nhẹ tay hơn mặc định,
          // giữ nét mạch sàn mảnh như ảnh gameplay reference.
          bloomStrength: 0.62,
          bloomThreshold: 0.66,
        });
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
      fx = createFx(world.root, { reducedMotion: ctx.reducedMotion });
      bots = createBots(world.root, world, ctx.audio, fx, {
        onPlayerHit,
        onKilled: onBotKilled,
        reducedMotion: ctx.reducedMotion,
      });
      player = createPlayer(world, engine.camera, { reducedMotion: ctx.reducedMotion });
      weapon = createWeapon(engine, ctx.audio);
      pickups = createPickups(world.root, world, ctx.audio, fx);
      hud = createStrikeHud(wrap, {
        onPause: () => pauseMatch(),
        onToggleSound: () => ctx.audio.setEnabled(!ctx.audio.enabled),
        soundOn: () => ctx.audio.enabled,
      });
      weapon.onAmmoChange = (mag, reserve) => hud.setAmmo(mag, reserve);

      /* ----- Input ----- */
      keys = createKeyboard({ signal: ctx.signal });
      keys.on(["KeyR"], () => {
        if (mode === "match" && !paused) weapon.startReload();
      });
      keys.on(["Space"], () => {
        if (mode === "match" && !paused) player.queueJump();
      });
      keys.on(["KeyP"], () => {
        if (mode !== "match") return;
        if (paused) resumeMatch();
        else pauseMatch();
      });

      const sig = { signal: ctx.signal };

      // Esc: khi có pointer lock, trình duyệt tự nhả lock → pointerlockchange
      // xử lý pause. Khi KHÔNG có lock (fallback), bắt Escape thủ công.
      window.addEventListener(
        "keydown",
        (e) => {
          if (e.code !== "Escape" || mode !== "match") return;
          if (!locked) {
            e.preventDefault();
            if (paused) resumeMatch();
            else pauseMatch();
          }
        },
        sig
      );

      document.addEventListener(
        "pointerlockchange",
        () => {
          locked = isLockedToCanvas();
          if (locked) {
            expectUnlock = false;
            return;
          }
          // Unlock do chính game gọi exitLock(). Nếu người chơi đã kịp bấm
          // "Tiếp tục" trước khi sự kiện về (double-tap P, frame nặng...),
          // không được auto-pause lại — chỉ thử khóa lại cho trận đang chạy.
          if (expectUnlock) {
            expectUnlock = false;
            if (mode === "match" && !paused) requestLock();
            return;
          }
          if (mode === "match" && !paused) pauseMatch();
        },
        sig
      );

      // Một số trường hợp lock thất bại chỉ phát pointerlockerror
      // (không reject promise) — vẫn phải gợi ý người chơi click lại.
      document.addEventListener(
        "pointerlockerror",
        () => {
          locked = false;
          if (mode === "match" && !paused) {
            const now = performance.now();
            if (now - lockHintAt > 2500) {
              lockHintAt = now;
              hud?.toast("NHẤP VÀO MÀN HÌNH ĐỂ KHÓA TÂM NGẮM");
            }
          }
        },
        sig
      );

      canvas.addEventListener(
        "pointerdown",
        (e) => {
          if (mode !== "match" || paused) return;
          e.preventDefault();
          if (e.button === 0) {
            // Cú click là user-gesture mới → luôn thử khóa lại nếu đang mất lock
            if (!locked) requestLock();
            firing = true;
          } else if (e.button === 2) {
            adsHeld = true;
          }
        },
        sig
      );

      window.addEventListener(
        "pointerup",
        (e) => {
          if (e.button === 0) firing = false;
          if (e.button === 2) adsHeld = false;
        },
        sig
      );

      wrap.addEventListener("contextmenu", (e) => e.preventDefault(), sig);

      window.addEventListener(
        "pointermove",
        (e) => {
          if (mode !== "match" || paused) return;
          // Có lock: movementX/Y là delta chuẩn FPS. Mất lock (cooldown
          // sau Esc, môi trường không hỗ trợ): vẫn quan sát được bằng
          // chuột thường — game không bao giờ "đơ" vì thiếu pointer lock.
          const dx = e.movementX || 0;
          const dy = e.movementY || 0;
          player.look(dx, dy, settings.sensitivity / 50);
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

      /* ----- Hook QA headless (chỉ bật khi có __ARCADE_STRIKE_TEST__) ----- */
      if (TEST) {
        window.__STRIKE_DEBUG__ = {
          bots: () =>
            bots.slots
              .filter((b) => b.alive)
              .map((b) => ({ state: b.state, pos: [...b.root.pos] })),
          place: (x, z, yaw = 0) => {
            player.reset({ pos: [x, 0, z], yaw });
            hud.setHp(player.hp);
          },
          spawnAt: (i, loop = null) => bots.spawn(world.botGates[i], settings.difficulty, loop),
        };
      }

      /* ----- Màn hình chờ: cảnh live + 3 bot tuần tra ----- */
      mode = "idle";
      bots.spawn(world.botGates[1], "normal", "left");
      bots.spawn(world.botGates[5], "normal", "right");
      bots.spawn(world.botGates[2], "normal", "court");
      screens.showStart();

      lastT = performance.now();
      rafId = requestAnimationFrame(frame);
    },

    /** Interface chuẩn: start = vào trận (màn hình start cũng gọi hàm này). */
    start() {
      if (mode === "blocked") return;
      startMatch();
    },

    pause() {
      pauseMatch();
    },

    resume() {
      resumeMatch();
    },

    restart() {
      if (mode === "blocked") return;
      startMatch();
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
      if (TEST && window.__STRIKE_DEBUG__) delete window.__STRIKE_DEBUG__;
      wrap = null;
      engine = null;
      world = null;
      bots = null;
      weapon = null;
      player = null;
      fx = null;
      pickups = null;
    },
  };
}
