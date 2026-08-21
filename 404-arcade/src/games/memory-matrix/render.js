/**
 * render.js — vẽ Memory Matrix 404 theo ảnh reference: nền navy có mạch
 * điện + cột pixel + hành tinh viền cyan góc trái dưới; thẻ bo góc viền
 * neon (úp: hoa văn mạch + chữ 404 tím, mở: viền cyan, match: viền lime
 * + huy hiệu tick); biểu tượng nguyên bản vẽ tay bằng canvas.
 */

import { seededRand, MONO_FONT } from "../../core/utils.js";

/* Bảng màu viền thẻ úp — lặp ổn định theo chỉ số thẻ như reference */
const DOWN_TONES = ["#ff2ea6", "#9a5cff", "#ff2ea6", "#20e3ff", "#9a5cff", "#ff2ea6"];

export function createMatrixRenderer(canvas, box) {
  const g = canvas.getContext("2d");
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
    bgCanvas = null; // nền phụ thuộc kích thước → vẽ lại
  }

  /** Bố cục lưới thẻ: chừa sidebar phải (GỢI Ý / CHƠI LẠI) khi đủ rộng. */
  function layout(board) {
    const sideW = W >= 720 ? 218 : 0;
    const pad = 16;
    const areaX = pad + (W >= 900 ? 96 : 8); // chừa dải trang trí trái
    const areaW = W - sideW - areaX - pad;
    const areaH = H - pad * 2;
    const gap = Math.max(10, Math.min(16, areaW * 0.018));
    // Thẻ tỉ lệ ~1.28 (ngang) như reference, co để vừa khu vực
    let cw = (areaW - gap * (board.cols - 1)) / board.cols;
    let ch = cw / 1.28;
    const needH = ch * board.rows + gap * (board.rows - 1);
    if (needH > areaH) {
      ch = (areaH - gap * (board.rows - 1)) / board.rows;
      cw = ch * 1.28;
    }
    const gridW = cw * board.cols + gap * (board.cols - 1);
    const gridH = ch * board.rows + gap * (board.rows - 1);
    return {
      x0: areaX + (areaW - gridW) / 2,
      y0: pad + (areaH - gridH) / 2,
      cw,
      ch,
      gap,
    };
  }

  /** Hit test con trỏ → chỉ số thẻ (hoặc -1). */
  function hitTest(clientX, clientY, board) {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const L = layout(board);
    for (let r = 0; r < board.rows; r++) {
      for (let c = 0; c < board.cols; c++) {
        const cx = L.x0 + c * (L.cw + L.gap);
        const cy = L.y0 + r * (L.ch + L.gap);
        if (x >= cx && x <= cx + L.cw && y >= cy && y <= cy + L.ch) {
          return r * board.cols + c;
        }
      }
    }
    return -1;
  }

  /* ---------- nền tĩnh ---------- */
  let bgCanvas = null;

  function paintBg() {
    bgCanvas = document.createElement("canvas");
    bgCanvas.width = canvas.width;
    bgCanvas.height = canvas.height;
    const c = bgCanvas.getContext("2d");
    c.scale(dpr, dpr);
    const grad = c.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#070a20");
    grad.addColorStop(0.55, "#080b26");
    grad.addColorStop(1, "#05071a");
    c.fillStyle = grad;
    c.fillRect(0, 0, W, H);

    const rand = seededRand(1816);
    // hạt pixel rải rác
    for (let i = 0; i < 70; i++) {
      c.fillStyle = rand() > 0.8 ? "rgba(32,227,255,.4)" : "rgba(140,150,220,.22)";
      c.fillRect(rand() * W, rand() * H, 2, 2);
    }
    // cột pixel kiểu equalizer dọc mép trái
    for (let i = 0; i < 12; i++) {
      const bx = 14 + rand() * 74;
      const bh = 14 + rand() * 90;
      const by = 60 + rand() * (H - 140);
      c.fillStyle = `rgba(${rand() > 0.5 ? "60,80,190" : "90,60,200"},${(0.16 + rand() * 0.22).toFixed(2)})`;
      for (let y = 0; y < bh; y += 7) c.fillRect(bx, by + y, 5, 4);
    }
    // mạch điện mờ hai mép
    c.strokeStyle = "rgba(70,100,220,.14)";
    c.lineWidth = 1.4;
    for (let i = 0; i < 10; i++) {
      let x = rand() > 0.5 ? rand() * 110 : W - rand() * 110;
      let y = rand() * H;
      c.beginPath();
      c.moveTo(x, y);
      for (let k = 0; k < 3; k++) {
        const len = 22 + rand() * 60;
        if (rand() > 0.5) x += rand() > 0.5 ? len : -len;
        else y += rand() > 0.5 ? len : -len;
        c.lineTo(x, y);
      }
      c.stroke();
      c.fillStyle = "rgba(70,100,220,.3)";
      c.beginPath();
      c.arc(x, y, 2, 0, Math.PI * 2);
      c.fill();
    }
    // hành tinh viền cyan góc trái dưới
    const pr = Math.max(150, H * 0.42);
    const pg = c.createRadialGradient(-30, H + 40, pr * 0.3, -30, H + 40, pr);
    pg.addColorStop(0, "rgba(16,26,70,.9)");
    pg.addColorStop(0.82, "rgba(10,16,44,.85)");
    pg.addColorStop(1, "rgba(32,150,255,.28)");
    c.fillStyle = pg;
    c.beginPath();
    c.arc(-30, H + 40, pr, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "rgba(60,190,255,.4)";
    c.lineWidth = 2;
    c.beginPath();
    c.arc(-30, H + 40, pr, -Math.PI / 2, 0.1);
    c.stroke();
    // khung bracket cyan góc
    c.strokeStyle = "rgba(32,227,255,.32)";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(10, 46);
    c.lineTo(10, 12);
    c.lineTo(46, 12);
    c.stroke();
    c.beginPath();
    c.moveTo(10, H - 46);
    c.lineTo(10, H - 12);
    c.lineTo(46, H - 12);
    c.stroke();
  }

  /* ---------- biểu tượng ---------- */

  function drawIcon(id, tone, s) {
    g.save();
    g.shadowColor = tone;
    g.shadowBlur = s * 0.34;
    g.strokeStyle = tone;
    g.fillStyle = tone;
    g.lineWidth = Math.max(2.4, s * 0.1);
    switch (id) {
      case "portal": {
        g.lineWidth = s * 0.2;
        g.beginPath();
        g.ellipse(0, 0, s * 0.44, s * 0.56, -0.35, 0, Math.PI * 2);
        g.stroke();
        g.strokeStyle = "rgba(230,255,255,.85)";
        g.lineWidth = s * 0.06;
        g.beginPath();
        g.ellipse(0, 0, s * 0.3, s * 0.42, -0.35, 0, Math.PI * 2);
        g.stroke();
        // hạt pixel văng quanh cổng
        g.fillStyle = tone;
        g.fillRect(s * 0.5, -s * 0.3, s * 0.09, s * 0.09);
        g.fillRect(-s * 0.62, s * 0.2, s * 0.09, s * 0.09);
        g.fillRect(s * 0.34, s * 0.44, s * 0.07, s * 0.07);
        break;
      }
      case "robot": {
        g.shadowBlur = s * 0.16;
        // đầu robot trắng, mắt cyan
        g.fillStyle = "#eef3ff";
        g.beginPath();
        g.roundRect(-s * 0.44, -s * 0.34, s * 0.88, s * 0.62, s * 0.18);
        g.fill();
        g.fillStyle = "#0a1224";
        g.beginPath();
        g.roundRect(-s * 0.3, -s * 0.18, s * 0.6, s * 0.3, s * 0.1);
        g.fill();
        g.shadowColor = "#20e3ff";
        g.shadowBlur = s * 0.2;
        g.fillStyle = "#20e3ff";
        g.beginPath();
        g.arc(-s * 0.13, -s * 0.03, s * 0.065, 0, Math.PI * 2);
        g.arc(s * 0.13, -s * 0.03, s * 0.065, 0, Math.PI * 2);
        g.fill();
        g.shadowBlur = 0;
        // tai + antenna
        g.fillStyle = "#c9d6f2";
        g.fillRect(-s * 0.54, -s * 0.16, s * 0.1, s * 0.26);
        g.fillRect(s * 0.44, -s * 0.16, s * 0.1, s * 0.26);
        g.fillRect(-s * 0.03, -s * 0.5, s * 0.06, s * 0.16);
        // thân nhỏ
        g.fillStyle = "#dfe8fb";
        g.beginPath();
        g.roundRect(-s * 0.3, s * 0.32, s * 0.6, s * 0.24, s * 0.08);
        g.fill();
        break;
      }
      case "bolt": {
        g.lineWidth = s * 0.07;
        g.beginPath();
        g.arc(0, 0, s * 0.55, 0, Math.PI * 2);
        g.stroke();
        g.beginPath();
        g.moveTo(s * 0.12, -s * 0.46);
        g.lineTo(-s * 0.26, s * 0.08);
        g.lineTo(-s * 0.02, s * 0.08);
        g.lineTo(-s * 0.12, s * 0.46);
        g.lineTo(s * 0.26, -s * 0.08);
        g.lineTo(s * 0.02, -s * 0.08);
        g.closePath();
        g.fill();
        break;
      }
      case "shield": {
        g.beginPath();
        g.moveTo(0, -s * 0.52);
        g.lineTo(s * 0.42, -s * 0.3);
        g.lineTo(s * 0.42, s * 0.08);
        g.quadraticCurveTo(s * 0.42, s * 0.38, 0, s * 0.54);
        g.quadraticCurveTo(-s * 0.42, s * 0.38, -s * 0.42, s * 0.08);
        g.lineTo(-s * 0.42, -s * 0.3);
        g.closePath();
        g.fill();
        // hoa văn lục giác tối bên trong
        g.shadowBlur = 0;
        g.strokeStyle = "rgba(10,10,30,.55)";
        g.lineWidth = s * 0.045;
        for (const [hx, hy] of [[0, -0.1], [-0.2, 0.08], [0.2, 0.08], [0, 0.26]]) {
          g.beginPath();
          for (let i = 0; i < 6; i++) {
            const a = (Math.PI / 3) * i - Math.PI / 6;
            const px = hx * s + Math.cos(a) * s * 0.12;
            const py = hy * s + Math.sin(a) * s * 0.12;
            if (i === 0) g.moveTo(px, py);
            else g.lineTo(px, py);
          }
          g.closePath();
          g.stroke();
        }
        break;
      }
      case "star": {
        g.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = (Math.PI / 5) * i - Math.PI / 2;
          const r = i % 2 === 0 ? s * 0.58 : s * 0.24;
          g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        g.closePath();
        g.lineWidth = s * 0.08;
        g.stroke();
        g.globalAlpha = 0.35;
        g.fill();
        g.globalAlpha = 1;
        break;
      }
      case "gem": {
        g.beginPath();
        g.moveTo(0, -s * 0.55);
        g.lineTo(s * 0.4, -s * 0.1);
        g.lineTo(0, s * 0.55);
        g.lineTo(-s * 0.4, -s * 0.1);
        g.closePath();
        g.fill();
        g.shadowBlur = 0;
        g.fillStyle = "rgba(240,250,255,.75)";
        g.beginPath();
        g.moveTo(0, -s * 0.55);
        g.lineTo(s * 0.16, -s * 0.22);
        g.lineTo(-s * 0.16, -s * 0.22);
        g.closePath();
        g.fill();
        break;
      }
      case "heart": {
        g.beginPath();
        g.moveTo(0, s * 0.46);
        g.bezierCurveTo(-s * 0.62, s * 0.05, -s * 0.4, -s * 0.5, 0, -s * 0.18);
        g.bezierCurveTo(s * 0.4, -s * 0.5, s * 0.62, s * 0.05, 0, s * 0.46);
        g.fill();
        break;
      }
      case "key": {
        g.lineWidth = s * 0.1;
        g.beginPath();
        g.arc(-s * 0.22, -s * 0.18, s * 0.22, 0, Math.PI * 2);
        g.stroke();
        g.beginPath();
        g.moveTo(-s * 0.06, -s * 0.02);
        g.lineTo(s * 0.42, s * 0.42);
        g.stroke();
        g.beginPath();
        g.moveTo(s * 0.24, s * 0.24);
        g.lineTo(s * 0.38, s * 0.1);
        g.moveTo(s * 0.42, s * 0.42);
        g.lineTo(s * 0.54, s * 0.3);
        g.stroke();
        break;
      }
      case "atom": {
        g.lineWidth = s * 0.06;
        for (const rot of [0, Math.PI / 3, -Math.PI / 3]) {
          g.beginPath();
          g.ellipse(0, 0, s * 0.55, s * 0.2, rot, 0, Math.PI * 2);
          g.stroke();
        }
        g.beginPath();
        g.arc(0, 0, s * 0.1, 0, Math.PI * 2);
        g.fill();
        break;
      }
      case "ghost": {
        g.beginPath();
        g.arc(0, -s * 0.08, s * 0.4, Math.PI, 0);
        g.lineTo(s * 0.4, s * 0.4);
        for (let i = 0; i < 3; i++) {
          g.arc(s * 0.4 - s * 0.133 - i * s * 0.266, s * 0.4, s * 0.133, 0, Math.PI);
        }
        g.closePath();
        g.fill();
        g.shadowBlur = 0;
        g.fillStyle = "#0a1224";
        g.beginPath();
        g.arc(-s * 0.14, -s * 0.08, s * 0.08, 0, Math.PI * 2);
        g.arc(s * 0.14, -s * 0.08, s * 0.08, 0, Math.PI * 2);
        g.fill();
        break;
      }
      case "cube": {
        g.lineWidth = s * 0.07;
        const k = s * 0.34;
        g.strokeRect(-k, -k * 0.55, k * 1.7, k * 1.7);
        g.strokeRect(-k * 0.7, -k, k * 1.7, k * 1.7);
        g.beginPath();
        g.moveTo(-k, -k * 0.55); g.lineTo(-k * 0.7, -k);
        g.moveTo(k * 0.7, -k * 0.55); g.lineTo(k, -k);
        g.moveTo(k * 0.7, k * 1.15); g.lineTo(k, k * 0.7);
        g.moveTo(-k, k * 1.15); g.lineTo(-k * 0.7, k * 0.7);
        g.stroke();
        break;
      }
      case "rocket": {
        g.shadowBlur = s * 0.16;
        g.fillStyle = "#eef3ff";
        g.beginPath();
        g.moveTo(0, -s * 0.56);
        g.quadraticCurveTo(s * 0.3, -s * 0.1, s * 0.2, s * 0.3);
        g.lineTo(-s * 0.2, s * 0.3);
        g.quadraticCurveTo(-s * 0.3, -s * 0.1, 0, -s * 0.56);
        g.fill();
        g.fillStyle = "#ff2ea6";
        g.beginPath();
        g.moveTo(-s * 0.2, s * 0.06);
        g.lineTo(-s * 0.42, s * 0.4);
        g.lineTo(-s * 0.18, s * 0.3);
        g.closePath();
        g.moveTo(s * 0.2, s * 0.06);
        g.lineTo(s * 0.42, s * 0.4);
        g.lineTo(s * 0.18, s * 0.3);
        g.closePath();
        g.fill();
        g.shadowColor = "#20e3ff";
        g.fillStyle = "#20e3ff";
        g.beginPath();
        g.arc(0, -s * 0.14, s * 0.1, 0, Math.PI * 2);
        g.fill();
        g.beginPath();
        g.moveTo(-s * 0.09, s * 0.32);
        g.lineTo(0, s * 0.58);
        g.lineTo(s * 0.09, s * 0.32);
        g.closePath();
        g.fill();
        break;
      }
      default:
        break;
    }
    g.restore();
  }

  /* ---------- thẻ ---------- */

  function drawCardBack(cw, ch, idx) {
    // hoa văn mạch điện ổn định theo chỉ số thẻ
    const rand = seededRand(300 + idx * 17);
    g.strokeStyle = "rgba(122,88,255,.24)";
    g.lineWidth = 1.2;
    for (let i = 0; i < 7; i++) {
      let x = (rand() - 0.5) * cw * 0.8;
      let y = (rand() - 0.5) * ch * 0.8;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 2; k++) {
        const len = 8 + rand() * cw * 0.22;
        if (rand() > 0.5) x = Math.max(-cw * 0.44, Math.min(cw * 0.44, x + (rand() > 0.5 ? len : -len)));
        else y = Math.max(-ch * 0.42, Math.min(ch * 0.42, y + (rand() > 0.5 ? len : -len)));
        g.lineTo(x, y);
      }
      g.stroke();
      g.fillStyle = "rgba(122,88,255,.35)";
      g.beginPath();
      g.arc(x, y, 1.6, 0, Math.PI * 2);
      g.fill();
    }
    // chữ 404 tím mờ giữa thẻ
    g.font = `800 ${Math.round(ch * 0.3)}px ${MONO_FONT}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = "rgba(140,110,255,.7)";
    g.shadowColor = "rgba(140,110,255,.8)";
    g.shadowBlur = 10;
    g.fillText("404", 0, ch * 0.02);
    g.shadowBlur = 0;
  }

  function drawCard(card, x, y, cw, ch, revealAll, time) {
    // trạng thái hiển thị: anim > 0.5 → mặt ngửa
    const showUp = card.anim > 0.5 || (revealAll && card.state === "down");
    const sx = revealAll && card.state === "down" ? 1 : Math.abs(Math.cos(card.anim * Math.PI));
    g.save();
    g.translate(x + cw / 2, y + ch / 2);
    g.scale(Math.max(0.04, sx), 1);

    const matched = card.state === "matched";
    const tone = matched
      ? "#c8f542"
      : showUp
        ? "#3b9dff"
        : DOWN_TONES[card.idx % DOWN_TONES.length];

    // nền thẻ
    const bg = g.createLinearGradient(0, -ch / 2, 0, ch / 2);
    bg.addColorStop(0, "#141133");
    bg.addColorStop(1, "#0c0a24");
    g.fillStyle = bg;
    g.beginPath();
    g.roundRect(-cw / 2, -ch / 2, cw, ch, 12);
    g.fill();

    if (showUp) {
      const s = Math.min(cw, ch) * 0.62;
      const pulse = card.flash > 0 ? 1 + Math.sin(time * 16) * 0.04 : 1;
      g.save();
      g.scale(pulse, pulse);
      drawIcon(card.icon.id, card.icon.tone, s);
      g.restore();
    } else {
      drawCardBack(cw, ch, card.idx);
    }

    // viền neon + quầng
    g.save();
    g.shadowColor = tone;
    g.shadowBlur = matched ? 16 : 11;
    g.strokeStyle = tone;
    g.lineWidth = 2.6;
    g.beginPath();
    g.roundRect(-cw / 2 + 1.3, -ch / 2 + 1.3, cw - 2.6, ch - 2.6, 11);
    g.stroke();
    g.restore();

    // huy hiệu tick lime góc phải trên (thẻ đã match)
    if (matched) {
      const bx = cw / 2 - 4;
      const by = -ch / 2 + 4;
      g.save();
      g.shadowColor = "#c8f542";
      g.shadowBlur = 9;
      g.fillStyle = "#c8f542";
      g.beginPath();
      g.arc(bx, by, Math.max(9, ch * 0.1), 0, Math.PI * 2);
      g.fill();
      g.restore();
      g.strokeStyle = "#1c2606";
      g.lineWidth = 2.6;
      const r = Math.max(9, ch * 0.1);
      g.beginPath();
      g.moveTo(bx - r * 0.44, by + r * 0.02);
      g.lineTo(bx - r * 0.08, by + r * 0.4);
      g.lineTo(bx + r * 0.5, by - r * 0.34);
      g.stroke();
    }
    g.restore();
  }

  /* ---------- vẽ chính ---------- */

  function draw(state, time) {
    if (!bgCanvas) paintBg();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(bgCanvas, 0, 0);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const board = state.board;
    if (!board) return;

    const L = layout(board);
    for (let r = 0; r < board.rows; r++) {
      for (let c = 0; c < board.cols; c++) {
        const i = r * board.cols + c;
        drawCard(board.cards[i], L.x0 + c * (L.cw + L.gap), L.y0 + r * (L.ch + L.gap), L.cw, L.ch, state.hintT > 0, time);
      }
    }

    // con trỏ bàn phím: khung trắng nét đứt
    if (state.cursorOn) {
      const c = state.cursor % board.cols;
      const r = Math.floor(state.cursor / board.cols);
      g.save();
      g.strokeStyle = "rgba(244,247,255,.95)";
      g.lineWidth = 2.2;
      g.setLineDash([7, 6]);
      g.lineDashOffset = -time * 22;
      g.beginPath();
      g.roundRect(L.x0 + c * (L.cw + L.gap) - 5, L.y0 + r * (L.ch + L.gap) - 5, L.cw + 10, L.ch + 10, 14);
      g.stroke();
      g.restore();
    }

    // hiệu ứng vòng lan khi match
    for (const ring of state.fx) {
      const t = 1 - ring.life / ring.life0;
      const Lc = layout(board);
      const c = ring.idx % board.cols;
      const r = Math.floor(ring.idx / board.cols);
      g.save();
      g.globalAlpha = Math.max(0, ring.life / ring.life0);
      g.strokeStyle = "#c8f542";
      g.lineWidth = 3 * (1 - t) + 0.6;
      g.beginPath();
      g.roundRect(
        Lc.x0 + c * (Lc.cw + Lc.gap) - t * 16,
        Lc.y0 + r * (Lc.ch + Lc.gap) - t * 16,
        Lc.cw + t * 32,
        Lc.ch + t * 32,
        14
      );
      g.stroke();
      g.restore();
    }
  }

  return { fit, draw, hitTest, layout };
}
