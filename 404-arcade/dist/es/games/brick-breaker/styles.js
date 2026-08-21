/**
 * styles.js — CSS riêng Brick Breaker 404: tiêu đề hộp góc trái trên,
 * sân chơi lớn bên trái, sidebar PHẢI gồm cụm nút hệ thống 2×2 +
 * panel ĐIỂM / MẠNG / MÀN / COMBO + chú giải gạch (theo ảnh reference).
 */

export const BB_CSS = /* css */ `
.bb-layout {
  position: absolute;
  inset: 0;
  display: flex;
  gap: 12px;
  padding: 12px;
}

.bb-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.bb-head { flex: none; display: flex; }

.bb-titlebox {
  position: relative;
  padding: 8px 22px 9px 16px;
  border: 1px solid color-mix(in srgb, var(--cyan) 55%, transparent);
  background: rgba(7, 11, 30, 0.92);
  clip-path: polygon(0 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%);
  box-shadow: 0 0 18px color-mix(in srgb, var(--cyan) 18%, transparent);
}

.bb-titlebox .exp-title .deco { width: 100%; }

.bb-stage {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bb-stage canvas {
  touch-action: none;
  display: block;
  cursor: none;
}

/* ---------- Sidebar phải ---------- */

.bb-side {
  flex: none;
  width: 214px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
  min-height: 0;
  scrollbar-width: thin;
}

.bb-side .exp-btns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 9px;
  border: 1px solid color-mix(in srgb, var(--cyan) 30%, transparent);
  background: rgba(7, 11, 30, 0.85);
  clip-path: polygon(10px 0, 100% 0, 100% 100%, 0 100%, 0 10px);
}

.bb-side .exp-btn { min-width: 0; width: 100%; }

.bb-panel {
  --tone: var(--cyan);
  position: relative;
  border: 1px solid color-mix(in srgb, var(--tone) 55%, transparent);
  background: rgba(7, 11, 30, 0.88);
  clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
  padding: 9px 12px 11px;
  text-align: center;
  box-shadow: inset 0 0 22px color-mix(in srgb, var(--tone) 7%, transparent);
}

.bb-panel[data-tone="pink"]  { --tone: var(--pink); }
.bb-panel[data-tone="lime"]  { --tone: var(--lime); }
.bb-panel[data-tone="green"] { --tone: var(--green); }

.bb-panel .lbl {
  font-size: 0.6rem;
  font-weight: 800;
  letter-spacing: 0.3em;
  color: var(--tone);
  margin-bottom: 4px;
}

.bb-panel .val {
  font-size: 1.55rem;
  font-weight: 800;
  line-height: 1.05;
  font-variant-numeric: tabular-nums;
  color: var(--tone);
  text-shadow: 0 0 14px color-mix(in srgb, var(--tone) 55%, transparent);
}

.bb-hearts {
  display: flex;
  gap: 7px;
  justify-content: center;
  padding: 3px 0 1px;
}

.bb-hearts canvas {
  width: 26px;
  height: 23px;
  image-rendering: pixelated;
}

.bb-comboseg {
  display: flex;
  gap: 3px;
  margin-top: 7px;
}

.bb-comboseg i {
  flex: 1;
  height: 8px;
  background: rgba(120, 240, 130, 0.14);
  border: 1px solid rgba(120, 240, 130, 0.2);
}

.bb-comboseg i.on {
  background: var(--lime);
  border-color: var(--lime);
  box-shadow: 0 0 8px color-mix(in srgb, var(--lime) 60%, transparent);
}

.bb-legend { text-align: left; display: grid; gap: 7px; }

.bb-legend-row { display: flex; align-items: center; gap: 9px; }

.bb-legend-row canvas { width: 30px; height: 22px; flex: none; }

.bb-legend-row span {
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--text-1);
}

/* ---------- Responsive ---------- */

@media (max-width: 900px) {
  .bb-layout { flex-direction: column; padding: 8px; gap: 8px; }
  .bb-side {
    width: 100%;
    flex-direction: row;
    flex-wrap: wrap;
    order: -1;
    overflow: visible;
  }
  .bb-side .exp-btns { order: -1; display: flex; padding: 6px; flex: 1 1 100%; }
  .bb-panel { flex: 1 1 90px; padding: 6px 8px 8px; }
  .bb-panel .val { font-size: 1.05rem; }
  .bb-panel .lbl { font-size: 0.52rem; letter-spacing: 0.18em; margin-bottom: 2px; }
  .bb-panel.bb-panel-legend { display: none; }
  .bb-hearts canvas { width: 18px; height: 16px; }
  .bb-comboseg { margin-top: 4px; }
  .bb-head { display: none; }
  .bb-stage canvas { cursor: default; }
}
`;
