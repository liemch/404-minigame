/**
 * styles.js — CSS của 404 Strike (inject vào shadow root khi game mount,
 * không nằm trong initial bundle). Bám theo 4 màn hình reference:
 * HUD gameplay, start screen, pause + settings, kết thúc trận.
 */

export const STRIKE_CSS = /* css */ `
.sk-root {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--bg-0);
  font-family: var(--font-mono);
  user-select: none;
  -webkit-user-select: none;
}

.sk-root canvas.sk-canvas {
  position: absolute;
  inset: 0;
  cursor: crosshair;
  touch-action: none;
}

/* Khung cắt góc kiểu quân sự: lớp ngoài = viền, lớp trong = nền */
.sk-cut {
  position: relative;
  padding: 1px;
  clip-path: polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px);
  background: color-mix(in srgb, var(--cyan) 55%, transparent);
}

.sk-cut > .sk-cut-in {
  clip-path: polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px);
  background: color-mix(in srgb, var(--bg-0) 86%, transparent);
  padding: 8px 14px;
}

/* ============================ HUD ============================ */

.sk-hud {
  position: absolute;
  inset: 0;
  z-index: 10;
  pointer-events: none;
  transition: opacity 0.25s ease;
}

.sk-hud.dim { opacity: 0.35; }

.sk-hud .clickable { pointer-events: auto; }

/* --- Trên trái: tên game + pause + sound --- */
.sk-tl {
  position: absolute;
  top: 14px;
  left: 14px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.sk-chip .sk-cut-in {
  font-size: 0.82rem;
  font-weight: 800;
  letter-spacing: 0.18em;
  color: var(--text-0);
  padding: 7px 18px;
}

.sk-iconbtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border: 1px solid color-mix(in srgb, var(--cyan) 35%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--bg-0) 78%, transparent);
  color: var(--text-1);
  cursor: pointer;
}

.sk-iconbtn:hover { color: var(--cyan); border-color: var(--cyan); }
.sk-iconbtn .icon { width: 16px; height: 16px; }

/* --- Trên giữa: wave + đồng hồ --- */
.sk-timer {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
  min-width: 200px;
}

.sk-timer .sk-cut { background: color-mix(in srgb, var(--cyan) 45%, transparent); }
.sk-timer .sk-cut-in { padding: 6px 26px 8px; }

.sk-wave-label {
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.34em;
  color: var(--text-1);
}

.sk-time {
  font-size: 1.9rem;
  font-weight: 800;
  line-height: 1.05;
  color: var(--text-0);
  text-shadow: 0 0 18px color-mix(in srgb, var(--cyan) 45%, transparent);
  font-variant-numeric: tabular-nums;
}

.sk-timer.warn .sk-time { color: var(--gold); }
.sk-timer.danger .sk-time { color: var(--red); animation: skBlink 0.5s steps(1) infinite; }

@keyframes skBlink { 50% { opacity: 0.45; } }

/* --- Trên phải: điểm + combo + headshot --- */
.sk-tr {
  position: absolute;
  top: 14px;
  right: 14px;
  text-align: right;
}

.sk-score-box .sk-cut-in { padding: 8px 16px; }

.sk-score-row {
  display: flex;
  justify-content: flex-end;
  align-items: baseline;
  gap: 10px;
}

.sk-score-row .lbl {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.22em;
  color: var(--text-1);
}

.sk-score-val {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--text-0);
  font-variant-numeric: tabular-nums;
}

.sk-combo-val {
  font-size: 1.2rem;
  font-weight: 800;
  color: var(--gold);
  text-shadow: 0 0 14px color-mix(in srgb, var(--gold) 55%, transparent);
}

.sk-headshot {
  display: inline-block;
  margin-top: 8px;
  padding: 3px 14px;
  border: 1px solid var(--gold);
  border-radius: 4px;
  color: var(--gold);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.26em;
  background: color-mix(in srgb, var(--bg-0) 75%, transparent);
  box-shadow: 0 0 16px color-mix(in srgb, var(--gold) 35%, transparent);
  opacity: 0;
  transform: translateY(-4px);
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.sk-headshot.show { opacity: 1; transform: none; }

/* --- Dưới trái: HP --- */
.sk-bl {
  position: absolute;
  left: 14px;
  bottom: 14px;
  min-width: 250px;
}

.sk-hp-row {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.sk-hp-row .lbl {
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.24em;
  color: var(--text-1);
}

.sk-hp-val {
  font-size: 2rem;
  font-weight: 800;
  color: var(--text-0);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.sk-hp-segs {
  display: flex;
  gap: 4px;
  margin-top: 7px;
  align-items: center;
}

.sk-hp-plus {
  width: 18px;
  height: 14px;
  flex: none;
  border-radius: 3px;
  background: color-mix(in srgb, var(--violet) 60%, transparent);
  color: var(--text-0);
  font-size: 11px;
  font-weight: 800;
  line-height: 14px;
  text-align: center;
}

.sk-hp-segs i {
  width: 17px;
  height: 9px;
  background: color-mix(in srgb, var(--text-0) 16%, transparent);
}

.sk-hp-segs i.on { background: var(--text-0); box-shadow: 0 0 8px color-mix(in srgb, var(--text-0) 45%, transparent); }
.sk-hp-segs i.on.vio { background: var(--violet); box-shadow: 0 0 8px color-mix(in srgb, var(--violet) 55%, transparent); }

.sk-bl.low .sk-hp-val { color: var(--red); animation: skBlink 0.6s steps(1) infinite; }

/* --- Dưới phải: đạn --- */
.sk-br {
  position: absolute;
  right: 14px;
  bottom: 14px;
}

.sk-ammo-in {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 18px;
}

.sk-ammo-mag {
  font-size: 1.9rem;
  font-weight: 800;
  color: var(--text-0);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.sk-ammo-mag.low { color: var(--red); }
.sk-ammo-reserve { font-size: 1rem; color: var(--text-1); font-weight: 700; }

.sk-bullets { display: flex; gap: 3px; color: var(--cyan); }
.sk-bullets .icon { width: 9px; height: 20px; }

.sk-reload-tip {
  position: absolute;
  right: 4px;
  bottom: 100%;
  margin-bottom: 8px;
  font-size: 0.68rem;
  letter-spacing: 0.18em;
  color: var(--gold);
  white-space: nowrap;
  animation: skBlink 0.7s steps(1) infinite;
}

/* --- Tâm ngắm + hitmarker --- */
.sk-cross {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  --gap: 7px;
  --len: 9px;
}

.sk-cross i {
  position: absolute;
  background: var(--text-0);
  box-shadow: 0 0 6px rgba(255, 255, 255, 0.55);
}

.sk-cross .n { left: -1px; top: calc(-1 * (var(--gap) + var(--len))); width: 2px; height: var(--len); }
.sk-cross .s { left: -1px; top: var(--gap); width: 2px; height: var(--len); }
.sk-cross .w { top: -1px; left: calc(-1 * (var(--gap) + var(--len))); height: 2px; width: var(--len); }
.sk-cross .e { top: -1px; left: var(--gap); height: 2px; width: var(--len); }
.sk-cross .dot { left: -1.5px; top: -1.5px; width: 3px; height: 3px; border-radius: 50%; }

.sk-hitmark {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  opacity: 0;
}

.sk-hitmark i {
  position: absolute;
  width: 2px;
  height: 9px;
  background: var(--text-0);
}

.sk-hitmark .a { transform: translate(-7px, -12px) rotate(-45deg); }
.sk-hitmark .b { transform: translate(5px, -12px) rotate(45deg); }
.sk-hitmark .c { transform: translate(-7px, 3px) rotate(45deg); }
.sk-hitmark .d { transform: translate(5px, 3px) rotate(-45deg); }

.sk-hitmark.show { animation: skHit 0.22s ease; }
.sk-hitmark.head i { background: var(--gold); box-shadow: 0 0 8px var(--gold); }

@keyframes skHit {
  0% { opacity: 1; transform: scale(1.25); }
  100% { opacity: 0; transform: scale(0.9); }
}

/* --- Máu / hiệu ứng toàn màn --- */
.sk-vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(ellipse at center, transparent 52%, color-mix(in srgb, var(--red) 55%, transparent) 130%);
  opacity: 0;
  transition: opacity 0.12s ease;
}

.sk-lowhp {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(ellipse at center, transparent 58%, color-mix(in srgb, var(--red) 45%, transparent) 125%);
  opacity: 0;
}

.sk-lowhp.on { animation: skLow 1.1s ease infinite; }

@keyframes skLow {
  0%, 100% { opacity: 0.25; }
  50% { opacity: 0.7; }
}

/* --- Banner wave + toast --- */
.sk-banner {
  position: absolute;
  top: 24%;
  left: 50%;
  transform: translateX(-50%);
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: 0.4em;
  color: var(--cyan);
  text-shadow: 0 0 26px color-mix(in srgb, var(--cyan) 60%, transparent);
  opacity: 0;
  pointer-events: none;
}

.sk-banner.show { animation: skBanner 1.6s ease; }

@keyframes skBanner {
  0% { opacity: 0; transform: translateX(-50%) scale(1.3); }
  18% { opacity: 1; transform: translateX(-50%) scale(1); }
  75% { opacity: 1; }
  100% { opacity: 0; }
}

.sk-toasts {
  position: absolute;
  bottom: 120px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  pointer-events: none;
}

.sk-toast {
  padding: 4px 14px;
  border: 1px solid color-mix(in srgb, var(--lime) 55%, transparent);
  border-radius: 4px;
  background: color-mix(in srgb, var(--bg-0) 82%, transparent);
  color: var(--lime);
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  animation: skToast 1.6s ease forwards;
}

@keyframes skToast {
  0% { opacity: 0; transform: translateY(8px); }
  12% { opacity: 1; transform: none; }
  75% { opacity: 1; }
  100% { opacity: 0; transform: translateY(-10px); }
}

/* ============================ Màn hình ============================ */

.sk-screen {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(14px, 3vw, 40px);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-0) 66%, transparent), color-mix(in srgb, var(--bg-0) 88%, transparent));
  overflow-y: auto;
}

.sk-panel-title {
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--text-0);
}

/* ---- Start screen ---- */
.sk-start {
  display: grid;
  grid-template-columns: minmax(320px, 1.25fr) minmax(280px, 340px);
  gap: clamp(20px, 4vw, 56px);
  width: min(1020px, 100%);
  align-items: center;
}

.sk-logo { width: min(330px, 72%); margin-bottom: 14px; }
.sk-logo svg { width: 100%; filter: drop-shadow(0 0 18px color-mix(in srgb, var(--violet) 45%, transparent)); }

.sk-objective {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 4px 0 18px;
}

.sk-objective .icon { width: 30px; height: 30px; color: var(--violet); flex: none; }

.sk-objective .txt strong {
  display: block;
  color: var(--cyan);
  font-size: 0.85rem;
  letter-spacing: 0.16em;
}

.sk-objective .txt span {
  color: var(--text-0);
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.sk-field { margin-bottom: 16px; }

.sk-field-label {
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.26em;
  color: var(--cyan);
  margin-bottom: 7px;
}

.sk-seg {
  display: inline-flex;
  border: 1px solid color-mix(in srgb, var(--cyan) 40%, transparent);
  border-radius: 6px;
  overflow: hidden;
  background: color-mix(in srgb, var(--bg-0) 80%, transparent);
}

.sk-seg button {
  min-width: 86px;
  min-height: 42px;
  padding: 8px 14px;
  border: none;
  background: transparent;
  color: var(--text-1);
  font-weight: 700;
  font-size: 0.82rem;
  letter-spacing: 0.06em;
  cursor: pointer;
}

.sk-seg button + button { border-left: 1px solid color-mix(in srgb, var(--cyan) 25%, transparent); }
.sk-seg button:hover { color: var(--text-0); }

.sk-seg button.active {
  background: linear-gradient(180deg, var(--violet), color-mix(in srgb, var(--violet) 70%, black));
  color: #fff;
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.6);
  box-shadow: 0 0 16px color-mix(in srgb, var(--violet) 45%, transparent);
}

.sk-select {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  border: 1px solid color-mix(in srgb, var(--cyan) 40%, transparent);
  border-radius: 6px;
  background: color-mix(in srgb, var(--bg-0) 80%, transparent);
  padding: 0 8px 0 12px;
}

.sk-select .icon { width: 15px; height: 15px; color: var(--text-1); }

.sk-select select {
  appearance: none;
  -webkit-appearance: none;
  min-height: 42px;
  min-width: 170px;
  padding-right: 22px;
  border: none;
  background: transparent;
  color: var(--text-0);
  font-weight: 700;
  cursor: pointer;
  outline: none;
}

.sk-select select option { background: #0b1028; color: var(--text-0); }
.sk-select::after { content: "▾"; color: var(--cyan); margin-left: -18px; pointer-events: none; }

.sk-cta {
  display: block;
  width: min(360px, 100%);
  margin: 22px 0 18px;
  padding: 3px;
  border: none;
  cursor: pointer;
  clip-path: polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px);
  background: linear-gradient(120deg, var(--violet), var(--pink));
  box-shadow: 0 0 34px color-mix(in srgb, var(--violet) 55%, transparent);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.sk-cta:hover { transform: translateY(-2px); box-shadow: 0 0 46px color-mix(in srgb, var(--violet) 75%, transparent); }
.sk-cta:active { transform: none; }

.sk-cta .in {
  display: block;
  padding: 15px 20px;
  clip-path: polygon(13px 0, 100% 0, 100% calc(100% - 13px), calc(100% - 13px) 100%, 0 100%, 0 13px);
  background: linear-gradient(180deg, color-mix(in srgb, var(--violet) 80%, black 5%), color-mix(in srgb, var(--violet) 45%, black 40%));
  color: #fff;
  font-size: 1.15rem;
  font-weight: 800;
  letter-spacing: 0.3em;
  text-align: center;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.6);
}

.sk-start-actions { display: flex; flex-wrap: wrap; gap: 10px; }

/* Panel điều khiển bên phải */
.sk-ctl-panel {
  border: 1px solid color-mix(in srgb, var(--cyan) 35%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, var(--bg-0) 82%, transparent);
  padding: 16px 18px;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.sk-ctl-panel h3 {
  text-align: center;
  font-size: 0.82rem;
  font-weight: 800;
  letter-spacing: 0.3em;
  color: var(--cyan);
  margin-bottom: 4px;
  padding-bottom: 10px;
  border-bottom: 1px solid color-mix(in srgb, var(--cyan) 22%, transparent);
}

.sk-ctl-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 9px 0;
}

.sk-ctl-row + .sk-ctl-row { border-top: 1px solid color-mix(in srgb, var(--text-0) 7%, transparent); }
.sk-ctl-keys { display: flex; gap: 4px; min-width: 108px; flex: none; align-items: center; }
.sk-ctl-keys .icon { width: 20px; height: 26px; color: var(--text-0); }
.sk-ctl-keys .icon.mono-violet { color: var(--violet); }
.sk-ctl-row .desc { color: var(--text-1); font-size: 0.8rem; line-height: 1.35; }
.sk-ctl-row .desc b { color: var(--text-0); display: block; font-size: 0.82rem; }

/* ---- Pause ---- */
.sk-pause-panel {
  width: min(780px, 100%);
  border: 1px solid color-mix(in srgb, var(--cyan) 55%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, var(--bg-0) 90%, transparent);
  box-shadow: 0 0 44px color-mix(in srgb, var(--cyan) 18%, transparent), var(--shadow-pop);
  padding: clamp(18px, 3.4vw, 34px);
  display: grid;
  grid-template-columns: 1fr 1.15fr;
  gap: clamp(18px, 3vw, 36px);
  position: relative;
}

.sk-pause-panel::before,
.sk-pause-panel::after {
  content: "";
  position: absolute;
  width: 46px;
  height: 12px;
  border: 2px solid var(--cyan);
}

.sk-pause-panel::before { top: -2px; left: 26px; border-bottom: none; border-right: none; }
.sk-pause-panel::after { bottom: -2px; right: 26px; border-top: none; border-left: none; }

.sk-menu { display: flex; flex-direction: column; gap: 10px; margin-top: 16px; }

.sk-menu-btn {
  min-height: 46px;
  border: 1px solid color-mix(in srgb, var(--cyan) 45%, transparent);
  border-radius: 6px;
  background: color-mix(in srgb, var(--bg-0) 70%, transparent);
  color: var(--text-0);
  font-weight: 800;
  font-size: 0.86rem;
  letter-spacing: 0.22em;
  cursor: pointer;
  transition: all 0.15s ease;
}

.sk-menu-btn:hover {
  border-color: var(--cyan);
  box-shadow: 0 0 14px color-mix(in srgb, var(--cyan) 30%, transparent);
}

.sk-menu-btn.primary {
  background: linear-gradient(180deg, var(--violet), color-mix(in srgb, var(--violet) 55%, black 30%));
  border-color: color-mix(in srgb, var(--violet) 80%, transparent);
  box-shadow: 0 0 18px color-mix(in srgb, var(--violet) 40%, transparent);
}

.sk-settings h3 {
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.28em;
  color: var(--cyan);
  border-bottom: 1px solid color-mix(in srgb, var(--cyan) 25%, transparent);
  padding-bottom: 8px;
  margin-bottom: 14px;
}

.sk-set { margin-bottom: 16px; }

.sk-set .lbl {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.22em;
  color: var(--text-1);
  margin-bottom: 8px;
}

.sk-set .lbl .icon { width: 15px; height: 15px; }

.sk-slider-row { display: flex; align-items: center; gap: 12px; }
.sk-slider-row .val { min-width: 34px; text-align: right; color: var(--text-0); font-weight: 700; font-size: 0.85rem; }

input[type="range"].sk-range {
  flex: 1;
  appearance: none;
  -webkit-appearance: none;
  height: 5px;
  border-radius: 4px;
  background: linear-gradient(90deg, var(--violet) var(--fill, 50%), color-mix(in srgb, var(--text-0) 14%, transparent) var(--fill, 50%));
  outline-offset: 4px;
  cursor: pointer;
}

input[type="range"].sk-range::-webkit-slider-thumb {
  appearance: none;
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #d9c4ff;
  border: 2px solid var(--violet);
  box-shadow: 0 0 10px color-mix(in srgb, var(--violet) 60%, transparent);
}

input[type="range"].sk-range::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #d9c4ff;
  border: 2px solid var(--violet);
}

.sk-switch {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}

.sk-switch .track {
  width: 52px;
  height: 24px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--text-0) 16%, transparent);
  position: relative;
  transition: background 0.18s ease;
}

.sk-switch .track::after {
  content: "";
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.18s ease;
}

.sk-switch.on .track { background: var(--violet); box-shadow: 0 0 12px color-mix(in srgb, var(--violet) 50%, transparent); }
.sk-switch.on .track::after { transform: translateX(28px); }

.sk-switch .state {
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.18em;
  color: var(--text-1);
  min-width: 30px;
}

.sk-switch.on .state { color: var(--text-0); }

/* ---- Kết thúc trận ---- */
.sk-over-panel {
  width: min(760px, 100%);
  border: 1px solid color-mix(in srgb, var(--cyan) 55%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, var(--bg-0) 92%, transparent);
  box-shadow: 0 0 44px color-mix(in srgb, var(--cyan) 16%, transparent), var(--shadow-pop);
  padding: clamp(18px, 3.4vw, 34px);
  text-align: center;
}

.sk-over-head {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  font-size: 1.3rem;
  font-weight: 800;
  letter-spacing: 0.24em;
  color: var(--text-0);
  margin-bottom: 18px;
}

.sk-over-head::before,
.sk-over-head::after {
  content: "‹‹›› ";
  content: "";
  width: 40px;
  height: 2px;
  background: color-mix(in srgb, var(--cyan) 60%, transparent);
}

.sk-score-line {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
}

.sk-laurel { width: 44px; height: 88px; color: var(--violet); opacity: 0.9; }
.sk-laurel.flip { transform: scaleX(-1); }

.sk-final-score .lbl2 {
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.3em;
  color: var(--cyan);
}

.sk-final-score .num {
  font-size: clamp(2.6rem, 7vw, 3.8rem);
  font-weight: 800;
  line-height: 1.05;
  color: var(--text-0);
  text-shadow: 0 0 30px color-mix(in srgb, var(--violet) 55%, transparent);
  font-variant-numeric: tabular-nums;
}

.sk-record {
  display: inline-block;
  margin-top: 6px;
  padding: 4px 16px;
  border: 1px solid var(--gold);
  border-radius: 4px;
  color: var(--gold);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.26em;
  box-shadow: 0 0 18px color-mix(in srgb, var(--gold) 30%, transparent);
  animation: recordPulse 1s ease infinite alternate;
}

.sk-statgrid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin: 22px 0;
}

.sk-statcard {
  border: 1px solid color-mix(in srgb, var(--cyan) 30%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--arcade-panel) 60%, transparent);
  padding: 14px 8px;
}

.sk-statcard .icon { width: 26px; height: 26px; margin: 0 auto 8px; color: var(--violet); }
.sk-statcard.gold .icon { color: var(--gold); }
.sk-statcard.cyan .icon { color: var(--cyan); }

.sk-statcard .lbl {
  font-size: 0.6rem;
  font-weight: 800;
  letter-spacing: 0.2em;
  color: var(--text-2);
}

.sk-statcard .val {
  margin-top: 4px;
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--text-0);
  font-variant-numeric: tabular-nums;
}

.sk-progress { margin: 8px 0 22px; }

.sk-progress .lbl {
  font-size: 0.66rem;
  font-weight: 800;
  letter-spacing: 0.26em;
  color: var(--cyan);
  margin-bottom: 20px;
}

.sk-track-wrap { position: relative; padding-top: 14px; }

.sk-track {
  height: 10px;
  border-radius: 3px;
  background: color-mix(in srgb, var(--text-0) 10%, transparent);
  overflow: hidden;
  display: flex;
}

.sk-track .fill {
  height: 100%;
  background: linear-gradient(90deg, var(--cyan), color-mix(in srgb, var(--cyan) 60%, var(--violet)));
  box-shadow: 0 0 12px color-mix(in srgb, var(--cyan) 55%, transparent);
  transition: width 0.9s cubic-bezier(0.2, 0.8, 0.3, 1);
}

.sk-track .best-zone { height: 100%; background: color-mix(in srgb, var(--violet) 55%, transparent); }

.sk-score-chip {
  position: absolute;
  top: -14px;
  transform: translateX(-50%);
  padding: 2px 10px;
  border: 1px solid var(--gold);
  border-radius: 4px;
  background: color-mix(in srgb, var(--bg-0) 90%, transparent);
  color: var(--gold);
  font-size: 0.7rem;
  font-weight: 800;
  white-space: nowrap;
  transition: left 0.9s cubic-bezier(0.2, 0.8, 0.3, 1);
}

.sk-score-chip::after {
  content: "";
  position: absolute;
  left: 50%;
  top: 100%;
  transform: translateX(-50%);
  border: 5px solid transparent;
  border-top-color: var(--gold);
}

.sk-axis {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  color: var(--text-2);
  font-size: 0.64rem;
  letter-spacing: 0.08em;
}

.sk-over-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; }

/* ---- Notice (mobile / WebGL) ---- */
.sk-notice {
  max-width: 460px;
  text-align: center;
  border: 1px solid color-mix(in srgb, var(--cyan) 40%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, var(--bg-0) 90%, transparent);
  padding: 34px 26px;
}

.sk-notice .icon { width: 44px; height: 44px; margin: 0 auto 14px; color: var(--violet); }
.sk-notice h3 { font-size: 1.05rem; letter-spacing: 0.2em; margin-bottom: 10px; color: var(--text-0); }
.sk-notice p { color: var(--text-1); font-size: 0.86rem; margin-bottom: 20px; }
.sk-notice .btn-row { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; }

/* ---- Responsive ---- */
@media (max-width: 900px) {
  .sk-start { grid-template-columns: 1fr; width: min(560px, 100%); }
  .sk-pause-panel { grid-template-columns: 1fr; }
  .sk-statgrid { grid-template-columns: repeat(2, 1fr); }
  .sk-timer { min-width: 150px; }
  .sk-time { font-size: 1.4rem; }
  .sk-score-val { font-size: 1.15rem; }
  .sk-hp-val { font-size: 1.5rem; }
  .sk-ammo-mag { font-size: 1.5rem; }
  .sk-bl { min-width: 190px; }
}
`;
