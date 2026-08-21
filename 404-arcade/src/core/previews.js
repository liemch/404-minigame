/**
 * previews.js — vẽ tranh minh họa tĩnh cho card game bằng Canvas.
 * Tách riêng khỏi module game để card không phải tải game (lazy-load).
 * Dùng seededRand để hình vẽ ổn định giữa các lần tải trang.
 */

import { seededRand } from "./utils.js";

const W = 320;
const H = 200;

function setup(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  return ctx;
}

function stars(ctx, rand, count, maxY = H) {
  for (let i = 0; i < count; i++) {
    const x = rand() * W;
    const y = rand() * maxY;
    const r = rand() * 1.2 + 0.4;
    ctx.fillStyle = rand() > 0.75 ? "rgba(59,232,255,.8)" : "rgba(237,241,255,.7)";
    ctx.fillRect(x, y, r, r);
  }
}

/* ---------- Endless Runner: thành phố neon về đêm ---------- */
function runnerArt(ctx) {
  const rand = seededRand(41);
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#241150");
  sky.addColorStop(0.62, "#171040");
  sky.addColorStop(1, "#0d0b28");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  stars(ctx, rand, 26, 110);

  // Mặt trời synthwave có sọc
  const sunX = 236;
  const sunY = 74;
  const sunR = 34;
  const sun = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
  sun.addColorStop(0, "#ffd23f");
  sun.addColorStop(1, "#ff58c7");
  ctx.save();
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = sun;
  ctx.fillRect(sunX - sunR, sunY - sunR, sunR * 2, sunR * 2);
  ctx.fillStyle = "#171040";
  for (let i = 0; i < 4; i++) ctx.fillRect(sunX - sunR, sunY + 4 + i * 8, sunR * 2, 3);
  ctx.restore();

  // Hai lớp nhà cao tầng
  const layers = [
    { color: "#1c1548", top: 96, min: 26, max: 62 },
    { color: "#120e35", top: 116, min: 18, max: 46 },
  ];
  for (const layer of layers) {
    let x = -6;
    while (x < W) {
      const bw = 22 + rand() * 34;
      const bh = layer.min + rand() * (layer.max - layer.min);
      ctx.fillStyle = layer.color;
      ctx.fillRect(x, layer.top + (62 - bh), bw, bh + 60);
      // Cửa sổ sáng đèn
      for (let wy = layer.top + 66 - bh; wy < layer.top + 50; wy += 7) {
        for (let wx = x + 3; wx < x + bw - 3; wx += 6) {
          if (rand() > 0.72) {
            ctx.fillStyle = rand() > 0.5 ? "rgba(59,232,255,.5)" : "rgba(255,210,63,.42)";
            ctx.fillRect(wx, wy, 2, 3);
          }
        }
      }
      x += bw + 4 + rand() * 10;
    }
  }

  // Mặt đường neon + lưới phối cảnh
  const groundY = 158;
  ctx.fillStyle = "#0a0820";
  ctx.fillRect(0, groundY, W, H - groundY);
  ctx.strokeStyle = "rgba(59,232,255,.9)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(W, groundY);
  ctx.stroke();
  ctx.strokeStyle = "rgba(59,232,255,.16)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 10; i++) {
    const gx = i * 36 - 8;
    ctx.beginPath();
    ctx.moveTo(gx, groundY);
    ctx.lineTo(gx - 26, H);
    ctx.stroke();
  }

  // Nhân vật robot cyan đang nhảy
  ctx.fillStyle = "#3be8ff";
  ctx.fillRect(64, 118, 22, 26);
  ctx.fillStyle = "#061018";
  ctx.fillRect(68, 124, 12, 6);
  ctx.fillStyle = "#eafcff";
  ctx.fillRect(76, 126, 4, 3);
  ctx.fillStyle = "rgba(59,232,255,.35)";
  ctx.fillRect(52, 132, 8, 4);
  ctx.fillRect(42, 140, 7, 3);

  // Chướng ngại vật gai hồng
  ctx.fillStyle = "#ff58c7";
  for (let i = 0; i < 3; i++) {
    const sx = 176 + i * 17;
    ctx.beginPath();
    ctx.moveTo(sx, groundY);
    ctx.lineTo(sx + 8, groundY - 20);
    ctx.lineTo(sx + 16, groundY);
    ctx.closePath();
    ctx.fill();
  }

  // Tinh thể điểm thưởng
  ctx.save();
  ctx.translate(150, 108);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = "#ffd23f";
  ctx.fillRect(-7, -7, 14, 14);
  ctx.fillStyle = "rgba(255,255,255,.65)";
  ctx.fillRect(-7, -7, 6, 6);
  ctx.restore();
}

/* ---------- Bug Hunter: đàn bọ pixel ---------- */
function bugArt(ctx) {
  const rand = seededRand(77);
  ctx.fillStyle = "#0c1322";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(200,245,66,.07)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 20) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y <= H; y += 20) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  const drawBug = (x, y, color, danger = false, scale = 1) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rand() * Math.PI * 2);
    ctx.scale(scale, scale);
    if (danger) {
      ctx.fillStyle = "rgba(255,93,107,.18)";
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.fill();
    }
    // Chân
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath(); ctx.moveTo(-6, i * 6); ctx.lineTo(-13, i * 8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(6, i * 6); ctx.lineTo(13, i * 8); ctx.stroke();
    }
    // Thân
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 1, 9, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -12, 5.5, 0, Math.PI * 2);
    ctx.fill();
    // Vạch cánh
    ctx.strokeStyle = "rgba(5,7,15,.55)";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(0, 12); ctx.stroke();
    ctx.restore();
  };

  drawBug(64, 62, "#4bf584");
  drawBug(150, 44, "#ffd23f", false, 0.9);
  drawBug(250, 70, "#3be8ff", false, 0.8);
  drawBug(206, 140, "#ff5d6b", true);
  drawBug(96, 148, "#4bf584", false, 1.05);
  drawBug(286, 158, "#ffd23f", false, 0.85);

  // Tâm ngắm
  ctx.strokeStyle = "rgba(200,245,66,.9)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(150, 44, 15, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath(); ctx.moveTo(150, 22); ctx.lineTo(150, 32); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(150, 56); ctx.lineTo(150, 66); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(128, 44); ctx.lineTo(138, 44); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(162, 44); ctx.lineTo(172, 44); ctx.stroke();
}

/* ---------- Stack Tower: tháp khối cầu vồng ---------- */
function stackArt(ctx) {
  const rand = seededRand(9);
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#221046");
  bg.addColorStop(1, "#120b30");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  stars(ctx, rand, 30);

  const cx = W / 2;
  const layers = [
    { w: 150, hue: 265 },
    { w: 132, hue: 220 },
    { w: 118, hue: 180 },
    { w: 104, hue: 130 },
    { w: 92, hue: 60 },
    { w: 80, hue: 20 },
  ];
  const bh = 17;
  let y = 172;

  // Bệ tháp
  ctx.fillStyle = "#0c081f";
  ctx.beginPath();
  ctx.moveTo(cx - 100, 190);
  ctx.lineTo(cx - 78, 172);
  ctx.lineTo(cx + 78, 172);
  ctx.lineTo(cx + 100, 190);
  ctx.closePath();
  ctx.fill();

  for (const layer of layers) {
    y -= bh;
    const jitter = (rand() - 0.5) * 10;
    const x = cx - layer.w / 2 + jitter;
    const color = `hsl(${layer.hue} 85% 60%)`;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, layer.w, bh - 2);
    ctx.fillStyle = "rgba(255,255,255,.28)";
    ctx.fillRect(x, y, layer.w, 4);
    ctx.fillStyle = "rgba(0,0,0,.25)";
    ctx.fillRect(x, y + bh - 6, layer.w, 4);
  }

  // Khối đang lơ lửng chờ thả + đường gióng
  const hover = { w: 74, x: cx - 12, y: y - 46 };
  ctx.strokeStyle = "rgba(176,123,255,.4)";
  ctx.setLineDash([4, 5]);
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(hover.x, hover.y + 15); ctx.lineTo(hover.x, y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(hover.x + hover.w, hover.y + 15); ctx.lineTo(hover.x + hover.w, y); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "hsl(330 90% 62%)";
  ctx.fillRect(hover.x, hover.y, hover.w, 15);
  ctx.fillStyle = "rgba(255,255,255,.35)";
  ctx.fillRect(hover.x, hover.y, hover.w, 4);
  ctx.fillStyle = "rgba(255,88,199,.25)";
  ctx.fillRect(hover.x - 26, hover.y + 4, 18, 7);
}

/* ---------- Snake: rắn neon trên lưới ---------- */
function snakeArt(ctx) {
  ctx.fillStyle = "#081408";
  ctx.fillRect(0, 0, W, H);
  const cell = 20;
  ctx.strokeStyle = "rgba(75,245,132,.09)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += cell) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y <= H; y += cell) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // Thân rắn uốn lượn (tọa độ ô lưới)
  const path = [
    [3, 7], [4, 7], [5, 7], [6, 7], [6, 6], [6, 5], [7, 5], [8, 5],
    [9, 5], [9, 6], [9, 7], [10, 7], [11, 7], [11, 6], [11, 5], [11, 4],
  ];
  path.forEach(([gx, gy], i) => {
    const bright = 0.45 + (i / path.length) * 0.55;
    ctx.fillStyle = `rgba(75,245,132,${bright.toFixed(2)})`;
    const x = gx * cell + 2;
    const y = gy * cell + 2;
    ctx.beginPath();
    ctx.roundRect(x, y, cell - 4, cell - 4, 4);
    ctx.fill();
  });

  // Đầu rắn + mắt
  const [hx, hy] = path[path.length - 1];
  ctx.fillStyle = "#b9ffcb";
  ctx.beginPath();
  ctx.roundRect(hx * cell + 1, hy * cell + 1, cell - 2, cell - 2, 5);
  ctx.fill();
  ctx.fillStyle = "#061018";
  ctx.fillRect(hx * cell + 5, hy * cell + 5, 3, 3);
  ctx.fillRect(hx * cell + 12, hy * cell + 5, 3, 3);

  // Quả táo
  ctx.fillStyle = "#ff5d6b";
  ctx.beginPath();
  ctx.arc(14 * cell + 10, 4 * cell + 11, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#4bf584";
  ctx.fillRect(14 * cell + 9, 4 * cell + 1, 3, 5);
  ctx.fillStyle = "rgba(255,255,255,.6)";
  ctx.fillRect(14 * cell + 6, 4 * cell + 7, 3, 3);

  // Quầng sáng quanh đầu rắn
  const glow = ctx.createRadialGradient(
    hx * cell + 10, hy * cell + 10, 2,
    hx * cell + 10, hy * cell + 10, 44
  );
  glow.addColorStop(0, "rgba(75,245,132,.22)");
  glow.addColorStop(1, "rgba(75,245,132,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(hx * cell - 40, hy * cell - 40, 100, 100);
}

/* ---------- 404 Strike: góc nhìn FPS neon ---------- */
function strikeArt(ctx) {
  const rand = seededRand(404);
  // Nền không gian tối
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0a0f26");
  bg.addColorStop(0.55, "#0d1230");
  bg.addColorStop(1, "#050b1c");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const vpX = W / 2;
  const vpY = 92; // điểm tụ phối cảnh

  // Sàn hành lang
  ctx.fillStyle = "#0e1430";
  ctx.beginPath();
  ctx.moveTo(0, H);
  ctx.lineTo(vpX - 70, vpY + 18);
  ctx.lineTo(vpX + 70, vpY + 18);
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();

  // Tường trái/phải
  ctx.fillStyle = "#101838";
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(0, H);
  ctx.lineTo(vpX - 70, vpY + 18); ctx.lineTo(vpX - 70, vpY - 40);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(W, 0); ctx.lineTo(W, H);
  ctx.lineTo(vpX + 70, vpY + 18); ctx.lineTo(vpX + 70, vpY - 40);
  ctx.closePath(); ctx.fill();

  // Vạch neon sàn hội tụ về điểm tụ
  for (const [x0, color] of [[-10, "rgba(32,227,255,.85)"], [W + 10, "rgba(32,227,255,.85)"], [60, "rgba(154,92,255,.5)"], [W - 60, "rgba(154,92,255,.5)"]]) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(x0, H);
    ctx.lineTo(x0 < W / 2 ? vpX - 56 : vpX + 56, vpY + 20);
    ctx.stroke();
  }

  // Thanh đèn đỏ dọc trên tường
  for (const bx of [34, W - 38]) {
    ctx.fillStyle = "rgba(255,79,100,.9)";
    ctx.fillRect(bx, 34, 4, 56);
    ctx.fillStyle = "rgba(255,79,100,.25)";
    ctx.fillRect(bx - 3, 30, 10, 64);
  }

  // Bảng 404 phát sáng cuối hành lang
  ctx.fillStyle = "#141b3e";
  ctx.fillRect(vpX - 58, vpY - 34, 116, 46);
  ctx.strokeStyle = "rgba(32,227,255,.6)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(vpX - 58, vpY - 34, 116, 46);
  ctx.font = "800 30px monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = "#9a5cff";
  ctx.shadowColor = "#9a5cff";
  ctx.shadowBlur = 14;
  ctx.fillText("404", vpX, vpY);
  ctx.shadowBlur = 0;

  // Bot địch giữa hành lang
  const bx = vpX - 26;
  const by = vpY + 26;
  ctx.fillStyle = "#1b2140";
  ctx.fillRect(bx - 9, by, 18, 22);          // thân
  ctx.fillRect(bx - 12, by + 3, 5, 12);      // tay
  ctx.fillRect(bx + 7, by + 3, 5, 12);
  ctx.fillRect(bx - 7, by + 22, 5, 9);       // chân
  ctx.fillRect(bx + 2, by + 22, 5, 9);
  ctx.fillRect(bx - 6, by - 10, 12, 10);     // đầu
  ctx.fillStyle = "#ff4f64";                  // visor tam giác
  ctx.beginPath();
  ctx.moveTo(bx - 4, by - 8);
  ctx.lineTo(bx + 4, by - 8);
  ctx.lineTo(bx, by - 3);
  ctx.closePath();
  ctx.fill();
  // Marker cảnh báo trên đầu
  ctx.fillStyle = "rgba(255,79,100,.9)";
  ctx.beginPath();
  ctx.moveTo(bx - 5, by - 20);
  ctx.lineTo(bx + 5, by - 20);
  ctx.lineTo(bx, by - 13);
  ctx.closePath();
  ctx.fill();

  // Vật cản crate cyan-trim
  ctx.fillStyle = "#161d3f";
  ctx.fillRect(W - 118, H - 74, 52, 44);
  ctx.strokeStyle = "rgba(32,227,255,.55)";
  ctx.strokeRect(W - 118, H - 74, 52, 44);
  ctx.fillStyle = "rgba(255,210,63,.7)";
  ctx.fillRect(W - 112, H - 44, 40, 5);

  // Súng góc phải dưới (viewmodel)
  ctx.save();
  ctx.translate(W - 44, H + 6);
  ctx.rotate(-0.5);
  ctx.fillStyle = "#171c38";
  ctx.fillRect(-20, -66, 34, 78);
  ctx.fillStyle = "#0c1128";
  ctx.fillRect(-14, -70, 22, 16);
  ctx.fillStyle = "rgba(154,92,255,.95)";
  ctx.fillRect(-17, -46, 4, 30);
  ctx.fillStyle = "rgba(255,79,216,.8)";
  ctx.fillRect(10, -58, 3, 22);
  ctx.restore();

  // Tâm ngắm
  ctx.strokeStyle = "rgba(244,247,255,.95)";
  ctx.lineWidth = 2;
  const cx = vpX;
  const cy = vpY + 40;
  for (const [dx1, dy1, dx2, dy2] of [[-14, 0, -5, 0], [14, 0, 5, 0], [0, -14, 0, -5], [0, 14, 0, 5]]) {
    ctx.beginPath();
    ctx.moveTo(cx + dx1, cy + dy1);
    ctx.lineTo(cx + dx2, cy + dy2);
    ctx.stroke();
  }

  // Vài hạt sao trang trí
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = rand() > 0.6 ? "rgba(32,227,255,.6)" : "rgba(244,247,255,.5)";
    ctx.fillRect(rand() * W, rand() * 60, 1.6, 1.6);
  }
}

/* ---------- Portal Puzzle 404: board lưới navy + robot + portal ---------- */
function portalArt(ctx) {
  const rand = seededRand(1204);
  ctx.fillStyle = "#05081a";
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 24; i++) {
    ctx.fillStyle = rand() > 0.7 ? "rgba(32,227,255,.5)" : "rgba(150,170,230,.35)";
    ctx.fillRect(rand() * W, rand() * H, 1.5, 1.5);
  }

  // Board 9×5 với viền tường bevel
  const t = 30;
  const bx = 25;
  const by = 28;
  const cols = 9;
  const rows = 5;
  ctx.fillStyle = "#161d3c";
  ctx.fillRect(bx - 10, by - 10, cols * t + 20, rows * t + 20);
  ctx.fillStyle = "#3a4877";
  ctx.fillRect(bx - 10, by - 10, cols * t + 20, 5);
  ctx.fillRect(bx - 10, by - 10, 5, rows * t + 20);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? "#111834" : "#0e142d";
      ctx.fillRect(bx + x * t + 1, by + y * t + 1, t - 2, t - 2);
      ctx.strokeStyle = "rgba(96,128,210,.14)";
      ctx.strokeRect(bx + x * t + 0.5, by + y * t + 0.5, t - 1, t - 1);
    }
  }

  const cell = (gx, gy) => [bx + gx * t + t / 2, by + gy * t + t / 2];

  // Nét đứt nối 2 cổng cyan
  const [p1x, p1y] = cell(1, 3);
  const [p2x, p2y] = cell(7, 1);
  ctx.strokeStyle = "rgba(32,227,255,.4)";
  ctx.setLineDash([5, 6]);
  ctx.beginPath();
  ctx.moveTo(p1x, p1y);
  ctx.lineTo(p2x, p2y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Cổng cyan + tím
  const portal = (gx, gy, color) => {
    const [cx, cy] = cell(gx, gy);
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(cx, cy, t * 0.26, t * 0.36, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#04060f";
    ctx.beginPath();
    ctx.ellipse(cx, cy, t * 0.18, t * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  portal(1, 3, "#20e3ff");
  portal(7, 1, "#9a5cff");

  // Laser đỏ dọc
  const [lx] = cell(5, 0);
  ctx.fillStyle = "#2a0d16";
  ctx.fillRect(lx - 8, by - 12, 16, 12);
  ctx.strokeStyle = "#ff4f64";
  ctx.strokeRect(lx - 8, by - 12, 16, 12);
  const grad = ctx.createLinearGradient(lx - 4, 0, lx + 4, 0);
  grad.addColorStop(0, "rgba(255,42,63,0)");
  grad.addColorStop(0.5, "rgba(255,79,100,.9)");
  grad.addColorStop(1, "rgba(255,42,63,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(lx - 4, by, 8, rows * t);
  ctx.fillStyle = "rgba(255,240,244,.9)";
  ctx.fillRect(lx - 1, by, 2, rows * t);

  // Thùng gỗ
  const crate = (gx, gy) => {
    const [cx, cy] = cell(gx, gy);
    const s = t * 0.68;
    ctx.fillStyle = "#96622e";
    ctx.fillRect(cx - s / 2, cy - s / 2, s, s);
    ctx.strokeStyle = "#5f3c17";
    ctx.lineWidth = 2;
    ctx.strokeRect(cx - s / 2 + 1, cy - s / 2 + 1, s - 2, s - 2);
    ctx.strokeStyle = "#c08a4a";
    ctx.beginPath();
    ctx.moveTo(cx - s / 2 + 2, cy - s / 2 + 2);
    ctx.lineTo(cx + s / 2 - 2, cy + s / 2 - 2);
    ctx.moveTo(cx + s / 2 - 2, cy - s / 2 + 2);
    ctx.lineTo(cx - s / 2 + 2, cy + s / 2 - 2);
    ctx.stroke();
  };
  crate(3, 1);
  crate(6, 3);

  // Ô thoát xanh
  const [ex, ey] = cell(8, 0);
  ctx.save();
  ctx.shadowColor = "#4df77f";
  ctx.shadowBlur = 12;
  ctx.strokeStyle = "#4df77f";
  ctx.lineWidth = 2.4;
  ctx.strokeRect(ex - t * 0.32, ey - t * 0.32, t * 0.64, t * 0.64);
  ctx.beginPath();
  ctx.moveTo(ex, ey - t * 0.2);
  ctx.lineTo(ex + t * 0.2, ey);
  ctx.lineTo(ex, ey + t * 0.2);
  ctx.lineTo(ex - t * 0.2, ey);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();

  // Robot trắng mắt cyan
  const [rx, ry] = cell(2, 2);
  ctx.fillStyle = "rgba(32,227,255,.2)";
  ctx.beginPath();
  ctx.ellipse(rx, ry + t * 0.32, t * 0.3, t * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#eef2ff";
  ctx.beginPath();
  ctx.roundRect(rx - t * 0.28, ry - t * 0.26, t * 0.56, t * 0.5, 5);
  ctx.fill();
  ctx.fillStyle = "#0a1224";
  ctx.beginPath();
  ctx.roundRect(rx - t * 0.19, ry - t * 0.15, t * 0.38, t * 0.22, 3);
  ctx.fill();
  ctx.save();
  ctx.shadowColor = "#20e3ff";
  ctx.shadowBlur = 6;
  ctx.fillStyle = "#20e3ff";
  ctx.fillRect(rx - t * 0.1, ry - t * 0.08, 3, 4);
  ctx.fillRect(rx + t * 0.1 - 3, ry - t * 0.08, 3, 4);
  ctx.restore();

  // Công tắc xanh
  const [sx, sy] = cell(4, 4);
  ctx.fillStyle = "#0a0f24";
  ctx.beginPath();
  ctx.arc(sx, sy, t * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.shadowColor = "#3b7bff";
  ctx.shadowBlur = 8;
  ctx.fillStyle = "#3b7bff";
  ctx.beginPath();
  ctx.arc(sx, sy, t * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* ---------- Void Runner 404: parkour FPS giữa vực cyber ---------- */
function voidRunnerArt(ctx) {
  const rand = seededRand(4040);
  // Vực tím sâu
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0b0724");
  bg.addColorStop(0.55, "#150d38");
  bg.addColorStop(1, "#241352");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Tòa nhà mờ dưới vực với cửa sổ neon
  for (let i = 0; i < 9; i++) {
    const bx = rand() * W;
    const bw = 18 + rand() * 30;
    const by = 96 + rand() * 70;
    ctx.fillStyle = "rgba(10,8,30,0.9)";
    ctx.fillRect(bx, by, bw, H - by + 10);
    for (let wy = by + 4; wy < H - 6; wy += 8) {
      for (let wx = bx + 3; wx < bx + bw - 3; wx += 6) {
        if (rand() > 0.72) {
          ctx.fillStyle = rand() > 0.8 ? "rgba(228,44,255,.5)" : "rgba(34,228,255,.4)";
          ctx.fillRect(wx, wy, 2, 3);
        }
      }
    }
  }

  const vpX = W / 2;
  const vpY = 78;

  // Track platform lơ lửng chạy về điểm tụ
  ctx.fillStyle = "#161c38";
  ctx.beginPath();
  ctx.moveTo(46, H);
  ctx.lineTo(vpX - 34, vpY + 20);
  ctx.lineTo(vpX + 34, vpY + 20);
  ctx.lineTo(W - 46, H);
  ctx.closePath();
  ctx.fill();
  // Viền neon cyan hai mép
  for (const s of [-1, 1]) {
    ctx.strokeStyle = "rgba(34,228,255,.95)";
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(vpX + s * (W / 2 - 46), H);
    ctx.lineTo(vpX + s * 34, vpY + 20);
    ctx.stroke();
  }
  // Gap đen giữa track
  ctx.fillStyle = "rgba(11,7,36,0.94)";
  ctx.beginPath();
  ctx.moveTo(96, H - 26);
  ctx.lineTo(vpX - 21, vpY + 52);
  ctx.lineTo(vpX + 21, vpY + 52);
  ctx.lineTo(W - 96, H - 26);
  ctx.lineTo(W - 118, H - 44);
  ctx.lineTo(vpX + 16, vpY + 44);
  ctx.lineTo(vpX - 16, vpY + 44);
  ctx.lineTo(118, H - 44);
  ctx.closePath();
  ctx.fill();

  // Chevron boost cyan trên track
  ctx.fillStyle = "rgba(120,240,255,.9)";
  for (let i = 0; i < 2; i++) {
    const cy2 = 152 + i * 24;
    const w2 = 16 + i * 7;
    ctx.beginPath();
    ctx.moveTo(vpX - w2, cy2 + 10);
    ctx.lineTo(vpX, cy2);
    ctx.lineTo(vpX + w2, cy2 + 10);
    ctx.lineTo(vpX + w2, cy2 + 4);
    ctx.lineTo(vpX, cy2 - 6);
    ctx.lineTo(vpX - w2, cy2 + 4);
    ctx.closePath();
    ctx.fill();
  }

  // Laser đỏ ngang giữa 2 trụ
  const ly = 118;
  ctx.fillStyle = "#241640";
  ctx.fillRect(vpX - 52, ly - 14, 5, 20);
  ctx.fillRect(vpX + 47, ly - 14, 5, 20);
  ctx.strokeStyle = "rgba(255,46,77,.95)";
  ctx.lineWidth = 2.4;
  ctx.shadowColor = "#ff2e4d";
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(vpX - 48, ly - 5);
  ctx.lineTo(vpX + 48, ly - 5);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Cổng checkpoint lime phía xa
  ctx.strokeStyle = "rgba(183,242,50,.95)";
  ctx.lineWidth = 3;
  ctx.shadowColor = "#b7f232";
  ctx.shadowBlur = 9;
  ctx.strokeRect(vpX - 26, vpY - 4, 52, 40);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#b7f232";
  ctx.save();
  ctx.translate(vpX, vpY - 10);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-4, -4, 8, 8);
  ctx.restore();

  // Portal tím lơ lửng bên phải
  ctx.strokeStyle = "rgba(139,91,255,.9)";
  ctx.lineWidth = 3.4;
  ctx.shadowColor = "#8b5bff";
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(258, 74, 21, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(228,44,255,.75)";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(258, 74, 14, 0, Math.PI * 2);
  ctx.stroke();

  // Shard lime bên trái
  ctx.save();
  ctx.translate(66, 84);
  ctx.fillStyle = "rgba(183,242,50,.95)";
  ctx.shadowColor = "#b7f232";
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.lineTo(8, 0);
  ctx.lineTo(0, 14);
  ctx.lineTo(-8, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Hai bàn tay găng neon (trái magenta / phải cyan)
  const hand = (hx, flip, accent) => {
    ctx.save();
    ctx.translate(hx, H + 14);
    ctx.rotate(flip * 0.42);
    ctx.fillStyle = "#10131f";
    ctx.beginPath();
    ctx.roundRect(-20, -58, 40, 62, 9);
    ctx.fill();
    for (let f = 0; f < 4; f++) {
      ctx.beginPath();
      ctx.roundRect(-17 + f * 9.4, -72, 7.4, 20, 3.4);
      ctx.fill();
    }
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2.4;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 7;
    ctx.beginPath();
    ctx.moveTo(0, -30);
    ctx.lineTo(8, -44);
    ctx.lineTo(-8, -44);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-19, -6);
    ctx.lineTo(19, -6);
    ctx.stroke();
    ctx.restore();
  };
  hand(58, -0.28, "rgba(228,44,255,.95)");
  hand(W - 58, 0.28, "rgba(34,228,255,.95)");

  // Speed lines
  ctx.strokeStyle = "rgba(190,240,255,.35)";
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 7; i++) {
    const a = rand() * Math.PI * 2;
    const r0 = 64 + rand() * 60;
    const x0 = vpX + Math.cos(a) * r0 * 1.6;
    const y0 = 104 + Math.sin(a) * r0 * 0.8;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + (x0 - vpX) * 0.22, y0 + (y0 - 104) * 0.22);
    ctx.stroke();
  }
}

/* ---------- Neon Drift 404: khúc cua neon + xe drift ---------- */
function driftArt(ctx) {
  const rand = seededRand(707);
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#120a2c");
  bg.addColorStop(1, "#070414");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // nhà neon hai bên
  for (let i = 0; i < 7; i++) {
    const bw = 34 + rand() * 40;
    const bh = 30 + rand() * 46;
    const x = rand() * (W - bw);
    const y = rand() > 0.5 ? rand() * 34 : H - bh - rand() * 24;
    ctx.fillStyle = "#0d0a20";
    ctx.fillRect(x, y, bw, bh);
    ctx.strokeStyle = rand() > 0.5 ? "rgba(255,46,230,.55)" : "rgba(32,227,255,.55)";
    ctx.strokeRect(x, y, bw, bh);
    ctx.fillStyle = "rgba(32,227,255,.3)";
    for (let wy = y + 6; wy < y + bh - 4; wy += 9) ctx.fillRect(x + 5, wy, bw - 10, 2.5);
  }

  // khúc cua: đường asphalt cong với 2 mép neon
  const roadPath = new Path2D();
  roadPath.moveTo(-20, 168);
  roadPath.bezierCurveTo(90, 150, 150, 76, 250, 66);
  roadPath.lineTo(360, 60);
  ctx.strokeStyle = "#131120";
  ctx.lineWidth = 62;
  ctx.lineCap = "round";
  ctx.stroke(roadPath);
  ctx.strokeStyle = "rgba(255,46,230,.3)";
  ctx.lineWidth = 70;
  ctx.stroke(roadPath);
  ctx.strokeStyle = "#131120";
  ctx.lineWidth = 62;
  ctx.stroke(roadPath);
  ctx.strokeStyle = "#ff2ee6";
  ctx.lineWidth = 3;
  ctx.save();
  ctx.translate(0, -33);
  ctx.stroke(roadPath);
  ctx.restore();
  ctx.strokeStyle = "#20e3ff";
  ctx.save();
  ctx.translate(0, 33);
  ctx.stroke(roadPath);
  ctx.restore();
  ctx.strokeStyle = "rgba(240,244,255,.5)";
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 16]);
  ctx.stroke(roadPath);
  ctx.setLineDash([]);

  // vệt drift hồng
  ctx.strokeStyle = "rgba(255,46,230,.75)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(78, 172);
  ctx.quadraticCurveTo(120, 150, 158, 118);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,46,230,.35)";
  ctx.lineWidth = 8;
  ctx.stroke();

  // xe người chơi drift
  ctx.save();
  ctx.translate(170, 108);
  ctx.rotate(-0.55);
  ctx.shadowColor = "#ff2ee6";
  ctx.shadowBlur = 14;
  ctx.fillStyle = "#dfe8ff";
  ctx.beginPath();
  ctx.roundRect(-17, -9, 34, 18, 6);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#0b1226";
  ctx.beginPath();
  ctx.roundRect(-4, -6.5, 11, 13, 4);
  ctx.fill();
  ctx.fillStyle = "#20e3ff";
  ctx.fillRect(-17, -9, 26, 2.4);
  ctx.fillRect(-17, 6.6, 26, 2.4);
  ctx.fillStyle = "#ff2ee6";
  ctx.beginPath();
  ctx.roundRect(11, -8, 6, 16, 3);
  ctx.fill();
  ctx.restore();

  // pickup lục giác lime
  ctx.save();
  ctx.translate(238, 82);
  ctx.shadowColor = "#a8ff3e";
  ctx.shadowBlur = 10;
  ctx.strokeStyle = "#a8ff3e";
  ctx.fillStyle = "rgba(28,46,8,.92)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    const x = Math.cos(a) * 11;
    const y = Math.sin(a) * 11;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#a8ff3e";
  ctx.beginPath();
  ctx.moveTo(1.5, -6);
  ctx.lineTo(-3.5, 1.5);
  ctx.lineTo(-0.5, 1.5);
  ctx.lineTo(-1.5, 6);
  ctx.lineTo(3.5, -1.5);
  ctx.lineTo(0.5, -1.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // banner CHECKPOINT
  ctx.fillStyle = "rgba(10,14,8,.9)";
  ctx.fillRect(224, 26, 88, 18);
  ctx.strokeStyle = "#a8ff3e";
  ctx.lineWidth = 1.6;
  ctx.strokeRect(224, 26, 88, 18);
  ctx.fillStyle = "#a8ff3e";
  ctx.font = "800 10px monospace";
  ctx.textAlign = "center";
  ctx.shadowColor = "#a8ff3e";
  ctx.shadowBlur = 8;
  ctx.fillText("CHECKPOINT", 268, 39);
  ctx.shadowBlur = 0;

  // minimap góc trái
  ctx.fillStyle = "rgba(6,9,24,.85)";
  ctx.strokeStyle = "rgba(32,227,255,.5)";
  ctx.beginPath();
  ctx.roundRect(10, 10, 64, 46, 7);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,46,230,.9)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(42, 33, 22, 13, -0.2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#4df77f";
  ctx.beginPath();
  ctx.arc(56, 28, 2.6, 0, Math.PI * 2);
  ctx.fill();
}

/* ---------- Cyber Defense: bảng mạch + tháp + CORE ---------- */
function defenseArt(ctx) {
  const rand = seededRand(808);
  ctx.fillStyle = "#071021";
  ctx.fillRect(0, 0, W, H);

  // trace mạch in
  ctx.strokeStyle = "rgba(32,120,200,.18)";
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 16; i++) {
    let x = rand() * W;
    let y = rand() * H;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 2; k++) {
      const len = 20 + rand() * 50;
      if (rand() > 0.5) x += rand() > 0.5 ? len : -len;
      else y += rand() > 0.5 ? len : -len;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = "rgba(32,120,200,.3)";
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // tuyến đường
  const path = new Path2D();
  path.moveTo(-10, 60);
  path.lineTo(90, 60);
  path.lineTo(90, 130);
  path.lineTo(190, 130);
  path.lineTo(190, 80);
  path.lineTo(258, 80);
  ctx.strokeStyle = "rgba(47,123,255,.3)";
  ctx.lineWidth = 30;
  ctx.lineJoin = "round";
  ctx.stroke(path);
  ctx.strokeStyle = "#0d1b3a";
  ctx.lineWidth = 24;
  ctx.stroke(path);
  ctx.strokeStyle = "#2f7bff";
  ctx.lineWidth = 1.6;
  ctx.stroke(path);

  // mũi tên vào
  ctx.fillStyle = "#ff4fd8";
  for (let k = 0; k < 2; k++) {
    ctx.beginPath();
    ctx.moveTo(8 + k * 12, 52);
    ctx.lineTo(20 + k * 12, 60);
    ctx.lineTo(8 + k * 12, 68);
    ctx.closePath();
    ctx.fill();
  }

  // pad + tháp
  const pad = (x, y) => {
    ctx.strokeStyle = "rgba(190,255,80,.55)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI / 4) * i + Math.PI / 8;
      const px = x + Math.cos(a) * 15;
      const py = y + Math.sin(a) * 15;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  };
  pad(50, 120);
  pad(150, 55);
  pad(230, 140);

  const tower = (x, y, color) => {
    ctx.fillStyle = "#0c142c";
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI / 4) * i + Math.PI / 8;
      const px = x + Math.cos(a) * 14;
      const py = y + Math.sin(a) * 14;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.fillRect(x - 2, y - 14, 10, 3);
    ctx.beginPath();
    ctx.arc(x, y - 8, 4.5, 0, Math.PI * 2);
    ctx.fill();
  };
  tower(140, 105, "#20e3ff");
  tower(60, 30, "#9a5cff");

  // range circle nét đứt
  ctx.strokeStyle = "rgba(32,227,255,.5)";
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.arc(140, 105, 42, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // bot với thanh máu
  const bot = (x, y) => {
    ctx.fillStyle = "#121830";
    ctx.strokeStyle = "#44507f";
    ctx.beginPath();
    ctx.roundRect(x - 7, y - 6, 14, 12, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ff4f64";
    ctx.fillRect(x - 3, y - 2, 6, 3);
    ctx.fillStyle = "rgba(10,10,20,.8)";
    ctx.fillRect(x - 8, y - 13, 16, 3);
    ctx.fillStyle = "#ff3b4f";
    ctx.fillRect(x - 8, y - 13, 10, 3);
  };
  bot(60, 60);
  bot(110, 130);
  bot(150, 130);

  // tia đạn cyan
  ctx.strokeStyle = "#20e3ff";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(140, 96);
  ctx.lineTo(118, 126);
  ctx.stroke();

  // CORE cube
  ctx.save();
  ctx.translate(272, 80);
  ctx.strokeStyle = "rgba(32,227,255,.5)";
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    const px = Math.cos(a) * 26;
    const py = Math.sin(a) * 23;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.shadowColor = "#20e3ff";
  ctx.shadowBlur = 12;
  ctx.strokeStyle = "#20e3ff";
  ctx.lineWidth = 2;
  ctx.strokeRect(-11, -11, 22, 22);
  ctx.strokeRect(-6, -15, 22, 22);
  ctx.beginPath();
  ctx.moveTo(-11, -11); ctx.lineTo(-6, -15);
  ctx.moveTo(11, -11); ctx.lineTo(16, -15);
  ctx.moveTo(11, 11); ctx.lineTo(16, 7);
  ctx.moveTo(-11, 11); ctx.lineTo(-6, 7);
  ctx.stroke();
  ctx.restore();

  // badge CORE %
  ctx.fillStyle = "rgba(8,14,28,.92)";
  ctx.strokeStyle = "#a8ff3e";
  ctx.lineWidth = 1.4;
  ctx.fillRect(244, 18, 56, 24);
  ctx.strokeRect(244, 18, 56, 24);
  ctx.fillStyle = "#a8ff3e";
  ctx.font = "800 11px monospace";
  ctx.textAlign = "center";
  ctx.fillText("CORE 86%", 272, 34);
}

/* ---------- Rogue Arena: đấu trường neon + robot + enemy hình học ---------- */
function rogueArt(ctx) {
  const rand = seededRand(909);
  const bg = ctx.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, 220);
  bg.addColorStop(0, "#0d1330");
  bg.addColorStop(1, "#060a1c");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // vòng tròn sàn + tường
  ctx.strokeStyle = "rgba(100,140,255,.14)";
  ctx.lineWidth = 1.6;
  for (const r of [28, 52, 76]) {
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(110,130,210,.4)";
  ctx.lineWidth = 3;
  ctx.strokeRect(8, 8, W - 16, H - 16);
  // dải neon góc
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(255,46,150,1)";
  ctx.beginPath();
  ctx.moveTo(52, 12);
  ctx.lineTo(12, 12);
  ctx.lineTo(12, 52);
  ctx.stroke();
  ctx.strokeStyle = "rgba(32,227,255,1)";
  ctx.beginPath();
  ctx.moveTo(W - 52, H - 12);
  ctx.lineTo(W - 12, H - 12);
  ctx.lineTo(W - 12, H - 52);
  ctx.stroke();

  // tia điện tỏa từ robot
  ctx.strokeStyle = "rgba(32,227,255,.8)";
  ctx.lineWidth = 3;
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i + 0.4;
    ctx.beginPath();
    ctx.moveTo(W / 2 + Math.cos(a) * 22, H / 2 + Math.sin(a) * 22);
    ctx.lineTo(W / 2 + Math.cos(a) * (44 + rand() * 22), H / 2 + Math.sin(a) * (40 + rand() * 20));
    ctx.stroke();
  }

  // robot giữa
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.strokeStyle = "rgba(32,227,255,.4)";
  ctx.beginPath();
  ctx.arc(0, 5, 17, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#e8edff";
  ctx.beginPath();
  ctx.roundRect(-10, -11, 20, 20, 5);
  ctx.fill();
  ctx.fillStyle = "#0a1224";
  ctx.beginPath();
  ctx.roundRect(-6, -7, 12, 7, 3);
  ctx.fill();
  ctx.save();
  ctx.shadowColor = "#20e3ff";
  ctx.shadowBlur = 7;
  ctx.fillStyle = "#20e3ff";
  ctx.fillRect(-4, -5.4, 8, 3);
  ctx.restore();
  ctx.restore();

  // enemy hình học
  const tri = (x, y, r, color, dark) => {
    ctx.fillStyle = dark;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r, y + r * 0.75);
    ctx.lineTo(x - r, y + r * 0.75);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(10,10,20,.8)";
    ctx.fillRect(x - r * 0.8, y - r - 7, r * 1.6, 3);
    ctx.fillStyle = "#ff3b4f";
    ctx.fillRect(x - r * 0.8, y - r - 7, r * 1.1, 3);
  };
  tri(64, 66, 13, "#ff2e96", "#3d1030");
  tri(250, 148, 12, "#ff2e96", "#3d1030");
  tri(226, 52, 11, "#ff3b4f", "#3c0a12");
  // shooter cube
  ctx.fillStyle = "#38080c";
  ctx.strokeStyle = "#ff3b4f";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(272, 82, 26, 26, 4);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "#ff8091";
  ctx.beginPath();
  ctx.arc(285, 95, 6, 0, Math.PI * 2);
  ctx.stroke();
  // tank cube tím
  ctx.fillStyle = "#241040";
  ctx.strokeStyle = "#9a5cff";
  ctx.beginPath();
  ctx.roundRect(52, 128, 30, 30, 5);
  ctx.fill();
  ctx.stroke();

  // gem XP
  const gem = (x, y) => {
    ctx.fillStyle = "#20e3ff";
    ctx.beginPath();
    ctx.moveTo(x, y - 6);
    ctx.lineTo(x + 4.5, y);
    ctx.lineTo(x, y + 6);
    ctx.lineTo(x - 4.5, y);
    ctx.closePath();
    ctx.fill();
  };
  gem(130, 140);
  gem(196, 60);
  gem(160, 158);
  // hex XP lime
  ctx.strokeStyle = "#a8ff3e";
  ctx.fillStyle = "rgba(30,46,8,.92)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    const x = 118 + Math.cos(a) * 11;
    const y = 84 + Math.sin(a) * 11;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#a8ff3e";
  ctx.font = "800 8px monospace";
  ctx.textAlign = "center";
  ctx.fillText("XP", 118, 87);
  // chữ nổi
  ctx.fillStyle = "#20e3ff";
  ctx.font = "800 11px monospace";
  ctx.fillText("+40 XP", 108, 118);
}

/* ---------- Rhythm Hack: highway 4 lane phối cảnh ---------- */
function rhythmArt(ctx) {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#070b20");
  bg.addColorStop(1, "#0a0f2a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const laneColors = ["#20e3ff", "#9a5cff", "#ff2e96", "#a8ff3e"];
  const topY = 16;
  const hitY = 158;
  const topW = 74;
  const botW = 286;
  const edgeX = (i, k) => {
    const w = topW + (botW - topW) * k;
    return W / 2 - w / 2 + (w / 4) * i;
  };

  // mặt highway
  ctx.fillStyle = "rgba(6,9,24,.9)";
  ctx.beginPath();
  ctx.moveTo(edgeX(0, 0), topY);
  ctx.lineTo(edgeX(4, 0), topY);
  ctx.lineTo(edgeX(4, 1), hitY);
  ctx.lineTo(edgeX(0, 1), hitY);
  ctx.closePath();
  ctx.fill();

  // vạch chia lane
  for (let i = 0; i <= 4; i++) {
    ctx.strokeStyle = i === 0 || i === 4 ? "rgba(120,170,255,.55)" : "rgba(120,150,230,.25)";
    ctx.lineWidth = i === 0 || i === 4 ? 2.4 : 1.4;
    ctx.beginPath();
    ctx.moveTo(edgeX(i, 0), topY);
    ctx.lineTo(edgeX(i, 1), hitY);
    ctx.stroke();
  }

  // notes trên các lane
  const note = (lane, k) => {
    const y = topY + (hitY - topY) * (k * k * 0.62 + k * 0.38);
    const w = (edgeX(lane + 1, k) - edgeX(lane, k)) * 0.72;
    const x = (edgeX(lane, k) + edgeX(lane + 1, k)) / 2;
    const h = 5 + k * 9;
    ctx.save();
    ctx.shadowColor = laneColors[lane];
    ctx.shadowBlur = 8;
    ctx.fillStyle = laneColors[lane];
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2);
    ctx.fill();
    ctx.restore();
  };
  note(0, 0.3);
  note(1, 0.55);
  note(2, 0.75);
  note(3, 0.42);
  note(1, 0.16);

  // vạch hit + đế nhận
  ctx.strokeStyle = "rgba(240,246,255,.85)";
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(edgeX(0, 1) - 6, hitY);
  ctx.lineTo(edgeX(4, 1) + 6, hitY);
  ctx.stroke();
  for (let i = 0; i < 4; i++) {
    const x = (edgeX(i, 1) + edgeX(i + 1, 1)) / 2;
    ctx.strokeStyle = laneColors[i];
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(x, hitY, 20, 6.5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // chữ PERFECT giữa
  ctx.save();
  ctx.font = "800 22px monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = "#20e3ff";
  ctx.shadowColor = "#20e3ff";
  ctx.shadowBlur = 14;
  ctx.fillText("PERFECT", W / 2, 92);
  ctx.fillRect(W / 2 - 86, 89, 18, 3);
  ctx.fillRect(W / 2 + 68, 89, 18, 3);
  ctx.restore();

  // phím D F J K
  const keys = ["D", "F", "J", "K"];
  for (let i = 0; i < 4; i++) {
    const x = (edgeX(i, 1) + edgeX(i + 1, 1)) / 2;
    ctx.fillStyle = "rgba(10,14,32,.95)";
    ctx.strokeStyle = laneColors[i];
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x - 17, 168, 34, 26, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = laneColors[i];
    ctx.font = "800 15px monospace";
    ctx.textAlign = "center";
    ctx.fillText(keys[i], x, 187);
  }
}

/* ---------- Brick Breaker 404: tường gạch neon + bóng + paddle ---------- */
function brickBreakerArt(ctx) {
  const rand = seededRand(1111);
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0a0e2e");
  bg.addColorStop(1, "#070a22");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // trace mạch mờ
  ctx.strokeStyle = "rgba(32,120,220,.12)";
  for (let i = 0; i < 8; i++) {
    let x = rand() * W;
    let y = 90 + rand() * 100;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 2; k++) {
      const len = 20 + rand() * 50;
      if (rand() > 0.5) x += rand() > 0.5 ? len : -len;
      else y += rand() > 0.5 ? len : -len;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // khung neon
  ctx.strokeStyle = "rgba(32,227,255,.75)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(6, 6, W - 12, H - 12, 10);
  ctx.stroke();

  // tường gạch: hàng thép + cyan/tím/hồng
  const bw = 28;
  const bh = 12;
  const x0 = 16;
  const drawBrick = (gx, gy, colA, colB, icon) => {
    const x = x0 + gx * (bw + 2);
    const y = 16 + gy * (bh + 3);
    const g2 = ctx.createLinearGradient(0, y, 0, y + bh);
    g2.addColorStop(0, colA);
    g2.addColorStop(1, colB);
    ctx.fillStyle = g2;
    ctx.beginPath();
    ctx.roundRect(x, y, bw, bh, 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.3)";
    ctx.fillRect(x + 2, y + 1.5, bw - 4, 2);
    if (icon === "x") {
      ctx.strokeStyle = "rgba(150,160,185,.8)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x + 5, y + 2);
      ctx.lineTo(x + bw - 5, y + bh - 2);
      ctx.moveTo(x + bw - 5, y + 2);
      ctx.lineTo(x + 5, y + bh - 2);
      ctx.stroke();
    } else if (icon === "s") {
      ctx.fillStyle = "rgba(255,255,255,.85)";
      ctx.beginPath();
      ctx.arc(x + bw / 2, y + bh / 2, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  for (let gx = 0; gx < 10; gx++) drawBrick(gx, 0, "#4a5168", "#262b3d", "x");
  const pat = [
    [1, "c"], [2, "v"], [3, "c"], [5, "p"], [6, "c"], [8, "v"], [9, "c"],
  ];
  const tones = { c: ["#4fe3ff", "#1490c2", null], v: ["#9a6bff", "#5c2bd9", "s"], p: ["#ff4fae", "#c9186e", "s"] };
  for (let gy = 1; gy < 4; gy++) {
    for (const [gx, t] of pat) {
      if ((gx + gy) % 3 === 2) continue;
      const [a, b, ic] = tones[t];
      drawBrick(gx, gy, a, b, ic);
    }
  }

  // vệt bóng + bóng
  const trail = [[70, 158], [92, 138], [116, 120], [142, 105]];
  trail.forEach(([tx, ty], i) => {
    ctx.fillStyle = `rgba(90,210,255,${0.16 + i * 0.12})`;
    ctx.beginPath();
    ctx.arc(tx, ty, 3 + i * 0.8, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.save();
  ctx.shadowColor = "#7ce6ff";
  ctx.shadowBlur = 10;
  ctx.fillStyle = "#eaf9ff";
  ctx.beginPath();
  ctx.arc(160, 92, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // power-up rơi
  ctx.strokeStyle = "#4df77f";
  ctx.fillStyle = "rgba(6,10,26,.95)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(226, 130, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.font = "800 9px monospace";
  ctx.textAlign = "center";
  ctx.fillText("x2", 226, 133);
  ctx.strokeStyle = "rgba(77,247,127,.8)";
  ctx.beginPath();
  ctx.moveTo(221, 146);
  ctx.lineTo(226, 151);
  ctx.lineTo(231, 146);
  ctx.stroke();

  // paddle tím lõi cyan
  ctx.save();
  ctx.shadowColor = "#8a5cff";
  ctx.shadowBlur = 12;
  const pg = ctx.createLinearGradient(0, 176, 0, 188);
  pg.addColorStop(0, "#8a5cff");
  pg.addColorStop(1, "#4d21a8");
  ctx.fillStyle = pg;
  ctx.beginPath();
  ctx.roundRect(118, 176, 84, 12, 6);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = "#20e3ff";
  ctx.fillRect(146, 180, 28, 4);
}

/* ---------- Laser Maze 404: lưới ô + tia laser gấp khúc ---------- */
function laserMazeArt(ctx) {
  ctx.fillStyle = "#0b0e1e";
  ctx.fillRect(0, 0, W, H);
  const t = 34;
  const ox = 24;
  const oy = 18;
  // lưới 8×5
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 8; x++) {
      ctx.fillStyle = "#151a29";
      ctx.beginPath();
      ctx.roundRect(ox + x * t + 1, oy + y * t + 1, t - 3, t - 3, 4);
      ctx.fill();
      ctx.strokeStyle = "rgba(96,120,175,.16)";
      ctx.stroke();
    }
  }
  const cx = (x) => ox + x * t + t / 2;
  const cy = (y) => oy + y * t + t / 2;
  const beam = (x1, y1, x2, y2, col) => {
    ctx.save();
    ctx.shadowColor = col;
    ctx.shadowBlur = 8;
    ctx.strokeStyle = col;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(cx(x1), cy(y1));
    ctx.lineTo(cx(x2), cy(y2));
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255,255,255,.7)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  };
  // đường tia: nguồn (0,3) → gương (3,3) → lên (3,1) → gương → phải qua filter cyan (5,1) → thu (7,1)
  beam(0, 3, 3, 3, "#ff3b4f");
  beam(3, 3, 3, 1, "#ff3b4f");
  beam(3, 1, 5, 1, "#ff3b4f");
  beam(5, 1, 7, 1, "#20e3ff");

  // nguồn
  ctx.fillStyle = "#210b12";
  ctx.strokeStyle = "rgba(255,80,100,.55)";
  ctx.beginPath();
  ctx.roundRect(ox + 3, oy + 3 * t + 3, t - 6, t - 6, 4);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "#ff3b4f";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(cx(0), cy(3), 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#ff5a68";
  ctx.beginPath();
  ctx.arc(cx(0), cy(3), 3.4, 0, Math.PI * 2);
  ctx.fill();

  // gương
  const mirror = (x, y, a) => {
    ctx.save();
    ctx.translate(cx(x), cy(y));
    ctx.rotate(a);
    const g2 = ctx.createLinearGradient(0, -3, 0, 3);
    g2.addColorStop(0, "#e8f4ff");
    g2.addColorStop(1, "#5d7fa8");
    ctx.fillStyle = g2;
    ctx.beginPath();
    ctx.roundRect(-10, -2.6, 20, 5.2, 2.6);
    ctx.fill();
    ctx.restore();
  };
  mirror(3, 3, -Math.PI / 4);
  mirror(3, 1, Math.PI / 4);

  // filter cyan
  ctx.strokeStyle = "#20e3ff";
  ctx.lineWidth = 2.6;
  ctx.shadowColor = "#20e3ff";
  ctx.shadowBlur = 6;
  ctx.strokeRect(cx(5) - 7, cy(1) - 7, 14, 14);
  ctx.shadowBlur = 0;

  // bộ thu + check
  ctx.strokeStyle = "#20e3ff";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(cx(7), cy(1), 9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx(7), cy(1), 5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#20d96a";
  ctx.beginPath();
  ctx.arc(cx(7) + 9, cy(1) + 9, 5.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#04270f";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(cx(7) + 6.6, cy(1) + 9);
  ctx.lineTo(cx(7) + 8.6, cy(1) + 11);
  ctx.lineTo(cx(7) + 11.6, cy(1) + 7);
  ctx.stroke();

  // blocker
  ctx.strokeStyle = "rgba(130,140,165,.7)";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(cx(5) - 7, cy(3) - 7);
  ctx.lineTo(cx(5) + 7, cy(3) + 7);
  ctx.moveTo(cx(5) + 7, cy(3) - 7);
  ctx.lineTo(cx(5) - 7, cy(3) + 7);
  ctx.stroke();

  // splitter nhỏ
  ctx.strokeStyle = "rgba(255,120,135,.9)";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(cx(1) - 7, cy(0));
  ctx.lineTo(cx(1) + 7, cy(0));
  ctx.moveTo(cx(1), cy(0) - 7);
  ctx.lineTo(cx(1), cy(0) + 7);
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(cx(1), cy(0), 2.4, 0, Math.PI * 2);
  ctx.fill();
}

const PAINTERS = {
  runner: runnerArt,
  "bug-hunter": bugArt,
  "stack-tower": stackArt,
  snake: snakeArt,
  strike: strikeArt,
  "portal-puzzle": portalArt,
  "neon-drift": driftArt,
  "cyber-defense": defenseArt,
  "rogue-arena": rogueArt,
  "rhythm-hack": rhythmArt,
  "void-runner": voidRunnerArt,
  "brick-breaker": brickBreakerArt,
  "laser-maze": laserMazeArt,
};

/** Vẽ preview của một game lên canvas trong card. */
export function paintPreview(gameId, canvas) {
  const painter = PAINTERS[gameId];
  if (!painter) return;
  const ctx = setup(canvas);
  painter(ctx);
}
