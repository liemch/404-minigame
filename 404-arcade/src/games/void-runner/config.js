/**
 * config.js — thông số tuning của VOID RUNNER 404.
 * Màu bám theo asset sheet (đen xanh đậm / cyan / magenta / lime),
 * movement theo plan mục 7 (walk 7, sprint 11, gravity 24, coyote/buffer…).
 */

export const VR_COLORS = {
  bg: "#120c2a",          // nền vực tím than
  fog: [0.1, 0.068, 0.21],
  slab: "#1d2445",        // mặt platform đá tối
  slabDark: "#12172e",    // thân/đáy platform
  panel: "#101631",
  cyan: "#22e4ff",
  magenta: "#e42cff",
  pink: "#ff3fd4",
  lime: "#b7f232",
  red: "#ff2e4d",
  violet: "#8b5bff",
  white: "#f2f6ff",
  gold: "#ffd23f",
};

export const VR_MOVE = {
  walk: 7,
  sprint: 11,
  boostSpeed: 18.5,       // tốc độ khi đạp jump pad
  boostJumpV: 11.6,       // lực bật lên của jump pad
  boostTime: 1.6,
  groundAccel: 35,
  airAccel: 12,
  gravity: 24,
  jumpHeight: 1.7,        // v = sqrt(2·g·h) ≈ 9.03
  coyote: 0.13,
  jumpBuffer: 0.13,
  slideTime: 1.05,
  slideBoost: 1.16,       // nhân tốc độ lúc bắt đầu trượt
  slideMinSpeed: 5.2,
  wallRunTime: 1.5,
  wallRunGravity: 4.5,
  wallRunMinSpeed: 5,
  wallRunCooldown: 0.45,
  wallJumpOut: 6.6,       // lực bật khỏi tường (ngang / dọc)
  wallJumpUp: 7.6,
  capsuleR: 0.42,
  standH: 1.8,
  crouchH: 0.92,
  eyeStand: 1.62,
  eyeCrouch: 0.84,
  stepUp: 0.35,           // bậc thấp tự bước lên
  fallY: -13,             // rơi dưới mức này = DEAD (fallback volume)
};

export const VR_ENERGY = {
  start: 100,
  max: 100,
  sprintDrain: 12,        // %/s khi sprint
  regen: 6,               // %/s khi không sprint
  regenDelay: 0.8,
  shardGain: 18,
};

/** Độ khó: chu kỳ laser + penalty khi rơi/chạm laser. */
export const VR_DIFFICULTY = {
  easy: { laserScale: 1.35, penalty: 2 },
  normal: { laserScale: 1, penalty: 3 },
  hard: { laserScale: 0.78, penalty: 5 },
};

export const VR_QUALITY_SCALE = { low: 0.62, medium: 0.82, high: 1 };

export const VR_TOTAL_CHECKPOINTS = 8; // 7 cổng + đích

export const VR_SETTINGS_KEY = "void-runner-settings";
export const VR_BEST_TIME_KEY = "void-runner-best-time";
