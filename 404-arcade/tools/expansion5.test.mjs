/**
 * expansion5.test.mjs — unit test logic thuần cho gói expansion (game 6–10).
 * Chạy: ELECTRON_RUN_AS_NODE=1 /usr/share/cursor/cursor --test tools/expansion5.test.mjs
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { parseLevel, stepPure, runSolution, computeBeams, exitOpen } from "../src/games/portal-puzzle/engine.js";
import { LEVELS } from "../src/games/portal-puzzle/levels.js";
import { createSim } from "../src/games/cyber-defense/engine.js";
import { WAVES as CD_WAVES, TOWERS as CD_TOWERS } from "../src/games/cyber-defense/data.js";

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

/* ---------------- Cyber Defense: economy + mô phỏng trọn trận ---------------- */

test("cyber-defense: đủ 8 wave data-driven", () => {
  assert.equal(CD_WAVES.length, 8);
  for (const w of CD_WAVES) {
    assert.ok(w.groups.length > 0);
    for (const gr of w.groups) {
      assert.ok(gr.count > 0 && gr.intervalMs > 0);
    }
  }
});

test("cyber-defense: economy — không chi tiêu khi thiếu năng lượng, pad bận, max cấp, bán hoàn 70%", () => {
  const sim = createSim({ test: true });
  // xây hợp lệ
  const b1 = sim.buildAt(4, "rapid");
  assert.ok(b1.ok);
  assert.equal(sim.energy, 400 - 100);
  // pad bận
  assert.equal(sim.buildAt(4, "blast").ok, false);
  // tháp khóa theo wave
  assert.equal(sim.canBuild("sniper").ok, false);
  assert.equal(sim.canBuild("sniper").reason, "locked");
  // đốt sạch năng lượng rồi thử xây → từ chối vì thiếu
  sim.energy = 40;
  const b2 = sim.buildAt(5, "rapid");
  assert.equal(b2.ok, false);
  assert.equal(b2.reason, "energy");
  assert.equal(sim.energy, 40, "không được trừ năng lượng khi build fail");
  // nâng cấp 2 lần (max 3 cấp) rồi từ chối
  sim.energy = 1000;
  const t = b1.tower;
  assert.ok(sim.upgrade(t.id).ok);
  assert.ok(sim.upgrade(t.id).ok);
  const up3 = sim.upgrade(t.id);
  assert.equal(up3.ok, false);
  assert.equal(up3.reason, "max");
  // bán hoàn 70% tổng đầu tư (100 + 80 + 130)
  const expectRefund = Math.round((100 + 80 + 130) * 0.7);
  const before = sim.energy;
  const s = sim.sell(t.id);
  assert.ok(s.ok);
  assert.equal(s.refund, expectRefund);
  assert.equal(sim.energy, before + expectRefund);
  assert.equal(sim.towers.length, 0);
});

test("cyber-defense: upgrade tăng đúng chỉ số theo bảng data", () => {
  for (const [type, def] of Object.entries(CD_TOWERS)) {
    for (let i = 1; i < def.levels.length; i++) {
      assert.ok(def.levels[i].dmg > def.levels[i - 1].dmg, `${type} dmg tăng theo cấp`);
      assert.ok(def.levels[i].range >= def.levels[i - 1].range, `${type} range không giảm`);
      assert.ok(def.levels[i].cost > 0, `${type} có giá nâng cấp`);
    }
  }
});

test("cyber-defense: slow không cộng dồn vô hạn", () => {
  const sim = createSim({ test: true });
  sim.buildAt(4, "slow");
  // giả lập enemy đứng trong tầm
  sim.enemies.push({
    id: 999, type: "basic", lane: "A", dist: 500, x: 760, y: 300,
    hp: 1000, maxHp: 1000, shield: 0, maxShield: 0, speed: 60,
    slowUntil: 0, slowFactor: 1, reward: 0, coreDmg: 1, escore: 0, r: 13, alive: true,
  });
  sim.phase = "running";
  sim.spawnList = [];
  for (let i = 0; i < 40; i++) sim.update(0.1);
  const e = sim.enemies.find((x) => x.id === 999);
  assert.ok(e, "enemy còn sống");
  assert.ok(e.slowFactor >= 0.5, `slowFactor không được cộng dồn dưới mức tháp (${e.slowFactor})`);
});

test("cyber-defense: mô phỏng trọn trận — thắng sau wave 8, core còn máu", () => {
  const sim = createSim({ test: true });
  // chiến thuật dựng sẵn: ưu tiên các pad quanh điểm hợp nhất
  const plan = [
    [4, "rapid"], [12, "rapid"], [5, "slow"], [11, "blast"],
    [3, "rapid"], [8, "blast"], [1, "rapid"], [10, "slow"],
    [0, "rapid"], [7, "rapid"], [13, "blast"], [2, "rapid"],
  ];
  let planIdx = 0;
  let simTime = 0;
  const dt = 1 / 30;
  while (sim.phase !== "victory" && sim.phase !== "defeat" && simTime < 900) {
    // xây dần khi đủ năng lượng
    while (planIdx < plan.length) {
      const [pad, type] = plan[planIdx];
      const r = sim.buildAt(pad, type);
      if (r.ok) planIdx += 1;
      else break;
    }
    // hết plan → dồn tiền nâng cấp
    if (planIdx >= plan.length) {
      for (const t of sim.towers) {
        const cost = sim.upgradeCost(t);
        if (cost !== null && sim.energy >= cost + 100) {
          sim.upgrade(t.id);
          break;
        }
      }
    }
    sim.update(dt);
    sim.drainEvents();
    simTime += dt;
  }
  assert.equal(sim.phase, "victory", `phải thắng (phase=${sim.phase}, wave=${sim.wave}, core=${sim.core}, t=${Math.round(simTime)}s)`);
  assert.equal(sim.wave, 8);
  assert.ok(sim.core > 0);
  assert.ok(sim.kills > 40, `phải hạ đủ nhiều bot (${sim.kills})`);
});

test("cyber-defense: không phòng thủ → thua khi core về 0", () => {
  const sim = createSim({ test: true });
  let simTime = 0;
  while (sim.phase !== "defeat" && sim.phase !== "victory" && simTime < 600) {
    sim.update(1 / 20);
    sim.drainEvents();
    simTime += 1 / 20;
  }
  assert.equal(sim.phase, "defeat");
  assert.equal(sim.core, 0);
});
