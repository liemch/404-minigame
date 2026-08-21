/**
 * audio-manager.js — trình quản lý âm thanh cho một instance arcade.
 * Toàn bộ SFX tổng hợp bằng WebAudio (oscillator + noise), không file
 * ngoài, không CDN. AudioContext chỉ tạo SAU tương tác thật của người
 * dùng (unlock + userActivation) để tuân thủ chính sách autoplay.
 */

export function createAudio(storage, { defaultOn = false } = {}) {
  let ctx = null;
  let master = null;
  let noiseBuffer = null;
  let allowed = false;
  let enabled = storage.getSound(defaultOn);
  let volume = typeof storage.getPref("volume") === "number" ? storage.getPref("volume") : 0.8;

  const BASE_GAIN = 0.24;

  const gainValue = () => (enabled ? BASE_GAIN * volume : 0);

  function ensure() {
    if (!allowed) return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = gainValue();
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  }

  /** Một nốt: dạng sóng + tần số (trượt được) + phong bì âm lượng. */
  function tone({ type = "square", from = 440, to = null, dur = 0.12, vol = 0.5, delay = 0 }) {
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(from, 1), t0);
    if (to !== null && to !== from) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), t0 + dur);
    }
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  /** Tiếng ồn trắng qua lọc thông thấp — va chạm, súng, đổ vỡ. */
  function noise({ dur = 0.2, vol = 0.4, delay = 0, from = 1800, to = 250 }) {
    if (!noiseBuffer) {
      const len = Math.floor(ctx.sampleRate * 0.5);
      noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(from, t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(to, 40), t0 + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.03);
  }

  /* Bảng hiệu ứng: tên → công thức tổng hợp */
  const SFX = {
    /* UI + game 2D */
    ui:      () => tone({ from: 620, dur: 0.05, vol: 0.22 }),
    start:   () => { tone({ from: 440, dur: 0.09, vol: 0.3 }); tone({ from: 660, dur: 0.12, vol: 0.3, delay: 0.09 }); },
    jump:    () => tone({ from: 250, to: 540, dur: 0.16, vol: 0.32 }),
    coin:    () => { tone({ from: 880, dur: 0.07, vol: 0.28 }); tone({ from: 1174, dur: 0.1, vol: 0.26, delay: 0.06 }); },
    hit:     () => { noise({ dur: 0.28, vol: 0.5 }); tone({ type: "sawtooth", from: 220, to: 55, dur: 0.32, vol: 0.42 }); },
    squash:  () => { noise({ dur: 0.1, vol: 0.3, from: 2400, to: 500 }); tone({ from: 190, to: 120, dur: 0.09, vol: 0.3 }); },
    bad:     () => tone({ type: "sawtooth", from: 150, to: 85, dur: 0.26, vol: 0.42 }),
    combo:   () => { tone({ from: 988, dur: 0.06, vol: 0.24 }); tone({ from: 1319, dur: 0.09, vol: 0.22, delay: 0.05 }); },
    perfect: () => { tone({ from: 1047, dur: 0.06, vol: 0.26 }); tone({ from: 1568, dur: 0.1, vol: 0.24, delay: 0.05 }); },
    drop:    () => { tone({ type: "sine", from: 150, to: 70, dur: 0.14, vol: 0.5 }); noise({ dur: 0.07, vol: 0.18, from: 900, to: 200 }); },
    eat:     () => tone({ from: 520, to: 780, dur: 0.08, vol: 0.28 }),
    levelup: () => { tone({ from: 523, dur: 0.08, vol: 0.26 }); tone({ from: 659, dur: 0.08, vol: 0.26, delay: 0.08 }); tone({ from: 784, dur: 0.12, vol: 0.26, delay: 0.16 }); },
    over:    () => { tone({ type: "triangle", from: 392, dur: 0.15, vol: 0.32 }); tone({ type: "triangle", from: 311, dur: 0.15, vol: 0.32, delay: 0.14 }); tone({ type: "triangle", from: 233, dur: 0.3, vol: 0.32, delay: 0.28 }); },
    record:  () => { tone({ from: 659, dur: 0.09, vol: 0.3 }); tone({ from: 784, dur: 0.09, vol: 0.3, delay: 0.09 }); tone({ from: 1047, dur: 0.2, vol: 0.3, delay: 0.18 }); },

    /* 404 Strike */
    shoot:    () => { noise({ dur: 0.09, vol: 0.42, from: 3200, to: 400 }); tone({ type: "square", from: 120, to: 60, dur: 0.08, vol: 0.34 }); },
    dryfire:  () => tone({ from: 300, to: 200, dur: 0.05, vol: 0.2 }),
    reload:   () => { tone({ from: 320, dur: 0.05, vol: 0.24 }); tone({ from: 240, dur: 0.05, vol: 0.24, delay: 0.28 }); tone({ from: 520, dur: 0.06, vol: 0.26, delay: 0.9 }); },
    hitmark:  () => tone({ from: 1200, dur: 0.045, vol: 0.22 }),
    headshot: () => { tone({ from: 1568, dur: 0.06, vol: 0.3 }); tone({ from: 2093, dur: 0.08, vol: 0.24, delay: 0.05 }); },
    kill:     () => { tone({ type: "sawtooth", from: 300, to: 90, dur: 0.16, vol: 0.3 }); noise({ dur: 0.14, vol: 0.24, from: 1200, to: 200 }); },
    hurt:     () => { tone({ type: "sine", from: 140, to: 70, dur: 0.18, vol: 0.5 }); noise({ dur: 0.12, vol: 0.2, from: 700, to: 150 }); },
    botshot:  () => { noise({ dur: 0.06, vol: 0.16, from: 2200, to: 500 }); tone({ type: "square", from: 180, to: 110, dur: 0.05, vol: 0.14 }); },
    wave:     () => { tone({ from: 392, dur: 0.09, vol: 0.28 }); tone({ from: 523, dur: 0.09, vol: 0.28, delay: 0.1 }); tone({ from: 659, dur: 0.14, vol: 0.28, delay: 0.2 }); },
    pickup:   () => { tone({ from: 700, to: 1050, dur: 0.09, vol: 0.26 }); tone({ from: 1400, dur: 0.06, vol: 0.2, delay: 0.08 }); },
    empty:    () => tone({ from: 220, dur: 0.04, vol: 0.18 }),

    /* Expansion 6–10 (Portal Puzzle / Neon Drift / Cyber Defense / Rogue Arena / Rhythm Hack) */
    step:     () => tone({ type: "sine", from: 300, to: 250, dur: 0.045, vol: 0.14 }),
    push:     () => { noise({ dur: 0.09, vol: 0.2, from: 700, to: 180 }); tone({ type: "triangle", from: 140, to: 100, dur: 0.09, vol: 0.22 }); },
    portal:   () => { tone({ type: "sine", from: 320, to: 960, dur: 0.16, vol: 0.26 }); tone({ type: "sine", from: 960, to: 480, dur: 0.14, vol: 0.2, delay: 0.13 }); },
    switch:   () => { tone({ from: 520, dur: 0.05, vol: 0.24 }); tone({ from: 780, dur: 0.07, vol: 0.2, delay: 0.05 }); },
    denied:   () => tone({ type: "square", from: 170, to: 120, dur: 0.09, vol: 0.24 }),
    undo:     () => tone({ type: "sine", from: 620, to: 380, dur: 0.09, vol: 0.2 }),
    win:      () => { tone({ from: 523, dur: 0.09, vol: 0.28 }); tone({ from: 659, dur: 0.09, vol: 0.28, delay: 0.09 }); tone({ from: 784, dur: 0.09, vol: 0.28, delay: 0.18 }); tone({ from: 1047, dur: 0.22, vol: 0.3, delay: 0.27 }); },
    checkpoint: () => { tone({ from: 784, dur: 0.07, vol: 0.26 }); tone({ from: 1175, dur: 0.11, vol: 0.24, delay: 0.06 }); },
    nitro:    () => { noise({ dur: 0.24, vol: 0.2, from: 900, to: 2600 }); tone({ type: "sawtooth", from: 190, to: 420, dur: 0.24, vol: 0.16 }); },
    crash:    () => { noise({ dur: 0.24, vol: 0.42, from: 2000, to: 220 }); tone({ type: "sawtooth", from: 200, to: 70, dur: 0.26, vol: 0.3 }); },
    build:    () => { tone({ from: 340, dur: 0.06, vol: 0.24 }); tone({ from: 510, dur: 0.06, vol: 0.24, delay: 0.06 }); noise({ dur: 0.05, vol: 0.12, from: 1500, to: 500, delay: 0.02 }); },
    upgrade:  () => { tone({ from: 440, dur: 0.06, vol: 0.24 }); tone({ from: 587, dur: 0.06, vol: 0.24, delay: 0.06 }); tone({ from: 880, dur: 0.1, vol: 0.24, delay: 0.12 }); },
    sell:     () => { tone({ from: 660, to: 330, dur: 0.12, vol: 0.22 }); },
    zap:      () => { tone({ type: "square", from: 1150, to: 700, dur: 0.045, vol: 0.13 }); },
    boom:     () => { noise({ dur: 0.3, vol: 0.4, from: 1200, to: 90 }); tone({ type: "sine", from: 130, to: 45, dur: 0.3, vol: 0.34 }); },
    corehit:  () => { tone({ type: "sawtooth", from: 240, to: 90, dur: 0.3, vol: 0.4 }); noise({ dur: 0.2, vol: 0.24, from: 800, to: 150 }); },
    xp:       () => tone({ type: "sine", from: 900, to: 1350, dur: 0.06, vol: 0.14 }),
    hurt2:    () => { tone({ type: "sine", from: 160, to: 90, dur: 0.14, vol: 0.4 }); },
    miss:     () => tone({ type: "triangle", from: 260, to: 150, dur: 0.12, vol: 0.22 }),

    /* Void Runner 404 */
    vr_step:     () => noise({ dur: 0.045, vol: 0.09, from: 900, to: 300 }),
    vr_jump:     () => tone({ type: "sine", from: 280, to: 520, dur: 0.13, vol: 0.26 }),
    vr_walljump: () => { tone({ type: "sine", from: 360, to: 700, dur: 0.12, vol: 0.26 }); noise({ dur: 0.08, vol: 0.12, from: 1600, to: 500 }); },
    vr_land:     () => { noise({ dur: 0.09, vol: 0.2, from: 800, to: 200 }); tone({ type: "sine", from: 170, to: 110, dur: 0.08, vol: 0.2 }); },
    vr_slide:    () => noise({ dur: 0.26, vol: 0.16, from: 2200, to: 500 }),
    vr_wall:     () => { noise({ dur: 0.16, vol: 0.14, from: 1800, to: 700 }); tone({ type: "triangle", from: 500, to: 640, dur: 0.12, vol: 0.14 }); },
    vr_shard:    () => { tone({ from: 990, dur: 0.06, vol: 0.24 }); tone({ from: 1480, dur: 0.09, vol: 0.22, delay: 0.05 }); },
    vr_gate:     () => { tone({ from: 660, dur: 0.07, vol: 0.26 }); tone({ from: 880, dur: 0.07, vol: 0.26, delay: 0.07 }); tone({ from: 1320, dur: 0.12, vol: 0.24, delay: 0.14 }); },
    vr_boost:    () => { noise({ dur: 0.3, vol: 0.22, from: 700, to: 3200 }); tone({ type: "sawtooth", from: 220, to: 560, dur: 0.28, vol: 0.16 }); },
    vr_warn:     () => tone({ type: "square", from: 940, dur: 0.05, vol: 0.13 }),
    vr_zap:      () => { tone({ type: "sawtooth", from: 1200, to: 240, dur: 0.16, vol: 0.3 }); noise({ dur: 0.14, vol: 0.24, from: 3000, to: 400 }); },
    vr_fall:     () => { tone({ type: "sine", from: 420, to: 90, dur: 0.4, vol: 0.3 }); noise({ dur: 0.2, vol: 0.14, from: 900, to: 150, delay: 0.1 }); },
    vr_respawn:  () => { tone({ type: "sine", from: 300, to: 620, dur: 0.14, vol: 0.2 }); tone({ from: 830, dur: 0.07, vol: 0.16, delay: 0.12 }); },
    vr_finish:   () => { tone({ from: 587, dur: 0.09, vol: 0.28 }); tone({ from: 740, dur: 0.09, vol: 0.28, delay: 0.09 }); tone({ from: 988, dur: 0.09, vol: 0.28, delay: 0.18 }); tone({ from: 1319, dur: 0.24, vol: 0.3, delay: 0.27 }); },

    /* Expansion 11–15 — Brick Breaker */
    bb_paddle: () => tone({ type: "square", from: 340, to: 430, dur: 0.06, vol: 0.24 }),
    bb_wall:   () => tone({ type: "sine", from: 260, to: 220, dur: 0.04, vol: 0.12 }),
    bb_brick:  () => { tone({ from: 760, to: 900, dur: 0.06, vol: 0.24 }); noise({ dur: 0.06, vol: 0.14, from: 2600, to: 700 }); },
    bb_crack:  () => { tone({ type: "triangle", from: 420, to: 330, dur: 0.06, vol: 0.2 }); noise({ dur: 0.05, vol: 0.1, from: 1800, to: 500 }); },
    bb_steel:  () => tone({ type: "square", from: 190, to: 160, dur: 0.07, vol: 0.2 }),
    bb_power:  () => { tone({ from: 520, to: 880, dur: 0.11, vol: 0.26 }); tone({ from: 1100, dur: 0.07, vol: 0.2, delay: 0.1 }); },
    bb_laser:  () => tone({ type: "sawtooth", from: 1500, to: 500, dur: 0.07, vol: 0.14 }),
    bb_lose:   () => { tone({ type: "sine", from: 320, to: 90, dur: 0.32, vol: 0.34 }); noise({ dur: 0.16, vol: 0.16, from: 800, to: 150, delay: 0.05 }); },

    /* Expansion 11–15 — Pixel Golf */
    pg_hit:    () => { noise({ dur: 0.05, vol: 0.24, from: 2400, to: 900 }); tone({ type: "sine", from: 210, to: 150, dur: 0.07, vol: 0.3 }); },
    pg_wall:   () => tone({ type: "square", from: 300, to: 240, dur: 0.05, vol: 0.16 }),
    pg_sand:   () => noise({ dur: 0.14, vol: 0.22, from: 900, to: 200 }),
    pg_bumper: () => { tone({ from: 620, to: 900, dur: 0.07, vol: 0.26 }); tone({ from: 1200, dur: 0.05, vol: 0.18, delay: 0.05 }); },
    pg_sink:   () => { tone({ type: "sine", from: 500, to: 250, dur: 0.1, vol: 0.26 }); tone({ from: 660, dur: 0.08, vol: 0.24, delay: 0.1 }); tone({ from: 880, dur: 0.14, vol: 0.24, delay: 0.18 }); },
    pg_oob:    () => { tone({ type: "sawtooth", from: 240, to: 110, dur: 0.2, vol: 0.26 }); },

    /* Expansion 11–15 — Typing Rush */
    tr_key:    () => tone({ type: "square", from: 720, to: 660, dur: 0.03, vol: 0.1 }),
    tr_err:    () => tone({ type: "sawtooth", from: 200, to: 140, dur: 0.08, vol: 0.2 }),
    tr_word:   () => { tone({ from: 840, dur: 0.05, vol: 0.22 }); tone({ from: 1180, dur: 0.08, vol: 0.2, delay: 0.05 }); },
    tr_danger: () => { tone({ type: "sawtooth", from: 320, to: 90, dur: 0.3, vol: 0.34 }); noise({ dur: 0.2, vol: 0.2, from: 900, to: 150 }); },
  };

  return {
    /** Gọi trong handler tương tác thật đầu tiên để mở khóa. */
    unlock() {
      if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
      allowed = true;
      ensure();
    },

    get enabled() {
      return enabled;
    },

    setEnabled(on) {
      enabled = !!on;
      storage.setSound(enabled);
      if (master) master.gain.value = gainValue();
    },

    /** Âm lượng tổng 0..1 (slider trong pause menu 404 Strike). */
    get volume() {
      return volume;
    },

    setVolume(v) {
      volume = Math.min(1, Math.max(0, v));
      storage.setPref("volume", volume);
      if (master) master.gain.value = gainValue();
    },

    /**
     * AudioContext + master gain cho game cần tổng hợp nhạc nền riêng
     * (Rhythm Hack). Trả về null nếu chưa unlock / không hỗ trợ WebAudio.
     * Node của game PHẢI connect vào master để tôn trọng mute/volume,
     * và game tự dọn node của mình khi destroy.
     */
    getContext() {
      this.unlock();
      if (!ensure()) return null;
      return { ctx, master, isEnabled: () => enabled };
    },

    /** Phát hiệu ứng theo tên; an toàn khi chưa unlock hoặc đã tắt. */
    play(name) {
      if (!enabled) return;
      if (!ensure()) return;
      const fx = SFX[name];
      if (!fx) return;
      try {
        fx();
      } catch {
        /* WebAudio lỗi bất thường — không được làm vỡ game */
      }
    },

    /** Dọn dẹp khi destroy component. */
    dispose() {
      if (ctx) {
        ctx.close().catch(() => {});
        ctx = null;
        master = null;
        noiseBuffer = null;
      }
    },
  };
}
