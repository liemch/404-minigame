/**
 * data.js — dữ liệu Rogue Arena: kích thước đấu trường, 3 loại enemy +
 * boss, đường cong spawn tăng dần, và bộ 8 nâng cấp theo schema plan
 * { id, name, description, maxLevel, weight, apply }.
 */

export const ARENA_W = 1360;
export const ARENA_H = 760;
export const WALL = 26; // bề dày tường
export const MATCH_TIME = 180; // 3 phút
export const BOSS_AT = 150; // boss xuất hiện ở phút thứ 3 (còn 0:30)

export const PLAYER_BASE = {
  r: 14,
  maxHp: 100,
  speed: 195,
  fireRate: 2.5,
  damage: 13,
  projectiles: 1,
  pierce: 0,
  magnet: 135,
  orbit: 0,
  boltSpeed: 540,
};

export const ENEMY_TYPES = {
  chaser: { hp: 26, speed: 96, r: 15, dmg: 12, xp: 2, score: 10, from: 0 },
  shooter: { hp: 42, speed: 68, r: 15, dmg: 8, xp: 3, score: 15, from: 20, shootEvery: 2.7, boltSpeed: 225, boltDmg: 10 },
  tank: { hp: 150, speed: 40, r: 22, dmg: 22, xp: 5, score: 25, from: 35 },
  boss: { hp: 1500, speed: 52, r: 40, dmg: 30, xp: 25, score: 1000, from: 9999, shootEvery: 2.6, boltSpeed: 210, boltDmg: 14, ring: 10 },
};

/** Máu enemy tăng theo thời gian sống sót. */
export const hpScale = (t) => 1 + (t / 60) * 0.45;

/** Khoảng cách giữa 2 lần spawn (giảm dần) + số lượng mỗi đợt. */
export function spawnCurve(t) {
  const k = Math.min(1, t / MATCH_TIME);
  return {
    interval: 1.15 - k * 0.68, // 1.15s → 0.47s
    batch: 1 + Math.floor(k * 1.9), // 1 → 2 (cuối trận thi thoảng 3)
  };
}

export const MAX_ENEMIES = 70;

/** Tỉ trọng loại enemy theo thời gian. */
export function pickEnemyType(t, roll) {
  const opts = [];
  opts.push(["chaser", 62]);
  if (t >= ENEMY_TYPES.shooter.from) opts.push(["shooter", 20]);
  if (t >= ENEMY_TYPES.tank.from) opts.push(["tank", 16]);
  const total = opts.reduce((s, o) => s + o[1], 0);
  let x = roll * total;
  for (const [type, w] of opts) {
    x -= w;
    if (x <= 0) return type;
  }
  return "chaser";
}

/** XP cần cho cấp tiếp theo. */
export const xpNeed = (level) => 8 + (level - 1) * 5;

/* ---------------- 8 nâng cấp (schema theo plan) ---------------- */

export const UPGRADES = [
  {
    id: "damage",
    name: "HỎA LỰC",
    description: "Tăng 25% sát thương tia điện.",
    maxLevel: 5,
    weight: 10,
    tone: "pink",
    apply: (p) => {
      p.damage = Math.round(p.damage * 1.25);
    },
  },
  {
    id: "firerate",
    name: "NẠP NHANH",
    description: "Tăng 20% tốc độ bắn.",
    maxLevel: 5,
    weight: 10,
    tone: "cyan",
    apply: (p) => {
      p.fireRate *= 1.2;
    },
  },
  {
    id: "multishot",
    name: "TIA CHỚP",
    description: "Tăng 1 tia điện.",
    maxLevel: 3,
    weight: 7,
    tone: "cyan",
    apply: (p) => {
      p.projectiles += 1;
    },
  },
  {
    id: "pierce",
    name: "LAN TỎA",
    description: "Đạn xuyên thêm 1 mục tiêu.",
    maxLevel: 3,
    weight: 7,
    tone: "violet",
    apply: (p) => {
      p.pierce += 1;
    },
  },
  {
    id: "speed",
    name: "TỐC ĐỘ",
    description: "Tăng 10% tốc độ di chuyển.",
    maxLevel: 4,
    weight: 8,
    tone: "lime",
    apply: (p) => {
      p.speed *= 1.1;
    },
  },
  {
    id: "maxhp",
    name: "GIÁP LÕI",
    description: "+25 HP tối đa và hồi 25 HP.",
    maxLevel: 4,
    weight: 8,
    tone: "green",
    apply: (p) => {
      p.maxHp += 25;
      p.hp = Math.min(p.maxHp, p.hp + 25);
    },
  },
  {
    id: "magnet",
    name: "NAM CHÂM",
    description: "Hút mảnh XP xa hơn 40%.",
    maxLevel: 3,
    weight: 6,
    tone: "gold",
    apply: (p) => {
      p.magnet *= 1.4;
    },
  },
  {
    id: "orbit",
    name: "VỆ TINH",
    description: "Thêm 1 quả cầu năng lượng quay quanh bảo vệ.",
    maxLevel: 3,
    weight: 6,
    tone: "violet",
    apply: (p) => {
      p.orbit += 1;
    },
  },
];

/** Lựa chọn dự phòng khi mọi nâng cấp đã max. */
export const REPAIR_CHOICE = {
  id: "repair",
  name: "SỬA CHỮA",
  description: "Hồi 40 HP ngay lập tức.",
  maxLevel: Infinity,
  weight: 1,
  tone: "green",
  apply: (p) => {
    p.hp = Math.min(p.maxHp, p.hp + 40);
  },
};
