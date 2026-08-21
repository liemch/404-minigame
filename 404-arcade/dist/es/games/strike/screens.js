/**
 * screens.js — các màn hình của 404 Strike theo reference:
 *  - Start: logo pixel, mục tiêu, ĐỘ KHÓ (Dễ/Thường/Khó), CHẤT LƯỢNG,
 *    nút VÀO TRẬN, ĐỔI GAME / VỀ TRANG CHỦ + panel ĐIỀU KHIỂN.
 *  - Pause: TẠM DỪNG (Tiếp tục / Chơi lại / Cài đặt / Đổi game / Về trang
 *    chủ) + CÀI ĐẶT (âm lượng, độ nhạy chuột, chất lượng, rung màn hình).
 *  - Kết thúc trận: điểm + vòng nguyệt quế, KỶ LỤC MỚI, 4 thẻ chỉ số,
 *    thanh TIẾN TRÌNH ĐIỂM, Chơi lại / Đổi game / Về trang chủ.
 *  - Notice: "Tối ưu cho máy tính" (mobile) / WebGL không khả dụng.
 * Mọi nút và điều khiển đều hoạt động thật.
 */

import { el, svgIcon, formatNumber } from "../../core/utils.js";
import { renderStrikeLogo } from "../../core/pixel-text.js";

const QUALITY_OPTIONS = [
  ["auto", "Tự động"],
  ["low", "Thấp"],
  ["medium", "Trung bình"],
  ["high", "Cao"],
];

const DIFF_OPTIONS = [
  ["easy", "Dễ"],
  ["normal", "Thường"],
  ["hard", "Khó"],
];

export function createScreens(rootEl, { settings, actions }) {
  // actions: { enterMatch, resume, restart, switchGame, goHome,
  //            applySettings(partial) }
  const layer = el("div");
  rootEl.appendChild(layer);
  let currentScreen = null;

  function clear() {
    layer.textContent = "";
    currentScreen = null;
  }

  function screen(name) {
    clear();
    const s = el("div", "sk-screen");
    s.dataset.screen = name;
    layer.appendChild(s);
    currentScreen = name;
    return s;
  }

  function actionBtn(label, iconId, accent, onClick) {
    const b = el("button", "btn", label);
    b.type = "button";
    if (accent) b.dataset.accent = accent;
    if (iconId) b.prepend(svgIcon(iconId));
    b.addEventListener("click", (e) => {
      if (e.detail > 0) b.blur();
      onClick();
    });
    return b;
  }

  /* ------------------------- START ------------------------- */

  function showStart() {
    const s = screen("start");
    const grid = el("div", "sk-start");

    /* Cột trái */
    const left = el("div");
    const logo = el("div", "sk-logo");
    renderStrikeLogo(logo);
    left.appendChild(logo);

    const objective = el("div", "sk-objective");
    objective.appendChild(svgIcon("i-target"));
    const objTxt = el("div", "txt");
    objTxt.appendChild(el("strong", "", "SỐNG SÓT QUA"));
    objTxt.appendChild(el("span", "", "CÁC ĐỢT TẤN CÔNG"));
    objective.appendChild(objTxt);
    left.appendChild(objective);

    // Độ khó
    const diffField = el("div", "sk-field");
    diffField.appendChild(el("div", "sk-field-label", "ĐỘ KHÓ"));
    const seg = el("div", "sk-seg");
    seg.setAttribute("role", "group");
    seg.setAttribute("aria-label", "Độ khó");
    for (const [value, label] of DIFF_OPTIONS) {
      const b = el("button", value === settings.difficulty ? "active" : "", label);
      b.type = "button";
      b.addEventListener("click", () => {
        settings.difficulty = value;
        actions.applySettings({ difficulty: value });
        seg.querySelectorAll("button").forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
      });
      seg.appendChild(b);
    }
    diffField.appendChild(seg);
    left.appendChild(diffField);

    // Chất lượng
    const qField = el("div", "sk-field");
    qField.appendChild(el("div", "sk-field-label", "CHẤT LƯỢNG"));
    const selWrap = el("div", "sk-select");
    selWrap.appendChild(svgIcon("i-restart", "icon"));
    const sel = document.createElement("select");
    sel.setAttribute("aria-label", "Chất lượng đồ họa");
    for (const [value, label] of QUALITY_OPTIONS) {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = label;
      if (value === settings.quality) opt.selected = true;
      sel.appendChild(opt);
    }
    sel.addEventListener("change", () => {
      settings.quality = sel.value;
      actions.applySettings({ quality: sel.value });
    });
    selWrap.appendChild(sel);
    qField.appendChild(selWrap);
    left.appendChild(qField);

    // VÀO TRẬN
    const cta = el("button", "sk-cta");
    cta.type = "button";
    cta.appendChild(el("span", "in", "VÀO TRẬN"));
    cta.addEventListener("click", () => actions.enterMatch());
    left.appendChild(cta);

    const acts = el("div", "sk-start-actions");
    acts.appendChild(actionBtn("Đổi game", "i-gamepad", "cyan", actions.switchGame));
    acts.appendChild(actionBtn("Về trang chủ", "i-home", "cyan", actions.goHome));
    left.appendChild(acts);

    /* Cột phải: điều khiển */
    const panel = el("aside", "sk-ctl-panel");
    panel.appendChild(el("h3", "", "ĐIỀU KHIỂN"));
    const rows = [
      { keys: ["W", "A", "S", "D"], title: "Di chuyển", desc: "" },
      { mouse: "i-mouse", title: "Chuột", desc: "Quan sát" },
      { mouse: "i-mouse-left", title: "Click trái", desc: "Bắn" },
      { mouse: "i-mouse-right", title: "Click phải", desc: "Ngắm" },
      { keys: ["R"], title: "R", desc: "Thay đạn" },
      { keys: ["SPACE"], title: "Space", desc: "Nhảy" },
      { keys: ["SHIFT"], title: "Shift", desc: "Chạy" },
      { keys: ["ESC"], title: "Esc", desc: "Tạm dừng" },
    ];
    for (const row of rows) {
      const r = el("div", "sk-ctl-row");
      const keys = el("div", "sk-ctl-keys");
      if (row.keys) for (const k of row.keys) keys.appendChild(el("kbd", "", k));
      if (row.mouse) keys.appendChild(svgIcon(row.mouse, `icon${row.mouse !== "i-mouse" ? " mono-violet" : ""}`));
      const desc = el("div", "desc");
      desc.appendChild(el("b", "", row.title));
      if (row.desc) desc.appendChild(document.createTextNode(row.desc));
      r.append(keys, desc);
      panel.appendChild(r);
    }

    grid.append(left, panel);
    s.appendChild(grid);
    requestAnimationFrame(() => cta.focus());
  }

  /* ------------------------- PAUSE ------------------------- */

  function sliderRow(labelText, iconId, value, min, max, onInput) {
    const set = el("div", "sk-set");
    const lbl = el("div", "lbl");
    lbl.appendChild(svgIcon(iconId));
    lbl.appendChild(el("span", "", labelText));
    set.appendChild(lbl);
    const row = el("div", "sk-slider-row");
    const range = document.createElement("input");
    range.type = "range";
    range.className = "sk-range";
    range.min = String(min);
    range.max = String(max);
    range.value = String(value);
    range.setAttribute("aria-label", labelText);
    const val = el("span", "val", String(value));
    const paint = () => {
      const pct = ((Number(range.value) - min) / (max - min)) * 100;
      range.style.setProperty("--fill", `${pct}%`);
      val.textContent = range.value;
    };
    paint();
    range.addEventListener("input", () => {
      paint();
      onInput(Number(range.value));
    });
    row.append(range, val);
    set.appendChild(row);
    return set;
  }

  function showPause() {
    const s = screen("pause");
    const panel = el("div", "sk-pause-panel");

    /* Cột trái: menu */
    const menuCol = el("div");
    menuCol.appendChild(el("h2", "sk-panel-title", "TẠM DỪNG"));
    const menu = el("div", "sk-menu");
    const mkBtn = (label, cls, fn) => {
      const b = el("button", `sk-menu-btn${cls ? ` ${cls}` : ""}`, label);
      b.type = "button";
      b.addEventListener("click", fn);
      return b;
    };
    const resumeBtn = mkBtn("TIẾP TỤC", "primary", actions.resume);
    menu.appendChild(resumeBtn);
    menu.appendChild(mkBtn("CHƠI LẠI", "", actions.restart));
    const settingsCol = el("div", "sk-settings");
    menu.appendChild(
      mkBtn("CÀI ĐẶT", "", () => {
        settingsCol.scrollIntoView({ block: "nearest", behavior: "smooth" });
        settingsCol.animate(
          [{ outline: "2px solid var(--cyan)", outlineOffset: "6px" }, { outline: "2px solid transparent" }],
          { duration: 900 }
        );
      })
    );
    menu.appendChild(mkBtn("ĐỔI GAME", "", actions.switchGame));
    menu.appendChild(mkBtn("VỀ TRANG CHỦ", "", actions.goHome));
    menuCol.appendChild(menu);

    /* Cột phải: cài đặt */
    settingsCol.appendChild(el("h3", "", "CÀI ĐẶT"));
    settingsCol.appendChild(
      sliderRow("ÂM LƯỢNG", "i-sound-on", settings.volume, 0, 100, (v) => {
        settings.volume = v;
        actions.applySettings({ volume: v });
      })
    );
    settingsCol.appendChild(
      sliderRow("ĐỘ NHẠY CHUỘT", "i-target", settings.sensitivity, 10, 100, (v) => {
        settings.sensitivity = v;
        actions.applySettings({ sensitivity: v });
      })
    );

    // Chất lượng LOW/MEDIUM/HIGH
    const qSet = el("div", "sk-set");
    const qLbl = el("div", "lbl");
    qLbl.appendChild(el("span", "", "CHẤT LƯỢNG"));
    qSet.appendChild(qLbl);
    const qSeg = el("div", "sk-seg");
    for (const [value, label] of [["low", "LOW"], ["medium", "MEDIUM"], ["high", "HIGH"]]) {
      const b = el("button", value === settings.quality ? "active" : "", label);
      b.type = "button";
      b.addEventListener("click", () => {
        settings.quality = value;
        actions.applySettings({ quality: value });
        qSeg.querySelectorAll("button").forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
      });
      qSeg.appendChild(b);
    }
    qSet.appendChild(qSeg);
    settingsCol.appendChild(qSet);

    // Rung màn hình
    const shakeSet = el("div", "sk-set");
    const shakeLbl = el("div", "lbl");
    shakeLbl.appendChild(el("span", "", "RUNG MÀN HÌNH"));
    shakeSet.appendChild(shakeLbl);
    const sw = el("button", `sk-switch${settings.shake ? " on" : ""}`);
    sw.type = "button";
    sw.setAttribute("role", "switch");
    sw.setAttribute("aria-checked", settings.shake ? "true" : "false");
    sw.appendChild(el("span", "track"));
    sw.appendChild(el("span", "state", settings.shake ? "ON" : "OFF"));
    sw.addEventListener("click", () => {
      settings.shake = !settings.shake;
      sw.classList.toggle("on", settings.shake);
      sw.setAttribute("aria-checked", settings.shake ? "true" : "false");
      sw.querySelector(".state").textContent = settings.shake ? "ON" : "OFF";
      actions.applySettings({ shake: settings.shake });
    });
    shakeSet.appendChild(sw);
    settingsCol.appendChild(shakeSet);

    panel.append(menuCol, settingsCol);
    s.appendChild(panel);
    requestAnimationFrame(() => resumeBtn.focus());
  }

  /* ---------------------- KẾT THÚC TRẬN ---------------------- */

  function showOver({ score, saved, kills, headshots, accuracy, wave }) {
    const s = screen("over");
    const panel = el("div", "sk-over-panel");

    panel.appendChild(el("div", "sk-over-head", "KẾT THÚC TRẬN"));

    const line = el("div", "sk-score-line");
    line.appendChild(svgIcon("i-laurel-l", "sk-laurel"));
    const mid = el("div", "sk-final-score");
    mid.appendChild(el("div", "lbl2", "ĐIỂM"));
    mid.appendChild(el("div", "num", formatNumber(score)));
    if (saved.isRecord) mid.appendChild(el("span", "sk-record", "KỶ LỤC MỚI"));
    line.appendChild(mid);
    line.appendChild(svgIcon("i-laurel-l", "sk-laurel flip"));
    panel.appendChild(line);

    const grid = el("div", "sk-statgrid");
    const statCard = (iconId, label, value, cls = "") => {
      const c = el("div", `sk-statcard${cls ? ` ${cls}` : ""}`);
      c.appendChild(svgIcon(iconId));
      c.appendChild(el("div", "lbl", label));
      c.appendChild(el("div", "val", value));
      return c;
    };
    grid.appendChild(statCard("i-skull", "BOT ĐÃ HẠ", String(kills)));
    grid.appendChild(statCard("i-target", "HEADSHOT", String(headshots)));
    grid.appendChild(statCard("i-crosshair", "ĐỘ CHÍNH XÁC", `${accuracy}%`, "cyan"));
    grid.appendChild(statCard("i-chevrons", "WAVE CAO NHẤT", String(wave).padStart(2, "0"), "gold"));
    panel.appendChild(grid);

    /* Thanh tiến trình điểm với mốc kỷ lục */
    const prog = el("div", "sk-progress");
    prog.appendChild(el("div", "lbl", "TIẾN TRÌNH ĐIỂM"));
    const wrap = el("div", "sk-track-wrap");
    const track = el("div", "sk-track");
    const axisMax = Math.max(15000, Math.ceil(Math.max(saved.best, score) / 5000) * 5000);
    const fill = el("div", "fill");
    fill.style.width = "0%";
    track.appendChild(fill);
    if (saved.best > score) {
      const zone = el("div", "best-zone");
      zone.style.width = `${((saved.best - score) / axisMax) * 100}%`;
      track.appendChild(zone);
    }
    const chip = el("div", "sk-score-chip", formatNumber(score));
    chip.style.left = "0%";
    wrap.append(chip, track);
    prog.appendChild(wrap);
    const axis = el("div", "sk-axis");
    for (let i = 0; i <= 3; i++) {
      axis.appendChild(el("span", "", formatNumber((axisMax / 3) * i)));
    }
    prog.appendChild(axis);
    panel.appendChild(prog);

    const acts = el("div", "sk-over-actions");
    acts.appendChild(actionBtn("Chơi lại", "i-restart", "gold", actions.restart));
    acts.appendChild(actionBtn("Đổi game", "i-swap", "violet", actions.switchGame));
    acts.appendChild(actionBtn("Về trang chủ", "i-home", "cyan", actions.goHome));
    panel.appendChild(acts);

    s.appendChild(panel);

    // Animate thanh tiến trình sau khi gắn DOM
    requestAnimationFrame(() => {
      const pct = Math.min(100, (score / axisMax) * 100);
      fill.style.width = `${pct}%`;
      chip.style.left = `${pct}%`;
      acts.querySelector("button")?.focus();
    });
  }

  /* ------------------------- NOTICE ------------------------- */

  function showNotice(kind) {
    const s = screen("notice");
    const box = el("div", "sk-notice");
    box.appendChild(svgIcon(kind === "webgl" ? "i-close" : "i-gamepad"));
    box.appendChild(
      el("h3", "", kind === "webgl" ? "WEBGL KHÔNG KHẢ DỤNG" : "TỐI ƯU CHO MÁY TÍNH")
    );
    box.appendChild(
      el(
        "p",
        "",
        kind === "webgl"
          ? "Trình duyệt của bạn không hỗ trợ WebGL nên không thể chạy 404 Strike. Bốn game 2D vẫn chơi tốt!"
          : "404 Strike cần bàn phím và chuột (WASD + mouse look). Hãy mở trên máy tính, hoặc thử 4 game 2D còn lại nhé!"
      )
    );
    const row = el("div", "btn-row");
    row.appendChild(actionBtn("Đổi game", "i-gamepad", "cyan", actions.switchGame));
    row.appendChild(actionBtn("Về trang chủ", "i-home", "cyan", actions.goHome));
    box.appendChild(row);
    s.appendChild(box);
  }

  return {
    showStart,
    showPause,
    showOver,
    showNotice,
    hideAll: clear,
    get current() {
      return currentScreen;
    },
    destroy() {
      layer.remove();
    },
  };
}
