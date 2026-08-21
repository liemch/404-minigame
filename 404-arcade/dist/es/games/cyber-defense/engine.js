/**
 * engine.js — mô phỏng thuần Cyber Defense (không DOM — unit test được
 * bằng node): wave manager data-driven, enemy đi theo path, tháp chọn
 * mục tiêu "gần CORE nhất trong tầm" (xác định), đạn/AoE/slow không cộng
 * dồn, economy xây / nâng cấp 3 cấp / bán hoàn 70%, thắng sau wave 8,
 * thua khi CORE = 0.
 */

import {
  buildPaths, pointAt, PADS, PAD_R, TOWERS, SELL_RATIO,
  ENEMIES, WAVES, waveHpScale, START_ENERGY, WAVE_CLEAR_BONUS, PREP_TIME, CORE,
} from "./data.js";

export function createSim({ test = false } = {}) {
  const paths = buildPaths();
  const prepTime = test ? 1.2 : PREP_TIME;

  const sim = {
    time: 0,
    energy: START_ENERGY,
    core: CORE.hp,
    coreMax: CORE.hp,
    score: 0,
    kills: 0,
    wave: 0, // wave đang/đã chạy (1-based); 0 = trước wave 1
    phase: "prep", // prep | running | victory | defeat
    prepT: prepTime,
    towers: [],
    enemies: [],
    projectiles: [],
    events: [],
    spawnList: [],
    spawnClock: 0,
    towersBuilt: 0,
    altFlip: false,
    nextId: 1,
  };

  /* ---------------- Wave ---------------- */

  function buildSpawnList(waveDef) {
    const list = [];
    let t = 0.6;
    for (const group of waveDef.groups) {
      for (let i = 0; i < group.count; i++) {
        let lane = group.lane || "alt";
        if (lane === "alt") {
          lane = sim.altFlip ? "A" : "B";
          sim.altFlip = !sim.altFlip;
        }
        list.push({ at: t, type: group.type, lane });
        t += (test ? group.intervalMs / 3 : group.intervalMs) / 1000;
      }
      t += (test ? 400 : waveDef.delayBetweenGroupsMs) / 1000;
    }
    return list;
  }

  function startWave() {
    sim.wave += 1;
    sim.phase = "running";
    sim.spawnList = buildSpawnList(WAVES[sim.wave - 1]);
    sim.spawnClock = 0;
    sim.events.push({ type: "wave", wave: sim.wave });
  }

  function spawnEnemy(type, lane) {
    const def = ENEMIES[type];
    const hpScale = waveHpScale(sim.wave) * (test ? 0.55 : 1);
    sim.enemies.push({
      id: sim.nextId++,
      type,
      lane,
      dist: 0,
      x: paths[lane].pts[0][0],
      y: paths[lane].pts[0][1],
      hp: def.hp * hpScale,
      maxHp: def.hp * hpScale,
      shield: (def.shield || 0) * hpScale,
      maxShield: (def.shield || 0) * hpScale,
      speed: def.speed,
      slowUntil: 0,
      slowFactor: 1,
      reward: def.reward,
      coreDmg: def.coreDmg,
      escore: def.score,
      r: def.r,
      alive: true,
    });
  }

  /* ---------------- Sát thương ---------------- */

  function damage(e, dmg) {
    if (!e.alive) return;
    if (e.shield > 0) {
      // khiên giảm 45% sát thương nhận vào cho tới khi vỡ
      e.shield -= dmg * 0.55;
      if (e.shield <= 0) {
        e.shield = 0;
        sim.events.push({ type: "shieldbreak", x: e.x, y: e.y });
      }
    } else {
      e.hp -= dmg;
    }
    if (e.hp <= 0) {
      e.alive = false;
      sim.energy += e.reward;
      sim.score += e.escore;
      sim.kills += 1;
      sim.events.push({ type: "kill", x: e.x, y: e.y, reward: e.reward });
    }
  }

  function applySlow(e, factor, dur) {
    // Không cộng dồn vô hạn: giữ hệ số MẠNH NHẤT và gia hạn thời gian
    e.slowFactor = Math.min(e.slowFactor < 1 && e.slowUntil > sim.time ? e.slowFactor : 1, factor);
    e.slowUntil = Math.max(e.slowUntil, sim.time + dur);
  }

  /* ---------------- Tháp ---------------- */

  function towerStats(t) {
    return TOWERS[t.type].levels[t.level];
  }

  function acquireTarget(t, range) {
    let best = null;
    let bestRemain = Infinity;
    for (const e of sim.enemies) {
      if (!e.alive) continue;
      const dx = e.x - t.x;
      const dy = e.y - t.y;
      if (dx * dx + dy * dy > range * range) continue;
      const remain = paths[e.lane].totalLen - e.dist;
      if (remain < bestRemain) {
        bestRemain = remain;
        best = e;
      }
    }
    return best;
  }

  function fireTower(t) {
    const st = towerStats(t);
    const target = acquireTarget(t, st.range);
    if (!target) return false;
    t.aimAt = { x: target.x, y: target.y };
    if (t.type === "rapid" || t.type === "sniper") {
      sim.projectiles.push({
        x: t.x, y: t.y - 14,
        targetId: target.id,
        lastX: target.x, lastY: target.y,
        speed: t.type === "sniper" ? 780 : 540,
        dmg: st.dmg,
        kind: t.type,
        alive: true,
      });
      sim.events.push({ type: "shoot", tower: t.type, x: t.x, y: t.y });
    } else if (t.type === "slow") {
      damage(target, st.dmg);
      applySlow(target, st.slow, st.slowDur);
      sim.events.push({ type: "zap", x0: t.x, y0: t.y - 16, x1: target.x, y1: target.y });
    } else if (t.type === "blast") {
      sim.projectiles.push({
        x: t.x, y: t.y - 14,
        targetId: target.id,
        lastX: target.x, lastY: target.y,
        speed: 400,
        dmg: st.dmg,
        aoe: st.aoe,
        kind: "blast",
        alive: true,
      });
      sim.events.push({ type: "shoot", tower: "blast", x: t.x, y: t.y });
    } else if (t.type === "nova") {
      for (const e of sim.enemies) {
        if (!e.alive) continue;
        const dx = e.x - t.x;
        const dy = e.y - t.y;
        if (dx * dx + dy * dy <= st.range * st.range) {
          damage(e, st.dmg);
          if (st.slow) applySlow(e, st.slow, st.slowDur);
        }
      }
      sim.events.push({ type: "pulse", x: t.x, y: t.y, r: st.range });
    }
    return true;
  }

  /* ---------------- API công khai ---------------- */

  sim.padAt = (x, y) => {
    for (const p of PADS) {
      const dx = x - p.x;
      const dy = y - p.y;
      if (dx * dx + dy * dy <= (PAD_R + 8) * (PAD_R + 8)) return p;
    }
    return null;
  };

  sim.towerAt = (x, y) => {
    for (const t of sim.towers) {
      const dx = x - t.x;
      const dy = y - t.y;
      if (dx * dx + dy * dy <= 30 * 30) return t;
    }
    return null;
  };

  sim.towerOnPad = (padId) => sim.towers.find((t) => t.padId === padId) || null;

  sim.isUnlocked = (type) => sim.wave + (sim.phase === "prep" ? 1 : 0) >= TOWERS[type].unlockWave || sim.wave >= TOWERS[type].unlockWave;

  sim.canBuild = (type) => {
    const def = TOWERS[type];
    if (!sim.isUnlocked(type)) return { ok: false, reason: "locked" };
    if (sim.energy < def.cost) return { ok: false, reason: "energy" };
    return { ok: true };
  };

  sim.buildAt = (padId, type) => {
    const pad = PADS.find((p) => p.id === padId);
    if (!pad) return { ok: false, reason: "pad" };
    if (sim.towerOnPad(padId)) return { ok: false, reason: "occupied" };
    const can = sim.canBuild(type);
    if (!can.ok) return can;
    const def = TOWERS[type];
    sim.energy -= def.cost;
    const t = {
      id: sim.nextId++,
      type,
      level: 0,
      x: pad.x,
      y: pad.y,
      padId,
      cooldown: 0.2,
      invested: def.cost,
      aimAt: null,
    };
    sim.towers.push(t);
    sim.towersBuilt += 1;
    sim.events.push({ type: "build", x: pad.x, y: pad.y });
    return { ok: true, tower: t };
  };

  sim.upgradeCost = (t) => {
    const def = TOWERS[t.type];
    if (t.level >= def.levels.length - 1) return null;
    return def.levels[t.level + 1].cost;
  };

  sim.upgrade = (towerId) => {
    const t = sim.towers.find((x) => x.id === towerId);
    if (!t) return { ok: false, reason: "missing" };
    const cost = sim.upgradeCost(t);
    if (cost === null) return { ok: false, reason: "max" };
    if (sim.energy < cost) return { ok: false, reason: "energy" };
    sim.energy -= cost;
    t.invested += cost;
    t.level += 1;
    sim.events.push({ type: "upgrade", x: t.x, y: t.y });
    return { ok: true };
  };

  sim.sellValue = (t) => Math.round(t.invested * SELL_RATIO);

  sim.sell = (towerId) => {
    const i = sim.towers.findIndex((x) => x.id === towerId);
    if (i < 0) return { ok: false };
    const t = sim.towers[i];
    const refund = sim.sellValue(t);
    sim.energy += refund;
    sim.towers.splice(i, 1);
    sim.events.push({ type: "sell", x: t.x, y: t.y, refund });
    return { ok: true, refund };
  };

  sim.stats = (t) => towerStats(t);

  sim.update = (dt) => {
    if (sim.phase === "victory" || sim.phase === "defeat") return;
    sim.time += dt;

    if (sim.phase === "prep") {
      sim.prepT -= dt;
      if (sim.prepT <= 0) startWave();
    } else {
      // spawn
      sim.spawnClock += dt;
      while (sim.spawnList.length && sim.spawnList[0].at <= sim.spawnClock) {
        const s = sim.spawnList.shift();
        spawnEnemy(s.type, s.lane);
      }
    }

    // enemy di chuyển
    for (const e of sim.enemies) {
      if (!e.alive) continue;
      const slowed = e.slowUntil > sim.time;
      const v = e.speed * (slowed ? e.slowFactor : 1);
      e.dist += v * dt;
      const path = paths[e.lane];
      if (e.dist >= path.totalLen) {
        e.alive = false;
        sim.core = Math.max(0, sim.core - e.coreDmg);
        sim.events.push({ type: "corehit", dmg: e.coreDmg });
        if (sim.core <= 0) {
          sim.phase = "defeat";
          sim.events.push({ type: "defeat" });
          return;
        }
        continue;
      }
      const p = pointAt(path, e.dist);
      e.x = p[0];
      e.y = p[1];
    }

    // tháp bắn
    for (const t of sim.towers) {
      t.cooldown -= dt;
      if (t.cooldown <= 0) {
        const st = towerStats(t);
        if (fireTower(t)) t.cooldown = 1 / st.rate;
        else t.cooldown = 0.08; // quét lại sớm khi chưa có mục tiêu
      }
    }

    // đạn
    for (const p of sim.projectiles) {
      if (!p.alive) continue;
      const target = sim.enemies.find((e) => e.id === p.targetId && e.alive);
      const tx = target ? target.x : p.lastX;
      const ty = target ? target.y : p.lastY;
      p.lastX = tx;
      p.lastY = ty;
      const dx = tx - p.x;
      const dy = ty - p.y;
      const d = Math.hypot(dx, dy);
      const step = p.speed * dt;
      if (d <= step + 6) {
        p.alive = false;
        if (p.kind === "blast") {
          for (const e of sim.enemies) {
            if (!e.alive) continue;
            const ddx = e.x - tx;
            const ddy = e.y - ty;
            if (ddx * ddx + ddy * ddy <= p.aoe * p.aoe) damage(e, p.dmg);
          }
          sim.events.push({ type: "boom", x: tx, y: ty, r: p.aoe });
        } else {
          if (target) damage(target, p.dmg);
          sim.events.push({ type: "hit", x: tx, y: ty });
        }
      } else {
        p.x += (dx / d) * step;
        p.y += (dy / d) * step;
      }
    }
    sim.projectiles = sim.projectiles.filter((p) => p.alive);

    // dọn xác + kiểm tra hết wave
    sim.enemies = sim.enemies.filter((e) => e.alive);
    if (sim.phase === "running" && sim.spawnList.length === 0 && sim.enemies.length === 0) {
      if (sim.wave >= WAVES.length) {
        sim.phase = "victory";
        sim.score += sim.core * 100 + sim.energy;
        sim.events.push({ type: "victory" });
      } else {
        sim.phase = "prep";
        sim.prepT = prepTime;
        sim.energy += WAVE_CLEAR_BONUS;
        sim.score += 300;
        sim.events.push({ type: "waveclear", wave: sim.wave, bonus: WAVE_CLEAR_BONUS });
      }
    }
  };

  sim.drainEvents = () => {
    const out = sim.events;
    sim.events = [];
    return out;
  };

  sim.paths = paths;
  return sim;
}
