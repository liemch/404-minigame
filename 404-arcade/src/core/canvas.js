/**
 * canvas.js — tạo canvas theo kích thước logic cố định.
 * Buffer nội bộ nhân theo devicePixelRatio (tối đa 2) để nét trên màn
 * hình retina; CSS được scale tự động để canvas luôn vừa khít container
 * (ResizeObserver). Game chỉ cần vẽ theo tọa độ logic (width × height).
 */

export function createCanvas(container, { width, height, className = "" } = {}) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.className = `game-canvas ${className}`.trim();

  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  container.appendChild(canvas);

  // Scale CSS để giữ nguyên tỉ lệ và nằm gọn trong container
  const fit = () => {
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    if (!cw || !ch) return;
    const s = Math.min(cw / width, ch / height);
    canvas.style.width = `${Math.floor(width * s)}px`;
    canvas.style.height = `${Math.floor(height * s)}px`;
  };
  fit();

  const ro = new ResizeObserver(fit);
  ro.observe(container);

  const stopMenu = (e) => e.preventDefault(); // chặn menu chuột phải/giữ lâu
  canvas.addEventListener("contextmenu", stopMenu);

  return {
    canvas,
    ctx,
    width,
    height,
    /** Đổi tọa độ sự kiện chuột/chạm sang tọa độ logic của canvas. */
    pos(e) {
      const r = canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - r.left) * width) / r.width,
        y: ((e.clientY - r.top) * height) / r.height,
      };
    },
    destroy() {
      ro.disconnect();
      canvas.removeEventListener("contextmenu", stopMenu);
      canvas.remove();
    },
  };
}
