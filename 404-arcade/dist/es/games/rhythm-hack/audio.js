/**
 * audio.js — trình phát nhạc chiptune của Rhythm Hack.
 *
 * ĐỒNG HỒ CHUẨN là audioContext.currentTime (theo plan — cấm setTimeout
 * làm đồng hồ nhịp): mọi sự kiện âm thanh được đặt lịch ở thời điểm
 * TUYỆT ĐỐI trên trục thời gian của AudioContext; setInterval chỉ làm
 * nhiệm vụ "nạp thêm hàng đợi" (lookahead scheduler chuẩn WebAudio).
 *
 * Pause = ctx.suspend() → currentTime đóng băng → chart không bao giờ
 * lệch khi resume. Máy không có WebAudio → fallback đồng hồ
 * performance.now (im lặng nhưng vẫn chơi được).
 */

const LOOKAHEAD = 0.24; // giây đặt lịch trước
const TICK_MS = 60;

export function createMusic(audioHandle, events) {
  // audioHandle: { ctx, master } từ audio-manager (null nếu không có WebAudio)
  const hasAudio = !!audioHandle;
  const ctx = audioHandle?.ctx || null;

  let bus = null;
  let noiseBuf = null;
  let startAt = 0; // mốc ctx.currentTime khi bài bắt đầu (beat 0)
  let nextIdx = 0;
  let timer = 0;
  let running = false;

  // fallback clock (không WebAudio)
  let fbStart = 0;
  let fbPausedAt = -1;

  function ensureBus() {
    if (!hasAudio || bus) return;
    bus = ctx.createGain();
    bus.gain.value = 0.5;
    bus.connect(audioHandle.master);
    const len = Math.floor(ctx.sampleRate * 0.4);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  /* ---------------- voice synth (đặt lịch tại thời điểm tuyệt đối) ---------------- */

  function osc(type, freq, t0, dur, vel, slideTo = null) {
    const o = ctx.createOscillator();
    const gn = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(1, freq), t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    gn.gain.setValueAtTime(vel, t0);
    gn.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(gn);
    gn.connect(bus);
    o.start(t0);
    o.stop(t0 + dur + 0.03);
  }

  function noiseHit(t0, dur, vel, from, to) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.setValueAtTime(from, t0);
    f.frequency.exponentialRampToValueAtTime(Math.max(60, to), t0 + dur);
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(vel, t0);
    gn.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f);
    f.connect(gn);
    gn.connect(bus);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  function scheduleEvent(e) {
    const t0 = startAt + e.time;
    switch (e.voice) {
      case "kick":
        osc("sine", 150, t0, e.dur, 0.95 * e.vel, 44);
        break;
      case "snare":
        noiseHit(t0, e.dur, 0.5 * e.vel, 2400, 900);
        osc("triangle", 210, t0, 0.06, 0.25 * e.vel, 140);
        break;
      case "hat":
        noiseHit(t0, e.dur, 0.32 * e.vel, 8500, 6000);
        break;
      case "bass":
        osc("square", e.freq, t0, e.dur, 0.3 * e.vel);
        break;
      case "lead":
        osc("square", e.freq, t0, e.dur, 0.22 * e.vel);
        osc("triangle", e.freq * 2.003, t0, e.dur * 0.85, 0.12 * e.vel);
        break;
    }
  }

  function pump() {
    if (!running) return;
    const now = ctx.currentTime - startAt;
    while (nextIdx < events.length && events[nextIdx].time <= now + LOOKAHEAD) {
      scheduleEvent(events[nextIdx]);
      nextIdx++;
    }
  }

  return {
    /** true nếu có WebAudio thật (đồng hồ audio); false = fallback im lặng. */
    get hasAudio() {
      return hasAudio;
    },

    /** Bắt đầu bài sau `delay` giây (đếm ngược intro dùng chung đồng hồ). */
    start(delay = 0) {
      running = true;
      nextIdx = 0;
      if (hasAudio) {
        ensureBus();
        if (ctx.state === "suspended") ctx.resume().catch(() => {});
        startAt = ctx.currentTime + delay;
        pump();
        timer = setInterval(pump, TICK_MS); // chỉ nạp hàng đợi — không phải đồng hồ
      } else {
        fbStart = performance.now() / 1000 + delay;
        fbPausedAt = -1;
      }
    },

    /** songTime hiện tại (giây, âm khi đang đếm ngược). */
    now() {
      if (hasAudio) return ctx.currentTime - startAt;
      if (fbPausedAt >= 0) return fbPausedAt - fbStart;
      return performance.now() / 1000 - fbStart;
    },

    pause() {
      if (hasAudio) {
        ctx.suspend().catch(() => {});
      } else if (fbPausedAt < 0) {
        fbPausedAt = performance.now() / 1000;
      }
    },

    resume() {
      if (hasAudio) {
        ctx.resume().catch(() => {});
      } else if (fbPausedAt >= 0) {
        fbStart += performance.now() / 1000 - fbPausedAt;
        fbPausedAt = -1;
      }
    },

    /** Dừng hẳn + dọn node (bus disconnect → mọi event đã đặt lịch câm). */
    stop() {
      running = false;
      clearInterval(timer);
      if (bus) {
        try {
          bus.disconnect();
        } catch {
          /* bỏ qua */
        }
        bus = null;
      }
      // KHÔNG close ctx — dùng chung với SFX toàn arcade; bảo đảm resume
      if (hasAudio && ctx.state === "suspended") ctx.resume().catch(() => {});
    },
  };
}
