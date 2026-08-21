/**
 * expansion11.test.mjs — unit test logic thuần cho gói expansion 11–15.
 * Chạy: ELECTRON_RUN_AS_NODE=1 /usr/share/cursor/cursor --test tools/expansion11.test.mjs
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CELL,
  WORLD,
  BALL_R,
  PADDLE_Y,
  SPEED_CAP,
  MAX_BALLS,
  MAX_LIVES,
  PADDLE_BASE_W,
  WIDE_SCALE,
  parseLevel,
  createMatch,
  stepMatch,
  drainEvents,
  applyPower,
  damageBrick,
  launchBall,
} from "../src/games/brick-breaker/engine.js";
import { LEVELS as BB_LEVELS } from "../src/games/brick-breaker/levels.js";
import {
  makeState,
  trace,
  actionAt,
  applySolution,
  parOf,
  nextHint,
} from "../src/games/laser-maze/engine.js";
import { LEVELS as LM_LEVELS } from "../src/games/laser-maze/levels.js";

/* ================== BRICK BREAKER 404 ================== */

test("brick-breaker: đủ 10 level, layout chữ nhật, có gạch phá được", () => {
  assert.ok(BB_LEVELS.length >= 10, `chỉ có ${BB_LEVELS.length} level`);
  for (const def of BB_LEVELS) {
    const w = def.rows[0].length;
    for (const row of def.rows) {
      assert.equal(row.length, w, `level ${def.id}: hàng lệch độ dài`);
      assert.ok(/^[.NREU]+$/.test(row), `level ${def.id}: ký tự lạ trong "${row}"`);
    }
    const lv = parseLevel(def);
    const breakable = lv.bricks.filter((b) => b.type !== CELL.UNBREAKABLE).length;
    assert.ok(breakable > 0, `level ${def.id}: không có gạch phá được`);
    assert.ok(def.ballSpeed <= SPEED_CAP, `level ${def.id}: ballSpeed vượt trần`);
  }
});

test("brick-breaker: bóng tốc độ trần KHÔNG xuyên qua một hàng gạch", () => {
  // một hàng gạch đầy — bắn thẳng đứng từ dưới lên với tốc độ trần
  const def = { id: 900, ballSpeed: SPEED_CAP, powerupChance: 0, rows: ["NNNNNNNNNNNNNN"] };
  const m = createMatch(def, { rand: () => 0.99 });
  const ball = m.balls[0];
  ball.stuck = false;
  ball.x = WORLD.w / 2;
  ball.y = 400;
  ball.vx = 0;
  ball.vy = -SPEED_CAP;
  ball.speed = SPEED_CAP;
  let bounced = false;
  for (let i = 0; i < 600; i++) {
    stepMatch(m, { move: 0, targetX: null, launch: false }, 1 / 60);
    if (ball.vy > 0) {
      bounced = true;
      break;
    }
    assert.ok(ball.y > 40, "bóng lọt qua hàng gạch (tunneling)");
  }
  assert.ok(bounced, "bóng phải bật lại sau khi phá gạch");
  assert.ok(m.bricksBroken >= 1, "phải phá được đúng gạch chắn đường");
});

test("brick-breaker: góc nảy paddle phụ thuộc vị trí chạm", () => {
  const def = { id: 901, ballSpeed: 400, powerupChance: 0, rows: ["N............."] };
  const hitAt = (rel) => {
    const m = createMatch(def, { rand: () => 0.99 });
    const ball = m.balls[0];
    m.paddle.x = WORLD.w / 2;
    ball.stuck = false;
    ball.x = WORLD.w / 2 + rel * (m.paddle.w / 2);
    ball.y = PADDLE_Y - BALL_R - 2;
    ball.vx = 0;
    ball.vy = 400;
    stepMatch(m, { move: 0, targetX: null, launch: false }, 1 / 60);
    return ball;
  };
  const center = hitAt(0);
  assert.ok(center.vy < 0, "chạm giữa: bật lên");
  assert.ok(Math.abs(center.vx) < 40, "chạm giữa: gần như thẳng đứng");
  const left = hitAt(-0.9);
  assert.ok(left.vy < 0 && left.vx < -200, `chạm mép trái phải văng chéo trái (vx=${left.vx.toFixed(0)})`);
  const right = hitAt(0.9);
  assert.ok(right.vy < 0 && right.vx > 200, "chạm mép phải phải văng chéo phải");
});

test("brick-breaker: multi-ball — mất mạng CHỈ khi quả cuối cùng rơi", () => {
  const def = { id: 902, ballSpeed: 400, powerupChance: 0, rows: ["NNNN.........."] };
  const m = createMatch(def, { rand: () => 0.99 });
  launchBall(m, m.balls[0]);
  applyPower(m, "multi");
  assert.equal(m.balls.length, 3, "multi phải sinh thêm 2 bóng");
  drainEvents(m);
  // ép 2 quả rơi
  for (const b of m.balls.slice(0, 2)) {
    b.y = WORLD.h + 200;
    b.vy = 100;
  }
  stepMatch(m, { move: 0, targetX: null, launch: false }, 1 / 60);
  assert.equal(m.balls.length, 1, "còn đúng 1 bóng");
  assert.equal(m.lives, 3, "chưa được trừ mạng khi vẫn còn bóng");
  // quả cuối rơi
  m.balls[0].y = WORLD.h + 200;
  stepMatch(m, { move: 0, targetX: null, launch: false }, 1 / 60);
  assert.equal(m.lives, 2, "mất đúng 1 mạng khi quả cuối rơi");
  assert.equal(m.balls.length, 1, "hồi sinh 1 bóng dính paddle");
  assert.ok(m.balls[0].stuck, "bóng hồi sinh phải dính paddle");
});

test("brick-breaker: gạch nổ phá lan 8 ô + dây chuyền, không đụng gạch thép", () => {
  const def = {
    id: 903,
    ballSpeed: 400,
    powerupChance: 0,
    rows: ["NNN...", "NEN...", "NNE...", "...U.."],
  };
  const m = createMatch(def, { rand: () => 0.99 });
  const eBrick = m.lv.grid.get("1,1");
  assert.equal(eBrick.type, CELL.EXPLOSIVE);
  damageBrick(m, eBrick, 1);
  // nổ (1,1) lan 8 ô quanh → trúng E (2,2) nổ dây chuyền
  const alive = m.lv.bricks.filter((b) => b.alive);
  assert.ok(alive.every((b) => b.type === CELL.UNBREAKABLE), `còn sót gạch thường: ${alive.length}`);
  const steel = m.lv.bricks.find((b) => b.type === CELL.UNBREAKABLE);
  assert.ok(steel.alive, "gạch thép không được vỡ vì nổ");
  assert.ok(m.cleared, "hết gạch phá được → cleared");
});

test("brick-breaker: gạch tăng cường cần 2 hit", () => {
  const def = { id: 904, ballSpeed: 400, powerupChance: 0, rows: ["R....."] };
  const m = createMatch(def, { rand: () => 0.99 });
  const b = m.lv.grid.get("0,0");
  damageBrick(m, b, 1);
  assert.ok(b.alive, "sau 1 hit vẫn sống (đã nứt)");
  assert.equal(b.hp, 1);
  damageBrick(m, b, 1);
  assert.ok(!b.alive, "hit thứ 2 phá vỡ");
});

test("brick-breaker: power-up wide không cộng dồn quá 1 nấc, life có trần", () => {
  const def = { id: 905, ballSpeed: 400, powerupChance: 0, rows: ["N....."] };
  const m = createMatch(def, { rand: () => 0.99 });
  applyPower(m, "wide");
  applyPower(m, "wide");
  applyPower(m, "wide");
  for (let i = 0; i < 240; i++) stepMatch(m, { move: 0, targetX: null, launch: false }, 1 / 60);
  assert.ok(m.paddle.w <= PADDLE_BASE_W * WIDE_SCALE + 1, `paddle w=${m.paddle.w} vượt 1 nấc wide`);
  for (let i = 0; i < 9; i++) applyPower(m, "life");
  assert.equal(m.lives, MAX_LIVES, "mạng có trần");
  for (let i = 0; i < 9; i++) applyPower(m, "multi");
  assert.ok(m.balls.length <= MAX_BALLS, "số bóng có trần");
});

test("brick-breaker: clear level khi chỉ còn gạch bất hoại", () => {
  const def = { id: 906, ballSpeed: 400, powerupChance: 0, rows: ["UNU..."] };
  const m = createMatch(def, { rand: () => 0.99 });
  assert.equal(m.breakableLeft, 1);
  damageBrick(m, m.lv.grid.get("1,0"), 1);
  assert.ok(m.cleared, "phá gạch thường cuối → cleared dù còn 2 gạch thép");
});

test("brick-breaker: chống kẹt quỹ đạo ngang — tự đá lệch sau ~2.2s", () => {
  const def = { id: 907, ballSpeed: 400, powerupChance: 0, rows: ["......"] };
  const m = createMatch(def, { rand: () => 0.5 });
  const ball = m.balls[0];
  ball.stuck = false;
  ball.x = WORLD.w / 2;
  ball.y = 300;
  ball.vx = 400;
  ball.vy = 0.5; // gần như thuần ngang
  ball.speed = 400;
  let kicked = false;
  for (let i = 0; i < 400; i++) {
    stepMatch(m, { move: 0, targetX: null, launch: false }, 1 / 60);
    const sp = Math.hypot(ball.vx, ball.vy);
    if (Math.abs(ball.vy) > sp * 0.2) {
      kicked = true;
      break;
    }
  }
  assert.ok(kicked, "quỹ đạo ngang phải bị đá lệch");
});

/* ================== LASER MAZE 404 ================== */

test("laser-maze: đủ 20 level, board 7×6 → 12×10", () => {
  assert.ok(LM_LEVELS.length >= 20, `chỉ có ${LM_LEVELS.length} level`);
  assert.equal(LM_LEVELS[0].w, 7);
  assert.equal(LM_LEVELS[0].h, 6);
  const last = LM_LEVELS[LM_LEVELS.length - 1];
  assert.equal(last.w, 12);
  assert.equal(last.h, 10);
  for (const lv of LM_LEVELS) {
    for (const f of lv.fixed) {
      assert.ok(f[1] >= 0 && f[1] < lv.w && f[2] >= 0 && f[2] < lv.h, `level ${lv.id}: ${f[0]} ngoài board`);
    }
  }
});

for (const lv of LM_LEVELS) {
  test(`laser-maze: level ${lv.id} (${lv.name}) — lời giải kiểm chứng`, () => {
    const empty = trace(lv, makeState());
    assert.ok(!empty.done, "level không được tự giải sẵn");
    const st = applySolution(lv, makeState());
    const r = trace(lv, st);
    assert.ok(r.done, `lời giải không thắp đủ receiver (${r.ok}/${r.total})`);
    assert.ok(st.placed.size <= lv.mirrors, `lời giải dùng ${st.placed.size} gương > giới hạn ${lv.mirrors}`);
    assert.equal(parOf(lv), st.placed.size, "par phải bằng số gương đặt trong lời giải");
  });
}

test("laser-maze: không treo khi 4 gương tạo vòng lặp kín", () => {
  const lv = {
    id: 990,
    w: 6,
    h: 6,
    mirrors: 0,
    fixed: [
      ["source", 0, 1, "R"],
      ["receiver", 5, 5, "red"],
      ["mirror", 1, 1, "\\"],
      ["mirror", 4, 1, "\\"],
      ["mirror", 4, 4, "/"],
      ["mirror", 1, 4, "/"],
    ],
    solution: [],
  };
  const t0 = Date.now();
  const r = trace(lv, makeState());
  assert.ok(Date.now() - t0 < 500, "trace phải kết thúc nhanh (loop guard)");
  assert.ok(!r.done);
  assert.ok(r.segs.length < 200, "vòng lặp phải bị cắt bởi visited-state");
});

test("laser-maze: splitter không nhân tia vô hạn (2 splitter đối nhau)", () => {
  const lv = {
    id: 991,
    w: 8,
    h: 4,
    mirrors: 0,
    fixed: [
      ["source", 0, 1, "R"],
      ["splitter", 2, 1, "\\"],
      ["splitter", 5, 1, "/"],
      ["mirror", 2, 3, "/"],
      ["mirror", 5, 3, "\\"],
      ["receiver", 7, 1, "red"],
    ],
    solution: [],
  };
  const t0 = Date.now();
  const r = trace(lv, makeState());
  assert.ok(Date.now() - t0 < 500);
  assert.ok(r.segs.length < 400, `tia bùng nổ: ${r.segs.length} đoạn`);
});

test("laser-maze: filter nhuộm tia đỏ và CHẶN tia khác màu", () => {
  const lv = {
    id: 992,
    w: 8,
    h: 3,
    mirrors: 0,
    fixed: [
      ["source", 0, 1, "R"],
      ["filter", 2, 1, "cyan"],
      ["filter", 4, 1, "violet"],
      ["receiver", 7, 1, "cyan"],
    ],
    solution: [],
  };
  const r = trace(lv, makeState());
  // đỏ → cyan tại filter 1; cyan tới filter violet phải BỊ CHẶN
  assert.ok(!r.done, "tia cyan không được xuyên filter tím");
  const litSeg = r.segs.find((s) => s.color === "cyan");
  assert.ok(litSeg, "sau filter cyan tia phải đổi màu cyan");
});

test("laser-maze: receiver chỉ nhận đúng màu", () => {
  const lv = {
    id: 993,
    w: 6,
    h: 3,
    mirrors: 0,
    fixed: [
      ["source", 0, 1, "R"],
      ["receiver", 5, 1, "cyan"],
    ],
    solution: [],
  };
  const r = trace(lv, makeState());
  assert.ok(!r.done, "tia đỏ không thỏa receiver cyan");
  const lit = r.lit.get("5,1");
  assert.ok(lit && lit.has("red"), "tia vẫn ghi nhận chạm receiver (sai màu)");
});

test("laser-maze: actionAt — đặt / xoay / gỡ / giới hạn kho", () => {
  const lv = LM_LEVELS[0];
  const st = makeState();
  assert.equal(actionAt(lv, st, 3, 3).action, "place");
  assert.equal(st.placed.get("3,3").o, "/");
  assert.equal(actionAt(lv, st, 3, 3).action, "rotate");
  assert.equal(st.placed.get("3,3").o, "\\");
  // kho đã hết (mirrors=1) → ô khác bị từ chối
  assert.equal(actionAt(lv, st, 2, 2).action, "denied");
  assert.equal(actionAt(lv, st, 3, 3).action, "remove");
  assert.ok(!st.placed.has("3,3"));
  // không đặt đè lên thành phần cố định
  assert.equal(actionAt(lv, st, 0, 3).action, "denied");
});

test("laser-maze: hint trả về đúng bước lời giải tiếp theo", () => {
  const lv = LM_LEVELS[2]; // XOAY GƯƠNG: 2 gương cố định sai hướng
  const st = makeState();
  const h1 = nextHint(lv, st);
  assert.deepEqual({ x: h1.x, y: h1.y, o: h1.o, kind: h1.kind }, { x: 2, y: 3, o: "/", kind: "rotate" });
  st.rot.set("2,3", "/");
  const h2 = nextHint(lv, st);
  assert.equal(h2.kind, "rotate");
  st.rot.set("2,1", "/");
  assert.equal(nextHint(lv, st), null, "khớp lời giải → hết gợi ý");
  assert.ok(trace(lv, st).done, "áp đủ hint phải giải được màn");
});
