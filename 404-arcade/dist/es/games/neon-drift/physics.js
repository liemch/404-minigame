/**
 * physics.js — mô phỏng xe Neon Drift 404 với FIXED TIMESTEP (1/120s).
 * Xe arcade: lực đẩy theo hướng đầu xe, bám ngang (grip) tách riêng để
 * tạo drift khi giữ Space, nitro tiêu hao theo thời gian, va chạm mép
 * đường trượt dọc tường + giảm tốc, xe cản chạy theo path.
 */

import { nearestSample, HALF_W } from "./track.js";

export const STEP = 1 / 120;

const CAR_R = 15;
const ENGINE = 560;
const BRAKE = 760;
const REVERSE = 180;
const MAX_SPEED = 470;
const NITRO_SPEED = 660;
const NITRO_ACCEL = 1.85;
const NITRO_DRAIN = 30; // %/s
const GRIP_NORMAL = 9.5; // hệ số triệt tiêu vận tốc ngang mỗi giây
const GRIP_DRIFT = 2.35;
const STEER_BASE = 2.35; // rad/s ở tốc độ tối đa

export function createCar(track) {
  const si = track.startSi;
  const [x, y] = track.pts[si];
  const heading = Math.atan2(track.tangents[si][1], track.tangents[si][0]);
  return {
    x, y,
    vx: 0, vy: 0,
    heading,
    steerVisual: 0,
    si,
    trackPos: 0, // tiến độ liên tục (đơn vị: mẫu, tăng dần theo chiều đua)
    nitro: 55,
    nitroActive: false,
    drifting: false,
    driftDir: 0,
    wallContact: false,
    speed: 0,
    lateral: 0,
  };
}

/**
 * Một bước vật lý. inputs: { throttle -1..1, steer -1..1, drift, nitro }.
 * Trả về sự kiện { hardWall, pickup: idx|null, checkpoint: order|null }.
 */
export function stepCar(car, track, inputs, race) {
  const ev = { hardWall: false, wallScrape: false };

  const cos = Math.cos(car.heading);
  const sin = Math.sin(car.heading);
  let vF = car.vx * cos + car.vy * sin; // tốc độ dọc
  let vL = -car.vx * sin + car.vy * cos; // tốc độ ngang

  // Nitro
  car.nitroActive = inputs.nitro && car.nitro > 0.5;
  if (car.nitroActive) car.nitro = Math.max(0, car.nitro - NITRO_DRAIN * STEP);

  // Lực đẩy / phanh
  if (inputs.throttle > 0) {
    vF += ENGINE * inputs.throttle * (car.nitroActive ? NITRO_ACCEL : 1) * STEP;
  } else if (inputs.throttle < 0) {
    if (vF > 20) vF -= BRAKE * STEP;
    else vF = Math.max(-REVERSE, vF - REVERSE * 1.6 * STEP);
  }

  // Cản khí động + cản lăn
  vF *= 1 - 0.32 * STEP;
  const cap = car.nitroActive ? NITRO_SPEED : MAX_SPEED;
  if (vF > cap) vF += (cap - vF) * Math.min(1, STEP * 3.2);

  // Đánh lái: hiệu quả tỉ lệ tốc độ; drift tăng độ gắt
  const speedK = Math.min(1, Math.abs(vF) / MAX_SPEED);
  const steerPow = STEER_BASE * (0.34 + 0.66 * speedK) * (inputs.drift ? 1.4 : 1);
  car.heading += inputs.steer * steerPow * STEP * Math.sign(vF || 1);
  car.steerVisual += (inputs.steer - car.steerVisual) * Math.min(1, STEP * 14);

  // Grip ngang: drift giữ lại nhiều vận tốc ngang hơn
  const grip = inputs.drift ? GRIP_DRIFT : GRIP_NORMAL;
  vL *= Math.exp(-grip * STEP);
  // Khi drift, một phần lực dọc chuyển thành trượt ngang theo hướng lái
  if (inputs.drift && Math.abs(vF) > 140) {
    vL += inputs.steer * 105 * STEP * speedK;
  }

  // Ghép lại vector vận tốc theo hướng MỚI
  const cos2 = Math.cos(car.heading);
  const sin2 = Math.sin(car.heading);
  car.vx = cos2 * vF - sin2 * vL;
  car.vy = sin2 * vF + cos2 * vL;

  car.x += car.vx * STEP;
  car.y += car.vy * STEP;

  // Bám mép đường: đẩy về trong + trượt dọc tường
  const near = nearestSample(track, car.x, car.y, car.si);
  const prevSi = car.si;
  car.si = near.idx;
  const limit = HALF_W - CAR_R;
  car.wallContact = false;
  if (near.dist > limit) {
    const c = track.pts[car.si];
    let nx = (car.x - c[0]) / (near.dist || 1);
    let ny = (car.y - c[1]) / (near.dist || 1);
    car.x = c[0] + nx * limit;
    car.y = c[1] + ny * limit;
    const vn = car.vx * nx + car.vy * ny;
    if (vn > 0) {
      car.vx -= nx * vn * 1.22;
      car.vy -= ny * vn * 1.22;
      if (vn > 190) {
        ev.hardWall = true;
      }
    }
    // ma sát tường nhẹ — vẫn tiến được khi cà mép
    car.vx *= 1 - 0.6 * STEP;
    car.vy *= 1 - 0.6 * STEP;
    car.wallContact = true;
    ev.wallScrape = true;
  }

  // Tiến độ liên tục theo mẫu (xử lý wrap)
  let d = car.si - prevSi;
  if (d > track.count / 2) d -= track.count;
  if (d < -track.count / 2) d += track.count;
  car.trackPos += d;

  car.speed = Math.hypot(car.vx, car.vy);
  car.lateral = vL;
  car.drifting = inputs.drift && Math.abs(vL) > 70 && car.speed > 150;
  car.driftDir = Math.sign(vL);

  void race;
  return ev;
}

/* ---------------- Xe cản (traffic) ---------------- */

export function createTraffic(track, n = 4) {
  const cars = [];
  for (let i = 0; i < n; i++) {
    const si = Math.round(((i + 1) * track.count) / (n + 1.3)) % track.count;
    cars.push({
      pos: si, // chỉ số mẫu (float)
      lane: (i % 2 === 0 ? 1 : -1) * (18 + (i * 9) % 26),
      speed: 120 + (i * 37) % 65, // px/s
      x: 0, y: 0, angle: 0,
      hitCooldown: 0,
    });
  }
  return cars;
}

export function stepTraffic(traffic, track, car) {
  let collided = false;
  for (const t of traffic) {
    t.pos = (t.pos + (t.speed * STEP) / track.avgStep) % track.count;
    const i = Math.floor(t.pos);
    const n = track.normals[i];
    t.x = track.pts[i][0] + n[0] * t.lane;
    t.y = track.pts[i][1] + n[1] * t.lane;
    t.angle = Math.atan2(track.tangents[i][1], track.tangents[i][0]);
    if (t.hitCooldown > 0) t.hitCooldown -= STEP;

    const dx = car.x - t.x;
    const dy = car.y - t.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 30 && t.hitCooldown <= 0) {
      t.hitCooldown = 0.8;
      collided = true;
      const nx = dx / (dist || 1);
      const ny = dy / (dist || 1);
      car.x = t.x + nx * 31;
      car.y = t.y + ny * 31;
      car.vx = car.vx * 0.42 + nx * 130;
      car.vy = car.vy * 0.42 + ny * 130;
    }
  }
  return collided;
}
