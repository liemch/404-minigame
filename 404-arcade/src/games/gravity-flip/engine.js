/**
 * engine.js — mô phỏng Gravity Flip 404 (runner một chạm, fixed timestep).
 *
 * Nhân vật tự chạy; đảo trọng lực CHỈ khi đang bám sàn/trần/xe đệm
 * (không spam giữa không trung → không teleport). Tốc độ tăng theo
 * quãng đường và có trần. Năng lượng từ tinh thể quyết định COMBO
 * (x1–x6), khiên hiếm đỡ một cú va chạm.
 */

import { WORLD, START_SEGMENT, instantiate, nextPattern } from "./segments.js";

export { WORLD };

export const PLAYER = { size: 40, hitbox: 30 };

const GRAVITY = 3000;
const MAX_VY = 1050;
const BASE_SPEED = 340;
const MAX_SPEED = 560; // trần tốc độ — biên an toàn pattern tính theo giá trị này
const SPIKE_H = 46;
const SPIKE_STEP = 38;
const PLATFORM_H = 30;

export function createSim() {
  const sim = {
    x: 420, // vị trí người chơi trong thế giới
    y: WORLD.floor - PLAYER.size / 2,
    vy: 0,
    g: 1, // 1: trọng lực xuống sàn, -1: lên trần
    grounded: "floor", // 'floor' | 'ceiling' | platform | null
    rot: 0, // góc xoay hiển thị (nội suy khi đảo)
    speed: BASE_SPEED,
    dist: 0,
    score: 0,
    energy: 0,
    combo: 1,
    maxCombo: 1,
    shards: 0,
    flips: 0,
    shield: false,
    inv: 0,
    time: 0,
    over: false,
    segments: [instantiate(START_SEGMENT, 0)],
    genExit: "floor",
    genX: START_SEGMENT.len,
    events: [],
  };
  return sim;
}

export function drainEvents(sim) {
  const ev = sim.events;
  sim.events = [];
  return ev;
}

/** Đảo trọng lực — chỉ hợp lệ khi đang bám bề mặt. */
export function tryFlip(sim) {
  if (sim.over || sim.grounded === null) return false;
  sim.g = -sim.g;
  sim.vy = 0;
  sim.grounded = null;
  sim.flips += 1;
  sim.events.push({ type: "flip", g: sim.g });
  return true;
}

/** Sinh segment mới phía trước + dọn segment đã đi qua. */
function ensureSegments(sim, rand) {
  while (sim.genX < sim.x + 2600) {
    const pat = nextPattern(sim.genExit, rand);
    sim.segments.push(instantiate(pat, sim.genX));
    sim.genX += pat.len;
    sim.genExit = pat.exit;
  }
  while (sim.segments.length && sim.segments[0].endX < sim.x - 900) {
    sim.segments.shift();
  }
}

function overlap(ax0, ay0, ax1, ay1, bx0, by0, bx1, by1) {
  return ax0 < bx1 && ax1 > bx0 && ay0 < by1 && ay1 > by0;
}

export function stepSim(sim, dt, rand = Math.random) {
  if (sim.over) return;
  sim.time += dt;

  // tốc độ tăng theo quãng đường, có trần
  sim.speed = Math.min(MAX_SPEED, BASE_SPEED + sim.dist * 0.45);
  sim.x += sim.speed * dt;
  sim.dist = sim.x / 50; // 50px = 1m
  sim.score += (sim.speed * dt / 50) * 6 * (1 + (sim.combo - 1) * 0.15);

  // năng lượng phân rã chậm → combo x1..x6
  sim.energy = Math.max(0, sim.energy - 2.5 * dt);
  sim.combo = 1 + Math.floor(Math.min(99.9, sim.energy) / 20);
  sim.maxCombo = Math.max(sim.maxCombo, sim.combo);
  if (sim.inv > 0) sim.inv -= dt;

  const hh = PLAYER.hitbox / 2;
  const half = PLAYER.size / 2;

  // ---- trọng lực + va chạm bề mặt ----
  if (sim.grounded === "floor") {
    sim.y = WORLD.floor - half;
    if (sim.g === -1) sim.grounded = null;
  } else if (sim.grounded === "ceiling") {
    sim.y = WORLD.ceil + half;
    if (sim.g === 1) sim.grounded = null;
  } else if (sim.grounded && typeof sim.grounded === "object") {
    const p = sim.grounded;
    // rơi khỏi mép xe đệm
    if (sim.x < p.x - 6 || sim.x > p.x + p.w + 6) sim.grounded = null;
    else sim.y = sim.g === 1 ? p.y - half : p.y + PLATFORM_H + half;
  }

  if (sim.grounded === null) {
    const prevY = sim.y;
    sim.vy = Math.max(-MAX_VY, Math.min(MAX_VY, sim.vy + GRAVITY * sim.g * dt));
    sim.y += sim.vy * dt;

    // đáp sàn / trần
    if (sim.g === 1 && sim.y + half >= WORLD.floor) {
      sim.y = WORLD.floor - half;
      sim.vy = 0;
      sim.grounded = "floor";
      sim.events.push({ type: "land", side: "floor" });
    } else if (sim.g === -1 && sim.y - half <= WORLD.ceil) {
      sim.y = WORLD.ceil + half;
      sim.vy = 0;
      sim.grounded = "ceiling";
      sim.events.push({ type: "land", side: "ceiling" });
    } else {
      // đáp xe đệm (một chiều theo hướng trọng lực, cả hai mặt)
      for (const seg of sim.segments) {
        for (const p of seg.platforms) {
          if (sim.x < p.x - 4 || sim.x > p.x + p.w + 4) continue;
          if (sim.g === 1 && sim.vy > 0 && prevY + half <= p.y + 2 && sim.y + half >= p.y) {
            sim.y = p.y - half;
            sim.vy = 0;
            sim.grounded = p;
            sim.events.push({ type: "land", side: "platform" });
          } else if (
            sim.g === -1 &&
            sim.vy < 0 &&
            prevY - half >= p.y + PLATFORM_H - 2 &&
            sim.y - half <= p.y + PLATFORM_H
          ) {
            sim.y = p.y + PLATFORM_H + half;
            sim.vy = 0;
            sim.grounded = p;
            sim.events.push({ type: "land", side: "platform" });
          }
        }
      }
    }
  }

  // góc xoay hiển thị đuổi theo hướng trọng lực
  const targetRot = sim.g === 1 ? 0 : Math.PI;
  sim.rot += (targetRot - sim.rot) * Math.min(1, dt * 10);

  // ---- va chạm gai / nhặt đồ ----
  const px0 = sim.x - hh;
  const px1 = sim.x + hh;
  const py0 = sim.y - hh;
  const py1 = sim.y + hh;

  for (const seg of sim.segments) {
    if (seg.endX < sim.x - 120 || seg.startX > sim.x + 120) continue;

    for (const run of seg.spikes) {
      const sy0 = run.side === "floor" ? WORLD.floor - SPIKE_H + 10 : WORLD.ceil;
      const sy1 = run.side === "floor" ? WORLD.floor : WORLD.ceil + SPIKE_H - 10;
      if (overlap(px0, py0, px1, py1, run.x + 5, sy0, run.x + run.w - 5, sy1)) {
        if (sim.inv > 0) continue;
        if (sim.shield) {
          sim.shield = false;
          sim.inv = 1.2;
          sim.events.push({ type: "shieldHit" });
        } else {
          sim.over = true;
          sim.events.push({ type: "dead" });
          return;
        }
      }
    }

    for (const sh of seg.shards) {
      if (sh.taken) continue;
      const dx = sh.x - sim.x;
      const dy = sh.y - sim.y;
      if (dx * dx + dy * dy < 46 * 46) {
        sh.taken = true;
        sim.shards += 1;
        sim.energy = Math.min(100, sim.energy + 12);
        sim.score += 25 * sim.combo;
        sim.events.push({ type: "shard", x: sh.x, y: sh.y });
      }
    }

    if (seg.shield && !seg.shield.taken && !sim.shield) {
      const dx = seg.shield.x - sim.x;
      const dy = seg.shield.y - sim.y;
      if (dx * dx + dy * dy < 52 * 52) {
        seg.shield.taken = true;
        sim.shield = true;
        sim.events.push({ type: "shield", x: seg.shield.x, y: seg.shield.y });
      }
    }
  }

  ensureSegments(sim, rand);
}

export const SPIKE = { h: SPIKE_H, step: SPIKE_STEP };
export const PLATFORM = { h: PLATFORM_H };
