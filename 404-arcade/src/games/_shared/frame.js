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

import { el, svgIcon, formatNumber } from "../../core/utils.js";
import { EXP_CSS } from "./frame-styles.js";

const STYLE_ID = "exp5-style";

/** Inject CSS khung (một lần cho mỗi shadow root). */
export function ensureExpansionStyles(container) {
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

export function createExpansionFrame(container, ctx, opts) {
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
