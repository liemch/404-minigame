/**
 * expansion5.test.mjs — unit test logic thuần cho gói expansion (game 6–10).
 * Chạy: ELECTRON_RUN_AS_NODE=1 /usr/share/cursor/cursor --test tools/expansion5.test.mjs
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { parseLevel, stepPure, runSolution, computeBeams, exitOpen } from "../src/games/portal-puzzle/engine.js";
import { LEVELS } from "../src/games/portal-puzzle/levels.js";

/* ---------------- Portal Puzzle: 15 level có lời giải hợp lệ ---------------- */

test("portal-puzzle: đủ 15 level", () => {
  assert.equal(LEVELS.length, 15);
});

for (const def of LEVELS) {
  test(`portal-puzzle: level ${def.id} — hint giải được trong giới hạn bước`, () => {
    assert.ok(def.hint.length > 0, "level phải có hint lưu sẵn");
    const r = runSolution(def, def.hint);
    assert.ok(r.ok, `lời giải fail tại bước ${r.at} (${r.reason})`);
    assert.ok(r.moves <= def.maxMoves, `lời giải ${r.moves} bước vượt maxMoves ${def.maxMoves}`);
    assert.equal(r.moves, def.par, "par phải bằng độ dài lời giải tối ưu");
    assert.ok(def.maxMoves >= def.par + 4, "maxMoves phải có biên độ dư");
  });
}

test("portal-puzzle: không đẩy được 2 thùng cùng lúc", () => {
  const def = {
    id: 900,
    maxMoves: 10,
    exitRequires: [],
    lasers: [],
    map: ["#######", "#PCC.E#", "#######"],
  };
  const { level, snap } = parseLevel(def);
  const r = stepPure(level, snap, "R");
  assert.equal(r.denied, "crate");
});

test("portal-puzzle: không đi xuyên tường / không kéo thùng", () => {
  const def = {
    id: 901,
    maxMoves: 10,
    exitRequires: [],
    lasers: [],
    map: ["#####", "#P.E#", "#####"],
  };
  const { level, snap } = parseLevel(def);
  assert.equal(stepPure(level, snap, "U").denied, "wall");
  assert.equal(stepPure(level, snap, "L").denied, "wall");
});

test("portal-puzzle: laser chặn người nhưng thùng chặn laser", () => {
  const def = {
    id: 902,
    maxMoves: 20,
    exitRequires: [],
    lasers: [{ x: 0, y: 3, dir: "R", off: null }],
    map: ["#######", "#..P..#", "#..C..#", "#.....#", "#....E#", "#######"],
  };
  const { level, snap } = parseLevel(def);
  // Tia phủ hàng y=3: người không được bước vào
  const side = stepPure(level, { ...snap, player: { x: 1, y: 2 }, crates: [], toggles: [] }, "D");
  assert.equal(side.denied, "laser");
  // Đẩy thùng VÀO tia theo phương vuông góc: hợp lệ, thùng chặn tia
  const r = stepPure(level, snap, "D"); // crate (3,2) → (3,3) nằm trong tia, player (3,2) an toàn
  assert.ok(!r.denied && r.events.pushed, "đẩy thùng vào tia phải hợp lệ");
  const beams = computeBeams(level, r.snap);
  assert.ok(beams.has(3 * level.w + 2), "phía trước thùng vẫn có tia");
  assert.ok(!beams.has(3 * level.w + 4), "phía sau thùng tia bị chặn");
  // Đẩy thùng DỌC THEO tia làm tia phủ lại ô người đứng → phải bị cấm
  const along = stepPure(level, { ...r.snap, player: { x: 2, y: 3 } }, "R");
  assert.equal(along.denied, "laser", "không được tự đẩy mình vào tia hở");
});

test("portal-puzzle: portal 2 chiều, teleport đúng 1 lần mỗi bước (không loop)", () => {
  const def = {
    id: 903,
    maxMoves: 10,
    exitRequires: [],
    lasers: [],
    map: ["######", "#P1.E#", "#..1.#", "######"],
  };
  const { level, snap } = parseLevel(def);
  const r = stepPure(level, snap, "R");
  assert.ok(!r.denied);
  assert.deepEqual({ x: r.snap.player.x, y: r.snap.player.y }, { x: 3, y: 2 }, "teleport tới đầu kia rồi DỪNG");
  assert.ok(r.events.teleported);
});

test("portal-puzzle: công tắc giữ mở lối thoát khi có thùng đè", () => {
  const def = {
    id: 904,
    maxMoves: 20,
    exitRequires: ["blue"],
    lasers: [],
    map: ["#######", "#PCs.E#", "#######"],
  };
  const { level, snap } = parseLevel(def);
  assert.equal(exitOpen(level, snap), false);
  const r = stepPure(level, snap, "R"); // đẩy thùng lên công tắc
  assert.ok(!r.denied);
  assert.equal(exitOpen(level, r.snap), true);
  // Đẩy thùng ra: NGƯỜI đứng lên công tắc thay thế → cửa vẫn mở
  const r2 = stepPure(level, r.snap, "R");
  assert.ok(!r2.denied && r2.events.pushed);
  assert.equal(exitOpen(level, r2.snap), true, "người đè công tắc giữ thì cửa vẫn mở");
  // Người rời công tắc (lùi lại) → không còn gì đè → cửa đóng
  const r3 = stepPure(level, r2.snap, "L");
  assert.ok(!r3.denied);
  assert.equal(exitOpen(level, r3.snap), false, "rời công tắc giữ thì cửa phải đóng lại");
});
