/**
 * hud.js — HUD trong trận theo Gameplay reference:
 * trên-trái: chip "404 STRIKE" + nút pause/sound · trên-giữa: WAVE + đồng
 * hồ · trên-phải: ĐIỂM + COMBO + badge HEADSHOT · dưới-trái: HP + thanh
 * ô · dưới-phải: số đạn + icon viên đạn · giữa: tâm ngắm + hitmarker,
 * vignette sát thương, banner wave, toast nhặt đồ.
 */

import { el, svgIcon, formatScore, formatTime } from "../../core/utils.js";

export function createStrikeHud(rootEl, { onPause, onToggleSound, soundOn }) {
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
