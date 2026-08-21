/**
 * engine.js — Laser Maze 404: ray engine + thao tác board thuần
 * (không DOM) để chạy unit test trong Node.
 *
 * Tia mô phỏng theo ô và 4 hướng U/R/D/L. Gương '/' và '\\' phản xạ,
 * splitter tách tia thành 2 hướng (đi thẳng + phản xạ theo hướng gương),
 * filter nhuộm tia gốc (đỏ) thành màu của nó và CHẶN tia khác màu,
 * receiver yêu cầu đúng màu. Vòng lặp phát hiện bằng state đã thăm
 * (x, y, direction, color) tại gương/splitter + guard tổng số bước.
 */

export const DX = { U: 0, R: 1, D: 0, L: -1 };
export const DY = { U: -1, R: 0, D: 1, L: 0 };

export const REFLECT = {
  "/": { R: "U", U: "R", L: "D", D: "L" },
  "\\": { R: "D", D: "R", L: "U", U: "L" },
};

export const BEAM_COLORS = {
  red: "#ff3b4f",
  cyan: "#20e3ff",
  violet: "#9a5cff",
  magenta: "#ff2ee6",
};

/** Trạng thái board của người chơi (gương đặt + góc xoay gương cố định). */
export function makeState() {
  return { placed: new Map(), rot: new Map() };
}

export function cloneState(st) {
  return { placed: new Map(st.placed), rot: new Map(st.rot) };
}

/** Gộp fixed + placed thành Map "x,y" → cell. */
export function cellsOf(level, st) {
  const cells = new Map();
  for (const f of level.fixed) {
    const [kind, x, y, a] = f;
    const key = `${x},${y}`;
    if (kind === "source") cells.set(key, { kind, dir: a });
    else if (kind === "receiver") cells.set(key, { kind, need: a });
    else if (kind === "mirror") cells.set(key, { kind, o: st.rot.get(key) || a, fixed: true });
    else if (kind === "splitter") cells.set(key, { kind, o: a });
    else if (kind === "filter") cells.set(key, { kind, color: a });
    else if (kind === "blocker") cells.set(key, { kind });
  }
  for (const [key, p] of st.placed) {
    cells.set(key, { kind: "mirror", o: p.o, fixed: false });
  }
  return cells;
}

/**
 * Lần tia. Trả về:
 *  segs: [{x1,y1,x2,y2,color,cut}] — đoạn giữa tâm ô (cut 0.5 = dừng nửa ô)
 *  lit:  Map "x,y" → Set màu tia đến receiver
 *  ok / total / done — số receiver thỏa màu yêu cầu
 */
export function trace(level, st) {
  const cells = cellsOf(level, st);
  const segs = [];
  const lit = new Map();
  const visited = new Set();
  const queue = [];
  for (const f of level.fixed) {
    if (f[0] === "source") queue.push({ x: f[1], y: f[2], dir: f[3], color: "red" });
  }

  let guard = 0;
  while (queue.length && guard < 8000) {
    let { x, y, dir, color } = queue.shift();
    let walking = true;
    while (walking && guard++ < 8000) {
      const nx = x + DX[dir];
      const ny = y + DY[dir];
      if (nx < 0 || ny < 0 || nx >= level.w || ny >= level.h) {
        segs.push({ x1: x, y1: y, x2: nx, y2: ny, color, cut: 0.5 });
        break;
      }
      const key = `${nx},${ny}`;
      const cell = cells.get(key);
      const blocked = cell && (cell.kind === "blocker" || cell.kind === "source");
      segs.push({ x1: x, y1: y, x2: nx, y2: ny, color, cut: blocked ? 0.5 : 0 });
      if (!cell) {
        x = nx;
        y = ny;
        continue;
      }
      switch (cell.kind) {
        case "blocker":
        case "source":
          walking = false;
          break;
        case "receiver": {
          if (!lit.has(key)) lit.set(key, new Set());
          lit.get(key).add(color);
          walking = false;
          break;
        }
        case "filter": {
          if (color === "red") color = cell.color;
          else if (color !== cell.color) {
            segs[segs.length - 1].cut = 0.5;
            walking = false;
            break;
          }
          x = nx;
          y = ny;
          break;
        }
        case "mirror": {
          const vk = `m${key}|${dir}|${color}`;
          if (visited.has(vk)) {
            walking = false;
            break;
          }
          visited.add(vk);
          dir = REFLECT[cell.o][dir];
          x = nx;
          y = ny;
          break;
        }
        case "splitter": {
          const vk = `s${key}|${dir}|${color}`;
          if (visited.has(vk)) {
            walking = false;
            break;
          }
          visited.add(vk);
          // tách 2 hướng: đi thẳng (nhánh mới) + phản xạ (nhánh hiện tại)
          queue.push({ x: nx, y: ny, dir, color });
          dir = REFLECT[cell.o][dir];
          x = nx;
          y = ny;
          break;
        }
        default:
          walking = false;
      }
    }
  }

  let ok = 0;
  let total = 0;
  for (const f of level.fixed) {
    if (f[0] !== "receiver") continue;
    total += 1;
    const s = lit.get(`${f[1]},${f[2]}`);
    if (s && s.has(f[3])) ok += 1;
  }
  return { segs, lit, ok, total, done: total > 0 && ok === total };
}

/**
 * Click vào ô (x,y):
 *  - gương cố định → xoay / ↔ \
 *  - gương đã đặt → xoay / → \ → gỡ về kho
 *  - ô trống → đặt gương '/' nếu kho còn
 * Trả về { changed, action } — action: rotate|place|remove|denied|null.
 */
export function actionAt(level, st, x, y) {
  if (x < 0 || y < 0 || x >= level.w || y >= level.h) return { changed: false, action: null };
  const key = `${x},${y}`;
  const fixed = level.fixed.find((f) => f[1] === x && f[2] === y);
  if (fixed) {
    if (fixed[0] === "mirror") {
      const cur = st.rot.get(key) || fixed[3];
      st.rot.set(key, cur === "/" ? "\\" : "/");
      return { changed: true, action: "rotate" };
    }
    return { changed: false, action: "denied" };
  }
  const p = st.placed.get(key);
  if (p) {
    if (p.o === "/") {
      p.o = "\\";
      return { changed: true, action: "rotate" };
    }
    st.placed.delete(key);
    return { changed: true, action: "remove" };
  }
  if (st.placed.size >= level.mirrors) return { changed: false, action: "denied" };
  st.placed.set(key, { o: "/" });
  return { changed: true, action: "place" };
}

/** Áp lời giải: entry [x,y,o] — xoay gương cố định hoặc đặt gương mới. */
export function applySolution(level, st, upTo = Infinity) {
  let n = 0;
  for (const [x, y, o] of level.solution) {
    if (n >= upTo) break;
    const key = `${x},${y}`;
    const fixed = level.fixed.find((f) => f[1] === x && f[2] === y);
    if (fixed && fixed[0] === "mirror") st.rot.set(key, o);
    else st.placed.set(key, { o });
    n += 1;
  }
  return st;
}

/** Số gương phải ĐẶT trong lời giải (par chấm sao). */
export function parOf(level) {
  let n = 0;
  for (const [x, y] of level.solution) {
    const fixed = level.fixed.find((f) => f[1] === x && f[2] === y);
    if (!fixed) n += 1;
  }
  return n;
}

/**
 * Gợi ý bước tiếp theo: entry lời giải đầu tiên chưa đúng trên board.
 * Trả về {x,y,o,kind:'rotate'|'place'} hoặc null nếu đã khớp hết.
 */
export function nextHint(level, st) {
  for (const [x, y, o] of level.solution) {
    const key = `${x},${y}`;
    const fixed = level.fixed.find((f) => f[1] === x && f[2] === y);
    if (fixed && fixed[0] === "mirror") {
      const cur = st.rot.get(key) || fixed[3];
      if (cur !== o) return { x, y, o, kind: "rotate" };
    } else {
      const p = st.placed.get(key);
      if (!p || p.o !== o) return { x, y, o, kind: "place" };
    }
  }
  return null;
}
