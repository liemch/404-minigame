/**
 * table.js — hình học bàn Neon Pinball 404 (tọa độ thế giới 900×1440).
 *
 * Bàn dọc theo ảnh reference: vòm trên cong, lane phóng bi bên phải,
 * 3 bumper sao (cyan / magenta / lime), spinner giữa bàn, 2 slingshot
 * trên + 2 slingshot dưới, 2 cảm biến ramp trên cùng, 3 drop target
 * cạnh phải, 2 flipper dưới với khe drain ở giữa.
 */

export const WORLD = { w: 900, h: 1440 };

export const BALL_R = 14;

/** Vòm trên: polyline từ tường trái vòng qua đỉnh xuống miệng lane phải. */
export const ARC = [
  [40, 340], [58, 225], [118, 132], [208, 70], [318, 34], [450, 24],
  [582, 34], [692, 70], [782, 132], [842, 225], [860, 310],
];

/** Tường tĩnh: [x1, y1, x2, y2, độ nảy]. */
export const WALLS = [
  // tường trái + inlane trái dẫn về flipper
  [40, 340, 40, 1080, 0.5],
  [40, 1080, 232, 1232, 0.45],
  [232, 1232, 300, 1262, 0.45],
  // vách ngăn lane phóng (mặt trong bàn)
  [770, 320, 770, 1080, 0.5],
  // inlane phải dẫn về flipper
  [770, 1080, 578, 1232, 0.45],
  [578, 1232, 510, 1262, 0.45],
  // lòng lane phóng (tường phải ngoài + đáy lane)
  [860, 310, 860, 1180, 0.4],
  [772, 1180, 860, 1180, 0.2],
  [772, 1080, 772, 1180, 0.4],
];

/** Cổng một chiều đỉnh lane: chỉ hoạt động khi bi ĐANG ở trong bàn. */
export const GATE = [770, 320, 806, 246, 0.5];

/** Bumper sao: {x, y, r, tone, star} — impulse + điểm. */
export const BUMPERS = [
  { x: 300, y: 430, r: 42, tone: "#20e3ff" },
  { x: 405, y: 318, r: 44, tone: "#ff2ea6" },
  { x: 512, y: 430, r: 42, tone: "#9dff3e" },
];

/** Spinner giữa bàn (cảm biến tròn — quay khi bi lướt qua). */
export const SPINNER = { x: 405, y: 660, r: 66 };

/**
 * Slingshot: tam giác 3 đỉnh, mặt "face" (2 đỉnh đầu) tạo impulse.
 * verts: [[x,y],[x,y],[x,y]]
 */
export const SLINGS = [
  { verts: [[150, 500], [258, 612], [150, 646]], tone: "#ff2ea6" }, // trên trái
  { verts: [[660, 500], [552, 612], [660, 646]], tone: "#20e3ff" }, // trên phải
  { verts: [[172, 1062], [282, 1192], [172, 1192]], tone: "#ff2ea6" }, // dưới trái
  { verts: [[638, 1062], [528, 1192], [638, 1192]], tone: "#ff2ea6" }, // dưới phải
];

/** Drop target tròn dọc mép phải — hạ đủ nhóm để lên multiplier. */
export const TARGETS = [
  { x: 706, y: 560, r: 15 },
  { x: 726, y: 648, r: 15 },
  { x: 740, y: 738, r: 15 },
];

/** Cảm biến ramp trên cùng (trái tím / phải xanh) — combo khi luân phiên. */
export const RAMPS = [
  { x: 128, y: 400, r: 34, tone: "#9a5cff", id: "L" },
  { x: 688, y: 372, r: 30, tone: "#3b9dff", id: "R" },
];

/** Flipper: pivot, chiều dài, góc nghỉ/đá (radian, y hướng xuống). */
export const FLIPPERS = {
  left: { px: 300, py: 1266, len: 118, rest: 0.5, up: -0.52, dir: 1 },
  right: { px: 510, py: 1266, len: 118, rest: Math.PI - 0.5, up: Math.PI + 0.52, dir: -1 },
};

export const FLIPPER_R = 15; // bán kính capsule flipper

/** Vị trí bi chờ trên plunger + tầng multiplier. */
export const PLUNGER = { x: 816, y: 1120 };
export const MULT_LADDER = [1, 2, 4, 6, 8];

/** Điểm số các phần tử. */
export const SCORE = {
  bumper: 150,
  sling: 50,
  spinnerTick: 10,
  ramp: 500,
  rampCombo: 250,
  target: 200,
  targetGroup: 1000,
  bonusPerEvent: 1, // % bonus mỗi sự kiện ghi điểm
};

export const BALLS_PER_GAME = 3;
export const SAVER_TIME = 8; // giây ball saver sau khi phóng
