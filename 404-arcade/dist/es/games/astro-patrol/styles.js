/**
 * styles.js — CSS riêng Astro Patrol 404: thanh máu BOSS có đầu lâu
 * 2 bên dưới topbar, joystick ảo VÙNG DI CHUYỂN góc trái dưới,
 * NÚT BẮN crosshair góc phải dưới — theo ảnh reference.
 */

export const AP_CSS = /* css */ `
.ap-mode .exp-title {
  border: 1px solid rgba(244, 247, 255, 0.28);
  padding: 5px 16px 7px;
  border-radius: 8px;
  background: rgba(7, 11, 30, 0.9);
}

.ap-stage {
  position: absolute;
  inset: 0;
}

.ap-stage canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  touch-action: none;
}

/* ---------- thanh máu boss ---------- */

.ap-bossbar {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  width: min(560px, 72vw);
  display: flex;
  align-items: center;
  gap: 9px;
  z-index: 20;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.4s ease;
}

.ap-bossbar.show { opacity: 1; }

.ap-bossbar .icon {
  width: 17px;
  height: 17px;
  color: #ff5a7e;
  flex: none;
  filter: drop-shadow(0 0 6px rgba(255, 46, 120, 0.8));
}

.ap-bossbar .track {
  position: relative;
  flex: 1;
  height: 13px;
  border: 1px solid rgba(255, 90, 150, 0.6);
  border-radius: 8px;
  background: rgba(20, 8, 24, 0.85);
  overflow: hidden;
}

.ap-bossbar .fill {
  position: absolute;
  inset: 2px auto 2px 2px;
  width: 72%;
  border-radius: 6px;
  background: linear-gradient(90deg, #ff2e96, #ff5ab5);
  box-shadow: 0 0 12px rgba(255, 46, 150, 0.8);
  transition: width 0.2s ease;
}

.ap-bossbar .pct {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  font-size: 0.6rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: #fff;
  text-shadow: 0 1px 3px rgba(0,0,0,0.9);
}

/* ---------- điều khiển cảm ứng ---------- */

.ap-joy {
  position: absolute;
  left: 20px;
  bottom: 16px;
  z-index: 22;
  text-align: center;
  user-select: none;
}

.ap-joy .pad {
  position: relative;
  width: 128px;
  height: 128px;
  border-radius: 50%;
  border: 2px solid rgba(50, 170, 230, 0.45);
  background: radial-gradient(circle at 50% 45%, rgba(20, 60, 110, 0.4), rgba(8, 16, 40, 0.55));
  box-shadow: 0 0 22px rgba(40, 150, 230, 0.2), inset 0 0 24px rgba(30, 120, 210, 0.18);
  touch-action: none;
}

.ap-joy .arr {
  position: absolute;
  width: 0;
  height: 0;
  border: 7px solid transparent;
  opacity: 0.8;
}

.ap-joy .arr.up    { top: 7px;    left: 50%; transform: translateX(-50%); border-bottom-color: #7cd4ff; border-top-width: 0; }
.ap-joy .arr.down  { bottom: 7px; left: 50%; transform: translateX(-50%); border-top-color: #7cd4ff; border-bottom-width: 0; }
.ap-joy .arr.left  { left: 7px;   top: 50%;  transform: translateY(-50%); border-right-color: #7cd4ff; border-left-width: 0; }
.ap-joy .arr.right { right: 7px;  top: 50%;  transform: translateY(-50%); border-left-color: #7cd4ff; border-right-width: 0; }

.ap-joy .knob {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  background: radial-gradient(circle at 42% 36%, #9fd8ff, #2f9dd8 55%, #145a8c);
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.5), 0 0 16px rgba(70, 190, 255, 0.45);
  pointer-events: none;
}

.ap-joy .lbl,
.ap-fire .lbl {
  margin-top: 7px;
  font-size: 0.58rem;
  font-weight: 800;
  letter-spacing: 0.22em;
  color: rgba(190, 220, 250, 0.85);
  text-shadow: 0 0 8px rgba(40, 150, 230, 0.6);
}

.ap-fire {
  position: absolute;
  right: 22px;
  bottom: 16px;
  z-index: 22;
  text-align: center;
  user-select: none;
}

.ap-fire .btn {
  position: relative;
  width: 110px;
  height: 110px;
  border-radius: 50%;
  border: 2px solid rgba(255, 60, 150, 0.6);
  background: radial-gradient(circle at 50% 42%, rgba(90, 20, 60, 0.5), rgba(30, 8, 26, 0.6));
  box-shadow: 0 0 24px rgba(255, 46, 150, 0.25), inset 0 0 22px rgba(255, 46, 150, 0.2);
  touch-action: none;
  cursor: pointer;
}

.ap-fire .btn::before,
.ap-fire .btn::after {
  content: "";
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  border-radius: 50%;
}

.ap-fire .btn::before {
  width: 56px;
  height: 56px;
  border: 2.4px solid #ff4da8;
  box-shadow: 0 0 14px rgba(255, 46, 150, 0.7);
}

.ap-fire .btn::after {
  width: 12px;
  height: 12px;
  background: #ff4da8;
  box-shadow: 0 0 10px rgba(255, 46, 150, 0.9);
}

.ap-fire .tick {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 3.4px;
  height: 15px;
  background: #ff4da8;
  border-radius: 2px;
}

.ap-fire .tick.n { transform: translate(-50%, -46px); }
.ap-fire .tick.s { transform: translate(-50%, 31px); }
.ap-fire .tick.w { transform: translate(-46px, -50%) rotate(90deg); }
.ap-fire .tick.e { transform: translate(42px, -50%) rotate(90deg); }

.ap-fire .btn.held {
  background: radial-gradient(circle at 50% 42%, rgba(150, 30, 95, 0.7), rgba(50, 10, 40, 0.7));
  box-shadow: 0 0 34px rgba(255, 46, 150, 0.5), inset 0 0 26px rgba(255, 46, 150, 0.35);
}

@media (max-width: 760px) {
  .ap-joy .pad { width: 104px; height: 104px; }
  .ap-fire .btn { width: 92px; height: 92px; }
}
`;
