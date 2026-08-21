/**
 * styles.js — CSS riêng Cyber Goal 404: tỷ số hai màu trên topbar
 * (bạn cyan / CPU hồng) + hàng nút chọn difficulty ở màn hướng dẫn.
 */

export const CG_CSS = /* css */ `
.cg-mode .exp-title {
  border: 1px solid rgba(255, 46, 166, 0.45);
  padding: 5px 16px 7px;
  border-radius: 8px;
  background: rgba(7, 11, 30, 0.9);
  box-shadow: 0 0 16px rgba(255, 46, 166, 0.14);
}

.cg-stage {
  position: absolute;
  inset: 0;
}

.cg-stage canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  touch-action: none;
  cursor: crosshair;
}

.cg-sc-p {
  color: var(--cyan);
  text-shadow: 0 0 12px color-mix(in srgb, var(--cyan) 55%, transparent);
}

.cg-sc-sep { color: var(--text-1); }

.cg-sc-c {
  color: var(--pink);
  text-shadow: 0 0 12px color-mix(in srgb, var(--pink) 55%, transparent);
}

/* ---------- chọn difficulty trong intro ---------- */

.cg-diffrow {
  display: flex;
  gap: 10px;
  margin-bottom: 18px;
}

.cg-diffbtn {
  appearance: none;
  cursor: pointer;
  min-height: 40px;
  padding: 0 22px;
  border: 1px solid rgba(244, 247, 255, 0.25);
  border-radius: 8px;
  background: rgba(12, 18, 42, 0.85);
  color: var(--text-1);
  font-family: inherit;
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.16em;
  transition: border-color 0.14s ease, color 0.14s ease, box-shadow 0.14s ease;
}

.cg-diffbtn:hover {
  border-color: var(--pink);
  color: var(--pink);
}

.cg-diffbtn.on {
  border-color: var(--pink);
  color: var(--pink);
  background: color-mix(in srgb, var(--pink) 12%, transparent);
  box-shadow: 0 0 16px color-mix(in srgb, var(--pink) 35%, transparent);
}
`;
