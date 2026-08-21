/**
 * data.js — dữ liệu Cyber Defense: 2 tuyến đường cố định (nhập từ mép
 * trái như ảnh reference, hợp nhất trước khi tới CORE), 14 pad xây tháp,
 * 5 loại tháp (3 mở sẵn + 2 khóa theo wave như 2 ô khóa trong ảnh),
 * 4 loại enemy và 8 wave khai báo thuần data.
 */

export const WORLD_W = 1280;
export const WORLD_H = 720;
export const CORE = { x: 1090, y: 300, hp: 20 };

/* Đuôi chung sau điểm hợp nhất (860,340) → CORE */
const TAIL = [
  [860, 340], [1000, 340], [1000, 300], [1062, 300],
];

const LANE_A = [
  [-40, 140], [160, 140], [160, 320], [390, 320], [390, 150],
  [640, 150], [640, 340], [860, 340],
].concat(TAIL.slice(1));

const LANE_B = [
  [-40, 560], [200, 560], [200, 430], [460, 430], [460, 600],
  [700, 600], [700, 430], [860, 430],
].concat(TAIL);

/** Lấy mẫu polyline mỗi ~4px, trả về { pts, step, totalLen, nodes }. */
function samplePath(nodes) {
  const pts = [];
  let totalLen = 0;
  for (let i = 0; i < nodes.length - 1; i++) {
    const [x0, y0] = nodes[i];
    const [x1, y1] = nodes[i + 1];
    const len = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.round(len / 4));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      pts.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]);
    }
    totalLen += len;
  }
  pts.push(nodes[nodes.length - 1].slice());
  return { pts, step: totalLen / (pts.length - 1), totalLen, nodes };
}

export function buildPaths() {
  return { A: samplePath(LANE_A), B: samplePath(LANE_B) };
}

/** Vị trí trên path theo quãng đường đã đi. */
export function pointAt(path, dist) {
  const i = Math.max(0, Math.min(path.pts.length - 1, Math.floor(dist / path.step)));
  return path.pts[i];
}

export const PADS = [
  { id: 0, x: 90, y: 240 },
  { id: 1, x: 280, y: 230 },
  { id: 2, x: 390, y: 60 },
  { id: 3, x: 520, y: 240 },
  { id: 4, x: 760, y: 250 },
  { id: 5, x: 950, y: 180 },
  { id: 6, x: 1080, y: 180 },
  { id: 7, x: 65, y: 450 },
  { id: 8, x: 285, y: 505 },
  { id: 9, x: 530, y: 520 },
  { id: 10, x: 620, y: 470 },
  { id: 11, x: 770, y: 510 },
  { id: 12, x: 950, y: 430 },
  { id: 13, x: 1080, y: 450 },
];

export const PAD_R = 30;

/* ---------------- Tháp ---------------- */

export const TOWER_ORDER = ["rapid", "slow", "blast", "sniper", "nova"];

export const TOWERS = {
  rapid: {
    name: "THÁP TIA NHANH",
    desc: "Bắn nhanh, sát thương đơn mục tiêu.",
    color: "#20e3ff",
    cost: 100,
    unlockWave: 1,
    levels: [
      { dmg: 11, rate: 3.2, range: 150 },
      { dmg: 17, rate: 3.8, range: 162, cost: 80 },
      { dmg: 25, rate: 4.6, range: 176, cost: 130 },
    ],
  },
  slow: {
    name: "THÁP GIẢM TỐC",
    desc: "Phóng điện làm chậm, không cộng dồn vô hạn.",
    color: "#9a5cff",
    cost: 140,
    unlockWave: 1,
    levels: [
      { dmg: 6, rate: 1.15, range: 132, slow: 0.55, slowDur: 1.4 },
      { dmg: 9, rate: 1.3, range: 142, slow: 0.46, slowDur: 1.7, cost: 110 },
      { dmg: 13, rate: 1.45, range: 154, slow: 0.38, slowDur: 2.0, cost: 150 },
    ],
  },
  blast: {
    name: "THÁP NỔ VÙNG",
    desc: "Bắn chậm, nổ sát thương diện rộng.",
    color: "#ff4fd8",
    cost: 160,
    unlockWave: 1,
    levels: [
      { dmg: 26, rate: 0.75, range: 126, aoe: 62 },
      { dmg: 38, rate: 0.82, range: 134, aoe: 74, cost: 130 },
      { dmg: 54, rate: 0.9, range: 142, aoe: 86, cost: 180 },
    ],
  },
  sniper: {
    name: "THÁP XUYÊN TÂM",
    desc: "Tầm cực xa, một phát sát thương lớn.",
    color: "#ffd23f",
    cost: 220,
    unlockWave: 6,
    levels: [
      { dmg: 62, rate: 0.5, range: 300 },
      { dmg: 92, rate: 0.56, range: 330, cost: 160 },
      { dmg: 132, rate: 0.62, range: 364, cost: 220 },
    ],
  },
  nova: {
    name: "THÁP XUNG KÍCH",
    desc: "Xung điện tỏa tròn trúng mọi bot trong tầm.",
    color: "#a8ff3e",
    cost: 260,
    unlockWave: 8,
    levels: [
      { dmg: 18, rate: 0.6, range: 140, aoe: 140, slow: 0.75, slowDur: 0.6 },
      { dmg: 27, rate: 0.66, range: 150, aoe: 150, slow: 0.68, slowDur: 0.8, cost: 180 },
      { dmg: 39, rate: 0.72, range: 162, aoe: 162, slow: 0.6, slowDur: 1.0, cost: 240 },
    ],
  },
};

export const SELL_RATIO = 0.7;

/* ---------------- Enemy ---------------- */

export const ENEMIES = {
  basic: { hp: 52, speed: 62, reward: 9, coreDmg: 1, score: 60, r: 13 },
  fast: { hp: 30, speed: 108, reward: 8, coreDmg: 1, score: 70, r: 11 },
  tank: { hp: 200, speed: 36, reward: 22, coreDmg: 2, score: 200, r: 17 },
  shield: { hp: 82, shield: 80, speed: 55, reward: 16, coreDmg: 1, score: 150, r: 14 },
};

/** Máu tăng dần theo wave. */
export const waveHpScale = (wave) => 1 + (wave - 1) * 0.17;

/* ---------------- 8 wave data-driven ---------------- */

export const WAVES = [
  {
    id: 1,
    groups: [{ type: "basic", count: 6, intervalMs: 950, lane: "alt" }],
    delayBetweenGroupsMs: 1500,
  },
  {
    id: 2,
    groups: [
      { type: "basic", count: 8, intervalMs: 750, lane: "alt" },
      { type: "fast", count: 3, intervalMs: 520, lane: "A" },
    ],
    delayBetweenGroupsMs: 1600,
  },
  {
    id: 3,
    groups: [
      { type: "basic", count: 6, intervalMs: 700, lane: "B" },
      { type: "fast", count: 6, intervalMs: 480, lane: "alt" },
    ],
    delayBetweenGroupsMs: 1500,
  },
  {
    id: 4,
    groups: [
      { type: "shield", count: 4, intervalMs: 900, lane: "A" },
      { type: "basic", count: 8, intervalMs: 650, lane: "alt" },
      { type: "fast", count: 4, intervalMs: 450, lane: "B" },
    ],
    delayBetweenGroupsMs: 1500,
  },
  {
    id: 5,
    groups: [
      { type: "tank", count: 2, intervalMs: 1400, lane: "alt" },
      { type: "basic", count: 10, intervalMs: 560, lane: "alt" },
      { type: "fast", count: 6, intervalMs: 420, lane: "A" },
    ],
    delayBetweenGroupsMs: 1700,
  },
  {
    id: 6,
    groups: [
      { type: "shield", count: 6, intervalMs: 800, lane: "alt" },
      { type: "fast", count: 10, intervalMs: 380, lane: "alt" },
    ],
    delayBetweenGroupsMs: 1500,
  },
  {
    id: 7,
    groups: [
      { type: "tank", count: 4, intervalMs: 1200, lane: "alt" },
      { type: "shield", count: 6, intervalMs: 750, lane: "B" },
      { type: "basic", count: 10, intervalMs: 520, lane: "alt" },
    ],
    delayBetweenGroupsMs: 1600,
  },
  {
    id: 8,
    groups: [
      { type: "tank", count: 6, intervalMs: 1050, lane: "alt" },
      { type: "fast", count: 12, intervalMs: 330, lane: "alt" },
      { type: "shield", count: 8, intervalMs: 620, lane: "alt" },
    ],
    delayBetweenGroupsMs: 1500,
  },
];

export const START_ENERGY = 400;
export const WAVE_CLEAR_BONUS = 35;
export const PREP_TIME = 6;
