/**
 * player.js — điều khiển nhân vật góc nhìn thứ nhất:
 * WASD di chuyển, Shift chạy, Space nhảy, chuột quan sát (yaw/pitch).
 * Trọng lực + va chạm tròn-vs-AABB + đi theo độ cao mặt đất (khu cao,
 * cầu thang). Head-bob nhẹ, tôn trọng prefers-reduced-motion.
 */

import { clamp } from "../../core/utils.js";

const EYE = 1.66;
const RADIUS = 0.45;
const WALK = 4.4;
const RUN = 6.6;
const ACCEL = 26;
const GRAVITY = 18;
const JUMP_V = 6.2;

export function createPlayer(world, camera, { reducedMotion = false } = {}) {
  const pos = [0, 0, 16.5]; // chân nhân vật
  let yaw = 0;
  let pitch = 0;
  let vy = 0;
  let vx = 0;
  let vz = 0;
  let onGround = true;
  let jumpQueued = false;
  let bobPhase = 0;
  let bobAmp = 0;
  let recoilPitch = 0; // giật súng cộng vào pitch, tự hồi
  let shakeT = 0;
  let shakeAmp = 0;
  let hp = 100;

  function reset(spawn) {
    pos[0] = spawn.pos[0];
    pos[1] = world.groundHeightAt(spawn.pos[0], spawn.pos[2]);
    pos[2] = spawn.pos[2];
    yaw = spawn.yaw;
    pitch = 0;
    vx = vz = vy = 0;
    onGround = true;
    hp = 100;
    recoilPitch = 0;
    shakeT = 0;
  }

  /** Chuột: dx/dy pixel × độ nhạy. */
  function look(dx, dy, sensitivity) {
    const k = 0.0021 * sensitivity;
    yaw -= dx * k;
    pitch = clamp(pitch - dy * k, -1.45, 1.45);
  }

  function queueJump() {
    jumpQueued = true;
  }

  function addRecoil(amount) {
    recoilPitch += amount;
  }

  function shake(amp = 0.5) {
    if (reducedMotion) return;
    shakeT = 0.28;
    shakeAmp = amp;
  }

  function update(dt, input) {
    // input: { forward: -1..1, strafe: -1..1, run: bool }
    const speedMax = input.run && input.forward > 0 ? RUN : WALK;

    // Hướng di chuyển theo yaw (yaw 0 → -Z)
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    const wishX = (-sin * input.forward + cos * input.strafe);
    const wishZ = (-cos * input.forward - sin * input.strafe);
    const wishLen = Math.hypot(wishX, wishZ) || 1;
    const targetVx = (wishX / wishLen) * speedMax * Math.min(1, Math.hypot(input.forward, input.strafe));
    const targetVz = (wishZ / wishLen) * speedMax * Math.min(1, Math.hypot(input.forward, input.strafe));

    const blend = Math.min(1, ACCEL * dt);
    vx += (targetVx - vx) * blend;
    vz += (targetVz - vz) * blend;

    pos[0] += vx * dt;
    pos[2] += vz * dt;
    world.resolveMove(pos, RADIUS, 1.8);

    // Trọng lực + mặt đất (bục cao, dốc cầu thang)
    const ground = world.groundHeightAt(pos[0], pos[2]);
    vy -= GRAVITY * dt;
    pos[1] += vy * dt;
    if (pos[1] <= ground) {
      pos[1] = ground;
      vy = 0;
      onGround = true;
    } else if (pos[1] - ground > 0.02) {
      onGround = false;
    }

    if (jumpQueued) {
      jumpQueued = false;
      if (onGround) {
        vy = JUMP_V;
        onGround = false;
      }
    }

    // Head-bob khi di chuyển trên mặt đất
    const moveSpeed = Math.hypot(vx, vz);
    if (!reducedMotion && onGround && moveSpeed > 0.6) {
      bobPhase += dt * (6 + moveSpeed * 1.3);
      bobAmp = Math.min(1, bobAmp + dt * 6);
    } else {
      bobAmp = Math.max(0, bobAmp - dt * 5);
    }

    // Giật súng hồi dần + rung màn hình
    recoilPitch = Math.max(0, recoilPitch - dt * 2.6);
    shakeT = Math.max(0, shakeT - dt);

    // Cập nhật camera
    const bobY = Math.sin(bobPhase * 2) * 0.038 * bobAmp;
    let sx = 0;
    let sy = 0;
    if (shakeT > 0) {
      const k = (shakeT / 0.28) * shakeAmp;
      sx = (Math.random() - 0.5) * 0.05 * k;
      sy = (Math.random() - 0.5) * 0.05 * k;
    }
    camera.pos[0] = pos[0] + sx;
    camera.pos[1] = pos[1] + EYE + bobY + sy;
    camera.pos[2] = pos[2];
    camera.yaw = yaw;
    camera.pitch = pitch + recoilPitch;

    return { moveSpeed, onGround };
  }

  return {
    pos,
    reset,
    look,
    queueJump,
    update,
    addRecoil,
    shake,
    get yaw() { return yaw; },
    get pitch() { return pitch; },
    get hp() { return hp; },
    set hp(v) { hp = clamp(v, 0, 100); },
    eye() {
      return [camera.pos[0], camera.pos[1], camera.pos[2]];
    },
  };
}
