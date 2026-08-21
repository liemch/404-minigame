/**
 * keyboard.js — bàn phím QWERTY ảo + panel HEAT MAP cho Typing Rush 404.
 * Bàn phím sáng phím theo ký tự KẾ TIẾP cần gõ (highlight cyan như ảnh),
 * flash xanh/đỏ khi gõ đúng/sai. Heat map tô màu cool→hot theo tần suất.
 */

import { el } from "../../core/utils.js";

const ROWS = [
  [
    ["~", "`"], ["!", "1"], ["@", "2"], ["#", "3"], ["$", "4"], ["%", "5"],
    ["^", "6"], ["&", "7"], ["*", "8"], ["(", "9"], [")", "0"], ["_", "-"],
    ["+", "="], ["BACKSPACE", null, 2],
  ],
  [
    ["TAB", null, 1.6], ["Q"], ["W"], ["E"], ["R"], ["T"], ["Y"], ["U"],
    ["I"], ["O"], ["P"], ["{", "["], ["}", "]"], ["\\", null, 1.2],
  ],
  [
    ["CAPS LOCK", null, 2], ["A"], ["S"], ["D"], ["F"], ["G"], ["H"], ["J"],
    ["K"], ["L"], [";", ";"], ["'", "'"], ["ENTER", null, 1.9],
  ],
  [
    ["SHIFT", null, 2.5], ["Z"], ["X"], ["C"], ["V"], ["B"], ["N"], ["M"],
    [",", ","], [".", "."], ["?", "/"], ["SHIFT", null, 2.5],
  ],
];

/** key data-char cho một cap: chữ cái thường / số / ký hiệu chính. */
function charOf(cap) {
  const [label, sub] = cap;
  if (label.length === 1 && /[A-Z]/.test(label)) return label.toLowerCase();
  if (sub) return sub;
  return null;
}

export function buildKeyboard(container) {
  const kb = el("div", "tr-kb");
  const byChar = new Map();
  for (const row of ROWS) {
    const r = el("div", "tr-kb-row");
    for (const cap of row) {
      const [label, sub, flex] = cap;
      const key = el("div", "tr-key");
      if (flex) key.style.flex = `${flex} 1 0`;
      if (label.length > 1) key.classList.add("wide");
      if (sub && sub !== label.toLowerCase() && label.length === 1 && !/[A-Z]/.test(label)) {
        key.appendChild(el("span", "sup", label));
        key.appendChild(el("span", "main", sub));
      } else {
        key.appendChild(el("span", "main", label));
      }
      const ch = charOf(cap);
      if (ch) {
        key.dataset.char = ch;
        byChar.set(ch, key);
      }
      r.appendChild(key);
    }
    kb.appendChild(r);
  }
  // spacebar mảnh dưới cùng (dải sáng trong ảnh)
  const spaceRow = el("div", "tr-kb-row");
  const space = el("div", "tr-key tr-space");
  space.dataset.char = " ";
  byChar.set(" ", space);
  spaceRow.appendChild(space);
  kb.appendChild(spaceRow);
  container.appendChild(kb);

  let nextKey = null;

  return {
    setNext(ch) {
      if (nextKey) nextKey.classList.remove("next");
      nextKey = ch ? byChar.get(ch) || null : null;
      if (nextKey) nextKey.classList.add("next");
    },
    flash(ch, ok) {
      const key = byChar.get(ch);
      if (!key) return;
      const cls = ok ? "hit" : "miss";
      key.classList.remove("hit", "miss");
      void key.offsetWidth;
      key.classList.add(cls);
      setTimeout(() => key.classList.remove(cls), 190);
    },
  };
}

/** Heat map thu nhỏ: các ô theo layout phím chữ + thanh cool→hot. */
export function buildHeatmap(container) {
  const panel = el("div", "tr-heat");
  panel.appendChild(el("div", "tr-heat-title", "HEAT MAP"));
  const grid = el("div", "tr-heat-grid");
  const cells = new Map();
  const MINI = ["1234567890", "qwertyuiop", "asdfghjkl", "zxcvbnm"];
  for (const rowStr of MINI) {
    const r = el("div", "row");
    for (const ch of rowStr) {
      const cell = el("i");
      cells.set(ch, cell);
      r.appendChild(cell);
    }
    grid.appendChild(r);
  }
  panel.appendChild(grid);
  const legend = el("div", "tr-heat-legend");
  legend.appendChild(el("span", "", "COOL"));
  legend.appendChild(el("i"));
  legend.appendChild(el("span", "", "HOT"));
  panel.appendChild(legend);
  container.appendChild(panel);

  return {
    update(heat) {
      let max = 0;
      for (const [, v] of heat) max = Math.max(max, v);
      for (const [ch, cell] of cells) {
        const v = heat.get(ch) || 0;
        if (!max || !v) {
          cell.style.background = "rgba(40,60,120,0.35)";
          cell.style.boxShadow = "none";
          continue;
        }
        const k = v / max; // 0..1
        // cool xanh dương → tím → hồng → cam nóng
        const hue = 225 - k * 200;
        const light = 42 + k * 18;
        cell.style.background = `hsl(${hue} 90% ${light}%)`;
        cell.style.boxShadow = k > 0.6 ? `0 0 6px hsl(${hue} 90% ${light}%)` : "none";
      }
    },
  };
}
