/**
 * styles.js — CSS riêng Cyber Defense: thanh chọn tháp dưới đáy (3 tháp
 * + 2 ô khóa theo wave như ảnh), panel nâng cấp/bán tháp bên phải,
 * chip đếm ngược wave và minimap góc phải dưới.
 */

export const CD_CSS = /* css */ `
.cd-stage {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
}

/* ---------- thanh xây tháp ---------- */
.cd-buildbar {
  position: absolute;
  left: 50%;
  bottom: 12px;
  transform: translateX(-50%);
  z-index: 26;
  display: flex;
  gap: 10px;
  padding: 10px 14px;
  border: 1px solid color-mix(in srgb, var(--cyan) 30%, transparent);
  border-radius: 12px;
  background: rgba(6, 10, 26, 0.9);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.45);
}

.cd-slot {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  width: 72px;
  padding: 7px 4px 6px;
  border: 1px solid rgba(244, 247, 255, 0.16);
  border-radius: 9px;
  background: rgba(12, 18, 42, 0.8);
  color: var(--text-0);
  cursor: pointer;
  font-family: inherit;
  transition: border-color 0.14s ease, box-shadow 0.14s ease, transform 0.14s ease;
}

.cd-slot canvas { width: 44px; height: 44px; }

.cd-slot .cost {
  font-size: 0.68rem;
  font-weight: 800;
  color: var(--gold);
  letter-spacing: 0.05em;
}

.cd-slot:hover { border-color: var(--cyan); transform: translateY(-2px); }

.cd-slot.armed {
  border-color: var(--cyan);
  box-shadow: 0 0 16px color-mix(in srgb, var(--cyan) 45%, transparent);
  background: color-mix(in srgb, var(--cyan) 14%, rgba(12, 18, 42, 0.8));
}

.cd-slot[data-poor] .cost { color: var(--red); }
.cd-slot[data-poor] canvas { opacity: 0.45; }

.cd-slot.locked { cursor: not-allowed; }
.cd-slot.locked canvas { opacity: 0.18; }

.cd-lock {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  width: 22px;
  height: 22px;
  color: var(--text-1);
}

.cd-slot .wavetag {
  font-size: 0.56rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  color: var(--text-1);
}

.cd-key {
  position: absolute;
  top: -7px;
  left: -6px;
  min-width: 17px;
  height: 17px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  background: rgba(32, 227, 255, 0.16);
  border: 1px solid rgba(32, 227, 255, 0.4);
  color: var(--cyan);
  font-size: 0.6rem;
  font-weight: 800;
}

/* ---------- panel tháp được chọn ---------- */
.cd-panel {
  position: absolute;
  top: 14px;
  right: 14px;
  z-index: 26;
  width: 218px;
  padding: 1px;
  clip-path: polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px);
  background: linear-gradient(160deg, color-mix(in srgb, var(--cyan) 60%, transparent), color-mix(in srgb, var(--cyan) 14%, transparent));
}

.cd-panel > .in {
  clip-path: polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px);
  background: rgba(7, 12, 30, 0.96);
  padding: 13px 14px;
}

.cd-panel h3 {
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: var(--cyan);
  text-align: center;
  margin-bottom: 8px;
}

.cd-lv {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 0.66rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: var(--text-1);
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(244, 247, 255, 0.1);
  margin-bottom: 9px;
}

.cd-lv b { color: var(--text-0); }
.cd-lv .next { color: var(--cyan); }
.cd-lv .arrow { color: var(--cyan); }

.cd-stat { margin-bottom: 8px; }

.cd-stat .lbl {
  display: flex;
  justify-content: space-between;
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  color: var(--text-1);
  margin-bottom: 4px;
}

.cd-pips { display: flex; gap: 3px; }

.cd-pips i {
  width: 14px;
  height: 6px;
  border-radius: 2px;
  background: rgba(244, 247, 255, 0.14);
}

.cd-pips i.on { background: var(--cyan); }
.cd-pips i.gain { background: color-mix(in srgb, var(--lime) 85%, transparent); }

.cd-upgrade {
  width: 100%;
  min-height: 42px;
  margin-top: 4px;
  border: none;
  clip-path: polygon(9px 0, 100% 0, 100% calc(100% - 9px), calc(100% - 9px) 100%, 0 100%, 0 9px);
  background: var(--cyan);
  color: #04121e;
  font-family: inherit;
  font-size: 0.74rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  cursor: pointer;
}

.cd-upgrade:disabled { background: rgba(120, 140, 180, 0.35); color: rgba(230, 240, 255, 0.5); cursor: not-allowed; }

.cd-sell {
  width: 100%;
  min-height: 34px;
  margin-top: 7px;
  border: 1px solid color-mix(in srgb, var(--gold) 55%, transparent);
  border-radius: 7px;
  background: color-mix(in srgb, var(--gold) 8%, transparent);
  color: var(--gold);
  font-family: inherit;
  font-size: 0.66rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  cursor: pointer;
}

.cd-sell:hover { background: color-mix(in srgb, var(--gold) 18%, transparent); }

/* ---------- chip wave + minimap ---------- */
.cd-prep {
  position: absolute;
  left: 50%;
  bottom: 118px;
  transform: translateX(-50%);
  z-index: 25;
  padding: 7px 18px;
  border: 1px solid color-mix(in srgb, var(--lime) 55%, transparent);
  border-radius: 7px;
  background: rgba(8, 14, 8, 0.88);
  color: var(--lime);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.16em;
  pointer-events: none;
}

.cd-minimap {
  position: absolute;
  right: 14px;
  bottom: 12px;
  z-index: 24;
  padding: 7px;
  border: 1px solid color-mix(in srgb, var(--cyan) 32%, transparent);
  border-radius: 10px;
  background: rgba(6, 10, 26, 0.85);
  pointer-events: none;
}

.cd-minimap canvas { width: 150px; height: 86px; display: block; }

@media (max-width: 900px) {
  .cd-minimap { display: none; }
  .cd-panel { width: 190px; top: 8px; right: 8px; }
  .cd-buildbar { gap: 6px; padding: 8px; bottom: 8px; }
  .cd-slot { width: 62px; }
}
`;
