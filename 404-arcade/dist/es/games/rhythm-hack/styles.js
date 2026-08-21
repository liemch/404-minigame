/**
 * styles.js — CSS riêng Rhythm Hack: panel ĐIỂM/COMBO/CHÍNH XÁC bên
 * trái (khung cắt góc như ảnh), panel SYSTEM REPAIR (tim pixel + thanh
 * tiến trình) và TERMINAL bên phải, hàng phím D F J K dạng bát giác màu
 * theo lane — đồng thời là 4 vùng chạm cho mobile/tablet.
 */

export const RH_CSS = /* css */ `
.rh-layout {
  position: absolute;
  inset: 0;
  display: flex;
  gap: 10px;
  padding: 10px 12px;
}

.rh-col {
  flex: none;
  width: 176px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: hidden;
}

.rh-col.right { width: 216px; }

.rh-stage {
  position: relative;
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.rh-canvasbox { position: relative; flex: 1; min-height: 0; }

.rh-canvasbox canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  touch-action: none;
}

/* ---------- panel chỉ số trái (cắt góc như ảnh) ---------- */
.rh-panel {
  position: relative;
  padding: 1px;
  clip-path: polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px);
  background: linear-gradient(160deg, color-mix(in srgb, var(--tone, var(--cyan)) 62%, transparent), color-mix(in srgb, var(--tone, var(--cyan)) 14%, transparent));
}

.rh-panel[data-tone="cyan"]  { --tone: var(--cyan); }
.rh-panel[data-tone="pink"]  { --tone: var(--pink); }
.rh-panel[data-tone="lime"]  { --tone: var(--lime); }

.rh-panel { filter: drop-shadow(0 0 10px color-mix(in srgb, var(--tone, var(--cyan)) 28%, transparent)); }

.rh-panel > .in {
  clip-path: polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px);
  background: rgba(7, 11, 28, 0.94);
  padding: 12px 14px;
  text-align: center;
}

.rh-panel .lbl {
  font-size: 0.66rem;
  font-weight: 800;
  letter-spacing: 0.3em;
  color: var(--text-1);
  margin-bottom: 4px;
}

.rh-panel .val {
  font-size: 1.9rem;
  font-weight: 800;
  line-height: 1.05;
  color: var(--tone);
  font-variant-numeric: tabular-nums;
  text-shadow: 0 0 18px color-mix(in srgb, var(--tone) 55%, transparent);
}

.rh-panel .eq {
  display: flex;
  gap: 3px;
  justify-content: center;
  margin-top: 7px;
  height: 10px;
  align-items: flex-end;
}

.rh-panel .eq i {
  width: 5px;
  background: color-mix(in srgb, var(--tone) 65%, transparent);
  height: 30%;
}

/* ---------- panel phải: SYSTEM REPAIR + TERMINAL ---------- */
.rh-side {
  border: 1px solid color-mix(in srgb, var(--cyan) 30%, transparent);
  border-radius: 8px;
  background: rgba(7, 11, 28, 0.9);
  padding: 11px 12px;
}

.rh-side h3 {
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.18em;
  color: var(--cyan);
  margin-bottom: 8px;
}

.rh-heartbox {
  display: flex;
  justify-content: center;
  padding: 6px 0 10px;
}

.rh-heartbox canvas { width: 108px; height: 96px; image-rendering: pixelated; }

.rh-progress-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.56rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--text-1);
}

.rh-progress {
  flex: 1;
  height: 8px;
  border: 1px solid color-mix(in srgb, var(--cyan) 40%, transparent);
  background: rgba(10, 16, 38, 0.9);
  overflow: hidden;
}

.rh-progress > i {
  display: block;
  height: 100%;
  width: 0%;
  background: repeating-linear-gradient(90deg, var(--cyan) 0 6px, color-mix(in srgb, var(--cyan) 45%, transparent) 6px 8px);
}

.rh-progress-pct { color: var(--cyan); font-size: 0.66rem; font-weight: 800; }

.rh-term {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.rh-term .lines {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 5px;
  font-size: 0.6rem;
  line-height: 1.4;
  color: var(--text-1);
  overflow: hidden;
}

.rh-term .lines span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rh-term .lines .ok::after { content: " OK"; color: var(--lime); font-weight: 800; }
.rh-term .lines .fail { color: var(--red); }
.rh-term .lines .info { color: var(--cyan); }
.rh-term .cursor { color: var(--text-0); animation: rhBlink 1s steps(1) infinite; }

@keyframes rhBlink { 50% { opacity: 0; } }

/* ---------- hàng phím D F J K ---------- */
.rh-keys {
  flex: none;
  display: flex;
  justify-content: center;
  gap: 14px;
  padding: 10px 0 4px;
}

.rh-key {
  width: 76px;
  height: 64px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  clip-path: polygon(24% 0, 76% 0, 100% 26%, 100% 74%, 76% 100%, 24% 100%, 0 74%, 0 26%);
  border: none;
  outline: 3px solid var(--tone);
  outline-offset: -3px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--tone) 16%, rgba(14, 20, 46, 0.95)), rgba(6, 9, 24, 0.97));
  color: var(--tone);
  font-family: inherit;
  font-size: 1.55rem;
  font-weight: 800;
  text-shadow: 0 0 12px color-mix(in srgb, var(--tone) 75%, transparent);
  cursor: pointer;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  filter: drop-shadow(0 0 9px color-mix(in srgb, var(--tone) 45%, transparent));
  transition: transform 0.06s ease, filter 0.06s ease;
}

.rh-key[data-tone="cyan"]  { --tone: var(--cyan); }
.rh-key[data-tone="violet"]{ --tone: var(--violet); }
.rh-key[data-tone="pink"]  { --tone: var(--pink); }
.rh-key[data-tone="lime"]  { --tone: var(--lime); }

.rh-key.held,
.rh-key:active {
  transform: translateY(3px);
  filter: drop-shadow(0 0 16px color-mix(in srgb, var(--tone) 80%, transparent));
  background: linear-gradient(180deg, color-mix(in srgb, var(--tone) 34%, rgba(14, 20, 46, 0.95)), rgba(7, 10, 26, 0.95));
}

@media (max-width: 920px) {
  .rh-col { display: none; }
  .rh-key { width: 56px; height: 50px; }
}
`;
