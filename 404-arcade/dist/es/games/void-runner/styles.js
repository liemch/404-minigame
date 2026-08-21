/**
 * styles.js — CSS của VOID RUNNER 404 (inject vào shadow root khi mount).
 * Bám theo ảnh reference: HUD 3 panel trái + timer giữa + 4 nút phải,
 * start screen logo nghiêng + panel điều khiển, pause 2 cột + cài đặt.
 */

export const VOID_RUNNER_CSS = /* css */ `
.vr-root {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: #120c2a;
  font-family: var(--font-mono);
  user-select: none;
  -webkit-user-select: none;
  --vr-cyan: #22e4ff;
  --vr-magenta: #e42cff;
  --vr-pink: #ff3fd4;
  --vr-lime: #b7f232;
  --vr-red: #ff2e4d;
  --vr-violet: #8b5bff;
}

.vr-root canvas.vr-canvas {
  position: absolute;
  inset: 0;
  touch-action: none;
}

/* ============================ HUD ============================ */

.vr-hud {
  position: absolute;
  inset: 0;
  z-index: 10;
  pointer-events: none;
  transition: opacity 0.25s ease;
}

.vr-hud.dim { opacity: 0.28; }
.vr-hud .clickable { pointer-events: auto; }

/* --- Trên giữa: tiêu đề + timer + checkpoint --- */
.vr-top {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
  min-width: 300px;
}

.vr-title {
  font-size: 1.28rem;
  font-weight: 800;
  font-style: italic;
  letter-spacing: 0.14em;
  color: #fff;
  text-shadow:
    0 0 14px color-mix(in srgb, var(--vr-violet) 85%, transparent),
    0 0 34px color-mix(in srgb, var(--vr-magenta) 45%, transparent);
}

.vr-time {
  margin-top: 2px;
  font-size: 1.72rem;
  font-weight: 800;
  line-height: 1.05;
  color: #fff;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 0 16px color-mix(in srgb, var(--vr-cyan) 55%, transparent);
}

.vr-cp {
  margin-top: 3px;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--vr-lime);
  font-size: 0.74rem;
  font-weight: 800;
  letter-spacing: 0.22em;
}

.vr-cp .d { font-size: 0.6rem; }
.vr-cp .t::before, .vr-cp .t::after { content: "  —  "; opacity: 0.6; }

.vr-penalty {
  position: absolute;
  top: 34px;
  left: calc(100% + 12px);
  color: var(--vr-red);
  font-weight: 800;
  font-size: 1.1rem;
  opacity: 0;
  text-shadow: 0 0 12px color-mix(in srgb, var(--vr-red) 70%, transparent);
}

.vr-penalty.show { animation: vrPenalty 1.4s ease; }

@keyframes vrPenalty {
  0% { opacity: 0; transform: translateY(6px); }
  15% { opacity: 1; transform: none; }
  70% { opacity: 1; }
  100% { opacity: 0; transform: translateY(-8px); }
}

/* --- Trên trái: 3 panel chỉ số --- */
.vr-tl {
  position: absolute;
  top: 12px;
  left: 12px;
  display: flex;
  flex-direction: column;
  gap: 9px;
  width: 148px;
}

.vr-panel {
  border: 1px solid;
  border-radius: 6px;
  background: color-mix(in srgb, #060a1c 82%, transparent);
  padding: 7px 10px 8px;
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
}

.vr-panel .head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.vr-panel .lbl {
  font-size: 0.6rem;
  font-weight: 800;
  letter-spacing: 0.18em;
}

.vr-panel .head .icon { width: 15px; height: 15px; flex: none; }

.vr-panel .big {
  display: flex;
  align-items: baseline;
  gap: 5px;
  margin-top: 2px;
}

.vr-panel .big .val {
  font-size: 1.5rem;
  font-weight: 800;
  color: #fff;
  line-height: 1.05;
  font-variant-numeric: tabular-nums;
}

.vr-panel .big .unit { font-size: 0.72rem; color: var(--text-1); font-weight: 700; }

.vr-panel .segs { display: flex; gap: 3px; margin-top: 6px; }

.vr-panel .segs i {
  flex: 1;
  height: 7px;
  background: color-mix(in srgb, #fff 12%, transparent);
  border-radius: 1px;
}

.vr-panel.speed { border-color: color-mix(in srgb, var(--vr-red) 65%, transparent); box-shadow: 0 0 14px color-mix(in srgb, var(--vr-red) 12%, transparent); }
.vr-panel.speed .lbl, .vr-panel.speed .head .icon { color: var(--vr-red); }
.vr-panel.speed.hot .big .val { color: #ffd7de; text-shadow: 0 0 12px var(--vr-red); }

.vr-panel.energy { border-color: color-mix(in srgb, var(--vr-cyan) 60%, transparent); box-shadow: 0 0 14px color-mix(in srgb, var(--vr-cyan) 12%, transparent); }
.vr-panel.energy .lbl, .vr-panel.energy .head .icon { color: var(--vr-cyan); }
.vr-panel.energy .segs i.on { background: var(--vr-cyan); box-shadow: 0 0 7px color-mix(in srgb, var(--vr-cyan) 65%, transparent); }
.vr-panel.energy.low .big .val { color: var(--vr-red); animation: vrBlink 0.6s steps(1) infinite; }

.vr-panel.combo { border-color: color-mix(in srgb, var(--vr-magenta) 62%, transparent); box-shadow: 0 0 14px color-mix(in srgb, var(--vr-magenta) 12%, transparent); }
.vr-panel.combo .lbl, .vr-panel.combo .head .icon { color: var(--vr-pink); }
.vr-panel.combo .big .val { color: var(--vr-pink); text-shadow: 0 0 12px color-mix(in srgb, var(--vr-magenta) 60%, transparent); }
.vr-panel.combo .segs i.on { background: var(--vr-pink); box-shadow: 0 0 7px color-mix(in srgb, var(--vr-magenta) 65%, transparent); }
.vr-panel.combo.pop { animation: vrPop 0.28s ease; }

@keyframes vrPop { 40% { transform: scale(1.06); } }
@keyframes vrBlink { 50% { opacity: 0.45; } }

/* --- Trên phải: 4 nút --- */
.vr-tr {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.vr-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 136px;
  min-height: 36px;
  padding: 7px 14px;
  border: 1px solid color-mix(in srgb, #fff 32%, transparent);
  border-radius: 6px;
  background: color-mix(in srgb, #060a1c 80%, transparent);
  color: #e8ecf8;
  font-family: inherit;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  cursor: pointer;
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  transition: border-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
}

.vr-btn:hover {
  border-color: var(--vr-cyan);
  color: #fff;
  box-shadow: 0 0 14px color-mix(in srgb, var(--vr-cyan) 25%, transparent);
}

.vr-btn .icon { width: 15px; height: 15px; flex: none; }

/* --- Toast / hiệu ứng --- */
.vr-toasts {
  position: absolute;
  top: 32%;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  pointer-events: none;
}

.vr-toast {
  padding: 5px 18px;
  border: 1px solid;
  border-radius: 4px;
  background: color-mix(in srgb, #060a1c 80%, transparent);
  font-size: 0.86rem;
  font-weight: 800;
  letter-spacing: 0.22em;
  animation: vrToast 1.5s ease forwards;
}

.vr-toast.cyan { color: var(--vr-cyan); border-color: color-mix(in srgb, var(--vr-cyan) 60%, transparent); }
.vr-toast.lime { color: var(--vr-lime); border-color: color-mix(in srgb, var(--vr-lime) 60%, transparent); }
.vr-toast.magenta { color: var(--vr-pink); border-color: color-mix(in srgb, var(--vr-magenta) 60%, transparent); }
.vr-toast.red { color: var(--vr-red); border-color: color-mix(in srgb, var(--vr-red) 60%, transparent); }
.vr-toast.gold { color: var(--gold, #ffd23f); border-color: color-mix(in srgb, #ffd23f 60%, transparent); }

@keyframes vrToast {
  0% { opacity: 0; transform: translateY(10px) scale(0.94); }
  14% { opacity: 1; transform: none; }
  72% { opacity: 1; }
  100% { opacity: 0; transform: translateY(-12px); }
}

.vr-vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(ellipse at center, transparent 48%, color-mix(in srgb, var(--vr-red) 62%, transparent) 128%);
  opacity: 0;
  transition: opacity 0.14s ease;
}

.vr-blackout {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: #05030f;
  opacity: 0;
  transition: opacity 0.22s ease;
}

.vr-blackout.on { opacity: 1; }

/* ============================ Màn hình ============================ */

.vr-screen {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(14px, 3vw, 40px);
  overflow-y: auto;
}

.vr-screen[data-screen="start"] {
  background: linear-gradient(90deg,
    color-mix(in srgb, #05040f 78%, transparent) 0%,
    color-mix(in srgb, #05040f 30%, transparent) 46%,
    color-mix(in srgb, #05040f 55%, transparent) 100%);
}

.vr-screen[data-screen="pause"],
.vr-screen[data-screen="over"],
.vr-screen[data-screen="notice"] {
  background: color-mix(in srgb, #05030f 62%, transparent);
}

/* --- Góc trái trên (start) --- */
.vr-corner {
  position: absolute;
  top: 16px;
  left: 18px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.vr-back {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 1px solid color-mix(in srgb, #fff 30%, transparent);
  background: color-mix(in srgb, #060a1c 82%, transparent);
  color: #fff;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.vr-back:hover { border-color: var(--vr-cyan); color: var(--vr-cyan); }
.vr-back .icon { width: 17px; height: 17px; }

.vr-brand { line-height: 1.05; }
.vr-brand b { display: block; font-size: 0.95rem; letter-spacing: 0.1em; color: #fff; }
.vr-brand span { font-size: 0.56rem; letter-spacing: 0.42em; color: var(--text-1); }

/* --- Start layout --- */
.vr-start {
  display: grid;
  grid-template-columns: minmax(330px, 1.3fr) minmax(250px, 300px);
  gap: clamp(20px, 5vw, 90px);
  width: min(1060px, 100%);
  align-items: center;
}

.vr-logo { line-height: 0.98; margin-bottom: 16px; }

.vr-logo .l1, .vr-logo .l2 {
  font-size: clamp(2.9rem, 6.4vw, 4.6rem);
  font-weight: 800;
  font-style: italic;
  letter-spacing: 0.03em;
  color: #fff;
  text-shadow:
    0 0 22px color-mix(in srgb, var(--vr-violet) 60%, transparent),
    3px 3px 0 color-mix(in srgb, var(--vr-magenta) 36%, transparent);
}

.vr-logo .l3 { margin-top: 10px; }

.vr-logo .l3 span {
  display: inline-block;
  padding: 2px 20px 5px;
  border: 3px solid var(--vr-magenta);
  border-radius: 6px;
  font-size: clamp(2.2rem, 4.6vw, 3.4rem);
  font-weight: 800;
  font-style: italic;
  background: linear-gradient(100deg, var(--vr-violet), var(--vr-magenta) 70%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  box-shadow:
    0 0 26px color-mix(in srgb, var(--vr-magenta) 45%, transparent),
    inset 0 0 18px color-mix(in srgb, var(--vr-magenta) 25%, transparent);
}

.vr-tagline {
  color: var(--text-1);
  font-size: 0.98rem;
  line-height: 1.55;
  margin-bottom: 12px;
}

.vr-best-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 12px;
  margin-bottom: 14px;
  border: 1px solid color-mix(in srgb, var(--gold, #ffd23f) 55%, transparent);
  border-radius: 5px;
  color: var(--gold, #ffd23f);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.14em;
}

.vr-best-chip .icon { width: 14px; height: 14px; }

.vr-opt-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: min(380px, 100%);
  margin-bottom: 18px;
}

.vr-opt-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 46px;
  padding: 8px 14px;
  border: 1px solid color-mix(in srgb, #fff 22%, transparent);
  border-radius: 7px;
  background: color-mix(in srgb, #060a1c 84%, transparent);
  color: #fff;
  font-family: inherit;
  cursor: pointer;
  transition: border-color 0.15s ease;
}

.vr-opt-row:hover { border-color: var(--vr-cyan); }

.vr-opt-row .lb {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 0.74rem;
  font-weight: 800;
  letter-spacing: 0.18em;
  color: var(--text-1);
}

.vr-opt-row .lb .icon { width: 16px; height: 16px; color: var(--vr-cyan); }
.vr-opt-row .val { margin-left: auto; font-size: 0.86rem; font-weight: 700; color: #fff; }
.vr-opt-row .chev { color: var(--vr-magenta); font-size: 0.9rem; }

.vr-cta {
  display: block;
  width: min(400px, 100%);
  margin: 4px 0 16px;
  padding: 3px;
  border: none;
  cursor: pointer;
  clip-path: polygon(16px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%, 0 16px);
  background: linear-gradient(115deg, var(--vr-violet), var(--vr-magenta));
  box-shadow: 0 0 38px color-mix(in srgb, var(--vr-magenta) 50%, transparent);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.vr-cta:hover { transform: translateY(-2px); box-shadow: 0 0 54px color-mix(in srgb, var(--vr-magenta) 70%, transparent); }
.vr-cta:active { transform: none; }

.vr-cta .in {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 16px 20px;
  clip-path: polygon(15px 0, 100% 0, 100% calc(100% - 15px), calc(100% - 15px) 100%, 0 100%, 0 15px);
  background: linear-gradient(180deg,
    color-mix(in srgb, var(--vr-violet) 72%, black 6%),
    color-mix(in srgb, var(--vr-violet) 38%, black 42%));
  color: #fff;
  font-size: 1.18rem;
  font-weight: 800;
  letter-spacing: 0.24em;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.6);
}

.vr-cta .in .icon { width: 26px; height: 26px; }

.vr-start-actions { display: flex; flex-wrap: wrap; gap: 10px; }

.vr-abtn {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 10px 18px;
  border: 1px solid color-mix(in srgb, #fff 26%, transparent);
  border-radius: 7px;
  background: color-mix(in srgb, #060a1c 84%, transparent);
  color: #edf1ff;
  font-family: inherit;
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.vr-abtn:hover { border-color: var(--vr-cyan); box-shadow: 0 0 14px color-mix(in srgb, var(--vr-cyan) 22%, transparent); }
.vr-abtn .icon { width: 16px; height: 16px; }
.vr-abtn.gold { border-color: color-mix(in srgb, #ffd23f 55%, transparent); color: #ffd23f; }
.vr-abtn.gold:hover { border-color: #ffd23f; box-shadow: 0 0 16px color-mix(in srgb, #ffd23f 30%, transparent); }

/* Panel điều khiển */
.vr-ctl {
  border: 1px solid color-mix(in srgb, #fff 22%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, #060a1c 84%, transparent);
  padding: 14px 18px;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.vr-ctl h3 {
  text-align: center;
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.3em;
  color: #fff;
  padding-bottom: 10px;
  margin-bottom: 4px;
  border-bottom: 1px solid color-mix(in srgb, #fff 14%, transparent);
}

.vr-ctl .row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 8.5px 0;
}

.vr-ctl .row + .row { border-top: 1px solid color-mix(in srgb, #fff 7%, transparent); }
.vr-ctl .keys { display: flex; gap: 4px; min-width: 118px; flex: none; align-items: center; }

.vr-ctl kbd {
  min-width: 24px;
  padding: 3px 7px;
  border: 1px solid color-mix(in srgb, #fff 34%, transparent);
  border-bottom-width: 2px;
  border-radius: 4px;
  background: color-mix(in srgb, #fff 7%, transparent);
  color: #fff;
  font-family: inherit;
  font-size: 0.68rem;
  font-weight: 700;
  text-align: center;
}

.vr-ctl .keys .mouse { width: 15px; height: 20px; color: #fff; }
.vr-ctl .keys b { color: #fff; font-size: 0.74rem; }
.vr-ctl .desc { color: var(--text-1); font-size: 0.78rem; }

/* --- Pause --- */
.vr-pause {
  width: min(780px, 100%);
  border: 1px solid color-mix(in srgb, var(--vr-cyan) 55%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, #070c1e 92%, transparent);
  box-shadow: 0 0 48px color-mix(in srgb, var(--vr-cyan) 16%, transparent), var(--shadow-pop);
  padding: clamp(18px, 3vw, 30px) clamp(18px, 3.2vw, 34px) 14px;
  position: relative;
  animation: vrPanelIn 0.22s ease;
}

@keyframes vrPanelIn {
  from { opacity: 0; transform: translateY(10px) scale(0.985); }
}

.vr-pause::before,
.vr-pause::after {
  content: "";
  position: absolute;
  width: 52px;
  height: 14px;
  border: 2px solid var(--vr-cyan);
}

.vr-pause::before { top: -2px; left: 30px; border-bottom: none; border-right: none; }
.vr-pause::after { bottom: -2px; right: 30px; border-top: none; border-left: none; }

.vr-pause-title {
  text-align: center;
  font-size: 1.6rem;
  font-weight: 800;
  letter-spacing: 0.3em;
  color: #fff;
  text-shadow: 0 0 22px color-mix(in srgb, var(--vr-cyan) 50%, transparent);
  margin-bottom: 18px;
}

.vr-pause-cols {
  display: grid;
  grid-template-columns: 1fr 1.18fr;
  gap: clamp(16px, 3vw, 34px);
}

.vr-menu { display: flex; flex-direction: column; gap: 9px; }

.vr-menu-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 46px;
  padding: 8px 16px;
  border: 1px solid color-mix(in srgb, #fff 24%, transparent);
  border-radius: 7px;
  background: color-mix(in srgb, #0a1226 84%, transparent);
  color: #edf1ff;
  font-family: inherit;
  font-size: 0.74rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.vr-menu-btn:hover { border-color: var(--vr-cyan); box-shadow: 0 0 14px color-mix(in srgb, var(--vr-cyan) 25%, transparent); }
.vr-menu-btn .icon { width: 16px; height: 16px; flex: none; }
.vr-menu-btn .dmd { margin-left: auto; color: var(--vr-lime); width: 14px; height: 14px; }

.vr-menu-btn.primary {
  background: linear-gradient(180deg, #14b6d8, #0a7d9c);
  border-color: color-mix(in srgb, var(--vr-cyan) 80%, transparent);
  color: #fff;
  box-shadow: 0 0 20px color-mix(in srgb, var(--vr-cyan) 40%, transparent);
}

.vr-settings h3 {
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.26em;
  color: #fff;
  border-bottom: 1px solid color-mix(in srgb, #fff 14%, transparent);
  padding-bottom: 8px;
  margin-bottom: 13px;
}

.vr-set { margin-bottom: 13px; }

.vr-set .lbl {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 0.66rem;
  font-weight: 800;
  letter-spacing: 0.16em;
  color: var(--text-1);
  margin-bottom: 7px;
}

.vr-set .lbl .icon { width: 15px; height: 15px; color: #cfe6ff; }

.vr-set.toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.vr-set.toggle .lbl { margin-bottom: 0; }

.vr-slider-row { display: flex; align-items: center; gap: 12px; }
.vr-slider-row .val { min-width: 46px; text-align: right; color: #fff; font-weight: 700; font-size: 0.82rem; font-variant-numeric: tabular-nums; }

input[type="range"].vr-range {
  flex: 1;
  appearance: none;
  -webkit-appearance: none;
  height: 4px;
  border-radius: 4px;
  background: linear-gradient(90deg, var(--vr-cyan) var(--fill, 50%), color-mix(in srgb, #fff 14%, transparent) var(--fill, 50%));
  outline-offset: 4px;
  cursor: pointer;
}

input[type="range"].vr-range::-webkit-slider-thumb {
  appearance: none;
  -webkit-appearance: none;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: #d9f8ff;
  border: 2px solid var(--vr-cyan);
  box-shadow: 0 0 10px color-mix(in srgb, var(--vr-cyan) 60%, transparent);
}

input[type="range"].vr-range::-moz-range-thumb {
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: #d9f8ff;
  border: 2px solid var(--vr-cyan);
}

.vr-seg {
  display: flex;
  border: 1px solid color-mix(in srgb, #fff 22%, transparent);
  border-radius: 5px;
  overflow: hidden;
  background: color-mix(in srgb, #060a1c 82%, transparent);
}

.vr-seg button {
  flex: 1;
  min-height: 34px;
  padding: 6px 10px;
  border: none;
  background: transparent;
  color: var(--text-1);
  font-family: inherit;
  font-weight: 800;
  font-size: 0.68rem;
  letter-spacing: 0.08em;
  cursor: pointer;
}

.vr-seg button + button { border-left: 1px solid color-mix(in srgb, #fff 12%, transparent); }
.vr-seg button:hover { color: #fff; }

.vr-seg button.active {
  background: linear-gradient(180deg, #14b6d8, #0a7d9c);
  color: #fff;
  box-shadow: 0 0 14px color-mix(in srgb, var(--vr-cyan) 40%, transparent);
}

.vr-switch {
  position: relative;
  width: 46px;
  height: 22px;
  border: none;
  background: transparent;
  cursor: pointer;
  flex: none;
}

.vr-switch .track {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background: color-mix(in srgb, #fff 16%, transparent);
  transition: background 0.18s ease;
}

.vr-switch .track::after {
  content: "";
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.18s ease;
}

.vr-switch.on .track { background: var(--vr-cyan); box-shadow: 0 0 12px color-mix(in srgb, var(--vr-cyan) 55%, transparent); }
.vr-switch.on .track::after { transform: translateX(24px); }

.vr-tip {
  margin-top: 16px;
  padding-top: 10px;
  border-top: 1px solid color-mix(in srgb, #fff 10%, transparent);
  text-align: center;
  color: var(--text-2);
  font-size: 0.68rem;
  letter-spacing: 0.06em;
}

.vr-tip kbd {
  padding: 2px 7px;
  border: 1px solid color-mix(in srgb, #fff 30%, transparent);
  border-radius: 4px;
  font-family: inherit;
  font-size: 0.64rem;
  color: #fff;
}

/* --- Results --- */
.vr-over {
  width: min(680px, 100%);
  border: 1px solid color-mix(in srgb, var(--vr-cyan) 55%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, #070c1e 93%, transparent);
  box-shadow: 0 0 48px color-mix(in srgb, var(--vr-cyan) 15%, transparent), var(--shadow-pop);
  padding: clamp(18px, 3.2vw, 32px);
  text-align: center;
  animation: vrPanelIn 0.22s ease;
}

.vr-over-head {
  font-size: 1.15rem;
  font-weight: 800;
  letter-spacing: 0.24em;
  color: #fff;
  margin-bottom: 14px;
}

.vr-final-time .lbl {
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.3em;
  color: var(--vr-cyan);
}

.vr-final-time .num {
  font-size: clamp(2.4rem, 6.4vw, 3.4rem);
  font-weight: 800;
  line-height: 1.08;
  color: #fff;
  text-shadow: 0 0 30px color-mix(in srgb, var(--vr-cyan) 55%, transparent);
  font-variant-numeric: tabular-nums;
}

.vr-record {
  display: inline-block;
  margin-top: 7px;
  padding: 4px 16px;
  border: 1px solid var(--gold, #ffd23f);
  border-radius: 4px;
  color: var(--gold, #ffd23f);
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.26em;
  box-shadow: 0 0 18px color-mix(in srgb, #ffd23f 30%, transparent);
  animation: recordPulse 1s ease infinite alternate;
}

.vr-record.small { margin: 0 0 0 10px; padding: 2px 10px; font-size: 0.6rem; }

.vr-best-line {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  color: var(--text-1);
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.vr-best-line .icon { width: 14px; height: 14px; }

.vr-statgrid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin: 18px 0 14px;
}

.vr-statcard {
  border: 1px solid color-mix(in srgb, #fff 18%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, #0a1226 70%, transparent);
  padding: 12px 6px;
}

.vr-statcard .icon { width: 22px; height: 22px; margin: 0 auto 7px; display: block; }
.vr-statcard.lime .icon { color: var(--vr-lime); }
.vr-statcard.magenta .icon { color: var(--vr-pink); }
.vr-statcard.red .icon { color: var(--vr-red); }
.vr-statcard.cyan .icon { color: var(--vr-cyan); }

.vr-statcard .lbl {
  font-size: 0.56rem;
  font-weight: 800;
  letter-spacing: 0.16em;
  color: var(--text-2);
}

.vr-statcard .val {
  margin-top: 3px;
  font-size: 1.22rem;
  font-weight: 800;
  color: #fff;
  font-variant-numeric: tabular-nums;
}

.vr-score-line {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 12px;
  margin-bottom: 18px;
}

.vr-score-line .lbl { font-size: 0.7rem; font-weight: 800; letter-spacing: 0.26em; color: var(--text-1); }
.vr-score-line .num { font-size: 1.5rem; font-weight: 800; color: #fff; font-variant-numeric: tabular-nums; }

.vr-over-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }

/* --- Notice --- */
.vr-notice {
  max-width: 460px;
  text-align: center;
  border: 1px solid color-mix(in srgb, var(--vr-cyan) 40%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, #070c1e 92%, transparent);
  padding: 34px 26px;
}

.vr-notice .icon { width: 44px; height: 44px; margin: 0 auto 14px; color: var(--vr-violet); }
.vr-notice h3 { font-size: 1.02rem; letter-spacing: 0.2em; margin-bottom: 10px; color: #fff; }
.vr-notice p { color: var(--text-1); font-size: 0.86rem; margin-bottom: 20px; line-height: 1.5; }
.vr-notice .btn-row { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; }

/* --- Responsive --- */
@media (max-width: 900px) {
  .vr-start { grid-template-columns: 1fr; width: min(560px, 100%); }
  .vr-pause-cols { grid-template-columns: 1fr; }
  .vr-statgrid { grid-template-columns: repeat(2, 1fr); }
  .vr-tl { width: 118px; }
  .vr-panel .big .val { font-size: 1.2rem; }
  .vr-btn { min-width: 0; }
  .vr-btn span { display: none; }
  .vr-time { font-size: 1.3rem; }
}
`;
