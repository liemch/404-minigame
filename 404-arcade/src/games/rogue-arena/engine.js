/**
 * engine.js — mô phỏng thuần Rogue Arena (không DOM, test bằng node).
 *
 * Hiệu năng theo plan:
 *  - OBJECT POOL cho enemy / đạn / đạn địch / mảnh XP / hạt — không cấp
 *    phát object mới trong vòng lặp (không GC churn).
 *  - SPATIAL HASH (ô 96px) cho truy vấn lân cận: nhắm mục tiêu, va chạm
 *    đạn, va chạm thân — KHÔNG quét O(n²).
 *  - Auto-aim có HYSTERESIS: giữ mục tiêu hiện tại tới khi chết/ra khỏi
 *    1.15× tầm — không rung khi nhiều mục tiêu cùng khoảng cách.
 *  - Level-up: engine phát sự kiện và KHÔNG tự mở khóa — lớp ngoài dừng
 *    update cho tới khi người chơi chọn nâng cấp (pause thật).
 */

import {
  ARENA_W, ARENA_H, WALL, MATCH_TIME, BOSS_AT, PLAYER_BASE,
  ENEMY_TYPES, hpScale, spawnCurve, MAX_ENEMIES, pickEnemyType,
  xpNeed, UPGRADES, REPAIR_CHOICE,
} from "./data.js";

const CELL = 96;
const COLS = Math.ceil(ARENA_W / CELL);
const ROWS = Math.ceil(ARENA_H / CELL);

/* ---------------- Object pool ---------------- */

function makePool(n, factory) {
  const items = new Array(n);
  for (let i = 0; i < n; i++) {
    items[i] = factory();
    items[i].alive = false;
  }
  return {
    items,
    /** Lấy một slot trống (hoặc null nếu pool đầy). */
    acquire() {
      for (let i = 0; i < n; i++) {
        if (!items[i].alive) {
          items[i].alive = true;
          return items[i];
        }
      }
      return null;
    },
  };
}

export function createArena({ test = false, rng = Math.random } = {}) {
  const player = {
    x: ARENA_W / 2,
    y: ARENA_H / 2,
    ...structuredClonePlayer(),
    hp: PLAYER_BASE.maxHp,
    ifr: 0,
    orbitAngle: 0,
  };

  function structuredClonePlayer() {
    return { ...PLAYER_BASE };
  }

  const arena = {
    time: 0, // thời gian đã sống sót
    player,
    level: 1,
    xp: 0,
    xpToNext: test ? 3 : xpNeed(1),
    kills: 0,
    score: 0,
    gemsTaken: 0,
    upgradeLevels: {}, // id → level hiện tại
    pendingLevelUps: 0,
    bossSpawned: false,
    bossId: -1,
    over: false,
    victory: false,
    events: [],
    targetId: -1,
    fireT: 0,
    spawnT: test ? 0.2 : 1.0,
    scoreT: 0,
    enemies: makePool(MAX_ENEMIES + 6, () => ({
      id: 0, type: "chaser", x: 0, y: 0, vx: 0, vy: 0, hp: 0, maxHp: 0,
      r: 15, speed: 0, dmg: 0, xp: 1, score: 10, shootT: 0, orbHitT: 0, hitFlash: 0, alive: false,
    })),
    bolts: makePool(240, () => ({ x: 0, y: 0, vx: 0, vy: 0, dmg: 0, pierce: 0, life: 0, alive: false })),
    ebolts: makePool(90, () => ({ x: 0, y: 0, vx: 0, vy: 0, dmg: 0, life: 0, alive: false })),
    gems: makePool(150, () => ({ x: 0, y: 0, vx: 0, vy: 0, value: 1, big: false, heal: false, t: 0, alive: false })),
  };

  let nextId = 1;

  /* ---------------- Spatial hash ---------------- */

  const grid = new Array(COLS * ROWS);
  for (let i = 0; i < grid.length; i++) grid[i] = [];

  function rebuildGrid() {
    for (let i = 0; i < grid.length; i++) grid[i].length = 0;
    const list = arena.enemies.items;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.alive) continue;
      const cx = Math.max(0, Math.min(COLS - 1, (e.x / CELL) | 0));
      const cy = Math.max(0, Math.min(ROWS - 1, (e.y / CELL) | 0));
      grid[cy * COLS + cx].push(i);
    }
  }

  /** Duyệt enemy sống trong bán kính r quanh (x,y) — chỉ các ô lân cận. */
  function queryCircle(x, y, r, fn) {
    const x0 = Math.max(0, ((x - r) / CELL) | 0);
    const x1 = Math.min(COLS - 1, ((x + r) / CELL) | 0);
    const y0 = Math.max(0, ((y - r) / CELL) | 0);
    const y1 = Math.min(ROWS - 1, ((y + r) / CELL) | 0);
    const r2 = r * r;
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const bucket = grid[cy * COLS + cx];
        for (let k = 0; k < bucket.length; k++) {
          const e = arena.enemies.items[bucket[k]];
          if (!e.alive) continue;
          const dx = e.x - x;
          const dy = e.y - y;
          if (dx * dx + dy * dy <= r2) {
            if (fn(e, dx * dx + dy * dy) === false) return;
          }
        }
      }
    }
  }

  arena.queryCircle = queryCircle;

  /* ---------------- Spawn ---------------- */

  function spawnEnemy(type) {
    const e = arena.enemies.acquire();
    if (!e) return null;
    const def = ENEMY_TYPES[type];
    // sinh ở mép trong tường — KHÔNG sinh sát người chơi (tối thiểu 300px)
    const m = WALL + 22;
    let px = m;
    let py = m;
    for (let attempt = 0; attempt < 7; attempt++) {
      const side = (rng() * 4) | 0;
      if (side === 0) { px = m + rng() * (ARENA_W - m * 2); py = m; }
      else if (side === 1) { px = ARENA_W - m; py = m + rng() * (ARENA_H - m * 2); }
      else if (side === 2) { px = m + rng() * (ARENA_W - m * 2); py = ARENA_H - m; }
      else { px = m; py = m + rng() * (ARENA_H - m * 2); }
      const dx = px - player.x;
      const dy = py - player.y;
      if (dx * dx + dy * dy >= 300 * 300) break;
    }
    e.x = px;
    e.y = py;
    e.id = nextId++;
    e.type = type;
    e.maxHp = def.hp * hpScale(arena.time) * (test ? 0.6 : 1);
    e.hp = e.maxHp;
    e.r = def.r;
    e.speed = def.speed;
    e.dmg = def.dmg;
    e.xp = def.xp;
    e.score = def.score;
    e.shootT = def.shootEvery ? def.shootEvery * (0.5 + rng() * 0.5) : 0;
    e.orbHitT = 0;
    e.hitFlash = 0;
    e.vx = 0;
    e.vy = 0;
    return e;
  }

  function spawnBoss() {
    const e = spawnEnemy("boss");
    if (!e) return;
    e.x = ARENA_W / 2;
    e.y = WALL + 60;
    arena.bossSpawned = true;
    arena.bossId = e.id;
    arena.events.push({ type: "boss" });
  }

  function dropGem(x, y, e) {
    const g = arena.gems.acquire();
    if (!g) return;
    g.x = x + (rng() - 0.5) * 10;
    g.y = y + (rng() - 0.5) * 10;
    g.vx = 0;
    g.vy = 0;
    g.value = e.xp;
    g.big = e.type === "tank" || e.type === "boss" ? rng() < 0.6 : rng() < 0.06;
    if (g.big) g.value += 6;
    g.heal = false;
    g.t = 0;
    // health pickup rơi riêng với tỉ lệ nhỏ
    if (rng() < 0.055) {
      const h = arena.gems.acquire();
      if (h) {
        h.x = x + 14;
        h.y = y;
        h.vx = 0;
        h.vy = 0;
        h.value = 0;
        h.big = false;
        h.heal = true;
        h.t = 0;
      }
    }
  }

  /* ---------------- Sát thương ---------------- */

  function damageEnemy(e, dmg) {
    if (!e.alive) return false;
    e.hp -= dmg;
    e.hitFlash = 0.1;
    if (e.hp <= 0) {
      e.alive = false;
      arena.kills += 1;
      arena.score += e.score;
      dropGem(e.x, e.y, e);
      arena.events.push({ type: "kill", x: e.x, y: e.y, big: e.type === "tank" || e.type === "boss" });
      if (e.id === arena.bossId) {
        arena.score += 500;
        arena.events.push({ type: "bossdown", x: e.x, y: e.y });
      }
      return true;
    }
    return false;
  }

  function hurtPlayer(dmg) {
    if (player.ifr > 0 || arena.over) return;
    player.hp -= dmg;
    player.ifr = 0.6;
    arena.events.push({ type: "hurt", hp: player.hp });
    if (player.hp <= 0) {
      player.hp = 0;
      arena.over = true;
      arena.victory = false;
      arena.events.push({ type: "defeat" });
    }
  }

  /* ---------------- Nâng cấp ---------------- */

  arena.rollChoices = () => {
    const avail = UPGRADES.filter((u) => (arena.upgradeLevels[u.id] || 0) < u.maxLevel);
    const picks = [];
    const poolCopy = avail.slice();
    while (picks.length < 3 && poolCopy.length > 0) {
      const total = poolCopy.reduce((s, u) => s + u.weight, 0);
      let x = rng() * total;
      let idx = 0;
      for (let i = 0; i < poolCopy.length; i++) {
        x -= poolCopy[i].weight;
        if (x <= 0) {
          idx = i;
          break;
        }
      }
      picks.push(poolCopy.splice(idx, 1)[0]);
    }
    while (picks.length < 3) picks.push(REPAIR_CHOICE);
    return picks;
  };

  arena.applyUpgrade = (u) => {
    u.apply(player);
    if (u.id !== "repair") {
      arena.upgradeLevels[u.id] = (arena.upgradeLevels[u.id] || 0) + 1;
    }
    arena.pendingLevelUps = Math.max(0, arena.pendingLevelUps - 1);
    arena.events.push({ type: "upgraded", id: u.id });
  };

  function gainXp(v) {
    arena.xp += v;
    arena.score += v * 2;
    while (arena.xp >= arena.xpToNext) {
      arena.xp -= arena.xpToNext;
      arena.level += 1;
      arena.xpToNext = test ? 3 : xpNeed(arena.level);
      arena.pendingLevelUps += 1;
      arena.events.push({ type: "levelup", level: arena.level });
    }
  }

  /* ---------------- Auto-aim hysteresis ---------------- */

  const ACQUIRE = 430;

  function currentTarget() {
    if (arena.targetId >= 0) {
      const list = arena.enemies.items;
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (e.alive && e.id === arena.targetId) {
          const dx = e.x - player.x;
          const dy = e.y - player.y;
          // giữ mục tiêu tới 1.15× tầm — chống rung giữa nhiều mục tiêu
          if (dx * dx + dy * dy <= ACQUIRE * 1.15 * (ACQUIRE * 1.15)) return e;
          break;
        }
      }
      arena.targetId = -1;
    }
    let best = null;
    let bestD = Infinity;
    queryCircle(player.x, player.y, ACQUIRE, (e, d2) => {
      if (d2 < bestD) {
        bestD = d2;
        best = e;
      }
    });
    if (best) arena.targetId = best.id;
    return best;
  }

  /* ---------------- Update ---------------- */

  arena.update = (dt, input) => {
    if (arena.over) return;
    arena.time += dt;

    // điểm sống sót
    arena.scoreT += dt;
    while (arena.scoreT >= 1) {
      arena.scoreT -= 1;
      arena.score += 5;
    }

    // thắng khi sống hết 3 phút
    if (arena.time >= MATCH_TIME) {
      arena.over = true;
      arena.victory = true;
      arena.events.push({ type: "victory" });
      return;
    }

    // boss phút thứ 3
    if (!arena.bossSpawned && arena.time >= (test ? 20 : BOSS_AT)) spawnBoss();

    /* --- người chơi --- */
    const mlen = Math.hypot(input.mx, input.my);
    if (mlen > 0.01) {
      const nx = input.mx / Math.max(1, mlen);
      const ny = input.my / Math.max(1, mlen);
      player.x += nx * player.speed * dt;
      player.y += ny * player.speed * dt;
    }
    const m = WALL + player.r;
    player.x = Math.max(m, Math.min(ARENA_W - m, player.x));
    player.y = Math.max(m, Math.min(ARENA_H - m, player.y));
    if (player.ifr > 0) player.ifr -= dt;
    player.orbitAngle += dt * 2.6;

    rebuildGrid();

    /* --- spawn --- */
    arena.spawnT -= dt;
    if (arena.spawnT <= 0) {
      const curve = spawnCurve(arena.time);
      arena.spawnT = test ? curve.interval * 0.5 : curve.interval;
      let aliveCount = 0;
      for (const e of arena.enemies.items) if (e.alive) aliveCount++;
      for (let i = 0; i < curve.batch && aliveCount + i < MAX_ENEMIES; i++) {
        spawnEnemy(pickEnemyType(arena.time, rng()));
      }
    }

    /* --- bắn tự động --- */
    arena.fireT -= dt;
    if (arena.fireT <= 0) {
      const target = currentTarget();
      if (target) {
        arena.fireT = 1 / player.fireRate;
        const base = Math.atan2(target.y - player.y, target.x - player.x);
        const n = player.projectiles;
        for (let i = 0; i < n; i++) {
          const b = arena.bolts.acquire();
          if (!b) break;
          const spread = n > 1 ? (i - (n - 1) / 2) * 0.13 : 0;
          const a = base + spread;
          b.x = player.x;
          b.y = player.y;
          b.vx = Math.cos(a) * player.boltSpeed;
          b.vy = Math.sin(a) * player.boltSpeed;
          b.dmg = player.damage;
          b.pierce = player.pierce;
          b.life = 1.1;
        }
        arena.events.push({ type: "shoot" });
      } else {
        arena.fireT = 0.08;
      }
    }

    /* --- đạn người chơi --- */
    for (const b of arena.bolts.items) {
      if (!b.alive) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < WALL || b.x > ARENA_W - WALL || b.y < WALL || b.y > ARENA_H - WALL) {
        b.alive = false;
        continue;
      }
      queryCircle(b.x, b.y, 34, (e) => {
        const rr = e.r + 5;
        const dx = e.x - b.x;
        const dy = e.y - b.y;
        if (dx * dx + dy * dy > rr * rr) return;
        const killed = damageEnemy(e, b.dmg);
        arena.events.push({ type: "hit", x: b.x, y: b.y, killed });
        if (b.pierce > 0) b.pierce -= 1;
        else b.alive = false;
        return false; // một đạn chỉ trúng 1 mục tiêu mỗi frame
      });
    }

    /* --- quả cầu vệ tinh --- */
    if (player.orbit > 0) {
      for (let i = 0; i < player.orbit; i++) {
        const a = player.orbitAngle + (i * Math.PI * 2) / player.orbit;
        const ox = player.x + Math.cos(a) * 56;
        const oy = player.y + Math.sin(a) * 56;
        queryCircle(ox, oy, 20, (e) => {
          if (arena.time - e.orbHitT < 0.45) return;
          e.orbHitT = arena.time;
          damageEnemy(e, 16);
          arena.events.push({ type: "hit", x: ox, y: oy, killed: !e.alive });
        });
      }
    }

    /* --- enemy --- */
    for (const e of arena.enemies.items) {
      if (!e.alive) continue;
      if (e.hitFlash > 0) e.hitFlash -= dt;
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const def = ENEMY_TYPES[e.type];

      if (e.type === "shooter") {
        // giữ khoảng cách rồi bắn
        let mx = 0;
        let my = 0;
        if (d > 300) { mx = dx / d; my = dy / d; }
        else if (d < 200) { mx = -dx / d; my = -dy / d; }
        else { mx = -dy / d * 0.6; my = dx / d * 0.6; }
        e.x += mx * e.speed * dt;
        e.y += my * e.speed * dt;
        e.shootT -= dt;
        if (e.shootT <= 0 && d < 460) {
          e.shootT = def.shootEvery;
          const eb = arena.ebolts.acquire();
          if (eb) {
            eb.x = e.x;
            eb.y = e.y;
            eb.vx = (dx / d) * def.boltSpeed;
            eb.vy = (dy / d) * def.boltSpeed;
            eb.dmg = def.boltDmg;
            eb.life = 3;
            arena.events.push({ type: "eshoot", x: e.x, y: e.y });
          }
        }
      } else if (e.type === "boss") {
        e.x += (dx / d) * e.speed * dt;
        e.y += (dy / d) * e.speed * dt;
        e.shootT -= dt;
        if (e.shootT <= 0) {
          e.shootT = def.shootEvery;
          for (let k = 0; k < def.ring; k++) {
            const a = (Math.PI * 2 * k) / def.ring + arena.time;
            const eb = arena.ebolts.acquire();
            if (!eb) break;
            eb.x = e.x;
            eb.y = e.y;
            eb.vx = Math.cos(a) * def.boltSpeed;
            eb.vy = Math.sin(a) * def.boltSpeed;
            eb.dmg = def.boltDmg;
            eb.life = 4;
          }
          arena.events.push({ type: "eshoot", x: e.x, y: e.y });
        }
      } else {
        e.x += (dx / d) * e.speed * dt;
        e.y += (dy / d) * e.speed * dt;
      }

      const em = WALL + e.r;
      e.x = Math.max(em, Math.min(ARENA_W - em, e.x));
      e.y = Math.max(em, Math.min(ARENA_H - em, e.y));
    }

    /* --- chạm thân người chơi (truy vấn hash quanh player) --- */
    queryCircle(player.x, player.y, 70, (e) => {
      const rr = e.r + player.r - 4;
      const dx = e.x - player.x;
      const dy = e.y - player.y;
      if (dx * dx + dy * dy <= rr * rr) {
        hurtPlayer(e.dmg);
        return false;
      }
    });

    /* --- đạn địch --- */
    for (const eb of arena.ebolts.items) {
      if (!eb.alive) continue;
      eb.x += eb.vx * dt;
      eb.y += eb.vy * dt;
      eb.life -= dt;
      if (eb.life <= 0 || eb.x < WALL || eb.x > ARENA_W - WALL || eb.y < WALL || eb.y > ARENA_H - WALL) {
        eb.alive = false;
        continue;
      }
      const dx = eb.x - player.x;
      const dy = eb.y - player.y;
      const rr = player.r + 5;
      if (dx * dx + dy * dy <= rr * rr) {
        eb.alive = false;
        hurtPlayer(eb.dmg);
      }
    }

    /* --- mảnh XP + hồi máu --- */
    for (const g of arena.gems.items) {
      if (!g.alive) continue;
      g.t += dt;
      const dx = player.x - g.x;
      const dy = player.y - g.y;
      const d = Math.hypot(dx, dy) || 1;
      const magnetR = g.heal ? 60 : player.magnet;
      if (d < magnetR) {
        const pull = 340 * (1 - d / magnetR) + 120;
        g.vx += (dx / d) * pull * dt * 4;
        g.vy += (dy / d) * pull * dt * 4;
      }
      g.vx *= 1 - Math.min(1, dt * 3);
      g.vy *= 1 - Math.min(1, dt * 3);
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      if (d < 20) {
        g.alive = false;
        if (g.heal) {
          player.hp = Math.min(player.maxHp, player.hp + 30);
          arena.events.push({ type: "heal", x: g.x, y: g.y });
        } else {
          arena.gemsTaken += 1;
          gainXp(g.value);
          arena.events.push({ type: "gem", x: g.x, y: g.y, value: g.value, big: g.big });
        }
      }
    }
  };

  arena.drainEvents = () => {
    const out = arena.events.slice();
    arena.events.length = 0;
    return out;
  };

  return arena;
}
