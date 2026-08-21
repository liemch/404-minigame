/**
 * engine.js — logic thuần của Portal Puzzle 404 (không DOM, test được
 * bằng node --test). Board lưới: tường, thùng đẩy (không kéo, không đẩy
 * 2 thùng), công tắc giữ/bật-tắt (xanh/tím), portal 2 chiều cyan/tím
 * (teleport 1 lần mỗi bước — không loop), laser chặn đường khi chưa tắt,
 * cửa thoát mở khi đủ điều kiện, giới hạn bước.
 *
 * Quy tắc an toàn laser: mọi tính hợp lệ đều xét trên TRẠNG THÁI SAU KHI
 * bước hoàn tất (thùng đã trượt, công tắc đã lật) — người chơi không bao
 * giờ được đứng trong tia laser đang bật.
 */

export const DIRS = {
  U: { x: 0, y: -1 },
  D: { x: 0, y: 1 },
  L: { x: -1, y: 0 },
  R: { x: 1, y: 0 },
};

const PORTAL_CHARS = { 1: "cyan", 2: "violet" };
const SWITCH_CHARS = {
  s: { color: "blue", mode: "hold" },
  S: { color: "blue", mode: "toggle" },
  t: { color: "violet", mode: "hold" },
  T: { color: "violet", mode: "toggle" },
};

/**
 * Parse định nghĩa level (map ASCII + lasers) thành cấu trúc tĩnh + snap
 * khởi đầu. Ký tự map: '#' tường · '.' sàn · ' ' khoảng trống (đặc) ·
 * 'P' người chơi · 'C' thùng · 'E' lối thoát · s/S công tắc xanh
 * giữ/bật-tắt · t/T công tắc tím · '1' cặp portal cyan · '2' cặp portal
 * tím. Laser khai báo riêng: { x, y, dir, off } (off = màu công tắc tắt
 * được tia này).
 */
export function parseLevel(def) {
  const rows = def.map;
  const h = rows.length;
  const w = rows[0].length;
  const solid = new Uint8Array(w * h);
  const level = {
    id: def.id,
    name: def.name || `MÀN ${def.id}`,
    w,
    h,
    solid,
    switches: [], // {x,y,color,mode}
    portals: [], // {x,y,color,pair} — pair = index endpoint kia
    lasers: (def.lasers || []).map((l) => ({ ...l })),
    exit: null,
    exitRequires: def.exitRequires || [],
    maxMoves: def.maxMoves,
    par: def.par || def.maxMoves,
    hint: def.hint || "",
    intro: def.intro || "",
  };
  let player = null;
  const crates = [];
  const toggles = [];
  const portalByColor = { cyan: [], violet: [] };

  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < w; x++) {
      const ch = x < row.length ? row[x] : " ";
      const i = y * w + x;
      if (ch === "#" || ch === " ") {
        solid[i] = ch === "#" ? 1 : 2; // 2 = void (đặc, không vẽ)
        continue;
      }
      if (ch === "P") player = { x, y };
      else if (ch === "C") crates.push({ x, y });
      else if (ch === "E") level.exit = { x, y };
      else if (SWITCH_CHARS[ch]) {
        const sw = SWITCH_CHARS[ch];
        level.switches.push({ x, y, color: sw.color, mode: sw.mode });
        if (sw.mode === "toggle") toggles.push(false);
      } else if (PORTAL_CHARS[ch]) {
        portalByColor[PORTAL_CHARS[ch]].push({ x, y, color: PORTAL_CHARS[ch] });
      }
    }
  }

  for (const color of ["cyan", "violet"]) {
    const pts = portalByColor[color];
    if (pts.length === 2) {
      const a = level.portals.length;
      level.portals.push({ ...pts[0], pair: a + 1 });
      level.portals.push({ ...pts[1], pair: a });
    }
  }

  // Emitter laser là ô đặc
  for (const l of level.lasers) solid[l.y * w + l.x] = 1;

  const snap = {
    player,
    crates,
    toggles, // theo thứ tự switch mode=toggle trong level.switches
    moves: 0,
  };
  return { level, snap };
}

export function cloneSnap(s) {
  return {
    player: { x: s.player.x, y: s.player.y },
    crates: s.crates.map((c) => ({ x: c.x, y: c.y })),
    toggles: s.toggles.slice(),
    moves: s.moves,
  };
}

const idx = (level, x, y) => y * level.w + x;

export function isSolid(level, x, y) {
  if (x < 0 || y < 0 || x >= level.w || y >= level.h) return true;
  return level.solid[idx(level, x, y)] !== 0;
}

export function crateAt(snap, x, y) {
  for (let i = 0; i < snap.crates.length; i++) {
    if (snap.crates[i].x === x && snap.crates[i].y === y) return i;
  }
  return -1;
}

export function portalAt(level, x, y) {
  for (const p of level.portals) {
    if (p.x === x && p.y === y) return p;
  }
  return null;
}

function toggleIndexAt(level, x, y) {
  let ti = 0;
  for (const sw of level.switches) {
    if (sw.mode !== "toggle") continue;
    if (sw.x === x && sw.y === y) return ti;
    ti++;
  }
  return -1;
}

/** Một màu công tắc đang "kích hoạt" — mọi công tắc màu đó đều bật. */
export function colorActive(level, snap, color) {
  let count = 0;
  let ti = 0;
  for (const sw of level.switches) {
    const isToggle = sw.mode === "toggle";
    const myTi = isToggle ? ti++ : -1;
    if (sw.color !== color) continue;
    count++;
    if (isToggle) {
      if (!snap.toggles[myTi]) return false;
    } else {
      const occupied =
        (snap.player.x === sw.x && snap.player.y === sw.y) || crateAt(snap, sw.x, sw.y) >= 0;
      if (!occupied) return false;
    }
  }
  return count > 0;
}

/** Tập ô đang bị tia laser bao phủ (Set index). Thùng chặn tia. */
export function computeBeams(level, snap) {
  const beams = new Set();
  for (const l of level.lasers) {
    if (l.off && colorActive(level, snap, l.off)) continue;
    const d = DIRS[l.dir];
    let x = l.x + d.x;
    let y = l.y + d.y;
    while (!isSolid(level, x, y) && crateAt(snap, x, y) < 0) {
      beams.add(idx(level, x, y));
      x += d.x;
      y += d.y;
    }
  }
  return beams;
}

export function exitOpen(level, snap) {
  for (const color of level.exitRequires) {
    if (!colorActive(level, snap, color)) return false;
  }
  return true;
}

/**
 * Thực hiện một bước thuần túy: trả về { snap, events } mới hoặc
 * { denied } (không đổi state). events: pushed, teleported (player),
 * crateTeleported, toggled, steppedSwitch.
 */
export function stepPure(level, snap, dirChar) {
  const d = DIRS[dirChar];
  if (!d) return { denied: "input" };
  const px = snap.player.x;
  const py = snap.player.y;
  const tx = px + d.x;
  const ty = py + d.y;
  if (isSolid(level, tx, ty)) return { denied: "wall" };

  const next = cloneSnap(snap);
  const events = { pushed: false, teleported: null, crateTeleported: null, toggled: false };

  const ci = crateAt(next, tx, ty);
  if (ci >= 0) {
    const cx2 = tx + d.x;
    const cy2 = ty + d.y;
    // Không đẩy 2 thùng, không đẩy vào tường/emitter, không đẩy lên lối thoát
    if (isSolid(level, cx2, cy2)) return { denied: "wall" };
    if (crateAt(next, cx2, cy2) >= 0) return { denied: "crate" };
    if (level.exit.x === cx2 && level.exit.y === cy2) return { denied: "exit" };
    let cfx = cx2;
    let cfy = cy2;
    const p = portalAt(level, cx2, cy2);
    if (p) {
      const q = level.portals[p.pair];
      const free =
        !isSolid(level, q.x, q.y) &&
        crateAt(next, q.x, q.y) < 0 &&
        !(next.player.x === q.x && next.player.y === q.y) &&
        !(level.exit.x === q.x && level.exit.y === q.y);
      if (free) {
        cfx = q.x;
        cfy = q.y;
        events.crateTeleported = { from: { x: cx2, y: cy2 }, to: { x: q.x, y: q.y }, color: p.color };
      }
    }
    next.crates[ci].x = cfx;
    next.crates[ci].y = cfy;
    events.pushed = true;
    const cti = toggleIndexAt(level, cfx, cfy);
    if (cti >= 0) {
      next.toggles[cti] = !next.toggles[cti];
      events.toggled = true;
    }
  }

  // Vị trí người chơi: bước tới, có thể teleport qua portal (1 lần)
  let fx = tx;
  let fy = ty;
  const pp = portalAt(level, tx, ty);
  let usedPortal = null;
  if (pp) {
    const q = level.portals[pp.pair];
    if (!isSolid(level, q.x, q.y) && crateAt(next, q.x, q.y) < 0) {
      usedPortal = { from: { x: tx, y: ty }, to: { x: q.x, y: q.y }, color: pp.color };
      fx = q.x;
      fy = q.y;
    }
  }

  const tryFinal = (x, y) => {
    const cand = cloneSnap(next);
    cand.player.x = x;
    cand.player.y = y;
    const ti = toggleIndexAt(level, x, y);
    let toggledPlayer = false;
    if (ti >= 0) {
      cand.toggles[ti] = !cand.toggles[ti];
      toggledPlayer = true;
    }
    const beams = computeBeams(level, cand);
    if (beams.has(idx(level, x, y))) return null;
    return { cand, toggledPlayer };
  };

  let final = tryFinal(fx, fy);
  if (!final && usedPortal) {
    // Cửa ra portal bị laser — portal từ chối, đứng lại trên ô portal
    usedPortal = null;
    final = tryFinal(tx, ty);
  }
  if (!final) return { denied: "laser" };

  const out = final.cand;
  out.moves = snap.moves + 1;
  if (usedPortal) events.teleported = usedPortal;
  if (final.toggledPlayer) events.toggled = true;
  const onSwitch = level.switches.some((sw) => sw.x === out.player.x && sw.y === out.player.y);
  events.steppedSwitch = onSwitch;
  const completed = out.player.x === level.exit.x && out.player.y === level.exit.y && exitOpen(level, out);
  return { snap: out, events, completed };
}

/** Chạy chuỗi lời giải trên level — dùng cho unit test 15 level. */
export function runSolution(def, solution) {
  const { level, snap } = parseLevel(def);
  let cur = snap;
  for (let i = 0; i < solution.length; i++) {
    const r = stepPure(level, cur, solution[i]);
    if (r.denied) return { ok: false, at: i, reason: r.denied, moves: cur.moves };
    cur = r.snap;
    if (r.completed) {
      return { ok: true, moves: cur.moves, extraInput: i < solution.length - 1 };
    }
  }
  return { ok: false, at: solution.length, reason: "not-completed", moves: cur.moves };
}
