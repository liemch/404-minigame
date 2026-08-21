/**
 * utils.js — hàm tiện ích dùng chung cho toàn package.
 */

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

export const lerp = (a, b, t) => a + (b - a) * t;

export const randRange = (min, max) => min + Math.random() * (max - min);

export const randInt = (min, max) => Math.floor(randRange(min, max + 1));

export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/** Điểm hiển thị kiểu arcade: đệm số 0 phía trước (vd: 002450). */
export const formatScore = (n, digits = 6) =>
  String(Math.max(0, Math.floor(n))).padStart(digits, "0");

/** Số có dấu phân tách hàng nghìn theo vi-VN (dùng trên card, kết quả). */
export const formatNumber = (n) => Math.max(0, Math.floor(n)).toLocaleString("vi-VN");

/** mm:ss cho đồng hồ trận đấu (vd 01:24). */
export const formatTime = (seconds) => {
  const s = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * Bộ sinh số ngẫu nhiên có seed (mulberry32) — dùng cho hình vẽ cần ổn
 * định giữa các lần render (preview card, texture, bố cục nền...).
 */
export function seededRand(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tạo phần tử DOM nhanh, gán class và text an toàn (không innerHTML). */
export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Tạo icon SVG tham chiếu sprite nội bộ trong shadow root. */
export function svgIcon(id, className = "icon") {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", className);
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS(NS, "use");
  use.setAttribute("href", `#${id}`);
  svg.appendChild(use);
  return svg;
}

/** Font mono dùng khi vẽ chữ trong canvas. */
export const MONO_FONT =
  '"JetBrains Mono", ui-monospace, Menlo, Consolas, "Liberation Mono", monospace';
