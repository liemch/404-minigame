/**
 * input-manager.js — input dùng chung (bàn phím, con trỏ, vuốt, giữ).
 * Mỗi game tạo instance riêng trong mount() và PHẢI gọi destroy()
 * (hoặc dùng AbortSignal của context) để gỡ toàn bộ listener.
 */

/** Quản lý bàn phím theo e.code, tự preventDefault cho phím đã đăng ký. */
export function createKeyboard({ signal } = {}) {
  const bindings = [];
  const down = new Set();

  const onKeyDown = (e) => {
    // Nhường phím cho phần tử tương tác đang focus (nút, link, input...)
    const target = e.target;
    if (target instanceof Element && target.closest("button, a, input, select, textarea")) {
      return;
    }
    down.add(e.code);
    for (const b of bindings) {
      if (b.codes.has(e.code)) {
        e.preventDefault();
        if (!e.repeat || b.repeat) b.fn(e);
      }
    }
  };
  const onKeyUp = (e) => down.delete(e.code);
  const onBlur = () => down.clear();

  const opts = signal ? { signal } : undefined;
  window.addEventListener("keydown", onKeyDown, opts);
  window.addEventListener("keyup", onKeyUp, opts);
  window.addEventListener("blur", onBlur, opts);

  return {
    on(codes, fn, { repeat = false } = {}) {
      bindings.push({ codes: new Set(codes), fn, repeat });
    },
    isDown(code) {
      return down.has(code);
    },
    clearDown() {
      down.clear();
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

/** Bắt pointerdown (chuột trái / chạm). Trả về hàm gỡ listener. */
export function onPointerDown(el, fn) {
  const handler = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    fn(e);
  };
  el.addEventListener("pointerdown", handler);
  return () => el.removeEventListener("pointerdown", handler);
}

/** Theo dõi trạng thái "đang giữ" chuột/chạm trên một phần tử. */
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

/** Vuốt 4 hướng: fn nhận 'up'|'down'|'left'|'right'. Trả về hàm gỡ. */
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
