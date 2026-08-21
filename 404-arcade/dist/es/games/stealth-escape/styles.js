/**
 * styles.js — CSS riêng Stealth Escape 404: topbar nút trái + tiêu đề
 * giữa, sidebar trái (MÀN / BÁO ĐỘNG / THỜI GIAN / KEYCARD / chú giải)
 * và hàng nút HOÀN TÁC / CHƠI LẠI / GỢI Ý dưới đáy — theo reference.
 */

export const SE_CSS = /* css */ `
.se-mode .exp-stats { display: none; }

.se-mode .exp-title {
  flex: 1;
  align-items: center;
}

.se-mode .exp-title .t {
  margin: 0 auto;
  font-size: 1.35rem;
  letter-spacing: 0.1em;
}

.se-mode .exp-title .deco {
  display: none;
}

.se-stage {
  position: absolute;
  inset: 0;
}

.se-stage canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  touch-action: manipulation;
  cursor: pointer;
}

/* ---------- sidebar trái ---------- */

.se-side {
  position: absolute;
  left: 12px;
  top: 10px;
  bottom: 10px;
  width: 192px;
  display: flex;
  flex-direction: column;
  gap: 9px;
  z-index: 20;
  overflow: hidden;
}

.se-panel {
  border: 1px solid color-mix(in srgb, var(--tone) 55%, transparent);
  border-radius: 10px;
  background: rgba(8, 12, 32, 0.9);
  box-shadow: 0 0 14px color-mix(in srgb, var(--tone) 12%, transparent);
  padding: 7px 12px 9px;
  flex: none;
}

.se-panel[data-tone="cyan"]  { --tone: var(--cyan); }
.se-panel[data-tone="pink"]  { --tone: var(--pink); }
.se-panel[data-tone="lime"]  { --tone: var(--lime); }

.se-panel .lbl {
  font-size: 0.6rem;
  font-weight: 800;
  letter-spacing: 0.24em;
  color: var(--text-1);
}

.se-panel .val {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.5rem;
  font-weight: 800;
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
  color: var(--tone);
  text-shadow: 0 0 12px color-mix(in srgb, var(--tone) 50%, transparent);
}

.se-panel .bar {
  height: 8px;
  margin-top: 4px;
  border: 1px solid rgba(244, 247, 255, 0.18);
  border-radius: 4px;
  background: rgba(10, 8, 22, 0.9);
  overflow: hidden;
}

.se-panel .bar > i {
  display: block;
  height: 100%;
  width: 0%;
  background: linear-gradient(90deg, var(--pink), #ff7ca8);
  box-shadow: 0 0 10px color-mix(in srgb, var(--pink) 60%, transparent);
  transition: width 0.25s ease;
}

.se-panel .cardicon {
  width: 26px;
  height: 17px;
  border: 1.6px solid var(--lime);
  border-radius: 3px;
  position: relative;
  box-shadow: 0 0 8px color-mix(in srgb, var(--lime) 50%, transparent);
}

.se-panel .cardicon::before {
  content: "";
  position: absolute;
  left: 3px;
  top: 4px;
  width: 6px;
  height: 6px;
  background: var(--lime);
}

.se-panel .cardicon::after {
  content: "";
  position: absolute;
  right: 3px;
  top: 4px;
  width: 9px;
  height: 2px;
  background: var(--lime);
  box-shadow: 0 4px 0 var(--lime);
}

/* ---------- chú giải ---------- */

.se-legend {
  border: 1px solid rgba(140, 160, 220, 0.28);
  border-radius: 10px;
  background: rgba(8, 12, 32, 0.9);
  padding: 8px 12px;
  display: grid;
  gap: 5px;
  overflow: hidden;
  min-height: 0;
}

.se-legend .row {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--text-1);
  white-space: nowrap;
}

.se-legend .ic {
  flex: none;
  width: 18px;
  height: 12px;
  position: relative;
}

.se-legend .ic.you::before {
  content: "";
  position: absolute;
  left: 3px;
  top: 0;
  width: 11px;
  height: 11px;
  border-radius: 3px;
  background: #26314e;
  border: 1px solid var(--cyan);
  box-shadow: 0 0 6px color-mix(in srgb, var(--cyan) 70%, transparent);
}

.se-legend .ic.guard::before {
  content: "";
  position: absolute;
  left: 3px;
  top: 0;
  width: 11px;
  height: 11px;
  border-radius: 3px;
  background: #5a1c28;
  border: 1px solid #ff3b52;
}

.se-legend .ic.cam::before {
  content: "";
  position: absolute;
  left: 2px;
  top: 1px;
  width: 13px;
  height: 9px;
  border-radius: 2px;
  background: linear-gradient(90deg, #9aa5c0, #4d5878);
}

.se-legend .ic.route { border-top: 2px dashed rgba(255, 70, 90, 0.85); top: 5px; }
.se-legend .ic.path  { border-top: 2px dashed rgba(80, 240, 120, 0.9); top: 5px; }

.se-legend .ic.wall::before {
  content: "";
  position: absolute;
  left: 3px;
  top: 0;
  width: 11px;
  height: 11px;
  background: #3c4668;
  border-top: 3px solid #545f86;
}

.se-legend .ic.shadow::before {
  content: "";
  position: absolute;
  left: 3px;
  top: 0;
  width: 11px;
  height: 11px;
  background: #0d1122;
  border: 1px solid rgba(90, 110, 170, 0.4);
}

.se-legend .ic.vision::before {
  content: "";
  position: absolute;
  left: 2px;
  top: 0;
  border-left: 14px solid rgba(255, 52, 74, 0.55);
  border-top: 6px solid transparent;
  border-bottom: 6px solid transparent;
}

/* ---------- hàng nút dưới ---------- */

.se-actions {
  position: absolute;
  left: calc(50% + 100px);
  bottom: 12px;
  transform: translateX(-50%);
  display: flex;
  gap: 14px;
  z-index: 20;
}

.se-btn {
  appearance: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 9px;
  min-height: 44px;
  padding: 0 22px;
  border: 1.6px solid color-mix(in srgb, var(--tone) 70%, transparent);
  border-radius: 10px;
  background: rgba(8, 12, 32, 0.88);
  color: var(--tone);
  font-family: inherit;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.16em;
  box-shadow: 0 0 14px color-mix(in srgb, var(--tone) 14%, transparent);
  transition: box-shadow 0.15s ease, transform 0.15s ease;
}

.se-btn[data-tone="cyan"]   { --tone: var(--cyan); }
.se-btn[data-tone="violet"] { --tone: var(--violet); }
.se-btn[data-tone="lime"]   { --tone: var(--lime); }

.se-btn:hover {
  box-shadow: 0 0 22px color-mix(in srgb, var(--tone) 40%, transparent);
  transform: translateY(-1px);
}

.se-btn svg { width: 16px; height: 16px; }

@media (max-width: 759px) {
  .se-side { display: none; }
  .se-actions { left: 50%; }
  .se-btn { padding: 0 12px; min-height: 38px; font-size: 0.64rem; }
}
`;
