/**
 * input.js — trình quản lý input dùng chung (bàn phím, con trỏ, vuốt).
 * Mỗi game tạo instance riêng trong mount() và PHẢI gọi destroy()
 * khi bị hủy để gỡ toàn bộ listener (tránh memory leak).
 */

/** Quản lý bàn phím: đăng ký phím theo e.code, tự preventDefault. */
export function createKeyboard() {
  const bindings = [];
  const down = new Set();

  const onKeyDown = (e) => {
    // Khi focus đang ở nút/link (overlay, thanh công cụ...) thì nhường
    // phím cho phần tử đó — tránh việc Space vừa kích nút vừa nhảy.
    const target = e.target;
    if (
      target instanceof Element &&
      target.closest("button, a, input, select, textarea")
    ) {
      return;
    }
    down.add(e.code);
    for (const b of bindings) {
      if (b.codes.has(e.code)) {
        // Chặn hành vi mặc định (cuộn trang bằng Space/mũi tên...)
        e.preventDefault();
        if (!e.repeat || b.repeat) b.fn(e);
      }
    }
  };
  const onKeyUp = (e) => down.delete(e.code);
  const onBlur = () => down.clear();

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);

  return {
    /** on(['Space','KeyW'], fn) — gọi fn khi một trong các phím được nhấn. */
    on(codes, fn, { repeat = false } = {}) {
      bindings.push({ codes: new Set(codes), fn, repeat });
    },
    isDown(code) {
      return down.has(code);
    },
    destroy() {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      bindings.length = 0;
      down.clear();
    },
  };
}

/**
 * Bắt pointerdown (chuột trái / chạm) trên một phần tử.
 * Trả về hàm gỡ listener.
 */
export function onPointerDown(el, fn) {
  const handler = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    fn(e);
  };
  el.addEventListener("pointerdown", handler);
  return () => el.removeEventListener("pointerdown", handler);
}

/**
 * Theo dõi trạng thái "đang giữ" (giữ chuột/chạm) trên một phần tử.
 * Trả về { isHeld, off }.
 */
export function holdTracker(el) {
  let held = false;
  const downH = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    held = true;
  };
  const upH = () => {
    held = false;
  };
  el.addEventListener("pointerdown", downH);
  window.addEventListener("pointerup", upH);
  window.addEventListener("pointercancel", upH);
  return {
    isHeld: () => held,
    off() {
      el.removeEventListener("pointerdown", downH);
      window.removeEventListener("pointerup", upH);
      window.removeEventListener("pointercancel", upH);
    },
  };
}

/**
 * Nhận diện vuốt 4 hướng trên phần tử cảm ứng.
 * fn nhận 'up' | 'down' | 'left' | 'right'. Trả về hàm gỡ listener.
 */
export function onSwipe(el, fn, threshold = 24) {
  let sx = 0;
  let sy = 0;
  let activeId = null;

  const downH = (e) => {
    activeId = e.pointerId;
    sx = e.clientX;
    sy = e.clientY;
    e.preventDefault();
  };
  const moveH = (e) => {
    if (e.pointerId !== activeId) return;
    const dx = e.clientX - sx;
    const dy = e.clientY - sy;
    if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return;
    if (Math.abs(dx) > Math.abs(dy)) fn(dx > 0 ? "right" : "left");
    else fn(dy > 0 ? "down" : "up");
    // Cho phép vuốt liên tiếp không cần nhấc tay
    sx = e.clientX;
    sy = e.clientY;
  };
  const upH = (e) => {
    if (e.pointerId === activeId) activeId = null;
  };

  el.addEventListener("pointerdown", downH);
  el.addEventListener("pointermove", moveH);
  window.addEventListener("pointerup", upH);
  window.addEventListener("pointercancel", upH);

  return () => {
    el.removeEventListener("pointerdown", downH);
    el.removeEventListener("pointermove", moveH);
    window.removeEventListener("pointerup", upH);
    window.removeEventListener("pointercancel", upH);
  };
}
