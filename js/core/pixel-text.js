/**
 * pixel-text.js — vẽ chữ pixel bằng SVG (không cần font ngoài).
 * Dùng cho logo "404 ARCADE" ở hero: mỗi ký tự là lưới 5×7,
 * render thành các ô vuông <rect> với gradient neon.
 */

const NS = "http://www.w3.org/2000/svg";

/* Font pixel 5×7 — chỉ định nghĩa các ký tự cần dùng */
const GLYPHS = {
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
};

const CHAR_W = 5;
const CHAR_H = 7;
const GAP = 1; // khoảng cách giữa các ký tự (đơn vị pixel logic)

function textWidth(text) {
  return text.length * CHAR_W + (text.length - 1) * GAP;
}

/** Thêm các <rect> của một dòng chữ vào group, theo scale + offset. */
function addLine(group, text, offsetX, offsetY, scale) {
  let cursorX = 0;
  for (const ch of text) {
    const glyph = GLYPHS[ch];
    if (!glyph) {
      cursorX += CHAR_W + GAP;
      continue;
    }
    for (let row = 0; row < CHAR_H; row++) {
      for (let col = 0; col < CHAR_W; col++) {
        if (glyph[row][col] !== "1") continue;
        const rect = document.createElementNS(NS, "rect");
        rect.setAttribute("x", (offsetX + (cursorX + col) * scale).toFixed(3));
        rect.setAttribute("y", (offsetY + row * scale).toFixed(3));
        rect.setAttribute("width", (scale * 0.92).toFixed(3));
        rect.setAttribute("height", (scale * 0.92).toFixed(3));
        group.appendChild(rect);
      }
    }
    cursorX += CHAR_W + GAP;
  }
}

function gradient(defs, id, stops) {
  const grad = document.createElementNS(NS, "linearGradient");
  grad.setAttribute("id", id);
  grad.setAttribute("x1", "0");
  grad.setAttribute("y1", "0");
  grad.setAttribute("x2", "1");
  grad.setAttribute("y2", "0");
  for (const [offset, color] of stops) {
    const stop = document.createElementNS(NS, "stop");
    stop.setAttribute("offset", offset);
    stop.setAttribute("stop-color", color);
    grad.appendChild(stop);
  }
  defs.appendChild(grad);
}

/** Render logo "404 / ARCADE" vào container (thay thế fallback text). */
export function renderLogo(container) {
  const line1 = "404";
  const line2 = "ARCADE";
  const smallScale = 0.46;
  const lineGap = 1.5;

  const w1 = textWidth(line1);
  const w2 = textWidth(line2) * smallScale;
  const totalW = Math.max(w1, w2);
  const totalH = CHAR_H + lineGap + CHAR_H * smallScale;

  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${totalW} ${totalH.toFixed(2)}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "404 Arcade");

  const defs = document.createElementNS(NS, "defs");
  gradient(defs, "lg-404", [
    ["0%", "#3be8ff"],
    ["52%", "#b07bff"],
    ["100%", "#ff58c7"],
  ]);
  gradient(defs, "lg-arcade", [
    ["0%", "#ff58c7"],
    ["100%", "#ff8a5c"],
  ]);
  svg.appendChild(defs);

  const g1 = document.createElementNS(NS, "g");
  g1.setAttribute("fill", "url(#lg-404)");
  addLine(g1, line1, (totalW - w1) / 2, 0, 1);
  svg.appendChild(g1);

  const g2 = document.createElementNS(NS, "g");
  g2.setAttribute("fill", "url(#lg-arcade)");
  addLine(g2, line2, (totalW - w2) / 2, CHAR_H + lineGap, smallScale);
  svg.appendChild(g2);

  container.textContent = "";
  container.appendChild(svg);
}
