/**
 * portal-solver.mjs — BFS tìm lời giải ngắn nhất cho 15 level Portal
 * Puzzle. Dùng khi thiết kế level: in ra hint (chuỗi bước tối ưu) + par
 * để dán vào levels.js. Chạy:
 *   ELECTRON_RUN_AS_NODE=1 /usr/share/cursor/cursor tools/portal-solver.mjs
 */

import { parseLevel, stepPure } from "../src/games/portal-puzzle/engine.js";
import { LEVELS } from "../src/games/portal-puzzle/levels.js";

const DIR_CHARS = ["U", "D", "L", "R"];

function keyOf(snap) {
  const crates = snap.crates
    .map((c) => c.x + c.y * 100)
    .sort((a, b) => a - b)
    .join(",");
  return `${snap.player.x},${snap.player.y}|${crates}|${snap.toggles.map((t) => (t ? 1 : 0)).join("")}`;
}

function solve(def, capVisited = 600000) {
  const { level, snap } = parseLevel(def);
  const visited = new Set([keyOf(snap)]);
  let frontier = [{ snap, path: "" }];
  while (frontier.length) {
    const next = [];
    for (const node of frontier) {
      for (const d of DIR_CHARS) {
        const r = stepPure(level, node.snap, d);
        if (r.denied) continue;
        if (r.completed) return { path: node.path + d, visited: visited.size };
        const k = keyOf(r.snap);
        if (visited.has(k)) continue;
        visited.add(k);
        if (visited.size > capVisited) return { path: null, visited: visited.size, overflow: true };
        next.push({ snap: r.snap, path: node.path + d });
      }
    }
    frontier = next;
  }
  return { path: null, visited: visited.size };
}

let allOk = true;
for (const def of LEVELS) {
  const t0 = Date.now();
  const r = solve(def);
  const ms = Date.now() - t0;
  if (!r.path) {
    allOk = false;
    console.log(`LEVEL ${String(def.id).padStart(2, "0")}  KHÔNG CÓ LỜI GIẢI ${r.overflow ? "(overflow)" : ""}  visited=${r.visited}  ${ms}ms`);
  } else {
    const margin = Math.max(4, Math.ceil(r.path.length * 0.45));
    console.log(
      `LEVEL ${String(def.id).padStart(2, "0")}  par=${r.path.length}  maxMoves=${r.path.length + margin}  visited=${r.visited}  ${ms}ms\n  hint: "${r.path}",`
    );
  }
}
process.exit(allOk ? 0 : 1);
