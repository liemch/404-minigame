/**
 * player.js — capsule controller góc nhìn thứ nhất của VOID RUNNER:
 * WASD + sprint + jump (coyote time, jump buffer) + slide (hạ capsule,
 * không đứng dậy dưới trần) + wall-run (chỉ trên tường đánh dấu, giảm
 * gravity, camera roll, wall-jump) + moving platform displacement +
 * jump pad boost + camera effects (bob/dip/roll/FOV, tôn trọng
 * reduced motion). Dự đoán điểm hạ cánh cho landing marker.
 */

import { clamp } from "../../core/utils.js";
import { VR_MOVE } from "./config.js";

const M = VR_MOVE;

export function createPlayer(world, camera, motion = {}) {
  // motion.reduced đọc động mỗi frame (setting đổi được trong pause menu)
  const pos = [0, 0, 0]; // chân nhân vật
  const vel = [0, 0, 0];
  let yaw = 0;
  let pitch = 0;

  let grounded = false;
  let groundRef = null;   // collider đang đứng (mover → nhận displacement)
  let airTime = 0;
  let jumpBufferT = 0;
  let jumpedSinceGround = false;

  let sliding = false;
  let slideT = 0;
  let slideDir = [0, 0];
  let crouched = false;   // capsule thấp (slide hoặc kẹt dưới trần)

  let wallRun = null;     // {collider, side, tangent:[x,z], normal:[x,z], t}
  let wallCooldown = 0;
  let lastWall = null;

  let boostT = 0;

  // Camera feel
  let bobPhase = 0;
  let bobAmp = 0;
  let dip = 0;
  let dipVel = 0;
  let rollCur = 0;
  let shakeT = 0;
  let shakeAmp = 0;
  let stepAcc = 0;
  let eyeCur = M.eyeStand;

  const height = () => (crouched ? M.crouchH : M.standH);

  function reset(spawn) {
    pos[0] = spawn.pos[0];
    pos[1] = spawn.pos[1];
    pos[2] = spawn.pos[2];
    vel[0] = vel[1] = vel[2] = 0;
    yaw = spawn.yaw;
    pitch = 0;
    grounded = true;
    groundRef = null;
    airTime = 0;
    jumpBufferT = 0;
    jumpedSinceGround = false;
    sliding = false;
    crouched = false;
    wallRun = null;
    wallCooldown = 0;
    lastWall = null;
    boostT = 0;
    dip = 0;
    dipVel = 0;
    rollCur = 0;
    eyeCur = M.eyeStand;
    camera.roll = 0;
  }

  function look(dx, dy, sensitivity) {
    const k = 0.0021 * sensitivity;
    yaw -= dx * k;
    pitch = clamp(pitch - dy * k, -1.45, 1.45);
  }

  function queueJump() {
    jumpBufferT = M.jumpBuffer;
  }

  function shake(amp = 0.6) {
    if (motion.reduced) return;
    shakeT = 0.3;
    shakeAmp = amp;
  }

  function boost(dirVec) {
    vel[0] = dirVec[0] * M.boostSpeed;
    vel[2] = dirVec[2] * M.boostSpeed;
    vel[1] = M.boostJumpV;
    grounded = false;
    groundRef = null;
    boostT = M.boostTime;
    jumpedSinceGround = true;
  }

  /* ---------- Trợ giúp va chạm ---------- */

  function overlapXZ(c, r) {
    return (
      pos[0] > c.min[0] - r && pos[0] < c.max[0] + r &&
      pos[2] > c.min[2] - r && pos[2] < c.max[2] + r
    );
  }

  function canStand() {
    // Có trần chặn trong khoảng crouch→stand không?
    const top = pos[1] + M.standH;
    for (const c of world.colliders) {
      if (!overlapXZ(c, M.capsuleR * 0.8)) continue;
      if (c.min[1] < top && c.max[1] > pos[1] + M.crouchH) return false;
    }
    return true;
  }

  /* ---------- Wall-run ---------- */

  function tryEngageWall() {
    if (wallCooldown > 0 || grounded || sliding) return;
    const hSpeed = Math.hypot(vel[0], vel[2]);
    if (hSpeed < M.wallRunMinSpeed || vel[1] > 3.5) return;
    const midY = pos[1] + height() * 0.55;
    for (const c of world.colliders) {
      if (!c.wallRun || c === lastWall) continue;
      if (midY < c.min[1] || midY > c.max[1]) continue;
      const reach = M.capsuleR + 0.5;
      if (c.axis === "z") {
        // Tường dọc Z: player phải ở phía face (±X) và trong tầm với
        const surfX = c.face < 0 ? c.min[0] : c.max[0];
        const dx = (pos[0] - surfX) * c.face;
        if (dx < 0 || dx > reach) continue;
        if (pos[2] < c.min[2] - 0.4 || pos[2] > c.max[2] + 0.4) continue;
        const tz = vel[2] >= 0 ? 1 : -1;
        if (Math.abs(vel[2]) < M.wallRunMinSpeed * 0.7) continue;
        wallRun = {
          collider: c,
          normal: [c.face, 0],
          tangent: [0, tz],
          t: 0,
        };
      } else {
        const surfZ = c.face < 0 ? c.min[2] : c.max[2];
        const dz = (pos[2] - surfZ) * c.face;
        if (dz < 0 || dz > reach) continue;
        if (pos[0] < c.min[0] - 0.4 || pos[0] > c.max[0] + 0.4) continue;
        const tx = vel[0] >= 0 ? 1 : -1;
        if (Math.abs(vel[0]) < M.wallRunMinSpeed * 0.7) continue;
        wallRun = {
          collider: c,
          normal: [0, c.face],
          tangent: [tx, 0],
          t: 0,
        };
      }
      if (wallRun) {
        vel[1] = Math.max(vel[1], 1.2);
        return;
      }
    }
  }

  function detachWall(cooldown = M.wallRunCooldown) {
    if (!wallRun) return;
    lastWall = wallRun.collider;
    wallRun = null;
    wallCooldown = cooldown;
  }

  /** Bên tường so với hướng nhìn: +1 phải, -1 trái (cho camera roll/gloves). */
  function wallSide() {
    if (!wallRun) return 0;
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);
    // Tường nằm ở phía -normal so với player
    const d = -(wallRun.normal[0] * rightX + wallRun.normal[1] * rightZ);
    return d > 0 ? 1 : -1;
  }

  /* ---------- Update chính ---------- */

  function update(dt, input) {
    // input: {forward, strafe, sprintHeld, sprintAllowed, slideHeld}
    const ev = {
      jumped: false, wallJumped: false, landed: 0,
      slideStart: false, slideEnd: false,
      wallStart: false, wallEnd: false, step: false,
    };

    wallCooldown = Math.max(0, wallCooldown - dt);
    jumpBufferT = Math.max(0, jumpBufferT - dt);
    boostT = Math.max(0, boostT - dt);

    // Moving platform: nhận displacement khi đứng trên
    if (grounded && groundRef && groundRef.mover) {
      const m = world.movers.find((mm) => mm.collider === groundRef);
      if (m && m.delta) {
        pos[0] += m.delta[0];
        pos[2] += m.delta[2];
        pos[1] = groundRef.max[1];
      }
    }

    const sprinting = input.sprintHeld && input.sprintAllowed && input.forward > 0 && !sliding;

    /* ----- Slide ----- */
    const hSpeedNow = Math.hypot(vel[0], vel[2]);
    if (!sliding && input.slideHeld && grounded && hSpeedNow > M.slideMinSpeed) {
      sliding = true;
      crouched = true;
      slideT = M.slideTime;
      const len = hSpeedNow || 1;
      slideDir = [vel[0] / len, vel[2] / len];
      vel[0] *= M.slideBoost;
      vel[2] *= M.slideBoost;
      ev.slideStart = true;
    }
    if (sliding) {
      slideT -= dt;
      const wantEnd = slideT <= 0 || (!input.slideHeld && slideT < M.slideTime - 0.15) || hSpeedNow < 2.2;
      if (wantEnd) {
        if (canStand()) {
          sliding = false;
          crouched = false;
          ev.slideEnd = true;
        } else {
          slideT = 0.08; // kẹt dưới trần: giữ crouch đến khi an toàn
        }
      }
    }

    /* ----- Điều khiển ngang ----- */
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    const wishX = -sin * input.forward + cos * input.strafe;
    const wishZ = -cos * input.forward - sin * input.strafe;
    const wishLen = Math.hypot(wishX, wishZ);

    if (wallRun) {
      /* ----- Wall-run ----- */
      wallRun.t += dt;
      const c = wallRun.collider;
      const tRun = wallRun.tangent;
      const speed = Math.max(Math.hypot(vel[0], vel[2]), M.sprint * 1.02);
      vel[0] = tRun[0] * speed;
      vel[2] = tRun[1] * speed;
      vel[1] = Math.max(vel[1] - M.wallRunGravity * dt, -2.6);

      // Áp sát tường
      if (c.axis === "z") pos[0] = (c.face < 0 ? c.min[0] : c.max[0]) + wallRun.normal[0] * M.capsuleR;
      else pos[2] = (c.face < 0 ? c.min[2] : c.max[2]) + wallRun.normal[1] * M.capsuleR;

      // Wall-jump
      if (jumpBufferT > 0) {
        jumpBufferT = 0;
        vel[0] = tRun[0] * speed * 0.92 + wallRun.normal[0] * M.wallJumpOut;
        vel[2] = tRun[1] * speed * 0.92 + wallRun.normal[1] * M.wallJumpOut;
        vel[1] = M.wallJumpUp;
        detachWall(0.3);
        ev.wallJumped = true;
      } else {
        // Hết tường / hết thời gian → rơi
        const along = c.axis === "z" ? pos[2] : pos[0];
        const lo = c.axis === "z" ? c.min[2] : c.min[0];
        const hi = c.axis === "z" ? c.max[2] : c.max[0];
        if (wallRun.t > M.wallRunTime || along < lo - 0.5 || along > hi + 0.5) {
          detachWall();
          ev.wallEnd = true;
        }
      }
    } else {
      /* ----- Chạy / bay thường ----- */
      let target = sprinting ? M.sprint : M.walk;
      if (boostT > 0) target = Math.max(target, M.boostSpeed * (0.55 + 0.45 * (boostT / M.boostTime)));

      if (sliding) {
        // Trượt: momentum + lái rất nhẹ
        const steer = 2.6;
        vel[0] += wishX * steer * dt;
        vel[2] += wishZ * steer * dt;
        const sp = Math.hypot(vel[0], vel[2]);
        const decel = 4.6;
        const nsp = Math.max(0, sp - decel * dt);
        if (sp > 0.01) {
          vel[0] *= nsp / sp;
          vel[2] *= nsp / sp;
        }
      } else if (grounded) {
        const tx = wishLen > 0 ? (wishX / wishLen) * target * Math.min(1, wishLen) : 0;
        const tz = wishLen > 0 ? (wishZ / wishLen) * target * Math.min(1, wishLen) : 0;
        const blend = Math.min(1, M.groundAccel * dt / Math.max(1, target * 0.55));
        vel[0] += (tx - vel[0]) * blend;
        vel[2] += (tz - vel[2]) * blend;
      } else if (wishLen > 0) {
        // Air control: chỉnh hướng có giới hạn, không tăng tốc vô hạn
        const cur = Math.hypot(vel[0], vel[2]);
        const maxAir = Math.max(cur, target);
        vel[0] += (wishX / wishLen) * M.airAccel * dt;
        vel[2] += (wishZ / wishLen) * M.airAccel * dt;
        const sp = Math.hypot(vel[0], vel[2]);
        if (sp > maxAir) {
          vel[0] *= maxAir / sp;
          vel[2] *= maxAir / sp;
        }
      }
    }

    /* ----- Nhảy (coyote + buffer) ----- */
    if (!wallRun && jumpBufferT > 0 && !jumpedSinceGround && (grounded || airTime < M.coyote)) {
      jumpBufferT = 0;
      jumpedSinceGround = true;
      if (sliding) {
        sliding = false;
        crouched = !canStand();
        ev.slideEnd = true;
      }
      vel[1] = Math.sqrt(2 * M.gravity * M.jumpHeight);
      grounded = false;
      groundRef = null;
      ev.jumped = true;
    }

    /* ----- Tích phân ngang + va chạm ----- */
    pos[0] += vel[0] * dt;
    pos[2] += vel[2] * dt;
    world.resolveMove(pos, M.capsuleR, height());

    /* ----- Trọng lực + dọc ----- */
    const prevY = pos[1];
    if (!wallRun) vel[1] -= M.gravity * dt;
    pos[1] += vel[1] * dt;

    let landedNow = false;
    if (vel[1] <= 0) {
      // Đáp xuống mặt platform
      let best = null;
      for (const c of world.colliders) {
        if (c.ceiling) continue;
        if (!overlapXZ(c, M.capsuleR * 0.55)) continue;
        const top = c.max[1];
        if (top <= prevY + 0.001 && top >= pos[1] - 0.001) {
          if (!best || top > best.max[1]) best = c;
        }
      }
      // Đang grounded: bám mặt đất (đi qua platform liền kề / mover hạ xuống)
      if (!best && grounded) {
        for (const c of world.colliders) {
          if (c.ceiling) continue;
          if (!overlapXZ(c, M.capsuleR * 0.55)) continue;
          const top = c.max[1];
          if (Math.abs(top - pos[1]) < 0.14 + Math.abs(vel[1]) * dt * 2) {
            if (!best || top > best.max[1]) best = c;
          }
        }
      }
      if (best) {
        if (!grounded) {
          landedNow = true;
          ev.landed = Math.max(0, -vel[1]);
        }
        pos[1] = best.max[1];
        vel[1] = 0;
        grounded = true;
        groundRef = best;
        jumpedSinceGround = false;
        if (wallRun) {
          detachWall(0.1);
          ev.wallEnd = true;
        }
        lastWall = null;
      } else if (grounded) {
        grounded = false;
        groundRef = null;
        airTime = 0;
      }
    } else {
      // Đập đầu vào trần (tunnel, đáy platform)
      const h = height();
      for (const c of world.colliders) {
        if (!overlapXZ(c, M.capsuleR * 0.8)) continue;
        const bottom = c.min[1];
        if (prevY + h <= bottom + 0.02 && pos[1] + h > bottom) {
          pos[1] = bottom - h;
          vel[1] = 0;
        }
      }
      if (grounded) {
        grounded = false;
        groundRef = null;
        airTime = 0;
      }
    }

    if (!grounded) airTime += dt;
    else airTime = 0;

    // Buffer jump ngay khi chạm đất
    if (landedNow && jumpBufferT > 0 && !sliding) {
      jumpBufferT = 0;
      jumpedSinceGround = true;
      vel[1] = Math.sqrt(2 * M.gravity * M.jumpHeight);
      grounded = false;
      ev.jumped = true;
    }

    // Thử bám tường khi đang bay
    if (!grounded && !wallRun) {
      const hadWall = false;
      tryEngageWall();
      if (wallRun && !hadWall) ev.wallStart = true;
    }

    // Đứng dậy khỏi crouch khi hết slide và có chỗ
    if (crouched && !sliding && canStand()) crouched = false;

    /* ----- Camera ----- */
    const hSpeed = Math.hypot(vel[0], vel[2]);

    if (!motion.reduced && grounded && hSpeed > 0.8 && !sliding) {
      bobPhase += dt * (5.6 + hSpeed * 0.95);
      bobAmp = Math.min(1, bobAmp + dt * 5);
      stepAcc += dt * (hSpeed * 0.5);
      if (stepAcc > 1.65) {
        stepAcc = 0;
        ev.step = true;
      }
    } else {
      bobAmp = Math.max(0, bobAmp - dt * 5);
      stepAcc = 0;
    }

    // Landing dip (spring)
    if (landedNow && !motion.reduced && ev.landed > 4) {
      dipVel -= Math.min(0.9, ev.landed * 0.055);
    }
    dipVel += (-dip * 60 - dipVel * 9) * dt;
    dip += dipVel * dt;

    // Camera roll: wall-run nghiêng khỏi tường + lean nhẹ khi strafe
    let rollTarget = 0;
    if (!motion.reduced) {
      if (wallRun) rollTarget = wallSide() * -0.16;
      else rollTarget = input.strafe * -0.022 + (sliding ? 0.05 : 0);
    }
    rollCur += (rollTarget - rollCur) * Math.min(1, dt * 8);

    shakeT = Math.max(0, shakeT - dt);
    let sx = 0;
    let sy = 0;
    if (shakeT > 0) {
      const k = (shakeT / 0.3) * shakeAmp;
      sx = (Math.random() - 0.5) * 0.055 * k;
      sy = (Math.random() - 0.5) * 0.055 * k;
    }

    const eyeTarget = sliding || crouched ? M.eyeCrouch : M.eyeStand;
    eyeCur += (eyeTarget - eyeCur) * Math.min(1, dt * 12);
    const bobY = motion.reduced ? 0 : Math.sin(bobPhase * 2) * 0.036 * bobAmp;
    const bobX = motion.reduced ? 0 : Math.cos(bobPhase) * 0.02 * bobAmp;

    camera.pos[0] = pos[0] + bobX * cos + sx;
    camera.pos[1] = pos[1] + eyeCur + bobY + dip + sy;
    camera.pos[2] = pos[2] - bobX * sin;
    camera.yaw = yaw;
    camera.pitch = pitch;
    camera.roll = rollCur;

    return {
      ev,
      speed: hSpeed,
      grounded,
      sliding,
      wallRun: wallRun ? wallSide() : 0,
      boosting: boostT > 0,
      fell: pos[1] < M.fallY,
    };
  }

  /** Dự đoán điểm hạ cánh (landing marker) khi đang bay. */
  function predictLanding() {
    if (grounded || wallRun) return null;
    let px = pos[0];
    let py = pos[1];
    let pz = pos[2];
    let vy = vel[1];
    const step = 0.05;
    for (let t = 0; t < 3; t += step) {
      const prevPy = py;
      vy -= M.gravity * step;
      px += vel[0] * step;
      py += vy * step;
      pz += vel[2] * step;
      if (vy <= 0) {
        for (const c of world.colliders) {
          if (c.ceiling) continue;
          if (
            px > c.min[0] - 0.2 && px < c.max[0] + 0.2 &&
            pz > c.min[2] - 0.2 && pz < c.max[2] + 0.2 &&
            c.max[1] <= prevPy && c.max[1] >= py
          ) {
            return [px, c.max[1], pz];
          }
        }
      }
      if (py < M.fallY) return null;
    }
    return null;
  }

  return {
    pos,
    vel,
    reset,
    look,
    queueJump,
    boost,
    shake,
    update,
    predictLanding,
    get yaw() { return yaw; },
    get pitch() { return pitch; },
    get grounded() { return grounded; },
    get sliding() { return sliding; },
    get wallRunning() { return !!wallRun; },
    get airborne() { return !grounded && !wallRun; },
  };
}
