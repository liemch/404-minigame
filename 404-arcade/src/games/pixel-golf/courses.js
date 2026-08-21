/**
 * courses.js — 9 hố Pixel Golf 404 (module JS thuần).
 * poly: viền sân (đa giác kín, tường phản xạ) · walls: tường trong
 * sand: hố cát tròn · bumpers: trụ bật · gates: cổng trượt (thanh bar
 * trượt qua lại giữa 2 mốc) · portals: cặp cổng không gian ·
 * wind: lực gió (chỉ hố nâng cao) · tee/hole: điểm phát / lỗ.
 * Thế giới mỗi hố 960×600.
 */

export const WORLD_W = 960;
export const WORLD_H = 600;

export const COURSES = [
  {
    id: 1,
    name: "SÂN TẬP",
    par: 2,
    poly: [[70, 150], [890, 150], [890, 450], [70, 450]],
    tee: { x: 170, y: 300 },
    hole: { x: 790, y: 300 },
  },
  {
    id: 2,
    name: "GÓC CUA",
    par: 3,
    poly: [[70, 280], [600, 280], [600, 110], [890, 110], [890, 520], [70, 520]],
    tee: { x: 160, y: 400 },
    hole: { x: 760, y: 190 },
  },
  {
    id: 3,
    name: "BẪY CÁT",
    par: 3,
    poly: [[70, 140], [890, 140], [890, 460], [70, 460]],
    sand: [
      { x: 480, y: 300, r: 74 },
      { x: 420, y: 250, r: 48 },
      { x: 545, y: 352, r: 52 },
    ],
    tee: { x: 160, y: 300 },
    hole: { x: 800, y: 300 },
  },
  {
    id: 4,
    name: "MÁY BẮN",
    par: 3,
    poly: [[70, 120], [890, 120], [890, 480], [70, 480]],
    bumpers: [
      { x: 480, y: 220, r: 26 },
      { x: 480, y: 380, r: 26 },
      { x: 330, y: 300, r: 22 },
      { x: 630, y: 300, r: 22 },
    ],
    tee: { x: 160, y: 300 },
    hole: { x: 800, y: 300 },
  },
  {
    id: 5,
    name: "CỔNG TRƯỢT",
    par: 3,
    poly: [[70, 140], [890, 140], [890, 460], [70, 460]],
    walls: [
      [500, 140, 500, 240],
      [500, 360, 500, 460],
    ],
    gates: [{ x1: 500, y1: 240, x2: 500, y2: 360, bar: 64, period: 2.6, phase: 0 }],
    tee: { x: 160, y: 300 },
    hole: { x: 790, y: 300 },
  },
  {
    id: 6,
    name: "SÂN 404",
    par: 4,
    poly: [[70, 110], [890, 110], [890, 500], [70, 500]],
    walls: [[520, 110, 520, 360]],
    gates: [{ x1: 520, y1: 360, x2: 520, y2: 500, bar: 70, period: 2.8, phase: 0.6 }],
    sand: [
      { x: 230, y: 400, r: 58 },
      { x: 285, y: 432, r: 40 },
    ],
    bumpers: [{ x: 300, y: 200, r: 24 }],
    portals: [{ a: { x: 400, y: 180 }, b: { x: 660, y: 180 } }],
    tee: { x: 150, y: 440 },
    hole: { x: 820, y: 160 },
  },
  {
    id: 7,
    name: "GIÓ THOẢNG",
    par: 3,
    poly: [[70, 150], [890, 150], [890, 450], [70, 450]],
    wind: { x: 0, y: 44 },
    sand: [{ x: 700, y: 380, r: 55 }],
    tee: { x: 160, y: 300 },
    hole: { x: 780, y: 240 },
  },
  {
    id: 8,
    name: "MÊ CUNG",
    par: 4,
    poly: [[70, 110], [890, 110], [890, 490], [70, 490]],
    walls: [
      [340, 110, 340, 370],
      [620, 230, 620, 490],
    ],
    bumpers: [{ x: 480, y: 300, r: 22 }],
    tee: { x: 150, y: 420 },
    hole: { x: 810, y: 170 },
  },
  {
    id: 9,
    name: "CHUNG KẾT",
    par: 5,
    poly: [[70, 100], [890, 100], [890, 520], [430, 520], [430, 330], [70, 330]],
    walls: [[520, 100, 520, 260]],
    gates: [{ x1: 520, y1: 260, x2: 520, y2: 330, bar: 40, period: 2.2, phase: 0 }],
    portals: [{ a: { x: 250, y: 160 }, b: { x: 840, y: 160 } }],
    wind: { x: -38, y: 0 },
    sand: [{ x: 700, y: 430, r: 50 }],
    tee: { x: 150, y: 220 },
    hole: { x: 620, y: 450 },
  },
];
