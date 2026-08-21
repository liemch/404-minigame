/**
 * overlays.js — các panel overlay dùng chung cho game 2D:
 * đang tải / lỗi / hướng dẫn / tạm dừng / game over.
 * (404 Strike tự vẽ màn hình riêng theo reference, không dùng file này.)
 */

import { el, formatScore } from "../core/utils.js";

export function createOverlayManager(overlayEl) {
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
