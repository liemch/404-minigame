/**
 * hud.js — HUD gameplay đúng bố cục ảnh reference:
 *  - Trên-giữa: "VOID RUNNER 404" + đồng hồ mm:ss.mmm + CHECKPOINT k/8.
 *  - Trên-trái: 3 panel TỐC ĐỘ (đỏ) / NĂNG LƯỢNG (cyan, thanh ô) /
 *    COMBO (magenta, thanh ô).
 *  - Trên-phải: TẠM DỪNG / ÂM THANH / ĐỔI GAME / TRANG CHỦ.
 *  - Toast giữa màn (SLIDE! / WALL RUN! / CHECKPOINT), penalty đỏ,
 *    vignette sát thương, màn đen respawn.
 */

import { el, svgIcon } from "../../core/utils.js";

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

export function formatRunTime(seconds) {
  const s = Math.max(0, seconds);
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(Math.floor(s % 60)).padStart(2, "0");
  const ms = String(Math.floor((s % 1) * 1000)).padStart(3, "0");
  return `${mm}:${ss}.${ms}`;
}

export function createVrHud(rootEl, { onPause, onToggleSound, soundOn, onSwitch, onHome }) {
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
