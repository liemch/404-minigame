/**
 * styles.js — CSS riêng Typing Rush 404: khung chữ rơi neon, DANGER
 * LINE đỏ, bàn phím QWERTY ảo phím sáng, panel HEAT MAP — theo ảnh.
 * Khung chip / chevron / danger line / deco hai bên dùng sprite cắt
 * từ chính ảnh tham chiếu (assets.js, border-image 9-slice — chữ vẫn
 * là DOM động).
 */

import { URLS } from "./assets.js";

export const TR_CSS = /* css */ `
.tr-mode .exp-title {
  border: 1px solid rgba(244, 247, 255, 0.3);
  padding: 5px 16px 7px;
  border-radius: 8px;
  background: rgba(7, 11, 30, 0.9);
}

.tr-mode .exp-stats {
  border: 1px solid rgba(150, 170, 230, 0.22);
  border-radius: 10px;
  background: rgba(7, 11, 28, 0.66);
  flex: 0 1 auto;
  margin: 0 auto;
  padding: 0 6px;
}

.tr-rain {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.tr-field {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

/* ---------- khung từ rơi ---------- */

.tr-word {
  --tone: var(--cyan);
  position: absolute;
  transform: translate(-50%, -50%);
  padding: 3px 7px;
  border: 13px solid transparent;
  border-image: url("${URLS.chipCyan}") 24 / 13px stretch;
  border-radius: 0;
  background: rgba(6, 9, 24, 0.92);
  background-clip: padding-box;
  font-size: 1.06rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  white-space: nowrap;
  color: var(--text-0);
}

.tr-word .tag { color: var(--tone); font-size: 0.8em; margin-right: 7px; opacity: 0.9; }
.tr-word .done { color: var(--cyan); }
.tr-word[data-tone="violet"]  { --tone: var(--violet); border-image-source: url("${URLS.chipViolet}"); }
.tr-word[data-tone="magenta"] { --tone: var(--pink); border-image-source: url("${URLS.chipPink}"); }
.tr-word[data-tone="white"]   { --tone: #dfe6ff; border-image-source: url("${URLS.chipWhite}"); }

.tr-word.active {
  --tone: #c8f542;
  border-width: 20px;
  border-image: url("${URLS.chipActive}") 38 / 20px stretch;
  padding: 0 4px;
  font-size: 1.3rem;
  z-index: 5;
}

/* ngoặc góc đã nằm sẵn trong sprite khung active — ẩn bản vẽ code */
.tr-word .ck { display: none; }

.tr-word.active::before {
  content: "";
  position: absolute;
  left: 50%;
  top: -58px;
  width: 20px;
  height: 32px;
  transform: translateX(-50%);
  background: url("${URLS.chevron}") center / contain no-repeat;
  filter: drop-shadow(0 0 8px rgba(200, 245, 66, 0.7));
  animation: trChev 0.7s linear infinite;
}

@keyframes trChev { 50% { transform: translateX(-50%) translateY(4px); } }

.tr-word.shake { animation: trShake 0.18s linear; }

@keyframes trShake {
  25% { margin-left: -5px; }
  75% { margin-left: 5px; }
}

.tr-word.pop { animation: trPop 0.28s ease forwards; }

@keyframes trPop {
  40% { transform: translate(-50%, -50%) scale(1.18); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
}

/* ---------- danger line ---------- */

.tr-danger {
  position: absolute;
  left: 3%;
  right: 3%;
  display: flex;
  align-items: center;
  gap: 12px;
  z-index: 6;
  pointer-events: none;
}

.tr-danger .line {
  flex: 1;
  height: 11px;
  background: url("${URLS.dangerLine}");
  background-size: 100% 100%;
  animation: trPulse 1.6s ease-in-out infinite;
}

@keyframes trPulse { 50% { opacity: 0.55; } }

.tr-danger .lbl {
  flex: none;
  font-size: 0.66rem;
  font-weight: 800;
  letter-spacing: 0.3em;
  color: #ff4d66;
  text-shadow: 0 0 12px rgba(255, 46, 77, 0.7);
}

.tr-danger .warn {
  flex: none;
  width: 26px;
  height: 23px;
  background: url("${URLS.warnTri}") center / contain no-repeat;
  filter: drop-shadow(0 0 6px rgba(255, 46, 77, 0.6));
  position: relative;
}

.tr-flash {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 50% 70%, rgba(255, 30, 60, 0.28), transparent 65%);
  opacity: 0;
  pointer-events: none;
  z-index: 7;
}

.tr-flash.on { animation: trFlash 0.5s ease; }

@keyframes trFlash { 12% { opacity: 1; } 100% { opacity: 0; } }

/* ---------- khu dưới: bàn phím + heat map ---------- */

.tr-bottom {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: flex-end;
  gap: 14px;
  padding: 8px 14px 12px;
  z-index: 8;
  pointer-events: none;
}

.tr-kb {
  flex: 1;
  max-width: 760px;
  margin: 0 auto;
  display: grid;
  gap: 5px;
}

.tr-kb-row { display: flex; gap: 5px; }

.tr-key {
  flex: 1 1 0;
  min-height: 34px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0;
  border: 1px solid rgba(150, 170, 230, 0.28);
  border-radius: 7px;
  background: rgba(13, 18, 40, 0.88);
  color: var(--text-1);
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  line-height: 1.1;
  transition: background 0.12s ease, color 0.12s ease, box-shadow 0.12s ease;
}

.tr-key .sup { font-size: 0.5rem; opacity: 0.65; }
.tr-key.wide { font-size: 0.54rem; letter-spacing: 0.08em; }

.tr-key.next {
  background: rgba(32, 227, 255, 0.28);
  border-color: var(--cyan);
  color: #eaffff;
  box-shadow: 0 0 12px rgba(32, 227, 255, 0.5);
}

.tr-key.hit { background: rgba(77, 247, 127, 0.35); border-color: var(--green); color: #eafff0; }
.tr-key.miss { background: rgba(255, 46, 77, 0.4); border-color: #ff2e4d; color: #ffe8ec; }

.tr-space { min-height: 12px; max-width: 320px; margin: 0 auto; background: rgba(32, 227, 255, 0.2); border-color: rgba(32,227,255,.45); }
.tr-space.next { background: rgba(32, 227, 255, 0.5); }

/* heat map */

.tr-heat {
  flex: none;
  width: 216px;
  border: 1px solid rgba(150, 170, 230, 0.3);
  border-radius: 12px;
  background: rgba(9, 13, 32, 0.92);
  padding: 10px 12px 12px;
}

.tr-heat-title {
  text-align: center;
  font-size: 0.66rem;
  font-weight: 800;
  letter-spacing: 0.26em;
  color: var(--cyan);
  margin-bottom: 8px;
}

.tr-heat-grid { display: grid; gap: 3px; }
.tr-heat-grid .row { display: flex; gap: 3px; justify-content: center; }
.tr-heat-grid i {
  width: 15px;
  height: 13px;
  border-radius: 3px;
  background: rgba(40, 60, 120, 0.35);
}

.tr-heat-legend {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 9px;
}

.tr-heat-legend span {
  font-size: 0.54rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  color: var(--text-1);
}

.tr-heat-legend i {
  flex: 1;
  height: 7px;
  border-radius: 4px;
  background: linear-gradient(90deg, #1d49c8, #7a3fd4, #ff2ee6, #ff9d2e, #ffd23f);
}

/* trang trí hai bên */

/* panel trang trí cắt nguyên mảng từ ảnh (cột code trái, 404 glitch phải) */
.tr-deco {
  position: absolute;
  top: 20px;
  width: 118px;
  height: 300px;
  z-index: 1;
  pointer-events: none;
}

.tr-deco .ln, .tr-deco .big { display: none; }

.tr-deco.left {
  left: 8px;
  background: url("${URLS.decoL}") top left / 100% auto no-repeat;
}

.tr-deco.right {
  right: 8px;
  background: url("${URLS.decoR}") top right / 100% auto no-repeat;
}

@media (max-width: 1100px) { .tr-deco { display: none; } }

/* nhãn tối ưu desktop */

.tr-note {
  position: absolute;
  right: 14px;
  top: 10px;
  z-index: 9;
  font-size: 0.6rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  color: var(--gold);
  border: 1px solid color-mix(in srgb, var(--gold) 50%, transparent);
  border-radius: 6px;
  padding: 4px 10px;
  background: rgba(10, 10, 26, 0.85);
}

/* chọn độ khó trong intro */

.tr-diffs { display: flex; flex-wrap: wrap; gap: 8px; margin: 4px 0 18px; }

.tr-diff {
  border: 1px solid rgba(150, 170, 230, 0.4);
  border-radius: 7px;
  background: rgba(13, 18, 40, 0.88);
  color: var(--text-1);
  font-family: inherit;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  padding: 9px 16px;
  cursor: pointer;
  transition: all 0.14s ease;
}

.tr-diff.sel {
  border-color: var(--cyan);
  color: #061018;
  background: var(--cyan);
  box-shadow: 0 0 14px rgba(32, 227, 255, 0.5);
}

@media (max-width: 900px) {
  .tr-heat { display: none; }
  .tr-key { min-height: 24px; font-size: 0.52rem; }
  .tr-key .sup { display: none; }
  .tr-word { font-size: 0.88rem; padding: 6px 10px; }
  .tr-word.active { font-size: 1.02rem; }
}
`;
