/**
 * styles.js — CSS riêng Neon Drift 404: panel minimap góc trái trên và
 * cụm nút cảm ứng ◀ ▶ + NITRO tròn góc phải dưới (theo ảnh reference,
 * nút ≥ 44px, touch-action none để không cuộn trang).
 */

export const ND_CSS = /* css */ `
.nd-minimap {
  position: absolute;
  top: 14px;
  left: 14px;
  z-index: 20;
  padding: 7px;
  border: 1px solid color-mix(in srgb, var(--cyan) 40%, transparent);
  border-radius: 12px;
  background: rgba(6, 9, 24, 0.82);
  box-shadow: 0 0 18px rgba(32, 227, 255, 0.12);
  pointer-events: none;
}

.nd-minimap canvas {
  width: 128px;
  height: 92px;
  display: block;
}

.nd-touch {
  position: absolute;
  right: 16px;
  bottom: 16px;
  z-index: 25;
  display: none;
  align-items: center;
  gap: 12px;
}

.exp-root[data-touch="1"] .nd-touch { display: flex; }

.nd-steer {
  width: 74px;
  height: 74px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid color-mix(in srgb, var(--cyan) 55%, transparent);
  clip-path: polygon(16px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%, 0 16px);
  background: rgba(8, 12, 30, 0.78);
  color: var(--text-0);
  font-size: 1.5rem;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  cursor: pointer;
}

.nd-steer:active,
.nd-steer.held {
  background: color-mix(in srgb, var(--cyan) 22%, rgba(8, 12, 30, 0.8));
  color: var(--cyan);
}

.nd-nitro {
  width: 96px;
  height: 96px;
  margin-left: 8px;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  border-radius: 50%;
  border: 2px solid var(--cyan);
  background: radial-gradient(circle at 50% 36%, rgba(32, 227, 255, 0.25), rgba(8, 12, 30, 0.9) 68%);
  color: var(--cyan);
  font-family: inherit;
  font-size: 0.66rem;
  font-weight: 800;
  letter-spacing: 0.18em;
  box-shadow: 0 0 22px rgba(32, 227, 255, 0.3);
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  cursor: pointer;
}

.nd-nitro svg { width: 26px; height: 26px; }

.nd-nitro:active,
.nd-nitro.held {
  background: radial-gradient(circle at 50% 36%, rgba(32, 227, 255, 0.5), rgba(8, 12, 30, 0.92) 70%);
  box-shadow: 0 0 34px rgba(32, 227, 255, 0.55);
}

.nd-nitro[data-empty] { opacity: 0.45; }

@media (max-width: 700px) {
  .nd-minimap canvas { width: 96px; height: 69px; }
}
`;
