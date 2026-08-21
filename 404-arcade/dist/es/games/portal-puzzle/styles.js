/**
 * styles.js — CSS riêng của Portal Puzzle 404 (sidebar mục tiêu + chú
 * giải bên trái, board giữa, thanh hành động HOÀN TÁC / CHƠI LẠI / GỢI Ý
 * bên dưới — theo bố cục ảnh reference).
 */

export const PP_CSS = /* css */ `
.pp-layout {
  position: absolute;
  inset: 0;
  display: flex;
  gap: 12px;
  padding: 12px;
}

.pp-side {
  flex: none;
  width: 196px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: auto;
  min-height: 0;
}

.pp-panel {
  border: 1px solid color-mix(in srgb, var(--cyan) 30%, transparent);
  border-radius: 8px;
  background: rgba(8, 13, 32, 0.85);
  padding: 12px 13px;
}

.pp-panel h3 {
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.24em;
  color: var(--cyan);
  margin-bottom: 8px;
}

.pp-panel p {
  font-size: 0.72rem;
  line-height: 1.55;
  color: var(--text-1);
}

.pp-legend { display: grid; gap: 7px; }

.pp-legend-row {
  display: flex;
  align-items: center;
  gap: 9px;
}

.pp-legend-row canvas {
  width: 26px;
  height: 26px;
  flex: none;
  border-radius: 5px;
  background: rgba(13, 19, 44, 0.9);
  border: 1px solid rgba(96, 128, 210, 0.25);
}

.pp-legend-row span {
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--text-1);
}

.pp-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pp-board {
  position: relative;
  flex: 1;
  min-height: 0;
}

.pp-board canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  touch-action: none;
}

.pp-actions {
  flex: none;
  display: flex;
  justify-content: center;
  gap: 14px;
  padding: 2px 0 4px;
}

.pp-action {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  min-height: 44px;
  min-width: 148px;
  padding: 0 20px;
  clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
  border: none;
  background:
    linear-gradient(rgba(8, 13, 32, 0.92), rgba(8, 13, 32, 0.92)) padding-box,
    var(--tone) border-box;
  color: var(--tone);
  font-family: inherit;
  font-size: 0.74rem;
  font-weight: 800;
  letter-spacing: 0.16em;
  cursor: pointer;
  outline: 1px solid color-mix(in srgb, var(--tone) 70%, transparent);
  outline-offset: -1px;
  transition: box-shadow 0.15s ease, transform 0.15s ease;
}

.pp-action:hover {
  box-shadow: 0 0 18px color-mix(in srgb, var(--tone) 40%, transparent);
  transform: translateY(-1px);
}

.pp-action .icon { width: 15px; height: 15px; }

.pp-action[data-tone="cyan"] { --tone: var(--cyan); }
.pp-action[data-tone="pink"] { --tone: var(--pink); }
.pp-action[data-tone="lime"] { --tone: var(--lime); }

.pp-badge {
  position: absolute;
  top: -7px;
  right: -7px;
  min-width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
  border-radius: 5px;
  background: var(--lime);
  color: #0a1400;
  font-size: 0.66rem;
  font-weight: 800;
}

.pp-badge[data-zero] { background: rgba(168, 255, 62, 0.28); color: rgba(230, 255, 200, 0.6); }

@media (max-width: 880px) {
  .pp-side { display: none; }
  .pp-layout { padding: 8px; gap: 8px; }
  .pp-action { min-width: 0; flex: 1; max-width: 170px; }
}
`;
