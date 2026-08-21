/**
 * game-card.js — một card game trên trang chọn game.
 * Toàn bộ nội dung động dựng bằng DOM API (không innerHTML).
 */

import { el, formatNumber } from "../core/utils.js";

export function createCard({ meta, scores, paintPreview, onPlay }) {
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
