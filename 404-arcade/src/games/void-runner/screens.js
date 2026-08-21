/**
 * screens.js — các màn hình VOID RUNNER 404 theo ảnh reference:
 *  - Start: nút back + chip 404 ARCADE, logo VOID RUNNER 404 nghiêng,
 *    tagline, hàng ĐỘ KHÓ / CHẤT LƯỢNG (bấm để đổi), nút BẮT ĐẦU CHẠY,
 *    ĐỔI GAME / VỀ TRANG CHỦ + panel ĐIỀU KHIỂN bên phải.
 *  - Pause: panel TẠM DỪNG — trái: TIẾP TỤC / CHƠI LẠI TỪ CHECKPOINT /
 *    CHƠI LẠI / ĐỔI GAME / VỀ TRANG CHỦ; phải: CÀI ĐẶT (âm lượng tổng,
 *    độ nhạy chuột, FOV, chất lượng LOW-MEDIUM-HIGH, rung màn hình,
 *    giảm chuyển động) + mẹo ESC.
 *  - Results: thời gian + best + KỶ LỤC MỚI + thẻ chỉ số + điểm.
 *  - Notice: tối ưu desktop / WebGL không khả dụng.
 */

import { el, svgIcon, formatNumber } from "../../core/utils.js";
import { formatRunTime } from "./hud.js";

const NS = "http://www.w3.org/2000/svg";

const DIFF_LABEL = { easy: "Dễ", normal: "Thường", hard: "Khó" };
const DIFF_ORDER = ["easy", "normal", "hard"];
const QUALITY_LABEL = { auto: "Tự động", low: "Thấp", medium: "Trung bình", high: "Cao" };
const QUALITY_ORDER = ["auto", "low", "medium", "high"];

function icon(name, cls = "icon") {
  const paths = {
    runner: ["M13.5 3.2a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8zM9.4 8.9 12.6 7c.9-.5 2-.2 2.5.7l1.5 2.6 3 1.2-.7 1.8-3.7-1.5-1.2-2-2 3.4 2.9 2.5-.9 5.4-2-.3.7-4.3-3-2.4-2.3 3.7-1.7-1 3.1-5.2-1.2.7-1.3 2.3-1.8.9 1.2-1.3z"],
    monitor: ["M3 4h18a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-7v2h3v2H7v-2h3v-2H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm1 2v9h16V6H4z"],
    fov: ["M12 5 4 19h16L12 5zm0 4.1 4.5 7.9h-9L12 9.1zM2 12l3-2v4l-3-2zm20 0-3-2v4l3-2z"],
    vibrate: ["M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm0 2v14h8V5H8zM2 8l2 2-2 2 2 2-2 2V8zm20 0v10l-2-2 2-2-2-2 2-2z"],
    motion: ["M3 7h10v2H3V7zm0 4h14v2H3v-2zm0 4h8v2H3v-2zm16.5-7.5 2.5 4.5-2.5 4.5-1.7-1 1.9-3.5-1.9-3.5 1.7-1z"],
    diamond: ["M12 3l7 9-7 9-7-9 7-9z"],
    back: ["M15 4l-8 8 8 8 1.5-1.5L10 12l6.5-6.5L15 4z"],
    clock: ["M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16zm-1 3h2v5.6l4 2.3-1 1.7-5-2.9V7z"],
    bolt: ["M13 2 4.5 13.5H11L9.6 22l8.9-11.5H12L13 2z"],
    star: ["M12 2l2.6 6.9L21 10l-5.2 4.4L17.5 21 12 17.2 6.5 21l1.7-6.6L3 10l6.4-1.1L12 2z"],
    fall: ["M12 3v12.2l4.4-4.4 1.4 1.4L12 19l-5.8-6.8 1.4-1.4 4.4 4.4V3h0zM5 21h14v-2H5v2z"],
    gauge: ["M12 4a9 9 0 0 0-9 9c0 2.6 1.1 5 2.9 6.6l1.4-1.5A7 7 0 1 1 19 13c0 1.9-.8 3.7-2.2 5l1.4 1.5A9 9 0 0 0 12 4zm0 10.8L15.6 8l-5.1 5.2a1.8 1.8 0 1 0 1.5 1.6z"],
  };
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", cls);
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  for (const d of paths[name] || []) {
    const p = document.createElementNS(NS, "path");
    p.setAttribute("d", d);
    p.setAttribute("fill", "currentColor");
    svg.appendChild(p);
  }
  return svg;
}

export function createVrScreens(rootEl, { settings, actions, getBestTime }) {
  const layer = el("div");
  rootEl.appendChild(layer);
  let currentScreen = null;

  function clear() {
    layer.textContent = "";
    currentScreen = null;
  }

  function screen(name) {
    clear();
    const s = el("div", "vr-screen");
    s.dataset.screen = name;
    layer.appendChild(s);
    currentScreen = name;
    return s;
  }

  function actionBtn(label, iconId, fn, cls = "") {
    const b = el("button", `vr-abtn${cls ? ` ${cls}` : ""}`, label);
    b.type = "button";
    if (iconId) b.prepend(svgIcon(iconId));
    b.addEventListener("click", (e) => {
      if (e.detail > 0) b.blur();
      fn();
    });
    return b;
  }

  /* ------------------------- START ------------------------- */

  function showStart() {
    const s = screen("start");

    // Góc trái trên: back + chip 404 ARCADE (như ảnh)
    const corner = el("div", "vr-corner");
    const back = el("button", "vr-back");
    back.type = "button";
    back.setAttribute("aria-label", "Về danh sách game");
    back.appendChild(icon("back"));
    back.addEventListener("click", () => actions.switchGame());
    const chip = el("div", "vr-brand");
    chip.appendChild(el("b", "", "404"));
    chip.appendChild(el("span", "", "ARCADE"));
    corner.append(back, chip);
    s.appendChild(corner);

    const grid = el("div", "vr-start");

    /* Cột trái */
    const left = el("div", "vr-start-left");

    const logo = el("div", "vr-logo");
    logo.appendChild(el("div", "l1", "VOID"));
    logo.appendChild(el("div", "l2", "RUNNER"));
    const l3 = el("div", "l3");
    l3.appendChild(el("span", "", "404"));
    logo.appendChild(l3);
    left.appendChild(logo);

    const tag = el("p", "vr-tagline");
    tag.appendChild(document.createTextNode("Chạy qua khoảng không."));
    tag.appendChild(document.createElement("br"));
    tag.appendChild(document.createTextNode("Phá kỷ lục của chính bạn."));
    left.appendChild(tag);

    const bt = getBestTime();
    if (bt > 0) {
      const best = el("div", "vr-best-chip");
      best.appendChild(icon("clock"));
      best.appendChild(el("span", "", `KỶ LỤC: ${formatRunTime(bt / 1000)}`));
      left.appendChild(best);
    }

    // Hàng ĐỘ KHÓ / CHẤT LƯỢNG — bấm để đổi vòng (chevron như ảnh)
    const rows = el("div", "vr-opt-rows");
    const mkRow = (iconName, label, getVal, cycle) => {
      const r = el("button", "vr-opt-row");
      r.type = "button";
      const lb = el("span", "lb");
      lb.appendChild(icon(iconName));
      lb.appendChild(el("span", "", label));
      const val = el("span", "val", getVal());
      const chev = el("span", "chev", "❯");
      r.append(lb, val, chev);
      r.addEventListener("click", () => {
        cycle();
        val.textContent = getVal();
      });
      rows.appendChild(r);
    };
    mkRow("bolt", "ĐỘ KHÓ", () => DIFF_LABEL[settings.difficulty], () => {
      const i = DIFF_ORDER.indexOf(settings.difficulty);
      settings.difficulty = DIFF_ORDER[(i + 1) % DIFF_ORDER.length];
      actions.applySettings({ difficulty: settings.difficulty });
    });
    mkRow("clock", "CHẤT LƯỢNG", () => QUALITY_LABEL[settings.quality], () => {
      const i = QUALITY_ORDER.indexOf(settings.quality);
      settings.quality = QUALITY_ORDER[(i + 1) % QUALITY_ORDER.length];
      actions.applySettings({ quality: settings.quality });
    });
    left.appendChild(rows);

    // CTA BẮT ĐẦU CHẠY
    const cta = el("button", "vr-cta");
    cta.type = "button";
    const ctaIn = el("span", "in");
    ctaIn.appendChild(icon("runner"));
    ctaIn.appendChild(el("span", "", "BẮT ĐẦU CHẠY"));
    cta.appendChild(ctaIn);
    cta.addEventListener("click", () => actions.enterRun());
    left.appendChild(cta);

    const acts = el("div", "vr-start-actions");
    acts.appendChild(actionBtn("ĐỔI GAME", "i-gamepad", actions.switchGame));
    acts.appendChild(actionBtn("VỀ TRANG CHỦ", "i-home", actions.goHome));
    left.appendChild(acts);

    /* Cột phải: panel điều khiển (đúng danh sách trong ảnh) */
    const panel = el("aside", "vr-ctl");
    panel.appendChild(el("h3", "", "ĐIỀU KHIỂN"));
    const ctlRows = [
      { keys: ["W", "A", "S", "D"], desc: "Di chuyển" },
      { mouse: true, kbd: "Chuột", desc: "Quan sát" },
      { keys: ["Space"], desc: "Nhảy" },
      { keys: ["Shift"], desc: "Chạy nhanh" },
      { keys: ["Ctrl"], desc: "Trượt" },
      { keys: ["Q"], desc: "Wall-run" },
      { keys: ["Esc"], desc: "Tạm dừng" },
    ];
    for (const row of ctlRows) {
      const r = el("div", "row");
      const keys = el("div", "keys");
      if (row.mouse) {
        keys.appendChild(svgIcon("i-mouse", "icon mouse"));
        keys.appendChild(el("b", "", row.kbd));
      } else {
        for (const k of row.keys) keys.appendChild(el("kbd", "", k));
      }
      r.append(keys, el("span", "desc", row.desc));
      panel.appendChild(r);
    }

    grid.append(left, panel);
    s.appendChild(grid);
    requestAnimationFrame(() => cta.focus());
  }

  /* ------------------------- PAUSE ------------------------- */

  function sliderRow(labelText, ic, min, max, step, value, fmt, onInput) {
    const set = el("div", "vr-set");
    const lbl = el("div", "lbl");
    lbl.appendChild(ic);
    lbl.appendChild(el("span", "", labelText));
    set.appendChild(lbl);
    const row = el("div", "vr-slider-row");
    const range = document.createElement("input");
    range.type = "range";
    range.className = "vr-range";
    range.min = String(min);
    range.max = String(max);
    range.step = String(step);
    range.value = String(value);
    range.setAttribute("aria-label", labelText);
    const val = el("span", "val", fmt(value));
    const paint = () => {
      const pct = ((Number(range.value) - min) / (max - min)) * 100;
      range.style.setProperty("--fill", `${pct}%`);
      val.textContent = fmt(Number(range.value));
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

  function toggleRow(labelText, ic, get, set2) {
    const setEl = el("div", "vr-set toggle");
    const lbl = el("div", "lbl");
    lbl.appendChild(ic);
    lbl.appendChild(el("span", "", labelText));
    setEl.appendChild(lbl);
    const sw = el("button", `vr-switch${get() ? " on" : ""}`);
    sw.type = "button";
    sw.setAttribute("role", "switch");
    sw.setAttribute("aria-checked", get() ? "true" : "false");
    sw.setAttribute("aria-label", labelText);
    sw.appendChild(el("span", "track"));
    sw.addEventListener("click", () => {
      set2(!get());
      sw.classList.toggle("on", get());
      sw.setAttribute("aria-checked", get() ? "true" : "false");
    });
    setEl.appendChild(sw);
    return setEl;
  }

  function showPause() {
    const s = screen("pause");
    const panel = el("div", "vr-pause");

    panel.appendChild(el("h2", "vr-pause-title", "TẠM DỪNG"));
    const cols = el("div", "vr-pause-cols");

    /* Cột trái: menu */
    const menu = el("div", "vr-menu");
    const mkBtn = (label, ic, fn, cls = "", extraNode = null) => {
      const b = el("button", `vr-menu-btn${cls ? ` ${cls}` : ""}`);
      b.type = "button";
      b.appendChild(ic);
      const sp = el("span", "", label);
      b.appendChild(sp);
      if (extraNode) b.appendChild(extraNode);
      b.addEventListener("click", fn);
      menu.appendChild(b);
      return b;
    };
    const resumeBtn = mkBtn("TIẾP TỤC", svgIcon("i-play"), actions.resume, "primary");
    mkBtn("CHƠI LẠI TỪ CHECKPOINT", svgIcon("i-restart"), actions.restartCheckpoint, "", icon("diamond", "icon dmd"));
    mkBtn("CHƠI LẠI", svgIcon("i-restart"), actions.restart);
    mkBtn("ĐỔI GAME", svgIcon("i-gamepad"), actions.switchGame);
    mkBtn("VỀ TRANG CHỦ", svgIcon("i-home"), actions.goHome);

    /* Cột phải: cài đặt */
    const st = el("div", "vr-settings");
    st.appendChild(el("h3", "", "CÀI ĐẶT"));

    st.appendChild(sliderRow("ÂM LƯỢNG TỔNG", svgIcon("i-sound-on"), 0, 100, 5, settings.volume,
      (v) => `${v}%`,
      (v) => { settings.volume = v; actions.applySettings({ volume: v }); }));

    st.appendChild(sliderRow("ĐỘ NHẠY CHUỘT", svgIcon("i-mouse", "icon"), 0.25, 3, 0.05, settings.sensitivity,
      (v) => v.toFixed(2),
      (v) => { settings.sensitivity = v; actions.applySettings({ sensitivity: v }); }));

    st.appendChild(sliderRow("FIELD OF VIEW (FOV)", icon("fov"), 75, 105, 1, settings.fov,
      (v) => `${v}°`,
      (v) => { settings.fov = v; actions.applySettings({ fov: v }); }));

    // Chất lượng LOW / MEDIUM / HIGH (như ảnh)
    const qSet = el("div", "vr-set");
    const qLbl = el("div", "lbl");
    qLbl.appendChild(icon("monitor"));
    qLbl.appendChild(el("span", "", "CHẤT LƯỢNG ĐỒ HỌA"));
    qSet.appendChild(qLbl);
    const qSeg = el("div", "vr-seg");
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
    st.appendChild(qSet);

    st.appendChild(toggleRow("RUNG MÀN HÌNH", icon("vibrate"),
      () => settings.shake,
      (v) => { settings.shake = v; actions.applySettings({ shake: v }); }));

    st.appendChild(toggleRow("GIẢM CHUYỂN ĐỘNG", icon("motion"),
      () => settings.reduceMotion,
      (v) => { settings.reduceMotion = v; actions.applySettings({ reduceMotion: v }); }));

    cols.append(menu, st);
    panel.appendChild(cols);

    const tip = el("div", "vr-tip");
    tip.appendChild(el("span", "", "MẸO: Bạn có thể truy cập cài đặt nhanh trong lúc chơi bằng phím "));
    tip.appendChild(el("kbd", "", "ESC"));
    panel.appendChild(tip);

    s.appendChild(panel);
    requestAnimationFrame(() => resumeBtn.focus());
  }

  /* ------------------------- RESULTS ------------------------- */

  function showResults(r) {
    // r: {timeMs, bestMs, newBestTime, score, saved, shards, shardTotal,
    //     maxCombo, falls, maxSpeed}
    const s = screen("over");
    const panel = el("div", "vr-over");

    panel.appendChild(el("div", "vr-over-head", "HOÀN THÀNH ĐƯỜNG CHẠY"));

    const timeBox = el("div", "vr-final-time");
    timeBox.appendChild(el("div", "lbl", "THỜI GIAN"));
    timeBox.appendChild(el("div", "num", formatRunTime(r.timeMs / 1000)));
    if (r.newBestTime) timeBox.appendChild(el("span", "vr-record", "KỶ LỤC MỚI"));
    panel.appendChild(timeBox);

    const bestLine = el("div", "vr-best-line");
    bestLine.appendChild(icon("clock"));
    bestLine.appendChild(el("span", "", `TỐT NHẤT: ${formatRunTime(r.bestMs / 1000)}`));
    panel.appendChild(bestLine);

    const grid = el("div", "vr-statgrid");
    const statCard = (ic, label, value, cls = "") => {
      const c = el("div", `vr-statcard${cls ? ` ${cls}` : ""}`);
      c.appendChild(ic);
      c.appendChild(el("div", "lbl", label));
      c.appendChild(el("div", "val", value));
      return c;
    };
    grid.appendChild(statCard(icon("bolt"), "NĂNG LƯỢNG", `${r.shards}/${r.shardTotal}`, "lime"));
    grid.appendChild(statCard(icon("star"), "COMBO TỐI ĐA", `x${r.maxCombo}`, "magenta"));
    grid.appendChild(statCard(icon("fall"), "SỐ LẦN RƠI", String(r.falls), "red"));
    grid.appendChild(statCard(icon("gauge"), "TỐC ĐỘ TỐI ĐA", `${r.maxSpeed.toFixed(1)} m/s`, "cyan"));
    panel.appendChild(grid);

    const scoreLine = el("div", "vr-score-line");
    scoreLine.appendChild(el("span", "lbl", "ĐIỂM"));
    scoreLine.appendChild(el("span", "num", formatNumber(r.score)));
    if (r.saved.isRecord) scoreLine.appendChild(el("span", "vr-record small", "KỶ LỤC ĐIỂM"));
    panel.appendChild(scoreLine);

    const acts = el("div", "vr-over-actions");
    acts.appendChild(actionBtn("CHẠY LẠI", "i-restart", actions.restart, "gold"));
    acts.appendChild(actionBtn("ĐỔI GAME", "i-gamepad", actions.switchGame));
    acts.appendChild(actionBtn("VỀ TRANG CHỦ", "i-home", actions.goHome));
    panel.appendChild(acts);

    s.appendChild(panel);
    requestAnimationFrame(() => acts.querySelector("button")?.focus());
  }

  /* ------------------------- NOTICE ------------------------- */

  function showNotice(kind) {
    const s = screen("notice");
    const box = el("div", "vr-notice");
    box.appendChild(svgIcon(kind === "webgl" ? "i-close" : "i-gamepad"));
    box.appendChild(el("h3", "", kind === "webgl" ? "WEBGL KHÔNG KHẢ DỤNG" : "TỐI ƯU CHO MÁY TÍNH"));
    box.appendChild(el("p", "",
      kind === "webgl"
        ? "Trình duyệt của bạn không hỗ trợ WebGL nên không thể chạy Void Runner 404. Các game 2D vẫn chơi tốt!"
        : "Void Runner 404 cần bàn phím và chuột (WASD + mouse look). Hãy mở trên máy tính, hoặc thử các game 2D nhé!"));
    const row = el("div", "btn-row");
    row.appendChild(actionBtn("ĐỔI GAME", "i-gamepad", actions.switchGame));
    row.appendChild(actionBtn("VỀ TRANG CHỦ", "i-home", actions.goHome));
    box.appendChild(row);
    s.appendChild(box);
  }

  return {
    showStart,
    showPause,
    showResults,
    showNotice,
    hideAll: clear,
    get current() { return currentScreen; },
    destroy() { layer.remove(); },
  };
}
