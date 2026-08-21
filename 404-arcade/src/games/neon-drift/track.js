/**
 * track.js — đường đua Neon Drift 404: polyline khép kín được làm mượt
 * bằng Catmull-Rom, lấy mẫu dày (~7px) kèm tiếp tuyến/pháp tuyến.
 * Cung cấp: điểm mẫu, 8 checkpoint đúng thứ tự, pickup năng lượng,
 * đường path Path2D cache sẵn (mặt đường, 2 mép neon, vạch giữa),
 * decor thành phố sinh theo seed, và truy vấn "điểm gần nhất".
 */

import { seededRand } from "../../core/utils.js";

export const TRACK_WIDTH = 150;
export const HALF_W = TRACK_WIDTH / 2;

/* Điểm điều khiển vòng đua (khép kín, theo chiều kim đồng hồ) */
const CONTROL = [
  [430, 330], [830, 205], [1360, 190], [1840, 300],
  [2085, 640], [2010, 1010], [1630, 1235], [1170, 1265],
  [890, 1070], [700, 850], [470, 800], [300, 1010],
  [195, 760], [240, 500],
];

function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return [
    0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
    0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
  ];
}

export function buildTrack() {
  const n = CONTROL.length;
  const pts = [];
  // Lấy mẫu Catmull-Rom khép kín
  for (let i = 0; i < n; i++) {
    const p0 = CONTROL[(i - 1 + n) % n];
    const p1 = CONTROL[i];
    const p2 = CONTROL[(i + 1) % n];
    const p3 = CONTROL[(i + 2) % n];
    const segLen = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const steps = Math.max(6, Math.round(segLen / 7));
    for (let s = 0; s < steps; s++) {
      pts.push(catmull(p0, p1, p2, p3, s / steps));
    }
  }

  const count = pts.length;
  const tangents = new Array(count);
  const normals = new Array(count);
  let length = 0;
  for (let i = 0; i < count; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % count];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const d = Math.hypot(dx, dy) || 1;
    tangents[i] = [dx / d, dy / d];
    normals[i] = [-dy / d, dx / d];
    length += d;
  }
  const avgStep = length / count;

  /* 8 checkpoint cách đều theo chu vi — cp cuối (idx 7) là vạch ĐÍCH */
  const checkpoints = [];
  for (let k = 1; k <= 8; k++) {
    const si = Math.round((count * k) / 8) % count;
    checkpoints.push({ si, order: k });
  }

  /* Pickup năng lượng rải trên đường (lệch tâm ngẫu nhiên theo seed) */
  const rand = seededRand(404);
  const pickups = [];
  for (let k = 0; k < 12; k++) {
    const si = Math.round((count * (k + 0.5)) / 12) % count;
    const off = (rand() - 0.5) * (TRACK_WIDTH - 70);
    pickups.push({
      x: pts[si][0] + normals[si][0] * off,
      y: pts[si][1] + normals[si][1] * off,
      taken: false,
      pulse: rand() * 6,
    });
  }

  /* Path2D cache: mặt đường, mép trái/phải, vạch giữa */
  const road = new Path2D();
  road.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < count; i++) road.lineTo(pts[i][0], pts[i][1]);
  road.closePath();

  const edgeL = new Path2D();
  const edgeR = new Path2D();
  for (let i = 0; i <= count; i++) {
    const j = i % count;
    const lx = pts[j][0] + normals[j][0] * HALF_W;
    const ly = pts[j][1] + normals[j][1] * HALF_W;
    const rx = pts[j][0] - normals[j][0] * HALF_W;
    const ry = pts[j][1] - normals[j][1] * HALF_W;
    if (i === 0) {
      edgeL.moveTo(lx, ly);
      edgeR.moveTo(rx, ry);
    } else {
      edgeL.lineTo(lx, ly);
      edgeR.lineTo(rx, ry);
    }
  }

  /* Mũi tên chỉ hướng trên mặt đường (mỗi ~28 mẫu một mũi tên) */
  const arrows = [];
  for (let i = 0; i < count; i += 28) {
    arrows.push({ x: pts[i][0], y: pts[i][1], angle: Math.atan2(tangents[i][1], tangents[i][0]) });
  }

  /* Decor thành phố: khối nhà neon ngoài hành lang đường đua.
     Vùng sinh nhà rộng hơn bbox đường đua để camera nhìn đâu cũng có phố. */
  const decor = [];
  const drand = seededRand(777);
  const minX = 40;
  const maxX = 2300;
  const minY = 20;
  const maxY = 1450;
  const PAD_OUT = 420;
  const dx0 = minX - PAD_OUT;
  const dy0 = minY - PAD_OUT;
  const dx1 = maxX + PAD_OUT;
  const dy1 = maxY + PAD_OUT;
  let attempts = 0;
  while (decor.length < 150 && attempts < 1600) {
    attempts++;
    const bw = 70 + drand() * 150;
    const bh = 70 + drand() * 150;
    const x = dx0 + drand() * (dx1 - dx0 - bw);
    const y = dy0 + drand() * (dy1 - dy0 - bh);
    const cx = x + bw / 2;
    const cy = y + bh / 2;
    let clear = true;
    for (let i = 0; i < count; i += 4) {
      const dx = cx - pts[i][0];
      const dy = cy - pts[i][1];
      if (dx * dx + dy * dy < (HALF_W + 78 + Math.max(bw, bh) / 2) ** 2) {
        clear = false;
        break;
      }
    }
    if (!clear) continue;
    // không cho nhà chồng lên nhau quá nhiều
    let overlap = false;
    for (const o of decor) {
      if (x < o.x + o.w + 14 && x + bw + 14 > o.x && y < o.y + o.h + 14 && y + bh + 14 > o.y) {
        overlap = true;
        break;
      }
    }
    if (overlap) continue;
    const hues = ["#ff2ee6", "#20e3ff", "#9a5cff", "#3b7bff"];
    decor.push({
      x, y, w: bw, h: bh,
      color: hues[Math.floor(drand() * hues.length)],
      windows: Math.floor(2 + drand() * 4),
      vertical: drand() > 0.5,
    });
  }
  const decorBounds = { x0: dx0, y0: dy0, x1: dx1, y1: dy1 };

  return {
    pts,
    tangents,
    normals,
    count,
    length,
    avgStep,
    checkpoints,
    pickups,
    paths: { road, edgeL, edgeR },
    arrows,
    decor,
    decorBounds,
    startSi: 0,
    bbox: { minX, minY, maxX, maxY },
  };
}

/** Tìm mẫu gần nhất quanh gợi ý hintIdx (cửa sổ ±40) — O(1) mỗi bước. */
export function nearestSample(track, x, y, hintIdx) {
  const { pts, count } = track;
  let best = hintIdx;
  let bestD = Infinity;
  for (let k = -40; k <= 40; k++) {
    const i = (hintIdx + k + count) % count;
    const dx = x - pts[i][0];
    const dy = y - pts[i][1];
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return { idx: best, dist: Math.sqrt(bestD) };
}
