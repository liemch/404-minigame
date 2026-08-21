/**
 * gloves.js — first-person gloves theo asset sheet + ảnh gameplay:
 * hai bàn tay LỚN vươn ra từ hai góc dưới màn hình, găng đen nhiều
 * mảnh giáp, cổ tay có vòng neon, TAM GIÁC phát sáng trên mu tay
 * (trái magenta / phải cyan như ảnh), ngón tay xòe hướng về trước.
 * Procedural animation: vung khi chạy, nâng khi nhảy, chống về phía
 * tường khi wall-run, hạ thấp khi trượt, dịp khi đáp.
 */

import { createNode, addChild, meshNode, hex } from "../strike/engine.js";
import { VR_COLORS } from "./config.js";

const C = VR_COLORS;

function buildHand(side, accent) {
  // side: -1 trái, +1 phải — dựng trong không gian camera (nhìn về -Z),
  // gốc tọa độ đặt tại cổ tay, ngón tay hướng -Z.
  const hand = createNode();
  const DARK = hex("#1a1e30");
  const DARKER = hex("#10131f");
  const PLATE = hex("#232840");
  const NEON = hex(accent);

  // Cẳng tay bọc giáp (chạy vào từ góc màn hình)
  addChild(hand, meshNode("box", {
    pos: [side * 0.06, -0.11, 0.3],
    rot: [0.45, side * -0.1, side * 0.14],
    scale: [0.175, 0.15, 0.52],
    color: DARKER,
  }));
  addChild(hand, meshNode("box", {
    pos: [side * 0.045, -0.03, 0.3],
    rot: [0.45, side * -0.1, side * 0.14],
    scale: [0.15, 0.055, 0.36],
    color: PLATE,
  }));
  // Sọc neon dọc cẳng tay
  addChild(hand, meshNode("box", {
    pos: [side * 0.045, 0.006, 0.3],
    rot: [0.45, side * -0.1, side * 0.14],
    scale: [0.025, 0.012, 0.3],
    color: NEON,
    emissive: 0.9,
  }));

  // Vòng cổ tay + 2 khoen neon
  addChild(hand, meshNode("box", {
    pos: [side * 0.018, -0.035, 0.12],
    rot: [0.3, side * -0.08, side * 0.08],
    scale: [0.165, 0.13, 0.075],
    color: DARK,
  }));
  addChild(hand, meshNode("box", {
    pos: [side * 0.018, -0.03, 0.1],
    rot: [0.3, side * -0.08, side * 0.08],
    scale: [0.172, 0.028, 0.03],
    color: NEON,
    emissive: 1,
  }));
  addChild(hand, meshNode("box", {
    pos: [side * 0.02, -0.032, 0.15],
    rot: [0.3, side * -0.08, side * 0.08],
    scale: [0.17, 0.016, 0.02],
    color: hex(C.violet),
    emissive: 0.85,
  }));

  // Mu bàn tay (hơi nghiêng úp về trước)
  addChild(hand, meshNode("box", {
    pos: [0, -0.005, -0.02],
    rot: [0.35, side * -0.06, 0],
    scale: [0.16, 0.06, 0.2],
    color: DARK,
  }));
  // Tấm giáp nổi trên mu
  addChild(hand, meshNode("box", {
    pos: [0, 0.028, -0.015],
    rot: [0.35, side * -0.06, 0],
    scale: [0.12, 0.022, 0.14],
    color: PLATE,
  }));
  // Tam giác neon trên mu tay (chỉa về trước như ảnh)
  addChild(hand, meshNode("tri", {
    pos: [0, 0.05, -0.02],
    rot: [-Math.PI / 2 + 0.35, 0, Math.PI],
    scale: [0.055, 0.065, 1],
    color: NEON,
    emissive: 1,
  }));
  addChild(hand, meshNode("tri", {
    pos: [0, 0.052, -0.02],
    rot: [-Math.PI / 2 + 0.35, 0, Math.PI],
    scale: [0.078, 0.09, 1],
    color: NEON,
    emissive: 1,
    opacity: 0.28,
    additive: true,
  }));
  // Sọc neon dọc cạnh ngoài mu tay
  addChild(hand, meshNode("box", {
    pos: [side * 0.07, 0.02, 0.0],
    rot: [0.35, 0, 0],
    scale: [0.012, 0.016, 0.15],
    color: NEON,
    emissive: 0.9,
  }));

  // Dải khớp ngón phát sáng nhẹ
  addChild(hand, meshNode("box", {
    pos: [0, -0.008, -0.125],
    rot: [0.5, 0, 0],
    scale: [0.15, 0.014, 0.022],
    color: NEON,
    emissive: 0.75,
  }));

  // 4 ngón xòe gần thẳng, hơi chùng xuống (như ảnh tay vươn về trước)
  for (let i = 0; i < 4; i++) {
    const fx = (i - 1.5) * 0.045;
    const fan = (i - 1.5) * 0.07 * side;
    addChild(hand, meshNode("box", {
      pos: [fx, -0.018, -0.175],
      rot: [0.22, fan, 0],
      scale: [0.034, 0.033, 0.125],
      color: DARK,
    }));
    addChild(hand, meshNode("box", {
      pos: [fx, -0.042, -0.275],
      rot: [0.48, fan, 0],
      scale: [0.031, 0.029, 0.1],
      color: DARKER,
    }));
  }
  // Ngón cái
  addChild(hand, meshNode("box", {
    pos: [side * -0.105, -0.03, -0.05],
    rot: [0.3, side * 0.6, 0],
    scale: [0.034, 0.033, 0.115],
    color: DARK,
  }));
  addChild(hand, meshNode("box", {
    pos: [side * -0.15, -0.045, -0.12],
    rot: [0.5, side * 0.7, 0],
    scale: [0.029, 0.028, 0.08],
    color: DARKER,
  }));

  return hand;
}

export function createGloves(motion = {}) {
  const root = createNode();

  const BASE = {
    left: { pos: [-0.36, -0.2, -0.52], rot: [0.1, 0.36, 0.2] },
    right: { pos: [0.36, -0.2, -0.52], rot: [0.1, -0.36, -0.2] },
  };

  const left = createNode({ pos: [...BASE.left.pos], rot: [...BASE.left.rot] });
  const right = createNode({ pos: [...BASE.right.pos], rot: [...BASE.right.rot] });
  addChild(left, buildHand(-1, C.magenta));
  addChild(right, buildHand(1, C.cyan));
  addChild(root, left);
  addChild(root, right);

  let phase = 0;
  let amp = 0;
  let landDip = 0;
  let landVel = 0;
  let swayX = 0;
  let swayY = 0;

  function update(dt, s) {
    // s: {speed, grounded, sliding, wallRun (-1|0|1), boosting, landed, lookDx, lookDy}
    if (s.landed > 4 && !motion.reduced) landVel -= Math.min(0.6, s.landed * 0.04);
    landVel += (-landDip * 55 - landVel * 9) * dt;
    landDip += landVel * dt;

    if (!motion.reduced && s.grounded && s.speed > 0.8 && !s.sliding) {
      phase += dt * (6 + s.speed * 1.35);
      amp = Math.min(1, amp + dt * 5);
    } else {
      amp = Math.max(0, amp - dt * 4);
    }

    const swayTX = Math.max(-1, Math.min(1, -(s.lookDx || 0) * 0.05));
    const swayTY = Math.max(-1, Math.min(1, (s.lookDy || 0) * 0.05));
    swayX += (swayTX - swayX) * Math.min(1, dt * 7);
    swayY += (swayTY - swayY) * Math.min(1, dt * 7);

    const airLift = s.grounded ? 0 : 0.06;
    const boostBack = s.boosting ? 0.07 : 0;

    for (const [node, base, sideSign] of [[left, BASE.left, -1], [right, BASE.right, 1]]) {
      let tx = base.pos[0];
      let ty = base.pos[1];
      let tz = base.pos[2];
      let rx = base.rot[0];
      let ry = base.rot[1];
      let rz = base.rot[2];

      // Vung tay so le khi chạy
      const swing = Math.sin(phase + (sideSign > 0 ? 0 : Math.PI));
      ty += swing * 0.026 * amp;
      tz += Math.cos(phase + (sideSign > 0 ? 0 : Math.PI)) * 0.03 * amp;
      rx += swing * 0.12 * amp;

      // Bay: nâng hai tay lên xòe ra
      ty += airLift;
      rx -= airLift * 2.2;
      tx += sideSign * airLift * 0.5;

      // Boost: tay lùi ra sau (cảm giác tốc độ)
      tz += boostBack;
      ry += sideSign * boostBack * 1.4;

      // Trượt: hạ thấp, ngả ra hai bên
      if (s.sliding) {
        ty -= 0.1;
        tx += sideSign * 0.08;
        rx += 0.35;
        rz += sideSign * -0.3;
      }

      // Wall-run: tay phía tường vươn ra chống
      if (s.wallRun !== 0) {
        if (sideSign === s.wallRun) {
          tx += sideSign * 0.18;
          ty += 0.12;
          tz += 0.05;
          ry += sideSign * -0.7;
          rz += sideSign * 0.5;
        } else {
          tx += sideSign * -0.05;
          ty -= 0.02;
        }
      }

      // Sway theo chuột + land dip
      tx += swayX * 0.016;
      ty += swayY * 0.016 + landDip;

      node.pos[0] += (tx - node.pos[0]) * Math.min(1, dt * 9);
      node.pos[1] += (ty - node.pos[1]) * Math.min(1, dt * 9);
      node.pos[2] += (tz - node.pos[2]) * Math.min(1, dt * 9);
      node.rot[0] += (rx - node.rot[0]) * Math.min(1, dt * 9);
      node.rot[1] += (ry - node.rot[1]) * Math.min(1, dt * 9);
      node.rot[2] += (rz - node.rot[2]) * Math.min(1, dt * 9);
    }
  }

  return { viewmodel: root, update };
}
