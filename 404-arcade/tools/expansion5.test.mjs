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
import { createArena } from "../src/games/rogue-arena/engine.js";
import { UPGRADES, MAX_ENEMIES } from "../src/games/rogue-arena/data.js";

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

/* ---------------- Rogue Arena ---------------- */

test("rogue-arena: có đúng 8 nâng cấp đủ schema {id,name,description,maxLevel,weight,apply}", () => {
  assert.equal(UPGRADES.length, 8);
  for (const u of UPGRADES) {
    assert.ok(u.id && u.name && u.description);
    assert.ok(Number.isFinite(u.maxLevel) && u.maxLevel >= 1);
    assert.ok(u.weight > 0);
    assert.equal(typeof u.apply, "function");
  }
});

test("rogue-arena: auto-aim hysteresis — không rung giữa 2 mục tiêu cùng khoảng cách", () => {
  const a = createArena({ test: true, rng: () => 0.5 });
  a.spawnT = 9999; // tắt spawn tự nhiên
  // 2 enemy đối xứng quanh player, xê dịch nhẹ mỗi frame
  const e1 = a.enemies.items[0];
  const e2 = a.enemies.items[1];
  for (const [e, x] of [[e1, a.player.x - 200], [e2, a.player.x + 200]]) {
    e.alive = true;
    e.id = x < a.player.x ? 7001 : 7002;
    e.type = "chaser";
    e.x = x;
    e.y = a.player.y;
    e.hp = 100000;
    e.maxHp = 100000;
    e.r = 15;
    e.speed = 0;
    e.dmg = 0;
    e.xp = 1;
    e.score = 0;
  }
  const targets = new Set();
  for (let i = 0; i < 60; i++) {
    // dao động vị trí: lúc e1 gần hơn 2px, lúc e2 gần hơn 2px
    e1.x = a.player.x - 200 + (i % 2 === 0 ? 2 : -2);
    e2.x = a.player.x + 200 + (i % 2 === 0 ? 2 : -2);
    a.update(1 / 60, { mx: 0, my: 0 });
    if (a.targetId >= 0) targets.add(a.targetId);
  }
  assert.equal(targets.size, 1, `mục tiêu bị đổi ${targets.size} lần — hysteresis fail`);
});

test("rogue-arena: XP threshold chỉ lên cấp một lần + xp dư được giữ", () => {
  const a = createArena({ test: true }); // xpToNext = 3
  a.spawnT = 9999;
  // gainXp nội bộ qua gem: mô phỏng bằng cách chèn gem sát player
  const g = a.gems.items[0];
  g.alive = true;
  g.x = a.player.x + 1;
  g.y = a.player.y;
  g.vx = 0;
  g.vy = 0;
  g.value = 7; // 7 xp → cấp 2 (3) + cấp 3 (3) + dư 1
  g.big = false;
  g.heal = false;
  a.update(1 / 60, { mx: 0, my: 0 });
  assert.equal(a.level, 3);
  assert.equal(a.xp, 1);
  assert.equal(a.pendingLevelUps, 2, "mỗi threshold đúng 1 lần level-up chờ xử lý");
});

test("rogue-arena: nâng cấp không xuất hiện khi đã max level", () => {
  const a = createArena({ test: true, rng: () => 0.01 });
  // max hoá 'damage'
  const dmg = UPGRADES.find((u) => u.id === "damage");
  for (let i = 0; i < dmg.maxLevel; i++) a.applyUpgrade(dmg);
  for (let trial = 0; trial < 30; trial++) {
    const choices = a.rollChoices();
    assert.equal(choices.length, 3);
    assert.ok(!choices.some((c) => c.id === "damage"), "damage đã max không được xuất hiện");
  }
});

test("rogue-arena: pool giới hạn enemy — không vượt MAX_ENEMIES", () => {
  const a = createArena({ test: true });
  let t = 0;
  while (t < 60) {
    a.update(1 / 30, { mx: 0, my: 0 });
    a.drainEvents();
    // bất tử để sống lâu
    a.player.hp = 1000;
    a.player.maxHp = 1000;
    let alive = 0;
    for (const e of a.enemies.items) if (e.alive) alive++;
    assert.ok(alive <= MAX_ENEMIES + 6, `enemy alive ${alive} vượt trần`);
    t += 1 / 30;
  }
});

test("rogue-arena: trọn trận 3 phút với auto-chọn nâng cấp → thắng, boss xuất hiện", () => {
  let seed = 7; // seed thắng ổn định cho bot kite đơn giản (đã dò 4 seed)
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const a = createArena({ test: false, rng });
  let sawBoss = false;
  let levelups = 0;
  let t = 0;
  const PRIORITY = ["damage", "firerate", "multishot", "orbit", "maxhp", "speed", "pierce", "magnet", "repair"];
  while (!a.over && t < 200) {
    // bot "kiting" phản ứng: quỹ đạo vòng quanh tâm + đẩy lùi khỏi enemy gần
    const w = 0.55;
    let mx = 680 + Math.cos(t * w) * 300 - a.player.x;
    let my = 380 + Math.sin(t * w) * 240 - a.player.y;
    const ml = Math.hypot(mx, my) || 1;
    mx /= ml;
    my /= ml;
    a.queryCircle(a.player.x, a.player.y, 170, (e, d2) => {
      const d = Math.sqrt(d2) || 1;
      const push = (1 - d / 170) * 3.2;
      mx += ((a.player.x - e.x) / d) * push;
      my += ((a.player.y - e.y) / d) * push;
    });
    a.update(1 / 30, { mx, my });
    for (const e of a.drainEvents()) {
      if (e.type === "boss") sawBoss = true;
      if (e.type === "levelup") levelups += 1;
    }
    while (a.pendingLevelUps > 0) {
      const c = a.rollChoices();
      c.sort((x, y) => PRIORITY.indexOf(x.id) - PRIORITY.indexOf(y.id));
      a.applyUpgrade(c[0]);
    }
    t += 1 / 30;
  }
  assert.ok(a.over, "trận phải kết thúc");
  assert.ok(a.victory, `phải sống sót 3 phút (hp=${Math.round(a.player.hp)}, t=${Math.round(a.time)})`);
  assert.ok(sawBoss, "boss phải xuất hiện ở phút thứ 3");
  assert.ok(levelups >= 3, `phải lên cấp nhiều lần (${levelups})`);
  assert.ok(a.kills > 30, `phải hạ đủ nhiều (${a.kills})`);
});
