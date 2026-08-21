/**
 * styles.js — CSS riêng Pixel Golf 404: cột panel nổi bên trái
 * (HỐ / GẬY / PAR / ĐIỂM / GIÓ), panel hướng dẫn kéo-thả góc trái dưới,
 * thanh SỨC MẠNH gradient giữa đáy — theo ảnh reference.
 */

export const PG_CSS = /* css */ `
.pg-stage {
  position: absolute;
  inset: 0;
}

.pg-stage canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  touch-action: none;
}

/* ---------- cột panel trái ---------- */

.pg-panels {
  position: absolute;
  left: 14px;
  top: 14px;
  display: flex;
  flex-direction: column;
  gap: 9px;
  z-index: 20;
  pointer-events: none;
}

.pg-panel {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 138px;
  padding: 7px 14px 8px 10px;
  border: 1px solid rgba(122, 63, 212, 0.55);
  border-radius: 10px;
  background: rgba(10, 8, 30, 0.88);
  box-shadow: 0 0 14px rgba(122, 63, 212, 0.18);
}

.pg-panel canvas { width: 22px; height: 22px; flex: none; }

.pg-panel .txt { line-height: 1.1; }

.pg-panel .lbl {
  font-size: 0.58rem;
  font-weight: 800;
  letter-spacing: 0.22em;
  color: var(--text-1);
}

.pg-panel .val {
  font-size: 1.18rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: var(--text-0);
}

.pg-panel[data-tone="cyan"]  .val { color: var(--cyan); text-shadow: 0 0 10px color-mix(in srgb, var(--cyan) 50%, transparent); }
.pg-panel[data-tone="green"] .val { color: var(--green); text-shadow: 0 0 10px color-mix(in srgb, var(--green) 50%, transparent); }
.pg-panel[data-tone="violet"].pg-panel .val, .pg-panel[data-tone="violet"] .val { color: var(--violet); text-shadow: 0 0 10px color-mix(in srgb, var(--violet) 50%, transparent); }
.pg-panel[data-tone="pink"]  .val { color: var(--pink); text-shadow: 0 0 10px color-mix(in srgb, var(--pink) 50%, transparent); }

.pg-panel .val small { font-size: 0.72rem; color: var(--text-1); font-weight: 700; }

.pg-wind-dir { display: inline-block; margin-left: 6px; color: var(--cyan); }

/* ---------- hướng dẫn + thanh lực ---------- */

.pg-help {
  position: absolute;
  left: 14px;
  bottom: 14px;
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 10px 16px;
  border: 1px solid rgba(122, 63, 212, 0.55);
  border-radius: 10px;
  background: rgba(10, 8, 30, 0.88);
  z-index: 20;
  pointer-events: none;
}

.pg-help svg { width: 22px; height: 22px; color: var(--text-0); }

.pg-help .txt {
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.16em;
  color: var(--text-0);
  line-height: 1.5;
}

.pg-power {
  position: absolute;
  left: 50%;
  bottom: 14px;
  transform: translateX(-50%);
  width: min(430px, 60vw);
  z-index: 20;
  pointer-events: none;
  text-align: center;
}

.pg-power .lbl {
  font-size: 0.64rem;
  font-weight: 800;
  letter-spacing: 0.3em;
  color: var(--text-0);
  margin-bottom: 5px;
  text-shadow: 0 0 10px rgba(32, 227, 255, 0.4);
}

.pg-power .bar {
  position: relative;
  height: 20px;
  border: 1px solid rgba(32, 227, 255, 0.55);
  border-radius: 6px;
  background: rgba(8, 10, 28, 0.9);
  padding: 3px;
  box-shadow: 0 0 16px rgba(32, 227, 255, 0.2);
}

.pg-power .segs {
  display: flex;
  gap: 2px;
  height: 100%;
}

.pg-power .segs i {
  flex: 1;
  border-radius: 1.6px;
  background: var(--seg, #235);
  opacity: 0.22;
}

.pg-power .segs i.on { opacity: 1; box-shadow: 0 0 7px var(--seg); }

.pg-power .marker {
  position: absolute;
  top: -3px;
  bottom: -3px;
  width: 4px;
  border-radius: 2px;
  background: #fff;
  box-shadow: 0 0 8px rgba(255,255,255,0.9);
  transform: translateX(-2px);
  transition: left 0.03s linear;
}

@media (max-width: 760px) {
  .pg-panels { transform: scale(0.82); transform-origin: top left; }
  .pg-help { display: none; }
  .pg-power { width: 52vw; left: auto; right: 12px; transform: none; }
}
`;
