/**
 * engine.js — Typing Rush 404: session gõ phím thuần (không DOM).
 *
 * - fold(): chuẩn hóa Unicode tiếng Việt nhất quán (NFD bỏ dấu, đ→d,
 *   lowercase) — người có IME gõ dấu trực tiếp hoặc gõ chữ gốc đều khớp.
 * - Target lock TẤT ĐỊNH: ký tự đầu khớp → chọn từ GẦN danger line
 *   nhất, hòa thì lane trái nhất rồi id nhỏ nhất.
 * - WPM chuẩn: (số ký tự đúng / 5) / phút. Raw WPM tính mọi ký tự gõ.
 * - Từ chạm danger line: gỡ từ + trừ mạng + reset combo ĐÚNG MỘT LẦN.
 * - Spawn theo lane, giữ khoảng cách dọc để chữ không chồng nhau.
 */

export const LANES = 6;
const MIN_GAP = 0.16; // khoảng cách dọc tối thiểu giữa 2 từ cùng lane (0..1)

/** Chuẩn hóa: NFD bỏ dấu kết hợp, đ→d, thường hóa. */
export function fold(str) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

/**
 * cfg = { fall, spawnEvery, maxTargets, wordPool, allowBackspace,
 *         adaptive, lives }
 */
export function createSession(cfg, rand = Math.random) {
  return {
    cfg,
    rand,
    words: [], // {id, text, folded, typed, lane, y, len}
    active: null,
    lives: cfg.lives ?? 3,
    score: 0,
    combo: 0,
    maxCombo: 0,
    typedCorrect: 0,
    typedWrong: 0,
    wordsDone: 0,
    elapsed: 0,
    spawnT: 0.6, // spawn sớm từ đầu tiên
    adaptFactor: 1,
    adaptT: 0,
    nextId: 1,
    events: [],
    keyHeat: new Map(),
  };
}

export function activeWord(sess) {
  return sess.words.find((w) => w.id === sess.active) || null;
}

/** Lane trống nhất: mọi từ trong lane phải đã rơi đủ xa (gap). */
function pickLane(sess) {
  let best = -1;
  let bestTop = -Infinity;
  for (let lane = 0; lane < LANES; lane++) {
    let top = Infinity; // từ CAO nhất (y nhỏ nhất) trong lane
    for (const w of sess.words) {
      if (w.lane === lane) top = Math.min(top, w.y);
    }
    const clearance = top === Infinity ? 999 : top;
    if (clearance > bestTop) {
      bestTop = clearance;
      best = lane;
    }
  }
  if (bestTop < MIN_GAP) return -1; // mọi lane còn từ sát mép trên
  return best;
}

function spawnWord(sess) {
  if (sess.words.length >= sess.cfg.maxTargets) return;
  const lane = pickLane(sess);
  if (lane < 0) return;
  const pool = sess.cfg.wordPool;
  // tránh trùng ký tự đầu với từ đang rơi nếu chọn được (giảm nhập nhằng)
  const startTaken = new Set(sess.words.filter((w) => w.typed === 0).map((w) => w.folded[0]));
  let text = pool[Math.floor(sess.rand() * pool.length)];
  for (let tries = 0; tries < 6; tries++) {
    if (!startTaken.has(fold(text)[0])) break;
    text = pool[Math.floor(sess.rand() * pool.length)];
  }
  sess.words.push({
    id: sess.nextId++,
    text,
    folded: fold(text),
    typed: 0,
    lane,
    y: 0,
    len: text.length,
  });
  sess.events.push({ type: "spawn", text });
}

/** Bước mô phỏng: rơi chữ + spawn + adaptive. */
export function stepSession(sess, dt) {
  if (sess.lives <= 0) return;
  sess.elapsed += dt;

  // adaptive: hiệu chỉnh nhẹ theo accuracy/WPM, có giới hạn
  if (sess.cfg.adaptive) {
    sess.adaptT += dt;
    if (sess.adaptT >= 5) {
      sess.adaptT = 0;
      const m = metrics(sess);
      if (m.acc > 92 && m.wpm > 24) sess.adaptFactor = Math.min(1.35, sess.adaptFactor + 0.06);
      else if (m.acc < 82 || m.wpm < 12) sess.adaptFactor = Math.max(0.8, sess.adaptFactor - 0.06);
    }
  }

  const speed = sess.cfg.fall * sess.adaptFactor;
  for (const w of sess.words) w.y += speed * dt;

  // chạm danger line — xử lý đúng một lần cho mỗi từ (gỡ ngay)
  for (let i = sess.words.length - 1; i >= 0; i--) {
    const w = sess.words[i];
    if (w.y >= 1) {
      sess.words.splice(i, 1);
      if (sess.active === w.id) sess.active = null;
      sess.lives -= 1;
      sess.combo = 0;
      sess.events.push({ type: "danger", text: w.text, lives: sess.lives });
      if (sess.lives <= 0) {
        sess.events.push({ type: "gameOver" });
        return;
      }
    }
  }

  sess.spawnT -= dt;
  if (sess.spawnT <= 0) {
    sess.spawnT = sess.cfg.spawnEvery / sess.adaptFactor;
    spawnWord(sess);
  }
}

/** Gõ một ký tự (đã là 1 char). Trả về kết quả để index phát SFX/FX. */
export function typeChar(sess, ch) {
  if (sess.lives <= 0) return { result: "ignore" };
  const fc = fold(ch);
  if (!fc || fc.length !== 1) return { result: "ignore" };
  sess.keyHeat.set(fc, (sess.keyHeat.get(fc) || 0) + 1);

  let target = activeWord(sess);

  if (!target) {
    // khóa target tất định: khớp ký tự đầu → gần danger nhất → lane trái → id
    const candidates = sess.words.filter((w) => w.folded[w.typed] === fc);
    if (!candidates.length) {
      sess.typedWrong += 1;
      sess.events.push({ type: "stray" });
      return { result: "stray" };
    }
    candidates.sort((a, b) => b.y - a.y || a.lane - b.lane || a.id - b.id);
    target = candidates[0];
    sess.active = target.id;
    target.typed += 1;
    sess.typedCorrect += 1;
    if (target.typed >= target.folded.length) return completeWord(sess, target);
    sess.events.push({ type: "lock", id: target.id });
    return { result: "lock", word: target };
  }

  if (target.folded[target.typed] === fc) {
    target.typed += 1;
    sess.typedCorrect += 1;
    if (target.typed >= target.folded.length) return completeWord(sess, target);
    return { result: "advance", word: target };
  }

  sess.typedWrong += 1;
  sess.combo = 0;
  sess.events.push({ type: "error", id: target.id });
  return { result: "error", word: target };
}

function completeWord(sess, target) {
  sess.words = sess.words.filter((w) => w.id !== target.id);
  sess.active = null;
  sess.wordsDone += 1;
  sess.combo += 1;
  sess.maxCombo = Math.max(sess.maxCombo, sess.combo);
  const gained = target.len * 10 + sess.combo * 5;
  sess.score += gained;
  sess.events.push({ type: "complete", id: target.id, text: target.text, gained, combo: sess.combo });
  return { result: "complete", word: target, gained };
}

/** Backspace (nếu config cho phép): lùi một ký tự của target. */
export function backspace(sess) {
  if (!sess.cfg.allowBackspace) return false;
  const target = activeWord(sess);
  if (!target || target.typed === 0) return false;
  target.typed -= 1;
  sess.typedCorrect = Math.max(0, sess.typedCorrect - 1);
  if (target.typed === 0) sess.active = null;
  return true;
}

/** WPM chuẩn ký-tự/5, raw WPM và accuracy. */
export function metrics(sess) {
  const minutes = Math.max(sess.elapsed, 1) / 60;
  const wpm = sess.typedCorrect / 5 / minutes;
  const rawWpm = (sess.typedCorrect + sess.typedWrong) / 5 / minutes;
  const total = sess.typedCorrect + sess.typedWrong;
  const acc = total === 0 ? 100 : (sess.typedCorrect / total) * 100;
  return { wpm: Math.round(wpm), rawWpm: Math.round(rawWpm), acc: Math.round(acc) };
}

export function drainEvents(sess) {
  const ev = sess.events;
  sess.events = [];
  return ev;
}
