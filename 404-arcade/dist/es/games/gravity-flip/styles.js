/**
 * styles.js — CSS riêng Gravity Flip 404: thanh "CHẠM ĐỂ ĐẢO TRỌNG LỰC"
 * viền cyan cắt góc dưới đáy màn chơi (theo reference), kiêm vùng chạm.
 */

export const GF_CSS = /* css */ `
.gf-mode .exp-title {
  border: 1px solid rgba(244, 247, 255, 0.28);
  padding: 5px 16px 7px;
  border-radius: 8px;
  background: rgba(7, 11, 30, 0.9);
}

.gf-stage {
  position: absolute;
  inset: 0;
}

.gf-stage canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  touch-action: none;
  cursor: pointer;
}

/* ---------- thanh hướng dẫn chạm dưới đáy ---------- */

.gf-hint {
  position: absolute;
  left: 50%;
  bottom: 14px;
  transform: translateX(-50%);
  width: min(760px, 86%);
  min-height: 62px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  z-index: 18;
  border: 1.6px solid rgba(32, 227, 255, 0.6);
  border-radius: 12px;
  background: rgba(6, 10, 28, 0.78);
  box-shadow: 0 0 22px rgba(32, 227, 255, 0.18), inset 0 0 30px rgba(10, 20, 60, 0.55);
  clip-path: polygon(18px 0, calc(100% - 18px) 0, 100% 50%, calc(100% - 18px) 100%, 18px 100%, 0 50%);
  pointer-events: none;
  user-select: none;
  transition: opacity 0.4s ease;
}

.gf-hint.dim { opacity: 0.4; }

.gf-hint .hand {
  width: 34px;
  height: 34px;
  color: #eef4ff;
  filter: drop-shadow(0 0 8px rgba(32, 227, 255, 0.8));
  flex: none;
}

.gf-hint .txt {
  font-size: clamp(0.95rem, 2.6vw, 1.5rem);
  font-weight: 800;
  letter-spacing: 0.08em;
  color: var(--text-0);
  text-shadow: 0 0 14px rgba(120, 200, 255, 0.5);
  white-space: nowrap;
}

.gf-hint .txt b {
  color: var(--cyan);
  font-weight: 800;
  text-shadow: 0 0 16px rgba(32, 227, 255, 0.8);
}

@media (max-width: 700px) {
  .gf-hint { min-height: 48px; gap: 10px; }
  .gf-hint .hand { width: 24px; height: 24px; }
}
`;
