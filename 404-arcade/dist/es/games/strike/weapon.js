/**
 * weapon.js — khẩu rifle hư cấu theo Asset Sheet:
 * thân đen góc cạnh, sọc neon tím/magenta, khối ngắm có MÀN HÌNH HIỂN
 * THỊ SỐ ĐẠN (cập nhật realtime như reference). Băng 30 viên / 120 dự
 * trữ, bắn tự động, click phải ngắm (ADS), R thay đạn. Viewmodel vẽ ở
 * pass riêng (không xuyên tường), có sway/bob/recoil/hạ súng khi reload.
 */

import { createNode, addChild, meshNode, hex } from "./engine.js";

const MAG_SIZE = 30;
const RESERVE_START = 120;
const RESERVE_MAX = 240;
const FIRE_INTERVAL = 0.115; // ~520 rpm
const RELOAD_TIME = 1.35;

const HIP = { x: 0.3, y: -0.32, z: -0.62 };
const ADS = { x: 0, y: -0.245, z: -0.46 };

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
  ammoCv.width = 64;
  ammoCv.height = 44;
  const ammoCtx = ammoCv.getContext("2d");

  function paintAmmoDisplay() {
    ammoCtx.fillStyle = "#0d0a24";
    ammoCtx.fillRect(0, 0, 64, 44);
    ammoCtx.strokeStyle = "rgba(154,92,255,0.9)";
    ammoCtx.lineWidth = 2;
    ammoCtx.strokeRect(2, 2, 60, 40);
    ammoCtx.font = "800 26px monospace";
    ammoCtx.textAlign = "center";
    ammoCtx.textBaseline = "middle";
    ammoCtx.shadowColor = "#b07bff";
    ammoCtx.shadowBlur = 8;
    ammoCtx.fillStyle = mag <= 5 ? "#ff4f64" : "#cfa9ff";
    ammoCtx.fillText(String(mag), 32, 24);
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
  const gun = createNode({ pos: [HIP.x, HIP.y, HIP.z] });
  addChild(root, gun);

  const DARK = hex("#171c38");
  const DARKER = hex("#10142c");
  const VIOLET = hex("#9a5cff");
  const MAGENTA = hex("#ff4fd8");

  // Thân chính
  addChild(gun, meshNode("box", { pos: [0, 0, -0.05], scale: [0.085, 0.11, 0.58], color: DARK }));
  // Ốp trên + ray ngắm
  addChild(gun, meshNode("box", { pos: [0, 0.07, -0.12], scale: [0.07, 0.045, 0.38], color: DARKER }));
  // Nòng
  addChild(gun, meshNode("box", { pos: [0, 0.015, -0.44], scale: [0.045, 0.05, 0.26], color: DARKER }));
  const muzzleTip = addChild(gun, meshNode("box", { pos: [0, 0.015, -0.585], scale: [0.055, 0.06, 0.03], color: MAGENTA, emissive: 0.9 }));
  // Báng sau
  addChild(gun, meshNode("box", { pos: [0, -0.035, 0.3], scale: [0.07, 0.1, 0.16], color: DARKER }));
  // Băng đạn chéo
  const magNode = addChild(gun, meshNode("box", { pos: [0, -0.12, 0.02], rot: [0.18, 0, 0], scale: [0.06, 0.16, 0.09], color: DARK }));
  // Tay cầm
  addChild(gun, meshNode("box", { pos: [0, -0.1, 0.16], rot: [-0.3, 0, 0], scale: [0.055, 0.13, 0.07], color: DARKER }));
  // Khối ngắm + màn hình đạn (nghiêng về phía người chơi)
  addChild(gun, meshNode("box", { pos: [0, 0.125, 0.02], scale: [0.09, 0.09, 0.16], color: DARK }));
  addChild(gun, meshNode("plane", {
    pos: [0, 0.128, 0.105],
    rot: [-0.18, 0, 0],
    scale: [0.078, 0.056, 1],
    color: [1, 1, 1],
    tex: ammoTex,
    emissive: 1,
  }));
  // Sọc neon tím dọc thân + chấm magenta
  addChild(gun, meshNode("box", { pos: [0.046, 0.01, -0.1], scale: [0.006, 0.02, 0.34], color: VIOLET, emissive: 1 }));
  addChild(gun, meshNode("box", { pos: [-0.046, 0.01, -0.1], scale: [0.006, 0.02, 0.34], color: VIOLET, emissive: 1 }));
  addChild(gun, meshNode("box", { pos: [0.043, -0.045, 0.08], scale: [0.008, 0.008, 0.1], color: MAGENTA, emissive: 1 }));

  // Chớp lửa đầu nòng (additive, bật tắt theo muzzleT)
  const flash = addChild(gun, meshNode("box", {
    pos: [0, 0.015, -0.64],
    scale: [0.16, 0.16, 0.1],
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
    gun.pos[1] = HIP.y + (ADS.y - HIP.y) * adsBlend + swayY * 0.012 - bobY - reloadDip * 0.14;
    gun.pos[2] = HIP.z + (ADS.z - HIP.z) * adsBlend + recoilKick * 0.045;
    gun.rot[0] = swayY * 0.03 + recoilKick * 0.06 - reloadDip * 0.7;
    gun.rot[1] = swayX * 0.04;
    gun.rot[2] = swayX * 0.02;

    flash.mesh.opacity = muzzleT > 0 ? 0.85 : 0;
    if (muzzleT > 0) {
      flash.rot[2] = Math.random() * Math.PI;
      const s = 0.1 + Math.random() * 0.1;
      flash.scale[0] = s;
      flash.scale[1] = s;
    }
    magNode.visible = reloading <= 0 || reloading < RELOAD_TIME * 0.45;
    muzzleTip.mesh.emissive = 0.6 + recoilKick * 0.4;
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
