/**
 * shell.js — "vỏ" chạy game: quản lý cửa sổ game, vòng đời và overlay.
 *
 * Đảm bảo các ràng buộc kiến trúc:
 *  - Chỉ MỘT game hoạt động tại một thời điểm (mở game mới → hủy game cũ).
 *  - Module game chỉ được import khi người dùng chọn (lazy-load).
 *  - Esc đóng game, P tạm dừng, tự pause khi tab bị ẩn.
 *  - Game over: hiển thị điểm, kỷ lục, Chơi lại / Đổi game / Về trang chủ.
 */

import { getGame } from "./registry.js";
import { storage } from "./storage.js";
import { audio } from "./audio.js";
import { el, formatScore } from "./utils.js";

export function createShell({ onScoreSaved } = {}) {
  const backdrop = document.getElementById("stage");
  const win = backdrop.querySelector(".game-window");
  const titleEl = document.getElementById("stage-title");
  const surface = document.getElementById("game-surface");
  const hudRoot = document.getElementById("game-hud");
  const overlay = document.getElementById("stage-overlay");
  const btnPause = document.getElementById("btn-pause");
  const btnPauseLabel = document.getElementById("btn-pause-label");
  const btnPauseIcon = btnPause.querySelector("use");
  const btnSwitch = document.getElementById("btn-switch");

  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  /** Game đang hoạt động: { id, meta, game, status } */
  let current = null;
  let openToken = 0; // chống race khi mở/đóng nhanh trong lúc import
  let openerEl = null; // phần tử đã mở game (để trả focus khi đóng)

  /* ---------- Overlay helpers ---------- */

  function showOverlay() {
    overlay.hidden = false;
    overlay.textContent = "";
    const panel = el("div", "stage-panel");
    overlay.appendChild(panel);
    return panel;
  }

  function hideOverlay() {
    overlay.hidden = true;
    overlay.textContent = "";
  }

  function focusPrimary(btn) {
    requestAnimationFrame(() => btn.focus());
  }

  /** Nút trong overlay: tự blur sau khi click chuột để Space không kích lại. */
  function panelBtn(label, onClick, { solid = false } = {}) {
    const btn = el("button", `btn${solid ? " btn-solid" : ""}`, label);
    btn.type = "button";
    btn.addEventListener("click", (e) => {
      if (e.detail > 0) btn.blur();
      onClick();
    });
    return btn;
  }

  function showLoading(meta) {
    const panel = showOverlay();
    const loader = el("div", "pix-loader");
    for (let i = 0; i < 4; i++) loader.appendChild(el("i"));
    panel.appendChild(loader);
    panel.appendChild(el("h3", "panel-title", "Đang tải"));
    panel.appendChild(el("p", "panel-sub", meta.title));
  }

  function showError(meta) {
    const panel = showOverlay();
    panel.appendChild(el("h3", "panel-title danger", "Không tải được trò chơi"));
    panel.appendChild(el("p", "panel-sub", "Có lỗi khi tải module. Kiểm tra kết nối rồi thử lại."));
    const row = el("div", "btn-row");
    row.style.marginTop = "16px";
    const retry = panelBtn("Thử lại", () => open(meta.id, openerEl), { solid: true });
    const back = panelBtn("Đóng", () => close({ toGames: true }));
    row.append(retry, back);
    panel.appendChild(row);
    focusPrimary(retry);
  }

  function showIntro(meta) {
    const panel = showOverlay();
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
    const startBtn = panelBtn("Bắt đầu", () => {
      if (!current || current.status !== "ready") return;
      hideOverlay();
      audio.play("start");
      current.game.start();
      current.status = "running";
      syncPauseBtn();
    }, { solid: true });
    row.appendChild(startBtn);
    panel.appendChild(row);
    focusPrimary(startBtn);
  }

  function showPaused() {
    const panel = showOverlay();
    panel.appendChild(el("h3", "panel-title", "Tạm dừng"));
    panel.appendChild(el("p", "panel-sub", "Nghỉ chút cũng được, game vẫn chờ bạn ở đây."));
    const row = el("div", "btn-row");
    row.style.marginTop = "16px";
    const resumeBtn = panelBtn("Tiếp tục", resume, { solid: true });
    const restartBtn = panelBtn("Chơi lại", restart);
    const switchBtn = panelBtn("Đổi game", () => close({ toGames: true }));
    row.append(resumeBtn, restartBtn, switchBtn);
    panel.appendChild(row);
    focusPrimary(resumeBtn);
  }

  function showGameOver(score, saved) {
    const panel = showOverlay();
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
    const againBtn = panelBtn("Chơi lại", restart, { solid: true });
    const switchBtn = panelBtn("Đổi game", () => close({ toGames: true }));
    const homeLink = el("a", "btn", "Về trang chủ");
    homeLink.href = document.body.dataset.homeUrl || "/";
    row.append(againBtn, switchBtn, homeLink);
    panel.appendChild(row);
    focusPrimary(againBtn);
  }

  /* ---------- Điều khiển vòng đời ---------- */

  function syncPauseBtn() {
    const status = current?.status;
    const canPause = status === "running" || status === "paused";
    btnPause.disabled = !canPause;
    const paused = status === "paused";
    btnPauseLabel.textContent = paused ? "Tiếp tục" : "Tạm dừng";
    btnPauseIcon.setAttribute("href", paused ? "#i-play" : "#i-pause");
  }

  function pause() {
    if (!current || current.status !== "running") return;
    current.game.pause();
    current.status = "paused";
    showPaused();
    syncPauseBtn();
  }

  function resume() {
    if (!current || current.status !== "paused") return;
    hideOverlay();
    current.game.resume();
    current.status = "running";
    syncPauseBtn();
  }

  function restart() {
    if (!current) return;
    hideOverlay();
    audio.play("start");
    current.game.restart();
    current.status = "running";
    syncPauseBtn();
  }

  function handleGameOver(score) {
    if (!current) return;
    current.status = "over";
    syncPauseBtn();
    const saved = storage.saveScore(current.id, score);
    onScoreSaved?.(current.id, saved);
    audio.play(saved.isRecord ? "record" : "over");
    showGameOver(score, saved);
  }

  /* ---------- Phím tắt khi cửa sổ game đang mở ---------- */

  function onStageKey(e) {
    if (e.code === "Escape") {
      e.preventDefault();
      close({ toGames: true });
    } else if (e.code === "KeyP") {
      e.preventDefault();
      if (!current) return;
      if (current.status === "running") pause();
      else if (current.status === "paused") resume();
    }
  }

  /* ---------- Mở / đóng game ---------- */

  async function open(id, opener) {
    const meta = getGame(id);
    if (!meta) return;

    if (current) close({ silent: true });

    openToken += 1;
    const token = openToken;
    openerEl = opener || null;

    // Hiện cửa sổ + khóa cuộn trang
    win.dataset.accent = meta.accent;
    titleEl.textContent = meta.title;
    backdrop.hidden = false;
    document.body.classList.add("modal-open");
    window.addEventListener("keydown", onStageKey);
    btnPause.disabled = true;
    showLoading(meta);

    // Lazy-load module game — chỉ tải khi người dùng chọn
    let module;
    try {
      module = await meta.loader();
    } catch {
      if (token === openToken && !backdrop.hidden) showError(meta);
      return;
    }

    // Người dùng đã đóng hoặc mở game khác trong lúc tải → bỏ qua
    if (token !== openToken || backdrop.hidden) return;

    const game = module.createGame();
    current = { id, meta, game, status: "ready" };

    game.mount(surface, {
      audio,
      hudRoot,
      reducedMotion: reducedMotionQuery.matches,
      getBest: () => storage.getScores(id).best,
      onGameOver: handleGameOver,
    });

    showIntro(meta);
    syncPauseBtn();
  }

  function close({ silent = false, toGames = false } = {}) {
    openToken += 1; // vô hiệu hóa mọi lượt import đang chờ

    if (current) {
      try {
        current.game.destroy();
      } catch {
        /* game hỏng khi hủy cũng không được chặn việc đóng cửa sổ */
      }
      current = null;
    }

    // Dọn sạch DOM để không rò rỉ canvas/listener
    surface.textContent = "";
    hudRoot.textContent = "";
    hideOverlay();

    backdrop.hidden = true;
    document.body.classList.remove("modal-open");
    window.removeEventListener("keydown", onStageKey);
    syncPauseBtn();

    if (silent) return;

    if (toGames) {
      document.getElementById("games")?.scrollIntoView({ block: "nearest" });
    }
    if (openerEl && document.contains(openerEl)) {
      openerEl.focus({ preventScroll: !toGames });
    }
    openerEl = null;
  }

  /* ---------- Sự kiện toàn cục ---------- */

  // Tự tạm dừng khi tab bị ẩn (đổi tab, thu nhỏ cửa sổ...)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") pause();
  });

  // Nút trên thanh tiêu đề cửa sổ
  btnPause.addEventListener("click", (e) => {
    if (e.detail > 0) btnPause.blur();
    if (!current) return;
    if (current.status === "running") pause();
    else if (current.status === "paused") resume();
  });

  btnSwitch.addEventListener("click", () => close({ toGames: true }));

  return { open, close };
}
