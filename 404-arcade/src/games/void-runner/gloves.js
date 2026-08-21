/**
 * gloves.js — first-person gloves theo asset sheet: găng đen, sọc neon
 * cổ tay, TAM GIÁC phát sáng trên mu tay (trái magenta / phải cyan như
 * ảnh gameplay). Procedural animation: vung khi chạy, nâng khi nhảy,
 * chống về phía tường khi wall-run, hạ thấp khi trượt, dịp khi đáp.
 */

import { createNode, addChild, meshNode, hex } from "../strike/engine.js";
import { VR_COLORS } from "./config.js";

const C = VR_COLORS;

function buildHand(side, accent) {
  // side: -1 trái, +1 phải — dựng trong không gian camera (nhìn về -Z)
  const hand = createNode();
  const DARK = hex("#131625");
  const DARKER = hex("#0b0e1c");
  const NEON = hex(accent);

  // Cẳng tay (chạy vào từ góc màn hình)
  addChild(hand, meshNode("box", {
    pos: [side * 0.055, -0.075, 0.16],
    rot: [0.25, side * -0.12, side * 0.16],
    scale: [0.115, 0.1, 0.3],
    color: DARKER,
  }));
  // Vòng cổ tay + sọc neon
  addChild(hand, meshNode("box", {
    pos: [side * 0.022, -0.032, 0.075],
    rot: [0.18, side * -0.1, side * 0.1],
    scale: [0.115, 0.095, 0.055],
    color: DARK,
  }));
  addChild(hand, meshNode("box", {
    pos: [side * 0.022, -0.028, 0.075],
    rot: [0.18, side * -0.1, side * 0.1],
    scale: [0.118, 0.02, 0.028],
    color: NEON,
    emissive: 1,
  }));
  // Mu bàn tay (hơi nghiêng úp về trước)
  addChild(hand, meshNode("box", {
    pos: [0, 0, 0],
    rot: [0.32, side * -0.08, 0],
    scale: [0.105, 0.045, 0.13],
    color: DARK,
  }));
  // Tam giác neon trên mu tay (chỉa về trước như ảnh)
  addChild(hand, meshNode("tri", {
    pos: [0, 0.033, -0.005],
    rot: [-Math.PI / 2 + 0.32, 0, Math.PI],
    scale: [0.055, 0.062, 1],
    color: NEON,
    emissive: 1,
  }));
  // Sọc neon dọc mu
  addChild(hand, meshNode("box", {
    pos: [side * 0.045, 0.02, 0.02],
    rot: [0.32, 0, 0],
    scale: [0.008, 0.012, 0.1],
    color: NEON,
    emissive: 0.9,
  }));

  // 4 ngón: 2 đốt cong xuống
  for (let i = 0; i < 4; i++) {
    const fx = (i - 1.5) * 0.026;
    addChild(hand, meshNode("box", {
      pos: [fx, -0.028, -0.082],
      rot: [0.62, 0, 0],
      scale: [0.02, 0.02, 0.055],
      color: DARK,
    }));
    addChild(hand, meshNode("box", {
      pos: [fx, -0.052, -0.1],
      rot: [1.05, 0, 0],
      scale: [0.018, 0.018, 0.04],
      color: DARKER,
    }));
  }
  // Ngón cái
  addChild(hand, meshNode("box", {
    pos: [side * -0.062, -0.02, -0.02],
    rot: [0.5, side * 0.5, 0],
    scale: [0.02, 0.02, 0.06],
    color: DARK,
  }));
  // Khớp ngón phát sáng nhẹ
  addChild(hand, meshNode("box", {
    pos: [0, -0.018, -0.07],
    rot: [0.5, 0, 0],
    scale: [0.1, 0.008, 0.012],
    color: NEON,
    emissive: 0.7,
  }));

  return hand;
}

export function createGloves(motion = {}) {
  const root = createNode();

  const BASE = {
    left: { pos: [-0.35, -0.335, -0.54], rot: [0.15, 0.32, 0.28] },
    right: { pos: [0.35, -0.335, -0.54], rot: [0.15, -0.32, -0.28] },
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

    const airLift = s.grounded ? 0 : 0.05;
    const boostBack = s.boosting ? 0.06 : 0;

    for (const [node, base, sideSign] of [[left, BASE.left, -1], [right, BASE.right, 1]]) {
      let tx = base.pos[0];
      let ty = base.pos[1];
      let tz = base.pos[2];
      let rx = base.rot[0];
      let ry = base.rot[1];
      let rz = base.rot[2];

      // Vung tay so le khi chạy
      const swing = Math.sin(phase + (sideSign > 0 ? 0 : Math.PI));
      ty += swing * 0.02 * amp;
      tz += Math.cos(phase + (sideSign > 0 ? 0 : Math.PI)) * 0.022 * amp;
      rx += swing * 0.1 * amp;

      // Bay: nâng hai tay lên xòe ra
      ty += airLift;
      rx -= airLift * 2.2;
      tx += sideSign * airLift * 0.5;

      // Boost: tay lùi ra sau (cảm giác tốc độ)
      tz += boostBack;
      ry += sideSign * boostBack * 1.4;

      // Trượt: hạ thấp, ngả ra hai bên
      if (s.sliding) {
        ty -= 0.09;
        tx += sideSign * 0.07;
        rx += 0.35;
        rz += sideSign * -0.3;
      }

      // Wall-run: tay phía tường vươn ra chống
      if (s.wallRun !== 0) {
        if (sideSign === s.wallRun) {
          tx += sideSign * 0.16;
          ty += 0.1;
          tz += 0.05;
          ry += sideSign * -0.7;
          rz += sideSign * 0.5;
        } else {
          tx += sideSign * -0.04;
          ty -= 0.02;
        }
      }

      // Sway theo chuột + land dip
      tx += swayX * 0.014;
      ty += swayY * 0.014 + landDip;

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
