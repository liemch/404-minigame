/**
 * chart.js — bài "SYSTEM REPAIR" của Rhythm Hack.
 *
 * Nhạc chiptune được TỰ TỔNG HỢP bằng WebAudio và chart note được SINH
 * TỪ CÙNG MỘT PATTERN (riff lead / trống theo từng section) — bảo đảm
 * note luôn khớp với âm thanh nghe được. Không file audio ngoài.
 *
 * Xuất: SONG (config + judgement window theo plan) và buildSong() →
 * { notes: [{time, lane}], music: [{time, voice, freq, dur, vel}] }.
 */

export const SONG = {
  id: "system-repair-01",
  title: "SYSTEM REPAIR",
  bpm: 124,
  bars: 32, // ≈ 62 giây
  offsetMs: 0,
  windows: { perfect: 0.045, great: 0.09, good: 0.14 }, // ±s — theo plan
  scores: { perfect: 1000, great: 700, good: 400 },
  comboCap: 30, // hệ số nhân tối đa 1 + 30×0.02 = 1.6
};

const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

/* A minor pentatonic quanh A4; degree 0..7 */
const PENTA = [0, 3, 5, 7, 10, 12, 15, 17];
const LEAD_ROOT = 69; // A4
const BASS_ROOT = 45; // A2
/* vòng hợp âm: Am — F — C — G (dịch gốc bass) */
const PROG = [0, -4, 3, -2];

function sectionOf(bar) {
  if (bar < 4) return "intro";
  if (bar < 12) return "A";
  if (bar < 20) return "B";
  if (bar < 28) return "chorus";
  return "outro";
}

/* Riff lead 2 ô nhịp cho mỗi section: [beat, degree] */
const LEAD_RIFFS = {
  intro: [[], []],
  A: [
    [[0, 4], [1, 2], [2, 3], [3, 2]],
    [[0, 2], [1.5, 1], [2.5, 0]],
  ],
  B: [
    [[0, 4], [0.5, 4], [1, 3], [2, 2], [2.5, 3], [3, 4]],
    [[0, 5], [1, 4], [1.5, 3], [2, 2], [3, 1], [3.5, 0]],
  ],
  chorus: [
    [[0, 6], [0.5, 5], [1, 4], [1.5, 5], [2, 6], [2.5, 5], [3, 4], [3.5, 3]],
    [[0, 4], [0.5, 3], [1, 2], [1.5, 3], [2, 4], [3, 2], [3.5, 4]],
  ],
  outro: [
    [[0, 2], [2, 0]],
    [[0, 1]],
  ],
};

const KICKS = {
  intro: [0, 2],
  A: [0, 2],
  B: [0, 1.5, 2],
  chorus: [0, 1, 2, 3],
  outro: [0],
};

const SNARES = { intro: [3], A: [1, 3], B: [1, 3], chorus: [1, 3], outro: [] };

/**
 * Sinh toàn bộ sự kiện nhạc + note chart.
 * test=true → bài rút gọn 8 ô nhịp (~15.5s) cho QA tự động.
 */
export function buildSong({ test = false } = {}) {
  const bars = test ? 8 : SONG.bars;
  const beat = 60 / SONG.bpm;
  const music = [];
  const notes = [];

  for (let bar = 0; bar < bars; bar++) {
    const sec = test ? (bar < 2 ? "intro" : bar < 5 ? "A" : "B") : sectionOf(bar);
    const barT = bar * 4 * beat;
    const chord = PROG[bar % 4];

    // trống
    for (const b of KICKS[sec]) {
      music.push({ time: barT + b * beat, voice: "kick", dur: 0.12, vel: 1 });
    }
    for (const b of SNARES[sec]) {
      music.push({ time: barT + b * beat, voice: "snare", dur: 0.09, vel: 0.8 });
    }
    for (let h = 0; h < 8; h++) {
      if (sec === "intro" && h % 2 === 1) continue;
      music.push({
        time: barT + h * 0.5 * beat,
        voice: "hat",
        dur: 0.03,
        vel: h % 2 === 0 ? 0.42 : 0.22,
      });
    }

    // bass 8th theo hợp âm
    const bassSlots = sec === "intro" ? [0, 2] : sec === "outro" ? [0] : [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5];
    for (const b of bassSlots) {
      const oct = b % 1 === 0.5 ? 12 : 0;
      music.push({
        time: barT + b * beat,
        voice: "bass",
        freq: midiHz(BASS_ROOT + chord + oct),
        dur: beat * 0.42,
        vel: b % 1 === 0 ? 0.85 : 0.6,
      });
    }

    // lead riff → nhạc + NOTE CHART (lane = degree % 4, khớp cao độ)
    const riff = LEAD_RIFFS[sec][bar % 2];
    for (const [b, deg] of riff) {
      const t = barT + b * beat;
      music.push({
        time: t,
        voice: "lead",
        freq: midiHz(LEAD_ROOT + chord + PENTA[deg]),
        dur: beat * 0.5,
        vel: 0.8,
      });
      notes.push({ time: t, lane: deg % 4 });
    }

    // chorus: thêm note theo snare cho dày nhịp (tiếng snare có thật)
    if (sec === "chorus") {
      for (const b of SNARES[sec]) {
        const t = barT + b * beat;
        if (!riff.some(([rb]) => Math.abs(rb - b) < 0.26)) {
          notes.push({ time: t, lane: bar % 2 === 0 ? 1 : 2 });
        }
      }
    }
    // intro warm-up: 2 note theo kick ở ô nhịp 2-3
    if (sec === "intro" && bar >= 2) {
      notes.push({ time: barT, lane: 0 });
    }
  }

  notes.sort((a, b) => a.time - b.time);
  music.sort((a, b) => a.time - b.time);
  const duration = bars * 4 * beat;
  return { notes, music, duration, beat, bars };
}
