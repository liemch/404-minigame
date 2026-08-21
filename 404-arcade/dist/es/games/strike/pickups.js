/**
 * pickups.js — vật phẩm hồi máu (thùng chữ thập tím) và đạn (thùng
 * vạch vàng cảnh báo) theo Asset Sheet. Xoay + nhấp nhô tại các điểm
 * cố định trên map, nhặt bằng cách chạy tới gần, hồi sinh sau 20 giây.
 */

import { createNode, addChild, meshNode, hex } from "./engine.js";

const RESPAWN = 20;
const PICK_RADIUS = 1.35;

export function createPickups(sceneRoot, world, audio, fx) {
  const items = [];

  function buildCrate(type) {
    const g = createNode();
    const body = meshNode("box", {
      pos: [0, 0, 0],
      scale: [0.72, 0.72, 0.72],
      color: hex("#151b38"),
    });
    addChild(g, body);
    if (type === "health") {
      // Chữ thập tím phát sáng (asset sheet: HỒI MÁU)
      addChild(g, meshNode("box", { pos: [0, 0, 0.37], scale: [0.4, 0.13, 0.03], color: hex("#b07bff"), emissive: 1 }));
      addChild(g, meshNode("box", { pos: [0, 0, 0.37], scale: [0.13, 0.4, 0.03], color: hex("#b07bff"), emissive: 1 }));
      addChild(g, meshNode("box", { pos: [0, 0.37, 0], scale: [0.4, 0.03, 0.13], color: hex("#b07bff"), emissive: 1 }));
      addChild(g, meshNode("box", { pos: [0, 0.37, 0], scale: [0.13, 0.03, 0.4], color: hex("#b07bff"), emissive: 1 }));
    } else {
      // Vạch vàng + viền cảnh báo (asset sheet: ĐẠN)
      addChild(g, meshNode("box", { pos: [0, 0, 0.37], scale: [0.44, 0.14, 0.03], color: hex("#ffd23f"), emissive: 0.9 }));
      addChild(g, meshNode("box", { pos: [0, 0.2, 0.37], scale: [0.3, 0.07, 0.03], color: hex("#ffd23f"), emissive: 0.6 }));
      addChild(g, meshNode("box", { pos: [0, 0.37, 0], scale: [0.44, 0.03, 0.14], color: hex("#ffd23f"), emissive: 0.9 }));
    }
    // Vòng sáng dưới chân
    addChild(g, meshNode("plane", {
      pos: [0, -0.45, 0],
      rot: [-Math.PI / 2, 0, 0],
      scale: [1.5, 1.5, 1],
      color: hex(type === "health" ? "#9a5cff" : "#ffd23f"),
      emissive: 1,
      opacity: 0.18,
      additive: true,
    }));
    addChild(sceneRoot, g);
    return g;
  }

  for (const [x, z] of world.pickupSpots.health) {
    items.push({ type: "health", node: buildCrate("health"), x, z, active: true, timer: 0, phase: Math.random() * 6 });
  }
  for (const [x, z] of world.pickupSpots.ammo) {
    items.push({ type: "ammo", node: buildCrate("ammo"), x, z, active: true, timer: 0, phase: Math.random() * 6 });
  }

  function reset() {
    for (const it of items) {
      it.active = true;
      it.timer = 0;
      it.node.visible = true;
    }
  }

  /** Trả về danh sách vật phẩm vừa nhặt trong frame này. */
  function update(dt, playerPos) {
    const picked = [];
    for (const it of items) {
      if (!it.active) {
        it.timer -= dt;
        if (it.timer <= 0) {
          it.active = true;
          it.node.visible = true;
          fx.burst([it.x, 0.8, it.z], it.type === "health" ? "#9a5cff" : "#ffd23f", 6);
        }
        continue;
      }
      it.phase += dt * 2;
      it.node.pos[0] = it.x;
      it.node.pos[2] = it.z;
      it.node.pos[1] = 0.85 + Math.sin(it.phase) * 0.12;
      it.node.rot[1] += dt * 1.6;

      if (playerPos) {
        const d = Math.hypot(playerPos[0] - it.x, playerPos[2] - it.z);
        if (d < PICK_RADIUS) {
          it.active = false;
          it.timer = RESPAWN;
          it.node.visible = false;
          audio.play("pickup");
          fx.burst([it.x, 1, it.z], it.type === "health" ? "#b07bff" : "#ffd23f", 10);
          picked.push(it.type);
        }
      }
    }
    return picked;
  }

  return { update, reset };
}
