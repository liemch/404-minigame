/**
 * registry.test.mjs — kiểm thử game registry: đủ 5 game, id duy nhất,
 * loader lazy là function, lọc enabled-games hoạt động đúng.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

const { GAMES, getGame, enabledGames } = await import("../src/core/game-registry.js");

test("đăng ký đủ 5 game theo plan", () => {
  assert.equal(GAMES.length, 5);
  assert.deepEqual(
    GAMES.map((g) => g.id),
    ["runner", "bug-hunter", "stack-tower", "snake", "strike"]
  );
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

test("getGame trả null với id lạ", () => {
  assert.equal(getGame("doom"), null);
});

test("enabledGames lọc và giữ thứ tự registry", () => {
  const subset = enabledGames(["snake", "runner"]);
  assert.deepEqual(subset.map((g) => g.id), ["runner", "snake"]);
  // rỗng → tất cả
  assert.equal(enabledGames([]).length, 5);
  // id lạ bị bỏ qua
  assert.deepEqual(enabledGames(["snake", "doom"]).map((g) => g.id), ["snake"]);
});
