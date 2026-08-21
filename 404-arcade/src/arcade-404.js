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

import { CORE_CSS } from "./ui/styles/core.js";
import { SHELL_CSS } from "./ui/styles/shell.js";
import { ROOT_HTML } from "./ui/template.js";
import { createStorage } from "./core/storage.js";
import { createAudio } from "./core/audio-manager.js";
import { createEmitter } from "./core/events.js";
import { createController } from "./core/game-controller.js";
import { enabledGames } from "./core/game-registry.js";
import { buildHome } from "./ui/arcade-home.js";

export class Arcade404 extends HTMLElement {
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
