/**
 * styles/core.js — CSS lõi của <arcade-404> (shadow DOM).
 * Tokens nối với CSS variables CÔNG KHAI (--arcade-*) để dự án đích
 * tùy biến màu/bo góc từ bên ngoài mà không cần đụng vào package.
 */

export const CORE_CSS = /* css */ `
:host {
  /* ---- Public API (dự án đích có thể override) ---- */
  --arcade-bg: #050b1c;
  --arcade-panel: #0b1730;
  --arcade-cyan: #20e3ff;
  --arcade-violet: #9a5cff;
  --arcade-magenta: #ff4fd8;
  --arcade-lime: #a8ff3e;
  --arcade-danger: #ff4f64;
  --arcade-text: #f4f7ff;
  --arcade-radius: 16px;

  /* ---- Token nội bộ (suy ra từ public) ---- */
  --bg-0: var(--arcade-bg);
  --panel: color-mix(in srgb, var(--arcade-panel) 66%, transparent);
  --panel-strong: color-mix(in srgb, var(--arcade-panel) 94%, black 6%);
  --panel-border: color-mix(in srgb, var(--arcade-violet) 22%, transparent);
  --text-0: var(--arcade-text);
  --text-1: color-mix(in srgb, var(--arcade-text) 66%, transparent);
  --text-2: color-mix(in srgb, var(--arcade-text) 40%, transparent);
  --cyan: var(--arcade-cyan);
  --violet: var(--arcade-violet);
  --pink: var(--arcade-magenta);
  --lime: var(--arcade-lime);
  --green: #4df77f;
  --gold: #ffd23f;
  --red: var(--arcade-danger);
  --accent: var(--cyan);
  --radius-s: max(6px, calc(var(--arcade-radius) - 8px));
  --radius-m: max(8px, calc(var(--arcade-radius) - 4px));
  --radius-l: var(--arcade-radius);
  --sp-1: 4px; --sp-2: 8px; --sp-3: 12px; --sp-4: 16px;
  --sp-5: 24px; --sp-6: 32px; --sp-7: 48px; --sp-8: 64px;
  --font-mono: "JetBrains Mono", "Cascadia Code", "Fira Code", "IBM Plex Mono",
    ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  --shadow-pop: 0 18px 50px rgba(0, 0, 0, 0.55);
  --maxw: 1160px;

  display: block;
  min-height: 100vh;
  min-height: 100dvh;
  color: var(--text-0);
  font-family: var(--font-mono);
  font-size: 16px;
  line-height: 1.55;
  color-scheme: dark;
  background:
    radial-gradient(1100px 760px at 74% -12%, color-mix(in srgb, var(--violet) 26%, transparent) 0%, transparent 62%),
    radial-gradient(900px 700px at -8% 108%, color-mix(in srgb, var(--cyan) 13%, transparent) 0%, transparent 58%),
    linear-gradient(180deg, var(--bg-0) 0%, color-mix(in srgb, var(--bg-0) 88%, var(--violet) 12%) 60%, var(--bg-0) 100%);
}

*, *::before, *::after { box-sizing: border-box; }
* { margin: 0; }
[hidden] { display: none !important; }

img, svg, canvas { display: block; max-width: 100%; }
button, input, select { font: inherit; color: inherit; }
button { cursor: pointer; }
a { color: var(--cyan); }
h1, h2, h3, h4 { line-height: 1.2; font-weight: 700; text-wrap: balance; }

::selection { background: color-mix(in srgb, var(--cyan) 30%, transparent); color: var(--text-0); }

:focus-visible {
  outline: 2px solid var(--accent, var(--cyan));
  outline-offset: 2px;
  border-radius: 4px;
}

/* Bảng màu nhấn theo game */
[data-accent="cyan"]    { --accent: var(--cyan); }
[data-accent="violet"]  { --accent: var(--violet); }
[data-accent="pink"]    { --accent: var(--pink); }
[data-accent="magenta"] { --accent: var(--pink); }
[data-accent="lime"]    { --accent: var(--lime); }
[data-accent="green"]   { --accent: var(--green); }
[data-accent="gold"]    { --accent: var(--gold); }

/* ---------- Hiệu ứng nền ---------- */
.fx-stars {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background-image:
    radial-gradient(1px 1px at 25% 18%, color-mix(in srgb, var(--text-0) 90%, transparent) 0 1px, transparent 1.6px),
    radial-gradient(1px 1px at 68% 44%, color-mix(in srgb, var(--cyan) 80%, transparent) 0 1px, transparent 1.6px),
    radial-gradient(1.4px 1.4px at 12% 70%, color-mix(in srgb, var(--pink) 75%, transparent) 0 1.4px, transparent 2px);
  background-size: 260px 220px, 340px 280px, 420px 360px;
  opacity: 0.5;
  animation: arcadeStars 7s ease-in-out infinite alternate;
}

@keyframes arcadeStars {
  from { opacity: 0.34; }
  to   { opacity: 0.66; }
}

.fx-scanlines {
  position: fixed;
  inset: 0;
  z-index: 900;
  pointer-events: none;
  background: repeating-linear-gradient(0deg, rgba(255,255,255,0.02) 0 1px, transparent 1px 3px);
  mix-blend-mode: overlay;
}

.root { position: relative; z-index: 1; }

/* ---------- Nút bấm ---------- */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-2);
  min-height: 44px;
  padding: 0.6rem 1.15rem;
  border: 1px solid color-mix(in srgb, var(--accent) 65%, transparent);
  border-radius: var(--radius-s);
  background: color-mix(in srgb, var(--accent) 8%, transparent);
  color: var(--accent);
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  text-decoration: none;
  user-select: none;
  touch-action: manipulation;
  transition: transform 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
}

.btn:hover {
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  box-shadow: 0 0 18px color-mix(in srgb, var(--accent) 35%, transparent);
  transform: translateY(-1px);
}

.btn:active { transform: translateY(0); }

.btn-solid {
  background: var(--accent);
  color: #061018;
  border-color: transparent;
  box-shadow: 0 0 20px color-mix(in srgb, var(--accent) 40%, transparent);
}

.btn-solid:hover {
  background: color-mix(in srgb, var(--accent) 92%, white);
  box-shadow: 0 0 28px color-mix(in srgb, var(--accent) 55%, transparent);
}

.btn-small { min-height: 36px; padding: 0.42rem 0.8rem; font-size: 0.72rem; }
.btn .icon { width: 15px; height: 15px; flex: none; }

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-s);
  background: var(--panel);
  color: var(--text-1);
  touch-action: manipulation;
  transition: color 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease;
}

.icon-btn:hover {
  color: var(--cyan);
  border-color: color-mix(in srgb, var(--cyan) 55%, transparent);
  box-shadow: 0 0 14px color-mix(in srgb, var(--cyan) 25%, transparent);
}

.icon-btn[aria-pressed="false"] { color: var(--text-2); }
.icon-btn .icon { width: 18px; height: 18px; }
.icon { width: 16px; height: 16px; fill: currentColor; }

kbd {
  display: inline-block;
  padding: 0.1rem 0.45rem;
  border: 1px solid color-mix(in srgb, var(--violet) 35%, transparent);
  border-bottom-width: 2px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--bg-0) 88%, black);
  color: var(--text-0);
  font-family: var(--font-mono);
  font-size: 0.72em;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

.sr-only {
  position: absolute;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

/* ---------- Trang chọn game ---------- */
.topbar {
  position: sticky;
  top: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-4);
  padding: var(--sp-3) clamp(var(--sp-4), 4vw, var(--sp-6));
  background: color-mix(in srgb, var(--bg-0) 76%, transparent);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--panel-border);
}

.topbar-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  padding: 0.3rem 0.75rem;
  border: 1px solid var(--panel-border);
  border-radius: 999px;
  background: var(--panel);
  color: var(--text-2);
  font-size: 0.72rem;
  letter-spacing: 0.08em;
}

.chip-px {
  width: 8px;
  height: 8px;
  background: var(--pink);
  box-shadow: 0 0 8px var(--pink);
  flex: none;
}

.topbar-actions { display: flex; align-items: center; gap: var(--sp-2); }

.page {
  max-width: var(--maxw);
  margin: 0 auto;
  padding: 0 clamp(var(--sp-4), 4vw, var(--sp-6)) var(--sp-7);
}

.hero {
  display: grid;
  grid-template-columns: minmax(260px, 440px) 1fr;
  align-items: center;
  gap: clamp(var(--sp-5), 5vw, var(--sp-8));
  padding: clamp(var(--sp-6), 7vh, var(--sp-8)) 0 var(--sp-6);
}

.hero-logo svg {
  width: 100%;
  max-width: 440px;
  filter:
    drop-shadow(0 0 16px color-mix(in srgb, var(--violet) 45%, transparent))
    drop-shadow(0 0 40px color-mix(in srgb, var(--cyan) 16%, transparent));
  animation: arcadeGlitch 7s steps(1) infinite;
}

@keyframes arcadeGlitch {
  0%, 92%, 100% { transform: translate(0, 0); opacity: 1; }
  93% { transform: translate(2px, -1px) skewX(-1.2deg); opacity: 0.9; }
  94% { transform: translate(-2px, 1px); opacity: 1; }
  95.5% { transform: translate(1px, 0) skewX(0.8deg); opacity: 0.92; }
  96% { transform: translate(0, 0); opacity: 1; }
}

.hero-kicker {
  display: inline-flex;
  align-items: center;
  gap: 0.5ch;
  margin-bottom: var(--sp-3);
  color: var(--pink);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
}

.kicker-cursor {
  width: 0.62em;
  height: 1.05em;
  background: var(--pink);
  animation: arcadeCursor 1.1s steps(1) infinite;
}

@keyframes arcadeCursor {
  0%, 55% { opacity: 1; }
  56%, 100% { opacity: 0; }
}

.hero-copy h1 {
  font-size: clamp(1.65rem, 4.2vw, 2.7rem);
  letter-spacing: 0.01em;
  margin-bottom: var(--sp-4);
}

.hero-lead {
  max-width: 52ch;
  margin-bottom: var(--sp-5);
  color: var(--text-1);
  font-size: 0.95rem;
}

.hero-actions { display: flex; flex-wrap: wrap; gap: var(--sp-3); }

.section-title {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
  margin: var(--sp-7) 0 var(--sp-5);
  font-size: clamp(0.95rem, 2vw, 1.15rem);
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--cyan);
  text-shadow: 0 0 16px color-mix(in srgb, var(--cyan) 40%, transparent);
}

.section-title::before,
.section-title::after {
  content: "";
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--cyan) 45%, transparent));
}

.section-title::after {
  background: linear-gradient(90deg, color-mix(in srgb, var(--cyan) 45%, transparent), transparent);
}

.title-px {
  width: 8px;
  height: 8px;
  flex: none;
  background: var(--cyan);
  transform: rotate(45deg);
  box-shadow: 0 0 10px color-mix(in srgb, var(--cyan) 70%, transparent);
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: var(--sp-4);
}

.game-card {
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--accent) 32%, transparent);
  border-radius: var(--radius-m);
  background:
    linear-gradient(165deg, rgba(255,255,255,0.045), rgba(255,255,255,0.008) 55%),
    var(--panel);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}

.game-card:hover,
.game-card:focus-within {
  transform: translateY(-4px);
  border-color: color-mix(in srgb, var(--accent) 75%, transparent);
  box-shadow:
    0 14px 34px rgba(0, 0, 0, 0.45),
    0 0 24px color-mix(in srgb, var(--accent) 22%, transparent);
}

.game-card.stat-bump { animation: statBump 0.9s ease; }

@keyframes statBump {
  0% { box-shadow: 0 0 0 rgba(0,0,0,0); }
  30% { box-shadow: 0 0 30px color-mix(in srgb, var(--accent) 55%, transparent); }
  100% { box-shadow: 0 0 0 rgba(0,0,0,0); }
}

.card-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 2;
  padding: 0.12rem 0.5rem;
  border: 1px solid color-mix(in srgb, var(--accent) 70%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--bg-0) 82%, transparent);
  color: var(--accent);
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.18em;
}

.card-art {
  position: relative;
  aspect-ratio: 16 / 10;
  cursor: pointer;
  border-bottom: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);
  background: var(--panel-strong);
}

.card-art canvas { width: 100%; height: 100%; transition: filter 0.18s ease; }
.game-card:hover .card-art canvas { filter: brightness(1.12) saturate(1.05); }

.card-body {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  padding: var(--sp-4);
  flex: 1;
}

.card-title {
  font-size: 1.02rem;
  letter-spacing: 0.06em;
  color: var(--accent);
  text-shadow: 0 0 14px color-mix(in srgb, var(--accent) 45%, transparent);
}

.card-hint {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45ch;
  min-height: 2.2em;
  color: var(--text-1);
  font-size: 0.76rem;
}

.card-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border-top: 1px solid var(--panel-border);
  border-bottom: 1px solid var(--panel-border);
}

.card-stats > div { padding: var(--sp-2); text-align: center; }
.card-stats > div + div { border-left: 1px solid var(--panel-border); }

.card-stats dt {
  font-size: 0.62rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--text-2);
}

.card-stats dd {
  margin: 2px 0 0;
  font-size: 1.02rem;
  font-weight: 700;
  color: var(--text-0);
  font-variant-numeric: tabular-nums;
}

.card-play { width: 100%; margin-top: auto; }

.footer {
  padding: var(--sp-6) var(--sp-4) var(--sp-7);
  text-align: center;
  color: var(--text-2);
  font-size: 0.78rem;
}

.footer-sub { margin-top: var(--sp-2); letter-spacing: 0.12em; }

@media (max-width: 820px) {
  .hero { grid-template-columns: 1fr; text-align: center; padding-top: var(--sp-6); }
  .hero-logo { margin: 0 auto; max-width: 340px; }
  .hero-kicker { justify-content: center; }
  .hero-lead { margin-inline: auto; }
  .hero-actions { justify-content: center; }
}

@media (max-width: 480px) {
  .topbar { padding-inline: var(--sp-3); }
  .topbar-chip { display: none; }
  .card-grid { grid-template-columns: 1fr; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
`;
