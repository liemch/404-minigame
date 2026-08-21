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

import { getGame } from "./game-registry.js";
import { createOverlayManager } from "../ui/overlays.js";

export function createController({ refs, storage, audio, emit, config, onScoreSaved }) {
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
