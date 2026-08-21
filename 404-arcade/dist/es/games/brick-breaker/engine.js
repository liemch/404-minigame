/**
 * engine.js — Brick Breaker 404: toàn bộ logic thuần (không DOM/Canvas)
 * để chạy được unit test trong Node.
 *
 * Chống xuyên gạch: tích phân theo SUBSTEP — mỗi substep bóng đi tối đa
 * ~0.8 bán kính nên không thể nhảy qua gạch/paddle ở tốc độ trần.
 * Góc nảy paddle phụ thuộc vị trí chạm (không chỉ theo pháp tuyến).
 * Chống kẹt quỹ đạo: đếm thời gian bóng bay gần-ngang / gần-dọc và
 * đá nhẹ hướng khi vượt ngưỡng.
 */

export const CELL = { EMPTY: 0, NORMAL: 1, REINFORCED: 2, EXPLOSIVE: 3, UNBREAKABLE: 4 };

export const WORLD = { w: 1040, h: 640 };
export const BALL_R = 8;
export const BRICK_H = 36;
export const FIELD_PAD = 26;
export const BRICK_TOP = 54;
export const PADDLE_BASE_W = 132;
export const PADDLE_H = 18;
export const PADDLE_Y = WORLD.h - 44;
export const PADDLE_SPEED = 780;
export const WIDE_SCALE = 1.55;
export const MAX_BALLS = 6;
export const MAX_LIVES = 5;
export const SPEED_CAP = 720;
export const POWER_DUR = { wide: 12, slow: 8, laser: 10 };

const CHAR_CELL = { ".": CELL.EMPTY, N: CELL.NORMAL, R: CELL.REINFORCED, E: CELL.EXPLOSIVE, U: CELL.UNBREAKABLE };
const MAX_ANGLE = (62 * Math.PI) / 180; // góc lệch tối đa khỏi phương dọc khi nảy paddle

/** Parse level: rows = mảng chuỗi ('.'|N|R|E|U), mỗi ký tự một gạch. */
export function parseLevel(def) {
  const rows = def.rows;
  const cols = rows[0].length;
  const bw = (WORLD.w - FIELD_PAD * 2) / cols;
  const bricks = [];
  const grid = new Map(); // "gx,gy" → brick
  for (let gy = 0; gy < rows.length; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const type = CHAR_CELL[rows[gy][gx]] ?? CELL.EMPTY;
      if (type === CELL.EMPTY) continue;
      const b = {
        gx,
        gy,
        type,
        x: FIELD_PAD + gx * bw,
        y: BRICK_TOP + gy * BRICK_H,
        w: bw,
        h: BRICK_H,
        hp: type === CELL.REINFORCED ? 2 : 1,
        alive: true,
      };
      bricks.push(b);
      grid.set(`${gx},${gy}`, b);
    }
  }
  return {
    bricks,
    grid,
    cols,
    rowsCount: rows.length,
    bw,
    ballSpeed: Math.min(def.ballSpeed, SPEED_CAP),
    powerupChance: def.powerupChance,
  };
}

function newBall(speed) {
  return {
    x: WORLD.w / 2,
    y: PADDLE_Y - BALL_R - 1,
    vx: 0,
    vy: 0,
    speed,
    stuck: true,
    stickOff: 0,
    lockH: 0, // thời gian bay gần-ngang liên tục
    lockV: 0, // thời gian bay gần-dọc liên tục
  };
}

/**
 * Tạo trận cho một level. rand tiêm được để test tất định.
 * lives truyền từ ngoài (giữ qua các màn).
 */
export function createMatch(levelDef, { rand = Math.random, lives = 3, score = 0 } = {}) {
  const lv = parseLevel(levelDef);
  return {
    lv,
    rand,
    lives,
    score,
    paddle: { x: WORLD.w / 2, w: PADDLE_BASE_W, targetW: PADDLE_BASE_W },
    balls: [newBall(lv.ballSpeed)],
    powerups: [], // {x,y,vy,type,phase}
    lasers: [], // {x,y}
    timers: { wide: 0, slow: 0, laser: 0 },
    laserCd: 0,
    combo: 0,
    maxCombo: 0,
    bricksBroken: 0,
    powerupsTaken: 0,
    breakableLeft: lv.bricks.filter((b) => b.type !== CELL.UNBREAKABLE).length,
    over: false, // hết mạng
    cleared: false, // hết gạch phá được
    events: [],
  };
}

/* ---------------- Power-up ---------------- */

const POWER_WEIGHTS = [
  ["multi", 0.24],
  ["wide", 0.22],
  ["slow", 0.2],
  ["laser", 0.2],
  ["life", 0.14],
];

function pickPower(rand) {
  let r = rand();
  for (const [type, w] of POWER_WEIGHTS) {
    r -= w;
    if (r <= 0) return type;
  }
  return "multi";
}

export function applyPower(m, type) {
  m.powerupsTaken += 1;
  switch (type) {
    case "multi": {
      const src = m.balls.filter((b) => !b.stuck);
      const base = src[0] || m.balls[0];
      if (!base) break;
      const speed = base.speed;
      const a0 = base.stuck ? -Math.PI / 2 : Math.atan2(base.vy, base.vx);
      for (const da of [-0.42, 0.42]) {
        if (m.balls.length >= MAX_BALLS) break;
        const a = a0 + da;
        m.balls.push({
          ...newBall(speed),
          x: base.x,
          y: base.y,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed,
          stuck: false,
        });
      }
      break;
    }
    case "wide":
      m.timers.wide = POWER_DUR.wide; // làm mới, KHÔNG cộng dồn quá 1 nấc
      break;
    case "slow":
      m.timers.slow = POWER_DUR.slow;
      break;
    case "laser":
      m.timers.laser = POWER_DUR.laser;
      break;
    case "life":
      m.lives = Math.min(MAX_LIVES, m.lives + 1);
      break;
  }
  m.events.push({ type: "power", power: type });
}

/* ---------------- Gạch ---------------- */

/** Gây damage một gạch; nổ lan xử lý bằng hàng đợi (không đệ quy sâu). */
export function damageBrick(m, brick, dmg = 1) {
  const queue = [[brick, dmg]];
  while (queue.length) {
    const [b, d] = queue.shift();
    if (!b || !b.alive || b.type === CELL.UNBREAKABLE) continue;
    b.hp -= d;
    if (b.hp > 0) {
      m.score += 20;
      m.events.push({ type: "crack", x: b.x + b.w / 2, y: b.y + b.h / 2 });
      continue;
    }
    b.alive = false;
    m.lv.grid.delete(`${b.gx},${b.gy}`);
    m.breakableLeft -= 1;
    m.bricksBroken += 1;
    m.combo += 1;
    if (m.combo > m.maxCombo) m.maxCombo = m.combo;
    const base = b.type === CELL.EXPLOSIVE ? 100 : b.type === CELL.REINFORCED ? 80 : 50;
    m.score += base + m.combo * 10;
    m.events.push({ type: "break", brick: b, x: b.x + b.w / 2, y: b.y + b.h / 2, btype: b.type });

    if (m.rand() < m.lv.powerupChance) {
      m.powerups.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, vy: 150, type: pickPower(m.rand), phase: m.rand() * 6.28 });
    }

    if (b.type === CELL.EXPLOSIVE) {
      m.events.push({ type: "boom", x: b.x + b.w / 2, y: b.y + b.h / 2 });
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nb = m.lv.grid.get(`${b.gx + dx},${b.gy + dy}`);
          if (nb && nb.alive && nb.type !== CELL.UNBREAKABLE) queue.push([nb, 2]);
        }
      }
    }
  }
  if (m.breakableLeft <= 0 && !m.cleared) {
    m.cleared = true;
    m.events.push({ type: "cleared" });
  }
}

/** Các gạch có bbox giao với hình tròn (x,y,r) — tra theo lưới. */
function bricksNear(m, x, y, r) {
  const lv = m.lv;
  const gx0 = Math.floor((x - r - FIELD_PAD) / lv.bw);
  const gx1 = Math.floor((x + r - FIELD_PAD) / lv.bw);
  const gy0 = Math.floor((y - r - BRICK_TOP) / BRICK_H);
  const gy1 = Math.floor((y + r - BRICK_TOP) / BRICK_H);
  const out = [];
  for (let gy = gy0; gy <= gy1; gy++) {
    for (let gx = gx0; gx <= gx1; gx++) {
      const b = m.lv.grid.get(`${gx},${gy}`);
      if (b && b.alive) out.push(b);
    }
  }
  return out;
}

function circleHitsRect(x, y, r, b) {
  const cx = Math.max(b.x, Math.min(x, b.x + b.w));
  const cy = Math.max(b.y, Math.min(y, b.y + b.h));
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

/* ---------------- Bóng ---------------- */

export function launchBall(m, ball) {
  if (!ball.stuck) return;
  ball.stuck = false;
  const a = -Math.PI / 2 + (m.rand() - 0.5) * 0.5;
  ball.vx = Math.cos(a) * ball.speed;
  ball.vy = Math.sin(a) * ball.speed;
  m.events.push({ type: "launch" });
}

/** Nảy paddle: vị trí chạm quyết định góc; tăng nhẹ tốc độ tới trần. */
function bounceOffPaddle(m, ball) {
  const rel = Math.max(-1, Math.min(1, (ball.x - m.paddle.x) / (m.paddle.w / 2)));
  const angle = rel * MAX_ANGLE;
  ball.speed = Math.min(SPEED_CAP, ball.speed + 6);
  ball.vx = Math.sin(angle) * ball.speed;
  ball.vy = -Math.cos(angle) * ball.speed;
  ball.y = PADDLE_Y - BALL_R - 0.5;
  ball.lockH = 0;
  ball.lockV = 0;
  m.combo = 0;
  m.events.push({ type: "paddle" });
}

function stepBallSub(m, ball, sdt) {
  const slowK = m.timers.slow > 0 ? 0.62 : 1;
  const px = ball.x;
  const py = ball.y;
  ball.x += ball.vx * slowK * sdt;
  ball.y += ball.vy * slowK * sdt;

  // Tường
  if (ball.x < BALL_R) {
    ball.x = BALL_R;
    ball.vx = Math.abs(ball.vx);
    m.events.push({ type: "wall" });
  } else if (ball.x > WORLD.w - BALL_R) {
    ball.x = WORLD.w - BALL_R;
    ball.vx = -Math.abs(ball.vx);
    m.events.push({ type: "wall" });
  }
  if (ball.y < BALL_R) {
    ball.y = BALL_R;
    ball.vy = Math.abs(ball.vy);
    m.events.push({ type: "wall" });
  }

  // Paddle
  if (
    ball.vy > 0 &&
    ball.y + BALL_R >= PADDLE_Y &&
    py + BALL_R <= PADDLE_Y + PADDLE_H &&
    ball.x >= m.paddle.x - m.paddle.w / 2 - BALL_R &&
    ball.x <= m.paddle.x + m.paddle.w / 2 + BALL_R
  ) {
    bounceOffPaddle(m, ball);
    return;
  }

  // Gạch — tối đa 2 va chạm mỗi substep (góc kép)
  for (let i = 0; i < 2; i++) {
    const hits = bricksNear(m, ball.x, ball.y, BALL_R).filter((b) => circleHitsRect(ball.x, ball.y, BALL_R, b));
    if (!hits.length) break;
    // gạch gần tâm bóng nhất
    let best = hits[0];
    let bd = Infinity;
    for (const b of hits) {
      const d = Math.hypot(ball.x - (b.x + b.w / 2), ball.y - (b.y + b.h / 2));
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
    // Pháp tuyến theo vị trí TRƯỚC substep (hướng bóng đến)
    const fromLeft = px <= best.x - 0.01;
    const fromRight = px >= best.x + best.w + 0.01;
    const fromTop = py <= best.y - 0.01;
    const fromBottom = py >= best.y + best.h + 0.01;
    if ((fromLeft || fromRight) && !(fromTop || fromBottom)) {
      ball.vx = fromLeft ? -Math.abs(ball.vx) : Math.abs(ball.vx);
      ball.x = fromLeft ? best.x - BALL_R - 0.1 : best.x + best.w + BALL_R + 0.1;
    } else if ((fromTop || fromBottom) && !(fromLeft || fromRight)) {
      ball.vy = fromTop ? -Math.abs(ball.vy) : Math.abs(ball.vy);
      ball.y = fromTop ? best.y - BALL_R - 0.1 : best.y + best.h + BALL_R + 0.1;
    } else {
      // Góc: phản xạ trục có độ xuyên nhỏ hơn
      const cx = Math.max(best.x, Math.min(ball.x, best.x + best.w));
      const cy = Math.max(best.y, Math.min(ball.y, best.y + best.h));
      const ox = ball.x - cx;
      const oy = ball.y - cy;
      if (Math.abs(ox) > Math.abs(oy)) {
        ball.vx = ox > 0 ? Math.abs(ball.vx) : -Math.abs(ball.vx);
        ball.x = cx + Math.sign(ox || 1) * (BALL_R + 0.1);
      } else {
        ball.vy = oy > 0 ? Math.abs(ball.vy) : -Math.abs(ball.vy);
        ball.y = cy + Math.sign(oy || -1) * (BALL_R + 0.1);
      }
    }
    if (best.type === CELL.UNBREAKABLE) m.events.push({ type: "steel" });
    else damageBrick(m, best, 1);
  }
}

/* ---------------- Step chính ---------------- */

/**
 * input = { move: -1..1, targetX: number|null, launch: bool }
 * Trả về m.events tích lũy (caller drain).
 */
export function stepMatch(m, input, dt) {
  if (m.over || m.cleared) return;

  // Paddle
  if (input.targetX !== null && input.targetX !== undefined) {
    m.paddle.x = input.targetX;
  } else if (input.move) {
    m.paddle.x += input.move * PADDLE_SPEED * dt;
  }
  const halfW = m.paddle.w / 2;
  m.paddle.x = Math.max(halfW + 4, Math.min(WORLD.w - halfW - 4, m.paddle.x));

  // Timers
  for (const k of ["wide", "slow", "laser"]) {
    if (m.timers[k] > 0) {
      m.timers[k] -= dt;
      if (m.timers[k] <= 0) {
        m.timers[k] = 0;
        m.events.push({ type: "powerEnd", power: k });
      }
    }
  }
  m.paddle.targetW = m.timers.wide > 0 ? PADDLE_BASE_W * WIDE_SCALE : PADDLE_BASE_W;
  m.paddle.w += (m.paddle.targetW - m.paddle.w) * Math.min(1, dt * 10);

  // Laser paddle: tự bắn theo nhịp
  if (m.timers.laser > 0) {
    m.laserCd -= dt;
    if (m.laserCd <= 0) {
      m.laserCd = 0.55;
      m.lasers.push({ x: m.paddle.x - m.paddle.w / 2 + 10, y: PADDLE_Y - 4 });
      m.lasers.push({ x: m.paddle.x + m.paddle.w / 2 - 10, y: PADDLE_Y - 4 });
      m.events.push({ type: "laserShot" });
    }
  }

  // Đạn laser bay lên
  for (let i = m.lasers.length - 1; i >= 0; i--) {
    const L = m.lasers[i];
    L.y -= 900 * dt;
    if (L.y < -20) {
      m.lasers.splice(i, 1);
      continue;
    }
    const hits = bricksNear(m, L.x, L.y, 4);
    if (hits.length) {
      const b = hits[0];
      if (b.type === CELL.UNBREAKABLE) m.events.push({ type: "steel" });
      else damageBrick(m, b, 1);
      m.lasers.splice(i, 1);
    }
  }

  // Bóng: substep chống xuyên
  for (let i = m.balls.length - 1; i >= 0; i--) {
    const ball = m.balls[i];
    if (ball.stuck) {
      ball.x = m.paddle.x + ball.stickOff;
      ball.y = PADDLE_Y - BALL_R - 1;
      if (input.launch) launchBall(m, ball);
      continue;
    }
    const speed = Math.hypot(ball.vx, ball.vy) || ball.speed;
    const maxMove = BALL_R * 0.8;
    const steps = Math.max(1, Math.ceil((speed * dt) / maxMove));
    const sdt = dt / steps;
    for (let s = 0; s < steps; s++) {
      stepBallSub(m, ball, sdt);
      if (m.cleared) break;
    }

    // Chống kẹt quỹ đạo ngang/dọc
    const sp = Math.hypot(ball.vx, ball.vy) || 1;
    if (Math.abs(ball.vy) < sp * 0.18) ball.lockH += dt;
    else ball.lockH = 0;
    if (Math.abs(ball.vx) < sp * 0.06) ball.lockV += dt;
    else ball.lockV = 0;
    if (ball.lockH > 2.2) {
      ball.lockH = 0;
      ball.vy += (ball.vy >= 0 ? 1 : -1) * sp * 0.3;
      const k = sp / Math.hypot(ball.vx, ball.vy);
      ball.vx *= k;
      ball.vy *= k;
    }
    if (ball.lockV > 3.5) {
      ball.lockV = 0;
      ball.vx += (m.rand() < 0.5 ? -1 : 1) * sp * 0.22;
      const k = sp / Math.hypot(ball.vx, ball.vy);
      ball.vx *= k;
      ball.vy *= k;
    }

    // Rơi khỏi đáy
    if (ball.y > WORLD.h + BALL_R * 3) {
      m.balls.splice(i, 1);
      m.events.push({ type: "ballDrop", remaining: m.balls.length });
    }
  }

  // Mất mạng CHỈ khi quả cuối cùng rơi (multi-ball đúng chuẩn)
  if (m.balls.length === 0 && !m.cleared) {
    m.lives -= 1;
    m.combo = 0;
    m.events.push({ type: "lifeLost", lives: m.lives });
    if (m.lives <= 0) {
      m.over = true;
      m.events.push({ type: "gameOver" });
    } else {
      m.balls.push(newBall(m.lv.ballSpeed));
    }
  }

  // Power-up rơi
  for (let i = m.powerups.length - 1; i >= 0; i--) {
    const p = m.powerups[i];
    p.y += p.vy * dt;
    p.phase += dt * 4;
    if (
      p.y + 14 >= PADDLE_Y &&
      p.y - 14 <= PADDLE_Y + PADDLE_H + 6 &&
      Math.abs(p.x - m.paddle.x) < m.paddle.w / 2 + 16
    ) {
      applyPower(m, p.type);
      m.powerups.splice(i, 1);
    } else if (p.y > WORLD.h + 30) {
      m.powerups.splice(i, 1);
    }
  }
}

/** Drain sự kiện tích lũy (index gọi mỗi frame). */
export function drainEvents(m) {
  const ev = m.events;
  m.events = [];
  return ev;
}
