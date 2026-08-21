/**
 * render.js — vẽ Pixel Golf 404 theo ảnh reference: nền vũ trụ tím
 * đầy sao pixel + cây / tinh thể / tượng đài neon, sân cỏ teal ca-rô
 * viền tường gạch tím pixel 3D, hố cát vàng pixel hóa, bumper vòng
 * neon hồng-vàng, cổng trượt laser đỏ có trụ, cặp cổng không gian
 * hồng–cyan kèm chevron chạy, lỗ cờ cyan phát sáng, bóng trắng bóng
 * loáng + khung ngắm xanh lá, mũi tên ngắm nét đứt.
 */

import { WORLD_W, WORLD_H } from "./courses.js";
import { pointInPoly, gateSegment, BALL_R, PORTAL_R } from "./engine.js";
import { seededRand } from "../../core/utils.js";

export function createGolfRenderer(canvas, box) {
  const g = canvas.getContext("2d");
  let dpr = 1;
  let scale = 1;
  let offX = 0;
  let offY = 0;

  function fit() {
    const rect = box.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    const k = Math.min(rect.width / WORLD_W, rect.height / WORLD_H);
    scale = k * dpr;
    offX = (rect.width * dpr - WORLD_W * scale) / 2;
    offY = (rect.height * dpr - WORLD_H * scale) / 2;
  }

  function toWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const px = (clientX - rect.left) * dpr;
    const py = (clientY - rect.top) * dpr;
    return { x: (px - offX) / scale, y: (py - offY) / scale };
  }

  function toClient(x, y) {
    const rect = canvas.getBoundingClientRect();
    return { cx: rect.left + (offX + x * scale) / dpr, cy: rect.top + (offY + y * scale) / dpr };
  }

  /* ---------- nền + sân (cache theo hố) ---------- */
  let bgCanvas = null;
  let bgHoleId = -1;

  function px(c, x, y, s, color) {
    c.fillStyle = color;
    c.fillRect(Math.round(x), Math.round(y), s, s);
  }

  /** Cây / tinh thể / hoa / tượng đài pixel-art ngoài sân (to như ảnh). */
  function drawPlant(c, x, y, rand) {
    const kind = rand();
    if (kind < 0.3) {
      // xương rồng / san hô pixel
      const col = ["#2fbf71", "#7a4fd0", "#c44fd0"][Math.floor(rand() * 3)];
      for (let i = 0; i < 5; i++) px(c, x, y - i * 5, 5, col);
      px(c, x - 5, y - 10, 5, col);
      px(c, x - 5, y - 15, 5, col);
      px(c, x + 5, y - 15, 5, col);
      px(c, x + 5, y - 20, 5, col);
      px(c, x, y - 25, 5, rand() > 0.5 ? "#ff5ad2" : "#20e3ff");
    } else if (kind < 0.55) {
      // cụm tinh thể
      const col = rand() > 0.5 ? "#20e3ff" : "#ff2ee6";
      px(c, x, y, 7, col);
      px(c, x + 5, y - 6, 7, col);
      px(c, x - 5, y - 4, 6, `${col}aa`);
      px(c, x + 2, y - 13, 6, "#ffffffcc");
      px(c, x + 8, y - 2, 5, `${col}88`);
    } else if (kind < 0.75) {
      // hoa neon nhỏ
      const col = ["#ffd23f", "#ff5ad2", "#4df77f", "#20e3ff"][Math.floor(rand() * 4)];
      px(c, x, y, 4, col);
      px(c, x - 4, y + 3, 4, `${col}88`);
      px(c, x + 4, y + 3, 4, `${col}88`);
      px(c, x, y - 4, 3, "#ffffffaa");
    } else {
      // tượng đài neon pixel (như ảnh: khối tối lõi phát sáng)
      const col = ["#d7ff3e", "#ff2ee6", "#20e3ff", "#ffd23f"][Math.floor(rand() * 4)];
      const w = 18 + Math.floor(rand() * 3) * 4;
      const h = 30 + Math.floor(rand() * 3) * 8;
      c.fillStyle = "#0a0820";
      c.fillRect(x - w / 2 - 3, y - h - 3, w + 6, h + 6);
      c.fillStyle = "#221d45";
      c.fillRect(x - w / 2, y - h, w, h);
      c.fillStyle = "#33296b";
      c.fillRect(x - w / 2, y - h, w, 5);
      // lõi phát sáng
      c.save();
      c.shadowColor = col;
      c.shadowBlur = 12;
      c.fillStyle = col;
      c.fillRect(x - 5, y - h + 8, 10, 10);
      c.restore();
      c.fillStyle = "#0d0a26";
      c.fillRect(x - 3, y - h + 10, 6, 6);
      // bệ
      c.fillStyle = "#2c2452";
      c.fillRect(x - w / 2 - 6, y - 5, w + 12, 5);
    }
  }

  /** Tô đa giác sân. */
  function pathPoly(c, poly) {
    c.beginPath();
    c.moveTo(poly[0][0], poly[0][1]);
    for (let i = 1; i < poly.length; i++) c.lineTo(poly[i][0], poly[i][1]);
    c.closePath();
  }

  function paintBg(def) {
    bgCanvas = document.createElement("canvas");
    bgCanvas.width = canvas.width;
    bgCanvas.height = canvas.height;
    const c = bgCanvas.getContext("2d");
    c.fillStyle = "#0b0728";
    c.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
    c.setTransform(scale, 0, 0, scale, offX, offY);

    const rand = seededRand(9000 + def.id * 77);

    // tinh vân tím mờ
    for (const [nx, ny, nr, col] of [
      [WORLD_W * 0.2, WORLD_H * 0.2, 300, "rgba(110,40,200,0.12)"],
      [WORLD_W * 0.85, WORLD_H * 0.75, 340, "rgba(200,40,180,0.09)"],
      [WORLD_W * 0.6, WORLD_H * 0.05, 260, "rgba(40,80,220,0.10)"],
    ]) {
      const ng = c.createRadialGradient(nx, ny, 10, nx, ny, nr);
      ng.addColorStop(0, col);
      ng.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = ng;
      c.fillRect(nx - nr, ny - nr, nr * 2, nr * 2);
    }

    // sao pixel dày đặc nhiều màu
    for (let i = 0; i < 230; i++) {
      const x = rand() * WORLD_W;
      const y = rand() * WORLD_H;
      const r = rand();
      const col =
        r > 0.92 ? "#ff5ad2" : r > 0.84 ? "#20e3ff" : r > 0.74 ? "#9a5cff" : r > 0.6 ? "rgba(220,230,255,0.8)" : "rgba(160,175,235,0.4)";
      c.fillStyle = col;
      const s = r > 0.88 ? 3 : 2;
      c.fillRect(x, y, s, s);
    }
    // vài sao chữ thập lấp lánh
    for (let i = 0; i < 12; i++) {
      const x = rand() * WORLD_W;
      const y = rand() * WORLD_H;
      const col = rand() > 0.5 ? "#cfe4ff" : "#ffb8f0";
      c.fillStyle = col;
      c.fillRect(x - 4, y, 10, 2);
      c.fillRect(x, y - 4, 2, 10);
    }

    // cây / tinh thể / tượng đài ngoài sân
    for (let i = 0; i < 46; i++) {
      const x = 26 + rand() * (WORLD_W - 52);
      const y = 40 + rand() * (WORLD_H - 60);
      if (pointInPoly(def.poly, x, y)) continue;
      let clear = true;
      for (const p of def.poly) {
        if (Math.hypot(p[0] - x, p[1] - y) < 34) clear = false;
      }
      if (clear) drawPlant(c, x, y, rand);
    }

    // ---- sân cỏ teal ca-rô ----
    c.save();
    pathPoly(c, def.poly);
    c.clip();
    c.fillStyle = "#0e6e63";
    c.fillRect(0, 0, WORLD_W, WORLD_H);
    const t = 26;
    c.fillStyle = "#128071";
    for (let y = 0; y < WORLD_H / t; y++) {
      for (let x = 0; x < WORLD_W / t; x++) {
        if ((x + y) % 2 === 0) c.fillRect(x * t, y * t, t, t);
      }
    }
    // đốm pixel cỏ
    for (let i = 0; i < 220; i++) {
      const x = rand() * WORLD_W;
      const y = rand() * WORLD_H;
      c.fillStyle = rand() > 0.5 ? "rgba(255,255,255,0.045)" : "rgba(4,34,30,0.3)";
      c.fillRect(x, y, 3, 3);
    }
    // bóng tối mép trong sân (inner shadow)
    pathPoly(c, def.poly);
    c.strokeStyle = "rgba(2,22,20,0.5)";
    c.lineWidth = 26;
    c.stroke();
    pathPoly(c, def.poly);
    c.strokeStyle = "rgba(3,30,27,0.35)";
    c.lineWidth = 48;
    c.stroke();
    c.restore();

    // ---- hố cát pixel hóa ----
    const S = 7; // cỡ pixel cát
    for (const s of def.sand || []) {
      c.save();
      pathPoly(c, def.poly);
      c.clip();
      const r2 = seededRand(s.x * 7 + s.y);
      const x0 = Math.floor((s.x - s.r - S) / S) * S;
      const y0 = Math.floor((s.y - s.r - S) / S) * S;
      for (let yy = y0; yy <= s.y + s.r + S; yy += S) {
        for (let xx = x0; xx <= s.x + s.r + S; xx += S) {
          const d = Math.hypot(xx + S / 2 - s.x, yy + S / 2 - s.y);
          // mép răng cưa pixel
          const edge = s.r - 4 + (r2() - 0.5) * 7;
          if (d > edge) continue;
          let col;
          if (d > edge - S) col = "#7c4e20"; // viền nâu đậm
          else if (d > edge - S * 2) col = "#b8842f";
          else col = r2() > 0.85 ? "#f0c886" : r2() > 0.12 ? "#dda757" : "#c69245";
          c.fillStyle = col;
          c.fillRect(xx, yy, S, S);
        }
      }
      // đốm cát
      c.fillStyle = "rgba(120,86,38,0.55)";
      for (let i = 0; i < 16; i++) {
        const a = r2() * Math.PI * 2;
        const rr = r2() * s.r * 0.7;
        c.fillRect(Math.round((s.x + Math.cos(a) * rr) / S) * S, Math.round((s.y + Math.sin(a) * rr) / S) * S, 4, 4);
      }
      c.fillStyle = "rgba(255,238,200,0.35)";
      for (let i = 0; i < 10; i++) {
        const a = r2() * Math.PI * 2;
        const rr = r2() * s.r * 0.6;
        c.fillRect(s.x + Math.cos(a) * rr, s.y + Math.sin(a) * rr, 3, 3);
      }
      c.restore();
    }

    // ---- tường gạch tím pixel 3D ----
    const wallSegs = [];
    for (let i = 0; i < def.poly.length; i++) {
      const a = def.poly[i];
      const b = def.poly[(i + 1) % def.poly.length];
      wallSegs.push([a[0], a[1], b[0], b[1]]);
    }
    for (const w of def.walls || []) wallSegs.push(w);
    const HW = 9; // nửa bề dày tường
    for (const [x1, y1, x2, y2] of wallSegs) {
      const len = Math.hypot(x2 - x1, y2 - y1);
      const a = Math.atan2(y2 - y1, x2 - x1);
      c.save();
      c.translate(x1, y1);
      c.rotate(a);
      // bóng đổ
      c.fillStyle = "rgba(3,3,14,0.6)";
      c.fillRect(-HW, HW - 3, len + HW * 2, 10);
      // quầng neon
      c.save();
      c.shadowColor = "rgba(154,92,255,0.65)";
      c.shadowBlur = 14;
      c.fillStyle = "#5b2ba8";
      c.fillRect(-HW, -HW, len + HW * 2, HW * 2);
      c.restore();
      // khối gạch pixel: 2 hàng so le
      const BW = 22;
      for (let row = 0; row < 2; row++) {
        const yTop = -HW + row * HW;
        const off = row % 2 === 0 ? 0 : BW / 2;
        for (let d = -HW - BW; d < len + HW; d += BW) {
          const bx = d + off;
          const shade = ((Math.round(bx / BW) + row) % 3 + 3) % 3;
          c.fillStyle = shade === 0 ? "#8a4fe0" : shade === 1 ? "#7038cc" : "#5b2ba8";
          c.fillRect(bx, yTop, BW - 2, HW - 2);
          // highlight đỉnh viên gạch
          c.fillStyle = "rgba(220,185,255,0.35)";
          c.fillRect(bx, yTop, BW - 2, 2);
        }
      }
      // viền sáng mép trên + tối mép dưới
      c.fillStyle = "rgba(230,200,255,0.55)";
      c.fillRect(-HW, -HW, len + HW * 2, 2);
      c.fillStyle = "rgba(16,4,40,0.7)";
      c.fillRect(-HW, HW - 2, len + HW * 2, 2);
      c.restore();
    }
    // đầu trụ vuông tại các đỉnh poly
    for (const [vx, vy] of def.poly) {
      c.fillStyle = "#3c1c74";
      c.fillRect(vx - HW - 2, vy - HW - 2, HW * 2 + 4, HW * 2 + 4);
      c.fillStyle = "#9a5ae8";
      c.fillRect(vx - HW + 1, vy - HW + 1, HW * 2 - 2, HW * 2 - 2);
      c.fillStyle = "#c9a2ff";
      c.fillRect(vx - 3, vy - 3, 6, 6);
    }

    // tee pad dưới điểm phát bóng
    const tee = def.tee;
    c.fillStyle = "rgba(6,50,46,0.85)";
    c.fillRect(tee.x - 17, tee.y - 17, 34, 34);
    c.strokeStyle = "rgba(32,227,255,0.5)";
    c.lineWidth = 2;
    c.strokeRect(tee.x - 17, tee.y - 17, 34, 34);
    c.fillStyle = "rgba(32,227,255,0.16)";
    c.fillRect(tee.x - 12, tee.y - 12, 24, 24);

    bgHoleId = def.id;
  }

  /* ---------- vẽ động ---------- */

  function drawPortal(cxy, color, time, flip) {
    const PR = PORTAL_R * 1.4; // vẽ to hơn hitbox cho giống ảnh
    g.save();
    g.translate(cxy.x, cxy.y);
    g.rotate(Math.sin(time * 1.4) * 0.08);
    // quầng mềm phía sau
    const halo = g.createRadialGradient(0, 0, 2, 0, 0, PR * 1.9);
    halo.addColorStop(0, `${color}4a`);
    halo.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = halo;
    g.fillRect(-PR * 2, -PR * 2, PR * 4, PR * 4);
    g.shadowColor = color;
    g.shadowBlur = 24;
    g.strokeStyle = color;
    g.lineWidth = 7.5;
    g.beginPath();
    g.ellipse(0, 0, PR * (flip ? 0.68 : 0.74), PR * 1.2, 0, 0, Math.PI * 2);
    g.stroke();
    g.shadowBlur = 10;
    g.strokeStyle = "rgba(255,255,255,0.9)";
    g.lineWidth = 2.2;
    g.beginPath();
    g.ellipse(0, 0, PR * 0.43, PR * 0.84, 0, 0, Math.PI * 2);
    g.stroke();
    // lõi tối
    g.shadowBlur = 0;
    g.fillStyle = "rgba(5,4,18,0.88)";
    g.beginPath();
    g.ellipse(0, 0, PR * 0.32, PR * 0.7, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  function draw(def, hs, ui, time) {
    if (!bgCanvas || bgHoleId !== def.id || bgCanvas.width !== canvas.width) paintBg(def);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(bgCanvas, 0, 0);
    g.setTransform(scale, 0, 0, scale, offX, offY);

    // bumper vòng neon + mũi tên quay
    for (const b of def.bumpers || []) {
      const R = b.r * 1.45; // đế vẽ to hơn hitbox cho giống ảnh
      g.save();
      g.translate(b.x, b.y);
      // đế tối
      g.fillStyle = "#120e2e";
      g.beginPath();
      g.arc(0, 0, R + 6, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "rgba(90,60,160,0.7)";
      g.lineWidth = 2.4;
      g.stroke();
      // vòng magenta phát sáng
      g.save();
      g.shadowColor = "#ff2ee6";
      g.shadowBlur = 18;
      g.strokeStyle = "#ff2ee6";
      g.lineWidth = 4.6;
      g.beginPath();
      g.arc(0, 0, R, 0, Math.PI * 2);
      g.stroke();
      g.restore();
      // vòng vàng đứt đoạn
      g.strokeStyle = "#ffd23f";
      g.lineWidth = 3;
      g.setLineDash([8, 7]);
      g.lineDashOffset = -time * 16;
      g.beginPath();
      g.arc(0, 0, R * 0.6, 0, Math.PI * 2);
      g.stroke();
      g.setLineDash([]);
      // lõi hồng phát sáng
      g.save();
      g.shadowColor = "#ff5ad2";
      g.shadowBlur = 16;
      g.fillStyle = "#ff5ad2";
      g.beginPath();
      g.arc(0, 0, R * 0.3, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#fff0fb";
      g.beginPath();
      g.arc(0, 0, R * 0.13, 0, Math.PI * 2);
      g.fill();
      g.restore();
      // mũi tên quay
      g.rotate(time * 1.6);
      g.fillStyle = "rgba(255,210,63,0.95)";
      for (let i = 0; i < 4; i++) {
        g.rotate(Math.PI / 2);
        g.beginPath();
        g.moveTo(R * 0.84, 0);
        g.lineTo(R * 0.6, -5.4);
        g.lineTo(R * 0.6, 5.4);
        g.closePath();
        g.fill();
      }
      g.restore();
    }

    // cổng trượt: trụ pixel + thanh laser đỏ + chevron chạy dọc
    for (const gate of def.gates || []) {
      for (const [px2, py2] of [[gate.x1, gate.y1], [gate.x2, gate.y2]]) {
        // trụ pixel tím có đèn đỏ
        g.fillStyle = "rgba(4,4,16,0.6)";
        g.fillRect(px2 - 10, py2 - 8, 20, 20);
        g.fillStyle = "#2a1656";
        g.fillRect(px2 - 10, py2 - 10, 20, 20);
        g.strokeStyle = "#9a5ae8";
        g.lineWidth = 2;
        g.strokeRect(px2 - 10, py2 - 10, 20, 20);
        g.fillStyle = "#c9a2ff";
        g.fillRect(px2 - 10, py2 - 10, 20, 3);
        g.save();
        g.shadowColor = "#ff3b4f";
        g.shadowBlur = 10;
        g.fillStyle = "#ff3b4f";
        g.fillRect(px2 - 3.4, py2 - 3.4, 6.8, 6.8);
        g.restore();
      }
      const [x1, y1, x2, y2] = gateSegment(gate, hs ? hs.time : time);
      g.save();
      g.shadowColor = "#ff2e4d";
      g.shadowBlur = 16;
      g.strokeStyle = "rgba(255,46,77,0.95)";
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(x1, y1);
      g.lineTo(x2, y2);
      g.stroke();
      g.shadowBlur = 0;
      g.strokeStyle = "rgba(255,240,244,0.95)";
      g.lineWidth = 1.8;
      g.stroke();
      // chevron chạy dọc thanh laser
      const glen = Math.hypot(x2 - x1, y2 - y1);
      if (glen > 18) {
        const ux = (x2 - x1) / glen;
        const uy = (y2 - y1) / glen;
        const kk = (time * 44) % 18;
        g.fillStyle = "rgba(255,150,165,0.95)";
        for (let dd = 6 + kk; dd < glen - 6; dd += 18) {
          const cx2 = x1 + ux * dd;
          const cy2 = y1 + uy * dd;
          g.save();
          g.translate(cx2, cy2);
          g.rotate(Math.atan2(uy, ux));
          g.beginPath();
          g.moveTo(-3.6, -4.6);
          g.lineTo(3.6, 0);
          g.lineTo(-3.6, 4.6);
          g.lineTo(-1, 0);
          g.closePath();
          g.fill();
          g.restore();
        }
      }
      g.restore();
      // mũi tên chỉ hướng trượt cạnh cổng
      const mx = (gate.x1 + gate.x2) / 2;
      const my = (gate.y1 + gate.y2) / 2;
      g.fillStyle = "rgba(255,120,140,0.85)";
      const vert = Math.abs(gate.y2 - gate.y1) > Math.abs(gate.x2 - gate.x1);
      for (const s of [-1, 1]) {
        g.beginPath();
        if (vert) {
          g.moveTo(mx + 17, my + s * 15);
          g.lineTo(mx + 23, my + s * 9);
          g.lineTo(mx + 29, my + s * 15);
        } else {
          g.moveTo(mx + s * 15, my + 17);
          g.lineTo(mx + s * 9, my + 23);
          g.lineTo(mx + s * 15, my + 29);
        }
        g.closePath();
        g.fill();
      }
    }

    // portal + chevron nối
    for (const p of def.portals || []) {
      drawPortal(p.a, "#ff2ee6", time, false);
      drawPortal(p.b, "#20e3ff", time, true);
      const dx = p.b.x - p.a.x;
      const dy = p.b.y - p.a.y;
      const d = Math.hypot(dx, dy);
      const ux = dx / d;
      const uy = dy / d;
      const k = ((time * 40) % 26);
      g.save();
      g.shadowColor = "#7ce6ff";
      g.shadowBlur = 8;
      g.fillStyle = "rgba(150,240,255,0.9)";
      for (let dd = PORTAL_R + 14 + k; dd < d - PORTAL_R - 12; dd += 26) {
        const cx2 = p.a.x + ux * dd;
        const cy2 = p.a.y + uy * dd;
        g.save();
        g.translate(cx2, cy2);
        g.rotate(Math.atan2(uy, ux));
        g.beginPath();
        g.moveTo(-5, -7);
        g.lineTo(5, 0);
        g.lineTo(-5, 7);
        g.lineTo(-1.4, 0);
        g.closePath();
        g.fill();
        g.restore();
      }
      g.restore();
    }

    // lỗ + cờ cyan phát sáng
    const hole = def.hole;
    g.save();
    g.shadowColor = "#20e3ff";
    g.shadowBlur = 14 + 5 * Math.sin(time * 3);
    g.fillStyle = "#03101c";
    g.beginPath();
    g.ellipse(hole.x, hole.y, 13, 9.6, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
    g.strokeStyle = "rgba(32,227,255,0.85)";
    g.lineWidth = 2.2;
    g.beginPath();
    g.ellipse(hole.x, hole.y, 13, 9.6, 0, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = "rgba(6,60,66,0.8)";
    g.lineWidth = 1.4;
    g.beginPath();
    g.ellipse(hole.x, hole.y, 9, 6.4, 0, 0, Math.PI * 2);
    g.stroke();
    // cột cờ trắng
    g.strokeStyle = "#eef4ff";
    g.lineWidth = 3.2;
    g.beginPath();
    g.moveTo(hole.x, hole.y - 2);
    g.lineTo(hole.x, hole.y - 56);
    g.stroke();
    // cờ cyan phát sáng vẫy
    const wave = Math.sin(time * 4) * 3;
    g.save();
    g.shadowColor = "#7ce6ff";
    g.shadowBlur = 14;
    g.fillStyle = "#aef4ff";
    g.beginPath();
    g.moveTo(hole.x - 1, hole.y - 56);
    g.lineTo(hole.x - 30, hole.y - 47 + wave);
    g.lineTo(hole.x - 1, hole.y - 38);
    g.closePath();
    g.fill();
    g.restore();

    if (!hs) return;
    const ball = hs.ball;

    // vệt bóng
    if (ui.trail) {
      for (let i = 0; i < ui.trail.length; i++) {
        const tr = ui.trail[i];
        g.fillStyle = `rgba(255,255,255,${(i / ui.trail.length) * 0.32})`;
        g.beginPath();
        g.arc(tr.x, tr.y, 3.2, 0, Math.PI * 2);
        g.fill();
      }
    }

    // khung ngắm xanh quanh bóng khi đứng yên
    if (!hs.moving && !hs.sunk) {
      const r = BALL_R + 8 + Math.sin(time * 4) * 1.5;
      g.save();
      g.shadowColor = "#3dff9c";
      g.shadowBlur = 8;
      g.strokeStyle = "#3dff9c";
      g.lineWidth = 2.4;
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        g.beginPath();
        g.moveTo(ball.x + sx * r, ball.y + sy * (r - 7));
        g.lineTo(ball.x + sx * r, ball.y + sy * r);
        g.lineTo(ball.x + sx * (r - 7), ball.y + sy * r);
        g.stroke();
      }
      g.restore();
    }

    // mũi tên ngắm nét đứt
    if (ui.aim && ui.aim.power > 0.03 && !hs.moving && !hs.sunk) {
      const { angle, power } = ui.aim;
      const len = 60 + power * 170;
      const ex = ball.x + Math.cos(angle) * len;
      const ey = ball.y + Math.sin(angle) * len;
      g.save();
      g.shadowColor = "rgba(255,255,255,0.6)";
      g.shadowBlur = 6;
      g.strokeStyle = "rgba(255,255,255,0.92)";
      g.lineWidth = 3.4;
      g.setLineDash([11, 9]);
      g.lineDashOffset = -time * 30;
      g.beginPath();
      g.moveTo(ball.x + Math.cos(angle) * 14, ball.y + Math.sin(angle) * 14);
      g.lineTo(ex, ey);
      g.stroke();
      g.setLineDash([]);
      // đầu mũi tên
      g.translate(ex, ey);
      g.rotate(angle);
      g.fillStyle = "rgba(255,255,255,0.95)";
      g.beginPath();
      g.moveTo(13, 0);
      g.lineTo(-5, -9);
      g.lineTo(-5, 9);
      g.closePath();
      g.fill();
      g.restore();
    }

    // bóng trắng bóng loáng phát sáng nhẹ
    if (!hs.sunk) {
      g.save();
      g.shadowColor = "rgba(0,0,0,0.55)";
      g.shadowBlur = 4;
      g.shadowOffsetY = 3;
      g.fillStyle = "#0a2a30";
      g.beginPath();
      g.ellipse(ball.x, ball.y + BALL_R * 0.7, BALL_R * 0.9, BALL_R * 0.42, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
      g.save();
      g.shadowColor = "#bfefff";
      g.shadowBlur = 12;
      const bg2 = g.createRadialGradient(ball.x - 2.4, ball.y - 3, 1, ball.x, ball.y, BALL_R + 1.5);
      bg2.addColorStop(0, "#ffffff");
      bg2.addColorStop(0.62, "#eaf2fc");
      bg2.addColorStop(1, "#9fb2cc");
      g.fillStyle = bg2;
      g.beginPath();
      g.arc(ball.x, ball.y, BALL_R + 0.5, 0, Math.PI * 2);
      g.fill();
      g.restore();
      g.fillStyle = "rgba(255,255,255,0.95)";
      g.beginPath();
      g.arc(ball.x - BALL_R * 0.32, ball.y - BALL_R * 0.4, BALL_R * 0.26, 0, Math.PI * 2);
      g.fill();
    }
  }

  return { fit, draw, toWorld, toClient };
}

/** Icon panel trái (cờ / gậy / par / sao / gió) — canvas nhỏ pixel. */
export function paintGolfIcon(canvas, kind) {
  canvas.width = 44;
  canvas.height = 44;
  const c = canvas.getContext("2d");
  c.scale(2, 2);
  if (kind === "flag") {
    c.strokeStyle = "#e8f0ff";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(8, 19);
    c.lineTo(8, 3);
    c.stroke();
    c.fillStyle = "#20e3ff";
    c.beginPath();
    c.moveTo(8, 3);
    c.lineTo(18, 7);
    c.lineTo(8, 11);
    c.closePath();
    c.fill();
  } else if (kind === "club") {
    c.strokeStyle = "#4df77f";
    c.lineWidth = 2.4;
    c.beginPath();
    c.moveTo(14, 3);
    c.lineTo(8, 16);
    c.stroke();
    c.fillStyle = "#4df77f";
    c.beginPath();
    c.roundRect(4, 15, 9, 4, 2);
    c.fill();
  } else if (kind === "par") {
    c.strokeStyle = "#9a5cff";
    c.lineWidth = 2;
    c.beginPath();
    c.arc(11, 11, 7.4, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    c.arc(11, 11, 3.6, 0, Math.PI * 2);
    c.stroke();
  } else if (kind === "star") {
    c.fillStyle = "#ff5ad2";
    c.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      const a2 = a + Math.PI / 5;
      c.lineTo(11 + Math.cos(a) * 8, 11 + Math.sin(a) * 8);
      c.lineTo(11 + Math.cos(a2) * 3.6, 11 + Math.sin(a2) * 3.6);
    }
    c.closePath();
    c.fill();
  } else if (kind === "wind") {
    c.strokeStyle = "#20e3ff";
    c.lineWidth = 2;
    for (const [y, len] of [[6, 10], [11, 14], [16, 8]]) {
      c.beginPath();
      c.moveTo(3, y);
      c.lineTo(3 + len, y);
      c.stroke();
      c.beginPath();
      c.arc(3 + len, y - 1.6, 1.8, 0.6, Math.PI * 1.8);
      c.stroke();
    }
  }
}
