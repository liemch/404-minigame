/**
 * styles.js — CSS riêng Rogue Arena: panel NÂNG CẤP! bên trái với 3 thẻ
 * kỹ năng (icon + tên + mô tả + chấm cấp như ảnh), 3 chỉ báo kỹ năng
 * tròn dưới đáy, và joystick ảo cho mobile.
 */

export const RA_CSS = /* css */ `
.ra-stage {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
}

/* ---------- panel level-up ---------- */
.ra-levelup {
  position: absolute;
  left: 18px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 40;
  width: 236px;
  padding: 1px;
  clip-path: polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px);
  background: linear-gradient(160deg, color-mix(in srgb, var(--gold) 65%, transparent), color-mix(in srgb, var(--gold) 16%, transparent));
  animation: raPanelIn 0.24s ease;
}

@keyframes raPanelIn {
  from { opacity: 0; transform: translateY(-50%) translateX(-14px); }
}

@media (prefers-reduced-motion: reduce) {
  .ra-levelup { animation: none; }
}

.ra-levelup > .in {
  clip-path: polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px);
  background: rgba(7, 11, 28, 0.97);
  padding: 15px 14px;
}

.ra-levelup h3 {
  text-align: center;
  font-size: 1.05rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  color: var(--gold);
  text-shadow: 0 0 16px color-mix(in srgb, var(--gold) 55%, transparent);
}

.ra-levelup .sub {
  text-align: center;
  font-size: 0.66rem;
  color: var(--text-1);
  margin: 3px 0 12px;
  letter-spacing: 0.08em;
}

.ra-choice {
  display: grid;
  grid-template-columns: 40px 1fr;
  gap: 4px 10px;
  align-items: center;
  width: 100%;
  text-align: left;
  padding: 10px 11px;
  margin-bottom: 9px;
  border: 1px solid color-mix(in srgb, var(--tone, var(--cyan)) 45%, transparent);
  border-radius: 9px;
  background: rgba(11, 17, 40, 0.85);
  color: var(--text-0);
  font-family: inherit;
  cursor: pointer;
  transition: box-shadow 0.14s ease, transform 0.14s ease, background 0.14s ease;
}

.ra-choice[data-tone="cyan"]   { --tone: var(--cyan); }
.ra-choice[data-tone="pink"]   { --tone: var(--pink); }
.ra-choice[data-tone="violet"] { --tone: var(--violet); }
.ra-choice[data-tone="lime"]   { --tone: var(--lime); }
.ra-choice[data-tone="green"]  { --tone: var(--green); }
.ra-choice[data-tone="gold"]   { --tone: var(--gold); }

.ra-choice:hover,
.ra-choice:focus-visible {
  background: color-mix(in srgb, var(--tone) 12%, rgba(11, 17, 40, 0.85));
  box-shadow: 0 0 18px color-mix(in srgb, var(--tone) 35%, transparent);
  transform: translateX(3px);
}

.ra-choice .ico {
  grid-row: span 2;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid color-mix(in srgb, var(--tone) 55%, transparent);
  border-radius: 8px;
  background: rgba(7, 10, 24, 0.9);
}

.ra-choice .ico canvas { width: 30px; height: 30px; }

.ra-choice .nm {
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: var(--tone);
}

.ra-choice .ds {
  font-size: 0.64rem;
  line-height: 1.45;
  color: var(--text-1);
}

.ra-choice .pips {
  grid-column: 2;
  display: flex;
  gap: 3px;
  margin-top: 2px;
}

.ra-choice .pips i {
  width: 12px;
  height: 5px;
  border-radius: 2px;
  background: rgba(244, 247, 255, 0.14);
}

.ra-choice .pips i.on { background: var(--tone); }
.ra-choice .pips i.next { background: color-mix(in srgb, var(--tone) 45%, transparent); outline: 1px dashed var(--tone); }

.ra-choice kbd {
  position: absolute;
  right: 8px;
  top: 8px;
  font-size: 0.58rem;
  color: var(--text-2);
  border: 1px solid rgba(244,247,255,0.2);
  border-radius: 4px;
  padding: 1px 5px;
}

/* ---------- 3 chỉ báo kỹ năng dưới đáy (như ảnh) ---------- */
.ra-abilities {
  position: absolute;
  left: 50%;
  bottom: 12px;
  transform: translateX(-50%);
  z-index: 24;
  display: flex;
  gap: 20px;
  pointer-events: none;
}

.ra-ab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.ra-ab .ring {
  width: 58px;
  height: 58px;
  border-radius: 50%;
  border: 2.4px solid var(--tone, var(--cyan));
  background: radial-gradient(circle at 50% 38%, rgba(255,255,255,0.08), rgba(7, 10, 24, 0.88) 70%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 16px color-mix(in srgb, var(--tone, var(--cyan)) 35%, transparent);
}

.ra-ab[data-tone="cyan"]   { --tone: var(--cyan); }
.ra-ab[data-tone="violet"] { --tone: var(--violet); }
.ra-ab[data-tone="lime"]   { --tone: var(--lime); }

.ra-ab .ring canvas { width: 30px; height: 30px; }

.ra-ab .num {
  font-size: 0.72rem;
  font-weight: 800;
  color: var(--text-0);
  font-variant-numeric: tabular-nums;
  text-shadow: 0 1px 4px rgba(0,0,0,0.8);
}

/* ---------- joystick mobile ---------- */
.ra-joy {
  position: absolute;
  left: 26px;
  bottom: 26px;
  z-index: 30;
  width: 118px;
  height: 118px;
  border-radius: 50%;
  border: 2px solid rgba(32, 227, 255, 0.4);
  background: rgba(8, 12, 30, 0.5);
  display: none;
  touch-action: none;
}

.exp-root[data-touch="1"] .ra-joy { display: block; }

.ra-joy .knob {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: radial-gradient(circle at 50% 36%, rgba(32,227,255,0.45), rgba(10, 16, 38, 0.95) 72%);
  border: 2px solid var(--cyan);
  transform: translate(-50%, -50%);
  box-shadow: 0 0 16px rgba(32, 227, 255, 0.35);
}

@media (max-width: 760px) {
  .ra-levelup { width: 210px; left: 10px; }
  .ra-abilities { transform: translateX(-50%) scale(0.85); bottom: 6px; }
}
`;
