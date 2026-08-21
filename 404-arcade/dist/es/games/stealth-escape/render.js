/**
 * render.js — vẽ Stealth Escape 404 theo ảnh reference: bản đồ ô vuông
 * sàn navy + lưới mờ, tường slate có mặt trên sáng, vùng khuất tối,
 * hình quạt tầm nhìn đỏ trong suốt, tuyến tuần tra đỏ nét đứt + mũi
 * tên, đường gợi ý xanh lá nét đứt, robot tuần tra đỏ, camera xám,
 * keycard xanh, trạm báo động, cửa năng lượng vàng và lối thoát xanh
 * với biểu tượng người chạy; người chơi là robot cyan phát sáng.
 */

import { TILE, DIRS, guardPose } from "./engine.js";
import { SPRITES } from "./assets.js";

export function createStealthRenderer(canvas, box) {
  const g = canvas.getContext("2d");
  /* Sprite cắt từ ảnh tham chiếu — decode async; khi chưa sẵn sàng các
   * hàm vẽ fallback về nét vector cũ. */
  const spr = {};
  for (const [key, url] of Object.entries(SPRITES)) {
    const im = new Image();
    im.onload = () => {
      spr[key] = im;
    };
    im.src = url;
  }
  let dpr = 1;
  let W = 0;
  let H = 0;

  function fit() {
    const rect = box.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    W = rect.width;
    H = rect.height;
  }

  /** Bố cục bản đồ: chừa sidebar trái + hàng nút dưới. */
  function layout(level) {
    const sideW = W >= 760 ? 212 : 0;
    const x0a = sideW + 14;
    const y0a = 12;
    const availW = W - x0a - 14;
    const availH = H - y0a - (W >= 760 ? 74 : 66);
    const ts = Math.max(14, Math.min(56, Math.floor(Math.min(availW / level.w, availH / level.h))));
    return {
      ts,
      x0: x0a + (availW - ts * level.w) / 2,
      y0: y0a + (availH - ts * level.h) / 2,
    };
  }

  function cellAt(clientX, clientY, level) {
    const rect = canvas.getBoundingClientRect();
    const L = layout(level);
    const x = Math.floor((clientX - rect.left - L.x0) / L.ts);
    const y = Math.floor((clientY - rect.top - L.y0) / L.ts);
    if (x < 0 || y < 0 || x >= level.w || y >= level.h) return null;
    return { x, y };
  }

  /* ---------- thành phần ---------- */

  function drawGuard(cx, cy, ts, dir, alert, time) {
    g.save();
    g.translate(cx, cy);
    const s = ts * 0.4;
    // quầng cảnh giác
    if (alert) {
      g.strokeStyle = `rgba(255,60,80,${0.5 + Math.sin(time * 10) * 0.3})`;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(0, 0, s * 1.5, 0, Math.PI * 2);
      g.stroke();
    }
    if (spr.guard) {
      /* robot tuần tra cắt từ reference (mặt quay xuống) — xoay theo
       * hướng nhìn bằng canvas transform */
      const [fx2, fy2] = DIRS[dir];
      g.rotate(Math.atan2(fy2, fx2) - Math.PI / 2);
      const dw = ts * 1.42;
      const dh = dw * (spr.guard.height / spr.guard.width);
      g.drawImage(spr.guard, -dw * 0.5, -dh * 0.52, dw, dh);
      g.restore();
      return;
    }
    // bánh xích
    g.fillStyle = "#1a1026";
    g.beginPath();
    g.roundRect(-s * 0.9, s * 0.35, s * 1.8, s * 0.55, s * 0.2);
    g.fill();
    // thân đỏ sẫm
    const bg = g.createLinearGradient(0, -s, 0, s);
    bg.addColorStop(0, "#7d2432");
    bg.addColorStop(1, "#3d1020");
    g.fillStyle = bg;
    g.beginPath();
    g.roundRect(-s * 0.72, -s * 0.5, s * 1.44, s, s * 0.24);
    g.fill();
    g.strokeStyle = "rgba(255,90,110,.55)";
    g.lineWidth = 1.4;
    g.stroke();
    // đầu + mắt đỏ phát sáng lệch theo hướng nhìn
    g.fillStyle = "#2b0d18";
    g.beginPath();
    g.roundRect(-s * 0.5, -s * 1.05, s, s * 0.62, s * 0.18);
    g.fill();
    const [fx, fy] = DIRS[dir];
    g.save();
    g.shadowColor = "#ff3b52";
    g.shadowBlur = 8;
    g.fillStyle = "#ff3b52";
    g.beginPath();
    g.arc(fx * s * 0.2, -s * 0.74 + fy * s * 0.12, s * 0.18, 0, Math.PI * 2);
    g.fill();
    g.restore();
    // anten
    g.strokeStyle = "#8090b8";
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(s * 0.34, -s * 1.05);
    g.lineTo(s * 0.5, -s * 1.4);
    g.stroke();
    g.restore();
  }

  function drawCameraDevice(cx, cy, ts, dir, time) {
    g.save();
    g.translate(cx, cy);
    const s = ts * 0.36;
    g.rotate([Math.PI, -Math.PI / 2, 0, Math.PI / 2][dir]); // thân quay theo hướng
    // chân đế
    g.fillStyle = "#2a3350";
    g.fillRect(-s * 0.2, -s * 0.9, s * 0.4, s * 0.5);
    // thân camera xám
    const bg = g.createLinearGradient(-s, 0, s, 0);
    bg.addColorStop(0, "#9aa5c0");
    bg.addColorStop(1, "#4d5878");
    g.fillStyle = bg;
    g.beginPath();
    g.roundRect(-s * 0.7, -s * 0.5, s * 1.4, s, s * 0.22);
    g.fill();
    g.strokeStyle = "rgba(20,26,48,.8)";
    g.lineWidth = 1.4;
    g.stroke();
    // ống kính hướng về phía trước (sau xoay = phía dưới +y)
    g.fillStyle = "#10162e";
    g.beginPath();
    g.arc(0, s * 0.62, s * 0.34, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "#20e3ff";
    g.lineWidth = 1.2;
    g.stroke();
    // LED đỏ nhấp nháy
    g.fillStyle = Math.floor(time * 3) % 2 === 0 ? "#ff3b52" : "#5b1622";
    g.beginPath();
    g.arc(s * 0.42, -s * 0.28, s * 0.12, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  function drawPlayer(cx, cy, ts, time) {
    g.save();
    g.translate(cx, cy);
    const s = ts * 0.38;
    // quầng cyan
    const glow = g.createRadialGradient(0, 0, 2, 0, 0, s * 2.2);
    glow.addColorStop(0, "rgba(32,227,255,.4)");
    glow.addColorStop(1, "rgba(32,227,255,0)");
    g.fillStyle = glow;
    g.fillRect(-s * 2.2, -s * 2.2, s * 4.4, s * 4.4);
    if (spr.player) {
      // robot cyan cắt từ reference (glow nướng sẵn trong mask tròn)
      const dw = ts * 1.16;
      const dh = dw * (spr.player.height / spr.player.width);
      g.drawImage(spr.player, -dw / 2, -dh * 0.52, dw, dh);
      void time;
      g.restore();
      return;
    }
    // chân
    g.fillStyle = "#101830";
    g.fillRect(-s * 0.5, s * 0.4, s * 0.36, s * 0.5);
    g.fillRect(s * 0.14, s * 0.4, s * 0.36, s * 0.5);
    // thân
    const bg = g.createLinearGradient(0, -s, 0, s);
    bg.addColorStop(0, "#31405f");
    bg.addColorStop(1, "#141c34");
    g.fillStyle = bg;
    g.beginPath();
    g.roundRect(-s * 0.66, -s * 0.45, s * 1.32, s, s * 0.26);
    g.fill();
    g.strokeStyle = "rgba(120,200,255,.55)";
    g.lineWidth = 1.4;
    g.stroke();
    // đầu + visor cyan
    g.fillStyle = "#1b2440";
    g.beginPath();
    g.roundRect(-s * 0.46, -s * 1.02, s * 0.92, s * 0.6, s * 0.2);
    g.fill();
    g.save();
    g.shadowColor = "#20e3ff";
    g.shadowBlur = 8;
    g.fillStyle = "#20e3ff";
    g.fillRect(-s * 0.3, -s * 0.84, s * 0.6, s * 0.2);
    g.restore();
    void time;
    g.restore();
  }

  function dashedPath(points, tone, ts, time, arrows = true) {
    if (points.length < 2) return;
    g.save();
    g.strokeStyle = tone;
    g.lineWidth = Math.max(1.6, ts * 0.06);
    g.setLineDash([ts * 0.22, ts * 0.2]);
    g.lineDashOffset = -time * ts * 0.5;
    g.beginPath();
    g.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) g.lineTo(points[i][0], points[i][1]);
    g.stroke();
    g.setLineDash([]);
    if (arrows) {
      for (let i = 1; i < points.length; i++) {
        const [x0, y0] = points[i - 1];
        const [x1, y1] = points[i];
        const len = Math.hypot(x1 - x0, y1 - y0);
        if (len < ts * 0.8) continue;
        const mx = (x0 + x1) / 2;
        const my = (y0 + y1) / 2;
        const a = Math.atan2(y1 - y0, x1 - x0);
        g.save();
        g.translate(mx, my);
        g.rotate(a);
        g.fillStyle = tone;
        g.beginPath();
        g.moveTo(ts * 0.16, 0);
        g.lineTo(-ts * 0.08, -ts * 0.12);
        g.lineTo(-ts * 0.08, ts * 0.12);
        g.closePath();
        g.fill();
        g.restore();
      }
    }
    g.restore();
  }

  /* ---------- vẽ chính ---------- */

  /**
   * view = { level, st, cones, guardsPrevT, moveAnim, hintPath, hintT,
   *          spotFlash }
   */
  function draw(view, time) {
    const { level, st, cones } = view;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // nền ngoài bản đồ
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0a0d24");
    bg.addColorStop(1, "#070a1c");
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    if (!level) return;

    const L = layout(level);
    const ts = L.ts;
    const px = (x) => L.x0 + x * ts;
    const py = (y) => L.y0 + y * ts;
    const cx = (x) => px(x) + ts / 2;
    const cy = (y) => py(y) + ts / 2;

    // khung viền bản đồ
    g.strokeStyle = "rgba(90,120,200,.35)";
    g.lineWidth = 2;
    g.strokeRect(L.x0 - 5, L.y0 - 5, ts * level.w + 10, ts * level.h + 10);

    // sàn / vùng khuất
    for (let y = 0; y < level.h; y++) {
      for (let x = 0; x < level.w; x++) {
        const t = level.tiles[y][x];
        if (t === TILE.WALL) continue;
        g.fillStyle = t === TILE.SHADOW ? "#0e1226" : "#212947";
        g.fillRect(px(x), py(y), ts, ts);
        g.strokeStyle = "rgba(96,116,178,.16)";
        g.lineWidth = 1;
        g.strokeRect(px(x) + 0.5, py(y) + 0.5, ts - 1, ts - 1);
        if (t === TILE.SHADOW) {
          g.strokeStyle = "rgba(70,90,150,.14)";
          g.beginPath();
          g.moveTo(px(x) + 2, py(y) + ts - 2);
          g.lineTo(px(x) + ts - 2, py(y) + 2);
          g.stroke();
        }
      }
    }

    // hình quạt tầm nhìn (vẽ dưới tường để không tràn lên tường)
    for (const cone of cones) {
      for (const [x, y, f] of cone.cells) {
        const a = Math.max(0.08, 0.3 - f * 0.055) + Math.sin(time * 3 + x + y) * 0.02;
        g.fillStyle = `rgba(255,52,74,${a.toFixed(3)})`;
        g.fillRect(px(x), py(y), ts, ts);
      }
      // tam giác mờ từ mắt về hướng nhìn cho cảm giác cone mượt
      const [fx, fy] = DIRS[cone.dir];
      const range = cone.kind === "guard" ? 4 : 3;
      const ex = cx(cone.x) + fx * ts * range;
      const ey = cy(cone.y) + fy * ts * range;
      const sxv = -fy;
      const syv = fx;
      const spread = ts * (range / 2);
      const grad = g.createLinearGradient(cx(cone.x), cy(cone.y), ex, ey);
      grad.addColorStop(0, "rgba(255,60,80,.22)");
      grad.addColorStop(1, "rgba(255,60,80,0)");
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(cx(cone.x), cy(cone.y));
      g.lineTo(ex + sxv * spread, ey + syv * spread);
      g.lineTo(ex - sxv * spread, ey - syv * spread);
      g.closePath();
      g.fill();
    }

    // tuyến tuần tra (đỏ nét đứt)
    for (const gd of level.guards) {
      const pts = gd.cells.map(([x, y]) => [cx(x), cy(y)]);
      if (gd.closed && pts.length) pts.push(pts[0]);
      dashedPath(pts, "rgba(255,70,90,.6)", ts, time * 0.4);
    }

    // đường gợi ý (xanh lá nét đứt)
    if (view.hintT > 0 && view.hintPath) {
      dashedPath(view.hintPath.map(([x, y]) => [cx(x), cy(y)]), "rgba(80,240,120,.85)", ts, time);
    }

    // tường + cover
    for (let y = 0; y < level.h; y++) {
      for (let x = 0; x < level.w; x++) {
        const t = level.tiles[y][x];
        if (t === TILE.WALL) {
          if (spr.wallH) {
            /* tường ống kim loại cắt từ reference — nối theo hướng có
             * tường lân cận trong bản đồ */
            const wallAt = (xx, yy) =>
              xx >= 0 && yy >= 0 && xx < level.w && yy < level.h && level.tiles[yy][xx] === TILE.WALL;
            g.fillStyle = "#10152b";
            g.fillRect(px(x), py(y), ts, ts);
            const hasH = wallAt(x - 1, y) || wallAt(x + 1, y);
            const hasV = wallAt(x, y - 1) || wallAt(x, y + 1);
            const th = ts * 0.68;
            const im = spr.wallH;
            const half = im.width / 2; // dùng nửa trái (đoạn ống đồng nhất) cho mọi ô
            if (hasH || !hasV) {
              g.drawImage(im, 0, 0, half, im.height, px(x) - 0.3, py(y) + (ts - th) / 2, ts + 0.6, th);
            }
            if (hasV) {
              g.save();
              g.translate(px(x) + ts / 2, py(y) + ts / 2);
              g.rotate(Math.PI / 2);
              g.drawImage(im, 0, 0, half, im.height, -ts / 2 - 0.3, -th / 2, ts + 0.6, th);
              g.restore();
            }
          } else {
            g.fillStyle = "#141a33";
            g.fillRect(px(x), py(y), ts, ts);
            g.fillStyle = "#3c4668";
            g.fillRect(px(x) + 1, py(y) + 1, ts - 2, ts - 2);
            g.fillStyle = "#545f86";
            g.fillRect(px(x) + 1, py(y) + 1, ts - 2, ts * 0.3);
          }
        } else if (t === TILE.COVER) {
          g.fillStyle = "#212947";
          g.fillRect(px(x), py(y), ts, ts);
          g.fillStyle = "#33406a";
          g.beginPath();
          g.roundRect(px(x) + 3, py(y) + 3, ts - 6, ts - 6, 4);
          g.fill();
          g.strokeStyle = "#556699";
          g.lineWidth = 1.6;
          g.stroke();
          g.beginPath();
          g.moveTo(px(x) + 5, py(y) + 5);
          g.lineTo(px(x) + ts - 5, py(y) + ts - 5);
          g.moveTo(px(x) + ts - 5, py(y) + 5);
          g.lineTo(px(x) + 5, py(y) + ts - 5);
          g.stroke();
        }
      }
    }

    const opened = st.keyMask === (1 << level.keycards.length) - 1;

    // cửa năng lượng
    for (const d of level.doors) {
      g.save();
      const dx = px(d.x);
      const dy = py(d.y);
      if (spr.doorV && !opened) {
        /* thiết bị cửa cắt từ reference (thanh năng lượng dọc) — xoay
         * ngang khi cửa chắn hành lang dọc (tường trên/dưới) */
        const wallAt = (xx, yy) =>
          xx < 0 || yy < 0 || xx >= level.w || yy >= level.h || level.tiles[yy][xx] === TILE.WALL;
        const vertGap = wallAt(d.x - 1, d.y) || wallAt(d.x + 1, d.y);
        g.translate(dx + ts / 2, dy + ts / 2);
        if (!vertGap) g.rotate(Math.PI / 2);
        const dh = ts * 1.12;
        const dw = dh * (spr.doorV.width / spr.doorV.height);
        g.shadowColor = "#ffd23f";
        g.shadowBlur = 9;
        g.drawImage(spr.doorV, -dw / 2, -dh / 2, dw, dh);
        g.restore();
        continue;
      }
      if (!opened) {
        g.shadowColor = "#ffd23f";
        g.shadowBlur = 8;
        g.strokeStyle = "#ffd23f";
        g.lineWidth = 3;
        for (const k of [0.3, 0.5, 0.7]) {
          g.beginPath();
          g.moveTo(dx + ts * k, dy + 3);
          g.lineTo(dx + ts * k, dy + ts - 3);
          g.stroke();
        }
      } else {
        g.strokeStyle = "rgba(255,210,63,.3)";
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(dx + ts * 0.3, dy + 3);
        g.lineTo(dx + ts * 0.3, dy + ts * 0.24);
        g.moveTo(dx + ts * 0.7, dy + ts * 0.76);
        g.lineTo(dx + ts * 0.7, dy + ts - 3);
        g.stroke();
      }
      g.fillStyle = "#4d5878";
      g.fillRect(dx, dy, ts, 4);
      g.fillRect(dx, dy + ts - 4, ts, 4);
      g.restore();
    }

    // keycard
    level.keycards.forEach((k, i) => {
      if (st.keyMask & (1 << i)) return;
      const bob = Math.sin(time * 3 + i) * ts * 0.05;
      g.save();
      g.translate(cx(k.x), cy(k.y) + bob);
      g.shadowColor = "#4df77f";
      g.shadowBlur = 9;
      if (spr.keycard) {
        // thẻ xanh cắt từ reference (glow nướng sẵn)
        const dw = ts * 0.78;
        const dh = dw * (spr.keycard.height / spr.keycard.width);
        g.drawImage(spr.keycard, -dw / 2, -dh / 2, dw, dh);
        g.restore();
        return;
      }
      g.fillStyle = "#0d2415";
      g.strokeStyle = "#4df77f";
      g.lineWidth = 1.8;
      g.beginPath();
      g.roundRect(-ts * 0.3, -ts * 0.2, ts * 0.6, ts * 0.4, 3);
      g.fill();
      g.stroke();
      g.shadowBlur = 0;
      g.fillStyle = "#4df77f";
      g.fillRect(-ts * 0.2, -ts * 0.08, ts * 0.16, ts * 0.12);
      g.fillRect(0, -ts * 0.06, ts * 0.2, ts * 0.03);
      g.fillRect(0, ts * 0.02, ts * 0.2, ts * 0.03);
      g.restore();
    });

    // trạm báo động
    level.terminals.forEach((t, i) => {
      const used = st.termMask & (1 << i);
      g.save();
      g.translate(cx(t.x), cy(t.y));
      if (spr.terminal && !used) {
        // trạm báo động cắt từ reference (đỏ khi chưa vô hiệu hóa)
        const dh = ts * 0.86;
        const dw = dh * (spr.terminal.width / spr.terminal.height);
        g.drawImage(spr.terminal, -dw / 2, -dh / 2, dw, dh);
        g.restore();
        return;
      }
      g.fillStyle = "#241019";
      g.strokeStyle = used ? "rgba(80,240,120,.7)" : "#ff3b52";
      g.lineWidth = 1.8;
      g.beginPath();
      g.roundRect(-ts * 0.26, -ts * 0.32, ts * 0.52, ts * 0.64, 3);
      g.fill();
      g.stroke();
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 2; c++) {
          g.fillStyle = used ? "#2b4a34" : r === 0 ? "#ff3b52" : "#7d2432";
          g.fillRect(-ts * 0.16 + c * ts * 0.18, -ts * 0.22 + r * ts * 0.17, ts * 0.13, ts * 0.1);
        }
      }
      g.restore();
    });

    // lối thoát
    {
      const e = level.exit;
      const tone = opened ? "#4df77f" : "#4d5878";
      g.save();
      g.translate(cx(e.x), cy(e.y));
      if (opened) {
        g.shadowColor = "#4df77f";
        g.shadowBlur = 12 + Math.sin(time * 4) * 4;
      }
      if (spr.exitDoor) {
        /* cửa thoát neon xanh cắt từ reference — mờ đi khi chưa đủ keycard */
        const dh = ts * 1.04;
        const dw = dh * (spr.exitDoor.width / spr.exitDoor.height);
        if (!opened) g.globalAlpha = 0.5;
        g.drawImage(spr.exitDoor, -dw / 2, -dh / 2, dw, dh);
        g.globalAlpha = 1;
        g.restore();
      } else {
      g.strokeStyle = tone;
      g.lineWidth = 2.6;
      g.strokeRect(-ts * 0.36, -ts * 0.42, ts * 0.72, ts * 0.84);
      g.fillStyle = opened ? "rgba(20,60,34,.85)" : "rgba(24,30,52,.85)";
      g.fillRect(-ts * 0.36, -ts * 0.42, ts * 0.72, ts * 0.84);
      g.shadowBlur = 0;
      // người chạy (stick figure)
      g.strokeStyle = tone;
      g.lineWidth = Math.max(1.8, ts * 0.07);
      g.lineCap = "round";
      const s = ts * 0.16;
      g.beginPath();
      g.arc(0, -s * 1.5, s * 0.55, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.moveTo(-s * 0.4, -s * 0.8);
      g.lineTo(s * 0.3, s * 0.2);
      g.moveTo(-s * 1.1, -s * 0.2);
      g.lineTo(0, -s * 0.5);
      g.moveTo(0, -s * 0.5);
      g.lineTo(s * 1.1, -s * 0.9);
      g.moveTo(s * 0.3, s * 0.2);
      g.lineTo(-s * 0.7, s * 1.3);
      g.moveTo(s * 0.3, s * 0.2);
      g.lineTo(s * 1.2, s * 1.1);
      g.stroke();
      g.restore();
      }
    }

    // camera
    for (const cone of cones) {
      if (cone.kind === "camera") drawCameraDevice(cx(cone.x), cy(cone.y), ts, cone.dir, time);
    }

    // guard (nội suy giữa lượt trước và lượt hiện tại)
    const k = view.moveAnim; // 0..1
    for (const gd of level.guards) {
      const prev = guardPose(gd, Math.max(0, st.turns - 1));
      const cur = guardPose(gd, st.turns);
      const gx = cx(prev.x + (cur.x - prev.x) * k);
      const gy = cy(prev.y + (cur.y - prev.y) * k);
      drawGuard(gx, gy, ts, cur.dir, st.spotted, time);
    }

    // người chơi (nội suy)
    const pxx = cx(view.prevP.x + (st.px - view.prevP.x) * k);
    const pyy = cy(view.prevP.y + (st.py - view.prevP.y) * k);
    drawPlayer(pxx, pyy, ts, time);

    // chớp đỏ khi bị phát hiện
    if (view.spotFlash > 0) {
      g.fillStyle = `rgba(255,40,60,${(view.spotFlash * 0.22).toFixed(3)})`;
      g.fillRect(0, 0, W, H);
    }
  }

  return { fit, draw, cellAt, layout };
}
