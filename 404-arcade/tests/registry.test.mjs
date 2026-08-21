/**
 * registry.test.mjs — kiểm thử game registry: đủ 21 game (5 gốc +
 * expansion 6–10, 11–15, 16–20), id duy nhất, loader lazy là function,
 * lọc enabled-games hoạt động đúng.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

const { GAMES, getGame, enabledGames } = await import("../src/core/game-registry.js");

const ALL_IDS = [
  "runner", "bug-hunter", "stack-tower", "snake", "strike",
  "portal-puzzle", "void-runner", "neon-drift", "cyber-defense", "rogue-arena", "rhythm-hack",
  "brick-breaker", "laser-maze", "pixel-golf", "typing-rush", "astro-patrol",
  "neon-pinball", "gravity-flip", "memory-matrix", "cyber-goal", "stealth-escape",
];

test("đăng ký đủ 21 game theo plan (5 gốc + 3 đợt expansion)", () => {
  assert.equal(GAMES.length, 21);
  assert.deepEqual(GAMES.map((g) => g.id), ALL_IDS);
});

test("id không trùng nhau", () => {
  const ids = new Set(GAMES.map((g) => g.id));
  assert.equal(ids.size, GAMES.length);
});

test("mỗi game có metadata bắt buộc + loader lazy", () => {
  for (const g of GAMES) {
    assert.ok(g.title, `${g.id} thiếu title`);
    assert.ok(g.accent, `${g.id} thiếu accent`);
    assert.ok(g.goal, `${g.id} thiếu goal`);
    assert.equal(typeof g.loader, "function", `${g.id} loader phải là function (dynamic import)`);
    assert.ok(Array.isArray(g.controls) && g.controls.length > 0, `${g.id} thiếu controls`);
  }
});

test("404 Strike là game 3D fullBleed tự quản kết quả", () => {
  const strike = getGame("strike");
  assert.ok(strike);
  assert.equal(strike.kind, "3d");
  assert.equal(strike.fullBleed, true);
  assert.equal(strike.ownResults, true);
});

test("expansion 16–20 đều là 2D fullBleed tự quản kết quả", () => {
  for (const id of ["neon-pinball", "gravity-flip", "memory-matrix", "cyber-goal", "stealth-escape"]) {
    const g = getGame(id);
    assert.ok(g, `thiếu ${id}`);
    assert.equal(g.kind, "2d", `${id} phải là 2d`);
    assert.equal(g.fullBleed, true, `${id} phải fullBleed`);
    assert.equal(g.ownResults, true, `${id} phải ownResults`);
  }
});

test("getGame trả null với id lạ", () => {
  assert.equal(getGame("doom"), null);
});

test("enabledGames lọc và giữ thứ tự registry", () => {
  const subset = enabledGames(["snake", "runner"]);
  assert.deepEqual(subset.map((g) => g.id), ["runner", "snake"]);
  // rỗng → tất cả
  assert.equal(enabledGames([]).length, 21);
  // id lạ bị bỏ qua
  assert.deepEqual(enabledGames(["snake", "doom"]).map((g) => g.id), ["snake"]);
});
