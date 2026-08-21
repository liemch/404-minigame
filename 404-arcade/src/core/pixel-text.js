/**
 * pixel-text.js — vẽ chữ pixel bằng SVG (không cần font ngoài).
 * Dùng cho logo "404 ARCADE" (home) và "404 STRIKE" (start screen FPS).
 * Mỗi ký tự là lưới 5×7 render thành các ô <rect> với gradient neon.
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
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
};

const CHAR_W = 5;
const CHAR_H = 7;
const GAP = 1;

const textWidth = (text) => text.length * CHAR_W + (text.length - 1) * GAP;

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

/**
 * Render logo pixel nhiều dòng vào container.
 * lines: [{ text, scale, fill: [[offset,color],...] | 'mầu đơn' }]
 */
export function renderPixelLogo(container, lines, ariaLabel) {
  const widths = lines.map((l) => textWidth(l.text) * l.scale);
  const totalW = Math.max(...widths);
  const lineGap = 1.5;
  let totalH = 0;
  for (const l of lines) totalH += CHAR_H * l.scale;
  totalH += lineGap * (lines.length - 1);

  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${totalW.toFixed(2)} ${totalH.toFixed(2)}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", ariaLabel);

  const defs = document.createElementNS(NS, "defs");
  svg.appendChild(defs);

  let y = 0;
  lines.forEach((line, i) => {
    const g = document.createElementNS(NS, "g");
    if (Array.isArray(line.fill)) {
      const id = `pxg-${ariaLabel.replace(/\W+/g, "")}-${i}`;
      gradient(defs, id, line.fill);
      g.setAttribute("fill", `url(#${id})`);
    } else {
      g.setAttribute("fill", line.fill);
    }
    // Căn giữa theo chiều ngang bằng offset khi vẽ rect
    addLine(g, line.text, (totalW - widths[i]) / 2, y, line.scale);
    svg.appendChild(g);
    y += CHAR_H * line.scale + lineGap;
  });

  container.textContent = "";
  container.appendChild(svg);
  return svg;
}

/** Logo trang chọn game: "404 / ARCADE". */
export function renderArcadeLogo(container) {
  return renderPixelLogo(
    container,
    [
      {
        text: "404",
        scale: 1,
        fill: [
          ["0%", "#20e3ff"],
          ["52%", "#9a5cff"],
          ["100%", "#ff4fd8"],
        ],
      },
      {
        text: "ARCADE",
        scale: 0.46,
        fill: [
          ["0%", "#ff4fd8"],
          ["100%", "#ff8a5c"],
        ],
      },
    ],
    "404 Arcade"
  );
}

/** Logo 404 Strike: "404" tím + "STRIKE" trắng-cyan. */
export function renderStrikeLogo(container) {
  return renderPixelLogo(
    container,
    [
      {
        text: "404",
        scale: 1,
        fill: [
          ["0%", "#9a5cff"],
          ["100%", "#ff4fd8"],
        ],
      },
      {
        text: "STRIKE",
        scale: 0.52,
        fill: [
          ["0%", "#f4f7ff"],
          ["100%", "#20e3ff"],
        ],
      },
    ],
    "404 Strike"
  );
}
