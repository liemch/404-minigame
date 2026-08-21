/**
 * events.js — phát CustomEvent từ host element <arcade-404>.
 * Sự kiện public: arcade:ready, arcade:game-start, arcade:game-over,
 * arcade:game-change, arcade:home, arcade:error.
 * Detail không chứa dữ liệu cá nhân (chỉ gameId, score, durationMs...).
 */

export function createEmitter(host) {
  return function emit(name, detail = {}, { cancelable = false } = {}) {
    const event = new CustomEvent(`arcade:${name}`, {
      detail,
      bubbles: true,
      composed: true, // thoát khỏi shadow DOM để trang đích nghe được
      cancelable,
    });
    host.dispatchEvent(event);
    return event;
  };
}
