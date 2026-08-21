/**
 * main.js — điểm vào của 404 Arcade.
 * Dựng logo pixel, danh sách card game, nối shell chạy game,
 * đồng bộ nút âm thanh và liên kết "Về trang chủ".
 */

import { GAMES } from "./core/registry.js";
import { storage } from "./core/storage.js";
import { audio } from "./core/audio.js";
import { createShell } from "./core/shell.js";
import { renderLogo } from "./core/pixel-text.js";
import { paintPreview } from "./core/previews.js";
import { el, formatNumber } from "./core/utils.js";

/* ---------- Liên kết "Về trang chủ" ----------
   Đổi đích đến bằng thuộc tính data-home-url trên <body>
   (hữu ích khi nhúng vào trang 404 của website khác). */
const homeUrl = document.body.dataset.homeUrl || "/";
document.querySelectorAll("[data-home-link]").forEach((a) => {
  a.setAttribute("href", homeUrl);
});

/* ---------- Logo pixel ---------- */
renderLogo(document.getElementById("logo"));

/* ---------- Mở khóa audio sau tương tác đầu tiên ----------
   Chỉ chấp nhận sự kiện thật từ người dùng (isTrusted) để không bao giờ
   tạo AudioContext trước khi có cử chỉ hợp lệ (chính sách autoplay). */
const unlockAudio = (e) => {
  if (!e.isTrusted) return;
  audio.unlock();
  window.removeEventListener("pointerdown", unlockAudio, true);
  window.removeEventListener("keydown", unlockAudio, true);
};
window.addEventListener("pointerdown", unlockAudio, { capture: true });
window.addEventListener("keydown", unlockAudio, { capture: true });

/* ---------- Danh sách card game ---------- */
const grid = document.getElementById("card-grid");
const cardRefs = new Map(); // id → { card, last, best }

function makeCard(meta) {
  const card = el("article", "game-card");
  card.dataset.accent = meta.accent;

  // Tranh minh họa (canvas tĩnh)
  const art = el("div", "card-art");
  const artCanvas = document.createElement("canvas");
  artCanvas.setAttribute("aria-hidden", "true");
  art.appendChild(artCanvas);
  card.appendChild(art);
  paintPreview(meta.id, artCanvas);

  const body = el("div", "card-body");

  body.appendChild(el("h3", "card-title", meta.title));

  // Hướng dẫn điều khiển ngắn
  const hint = el("p", "card-hint");
  for (const key of meta.hint.keys) hint.appendChild(el("kbd", "", key));
  hint.appendChild(el("span", "", meta.hint.text));
  body.appendChild(hint);

  // Điểm gần nhất + kỷ lục
  const scores = storage.getScores(meta.id);
  const stats = el("dl", "card-stats");
  const lastBox = el("div");
  lastBox.appendChild(el("dt", "", "Điểm"));
  const lastVal = el("dd", "", formatNumber(scores.last));
  lastBox.appendChild(lastVal);
  const bestBox = el("div");
  bestBox.appendChild(el("dt", "", "Kỷ lục"));
  const bestVal = el("dd", "", formatNumber(scores.best));
  bestBox.appendChild(bestVal);
  stats.append(lastBox, bestBox);
  body.appendChild(stats);

  const playBtn = el("button", "btn card-play", "Chơi ngay");
  playBtn.type = "button";
  playBtn.setAttribute("aria-label", `Chơi ${meta.title} ngay`);
  playBtn.addEventListener("click", (e) => {
    if (e.detail > 0) playBtn.blur();
    audio.play("ui");
    shell.open(meta.id, playBtn);
  });
  body.appendChild(playBtn);

  card.appendChild(body);

  // Bấm vào tranh cũng mở game (nút vẫn là điều khiển chính, có a11y)
  art.addEventListener("click", () => playBtn.click());

  cardRefs.set(meta.id, { card, last: lastVal, best: bestVal });
  return card;
}

for (const meta of GAMES) grid.appendChild(makeCard(meta));

/* ---------- Shell chạy game ---------- */
const shell = createShell({
  onScoreSaved(id, saved) {
    const ref = cardRefs.get(id);
    if (!ref) return;
    ref.last.textContent = formatNumber(saved.last);
    ref.best.textContent = formatNumber(saved.best);
    ref.card.classList.remove("stat-bump");
    void ref.card.offsetWidth; // ép reflow để chạy lại animation
    ref.card.classList.add("stat-bump");
  },
});

/* ---------- Nút bật/tắt âm thanh (topbar + cửa sổ game) ---------- */
const soundButtons = document.querySelectorAll("[data-sound-toggle]");

function syncSoundButtons() {
  const on = audio.enabled;
  soundButtons.forEach((btn) => {
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    btn.setAttribute("title", on ? "Tắt âm thanh" : "Bật âm thanh");
    btn.querySelector("use")?.setAttribute("href", on ? "#i-sound-on" : "#i-sound-off");
  });
}

soundButtons.forEach((btn) => {
  btn.addEventListener("click", (e) => {
    if (e.detail > 0) btn.blur();
    audio.setEnabled(!audio.enabled);
    syncSoundButtons();
    audio.play("ui"); // phát sau khi bật để người dùng nghe phản hồi
  });
});

syncSoundButtons();
