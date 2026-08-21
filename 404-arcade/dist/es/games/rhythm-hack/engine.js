/**
 * engine.js — bộ chấm điểm Rhythm Hack (thuần logic, test bằng node).
 *
 * Judgement window theo plan (đưa vào config SONG): Perfect ±45ms,
 * Great ±90ms, Good ±140ms, ngoài đó = Miss. Scoring 1000/700/400/0,
 * combo multiplier có trần, accuracy theo trọng số. Mỗi note chỉ được
 * chấm MỘT lần; nhấn khi không có note trong cửa sổ → không tính gì
 * (key repeat không tạo hit sai).
 */

export const ACC_WEIGHT = { perfect: 1, great: 0.7, good: 0.4, miss: 0 };

export function createJudge(notes, config) {
  const state = {
    score: 0,
    combo: 0,
    maxCombo: 0,
    counts: { perfect: 0, great: 0, good: 0, miss: 0 },
    judged: 0,
    total: notes.length,
    accWeight: 0,
    done: [], // trạng thái từng note: undefined | judgement
  };

  const { windows, scores, comboCap } = config;

  function multiplier() {
    return 1 + Math.min(state.combo, comboCap) * 0.02;
  }

  function record(judgement) {
    state.counts[judgement] += 1;
    state.judged += 1;
    state.accWeight += ACC_WEIGHT[judgement];
    if (judgement === "miss") {
      state.combo = 0;
    } else {
      state.score += Math.round(scores[judgement] * multiplier());
      state.combo += 1;
      state.maxCombo = Math.max(state.maxCombo, state.combo);
    }
  }

  return {
    state,
    multiplier,

    /** Accuracy % theo trọng số trên số note ĐÃ chấm. */
    accuracy() {
      if (state.judged === 0) return 100;
      return (state.accWeight / state.judged) * 100;
    },

    /**
     * Người chơi nhấn lane tại songTime (đã cộng calibration offset).
     * Trả về { judgement, delta, index } hoặc null nếu không có note
     * trong cửa sổ Good (không phạt — chống key repeat / spam).
     */
    onKey(lane, t) {
      let best = -1;
      let bestAbs = Infinity;
      for (let i = 0; i < notes.length; i++) {
        if (state.done[i]) continue;
        const n = notes[i];
        if (n.lane !== lane) continue;
        const d = t - n.time;
        if (d < -windows.good) break; // notes sort theo time — quá sớm thì dừng
        const ad = Math.abs(d);
        if (ad <= windows.good && ad < bestAbs) {
          bestAbs = ad;
          best = i;
        }
      }
      if (best < 0) return null;
      const delta = t - notes[best].time;
      const ad = Math.abs(delta);
      const judgement = ad <= windows.perfect ? "perfect" : ad <= windows.great ? "great" : "good";
      state.done[best] = judgement;
      record(judgement);
      return { judgement, delta, index: best };
    },

    /** Quét các note đã trôi quá cửa sổ Good mà chưa được chấm → Miss. */
    tick(t) {
      const missed = [];
      for (let i = 0; i < notes.length; i++) {
        if (state.done[i]) continue;
        const n = notes[i];
        if (t - n.time > windows.good) {
          state.done[i] = "miss";
          record("miss");
          missed.push(i);
        } else if (n.time - t > windows.good) {
          break;
        }
      }
      return missed;
    },

    isDone(i) {
      return !!state.done[i];
    },
  };
}
