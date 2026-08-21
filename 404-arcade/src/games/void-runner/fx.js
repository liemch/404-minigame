/**
 * fx.js — hiệu ứng tức thời của Void Runner (object pooling):
 *  - burst: hạt vuông tóe ra (nhặt shard, checkpoint, chết/respawn).
 *  - speed streaks: vạch gió lao ngược khi sprint/boost (cảm giác tốc độ).
 */

import { createNode, addChild, meshNode, hex } from "../strike/engine.js";

const SPARK_POOL = 70;
const STREAK_POOL = 14;

export function createVrFx(sceneRoot, motion = {}) {
  const root = createNode();
  addChild(sceneRoot, root);

  /* ---- Hạt tóe ---- */
  const sparks = [];
  for (let i = 0; i < SPARK_POOL; i++) {
    const n = meshNode("box", {
      color: hex("#b7f232"),
      emissive: 1,
      opacity: 0,
      additive: true,
      scale: [0.07, 0.07, 0.07],
    });
    n.visible = false;
    addChild(root, n);
    sparks.push({ node: n, vx: 0, vy: 0, vz: 0, t: 0, life: 0.42 });
  }
  let sparkIdx = 0;

  function burst(pos, color = "#b7f232", count = 10, power = 1) {
    const total = motion.reduced ? Math.ceil(count / 2) : count;
    for (let i = 0; i < total; i++) {
      const s = sparks[sparkIdx];
      sparkIdx = (sparkIdx + 1) % SPARK_POOL;
      const a = Math.random() * Math.PI * 2;
      const sp = (1.6 + Math.random() * 3) * power;
      s.node.pos[0] = pos[0];
      s.node.pos[1] = pos[1];
      s.node.pos[2] = pos[2];
      s.vx = Math.cos(a) * sp;
      s.vz = Math.sin(a) * sp;
      s.vy = 1.5 + Math.random() * 3 * power;
      s.node.mesh.color = hex(color);
      s.node.mesh.opacity = 0.95;
      s.node.visible = true;
      s.t = s.life * (0.6 + Math.random() * 0.4);
    }
  }

  /* ---- Vạch gió tốc độ ---- */
  const streaks = [];
  for (let i = 0; i < STREAK_POOL; i++) {
    const n = meshNode("box", {
      color: hex("#9fefff"),
      emissive: 1,
      opacity: 0,
      additive: true,
      scale: [0.02, 0.02, 1.6],
    });
    n.visible = false;
    addChild(root, n);
    streaks.push({ node: n, t: 0 });
  }
  let streakOn = 0;

  /** Bật vạch gió theo mức 0..1 (theo tốc độ). */
  function setWind(level) {
    streakOn = motion.reduced ? 0 : level;
  }

  function update(dt, cam) {
    for (const s of sparks) {
      if (s.t <= 0) continue;
      s.t -= dt;
      s.vy -= 10 * dt;
      s.node.pos[0] += s.vx * dt;
      s.node.pos[1] += s.vy * dt;
      s.node.pos[2] += s.vz * dt;
      s.node.rot[0] += dt * 6;
      s.node.rot[2] += dt * 5;
      s.node.mesh.opacity = Math.max(0, (s.t / s.life) * 0.95);
      if (s.t <= 0) s.node.visible = false;
    }

    if (!cam) return;
    for (let i = 0; i < streaks.length; i++) {
      const st = streaks[i];
      const want = streakOn > 0.05 && i / streaks.length < streakOn;
      if (!want) {
        if (st.node.visible) {
          st.node.visible = false;
          st.t = 0;
        }
        continue;
      }
      st.t -= dt;
      if (st.t <= 0) {
        // Sinh lại vạch phía trước camera, lệch ngẫu nhiên quanh trục nhìn
        st.t = 0.24 + Math.random() * 0.28;
        const dx = -Math.sin(cam.yaw);
        const dz = -Math.cos(cam.yaw);
        const rx = Math.cos(cam.yaw);
        const rz = -Math.sin(cam.yaw);
        const off = (Math.random() - 0.5) * 7;
        const up = (Math.random() - 0.5) * 4;
        st.node.pos[0] = cam.pos[0] + dx * 13 + rx * off;
        st.node.pos[1] = cam.pos[1] + up;
        st.node.pos[2] = cam.pos[2] + dz * 13 + rz * off;
        st.node.rot[1] = cam.yaw;
        st.node.scale[2] = 1.2 + Math.random() * 2.2;
        st.node.visible = true;
      }
      // Lao ngược về phía camera
      st.node.pos[0] += Math.sin(cam.yaw) * 26 * dt;
      st.node.pos[2] += Math.cos(cam.yaw) * 26 * dt;
      st.node.mesh.opacity = Math.min(0.5, st.t * 1.6) * streakOn;
    }
  }

  return { burst, setWind, update };
}
