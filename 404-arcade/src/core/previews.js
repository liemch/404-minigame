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

const PAINTERS = {
  runner: runnerArt,
  "bug-hunter": bugArt,
  "stack-tower": stackArt,
  snake: snakeArt,
  strike: strikeArt,
};

/** Vẽ preview của một game lên canvas trong card. */
export function paintPreview(gameId, canvas) {
  const painter = PAINTERS[gameId];
  if (!painter) return;
  const ctx = setup(canvas);
  painter(ctx);
}
