/**
 * utils.test.mjs — kiểm thử hàm tiện ích (điểm số, thời gian, RNG seed).
 */

import { test } from "node:test";
import assert from "node:assert/strict";

const { formatScore, formatTime, clamp, seededRand, lerp } = await import("../src/core/utils.js");

test("formatScore đệm 6 chữ số kiểu arcade", () => {
  assert.equal(formatScore(0), "000000");
  assert.equal(formatScore(2450), "002450");
  assert.equal(formatScore(1234567), "1234567");
  assert.equal(formatScore(-5), "000000");
  assert.equal(formatScore(12.9), "000012");
});

test("formatTime dạng mm:ss cho đồng hồ trận", () => {
  assert.equal(formatTime(90), "01:30");
  assert.equal(formatTime(84), "01:24");
  assert.equal(formatTime(0), "00:00");
  assert.equal(formatTime(9.2), "00:10"); // làm tròn lên như HUD đếm ngược
});

test("clamp và lerp", () => {
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(clamp(-2, 0, 3), 0);
  assert.equal(lerp(0, 10, 0.5), 5);
});

test("seededRand: cùng seed cho cùng chuỗi số (ổn định preview/map)", () => {
  const a = seededRand(404);
  const b = seededRand(404);
  const seqA = [a(), a(), a()];
  const seqB = [b(), b(), b()];
  assert.deepEqual(seqA, seqB);
  for (const v of seqA) assert.ok(v >= 0 && v < 1);

  const c = seededRand(405);
  assert.notDeepEqual(seqA, [c(), c(), c()]);
});
