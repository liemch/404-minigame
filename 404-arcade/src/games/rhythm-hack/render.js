/**
 * render.js — vẽ highway 4 lane phối cảnh của Rhythm Hack theo ảnh
 * reference: lane hẹp trên rộng dưới, màu cyan/tím/hồng/lime, note là
 * thanh phát sáng trượt xuống, vạch hit + đế nhận sáng khi nhấn, chữ
 * judgement PERFECT/GREAT/GOOD/MISS pop giữa màn, hạt sáng khi hit,
 * nhịp nền pulse theo beat. Kèm painter trái tim pixel (SYSTEM REPAIR).
 */

export const LANE_COLORS = ["#20e3ff", "#9a5cff", "#ff2e96", "#a8ff3e"];
const APPROACH = 1.6; // giây từ mép trên tới vạch hit

export function createHighwayRenderer(canvas, container) {
  const g = canvas.getContext("2d");
  let dpr = 1;
  let W = 0;
  let H = 0;

  const pops = []; // judgement text
  const bursts = []; // hạt khi hit
  const pressT = [0, 0, 0, 0]; // thời điểm nhấn lane
  const missT = [0, 0, 0, 0];

  function fit() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = container.clientWidth;
    H = container.clientHeight;
    canvas.width = Math.max(1, Math.round(W * dpr));
    canvas.height = Math.max(1, Math.round(H * dpr));
  }

  const topY = () => H * 0.05;
  const hitY = () => H * 0.8;
  const topW = () => W * 0.22;
  const botW = () => W * 0.92;

  /** Tọa độ x biên lane i (0..4) tại độ sâu k (0 trên → 1 vạch hit). */
  function edgeX(i, k) {
    const w = topW() + (botW() - topW()) * k;
    return W / 2 - w / 2 + (w / 4) * i;
  }

  const depth = (k) => k * k * 0.62 + k * 0.38; // phối cảnh: nhanh dần về gần

  function laneCenterX(lane, k) {
    return (edgeX(lane, k) + edgeX(lane + 1, k)) / 2;
  }

  function yAt(k) {
    return topY() + (hitY() - topY()) * k;
  }

  /* ---------------- API hiệu ứng ---------------- */

  function pop(text, color) {
    pops.push({ text, color, t0: performance.now() / 1000 });
    if (pops.length > 3) pops.shift();
  }

  function burst(lane, color, n = 10) {
    const x = laneCenterX(lane, 1);
    const y = hitY();
    for (let i = 0; i < n; i++) {
      if (bursts.length > 90) break;
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.8;
      const sp = 90 + Math.random() * 220;
      bursts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5, color });
    }
  }

  function press(lane) {
    pressT[lane] = performance.now() / 1000;
  }

  function miss(lane) {
    missT[lane] = performance.now() / 1000;
  }

  /* ---------------- khung hình ---------------- */

  function draw(songTime, notes, judge, beat, dt) {
    if (W === 0) fit();
    const now = performance.now() / 1000;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    // nền + pulse theo beat
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#070b20");
    bg.addColorStop(1, "#0a0f2a");
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    if (songTime > 0) {
      const beatK = 1 - ((songTime / beat) % 1);
      g.fillStyle = `rgba(32,120,255,${0.045 * beatK})`;
      g.fillRect(0, 0, W, H);
    }

    // mặt highway
    g.beginPath();
    g.moveTo(edgeX(0, 0), topY());
    g.lineTo(edgeX(4, 0), topY());
    g.lineTo(edgeX(4, 1), hitY());
    g.lineTo(edgeX(0, 1), hitY());
    g.closePath();
    g.fillStyle = "rgba(6, 9, 24, 0.85)";
    g.fill();

    // mỗi lane nhuộm màu riêng thường trực (như ảnh) + bừng sáng khi nhấn
    for (let i = 0; i < 4; i++) {
      const pk = Math.max(0, 1 - (now - pressT[i]) / 0.22);
      const grad = g.createLinearGradient(0, topY(), 0, hitY());
      const base = 0.13 + pk * 0.2;
      grad.addColorStop(0, `${LANE_COLORS[i]}00`);
      grad.addColorStop(0.55, `${LANE_COLORS[i]}${Math.round(base * 130).toString(16).padStart(2, "0")}`);
      grad.addColorStop(1, `${LANE_COLORS[i]}${Math.round(base * 255).toString(16).padStart(2, "0")}`);
      g.beginPath();
      g.moveTo(edgeX(i, 0), topY());
      g.lineTo(edgeX(i + 1, 0), topY());
      g.lineTo(edgeX(i + 1, 1), hitY());
      g.lineTo(edgeX(i, 1), hitY());
      g.closePath();
      g.fillStyle = grad;
      g.fill();
    }

    // vạch chia lane (hội tụ)
    for (let i = 0; i <= 4; i++) {
      const glow = i === 0 || i === 4;
      g.strokeStyle = glow ? "rgba(120, 170, 255, 0.5)" : "rgba(120, 150, 230, 0.22)";
      g.lineWidth = glow ? 2.4 : 1.4;
      g.beginPath();
      g.moveTo(edgeX(i, 0), topY());
      g.lineTo(edgeX(i, 1), hitY());
      g.stroke();
    }

    // vạch ngang mờ chạy xuống (cảm giác tốc độ)
    if (songTime > -3) {
      for (let r = 0; r < 6; r++) {
        const phase = ((songTime * 0.6 + r / 6) % 1 + 1) % 1;
        const k = depth(phase);
        g.strokeStyle = `rgba(100, 130, 210, ${0.1 * phase})`;
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(edgeX(0, k), yAt(k));
        g.lineTo(edgeX(4, k), yAt(k));
        g.stroke();
      }
    }

    // vạch HIT
    g.strokeStyle = "rgba(240, 246, 255, 0.85)";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(edgeX(0, 1) - 8, hitY());
    g.lineTo(edgeX(4, 1) + 8, hitY());
    g.stroke();

    // đế nhận (receptor)
    for (let i = 0; i < 4; i++) {
      const x = laneCenterX(i, 1);
      const pk = Math.max(0, 1 - (now - pressT[i]) / 0.25);
      const mk = Math.max(0, 1 - (now - missT[i]) / 0.3);
      const c = LANE_COLORS[i];
      g.save();
      g.strokeStyle = c;
      g.globalAlpha = 0.5 + pk * 0.5;
      g.lineWidth = 2.6 + pk * 2;
      g.beginPath();
      g.ellipse(x, hitY(), 30 + pk * 7, 10 + pk * 3, 0, 0, Math.PI * 2);
      g.stroke();
      if (pk > 0) {
        g.globalAlpha = pk * 0.5;
        g.fillStyle = c;
        g.beginPath();
        g.ellipse(x, hitY(), 22, 7, 0, 0, Math.PI * 2);
        g.fill();
      }
      if (mk > 0) {
        g.globalAlpha = mk * 0.6;
        g.strokeStyle = "#ff3b4f";
        g.beginPath();
        g.ellipse(x, hitY(), 34 + (1 - mk) * 14, 12, 0, 0, Math.PI * 2);
        g.stroke();
      }
      g.restore();
    }

    // notes (chỉ vẽ vùng nhìn thấy)
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      const tRel = n.time - songTime;
      if (tRel > APPROACH) break;
      if (tRel < -0.12 || judge.isDone(i)) continue;
      const k = depth(1 - tRel / APPROACH);
      const y = yAt(k);
      const laneW = edgeX(n.lane + 1, k) - edgeX(n.lane, k);
      const x = laneCenterX(n.lane, k);
      const w = laneW * 0.72;
      const h = 7 + k * 13;
      const c = LANE_COLORS[n.lane];
      g.save();
      g.shadowColor = c;
      g.shadowBlur = 6 + k * 10;
      g.fillStyle = c;
      g.beginPath();
      g.roundRect(x - w / 2, y - h / 2, w, h, h / 2);
      g.fill();
      g.shadowBlur = 0;
      g.fillStyle = "rgba(255,255,255,0.55)";
      g.beginPath();
      g.roundRect(x - w / 2 + 3, y - h / 2 + 2, w - 6, Math.max(2, h * 0.28), 3);
      g.fill();
      g.restore();
    }

    // hạt hit
    for (let i = bursts.length - 1; i >= 0; i--) {
      const p = bursts[i];
      p.life -= dt;
      if (p.life <= 0) {
        bursts.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 320 * dt;
      g.globalAlpha = Math.min(1, p.life * 2.4);
      g.fillStyle = p.color;
      g.fillRect(p.x - 2, p.y - 2, 4, 4);
      g.globalAlpha = 1;
    }

    // judgement pop (giữa màn như ảnh: ═ PERFECT ═)
    for (let i = pops.length - 1; i >= 0; i--) {
      const p = pops[i];
      const k = (now - p.t0) / 0.55;
      if (k > 1) {
        pops.splice(i, 1);
        continue;
      }
      const scale = k < 0.18 ? 0.7 + (k / 0.18) * 0.34 : 1.04 - (k - 0.18) * 0.06;
      g.save();
      g.translate(W / 2, H * 0.42);
      g.scale(scale, scale);
      g.globalAlpha = k > 0.72 ? 1 - (k - 0.72) / 0.28 : 1;
      g.font = `800 ${Math.round(Math.min(52, W * 0.062))}px 'JetBrains Mono', monospace`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.shadowColor = p.color;
      g.shadowBlur = 20;
      g.fillStyle = p.color;
      g.fillText(p.text, 0, 0);
      g.shadowBlur = 0;
      const tw = g.measureText(p.text).width;
      g.fillRect(-tw / 2 - 44, -2, 30, 4);
      g.fillRect(tw / 2 + 14, -2, 30, 4);
      g.restore();
    }

    // đếm ngược trước khi nhạc bắt đầu
    if (songTime < 0) {
      const n = Math.ceil(-songTime / beat);
      g.save();
      g.font = `800 ${Math.round(H * 0.14)}px 'JetBrains Mono', monospace`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillStyle = "rgba(240,246,255,0.9)";
      g.shadowColor = "#20e3ff";
      g.shadowBlur = 26;
      g.fillText(String(Math.max(1, n)), W / 2, H * 0.42);
      g.restore();
    }
  }

  /** Vùng chạm: quy đổi clientX → lane (theo bề rộng đáy highway). */
  function laneFromClientX(clientX) {
    const r = canvas.getBoundingClientRect();
    const x = clientX - r.left;
    for (let i = 0; i < 4; i++) {
      if (x >= edgeX(i, 1) && x < edgeX(i + 1, 1)) return i;
    }
    return x < W / 2 ? 0 : 3;
  }

  return { fit, draw, pop, burst, press, miss, laneFromClientX };
}

/* ---------------- Trái tim pixel (panel SYSTEM REPAIR như ảnh) ---------------- */

const HEART = [
  ".XX...XX.",
  "XXXX.XXXX",
  "XXXXXXXXX",
  "XXXXXXXXX",
  ".XXXXXXX.",
  "..XXXXX..",
  "...XXX...",
  "....X....",
];

export function paintHeart(canvas, progress) {
  const rows = HEART.length;
  const cols = HEART[0].length;
  const cell = 12;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = cols * cell * dpr;
  canvas.height = rows * cell * dpr;
  const g = canvas.getContext("2d");
  g.scale(dpr, dpr);
  const cells = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (HEART[y][x] === "X") cells.push([x, y]);
    }
  }
  // thắp sáng từ dưới lên theo progress
  cells.sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  const lit = Math.round(cells.length * Math.max(0, Math.min(1, progress)));
  cells.forEach(([x, y], i) => {
    const on = i < lit;
    g.fillStyle = on ? "#2fa8ff" : "rgba(47, 123, 255, 0.16)";
    g.fillRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
    if (on) {
      g.fillStyle = "rgba(180, 230, 255, 0.65)";
      g.fillRect(x * cell + 2, y * cell + 2, 3, 3);
    }
  });
}
