/**
 * storage.js — quản lý localStorage cho toàn arcade.
 * Lưu: điểm gần nhất + kỷ lục từng game, và lựa chọn âm thanh.
 * Mọi thao tác đều bọc try/catch để không vỡ khi localStorage bị chặn.
 */

const KEY = "arcade404:v1";

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    const data = raw ? JSON.parse(raw) : null;
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

function write(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* localStorage không khả dụng (chế độ riêng tư...) — bỏ qua */
  }
}

export const storage = {
  /** Âm thanh đang bật hay tắt (mặc định: bật). */
  getSound() {
    const data = read();
    return data.sound !== false;
  },

  setSound(on) {
    const data = read();
    data.sound = !!on;
    write(data);
  },

  /** Điểm của một game: { last, best }. */
  getScores(gameId) {
    const data = read();
    const s = data.scores?.[gameId];
    return {
      last: Number.isFinite(s?.last) ? s.last : 0,
      best: Number.isFinite(s?.best) ? s.best : 0,
    };
  },

  /** Lưu điểm sau một lượt chơi, trả về { last, best, isRecord }. */
  saveScore(gameId, score) {
    const value = Math.max(0, Math.floor(score));
    const data = read();
    if (!data.scores || typeof data.scores !== "object") data.scores = {};
    const prev = this.getScores(gameId);
    const isRecord = value > prev.best;
    const next = { last: value, best: isRecord ? value : prev.best };
    data.scores[gameId] = next;
    write(data);
    return { ...next, isRecord };
  },
};
