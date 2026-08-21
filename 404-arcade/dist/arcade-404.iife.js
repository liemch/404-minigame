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

    /* Expansion 6–10 (Portal Puzzle / Neon Drift / Cyber Defense / Rogue Arena / Rhythm Hack) */
    step:     () => tone({ type: "sine", from: 300, to: 250, dur: 0.045, vol: 0.14 }),
    push:     () => { noise({ dur: 0.09, vol: 0.2, from: 700, to: 180 }); tone({ type: "triangle", from: 140, to: 100, dur: 0.09, vol: 0.22 }); },
    portal:   () => { tone({ type: "sine", from: 320, to: 960, dur: 0.16, vol: 0.26 }); tone({ type: "sine", from: 960, to: 480, dur: 0.14, vol: 0.2, delay: 0.13 }); },
    switch:   () => { tone({ from: 520, dur: 0.05, vol: 0.24 }); tone({ from: 780, dur: 0.07, vol: 0.2, delay: 0.05 }); },
    denied:   () => tone({ type: "square", from: 170, to: 120, dur: 0.09, vol: 0.24 }),
    undo:     () => tone({ type: "sine", from: 620, to: 380, dur: 0.09, vol: 0.2 }),
    win:      () => { tone({ from: 523, dur: 0.09, vol: 0.28 }); tone({ from: 659, dur: 0.09, vol: 0.28, delay: 0.09 }); tone({ from: 784, dur: 0.09, vol: 0.28, delay: 0.18 }); tone({ from: 1047, dur: 0.22, vol: 0.3, delay: 0.27 }); },
    checkpoint: () => { tone({ from: 784, dur: 0.07, vol: 0.26 }); tone({ from: 1175, dur: 0.11, vol: 0.24, delay: 0.06 }); },
    nitro:    () => { noise({ dur: 0.24, vol: 0.2, from: 900, to: 2600 }); tone({ type: "sawtooth", from: 190, to: 420, dur: 0.24, vol: 0.16 }); },
    crash:    () => { noise({ dur: 0.24, vol: 0.42, from: 2000, to: 220 }); tone({ type: "sawtooth", from: 200, to: 70, dur: 0.26, vol: 0.3 }); },
    build:    () => { tone({ from: 340, dur: 0.06, vol: 0.24 }); tone({ from: 510, dur: 0.06, vol: 0.24, delay: 0.06 }); noise({ dur: 0.05, vol: 0.12, from: 1500, to: 500, delay: 0.02 }); },
    upgrade:  () => { tone({ from: 440, dur: 0.06, vol: 0.24 }); tone({ from: 587, dur: 0.06, vol: 0.24, delay: 0.06 }); tone({ from: 880, dur: 0.1, vol: 0.24, delay: 0.12 }); },
    sell:     () => { tone({ from: 660, to: 330, dur: 0.12, vol: 0.22 }); },
    zap:      () => { tone({ type: "square", from: 1150, to: 700, dur: 0.045, vol: 0.13 }); },
    boom:     () => { noise({ dur: 0.3, vol: 0.4, from: 1200, to: 90 }); tone({ type: "sine", from: 130, to: 45, dur: 0.3, vol: 0.34 }); },
    corehit:  () => { tone({ type: "sawtooth", from: 240, to: 90, dur: 0.3, vol: 0.4 }); noise({ dur: 0.2, vol: 0.24, from: 800, to: 150 }); },
    xp:       () => tone({ type: "sine", from: 900, to: 1350, dur: 0.06, vol: 0.14 }),
    hurt2:    () => { tone({ type: "sine", from: 160, to: 90, dur: 0.14, vol: 0.4 }); },
    miss:     () => tone({ type: "triangle", from: 260, to: 150, dur: 0.12, vol: 0.22 }),

    /* Void Runner 404 */
    vr_step:     () => noise({ dur: 0.045, vol: 0.09, from: 900, to: 300 }),
    vr_jump:     () => tone({ type: "sine", from: 280, to: 520, dur: 0.13, vol: 0.26 }),
    vr_walljump: () => { tone({ type: "sine", from: 360, to: 700, dur: 0.12, vol: 0.26 }); noise({ dur: 0.08, vol: 0.12, from: 1600, to: 500 }); },
    vr_land:     () => { noise({ dur: 0.09, vol: 0.2, from: 800, to: 200 }); tone({ type: "sine", from: 170, to: 110, dur: 0.08, vol: 0.2 }); },
    vr_slide:    () => noise({ dur: 0.26, vol: 0.16, from: 2200, to: 500 }),
    vr_wall:     () => { noise({ dur: 0.16, vol: 0.14, from: 1800, to: 700 }); tone({ type: "triangle", from: 500, to: 640, dur: 0.12, vol: 0.14 }); },
    vr_shard:    () => { tone({ from: 990, dur: 0.06, vol: 0.24 }); tone({ from: 1480, dur: 0.09, vol: 0.22, delay: 0.05 }); },
    vr_gate:     () => { tone({ from: 660, dur: 0.07, vol: 0.26 }); tone({ from: 880, dur: 0.07, vol: 0.26, delay: 0.07 }); tone({ from: 1320, dur: 0.12, vol: 0.24, delay: 0.14 }); },
    vr_boost:    () => { noise({ dur: 0.3, vol: 0.22, from: 700, to: 3200 }); tone({ type: "sawtooth", from: 220, to: 560, dur: 0.28, vol: 0.16 }); },
    vr_warn:     () => tone({ type: "square", from: 940, dur: 0.05, vol: 0.13 }),
    vr_zap:      () => { tone({ type: "sawtooth", from: 1200, to: 240, dur: 0.16, vol: 0.3 }); noise({ dur: 0.14, vol: 0.24, from: 3000, to: 400 }); },
    vr_fall:     () => { tone({ type: "sine", from: 420, to: 90, dur: 0.4, vol: 0.3 }); noise({ dur: 0.2, vol: 0.14, from: 900, to: 150, delay: 0.1 }); },
    vr_respawn:  () => { tone({ type: "sine", from: 300, to: 620, dur: 0.14, vol: 0.2 }); tone({ from: 830, dur: 0.07, vol: 0.16, delay: 0.12 }); },
    vr_finish:   () => { tone({ from: 587, dur: 0.09, vol: 0.28 }); tone({ from: 740, dur: 0.09, vol: 0.28, delay: 0.09 }); tone({ from: 988, dur: 0.09, vol: 0.28, delay: 0.18 }); tone({ from: 1319, dur: 0.24, vol: 0.3, delay: 0.27 }); },
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

    /**
     * AudioContext + master gain cho game cần tổng hợp nhạc nền riêng
     * (Rhythm Hack). Trả về null nếu chưa unlock / không hỗ trợ WebAudio.
     * Node của game PHẢI connect vào master để tôn trọng mute/volume,
     * và game tự dọn node của mình khi destroy.
     */
    getContext() {
      this.unlock();
      if (!ensure()) return null;
      return { ctx, master, isEnabled: () => enabled };
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

  /* ---------- Expansion 6–10 ---------- */
  {
    id: "portal-puzzle",
    title: "Portal Puzzle 404",
    accent: "cyan",
    kind: "2d",
    goal: "Giải đố 15 màn: đẩy thùng gỗ, kích hoạt công tắc, né tia laser và dịch chuyển qua cổng không gian để đến lối thoát.",
    hint: { keys: ["←↑↓→"], text: "di chuyển · U hoàn tác · H gợi ý" },
    controls: [
      { keys: ["↑ ↓ ← →", "WASD"], text: "di chuyển từng ô" },
      { keys: ["U"], text: "hoàn tác" },
      { keys: ["R"], text: "chơi lại màn" },
      { keys: ["H"], text: "gợi ý một bước" },
      { keys: ["Vuốt"], text: "vuốt / chạm ô kề trên cảm ứng" },
    ],
    loader: () => Promise.resolve(__req("games/portal-puzzle/index.js")),
    fullBleed: true,
    ownResults: true,
  },
  {
    id: "void-runner",
    title: "Void Runner 404",
    accent: "violet",
    kind: "3d",
    badge: "3D",
    goal: "Parkour 3D góc nhìn thứ nhất: chạy, nhảy, trượt, wall-run qua 8 checkpoint giữa thành phố cyber trong thời gian ngắn nhất.",
    hint: { keys: ["WASD"], text: "+ chuột — tối ưu desktop" },
    controls: [
      { keys: ["W A S D"], text: "di chuyển / Chuột quan sát" },
      { keys: ["Space", "Shift"], text: "nhảy / chạy nhanh" },
      { keys: ["Ctrl", "C"], text: "trượt (qua cổng tròn)" },
      { keys: ["Q"], text: "wall-run assist / Esc tạm dừng" },
    ],
    // Engine WebGL dùng chung với 404 Strike — chỉ tải khi chọn game
    loader: () => Promise.resolve(__req("games/void-runner/index.js")),
    fullBleed: true,
    ownResults: true,
  },
  {
    id: "neon-drift",
    title: "Neon Drift 404",
    accent: "pink",
    kind: "2d",
    goal: "Đua xe neon nhìn từ trên xuống: qua 8 checkpoint đúng thứ tự, drift ăn combo, thu năng lượng và bung nitro trước khi hết giờ.",
    hint: { keys: ["← →"], text: "lái · SPACE drift · SHIFT nitro" },
    controls: [
      { keys: ["↑ ↓ ← →", "WASD"], text: "ga / phanh / đánh lái" },
      { keys: ["SPACE"], text: "drift (phanh tay) — giữ để ôm cua" },
      { keys: ["SHIFT"], text: "nitro (có thanh năng lượng)" },
      { keys: ["Chạm"], text: "nút ◀ ▶ + NITRO, xe tự ga trên cảm ứng" },
    ],
    loader: () => Promise.resolve(__req("games/neon-drift/index.js")),
    fullBleed: true,
    ownResults: true,
  },
  {
    id: "cyber-defense",
    title: "Cyber Defense",
    accent: "violet",
    kind: "2d",
    goal: "Tower defense trên bảng mạch: xây và nâng cấp tháp trên các pad, chặn 8 wave bot trước khi chúng chạm tới lõi CORE.",
    hint: { keys: [], text: "click chọn tháp → click pad để xây" },
    controls: [
      { keys: ["Click", "Chạm"], text: "chọn tháp / xây trên pad / nâng cấp / bán" },
      { keys: ["1 2 3 4 5"], text: "chọn nhanh loại tháp" },
      { keys: ["Esc"], text: "hủy chế độ xây / tạm dừng" },
    ],
    loader: () => Promise.resolve(__req("games/cyber-defense/index.js")),
    fullBleed: true,
    ownResults: true,
  },
  {
    id: "rogue-arena",
    title: "Rogue Arena",
    accent: "magenta",
    kind: "2d",
    goal: "Sinh tồn 3 phút: vũ khí tự nhắm, bạn chỉ cần di chuyển và né. Hút XP, chọn nâng cấp mỗi cấp và hạ boss ở phút cuối.",
    hint: { keys: ["WASD"], text: "di chuyển — vũ khí tự bắn" },
    controls: [
      { keys: ["W A S D", "↑ ↓ ← →"], text: "di chuyển (vũ khí tự nhắm bắn)" },
      { keys: ["1 2 3"], text: "chọn nâng cấp khi lên cấp" },
      { keys: ["Chạm"], text: "joystick ảo trên màn hình cảm ứng" },
    ],
    loader: () => Promise.resolve(__req("games/rogue-arena/index.js")),
    fullBleed: true,
    ownResults: true,
  },
  {
    id: "rhythm-hack",
    title: "Rhythm Hack",
    accent: "lime",
    kind: "2d",
    goal: "Nhấn D F J K đúng lúc note chạm vạch để vá hệ thống: nhạc chiptune tổng hợp trực tiếp, judgement ±45ms, combo và độ chính xác.",
    hint: { keys: ["D", "F", "J", "K"], text: "gõ theo nhịp" },
    controls: [
      { keys: ["D", "F", "J", "K"], text: "đánh 4 lane theo nhịp nhạc" },
      { keys: ["Chạm"], text: "chạm 4 phím / 4 vùng lane trên tablet" },
      { keys: ["Esc"], text: "tạm dừng — có chỉnh độ trễ ±ms" },
    ],
    loader: () => Promise.resolve(__req("games/rhythm-hack/index.js")),
    fullBleed: true,
    ownResults: true,
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
  let expectUnlock = false; // chờ unlock do exitLock() chủ động (không phải Esc)
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
      // Thoát lock CHỦ ĐỘNG (pause/kết thúc trận): sự kiện pointerlockchange
      // tương ứng có thể về trễ một task — đánh dấu để handler không hiểu
      // nhầm là người chơi Esc rồi tự pause lại ngay sau khi resume.
      expectUnlock = true;
      try {
        document.exitPointerLock();
      } catch {
        expectUnlock = false;
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
          if (locked) {
            expectUnlock = false;
            return;
          }
          // Unlock do chính game gọi exitLock(). Nếu người chơi đã kịp bấm
          // "Tiếp tục" trước khi sự kiện về (double-tap P, frame nặng...),
          // không được auto-pause lại — chỉ thử khóa lại cho trận đang chạy.
          if (expectUnlock) {
            expectUnlock = false;
            if (mode === "match" && !paused) requestLock();
            return;
          }
          if (mode === "match" && !paused) pauseMatch();
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

/** View matrix cho camera FPS: nghịch đảo của T(pos)*RY(yaw)*RX(pitch)*RZ(roll). */
function mat4FpsView(out, pos, yaw, pitch, roll = 0) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  // Trục camera trong world
  let rx = [cy, 0, -sy];
  let ry = [sy * sp, cp, cy * sp];
  const rz = [sy * cp, -sp, cy * cp];
  if (roll) {
    // Xoay right/up quanh trục nhìn (camera roll — wall-run, nghiêng người)
    const cr = Math.cos(roll), sr = Math.sin(roll);
    const ax = [rx[0] * cr + ry[0] * sr, rx[1] * cr + ry[1] * sr, rx[2] * cr + ry[2] * sr];
    const ay = [ry[0] * cr - rx[0] * sr, ry[1] * cr - rx[1] * sr, ry[2] * cr - rx[2] * sr];
    rx = ax;
    ry = ay;
  }
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

function cylData(segments = 14) {
  // Trụ tròn trục Y (bán kính 0.5, cao 1, tâm gốc) — cột/đế/ống neon.
  const pos = [];
  const nor = [];
  const uv = [];
  const idx = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    pos.push(c * 0.5, -0.5, s * 0.5, c * 0.5, 0.5, s * 0.5);
    nor.push(c, 0, s, c, 0, s);
    uv.push(i / segments, 1, i / segments, 0);
  }
  for (let i = 0; i < segments; i++) {
    const b = i * 2;
    idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
  }
  for (const [y, ny] of [[0.5, 1], [-0.5, -1]]) {
    const center = pos.length / 3;
    pos.push(0, y, 0);
    nor.push(0, ny, 0);
    uv.push(0.5, 0.5);
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      pos.push(Math.cos(a) * 0.5, y, Math.sin(a) * 0.5);
      nor.push(0, ny, 0);
      uv.push(0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5);
    }
    for (let i = 0; i < segments; i++) {
      if (ny > 0) idx.push(center, center + 1 + i, center + 2 + i);
      else idx.push(center, center + 2 + i, center + 1 + i);
    }
  }
  return { pos, nor, uv, idx };
}

function ringData(inner = 0.4, segments = 28) {
  // Vành khuyên phẳng trên XY (pháp tuyến +Z) — cổng tròn/portal/marker.
  const pos = [];
  const nor = [];
  const uv = [];
  const idx = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    pos.push(c * 0.5, s * 0.5, 0, c * inner, s * inner, 0);
    nor.push(0, 0, 1, 0, 0, 1);
    uv.push(i / segments, 0, i / segments, 1);
  }
  for (let i = 0; i < segments; i++) {
    const b = i * 2;
    idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
  }
  return { pos, nor, uv, idx };
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
  upload("cyl", cylData());
  upload("ring", ringData());

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
    mat4FpsView(view, camera.pos, camera.yaw, camera.pitch, camera.roll || 0);
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
__defs["games/portal-puzzle/index.js"] = function (exports, __req) {
/**
 * Portal Puzzle 404 — puzzle lưới data-driven 15 màn (game 6).
 *
 * Theo plan + ảnh reference: HUD trên (MÀN / BƯỚC / THỜI GIAN / BEST +
 * cụm nút hệ thống), sidebar chú giải + mục tiêu bên trái, board canvas
 * giữa, thanh HOÀN TÁC / CHƠI LẠI / GỢI Ý (badge số lượt) bên dưới.
 * Arrow/WASD di chuyển, U hoàn tác (≥20 bước), R chơi lại màn, H gợi ý
 * từng bước (lưu sẵn trong level), Esc tạm dừng. Mobile: vuốt hoặc chạm
 * ô kề. Tiến trình màn lưu bằng storage.setPref; điểm gửi onGameOver mỗi
 * khi hoàn thành màn.
 */

const { createExpansionFrame } = __req("games/_shared/frame.js");
const { createKeyboard, onSwipe } = __req("core/input-manager.js");
const { createLoop } = __req("core/loop.js");
const { el, svgIcon, formatNumber, formatTime } = __req("core/utils.js");
const { parseLevel, stepPure, cloneSnap } = __req("games/portal-puzzle/engine.js");
const { LEVELS } = __req("games/portal-puzzle/levels.js");
const { createBoardRenderer, paintLegendIcon } = __req("games/portal-puzzle/render.js");
const { PP_CSS } = __req("games/portal-puzzle/styles.js");

const PROGRESS_KEY = "portal-progress";
const HINTS_PER_LEVEL = 3;
const UNDO_CAP = 60;

const DIR_OF_SWIPE = { up: "U", down: "D", left: "L", right: "R" };
const DIR_LABEL = { U: "ĐI LÊN", D: "ĐI XUỐNG", L: "SANG TRÁI", R: "SANG PHẢI" };

function createGame() {
  let ctx = null;
  let frame = null;
  let renderer = null;
  let keys = null;
  let loop = null;
  let offSwipe = null;
  let ro = null;
  let boardBox = null;
  let canvas = null;
  let hintBadge = null;
  let objectiveEl = null;

  let mode = "intro"; // intro | play | paused | complete | failed | finished
  let levelIdx = 0;
  let level = null;
  let snap = null;
  let history = [];
  let moveLog = "";
  let hintsLeft = HINTS_PER_LEVEL;
  let levelTime = 0;
  let totalScore = 0;
  let time = 0;
  let tapStart = null;

  const fx = { moveAnim: null, teleports: [], deny: null, hint: null, facing: { x: 0, y: 1 } };

  /* ---------------- Tiến trình ---------------- */

  function readProgress() {
    const p = ctx.storage.getPref(PROGRESS_KEY, null);
    if (p && typeof p === "object" && Number.isInteger(p.level) && p.level >= 0 && p.level < LEVELS.length) {
      return { level: p.level, score: Number.isFinite(p.score) ? p.score : 0 };
    }
    return { level: 0, score: 0 };
  }

  function saveProgress(levelNext, score) {
    ctx.storage.setPref(PROGRESS_KEY, { level: levelNext, score });
  }

  /* ---------------- HUD ---------------- */

  function updateHud() {
    frame.setStat("level", String(levelIdx + 1).padStart(2, "0"));
    frame.setStat("moves", `${snap.moves}/${level.maxMoves}`);
    frame.setStat("time", formatTime(levelTime));
    const best = ctx.getBest();
    frame.setStat("best", best > 0 ? formatNumber(best) : "--:--");
    const movesLeft = level.maxMoves - snap.moves;
    const valEl = frame.statBox("moves")?.querySelector(".val");
    if (valEl) valEl.style.color = movesLeft <= 3 ? "var(--red)" : "";
    if (hintBadge) {
      hintBadge.textContent = String(hintsLeft);
      if (hintsLeft === 0) hintBadge.dataset.zero = "1";
      else delete hintBadge.dataset.zero;
    }
  }

  /* ---------------- Vòng đời level ---------------- */

  function loadLevel(idx) {
    levelIdx = idx;
    const parsed = parseLevel(LEVELS[idx]);
    level = parsed.level;
    snap = parsed.snap;
    history = [];
    moveLog = "";
    hintsLeft = HINTS_PER_LEVEL;
    levelTime = 0;
    fx.moveAnim = null;
    fx.teleports = [];
    fx.deny = null;
    fx.hint = null;
    if (objectiveEl) objectiveEl.textContent = LEVELS[idx].intro;
    updateHud();
  }

  function beginLevel(idx) {
    loadLevel(idx);
    mode = "play";
    frame.clearScreen();
    frame.setPaused(false);
    ctx.onMatchStart();
    frame.banner(`MÀN ${String(idx + 1).padStart(2, "0")} — ${level.name}`);
    ctx.audio.play("start");
    loop.start();
  }

  function levelScoreOf() {
    const movesLeft = Math.max(0, level.maxMoves - snap.moves);
    const parBonus = snap.moves <= level.par ? 100 : 0;
    return 150 + movesLeft * 10 + parBonus;
  }

  function finishLevel() {
    mode = "complete";
    loop.stop();
    const gained = levelScoreOf();
    totalScore += gained;
    ctx.audio.play("win");
    const isLast = levelIdx === LEVELS.length - 1;
    if (isLast) {
      saveProgress(0, 0);
    } else {
      saveProgress(levelIdx + 1, totalScore);
    }
    const saved = ctx.onGameOver(totalScore, { level: levelIdx + 1, moves: snap.moves });

    const statCards = [
      { label: "BƯỚC", value: `${snap.moves}/${level.maxMoves}`, color: "lime" },
      { label: "TỐI ƯU (PAR)", value: level.par, color: "cyan" },
      { label: "THỜI GIAN", value: formatTime(levelTime), color: "cyan" },
      { label: "ĐIỂM MÀN", value: `+${formatNumber(gained)}`, color: "gold" },
    ];
    if (isLast) {
      mode = "finished";
      frame.overScreen({
        kicker: "// CHIẾN DỊCH HOÀN TẤT",
        heading: "HOÀN THÀNH 15 MÀN!",
        score: totalScore,
        saved,
        statCards,
        restartLabel: "CHƠI LẠI TỪ ĐẦU",
        onRestart: () => {
          totalScore = 0;
          beginLevel(0);
        },
        scoreLabel: "TỔNG ĐIỂM",
      });
    } else {
      frame.overScreen({
        kicker: "// MÀN HOÀN THÀNH",
        heading: `MÀN ${String(levelIdx + 1).padStart(2, "0")} — XONG!`,
        score: totalScore,
        saved,
        statCards,
        restartLabel: "MÀN TIẾP THEO",
        onRestart: () => beginLevel(levelIdx + 1),
        extraActions: [["Chơi lại màn", "i-restart", "cyan", () => beginLevel(levelIdx)]],
        scoreLabel: "TỔNG ĐIỂM",
      });
    }
    updateHud();
  }

  function failLevel() {
    mode = "failed";
    loop.stop();
    ctx.audio.play("bad");
    const s = frame.showScreen("failed");
    const box = frame.panel(s);
    box.appendChild(el("div", "exp-kicker", "// HẾT NĂNG LƯỢNG"));
    box.appendChild(el("h2", "exp-h1", "HẾT BƯỚC!"));
    box.appendChild(
      el("p", "exp-goal", `Bạn đã dùng hết ${level.maxMoves} bước cho màn này. Hoàn tác vài bước hoặc chơi lại màn nhé.`)
    );
    const menu = el("div", "exp-menu");
    const mk = (label, cls, fn) => {
      const b = el("button", `exp-menu-btn${cls ? ` ${cls}` : ""}`, label);
      b.type = "button";
      b.addEventListener("click", fn);
      return b;
    };
    menu.appendChild(mk("HOÀN TÁC BƯỚC CUỐI (U)", "primary", () => undoMove()));
    menu.appendChild(mk("CHƠI LẠI MÀN (R)", "", () => beginLevel(levelIdx)));
    menu.appendChild(mk("ĐỔI GAME", "", () => ctx.requestSwitch()));
    box.appendChild(menu);
  }

  /* ---------------- Hành động ---------------- */

  function move(dirChar) {
    if (mode !== "play") return;
    const from = { x: snap.player.x, y: snap.player.y };
    const r = stepPure(level, snap, dirChar);
    const d = { U: { x: 0, y: -1 }, D: { x: 0, y: 1 }, L: { x: -1, y: 0 }, R: { x: 1, y: 0 } }[dirChar];
    fx.facing = d;
    if (r.denied) {
      fx.deny = { t0: time, dx: d.x, dy: d.y };
      ctx.audio.play("denied");
      if (r.denied === "laser") frame.toast("TIA LASER CHẶN ĐƯỜNG!");
      return;
    }
    history.push({ snap: cloneSnap(snap), log: moveLog });
    if (history.length > UNDO_CAP) history.shift();
    snap = r.snap;
    moveLog += dirChar;
    fx.hint = null;

    if (r.events.teleported) {
      fx.teleports.push({ ...r.events.teleported.from, color: r.events.teleported.color, t0: time });
      fx.teleports.push({ ...r.events.teleported.to, color: r.events.teleported.color, t0: time });
      fx.moveAnim = null;
      ctx.audio.play("portal");
    } else {
      fx.moveAnim = { fx: from.x, fy: from.y, t0: time };
    }
    if (r.events.crateTeleported) {
      fx.teleports.push({ ...r.events.crateTeleported.from, color: r.events.crateTeleported.color, t0: time });
      fx.teleports.push({ ...r.events.crateTeleported.to, color: r.events.crateTeleported.color, t0: time });
      ctx.audio.play("portal");
    }
    if (r.events.toggled) ctx.audio.play("switch");
    else if (r.events.pushed) ctx.audio.play("push");
    else if (r.events.steppedSwitch) ctx.audio.play("switch");
    else ctx.audio.play("step");

    if (fx.teleports.length > 8) fx.teleports.splice(0, fx.teleports.length - 8);
    updateHud();

    if (r.completed) {
      finishLevel();
      return;
    }
    if (snap.moves >= level.maxMoves) failLevel();
  }

  function undoMove() {
    if (mode !== "play" && mode !== "failed") return;
    const prev = history.pop();
    if (!prev) {
      frame.toast("KHÔNG CÒN BƯỚC HOÀN TÁC");
      return;
    }
    snap = prev.snap;
    moveLog = prev.log;
    fx.moveAnim = null;
    fx.hint = null;
    ctx.audio.play("undo");
    if (mode === "failed") {
      mode = "play";
      frame.clearScreen();
      loop.start();
    }
    updateHud();
  }

  function useHint() {
    if (mode !== "play") return;
    if (hintsLeft <= 0) {
      frame.toast("ĐÃ DÙNG HẾT LƯỢT GỢI Ý");
      ctx.audio.play("denied");
      return;
    }
    const sol = level.hint;
    if (!sol.startsWith(moveLog)) {
      frame.toast("ĐÃ LỆCH LỜI GIẢI GỐC — HOÀN TÁC (U) HOẶC CHƠI LẠI (R) ĐỂ DÙNG GỢI Ý");
      ctx.audio.play("denied");
      return;
    }
    if (moveLog.length >= sol.length) return;
    const nextDir = sol[moveLog.length];
    hintsLeft -= 1;
    fx.hint = { dir: nextDir, until: time + 3.2 };
    frame.toast(`GỢI Ý: ${DIR_LABEL[nextDir]}`);
    ctx.audio.play("ui");
    updateHud();
  }

  /* ---------------- Pause ---------------- */

  function pauseGame() {
    if (mode !== "play") return;
    mode = "paused";
    loop.stop();
    frame.setPaused(true);
    frame.pauseMenu({
      onResume: () => resumeGame(),
      onRestart: () => beginLevel(levelIdx),
      restartLabel: "CHƠI LẠI MÀN",
      buildExtra: (box) => {
        const row = el("div", "exp-setrow");
        row.appendChild(el("span", "", "TIẾN TRÌNH"));
        row.appendChild(el("span", "val", `MÀN ${levelIdx + 1}/15 · TỔNG ${formatNumber(totalScore)} ĐIỂM`));
        box.appendChild(row);
      },
    });
  }

  function resumeGame() {
    if (mode !== "paused") return;
    mode = "play";
    frame.clearScreen();
    frame.setPaused(false);
    keys.clearDown();
    loop.start();
  }

  function togglePause() {
    if (mode === "play") pauseGame();
    else if (mode === "paused") resumeGame();
  }

  /* ---------------- Intro ---------------- */

  function showIntro() {
    mode = "intro";
    loop.stop();
    const progress = readProgress();
    const extra = [];
    if (progress.level > 0) {
      extra.push([
        "Chơi từ đầu",
        "i-restart",
        "gold",
        () => {
          totalScore = 0;
          saveProgress(0, 0);
          beginLevel(0);
        },
      ]);
    }
    frame.intro({
      kicker: "// NHIỆM VỤ GIẢI ĐỐ",
      heading: [["PORTAL PUZZLE ", ""], ["404", "cyan"]],
      goal:
        "Đưa nhà thám hiểm đến Ô THOÁT của 15 màn chơi: đẩy thùng gỗ, kích hoạt công tắc, né tia laser và dịch chuyển qua các cổng không gian. Mỗi màn có giới hạn bước!",
      rows: [
        { keys: ["↑↓←→", "WASD"], text: "di chuyển (vuốt / chạm ô kề trên mobile)" },
        { keys: ["U"], text: "hoàn tác bước (tối đa 60 bước)" },
        { keys: ["R"], text: "chơi lại màn hiện tại" },
        { keys: ["H"], text: "gợi ý một bước (3 lượt mỗi màn)" },
        { keys: ["ESC"], text: "tạm dừng" },
      ],
      startLabel: progress.level > 0 ? `TIẾP TỤC — MÀN ${String(progress.level + 1).padStart(2, "0")}` : "BẮT ĐẦU",
      onStart: () => {
        const p = readProgress();
        totalScore = p.score;
        beginLevel(p.level);
      },
      extra,
    });
    // vẽ một khung nền tĩnh cho intro
    loadLevel(progress.level);
    renderer.fit();
    renderer.draw(level, snap, fx, 0);
  }

  /* ---------------- Vòng lặp ---------------- */

  function update(dt) {
    time += dt;
    if (mode === "play") {
      levelTime += dt;
      frame.setStat("time", formatTime(levelTime));
    }
    renderer.draw(level, snap, fx, time);
  }

  /* ---------------- Interface ---------------- */

  return {
    async mount(container, context) {
      ctx = context;

      const rootNode = container.getRootNode();
      if (rootNode instanceof ShadowRoot && !rootNode.querySelector("#pp-style")) {
        const style = document.createElement("style");
        style.id = "pp-style";
        style.textContent = PP_CSS;
        rootNode.appendChild(style);
      }

      frame = createExpansionFrame(container, ctx, {
        accent: "cyan",
        title: [["PORTAL PUZZLE ", ""], ["404", "cyan"]],
        stats: [
          { id: "level", label: "MÀN", color: "pink", value: "01" },
          { id: "moves", label: "BƯỚC", color: "lime", value: "0/12" },
          { id: "time", label: "THỜI GIAN", color: "cyan", value: "00:00" },
          { id: "best", label: "BEST", color: "gold", value: "--:--", optional: true },
        ],
        onPauseToggle: togglePause,
      });

      /* Layout: sidebar + board + action bar */
      const layout = el("div", "pp-layout");
      const side = el("aside", "pp-side");

      const objPanel = el("div", "pp-panel");
      objPanel.appendChild(el("h3", "", "MỤC TIÊU"));
      objectiveEl = el("p", "", "");
      objPanel.appendChild(objectiveEl);
      side.appendChild(objPanel);

      const legendPanel = el("div", "pp-panel");
      const legend = el("div", "pp-legend");
      const LEGEND = [
        ["player", "NHÀ THÁM HIỂM"],
        ["crate", "THÙNG GỖ"],
        ["switch-blue", "CÔNG TẮC XANH"],
        ["switch-violet", "CÔNG TẮC TÍM"],
        ["portal-cyan", "CỔNG XANH"],
        ["portal-violet", "CỔNG TÍM"],
        ["laser", "LASER"],
        ["exit", "LỐI THOÁT"],
      ];
      for (const [kind, label] of LEGEND) {
        const row = el("div", "pp-legend-row");
        const c = document.createElement("canvas");
        paintLegendIcon(c, kind);
        row.appendChild(c);
        row.appendChild(el("span", "", label));
        legend.appendChild(row);
      }
      legendPanel.appendChild(legend);
      side.appendChild(legendPanel);

      const main = el("div", "pp-main");
      boardBox = el("div", "pp-board");
      canvas = document.createElement("canvas");
      canvas.setAttribute("aria-label", "Bàn chơi Portal Puzzle");
      boardBox.appendChild(canvas);
      main.appendChild(boardBox);

      const actions = el("div", "pp-actions");
      const mkAction = (label, tone, iconId, fn, withBadge = false) => {
        const b = el("button", "pp-action");
        b.type = "button";
        b.dataset.tone = tone;
        b.appendChild(svgIcon(iconId));
        b.appendChild(el("span", "", label));
        if (withBadge) {
          hintBadge = el("span", "pp-badge", String(HINTS_PER_LEVEL));
          b.appendChild(hintBadge);
        }
        b.addEventListener("click", (e) => {
          if (e.detail > 0) b.blur();
          fn();
        });
        actions.appendChild(b);
        return b;
      };
      mkAction("HOÀN TÁC", "cyan", "i-swap", () => undoMove());
      mkAction("CHƠI LẠI", "pink", "i-restart", () => {
        if (mode === "play" || mode === "failed" || mode === "paused") beginLevel(levelIdx);
      });
      mkAction("GỢI Ý", "lime", "i-target", () => useHint(), true);
      main.appendChild(actions);

      layout.append(side, main);
      frame.playfield.appendChild(layout);

      renderer = createBoardRenderer(canvas, boardBox);
      ro = new ResizeObserver(() => {
        renderer.fit();
        if (mode !== "play") renderer.draw(level, snap, fx, time);
      });
      ro.observe(boardBox);

      /* Input */
      keys = createKeyboard({ signal: ctx.signal });
      keys.on(["ArrowUp", "KeyW"], () => move("U"), { repeat: true });
      keys.on(["ArrowDown", "KeyS"], () => move("D"), { repeat: true });
      keys.on(["ArrowLeft", "KeyA"], () => move("L"), { repeat: true });
      keys.on(["ArrowRight", "KeyD"], () => move("R"), { repeat: true });
      keys.on(["KeyU", "KeyZ"], () => undoMove());
      keys.on(["KeyR"], () => {
        if (mode === "play" || mode === "failed") beginLevel(levelIdx);
      });
      keys.on(["KeyH"], () => useHint());
      keys.on(["KeyP"], () => togglePause());

      offSwipe = onSwipe(canvas, (dir) => move(DIR_OF_SWIPE[dir]));
      canvas.addEventListener(
        "pointerdown",
        (e) => {
          tapStart = { x: e.clientX, y: e.clientY, t: performance.now() };
        },
        { signal: ctx.signal }
      );
      canvas.addEventListener(
        "pointerup",
        (e) => {
          if (!tapStart || mode !== "play") return;
          const dx = e.clientX - tapStart.x;
          const dy = e.clientY - tapStart.y;
          const dt = performance.now() - tapStart.t;
          tapStart = null;
          if (Math.hypot(dx, dy) > 12 || dt > 450) return; // đã là swipe
          const rect = canvas.getBoundingClientRect();
          const { t, ox, oy } = renderer.geometry(level);
          const gx = Math.floor((e.clientX - rect.left - ox) / t);
          const gy = Math.floor((e.clientY - rect.top - oy) / t);
          const ddx = gx - snap.player.x;
          const ddy = gy - snap.player.y;
          if (Math.abs(ddx) + Math.abs(ddy) === 1) {
            move(ddx === 1 ? "R" : ddx === -1 ? "L" : ddy === 1 ? "D" : "U");
          }
        },
        { signal: ctx.signal }
      );

      loop = createLoop(update);
      showIntro();
    },

    start() {
      if (mode !== "intro") return;
      const p = readProgress();
      totalScore = p.score;
      beginLevel(p.level);
    },

    pause() {
      pauseGame();
    },

    resume() {
      resumeGame();
    },

    restart() {
      if (mode === "intro") return;
      beginLevel(levelIdx);
    },

    resize() {
      renderer?.fit();
    },

    destroy() {
      loop?.stop();
      keys?.destroy();
      offSwipe?.();
      ro?.disconnect();
      frame?.destroy();
      frame = null;
      renderer = null;
      level = null;
      snap = null;
    },
  };
}

exports.createGame = createGame;
};
__defs["games/_shared/frame.js"] = function (exports, __req) {
/**
 * frame.js — khung fullBleed dùng chung cho 5 game expansion (6–10).
 *
 * Tạo chrome theo phong cách 5 ảnh reference: top bar (tên game trái,
 * chỉ số giữa, cụm nút TẠM DỪNG / ÂM THANH / ĐỔI GAME / TRANG CHỦ phải),
 * overlay hướng dẫn lần đầu, pause menu, màn kết quả (điểm + kỷ lục +
 * Chơi lại / Đổi game / Về trang chủ), toast và banner.
 *
 * Mỗi game truyền cấu hình chỉ số HUD riêng; mọi nút gọi hành động thật
 * (pause của game, audio.setEnabled, requestSwitch, requestHome).
 * Listener window đăng ký qua ctx.signal — tự gỡ khi controller abort.
 */

const { el, svgIcon, formatNumber } = __req("core/utils.js");
const { EXP_CSS } = __req("games/_shared/frame-styles.js");

const STYLE_ID = "exp5-style";

/** Inject CSS khung (một lần cho mỗi shadow root). */
function ensureExpansionStyles(container) {
  const rootNode = container.getRootNode();
  if (rootNode instanceof ShadowRoot && !rootNode.querySelector(`#${STYLE_ID}`)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = EXP_CSS;
    rootNode.appendChild(style);
  }
}

/** Span tiêu đề nhiều màu: [["NEON ", "cyan"], ["DRIFT ", "pink"], ...] */
function titleSpans(target, segments) {
  for (const [text, tone] of segments) {
    const s = el("span", tone ? `seg-${tone}` : "", text);
    target.appendChild(s);
  }
}

function createExpansionFrame(container, ctx, opts) {
  const {
    accent = "cyan",
    title = [["GAME", ""]],
    stats = [],
    buttonStyle = "stacked", // stacked | inline | compact
    buttonsFirst = false, // true: cụm nút nằm BÊN TRÁI (Cyber Defense)
    buttonLabels = {},
    onPauseToggle = () => {},
    handleEscape = true,
  } = opts;

  ensureExpansionStyles(container);

  const root = el("div", "exp-root");
  root.dataset.accent = accent;
  root.dataset.btnstyle = buttonStyle;

  /* ---------- Top bar ---------- */
  const topbar = el("div", "exp-topbar");

  const titleBox = el("div", "exp-title");
  const t = el("div", "t");
  titleSpans(t, title);
  titleBox.appendChild(t);
  titleBox.appendChild(el("div", "deco"));

  const statsBox = el("div", "exp-stats");
  const statEls = new Map();
  for (const s of stats) {
    const box = el("div", "exp-stat");
    box.dataset.color = s.color || "white";
    if (s.optional) box.dataset.optional = "1";
    box.appendChild(el("div", "lbl", s.label));
    const val = el("div", "val", s.value ?? "—");
    box.appendChild(val);
    let barFill = null;
    if (s.bar) {
      const bar = el("div", "minibar");
      barFill = el("i");
      bar.appendChild(barFill);
      box.appendChild(bar);
    }
    statsBox.appendChild(box);
    statEls.set(s.id, { val, barFill, box });
  }

  const btns = el("div", "exp-btns");

  function sysBtn(iconId, label, aria, onClick) {
    const b = el("button", "exp-btn");
    b.type = "button";
    b.setAttribute("aria-label", aria);
    b.appendChild(svgIcon(iconId));
    b.appendChild(el("span", "bl", label));
    b.addEventListener("click", (e) => {
      if (e.detail > 0) b.blur();
      onClick();
    });
    return b;
  }

  const btnPause = sysBtn("i-pause", buttonLabels.pause || "TẠM DỪNG", "Tạm dừng", () => onPauseToggle());
  const btnSound = sysBtn(
    ctx.audio.enabled ? "i-sound-on" : "i-sound-off",
    buttonLabels.sound || "ÂM THANH",
    "Bật hoặc tắt âm thanh",
    () => {
      ctx.audio.setEnabled(!ctx.audio.enabled);
      ctx.audio.play("ui");
      syncSound();
    }
  );
  const btnSwitch = sysBtn("i-swap", buttonLabels.switch || "ĐỔI GAME", "Đổi game", () => ctx.requestSwitch());
  const btnHome = sysBtn("i-home", buttonLabels.home || "TRANG CHỦ", "Về trang chủ", () => ctx.requestHome());
  btns.append(btnPause, btnSound, btnSwitch, btnHome);

  if (buttonsFirst) topbar.append(btns, titleBox, statsBox);
  else topbar.append(titleBox, statsBox, btns);

  /* ---------- Playfield + overlay ---------- */
  const playfield = el("div", "exp-playfield");
  const toasts = el("div", "exp-toasts");
  const bannerEl = el("div", "exp-banner");
  playfield.append(toasts, bannerEl);

  const screenLayer = el("div");
  playfield.appendChild(screenLayer);

  root.append(topbar, playfield);
  container.appendChild(root);

  let currentScreen = null;

  function syncSound() {
    btnSound.querySelector("use")?.setAttribute("href", ctx.audio.enabled ? "#i-sound-on" : "#i-sound-off");
  }

  function setPaused(paused) {
    btnPause.querySelector("use")?.setAttribute("href", paused ? "#i-play" : "#i-pause");
    const bl = btnPause.querySelector(".bl");
    if (bl) bl.textContent = paused ? (buttonLabels.resume || "TIẾP TỤC") : (buttonLabels.pause || "TẠM DỪNG");
  }

  /* ---------- Màn hình overlay ---------- */

  function clearScreen() {
    screenLayer.textContent = "";
    currentScreen = null;
  }

  function showScreen(name) {
    clearScreen();
    const s = el("div", "exp-screen");
    s.dataset.screen = name;
    screenLayer.appendChild(s);
    currentScreen = name;
    return s;
  }

  function panel(target, extraCls = "") {
    const p = el("div", `exp-panel${extraCls ? ` ${extraCls}` : ""}`);
    const inBox = el("div", "in");
    p.appendChild(inBox);
    target.appendChild(p);
    return inBox;
  }

  function ghostBtn(label, iconId, tone, onClick) {
    const b = el("button", "exp-ghostbtn", label);
    b.type = "button";
    if (tone) b.dataset.tone = tone;
    if (iconId) b.prepend(svgIcon(iconId));
    b.addEventListener("click", (e) => {
      if (e.detail > 0) b.blur();
      onClick();
    });
    return b;
  }

  /** Overlay hướng dẫn lần đầu / màn chờ. */
  function intro({ kicker = "// HƯỚNG DẪN", heading = title, goal = "", rows = [], startLabel = "BẮT ĐẦU", note = "", onStart, extra = [] }) {
    const s = showScreen("intro");
    const box = panel(s);
    box.appendChild(el("div", "exp-kicker", kicker));
    const h = el("h2", "exp-h1");
    titleSpans(h, heading);
    box.appendChild(h);
    if (goal) box.appendChild(el("p", "exp-goal", goal));
    if (rows.length) {
      const list = el("div", "exp-ctl-rows");
      for (const row of rows) {
        const r = el("div", "exp-ctl-row");
        const keys = el("span", "keys");
        for (const k of row.keys) keys.appendChild(el("kbd", "", k));
        r.appendChild(keys);
        r.appendChild(el("span", "", row.text));
        list.appendChild(r);
      }
      box.appendChild(list);
    }
    const cta = el("button", "exp-cta", startLabel);
    cta.type = "button";
    cta.addEventListener("click", () => onStart());
    box.appendChild(cta);
    const acts = el("div", "exp-screen-actions");
    for (const [label, iconId, tone, fn] of extra) acts.appendChild(ghostBtn(label, iconId, tone, fn));
    acts.appendChild(ghostBtn("Đổi game", "i-swap", "violet", () => ctx.requestSwitch()));
    acts.appendChild(ghostBtn("Về trang chủ", "i-home", "cyan", () => ctx.requestHome()));
    box.appendChild(acts);
    if (note) {
      const n = el("p", "exp-goal", note);
      n.style.marginBottom = "0";
      n.style.marginTop = "14px";
      n.style.fontSize = "0.72rem";
      box.appendChild(n);
    }
    requestAnimationFrame(() => cta.focus());
    return box;
  }

  /** Pause menu: Tiếp tục / Chơi lại / Đổi game / Trang chủ + khu tùy chỉnh. */
  function pauseMenu({ onResume, onRestart, restartLabel = "CHƠI LẠI", buildExtra = null }) {
    const s = showScreen("pause");
    const box = panel(s);
    box.appendChild(el("div", "exp-kicker", "// HỆ THỐNG"));
    box.appendChild(el("h2", "exp-h1", "TẠM DỪNG"));
    const menu = el("div", "exp-menu");
    const mk = (label, cls, fn) => {
      const b = el("button", `exp-menu-btn${cls ? ` ${cls}` : ""}`, label);
      b.type = "button";
      b.addEventListener("click", fn);
      return b;
    };
    const resumeBtn = mk("TIẾP TỤC", "primary", () => onResume());
    menu.appendChild(resumeBtn);
    menu.appendChild(mk(restartLabel, "", () => onRestart()));
    menu.appendChild(
      mk(ctx.audio.enabled ? "ÂM THANH: BẬT" : "ÂM THANH: TẮT", "", () => {
        ctx.audio.setEnabled(!ctx.audio.enabled);
        ctx.audio.play("ui");
        syncSound();
        const btn = menu.querySelectorAll(".exp-menu-btn")[2];
        btn.textContent = ctx.audio.enabled ? "ÂM THANH: BẬT" : "ÂM THANH: TẮT";
      })
    );
    menu.appendChild(mk("ĐỔI GAME", "", () => ctx.requestSwitch()));
    menu.appendChild(mk("VỀ TRANG CHỦ", "", () => ctx.requestHome()));
    box.appendChild(menu);
    if (buildExtra) {
      const extra = el("div", "exp-pause-extra");
      buildExtra(extra);
      box.appendChild(extra);
    }
    requestAnimationFrame(() => resumeBtn.focus());
    return box;
  }

  /** Màn kết quả: điểm + kỷ lục + thẻ chỉ số + hành động. */
  function overScreen({
    kicker = "// KẾT QUẢ",
    heading = "KẾT THÚC",
    score,
    saved,
    statCards = [],
    restartLabel = "CHƠI LẠI",
    onRestart,
    extraActions = [],
    scoreLabel = "ĐIỂM",
  }) {
    const s = showScreen("over");
    const box = panel(s);
    box.appendChild(el("div", "exp-kicker", kicker));
    box.appendChild(el("h2", "exp-h1", heading));

    const line = el("div", "exp-over-score");
    const scoreCol = el("div");
    const lbl = el("div", "exp-kicker", scoreLabel);
    lbl.style.marginBottom = "2px";
    scoreCol.appendChild(lbl);
    scoreCol.appendChild(el("div", "num", formatNumber(score)));
    line.appendChild(scoreCol);
    if (saved?.isRecord) line.appendChild(el("span", "exp-record", "KỶ LỤC MỚI"));
    box.appendChild(line);
    if (saved) {
      const bl = el("p", "exp-best-line");
      bl.appendChild(document.createTextNode("KỶ LỤC: "));
      bl.appendChild(el("b", "", formatNumber(saved.best)));
      box.appendChild(bl);
    }

    if (statCards.length) {
      const grid = el("div", "exp-statgrid");
      for (const c of statCards) {
        const card = el("div", "exp-statcard");
        if (c.color) card.dataset.color = c.color;
        card.appendChild(el("div", "lbl", c.label));
        card.appendChild(el("div", "val", String(c.value)));
        grid.appendChild(card);
      }
      box.appendChild(grid);
    }

    const acts = el("div", "exp-screen-actions");
    const restartBtn = ghostBtn(restartLabel, "i-restart", "gold", () => onRestart());
    acts.appendChild(restartBtn);
    for (const [label, iconId, tone, fn] of extraActions) acts.appendChild(ghostBtn(label, iconId, tone, fn));
    acts.appendChild(ghostBtn("Đổi game", "i-swap", "violet", () => ctx.requestSwitch()));
    acts.appendChild(ghostBtn("Về trang chủ", "i-home", "cyan", () => ctx.requestHome()));
    box.appendChild(acts);
    requestAnimationFrame(() => restartBtn.focus());
    return box;
  }

  /* ---------- Toast / banner ---------- */

  function toast(text) {
    const node = el("div", "exp-toast", text);
    toasts.appendChild(node);
    setTimeout(() => node.remove(), 1900);
  }

  function banner(text) {
    bannerEl.textContent = text;
    bannerEl.classList.remove("show");
    void bannerEl.offsetWidth;
    bannerEl.classList.add("show");
  }

  /* ---------- Esc ---------- */

  if (handleEscape) {
    window.addEventListener(
      "keydown",
      (e) => {
        if (e.code !== "Escape") return;
        e.preventDefault();
        onPauseToggle();
      },
      { signal: ctx.signal }
    );
  }

  return {
    root,
    playfield,
    topbar,
    statsBox,

    setStat(id, text) {
      const s = statEls.get(id);
      if (s) s.val.textContent = text;
    },

    setStatBar(id, pct) {
      const s = statEls.get(id);
      if (s?.barFill) s.barFill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
    },

    statBox(id) {
      return statEls.get(id)?.box || null;
    },

    setPaused,
    syncSound,
    showScreen,
    clearScreen,
    panel,
    ghostBtn,
    intro,
    pauseMenu,
    overScreen,
    toast,
    banner,

    get screen() {
      return currentScreen;
    },

    destroy() {
      root.remove();
    },
  };
}

exports.ensureExpansionStyles = ensureExpansionStyles; exports.createExpansionFrame = createExpansionFrame;
};
__defs["games/_shared/frame-styles.js"] = function (exports, __req) {
/**
 * frame-styles.js — CSS khung dùng chung cho 5 game expansion (6–10).
 * Tái tạo phong cách HUD trong 5 ảnh reference: top bar tối với tên game
 * bên trái, cụm chỉ số ở giữa, cụm nút TẠM DỪNG / ÂM THANH / ĐỔI GAME /
 * TRANG CHỦ; overlay hướng dẫn, pause menu và màn kết quả cắt góc neon.
 * Inject một lần vào shadow root khi game expansion đầu tiên mount.
 */

const EXP_CSS = /* css */ `
.exp-root {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-0);
  font-family: var(--font-mono);
  user-select: none;
  -webkit-user-select: none;
}

/* ============================ TOP BAR ============================ */

.exp-topbar {
  display: flex;
  align-items: stretch;
  gap: 14px;
  flex: none;
  min-height: 60px;
  padding: 7px 14px;
  background: linear-gradient(180deg, rgba(9, 13, 34, 0.98), rgba(6, 9, 24, 0.96));
  border-bottom: 1px solid color-mix(in srgb, var(--accent) 32%, transparent);
  box-shadow: 0 1px 18px color-mix(in srgb, var(--accent) 14%, transparent);
  position: relative;
  z-index: 30;
}

.exp-title {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
  flex: none;
}

.exp-title .t {
  font-size: 1.18rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  line-height: 1.1;
  white-space: nowrap;
  text-shadow: 0 0 14px color-mix(in srgb, var(--accent) 40%, transparent);
}

.exp-title .t .seg-cyan   { color: var(--cyan); }
.exp-title .t .seg-violet { color: var(--violet); }
.exp-title .t .seg-pink   { color: var(--pink); }
.exp-title .t .seg-lime   { color: var(--lime); }
.exp-title .t .seg-green  { color: var(--green); }
.exp-title .t .seg-gold   { color: var(--gold); }
.exp-title .t .seg-red    { color: var(--red); }

.exp-title .deco {
  margin-top: 4px;
  height: 3px;
  width: 88%;
  background: linear-gradient(90deg,
    color-mix(in srgb, var(--accent) 85%, transparent) 0 34%,
    color-mix(in srgb, var(--accent) 30%, transparent) 34% 72%,
    transparent 72%);
  clip-path: polygon(0 0, 100% 0, calc(100% - 3px) 100%, 0 100%);
}

/* --- Chỉ số giữa --- */
.exp-stats {
  display: flex;
  align-items: stretch;
  justify-content: center;
  gap: 0;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.exp-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 2px 18px;
  position: relative;
}

.exp-stat + .exp-stat::before {
  content: "";
  position: absolute;
  left: 0;
  top: 15%;
  bottom: 15%;
  width: 1px;
  background: rgba(244, 247, 255, 0.1);
}

.exp-stat .lbl {
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.26em;
  color: var(--text-1);
  white-space: nowrap;
}

.exp-stat .val {
  font-size: 1.22rem;
  font-weight: 800;
  line-height: 1.05;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  color: var(--text-0);
}

.exp-stat[data-color="cyan"]   .val { color: var(--cyan);  text-shadow: 0 0 12px color-mix(in srgb, var(--cyan) 45%, transparent); }
.exp-stat[data-color="violet"] .val { color: var(--violet);text-shadow: 0 0 12px color-mix(in srgb, var(--violet) 45%, transparent); }
.exp-stat[data-color="pink"]   .val { color: var(--pink);  text-shadow: 0 0 12px color-mix(in srgb, var(--pink) 45%, transparent); }
.exp-stat[data-color="lime"]   .val { color: var(--lime);  text-shadow: 0 0 12px color-mix(in srgb, var(--lime) 45%, transparent); }
.exp-stat[data-color="green"]  .val { color: var(--green); text-shadow: 0 0 12px color-mix(in srgb, var(--green) 45%, transparent); }
.exp-stat[data-color="gold"]   .val { color: var(--gold);  text-shadow: 0 0 12px color-mix(in srgb, var(--gold) 45%, transparent); }
.exp-stat[data-color="red"]    .val { color: var(--red);   text-shadow: 0 0 12px color-mix(in srgb, var(--red) 45%, transparent); }
.exp-stat[data-color="white"]  .val { color: var(--text-0);text-shadow: 0 0 12px rgba(244,247,255,.35); }

.exp-stat .minibar {
  width: 74px;
  height: 4px;
  margin-top: 2px;
  border-radius: 2px;
  background: rgba(244, 247, 255, 0.12);
  overflow: hidden;
}

.exp-stat .minibar > i {
  display: block;
  height: 100%;
  width: 0%;
  border-radius: 2px;
  background: currentColor;
  transition: width 0.15s linear;
}

.exp-stat[data-color="cyan"]   .minibar > i { background: var(--cyan); }
.exp-stat[data-color="green"]  .minibar > i { background: var(--green); }
.exp-stat[data-color="lime"]   .minibar > i { background: var(--lime); }
.exp-stat[data-color="pink"]   .minibar > i { background: var(--pink); }
.exp-stat[data-color="red"]    .minibar > i { background: var(--red); }
.exp-stat[data-color="gold"]   .minibar > i { background: var(--gold); }
.exp-stat[data-color="violet"] .minibar > i { background: var(--violet); }

/* --- Cụm nút hệ thống --- */
.exp-btns {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
}

.exp-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  min-width: 58px;
  min-height: 46px;
  padding: 4px 7px;
  border: 1px solid rgba(244, 247, 255, 0.22);
  border-radius: 9px;
  background: rgba(10, 16, 38, 0.72);
  color: var(--text-0);
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
}

.exp-btn .icon { width: 15px; height: 15px; }

.exp-btn .bl {
  font-size: 0.5rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  white-space: nowrap;
}

.exp-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
  box-shadow: 0 0 14px color-mix(in srgb, var(--accent) 30%, transparent);
}

/* Biến thể nút ngang (Rhythm Hack) */
.exp-root[data-btnstyle="inline"] .exp-btn {
  flex-direction: row;
  gap: 7px;
  min-height: 40px;
  padding: 4px 12px;
}

.exp-root[data-btnstyle="inline"] .exp-btn .bl { font-size: 0.62rem; }

/* Biến thể nút icon nhỏ (Rogue Arena) */
.exp-root[data-btnstyle="compact"] .exp-btn {
  min-width: 40px;
  min-height: 40px;
  padding: 4px;
}

.exp-root[data-btnstyle="compact"] .exp-btn .bl { display: none; }

/* ============================ PLAYFIELD ============================ */

.exp-playfield {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.exp-playfield canvas.exp-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  touch-action: none;
}

/* ============================ OVERLAYS ============================ */

.exp-screen {
  position: absolute;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  background:
    radial-gradient(900px 500px at 50% 24%, color-mix(in srgb, var(--accent) 9%, transparent), transparent 70%),
    rgba(4, 7, 18, 0.82);
  backdrop-filter: blur(3px);
  overflow: auto;
  animation: expFade 0.22s ease;
}

@keyframes expFade { from { opacity: 0; } }

@media (prefers-reduced-motion: reduce) {
  .exp-screen { animation: none; }
}

.exp-panel {
  position: relative;
  padding: 1px;
  clip-path: polygon(16px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%, 0 16px);
  background: linear-gradient(160deg,
    color-mix(in srgb, var(--accent) 65%, transparent),
    color-mix(in srgb, var(--accent) 18%, transparent));
  max-width: min(720px, 94vw);
  margin: auto;
}

.exp-panel > .in {
  clip-path: polygon(16px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%, 0 16px);
  background: rgba(7, 11, 28, 0.96);
  padding: 26px 30px;
}

.exp-kicker {
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.4em;
  color: var(--text-1);
  margin-bottom: 8px;
}

.exp-h1 {
  font-size: clamp(1.4rem, 3.4vw, 2rem);
  font-weight: 800;
  letter-spacing: 0.04em;
  margin-bottom: 4px;
  text-shadow: 0 0 22px color-mix(in srgb, var(--accent) 50%, transparent);
}

.exp-h1 .seg-cyan { color: var(--cyan); }
.exp-h1 .seg-violet { color: var(--violet); }
.exp-h1 .seg-pink { color: var(--pink); }
.exp-h1 .seg-lime { color: var(--lime); }
.exp-h1 .seg-gold { color: var(--gold); }
.exp-h1 .seg-green { color: var(--green); }

.exp-goal {
  color: var(--text-1);
  font-size: 0.88rem;
  line-height: 1.6;
  margin: 10px 0 16px;
  max-width: 52ch;
}

.exp-ctl-rows { display: grid; gap: 8px; margin-bottom: 20px; }

.exp-ctl-row {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 0.8rem;
  color: var(--text-1);
}

.exp-ctl-row kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 26px;
  height: 24px;
  padding: 0 7px;
  border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
  border-bottom-width: 2px;
  border-radius: 5px;
  background: rgba(14, 20, 46, 0.9);
  color: var(--text-0);
  font-family: inherit;
  font-size: 0.68rem;
  font-weight: 700;
}

.exp-ctl-row .keys { display: flex; gap: 4px; flex: none; min-width: 120px; }

.exp-cta {
  appearance: none;
  border: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 52px;
  padding: 0 38px;
  clip-path: polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px);
  background: var(--accent);
  color: #051020;
  font-family: inherit;
  font-size: 0.95rem;
  font-weight: 800;
  letter-spacing: 0.2em;
  box-shadow: 0 0 26px color-mix(in srgb, var(--accent) 55%, transparent);
  transition: transform 0.14s ease, box-shadow 0.14s ease;
}

.exp-cta:hover { transform: translateY(-1px); box-shadow: 0 0 40px color-mix(in srgb, var(--accent) 75%, transparent); }

.exp-screen-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 18px;
  align-items: center;
}

.exp-ghostbtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 42px;
  padding: 0 18px;
  border: 1px solid color-mix(in srgb, var(--accent) 55%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--accent) 7%, transparent);
  color: var(--accent);
  font-family: inherit;
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 0.15s ease, box-shadow 0.15s ease;
}

.exp-ghostbtn:hover {
  background: color-mix(in srgb, var(--accent) 17%, transparent);
  box-shadow: 0 0 16px color-mix(in srgb, var(--accent) 30%, transparent);
}

.exp-ghostbtn .icon { width: 14px; height: 14px; }

.exp-ghostbtn[data-tone="pink"]  { --accent: var(--pink); }
.exp-ghostbtn[data-tone="violet"]{ --accent: var(--violet); }
.exp-ghostbtn[data-tone="lime"]  { --accent: var(--lime); }
.exp-ghostbtn[data-tone="gold"]  { --accent: var(--gold); }
.exp-ghostbtn[data-tone="cyan"]  { --accent: var(--cyan); }

/* --- Pause menu --- */
.exp-menu { display: grid; gap: 9px; min-width: min(340px, 80vw); }

.exp-menu-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 46px;
  border: 1px solid rgba(244, 247, 255, 0.18);
  border-radius: 8px;
  background: rgba(12, 18, 42, 0.85);
  color: var(--text-0);
  font-family: inherit;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  cursor: pointer;
  transition: border-color 0.14s ease, box-shadow 0.14s ease, color 0.14s ease;
}

.exp-menu-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
  box-shadow: 0 0 16px color-mix(in srgb, var(--accent) 26%, transparent);
}

.exp-menu-btn.primary {
  background: var(--accent);
  color: #051020;
  border-color: transparent;
}

.exp-menu-btn.primary:hover {
  color: #051020;
  box-shadow: 0 0 26px color-mix(in srgb, var(--accent) 60%, transparent);
}

.exp-pause-extra {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid rgba(244, 247, 255, 0.1);
  display: grid;
  gap: 12px;
}

.exp-setrow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--text-1);
}

.exp-setrow .val { color: var(--text-0); font-variant-numeric: tabular-nums; }

.exp-range {
  appearance: none;
  width: 150px;
  height: 5px;
  border-radius: 3px;
  background: linear-gradient(90deg, var(--accent) var(--fill, 50%), rgba(244,247,255,.14) var(--fill, 50%));
  outline-offset: 4px;
}

.exp-range::-webkit-slider-thumb {
  appearance: none;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: var(--text-0);
  border: 2px solid var(--accent);
  cursor: pointer;
}

/* --- Kết quả --- */
.exp-over-score { display: flex; align-items: baseline; gap: 16px; flex-wrap: wrap; margin: 8px 0 4px; }

.exp-over-score .num {
  font-size: clamp(2.2rem, 6vw, 3.2rem);
  font-weight: 800;
  color: var(--text-0);
  font-variant-numeric: tabular-nums;
  text-shadow: 0 0 26px color-mix(in srgb, var(--accent) 55%, transparent);
}

.exp-record {
  display: inline-block;
  padding: 4px 12px;
  border: 1px solid var(--gold);
  border-radius: 5px;
  color: var(--gold);
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.22em;
  box-shadow: 0 0 18px color-mix(in srgb, var(--gold) 40%, transparent);
  animation: expPulse 1.1s ease-in-out infinite alternate;
}

@keyframes expPulse { to { box-shadow: 0 0 30px color-mix(in srgb, var(--gold) 70%, transparent); } }

.exp-best-line { color: var(--text-1); font-size: 0.78rem; letter-spacing: 0.1em; margin-bottom: 14px; }
.exp-best-line b { color: var(--gold); }

.exp-statgrid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 9px;
  margin: 14px 0 4px;
}

.exp-statcard {
  border: 1px solid rgba(244, 247, 255, 0.12);
  border-radius: 8px;
  background: rgba(11, 17, 40, 0.8);
  padding: 10px 12px;
  text-align: center;
}

.exp-statcard .lbl {
  font-size: 0.58rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  color: var(--text-1);
  margin-bottom: 4px;
  white-space: nowrap;
}

.exp-statcard .val {
  font-size: 1.15rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: var(--text-0);
}

.exp-statcard[data-color="cyan"] .val { color: var(--cyan); }
.exp-statcard[data-color="pink"] .val { color: var(--pink); }
.exp-statcard[data-color="lime"] .val { color: var(--lime); }
.exp-statcard[data-color="gold"] .val { color: var(--gold); }
.exp-statcard[data-color="violet"] .val { color: var(--violet); }
.exp-statcard[data-color="green"] .val { color: var(--green); }
.exp-statcard[data-color="red"] .val { color: var(--red); }

/* --- Toast + banner --- */
.exp-toasts {
  position: absolute;
  left: 50%;
  bottom: 84px;
  transform: translateX(-50%);
  display: grid;
  gap: 6px;
  z-index: 35;
  pointer-events: none;
}

.exp-toast {
  padding: 7px 16px;
  border: 1px solid color-mix(in srgb, var(--accent) 50%, transparent);
  border-radius: 6px;
  background: rgba(7, 11, 28, 0.92);
  color: var(--text-0);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  animation: expToast 1.8s ease forwards;
  text-align: center;
}

@keyframes expToast {
  0% { opacity: 0; transform: translateY(8px); }
  12%, 82% { opacity: 1; transform: none; }
  100% { opacity: 0; transform: translateY(-6px); }
}

.exp-banner {
  position: absolute;
  left: 50%;
  top: 30%;
  transform: translate(-50%, -50%) scale(0.9);
  z-index: 34;
  padding: 10px 34px;
  border: 1px solid color-mix(in srgb, var(--accent) 60%, transparent);
  background: rgba(7, 11, 28, 0.88);
  clip-path: polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px);
  color: var(--text-0);
  font-size: clamp(1.1rem, 3vw, 1.7rem);
  font-weight: 800;
  letter-spacing: 0.3em;
  text-shadow: 0 0 20px color-mix(in srgb, var(--accent) 60%, transparent);
  opacity: 0;
  pointer-events: none;
}

.exp-banner.show { animation: expBanner 1.5s ease forwards; }

@keyframes expBanner {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.86); }
  14%, 78% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(1.05); }
}

/* ============================ RESPONSIVE ============================ */

@media (max-width: 900px) {
  .exp-stat { padding: 2px 10px; }
  .exp-stat .val { font-size: 1rem; }
  .exp-title .t { font-size: 0.95rem; }
}

@media (max-width: 700px) {
  .exp-topbar { gap: 8px; padding: 6px 8px; flex-wrap: wrap; min-height: 52px; }
  .exp-stat { padding: 2px 7px; }
  .exp-stat .lbl { letter-spacing: 0.14em; font-size: 0.52rem; }
  .exp-stat .val { font-size: 0.9rem; }
  .exp-stat[data-optional] { display: none; }
  .exp-btn { min-width: 44px; }
  .exp-btn .bl { display: none; }
  .exp-panel > .in { padding: 20px 18px; }
}
`;

exports.EXP_CSS = EXP_CSS;
};
__defs["games/portal-puzzle/engine.js"] = function (exports, __req) {
/**
 * engine.js — logic thuần của Portal Puzzle 404 (không DOM, test được
 * bằng node --test). Board lưới: tường, thùng đẩy (không kéo, không đẩy
 * 2 thùng), công tắc giữ/bật-tắt (xanh/tím), portal 2 chiều cyan/tím
 * (teleport 1 lần mỗi bước — không loop), laser chặn đường khi chưa tắt,
 * cửa thoát mở khi đủ điều kiện, giới hạn bước.
 *
 * Quy tắc an toàn laser: mọi tính hợp lệ đều xét trên TRẠNG THÁI SAU KHI
 * bước hoàn tất (thùng đã trượt, công tắc đã lật) — người chơi không bao
 * giờ được đứng trong tia laser đang bật.
 */

const DIRS = {
  U: { x: 0, y: -1 },
  D: { x: 0, y: 1 },
  L: { x: -1, y: 0 },
  R: { x: 1, y: 0 },
};

const PORTAL_CHARS = { 1: "cyan", 2: "violet" };
const SWITCH_CHARS = {
  s: { color: "blue", mode: "hold" },
  S: { color: "blue", mode: "toggle" },
  t: { color: "violet", mode: "hold" },
  T: { color: "violet", mode: "toggle" },
};

/**
 * Parse định nghĩa level (map ASCII + lasers) thành cấu trúc tĩnh + snap
 * khởi đầu. Ký tự map: '#' tường · '.' sàn · ' ' khoảng trống (đặc) ·
 * 'P' người chơi · 'C' thùng · 'E' lối thoát · s/S công tắc xanh
 * giữ/bật-tắt · t/T công tắc tím · '1' cặp portal cyan · '2' cặp portal
 * tím. Laser khai báo riêng: { x, y, dir, off } (off = màu công tắc tắt
 * được tia này).
 */
function parseLevel(def) {
  const rows = def.map;
  const h = rows.length;
  const w = rows[0].length;
  const solid = new Uint8Array(w * h);
  const level = {
    id: def.id,
    name: def.name || `MÀN ${def.id}`,
    w,
    h,
    solid,
    switches: [], // {x,y,color,mode}
    portals: [], // {x,y,color,pair} — pair = index endpoint kia
    lasers: (def.lasers || []).map((l) => ({ ...l })),
    exit: null,
    exitRequires: def.exitRequires || [],
    maxMoves: def.maxMoves,
    par: def.par || def.maxMoves,
    hint: def.hint || "",
    intro: def.intro || "",
  };
  let player = null;
  const crates = [];
  const toggles = [];
  const portalByColor = { cyan: [], violet: [] };

  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < w; x++) {
      const ch = x < row.length ? row[x] : " ";
      const i = y * w + x;
      if (ch === "#" || ch === " ") {
        solid[i] = ch === "#" ? 1 : 2; // 2 = void (đặc, không vẽ)
        continue;
      }
      if (ch === "P") player = { x, y };
      else if (ch === "C") crates.push({ x, y });
      else if (ch === "E") level.exit = { x, y };
      else if (SWITCH_CHARS[ch]) {
        const sw = SWITCH_CHARS[ch];
        level.switches.push({ x, y, color: sw.color, mode: sw.mode });
        if (sw.mode === "toggle") toggles.push(false);
      } else if (PORTAL_CHARS[ch]) {
        portalByColor[PORTAL_CHARS[ch]].push({ x, y, color: PORTAL_CHARS[ch] });
      }
    }
  }

  for (const color of ["cyan", "violet"]) {
    const pts = portalByColor[color];
    if (pts.length === 2) {
      const a = level.portals.length;
      level.portals.push({ ...pts[0], pair: a + 1 });
      level.portals.push({ ...pts[1], pair: a });
    }
  }

  // Emitter laser là ô đặc
  for (const l of level.lasers) solid[l.y * w + l.x] = 1;

  const snap = {
    player,
    crates,
    toggles, // theo thứ tự switch mode=toggle trong level.switches
    moves: 0,
  };
  return { level, snap };
}

function cloneSnap(s) {
  return {
    player: { x: s.player.x, y: s.player.y },
    crates: s.crates.map((c) => ({ x: c.x, y: c.y })),
    toggles: s.toggles.slice(),
    moves: s.moves,
  };
}

const idx = (level, x, y) => y * level.w + x;

function isSolid(level, x, y) {
  if (x < 0 || y < 0 || x >= level.w || y >= level.h) return true;
  return level.solid[idx(level, x, y)] !== 0;
}

function crateAt(snap, x, y) {
  for (let i = 0; i < snap.crates.length; i++) {
    if (snap.crates[i].x === x && snap.crates[i].y === y) return i;
  }
  return -1;
}

function portalAt(level, x, y) {
  for (const p of level.portals) {
    if (p.x === x && p.y === y) return p;
  }
  return null;
}

function toggleIndexAt(level, x, y) {
  let ti = 0;
  for (const sw of level.switches) {
    if (sw.mode !== "toggle") continue;
    if (sw.x === x && sw.y === y) return ti;
    ti++;
  }
  return -1;
}

/** Một màu công tắc đang "kích hoạt" — mọi công tắc màu đó đều bật. */
function colorActive(level, snap, color) {
  let count = 0;
  let ti = 0;
  for (const sw of level.switches) {
    const isToggle = sw.mode === "toggle";
    const myTi = isToggle ? ti++ : -1;
    if (sw.color !== color) continue;
    count++;
    if (isToggle) {
      if (!snap.toggles[myTi]) return false;
    } else {
      const occupied =
        (snap.player.x === sw.x && snap.player.y === sw.y) || crateAt(snap, sw.x, sw.y) >= 0;
      if (!occupied) return false;
    }
  }
  return count > 0;
}

/** Tập ô đang bị tia laser bao phủ (Set index). Thùng chặn tia. */
function computeBeams(level, snap) {
  const beams = new Set();
  for (const l of level.lasers) {
    if (l.off && colorActive(level, snap, l.off)) continue;
    const d = DIRS[l.dir];
    let x = l.x + d.x;
    let y = l.y + d.y;
    while (!isSolid(level, x, y) && crateAt(snap, x, y) < 0) {
      beams.add(idx(level, x, y));
      x += d.x;
      y += d.y;
    }
  }
  return beams;
}

function exitOpen(level, snap) {
  for (const color of level.exitRequires) {
    if (!colorActive(level, snap, color)) return false;
  }
  return true;
}

/**
 * Thực hiện một bước thuần túy: trả về { snap, events } mới hoặc
 * { denied } (không đổi state). events: pushed, teleported (player),
 * crateTeleported, toggled, steppedSwitch.
 */
function stepPure(level, snap, dirChar) {
  const d = DIRS[dirChar];
  if (!d) return { denied: "input" };
  const px = snap.player.x;
  const py = snap.player.y;
  const tx = px + d.x;
  const ty = py + d.y;
  if (isSolid(level, tx, ty)) return { denied: "wall" };

  const next = cloneSnap(snap);
  const events = { pushed: false, teleported: null, crateTeleported: null, toggled: false };

  const ci = crateAt(next, tx, ty);
  if (ci >= 0) {
    const cx2 = tx + d.x;
    const cy2 = ty + d.y;
    // Không đẩy 2 thùng, không đẩy vào tường/emitter, không đẩy lên lối thoát
    if (isSolid(level, cx2, cy2)) return { denied: "wall" };
    if (crateAt(next, cx2, cy2) >= 0) return { denied: "crate" };
    if (level.exit.x === cx2 && level.exit.y === cy2) return { denied: "exit" };
    let cfx = cx2;
    let cfy = cy2;
    const p = portalAt(level, cx2, cy2);
    if (p) {
      const q = level.portals[p.pair];
      const free =
        !isSolid(level, q.x, q.y) &&
        crateAt(next, q.x, q.y) < 0 &&
        !(next.player.x === q.x && next.player.y === q.y) &&
        !(level.exit.x === q.x && level.exit.y === q.y);
      if (free) {
        cfx = q.x;
        cfy = q.y;
        events.crateTeleported = { from: { x: cx2, y: cy2 }, to: { x: q.x, y: q.y }, color: p.color };
      }
    }
    next.crates[ci].x = cfx;
    next.crates[ci].y = cfy;
    events.pushed = true;
    const cti = toggleIndexAt(level, cfx, cfy);
    if (cti >= 0) {
      next.toggles[cti] = !next.toggles[cti];
      events.toggled = true;
    }
  }

  // Vị trí người chơi: bước tới, có thể teleport qua portal (1 lần)
  let fx = tx;
  let fy = ty;
  const pp = portalAt(level, tx, ty);
  let usedPortal = null;
  if (pp) {
    const q = level.portals[pp.pair];
    if (!isSolid(level, q.x, q.y) && crateAt(next, q.x, q.y) < 0) {
      usedPortal = { from: { x: tx, y: ty }, to: { x: q.x, y: q.y }, color: pp.color };
      fx = q.x;
      fy = q.y;
    }
  }

  const tryFinal = (x, y) => {
    const cand = cloneSnap(next);
    cand.player.x = x;
    cand.player.y = y;
    const ti = toggleIndexAt(level, x, y);
    let toggledPlayer = false;
    if (ti >= 0) {
      cand.toggles[ti] = !cand.toggles[ti];
      toggledPlayer = true;
    }
    const beams = computeBeams(level, cand);
    if (beams.has(idx(level, x, y))) return null;
    return { cand, toggledPlayer };
  };

  let final = tryFinal(fx, fy);
  if (!final && usedPortal) {
    // Cửa ra portal bị laser — portal từ chối, đứng lại trên ô portal
    usedPortal = null;
    final = tryFinal(tx, ty);
  }
  if (!final) return { denied: "laser" };

  const out = final.cand;
  out.moves = snap.moves + 1;
  if (usedPortal) events.teleported = usedPortal;
  if (final.toggledPlayer) events.toggled = true;
  const onSwitch = level.switches.some((sw) => sw.x === out.player.x && sw.y === out.player.y);
  events.steppedSwitch = onSwitch;
  const completed = out.player.x === level.exit.x && out.player.y === level.exit.y && exitOpen(level, out);
  return { snap: out, events, completed };
}

/** Chạy chuỗi lời giải trên level — dùng cho unit test 15 level. */
function runSolution(def, solution) {
  const { level, snap } = parseLevel(def);
  let cur = snap;
  for (let i = 0; i < solution.length; i++) {
    const r = stepPure(level, cur, solution[i]);
    if (r.denied) return { ok: false, at: i, reason: r.denied, moves: cur.moves };
    cur = r.snap;
    if (r.completed) {
      return { ok: true, moves: cur.moves, extraInput: i < solution.length - 1 };
    }
  }
  return { ok: false, at: solution.length, reason: "not-completed", moves: cur.moves };
}

exports.parseLevel = parseLevel; exports.cloneSnap = cloneSnap; exports.isSolid = isSolid; exports.crateAt = crateAt; exports.portalAt = portalAt; exports.colorActive = colorActive; exports.computeBeams = computeBeams; exports.exitOpen = exitOpen; exports.stepPure = stepPure; exports.runSolution = runSolution; exports.DIRS = DIRS;
};
__defs["games/portal-puzzle/levels.js"] = function (exports, __req) {
/**
 * levels.js — 15 màn Portal Puzzle 404 (data-driven, JS module thuần —
 * bundler offline không hỗ trợ import JSON).
 *
 * Ký tự map: '#' tường · '.' sàn · 'P' người chơi · 'C' thùng gỗ ·
 * 'E' lối thoát · 's'/'S' công tắc xanh giữ/bật-tắt · 't'/'T' công tắc
 * tím giữ/bật-tắt · '1' cặp cổng cyan · '2' cặp cổng tím.
 * Laser: { x, y, dir: U/D/L/R, off: màu công tắc tắt tia (null = không
 * tắt được, phải chặn bằng thùng) }.
 *
 * `hint` là lời giải NGẮN NHẤT do solver BFS sinh ra và được unit test
 * (tools/expansion5.test.mjs) chạy lại để bảo đảm 15 màn đều có lời
 * giải hợp lệ trong giới hạn bước. par = số bước tối ưu.
 */

const LEVELS = [
  {
    id: 1,
    name: "KHỞI ĐỘNG",
    intro: "Đưa nhà thám hiểm đến Ô THOÁT màu xanh lá. Mỗi ô đi qua tốn một bước — chú ý giới hạn bước!",
    exitRequires: [],
    lasers: [],
    par: 7,
    maxMoves: 11,
    hint: "RRDDRRR",
    map: [
      "########",
      "#P..#..#",
      "#.#.#.##",
      "#.#...E#",
      "#...#..#",
      "########",
    ],
  },
  {
    id: 2,
    name: "CỔNG XANH",
    intro: "Cổng dịch chuyển cyan hoạt động HAI CHIỀU: bước vào một đầu, bạn xuất hiện ở đầu kia.",
    exitRequires: [],
    lasers: [],
    par: 6,
    maxMoves: 10,
    hint: "DDRUUR",
    map: [
      "#########",
      "#P...#.E#",
      "#....#..#",
      "#.1..#1.#",
      "#....#..#",
      "#########",
    ],
  },
  {
    id: 3,
    name: "THÙNG GỖ",
    intro: "Thùng gỗ chỉ ĐẨY được, không kéo. Không thể đẩy hai thùng cùng lúc.",
    exitRequires: [],
    lasers: [],
    par: 6,
    maxMoves: 10,
    hint: "RRDDLL",
    map: [
      "#########",
      "#P......#",
      "###C###.#",
      "#E..#...#",
      "#...#...#",
      "#.......#",
      "#########",
    ],
  },
  {
    id: 4,
    name: "CÔNG TẮC GIỮ",
    intro: "Công tắc GIỮ màu xanh chỉ hoạt động khi có vật đè lên. Đặt thùng lên để mở lối thoát.",
    exitRequires: ["blue"],
    lasers: [],
    par: 17,
    maxMoves: 25,
    hint: "RDLDRRRDDRRUUUURR",
    map: [
      "##########",
      "#P...#..E#",
      "#.C..#...#",
      "#....s...#",
      "#....#...#",
      "#........#",
      "##########",
    ],
  },
  {
    id: 5,
    name: "TIA LASER",
    intro: "Laser đỏ chặn đường đi. Công tắc BẬT-TẮT màu xanh giữ nguyên trạng thái sau khi bạn rời khỏi nó.",
    exitRequires: [],
    lasers: [{ x: 5, y: 0, dir: "D", off: "blue" }],
    par: 10,
    maxMoves: 15,
    hint: "DDRRDRRRRR",
    map: [
      "##########",
      "#P.......#",
      "#........#",
      "#..S.....#",
      "#.......E#",
      "#........#",
      "##########",
    ],
  },
  {
    id: 6,
    name: "HAI SẮC CỔNG",
    intro: "Cổng cyan nối với cổng cyan, cổng tím nối với cổng tím. Chọn đúng cổng để không đi vòng vô ích.",
    exitRequires: [],
    lasers: [],
    par: 6,
    maxMoves: 10,
    hint: "DDDRUR",
    map: [
      "###########",
      "#P...#...E#",
      "#.1..#..2.#",
      "#....#....#",
      "#.2..#..1.#",
      "#....#....#",
      "###########",
    ],
  },
  {
    id: 7,
    name: "CHẮN TIA",
    intro: "Không có công tắc nào tắt được tia này — nhưng THÙNG GỖ chặn được laser. Che chắn rồi đi vòng.",
    exitRequires: [],
    lasers: [{ x: 0, y: 5, dir: "R", off: null }],
    par: 18,
    maxMoves: 27,
    hint: "DRRRURDDDURRRRDDLL",
    map: [
      "###########",
      "#P........#",
      "#...C.....#",
      "#.........#",
      "#####.###.#",
      "#......E..#",
      "###########",
    ],
  },
  {
    id: 8,
    name: "THÙNG XUYÊN CỔNG",
    intro: "Thùng cũng đi xuyên qua cổng dịch chuyển! Đẩy thùng vào cổng để đưa nó sang khu vực bên kia.",
    exitRequires: ["blue"],
    lasers: [],
    par: 21,
    maxMoves: 31,
    hint: "RRRDDLDDRDUDRRURRUUUR",
    map: [
      "############",
      "#P..C1.#...#",
      "#......#.E.#",
      "#......#...#",
      "###.####...#",
      "#...1s.....#",
      "#..........#",
      "############",
    ],
  },
  {
    id: 9,
    name: "ĐÈ CÔNG TẮC TÍM",
    intro: "Công tắc giữ màu TÍM tắt tia laser. Bạn không thể vừa đứng đè vừa đi tiếp — hãy dùng thùng.",
    exitRequires: [],
    lasers: [{ x: 6, y: 0, dir: "D", off: "violet" }],
    par: 11,
    maxMoves: 16,
    hint: "DRRRRDDRRRR",
    map: [
      "############",
      "#P.........#",
      "#..C.......#",
      "#..........#",
      "#..t.....E.#",
      "#..........#",
      "############",
    ],
  },
  {
    id: 10,
    name: "HAI MÀU HAI THÙNG",
    intro: "Lối thoát cần CẢ công tắc xanh lẫn tím cùng hoạt động. Mỗi thùng một nhiệm vụ.",
    exitRequires: ["blue", "violet"],
    lasers: [],
    par: 23,
    maxMoves: 34,
    hint: "DRRRRRDLLLLLDRRRRRDRRRR",
    map: [
      "############",
      "#P.........#",
      "#.C....s...#",
      "#..........#",
      "#.C....t...#",
      "#.........E#",
      "#..........#",
      "############",
    ],
  },
  {
    id: 11,
    name: "CỔNG SAU LASER",
    intro: "Muốn tắt tia laser phải đến được công tắc — và đường duy nhất là đi xuyên cổng dịch chuyển.",
    exitRequires: [],
    lasers: [{ x: 8, y: 0, dir: "D", off: "blue" }],
    par: 11,
    maxMoves: 16,
    hint: "DDRUUUUURRR",
    map: [
      "############",
      "#P...#....E#",
      "#....#.....#",
      "#.1..#.....#",
      "#....#.S...#",
      "#....#.....#",
      "#....#.1...#",
      "#....#.....#",
      "############",
    ],
  },
  {
    id: 12,
    name: "TIẾP SỨC HAI CỔNG",
    intro: "Thứ tự là tất cả: cổng chỉ nhận một vật mỗi đầu. Chặn một đầu cổng để không bị hút ngược lại.",
    exitRequires: ["blue"],
    lasers: [],
    par: 24,
    maxMoves: 35,
    hint: "DDRDDDDDDLDDRUUDUUDRDDDR",
    map: [
      "#############",
      "#P....#.2...#",
      "#..C..#.s...#",
      "#.C1..#.....#",
      "#.....#.....#",
      "#.....#.1...#",
      "#.2...#.....#",
      "#.....#...E.#",
      "#############",
    ],
  },
  {
    id: 13,
    name: "HAI TIA GIAO NHAU",
    intro: "Tia dọc tắt bằng công tắc tím. Tia ngang không tắt được — hãy chắn nó bằng thùng gỗ.",
    exitRequires: [],
    lasers: [
      { x: 6, y: 0, dir: "D", off: "violet" },
      { x: 0, y: 6, dir: "R", off: null },
    ],
    par: 19,
    maxMoves: 28,
    hint: "RRRDDDLLRRDRDRRRRRR",
    map: [
      "#############",
      "#P..........#",
      "#...C.......#",
      "#...........#",
      "#.T.........#",
      "#...........#",
      "#..........E#",
      "#...........#",
      "#############",
    ],
  },
  {
    id: 14,
    name: "HÀNH LANG SONG SONG",
    intro: "Thùng đi cổng cyan, người đi cổng tím. Tắt laser trước khi băng qua hành lang bên phải.",
    exitRequires: ["blue"],
    lasers: [{ x: 13, y: 2, dir: "L", off: "violet" }],
    par: 25,
    maxMoves: 37,
    hint: "RRRDDDDLDLUUUUURDUDDRUUUR",
    map: [
      "##############",
      "#P.....#....E#",
      "#...C..#.....#",
      "#...1..#..1..#",
      "#......#.....#",
      "#..T...#..s..#",
      "#.2....#.....#",
      "#......#.2...#",
      "#......#.....#",
      "##############",
    ],
  },
  {
    id: 15,
    name: "PHÒNG MÁY CHỦ",
    intro: "Màn cuối: hai thùng, hai công tắc, một tia laser và một cổng dịch chuyển dẫn tới lõi 404.",
    exitRequires: ["blue", "violet"],
    lasers: [{ x: 0, y: 7, dir: "R", off: "blue" }],
    par: 32,
    maxMoves: 47,
    hint: "DRRRURDDUURRRRRRDDRDLLLDRRRLLLLL",
    map: [
      "##############",
      "#P...........#",
      "#.C........C.#",
      "#............#",
      "#....s..t....#",
      "#...........1#",
      "##############",
      "#....E....1..#",
      "#............#",
      "##############",
    ],
  },
];

exports.LEVELS = LEVELS;
};
__defs["games/portal-puzzle/render.js"] = function (exports, __req) {
/**
 * render.js — vẽ board Portal Puzzle 404 bằng Canvas 2D theo ảnh
 * reference: nền navy, tường bevel slate, robot trắng mắt cyan, thùng
 * gỗ chữ X, công tắc tròn xanh/tím, cổng xoáy cyan/tím nối nhau bằng
 * nét đứt, laser đỏ lõi trắng, ô thoát xanh lá phát sáng.
 */

const { DIRS, computeBeams, exitOpen, colorActive } = __req("games/portal-puzzle/engine.js");

const COL = {
  bgOut: "#05081a",
  floorA: "#111834",
  floorB: "#0e142d",
  floorLine: "rgba(96, 128, 210, 0.14)",
  wallTop: "#3a4877",
  wallFace: "#232d55",
  wallDark: "#161d3c",
  cyan: "#20e3ff",
  violet: "#9a5cff",
  blue: "#3b7bff",
  lime: "#a8ff3e",
  green: "#4df77f",
  red: "#ff4f64",
  wood: "#96622e",
  woodDark: "#5f3c17",
  woodLight: "#c08a4a",
  robot: "#eef2ff",
};

/* ---------------- Các painter nguyên tử (theo ô, gốc 0,0, cạnh t) ---------------- */

function drawFloor(g, x, y, t, alt) {
  g.fillStyle = alt ? COL.floorA : COL.floorB;
  g.fillRect(x, y, t, t);
  g.strokeStyle = COL.floorLine;
  g.lineWidth = 1;
  g.strokeRect(x + 0.5, y + 0.5, t - 1, t - 1);
  // đinh tán 4 góc mờ
  g.fillStyle = "rgba(96,128,210,0.16)";
  const o = Math.max(2, t * 0.07);
  g.fillRect(x + o, y + o, 1.6, 1.6);
  g.fillRect(x + t - o - 1.6, y + o, 1.6, 1.6);
  g.fillRect(x + o, y + t - o - 1.6, 1.6, 1.6);
  g.fillRect(x + t - o - 1.6, y + t - o - 1.6, 1.6, 1.6);
}

function drawWall(g, x, y, t) {
  g.fillStyle = COL.wallDark;
  g.fillRect(x, y, t, t);
  const b = Math.max(2, t * 0.14);
  g.fillStyle = COL.wallFace;
  g.fillRect(x + 1, y + 1, t - 2, t - 2);
  g.fillStyle = COL.wallTop;
  g.fillRect(x + 1, y + 1, t - 2, b);
  g.fillRect(x + 1, y + 1, b, t - 2);
  g.fillStyle = COL.wallDark;
  g.fillRect(x + t - 1 - b * 0.6, y + 2, b * 0.6, t - 3);
  g.fillRect(x + 2, y + t - 1 - b * 0.6, t - 3, b * 0.6);
}

function drawExit(g, x, y, t, open, time) {
  const cx = x + t / 2;
  const cy = y + t / 2;
  const pulse = open ? 0.7 + Math.sin(time * 3.2) * 0.3 : 0.25;
  const color = open ? COL.green : "rgba(120,160,140,0.75)";
  g.save();
  if (open) {
    g.shadowColor = COL.green;
    g.shadowBlur = t * 0.5 * pulse;
  }
  g.strokeStyle = color;
  g.lineWidth = Math.max(2, t * 0.08);
  const m = t * 0.16;
  g.strokeRect(x + m, y + m, t - m * 2, t - m * 2);
  // kim cương lồng nhau (như icon trong ảnh)
  g.beginPath();
  g.moveTo(cx, y + m * 1.7);
  g.lineTo(x + t - m * 1.7, cy);
  g.lineTo(cx, y + t - m * 1.7);
  g.lineTo(x + m * 1.7, cy);
  g.closePath();
  g.stroke();
  g.fillStyle = color;
  const d = t * 0.09;
  g.fillRect(cx - d, cy - d, d * 2, d * 2);
  g.restore();
  // tam giác chỉ xuống phía trên ô (chỉ khi mở)
  if (open) {
    const bob = Math.sin(time * 4) * t * 0.06;
    g.fillStyle = `rgba(77,247,127,${0.55 + Math.sin(time * 4) * 0.2})`;
    g.beginPath();
    g.moveTo(cx - t * 0.14, y - t * 0.3 + bob);
    g.lineTo(cx + t * 0.14, y - t * 0.3 + bob);
    g.lineTo(cx, y - t * 0.12 + bob);
    g.closePath();
    g.fill();
  }
}

function drawSwitch(g, x, y, t, color, mode, active, time) {
  const cx = x + t / 2;
  const cy = y + t / 2;
  const c = color === "blue" ? COL.blue : COL.violet;
  const r = t * 0.3;
  // đế
  g.fillStyle = "#0a0f24";
  g.beginPath();
  if (mode === "toggle") {
    const rr = r * 1.25;
    g.roundRect(cx - rr, cy - rr, rr * 2, rr * 2, rr * 0.35);
  } else {
    g.arc(cx, cy, r * 1.3, 0, Math.PI * 2);
  }
  g.fill();
  g.strokeStyle = "rgba(96,128,210,0.4)";
  g.lineWidth = 1.4;
  g.stroke();
  // lõi phát sáng
  g.save();
  g.shadowColor = c;
  g.shadowBlur = active ? t * 0.55 : t * 0.18;
  g.fillStyle = c;
  g.globalAlpha = active ? 1 : 0.55;
  g.beginPath();
  g.arc(cx, cy, r * (active ? 0.82 : 0.62), 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 1;
  g.fillStyle = "rgba(255,255,255,0.85)";
  g.beginPath();
  g.arc(cx - r * 0.22, cy - r * 0.22, r * 0.2, 0, Math.PI * 2);
  g.fill();
  g.restore();
  if (active) {
    g.strokeStyle = c;
    g.globalAlpha = 0.5 + Math.sin(time * 5) * 0.25;
    g.lineWidth = 1.6;
    g.beginPath();
    g.arc(cx, cy, r * 1.15, 0, Math.PI * 2);
    g.stroke();
    g.globalAlpha = 1;
  }
}

function drawPortal(g, x, y, t, color, time) {
  const cx = x + t / 2;
  const cy = y + t / 2;
  const c = color === "cyan" ? COL.cyan : COL.violet;
  const rx = t * 0.3;
  const ry = t * 0.38;
  g.save();
  g.translate(cx, cy);
  // lòng cổng tối
  g.fillStyle = "#04060f";
  g.beginPath();
  g.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  g.fill();
  // vòng ngoài phát sáng
  g.shadowColor = c;
  g.shadowBlur = t * 0.4;
  g.strokeStyle = c;
  g.lineWidth = Math.max(2, t * 0.09);
  g.beginPath();
  g.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  g.stroke();
  g.shadowBlur = 0;
  // xoáy bên trong
  g.strokeStyle = `rgba(255,255,255,0.65)`;
  g.lineWidth = 1.4;
  for (let i = 0; i < 2; i++) {
    const a = time * 2.4 + i * Math.PI;
    g.beginPath();
    g.ellipse(0, 0, rx * 0.55, ry * 0.55, 0, a, a + Math.PI * 0.9);
    g.stroke();
  }
  // hạt sáng bay quanh
  const pa = time * 3 + (color === "cyan" ? 0 : 2);
  g.fillStyle = c;
  g.beginPath();
  g.arc(Math.cos(pa) * rx * 0.95, Math.sin(pa) * ry * 0.95, 1.8, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

function drawCrate(g, x, y, t) {
  const m = t * 0.12;
  const s = t - m * 2;
  g.fillStyle = COL.wood;
  g.fillRect(x + m, y + m, s, s);
  g.strokeStyle = COL.woodDark;
  g.lineWidth = Math.max(2, t * 0.07);
  g.strokeRect(x + m + 1, y + m + 1, s - 2, s - 2);
  // chữ X ván gỗ
  g.strokeStyle = COL.woodLight;
  g.lineWidth = Math.max(2, t * 0.09);
  g.beginPath();
  g.moveTo(x + m + 3, y + m + 3);
  g.lineTo(x + m + s - 3, y + m + s - 3);
  g.moveTo(x + m + s - 3, y + m + 3);
  g.lineTo(x + m + 3, y + m + s - 3);
  g.stroke();
  // đinh 4 góc
  g.fillStyle = COL.woodDark;
  const o = m + 2.5;
  for (const [bx, by] of [[o, o], [t - o, o], [o, t - o], [t - o, t - o]]) {
    g.beginPath();
    g.arc(x + bx, y + by, Math.max(1.2, t * 0.035), 0, Math.PI * 2);
    g.fill();
  }
  // bóng đỉnh
  g.fillStyle = "rgba(255,255,255,0.14)";
  g.fillRect(x + m, y + m, s, Math.max(2, t * 0.08));
}

function drawEmitter(g, x, y, t, dir, on, time) {
  const cx = x + t / 2;
  const cy = y + t / 2;
  g.fillStyle = "#2a0d16";
  g.fillRect(x + 2, y + 2, t - 4, t - 4);
  g.strokeStyle = on ? COL.red : "rgba(255,79,100,0.4)";
  g.lineWidth = 2;
  g.strokeRect(x + 3, y + 3, t - 6, t - 6);
  // vấu hướng bắn
  const d = DIRS[dir];
  g.fillStyle = on ? COL.red : "rgba(255,79,100,0.4)";
  g.fillRect(cx + d.x * t * 0.28 - t * 0.1, cy + d.y * t * 0.28 - t * 0.1, t * 0.2, t * 0.2);
  // thấu kính
  g.save();
  if (on) {
    g.shadowColor = COL.red;
    g.shadowBlur = t * (0.35 + Math.sin(time * 8) * 0.1);
  }
  g.fillStyle = on ? "#ff8391" : "#5d2733";
  g.beginPath();
  g.arc(cx, cy, t * 0.16, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

function drawRobot(g, x, y, t, facing, time, dying) {
  const cx = x + t / 2;
  const bob = Math.sin(time * 3.4) * t * 0.035;
  const cy = y + t / 2 + bob;
  const w = t * 0.58;
  const h = t * 0.52;
  g.save();
  // quầng sáng chân
  g.fillStyle = "rgba(32,227,255,0.18)";
  g.beginPath();
  g.ellipse(cx, y + t * 0.86, t * 0.3, t * 0.1, 0, 0, Math.PI * 2);
  g.fill();
  // chân
  g.fillStyle = "#b9c3de";
  g.fillRect(cx - w * 0.32, cy + h * 0.34, w * 0.22, t * 0.16);
  g.fillRect(cx + w * 0.1, cy + h * 0.34, w * 0.22, t * 0.16);
  // thân
  g.fillStyle = dying ? "#ffb3ba" : COL.robot;
  g.beginPath();
  g.roundRect(cx - w / 2, cy - h / 2, w, h, t * 0.14);
  g.fill();
  // tai anten
  g.fillStyle = "#b9c3de";
  g.fillRect(cx - w * 0.62, cy - h * 0.18, w * 0.14, h * 0.36);
  g.fillRect(cx + w * 0.48, cy - h * 0.18, w * 0.14, h * 0.36);
  // visor
  const fx = (facing?.x || 0) * t * 0.05;
  const fy = (facing?.y || 0) * t * 0.04;
  g.fillStyle = "#0a1224";
  g.beginPath();
  g.roundRect(cx - w * 0.34 + fx, cy - h * 0.3 + fy, w * 0.68, h * 0.42, t * 0.08);
  g.fill();
  // mắt cyan
  g.save();
  g.shadowColor = COL.cyan;
  g.shadowBlur = t * 0.22;
  g.fillStyle = COL.cyan;
  const blink = Math.sin(time * 1.7) > 0.97 ? 0.25 : 1;
  const ew = t * 0.075;
  const eh = t * 0.1 * blink;
  g.fillRect(cx - w * 0.18 + fx - ew / 2, cy - h * 0.1 + fy - eh / 2, ew, eh);
  g.fillRect(cx + w * 0.18 + fx - ew / 2, cy - h * 0.1 + fy - eh / 2, ew, eh);
  g.restore();
  g.restore();
}

/* ---------------- Renderer chính ---------------- */

function createBoardRenderer(canvas, container) {
  const g = canvas.getContext("2d");
  let dpr = 1;
  let cw = 0;
  let ch = 0;

  function fit() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cw = container.clientWidth;
    ch = container.clientHeight;
    canvas.width = Math.max(1, Math.round(cw * dpr));
    canvas.height = Math.max(1, Math.round(ch * dpr));
  }

  /** Trả về hình học ô hiện tại để index.js quy đổi tọa độ chạm. */
  function geometry(level) {
    const pad = 18;
    const t = Math.max(16, Math.min(76, Math.floor(Math.min((cw - pad * 2) / level.w, (ch - pad * 2) / level.h))));
    const ox = Math.floor((cw - t * level.w) / 2);
    const oy = Math.floor((ch - t * level.h) / 2);
    return { t, ox, oy };
  }

  function draw(level, snap, fx, time) {
    if (cw === 0) fit();
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, cw, ch);

    // nền ngoài board: chấm sao mờ
    g.fillStyle = COL.bgOut;
    g.fillRect(0, 0, cw, ch);
    g.fillStyle = "rgba(96,128,210,0.1)";
    for (let i = 0; i < 40; i++) {
      const sx = ((i * 97) % 173) / 173 * cw;
      const sy = ((i * 61) % 149) / 149 * ch;
      g.fillRect(sx, sy, 1.5, 1.5);
    }

    const { t, ox, oy } = geometry(level);
    const px = (gx) => ox + gx * t;
    const py = (gy) => oy + gy * t;

    const beams = computeBeams(level, snap);
    const open = exitOpen(level, snap);

    // đế board
    g.fillStyle = "#0a1026";
    g.beginPath();
    g.roundRect(ox - 8, oy - 8, level.w * t + 16, level.h * t + 16, 10);
    g.fill();
    g.strokeStyle = "rgba(58,72,119,0.8)";
    g.lineWidth = 2;
    g.stroke();

    // sàn + tường
    for (let y = 0; y < level.h; y++) {
      for (let x = 0; x < level.w; x++) {
        const s = level.solid[y * level.w + x];
        if (s === 2) continue; // void
        if (s === 1) drawWall(g, px(x), py(y), t);
        else drawFloor(g, px(x), py(y), t, (x + y) % 2 === 0);
      }
    }

    // nét đứt nối cặp cổng (như ảnh)
    g.save();
    const seen = new Set();
    for (let i = 0; i < level.portals.length; i++) {
      const p = level.portals[i];
      if (seen.has(i) || seen.has(p.pair)) continue;
      seen.add(i);
      const q = level.portals[p.pair];
      const c = p.color === "cyan" ? COL.cyan : COL.violet;
      g.strokeStyle = c;
      g.globalAlpha = 0.3;
      g.setLineDash([6, 8]);
      g.lineDashOffset = -time * 22;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(px(p.x) + t / 2, py(p.y) + t / 2);
      g.lineTo(px(q.x) + t / 2, py(q.y) + t / 2);
      g.stroke();
    }
    g.restore();

    // ô thoát
    drawExit(g, px(level.exit.x), py(level.exit.y), t, open, time);

    // công tắc
    for (const sw of level.switches) {
      let active;
      if (sw.mode === "toggle") {
        let ti = 0;
        for (const other of level.switches) {
          if (other.mode !== "toggle") continue;
          if (other === sw) break;
          ti++;
        }
        active = snap.toggles[ti];
      } else {
        active =
          (snap.player.x === sw.x && snap.player.y === sw.y) ||
          snap.crates.some((c) => c.x === sw.x && c.y === sw.y);
      }
      drawSwitch(g, px(sw.x), py(sw.y), t, sw.color, sw.mode, active, time);
    }

    // cổng
    for (const p of level.portals) drawPortal(g, px(p.x), py(p.y), t, p.color, time);

    // tia laser (vẽ dưới thùng để thùng che tia)
    for (const l of level.lasers) {
      const on = !(l.off && colorActive(level, snap, l.off));
      if (on) {
        const d = DIRS[l.dir];
        let bx = l.x + d.x;
        let by = l.y + d.y;
        let len = 0;
        while (beams.has(by * level.w + bx)) {
          len++;
          bx += d.x;
          by += d.y;
        }
        if (len > 0) {
          const x0 = px(l.x) + t / 2 + d.x * t * 0.34;
          const y0 = py(l.y) + t / 2 + d.y * t * 0.34;
          const x1 = px(l.x + d.x * len) + t / 2 + d.x * t * 0.5;
          const y1 = py(l.y + d.y * len) + t / 2 + d.y * t * 0.5;
          const flick = 0.75 + Math.sin(time * 26) * 0.12;
          g.save();
          g.lineCap = "round";
          g.strokeStyle = `rgba(255,42,63,${0.3 * flick})`;
          g.lineWidth = t * 0.3;
          g.beginPath();
          g.moveTo(x0, y0);
          g.lineTo(x1, y1);
          g.stroke();
          g.strokeStyle = `rgba(255,79,100,${0.85 * flick})`;
          g.lineWidth = t * 0.12;
          g.beginPath();
          g.moveTo(x0, y0);
          g.lineTo(x1, y1);
          g.stroke();
          g.strokeStyle = `rgba(255,240,244,${0.9 * flick})`;
          g.lineWidth = Math.max(1.4, t * 0.04);
          g.beginPath();
          g.moveTo(x0, y0);
          g.lineTo(x1, y1);
          g.stroke();
          g.restore();
        }
      }
      drawEmitter(g, px(l.x), py(l.y), t, l.dir, on, time);
    }

    // thùng
    for (const c of snap.crates) drawCrate(g, px(c.x), py(c.y), t);

    // hiệu ứng teleport
    for (const tp of fx.teleports) {
      const k = (time - tp.t0) / 0.45;
      if (k > 1) continue;
      const c = tp.color === "cyan" ? COL.cyan : COL.violet;
      g.strokeStyle = c;
      g.globalAlpha = (1 - k) * 0.85;
      g.lineWidth = 2.4;
      g.beginPath();
      g.arc(px(tp.x) + t / 2, py(tp.y) + t / 2, t * (0.2 + k * 0.55), 0, Math.PI * 2);
      g.stroke();
      g.globalAlpha = 1;
    }

    // robot (kèm animation trượt + rung khi bị chặn)
    let rx = snap.player.x;
    let ry = snap.player.y;
    if (fx.moveAnim) {
      const k = Math.min(1, (time - fx.moveAnim.t0) / 0.09);
      rx = fx.moveAnim.fx + (snap.player.x - fx.moveAnim.fx) * k;
      ry = fx.moveAnim.fy + (snap.player.y - fx.moveAnim.fy) * k;
      if (k >= 1) fx.moveAnim = null;
    }
    let shakeX = 0;
    let shakeY = 0;
    if (fx.deny && time - fx.deny.t0 < 0.24) {
      const kk = (time - fx.deny.t0) / 0.24;
      const amp = Math.sin(kk * Math.PI * 4) * (1 - kk) * t * 0.07;
      shakeX = fx.deny.dx * amp;
      shakeY = fx.deny.dy * amp;
    }
    drawRobot(g, px(rx) + shakeX, py(ry) + shakeY, t, fx.facing, time, false);

    // mũi tên gợi ý
    if (fx.hint && time < fx.hint.until) {
      const d = DIRS[fx.hint.dir];
      const hx = px(snap.player.x + d.x) + t / 2;
      const hy = py(snap.player.y + d.y) + t / 2;
      const a = 0.55 + Math.sin(time * 6) * 0.35;
      g.save();
      g.translate(hx, hy);
      g.rotate(Math.atan2(d.y, d.x));
      g.fillStyle = `rgba(168,255,62,${a})`;
      g.shadowColor = COL.lime;
      g.shadowBlur = 10;
      g.beginPath();
      g.moveTo(t * 0.22, 0);
      g.lineTo(-t * 0.1, -t * 0.2);
      g.lineTo(-t * 0.1, t * 0.2);
      g.closePath();
      g.fill();
      g.restore();
    }
  }

  return { fit, geometry, draw };
}

/* ---------------- Icon chú giải sidebar (canvas nhỏ) ---------------- */

function paintLegendIcon(canvas, kind) {
  const size = 26;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  const g = canvas.getContext("2d");
  g.scale(dpr, dpr);
  const t = size;
  switch (kind) {
    case "player":
      drawRobot(g, 0, 0, t, { x: 0, y: 0 }, 1.2, false);
      break;
    case "crate":
      drawCrate(g, 0, 0, t);
      break;
    case "switch-blue":
      drawSwitch(g, 0, 0, t, "blue", "hold", true, 1);
      break;
    case "switch-violet":
      drawSwitch(g, 0, 0, t, "violet", "hold", true, 1);
      break;
    case "portal-cyan":
      drawPortal(g, 0, 0, t, "cyan", 1.1);
      break;
    case "portal-violet":
      drawPortal(g, 0, 0, t, "violet", 2.3);
      break;
    case "laser":
      drawEmitter(g, 0, 0, t, "D", true, 1);
      break;
    case "exit":
      drawExit(g, 0, 0, t, true, 1.3);
      break;
  }
}

exports.createBoardRenderer = createBoardRenderer; exports.paintLegendIcon = paintLegendIcon;
};
__defs["games/portal-puzzle/styles.js"] = function (exports, __req) {
/**
 * styles.js — CSS riêng của Portal Puzzle 404 (sidebar mục tiêu + chú
 * giải bên trái, board giữa, thanh hành động HOÀN TÁC / CHƠI LẠI / GỢI Ý
 * bên dưới — theo bố cục ảnh reference).
 */

const PP_CSS = /* css */ `
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

exports.PP_CSS = PP_CSS;
};
__defs["games/void-runner/index.js"] = function (exports, __req) {
/**
 * VOID RUNNER 404 — parkour 3D góc nhìn thứ nhất (desktop-first).
 *
 * Theo plan: chạy / sprint / nhảy (coyote + buffer) / trượt / wall-run
 * qua 8 zone (xuất phát → nhảy → wall-run → trượt → platform động →
 * laser → leap cuối → đích) trên các công trình lơ lửng giữa thành phố
 * cyber. 8 checkpoint, respawn + penalty khi rơi/chạm laser, energy
 * shard + combo, timer mm:ss.mmm + best time. HUD/start/pause/results
 * dựng đúng theo 5 ảnh reference. Renderer: engine WebGL thuần dùng
 * chung với 404 Strike (máy offline không cài được Three.js).
 */

const { createEngine } = __req("games/strike/engine.js");
const { createWorld } = __req("games/void-runner/world.js");
const { createPlayer } = __req("games/void-runner/player.js");
const { createGloves } = __req("games/void-runner/gloves.js");
const { createVrFx } = __req("games/void-runner/fx.js");
const { createVrHud } = __req("games/void-runner/hud.js");
const { createVrScreens } = __req("games/void-runner/screens.js");
const { VOID_RUNNER_CSS } = __req("games/void-runner/styles.js");
const { createKeyboard } = __req("core/input-manager.js");
const { VR_COLORS, VR_MOVE, VR_ENERGY, VR_DIFFICULTY, VR_QUALITY_SCALE, VR_TOTAL_CHECKPOINTS, VR_SETTINGS_KEY, VR_BEST_TIME_KEY } = __req("games/void-runner/config.js");

function createGame() {
  let ctx = null;
  let wrap = null;
  let canvas = null;
  let engine = null;
  let world = null;
  let player = null;
  let gloves = null;
  let fx = null;
  let hud = null;
  let screens = null;
  let keys = null;
  let ro = null;

  let destroyed = false;
  let rafId = 0;
  let lastT = 0;

  // blocked | idle | run | paused (trong run) | over
  let mode = "blocked";
  let paused = false;
  let dying = false;

  let locked = false;
  let lockHintAt = 0;

  let lookDx = 0;
  let lookDy = 0;
  let slideHeld = false;

  const TEST = typeof window !== "undefined" && window.__ARCADE_VOIDRUNNER_TEST__;

  const settings = {
    difficulty: "normal",
    quality: "auto",
    volume: 80,
    sensitivity: 1.25,
    fov: 90,
    shake: true,
    reduceMotion: false,
  };
  const motion = { reduced: false };
  let autoScale = 0.82;
  let fpsAccum = 0;
  let fpsFrames = 0;
  let fpsTimer = 0;

  // Trạng thái lượt chạy
  let runTime = 0;          // giây (gồm penalty)
  let checkpointCount = 0;  // 0..7 cổng đã qua (đích = 8)
  let energy = VR_ENERGY.start;
  let energyDelay = 0;
  let combo = 0;
  let comboIdleT = 0;
  let maxCombo = 0;
  let shardsGot = 0;
  let falls = 0;
  let maxSpeed = 0;
  let bonusScore = 0;
  let idleAngle = 0;

  /* ================= Cài đặt ================= */

  function syncMotion() {
    motion.reduced = !!(ctx.reducedMotion || settings.reduceMotion);
  }

  function loadSettings() {
    const saved = ctx.storage.getPref(VR_SETTINGS_KEY, null);
    if (saved && typeof saved === "object") Object.assign(settings, saved);
    if (ctx.config?.quality && ctx.config.quality !== "auto" && !saved?.quality) {
      settings.quality = ctx.config.quality;
    }
    ctx.audio.setVolume(settings.volume / 100);
    syncMotion();
  }

  function persistSettings() {
    ctx.storage.setPref(VR_SETTINGS_KEY, { ...settings });
  }

  function currentScale() {
    if (settings.quality === "auto") return autoScale;
    return VR_QUALITY_SCALE[settings.quality] ?? 0.82;
  }

  function applyQuality() {
    if (!engine || !wrap) return;
    engine.resize(wrap.clientWidth, wrap.clientHeight, currentScale());
  }

  function applySettings(partial) {
    if (partial.volume !== undefined) ctx.audio.setVolume(partial.volume / 100);
    if (partial.quality !== undefined) applyQuality();
    if (partial.reduceMotion !== undefined) syncMotion();
    if (partial.difficulty !== undefined && world) {
      world.setLaserScale(VR_DIFFICULTY[settings.difficulty].laserScale);
    }
    persistSettings();
  }

  function getBestTime() {
    const v = ctx.storage.getPref(VR_BEST_TIME_KEY, 0);
    return typeof v === "number" && v > 0 ? v : 0;
  }

  /* ================= Pointer lock ================= */

  function requestLock() {
    if (locked || !canvas || destroyed) return;
    const onRejected = () => {
      if (mode !== "run" || paused || destroyed) return;
      const now = performance.now();
      if (now - lockHintAt > 2500) {
        lockHintAt = now;
        hud?.toast("NHẤP VÀO MÀN HÌNH ĐỂ KHÓA CHUỘT", "cyan");
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

  /* ================= Vòng chạy ================= */

  function resetRunState() {
    runTime = 0;
    checkpointCount = 0;
    energy = VR_ENERGY.start;
    energyDelay = 0;
    combo = 0;
    comboIdleT = 0;
    maxCombo = 0;
    shardsGot = 0;
    falls = 0;
    maxSpeed = 0;
    bonusScore = 0;
    dying = false;
  }

  function startRun() {
    if (!engine) return;
    mode = "run";
    paused = false;
    slideHeld = false;
    resetRunState();

    world.resetRun();
    world.setLaserScale(VR_DIFFICULTY[settings.difficulty].laserScale);
    world.setMarker(null);
    for (const tn of world.course.tunnels) tn.passed = false;
    player.reset(world.course.spawn);
    engine.setFog(30, 106);

    screens.hideAll();
    hud.show(true);
    hud.dim(false);
    hud.setTime(0);
    hud.setCheckpoint(0, VR_TOTAL_CHECKPOINTS);
    hud.setSpeed(0);
    hud.setEnergy(100);
    hud.setCombo(0);
    hud.syncSound();

    requestLock();
    ctx.onMatchStart?.();
  }

  function pauseRun() {
    if (mode !== "run" || paused) return;
    paused = true;
    slideHeld = false;
    exitLock();
    hud.dim(true);
    screens.showPause();
  }

  function resumeRun() {
    if (mode !== "run" || !paused) return;
    paused = false;
    keys.clearDown();
    screens.hideAll();
    hud.dim(false);
    requestLock();
  }

  /** Respawn tại checkpoint gần nhất. penalty=true khi rơi/chạm laser. */
  function respawn(penalty) {
    if (dying) return;
    dying = true;
    if (penalty) {
      falls += 1;
      combo = 0;
      hud.setCombo(0);
      const pen = VR_DIFFICULTY[settings.difficulty].penalty;
      runTime += pen;
      hud.penalty(pen);
      if (settings.shake) player.shake(1);
      ctx.audio.play("vr_fall");
    }
    hud.respawnFade(() => {
      if (destroyed) return;
      const rs = world.course.respawns[Math.min(checkpointCount, world.course.respawns.length - 1)];
      player.reset(rs);
      world.resetMoverPhase();
      world.setMarker(null);
      dying = false;
      ctx.audio.play("vr_respawn");
    });
  }

  function finishRun() {
    if (mode !== "run") return;
    mode = "over";
    paused = false;
    exitLock();
    hud.dim(true);
    ctx.audio.play("vr_finish");

    const timeMs = Math.round(runTime * 1000);
    const prevBest = getBestTime();
    const newBestTime = prevBest === 0 || timeMs < prevBest;
    if (newBestTime) ctx.storage.setPref(VR_BEST_TIME_KEY, timeMs);
    const bestMs = newBestTime ? timeMs : prevBest;

    const timeBonus = Math.max(0, Math.round((150000 - timeMs) / 10));
    const score = Math.max(100, timeBonus + bonusScore + maxCombo * 150 - falls * 200);
    const saved = ctx.onGameOver(score, { timeMs, falls, maxCombo, shards: shardsGot });

    screens.showResults({
      timeMs,
      bestMs,
      newBestTime,
      score,
      saved,
      shards: shardsGot,
      shardTotal: world.shardTotal,
      maxCombo,
      falls,
      maxSpeed,
    });
  }

  function addCombo(n = 1) {
    combo += n;
    comboIdleT = 0;
    maxCombo = Math.max(maxCombo, combo);
    hud.setCombo(combo);
  }

  /* ================= Vòng lặp chính ================= */

  function frame(t) {
    if (destroyed) return;
    rafId = requestAnimationFrame(frame);
    const dt = Math.min((t - lastT) / 1000, 0.05);
    lastT = t;

    const cam = engine.camera;
    const playing = mode === "run" && !paused && !dying;

    world.update(dt, { playing, camPos: cam.pos });

    if (mode === "idle") {
      // Camera bay chậm quanh course — nền sống cho start screen
      idleAngle += dt * 0.055;
      const ov = world.course.overview;
      const r = 58;
      cam.pos[0] = ov.x + Math.sin(idleAngle) * r;
      cam.pos[1] = 26 + Math.sin(idleAngle * 0.6) * 5;
      cam.pos[2] = ov.z + Math.cos(idleAngle) * r;
      cam.yaw = Math.atan2(cam.pos[0] - ov.x, cam.pos[2] - ov.z);
      cam.pitch = -0.42;
      cam.roll = 0;
      cam.fov = 72;
    } else if (mode === "run" && !paused) {
      if (!dying) {
        runTime += dt;
        hud.setTime(runTime);

        /* ----- Input ----- */
        const forward = (keys.isDown("KeyW") || keys.isDown("ArrowUp") ? 1 : 0) - (keys.isDown("KeyS") || keys.isDown("ArrowDown") ? 1 : 0);
        const strafe = (keys.isDown("KeyD") || keys.isDown("ArrowRight") ? 1 : 0) - (keys.isDown("KeyA") || keys.isDown("ArrowLeft") ? 1 : 0);
        const sprintHeld = keys.isDown("ShiftLeft") || keys.isDown("ShiftRight");
        const slideNow = slideHeld || keys.isDown("ControlLeft") || keys.isDown("ControlRight") || keys.isDown("KeyC");

        const st = player.update(dt, {
          forward,
          strafe,
          sprintHeld,
          sprintAllowed: energy > 1,
          slideHeld: slideNow,
        });

        maxSpeed = Math.max(maxSpeed, st.speed);

        /* ----- Sự kiện movement → âm thanh + combo ----- */
        const ev = st.ev;
        if (ev.jumped) ctx.audio.play("vr_jump");
        if (ev.wallJumped) {
          ctx.audio.play("vr_walljump");
          addCombo(1);
          hud.toast("WALL RUN!", "cyan");
        }
        if (ev.landed > 3) ctx.audio.play("vr_land");
        if (ev.slideStart) ctx.audio.play("vr_slide");
        if (ev.wallStart) {
          ctx.audio.play("vr_wall");
          if (settings.shake) player.shake(0.25);
        }
        if (ev.wallEnd && !ev.wallJumped && st.grounded === false) addCombo(1);
        if (ev.step) ctx.audio.play("vr_step");

        /* ----- Năng lượng ----- */
        const draining = sprintHeld && energy > 1 && forward > 0 && st.speed > 7.2 && !st.sliding;
        if (draining) {
          energy = Math.max(0, energy - VR_ENERGY.sprintDrain * dt);
          energyDelay = VR_ENERGY.regenDelay;
        } else {
          energyDelay -= dt;
          if (energyDelay <= 0) energy = Math.min(VR_ENERGY.max, energy + VR_ENERGY.regen * dt);
        }

        /* ----- Tương tác thế giới ----- */
        const got = world.checkShards(player.pos);
        if (got > 0) {
          shardsGot += got;
          energy = Math.min(VR_ENERGY.max, energy + VR_ENERGY.shardGain * got);
          bonusScore += got * (100 + combo * 25);
          addCombo(got);
          ctx.audio.play("vr_shard");
          fx.burst([player.pos[0], player.pos[1] + 1, player.pos[2]], VR_COLORS.lime, 10);
        }

        const gate = world.checkGate(player.pos, checkpointCount + 1);
        if (gate > 0) {
          checkpointCount = gate;
          bonusScore += 250;
          addCombo(1);
          hud.setCheckpoint(checkpointCount, VR_TOTAL_CHECKPOINTS);
          hud.toast(`CHECKPOINT ${checkpointCount}/${VR_TOTAL_CHECKPOINTS}`, "lime");
          ctx.audio.play("vr_gate");
          fx.burst([player.pos[0], player.pos[1] + 1.6, player.pos[2]], VR_COLORS.lime, 14, 1.3);
          if (checkpointCount >= 7) {
            world.setPortalActive(true);
            hud.toast("PORTAL MỞ — VỀ ĐÍCH!", "magenta");
          }
        }

        if (st.grounded) {
          const pad = world.checkPad(player.pos);
          if (pad) {
            const dir = pad.axis === "z" ? [0, 0, pad.dir] : [pad.dir, 0, 0];
            player.boost(dir);
            ctx.audio.play("vr_boost");
            hud.toast("BOOST!", "cyan");
            if (settings.shake) player.shake(0.5);
          }
        }

        // Trượt qua cổng tròn → combo (đi qua tâm tunnel khi đang trượt)
        if (st.sliding) {
          for (const tn of world.course.tunnels) {
            if (tn.passed) continue;
            const d = Math.abs(player.pos[0] - tn.x) + Math.abs(player.pos[2] - tn.z);
            if (d < 1.3) {
              tn.passed = true;
              addCombo(1);
              hud.toast("SLIDE!", "magenta");
              ctx.audio.play("vr_slide");
            }
          }
        }

        // Laser
        const h = st.sliding ? VR_MOVE.crouchH : VR_MOVE.standH;
        if (world.checkLaser(player.pos, h, VR_MOVE.capsuleR)) {
          hud.damageFlash();
          ctx.audio.play("vr_zap");
          respawn(true);
        } else if (world.laserWarnNear(player.pos)) {
          ctx.audio.play("vr_warn");
        }

        // Rơi khỏi map
        if (st.fell) respawn(true);

        // Đích
        if (world.checkPortal(player.pos)) {
          finishRun();
          return;
        }

        /* ----- Combo nhạt dần khi đứng yên ----- */
        if (st.speed < 1 && st.grounded) {
          comboIdleT += dt;
          if (comboIdleT > 3 && combo > 0) {
            combo = 0;
            hud.setCombo(0);
          }
        } else {
          comboIdleT = 0;
        }

        /* ----- HUD + camera feel ----- */
        hud.setSpeed(st.speed);
        hud.setEnergy(energy);

        const fovBase = settings.fov;
        const speedK = motion.reduced ? 0 : Math.max(0, (st.speed - VR_MOVE.walk) / (VR_MOVE.boostSpeed - VR_MOVE.walk)) * 9;
        cam.fov += (fovBase + speedK - cam.fov) * Math.min(1, dt * 6);

        fx.setWind(Math.max(0, (st.speed - 9) / 10));

        // Landing marker khi bay đủ lâu
        if (player.airborne && player.vel[1] < 2) {
          const lp = player.predictLanding();
          if (lp) world.setMarker(lp[0], lp[1], lp[2]);
          else world.setMarker(null);
        } else {
          world.setMarker(null);
        }

        gloves.update(dt, {
          speed: st.speed,
          grounded: st.grounded,
          sliding: st.sliding,
          wallRun: st.wallRun,
          boosting: st.boosting,
          landed: ev.landed,
          lookDx,
          lookDy,
        });
      }

      /* ----- Quality auto ----- */
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

    fx.update(dt, cam);
    lookDx = 0;
    lookDy = 0;

    engine.render(world.root, mode === "run" ? gloves.viewmodel : null);
  }

  /* ================= Interface vòng đời ================= */

  return {
    async mount(container, context) {
      ctx = context;
      const shadowRoot = container.getRootNode();

      if (shadowRoot instanceof ShadowRoot && !shadowRoot.querySelector("#void-runner-style")) {
        const style = document.createElement("style");
        style.id = "void-runner-style";
        style.textContent = VOID_RUNNER_CSS;
        shadowRoot.appendChild(style);
      }

      wrap = document.createElement("div");
      wrap.className = "vr-root";
      container.appendChild(wrap);

      loadSettings();

      const actions = {
        enterRun: () => startRun(),
        resume: () => resumeRun(),
        restart: () => startRun(),
        restartCheckpoint: () => {
          if (mode !== "run") return;
          resumeRun();
          respawn(false);
        },
        switchGame: () => ctx.requestSwitch(),
        goHome: () => ctx.requestHome(),
        applySettings: (partial) => applySettings(partial),
      };

      screens = createVrScreens(wrap, { settings, actions, getBestTime });

      const isCoarse = window.matchMedia("(pointer: coarse)").matches;
      const isSmall = Math.min(window.innerWidth, window.innerHeight) < 620;
      if (isCoarse && isSmall) {
        mode = "blocked";
        screens.showNotice("mobile");
        return;
      }

      canvas = document.createElement("canvas");
      canvas.className = "vr-canvas";
      wrap.insertBefore(canvas, wrap.firstChild);

      try {
        engine = createEngine(canvas, { fogNear: 34, fogFar: 112, fogColor: VR_COLORS.fog });
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
      world.setLaserScale(VR_DIFFICULTY[settings.difficulty].laserScale);
      player = createPlayer(world, engine.camera, motion);
      gloves = createGloves(motion);
      fx = createVrFx(world.root, motion);
      hud = createVrHud(wrap, {
        onPause: () => pauseRun(),
        onToggleSound: () => ctx.audio.setEnabled(!ctx.audio.enabled),
        soundOn: () => ctx.audio.enabled,
        onSwitch: () => ctx.requestSwitch(),
        onHome: () => ctx.requestHome(),
      });

      /* ----- Input ----- */
      keys = createKeyboard({ signal: ctx.signal });
      keys.on(["Space"], () => {
        if (mode === "run" && !paused && !dying) player.queueJump();
      });
      keys.on(["KeyR"], () => {
        if (mode !== "run") return;
        if (paused) resumeRun();
        respawn(false);
      });
      keys.on(["KeyP"], () => {
        if (mode !== "run") return;
        if (paused) resumeRun();
        else pauseRun();
      });
      keys.on(["KeyQ"], () => {
        // Assist wall-run: giữ đà rơi nhẹ để dễ bám tường (theo plan, tùy chọn)
        if (mode === "run" && !paused && player.airborne && player.vel[1] < 0) {
          player.vel[1] = Math.max(player.vel[1], -1.2);
        }
      });

      const sig = { signal: ctx.signal };

      window.addEventListener(
        "keydown",
        (e) => {
          if (e.code !== "Escape" || mode !== "run") return;
          if (!locked) {
            e.preventDefault();
            if (paused) resumeRun();
            else pauseRun();
          }
        },
        sig
      );

      document.addEventListener(
        "pointerlockchange",
        () => {
          locked = document.pointerLockElement === canvas;
          if (!locked && mode === "run" && !paused) pauseRun();
        },
        sig
      );

      document.addEventListener(
        "pointerlockerror",
        () => {
          locked = false;
          if (mode === "run" && !paused) {
            const now = performance.now();
            if (now - lockHintAt > 2500) {
              lockHintAt = now;
              hud?.toast("NHẤP VÀO MÀN HÌNH ĐỂ KHÓA CHUỘT", "cyan");
            }
          }
        },
        sig
      );

      canvas.addEventListener(
        "pointerdown",
        (e) => {
          if (mode !== "run" || paused) return;
          e.preventDefault();
          if (e.button === 0 && !locked) requestLock();
        },
        sig
      );

      wrap.addEventListener("contextmenu", (e) => e.preventDefault(), sig);

      window.addEventListener(
        "pointermove",
        (e) => {
          if (mode !== "run" || paused || dying) return;
          // Có lock: movementX/Y chuẩn FPS; mất lock vẫn nhìn được bằng
          // chuột thường (headless/cooldown Esc) — game không bao giờ đơ.
          const dx = e.movementX || 0;
          const dy = e.movementY || 0;
          player.look(dx, dy, settings.sensitivity);
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

      /* ----- Test hook (QA headless) ----- */
      if (TEST) {
        window.__VR_DEBUG__ = {
          teleport: (cp) => {
            checkpointCount = Math.max(0, Math.min(7, cp));
            for (let i = 1; i <= checkpointCount; i++) world.activateGateSilent(i);
            hud.setCheckpoint(checkpointCount, VR_TOTAL_CHECKPOINTS);
            if (checkpointCount >= 7) world.setPortalActive(true);
            const rs = world.course.respawns[checkpointCount];
            player.reset(rs);
          },
          finish: () => {
            checkpointCount = 7;
            world.setPortalActive(true);
            finishRun();
          },
          die: () => respawn(true),
          place: (x, y, z, yaw = 0) => player.reset({ pos: [x, y, z], yaw }),
          state: () => ({
            mode, paused, runTime, checkpointCount, energy, combo, falls,
            pos: [...player.pos],
            grounded: player.grounded,
            sliding: player.sliding,
            wallRun: player.wallRunning,
          }),
        };
      }

      /* ----- Idle: cảnh 3D sống + start screen ----- */
      mode = "idle";
      engine.setFog(40, 118);
      screens.showStart();

      lastT = performance.now();
      rafId = requestAnimationFrame(frame);
    },

    start() {
      if (mode === "blocked") return;
      startRun();
    },

    pause() {
      pauseRun();
    },

    resume() {
      resumeRun();
    },

    restart() {
      if (mode === "blocked") return;
      startRun();
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
      if (TEST && window.__VR_DEBUG__) delete window.__VR_DEBUG__;
      wrap = null;
      canvas = null;
      engine = null;
      world = null;
      player = null;
      gloves = null;
      fx = null;
      hud = null;
      screens = null;
    },
  };
}

exports.createGame = createGame;
};
__defs["games/void-runner/world.js"] = function (exports, __req) {
/**
 * world.js — dựng scene VOID RUNNER 404 theo asset sheet + blueprint:
 *  - Platform đá tối viền neon cyan (đế máy móc phía dưới).
 *  - Tường wall-run nổi với bảng "WALL RUN" + chevron (ảnh gameplay).
 *  - Cổng trượt tròn magenta có bảng "SLIDE".
 *  - Checkpoint vòm lime + diamond, laser đỏ/magenta 2 trụ, energy shard
 *    lime, jump pad chevron cyan, finish portal tím.
 *  - Skyline thành phố cyber phía dưới vực + billboard "404 ARCADE".
 * Xuất: root, colliders, movers, hazards logic (laser/pad/shard/gate/
 * portal), landing marker, resolveMove, update (anim + culling).
 */

const { createNode, addChild, meshNode, hex } = __req("games/strike/engine.js");
const { seededRand, MONO_FONT } = __req("core/utils.js");
const { VR_COLORS } = __req("games/void-runner/config.js");
const { createCourse } = __req("games/void-runner/course.js");

const C = VR_COLORS;

/* ============================ Textures ============================ */

function canvas2d(w, h) {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  return [cv, cv.getContext("2d")];
}

function platTexture(engine) {
  const [cv, g] = canvas2d(256, 256);
  const rand = seededRand(4041);
  g.fillStyle = C.slab;
  g.fillRect(0, 0, 256, 256);
  // Panel 4×4 với sắc thái lệch nhẹ + mối ghép tối
  for (let py = 0; py < 4; py++) {
    for (let px = 0; px < 4; px++) {
      const v = rand();
      if (v > 0.55) {
        g.fillStyle = `rgba(210,225,255,${(v - 0.55) * 0.1})`;
        g.fillRect(px * 64, py * 64, 64, 64);
      } else if (v < 0.2) {
        g.fillStyle = "rgba(0,0,0,0.18)";
        g.fillRect(px * 64, py * 64, 64, 64);
      }
    }
  }
  g.strokeStyle = "rgba(0,0,0,0.45)";
  g.lineWidth = 3;
  for (let i = 0; i <= 4; i++) {
    g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, 256); g.stroke();
    g.beginPath(); g.moveTo(0, i * 64); g.lineTo(256, i * 64); g.stroke();
  }
  // Hairline cyan mờ + đinh tán
  g.strokeStyle = "rgba(34,228,255,0.07)";
  g.lineWidth = 1;
  for (let i = 0; i <= 8; i++) {
    g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, 256); g.stroke();
  }
  g.fillStyle = "rgba(0,0,0,0.55)";
  for (let i = 0; i < 14; i++) g.fillRect(8 + rand() * 240, 8 + rand() * 240, 4, 4);
  return engine.makeTexture(cv);
}

function wallRunTexture(engine) {
  const [cv, g] = canvas2d(512, 256);
  g.fillStyle = "#0a1e30";
  g.fillRect(0, 0, 512, 256);
  g.strokeStyle = "rgba(34,228,255,0.9)";
  g.lineWidth = 6;
  g.strokeRect(6, 6, 500, 244);
  g.strokeStyle = "rgba(34,228,255,0.25)";
  g.lineWidth = 2;
  g.strokeRect(20, 20, 472, 216);
  // Chevron trắng-cyan bên trái (hướng chạy)
  g.fillStyle = "rgba(210,248,255,0.92)";
  for (let i = 0; i < 3; i++) {
    const x = 44 + i * 52;
    g.beginPath();
    g.moveTo(x, 74);
    g.lineTo(x + 30, 128);
    g.lineTo(x, 182);
    g.lineTo(x + 18, 182);
    g.lineTo(x + 48, 128);
    g.lineTo(x + 18, 74);
    g.closePath();
    g.fill();
  }
  // Icon người chạy (giữa-trên) + chữ WALL RUN (giữa-dưới) như ảnh
  g.strokeStyle = "#bdf4ff";
  g.lineWidth = 8;
  g.lineCap = "round";
  g.beginPath(); g.arc(342, 58, 13, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.moveTo(338, 74); g.lineTo(354, 100); g.lineTo(342, 128); g.stroke();
  g.beginPath(); g.moveTo(354, 100); g.lineTo(378, 114); g.lineTo(382, 138); g.stroke();
  g.beginPath(); g.moveTo(348, 86); g.lineTo(380, 76); g.stroke();
  g.beginPath(); g.moveTo(348, 90); g.lineTo(322, 108); g.stroke();
  g.font = `800 42px ${MONO_FONT}`;
  g.textAlign = "center";
  g.shadowColor = "#22e4ff";
  g.shadowBlur = 18;
  g.fillStyle = "#c8f6ff";
  g.fillText("WALL RUN", 352, 196);
  g.shadowBlur = 0;
  return engine.makeTexture(cv);
}

function signTexture(engine, text, color, w = 256, h = 64) {
  const [cv, g] = canvas2d(w, h);
  g.fillStyle = "rgba(6,10,24,0.92)";
  g.fillRect(0, 0, w, h);
  g.strokeStyle = color;
  g.lineWidth = 4;
  g.strokeRect(3, 3, w - 6, h - 6);
  g.font = `800 ${Math.floor(h * 0.52)}px ${MONO_FONT}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.shadowColor = color;
  g.shadowBlur = 14;
  g.fillStyle = color;
  g.fillText(text, w / 2, h / 2 + 2);
  g.shadowBlur = 0;
  return engine.makeTexture(cv);
}

function billboardTexture(engine) {
  const [cv, g] = canvas2d(256, 200);
  g.fillStyle = "#120b2e";
  g.fillRect(0, 0, 256, 200);
  g.strokeStyle = "rgba(139,91,255,0.9)";
  g.lineWidth = 5;
  g.strokeRect(5, 5, 246, 190);
  g.textAlign = "center";
  g.font = `800 86px ${MONO_FONT}`;
  g.shadowColor = "#b07bff";
  g.shadowBlur = 26;
  g.fillStyle = "#c9a4ff";
  g.fillText("404", 128, 100);
  g.font = `700 34px ${MONO_FONT}`;
  g.shadowBlur = 14;
  g.fillStyle = "#e42cff";
  g.fillText("ARCADE", 128, 156);
  g.shadowBlur = 0;
  return engine.makeTexture(cv);
}

function windowsTexture(engine, seed) {
  const [cv, g] = canvas2d(128, 256);
  const rand = seededRand(seed);
  g.clearRect(0, 0, 128, 256);
  for (let y = 6; y < 250; y += 12) {
    for (let x = 6; x < 122; x += 10) {
      const v = rand();
      if (v > 0.52) {
        g.fillStyle =
          v > 0.92 ? "rgba(228,44,255,0.95)" :
          v > 0.8 ? "rgba(64,232,255,0.92)" :
          v > 0.68 ? "rgba(200,220,255,0.75)" : "rgba(150,130,255,0.55)";
        g.fillRect(x, y, 5.5, 8);
      }
    }
  }
  return engine.makeTexture(cv);
}

function chevronPadTexture(engine) {
  // Mũi tên chevron boost trên mặt platform (ảnh gameplay giữa)
  const [cv, g] = canvas2d(128, 256);
  g.clearRect(0, 0, 128, 256);
  g.fillStyle = "rgba(120,240,255,0.95)";
  for (let i = 0; i < 4; i++) {
    const y = 210 - i * 56;
    g.beginPath();
    g.moveTo(14, y);
    g.lineTo(64, y - 38);
    g.lineTo(114, y);
    g.lineTo(114, y - 18);
    g.lineTo(64, y - 56);
    g.lineTo(14, y - 18);
    g.closePath();
    g.fill();
  }
  return engine.makeTexture(cv);
}

function markerTexture(engine) {
  // Marker "DỰ KIẾN HẠ CÁNH": ellipse nét đứt + chevron xuống (ảnh gameplay)
  const [cv, g] = canvas2d(256, 256);
  g.clearRect(0, 0, 256, 256);
  g.strokeStyle = "rgba(120,240,255,0.95)";
  g.lineWidth = 5;
  g.setLineDash([16, 11]);
  g.beginPath();
  g.ellipse(128, 118, 112, 66, 0, 0, Math.PI * 2);
  g.stroke();
  g.setLineDash([]);
  g.fillStyle = "rgba(150,245,255,0.95)";
  for (let i = 0; i < 3; i++) {
    const y = 74 + i * 30;
    g.beginPath();
    g.moveTo(94, y);
    g.lineTo(128, y + 22);
    g.lineTo(162, y);
    g.lineTo(162, y + 12);
    g.lineTo(128, y + 34);
    g.lineTo(94, y + 12);
    g.closePath();
    g.fill();
  }
  g.font = `700 22px ${MONO_FONT}`;
  g.textAlign = "center";
  g.shadowColor = "#22e4ff";
  g.shadowBlur = 10;
  g.fillStyle = "#aef2ff";
  g.fillText("DỰ KIẾN HẠ CÁNH", 128, 226);
  g.shadowBlur = 0;
  return engine.makeTexture(cv);
}

function portalGlowTexture(engine) {
  const [cv, g] = canvas2d(128, 128);
  const grad = g.createRadialGradient(64, 64, 6, 64, 64, 62);
  grad.addColorStop(0, "rgba(210,160,255,0.85)");
  grad.addColorStop(0.55, "rgba(139,91,255,0.4)");
  grad.addColorStop(1, "rgba(139,91,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return engine.makeTexture(cv);
}

/* ============================ World ============================ */

function createWorld(engine) {
  const course = createCourse();
  const root = createNode();
  const colliders = []; // {min,max, wallRun?, face?, axis?, ceiling?}
  const cullables = []; // {node, x, z, r} — ẩn khi xa camera

  const texPlat = platTexture(engine);
  const texWallRun = wallRunTexture(engine);
  const texCheckpoint = signTexture(engine, "CHECKPOINT", "#c8f23e", 320, 64);
  const texSlide = signTexture(engine, "SLIDE", "#ff5ae0", 224, 64);
  const texBillboard = billboardTexture(engine);
  const texWin1 = windowsTexture(engine, 11);
  const texWin2 = windowsTexture(engine, 77);
  const texChevron = chevronPadTexture(engine);
  const texMarker = markerTexture(engine);
  const texPortalGlow = portalGlowTexture(engine);

  const anim = {
    shards: [],      // {node, gem, base, taken}
    gateFlash: [],   // {group, parts, diamond, index, active}
    beams: [],       // laser runtime
    moverList: [],   // {node, collider, data, prev:[x,y,z]}
    portal: null,
    portalBits: [],
    marker: null,
    pads: [],
  };

  const group = (x, y, z, yaw = 0) => {
    const n = createNode({ pos: [x, y, z], rot: [0, yaw, 0] });
    addChild(root, n);
    return n;
  };

  /* ------------------- Platform ------------------- */

  const EDGE_COLOR = { start: C.lime, plaza: C.violet, corner: C.cyan, path: C.cyan, land: C.cyan };

  function buildPlatform(p) {
    const g = group(p.x, 0, p.z);
    // Mặt trên (texture panel) — top tại p.y, dày 0.55
    addChild(g, meshNode("box", {
      pos: [0, p.y - 0.275, 0],
      scale: [p.w, 0.55, p.d],
      color: [1, 1, 1],
      tex: texPlat,
    }));
    // Đế máy móc thụt vào phía dưới
    addChild(g, meshNode("box", {
      pos: [0, p.y - 0.55 - 0.5, 0],
      scale: [p.w * 0.82, 1.0, p.d * 0.82],
      color: hex(C.slabDark),
    }));
    addChild(g, meshNode("box", {
      pos: [0, p.y - 1.55 - 0.35, 0],
      scale: [p.w * 0.5, 0.7, p.d * 0.5],
      color: hex("#0a0e20"),
    }));
    // Viền neon 4 mép trên
    const ec = hex(EDGE_COLOR[p.kind] || C.cyan);
    const t = 0.1;
    const yTop = p.y - 0.02;
    addChild(g, meshNode("box", { pos: [0, yTop, -p.d / 2 + t / 2], scale: [p.w, 0.07, t], color: ec, emissive: 0.95 }));
    addChild(g, meshNode("box", { pos: [0, yTop, p.d / 2 - t / 2], scale: [p.w, 0.07, t], color: ec, emissive: 0.95 }));
    addChild(g, meshNode("box", { pos: [-p.w / 2 + t / 2, yTop, 0], scale: [t, 0.07, p.d], color: ec, emissive: 0.95 }));
    addChild(g, meshNode("box", { pos: [p.w / 2 - t / 2, yTop, 0], scale: [t, 0.07, p.d], color: ec, emissive: 0.95 }));

    colliders.push({
      min: [p.x - p.w / 2, p.y - 3, p.z - p.d / 2],
      max: [p.x + p.w / 2, p.y, p.z + p.d / 2],
    });
    cullables.push({ node: g, x: p.x, z: p.z, r: Math.max(p.w, p.d) / 2 });
  }

  /* ------------------- Tường wall-run ------------------- */

  function buildWall(wd) {
    // axis "z": tường chạy dọc Z, mặt áp là ±X (face)
    const yaw = wd.axis === "z" ? 0 : Math.PI / 2;
    const g = group(wd.x, 0, wd.z, yaw);
    const midY = wd.y + wd.h / 2;
    addChild(g, meshNode("box", {
      pos: [0, midY, 0],
      scale: [0.5, wd.h, wd.len],
      color: [1, 1, 1],
      tex: texPlat,
    }));
    // Viền cyan trên/dưới
    for (const yy of [wd.y + wd.h - 0.05, wd.y + 0.05]) {
      addChild(g, meshNode("box", { pos: [0, yy, 0], scale: [0.56, 0.08, wd.len], color: hex(C.cyan), emissive: 0.9 }));
    }
    // Bảng WALL RUN áp mặt trong (phía người chơi)
    const fx = wd.face * 0.27;
    addChild(g, meshNode("plane", {
      pos: [fx, midY + 0.15, 0],
      rot: [0, wd.face > 0 ? Math.PI / 2 : -Math.PI / 2, 0],
      scale: [Math.min(9, wd.len * 0.55), Math.min(9, wd.len * 0.55) / 2, 1],
      color: [1, 1, 1],
      tex: texWallRun,
      emissive: 1,
    }));

    // Collider (theo world-space, tính lại theo axis)
    let min;
    let max;
    if (wd.axis === "z") {
      min = [wd.x - 0.25, wd.y, wd.z - wd.len / 2];
      max = [wd.x + 0.25, wd.y + wd.h, wd.z + wd.len / 2];
    } else {
      min = [wd.x - wd.len / 2, wd.y, wd.z - 0.25];
      max = [wd.x + wd.len / 2, wd.y + wd.h, wd.z + 0.25];
    }
    colliders.push({ min, max, wallRun: true, axis: wd.axis, face: wd.face });
    cullables.push({ node: g, x: wd.x, z: wd.z, r: wd.len / 2 });
  }

  /* ------------------- Cổng trượt tròn (SLIDE) ------------------- */

  function buildTunnel(td) {
    const yaw = td.axis === "x" ? Math.PI / 2 : 0;
    const g = group(td.x, 0, td.z, yaw);
    const cy = td.y + 0.95;
    // 2 vành tròn magenta (có độ sâu như asset sheet)
    for (const dz of [-0.55, 0.55]) {
      addChild(g, meshNode("ring", {
        pos: [0, cy, dz],
        scale: [3.6, 3.6, 1],
        color: hex(C.magenta),
        emissive: 0.95,
      }));
    }
    // Ống nối 2 vành (trên đỉnh + hai bên)
    addChild(g, meshNode("box", { pos: [0, cy + 1.72, 0], scale: [0.5, 0.24, 1.1], color: hex("#1a1030") }));
    addChild(g, meshNode("box", { pos: [-1.72, cy, 0], scale: [0.24, 0.5, 1.1], color: hex("#1a1030") }));
    addChild(g, meshNode("box", { pos: [1.72, cy, 0], scale: [0.24, 0.5, 1.1], color: hex("#1a1030") }));
    // Bảng SLIDE phía trên + chevron xuống
    addChild(g, meshNode("plane", {
      pos: [0, cy + 2.6, 0],
      scale: [2.4, 0.7, 1],
      color: [1, 1, 1],
      tex: texSlide,
      emissive: 1,
    }));
    addChild(g, meshNode("tri", {
      pos: [0, cy + 1.95, 0],
      scale: [0.55, 0.4, 1],
      color: hex(C.magenta),
      emissive: 1,
    }));

    // Collider trần: ép phải trượt (đầu đứng 1.8 > 1.06, trượt 0.92 lọt)
    let min;
    let max;
    if (td.axis === "x") {
      min = [td.x - 0.8, td.y + 1.06, td.z - 2.5];
      max = [td.x + 0.8, td.y + 3.8, td.z + 2.5];
    } else {
      min = [td.x - 2.5, td.y + 1.06, td.z - 0.8];
      max = [td.x + 2.5, td.y + 3.8, td.z + 0.8];
    }
    colliders.push({ min, max, ceiling: true });
    cullables.push({ node: g, x: td.x, z: td.z, r: 3 });
    return g;
  }

  /* ------------------- Checkpoint gate ------------------- */

  function buildGate(gd) {
    const yaw = gd.axis === "x" ? Math.PI / 2 : 0;
    const g = group(gd.x, gd.y, gd.z, yaw);
    const lime = hex(C.lime);
    const parts = [];
    const part = (geo, opts) => {
      const n = meshNode(geo, opts);
      addChild(g, n);
      parts.push(n);
      return n;
    };
    // 2 cột + 2 vai xiên + thanh ngang (vòm lục giác như asset sheet)
    part("box", { pos: [-2.1, 1.25, 0], scale: [0.3, 2.5, 0.3], color: lime, emissive: 0.85 });
    part("box", { pos: [2.1, 1.25, 0], scale: [0.3, 2.5, 0.3], color: lime, emissive: 0.85 });
    part("box", { pos: [-1.45, 2.85, 0], rot: [0, 0, -0.62], scale: [0.28, 1.7, 0.28], color: lime, emissive: 0.85 });
    part("box", { pos: [1.45, 2.85, 0], rot: [0, 0, 0.62], scale: [0.28, 1.7, 0.28], color: lime, emissive: 0.85 });
    part("box", { pos: [0, 3.42, 0], scale: [1.9, 0.26, 0.26], color: lime, emissive: 0.85 });
    // Chân đế
    part("box", { pos: [-2.1, 0.12, 0], scale: [0.75, 0.24, 0.75], color: hex(C.slabDark) });
    part("box", { pos: [2.1, 0.12, 0], scale: [0.75, 0.24, 0.75], color: hex(C.slabDark) });
    // Diamond trên đỉnh
    const diamond = part("gem", { pos: [0, 4.05, 0], scale: [0.42, 0.62, 0.42], color: lime, emissive: 1 });
    // Bảng CHECKPOINT
    part("plane", { pos: [0, 3.05, 0.02], scale: [2.3, 0.46, 1], color: [1, 1, 1], tex: texCheckpoint, emissive: 1 });
    // Màng sáng mờ bên trong
    const veil = part("plane", {
      pos: [0, 1.55, 0],
      scale: [3.6, 2.7, 1],
      color: lime,
      emissive: 1,
      opacity: 0.1,
      additive: true,
    });

    anim.gateFlash.push({ group: g, parts, diamond, veil, index: gd.index, active: false, flashT: 0, data: gd });
    cullables.push({ node: g, x: gd.x, z: gd.z, r: 4 });
  }

  /* ------------------- Laser ------------------- */

  function buildLaser(ld) {
    const yaw = ld.axis === "x" ? 0 : Math.PI / 2; // beam nằm dọc trục ld.axis
    const g = group(ld.x, 0, ld.z, yaw);
    const half = ld.len / 2;
    // 2 trụ tím (sáng như asset sheet) + sọc neon + đầu phát đỏ
    for (const s of [-1, 1]) {
      addChild(g, meshNode("box", { pos: [s * half, 0.95, 0], scale: [0.3, 2, 0.3], color: hex("#41307a") }));
      addChild(g, meshNode("box", { pos: [s * half, 0.95, 0.165], scale: [0.1, 1.7, 0.03], color: hex(C.violet), emissive: 1 }));
      addChild(g, meshNode("box", { pos: [s * half, 0.95, -0.165], scale: [0.1, 1.7, 0.03], color: hex(C.violet), emissive: 1 }));
      addChild(g, meshNode("box", { pos: [s * half, 1.98, 0], scale: [0.36, 0.14, 0.36], color: hex(C.violet), emissive: 0.9 }));
      addChild(g, meshNode("box", { pos: [s * half, ld.y, 0], scale: [0.24, 0.24, 0.24], color: hex(C.red), emissive: 1 }));
      addChild(g, meshNode("box", { pos: [s * half, 0.08, 0], scale: [0.5, 0.16, 0.5], color: hex(C.slabDark) }));
    }
    const beams = [];
    const mkBeam = (yy) => {
      const glow = meshNode("box", {
        pos: [0, yy, 0],
        scale: [ld.len - 0.2, 0.3, 0.3],
        color: hex(C.red),
        emissive: 1,
        opacity: 0.22,
        additive: true,
      });
      addChild(g, glow);
      const b = meshNode("box", {
        pos: [0, yy, 0],
        scale: [ld.len - 0.2, 0.13, 0.13],
        color: hex(C.red),
        emissive: 1,
        opacity: 0.92,
        additive: true,
      });
      addChild(g, b);
      const core = meshNode("box", {
        pos: [0, yy, 0],
        scale: [ld.len - 0.2, 0.05, 0.05],
        color: hex("#ffe0e6"),
        emissive: 1,
        opacity: 0.95,
        additive: true,
      });
      addChild(g, core);
      beams.push({ beam: b, core, glow, y: yy });
      if (yy > 1.6) {
        addChild(g, meshNode("box", { pos: [0, yy, 0], scale: [0.24, 0.24, 0.24], color: hex(C.red), emissive: 1 }));
      }
    };
    mkBeam(ld.y);
    if (ld.mode === "gate") mkBeam(ld.y + 1.05);

    anim.beams.push({ data: ld, beams, on: true });
    cullables.push({ node: g, x: ld.x, z: ld.z, r: half + 1 });
  }

  /* ------------------- Energy shard ------------------- */

  function buildShard(sd, i) {
    const g = group(sd.x, 0, sd.z);
    const gem = meshNode("gem", {
      pos: [0, sd.y + 0.55, 0],
      scale: [0.42, 0.95, 0.42],
      color: hex(C.lime),
      emissive: 1,
    });
    addChild(g, gem);
    const glow = meshNode("gem", {
      pos: [0, sd.y + 0.55, 0],
      scale: [0.62, 1.3, 0.62],
      color: hex(C.lime),
      emissive: 1,
      opacity: 0.18,
      additive: true,
    });
    addChild(g, glow);
    const ring = meshNode("ring", {
      pos: [0, sd.y - 0.02 - (sd.y > 1 ? 0 : 0), 0],
      rot: [-Math.PI / 2, 0, 0],
      scale: [1.15, 1.15, 1],
      color: hex(C.lime),
      emissive: 0.85,
      opacity: 0.65,
    });
    addChild(g, ring);
    anim.shards.push({ node: g, gem, glow, ring, data: sd, taken: false, idx: i, t: Math.random() * 6 });
    cullables.push({ node: g, x: sd.x, z: sd.z, r: 1.5 });
  }

  /* ------------------- Jump pad ------------------- */

  function buildPad(pd) {
    const yaw = pd.axis === "z" ? (pd.dir > 0 ? Math.PI : 0) : (pd.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    const g = group(pd.x, 0, pd.z, yaw);
    // Nền + chevron phát sáng (như ảnh gameplay)
    addChild(g, meshNode("box", { pos: [0, pd.y + 0.015, 0], scale: [1.7, 0.05, 3.4], color: hex("#0c2030") }));
    const arrow = meshNode("plane", {
      pos: [0, pd.y + 0.05, 0],
      rot: [-Math.PI / 2, 0, 0],
      scale: [1.5, 3.2, 1],
      color: [1, 1, 1],
      tex: texChevron,
      emissive: 1,
      opacity: 0.95,
      additive: true,
    });
    addChild(g, arrow);
    for (const s of [-1, 1]) {
      addChild(g, meshNode("box", { pos: [s * 0.88, pd.y + 0.05, 0], scale: [0.08, 0.09, 3.4], color: hex(C.cyan), emissive: 1 }));
    }
    anim.pads.push({ node: g, arrow, data: pd, t: 0 });
    cullables.push({ node: g, x: pd.x, z: pd.z, r: 2.5 });
  }

  /* ------------------- Finish portal ------------------- */

  function buildPortal(pp) {
    const yaw = pp.axis === "x" ? Math.PI / 2 : 0;
    const g = group(pp.x, pp.y, pp.z, yaw);
    const ringOuter = meshNode("ring", {
      pos: [0, 2.3, 0],
      scale: [4.6, 4.6, 1],
      color: hex(C.violet),
      emissive: 0.95,
    });
    addChild(g, ringOuter);
    const ringInner = meshNode("ring", {
      pos: [0, 2.3, 0.06],
      scale: [3.7, 3.7, 1],
      color: hex(C.magenta),
      emissive: 1,
      opacity: 0.85,
      additive: true,
    });
    addChild(g, ringInner);
    const glow = meshNode("plane", {
      pos: [0, 2.3, 0],
      scale: [3.6, 3.6, 1],
      color: [1, 1, 1],
      tex: texPortalGlow,
      emissive: 1,
      opacity: 0.35,
      additive: true,
    });
    addChild(g, glow);
    // Đế + 2 trụ cyan
    addChild(g, meshNode("cyl", { pos: [0, 0.14, 0], scale: [5.6, 0.28, 5.6], color: hex(C.slabDark) }));
    addChild(g, meshNode("ring", {
      pos: [0, 0.3, 0],
      rot: [-Math.PI / 2, 0, 0],
      scale: [5.2, 5.2, 1],
      color: hex(C.violet),
      emissive: 0.8,
      opacity: 0.6,
    }));
    for (const s of [-1, 1]) {
      addChild(g, meshNode("box", { pos: [s * 2.9, 1.1, 0], scale: [0.4, 2.2, 0.4], color: hex("#151a34") }));
      addChild(g, meshNode("box", { pos: [s * 2.9, 1.1, 0.21], scale: [0.1, 1.8, 0.06], color: hex(C.cyan), emissive: 1 }));
    }
    // Mảnh vuông tím bay quanh vòng (như asset sheet)
    const bits = [];
    for (let i = 0; i < 10; i++) {
      const b = meshNode("box", {
        scale: [0.16, 0.16, 0.05],
        color: hex(i % 3 === 0 ? C.magenta : C.violet),
        emissive: 1,
        opacity: 0.9,
        additive: true,
      });
      addChild(g, b);
      bits.push({ node: b, a: (i / 10) * Math.PI * 2, r: 1.55 + (i % 3) * 0.22, sp: 0.55 + (i % 4) * 0.16 });
    }
    anim.portal = { group: g, ringOuter, ringInner, glow, data: pp, active: false, t: 0 };
    anim.portalBits = bits;
    cullables.push({ node: g, x: pp.x, z: pp.z, r: 5 });
  }

  /* ------------------- Biển chỉ hướng khúc quẹo ------------------- */

  function buildArrow(ad) {
    const g = group(ad.x, 0, ad.z, ad.yaw);
    addChild(g, meshNode("plane", {
      pos: [0, ad.y, 0],
      scale: [1.7, 1.7, 1],
      color: [1, 1, 1],
      tex: texChevron,
      emissive: 1,
      opacity: 0.9,
      additive: true,
    }));
    cullables.push({ node: g, x: ad.x, z: ad.z, r: 1.5 });
  }

  /** Chevron cyan mờ nằm trên mặt track (chỉ hướng chạy — ảnh gameplay). */
  function buildFloorArrow(fa) {
    const g = group(fa.x, 0, fa.z, fa.yaw);
    addChild(g, meshNode("plane", {
      pos: [0, fa.y + 0.04, 0],
      rot: [-Math.PI / 2, 0, 0],
      scale: [1.6, 3.4, 1],
      color: [1, 1, 1],
      tex: texChevron,
      emissive: 1,
      opacity: 0.55,
      additive: true,
    }));
    cullables.push({ node: g, x: fa.x, z: fa.z, r: 2 });
  }

  /* ------------------- Moving platforms ------------------- */

  function buildMover(md) {
    const g = group(md.x, 0, md.z);
    addChild(g, meshNode("box", { pos: [0, md.y - 0.24, 0], scale: [md.w, 0.48, md.d], color: [1, 1, 1], tex: texPlat }));
    addChild(g, meshNode("box", { pos: [0, md.y - 0.68, 0], scale: [md.w * 0.6, 0.4, md.d * 0.6], color: hex("#0a0e20") }));
    const t = 0.09;
    for (const [px, pz, sw, sd2] of [
      [0, -md.d / 2 + t / 2, md.w, t], [0, md.d / 2 - t / 2, md.w, t],
      [-md.w / 2 + t / 2, 0, t, md.d], [md.w / 2 - t / 2, 0, t, md.d],
    ]) {
      addChild(g, meshNode("box", { pos: [px, md.y - 0.01, pz], scale: [sw, 0.07, sd2], color: hex(C.cyan), emissive: 1 }));
    }
    const collider = {
      min: [md.x - md.w / 2, md.y - 0.72, md.z - md.d / 2],
      max: [md.x + md.w / 2, md.y, md.z + md.d / 2],
      mover: true,
    };
    colliders.push(collider);
    anim.moverList.push({ node: g, collider, data: md, prev: [md.x, 0, md.z] });
    cullables.push({ node: g, x: md.x, z: md.z, r: Math.max(md.w, md.d) / 2 + md.amp + 1 });
  }

  /* ------------------- Skyline thành phố dưới vực ------------------- */

  function buildSkyline() {
    const rand = seededRand(40404);
    const spots = [];
    // Vành đai quanh 3 khúc course (hành lang chữ U: x -101..4, z -131..5)
    for (let i = 0; i < 64; i++) {
      const t = rand();
      let x;
      let z;
      if (t < 0.34) { // dọc khúc A
        x = (rand() > 0.5 ? 1 : -1) * (7.5 + rand() * 24);
        z = 8 - rand() * 145;
      } else if (t < 0.62) { // dọc khúc B (phía nam/bắc)
        x = -4 - rand() * 100;
        z = -126.5 + (rand() > 0.5 ? 1 : -1) * (7.5 + rand() * 24);
      } else { // dọc khúc C + vùng giữa chữ U
        x = -95 + (rand() > 0.5 ? 1 : -1) * (7.5 + rand() * 22);
        z = -35 - rand() * 90;
      }
      spots.push([x, z, rand]);
    }
    let billboards = 0;
    let towers = 0;
    for (const [x, z] of spots) {
      const w = 5 + rand() * 8;
      const d = 5 + rand() * 8;
      // Vài tòa "tower" cao vượt mặt track (xa hành lang) như ảnh gameplay
      const distCorridor = Math.min(
        Math.abs(x) < 6 ? 99 : Math.abs(x),
        Math.abs(z + 126.5) < 6 ? 99 : Math.abs(z + 126.5),
        Math.abs(x + 95) < 6 ? 99 : Math.abs(x + 95)
      );
      const tall = towers < 8 && distCorridor > 13 && rand() > 0.62;
      if (tall) towers += 1;
      const top = tall ? 2 + rand() * 7 : -2.5 - rand() * 9;
      const h = tall ? 26 + rand() * 14 : 14 + rand() * 18;
      const g = group(x, 0, z);
      addChild(g, meshNode("box", {
        pos: [0, top - h / 2, 0],
        scale: [w, h, d],
        color: hex(rand() > 0.5 ? "#0c1126" : "#101531"),
      }));
      // Tấm cửa sổ phát sáng 2 mặt hướng course
      const tex = rand() > 0.5 ? texWin1 : texWin2;
      addChild(g, meshNode("plane", {
        pos: [0, top - h / 2, d / 2 + 0.02],
        scale: [w * 0.92, h * 0.92, 1],
        color: [1, 1, 1],
        tex,
        emissive: 1,
        opacity: 0.9,
      }));
      addChild(g, meshNode("plane", {
        pos: [w / 2 + 0.02, top - h / 2, 0],
        rot: [0, Math.PI / 2, 0],
        scale: [d * 0.92, h * 0.92, 1],
        color: [1, 1, 1],
        tex,
        emissive: 1,
        opacity: 0.9,
      }));
      // Viền neon nóc ngẫu nhiên
      if (rand() > 0.4) {
        const nc = rand() > 0.5 ? C.cyan : C.magenta;
        addChild(g, meshNode("box", { pos: [0, top + 0.04, 0], scale: [w + 0.1, 0.09, 0.12], color: hex(nc), emissive: 1 }));
      }
      // Billboard 404 ARCADE trên vài tòa (như ảnh gameplay)
      if (billboards < 3 && rand() > 0.7) {
        addChild(g, meshNode("plane", {
          pos: [w / 2 + 0.06, top + 2.6, 0],
          rot: [0, Math.PI / 2, 0],
          scale: [5, 3.9, 1],
          color: [1, 1, 1],
          tex: texBillboard,
          emissive: 1,
        }));
        addChild(g, meshNode("box", { pos: [w / 2 - 0.4, top + 0.4, 0], scale: [1, 0.8, 0.6], color: hex("#0a0e20") }));
        billboards += 1;
      }
      cullables.push({ node: g, x, z, r: Math.max(w, d) / 2 });
    }
    // Crystal tím lơ lửng (ảnh gameplay có shard tím nổi trên đế)
    for (const [cx, cz] of [[8.5, -46], [-30, -118], [-104.5, -100], [-86, -50]]) {
      const g = group(cx, 0, cz);
      addChild(g, meshNode("box", { pos: [0, -1.5, 0], scale: [1.6, 0.5, 1.6], color: hex(C.slabDark) }));
      const crystal = meshNode("gem", {
        pos: [0, 0.6, 0],
        scale: [0.75, 1.9, 0.75],
        color: hex(C.violet),
        emissive: 1,
      });
      addChild(g, crystal);
      anim.shards.push({ node: g, gem: crystal, glow: null, ring: null, data: null, taken: false, decor: true, t: Math.random() * 6 });
      cullables.push({ node: g, x: cx, z: cz, r: 2 });
    }
  }

  /* ------------------- Landing marker ------------------- */

  const markerNode = meshNode("plane", {
    pos: [0, 0, 0],
    rot: [-Math.PI / 2, 0, 0],
    scale: [3.4, 3.4, 1],
    color: [1, 1, 1],
    tex: texMarker,
    emissive: 1,
    opacity: 0.9,
    additive: true,
  });
  markerNode.visible = false;
  addChild(root, markerNode);
  anim.marker = markerNode;

  /* ------------------- Dựng toàn bộ ------------------- */

  for (const p of course.platforms) buildPlatform(p);
  for (const w of course.walls) buildWall(w);
  for (const t of course.tunnels) buildTunnel(t);
  for (const l of course.lasers) buildLaser(l);
  course.shards.forEach((s, i) => buildShard(s, i));
  for (const gd of course.gates) buildGate(gd);
  for (const pd of course.pads) buildPad(pd);
  for (const m of course.movers) buildMover(m);
  for (const a of course.arrows) buildArrow(a);
  for (const fa of course.floorArrows) buildFloorArrow(fa);
  buildPortal(course.portal);
  buildSkyline();

  /* ==================== Logic runtime ==================== */

  let time = 0;
  let moverTime = 0;
  let laserScale = 1;
  let laserTime = 0;

  function resetRun() {
    moverTime = 0;
    laserTime = 0;
    for (const s of anim.shards) {
      if (s.decor) continue;
      s.taken = false;
      s.node.visible = true;
    }
    for (const gf of anim.gateFlash) {
      gf.active = false;
      gf.flashT = 0;
      for (const p of gf.parts) {
        p.mesh.color = hex(C.lime);
        if (p.mesh.emissive > 0) p.mesh.emissive = 0.85;
      }
      gf.diamond.mesh.color = hex(C.lime);
      gf.veil.mesh.color = hex(C.lime);
    }
    if (anim.portal) {
      anim.portal.active = false;
    }
    syncMovers();
  }

  function resetMoverPhase() {
    moverTime = 0;
    syncMovers();
  }

  function syncMovers() {
    for (const m of anim.moverList) {
      const d = m.data;
      const off = Math.sin((moverTime / d.period) * Math.PI * 2 + d.phase) * d.amp;
      const nx = d.axis === "x" ? d.x + off : d.x;
      const ny = d.axis === "y" ? d.y + off : d.y;
      const nz = d.axis === "z" ? d.z + off : d.z;
      m.node.pos[0] = nx;
      m.node.pos[2] = nz;
      // Trục y dời cả node con: platform mesh đặt theo md.y → dùng offset node y
      m.node.pos[1] = ny - d.y;
      m.collider.min[0] = nx - d.w / 2;
      m.collider.max[0] = nx + d.w / 2;
      m.collider.min[2] = nz - d.d / 2;
      m.collider.max[2] = nz + d.d / 2;
      m.collider.min[1] = ny - 0.72;
      m.collider.max[1] = ny;
    }
  }

  /** Cổng theo thứ tự: chỉ kích hoạt gate index === next. */
  function checkGate(pos, nextIndex) {
    for (const gf of anim.gateFlash) {
      if (gf.active || gf.index !== nextIndex) continue;
      const gd = gf.data;
      const along = gd.axis === "z" ? Math.abs(pos[2] - gd.z) : Math.abs(pos[0] - gd.x);
      const across = gd.axis === "z" ? Math.abs(pos[0] - gd.x) : Math.abs(pos[2] - gd.z);
      if (along < 0.9 && across < 2.4 && pos[1] > gd.y - 1 && pos[1] < gd.y + 3) {
        gf.active = true;
        gf.flashT = 0.6;
        return gf.index;
      }
    }
    return 0;
  }

  function activateGateSilent(index) {
    for (const gf of anim.gateFlash) {
      if (gf.index === index) gf.active = true;
    }
  }

  function setPortalActive(on) {
    if (anim.portal) anim.portal.active = on;
  }

  function checkPortal(pos) {
    if (!anim.portal || !anim.portal.active) return false;
    const pp = anim.portal.data;
    const along = pp.axis === "z" ? Math.abs(pos[2] - pp.z) : Math.abs(pos[0] - pp.x);
    const across = pp.axis === "z" ? Math.abs(pos[0] - pp.x) : Math.abs(pos[2] - pp.z);
    return along < 1 && across < 2.2;
  }

  function checkShards(pos) {
    let got = 0;
    for (const s of anim.shards) {
      if (s.decor || s.taken) continue;
      const d = s.data;
      const dx = pos[0] - d.x;
      const dy = pos[1] + 0.9 - (d.y + 0.55);
      const dz = pos[2] - d.z;
      if (dx * dx + dy * dy + dz * dz < 1.45) {
        s.taken = true;
        s.node.visible = false;
        got += 1;
      }
    }
    return got;
  }

  function checkPad(pos) {
    for (const p of anim.pads) {
      const d = p.data;
      if (Math.abs(pos[0] - d.x) < 1 && Math.abs(pos[2] - d.z) < 1.2 && Math.abs(pos[1] - d.y) < 0.4) {
        return d;
      }
    }
    return null;
  }

  /** Capsule (chân pos, cao h, bán kính r) chạm beam laser đang bật? */
  function checkLaser(pos, h, r) {
    for (const L of anim.beams) {
      if (!L.on) continue;
      const d = L.data;
      for (const b of L.beams) {
        const by = b.y;
        if (by < pos[1] - 0.06 || by > pos[1] + h + 0.06) continue;
        if (d.axis === "x") {
          if (Math.abs(pos[2] - d.z) < r + 0.09 && Math.abs(pos[0] - d.x) < d.len / 2 + r) return true;
        } else if (Math.abs(pos[0] - d.x) < r + 0.09 && Math.abs(pos[2] - d.z) < d.len / 2 + r) {
          return true;
        }
      }
    }
    return false;
  }

  /** Có laser sắp bật rất gần (phát âm cảnh báo)? */
  function laserWarnNear(pos) {
    for (const L of anim.beams) {
      if (!L.warnEdge) continue;
      const d = L.data;
      const dist = Math.abs(pos[0] - d.x) + Math.abs(pos[2] - d.z);
      if (dist < 14) {
        L.warnEdge = false;
        return true;
      }
    }
    return false;
  }

  /* ---- Va chạm ngang: đẩy hình tròn ra khỏi AABB ---- */
  function resolveMove(pos, radius, height) {
    let touchedWall = null;
    for (const c of colliders) {
      if (pos[1] + height <= c.min[1] + 0.02 || pos[1] >= c.max[1] - 0.06) continue;
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
      if (c.wallRun) touchedWall = c;
    }
    return touchedWall;
  }

  /* ---- Update mỗi frame ---- */
  let cullT = 0;

  function update(dt, { playing = false, camPos = null } = {}) {
    time += dt;

    // Shards xoay + bob
    for (const s of anim.shards) {
      if (s.taken) continue;
      s.t += dt;
      s.gem.rot[1] += dt * (s.decor ? 0.7 : 1.8);
      const bob = Math.sin(s.t * 2.2) * 0.09;
      if (s.data) {
        s.gem.pos[1] = s.data.y + 0.55 + bob;
        if (s.glow) {
          s.glow.pos[1] = s.gem.pos[1];
          s.glow.rot[1] = s.gem.rot[1];
          s.glow.mesh.opacity = 0.13 + 0.08 * Math.sin(s.t * 3);
        }
        if (s.ring) s.ring.rot[2] += dt * 0.8;
      } else {
        s.gem.pos[1] = 0.6 + bob * 2;
      }
    }

    // Gates: diamond pulse + flash khi kích hoạt
    for (const gf of anim.gateFlash) {
      gf.diamond.rot[1] += dt * 2.2;
      if (gf.flashT > 0) {
        gf.flashT -= dt;
        const k = Math.max(0, gf.flashT / 0.6);
        gf.veil.mesh.opacity = 0.1 + k * 0.5;
        if (gf.flashT <= 0) {
          // Sau khi qua: cổng chuyển cyan mờ (đã kích hoạt)
          const done = hex("#3ba9c2");
          for (const p of gf.parts) {
            if (p.mesh.emissive > 0) {
              p.mesh.color = done;
              p.mesh.emissive = 0.45;
            }
          }
          gf.diamond.mesh.color = done;
          gf.veil.mesh.color = done;
          gf.veil.mesh.opacity = 0.05;
        }
      } else if (!gf.active) {
        gf.veil.mesh.opacity = 0.08 + 0.05 * Math.sin(time * 2.4 + gf.index);
      }
    }

    // Lasers: chu kỳ on/off + telegraph nhấp nháy trước khi bật
    if (playing) laserTime += dt;
    for (const L of anim.beams) {
      const d = L.data;
      const period = d.period * laserScale;
      const onDur = d.on * laserScale * 0.82;
      const phase = ((laserTime + d.offset) % period + period) % period;
      const wasOn = L.on;
      L.on = phase < onDur;
      const warnWin = phase > period - 0.45;
      if (warnWin && !L.warned) {
        L.warned = true;
        L.warnEdge = true;
      } else if (!warnWin) {
        L.warned = false;
      }
      for (const b of L.beams) {
        if (L.on) {
          b.beam.visible = true;
          b.core.visible = true;
          b.glow.visible = true;
          b.beam.mesh.opacity = 0.85 + 0.15 * Math.sin(time * 22);
          b.beam.scale[1] = 0.13;
          b.beam.scale[2] = 0.13;
        } else if (warnWin) {
          // Telegraph: beam mảnh nhấp nháy nhanh
          const blink = Math.sin(time * 34) > 0;
          b.beam.visible = blink;
          b.core.visible = false;
          b.glow.visible = false;
          b.beam.mesh.opacity = 0.35;
          b.beam.scale[1] = 0.05;
          b.beam.scale[2] = 0.05;
        } else {
          b.beam.visible = false;
          b.core.visible = false;
          b.glow.visible = false;
        }
      }
      void wasOn;
    }

    // Movers
    if (playing) {
      moverTime += dt;
      for (const m of anim.moverList) m.prev = [m.node.pos[0], m.collider.max[1], m.node.pos[2]];
      syncMovers();
      for (const m of anim.moverList) {
        m.delta = [
          m.node.pos[0] - m.prev[0],
          m.collider.max[1] - m.prev[1],
          m.node.pos[2] - m.prev[2],
        ];
      }
    }

    // Pads chevron trôi
    for (const p of anim.pads) {
      p.t += dt;
      p.arrow.mesh.opacity = 0.7 + 0.3 * Math.sin(p.t * 5);
    }

    // Portal
    if (anim.portal) {
      const P = anim.portal;
      P.t += dt;
      P.ringInner.rot[2] += dt * (P.active ? 1.6 : 0.35);
      const pulse = P.active ? 0.75 + 0.25 * Math.sin(P.t * 4) : 0.28;
      P.glow.mesh.opacity = pulse * 0.55;
      P.ringInner.mesh.opacity = P.active ? 0.95 : 0.4;
      P.ringOuter.mesh.emissive = P.active ? 1 : 0.55;
      for (const b of anim.portalBits) {
        b.a += dt * b.sp * (P.active ? 2 : 1);
        b.node.pos[0] = Math.cos(b.a) * b.r;
        b.node.pos[1] = 2.3 + Math.sin(b.a) * b.r;
        b.node.pos[2] = Math.sin(b.a * 1.7) * 0.2;
        b.node.rot[2] += dt * 2;
      }
    }

    // Marker pulse
    if (anim.marker.visible) {
      const k = 1 + Math.sin(time * 6) * 0.05;
      anim.marker.scale[0] = 3.4 * k;
      anim.marker.scale[1] = 3.4 * k;
    }

    // Distance culling (mỗi 0.3 s)
    cullT -= dt;
    if (camPos && cullT <= 0) {
      cullT = 0.3;
      const R2 = 135 * 135;
      for (const cu of cullables) {
        const dx = cu.x - camPos[0];
        const dz = cu.z - camPos[2];
        cu.node.visible = dx * dx + dz * dz < R2 + cu.r * cu.r * 4;
      }
    }
  }

  function setMarker(x, y, z) {
    if (x === null) {
      anim.marker.visible = false;
      return;
    }
    anim.marker.visible = true;
    anim.marker.pos[0] = x;
    anim.marker.pos[1] = y + 0.07;
    anim.marker.pos[2] = z;
  }

  return {
    root,
    course,
    colliders,
    movers: anim.moverList,
    resolveMove,
    update,
    resetRun,
    resetMoverPhase,
    checkGate,
    activateGateSilent,
    checkShards,
    checkPad,
    checkLaser,
    laserWarnNear,
    checkPortal,
    setPortalActive,
    setMarker,
    setLaserScale(s) { laserScale = s; },
    shardTotal: course.shards.length,
  };
}

exports.createWorld = createWorld;
};
__defs["games/void-runner/config.js"] = function (exports, __req) {
/**
 * config.js — thông số tuning của VOID RUNNER 404.
 * Màu bám theo asset sheet (đen xanh đậm / cyan / magenta / lime),
 * movement theo plan mục 7 (walk 7, sprint 11, gravity 24, coyote/buffer…).
 */

const VR_COLORS = {
  bg: "#120c2a",          // nền vực tím than
  fog: [0.1, 0.068, 0.21],
  slab: "#1d2445",        // mặt platform đá tối
  slabDark: "#12172e",    // thân/đáy platform
  panel: "#101631",
  cyan: "#22e4ff",
  magenta: "#e42cff",
  pink: "#ff3fd4",
  lime: "#b7f232",
  red: "#ff2e4d",
  violet: "#8b5bff",
  white: "#f2f6ff",
  gold: "#ffd23f",
};

const VR_MOVE = {
  walk: 7,
  sprint: 11,
  boostSpeed: 18.5,       // tốc độ khi đạp jump pad
  boostJumpV: 11.6,       // lực bật lên của jump pad
  boostTime: 1.6,
  groundAccel: 35,
  airAccel: 12,
  gravity: 24,
  jumpHeight: 1.7,        // v = sqrt(2·g·h) ≈ 9.03
  coyote: 0.13,
  jumpBuffer: 0.13,
  slideTime: 1.05,
  slideBoost: 1.16,       // nhân tốc độ lúc bắt đầu trượt
  slideMinSpeed: 5.2,
  wallRunTime: 1.5,
  wallRunGravity: 4.5,
  wallRunMinSpeed: 5,
  wallRunCooldown: 0.45,
  wallJumpOut: 6.6,       // lực bật khỏi tường (ngang / dọc)
  wallJumpUp: 7.6,
  capsuleR: 0.42,
  standH: 1.8,
  crouchH: 0.92,
  eyeStand: 1.62,
  eyeCrouch: 0.84,
  stepUp: 0.35,           // bậc thấp tự bước lên
  fallY: -13,             // rơi dưới mức này = DEAD (fallback volume)
};

const VR_ENERGY = {
  start: 100,
  max: 100,
  sprintDrain: 12,        // %/s khi sprint
  regen: 6,               // %/s khi không sprint
  regenDelay: 0.8,
  shardGain: 18,
};

/** Độ khó: chu kỳ laser + penalty khi rơi/chạm laser. */
const VR_DIFFICULTY = {
  easy: { laserScale: 1.35, penalty: 2 },
  normal: { laserScale: 1, penalty: 3 },
  hard: { laserScale: 0.78, penalty: 5 },
};

const VR_QUALITY_SCALE = { low: 0.62, medium: 0.82, high: 1 };

const VR_TOTAL_CHECKPOINTS = 8; // 7 cổng + đích

const VR_SETTINGS_KEY = "void-runner-settings";
const VR_BEST_TIME_KEY = "void-runner-best-time";

exports.VR_COLORS = VR_COLORS; exports.VR_MOVE = VR_MOVE; exports.VR_ENERGY = VR_ENERGY; exports.VR_DIFFICULTY = VR_DIFFICULTY; exports.VR_QUALITY_SCALE = VR_QUALITY_SCALE; exports.VR_TOTAL_CHECKPOINTS = VR_TOTAL_CHECKPOINTS; exports.VR_SETTINGS_KEY = VR_SETTINGS_KEY; exports.VR_BEST_TIME_KEY = VR_BEST_TIME_KEY;
};
__defs["games/void-runner/course.js"] = function (exports, __req) {
/**
 * course.js — dữ liệu tuyến parkour theo Level Blueprint (1 unit = 1 m).
 *
 * Course hình chữ U, 8 zone đúng thứ tự blueprint:
 *   Khúc A (chạy -Z, x=0):    1 XUẤT PHÁT → 2 NHẢY CƠ BẢN → 3 WALL-RUN
 *   Khúc B (chạy -X, z=-126): 4 TRƯỢT → 5 PLATFORM ĐỘNG
 *   Khúc C (chạy +Z, x=-95):  6 LASER → 7 LEAP CUỐI → 8 ĐÍCH
 *
 * Mọi tọa độ y của platform là ĐỘ CAO MẶT TRÊN. Checkpoint 1..7 là cổng
 * vòm lime (asset sheet), checkpoint 8 = finish portal tím.
 */

function createCourse() {
  // {x,y,z,w,d, kind} — kind: start | path | land | corner | plaza
  const platforms = [];
  // Tường wall-run nổi: {x, y (đáy), z, len, h, axis:"z"|"x", face:1|-1}
  // face = phía người chơi chạm vào (+1: player ở phía dương của trục vuông góc)
  const walls = [];
  // Cổng trượt tròn: {x,y,z, axis} — collider trần ép phải trượt
  const tunnels = [];
  // Platform động: {x,y,z,w,d, axis:"x"|"y"|"z", amp, period, phase}
  const movers = [];
  // Laser: {x,y,z, axis, len, mode:"low"|"mid"|"gate", period, on, offset}
  const lasers = [];
  const shards = []; // {x,y,z}
  const gates = [];  // {x,y,z, axis, index}
  const pads = [];   // {x,y,z, axis, dir} jump pad boost
  const arrows = []; // {x,y,z, yaw} biển chevron chỉ hướng ở khúc quẹo
  // Chevron cyan mờ trên mặt track (chỉ hướng chạy — ảnh gameplay)
  const floorArrows = [
    { x: 0, y: 0, z: -12, yaw: 0 },
    { x: 0, y: 0, z: -22, yaw: 0 },
    { x: -8, y: 0, z: -126.5, yaw: Math.PI / 2 },
    { x: -28, y: 0, z: -126.5, yaw: Math.PI / 2 },
    { x: -95, y: 0, z: -119, yaw: Math.PI },
    { x: -95, y: 0, z: -50, yaw: Math.PI },
  ];

  const plat = (x, y, z, w, d, kind = "path") => platforms.push({ x, y, z, w, d, kind });

  /* ---------------- ZONE 1 — XUẤT PHÁT (z 5 → -31) ---------------- */
  plat(0, 0, 1, 7, 8, "start");
  plat(0, 0, -17, 4.6, 28);
  shards.push({ x: 0, y: 1.1, z: -12 }, { x: 0, y: 1.1, z: -22 });
  gates.push({ x: 0, y: 0, z: -28, axis: "z", index: 1 });

  /* ---------------- ZONE 2 — NHẢY CƠ BẢN (z -31 → -76) ---------------- */
  plat(0, 0, -35, 4, 4);
  plat(0, 0.7, -42, 4, 4);
  plat(1.6, 1.3, -49, 4, 4);
  plat(-1.6, 1.3, -56, 4, 4);
  plat(0, 0.6, -63, 4, 4);
  plat(0, 0, -71.5, 6, 9, "land");
  shards.push(
    { x: 0, y: 1.8, z: -38.5 },
    { x: 1.6, y: 2.4, z: -49 },
    { x: -1.6, y: 2.4, z: -56 },
    { x: 0, y: 2, z: -67 }
  );
  gates.push({ x: 0, y: 0, z: -74, axis: "z", index: 2 });

  /* ---------------- ZONE 3 — WALL-RUN (z -76 → -122) ---------------- */
  // Gap 16 m, tường bên PHẢI hướng chạy (x dương) → player áp mặt -X của tường
  walls.push({ x: 2.9, y: -0.7, z: -84, len: 17, h: 3.8, axis: "z", face: -1 });
  plat(0, 0, -95, 4, 6);
  // Gap 2, tường bên TRÁI → player áp mặt +X
  walls.push({ x: -2.9, y: -0.7, z: -106, len: 17, h: 3.8, axis: "z", face: 1 });
  plat(0, 0, -117.5, 6, 8, "land");
  shards.push({ x: 0.6, y: 1.7, z: -82 }, { x: -0.6, y: 1.7, z: -104 });
  gates.push({ x: 0, y: 0, z: -120, axis: "z", index: 3 });

  // Khúc quẹo A → hướng -X
  plat(0, 0, -126.5, 9, 9, "corner");
  arrows.push({ x: 2.5, y: 1.7, z: -126.5, yaw: Math.PI / 2 });

  /* ---------------- ZONE 4 — TRƯỢT (x -4.5 → -49, z=-126.5) ---------------- */
  plat(-17.5, 0, -126.5, 26, 4.4);
  tunnels.push({ x: -11, y: 0, z: -126.5, axis: "x" });
  tunnels.push({ x: -23, y: 0, z: -126.5, axis: "x" });
  plat(-40.5, 0, -126.5, 14, 4.4);
  tunnels.push({ x: -40, y: 0, z: -126.5, axis: "x" });
  shards.push(
    { x: -11, y: 0.62, z: -126.5 },
    { x: -23, y: 0.62, z: -126.5 },
    { x: -40, y: 0.62, z: -126.5 }
  );
  gates.push({ x: -45.5, y: 0, z: -126.5, axis: "x", index: 4 });

  /* ---------------- ZONE 5 — PLATFORM ĐỘNG (x -49 → -91) ---------------- */
  movers.push({ x: -53.5, y: 0, z: -126.5, w: 3.2, d: 3.2, axis: "z", amp: 4, period: 3.4, phase: 0 });
  movers.push({ x: -61, y: 0.9, z: -126.5, w: 3.2, d: 3.2, axis: "y", amp: 1.1, period: 4.2, phase: 1.2 });
  movers.push({ x: -68.5, y: 0, z: -126.5, w: 3.2, d: 3.2, axis: "z", amp: 4, period: 3.4, phase: Math.PI });
  plat(-75.5, 0, -126.5, 6, 6, "land");
  plat(-84, 0, -126.5, 11, 4.4);
  shards.push(
    { x: -61, y: 2.2, z: -126.5 },
    { x: -75.5, y: 1.1, z: -126.5 },
    { x: -83, y: 1.1, z: -126.5 }
  );
  gates.push({ x: -87.5, y: 0, z: -126.5, axis: "x", index: 5 });

  // Khúc quẹo B → hướng +Z
  plat(-95, 0, -126.5, 9, 9, "corner");
  arrows.push({ x: -95, y: 1.7, z: -124, yaw: Math.PI });

  /* ---------------- ZONE 6 — LASER (z -122 → -88, x=-95) ---------------- */
  plat(-95, 0, -105, 4.4, 34);
  lasers.push({ x: -95, y: 0.55, z: -116, axis: "x", len: 4.4, mode: "low", period: 2.6, on: 1.5, offset: 0 });
  lasers.push({ x: -95, y: 1.35, z: -110, axis: "x", len: 4.4, mode: "mid", period: 2.6, on: 1.5, offset: 0.9 });
  lasers.push({ x: -95, y: 0.55, z: -104, axis: "x", len: 4.4, mode: "low", period: 2.6, on: 1.5, offset: 1.7 });
  lasers.push({ x: -95, y: 0.5, z: -98, axis: "x", len: 4.4, mode: "gate", period: 3, on: 1.35, offset: 0.4 });
  lasers.push({ x: -95, y: 1.35, z: -92.5, axis: "x", len: 4.4, mode: "mid", period: 2.6, on: 1.5, offset: 2.1 });
  shards.push({ x: -95, y: 1.1, z: -113 }, { x: -95, y: 1.1, z: -101 });
  gates.push({ x: -95, y: 0, z: -89.5, axis: "z", index: 6 });

  /* ---------------- ZONE 7 — LEAP CUỐI (z -88 → -55) ---------------- */
  plat(-95, 0, -84, 4.4, 8);
  pads.push({ x: -95, y: 0, z: -82.5, axis: "z", dir: 1 });
  // Gap lớn ~13 m — pad boost + landing marker
  plat(-95, 0, -60, 8, 14, "land");
  shards.push({ x: -95, y: 2.4, z: -76 }, { x: -95, y: 2.8, z: -72 }, { x: -95, y: 2.4, z: -68 });
  gates.push({ x: -95, y: 0, z: -62.5, axis: "z", index: 7 });

  /* ---------------- ZONE 8 — ĐÍCH (z -55 → -38) ---------------- */
  plat(-95, 0, -46.5, 12, 17, "plaza");

  return {
    platforms,
    walls,
    tunnels,
    movers,
    lasers,
    shards,
    gates,
    pads,
    arrows,
    floorArrows,
    portal: { x: -95, y: 0, z: -42.5, axis: "z" },
    spawn: { pos: [0, 0, 1.5], yaw: 0 },
    // Điểm respawn của từng checkpoint (đứng ngay sau cổng, nhìn theo hướng chạy)
    respawns: [
      { pos: [0, 0, 1.5], yaw: 0 },            // chưa qua cổng nào → về start
      { pos: [0, 0, -29.5], yaw: 0 },           // CP1
      { pos: [0, 0.05, -74.5], yaw: 0 },        // CP2
      { pos: [0, 0, -121], yaw: 0 },            // CP3 (trước khúc quẹo A)
      { pos: [-46.5, 0, -126.5], yaw: Math.PI / 2 },  // CP4 (hướng -X)
      { pos: [-88.5, 0, -126.5], yaw: Math.PI / 2 },  // CP5
      { pos: [-95, 0, -89], yaw: Math.PI },      // CP6 (hướng +Z)
      { pos: [-95, 0, -61.5], yaw: Math.PI },    // CP7
    ],
    // Tâm nhìn cho camera idle bay quanh
    overview: { x: -48, y: 0, z: -85 },
  };
}

exports.createCourse = createCourse;
};
__defs["games/void-runner/player.js"] = function (exports, __req) {
/**
 * player.js — capsule controller góc nhìn thứ nhất của VOID RUNNER:
 * WASD + sprint + jump (coyote time, jump buffer) + slide (hạ capsule,
 * không đứng dậy dưới trần) + wall-run (chỉ trên tường đánh dấu, giảm
 * gravity, camera roll, wall-jump) + moving platform displacement +
 * jump pad boost + camera effects (bob/dip/roll/FOV, tôn trọng
 * reduced motion). Dự đoán điểm hạ cánh cho landing marker.
 */

const { clamp } = __req("core/utils.js");
const { VR_MOVE } = __req("games/void-runner/config.js");

const M = VR_MOVE;

function createPlayer(world, camera, motion = {}) {
  // motion.reduced đọc động mỗi frame (setting đổi được trong pause menu)
  const pos = [0, 0, 0]; // chân nhân vật
  const vel = [0, 0, 0];
  let yaw = 0;
  let pitch = 0;

  let grounded = false;
  let groundRef = null;   // collider đang đứng (mover → nhận displacement)
  let airTime = 0;
  let jumpBufferT = 0;
  let jumpedSinceGround = false;

  let sliding = false;
  let slideT = 0;
  let slideDir = [0, 0];
  let crouched = false;   // capsule thấp (slide hoặc kẹt dưới trần)

  let wallRun = null;     // {collider, side, tangent:[x,z], normal:[x,z], t}
  let wallCooldown = 0;
  let lastWall = null;

  let boostT = 0;

  // Camera feel
  let bobPhase = 0;
  let bobAmp = 0;
  let dip = 0;
  let dipVel = 0;
  let rollCur = 0;
  let shakeT = 0;
  let shakeAmp = 0;
  let stepAcc = 0;
  let eyeCur = M.eyeStand;

  const height = () => (crouched ? M.crouchH : M.standH);

  function reset(spawn) {
    pos[0] = spawn.pos[0];
    pos[1] = spawn.pos[1];
    pos[2] = spawn.pos[2];
    vel[0] = vel[1] = vel[2] = 0;
    yaw = spawn.yaw;
    pitch = 0;
    grounded = true;
    groundRef = null;
    airTime = 0;
    jumpBufferT = 0;
    jumpedSinceGround = false;
    sliding = false;
    crouched = false;
    wallRun = null;
    wallCooldown = 0;
    lastWall = null;
    boostT = 0;
    dip = 0;
    dipVel = 0;
    rollCur = 0;
    eyeCur = M.eyeStand;
    camera.roll = 0;
  }

  function look(dx, dy, sensitivity) {
    const k = 0.0021 * sensitivity;
    yaw -= dx * k;
    pitch = clamp(pitch - dy * k, -1.45, 1.45);
  }

  function queueJump() {
    jumpBufferT = M.jumpBuffer;
  }

  function shake(amp = 0.6) {
    if (motion.reduced) return;
    shakeT = 0.3;
    shakeAmp = amp;
  }

  function boost(dirVec) {
    vel[0] = dirVec[0] * M.boostSpeed;
    vel[2] = dirVec[2] * M.boostSpeed;
    vel[1] = M.boostJumpV;
    grounded = false;
    groundRef = null;
    boostT = M.boostTime;
    jumpedSinceGround = true;
  }

  /* ---------- Trợ giúp va chạm ---------- */

  function overlapXZ(c, r) {
    return (
      pos[0] > c.min[0] - r && pos[0] < c.max[0] + r &&
      pos[2] > c.min[2] - r && pos[2] < c.max[2] + r
    );
  }

  function canStand() {
    // Có trần chặn trong khoảng crouch→stand không?
    const top = pos[1] + M.standH;
    for (const c of world.colliders) {
      if (!overlapXZ(c, M.capsuleR * 0.8)) continue;
      if (c.min[1] < top && c.max[1] > pos[1] + M.crouchH) return false;
    }
    return true;
  }

  /* ---------- Wall-run ---------- */

  function tryEngageWall() {
    if (wallCooldown > 0 || grounded || sliding) return;
    const hSpeed = Math.hypot(vel[0], vel[2]);
    if (hSpeed < M.wallRunMinSpeed || vel[1] > 3.5) return;
    const midY = pos[1] + height() * 0.55;
    for (const c of world.colliders) {
      if (!c.wallRun || c === lastWall) continue;
      if (midY < c.min[1] || midY > c.max[1]) continue;
      const reach = M.capsuleR + 0.5;
      if (c.axis === "z") {
        // Tường dọc Z: player phải ở phía face (±X) và trong tầm với
        const surfX = c.face < 0 ? c.min[0] : c.max[0];
        const dx = (pos[0] - surfX) * c.face;
        if (dx < 0 || dx > reach) continue;
        if (pos[2] < c.min[2] - 0.4 || pos[2] > c.max[2] + 0.4) continue;
        const tz = vel[2] >= 0 ? 1 : -1;
        if (Math.abs(vel[2]) < M.wallRunMinSpeed * 0.7) continue;
        wallRun = {
          collider: c,
          normal: [c.face, 0],
          tangent: [0, tz],
          t: 0,
        };
      } else {
        const surfZ = c.face < 0 ? c.min[2] : c.max[2];
        const dz = (pos[2] - surfZ) * c.face;
        if (dz < 0 || dz > reach) continue;
        if (pos[0] < c.min[0] - 0.4 || pos[0] > c.max[0] + 0.4) continue;
        const tx = vel[0] >= 0 ? 1 : -1;
        if (Math.abs(vel[0]) < M.wallRunMinSpeed * 0.7) continue;
        wallRun = {
          collider: c,
          normal: [0, c.face],
          tangent: [tx, 0],
          t: 0,
        };
      }
      if (wallRun) {
        vel[1] = Math.max(vel[1], 1.2);
        return;
      }
    }
  }

  function detachWall(cooldown = M.wallRunCooldown) {
    if (!wallRun) return;
    lastWall = wallRun.collider;
    wallRun = null;
    wallCooldown = cooldown;
  }

  /** Bên tường so với hướng nhìn: +1 phải, -1 trái (cho camera roll/gloves). */
  function wallSide() {
    if (!wallRun) return 0;
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);
    // Tường nằm ở phía -normal so với player
    const d = -(wallRun.normal[0] * rightX + wallRun.normal[1] * rightZ);
    return d > 0 ? 1 : -1;
  }

  /* ---------- Update chính ---------- */

  function update(dt, input) {
    // input: {forward, strafe, sprintHeld, sprintAllowed, slideHeld}
    const ev = {
      jumped: false, wallJumped: false, landed: 0,
      slideStart: false, slideEnd: false,
      wallStart: false, wallEnd: false, step: false,
    };

    wallCooldown = Math.max(0, wallCooldown - dt);
    jumpBufferT = Math.max(0, jumpBufferT - dt);
    boostT = Math.max(0, boostT - dt);

    // Moving platform: nhận displacement khi đứng trên
    if (grounded && groundRef && groundRef.mover) {
      const m = world.movers.find((mm) => mm.collider === groundRef);
      if (m && m.delta) {
        pos[0] += m.delta[0];
        pos[2] += m.delta[2];
        pos[1] = groundRef.max[1];
      }
    }

    const sprinting = input.sprintHeld && input.sprintAllowed && input.forward > 0 && !sliding;

    /* ----- Slide ----- */
    const hSpeedNow = Math.hypot(vel[0], vel[2]);
    if (!sliding && input.slideHeld && grounded && hSpeedNow > M.slideMinSpeed) {
      sliding = true;
      crouched = true;
      slideT = M.slideTime;
      const len = hSpeedNow || 1;
      slideDir = [vel[0] / len, vel[2] / len];
      vel[0] *= M.slideBoost;
      vel[2] *= M.slideBoost;
      ev.slideStart = true;
    }
    if (sliding) {
      slideT -= dt;
      const wantEnd = slideT <= 0 || (!input.slideHeld && slideT < M.slideTime - 0.15) || hSpeedNow < 2.2;
      if (wantEnd) {
        if (canStand()) {
          sliding = false;
          crouched = false;
          ev.slideEnd = true;
        } else {
          slideT = 0.08; // kẹt dưới trần: giữ crouch đến khi an toàn
        }
      }
    }

    /* ----- Điều khiển ngang ----- */
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    const wishX = -sin * input.forward + cos * input.strafe;
    const wishZ = -cos * input.forward - sin * input.strafe;
    const wishLen = Math.hypot(wishX, wishZ);

    if (wallRun) {
      /* ----- Wall-run ----- */
      wallRun.t += dt;
      const c = wallRun.collider;
      const tRun = wallRun.tangent;
      const speed = Math.max(Math.hypot(vel[0], vel[2]), M.sprint * 1.02);
      vel[0] = tRun[0] * speed;
      vel[2] = tRun[1] * speed;
      vel[1] = Math.max(vel[1] - M.wallRunGravity * dt, -2.6);

      // Áp sát tường
      if (c.axis === "z") pos[0] = (c.face < 0 ? c.min[0] : c.max[0]) + wallRun.normal[0] * M.capsuleR;
      else pos[2] = (c.face < 0 ? c.min[2] : c.max[2]) + wallRun.normal[1] * M.capsuleR;

      // Wall-jump
      if (jumpBufferT > 0) {
        jumpBufferT = 0;
        vel[0] = tRun[0] * speed * 0.92 + wallRun.normal[0] * M.wallJumpOut;
        vel[2] = tRun[1] * speed * 0.92 + wallRun.normal[1] * M.wallJumpOut;
        vel[1] = M.wallJumpUp;
        detachWall(0.3);
        ev.wallJumped = true;
      } else {
        // Hết tường / hết thời gian → rơi
        const along = c.axis === "z" ? pos[2] : pos[0];
        const lo = c.axis === "z" ? c.min[2] : c.min[0];
        const hi = c.axis === "z" ? c.max[2] : c.max[0];
        if (wallRun.t > M.wallRunTime || along < lo - 0.5 || along > hi + 0.5) {
          detachWall();
          ev.wallEnd = true;
        }
      }
    } else {
      /* ----- Chạy / bay thường ----- */
      let target = sprinting ? M.sprint : M.walk;
      if (boostT > 0) target = Math.max(target, M.boostSpeed * (0.55 + 0.45 * (boostT / M.boostTime)));

      if (sliding) {
        // Trượt: momentum + lái rất nhẹ
        const steer = 2.6;
        vel[0] += wishX * steer * dt;
        vel[2] += wishZ * steer * dt;
        const sp = Math.hypot(vel[0], vel[2]);
        const decel = 4.6;
        const nsp = Math.max(0, sp - decel * dt);
        if (sp > 0.01) {
          vel[0] *= nsp / sp;
          vel[2] *= nsp / sp;
        }
      } else if (grounded) {
        const tx = wishLen > 0 ? (wishX / wishLen) * target * Math.min(1, wishLen) : 0;
        const tz = wishLen > 0 ? (wishZ / wishLen) * target * Math.min(1, wishLen) : 0;
        const blend = Math.min(1, M.groundAccel * dt / Math.max(1, target * 0.55));
        vel[0] += (tx - vel[0]) * blend;
        vel[2] += (tz - vel[2]) * blend;
      } else if (wishLen > 0) {
        // Air control: chỉnh hướng có giới hạn, không tăng tốc vô hạn
        const cur = Math.hypot(vel[0], vel[2]);
        const maxAir = Math.max(cur, target);
        vel[0] += (wishX / wishLen) * M.airAccel * dt;
        vel[2] += (wishZ / wishLen) * M.airAccel * dt;
        const sp = Math.hypot(vel[0], vel[2]);
        if (sp > maxAir) {
          vel[0] *= maxAir / sp;
          vel[2] *= maxAir / sp;
        }
      }
    }

    /* ----- Nhảy (coyote + buffer) ----- */
    if (!wallRun && jumpBufferT > 0 && !jumpedSinceGround && (grounded || airTime < M.coyote)) {
      jumpBufferT = 0;
      jumpedSinceGround = true;
      if (sliding) {
        sliding = false;
        crouched = !canStand();
        ev.slideEnd = true;
      }
      vel[1] = Math.sqrt(2 * M.gravity * M.jumpHeight);
      grounded = false;
      groundRef = null;
      ev.jumped = true;
    }

    /* ----- Tích phân ngang + va chạm ----- */
    pos[0] += vel[0] * dt;
    pos[2] += vel[2] * dt;
    world.resolveMove(pos, M.capsuleR, height());

    /* ----- Trọng lực + dọc ----- */
    const prevY = pos[1];
    if (!wallRun) vel[1] -= M.gravity * dt;
    pos[1] += vel[1] * dt;

    let landedNow = false;
    if (vel[1] <= 0) {
      // Đáp xuống mặt platform
      let best = null;
      for (const c of world.colliders) {
        if (c.ceiling) continue;
        if (!overlapXZ(c, M.capsuleR * 0.55)) continue;
        const top = c.max[1];
        if (top <= prevY + 0.001 && top >= pos[1] - 0.001) {
          if (!best || top > best.max[1]) best = c;
        }
      }
      // Đang grounded: bám mặt đất (đi qua platform liền kề / mover hạ xuống)
      if (!best && grounded) {
        for (const c of world.colliders) {
          if (c.ceiling) continue;
          if (!overlapXZ(c, M.capsuleR * 0.55)) continue;
          const top = c.max[1];
          if (Math.abs(top - pos[1]) < 0.14 + Math.abs(vel[1]) * dt * 2) {
            if (!best || top > best.max[1]) best = c;
          }
        }
      }
      if (best) {
        if (!grounded) {
          landedNow = true;
          ev.landed = Math.max(0, -vel[1]);
        }
        pos[1] = best.max[1];
        vel[1] = 0;
        grounded = true;
        groundRef = best;
        jumpedSinceGround = false;
        if (wallRun) {
          detachWall(0.1);
          ev.wallEnd = true;
        }
        lastWall = null;
      } else if (grounded) {
        grounded = false;
        groundRef = null;
        airTime = 0;
      }
    } else {
      // Đập đầu vào trần (tunnel, đáy platform)
      const h = height();
      for (const c of world.colliders) {
        if (!overlapXZ(c, M.capsuleR * 0.8)) continue;
        const bottom = c.min[1];
        if (prevY + h <= bottom + 0.02 && pos[1] + h > bottom) {
          pos[1] = bottom - h;
          vel[1] = 0;
        }
      }
      if (grounded) {
        grounded = false;
        groundRef = null;
        airTime = 0;
      }
    }

    if (!grounded) airTime += dt;
    else airTime = 0;

    // Buffer jump ngay khi chạm đất
    if (landedNow && jumpBufferT > 0 && !sliding) {
      jumpBufferT = 0;
      jumpedSinceGround = true;
      vel[1] = Math.sqrt(2 * M.gravity * M.jumpHeight);
      grounded = false;
      ev.jumped = true;
    }

    // Thử bám tường khi đang bay
    if (!grounded && !wallRun) {
      const hadWall = false;
      tryEngageWall();
      if (wallRun && !hadWall) ev.wallStart = true;
    }

    // Đứng dậy khỏi crouch khi hết slide và có chỗ
    if (crouched && !sliding && canStand()) crouched = false;

    /* ----- Camera ----- */
    const hSpeed = Math.hypot(vel[0], vel[2]);

    if (!motion.reduced && grounded && hSpeed > 0.8 && !sliding) {
      bobPhase += dt * (5.6 + hSpeed * 0.95);
      bobAmp = Math.min(1, bobAmp + dt * 5);
      stepAcc += dt * (hSpeed * 0.5);
      if (stepAcc > 1.65) {
        stepAcc = 0;
        ev.step = true;
      }
    } else {
      bobAmp = Math.max(0, bobAmp - dt * 5);
      stepAcc = 0;
    }

    // Landing dip (spring)
    if (landedNow && !motion.reduced && ev.landed > 4) {
      dipVel -= Math.min(0.9, ev.landed * 0.055);
    }
    dipVel += (-dip * 60 - dipVel * 9) * dt;
    dip += dipVel * dt;

    // Camera roll: wall-run nghiêng khỏi tường + lean nhẹ khi strafe
    let rollTarget = 0;
    if (!motion.reduced) {
      if (wallRun) rollTarget = wallSide() * -0.16;
      else rollTarget = input.strafe * -0.022 + (sliding ? 0.05 : 0);
    }
    rollCur += (rollTarget - rollCur) * Math.min(1, dt * 8);

    shakeT = Math.max(0, shakeT - dt);
    let sx = 0;
    let sy = 0;
    if (shakeT > 0) {
      const k = (shakeT / 0.3) * shakeAmp;
      sx = (Math.random() - 0.5) * 0.055 * k;
      sy = (Math.random() - 0.5) * 0.055 * k;
    }

    const eyeTarget = sliding || crouched ? M.eyeCrouch : M.eyeStand;
    eyeCur += (eyeTarget - eyeCur) * Math.min(1, dt * 12);
    const bobY = motion.reduced ? 0 : Math.sin(bobPhase * 2) * 0.036 * bobAmp;
    const bobX = motion.reduced ? 0 : Math.cos(bobPhase) * 0.02 * bobAmp;

    camera.pos[0] = pos[0] + bobX * cos + sx;
    camera.pos[1] = pos[1] + eyeCur + bobY + dip + sy;
    camera.pos[2] = pos[2] - bobX * sin;
    camera.yaw = yaw;
    camera.pitch = pitch;
    camera.roll = rollCur;

    return {
      ev,
      speed: hSpeed,
      grounded,
      sliding,
      wallRun: wallRun ? wallSide() : 0,
      boosting: boostT > 0,
      fell: pos[1] < M.fallY,
    };
  }

  /** Dự đoán điểm hạ cánh (landing marker) khi đang bay. */
  function predictLanding() {
    if (grounded || wallRun) return null;
    let px = pos[0];
    let py = pos[1];
    let pz = pos[2];
    let vy = vel[1];
    const step = 0.05;
    for (let t = 0; t < 3; t += step) {
      const prevPy = py;
      vy -= M.gravity * step;
      px += vel[0] * step;
      py += vy * step;
      pz += vel[2] * step;
      if (vy <= 0) {
        for (const c of world.colliders) {
          if (c.ceiling) continue;
          if (
            px > c.min[0] - 0.2 && px < c.max[0] + 0.2 &&
            pz > c.min[2] - 0.2 && pz < c.max[2] + 0.2 &&
            c.max[1] <= prevPy && c.max[1] >= py
          ) {
            return [px, c.max[1], pz];
          }
        }
      }
      if (py < M.fallY) return null;
    }
    return null;
  }

  return {
    pos,
    vel,
    reset,
    look,
    queueJump,
    boost,
    shake,
    update,
    predictLanding,
    get yaw() { return yaw; },
    get pitch() { return pitch; },
    get grounded() { return grounded; },
    get sliding() { return sliding; },
    get wallRunning() { return !!wallRun; },
    get airborne() { return !grounded && !wallRun; },
  };
}

exports.createPlayer = createPlayer;
};
__defs["games/void-runner/gloves.js"] = function (exports, __req) {
/**
 * gloves.js — first-person gloves theo asset sheet: găng đen, sọc neon
 * cổ tay, TAM GIÁC phát sáng trên mu tay (trái magenta / phải cyan như
 * ảnh gameplay). Procedural animation: vung khi chạy, nâng khi nhảy,
 * chống về phía tường khi wall-run, hạ thấp khi trượt, dịp khi đáp.
 */

const { createNode, addChild, meshNode, hex } = __req("games/strike/engine.js");
const { VR_COLORS } = __req("games/void-runner/config.js");

const C = VR_COLORS;

function buildHand(side, accent) {
  // side: -1 trái, +1 phải — dựng trong không gian camera (nhìn về -Z)
  const hand = createNode();
  const DARK = hex("#131625");
  const DARKER = hex("#0b0e1c");
  const NEON = hex(accent);

  // Cẳng tay (chạy vào từ góc màn hình)
  addChild(hand, meshNode("box", {
    pos: [side * 0.055, -0.075, 0.16],
    rot: [0.25, side * -0.12, side * 0.16],
    scale: [0.115, 0.1, 0.3],
    color: DARKER,
  }));
  // Vòng cổ tay + sọc neon
  addChild(hand, meshNode("box", {
    pos: [side * 0.022, -0.032, 0.075],
    rot: [0.18, side * -0.1, side * 0.1],
    scale: [0.115, 0.095, 0.055],
    color: DARK,
  }));
  addChild(hand, meshNode("box", {
    pos: [side * 0.022, -0.028, 0.075],
    rot: [0.18, side * -0.1, side * 0.1],
    scale: [0.118, 0.02, 0.028],
    color: NEON,
    emissive: 1,
  }));
  // Mu bàn tay (hơi nghiêng úp về trước)
  addChild(hand, meshNode("box", {
    pos: [0, 0, 0],
    rot: [0.32, side * -0.08, 0],
    scale: [0.105, 0.045, 0.13],
    color: DARK,
  }));
  // Tam giác neon trên mu tay (chỉa về trước như ảnh)
  addChild(hand, meshNode("tri", {
    pos: [0, 0.033, -0.005],
    rot: [-Math.PI / 2 + 0.32, 0, Math.PI],
    scale: [0.055, 0.062, 1],
    color: NEON,
    emissive: 1,
  }));
  // Sọc neon dọc mu
  addChild(hand, meshNode("box", {
    pos: [side * 0.045, 0.02, 0.02],
    rot: [0.32, 0, 0],
    scale: [0.008, 0.012, 0.1],
    color: NEON,
    emissive: 0.9,
  }));

  // 4 ngón: 2 đốt cong xuống
  for (let i = 0; i < 4; i++) {
    const fx = (i - 1.5) * 0.026;
    addChild(hand, meshNode("box", {
      pos: [fx, -0.028, -0.082],
      rot: [0.62, 0, 0],
      scale: [0.02, 0.02, 0.055],
      color: DARK,
    }));
    addChild(hand, meshNode("box", {
      pos: [fx, -0.052, -0.1],
      rot: [1.05, 0, 0],
      scale: [0.018, 0.018, 0.04],
      color: DARKER,
    }));
  }
  // Ngón cái
  addChild(hand, meshNode("box", {
    pos: [side * -0.062, -0.02, -0.02],
    rot: [0.5, side * 0.5, 0],
    scale: [0.02, 0.02, 0.06],
    color: DARK,
  }));
  // Khớp ngón phát sáng nhẹ
  addChild(hand, meshNode("box", {
    pos: [0, -0.018, -0.07],
    rot: [0.5, 0, 0],
    scale: [0.1, 0.008, 0.012],
    color: NEON,
    emissive: 0.7,
  }));

  return hand;
}

function createGloves(motion = {}) {
  const root = createNode();

  const BASE = {
    left: { pos: [-0.35, -0.335, -0.54], rot: [0.15, 0.32, 0.28] },
    right: { pos: [0.35, -0.335, -0.54], rot: [0.15, -0.32, -0.28] },
  };

  const left = createNode({ pos: [...BASE.left.pos], rot: [...BASE.left.rot] });
  const right = createNode({ pos: [...BASE.right.pos], rot: [...BASE.right.rot] });
  addChild(left, buildHand(-1, C.magenta));
  addChild(right, buildHand(1, C.cyan));
  addChild(root, left);
  addChild(root, right);

  let phase = 0;
  let amp = 0;
  let landDip = 0;
  let landVel = 0;
  let swayX = 0;
  let swayY = 0;

  function update(dt, s) {
    // s: {speed, grounded, sliding, wallRun (-1|0|1), boosting, landed, lookDx, lookDy}
    if (s.landed > 4 && !motion.reduced) landVel -= Math.min(0.6, s.landed * 0.04);
    landVel += (-landDip * 55 - landVel * 9) * dt;
    landDip += landVel * dt;

    if (!motion.reduced && s.grounded && s.speed > 0.8 && !s.sliding) {
      phase += dt * (6 + s.speed * 1.35);
      amp = Math.min(1, amp + dt * 5);
    } else {
      amp = Math.max(0, amp - dt * 4);
    }

    const swayTX = Math.max(-1, Math.min(1, -(s.lookDx || 0) * 0.05));
    const swayTY = Math.max(-1, Math.min(1, (s.lookDy || 0) * 0.05));
    swayX += (swayTX - swayX) * Math.min(1, dt * 7);
    swayY += (swayTY - swayY) * Math.min(1, dt * 7);

    const airLift = s.grounded ? 0 : 0.05;
    const boostBack = s.boosting ? 0.06 : 0;

    for (const [node, base, sideSign] of [[left, BASE.left, -1], [right, BASE.right, 1]]) {
      let tx = base.pos[0];
      let ty = base.pos[1];
      let tz = base.pos[2];
      let rx = base.rot[0];
      let ry = base.rot[1];
      let rz = base.rot[2];

      // Vung tay so le khi chạy
      const swing = Math.sin(phase + (sideSign > 0 ? 0 : Math.PI));
      ty += swing * 0.02 * amp;
      tz += Math.cos(phase + (sideSign > 0 ? 0 : Math.PI)) * 0.022 * amp;
      rx += swing * 0.1 * amp;

      // Bay: nâng hai tay lên xòe ra
      ty += airLift;
      rx -= airLift * 2.2;
      tx += sideSign * airLift * 0.5;

      // Boost: tay lùi ra sau (cảm giác tốc độ)
      tz += boostBack;
      ry += sideSign * boostBack * 1.4;

      // Trượt: hạ thấp, ngả ra hai bên
      if (s.sliding) {
        ty -= 0.09;
        tx += sideSign * 0.07;
        rx += 0.35;
        rz += sideSign * -0.3;
      }

      // Wall-run: tay phía tường vươn ra chống
      if (s.wallRun !== 0) {
        if (sideSign === s.wallRun) {
          tx += sideSign * 0.16;
          ty += 0.1;
          tz += 0.05;
          ry += sideSign * -0.7;
          rz += sideSign * 0.5;
        } else {
          tx += sideSign * -0.04;
          ty -= 0.02;
        }
      }

      // Sway theo chuột + land dip
      tx += swayX * 0.014;
      ty += swayY * 0.014 + landDip;

      node.pos[0] += (tx - node.pos[0]) * Math.min(1, dt * 9);
      node.pos[1] += (ty - node.pos[1]) * Math.min(1, dt * 9);
      node.pos[2] += (tz - node.pos[2]) * Math.min(1, dt * 9);
      node.rot[0] += (rx - node.rot[0]) * Math.min(1, dt * 9);
      node.rot[1] += (ry - node.rot[1]) * Math.min(1, dt * 9);
      node.rot[2] += (rz - node.rot[2]) * Math.min(1, dt * 9);
    }
  }

  return { viewmodel: root, update };
}

exports.createGloves = createGloves;
};
__defs["games/void-runner/fx.js"] = function (exports, __req) {
/**
 * fx.js — hiệu ứng tức thời của Void Runner (object pooling):
 *  - burst: hạt vuông tóe ra (nhặt shard, checkpoint, chết/respawn).
 *  - speed streaks: vạch gió lao ngược khi sprint/boost (cảm giác tốc độ).
 */

const { createNode, addChild, meshNode, hex } = __req("games/strike/engine.js");

const SPARK_POOL = 70;
const STREAK_POOL = 14;

function createVrFx(sceneRoot, motion = {}) {
  const root = createNode();
  addChild(sceneRoot, root);

  /* ---- Hạt tóe ---- */
  const sparks = [];
  for (let i = 0; i < SPARK_POOL; i++) {
    const n = meshNode("box", {
      color: hex("#b7f232"),
      emissive: 1,
      opacity: 0,
      additive: true,
      scale: [0.07, 0.07, 0.07],
    });
    n.visible = false;
    addChild(root, n);
    sparks.push({ node: n, vx: 0, vy: 0, vz: 0, t: 0, life: 0.42 });
  }
  let sparkIdx = 0;

  function burst(pos, color = "#b7f232", count = 10, power = 1) {
    const total = motion.reduced ? Math.ceil(count / 2) : count;
    for (let i = 0; i < total; i++) {
      const s = sparks[sparkIdx];
      sparkIdx = (sparkIdx + 1) % SPARK_POOL;
      const a = Math.random() * Math.PI * 2;
      const sp = (1.6 + Math.random() * 3) * power;
      s.node.pos[0] = pos[0];
      s.node.pos[1] = pos[1];
      s.node.pos[2] = pos[2];
      s.vx = Math.cos(a) * sp;
      s.vz = Math.sin(a) * sp;
      s.vy = 1.5 + Math.random() * 3 * power;
      s.node.mesh.color = hex(color);
      s.node.mesh.opacity = 0.95;
      s.node.visible = true;
      s.t = s.life * (0.6 + Math.random() * 0.4);
    }
  }

  /* ---- Vạch gió tốc độ ---- */
  const streaks = [];
  for (let i = 0; i < STREAK_POOL; i++) {
    const n = meshNode("box", {
      color: hex("#9fefff"),
      emissive: 1,
      opacity: 0,
      additive: true,
      scale: [0.02, 0.02, 1.6],
    });
    n.visible = false;
    addChild(root, n);
    streaks.push({ node: n, t: 0 });
  }
  let streakOn = 0;

  /** Bật vạch gió theo mức 0..1 (theo tốc độ). */
  function setWind(level) {
    streakOn = motion.reduced ? 0 : level;
  }

  function update(dt, cam) {
    for (const s of sparks) {
      if (s.t <= 0) continue;
      s.t -= dt;
      s.vy -= 10 * dt;
      s.node.pos[0] += s.vx * dt;
      s.node.pos[1] += s.vy * dt;
      s.node.pos[2] += s.vz * dt;
      s.node.rot[0] += dt * 6;
      s.node.rot[2] += dt * 5;
      s.node.mesh.opacity = Math.max(0, (s.t / s.life) * 0.95);
      if (s.t <= 0) s.node.visible = false;
    }

    if (!cam) return;
    for (let i = 0; i < streaks.length; i++) {
      const st = streaks[i];
      const want = streakOn > 0.05 && i / streaks.length < streakOn;
      if (!want) {
        if (st.node.visible) {
          st.node.visible = false;
          st.t = 0;
        }
        continue;
      }
      st.t -= dt;
      if (st.t <= 0) {
        // Sinh lại vạch phía trước camera, lệch ngẫu nhiên quanh trục nhìn
        st.t = 0.24 + Math.random() * 0.28;
        const dx = -Math.sin(cam.yaw);
        const dz = -Math.cos(cam.yaw);
        const rx = Math.cos(cam.yaw);
        const rz = -Math.sin(cam.yaw);
        const off = (Math.random() - 0.5) * 7;
        const up = (Math.random() - 0.5) * 4;
        st.node.pos[0] = cam.pos[0] + dx * 13 + rx * off;
        st.node.pos[1] = cam.pos[1] + up;
        st.node.pos[2] = cam.pos[2] + dz * 13 + rz * off;
        st.node.rot[1] = cam.yaw;
        st.node.scale[2] = 1.2 + Math.random() * 2.2;
        st.node.visible = true;
      }
      // Lao ngược về phía camera
      st.node.pos[0] += Math.sin(cam.yaw) * 26 * dt;
      st.node.pos[2] += Math.cos(cam.yaw) * 26 * dt;
      st.node.mesh.opacity = Math.min(0.5, st.t * 1.6) * streakOn;
    }
  }

  return { burst, setWind, update };
}

exports.createVrFx = createVrFx;
};
__defs["games/void-runner/hud.js"] = function (exports, __req) {
/**
 * hud.js — HUD gameplay đúng bố cục ảnh reference:
 *  - Trên-giữa: "VOID RUNNER 404" + đồng hồ mm:ss.mmm + CHECKPOINT k/8.
 *  - Trên-trái: 3 panel TỐC ĐỘ (đỏ) / NĂNG LƯỢNG (cyan, thanh ô) /
 *    COMBO (magenta, thanh ô).
 *  - Trên-phải: TẠM DỪNG / ÂM THANH / ĐỔI GAME / TRANG CHỦ.
 *  - Toast giữa màn (SLIDE! / WALL RUN! / CHECKPOINT), penalty đỏ,
 *    vignette sát thương, màn đen respawn.
 */

const { el, svgIcon } = __req("core/utils.js");

const NS = "http://www.w3.org/2000/svg";

function inlineIcon(cls, pathData, extra = null) {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", cls);
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const p = document.createElementNS(NS, "path");
  for (const [k, v] of Object.entries(pathData)) p.setAttribute(k, v);
  svg.appendChild(p);
  if (extra) {
    const p2 = document.createElementNS(NS, "path");
    for (const [k, v] of Object.entries(extra)) p2.setAttribute(k, v);
    svg.appendChild(p2);
  }
  return svg;
}

const gaugeIcon = () =>
  inlineIcon("icon", {
    d: "M12 4a9 9 0 0 0-9 9c0 2.6 1.1 5 2.9 6.6l1.4-1.5A7 7 0 1 1 19 13c0 1.9-.8 3.7-2.2 5l1.4 1.5A9 9 0 0 0 12 4z",
    fill: "currentColor",
  }, {
    d: "M12 14.8 15.6 8l-5.1 5.2a1.8 1.8 0 1 0 1.5 1.6z",
    fill: "currentColor",
  });

const boltIcon = () =>
  inlineIcon("icon", { d: "M13 2 4.5 13.5H11L9.6 22l8.9-11.5H12L13 2z", fill: "currentColor" });

const comboIcon = () =>
  inlineIcon("icon", { d: "M12 2l2.6 6.9L21 10l-5.2 4.4L17.5 21 12 17.2 6.5 21l1.7-6.6L3 10l6.4-1.1L12 2z", fill: "currentColor" });

function formatRunTime(seconds) {
  const s = Math.max(0, seconds);
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(Math.floor(s % 60)).padStart(2, "0");
  const ms = String(Math.floor((s % 1) * 1000)).padStart(3, "0");
  return `${mm}:${ss}.${ms}`;
}

function createVrHud(rootEl, { onPause, onToggleSound, soundOn, onSwitch, onHome }) {
  const hud = el("div", "vr-hud");
  hud.hidden = true;

  /* ---- Trên giữa: tiêu đề + timer + checkpoint ---- */
  const top = el("div", "vr-top");
  top.appendChild(el("div", "vr-title", "VOID RUNNER 404"));
  const timeEl = el("div", "vr-time", "00:00.000");
  top.appendChild(timeEl);
  const cpRow = el("div", "vr-cp");
  const cpL = el("span", "d", "◆");
  const cpText = el("span", "t", "CHECKPOINT 0/8");
  const cpR = el("span", "d", "◆");
  cpRow.append(cpL, cpText, cpR);
  top.appendChild(cpRow);
  const penaltyEl = el("div", "vr-penalty", "+3s");
  top.appendChild(penaltyEl);

  /* ---- Trên trái: 3 panel chỉ số ---- */
  const tl = el("div", "vr-tl");

  const panel = (cls, labelText, icon) => {
    const p = el("div", `vr-panel ${cls}`);
    const head = el("div", "head");
    head.appendChild(el("span", "lbl", labelText));
    head.appendChild(icon);
    p.appendChild(head);
    return p;
  };

  // TỐC ĐỘ
  const speedPanel = panel("speed", "TỐC ĐỘ", gaugeIcon());
  const speedRow = el("div", "big");
  const speedVal = el("span", "val", "0.0");
  speedRow.append(speedVal, el("span", "unit", "m/s"));
  speedPanel.appendChild(speedRow);
  tl.appendChild(speedPanel);

  // NĂNG LƯỢNG
  const energyPanel = panel("energy", "NĂNG LƯỢNG", boltIcon());
  const energyRow = el("div", "big");
  const energyVal = el("span", "val", "100");
  energyRow.append(energyVal, el("span", "unit", "%"));
  energyPanel.appendChild(energyRow);
  const energySegs = el("div", "segs");
  const energySegEls = [];
  for (let i = 0; i < 10; i++) {
    const s = el("i");
    energySegs.appendChild(s);
    energySegEls.push(s);
  }
  energyPanel.appendChild(energySegs);
  tl.appendChild(energyPanel);

  // COMBO
  const comboPanel = panel("combo", "COMBO", comboIcon());
  const comboRow = el("div", "big");
  const comboVal = el("span", "val", "x0");
  comboRow.append(comboVal);
  comboPanel.appendChild(comboRow);
  const comboSegs = el("div", "segs");
  const comboSegEls = [];
  for (let i = 0; i < 8; i++) {
    const s = el("i");
    comboSegs.appendChild(s);
    comboSegEls.push(s);
  }
  comboPanel.appendChild(comboSegs);
  tl.appendChild(comboPanel);

  /* ---- Trên phải: 4 nút ---- */
  const tr = el("div", "vr-tr");
  const mkBtn = (iconId, label, fn) => {
    const b = el("button", "vr-btn clickable");
    b.type = "button";
    b.appendChild(svgIcon(iconId));
    b.appendChild(el("span", "", label));
    b.addEventListener("click", (e) => {
      if (e.detail > 0) b.blur();
      fn();
    });
    tr.appendChild(b);
    return b;
  };
  mkBtn("i-pause", "TẠM DỪNG", onPause);
  const soundBtn = mkBtn(soundOn() ? "i-sound-on" : "i-sound-off", "ÂM THANH", () => {
    onToggleSound();
    soundBtn.querySelector("use")?.setAttribute("href", soundOn() ? "#i-sound-on" : "#i-sound-off");
  });
  mkBtn("i-gamepad", "ĐỔI GAME", onSwitch);
  mkBtn("i-home", "TRANG CHỦ", onHome);

  /* ---- Hiệu ứng toàn màn ---- */
  const vignette = el("div", "vr-vignette");
  const blackout = el("div", "vr-blackout");
  const toasts = el("div", "vr-toasts");

  hud.append(vignette, blackout, top, tl, tr, toasts);
  rootEl.appendChild(hud);

  let vignetteT = null;
  let penaltyT = null;
  let blackoutT = null;
  let lastCombo = 0;

  return {
    el: hud,

    show(on) { hud.hidden = !on; },
    dim(on) { hud.classList.toggle("dim", on); },

    setTime(seconds) { timeEl.textContent = formatRunTime(seconds); },

    setCheckpoint(k, total) {
      cpText.textContent = `CHECKPOINT ${k}/${total}`;
    },

    setSpeed(v) {
      speedVal.textContent = v.toFixed(1);
      speedPanel.classList.toggle("hot", v > 13);
    },

    setEnergy(pct) {
      const p = Math.max(0, Math.min(100, Math.round(pct)));
      energyVal.textContent = String(p);
      const filled = Math.round((p / 100) * 10);
      energySegEls.forEach((s, i) => { s.className = i < filled ? "on" : ""; });
      energyPanel.classList.toggle("low", p < 25);
    },

    setCombo(n) {
      comboVal.textContent = `x${n}`;
      comboSegEls.forEach((s, i) => { s.className = i < Math.min(8, n) ? "on" : ""; });
      if (n > lastCombo) {
        comboPanel.classList.remove("pop");
        void comboPanel.offsetWidth;
        comboPanel.classList.add("pop");
      }
      lastCombo = n;
    },

    penalty(sec) {
      penaltyEl.textContent = `+${sec}s`;
      penaltyEl.classList.remove("show");
      void penaltyEl.offsetWidth;
      penaltyEl.classList.add("show");
      clearTimeout(penaltyT);
      penaltyT = setTimeout(() => penaltyEl.classList.remove("show"), 1400);
    },

    toast(text, tone = "cyan") {
      const t = el("div", `vr-toast ${tone}`, text);
      toasts.appendChild(t);
      setTimeout(() => t.remove(), 1500);
    },

    damageFlash() {
      vignette.style.opacity = "1";
      clearTimeout(vignetteT);
      vignetteT = setTimeout(() => { vignette.style.opacity = "0"; }, 200);
    },

    /** Màn đen nhanh khi respawn; callback giữa lúc tối nhất. */
    respawnFade(mid) {
      blackout.classList.add("on");
      clearTimeout(blackoutT);
      blackoutT = setTimeout(() => {
        mid?.();
        blackout.classList.remove("on");
      }, 240);
    },

    syncSound() {
      soundBtn.querySelector("use")?.setAttribute("href", soundOn() ? "#i-sound-on" : "#i-sound-off");
    },

    destroy() {
      clearTimeout(vignetteT);
      clearTimeout(penaltyT);
      clearTimeout(blackoutT);
      hud.remove();
    },
  };
}

exports.formatRunTime = formatRunTime; exports.createVrHud = createVrHud;
};
__defs["games/void-runner/screens.js"] = function (exports, __req) {
/**
 * screens.js — các màn hình VOID RUNNER 404 theo ảnh reference:
 *  - Start: nút back + chip 404 ARCADE, logo VOID RUNNER 404 nghiêng,
 *    tagline, hàng ĐỘ KHÓ / CHẤT LƯỢNG (bấm để đổi), nút BẮT ĐẦU CHẠY,
 *    ĐỔI GAME / VỀ TRANG CHỦ + panel ĐIỀU KHIỂN bên phải.
 *  - Pause: panel TẠM DỪNG — trái: TIẾP TỤC / CHƠI LẠI TỪ CHECKPOINT /
 *    CHƠI LẠI / ĐỔI GAME / VỀ TRANG CHỦ; phải: CÀI ĐẶT (âm lượng tổng,
 *    độ nhạy chuột, FOV, chất lượng LOW-MEDIUM-HIGH, rung màn hình,
 *    giảm chuyển động) + mẹo ESC.
 *  - Results: thời gian + best + KỶ LỤC MỚI + thẻ chỉ số + điểm.
 *  - Notice: tối ưu desktop / WebGL không khả dụng.
 */

const { el, svgIcon, formatNumber } = __req("core/utils.js");
const { formatRunTime } = __req("games/void-runner/hud.js");

const NS = "http://www.w3.org/2000/svg";

const DIFF_LABEL = { easy: "Dễ", normal: "Thường", hard: "Khó" };
const DIFF_ORDER = ["easy", "normal", "hard"];
const QUALITY_LABEL = { auto: "Tự động", low: "Thấp", medium: "Trung bình", high: "Cao" };
const QUALITY_ORDER = ["auto", "low", "medium", "high"];

function icon(name, cls = "icon") {
  const paths = {
    runner: ["M13.5 3.2a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8zM9.4 8.9 12.6 7c.9-.5 2-.2 2.5.7l1.5 2.6 3 1.2-.7 1.8-3.7-1.5-1.2-2-2 3.4 2.9 2.5-.9 5.4-2-.3.7-4.3-3-2.4-2.3 3.7-1.7-1 3.1-5.2-1.2.7-1.3 2.3-1.8.9 1.2-1.3z"],
    monitor: ["M3 4h18a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-7v2h3v2H7v-2h3v-2H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm1 2v9h16V6H4z"],
    fov: ["M12 5 4 19h16L12 5zm0 4.1 4.5 7.9h-9L12 9.1zM2 12l3-2v4l-3-2zm20 0-3-2v4l3-2z"],
    vibrate: ["M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm0 2v14h8V5H8zM2 8l2 2-2 2 2 2-2 2V8zm20 0v10l-2-2 2-2-2-2 2-2z"],
    motion: ["M3 7h10v2H3V7zm0 4h14v2H3v-2zm0 4h8v2H3v-2zm16.5-7.5 2.5 4.5-2.5 4.5-1.7-1 1.9-3.5-1.9-3.5 1.7-1z"],
    diamond: ["M12 3l7 9-7 9-7-9 7-9z"],
    back: ["M15 4l-8 8 8 8 1.5-1.5L10 12l6.5-6.5L15 4z"],
    clock: ["M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16zm-1 3h2v5.6l4 2.3-1 1.7-5-2.9V7z"],
    bolt: ["M13 2 4.5 13.5H11L9.6 22l8.9-11.5H12L13 2z"],
    star: ["M12 2l2.6 6.9L21 10l-5.2 4.4L17.5 21 12 17.2 6.5 21l1.7-6.6L3 10l6.4-1.1L12 2z"],
    fall: ["M12 3v12.2l4.4-4.4 1.4 1.4L12 19l-5.8-6.8 1.4-1.4 4.4 4.4V3h0zM5 21h14v-2H5v2z"],
    gauge: ["M12 4a9 9 0 0 0-9 9c0 2.6 1.1 5 2.9 6.6l1.4-1.5A7 7 0 1 1 19 13c0 1.9-.8 3.7-2.2 5l1.4 1.5A9 9 0 0 0 12 4zm0 10.8L15.6 8l-5.1 5.2a1.8 1.8 0 1 0 1.5 1.6z"],
  };
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", cls);
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  for (const d of paths[name] || []) {
    const p = document.createElementNS(NS, "path");
    p.setAttribute("d", d);
    p.setAttribute("fill", "currentColor");
    svg.appendChild(p);
  }
  return svg;
}

function createVrScreens(rootEl, { settings, actions, getBestTime }) {
  const layer = el("div");
  rootEl.appendChild(layer);
  let currentScreen = null;

  function clear() {
    layer.textContent = "";
    currentScreen = null;
  }

  function screen(name) {
    clear();
    const s = el("div", "vr-screen");
    s.dataset.screen = name;
    layer.appendChild(s);
    currentScreen = name;
    return s;
  }

  function actionBtn(label, iconId, fn, cls = "") {
    const b = el("button", `vr-abtn${cls ? ` ${cls}` : ""}`, label);
    b.type = "button";
    if (iconId) b.prepend(svgIcon(iconId));
    b.addEventListener("click", (e) => {
      if (e.detail > 0) b.blur();
      fn();
    });
    return b;
  }

  /* ------------------------- START ------------------------- */

  function showStart() {
    const s = screen("start");

    // Góc trái trên: back + chip 404 ARCADE (như ảnh)
    const corner = el("div", "vr-corner");
    const back = el("button", "vr-back");
    back.type = "button";
    back.setAttribute("aria-label", "Về danh sách game");
    back.appendChild(icon("back"));
    back.addEventListener("click", () => actions.switchGame());
    const chip = el("div", "vr-brand");
    chip.appendChild(el("b", "", "404"));
    chip.appendChild(el("span", "", "ARCADE"));
    corner.append(back, chip);
    s.appendChild(corner);

    const grid = el("div", "vr-start");

    /* Cột trái */
    const left = el("div", "vr-start-left");

    const logo = el("div", "vr-logo");
    logo.appendChild(el("div", "l1", "VOID"));
    logo.appendChild(el("div", "l2", "RUNNER"));
    const l3 = el("div", "l3");
    l3.appendChild(el("span", "", "404"));
    logo.appendChild(l3);
    left.appendChild(logo);

    const tag = el("p", "vr-tagline");
    tag.appendChild(document.createTextNode("Chạy qua khoảng không."));
    tag.appendChild(document.createElement("br"));
    tag.appendChild(document.createTextNode("Phá kỷ lục của chính bạn."));
    left.appendChild(tag);

    const bt = getBestTime();
    if (bt > 0) {
      const best = el("div", "vr-best-chip");
      best.appendChild(icon("clock"));
      best.appendChild(el("span", "", `KỶ LỤC: ${formatRunTime(bt / 1000)}`));
      left.appendChild(best);
    }

    // Hàng ĐỘ KHÓ / CHẤT LƯỢNG — bấm để đổi vòng (chevron như ảnh)
    const rows = el("div", "vr-opt-rows");
    const mkRow = (iconName, label, getVal, cycle) => {
      const r = el("button", "vr-opt-row");
      r.type = "button";
      const lb = el("span", "lb");
      lb.appendChild(icon(iconName));
      lb.appendChild(el("span", "", label));
      const val = el("span", "val", getVal());
      const chev = el("span", "chev", "❯");
      r.append(lb, val, chev);
      r.addEventListener("click", () => {
        cycle();
        val.textContent = getVal();
      });
      rows.appendChild(r);
    };
    mkRow("bolt", "ĐỘ KHÓ", () => DIFF_LABEL[settings.difficulty], () => {
      const i = DIFF_ORDER.indexOf(settings.difficulty);
      settings.difficulty = DIFF_ORDER[(i + 1) % DIFF_ORDER.length];
      actions.applySettings({ difficulty: settings.difficulty });
    });
    mkRow("clock", "CHẤT LƯỢNG", () => QUALITY_LABEL[settings.quality], () => {
      const i = QUALITY_ORDER.indexOf(settings.quality);
      settings.quality = QUALITY_ORDER[(i + 1) % QUALITY_ORDER.length];
      actions.applySettings({ quality: settings.quality });
    });
    left.appendChild(rows);

    // CTA BẮT ĐẦU CHẠY
    const cta = el("button", "vr-cta");
    cta.type = "button";
    const ctaIn = el("span", "in");
    ctaIn.appendChild(icon("runner"));
    ctaIn.appendChild(el("span", "", "BẮT ĐẦU CHẠY"));
    cta.appendChild(ctaIn);
    cta.addEventListener("click", () => actions.enterRun());
    left.appendChild(cta);

    const acts = el("div", "vr-start-actions");
    acts.appendChild(actionBtn("ĐỔI GAME", "i-gamepad", actions.switchGame));
    acts.appendChild(actionBtn("VỀ TRANG CHỦ", "i-home", actions.goHome));
    left.appendChild(acts);

    /* Cột phải: panel điều khiển (đúng danh sách trong ảnh) */
    const panel = el("aside", "vr-ctl");
    panel.appendChild(el("h3", "", "ĐIỀU KHIỂN"));
    const ctlRows = [
      { keys: ["W", "A", "S", "D"], desc: "Di chuyển" },
      { mouse: true, kbd: "Chuột", desc: "Quan sát" },
      { keys: ["Space"], desc: "Nhảy" },
      { keys: ["Shift"], desc: "Chạy nhanh" },
      { keys: ["Ctrl"], desc: "Trượt" },
      { keys: ["Q"], desc: "Wall-run" },
      { keys: ["Esc"], desc: "Tạm dừng" },
    ];
    for (const row of ctlRows) {
      const r = el("div", "row");
      const keys = el("div", "keys");
      if (row.mouse) {
        keys.appendChild(svgIcon("i-mouse", "icon mouse"));
        keys.appendChild(el("b", "", row.kbd));
      } else {
        for (const k of row.keys) keys.appendChild(el("kbd", "", k));
      }
      r.append(keys, el("span", "desc", row.desc));
      panel.appendChild(r);
    }

    grid.append(left, panel);
    s.appendChild(grid);
    requestAnimationFrame(() => cta.focus());
  }

  /* ------------------------- PAUSE ------------------------- */

  function sliderRow(labelText, ic, min, max, step, value, fmt, onInput) {
    const set = el("div", "vr-set");
    const lbl = el("div", "lbl");
    lbl.appendChild(ic);
    lbl.appendChild(el("span", "", labelText));
    set.appendChild(lbl);
    const row = el("div", "vr-slider-row");
    const range = document.createElement("input");
    range.type = "range";
    range.className = "vr-range";
    range.min = String(min);
    range.max = String(max);
    range.step = String(step);
    range.value = String(value);
    range.setAttribute("aria-label", labelText);
    const val = el("span", "val", fmt(value));
    const paint = () => {
      const pct = ((Number(range.value) - min) / (max - min)) * 100;
      range.style.setProperty("--fill", `${pct}%`);
      val.textContent = fmt(Number(range.value));
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

  function toggleRow(labelText, ic, get, set2) {
    const setEl = el("div", "vr-set toggle");
    const lbl = el("div", "lbl");
    lbl.appendChild(ic);
    lbl.appendChild(el("span", "", labelText));
    setEl.appendChild(lbl);
    const sw = el("button", `vr-switch${get() ? " on" : ""}`);
    sw.type = "button";
    sw.setAttribute("role", "switch");
    sw.setAttribute("aria-checked", get() ? "true" : "false");
    sw.setAttribute("aria-label", labelText);
    sw.appendChild(el("span", "track"));
    sw.addEventListener("click", () => {
      set2(!get());
      sw.classList.toggle("on", get());
      sw.setAttribute("aria-checked", get() ? "true" : "false");
    });
    setEl.appendChild(sw);
    return setEl;
  }

  function showPause() {
    const s = screen("pause");
    const panel = el("div", "vr-pause");

    panel.appendChild(el("h2", "vr-pause-title", "TẠM DỪNG"));
    const cols = el("div", "vr-pause-cols");

    /* Cột trái: menu */
    const menu = el("div", "vr-menu");
    const mkBtn = (label, ic, fn, cls = "", extraNode = null) => {
      const b = el("button", `vr-menu-btn${cls ? ` ${cls}` : ""}`);
      b.type = "button";
      b.appendChild(ic);
      const sp = el("span", "", label);
      b.appendChild(sp);
      if (extraNode) b.appendChild(extraNode);
      b.addEventListener("click", fn);
      menu.appendChild(b);
      return b;
    };
    const resumeBtn = mkBtn("TIẾP TỤC", svgIcon("i-play"), actions.resume, "primary");
    mkBtn("CHƠI LẠI TỪ CHECKPOINT", svgIcon("i-restart"), actions.restartCheckpoint, "", icon("diamond", "icon dmd"));
    mkBtn("CHƠI LẠI", svgIcon("i-restart"), actions.restart);
    mkBtn("ĐỔI GAME", svgIcon("i-gamepad"), actions.switchGame);
    mkBtn("VỀ TRANG CHỦ", svgIcon("i-home"), actions.goHome);

    /* Cột phải: cài đặt */
    const st = el("div", "vr-settings");
    st.appendChild(el("h3", "", "CÀI ĐẶT"));

    st.appendChild(sliderRow("ÂM LƯỢNG TỔNG", svgIcon("i-sound-on"), 0, 100, 5, settings.volume,
      (v) => `${v}%`,
      (v) => { settings.volume = v; actions.applySettings({ volume: v }); }));

    st.appendChild(sliderRow("ĐỘ NHẠY CHUỘT", svgIcon("i-mouse", "icon"), 0.25, 3, 0.05, settings.sensitivity,
      (v) => v.toFixed(2),
      (v) => { settings.sensitivity = v; actions.applySettings({ sensitivity: v }); }));

    st.appendChild(sliderRow("FIELD OF VIEW (FOV)", icon("fov"), 75, 105, 1, settings.fov,
      (v) => `${v}°`,
      (v) => { settings.fov = v; actions.applySettings({ fov: v }); }));

    // Chất lượng LOW / MEDIUM / HIGH (như ảnh)
    const qSet = el("div", "vr-set");
    const qLbl = el("div", "lbl");
    qLbl.appendChild(icon("monitor"));
    qLbl.appendChild(el("span", "", "CHẤT LƯỢNG ĐỒ HỌA"));
    qSet.appendChild(qLbl);
    const qSeg = el("div", "vr-seg");
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
    st.appendChild(qSet);

    st.appendChild(toggleRow("RUNG MÀN HÌNH", icon("vibrate"),
      () => settings.shake,
      (v) => { settings.shake = v; actions.applySettings({ shake: v }); }));

    st.appendChild(toggleRow("GIẢM CHUYỂN ĐỘNG", icon("motion"),
      () => settings.reduceMotion,
      (v) => { settings.reduceMotion = v; actions.applySettings({ reduceMotion: v }); }));

    cols.append(menu, st);
    panel.appendChild(cols);

    const tip = el("div", "vr-tip");
    tip.appendChild(el("span", "", "MẸO: Bạn có thể truy cập cài đặt nhanh trong lúc chơi bằng phím "));
    tip.appendChild(el("kbd", "", "ESC"));
    panel.appendChild(tip);

    s.appendChild(panel);
    requestAnimationFrame(() => resumeBtn.focus());
  }

  /* ------------------------- RESULTS ------------------------- */

  function showResults(r) {
    // r: {timeMs, bestMs, newBestTime, score, saved, shards, shardTotal,
    //     maxCombo, falls, maxSpeed}
    const s = screen("over");
    const panel = el("div", "vr-over");

    panel.appendChild(el("div", "vr-over-head", "HOÀN THÀNH ĐƯỜNG CHẠY"));

    const timeBox = el("div", "vr-final-time");
    timeBox.appendChild(el("div", "lbl", "THỜI GIAN"));
    timeBox.appendChild(el("div", "num", formatRunTime(r.timeMs / 1000)));
    if (r.newBestTime) timeBox.appendChild(el("span", "vr-record", "KỶ LỤC MỚI"));
    panel.appendChild(timeBox);

    const bestLine = el("div", "vr-best-line");
    bestLine.appendChild(icon("clock"));
    bestLine.appendChild(el("span", "", `TỐT NHẤT: ${formatRunTime(r.bestMs / 1000)}`));
    panel.appendChild(bestLine);

    const grid = el("div", "vr-statgrid");
    const statCard = (ic, label, value, cls = "") => {
      const c = el("div", `vr-statcard${cls ? ` ${cls}` : ""}`);
      c.appendChild(ic);
      c.appendChild(el("div", "lbl", label));
      c.appendChild(el("div", "val", value));
      return c;
    };
    grid.appendChild(statCard(icon("bolt"), "NĂNG LƯỢNG", `${r.shards}/${r.shardTotal}`, "lime"));
    grid.appendChild(statCard(icon("star"), "COMBO TỐI ĐA", `x${r.maxCombo}`, "magenta"));
    grid.appendChild(statCard(icon("fall"), "SỐ LẦN RƠI", String(r.falls), "red"));
    grid.appendChild(statCard(icon("gauge"), "TỐC ĐỘ TỐI ĐA", `${r.maxSpeed.toFixed(1)} m/s`, "cyan"));
    panel.appendChild(grid);

    const scoreLine = el("div", "vr-score-line");
    scoreLine.appendChild(el("span", "lbl", "ĐIỂM"));
    scoreLine.appendChild(el("span", "num", formatNumber(r.score)));
    if (r.saved.isRecord) scoreLine.appendChild(el("span", "vr-record small", "KỶ LỤC ĐIỂM"));
    panel.appendChild(scoreLine);

    const acts = el("div", "vr-over-actions");
    acts.appendChild(actionBtn("CHẠY LẠI", "i-restart", actions.restart, "gold"));
    acts.appendChild(actionBtn("ĐỔI GAME", "i-gamepad", actions.switchGame));
    acts.appendChild(actionBtn("VỀ TRANG CHỦ", "i-home", actions.goHome));
    panel.appendChild(acts);

    s.appendChild(panel);
    requestAnimationFrame(() => acts.querySelector("button")?.focus());
  }

  /* ------------------------- NOTICE ------------------------- */

  function showNotice(kind) {
    const s = screen("notice");
    const box = el("div", "vr-notice");
    box.appendChild(svgIcon(kind === "webgl" ? "i-close" : "i-gamepad"));
    box.appendChild(el("h3", "", kind === "webgl" ? "WEBGL KHÔNG KHẢ DỤNG" : "TỐI ƯU CHO MÁY TÍNH"));
    box.appendChild(el("p", "",
      kind === "webgl"
        ? "Trình duyệt của bạn không hỗ trợ WebGL nên không thể chạy Void Runner 404. Các game 2D vẫn chơi tốt!"
        : "Void Runner 404 cần bàn phím và chuột (WASD + mouse look). Hãy mở trên máy tính, hoặc thử các game 2D nhé!"));
    const row = el("div", "btn-row");
    row.appendChild(actionBtn("ĐỔI GAME", "i-gamepad", actions.switchGame));
    row.appendChild(actionBtn("VỀ TRANG CHỦ", "i-home", actions.goHome));
    box.appendChild(row);
    s.appendChild(box);
  }

  return {
    showStart,
    showPause,
    showResults,
    showNotice,
    hideAll: clear,
    get current() { return currentScreen; },
    destroy() { layer.remove(); },
  };
}

exports.createVrScreens = createVrScreens;
};
__defs["games/void-runner/styles.js"] = function (exports, __req) {
/**
 * styles.js — CSS của VOID RUNNER 404 (inject vào shadow root khi mount).
 * Bám theo ảnh reference: HUD 3 panel trái + timer giữa + 4 nút phải,
 * start screen logo nghiêng + panel điều khiển, pause 2 cột + cài đặt.
 */

const VOID_RUNNER_CSS = /* css */ `
.vr-root {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: #120c2a;
  font-family: var(--font-mono);
  user-select: none;
  -webkit-user-select: none;
  --vr-cyan: #22e4ff;
  --vr-magenta: #e42cff;
  --vr-pink: #ff3fd4;
  --vr-lime: #b7f232;
  --vr-red: #ff2e4d;
  --vr-violet: #8b5bff;
}

.vr-root canvas.vr-canvas {
  position: absolute;
  inset: 0;
  touch-action: none;
}

/* ============================ HUD ============================ */

.vr-hud {
  position: absolute;
  inset: 0;
  z-index: 10;
  pointer-events: none;
  transition: opacity 0.25s ease;
}

.vr-hud.dim { opacity: 0.28; }
.vr-hud .clickable { pointer-events: auto; }

/* --- Trên giữa: tiêu đề + timer + checkpoint --- */
.vr-top {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
  min-width: 300px;
}

.vr-title {
  font-size: 1.28rem;
  font-weight: 800;
  font-style: italic;
  letter-spacing: 0.14em;
  color: #fff;
  text-shadow:
    0 0 14px color-mix(in srgb, var(--vr-violet) 85%, transparent),
    0 0 34px color-mix(in srgb, var(--vr-magenta) 45%, transparent);
}

.vr-time {
  margin-top: 2px;
  font-size: 1.72rem;
  font-weight: 800;
  line-height: 1.05;
  color: #fff;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 0 16px color-mix(in srgb, var(--vr-cyan) 55%, transparent);
}

.vr-cp {
  margin-top: 3px;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--vr-lime);
  font-size: 0.74rem;
  font-weight: 800;
  letter-spacing: 0.22em;
}

.vr-cp .d { font-size: 0.6rem; }
.vr-cp .t::before, .vr-cp .t::after { content: "  —  "; opacity: 0.6; }

.vr-penalty {
  position: absolute;
  top: 34px;
  left: calc(100% + 12px);
  color: var(--vr-red);
  font-weight: 800;
  font-size: 1.1rem;
  opacity: 0;
  text-shadow: 0 0 12px color-mix(in srgb, var(--vr-red) 70%, transparent);
}

.vr-penalty.show { animation: vrPenalty 1.4s ease; }

@keyframes vrPenalty {
  0% { opacity: 0; transform: translateY(6px); }
  15% { opacity: 1; transform: none; }
  70% { opacity: 1; }
  100% { opacity: 0; transform: translateY(-8px); }
}

/* --- Trên trái: 3 panel chỉ số --- */
.vr-tl {
  position: absolute;
  top: 12px;
  left: 12px;
  display: flex;
  flex-direction: column;
  gap: 9px;
  width: 148px;
}

.vr-panel {
  border: 1px solid;
  border-radius: 6px;
  background: color-mix(in srgb, #060a1c 82%, transparent);
  padding: 7px 10px 8px;
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
}

.vr-panel .head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.vr-panel .lbl {
  font-size: 0.6rem;
  font-weight: 800;
  letter-spacing: 0.18em;
}

.vr-panel .head .icon { width: 15px; height: 15px; flex: none; }

.vr-panel .big {
  display: flex;
  align-items: baseline;
  gap: 5px;
  margin-top: 2px;
}

.vr-panel .big .val {
  font-size: 1.5rem;
  font-weight: 800;
  color: #fff;
  line-height: 1.05;
  font-variant-numeric: tabular-nums;
}

.vr-panel .big .unit { font-size: 0.72rem; color: var(--text-1); font-weight: 700; }

.vr-panel .segs { display: flex; gap: 3px; margin-top: 6px; }

.vr-panel .segs i {
  flex: 1;
  height: 7px;
  background: color-mix(in srgb, #fff 12%, transparent);
  border-radius: 1px;
}

.vr-panel.speed { border-color: color-mix(in srgb, var(--vr-red) 65%, transparent); box-shadow: 0 0 14px color-mix(in srgb, var(--vr-red) 12%, transparent); }
.vr-panel.speed .lbl, .vr-panel.speed .head .icon { color: var(--vr-red); }
.vr-panel.speed.hot .big .val { color: #ffd7de; text-shadow: 0 0 12px var(--vr-red); }

.vr-panel.energy { border-color: color-mix(in srgb, var(--vr-cyan) 60%, transparent); box-shadow: 0 0 14px color-mix(in srgb, var(--vr-cyan) 12%, transparent); }
.vr-panel.energy .lbl, .vr-panel.energy .head .icon { color: var(--vr-cyan); }
.vr-panel.energy .segs i.on { background: var(--vr-cyan); box-shadow: 0 0 7px color-mix(in srgb, var(--vr-cyan) 65%, transparent); }
.vr-panel.energy.low .big .val { color: var(--vr-red); animation: vrBlink 0.6s steps(1) infinite; }

.vr-panel.combo { border-color: color-mix(in srgb, var(--vr-magenta) 62%, transparent); box-shadow: 0 0 14px color-mix(in srgb, var(--vr-magenta) 12%, transparent); }
.vr-panel.combo .lbl, .vr-panel.combo .head .icon { color: var(--vr-pink); }
.vr-panel.combo .big .val { color: var(--vr-pink); text-shadow: 0 0 12px color-mix(in srgb, var(--vr-magenta) 60%, transparent); }
.vr-panel.combo .segs i.on { background: var(--vr-pink); box-shadow: 0 0 7px color-mix(in srgb, var(--vr-magenta) 65%, transparent); }
.vr-panel.combo.pop { animation: vrPop 0.28s ease; }

@keyframes vrPop { 40% { transform: scale(1.06); } }
@keyframes vrBlink { 50% { opacity: 0.45; } }

/* --- Trên phải: 4 nút --- */
.vr-tr {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.vr-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 136px;
  min-height: 36px;
  padding: 7px 14px;
  border: 1px solid color-mix(in srgb, #fff 32%, transparent);
  border-radius: 6px;
  background: color-mix(in srgb, #060a1c 80%, transparent);
  color: #e8ecf8;
  font-family: inherit;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  cursor: pointer;
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  transition: border-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
}

.vr-btn:hover {
  border-color: var(--vr-cyan);
  color: #fff;
  box-shadow: 0 0 14px color-mix(in srgb, var(--vr-cyan) 25%, transparent);
}

.vr-btn .icon { width: 15px; height: 15px; flex: none; }

/* --- Toast / hiệu ứng --- */
.vr-toasts {
  position: absolute;
  top: 32%;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  pointer-events: none;
}

.vr-toast {
  padding: 5px 18px;
  border: 1px solid;
  border-radius: 4px;
  background: color-mix(in srgb, #060a1c 80%, transparent);
  font-size: 0.86rem;
  font-weight: 800;
  letter-spacing: 0.22em;
  animation: vrToast 1.5s ease forwards;
}

.vr-toast.cyan { color: var(--vr-cyan); border-color: color-mix(in srgb, var(--vr-cyan) 60%, transparent); }
.vr-toast.lime { color: var(--vr-lime); border-color: color-mix(in srgb, var(--vr-lime) 60%, transparent); }
.vr-toast.magenta { color: var(--vr-pink); border-color: color-mix(in srgb, var(--vr-magenta) 60%, transparent); }
.vr-toast.red { color: var(--vr-red); border-color: color-mix(in srgb, var(--vr-red) 60%, transparent); }
.vr-toast.gold { color: var(--gold, #ffd23f); border-color: color-mix(in srgb, #ffd23f 60%, transparent); }

@keyframes vrToast {
  0% { opacity: 0; transform: translateY(10px) scale(0.94); }
  14% { opacity: 1; transform: none; }
  72% { opacity: 1; }
  100% { opacity: 0; transform: translateY(-12px); }
}

.vr-vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(ellipse at center, transparent 48%, color-mix(in srgb, var(--vr-red) 62%, transparent) 128%);
  opacity: 0;
  transition: opacity 0.14s ease;
}

.vr-blackout {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: #05030f;
  opacity: 0;
  transition: opacity 0.22s ease;
}

.vr-blackout.on { opacity: 1; }

/* ============================ Màn hình ============================ */

.vr-screen {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(14px, 3vw, 40px);
  overflow-y: auto;
}

.vr-screen[data-screen="start"] {
  background: linear-gradient(90deg,
    color-mix(in srgb, #05040f 78%, transparent) 0%,
    color-mix(in srgb, #05040f 30%, transparent) 46%,
    color-mix(in srgb, #05040f 55%, transparent) 100%);
}

.vr-screen[data-screen="pause"],
.vr-screen[data-screen="over"],
.vr-screen[data-screen="notice"] {
  background: color-mix(in srgb, #05030f 62%, transparent);
}

/* --- Góc trái trên (start) --- */
.vr-corner {
  position: absolute;
  top: 16px;
  left: 18px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.vr-back {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 1px solid color-mix(in srgb, #fff 30%, transparent);
  background: color-mix(in srgb, #060a1c 82%, transparent);
  color: #fff;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.vr-back:hover { border-color: var(--vr-cyan); color: var(--vr-cyan); }
.vr-back .icon { width: 17px; height: 17px; }

.vr-brand { line-height: 1.05; }
.vr-brand b { display: block; font-size: 0.95rem; letter-spacing: 0.1em; color: #fff; }
.vr-brand span { font-size: 0.56rem; letter-spacing: 0.42em; color: var(--text-1); }

/* --- Start layout --- */
.vr-start {
  display: grid;
  grid-template-columns: minmax(330px, 1.3fr) minmax(250px, 300px);
  gap: clamp(20px, 5vw, 90px);
  width: min(1060px, 100%);
  align-items: center;
}

.vr-logo { line-height: 0.98; margin-bottom: 16px; }

.vr-logo .l1, .vr-logo .l2 {
  font-size: clamp(2.9rem, 6.4vw, 4.6rem);
  font-weight: 800;
  font-style: italic;
  letter-spacing: 0.03em;
  color: #fff;
  text-shadow:
    0 0 22px color-mix(in srgb, var(--vr-violet) 60%, transparent),
    3px 3px 0 color-mix(in srgb, var(--vr-magenta) 36%, transparent);
}

.vr-logo .l3 { margin-top: 10px; }

.vr-logo .l3 span {
  display: inline-block;
  padding: 2px 20px 5px;
  border: 3px solid var(--vr-magenta);
  border-radius: 6px;
  font-size: clamp(2.2rem, 4.6vw, 3.4rem);
  font-weight: 800;
  font-style: italic;
  background: linear-gradient(100deg, var(--vr-violet), var(--vr-magenta) 70%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  box-shadow:
    0 0 26px color-mix(in srgb, var(--vr-magenta) 45%, transparent),
    inset 0 0 18px color-mix(in srgb, var(--vr-magenta) 25%, transparent);
}

.vr-tagline {
  color: var(--text-1);
  font-size: 0.98rem;
  line-height: 1.55;
  margin-bottom: 12px;
}

.vr-best-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 12px;
  margin-bottom: 14px;
  border: 1px solid color-mix(in srgb, var(--gold, #ffd23f) 55%, transparent);
  border-radius: 5px;
  color: var(--gold, #ffd23f);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.14em;
}

.vr-best-chip .icon { width: 14px; height: 14px; }

.vr-opt-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: min(380px, 100%);
  margin-bottom: 18px;
}

.vr-opt-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 46px;
  padding: 8px 14px;
  border: 1px solid color-mix(in srgb, #fff 22%, transparent);
  border-radius: 7px;
  background: color-mix(in srgb, #060a1c 84%, transparent);
  color: #fff;
  font-family: inherit;
  cursor: pointer;
  transition: border-color 0.15s ease;
}

.vr-opt-row:hover { border-color: var(--vr-cyan); }

.vr-opt-row .lb {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 0.74rem;
  font-weight: 800;
  letter-spacing: 0.18em;
  color: var(--text-1);
}

.vr-opt-row .lb .icon { width: 16px; height: 16px; color: var(--vr-cyan); }
.vr-opt-row .val { margin-left: auto; font-size: 0.86rem; font-weight: 700; color: #fff; }
.vr-opt-row .chev { color: var(--vr-magenta); font-size: 0.9rem; }

.vr-cta {
  display: block;
  width: min(400px, 100%);
  margin: 4px 0 16px;
  padding: 3px;
  border: none;
  cursor: pointer;
  clip-path: polygon(16px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%, 0 16px);
  background: linear-gradient(115deg, var(--vr-violet), var(--vr-magenta));
  box-shadow: 0 0 38px color-mix(in srgb, var(--vr-magenta) 50%, transparent);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.vr-cta:hover { transform: translateY(-2px); box-shadow: 0 0 54px color-mix(in srgb, var(--vr-magenta) 70%, transparent); }
.vr-cta:active { transform: none; }

.vr-cta .in {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 16px 20px;
  clip-path: polygon(15px 0, 100% 0, 100% calc(100% - 15px), calc(100% - 15px) 100%, 0 100%, 0 15px);
  background: linear-gradient(180deg,
    color-mix(in srgb, var(--vr-violet) 72%, black 6%),
    color-mix(in srgb, var(--vr-violet) 38%, black 42%));
  color: #fff;
  font-size: 1.18rem;
  font-weight: 800;
  letter-spacing: 0.24em;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.6);
}

.vr-cta .in .icon { width: 26px; height: 26px; }

.vr-start-actions { display: flex; flex-wrap: wrap; gap: 10px; }

.vr-abtn {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 10px 18px;
  border: 1px solid color-mix(in srgb, #fff 26%, transparent);
  border-radius: 7px;
  background: color-mix(in srgb, #060a1c 84%, transparent);
  color: #edf1ff;
  font-family: inherit;
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.vr-abtn:hover { border-color: var(--vr-cyan); box-shadow: 0 0 14px color-mix(in srgb, var(--vr-cyan) 22%, transparent); }
.vr-abtn .icon { width: 16px; height: 16px; }
.vr-abtn.gold { border-color: color-mix(in srgb, #ffd23f 55%, transparent); color: #ffd23f; }
.vr-abtn.gold:hover { border-color: #ffd23f; box-shadow: 0 0 16px color-mix(in srgb, #ffd23f 30%, transparent); }

/* Panel điều khiển */
.vr-ctl {
  border: 1px solid color-mix(in srgb, #fff 22%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, #060a1c 84%, transparent);
  padding: 14px 18px;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.vr-ctl h3 {
  text-align: center;
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.3em;
  color: #fff;
  padding-bottom: 10px;
  margin-bottom: 4px;
  border-bottom: 1px solid color-mix(in srgb, #fff 14%, transparent);
}

.vr-ctl .row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 8.5px 0;
}

.vr-ctl .row + .row { border-top: 1px solid color-mix(in srgb, #fff 7%, transparent); }
.vr-ctl .keys { display: flex; gap: 4px; min-width: 118px; flex: none; align-items: center; }

.vr-ctl kbd {
  min-width: 24px;
  padding: 3px 7px;
  border: 1px solid color-mix(in srgb, #fff 34%, transparent);
  border-bottom-width: 2px;
  border-radius: 4px;
  background: color-mix(in srgb, #fff 7%, transparent);
  color: #fff;
  font-family: inherit;
  font-size: 0.68rem;
  font-weight: 700;
  text-align: center;
}

.vr-ctl .keys .mouse { width: 15px; height: 20px; color: #fff; }
.vr-ctl .keys b { color: #fff; font-size: 0.74rem; }
.vr-ctl .desc { color: var(--text-1); font-size: 0.78rem; }

/* --- Pause --- */
.vr-pause {
  width: min(780px, 100%);
  border: 1px solid color-mix(in srgb, var(--vr-cyan) 55%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, #070c1e 92%, transparent);
  box-shadow: 0 0 48px color-mix(in srgb, var(--vr-cyan) 16%, transparent), var(--shadow-pop);
  padding: clamp(18px, 3vw, 30px) clamp(18px, 3.2vw, 34px) 14px;
  position: relative;
  animation: vrPanelIn 0.22s ease;
}

@keyframes vrPanelIn {
  from { opacity: 0; transform: translateY(10px) scale(0.985); }
}

.vr-pause::before,
.vr-pause::after {
  content: "";
  position: absolute;
  width: 52px;
  height: 14px;
  border: 2px solid var(--vr-cyan);
}

.vr-pause::before { top: -2px; left: 30px; border-bottom: none; border-right: none; }
.vr-pause::after { bottom: -2px; right: 30px; border-top: none; border-left: none; }

.vr-pause-title {
  text-align: center;
  font-size: 1.6rem;
  font-weight: 800;
  letter-spacing: 0.3em;
  color: #fff;
  text-shadow: 0 0 22px color-mix(in srgb, var(--vr-cyan) 50%, transparent);
  margin-bottom: 18px;
}

.vr-pause-cols {
  display: grid;
  grid-template-columns: 1fr 1.18fr;
  gap: clamp(16px, 3vw, 34px);
}

.vr-menu { display: flex; flex-direction: column; gap: 9px; }

.vr-menu-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 46px;
  padding: 8px 16px;
  border: 1px solid color-mix(in srgb, #fff 24%, transparent);
  border-radius: 7px;
  background: color-mix(in srgb, #0a1226 84%, transparent);
  color: #edf1ff;
  font-family: inherit;
  font-size: 0.74rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.vr-menu-btn:hover { border-color: var(--vr-cyan); box-shadow: 0 0 14px color-mix(in srgb, var(--vr-cyan) 25%, transparent); }
.vr-menu-btn .icon { width: 16px; height: 16px; flex: none; }
.vr-menu-btn .dmd { margin-left: auto; color: var(--vr-lime); width: 14px; height: 14px; }

.vr-menu-btn.primary {
  background: linear-gradient(180deg, #14b6d8, #0a7d9c);
  border-color: color-mix(in srgb, var(--vr-cyan) 80%, transparent);
  color: #fff;
  box-shadow: 0 0 20px color-mix(in srgb, var(--vr-cyan) 40%, transparent);
}

.vr-settings h3 {
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.26em;
  color: #fff;
  border-bottom: 1px solid color-mix(in srgb, #fff 14%, transparent);
  padding-bottom: 8px;
  margin-bottom: 13px;
}

.vr-set { margin-bottom: 13px; }

.vr-set .lbl {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 0.66rem;
  font-weight: 800;
  letter-spacing: 0.16em;
  color: var(--text-1);
  margin-bottom: 7px;
}

.vr-set .lbl .icon { width: 15px; height: 15px; color: #cfe6ff; }

.vr-set.toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.vr-set.toggle .lbl { margin-bottom: 0; }

.vr-slider-row { display: flex; align-items: center; gap: 12px; }
.vr-slider-row .val { min-width: 46px; text-align: right; color: #fff; font-weight: 700; font-size: 0.82rem; font-variant-numeric: tabular-nums; }

input[type="range"].vr-range {
  flex: 1;
  appearance: none;
  -webkit-appearance: none;
  height: 4px;
  border-radius: 4px;
  background: linear-gradient(90deg, var(--vr-cyan) var(--fill, 50%), color-mix(in srgb, #fff 14%, transparent) var(--fill, 50%));
  outline-offset: 4px;
  cursor: pointer;
}

input[type="range"].vr-range::-webkit-slider-thumb {
  appearance: none;
  -webkit-appearance: none;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: #d9f8ff;
  border: 2px solid var(--vr-cyan);
  box-shadow: 0 0 10px color-mix(in srgb, var(--vr-cyan) 60%, transparent);
}

input[type="range"].vr-range::-moz-range-thumb {
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: #d9f8ff;
  border: 2px solid var(--vr-cyan);
}

.vr-seg {
  display: flex;
  border: 1px solid color-mix(in srgb, #fff 22%, transparent);
  border-radius: 5px;
  overflow: hidden;
  background: color-mix(in srgb, #060a1c 82%, transparent);
}

.vr-seg button {
  flex: 1;
  min-height: 34px;
  padding: 6px 10px;
  border: none;
  background: transparent;
  color: var(--text-1);
  font-family: inherit;
  font-weight: 800;
  font-size: 0.68rem;
  letter-spacing: 0.08em;
  cursor: pointer;
}

.vr-seg button + button { border-left: 1px solid color-mix(in srgb, #fff 12%, transparent); }
.vr-seg button:hover { color: #fff; }

.vr-seg button.active {
  background: linear-gradient(180deg, #14b6d8, #0a7d9c);
  color: #fff;
  box-shadow: 0 0 14px color-mix(in srgb, var(--vr-cyan) 40%, transparent);
}

.vr-switch {
  position: relative;
  width: 46px;
  height: 22px;
  border: none;
  background: transparent;
  cursor: pointer;
  flex: none;
}

.vr-switch .track {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background: color-mix(in srgb, #fff 16%, transparent);
  transition: background 0.18s ease;
}

.vr-switch .track::after {
  content: "";
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.18s ease;
}

.vr-switch.on .track { background: var(--vr-cyan); box-shadow: 0 0 12px color-mix(in srgb, var(--vr-cyan) 55%, transparent); }
.vr-switch.on .track::after { transform: translateX(24px); }

.vr-tip {
  margin-top: 16px;
  padding-top: 10px;
  border-top: 1px solid color-mix(in srgb, #fff 10%, transparent);
  text-align: center;
  color: var(--text-2);
  font-size: 0.68rem;
  letter-spacing: 0.06em;
}

.vr-tip kbd {
  padding: 2px 7px;
  border: 1px solid color-mix(in srgb, #fff 30%, transparent);
  border-radius: 4px;
  font-family: inherit;
  font-size: 0.64rem;
  color: #fff;
}

/* --- Results --- */
.vr-over {
  width: min(680px, 100%);
  border: 1px solid color-mix(in srgb, var(--vr-cyan) 55%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, #070c1e 93%, transparent);
  box-shadow: 0 0 48px color-mix(in srgb, var(--vr-cyan) 15%, transparent), var(--shadow-pop);
  padding: clamp(18px, 3.2vw, 32px);
  text-align: center;
  animation: vrPanelIn 0.22s ease;
}

.vr-over-head {
  font-size: 1.15rem;
  font-weight: 800;
  letter-spacing: 0.24em;
  color: #fff;
  margin-bottom: 14px;
}

.vr-final-time .lbl {
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.3em;
  color: var(--vr-cyan);
}

.vr-final-time .num {
  font-size: clamp(2.4rem, 6.4vw, 3.4rem);
  font-weight: 800;
  line-height: 1.08;
  color: #fff;
  text-shadow: 0 0 30px color-mix(in srgb, var(--vr-cyan) 55%, transparent);
  font-variant-numeric: tabular-nums;
}

.vr-record {
  display: inline-block;
  margin-top: 7px;
  padding: 4px 16px;
  border: 1px solid var(--gold, #ffd23f);
  border-radius: 4px;
  color: var(--gold, #ffd23f);
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.26em;
  box-shadow: 0 0 18px color-mix(in srgb, #ffd23f 30%, transparent);
  animation: recordPulse 1s ease infinite alternate;
}

.vr-record.small { margin: 0 0 0 10px; padding: 2px 10px; font-size: 0.6rem; }

.vr-best-line {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  color: var(--text-1);
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.vr-best-line .icon { width: 14px; height: 14px; }

.vr-statgrid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin: 18px 0 14px;
}

.vr-statcard {
  border: 1px solid color-mix(in srgb, #fff 18%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, #0a1226 70%, transparent);
  padding: 12px 6px;
}

.vr-statcard .icon { width: 22px; height: 22px; margin: 0 auto 7px; display: block; }
.vr-statcard.lime .icon { color: var(--vr-lime); }
.vr-statcard.magenta .icon { color: var(--vr-pink); }
.vr-statcard.red .icon { color: var(--vr-red); }
.vr-statcard.cyan .icon { color: var(--vr-cyan); }

.vr-statcard .lbl {
  font-size: 0.56rem;
  font-weight: 800;
  letter-spacing: 0.16em;
  color: var(--text-2);
}

.vr-statcard .val {
  margin-top: 3px;
  font-size: 1.22rem;
  font-weight: 800;
  color: #fff;
  font-variant-numeric: tabular-nums;
}

.vr-score-line {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 12px;
  margin-bottom: 18px;
}

.vr-score-line .lbl { font-size: 0.7rem; font-weight: 800; letter-spacing: 0.26em; color: var(--text-1); }
.vr-score-line .num { font-size: 1.5rem; font-weight: 800; color: #fff; font-variant-numeric: tabular-nums; }

.vr-over-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }

/* --- Notice --- */
.vr-notice {
  max-width: 460px;
  text-align: center;
  border: 1px solid color-mix(in srgb, var(--vr-cyan) 40%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, #070c1e 92%, transparent);
  padding: 34px 26px;
}

.vr-notice .icon { width: 44px; height: 44px; margin: 0 auto 14px; color: var(--vr-violet); }
.vr-notice h3 { font-size: 1.02rem; letter-spacing: 0.2em; margin-bottom: 10px; color: #fff; }
.vr-notice p { color: var(--text-1); font-size: 0.86rem; margin-bottom: 20px; line-height: 1.5; }
.vr-notice .btn-row { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; }

/* --- Responsive --- */
@media (max-width: 900px) {
  .vr-start { grid-template-columns: 1fr; width: min(560px, 100%); }
  .vr-pause-cols { grid-template-columns: 1fr; }
  .vr-statgrid { grid-template-columns: repeat(2, 1fr); }
  .vr-tl { width: 118px; }
  .vr-panel .big .val { font-size: 1.2rem; }
  .vr-btn { min-width: 0; }
  .vr-btn span { display: none; }
  .vr-time { font-size: 1.3rem; }
}
`;

exports.VOID_RUNNER_CSS = VOID_RUNNER_CSS;
};
__defs["games/neon-drift/index.js"] = function (exports, __req) {
/**
 * Neon Drift 404 — đua xe drift top-down (game 7).
 *
 * Theo plan + ảnh reference: HUD ĐIỂM / KỶ LỤC / NITRO % / COMBO ×N /
 * CHECKPOINT 03/08 + cụm nút hệ thống; minimap góc trái trên; vòng đua
 * neon khép kín với 8 checkpoint ĐÚNG THỨ TỰ; drift (Space) ăn combo;
 * nitro (Shift) có thanh %; pickup năng lượng +100đ; 4 xe cản chạy theo
 * path; va chạm giảm tốc + reset combo; kết thúc khi qua vạch đích hoặc
 * hết giờ (75s), thưởng thời gian dư. Physics fixed-timestep 1/120s.
 * Mobile: nút ◀ ▶ + NITRO tròn, xe tự ga.
 */

const { createExpansionFrame } = __req("games/_shared/frame.js");
const { createKeyboard } = __req("core/input-manager.js");
const { createLoop } = __req("core/loop.js");
const { el, formatScore, formatNumber, formatTime } = __req("core/utils.js");
const { buildTrack } = __req("games/neon-drift/track.js");
const { createCar, createTraffic, stepCar, stepTraffic, STEP } = __req("games/neon-drift/physics.js");
const { createDriftRenderer, createMinimap } = __req("games/neon-drift/render.js");
const { ND_CSS } = __req("games/neon-drift/styles.js");

const RACE_TIME = 75;

function createGame() {
  let ctx = null;
  let frame = null;
  let renderer = null;
  let minimap = null;
  let keys = null;
  let loop = null;
  let ro = null;
  let canvas = null;
  let mmCanvas = null;
  let nitroBtn = null;

  const TEST = typeof window !== "undefined" && window.__ARCADE_EXP5_TEST__;

  let track = null;
  let car = null;
  let traffic = [];
  let mode = "intro"; // intro | countdown | race | paused | over
  let pausedFrom = "race";
  let time = 0;
  let acc = 0;
  let countdownT = 0;
  let raceTime = RACE_TIME;
  let score = 0;
  let best = 0;
  let combo = 1;
  let maxCombo = 1;
  let comboProgress = 0;
  let nextCp = 1;
  let pickupsTaken = 0;
  let crashes = 0;
  let shake = 0;
  let scrapeSfxT = 0;
  let trailT = 0;
  let stateT = 0;

  const cam = { x: 0, y: 0 };
  const trails = [];
  const sparks = [];
  const touch = { steer: 0, nitro: false, active: false, steerHeldT: 0 };

  /* ---------------- HUD ---------------- */

  function updateHud() {
    frame.setStat("score", formatScore(score));
    frame.setStat("best", formatScore(Math.max(best, score)));
    frame.setStat("nitro", `${Math.round(car.nitro)}%`);
    frame.setStatBar("nitro", car.nitro);
    frame.setStat("combo", `×${combo}`);
    frame.setStat("cp", `${String(Math.min(nextCp - 1, 8)).padStart(2, "0")}/08`);
    if (nitroBtn) {
      if (car.nitro <= 0.5) nitroBtn.dataset.empty = "1";
      else delete nitroBtn.dataset.empty;
    }
  }

  /* ---------------- Vòng đời trận ---------------- */

  function resetRace() {
    car = createCar(track);
    traffic = createTraffic(track, 4);
    for (const p of track.pickups) p.taken = false;
    trails.length = 0;
    sparks.length = 0;
    raceTime = TEST ? 18 : RACE_TIME;
    score = 0;
    combo = 1;
    maxCombo = 1;
    comboProgress = 0;
    nextCp = 1;
    pickupsTaken = 0;
    crashes = 0;
    shake = 0;
    best = ctx.getBest();
    cam.x = car.x;
    cam.y = car.y;
  }

  function startRace() {
    resetRace();
    mode = "countdown";
    countdownT = TEST ? 0.4 : 3.2;
    frame.clearScreen();
    frame.setPaused(false);
    ctx.onMatchStart();
    ctx.audio.play("start");
    loop.start();
    updateHud();
  }

  function finishRace(completed) {
    if (mode === "over") return;
    mode = "over";
    const bonus = completed ? Math.ceil(Math.max(0, raceTime)) * 100 : 0;
    score += bonus;
    updateHud();
    const saved = ctx.onGameOver(score, { checkpoints: nextCp - 1, maxCombo, crashes });
    frame.setPaused(false);
    frame.overScreen({
      kicker: completed ? "// VỀ ĐÍCH" : "// HẾT GIỜ",
      heading: completed ? "HOÀN THÀNH VÒNG ĐUA!" : "HẾT GIỜ!",
      score,
      saved,
      statCards: [
        { label: "CHECKPOINT", value: `${nextCp - 1}/8`, color: "lime" },
        { label: "COMBO CAO NHẤT", value: `×${maxCombo}`, color: "pink" },
        { label: "NĂNG LƯỢNG", value: pickupsTaken, color: "cyan" },
        completed
          ? { label: "THƯỞNG THỜI GIAN", value: `+${formatNumber(bonus)}`, color: "gold" }
          : { label: "VA CHẠM", value: crashes, color: "red" },
      ],
      restartLabel: "ĐUA LẠI",
      onRestart: () => startRace(),
    });
    ctx.audio.play(completed ? "win" : "over");
  }

  /* ---------------- Pause ---------------- */

  function pauseGame() {
    if (mode !== "race" && mode !== "countdown") return;
    pausedFrom = mode;
    mode = "paused";
    loop.stop();
    frame.setPaused(true);
    frame.pauseMenu({
      onResume: () => resumeGame(),
      onRestart: () => startRace(),
      restartLabel: "ĐUA LẠI",
      buildExtra: (box) => {
        const row = el("div", "exp-setrow");
        row.appendChild(el("span", "", "TIẾN ĐỘ"));
        row.appendChild(el("span", "val", `CP ${nextCp - 1}/8 · ${formatTime(raceTime)} còn lại`));
        box.appendChild(row);
      },
    });
  }

  function resumeGame() {
    if (mode !== "paused") return;
    mode = pausedFrom;
    frame.clearScreen();
    frame.setPaused(false);
    keys.clearDown();
    touch.steer = 0;
    touch.nitro = false;
    loop.start();
  }

  function togglePause() {
    if (mode === "race" || mode === "countdown") pauseGame();
    else if (mode === "paused") resumeGame();
  }

  /* ---------------- Gameplay ---------------- */

  function gatherInputs() {
    const left = keys.isDown("ArrowLeft") || keys.isDown("KeyA");
    const right = keys.isDown("ArrowRight") || keys.isDown("KeyD");
    const up = keys.isDown("ArrowUp") || keys.isDown("KeyW");
    const down = keys.isDown("ArrowDown") || keys.isDown("KeyS");
    const drift = keys.isDown("Space");
    const nitro = keys.isDown("ShiftLeft") || keys.isDown("ShiftRight");

    let steer = (right ? 1 : 0) - (left ? 1 : 0) + touch.steer;
    steer = Math.max(-1, Math.min(1, steer));
    let throttle = (up ? 1 : 0) - (down ? 1 : 0);
    if (touch.active) throttle = Math.max(throttle, 1); // mobile tự ga
    // mobile: giữ lái lâu ở tốc độ cao → auto drift nhẹ
    const autoDrift = touch.active && Math.abs(touch.steer) > 0 && touch.steerHeldT > 0.4 && car.speed > 230;
    return { steer, throttle, drift: drift || autoDrift, nitro: nitro || touch.nitro };
  }

  function onCheckpoint(order) {
    score += 500;
    ctx.audio.play("checkpoint");
    if (order === 8) {
      frame.banner("FINISH!");
      finishRace(true);
    } else {
      frame.banner(`CHECKPOINT ${String(order).padStart(2, "0")}/08`);
    }
  }

  function simulate() {
    const inputs = gatherInputs();
    const ev = stepCar(car, track, inputs, null);

    // tiến độ checkpoint (đúng thứ tự, threshold theo mẫu tích lũy)
    while (nextCp <= 8) {
      const cp = track.checkpoints[nextCp - 1];
      const thresh = cp.order === 8 ? track.count : cp.si;
      if (car.trackPos >= thresh - 2) {
        nextCp += 1;
        onCheckpoint(cp.order);
        if (mode !== "race") return;
      } else break;
    }

    // pickup năng lượng
    for (const p of track.pickups) {
      if (p.taken) continue;
      const dx = car.x - p.x;
      const dy = car.y - p.y;
      if (dx * dx + dy * dy < 27 * 27) {
        p.taken = true;
        pickupsTaken += 1;
        score += 100;
        car.nitro = Math.min(100, car.nitro + 30);
        ctx.audio.play("pickup");
      }
    }

    // drift → điểm + combo tăng dần
    if (car.drifting) {
      score += 130 * combo * STEP;
      comboProgress += STEP;
      if (comboProgress > 1.1) {
        comboProgress = 0;
        if (combo < 9) {
          combo += 1;
          maxCombo = Math.max(maxCombo, combo);
          ctx.audio.play("combo");
        }
      }
    }

    // va chạm
    const hitTraffic = stepTraffic(traffic, track, car);
    if (hitTraffic || ev.hardWall) {
      crashes += 1;
      combo = 1;
      comboProgress = 0;
      shake = 9;
      ctx.audio.play("crash");
    } else if (ev.wallScrape) {
      if (time - scrapeSfxT > 0.5) {
        scrapeSfxT = time;
        ctx.audio.play("squash");
      }
      if (sparks.length < 40) {
        sparks.push({ x: car.x, y: car.y, life: 0.5 });
      }
    }
  }

  function update(dt) {
    time += dt;

    if (mode === "countdown") {
      countdownT -= dt;
      const n = Math.ceil(countdownT);
      if (countdownT <= 0) {
        mode = "race";
        frame.banner("GO!");
        ctx.audio.play("wave");
      } else if (n <= 3 && Math.ceil(countdownT + dt) !== n) {
        frame.banner(String(n));
        ctx.audio.play("ui");
      }
    }

    if (mode === "race") {
      raceTime -= dt;
      if (raceTime <= 0) {
        raceTime = 0;
        finishRace(false);
      } else {
        acc = Math.min(acc + dt, 0.12);
        while (acc >= STEP && mode === "race") {
          acc -= STEP;
          simulate();
        }
      }
      if (touch.steer !== 0) touch.steerHeldT += dt;
      else touch.steerHeldT = 0;
    }

    // vệt drift / nitro
    if ((mode === "race" || mode === "countdown") && (car.drifting || car.nitroActive) && car.speed > 120) {
      trailT += dt;
      if (trailT > 0.016) {
        trailT = 0;
        const back = 15;
        const bx = car.x - Math.cos(car.heading) * back;
        const by = car.y - Math.sin(car.heading) * back;
        const px = -Math.sin(car.heading) * 7;
        const py = Math.cos(car.heading) * 7;
        const last = trails[trails.length - 1];
        const nitroCol = car.nitroActive && !car.drifting;
        if (last && last.fresh) {
          trails.push({ x0: last.x1, y0: last.y1, x1: bx + px, y1: by + py, life: 1, nitro: nitroCol, fresh: true });
          trails.push({ x0: last.x1b, y0: last.y1b, x1: bx - px, y1: by - py, life: 1, nitro: nitroCol, fresh: true, b: true });
        }
        trails.push({ x0: bx + px, y0: by + py, x1: bx + px, y1: by + py, x1b: bx - px, y1b: by - py, life: 1, nitro: nitroCol, fresh: true });
        if (trails.length > 300) trails.splice(0, trails.length - 300);
      }
    }
    for (const tr of trails) tr.life -= dt * 0.75;
    for (const s of sparks) s.life -= dt * 1.8;
    while (sparks.length && sparks[0].life <= 0) sparks.shift();
    while (trails.length && trails[0].life <= 0) trails.shift();

    shake = Math.max(0, shake - dt * 26);

    // camera bám xe + nhìn trước theo vận tốc
    const lead = 0.32;
    cam.x += (car.x + car.vx * lead - cam.x) * Math.min(1, dt * 4.2);
    cam.y += (car.y + car.vy * lead - cam.y) * Math.min(1, dt * 4.2);

    if (mode === "race" || mode === "countdown") {
      frame.setStat("time", formatTime(raceTime));
      updateHud();
    }

    renderer.draw({ car, cam, traffic, trails, sparks, nextCp, shake }, time);
    minimap.draw(car, traffic, nextCp, time);

    if (TEST) {
      stateT += dt;
      if (stateT > 0.4) {
        stateT = 0;
        window.__ND_STATE__ = {
          mode,
          score: Math.floor(score),
          nextCp,
          speed: Math.round(car.speed),
          nitro: Math.round(car.nitro),
          time: Math.round(raceTime),
          trackPos: Math.round(car.trackPos),
        };
      }
    }
  }

  /* ---------------- Intro ---------------- */

  function showIntro() {
    mode = "intro";
    loop.stop();
    frame.intro({
      kicker: "// GIẢI ĐUA NEON",
      heading: [["NEON ", "cyan"], ["DRIFT ", "pink"], ["404", "lime"]],
      goal:
        "Hoàn thành vòng đua qua 8 CHECKPOINT đúng thứ tự trước khi hết 75 giây. Drift để dồn combo điểm, nhặt lục giác năng lượng để nạp NITRO. Va chạm sẽ reset combo!",
      rows: [
        { keys: ["↑", "W"], text: "tăng tốc (mobile: tự ga)" },
        { keys: ["← →", "A D"], text: "đánh lái (mobile: nút ◀ ▶)" },
        { keys: ["SPACE"], text: "drift / phanh tay — giữ để ôm cua" },
        { keys: ["SHIFT"], text: "nitro (nút tròn trên mobile)" },
        { keys: ["ESC"], text: "tạm dừng" },
      ],
      startLabel: "VÀO ĐƯỜNG ĐUA",
      onStart: () => startRace(),
    });
    // khung nền tĩnh cho intro
    resetRace();
    renderer.fit();
    renderer.draw({ car, cam, traffic, trails, sparks, nextCp, shake: 0 }, 0);
    minimap.draw(car, traffic, 1, 0);
  }

  /* ---------------- Interface ---------------- */

  return {
    async mount(container, context) {
      ctx = context;
      track = buildTrack();

      const rootNode = container.getRootNode();
      if (rootNode instanceof ShadowRoot && !rootNode.querySelector("#nd-style")) {
        const style = document.createElement("style");
        style.id = "nd-style";
        style.textContent = ND_CSS;
        rootNode.appendChild(style);
      }

      frame = createExpansionFrame(container, ctx, {
        accent: "pink",
        title: [["NEON ", "cyan"], ["DRIFT ", "pink"], ["404", "lime"]],
        stats: [
          { id: "score", label: "ĐIỂM", color: "white", value: "000000" },
          { id: "best", label: "KỶ LỤC", color: "white", value: "000000", optional: true },
          { id: "nitro", label: "NITRO", color: "cyan", value: "55%", bar: true },
          { id: "combo", label: "COMBO", color: "pink", value: "×1" },
          { id: "cp", label: "CHECKPOINT", color: "lime", value: "00/08" },
          { id: "time", label: "THỜI GIAN", color: "gold", value: "01:15", optional: true },
        ],
        onPauseToggle: togglePause,
      });

      canvas = document.createElement("canvas");
      canvas.className = "exp-canvas";
      canvas.setAttribute("aria-label", "Đường đua Neon Drift");
      frame.playfield.appendChild(canvas);

      // minimap panel (góc trái trên như ảnh)
      const mmBox = el("div", "nd-minimap");
      mmCanvas = document.createElement("canvas");
      mmBox.appendChild(mmCanvas);
      frame.playfield.appendChild(mmBox);

      // cụm nút cảm ứng (◀ ▶ + NITRO)
      const touchBox = el("div", "nd-touch");
      const mkSteer = (dir, label) => {
        const b = el("button", "nd-steer", label);
        b.type = "button";
        b.setAttribute("aria-label", dir < 0 ? "Rẽ trái" : "Rẽ phải");
        const down = (e) => {
          e.preventDefault();
          touch.steer = dir;
          b.classList.add("held");
        };
        const up = () => {
          if (touch.steer === dir) touch.steer = 0;
          b.classList.remove("held");
        };
        b.addEventListener("pointerdown", down, { signal: ctx.signal });
        b.addEventListener("pointerup", up, { signal: ctx.signal });
        b.addEventListener("pointercancel", up, { signal: ctx.signal });
        b.addEventListener("pointerleave", up, { signal: ctx.signal });
        return b;
      };
      touchBox.appendChild(mkSteer(-1, "◀"));
      touchBox.appendChild(mkSteer(1, "▶"));
      nitroBtn = el("button", "nd-nitro");
      nitroBtn.type = "button";
      nitroBtn.setAttribute("aria-label", "Nitro");
      const bolt = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      bolt.setAttribute("viewBox", "0 0 24 24");
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", "M13 2 5 14h5l-2 8 9-13h-5l1-7z");
      path.setAttribute("fill", "currentColor");
      bolt.appendChild(path);
      nitroBtn.appendChild(bolt);
      nitroBtn.appendChild(el("span", "", "NITRO"));
      const nDown = (e) => {
        e.preventDefault();
        touch.nitro = true;
        nitroBtn.classList.add("held");
      };
      const nUp = () => {
        touch.nitro = false;
        nitroBtn.classList.remove("held");
      };
      nitroBtn.addEventListener("pointerdown", nDown, { signal: ctx.signal });
      nitroBtn.addEventListener("pointerup", nUp, { signal: ctx.signal });
      nitroBtn.addEventListener("pointercancel", nUp, { signal: ctx.signal });
      touchBox.appendChild(nitroBtn);
      frame.playfield.appendChild(touchBox);

      const coarse = window.matchMedia("(pointer: coarse)").matches;
      if (coarse) frame.root.dataset.touch = "1";
      touch.active = coarse;
      // chạm vào canvas cũng bật chế độ touch (máy lai)
      canvas.addEventListener(
        "pointerdown",
        (e) => {
          if (e.pointerType === "touch" && !touch.active) {
            touch.active = true;
            frame.root.dataset.touch = "1";
          }
        },
        { signal: ctx.signal }
      );

      renderer = createDriftRenderer(canvas, frame.playfield, track);
      minimap = createMinimap(mmCanvas, track);
      ro = new ResizeObserver(() => renderer.fit());
      ro.observe(frame.playfield);

      keys = createKeyboard({ signal: ctx.signal });
      keys.on(["KeyP"], () => togglePause());
      keys.on(["KeyR"], () => {
        if (mode === "race" || mode === "over") startRace();
      });

      loop = createLoop(update);
      showIntro();
    },

    start() {
      if (mode === "intro") startRace();
    },

    pause() {
      pauseGame();
    },

    resume() {
      resumeGame();
    },

    restart() {
      if (mode === "intro") return;
      startRace();
    },

    resize() {
      renderer?.fit();
    },

    destroy() {
      loop?.stop();
      keys?.destroy();
      ro?.disconnect();
      frame?.destroy();
      frame = null;
      renderer = null;
      minimap = null;
      track = null;
      if (typeof window !== "undefined") delete window.__ND_STATE__;
    },
  };
}

exports.createGame = createGame;
};
__defs["games/neon-drift/track.js"] = function (exports, __req) {
/**
 * track.js — đường đua Neon Drift 404: polyline khép kín được làm mượt
 * bằng Catmull-Rom, lấy mẫu dày (~7px) kèm tiếp tuyến/pháp tuyến.
 * Cung cấp: điểm mẫu, 8 checkpoint đúng thứ tự, pickup năng lượng,
 * đường path Path2D cache sẵn (mặt đường, 2 mép neon, vạch giữa),
 * decor thành phố sinh theo seed, và truy vấn "điểm gần nhất".
 */

const { seededRand } = __req("core/utils.js");

const TRACK_WIDTH = 150;
const HALF_W = TRACK_WIDTH / 2;

/* Điểm điều khiển vòng đua (khép kín, theo chiều kim đồng hồ) */
const CONTROL = [
  [430, 330], [830, 205], [1360, 190], [1840, 300],
  [2085, 640], [2010, 1010], [1630, 1235], [1170, 1265],
  [890, 1070], [700, 850], [470, 800], [300, 1010],
  [195, 760], [240, 500],
];

function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return [
    0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
    0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
  ];
}

function buildTrack() {
  const n = CONTROL.length;
  const pts = [];
  // Lấy mẫu Catmull-Rom khép kín
  for (let i = 0; i < n; i++) {
    const p0 = CONTROL[(i - 1 + n) % n];
    const p1 = CONTROL[i];
    const p2 = CONTROL[(i + 1) % n];
    const p3 = CONTROL[(i + 2) % n];
    const segLen = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const steps = Math.max(6, Math.round(segLen / 7));
    for (let s = 0; s < steps; s++) {
      pts.push(catmull(p0, p1, p2, p3, s / steps));
    }
  }

  const count = pts.length;
  const tangents = new Array(count);
  const normals = new Array(count);
  let length = 0;
  for (let i = 0; i < count; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % count];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const d = Math.hypot(dx, dy) || 1;
    tangents[i] = [dx / d, dy / d];
    normals[i] = [-dy / d, dx / d];
    length += d;
  }
  const avgStep = length / count;

  /* 8 checkpoint cách đều theo chu vi — cp cuối (idx 7) là vạch ĐÍCH */
  const checkpoints = [];
  for (let k = 1; k <= 8; k++) {
    const si = Math.round((count * k) / 8) % count;
    checkpoints.push({ si, order: k });
  }

  /* Pickup năng lượng rải trên đường (lệch tâm ngẫu nhiên theo seed) */
  const rand = seededRand(404);
  const pickups = [];
  for (let k = 0; k < 12; k++) {
    const si = Math.round((count * (k + 0.5)) / 12) % count;
    const off = (rand() - 0.5) * (TRACK_WIDTH - 70);
    pickups.push({
      x: pts[si][0] + normals[si][0] * off,
      y: pts[si][1] + normals[si][1] * off,
      taken: false,
      pulse: rand() * 6,
    });
  }

  /* Path2D cache: mặt đường, mép trái/phải, vạch giữa */
  const road = new Path2D();
  road.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < count; i++) road.lineTo(pts[i][0], pts[i][1]);
  road.closePath();

  const edgeL = new Path2D();
  const edgeR = new Path2D();
  for (let i = 0; i <= count; i++) {
    const j = i % count;
    const lx = pts[j][0] + normals[j][0] * HALF_W;
    const ly = pts[j][1] + normals[j][1] * HALF_W;
    const rx = pts[j][0] - normals[j][0] * HALF_W;
    const ry = pts[j][1] - normals[j][1] * HALF_W;
    if (i === 0) {
      edgeL.moveTo(lx, ly);
      edgeR.moveTo(rx, ry);
    } else {
      edgeL.lineTo(lx, ly);
      edgeR.lineTo(rx, ry);
    }
  }

  /* Mũi tên chỉ hướng trên mặt đường (mỗi ~28 mẫu một mũi tên) */
  const arrows = [];
  for (let i = 0; i < count; i += 28) {
    arrows.push({ x: pts[i][0], y: pts[i][1], angle: Math.atan2(tangents[i][1], tangents[i][0]) });
  }

  /* Decor thành phố: khối nhà neon ngoài hành lang đường đua */
  const decor = [];
  const drand = seededRand(777);
  const minX = 40;
  const maxX = 2300;
  const minY = 20;
  const maxY = 1450;
  let attempts = 0;
  while (decor.length < 46 && attempts < 400) {
    attempts++;
    const bw = 70 + drand() * 130;
    const bh = 70 + drand() * 130;
    const x = minX + drand() * (maxX - minX - bw);
    const y = minY + drand() * (maxY - minY - bh);
    const cx = x + bw / 2;
    const cy = y + bh / 2;
    let clear = true;
    for (let i = 0; i < count; i += 4) {
      const dx = cx - pts[i][0];
      const dy = cy - pts[i][1];
      if (dx * dx + dy * dy < (HALF_W + 95 + Math.max(bw, bh) / 2) ** 2) {
        clear = false;
        break;
      }
    }
    if (!clear) continue;
    const hues = ["#ff2ee6", "#20e3ff", "#9a5cff", "#3b7bff"];
    decor.push({
      x, y, w: bw, h: bh,
      color: hues[Math.floor(drand() * hues.length)],
      windows: Math.floor(2 + drand() * 4),
      vertical: drand() > 0.5,
    });
  }

  return {
    pts,
    tangents,
    normals,
    count,
    length,
    avgStep,
    checkpoints,
    pickups,
    paths: { road, edgeL, edgeR },
    arrows,
    decor,
    startSi: 0,
    bbox: { minX, minY, maxX, maxY },
  };
}

/** Tìm mẫu gần nhất quanh gợi ý hintIdx (cửa sổ ±40) — O(1) mỗi bước. */
function nearestSample(track, x, y, hintIdx) {
  const { pts, count } = track;
  let best = hintIdx;
  let bestD = Infinity;
  for (let k = -40; k <= 40; k++) {
    const i = (hintIdx + k + count) % count;
    const dx = x - pts[i][0];
    const dy = y - pts[i][1];
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return { idx: best, dist: Math.sqrt(bestD) };
}

exports.buildTrack = buildTrack; exports.nearestSample = nearestSample; exports.TRACK_WIDTH = TRACK_WIDTH; exports.HALF_W = HALF_W;
};
__defs["games/neon-drift/physics.js"] = function (exports, __req) {
/**
 * physics.js — mô phỏng xe Neon Drift 404 với FIXED TIMESTEP (1/120s).
 * Xe arcade: lực đẩy theo hướng đầu xe, bám ngang (grip) tách riêng để
 * tạo drift khi giữ Space, nitro tiêu hao theo thời gian, va chạm mép
 * đường trượt dọc tường + giảm tốc, xe cản chạy theo path.
 */

const { nearestSample, HALF_W } = __req("games/neon-drift/track.js");

const STEP = 1 / 120;

const CAR_R = 15;
const ENGINE = 560;
const BRAKE = 760;
const REVERSE = 180;
const MAX_SPEED = 470;
const NITRO_SPEED = 660;
const NITRO_ACCEL = 1.85;
const NITRO_DRAIN = 30; // %/s
const GRIP_NORMAL = 9.5; // hệ số triệt tiêu vận tốc ngang mỗi giây
const GRIP_DRIFT = 2.35;
const STEER_BASE = 2.35; // rad/s ở tốc độ tối đa

function createCar(track) {
  const si = track.startSi;
  const [x, y] = track.pts[si];
  const heading = Math.atan2(track.tangents[si][1], track.tangents[si][0]);
  return {
    x, y,
    vx: 0, vy: 0,
    heading,
    steerVisual: 0,
    si,
    trackPos: 0, // tiến độ liên tục (đơn vị: mẫu, tăng dần theo chiều đua)
    nitro: 55,
    nitroActive: false,
    drifting: false,
    driftDir: 0,
    wallContact: false,
    speed: 0,
    lateral: 0,
  };
}

/**
 * Một bước vật lý. inputs: { throttle -1..1, steer -1..1, drift, nitro }.
 * Trả về sự kiện { hardWall, pickup: idx|null, checkpoint: order|null }.
 */
function stepCar(car, track, inputs, race) {
  const ev = { hardWall: false, wallScrape: false };

  const cos = Math.cos(car.heading);
  const sin = Math.sin(car.heading);
  let vF = car.vx * cos + car.vy * sin; // tốc độ dọc
  let vL = -car.vx * sin + car.vy * cos; // tốc độ ngang

  // Nitro
  car.nitroActive = inputs.nitro && car.nitro > 0.5;
  if (car.nitroActive) car.nitro = Math.max(0, car.nitro - NITRO_DRAIN * STEP);

  // Lực đẩy / phanh
  if (inputs.throttle > 0) {
    vF += ENGINE * inputs.throttle * (car.nitroActive ? NITRO_ACCEL : 1) * STEP;
  } else if (inputs.throttle < 0) {
    if (vF > 20) vF -= BRAKE * STEP;
    else vF = Math.max(-REVERSE, vF - REVERSE * 1.6 * STEP);
  }

  // Cản khí động + cản lăn
  vF *= 1 - 0.32 * STEP;
  const cap = car.nitroActive ? NITRO_SPEED : MAX_SPEED;
  if (vF > cap) vF += (cap - vF) * Math.min(1, STEP * 3.2);

  // Đánh lái: hiệu quả tỉ lệ tốc độ; drift tăng độ gắt
  const speedK = Math.min(1, Math.abs(vF) / MAX_SPEED);
  const steerPow = STEER_BASE * (0.34 + 0.66 * speedK) * (inputs.drift ? 1.4 : 1);
  car.heading += inputs.steer * steerPow * STEP * Math.sign(vF || 1);
  car.steerVisual += (inputs.steer - car.steerVisual) * Math.min(1, STEP * 14);

  // Grip ngang: drift giữ lại nhiều vận tốc ngang hơn
  const grip = inputs.drift ? GRIP_DRIFT : GRIP_NORMAL;
  vL *= Math.exp(-grip * STEP);
  // Khi drift, một phần lực dọc chuyển thành trượt ngang theo hướng lái
  if (inputs.drift && Math.abs(vF) > 140) {
    vL += inputs.steer * 105 * STEP * speedK;
  }

  // Ghép lại vector vận tốc theo hướng MỚI
  const cos2 = Math.cos(car.heading);
  const sin2 = Math.sin(car.heading);
  car.vx = cos2 * vF - sin2 * vL;
  car.vy = sin2 * vF + cos2 * vL;

  car.x += car.vx * STEP;
  car.y += car.vy * STEP;

  // Bám mép đường: đẩy về trong + trượt dọc tường
  const near = nearestSample(track, car.x, car.y, car.si);
  const prevSi = car.si;
  car.si = near.idx;
  const limit = HALF_W - CAR_R;
  car.wallContact = false;
  if (near.dist > limit) {
    const c = track.pts[car.si];
    let nx = (car.x - c[0]) / (near.dist || 1);
    let ny = (car.y - c[1]) / (near.dist || 1);
    car.x = c[0] + nx * limit;
    car.y = c[1] + ny * limit;
    const vn = car.vx * nx + car.vy * ny;
    if (vn > 0) {
      car.vx -= nx * vn * 1.22;
      car.vy -= ny * vn * 1.22;
      if (vn > 190) {
        ev.hardWall = true;
      }
    }
    // ma sát tường nhẹ — vẫn tiến được khi cà mép
    car.vx *= 1 - 0.6 * STEP;
    car.vy *= 1 - 0.6 * STEP;
    car.wallContact = true;
    ev.wallScrape = true;
  }

  // Tiến độ liên tục theo mẫu (xử lý wrap)
  let d = car.si - prevSi;
  if (d > track.count / 2) d -= track.count;
  if (d < -track.count / 2) d += track.count;
  car.trackPos += d;

  car.speed = Math.hypot(car.vx, car.vy);
  car.lateral = vL;
  car.drifting = inputs.drift && Math.abs(vL) > 70 && car.speed > 150;
  car.driftDir = Math.sign(vL);

  void race;
  return ev;
}

/* ---------------- Xe cản (traffic) ---------------- */

function createTraffic(track, n = 4) {
  const cars = [];
  for (let i = 0; i < n; i++) {
    const si = Math.round(((i + 1) * track.count) / (n + 1.3)) % track.count;
    cars.push({
      pos: si, // chỉ số mẫu (float)
      lane: (i % 2 === 0 ? 1 : -1) * (18 + (i * 9) % 26),
      speed: 120 + (i * 37) % 65, // px/s
      x: 0, y: 0, angle: 0,
      hitCooldown: 0,
    });
  }
  return cars;
}

function stepTraffic(traffic, track, car) {
  let collided = false;
  for (const t of traffic) {
    t.pos = (t.pos + (t.speed * STEP) / track.avgStep) % track.count;
    const i = Math.floor(t.pos);
    const n = track.normals[i];
    t.x = track.pts[i][0] + n[0] * t.lane;
    t.y = track.pts[i][1] + n[1] * t.lane;
    t.angle = Math.atan2(track.tangents[i][1], track.tangents[i][0]);
    if (t.hitCooldown > 0) t.hitCooldown -= STEP;

    const dx = car.x - t.x;
    const dy = car.y - t.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 30 && t.hitCooldown <= 0) {
      t.hitCooldown = 0.8;
      collided = true;
      const nx = dx / (dist || 1);
      const ny = dy / (dist || 1);
      car.x = t.x + nx * 31;
      car.y = t.y + ny * 31;
      car.vx = car.vx * 0.42 + nx * 130;
      car.vy = car.vy * 0.42 + ny * 130;
    }
  }
  return collided;
}

exports.createCar = createCar; exports.stepCar = stepCar; exports.createTraffic = createTraffic; exports.stepTraffic = stepTraffic; exports.STEP = STEP;
};
__defs["games/neon-drift/render.js"] = function (exports, __req) {
/**
 * render.js — vẽ thế giới Neon Drift 404: thành phố neon tối, mặt đường
 * asphalt với 2 mép phát sáng hồng/cyan, vạch giữa đứt, chevron chỉ
 * hướng, cổng CHECKPOINT lime, pickup lục giác năng lượng, xe người
 * chơi cyan-hồng với vệt drift, xe cản vàng, minimap góc trái.
 */

const { TRACK_WIDTH, HALF_W } = __req("games/neon-drift/track.js");

const ROAD = "#131120";
const ROAD_EDGE_PINK = "#ff2ee6";
const ROAD_EDGE_CYAN = "#20e3ff";
const LIME = "#a8ff3e";

const STATIC_SCALE = 1.6;

function createDriftRenderer(canvas, container, track) {
  const g = canvas.getContext("2d");
  let dpr = 1;
  let W = 0;
  let H = 0;
  let staticLayer = null;
  let staticW = 0;
  let staticH = 0;

  function fit() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = container.clientWidth;
    H = container.clientHeight;
    canvas.width = Math.max(1, Math.round(W * dpr));
    canvas.height = Math.max(1, Math.round(H * dpr));
  }

  function zoom() {
    // Zoom sát như ảnh reference: mặt đường chiếm ~1/3 chiều cao màn hình
    return Math.max(1.1, Math.min(2.0, Math.min(W, H) / 480));
  }

  /* ---------- lớp TĨNH pre-render (decor + đường + mép neon + mũi tên) ----------
     Vẽ một lần vào offscreen canvas — mỗi frame chỉ drawImage, giữ 60 FPS. */

  function buildStatic() {
    staticW = track.bbox.maxX + 90;
    staticH = track.bbox.maxY + 90;
    staticLayer = document.createElement("canvas");
    staticLayer.width = Math.round(staticW * STATIC_SCALE);
    staticLayer.height = Math.round(staticH * STATIC_SCALE);
    const s = staticLayer.getContext("2d");
    s.scale(STATIC_SCALE, STATIC_SCALE);

    // decor thành phố
    for (const b of track.decor) {
      s.fillStyle = "#0d0a20";
      s.fillRect(b.x, b.y, b.w, b.h);
      s.strokeStyle = b.color;
      s.globalAlpha = 0.5;
      s.lineWidth = 2;
      s.strokeRect(b.x, b.y, b.w, b.h);
      s.globalAlpha = 0.38;
      s.fillStyle = b.color;
      if (b.vertical) {
        for (let i = 0; i < b.windows; i++) {
          const wx = b.x + 10 + (i * (b.w - 20)) / Math.max(1, b.windows - 1);
          s.fillRect(wx - 2, b.y + 8, 4, b.h - 16);
        }
      } else {
        for (let i = 0; i < b.windows; i++) {
          const wy = b.y + 10 + (i * (b.h - 20)) / Math.max(1, b.windows - 1);
          s.fillRect(b.x + 8, wy - 2, b.w - 16, 4);
        }
      }
      s.globalAlpha = 1;
    }

    // mặt đường + mép glow
    s.lineJoin = "round";
    s.lineCap = "round";
    s.strokeStyle = ROAD;
    s.lineWidth = TRACK_WIDTH;
    s.stroke(track.paths.road);
    s.strokeStyle = "rgba(255,255,255,0.03)";
    s.lineWidth = TRACK_WIDTH - 26;
    s.stroke(track.paths.road);
    s.lineWidth = 9;
    s.strokeStyle = "rgba(255,46,230,0.28)";
    s.stroke(track.paths.edgeL);
    s.lineWidth = 3;
    s.strokeStyle = ROAD_EDGE_PINK;
    s.stroke(track.paths.edgeL);
    s.lineWidth = 9;
    s.strokeStyle = "rgba(32,227,255,0.26)";
    s.stroke(track.paths.edgeR);
    s.lineWidth = 3;
    s.strokeStyle = ROAD_EDGE_CYAN;
    s.stroke(track.paths.edgeR);

    // mũi tên chỉ hướng
    for (const a of track.arrows) {
      s.save();
      s.translate(a.x, a.y);
      s.rotate(a.angle);
      s.fillStyle = "rgba(32,227,255,0.5)";
      for (let k = 0; k < 2; k++) {
        s.beginPath();
        s.moveTo(k * 14 - 4, -10);
        s.lineTo(k * 14 + 8, 0);
        s.lineTo(k * 14 - 4, 10);
        s.lineTo(k * 14, 0);
        s.closePath();
        s.fill();
      }
      s.restore();
    }
  }

  function drawDashes(time) {
    g.strokeStyle = "rgba(240,244,255,0.5)";
    g.lineWidth = 4;
    g.lineJoin = "round";
    g.setLineDash([26, 34]);
    g.lineDashOffset = -time * 40;
    g.stroke(track.paths.road);
    g.setLineDash([]);
  }

  function drawGate(cp, state, time) {
    // state: "next" | "done" | "idle"
    const i = cp.si;
    const p = track.pts[i];
    const n = track.normals[i];
    const lx = p[0] + n[0] * (HALF_W + 8);
    const ly = p[1] + n[1] * (HALF_W + 8);
    const rx = p[0] - n[0] * (HALF_W + 8);
    const ry = p[1] - n[1] * (HALF_W + 8);
    const color = state === "next" ? LIME : state === "done" ? "rgba(120,140,190,0.5)" : "#9a5cff";
    const glow = state === "next" ? 0.9 + Math.sin(time * 5) * 0.1 : 0.55;

    // vạch ngang đường
    g.strokeStyle = color;
    g.globalAlpha = state === "next" ? 0.75 : 0.3;
    g.lineWidth = state === "next" ? 7 : 4;
    g.setLineDash(state === "next" ? [16, 10] : [8, 12]);
    g.beginPath();
    g.moveTo(lx, ly);
    g.lineTo(rx, ry);
    g.stroke();
    g.setLineDash([]);
    g.globalAlpha = 1;

    // hai trụ cổng
    for (const [px, py] of [[lx, ly], [rx, ry]]) {
      g.fillStyle = "#151230";
      g.fillRect(px - 9, py - 24, 18, 34);
      g.strokeStyle = color;
      g.globalAlpha = glow;
      g.lineWidth = 2;
      g.strokeRect(px - 9, py - 24, 18, 34);
      g.globalAlpha = 1;
      g.fillStyle = color;
      g.globalAlpha = glow;
      g.beginPath();
      g.moveTo(px - 4, py - 16);
      g.lineTo(px + 5, py - 10);
      g.lineTo(px - 4, py - 4);
      g.closePath();
      g.fill();
      g.globalAlpha = 1;
    }

    // banner CHECKPOINT (luôn nằm ngang để dễ đọc, như ảnh reference)
    if (state === "next") {
      const mx = (lx + rx) / 2;
      const my = (ly + ry) / 2;
      const label = cp.order === 8 ? "FINISH" : "CHECKPOINT";
      const bw = label.length * 11 + 26;
      g.save();
      g.translate(mx, my - 52);
      g.fillStyle = "rgba(10,14,8,0.92)";
      g.fillRect(-bw / 2, -12, bw, 24);
      g.strokeStyle = LIME;
      g.lineWidth = 2;
      g.strokeRect(-bw / 2, -12, bw, 24);
      g.fillStyle = LIME;
      g.font = "800 15px 'JetBrains Mono', monospace";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.shadowColor = LIME;
      g.shadowBlur = 12;
      g.fillText(label, 0, 1);
      g.shadowBlur = 0;
      // hai chân nối xuống trụ
      g.strokeStyle = "rgba(168,255,62,0.5)";
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(lx - mx, 52 - 24);
      g.lineTo(-bw / 2 + 8, 12);
      g.moveTo(rx - mx, 52 - 24);
      g.lineTo(bw / 2 - 8, 12);
      g.stroke();
      g.restore();
    }
  }

  function drawPickup(p, time) {
    if (p.taken) return;
    const bob = Math.sin(time * 3 + p.pulse) * 3;
    const r = 16 + Math.sin(time * 4 + p.pulse) * 1.5;
    g.save();
    g.translate(p.x, p.y + bob);
    g.fillStyle = "rgba(28,46,8,0.92)";
    const hex = (rr) => {
      g.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const x = Math.cos(a) * rr;
        const y = Math.sin(a) * rr;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.closePath();
    };
    // glow rẻ: viền dày mờ thay cho shadowBlur
    g.strokeStyle = "rgba(168,255,62,0.28)";
    g.lineWidth = 8;
    hex(r);
    g.stroke();
    g.strokeStyle = LIME;
    g.lineWidth = 3;
    hex(r);
    g.fill();
    g.stroke();
    // tia sét
    g.fillStyle = LIME;
    g.beginPath();
    g.moveTo(2, -9);
    g.lineTo(-5, 2);
    g.lineTo(-0.5, 2);
    g.lineTo(-2, 9);
    g.lineTo(5, -2);
    g.lineTo(0.5, -2);
    g.closePath();
    g.fill();
    g.restore();
  }

  function drawTrafficCar(t) {
    g.save();
    g.translate(t.x, t.y);
    g.rotate(t.angle);
    g.fillStyle = "rgba(0,0,0,0.4)";
    g.beginPath();
    g.ellipse(0, 3, 20, 12, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#e8b616";
    g.beginPath();
    g.roundRect(-18, -10, 36, 20, 6);
    g.fill();
    g.fillStyle = "#1a1406";
    g.beginPath();
    g.roundRect(-6, -8, 14, 16, 4);
    g.fill();
    g.fillStyle = "#fff2b0";
    g.fillRect(15, -8, 4, 5);
    g.fillRect(15, 3, 4, 5);
    g.fillStyle = "#b3140a";
    g.fillRect(-19, -8, 3, 5);
    g.fillRect(-19, 3, 3, 5);
    // tam giác cảnh báo trên nóc
    g.fillStyle = "#241c04";
    g.beginPath();
    g.moveTo(-13, 6);
    g.lineTo(-5, 6);
    g.lineTo(-9, -1);
    g.closePath();
    g.fill();
    g.restore();
  }

  function drawPlayerCar(car, time) {
    g.save();
    g.translate(car.x, car.y);
    g.rotate(car.heading + car.steerVisual * 0.1);
    // bóng + underglow hồng
    g.shadowColor = "#ff2ee6";
    g.shadowBlur = 18;
    g.fillStyle = "rgba(255,46,230,0.32)";
    g.beginPath();
    g.ellipse(0, 0, 22, 13, 0, 0, Math.PI * 2);
    g.fill();
    g.shadowBlur = 0;
    // thân xe
    g.fillStyle = "#dfe8ff";
    g.beginPath();
    g.roundRect(-19, -10, 38, 20, 7);
    g.fill();
    // mui + kính
    g.fillStyle = "#0b1226";
    g.beginPath();
    g.roundRect(-4, -7.5, 13, 15, 5);
    g.fill();
    // sọc cyan
    g.fillStyle = "#20e3ff";
    g.fillRect(-19, -10, 30, 2.6);
    g.fillRect(-19, 7.4, 30, 2.6);
    // mũi hồng
    g.fillStyle = "#ff2ee6";
    g.beginPath();
    g.roundRect(12, -9, 7, 18, 3);
    g.fill();
    // đèn pha
    g.fillStyle = "#eafcff";
    g.fillRect(17, -8, 3, 4.6);
    g.fillRect(17, 3.4, 3, 4.6);
    // đèn hậu
    g.fillStyle = "#ff3b57";
    g.fillRect(-20, -8, 3, 4.6);
    g.fillRect(-20, 3.4, 3, 4.6);
    // lửa nitro
    if (car.nitroActive) {
      const f = 10 + Math.sin(time * 40) * 4;
      g.fillStyle = "rgba(32,227,255,0.9)";
      g.beginPath();
      g.moveTo(-20, -4);
      g.lineTo(-20 - f, 0);
      g.lineTo(-20, 4);
      g.closePath();
      g.fill();
      g.fillStyle = "rgba(255,255,255,0.9)";
      g.beginPath();
      g.moveTo(-20, -2);
      g.lineTo(-20 - f * 0.55, 0);
      g.lineTo(-20, 2);
      g.closePath();
      g.fill();
    }
    g.restore();
  }

  function drawTrails(trails) {
    // vệt drift: các đoạn nối tiếp mờ dần (hồng → cyan theo tuổi)
    for (const tr of trails) {
      const a = Math.max(0, tr.life);
      if (a <= 0) continue;
      g.strokeStyle = tr.nitro
        ? `rgba(32,227,255,${0.5 * a})`
        : `rgba(255,46,230,${0.55 * a})`;
      g.lineWidth = 5 * a + 1;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(tr.x0, tr.y0);
      g.lineTo(tr.x1, tr.y1);
      g.stroke();
    }
  }

  function drawSparks(sparks) {
    for (const s of sparks) {
      if (s.life <= 0) continue;
      g.fillStyle = `rgba(255,210,80,${s.life})`;
      g.fillRect(s.x - 1.5, s.y - 1.5, 3, 3);
    }
  }

  /* ---------- khung hình chính ---------- */

  function draw(state, time) {
    const { car, cam, traffic, trails, sparks, nextCp, shake } = state;
    if (W === 0) fit();
    if (!staticLayer) buildStatic();
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // nền
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0c0722");
    bg.addColorStop(1, "#060414");
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);

    const z = zoom();
    const sx = shake ? (Math.random() - 0.5) * shake : 0;
    const sy = shake ? (Math.random() - 0.5) * shake : 0;
    g.setTransform(dpr * z, 0, 0, dpr * z, dpr * (W / 2 - (cam.x + sx) * z), dpr * (H / 2 - (cam.y + sy) * z));

    // lưới nền mờ (chỉ vùng nhìn thấy)
    g.strokeStyle = "rgba(90,80,180,0.08)";
    g.lineWidth = 1;
    const gs = 130;
    const halfVW = W / (2 * z) + gs;
    const halfVH = H / (2 * z) + gs;
    const x0 = Math.floor((cam.x - halfVW) / gs) * gs;
    const y0 = Math.floor((cam.y - halfVH) / gs) * gs;
    g.beginPath();
    for (let x = x0; x < cam.x + halfVW; x += gs) {
      g.moveTo(x, y0);
      g.lineTo(x, cam.y + halfVH);
    }
    for (let y = y0; y < cam.y + halfVH; y += gs) {
      g.moveTo(x0, y);
      g.lineTo(cam.x + halfVH, y);
    }
    g.stroke();

    // lớp tĩnh pre-render (decor + đường + mép + mũi tên)
    g.drawImage(staticLayer, 0, 0, staticW, staticH);
    drawDashes(time);

    for (const cp of track.checkpoints) {
      const st = cp.order === nextCp ? "next" : cp.order < nextCp ? "done" : "idle";
      drawGate(cp, st, time);
    }
    for (const p of track.pickups) drawPickup(p, time);
    drawTrails(trails);
    for (const t of traffic) drawTrafficCar(t);
    drawSparks(sparks);
    drawPlayerCar(car, time);
  }

  return { fit, draw, get size() { return { W, H }; } };
}

/* ---------------- Minimap (canvas nhỏ góc trái như ảnh) ---------------- */

function createMinimap(canvas, track) {
  const g = canvas.getContext("2d");
  const CW = 128;
  const CH = 92;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = CW * dpr;
  canvas.height = CH * dpr;

  const { minX, minY, maxX, maxY } = track.bbox;
  const s = Math.min((CW - 16) / (maxX - minX), (CH - 16) / (maxY - minY));
  const ox = (CW - (maxX - minX) * s) / 2 - minX * s;
  const oy = (CH - (maxY - minY) * s) / 2 - minY * s;
  const mx = (x) => x * s + ox;
  const my = (y) => y * s + oy;

  const outline = new Path2D();
  outline.moveTo(mx(track.pts[0][0]), my(track.pts[0][1]));
  for (let i = 1; i < track.count; i += 3) outline.lineTo(mx(track.pts[i][0]), my(track.pts[i][1]));
  outline.closePath();

  function draw(car, traffic, nextCp, time) {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, CW, CH);
    g.strokeStyle = "rgba(255,46,230,0.9)";
    g.lineWidth = 2.4;
    g.stroke(outline);
    // checkpoint kế tiếp nhấp nháy lime
    for (const cp of track.checkpoints) {
      const p = track.pts[cp.si];
      if (cp.order === nextCp) {
        g.fillStyle = `rgba(168,255,62,${0.6 + Math.sin(time * 6) * 0.4})`;
        g.beginPath();
        g.arc(mx(p[0]), my(p[1]), 3.4, 0, Math.PI * 2);
        g.fill();
      } else {
        g.fillStyle = cp.order < nextCp ? "rgba(120,140,190,0.5)" : "rgba(154,92,255,0.7)";
        g.fillRect(mx(p[0]) - 1.5, my(p[1]) - 1.5, 3, 3);
      }
    }
    for (const t of traffic) {
      g.fillStyle = "#e8b616";
      g.fillRect(mx(t.x) - 1.5, my(t.y) - 1.5, 3, 3);
    }
    g.save();
    g.shadowColor = "#4df77f";
    g.shadowBlur = 6;
    g.fillStyle = "#4df77f";
    g.beginPath();
    g.arc(mx(car.x), my(car.y), 4, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  return { draw };
}

exports.createDriftRenderer = createDriftRenderer; exports.createMinimap = createMinimap;
};
__defs["games/neon-drift/styles.js"] = function (exports, __req) {
/**
 * styles.js — CSS riêng Neon Drift 404: panel minimap góc trái trên và
 * cụm nút cảm ứng ◀ ▶ + NITRO tròn góc phải dưới (theo ảnh reference,
 * nút ≥ 44px, touch-action none để không cuộn trang).
 */

const ND_CSS = /* css */ `
.nd-minimap {
  position: absolute;
  top: 14px;
  left: 14px;
  z-index: 20;
  padding: 7px;
  border: 1px solid color-mix(in srgb, var(--cyan) 40%, transparent);
  border-radius: 12px;
  background: rgba(6, 9, 24, 0.82);
  box-shadow: 0 0 18px rgba(32, 227, 255, 0.12);
  pointer-events: none;
}

.nd-minimap canvas {
  width: 128px;
  height: 92px;
  display: block;
}

.nd-touch {
  position: absolute;
  right: 16px;
  bottom: 16px;
  z-index: 25;
  display: none;
  align-items: center;
  gap: 12px;
}

.exp-root[data-touch="1"] .nd-touch { display: flex; }

.nd-steer {
  width: 74px;
  height: 74px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid color-mix(in srgb, var(--cyan) 55%, transparent);
  clip-path: polygon(16px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%, 0 16px);
  background: rgba(8, 12, 30, 0.78);
  color: var(--text-0);
  font-size: 1.5rem;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  cursor: pointer;
}

.nd-steer:active,
.nd-steer.held {
  background: color-mix(in srgb, var(--cyan) 22%, rgba(8, 12, 30, 0.8));
  color: var(--cyan);
}

.nd-nitro {
  width: 96px;
  height: 96px;
  margin-left: 8px;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  border-radius: 50%;
  border: 2px solid var(--cyan);
  background: radial-gradient(circle at 50% 36%, rgba(32, 227, 255, 0.25), rgba(8, 12, 30, 0.9) 68%);
  color: var(--cyan);
  font-family: inherit;
  font-size: 0.66rem;
  font-weight: 800;
  letter-spacing: 0.18em;
  box-shadow: 0 0 22px rgba(32, 227, 255, 0.3);
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  cursor: pointer;
}

.nd-nitro svg { width: 26px; height: 26px; }

.nd-nitro:active,
.nd-nitro.held {
  background: radial-gradient(circle at 50% 36%, rgba(32, 227, 255, 0.5), rgba(8, 12, 30, 0.92) 70%);
  box-shadow: 0 0 34px rgba(32, 227, 255, 0.55);
}

.nd-nitro[data-empty] { opacity: 0.45; }

@media (max-width: 700px) {
  .nd-minimap canvas { width: 96px; height: 69px; }
}
`;

exports.ND_CSS = ND_CSS;
};
__defs["games/cyber-defense/index.js"] = function (exports, __req) {
/**
 * Cyber Defense — tower defense bảo vệ lõi CORE (game 8).
 *
 * Theo plan + ảnh reference: cụm nút hệ thống BÊN TRÁI, tiêu đề giữa,
 * WAVE / CORE % / NĂNG LƯỢNG / ĐIỂM bên phải; bot chạy theo 2 tuyến
 * cố định; 14 pad xây; 3 tháp mở sẵn + 2 tháp khóa wave 6/8 (đúng 2 ô
 * khóa trong ảnh); chọn tháp hiện range circle + panel nâng cấp 3 cấp /
 * bán hoàn 70%; 8 wave data-driven; thắng sau wave 8, thua khi CORE = 0.
 */

const { createExpansionFrame } = __req("games/_shared/frame.js");
const { createKeyboard } = __req("core/input-manager.js");
const { createLoop } = __req("core/loop.js");
const { createCanvas } = __req("core/canvas.js");
const { el, svgIcon, formatScore } = __req("core/utils.js");
const { WORLD_W, WORLD_H, TOWERS, TOWER_ORDER, CORE } = __req("games/cyber-defense/data.js");
const { createSim } = __req("games/cyber-defense/engine.js");
const { createDefenseRenderer, paintTowerIcon } = __req("games/cyber-defense/render.js");
const { CD_CSS } = __req("games/cyber-defense/styles.js");

const SFX_THROTTLE = { zap: 0.09, shoot: 0.09, kill: 0.12, hit: 0.2 };

function createGame() {
  let ctx = null;
  let frame = null;
  let sim = null;
  let renderer = null;
  let view = null;
  let keys = null;
  let loop = null;
  let panelEl = null;
  let prepEl = null;
  let mmCanvas = null;
  let mmCtx = null;
  let mmStatic = null;
  let slots = [];

  const TEST = typeof window !== "undefined" && window.__ARCADE_EXP5_TEST__;

  let mode = "intro"; // intro | play | paused | over
  let time = 0;
  let stateT = 0;
  const ui = { buildType: null, selectedId: null, hoverPad: null, canPlace: false };
  const sfxLast = {};

  /* ---------------- SFX có throttle ---------------- */

  function sfx(name, key = name) {
    const min = SFX_THROTTLE[key] || 0;
    if (min > 0) {
      if (time - (sfxLast[key] || -9) < min) return;
      sfxLast[key] = time;
    }
    ctx.audio.play(name);
  }

  /* ---------------- HUD ---------------- */

  function updateHud() {
    const waveShow = Math.max(1, sim.wave + (sim.phase === "prep" ? 1 : 0));
    frame.setStat("wave", `${String(Math.min(8, waveShow)).padStart(2, "0")}/08`);
    const pct = Math.round((sim.core / sim.coreMax) * 100);
    frame.setStat("core", `${pct}%`);
    frame.setStatBar("core", pct);
    frame.setStat("energy", String(Math.floor(sim.energy)));
    frame.setStat("score", formatScore(sim.score));
    const coreBox = frame.statBox("core")?.querySelector(".val");
    if (coreBox) coreBox.style.color = pct <= 40 ? "var(--red)" : "";
  }

  /* ---------------- Build bar ---------------- */

  function refreshSlots() {
    for (const s of slots) {
      const def = TOWERS[s.type];
      const unlocked = sim.wave + (sim.phase === "prep" ? 1 : 0) >= def.unlockWave;
      s.el.classList.toggle("locked", !unlocked);
      s.el.classList.toggle("armed", ui.buildType === s.type);
      s.lockEl.style.display = unlocked ? "none" : "";
      s.iconEl.style.visibility = unlocked ? "" : "hidden";
      s.costEl.textContent = unlocked ? `${def.cost}⚡` : "";
      s.waveTag.textContent = unlocked ? "" : `WAVE ${String(def.unlockWave).padStart(2, "0")}`;
      if (unlocked && sim.energy < def.cost) s.el.dataset.poor = "1";
      else delete s.el.dataset.poor;
    }
  }

  function armBuild(type) {
    if (mode !== "play") return;
    const def = TOWERS[type];
    const unlocked = sim.wave + (sim.phase === "prep" ? 1 : 0) >= def.unlockWave;
    if (!unlocked) {
      frame.toast(`MỞ KHÓA Ở WAVE ${String(def.unlockWave).padStart(2, "0")}`);
      ctx.audio.play("denied");
      return;
    }
    if (ui.buildType === type) {
      ui.buildType = null;
    } else {
      ui.buildType = type;
      ui.selectedId = null;
      renderPanel();
    }
    ctx.audio.play("ui");
    refreshSlots();
  }

  /* ---------------- Panel tháp ---------------- */

  function pips(target, value, max, gain = 0) {
    const box = el("div", "cd-pips");
    for (let i = 0; i < 10; i++) {
      const p = el("i");
      const th = ((i + 1) / 10) * max;
      if (value >= th) p.classList.add("on");
      else if (value + gain >= th) p.classList.add("gain");
      box.appendChild(p);
    }
    target.appendChild(box);
  }

  function renderPanel() {
    panelEl.textContent = "";
    const t = sim.towers.find((x) => x.id === ui.selectedId);
    if (!t) {
      panelEl.hidden = true;
      return;
    }
    panelEl.hidden = false;
    const def = TOWERS[t.type];
    const st = sim.stats(t);
    const next = t.level < def.levels.length - 1 ? def.levels[t.level + 1] : null;

    const inBox = el("div", "in");
    inBox.appendChild(el("h3", "", def.name));

    const lv = el("div", "cd-lv");
    const cur = el("span");
    cur.appendChild(document.createTextNode("CẤP "));
    cur.appendChild(el("b", "", String(t.level + 1)));
    lv.appendChild(cur);
    if (next) {
      lv.appendChild(el("span", "arrow", "»"));
      lv.appendChild(el("span", "next", `CẤP ${t.level + 2}`));
    } else {
      lv.appendChild(el("span", "next", "TỐI ĐA"));
    }
    inBox.appendChild(lv);

    const mkStat = (label, value, max, gain, text) => {
      const box = el("div", "cd-stat");
      const lbl = el("div", "lbl");
      lbl.appendChild(el("span", "", label));
      lbl.appendChild(el("span", "", text));
      box.appendChild(lbl);
      pips(box, value, max, gain);
      inBox.appendChild(box);
    };
    mkStat("TỐC ĐỘ", st.rate, 5, next ? next.rate - st.rate : 0, `${st.rate.toFixed(1)}/s`);
    mkStat("SÁT THƯƠNG", st.dmg, 140, next ? next.dmg - st.dmg : 0, String(st.dmg));
    mkStat("TẦM BẮN", st.range, 380, next ? next.range - st.range : 0, String(st.range));

    const upBtn = el("button", "cd-upgrade");
    upBtn.type = "button";
    if (next) {
      upBtn.textContent = `NÂNG CẤP ⚡${next.cost}`;
      upBtn.disabled = sim.energy < next.cost;
    } else {
      upBtn.textContent = "ĐÃ TỐI ĐA";
      upBtn.disabled = true;
    }
    upBtn.addEventListener("click", () => {
      const r = sim.upgrade(t.id);
      if (r.ok) {
        sfx("upgrade");
        renderPanel();
        updateHud();
      } else {
        ctx.audio.play("denied");
      }
    });
    inBox.appendChild(upBtn);

    const sellBtn = el("button", "cd-sell", `BÁN +${sim.sellValue(t)}⚡`);
    sellBtn.type = "button";
    sellBtn.addEventListener("click", () => {
      sim.sell(t.id);
      sfx("sell");
      ui.selectedId = null;
      renderPanel();
      updateHud();
      refreshSlots();
    });
    inBox.appendChild(sellBtn);

    panelEl.appendChild(inBox);
  }

  /* ---------------- Minimap ---------------- */

  function buildMinimapStatic() {
    mmStatic = document.createElement("canvas");
    mmStatic.width = 300;
    mmStatic.height = 172;
    const s = mmStatic.getContext("2d");
    s.scale(300 / WORLD_W, 172 / WORLD_H);
    s.lineCap = "round";
    s.lineJoin = "round";
    for (const lane of [sim.paths.A, sim.paths.B]) {
      s.strokeStyle = "rgba(47,123,255,0.9)";
      s.lineWidth = 16;
      s.beginPath();
      s.moveTo(lane.nodes[0][0], lane.nodes[0][1]);
      for (let i = 1; i < lane.nodes.length; i++) s.lineTo(lane.nodes[i][0], lane.nodes[i][1]);
      s.stroke();
    }
    s.fillStyle = "#ff4fd8";
    for (const lane of [sim.paths.A, sim.paths.B]) {
      s.beginPath();
      s.arc(lane.nodes[0][0] + 20, lane.nodes[0][1], 14, 0, Math.PI * 2);
      s.fill();
    }
  }

  function drawMinimap() {
    if (!mmCtx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (mmCanvas.width !== 150 * dpr) {
      mmCanvas.width = 150 * dpr;
      mmCanvas.height = 86 * dpr;
    }
    mmCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mmCtx.clearRect(0, 0, 150, 86);
    mmCtx.drawImage(mmStatic, 0, 0, 150, 86);
    const sx = 150 / WORLD_W;
    const sy = 86 / WORLD_H;
    for (const t of sim.towers) {
      mmCtx.fillStyle = TOWERS[t.type].color;
      mmCtx.fillRect(t.x * sx - 2, t.y * sy - 2, 4, 4);
    }
    mmCtx.save();
    mmCtx.shadowColor = "#20e3ff";
    mmCtx.shadowBlur = 5;
    mmCtx.fillStyle = "#20e3ff";
    mmCtx.beginPath();
    mmCtx.arc(CORE.x * sx, CORE.y * sy, 4, 0, Math.PI * 2);
    mmCtx.fill();
    mmCtx.restore();
  }

  /* ---------------- Vòng đời trận ---------------- */

  function startMatch() {
    sim = createSim({ test: TEST });
    ui.buildType = null;
    ui.selectedId = null;
    mode = "play";
    frame.clearScreen();
    frame.setPaused(false);
    ctx.onMatchStart();
    ctx.audio.play("start");
    buildMinimapStatic();
    refreshSlots();
    renderPanel();
    updateHud();
    loop.start();
  }

  function endMatch(victory) {
    mode = "over";
    const saved = ctx.onGameOver(sim.score, { wave: sim.wave, kills: sim.kills, core: sim.core });
    frame.overScreen({
      kicker: victory ? "// PHÒNG THỦ THÀNH CÔNG" : "// LÕI SỤP ĐỔ",
      heading: victory ? "HỆ THỐNG AN TOÀN!" : "CORE BỊ PHÁ HỦY!",
      score: sim.score,
      saved,
      statCards: [
        { label: "WAVE", value: `${sim.wave}/8`, color: "cyan" },
        { label: "BOT ĐÃ HẠ", value: sim.kills, color: "pink" },
        { label: "CORE CÒN LẠI", value: `${Math.round((sim.core / sim.coreMax) * 100)}%`, color: victory ? "green" : "red" },
        { label: "NĂNG LƯỢNG DƯ", value: Math.floor(sim.energy), color: "gold" },
      ],
      restartLabel: "CHƠI LẠI",
      onRestart: () => startMatch(),
    });
  }

  function pauseGame() {
    if (mode !== "play") return;
    mode = "paused";
    loop.stop();
    frame.setPaused(true);
    frame.pauseMenu({
      onResume: () => resumeGame(),
      onRestart: () => startMatch(),
      buildExtra: (box) => {
        const row = el("div", "exp-setrow");
        row.appendChild(el("span", "", "TIẾN ĐỘ"));
        row.appendChild(el("span", "val", `WAVE ${sim.wave}/8 · CORE ${Math.round((sim.core / sim.coreMax) * 100)}%`));
        box.appendChild(row);
      },
    });
  }

  function resumeGame() {
    if (mode !== "paused") return;
    mode = "play";
    frame.clearScreen();
    frame.setPaused(false);
    loop.start();
  }

  function togglePause() {
    if (mode === "play") {
      if (ui.buildType) {
        // Esc hủy chế độ xây trước
        ui.buildType = null;
        refreshSlots();
        return;
      }
      pauseGame();
    } else if (mode === "paused") resumeGame();
  }

  /* ---------------- Sự kiện sim → SFX/FX ---------------- */

  function handleEvents(events) {
    renderer.addEvents(events, time);
    for (const e of events) {
      switch (e.type) {
        case "wave":
          frame.banner(`WAVE ${String(e.wave).padStart(2, "0")}`);
          ctx.audio.play("wave");
          refreshSlots();
          break;
        case "waveclear":
          frame.toast(`WAVE ${e.wave} SẠCH — +${e.bonus}⚡`);
          ctx.audio.play("combo");
          refreshSlots();
          break;
        case "shoot":
          sfx("zap", "shoot");
          break;
        case "zap":
          sfx("zap");
          break;
        case "boom":
          ctx.audio.play("boom");
          break;
        case "kill":
          sfx("kill");
          break;
        case "corehit":
          ctx.audio.play("corehit");
          break;
        case "victory":
          ctx.audio.play("win");
          endMatch(true);
          break;
        case "defeat":
          ctx.audio.play("over");
          endMatch(false);
          break;
      }
    }
  }

  /* ---------------- Vòng lặp ---------------- */

  function update(dt) {
    time += dt;
    if (mode === "play") {
      // TEST: bù throttle rAF của headless SwiftShader để QA nhanh hơn
      sim.update(TEST ? dt * 2 : dt);
      handleEvents(sim.drainEvents());
      updateHud();
      // chip đếm ngược wave
      if (sim.phase === "prep") {
        prepEl.hidden = false;
        prepEl.textContent = `WAVE ${String(Math.min(8, sim.wave + 1)).padStart(2, "0")} SAU ${Math.ceil(sim.prepT)}s`;
      } else {
        prepEl.hidden = true;
      }
      // trạng thái nút panel theo năng lượng
      if (!panelEl.hidden) {
        const t = sim.towers.find((x) => x.id === ui.selectedId);
        if (!t) {
          ui.selectedId = null;
          renderPanel();
        } else {
          const btn = panelEl.querySelector(".cd-upgrade");
          const cost = sim.upgradeCost(t);
          if (btn && cost !== null) btn.disabled = sim.energy < cost;
        }
      }
      if (TEST) {
        stateT += dt;
        if (stateT > 0.4) {
          stateT = 0;
          window.__CD_STATE__ = {
            mode, wave: sim.wave, phase: sim.phase, core: sim.core,
            energy: Math.floor(sim.energy), score: sim.score, kills: sim.kills,
            towers: sim.towers.length, enemies: sim.enemies.length,
          };
        }
      }
    }
    renderer.draw(sim, ui, time);
    drawMinimap();
  }

  /* ---------------- Intro ---------------- */

  function showIntro() {
    mode = "intro";
    loop.stop();
    frame.intro({
      kicker: "// GIAO THỨC PHÒNG THỦ",
      heading: [["CYBER ", "cyan"], ["DEFENSE", ""]],
      goal:
        "Bot độc hại tràn vào bảng mạch theo 2 tuyến cố định. Xây tháp trên các pad, nâng cấp tới 3 cấp và chặn đứng 8 WAVE trước khi chúng chạm tới lõi CORE. Bắt đầu với 400⚡ năng lượng.",
      rows: [
        { keys: ["Click"], text: "chọn tháp ở thanh dưới → click pad để xây" },
        { keys: ["1", "2", "3", "4", "5"], text: "chọn nhanh loại tháp" },
        { keys: ["Click"], text: "click tháp đã xây: xem tầm bắn, NÂNG CẤP / BÁN" },
        { keys: ["ESC"], text: "hủy chế độ xây / tạm dừng" },
      ],
      startLabel: "KÍCH HOẠT PHÒNG THỦ",
      onStart: () => startMatch(),
    });
    renderer.draw(sim, ui, 0);
  }

  /* ---------------- Interface ---------------- */

  return {
    async mount(container, context) {
      ctx = context;

      const rootNode = container.getRootNode();
      if (rootNode instanceof ShadowRoot && !rootNode.querySelector("#cd-style")) {
        const style = document.createElement("style");
        style.id = "cd-style";
        style.textContent = CD_CSS;
        rootNode.appendChild(style);
      }

      frame = createExpansionFrame(container, ctx, {
        accent: "cyan",
        title: [["CYBER ", "cyan"], ["DEFENSE", ""]],
        buttonsFirst: true,
        stats: [
          { id: "wave", label: "WAVE", color: "white", value: "01/08" },
          { id: "core", label: "CORE", color: "green", value: "100%", bar: true },
          { id: "energy", label: "NĂNG LƯỢNG", color: "cyan", value: "400" },
          { id: "score", label: "ĐIỂM", color: "cyan", value: "000000" },
        ],
        onPauseToggle: togglePause,
      });

      const stage = el("div", "cd-stage");
      frame.playfield.appendChild(stage);
      view = createCanvas(stage, { width: WORLD_W, height: WORLD_H });
      renderer = createDefenseRenderer(view.ctx, buildPathsForRender());

      function buildPathsForRender() {
        // sim chưa tạo — dựng sim tạm để lấy paths + vẽ intro
        sim = createSim({ test: TEST });
        return sim.paths;
      }

      /* Build bar */
      const bar = el("div", "cd-buildbar");
      slots = TOWER_ORDER.map((type, i) => {
        const def = TOWERS[type];
        const b = el("button", "cd-slot");
        b.type = "button";
        b.setAttribute("aria-label", `${def.name} — ${def.cost} năng lượng`);
        b.appendChild(el("span", "cd-key", String(i + 1)));
        const icon = document.createElement("canvas");
        paintTowerIcon(icon, type);
        b.appendChild(icon);
        const lock = svgIcon("i-close", "cd-lock");
        b.appendChild(lock);
        const cost = el("span", "cost", `${def.cost}⚡`);
        b.appendChild(cost);
        const waveTag = el("span", "wavetag", "");
        b.appendChild(waveTag);
        b.addEventListener("click", () => armBuild(type));
        bar.appendChild(b);
        return { type, el: b, iconEl: icon, lockEl: lock, costEl: cost, waveTag };
      });
      frame.playfield.appendChild(bar);

      /* Panel + prep chip + minimap */
      panelEl = el("aside", "cd-panel");
      panelEl.hidden = true;
      frame.playfield.appendChild(panelEl);
      prepEl = el("div", "cd-prep");
      prepEl.hidden = true;
      frame.playfield.appendChild(prepEl);
      const mmBox = el("div", "cd-minimap");
      mmCanvas = document.createElement("canvas");
      mmBox.appendChild(mmCanvas);
      mmCtx = mmCanvas.getContext("2d");
      frame.playfield.appendChild(mmBox);
      buildMinimapStatic();

      /* Tương tác canvas */
      view.canvas.addEventListener(
        "pointermove",
        (e) => {
          const p = view.pos(e);
          ui.hoverPad = sim.padAt(p.x, p.y);
          if (ui.buildType && ui.hoverPad) {
            ui.canPlace = !sim.towerOnPad(ui.hoverPad.id) && sim.canBuild(ui.buildType).ok;
          }
        },
        { signal: ctx.signal }
      );

      view.canvas.addEventListener(
        "pointerdown",
        (e) => {
          if (mode !== "play") return;
          e.preventDefault();
          const p = view.pos(e);
          if (ui.buildType) {
            const pad = sim.padAt(p.x, p.y);
            if (pad) {
              const existed = sim.towerOnPad(pad.id);
              if (existed) {
                // pad đã có tháp → chuyển sang chọn tháp đó
                ui.buildType = null;
                ui.selectedId = existed.id;
                renderPanel();
                refreshSlots();
                ctx.audio.play("ui");
                return;
              }
              const r = sim.buildAt(pad.id, ui.buildType);
              if (r.ok) {
                sfx("build");
                updateHud();
                refreshSlots();
                if (!sim.canBuild(ui.buildType).ok) {
                  ui.buildType = null;
                  refreshSlots();
                }
              } else {
                ctx.audio.play("denied");
                frame.toast(r.reason === "energy" ? "THIẾU NĂNG LƯỢNG" : "KHÔNG THỂ XÂY");
              }
              return;
            }
            // click ra ngoài pad → hủy chế độ xây
            ui.buildType = null;
            refreshSlots();
            return;
          }
          const t = sim.towerAt(p.x, p.y);
          ui.selectedId = t ? t.id : null;
          if (t) ctx.audio.play("ui");
          renderPanel();
        },
        { signal: ctx.signal }
      );

      keys = createKeyboard({ signal: ctx.signal });
      TOWER_ORDER.forEach((type, i) => {
        keys.on([`Digit${i + 1}`], () => armBuild(type));
      });
      keys.on(["KeyP"], () => togglePause());

      loop = createLoop(update);
      showIntro();
    },

    start() {
      if (mode === "intro") startMatch();
    },

    pause() {
      pauseGame();
    },

    resume() {
      resumeGame();
    },

    restart() {
      if (mode === "intro") return;
      startMatch();
    },

    resize() {},

    destroy() {
      loop?.stop();
      keys?.destroy();
      view?.destroy();
      frame?.destroy();
      frame = null;
      renderer = null;
      sim = null;
      if (typeof window !== "undefined") delete window.__CD_STATE__;
    },
  };
}

exports.createGame = createGame;
};
__defs["games/cyber-defense/data.js"] = function (exports, __req) {
/**
 * data.js — dữ liệu Cyber Defense: 2 tuyến đường cố định (nhập từ mép
 * trái như ảnh reference, hợp nhất trước khi tới CORE), 14 pad xây tháp,
 * 5 loại tháp (3 mở sẵn + 2 khóa theo wave như 2 ô khóa trong ảnh),
 * 4 loại enemy và 8 wave khai báo thuần data.
 */

const WORLD_W = 1280;
const WORLD_H = 720;
const CORE = { x: 1090, y: 300, hp: 20 };

/* Đuôi chung sau điểm hợp nhất (860,340) → CORE */
const TAIL = [
  [860, 340], [1000, 340], [1000, 300], [1062, 300],
];

const LANE_A = [
  [-40, 140], [160, 140], [160, 320], [390, 320], [390, 150],
  [640, 150], [640, 340], [860, 340],
].concat(TAIL.slice(1));

const LANE_B = [
  [-40, 560], [200, 560], [200, 430], [460, 430], [460, 600],
  [700, 600], [700, 430], [860, 430],
].concat(TAIL);

/** Lấy mẫu polyline mỗi ~4px, trả về { pts, step, totalLen, nodes }. */
function samplePath(nodes) {
  const pts = [];
  let totalLen = 0;
  for (let i = 0; i < nodes.length - 1; i++) {
    const [x0, y0] = nodes[i];
    const [x1, y1] = nodes[i + 1];
    const len = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.round(len / 4));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      pts.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]);
    }
    totalLen += len;
  }
  pts.push(nodes[nodes.length - 1].slice());
  return { pts, step: totalLen / (pts.length - 1), totalLen, nodes };
}

function buildPaths() {
  return { A: samplePath(LANE_A), B: samplePath(LANE_B) };
}

/** Vị trí trên path theo quãng đường đã đi. */
function pointAt(path, dist) {
  const i = Math.max(0, Math.min(path.pts.length - 1, Math.floor(dist / path.step)));
  return path.pts[i];
}

const PADS = [
  { id: 0, x: 90, y: 240 },
  { id: 1, x: 280, y: 230 },
  { id: 2, x: 390, y: 60 },
  { id: 3, x: 520, y: 240 },
  { id: 4, x: 760, y: 250 },
  { id: 5, x: 950, y: 180 },
  { id: 6, x: 1080, y: 180 },
  { id: 7, x: 65, y: 450 },
  { id: 8, x: 285, y: 505 },
  { id: 9, x: 530, y: 520 },
  { id: 10, x: 620, y: 470 },
  { id: 11, x: 770, y: 510 },
  { id: 12, x: 950, y: 430 },
  { id: 13, x: 1080, y: 450 },
];

const PAD_R = 30;

/* ---------------- Tháp ---------------- */

const TOWER_ORDER = ["rapid", "slow", "blast", "sniper", "nova"];

const TOWERS = {
  rapid: {
    name: "THÁP TIA NHANH",
    desc: "Bắn nhanh, sát thương đơn mục tiêu.",
    color: "#20e3ff",
    cost: 100,
    unlockWave: 1,
    levels: [
      { dmg: 11, rate: 3.2, range: 150 },
      { dmg: 17, rate: 3.8, range: 162, cost: 80 },
      { dmg: 25, rate: 4.6, range: 176, cost: 130 },
    ],
  },
  slow: {
    name: "THÁP GIẢM TỐC",
    desc: "Phóng điện làm chậm, không cộng dồn vô hạn.",
    color: "#9a5cff",
    cost: 140,
    unlockWave: 1,
    levels: [
      { dmg: 6, rate: 1.15, range: 132, slow: 0.55, slowDur: 1.4 },
      { dmg: 9, rate: 1.3, range: 142, slow: 0.46, slowDur: 1.7, cost: 110 },
      { dmg: 13, rate: 1.45, range: 154, slow: 0.38, slowDur: 2.0, cost: 150 },
    ],
  },
  blast: {
    name: "THÁP NỔ VÙNG",
    desc: "Bắn chậm, nổ sát thương diện rộng.",
    color: "#ff4fd8",
    cost: 160,
    unlockWave: 1,
    levels: [
      { dmg: 26, rate: 0.75, range: 126, aoe: 62 },
      { dmg: 38, rate: 0.82, range: 134, aoe: 74, cost: 130 },
      { dmg: 54, rate: 0.9, range: 142, aoe: 86, cost: 180 },
    ],
  },
  sniper: {
    name: "THÁP XUYÊN TÂM",
    desc: "Tầm cực xa, một phát sát thương lớn.",
    color: "#ffd23f",
    cost: 220,
    unlockWave: 6,
    levels: [
      { dmg: 62, rate: 0.5, range: 300 },
      { dmg: 92, rate: 0.56, range: 330, cost: 160 },
      { dmg: 132, rate: 0.62, range: 364, cost: 220 },
    ],
  },
  nova: {
    name: "THÁP XUNG KÍCH",
    desc: "Xung điện tỏa tròn trúng mọi bot trong tầm.",
    color: "#a8ff3e",
    cost: 260,
    unlockWave: 8,
    levels: [
      { dmg: 18, rate: 0.6, range: 140, aoe: 140, slow: 0.75, slowDur: 0.6 },
      { dmg: 27, rate: 0.66, range: 150, aoe: 150, slow: 0.68, slowDur: 0.8, cost: 180 },
      { dmg: 39, rate: 0.72, range: 162, aoe: 162, slow: 0.6, slowDur: 1.0, cost: 240 },
    ],
  },
};

const SELL_RATIO = 0.7;

/* ---------------- Enemy ---------------- */

const ENEMIES = {
  basic: { hp: 52, speed: 62, reward: 9, coreDmg: 1, score: 60, r: 13 },
  fast: { hp: 30, speed: 108, reward: 8, coreDmg: 1, score: 70, r: 11 },
  tank: { hp: 200, speed: 36, reward: 22, coreDmg: 2, score: 200, r: 17 },
  shield: { hp: 82, shield: 80, speed: 55, reward: 16, coreDmg: 1, score: 150, r: 14 },
};

/** Máu tăng dần theo wave. */
const waveHpScale = (wave) => 1 + (wave - 1) * 0.17;

/* ---------------- 8 wave data-driven ---------------- */

const WAVES = [
  {
    id: 1,
    groups: [{ type: "basic", count: 6, intervalMs: 950, lane: "alt" }],
    delayBetweenGroupsMs: 1500,
  },
  {
    id: 2,
    groups: [
      { type: "basic", count: 8, intervalMs: 750, lane: "alt" },
      { type: "fast", count: 3, intervalMs: 520, lane: "A" },
    ],
    delayBetweenGroupsMs: 1600,
  },
  {
    id: 3,
    groups: [
      { type: "basic", count: 6, intervalMs: 700, lane: "B" },
      { type: "fast", count: 6, intervalMs: 480, lane: "alt" },
    ],
    delayBetweenGroupsMs: 1500,
  },
  {
    id: 4,
    groups: [
      { type: "shield", count: 4, intervalMs: 900, lane: "A" },
      { type: "basic", count: 8, intervalMs: 650, lane: "alt" },
      { type: "fast", count: 4, intervalMs: 450, lane: "B" },
    ],
    delayBetweenGroupsMs: 1500,
  },
  {
    id: 5,
    groups: [
      { type: "tank", count: 2, intervalMs: 1400, lane: "alt" },
      { type: "basic", count: 10, intervalMs: 560, lane: "alt" },
      { type: "fast", count: 6, intervalMs: 420, lane: "A" },
    ],
    delayBetweenGroupsMs: 1700,
  },
  {
    id: 6,
    groups: [
      { type: "shield", count: 6, intervalMs: 800, lane: "alt" },
      { type: "fast", count: 10, intervalMs: 380, lane: "alt" },
    ],
    delayBetweenGroupsMs: 1500,
  },
  {
    id: 7,
    groups: [
      { type: "tank", count: 4, intervalMs: 1200, lane: "alt" },
      { type: "shield", count: 6, intervalMs: 750, lane: "B" },
      { type: "basic", count: 10, intervalMs: 520, lane: "alt" },
    ],
    delayBetweenGroupsMs: 1600,
  },
  {
    id: 8,
    groups: [
      { type: "tank", count: 6, intervalMs: 1050, lane: "alt" },
      { type: "fast", count: 12, intervalMs: 330, lane: "alt" },
      { type: "shield", count: 8, intervalMs: 620, lane: "alt" },
    ],
    delayBetweenGroupsMs: 1500,
  },
];

const START_ENERGY = 400;
const WAVE_CLEAR_BONUS = 35;
const PREP_TIME = 6;

exports.buildPaths = buildPaths; exports.pointAt = pointAt; exports.WORLD_W = WORLD_W; exports.WORLD_H = WORLD_H; exports.CORE = CORE; exports.PADS = PADS; exports.PAD_R = PAD_R; exports.TOWER_ORDER = TOWER_ORDER; exports.TOWERS = TOWERS; exports.SELL_RATIO = SELL_RATIO; exports.ENEMIES = ENEMIES; exports.waveHpScale = waveHpScale; exports.WAVES = WAVES; exports.START_ENERGY = START_ENERGY; exports.WAVE_CLEAR_BONUS = WAVE_CLEAR_BONUS; exports.PREP_TIME = PREP_TIME;
};
__defs["games/cyber-defense/engine.js"] = function (exports, __req) {
/**
 * engine.js — mô phỏng thuần Cyber Defense (không DOM — unit test được
 * bằng node): wave manager data-driven, enemy đi theo path, tháp chọn
 * mục tiêu "gần CORE nhất trong tầm" (xác định), đạn/AoE/slow không cộng
 * dồn, economy xây / nâng cấp 3 cấp / bán hoàn 70%, thắng sau wave 8,
 * thua khi CORE = 0.
 */

const { buildPaths, pointAt, PADS, PAD_R, TOWERS, SELL_RATIO, ENEMIES, WAVES, waveHpScale, START_ENERGY, WAVE_CLEAR_BONUS, PREP_TIME, CORE } = __req("games/cyber-defense/data.js");

function createSim({ test = false } = {}) {
  const paths = buildPaths();
  const prepTime = test ? 1.2 : PREP_TIME;

  const sim = {
    time: 0,
    energy: START_ENERGY,
    core: CORE.hp,
    coreMax: CORE.hp,
    score: 0,
    kills: 0,
    wave: 0, // wave đang/đã chạy (1-based); 0 = trước wave 1
    phase: "prep", // prep | running | victory | defeat
    prepT: prepTime,
    towers: [],
    enemies: [],
    projectiles: [],
    events: [],
    spawnList: [],
    spawnClock: 0,
    towersBuilt: 0,
    altFlip: false,
    nextId: 1,
  };

  /* ---------------- Wave ---------------- */

  function buildSpawnList(waveDef) {
    const list = [];
    let t = 0.6;
    for (const group of waveDef.groups) {
      for (let i = 0; i < group.count; i++) {
        let lane = group.lane || "alt";
        if (lane === "alt") {
          lane = sim.altFlip ? "A" : "B";
          sim.altFlip = !sim.altFlip;
        }
        list.push({ at: t, type: group.type, lane });
        t += (test ? group.intervalMs / 3 : group.intervalMs) / 1000;
      }
      t += (test ? 400 : waveDef.delayBetweenGroupsMs) / 1000;
    }
    return list;
  }

  function startWave() {
    sim.wave += 1;
    sim.phase = "running";
    sim.spawnList = buildSpawnList(WAVES[sim.wave - 1]);
    sim.spawnClock = 0;
    sim.events.push({ type: "wave", wave: sim.wave });
  }

  function spawnEnemy(type, lane) {
    const def = ENEMIES[type];
    const hpScale = waveHpScale(sim.wave) * (test ? 0.55 : 1);
    sim.enemies.push({
      id: sim.nextId++,
      type,
      lane,
      dist: 0,
      x: paths[lane].pts[0][0],
      y: paths[lane].pts[0][1],
      hp: def.hp * hpScale,
      maxHp: def.hp * hpScale,
      shield: (def.shield || 0) * hpScale,
      maxShield: (def.shield || 0) * hpScale,
      speed: def.speed,
      slowUntil: 0,
      slowFactor: 1,
      reward: def.reward,
      coreDmg: def.coreDmg,
      escore: def.score,
      r: def.r,
      alive: true,
    });
  }

  /* ---------------- Sát thương ---------------- */

  function damage(e, dmg) {
    if (!e.alive) return;
    if (e.shield > 0) {
      // khiên giảm 45% sát thương nhận vào cho tới khi vỡ
      e.shield -= dmg * 0.55;
      if (e.shield <= 0) {
        e.shield = 0;
        sim.events.push({ type: "shieldbreak", x: e.x, y: e.y });
      }
    } else {
      e.hp -= dmg;
    }
    if (e.hp <= 0) {
      e.alive = false;
      sim.energy += e.reward;
      sim.score += e.escore;
      sim.kills += 1;
      sim.events.push({ type: "kill", x: e.x, y: e.y, reward: e.reward });
    }
  }

  function applySlow(e, factor, dur) {
    // Không cộng dồn vô hạn: giữ hệ số MẠNH NHẤT và gia hạn thời gian
    e.slowFactor = Math.min(e.slowFactor < 1 && e.slowUntil > sim.time ? e.slowFactor : 1, factor);
    e.slowUntil = Math.max(e.slowUntil, sim.time + dur);
  }

  /* ---------------- Tháp ---------------- */

  function towerStats(t) {
    return TOWERS[t.type].levels[t.level];
  }

  function acquireTarget(t, range) {
    let best = null;
    let bestRemain = Infinity;
    for (const e of sim.enemies) {
      if (!e.alive) continue;
      const dx = e.x - t.x;
      const dy = e.y - t.y;
      if (dx * dx + dy * dy > range * range) continue;
      const remain = paths[e.lane].totalLen - e.dist;
      if (remain < bestRemain) {
        bestRemain = remain;
        best = e;
      }
    }
    return best;
  }

  function fireTower(t) {
    const st = towerStats(t);
    const target = acquireTarget(t, st.range);
    if (!target) return false;
    t.aimAt = { x: target.x, y: target.y };
    if (t.type === "rapid" || t.type === "sniper") {
      sim.projectiles.push({
        x: t.x, y: t.y - 14,
        targetId: target.id,
        lastX: target.x, lastY: target.y,
        speed: t.type === "sniper" ? 780 : 540,
        dmg: st.dmg,
        kind: t.type,
        alive: true,
      });
      sim.events.push({ type: "shoot", tower: t.type, x: t.x, y: t.y });
    } else if (t.type === "slow") {
      damage(target, st.dmg);
      applySlow(target, st.slow, st.slowDur);
      sim.events.push({ type: "zap", x0: t.x, y0: t.y - 16, x1: target.x, y1: target.y });
    } else if (t.type === "blast") {
      sim.projectiles.push({
        x: t.x, y: t.y - 14,
        targetId: target.id,
        lastX: target.x, lastY: target.y,
        speed: 400,
        dmg: st.dmg,
        aoe: st.aoe,
        kind: "blast",
        alive: true,
      });
      sim.events.push({ type: "shoot", tower: "blast", x: t.x, y: t.y });
    } else if (t.type === "nova") {
      for (const e of sim.enemies) {
        if (!e.alive) continue;
        const dx = e.x - t.x;
        const dy = e.y - t.y;
        if (dx * dx + dy * dy <= st.range * st.range) {
          damage(e, st.dmg);
          if (st.slow) applySlow(e, st.slow, st.slowDur);
        }
      }
      sim.events.push({ type: "pulse", x: t.x, y: t.y, r: st.range });
    }
    return true;
  }

  /* ---------------- API công khai ---------------- */

  sim.padAt = (x, y) => {
    for (const p of PADS) {
      const dx = x - p.x;
      const dy = y - p.y;
      if (dx * dx + dy * dy <= (PAD_R + 8) * (PAD_R + 8)) return p;
    }
    return null;
  };

  sim.towerAt = (x, y) => {
    for (const t of sim.towers) {
      const dx = x - t.x;
      const dy = y - t.y;
      if (dx * dx + dy * dy <= 30 * 30) return t;
    }
    return null;
  };

  sim.towerOnPad = (padId) => sim.towers.find((t) => t.padId === padId) || null;

  sim.isUnlocked = (type) => sim.wave + (sim.phase === "prep" ? 1 : 0) >= TOWERS[type].unlockWave || sim.wave >= TOWERS[type].unlockWave;

  sim.canBuild = (type) => {
    const def = TOWERS[type];
    if (!sim.isUnlocked(type)) return { ok: false, reason: "locked" };
    if (sim.energy < def.cost) return { ok: false, reason: "energy" };
    return { ok: true };
  };

  sim.buildAt = (padId, type) => {
    const pad = PADS.find((p) => p.id === padId);
    if (!pad) return { ok: false, reason: "pad" };
    if (sim.towerOnPad(padId)) return { ok: false, reason: "occupied" };
    const can = sim.canBuild(type);
    if (!can.ok) return can;
    const def = TOWERS[type];
    sim.energy -= def.cost;
    const t = {
      id: sim.nextId++,
      type,
      level: 0,
      x: pad.x,
      y: pad.y,
      padId,
      cooldown: 0.2,
      invested: def.cost,
      aimAt: null,
    };
    sim.towers.push(t);
    sim.towersBuilt += 1;
    sim.events.push({ type: "build", x: pad.x, y: pad.y });
    return { ok: true, tower: t };
  };

  sim.upgradeCost = (t) => {
    const def = TOWERS[t.type];
    if (t.level >= def.levels.length - 1) return null;
    return def.levels[t.level + 1].cost;
  };

  sim.upgrade = (towerId) => {
    const t = sim.towers.find((x) => x.id === towerId);
    if (!t) return { ok: false, reason: "missing" };
    const cost = sim.upgradeCost(t);
    if (cost === null) return { ok: false, reason: "max" };
    if (sim.energy < cost) return { ok: false, reason: "energy" };
    sim.energy -= cost;
    t.invested += cost;
    t.level += 1;
    sim.events.push({ type: "upgrade", x: t.x, y: t.y });
    return { ok: true };
  };

  sim.sellValue = (t) => Math.round(t.invested * SELL_RATIO);

  sim.sell = (towerId) => {
    const i = sim.towers.findIndex((x) => x.id === towerId);
    if (i < 0) return { ok: false };
    const t = sim.towers[i];
    const refund = sim.sellValue(t);
    sim.energy += refund;
    sim.towers.splice(i, 1);
    sim.events.push({ type: "sell", x: t.x, y: t.y, refund });
    return { ok: true, refund };
  };

  sim.stats = (t) => towerStats(t);

  sim.update = (dt) => {
    if (sim.phase === "victory" || sim.phase === "defeat") return;
    sim.time += dt;

    if (sim.phase === "prep") {
      sim.prepT -= dt;
      if (sim.prepT <= 0) startWave();
    } else {
      // spawn
      sim.spawnClock += dt;
      while (sim.spawnList.length && sim.spawnList[0].at <= sim.spawnClock) {
        const s = sim.spawnList.shift();
        spawnEnemy(s.type, s.lane);
      }
    }

    // enemy di chuyển
    for (const e of sim.enemies) {
      if (!e.alive) continue;
      const slowed = e.slowUntil > sim.time;
      const v = e.speed * (slowed ? e.slowFactor : 1);
      e.dist += v * dt;
      const path = paths[e.lane];
      if (e.dist >= path.totalLen) {
        e.alive = false;
        sim.core = Math.max(0, sim.core - e.coreDmg);
        sim.events.push({ type: "corehit", dmg: e.coreDmg });
        if (sim.core <= 0) {
          sim.phase = "defeat";
          sim.events.push({ type: "defeat" });
          return;
        }
        continue;
      }
      const p = pointAt(path, e.dist);
      e.x = p[0];
      e.y = p[1];
    }

    // tháp bắn
    for (const t of sim.towers) {
      t.cooldown -= dt;
      if (t.cooldown <= 0) {
        const st = towerStats(t);
        if (fireTower(t)) t.cooldown = 1 / st.rate;
        else t.cooldown = 0.08; // quét lại sớm khi chưa có mục tiêu
      }
    }

    // đạn
    for (const p of sim.projectiles) {
      if (!p.alive) continue;
      const target = sim.enemies.find((e) => e.id === p.targetId && e.alive);
      const tx = target ? target.x : p.lastX;
      const ty = target ? target.y : p.lastY;
      p.lastX = tx;
      p.lastY = ty;
      const dx = tx - p.x;
      const dy = ty - p.y;
      const d = Math.hypot(dx, dy);
      const step = p.speed * dt;
      if (d <= step + 6) {
        p.alive = false;
        if (p.kind === "blast") {
          for (const e of sim.enemies) {
            if (!e.alive) continue;
            const ddx = e.x - tx;
            const ddy = e.y - ty;
            if (ddx * ddx + ddy * ddy <= p.aoe * p.aoe) damage(e, p.dmg);
          }
          sim.events.push({ type: "boom", x: tx, y: ty, r: p.aoe });
        } else {
          if (target) damage(target, p.dmg);
          sim.events.push({ type: "hit", x: tx, y: ty });
        }
      } else {
        p.x += (dx / d) * step;
        p.y += (dy / d) * step;
      }
    }
    sim.projectiles = sim.projectiles.filter((p) => p.alive);

    // dọn xác + kiểm tra hết wave
    sim.enemies = sim.enemies.filter((e) => e.alive);
    if (sim.phase === "running" && sim.spawnList.length === 0 && sim.enemies.length === 0) {
      if (sim.wave >= WAVES.length) {
        sim.phase = "victory";
        sim.score += sim.core * 100 + sim.energy;
        sim.events.push({ type: "victory" });
      } else {
        sim.phase = "prep";
        sim.prepT = prepTime;
        sim.energy += WAVE_CLEAR_BONUS;
        sim.score += 300;
        sim.events.push({ type: "waveclear", wave: sim.wave, bonus: WAVE_CLEAR_BONUS });
      }
    }
  };

  sim.drainEvents = () => {
    const out = sim.events;
    sim.events = [];
    return out;
  };

  sim.paths = paths;
  return sim;
}

exports.createSim = createSim;
};
__defs["games/cyber-defense/render.js"] = function (exports, __req) {
/**
 * render.js — vẽ Cyber Defense theo ảnh reference: bảng mạch PCB navy
 * với trace cyan, tuyến đường tối viền xanh phát sáng + chevron chạy,
 * pad bát giác lime dấu "+", 5 kiểu tháp có chevron cấp, 4 kiểu bot với
 * thanh máu đỏ, CORE khối lập phương cyan + badge %, đạn/tia/nổ/xung.
 */

const { seededRand } = __req("core/utils.js");
const { WORLD_W, WORLD_H, CORE, PADS, PAD_R, TOWERS, pointAt } = __req("games/cyber-defense/data.js");

const BG = "#071021";
const TRACE = "rgba(32, 120, 200, 0.16)";
const PATH_FILL = "#0d1b3a";
const PATH_EDGE = "#2f7bff";

function createDefenseRenderer(g, paths) {
  let staticLayer = null;
  const fx = []; // hiệu ứng tạm: {kind, x, y, t, ttl, ...}
  const floats = []; // chữ nổi +9⚡

  /* ---------------- lớp tĩnh ---------------- */

  function buildStatic() {
    staticLayer = document.createElement("canvas");
    const S = 1.3;
    staticLayer.width = WORLD_W * S;
    staticLayer.height = WORLD_H * S;
    const s = staticLayer.getContext("2d");
    s.scale(S, S);

    s.fillStyle = BG;
    s.fillRect(0, 0, WORLD_W, WORLD_H);

    // trace mạch in: đường gấp khúc + chấm hàn (seeded)
    const rand = seededRand(2077);
    s.strokeStyle = TRACE;
    s.fillStyle = "rgba(32,120,200,0.22)";
    s.lineWidth = 1.6;
    for (let i = 0; i < 70; i++) {
      let x = rand() * WORLD_W;
      let y = rand() * WORLD_H;
      s.beginPath();
      s.moveTo(x, y);
      const segs = 2 + Math.floor(rand() * 3);
      for (let k = 0; k < segs; k++) {
        const len = 30 + rand() * 90;
        if (rand() > 0.5) x += rand() > 0.5 ? len : -len;
        else y += rand() > 0.5 ? len : -len;
        s.lineTo(x, y);
      }
      s.stroke();
      s.beginPath();
      s.arc(x, y, 2.4, 0, Math.PI * 2);
      s.fill();
    }
    // vi mạch chữ nhật mờ
    for (let i = 0; i < 12; i++) {
      const w = 40 + rand() * 70;
      const h = 26 + rand() * 40;
      const x = rand() * (WORLD_W - w);
      const y = rand() * (WORLD_H - h);
      s.strokeStyle = "rgba(32,120,200,0.12)";
      s.strokeRect(x, y, w, h);
      s.fillStyle = "rgba(32,120,200,0.05)";
      s.fillRect(x, y, w, h);
    }

    // tuyến đường: nền tối + viền xanh glow
    s.lineJoin = "round";
    s.lineCap = "round";
    for (const lane of [paths.A, paths.B]) {
      const path = new Path2D();
      path.moveTo(lane.nodes[0][0], lane.nodes[0][1]);
      for (let i = 1; i < lane.nodes.length; i++) path.lineTo(lane.nodes[i][0], lane.nodes[i][1]);
      s.strokeStyle = "rgba(47,123,255,0.3)";
      s.lineWidth = 54;
      s.stroke(path);
      s.strokeStyle = PATH_FILL;
      s.lineWidth = 44;
      s.stroke(path);
      s.strokeStyle = PATH_EDGE;
      s.lineWidth = 2.4;
      // hai mép
      s.globalAlpha = 0.85;
      s.save();
      s.translate(0, -22);
      s.stroke(path);
      s.translate(0, 44);
      s.stroke(path);
      s.restore();
      s.globalAlpha = 1;
    }

    // mũi tên hồng ở 2 cửa vào (như ảnh)
    for (const lane of [paths.A, paths.B]) {
      const [x, y] = lane.nodes[0];
      s.fillStyle = "#ff4fd8";
      for (let k = 0; k < 3; k++) {
        s.globalAlpha = 1 - k * 0.28;
        s.beginPath();
        s.moveTo(x + 14 + k * 16, y - 12);
        s.lineTo(x + 30 + k * 16, y);
        s.lineTo(x + 14 + k * 16, y + 12);
        s.lineTo(x + 20 + k * 16, y);
        s.closePath();
        s.fill();
      }
      s.globalAlpha = 1;
    }

    // pad bát giác lime với dấu +
    for (const p of PADS) {
      s.save();
      s.translate(p.x, p.y);
      s.strokeStyle = "rgba(190,255,80,0.55)";
      s.fillStyle = "rgba(190,255,80,0.06)";
      s.lineWidth = 2;
      s.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI / 4) * i + Math.PI / 8;
        const x = Math.cos(a) * PAD_R;
        const y = Math.sin(a) * PAD_R;
        if (i === 0) s.moveTo(x, y);
        else s.lineTo(x, y);
      }
      s.closePath();
      s.fill();
      s.stroke();
      s.strokeStyle = "rgba(190,255,80,0.5)";
      s.lineWidth = 3;
      s.beginPath();
      s.moveTo(-8, 0);
      s.lineTo(8, 0);
      s.moveTo(0, -8);
      s.lineTo(0, 8);
      s.stroke();
      s.restore();
    }
  }

  /* ---------------- painter con ---------------- */

  function drawChevrons(time) {
    g.fillStyle = "rgba(120,180,255,0.5)";
    for (const lane of [paths.A, paths.B]) {
      const spacing = 95;
      const offset = (time * 46) % spacing;
      for (let d = offset; d < lane.totalLen - 30; d += spacing) {
        const i = Math.floor(d / lane.step);
        const p = lane.pts[i];
        const q = lane.pts[Math.min(lane.pts.length - 1, i + 3)];
        const a = Math.atan2(q[1] - p[1], q[0] - p[0]);
        g.save();
        g.translate(p[0], p[1]);
        g.rotate(a);
        g.beginPath();
        g.moveTo(-5, -7);
        g.lineTo(4, 0);
        g.lineTo(-5, 7);
        g.lineTo(-1, 0);
        g.closePath();
        g.fill();
        g.restore();
      }
    }
  }

  function drawTower(t, sim, time, selected) {
    const def = TOWERS[t.type];
    const st = sim.stats(t);
    g.save();
    g.translate(t.x, t.y);

    // range circle khi được chọn (nét đứt như ảnh)
    if (selected) {
      g.strokeStyle = "rgba(32,227,255,0.75)";
      g.setLineDash([10, 8]);
      g.lineDashOffset = -time * 26;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(0, 0, st.range, 0, Math.PI * 2);
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = "rgba(32,227,255,0.05)";
      g.fill();
    }

    // bệ bát giác
    g.fillStyle = "#0c142c";
    g.strokeStyle = def.color;
    g.lineWidth = 2;
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI / 4) * i + Math.PI / 8;
      if (i === 0) g.moveTo(Math.cos(a) * 24, Math.sin(a) * 24);
      else g.lineTo(Math.cos(a) * 24, Math.sin(a) * 24);
    }
    g.closePath();
    g.fill();
    g.stroke();

    // chevron cấp trên bệ
    g.strokeStyle = def.color;
    g.lineWidth = 2;
    for (let l = 0; l <= t.level; l++) {
      const y = 15 - l * 5;
      g.beginPath();
      g.moveTo(-6, y + 3);
      g.lineTo(0, y - 2);
      g.lineTo(6, y + 3);
      g.stroke();
    }

    // tháp pháo xoay theo mục tiêu
    const aim = t.aimAt ? Math.atan2(t.aimAt.y - t.y, t.aimAt.x - t.x) : -Math.PI / 2;
    g.save();
    g.translate(0, -6);
    if (t.type === "rapid" || t.type === "sniper") {
      g.rotate(aim);
      g.fillStyle = def.color;
      const len = t.type === "sniper" ? 24 : 15;
      g.fillRect(2, -4.5, len, 3);
      if (t.type === "rapid") g.fillRect(2, 1.5, len, 3);
      else g.fillRect(2, 0.5, len, 3);
      g.fillStyle = "#dff6ff";
      g.beginPath();
      g.arc(0, 0, 7.5, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = def.color;
      g.stroke();
    } else if (t.type === "slow") {
      // cuộn tesla: trụ + vòng
      g.fillStyle = "#171232";
      g.fillRect(-5, -16, 10, 18);
      g.strokeStyle = def.color;
      for (let k = 0; k < 3; k++) {
        g.beginPath();
        g.ellipse(0, -4 - k * 5, 8 - k * 1.5, 3, 0, 0, Math.PI * 2);
        g.stroke();
      }
      g.fillStyle = def.color;
      g.beginPath();
      g.arc(0, -18, 4 + Math.sin(time * 6) * 0.8, 0, Math.PI * 2);
      g.fill();
    } else if (t.type === "blast") {
      g.rotate(aim);
      g.fillStyle = "#2a1030";
      g.strokeStyle = def.color;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(0, 0, 9, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = def.color;
      g.fillRect(4, -5, 14, 10);
    } else if (t.type === "nova") {
      g.fillStyle = "#15240a";
      g.strokeStyle = def.color;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(0, -4, 9, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = def.color;
      g.globalAlpha = 0.6 + Math.sin(time * 5) * 0.3;
      g.beginPath();
      g.arc(0, -4, 4.5, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
    }
    g.restore();
    g.restore();
  }

  function drawEnemy(e, time) {
    g.save();
    g.translate(e.x, e.y);
    const bob = Math.sin(time * 7 + e.id) * 1.2;
    g.translate(0, bob);

    if (e.type === "tank") {
      g.fillStyle = "#131a33";
      g.strokeStyle = "#4a5b8f";
      g.lineWidth = 2;
      g.beginPath();
      g.roundRect(-15, -13, 30, 26, 5);
      g.fill();
      g.stroke();
      g.fillStyle = "#0a0f22";
      g.fillRect(-17, -13, 5, 26);
      g.fillRect(12, -13, 5, 26);
      g.fillStyle = "#ff4f64";
      g.beginPath();
      g.arc(0, 0, 4.5, 0, Math.PI * 2);
      g.fill();
    } else if (e.type === "fast") {
      g.fillStyle = "#161230";
      g.strokeStyle = "#7a5cff";
      g.lineWidth = 1.8;
      g.beginPath();
      g.moveTo(11, 0);
      g.lineTo(-8, -8);
      g.lineTo(-4, 0);
      g.lineTo(-8, 8);
      g.closePath();
      g.fill();
      g.stroke();
      g.fillStyle = "#ff4f64";
      g.fillRect(2, -1.6, 4, 3.2);
    } else {
      g.fillStyle = "#121830";
      g.strokeStyle = e.type === "shield" ? "#20e3ff" : "#44507f";
      g.lineWidth = 1.8;
      g.beginPath();
      g.roundRect(-10, -9, 20, 18, 4);
      g.fill();
      g.stroke();
      g.fillStyle = "#ff4f64";
      g.fillRect(-4, -3, 8, 4);
      // chân nhỏ
      g.fillStyle = "#0a0f22";
      g.fillRect(-9, 9, 5, 3);
      g.fillRect(4, 9, 5, 3);
    }

    // bong bóng khiên
    if (e.maxShield > 0 && e.shield > 0) {
      g.strokeStyle = `rgba(32,227,255,${0.35 + (e.shield / e.maxShield) * 0.4})`;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(0, 0, e.r + 5, 0, Math.PI * 2);
      g.stroke();
    }

    // thanh máu đỏ (như ảnh)
    const w = 24;
    g.fillStyle = "rgba(10,10,20,0.8)";
    g.fillRect(-w / 2, -e.r - 10, w, 4);
    g.fillStyle = "#ff3b4f";
    g.fillRect(-w / 2, -e.r - 10, w * Math.max(0, e.hp / e.maxHp), 4);
    if (e.maxShield > 0 && e.shield > 0) {
      g.fillStyle = "#20e3ff";
      g.fillRect(-w / 2, -e.r - 14, w * (e.shield / e.maxShield), 2.5);
    }
    g.restore();
  }

  function drawCore(sim, time) {
    const { x, y } = CORE;
    g.save();
    g.translate(x, y);
    // vòng lục giác đế
    g.strokeStyle = "rgba(32,227,255,0.5)";
    g.lineWidth = 2;
    for (const r of [44, 56]) {
      g.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i + time * (r === 44 ? 0.25 : -0.18);
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r * 0.9;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.closePath();
      g.stroke();
    }
    // khối lập phương wireframe xoay
    const rot = time * 0.8;
    const s3 = 20;
    const pts = [];
    for (let i = 0; i < 8; i++) {
      const sx = i & 1 ? 1 : -1;
      const sy = i & 2 ? 1 : -1;
      const sz = i & 4 ? 1 : -1;
      const rx = sx * Math.cos(rot) - sz * Math.sin(rot);
      const rz = sx * Math.sin(rot) + sz * Math.cos(rot);
      pts.push([rx * s3, sy * s3 * 0.85 - rz * 6]);
    }
    const edges = [[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7]];
    const hurt = sim.core / sim.coreMax;
    g.strokeStyle = hurt > 0.4 ? "#20e3ff" : "#ff4f64";
    g.lineWidth = 2;
    g.save();
    g.shadowColor = g.strokeStyle;
    g.shadowBlur = 14;
    g.beginPath();
    for (const [a, b] of edges) {
      g.moveTo(pts[a][0], pts[a][1]);
      g.lineTo(pts[b][0], pts[b][1]);
    }
    g.stroke();
    g.restore();

    // badge CORE % (như ảnh)
    const pct = Math.round((sim.core / sim.coreMax) * 100);
    g.translate(0, -76);
    g.fillStyle = "rgba(8,14,28,0.92)";
    g.strokeStyle = pct > 40 ? "#a8ff3e" : "#ff4f64";
    g.lineWidth = 1.6;
    g.beginPath();
    g.roundRect(-38, -16, 76, 32, 4);
    g.fill();
    g.stroke();
    g.fillStyle = "#8fa3c8";
    g.font = "700 10px 'JetBrains Mono', monospace";
    g.textAlign = "center";
    g.fillText("CORE", 0, -3);
    g.fillStyle = pct > 40 ? "#a8ff3e" : "#ff4f64";
    g.font = "800 14px 'JetBrains Mono', monospace";
    g.fillText(`${pct}%`, 0, 12);
    g.restore();
  }

  function drawProjectile(p) {
    if (p.kind === "blast") {
      g.fillStyle = "#ff4fd8";
      g.beginPath();
      g.arc(p.x, p.y, 5, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "rgba(255,79,216,0.45)";
      g.lineWidth = 2;
      g.beginPath();
      g.arc(p.x, p.y, 8, 0, Math.PI * 2);
      g.stroke();
    } else {
      const dx = p.lastX - p.x;
      const dy = p.lastY - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const col = p.kind === "sniper" ? "#ffd23f" : "#20e3ff";
      g.strokeStyle = col;
      g.lineWidth = 3;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(p.x - (dx / d) * 10, p.y - (dy / d) * 10);
      g.lineTo(p.x, p.y);
      g.stroke();
    }
  }

  /* ---------------- hiệu ứng ---------------- */

  function addEvents(events, time) {
    for (const e of events) {
      if (e.type === "zap") fx.push({ kind: "zap", ...e, t: time, ttl: 0.14 });
      else if (e.type === "boom") fx.push({ kind: "boom", x: e.x, y: e.y, r: e.r, t: time, ttl: 0.4 });
      else if (e.type === "pulse") fx.push({ kind: "pulse", x: e.x, y: e.y, r: e.r, t: time, ttl: 0.5 });
      else if (e.type === "kill") {
        fx.push({ kind: "burst", x: e.x, y: e.y, t: time, ttl: 0.35 });
        floats.push({ x: e.x, y: e.y - 14, text: `+${e.reward}⚡`, t: time, ttl: 0.9, color: "#a8ff3e" });
      } else if (e.type === "hit") fx.push({ kind: "spark", x: e.x, y: e.y, t: time, ttl: 0.14 });
      else if (e.type === "build") fx.push({ kind: "buildring", x: e.x, y: e.y, t: time, ttl: 0.4 });
      else if (e.type === "upgrade") fx.push({ kind: "buildring", x: e.x, y: e.y, t: time, ttl: 0.4 });
      else if (e.type === "sell") floats.push({ x: e.x, y: e.y, text: `+${e.refund}⚡`, t: time, ttl: 0.9, color: "#ffd23f" });
      else if (e.type === "shieldbreak") fx.push({ kind: "spark", x: e.x, y: e.y, t: time, ttl: 0.2 });
      else if (e.type === "corehit") fx.push({ kind: "coreflash", t: time, ttl: 0.3 });
    }
  }

  function drawFx(time) {
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i];
      const k = (time - f.t) / f.ttl;
      if (k > 1) {
        fx.splice(i, 1);
        continue;
      }
      if (f.kind === "zap") {
        g.strokeStyle = `rgba(154,92,255,${1 - k})`;
        g.lineWidth = 2.4;
        g.beginPath();
        g.moveTo(f.x0, f.y0);
        const mx = (f.x0 + f.x1) / 2 + (Math.random() - 0.5) * 14;
        const my = (f.y0 + f.y1) / 2 + (Math.random() - 0.5) * 14;
        g.lineTo(mx, my);
        g.lineTo(f.x1, f.y1);
        g.stroke();
      } else if (f.kind === "boom") {
        g.strokeStyle = `rgba(255,79,216,${1 - k})`;
        g.lineWidth = 4 * (1 - k) + 1;
        g.beginPath();
        g.arc(f.x, f.y, f.r * (0.3 + k * 0.7), 0, Math.PI * 2);
        g.stroke();
        g.fillStyle = `rgba(255,120,220,${0.35 * (1 - k)})`;
        g.beginPath();
        g.arc(f.x, f.y, f.r * k, 0, Math.PI * 2);
        g.fill();
      } else if (f.kind === "pulse") {
        g.strokeStyle = `rgba(168,255,62,${1 - k})`;
        g.lineWidth = 3;
        g.beginPath();
        g.arc(f.x, f.y, f.r * k, 0, Math.PI * 2);
        g.stroke();
      } else if (f.kind === "burst") {
        g.fillStyle = `rgba(255,140,80,${1 - k})`;
        for (let j = 0; j < 6; j++) {
          const a = (Math.PI / 3) * j;
          const d = 4 + k * 18;
          g.fillRect(f.x + Math.cos(a) * d - 1.5, f.y + Math.sin(a) * d - 1.5, 3, 3);
        }
      } else if (f.kind === "spark") {
        g.fillStyle = `rgba(160,230,255,${1 - k})`;
        g.fillRect(f.x - 2, f.y - 2, 4, 4);
      } else if (f.kind === "buildring") {
        g.strokeStyle = `rgba(168,255,62,${1 - k})`;
        g.lineWidth = 2.4;
        g.beginPath();
        g.arc(f.x, f.y, 12 + k * 26, 0, Math.PI * 2);
        g.stroke();
      } else if (f.kind === "coreflash") {
        g.fillStyle = `rgba(255,60,80,${0.22 * (1 - k)})`;
        g.fillRect(0, 0, WORLD_W, WORLD_H);
      }
    }
    // chữ nổi
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i];
      const k = (time - f.t) / f.ttl;
      if (k > 1) {
        floats.splice(i, 1);
        continue;
      }
      g.globalAlpha = 1 - k;
      g.fillStyle = f.color;
      g.font = "800 13px 'JetBrains Mono', monospace";
      g.textAlign = "center";
      g.fillText(f.text, f.x, f.y - k * 26);
      g.globalAlpha = 1;
    }
  }

  /* ---------------- khung hình ---------------- */

  function draw(sim, ui, time) {
    if (!staticLayer) buildStatic();
    g.clearRect(0, 0, WORLD_W, WORLD_H);
    g.drawImage(staticLayer, 0, 0, WORLD_W, WORLD_H);
    drawChevrons(time);

    // ghost xây tháp trên pad đang trỏ
    if (ui.buildType && ui.hoverPad) {
      const p = ui.hoverPad;
      const def = TOWERS[ui.buildType];
      const ok = ui.canPlace;
      g.strokeStyle = ok ? "rgba(168,255,62,0.8)" : "rgba(255,79,100,0.8)";
      g.setLineDash([8, 6]);
      g.lineWidth = 2;
      g.beginPath();
      g.arc(p.x, p.y, def.levels[0].range, 0, Math.PI * 2);
      g.stroke();
      g.setLineDash([]);
      g.globalAlpha = 0.55;
      drawTower({ type: ui.buildType, level: 0, x: p.x, y: p.y, aimAt: null }, sim, time, false);
      g.globalAlpha = 1;
    }

    for (const t of sim.towers) drawTower(t, sim, time, t.id === ui.selectedId);
    for (const e of sim.enemies) drawEnemy(e, time);
    for (const p of sim.projectiles) drawProjectile(p);
    drawCore(sim, time);
    drawFx(time);
  }

  return { draw, addEvents };
}

/* ---------------- icon tháp cho build bar ---------------- */

function paintTowerIcon(canvas, type) {
  const size = 44;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  const g = canvas.getContext("2d");
  g.scale(dpr, dpr);
  const def = TOWERS[type];
  g.translate(size / 2, size / 2 + 4);
  // bệ
  g.fillStyle = "#0c142c";
  g.strokeStyle = def.color;
  g.lineWidth = 2;
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI / 4) * i + Math.PI / 8;
    if (i === 0) g.moveTo(Math.cos(a) * 16, Math.sin(a) * 16);
    else g.lineTo(Math.cos(a) * 16, Math.sin(a) * 16);
  }
  g.closePath();
  g.fill();
  g.stroke();
  g.translate(0, -5);
  if (type === "rapid" || type === "sniper") {
    g.rotate(-Math.PI / 3);
    g.fillStyle = def.color;
    g.fillRect(2, -3.5, type === "sniper" ? 17 : 11, 2.6);
    if (type === "rapid") g.fillRect(2, 1, 11, 2.6);
    g.fillStyle = "#dff6ff";
    g.beginPath();
    g.arc(0, 0, 5.5, 0, Math.PI * 2);
    g.fill();
  } else if (type === "slow") {
    g.fillStyle = "#171232";
    g.fillRect(-4, -11, 8, 13);
    g.strokeStyle = def.color;
    for (let k = 0; k < 3; k++) {
      g.beginPath();
      g.ellipse(0, -2 - k * 4, 6.5 - k, 2.4, 0, 0, Math.PI * 2);
      g.stroke();
    }
    g.fillStyle = def.color;
    g.beginPath();
    g.arc(0, -13, 3, 0, Math.PI * 2);
    g.fill();
  } else if (type === "blast") {
    g.rotate(-Math.PI / 3);
    g.fillStyle = "#2a1030";
    g.strokeStyle = def.color;
    g.beginPath();
    g.arc(0, 0, 6.5, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = def.color;
    g.fillRect(3, -3.5, 10, 7);
  } else {
    g.fillStyle = "#15240a";
    g.strokeStyle = def.color;
    g.beginPath();
    g.arc(0, -2, 6.5, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = def.color;
    g.beginPath();
    g.arc(0, -2, 3, 0, Math.PI * 2);
    g.fill();
  }
}

exports.createDefenseRenderer = createDefenseRenderer; exports.paintTowerIcon = paintTowerIcon;
};
__defs["games/cyber-defense/styles.js"] = function (exports, __req) {
/**
 * styles.js — CSS riêng Cyber Defense: thanh chọn tháp dưới đáy (3 tháp
 * + 2 ô khóa theo wave như ảnh), panel nâng cấp/bán tháp bên phải,
 * chip đếm ngược wave và minimap góc phải dưới.
 */

const CD_CSS = /* css */ `
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

exports.CD_CSS = CD_CSS;
};
__defs["games/rogue-arena/index.js"] = function (exports, __req) {
/**
 * Rogue Arena — sinh tồn 3 phút trong đấu trường (game 9).
 *
 * Theo plan + ảnh reference: HUD tiêu đề trái + CẤP/XP, đồng hồ giữa,
 * ĐIỂM / HP / XP / HẠ + nút icon nhỏ bên phải; vũ khí TỰ NHẮM mục tiêu
 * gần nhất (hysteresis chống rung); XP shard hút về khi gần; LEVEL-UP
 * DỪNG THẬT gameplay và hiện 3 lựa chọn (panel trái như ảnh, bộ 8 nâng
 * cấp, không hiện cái đã max); health pickup; spawn tăng dần; boss phút
 * thứ 3. Hiệu năng: object pool + spatial hash trong engine.js.
 * Mobile: joystick ảo. 3 chỉ báo kỹ năng tròn dưới đáy như ảnh.
 */

const { createExpansionFrame } = __req("games/_shared/frame.js");
const { createKeyboard } = __req("core/input-manager.js");
const { createLoop } = __req("core/loop.js");
const { createCanvas } = __req("core/canvas.js");
const { el, formatScore, formatTime } = __req("core/utils.js");
const { ARENA_W, ARENA_H, MATCH_TIME, UPGRADES } = __req("games/rogue-arena/data.js");
const { createArena } = __req("games/rogue-arena/engine.js");
const { createArenaRenderer, paintUpgradeIcon } = __req("games/rogue-arena/render.js");
const { RA_CSS } = __req("games/rogue-arena/styles.js");

function createGame() {
  let ctx = null;
  let frame = null;
  let arena = null;
  let renderer = null;
  let view = null;
  let keys = null;
  let loop = null;
  let levelPanel = null;
  let abilityEls = null;
  let joyEl = null;
  let joyKnob = null;

  const TEST = typeof window !== "undefined" && window.__ARCADE_EXP5_TEST__;

  let mode = "intro"; // intro | play | levelup | paused | over
  let time = 0;
  let stateT = 0;
  let sfxT = {};
  const joy = { active: false, id: -1, cx: 0, cy: 0, mx: 0, my: 0 };
  let choiceButtons = [];

  /* ---------------- HUD ---------------- */

  function updateHud() {
    frame.setStat("level", String(arena.level).padStart(2, "0"));
    frame.setStatBar("level", (arena.xp / arena.xpToNext) * 100);
    frame.setStat("time", formatTime(Math.max(0, MATCH_TIME - arena.time)));
    frame.setStat("score", formatScore(arena.score));
    frame.setStat("hp", String(Math.max(0, Math.round(arena.player.hp))));
    frame.setStatBar("hp", (arena.player.hp / arena.player.maxHp) * 100);
    frame.setStat("xp", `${Math.round((arena.xp / arena.xpToNext) * 100)}%`);
    frame.setStatBar("xp", (arena.xp / arena.xpToNext) * 100);
    frame.setStat("kills", String(arena.kills));
  }

  function updateAbilities() {
    const p = arena.player;
    abilityEls.multishot.textContent = String(p.projectiles);
    abilityEls.pierce.textContent = String(p.pierce);
    abilityEls.speed.textContent = (p.speed / 100).toFixed(1);
  }

  /* ---------------- Level-up (pause thật) ---------------- */

  function openLevelUp() {
    mode = "levelup";
    const choices = arena.rollChoices();
    levelPanel.textContent = "";
    const inBox = el("div", "in");
    inBox.appendChild(el("h3", "", "NÂNG CẤP!"));
    inBox.appendChild(el("div", "sub", "Chọn 1 kỹ năng mới"));
    choiceButtons = choices.map((u, i) => {
      const b = el("button", "ra-choice");
      b.type = "button";
      b.dataset.tone = u.tone || "cyan";
      const ico = el("span", "ico");
      const cv = document.createElement("canvas");
      paintUpgradeIcon(cv, u.id, u.tone || "cyan");
      ico.appendChild(cv);
      b.appendChild(ico);
      b.appendChild(el("div", "nm", u.name));
      b.appendChild(el("div", "ds", u.description));
      if (Number.isFinite(u.maxLevel)) {
        const pips = el("div", "pips");
        const cur = arena.upgradeLevels[u.id] || 0;
        for (let k = 0; k < u.maxLevel; k++) {
          const p = el("i");
          if (k < cur) p.classList.add("on");
          else if (k === cur) p.classList.add("next");
          pips.appendChild(p);
        }
        b.appendChild(pips);
      }
      const kbd = el("kbd", "", String(i + 1));
      b.appendChild(kbd);
      b.addEventListener("click", () => chooseUpgrade(u));
      inBox.appendChild(b);
      return b;
    });
    levelPanel.appendChild(inBox);
    levelPanel.hidden = false;
    ctx.audio.play("levelup");
    requestAnimationFrame(() => choiceButtons[0]?.focus());
  }

  function chooseUpgrade(u) {
    arena.applyUpgrade(u);
    ctx.audio.play("upgrade");
    updateAbilities();
    if (arena.pendingLevelUps > 0) {
      openLevelUp(); // dồn nhiều cấp — chọn tiếp
      return;
    }
    levelPanel.hidden = true;
    mode = "play";
    keys.clearDown();
  }

  /* ---------------- Vòng đời ---------------- */

  function startMatch() {
    arena = createArena({ test: TEST });
    mode = "play";
    time = 0;
    frame.clearScreen();
    frame.setPaused(false);
    levelPanel.hidden = true;
    ctx.onMatchStart();
    ctx.audio.play("start");
    frame.banner("SỐNG SÓT 3 PHÚT!");
    updateHud();
    updateAbilities();
    loop.start();
  }

  function endMatch(victory) {
    mode = "over";
    levelPanel.hidden = true;
    const saved = ctx.onGameOver(arena.score, { kills: arena.kills, level: arena.level, victory });
    frame.overScreen({
      kicker: victory ? "// SỐNG SÓT THÀNH CÔNG" : "// TÍN HIỆU MẤT",
      heading: victory ? "BẠN ĐÃ SỐNG SÓT!" : "GỤC NGÃ TRONG ĐẤU TRƯỜNG",
      score: arena.score,
      saved,
      statCards: [
        { label: "THỜI GIAN", value: formatTime(Math.min(MATCH_TIME, arena.time)), color: "cyan" },
        { label: "ĐÃ HẠ", value: arena.kills, color: "red" },
        { label: "CẤP ĐẠT", value: arena.level, color: "gold" },
        { label: "XP THU THẬP", value: arena.gemsTaken, color: "green" },
      ],
      restartLabel: "CHIẾN LẠI",
      onRestart: () => startMatch(),
    });
    ctx.audio.play(victory ? "win" : "over");
  }

  function pauseGame() {
    if (mode !== "play") return;
    mode = "paused";
    loop.stop();
    frame.setPaused(true);
    frame.pauseMenu({
      onResume: () => resumeGame(),
      onRestart: () => startMatch(),
      restartLabel: "CHIẾN LẠI",
      buildExtra: (box) => {
        const row = el("div", "exp-setrow");
        row.appendChild(el("span", "", "TRẠNG THÁI"));
        row.appendChild(el("span", "val", `CẤP ${arena.level} · HẠ ${arena.kills} · CÒN ${formatTime(Math.max(0, MATCH_TIME - arena.time))}`));
        box.appendChild(row);
      },
    });
  }

  function resumeGame() {
    if (mode !== "paused") return;
    mode = "play";
    frame.clearScreen();
    frame.setPaused(false);
    keys.clearDown();
    loop.start();
  }

  function togglePause() {
    if (mode === "play") pauseGame();
    else if (mode === "paused") resumeGame();
    // đang chọn nâng cấp: Esc không thoát — phải chọn (pause thật)
  }

  /* ---------------- SFX ---------------- */

  function throttled(name, minGap) {
    if (time - (sfxT[name] || -9) < minGap) return;
    sfxT[name] = time;
    ctx.audio.play(name);
  }

  function handleEvents(events) {
    renderer.addEvents(events, arena, time);
    for (const e of events) {
      switch (e.type) {
        case "shoot":
          throttled("zap", 0.16);
          break;
        case "kill":
          throttled("squash", 0.1);
          break;
        case "gem":
          throttled("xp", 0.08);
          break;
        case "heal":
          ctx.audio.play("pickup");
          break;
        case "hurt":
          ctx.audio.play("hurt2");
          break;
        case "levelup":
          break; // xử lý qua pendingLevelUps
        case "boss":
          frame.banner("BOSS XUẤT HIỆN!");
          ctx.audio.play("wave");
          break;
        case "bossdown":
          frame.banner("BOSS BỊ HẠ! +1500");
          ctx.audio.play("record");
          break;
        case "victory":
          endMatch(true);
          break;
        case "defeat":
          endMatch(false);
          break;
      }
    }
  }

  /* ---------------- Vòng lặp ---------------- */

  function gatherInput() {
    let mx = (keys.isDown("ArrowRight") || keys.isDown("KeyD") ? 1 : 0) - (keys.isDown("ArrowLeft") || keys.isDown("KeyA") ? 1 : 0);
    let my = (keys.isDown("ArrowDown") || keys.isDown("KeyS") ? 1 : 0) - (keys.isDown("ArrowUp") || keys.isDown("KeyW") ? 1 : 0);
    if (joy.active) {
      mx += joy.mx;
      my += joy.my;
    }
    return { mx, my };
  }

  function update(dt) {
    time += dt;
    if (mode === "play") {
      arena.update(TEST ? dt * 2 : dt, gatherInput());
      handleEvents(arena.drainEvents());
      if (mode === "play" && arena.pendingLevelUps > 0) openLevelUp();
      updateHud();
      if (TEST) {
        stateT += dt;
        if (stateT > 0.4) {
          stateT = 0;
          window.__RA_STATE__ = {
            mode,
            time: Math.round(arena.time),
            hp: Math.round(arena.player.hp),
            level: arena.level,
            kills: arena.kills,
            score: arena.score,
            pending: arena.pendingLevelUps,
          };
        }
      }
    }
    renderer.draw(arena, dt, time);
  }

  /* ---------------- Intro ---------------- */

  function showIntro() {
    mode = "intro";
    loop.stop();
    frame.intro({
      kicker: "// GIAO THỨC SINH TỒN",
      heading: [["ROGUE ", ""], ["ARENA", "pink"]],
      goal:
        "Sống sót 3 PHÚT trong đấu trường. Vũ khí tự nhắm mục tiêu gần nhất — bạn chỉ cần DI CHUYỂN và né. Hút mảnh XP để lên cấp, mỗi cấp chọn 1 trong 3 nâng cấp. Boss xuất hiện ở phút thứ 3!",
      rows: [
        { keys: ["W A S D", "↑↓←→"], text: "di chuyển (mobile: joystick ảo)" },
        { keys: ["1", "2", "3"], text: "chọn nâng cấp khi lên cấp" },
        { keys: ["ESC"], text: "tạm dừng" },
      ],
      startLabel: "VÀO ĐẤU TRƯỜNG",
      onStart: () => startMatch(),
    });
    renderer.draw(arena, 0, 0);
  }

  /* ---------------- Interface ---------------- */

  return {
    async mount(container, context) {
      ctx = context;

      const rootNode = container.getRootNode();
      if (rootNode instanceof ShadowRoot && !rootNode.querySelector("#ra-style")) {
        const style = document.createElement("style");
        style.id = "ra-style";
        style.textContent = RA_CSS;
        rootNode.appendChild(style);
      }

      frame = createExpansionFrame(container, ctx, {
        accent: "pink",
        title: [["ROGUE ", ""], ["ARENA", "pink"]],
        buttonStyle: "compact",
        stats: [
          { id: "level", label: "CẤP", color: "white", value: "01", bar: true },
          { id: "time", label: "THỜI GIAN", color: "white", value: "03:00" },
          { id: "score", label: "ĐIỂM", color: "cyan", value: "000000" },
          { id: "hp", label: "HP", color: "pink", value: "100", bar: true },
          { id: "xp", label: "XP", color: "green", value: "0%", bar: true, optional: true },
          { id: "kills", label: "HẠ", color: "red", value: "0" },
        ],
        onPauseToggle: togglePause,
      });

      const stage = el("div", "ra-stage");
      frame.playfield.appendChild(stage);
      view = createCanvas(stage, { width: ARENA_W, height: ARENA_H });
      renderer = createArenaRenderer(view.ctx, { reducedMotion: ctx.reducedMotion });
      arena = createArena({ test: TEST });

      /* Panel level-up */
      levelPanel = el("aside", "ra-levelup");
      levelPanel.hidden = true;
      frame.playfield.appendChild(levelPanel);

      /* 3 chỉ báo kỹ năng dưới đáy (như ảnh) */
      const abilities = el("div", "ra-abilities");
      const mkAb = (id, tone) => {
        const box = el("div", "ra-ab");
        box.dataset.tone = tone;
        const ring = el("div", "ring");
        const cv = document.createElement("canvas");
        paintUpgradeIcon(cv, id, tone);
        ring.appendChild(cv);
        box.appendChild(ring);
        const num = el("div", "num", "0");
        box.appendChild(num);
        abilities.appendChild(box);
        return num;
      };
      abilityEls = {
        multishot: mkAb("multishot", "cyan"),
        pierce: mkAb("pierce", "violet"),
        speed: mkAb("speed", "lime"),
      };
      frame.playfield.appendChild(abilities);

      /* Joystick ảo */
      joyEl = el("div", "ra-joy");
      joyKnob = el("div", "knob");
      joyEl.appendChild(joyKnob);
      frame.playfield.appendChild(joyEl);
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      if (coarse) frame.root.dataset.touch = "1";

      const joyReset = () => {
        joy.active = false;
        joy.id = -1;
        joy.mx = 0;
        joy.my = 0;
        joyKnob.style.transform = "translate(-50%, -50%)";
      };
      joyEl.addEventListener(
        "pointerdown",
        (e) => {
          e.preventDefault();
          const r = joyEl.getBoundingClientRect();
          joy.active = true;
          joy.id = e.pointerId;
          joy.cx = r.left + r.width / 2;
          joy.cy = r.top + r.height / 2;
        },
        { signal: ctx.signal }
      );
      window.addEventListener(
        "pointermove",
        (e) => {
          if (!joy.active || e.pointerId !== joy.id) return;
          const dx = e.clientX - joy.cx;
          const dy = e.clientY - joy.cy;
          const d = Math.hypot(dx, dy);
          const max = 44;
          const k = d > max ? max / d : 1;
          joy.mx = (dx * k) / max;
          joy.my = (dy * k) / max;
          joyKnob.style.transform = `translate(calc(-50% + ${dx * k}px), calc(-50% + ${dy * k}px))`;
        },
        { signal: ctx.signal }
      );
      window.addEventListener("pointerup", (e) => {
        if (e.pointerId === joy.id) joyReset();
      }, { signal: ctx.signal });
      window.addEventListener("pointercancel", (e) => {
        if (e.pointerId === joy.id) joyReset();
      }, { signal: ctx.signal });

      /* Bàn phím */
      keys = createKeyboard({ signal: ctx.signal });
      keys.on(["Digit1"], () => {
        if (mode === "levelup") choiceButtons[0]?.click();
      });
      keys.on(["Digit2"], () => {
        if (mode === "levelup") choiceButtons[1]?.click();
      });
      keys.on(["Digit3"], () => {
        if (mode === "levelup") choiceButtons[2]?.click();
      });
      keys.on(["KeyP"], () => togglePause());

      loop = createLoop(update);
      showIntro();
    },

    start() {
      if (mode === "intro") startMatch();
    },

    pause() {
      pauseGame();
    },

    resume() {
      resumeGame();
    },

    restart() {
      if (mode === "intro") return;
      startMatch();
    },

    resize() {},

    destroy() {
      loop?.stop();
      keys?.destroy();
      view?.destroy();
      frame?.destroy();
      frame = null;
      renderer = null;
      arena = null;
      if (typeof window !== "undefined") delete window.__RA_STATE__;
    },
  };
}

exports.createGame = createGame;
};
__defs["games/rogue-arena/data.js"] = function (exports, __req) {
/**
 * data.js — dữ liệu Rogue Arena: kích thước đấu trường, 3 loại enemy +
 * boss, đường cong spawn tăng dần, và bộ 8 nâng cấp theo schema plan
 * { id, name, description, maxLevel, weight, apply }.
 */

const ARENA_W = 1360;
const ARENA_H = 760;
const WALL = 26; // bề dày tường
const MATCH_TIME = 180; // 3 phút
const BOSS_AT = 150; // boss xuất hiện ở phút thứ 3 (còn 0:30)

const PLAYER_BASE = {
  r: 14,
  maxHp: 100,
  speed: 195,
  fireRate: 2.5,
  damage: 13,
  projectiles: 1,
  pierce: 0,
  magnet: 135,
  orbit: 0,
  boltSpeed: 540,
};

const ENEMY_TYPES = {
  chaser: { hp: 26, speed: 96, r: 15, dmg: 12, xp: 2, score: 10, from: 0 },
  shooter: { hp: 42, speed: 68, r: 15, dmg: 8, xp: 3, score: 15, from: 20, shootEvery: 2.7, boltSpeed: 225, boltDmg: 10 },
  tank: { hp: 150, speed: 40, r: 22, dmg: 22, xp: 5, score: 25, from: 35 },
  boss: { hp: 1500, speed: 52, r: 40, dmg: 30, xp: 25, score: 1000, from: 9999, shootEvery: 2.6, boltSpeed: 210, boltDmg: 14, ring: 10 },
};

/** Máu enemy tăng theo thời gian sống sót. */
const hpScale = (t) => 1 + (t / 60) * 0.45;

/** Khoảng cách giữa 2 lần spawn (giảm dần) + số lượng mỗi đợt. */
function spawnCurve(t) {
  const k = Math.min(1, t / MATCH_TIME);
  return {
    interval: 1.15 - k * 0.68, // 1.15s → 0.47s
    batch: 1 + Math.floor(k * 1.9), // 1 → 2 (cuối trận thi thoảng 3)
  };
}

const MAX_ENEMIES = 70;

/** Tỉ trọng loại enemy theo thời gian. */
function pickEnemyType(t, roll) {
  const opts = [];
  opts.push(["chaser", 62]);
  if (t >= ENEMY_TYPES.shooter.from) opts.push(["shooter", 20]);
  if (t >= ENEMY_TYPES.tank.from) opts.push(["tank", 16]);
  const total = opts.reduce((s, o) => s + o[1], 0);
  let x = roll * total;
  for (const [type, w] of opts) {
    x -= w;
    if (x <= 0) return type;
  }
  return "chaser";
}

/** XP cần cho cấp tiếp theo. */
const xpNeed = (level) => 8 + (level - 1) * 5;

/* ---------------- 8 nâng cấp (schema theo plan) ---------------- */

const UPGRADES = [
  {
    id: "damage",
    name: "HỎA LỰC",
    description: "Tăng 25% sát thương tia điện.",
    maxLevel: 5,
    weight: 10,
    tone: "pink",
    apply: (p) => {
      p.damage = Math.round(p.damage * 1.25);
    },
  },
  {
    id: "firerate",
    name: "NẠP NHANH",
    description: "Tăng 20% tốc độ bắn.",
    maxLevel: 5,
    weight: 10,
    tone: "cyan",
    apply: (p) => {
      p.fireRate *= 1.2;
    },
  },
  {
    id: "multishot",
    name: "TIA CHỚP",
    description: "Tăng 1 tia điện.",
    maxLevel: 3,
    weight: 7,
    tone: "cyan",
    apply: (p) => {
      p.projectiles += 1;
    },
  },
  {
    id: "pierce",
    name: "LAN TỎA",
    description: "Đạn xuyên thêm 1 mục tiêu.",
    maxLevel: 3,
    weight: 7,
    tone: "violet",
    apply: (p) => {
      p.pierce += 1;
    },
  },
  {
    id: "speed",
    name: "TỐC ĐỘ",
    description: "Tăng 10% tốc độ di chuyển.",
    maxLevel: 4,
    weight: 8,
    tone: "lime",
    apply: (p) => {
      p.speed *= 1.1;
    },
  },
  {
    id: "maxhp",
    name: "GIÁP LÕI",
    description: "+25 HP tối đa và hồi 25 HP.",
    maxLevel: 4,
    weight: 8,
    tone: "green",
    apply: (p) => {
      p.maxHp += 25;
      p.hp = Math.min(p.maxHp, p.hp + 25);
    },
  },
  {
    id: "magnet",
    name: "NAM CHÂM",
    description: "Hút mảnh XP xa hơn 40%.",
    maxLevel: 3,
    weight: 6,
    tone: "gold",
    apply: (p) => {
      p.magnet *= 1.4;
    },
  },
  {
    id: "orbit",
    name: "VỆ TINH",
    description: "Thêm 1 quả cầu năng lượng quay quanh bảo vệ.",
    maxLevel: 3,
    weight: 6,
    tone: "violet",
    apply: (p) => {
      p.orbit += 1;
    },
  },
];

/** Lựa chọn dự phòng khi mọi nâng cấp đã max. */
const REPAIR_CHOICE = {
  id: "repair",
  name: "SỬA CHỮA",
  description: "Hồi 40 HP ngay lập tức.",
  maxLevel: Infinity,
  weight: 1,
  tone: "green",
  apply: (p) => {
    p.hp = Math.min(p.maxHp, p.hp + 40);
  },
};

exports.spawnCurve = spawnCurve; exports.pickEnemyType = pickEnemyType; exports.ARENA_W = ARENA_W; exports.ARENA_H = ARENA_H; exports.WALL = WALL; exports.MATCH_TIME = MATCH_TIME; exports.BOSS_AT = BOSS_AT; exports.PLAYER_BASE = PLAYER_BASE; exports.ENEMY_TYPES = ENEMY_TYPES; exports.hpScale = hpScale; exports.MAX_ENEMIES = MAX_ENEMIES; exports.xpNeed = xpNeed; exports.UPGRADES = UPGRADES; exports.REPAIR_CHOICE = REPAIR_CHOICE;
};
__defs["games/rogue-arena/engine.js"] = function (exports, __req) {
/**
 * engine.js — mô phỏng thuần Rogue Arena (không DOM, test bằng node).
 *
 * Hiệu năng theo plan:
 *  - OBJECT POOL cho enemy / đạn / đạn địch / mảnh XP / hạt — không cấp
 *    phát object mới trong vòng lặp (không GC churn).
 *  - SPATIAL HASH (ô 96px) cho truy vấn lân cận: nhắm mục tiêu, va chạm
 *    đạn, va chạm thân — KHÔNG quét O(n²).
 *  - Auto-aim có HYSTERESIS: giữ mục tiêu hiện tại tới khi chết/ra khỏi
 *    1.15× tầm — không rung khi nhiều mục tiêu cùng khoảng cách.
 *  - Level-up: engine phát sự kiện và KHÔNG tự mở khóa — lớp ngoài dừng
 *    update cho tới khi người chơi chọn nâng cấp (pause thật).
 */

const { ARENA_W, ARENA_H, WALL, MATCH_TIME, BOSS_AT, PLAYER_BASE, ENEMY_TYPES, hpScale, spawnCurve, MAX_ENEMIES, pickEnemyType, xpNeed, UPGRADES, REPAIR_CHOICE } = __req("games/rogue-arena/data.js");

const CELL = 96;
const COLS = Math.ceil(ARENA_W / CELL);
const ROWS = Math.ceil(ARENA_H / CELL);

/* ---------------- Object pool ---------------- */

function makePool(n, factory) {
  const items = new Array(n);
  for (let i = 0; i < n; i++) {
    items[i] = factory();
    items[i].alive = false;
  }
  return {
    items,
    /** Lấy một slot trống (hoặc null nếu pool đầy). */
    acquire() {
      for (let i = 0; i < n; i++) {
        if (!items[i].alive) {
          items[i].alive = true;
          return items[i];
        }
      }
      return null;
    },
  };
}

function createArena({ test = false, rng = Math.random } = {}) {
  const player = {
    x: ARENA_W / 2,
    y: ARENA_H / 2,
    ...structuredClonePlayer(),
    hp: PLAYER_BASE.maxHp,
    ifr: 0,
    orbitAngle: 0,
  };

  function structuredClonePlayer() {
    return { ...PLAYER_BASE };
  }

  const arena = {
    time: 0, // thời gian đã sống sót
    player,
    level: 1,
    xp: 0,
    xpToNext: test ? 3 : xpNeed(1),
    kills: 0,
    score: 0,
    gemsTaken: 0,
    upgradeLevels: {}, // id → level hiện tại
    pendingLevelUps: 0,
    bossSpawned: false,
    bossId: -1,
    over: false,
    victory: false,
    events: [],
    targetId: -1,
    fireT: 0,
    spawnT: test ? 0.2 : 1.0,
    scoreT: 0,
    enemies: makePool(MAX_ENEMIES + 6, () => ({
      id: 0, type: "chaser", x: 0, y: 0, vx: 0, vy: 0, hp: 0, maxHp: 0,
      r: 15, speed: 0, dmg: 0, xp: 1, score: 10, shootT: 0, orbHitT: 0, hitFlash: 0, alive: false,
    })),
    bolts: makePool(240, () => ({ x: 0, y: 0, vx: 0, vy: 0, dmg: 0, pierce: 0, life: 0, alive: false })),
    ebolts: makePool(90, () => ({ x: 0, y: 0, vx: 0, vy: 0, dmg: 0, life: 0, alive: false })),
    gems: makePool(150, () => ({ x: 0, y: 0, vx: 0, vy: 0, value: 1, big: false, heal: false, t: 0, alive: false })),
  };

  let nextId = 1;

  /* ---------------- Spatial hash ---------------- */

  const grid = new Array(COLS * ROWS);
  for (let i = 0; i < grid.length; i++) grid[i] = [];

  function rebuildGrid() {
    for (let i = 0; i < grid.length; i++) grid[i].length = 0;
    const list = arena.enemies.items;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.alive) continue;
      const cx = Math.max(0, Math.min(COLS - 1, (e.x / CELL) | 0));
      const cy = Math.max(0, Math.min(ROWS - 1, (e.y / CELL) | 0));
      grid[cy * COLS + cx].push(i);
    }
  }

  /** Duyệt enemy sống trong bán kính r quanh (x,y) — chỉ các ô lân cận. */
  function queryCircle(x, y, r, fn) {
    const x0 = Math.max(0, ((x - r) / CELL) | 0);
    const x1 = Math.min(COLS - 1, ((x + r) / CELL) | 0);
    const y0 = Math.max(0, ((y - r) / CELL) | 0);
    const y1 = Math.min(ROWS - 1, ((y + r) / CELL) | 0);
    const r2 = r * r;
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const bucket = grid[cy * COLS + cx];
        for (let k = 0; k < bucket.length; k++) {
          const e = arena.enemies.items[bucket[k]];
          if (!e.alive) continue;
          const dx = e.x - x;
          const dy = e.y - y;
          if (dx * dx + dy * dy <= r2) {
            if (fn(e, dx * dx + dy * dy) === false) return;
          }
        }
      }
    }
  }

  arena.queryCircle = queryCircle;

  /* ---------------- Spawn ---------------- */

  function spawnEnemy(type) {
    const e = arena.enemies.acquire();
    if (!e) return null;
    const def = ENEMY_TYPES[type];
    // sinh ở mép trong tường — KHÔNG sinh sát người chơi (tối thiểu 300px)
    const m = WALL + 22;
    let px = m;
    let py = m;
    for (let attempt = 0; attempt < 7; attempt++) {
      const side = (rng() * 4) | 0;
      if (side === 0) { px = m + rng() * (ARENA_W - m * 2); py = m; }
      else if (side === 1) { px = ARENA_W - m; py = m + rng() * (ARENA_H - m * 2); }
      else if (side === 2) { px = m + rng() * (ARENA_W - m * 2); py = ARENA_H - m; }
      else { px = m; py = m + rng() * (ARENA_H - m * 2); }
      const dx = px - player.x;
      const dy = py - player.y;
      if (dx * dx + dy * dy >= 300 * 300) break;
    }
    e.x = px;
    e.y = py;
    e.id = nextId++;
    e.type = type;
    e.maxHp = def.hp * hpScale(arena.time) * (test ? 0.6 : 1);
    e.hp = e.maxHp;
    e.r = def.r;
    e.speed = def.speed;
    e.dmg = def.dmg;
    e.xp = def.xp;
    e.score = def.score;
    e.shootT = def.shootEvery ? def.shootEvery * (0.5 + rng() * 0.5) : 0;
    e.orbHitT = 0;
    e.hitFlash = 0;
    e.vx = 0;
    e.vy = 0;
    return e;
  }

  function spawnBoss() {
    const e = spawnEnemy("boss");
    if (!e) return;
    e.x = ARENA_W / 2;
    e.y = WALL + 60;
    arena.bossSpawned = true;
    arena.bossId = e.id;
    arena.events.push({ type: "boss" });
  }

  function dropGem(x, y, e) {
    const g = arena.gems.acquire();
    if (!g) return;
    g.x = x + (rng() - 0.5) * 10;
    g.y = y + (rng() - 0.5) * 10;
    g.vx = 0;
    g.vy = 0;
    g.value = e.xp;
    g.big = e.type === "tank" || e.type === "boss" ? rng() < 0.6 : rng() < 0.06;
    if (g.big) g.value += 6;
    g.heal = false;
    g.t = 0;
    // health pickup rơi riêng với tỉ lệ nhỏ
    if (rng() < 0.055) {
      const h = arena.gems.acquire();
      if (h) {
        h.x = x + 14;
        h.y = y;
        h.vx = 0;
        h.vy = 0;
        h.value = 0;
        h.big = false;
        h.heal = true;
        h.t = 0;
      }
    }
  }

  /* ---------------- Sát thương ---------------- */

  function damageEnemy(e, dmg) {
    if (!e.alive) return false;
    e.hp -= dmg;
    e.hitFlash = 0.1;
    if (e.hp <= 0) {
      e.alive = false;
      arena.kills += 1;
      arena.score += e.score;
      dropGem(e.x, e.y, e);
      arena.events.push({ type: "kill", x: e.x, y: e.y, big: e.type === "tank" || e.type === "boss" });
      if (e.id === arena.bossId) {
        arena.score += 500;
        arena.events.push({ type: "bossdown", x: e.x, y: e.y });
      }
      return true;
    }
    return false;
  }

  function hurtPlayer(dmg) {
    if (player.ifr > 0 || arena.over) return;
    player.hp -= dmg;
    player.ifr = 0.6;
    arena.events.push({ type: "hurt", hp: player.hp });
    if (player.hp <= 0) {
      player.hp = 0;
      arena.over = true;
      arena.victory = false;
      arena.events.push({ type: "defeat" });
    }
  }

  /* ---------------- Nâng cấp ---------------- */

  arena.rollChoices = () => {
    const avail = UPGRADES.filter((u) => (arena.upgradeLevels[u.id] || 0) < u.maxLevel);
    const picks = [];
    const poolCopy = avail.slice();
    while (picks.length < 3 && poolCopy.length > 0) {
      const total = poolCopy.reduce((s, u) => s + u.weight, 0);
      let x = rng() * total;
      let idx = 0;
      for (let i = 0; i < poolCopy.length; i++) {
        x -= poolCopy[i].weight;
        if (x <= 0) {
          idx = i;
          break;
        }
      }
      picks.push(poolCopy.splice(idx, 1)[0]);
    }
    while (picks.length < 3) picks.push(REPAIR_CHOICE);
    return picks;
  };

  arena.applyUpgrade = (u) => {
    u.apply(player);
    if (u.id !== "repair") {
      arena.upgradeLevels[u.id] = (arena.upgradeLevels[u.id] || 0) + 1;
    }
    arena.pendingLevelUps = Math.max(0, arena.pendingLevelUps - 1);
    arena.events.push({ type: "upgraded", id: u.id });
  };

  function gainXp(v) {
    arena.xp += v;
    arena.score += v * 2;
    while (arena.xp >= arena.xpToNext) {
      arena.xp -= arena.xpToNext;
      arena.level += 1;
      arena.xpToNext = test ? 3 : xpNeed(arena.level);
      arena.pendingLevelUps += 1;
      arena.events.push({ type: "levelup", level: arena.level });
    }
  }

  /* ---------------- Auto-aim hysteresis ---------------- */

  const ACQUIRE = 430;

  function currentTarget() {
    if (arena.targetId >= 0) {
      const list = arena.enemies.items;
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (e.alive && e.id === arena.targetId) {
          const dx = e.x - player.x;
          const dy = e.y - player.y;
          // giữ mục tiêu tới 1.15× tầm — chống rung giữa nhiều mục tiêu
          if (dx * dx + dy * dy <= ACQUIRE * 1.15 * (ACQUIRE * 1.15)) return e;
          break;
        }
      }
      arena.targetId = -1;
    }
    let best = null;
    let bestD = Infinity;
    queryCircle(player.x, player.y, ACQUIRE, (e, d2) => {
      if (d2 < bestD) {
        bestD = d2;
        best = e;
      }
    });
    if (best) arena.targetId = best.id;
    return best;
  }

  /* ---------------- Update ---------------- */

  arena.update = (dt, input) => {
    if (arena.over) return;
    arena.time += dt;

    // điểm sống sót
    arena.scoreT += dt;
    while (arena.scoreT >= 1) {
      arena.scoreT -= 1;
      arena.score += 5;
    }

    // thắng khi sống hết 3 phút
    if (arena.time >= MATCH_TIME) {
      arena.over = true;
      arena.victory = true;
      arena.events.push({ type: "victory" });
      return;
    }

    // boss phút thứ 3
    if (!arena.bossSpawned && arena.time >= (test ? 20 : BOSS_AT)) spawnBoss();

    /* --- người chơi --- */
    const mlen = Math.hypot(input.mx, input.my);
    if (mlen > 0.01) {
      const nx = input.mx / Math.max(1, mlen);
      const ny = input.my / Math.max(1, mlen);
      player.x += nx * player.speed * dt;
      player.y += ny * player.speed * dt;
    }
    const m = WALL + player.r;
    player.x = Math.max(m, Math.min(ARENA_W - m, player.x));
    player.y = Math.max(m, Math.min(ARENA_H - m, player.y));
    if (player.ifr > 0) player.ifr -= dt;
    player.orbitAngle += dt * 2.6;

    rebuildGrid();

    /* --- spawn --- */
    arena.spawnT -= dt;
    if (arena.spawnT <= 0) {
      const curve = spawnCurve(arena.time);
      arena.spawnT = test ? curve.interval * 0.5 : curve.interval;
      let aliveCount = 0;
      for (const e of arena.enemies.items) if (e.alive) aliveCount++;
      for (let i = 0; i < curve.batch && aliveCount + i < MAX_ENEMIES; i++) {
        spawnEnemy(pickEnemyType(arena.time, rng()));
      }
    }

    /* --- bắn tự động --- */
    arena.fireT -= dt;
    if (arena.fireT <= 0) {
      const target = currentTarget();
      if (target) {
        arena.fireT = 1 / player.fireRate;
        const base = Math.atan2(target.y - player.y, target.x - player.x);
        const n = player.projectiles;
        for (let i = 0; i < n; i++) {
          const b = arena.bolts.acquire();
          if (!b) break;
          const spread = n > 1 ? (i - (n - 1) / 2) * 0.13 : 0;
          const a = base + spread;
          b.x = player.x;
          b.y = player.y;
          b.vx = Math.cos(a) * player.boltSpeed;
          b.vy = Math.sin(a) * player.boltSpeed;
          b.dmg = player.damage;
          b.pierce = player.pierce;
          b.life = 1.1;
        }
        arena.events.push({ type: "shoot" });
      } else {
        arena.fireT = 0.08;
      }
    }

    /* --- đạn người chơi --- */
    for (const b of arena.bolts.items) {
      if (!b.alive) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < WALL || b.x > ARENA_W - WALL || b.y < WALL || b.y > ARENA_H - WALL) {
        b.alive = false;
        continue;
      }
      queryCircle(b.x, b.y, 34, (e) => {
        const rr = e.r + 5;
        const dx = e.x - b.x;
        const dy = e.y - b.y;
        if (dx * dx + dy * dy > rr * rr) return;
        const killed = damageEnemy(e, b.dmg);
        arena.events.push({ type: "hit", x: b.x, y: b.y, killed });
        if (b.pierce > 0) b.pierce -= 1;
        else b.alive = false;
        return false; // một đạn chỉ trúng 1 mục tiêu mỗi frame
      });
    }

    /* --- quả cầu vệ tinh --- */
    if (player.orbit > 0) {
      for (let i = 0; i < player.orbit; i++) {
        const a = player.orbitAngle + (i * Math.PI * 2) / player.orbit;
        const ox = player.x + Math.cos(a) * 56;
        const oy = player.y + Math.sin(a) * 56;
        queryCircle(ox, oy, 20, (e) => {
          if (arena.time - e.orbHitT < 0.45) return;
          e.orbHitT = arena.time;
          damageEnemy(e, 16);
          arena.events.push({ type: "hit", x: ox, y: oy, killed: !e.alive });
        });
      }
    }

    /* --- enemy --- */
    for (const e of arena.enemies.items) {
      if (!e.alive) continue;
      if (e.hitFlash > 0) e.hitFlash -= dt;
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const def = ENEMY_TYPES[e.type];

      if (e.type === "shooter") {
        // giữ khoảng cách rồi bắn
        let mx = 0;
        let my = 0;
        if (d > 300) { mx = dx / d; my = dy / d; }
        else if (d < 200) { mx = -dx / d; my = -dy / d; }
        else { mx = -dy / d * 0.6; my = dx / d * 0.6; }
        e.x += mx * e.speed * dt;
        e.y += my * e.speed * dt;
        e.shootT -= dt;
        if (e.shootT <= 0 && d < 460) {
          e.shootT = def.shootEvery;
          const eb = arena.ebolts.acquire();
          if (eb) {
            eb.x = e.x;
            eb.y = e.y;
            eb.vx = (dx / d) * def.boltSpeed;
            eb.vy = (dy / d) * def.boltSpeed;
            eb.dmg = def.boltDmg;
            eb.life = 3;
            arena.events.push({ type: "eshoot", x: e.x, y: e.y });
          }
        }
      } else if (e.type === "boss") {
        e.x += (dx / d) * e.speed * dt;
        e.y += (dy / d) * e.speed * dt;
        e.shootT -= dt;
        if (e.shootT <= 0) {
          e.shootT = def.shootEvery;
          for (let k = 0; k < def.ring; k++) {
            const a = (Math.PI * 2 * k) / def.ring + arena.time;
            const eb = arena.ebolts.acquire();
            if (!eb) break;
            eb.x = e.x;
            eb.y = e.y;
            eb.vx = Math.cos(a) * def.boltSpeed;
            eb.vy = Math.sin(a) * def.boltSpeed;
            eb.dmg = def.boltDmg;
            eb.life = 4;
          }
          arena.events.push({ type: "eshoot", x: e.x, y: e.y });
        }
      } else {
        e.x += (dx / d) * e.speed * dt;
        e.y += (dy / d) * e.speed * dt;
      }

      const em = WALL + e.r;
      e.x = Math.max(em, Math.min(ARENA_W - em, e.x));
      e.y = Math.max(em, Math.min(ARENA_H - em, e.y));
    }

    /* --- chạm thân người chơi (truy vấn hash quanh player) --- */
    queryCircle(player.x, player.y, 70, (e) => {
      const rr = e.r + player.r - 4;
      const dx = e.x - player.x;
      const dy = e.y - player.y;
      if (dx * dx + dy * dy <= rr * rr) {
        hurtPlayer(e.dmg);
        return false;
      }
    });

    /* --- đạn địch --- */
    for (const eb of arena.ebolts.items) {
      if (!eb.alive) continue;
      eb.x += eb.vx * dt;
      eb.y += eb.vy * dt;
      eb.life -= dt;
      if (eb.life <= 0 || eb.x < WALL || eb.x > ARENA_W - WALL || eb.y < WALL || eb.y > ARENA_H - WALL) {
        eb.alive = false;
        continue;
      }
      const dx = eb.x - player.x;
      const dy = eb.y - player.y;
      const rr = player.r + 5;
      if (dx * dx + dy * dy <= rr * rr) {
        eb.alive = false;
        hurtPlayer(eb.dmg);
      }
    }

    /* --- mảnh XP + hồi máu --- */
    for (const g of arena.gems.items) {
      if (!g.alive) continue;
      g.t += dt;
      const dx = player.x - g.x;
      const dy = player.y - g.y;
      const d = Math.hypot(dx, dy) || 1;
      const magnetR = g.heal ? 60 : player.magnet;
      if (d < magnetR) {
        const pull = 340 * (1 - d / magnetR) + 120;
        g.vx += (dx / d) * pull * dt * 4;
        g.vy += (dy / d) * pull * dt * 4;
      }
      g.vx *= 1 - Math.min(1, dt * 3);
      g.vy *= 1 - Math.min(1, dt * 3);
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      if (d < 20) {
        g.alive = false;
        if (g.heal) {
          player.hp = Math.min(player.maxHp, player.hp + 30);
          arena.events.push({ type: "heal", x: g.x, y: g.y });
        } else {
          arena.gemsTaken += 1;
          gainXp(g.value);
          arena.events.push({ type: "gem", x: g.x, y: g.y, value: g.value, big: g.big });
        }
      }
    }
  };

  arena.drainEvents = () => {
    const out = arena.events.slice();
    arena.events.length = 0;
    return out;
  };

  return arena;
}

exports.createArena = createArena;
};
__defs["games/rogue-arena/render.js"] = function (exports, __req) {
/**
 * render.js — vẽ Rogue Arena theo ảnh reference: sàn đấu tối với vòng
 * tròn đồng tâm giữa, khung tường + dải neon góc hồng/cyan, robot trắng
 * mắt cyan, tia điện xanh tỏa ra, enemy hình học neon (tam giác hồng /
 * khối đỏ có tâm ngắm / khối tím), gem XP kim cương xanh, hex XP lime,
 * hex hồi máu, boss kim tự tháp đỏ, chữ nổi "+N XP".
 */

const { ARENA_W, ARENA_H, WALL } = __req("games/rogue-arena/data.js");

function createArenaRenderer(g, { reducedMotion = false } = {}) {
  let staticLayer = null;
  const parts = []; // hạt {x,y,vx,vy,life,color,size}
  const floats = []; // chữ nổi
  const rings = []; // vòng nổ

  /* ---------------- lớp tĩnh ---------------- */

  function buildStatic() {
    staticLayer = document.createElement("canvas");
    const S = 1.2;
    staticLayer.width = ARENA_W * S;
    staticLayer.height = ARENA_H * S;
    const s = staticLayer.getContext("2d");
    s.scale(S, S);

    // sàn
    const bg = s.createRadialGradient(ARENA_W / 2, ARENA_H / 2, 80, ARENA_W / 2, ARENA_H / 2, 720);
    bg.addColorStop(0, "#0d1330");
    bg.addColorStop(1, "#060a1c");
    s.fillStyle = bg;
    s.fillRect(0, 0, ARENA_W, ARENA_H);

    // lưới mờ
    s.strokeStyle = "rgba(90, 110, 200, 0.07)";
    s.lineWidth = 1;
    for (let x = WALL; x < ARENA_W; x += 68) {
      s.beginPath();
      s.moveTo(x, WALL);
      s.lineTo(x, ARENA_H - WALL);
      s.stroke();
    }
    for (let y = WALL; y < ARENA_H; y += 68) {
      s.beginPath();
      s.moveTo(WALL, y);
      s.lineTo(ARENA_W - WALL, y);
      s.stroke();
    }

    // vòng tròn đồng tâm giữa sàn (như ảnh)
    s.strokeStyle = "rgba(100, 140, 255, 0.12)";
    s.lineWidth = 2;
    for (const r of [70, 120, 170]) {
      s.beginPath();
      s.arc(ARENA_W / 2, ARENA_H / 2, r, 0, Math.PI * 2);
      s.stroke();
    }
    s.strokeStyle = "rgba(100, 140, 255, 0.1)";
    s.beginPath();
    s.moveTo(ARENA_W / 2 - 190, ARENA_H / 2);
    s.lineTo(ARENA_W / 2 + 190, ARENA_H / 2);
    s.moveTo(ARENA_W / 2, ARENA_H / 2 - 190);
    s.lineTo(ARENA_W / 2, ARENA_H / 2 + 190);
    s.stroke();

    // tường
    s.fillStyle = "#0a0e22";
    s.fillRect(0, 0, ARENA_W, WALL);
    s.fillRect(0, ARENA_H - WALL, ARENA_W, WALL);
    s.fillRect(0, 0, WALL, ARENA_H);
    s.fillRect(ARENA_W - WALL, 0, WALL, ARENA_H);
    s.strokeStyle = "rgba(110, 130, 210, 0.35)";
    s.lineWidth = 2;
    s.strokeRect(WALL, WALL, ARENA_W - WALL * 2, ARENA_H - WALL * 2);
    // vạch kỹ thuật trên tường
    s.fillStyle = "rgba(110,130,210,0.2)";
    for (let x = 60; x < ARENA_W - 60; x += 120) {
      s.fillRect(x, WALL / 2 - 2, 34, 4);
      s.fillRect(x, ARENA_H - WALL / 2 - 2, 34, 4);
    }

    // dải neon góc: trái hồng, phải cyan (như ảnh)
    const corner = (x, y, dx, dy, color) => {
      s.strokeStyle = color;
      s.lineWidth = 5;
      s.beginPath();
      s.moveTo(x + dx * 130, y);
      s.lineTo(x, y);
      s.lineTo(x, y + dy * 130);
      s.stroke();
      s.strokeStyle = color.replace("1)", "0.35)");
      s.lineWidth = 11;
      s.beginPath();
      s.moveTo(x + dx * 130, y);
      s.lineTo(x, y);
      s.lineTo(x, y + dy * 130);
      s.stroke();
    };
    corner(WALL + 6, WALL + 6, 1, 1, "rgba(255,46,150,1)");
    corner(WALL + 6, ARENA_H - WALL - 6, 1, -1, "rgba(255,46,150,1)");
    corner(ARENA_W - WALL - 6, WALL + 6, -1, 1, "rgba(32,227,255,1)");
    corner(ARENA_W - WALL - 6, ARENA_H - WALL - 6, -1, -1, "rgba(32,227,255,1)");
  }

  /* ---------------- entity painter ---------------- */

  function drawPlayer(p, time) {
    g.save();
    g.translate(p.x, p.y);
    // vòng sáng dưới chân
    g.strokeStyle = "rgba(32,227,255,0.35)";
    g.lineWidth = 2;
    g.beginPath();
    g.arc(0, 6, 20, 0, Math.PI * 2);
    g.stroke();
    // nhấp nháy khi bất tử
    if (p.ifr > 0 && Math.floor(time * 14) % 2 === 0) g.globalAlpha = 0.45;
    const bob = Math.sin(time * 5) * 1.4;
    g.translate(0, bob);
    // chân
    g.fillStyle = "#8f9ec4";
    g.fillRect(-8, 8, 6, 7);
    g.fillRect(2, 8, 6, 7);
    // thân trắng
    g.fillStyle = "#e8edff";
    g.beginPath();
    g.roundRect(-11, -12, 22, 22, 6);
    g.fill();
    // vai
    g.fillStyle = "#b9c3de";
    g.fillRect(-15, -6, 5, 10);
    g.fillRect(10, -6, 5, 10);
    // visor cyan
    g.fillStyle = "#0a1224";
    g.beginPath();
    g.roundRect(-7, -8, 14, 8, 3);
    g.fill();
    g.save();
    g.shadowColor = "#20e3ff";
    g.shadowBlur = 8;
    g.fillStyle = "#20e3ff";
    g.fillRect(-5, -6, 10, 3.4);
    g.restore();
    g.restore();
  }

  function drawOrbits(p, time) {
    if (p.orbit <= 0) return;
    for (let i = 0; i < p.orbit; i++) {
      const a = p.orbitAngle + (i * Math.PI * 2) / p.orbit;
      const ox = p.x + Math.cos(a) * 56;
      const oy = p.y + Math.sin(a) * 56;
      g.save();
      g.shadowColor = "#9a5cff";
      g.shadowBlur = 10;
      g.fillStyle = "#b98cff";
      g.beginPath();
      g.arc(ox, oy, 8, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#eadffd";
      g.beginPath();
      g.arc(ox - 2, oy - 2, 3, 0, Math.PI * 2);
      g.fill();
      g.restore();
      void time;
    }
  }

  function drawEnemy(e, time) {
    g.save();
    g.translate(e.x, e.y);
    const flash = e.hitFlash > 0;

    if (e.type === "chaser") {
      const a = Math.atan2(0, 1);
      void a;
      g.rotate(Math.sin(time * 3 + e.id) * 0.15);
      g.fillStyle = flash ? "#ffd7ec" : "#3d1030";
      g.strokeStyle = "#ff2e96";
      g.lineWidth = 2.4;
      g.beginPath();
      g.moveTo(0, -e.r);
      g.lineTo(e.r * 0.95, e.r * 0.75);
      g.lineTo(-e.r * 0.95, e.r * 0.75);
      g.closePath();
      g.fill();
      g.stroke();
      g.strokeStyle = "rgba(255,46,150,0.6)";
      g.beginPath();
      g.moveTo(0, -e.r * 0.5);
      g.lineTo(e.r * 0.45, e.r * 0.45);
      g.lineTo(-e.r * 0.45, e.r * 0.45);
      g.closePath();
      g.stroke();
    } else if (e.type === "shooter") {
      g.rotate(Math.sin(time * 2 + e.id) * 0.1);
      g.fillStyle = flash ? "#ffe2e2" : "#38080c";
      g.strokeStyle = "#ff3b4f";
      g.lineWidth = 2.4;
      g.beginPath();
      g.roundRect(-e.r, -e.r, e.r * 2, e.r * 2, 4);
      g.fill();
      g.stroke();
      // icon tâm ngắm (như ảnh)
      g.strokeStyle = "#ff8091";
      g.lineWidth = 1.8;
      g.beginPath();
      g.arc(0, 0, e.r * 0.5, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.arc(0, 0, e.r * 0.18, 0, Math.PI * 2);
      g.stroke();
    } else if (e.type === "tank") {
      g.fillStyle = flash ? "#f0e2ff" : "#241040";
      g.strokeStyle = "#9a5cff";
      g.lineWidth = 3;
      g.beginPath();
      g.roundRect(-e.r, -e.r, e.r * 2, e.r * 2, 5);
      g.fill();
      g.stroke();
      g.strokeStyle = "rgba(154,92,255,0.55)";
      g.lineWidth = 2;
      g.strokeRect(-e.r * 0.55, -e.r * 0.55, e.r * 1.1, e.r * 1.1);
      g.fillStyle = "#c9a6ff";
      g.beginPath();
      g.arc(0, 0, 3.4, 0, Math.PI * 2);
      g.fill();
    } else if (e.type === "boss") {
      g.rotate(Math.sin(time * 1.6) * 0.08);
      g.save();
      g.shadowColor = "#ff3b4f";
      g.shadowBlur = 22;
      g.fillStyle = flash ? "#ffd7d7" : "#3c0a12";
      g.strokeStyle = "#ff3b4f";
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(0, -e.r);
      g.lineTo(e.r, e.r * 0.8);
      g.lineTo(-e.r, e.r * 0.8);
      g.closePath();
      g.fill();
      g.stroke();
      g.restore();
      g.strokeStyle = "rgba(255,59,79,0.7)";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(0, -e.r * 0.45);
      g.lineTo(e.r * 0.5, e.r * 0.45);
      g.lineTo(-e.r * 0.5, e.r * 0.45);
      g.closePath();
      g.stroke();
      // thanh máu boss
      const w = 90;
      g.fillStyle = "rgba(8,8,16,0.85)";
      g.fillRect(-w / 2, -e.r - 18, w, 7);
      g.fillStyle = "#ff3b4f";
      g.fillRect(-w / 2 + 1, -e.r - 17, (w - 2) * Math.max(0, e.hp / e.maxHp), 5);
    }

    // thanh máu nhỏ (trừ boss đã có)
    if (e.type !== "boss" && e.hp < e.maxHp) {
      const w = e.r * 1.7;
      g.fillStyle = "rgba(8,8,16,0.8)";
      g.fillRect(-w / 2, -e.r - 9, w, 3.4);
      g.fillStyle = "#ff3b4f";
      g.fillRect(-w / 2, -e.r - 9, w * Math.max(0, e.hp / e.maxHp), 3.4);
    }
    g.restore();
  }

  function drawBolt(b) {
    const a = Math.atan2(b.vy, b.vx);
    g.save();
    g.translate(b.x, b.y);
    g.rotate(a);
    g.fillStyle = "rgba(32,227,255,0.28)";
    g.beginPath();
    g.ellipse(-6, 0, 13, 4.5, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#9ff1ff";
    g.beginPath();
    g.ellipse(0, 0, 8, 2.6, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  function drawEbolt(b, time) {
    g.save();
    g.translate(b.x, b.y);
    g.fillStyle = "rgba(255,59,110,0.32)";
    g.beginPath();
    g.arc(0, 0, 7 + Math.sin(time * 12) * 1, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#ff5d7d";
    g.beginPath();
    g.arc(0, 0, 3.6, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  function drawGem(gem, time) {
    g.save();
    g.translate(gem.x, gem.y + Math.sin(time * 4 + gem.x) * 2);
    if (gem.heal) {
      // hex hồi máu xanh lá (như ảnh)
      g.strokeStyle = "#4df77f";
      g.fillStyle = "rgba(10,40,20,0.9)";
      g.lineWidth = 2;
      hexPath(12);
      g.fill();
      g.stroke();
      g.fillStyle = "#4df77f";
      g.fillRect(-1.8, -6, 3.6, 12);
      g.fillRect(-6, -1.8, 12, 3.6);
    } else if (gem.big) {
      // hex XP lime (như ảnh)
      g.strokeStyle = "#a8ff3e";
      g.fillStyle = "rgba(30,46,8,0.92)";
      g.lineWidth = 2;
      hexPath(13);
      g.fill();
      g.stroke();
      g.fillStyle = "#a8ff3e";
      g.font = "800 9px 'JetBrains Mono', monospace";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("XP", 0, 0.5);
    } else {
      // kim cương xanh
      const c = gem.value >= 3 ? "#7dc4ff" : "#20e3ff";
      g.fillStyle = c;
      g.beginPath();
      g.moveTo(0, -7);
      g.lineTo(5, 0);
      g.lineTo(0, 7);
      g.lineTo(-5, 0);
      g.closePath();
      g.fill();
      g.fillStyle = "rgba(255,255,255,0.7)";
      g.beginPath();
      g.moveTo(0, -7);
      g.lineTo(5, 0);
      g.lineTo(0, 0);
      g.closePath();
      g.fill();
    }
    g.restore();

    function hexPath(r) {
      g.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.closePath();
    }
  }

  /* ---------------- hiệu ứng ---------------- */

  function burst(x, y, color, n) {
    const count = reducedMotion ? Math.ceil(n / 2) : n;
    for (let i = 0; i < count; i++) {
      if (parts.length > 230) break;
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 160;
      parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5, color, size: 2 + Math.random() * 2 });
    }
  }

  function addEvents(events, arena, time) {
    for (const e of events) {
      switch (e.type) {
        case "kill":
          burst(e.x, e.y, e.big ? "#ff3b4f" : "#ff2e96", e.big ? 16 : 8);
          break;
        case "hit":
          if (!reducedMotion && parts.length < 220) {
            parts.push({ x: e.x, y: e.y, vx: 0, vy: -30, life: 0.2, color: "#9ff1ff", size: 2 });
          }
          break;
        case "gem":
          if (e.big || e.value >= 3) {
            floats.push({ x: e.x, y: e.y - 10, text: `+${e.value * 10} XP`, t: time, ttl: 0.8, color: "#20e3ff" });
          }
          break;
        case "heal":
          floats.push({ x: e.x, y: e.y - 10, text: "+30 HP", t: time, ttl: 0.9, color: "#4df77f" });
          break;
        case "hurt":
          rings.push({ x: arena.player.x, y: arena.player.y, r0: 14, r1: 44, t: time, ttl: 0.3, color: "255,59,79" });
          break;
        case "levelup":
          rings.push({ x: arena.player.x, y: arena.player.y, r0: 16, r1: 90, t: time, ttl: 0.55, color: "255,210,63" });
          break;
        case "bossdown":
          burst(e.x, e.y, "#ffd23f", 26);
          break;
      }
    }
  }

  function drawFx(dt, time) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0) {
        parts.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      g.globalAlpha = Math.min(1, p.life * 2.4);
      g.fillStyle = p.color;
      g.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      g.globalAlpha = 1;
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      const k = (time - r.t) / r.ttl;
      if (k > 1) {
        rings.splice(i, 1);
        continue;
      }
      g.strokeStyle = `rgba(${r.color},${1 - k})`;
      g.lineWidth = 3;
      g.beginPath();
      g.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * k, 0, Math.PI * 2);
      g.stroke();
    }
    g.textAlign = "center";
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i];
      const k = (time - f.t) / f.ttl;
      if (k > 1) {
        floats.splice(i, 1);
        continue;
      }
      g.globalAlpha = 1 - k;
      g.fillStyle = f.color;
      g.font = "800 13px 'JetBrains Mono', monospace";
      g.fillText(f.text, f.x, f.y - k * 24);
      g.globalAlpha = 1;
    }
  }

  /* ---------------- khung hình ---------------- */

  function draw(arena, dt, time) {
    if (!staticLayer) buildStatic();
    g.clearRect(0, 0, ARENA_W, ARENA_H);
    g.drawImage(staticLayer, 0, 0, ARENA_W, ARENA_H);

    for (const gem of arena.gems.items) if (gem.alive) drawGem(gem, time);
    for (const b of arena.bolts.items) if (b.alive) drawBolt(b);
    for (const e of arena.enemies.items) if (e.alive) drawEnemy(e, time);
    for (const b of arena.ebolts.items) if (b.alive) drawEbolt(b, time);
    drawOrbits(arena.player, time);
    drawPlayer(arena.player, time);
    drawFx(dt, time);

    // viền đỏ khi máu thấp
    if (arena.player.hp <= 30 && !arena.over) {
      const a = 0.16 + Math.sin(time * 5) * 0.08;
      const grad = g.createRadialGradient(ARENA_W / 2, ARENA_H / 2, ARENA_H / 3, ARENA_W / 2, ARENA_H / 2, ARENA_H / 1.1);
      grad.addColorStop(0, "rgba(255,40,60,0)");
      grad.addColorStop(1, `rgba(255,40,60,${a})`);
      g.fillStyle = grad;
      g.fillRect(0, 0, ARENA_W, ARENA_H);
    }
  }

  return { draw, addEvents };
}

/** Icon nâng cấp cho card level-up + chỉ báo kỹ năng (canvas nhỏ). */
function paintUpgradeIcon(canvas, id, tone) {
  const size = 34;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  const g = canvas.getContext("2d");
  g.scale(dpr, dpr);
  const colors = {
    cyan: "#20e3ff", pink: "#ff2e96", violet: "#9a5cff",
    lime: "#a8ff3e", green: "#4df77f", gold: "#ffd23f",
  };
  const c = colors[tone] || "#20e3ff";
  g.translate(size / 2, size / 2);
  g.strokeStyle = c;
  g.fillStyle = c;
  g.lineWidth = 2.4;
  g.lineJoin = "round";
  g.lineCap = "round";
  switch (id) {
    case "damage": // đầu đạn
      g.beginPath();
      g.moveTo(0, -10);
      g.lineTo(7, 2);
      g.lineTo(3, 2);
      g.lineTo(3, 10);
      g.lineTo(-3, 10);
      g.lineTo(-3, 2);
      g.lineTo(-7, 2);
      g.closePath();
      g.fill();
      break;
    case "firerate": // 3 vạch tốc độ
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.moveTo(-9 + i * 7, -8);
        g.lineTo(-3 + i * 7, 0);
        g.lineTo(-9 + i * 7, 8);
        g.stroke();
      }
      break;
    case "multishot": // tia sét (như ảnh TIA CHỚP)
      g.beginPath();
      g.moveTo(3, -11);
      g.lineTo(-6, 2);
      g.lineTo(-0.5, 2);
      g.lineTo(-3, 11);
      g.lineTo(6, -2);
      g.lineTo(0.5, -2);
      g.closePath();
      g.fill();
      break;
    case "pierce": // 4 mũi tên tỏa (như ảnh LAN TỎA)
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        g.beginPath();
        g.moveTo(dx * 3, dy * 3);
        g.lineTo(dx * 10, dy * 10);
        g.stroke();
        g.beginPath();
        g.moveTo(dx * 10 + (dy - dx) * 3.4, dy * 10 + (-dx - dy) * 3.4);
        g.lineTo(dx * 12, dy * 12);
        g.lineTo(dx * 10 + (-dy - dx) * 3.4, dy * 10 + (dx - dy) * 3.4);
        g.stroke();
      }
      break;
    case "speed": // chevron đôi (như ảnh TỐC ĐỘ)
      for (let i = 0; i < 2; i++) {
        g.beginPath();
        g.moveTo(-8, 6 - i * 8);
        g.lineTo(0, -1 - i * 8 + 4);
        g.lineTo(8, 6 - i * 8);
        g.stroke();
      }
      break;
    case "maxhp": // khiên
      g.beginPath();
      g.moveTo(0, -10);
      g.lineTo(9, -6);
      g.lineTo(9, 2);
      g.quadraticCurveTo(9, 9, 0, 12);
      g.quadraticCurveTo(-9, 9, -9, 2);
      g.lineTo(-9, -6);
      g.closePath();
      g.stroke();
      g.fillRect(-1.5, -5, 3, 8);
      g.fillRect(-4.5, -2, 9, 3);
      break;
    case "magnet": // nam châm chữ U
      g.beginPath();
      g.arc(0, -1, 7.5, Math.PI, 0, false);
      g.moveTo(-7.5, -1);
      g.lineTo(-7.5, 8);
      g.moveTo(7.5, -1);
      g.lineTo(7.5, 8);
      g.stroke();
      g.fillRect(-9.5, 6, 4, 4);
      g.fillRect(5.5, 6, 4, 4);
      break;
    case "orbit": // quỹ đạo + vệ tinh
      g.beginPath();
      g.ellipse(0, 0, 10, 5.5, -0.5, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.arc(0, 0, 3.4, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.arc(8, -4, 2.6, 0, Math.PI * 2);
      g.fill();
      break;
    default: // repair — cờ lê đơn giản
      g.beginPath();
      g.arc(-4, -4, 5, 0.5, Math.PI * 1.6);
      g.stroke();
      g.beginPath();
      g.moveTo(-1, -1);
      g.lineTo(8, 8);
      g.stroke();
      break;
  }
}

exports.createArenaRenderer = createArenaRenderer; exports.paintUpgradeIcon = paintUpgradeIcon;
};
__defs["games/rogue-arena/styles.js"] = function (exports, __req) {
/**
 * styles.js — CSS riêng Rogue Arena: panel NÂNG CẤP! bên trái với 3 thẻ
 * kỹ năng (icon + tên + mô tả + chấm cấp như ảnh), 3 chỉ báo kỹ năng
 * tròn dưới đáy, và joystick ảo cho mobile.
 */

const RA_CSS = /* css */ `
.ra-stage {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
}

/* ---------- panel level-up ---------- */
.ra-levelup {
  position: absolute;
  left: 18px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 40;
  width: 236px;
  padding: 1px;
  clip-path: polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px);
  background: linear-gradient(160deg, color-mix(in srgb, var(--gold) 65%, transparent), color-mix(in srgb, var(--gold) 16%, transparent));
  animation: raPanelIn 0.24s ease;
}

@keyframes raPanelIn {
  from { opacity: 0; transform: translateY(-50%) translateX(-14px); }
}

@media (prefers-reduced-motion: reduce) {
  .ra-levelup { animation: none; }
}

.ra-levelup > .in {
  clip-path: polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px);
  background: rgba(7, 11, 28, 0.97);
  padding: 15px 14px;
}

.ra-levelup h3 {
  text-align: center;
  font-size: 1.05rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  color: var(--gold);
  text-shadow: 0 0 16px color-mix(in srgb, var(--gold) 55%, transparent);
}

.ra-levelup .sub {
  text-align: center;
  font-size: 0.66rem;
  color: var(--text-1);
  margin: 3px 0 12px;
  letter-spacing: 0.08em;
}

.ra-choice {
  display: grid;
  grid-template-columns: 40px 1fr;
  gap: 4px 10px;
  align-items: center;
  width: 100%;
  text-align: left;
  padding: 10px 11px;
  margin-bottom: 9px;
  border: 1px solid color-mix(in srgb, var(--tone, var(--cyan)) 45%, transparent);
  border-radius: 9px;
  background: rgba(11, 17, 40, 0.85);
  color: var(--text-0);
  font-family: inherit;
  cursor: pointer;
  transition: box-shadow 0.14s ease, transform 0.14s ease, background 0.14s ease;
}

.ra-choice[data-tone="cyan"]   { --tone: var(--cyan); }
.ra-choice[data-tone="pink"]   { --tone: var(--pink); }
.ra-choice[data-tone="violet"] { --tone: var(--violet); }
.ra-choice[data-tone="lime"]   { --tone: var(--lime); }
.ra-choice[data-tone="green"]  { --tone: var(--green); }
.ra-choice[data-tone="gold"]   { --tone: var(--gold); }

.ra-choice:hover,
.ra-choice:focus-visible {
  background: color-mix(in srgb, var(--tone) 12%, rgba(11, 17, 40, 0.85));
  box-shadow: 0 0 18px color-mix(in srgb, var(--tone) 35%, transparent);
  transform: translateX(3px);
}

.ra-choice .ico {
  grid-row: span 2;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid color-mix(in srgb, var(--tone) 55%, transparent);
  border-radius: 8px;
  background: rgba(7, 10, 24, 0.9);
}

.ra-choice .ico canvas { width: 30px; height: 30px; }

.ra-choice .nm {
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: var(--tone);
}

.ra-choice .ds {
  font-size: 0.64rem;
  line-height: 1.45;
  color: var(--text-1);
}

.ra-choice .pips {
  grid-column: 2;
  display: flex;
  gap: 3px;
  margin-top: 2px;
}

.ra-choice .pips i {
  width: 12px;
  height: 5px;
  border-radius: 2px;
  background: rgba(244, 247, 255, 0.14);
}

.ra-choice .pips i.on { background: var(--tone); }
.ra-choice .pips i.next { background: color-mix(in srgb, var(--tone) 45%, transparent); outline: 1px dashed var(--tone); }

.ra-choice kbd {
  position: absolute;
  right: 8px;
  top: 8px;
  font-size: 0.58rem;
  color: var(--text-2);
  border: 1px solid rgba(244,247,255,0.2);
  border-radius: 4px;
  padding: 1px 5px;
}

/* ---------- 3 chỉ báo kỹ năng dưới đáy (như ảnh) ---------- */
.ra-abilities {
  position: absolute;
  left: 50%;
  bottom: 12px;
  transform: translateX(-50%);
  z-index: 24;
  display: flex;
  gap: 20px;
  pointer-events: none;
}

.ra-ab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.ra-ab .ring {
  width: 58px;
  height: 58px;
  border-radius: 50%;
  border: 2.4px solid var(--tone, var(--cyan));
  background: radial-gradient(circle at 50% 38%, rgba(255,255,255,0.08), rgba(7, 10, 24, 0.88) 70%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 16px color-mix(in srgb, var(--tone, var(--cyan)) 35%, transparent);
}

.ra-ab[data-tone="cyan"]   { --tone: var(--cyan); }
.ra-ab[data-tone="violet"] { --tone: var(--violet); }
.ra-ab[data-tone="lime"]   { --tone: var(--lime); }

.ra-ab .ring canvas { width: 30px; height: 30px; }

.ra-ab .num {
  font-size: 0.72rem;
  font-weight: 800;
  color: var(--text-0);
  font-variant-numeric: tabular-nums;
  text-shadow: 0 1px 4px rgba(0,0,0,0.8);
}

/* ---------- joystick mobile ---------- */
.ra-joy {
  position: absolute;
  left: 26px;
  bottom: 26px;
  z-index: 30;
  width: 118px;
  height: 118px;
  border-radius: 50%;
  border: 2px solid rgba(32, 227, 255, 0.4);
  background: rgba(8, 12, 30, 0.5);
  display: none;
  touch-action: none;
}

.exp-root[data-touch="1"] .ra-joy { display: block; }

.ra-joy .knob {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: radial-gradient(circle at 50% 36%, rgba(32,227,255,0.45), rgba(10, 16, 38, 0.95) 72%);
  border: 2px solid var(--cyan);
  transform: translate(-50%, -50%);
  box-shadow: 0 0 16px rgba(32, 227, 255, 0.35);
}

@media (max-width: 760px) {
  .ra-levelup { width: 210px; left: 10px; }
  .ra-abilities { transform: translateX(-50%) scale(0.85); bottom: 6px; }
}
`;

exports.RA_CSS = RA_CSS;
};
__defs["games/rhythm-hack/index.js"] = function (exports, __req) {
/**
 * Rhythm Hack — game nhịp điệu 4 lane D/F/J/K (game 10).
 *
 * Theo plan + ảnh reference: highway phối cảnh 4 lane màu, panel ĐIỂM /
 * COMBO / CHÍNH XÁC bên trái, SYSTEM REPAIR (tim pixel + tiến trình) và
 * TERMINAL bên phải, hàng phím D F J K dưới đáy (đồng thời là 4 vùng
 * chạm). Nhạc chiptune TỰ TỔNG HỢP đồng bộ với chart; đồng hồ chuẩn là
 * audioContext.currentTime (pause = suspend → không bao giờ lệch nhịp).
 * Judgement ±45/±90/±140ms, scoring 1000/700/400 + combo multiplier có
 * trần, accuracy trọng số, calibration offset ±150ms trong pause menu.
 */

const { createExpansionFrame } = __req("games/_shared/frame.js");
const { createKeyboard } = __req("core/input-manager.js");
const { createLoop } = __req("core/loop.js");
const { el, formatScore, formatTime } = __req("core/utils.js");
const { SONG, buildSong } = __req("games/rhythm-hack/chart.js");
const { createMusic } = __req("games/rhythm-hack/audio.js");
const { createJudge } = __req("games/rhythm-hack/engine.js");
const { createHighwayRenderer, paintHeart, LANE_COLORS } = __req("games/rhythm-hack/render.js");
const { RH_CSS } = __req("games/rhythm-hack/styles.js");

const OFFSET_KEY = "rhythm-offset";
const KEY_LANES = { KeyD: 0, KeyF: 1, KeyJ: 2, KeyK: 3 };
const JUDGE_LABEL = { perfect: "PERFECT", great: "GREAT", good: "GOOD" };
const JUDGE_COLOR = { perfect: "#20e3ff", great: "#9a5cff", good: "#ffd23f", miss: "#ff3b4f" };

const TERMINAL_SCRIPT = [
  [2, "> Scanning system...", "ok"],
  [7, "> Detecting errors...", "ok"],
  [14, "> Uploading patches...", "ok"],
  [24, "> Synchronizing...", "info"],
  [36, "> Defragmenting core...", "ok"],
  [48, "> System improving...", "info"],
];

function createGame() {
  let ctx = null;
  let frame = null;
  let renderer = null;
  let canvas = null;
  let keys = null;
  let loop = null;
  let song = null;
  let judge = null;
  let music = null;

  let scoreEl = null;
  let comboEl = null;
  let accEl = null;
  let heartCanvas = null;
  let progressFill = null;
  let progressPct = null;
  let termLines = null;
  let keyEls = [];

  const TEST = typeof window !== "undefined" && window.__ARCADE_EXP5_TEST__;

  let mode = "intro"; // intro | play | paused | over
  let offsetMs = 0;
  let heartStep = -1;
  let termIdx = 0;
  let autoIdx = 0;
  let missSfxT = 0;
  let stateT = 0;
  let time = 0;

  /* ---------------- HUD panels ---------------- */

  function updatePanels() {
    const st = judge.state;
    scoreEl.textContent = formatScore(st.score);
    comboEl.textContent = `×${st.combo}`;
    accEl.textContent = `${judge.accuracy().toFixed(1)}%`;
  }

  function termLog(text, cls) {
    const span = el("span", cls, text);
    termLines.insertBefore(span, termLines.lastElementChild);
    while (termLines.children.length > 7) termLines.removeChild(termLines.firstElementChild);
  }

  function updateSidePanels(songTime) {
    const progress = Math.max(0, Math.min(1, songTime / song.duration));
    const step = Math.floor(progress * 40);
    if (step !== heartStep) {
      heartStep = step;
      paintHeart(heartCanvas, progress);
      progressFill.style.width = `${Math.round(progress * 100)}%`;
      progressPct.textContent = `${Math.round(progress * 100)}%`;
    }
    while (termIdx < TERMINAL_SCRIPT.length && TERMINAL_SCRIPT[termIdx][0] <= songTime) {
      const [, text, cls] = TERMINAL_SCRIPT[termIdx];
      termLog(text, cls);
      termIdx++;
    }
  }

  /* ---------------- Nhấn lane ---------------- */

  function hitLane(lane) {
    if (mode !== "play") return;
    renderer.press(lane);
    keyEls[lane]?.classList.add("held");
    const songTime = music.now();
    if (songTime < -0.05) return;
    const r = judge.onKey(lane, songTime + offsetMs / 1000);
    if (r) {
      renderer.pop(JUDGE_LABEL[r.judgement], JUDGE_COLOR[r.judgement]);
      renderer.burst(lane, LANE_COLORS[lane], r.judgement === "perfect" ? 14 : 8);
      if (judge.state.combo > 0 && judge.state.combo % 50 === 0) {
        termLog(`> Combo x${judge.state.combo} — stable`, "info");
      }
      updatePanels();
    }
  }

  function releaseLane(lane) {
    keyEls[lane]?.classList.remove("held");
  }

  /* ---------------- Vòng đời ---------------- */

  function startMatch() {
    song = buildSong({ test: TEST });
    judge = createJudge(song.notes, SONG);
    music?.stop();
    music = createMusic(ctx.audio.getContext(), song.music);
    autoIdx = 0;
    termIdx = 0;
    heartStep = -1;
    mode = "play";
    frame.clearScreen();
    frame.setPaused(false);
    termLines.textContent = "";
    termLines.appendChild(el("span", "cursor", "_ Working..."));
    ctx.onMatchStart();
    updatePanels();
    music.start(TEST ? 1.2 : 3 * song.beat + 0.2);
    loop.start();
    if (!music.hasAudio) frame.toast("KHÔNG CÓ WEBAUDIO — CHẠY CHẾ ĐỘ IM LẶNG");
  }

  function endMatch() {
    mode = "over";
    music.pause();
    const st = judge.state;
    const acc = judge.accuracy();
    const rank = acc >= 95 ? "S" : acc >= 88 ? "A" : acc >= 75 ? "B" : acc >= 60 ? "C" : "D";
    const saved = ctx.onGameOver(st.score, { accuracy: Math.round(acc * 10) / 10, maxCombo: st.maxCombo, rank });
    frame.overScreen({
      kicker: "// VÁ HỆ THỐNG HOÀN TẤT",
      heading: `HẠNG ${rank} — ${acc.toFixed(1)}%`,
      score: st.score,
      saved,
      statCards: [
        { label: "PERFECT", value: st.counts.perfect, color: "cyan" },
        { label: "GREAT", value: st.counts.great, color: "violet" },
        { label: "GOOD", value: st.counts.good, color: "gold" },
        { label: "MISS", value: st.counts.miss, color: "red" },
        { label: "COMBO CAO NHẤT", value: `×${st.maxCombo}`, color: "pink" },
      ],
      restartLabel: "CHƠI LẠI BÀI",
      onRestart: () => startMatch(),
    });
    ctx.audio.play(acc >= 75 ? "win" : "over");
  }

  function pauseGame() {
    if (mode !== "play") return;
    mode = "paused";
    music.pause(); // suspend audio clock — chart không lệch
    loop.stop();
    frame.setPaused(true);
    frame.pauseMenu({
      onResume: () => resumeGame(),
      onRestart: () => startMatch(),
      restartLabel: "CHƠI LẠI BÀI",
      buildExtra: (box) => {
        const row = el("div", "exp-setrow");
        row.appendChild(el("span", "", "CĂN CHỈNH ĐỘ TRỄ"));
        const val = el("span", "val", `${offsetMs > 0 ? "+" : ""}${offsetMs}ms`);
        row.appendChild(val);
        box.appendChild(row);
        const range = document.createElement("input");
        range.type = "range";
        range.className = "exp-range";
        range.min = "-150";
        range.max = "150";
        range.step = "5";
        range.value = String(offsetMs);
        range.setAttribute("aria-label", "Căn chỉnh độ trễ âm thanh (ms)");
        const paint = () => {
          const pct = ((Number(range.value) + 150) / 300) * 100;
          range.style.setProperty("--fill", `${pct}%`);
          val.textContent = `${Number(range.value) > 0 ? "+" : ""}${range.value}ms`;
        };
        paint();
        range.addEventListener("input", () => {
          offsetMs = Number(range.value);
          ctx.storage.setPref(OFFSET_KEY, offsetMs);
          paint();
        });
        box.appendChild(range);
        const note = el("div", "exp-setrow");
        note.appendChild(el("span", "", "NOTE TRỄ SO VỚI NHẠC → KÉO DƯƠNG"));
        box.appendChild(note);
      },
    });
  }

  function resumeGame() {
    if (mode !== "paused") return;
    mode = "play";
    frame.clearScreen();
    frame.setPaused(false);
    keys.clearDown();
    music.resume();
    loop.start();
  }

  function togglePause() {
    if (mode === "play") pauseGame();
    else if (mode === "paused") resumeGame();
  }

  /* ---------------- Vòng lặp ---------------- */

  function update(dt) {
    time += dt;
    const songTime = music.now();

    if (mode === "play") {
      // autoplay cho QA tự động (chỉ khi TEST)
      if (TEST && window.__RH_AUTOPLAY__) {
        const jt = songTime + offsetMs / 1000;
        while (autoIdx < song.notes.length && song.notes[autoIdx].time <= jt) {
          if (!judge.isDone(autoIdx)) {
            const n = song.notes[autoIdx];
            const r = judge.onKey(n.lane, n.time);
            if (r) {
              renderer.press(n.lane);
              renderer.pop(JUDGE_LABEL[r.judgement], JUDGE_COLOR[r.judgement]);
              renderer.burst(n.lane, LANE_COLORS[n.lane], 6);
            }
          }
          autoIdx++;
        }
        updatePanels();
      }

      // quét miss theo đồng hồ audio
      const missed = judge.tick(songTime + offsetMs / 1000);
      if (missed.length) {
        for (const i of missed) {
          renderer.miss(song.notes[i].lane);
        }
        renderer.pop("MISS", JUDGE_COLOR.miss);
        termLog("> Patch failed!", "fail");
        if (time - missSfxT > 0.35) {
          missSfxT = time;
          ctx.audio.play("miss");
        }
        updatePanels();
      }

      frame.setStat("time", formatTime(Math.max(0, songTime)));
      frame.setStatBar("time", (songTime / song.duration) * 100);
      updateSidePanels(songTime);

      if (songTime > song.duration + 0.8) {
        endMatch();
        return;
      }

      if (TEST) {
        stateT += dt;
        if (stateT > 0.4) {
          stateT = 0;
          window.__RH_STATE__ = {
            mode,
            songTime: Math.round(songTime * 100) / 100,
            score: judge.state.score,
            combo: judge.state.combo,
            judged: judge.state.judged,
            miss: judge.state.counts.miss,
            acc: Math.round(judge.accuracy() * 10) / 10,
            hasAudio: music.hasAudio,
          };
        }
      }
    }

    renderer.draw(songTime, song.notes, judge, song.beat, dt);
  }

  /* ---------------- Intro ---------------- */

  function showIntro() {
    mode = "intro";
    loop.stop();
    frame.intro({
      kicker: "// GIAO THỨC SỬA CHỮA",
      heading: [["RHYTHM ", ""], ["HACK", "cyan"]],
      goal:
        `Bài "${SONG.title}" — ${SONG.bpm} BPM, nhạc chiptune tổng hợp trực tiếp. Nhấn đúng lúc note chạm VẠCH SÁNG để vá hệ thống: PERFECT ±45ms · GREAT ±90ms · GOOD ±140ms. Miss sẽ reset combo!`,
      rows: [
        { keys: ["D", "F", "J", "K"], text: "đánh 4 lane theo nhịp" },
        { keys: ["Chạm"], text: "chạm 4 phím / 4 vùng lane trên tablet" },
        { keys: ["ESC"], text: "tạm dừng (có chỉnh độ trễ ±ms)" },
      ],
      startLabel: "BẮT ĐẦU HACK",
      onStart: () => startMatch(),
      note: "Mẹo: nếu cảm giác note lệch so với nhạc, mở TẠM DỪNG và kéo thanh CĂN CHỈNH ĐỘ TRỄ.",
    });
    renderer.fit();
    renderer.draw(-1, song.notes, judge, song.beat, 0);
  }

  /* ---------------- Interface ---------------- */

  return {
    async mount(container, context) {
      ctx = context;
      offsetMs = Number(ctx.storage.getPref(OFFSET_KEY, 0)) || 0;

      const rootNode = container.getRootNode();
      if (rootNode instanceof ShadowRoot && !rootNode.querySelector("#rh-style")) {
        const style = document.createElement("style");
        style.id = "rh-style";
        style.textContent = RH_CSS;
        rootNode.appendChild(style);
      }

      frame = createExpansionFrame(container, ctx, {
        accent: "cyan",
        title: [["RHYTHM ", ""], ["HACK", "cyan"]],
        buttonStyle: "inline",
        buttonLabels: { pause: "PAUSE", resume: "RESUME", sound: "SOUND", switch: "ĐỔI GAME", home: "HOME" },
        stats: [{ id: "time", label: "THỜI GIAN", color: "cyan", value: "00:00", bar: true }],
        onPauseToggle: togglePause,
      });

      const layout = el("div", "rh-layout");

      /* Cột trái: ĐIỂM / COMBO / CHÍNH XÁC */
      const left = el("div", "rh-col");
      const mkStat = (label, tone, initial) => {
        const p = el("div", "rh-panel");
        p.dataset.tone = tone;
        const inBox = el("div", "in");
        inBox.appendChild(el("div", "lbl", label));
        const v = el("div", "val", initial);
        inBox.appendChild(v);
        const eq = el("div", "eq");
        for (let i = 0; i < 9; i++) {
          const bar = el("i");
          bar.style.height = `${20 + ((i * 37) % 70)}%`;
          eq.appendChild(bar);
        }
        inBox.appendChild(eq);
        p.appendChild(inBox);
        left.appendChild(p);
        return v;
      };
      scoreEl = mkStat("ĐIỂM", "cyan", "000000");
      comboEl = mkStat("COMBO", "pink", "×0");
      accEl = mkStat("CHÍNH XÁC", "lime", "100.0%");

      /* Giữa: highway + hàng phím */
      const stage = el("div", "rh-stage");
      const cbox = el("div", "rh-canvasbox");
      canvas = document.createElement("canvas");
      canvas.setAttribute("aria-label", "Highway 4 lane Rhythm Hack");
      cbox.appendChild(canvas);
      stage.appendChild(cbox);

      const keysRow = el("div", "rh-keys");
      const KEY_DEF = [["D", "cyan"], ["F", "violet"], ["J", "pink"], ["K", "lime"]];
      keyEls = KEY_DEF.map(([label, tone], lane) => {
        const b = el("button", "rh-key", label);
        b.type = "button";
        b.dataset.tone = tone;
        b.setAttribute("aria-label", `Lane ${label}`);
        b.addEventListener(
          "pointerdown",
          (e) => {
            e.preventDefault();
            hitLane(lane);
          },
          { signal: ctx.signal }
        );
        b.addEventListener("pointerup", () => releaseLane(lane), { signal: ctx.signal });
        b.addEventListener("pointercancel", () => releaseLane(lane), { signal: ctx.signal });
        keysRow.appendChild(b);
        return b;
      });
      stage.appendChild(keysRow);

      /* Cột phải: SYSTEM REPAIR + TERMINAL */
      const right = el("div", "rh-col right");
      const repair = el("div", "rh-side");
      repair.appendChild(el("h3", "", "// SYSTEM REPAIR"));
      const heartBox = el("div", "rh-heartbox");
      heartCanvas = document.createElement("canvas");
      heartBox.appendChild(heartCanvas);
      repair.appendChild(heartBox);
      const progRow = el("div", "rh-progress-row");
      progRow.appendChild(el("span", "", "REPAIR PROGRESS"));
      const prog = el("div", "rh-progress");
      progressFill = el("i");
      prog.appendChild(progressFill);
      progRow.appendChild(prog);
      progressPct = el("span", "rh-progress-pct", "0%");
      progRow.appendChild(progressPct);
      repair.appendChild(progRow);
      right.appendChild(repair);

      const term = el("div", "rh-side rh-term");
      term.appendChild(el("h3", "", "// TERMINAL"));
      termLines = el("div", "lines");
      termLines.appendChild(el("span", "cursor", "_ Working..."));
      term.appendChild(termLines);
      right.appendChild(term);

      layout.append(left, stage, right);
      frame.playfield.appendChild(layout);

      renderer = createHighwayRenderer(canvas, cbox);
      const ro = new ResizeObserver(() => renderer.fit());
      ro.observe(cbox);
      this._ro = ro;

      // chạm trực tiếp lên highway (4 vùng lane)
      canvas.addEventListener(
        "pointerdown",
        (e) => {
          e.preventDefault();
          hitLane(renderer.laneFromClientX(e.clientX));
        },
        { signal: ctx.signal }
      );
      window.addEventListener(
        "pointerup",
        () => {
          for (let i = 0; i < 4; i++) releaseLane(i);
        },
        { signal: ctx.signal }
      );

      keys = createKeyboard({ signal: ctx.signal });
      for (const [code, lane] of Object.entries(KEY_LANES)) {
        keys.on([code], () => hitLane(lane)); // repeat=false mặc định — key repeat không tạo hit
      }
      window.addEventListener(
        "keyup",
        (e) => {
          if (KEY_LANES[e.code] !== undefined) releaseLane(KEY_LANES[e.code]);
        },
        { signal: ctx.signal }
      );
      keys.on(["KeyP"], () => togglePause());

      song = buildSong({ test: TEST });
      judge = createJudge(song.notes, SONG);
      paintHeart(heartCanvas, 0);

      loop = createLoop(update);
      showIntro();
    },

    start() {
      if (mode === "intro") startMatch();
    },

    pause() {
      pauseGame();
    },

    resume() {
      resumeGame();
    },

    restart() {
      if (mode === "intro") return;
      startMatch();
    },

    resize() {
      renderer?.fit();
    },

    destroy() {
      loop?.stop();
      keys?.destroy();
      music?.stop(); // disconnect bus + resume ctx nếu đang suspend
      this._ro?.disconnect();
      frame?.destroy();
      frame = null;
      renderer = null;
      judge = null;
      song = null;
      if (typeof window !== "undefined") delete window.__RH_STATE__;
    },
  };
}

exports.createGame = createGame;
};
__defs["games/rhythm-hack/chart.js"] = function (exports, __req) {
/**
 * chart.js — bài "SYSTEM REPAIR" của Rhythm Hack.
 *
 * Nhạc chiptune được TỰ TỔNG HỢP bằng WebAudio và chart note được SINH
 * TỪ CÙNG MỘT PATTERN (riff lead / trống theo từng section) — bảo đảm
 * note luôn khớp với âm thanh nghe được. Không file audio ngoài.
 *
 * Xuất: SONG (config + judgement window theo plan) và buildSong() →
 * { notes: [{time, lane}], music: [{time, voice, freq, dur, vel}] }.
 */

const SONG = {
  id: "system-repair-01",
  title: "SYSTEM REPAIR",
  bpm: 124,
  bars: 32, // ≈ 62 giây
  offsetMs: 0,
  windows: { perfect: 0.045, great: 0.09, good: 0.14 }, // ±s — theo plan
  scores: { perfect: 1000, great: 700, good: 400 },
  comboCap: 30, // hệ số nhân tối đa 1 + 30×0.02 = 1.6
};

const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

/* A minor pentatonic quanh A4; degree 0..7 */
const PENTA = [0, 3, 5, 7, 10, 12, 15, 17];
const LEAD_ROOT = 69; // A4
const BASS_ROOT = 45; // A2
/* vòng hợp âm: Am — F — C — G (dịch gốc bass) */
const PROG = [0, -4, 3, -2];

function sectionOf(bar) {
  if (bar < 4) return "intro";
  if (bar < 12) return "A";
  if (bar < 20) return "B";
  if (bar < 28) return "chorus";
  return "outro";
}

/* Riff lead 2 ô nhịp cho mỗi section: [beat, degree] */
const LEAD_RIFFS = {
  intro: [[], []],
  A: [
    [[0, 4], [1, 2], [2, 3], [3, 2]],
    [[0, 2], [1.5, 1], [2.5, 0]],
  ],
  B: [
    [[0, 4], [0.5, 4], [1, 3], [2, 2], [2.5, 3], [3, 4]],
    [[0, 5], [1, 4], [1.5, 3], [2, 2], [3, 1], [3.5, 0]],
  ],
  chorus: [
    [[0, 6], [0.5, 5], [1, 4], [1.5, 5], [2, 6], [2.5, 5], [3, 4], [3.5, 3]],
    [[0, 4], [0.5, 3], [1, 2], [1.5, 3], [2, 4], [3, 2], [3.5, 4]],
  ],
  outro: [
    [[0, 2], [2, 0]],
    [[0, 1]],
  ],
};

const KICKS = {
  intro: [0, 2],
  A: [0, 2],
  B: [0, 1.5, 2],
  chorus: [0, 1, 2, 3],
  outro: [0],
};

const SNARES = { intro: [3], A: [1, 3], B: [1, 3], chorus: [1, 3], outro: [] };

/**
 * Sinh toàn bộ sự kiện nhạc + note chart.
 * test=true → bài rút gọn 8 ô nhịp (~15.5s) cho QA tự động.
 */
function buildSong({ test = false } = {}) {
  const bars = test ? 8 : SONG.bars;
  const beat = 60 / SONG.bpm;
  const music = [];
  const notes = [];

  for (let bar = 0; bar < bars; bar++) {
    const sec = test ? (bar < 2 ? "intro" : bar < 5 ? "A" : "B") : sectionOf(bar);
    const barT = bar * 4 * beat;
    const chord = PROG[bar % 4];

    // trống
    for (const b of KICKS[sec]) {
      music.push({ time: barT + b * beat, voice: "kick", dur: 0.12, vel: 1 });
    }
    for (const b of SNARES[sec]) {
      music.push({ time: barT + b * beat, voice: "snare", dur: 0.09, vel: 0.8 });
    }
    for (let h = 0; h < 8; h++) {
      if (sec === "intro" && h % 2 === 1) continue;
      music.push({
        time: barT + h * 0.5 * beat,
        voice: "hat",
        dur: 0.03,
        vel: h % 2 === 0 ? 0.42 : 0.22,
      });
    }

    // bass 8th theo hợp âm
    const bassSlots = sec === "intro" ? [0, 2] : sec === "outro" ? [0] : [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5];
    for (const b of bassSlots) {
      const oct = b % 1 === 0.5 ? 12 : 0;
      music.push({
        time: barT + b * beat,
        voice: "bass",
        freq: midiHz(BASS_ROOT + chord + oct),
        dur: beat * 0.42,
        vel: b % 1 === 0 ? 0.85 : 0.6,
      });
    }

    // lead riff → nhạc + NOTE CHART (lane = degree % 4, khớp cao độ)
    const riff = LEAD_RIFFS[sec][bar % 2];
    for (const [b, deg] of riff) {
      const t = barT + b * beat;
      music.push({
        time: t,
        voice: "lead",
        freq: midiHz(LEAD_ROOT + chord + PENTA[deg]),
        dur: beat * 0.5,
        vel: 0.8,
      });
      notes.push({ time: t, lane: deg % 4 });
    }

    // chorus: thêm note theo snare cho dày nhịp (tiếng snare có thật)
    if (sec === "chorus") {
      for (const b of SNARES[sec]) {
        const t = barT + b * beat;
        if (!riff.some(([rb]) => Math.abs(rb - b) < 0.26)) {
          notes.push({ time: t, lane: bar % 2 === 0 ? 1 : 2 });
        }
      }
    }
    // intro warm-up: 2 note theo kick ở ô nhịp 2-3
    if (sec === "intro" && bar >= 2) {
      notes.push({ time: barT, lane: 0 });
    }
  }

  notes.sort((a, b) => a.time - b.time);
  music.sort((a, b) => a.time - b.time);
  const duration = bars * 4 * beat;
  return { notes, music, duration, beat, bars };
}

exports.buildSong = buildSong; exports.SONG = SONG;
};
__defs["games/rhythm-hack/audio.js"] = function (exports, __req) {
/**
 * audio.js — trình phát nhạc chiptune của Rhythm Hack.
 *
 * ĐỒNG HỒ CHUẨN là audioContext.currentTime (theo plan — cấm setTimeout
 * làm đồng hồ nhịp): mọi sự kiện âm thanh được đặt lịch ở thời điểm
 * TUYỆT ĐỐI trên trục thời gian của AudioContext; setInterval chỉ làm
 * nhiệm vụ "nạp thêm hàng đợi" (lookahead scheduler chuẩn WebAudio).
 *
 * Pause = ctx.suspend() → currentTime đóng băng → chart không bao giờ
 * lệch khi resume. Máy không có WebAudio → fallback đồng hồ
 * performance.now (im lặng nhưng vẫn chơi được).
 */

const LOOKAHEAD = 0.24; // giây đặt lịch trước
const TICK_MS = 60;

function createMusic(audioHandle, events) {
  // audioHandle: { ctx, master } từ audio-manager (null nếu không có WebAudio)
  const hasAudio = !!audioHandle;
  const ctx = audioHandle?.ctx || null;

  let bus = null;
  let noiseBuf = null;
  let startAt = 0; // mốc ctx.currentTime khi bài bắt đầu (beat 0)
  let nextIdx = 0;
  let timer = 0;
  let running = false;

  // fallback clock (không WebAudio)
  let fbStart = 0;
  let fbPausedAt = -1;

  function ensureBus() {
    if (!hasAudio || bus) return;
    bus = ctx.createGain();
    bus.gain.value = 0.5;
    bus.connect(audioHandle.master);
    const len = Math.floor(ctx.sampleRate * 0.4);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  /* ---------------- voice synth (đặt lịch tại thời điểm tuyệt đối) ---------------- */

  function osc(type, freq, t0, dur, vel, slideTo = null) {
    const o = ctx.createOscillator();
    const gn = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(1, freq), t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    gn.gain.setValueAtTime(vel, t0);
    gn.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(gn);
    gn.connect(bus);
    o.start(t0);
    o.stop(t0 + dur + 0.03);
  }

  function noiseHit(t0, dur, vel, from, to) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.setValueAtTime(from, t0);
    f.frequency.exponentialRampToValueAtTime(Math.max(60, to), t0 + dur);
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(vel, t0);
    gn.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f);
    f.connect(gn);
    gn.connect(bus);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  function scheduleEvent(e) {
    const t0 = startAt + e.time;
    switch (e.voice) {
      case "kick":
        osc("sine", 150, t0, e.dur, 0.95 * e.vel, 44);
        break;
      case "snare":
        noiseHit(t0, e.dur, 0.5 * e.vel, 2400, 900);
        osc("triangle", 210, t0, 0.06, 0.25 * e.vel, 140);
        break;
      case "hat":
        noiseHit(t0, e.dur, 0.32 * e.vel, 8500, 6000);
        break;
      case "bass":
        osc("square", e.freq, t0, e.dur, 0.3 * e.vel);
        break;
      case "lead":
        osc("square", e.freq, t0, e.dur, 0.22 * e.vel);
        osc("triangle", e.freq * 2.003, t0, e.dur * 0.85, 0.12 * e.vel);
        break;
    }
  }

  function pump() {
    if (!running) return;
    const now = ctx.currentTime - startAt;
    while (nextIdx < events.length && events[nextIdx].time <= now + LOOKAHEAD) {
      scheduleEvent(events[nextIdx]);
      nextIdx++;
    }
  }

  return {
    /** true nếu có WebAudio thật (đồng hồ audio); false = fallback im lặng. */
    get hasAudio() {
      return hasAudio;
    },

    /** Bắt đầu bài sau `delay` giây (đếm ngược intro dùng chung đồng hồ). */
    start(delay = 0) {
      running = true;
      nextIdx = 0;
      if (hasAudio) {
        ensureBus();
        if (ctx.state === "suspended") ctx.resume().catch(() => {});
        startAt = ctx.currentTime + delay;
        pump();
        timer = setInterval(pump, TICK_MS); // chỉ nạp hàng đợi — không phải đồng hồ
      } else {
        fbStart = performance.now() / 1000 + delay;
        fbPausedAt = -1;
      }
    },

    /** songTime hiện tại (giây, âm khi đang đếm ngược). */
    now() {
      if (hasAudio) return ctx.currentTime - startAt;
      if (fbPausedAt >= 0) return fbPausedAt - fbStart;
      return performance.now() / 1000 - fbStart;
    },

    pause() {
      if (hasAudio) {
        ctx.suspend().catch(() => {});
      } else if (fbPausedAt < 0) {
        fbPausedAt = performance.now() / 1000;
      }
    },

    resume() {
      if (hasAudio) {
        ctx.resume().catch(() => {});
      } else if (fbPausedAt >= 0) {
        fbStart += performance.now() / 1000 - fbPausedAt;
        fbPausedAt = -1;
      }
    },

    /** Dừng hẳn + dọn node (bus disconnect → mọi event đã đặt lịch câm). */
    stop() {
      running = false;
      clearInterval(timer);
      if (bus) {
        try {
          bus.disconnect();
        } catch {
          /* bỏ qua */
        }
        bus = null;
      }
      // KHÔNG close ctx — dùng chung với SFX toàn arcade; bảo đảm resume
      if (hasAudio && ctx.state === "suspended") ctx.resume().catch(() => {});
    },
  };
}

exports.createMusic = createMusic;
};
__defs["games/rhythm-hack/engine.js"] = function (exports, __req) {
/**
 * engine.js — bộ chấm điểm Rhythm Hack (thuần logic, test bằng node).
 *
 * Judgement window theo plan (đưa vào config SONG): Perfect ±45ms,
 * Great ±90ms, Good ±140ms, ngoài đó = Miss. Scoring 1000/700/400/0,
 * combo multiplier có trần, accuracy theo trọng số. Mỗi note chỉ được
 * chấm MỘT lần; nhấn khi không có note trong cửa sổ → không tính gì
 * (key repeat không tạo hit sai).
 */

const ACC_WEIGHT = { perfect: 1, great: 0.7, good: 0.4, miss: 0 };

function createJudge(notes, config) {
  const state = {
    score: 0,
    combo: 0,
    maxCombo: 0,
    counts: { perfect: 0, great: 0, good: 0, miss: 0 },
    judged: 0,
    total: notes.length,
    accWeight: 0,
    done: [], // trạng thái từng note: undefined | judgement
  };

  const { windows, scores, comboCap } = config;

  function multiplier() {
    return 1 + Math.min(state.combo, comboCap) * 0.02;
  }

  function record(judgement) {
    state.counts[judgement] += 1;
    state.judged += 1;
    state.accWeight += ACC_WEIGHT[judgement];
    if (judgement === "miss") {
      state.combo = 0;
    } else {
      state.score += Math.round(scores[judgement] * multiplier());
      state.combo += 1;
      state.maxCombo = Math.max(state.maxCombo, state.combo);
    }
  }

  return {
    state,
    multiplier,

    /** Accuracy % theo trọng số trên số note ĐÃ chấm. */
    accuracy() {
      if (state.judged === 0) return 100;
      return (state.accWeight / state.judged) * 100;
    },

    /**
     * Người chơi nhấn lane tại songTime (đã cộng calibration offset).
     * Trả về { judgement, delta, index } hoặc null nếu không có note
     * trong cửa sổ Good (không phạt — chống key repeat / spam).
     */
    onKey(lane, t) {
      let best = -1;
      let bestAbs = Infinity;
      for (let i = 0; i < notes.length; i++) {
        if (state.done[i]) continue;
        const n = notes[i];
        if (n.lane !== lane) continue;
        const d = t - n.time;
        if (d < -windows.good) break; // notes sort theo time — quá sớm thì dừng
        const ad = Math.abs(d);
        if (ad <= windows.good && ad < bestAbs) {
          bestAbs = ad;
          best = i;
        }
      }
      if (best < 0) return null;
      const delta = t - notes[best].time;
      const ad = Math.abs(delta);
      const judgement = ad <= windows.perfect ? "perfect" : ad <= windows.great ? "great" : "good";
      state.done[best] = judgement;
      record(judgement);
      return { judgement, delta, index: best };
    },

    /** Quét các note đã trôi quá cửa sổ Good mà chưa được chấm → Miss. */
    tick(t) {
      const missed = [];
      for (let i = 0; i < notes.length; i++) {
        if (state.done[i]) continue;
        const n = notes[i];
        if (t - n.time > windows.good) {
          state.done[i] = "miss";
          record("miss");
          missed.push(i);
        } else if (n.time - t > windows.good) {
          break;
        }
      }
      return missed;
    },

    isDone(i) {
      return !!state.done[i];
    },
  };
}

exports.createJudge = createJudge; exports.ACC_WEIGHT = ACC_WEIGHT;
};
__defs["games/rhythm-hack/render.js"] = function (exports, __req) {
/**
 * render.js — vẽ highway 4 lane phối cảnh của Rhythm Hack theo ảnh
 * reference: lane hẹp trên rộng dưới, màu cyan/tím/hồng/lime, note là
 * thanh phát sáng trượt xuống, vạch hit + đế nhận sáng khi nhấn, chữ
 * judgement PERFECT/GREAT/GOOD/MISS pop giữa màn, hạt sáng khi hit,
 * nhịp nền pulse theo beat. Kèm painter trái tim pixel (SYSTEM REPAIR).
 */

const LANE_COLORS = ["#20e3ff", "#9a5cff", "#ff2e96", "#a8ff3e"];
const APPROACH = 1.6; // giây từ mép trên tới vạch hit

function createHighwayRenderer(canvas, container) {
  const g = canvas.getContext("2d");
  let dpr = 1;
  let W = 0;
  let H = 0;

  const pops = []; // judgement text
  const bursts = []; // hạt khi hit
  const pressT = [0, 0, 0, 0]; // thời điểm nhấn lane
  const missT = [0, 0, 0, 0];

  function fit() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = container.clientWidth;
    H = container.clientHeight;
    canvas.width = Math.max(1, Math.round(W * dpr));
    canvas.height = Math.max(1, Math.round(H * dpr));
  }

  const topY = () => H * 0.05;
  const hitY = () => H * 0.8;
  const topW = () => W * 0.22;
  const botW = () => W * 0.92;

  /** Tọa độ x biên lane i (0..4) tại độ sâu k (0 trên → 1 vạch hit). */
  function edgeX(i, k) {
    const w = topW() + (botW() - topW()) * k;
    return W / 2 - w / 2 + (w / 4) * i;
  }

  const depth = (k) => k * k * 0.62 + k * 0.38; // phối cảnh: nhanh dần về gần

  function laneCenterX(lane, k) {
    return (edgeX(lane, k) + edgeX(lane + 1, k)) / 2;
  }

  function yAt(k) {
    return topY() + (hitY() - topY()) * k;
  }

  /* ---------------- API hiệu ứng ---------------- */

  function pop(text, color) {
    pops.push({ text, color, t0: performance.now() / 1000 });
    if (pops.length > 3) pops.shift();
  }

  function burst(lane, color, n = 10) {
    const x = laneCenterX(lane, 1);
    const y = hitY();
    for (let i = 0; i < n; i++) {
      if (bursts.length > 90) break;
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.8;
      const sp = 90 + Math.random() * 220;
      bursts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5, color });
    }
  }

  function press(lane) {
    pressT[lane] = performance.now() / 1000;
  }

  function miss(lane) {
    missT[lane] = performance.now() / 1000;
  }

  /* ---------------- khung hình ---------------- */

  function draw(songTime, notes, judge, beat, dt) {
    if (W === 0) fit();
    const now = performance.now() / 1000;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    // nền + pulse theo beat
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#070b20");
    bg.addColorStop(1, "#0a0f2a");
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    if (songTime > 0) {
      const beatK = 1 - ((songTime / beat) % 1);
      g.fillStyle = `rgba(32,120,255,${0.045 * beatK})`;
      g.fillRect(0, 0, W, H);
    }

    // mặt highway
    g.beginPath();
    g.moveTo(edgeX(0, 0), topY());
    g.lineTo(edgeX(4, 0), topY());
    g.lineTo(edgeX(4, 1), hitY());
    g.lineTo(edgeX(0, 1), hitY());
    g.closePath();
    g.fillStyle = "rgba(6, 9, 24, 0.85)";
    g.fill();

    // mỗi lane nhuộm màu riêng thường trực (như ảnh) + bừng sáng khi nhấn
    for (let i = 0; i < 4; i++) {
      const pk = Math.max(0, 1 - (now - pressT[i]) / 0.22);
      const grad = g.createLinearGradient(0, topY(), 0, hitY());
      const base = 0.13 + pk * 0.2;
      grad.addColorStop(0, `${LANE_COLORS[i]}00`);
      grad.addColorStop(0.55, `${LANE_COLORS[i]}${Math.round(base * 130).toString(16).padStart(2, "0")}`);
      grad.addColorStop(1, `${LANE_COLORS[i]}${Math.round(base * 255).toString(16).padStart(2, "0")}`);
      g.beginPath();
      g.moveTo(edgeX(i, 0), topY());
      g.lineTo(edgeX(i + 1, 0), topY());
      g.lineTo(edgeX(i + 1, 1), hitY());
      g.lineTo(edgeX(i, 1), hitY());
      g.closePath();
      g.fillStyle = grad;
      g.fill();
    }

    // vạch chia lane (hội tụ)
    for (let i = 0; i <= 4; i++) {
      const glow = i === 0 || i === 4;
      g.strokeStyle = glow ? "rgba(120, 170, 255, 0.5)" : "rgba(120, 150, 230, 0.22)";
      g.lineWidth = glow ? 2.4 : 1.4;
      g.beginPath();
      g.moveTo(edgeX(i, 0), topY());
      g.lineTo(edgeX(i, 1), hitY());
      g.stroke();
    }

    // vạch ngang mờ chạy xuống (cảm giác tốc độ)
    if (songTime > -3) {
      for (let r = 0; r < 6; r++) {
        const phase = ((songTime * 0.6 + r / 6) % 1 + 1) % 1;
        const k = depth(phase);
        g.strokeStyle = `rgba(100, 130, 210, ${0.1 * phase})`;
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(edgeX(0, k), yAt(k));
        g.lineTo(edgeX(4, k), yAt(k));
        g.stroke();
      }
    }

    // vạch HIT
    g.strokeStyle = "rgba(240, 246, 255, 0.85)";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(edgeX(0, 1) - 8, hitY());
    g.lineTo(edgeX(4, 1) + 8, hitY());
    g.stroke();

    // đế nhận (receptor)
    for (let i = 0; i < 4; i++) {
      const x = laneCenterX(i, 1);
      const pk = Math.max(0, 1 - (now - pressT[i]) / 0.25);
      const mk = Math.max(0, 1 - (now - missT[i]) / 0.3);
      const c = LANE_COLORS[i];
      g.save();
      g.strokeStyle = c;
      g.globalAlpha = 0.5 + pk * 0.5;
      g.lineWidth = 2.6 + pk * 2;
      g.beginPath();
      g.ellipse(x, hitY(), 30 + pk * 7, 10 + pk * 3, 0, 0, Math.PI * 2);
      g.stroke();
      if (pk > 0) {
        g.globalAlpha = pk * 0.5;
        g.fillStyle = c;
        g.beginPath();
        g.ellipse(x, hitY(), 22, 7, 0, 0, Math.PI * 2);
        g.fill();
      }
      if (mk > 0) {
        g.globalAlpha = mk * 0.6;
        g.strokeStyle = "#ff3b4f";
        g.beginPath();
        g.ellipse(x, hitY(), 34 + (1 - mk) * 14, 12, 0, 0, Math.PI * 2);
        g.stroke();
      }
      g.restore();
    }

    // notes (chỉ vẽ vùng nhìn thấy)
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      const tRel = n.time - songTime;
      if (tRel > APPROACH) break;
      if (tRel < -0.12 || judge.isDone(i)) continue;
      const k = depth(1 - tRel / APPROACH);
      const y = yAt(k);
      const laneW = edgeX(n.lane + 1, k) - edgeX(n.lane, k);
      const x = laneCenterX(n.lane, k);
      const w = laneW * 0.72;
      const h = 7 + k * 13;
      const c = LANE_COLORS[n.lane];
      g.save();
      g.shadowColor = c;
      g.shadowBlur = 6 + k * 10;
      g.fillStyle = c;
      g.beginPath();
      g.roundRect(x - w / 2, y - h / 2, w, h, h / 2);
      g.fill();
      g.shadowBlur = 0;
      g.fillStyle = "rgba(255,255,255,0.55)";
      g.beginPath();
      g.roundRect(x - w / 2 + 3, y - h / 2 + 2, w - 6, Math.max(2, h * 0.28), 3);
      g.fill();
      g.restore();
    }

    // hạt hit
    for (let i = bursts.length - 1; i >= 0; i--) {
      const p = bursts[i];
      p.life -= dt;
      if (p.life <= 0) {
        bursts.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 320 * dt;
      g.globalAlpha = Math.min(1, p.life * 2.4);
      g.fillStyle = p.color;
      g.fillRect(p.x - 2, p.y - 2, 4, 4);
      g.globalAlpha = 1;
    }

    // judgement pop (giữa màn như ảnh: ═ PERFECT ═)
    for (let i = pops.length - 1; i >= 0; i--) {
      const p = pops[i];
      const k = (now - p.t0) / 0.55;
      if (k > 1) {
        pops.splice(i, 1);
        continue;
      }
      const scale = k < 0.18 ? 0.7 + (k / 0.18) * 0.34 : 1.04 - (k - 0.18) * 0.06;
      g.save();
      g.translate(W / 2, H * 0.42);
      g.scale(scale, scale);
      g.globalAlpha = k > 0.72 ? 1 - (k - 0.72) / 0.28 : 1;
      g.font = `800 ${Math.round(Math.min(52, W * 0.062))}px 'JetBrains Mono', monospace`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.shadowColor = p.color;
      g.shadowBlur = 20;
      g.fillStyle = p.color;
      g.fillText(p.text, 0, 0);
      g.shadowBlur = 0;
      const tw = g.measureText(p.text).width;
      g.fillRect(-tw / 2 - 44, -2, 30, 4);
      g.fillRect(tw / 2 + 14, -2, 30, 4);
      g.restore();
    }

    // đếm ngược trước khi nhạc bắt đầu
    if (songTime < 0) {
      const n = Math.ceil(-songTime / beat);
      g.save();
      g.font = `800 ${Math.round(H * 0.14)}px 'JetBrains Mono', monospace`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillStyle = "rgba(240,246,255,0.9)";
      g.shadowColor = "#20e3ff";
      g.shadowBlur = 26;
      g.fillText(String(Math.max(1, n)), W / 2, H * 0.42);
      g.restore();
    }
  }

  /** Vùng chạm: quy đổi clientX → lane (theo bề rộng đáy highway). */
  function laneFromClientX(clientX) {
    const r = canvas.getBoundingClientRect();
    const x = clientX - r.left;
    for (let i = 0; i < 4; i++) {
      if (x >= edgeX(i, 1) && x < edgeX(i + 1, 1)) return i;
    }
    return x < W / 2 ? 0 : 3;
  }

  return { fit, draw, pop, burst, press, miss, laneFromClientX };
}

/* ---------------- Trái tim pixel (panel SYSTEM REPAIR như ảnh) ---------------- */

const HEART = [
  ".XX...XX.",
  "XXXX.XXXX",
  "XXXXXXXXX",
  "XXXXXXXXX",
  ".XXXXXXX.",
  "..XXXXX..",
  "...XXX...",
  "....X....",
];

function paintHeart(canvas, progress) {
  const rows = HEART.length;
  const cols = HEART[0].length;
  const cell = 12;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = cols * cell * dpr;
  canvas.height = rows * cell * dpr;
  const g = canvas.getContext("2d");
  g.scale(dpr, dpr);
  const cells = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (HEART[y][x] === "X") cells.push([x, y]);
    }
  }
  // thắp sáng từ dưới lên theo progress
  cells.sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  const lit = Math.round(cells.length * Math.max(0, Math.min(1, progress)));
  cells.forEach(([x, y], i) => {
    const on = i < lit;
    g.fillStyle = on ? "#2fa8ff" : "rgba(47, 123, 255, 0.16)";
    g.fillRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
    if (on) {
      g.fillStyle = "rgba(180, 230, 255, 0.65)";
      g.fillRect(x * cell + 2, y * cell + 2, 3, 3);
    }
  });
}

exports.createHighwayRenderer = createHighwayRenderer; exports.paintHeart = paintHeart; exports.LANE_COLORS = LANE_COLORS;
};
__defs["games/rhythm-hack/styles.js"] = function (exports, __req) {
/**
 * styles.js — CSS riêng Rhythm Hack: panel ĐIỂM/COMBO/CHÍNH XÁC bên
 * trái (khung cắt góc như ảnh), panel SYSTEM REPAIR (tim pixel + thanh
 * tiến trình) và TERMINAL bên phải, hàng phím D F J K dạng bát giác màu
 * theo lane — đồng thời là 4 vùng chạm cho mobile/tablet.
 */

const RH_CSS = /* css */ `
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
  font-size: 1.7rem;
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
  width: 64px;
  height: 56px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  clip-path: polygon(14px 0, calc(100% - 14px) 0, 100% 34%, 100% 100%, 0 100%, 0 34%);
  border: none;
  outline: 2px solid var(--tone);
  outline-offset: -2px;
  background: linear-gradient(180deg, rgba(14, 20, 46, 0.95), rgba(7, 10, 26, 0.95));
  color: var(--tone);
  font-family: inherit;
  font-size: 1.3rem;
  font-weight: 800;
  cursor: pointer;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  box-shadow: 0 4px 0 rgba(0, 0, 0, 0.5);
  transition: transform 0.06s ease, box-shadow 0.06s ease;
}

.rh-key[data-tone="cyan"]  { --tone: var(--cyan); }
.rh-key[data-tone="violet"]{ --tone: var(--violet); }
.rh-key[data-tone="pink"]  { --tone: var(--pink); }
.rh-key[data-tone="lime"]  { --tone: var(--lime); }

.rh-key.held,
.rh-key:active {
  transform: translateY(3px);
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.5), 0 0 22px color-mix(in srgb, var(--tone) 55%, transparent);
  background: linear-gradient(180deg, color-mix(in srgb, var(--tone) 24%, rgba(14, 20, 46, 0.95)), rgba(7, 10, 26, 0.95));
}

@media (max-width: 920px) {
  .rh-col { display: none; }
  .rh-key { width: 56px; height: 50px; }
}
`;

exports.RH_CSS = RH_CSS;
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

/* ---------- Portal Puzzle 404: board lưới navy + robot + portal ---------- */
function portalArt(ctx) {
  const rand = seededRand(1204);
  ctx.fillStyle = "#05081a";
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 24; i++) {
    ctx.fillStyle = rand() > 0.7 ? "rgba(32,227,255,.5)" : "rgba(150,170,230,.35)";
    ctx.fillRect(rand() * W, rand() * H, 1.5, 1.5);
  }

  // Board 9×5 với viền tường bevel
  const t = 30;
  const bx = 25;
  const by = 28;
  const cols = 9;
  const rows = 5;
  ctx.fillStyle = "#161d3c";
  ctx.fillRect(bx - 10, by - 10, cols * t + 20, rows * t + 20);
  ctx.fillStyle = "#3a4877";
  ctx.fillRect(bx - 10, by - 10, cols * t + 20, 5);
  ctx.fillRect(bx - 10, by - 10, 5, rows * t + 20);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? "#111834" : "#0e142d";
      ctx.fillRect(bx + x * t + 1, by + y * t + 1, t - 2, t - 2);
      ctx.strokeStyle = "rgba(96,128,210,.14)";
      ctx.strokeRect(bx + x * t + 0.5, by + y * t + 0.5, t - 1, t - 1);
    }
  }

  const cell = (gx, gy) => [bx + gx * t + t / 2, by + gy * t + t / 2];

  // Nét đứt nối 2 cổng cyan
  const [p1x, p1y] = cell(1, 3);
  const [p2x, p2y] = cell(7, 1);
  ctx.strokeStyle = "rgba(32,227,255,.4)";
  ctx.setLineDash([5, 6]);
  ctx.beginPath();
  ctx.moveTo(p1x, p1y);
  ctx.lineTo(p2x, p2y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Cổng cyan + tím
  const portal = (gx, gy, color) => {
    const [cx, cy] = cell(gx, gy);
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(cx, cy, t * 0.26, t * 0.36, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#04060f";
    ctx.beginPath();
    ctx.ellipse(cx, cy, t * 0.18, t * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  portal(1, 3, "#20e3ff");
  portal(7, 1, "#9a5cff");

  // Laser đỏ dọc
  const [lx] = cell(5, 0);
  ctx.fillStyle = "#2a0d16";
  ctx.fillRect(lx - 8, by - 12, 16, 12);
  ctx.strokeStyle = "#ff4f64";
  ctx.strokeRect(lx - 8, by - 12, 16, 12);
  const grad = ctx.createLinearGradient(lx - 4, 0, lx + 4, 0);
  grad.addColorStop(0, "rgba(255,42,63,0)");
  grad.addColorStop(0.5, "rgba(255,79,100,.9)");
  grad.addColorStop(1, "rgba(255,42,63,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(lx - 4, by, 8, rows * t);
  ctx.fillStyle = "rgba(255,240,244,.9)";
  ctx.fillRect(lx - 1, by, 2, rows * t);

  // Thùng gỗ
  const crate = (gx, gy) => {
    const [cx, cy] = cell(gx, gy);
    const s = t * 0.68;
    ctx.fillStyle = "#96622e";
    ctx.fillRect(cx - s / 2, cy - s / 2, s, s);
    ctx.strokeStyle = "#5f3c17";
    ctx.lineWidth = 2;
    ctx.strokeRect(cx - s / 2 + 1, cy - s / 2 + 1, s - 2, s - 2);
    ctx.strokeStyle = "#c08a4a";
    ctx.beginPath();
    ctx.moveTo(cx - s / 2 + 2, cy - s / 2 + 2);
    ctx.lineTo(cx + s / 2 - 2, cy + s / 2 - 2);
    ctx.moveTo(cx + s / 2 - 2, cy - s / 2 + 2);
    ctx.lineTo(cx - s / 2 + 2, cy + s / 2 - 2);
    ctx.stroke();
  };
  crate(3, 1);
  crate(6, 3);

  // Ô thoát xanh
  const [ex, ey] = cell(8, 0);
  ctx.save();
  ctx.shadowColor = "#4df77f";
  ctx.shadowBlur = 12;
  ctx.strokeStyle = "#4df77f";
  ctx.lineWidth = 2.4;
  ctx.strokeRect(ex - t * 0.32, ey - t * 0.32, t * 0.64, t * 0.64);
  ctx.beginPath();
  ctx.moveTo(ex, ey - t * 0.2);
  ctx.lineTo(ex + t * 0.2, ey);
  ctx.lineTo(ex, ey + t * 0.2);
  ctx.lineTo(ex - t * 0.2, ey);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();

  // Robot trắng mắt cyan
  const [rx, ry] = cell(2, 2);
  ctx.fillStyle = "rgba(32,227,255,.2)";
  ctx.beginPath();
  ctx.ellipse(rx, ry + t * 0.32, t * 0.3, t * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#eef2ff";
  ctx.beginPath();
  ctx.roundRect(rx - t * 0.28, ry - t * 0.26, t * 0.56, t * 0.5, 5);
  ctx.fill();
  ctx.fillStyle = "#0a1224";
  ctx.beginPath();
  ctx.roundRect(rx - t * 0.19, ry - t * 0.15, t * 0.38, t * 0.22, 3);
  ctx.fill();
  ctx.save();
  ctx.shadowColor = "#20e3ff";
  ctx.shadowBlur = 6;
  ctx.fillStyle = "#20e3ff";
  ctx.fillRect(rx - t * 0.1, ry - t * 0.08, 3, 4);
  ctx.fillRect(rx + t * 0.1 - 3, ry - t * 0.08, 3, 4);
  ctx.restore();

  // Công tắc xanh
  const [sx, sy] = cell(4, 4);
  ctx.fillStyle = "#0a0f24";
  ctx.beginPath();
  ctx.arc(sx, sy, t * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.shadowColor = "#3b7bff";
  ctx.shadowBlur = 8;
  ctx.fillStyle = "#3b7bff";
  ctx.beginPath();
  ctx.arc(sx, sy, t * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* ---------- Void Runner 404: parkour FPS giữa vực cyber ---------- */
function voidRunnerArt(ctx) {
  const rand = seededRand(4040);
  // Vực tím sâu
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0b0724");
  bg.addColorStop(0.55, "#150d38");
  bg.addColorStop(1, "#241352");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Tòa nhà mờ dưới vực với cửa sổ neon
  for (let i = 0; i < 9; i++) {
    const bx = rand() * W;
    const bw = 18 + rand() * 30;
    const by = 96 + rand() * 70;
    ctx.fillStyle = "rgba(10,8,30,0.9)";
    ctx.fillRect(bx, by, bw, H - by + 10);
    for (let wy = by + 4; wy < H - 6; wy += 8) {
      for (let wx = bx + 3; wx < bx + bw - 3; wx += 6) {
        if (rand() > 0.72) {
          ctx.fillStyle = rand() > 0.8 ? "rgba(228,44,255,.5)" : "rgba(34,228,255,.4)";
          ctx.fillRect(wx, wy, 2, 3);
        }
      }
    }
  }

  const vpX = W / 2;
  const vpY = 78;

  // Track platform lơ lửng chạy về điểm tụ
  ctx.fillStyle = "#161c38";
  ctx.beginPath();
  ctx.moveTo(46, H);
  ctx.lineTo(vpX - 34, vpY + 20);
  ctx.lineTo(vpX + 34, vpY + 20);
  ctx.lineTo(W - 46, H);
  ctx.closePath();
  ctx.fill();
  // Viền neon cyan hai mép
  for (const s of [-1, 1]) {
    ctx.strokeStyle = "rgba(34,228,255,.95)";
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(vpX + s * (W / 2 - 46), H);
    ctx.lineTo(vpX + s * 34, vpY + 20);
    ctx.stroke();
  }
  // Gap đen giữa track
  ctx.fillStyle = "rgba(11,7,36,0.94)";
  ctx.beginPath();
  ctx.moveTo(96, H - 26);
  ctx.lineTo(vpX - 21, vpY + 52);
  ctx.lineTo(vpX + 21, vpY + 52);
  ctx.lineTo(W - 96, H - 26);
  ctx.lineTo(W - 118, H - 44);
  ctx.lineTo(vpX + 16, vpY + 44);
  ctx.lineTo(vpX - 16, vpY + 44);
  ctx.lineTo(118, H - 44);
  ctx.closePath();
  ctx.fill();

  // Chevron boost cyan trên track
  ctx.fillStyle = "rgba(120,240,255,.9)";
  for (let i = 0; i < 2; i++) {
    const cy2 = 152 + i * 24;
    const w2 = 16 + i * 7;
    ctx.beginPath();
    ctx.moveTo(vpX - w2, cy2 + 10);
    ctx.lineTo(vpX, cy2);
    ctx.lineTo(vpX + w2, cy2 + 10);
    ctx.lineTo(vpX + w2, cy2 + 4);
    ctx.lineTo(vpX, cy2 - 6);
    ctx.lineTo(vpX - w2, cy2 + 4);
    ctx.closePath();
    ctx.fill();
  }

  // Laser đỏ ngang giữa 2 trụ
  const ly = 118;
  ctx.fillStyle = "#241640";
  ctx.fillRect(vpX - 52, ly - 14, 5, 20);
  ctx.fillRect(vpX + 47, ly - 14, 5, 20);
  ctx.strokeStyle = "rgba(255,46,77,.95)";
  ctx.lineWidth = 2.4;
  ctx.shadowColor = "#ff2e4d";
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(vpX - 48, ly - 5);
  ctx.lineTo(vpX + 48, ly - 5);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Cổng checkpoint lime phía xa
  ctx.strokeStyle = "rgba(183,242,50,.95)";
  ctx.lineWidth = 3;
  ctx.shadowColor = "#b7f232";
  ctx.shadowBlur = 9;
  ctx.strokeRect(vpX - 26, vpY - 4, 52, 40);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#b7f232";
  ctx.save();
  ctx.translate(vpX, vpY - 10);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-4, -4, 8, 8);
  ctx.restore();

  // Portal tím lơ lửng bên phải
  ctx.strokeStyle = "rgba(139,91,255,.9)";
  ctx.lineWidth = 3.4;
  ctx.shadowColor = "#8b5bff";
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(258, 74, 21, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(228,44,255,.75)";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(258, 74, 14, 0, Math.PI * 2);
  ctx.stroke();

  // Shard lime bên trái
  ctx.save();
  ctx.translate(66, 84);
  ctx.fillStyle = "rgba(183,242,50,.95)";
  ctx.shadowColor = "#b7f232";
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.lineTo(8, 0);
  ctx.lineTo(0, 14);
  ctx.lineTo(-8, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Hai bàn tay găng neon (trái magenta / phải cyan)
  const hand = (hx, flip, accent) => {
    ctx.save();
    ctx.translate(hx, H + 14);
    ctx.rotate(flip * 0.42);
    ctx.fillStyle = "#10131f";
    ctx.beginPath();
    ctx.roundRect(-20, -58, 40, 62, 9);
    ctx.fill();
    for (let f = 0; f < 4; f++) {
      ctx.beginPath();
      ctx.roundRect(-17 + f * 9.4, -72, 7.4, 20, 3.4);
      ctx.fill();
    }
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2.4;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 7;
    ctx.beginPath();
    ctx.moveTo(0, -30);
    ctx.lineTo(8, -44);
    ctx.lineTo(-8, -44);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-19, -6);
    ctx.lineTo(19, -6);
    ctx.stroke();
    ctx.restore();
  };
  hand(58, -0.28, "rgba(228,44,255,.95)");
  hand(W - 58, 0.28, "rgba(34,228,255,.95)");

  // Speed lines
  ctx.strokeStyle = "rgba(190,240,255,.35)";
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 7; i++) {
    const a = rand() * Math.PI * 2;
    const r0 = 64 + rand() * 60;
    const x0 = vpX + Math.cos(a) * r0 * 1.6;
    const y0 = 104 + Math.sin(a) * r0 * 0.8;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + (x0 - vpX) * 0.22, y0 + (y0 - 104) * 0.22);
    ctx.stroke();
  }
}

/* ---------- Neon Drift 404: khúc cua neon + xe drift ---------- */
function driftArt(ctx) {
  const rand = seededRand(707);
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#120a2c");
  bg.addColorStop(1, "#070414");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // nhà neon hai bên
  for (let i = 0; i < 7; i++) {
    const bw = 34 + rand() * 40;
    const bh = 30 + rand() * 46;
    const x = rand() * (W - bw);
    const y = rand() > 0.5 ? rand() * 34 : H - bh - rand() * 24;
    ctx.fillStyle = "#0d0a20";
    ctx.fillRect(x, y, bw, bh);
    ctx.strokeStyle = rand() > 0.5 ? "rgba(255,46,230,.55)" : "rgba(32,227,255,.55)";
    ctx.strokeRect(x, y, bw, bh);
    ctx.fillStyle = "rgba(32,227,255,.3)";
    for (let wy = y + 6; wy < y + bh - 4; wy += 9) ctx.fillRect(x + 5, wy, bw - 10, 2.5);
  }

  // khúc cua: đường asphalt cong với 2 mép neon
  const roadPath = new Path2D();
  roadPath.moveTo(-20, 168);
  roadPath.bezierCurveTo(90, 150, 150, 76, 250, 66);
  roadPath.lineTo(360, 60);
  ctx.strokeStyle = "#131120";
  ctx.lineWidth = 62;
  ctx.lineCap = "round";
  ctx.stroke(roadPath);
  ctx.strokeStyle = "rgba(255,46,230,.3)";
  ctx.lineWidth = 70;
  ctx.stroke(roadPath);
  ctx.strokeStyle = "#131120";
  ctx.lineWidth = 62;
  ctx.stroke(roadPath);
  ctx.strokeStyle = "#ff2ee6";
  ctx.lineWidth = 3;
  ctx.save();
  ctx.translate(0, -33);
  ctx.stroke(roadPath);
  ctx.restore();
  ctx.strokeStyle = "#20e3ff";
  ctx.save();
  ctx.translate(0, 33);
  ctx.stroke(roadPath);
  ctx.restore();
  ctx.strokeStyle = "rgba(240,244,255,.5)";
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 16]);
  ctx.stroke(roadPath);
  ctx.setLineDash([]);

  // vệt drift hồng
  ctx.strokeStyle = "rgba(255,46,230,.75)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(78, 172);
  ctx.quadraticCurveTo(120, 150, 158, 118);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,46,230,.35)";
  ctx.lineWidth = 8;
  ctx.stroke();

  // xe người chơi drift
  ctx.save();
  ctx.translate(170, 108);
  ctx.rotate(-0.55);
  ctx.shadowColor = "#ff2ee6";
  ctx.shadowBlur = 14;
  ctx.fillStyle = "#dfe8ff";
  ctx.beginPath();
  ctx.roundRect(-17, -9, 34, 18, 6);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#0b1226";
  ctx.beginPath();
  ctx.roundRect(-4, -6.5, 11, 13, 4);
  ctx.fill();
  ctx.fillStyle = "#20e3ff";
  ctx.fillRect(-17, -9, 26, 2.4);
  ctx.fillRect(-17, 6.6, 26, 2.4);
  ctx.fillStyle = "#ff2ee6";
  ctx.beginPath();
  ctx.roundRect(11, -8, 6, 16, 3);
  ctx.fill();
  ctx.restore();

  // pickup lục giác lime
  ctx.save();
  ctx.translate(238, 82);
  ctx.shadowColor = "#a8ff3e";
  ctx.shadowBlur = 10;
  ctx.strokeStyle = "#a8ff3e";
  ctx.fillStyle = "rgba(28,46,8,.92)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    const x = Math.cos(a) * 11;
    const y = Math.sin(a) * 11;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#a8ff3e";
  ctx.beginPath();
  ctx.moveTo(1.5, -6);
  ctx.lineTo(-3.5, 1.5);
  ctx.lineTo(-0.5, 1.5);
  ctx.lineTo(-1.5, 6);
  ctx.lineTo(3.5, -1.5);
  ctx.lineTo(0.5, -1.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // banner CHECKPOINT
  ctx.fillStyle = "rgba(10,14,8,.9)";
  ctx.fillRect(224, 26, 88, 18);
  ctx.strokeStyle = "#a8ff3e";
  ctx.lineWidth = 1.6;
  ctx.strokeRect(224, 26, 88, 18);
  ctx.fillStyle = "#a8ff3e";
  ctx.font = "800 10px monospace";
  ctx.textAlign = "center";
  ctx.shadowColor = "#a8ff3e";
  ctx.shadowBlur = 8;
  ctx.fillText("CHECKPOINT", 268, 39);
  ctx.shadowBlur = 0;

  // minimap góc trái
  ctx.fillStyle = "rgba(6,9,24,.85)";
  ctx.strokeStyle = "rgba(32,227,255,.5)";
  ctx.beginPath();
  ctx.roundRect(10, 10, 64, 46, 7);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,46,230,.9)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(42, 33, 22, 13, -0.2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#4df77f";
  ctx.beginPath();
  ctx.arc(56, 28, 2.6, 0, Math.PI * 2);
  ctx.fill();
}

/* ---------- Cyber Defense: bảng mạch + tháp + CORE ---------- */
function defenseArt(ctx) {
  const rand = seededRand(808);
  ctx.fillStyle = "#071021";
  ctx.fillRect(0, 0, W, H);

  // trace mạch in
  ctx.strokeStyle = "rgba(32,120,200,.18)";
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 16; i++) {
    let x = rand() * W;
    let y = rand() * H;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 2; k++) {
      const len = 20 + rand() * 50;
      if (rand() > 0.5) x += rand() > 0.5 ? len : -len;
      else y += rand() > 0.5 ? len : -len;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = "rgba(32,120,200,.3)";
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // tuyến đường
  const path = new Path2D();
  path.moveTo(-10, 60);
  path.lineTo(90, 60);
  path.lineTo(90, 130);
  path.lineTo(190, 130);
  path.lineTo(190, 80);
  path.lineTo(258, 80);
  ctx.strokeStyle = "rgba(47,123,255,.3)";
  ctx.lineWidth = 30;
  ctx.lineJoin = "round";
  ctx.stroke(path);
  ctx.strokeStyle = "#0d1b3a";
  ctx.lineWidth = 24;
  ctx.stroke(path);
  ctx.strokeStyle = "#2f7bff";
  ctx.lineWidth = 1.6;
  ctx.stroke(path);

  // mũi tên vào
  ctx.fillStyle = "#ff4fd8";
  for (let k = 0; k < 2; k++) {
    ctx.beginPath();
    ctx.moveTo(8 + k * 12, 52);
    ctx.lineTo(20 + k * 12, 60);
    ctx.lineTo(8 + k * 12, 68);
    ctx.closePath();
    ctx.fill();
  }

  // pad + tháp
  const pad = (x, y) => {
    ctx.strokeStyle = "rgba(190,255,80,.55)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI / 4) * i + Math.PI / 8;
      const px = x + Math.cos(a) * 15;
      const py = y + Math.sin(a) * 15;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  };
  pad(50, 120);
  pad(150, 55);
  pad(230, 140);

  const tower = (x, y, color) => {
    ctx.fillStyle = "#0c142c";
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI / 4) * i + Math.PI / 8;
      const px = x + Math.cos(a) * 14;
      const py = y + Math.sin(a) * 14;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.fillRect(x - 2, y - 14, 10, 3);
    ctx.beginPath();
    ctx.arc(x, y - 8, 4.5, 0, Math.PI * 2);
    ctx.fill();
  };
  tower(140, 105, "#20e3ff");
  tower(60, 30, "#9a5cff");

  // range circle nét đứt
  ctx.strokeStyle = "rgba(32,227,255,.5)";
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.arc(140, 105, 42, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // bot với thanh máu
  const bot = (x, y) => {
    ctx.fillStyle = "#121830";
    ctx.strokeStyle = "#44507f";
    ctx.beginPath();
    ctx.roundRect(x - 7, y - 6, 14, 12, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ff4f64";
    ctx.fillRect(x - 3, y - 2, 6, 3);
    ctx.fillStyle = "rgba(10,10,20,.8)";
    ctx.fillRect(x - 8, y - 13, 16, 3);
    ctx.fillStyle = "#ff3b4f";
    ctx.fillRect(x - 8, y - 13, 10, 3);
  };
  bot(60, 60);
  bot(110, 130);
  bot(150, 130);

  // tia đạn cyan
  ctx.strokeStyle = "#20e3ff";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(140, 96);
  ctx.lineTo(118, 126);
  ctx.stroke();

  // CORE cube
  ctx.save();
  ctx.translate(272, 80);
  ctx.strokeStyle = "rgba(32,227,255,.5)";
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    const px = Math.cos(a) * 26;
    const py = Math.sin(a) * 23;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.shadowColor = "#20e3ff";
  ctx.shadowBlur = 12;
  ctx.strokeStyle = "#20e3ff";
  ctx.lineWidth = 2;
  ctx.strokeRect(-11, -11, 22, 22);
  ctx.strokeRect(-6, -15, 22, 22);
  ctx.beginPath();
  ctx.moveTo(-11, -11); ctx.lineTo(-6, -15);
  ctx.moveTo(11, -11); ctx.lineTo(16, -15);
  ctx.moveTo(11, 11); ctx.lineTo(16, 7);
  ctx.moveTo(-11, 11); ctx.lineTo(-6, 7);
  ctx.stroke();
  ctx.restore();

  // badge CORE %
  ctx.fillStyle = "rgba(8,14,28,.92)";
  ctx.strokeStyle = "#a8ff3e";
  ctx.lineWidth = 1.4;
  ctx.fillRect(244, 18, 56, 24);
  ctx.strokeRect(244, 18, 56, 24);
  ctx.fillStyle = "#a8ff3e";
  ctx.font = "800 11px monospace";
  ctx.textAlign = "center";
  ctx.fillText("CORE 86%", 272, 34);
}

/* ---------- Rogue Arena: đấu trường neon + robot + enemy hình học ---------- */
function rogueArt(ctx) {
  const rand = seededRand(909);
  const bg = ctx.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, 220);
  bg.addColorStop(0, "#0d1330");
  bg.addColorStop(1, "#060a1c");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // vòng tròn sàn + tường
  ctx.strokeStyle = "rgba(100,140,255,.14)";
  ctx.lineWidth = 1.6;
  for (const r of [28, 52, 76]) {
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(110,130,210,.4)";
  ctx.lineWidth = 3;
  ctx.strokeRect(8, 8, W - 16, H - 16);
  // dải neon góc
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(255,46,150,1)";
  ctx.beginPath();
  ctx.moveTo(52, 12);
  ctx.lineTo(12, 12);
  ctx.lineTo(12, 52);
  ctx.stroke();
  ctx.strokeStyle = "rgba(32,227,255,1)";
  ctx.beginPath();
  ctx.moveTo(W - 52, H - 12);
  ctx.lineTo(W - 12, H - 12);
  ctx.lineTo(W - 12, H - 52);
  ctx.stroke();

  // tia điện tỏa từ robot
  ctx.strokeStyle = "rgba(32,227,255,.8)";
  ctx.lineWidth = 3;
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i + 0.4;
    ctx.beginPath();
    ctx.moveTo(W / 2 + Math.cos(a) * 22, H / 2 + Math.sin(a) * 22);
    ctx.lineTo(W / 2 + Math.cos(a) * (44 + rand() * 22), H / 2 + Math.sin(a) * (40 + rand() * 20));
    ctx.stroke();
  }

  // robot giữa
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.strokeStyle = "rgba(32,227,255,.4)";
  ctx.beginPath();
  ctx.arc(0, 5, 17, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#e8edff";
  ctx.beginPath();
  ctx.roundRect(-10, -11, 20, 20, 5);
  ctx.fill();
  ctx.fillStyle = "#0a1224";
  ctx.beginPath();
  ctx.roundRect(-6, -7, 12, 7, 3);
  ctx.fill();
  ctx.save();
  ctx.shadowColor = "#20e3ff";
  ctx.shadowBlur = 7;
  ctx.fillStyle = "#20e3ff";
  ctx.fillRect(-4, -5.4, 8, 3);
  ctx.restore();
  ctx.restore();

  // enemy hình học
  const tri = (x, y, r, color, dark) => {
    ctx.fillStyle = dark;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r, y + r * 0.75);
    ctx.lineTo(x - r, y + r * 0.75);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(10,10,20,.8)";
    ctx.fillRect(x - r * 0.8, y - r - 7, r * 1.6, 3);
    ctx.fillStyle = "#ff3b4f";
    ctx.fillRect(x - r * 0.8, y - r - 7, r * 1.1, 3);
  };
  tri(64, 66, 13, "#ff2e96", "#3d1030");
  tri(250, 148, 12, "#ff2e96", "#3d1030");
  tri(226, 52, 11, "#ff3b4f", "#3c0a12");
  // shooter cube
  ctx.fillStyle = "#38080c";
  ctx.strokeStyle = "#ff3b4f";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(272, 82, 26, 26, 4);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "#ff8091";
  ctx.beginPath();
  ctx.arc(285, 95, 6, 0, Math.PI * 2);
  ctx.stroke();
  // tank cube tím
  ctx.fillStyle = "#241040";
  ctx.strokeStyle = "#9a5cff";
  ctx.beginPath();
  ctx.roundRect(52, 128, 30, 30, 5);
  ctx.fill();
  ctx.stroke();

  // gem XP
  const gem = (x, y) => {
    ctx.fillStyle = "#20e3ff";
    ctx.beginPath();
    ctx.moveTo(x, y - 6);
    ctx.lineTo(x + 4.5, y);
    ctx.lineTo(x, y + 6);
    ctx.lineTo(x - 4.5, y);
    ctx.closePath();
    ctx.fill();
  };
  gem(130, 140);
  gem(196, 60);
  gem(160, 158);
  // hex XP lime
  ctx.strokeStyle = "#a8ff3e";
  ctx.fillStyle = "rgba(30,46,8,.92)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    const x = 118 + Math.cos(a) * 11;
    const y = 84 + Math.sin(a) * 11;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#a8ff3e";
  ctx.font = "800 8px monospace";
  ctx.textAlign = "center";
  ctx.fillText("XP", 118, 87);
  // chữ nổi
  ctx.fillStyle = "#20e3ff";
  ctx.font = "800 11px monospace";
  ctx.fillText("+40 XP", 108, 118);
}

/* ---------- Rhythm Hack: highway 4 lane phối cảnh ---------- */
function rhythmArt(ctx) {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#070b20");
  bg.addColorStop(1, "#0a0f2a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const laneColors = ["#20e3ff", "#9a5cff", "#ff2e96", "#a8ff3e"];
  const topY = 16;
  const hitY = 158;
  const topW = 74;
  const botW = 286;
  const edgeX = (i, k) => {
    const w = topW + (botW - topW) * k;
    return W / 2 - w / 2 + (w / 4) * i;
  };

  // mặt highway
  ctx.fillStyle = "rgba(6,9,24,.9)";
  ctx.beginPath();
  ctx.moveTo(edgeX(0, 0), topY);
  ctx.lineTo(edgeX(4, 0), topY);
  ctx.lineTo(edgeX(4, 1), hitY);
  ctx.lineTo(edgeX(0, 1), hitY);
  ctx.closePath();
  ctx.fill();

  // vạch chia lane
  for (let i = 0; i <= 4; i++) {
    ctx.strokeStyle = i === 0 || i === 4 ? "rgba(120,170,255,.55)" : "rgba(120,150,230,.25)";
    ctx.lineWidth = i === 0 || i === 4 ? 2.4 : 1.4;
    ctx.beginPath();
    ctx.moveTo(edgeX(i, 0), topY);
    ctx.lineTo(edgeX(i, 1), hitY);
    ctx.stroke();
  }

  // notes trên các lane
  const note = (lane, k) => {
    const y = topY + (hitY - topY) * (k * k * 0.62 + k * 0.38);
    const w = (edgeX(lane + 1, k) - edgeX(lane, k)) * 0.72;
    const x = (edgeX(lane, k) + edgeX(lane + 1, k)) / 2;
    const h = 5 + k * 9;
    ctx.save();
    ctx.shadowColor = laneColors[lane];
    ctx.shadowBlur = 8;
    ctx.fillStyle = laneColors[lane];
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2);
    ctx.fill();
    ctx.restore();
  };
  note(0, 0.3);
  note(1, 0.55);
  note(2, 0.75);
  note(3, 0.42);
  note(1, 0.16);

  // vạch hit + đế nhận
  ctx.strokeStyle = "rgba(240,246,255,.85)";
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(edgeX(0, 1) - 6, hitY);
  ctx.lineTo(edgeX(4, 1) + 6, hitY);
  ctx.stroke();
  for (let i = 0; i < 4; i++) {
    const x = (edgeX(i, 1) + edgeX(i + 1, 1)) / 2;
    ctx.strokeStyle = laneColors[i];
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(x, hitY, 20, 6.5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // chữ PERFECT giữa
  ctx.save();
  ctx.font = "800 22px monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = "#20e3ff";
  ctx.shadowColor = "#20e3ff";
  ctx.shadowBlur = 14;
  ctx.fillText("PERFECT", W / 2, 92);
  ctx.fillRect(W / 2 - 86, 89, 18, 3);
  ctx.fillRect(W / 2 + 68, 89, 18, 3);
  ctx.restore();

  // phím D F J K
  const keys = ["D", "F", "J", "K"];
  for (let i = 0; i < 4; i++) {
    const x = (edgeX(i, 1) + edgeX(i + 1, 1)) / 2;
    ctx.fillStyle = "rgba(10,14,32,.95)";
    ctx.strokeStyle = laneColors[i];
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x - 17, 168, 34, 26, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = laneColors[i];
    ctx.font = "800 15px monospace";
    ctx.textAlign = "center";
    ctx.fillText(keys[i], x, 187);
  }
}

const PAINTERS = {
  runner: runnerArt,
  "bug-hunter": bugArt,
  "stack-tower": stackArt,
  snake: snakeArt,
  strike: strikeArt,
  "portal-puzzle": portalArt,
  "neon-drift": driftArt,
  "cyber-defense": defenseArt,
  "rogue-arena": rogueArt,
  "rhythm-hack": rhythmArt,
  "void-runner": voidRunnerArt,
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
