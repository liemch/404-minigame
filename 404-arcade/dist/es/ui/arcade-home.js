/**
 * arcade-home.js — dựng trang chọn game bên trong shadow DOM:
 * logo pixel + lưới card (tranh preview, hướng dẫn, điểm, nút Chơi ngay).
 */

import { el } from "../core/utils.js";
import { renderArcadeLogo } from "../core/pixel-text.js";
import { paintPreview } from "../core/previews.js";
import { createCard } from "./game-card.js";

export function buildHome({ refs, games, storage, audio, onPlay }) {
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
