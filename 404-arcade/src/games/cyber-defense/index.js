/**
 * Cyber Defense — tower defense bảo vệ lõi CORE (game 8).
 *
 * Theo plan + ảnh reference: cụm nút hệ thống BÊN TRÁI, tiêu đề giữa,
 * WAVE / CORE % / NĂNG LƯỢNG / ĐIỂM bên phải; bot chạy theo 2 tuyến
 * cố định; 14 pad xây; 3 tháp mở sẵn + 2 tháp khóa wave 6/8 (đúng 2 ô
 * khóa trong ảnh); chọn tháp hiện range circle + panel nâng cấp 3 cấp /
 * bán hoàn 70%; 8 wave data-driven; thắng sau wave 8, thua khi CORE = 0.
 */

import { createExpansionFrame } from "../_shared/frame.js";
import { createKeyboard } from "../../core/input-manager.js";
import { createLoop } from "../../core/loop.js";
import { createCanvas } from "../../core/canvas.js";
import { el, svgIcon, formatScore } from "../../core/utils.js";
import { WORLD_W, WORLD_H, TOWERS, TOWER_ORDER, CORE } from "./data.js";
import { createSim } from "./engine.js";
import { createDefenseRenderer, paintTowerIcon } from "./render.js";
import { CD_CSS } from "./styles.js";

const SFX_THROTTLE = { zap: 0.09, shoot: 0.09, kill: 0.12, hit: 0.2 };

export function createGame() {
  let ctx = null;
  let frame = null;
  let sim = null;
  let renderer = null;
  let view = null;
  let keys = null;
  let loop = null;
  let panelEl = null;
  let prepEl = null;
  let mmCanvas = null;
  let mmCtx = null;
  let mmStatic = null;
  let slots = [];

  const TEST = typeof window !== "undefined" && window.__ARCADE_EXP5_TEST__;

  let mode = "intro"; // intro | play | paused | over
  let time = 0;
  let stateT = 0;
  const ui = { buildType: null, selectedId: null, hoverPad: null, canPlace: false };
  const sfxLast = {};

  /* ---------------- SFX có throttle ---------------- */

  function sfx(name, key = name) {
    const min = SFX_THROTTLE[key] || 0;
    if (min > 0) {
      if (time - (sfxLast[key] || -9) < min) return;
      sfxLast[key] = time;
    }
    ctx.audio.play(name);
  }

  /* ---------------- HUD ---------------- */

  function updateHud() {
    const waveShow = Math.max(1, sim.wave + (sim.phase === "prep" ? 1 : 0));
    frame.setStat("wave", `${String(Math.min(8, waveShow)).padStart(2, "0")}/08`);
    const pct = Math.round((sim.core / sim.coreMax) * 100);
    frame.setStat("core", `${pct}%`);
    frame.setStatBar("core", pct);
    frame.setStat("energy", String(Math.floor(sim.energy)));
    frame.setStat("score", formatScore(sim.score));
    const coreBox = frame.statBox("core")?.querySelector(".val");
    if (coreBox) coreBox.style.color = pct <= 40 ? "var(--red)" : "";
  }

  /* ---------------- Build bar ---------------- */

  function refreshSlots() {
    for (const s of slots) {
      const def = TOWERS[s.type];
      const unlocked = sim.wave + (sim.phase === "prep" ? 1 : 0) >= def.unlockWave;
      s.el.classList.toggle("locked", !unlocked);
      s.el.classList.toggle("armed", ui.buildType === s.type);
      s.lockEl.style.display = unlocked ? "none" : "";
      s.iconEl.style.visibility = unlocked ? "" : "hidden";
      s.costEl.textContent = unlocked ? `${def.cost}⚡` : "";
      s.waveTag.textContent = unlocked ? "" : `WAVE ${String(def.unlockWave).padStart(2, "0")}`;
      if (unlocked && sim.energy < def.cost) s.el.dataset.poor = "1";
      else delete s.el.dataset.poor;
    }
  }

  function armBuild(type) {
    if (mode !== "play") return;
    const def = TOWERS[type];
    const unlocked = sim.wave + (sim.phase === "prep" ? 1 : 0) >= def.unlockWave;
    if (!unlocked) {
      frame.toast(`MỞ KHÓA Ở WAVE ${String(def.unlockWave).padStart(2, "0")}`);
      ctx.audio.play("denied");
      return;
    }
    if (ui.buildType === type) {
      ui.buildType = null;
    } else {
      ui.buildType = type;
      ui.selectedId = null;
      renderPanel();
    }
    ctx.audio.play("ui");
    refreshSlots();
  }

  /* ---------------- Panel tháp ---------------- */

  function pips(target, value, max, gain = 0) {
    const box = el("div", "cd-pips");
    for (let i = 0; i < 10; i++) {
      const p = el("i");
      const th = ((i + 1) / 10) * max;
      if (value >= th) p.classList.add("on");
      else if (value + gain >= th) p.classList.add("gain");
      box.appendChild(p);
    }
    target.appendChild(box);
  }

  function renderPanel() {
    panelEl.textContent = "";
    const t = sim.towers.find((x) => x.id === ui.selectedId);
    if (!t) {
      panelEl.hidden = true;
      return;
    }
    panelEl.hidden = false;
    const def = TOWERS[t.type];
    const st = sim.stats(t);
    const next = t.level < def.levels.length - 1 ? def.levels[t.level + 1] : null;

    const inBox = el("div", "in");
    inBox.appendChild(el("h3", "", def.name));

    const lv = el("div", "cd-lv");
    const cur = el("span");
    cur.appendChild(document.createTextNode("CẤP "));
    cur.appendChild(el("b", "", String(t.level + 1)));
    lv.appendChild(cur);
    if (next) {
      lv.appendChild(el("span", "arrow", "»"));
      lv.appendChild(el("span", "next", `CẤP ${t.level + 2}`));
    } else {
      lv.appendChild(el("span", "next", "TỐI ĐA"));
    }
    inBox.appendChild(lv);

    const mkStat = (label, value, max, gain, text) => {
      const box = el("div", "cd-stat");
      const lbl = el("div", "lbl");
      lbl.appendChild(el("span", "", label));
      lbl.appendChild(el("span", "", text));
      box.appendChild(lbl);
      pips(box, value, max, gain);
      inBox.appendChild(box);
    };
    mkStat("TỐC ĐỘ", st.rate, 5, next ? next.rate - st.rate : 0, `${st.rate.toFixed(1)}/s`);
    mkStat("SÁT THƯƠNG", st.dmg, 140, next ? next.dmg - st.dmg : 0, String(st.dmg));
    mkStat("TẦM BẮN", st.range, 380, next ? next.range - st.range : 0, String(st.range));

    const upBtn = el("button", "cd-upgrade");
    upBtn.type = "button";
    if (next) {
      upBtn.textContent = `NÂNG CẤP ⚡${next.cost}`;
      upBtn.disabled = sim.energy < next.cost;
    } else {
      upBtn.textContent = "ĐÃ TỐI ĐA";
      upBtn.disabled = true;
    }
    upBtn.addEventListener("click", () => {
      const r = sim.upgrade(t.id);
      if (r.ok) {
        sfx("upgrade");
        renderPanel();
        updateHud();
      } else {
        ctx.audio.play("denied");
      }
    });
    inBox.appendChild(upBtn);

    const sellBtn = el("button", "cd-sell", `BÁN +${sim.sellValue(t)}⚡`);
    sellBtn.type = "button";
    sellBtn.addEventListener("click", () => {
      sim.sell(t.id);
      sfx("sell");
      ui.selectedId = null;
      renderPanel();
      updateHud();
      refreshSlots();
    });
    inBox.appendChild(sellBtn);

    panelEl.appendChild(inBox);
  }

  /* ---------------- Minimap ---------------- */

  function buildMinimapStatic() {
    mmStatic = document.createElement("canvas");
    mmStatic.width = 300;
    mmStatic.height = 172;
    const s = mmStatic.getContext("2d");
    s.scale(300 / WORLD_W, 172 / WORLD_H);
    s.lineCap = "round";
    s.lineJoin = "round";
    for (const lane of [sim.paths.A, sim.paths.B]) {
      s.strokeStyle = "rgba(47,123,255,0.9)";
      s.lineWidth = 16;
      s.beginPath();
      s.moveTo(lane.nodes[0][0], lane.nodes[0][1]);
      for (let i = 1; i < lane.nodes.length; i++) s.lineTo(lane.nodes[i][0], lane.nodes[i][1]);
      s.stroke();
    }
    s.fillStyle = "#ff4fd8";
    for (const lane of [sim.paths.A, sim.paths.B]) {
      s.beginPath();
      s.arc(lane.nodes[0][0] + 20, lane.nodes[0][1], 14, 0, Math.PI * 2);
      s.fill();
    }
  }

  function drawMinimap() {
    if (!mmCtx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (mmCanvas.width !== 150 * dpr) {
      mmCanvas.width = 150 * dpr;
      mmCanvas.height = 86 * dpr;
    }
    mmCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mmCtx.clearRect(0, 0, 150, 86);
    mmCtx.drawImage(mmStatic, 0, 0, 150, 86);
    const sx = 150 / WORLD_W;
    const sy = 86 / WORLD_H;
    for (const t of sim.towers) {
      mmCtx.fillStyle = TOWERS[t.type].color;
      mmCtx.fillRect(t.x * sx - 2, t.y * sy - 2, 4, 4);
    }
    mmCtx.save();
    mmCtx.shadowColor = "#20e3ff";
    mmCtx.shadowBlur = 5;
    mmCtx.fillStyle = "#20e3ff";
    mmCtx.beginPath();
    mmCtx.arc(CORE.x * sx, CORE.y * sy, 4, 0, Math.PI * 2);
    mmCtx.fill();
    mmCtx.restore();
  }

  /* ---------------- Vòng đời trận ---------------- */

  function startMatch() {
    sim = createSim({ test: TEST });
    ui.buildType = null;
    ui.selectedId = null;
    mode = "play";
    frame.clearScreen();
    frame.setPaused(false);
    ctx.onMatchStart();
    ctx.audio.play("start");
    buildMinimapStatic();
    refreshSlots();
    renderPanel();
    updateHud();
    loop.start();
  }

  function endMatch(victory) {
    mode = "over";
    const saved = ctx.onGameOver(sim.score, { wave: sim.wave, kills: sim.kills, core: sim.core });
    frame.overScreen({
      kicker: victory ? "// PHÒNG THỦ THÀNH CÔNG" : "// LÕI SỤP ĐỔ",
      heading: victory ? "HỆ THỐNG AN TOÀN!" : "CORE BỊ PHÁ HỦY!",
      score: sim.score,
      saved,
      statCards: [
        { label: "WAVE", value: `${sim.wave}/8`, color: "cyan" },
        { label: "BOT ĐÃ HẠ", value: sim.kills, color: "pink" },
        { label: "CORE CÒN LẠI", value: `${Math.round((sim.core / sim.coreMax) * 100)}%`, color: victory ? "green" : "red" },
        { label: "NĂNG LƯỢNG DƯ", value: Math.floor(sim.energy), color: "gold" },
      ],
      restartLabel: "CHƠI LẠI",
      onRestart: () => startMatch(),
    });
  }

  function pauseGame() {
    if (mode !== "play") return;
    mode = "paused";
    loop.stop();
    frame.setPaused(true);
    frame.pauseMenu({
      onResume: () => resumeGame(),
      onRestart: () => startMatch(),
      buildExtra: (box) => {
        const row = el("div", "exp-setrow");
        row.appendChild(el("span", "", "TIẾN ĐỘ"));
        row.appendChild(el("span", "val", `WAVE ${sim.wave}/8 · CORE ${Math.round((sim.core / sim.coreMax) * 100)}%`));
        box.appendChild(row);
      },
    });
  }

  function resumeGame() {
    if (mode !== "paused") return;
    mode = "play";
    frame.clearScreen();
    frame.setPaused(false);
    loop.start();
  }

  function togglePause() {
    if (mode === "play") {
      if (ui.buildType) {
        // Esc hủy chế độ xây trước
        ui.buildType = null;
        refreshSlots();
        return;
      }
      pauseGame();
    } else if (mode === "paused") resumeGame();
  }

  /* ---------------- Sự kiện sim → SFX/FX ---------------- */

  function handleEvents(events) {
    renderer.addEvents(events, time);
    for (const e of events) {
      switch (e.type) {
        case "wave":
          frame.banner(`WAVE ${String(e.wave).padStart(2, "0")}`);
          ctx.audio.play("wave");
          refreshSlots();
          break;
        case "waveclear":
          frame.toast(`WAVE ${e.wave} SẠCH — +${e.bonus}⚡`);
          ctx.audio.play("combo");
          refreshSlots();
          break;
        case "shoot":
          sfx("zap", "shoot");
          break;
        case "zap":
          sfx("zap");
          break;
        case "boom":
          ctx.audio.play("boom");
          break;
        case "kill":
          sfx("kill");
          break;
        case "corehit":
          ctx.audio.play("corehit");
          break;
        case "victory":
          ctx.audio.play("win");
          endMatch(true);
          break;
        case "defeat":
          ctx.audio.play("over");
          endMatch(false);
          break;
      }
    }
  }

  /* ---------------- Vòng lặp ---------------- */

  function update(dt) {
    time += dt;
    if (mode === "play") {
      // TEST: bù throttle rAF của headless SwiftShader để QA nhanh hơn
      sim.update(TEST ? dt * 2 : dt);
      handleEvents(sim.drainEvents());
      updateHud();
      // chip đếm ngược wave
      if (sim.phase === "prep") {
        prepEl.hidden = false;
        prepEl.textContent = `WAVE ${String(Math.min(8, sim.wave + 1)).padStart(2, "0")} SAU ${Math.ceil(sim.prepT)}s`;
      } else {
        prepEl.hidden = true;
      }
      // trạng thái nút panel theo năng lượng
      if (!panelEl.hidden) {
        const t = sim.towers.find((x) => x.id === ui.selectedId);
        if (!t) {
          ui.selectedId = null;
          renderPanel();
        } else {
          const btn = panelEl.querySelector(".cd-upgrade");
          const cost = sim.upgradeCost(t);
          if (btn && cost !== null) btn.disabled = sim.energy < cost;
        }
      }
      if (TEST) {
        stateT += dt;
        if (stateT > 0.4) {
          stateT = 0;
          window.__CD_STATE__ = {
            mode, wave: sim.wave, phase: sim.phase, core: sim.core,
            energy: Math.floor(sim.energy), score: sim.score, kills: sim.kills,
            towers: sim.towers.length, enemies: sim.enemies.length,
          };
        }
      }
    }
    renderer.draw(sim, ui, time);
    drawMinimap();
  }

  /* ---------------- Intro ---------------- */

  function showIntro() {
    mode = "intro";
    loop.stop();
    frame.intro({
      kicker: "// GIAO THỨC PHÒNG THỦ",
      heading: [["CYBER ", "cyan"], ["DEFENSE", ""]],
      goal:
        "Bot độc hại tràn vào bảng mạch theo 2 tuyến cố định. Xây tháp trên các pad, nâng cấp tới 3 cấp và chặn đứng 8 WAVE trước khi chúng chạm tới lõi CORE. Bắt đầu với 400⚡ năng lượng.",
      rows: [
        { keys: ["Click"], text: "chọn tháp ở thanh dưới → click pad để xây" },
        { keys: ["1", "2", "3", "4", "5"], text: "chọn nhanh loại tháp" },
        { keys: ["Click"], text: "click tháp đã xây: xem tầm bắn, NÂNG CẤP / BÁN" },
        { keys: ["ESC"], text: "hủy chế độ xây / tạm dừng" },
      ],
      startLabel: "KÍCH HOẠT PHÒNG THỦ",
      onStart: () => startMatch(),
    });
    renderer.draw(sim, ui, 0);
  }

  /* ---------------- Interface ---------------- */

  return {
    async mount(container, context) {
      ctx = context;

      const rootNode = container.getRootNode();
      if (rootNode instanceof ShadowRoot && !rootNode.querySelector("#cd-style")) {
        const style = document.createElement("style");
        style.id = "cd-style";
        style.textContent = CD_CSS;
        rootNode.appendChild(style);
      }

      frame = createExpansionFrame(container, ctx, {
        accent: "cyan",
        title: [["CYBER ", "cyan"], ["DEFENSE", ""]],
        buttonsFirst: true,
        stats: [
          { id: "wave", label: "WAVE", color: "white", value: "01/08" },
          { id: "core", label: "CORE", color: "green", value: "100%", bar: true },
          { id: "energy", label: "NĂNG LƯỢNG", color: "cyan", value: "400" },
          { id: "score", label: "ĐIỂM", color: "cyan", value: "000000" },
        ],
        onPauseToggle: togglePause,
      });

      const stage = el("div", "cd-stage");
      frame.playfield.appendChild(stage);
      view = createCanvas(stage, { width: WORLD_W, height: WORLD_H });
      renderer = createDefenseRenderer(view.ctx, buildPathsForRender());

      function buildPathsForRender() {
        // sim chưa tạo — dựng sim tạm để lấy paths + vẽ intro
        sim = createSim({ test: TEST });
        return sim.paths;
      }

      /* Build bar */
      const bar = el("div", "cd-buildbar");
      slots = TOWER_ORDER.map((type, i) => {
        const def = TOWERS[type];
        const b = el("button", "cd-slot");
        b.type = "button";
        b.setAttribute("aria-label", `${def.name} — ${def.cost} năng lượng`);
        b.appendChild(el("span", "cd-key", String(i + 1)));
        const icon = document.createElement("canvas");
        paintTowerIcon(icon, type);
        b.appendChild(icon);
        const lock = svgIcon("i-close", "cd-lock");
        b.appendChild(lock);
        const cost = el("span", "cost", `${def.cost}⚡`);
        b.appendChild(cost);
        const waveTag = el("span", "wavetag", "");
        b.appendChild(waveTag);
        b.addEventListener("click", () => armBuild(type));
        bar.appendChild(b);
        return { type, el: b, iconEl: icon, lockEl: lock, costEl: cost, waveTag };
      });
      frame.playfield.appendChild(bar);

      /* Panel + prep chip + minimap */
      panelEl = el("aside", "cd-panel");
      panelEl.hidden = true;
      frame.playfield.appendChild(panelEl);
      prepEl = el("div", "cd-prep");
      prepEl.hidden = true;
      frame.playfield.appendChild(prepEl);
      const mmBox = el("div", "cd-minimap");
      mmCanvas = document.createElement("canvas");
      mmBox.appendChild(mmCanvas);
      mmCtx = mmCanvas.getContext("2d");
      frame.playfield.appendChild(mmBox);
      buildMinimapStatic();

      /* Tương tác canvas */
      view.canvas.addEventListener(
        "pointermove",
        (e) => {
          const p = view.pos(e);
          ui.hoverPad = sim.padAt(p.x, p.y);
          if (ui.buildType && ui.hoverPad) {
            ui.canPlace = !sim.towerOnPad(ui.hoverPad.id) && sim.canBuild(ui.buildType).ok;
          }
        },
        { signal: ctx.signal }
      );

      view.canvas.addEventListener(
        "pointerdown",
        (e) => {
          if (mode !== "play") return;
          e.preventDefault();
          const p = view.pos(e);
          if (ui.buildType) {
            const pad = sim.padAt(p.x, p.y);
            if (pad) {
              const existed = sim.towerOnPad(pad.id);
              if (existed) {
                // pad đã có tháp → chuyển sang chọn tháp đó
                ui.buildType = null;
                ui.selectedId = existed.id;
                renderPanel();
                refreshSlots();
                ctx.audio.play("ui");
                return;
              }
              const r = sim.buildAt(pad.id, ui.buildType);
              if (r.ok) {
                sfx("build");
                updateHud();
                refreshSlots();
                if (!sim.canBuild(ui.buildType).ok) {
                  ui.buildType = null;
                  refreshSlots();
                }
              } else {
                ctx.audio.play("denied");
                frame.toast(r.reason === "energy" ? "THIẾU NĂNG LƯỢNG" : "KHÔNG THỂ XÂY");
              }
              return;
            }
            // click ra ngoài pad → hủy chế độ xây
            ui.buildType = null;
            refreshSlots();
            return;
          }
          const t = sim.towerAt(p.x, p.y);
          ui.selectedId = t ? t.id : null;
          if (t) ctx.audio.play("ui");
          renderPanel();
        },
        { signal: ctx.signal }
      );

      keys = createKeyboard({ signal: ctx.signal });
      TOWER_ORDER.forEach((type, i) => {
        keys.on([`Digit${i + 1}`], () => armBuild(type));
      });
      keys.on(["KeyP"], () => togglePause());

      loop = createLoop(update);
      showIntro();
    },

    start() {
      if (mode === "intro") startMatch();
    },

    pause() {
      pauseGame();
    },

    resume() {
      resumeGame();
    },

    restart() {
      if (mode === "intro") return;
      startMatch();
    },

    resize() {},

    destroy() {
      loop?.stop();
      keys?.destroy();
      view?.destroy();
      frame?.destroy();
      frame = null;
      renderer = null;
      sim = null;
      if (typeof window !== "undefined") delete window.__CD_STATE__;
    },
  };
}
