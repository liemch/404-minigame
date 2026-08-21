/**
 * styles.js — CSS riêng Memory Matrix 404: sidebar phải với panel GỢI Ý
 * (bóng đèn + số lượt gợi ý còn lại) và panel CHƠI LẠI — theo reference.
 */

export const MM_CSS = /* css */ `
.mm-mode .exp-title {
  border: 1px solid rgba(32, 227, 255, 0.4);
  padding: 5px 16px 7px;
  border-radius: 8px;
  background: rgba(7, 11, 30, 0.9);
  box-shadow: 0 0 16px rgba(32, 227, 255, 0.14);
}

.mm-stage {
  position: absolute;
  inset: 0;
}

.mm-stage canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  touch-action: manipulation;
  cursor: pointer;
}

/* ---------- sidebar phải ---------- */

.mm-side {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  width: 186px;
  display: grid;
  gap: 18px;
  z-index: 20;
}

.mm-panel {
  border: 1px solid color-mix(in srgb, var(--tone) 55%, transparent);
  border-radius: 12px;
  background: rgba(8, 12, 32, 0.88);
  box-shadow: 0 0 18px color-mix(in srgb, var(--tone) 16%, transparent),
    inset 0 0 22px rgba(8, 12, 40, 0.6);
  padding: 12px 14px 14px;
  text-align: center;
}

.mm-panel[data-tone="violet"] { --tone: var(--violet); }
.mm-panel[data-tone="cyan"]   { --tone: var(--cyan); }

.mm-panel .ttl {
  font-size: 0.66rem;
  font-weight: 800;
  letter-spacing: 0.3em;
  color: var(--text-0);
  margin-bottom: 10px;
}

.mm-panel .act {
  appearance: none;
  cursor: pointer;
  width: 100%;
  min-height: 76px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1.6px solid color-mix(in srgb, var(--tone) 75%, transparent);
  border-radius: 10px;
  background: linear-gradient(180deg, rgba(20, 16, 52, 0.9), rgba(10, 9, 30, 0.92));
  color: var(--tone);
  transition: box-shadow 0.15s ease, transform 0.15s ease;
}

.mm-panel .act:hover {
  box-shadow: 0 0 22px color-mix(in srgb, var(--tone) 45%, transparent);
  transform: translateY(-1px);
}

.mm-panel .act:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.mm-panel .act svg {
  width: 40px;
  height: 40px;
  filter: drop-shadow(0 0 8px color-mix(in srgb, var(--tone) 70%, transparent));
}

.mm-panel .gems {
  margin-top: 10px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 3px 14px;
  border: 1px solid rgba(244, 247, 255, 0.2);
  border-radius: 999px;
  background: rgba(12, 10, 34, 0.9);
  font-size: 0.82rem;
  font-weight: 800;
  color: var(--text-0);
}

.mm-panel .gems i {
  width: 11px;
  height: 11px;
  background: var(--pink);
  clip-path: polygon(50% 0, 100% 38%, 50% 100%, 0 38%);
  box-shadow: 0 0 8px var(--pink);
}

@media (max-width: 719px) {
  .mm-side {
    right: 8px;
    top: auto;
    bottom: 8px;
    transform: none;
    width: auto;
    display: flex;
    gap: 10px;
  }
  .mm-panel { padding: 8px 10px; }
  .mm-panel .ttl { margin-bottom: 6px; font-size: 0.56rem; }
  .mm-panel .act { min-height: 46px; min-width: 64px; }
  .mm-panel .act svg { width: 24px; height: 24px; }
  .mm-panel .gems { margin-top: 6px; font-size: 0.66rem; padding: 2px 10px; }
}
`;
