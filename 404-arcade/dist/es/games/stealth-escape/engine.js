/**
 * engine.js — logic thuần Stealth Escape 404 (turn-based, tất định).
 *
 * Không phụ thuộc DOM → có thể import trong Node để solver xác minh
 * mọi level có lời giải. Thứ tự một lượt theo plan:
 *   1. Người chơi hành động (đi 1 ô / đứng yên)
 *   2. Guard đi 1 bước theo tuyến tuần tra (tất định theo số lượt)
 *   3. Camera xoay theo chu kỳ
 *   4. Tính line of sight (Bresenham, tường/cover/cửa đóng chặn)
 *   5. Cập nhật báo động (+25% mỗi lần bị thấy; vùng khuất chỉ bị
 *      phát hiện khi watcher đứng sát ≤1 ô)
 *   6. Kiểm tra thắng/thua
 *
 * Vị trí guard/camera là HÀM của số lượt → undo chỉ cần khôi phục
 * (vị trí, keycard, terminal, alarm, turns).
 */

export const TILE = { FLOOR: 0, WALL: 1, SHADOW: 2, COVER: 3 };
export const DIRS = [
  [0, -1], // 0 Bắc
  [1, 0], // 1 Đông
  [0, 1], // 2 Nam
  [-1, 0], // 3 Tây
];
export const GUARD_RANGE = 4;
export const CAM_RANGE = 3;
export const ALARM_PER_SPOT = 25;
export const UNDO_MAX = 40;

/* ---------------- nạp level ---------------- */

/** Nối các waypoint thẳng hàng thành chuỗi ô đi từng bước. */
function expandRoute(waypoints) {
  const cells = [[...waypoints[0]]];
  for (let i = 1; i < waypoints.length; i++) {
    let [x, y] = cells[cells.length - 1];
    const [tx, ty] = waypoints[i];
    while (x !== tx || y !== ty) {
      x += Math.sign(tx - x);
      y += Math.sign(ty - y);
      cells.push([x, y]);
    }
  }
  // đầu == cuối → vòng kín (bỏ ô lặp cuối)
  const closed =
    cells.length > 1 &&
    cells[0][0] === cells[cells.length - 1][0] &&
    cells[0][1] === cells[cells.length - 1][1];
  if (closed) cells.pop();
  return { cells, closed };
}

export function loadLevel(def) {
  const h = def.grid.length;
  const w = def.grid[0].length;
  const tiles = [];
  const keycards = [];
  const doors = [];
  const terminals = [];
  let start = null;
  let exit = null;

  for (let y = 0; y < h; y++) {
    const row = [];
    for (let x = 0; x < w; x++) {
      const ch = def.grid[y][x];
      let t = TILE.FLOOR;
      if (ch === "#") t = TILE.WALL;
      else if (ch === "s") t = TILE.SHADOW;
      else if (ch === "o") t = TILE.COVER;
      else if (ch === "P") start = { x, y };
      else if (ch === "E") exit = { x, y };
      else if (ch === "k") keycards.push({ x, y });
      else if (ch === "d") doors.push({ x, y });
      else if (ch === "a") terminals.push({ x, y });
      row.push(t);
    }
    tiles.push(row);
  }

  return {
    name: def.name,
    time: def.time,
    par: def.par,
    w,
    h,
    tiles,
    start,
    exit,
    keycards,
    doors,
    terminals,
    guards: def.guards.map((gd) => ({ ...expandRoute(gd.route) })),
    cameras: def.cameras.map((c) => ({ ...c })),
    hint: def.hint || [],
  };
}

/* ---------------- vị trí tuần tra tất định ---------------- */

/** Vị trí + hướng nhìn của guard tại lượt `step`. */
export function guardPose(guard, step) {
  const n = guard.cells.length;
  if (n === 1) {
    return { x: guard.cells[0][0], y: guard.cells[0][1], dir: 2 };
  }
  let idx;
  let nextIdx;
  if (guard.closed) {
    idx = step % n;
    nextIdx = (idx + 1) % n;
  } else {
    const period = 2 * n - 2;
    const k = step % period;
    idx = k < n ? k : period - k;
    const k2 = (k + 1) % period;
    nextIdx = k2 < n ? k2 : period - k2;
  }
  const [x, y] = guard.cells[idx];
  const [nx, ny] = guard.cells[nextIdx];
  let dir = 2;
  if (nx > x) dir = 1;
  else if (nx < x) dir = 3;
  else if (ny < y) dir = 0;
  else if (ny > y) dir = 2;
  return { x, y, dir };
}

/** Chu kỳ lặp toàn cục của guard + camera (để solver duyệt pha). */
export function levelPeriod(level) {
  const lcm = (a, b) => (a * b) / gcd(a, b);
  const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
  let p = 1;
  for (const g of level.guards) {
    const n = g.cells.length;
    const gp = n === 1 ? 1 : g.closed ? n : 2 * n - 2;
    p = lcm(p, gp);
  }
  for (const c of level.cameras) p = lcm(p, c.dirs.length);
  return p;
}

/* ---------------- trạng thái động ---------------- */

export function createRun(level) {
  return {
    px: level.start.x,
    py: level.start.y,
    turns: 0,
    alarm: 0,
    keyMask: 0,
    termMask: 0,
    caught: false,
    won: false,
    spotted: false, // bị thấy ở lượt vừa rồi (render nhấp nháy)
    undo: [], // ngăn xếp snapshot (tối đa UNDO_MAX)
  };
}

export const allKeys = (level, st) => st.keyMask === (1 << level.keycards.length) - 1;

const camAt = (level, x, y) => level.cameras.some((c) => c.x === x && c.y === y);

/** Ô đi được với trạng thái hiện tại (cửa đóng chặn khi thiếu keycard). */
export function passable(level, st, x, y) {
  if (x < 0 || y < 0 || x >= level.w || y >= level.h) return false;
  const t = level.tiles[y][x];
  if (t === TILE.WALL || t === TILE.COVER) return false;
  if (camAt(level, x, y)) return false;
  if (!allKeys(level, st) && level.doors.some((d) => d.x === x && d.y === y)) return false;
  return true;
}

/* ---------------- tầm nhìn ---------------- */

/** Bresenham: đường ngắm bị chặn bởi tường/cover/cửa đóng (trừ 2 đầu). */
function los(level, st, x0, y0, x1, y1) {
  let dx = Math.abs(x1 - x0);
  let dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0;
  let y = y0;
  while (!(x === x1 && y === y1)) {
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
    if (x === x1 && y === y1) break;
    const t = level.tiles[y]?.[x];
    if (t === TILE.WALL || t === TILE.COVER) return false;
    if (!allKeys(level, st) && level.doors.some((d) => d.x === x && d.y === y)) return false;
  }
  return true;
}

/**
 * Các ô trong hình quạt (~53°) từ (wx,wy) hướng dir, có ray-blocking.
 * Quạt hẹp (|2l| ≤ f) để guard tuần tra hành lang vẫn có góc chết cho
 * người chơi lách qua — mọi level đã xác minh giải được với quạt này.
 */
function coneCells(level, st, wx, wy, dir, range) {
  const [fx, fy] = DIRS[dir];
  const sxv = -fy; // vector vuông góc
  const syv = fx;
  const cells = [];
  for (let f = 1; f <= range; f++) {
    const spread = Math.floor(f / 2);
    for (let l = -spread; l <= spread; l++) {
      const x = wx + fx * f + sxv * l;
      const y = wy + fy * f + syv * l;
      if (x < 0 || y < 0 || x >= level.w || y >= level.h) continue;
      const t = level.tiles[y][x];
      if (t === TILE.WALL || t === TILE.COVER) continue;
      if (!los(level, st, wx, wy, x, y)) continue;
      cells.push([x, y, f]);
    }
  }
  return cells;
}

/**
 * Toàn bộ hình quạt tầm nhìn tại lượt `turns` (cho render + detection).
 * Trả về [{x, y, dir, kind, cells}] — cells phần tử [x, y, khoảng cách].
 */
export function computeCones(level, st, turns) {
  const cones = [];
  for (const g of level.guards) {
    const pose = guardPose(g, turns);
    cones.push({ ...pose, kind: "guard", cells: coneCells(level, st, pose.x, pose.y, pose.dir, GUARD_RANGE) });
  }
  for (const c of level.cameras) {
    const dir = c.dirs[turns % c.dirs.length];
    cones.push({ x: c.x, y: c.y, dir, kind: "camera", cells: coneCells(level, st, c.x, c.y, dir, CAM_RANGE) });
  }
  return cones;
}

/** Người chơi có bị thấy không (áp dụng luật vùng khuất). */
export function playerVisible(level, st, cones) {
  const inShadow = level.tiles[st.py][st.px] === TILE.SHADOW;
  for (const cone of cones) {
    for (const [x, y] of cone.cells) {
      if (x !== st.px || y !== st.py) continue;
      if (inShadow) {
        const d = Math.max(Math.abs(cone.x - st.px), Math.abs(cone.y - st.py));
        if (d <= 1) return true;
      } else {
        return true;
      }
    }
  }
  return false;
}

/* ---------------- một lượt ---------------- */

function snapshot(st) {
  return {
    px: st.px,
    py: st.py,
    turns: st.turns,
    alarm: st.alarm,
    keyMask: st.keyMask,
    termMask: st.termMask,
  };
}

/**
 * Thực hiện một lượt. action: 'wait' | {dx, dy}.
 * Trả về { ok, events } — events: moved/blocked/key/unlock/terminal/
 * spotted/caught/won.
 */
export function doTurn(level, st, action) {
  if (st.caught || st.won) return { ok: false, events: [] };
  const events = [];

  let nx = st.px;
  let ny = st.py;
  if (action !== "wait") {
    nx += action.dx;
    ny += action.dy;
    if (!passable(level, st, nx, ny)) return { ok: false, events: [{ type: "blocked" }] };
  }

  // lưu snapshot cho undo TRƯỚC khi biến đổi
  st.undo.push(snapshot(st));
  if (st.undo.length > UNDO_MAX) st.undo.shift();

  const prevTurns = st.turns;
  st.px = nx;
  st.py = ny;
  st.turns += 1;
  st.spotted = false;
  if (action !== "wait") events.push({ type: "moved" });

  // nhặt keycard / dùng terminal
  level.keycards.forEach((k, i) => {
    if (!(st.keyMask & (1 << i)) && k.x === nx && k.y === ny) {
      st.keyMask |= 1 << i;
      events.push({ type: "key", index: i });
      if (allKeys(level, st)) events.push({ type: "unlock" });
    }
  });
  level.terminals.forEach((t, i) => {
    if (!(st.termMask & (1 << i)) && t.x === nx && t.y === ny && st.alarm > 0) {
      st.termMask |= 1 << i;
      st.alarm = 0;
      events.push({ type: "terminal" });
    }
  });

  // guard di chuyển: đè lên người chơi hoặc hai bên đi xuyên nhau → bị bắt
  const prevP = st.undo[st.undo.length - 1]; // vị trí người chơi trước lượt
  for (const g of level.guards) {
    const prev = guardPose(g, prevTurns);
    const cur = guardPose(g, st.turns);
    const onPlayer = cur.x === st.px && cur.y === st.py;
    const swapped =
      prev.x === st.px && prev.y === st.py && cur.x === prevP.px && cur.y === prevP.py;
    if (onPlayer || swapped) {
      st.caught = true;
      events.push({ type: "caught", reason: "guard" });
      return { ok: true, events };
    }
  }

  // camera xoay (ẩn trong turns) → tính tầm nhìn + báo động
  const cones = computeCones(level, st, st.turns);
  if (playerVisible(level, st, cones)) {
    st.alarm = Math.min(100, st.alarm + ALARM_PER_SPOT);
    st.spotted = true;
    events.push({ type: "spotted", alarm: st.alarm });
  }

  // thắng / thua
  if (st.px === level.exit.x && st.py === level.exit.y && allKeys(level, st)) {
    st.won = true;
    events.push({ type: "won" });
  } else if (st.alarm >= 100) {
    st.caught = true;
    events.push({ type: "caught", reason: "alarm" });
  }

  return { ok: true, events };
}

/** Hoàn tác một lượt (phục hồi player, guard, camera, cửa, keycard, alarm). */
export function undoTurn(st) {
  const snap = st.undo.pop();
  if (!snap) return false;
  st.px = snap.px;
  st.py = snap.py;
  st.turns = snap.turns;
  st.alarm = snap.alarm;
  st.keyMask = snap.keyMask;
  st.termMask = snap.termMask;
  st.caught = false;
  st.won = false;
  st.spotted = false;
  return true;
}

/** BFS đường đi tránh tường/cửa đóng — cho nút GỢI Ý (bỏ qua tầm nhìn). */
export function findPath(level, st, tx, ty) {
  const key = (x, y) => y * level.w + x;
  const prev = new Map([[key(st.px, st.py), null]]);
  const q = [[st.px, st.py]];
  while (q.length) {
    const [x, y] = q.shift();
    if (x === tx && y === ty) {
      const path = [];
      let cur = key(x, y);
      while (cur !== null && cur !== undefined) {
        path.unshift([cur % level.w, Math.floor(cur / level.w)]);
        cur = prev.get(cur);
      }
      return path;
    }
    for (const [dx, dy] of DIRS) {
      const nx2 = x + dx;
      const ny2 = y + dy;
      if (!passable(level, st, nx2, ny2)) continue;
      const k2 = key(nx2, ny2);
      if (prev.has(k2)) continue;
      prev.set(k2, key(x, y));
      q.push([nx2, ny2]);
    }
  }
  return null;
}

/** Mục tiêu kế tiếp cho GỢI Ý: keycard chưa nhặt → lối thoát. */
export function nextObjective(level, st) {
  for (let i = 0; i < level.keycards.length; i++) {
    if (!(st.keyMask & (1 << i))) return { x: level.keycards[i].x, y: level.keycards[i].y, kind: "key" };
  }
  return { x: level.exit.x, y: level.exit.y, kind: "exit" };
}
