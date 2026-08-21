/**
 * course.js — dữ liệu tuyến parkour theo Level Blueprint (1 unit = 1 m).
 *
 * Course hình chữ U, 8 zone đúng thứ tự blueprint:
 *   Khúc A (chạy -Z, x=0):    1 XUẤT PHÁT → 2 NHẢY CƠ BẢN → 3 WALL-RUN
 *   Khúc B (chạy -X, z=-126): 4 TRƯỢT → 5 PLATFORM ĐỘNG
 *   Khúc C (chạy +Z, x=-95):  6 LASER → 7 LEAP CUỐI → 8 ĐÍCH
 *
 * Mọi tọa độ y của platform là ĐỘ CAO MẶT TRÊN. Checkpoint 1..7 là cổng
 * vòm lime (asset sheet), checkpoint 8 = finish portal tím.
 */

export function createCourse() {
  // {x,y,z,w,d, kind} — kind: start | path | land | corner | plaza
  const platforms = [];
  // Tường wall-run nổi: {x, y (đáy), z, len, h, axis:"z"|"x", face:1|-1}
  // face = phía người chơi chạm vào (+1: player ở phía dương của trục vuông góc)
  const walls = [];
  // Cổng trượt tròn: {x,y,z, axis} — collider trần ép phải trượt
  const tunnels = [];
  // Platform động: {x,y,z,w,d, axis:"x"|"y"|"z", amp, period, phase}
  const movers = [];
  // Laser: {x,y,z, axis, len, mode:"low"|"mid"|"gate", period, on, offset}
  const lasers = [];
  const shards = []; // {x,y,z}
  const gates = [];  // {x,y,z, axis, index}
  const pads = [];   // {x,y,z, axis, dir} jump pad boost
  const arrows = []; // {x,y,z, yaw} biển chevron chỉ hướng ở khúc quẹo
  // Chevron cyan mờ trên mặt track (chỉ hướng chạy — ảnh gameplay)
  const floorArrows = [
    { x: 0, y: 0, z: -12, yaw: 0 },
    { x: 0, y: 0, z: -22, yaw: 0 },
    { x: -8, y: 0, z: -126.5, yaw: Math.PI / 2 },
    { x: -28, y: 0, z: -126.5, yaw: Math.PI / 2 },
    { x: -95, y: 0, z: -119, yaw: Math.PI },
    { x: -95, y: 0, z: -50, yaw: Math.PI },
  ];

  const plat = (x, y, z, w, d, kind = "path") => platforms.push({ x, y, z, w, d, kind });

  /* ---------------- ZONE 1 — XUẤT PHÁT (z 5 → -31) ---------------- */
  plat(0, 0, 1, 7, 8, "start");
  plat(0, 0, -17, 4.6, 28);
  shards.push({ x: 0, y: 1.1, z: -12 }, { x: 0, y: 1.1, z: -22 });
  gates.push({ x: 0, y: 0, z: -28, axis: "z", index: 1 });

  /* ---------------- ZONE 2 — NHẢY CƠ BẢN (z -31 → -76) ---------------- */
  plat(0, 0, -35, 4, 4);
  plat(0, 0.7, -42, 4, 4);
  plat(1.6, 1.3, -49, 4, 4);
  plat(-1.6, 1.3, -56, 4, 4);
  plat(0, 0.6, -63, 4, 4);
  plat(0, 0, -71.5, 6, 9, "land");
  shards.push(
    { x: 0, y: 1.8, z: -38.5 },
    { x: 1.6, y: 2.4, z: -49 },
    { x: -1.6, y: 2.4, z: -56 },
    { x: 0, y: 2, z: -67 }
  );
  gates.push({ x: 0, y: 0, z: -74, axis: "z", index: 2 });

  /* ---------------- ZONE 3 — WALL-RUN (z -76 → -122) ---------------- */
  // Gap 16 m, tường bên PHẢI hướng chạy (x dương) → player áp mặt -X của tường
  walls.push({ x: 2.9, y: -0.7, z: -84, len: 17, h: 3.8, axis: "z", face: -1 });
  plat(0, 0, -95, 4, 6);
  // Gap 2, tường bên TRÁI → player áp mặt +X
  walls.push({ x: -2.9, y: -0.7, z: -106, len: 17, h: 3.8, axis: "z", face: 1 });
  plat(0, 0, -117.5, 6, 8, "land");
  shards.push({ x: 0.6, y: 1.7, z: -82 }, { x: -0.6, y: 1.7, z: -104 });
  gates.push({ x: 0, y: 0, z: -120, axis: "z", index: 3 });

  // Khúc quẹo A → hướng -X
  plat(0, 0, -126.5, 9, 9, "corner");
  arrows.push({ x: 2.5, y: 1.7, z: -126.5, yaw: Math.PI / 2 });

  /* ---------------- ZONE 4 — TRƯỢT (x -4.5 → -49, z=-126.5) ---------------- */
  plat(-17.5, 0, -126.5, 26, 4.4);
  tunnels.push({ x: -11, y: 0, z: -126.5, axis: "x" });
  tunnels.push({ x: -23, y: 0, z: -126.5, axis: "x" });
  plat(-40.5, 0, -126.5, 14, 4.4);
  tunnels.push({ x: -40, y: 0, z: -126.5, axis: "x" });
  shards.push(
    { x: -11, y: 0.62, z: -126.5 },
    { x: -23, y: 0.62, z: -126.5 },
    { x: -40, y: 0.62, z: -126.5 }
  );
  gates.push({ x: -45.5, y: 0, z: -126.5, axis: "x", index: 4 });

  /* ---------------- ZONE 5 — PLATFORM ĐỘNG (x -49 → -91) ---------------- */
  movers.push({ x: -53.5, y: 0, z: -126.5, w: 3.2, d: 3.2, axis: "z", amp: 4, period: 3.4, phase: 0 });
  movers.push({ x: -61, y: 0.9, z: -126.5, w: 3.2, d: 3.2, axis: "y", amp: 1.1, period: 4.2, phase: 1.2 });
  movers.push({ x: -68.5, y: 0, z: -126.5, w: 3.2, d: 3.2, axis: "z", amp: 4, period: 3.4, phase: Math.PI });
  plat(-75.5, 0, -126.5, 6, 6, "land");
  plat(-84, 0, -126.5, 11, 4.4);
  shards.push(
    { x: -61, y: 2.2, z: -126.5 },
    { x: -75.5, y: 1.1, z: -126.5 },
    { x: -83, y: 1.1, z: -126.5 }
  );
  gates.push({ x: -87.5, y: 0, z: -126.5, axis: "x", index: 5 });

  // Khúc quẹo B → hướng +Z
  plat(-95, 0, -126.5, 9, 9, "corner");
  arrows.push({ x: -95, y: 1.7, z: -124, yaw: Math.PI });

  /* ---------------- ZONE 6 — LASER (z -122 → -88, x=-95) ---------------- */
  plat(-95, 0, -105, 4.4, 34);
  lasers.push({ x: -95, y: 0.55, z: -116, axis: "x", len: 4.4, mode: "low", period: 2.6, on: 1.5, offset: 0 });
  lasers.push({ x: -95, y: 1.35, z: -110, axis: "x", len: 4.4, mode: "mid", period: 2.6, on: 1.5, offset: 0.9 });
  lasers.push({ x: -95, y: 0.55, z: -104, axis: "x", len: 4.4, mode: "low", period: 2.6, on: 1.5, offset: 1.7 });
  lasers.push({ x: -95, y: 0.5, z: -98, axis: "x", len: 4.4, mode: "gate", period: 3, on: 1.35, offset: 0.4 });
  lasers.push({ x: -95, y: 1.35, z: -92.5, axis: "x", len: 4.4, mode: "mid", period: 2.6, on: 1.5, offset: 2.1 });
  shards.push({ x: -95, y: 1.1, z: -113 }, { x: -95, y: 1.1, z: -101 });
  gates.push({ x: -95, y: 0, z: -89.5, axis: "z", index: 6 });

  /* ---------------- ZONE 7 — LEAP CUỐI (z -88 → -55) ---------------- */
  plat(-95, 0, -84, 4.4, 8);
  pads.push({ x: -95, y: 0, z: -82.5, axis: "z", dir: 1 });
  // Gap lớn ~13 m — pad boost + landing marker
  plat(-95, 0, -60, 8, 14, "land");
  shards.push({ x: -95, y: 2.4, z: -76 }, { x: -95, y: 2.8, z: -72 }, { x: -95, y: 2.4, z: -68 });
  gates.push({ x: -95, y: 0, z: -62.5, axis: "z", index: 7 });

  /* ---------------- ZONE 8 — ĐÍCH (z -55 → -38) ---------------- */
  plat(-95, 0, -46.5, 12, 17, "plaza");

  return {
    platforms,
    walls,
    tunnels,
    movers,
    lasers,
    shards,
    gates,
    pads,
    arrows,
    floorArrows,
    portal: { x: -95, y: 0, z: -42.5, axis: "z" },
    spawn: { pos: [0, 0, 1.5], yaw: 0 },
    // Điểm respawn của từng checkpoint (đứng ngay sau cổng, nhìn theo hướng chạy)
    respawns: [
      { pos: [0, 0, 1.5], yaw: 0 },            // chưa qua cổng nào → về start
      { pos: [0, 0, -29.5], yaw: 0 },           // CP1
      { pos: [0, 0.05, -74.5], yaw: 0 },        // CP2
      { pos: [0, 0, -121], yaw: 0 },            // CP3 (trước khúc quẹo A)
      { pos: [-46.5, 0, -126.5], yaw: Math.PI / 2 },  // CP4 (hướng -X)
      { pos: [-88.5, 0, -126.5], yaw: Math.PI / 2 },  // CP5
      { pos: [-95, 0, -89], yaw: Math.PI },      // CP6 (hướng +Z)
      { pos: [-95, 0, -61.5], yaw: Math.PI },    // CP7
    ],
    // Tâm nhìn cho camera idle bay quanh
    overview: { x: -48, y: 0, z: -85 },
  };
}
