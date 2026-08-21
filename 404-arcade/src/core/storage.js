/**
 * storage.js — localStorage có namespace cho mỗi instance <arcade-404>.
 * Lưu: điểm (last/best) từng game, âm thanh, và túi prefs tùy ý
 * (settings của 404 Strike...). Mọi thao tác bọc try/catch để không vỡ
 * khi localStorage bị chặn (chế độ riêng tư, iframe sandbox...).
 */

export function createStorage(prefix = "arcade404") {
  const KEY = `${prefix}:v1`;

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
      /* localStorage không khả dụng — bỏ qua, game vẫn chạy */
    }
  }

  return {
    /** Âm thanh bật/tắt (mặc định: tắt theo plan — sound="off"). */
    getSound(defaultOn = false) {
      const data = read();
      return typeof data.sound === "boolean" ? data.sound : defaultOn;
    },

    setSound(on) {
      const data = read();
      data.sound = !!on;
      write(data);
    },

    /** Điểm của một game: { last, best }. */
    getScores(gameId) {
      const s = read().scores?.[gameId];
      return {
        last: Number.isFinite(s?.last) ? s.last : 0,
        best: Number.isFinite(s?.best) ? s.best : 0,
      };
    },

    /** Lưu điểm sau một lượt, trả về { last, best, isRecord }. */
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

    /** Xóa toàn bộ điểm cao (public API resetHighScores). */
    resetHighScores() {
      const data = read();
      delete data.scores;
      write(data);
    },

    /** Túi prefs tùy ý theo tên (vd settings 404 Strike). */
    getPref(name, fallback = null) {
      const p = read().prefs?.[name];
      return p === undefined ? fallback : p;
    },

    setPref(name, value) {
      const data = read();
      if (!data.prefs || typeof data.prefs !== "object") data.prefs = {};
      data.prefs[name] = value;
      write(data);
    },
  };
}
