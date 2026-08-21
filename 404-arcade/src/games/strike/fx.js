/**
 * fx.js — hiệu ứng tức thời: tracer đạn, tia lửa va chạm, vòng nổ.
 * Dùng object pooling — không tạo geometry/material mới trong frame.
 */

import { createNode, addChild, meshNode, hex } from "./engine.js";

const TRACER_POOL = 24;
const SPARK_POOL = 90;

export function createFx(sceneRoot, { reducedMotion = false } = {}) {
  const root = createNode();
  addChild(sceneRoot, root);

  /* ---- Tracer: hộp mảnh kéo dài từ A đến B ---- */
  const tracers = [];
  for (let i = 0; i < TRACER_POOL; i++) {
    const n = meshNode("box", {
      color: hex("#ffe9b0"),
      emissive: 1,
      opacity: 0,
      additive: true,
      scale: [0.03, 0.03, 1],
    });
    n.visible = false;
    addChild(root, n);
    tracers.push({ node: n, t: 0, life: 0.07 });
  }
  let tracerIdx = 0;

  function tracer(from, to, color = "#ffe9b0") {
    const slot = tracers[tracerIdx];
    tracerIdx = (tracerIdx + 1) % TRACER_POOL;
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const dz = to[2] - from[2];
    const len = Math.hypot(dx, dy, dz);
    if (len < 0.05) return;
    const n = slot.node;
    n.pos[0] = (from[0] + to[0]) / 2;
    n.pos[1] = (from[1] + to[1]) / 2;
    n.pos[2] = (from[2] + to[2]) / 2;
    // Hộp mặc định dọc trục Z → xoay theo hướng đạn
    n.rot[1] = Math.atan2(dx, dz);
    n.rot[0] = -Math.asin(dy / len);
    n.scale[2] = len;
    n.mesh.color = hex(color);
    n.mesh.opacity = 0.8;
    n.visible = true;
    slot.t = slot.life;
  }

  /* ---- Tia lửa: hạt vuông nhỏ bắn tóe ---- */
  const sparks = [];
  for (let i = 0; i < SPARK_POOL; i++) {
    const n = meshNode("box", {
      color: hex("#20e3ff"),
      emissive: 1,
      opacity: 0,
      additive: true,
      scale: [0.05, 0.05, 0.05],
    });
    n.visible = false;
    addChild(root, n);
    sparks.push({ node: n, vx: 0, vy: 0, vz: 0, t: 0, life: 0.32 });
  }
  let sparkIdx = 0;

  function burst(pos, color = "#20e3ff", count = 10) {
    const total = reducedMotion ? Math.ceil(count / 2) : count;
    for (let i = 0; i < total; i++) {
      const s = sparks[sparkIdx];
      sparkIdx = (sparkIdx + 1) % SPARK_POOL;
      const a = Math.random() * Math.PI * 2;
      const up = Math.random() * 3 + 1;
      const sp = 2 + Math.random() * 3.4;
      s.node.pos[0] = pos[0];
      s.node.pos[1] = pos[1];
      s.node.pos[2] = pos[2];
      s.vx = Math.cos(a) * sp;
      s.vz = Math.sin(a) * sp;
      s.vy = up;
      s.node.mesh.color = hex(color);
      s.node.mesh.opacity = 0.95;
      s.node.visible = true;
      s.t = s.life * (0.6 + Math.random() * 0.4);
    }
  }

  function update(dt) {
    for (const tr of tracers) {
      if (tr.t <= 0) continue;
      tr.t -= dt;
      tr.node.mesh.opacity = Math.max(0, (tr.t / tr.life) * 0.8);
      if (tr.t <= 0) tr.node.visible = false;
    }
    for (const s of sparks) {
      if (s.t <= 0) continue;
      s.t -= dt;
      s.vy -= 12 * dt;
      s.node.pos[0] += s.vx * dt;
      s.node.pos[1] += s.vy * dt;
      s.node.pos[2] += s.vz * dt;
      s.node.mesh.opacity = Math.max(0, (s.t / s.life) * 0.95);
      if (s.t <= 0) s.node.visible = false;
    }
  }

  return { tracer, burst, update };
}
