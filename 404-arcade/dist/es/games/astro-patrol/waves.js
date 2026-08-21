/**
 * waves.js — định nghĩa 5 wave thường + boss cho Astro Patrol 404.
 * Mỗi wave: danh sách spawn {type, delay, x} (x theo tỉ lệ 0..1 bề
 * ngang) + số asteroid trôi nền. TEST mode rút ngắn còn 2 địch/wave.
 */

export const WAVE_DEFS = [
  {
    id: 1,
    name: "TRINH SÁT",
    asteroids: 2,
    spawns: [
      { type: "scout", delay: 0.8, x: 0.25 },
      { type: "scout", delay: 0.5, x: 0.75 },
      { type: "scout", delay: 0.9, x: 0.4 },
      { type: "scout", delay: 0.5, x: 0.6 },
      { type: "scout", delay: 0.9, x: 0.2 },
      { type: "scout", delay: 0.5, x: 0.8 },
    ],
  },
  {
    id: 2,
    name: "HỎA LỰC",
    asteroids: 2,
    spawns: [
      { type: "scout", delay: 0.7, x: 0.3 },
      { type: "scout", delay: 0.4, x: 0.7 },
      { type: "shooter", delay: 1.1, x: 0.5 },
      { type: "scout", delay: 0.8, x: 0.2 },
      { type: "scout", delay: 0.4, x: 0.8 },
      { type: "shooter", delay: 1.2, x: 0.35 },
      { type: "scout", delay: 0.7, x: 0.6 },
      { type: "scout", delay: 0.4, x: 0.45 },
    ],
  },
  {
    id: 3,
    name: "VÀNH ĐAI ĐÁ",
    asteroids: 5,
    spawns: [
      { type: "shooter", delay: 1.0, x: 0.25 },
      { type: "shooter", delay: 1.0, x: 0.75 },
      { type: "scout", delay: 0.6, x: 0.5 },
      { type: "shooter", delay: 1.1, x: 0.4 },
      { type: "scout", delay: 0.5, x: 0.15 },
      { type: "shooter", delay: 1.1, x: 0.6 },
      { type: "scout", delay: 0.5, x: 0.85 },
      { type: "shooter", delay: 1.2, x: 0.5 },
    ],
  },
  {
    id: 4,
    name: "ĐỘT KÍCH",
    asteroids: 3,
    spawns: [
      { type: "charger", delay: 1.0, x: 0.3 },
      { type: "charger", delay: 0.8, x: 0.7 },
      { type: "scout", delay: 0.6, x: 0.5 },
      { type: "charger", delay: 0.9, x: 0.2 },
      { type: "scout", delay: 0.5, x: 0.8 },
      { type: "charger", delay: 0.9, x: 0.55 },
      { type: "charger", delay: 0.9, x: 0.4 },
      { type: "scout", delay: 0.5, x: 0.65 },
      { type: "charger", delay: 0.9, x: 0.75 },
    ],
  },
  {
    id: 5,
    name: "TỔNG LỰC",
    asteroids: 4,
    spawns: [
      { type: "shooter", delay: 0.9, x: 0.2 },
      { type: "scout", delay: 0.5, x: 0.5 },
      { type: "charger", delay: 0.8, x: 0.8 },
      { type: "scout", delay: 0.4, x: 0.35 },
      { type: "shooter", delay: 1.0, x: 0.65 },
      { type: "charger", delay: 0.8, x: 0.25 },
      { type: "scout", delay: 0.4, x: 0.75 },
      { type: "shooter", delay: 1.0, x: 0.5 },
      { type: "charger", delay: 0.8, x: 0.6 },
      { type: "scout", delay: 0.4, x: 0.15 },
      { type: "scout", delay: 0.4, x: 0.85 },
      { type: "charger", delay: 0.8, x: 0.45 },
    ],
  },
];

export const BOSS_DEF = {
  name: "THIẾT GIÁP 404",
  hp: 850,
  testHp: 130,
  radius: 66,
  phase2At: 0.5, // chuyển phase khi HP ≤ 50%
};

export const ENEMY_STATS = {
  scout: { hp: 1, r: 17, score: 50, speed: 120 },
  shooter: { hp: 3, r: 20, score: 120, speed: 70 },
  charger: { hp: 2, r: 18, score: 90, speed: 100 },
};

/** Rút gọn wave cho TEST mode (2 địch đầu tiên, delay ngắn). */
export function testWaves() {
  return WAVE_DEFS.map((w) => ({
    ...w,
    asteroids: Math.min(w.asteroids, 1),
    spawns: w.spawns.slice(0, 2).map((s) => ({ ...s, delay: 0.25 })),
  }));
}
