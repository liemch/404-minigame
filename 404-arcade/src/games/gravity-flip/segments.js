/**
 * segments.js — thư viện pattern + generator cho Gravity Flip 404.
 *
 * Mỗi pattern khai báo safeEntry/safeExit (sàn/trần) — generator CHỈ ghép
 * pattern có entry khớp exit của pattern trước, nên không bao giờ sinh
 * chuỗi bất khả thi. Khoảng cách giữa các hazard được thiết kế với biên
 * an toàn ≥350px (quãng đường rơi ngang tối đa khi đảo trọng lực ở tốc
 * độ trần 560px/s là ~340px).
 *
 * Tọa độ x tương đối theo đầu segment; y tuyệt đối trong hành lang
 * (trần 150 → sàn 750). spikes = dải gai {side, x, w}; platform là xe
 * đệm từ (đứng yên) người chơi đáp lên được từ cả hai phía trọng lực.
 */

/** Hành lang thế giới (px). */
export const WORLD = { h: 900, ceil: 150, floor: 750 };

export const PATTERNS = [
  {
    id: "shard-floor",
    len: 1100,
    entry: "floor",
    exit: "floor",
    weight: 3,
    spikes: [],
    shards: [[250, 645], [350, 645], [450, 645], [550, 645], [650, 645], [750, 645], [850, 645]],
    platforms: [],
  },
  {
    id: "shard-ceil",
    len: 1000,
    entry: "ceiling",
    exit: "ceiling",
    weight: 3,
    spikes: [],
    shards: [[250, 255], [350, 255], [450, 255], [550, 255], [650, 255], [750, 255]],
    platforms: [],
  },
  {
    id: "fence-floor",
    len: 1400,
    entry: "floor",
    exit: "ceiling",
    weight: 3,
    spikes: [
      { side: "floor", x: 600, w: 160 },
      { side: "floor", x: 1050, w: 160 },
    ],
    shards: [[380, 560], [460, 460], [540, 360], [640, 280], [760, 255]],
    platforms: [],
  },
  {
    id: "fence-ceil",
    len: 1400,
    entry: "ceiling",
    exit: "floor",
    weight: 3,
    spikes: [
      { side: "ceiling", x: 600, w: 160 },
      { side: "ceiling", x: 1050, w: 160 },
    ],
    shards: [[380, 340], [460, 440], [540, 540], [640, 620], [760, 645]],
    platforms: [],
  },
  {
    id: "bus-floor",
    len: 1600,
    entry: "floor",
    exit: "floor",
    weight: 3,
    spikes: [{ side: "floor", x: 750, w: 300 }],
    shards: [[780, 430], [870, 430], [960, 430], [1050, 430]],
    platforms: [{ x: 700, w: 400, y: 470 }],
  },
  {
    id: "bed-floor",
    len: 1500,
    entry: "ceiling",
    exit: "ceiling",
    weight: 2,
    spikes: [
      { side: "floor", x: 300, w: 500 },
      { side: "floor", x: 1000, w: 200 },
    ],
    shards: [[350, 260], [440, 260], [530, 260], [620, 260], [710, 260], [800, 260]],
    platforms: [],
  },
  {
    id: "zigzag",
    len: 2000,
    entry: "floor",
    exit: "floor",
    weight: 3,
    spikes: [
      { side: "floor", x: 450, w: 140 },
      { side: "ceiling", x: 1300, w: 140 },
    ],
    shards: [[300, 560], [400, 420], [500, 300], [1150, 340], [1250, 460], [1350, 580], [1600, 645]],
    platforms: [],
  },
  {
    id: "bus-ceil",
    len: 1800,
    entry: "ceiling",
    exit: "floor",
    weight: 2,
    spikes: [
      { side: "ceiling", x: 500, w: 700 },
      { side: "ceiling", x: 1500, w: 120 },
    ],
    shards: [[300, 320], [380, 420], [460, 500], [560, 430], [660, 430], [760, 430]],
    platforms: [{ x: 520, w: 360, y: 500 }],
  },
  {
    id: "shield-gift",
    len: 900,
    entry: "floor",
    exit: "floor",
    weight: 1,
    spikes: [],
    shards: [[250, 645], [650, 645]],
    platforms: [],
    shield: [450, 610],
  },
  {
    id: "shield-gift-c",
    len: 900,
    entry: "ceiling",
    exit: "ceiling",
    weight: 1,
    spikes: [],
    shards: [[250, 255], [650, 255]],
    platforms: [],
    shield: [450, 290],
  },
];

/** Đoạn mở đầu trống để người chơi lấy đà. */
export const START_SEGMENT = {
  id: "start",
  len: 800,
  entry: "floor",
  exit: "floor",
  spikes: [],
  shards: [[500, 645], [620, 645]],
  platforms: [],
};

/** Khởi tạo một segment tại startX: chuyển tọa độ tương đối → tuyệt đối. */
export function instantiate(pattern, startX) {
  return {
    id: pattern.id,
    startX,
    endX: startX + pattern.len,
    exit: pattern.exit,
    spikes: pattern.spikes.map((s) => ({ side: s.side, x: startX + s.x, w: s.w })),
    shards: pattern.shards.map(([x, y]) => ({ x: startX + x, y, taken: false, phase: Math.random() * 6.3 })),
    platforms: pattern.platforms.map((p) => ({ x: startX + p.x, w: p.w, y: p.y })),
    shield: pattern.shield
      ? { x: startX + pattern.shield[0], y: pattern.shield[1], taken: false }
      : null,
  };
}

/** Chọn pattern kế tiếp có entry khớp exit hiện tại (weighted random). */
export function nextPattern(exit, rand = Math.random) {
  const pool = PATTERNS.filter((p) => p.entry === exit);
  let total = 0;
  for (const p of pool) total += p.weight;
  let roll = rand() * total;
  for (const p of pool) {
    roll -= p.weight;
    if (roll <= 0) return p;
  }
  return pool[pool.length - 1];
}
