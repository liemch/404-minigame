/**
 * loop.js — vòng lặp game dựa trên requestAnimationFrame.
 * dt được giới hạn 50ms để tránh "bước nhảy thời gian" khi tab bị
 * throttle. stop() hủy rAF — bắt buộc gọi khi pause/destroy.
 */

export function createLoop(step) {
  let rafId = 0;
  let last = 0;
  let running = false;

  const frame = (t) => {
    if (!running) return;
    const dt = Math.min((t - last) / 1000, 0.05);
    last = t;
    step(dt);
    rafId = requestAnimationFrame(frame);
  };

  return {
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      rafId = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(rafId);
    },
    get running() {
      return running;
    },
  };
}
