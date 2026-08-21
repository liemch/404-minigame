/**
 * verify-pointerlock.mjs — kiểm chứng fix pointer lock trong Shadow DOM.
 *
 * Mock Pointer Lock theo ĐÚNG spec Pointer Lock 2.0 (retargeting):
 *  - document.pointerLockElement trả về shadow HOST (<arcade-404>)
 *  - shadowRoot.pointerLockElement trả về canvas thật
 * (Mock của resume-qa.py cũ trả canvas trực tiếp nên không phát hiện bug.)
 *
 * Kịch bản cho 404 Strike + Void Runner 404:
 *  1) Mở card → start screen
 *  2) Bấm CTA vào trận → PHẢI đang chơi (không có màn hình pause)
 *  3) Esc (thoát lock) → pause hiện
 *  4) KeyP resume → chơi tiếp, lock lại
 *
 * Chạy: node tools/verify-pointerlock.mjs
 */

import { spawn } from "node:child_process";
import http from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEBROOT = resolve(HERE, "../..");
const PORT = 8404;
const CDP_PORT = 9224;
const CHROME = process.env.CHROME_BIN || "C:/Program Files/Google/Chrome/Application/chrome.exe";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- Static server ---------- */
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};
const server = http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    const data = await readFile(join(WEBROOT, p));
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream", "cache-control": "no-store" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
});
await new Promise((r) => server.listen(PORT, "127.0.0.1", r));

/* ---------- Chrome headless ---------- */
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${CDP_PORT}`,
    "--remote-allow-origins=*",
    `--user-data-dir=${join(process.env.TEMP || "/tmp", "chrome-plock-qa")}`,
    "--window-size=1440,900",
    "--mute-audio",
    "--enable-unsafe-swiftshader",
    "--no-first-run",
    "about:blank",
  ],
  { stdio: "ignore" }
);

async function getWsUrl() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json`)).json();
      const page = list.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      /* CDP chưa sẵn sàng */
    }
    await sleep(300);
  }
  throw new Error("CDP không sẵn sàng");
}

/* ---------- CDP client (WebSocket built-in của Node 22) ---------- */
const ws = new WebSocket(await getWsUrl());
await new Promise((res, rej) => {
  ws.onopen = res;
  ws.onerror = () => rej(new Error("WS lỗi"));
});
let idc = 0;
const pend = new Map();
const pageErrors = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pend.has(m.id)) {
    const { res, rej } = pend.get(m.id);
    pend.delete(m.id);
    m.error ? rej(new Error(m.error.message)) : res(m.result);
  } else if (m.method === "Runtime.exceptionThrown") {
    pageErrors.push(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text || "?");
  }
};
function cmd(method, params = {}) {
  const id = ++idc;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((res, rej) => pend.set(id, { res, rej }));
}
async function js(expr) {
  const r = await cmd("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error("Page exception: " + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result.value;
}
const sr = (expr) => js(`(() => { const sr = document.querySelector('arcade-404').shadowRoot; return ${expr}; })()`);
async function waitFor(expr, timeout = 20000, step = 400) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await sr(expr)) return true;
    await sleep(step);
  }
  return false;
}

/* ---------- Mock Pointer Lock đúng spec retargeting ---------- */
const MOCK = `(() => {
  let lockedEl = null;
  const retarget = (el, context) => {
    let cur = el;
    while (cur) {
      const root = cur.getRootNode();
      if (root === context) return cur;
      if (!(root instanceof ShadowRoot)) return null;
      cur = root.host;
    }
    return null;
  };
  Object.defineProperty(Document.prototype, 'pointerLockElement', {
    configurable: true,
    get() { return lockedEl ? retarget(lockedEl, this) : null; },
  });
  Object.defineProperty(ShadowRoot.prototype, 'pointerLockElement', {
    configurable: true,
    get() { return lockedEl ? retarget(lockedEl, this) : null; },
  });
  HTMLElement.prototype.requestPointerLock = function () {
    lockedEl = this;
    queueMicrotask(() => document.dispatchEvent(new Event('pointerlockchange')));
    return Promise.resolve();
  };
  Document.prototype.exitPointerLock = function () {
    if (!lockedEl) return;
    lockedEl = null;
    document.dispatchEvent(new Event('pointerlockchange'));
  };
  window.__lock = {
    escExit() { if (lockedEl) { lockedEl = null; document.dispatchEvent(new Event('pointerlockchange')); } },
    get locked() { return !!lockedEl; },
    get docTag() { return document.pointerLockElement ? document.pointerLockElement.tagName : null; },
  };
})();`;

/* ---------- Kịch bản test ---------- */
let failed = 0;
function check(name, ok, extra = "") {
  console.log(`  ${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
  if (!ok) failed += 1;
}

async function testGame({ label, cardText, screenSel, ctaSel }) {
  console.log(`\n== ${label} ==`);
  await sr(`[...sr.querySelectorAll('.game-card')].find(c => c.textContent.includes('${cardText}'))?.querySelector('.card-play')?.click(); true`);

  check("start screen hiện", await waitFor(`sr.querySelector('${screenSel}')?.dataset.screen === 'start'`, 25000));

  await sr(`sr.querySelector('${ctaSel}')?.click(); true`);
  await sleep(1500);

  const docTag = await js("window.__lock.docTag");
  check("retargeting hoạt động (doc trả về host)", docTag === "ARCADE-404", `document.pointerLockElement = ${docTag}`);
  check("pointer lock đã khóa", await js("window.__lock.locked") === true);
  check("ĐANG CHƠI, không bị tự pause", await sr(`!sr.querySelector('${screenSel}')`));

  // Esc thoát lock → phải pause
  await js("window.__lock.escExit(); true");
  await sleep(600);
  check("Esc → pause menu hiện", (await sr(`sr.querySelector('${screenSel}')?.dataset.screen`)) === "pause");

  // KeyP → resume, lock lại
  await js("window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP', bubbles: true })); true");
  await sleep(800);
  check("KeyP → chơi tiếp", await sr(`!sr.querySelector('${screenSel}')`));
  check("lock được khóa lại", await js("window.__lock.locked") === true);

  await js("document.querySelector('arcade-404').closeGame()");
  await sleep(600);
}

try {
  await cmd("Page.enable");
  await cmd("Runtime.enable");
  await cmd("Network.enable");
  await cmd("Network.setCacheDisabled", { cacheDisabled: true });
  await cmd("Page.addScriptToEvaluateOnNewDocument", { source: MOCK });
  await cmd("Page.navigate", { url: `http://127.0.0.1:${PORT}/404-arcade/` });
  await sleep(2000);
  await waitFor("!!sr.querySelector('.game-card')", 15000);

  await testGame({ label: "404 STRIKE", cardText: "404 Strike", screenSel: ".sk-screen", ctaSel: ".sk-cta" });
  await testGame({ label: "VOID RUNNER 404", cardText: "Void Runner", screenSel: ".vr-screen", ctaSel: ".vr-cta" });

  if (pageErrors.length) {
    console.log("\nLỗi console trong page:");
    for (const e of pageErrors.slice(0, 5)) console.log("  " + e.slice(0, 200));
    failed += 1;
  }
} catch (err) {
  console.error("Lỗi khi chạy test:", err);
  failed += 1;
} finally {
  try { ws.close(); } catch { /* bỏ qua */ }
  chrome.kill();
  server.close();
}

console.log(failed === 0 ? "\nTẤT CẢ PASS" : `\nCÓ ${failed} KIỂM TRA FAIL`);
process.exit(failed === 0 ? 0 : 1);
