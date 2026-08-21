/**
 * styles.js — CSS riêng Neon Pinball 404: cột HUD trái (logo NEON
 * PINBALL 404, ĐIỂM, BI, MULTI, BONUS), cụm nút hệ thống nổi góc phải
 * trên, hai nút FLIPPER lục giác góc dưới — theo reference.
 */

export const PB_CSS = /* css */ `
.pb-mode .exp-playfield {
  background: #08061c;
}

.pb-stage {
  position: absolute;
  inset: 0;
}

.pb-stage canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  touch-action: none;
}

/* ---------- cụm nút hệ thống nổi ---------- */

.pb-sys {
  position: absolute;
  top: 12px;
  right: 14px;
  z-index: 30;
}

.pb-sys .exp-btns { gap: 8px; }

/* ---------- cột HUD trái ---------- */

.pb-side {
  position: absolute;
  left: 14px;
  top: 12px;
  width: 190px;
  display: grid;
  gap: 12px;
  z-index: 20;
  pointer-events: none;
}

.pb-logo {
  border: 1.6px solid rgba(32, 227, 255, 0.55);
  border-radius: 12px;
  background: rgba(8, 10, 30, 0.9);
  box-shadow: 0 0 18px rgba(32, 227, 255, 0.16), inset 0 0 24px rgba(10, 16, 50, 0.6);
  padding: 10px 14px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.pb-logo .words {
  display: grid;
  line-height: 1.06;
  font-weight: 800;
  letter-spacing: 0.06em;
}

.pb-logo .words .w1 { color: var(--cyan); font-size: 1.05rem; text-shadow: 0 0 12px rgba(32,227,255,.6); }
.pb-logo .words .w2 { color: var(--pink); font-size: 1.05rem; text-shadow: 0 0 12px rgba(255,46,166,.6); }

.pb-logo .num {
  font-size: 1.9rem;
  font-weight: 800;
  color: var(--cyan);
  text-shadow: 0 0 16px rgba(32, 227, 255, 0.75);
  border: 1.4px solid rgba(32, 227, 255, 0.4);
  border-radius: 8px;
  padding: 1px 8px;
}

.pb-panel {
  border: 1px solid rgba(120, 140, 220, 0.4);
  border-radius: 10px;
  background: rgba(8, 10, 30, 0.9);
  box-shadow: inset 0 0 18px rgba(10, 16, 50, 0.55);
  padding: 7px 13px 9px;
}

.pb-panel .lbl {
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.24em;
  color: var(--text-1);
}

.pb-panel .val {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 1.5rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.1em;
  line-height: 1.2;
}

.pb-panel[data-tone="cyan"] .val { color: var(--cyan); text-shadow: 0 0 14px rgba(32,227,255,.65); }
.pb-panel[data-tone="lime"] .val { color: var(--lime); text-shadow: 0 0 14px rgba(157,255,62,.55); }
.pb-panel[data-tone="pink"] .val { color: var(--pink); text-shadow: 0 0 14px rgba(255,46,166,.55); }
.pb-panel[data-tone="white"] .val { color: var(--text-0); }

.pb-panel .ballicon {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: radial-gradient(circle at 34% 30%, #fff, #cfd9ec 45%, #6a7694);
  box-shadow: 0 0 8px rgba(160, 200, 255, 0.7);
  flex: none;
}

/* ---------- nút flipper ---------- */

.pb-flipbtn {
  position: absolute;
  bottom: 18px;
  z-index: 25;
  width: min(170px, 20vw);
  min-height: 128px;
  border: 1.8px solid rgba(32, 227, 255, 0.6);
  background: rgba(7, 10, 28, 0.82);
  box-shadow: 0 0 20px rgba(32, 227, 255, 0.18), inset 0 0 26px rgba(12, 24, 64, 0.5);
  clip-path: polygon(22% 0, 78% 0, 100% 22%, 100% 78%, 78% 100%, 22% 100%, 0 78%, 0 22%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 7px;
  color: var(--cyan);
  font-family: inherit;
  font-size: 0.66rem;
  font-weight: 800;
  letter-spacing: 0.18em;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
  appearance: none;
}

.pb-flipbtn.left { left: 16px; }
.pb-flipbtn.right { right: 16px; }

.pb-flipbtn svg {
  width: 44px;
  height: 44px;
  filter: drop-shadow(0 0 8px rgba(32, 227, 255, 0.7));
}

.pb-flipbtn.held {
  background: rgba(14, 34, 66, 0.9);
  box-shadow: 0 0 32px rgba(32, 227, 255, 0.45), inset 0 0 30px rgba(32, 227, 255, 0.2);
}

@media (max-width: 900px) {
  .pb-side { width: 150px; }
  .pb-logo .num { font-size: 1.4rem; }
  .pb-panel .val { font-size: 1.1rem; }
  .pb-flipbtn { min-height: 96px; width: 120px; }
  .pb-flipbtn svg { width: 30px; height: 30px; }
}
`;
