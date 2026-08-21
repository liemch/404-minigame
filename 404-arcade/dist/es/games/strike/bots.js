/**
 * bots.js — bot địch của 404 Strike.
 *
 * Tạo hình theo Asset Sheet: robot 1.8m giáp tối, visor tam giác đỏ
 * phát sáng, sọc ngực tím, marker cảnh báo đỏ lơ lửng trên đầu.
 * State machine (theo plan): SPAWN → PATROL → CHASE → ATTACK → DEAD.
 * Tuần tra theo vòng waypoint của Level Map; đuổi khi thấy người chơi
 * (khoảng cách + góc nhìn + line-of-sight); tấn công theo loạt 3 viên
 * có telegraph (visor lóe sáng). Hitbox đầu/thân tách riêng (headshot).
 * Object pooling — không dựng lại model khi respawn.
 */

import { createNode, addChild, meshNode, hex, rayAABB } from "./engine.js";
import { clamp, randRange } from "../../core/utils.js";

const MAX_BOTS = 10;

export const DIFFICULTY = {
  easy:   { hp: 45, patrol: 2.0, chase: 3.1, dmg: [3, 6],  hitBase: 0.32, burstCd: 2.0 },
  normal: { hp: 60, patrol: 2.2, chase: 3.8, dmg: [5, 9],  hitBase: 0.46, burstCd: 1.5 },
  hard:   { hp: 85, patrol: 2.5, chase: 4.5, dmg: [7, 11], hitBase: 0.6,  burstCd: 1.1 },
};

/* Hitbox local (bot đứng ở gốc, hướng +Z) */
const HEAD_BOX = { min: [-0.18, 1.42, -0.18], max: [0.18, 1.8, 0.18] };
const BODY_BOX = { min: [-0.42, 0, -0.28], max: [0.42, 1.42, 0.28] };

const DETECT_DIST = 20;
const ATTACK_DIST = 14.5;
const CHASE_GIVEUP_LOS = 1.6; // giây mất dấu thì quay lại đuổi theo vị trí cũ

export function createBots(sceneRoot, world, audio, fx, { onPlayerHit, onKilled, reducedMotion } = {}) {
  const slots = [];

  /* ---------- Dựng model bot (1 lần / slot) ---------- */

  function collectParts(node, list) {
    if (node.mesh) {
      list.push({ node, baseEmissive: node.mesh.emissive || 0 });
    }
    for (const c of node.children) collectParts(c, list);
  }

  function buildBot() {
    const DARK_A = "#161c3a";
    const DARK_B = "#10142c";

    const root = createNode();
    root.visible = false;

    // Bóng đổ blob
    const blob = meshNode("plane", {
      pos: [0, 0.02, 0],
      rot: [-Math.PI / 2, 0, 0],
      scale: [1.5, 1.5, 1],
      color: [1, 1, 1],
      opacity: 0.75,
      tex: world.texBlob,
    });
    addChild(root, blob);

    // Toàn bộ thân (để scale khi spawn / đổ khi chết)
    const trunk = createNode();
    addChild(root, trunk);

    const legL = addChild(trunk, meshNode("box", { pos: [-0.17, 0.31, 0], scale: [0.24, 0.62, 0.28], color: hex(DARK_B) }));
    const legR = addChild(trunk, meshNode("box", { pos: [0.17, 0.31, 0], scale: [0.24, 0.62, 0.28], color: hex(DARK_B) }));
    addChild(trunk, meshNode("box", { pos: [0, 0.72, 0], scale: [0.56, 0.22, 0.36], color: hex(DARK_A) }));
    addChild(trunk, meshNode("box", { pos: [0, 1.09, 0], scale: [0.7, 0.55, 0.44], color: hex(DARK_A) }));
    // Sọc ngực tím + đèn bụng
    addChild(trunk, meshNode("box", { pos: [0, 1.13, 0.225], scale: [0.4, 0.08, 0.02], color: hex("#9a5cff"), emissive: 1 }));
    addChild(trunk, meshNode("box", { pos: [0, 0.9, 0.19], scale: [0.1, 0.06, 0.02], color: hex("#20e3ff"), emissive: 0.8 }));
    // Vai
    addChild(trunk, meshNode("box", { pos: [-0.5, 1.32, 0], scale: [0.26, 0.2, 0.32], color: hex(DARK_B) }));
    addChild(trunk, meshNode("box", { pos: [0.5, 1.32, 0], scale: [0.26, 0.2, 0.32], color: hex(DARK_B) }));
    const armL = addChild(trunk, meshNode("box", { pos: [-0.5, 1.0, 0.06], scale: [0.16, 0.46, 0.2], color: hex(DARK_A) }));
    const armR = addChild(trunk, meshNode("box", { pos: [0.5, 1.0, 0.06], scale: [0.16, 0.46, 0.2], color: hex(DARK_A) }));
    // Súng cầm tay phải, chĩa về +Z
    addChild(trunk, meshNode("box", { pos: [0.34, 1.02, 0.32], scale: [0.12, 0.13, 0.5], color: hex(DARK_B) }));
    const gunTip = addChild(trunk, meshNode("box", { pos: [0.34, 1.04, 0.6], scale: [0.06, 0.06, 0.06], color: hex("#ff4fd8"), emissive: 1 }));
    // Đầu + visor tam giác đỏ (asset sheet) + dải cyan
    addChild(trunk, meshNode("box", { pos: [0, 1.62, 0], scale: [0.34, 0.32, 0.34], color: hex(DARK_A) }));
    const visor = addChild(trunk, meshNode("tri", { pos: [0, 1.62, 0.18], scale: [0.2, 0.17, 1], color: hex("#ff4f64"), emissive: 1 }));
    addChild(trunk, meshNode("box", { pos: [0, 1.75, 0.17], scale: [0.3, 0.03, 0.02], color: hex("#20e3ff"), emissive: 0.8 }));

    // Marker cảnh báo đỏ trên đầu (billboard)
    const marker = addChild(root, meshNode("tri", { pos: [0, 2.32, 0], scale: [0.5, 0.5, 1], color: hex("#ff4f64"), emissive: 1, opacity: 0.9 }));

    const parts = [];
    collectParts(trunk, parts);

    addChild(sceneRoot, root);

    return {
      root, trunk, marker, legL, legR, armL, armR, gunTip, visor, parts, blob,
      alive: false, state: "FREE",
      hp: 0, diff: DIFFICULTY.normal,
      waypoints: [], wpIdx: 0,
      yaw: 0, legPhase: 0,
      losTimer: 0, hasLos: false, loseLos: 0,
      telegraphT: 0, burstLeft: 0, burstTimer: 0, fireCd: 0,
      spawnT: 0, deadT: 0, flashT: 0,
    };
  }

  function getFreeSlot() {
    for (const s of slots) if (s.state === "FREE") return s;
    if (slots.length < MAX_BOTS) {
      const s = buildBot();
      slots.push(s);
      return s;
    }
    return null;
  }

  /* ---------- Tiện ích ---------- */

  const pos = (bot) => bot.root.pos;

  function setOpacity(bot, k) {
    for (const p of bot.parts) p.node.mesh.opacity = k;
    bot.blob.mesh.opacity = 0.75 * k;
  }

  function nearestWpIndex(bot) {
    let best = 0;
    let bd = Infinity;
    bot.waypoints.forEach(([x, z], i) => {
      const d = (pos(bot)[0] - x) ** 2 + (pos(bot)[2] - z) ** 2;
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }

  /** Kiểm tra đường nhìn từ bot tới điểm target (chặn bởi collider tĩnh). */
  function hasLineOfSight(bot, target) {
    const o = [pos(bot)[0], pos(bot)[1] + 1.55, pos(bot)[2]];
    const dx = target[0] - o[0];
    const dy = target[1] - o[1];
    const dz = target[2] - o[2];
    const dist = Math.hypot(dx, dy, dz);
    if (dist < 0.5) return true;
    const dir = [dx / dist, dy / dist, dz / dist];
    for (const c of world.colliders) {
      const t = rayAABB(o, dir, c);
      if (t !== null && t < dist - 0.5) return false;
    }
    return true;
  }

  /** Di chuyển có né vật cản: thử hướng thẳng rồi xoay dần hai bên. */
  function steer(bot, tx, tz, speed, dt) {
    const px = pos(bot)[0];
    const pz = pos(bot)[2];
    const dx = tx - px;
    const dz = tz - pz;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.05) return;
    const baseAngle = Math.atan2(dx, dz);

    let moveAngle = baseAngle;
    const probeOrigin = [px, pos(bot)[1] + 0.8, pz];
    for (const offset of [0, 0.7, -0.7, 1.3, -1.3]) {
      const a = baseAngle + offset;
      const dir = [Math.sin(a), 0, Math.cos(a)];
      let blocked = false;
      for (const c of world.colliders) {
        const t = rayAABB(probeOrigin, dir, c);
        if (t !== null && t < 1.4) { blocked = true; break; }
      }
      if (!blocked) { moveAngle = a; break; }
    }

    pos(bot)[0] += Math.sin(moveAngle) * speed * dt;
    pos(bot)[2] += Math.cos(moveAngle) * speed * dt;

    // Tách các bot khỏi nhau
    for (const other of slots) {
      if (other === bot || !other.alive) continue;
      const ox = pos(bot)[0] - pos(other)[0];
      const oz = pos(bot)[2] - pos(other)[2];
      const d2 = ox * ox + oz * oz;
      if (d2 > 0 && d2 < 1.3) {
        const d = Math.sqrt(d2);
        pos(bot)[0] += (ox / d) * 0.8 * dt;
        pos(bot)[2] += (oz / d) * 0.8 * dt;
      }
    }

    world.resolveMove(pos(bot), 0.55, 1.8);
    pos(bot)[1] = world.groundHeightAt(pos(bot)[0], pos(bot)[2]);

    // Xoay mượt về hướng di chuyển
    let da = moveAngle - bot.yaw;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    bot.yaw += da * Math.min(1, dt * 8);
    bot.root.rot[1] = bot.yaw;

    bot.legPhase += dt * speed * 2.6;
  }

  function faceTarget(bot, tx, tz, dt) {
    const a = Math.atan2(tx - pos(bot)[0], tz - pos(bot)[2]);
    let da = a - bot.yaw;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    bot.yaw += da * Math.min(1, dt * 10);
    bot.root.rot[1] = bot.yaw;
  }

  function gunTipWorld(bot) {
    const cy = Math.cos(bot.yaw);
    const sy = Math.sin(bot.yaw);
    const lx = 0.34;
    const ly = 1.04;
    const lz = 0.6;
    return [
      pos(bot)[0] + lx * cy + lz * sy,
      pos(bot)[1] + ly,
      pos(bot)[2] - lx * sy + lz * cy,
    ];
  }

  /* ---------- Public: spawn / sát thương / raycast ---------- */

  function spawn(gate, diffKey, loopOverride = null) {
    const bot = getFreeSlot();
    if (!bot) return null;
    bot.diff = DIFFICULTY[diffKey] || DIFFICULTY.normal;
    bot.hp = bot.diff.hp;
    bot.state = "SPAWN";
    bot.alive = true;
    bot.spawnT = 0.55;
    bot.flashT = 0;
    bot.deadT = 0;
    bot.fireCd = randRange(0.4, 1.2);
    bot.waypoints = world.patrols[loopOverride || gate.loop] || world.patrols.court;
    pos(bot)[0] = gate.pos[0];
    pos(bot)[1] = 0;
    pos(bot)[2] = gate.pos[2];
    bot.yaw = gate.side < 0 ? Math.PI / 2 : -Math.PI / 2; // quay vào arena
    bot.root.rot[1] = bot.yaw;
    bot.wpIdx = nearestWpIndex(bot);
    bot.trunk.rot[0] = 0;
    bot.trunk.pos[1] = 0;
    bot.trunk.scale[1] = 0.05;
    bot.marker.visible = true;
    setOpacity(bot, 1);
    bot.root.visible = true;
    fx.burst(gate.pos, "#ff4fd8", 8);
    return bot;
  }

  function damage(bot, amount, isHead) {
    if (!bot.alive || bot.state === "DEAD") return false;
    bot.hp -= amount;
    bot.flashT = 0.12;
    if (bot.hp <= 0) {
      bot.state = "DEAD";
      bot.deadT = 1.3;
      bot.marker.visible = false;
      audio.play("kill");
      fx.burst([pos(bot)[0], pos(bot)[1] + 1.1, pos(bot)[2]], isHead ? "#ffd23f" : "#9a5cff", 14);
      onKilled?.(bot, isHead);
      return true;
    }
    // Trúng đạn → lập tức đuổi người chơi
    if (bot.state === "PATROL") bot.state = "CHASE";
    return false;
  }

  /** Ray từ súng người chơi → bot gần nhất bị trúng. */
  function raycast(origin, dir) {
    let best = null;
    for (const bot of slots) {
      if (!bot.alive || bot.state === "DEAD" || bot.state === "SPAWN") continue;
      const cy = Math.cos(-bot.yaw);
      const sy = Math.sin(-bot.yaw);
      const ox = origin[0] - pos(bot)[0];
      const oz = origin[2] - pos(bot)[2];
      const lo = [ox * cy + oz * sy, origin[1] - pos(bot)[1], -ox * sy + oz * cy];
      const ld = [dir[0] * cy + dir[2] * sy, dir[1], -dir[0] * sy + dir[2] * cy];

      const tHead = rayAABB(lo, ld, HEAD_BOX);
      const tBody = rayAABB(lo, ld, BODY_BOX);
      let t = null;
      let isHead = false;
      if (tHead !== null && (tBody === null || tHead <= tBody)) { t = tHead; isHead = true; }
      else if (tBody !== null) t = tBody;
      if (t !== null && (!best || t < best.t)) best = { bot, t, isHead };
    }
    return best;
  }

  /** Người chơi nổ súng → bot trong bán kính nghe thấy và lao tới. */
  function aggro(center, radius = 26) {
    for (const bot of slots) {
      if (!bot.alive || bot.state !== "PATROL") continue;
      const d = Math.hypot(pos(bot)[0] - center[0], pos(bot)[2] - center[2]);
      if (d < radius) bot.state = "CHASE";
    }
  }

  function aliveCount() {
    let n = 0;
    for (const bot of slots) if (bot.alive) n++;
    return n;
  }

  function clearAll() {
    for (const bot of slots) {
      bot.alive = false;
      bot.state = "FREE";
      bot.root.visible = false;
    }
  }

  /* ---------- Update chính ---------- */

  function update(dt, player, camYawPitch) {
    // player: null (màn hình chờ) hoặc { eye:[x,y,z], pos:[x,y,z], speed }
    for (const bot of slots) {
      if (!bot.alive) continue;

      // Marker billboard quay về phía camera
      if (bot.marker.visible && camYawPitch) {
        const facing = Math.atan2(camYawPitch.camX - pos(bot)[0], camYawPitch.camZ - pos(bot)[2]);
        bot.marker.rot[1] = facing - bot.yaw;
        const pulse = 0.8 + 0.2 * Math.sin(performance.now() / 130);
        bot.marker.scale[0] = 0.5 * pulse;
        bot.marker.scale[1] = 0.5 * pulse;
      }

      // Flash trắng khi trúng đạn
      if (bot.flashT > 0) {
        bot.flashT -= dt;
        const k = bot.flashT > 0 ? 1 : 0;
        for (const p of bot.parts) p.node.mesh.emissive = clamp(p.baseEmissive + k * 0.85, 0, 1);
      }

      switch (bot.state) {
        case "SPAWN": {
          bot.spawnT -= dt;
          const k = 1 - Math.max(0, bot.spawnT) / 0.55;
          bot.trunk.scale[1] = 0.05 + 0.95 * k;
          if (bot.spawnT <= 0) {
            bot.trunk.scale[1] = 1;
            bot.state = "PATROL";
          }
          break;
        }

        case "PATROL": {
          const [wx, wz] = bot.waypoints[bot.wpIdx];
          steer(bot, wx, wz, bot.diff.patrol, dt);
          if (Math.hypot(pos(bot)[0] - wx, pos(bot)[2] - wz) < 1.1) {
            bot.wpIdx = (bot.wpIdx + 1) % bot.waypoints.length;
          }
          // Phát hiện người chơi: khoảng cách + góc nhìn + LOS
          if (player) {
            const d = Math.hypot(player.pos[0] - pos(bot)[0], player.pos[2] - pos(bot)[2]);
            if (d < DETECT_DIST) {
              const angTo = Math.atan2(player.pos[0] - pos(bot)[0], player.pos[2] - pos(bot)[2]);
              let da = angTo - bot.yaw;
              while (da > Math.PI) da -= Math.PI * 2;
              while (da < -Math.PI) da += Math.PI * 2;
              bot.losTimer -= dt;
              if (Math.abs(da) < 1.25 && bot.losTimer <= 0) {
                bot.losTimer = 0.2;
                if (hasLineOfSight(bot, player.eye)) bot.state = "CHASE";
              }
            }
          }
          break;
        }

        case "CHASE": {
          if (!player) { bot.state = "PATROL"; break; }
          const d = Math.hypot(player.pos[0] - pos(bot)[0], player.pos[2] - pos(bot)[2]);
          steer(bot, player.pos[0], player.pos[2], bot.diff.chase, dt);
          bot.losTimer -= dt;
          if (bot.losTimer <= 0) {
            bot.losTimer = 0.18;
            bot.hasLos = hasLineOfSight(bot, player.eye);
          }
          if (d < ATTACK_DIST && bot.hasLos) {
            bot.state = "ATTACK";
            bot.telegraphT = 0.35;
            bot.loseLos = 0;
          }
          break;
        }

        case "ATTACK": {
          if (!player) { bot.state = "PATROL"; break; }
          const d = Math.hypot(player.pos[0] - pos(bot)[0], player.pos[2] - pos(bot)[2]);
          faceTarget(bot, player.pos[0], player.pos[2], dt);

          bot.losTimer -= dt;
          if (bot.losTimer <= 0) {
            bot.losTimer = 0.18;
            bot.hasLos = hasLineOfSight(bot, player.eye);
          }
          if (!bot.hasLos || d > ATTACK_DIST + 3.5) {
            bot.loseLos += dt;
            if (bot.loseLos > CHASE_GIVEUP_LOS) { bot.state = "CHASE"; break; }
          } else {
            bot.loseLos = 0;
          }

          // Telegraph: visor lóe sáng trước khi bắn (người chơi kịp né)
          if (bot.telegraphT > 0) {
            bot.telegraphT -= dt;
            const blink = Math.sin(performance.now() / 40) > 0 ? 1 : 0.4;
            bot.visor.mesh.emissive = blink;
            bot.visor.scale[0] = 0.2 + 0.06 * blink;
            if (bot.telegraphT <= 0) {
              bot.burstLeft = 3;
              bot.burstTimer = 0;
              bot.visor.scale[0] = 0.2;
            }
          } else if (bot.burstLeft > 0) {
            bot.burstTimer -= dt;
            if (bot.burstTimer <= 0) {
              bot.burstTimer = 0.1;
              bot.burstLeft -= 1;
              fireAtPlayer(bot, player, d);
            }
          } else {
            bot.fireCd -= dt;
            if (bot.fireCd <= 0) {
              bot.fireCd = bot.diff.burstCd * randRange(0.85, 1.2);
              bot.telegraphT = 0.35;
            }
          }
          break;
        }

        case "DEAD": {
          bot.deadT -= dt;
          const k = clamp(1 - bot.deadT / 1.3, 0, 1);
          // Đổ ngửa rồi tan biến
          bot.trunk.rot[0] = (-Math.PI / 2) * Math.min(1, k * 2.4);
          if (k > 0.45) setOpacity(bot, clamp(1 - (k - 0.45) / 0.5, 0, 1));
          if (bot.deadT <= 0) {
            bot.alive = false;
            bot.state = "FREE";
            bot.root.visible = false;
          }
          break;
        }
      }

      // Animation chân/tay theo trạng thái di chuyển
      if (bot.state === "PATROL" || bot.state === "CHASE") {
        const swing = Math.sin(bot.legPhase) * (bot.state === "CHASE" ? 0.72 : 0.45);
        bot.legL.rot[0] = swing;
        bot.legR.rot[0] = -swing;
        bot.armL.rot[0] = -swing * 0.7;
        bot.armR.rot[0] = swing * 0.7;
      } else if (bot.state === "ATTACK") {
        bot.legL.rot[0] = 0;
        bot.legR.rot[0] = 0;
        bot.armR.rot[0] = -0.5; // giơ súng
        bot.armL.rot[0] = -0.25;
      }
    }
  }

  function fireAtPlayer(bot, player, dist) {
    audio.play("botshot");
    const tip = gunTipWorld(bot);
    // Xác suất trúng giảm theo khoảng cách và khi người chơi di chuyển nhanh
    const distFactor = clamp(1.15 - dist / 22, 0.35, 1);
    const moveFactor = player.speed > 3 ? 0.72 : 1;
    const chance = bot.diff.hitBase * distFactor * moveFactor;

    if (Math.random() < chance) {
      const target = [
        player.eye[0] + randRange(-0.1, 0.1),
        player.eye[1] + randRange(-0.15, 0.05),
        player.eye[2] + randRange(-0.1, 0.1),
      ];
      fx.tracer(tip, target, "#ff7d8a");
      const dmg = Math.round(randRange(bot.diff.dmg[0], bot.diff.dmg[1]));
      onPlayerHit?.(dmg, pos(bot));
    } else {
      // Bắn trượt: đạn sượt qua bên cạnh
      const target = [
        player.eye[0] + randRange(-1.6, 1.6),
        player.eye[1] + randRange(-0.9, 0.7),
        player.eye[2] + randRange(-1.6, 1.6),
      ];
      fx.tracer(tip, target, "#ff7d8a");
    }
  }

  return { spawn, damage, raycast, aggro, aliveCount, clearAll, update, slots };
}
