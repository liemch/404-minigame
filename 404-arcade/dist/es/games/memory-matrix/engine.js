/**
 * engine.js — luật chơi Memory Matrix 404 (expansion 16–20).
 *
 * Bàn cờ lật thẻ tìm cặp: 4 kích thước theo plan (4×3 dễ → 6×4 challenge),
 * deck sinh bằng Fisher–Yates (seed tùy chọn), mỗi biểu tượng đúng 2 thẻ.
 * Luật: tối đa 2 thẻ mở chưa match, khóa input khi đang so khớp, combo
 * khi match liên tiếp, hint mở nhanh toàn bộ thẻ nhưng trừ điểm.
 */

import { seededRand } from "../../core/utils.js";

/** Kích thước bàn theo màn: dễ → challenge, lặp lại 6×4 từ màn 4. */
export const LEVEL_SIZES = [
  [4, 3],
  [4, 4],
  [5, 4],
  [6, 4],
];

/** 12 biểu tượng nguyên bản (đủ cho bàn 6×4 = 12 cặp), không dùng emoji. */
export const ICONS = [
  { id: "portal", tone: "#20e3ff" },
  { id: "robot", tone: "#bfe4ff" },
  { id: "bolt", tone: "#7dff3e" },
  { id: "shield", tone: "#9a5cff" },
  { id: "star", tone: "#ff2ea6" },
  { id: "gem", tone: "#3b9dff" },
  { id: "heart", tone: "#ff4f64" },
  { id: "key", tone: "#ffd23f" },
  { id: "atom", tone: "#4df7d4" },
  { id: "ghost", tone: "#ff8ad2" },
  { id: "cube", tone: "#b07bff" },
  { id: "rocket", tone: "#f4f7ff" },
];

/** Điểm số theo plan: match + combo, hint trừ điểm, thưởng giờ khi xong màn. */
export const SCORE = {
  match: 100,
  comboStep: 30,
  hintCost: 150,
  timeBonusPerSec: 8,
};

/** Cấu hình một màn: kích thước bàn + thời gian (giảm dần theo màn). */
export function levelSpec(level) {
  const [cols, rows] = LEVEL_SIZES[Math.min(level - 1, LEVEL_SIZES.length - 1)];
  const pairs = (cols * rows) / 2;
  const tighten = Math.max(0.6, 1 - (level - 1) * 0.055);
  return { cols, rows, pairs, time: Math.round(pairs * 9 * tighten) };
}

/** Sinh bàn mới: mỗi icon đúng 2 thẻ, xáo Fisher–Yates (seed tùy chọn). */
export function makeBoard(level, seed = null) {
  const spec = levelSpec(level);
  const rand = seed === null ? Math.random : seededRand(seed);
  // Chọn ngẫu nhiên `pairs` icon từ deck 12
  const pool = ICONS.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const picked = pool.slice(0, spec.pairs);
  const deck = [...picked, ...picked];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return {
    level,
    cols: spec.cols,
    rows: spec.rows,
    pairs: spec.pairs,
    timeLimit: spec.time,
    timeLeft: spec.time,
    cards: deck.map((icon, i) => ({
      idx: i,
      icon,
      state: "down", // down | up | matched
      anim: 0, // 0 = úp, 1 = ngửa (nội suy trong index)
      flash: 0, // hiệu ứng match
    })),
    open: [], // tối đa 2 chỉ số thẻ đang mở chưa match
    lock: 0, // >0: đang xử lý cặp, khóa input
    found: 0,
  };
}

/**
 * Lật một thẻ. Trả về:
 *  null      — không hợp lệ (đang khóa / thẻ đã mở / đã match)
 *  "open"    — mở thẻ thứ nhất
 *  "match"   — cặp đúng (đã đánh dấu matched)
 *  "wrong"   — cặp sai (index tự đóng sau lock)
 */
export function flipCard(board, idx) {
  const card = board.cards[idx];
  if (!card || board.lock > 0 || card.state !== "down") return null;
  card.state = "up";
  board.open.push(idx);
  if (board.open.length < 2) return "open";

  const [a, b] = board.open.map((i) => board.cards[i]);
  if (a.icon.id === b.icon.id) {
    a.state = "matched";
    b.state = "matched";
    a.flash = 1;
    b.flash = 1;
    board.found += 1;
    board.open = [];
    return "match";
  }
  return "wrong"; // giữ 2 thẻ mở; index đặt board.lock rồi đóng lại
}

/** Đóng 2 thẻ mở sai cặp (gọi sau khi hết thời gian lock). */
export function closeOpen(board) {
  for (const i of board.open) {
    if (board.cards[i].state === "up") board.cards[i].state = "down";
  }
  board.open = [];
}

export const boardCleared = (board) => board.found >= board.pairs;
