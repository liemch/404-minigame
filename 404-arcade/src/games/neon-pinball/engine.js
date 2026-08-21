/**
 * engine.js — physics Neon Pinball 404: fixed timestep 1/480s (4 substep
 * mỗi bước 1/120), va chạm circle-vs-segment / circle-vs-circle liên
 * tục, flipper là capsule quay truyền vận tốc bề mặt, giới hạn tốc độ
 * chống xuyên bi (di chuyển tối đa mỗi substep < bán kính bi), chống
 * kẹt bi bằng nudge tự động. Không dùng random thay physics.
 */

import {
  WORLD, BALL_R, ARC, WALLS, GATE, BUMPERS, SPINNER, SLINGS, TARGETS,
  RAMPS, FLIPPERS, FLIPPER_R, PLUNGER, MULT_LADDER, SCORE, BALLS_PER_GAME,
  SAVER_TIME,
} from "./table.js";

export { WORLD, BALL_R };

const GRAVITY = 1750;
const MAX_SPEED = 1550;
const SUBSTEP = 1 / 480;

export function createSim() {
  return {
    state: "plunger", // plunger | play | over
    ball: { x: PLUNGER.x, y: PLUNGER.y, vx: 0, vy: 0, inLane: true },
    ballNum: 1,
    ballsLeft: BALLS_PER_GAME,
    score: 0,
    multIdx: 0, // chỉ số trong MULT_LADDER
    bonusPct: 0,
    saver: 0,
    time: 0,
    plunger: { power: 0, charging: false },
    flippers: {
      left: { angle: FLIPPERS.left.rest, pressed: false, omega: 0 },
      right: { angle: FLIPPERS.right.rest, pressed: false, omega: 0 },
    },
    targets: TARGETS.map(() => ({ down: false, flash: 0 })),
    bumperFlash: BUMPERS.map(() => 0),
    slingFlash: SLINGS.map(() => 0),
    spinner: { rot: 0, spd: 0, tickAcc: 0 },
    ramp: { last: null, comboT: 0, combo: 0, flash: [0, 0] },
    stuckT: 0,
    trail: [],
    events: [],
  };
}

export function drainEvents(sim) {
  const ev = sim.events;
  sim.events = [];
  return ev;
}

export const mult = (sim) => MULT_LADDER[sim.multIdx];

/** Ghi điểm nhân multiplier + tích bonus. */
function addScore(sim, base, useMult = true) {
  sim.score += base * (useMult ? mult(sim) : 1);
  sim.bonusPct = Math.min(99, sim.bonusPct + SCORE.bonusPerEvent);
}

/* ---------------- điều khiển ---------------- */

export function setFlipper(sim, side, pressed) {
  const f = sim.flippers[side];
  if (pressed && !f.pressed) sim.events.push({ type: "flip", side });
  f.pressed = pressed;
}

export function chargePlunger(sim, on) {
  if (sim.state !== "plunger") return;
  if (on) {
    sim.plunger.charging = true;
  } else if (sim.plunger.charging) {
    // thả → phóng bi theo lực đã tụ
    const p = sim.plunger.power;
    sim.plunger.charging = false;
    sim.plunger.power = 0;
    if (p < 0.08) return; // chạm quá nhanh — bỏ qua
    sim.ball.vy = -(1150 + 1080 * p);
    sim.ball.vx = 0;
    sim.ball.inLane = true;
    sim.state = "play";
    sim.saver = SAVER_TIME;
    sim.events.push({ type: "launch", power: p });
  }
}

/* ---------------- va chạm cơ bản ---------------- */

function collideSegment(ball, ax, ay, bx, by, rEff, e, surf = null) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? ((ball.x - ax) * dx + (ball.y - ay) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + dx * t;
  const cy = ay + dy * t;
  let nx = ball.x - cx;
  let ny = ball.y - cy;
  const d = Math.hypot(nx, ny);
  if (d >= rEff || d < 1e-6) return false;
  nx /= d;
  ny /= d;
  ball.x = cx + nx * rEff;
  ball.y = cy + ny * rEff;
  const svx = surf ? surf.vx : 0;
  const svy = surf ? surf.vy : 0;
  const vn = (ball.vx - svx) * nx + (ball.vy - svy) * ny;
  if (vn < 0) {
    ball.vx -= (1 + e) * vn * nx;
    ball.vy -= (1 + e) * vn * ny;
  }
  return true;
}

function collideCircle(ball, cx, cy, r, e, impulse = 0) {
  let nx = ball.x - cx;
  let ny = ball.y - cy;
  const d = Math.hypot(nx, ny);
  const rEff = r + BALL_R;
  if (d >= rEff || d < 1e-6) return false;
  nx /= d;
  ny /= d;
  ball.x = cx + nx * rEff;
  ball.y = cy + ny * rEff;
  const vn = ball.vx * nx + ball.vy * ny;
  if (vn < 0) {
    ball.vx -= (1 + e) * vn * nx;
    ball.vy -= (1 + e) * vn * ny;
  }
  if (impulse > 0) {
    ball.vx += nx * impulse;
    ball.vy += ny * impulse;
  }
  return true;
}

/* ---------------- flipper ---------------- */

function flipperTip(side, angle) {
  const def = FLIPPERS[side];
  return { x: def.px + Math.cos(angle) * def.len, y: def.py + Math.sin(angle) * def.len };
}

function stepFlipper(sim, side, dt) {
  const def = FLIPPERS[side];
  const f = sim.flippers[side];
  const target = f.pressed ? def.up : def.rest;
  const speed = f.pressed ? 26 : 15; // rad/s — đá lên nhanh, hạ chậm hơn
  const diff = target - f.angle;
  const step = Math.sign(diff) * Math.min(Math.abs(diff), speed * dt);
  f.omega = step / dt;
  f.angle += step;
  if (Math.abs(target - f.angle) < 1e-4) {
    f.angle = target;
    f.omega = 0;
  }
}

function collideFlipper(sim, side) {
  const def = FLIPPERS[side];
  const f = sim.flippers[side];
  const tip = flipperTip(side, f.angle);
  const ball = sim.ball;
  // điểm gần nhất trên đoạn pivot→tip
  const dx = tip.x - def.px;
  const dy = tip.y - def.py;
  const len2 = dx * dx + dy * dy;
  let t = ((ball.x - def.px) * dx + (ball.y - def.py) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = def.px + dx * t;
  const cy = def.py + dy * t;
  // vận tốc bề mặt tại điểm chạm do flipper quay
  const rx = cx - def.px;
  const ry = cy - def.py;
  const surf = { vx: -f.omega * ry, vy: f.omega * rx };
  return collideSegment(ball, def.px, def.py, tip.x, tip.y, BALL_R + FLIPPER_R, 0.35, surf);
}

/* ---------------- một substep vật lý ---------------- */

function subStep(sim, dt) {
  const ball = sim.ball;
  ball.vy += GRAVITY * dt;
  // giới hạn tốc độ chống xuyên
  const sp = Math.hypot(ball.vx, ball.vy);
  if (sp > MAX_SPEED) {
    ball.vx = (ball.vx / sp) * MAX_SPEED;
    ball.vy = (ball.vy / sp) * MAX_SPEED;
  }
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  // tường + vòm
  for (const [x1, y1, x2, y2, e] of WALLS) collideSegment(ball, x1, y1, x2, y2, BALL_R, e);
  for (let i = 0; i < ARC.length - 1; i++) {
    collideSegment(ball, ARC[i][0], ARC[i][1], ARC[i + 1][0], ARC[i + 1][1], BALL_R, 0.5);
  }
  // cổng một chiều đỉnh lane (chỉ khi bi ở trong bàn)
  if (!ball.inLane) collideSegment(ball, GATE[0], GATE[1], GATE[2], GATE[3], BALL_R, GATE[4]);
  // bi rời lane khi vượt qua đỉnh
  if (ball.inLane && ball.y < 285) ball.inLane = false;

  // bumper sao
  BUMPERS.forEach((b, i) => {
    if (collideCircle(ball, b.x, b.y, b.r, 0.6, 330)) {
      sim.bumperFlash[i] = 1;
      addScore(sim, SCORE.bumper);
      sim.events.push({ type: "bumper", i, x: b.x, y: b.y });
    }
  });

  // slingshot: mặt nghiêng tạo impulse, 2 cạnh còn lại là tường
  SLINGS.forEach((s, i) => {
    const [a, b, c] = s.verts;
    const hitFace = collideSegment(ball, a[0], a[1], b[0], b[1], BALL_R, 0.5);
    collideSegment(ball, b[0], b[1], c[0], c[1], BALL_R, 0.4);
    collideSegment(ball, c[0], c[1], a[0], a[1], BALL_R, 0.4);
    if (hitFace) {
      // đẩy bi theo pháp tuyến mặt nghiêng
      let nx = -(b[1] - a[1]);
      let ny = b[0] - a[0];
      const nl = Math.hypot(nx, ny);
      nx /= nl;
      ny /= nl;
      // pháp tuyến hướng về phía bi
      if ((ball.x - a[0]) * nx + (ball.y - a[1]) * ny < 0) {
        nx = -nx;
        ny = -ny;
      }
      ball.vx += nx * 300;
      ball.vy += ny * 300;
      sim.slingFlash[i] = 1;
      addScore(sim, SCORE.sling);
      sim.events.push({ type: "sling", i });
    }
  });

  // drop target (rắn khi chưa hạ)
  TARGETS.forEach((tDef, i) => {
    const t = sim.targets[i];
    if (t.down) return;
    if (collideCircle(ball, tDef.x, tDef.y, tDef.r, 0.5, 120)) {
      t.down = true;
      t.flash = 1;
      addScore(sim, SCORE.target);
      sim.events.push({ type: "target", i });
      if (sim.targets.every((x) => x.down)) {
        // đủ nhóm → lên multiplier + reset
        if (sim.multIdx < MULT_LADDER.length - 1) sim.multIdx += 1;
        addScore(sim, SCORE.targetGroup, false);
        sim.targets.forEach((x) => (x.down = false));
        sim.events.push({ type: "multiplier", value: mult(sim) });
      }
    }
  });

  // flipper (kiểm tra sau cùng để thắng thế các va chạm khác)
  collideFlipper(sim, "left");
  collideFlipper(sim, "right");

  // spinner: cảm biến — quay + tick điểm khi bi lướt qua đủ nhanh
  const sd = Math.hypot(ball.x - SPINNER.x, ball.y - SPINNER.y);
  if (sd < SPINNER.r + BALL_R) {
    const spd2 = Math.hypot(ball.vx, ball.vy);
    sim.spinner.spd = Math.max(sim.spinner.spd, spd2 * 0.02);
    sim.spinner.tickAcc += spd2 * dt;
    if (sim.spinner.tickAcc > 46) {
      sim.spinner.tickAcc = 0;
      addScore(sim, SCORE.spinnerTick);
      sim.events.push({ type: "spin" });
    }
  }

  // ramp sensor
  RAMPS.forEach((r, i) => {
    const d = Math.hypot(ball.x - r.x, ball.y - r.y);
    if (d < r.r + BALL_R && sim.ramp[`cool${r.id}`] <= 0) {
      sim.ramp[`cool${r.id}`] = 1.2;
      sim.ramp.flash[i] = 1;
      let pts = SCORE.ramp;
      if (sim.ramp.last && sim.ramp.last !== r.id && sim.ramp.comboT > 0) {
        sim.ramp.combo += 1;
        pts += SCORE.rampCombo * sim.ramp.combo;
        sim.events.push({ type: "rampCombo", combo: sim.ramp.combo });
      } else {
        sim.ramp.combo = 0;
      }
      sim.ramp.last = r.id;
      sim.ramp.comboT = 5;
      addScore(sim, pts);
      sim.events.push({ type: "ramp", id: r.id });
    }
  });
}

/* ---------------- bước chính 1/120 ---------------- */

export function stepSim(sim, dt) {
  if (sim.state === "over") return;
  sim.time += dt;
  if (sim.saver > 0) sim.saver -= dt;
  if (sim.ramp.comboT > 0) sim.ramp.comboT -= dt;
  sim.ramp.coolL = Math.max(0, (sim.ramp.coolL || 0) - dt);
  sim.ramp.coolR = Math.max(0, (sim.ramp.coolR || 0) - dt);

  stepFlipper(sim, "left", dt);
  stepFlipper(sim, "right", dt);

  // giảm flash hiệu ứng
  for (let i = 0; i < sim.bumperFlash.length; i++) sim.bumperFlash[i] = Math.max(0, sim.bumperFlash[i] - dt * 3);
  for (let i = 0; i < sim.slingFlash.length; i++) sim.slingFlash[i] = Math.max(0, sim.slingFlash[i] - dt * 3);
  for (const t of sim.targets) t.flash = Math.max(0, t.flash - dt * 3);
  sim.ramp.flash[0] = Math.max(0, sim.ramp.flash[0] - dt * 2);
  sim.ramp.flash[1] = Math.max(0, sim.ramp.flash[1] - dt * 2);
  sim.spinner.rot += sim.spinner.spd * dt;
  sim.spinner.spd *= Math.pow(0.35, dt);

  if (sim.state === "plunger") {
    // tụ lực phóng (ping-pong 0→1)
    if (sim.plunger.charging) {
      sim.plunger.power = Math.min(1, sim.plunger.power + dt / 1.1);
    }
    sim.ball.x = PLUNGER.x;
    sim.ball.y = PLUNGER.y - sim.plunger.power * 46;
    sim.ball.vx = 0;
    sim.ball.vy = 0;
    return;
  }

  // 4 substep vật lý
  for (let i = 0; i < 4; i++) subStep(sim, SUBSTEP);

  // vệt bi
  sim.trail.push({ x: sim.ball.x, y: sim.ball.y, life: 0.3 });
  if (sim.trail.length > 22) sim.trail.shift();
  for (let i = sim.trail.length - 1; i >= 0; i--) {
    sim.trail[i].life -= dt;
    if (sim.trail[i].life <= 0) sim.trail.splice(i, 1);
  }

  // bi rơi lại đáy lane phóng → về plunger nhẹ nhàng
  if (sim.ball.inLane === false && sim.ball.x > 772 && sim.ball.y > 1100 && Math.abs(sim.ball.vy) < 60) {
    sim.state = "plunger";
    sim.ball.inLane = true;
    sim.events.push({ type: "backToPlunger" });
    return;
  }

  // chống kẹt: bi gần đứng yên quá lâu giữa bàn → nudge
  const spd = Math.hypot(sim.ball.vx, sim.ball.vy);
  if (spd < 14 && sim.ball.y < 1330) {
    sim.stuckT += dt;
    if (sim.stuckT > 2.5) {
      sim.stuckT = 0;
      sim.ball.vy -= 180;
      sim.ball.vx += sim.ball.x > 405 ? -60 : 60;
      sim.events.push({ type: "nudge" });
    }
  } else {
    sim.stuckT = 0;
  }

  // drain
  if (sim.ball.y > WORLD.h + BALL_R * 2) {
    if (sim.saver > 0) {
      sim.state = "plunger";
      sim.saver = 0;
      sim.ball = { x: PLUNGER.x, y: PLUNGER.y, vx: 0, vy: 0, inLane: true };
      sim.events.push({ type: "saved" });
      return;
    }
    // bonus tổng kết cuối bi
    const bonusPts = sim.bonusPct * 30;
    sim.score += bonusPts;
    sim.events.push({ type: "drain", bonusPts, bonusPct: sim.bonusPct });
    sim.bonusPct = 0;
    sim.ballsLeft -= 1;
    if (sim.ballsLeft <= 0) {
      sim.state = "over";
      sim.events.push({ type: "gameOver" });
    } else {
      sim.ballNum += 1;
      sim.state = "plunger";
      sim.ball = { x: PLUNGER.x, y: PLUNGER.y, vx: 0, vy: 0, inLane: true };
    }
  }
}
