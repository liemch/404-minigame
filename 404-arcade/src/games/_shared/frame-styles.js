/**
 * frame-styles.js — CSS khung dùng chung cho 5 game expansion (6–10).
 * Tái tạo phong cách HUD trong 5 ảnh reference: top bar tối với tên game
 * bên trái, cụm chỉ số ở giữa, cụm nút TẠM DỪNG / ÂM THANH / ĐỔI GAME /
 * TRANG CHỦ; overlay hướng dẫn, pause menu và màn kết quả cắt góc neon.
 * Inject một lần vào shadow root khi game expansion đầu tiên mount.
 */

export const EXP_CSS = /* css */ `
.exp-root {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-0);
  font-family: var(--font-mono);
  user-select: none;
  -webkit-user-select: none;
}

/* ============================ TOP BAR ============================ */

.exp-topbar {
  display: flex;
  align-items: stretch;
  gap: 14px;
  flex: none;
  min-height: 60px;
  padding: 7px 14px;
  background: linear-gradient(180deg, rgba(9, 13, 34, 0.98), rgba(6, 9, 24, 0.96));
  border-bottom: 1px solid color-mix(in srgb, var(--accent) 32%, transparent);
  box-shadow: 0 1px 18px color-mix(in srgb, var(--accent) 14%, transparent);
  position: relative;
  z-index: 30;
}

.exp-title {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
  flex: none;
}

.exp-title .t {
  font-size: 1.18rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  line-height: 1.1;
  white-space: nowrap;
  text-shadow: 0 0 14px color-mix(in srgb, var(--accent) 40%, transparent);
}

.exp-title .t .seg-cyan   { color: var(--cyan); }
.exp-title .t .seg-violet { color: var(--violet); }
.exp-title .t .seg-pink   { color: var(--pink); }
.exp-title .t .seg-lime   { color: var(--lime); }
.exp-title .t .seg-green  { color: var(--green); }
.exp-title .t .seg-gold   { color: var(--gold); }
.exp-title .t .seg-red    { color: var(--red); }

.exp-title .deco {
  margin-top: 4px;
  height: 3px;
  width: 88%;
  background: linear-gradient(90deg,
    color-mix(in srgb, var(--accent) 85%, transparent) 0 34%,
    color-mix(in srgb, var(--accent) 30%, transparent) 34% 72%,
    transparent 72%);
  clip-path: polygon(0 0, 100% 0, calc(100% - 3px) 100%, 0 100%);
}

/* --- Chỉ số giữa --- */
.exp-stats {
  display: flex;
  align-items: stretch;
  justify-content: center;
  gap: 0;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.exp-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 2px 18px;
  position: relative;
}

.exp-stat + .exp-stat::before {
  content: "";
  position: absolute;
  left: 0;
  top: 15%;
  bottom: 15%;
  width: 1px;
  background: rgba(244, 247, 255, 0.1);
}

.exp-stat .lbl {
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.26em;
  color: var(--text-1);
  white-space: nowrap;
}

.exp-stat .val {
  font-size: 1.22rem;
  font-weight: 800;
  line-height: 1.05;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  color: var(--text-0);
}

.exp-stat[data-color="cyan"]   .val { color: var(--cyan);  text-shadow: 0 0 12px color-mix(in srgb, var(--cyan) 45%, transparent); }
.exp-stat[data-color="violet"] .val { color: var(--violet);text-shadow: 0 0 12px color-mix(in srgb, var(--violet) 45%, transparent); }
.exp-stat[data-color="pink"]   .val { color: var(--pink);  text-shadow: 0 0 12px color-mix(in srgb, var(--pink) 45%, transparent); }
.exp-stat[data-color="lime"]   .val { color: var(--lime);  text-shadow: 0 0 12px color-mix(in srgb, var(--lime) 45%, transparent); }
.exp-stat[data-color="green"]  .val { color: var(--green); text-shadow: 0 0 12px color-mix(in srgb, var(--green) 45%, transparent); }
.exp-stat[data-color="gold"]   .val { color: var(--gold);  text-shadow: 0 0 12px color-mix(in srgb, var(--gold) 45%, transparent); }
.exp-stat[data-color="red"]    .val { color: var(--red);   text-shadow: 0 0 12px color-mix(in srgb, var(--red) 45%, transparent); }
.exp-stat[data-color="white"]  .val { color: var(--text-0);text-shadow: 0 0 12px rgba(244,247,255,.35); }

.exp-stat .minibar {
  width: 74px;
  height: 4px;
  margin-top: 2px;
  border-radius: 2px;
  background: rgba(244, 247, 255, 0.12);
  overflow: hidden;
}

.exp-stat .minibar > i {
  display: block;
  height: 100%;
  width: 0%;
  border-radius: 2px;
  background: currentColor;
  transition: width 0.15s linear;
}

.exp-stat[data-color="cyan"]   .minibar > i { background: var(--cyan); }
.exp-stat[data-color="green"]  .minibar > i { background: var(--green); }
.exp-stat[data-color="lime"]   .minibar > i { background: var(--lime); }
.exp-stat[data-color="pink"]   .minibar > i { background: var(--pink); }
.exp-stat[data-color="red"]    .minibar > i { background: var(--red); }
.exp-stat[data-color="gold"]   .minibar > i { background: var(--gold); }
.exp-stat[data-color="violet"] .minibar > i { background: var(--violet); }

/* --- Cụm nút hệ thống --- */
.exp-btns {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
}

.exp-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  min-width: 58px;
  min-height: 46px;
  padding: 4px 7px;
  border: 1px solid rgba(244, 247, 255, 0.22);
  border-radius: 9px;
  background: rgba(10, 16, 38, 0.72);
  color: var(--text-0);
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
}

.exp-btn .icon { width: 15px; height: 15px; }

.exp-btn .bl {
  font-size: 0.5rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  white-space: nowrap;
}

.exp-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
  box-shadow: 0 0 14px color-mix(in srgb, var(--accent) 30%, transparent);
}

/* Biến thể nút ngang (Rhythm Hack) */
.exp-root[data-btnstyle="inline"] .exp-btn {
  flex-direction: row;
  gap: 7px;
  min-height: 40px;
  padding: 4px 12px;
}

.exp-root[data-btnstyle="inline"] .exp-btn .bl { font-size: 0.62rem; }

/* Biến thể nút icon nhỏ (Rogue Arena) */
.exp-root[data-btnstyle="compact"] .exp-btn {
  min-width: 40px;
  min-height: 40px;
  padding: 4px;
}

.exp-root[data-btnstyle="compact"] .exp-btn .bl { display: none; }

/* ============================ PLAYFIELD ============================ */

.exp-playfield {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.exp-playfield canvas.exp-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  touch-action: none;
}

/* ============================ OVERLAYS ============================ */

.exp-screen {
  position: absolute;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  background:
    radial-gradient(900px 500px at 50% 24%, color-mix(in srgb, var(--accent) 9%, transparent), transparent 70%),
    rgba(4, 7, 18, 0.82);
  backdrop-filter: blur(3px);
  overflow: auto;
  animation: expFade 0.22s ease;
}

@keyframes expFade { from { opacity: 0; } }

@media (prefers-reduced-motion: reduce) {
  .exp-screen { animation: none; }
}

.exp-panel {
  position: relative;
  padding: 1px;
  clip-path: polygon(16px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%, 0 16px);
  background: linear-gradient(160deg,
    color-mix(in srgb, var(--accent) 65%, transparent),
    color-mix(in srgb, var(--accent) 18%, transparent));
  max-width: min(720px, 94vw);
  margin: auto;
}

.exp-panel > .in {
  clip-path: polygon(16px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%, 0 16px);
  background: rgba(7, 11, 28, 0.96);
  padding: 26px 30px;
}

.exp-kicker {
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.4em;
  color: var(--text-1);
  margin-bottom: 8px;
}

.exp-h1 {
  font-size: clamp(1.4rem, 3.4vw, 2rem);
  font-weight: 800;
  letter-spacing: 0.04em;
  margin-bottom: 4px;
  text-shadow: 0 0 22px color-mix(in srgb, var(--accent) 50%, transparent);
}

.exp-h1 .seg-cyan { color: var(--cyan); }
.exp-h1 .seg-violet { color: var(--violet); }
.exp-h1 .seg-pink { color: var(--pink); }
.exp-h1 .seg-lime { color: var(--lime); }
.exp-h1 .seg-gold { color: var(--gold); }
.exp-h1 .seg-green { color: var(--green); }

.exp-goal {
  color: var(--text-1);
  font-size: 0.88rem;
  line-height: 1.6;
  margin: 10px 0 16px;
  max-width: 52ch;
}

.exp-ctl-rows { display: grid; gap: 8px; margin-bottom: 20px; }

.exp-ctl-row {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 0.8rem;
  color: var(--text-1);
}

.exp-ctl-row kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 26px;
  height: 24px;
  padding: 0 7px;
  border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
  border-bottom-width: 2px;
  border-radius: 5px;
  background: rgba(14, 20, 46, 0.9);
  color: var(--text-0);
  font-family: inherit;
  font-size: 0.68rem;
  font-weight: 700;
}

.exp-ctl-row .keys { display: flex; gap: 4px; flex: none; min-width: 120px; }

.exp-cta {
  appearance: none;
  border: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 52px;
  padding: 0 38px;
  clip-path: polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px);
  background: var(--accent);
  color: #051020;
  font-family: inherit;
  font-size: 0.95rem;
  font-weight: 800;
  letter-spacing: 0.2em;
  box-shadow: 0 0 26px color-mix(in srgb, var(--accent) 55%, transparent);
  transition: transform 0.14s ease, box-shadow 0.14s ease;
}

.exp-cta:hover { transform: translateY(-1px); box-shadow: 0 0 40px color-mix(in srgb, var(--accent) 75%, transparent); }

.exp-screen-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 18px;
  align-items: center;
}

.exp-ghostbtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 42px;
  padding: 0 18px;
  border: 1px solid color-mix(in srgb, var(--accent) 55%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--accent) 7%, transparent);
  color: var(--accent);
  font-family: inherit;
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 0.15s ease, box-shadow 0.15s ease;
}

.exp-ghostbtn:hover {
  background: color-mix(in srgb, var(--accent) 17%, transparent);
  box-shadow: 0 0 16px color-mix(in srgb, var(--accent) 30%, transparent);
}

.exp-ghostbtn .icon { width: 14px; height: 14px; }

.exp-ghostbtn[data-tone="pink"]  { --accent: var(--pink); }
.exp-ghostbtn[data-tone="violet"]{ --accent: var(--violet); }
.exp-ghostbtn[data-tone="lime"]  { --accent: var(--lime); }
.exp-ghostbtn[data-tone="gold"]  { --accent: var(--gold); }
.exp-ghostbtn[data-tone="cyan"]  { --accent: var(--cyan); }

/* --- Pause menu --- */
.exp-menu { display: grid; gap: 9px; min-width: min(340px, 80vw); }

.exp-menu-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 46px;
  border: 1px solid rgba(244, 247, 255, 0.18);
  border-radius: 8px;
  background: rgba(12, 18, 42, 0.85);
  color: var(--text-0);
  font-family: inherit;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  cursor: pointer;
  transition: border-color 0.14s ease, box-shadow 0.14s ease, color 0.14s ease;
}

.exp-menu-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
  box-shadow: 0 0 16px color-mix(in srgb, var(--accent) 26%, transparent);
}

.exp-menu-btn.primary {
  background: var(--accent);
  color: #051020;
  border-color: transparent;
}

.exp-menu-btn.primary:hover {
  color: #051020;
  box-shadow: 0 0 26px color-mix(in srgb, var(--accent) 60%, transparent);
}

.exp-pause-extra {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid rgba(244, 247, 255, 0.1);
  display: grid;
  gap: 12px;
}

.exp-setrow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--text-1);
}

.exp-setrow .val { color: var(--text-0); font-variant-numeric: tabular-nums; }

.exp-range {
  appearance: none;
  width: 150px;
  height: 5px;
  border-radius: 3px;
  background: linear-gradient(90deg, var(--accent) var(--fill, 50%), rgba(244,247,255,.14) var(--fill, 50%));
  outline-offset: 4px;
}

.exp-range::-webkit-slider-thumb {
  appearance: none;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: var(--text-0);
  border: 2px solid var(--accent);
  cursor: pointer;
}

/* --- Kết quả --- */
.exp-over-score { display: flex; align-items: baseline; gap: 16px; flex-wrap: wrap; margin: 8px 0 4px; }

.exp-over-score .num {
  font-size: clamp(2.2rem, 6vw, 3.2rem);
  font-weight: 800;
  color: var(--text-0);
  font-variant-numeric: tabular-nums;
  text-shadow: 0 0 26px color-mix(in srgb, var(--accent) 55%, transparent);
}

.exp-record {
  display: inline-block;
  padding: 4px 12px;
  border: 1px solid var(--gold);
  border-radius: 5px;
  color: var(--gold);
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.22em;
  box-shadow: 0 0 18px color-mix(in srgb, var(--gold) 40%, transparent);
  animation: expPulse 1.1s ease-in-out infinite alternate;
}

@keyframes expPulse { to { box-shadow: 0 0 30px color-mix(in srgb, var(--gold) 70%, transparent); } }

.exp-best-line { color: var(--text-1); font-size: 0.78rem; letter-spacing: 0.1em; margin-bottom: 14px; }
.exp-best-line b { color: var(--gold); }

.exp-statgrid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 9px;
  margin: 14px 0 4px;
}

.exp-statcard {
  border: 1px solid rgba(244, 247, 255, 0.12);
  border-radius: 8px;
  background: rgba(11, 17, 40, 0.8);
  padding: 10px 12px;
  text-align: center;
}

.exp-statcard .lbl {
  font-size: 0.58rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  color: var(--text-1);
  margin-bottom: 4px;
  white-space: nowrap;
}

.exp-statcard .val {
  font-size: 1.15rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: var(--text-0);
}

.exp-statcard[data-color="cyan"] .val { color: var(--cyan); }
.exp-statcard[data-color="pink"] .val { color: var(--pink); }
.exp-statcard[data-color="lime"] .val { color: var(--lime); }
.exp-statcard[data-color="gold"] .val { color: var(--gold); }
.exp-statcard[data-color="violet"] .val { color: var(--violet); }
.exp-statcard[data-color="green"] .val { color: var(--green); }
.exp-statcard[data-color="red"] .val { color: var(--red); }

/* --- Toast + banner --- */
.exp-toasts {
  position: absolute;
  left: 50%;
  bottom: 84px;
  transform: translateX(-50%);
  display: grid;
  gap: 6px;
  z-index: 35;
  pointer-events: none;
}

.exp-toast {
  padding: 7px 16px;
  border: 1px solid color-mix(in srgb, var(--accent) 50%, transparent);
  border-radius: 6px;
  background: rgba(7, 11, 28, 0.92);
  color: var(--text-0);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  animation: expToast 1.8s ease forwards;
  text-align: center;
}

@keyframes expToast {
  0% { opacity: 0; transform: translateY(8px); }
  12%, 82% { opacity: 1; transform: none; }
  100% { opacity: 0; transform: translateY(-6px); }
}

.exp-banner {
  position: absolute;
  left: 50%;
  top: 30%;
  transform: translate(-50%, -50%) scale(0.9);
  z-index: 34;
  padding: 10px 34px;
  border: 1px solid color-mix(in srgb, var(--accent) 60%, transparent);
  background: rgba(7, 11, 28, 0.88);
  clip-path: polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px);
  color: var(--text-0);
  font-size: clamp(1.1rem, 3vw, 1.7rem);
  font-weight: 800;
  letter-spacing: 0.3em;
  text-shadow: 0 0 20px color-mix(in srgb, var(--accent) 60%, transparent);
  opacity: 0;
  pointer-events: none;
}

.exp-banner.show { animation: expBanner 1.5s ease forwards; }

@keyframes expBanner {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.86); }
  14%, 78% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(1.05); }
}

/* ============================ RESPONSIVE ============================ */

@media (max-width: 900px) {
  .exp-stat { padding: 2px 10px; }
  .exp-stat .val { font-size: 1rem; }
  .exp-title .t { font-size: 0.95rem; }
}

@media (max-width: 700px) {
  .exp-topbar { gap: 8px; padding: 6px 8px; flex-wrap: wrap; min-height: 52px; }
  .exp-stat { padding: 2px 7px; }
  .exp-stat .lbl { letter-spacing: 0.14em; font-size: 0.52rem; }
  .exp-stat .val { font-size: 0.9rem; }
  .exp-stat[data-optional] { display: none; }
  .exp-btn { min-width: 44px; }
  .exp-btn .bl { display: none; }
  .exp-panel > .in { padding: 20px 18px; }
}
`;
