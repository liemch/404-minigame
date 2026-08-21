/**
 * engine.js — Pixel Golf 404: physics thuần (không DOM) để unit test.
 *
 * Fixed timestep + substep: mỗi substep bóng đi tối đa ~nửa bán kính
 * nên không xuyên tường ở lực tối đa. Va chạm circle-vs-segment
 * (tường, cổng trượt) và circle-vs-circle (bumper). Ma sát theo bề mặt
 * (cỏ / cát), gió cộng lực khi bóng lăn, portal có cooldown chống lặp,
 * ra ngoài sân (out-of-bounds) → trả bóng về vị trí nghỉ + phạt 1 gậy.
 */

export const BALL_R = 7;
export const MAX_SHOT = 700; // tốc độ tối đa khi đánh hết lực
export const STOP_SPEED = 8;
export const SINK_DIST = 11;
export const SINK_SPEED = 280;
export const PORTAL_R = 17;
export const PORTAL_CD = 0.55;
const FRICTION_GREEN = 1.05;
const FRICTION_SAND = 5.6;
const WALL_BOUNCE = 0.82;

/** Điểm trong đa giác (ray-cast). pts = [[x,y]...] */
export function pointInPoly(pts, x, y) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Tất cả đoạn tường của hố: cạnh đa giác + tường trong. */
export function wallsOf(def) {
  const segs = [];
  const pts = def.poly;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    segs.push([a[0], a[1], b[0], b[1]]);
  }
  for (const w of def.walls || []) segs.push(w);
  return segs;
}

/** Vị trí thanh cổng trượt tại thời điểm t: đoạn [x1,y1,x2,y2]. */
export function gateSegment(gate, t) {
  const k = 0.5 + 0.5 * Math.sin((t / gate.period) * Math.PI * 2 + (gate.phase || 0));
  const span = { x: gate.x2 - gate.x1, y: gate.y2 - gate.y1 };
  const len = Math.hypot(span.x, span.y);
  const barLen = gate.bar;
  const travel = len - barLen;
  const off = travel * k;
  const ux = span.x / len;
  const uy = span.y / len;
  return [gate.x1 + ux * off, gate.y1 + uy * off, gate.x1 + ux * (off + barLen), gate.y1 + uy * (off + barLen)];
}

export function createHole(def) {
  return {
    def,
    walls: wallsOf(def),
    ball: { x: def.tee.x, y: def.tee.y, vx: 0, vy: 0 },
    moving: false,
    strokes: 0,
    sunk: false,
    rest: { x: def.tee.x, y: def.tee.y },
    portalCd: 0,
    portalFree: true, // đã rời khỏi vùng portal sau khi dịch chuyển
    bumperCd: new Map(),
    inSand: false,
    time: 0,
    events: [],
  };
}

/** Đánh bóng: chỉ khi bóng đứng yên và chưa vào lỗ. */
export function shoot(hs, angle, power) {
  if (hs.moving || hs.sunk) return false;
  const p = Math.max(0.06, Math.min(1, power));
  hs.rest = { x: hs.ball.x, y: hs.ball.y };
  hs.ball.vx = Math.cos(angle) * MAX_SHOT * p;
  hs.ball.vy = Math.sin(angle) * MAX_SHOT * p;
  hs.moving = true;
  hs.strokes += 1;
  hs.events.push({ type: "hit", power: p });
  return true;
}

function collideSegment(ball, seg, events, hs) {
  const [x1, y1, x2, y2] = seg;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((ball.x - x1) * dx + (ball.y - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + dx * t;
  const cy = y1 + dy * t;
  let nx = ball.x - cx;
  let ny = ball.y - cy;
  const d = Math.hypot(nx, ny);
  if (d >= BALL_R || d === 0) return false;
  nx /= d;
  ny /= d;
  // đẩy ra + phản xạ
  ball.x = cx + nx * (BALL_R + 0.15);
  ball.y = cy + ny * (BALL_R + 0.15);
  const vn = ball.vx * nx + ball.vy * ny;
  if (vn < 0) {
    ball.vx -= (1 + WALL_BOUNCE) * vn * nx;
    ball.vy -= (1 + WALL_BOUNCE) * vn * ny;
    if (Math.abs(vn) > 40 && events) events.push({ type: "wall", speed: Math.abs(vn) });
  }
  return true;
}

export function inSandAt(def, x, y) {
  for (const s of def.sand || []) {
    if (Math.hypot(x - s.x, y - s.y) < s.r) return true;
  }
  return false;
}

/** Bước mô phỏng dt cố định (khuyên 1/120). */
export function stepHole(hs, dt) {
  hs.time += dt;
  if (hs.portalCd > 0) hs.portalCd -= dt;
  for (const [k, v] of hs.bumperCd) {
    if (v - dt <= 0) hs.bumperCd.delete(k);
    else hs.bumperCd.set(k, v - dt);
  }
  if (!hs.moving || hs.sunk) return;

  const def = hs.def;
  const ball = hs.ball;

  // gió (chỉ tác động khi bóng đang lăn)
  if (def.wind) {
    ball.vx += def.wind.x * dt;
    ball.vy += def.wind.y * dt;
  }

  // ma sát theo bề mặt
  const sandNow = inSandAt(def, ball.x, ball.y);
  if (sandNow && !hs.inSand) hs.events.push({ type: "sand" });
  hs.inSand = sandNow;
  const mu = sandNow ? FRICTION_SAND : FRICTION_GREEN;
  const damp = Math.exp(-mu * dt);
  ball.vx *= damp;
  ball.vy *= damp;

  let speed = Math.hypot(ball.vx, ball.vy);

  // hút nhẹ về lỗ khi tới gần và chậm
  const hd = Math.hypot(ball.x - def.hole.x, ball.y - def.hole.y);
  if (hd < 24 && speed < 150) {
    ball.vx += ((def.hole.x - ball.x) / hd) * 140 * dt;
    ball.vy += ((def.hole.y - ball.y) / hd) * 140 * dt;
    speed = Math.hypot(ball.vx, ball.vy);
  }

  // dừng hẳn
  if (speed < STOP_SPEED) {
    ball.vx = 0;
    ball.vy = 0;
    hs.moving = false;
    hs.rest = { x: ball.x, y: ball.y };
    hs.events.push({ type: "rest", sand: sandNow });
    return;
  }

  // substep chống xuyên tường
  const maxMove = BALL_R * 0.5;
  const steps = Math.max(1, Math.ceil((speed * dt) / maxMove));
  const sdt = dt / steps;
  const gateSegs = (def.gates || []).map((g) => gateSegment(g, hs.time));

  for (let s = 0; s < steps; s++) {
    ball.x += ball.vx * sdt;
    ball.y += ball.vy * sdt;

    for (const seg of hs.walls) collideSegment(ball, seg, hs.events, hs);
    for (const seg of gateSegs) {
      if (collideSegment(ball, seg, null, hs)) hs.events.push({ type: "gate" });
    }

    // bumper
    for (let i = 0; i < (def.bumpers || []).length; i++) {
      const b = def.bumpers[i];
      const dx = ball.x - b.x;
      const dy = ball.y - b.y;
      const d = Math.hypot(dx, dy);
      if (d < BALL_R + b.r && d > 0) {
        const nx = dx / d;
        const ny = dy / d;
        ball.x = b.x + nx * (BALL_R + b.r + 0.2);
        ball.y = b.y + ny * (BALL_R + b.r + 0.2);
        const vn = ball.vx * nx + ball.vy * ny;
        if (vn < 0) {
          ball.vx -= 2 * vn * nx;
          ball.vy -= 2 * vn * ny;
        }
        if (!hs.bumperCd.has(i)) {
          const sp = Math.max(Math.hypot(ball.vx, ball.vy) * 1.06, 430);
          const k = sp / (Math.hypot(ball.vx, ball.vy) || 1);
          ball.vx *= k;
          ball.vy *= k;
          hs.bumperCd.set(i, 0.12);
          hs.events.push({ type: "bumper" });
        }
      }
    }

    // portal (cặp a↔b, giữ nguyên vận tốc, có cooldown)
    if (def.portals) {
      for (const p of def.portals) {
        const near = (q) => Math.hypot(ball.x - q.x, ball.y - q.y) < PORTAL_R;
        if (hs.portalCd <= 0 && hs.portalFree) {
          let out = null;
          if (near(p.a)) out = p.b;
          else if (near(p.b)) out = p.a;
          if (out) {
            const sp = Math.hypot(ball.vx, ball.vy) || 1;
            const ux = ball.vx / sp;
            const uy = ball.vy / sp;
            ball.x = out.x + ux * (PORTAL_R + BALL_R + 3);
            ball.y = out.y + uy * (PORTAL_R + BALL_R + 3);
            hs.portalCd = PORTAL_CD;
            hs.portalFree = false;
            hs.events.push({ type: "portal" });
          }
        } else if (!hs.portalFree) {
          if (!near(p.a) && !near(p.b)) hs.portalFree = true;
        }
      }
    }

    // vào lỗ
    const d2 = Math.hypot(ball.x - def.hole.x, ball.y - def.hole.y);
    const spNow = Math.hypot(ball.vx, ball.vy);
    if (d2 < SINK_DIST && spNow < SINK_SPEED) {
      hs.sunk = true;
      hs.moving = false;
      ball.x = def.hole.x;
      ball.y = def.hole.y;
      ball.vx = 0;
      ball.vy = 0;
      hs.events.push({ type: "sink", strokes: hs.strokes });
      return;
    }

    // out-of-bounds: trả về vị trí nghỉ + phạt 1 gậy
    if (!pointInPoly(def.poly, ball.x, ball.y)) {
      ball.x = hs.rest.x;
      ball.y = hs.rest.y;
      ball.vx = 0;
      ball.vy = 0;
      hs.moving = false;
      hs.strokes += 1;
      hs.events.push({ type: "oob" });
      return;
    }
  }
}

export function drainEvents(hs) {
  const ev = hs.events;
  hs.events = [];
  return ev;
}

/** Tên kết quả so với par. */
export function scoreName(strokes, par) {
  if (strokes === 1) return "HOLE-IN-ONE!";
  const d = strokes - par;
  if (d <= -2) return "EAGLE!";
  if (d === -1) return "BIRDIE!";
  if (d === 0) return "PAR";
  if (d === 1) return "BOGEY";
  if (d === 2) return "DOUBLE BOGEY";
  return `+${d} GẬY`;
}

/** Điểm arcade cho một hố. */
export function holePoints(strokes, par) {
  return Math.max(0, par - strokes + 2) * 150 + (strokes === 1 ? 250 : 0);
}
