/**
 * weapon.js — khẩu rifle hư cấu theo Asset Sheet + gameplay reference:
 * thân đen góc cạnh NHIỀU KHỐI (receiver, ốp tay, ray ngắm răng cưa,
 * loa che lửa), sọc neon tím segment dọc ốp tay, chấm cyan, khối ngắm
 * lớn có MÀN HÌNH SỐ ĐẠN tím quay về người chơi (cập nhật realtime).
 * Băng 30 viên / 120 dự trữ, bắn tự động, click phải ngắm (ADS),
 * R thay đạn. Viewmodel vẽ ở pass riêng (không xuyên tường), có
 * sway/bob/recoil/hạ súng khi reload.
 */

import { createNode, addChild, meshNode, hex } from "./engine.js";

const MAG_SIZE = 30;
const RESERVE_START = 120;
const RESERVE_MAX = 240;
const FIRE_INTERVAL = 0.115; // ~520 rpm
const RELOAD_TIME = 1.35;

// Súng chiếm góc phải-dưới như reference; ADS đưa về giữa
const HIP = { x: 0.27, y: -0.285, z: -0.7 };
const ADS = { x: 0, y: -0.245, z: -0.56 };
const BASE_ROT = { x: 0.015, y: 0.06, z: 0 }; // nòng hơi chếch về tâm ngắm
const GUN_SCALE = 0.55; // toàn bộ khối dựng theo tỉ lệ lớn rồi thu lại

export function createWeapon(engine, audio) {
  let mag = MAG_SIZE;
  let reserve = RESERVE_START;
  let cooldown = 0;
  let reloading = 0;
  let adsBlend = 0; // 0 hip → 1 ngắm
  let recoilKick = 0;
  let swayX = 0;
  let swayY = 0;
  let bobPhase = 0;
  let muzzleT = 0;
  let onAmmoChange = null;

  /* ---------- Màn hình đạn trên súng (canvas texture) ---------- */
  const ammoCv = document.createElement("canvas");
  ammoCv.width = 96;
  ammoCv.height = 72;
  const ammoCtx = ammoCv.getContext("2d");

  function paintAmmoDisplay() {
    ammoCtx.fillStyle = "#120e2c";
    ammoCtx.fillRect(0, 0, 96, 72);
    // Khung tím 2 lớp
    ammoCtx.strokeStyle = "rgba(154,92,255,0.95)";
    ammoCtx.lineWidth = 4;
    ammoCtx.strokeRect(3, 3, 90, 66);
    ammoCtx.strokeStyle = "rgba(154,92,255,0.3)";
    ammoCtx.lineWidth = 2;
    ammoCtx.strokeRect(9, 9, 78, 54);
    // Số đạn
    ammoCtx.font = "800 40px monospace";
    ammoCtx.textAlign = "center";
    ammoCtx.textBaseline = "middle";
    ammoCtx.shadowColor = mag <= 5 ? "#ff4655" : "#b07bff";
    ammoCtx.shadowBlur = 12;
    ammoCtx.fillStyle = mag <= 5 ? "#ff5a68" : "#d4b4ff";
    ammoCtx.fillText(String(mag), 48, 38);
    ammoCtx.shadowBlur = 0;
  }

  paintAmmoDisplay();
  const ammoTex = engine.makeTexture(ammoCv);

  function refreshAmmoUi() {
    paintAmmoDisplay();
    engine.updateTexture(ammoTex, ammoCv);
    onAmmoChange?.(mag, reserve);
  }

  /* ---------- Viewmodel (tọa độ camera-space) ---------- */
  const root = createNode();
  const gun = createNode({
    pos: [HIP.x, HIP.y, HIP.z],
    rot: [BASE_ROT.x, BASE_ROT.y, BASE_ROT.z],
    scale: [GUN_SCALE, GUN_SCALE, GUN_SCALE],
  });
  addChild(root, gun);

  const BODY = hex("#3c4568");     // thân chính ghi xanh
  const BODY_DK = hex("#2a3150");  // khối phụ tối hơn
  const BODY_DKR = hex("#1d2338"); // nòng / chi tiết đen
  const VIOLET = hex("#8b5cff");
  const MAGENTA = hex("#ff4fd8");
  const CYAN = hex("#2fe2ff");

  const part = (geo, opts) => addChild(gun, meshNode(geo, opts));

  // ===== Receiver (thân chính) =====
  part("box", { pos: [0, 0, 0.02], scale: [0.125, 0.15, 0.6], color: BODY });
  part("box", { pos: [0, -0.055, -0.02], scale: [0.135, 0.05, 0.5], color: BODY_DK }); // gờ dưới
  part("box", { pos: [0, 0.045, 0.3], scale: [0.11, 0.1, 0.2], color: BODY_DK });      // khối khóa nòng
  // Cửa thoát vỏ đạn (bên phải)
  part("box", { pos: [0.064, 0.01, 0.1], scale: [0.006, 0.05, 0.16], color: BODY_DKR });

  // ===== Ốp tay trước =====
  part("box", { pos: [0, -0.005, -0.47], scale: [0.105, 0.12, 0.42], color: BODY_DK });
  part("box", { pos: [0, -0.07, -0.47], scale: [0.07, 0.035, 0.36], color: BODY_DKR }); // gờ dưới ốp
  // Sọc neon tím segment hai bên ốp tay (như reference)
  for (const sx of [-0.056, 0.056]) {
    for (const sz of [-0.32, -0.47, -0.62]) {
      part("box", { pos: [sx, 0.005, sz], scale: [0.008, 0.032, 0.1], color: VIOLET, emissive: 1 });
    }
    part("box", { pos: [sx, -0.045, -0.47], scale: [0.007, 0.014, 0.3], color: MAGENTA, emissive: 0.9 });
  }
  // Sọc cyan dưới ốp
  part("box", { pos: [0, -0.09, -0.47], scale: [0.02, 0.008, 0.3], color: CYAN, emissive: 0.8 });

  // ===== Ray ngắm trên (răng cưa) =====
  part("box", { pos: [0, 0.095, -0.14], scale: [0.095, 0.045, 0.78], color: BODY_DKR });
  for (let i = 0; i < 6; i++) {
    part("box", { pos: [0, 0.125, -0.42 + i * 0.11], scale: [0.098, 0.016, 0.05], color: BODY_DK });
  }
  // Đầu ruồi
  part("box", { pos: [0, 0.16, -0.5], scale: [0.026, 0.08, 0.045], color: BODY_DKR });
  part("box", { pos: [0, 0.205, -0.5], scale: [0.05, 0.016, 0.045], color: BODY_DKR });

  // ===== Khối ngắm + màn hình đạn =====
  part("box", { pos: [0, 0.175, 0.12], scale: [0.14, 0.135, 0.28], color: BODY });
  part("box", { pos: [0, 0.255, 0.12], scale: [0.06, 0.03, 0.3], color: BODY_DKR });
  part("box", { pos: [0, 0.175, -0.03], scale: [0.1, 0.09, 0.03], color: BODY_DKR }); // ống kính trước
  part("box", { pos: [0, 0.175, -0.032], scale: [0.06, 0.05, 0.012], color: CYAN, emissive: 0.9 }); // thấu kính cyan
  // Màn hình đạn: mặt trái khối ngắm, quay về người chơi
  part("plane", {
    pos: [-0.073, 0.175, 0.13],
    rot: [0, -Math.PI / 2 + 0.22, 0],
    scale: [0.15, 0.11, 1],
    color: [1, 1, 1],
    tex: ammoTex,
    emissive: 1,
  });
  // Viền tím quanh màn hình
  part("box", { pos: [-0.072, 0.118, 0.13], scale: [0.008, 0.012, 0.16], color: VIOLET, emissive: 0.9 });

  // ===== Nòng + loa che lửa =====
  part("box", { pos: [0, 0.02, -0.78], scale: [0.055, 0.065, 0.22], color: BODY_DKR });
  const muzzleBrake = part("box", { pos: [0, 0.02, -0.93], scale: [0.095, 0.105, 0.13], color: BODY_DK });
  part("box", { pos: [0, 0.02, -0.885], scale: [0.105, 0.045, 0.02], color: BODY_DKR });
  const muzzleTip = part("box", { pos: [0, 0.02, -1.0], scale: [0.08, 0.09, 0.018], color: MAGENTA, emissive: 0.9 });

  // ===== Báng sau + má tì =====
  part("box", { pos: [0, -0.035, 0.44], scale: [0.095, 0.135, 0.26], color: BODY_DK });
  part("box", { pos: [0, 0.055, 0.46], scale: [0.075, 0.05, 0.2], color: BODY_DKR });
  part("box", { pos: [0, -0.11, 0.52], scale: [0.095, 0.05, 0.12], color: BODY_DKR });
  // Đèn trạng thái tím trên báng
  part("box", { pos: [-0.05, 0.0, 0.44], scale: [0.006, 0.05, 0.05], color: VIOLET, emissive: 0.9 });

  // ===== Tay cầm + băng đạn =====
  part("box", { pos: [0, -0.155, 0.24], rot: [-0.35, 0, 0], scale: [0.068, 0.18, 0.09], color: BODY_DKR });
  const magNode = part("box", { pos: [0, -0.185, 0.0], rot: [0.22, 0, 0], scale: [0.082, 0.26, 0.125], color: BODY });
  part("box", { pos: [0, -0.305, -0.03], rot: [0.22, 0, 0], scale: [0.088, 0.05, 0.135], color: BODY_DKR }); // đế băng
  // Vạch đạn cyan trên băng
  part("box", { pos: [-0.043, -0.2, -0.015], rot: [0.22, 0, 0], scale: [0.006, 0.18, 0.02], color: CYAN, emissive: 0.75 });

  // ===== Chấm neon nhỏ =====
  part("box", { pos: [-0.066, -0.02, 0.18], scale: [0.008, 0.016, 0.04], color: CYAN, emissive: 1 });
  part("box", { pos: [-0.066, -0.02, 0.28], scale: [0.008, 0.016, 0.04], color: MAGENTA, emissive: 1 });

  // Chớp lửa đầu nòng (additive, bật tắt theo muzzleT)
  const flash = addChild(gun, meshNode("box", {
    pos: [0, 0.02, -1.05],
    scale: [0.11, 0.11, 0.08],
    color: hex("#ffd9a0"),
    emissive: 1,
    opacity: 0,
    additive: true,
  }));

  /* ---------- API ---------- */

  function tryFire() {
    if (reloading > 0 || cooldown > 0) return null;
    if (mag <= 0) {
      cooldown = 0.22;
      audio.play("empty");
      startReload(); // tự thay đạn khi hết băng
      return null;
    }
    mag -= 1;
    cooldown = FIRE_INTERVAL;
    recoilKick = 1;
    muzzleT = 0.05;
    audio.play("shoot");
    refreshAmmoUi();
    // Độ tản đạn: ngắm chuẩn hơn nhiều
    const spread = adsBlend > 0.6 ? 0.0035 : 0.014;
    return { spread, recoil: adsBlend > 0.6 ? 0.011 : 0.02 };
  }

  function startReload() {
    if (reloading > 0 || mag === MAG_SIZE || reserve <= 0) return false;
    reloading = RELOAD_TIME;
    audio.play("reload");
    return true;
  }

  function addReserve(amount) {
    reserve = Math.min(RESERVE_MAX, reserve + amount);
    refreshAmmoUi();
  }

  function reset() {
    mag = MAG_SIZE;
    reserve = RESERVE_START;
    cooldown = 0;
    reloading = 0;
    adsBlend = 0;
    refreshAmmoUi();
  }

  function update(dt, { adsHeld, moveSpeed, lookDx, lookDy, reducedMotion }) {
    cooldown = Math.max(0, cooldown - dt);
    muzzleT = Math.max(0, muzzleT - dt);
    recoilKick = Math.max(0, recoilKick - dt * 7);

    if (reloading > 0) {
      reloading -= dt;
      if (reloading <= 0) {
        const need = MAG_SIZE - mag;
        const take = Math.min(need, reserve);
        mag += take;
        reserve -= take;
        reloading = 0;
        refreshAmmoUi();
      }
    }

    const adsTarget = adsHeld && reloading <= 0 ? 1 : 0;
    adsBlend += (adsTarget - adsBlend) * Math.min(1, dt * 10);

    // Sway theo chuyển động chuột + bob theo bước chân
    const swayTargetX = Math.max(-1, Math.min(1, -lookDx * 0.06));
    const swayTargetY = Math.max(-1, Math.min(1, lookDy * 0.06));
    swayX += (swayTargetX - swayX) * Math.min(1, dt * 8);
    swayY += (swayTargetY - swayY) * Math.min(1, dt * 8);
    if (!reducedMotion && moveSpeed > 0.5) bobPhase += dt * (5 + moveSpeed);

    const bobX = Math.sin(bobPhase) * 0.006 * (1 - adsBlend);
    const bobY = Math.abs(Math.cos(bobPhase)) * 0.006 * (1 - adsBlend);

    const reloadDip = reloading > 0 ? Math.sin(Math.min(1, (RELOAD_TIME - reloading) / RELOAD_TIME) * Math.PI) : 0;

    gun.pos[0] = HIP.x + (ADS.x - HIP.x) * adsBlend + swayX * 0.012 + bobX;
    gun.pos[1] = HIP.y + (ADS.y - HIP.y) * adsBlend + swayY * 0.012 - bobY - reloadDip * 0.16;
    gun.pos[2] = HIP.z + (ADS.z - HIP.z) * adsBlend + recoilKick * 0.05;
    gun.rot[0] = BASE_ROT.x * (1 - adsBlend) + swayY * 0.03 + recoilKick * 0.06 - reloadDip * 0.7;
    gun.rot[1] = BASE_ROT.y * (1 - adsBlend) + swayX * 0.04;
    gun.rot[2] = BASE_ROT.z + swayX * 0.02;

    flash.mesh.opacity = muzzleT > 0 ? 0.7 : 0;
    if (muzzleT > 0) {
      flash.rot[2] = Math.random() * Math.PI;
      const s = 0.09 + Math.random() * 0.07;
      flash.scale[0] = s;
      flash.scale[1] = s;
    }
    magNode.visible = reloading <= 0 || reloading < RELOAD_TIME * 0.45;
    muzzleTip.mesh.emissive = 0.6 + recoilKick * 0.4;
    void muzzleBrake;
  }

  return {
    viewmodel: root,
    tryFire,
    startReload,
    addReserve,
    reset,
    update,
    get mag() { return mag; },
    get reserve() { return reserve; },
    get reloading() { return reloading > 0; },
    get adsBlend() { return adsBlend; },
    set onAmmoChange(fn) { onAmmoChange = fn; },
  };
}
