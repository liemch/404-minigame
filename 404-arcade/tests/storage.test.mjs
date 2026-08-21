/**
 * storage.test.mjs — kiểm thử namespace lưu trữ, điểm cao và prefs.
 * Chạy: node --test tests/  (hoặc ELECTRON_RUN_AS_NODE=1 cursor --test tests/)
 */

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Stub localStorage tối giản cho môi trường Node
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { createStorage } = await import("../src/core/storage.js");

beforeEach(() => store.clear());

test("điểm mặc định là 0/0", () => {
  const s = createStorage("t1");
  assert.deepEqual(s.getScores("runner"), { last: 0, best: 0 });
});

test("saveScore cập nhật last, giữ best và cờ isRecord", () => {
  const s = createStorage("t1");
  const first = s.saveScore("runner", 120);
  assert.deepEqual(first, { last: 120, best: 120, isRecord: true });

  const lower = s.saveScore("runner", 80);
  assert.deepEqual(lower, { last: 80, best: 120, isRecord: false });

  const higher = s.saveScore("runner", 300);
  assert.deepEqual(higher, { last: 300, best: 300, isRecord: true });
});

test("điểm âm/không hợp lệ bị chặn về 0", () => {
  const s = createStorage("t1");
  assert.equal(s.saveScore("snake", -50).last, 0);
});

test("hai prefix là hai namespace độc lập", () => {
  const a = createStorage("siteA");
  const b = createStorage("siteB");
  a.saveScore("snake", 999);
  assert.equal(b.getScores("snake").best, 0);
  assert.equal(a.getScores("snake").best, 999);
});

test("resetHighScores xóa toàn bộ điểm nhưng giữ prefs", () => {
  const s = createStorage("t1");
  s.saveScore("strike", 5000);
  s.setPref("volume", 0.5);
  s.resetHighScores();
  assert.equal(s.getScores("strike").best, 0);
  assert.equal(s.getPref("volume"), 0.5);
});

test("âm thanh: mặc định tắt, lưu lựa chọn người dùng", () => {
  const s = createStorage("t1");
  assert.equal(s.getSound(false), false);
  s.setSound(true);
  assert.equal(s.getSound(false), true);
});

test("dữ liệu hỏng trong localStorage không làm vỡ API", () => {
  store.set("bad:v1", "{not-json!!");
  const s = createStorage("bad");
  assert.deepEqual(s.getScores("runner"), { last: 0, best: 0 });
  assert.doesNotThrow(() => s.saveScore("runner", 10));
});
