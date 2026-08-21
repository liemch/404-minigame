/**
 * engine.js — Astro Patrol 404: mô phỏng thuần (không DOM) để unit test.
 *
 * - Object pool cho đạn/đạn địch (acquire/release, không cấp phát mỗi phát bắn).
 * - Spatial grid (ô 80px) cho va chạm đạn ↔ địch/asteroid.
 * - Giới hạn projectile trên màn (B_CAP/EB_CAP) — đầy thì không bắn thêm.
 * - Khiên hấp thụ damage TRƯỚC HP; i-frame sau khi trúng đòn.
 * - Boss 2 phase (chuyển đúng một lần), 3 pattern có telegraph, đạn
 *   wall/spiral luôn chừa khe né.
 */

import { WAVE_DEFS, BOSS_DEF, ENEMY_STATS, testWaves } from "./waves.js";

export const WORLD = { w: 960, h: 640 };
export const PLAYER_R = 14;
export const B_CAP = 44;
export const EB_CAP = 110;
export const MAX_POWER = 3;

function makePool(create) {
  const free = [];
  return {
    acquire() {
      return free.pop() || create();
    },
    release(o) {
      free.push(o);
    },
    get size() {
      return free.length;
    },
  };
}

export function createSim({ rand = Math.random, test = false } = {}) {
  return {
    rand,
    test,
    waves: test ? testWaves() : WAVE_DEFS,
    player: {
      x: WORLD.w / 2,
      y: WORLD.h - 90,
      hp: 100,
      shield: 50,
      power: test ? 2 : 1,
      fireCd: 0,
      inv: 0,
      alive: true,
    },
    autoFire: false,
    bullets: [],
    ebullets: [],
    enemies: [],
    asteroids: [],
    pickups: [],
    bulletPool: makePool(() => ({ x: 0, y: 0, vx: 0, vy: 0 })),
    ebulletPool: makePool(() => ({ x: 0, y: 0, vx: 0, vy: 0, kind: "orange" })),
    wave: 0,
    waveState: "idle", // idle | announce | fighting | boss | done
    announceT: 0,
    spawnQueue: [],
    spawnT: 0,
    asteroidBudget: 0,
    boss: null,
    bossPhaseFired: false,
    combo: 0,
    comboT: 0,
    maxCombo: 0,
    kills: 0,
    score: 0,
    time: 0,
    over: false,
    victory: false,
    nextId: 1,
    events: [],
  };
}

export function drainEvents(sim) {
  const ev = sim.events;
  sim.events = [];
  return ev;
}

/* ---------------- Wave ---------------- */

export function startWave(sim, n) {
  sim.wave = n;
  if (n > sim.waves.length) {
    // boss wave
    sim.waveState = "announce";
    sim.announceT = 2.0;
    sim.events.push({ type: "bossIncoming" });
    return;
  }
  const def = sim.waves[n - 1];
  sim.waveState = "announce";
  sim.announceT = 1.6;
  sim.spawnQueue = def.spawns.slice();
  sim.spawnT = 0;
  sim.asteroidBudget = def.asteroids;
  sim.events.push({ type: "wave", n, name: def.name });
}

function beginFight(sim) {
  if (sim.wave > sim.waves.length) {
    sim.waveState = "boss";
    sim.boss = {
      x: WORLD.w / 2,
      y: -90,
      hp: sim.test ? BOSS_DEF.testHp : BOSS_DEF.hp,
      maxHp: sim.test ? BOSS_DEF.testHp : BOSS_DEF.hp,
      r: BOSS_DEF.radius,
      phase: 1,
      entered: false,
      patIdx: 0,
      patT: 1.4,
      telegraph: 0,
      volley: 0,
      sway: 0,
    };
  } else {
    sim.waveState = "fighting";
  }
}

export function spawnEnemy(sim, type, fx) {
  const st = ENEMY_STATS[type];
  sim.enemies.push({
    id: sim.nextId++,
    type,
    x: fx * WORLD.w,
    y: -30,
    vx: 0,
    vy: st.speed,
    hp: st.hp,
    r: st.r,
    t: 0,
    fireT: 1 + sim.rand() * 0.8,
    state: "enter", // charger: enter → aim(telegraph) → dash
    aimT: 0,
    targetY: 120 + sim.rand() * 130,
    sway: sim.rand() * Math.PI * 2,
  });
}

export function spawnAsteroid(sim, x = null, y = -40) {
  if (sim.asteroids.length >= 10) return;
  const r = 20 + sim.rand() * 26;
  sim.asteroids.push({
    id: sim.nextId++,
    x: x === null ? 40 + sim.rand() * (WORLD.w - 80) : x,
    y,
    vx: (sim.rand() - 0.5) * 40,
    vy: 30 + sim.rand() * 40,
    r,
    hp: 4,
    rot: sim.rand() * Math.PI * 2,
    vrot: (sim.rand() - 0.5) * 1.6,
    seed: Math.floor(sim.rand() * 9999),
  });
}

/* ---------------- Đạn ---------------- */

function fireBullet(sim, x, y, vx, vy) {
  if (sim.bullets.length >= B_CAP) return false;
  const b = sim.bulletPool.acquire();
  b.x = x;
  b.y = y;
  b.vx = vx;
  b.vy = vy;
  sim.bullets.push(b);
  return true;
}

export function fireEnemyBullet(sim, x, y, vx, vy, kind = "orange") {
  if (sim.ebullets.length >= EB_CAP) return false;
  const b = sim.ebulletPool.acquire();
  b.x = x;
  b.y = y;
  b.vx = vx;
  b.vy = vy;
  b.kind = kind;
  sim.ebullets.push(b);
  return true;
}

function playerShoot(sim) {
  const p = sim.player;
  const sp = -620;
  let shot = false;
  if (p.power === 1) {
    shot = fireBullet(sim, p.x, p.y - 18, 0, sp);
  } else if (p.power === 2) {
    shot = fireBullet(sim, p.x - 9, p.y - 14, 0, sp);
    fireBullet(sim, p.x + 9, p.y - 14, 0, sp);
  } else {
    shot = fireBullet(sim, p.x - 10, p.y - 12, -70, sp);
    fireBullet(sim, p.x, p.y - 18, 0, sp);
    fireBullet(sim, p.x + 10, p.y - 12, 70, sp);
  }
  if (shot) sim.events.push({ type: "shoot" });
}

/* ---------------- Damage ---------------- */

export function damagePlayer(sim, dmg) {
  const p = sim.player;
  if (!p.alive || p.inv > 0) return;
  // khiên hấp thụ trước
  const absorbed = Math.min(p.shield, dmg);
  p.shield -= absorbed;
  const rest = dmg - absorbed;
  p.hp -= rest;
  p.inv = 1.25;
  sim.combo = 0;
  sim.events.push({ type: absorbed > 0 ? "shieldHit" : "hurt", dmg });
  if (p.hp <= 0) {
    p.hp = 0;
    p.alive = false;
    sim.over = true;
    sim.events.push({ type: "gameOver" });
  }
}

function addKill(sim, e) {
  sim.kills += 1;
  sim.combo += 1;
  sim.comboT = 2.6;
  sim.maxCombo = Math.max(sim.maxCombo, sim.combo);
  const base = ENEMY_STATS[e.type].score;
  sim.score += base + sim.combo * 5;
  sim.events.push({ type: "kill", etype: e.type, x: e.x, y: e.y, combo: sim.combo });
  // rơi pickup
  if (sim.rand() < 0.16) {
    sim.pickups.push({
      x: e.x,
      y: e.y,
      vy: 70,
      kind: sim.rand() < 0.5 ? "shield" : "power",
      phase: sim.rand() * 6.28,
    });
  }
}

function damageEnemy(sim, e, dmg) {
  e.hp -= dmg;
  if (e.hp <= 0) {
    addKill(sim, e);
    return true;
  }
  sim.events.push({ type: "ehit", x: e.x, y: e.y });
  return false;
}

/* ---------------- Boss ---------------- */

function bossFirePattern(sim, boss) {
  const p = sim.player;
  const dense = boss.phase === 2;
  const patterns = ["fan", "wall", "spiral"];
  const pat = patterns[boss.patIdx % patterns.length];
  if (pat === "fan") {
    // nan quạt nhắm người chơi
    const a0 = Math.atan2(p.y - boss.y, p.x - boss.x);
    const n = dense ? 7 : 5;
    for (let i = 0; i < n; i++) {
      const a = a0 + (i - (n - 1) / 2) * 0.17;
      fireEnemyBullet(sim, boss.x, boss.y + 30, Math.cos(a) * 250, Math.sin(a) * 250, "magenta");
    }
  } else if (pat === "wall") {
    // hàng đạn ngang có KHE NÉ rộng
    const gapW = dense ? 130 : 170;
    const gapX = 80 + sim.rand() * (WORLD.w - 160 - gapW);
    for (let x = 30; x < WORLD.w - 20; x += 46) {
      if (x > gapX && x < gapX + gapW) continue;
      fireEnemyBullet(sim, x, boss.y + 60, 0, dense ? 200 : 165, "orange");
    }
  } else {
    // vòng xoáy có 2 khe né
    const n = dense ? 18 : 14;
    const gap1 = Math.floor(sim.rand() * n);
    const gap2 = (gap1 + Math.floor(n / 2)) % n;
    for (let i = 0; i < n; i++) {
      if (i === gap1 || i === gap2 || i === (gap1 + 1) % n) continue;
      const a = (Math.PI * 2 * i) / n + boss.sway;
      fireEnemyBullet(sim, boss.x, boss.y, Math.cos(a) * 210, Math.sin(a) * 210, "magenta");
    }
  }
  sim.events.push({ type: "bossFire", pat });
}

function stepBoss(sim, dt) {
  const boss = sim.boss;
  if (!boss) return;
  boss.sway += dt * (boss.phase === 2 ? 1.5 : 0.9);
  if (!boss.entered) {
    boss.y += 60 * dt;
    if (boss.y >= 118) {
      boss.y = 118;
      boss.entered = true;
      sim.events.push({ type: "bossEntered" });
    }
    return;
  }
  boss.x = WORLD.w / 2 + Math.sin(boss.sway) * (boss.phase === 2 ? 190 : 120);

  // chuyển phase đúng một lần
  if (!sim.bossPhaseFired && boss.hp <= boss.maxHp * BOSS_DEF.phase2At) {
    sim.bossPhaseFired = true;
    boss.phase = 2;
    sim.events.push({ type: "bossPhase", phase: 2 });
  }

  if (boss.telegraph > 0) {
    boss.telegraph -= dt;
    if (boss.telegraph <= 0) {
      bossFirePattern(sim, boss);
      boss.volley -= 1;
      if (boss.volley > 0) {
        boss.telegraph = 0.34; // loạt tiếp theo trong cùng pattern
      } else {
        boss.patIdx += 1;
        boss.patT = boss.phase === 2 ? 1.5 : 2.2;
      }
    }
    return;
  }

  boss.patT -= dt;
  if (boss.patT <= 0) {
    // telegraph trước đòn nguy hiểm
    boss.telegraph = boss.phase === 2 ? 0.55 : 0.75;
    boss.volley = boss.phase === 2 ? 3 : 2;
    sim.events.push({ type: "bossTelegraph" });
    // pattern toss đá kèm theo (phase 1 thỉnh thoảng)
    if (sim.rand() < 0.35) {
      spawnAsteroid(sim, boss.x - 130, boss.y + 10);
      spawnAsteroid(sim, boss.x + 130, boss.y + 10);
    }
  }
}

/* ---------------- Spatial grid ---------------- */

const CELL = 80;

function gridKey(x, y) {
  return `${Math.floor(x / CELL)},${Math.floor(y / CELL)}`;
}

function buildGrid(items) {
  const grid = new Map();
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const key = gridKey(it.x, it.y);
    let arr = grid.get(key);
    if (!arr) {
      arr = [];
      grid.set(key, arr);
    }
    arr.push(it);
  }
  return grid;
}

function queryGrid(grid, x, y, r) {
  const out = [];
  const x0 = Math.floor((x - r) / CELL);
  const x1 = Math.floor((x + r) / CELL);
  const y0 = Math.floor((y - r) / CELL);
  const y1 = Math.floor((y + r) / CELL);
  for (let gy = y0; gy <= y1; gy++) {
    for (let gx = x0; gx <= x1; gx++) {
      const arr = grid.get(`${gx},${gy}`);
      if (arr) out.push(...arr);
    }
  }
  return out;
}

/* ---------------- Step chính ---------------- */

export function stepSim(sim, input, dt) {
  if (sim.over || sim.victory) return;
  sim.time += dt;
  const p = sim.player;

  /* --- wave flow --- */
  if (sim.waveState === "idle") startWave(sim, 1);
  if (sim.waveState === "announce") {
    sim.announceT -= dt;
    if (sim.announceT <= 0) beginFight(sim);
  }
  if (sim.waveState === "fighting") {
    // spawn theo queue
    if (sim.spawnQueue.length) {
      sim.spawnT -= dt;
      if (sim.spawnT <= 0) {
        const s = sim.spawnQueue.shift();
        spawnEnemy(sim, s.type, s.x);
        sim.spawnT = sim.spawnQueue.length ? sim.spawnQueue[0].delay : 0;
      }
    }
    if (sim.asteroidBudget > 0 && sim.rand() < dt * 0.35) {
      sim.asteroidBudget -= 1;
      spawnAsteroid(sim);
    }
    // wave CHỈ hoàn tất khi hết queue và sạch địch
    if (!sim.spawnQueue.length && sim.enemies.length === 0) {
      startWave(sim, sim.wave + 1);
    }
  }
  if (sim.waveState === "boss") stepBoss(sim, dt);

  /* --- player --- */
  if (p.alive) {
    let mx = input.mx || 0;
    let my = input.my || 0;
    if (input.targetX !== null && input.targetX !== undefined) {
      const dx = input.targetX - p.x;
      const dy = input.targetY - p.y;
      const d = Math.hypot(dx, dy);
      if (d > 6) {
        mx = dx / d;
        my = dy / d;
      }
    }
    const mag = Math.hypot(mx, my) || 1;
    if (mag > 1) {
      mx /= mag;
      my /= mag;
    }
    p.vx = mx * 340;
    p.vy = my * 340;
    p.x = Math.max(24, Math.min(WORLD.w - 24, p.x + p.vx * dt));
    p.y = Math.max(80, Math.min(WORLD.h - 30, p.y + p.vy * dt));
    p.inv = Math.max(0, p.inv - dt);
    p.fireCd -= dt;
    if ((input.fire || sim.autoFire) && p.fireCd <= 0 && sim.waveState !== "announce") {
      p.fireCd = 0.17;
      playerShoot(sim);
    }
  }

  /* --- combo decay --- */
  if (sim.combo > 0) {
    sim.comboT -= dt;
    if (sim.comboT <= 0) sim.combo = 0;
  }

  /* --- đạn người chơi --- */
  for (let i = sim.bullets.length - 1; i >= 0; i--) {
    const b = sim.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.y < -20 || b.x < -20 || b.x > WORLD.w + 20) {
      sim.bullets.splice(i, 1);
      sim.bulletPool.release(b);
    }
  }

  /* --- địch --- */
  for (let i = sim.enemies.length - 1; i >= 0; i--) {
    const e = sim.enemies[i];
    e.t += dt;
    if (e.type === "scout") {
      e.x += Math.sin(e.t * 2.4 + e.sway) * 90 * dt;
      e.y += e.vy * dt;
    } else if (e.type === "shooter") {
      if (e.y < e.targetY) e.y += e.vy * dt;
      else {
        e.x += Math.sin(e.t * 1.1 + e.sway) * 46 * dt;
        e.fireT -= dt;
        if (e.fireT <= 0) {
          e.fireT = 1.7 + sim.rand() * 0.9;
          const a = Math.atan2(p.y - e.y, p.x - e.x);
          fireEnemyBullet(sim, e.x, e.y + 12, Math.cos(a) * 215, Math.sin(a) * 215, "orange");
          sim.events.push({ type: "eshoot" });
        }
      }
    } else if (e.type === "charger") {
      if (e.state === "enter") {
        e.y += e.vy * dt;
        if (e.y >= 110) {
          e.state = "aim";
          e.aimT = 0.7; // telegraph trước khi lao
          sim.events.push({ type: "chargerAim", x: e.x, y: e.y });
        }
      } else if (e.state === "aim") {
        e.aimT -= dt;
        if (e.aimT <= 0) {
          e.state = "dash";
          const a = Math.atan2(p.y - e.y, p.x - e.x);
          e.vx = Math.cos(a) * 430;
          e.vy = Math.sin(a) * 430;
          sim.events.push({ type: "chargerDash" });
        }
      } else {
        e.x += e.vx * dt;
        e.y += e.vy * dt;
      }
    }
    // ra khỏi màn → giải quyết (không tính kill)
    if (e.y > WORLD.h + 50 || e.x < -60 || e.x > WORLD.w + 60) {
      sim.enemies.splice(i, 1);
      continue;
    }
    // đâm người chơi
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (p.alive && d < e.r + PLAYER_R - 2) {
      damagePlayer(sim, 25);
      damageEnemy(sim, e, 3);
      if (e.hp <= 0) sim.enemies.splice(i, 1);
    }
  }

  /* --- asteroid --- */
  for (let i = sim.asteroids.length - 1; i >= 0; i--) {
    const a = sim.asteroids[i];
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    a.rot += a.vrot * dt;
    if (a.y > WORLD.h + 70) {
      sim.asteroids.splice(i, 1);
      continue;
    }
    const d = Math.hypot(a.x - p.x, a.y - p.y);
    if (p.alive && d < a.r + PLAYER_R - 3) {
      damagePlayer(sim, 20);
      a.vy = Math.abs(a.vy);
    }
  }

  /* --- va chạm đạn (spatial grid) --- */
  const enemyGrid = buildGrid(sim.enemies);
  const asteroidGrid = buildGrid(sim.asteroids);
  for (let i = sim.bullets.length - 1; i >= 0; i--) {
    const b = sim.bullets[i];
    let hit = false;
    for (const e of queryGrid(enemyGrid, b.x, b.y, 30)) {
      if (e.hp <= 0) continue;
      if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + 5) {
        if (damageEnemy(sim, e, 1)) {
          const idx = sim.enemies.indexOf(e);
          if (idx >= 0) sim.enemies.splice(idx, 1);
        }
        hit = true;
        break;
      }
    }
    if (!hit) {
      for (const a of queryGrid(asteroidGrid, b.x, b.y, 60)) {
        if (Math.hypot(a.x - b.x, a.y - b.y) < a.r + 4) {
          a.hp -= 1;
          if (a.hp <= 0) {
            const idx = sim.asteroids.indexOf(a);
            if (idx >= 0) sim.asteroids.splice(idx, 1);
            sim.score += 20;
            sim.events.push({ type: "boom", x: a.x, y: a.y, r: a.r });
          } else {
            sim.events.push({ type: "ehit", x: b.x, y: b.y });
          }
          hit = true;
          break;
        }
      }
    }
    if (!hit && sim.boss && sim.boss.entered) {
      const boss = sim.boss;
      if (Math.hypot(boss.x - b.x, boss.y - b.y) < boss.r) {
        boss.hp -= 1;
        sim.score += 2;
        sim.events.push({ type: "bosshit", x: b.x, y: b.y });
        if (boss.hp <= 0) {
          sim.boss = null;
          sim.victory = true;
          sim.score += 1500;
          sim.events.push({ type: "bossDead" }, { type: "victory" });
        }
        hit = true;
      }
    }
    if (hit) {
      sim.bullets.splice(i, 1);
      sim.bulletPool.release(b);
    }
  }

  /* --- đạn địch --- */
  for (let i = sim.ebullets.length - 1; i >= 0; i--) {
    const b = sim.ebullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.y > WORLD.h + 20 || b.y < -30 || b.x < -20 || b.x > WORLD.w + 20) {
      sim.ebullets.splice(i, 1);
      sim.ebulletPool.release(b);
      continue;
    }
    if (p.alive && Math.hypot(b.x - p.x, b.y - p.y) < PLAYER_R + 5) {
      damagePlayer(sim, 12);
      sim.ebullets.splice(i, 1);
      sim.ebulletPool.release(b);
    }
  }

  /* --- pickup --- */
  for (let i = sim.pickups.length - 1; i >= 0; i--) {
    const pk = sim.pickups[i];
    pk.y += pk.vy * dt;
    pk.phase += dt * 3;
    if (pk.y > WORLD.h + 30) {
      sim.pickups.splice(i, 1);
      continue;
    }
    if (p.alive && Math.hypot(pk.x - p.x, pk.y - p.y) < PLAYER_R + 16) {
      if (pk.kind === "shield") {
        p.shield = Math.min(100, p.shield + 40);
      } else if (p.power < MAX_POWER) {
        p.power += 1;
      } else {
        sim.score += 200;
      }
      sim.events.push({ type: "pickup", kind: pk.kind });
      sim.pickups.splice(i, 1);
    }
  }
}
