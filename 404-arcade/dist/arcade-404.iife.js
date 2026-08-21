/* 404 Arcade — IIFE build (offline bundler). Mọi game inline sẵn. */
(function () {
"use strict";
const __defs = {};
const __cache = {};
function __req(id) {
  if (__cache[id]) return __cache[id].exports;
  const mod = (__cache[id] = { exports: {} });
  __defs[id](mod.exports, __req);
  return mod.exports;
}
__defs["index.js"] = function (exports, __req) {
/**
 * index.js — entry của package: đăng ký custom element <arcade-404>.
 * Initial bundle KHÔNG chứa code game hay engine 3D (chỉ tải khi chọn).
 */

const { Arcade404 } = __req("arcade-404.js");

if (!customElements.get("arcade-404")) {
  customElements.define("arcade-404", Arcade404);
}

exports.Arcade404 = Arcade404;
exports.GAMES = __req("core/game-registry.js").GAMES;


};
__defs["arcade-404.js"] = function (exports, __req) {
/**
 * arcade-404.js — Web Component <arcade-404>.
 *
 * Public API (theo tài liệu thiết kế):
 *  - Attributes: home-url, home-label, default-game, enabled-games,
 *    sound ("on"/"off"), locale, storage-prefix.
 *  - Property:  arcade.config = { homeUrl, enabledGames, defaultGame,
 *    soundEnabled, locale, quality }.
 *  - Methods:   openGame(id), closeGame(), pause(), resume(),
 *    resetHighScores(), destroy().
 *  - Events:    arcade:ready, arcade:game-start, arcade:game-over,
 *    arcade:game-change, arcade:home, arcade:error.
 *  - CSS vars:  --arcade-bg, --arcade-panel, --arcade-cyan,
 *    --arcade-violet, --arcade-magenta, --arcade-lime, --arcade-danger,
 *    --arcade-text, --arcade-radius.
 */

const { CORE_CSS } = __req("ui/styles/core.js");
const { SHELL_CSS } = __req("ui/styles/shell.js");
const { ROOT_HTML } = __req("ui/template.js");
const { createStorage } = __req("core/storage.js");
const { createAudio } = __req("core/audio-manager.js");
const { createEmitter } = __req("core/events.js");
const { createController } = __req("core/game-controller.js");
const { enabledGames } = __req("core/game-registry.js");
const { buildHome } = __req("ui/arcade-home.js");

class Arcade404 extends HTMLElement {
  static get observedAttributes() {
    return ["home-url", "home-label", "sound", "enabled-games", "default-game", "storage-prefix"];
  }

  #shadow = null;
  #refs = null;
  #storage = null;
  #audio = null;
  #emit = null;
  #controller = null;
  #home = null;
  #config = null;
  #configOverride = {};
  #rendered = false;
  #unlockAudio = null;

  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: "open" });
  }

  /* ---------- Lifecycle của custom element ---------- */

  connectedCallback() {
    if (!this.#rendered) this.#render();
  }

  disconnectedCallback() {
    // Gỡ hoàn toàn khi bị remove khỏi DOM (mount/unmount nhiều lần an toàn)
    this.destroy();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (!this.#rendered || oldValue === newValue) return;
    if (name === "home-url" || name === "home-label") {
      this.#config = this.#parseConfig();
      this.#applyHomeLinks();
    } else {
      // Các attribute còn lại ảnh hưởng cấu trúc → dựng lại
      this.#rerender();
    }
  }

  /* ---------- Public API ---------- */

  get config() {
    return { ...this.#config };
  }

  set config(value) {
    this.#configOverride = value && typeof value === "object" ? { ...value } : {};
    if (this.#rendered) this.#rerender();
  }

  openGame(id) {
    return this.#controller?.open(id, null);
  }

  closeGame() {
    return this.#controller?.close({ toGames: true });
  }

  pause() {
    this.#controller?.pause();
  }

  resume() {
    this.#controller?.resume();
  }

  resetHighScores() {
    this.#storage?.resetHighScores();
    if (this.#rendered) this.#rerender();
  }

  async destroy() {
    if (!this.#rendered) return;
    this.#rendered = false;
    window.removeEventListener("pointerdown", this.#unlockAudio, true);
    window.removeEventListener("keydown", this.#unlockAudio, true);
    await this.#controller?.destroy();
    this.#audio?.dispose();
    this.#shadow.textContent = "";
    this.#refs = null;
    this.#controller = null;
    this.#home = null;
  }

  /* ---------- Nội bộ ---------- */

  #parseConfig() {
    const attr = (name, fallback) => {
      const v = this.getAttribute(name);
      return v === null || v === "" ? fallback : v;
    };
    const csv = (v) =>
      String(v || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

    const o = this.#configOverride;
    const enabled = o.enabledGames ?? (this.hasAttribute("enabled-games") ? csv(attr("enabled-games")) : []);
    const games = enabledGames(enabled);

    return {
      homeUrl: o.homeUrl ?? attr("home-url", "/"),
      homeLabel: o.homeLabel ?? attr("home-label", "Về trang chủ"),
      defaultGame: o.defaultGame ?? attr("default-game", null),
      soundDefault: o.soundEnabled ?? attr("sound", "off") === "on",
      locale: o.locale ?? attr("locale", "vi"),
      quality: o.quality ?? "auto",
      storagePrefix: o.storagePrefix ?? attr("storage-prefix", "arcade404"),
      games,
      enabledIds: new Set(games.map((g) => g.id)),
    };
  }

  #applyHomeLinks() {
    const { homeUrl, homeLabel } = this.#config;
    this.#shadow.querySelectorAll("[data-home-link]").forEach((a) => {
      a.setAttribute("href", homeUrl);
    });
    for (const key of ["homeLabelTop", "homeLabelHero"]) {
      if (this.#refs[key]) this.#refs[key].textContent = homeLabel;
    }
  }

  #rerender() {
    const wasOpen = this.#controller?.activeId || null;
    this.destroy().then(() => {
      this.#render();
      if (wasOpen && this.#config.enabledIds.has(wasOpen)) this.openGame(wasOpen);
    });
  }

  #render() {
    this.#config = this.#parseConfig();
    this.#storage = createStorage(this.#config.storagePrefix);
    this.#audio = createAudio(this.#storage, { defaultOn: this.#config.soundDefault });
    this.#emit = createEmitter(this);

    // Skeleton tĩnh (markup tin cậy); dữ liệu động dựng bằng DOM API
    this.#shadow.innerHTML = `<style>${CORE_CSS}\n${SHELL_CSS}</style>${ROOT_HTML}`;

    const refs = {};
    this.#shadow.querySelectorAll("[data-ref]").forEach((node) => {
      refs[node.dataset.ref] = node;
    });
    this.#refs = refs;

    // Trang chọn game
    this.#home = buildHome({
      refs,
      games: this.#config.games,
      storage: this.#storage,
      audio: this.#audio,
      onPlay: (id, opener) => this.#controller.open(id, opener),
    });

    // Bộ điều phối vòng đời game
    this.#controller = createController({
      refs,
      storage: this.#storage,
      audio: this.#audio,
      emit: this.#emit,
      config: this.#config,
      onScoreSaved: (id, saved) => this.#home.updateCard(id, saved),
    });

    // Liên kết "Về trang chủ": phát sự kiện hủy được (SPA router chặn nếu muốn)
    this.#applyHomeLinks();
    this.#shadow.querySelectorAll("[data-home-link]").forEach((a) => {
      a.addEventListener("click", (e) => {
        const evt = this.#emit("home", { from: this.#controller?.activeId || null }, { cancelable: true });
        if (evt.defaultPrevented) e.preventDefault();
      });
    });

    // Nút âm thanh (topbar + thanh cửa sổ game)
    const soundButtons = this.#shadow.querySelectorAll("[data-sound-toggle]");
    const syncSound = () => {
      const on = this.#audio.enabled;
      soundButtons.forEach((btn) => {
        btn.setAttribute("aria-pressed", on ? "true" : "false");
        btn.setAttribute("title", on ? "Tắt âm thanh" : "Bật âm thanh");
        btn.querySelector("use")?.setAttribute("href", on ? "#i-sound-on" : "#i-sound-off");
      });
    };
    soundButtons.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        if (e.detail > 0) btn.blur();
        this.#audio.setEnabled(!this.#audio.enabled);
        syncSound();
        this.#audio.play("ui");
      });
    });
    syncSound();

    // Mở khóa audio sau tương tác THẬT đầu tiên (isTrusted)
    this.#unlockAudio = (e) => {
      if (!e.isTrusted) return;
      this.#audio.unlock();
      window.removeEventListener("pointerdown", this.#unlockAudio, true);
      window.removeEventListener("keydown", this.#unlockAudio, true);
    };
    window.addEventListener("pointerdown", this.#unlockAudio, { capture: true });
    window.addEventListener("keydown", this.#unlockAudio, { capture: true });

    this.#rendered = true;
    this.#emit("ready", { games: this.#config.games.map((g) => g.id) });

    if (this.#config.defaultGame && this.#config.enabledIds.has(this.#config.defaultGame)) {
      this.openGame(this.#config.defaultGame);
    }
  }
}

exports.Arcade404 = Arcade404;
};
__defs["ui/styles/core.js"] = function (exports, __req) {
/**
 * styles/core.js — CSS lõi của <arcade-404> (shadow DOM).
 * Tokens nối với CSS variables CÔNG KHAI (--arcade-*) để dự án đích
 * tùy biến màu/bo góc từ bên ngoài mà không cần đụng vào package.
 */

const CORE_CSS = /* css */ `
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

exports.CORE_CSS = CORE_CSS;
};
__defs["ui/styles/shell.js"] = function (exports, __req) {
/**
 * styles/shell.js — CSS cửa sổ game 2D, HUD, overlay (trong shadow DOM).
 * Có biến thể .fullbleed cho game tự vẽ chrome riêng (404 Strike).
 */

const SHELL_CSS = /* css */ `
.stage-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(var(--sp-2), 2.4vw, var(--sp-5));
  background: color-mix(in srgb, var(--bg-0) 78%, transparent);
  backdrop-filter: blur(7px);
  -webkit-backdrop-filter: blur(7px);
  animation: stageFadeIn 0.22s ease;
}

@keyframes stageFadeIn { from { opacity: 0; } to { opacity: 1; } }

.game-window {
  display: flex;
  flex-direction: column;
  width: min(1060px, 100%);
  max-height: calc(100vh - 2rem);
  max-height: calc(100dvh - 2rem);
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
  border-radius: var(--radius-l);
  background:
    linear-gradient(170deg, rgba(255,255,255,0.035), rgba(255,255,255,0) 40%),
    var(--panel-strong);
  box-shadow: var(--shadow-pop), 0 0 42px color-mix(in srgb, var(--accent) 16%, transparent);
  animation: windowPop 0.24s cubic-bezier(0.2, 0.9, 0.3, 1.2);
}

@keyframes windowPop {
  from { transform: translateY(14px) scale(0.97); opacity: 0; }
  to   { transform: none; opacity: 1; }
}

/* Chế độ fullbleed cho 404 Strike: chiếm trọn màn hình, không chrome */
.stage-backdrop.fullbleed { padding: 0; }

.stage-backdrop.fullbleed .game-window {
  width: 100%;
  height: 100vh;
  height: 100dvh;
  max-height: none;
  border: none;
  border-radius: 0;
  background: var(--bg-0);
}

.stage-backdrop.fullbleed .window-bar,
.stage-backdrop.fullbleed .game-hud { display: none; }

.stage-backdrop.fullbleed .window-body { padding: 0; gap: 0; }
.stage-backdrop.fullbleed .game-surface { min-height: 0; }

/* ---------- Thanh tiêu đề ---------- */
.window-bar {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-2) var(--sp-3);
  border-bottom: 1px solid var(--panel-border);
  background: color-mix(in srgb, var(--bg-0) 92%, transparent);
}

.traffic { display: inline-flex; gap: 6px; flex: none; }
.traffic i { width: 10px; height: 10px; border-radius: 50%; }
.traffic i:nth-child(1) { background: #ff5f57; }
.traffic i:nth-child(2) { background: #febc2e; }
.traffic i:nth-child(3) { background: #28c840; }

.window-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 0.82rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--accent);
  text-shadow: 0 0 12px color-mix(in srgb, var(--accent) 45%, transparent);
}

.window-actions { display: flex; align-items: center; gap: var(--sp-2); }

.bar-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 36px;
  padding: 0.38rem 0.66rem;
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-s);
  background: color-mix(in srgb, var(--arcade-panel) 70%, transparent);
  color: var(--text-1);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  text-decoration: none;
  touch-action: manipulation;
  transition: color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}

.bar-btn:hover:not(:disabled) {
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 55%, transparent);
  box-shadow: 0 0 12px color-mix(in srgb, var(--accent) 25%, transparent);
}

.bar-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.bar-btn .icon { width: 14px; height: 14px; }
.bar-btn.icon-only { padding: 0.38rem 0.5rem; }

/* ---------- Thân cửa sổ ---------- */
.window-body {
  position: relative;
  display: flex;
  gap: var(--sp-4);
  flex: 1;
  min-height: 0;
  padding: var(--sp-4);
}

.game-surface {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-width: 0;
  min-height: 300px;
}

.game-canvas {
  border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
  border-radius: var(--radius-m);
  background: var(--bg-0);
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.5),
    0 0 26px color-mix(in srgb, var(--accent) 13%, transparent),
    inset 0 0 60px rgba(0, 0, 0, 0.3);
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  cursor: default;
}

.game-canvas.crosshair { cursor: crosshair; }

/* ---------- HUD 2D ---------- */
.game-hud {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  width: 188px;
  flex: none;
}

.hud-stat {
  padding: var(--sp-3) var(--sp-2);
  border: 1px solid color-mix(in srgb, var(--accent) 32%, transparent);
  border-radius: var(--radius-m);
  background: color-mix(in srgb, var(--arcade-panel) 72%, transparent);
  text-align: center;
}

.hud-label {
  display: block;
  font-size: 0.62rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--text-2);
}

.hud-value {
  display: block;
  margin-top: 3px;
  font-size: 1.45rem;
  font-weight: 800;
  line-height: 1.1;
  color: var(--accent);
  text-shadow: 0 0 14px color-mix(in srgb, var(--accent) 55%, transparent);
  font-variant-numeric: tabular-nums;
}

.hud-stat.small .hud-value { font-size: 1.1rem; }

.hud-time-ring { position: relative; width: 84px; margin: 6px auto 0; }
.hud-time-ring svg { width: 100%; height: auto; }
.hud-time-ring .ring-track { fill: none; stroke: var(--panel-border); stroke-width: 5; }
.hud-time-ring .ring-progress {
  fill: none;
  stroke: currentColor;
  stroke-width: 5;
  stroke-linecap: round;
  transition: stroke 0.3s ease;
}

.hud-time-num {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: 1.3rem;
  font-weight: 800;
  line-height: 1;
}

.hud-time-num small {
  font-size: 0.55rem;
  font-weight: 600;
  letter-spacing: 0.14em;
  color: var(--text-2);
  text-transform: uppercase;
}

.hud-stat.time-warn { color: var(--gold); }
.hud-stat.time-danger { color: var(--red); animation: timePulse 0.5s ease infinite alternate; }

@keyframes timePulse {
  from { box-shadow: 0 0 0 rgba(255, 79, 100, 0); }
  to   { box-shadow: 0 0 18px color-mix(in srgb, var(--red) 45%, transparent); }
}

.dpad {
  display: none;
  grid-template-columns: repeat(3, 46px);
  grid-template-rows: repeat(3, 46px);
  gap: 6px;
  justify-content: center;
  margin-top: var(--sp-2);
}

@media (pointer: coarse) { .dpad { display: grid; } }

.dpad-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
  border-radius: var(--radius-s);
  background: color-mix(in srgb, var(--arcade-panel) 80%, transparent);
  color: var(--accent);
  touch-action: manipulation;
}

.dpad-btn:active {
  background: color-mix(in srgb, var(--accent) 25%, transparent);
  box-shadow: 0 0 14px color-mix(in srgb, var(--accent) 40%, transparent);
}

.dpad-btn .icon { width: 17px; height: 17px; }
.dpad-up    { grid-column: 2; grid-row: 1; }
.dpad-left  { grid-column: 1; grid-row: 2; }
.dpad-right { grid-column: 3; grid-row: 2; }
.dpad-down  { grid-column: 2; grid-row: 3; }
.dpad-left .icon  { transform: rotate(-90deg); }
.dpad-right .icon { transform: rotate(90deg); }
.dpad-down .icon  { transform: rotate(180deg); }

/* ---------- Overlay ---------- */
.stage-overlay {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--sp-4);
  background: color-mix(in srgb, var(--bg-0) 70%, transparent);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  border-radius: inherit;
}

.stage-panel {
  width: min(430px, 100%);
  max-height: 100%;
  overflow-y: auto;
  padding: clamp(var(--sp-4), 3.5vw, var(--sp-6));
  border: 1px solid color-mix(in srgb, var(--accent) 50%, transparent);
  border-radius: var(--radius-m);
  background:
    linear-gradient(165deg, rgba(255,255,255,0.05), rgba(255,255,255,0) 50%),
    var(--panel-strong);
  box-shadow: 0 0 34px color-mix(in srgb, var(--accent) 20%, transparent);
  text-align: center;
  animation: panelPop 0.2s cubic-bezier(0.2, 0.9, 0.3, 1.25);
}

@keyframes panelPop {
  from { transform: scale(0.94); opacity: 0; }
  to   { transform: none; opacity: 1; }
}

.panel-title {
  font-size: 1.25rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--accent);
  text-shadow: 0 0 18px color-mix(in srgb, var(--accent) 55%, transparent);
}

.panel-title.danger {
  color: var(--pink);
  text-shadow: 0 0 20px color-mix(in srgb, var(--pink) 60%, transparent);
}

.panel-sub { margin-top: var(--sp-2); color: var(--text-1); font-size: 0.84rem; }

.controls-list {
  list-style: none;
  margin: var(--sp-4) 0;
  padding: var(--sp-3);
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  border: 1px dashed var(--panel-border);
  border-radius: var(--radius-s);
  font-size: 0.8rem;
  color: var(--text-1);
}

.controls-list li {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.5ch;
}

.panel-tip { margin: var(--sp-3) 0 var(--sp-4); font-size: 0.72rem; color: var(--text-2); }

.btn-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--sp-2);
}

.over-stats {
  display: flex;
  justify-content: center;
  gap: var(--sp-3);
  margin: var(--sp-4) 0;
}

.over-stat {
  flex: 1;
  max-width: 160px;
  padding: var(--sp-3);
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-s);
  background: color-mix(in srgb, var(--arcade-panel) 70%, transparent);
}

.over-stat .hud-label { font-size: 0.6rem; }

.over-stat strong {
  display: block;
  margin-top: 2px;
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--text-0);
  font-variant-numeric: tabular-nums;
}

.over-stat.highlight strong {
  color: var(--accent);
  text-shadow: 0 0 16px color-mix(in srgb, var(--accent) 55%, transparent);
}

.record-badge {
  display: inline-block;
  margin-top: var(--sp-3);
  padding: 0.3rem 0.9rem;
  border: 1px solid var(--gold);
  border-radius: 999px;
  color: var(--gold);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  box-shadow: 0 0 16px color-mix(in srgb, var(--gold) 35%, transparent);
  animation: recordPulse 1s ease infinite alternate;
}

@keyframes recordPulse {
  from { box-shadow: 0 0 8px color-mix(in srgb, var(--gold) 25%, transparent); }
  to   { box-shadow: 0 0 24px color-mix(in srgb, var(--gold) 55%, transparent); }
}

.pix-loader { display: flex; gap: 7px; justify-content: center; margin-bottom: var(--sp-4); }
.pix-loader i { width: 12px; height: 12px; background: var(--accent); animation: pixBlink 0.9s steps(1) infinite; }
.pix-loader i:nth-child(2) { animation-delay: 0.22s; }
.pix-loader i:nth-child(3) { animation-delay: 0.44s; }
.pix-loader i:nth-child(4) { animation-delay: 0.66s; }

@keyframes pixBlink {
  0%, 40% { opacity: 1; }
  41%, 100% { opacity: 0.15; }
}

/* ---------- Responsive mobile (game 2D) ---------- */
@media (max-width: 760px) {
  .stage-backdrop { padding: 0; }

  .game-window {
    width: 100%;
    height: 100vh;
    height: 100dvh;
    max-height: none;
    border: none;
    border-radius: 0;
  }

  .window-body { flex-direction: column; gap: var(--sp-3); padding: var(--sp-3); }
  .game-surface { min-height: 0; }
  .game-hud { flex-direction: row; flex-wrap: wrap; width: auto; }
  .hud-stat { flex: 1 1 96px; padding: var(--sp-2); }
  .hud-value { font-size: 1.15rem; }
  .hud-time-ring { width: 62px; }
  .hud-time-num { font-size: 1rem; }
  .dpad { flex-basis: 100%; margin-top: 0; }
}

@media (max-width: 560px) {
  .bar-label { display: none; }
  .window-bar { gap: var(--sp-2); }
  .traffic { display: none; }
}
`;

exports.SHELL_CSS = SHELL_CSS;
};
__defs["ui/template.js"] = function (exports, __req) {
/**
 * template.js — skeleton tĩnh của shadow DOM (markup tin cậy, không chứa
 * dữ liệu động; phần động luôn dựng bằng createElement/textContent).
 */

const SPRITE_SVG = /* html */ `
<svg xmlns="http://www.w3.org/2000/svg" hidden aria-hidden="true">
  <symbol id="i-home" viewBox="0 0 24 24">
    <path fill="currentColor" d="M12 3 3 10.5h2.5V21H10v-5h4v5h4.5V10.5H21L12 3z"/>
  </symbol>
  <symbol id="i-sound-on" viewBox="0 0 24 24">
    <path fill="currentColor" d="M4 9v6h4l5 4.5v-15L8 9H4z"/>
    <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M15.5 8.5a5 5 0 0 1 0 7"/>
    <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M18 6a8.5 8.5 0 0 1 0 12"/>
  </symbol>
  <symbol id="i-sound-off" viewBox="0 0 24 24">
    <path fill="currentColor" d="M4 9v6h4l5 4.5v-15L8 9H4z"/>
    <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="m15.5 9.5 5 5m0-5-5 5"/>
  </symbol>
  <symbol id="i-pause" viewBox="0 0 24 24"><path fill="currentColor" d="M6 4h4v16H6zM14 4h4v16h-4z"/></symbol>
  <symbol id="i-play" viewBox="0 0 24 24"><path fill="currentColor" d="M7 4l13 8-13 8V4z"/></symbol>
  <symbol id="i-swap" viewBox="0 0 24 24">
    <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M3 8h14M14 4l4 4-4 4"/>
    <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M21 16H7M10 12l-4 4 4 4"/>
  </symbol>
  <symbol id="i-restart" viewBox="0 0 24 24">
    <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M20 12a8 8 0 1 1-2.4-5.7"/>
    <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M20.5 3.5v4.2h-4.2"/>
  </symbol>
  <symbol id="i-close" viewBox="0 0 24 24">
    <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M5 5l14 14M19 5 5 19"/>
  </symbol>
  <symbol id="i-arrow" viewBox="0 0 24 24"><path fill="currentColor" d="M12 5l7 10H5l7-10z"/></symbol>
  <symbol id="i-gamepad" viewBox="0 0 24 24">
    <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      d="M6.5 7h11a4.5 4.5 0 0 1 4.4 5.5l-.8 3.6a2.8 2.8 0 0 1-4.9 1.2L14.6 15H9.4l-1.6 2.3a2.8 2.8 0 0 1-4.9-1.2l-.8-3.6A4.5 4.5 0 0 1 6.5 7z"/>
    <path fill="currentColor" d="M7 10h2v1.6h1.6v2H9v1.6H7v-1.6H5.4v-2H7V10z"/>
    <circle fill="currentColor" cx="16" cy="10.8" r="1.1"/>
    <circle fill="currentColor" cx="18.4" cy="13" r="1.1"/>
  </symbol>
  <symbol id="i-target" viewBox="0 0 24 24">
    <circle fill="none" stroke="currentColor" stroke-width="2" cx="12" cy="12" r="8"/>
    <circle fill="currentColor" cx="12" cy="12" r="2.4"/>
    <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4"/>
  </symbol>
  <symbol id="i-skull" viewBox="0 0 24 24">
    <path fill="currentColor" d="M12 2a8 8 0 0 0-8 8c0 2.9 1.6 5.4 4 6.8V20a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-3.2c2.4-1.4 4-3.9 4-6.8a8 8 0 0 0-8-8zm-3.4 9.6a1.8 1.8 0 1 1 0-3.6 1.8 1.8 0 0 1 0 3.6zm6.8 0a1.8 1.8 0 1 1 0-3.6 1.8 1.8 0 0 1 0 3.6zM12 13l1.2 2.6h-2.4L12 13z"/>
  </symbol>
  <symbol id="i-chevrons" viewBox="0 0 24 24">
    <path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="M5 17l7-6 7 6M5 11l7-6 7 6"/>
  </symbol>
  <symbol id="i-crosshair" viewBox="0 0 24 24">
    <circle fill="none" stroke="currentColor" stroke-width="2" cx="12" cy="12" r="7"/>
    <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M12 2v5M12 17v5M2 12h5M17 12h5"/>
  </symbol>
  <symbol id="i-laurel-l" viewBox="0 0 24 48">
    <path fill="currentColor" d="M18 46c-8-3-13-10-13-19C5 15 12 6 21 2c-2 4-3 8-3 12 0-2-4-5-8-5 2 3 4 7 4 10 0-2-5-4-9-3 3 2 6 5 7 8-2-1-6-1-9 1 4 1 7 3 9 5-2 0-5 1-7 4 3 0 7 0 9 2-2 1-4 3-4 6 3-1 5-2 8-2v6z"/>
  </symbol>
  <symbol id="i-bullet" viewBox="0 0 10 22">
    <path fill="currentColor" d="M5 0c2 2 4 5 4 8v9H1V8c0-3 2-6 4-8z"/>
    <rect fill="currentColor" x="1" y="19" width="8" height="3" rx="1"/>
  </symbol>
  <symbol id="i-mouse" viewBox="0 0 24 32">
    <rect fill="none" stroke="currentColor" stroke-width="2" x="3" y="2" width="18" height="28" rx="9"/>
    <path fill="none" stroke="currentColor" stroke-width="2" d="M12 2v10M3 12h18"/>
  </symbol>
  <symbol id="i-mouse-left" viewBox="0 0 24 32">
    <rect fill="none" stroke="currentColor" stroke-width="2" x="3" y="2" width="18" height="28" rx="9"/>
    <path fill="none" stroke="currentColor" stroke-width="2" d="M12 2v10M3 12h18"/>
    <path fill="currentColor" opacity="0.9" d="M12 3.5V11H4.5V11A8.5 8.5 0 0 1 12 3.5z"/>
  </symbol>
  <symbol id="i-mouse-right" viewBox="0 0 24 32">
    <rect fill="none" stroke="currentColor" stroke-width="2" x="3" y="2" width="18" height="28" rx="9"/>
    <path fill="none" stroke="currentColor" stroke-width="2" d="M12 2v10M3 12h18"/>
    <path fill="currentColor" opacity="0.9" d="M12 3.5V11h7.5V11A8.5 8.5 0 0 0 12 3.5z"/>
  </symbol>
</svg>
`;

const ROOT_HTML = /* html */ `
${SPRITE_SVG}
<div class="root">
  <div class="fx-stars" aria-hidden="true"></div>
  <div class="fx-scanlines" aria-hidden="true"></div>

  <header class="topbar">
    <span class="topbar-chip" aria-hidden="true"><i class="chip-px"></i>404-arcade.local</span>
    <div class="topbar-actions">
      <a class="btn btn-small" data-home-link href="/">
        <svg class="icon" aria-hidden="true"><use href="#i-home"></use></svg>
        <span data-ref="homeLabelTop">Về trang chủ</span>
      </a>
      <button type="button" class="icon-btn" data-sound-toggle aria-label="Bật hoặc tắt âm thanh" aria-pressed="false">
        <svg class="icon" aria-hidden="true"><use href="#i-sound-on"></use></svg>
      </button>
    </div>
  </header>

  <main class="page">
    <section class="hero" aria-labelledby="hero-title">
      <div class="hero-logo" data-ref="logo"></div>
      <div class="hero-copy">
        <p class="hero-kicker">LỖI 404 — KHÔNG TÌM THẤY TRANG<span class="kicker-cursor" aria-hidden="true"></span></p>
        <h1 id="hero-title">Bạn vừa đi ra ngoài bản đồ</h1>
        <p class="hero-lead">Trang bạn tìm kiếm không tồn tại hoặc đã bị dịch chuyển sang một chiều không gian khác. Chọn một trò chơi để tiếp tục hành trình!</p>
        <div class="hero-actions">
          <a class="btn btn-solid" data-home-link href="/">
            <svg class="icon" aria-hidden="true"><use href="#i-home"></use></svg>
            <span data-ref="homeLabelHero">Về trang chủ</span>
          </a>
          <button type="button" class="btn" data-ref="scrollGames">Chọn trò chơi</button>
        </div>
      </div>
    </section>

    <section class="games" aria-label="Danh sách trò chơi">
      <h2 class="section-title"><i class="title-px" aria-hidden="true"></i><span>Chọn trò chơi</span><i class="title-px" aria-hidden="true"></i></h2>
      <div class="card-grid" data-ref="grid"></div>
    </section>
  </main>

  <footer class="footer">
    <p>Mẹo: nhấn <kbd>Esc</kbd> để thoát game · <kbd>P</kbd> để tạm dừng</p>
    <p class="footer-sub">404 ARCADE — không tìm thấy trang, nhưng tìm thấy niềm vui.</p>
  </footer>

  <div class="stage-backdrop" data-ref="stage" hidden>
    <section class="game-window" role="dialog" aria-modal="true" aria-label="Cửa sổ trò chơi" data-accent="cyan">
      <header class="window-bar">
        <span class="traffic" aria-hidden="true"><i></i><i></i><i></i></span>
        <h2 class="window-title" data-ref="stageTitle">Trò chơi</h2>
        <div class="window-actions">
          <button type="button" class="bar-btn" data-ref="btnPause" disabled>
            <svg class="icon" aria-hidden="true"><use href="#i-pause"></use></svg>
            <span class="bar-label" data-ref="btnPauseLabel">Tạm dừng</span>
          </button>
          <button type="button" class="bar-btn icon-only" data-sound-toggle aria-label="Bật hoặc tắt âm thanh" aria-pressed="false">
            <svg class="icon" aria-hidden="true"><use href="#i-sound-on"></use></svg>
          </button>
          <button type="button" class="bar-btn" data-ref="btnSwitch">
            <svg class="icon" aria-hidden="true"><use href="#i-swap"></use></svg>
            <span class="bar-label">Đổi game</span>
          </button>
          <a class="bar-btn icon-only" data-home-link href="/" aria-label="Về trang chủ">
            <svg class="icon" aria-hidden="true"><use href="#i-home"></use></svg>
          </a>
        </div>
      </header>
      <div class="window-body">
        <div class="game-surface" data-ref="surface"></div>
        <aside class="game-hud" data-ref="hud" aria-label="Bảng điểm"></aside>
        <div class="stage-overlay" data-ref="overlay" hidden></div>
      </div>
    </section>
  </div>
</div>
`;

exports.SPRITE_SVG = SPRITE_SVG; exports.ROOT_HTML = ROOT_HTML;
};
__defs["core/storage.js"] = function (exports, __req) {
/**
 * storage.js — localStorage có namespace cho mỗi instance <arcade-404>.
 * Lưu: điểm (last/best) từng game, âm thanh, và túi prefs tùy ý
 * (settings của 404 Strike...). Mọi thao tác bọc try/catch để không vỡ
 * khi localStorage bị chặn (chế độ riêng tư, iframe sandbox...).
 */

function createStorage(prefix = "arcade404") {
  const KEY = `${prefix}:v1`;

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      const data = raw ? JSON.parse(raw) : null;
      return data && typeof data === "object" ? data : {};
    } catch {
      return {};
    }
  }

  function write(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      /* localStorage không khả dụng — bỏ qua, game vẫn chạy */
    }
  }

  return {
    /** Âm thanh bật/tắt (mặc định: tắt theo plan — sound="off"). */
    getSound(defaultOn = false) {
      const data = read();
      return typeof data.sound === "boolean" ? data.sound : defaultOn;
    },

    setSound(on) {
      const data = read();
      data.sound = !!on;
      write(data);
    },

    /** Điểm của một game: { last, best }. */
    getScores(gameId) {
      const s = read().scores?.[gameId];
      return {
        last: Number.isFinite(s?.last) ? s.last : 0,
        best: Number.isFinite(s?.best) ? s.best : 0,
      };
    },

    /** Lưu điểm sau một lượt, trả về { last, best, isRecord }. */
    saveScore(gameId, score) {
      const value = Math.max(0, Math.floor(score));
      const data = read();
      if (!data.scores || typeof data.scores !== "object") data.scores = {};
      const prev = this.getScores(gameId);
      const isRecord = value > prev.best;
      const next = { last: value, best: isRecord ? value : prev.best };
      data.scores[gameId] = next;
      write(data);
      return { ...next, isRecord };
    },

    /** Xóa toàn bộ điểm cao (public API resetHighScores). */
    resetHighScores() {
      const data = read();
      delete data.scores;
      write(data);
    },

    /** Túi prefs tùy ý theo tên (vd settings 404 Strike). */
    getPref(name, fallback = null) {
      const p = read().prefs?.[name];
      return p === undefined ? fallback : p;
    },

    setPref(name, value) {
      const data = read();
      if (!data.prefs || typeof data.prefs !== "object") data.prefs = {};
      data.prefs[name] = value;
      write(data);
    },
  };
}

exports.createStorage = createStorage;
};
__defs["core/audio-manager.js"] = function (exports, __req) {
/**
 * audio-manager.js — trình quản lý âm thanh cho một instance arcade.
 * Toàn bộ SFX tổng hợp bằng WebAudio (oscillator + noise), không file
 * ngoài, không CDN. AudioContext chỉ tạo SAU tương tác thật của người
 * dùng (unlock + userActivation) để tuân thủ chính sách autoplay.
 */

function createAudio(storage, { defaultOn = false } = {}) {
  let ctx = null;
  let master = null;
  let noiseBuffer = null;
  let allowed = false;
  let enabled = storage.getSound(defaultOn);
  let volume = typeof storage.getPref("volume") === "number" ? storage.getPref("volume") : 0.8;

  const BASE_GAIN = 0.24;

  const gainValue = () => (enabled ? BASE_GAIN * volume : 0);

  function ensure() {
    if (!allowed) return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = gainValue();
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  }

  /** Một nốt: dạng sóng + tần số (trượt được) + phong bì âm lượng. */
  function tone({ type = "square", from = 440, to = null, dur = 0.12, vol = 0.5, delay = 0 }) {
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(from, 1), t0);
    if (to !== null && to !== from) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), t0 + dur);
    }
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  /** Tiếng ồn trắng qua lọc thông thấp — va chạm, súng, đổ vỡ. */
  function noise({ dur = 0.2, vol = 0.4, delay = 0, from = 1800, to = 250 }) {
    if (!noiseBuffer) {
      const len = Math.floor(ctx.sampleRate * 0.5);
      noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(from, t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(to, 40), t0 + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.03);
  }

  /* Bảng hiệu ứng: tên → công thức tổng hợp */
  const SFX = {
    /* UI + game 2D */
    ui:      () => tone({ from: 620, dur: 0.05, vol: 0.22 }),
    start:   () => { tone({ from: 440, dur: 0.09, vol: 0.3 }); tone({ from: 660, dur: 0.12, vol: 0.3, delay: 0.09 }); },
    jump:    () => tone({ from: 250, to: 540, dur: 0.16, vol: 0.32 }),
    coin:    () => { tone({ from: 880, dur: 0.07, vol: 0.28 }); tone({ from: 1174, dur: 0.1, vol: 0.26, delay: 0.06 }); },
    hit:     () => { noise({ dur: 0.28, vol: 0.5 }); tone({ type: "sawtooth", from: 220, to: 55, dur: 0.32, vol: 0.42 }); },
    squash:  () => { noise({ dur: 0.1, vol: 0.3, from: 2400, to: 500 }); tone({ from: 190, to: 120, dur: 0.09, vol: 0.3 }); },
    bad:     () => tone({ type: "sawtooth", from: 150, to: 85, dur: 0.26, vol: 0.42 }),
    combo:   () => { tone({ from: 988, dur: 0.06, vol: 0.24 }); tone({ from: 1319, dur: 0.09, vol: 0.22, delay: 0.05 }); },
    perfect: () => { tone({ from: 1047, dur: 0.06, vol: 0.26 }); tone({ from: 1568, dur: 0.1, vol: 0.24, delay: 0.05 }); },
    drop:    () => { tone({ type: "sine", from: 150, to: 70, dur: 0.14, vol: 0.5 }); noise({ dur: 0.07, vol: 0.18, from: 900, to: 200 }); },
    eat:     () => tone({ from: 520, to: 780, dur: 0.08, vol: 0.28 }),
    levelup: () => { tone({ from: 523, dur: 0.08, vol: 0.26 }); tone({ from: 659, dur: 0.08, vol: 0.26, delay: 0.08 }); tone({ from: 784, dur: 0.12, vol: 0.26, delay: 0.16 }); },
    over:    () => { tone({ type: "triangle", from: 392, dur: 0.15, vol: 0.32 }); tone({ type: "triangle", from: 311, dur: 0.15, vol: 0.32, delay: 0.14 }); tone({ type: "triangle", from: 233, dur: 0.3, vol: 0.32, delay: 0.28 }); },
    record:  () => { tone({ from: 659, dur: 0.09, vol: 0.3 }); tone({ from: 784, dur: 0.09, vol: 0.3, delay: 0.09 }); tone({ from: 1047, dur: 0.2, vol: 0.3, delay: 0.18 }); },

    /* 404 Strike */
    shoot:    () => { noise({ dur: 0.09, vol: 0.42, from: 3200, to: 400 }); tone({ type: "square", from: 120, to: 60, dur: 0.08, vol: 0.34 }); },
    dryfire:  () => tone({ from: 300, to: 200, dur: 0.05, vol: 0.2 }),
    reload:   () => { tone({ from: 320, dur: 0.05, vol: 0.24 }); tone({ from: 240, dur: 0.05, vol: 0.24, delay: 0.28 }); tone({ from: 520, dur: 0.06, vol: 0.26, delay: 0.9 }); },
    hitmark:  () => tone({ from: 1200, dur: 0.045, vol: 0.22 }),
    headshot: () => { tone({ from: 1568, dur: 0.06, vol: 0.3 }); tone({ from: 2093, dur: 0.08, vol: 0.24, delay: 0.05 }); },
    kill:     () => { tone({ type: "sawtooth", from: 300, to: 90, dur: 0.16, vol: 0.3 }); noise({ dur: 0.14, vol: 0.24, from: 1200, to: 200 }); },
    hurt:     () => { tone({ type: "sine", from: 140, to: 70, dur: 0.18, vol: 0.5 }); noise({ dur: 0.12, vol: 0.2, from: 700, to: 150 }); },
    botshot:  () => { noise({ dur: 0.06, vol: 0.16, from: 2200, to: 500 }); tone({ type: "square", from: 180, to: 110, dur: 0.05, vol: 0.14 }); },
    wave:     () => { tone({ from: 392, dur: 0.09, vol: 0.28 }); tone({ from: 523, dur: 0.09, vol: 0.28, delay: 0.1 }); tone({ from: 659, dur: 0.14, vol: 0.28, delay: 0.2 }); },
    pickup:   () => { tone({ from: 700, to: 1050, dur: 0.09, vol: 0.26 }); tone({ from: 1400, dur: 0.06, vol: 0.2, delay: 0.08 }); },
    empty:    () => tone({ from: 220, dur: 0.04, vol: 0.18 }),
  };

  return {
    /** Gọi trong handler tương tác thật đầu tiên để mở khóa. */
    unlock() {
      if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
      allowed = true;
      ensure();
    },

    get enabled() {
      return enabled;
    },

    setEnabled(on) {
      enabled = !!on;
      storage.setSound(enabled);
      if (master) master.gain.value = gainValue();
    },

    /** Âm lượng tổng 0..1 (slider trong pause menu 404 Strike). */
    get volume() {
      return volume;
    },

    setVolume(v) {
      volume = Math.min(1, Math.max(0, v));
      storage.setPref("volume", volume);
      if (master) master.gain.value = gainValue();
    },

    /** Phát hiệu ứng theo tên; an toàn khi chưa unlock hoặc đã tắt. */
    play(name) {
      if (!enabled) return;
      if (!ensure()) return;
      const fx = SFX[name];
      if (!fx) return;
      try {
        fx();
      } catch {
        /* WebAudio lỗi bất thường — không được làm vỡ game */
      }
    },

    /** Dọn dẹp khi destroy component. */
    dispose() {
      if (ctx) {
        ctx.close().catch(() => {});
        ctx = null;
        master = null;
        noiseBuffer = null;
      }
    },
  };
}

exports.createAudio = createAudio;
};
__defs["core/events.js"] = function (exports, __req) {
/**
 * events.js — phát CustomEvent từ host element <arcade-404>.
 * Sự kiện public: arcade:ready, arcade:game-start, arcade:game-over,
 * arcade:game-change, arcade:home, arcade:error.
 * Detail không chứa dữ liệu cá nhân (chỉ gameId, score, durationMs...).
 */

function createEmitter(host) {
  return function emit(name, detail = {}, { cancelable = false } = {}) {
    const event = new CustomEvent(`arcade:${name}`, {
      detail,
      bubbles: true,
      composed: true, // thoát khỏi shadow DOM để trang đích nghe được
      cancelable,
    });
    host.dispatchEvent(event);
    return event;
  };
}

exports.createEmitter = createEmitter;
};
__defs["core/game-controller.js"] = function (exports, __req) {
/**
 * game-controller.js — bộ điều phối vòng đời game trong <arcade-404>.
 *
 * Ràng buộc kiến trúc (theo plan):
 *  - Chỉ MỘT game hoạt động tại một thời điểm.
 *  - Đổi game: await destroy() game cũ xong mới mount game mới.
 *  - Module game chỉ import khi người dùng chọn (lazy).
 *  - Mỗi phiên game có AbortController; signal đưa vào context để game
 *    tự gỡ listener/tác vụ khi bị hủy.
 *  - Game 2D dùng chrome + overlay của shell; game fullBleed (404 Strike)
 *    tự quản màn hình riêng, shell chỉ cấp surface + dịch vụ.
 */

const { getGame } = __req("core/game-registry.js");
const { createOverlayManager } = __req("ui/overlays.js");

function createController({ refs, storage, audio, emit, config, onScoreSaved }) {
  const overlay = createOverlayManager(refs.overlay);
  const winEl = refs.stage.querySelector(".game-window");
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  /** { id, meta, game, status, abort, startedAt } */
  let current = null;
  let openToken = 0;
  let openerEl = null;
  const btnPauseIcon = refs.btnPause.querySelector("use");

  /* ---------- Trợ giúp ---------- */

  function syncPauseBtn() {
    const status = current?.status;
    const canPause = status === "running" || status === "paused";
    refs.btnPause.disabled = !canPause;
    const paused = status === "paused";
    refs.btnPauseLabel.textContent = paused ? "Tiếp tục" : "Tạm dừng";
    btnPauseIcon.setAttribute("href", paused ? "#i-play" : "#i-pause");
  }

  function lockScroll(on) {
    const body = document.body;
    if (on) {
      body.dataset.arcadePrevOverflow = body.style.overflow || "";
      body.style.overflow = "hidden";
    } else {
      body.style.overflow = body.dataset.arcadePrevOverflow || "";
      delete body.dataset.arcadePrevOverflow;
    }
  }

  /* ---------- Vòng đời 2D ---------- */

  function startMatch() {
    if (!current || current.status !== "ready") return;
    overlay.hide();
    audio.play("start");
    current.startedAt = performance.now();
    current.game.start();
    current.status = "running";
    emit("game-start", { gameId: current.id });
    syncPauseBtn();
  }

  function pause() {
    if (!current) return;
    if (current.meta.fullBleed) {
      current.game.pause();
      return;
    }
    if (current.status !== "running") return;
    current.game.pause();
    current.status = "paused";
    overlay.showPaused({
      onResume: resume,
      onRestart: restart,
      onSwitch: () => close({ toGames: true }),
    });
    syncPauseBtn();
  }

  function resume() {
    if (!current) return;
    if (current.meta.fullBleed) {
      current.game.resume();
      return;
    }
    if (current.status !== "paused") return;
    overlay.hide();
    current.game.resume();
    current.status = "running";
    syncPauseBtn();
  }

  function restart() {
    if (!current) return;
    overlay.hide();
    audio.play("start");
    current.startedAt = performance.now();
    current.game.restart();
    current.status = "running";
    emit("game-start", { gameId: current.id });
    syncPauseBtn();
  }

  /** Game báo kết thúc lượt. Trả về {last,best,isRecord} cho game ownResults. */
  function handleGameOver(score, extra = {}) {
    if (!current) return { last: 0, best: 0, isRecord: false };
    const durationMs = Math.round(performance.now() - (current.startedAt || performance.now()));
    current.status = "over";
    syncPauseBtn();

    const saved = storage.saveScore(current.id, score);
    onScoreSaved?.(current.id, saved);
    emit("game-over", { gameId: current.id, score: Math.floor(score), durationMs, ...extra });
    audio.play(saved.isRecord ? "record" : "over");

    if (!current.meta.ownResults) {
      overlay.showGameOver(score, saved, {
        homeUrl: config.homeUrl,
        onRestart: restart,
        onSwitch: () => close({ toGames: true }),
        onHome: (e) => {
          const evt = emit("home", { from: current?.id || null }, { cancelable: true });
          if (evt.defaultPrevented) e.preventDefault();
        },
      });
    }
    return saved;
  }

  /* ---------- Phím tắt khi cửa sổ mở (game 2D) ---------- */

  function onStageKey(e) {
    if (!current || current.meta.fullBleed) return; // Strike tự xử lý Esc
    if (e.code === "Escape") {
      e.preventDefault();
      close({ toGames: true });
    } else if (e.code === "KeyP") {
      e.preventDefault();
      if (current.status === "running") pause();
      else if (current.status === "paused") resume();
    }
  }

  /* ---------- Mở / đóng ---------- */

  async function open(id, opener) {
    const meta = getGame(id);
    if (!meta || !config.enabledIds.has(id)) return;

    if (current) await close({ silent: true });

    openToken += 1;
    const token = openToken;
    openerEl = opener || null;

    winEl.dataset.accent = meta.accent;
    refs.stageTitle.textContent = meta.title;
    refs.stage.classList.toggle("fullbleed", !!meta.fullBleed);
    refs.stage.hidden = false;
    lockScroll(true);
    window.addEventListener("keydown", onStageKey);
    refs.btnPause.disabled = true;
    overlay.showLoading(meta);
    emit("game-change", { gameId: id });

    let module;
    try {
      module = await meta.loader();
    } catch (err) {
      if (token === openToken && !refs.stage.hidden) {
        overlay.showError(meta, {
          onRetry: () => open(meta.id, openerEl),
          onClose: () => close({ toGames: true }),
        });
      }
      emit("error", { gameId: id, message: String(err?.message || err) });
      return;
    }

    // Người dùng đã đóng / mở game khác trong lúc tải → bỏ qua
    if (token !== openToken || refs.stage.hidden) return;

    const abort = new AbortController();
    const game = module.createGame();
    current = { id, meta, game, status: "ready", abort, startedAt: 0 };

    try {
      await game.mount(refs.surface, {
        audio,
        storage,
        hudRoot: refs.hud,
        reducedMotion: reducedMotionQuery.matches,
        signal: abort.signal,
        config,
        getBest: () => storage.getScores(id).best,
        onGameOver: handleGameOver,
        onMatchStart: () => {
          if (!current) return;
          current.status = "running";
          current.startedAt = performance.now();
          emit("game-start", { gameId: id });
        },
        requestSwitch: () => close({ toGames: true }),
        requestHome: () => {
          const evt = emit("home", { from: id }, { cancelable: true });
          if (!evt.defaultPrevented) window.location.assign(config.homeUrl);
        },
        requestRestartFlow: () => {
          if (current) current.status = "running";
        },
      });
    } catch (err) {
      emit("error", { gameId: id, message: String(err?.message || err) });
      overlay.showError(meta, {
        onRetry: () => open(meta.id, openerEl),
        onClose: () => close({ toGames: true }),
      });
      return;
    }

    if (meta.fullBleed) {
      // Game tự vẽ start screen riêng (404 Strike)
      overlay.hide();
      current.status = "delegated";
    } else {
      overlay.showIntro(meta, { onStart: startMatch });
    }
    syncPauseBtn();
  }

  async function close({ silent = false, toGames = false } = {}) {
    openToken += 1;

    if (current) {
      const closing = current;
      current = null;
      closing.abort.abort();
      try {
        await closing.game.destroy();
      } catch {
        /* lỗi khi hủy không được chặn việc đóng cửa sổ */
      }
    }

    // Nhả pointer lock nếu game 3D còn giữ
    if (document.pointerLockElement) {
      try {
        document.exitPointerLock();
      } catch {
        /* bỏ qua */
      }
    }

    refs.surface.textContent = "";
    refs.hud.textContent = "";
    overlay.hide();
    refs.stage.hidden = true;
    refs.stage.classList.remove("fullbleed");
    lockScroll(false);
    window.removeEventListener("keydown", onStageKey);
    syncPauseBtn();

    if (silent) return;
    emit("game-change", { gameId: null });

    if (toGames) {
      refs.grid?.scrollIntoView({ block: "nearest" });
    }
    if (openerEl && openerEl.isConnected) {
      openerEl.focus({ preventScroll: !toGames });
    }
    openerEl = null;
  }

  /* ---------- Sự kiện toàn cục ---------- */

  const onVisibility = () => {
    if (document.visibilityState !== "hidden" || !current) return;
    if (current.meta.fullBleed) current.game.pause();
    else pause();
  };
  document.addEventListener("visibilitychange", onVisibility);

  refs.btnPause.addEventListener("click", (e) => {
    if (e.detail > 0) refs.btnPause.blur();
    if (!current) return;
    if (current.status === "running") pause();
    else if (current.status === "paused") resume();
  });

  refs.btnSwitch.addEventListener("click", () => close({ toGames: true }));

  return {
    open,
    close,
    pause,
    resume,
    get activeId() {
      return current?.id || null;
    },
    destroy() {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("keydown", onStageKey);
      return close({ silent: true });
    },
  };
}

exports.createController = createController;
};
__defs["core/game-registry.js"] = function (exports, __req) {
/**
 * game-registry.js — đăng ký 5 mini game.
 * Mỗi game chỉ khai báo metadata + loader (dynamic import). Module game
 * và engine 3D CHỈ được tải khi người dùng chọn (lazy-load, không nằm
 * trong initial bundle).
 *
 * Thêm game mới: thêm một mục vào GAMES + tạo games/<id>/index.js
 * export createGame() theo interface mount/start/pause/resume/restart/
 * resize/destroy.
 */

const GAMES = [
  {
    id: "runner",
    title: "Endless Runner",
    accent: "cyan",
    kind: "2d",
    goal: "Né chướng ngại vật, thu thập tinh thể. Tốc độ tăng dần — sống sót càng lâu, điểm càng cao!",
    hint: { keys: ["SPACE"], text: "nhảy" },
    controls: [
      { keys: ["Space", "↑", "W"], text: "nhảy (giữ để nhảy cao hơn)" },
      { keys: ["Chạm"], text: "chạm màn hình để nhảy" },
    ],
    loader: () => Promise.resolve(__req("games/runner/index.js")),
  },
  {
    id: "bug-hunter",
    title: "Bug Hunter",
    accent: "lime",
    kind: "2d",
    goal: "Diệt càng nhiều bọ càng tốt trong 30 giây. Hạ liên tiếp để ăn thưởng combo!",
    hint: { keys: [], text: "nhấp vào bọ (tránh bọ đỏ)" },
    controls: [
      { keys: ["Click", "Chạm"], text: "tiêu diệt bọ" },
      { keys: ["!"], text: "bọ đỏ phát sáng sẽ TRỪ điểm — đừng đụng vào" },
    ],
    loader: () => Promise.resolve(__req("games/bug-hunter/index.js")),
  },
  {
    id: "stack-tower",
    title: "Stack Tower",
    accent: "violet",
    kind: "2d",
    goal: "Xếp khối càng thẳng càng tốt — phần lệch sẽ bị cắt bỏ. Điểm bằng số tầng xếp được!",
    hint: { keys: [], text: "nhấn để thả khối" },
    controls: [
      { keys: ["Click", "Space", "Chạm"], text: "thả khối" },
      { keys: ["★"], text: "thả trùng khớp hoàn hảo để giữ nguyên độ rộng" },
    ],
    loader: () => Promise.resolve(__req("games/stack-tower/index.js")),
  },
  {
    id: "snake",
    title: "Snake",
    accent: "green",
    kind: "2d",
    goal: "Ăn táo để dài ra và lên cấp. Đừng đâm tường hay tự cắn thân mình!",
    hint: { keys: ["←", "↑", "↓", "→"], text: "điều hướng" },
    controls: [
      { keys: ["↑ ↓ ← →", "WASD"], text: "điều hướng" },
      { keys: ["Vuốt"], text: "vuốt trên màn hình cảm ứng (hoặc dùng d-pad)" },
    ],
    loader: () => Promise.resolve(__req("games/snake/index.js")),
  },
  {
    id: "strike",
    title: "404 Strike",
    accent: "magenta",
    kind: "3d",
    badge: "3D",
    goal: "Mini FPS 3D: sống sót qua các đợt tấn công của bot trong 90 giây.",
    hint: { keys: ["WASD"], text: "+ chuột — tối ưu desktop" },
    controls: [
      { keys: ["W A S D"], text: "di chuyển" },
      { keys: ["Chuột"], text: "quan sát / Click trái bắn / Click phải ngắm" },
      { keys: ["R"], text: "thay đạn" },
      { keys: ["Space", "Shift"], text: "nhảy / chạy" },
    ],
    // Toàn bộ engine WebGL chỉ tải ở đây — không nằm trong initial bundle
    loader: () => Promise.resolve(__req("games/strike/index.js")),
    fullBleed: true, // game tự vẽ chrome/HUD riêng, shell không hiện thanh cửa sổ
    ownResults: true, // game tự hiển thị màn hình kết quả theo reference
  },
];

const byId = new Map(GAMES.map((g) => [g.id, g]));

function getGame(id) {
  return byId.get(id) || null;
}

/** Lọc registry theo attribute enabled-games. */
function enabledGames(ids) {
  if (!ids || ids.length === 0) return GAMES;
  const set = new Set(ids);
  return GAMES.filter((g) => set.has(g.id));
}

exports.getGame = getGame; exports.enabledGames = enabledGames; exports.GAMES = GAMES;
};
__defs["games/runner/index.js"] = function (exports, __req) {
/**
 * runner.js — Endless Runner.
 * Nhân vật tự chạy qua thành phố neon; Space / ↑ / W / chạm để nhảy.
 * Né chướng ngại vật, thu thập tinh thể (+25đ). Tốc độ tăng dần có giới hạn.
 */

const { createCanvas } = __req("core/canvas.js");
const { createLoop } = __req("core/loop.js");
const { createKeyboard, onPointerDown, holdTracker } = __req("core/input-manager.js");
const { createHud } = __req("core/hud.js");
const { clamp, randRange, formatScore, seededRand } = __req("core/utils.js");

const GRAVITY = 2500;
const JUMP_V = -930;
const JUMP_CUT = 2600; // trọng lực bổ sung khi nhả nút sớm (nhảy thấp)
const SPEED_MIN = 330;
const SPEED_MAX = 750;
const MONO = '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace';

function createGame() {
  let opts = null;
  let view = null;
  let ctx = null;
  let W = 0;
  let H = 0;
  let groundY = 0;
  let keys = null;
  let offPointer = null;
  let hold = null;
  let hud = null;
  let loop = null;

  let phase = "idle"; // idle | run | die | over
  let paused = false;

  let player;
  let obstacles;
  let coins;
  let particles;
  let texts;
  let speed;
  let score;
  let best;
  let dist;
  let elapsed;
  let obstacleGap;
  let coinGap;
  let dieT;
  let flashT;
  let shakeT;
  let dustT;

  let stars = [];
  let layers = [];
  let skyGrad = null;

  /* ---------- Sinh cảnh nền (một lần khi mount) ---------- */

  function buildBackground() {
    const rand = seededRand(2024);
    stars = [];
    for (let i = 0; i < 46; i++) {
      stars.push({
        x: rand() * W,
        y: rand() * (groundY - 130),
        r: 0.6 + rand() * 1.4,
        tw: rand() * Math.PI * 2,
        cyan: rand() > 0.75,
      });
    }

    // Hai lớp nhà cao tầng với parallax khác nhau
    layers = [
      { color: "#120e35", parallax: 0.22, minH: 90, maxH: 190, buildings: [] },
      { color: "#1c1548", parallax: 0.45, minH: 50, maxH: 130, buildings: [] },
    ];
    for (const layer of layers) {
      let x = 0;
      while (x < W) {
        const bw = 34 + rand() * 60;
        const bh = layer.minH + rand() * (layer.maxH - layer.minH);
        const windows = [];
        for (let wy = 8; wy < bh - 8; wy += 12) {
          for (let wx = 5; wx < bw - 7; wx += 10) {
            if (rand() > 0.78) {
              windows.push({ wx, wy, cyan: rand() > 0.5 });
            }
          }
        }
        layer.buildings.push({ x, w: bw, h: bh, windows });
        x += bw + 6 + rand() * 16;
      }
    }

    skyGrad = ctx.createLinearGradient(0, 0, 0, H);
    skyGrad.addColorStop(0, "#241150");
    skyGrad.addColorStop(0.6, "#171040");
    skyGrad.addColorStop(1, "#0d0b28");
  }

  /* ---------- Vòng đời ---------- */

  function reset() {
    player = {
      x: Math.round(W * 0.15),
      y: groundY - 40,
      w: 32,
      h: 40,
      vy: 0,
      grounded: true,
      coyote: 0,
      buffer: 0,
      rot: 0,
    };
    obstacles = [];
    coins = [];
    particles = [];
    texts = [];
    speed = SPEED_MIN;
    score = 0;
    best = opts.getBest();
    dist = 0;
    elapsed = 0;
    obstacleGap = 620; // quãng đường tới vật cản đầu tiên
    coinGap = 380;
    dieT = 0;
    flashT = 0;
    shakeT = 0;
    dustT = 0;
    hud.set("score", formatScore(0));
    hud.set("best", formatScore(best));
  }

  function jumpInput() {
    if (phase !== "run" || paused) return;
    player.buffer = 0.12; // đệm phím: nhấn sớm một chút vẫn nhảy khi chạm đất
  }

  function die() {
    phase = "die";
    dieT = 0.62;
    flashT = 0.16;
    if (!opts.reducedMotion) shakeT = 0.35;
    player.vy = -430; // bật nhẹ lên khi trúng vật cản
    player.grounded = false;
    opts.audio.play("hit");
    burst(player.x + player.w / 2, player.y + player.h / 2, 16, ["#3be8ff", "#ff58c7", "#edf1ff"]);
  }

  /* ---------- Spawn ---------- */

  function spawnObstacle() {
    const roll = Math.random();
    let obstacle;
    if (speed > 430 && roll < 0.18) {
      obstacle = { type: "dspike", x: W + 80, w: 64, h: 30 };
    } else if (roll < 0.5) {
      obstacle = { type: "spike", x: W + 80, w: 34, h: 32 };
    } else if (roll < 0.78) {
      obstacle = { type: "spike", x: W + 80, w: 30, h: 42 };
    } else {
      obstacle = { type: "block", x: W + 80, w: 28, h: 56 };
    }
    obstacle.y = groundY - obstacle.h;
    obstacles.push(obstacle);
    const minGap = clamp(speed * 0.55, 250, 480);
    obstacleGap = randRange(minGap, minGap + 280);
  }

  function spawnCoins() {
    let baseY = groundY - randRange(85, 160);
    // Nếu vừa có vật cản mọc gần vị trí spawn thì đẩy tinh thể lên cao
    const conflict = obstacles.some((o) => o.x > W - 40 && o.x < W + 220);
    if (conflict) baseY = groundY - 168;
    for (let i = 0; i < 3; i++) {
      coins.push({
        x: W + 80 + i * 38,
        y: baseY - Math.sin((i / 2) * Math.PI) * 12,
        r: 9,
        phase: i * 0.7,
      });
    }
    coinGap = randRange(520, 1050);
  }

  function burst(x, y, count, colors) {
    const total = opts.reducedMotion ? Math.ceil(count / 2) : count;
    for (let i = 0; i < total; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = randRange(60, 260);
      particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 60,
        life: randRange(0.3, 0.6),
        t: 0,
        size: randRange(2, 5),
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }

  /* ---------- Cập nhật ---------- */

  function update(dt) {
    elapsed += dt;

    if (phase === "run") {
      speed = Math.min(SPEED_MAX, SPEED_MIN + elapsed * 8.5);
      dist += speed * dt;
      if (dist > W * 840) dist -= W * 840; // giữ độ chính xác float khi chơi lâu

      score += dt * (10 + speed * 0.022);
      hud.set("score", formatScore(score));
      if (score > best) {
        best = Math.floor(score);
        hud.set("best", formatScore(best));
      }

      // --- Vật lý nhân vật ---
      player.buffer -= dt;
      player.coyote -= dt;
      if (player.buffer > 0 && (player.grounded || player.coyote > 0)) {
        player.vy = JUMP_V;
        player.grounded = false;
        player.coyote = 0;
        player.buffer = 0;
        opts.audio.play("jump");
      }
      player.vy += GRAVITY * dt;
      // Nhả nút sớm → rơi nhanh hơn → kiểm soát độ cao cú nhảy
      const held =
        keys.isDown("Space") || keys.isDown("ArrowUp") || keys.isDown("KeyW") || hold.isHeld();
      if (player.vy < 0 && !held) player.vy += JUMP_CUT * dt;

      player.y += player.vy * dt;
      if (player.y >= groundY - player.h) {
        if (!player.grounded) burst(player.x + 8, groundY - 2, 4, ["rgba(59,232,255,.7)"]);
        player.y = groundY - player.h;
        player.vy = 0;
        player.grounded = true;
        player.coyote = 0.09;
      } else if (player.grounded) {
        player.grounded = false;
        player.coyote = 0.09;
      }

      // Bụi chân khi chạy trên đất
      dustT -= dt;
      if (player.grounded && dustT <= 0 && !opts.reducedMotion) {
        dustT = 0.08;
        particles.push({
          x: player.x + 2,
          y: groundY - 3,
          vx: -randRange(40, 90),
          vy: -randRange(10, 50),
          life: 0.35,
          t: 0,
          size: 2.5,
          color: "rgba(59,232,255,.5)",
        });
      }

      // --- Spawn theo quãng đường ---
      obstacleGap -= speed * dt;
      if (obstacleGap <= 0) spawnObstacle();
      coinGap -= speed * dt;
      if (coinGap <= 0) spawnCoins();

      // --- Va chạm ---
      const px = player.x + 5;
      const py = player.y + 4;
      const pw = player.w - 10;
      const ph = player.h - 8;
      for (const o of obstacles) {
        // Hitbox thu nhỏ cho gai (hình tam giác) để công bằng hơn
        const inset = o.type !== "block" ? 0.22 : 0.05;
        const ox = o.x + o.w * inset;
        const oy = o.y + o.h * 0.25;
        const ow = o.w * (1 - inset * 2);
        const oh = o.h * 0.75;
        if (px < ox + ow && px + pw > ox && py < oy + oh && py + ph > oy) {
          die();
          break;
        }
      }
      if (phase === "run") {
        for (const c of coins) {
          if (c.taken) continue;
          const dx = c.x - clamp(c.x, px, px + pw);
          const dy = c.y - clamp(c.y, py, py + ph);
          if (dx * dx + dy * dy < c.r * c.r * 2.4) {
            c.taken = true;
            score += 25;
            opts.audio.play("coin");
            burst(c.x, c.y, 8, ["#ffd23f", "#fff3c4"]);
            texts.push({ x: c.x, y: c.y - 14, txt: "+25", color: "#ffd23f", t: 0 });
          }
        }
      }
    }

    if (phase === "die") {
      // Nhân vật lộn nhào rơi xuống
      player.vy += GRAVITY * dt;
      player.y += player.vy * dt;
      player.x -= 55 * dt;
      player.rot += 9 * dt;
      dieT -= dt;
      if (dieT <= 0) {
        phase = "over";
        loop.stop();
        render();
        opts.onGameOver(Math.floor(score));
        return;
      }
    }

    // Vật thể trôi về bên trái theo tốc độ nền
    const move = (phase === "run" ? speed : speed * 0.25) * dt;
    for (const o of obstacles) o.x -= move;
    for (const c of coins) {
      c.x -= move;
      c.phase += dt * 5;
    }
    obstacles = obstacles.filter((o) => o.x > -120);
    coins = coins.filter((c) => c.x > -40 && !c.taken);

    for (const p of particles) {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 500 * dt;
    }
    particles = particles.filter((p) => p.t < p.life);

    for (const t of texts) t.t += dt;
    texts = texts.filter((t) => t.t < 0.8);

    flashT = Math.max(0, flashT - dt);
    shakeT = Math.max(0, shakeT - dt);

    render();
  }

  /* ---------- Vẽ ---------- */

  function drawBackground() {
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);

    for (const s of stars) {
      const a = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(elapsed * 2 + s.tw));
      ctx.fillStyle = s.cyan ? `rgba(59,232,255,${a})` : `rgba(237,241,255,${a})`;
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }

    // Mặt trời synthwave
    const sunX = W * 0.72;
    const sunY = 105;
    const sunR = 52;
    const sun = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
    sun.addColorStop(0, "#ffd23f");
    sun.addColorStop(1, "#ff58c7");
    ctx.save();
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = sun;
    ctx.fillRect(sunX - sunR, sunY - sunR, sunR * 2, sunR * 2);
    ctx.fillStyle = "#171040";
    for (let i = 0; i < 5; i++) ctx.fillRect(sunX - sunR, sunY + 6 + i * 11, sunR * 2, 4);
    ctx.restore();

    // Nhà cao tầng (2 lớp parallax)
    for (const layer of layers) {
      const off = (dist * layer.parallax) % W;
      for (const pass of [0, 1]) {
        ctx.save();
        ctx.translate(pass * W - off, 0);
        for (const b of layer.buildings) {
          ctx.fillStyle = layer.color;
          ctx.fillRect(b.x, groundY - b.h, b.w, b.h);
          for (const w of b.windows) {
            ctx.fillStyle = w.cyan ? "rgba(59,232,255,.4)" : "rgba(255,210,63,.32)";
            ctx.fillRect(b.x + w.wx, groundY - b.h + w.wy, 3, 4);
          }
        }
        ctx.restore();
      }
    }

    // Mặt đường
    ctx.fillStyle = "#0a0820";
    ctx.fillRect(0, groundY, W, H - groundY);
    ctx.fillStyle = "rgba(59,232,255,.28)";
    ctx.fillRect(0, groundY - 1, W, 4);
    ctx.fillStyle = "#3be8ff";
    ctx.fillRect(0, groundY, W, 2);
    // Vạch kẻ trôi theo tốc độ
    ctx.fillStyle = "rgba(59,232,255,.22)";
    const tickOff = dist % 48;
    for (let x = -tickOff; x < W; x += 48) {
      ctx.fillRect(x, groundY + 12, 18, 2);
    }
    ctx.fillStyle = "rgba(59,232,255,.08)";
    ctx.fillRect(0, groundY + 26, W, 1);
  }

  function drawObstacle(o) {
    if (o.type === "block") {
      ctx.fillStyle = "#b07bff";
      ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.fillStyle = "rgba(255,255,255,.3)";
      ctx.fillRect(o.x, o.y, o.w, 4);
      ctx.fillStyle = "rgba(5,7,15,.4)";
      for (let y = o.y + 12; y < o.y + o.h; y += 12) ctx.fillRect(o.x, y, o.w, 3);
      return;
    }
    const spikes = o.type === "dspike" ? 2 : 1;
    const sw = o.w / spikes;
    for (let i = 0; i < spikes; i++) {
      const sx = o.x + i * sw;
      ctx.fillStyle = "#ff58c7";
      ctx.beginPath();
      ctx.moveTo(sx, o.y + o.h);
      ctx.lineTo(sx + sw / 2, o.y);
      ctx.lineTo(sx + sw, o.y + o.h);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(5,7,15,.45)";
      ctx.beginPath();
      ctx.moveTo(sx + sw * 0.28, o.y + o.h);
      ctx.lineTo(sx + sw / 2, o.y + o.h * 0.34);
      ctx.lineTo(sx + sw * 0.72, o.y + o.h);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawCoin(c) {
    const s = 0.55 + 0.45 * Math.abs(Math.sin(c.phase));
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.scale(s, 1);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = "#ffd23f";
    ctx.fillRect(-7, -7, 14, 14);
    ctx.fillStyle = "rgba(255,255,255,.7)";
    ctx.fillRect(-7, -7, 5, 5);
    ctx.restore();
  }

  function drawPlayer() {
    const { x, y, w, h } = player;
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(player.rot);

    // Chân (2 nhịp khi chạy, co lại khi bay)
    ctx.fillStyle = "#22b8cf";
    if (player.grounded && phase === "run") {
      const step = Math.sin(dist * 0.06);
      ctx.fillRect(-10 + step * 4, h / 2 - 10, 7, 10);
      ctx.fillRect(3 - step * 4, h / 2 - 10, 7, 10);
    } else {
      ctx.fillRect(-10, h / 2 - 8, 7, 7);
      ctx.fillRect(3, h / 2 - 8, 7, 7);
    }

    // Thân robot
    ctx.fillStyle = "#3be8ff";
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h - 8, 5);
    ctx.fill();
    // Kính che mặt + mắt
    ctx.fillStyle = "#061018";
    ctx.fillRect(-w / 2 + 5, -h / 2 + 8, w - 10, 9);
    ctx.fillStyle = "#eafcff";
    ctx.fillRect(w / 2 - 13, -h / 2 + 10, 5, 5);
    // Đèn ăng-ten
    ctx.fillStyle = "#ff58c7";
    ctx.fillRect(-2, -h / 2 - 5, 4, 5);
    ctx.restore();
  }

  function render() {
    ctx.save();
    if (shakeT > 0) {
      const power = shakeT * 16;
      ctx.translate(randRange(-power, power), randRange(-power, power));
    }

    drawBackground();
    for (const c of coins) drawCoin(c);
    for (const o of obstacles) drawObstacle(o);

    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    drawPlayer();

    ctx.font = `700 15px ${MONO}`;
    ctx.textAlign = "center";
    for (const t of texts) {
      ctx.globalAlpha = Math.max(0, 1 - t.t / 0.8);
      ctx.fillStyle = t.color;
      ctx.fillText(t.txt, t.x, t.y - t.t * 42);
    }
    ctx.globalAlpha = 1;

    if (flashT > 0) {
      ctx.fillStyle = `rgba(255,255,255,${(flashT / 0.16) * 0.5})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  /* ---------- Interface vòng đời chuẩn ---------- */

  return {
    mount(container, options) {
      opts = options;
      // Màn hình hẹp (mobile dọc) dùng khung vuông hơn cho dễ nhìn
      const compact = container.clientWidth > 0 && container.clientWidth < 560;
      W = compact ? 720 : 960;
      H = compact ? 470 : 420;
      groundY = H - 76;

      view = createCanvas(container, { width: W, height: H });
      ctx = view.ctx;

      hud = createHud(options.hudRoot);
      hud.addStat({ id: "score", label: "Điểm", accent: "cyan" });
      hud.addStat({ id: "best", label: "Kỷ lục", accent: "violet", small: true });

      keys = createKeyboard();
      keys.on(["Space", "ArrowUp", "KeyW"], jumpInput);
      offPointer = onPointerDown(view.canvas, jumpInput);
      hold = holdTracker(view.canvas);

      loop = createLoop(update);
      buildBackground();
      reset();
      render(); // khung hình tĩnh phía sau overlay hướng dẫn
    },

    start() {
      if (phase === "run") return;
      reset();
      phase = "run";
      paused = false;
      loop.start();
    },

    pause() {
      if (paused || phase === "over") return;
      paused = true;
      loop.stop();
    },

    resume() {
      if (!paused) return;
      paused = false;
      if (phase !== "over") loop.start();
    },

    restart() {
      paused = false;
      reset();
      phase = "run";
      loop.start();
    },

    destroy() {
      loop.stop();
      keys.destroy();
      offPointer();
      hold.off();
      hud.destroy();
      view.destroy();
      phase = "idle";
    },
  };
}

exports.createGame = createGame;
};
__defs["core/canvas.js"] = function (exports, __req) {
/**
 * canvas.js — tạo canvas theo kích thước logic cố định.
 * Buffer nội bộ nhân theo devicePixelRatio (tối đa 2) để nét trên màn
 * hình retina; CSS được scale tự động để canvas luôn vừa khít container
 * (ResizeObserver). Game chỉ cần vẽ theo tọa độ logic (width × height).
 */

function createCanvas(container, { width, height, className = "" } = {}) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.className = `game-canvas ${className}`.trim();

  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  container.appendChild(canvas);

  // Scale CSS để giữ nguyên tỉ lệ và nằm gọn trong container
  const fit = () => {
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    if (!cw || !ch) return;
    const s = Math.min(cw / width, ch / height);
    canvas.style.width = `${Math.floor(width * s)}px`;
    canvas.style.height = `${Math.floor(height * s)}px`;
  };
  fit();

  const ro = new ResizeObserver(fit);
  ro.observe(container);

  const stopMenu = (e) => e.preventDefault(); // chặn menu chuột phải/giữ lâu
  canvas.addEventListener("contextmenu", stopMenu);

  return {
    canvas,
    ctx,
    width,
    height,
    /** Đổi tọa độ sự kiện chuột/chạm sang tọa độ logic của canvas. */
    pos(e) {
      const r = canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - r.left) * width) / r.width,
        y: ((e.clientY - r.top) * height) / r.height,
      };
    },
    destroy() {
      ro.disconnect();
      canvas.removeEventListener("contextmenu", stopMenu);
      canvas.remove();
    },
  };
}

exports.createCanvas = createCanvas;
};
__defs["core/loop.js"] = function (exports, __req) {
/**
 * loop.js — vòng lặp game dựa trên requestAnimationFrame.
 * dt được giới hạn 50ms để tránh "bước nhảy thời gian" khi tab bị
 * throttle. stop() hủy rAF — bắt buộc gọi khi pause/destroy.
 */

function createLoop(step) {
  let rafId = 0;
  let last = 0;
  let running = false;

  const frame = (t) => {
    if (!running) return;
    const dt = Math.min((t - last) / 1000, 0.05);
    last = t;
    step(dt);
    rafId = requestAnimationFrame(frame);
  };

  return {
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      rafId = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(rafId);
    },
    get running() {
      return running;
    },
  };
}

exports.createLoop = createLoop;
};
__defs["core/input-manager.js"] = function (exports, __req) {
/**
 * input-manager.js — input dùng chung (bàn phím, con trỏ, vuốt, giữ).
 * Mỗi game tạo instance riêng trong mount() và PHẢI gọi destroy()
 * (hoặc dùng AbortSignal của context) để gỡ toàn bộ listener.
 */

/** Quản lý bàn phím theo e.code, tự preventDefault cho phím đã đăng ký. */
function createKeyboard({ signal } = {}) {
  const bindings = [];
  const down = new Set();

  const onKeyDown = (e) => {
    // Nhường phím cho phần tử tương tác đang focus (nút, link, input...)
    const target = e.target;
    if (target instanceof Element && target.closest("button, a, input, select, textarea")) {
      return;
    }
    down.add(e.code);
    for (const b of bindings) {
      if (b.codes.has(e.code)) {
        e.preventDefault();
        if (!e.repeat || b.repeat) b.fn(e);
      }
    }
  };
  const onKeyUp = (e) => down.delete(e.code);
  const onBlur = () => down.clear();

  const opts = signal ? { signal } : undefined;
  window.addEventListener("keydown", onKeyDown, opts);
  window.addEventListener("keyup", onKeyUp, opts);
  window.addEventListener("blur", onBlur, opts);

  return {
    on(codes, fn, { repeat = false } = {}) {
      bindings.push({ codes: new Set(codes), fn, repeat });
    },
    isDown(code) {
      return down.has(code);
    },
    clearDown() {
      down.clear();
    },
    destroy() {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      bindings.length = 0;
      down.clear();
    },
  };
}

/** Bắt pointerdown (chuột trái / chạm). Trả về hàm gỡ listener. */
function onPointerDown(el, fn) {
  const handler = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    fn(e);
  };
  el.addEventListener("pointerdown", handler);
  return () => el.removeEventListener("pointerdown", handler);
}

/** Theo dõi trạng thái "đang giữ" chuột/chạm trên một phần tử. */
function holdTracker(el) {
  let held = false;
  const downH = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    held = true;
  };
  const upH = () => {
    held = false;
  };
  el.addEventListener("pointerdown", downH);
  window.addEventListener("pointerup", upH);
  window.addEventListener("pointercancel", upH);
  return {
    isHeld: () => held,
    off() {
      el.removeEventListener("pointerdown", downH);
      window.removeEventListener("pointerup", upH);
      window.removeEventListener("pointercancel", upH);
    },
  };
}

/** Vuốt 4 hướng: fn nhận 'up'|'down'|'left'|'right'. Trả về hàm gỡ. */
function onSwipe(el, fn, threshold = 24) {
  let sx = 0;
  let sy = 0;
  let activeId = null;

  const downH = (e) => {
    activeId = e.pointerId;
    sx = e.clientX;
    sy = e.clientY;
    e.preventDefault();
  };
  const moveH = (e) => {
    if (e.pointerId !== activeId) return;
    const dx = e.clientX - sx;
    const dy = e.clientY - sy;
    if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return;
    if (Math.abs(dx) > Math.abs(dy)) fn(dx > 0 ? "right" : "left");
    else fn(dy > 0 ? "down" : "up");
    sx = e.clientX;
    sy = e.clientY;
  };
  const upH = (e) => {
    if (e.pointerId === activeId) activeId = null;
  };

  el.addEventListener("pointerdown", downH);
  el.addEventListener("pointermove", moveH);
  window.addEventListener("pointerup", upH);
  window.addEventListener("pointercancel", upH);

  return () => {
    el.removeEventListener("pointerdown", downH);
    el.removeEventListener("pointermove", moveH);
    window.removeEventListener("pointerup", upH);
    window.removeEventListener("pointercancel", upH);
  };
}

exports.createKeyboard = createKeyboard; exports.onPointerDown = onPointerDown; exports.holdTracker = holdTracker; exports.onSwipe = onSwipe;
};
__defs["core/hud.js"] = function (exports, __req) {
/**
 * hud.js — dựng bảng điểm (HUD) bên cạnh canvas.
 * Game khai báo các ô chỉ số cần hiển thị; shell cấp container.
 */

const { el } = __req("core/utils.js");

function createHud(root) {
  root.textContent = "";
  const values = new Map();

  return {
    root,

    /** Thêm một ô chỉ số: trả về chính phần tử để tùy biến thêm. */
    addStat({ id, label, value = "0", accent = "", small = false }) {
      const box = el("div", `hud-stat${small ? " small" : ""}`);
      if (accent) box.dataset.accent = accent;
      box.appendChild(el("span", "hud-label", label));
      const val = el("span", "hud-value", value);
      box.appendChild(val);
      root.appendChild(box);
      values.set(id, val);
      return box;
    },

    /** Cập nhật giá trị một ô chỉ số. */
    set(id, value) {
      const node = values.get(id);
      if (node && node.textContent !== String(value)) {
        node.textContent = String(value);
      }
    },

    /** Thêm phần tử tùy biến (vòng đếm giờ, d-pad...). */
    addCustom(node) {
      root.appendChild(node);
      return node;
    },

    destroy() {
      values.clear();
      root.textContent = "";
    },
  };
}

exports.createHud = createHud;
};
__defs["core/utils.js"] = function (exports, __req) {
/**
 * utils.js — hàm tiện ích dùng chung cho toàn package.
 */

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

const lerp = (a, b, t) => a + (b - a) * t;

const randRange = (min, max) => min + Math.random() * (max - min);

const randInt = (min, max) => Math.floor(randRange(min, max + 1));

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/** Điểm hiển thị kiểu arcade: đệm số 0 phía trước (vd: 002450). */
const formatScore = (n, digits = 6) =>
  String(Math.max(0, Math.floor(n))).padStart(digits, "0");

/** Số có dấu phân tách hàng nghìn theo vi-VN (dùng trên card, kết quả). */
const formatNumber = (n) => Math.max(0, Math.floor(n)).toLocaleString("vi-VN");

/** mm:ss cho đồng hồ trận đấu (vd 01:24). */
const formatTime = (seconds) => {
  const s = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * Bộ sinh số ngẫu nhiên có seed (mulberry32) — dùng cho hình vẽ cần ổn
 * định giữa các lần render (preview card, texture, bố cục nền...).
 */
function seededRand(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tạo phần tử DOM nhanh, gán class và text an toàn (không innerHTML). */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Tạo icon SVG tham chiếu sprite nội bộ trong shadow root. */
function svgIcon(id, className = "icon") {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", className);
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS(NS, "use");
  use.setAttribute("href", `#${id}`);
  svg.appendChild(use);
  return svg;
}

/** Font mono dùng khi vẽ chữ trong canvas. */
const MONO_FONT =
  '"JetBrains Mono", ui-monospace, Menlo, Consolas, "Liberation Mono", monospace';

exports.seededRand = seededRand; exports.el = el; exports.svgIcon = svgIcon; exports.clamp = clamp; exports.lerp = lerp; exports.randRange = randRange; exports.randInt = randInt; exports.pick = pick; exports.formatScore = formatScore; exports.formatNumber = formatNumber; exports.formatTime = formatTime; exports.MONO_FONT = MONO_FONT;
};
__defs["games/bug-hunter/index.js"] = function (exports, __req) {
/**
 * bug-hunter.js — Bug Hunter.
 * Bọ xuất hiện ngẫu nhiên trên "bo mạch"; click/chạm để tiêu diệt trong
 * 30 giây. 4 loại bọ với điểm/tốc độ khác nhau; bọ đỏ phát sáng TRỪ điểm.
 * Hạ liên tiếp (không trượt) để tăng chuỗi combo nhận điểm thưởng.
 */

const { createCanvas } = __req("core/canvas.js");
const { createLoop } = __req("core/loop.js");
const { onPointerDown } = __req("core/input-manager.js");
const { createHud } = __req("core/hud.js");
const { clamp, lerp, randRange, formatScore } = __req("core/utils.js");

const ROUND_TIME = 30;
const MONO = '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace';

/* Các loại bọ: điểm, tốc độ, kích thước, tuổi thọ, trọng số xuất hiện */
const BUG_TYPES = [
  { id: "green",  color: "#4bf584", points: 10,  speed: [40, 75],   r: 19, ttl: 4.6, weight: 42, danger: false },
  { id: "yellow", color: "#ffd23f", points: 25,  speed: [85, 125],  r: 17, ttl: 3.6, weight: 28, danger: false },
  { id: "blue",   color: "#3be8ff", points: 50,  speed: [135, 175], r: 14, ttl: 2.9, weight: 13, danger: false },
  { id: "red",    color: "#ff5d6b", points: -40, speed: [60, 105],  r: 19, ttl: 4.2, weight: 17, danger: true },
];
const TOTAL_WEIGHT = BUG_TYPES.reduce((sum, t) => sum + t.weight, 0);

function rollType() {
  let roll = Math.random() * TOTAL_WEIGHT;
  for (const type of BUG_TYPES) {
    roll -= type.weight;
    if (roll <= 0) return type;
  }
  return BUG_TYPES[0];
}

function createGame() {
  let opts = null;
  let view = null;
  let ctx = null;
  let W = 0;
  let H = 0;
  let hud = null;
  let loop = null;
  let offPointer = null;

  let phase = "idle"; // idle | run | over
  let paused = false;

  let bugs;
  let particles;
  let texts;
  let rings; // hiệu ứng vòng lan khi bấm
  let score;
  let combo;
  let comboTimer;
  let timeLeft;
  let spawnTimer;
  let elapsed;

  // Tham chiếu tới vòng đếm giờ trong HUD
  let ringEl = null;
  let ringProgress = null;
  let ringNum = null;
  const RING_LEN = 2 * Math.PI * 30;

  /* ---------- HUD: vòng đếm thời gian bằng SVG ---------- */

  function buildTimeRing() {
    const NS = "http://www.w3.org/2000/svg";
    const box = document.createElement("div");
    box.className = "hud-stat";
    box.dataset.accent = "lime";

    const label = document.createElement("span");
    label.className = "hud-label";
    label.textContent = "Thời gian";
    box.appendChild(label);

    const wrap = document.createElement("div");
    wrap.className = "hud-time-ring";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 72 72");
    const track = document.createElementNS(NS, "circle");
    track.setAttribute("class", "ring-track");
    track.setAttribute("cx", "36");
    track.setAttribute("cy", "36");
    track.setAttribute("r", "30");
    const progress = document.createElementNS(NS, "circle");
    progress.setAttribute("class", "ring-progress");
    progress.setAttribute("cx", "36");
    progress.setAttribute("cy", "36");
    progress.setAttribute("r", "30");
    progress.setAttribute("transform", "rotate(-90 36 36)");
    progress.setAttribute("stroke-dasharray", String(RING_LEN));
    svg.append(track, progress);
    wrap.appendChild(svg);

    const num = document.createElement("div");
    num.className = "hud-time-num";
    num.textContent = String(ROUND_TIME);
    const unit = document.createElement("small");
    unit.textContent = "giây";
    num.appendChild(unit);
    wrap.appendChild(num);

    box.appendChild(wrap);
    hud.addCustom(box);

    ringEl = box;
    ringProgress = progress;
    ringNum = num;
  }

  function updateTimeRing() {
    const frac = clamp(timeLeft / ROUND_TIME, 0, 1);
    ringProgress.setAttribute("stroke-dashoffset", String(RING_LEN * (1 - frac)));
    // Chỉ cập nhật text node đầu (giữ nguyên <small>giây</small>)
    const secs = String(Math.max(0, Math.ceil(timeLeft)));
    if (ringNum.firstChild.nodeValue !== secs) ringNum.firstChild.nodeValue = secs;
    ringEl.classList.toggle("time-warn", timeLeft <= 10 && timeLeft > 5);
    ringEl.classList.toggle("time-danger", timeLeft <= 5);
  }

  /* ---------- Vòng đời ---------- */

  function reset() {
    bugs = [];
    particles = [];
    texts = [];
    rings = [];
    score = 0;
    combo = 0;
    comboTimer = 0;
    timeLeft = ROUND_TIME;
    spawnTimer = 0.3;
    elapsed = 0;
    hud.set("score", formatScore(0));
    hud.set("combo", "×0");
    updateTimeRing();
  }

  function spawnBug() {
    const type = rollType();
    const margin = 55;
    bugs.push({
      type,
      x: randRange(margin, W - margin),
      y: randRange(margin, H - margin),
      dir: Math.random() * Math.PI * 2,
      speed: randRange(type.speed[0], type.speed[1]),
      r: type.r,
      age: 0,
      ttl: type.ttl,
      legPhase: Math.random() * 10,
      dead: false,
      deadT: 0,
    });
  }

  function onTap(e) {
    if (phase !== "run" || paused) return;
    const { x, y } = view.pos(e);

    // Duyệt ngược để ưu tiên con bọ vẽ trên cùng
    for (let i = bugs.length - 1; i >= 0; i--) {
      const bug = bugs[i];
      if (bug.dead) continue;
      const dx = bug.x - x;
      const dy = bug.y - y;
      const slop = bug.r + 13; // nới hitbox cho dễ chạm trên mobile
      if (dx * dx + dy * dy > slop * slop) continue;

      bug.dead = true;
      bug.deadT = 0.28;

      if (bug.type.danger) {
        // Bọ đỏ: trừ điểm + mất chuỗi combo
        score = Math.max(0, score + bug.type.points);
        combo = 0;
        comboTimer = 0;
        opts.audio.play("bad");
        texts.push({ x: bug.x, y: bug.y - 18, txt: String(bug.type.points), color: "#ff5d6b", t: 0, big: true });
        splat(bug.x, bug.y, "#ff5d6b");
      } else {
        combo += 1;
        comboTimer = 2.5;
        const bonus = Math.min(50, (combo - 1) * 5); // thưởng chuỗi, có trần
        const total = bug.type.points + bonus;
        score += total;
        opts.audio.play(combo > 0 && combo % 5 === 0 ? "combo" : "squash");
        texts.push({ x: bug.x, y: bug.y - 18, txt: `+${total}`, color: bug.type.color, t: 0 });
        if (combo >= 5 && combo % 5 === 0) {
          texts.push({ x: W / 2, y: H / 2 - 30, txt: `COMBO ×${combo}!`, color: "#ffd23f", t: 0, big: true });
        }
        splat(bug.x, bug.y, bug.type.color);
      }

      hud.set("score", formatScore(score));
      hud.set("combo", `×${combo}`);
      return;
    }

    // Bấm hụt: mất chuỗi combo + vòng lan báo hiệu
    combo = 0;
    comboTimer = 0;
    hud.set("combo", "×0");
    rings.push({ x, y, t: 0 });
  }

  function splat(x, y, color) {
    const count = opts.reducedMotion ? 5 : 10;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = randRange(50, 220);
      particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: randRange(0.25, 0.5),
        t: 0,
        size: randRange(2, 4.5),
        color,
      });
    }
  }

  /* ---------- Cập nhật ---------- */

  function update(dt) {
    elapsed += dt;

    if (phase === "run") {
      timeLeft -= dt;
      updateTimeRing();
      if (timeLeft <= 0) {
        timeLeft = 0;
        phase = "over";
        loop.stop();
        render();
        opts.onGameOver(score);
        return;
      }

      // Combo hết hạn nếu ngừng hạ bọ quá lâu
      if (combo > 0) {
        comboTimer -= dt;
        if (comboTimer <= 0) {
          combo = 0;
          hud.set("combo", "×0");
        }
      }

      // Spawn nhanh dần về cuối trận
      spawnTimer -= dt;
      const alive = bugs.filter((b) => !b.dead).length;
      if (spawnTimer <= 0 && alive < 8) {
        spawnBug();
        const progress = 1 - timeLeft / ROUND_TIME;
        spawnTimer = lerp(0.85, 0.42, progress);
      }

      // Bọ bò lang thang, chạm mép thì quay đầu
      for (const bug of bugs) {
        if (bug.dead) {
          bug.deadT -= dt;
          continue;
        }
        bug.age += dt;
        bug.legPhase += dt * bug.speed * 0.3;
        bug.dir += randRange(-1.4, 1.4) * dt;
        bug.x += Math.cos(bug.dir) * bug.speed * dt;
        bug.y += Math.sin(bug.dir) * bug.speed * dt;
        const m = 30;
        if (bug.x < m) { bug.x = m; bug.dir = Math.PI - bug.dir; }
        if (bug.x > W - m) { bug.x = W - m; bug.dir = Math.PI - bug.dir; }
        if (bug.y < m) { bug.y = m; bug.dir = -bug.dir; }
        if (bug.y > H - m) { bug.y = H - m; bug.dir = -bug.dir; }
      }
      // Xóa bọ đã bị đập xong animation hoặc hết tuổi thọ (tự chui xuống đất)
      bugs = bugs.filter((b) => (b.dead ? b.deadT > 0 : b.age < b.ttl));
    }

    for (const p of particles) {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.98;
      p.vy *= 0.98;
    }
    particles = particles.filter((p) => p.t < p.life);

    for (const t of texts) t.t += dt;
    texts = texts.filter((t) => t.t < 0.85);

    for (const r of rings) r.t += dt;
    rings = rings.filter((r) => r.t < 0.3);

    render();
  }

  /* ---------- Vẽ ---------- */

  function drawBoard() {
    ctx.fillStyle = "#0c1322";
    ctx.fillRect(0, 0, W, H);

    // Lưới "bo mạch"
    ctx.strokeStyle = "rgba(200,245,66,.06)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y <= H; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // Bốn góc ngoặc trang trí
    ctx.strokeStyle = "rgba(200,245,66,.45)";
    ctx.lineWidth = 2;
    const L = 22;
    const P = 10;
    const corners = [
      [P, P, 1, 1],
      [W - P, P, -1, 1],
      [P, H - P, 1, -1],
      [W - P, H - P, -1, -1],
    ];
    for (const [cx, cy, sx, sy] of corners) {
      ctx.beginPath();
      ctx.moveTo(cx + sx * L, cy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx, cy + sy * L);
      ctx.stroke();
    }
  }

  function drawBug(bug) {
    const spawnScale = Math.min(1, bug.age / 0.22);
    const despawnScale = bug.ttl - bug.age < 0.4 ? (bug.ttl - bug.age) / 0.4 : 1;
    const scale = bug.dead ? 1 : spawnScale * Math.max(0.05, despawnScale);

    ctx.save();
    ctx.translate(bug.x, bug.y);

    if (bug.dead) {
      // Bẹp dí + mờ dần
      const k = Math.max(0, bug.deadT / 0.28);
      ctx.globalAlpha = k;
      ctx.rotate(bug.dir + Math.PI / 2);
      ctx.scale(1.25, 0.45);
    } else {
      ctx.rotate(bug.dir + Math.PI / 2);
      ctx.scale(scale, scale);
    }

    const color = bug.type.color;

    // Quầng cảnh báo của bọ đỏ (đập vào là mất điểm)
    if (bug.type.danger && !bug.dead) {
      const pulse = 0.55 + 0.45 * Math.sin(elapsed * 7 + bug.legPhase);
      ctx.fillStyle = `rgba(255,93,107,${0.13 + 0.1 * pulse})`;
      ctx.beginPath();
      ctx.arc(0, 0, bug.r + 12 + pulse * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(255,93,107,${0.4 + 0.3 * pulse})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, bug.r + 10, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Chân co duỗi theo nhịp bò
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    for (let i = -1; i <= 1; i++) {
      const swing = Math.sin(bug.legPhase + i * 1.1) * 3;
      ctx.beginPath();
      ctx.moveTo(-bug.r * 0.5, i * bug.r * 0.42);
      ctx.lineTo(-bug.r * 0.95, i * bug.r * 0.58 + swing);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(bug.r * 0.5, i * bug.r * 0.42);
      ctx.lineTo(bug.r * 0.95, i * bug.r * 0.58 - swing);
      ctx.stroke();
    }

    // Thân + đầu
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, bug.r * 0.1, bug.r * 0.62, bug.r * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -bug.r * 0.85, bug.r * 0.38, 0, Math.PI * 2);
    ctx.fill();

    // Vạch cánh + chấm
    ctx.strokeStyle = "rgba(5,7,15,.55)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -bug.r * 0.4);
    ctx.lineTo(0, bug.r * 0.9);
    ctx.stroke();
    ctx.fillStyle = "rgba(5,7,15,.4)";
    ctx.beginPath();
    ctx.arc(-bug.r * 0.28, bug.r * 0.05, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(bug.r * 0.28, bug.r * 0.35, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Mắt
    if (!bug.dead) {
      ctx.fillStyle = "#061018";
      ctx.beginPath();
      ctx.arc(-bug.r * 0.16, -bug.r * 0.95, 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(bug.r * 0.16, -bug.r * 0.95, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function render() {
    drawBoard();

    for (const bug of bugs) drawBug(bug);

    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // Vòng lan khi bấm hụt
    for (const r of rings) {
      const k = r.t / 0.3;
      ctx.strokeStyle = `rgba(200,245,66,${0.5 * (1 - k)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 6 + k * 22, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.textAlign = "center";
    for (const t of texts) {
      ctx.globalAlpha = Math.max(0, 1 - t.t / 0.85);
      ctx.font = t.big ? `800 22px ${MONO}` : `700 15px ${MONO}`;
      ctx.fillStyle = t.color;
      ctx.fillText(t.txt, t.x, t.y - t.t * 40);
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- Interface vòng đời chuẩn ---------- */

  return {
    mount(container, options) {
      opts = options;
      const compact = container.clientWidth > 0 && container.clientWidth < 560;
      W = compact ? 720 : 960;
      H = compact ? 560 : 540;

      view = createCanvas(container, { width: W, height: H, className: "crosshair" });
      ctx = view.ctx;

      hud = createHud(options.hudRoot);
      buildTimeRing();
      hud.addStat({ id: "score", label: "Điểm", accent: "cyan" });
      hud.addStat({ id: "combo", label: "Combo", accent: "gold", small: true, value: "×0" });

      offPointer = onPointerDown(view.canvas, onTap);
      loop = createLoop(update);
      reset();
      // Vài con bọ "mồi" cho khung hình giới thiệu
      for (let i = 0; i < 3; i++) spawnBug();
      render();
    },

    start() {
      if (phase === "run") return;
      reset();
      for (let i = 0; i < 3; i++) spawnBug();
      phase = "run";
      paused = false;
      loop.start();
    },

    pause() {
      if (paused || phase === "over") return;
      paused = true;
      loop.stop();
    },

    resume() {
      if (!paused) return;
      paused = false;
      if (phase !== "over") loop.start();
    },

    restart() {
      paused = false;
      reset();
      for (let i = 0; i < 3; i++) spawnBug();
      phase = "run";
      loop.start();
    },

    destroy() {
      loop.stop();
      offPointer();
      hud.destroy();
      view.destroy();
      phase = "idle";
    },
  };
}

exports.createGame = createGame;
};
__defs["games/stack-tower/index.js"] = function (exports, __req) {
/**
 * stack-tower.js — Stack Tower.
 * Khối trượt ngang qua lại; Click / Space / chạm để thả. Phần lệch so với
 * khối bên dưới bị cắt bỏ. Không còn phần giao nhau → thua.
 * Điểm = số tầng xếp được. Thả trùng khớp hoàn hảo giữ nguyên độ rộng.
 */

const { createCanvas } = __req("core/canvas.js");
const { createLoop } = __req("core/loop.js");
const { createKeyboard, onPointerDown } = __req("core/input-manager.js");
const { createHud } = __req("core/hud.js");
const { lerp, randRange, formatScore, seededRand } = __req("core/utils.js");

const BH = 32;            // chiều cao mỗi tầng
const BASE_W = 230;       // độ rộng khối nền
const PERFECT_EPS = 6;    // sai số được tính là "hoàn hảo"
const MIN_OVERLAP = 3;    // giao nhau nhỏ hơn mức này coi như trượt
const MONO = '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace';

function createGame() {
  let opts = null;
  let view = null;
  let ctx = null;
  let W = 0;
  let H = 0;
  let keys = null;
  let offPointer = null;
  let hud = null;
  let loop = null;

  let phase = "idle"; // idle | run | die | over
  let paused = false;

  let blocks;    // các tầng đã đặt: {x, w, y(world), hue}
  let mover;     // khối đang trượt: {x, w, y, dir, speed, hue}
  let pieces;    // mảnh bị cắt đang rơi: {x, y, w, vy, vr, rot, hue}
  let particles;
  let texts;
  let floors;    // số tầng đã xếp = ĐIỂM
  let best;
  let cam;       // camera dịch dọc (screenY = worldY - cam)
  let dieT;
  let shakeT;
  let elapsed;
  let stars = [];

  const level = () => 1 + Math.floor(floors / 5);
  const moverSpeed = () => Math.min(480, 205 + floors * 9);
  const hueAt = (i) => (210 + i * 14) % 360;

  function buildStars() {
    const rand = seededRand(88);
    stars = [];
    for (let i = 0; i < 40; i++) {
      stars.push({
        x: rand() * W,
        y: rand() * H,
        r: 0.5 + rand() * 1.5,
        tw: rand() * Math.PI * 2,
      });
    }
  }

  /* ---------- Vòng đời ---------- */

  function reset() {
    const baseY = H - 92;
    blocks = [{ x: (W - BASE_W) / 2, w: BASE_W, y: baseY, hue: hueAt(0) }];
    pieces = [];
    particles = [];
    texts = [];
    floors = 0;
    best = opts.getBest();
    cam = 0;
    dieT = 0;
    shakeT = 0;
    elapsed = 0;
    spawnMover();
    hud.set("score", formatScore(floors));
    hud.set("best", formatScore(best));
    hud.set("level", String(level()).padStart(2, "0"));
  }

  function spawnMover() {
    const top = blocks[blocks.length - 1];
    const fromLeft = blocks.length % 2 === 1; // đổi hướng xuất phát mỗi tầng
    const w = top.w;
    mover = {
      w,
      y: top.y - BH,
      x: fromLeft ? 14 : W - 14 - w,
      dir: fromLeft ? 1 : -1,
      speed: moverSpeed(),
      hue: hueAt(blocks.length),
    };
  }

  function drop() {
    if (phase !== "run" || paused || !mover) return;

    const top = blocks[blocks.length - 1];
    const left = Math.max(mover.x, top.x);
    const right = Math.min(mover.x + mover.w, top.x + top.w);
    const overlap = right - left;

    if (overlap <= MIN_OVERLAP) {
      // Trượt hoàn toàn: cả khối rơi xuống → thua
      pieces.push({ x: mover.x, y: mover.y, w: mover.w, vy: 40, vr: mover.dir * 2.4, rot: 0, hue: mover.hue });
      mover = null;
      phase = "die";
      dieT = 0.85;
      if (!opts.reducedMotion) shakeT = 0.35;
      opts.audio.play("hit");
      return;
    }

    const offset = mover.x - top.x;
    if (Math.abs(offset) <= PERFECT_EPS) {
      // Hoàn hảo: khớp thẳng hàng, giữ nguyên độ rộng (thưởng nhẹ +4px, có trần)
      const w = Math.min(BASE_W, top.w + 4);
      blocks.push({ x: top.x + (top.w - w) / 2, w, y: mover.y, hue: mover.hue });
      opts.audio.play("perfect");
      texts.push({ x: W / 2, y: screenY(mover.y) - 26, txt: "PERFECT!", color: "#ffd23f", t: 0, big: true });
      sparkle(top.x + top.w / 2, mover.y + BH / 2);
    } else {
      // Cắt phần lệch: phần thừa rơi xuống
      blocks.push({ x: left, w: overlap, y: mover.y, hue: mover.hue });
      const cutW = mover.w - overlap;
      const cutX = offset > 0 ? right : mover.x;
      pieces.push({
        x: cutX,
        y: mover.y,
        w: cutW,
        vy: 30,
        vr: (offset > 0 ? 1 : -1) * randRange(1.5, 3),
        rot: 0,
        hue: mover.hue,
      });
      opts.audio.play("drop");
    }

    floors += 1;
    hud.set("score", formatScore(floors));
    hud.set("level", String(level()).padStart(2, "0"));
    if (floors > best) {
      best = floors;
      hud.set("best", formatScore(best));
    }
    if (floors % 5 === 0) {
      opts.audio.play("levelup");
      texts.push({ x: W / 2, y: screenY(mover.y) - 52, txt: `CẤP ${level()}`, color: "#b07bff", t: 0, big: true });
    }

    spawnMover();
  }

  function sparkle(x, y) {
    const count = opts.reducedMotion ? 6 : 14;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = randRange(40, 200);
      particles.push({
        x,
        y: screenY(y),
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 40,
        life: randRange(0.3, 0.55),
        t: 0,
        size: randRange(2, 4),
        color: Math.random() > 0.5 ? "#ffd23f" : "#fff3c4",
      });
    }
  }

  const screenY = (worldY) => worldY - cam;

  /* ---------- Cập nhật ---------- */

  function update(dt) {
    elapsed += dt;

    if (phase === "run" && mover) {
      // Khối trượt qua lại, chạm mép thì đổi hướng
      mover.x += mover.dir * mover.speed * dt;
      const minX = 14;
      const maxX = W - 14 - mover.w;
      if (mover.x <= minX) { mover.x = minX; mover.dir = 1; }
      if (mover.x >= maxX) { mover.x = maxX; mover.dir = -1; }
    }

    // Camera bám theo đỉnh tháp (giữ khối đang trượt ~y130 màn hình)
    const anchorY = mover ? mover.y : blocks[blocks.length - 1].y - BH;
    const camTarget = Math.min(0, anchorY - 130);
    cam = lerp(cam, camTarget, Math.min(1, dt * 6));

    // Mảnh cắt rơi tự do
    for (const piece of pieces) {
      piece.vy += 1500 * dt;
      piece.y += piece.vy * dt;
      piece.rot += piece.vr * dt;
    }
    pieces = pieces.filter((p) => screenY(p.y) < H + 80);

    if (phase === "die") {
      dieT -= dt;
      if (dieT <= 0) {
        phase = "over";
        loop.stop();
        render();
        opts.onGameOver(floors);
        return;
      }
    }

    for (const p of particles) {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 400 * dt;
    }
    particles = particles.filter((p) => p.t < p.life);

    for (const t of texts) t.t += dt;
    texts = texts.filter((t) => t.t < 0.9);

    shakeT = Math.max(0, shakeT - dt);

    render();
  }

  /* ---------- Vẽ ---------- */

  function drawBlockShape(x, y, w, hue, alpha = 1) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = `hsl(${hue} 82% 58%)`;
    ctx.fillRect(x, y, w, BH - 2);
    ctx.fillStyle = "rgba(255,255,255,.3)";
    ctx.fillRect(x, y, w, 5);
    ctx.fillStyle = "rgba(0,0,0,.28)";
    ctx.fillRect(x, y + BH - 8, w, 6);
    ctx.globalAlpha = 1;
  }

  function render() {
    ctx.save();
    if (shakeT > 0) {
      const power = shakeT * 14;
      ctx.translate(randRange(-power, power), randRange(-power, power));
    }

    // Nền tím đêm + sao
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#221046");
    bg.addColorStop(1, "#100b2c");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    for (const s of stars) {
      const a = 0.3 + 0.4 * (0.5 + 0.5 * Math.sin(elapsed * 1.6 + s.tw));
      ctx.fillStyle = `rgba(237,241,255,${a})`;
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }

    // Bệ đỡ dưới khối nền
    const base = blocks[0];
    const baseScreenY = screenY(base.y);
    ctx.fillStyle = "#0c081f";
    ctx.beginPath();
    ctx.moveTo(base.x - 30, baseScreenY + BH + 60);
    ctx.lineTo(base.x - 6, baseScreenY + BH - 2);
    ctx.lineTo(base.x + base.w + 6, baseScreenY + BH - 2);
    ctx.lineTo(base.x + base.w + 30, baseScreenY + BH + 60);
    ctx.closePath();
    ctx.fill();

    // Các tầng đã đặt (chỉ vẽ phần trong khung hình)
    for (const b of blocks) {
      const sy = screenY(b.y);
      if (sy < -BH || sy > H + BH) continue;
      drawBlockShape(b.x, sy, b.w, b.hue);
    }

    // Mảnh cắt đang rơi
    for (const piece of pieces) {
      ctx.save();
      ctx.translate(piece.x + piece.w / 2, screenY(piece.y) + BH / 2);
      ctx.rotate(piece.rot);
      drawBlockShape(-piece.w / 2, -BH / 2, piece.w, piece.hue, 0.9);
      ctx.restore();
    }

    // Khối đang trượt + đường gióng mép khối dưới
    if (mover && phase === "run") {
      const top = blocks[blocks.length - 1];
      const guideTop = screenY(mover.y) + BH;
      const guideBottom = screenY(top.y);
      ctx.strokeStyle = "rgba(176,123,255,.4)";
      ctx.setLineDash([4, 6]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(top.x, guideTop);
      ctx.lineTo(top.x, guideBottom);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(top.x + top.w, guideTop);
      ctx.lineTo(top.x + top.w, guideBottom);
      ctx.stroke();
      ctx.setLineDash([]);
      drawBlockShape(mover.x, screenY(mover.y), mover.w, mover.hue);
    }

    // Hạt lấp lánh
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // Chữ nổi
    ctx.textAlign = "center";
    for (const t of texts) {
      ctx.globalAlpha = Math.max(0, 1 - t.t / 0.9);
      ctx.font = t.big ? `800 20px ${MONO}` : `700 14px ${MONO}`;
      ctx.fillStyle = t.color;
      ctx.fillText(t.txt, t.x, t.y - t.t * 34);
    }
    ctx.globalAlpha = 1;

    // Gợi ý khi chưa thả khối nào
    if (floors === 0 && phase === "run") {
      const blink = 0.55 + 0.45 * Math.sin(elapsed * 4);
      ctx.font = `700 14px ${MONO}`;
      ctx.textAlign = "center";
      ctx.fillStyle = `rgba(176,123,255,${blink})`;
      ctx.fillText("Nhấn / Space để thả khối", W / 2, H - 26);
    }

    ctx.restore();
  }

  /* ---------- Interface vòng đời chuẩn ---------- */

  return {
    mount(container, options) {
      opts = options;
      W = 560;
      H = 640;

      view = createCanvas(container, { width: W, height: H });
      ctx = view.ctx;

      hud = createHud(options.hudRoot);
      hud.addStat({ id: "score", label: "Điểm (tầng)", accent: "violet" });
      hud.addStat({ id: "best", label: "Kỷ lục", accent: "pink", small: true });
      hud.addStat({ id: "level", label: "Cấp", accent: "cyan", small: true, value: "01" });

      keys = createKeyboard();
      keys.on(["Space"], drop);
      offPointer = onPointerDown(view.canvas, drop);

      loop = createLoop(update);
      buildStars();
      reset();
      render();
    },

    start() {
      if (phase === "run") return;
      reset();
      phase = "run";
      paused = false;
      loop.start();
    },

    pause() {
      if (paused || phase === "over") return;
      paused = true;
      loop.stop();
    },

    resume() {
      if (!paused) return;
      paused = false;
      if (phase !== "over") loop.start();
    },

    restart() {
      paused = false;
      reset();
      phase = "run";
      loop.start();
    },

    destroy() {
      loop.stop();
      keys.destroy();
      offPointer();
      hud.destroy();
      view.destroy();
      phase = "idle";
    },
  };
}

exports.createGame = createGame;
};
__defs["games/snake/index.js"] = function (exports, __req) {
/**
 * snake.js — Snake.
 * Điều khiển bằng mũi tên / WASD, vuốt hoặc d-pad trên cảm ứng.
 * Ăn táo để dài ra (+10đ × cấp); mỗi 5 quả lên cấp và tăng tốc.
 * Đâm tường hoặc tự cắn thân → kết thúc. Không cho đảo ngược hướng.
 */

const { createCanvas } = __req("core/canvas.js");
const { createLoop } = __req("core/loop.js");
const { createKeyboard, onSwipe } = __req("core/input-manager.js");
const { createHud } = __req("core/hud.js");
const { formatScore, svgIcon } = __req("core/utils.js");

const COLS = 21;
const ROWS = 21;
const CELL = 26;
const PAD = 12;
const BASE_INTERVAL = 0.155; // giây mỗi bước ở cấp 1
const MONO = '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace';

const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

function createGame() {
  let opts = null;
  let view = null;
  let ctx = null;
  let W = 0;
  let H = 0;
  let keys = null;
  let offSwipe = null;
  let dpadCleanups = [];
  let hud = null;
  let loop = null;

  let phase = "idle"; // idle | run | die | over
  let paused = false;

  let snake;    // mảng ô, phần tử 0 là ĐUÔI, cuối là ĐẦU
  let dir;      // hướng hiện tại
  let pending;  // hàng đợi hướng người chơi vừa bấm
  let food;
  let eaten;
  let score;
  let best;
  let acc;      // tích lũy thời gian cho bước di chuyển
  let dieT;
  let elapsed;
  let eatFlash; // vị trí vừa ăn để vẽ hiệu ứng
  let texts;

  const levelOf = (n) => Math.min(10, 1 + Math.floor(n / 5));
  const level = () => levelOf(eaten);
  const stepInterval = () => Math.max(0.075, BASE_INTERVAL - (level() - 1) * 0.011);

  /* ---------- Vòng đời ---------- */

  function reset() {
    snake = [
      { x: 4, y: 10 },
      { x: 5, y: 10 },
      { x: 6, y: 10 },
      { x: 7, y: 10 },
    ];
    dir = DIRS.right;
    pending = [];
    eaten = 0;
    score = 0;
    best = opts.getBest();
    acc = 0;
    dieT = 0;
    elapsed = 0;
    eatFlash = null;
    texts = [];
    spawnFood();
    hud.set("score", formatScore(0));
    hud.set("best", formatScore(best));
    hud.set("level", String(level()).padStart(2, "0"));
  }

  function spawnFood() {
    // Gom danh sách ô trống rồi chọn ngẫu nhiên — không bao giờ kẹt vô hạn
    const occupied = new Set(snake.map((c) => c.y * COLS + c.x));
    const free = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!occupied.has(y * COLS + x)) free.push({ x, y });
      }
    }
    if (free.length === 0) {
      food = null; // rắn phủ kín bàn — thắng tuyệt đối, kết thúc lượt
      finish();
      return;
    }
    food = free[Math.floor(Math.random() * free.length)];
    food.pulse = 0;
  }

  function queueDir(name) {
    if (phase !== "run" || paused) return;
    const next = DIRS[name];
    if (!next) return;
    // Giữ tối đa 2 lệnh chờ để rắn phản hồi nhạy mà không loạn
    if (pending.length < 2) pending.push(next);
  }

  function finish() {
    phase = "die";
    dieT = 0.55;
    opts.audio.play("hit");
  }

  /* ---------- Cập nhật ---------- */

  function step() {
    // Lấy lệnh hợp lệ đầu tiên (bỏ lệnh đảo ngược 180° so với hướng hiện tại)
    while (pending.length > 0) {
      const next = pending.shift();
      if (next.x === -dir.x && next.y === -dir.y) continue;
      if (next.x === dir.x && next.y === dir.y) continue;
      dir = next;
      break;
    }

    const head = snake[snake.length - 1];
    const nx = head.x + dir.x;
    const ny = head.y + dir.y;

    // Va tường
    if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) {
      finish();
      return;
    }

    const willEat = food && nx === food.x && ny === food.y;

    // Va thân (đuôi sẽ rời đi trong bước này nên không tính, trừ khi đang ăn)
    const start = willEat ? 0 : 1;
    for (let i = start; i < snake.length; i++) {
      if (snake[i].x === nx && snake[i].y === ny) {
        finish();
        return;
      }
    }

    snake.push({ x: nx, y: ny });

    if (willEat) {
      const prevLevel = level();
      eaten += 1;
      score += 10 * prevLevel;
      eatFlash = { x: nx, y: ny, t: 0 };
      opts.audio.play("eat");
      texts.push({
        x: PAD + nx * CELL + CELL / 2,
        y: PAD + ny * CELL,
        txt: `+${10 * prevLevel}`,
        color: "#4bf584",
        t: 0,
      });
      hud.set("score", formatScore(score));
      if (score > best) {
        best = score;
        hud.set("best", formatScore(best));
      }
      if (level() !== prevLevel) {
        opts.audio.play("levelup");
        hud.set("level", String(level()).padStart(2, "0"));
        texts.push({ x: W / 2, y: H / 2 - 20, txt: `CẤP ${level()}`, color: "#4bf584", t: 0, big: true });
      }
      spawnFood();
    } else {
      snake.shift(); // không ăn thì đuôi tiến lên
    }
  }

  function update(dt) {
    elapsed += dt;

    if (phase === "run") {
      acc += dt;
      const interval = stepInterval();
      while (acc >= interval && phase === "run") {
        acc -= interval;
        step();
      }
      if (food) food.pulse += dt;
    }

    if (phase === "die") {
      dieT -= dt;
      if (dieT <= 0) {
        phase = "over";
        loop.stop();
        render();
        opts.onGameOver(score);
        return;
      }
    }

    if (eatFlash) {
      eatFlash.t += dt;
      if (eatFlash.t > 0.3) eatFlash = null;
    }

    for (const t of texts) t.t += dt;
    texts = texts.filter((t) => t.t < 0.8);

    render();
  }

  /* ---------- Vẽ ---------- */

  const cellX = (gx) => PAD + gx * CELL;
  const cellY = (gy) => PAD + gy * CELL;

  function render() {
    // Nền + lưới
    ctx.fillStyle = "#07130b";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(75,245,132,.07)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(cellX(x), PAD);
      ctx.lineTo(cellX(x), H - PAD);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(PAD, cellY(y));
      ctx.lineTo(W - PAD, cellY(y));
      ctx.stroke();
    }
    // Viền bàn chơi
    ctx.strokeStyle = "rgba(75,245,132,.35)";
    ctx.lineWidth = 2;
    ctx.strokeRect(PAD - 3, PAD - 3, COLS * CELL + 6, ROWS * CELL + 6);

    // Táo (nhấp nháy theo nhịp)
    if (food) {
      const pulse = 1 + Math.sin(food.pulse * 5) * 0.1;
      const fx = cellX(food.x) + CELL / 2;
      const fy = cellY(food.y) + CELL / 2 + 1;
      ctx.fillStyle = "#ff5d6b";
      ctx.beginPath();
      ctx.arc(fx, fy, CELL * 0.36 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#4bf584";
      ctx.fillRect(fx - 1.5, fy - CELL * 0.48, 3, 6);
      ctx.fillStyle = "rgba(255,255,255,.55)";
      ctx.beginPath();
      ctx.arc(fx - 3, fy - 3, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Thân rắn: sáng dần từ đuôi lên đầu; nhấp nháy đỏ khi chết
    const dying = phase === "die" && Math.floor(dieT * 12) % 2 === 0;
    snake.forEach((cell, i) => {
      const bright = 0.4 + (i / snake.length) * 0.6;
      ctx.fillStyle = dying
        ? `rgba(255,93,107,${bright})`
        : `rgba(75,245,132,${bright.toFixed(2)})`;
      ctx.beginPath();
      ctx.roundRect(cellX(cell.x) + 2, cellY(cell.y) + 2, CELL - 4, CELL - 4, 6);
      ctx.fill();
    });

    // Đầu rắn + mắt hướng theo chiều di chuyển
    const head = snake[snake.length - 1];
    const hx = cellX(head.x);
    const hy = cellY(head.y);
    ctx.fillStyle = dying ? "#ffb3ba" : "#b9ffcb";
    ctx.beginPath();
    ctx.roundRect(hx + 1, hy + 1, CELL - 2, CELL - 2, 7);
    ctx.fill();
    ctx.fillStyle = "#061018";
    const ex = dir.x;
    const ey = dir.y;
    // Hai mắt đặt vuông góc với hướng đi
    const px = -ey;
    const py = ex;
    const c = CELL / 2;
    const eyeOff = 5.5;
    const fwd = 4;
    ctx.fillRect(hx + c + ex * fwd + px * eyeOff - 2, hy + c + ey * fwd + py * eyeOff - 2, 4, 4);
    ctx.fillRect(hx + c + ex * fwd - px * eyeOff - 2, hy + c + ey * fwd - py * eyeOff - 2, 4, 4);

    // Hiệu ứng vừa ăn
    if (eatFlash) {
      const k = eatFlash.t / 0.3;
      ctx.strokeStyle = `rgba(75,245,132,${0.7 * (1 - k)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cellX(eatFlash.x) + CELL / 2, cellY(eatFlash.y) + CELL / 2, 8 + k * 20, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Chữ nổi
    ctx.textAlign = "center";
    for (const t of texts) {
      ctx.globalAlpha = Math.max(0, 1 - t.t / 0.8);
      ctx.font = t.big ? `800 22px ${MONO}` : `700 14px ${MONO}`;
      ctx.fillStyle = t.color;
      ctx.fillText(t.txt, t.x, t.y - t.t * 36);
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- D-pad cảm ứng ---------- */

  function buildDpad(hudRoot) {
    const dpad = document.createElement("div");
    dpad.className = "dpad";
    dpad.setAttribute("aria-label", "Điều khiển cảm ứng");
    const defs = [
      ["up", "Lên", "dpad-up"],
      ["left", "Trái", "dpad-left"],
      ["right", "Phải", "dpad-right"],
      ["down", "Xuống", "dpad-down"],
    ];
    for (const [name, label, cls] of defs) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `dpad-btn ${cls}`;
      btn.setAttribute("aria-label", label);
      btn.appendChild(svgIcon("i-arrow"));
      const handler = (e) => {
        e.preventDefault();
        queueDir(name);
      };
      btn.addEventListener("pointerdown", handler);
      dpadCleanups.push(() => btn.removeEventListener("pointerdown", handler));
      dpad.appendChild(btn);
    }
    hudRoot.appendChild(dpad);
  }

  /* ---------- Interface vòng đời chuẩn ---------- */

  return {
    mount(container, options) {
      opts = options;
      W = COLS * CELL + PAD * 2;
      H = ROWS * CELL + PAD * 2;

      view = createCanvas(container, { width: W, height: H });
      ctx = view.ctx;

      hud = createHud(options.hudRoot);
      hud.addStat({ id: "score", label: "Điểm", accent: "green" });
      hud.addStat({ id: "best", label: "Kỷ lục", accent: "cyan", small: true });
      hud.addStat({ id: "level", label: "Cấp", accent: "gold", small: true, value: "01" });
      buildDpad(hud.root);

      keys = createKeyboard();
      keys.on(["ArrowUp", "KeyW"], () => queueDir("up"));
      keys.on(["ArrowDown", "KeyS"], () => queueDir("down"));
      keys.on(["ArrowLeft", "KeyA"], () => queueDir("left"));
      keys.on(["ArrowRight", "KeyD"], () => queueDir("right"));
      offSwipe = onSwipe(view.canvas, queueDir);

      loop = createLoop(update);
      reset();
      render();
    },

    start() {
      if (phase === "run") return;
      reset();
      phase = "run";
      paused = false;
      loop.start();
    },

    pause() {
      if (paused || phase === "over") return;
      paused = true;
      loop.stop();
    },

    resume() {
      if (!paused) return;
      paused = false;
      if (phase !== "over") loop.start();
    },

    restart() {
      paused = false;
      reset();
      phase = "run";
      loop.start();
    },

    destroy() {
      loop.stop();
      keys.destroy();
      offSwipe();
      for (const cleanup of dpadCleanups) cleanup();
      dpadCleanups = [];
      hud.destroy();
      view.destroy();
      phase = "idle";
    },
  };
}

exports.createGame = createGame;
};
__defs["games/strike/index.js"] = function (exports, __req) {
/**
 * 404 Strike — mini FPS 3D (desktop-first).
 *
 * MVP theo plan: map digital-industrial nguyên bản (Level Map), góc nhìn
 * thứ nhất, WASD + mouse look + Pointer Lock, click trái bắn / phải ngắm,
 * R thay đạn, Space nhảy, Shift chạy, Esc tạm dừng. Một khẩu rifle hư cấu
 * 30/120, raycasting, hitbox đầu/thân, bot theo wave với state machine,
 * trận 90 giây, HP/ammo/timer/wave/score/combo/high-score.
 * Mobile hiển thị "Tối ưu cho máy tính"; WebGL lỗi có fallback.
 *
 * Màn hình chờ: cảnh 3D live với bot tuần tra + camera bay quanh map
 * (không dùng ảnh tĩnh — toàn bộ dựng bằng WebGL).
 */

const { createEngine, dirFromYawPitch, rayAABB } = __req("games/strike/engine.js");
const { createWorld } = __req("games/strike/world.js");
const { createPlayer } = __req("games/strike/player.js");
const { createWeapon } = __req("games/strike/weapon.js");
const { createBots } = __req("games/strike/bots.js");
const { createFx } = __req("games/strike/fx.js");
const { createPickups } = __req("games/strike/pickups.js");
const { createStrikeHud } = __req("games/strike/hud.js");
const { createScreens } = __req("games/strike/screens.js");
const { STRIKE_CSS } = __req("games/strike/styles.js");
const { createKeyboard } = __req("core/input-manager.js");

const SETTINGS_KEY = "strike-settings";
const QUALITY_SCALE = { low: 0.62, medium: 0.82, high: 1 };

function createGame() {
  let ctx = null;
  let wrap = null;
  let canvas = null;
  let engine = null;
  let world = null;
  let fx = null;
  let bots = null;
  let weapon = null;
  let player = null;
  let pickups = null;
  let hud = null;
  let screens = null;
  let keys = null;
  let ro = null;

  let destroyed = false;
  let rafId = 0;
  let lastT = 0;

  // idle (màn hình chờ) | match | paused | over | blocked
  let mode = "blocked";
  let paused = false;

  let locked = false;
  let lockHintAt = 0; // chống spam toast "nhấp để khóa chuột"

  let firing = false;
  let adsHeld = false;
  let lookDx = 0;
  let lookDy = 0;

  const TEST = typeof window !== "undefined" && window.__ARCADE_STRIKE_TEST__;
  const MATCH_TIME = TEST ? 12 : 90;

  const settings = {
    difficulty: "normal",
    quality: "auto",
    volume: 80,
    sensitivity: 60,
    shake: true,
  };
  let autoScale = 0.82; // scale hiện tại khi quality = auto
  let fpsAccum = 0;
  let fpsFrames = 0;
  let fpsTimer = 0;

  // Trạng thái trận
  let matchTime = MATCH_TIME;
  let wave = 0;
  let waveElapsed = 0;
  let score = 0;
  let combo = 0;
  let comboT = 0;
  let kills = 0;
  let headshots = 0;
  let shots = 0;
  let hits = 0;
  let recentFire = 0;
  let spawnQueue = [];
  let idleAngle = 0;

  /* ================= Cài đặt ================= */

  function loadSettings() {
    const saved = ctx.storage.getPref(SETTINGS_KEY, null);
    if (saved && typeof saved === "object") Object.assign(settings, saved);
    if (ctx.config?.quality && ctx.config.quality !== "auto" && !saved?.quality) {
      settings.quality = ctx.config.quality;
    }
    ctx.audio.setVolume(settings.volume / 100);
  }

  function persistSettings() {
    ctx.storage.setPref(SETTINGS_KEY, { ...settings });
  }

  function currentScale() {
    if (settings.quality === "auto") return autoScale;
    return QUALITY_SCALE[settings.quality] ?? 0.82;
  }

  function applyQuality() {
    if (!engine || !wrap) return;
    engine.resize(wrap.clientWidth, wrap.clientHeight, currentScale());
  }

  function applySettings(partial) {
    if (partial.volume !== undefined) ctx.audio.setVolume(partial.volume / 100);
    if (partial.quality !== undefined) applyQuality();
    persistSettings();
  }

  /* ================= Pointer lock ================= */

  /**
   * Yêu cầu khóa chuột. KHÔNG latch trạng thái thất bại: Chrome có
   * cooldown ~1,3s sau khi người chơi thoát lock bằng Esc, nên yêu cầu
   * ngay sau đó (bấm "Tiếp tục") có thể bị từ chối. Khi đó game vẫn chạy
   * với mouse-look thường và tự khóa lại ở cú click kế tiếp trên canvas.
   */
  function requestLock() {
    if (locked || !canvas || destroyed) return;
    const onRejected = () => {
      if (mode !== "match" || paused || destroyed) return;
      const now = performance.now();
      if (now - lockHintAt > 2500) {
        lockHintAt = now;
        hud?.toast("NHẤP VÀO MÀN HÌNH ĐỂ KHÓA TÂM NGẮM");
      }
    };
    try {
      const p = canvas.requestPointerLock();
      if (p && typeof p.catch === "function") p.catch(onRejected);
    } catch {
      onRejected();
    }
  }

  function exitLock() {
    if (document.pointerLockElement) {
      try {
        document.exitPointerLock();
      } catch {
        /* bỏ qua */
      }
    }
  }

  /* ================= Wave & spawn ================= */

  function startNextWave() {
    wave += 1;
    waveElapsed = 0;
    hud.setWave(wave);
    hud.waveBanner(wave);
    ctx.audio.play("wave");
    const count = Math.min(3 + wave, 8);
    const gates = [...world.botGates].sort(() => Math.random() - 0.5);
    spawnQueue = [];
    for (let i = 0; i < count; i++) {
      const gate = gates[i % gates.length];
      spawnQueue.push({
        delay: TEST ? i * 0.15 : 0.4 + i * 0.55,
        gate,
        loop: wave >= 2 && i % 3 === 2 ? "court" : gate.loop,
      });
    }
  }

  function processSpawns(dt) {
    for (const q of spawnQueue) q.delay -= dt;
    while (spawnQueue.length && spawnQueue[0].delay <= 0) {
      const q = spawnQueue.shift();
      bots.spawn(q.gate, settings.difficulty, q.loop);
    }
  }

  /* ================= Bắn ================= */

  function fireOnce() {
    const shot = weapon.tryFire();
    if (!shot) return;
    shots += 1;
    recentFire = Math.min(1, recentFire + 0.34);
    player.addRecoil(shot.recoil);

    const cam = engine.camera;
    const origin = [cam.pos[0], cam.pos[1], cam.pos[2]];
    const dir = dirFromYawPitch(cam.yaw, cam.pitch);
    // Tản đạn
    dir[0] += (Math.random() - 0.5) * shot.spread * 2;
    dir[1] += (Math.random() - 0.5) * shot.spread * 2;
    dir[2] += (Math.random() - 0.5) * shot.spread * 2;
    const len = Math.hypot(...dir);
    dir[0] /= len; dir[1] /= len; dir[2] /= len;

    // Chạm tường/vật cản gần nhất
    let tWorld = null;
    for (const c of world.colliders) {
      const t = rayAABB(origin, dir, c);
      if (t !== null && (tWorld === null || t < tWorld)) tWorld = t;
    }

    const hitBot = bots.raycast(origin, dir);
    let endPoint;

    if (hitBot && (tWorld === null || hitBot.t < tWorld) && hitBot.t < 90) {
      hits += 1;
      endPoint = [
        origin[0] + dir[0] * hitBot.t,
        origin[1] + dir[1] * hitBot.t,
        origin[2] + dir[2] * hitBot.t,
      ];
      const dmg = hitBot.isHead ? 50 : 22;
      hud.hitmarker(hitBot.isHead);
      ctx.audio.play(hitBot.isHead ? "headshot" : "hitmark");
      fx.burst(endPoint, hitBot.isHead ? "#ffd23f" : "#9a5cff", 6);
      bots.damage(hitBot.bot, dmg, hitBot.isHead);
    } else if (tWorld !== null) {
      endPoint = [
        origin[0] + dir[0] * tWorld,
        origin[1] + dir[1] * tWorld,
        origin[2] + dir[2] * tWorld,
      ];
      fx.burst(endPoint, "#20e3ff", 4);
    } else {
      endPoint = [origin[0] + dir[0] * 70, origin[1] + dir[1] * 70, origin[2] + dir[2] * 70];
    }

    // Tracer xuất phát từ đầu nòng (lệch phải-dưới tâm nhìn)
    const right = [Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)];
    const muzzle = [
      origin[0] + dir[0] * 0.55 + right[0] * 0.2 * (1 - weapon.adsBlend),
      origin[1] + dir[1] * 0.55 - 0.14 * (1 - weapon.adsBlend),
      origin[2] + dir[2] * 0.55 + right[2] * 0.2 * (1 - weapon.adsBlend),
    ];
    fx.tracer(muzzle, endPoint, "#ffe9b0");

    // Tiếng súng khiến bot gần đó lao tới
    bots.aggro(player.pos, 26);
  }

  function onBotKilled(bot, isHead) {
    kills += 1;
    if (isHead) {
      headshots += 1;
      hud.showHeadshot();
    }
    combo = comboT > 0 ? combo + 1 : 1;
    comboT = 4;
    const mult = Math.min(3, 1 + (combo - 1) * 0.25);
    const base = isHead ? 150 : 100;
    score += Math.round((base * mult) / 10) * 10;
    hud.setScore(score);
    hud.setCombo(combo);
  }

  function onPlayerHit(dmg, fromPos) {
    if (mode !== "match" || paused) return;
    player.hp -= dmg;
    hud.setHp(player.hp);
    hud.damageFlash();
    if (settings.shake) player.shake(0.8);
    ctx.audio.play("hurt");
    void fromPos;
    if (player.hp <= 0) endMatch();
  }

  /* ================= Vòng trận ================= */

  function startMatch() {
    if (!engine) return;
    mode = "match";
    paused = false;
    firing = false;
    adsHeld = false;

    matchTime = MATCH_TIME;
    wave = 0;
    score = 0;
    combo = 0;
    comboT = 0;
    kills = 0;
    headshots = 0;
    shots = 0;
    hits = 0;
    spawnQueue = [];

    bots.clearAll();
    pickups.reset();
    player.reset(world.playerSpawn);
    weapon.reset();

    screens.hideAll();
    hud.show(true);
    hud.dim(false);
    hud.setScore(0);
    hud.setCombo(0);
    hud.setHp(100);
    hud.setTime(matchTime);
    hud.setAmmo(weapon.mag, weapon.reserve);

    startNextWave();
    requestLock();
    ctx.onMatchStart?.();
  }

  function pauseMatch() {
    if (mode !== "match" || paused) return;
    paused = true;
    firing = false;
    adsHeld = false;
    exitLock();
    hud.dim(true);
    screens.showPause();
  }

  function resumeMatch() {
    if (mode !== "match" || !paused) return;
    paused = false;
    keys.clearDown();
    screens.hideAll();
    hud.dim(false);
    requestLock();
  }

  function endMatch() {
    if (mode !== "match") return;
    mode = "over";
    paused = false;
    firing = false;
    exitLock();
    hud.dim(true);

    const accuracy = shots > 0 ? Math.round((hits / shots) * 100) : 0;
    const saved = ctx.onGameOver(score, { kills, headshots, wave });
    screens.showOver({ score, saved, kills, headshots, accuracy, wave });
  }

  /* ================= Vòng lặp chính ================= */

  function frame(t) {
    if (destroyed) return;
    rafId = requestAnimationFrame(frame);
    const dt = Math.min((t - lastT) / 1000, 0.05);
    lastT = t;

    world.update(dt);
    fx.update(dt);

    const cam = engine.camera;

    if (mode === "idle") {
      // Camera bay chậm quanh sân — nền sống cho start screen
      idleAngle += dt * 0.07;
      const r = 16.5;
      cam.pos[0] = Math.sin(idleAngle) * r;
      cam.pos[1] = 4.8;
      cam.pos[2] = Math.cos(idleAngle) * r;
      cam.yaw = Math.atan2(cam.pos[0], cam.pos[2]);
      cam.pitch = -0.18;
      cam.fov = 70;
      bots.update(dt, null, { camX: cam.pos[0], camZ: cam.pos[2] });
    } else if (mode === "match" && !paused) {
      matchTime -= dt;
      waveElapsed += dt;
      hud.setTime(matchTime);
      if (matchTime <= 0) {
        hud.setTime(0);
        endMatch();
        return;
      }

      // Input di chuyển
      const forward = (keys.isDown("KeyW") || keys.isDown("ArrowUp") ? 1 : 0) - (keys.isDown("KeyS") || keys.isDown("ArrowDown") ? 1 : 0);
      const strafe = (keys.isDown("KeyD") || keys.isDown("ArrowRight") ? 1 : 0) - (keys.isDown("KeyA") || keys.isDown("ArrowLeft") ? 1 : 0);
      const run = keys.isDown("ShiftLeft") || keys.isDown("ShiftRight");
      const pState = player.update(dt, { forward, strafe, run });

      // Súng + FOV ngắm
      weapon.update(dt, {
        adsHeld,
        moveSpeed: pState.moveSpeed,
        lookDx,
        lookDy,
        reducedMotion: ctx.reducedMotion,
      });
      const fovTarget = adsHeld && !weapon.reloading ? 56 : 75;
      cam.fov += (fovTarget - cam.fov) * Math.min(1, dt * 10);

      if (firing) fireOnce();
      recentFire = Math.max(0, recentFire - dt * 1.6);

      // Bot + vật phẩm
      const playerState = {
        eye: player.eye(),
        pos: [player.pos[0], player.pos[1], player.pos[2]],
        speed: pState.moveSpeed,
      };
      bots.update(dt, playerState, { camX: cam.pos[0], camZ: cam.pos[2] });
      const picked = pickups.update(dt, player.pos);
      for (const type of picked) {
        if (type === "health") {
          player.hp = Math.min(100, player.hp + 30);
          hud.setHp(player.hp);
          hud.toast("+30 HP");
        } else {
          weapon.addReserve(60);
          hud.toast("+60 ĐẠN");
        }
      }

      // Wave kế tiếp khi dọn sạch hoặc quá lâu
      if (spawnQueue.length === 0 && (bots.aliveCount() === 0 || waveElapsed > (TEST ? 4 : 25))) {
        startNextWave();
      }
      processSpawns(dt);

      // Combo hết hạn
      if (comboT > 0) {
        comboT -= dt;
        if (comboT <= 0) {
          combo = 0;
          hud.setCombo(0);
        }
      }

      // Tâm ngắm mở rộng khi chạy/bắn, khép khi ngắm
      const spread = adsHeld ? 1 : 5 + pState.moveSpeed * 1.1 + recentFire * 9;
      hud.setCrosshair(spread, !(adsHeld && !weapon.reloading));
      hud.setAmmo(weapon.mag, weapon.reserve);

      // Quality auto: đo fps và hạ/tăng scale
      if (settings.quality === "auto") {
        fpsAccum += dt;
        fpsFrames += 1;
        fpsTimer += dt;
        if (fpsTimer > 2.4) {
          const fps = fpsFrames / fpsAccum;
          if (fps < 46 && autoScale > 0.62) {
            autoScale = Math.max(0.62, autoScale - 0.2);
            applyQuality();
          } else if (fps > 70 && autoScale < 1) {
            autoScale = Math.min(1, autoScale + 0.18);
            applyQuality();
          }
          fpsAccum = 0;
          fpsFrames = 0;
          fpsTimer = 0;
        }
      }
    }

    lookDx = 0;
    lookDy = 0;

    engine.render(world.root, mode === "match" ? weapon.viewmodel : null);
  }

  /* ================= Interface vòng đời ================= */

  return {
    async mount(container, context) {
      ctx = context;
      const shadowRoot = container.getRootNode();

      // CSS của Strike chỉ inject khi game được mount (lazy)
      if (shadowRoot instanceof ShadowRoot && !shadowRoot.querySelector("#strike-style")) {
        const style = document.createElement("style");
        style.id = "strike-style";
        style.textContent = STRIKE_CSS;
        shadowRoot.appendChild(style);
      }

      wrap = document.createElement("div");
      wrap.className = "sk-root";
      container.appendChild(wrap);

      loadSettings();

      const actions = {
        enterMatch: () => startMatch(),
        resume: () => resumeMatch(),
        restart: () => startMatch(),
        switchGame: () => ctx.requestSwitch(),
        goHome: () => ctx.requestHome(),
        applySettings: (partial) => applySettings(partial),
      };

      screens = createScreens(wrap, { settings, actions });

      // Mobile: theo plan, hiển thị nhãn tối ưu desktop
      const isCoarse = window.matchMedia("(pointer: coarse)").matches;
      const isSmall = Math.min(window.innerWidth, window.innerHeight) < 620;
      if (isCoarse && isSmall) {
        mode = "blocked";
        screens.showNotice("mobile");
        return;
      }

      canvas = document.createElement("canvas");
      canvas.className = "sk-canvas";
      wrap.insertBefore(canvas, wrap.firstChild);

      try {
        engine = createEngine(canvas, { fogNear: 26, fogFar: 74 });
      } catch {
        engine = null;
      }
      if (!engine) {
        mode = "blocked";
        canvas.remove();
        screens.showNotice("webgl");
        ctx.audio.play("bad");
        return;
      }

      world = createWorld(engine);
      fx = createFx(world.root, { reducedMotion: ctx.reducedMotion });
      bots = createBots(world.root, world, ctx.audio, fx, {
        onPlayerHit,
        onKilled: onBotKilled,
        reducedMotion: ctx.reducedMotion,
      });
      player = createPlayer(world, engine.camera, { reducedMotion: ctx.reducedMotion });
      weapon = createWeapon(engine, ctx.audio);
      pickups = createPickups(world.root, world, ctx.audio, fx);
      hud = createStrikeHud(wrap, {
        onPause: () => pauseMatch(),
        onToggleSound: () => ctx.audio.setEnabled(!ctx.audio.enabled),
        soundOn: () => ctx.audio.enabled,
      });
      weapon.onAmmoChange = (mag, reserve) => hud.setAmmo(mag, reserve);

      /* ----- Input ----- */
      keys = createKeyboard({ signal: ctx.signal });
      keys.on(["KeyR"], () => {
        if (mode === "match" && !paused) weapon.startReload();
      });
      keys.on(["Space"], () => {
        if (mode === "match" && !paused) player.queueJump();
      });
      keys.on(["KeyP"], () => {
        if (mode !== "match") return;
        if (paused) resumeMatch();
        else pauseMatch();
      });

      const sig = { signal: ctx.signal };

      // Esc: khi có pointer lock, trình duyệt tự nhả lock → pointerlockchange
      // xử lý pause. Khi KHÔNG có lock (fallback), bắt Escape thủ công.
      window.addEventListener(
        "keydown",
        (e) => {
          if (e.code !== "Escape" || mode !== "match") return;
          if (!locked) {
            e.preventDefault();
            if (paused) resumeMatch();
            else pauseMatch();
          }
        },
        sig
      );

      document.addEventListener(
        "pointerlockchange",
        () => {
          locked = document.pointerLockElement === canvas;
          if (!locked && mode === "match" && !paused) pauseMatch();
        },
        sig
      );

      // Một số trường hợp lock thất bại chỉ phát pointerlockerror
      // (không reject promise) — vẫn phải gợi ý người chơi click lại.
      document.addEventListener(
        "pointerlockerror",
        () => {
          locked = false;
          if (mode === "match" && !paused) {
            const now = performance.now();
            if (now - lockHintAt > 2500) {
              lockHintAt = now;
              hud?.toast("NHẤP VÀO MÀN HÌNH ĐỂ KHÓA TÂM NGẮM");
            }
          }
        },
        sig
      );

      canvas.addEventListener(
        "pointerdown",
        (e) => {
          if (mode !== "match" || paused) return;
          e.preventDefault();
          if (e.button === 0) {
            // Cú click là user-gesture mới → luôn thử khóa lại nếu đang mất lock
            if (!locked) requestLock();
            firing = true;
          } else if (e.button === 2) {
            adsHeld = true;
          }
        },
        sig
      );

      window.addEventListener(
        "pointerup",
        (e) => {
          if (e.button === 0) firing = false;
          if (e.button === 2) adsHeld = false;
        },
        sig
      );

      wrap.addEventListener("contextmenu", (e) => e.preventDefault(), sig);

      window.addEventListener(
        "pointermove",
        (e) => {
          if (mode !== "match" || paused) return;
          // Có lock: movementX/Y là delta chuẩn FPS. Mất lock (cooldown
          // sau Esc, môi trường không hỗ trợ): vẫn quan sát được bằng
          // chuột thường — game không bao giờ "đơ" vì thiếu pointer lock.
          const dx = e.movementX || 0;
          const dy = e.movementY || 0;
          player.look(dx, dy, settings.sensitivity / 50);
          lookDx += dx;
          lookDy += dy;
        },
        sig
      );

      /* ----- Kích thước ----- */
      ro = new ResizeObserver(() => {
        if (wrap.clientWidth > 0) applyQuality();
      });
      ro.observe(wrap);
      applyQuality();

      /* ----- Màn hình chờ: cảnh live + 3 bot tuần tra ----- */
      mode = "idle";
      bots.spawn(world.botGates[1], "normal", "left");
      bots.spawn(world.botGates[5], "normal", "right");
      bots.spawn(world.botGates[2], "normal", "court");
      screens.showStart();

      lastT = performance.now();
      rafId = requestAnimationFrame(frame);
    },

    /** Interface chuẩn: start = vào trận (màn hình start cũng gọi hàm này). */
    start() {
      if (mode === "blocked") return;
      startMatch();
    },

    pause() {
      pauseMatch();
    },

    resume() {
      resumeMatch();
    },

    restart() {
      if (mode === "blocked") return;
      startMatch();
    },

    resize() {
      applyQuality();
    },

    async destroy() {
      destroyed = true;
      cancelAnimationFrame(rafId);
      ro?.disconnect();
      keys?.destroy();
      exitLock();
      hud?.destroy();
      screens?.destroy();
      engine?.dispose();
      wrap?.remove();
      wrap = null;
      engine = null;
      world = null;
      bots = null;
      weapon = null;
      player = null;
      fx = null;
      pickups = null;
    },
  };
}

exports.createGame = createGame;
};
__defs["games/strike/engine.js"] = function (exports, __req) {
/**
 * engine.js — renderer WebGL thuần cho 404 Strike.
 *
 * Máy đích không có Internet nên không thể cài Three.js từ npm; module
 * này cung cấp đúng phần 404 Strike cần với API tối giản kiểu Three:
 *  - Node hierarchy (pos/rot/scale/children) + mesh (geometry, material)
 *  - Geometry: box, plane, tam giác, gem (octahedron)
 *  - Material: màu phẳng + directional light, emissive (neon), opacity,
 *    additive blend, texture từ canvas
 *  - Fog tuyến tính, camera FPS (yaw/pitch), pass riêng cho viewmodel súng
 *  - rayAABB cho đường đạn (raycasting)
 * Muốn chuyển sang Three.js sau này: thay engine.js, giữ nguyên API.
 */

/* ============================== Toán ============================== */

function mat4Perspective(out, fovYRad, aspect, near, far) {
  const f = 1 / Math.tan(fovYRad / 2);
  out.fill(0);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) / (near - far);
  out[11] = -1;
  out[14] = (2 * far * near) / (near - far);
  return out;
}

function mat4Identity(out) {
  out.fill(0);
  out[0] = out[5] = out[10] = out[15] = 1;
  return out;
}

function mat4Multiply(out, a, b) {
  // out = a * b (cột-major kiểu WebGL)
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      o[c * 4 + r] =
        a[r] * b[c * 4] +
        a[4 + r] * b[c * 4 + 1] +
        a[8 + r] * b[c * 4 + 2] +
        a[12 + r] * b[c * 4 + 3];
    }
  }
  out.set(o);
  return out;
}

/** M = T * RY * RX * RZ * S — đủ cho node game. */
function mat4Compose(out, pos, rot, scale) {
  const [x, y, z] = pos;
  const [rx, ry, rz] = rot;
  const [sx, sy, sz] = scale;
  const cy = Math.cos(ry), sy_ = Math.sin(ry);
  const cx = Math.cos(rx), sx_ = Math.sin(rx);
  const cz = Math.cos(rz), sz_ = Math.sin(rz);

  // R = RY * RX * RZ
  const r00 = cy * cz + sy_ * sx_ * sz_;
  const r01 = -cy * sz_ + sy_ * sx_ * cz;
  const r02 = sy_ * cx;
  const r10 = cx * sz_;
  const r11 = cx * cz;
  const r12 = -sx_;
  const r20 = -sy_ * cz + cy * sx_ * sz_;
  const r21 = sy_ * sz_ + cy * sx_ * cz;
  const r22 = cy * cx;

  out[0] = r00 * sx; out[1] = r10 * sx; out[2] = r20 * sx; out[3] = 0;
  out[4] = r01 * sy; out[5] = r11 * sy; out[6] = r21 * sy; out[7] = 0;
  out[8] = r02 * sz; out[9] = r12 * sz; out[10] = r22 * sz; out[11] = 0;
  out[12] = x; out[13] = y; out[14] = z; out[15] = 1;
  return out;
}

/** View matrix cho camera FPS: nghịch đảo của T(pos)*RY(yaw)*RX(pitch). */
function mat4FpsView(out, pos, yaw, pitch) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  // Trục camera trong world
  const rx = [cy, 0, -sy];
  const ry = [sy * sp, cp, cy * sp];
  const rz = [sy * cp, -sp, cy * cp];
  out[0] = rx[0]; out[4] = rx[1]; out[8] = rx[2];
  out[1] = ry[0]; out[5] = ry[1]; out[9] = ry[2];
  out[2] = rz[0]; out[6] = rz[1]; out[10] = rz[2];
  out[3] = 0; out[7] = 0; out[11] = 0;
  out[12] = -(rx[0] * pos[0] + rx[1] * pos[1] + rx[2] * pos[2]);
  out[13] = -(ry[0] * pos[0] + ry[1] * pos[1] + ry[2] * pos[2]);
  out[14] = -(rz[0] * pos[0] + rz[1] * pos[1] + rz[2] * pos[2]);
  out[15] = 1;
  return out;
}

/** Hướng nhìn từ yaw/pitch (chuẩn: yaw 0 → -Z). */
function dirFromYawPitch(yaw, pitch) {
  const cp = Math.cos(pitch);
  return [-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp];
}

/** Ray vs AABB (slab). Trả về khoảng cách t ≥ 0 hoặc null. */
function rayAABB(origin, dir, box) {
  let tmin = 0;
  let tmax = Infinity;
  for (let i = 0; i < 3; i++) {
    const o = origin[i];
    const d = dir[i];
    const mn = box.min[i];
    const mx = box.max[i];
    if (Math.abs(d) < 1e-9) {
      if (o < mn || o > mx) return null;
    } else {
      let t1 = (mn - o) / d;
      let t2 = (mx - o) / d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }
  return tmin;
}

/* ============================== Node ============================== */

function createNode(opts = {}) {
  return {
    pos: opts.pos ? [...opts.pos] : [0, 0, 0],
    rot: opts.rot ? [...opts.rot] : [0, 0, 0],
    scale: opts.scale ? [...opts.scale] : [1, 1, 1],
    mesh: opts.mesh || null, // { geo, color, emissive, opacity, additive, tex }
    children: [],
    visible: true,
    _world: new Float32Array(16),
  };
}

function addChild(parent, child) {
  parent.children.push(child);
  return child;
}

/* ============================ Shaders ============================ */

const VS = `
attribute vec3 aPos;
attribute vec3 aNormal;
attribute vec2 aUv;
uniform mat4 uProj, uView, uModel;
varying vec3 vNormal;
varying vec2 vUv;
varying float vDepth;
void main() {
  vec4 world = uModel * vec4(aPos, 1.0);
  vec4 viewPos = uView * world;
  gl_Position = uProj * viewPos;
  vDepth = -viewPos.z;
  vNormal = mat3(uModel) * aNormal;
  vUv = aUv;
}`;

const FS = `
precision mediump float;
uniform vec3 uColor;
uniform float uEmissive;
uniform float uOpacity;
uniform float uUseTex;
uniform sampler2D uTex;
uniform vec3 uFogColor;
uniform vec2 uFogRange;
uniform vec3 uLightDir;
uniform float uAmbient;
uniform float uFogOn;
varying vec3 vNormal;
varying vec2 vUv;
varying float vDepth;
void main() {
  vec4 texel = mix(vec4(1.0), texture2D(uTex, vUv), uUseTex);
  vec3 base = uColor * texel.rgb;
  float ndl = max(dot(normalize(vNormal), -normalize(uLightDir)), 0.0);
  vec3 lit = base * (uAmbient + (1.0 - uAmbient) * ndl);
  vec3 col = mix(lit, base, uEmissive);
  float fogF = clamp((uFogRange.y - vDepth) / (uFogRange.y - uFogRange.x), 0.0, 1.0);
  col = mix(uFogColor, col, max(fogF, 1.0 - uFogOn));
  gl_FragColor = vec4(col, uOpacity * texel.a);
}`;

/* ============================ Geometry ============================ */

function boxData() {
  // Hộp đơn vị (cạnh 1, tâm gốc): 6 mặt × 4 đỉnh
  const p = 0.5;
  const faces = [
    { n: [0, 0, 1],  v: [[-p,-p,p],[p,-p,p],[p,p,p],[-p,p,p]] },
    { n: [0, 0, -1], v: [[p,-p,-p],[-p,-p,-p],[-p,p,-p],[p,p,-p]] },
    { n: [1, 0, 0],  v: [[p,-p,p],[p,-p,-p],[p,p,-p],[p,p,p]] },
    { n: [-1, 0, 0], v: [[-p,-p,-p],[-p,-p,p],[-p,p,p],[-p,p,-p]] },
    { n: [0, 1, 0],  v: [[-p,p,p],[p,p,p],[p,p,-p],[-p,p,-p]] },
    { n: [0, -1, 0], v: [[-p,-p,-p],[p,-p,-p],[p,-p,p],[-p,-p,p]] },
  ];
  const pos = [];
  const nor = [];
  const uv = [];
  const idx = [];
  let base = 0;
  for (const f of faces) {
    for (let i = 0; i < 4; i++) {
      pos.push(...f.v[i]);
      nor.push(...f.n);
      uv.push(i === 1 || i === 2 ? 1 : 0, i >= 2 ? 1 : 0);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    base += 4;
  }
  return { pos, nor, uv, idx };
}

function planeData() {
  // Mặt phẳng đơn vị trên XY, pháp tuyến +Z
  return {
    pos: [-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0],
    nor: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
    uv: [0, 1, 1, 1, 1, 0, 0, 0],
    idx: [0, 1, 2, 0, 2, 3],
  };
}

function triData() {
  // Tam giác đều chỉa xuống (visor/marker), pháp tuyến +Z
  return {
    pos: [-0.5, 0.5, 0, 0.5, 0.5, 0, 0, -0.5, 0],
    nor: [0, 0, 1, 0, 0, 1, 0, 0, 1],
    uv: [0, 0, 1, 0, 0.5, 1],
    idx: [0, 1, 2],
  };
}

function gemData() {
  // Octahedron (viên năng lượng giữa map)
  const v = [
    [0, 0.5, 0], [0, -0.5, 0],
    [0.5, 0, 0], [-0.5, 0, 0], [0, 0, 0.5], [0, 0, -0.5],
  ];
  const facesIdx = [
    [0, 4, 2], [0, 2, 5], [0, 5, 3], [0, 3, 4],
    [1, 2, 4], [1, 5, 2], [1, 3, 5], [1, 4, 3],
  ];
  const pos = [];
  const nor = [];
  const uv = [];
  const idx = [];
  let base = 0;
  for (const f of facesIdx) {
    const [a, b, c] = f.map((i) => v[i]);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [
      u[1] * w[2] - u[2] * w[1],
      u[2] * w[0] - u[0] * w[2],
      u[0] * w[1] - u[1] * w[0],
    ];
    const len = Math.hypot(...n) || 1;
    n[0] /= len; n[1] /= len; n[2] /= len;
    for (const p of [a, b, c]) {
      pos.push(...p);
      nor.push(...n);
      uv.push(0, 0);
    }
    idx.push(base, base + 1, base + 2);
    base += 3;
  }
  return { pos, nor, uv, idx };
}

/* ============================ Engine ============================ */

function createEngine(canvas, opts = {}) {
  const gl =
    canvas.getContext("webgl", { antialias: true, alpha: false }) ||
    canvas.getContext("experimental-webgl", { antialias: true, alpha: false });
  if (!gl) return null; // caller hiển thị fallback "WebGL không khả dụng"

  const fogColor = opts.fogColor || [0.03, 0.052, 0.125];
  let fogNear = opts.fogNear ?? 24;
  let fogFar = opts.fogFar ?? 70;

  /* --- Chương trình shader --- */
  function compile(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(sh);
      gl.deleteShader(sh);
      throw new Error(`Shader lỗi: ${info}`);
    }
    return sh;
  }

  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(`Link shader lỗi: ${gl.getProgramInfoLog(prog)}`);
  }
  gl.useProgram(prog);

  const A = {
    pos: gl.getAttribLocation(prog, "aPos"),
    nor: gl.getAttribLocation(prog, "aNormal"),
    uv: gl.getAttribLocation(prog, "aUv"),
  };
  const U = {};
  for (const name of [
    "uProj", "uView", "uModel", "uColor", "uEmissive", "uOpacity",
    "uUseTex", "uTex", "uFogColor", "uFogRange", "uLightDir", "uAmbient", "uFogOn",
  ]) {
    U[name] = gl.getUniformLocation(prog, name);
  }

  gl.enable(gl.DEPTH_TEST);
  gl.disable(gl.CULL_FACE); // hình khối mỏng/tam giác nhìn được 2 mặt
  gl.uniform3fv(U.uFogColor, fogColor);
  gl.uniform2f(U.uFogRange, fogNear, fogFar);
  gl.uniform3f(U.uLightDir, -0.35, -0.8, -0.45);
  gl.uniform1f(U.uAmbient, 0.58);
  gl.uniform1i(U.uTex, 0);

  /* --- Geometry cache --- */
  const geos = new Map();

  function upload(name, data) {
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    const count = data.pos.length / 3;
    const inter = new Float32Array(count * 8);
    for (let i = 0; i < count; i++) {
      inter[i * 8] = data.pos[i * 3];
      inter[i * 8 + 1] = data.pos[i * 3 + 1];
      inter[i * 8 + 2] = data.pos[i * 3 + 2];
      inter[i * 8 + 3] = data.nor[i * 3];
      inter[i * 8 + 4] = data.nor[i * 3 + 1];
      inter[i * 8 + 5] = data.nor[i * 3 + 2];
      inter[i * 8 + 6] = data.uv[i * 2];
      inter[i * 8 + 7] = data.uv[i * 2 + 1];
    }
    gl.bufferData(gl.ARRAY_BUFFER, inter, gl.STATIC_DRAW);
    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(data.idx), gl.STATIC_DRAW);
    const geo = { vbo, ibo, count: data.idx.length };
    geos.set(name, geo);
    return geo;
  }

  upload("box", boxData());
  upload("plane", planeData());
  upload("tri", triData());
  upload("gem", gemData());

  /* --- Texture từ canvas --- */
  const textures = [];
  function makeTexture(sourceCanvas) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    textures.push(tex);
    return tex;
  }

  /** Cập nhật nội dung texture (màn hình đạn trên súng...). */
  function updateTexture(tex, sourceCanvas) {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas);
  }

  /* --- Camera + kích thước --- */
  const camera = { pos: [0, 1.7, 0], yaw: 0, pitch: 0, fov: 75 };
  const proj = new Float32Array(16);
  const view = new Float32Array(16);
  const vmProj = new Float32Array(16);
  const vmView = mat4Identity(new Float32Array(16));
  let width = 1;
  let height = 1;
  let renderScale = 1;

  function resize(cssW, cssH, scale = renderScale) {
    renderScale = scale;
    const dpr = Math.min(window.devicePixelRatio || 1, 2) * renderScale;
    width = Math.max(1, Math.round(cssW * dpr));
    height = Math.max(1, Math.round(cssH * dpr));
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    gl.viewport(0, 0, width, height);
  }

  /* --- Duyệt cây node và vẽ --- */
  const IDENT = mat4Identity(new Float32Array(16));
  const opaqueList = [];
  const blendList = [];

  function collect(node, parentMat, list2) {
    if (!node.visible) return;
    mat4Compose(node._world, node.pos, node.rot, node.scale);
    if (parentMat !== IDENT) mat4Multiply(node._world, parentMat, node._world);
    if (node.mesh) {
      const m = node.mesh;
      if (m.additive || (m.opacity !== undefined && m.opacity < 1)) list2.blend.push(node);
      else list2.opaque.push(node);
    }
    for (const c of node.children) collect(c, node._world, list2);
  }

  function bindGeo(geo) {
    gl.bindBuffer(gl.ARRAY_BUFFER, geo.vbo);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, geo.ibo);
    gl.vertexAttribPointer(A.pos, 3, gl.FLOAT, false, 32, 0);
    gl.vertexAttribPointer(A.nor, 3, gl.FLOAT, false, 32, 12);
    gl.vertexAttribPointer(A.uv, 2, gl.FLOAT, false, 32, 24);
    gl.enableVertexAttribArray(A.pos);
    gl.enableVertexAttribArray(A.nor);
    gl.enableVertexAttribArray(A.uv);
  }

  let boundGeo = null;
  function drawNode(node) {
    const m = node.mesh;
    const geo = geos.get(m.geo);
    if (!geo) return;
    if (boundGeo !== geo) {
      bindGeo(geo);
      boundGeo = geo;
    }
    gl.uniformMatrix4fv(U.uModel, false, node._world);
    gl.uniform3fv(U.uColor, m.color);
    gl.uniform1f(U.uEmissive, m.emissive || 0);
    gl.uniform1f(U.uOpacity, m.opacity === undefined ? 1 : m.opacity);
    gl.uniform1f(U.uUseTex, m.tex ? 1 : 0);
    if (m.tex) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, m.tex);
    }
    gl.drawElements(gl.TRIANGLES, geo.count, gl.UNSIGNED_SHORT, 0);
  }

  function render(sceneRoot, viewmodelRoot) {
    gl.clearColor(fogColor[0], fogColor[1], fogColor[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const aspect = width / height;
    mat4Perspective(proj, (camera.fov * Math.PI) / 180, aspect, 0.08, 120);
    mat4FpsView(view, camera.pos, camera.yaw, camera.pitch);
    gl.uniformMatrix4fv(U.uProj, false, proj);
    gl.uniformMatrix4fv(U.uView, false, view);
    gl.uniform2f(U.uFogRange, fogNear, fogFar);
    gl.uniform1f(U.uFogOn, 1);

    const lists = { opaque: opaqueList, blend: blendList };
    opaqueList.length = 0;
    blendList.length = 0;
    collect(sceneRoot, IDENT, lists);

    boundGeo = null;
    gl.disable(gl.BLEND);
    gl.depthMask(true);
    for (const n of opaqueList) drawNode(n);

    // Pha trong suốt / cộng sáng (tracer, flash, hologram)
    gl.enable(gl.BLEND);
    gl.depthMask(false);
    for (const n of blendList) {
      if (n.mesh.additive) gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      else gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      drawNode(n);
    }
    gl.depthMask(true);
    gl.disable(gl.BLEND);

    // Pass viewmodel: xóa depth, camera riêng để súng không xuyên tường
    if (viewmodelRoot) {
      gl.clear(gl.DEPTH_BUFFER_BIT);
      mat4Perspective(vmProj, (58 * Math.PI) / 180, aspect, 0.01, 10);
      gl.uniformMatrix4fv(U.uProj, false, vmProj);
      gl.uniformMatrix4fv(U.uView, false, vmView);
      gl.uniform1f(U.uFogOn, 0); // súng không bị fog

      opaqueList.length = 0;
      blendList.length = 0;
      collect(viewmodelRoot, IDENT, { opaque: opaqueList, blend: blendList });
      boundGeo = null;
      for (const n of opaqueList) drawNode(n);
      gl.enable(gl.BLEND);
      gl.depthMask(false);
      for (const n of blendList) {
        if (n.mesh.additive) gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        else gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        drawNode(n);
      }
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }
  }

  return {
    gl,
    camera,
    resize,
    render,
    makeTexture,
    updateTexture,
    setFog(near, far) {
      fogNear = near;
      fogFar = far;
    },
    get size() {
      return { width, height };
    },
    dispose() {
      for (const geo of geos.values()) {
        gl.deleteBuffer(geo.vbo);
        gl.deleteBuffer(geo.ibo);
      }
      geos.clear();
      for (const t of textures) gl.deleteTexture(t);
      textures.length = 0;
      gl.deleteProgram(prog);
      const lose = gl.getExtension("WEBGL_lose_context");
      lose?.loseContext();
    },
  };
}

/** Helper tạo mesh-node nhanh. */
function meshNode(geo, { pos, rot, scale, color, emissive = 0, opacity, additive = false, tex = null } = {}) {
  return createNode({
    pos,
    rot,
    scale,
    mesh: { geo, color: color || [1, 1, 1], emissive, opacity, additive, tex },
  });
}

/** Đổi hex "#rrggbb" → [r,g,b] 0..1. */
function hex(c) {
  const n = parseInt(c.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

exports.mat4Perspective = mat4Perspective; exports.mat4Identity = mat4Identity; exports.mat4Multiply = mat4Multiply; exports.mat4Compose = mat4Compose; exports.mat4FpsView = mat4FpsView; exports.dirFromYawPitch = dirFromYawPitch; exports.rayAABB = rayAABB; exports.createNode = createNode; exports.addChild = addChild; exports.createEngine = createEngine; exports.meshNode = meshNode; exports.hex = hex;
};
__defs["games/strike/world.js"] = function (exports, __req) {
/**
 * world.js — dựng map "404 Strike" theo Level Map reference:
 *  - Kích thước 60m × 40m, lưới 2m.
 *  - KHU CAO phía bắc (+3m) với cầu thang trung tâm, cột tím.
 *  - SÂN TRUNG TÂM có viền neon cyan + 8 vật cản + trụ năng lượng.
 *  - HÀNH LANG TRÁI/PHẢI với vật cản và vòng tuần tra (đường đứt đỏ).
 *  - 8 cổng spawn bot (đỏ) hai bên, ĐIỂM XUẤT PHÁT (xanh) phía nam.
 *  - Đèn neon: sọc cyan, thanh đỏ dọc tường, bảng "404" tím phát sáng.
 * Xuất: scene root, colliders (AABB), groundHeightAt, patrol loops,
 * vị trí spawn, hàm update (hiệu ứng động) và resolveMove (va chạm).
 */

const { createNode, addChild, meshNode, hex } = __req("games/strike/engine.js");
const { seededRand } = __req("core/utils.js");

const MAP = {
  halfX: 30,
  halfZ: 20,
  wallH: 4,
  platform: { x1: -8, x2: 8, z1: -20, z2: -14, h: 3 },
  ramp: { x1: -2, x2: 2, z1: -14, z2: -11 }, // từ y=3 (z1) xuống y=0 (z2)
};

const C = {
  wall: "#151b38",
  wallDark: "#10152e",
  crate: "#171e3d",
  cyan: "#20e3ff",
  violet: "#9a5cff",
  magenta: "#ff4fd8",
  lime: "#a8ff3e",
  red: "#ff4f64",
  gold: "#ffd23f",
  floorLine: "#1a2350",
};

/* ============================ Texture ============================ */

function floorTexture(engine) {
  const cv = document.createElement("canvas");
  cv.width = 1024;
  cv.height = 683; // tỉ lệ 60:40
  const ctx = cv.getContext("2d");
  const rand = seededRand(60);

  ctx.fillStyle = "#0e1434";
  ctx.fillRect(0, 0, cv.width, cv.height);

  // Ô 2m với sắc thái ngẫu nhiên nhẹ (panel công nghiệp)
  const cw = cv.width / 30;
  const ch = cv.height / 20;
  for (let gy = 0; gy < 20; gy++) {
    for (let gx = 0; gx < 30; gx++) {
      const v = rand();
      if (v > 0.55) {
        ctx.fillStyle = `rgba(255,255,255,${(v - 0.55) * 0.045})`;
        ctx.fillRect(gx * cw, gy * ch, cw, ch);
      } else if (v < 0.16) {
        ctx.fillStyle = "rgba(0,0,0,0.16)";
        ctx.fillRect(gx * cw, gy * ch, cw, ch);
      }
    }
  }

  // Sân trung tâm tối hơn một chút
  ctx.fillStyle = "rgba(4,6,18,0.5)";
  ctx.fillRect(((30 - 13) / 60) * cv.width + cw * 6.5 * 0, ((20 - 9) / 40) * cv.height, (26 / 60) * cv.width, (18 / 40) * cv.height);

  // Lưới 2m (mờ — nền phải đọc là sàn panel đặc, không phải lưới TRON)
  ctx.strokeStyle = "rgba(70,95,200,0.12)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 30; i++) {
    ctx.beginPath();
    ctx.moveTo(i * cw, 0);
    ctx.lineTo(i * cw, cv.height);
    ctx.stroke();
  }
  for (let i = 0; i <= 20; i++) {
    ctx.beginPath();
    ctx.moveTo(0, i * ch);
    ctx.lineTo(cv.width, i * ch);
    ctx.stroke();
  }

  // Sọc cảnh báo vàng trước các cổng spawn hai bên
  ctx.save();
  ctx.fillStyle = "rgba(255,210,63,0.5)";
  for (const gz of [-16, -6, 6, 16]) {
    for (const side of [-1, 1]) {
      const px = ((side === -1 ? 2.2 : 60 - 3.4) / 60) * cv.width;
      const pz = ((gz + 20 - 1) / 40) * cv.height;
      for (let s = 0; s < 4; s++) {
        ctx.fillRect(px + s * 8, pz, 4, (2 / 40) * cv.height);
      }
    }
  }
  ctx.restore();

  return engine.makeTexture(cv);
}

function wallTexture(engine) {
  const cv = document.createElement("canvas");
  cv.width = 256;
  cv.height = 128;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#1b2248";
  ctx.fillRect(0, 0, 256, 128);
  // Mối ghép panel
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = 2;
  for (let x = 0; x <= 256; x += 64) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 128); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(0, 88); ctx.lineTo(256, 88); ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  ctx.fillRect(0, 0, 256, 10);
  // Đinh tán
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  for (let x = 12; x < 256; x += 64) {
    ctx.fillRect(x, 96, 3, 3);
    ctx.fillRect(x + 40, 96, 3, 3);
  }
  return engine.makeTexture(cv);
}

function crateTexture(engine, trim = "#20e3ff", hazard = false) {
  const cv = document.createElement("canvas");
  cv.width = 128;
  cv.height = 128;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#151b38";
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = trim;
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, 116, 116);
  ctx.globalAlpha = 0.28;
  ctx.strokeRect(18, 18, 92, 92);
  ctx.globalAlpha = 1;
  if (hazard) {
    // Tam giác cảnh báo vàng (theo asset sheet vật cản/đạn)
    ctx.fillStyle = "rgba(255,210,63,0.9)";
    ctx.beginPath();
    ctx.moveTo(64, 38);
    ctx.lineTo(92, 86);
    ctx.lineTo(36, 86);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#151b38";
    ctx.font = "700 34px monospace";
    ctx.textAlign = "center";
    ctx.fillText("!", 64, 80);
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.fillRect(30, 58, 68, 12);
  }
  return engine.makeTexture(cv);
}

function signTexture(engine) {
  const cv = document.createElement("canvas");
  cv.width = 512;
  cv.height = 180;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#0d1230";
  ctx.fillRect(0, 0, 512, 180);
  ctx.strokeStyle = "rgba(32,227,255,0.8)";
  ctx.lineWidth = 5;
  ctx.strokeRect(8, 8, 496, 164);
  ctx.font = "800 120px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "#9a5cff";
  ctx.shadowBlur = 42;
  ctx.fillStyle = "#b07bff";
  ctx.fillText("404", 256, 96);
  ctx.shadowBlur = 0;
  return engine.makeTexture(cv);
}

function blobTexture(engine) {
  const cv = document.createElement("canvas");
  cv.width = 64;
  cv.height = 64;
  const ctx = cv.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  g.addColorStop(0, "rgba(0,0,0,0.55)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return engine.makeTexture(cv);
}

/* ============================ Dựng map ============================ */

function createWorld(engine) {
  const root = createNode();
  const colliders = [];
  const dynamic = { markers: [], gem: null, gateGlows: [] };

  const texFloor = floorTexture(engine);
  const texWall = wallTexture(engine);
  const texCrate = crateTexture(engine, C.cyan, false);
  const texCrateHazard = crateTexture(engine, C.cyan, true);
  const texSign = signTexture(engine);
  const texBlob = blobTexture(engine);

  const box = (x, y, z, w, h, d, color, opts = {}) => {
    const n = meshNode("box", {
      pos: [x, y, z],
      scale: [w, h, d],
      color: hex(color),
      ...opts,
    });
    addChild(root, n);
    return n;
  };

  const addCollider = (x, z, w, d, y0 = 0, y1 = 4) => {
    colliders.push({
      min: [x - w / 2, y0, z - d / 2],
      max: [x + w / 2, y1, z + d / 2],
    });
  };

  /* ---- Sàn ---- */
  const floor = meshNode("plane", {
    pos: [0, 0, 0],
    rot: [-Math.PI / 2, 0, 0],
    scale: [60, 40, 1],
    color: [1, 1, 1],
    tex: texFloor,
  });
  addChild(root, floor);

  /* ---- Tường bao ---- */
  const wall = (x, z, w, h, d) => {
    const n = box(x, h / 2, z, w, h, d, "#ffffff", { tex: texWall });
    addCollider(x, z, w, d, 0, h);
    return n;
  };
  wall(-20, -20.5, 20, 4, 1); // bắc trái
  wall(20, -20.5, 20, 4, 1);  // bắc phải
  wall(0, -20.5, 20, 7, 1);   // bắc giữa (cao, giữ bảng 404)
  wall(0, 20.5, 60, 4, 1);    // nam
  wall(-30.5, 0, 1, 4, 40);   // tây
  wall(30.5, 0, 1, 4, 40);    // đông

  // Sọc neon cyan chạy dọc đỉnh tường
  for (const [x, z, w, d] of [
    [0, -19.9, 59, 0.12], [0, 19.9, 59, 0.12],
    [-29.9, 0, 0.12, 39], [29.9, 0, 0.12, 39],
  ]) {
    box(x, 3.82, z, w, 0.08, d, C.cyan, { emissive: 0.9 });
  }

  // Thanh đèn đỏ dọc trên tường (theo gameplay reference)
  for (const [x, z] of [
    [-29.85, -10], [-29.85, 10], [29.85, -10], [29.85, 10],
    [-16, -20.35], [16, -20.35], [-8, 20.35], [8, 20.35],
  ]) {
    box(x, 2.2, z, Math.abs(x) > 25 ? 0.14 : 0.5, 2.6, Math.abs(x) > 25 ? 0.5 : 0.14, C.red, { emissive: 1 });
  }

  /* ---- Bảng 404 (tường bắc, nhìn về phía nam) ---- */
  const sign = meshNode("plane", {
    pos: [0, 4.6, -19.95],
    scale: [12, 4.2, 1],
    color: [1, 1, 1],
    tex: texSign,
    emissive: 1,
  });
  addChild(root, sign);

  /* ---- KHU CAO (bục +3m) + cầu thang ---- */
  const P = MAP.platform;
  const pw = P.x2 - P.x1;
  const pd = P.z2 - P.z1;
  box((P.x1 + P.x2) / 2, P.h - 0.25, (P.z1 + P.z2) / 2, pw, 0.5, pd, C.wall, { tex: texWall });
  // Chân bục
  box((P.x1 + P.x2) / 2, (P.h - 0.5) / 2, (P.z1 + P.z2) / 2, pw, P.h - 0.5, pd, C.wallDark);
  // Viền neon tím mép bục
  box(0, P.h + 0.02, P.z2 - 0.05, pw, 0.06, 0.12, C.violet, { emissive: 0.95 });

  // Collider mặt nam bục (chừa lối cầu thang x∈[-2,2])
  addCollider((-8 + -2) / 2, P.z2, 6, 0.4, 0, P.h);
  addCollider((8 + 2) / 2, P.z2, 6, 0.4, 0, P.h);
  // Hông đông/tây của bục
  addCollider(P.x1, (P.z1 + P.z2) / 2, 0.4, pd, 0, P.h);
  addCollider(P.x2, (P.z1 + P.z2) / 2, 0.4, pd, 0, P.h);

  // Cầu thang: 6 bậc nhìn thấy + lan can thấp hai bên
  const R = MAP.ramp;
  const steps = 6;
  for (let i = 0; i < steps; i++) {
    const t = (i + 0.5) / steps;
    const sz = (R.z2 - R.z1) / steps;
    const h = P.h * (1 - t);
    box(0, h / 2, R.z1 + (i + 0.5) * sz, R.x2 - R.x1, h, sz, C.wallDark, { tex: texWall });
  }
  box(R.x1 - 0.15, 0.9, (R.z1 + R.z2) / 2, 0.3, 1.8, R.z2 - R.z1, C.wall);
  box(R.x2 + 0.15, 0.9, (R.z1 + R.z2) / 2, 0.3, 1.8, R.z2 - R.z1, C.wall);
  addCollider(R.x1 - 0.15, (R.z1 + R.z2) / 2, 0.3, R.z2 - R.z1, 0, 3.2);
  addCollider(R.x2 + 0.15, (R.z1 + R.z2) / 2, 0.3, R.z2 - R.z1, 0, 3.2);

  // Cột tím hai bên khu cao (theo level map)
  for (const [x, z] of [[-7.4, -14.4], [7.4, -14.4], [-7.4, -19.4], [7.4, -19.4]]) {
    box(x, P.h + 1.3, z, 0.5, 2.6, 0.5, C.violet, { emissive: 0.75 });
  }
  // Vật cản trên khu cao (trang trí)
  box(-5, P.h + 0.6, -17.5, 1.8, 1.2, 1.8, "#ffffff", { tex: texCrate });
  box(5, P.h + 0.6, -17.5, 1.8, 1.2, 1.8, "#ffffff", { tex: texCrateHazard });

  /* ---- Viền neon sân trung tâm (cyan) ---- */
  for (const [x, z, w, d] of [
    [0, -9, 26, 0.14], [0, 9, 26, 0.14], [-13, 0, 0.14, 18], [13, 0, 0.14, 18],
  ]) {
    box(x, 0.03, z, w, 0.05, d, C.cyan, { emissive: 0.85 });
  }
  // Vạch hành lang
  box(-16.2, 0.03, 0, 0.1, 0.04, 28, C.cyan, { emissive: 0.4 });
  box(16.2, 0.03, 0, 0.1, 0.04, 28, C.cyan, { emissive: 0.4 });

  /* ---- Trụ năng lượng trung tâm ---- */
  box(0, 0.35, 0, 1.3, 0.7, 1.3, C.wallDark, { tex: texWall });
  addCollider(0, 0, 1.5, 1.5, 0, 1.4);
  const gem = meshNode("gem", {
    pos: [0, 1.35, 0],
    scale: [0.9, 1.25, 0.9],
    color: hex(C.violet),
    emissive: 1,
  });
  addChild(root, gem);
  dynamic.gem = gem;

  /* ---- Tường ngăn hành lang (có cửa) ---- */
  for (const side of [-1, 1]) {
    for (const zc of [-8.5, 8.5]) {
      const n = box(side * 15, 1.6, zc, 0.9, 3.2, 9, "#ffffff", { tex: texWall });
      addCollider(side * 15, zc, 0.9, 9, 0, 3.2);
      // Viền cyan mép cửa
      box(side * 15, 1.6, zc - 4.55, 0.95, 3.2, 0.1, C.cyan, { emissive: 0.5 });
      box(side * 15, 1.6, zc + 4.55, 0.95, 3.2, 0.1, C.cyan, { emissive: 0.5 });
      void n;
    }
  }

  /* ---- Vật cản (crate 2×1.4×2, theo asset sheet) ---- */
  const crate = (x, z, stack = 1, hazard = false) => {
    for (let i = 0; i < stack; i++) {
      box(x, 0.7 + i * 1.4, z, 2, 1.4, 2, "#ffffff", {
        tex: hazard && i === stack - 1 ? texCrateHazard : texCrate,
      });
      // Viền phát sáng mép trên
      box(x, 1.42 + i * 1.4, z, 2.04, 0.05, 2.04, C.cyan, { emissive: 0.55 });
    }
    addCollider(x, z, 2, 2, 0, 1.4 * stack);
  };

  // Sân trung tâm: 2 hàng × 4 (một vài chồng đôi)
  crate(-10, -5); crate(-4, -5, 2, true); crate(4, -5); crate(10, -5);
  crate(-10, 5); crate(-4, 5); crate(4, 5, 1, true); crate(10, 5, 2);
  // Hành lang trái
  crate(-24, -10); crate(-19, -13, 1, true); crate(-26, -2, 2); crate(-20, 3); crate(-24, 9); crate(-19, 13);
  // Hành lang phải
  crate(24, -10, 1, true); crate(19, -13); crate(26, -2); crate(20, 3, 2); crate(24, 9); crate(19, 13, 1, true);
  // Các góc gần khu cao / điểm xuất phát
  crate(-13, -17); crate(13, -17, 2); crate(-25, -17); crate(25, -17);
  crate(-13, 16); crate(13, 16);

  /* ---- Cổng spawn bot (8, hai bên, theo level map) ---- */
  const botGates = [];
  const gateNode = (x, z, side) => {
    const g = createNode({ pos: [x, 0, z], rot: [0, side < 0 ? Math.PI / 2 : -Math.PI / 2, 0] });
    // Khung cổng tím
    for (const dz of [-1.1, 1.1]) {
      addChild(g, meshNode("box", { pos: [0, 1.3, dz], scale: [0.28, 2.6, 0.28], color: hex(C.violet), emissive: 0.85 }));
    }
    addChild(g, meshNode("box", { pos: [0, 2.62, 0], scale: [0.28, 0.26, 2.5], color: hex(C.violet), emissive: 0.85 }));
    // Màng sáng bên trong cổng
    const glow = meshNode("plane", {
      pos: [0.02, 1.3, 0],
      rot: [0, Math.PI / 2, 0],
      scale: [2.1, 2.5, 1],
      color: hex(C.magenta),
      emissive: 1,
      opacity: 0.22,
      additive: true,
    });
    addChild(g, glow);
    dynamic.gateGlows.push(glow);
    // Marker tam giác đỏ lộn ngược (cảnh báo)
    const marker = meshNode("tri", {
      pos: [0, 3.35, 0],
      rot: [0, Math.PI / 2, 0],
      scale: [0.7, 0.7, 1],
      color: hex(C.red),
      emissive: 1,
    });
    addChild(g, marker);
    dynamic.markers.push(marker);
    addChild(root, g);
    return g;
  };

  for (const z of [-16, -6, 6, 16]) {
    gateNode(-29, z, -1);
    botGates.push({ pos: [-27.5, 0, z], side: -1, loop: "left" });
  }
  for (const z of [-16, -6, 6, 16]) {
    gateNode(29, z, 1);
    botGates.push({ pos: [27.5, 0, z], side: 1, loop: "right" });
  }

  /* ---- Điểm xuất phát người chơi (cổng xanh phía nam) ---- */
  const pg = createNode({ pos: [0, 0, 19.4] });
  for (const dx of [-1.5, 1.5]) {
    addChild(pg, meshNode("box", { pos: [dx, 1.4, 0], scale: [0.3, 2.8, 0.3], color: hex(C.lime), emissive: 0.8 }));
  }
  addChild(pg, meshNode("box", { pos: [0, 2.82, 0], scale: [3.3, 0.26, 0.3], color: hex(C.lime), emissive: 0.8 }));
  addChild(root, pg);
  // Pad xuất phát viền lime
  for (const [x, z, w, d] of [
    [0, 14.6, 5, 0.12], [0, 19, 5, 0.12], [-2.5, 16.8, 0.12, 4.5], [2.5, 16.8, 0.12, 4.5],
  ]) {
    box(x, 0.03, z, w, 0.05, d, C.lime, { emissive: 0.8 });
  }

  /* ---- Bóng blob dưới trụ (texture chung cho bot dùng lại) ---- */

  /* ---- Vòng tuần tra (theo đường đứt đỏ trên level map) ---- */
  const patrols = {
    left: [[-27, -15], [-17.5, -15], [-17.5, 15], [-27, 15]],
    right: [[27, -15], [17.5, -15], [17.5, 15], [27, 15]],
    court: [[-11, -7], [11, -7], [11, 7], [-11, 7]],
  };

  /* ---- Độ cao mặt đất (bục + dốc cầu thang) ---- */
  function groundHeightAt(x, z) {
    const p = MAP.platform;
    if (x >= p.x1 && x <= p.x2 && z <= p.z2 && z >= p.z1) return p.h;
    const r = MAP.ramp;
    if (x >= r.x1 && x <= r.x2 && z > r.z1 && z <= r.z2) {
      return p.h * ((r.z2 - z) / (r.z2 - r.z1));
    }
    return 0;
  }

  /* ---- Va chạm di chuyển: đẩy hình tròn (r) ra khỏi AABB ---- */
  function resolveMove(pos, radius, height = 1.8) {
    for (const c of colliders) {
      if (pos[1] + height <= c.min[1] || pos[1] >= c.max[1] - 0.05) continue;
      const nx = Math.max(c.min[0], Math.min(pos[0], c.max[0]));
      const nz = Math.max(c.min[2], Math.min(pos[2], c.max[2]));
      const dx = pos[0] - nx;
      const dz = pos[2] - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= radius * radius) continue;
      if (d2 > 1e-9) {
        const d = Math.sqrt(d2);
        pos[0] = nx + (dx / d) * radius;
        pos[2] = nz + (dz / d) * radius;
      } else {
        // Tâm nằm trong hộp: đẩy ra theo trục gần nhất
        const left = Math.abs(pos[0] - c.min[0]);
        const right = Math.abs(c.max[0] - pos[0]);
        const near = Math.abs(pos[2] - c.min[2]);
        const far = Math.abs(c.max[2] - pos[2]);
        const m = Math.min(left, right, near, far);
        if (m === left) pos[0] = c.min[0] - radius;
        else if (m === right) pos[0] = c.max[0] + radius;
        else if (m === near) pos[2] = c.min[2] - radius;
        else pos[2] = c.max[2] + radius;
      }
    }
    // Giữ trong tường bao
    pos[0] = Math.max(-29.4, Math.min(29.4, pos[0]));
    pos[2] = Math.max(-19.4, Math.min(19.4, pos[2]));
  }

  /* ---- Hiệu ứng động ---- */
  let time = 0;
  function update(dt) {
    time += dt;
    if (dynamic.gem) {
      dynamic.gem.rot[1] += dt * 1.4;
      dynamic.gem.pos[1] = 1.35 + Math.sin(time * 2) * 0.08;
    }
    const pulse = 0.75 + 0.25 * Math.sin(time * 5);
    for (const m of dynamic.markers) {
      m.scale[0] = 0.7 * pulse;
      m.scale[1] = 0.7 * pulse;
    }
    for (const g of dynamic.gateGlows) {
      g.mesh.opacity = 0.14 + 0.1 * Math.sin(time * 3 + g.pos[2]);
    }
  }

  return {
    root,
    colliders,
    patrols,
    botGates,
    playerSpawn: { pos: [0, 0, 16.5], yaw: 0 },
    pickupSpots: {
      health: [[-13, 0], [13, 0]],
      ammo: [[0, -7.6], [0, 7.6]],
    },
    groundHeightAt,
    resolveMove,
    update,
    texBlob,
  };
}

exports.createWorld = createWorld; exports.MAP = MAP;
};
__defs["games/strike/player.js"] = function (exports, __req) {
/**
 * player.js — điều khiển nhân vật góc nhìn thứ nhất:
 * WASD di chuyển, Shift chạy, Space nhảy, chuột quan sát (yaw/pitch).
 * Trọng lực + va chạm tròn-vs-AABB + đi theo độ cao mặt đất (khu cao,
 * cầu thang). Head-bob nhẹ, tôn trọng prefers-reduced-motion.
 */

const { clamp } = __req("core/utils.js");

const EYE = 1.66;
const RADIUS = 0.45;
const WALK = 4.4;
const RUN = 6.6;
const ACCEL = 26;
const GRAVITY = 18;
const JUMP_V = 6.2;

function createPlayer(world, camera, { reducedMotion = false } = {}) {
  const pos = [0, 0, 16.5]; // chân nhân vật
  let yaw = 0;
  let pitch = 0;
  let vy = 0;
  let vx = 0;
  let vz = 0;
  let onGround = true;
  let jumpQueued = false;
  let bobPhase = 0;
  let bobAmp = 0;
  let recoilPitch = 0; // giật súng cộng vào pitch, tự hồi
  let shakeT = 0;
  let shakeAmp = 0;
  let hp = 100;

  function reset(spawn) {
    pos[0] = spawn.pos[0];
    pos[1] = world.groundHeightAt(spawn.pos[0], spawn.pos[2]);
    pos[2] = spawn.pos[2];
    yaw = spawn.yaw;
    pitch = 0;
    vx = vz = vy = 0;
    onGround = true;
    hp = 100;
    recoilPitch = 0;
    shakeT = 0;
  }

  /** Chuột: dx/dy pixel × độ nhạy. */
  function look(dx, dy, sensitivity) {
    const k = 0.0021 * sensitivity;
    yaw -= dx * k;
    pitch = clamp(pitch - dy * k, -1.45, 1.45);
  }

  function queueJump() {
    jumpQueued = true;
  }

  function addRecoil(amount) {
    recoilPitch += amount;
  }

  function shake(amp = 0.5) {
    if (reducedMotion) return;
    shakeT = 0.28;
    shakeAmp = amp;
  }

  function update(dt, input) {
    // input: { forward: -1..1, strafe: -1..1, run: bool }
    const speedMax = input.run && input.forward > 0 ? RUN : WALK;

    // Hướng di chuyển theo yaw (yaw 0 → -Z)
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    const wishX = (-sin * input.forward + cos * input.strafe);
    const wishZ = (-cos * input.forward - sin * input.strafe);
    const wishLen = Math.hypot(wishX, wishZ) || 1;
    const targetVx = (wishX / wishLen) * speedMax * Math.min(1, Math.hypot(input.forward, input.strafe));
    const targetVz = (wishZ / wishLen) * speedMax * Math.min(1, Math.hypot(input.forward, input.strafe));

    const blend = Math.min(1, ACCEL * dt);
    vx += (targetVx - vx) * blend;
    vz += (targetVz - vz) * blend;

    pos[0] += vx * dt;
    pos[2] += vz * dt;
    world.resolveMove(pos, RADIUS, 1.8);

    // Trọng lực + mặt đất (bục cao, dốc cầu thang)
    const ground = world.groundHeightAt(pos[0], pos[2]);
    vy -= GRAVITY * dt;
    pos[1] += vy * dt;
    if (pos[1] <= ground) {
      pos[1] = ground;
      vy = 0;
      onGround = true;
    } else if (pos[1] - ground > 0.02) {
      onGround = false;
    }

    if (jumpQueued) {
      jumpQueued = false;
      if (onGround) {
        vy = JUMP_V;
        onGround = false;
      }
    }

    // Head-bob khi di chuyển trên mặt đất
    const moveSpeed = Math.hypot(vx, vz);
    if (!reducedMotion && onGround && moveSpeed > 0.6) {
      bobPhase += dt * (6 + moveSpeed * 1.3);
      bobAmp = Math.min(1, bobAmp + dt * 6);
    } else {
      bobAmp = Math.max(0, bobAmp - dt * 5);
    }

    // Giật súng hồi dần + rung màn hình
    recoilPitch = Math.max(0, recoilPitch - dt * 2.6);
    shakeT = Math.max(0, shakeT - dt);

    // Cập nhật camera
    const bobY = Math.sin(bobPhase * 2) * 0.038 * bobAmp;
    let sx = 0;
    let sy = 0;
    if (shakeT > 0) {
      const k = (shakeT / 0.28) * shakeAmp;
      sx = (Math.random() - 0.5) * 0.05 * k;
      sy = (Math.random() - 0.5) * 0.05 * k;
    }
    camera.pos[0] = pos[0] + sx;
    camera.pos[1] = pos[1] + EYE + bobY + sy;
    camera.pos[2] = pos[2];
    camera.yaw = yaw;
    camera.pitch = pitch + recoilPitch;

    return { moveSpeed, onGround };
  }

  return {
    pos,
    reset,
    look,
    queueJump,
    update,
    addRecoil,
    shake,
    get yaw() { return yaw; },
    get pitch() { return pitch; },
    get hp() { return hp; },
    set hp(v) { hp = clamp(v, 0, 100); },
    eye() {
      return [camera.pos[0], camera.pos[1], camera.pos[2]];
    },
  };
}

exports.createPlayer = createPlayer;
};
__defs["games/strike/weapon.js"] = function (exports, __req) {
/**
 * weapon.js — khẩu rifle hư cấu theo Asset Sheet:
 * thân đen góc cạnh, sọc neon tím/magenta, khối ngắm có MÀN HÌNH HIỂN
 * THỊ SỐ ĐẠN (cập nhật realtime như reference). Băng 30 viên / 120 dự
 * trữ, bắn tự động, click phải ngắm (ADS), R thay đạn. Viewmodel vẽ ở
 * pass riêng (không xuyên tường), có sway/bob/recoil/hạ súng khi reload.
 */

const { createNode, addChild, meshNode, hex } = __req("games/strike/engine.js");

const MAG_SIZE = 30;
const RESERVE_START = 120;
const RESERVE_MAX = 240;
const FIRE_INTERVAL = 0.115; // ~520 rpm
const RELOAD_TIME = 1.35;

const HIP = { x: 0.3, y: -0.32, z: -0.62 };
const ADS = { x: 0, y: -0.245, z: -0.46 };

function createWeapon(engine, audio) {
  let mag = MAG_SIZE;
  let reserve = RESERVE_START;
  let cooldown = 0;
  let reloading = 0;
  let adsBlend = 0; // 0 hip → 1 ngắm
  let recoilKick = 0;
  let swayX = 0;
  let swayY = 0;
  let bobPhase = 0;
  let muzzleT = 0;
  let onAmmoChange = null;

  /* ---------- Màn hình đạn trên súng (canvas texture) ---------- */
  const ammoCv = document.createElement("canvas");
  ammoCv.width = 64;
  ammoCv.height = 44;
  const ammoCtx = ammoCv.getContext("2d");

  function paintAmmoDisplay() {
    ammoCtx.fillStyle = "#0d0a24";
    ammoCtx.fillRect(0, 0, 64, 44);
    ammoCtx.strokeStyle = "rgba(154,92,255,0.9)";
    ammoCtx.lineWidth = 2;
    ammoCtx.strokeRect(2, 2, 60, 40);
    ammoCtx.font = "800 26px monospace";
    ammoCtx.textAlign = "center";
    ammoCtx.textBaseline = "middle";
    ammoCtx.shadowColor = "#b07bff";
    ammoCtx.shadowBlur = 8;
    ammoCtx.fillStyle = mag <= 5 ? "#ff4f64" : "#cfa9ff";
    ammoCtx.fillText(String(mag), 32, 24);
    ammoCtx.shadowBlur = 0;
  }

  paintAmmoDisplay();
  const ammoTex = engine.makeTexture(ammoCv);

  function refreshAmmoUi() {
    paintAmmoDisplay();
    engine.updateTexture(ammoTex, ammoCv);
    onAmmoChange?.(mag, reserve);
  }

  /* ---------- Viewmodel (tọa độ camera-space) ---------- */
  const root = createNode();
  const gun = createNode({ pos: [HIP.x, HIP.y, HIP.z] });
  addChild(root, gun);

  const DARK = hex("#171c38");
  const DARKER = hex("#10142c");
  const VIOLET = hex("#9a5cff");
  const MAGENTA = hex("#ff4fd8");

  // Thân chính
  addChild(gun, meshNode("box", { pos: [0, 0, -0.05], scale: [0.085, 0.11, 0.58], color: DARK }));
  // Ốp trên + ray ngắm
  addChild(gun, meshNode("box", { pos: [0, 0.07, -0.12], scale: [0.07, 0.045, 0.38], color: DARKER }));
  // Nòng
  addChild(gun, meshNode("box", { pos: [0, 0.015, -0.44], scale: [0.045, 0.05, 0.26], color: DARKER }));
  const muzzleTip = addChild(gun, meshNode("box", { pos: [0, 0.015, -0.585], scale: [0.055, 0.06, 0.03], color: MAGENTA, emissive: 0.9 }));
  // Báng sau
  addChild(gun, meshNode("box", { pos: [0, -0.035, 0.3], scale: [0.07, 0.1, 0.16], color: DARKER }));
  // Băng đạn chéo
  const magNode = addChild(gun, meshNode("box", { pos: [0, -0.12, 0.02], rot: [0.18, 0, 0], scale: [0.06, 0.16, 0.09], color: DARK }));
  // Tay cầm
  addChild(gun, meshNode("box", { pos: [0, -0.1, 0.16], rot: [-0.3, 0, 0], scale: [0.055, 0.13, 0.07], color: DARKER }));
  // Khối ngắm + màn hình đạn (nghiêng về phía người chơi)
  addChild(gun, meshNode("box", { pos: [0, 0.125, 0.02], scale: [0.09, 0.09, 0.16], color: DARK }));
  addChild(gun, meshNode("plane", {
    pos: [0, 0.128, 0.105],
    rot: [-0.18, 0, 0],
    scale: [0.078, 0.056, 1],
    color: [1, 1, 1],
    tex: ammoTex,
    emissive: 1,
  }));
  // Sọc neon tím dọc thân + chấm magenta
  addChild(gun, meshNode("box", { pos: [0.046, 0.01, -0.1], scale: [0.006, 0.02, 0.34], color: VIOLET, emissive: 1 }));
  addChild(gun, meshNode("box", { pos: [-0.046, 0.01, -0.1], scale: [0.006, 0.02, 0.34], color: VIOLET, emissive: 1 }));
  addChild(gun, meshNode("box", { pos: [0.043, -0.045, 0.08], scale: [0.008, 0.008, 0.1], color: MAGENTA, emissive: 1 }));

  // Chớp lửa đầu nòng (additive, bật tắt theo muzzleT)
  const flash = addChild(gun, meshNode("box", {
    pos: [0, 0.015, -0.64],
    scale: [0.16, 0.16, 0.1],
    color: hex("#ffd9a0"),
    emissive: 1,
    opacity: 0,
    additive: true,
  }));

  /* ---------- API ---------- */

  function tryFire() {
    if (reloading > 0 || cooldown > 0) return null;
    if (mag <= 0) {
      cooldown = 0.22;
      audio.play("empty");
      startReload(); // tự thay đạn khi hết băng
      return null;
    }
    mag -= 1;
    cooldown = FIRE_INTERVAL;
    recoilKick = 1;
    muzzleT = 0.05;
    audio.play("shoot");
    refreshAmmoUi();
    // Độ tản đạn: ngắm chuẩn hơn nhiều
    const spread = adsBlend > 0.6 ? 0.0035 : 0.014;
    return { spread, recoil: adsBlend > 0.6 ? 0.011 : 0.02 };
  }

  function startReload() {
    if (reloading > 0 || mag === MAG_SIZE || reserve <= 0) return false;
    reloading = RELOAD_TIME;
    audio.play("reload");
    return true;
  }

  function addReserve(amount) {
    reserve = Math.min(RESERVE_MAX, reserve + amount);
    refreshAmmoUi();
  }

  function reset() {
    mag = MAG_SIZE;
    reserve = RESERVE_START;
    cooldown = 0;
    reloading = 0;
    adsBlend = 0;
    refreshAmmoUi();
  }

  function update(dt, { adsHeld, moveSpeed, lookDx, lookDy, reducedMotion }) {
    cooldown = Math.max(0, cooldown - dt);
    muzzleT = Math.max(0, muzzleT - dt);
    recoilKick = Math.max(0, recoilKick - dt * 7);

    if (reloading > 0) {
      reloading -= dt;
      if (reloading <= 0) {
        const need = MAG_SIZE - mag;
        const take = Math.min(need, reserve);
        mag += take;
        reserve -= take;
        reloading = 0;
        refreshAmmoUi();
      }
    }

    const adsTarget = adsHeld && reloading <= 0 ? 1 : 0;
    adsBlend += (adsTarget - adsBlend) * Math.min(1, dt * 10);

    // Sway theo chuyển động chuột + bob theo bước chân
    const swayTargetX = Math.max(-1, Math.min(1, -lookDx * 0.06));
    const swayTargetY = Math.max(-1, Math.min(1, lookDy * 0.06));
    swayX += (swayTargetX - swayX) * Math.min(1, dt * 8);
    swayY += (swayTargetY - swayY) * Math.min(1, dt * 8);
    if (!reducedMotion && moveSpeed > 0.5) bobPhase += dt * (5 + moveSpeed);

    const bobX = Math.sin(bobPhase) * 0.006 * (1 - adsBlend);
    const bobY = Math.abs(Math.cos(bobPhase)) * 0.006 * (1 - adsBlend);

    const reloadDip = reloading > 0 ? Math.sin(Math.min(1, (RELOAD_TIME - reloading) / RELOAD_TIME) * Math.PI) : 0;

    gun.pos[0] = HIP.x + (ADS.x - HIP.x) * adsBlend + swayX * 0.012 + bobX;
    gun.pos[1] = HIP.y + (ADS.y - HIP.y) * adsBlend + swayY * 0.012 - bobY - reloadDip * 0.14;
    gun.pos[2] = HIP.z + (ADS.z - HIP.z) * adsBlend + recoilKick * 0.045;
    gun.rot[0] = swayY * 0.03 + recoilKick * 0.06 - reloadDip * 0.7;
    gun.rot[1] = swayX * 0.04;
    gun.rot[2] = swayX * 0.02;

    flash.mesh.opacity = muzzleT > 0 ? 0.85 : 0;
    if (muzzleT > 0) {
      flash.rot[2] = Math.random() * Math.PI;
      const s = 0.1 + Math.random() * 0.1;
      flash.scale[0] = s;
      flash.scale[1] = s;
    }
    magNode.visible = reloading <= 0 || reloading < RELOAD_TIME * 0.45;
    muzzleTip.mesh.emissive = 0.6 + recoilKick * 0.4;
  }

  return {
    viewmodel: root,
    tryFire,
    startReload,
    addReserve,
    reset,
    update,
    get mag() { return mag; },
    get reserve() { return reserve; },
    get reloading() { return reloading > 0; },
    get adsBlend() { return adsBlend; },
    set onAmmoChange(fn) { onAmmoChange = fn; },
  };
}

exports.createWeapon = createWeapon;
};
__defs["games/strike/bots.js"] = function (exports, __req) {
/**
 * bots.js — bot địch của 404 Strike.
 *
 * Tạo hình theo Asset Sheet: robot 1.8m giáp tối, visor tam giác đỏ
 * phát sáng, sọc ngực tím, marker cảnh báo đỏ lơ lửng trên đầu.
 * State machine (theo plan): SPAWN → PATROL → CHASE → ATTACK → DEAD.
 * Tuần tra theo vòng waypoint của Level Map; đuổi khi thấy người chơi
 * (khoảng cách + góc nhìn + line-of-sight); tấn công theo loạt 3 viên
 * có telegraph (visor lóe sáng). Hitbox đầu/thân tách riêng (headshot).
 * Object pooling — không dựng lại model khi respawn.
 */

const { createNode, addChild, meshNode, hex, rayAABB } = __req("games/strike/engine.js");
const { clamp, randRange } = __req("core/utils.js");

const MAX_BOTS = 10;

const DIFFICULTY = {
  easy:   { hp: 45, patrol: 2.0, chase: 3.1, dmg: [3, 6],  hitBase: 0.32, burstCd: 2.0 },
  normal: { hp: 60, patrol: 2.2, chase: 3.8, dmg: [5, 9],  hitBase: 0.46, burstCd: 1.5 },
  hard:   { hp: 85, patrol: 2.5, chase: 4.5, dmg: [7, 11], hitBase: 0.6,  burstCd: 1.1 },
};

/* Hitbox local (bot đứng ở gốc, hướng +Z) */
const HEAD_BOX = { min: [-0.18, 1.42, -0.18], max: [0.18, 1.8, 0.18] };
const BODY_BOX = { min: [-0.42, 0, -0.28], max: [0.42, 1.42, 0.28] };

const DETECT_DIST = 20;
const ATTACK_DIST = 14.5;
const CHASE_GIVEUP_LOS = 1.6; // giây mất dấu thì quay lại đuổi theo vị trí cũ

function createBots(sceneRoot, world, audio, fx, { onPlayerHit, onKilled, reducedMotion } = {}) {
  const slots = [];

  /* ---------- Dựng model bot (1 lần / slot) ---------- */

  function collectParts(node, list) {
    if (node.mesh) {
      list.push({ node, baseEmissive: node.mesh.emissive || 0 });
    }
    for (const c of node.children) collectParts(c, list);
  }

  function buildBot() {
    const DARK_A = "#161c3a";
    const DARK_B = "#10142c";

    const root = createNode();
    root.visible = false;

    // Bóng đổ blob
    const blob = meshNode("plane", {
      pos: [0, 0.02, 0],
      rot: [-Math.PI / 2, 0, 0],
      scale: [1.5, 1.5, 1],
      color: [1, 1, 1],
      opacity: 0.75,
      tex: world.texBlob,
    });
    addChild(root, blob);

    // Toàn bộ thân (để scale khi spawn / đổ khi chết)
    const trunk = createNode();
    addChild(root, trunk);

    const legL = addChild(trunk, meshNode("box", { pos: [-0.17, 0.31, 0], scale: [0.24, 0.62, 0.28], color: hex(DARK_B) }));
    const legR = addChild(trunk, meshNode("box", { pos: [0.17, 0.31, 0], scale: [0.24, 0.62, 0.28], color: hex(DARK_B) }));
    addChild(trunk, meshNode("box", { pos: [0, 0.72, 0], scale: [0.56, 0.22, 0.36], color: hex(DARK_A) }));
    addChild(trunk, meshNode("box", { pos: [0, 1.09, 0], scale: [0.7, 0.55, 0.44], color: hex(DARK_A) }));
    // Sọc ngực tím + đèn bụng
    addChild(trunk, meshNode("box", { pos: [0, 1.13, 0.225], scale: [0.4, 0.08, 0.02], color: hex("#9a5cff"), emissive: 1 }));
    addChild(trunk, meshNode("box", { pos: [0, 0.9, 0.19], scale: [0.1, 0.06, 0.02], color: hex("#20e3ff"), emissive: 0.8 }));
    // Vai
    addChild(trunk, meshNode("box", { pos: [-0.5, 1.32, 0], scale: [0.26, 0.2, 0.32], color: hex(DARK_B) }));
    addChild(trunk, meshNode("box", { pos: [0.5, 1.32, 0], scale: [0.26, 0.2, 0.32], color: hex(DARK_B) }));
    const armL = addChild(trunk, meshNode("box", { pos: [-0.5, 1.0, 0.06], scale: [0.16, 0.46, 0.2], color: hex(DARK_A) }));
    const armR = addChild(trunk, meshNode("box", { pos: [0.5, 1.0, 0.06], scale: [0.16, 0.46, 0.2], color: hex(DARK_A) }));
    // Súng cầm tay phải, chĩa về +Z
    addChild(trunk, meshNode("box", { pos: [0.34, 1.02, 0.32], scale: [0.12, 0.13, 0.5], color: hex(DARK_B) }));
    const gunTip = addChild(trunk, meshNode("box", { pos: [0.34, 1.04, 0.6], scale: [0.06, 0.06, 0.06], color: hex("#ff4fd8"), emissive: 1 }));
    // Đầu + visor tam giác đỏ (asset sheet) + dải cyan
    addChild(trunk, meshNode("box", { pos: [0, 1.62, 0], scale: [0.34, 0.32, 0.34], color: hex(DARK_A) }));
    const visor = addChild(trunk, meshNode("tri", { pos: [0, 1.62, 0.18], scale: [0.2, 0.17, 1], color: hex("#ff4f64"), emissive: 1 }));
    addChild(trunk, meshNode("box", { pos: [0, 1.75, 0.17], scale: [0.3, 0.03, 0.02], color: hex("#20e3ff"), emissive: 0.8 }));

    // Marker cảnh báo đỏ trên đầu (billboard)
    const marker = addChild(root, meshNode("tri", { pos: [0, 2.32, 0], scale: [0.5, 0.5, 1], color: hex("#ff4f64"), emissive: 1, opacity: 0.9 }));

    const parts = [];
    collectParts(trunk, parts);

    addChild(sceneRoot, root);

    return {
      root, trunk, marker, legL, legR, armL, armR, gunTip, visor, parts, blob,
      alive: false, state: "FREE",
      hp: 0, diff: DIFFICULTY.normal,
      waypoints: [], wpIdx: 0,
      yaw: 0, legPhase: 0,
      losTimer: 0, hasLos: false, loseLos: 0,
      telegraphT: 0, burstLeft: 0, burstTimer: 0, fireCd: 0,
      spawnT: 0, deadT: 0, flashT: 0,
    };
  }

  function getFreeSlot() {
    for (const s of slots) if (s.state === "FREE") return s;
    if (slots.length < MAX_BOTS) {
      const s = buildBot();
      slots.push(s);
      return s;
    }
    return null;
  }

  /* ---------- Tiện ích ---------- */

  const pos = (bot) => bot.root.pos;

  function setOpacity(bot, k) {
    for (const p of bot.parts) p.node.mesh.opacity = k;
    bot.blob.mesh.opacity = 0.75 * k;
  }

  function nearestWpIndex(bot) {
    let best = 0;
    let bd = Infinity;
    bot.waypoints.forEach(([x, z], i) => {
      const d = (pos(bot)[0] - x) ** 2 + (pos(bot)[2] - z) ** 2;
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }

  /** Kiểm tra đường nhìn từ bot tới điểm target (chặn bởi collider tĩnh). */
  function hasLineOfSight(bot, target) {
    const o = [pos(bot)[0], pos(bot)[1] + 1.55, pos(bot)[2]];
    const dx = target[0] - o[0];
    const dy = target[1] - o[1];
    const dz = target[2] - o[2];
    const dist = Math.hypot(dx, dy, dz);
    if (dist < 0.5) return true;
    const dir = [dx / dist, dy / dist, dz / dist];
    for (const c of world.colliders) {
      const t = rayAABB(o, dir, c);
      if (t !== null && t < dist - 0.5) return false;
    }
    return true;
  }

  /** Di chuyển có né vật cản: thử hướng thẳng rồi xoay dần hai bên. */
  function steer(bot, tx, tz, speed, dt) {
    const px = pos(bot)[0];
    const pz = pos(bot)[2];
    const dx = tx - px;
    const dz = tz - pz;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.05) return;
    const baseAngle = Math.atan2(dx, dz);

    let moveAngle = baseAngle;
    const probeOrigin = [px, pos(bot)[1] + 0.8, pz];
    for (const offset of [0, 0.7, -0.7, 1.3, -1.3]) {
      const a = baseAngle + offset;
      const dir = [Math.sin(a), 0, Math.cos(a)];
      let blocked = false;
      for (const c of world.colliders) {
        const t = rayAABB(probeOrigin, dir, c);
        if (t !== null && t < 1.4) { blocked = true; break; }
      }
      if (!blocked) { moveAngle = a; break; }
    }

    pos(bot)[0] += Math.sin(moveAngle) * speed * dt;
    pos(bot)[2] += Math.cos(moveAngle) * speed * dt;

    // Tách các bot khỏi nhau
    for (const other of slots) {
      if (other === bot || !other.alive) continue;
      const ox = pos(bot)[0] - pos(other)[0];
      const oz = pos(bot)[2] - pos(other)[2];
      const d2 = ox * ox + oz * oz;
      if (d2 > 0 && d2 < 1.3) {
        const d = Math.sqrt(d2);
        pos(bot)[0] += (ox / d) * 0.8 * dt;
        pos(bot)[2] += (oz / d) * 0.8 * dt;
      }
    }

    world.resolveMove(pos(bot), 0.55, 1.8);
    pos(bot)[1] = world.groundHeightAt(pos(bot)[0], pos(bot)[2]);

    // Xoay mượt về hướng di chuyển
    let da = moveAngle - bot.yaw;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    bot.yaw += da * Math.min(1, dt * 8);
    bot.root.rot[1] = bot.yaw;

    bot.legPhase += dt * speed * 2.6;
  }

  function faceTarget(bot, tx, tz, dt) {
    const a = Math.atan2(tx - pos(bot)[0], tz - pos(bot)[2]);
    let da = a - bot.yaw;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    bot.yaw += da * Math.min(1, dt * 10);
    bot.root.rot[1] = bot.yaw;
  }

  function gunTipWorld(bot) {
    const cy = Math.cos(bot.yaw);
    const sy = Math.sin(bot.yaw);
    const lx = 0.34;
    const ly = 1.04;
    const lz = 0.6;
    return [
      pos(bot)[0] + lx * cy + lz * sy,
      pos(bot)[1] + ly,
      pos(bot)[2] - lx * sy + lz * cy,
    ];
  }

  /* ---------- Public: spawn / sát thương / raycast ---------- */

  function spawn(gate, diffKey, loopOverride = null) {
    const bot = getFreeSlot();
    if (!bot) return null;
    bot.diff = DIFFICULTY[diffKey] || DIFFICULTY.normal;
    bot.hp = bot.diff.hp;
    bot.state = "SPAWN";
    bot.alive = true;
    bot.spawnT = 0.55;
    bot.flashT = 0;
    bot.deadT = 0;
    bot.fireCd = randRange(0.4, 1.2);
    bot.waypoints = world.patrols[loopOverride || gate.loop] || world.patrols.court;
    pos(bot)[0] = gate.pos[0];
    pos(bot)[1] = 0;
    pos(bot)[2] = gate.pos[2];
    bot.yaw = gate.side < 0 ? Math.PI / 2 : -Math.PI / 2; // quay vào arena
    bot.root.rot[1] = bot.yaw;
    bot.wpIdx = nearestWpIndex(bot);
    bot.trunk.rot[0] = 0;
    bot.trunk.pos[1] = 0;
    bot.trunk.scale[1] = 0.05;
    bot.marker.visible = true;
    setOpacity(bot, 1);
    bot.root.visible = true;
    fx.burst(gate.pos, "#ff4fd8", 8);
    return bot;
  }

  function damage(bot, amount, isHead) {
    if (!bot.alive || bot.state === "DEAD") return false;
    bot.hp -= amount;
    bot.flashT = 0.12;
    if (bot.hp <= 0) {
      bot.state = "DEAD";
      bot.deadT = 1.3;
      bot.marker.visible = false;
      audio.play("kill");
      fx.burst([pos(bot)[0], pos(bot)[1] + 1.1, pos(bot)[2]], isHead ? "#ffd23f" : "#9a5cff", 14);
      onKilled?.(bot, isHead);
      return true;
    }
    // Trúng đạn → lập tức đuổi người chơi
    if (bot.state === "PATROL") bot.state = "CHASE";
    return false;
  }

  /** Ray từ súng người chơi → bot gần nhất bị trúng. */
  function raycast(origin, dir) {
    let best = null;
    for (const bot of slots) {
      if (!bot.alive || bot.state === "DEAD" || bot.state === "SPAWN") continue;
      const cy = Math.cos(-bot.yaw);
      const sy = Math.sin(-bot.yaw);
      const ox = origin[0] - pos(bot)[0];
      const oz = origin[2] - pos(bot)[2];
      const lo = [ox * cy + oz * sy, origin[1] - pos(bot)[1], -ox * sy + oz * cy];
      const ld = [dir[0] * cy + dir[2] * sy, dir[1], -dir[0] * sy + dir[2] * cy];

      const tHead = rayAABB(lo, ld, HEAD_BOX);
      const tBody = rayAABB(lo, ld, BODY_BOX);
      let t = null;
      let isHead = false;
      if (tHead !== null && (tBody === null || tHead <= tBody)) { t = tHead; isHead = true; }
      else if (tBody !== null) t = tBody;
      if (t !== null && (!best || t < best.t)) best = { bot, t, isHead };
    }
    return best;
  }

  /** Người chơi nổ súng → bot trong bán kính nghe thấy và lao tới. */
  function aggro(center, radius = 26) {
    for (const bot of slots) {
      if (!bot.alive || bot.state !== "PATROL") continue;
      const d = Math.hypot(pos(bot)[0] - center[0], pos(bot)[2] - center[2]);
      if (d < radius) bot.state = "CHASE";
    }
  }

  function aliveCount() {
    let n = 0;
    for (const bot of slots) if (bot.alive) n++;
    return n;
  }

  function clearAll() {
    for (const bot of slots) {
      bot.alive = false;
      bot.state = "FREE";
      bot.root.visible = false;
    }
  }

  /* ---------- Update chính ---------- */

  function update(dt, player, camYawPitch) {
    // player: null (màn hình chờ) hoặc { eye:[x,y,z], pos:[x,y,z], speed }
    for (const bot of slots) {
      if (!bot.alive) continue;

      // Marker billboard quay về phía camera
      if (bot.marker.visible && camYawPitch) {
        const facing = Math.atan2(camYawPitch.camX - pos(bot)[0], camYawPitch.camZ - pos(bot)[2]);
        bot.marker.rot[1] = facing - bot.yaw;
        const pulse = 0.8 + 0.2 * Math.sin(performance.now() / 130);
        bot.marker.scale[0] = 0.5 * pulse;
        bot.marker.scale[1] = 0.5 * pulse;
      }

      // Flash trắng khi trúng đạn
      if (bot.flashT > 0) {
        bot.flashT -= dt;
        const k = bot.flashT > 0 ? 1 : 0;
        for (const p of bot.parts) p.node.mesh.emissive = clamp(p.baseEmissive + k * 0.85, 0, 1);
      }

      switch (bot.state) {
        case "SPAWN": {
          bot.spawnT -= dt;
          const k = 1 - Math.max(0, bot.spawnT) / 0.55;
          bot.trunk.scale[1] = 0.05 + 0.95 * k;
          if (bot.spawnT <= 0) {
            bot.trunk.scale[1] = 1;
            bot.state = "PATROL";
          }
          break;
        }

        case "PATROL": {
          const [wx, wz] = bot.waypoints[bot.wpIdx];
          steer(bot, wx, wz, bot.diff.patrol, dt);
          if (Math.hypot(pos(bot)[0] - wx, pos(bot)[2] - wz) < 1.1) {
            bot.wpIdx = (bot.wpIdx + 1) % bot.waypoints.length;
          }
          // Phát hiện người chơi: khoảng cách + góc nhìn + LOS
          if (player) {
            const d = Math.hypot(player.pos[0] - pos(bot)[0], player.pos[2] - pos(bot)[2]);
            if (d < DETECT_DIST) {
              const angTo = Math.atan2(player.pos[0] - pos(bot)[0], player.pos[2] - pos(bot)[2]);
              let da = angTo - bot.yaw;
              while (da > Math.PI) da -= Math.PI * 2;
              while (da < -Math.PI) da += Math.PI * 2;
              bot.losTimer -= dt;
              if (Math.abs(da) < 1.25 && bot.losTimer <= 0) {
                bot.losTimer = 0.2;
                if (hasLineOfSight(bot, player.eye)) bot.state = "CHASE";
              }
            }
          }
          break;
        }

        case "CHASE": {
          if (!player) { bot.state = "PATROL"; break; }
          const d = Math.hypot(player.pos[0] - pos(bot)[0], player.pos[2] - pos(bot)[2]);
          steer(bot, player.pos[0], player.pos[2], bot.diff.chase, dt);
          bot.losTimer -= dt;
          if (bot.losTimer <= 0) {
            bot.losTimer = 0.18;
            bot.hasLos = hasLineOfSight(bot, player.eye);
          }
          if (d < ATTACK_DIST && bot.hasLos) {
            bot.state = "ATTACK";
            bot.telegraphT = 0.35;
            bot.loseLos = 0;
          }
          break;
        }

        case "ATTACK": {
          if (!player) { bot.state = "PATROL"; break; }
          const d = Math.hypot(player.pos[0] - pos(bot)[0], player.pos[2] - pos(bot)[2]);
          faceTarget(bot, player.pos[0], player.pos[2], dt);

          bot.losTimer -= dt;
          if (bot.losTimer <= 0) {
            bot.losTimer = 0.18;
            bot.hasLos = hasLineOfSight(bot, player.eye);
          }
          if (!bot.hasLos || d > ATTACK_DIST + 3.5) {
            bot.loseLos += dt;
            if (bot.loseLos > CHASE_GIVEUP_LOS) { bot.state = "CHASE"; break; }
          } else {
            bot.loseLos = 0;
          }

          // Telegraph: visor lóe sáng trước khi bắn (người chơi kịp né)
          if (bot.telegraphT > 0) {
            bot.telegraphT -= dt;
            const blink = Math.sin(performance.now() / 40) > 0 ? 1 : 0.4;
            bot.visor.mesh.emissive = blink;
            bot.visor.scale[0] = 0.2 + 0.06 * blink;
            if (bot.telegraphT <= 0) {
              bot.burstLeft = 3;
              bot.burstTimer = 0;
              bot.visor.scale[0] = 0.2;
            }
          } else if (bot.burstLeft > 0) {
            bot.burstTimer -= dt;
            if (bot.burstTimer <= 0) {
              bot.burstTimer = 0.1;
              bot.burstLeft -= 1;
              fireAtPlayer(bot, player, d);
            }
          } else {
            bot.fireCd -= dt;
            if (bot.fireCd <= 0) {
              bot.fireCd = bot.diff.burstCd * randRange(0.85, 1.2);
              bot.telegraphT = 0.35;
            }
          }
          break;
        }

        case "DEAD": {
          bot.deadT -= dt;
          const k = clamp(1 - bot.deadT / 1.3, 0, 1);
          // Đổ ngửa rồi tan biến
          bot.trunk.rot[0] = (-Math.PI / 2) * Math.min(1, k * 2.4);
          if (k > 0.45) setOpacity(bot, clamp(1 - (k - 0.45) / 0.5, 0, 1));
          if (bot.deadT <= 0) {
            bot.alive = false;
            bot.state = "FREE";
            bot.root.visible = false;
          }
          break;
        }
      }

      // Animation chân/tay theo trạng thái di chuyển
      if (bot.state === "PATROL" || bot.state === "CHASE") {
        const swing = Math.sin(bot.legPhase) * (bot.state === "CHASE" ? 0.72 : 0.45);
        bot.legL.rot[0] = swing;
        bot.legR.rot[0] = -swing;
        bot.armL.rot[0] = -swing * 0.7;
        bot.armR.rot[0] = swing * 0.7;
      } else if (bot.state === "ATTACK") {
        bot.legL.rot[0] = 0;
        bot.legR.rot[0] = 0;
        bot.armR.rot[0] = -0.5; // giơ súng
        bot.armL.rot[0] = -0.25;
      }
    }
  }

  function fireAtPlayer(bot, player, dist) {
    audio.play("botshot");
    const tip = gunTipWorld(bot);
    // Xác suất trúng giảm theo khoảng cách và khi người chơi di chuyển nhanh
    const distFactor = clamp(1.15 - dist / 22, 0.35, 1);
    const moveFactor = player.speed > 3 ? 0.72 : 1;
    const chance = bot.diff.hitBase * distFactor * moveFactor;

    if (Math.random() < chance) {
      const target = [
        player.eye[0] + randRange(-0.1, 0.1),
        player.eye[1] + randRange(-0.15, 0.05),
        player.eye[2] + randRange(-0.1, 0.1),
      ];
      fx.tracer(tip, target, "#ff7d8a");
      const dmg = Math.round(randRange(bot.diff.dmg[0], bot.diff.dmg[1]));
      onPlayerHit?.(dmg, pos(bot));
    } else {
      // Bắn trượt: đạn sượt qua bên cạnh
      const target = [
        player.eye[0] + randRange(-1.6, 1.6),
        player.eye[1] + randRange(-0.9, 0.7),
        player.eye[2] + randRange(-1.6, 1.6),
      ];
      fx.tracer(tip, target, "#ff7d8a");
    }
  }

  return { spawn, damage, raycast, aggro, aliveCount, clearAll, update, slots };
}

exports.createBots = createBots; exports.DIFFICULTY = DIFFICULTY;
};
__defs["games/strike/fx.js"] = function (exports, __req) {
/**
 * fx.js — hiệu ứng tức thời: tracer đạn, tia lửa va chạm, vòng nổ.
 * Dùng object pooling — không tạo geometry/material mới trong frame.
 */

const { createNode, addChild, meshNode, hex } = __req("games/strike/engine.js");

const TRACER_POOL = 24;
const SPARK_POOL = 90;

function createFx(sceneRoot, { reducedMotion = false } = {}) {
  const root = createNode();
  addChild(sceneRoot, root);

  /* ---- Tracer: hộp mảnh kéo dài từ A đến B ---- */
  const tracers = [];
  for (let i = 0; i < TRACER_POOL; i++) {
    const n = meshNode("box", {
      color: hex("#ffe9b0"),
      emissive: 1,
      opacity: 0,
      additive: true,
      scale: [0.03, 0.03, 1],
    });
    n.visible = false;
    addChild(root, n);
    tracers.push({ node: n, t: 0, life: 0.07 });
  }
  let tracerIdx = 0;

  function tracer(from, to, color = "#ffe9b0") {
    const slot = tracers[tracerIdx];
    tracerIdx = (tracerIdx + 1) % TRACER_POOL;
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const dz = to[2] - from[2];
    const len = Math.hypot(dx, dy, dz);
    if (len < 0.05) return;
    const n = slot.node;
    n.pos[0] = (from[0] + to[0]) / 2;
    n.pos[1] = (from[1] + to[1]) / 2;
    n.pos[2] = (from[2] + to[2]) / 2;
    // Hộp mặc định dọc trục Z → xoay theo hướng đạn
    n.rot[1] = Math.atan2(dx, dz);
    n.rot[0] = -Math.asin(dy / len);
    n.scale[2] = len;
    n.mesh.color = hex(color);
    n.mesh.opacity = 0.8;
    n.visible = true;
    slot.t = slot.life;
  }

  /* ---- Tia lửa: hạt vuông nhỏ bắn tóe ---- */
  const sparks = [];
  for (let i = 0; i < SPARK_POOL; i++) {
    const n = meshNode("box", {
      color: hex("#20e3ff"),
      emissive: 1,
      opacity: 0,
      additive: true,
      scale: [0.05, 0.05, 0.05],
    });
    n.visible = false;
    addChild(root, n);
    sparks.push({ node: n, vx: 0, vy: 0, vz: 0, t: 0, life: 0.32 });
  }
  let sparkIdx = 0;

  function burst(pos, color = "#20e3ff", count = 10) {
    const total = reducedMotion ? Math.ceil(count / 2) : count;
    for (let i = 0; i < total; i++) {
      const s = sparks[sparkIdx];
      sparkIdx = (sparkIdx + 1) % SPARK_POOL;
      const a = Math.random() * Math.PI * 2;
      const up = Math.random() * 3 + 1;
      const sp = 2 + Math.random() * 3.4;
      s.node.pos[0] = pos[0];
      s.node.pos[1] = pos[1];
      s.node.pos[2] = pos[2];
      s.vx = Math.cos(a) * sp;
      s.vz = Math.sin(a) * sp;
      s.vy = up;
      s.node.mesh.color = hex(color);
      s.node.mesh.opacity = 0.95;
      s.node.visible = true;
      s.t = s.life * (0.6 + Math.random() * 0.4);
    }
  }

  function update(dt) {
    for (const tr of tracers) {
      if (tr.t <= 0) continue;
      tr.t -= dt;
      tr.node.mesh.opacity = Math.max(0, (tr.t / tr.life) * 0.8);
      if (tr.t <= 0) tr.node.visible = false;
    }
    for (const s of sparks) {
      if (s.t <= 0) continue;
      s.t -= dt;
      s.vy -= 12 * dt;
      s.node.pos[0] += s.vx * dt;
      s.node.pos[1] += s.vy * dt;
      s.node.pos[2] += s.vz * dt;
      s.node.mesh.opacity = Math.max(0, (s.t / s.life) * 0.95);
      if (s.t <= 0) s.node.visible = false;
    }
  }

  return { tracer, burst, update };
}

exports.createFx = createFx;
};
__defs["games/strike/pickups.js"] = function (exports, __req) {
/**
 * pickups.js — vật phẩm hồi máu (thùng chữ thập tím) và đạn (thùng
 * vạch vàng cảnh báo) theo Asset Sheet. Xoay + nhấp nhô tại các điểm
 * cố định trên map, nhặt bằng cách chạy tới gần, hồi sinh sau 20 giây.
 */

const { createNode, addChild, meshNode, hex } = __req("games/strike/engine.js");

const RESPAWN = 20;
const PICK_RADIUS = 1.35;

function createPickups(sceneRoot, world, audio, fx) {
  const items = [];

  function buildCrate(type) {
    const g = createNode();
    const body = meshNode("box", {
      pos: [0, 0, 0],
      scale: [0.72, 0.72, 0.72],
      color: hex("#151b38"),
    });
    addChild(g, body);
    if (type === "health") {
      // Chữ thập tím phát sáng (asset sheet: HỒI MÁU)
      addChild(g, meshNode("box", { pos: [0, 0, 0.37], scale: [0.4, 0.13, 0.03], color: hex("#b07bff"), emissive: 1 }));
      addChild(g, meshNode("box", { pos: [0, 0, 0.37], scale: [0.13, 0.4, 0.03], color: hex("#b07bff"), emissive: 1 }));
      addChild(g, meshNode("box", { pos: [0, 0.37, 0], scale: [0.4, 0.03, 0.13], color: hex("#b07bff"), emissive: 1 }));
      addChild(g, meshNode("box", { pos: [0, 0.37, 0], scale: [0.13, 0.03, 0.4], color: hex("#b07bff"), emissive: 1 }));
    } else {
      // Vạch vàng + viền cảnh báo (asset sheet: ĐẠN)
      addChild(g, meshNode("box", { pos: [0, 0, 0.37], scale: [0.44, 0.14, 0.03], color: hex("#ffd23f"), emissive: 0.9 }));
      addChild(g, meshNode("box", { pos: [0, 0.2, 0.37], scale: [0.3, 0.07, 0.03], color: hex("#ffd23f"), emissive: 0.6 }));
      addChild(g, meshNode("box", { pos: [0, 0.37, 0], scale: [0.44, 0.03, 0.14], color: hex("#ffd23f"), emissive: 0.9 }));
    }
    // Vòng sáng dưới chân
    addChild(g, meshNode("plane", {
      pos: [0, -0.45, 0],
      rot: [-Math.PI / 2, 0, 0],
      scale: [1.5, 1.5, 1],
      color: hex(type === "health" ? "#9a5cff" : "#ffd23f"),
      emissive: 1,
      opacity: 0.18,
      additive: true,
    }));
    addChild(sceneRoot, g);
    return g;
  }

  for (const [x, z] of world.pickupSpots.health) {
    items.push({ type: "health", node: buildCrate("health"), x, z, active: true, timer: 0, phase: Math.random() * 6 });
  }
  for (const [x, z] of world.pickupSpots.ammo) {
    items.push({ type: "ammo", node: buildCrate("ammo"), x, z, active: true, timer: 0, phase: Math.random() * 6 });
  }

  function reset() {
    for (const it of items) {
      it.active = true;
      it.timer = 0;
      it.node.visible = true;
    }
  }

  /** Trả về danh sách vật phẩm vừa nhặt trong frame này. */
  function update(dt, playerPos) {
    const picked = [];
    for (const it of items) {
      if (!it.active) {
        it.timer -= dt;
        if (it.timer <= 0) {
          it.active = true;
          it.node.visible = true;
          fx.burst([it.x, 0.8, it.z], it.type === "health" ? "#9a5cff" : "#ffd23f", 6);
        }
        continue;
      }
      it.phase += dt * 2;
      it.node.pos[0] = it.x;
      it.node.pos[2] = it.z;
      it.node.pos[1] = 0.85 + Math.sin(it.phase) * 0.12;
      it.node.rot[1] += dt * 1.6;

      if (playerPos) {
        const d = Math.hypot(playerPos[0] - it.x, playerPos[2] - it.z);
        if (d < PICK_RADIUS) {
          it.active = false;
          it.timer = RESPAWN;
          it.node.visible = false;
          audio.play("pickup");
          fx.burst([it.x, 1, it.z], it.type === "health" ? "#b07bff" : "#ffd23f", 10);
          picked.push(it.type);
        }
      }
    }
    return picked;
  }

  return { update, reset };
}

exports.createPickups = createPickups;
};
__defs["games/strike/hud.js"] = function (exports, __req) {
/**
 * hud.js — HUD trong trận theo Gameplay reference:
 * trên-trái: chip "404 STRIKE" + nút pause/sound · trên-giữa: WAVE + đồng
 * hồ · trên-phải: ĐIỂM + COMBO + badge HEADSHOT · dưới-trái: HP + thanh
 * ô · dưới-phải: số đạn + icon viên đạn · giữa: tâm ngắm + hitmarker,
 * vignette sát thương, banner wave, toast nhặt đồ.
 */

const { el, svgIcon, formatScore, formatTime } = __req("core/utils.js");

function createStrikeHud(rootEl, { onPause, onToggleSound, soundOn }) {
  const hud = el("div", "sk-hud");
  hud.hidden = true;

  /* --- Trên trái --- */
  const tl = el("div", "sk-tl");
  const chip = el("div", "sk-cut sk-chip");
  chip.appendChild(el("div", "sk-cut-in", "404 STRIKE"));
  const btnPause = el("button", "sk-iconbtn clickable");
  btnPause.type = "button";
  btnPause.setAttribute("aria-label", "Tạm dừng");
  btnPause.appendChild(svgIcon("i-pause"));
  btnPause.addEventListener("click", () => onPause());
  const btnSound = el("button", "sk-iconbtn clickable");
  btnSound.type = "button";
  btnSound.setAttribute("aria-label", "Bật hoặc tắt âm thanh");
  btnSound.appendChild(svgIcon(soundOn() ? "i-sound-on" : "i-sound-off"));
  btnSound.addEventListener("click", () => {
    onToggleSound();
    btnSound.querySelector("use")?.setAttribute("href", soundOn() ? "#i-sound-on" : "#i-sound-off");
  });
  tl.append(chip, btnPause, btnSound);

  /* --- Trên giữa: wave + timer --- */
  const timerBox = el("div", "sk-timer");
  const timerCut = el("div", "sk-cut");
  const timerIn = el("div", "sk-cut-in");
  const waveLabel = el("div", "sk-wave-label", "WAVE 01");
  const timeVal = el("div", "sk-time", "01:30");
  timerIn.append(waveLabel, timeVal);
  timerCut.appendChild(timerIn);
  timerBox.appendChild(timerCut);

  /* --- Trên phải: điểm + combo + headshot --- */
  const tr = el("div", "sk-tr");
  const scoreBox = el("div", "sk-cut sk-score-box");
  const scoreIn = el("div", "sk-cut-in");
  const row1 = el("div", "sk-score-row");
  row1.append(el("span", "lbl", "ĐIỂM"), (() => el("span", "sk-score-val", "000000"))());
  const scoreVal = row1.querySelector(".sk-score-val");
  const row2 = el("div", "sk-score-row");
  row2.append(el("span", "lbl", "COMBO"), el("span", "sk-combo-val", "×1"));
  const comboVal = row2.querySelector(".sk-combo-val");
  scoreIn.append(row1, row2);
  scoreBox.appendChild(scoreIn);
  const headshotBadge = el("div", "sk-headshot", "HEADSHOT");
  tr.append(scoreBox, headshotBadge);

  /* --- Dưới trái: HP --- */
  const bl = el("div", "sk-bl sk-cut");
  const blIn = el("div", "sk-cut-in");
  const hpRow = el("div", "sk-hp-row");
  hpRow.append(el("span", "lbl", "HP"), el("span", "sk-hp-val", "100"));
  const hpVal = hpRow.querySelector(".sk-hp-val");
  const segs = el("div", "sk-hp-segs");
  segs.appendChild(el("span", "sk-hp-plus", "+"));
  const segEls = [];
  for (let i = 0; i < 10; i++) {
    const s = el("i");
    segs.appendChild(s);
    segEls.push(s);
  }
  blIn.append(hpRow, segs);
  bl.appendChild(blIn);

  /* --- Dưới phải: đạn --- */
  const br = el("div", "sk-br sk-cut");
  const brIn = el("div", "sk-cut-in sk-ammo-in");
  const magEl = el("span", "sk-ammo-mag", "30");
  const reserveEl = el("span", "sk-ammo-reserve", "/ 120");
  const bullets = el("span", "sk-bullets");
  for (let i = 0; i < 3; i++) bullets.appendChild(svgIcon("i-bullet"));
  brIn.append(magEl, reserveEl, bullets);
  br.appendChild(brIn);
  const reloadTip = el("div", "sk-reload-tip", "R — THAY ĐẠN");
  reloadTip.hidden = true;
  br.appendChild(reloadTip);

  /* --- Giữa: tâm ngắm + hitmarker --- */
  const cross = el("div", "sk-cross");
  for (const c of ["n", "s", "w", "e", "dot"]) cross.appendChild(el("i", c));
  const hitmark = el("div", "sk-hitmark");
  for (const c of ["a", "b", "c", "d"]) hitmark.appendChild(el("i", c));

  /* --- Hiệu ứng toàn màn --- */
  const vignette = el("div", "sk-vignette");
  const lowhp = el("div", "sk-lowhp");
  const banner = el("div", "sk-banner", "WAVE 01");
  const toasts = el("div", "sk-toasts");

  hud.append(vignette, lowhp, tl, timerBox, tr, bl, br, cross, hitmark, banner, toasts);
  rootEl.appendChild(hud);

  let vignetteT = null;
  let hitT = null;
  let headshotT = null;

  return {
    el: hud,

    show(on) {
      hud.hidden = !on;
    },

    dim(on) {
      hud.classList.toggle("dim", on);
    },

    setWave(n) {
      waveLabel.textContent = `WAVE ${String(n).padStart(2, "0")}`;
    },

    setTime(seconds) {
      timeVal.textContent = formatTime(seconds);
      timerBox.classList.toggle("warn", seconds <= 30 && seconds > 10);
      timerBox.classList.toggle("danger", seconds <= 10);
    },

    setScore(score) {
      scoreVal.textContent = formatScore(score);
    },

    setCombo(combo) {
      comboVal.textContent = `×${Math.max(1, combo)}`;
    },

    setHp(hp) {
      hpVal.textContent = String(Math.max(0, Math.round(hp)));
      const filled = Math.ceil((hp / 100) * 10);
      segEls.forEach((s, i) => {
        s.className = i < filled ? (i >= 7 ? "on vio" : "on") : "";
      });
      bl.classList.toggle("low", hp <= 25);
      lowhp.classList.toggle("on", hp <= 25 && hp > 0);
    },

    setAmmo(mag, reserve) {
      magEl.textContent = String(mag);
      magEl.classList.toggle("low", mag <= 5);
      reserveEl.textContent = `/ ${reserve}`;
      reloadTip.hidden = !(mag <= 5 && reserve > 0);
    },

    setCrosshair(spreadPx, visible = true) {
      cross.style.setProperty("--gap", `${Math.round(6 + spreadPx)}px`);
      cross.style.opacity = visible ? "1" : "0";
    },

    hitmarker(isHead) {
      hitmark.classList.remove("show", "head");
      void hitmark.offsetWidth;
      if (isHead) hitmark.classList.add("head");
      hitmark.classList.add("show");
      clearTimeout(hitT);
      hitT = setTimeout(() => hitmark.classList.remove("show"), 240);
    },

    showHeadshot() {
      headshotBadge.classList.add("show");
      clearTimeout(headshotT);
      headshotT = setTimeout(() => headshotBadge.classList.remove("show"), 1300);
    },

    damageFlash() {
      vignette.style.opacity = "1";
      clearTimeout(vignetteT);
      vignetteT = setTimeout(() => {
        vignette.style.opacity = "0";
      }, 160);
    },

    waveBanner(n) {
      banner.textContent = `WAVE ${String(n).padStart(2, "0")}`;
      banner.classList.remove("show");
      void banner.offsetWidth;
      banner.classList.add("show");
    },

    toast(text) {
      const t = el("div", "sk-toast", text);
      toasts.appendChild(t);
      setTimeout(() => t.remove(), 1700);
    },

    destroy() {
      clearTimeout(vignetteT);
      clearTimeout(hitT);
      clearTimeout(headshotT);
      hud.remove();
    },
  };
}

exports.createStrikeHud = createStrikeHud;
};
__defs["games/strike/screens.js"] = function (exports, __req) {
/**
 * screens.js — các màn hình của 404 Strike theo reference:
 *  - Start: logo pixel, mục tiêu, ĐỘ KHÓ (Dễ/Thường/Khó), CHẤT LƯỢNG,
 *    nút VÀO TRẬN, ĐỔI GAME / VỀ TRANG CHỦ + panel ĐIỀU KHIỂN.
 *  - Pause: TẠM DỪNG (Tiếp tục / Chơi lại / Cài đặt / Đổi game / Về trang
 *    chủ) + CÀI ĐẶT (âm lượng, độ nhạy chuột, chất lượng, rung màn hình).
 *  - Kết thúc trận: điểm + vòng nguyệt quế, KỶ LỤC MỚI, 4 thẻ chỉ số,
 *    thanh TIẾN TRÌNH ĐIỂM, Chơi lại / Đổi game / Về trang chủ.
 *  - Notice: "Tối ưu cho máy tính" (mobile) / WebGL không khả dụng.
 * Mọi nút và điều khiển đều hoạt động thật.
 */

const { el, svgIcon, formatNumber } = __req("core/utils.js");
const { renderStrikeLogo } = __req("core/pixel-text.js");

const QUALITY_OPTIONS = [
  ["auto", "Tự động"],
  ["low", "Thấp"],
  ["medium", "Trung bình"],
  ["high", "Cao"],
];

const DIFF_OPTIONS = [
  ["easy", "Dễ"],
  ["normal", "Thường"],
  ["hard", "Khó"],
];

function createScreens(rootEl, { settings, actions }) {
  // actions: { enterMatch, resume, restart, switchGame, goHome,
  //            applySettings(partial) }
  const layer = el("div");
  rootEl.appendChild(layer);
  let currentScreen = null;

  function clear() {
    layer.textContent = "";
    currentScreen = null;
  }

  function screen(name) {
    clear();
    const s = el("div", "sk-screen");
    s.dataset.screen = name;
    layer.appendChild(s);
    currentScreen = name;
    return s;
  }

  function actionBtn(label, iconId, accent, onClick) {
    const b = el("button", "btn", label);
    b.type = "button";
    if (accent) b.dataset.accent = accent;
    if (iconId) b.prepend(svgIcon(iconId));
    b.addEventListener("click", (e) => {
      if (e.detail > 0) b.blur();
      onClick();
    });
    return b;
  }

  /* ------------------------- START ------------------------- */

  function showStart() {
    const s = screen("start");
    const grid = el("div", "sk-start");

    /* Cột trái */
    const left = el("div");
    const logo = el("div", "sk-logo");
    renderStrikeLogo(logo);
    left.appendChild(logo);

    const objective = el("div", "sk-objective");
    objective.appendChild(svgIcon("i-target"));
    const objTxt = el("div", "txt");
    objTxt.appendChild(el("strong", "", "SỐNG SÓT QUA"));
    objTxt.appendChild(el("span", "", "CÁC ĐỢT TẤN CÔNG"));
    objective.appendChild(objTxt);
    left.appendChild(objective);

    // Độ khó
    const diffField = el("div", "sk-field");
    diffField.appendChild(el("div", "sk-field-label", "ĐỘ KHÓ"));
    const seg = el("div", "sk-seg");
    seg.setAttribute("role", "group");
    seg.setAttribute("aria-label", "Độ khó");
    for (const [value, label] of DIFF_OPTIONS) {
      const b = el("button", value === settings.difficulty ? "active" : "", label);
      b.type = "button";
      b.addEventListener("click", () => {
        settings.difficulty = value;
        actions.applySettings({ difficulty: value });
        seg.querySelectorAll("button").forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
      });
      seg.appendChild(b);
    }
    diffField.appendChild(seg);
    left.appendChild(diffField);

    // Chất lượng
    const qField = el("div", "sk-field");
    qField.appendChild(el("div", "sk-field-label", "CHẤT LƯỢNG"));
    const selWrap = el("div", "sk-select");
    selWrap.appendChild(svgIcon("i-restart", "icon"));
    const sel = document.createElement("select");
    sel.setAttribute("aria-label", "Chất lượng đồ họa");
    for (const [value, label] of QUALITY_OPTIONS) {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = label;
      if (value === settings.quality) opt.selected = true;
      sel.appendChild(opt);
    }
    sel.addEventListener("change", () => {
      settings.quality = sel.value;
      actions.applySettings({ quality: sel.value });
    });
    selWrap.appendChild(sel);
    qField.appendChild(selWrap);
    left.appendChild(qField);

    // VÀO TRẬN
    const cta = el("button", "sk-cta");
    cta.type = "button";
    cta.appendChild(el("span", "in", "VÀO TRẬN"));
    cta.addEventListener("click", () => actions.enterMatch());
    left.appendChild(cta);

    const acts = el("div", "sk-start-actions");
    acts.appendChild(actionBtn("Đổi game", "i-gamepad", "cyan", actions.switchGame));
    acts.appendChild(actionBtn("Về trang chủ", "i-home", "cyan", actions.goHome));
    left.appendChild(acts);

    /* Cột phải: điều khiển */
    const panel = el("aside", "sk-ctl-panel");
    panel.appendChild(el("h3", "", "ĐIỀU KHIỂN"));
    const rows = [
      { keys: ["W", "A", "S", "D"], title: "Di chuyển", desc: "" },
      { mouse: "i-mouse", title: "Chuột", desc: "Quan sát" },
      { mouse: "i-mouse-left", title: "Click trái", desc: "Bắn" },
      { mouse: "i-mouse-right", title: "Click phải", desc: "Ngắm" },
      { keys: ["R"], title: "R", desc: "Thay đạn" },
      { keys: ["SPACE"], title: "Space", desc: "Nhảy" },
      { keys: ["SHIFT"], title: "Shift", desc: "Chạy" },
      { keys: ["ESC"], title: "Esc", desc: "Tạm dừng" },
    ];
    for (const row of rows) {
      const r = el("div", "sk-ctl-row");
      const keys = el("div", "sk-ctl-keys");
      if (row.keys) for (const k of row.keys) keys.appendChild(el("kbd", "", k));
      if (row.mouse) keys.appendChild(svgIcon(row.mouse, `icon${row.mouse !== "i-mouse" ? " mono-violet" : ""}`));
      const desc = el("div", "desc");
      desc.appendChild(el("b", "", row.title));
      if (row.desc) desc.appendChild(document.createTextNode(row.desc));
      r.append(keys, desc);
      panel.appendChild(r);
    }

    grid.append(left, panel);
    s.appendChild(grid);
    requestAnimationFrame(() => cta.focus());
  }

  /* ------------------------- PAUSE ------------------------- */

  function sliderRow(labelText, iconId, value, min, max, onInput) {
    const set = el("div", "sk-set");
    const lbl = el("div", "lbl");
    lbl.appendChild(svgIcon(iconId));
    lbl.appendChild(el("span", "", labelText));
    set.appendChild(lbl);
    const row = el("div", "sk-slider-row");
    const range = document.createElement("input");
    range.type = "range";
    range.className = "sk-range";
    range.min = String(min);
    range.max = String(max);
    range.value = String(value);
    range.setAttribute("aria-label", labelText);
    const val = el("span", "val", String(value));
    const paint = () => {
      const pct = ((Number(range.value) - min) / (max - min)) * 100;
      range.style.setProperty("--fill", `${pct}%`);
      val.textContent = range.value;
    };
    paint();
    range.addEventListener("input", () => {
      paint();
      onInput(Number(range.value));
    });
    row.append(range, val);
    set.appendChild(row);
    return set;
  }

  function showPause() {
    const s = screen("pause");
    const panel = el("div", "sk-pause-panel");

    /* Cột trái: menu */
    const menuCol = el("div");
    menuCol.appendChild(el("h2", "sk-panel-title", "TẠM DỪNG"));
    const menu = el("div", "sk-menu");
    const mkBtn = (label, cls, fn) => {
      const b = el("button", `sk-menu-btn${cls ? ` ${cls}` : ""}`, label);
      b.type = "button";
      b.addEventListener("click", fn);
      return b;
    };
    const resumeBtn = mkBtn("TIẾP TỤC", "primary", actions.resume);
    menu.appendChild(resumeBtn);
    menu.appendChild(mkBtn("CHƠI LẠI", "", actions.restart));
    const settingsCol = el("div", "sk-settings");
    menu.appendChild(
      mkBtn("CÀI ĐẶT", "", () => {
        settingsCol.scrollIntoView({ block: "nearest", behavior: "smooth" });
        settingsCol.animate(
          [{ outline: "2px solid var(--cyan)", outlineOffset: "6px" }, { outline: "2px solid transparent" }],
          { duration: 900 }
        );
      })
    );
    menu.appendChild(mkBtn("ĐỔI GAME", "", actions.switchGame));
    menu.appendChild(mkBtn("VỀ TRANG CHỦ", "", actions.goHome));
    menuCol.appendChild(menu);

    /* Cột phải: cài đặt */
    settingsCol.appendChild(el("h3", "", "CÀI ĐẶT"));
    settingsCol.appendChild(
      sliderRow("ÂM LƯỢNG", "i-sound-on", settings.volume, 0, 100, (v) => {
        settings.volume = v;
        actions.applySettings({ volume: v });
      })
    );
    settingsCol.appendChild(
      sliderRow("ĐỘ NHẠY CHUỘT", "i-target", settings.sensitivity, 10, 100, (v) => {
        settings.sensitivity = v;
        actions.applySettings({ sensitivity: v });
      })
    );

    // Chất lượng LOW/MEDIUM/HIGH
    const qSet = el("div", "sk-set");
    const qLbl = el("div", "lbl");
    qLbl.appendChild(el("span", "", "CHẤT LƯỢNG"));
    qSet.appendChild(qLbl);
    const qSeg = el("div", "sk-seg");
    for (const [value, label] of [["low", "LOW"], ["medium", "MEDIUM"], ["high", "HIGH"]]) {
      const b = el("button", value === settings.quality ? "active" : "", label);
      b.type = "button";
      b.addEventListener("click", () => {
        settings.quality = value;
        actions.applySettings({ quality: value });
        qSeg.querySelectorAll("button").forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
      });
      qSeg.appendChild(b);
    }
    qSet.appendChild(qSeg);
    settingsCol.appendChild(qSet);

    // Rung màn hình
    const shakeSet = el("div", "sk-set");
    const shakeLbl = el("div", "lbl");
    shakeLbl.appendChild(el("span", "", "RUNG MÀN HÌNH"));
    shakeSet.appendChild(shakeLbl);
    const sw = el("button", `sk-switch${settings.shake ? " on" : ""}`);
    sw.type = "button";
    sw.setAttribute("role", "switch");
    sw.setAttribute("aria-checked", settings.shake ? "true" : "false");
    sw.appendChild(el("span", "track"));
    sw.appendChild(el("span", "state", settings.shake ? "ON" : "OFF"));
    sw.addEventListener("click", () => {
      settings.shake = !settings.shake;
      sw.classList.toggle("on", settings.shake);
      sw.setAttribute("aria-checked", settings.shake ? "true" : "false");
      sw.querySelector(".state").textContent = settings.shake ? "ON" : "OFF";
      actions.applySettings({ shake: settings.shake });
    });
    shakeSet.appendChild(sw);
    settingsCol.appendChild(shakeSet);

    panel.append(menuCol, settingsCol);
    s.appendChild(panel);
    requestAnimationFrame(() => resumeBtn.focus());
  }

  /* ---------------------- KẾT THÚC TRẬN ---------------------- */

  function showOver({ score, saved, kills, headshots, accuracy, wave }) {
    const s = screen("over");
    const panel = el("div", "sk-over-panel");

    panel.appendChild(el("div", "sk-over-head", "KẾT THÚC TRẬN"));

    const line = el("div", "sk-score-line");
    line.appendChild(svgIcon("i-laurel-l", "sk-laurel"));
    const mid = el("div", "sk-final-score");
    mid.appendChild(el("div", "lbl2", "ĐIỂM"));
    mid.appendChild(el("div", "num", formatNumber(score)));
    if (saved.isRecord) mid.appendChild(el("span", "sk-record", "KỶ LỤC MỚI"));
    line.appendChild(mid);
    line.appendChild(svgIcon("i-laurel-l", "sk-laurel flip"));
    panel.appendChild(line);

    const grid = el("div", "sk-statgrid");
    const statCard = (iconId, label, value, cls = "") => {
      const c = el("div", `sk-statcard${cls ? ` ${cls}` : ""}`);
      c.appendChild(svgIcon(iconId));
      c.appendChild(el("div", "lbl", label));
      c.appendChild(el("div", "val", value));
      return c;
    };
    grid.appendChild(statCard("i-skull", "BOT ĐÃ HẠ", String(kills)));
    grid.appendChild(statCard("i-target", "HEADSHOT", String(headshots)));
    grid.appendChild(statCard("i-crosshair", "ĐỘ CHÍNH XÁC", `${accuracy}%`, "cyan"));
    grid.appendChild(statCard("i-chevrons", "WAVE CAO NHẤT", String(wave).padStart(2, "0"), "gold"));
    panel.appendChild(grid);

    /* Thanh tiến trình điểm với mốc kỷ lục */
    const prog = el("div", "sk-progress");
    prog.appendChild(el("div", "lbl", "TIẾN TRÌNH ĐIỂM"));
    const wrap = el("div", "sk-track-wrap");
    const track = el("div", "sk-track");
    const axisMax = Math.max(15000, Math.ceil(Math.max(saved.best, score) / 5000) * 5000);
    const fill = el("div", "fill");
    fill.style.width = "0%";
    track.appendChild(fill);
    if (saved.best > score) {
      const zone = el("div", "best-zone");
      zone.style.width = `${((saved.best - score) / axisMax) * 100}%`;
      track.appendChild(zone);
    }
    const chip = el("div", "sk-score-chip", formatNumber(score));
    chip.style.left = "0%";
    wrap.append(chip, track);
    prog.appendChild(wrap);
    const axis = el("div", "sk-axis");
    for (let i = 0; i <= 3; i++) {
      axis.appendChild(el("span", "", formatNumber((axisMax / 3) * i)));
    }
    prog.appendChild(axis);
    panel.appendChild(prog);

    const acts = el("div", "sk-over-actions");
    acts.appendChild(actionBtn("Chơi lại", "i-restart", "gold", actions.restart));
    acts.appendChild(actionBtn("Đổi game", "i-swap", "violet", actions.switchGame));
    acts.appendChild(actionBtn("Về trang chủ", "i-home", "cyan", actions.goHome));
    panel.appendChild(acts);

    s.appendChild(panel);

    // Animate thanh tiến trình sau khi gắn DOM
    requestAnimationFrame(() => {
      const pct = Math.min(100, (score / axisMax) * 100);
      fill.style.width = `${pct}%`;
      chip.style.left = `${pct}%`;
      acts.querySelector("button")?.focus();
    });
  }

  /* ------------------------- NOTICE ------------------------- */

  function showNotice(kind) {
    const s = screen("notice");
    const box = el("div", "sk-notice");
    box.appendChild(svgIcon(kind === "webgl" ? "i-close" : "i-gamepad"));
    box.appendChild(
      el("h3", "", kind === "webgl" ? "WEBGL KHÔNG KHẢ DỤNG" : "TỐI ƯU CHO MÁY TÍNH")
    );
    box.appendChild(
      el(
        "p",
        "",
        kind === "webgl"
          ? "Trình duyệt của bạn không hỗ trợ WebGL nên không thể chạy 404 Strike. Bốn game 2D vẫn chơi tốt!"
          : "404 Strike cần bàn phím và chuột (WASD + mouse look). Hãy mở trên máy tính, hoặc thử 4 game 2D còn lại nhé!"
      )
    );
    const row = el("div", "btn-row");
    row.appendChild(actionBtn("Đổi game", "i-gamepad", "cyan", actions.switchGame));
    row.appendChild(actionBtn("Về trang chủ", "i-home", "cyan", actions.goHome));
    box.appendChild(row);
    s.appendChild(box);
  }

  return {
    showStart,
    showPause,
    showOver,
    showNotice,
    hideAll: clear,
    get current() {
      return currentScreen;
    },
    destroy() {
      layer.remove();
    },
  };
}

exports.createScreens = createScreens;
};
__defs["core/pixel-text.js"] = function (exports, __req) {
/**
 * pixel-text.js — vẽ chữ pixel bằng SVG (không cần font ngoài).
 * Dùng cho logo "404 ARCADE" (home) và "404 STRIKE" (start screen FPS).
 * Mỗi ký tự là lưới 5×7 render thành các ô <rect> với gradient neon.
 */

const NS = "http://www.w3.org/2000/svg";

/* Font pixel 5×7 — chỉ định nghĩa các ký tự cần dùng */
const GLYPHS = {
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
};

const CHAR_W = 5;
const CHAR_H = 7;
const GAP = 1;

const textWidth = (text) => text.length * CHAR_W + (text.length - 1) * GAP;

function addLine(group, text, offsetX, offsetY, scale) {
  let cursorX = 0;
  for (const ch of text) {
    const glyph = GLYPHS[ch];
    if (!glyph) {
      cursorX += CHAR_W + GAP;
      continue;
    }
    for (let row = 0; row < CHAR_H; row++) {
      for (let col = 0; col < CHAR_W; col++) {
        if (glyph[row][col] !== "1") continue;
        const rect = document.createElementNS(NS, "rect");
        rect.setAttribute("x", (offsetX + (cursorX + col) * scale).toFixed(3));
        rect.setAttribute("y", (offsetY + row * scale).toFixed(3));
        rect.setAttribute("width", (scale * 0.92).toFixed(3));
        rect.setAttribute("height", (scale * 0.92).toFixed(3));
        group.appendChild(rect);
      }
    }
    cursorX += CHAR_W + GAP;
  }
}

function gradient(defs, id, stops) {
  const grad = document.createElementNS(NS, "linearGradient");
  grad.setAttribute("id", id);
  grad.setAttribute("x1", "0");
  grad.setAttribute("y1", "0");
  grad.setAttribute("x2", "1");
  grad.setAttribute("y2", "0");
  for (const [offset, color] of stops) {
    const stop = document.createElementNS(NS, "stop");
    stop.setAttribute("offset", offset);
    stop.setAttribute("stop-color", color);
    grad.appendChild(stop);
  }
  defs.appendChild(grad);
}

/**
 * Render logo pixel nhiều dòng vào container.
 * lines: [{ text, scale, fill: [[offset,color],...] | 'mầu đơn' }]
 */
function renderPixelLogo(container, lines, ariaLabel) {
  const widths = lines.map((l) => textWidth(l.text) * l.scale);
  const totalW = Math.max(...widths);
  const lineGap = 1.5;
  let totalH = 0;
  for (const l of lines) totalH += CHAR_H * l.scale;
  totalH += lineGap * (lines.length - 1);

  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${totalW.toFixed(2)} ${totalH.toFixed(2)}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", ariaLabel);

  const defs = document.createElementNS(NS, "defs");
  svg.appendChild(defs);

  let y = 0;
  lines.forEach((line, i) => {
    const g = document.createElementNS(NS, "g");
    if (Array.isArray(line.fill)) {
      const id = `pxg-${ariaLabel.replace(/\W+/g, "")}-${i}`;
      gradient(defs, id, line.fill);
      g.setAttribute("fill", `url(#${id})`);
    } else {
      g.setAttribute("fill", line.fill);
    }
    // Căn giữa theo chiều ngang bằng offset khi vẽ rect
    addLine(g, line.text, (totalW - widths[i]) / 2, y, line.scale);
    svg.appendChild(g);
    y += CHAR_H * line.scale + lineGap;
  });

  container.textContent = "";
  container.appendChild(svg);
  return svg;
}

/** Logo trang chọn game: "404 / ARCADE". */
function renderArcadeLogo(container) {
  return renderPixelLogo(
    container,
    [
      {
        text: "404",
        scale: 1,
        fill: [
          ["0%", "#20e3ff"],
          ["52%", "#9a5cff"],
          ["100%", "#ff4fd8"],
        ],
      },
      {
        text: "ARCADE",
        scale: 0.46,
        fill: [
          ["0%", "#ff4fd8"],
          ["100%", "#ff8a5c"],
        ],
      },
    ],
    "404 Arcade"
  );
}

/** Logo 404 Strike: "404" tím + "STRIKE" trắng-cyan. */
function renderStrikeLogo(container) {
  return renderPixelLogo(
    container,
    [
      {
        text: "404",
        scale: 1,
        fill: [
          ["0%", "#9a5cff"],
          ["100%", "#ff4fd8"],
        ],
      },
      {
        text: "STRIKE",
        scale: 0.52,
        fill: [
          ["0%", "#f4f7ff"],
          ["100%", "#20e3ff"],
        ],
      },
    ],
    "404 Strike"
  );
}

exports.renderPixelLogo = renderPixelLogo; exports.renderArcadeLogo = renderArcadeLogo; exports.renderStrikeLogo = renderStrikeLogo;
};
__defs["games/strike/styles.js"] = function (exports, __req) {
/**
 * styles.js — CSS của 404 Strike (inject vào shadow root khi game mount,
 * không nằm trong initial bundle). Bám theo 4 màn hình reference:
 * HUD gameplay, start screen, pause + settings, kết thúc trận.
 */

const STRIKE_CSS = /* css */ `
.sk-root {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--bg-0);
  font-family: var(--font-mono);
  user-select: none;
  -webkit-user-select: none;
}

.sk-root canvas.sk-canvas {
  position: absolute;
  inset: 0;
  cursor: crosshair;
  touch-action: none;
}

/* Khung cắt góc kiểu quân sự: lớp ngoài = viền, lớp trong = nền */
.sk-cut {
  position: relative;
  padding: 1px;
  clip-path: polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px);
  background: color-mix(in srgb, var(--cyan) 55%, transparent);
}

.sk-cut > .sk-cut-in {
  clip-path: polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px);
  background: color-mix(in srgb, var(--bg-0) 86%, transparent);
  padding: 8px 14px;
}

/* ============================ HUD ============================ */

.sk-hud {
  position: absolute;
  inset: 0;
  z-index: 10;
  pointer-events: none;
  transition: opacity 0.25s ease;
}

.sk-hud.dim { opacity: 0.35; }

.sk-hud .clickable { pointer-events: auto; }

/* --- Trên trái: tên game + pause + sound --- */
.sk-tl {
  position: absolute;
  top: 14px;
  left: 14px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.sk-chip .sk-cut-in {
  font-size: 0.82rem;
  font-weight: 800;
  letter-spacing: 0.18em;
  color: var(--text-0);
  padding: 7px 18px;
}

.sk-iconbtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border: 1px solid color-mix(in srgb, var(--cyan) 35%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--bg-0) 78%, transparent);
  color: var(--text-1);
  cursor: pointer;
}

.sk-iconbtn:hover { color: var(--cyan); border-color: var(--cyan); }
.sk-iconbtn .icon { width: 16px; height: 16px; }

/* --- Trên giữa: wave + đồng hồ --- */
.sk-timer {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
  min-width: 200px;
}

.sk-timer .sk-cut { background: color-mix(in srgb, var(--cyan) 45%, transparent); }
.sk-timer .sk-cut-in { padding: 6px 26px 8px; }

.sk-wave-label {
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.34em;
  color: var(--text-1);
}

.sk-time {
  font-size: 1.9rem;
  font-weight: 800;
  line-height: 1.05;
  color: var(--text-0);
  text-shadow: 0 0 18px color-mix(in srgb, var(--cyan) 45%, transparent);
  font-variant-numeric: tabular-nums;
}

.sk-timer.warn .sk-time { color: var(--gold); }
.sk-timer.danger .sk-time { color: var(--red); animation: skBlink 0.5s steps(1) infinite; }

@keyframes skBlink { 50% { opacity: 0.45; } }

/* --- Trên phải: điểm + combo + headshot --- */
.sk-tr {
  position: absolute;
  top: 14px;
  right: 14px;
  text-align: right;
}

.sk-score-box .sk-cut-in { padding: 8px 16px; }

.sk-score-row {
  display: flex;
  justify-content: flex-end;
  align-items: baseline;
  gap: 10px;
}

.sk-score-row .lbl {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.22em;
  color: var(--text-1);
}

.sk-score-val {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--text-0);
  font-variant-numeric: tabular-nums;
}

.sk-combo-val {
  font-size: 1.2rem;
  font-weight: 800;
  color: var(--gold);
  text-shadow: 0 0 14px color-mix(in srgb, var(--gold) 55%, transparent);
}

.sk-headshot {
  display: inline-block;
  margin-top: 8px;
  padding: 3px 14px;
  border: 1px solid var(--gold);
  border-radius: 4px;
  color: var(--gold);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.26em;
  background: color-mix(in srgb, var(--bg-0) 75%, transparent);
  box-shadow: 0 0 16px color-mix(in srgb, var(--gold) 35%, transparent);
  opacity: 0;
  transform: translateY(-4px);
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.sk-headshot.show { opacity: 1; transform: none; }

/* --- Dưới trái: HP --- */
.sk-bl {
  position: absolute;
  left: 14px;
  bottom: 14px;
  min-width: 250px;
}

.sk-hp-row {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.sk-hp-row .lbl {
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.24em;
  color: var(--text-1);
}

.sk-hp-val {
  font-size: 2rem;
  font-weight: 800;
  color: var(--text-0);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.sk-hp-segs {
  display: flex;
  gap: 4px;
  margin-top: 7px;
  align-items: center;
}

.sk-hp-plus {
  width: 18px;
  height: 14px;
  flex: none;
  border-radius: 3px;
  background: color-mix(in srgb, var(--violet) 60%, transparent);
  color: var(--text-0);
  font-size: 11px;
  font-weight: 800;
  line-height: 14px;
  text-align: center;
}

.sk-hp-segs i {
  width: 17px;
  height: 9px;
  background: color-mix(in srgb, var(--text-0) 16%, transparent);
}

.sk-hp-segs i.on { background: var(--text-0); box-shadow: 0 0 8px color-mix(in srgb, var(--text-0) 45%, transparent); }
.sk-hp-segs i.on.vio { background: var(--violet); box-shadow: 0 0 8px color-mix(in srgb, var(--violet) 55%, transparent); }

.sk-bl.low .sk-hp-val { color: var(--red); animation: skBlink 0.6s steps(1) infinite; }

/* --- Dưới phải: đạn --- */
.sk-br {
  position: absolute;
  right: 14px;
  bottom: 14px;
}

.sk-ammo-in {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 18px;
}

.sk-ammo-mag {
  font-size: 1.9rem;
  font-weight: 800;
  color: var(--text-0);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.sk-ammo-mag.low { color: var(--red); }
.sk-ammo-reserve { font-size: 1rem; color: var(--text-1); font-weight: 700; }

.sk-bullets { display: flex; gap: 3px; color: var(--cyan); }
.sk-bullets .icon { width: 9px; height: 20px; }

.sk-reload-tip {
  position: absolute;
  right: 4px;
  bottom: 100%;
  margin-bottom: 8px;
  font-size: 0.68rem;
  letter-spacing: 0.18em;
  color: var(--gold);
  white-space: nowrap;
  animation: skBlink 0.7s steps(1) infinite;
}

/* --- Tâm ngắm + hitmarker --- */
.sk-cross {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  --gap: 7px;
  --len: 9px;
}

.sk-cross i {
  position: absolute;
  background: var(--text-0);
  box-shadow: 0 0 6px rgba(255, 255, 255, 0.55);
}

.sk-cross .n { left: -1px; top: calc(-1 * (var(--gap) + var(--len))); width: 2px; height: var(--len); }
.sk-cross .s { left: -1px; top: var(--gap); width: 2px; height: var(--len); }
.sk-cross .w { top: -1px; left: calc(-1 * (var(--gap) + var(--len))); height: 2px; width: var(--len); }
.sk-cross .e { top: -1px; left: var(--gap); height: 2px; width: var(--len); }
.sk-cross .dot { left: -1.5px; top: -1.5px; width: 3px; height: 3px; border-radius: 50%; }

.sk-hitmark {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  opacity: 0;
}

.sk-hitmark i {
  position: absolute;
  width: 2px;
  height: 9px;
  background: var(--text-0);
}

.sk-hitmark .a { transform: translate(-7px, -12px) rotate(-45deg); }
.sk-hitmark .b { transform: translate(5px, -12px) rotate(45deg); }
.sk-hitmark .c { transform: translate(-7px, 3px) rotate(45deg); }
.sk-hitmark .d { transform: translate(5px, 3px) rotate(-45deg); }

.sk-hitmark.show { animation: skHit 0.22s ease; }
.sk-hitmark.head i { background: var(--gold); box-shadow: 0 0 8px var(--gold); }

@keyframes skHit {
  0% { opacity: 1; transform: scale(1.25); }
  100% { opacity: 0; transform: scale(0.9); }
}

/* --- Máu / hiệu ứng toàn màn --- */
.sk-vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(ellipse at center, transparent 52%, color-mix(in srgb, var(--red) 55%, transparent) 130%);
  opacity: 0;
  transition: opacity 0.12s ease;
}

.sk-lowhp {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(ellipse at center, transparent 58%, color-mix(in srgb, var(--red) 45%, transparent) 125%);
  opacity: 0;
}

.sk-lowhp.on { animation: skLow 1.1s ease infinite; }

@keyframes skLow {
  0%, 100% { opacity: 0.25; }
  50% { opacity: 0.7; }
}

/* --- Banner wave + toast --- */
.sk-banner {
  position: absolute;
  top: 24%;
  left: 50%;
  transform: translateX(-50%);
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: 0.4em;
  color: var(--cyan);
  text-shadow: 0 0 26px color-mix(in srgb, var(--cyan) 60%, transparent);
  opacity: 0;
  pointer-events: none;
}

.sk-banner.show { animation: skBanner 1.6s ease; }

@keyframes skBanner {
  0% { opacity: 0; transform: translateX(-50%) scale(1.3); }
  18% { opacity: 1; transform: translateX(-50%) scale(1); }
  75% { opacity: 1; }
  100% { opacity: 0; }
}

.sk-toasts {
  position: absolute;
  bottom: 120px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  pointer-events: none;
}

.sk-toast {
  padding: 4px 14px;
  border: 1px solid color-mix(in srgb, var(--lime) 55%, transparent);
  border-radius: 4px;
  background: color-mix(in srgb, var(--bg-0) 82%, transparent);
  color: var(--lime);
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  animation: skToast 1.6s ease forwards;
}

@keyframes skToast {
  0% { opacity: 0; transform: translateY(8px); }
  12% { opacity: 1; transform: none; }
  75% { opacity: 1; }
  100% { opacity: 0; transform: translateY(-10px); }
}

/* ============================ Màn hình ============================ */

.sk-screen {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(14px, 3vw, 40px);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-0) 66%, transparent), color-mix(in srgb, var(--bg-0) 88%, transparent));
  overflow-y: auto;
}

.sk-panel-title {
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--text-0);
}

/* ---- Start screen ---- */
.sk-start {
  display: grid;
  grid-template-columns: minmax(320px, 1.25fr) minmax(280px, 340px);
  gap: clamp(20px, 4vw, 56px);
  width: min(1020px, 100%);
  align-items: center;
}

.sk-logo { width: min(330px, 72%); margin-bottom: 14px; }
.sk-logo svg { width: 100%; filter: drop-shadow(0 0 18px color-mix(in srgb, var(--violet) 45%, transparent)); }

.sk-objective {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 4px 0 18px;
}

.sk-objective .icon { width: 30px; height: 30px; color: var(--violet); flex: none; }

.sk-objective .txt strong {
  display: block;
  color: var(--cyan);
  font-size: 0.85rem;
  letter-spacing: 0.16em;
}

.sk-objective .txt span {
  color: var(--text-0);
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.sk-field { margin-bottom: 16px; }

.sk-field-label {
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.26em;
  color: var(--cyan);
  margin-bottom: 7px;
}

.sk-seg {
  display: inline-flex;
  border: 1px solid color-mix(in srgb, var(--cyan) 40%, transparent);
  border-radius: 6px;
  overflow: hidden;
  background: color-mix(in srgb, var(--bg-0) 80%, transparent);
}

.sk-seg button {
  min-width: 86px;
  min-height: 42px;
  padding: 8px 14px;
  border: none;
  background: transparent;
  color: var(--text-1);
  font-weight: 700;
  font-size: 0.82rem;
  letter-spacing: 0.06em;
  cursor: pointer;
}

.sk-seg button + button { border-left: 1px solid color-mix(in srgb, var(--cyan) 25%, transparent); }
.sk-seg button:hover { color: var(--text-0); }

.sk-seg button.active {
  background: linear-gradient(180deg, var(--violet), color-mix(in srgb, var(--violet) 70%, black));
  color: #fff;
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.6);
  box-shadow: 0 0 16px color-mix(in srgb, var(--violet) 45%, transparent);
}

.sk-select {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  border: 1px solid color-mix(in srgb, var(--cyan) 40%, transparent);
  border-radius: 6px;
  background: color-mix(in srgb, var(--bg-0) 80%, transparent);
  padding: 0 8px 0 12px;
}

.sk-select .icon { width: 15px; height: 15px; color: var(--text-1); }

.sk-select select {
  appearance: none;
  -webkit-appearance: none;
  min-height: 42px;
  min-width: 170px;
  padding-right: 22px;
  border: none;
  background: transparent;
  color: var(--text-0);
  font-weight: 700;
  cursor: pointer;
  outline: none;
}

.sk-select select option { background: #0b1028; color: var(--text-0); }
.sk-select::after { content: "▾"; color: var(--cyan); margin-left: -18px; pointer-events: none; }

.sk-cta {
  display: block;
  width: min(360px, 100%);
  margin: 22px 0 18px;
  padding: 3px;
  border: none;
  cursor: pointer;
  clip-path: polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px);
  background: linear-gradient(120deg, var(--violet), var(--pink));
  box-shadow: 0 0 34px color-mix(in srgb, var(--violet) 55%, transparent);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.sk-cta:hover { transform: translateY(-2px); box-shadow: 0 0 46px color-mix(in srgb, var(--violet) 75%, transparent); }
.sk-cta:active { transform: none; }

.sk-cta .in {
  display: block;
  padding: 15px 20px;
  clip-path: polygon(13px 0, 100% 0, 100% calc(100% - 13px), calc(100% - 13px) 100%, 0 100%, 0 13px);
  background: linear-gradient(180deg, color-mix(in srgb, var(--violet) 80%, black 5%), color-mix(in srgb, var(--violet) 45%, black 40%));
  color: #fff;
  font-size: 1.15rem;
  font-weight: 800;
  letter-spacing: 0.3em;
  text-align: center;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.6);
}

.sk-start-actions { display: flex; flex-wrap: wrap; gap: 10px; }

/* Panel điều khiển bên phải */
.sk-ctl-panel {
  border: 1px solid color-mix(in srgb, var(--cyan) 35%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, var(--bg-0) 82%, transparent);
  padding: 16px 18px;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.sk-ctl-panel h3 {
  text-align: center;
  font-size: 0.82rem;
  font-weight: 800;
  letter-spacing: 0.3em;
  color: var(--cyan);
  margin-bottom: 4px;
  padding-bottom: 10px;
  border-bottom: 1px solid color-mix(in srgb, var(--cyan) 22%, transparent);
}

.sk-ctl-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 9px 0;
}

.sk-ctl-row + .sk-ctl-row { border-top: 1px solid color-mix(in srgb, var(--text-0) 7%, transparent); }
.sk-ctl-keys { display: flex; gap: 4px; min-width: 108px; flex: none; align-items: center; }
.sk-ctl-keys .icon { width: 20px; height: 26px; color: var(--text-0); }
.sk-ctl-keys .icon.mono-violet { color: var(--violet); }
.sk-ctl-row .desc { color: var(--text-1); font-size: 0.8rem; line-height: 1.35; }
.sk-ctl-row .desc b { color: var(--text-0); display: block; font-size: 0.82rem; }

/* ---- Pause ---- */
.sk-pause-panel {
  width: min(780px, 100%);
  border: 1px solid color-mix(in srgb, var(--cyan) 55%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, var(--bg-0) 90%, transparent);
  box-shadow: 0 0 44px color-mix(in srgb, var(--cyan) 18%, transparent), var(--shadow-pop);
  padding: clamp(18px, 3.4vw, 34px);
  display: grid;
  grid-template-columns: 1fr 1.15fr;
  gap: clamp(18px, 3vw, 36px);
  position: relative;
}

.sk-pause-panel::before,
.sk-pause-panel::after {
  content: "";
  position: absolute;
  width: 46px;
  height: 12px;
  border: 2px solid var(--cyan);
}

.sk-pause-panel::before { top: -2px; left: 26px; border-bottom: none; border-right: none; }
.sk-pause-panel::after { bottom: -2px; right: 26px; border-top: none; border-left: none; }

.sk-menu { display: flex; flex-direction: column; gap: 10px; margin-top: 16px; }

.sk-menu-btn {
  min-height: 46px;
  border: 1px solid color-mix(in srgb, var(--cyan) 45%, transparent);
  border-radius: 6px;
  background: color-mix(in srgb, var(--bg-0) 70%, transparent);
  color: var(--text-0);
  font-weight: 800;
  font-size: 0.86rem;
  letter-spacing: 0.22em;
  cursor: pointer;
  transition: all 0.15s ease;
}

.sk-menu-btn:hover {
  border-color: var(--cyan);
  box-shadow: 0 0 14px color-mix(in srgb, var(--cyan) 30%, transparent);
}

.sk-menu-btn.primary {
  background: linear-gradient(180deg, var(--violet), color-mix(in srgb, var(--violet) 55%, black 30%));
  border-color: color-mix(in srgb, var(--violet) 80%, transparent);
  box-shadow: 0 0 18px color-mix(in srgb, var(--violet) 40%, transparent);
}

.sk-settings h3 {
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.28em;
  color: var(--cyan);
  border-bottom: 1px solid color-mix(in srgb, var(--cyan) 25%, transparent);
  padding-bottom: 8px;
  margin-bottom: 14px;
}

.sk-set { margin-bottom: 16px; }

.sk-set .lbl {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.22em;
  color: var(--text-1);
  margin-bottom: 8px;
}

.sk-set .lbl .icon { width: 15px; height: 15px; }

.sk-slider-row { display: flex; align-items: center; gap: 12px; }
.sk-slider-row .val { min-width: 34px; text-align: right; color: var(--text-0); font-weight: 700; font-size: 0.85rem; }

input[type="range"].sk-range {
  flex: 1;
  appearance: none;
  -webkit-appearance: none;
  height: 5px;
  border-radius: 4px;
  background: linear-gradient(90deg, var(--violet) var(--fill, 50%), color-mix(in srgb, var(--text-0) 14%, transparent) var(--fill, 50%));
  outline-offset: 4px;
  cursor: pointer;
}

input[type="range"].sk-range::-webkit-slider-thumb {
  appearance: none;
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #d9c4ff;
  border: 2px solid var(--violet);
  box-shadow: 0 0 10px color-mix(in srgb, var(--violet) 60%, transparent);
}

input[type="range"].sk-range::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #d9c4ff;
  border: 2px solid var(--violet);
}

.sk-switch {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}

.sk-switch .track {
  width: 52px;
  height: 24px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--text-0) 16%, transparent);
  position: relative;
  transition: background 0.18s ease;
}

.sk-switch .track::after {
  content: "";
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.18s ease;
}

.sk-switch.on .track { background: var(--violet); box-shadow: 0 0 12px color-mix(in srgb, var(--violet) 50%, transparent); }
.sk-switch.on .track::after { transform: translateX(28px); }

.sk-switch .state {
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.18em;
  color: var(--text-1);
  min-width: 30px;
}

.sk-switch.on .state { color: var(--text-0); }

/* ---- Kết thúc trận ---- */
.sk-over-panel {
  width: min(760px, 100%);
  border: 1px solid color-mix(in srgb, var(--cyan) 55%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, var(--bg-0) 92%, transparent);
  box-shadow: 0 0 44px color-mix(in srgb, var(--cyan) 16%, transparent), var(--shadow-pop);
  padding: clamp(18px, 3.4vw, 34px);
  text-align: center;
}

.sk-over-head {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  font-size: 1.3rem;
  font-weight: 800;
  letter-spacing: 0.24em;
  color: var(--text-0);
  margin-bottom: 18px;
}

.sk-over-head::before,
.sk-over-head::after {
  content: "‹‹›› ";
  content: "";
  width: 40px;
  height: 2px;
  background: color-mix(in srgb, var(--cyan) 60%, transparent);
}

.sk-score-line {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
}

.sk-laurel { width: 44px; height: 88px; color: var(--violet); opacity: 0.9; }
.sk-laurel.flip { transform: scaleX(-1); }

.sk-final-score .lbl2 {
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.3em;
  color: var(--cyan);
}

.sk-final-score .num {
  font-size: clamp(2.6rem, 7vw, 3.8rem);
  font-weight: 800;
  line-height: 1.05;
  color: var(--text-0);
  text-shadow: 0 0 30px color-mix(in srgb, var(--violet) 55%, transparent);
  font-variant-numeric: tabular-nums;
}

.sk-record {
  display: inline-block;
  margin-top: 6px;
  padding: 4px 16px;
  border: 1px solid var(--gold);
  border-radius: 4px;
  color: var(--gold);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.26em;
  box-shadow: 0 0 18px color-mix(in srgb, var(--gold) 30%, transparent);
  animation: recordPulse 1s ease infinite alternate;
}

.sk-statgrid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin: 22px 0;
}

.sk-statcard {
  border: 1px solid color-mix(in srgb, var(--cyan) 30%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--arcade-panel) 60%, transparent);
  padding: 14px 8px;
}

.sk-statcard .icon { width: 26px; height: 26px; margin: 0 auto 8px; color: var(--violet); }
.sk-statcard.gold .icon { color: var(--gold); }
.sk-statcard.cyan .icon { color: var(--cyan); }

.sk-statcard .lbl {
  font-size: 0.6rem;
  font-weight: 800;
  letter-spacing: 0.2em;
  color: var(--text-2);
}

.sk-statcard .val {
  margin-top: 4px;
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--text-0);
  font-variant-numeric: tabular-nums;
}

.sk-progress { margin: 8px 0 22px; }

.sk-progress .lbl {
  font-size: 0.66rem;
  font-weight: 800;
  letter-spacing: 0.26em;
  color: var(--cyan);
  margin-bottom: 20px;
}

.sk-track-wrap { position: relative; padding-top: 14px; }

.sk-track {
  height: 10px;
  border-radius: 3px;
  background: color-mix(in srgb, var(--text-0) 10%, transparent);
  overflow: hidden;
  display: flex;
}

.sk-track .fill {
  height: 100%;
  background: linear-gradient(90deg, var(--cyan), color-mix(in srgb, var(--cyan) 60%, var(--violet)));
  box-shadow: 0 0 12px color-mix(in srgb, var(--cyan) 55%, transparent);
  transition: width 0.9s cubic-bezier(0.2, 0.8, 0.3, 1);
}

.sk-track .best-zone { height: 100%; background: color-mix(in srgb, var(--violet) 55%, transparent); }

.sk-score-chip {
  position: absolute;
  top: -14px;
  transform: translateX(-50%);
  padding: 2px 10px;
  border: 1px solid var(--gold);
  border-radius: 4px;
  background: color-mix(in srgb, var(--bg-0) 90%, transparent);
  color: var(--gold);
  font-size: 0.7rem;
  font-weight: 800;
  white-space: nowrap;
  transition: left 0.9s cubic-bezier(0.2, 0.8, 0.3, 1);
}

.sk-score-chip::after {
  content: "";
  position: absolute;
  left: 50%;
  top: 100%;
  transform: translateX(-50%);
  border: 5px solid transparent;
  border-top-color: var(--gold);
}

.sk-axis {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  color: var(--text-2);
  font-size: 0.64rem;
  letter-spacing: 0.08em;
}

.sk-over-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; }

/* ---- Notice (mobile / WebGL) ---- */
.sk-notice {
  max-width: 460px;
  text-align: center;
  border: 1px solid color-mix(in srgb, var(--cyan) 40%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, var(--bg-0) 90%, transparent);
  padding: 34px 26px;
}

.sk-notice .icon { width: 44px; height: 44px; margin: 0 auto 14px; color: var(--violet); }
.sk-notice h3 { font-size: 1.05rem; letter-spacing: 0.2em; margin-bottom: 10px; color: var(--text-0); }
.sk-notice p { color: var(--text-1); font-size: 0.86rem; margin-bottom: 20px; }
.sk-notice .btn-row { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; }

/* ---- Responsive ---- */
@media (max-width: 900px) {
  .sk-start { grid-template-columns: 1fr; width: min(560px, 100%); }
  .sk-pause-panel { grid-template-columns: 1fr; }
  .sk-statgrid { grid-template-columns: repeat(2, 1fr); }
  .sk-timer { min-width: 150px; }
  .sk-time { font-size: 1.4rem; }
  .sk-score-val { font-size: 1.15rem; }
  .sk-hp-val { font-size: 1.5rem; }
  .sk-ammo-mag { font-size: 1.5rem; }
  .sk-bl { min-width: 190px; }
}
`;

exports.STRIKE_CSS = STRIKE_CSS;
};
__defs["ui/overlays.js"] = function (exports, __req) {
/**
 * overlays.js — các panel overlay dùng chung cho game 2D:
 * đang tải / lỗi / hướng dẫn / tạm dừng / game over.
 * (404 Strike tự vẽ màn hình riêng theo reference, không dùng file này.)
 */

const { el, formatScore } = __req("core/utils.js");

function createOverlayManager(overlayEl) {
  function show() {
    overlayEl.hidden = false;
    overlayEl.textContent = "";
    const panel = el("div", "stage-panel");
    overlayEl.appendChild(panel);
    return panel;
  }

  function hide() {
    overlayEl.hidden = true;
    overlayEl.textContent = "";
  }

  function focusPrimary(btn) {
    requestAnimationFrame(() => btn.focus());
  }

  /** Nút overlay: blur sau click chuột để Space không kích hoạt lại. */
  function panelBtn(label, onClick, { solid = false } = {}) {
    const btn = el("button", `btn${solid ? " btn-solid" : ""}`, label);
    btn.type = "button";
    btn.addEventListener("click", (e) => {
      if (e.detail > 0) btn.blur();
      onClick();
    });
    return btn;
  }

  return {
    hide,

    showLoading(meta) {
      const panel = show();
      const loader = el("div", "pix-loader");
      for (let i = 0; i < 4; i++) loader.appendChild(el("i"));
      panel.appendChild(loader);
      panel.appendChild(el("h3", "panel-title", "Đang tải"));
      panel.appendChild(el("p", "panel-sub", meta.title));
    },

    showError(meta, { onRetry, onClose }) {
      const panel = show();
      panel.appendChild(el("h3", "panel-title danger", "Không tải được trò chơi"));
      panel.appendChild(el("p", "panel-sub", "Có lỗi khi tải module. Kiểm tra kết nối rồi thử lại."));
      const row = el("div", "btn-row");
      row.style.marginTop = "16px";
      const retry = panelBtn("Thử lại", onRetry, { solid: true });
      row.append(retry, panelBtn("Đóng", onClose));
      panel.appendChild(row);
      focusPrimary(retry);
    },

    showIntro(meta, { onStart }) {
      const panel = show();
      panel.appendChild(el("h3", "panel-title", meta.title));
      panel.appendChild(el("p", "panel-sub", meta.goal));

      const list = el("ul", "controls-list");
      for (const control of meta.controls) {
        const li = el("li");
        for (const key of control.keys) li.appendChild(el("kbd", "", key));
        li.appendChild(el("span", "", control.text));
        list.appendChild(li);
      }
      panel.appendChild(list);

      const tip = el("p", "panel-tip");
      tip.append("Trong game: ", el("kbd", "", "Esc"), " thoát · ", el("kbd", "", "P"), " tạm dừng");
      panel.appendChild(tip);

      const row = el("div", "btn-row");
      const startBtn = panelBtn("Bắt đầu", onStart, { solid: true });
      row.appendChild(startBtn);
      panel.appendChild(row);
      focusPrimary(startBtn);
    },

    showPaused({ onResume, onRestart, onSwitch }) {
      const panel = show();
      panel.appendChild(el("h3", "panel-title", "Tạm dừng"));
      panel.appendChild(el("p", "panel-sub", "Nghỉ chút cũng được, game vẫn chờ bạn ở đây."));
      const row = el("div", "btn-row");
      row.style.marginTop = "16px";
      const resumeBtn = panelBtn("Tiếp tục", onResume, { solid: true });
      row.append(resumeBtn, panelBtn("Chơi lại", onRestart), panelBtn("Đổi game", onSwitch));
      panel.appendChild(row);
      focusPrimary(resumeBtn);
    },

    showGameOver(score, saved, { homeUrl, onRestart, onSwitch, onHome }) {
      const panel = show();
      panel.appendChild(el("h3", "panel-title danger", "Game Over"));

      if (saved.isRecord) {
        panel.appendChild(el("span", "record-badge", "Kỷ lục mới!"));
      }

      const stats = el("div", "over-stats");
      const scoreBox = el("div", "over-stat highlight");
      scoreBox.appendChild(el("span", "hud-label", "Điểm"));
      scoreBox.appendChild(el("strong", "", formatScore(score)));
      const bestBox = el("div", "over-stat");
      bestBox.appendChild(el("span", "hud-label", "Kỷ lục"));
      bestBox.appendChild(el("strong", "", formatScore(saved.best)));
      stats.append(scoreBox, bestBox);
      panel.appendChild(stats);

      const row = el("div", "btn-row");
      const againBtn = panelBtn("Chơi lại", onRestart, { solid: true });
      const switchBtn = panelBtn("Đổi game", onSwitch);
      const homeLink = el("a", "btn", "Về trang chủ");
      homeLink.href = homeUrl;
      homeLink.addEventListener("click", (e) => onHome?.(e));
      row.append(againBtn, switchBtn, homeLink);
      panel.appendChild(row);
      focusPrimary(againBtn);
    },
  };
}

exports.createOverlayManager = createOverlayManager;
};
__defs["ui/arcade-home.js"] = function (exports, __req) {
/**
 * arcade-home.js — dựng trang chọn game bên trong shadow DOM:
 * logo pixel + lưới card (tranh preview, hướng dẫn, điểm, nút Chơi ngay).
 */

const { el } = __req("core/utils.js");
const { renderArcadeLogo } = __req("core/pixel-text.js");
const { paintPreview } = __req("core/previews.js");
const { createCard } = __req("ui/game-card.js");

function buildHome({ refs, games, storage, audio, onPlay }) {
  renderArcadeLogo(refs.logo);

  const cardRefs = new Map();
  refs.grid.textContent = "";

  for (const meta of games) {
    const { card, lastEl, bestEl } = createCard({
      meta,
      scores: storage.getScores(meta.id),
      paintPreview,
      onPlay: (opener) => {
        audio.play("ui");
        onPlay(meta.id, opener);
      },
    });
    refs.grid.appendChild(card);
    cardRefs.set(meta.id, { card, lastEl, bestEl });
  }

  refs.scrollGames?.addEventListener("click", () => {
    refs.grid.scrollIntoView({ block: "start", behavior: "smooth" });
  });

  return {
    cardRefs,
    /** Cập nhật điểm trên card sau mỗi lượt chơi. */
    updateCard(id, saved) {
      const ref = cardRefs.get(id);
      if (!ref) return;
      ref.lastEl.textContent = saved.last.toLocaleString("vi-VN");
      ref.bestEl.textContent = saved.best.toLocaleString("vi-VN");
      ref.card.classList.remove("stat-bump");
      void ref.card.offsetWidth; // ép reflow để chạy lại animation
      ref.card.classList.add("stat-bump");
    },
  };
}

exports.buildHome = buildHome;
};
__defs["core/previews.js"] = function (exports, __req) {
/**
 * previews.js — vẽ tranh minh họa tĩnh cho card game bằng Canvas.
 * Tách riêng khỏi module game để card không phải tải game (lazy-load).
 * Dùng seededRand để hình vẽ ổn định giữa các lần tải trang.
 */

const { seededRand } = __req("core/utils.js");

const W = 320;
const H = 200;

function setup(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  return ctx;
}

function stars(ctx, rand, count, maxY = H) {
  for (let i = 0; i < count; i++) {
    const x = rand() * W;
    const y = rand() * maxY;
    const r = rand() * 1.2 + 0.4;
    ctx.fillStyle = rand() > 0.75 ? "rgba(59,232,255,.8)" : "rgba(237,241,255,.7)";
    ctx.fillRect(x, y, r, r);
  }
}

/* ---------- Endless Runner: thành phố neon về đêm ---------- */
function runnerArt(ctx) {
  const rand = seededRand(41);
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#241150");
  sky.addColorStop(0.62, "#171040");
  sky.addColorStop(1, "#0d0b28");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  stars(ctx, rand, 26, 110);

  // Mặt trời synthwave có sọc
  const sunX = 236;
  const sunY = 74;
  const sunR = 34;
  const sun = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
  sun.addColorStop(0, "#ffd23f");
  sun.addColorStop(1, "#ff58c7");
  ctx.save();
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = sun;
  ctx.fillRect(sunX - sunR, sunY - sunR, sunR * 2, sunR * 2);
  ctx.fillStyle = "#171040";
  for (let i = 0; i < 4; i++) ctx.fillRect(sunX - sunR, sunY + 4 + i * 8, sunR * 2, 3);
  ctx.restore();

  // Hai lớp nhà cao tầng
  const layers = [
    { color: "#1c1548", top: 96, min: 26, max: 62 },
    { color: "#120e35", top: 116, min: 18, max: 46 },
  ];
  for (const layer of layers) {
    let x = -6;
    while (x < W) {
      const bw = 22 + rand() * 34;
      const bh = layer.min + rand() * (layer.max - layer.min);
      ctx.fillStyle = layer.color;
      ctx.fillRect(x, layer.top + (62 - bh), bw, bh + 60);
      // Cửa sổ sáng đèn
      for (let wy = layer.top + 66 - bh; wy < layer.top + 50; wy += 7) {
        for (let wx = x + 3; wx < x + bw - 3; wx += 6) {
          if (rand() > 0.72) {
            ctx.fillStyle = rand() > 0.5 ? "rgba(59,232,255,.5)" : "rgba(255,210,63,.42)";
            ctx.fillRect(wx, wy, 2, 3);
          }
        }
      }
      x += bw + 4 + rand() * 10;
    }
  }

  // Mặt đường neon + lưới phối cảnh
  const groundY = 158;
  ctx.fillStyle = "#0a0820";
  ctx.fillRect(0, groundY, W, H - groundY);
  ctx.strokeStyle = "rgba(59,232,255,.9)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(W, groundY);
  ctx.stroke();
  ctx.strokeStyle = "rgba(59,232,255,.16)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 10; i++) {
    const gx = i * 36 - 8;
    ctx.beginPath();
    ctx.moveTo(gx, groundY);
    ctx.lineTo(gx - 26, H);
    ctx.stroke();
  }

  // Nhân vật robot cyan đang nhảy
  ctx.fillStyle = "#3be8ff";
  ctx.fillRect(64, 118, 22, 26);
  ctx.fillStyle = "#061018";
  ctx.fillRect(68, 124, 12, 6);
  ctx.fillStyle = "#eafcff";
  ctx.fillRect(76, 126, 4, 3);
  ctx.fillStyle = "rgba(59,232,255,.35)";
  ctx.fillRect(52, 132, 8, 4);
  ctx.fillRect(42, 140, 7, 3);

  // Chướng ngại vật gai hồng
  ctx.fillStyle = "#ff58c7";
  for (let i = 0; i < 3; i++) {
    const sx = 176 + i * 17;
    ctx.beginPath();
    ctx.moveTo(sx, groundY);
    ctx.lineTo(sx + 8, groundY - 20);
    ctx.lineTo(sx + 16, groundY);
    ctx.closePath();
    ctx.fill();
  }

  // Tinh thể điểm thưởng
  ctx.save();
  ctx.translate(150, 108);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = "#ffd23f";
  ctx.fillRect(-7, -7, 14, 14);
  ctx.fillStyle = "rgba(255,255,255,.65)";
  ctx.fillRect(-7, -7, 6, 6);
  ctx.restore();
}

/* ---------- Bug Hunter: đàn bọ pixel ---------- */
function bugArt(ctx) {
  const rand = seededRand(77);
  ctx.fillStyle = "#0c1322";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(200,245,66,.07)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 20) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y <= H; y += 20) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  const drawBug = (x, y, color, danger = false, scale = 1) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rand() * Math.PI * 2);
    ctx.scale(scale, scale);
    if (danger) {
      ctx.fillStyle = "rgba(255,93,107,.18)";
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.fill();
    }
    // Chân
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath(); ctx.moveTo(-6, i * 6); ctx.lineTo(-13, i * 8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(6, i * 6); ctx.lineTo(13, i * 8); ctx.stroke();
    }
    // Thân
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 1, 9, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -12, 5.5, 0, Math.PI * 2);
    ctx.fill();
    // Vạch cánh
    ctx.strokeStyle = "rgba(5,7,15,.55)";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(0, 12); ctx.stroke();
    ctx.restore();
  };

  drawBug(64, 62, "#4bf584");
  drawBug(150, 44, "#ffd23f", false, 0.9);
  drawBug(250, 70, "#3be8ff", false, 0.8);
  drawBug(206, 140, "#ff5d6b", true);
  drawBug(96, 148, "#4bf584", false, 1.05);
  drawBug(286, 158, "#ffd23f", false, 0.85);

  // Tâm ngắm
  ctx.strokeStyle = "rgba(200,245,66,.9)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(150, 44, 15, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath(); ctx.moveTo(150, 22); ctx.lineTo(150, 32); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(150, 56); ctx.lineTo(150, 66); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(128, 44); ctx.lineTo(138, 44); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(162, 44); ctx.lineTo(172, 44); ctx.stroke();
}

/* ---------- Stack Tower: tháp khối cầu vồng ---------- */
function stackArt(ctx) {
  const rand = seededRand(9);
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#221046");
  bg.addColorStop(1, "#120b30");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  stars(ctx, rand, 30);

  const cx = W / 2;
  const layers = [
    { w: 150, hue: 265 },
    { w: 132, hue: 220 },
    { w: 118, hue: 180 },
    { w: 104, hue: 130 },
    { w: 92, hue: 60 },
    { w: 80, hue: 20 },
  ];
  const bh = 17;
  let y = 172;

  // Bệ tháp
  ctx.fillStyle = "#0c081f";
  ctx.beginPath();
  ctx.moveTo(cx - 100, 190);
  ctx.lineTo(cx - 78, 172);
  ctx.lineTo(cx + 78, 172);
  ctx.lineTo(cx + 100, 190);
  ctx.closePath();
  ctx.fill();

  for (const layer of layers) {
    y -= bh;
    const jitter = (rand() - 0.5) * 10;
    const x = cx - layer.w / 2 + jitter;
    const color = `hsl(${layer.hue} 85% 60%)`;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, layer.w, bh - 2);
    ctx.fillStyle = "rgba(255,255,255,.28)";
    ctx.fillRect(x, y, layer.w, 4);
    ctx.fillStyle = "rgba(0,0,0,.25)";
    ctx.fillRect(x, y + bh - 6, layer.w, 4);
  }

  // Khối đang lơ lửng chờ thả + đường gióng
  const hover = { w: 74, x: cx - 12, y: y - 46 };
  ctx.strokeStyle = "rgba(176,123,255,.4)";
  ctx.setLineDash([4, 5]);
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(hover.x, hover.y + 15); ctx.lineTo(hover.x, y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(hover.x + hover.w, hover.y + 15); ctx.lineTo(hover.x + hover.w, y); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "hsl(330 90% 62%)";
  ctx.fillRect(hover.x, hover.y, hover.w, 15);
  ctx.fillStyle = "rgba(255,255,255,.35)";
  ctx.fillRect(hover.x, hover.y, hover.w, 4);
  ctx.fillStyle = "rgba(255,88,199,.25)";
  ctx.fillRect(hover.x - 26, hover.y + 4, 18, 7);
}

/* ---------- Snake: rắn neon trên lưới ---------- */
function snakeArt(ctx) {
  ctx.fillStyle = "#081408";
  ctx.fillRect(0, 0, W, H);
  const cell = 20;
  ctx.strokeStyle = "rgba(75,245,132,.09)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += cell) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y <= H; y += cell) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // Thân rắn uốn lượn (tọa độ ô lưới)
  const path = [
    [3, 7], [4, 7], [5, 7], [6, 7], [6, 6], [6, 5], [7, 5], [8, 5],
    [9, 5], [9, 6], [9, 7], [10, 7], [11, 7], [11, 6], [11, 5], [11, 4],
  ];
  path.forEach(([gx, gy], i) => {
    const bright = 0.45 + (i / path.length) * 0.55;
    ctx.fillStyle = `rgba(75,245,132,${bright.toFixed(2)})`;
    const x = gx * cell + 2;
    const y = gy * cell + 2;
    ctx.beginPath();
    ctx.roundRect(x, y, cell - 4, cell - 4, 4);
    ctx.fill();
  });

  // Đầu rắn + mắt
  const [hx, hy] = path[path.length - 1];
  ctx.fillStyle = "#b9ffcb";
  ctx.beginPath();
  ctx.roundRect(hx * cell + 1, hy * cell + 1, cell - 2, cell - 2, 5);
  ctx.fill();
  ctx.fillStyle = "#061018";
  ctx.fillRect(hx * cell + 5, hy * cell + 5, 3, 3);
  ctx.fillRect(hx * cell + 12, hy * cell + 5, 3, 3);

  // Quả táo
  ctx.fillStyle = "#ff5d6b";
  ctx.beginPath();
  ctx.arc(14 * cell + 10, 4 * cell + 11, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#4bf584";
  ctx.fillRect(14 * cell + 9, 4 * cell + 1, 3, 5);
  ctx.fillStyle = "rgba(255,255,255,.6)";
  ctx.fillRect(14 * cell + 6, 4 * cell + 7, 3, 3);

  // Quầng sáng quanh đầu rắn
  const glow = ctx.createRadialGradient(
    hx * cell + 10, hy * cell + 10, 2,
    hx * cell + 10, hy * cell + 10, 44
  );
  glow.addColorStop(0, "rgba(75,245,132,.22)");
  glow.addColorStop(1, "rgba(75,245,132,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(hx * cell - 40, hy * cell - 40, 100, 100);
}

/* ---------- 404 Strike: góc nhìn FPS neon ---------- */
function strikeArt(ctx) {
  const rand = seededRand(404);
  // Nền không gian tối
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0a0f26");
  bg.addColorStop(0.55, "#0d1230");
  bg.addColorStop(1, "#050b1c");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const vpX = W / 2;
  const vpY = 92; // điểm tụ phối cảnh

  // Sàn hành lang
  ctx.fillStyle = "#0e1430";
  ctx.beginPath();
  ctx.moveTo(0, H);
  ctx.lineTo(vpX - 70, vpY + 18);
  ctx.lineTo(vpX + 70, vpY + 18);
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();

  // Tường trái/phải
  ctx.fillStyle = "#101838";
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(0, H);
  ctx.lineTo(vpX - 70, vpY + 18); ctx.lineTo(vpX - 70, vpY - 40);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(W, 0); ctx.lineTo(W, H);
  ctx.lineTo(vpX + 70, vpY + 18); ctx.lineTo(vpX + 70, vpY - 40);
  ctx.closePath(); ctx.fill();

  // Vạch neon sàn hội tụ về điểm tụ
  for (const [x0, color] of [[-10, "rgba(32,227,255,.85)"], [W + 10, "rgba(32,227,255,.85)"], [60, "rgba(154,92,255,.5)"], [W - 60, "rgba(154,92,255,.5)"]]) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(x0, H);
    ctx.lineTo(x0 < W / 2 ? vpX - 56 : vpX + 56, vpY + 20);
    ctx.stroke();
  }

  // Thanh đèn đỏ dọc trên tường
  for (const bx of [34, W - 38]) {
    ctx.fillStyle = "rgba(255,79,100,.9)";
    ctx.fillRect(bx, 34, 4, 56);
    ctx.fillStyle = "rgba(255,79,100,.25)";
    ctx.fillRect(bx - 3, 30, 10, 64);
  }

  // Bảng 404 phát sáng cuối hành lang
  ctx.fillStyle = "#141b3e";
  ctx.fillRect(vpX - 58, vpY - 34, 116, 46);
  ctx.strokeStyle = "rgba(32,227,255,.6)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(vpX - 58, vpY - 34, 116, 46);
  ctx.font = "800 30px monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = "#9a5cff";
  ctx.shadowColor = "#9a5cff";
  ctx.shadowBlur = 14;
  ctx.fillText("404", vpX, vpY);
  ctx.shadowBlur = 0;

  // Bot địch giữa hành lang
  const bx = vpX - 26;
  const by = vpY + 26;
  ctx.fillStyle = "#1b2140";
  ctx.fillRect(bx - 9, by, 18, 22);          // thân
  ctx.fillRect(bx - 12, by + 3, 5, 12);      // tay
  ctx.fillRect(bx + 7, by + 3, 5, 12);
  ctx.fillRect(bx - 7, by + 22, 5, 9);       // chân
  ctx.fillRect(bx + 2, by + 22, 5, 9);
  ctx.fillRect(bx - 6, by - 10, 12, 10);     // đầu
  ctx.fillStyle = "#ff4f64";                  // visor tam giác
  ctx.beginPath();
  ctx.moveTo(bx - 4, by - 8);
  ctx.lineTo(bx + 4, by - 8);
  ctx.lineTo(bx, by - 3);
  ctx.closePath();
  ctx.fill();
  // Marker cảnh báo trên đầu
  ctx.fillStyle = "rgba(255,79,100,.9)";
  ctx.beginPath();
  ctx.moveTo(bx - 5, by - 20);
  ctx.lineTo(bx + 5, by - 20);
  ctx.lineTo(bx, by - 13);
  ctx.closePath();
  ctx.fill();

  // Vật cản crate cyan-trim
  ctx.fillStyle = "#161d3f";
  ctx.fillRect(W - 118, H - 74, 52, 44);
  ctx.strokeStyle = "rgba(32,227,255,.55)";
  ctx.strokeRect(W - 118, H - 74, 52, 44);
  ctx.fillStyle = "rgba(255,210,63,.7)";
  ctx.fillRect(W - 112, H - 44, 40, 5);

  // Súng góc phải dưới (viewmodel)
  ctx.save();
  ctx.translate(W - 44, H + 6);
  ctx.rotate(-0.5);
  ctx.fillStyle = "#171c38";
  ctx.fillRect(-20, -66, 34, 78);
  ctx.fillStyle = "#0c1128";
  ctx.fillRect(-14, -70, 22, 16);
  ctx.fillStyle = "rgba(154,92,255,.95)";
  ctx.fillRect(-17, -46, 4, 30);
  ctx.fillStyle = "rgba(255,79,216,.8)";
  ctx.fillRect(10, -58, 3, 22);
  ctx.restore();

  // Tâm ngắm
  ctx.strokeStyle = "rgba(244,247,255,.95)";
  ctx.lineWidth = 2;
  const cx = vpX;
  const cy = vpY + 40;
  for (const [dx1, dy1, dx2, dy2] of [[-14, 0, -5, 0], [14, 0, 5, 0], [0, -14, 0, -5], [0, 14, 0, 5]]) {
    ctx.beginPath();
    ctx.moveTo(cx + dx1, cy + dy1);
    ctx.lineTo(cx + dx2, cy + dy2);
    ctx.stroke();
  }

  // Vài hạt sao trang trí
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = rand() > 0.6 ? "rgba(32,227,255,.6)" : "rgba(244,247,255,.5)";
    ctx.fillRect(rand() * W, rand() * 60, 1.6, 1.6);
  }
}

const PAINTERS = {
  runner: runnerArt,
  "bug-hunter": bugArt,
  "stack-tower": stackArt,
  snake: snakeArt,
  strike: strikeArt,
};

/** Vẽ preview của một game lên canvas trong card. */
function paintPreview(gameId, canvas) {
  const painter = PAINTERS[gameId];
  if (!painter) return;
  const ctx = setup(canvas);
  painter(ctx);
}

exports.paintPreview = paintPreview;
};
__defs["ui/game-card.js"] = function (exports, __req) {
/**
 * game-card.js — một card game trên trang chọn game.
 * Toàn bộ nội dung động dựng bằng DOM API (không innerHTML).
 */

const { el, formatNumber } = __req("core/utils.js");

function createCard({ meta, scores, paintPreview, onPlay }) {
  const card = el("article", "game-card");
  card.dataset.accent = meta.accent;

  if (meta.badge) {
    card.appendChild(el("span", "card-badge", meta.badge));
  }

  const art = el("div", "card-art");
  const artCanvas = document.createElement("canvas");
  artCanvas.setAttribute("aria-hidden", "true");
  art.appendChild(artCanvas);
  card.appendChild(art);
  paintPreview(meta.id, artCanvas);

  const body = el("div", "card-body");
  body.appendChild(el("h3", "card-title", meta.title));

  const hint = el("p", "card-hint");
  for (const key of meta.hint.keys) hint.appendChild(el("kbd", "", key));
  hint.appendChild(el("span", "", meta.hint.text));
  body.appendChild(hint);

  const stats = el("dl", "card-stats");
  const lastBox = el("div");
  lastBox.appendChild(el("dt", "", "Điểm"));
  const lastEl = el("dd", "", formatNumber(scores.last));
  lastBox.appendChild(lastEl);
  const bestBox = el("div");
  bestBox.appendChild(el("dt", "", "Kỷ lục"));
  const bestEl = el("dd", "", formatNumber(scores.best));
  bestBox.appendChild(bestEl);
  stats.append(lastBox, bestBox);
  body.appendChild(stats);

  const playBtn = el("button", "btn card-play", "Chơi ngay");
  playBtn.type = "button";
  playBtn.setAttribute("aria-label", `Chơi ${meta.title} ngay`);
  playBtn.addEventListener("click", (e) => {
    if (e.detail > 0) playBtn.blur();
    onPlay(playBtn);
  });
  body.appendChild(playBtn);
  card.appendChild(body);

  art.addEventListener("click", () => playBtn.click());

  return { card, lastEl, bestEl };
}

exports.createCard = createCard;
};
window.Arcade404 = __req("index.js");
})();
