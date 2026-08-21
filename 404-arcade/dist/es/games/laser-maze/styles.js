/**
 * styles.js — CSS riêng Laser Maze 404: sidebar TRÁI (MÀN / GƯƠNG /
 * THỜI GIAN + chú giải 7 thành phần), board giữa, sidebar PHẢI
 * (HOÀN TÁC / CHƠI LẠI / GỢI Ý + KHO GƯƠNG) — theo ảnh reference.
 */

export const LM_CSS = /* css */ `
.lm-mode .exp-title {
  border: 1px solid color-mix(in srgb, var(--pink) 45%, transparent);
  padding: 5px 16px 7px;
  clip-path: polygon(0 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%);
  background: rgba(7, 11, 30, 0.9);
}

.lm-mode .exp-btn { min-width: 46px; min-height: 44px; padding: 5px; }
.lm-mode .exp-btn .bl { display: none; }
.lm-mode .exp-btn:nth-child(3) { min-width: 58px; }
.lm-mode .exp-btn:nth-child(3) .bl { display: block; }

.lm-layout {
  position: absolute;
  inset: 0;
  display: flex;
  gap: 12px;
  padding: 12px;
}

.lm-side {
  flex: none;
  width: 198px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
  min-height: 0;
  scrollbar-width: thin;
}

.lm-side-right { width: 188px; }

.lm-panel {
  --tone: var(--cyan);
  border: 1px solid color-mix(in srgb, var(--tone) 40%, transparent);
  background: rgba(7, 11, 30, 0.88);
  clip-path: polygon(9px 0, 100% 0, 100% calc(100% - 9px), calc(100% - 9px) 100%, 0 100%, 0 9px);
  padding: 9px 12px 11px;
  text-align: center;
}

.lm-panel .lbl {
  font-size: 0.6rem;
  font-weight: 800;
  letter-spacing: 0.28em;
  color: var(--text-1);
  margin-bottom: 4px;
}

.lm-panel .val {
  font-size: 1.5rem;
  font-weight: 800;
  line-height: 1.05;
  font-variant-numeric: tabular-nums;
  color: var(--cyan);
  text-shadow: 0 0 14px color-mix(in srgb, var(--cyan) 55%, transparent);
}

.lm-panel[data-tone="white"] .val { color: var(--text-0); text-shadow: 0 0 12px rgba(244,247,255,.3); }

.lm-legend {
  text-align: left;
  display: grid;
  gap: 8px;
}

.lm-legend-row { display: flex; align-items: center; gap: 9px; }

.lm-legend-row canvas { width: 28px; height: 28px; flex: none; }

.lm-legend-row .txt { min-width: 0; }

.lm-legend-row .name {
  font-size: 0.6rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: var(--text-0);
}

.lm-legend-row .desc {
  font-size: 0.56rem;
  letter-spacing: 0.04em;
  color: var(--cyan);
  opacity: 0.8;
  margin-top: 1px;
}

/* ---------- board giữa ---------- */

.lm-board {
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 0;
}

.lm-board canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  touch-action: manipulation;
}

/* ---------- sidebar phải ---------- */

.lm-action {
  --tone: var(--cyan);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 52px;
  width: 100%;
  border: 1.6px solid color-mix(in srgb, var(--tone) 65%, transparent);
  border-radius: 12px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--tone) 16%, rgba(9,13,32,0.94)), rgba(9, 13, 32, 0.94));
  color: var(--text-0);
  font-family: inherit;
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  cursor: pointer;
  transition: box-shadow 0.15s ease, transform 0.15s ease;
}

.lm-action:hover {
  box-shadow: 0 0 18px color-mix(in srgb, var(--tone) 45%, transparent);
  transform: translateY(-1px);
}

.lm-action .icon { width: 17px; height: 17px; color: var(--tone); }

.lm-action[data-tone="blue"]   { --tone: #3b7bff; }
.lm-action[data-tone="violet"] { --tone: var(--violet); }
.lm-action[data-tone="green"]  { --tone: #24e06a; }

.lm-inv-head {
  font-size: 0.66rem;
  font-weight: 800;
  letter-spacing: 0.22em;
  color: var(--text-0);
  text-align: center;
  margin: 4px 0 8px;
}

.lm-inv-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.lm-slot {
  aspect-ratio: 1;
  border: 1px solid rgba(110, 135, 190, 0.35);
  border-radius: 9px;
  background: rgba(13, 18, 38, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
}

.lm-slot canvas { width: 74%; height: 74%; }

.lm-slot.empty { border-style: dashed; opacity: 0.4; }

/* ---------- responsive ---------- */

@media (max-width: 980px) {
  .lm-layout { flex-direction: column; padding: 8px; gap: 8px; }
  .lm-side {
    width: 100%;
    flex-direction: row;
    flex-wrap: wrap;
    overflow: visible;
    gap: 8px;
  }
  .lm-panel { flex: 1 1 90px; padding: 6px 8px; }
  .lm-panel .val { font-size: 1.05rem; }
  .lm-panel .lbl { font-size: 0.52rem; margin-bottom: 2px; }
  .lm-panel-legend { display: none; }
  .lm-side-right { order: 3; }
  .lm-side-right .lm-action { flex: 1 1 30%; min-height: 42px; font-size: 0.68rem; }
  .lm-inv { flex: 1 1 100%; }
  .lm-inv-grid { grid-template-columns: repeat(8, 1fr); }
  .lm-board { min-height: 0; flex: 1; order: 2; }
}
`;
