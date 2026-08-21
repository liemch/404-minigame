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

  // vân mạch trang trí 2 bên nền (tọa độ tỉ lệ 0..1, seeded)
  const decor = (() => {
    let seed = 20777;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const lines = [];
    for (let i = 0; i < 30; i++) {
      const side = i % 2 === 0 ? 0 : 1;
      let x = side === 0 ? rnd() * 0.15 : 0.85 + rnd() * 0.15;
      let y = rnd();
      const pts = [[x, y]];
      const segs = 2 + Math.floor(rnd() * 3);
      for (let k = 0; k < segs; k++) {
        const len = 0.025 + rnd() * 0.07;
        if (rnd() > 0.5) x += rnd() > 0.5 ? len : -len;
        else y += rnd() > 0.5 ? len : -len;
        pts.push([x, y]);
      }
      lines.push(pts);
    }
    return lines;
  })();

  function fit() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = container.clientWidth;
    H = container.clientHeight;
    canvas.width = Math.max(1, Math.round(W * dpr));
    canvas.height = Math.max(1, Math.round(H * dpr));
  }

  const topY = () => H * 0.04;
  const hitY = () => H * 0.78;
  const topW = () => W * 0.17;
  const botW = () => W * 0.98;

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
    // chỉ giữ 1 judgement — tránh chữ chồng nhau khi 2 note sát nhau
    pops.length = 0;
    pops.push({ text, color, t0: performance.now() / 1000 });
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

    // vân mạch mờ 2 bên nền (như ảnh)
    g.strokeStyle = "rgba(60,120,220,0.13)";
    g.fillStyle = "rgba(60,120,220,0.2)";
    g.lineWidth = 1.2;
    for (const pts of decor) {
      g.beginPath();
      g.moveTo(pts[0][0] * W, pts[0][1] * H);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0] * W, pts[i][1] * H);
      g.stroke();
      const last = pts[pts.length - 1];
      g.beginPath();
      g.arc(last[0] * W, last[1] * H, 2, 0, Math.PI * 2);
      g.fill();
    }

    // hệ số kéo dài lane xuống hết đáy canvas (qua vạch hit như ảnh)
    const kBot = (H - topY()) / (hitY() - topY());

    // mặt highway (kéo dài tới đáy)
    g.beginPath();
    g.moveTo(edgeX(0, 0), topY());
    g.lineTo(edgeX(4, 0), topY());
    g.lineTo(edgeX(4, kBot), H);
    g.lineTo(edgeX(0, kBot), H);
    g.closePath();
    g.fillStyle = "rgba(5, 8, 22, 0.9)";
    g.fill();

    // mỗi lane nhuộm màu riêng thường trực (như ảnh) + bừng sáng khi nhấn
    for (let i = 0; i < 4; i++) {
      const pk = Math.max(0, 1 - (now - pressT[i]) / 0.22);
      const grad = g.createLinearGradient(0, topY(), 0, hitY());
      const base = 0.32 + pk * 0.22;
      grad.addColorStop(0, `${LANE_COLORS[i]}05`);
      grad.addColorStop(0.55, `${LANE_COLORS[i]}${Math.round(base * 120).toString(16).padStart(2, "0")}`);
      grad.addColorStop(1, `${LANE_COLORS[i]}${Math.round(Math.min(255, base * 235)).toString(16).padStart(2, "0")}`);
      g.beginPath();
      g.moveTo(edgeX(i, 0), topY());
      g.lineTo(edgeX(i + 1, 0), topY());
      g.lineTo(edgeX(i + 1, 1), hitY());
      g.lineTo(edgeX(i, 1), hitY());
      g.closePath();
      g.fillStyle = grad;
      g.fill();
      // phần lane dưới vạch hit — nhạt dần về đáy
      const grad2 = g.createLinearGradient(0, hitY(), 0, H);
      grad2.addColorStop(0, `${LANE_COLORS[i]}${Math.round(Math.min(255, base * 200)).toString(16).padStart(2, "0")}`);
      grad2.addColorStop(1, `${LANE_COLORS[i]}0a`);
      g.beginPath();
      g.moveTo(edgeX(i, 1), hitY());
      g.lineTo(edgeX(i + 1, 1), hitY());
      g.lineTo(edgeX(i + 1, kBot), H);
      g.lineTo(edgeX(i, kBot), H);
      g.closePath();
      g.fillStyle = grad2;
      g.fill();
    }

    // vạch chia lane (hội tụ, phát sáng như ảnh)
    for (let i = 0; i <= 4; i++) {
      const outer = i === 0 || i === 4;
      g.save();
      g.shadowColor = outer ? "#9ecbff" : LANE_COLORS[Math.min(3, Math.max(0, i - (i === 4 ? 1 : 0)))];
      g.shadowBlur = outer ? 12 : 8;
      g.strokeStyle = outer ? "rgba(200, 228, 255, 0.85)" : "rgba(215, 235, 255, 0.5)";
      g.lineWidth = outer ? 2.8 : 1.8;
      g.beginPath();
      g.moveTo(edgeX(i, 0), topY());
      g.lineTo(edgeX(i, kBot), H);
      g.stroke();
      g.restore();
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

    // vạch HIT phát sáng
    g.save();
    g.shadowColor = "#eaf4ff";
    g.shadowBlur = 10;
    g.strokeStyle = "rgba(244, 249, 255, 0.95)";
    g.lineWidth = 3.4;
    g.beginPath();
    g.moveTo(edgeX(0, 1) - 10, hitY());
    g.lineTo(edgeX(4, 1) + 10, hitY());
    g.stroke();
    g.restore();

    // đế nhận (receptor): cột sáng + vòng + hạt pixel như ảnh
    for (let i = 0; i < 4; i++) {
      const x = laneCenterX(i, 1);
      const pk = Math.max(0, 1 - (now - pressT[i]) / 0.25);
      const mk = Math.max(0, 1 - (now - missT[i]) / 0.3);
      const c = LANE_COLORS[i];
      const laneW = edgeX(i + 1, 1) - edgeX(i, 1);
      g.save();
      // cột sáng dựng lên từ receptor
      const beamH = H * 0.15 * (1 + pk * 0.6);
      const beamW = laneW * (0.24 + pk * 0.16);
      const beam = g.createLinearGradient(0, hitY() - beamH, 0, hitY());
      beam.addColorStop(0, `${c}00`);
      beam.addColorStop(1, `${c}${Math.round((0.1 + pk * 0.32) * 255).toString(16).padStart(2, "0")}`);
      g.fillStyle = beam;
      g.beginPath();
      g.moveTo(x - beamW * 0.4, hitY() - beamH);
      g.lineTo(x + beamW * 0.4, hitY() - beamH);
      g.lineTo(x + beamW, hitY());
      g.lineTo(x - beamW, hitY());
      g.closePath();
      g.fill();
      // hạt pixel lấp lánh quanh chân receptor
      for (let d = 0; d < 8; d++) {
        const seed = Math.sin(i * 37.7 + d * 91.3 + Math.floor(now * 5) * 13.7) * 0.5 + 0.5;
        const seed2 = Math.sin(i * 53.1 + d * 47.9 + Math.floor(now * 5) * 7.3) * 0.5 + 0.5;
        const dx = (seed - 0.5) * laneW * 0.75;
        const dy = -seed2 * 52 - 4;
        g.globalAlpha = (0.25 + seed2 * 0.5) * (0.55 + pk * 0.45);
        g.fillStyle = c;
        const sz = 2 + seed * 2.4;
        g.fillRect(x + dx - sz / 2, hitY() + dy, sz, sz);
      }
      g.globalAlpha = 1;
      // quầng sáng chân
      const glowR = 26 + pk * 12;
      const gl = g.createRadialGradient(x, hitY(), 2, x, hitY(), glowR * 1.7);
      gl.addColorStop(0, `${c}${Math.round((0.4 + pk * 0.45) * 255).toString(16).padStart(2, "0")}`);
      gl.addColorStop(1, `${c}00`);
      g.fillStyle = gl;
      g.beginPath();
      g.ellipse(x, hitY(), glowR * 1.7, glowR * 0.62, 0, 0, Math.PI * 2);
      g.fill();
      // vòng receptor kép
      g.shadowColor = c;
      g.shadowBlur = 12 + pk * 10;
      g.strokeStyle = c;
      g.globalAlpha = 0.75 + pk * 0.25;
      g.lineWidth = 3 + pk * 2;
      g.beginPath();
      g.ellipse(x, hitY(), 30 + pk * 7, 10.5 + pk * 3, 0, 0, Math.PI * 2);
      g.stroke();
      g.shadowBlur = 0;
      g.strokeStyle = "rgba(255,255,255,0.7)";
      g.lineWidth = 1.2;
      g.beginPath();
      g.ellipse(x, hitY(), 21, 7, 0, 0, Math.PI * 2);
      g.stroke();
      if (pk > 0) {
        g.globalAlpha = pk * 0.55;
        g.fillStyle = c;
        g.beginPath();
        g.ellipse(x, hitY(), 22, 7.4, 0, 0, Math.PI * 2);
        g.fill();
      }
      if (mk > 0) {
        g.globalAlpha = mk * 0.6;
        g.strokeStyle = "#ff3b4f";
        g.lineWidth = 2.6;
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
      const w = laneW * 0.74;
      const h = 9 + k * 15;
      const c = LANE_COLORS[n.lane];
      g.save();
      // quầng dưới note
      g.fillStyle = `${c}2e`;
      g.beginPath();
      g.roundRect(x - w / 2 - 5, y - h / 2 - 4, w + 10, h + 8, (h + 8) / 2);
      g.fill();
      g.shadowColor = c;
      g.shadowBlur = 10 + k * 14;
      g.fillStyle = c;
      g.beginPath();
      g.roundRect(x - w / 2, y - h / 2, w, h, h / 2);
      g.fill();
      g.shadowBlur = 0;
      // dải sáng trắng giữa note
      g.fillStyle = "rgba(255,255,255,0.75)";
      g.beginPath();
      g.roundRect(x - w / 2 + 4, y - h * 0.22, w - 8, Math.max(2, h * 0.36), 3);
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
      g.font = `800 italic ${Math.round(Math.min(64, W * 0.075))}px 'JetBrains Mono', monospace`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.shadowColor = p.color;
      g.shadowBlur = 28;
      g.fillStyle = p.color;
      g.fillText(p.text, 0, 0);
      g.fillText(p.text, 0, 0); // tô 2 lần cho đậm glow
      g.shadowBlur = 0;
      // viền sáng chữ
      g.strokeStyle = "rgba(255,255,255,0.5)";
      g.lineWidth = 1;
      g.strokeText(p.text, 0, 0);
      // thanh ═ đôi hai bên (như ảnh)
      const tw = g.measureText(p.text).width;
      for (const side of [-1, 1]) {
        const bx = side * (tw / 2 + 30);
        g.fillRect(bx - 18, -7, 36, 4);
        g.fillRect(bx - 12, 2, 24, 4);
      }
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
