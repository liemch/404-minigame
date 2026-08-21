/**
 * world.js — dựng scene VOID RUNNER 404 theo asset sheet + blueprint:
 *  - Platform đá tối viền neon cyan (đế máy móc phía dưới).
 *  - Tường wall-run nổi với bảng "WALL RUN" + chevron (ảnh gameplay).
 *  - Cổng trượt tròn magenta có bảng "SLIDE".
 *  - Checkpoint vòm lime + diamond, laser đỏ/magenta 2 trụ, energy shard
 *    lime, jump pad chevron cyan, finish portal tím.
 *  - Skyline thành phố cyber phía dưới vực + billboard "404 ARCADE".
 * Xuất: root, colliders, movers, hazards logic (laser/pad/shard/gate/
 * portal), landing marker, resolveMove, update (anim + culling).
 */

import { createNode, addChild, meshNode, hex } from "../strike/engine.js";
import { seededRand, MONO_FONT } from "../../core/utils.js";
import { VR_COLORS } from "./config.js";
import { createCourse } from "./course.js";

const C = VR_COLORS;

/* ============================ Textures ============================ */

function canvas2d(w, h) {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  return [cv, cv.getContext("2d")];
}

function platTexture(engine) {
  const [cv, g] = canvas2d(256, 256);
  const rand = seededRand(4041);
  g.fillStyle = C.slab;
  g.fillRect(0, 0, 256, 256);
  // Panel 4×4 với sắc thái lệch nhẹ + mối ghép tối
  for (let py = 0; py < 4; py++) {
    for (let px = 0; px < 4; px++) {
      const v = rand();
      if (v > 0.55) {
        g.fillStyle = `rgba(210,225,255,${(v - 0.55) * 0.1})`;
        g.fillRect(px * 64, py * 64, 64, 64);
      } else if (v < 0.2) {
        g.fillStyle = "rgba(0,0,0,0.18)";
        g.fillRect(px * 64, py * 64, 64, 64);
      }
    }
  }
  g.strokeStyle = "rgba(0,0,0,0.45)";
  g.lineWidth = 3;
  for (let i = 0; i <= 4; i++) {
    g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, 256); g.stroke();
    g.beginPath(); g.moveTo(0, i * 64); g.lineTo(256, i * 64); g.stroke();
  }
  // Hairline cyan mờ + đinh tán
  g.strokeStyle = "rgba(34,228,255,0.07)";
  g.lineWidth = 1;
  for (let i = 0; i <= 8; i++) {
    g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, 256); g.stroke();
  }
  g.fillStyle = "rgba(0,0,0,0.55)";
  for (let i = 0; i < 14; i++) g.fillRect(8 + rand() * 240, 8 + rand() * 240, 4, 4);
  return engine.makeTexture(cv);
}

function wallRunTexture(engine) {
  const [cv, g] = canvas2d(512, 256);
  g.fillStyle = "#0a1e30";
  g.fillRect(0, 0, 512, 256);
  g.strokeStyle = "rgba(34,228,255,0.9)";
  g.lineWidth = 6;
  g.strokeRect(6, 6, 500, 244);
  g.strokeStyle = "rgba(34,228,255,0.25)";
  g.lineWidth = 2;
  g.strokeRect(20, 20, 472, 216);
  // Chevron trắng-cyan bên trái (hướng chạy)
  g.fillStyle = "rgba(210,248,255,0.92)";
  for (let i = 0; i < 3; i++) {
    const x = 44 + i * 52;
    g.beginPath();
    g.moveTo(x, 74);
    g.lineTo(x + 30, 128);
    g.lineTo(x, 182);
    g.lineTo(x + 18, 182);
    g.lineTo(x + 48, 128);
    g.lineTo(x + 18, 74);
    g.closePath();
    g.fill();
  }
  // Icon người chạy (giữa-trên) + chữ WALL RUN (giữa-dưới) như ảnh
  g.strokeStyle = "#bdf4ff";
  g.lineWidth = 8;
  g.lineCap = "round";
  g.beginPath(); g.arc(342, 58, 13, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.moveTo(338, 74); g.lineTo(354, 100); g.lineTo(342, 128); g.stroke();
  g.beginPath(); g.moveTo(354, 100); g.lineTo(378, 114); g.lineTo(382, 138); g.stroke();
  g.beginPath(); g.moveTo(348, 86); g.lineTo(380, 76); g.stroke();
  g.beginPath(); g.moveTo(348, 90); g.lineTo(322, 108); g.stroke();
  g.font = `800 42px ${MONO_FONT}`;
  g.textAlign = "center";
  g.shadowColor = "#22e4ff";
  g.shadowBlur = 18;
  g.fillStyle = "#c8f6ff";
  g.fillText("WALL RUN", 352, 196);
  g.shadowBlur = 0;
  return engine.makeTexture(cv);
}

function signTexture(engine, text, color, w = 256, h = 64) {
  const [cv, g] = canvas2d(w, h);
  g.fillStyle = "rgba(6,10,24,0.92)";
  g.fillRect(0, 0, w, h);
  g.strokeStyle = color;
  g.lineWidth = 4;
  g.strokeRect(3, 3, w - 6, h - 6);
  g.font = `800 ${Math.floor(h * 0.52)}px ${MONO_FONT}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.shadowColor = color;
  g.shadowBlur = 14;
  g.fillStyle = color;
  g.fillText(text, w / 2, h / 2 + 2);
  g.shadowBlur = 0;
  return engine.makeTexture(cv);
}

function billboardTexture(engine) {
  const [cv, g] = canvas2d(256, 200);
  g.fillStyle = "#120b2e";
  g.fillRect(0, 0, 256, 200);
  g.strokeStyle = "rgba(139,91,255,0.9)";
  g.lineWidth = 5;
  g.strokeRect(5, 5, 246, 190);
  g.textAlign = "center";
  g.font = `800 86px ${MONO_FONT}`;
  g.shadowColor = "#b07bff";
  g.shadowBlur = 26;
  g.fillStyle = "#c9a4ff";
  g.fillText("404", 128, 100);
  g.font = `700 34px ${MONO_FONT}`;
  g.shadowBlur = 14;
  g.fillStyle = "#e42cff";
  g.fillText("ARCADE", 128, 156);
  g.shadowBlur = 0;
  return engine.makeTexture(cv);
}

function windowsTexture(engine, seed) {
  const [cv, g] = canvas2d(128, 256);
  const rand = seededRand(seed);
  g.clearRect(0, 0, 128, 256);
  for (let y = 6; y < 250; y += 12) {
    for (let x = 6; x < 122; x += 10) {
      const v = rand();
      if (v > 0.52) {
        g.fillStyle =
          v > 0.92 ? "rgba(228,44,255,0.95)" :
          v > 0.8 ? "rgba(64,232,255,0.92)" :
          v > 0.68 ? "rgba(200,220,255,0.75)" : "rgba(150,130,255,0.55)";
        g.fillRect(x, y, 5.5, 8);
      }
    }
  }
  return engine.makeTexture(cv);
}

function chevronPadTexture(engine) {
  // Mũi tên chevron boost trên mặt platform (ảnh gameplay giữa)
  const [cv, g] = canvas2d(128, 256);
  g.clearRect(0, 0, 128, 256);
  g.fillStyle = "rgba(120,240,255,0.95)";
  for (let i = 0; i < 4; i++) {
    const y = 210 - i * 56;
    g.beginPath();
    g.moveTo(14, y);
    g.lineTo(64, y - 38);
    g.lineTo(114, y);
    g.lineTo(114, y - 18);
    g.lineTo(64, y - 56);
    g.lineTo(14, y - 18);
    g.closePath();
    g.fill();
  }
  return engine.makeTexture(cv);
}

function markerTexture(engine) {
  // Marker "DỰ KIẾN HẠ CÁNH": ellipse nét đứt + chevron xuống (ảnh gameplay)
  const [cv, g] = canvas2d(256, 256);
  g.clearRect(0, 0, 256, 256);
  g.strokeStyle = "rgba(120,240,255,0.95)";
  g.lineWidth = 5;
  g.setLineDash([16, 11]);
  g.beginPath();
  g.ellipse(128, 118, 112, 66, 0, 0, Math.PI * 2);
  g.stroke();
  g.setLineDash([]);
  g.fillStyle = "rgba(150,245,255,0.95)";
  for (let i = 0; i < 3; i++) {
    const y = 74 + i * 30;
    g.beginPath();
    g.moveTo(94, y);
    g.lineTo(128, y + 22);
    g.lineTo(162, y);
    g.lineTo(162, y + 12);
    g.lineTo(128, y + 34);
    g.lineTo(94, y + 12);
    g.closePath();
    g.fill();
  }
  g.font = `700 22px ${MONO_FONT}`;
  g.textAlign = "center";
  g.shadowColor = "#22e4ff";
  g.shadowBlur = 10;
  g.fillStyle = "#aef2ff";
  g.fillText("DỰ KIẾN HẠ CÁNH", 128, 226);
  g.shadowBlur = 0;
  return engine.makeTexture(cv);
}

function portalGlowTexture(engine) {
  const [cv, g] = canvas2d(128, 128);
  const grad = g.createRadialGradient(64, 64, 6, 64, 64, 62);
  grad.addColorStop(0, "rgba(210,160,255,0.85)");
  grad.addColorStop(0.55, "rgba(139,91,255,0.4)");
  grad.addColorStop(1, "rgba(139,91,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return engine.makeTexture(cv);
}

/* ============================ World ============================ */

export function createWorld(engine) {
  const course = createCourse();
  const root = createNode();
  const colliders = []; // {min,max, wallRun?, face?, axis?, ceiling?}
  const cullables = []; // {node, x, z, r} — ẩn khi xa camera

  const texPlat = platTexture(engine);
  const texWallRun = wallRunTexture(engine);
  const texCheckpoint = signTexture(engine, "CHECKPOINT", "#c8f23e", 320, 64);
  const texSlide = signTexture(engine, "SLIDE", "#ff5ae0", 224, 64);
  const texBillboard = billboardTexture(engine);
  const texWin1 = windowsTexture(engine, 11);
  const texWin2 = windowsTexture(engine, 77);
  const texChevron = chevronPadTexture(engine);
  const texMarker = markerTexture(engine);
  const texPortalGlow = portalGlowTexture(engine);

  const anim = {
    shards: [],      // {node, gem, base, taken}
    gateFlash: [],   // {group, parts, diamond, index, active}
    beams: [],       // laser runtime
    moverList: [],   // {node, collider, data, prev:[x,y,z]}
    portal: null,
    portalBits: [],
    marker: null,
    pads: [],
  };

  const group = (x, y, z, yaw = 0) => {
    const n = createNode({ pos: [x, y, z], rot: [0, yaw, 0] });
    addChild(root, n);
    return n;
  };

  /* ------------------- Platform ------------------- */

  const EDGE_COLOR = { start: C.lime, plaza: C.violet, corner: C.cyan, path: C.cyan, land: C.cyan };

  function buildPlatform(p) {
    const g = group(p.x, 0, p.z);
    // Mặt trên (texture panel) — top tại p.y, dày 0.55
    addChild(g, meshNode("box", {
      pos: [0, p.y - 0.275, 0],
      scale: [p.w, 0.55, p.d],
      color: [1, 1, 1],
      tex: texPlat,
    }));
    // Đế máy móc thụt vào phía dưới
    addChild(g, meshNode("box", {
      pos: [0, p.y - 0.55 - 0.5, 0],
      scale: [p.w * 0.82, 1.0, p.d * 0.82],
      color: hex(C.slabDark),
    }));
    addChild(g, meshNode("box", {
      pos: [0, p.y - 1.55 - 0.35, 0],
      scale: [p.w * 0.5, 0.7, p.d * 0.5],
      color: hex("#0a0e20"),
    }));
    // Viền neon 4 mép trên
    const ec = hex(EDGE_COLOR[p.kind] || C.cyan);
    const t = 0.1;
    const yTop = p.y - 0.02;
    addChild(g, meshNode("box", { pos: [0, yTop, -p.d / 2 + t / 2], scale: [p.w, 0.07, t], color: ec, emissive: 0.95 }));
    addChild(g, meshNode("box", { pos: [0, yTop, p.d / 2 - t / 2], scale: [p.w, 0.07, t], color: ec, emissive: 0.95 }));
    addChild(g, meshNode("box", { pos: [-p.w / 2 + t / 2, yTop, 0], scale: [t, 0.07, p.d], color: ec, emissive: 0.95 }));
    addChild(g, meshNode("box", { pos: [p.w / 2 - t / 2, yTop, 0], scale: [t, 0.07, p.d], color: ec, emissive: 0.95 }));

    colliders.push({
      min: [p.x - p.w / 2, p.y - 3, p.z - p.d / 2],
      max: [p.x + p.w / 2, p.y, p.z + p.d / 2],
    });
    cullables.push({ node: g, x: p.x, z: p.z, r: Math.max(p.w, p.d) / 2 });
  }

  /* ------------------- Tường wall-run ------------------- */

  function buildWall(wd) {
    // axis "z": tường chạy dọc Z, mặt áp là ±X (face)
    const yaw = wd.axis === "z" ? 0 : Math.PI / 2;
    const g = group(wd.x, 0, wd.z, yaw);
    const midY = wd.y + wd.h / 2;
    addChild(g, meshNode("box", {
      pos: [0, midY, 0],
      scale: [0.5, wd.h, wd.len],
      color: [1, 1, 1],
      tex: texPlat,
    }));
    // Viền cyan trên/dưới
    for (const yy of [wd.y + wd.h - 0.05, wd.y + 0.05]) {
      addChild(g, meshNode("box", { pos: [0, yy, 0], scale: [0.56, 0.08, wd.len], color: hex(C.cyan), emissive: 0.9 }));
    }
    // Bảng WALL RUN áp mặt trong (phía người chơi)
    const fx = wd.face * 0.27;
    addChild(g, meshNode("plane", {
      pos: [fx, midY + 0.15, 0],
      rot: [0, wd.face > 0 ? Math.PI / 2 : -Math.PI / 2, 0],
      scale: [Math.min(9, wd.len * 0.55), Math.min(9, wd.len * 0.55) / 2, 1],
      color: [1, 1, 1],
      tex: texWallRun,
      emissive: 1,
    }));

    // Collider (theo world-space, tính lại theo axis)
    let min;
    let max;
    if (wd.axis === "z") {
      min = [wd.x - 0.25, wd.y, wd.z - wd.len / 2];
      max = [wd.x + 0.25, wd.y + wd.h, wd.z + wd.len / 2];
    } else {
      min = [wd.x - wd.len / 2, wd.y, wd.z - 0.25];
      max = [wd.x + wd.len / 2, wd.y + wd.h, wd.z + 0.25];
    }
    colliders.push({ min, max, wallRun: true, axis: wd.axis, face: wd.face });
    cullables.push({ node: g, x: wd.x, z: wd.z, r: wd.len / 2 });
  }

  /* ------------------- Cổng trượt tròn (SLIDE) ------------------- */

  function buildTunnel(td) {
    const yaw = td.axis === "x" ? Math.PI / 2 : 0;
    const g = group(td.x, 0, td.z, yaw);
    const cy = td.y + 0.95;
    // 2 vành tròn magenta (có độ sâu như asset sheet)
    for (const dz of [-0.55, 0.55]) {
      addChild(g, meshNode("ring", {
        pos: [0, cy, dz],
        scale: [3.6, 3.6, 1],
        color: hex(C.magenta),
        emissive: 0.95,
      }));
    }
    // Ống nối 2 vành (trên đỉnh + hai bên)
    addChild(g, meshNode("box", { pos: [0, cy + 1.72, 0], scale: [0.5, 0.24, 1.1], color: hex("#1a1030") }));
    addChild(g, meshNode("box", { pos: [-1.72, cy, 0], scale: [0.24, 0.5, 1.1], color: hex("#1a1030") }));
    addChild(g, meshNode("box", { pos: [1.72, cy, 0], scale: [0.24, 0.5, 1.1], color: hex("#1a1030") }));
    // Bảng SLIDE phía trên + chevron xuống
    addChild(g, meshNode("plane", {
      pos: [0, cy + 2.6, 0],
      scale: [2.4, 0.7, 1],
      color: [1, 1, 1],
      tex: texSlide,
      emissive: 1,
    }));
    addChild(g, meshNode("tri", {
      pos: [0, cy + 1.95, 0],
      scale: [0.55, 0.4, 1],
      color: hex(C.magenta),
      emissive: 1,
    }));

    // Collider trần: ép phải trượt (đầu đứng 1.8 > 1.06, trượt 0.92 lọt)
    let min;
    let max;
    if (td.axis === "x") {
      min = [td.x - 0.8, td.y + 1.06, td.z - 2.5];
      max = [td.x + 0.8, td.y + 3.8, td.z + 2.5];
    } else {
      min = [td.x - 2.5, td.y + 1.06, td.z - 0.8];
      max = [td.x + 2.5, td.y + 3.8, td.z + 0.8];
    }
    colliders.push({ min, max, ceiling: true });
    cullables.push({ node: g, x: td.x, z: td.z, r: 3 });
    return g;
  }

  /* ------------------- Checkpoint gate ------------------- */

  function buildGate(gd) {
    const yaw = gd.axis === "x" ? Math.PI / 2 : 0;
    const g = group(gd.x, gd.y, gd.z, yaw);
    const lime = hex(C.lime);
    const parts = [];
    const part = (geo, opts) => {
      const n = meshNode(geo, opts);
      addChild(g, n);
      parts.push(n);
      return n;
    };
    // 2 cột + 2 vai xiên + thanh ngang (vòm lục giác như asset sheet)
    part("box", { pos: [-2.1, 1.25, 0], scale: [0.3, 2.5, 0.3], color: lime, emissive: 0.85 });
    part("box", { pos: [2.1, 1.25, 0], scale: [0.3, 2.5, 0.3], color: lime, emissive: 0.85 });
    part("box", { pos: [-1.45, 2.85, 0], rot: [0, 0, -0.62], scale: [0.28, 1.7, 0.28], color: lime, emissive: 0.85 });
    part("box", { pos: [1.45, 2.85, 0], rot: [0, 0, 0.62], scale: [0.28, 1.7, 0.28], color: lime, emissive: 0.85 });
    part("box", { pos: [0, 3.42, 0], scale: [1.9, 0.26, 0.26], color: lime, emissive: 0.85 });
    // Chân đế
    part("box", { pos: [-2.1, 0.12, 0], scale: [0.75, 0.24, 0.75], color: hex(C.slabDark) });
    part("box", { pos: [2.1, 0.12, 0], scale: [0.75, 0.24, 0.75], color: hex(C.slabDark) });
    // Diamond trên đỉnh
    const diamond = part("gem", { pos: [0, 4.05, 0], scale: [0.42, 0.62, 0.42], color: lime, emissive: 1 });
    // Bảng CHECKPOINT
    part("plane", { pos: [0, 3.05, 0.02], scale: [2.3, 0.46, 1], color: [1, 1, 1], tex: texCheckpoint, emissive: 1 });
    // Màng sáng mờ bên trong
    const veil = part("plane", {
      pos: [0, 1.55, 0],
      scale: [3.6, 2.7, 1],
      color: lime,
      emissive: 1,
      opacity: 0.1,
      additive: true,
    });

    anim.gateFlash.push({ group: g, parts, diamond, veil, index: gd.index, active: false, flashT: 0, data: gd });
    cullables.push({ node: g, x: gd.x, z: gd.z, r: 4 });
  }

  /* ------------------- Laser ------------------- */

  function buildLaser(ld) {
    const yaw = ld.axis === "x" ? 0 : Math.PI / 2; // beam nằm dọc trục ld.axis
    const g = group(ld.x, 0, ld.z, yaw);
    const half = ld.len / 2;
    // 2 trụ tím (sáng như asset sheet) + sọc neon + đầu phát đỏ
    for (const s of [-1, 1]) {
      addChild(g, meshNode("box", { pos: [s * half, 0.95, 0], scale: [0.3, 2, 0.3], color: hex("#41307a") }));
      addChild(g, meshNode("box", { pos: [s * half, 0.95, 0.165], scale: [0.1, 1.7, 0.03], color: hex(C.violet), emissive: 1 }));
      addChild(g, meshNode("box", { pos: [s * half, 0.95, -0.165], scale: [0.1, 1.7, 0.03], color: hex(C.violet), emissive: 1 }));
      addChild(g, meshNode("box", { pos: [s * half, 1.98, 0], scale: [0.36, 0.14, 0.36], color: hex(C.violet), emissive: 0.9 }));
      addChild(g, meshNode("box", { pos: [s * half, ld.y, 0], scale: [0.24, 0.24, 0.24], color: hex(C.red), emissive: 1 }));
      addChild(g, meshNode("box", { pos: [s * half, 0.08, 0], scale: [0.5, 0.16, 0.5], color: hex(C.slabDark) }));
    }
    const beams = [];
    const mkBeam = (yy) => {
      const glow = meshNode("box", {
        pos: [0, yy, 0],
        scale: [ld.len - 0.2, 0.3, 0.3],
        color: hex(C.red),
        emissive: 1,
        opacity: 0.22,
        additive: true,
      });
      addChild(g, glow);
      const b = meshNode("box", {
        pos: [0, yy, 0],
        scale: [ld.len - 0.2, 0.13, 0.13],
        color: hex(C.red),
        emissive: 1,
        opacity: 0.92,
        additive: true,
      });
      addChild(g, b);
      const core = meshNode("box", {
        pos: [0, yy, 0],
        scale: [ld.len - 0.2, 0.05, 0.05],
        color: hex("#ffe0e6"),
        emissive: 1,
        opacity: 0.95,
        additive: true,
      });
      addChild(g, core);
      beams.push({ beam: b, core, glow, y: yy });
      if (yy > 1.6) {
        addChild(g, meshNode("box", { pos: [0, yy, 0], scale: [0.24, 0.24, 0.24], color: hex(C.red), emissive: 1 }));
      }
    };
    mkBeam(ld.y);
    if (ld.mode === "gate") mkBeam(ld.y + 1.05);

    anim.beams.push({ data: ld, beams, on: true });
    cullables.push({ node: g, x: ld.x, z: ld.z, r: half + 1 });
  }

  /* ------------------- Energy shard ------------------- */

  function buildShard(sd, i) {
    const g = group(sd.x, 0, sd.z);
    const gem = meshNode("gem", {
      pos: [0, sd.y + 0.55, 0],
      scale: [0.42, 0.95, 0.42],
      color: hex(C.lime),
      emissive: 1,
    });
    addChild(g, gem);
    const glow = meshNode("gem", {
      pos: [0, sd.y + 0.55, 0],
      scale: [0.62, 1.3, 0.62],
      color: hex(C.lime),
      emissive: 1,
      opacity: 0.18,
      additive: true,
    });
    addChild(g, glow);
    const ring = meshNode("ring", {
      pos: [0, sd.y - 0.02 - (sd.y > 1 ? 0 : 0), 0],
      rot: [-Math.PI / 2, 0, 0],
      scale: [1.15, 1.15, 1],
      color: hex(C.lime),
      emissive: 0.85,
      opacity: 0.65,
    });
    addChild(g, ring);
    anim.shards.push({ node: g, gem, glow, ring, data: sd, taken: false, idx: i, t: Math.random() * 6 });
    cullables.push({ node: g, x: sd.x, z: sd.z, r: 1.5 });
  }

  /* ------------------- Jump pad ------------------- */

  function buildPad(pd) {
    const yaw = pd.axis === "z" ? (pd.dir > 0 ? Math.PI : 0) : (pd.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    const g = group(pd.x, 0, pd.z, yaw);
    // Nền + chevron phát sáng (như ảnh gameplay)
    addChild(g, meshNode("box", { pos: [0, pd.y + 0.015, 0], scale: [1.7, 0.05, 3.4], color: hex("#0c2030") }));
    const arrow = meshNode("plane", {
      pos: [0, pd.y + 0.05, 0],
      rot: [-Math.PI / 2, 0, 0],
      scale: [1.5, 3.2, 1],
      color: [1, 1, 1],
      tex: texChevron,
      emissive: 1,
      opacity: 0.95,
      additive: true,
    });
    addChild(g, arrow);
    for (const s of [-1, 1]) {
      addChild(g, meshNode("box", { pos: [s * 0.88, pd.y + 0.05, 0], scale: [0.08, 0.09, 3.4], color: hex(C.cyan), emissive: 1 }));
    }
    anim.pads.push({ node: g, arrow, data: pd, t: 0 });
    cullables.push({ node: g, x: pd.x, z: pd.z, r: 2.5 });
  }

  /* ------------------- Finish portal ------------------- */

  function buildPortal(pp) {
    const yaw = pp.axis === "x" ? Math.PI / 2 : 0;
    const g = group(pp.x, pp.y, pp.z, yaw);
    const ringOuter = meshNode("ring", {
      pos: [0, 2.3, 0],
      scale: [4.6, 4.6, 1],
      color: hex(C.violet),
      emissive: 0.95,
    });
    addChild(g, ringOuter);
    const ringInner = meshNode("ring", {
      pos: [0, 2.3, 0.06],
      scale: [3.7, 3.7, 1],
      color: hex(C.magenta),
      emissive: 1,
      opacity: 0.85,
      additive: true,
    });
    addChild(g, ringInner);
    const glow = meshNode("plane", {
      pos: [0, 2.3, 0],
      scale: [3.6, 3.6, 1],
      color: [1, 1, 1],
      tex: texPortalGlow,
      emissive: 1,
      opacity: 0.35,
      additive: true,
    });
    addChild(g, glow);
    // Đế + 2 trụ cyan
    addChild(g, meshNode("cyl", { pos: [0, 0.14, 0], scale: [5.6, 0.28, 5.6], color: hex(C.slabDark) }));
    addChild(g, meshNode("ring", {
      pos: [0, 0.3, 0],
      rot: [-Math.PI / 2, 0, 0],
      scale: [5.2, 5.2, 1],
      color: hex(C.violet),
      emissive: 0.8,
      opacity: 0.6,
    }));
    for (const s of [-1, 1]) {
      addChild(g, meshNode("box", { pos: [s * 2.9, 1.1, 0], scale: [0.4, 2.2, 0.4], color: hex("#151a34") }));
      addChild(g, meshNode("box", { pos: [s * 2.9, 1.1, 0.21], scale: [0.1, 1.8, 0.06], color: hex(C.cyan), emissive: 1 }));
    }
    // Mảnh vuông tím bay quanh vòng (như asset sheet)
    const bits = [];
    for (let i = 0; i < 10; i++) {
      const b = meshNode("box", {
        scale: [0.16, 0.16, 0.05],
        color: hex(i % 3 === 0 ? C.magenta : C.violet),
        emissive: 1,
        opacity: 0.9,
        additive: true,
      });
      addChild(g, b);
      bits.push({ node: b, a: (i / 10) * Math.PI * 2, r: 1.55 + (i % 3) * 0.22, sp: 0.55 + (i % 4) * 0.16 });
    }
    anim.portal = { group: g, ringOuter, ringInner, glow, data: pp, active: false, t: 0 };
    anim.portalBits = bits;
    cullables.push({ node: g, x: pp.x, z: pp.z, r: 5 });
  }

  /* ------------------- Biển chỉ hướng khúc quẹo ------------------- */

  function buildArrow(ad) {
    const g = group(ad.x, 0, ad.z, ad.yaw);
    addChild(g, meshNode("plane", {
      pos: [0, ad.y, 0],
      scale: [1.7, 1.7, 1],
      color: [1, 1, 1],
      tex: texChevron,
      emissive: 1,
      opacity: 0.9,
      additive: true,
    }));
    cullables.push({ node: g, x: ad.x, z: ad.z, r: 1.5 });
  }

  /** Chevron cyan mờ nằm trên mặt track (chỉ hướng chạy — ảnh gameplay). */
  function buildFloorArrow(fa) {
    const g = group(fa.x, 0, fa.z, fa.yaw);
    addChild(g, meshNode("plane", {
      pos: [0, fa.y + 0.04, 0],
      rot: [-Math.PI / 2, 0, 0],
      scale: [1.6, 3.4, 1],
      color: [1, 1, 1],
      tex: texChevron,
      emissive: 1,
      opacity: 0.55,
      additive: true,
    }));
    cullables.push({ node: g, x: fa.x, z: fa.z, r: 2 });
  }

  /* ------------------- Moving platforms ------------------- */

  function buildMover(md) {
    const g = group(md.x, 0, md.z);
    addChild(g, meshNode("box", { pos: [0, md.y - 0.24, 0], scale: [md.w, 0.48, md.d], color: [1, 1, 1], tex: texPlat }));
    addChild(g, meshNode("box", { pos: [0, md.y - 0.68, 0], scale: [md.w * 0.6, 0.4, md.d * 0.6], color: hex("#0a0e20") }));
    const t = 0.09;
    for (const [px, pz, sw, sd2] of [
      [0, -md.d / 2 + t / 2, md.w, t], [0, md.d / 2 - t / 2, md.w, t],
      [-md.w / 2 + t / 2, 0, t, md.d], [md.w / 2 - t / 2, 0, t, md.d],
    ]) {
      addChild(g, meshNode("box", { pos: [px, md.y - 0.01, pz], scale: [sw, 0.07, sd2], color: hex(C.cyan), emissive: 1 }));
    }
    const collider = {
      min: [md.x - md.w / 2, md.y - 0.72, md.z - md.d / 2],
      max: [md.x + md.w / 2, md.y, md.z + md.d / 2],
      mover: true,
    };
    colliders.push(collider);
    anim.moverList.push({ node: g, collider, data: md, prev: [md.x, 0, md.z] });
    cullables.push({ node: g, x: md.x, z: md.z, r: Math.max(md.w, md.d) / 2 + md.amp + 1 });
  }

  /* ------------------- Skyline thành phố dưới vực ------------------- */

  function buildSkyline() {
    const rand = seededRand(40404);
    const spots = [];
    // Vành đai quanh 3 khúc course (hành lang chữ U: x -101..4, z -131..5)
    for (let i = 0; i < 64; i++) {
      const t = rand();
      let x;
      let z;
      if (t < 0.34) { // dọc khúc A
        x = (rand() > 0.5 ? 1 : -1) * (7.5 + rand() * 24);
        z = 8 - rand() * 145;
      } else if (t < 0.62) { // dọc khúc B (phía nam/bắc)
        x = -4 - rand() * 100;
        z = -126.5 + (rand() > 0.5 ? 1 : -1) * (7.5 + rand() * 24);
      } else { // dọc khúc C + vùng giữa chữ U
        x = -95 + (rand() > 0.5 ? 1 : -1) * (7.5 + rand() * 22);
        z = -35 - rand() * 90;
      }
      spots.push([x, z, rand]);
    }
    let billboards = 0;
    let towers = 0;
    for (const [x, z] of spots) {
      const w = 5 + rand() * 8;
      const d = 5 + rand() * 8;
      // Vài tòa "tower" cao vượt mặt track (xa hành lang) như ảnh gameplay
      const distCorridor = Math.min(
        Math.abs(x) < 6 ? 99 : Math.abs(x),
        Math.abs(z + 126.5) < 6 ? 99 : Math.abs(z + 126.5),
        Math.abs(x + 95) < 6 ? 99 : Math.abs(x + 95)
      );
      const tall = towers < 8 && distCorridor > 13 && rand() > 0.62;
      if (tall) towers += 1;
      const top = tall ? 2 + rand() * 7 : -2.5 - rand() * 9;
      const h = tall ? 26 + rand() * 14 : 14 + rand() * 18;
      const g = group(x, 0, z);
      addChild(g, meshNode("box", {
        pos: [0, top - h / 2, 0],
        scale: [w, h, d],
        color: hex(rand() > 0.5 ? "#0c1126" : "#101531"),
      }));
      // Tấm cửa sổ phát sáng 2 mặt hướng course
      const tex = rand() > 0.5 ? texWin1 : texWin2;
      addChild(g, meshNode("plane", {
        pos: [0, top - h / 2, d / 2 + 0.02],
        scale: [w * 0.92, h * 0.92, 1],
        color: [1, 1, 1],
        tex,
        emissive: 1,
        opacity: 0.9,
      }));
      addChild(g, meshNode("plane", {
        pos: [w / 2 + 0.02, top - h / 2, 0],
        rot: [0, Math.PI / 2, 0],
        scale: [d * 0.92, h * 0.92, 1],
        color: [1, 1, 1],
        tex,
        emissive: 1,
        opacity: 0.9,
      }));
      // Viền neon nóc ngẫu nhiên
      if (rand() > 0.4) {
        const nc = rand() > 0.5 ? C.cyan : C.magenta;
        addChild(g, meshNode("box", { pos: [0, top + 0.04, 0], scale: [w + 0.1, 0.09, 0.12], color: hex(nc), emissive: 1 }));
      }
      // Billboard 404 ARCADE trên vài tòa (như ảnh gameplay)
      if (billboards < 3 && rand() > 0.7) {
        addChild(g, meshNode("plane", {
          pos: [w / 2 + 0.06, top + 2.6, 0],
          rot: [0, Math.PI / 2, 0],
          scale: [5, 3.9, 1],
          color: [1, 1, 1],
          tex: texBillboard,
          emissive: 1,
        }));
        addChild(g, meshNode("box", { pos: [w / 2 - 0.4, top + 0.4, 0], scale: [1, 0.8, 0.6], color: hex("#0a0e20") }));
        billboards += 1;
      }
      cullables.push({ node: g, x, z, r: Math.max(w, d) / 2 });
    }
    // Crystal tím lơ lửng (ảnh gameplay có shard tím nổi trên đế)
    for (const [cx, cz] of [[8.5, -46], [-30, -118], [-104.5, -100], [-86, -50]]) {
      const g = group(cx, 0, cz);
      addChild(g, meshNode("box", { pos: [0, -1.5, 0], scale: [1.6, 0.5, 1.6], color: hex(C.slabDark) }));
      const crystal = meshNode("gem", {
        pos: [0, 0.6, 0],
        scale: [0.75, 1.9, 0.75],
        color: hex(C.violet),
        emissive: 1,
      });
      addChild(g, crystal);
      anim.shards.push({ node: g, gem: crystal, glow: null, ring: null, data: null, taken: false, decor: true, t: Math.random() * 6 });
      cullables.push({ node: g, x: cx, z: cz, r: 2 });
    }
  }

  /* ------------------- Landing marker ------------------- */

  const markerNode = meshNode("plane", {
    pos: [0, 0, 0],
    rot: [-Math.PI / 2, 0, 0],
    scale: [3.4, 3.4, 1],
    color: [1, 1, 1],
    tex: texMarker,
    emissive: 1,
    opacity: 0.9,
    additive: true,
  });
  markerNode.visible = false;
  addChild(root, markerNode);
  anim.marker = markerNode;

  /* ------------------- Dựng toàn bộ ------------------- */

  for (const p of course.platforms) buildPlatform(p);
  for (const w of course.walls) buildWall(w);
  for (const t of course.tunnels) buildTunnel(t);
  for (const l of course.lasers) buildLaser(l);
  course.shards.forEach((s, i) => buildShard(s, i));
  for (const gd of course.gates) buildGate(gd);
  for (const pd of course.pads) buildPad(pd);
  for (const m of course.movers) buildMover(m);
  for (const a of course.arrows) buildArrow(a);
  for (const fa of course.floorArrows) buildFloorArrow(fa);
  buildPortal(course.portal);
  buildSkyline();

  /* ==================== Logic runtime ==================== */

  let time = 0;
  let moverTime = 0;
  let laserScale = 1;
  let laserTime = 0;

  function resetRun() {
    moverTime = 0;
    laserTime = 0;
    for (const s of anim.shards) {
      if (s.decor) continue;
      s.taken = false;
      s.node.visible = true;
    }
    for (const gf of anim.gateFlash) {
      gf.active = false;
      gf.flashT = 0;
      for (const p of gf.parts) {
        p.mesh.color = hex(C.lime);
        if (p.mesh.emissive > 0) p.mesh.emissive = 0.85;
      }
      gf.diamond.mesh.color = hex(C.lime);
      gf.veil.mesh.color = hex(C.lime);
    }
    if (anim.portal) {
      anim.portal.active = false;
    }
    syncMovers();
  }

  function resetMoverPhase() {
    moverTime = 0;
    syncMovers();
  }

  function syncMovers() {
    for (const m of anim.moverList) {
      const d = m.data;
      const off = Math.sin((moverTime / d.period) * Math.PI * 2 + d.phase) * d.amp;
      const nx = d.axis === "x" ? d.x + off : d.x;
      const ny = d.axis === "y" ? d.y + off : d.y;
      const nz = d.axis === "z" ? d.z + off : d.z;
      m.node.pos[0] = nx;
      m.node.pos[2] = nz;
      // Trục y dời cả node con: platform mesh đặt theo md.y → dùng offset node y
      m.node.pos[1] = ny - d.y;
      m.collider.min[0] = nx - d.w / 2;
      m.collider.max[0] = nx + d.w / 2;
      m.collider.min[2] = nz - d.d / 2;
      m.collider.max[2] = nz + d.d / 2;
      m.collider.min[1] = ny - 0.72;
      m.collider.max[1] = ny;
    }
  }

  /** Cổng theo thứ tự: chỉ kích hoạt gate index === next. */
  function checkGate(pos, nextIndex) {
    for (const gf of anim.gateFlash) {
      if (gf.active || gf.index !== nextIndex) continue;
      const gd = gf.data;
      const along = gd.axis === "z" ? Math.abs(pos[2] - gd.z) : Math.abs(pos[0] - gd.x);
      const across = gd.axis === "z" ? Math.abs(pos[0] - gd.x) : Math.abs(pos[2] - gd.z);
      if (along < 0.9 && across < 2.4 && pos[1] > gd.y - 1 && pos[1] < gd.y + 3) {
        gf.active = true;
        gf.flashT = 0.6;
        return gf.index;
      }
    }
    return 0;
  }

  function activateGateSilent(index) {
    for (const gf of anim.gateFlash) {
      if (gf.index === index) gf.active = true;
    }
  }

  function setPortalActive(on) {
    if (anim.portal) anim.portal.active = on;
  }

  function checkPortal(pos) {
    if (!anim.portal || !anim.portal.active) return false;
    const pp = anim.portal.data;
    const along = pp.axis === "z" ? Math.abs(pos[2] - pp.z) : Math.abs(pos[0] - pp.x);
    const across = pp.axis === "z" ? Math.abs(pos[0] - pp.x) : Math.abs(pos[2] - pp.z);
    return along < 1 && across < 2.2;
  }

  function checkShards(pos) {
    let got = 0;
    for (const s of anim.shards) {
      if (s.decor || s.taken) continue;
      const d = s.data;
      const dx = pos[0] - d.x;
      const dy = pos[1] + 0.9 - (d.y + 0.55);
      const dz = pos[2] - d.z;
      if (dx * dx + dy * dy + dz * dz < 1.45) {
        s.taken = true;
        s.node.visible = false;
        got += 1;
      }
    }
    return got;
  }

  function checkPad(pos) {
    for (const p of anim.pads) {
      const d = p.data;
      if (Math.abs(pos[0] - d.x) < 1 && Math.abs(pos[2] - d.z) < 1.2 && Math.abs(pos[1] - d.y) < 0.4) {
        return d;
      }
    }
    return null;
  }

  /** Capsule (chân pos, cao h, bán kính r) chạm beam laser đang bật? */
  function checkLaser(pos, h, r) {
    for (const L of anim.beams) {
      if (!L.on) continue;
      const d = L.data;
      for (const b of L.beams) {
        const by = b.y;
        if (by < pos[1] - 0.06 || by > pos[1] + h + 0.06) continue;
        if (d.axis === "x") {
          if (Math.abs(pos[2] - d.z) < r + 0.09 && Math.abs(pos[0] - d.x) < d.len / 2 + r) return true;
        } else if (Math.abs(pos[0] - d.x) < r + 0.09 && Math.abs(pos[2] - d.z) < d.len / 2 + r) {
          return true;
        }
      }
    }
    return false;
  }

  /** Có laser sắp bật rất gần (phát âm cảnh báo)? */
  function laserWarnNear(pos) {
    for (const L of anim.beams) {
      if (!L.warnEdge) continue;
      const d = L.data;
      const dist = Math.abs(pos[0] - d.x) + Math.abs(pos[2] - d.z);
      if (dist < 14) {
        L.warnEdge = false;
        return true;
      }
    }
    return false;
  }

  /* ---- Va chạm ngang: đẩy hình tròn ra khỏi AABB ---- */
  function resolveMove(pos, radius, height) {
    let touchedWall = null;
    for (const c of colliders) {
      if (pos[1] + height <= c.min[1] + 0.02 || pos[1] >= c.max[1] - 0.06) continue;
      const nx = Math.max(c.min[0], Math.min(pos[0], c.max[0]));
      const nz = Math.max(c.min[2], Math.min(pos[2], c.max[2]));
      const dx = pos[0] - nx;
      const dz = pos[2] - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= radius * radius) continue;
      if (d2 > 1e-9) {
        const d = Math.sqrt(d2);
        pos[0] = nx + (dx / d) * radius;
        pos[2] = nz + (dz / d) * radius;
      } else {
        const left = Math.abs(pos[0] - c.min[0]);
        const right = Math.abs(c.max[0] - pos[0]);
        const near = Math.abs(pos[2] - c.min[2]);
        const far = Math.abs(c.max[2] - pos[2]);
        const m = Math.min(left, right, near, far);
        if (m === left) pos[0] = c.min[0] - radius;
        else if (m === right) pos[0] = c.max[0] + radius;
        else if (m === near) pos[2] = c.min[2] - radius;
        else pos[2] = c.max[2] + radius;
      }
      if (c.wallRun) touchedWall = c;
    }
    return touchedWall;
  }

  /* ---- Update mỗi frame ---- */
  let cullT = 0;

  function update(dt, { playing = false, camPos = null } = {}) {
    time += dt;

    // Shards xoay + bob
    for (const s of anim.shards) {
      if (s.taken) continue;
      s.t += dt;
      s.gem.rot[1] += dt * (s.decor ? 0.7 : 1.8);
      const bob = Math.sin(s.t * 2.2) * 0.09;
      if (s.data) {
        s.gem.pos[1] = s.data.y + 0.55 + bob;
        if (s.glow) {
          s.glow.pos[1] = s.gem.pos[1];
          s.glow.rot[1] = s.gem.rot[1];
          s.glow.mesh.opacity = 0.13 + 0.08 * Math.sin(s.t * 3);
        }
        if (s.ring) s.ring.rot[2] += dt * 0.8;
      } else {
        s.gem.pos[1] = 0.6 + bob * 2;
      }
    }

    // Gates: diamond pulse + flash khi kích hoạt
    for (const gf of anim.gateFlash) {
      gf.diamond.rot[1] += dt * 2.2;
      if (gf.flashT > 0) {
        gf.flashT -= dt;
        const k = Math.max(0, gf.flashT / 0.6);
        gf.veil.mesh.opacity = 0.1 + k * 0.5;
        if (gf.flashT <= 0) {
          // Sau khi qua: cổng chuyển cyan mờ (đã kích hoạt)
          const done = hex("#3ba9c2");
          for (const p of gf.parts) {
            if (p.mesh.emissive > 0) {
              p.mesh.color = done;
              p.mesh.emissive = 0.45;
            }
          }
          gf.diamond.mesh.color = done;
          gf.veil.mesh.color = done;
          gf.veil.mesh.opacity = 0.05;
        }
      } else if (!gf.active) {
        gf.veil.mesh.opacity = 0.08 + 0.05 * Math.sin(time * 2.4 + gf.index);
      }
    }

    // Lasers: chu kỳ on/off + telegraph nhấp nháy trước khi bật
    if (playing) laserTime += dt;
    for (const L of anim.beams) {
      const d = L.data;
      const period = d.period * laserScale;
      const onDur = d.on * laserScale * 0.82;
      const phase = ((laserTime + d.offset) % period + period) % period;
      const wasOn = L.on;
      L.on = phase < onDur;
      const warnWin = phase > period - 0.45;
      if (warnWin && !L.warned) {
        L.warned = true;
        L.warnEdge = true;
      } else if (!warnWin) {
        L.warned = false;
      }
      for (const b of L.beams) {
        if (L.on) {
          b.beam.visible = true;
          b.core.visible = true;
          b.glow.visible = true;
          b.beam.mesh.opacity = 0.85 + 0.15 * Math.sin(time * 22);
          b.beam.scale[1] = 0.13;
          b.beam.scale[2] = 0.13;
        } else if (warnWin) {
          // Telegraph: beam mảnh nhấp nháy nhanh
          const blink = Math.sin(time * 34) > 0;
          b.beam.visible = blink;
          b.core.visible = false;
          b.glow.visible = false;
          b.beam.mesh.opacity = 0.35;
          b.beam.scale[1] = 0.05;
          b.beam.scale[2] = 0.05;
        } else {
          b.beam.visible = false;
          b.core.visible = false;
          b.glow.visible = false;
        }
      }
      void wasOn;
    }

    // Movers
    if (playing) {
      moverTime += dt;
      for (const m of anim.moverList) m.prev = [m.node.pos[0], m.collider.max[1], m.node.pos[2]];
      syncMovers();
      for (const m of anim.moverList) {
        m.delta = [
          m.node.pos[0] - m.prev[0],
          m.collider.max[1] - m.prev[1],
          m.node.pos[2] - m.prev[2],
        ];
      }
    }

    // Pads chevron trôi
    for (const p of anim.pads) {
      p.t += dt;
      p.arrow.mesh.opacity = 0.7 + 0.3 * Math.sin(p.t * 5);
    }

    // Portal
    if (anim.portal) {
      const P = anim.portal;
      P.t += dt;
      P.ringInner.rot[2] += dt * (P.active ? 1.6 : 0.35);
      const pulse = P.active ? 0.75 + 0.25 * Math.sin(P.t * 4) : 0.28;
      P.glow.mesh.opacity = pulse * 0.55;
      P.ringInner.mesh.opacity = P.active ? 0.95 : 0.4;
      P.ringOuter.mesh.emissive = P.active ? 1 : 0.55;
      for (const b of anim.portalBits) {
        b.a += dt * b.sp * (P.active ? 2 : 1);
        b.node.pos[0] = Math.cos(b.a) * b.r;
        b.node.pos[1] = 2.3 + Math.sin(b.a) * b.r;
        b.node.pos[2] = Math.sin(b.a * 1.7) * 0.2;
        b.node.rot[2] += dt * 2;
      }
    }

    // Marker pulse
    if (anim.marker.visible) {
      const k = 1 + Math.sin(time * 6) * 0.05;
      anim.marker.scale[0] = 3.4 * k;
      anim.marker.scale[1] = 3.4 * k;
    }

    // Distance culling (mỗi 0.3 s)
    cullT -= dt;
    if (camPos && cullT <= 0) {
      cullT = 0.3;
      const R2 = 135 * 135;
      for (const cu of cullables) {
        const dx = cu.x - camPos[0];
        const dz = cu.z - camPos[2];
        cu.node.visible = dx * dx + dz * dz < R2 + cu.r * cu.r * 4;
      }
    }
  }

  function setMarker(x, y, z) {
    if (x === null) {
      anim.marker.visible = false;
      return;
    }
    anim.marker.visible = true;
    anim.marker.pos[0] = x;
    anim.marker.pos[1] = y + 0.07;
    anim.marker.pos[2] = z;
  }

  return {
    root,
    course,
    colliders,
    movers: anim.moverList,
    resolveMove,
    update,
    resetRun,
    resetMoverPhase,
    checkGate,
    activateGateSilent,
    checkShards,
    checkPad,
    checkLaser,
    laserWarnNear,
    checkPortal,
    setPortalActive,
    setMarker,
    setLaserScale(s) { laserScale = s; },
    shardTotal: course.shards.length,
  };
}
