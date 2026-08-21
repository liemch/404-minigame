/**
 * bundle.mjs — bộ đóng gói OFFLINE thuần Node (không cần npm install).
 *
 * Xuất ra dist/:
 *  - es/**            : cây ES modules giữ nguyên (lazy-load thật qua
 *                       dynamic import — engine 3D không nằm trong entry)
 *  - arcade-404.es.js : entry ES trỏ vào cây es/ (giữ tên file như tài liệu)
 *  - arcade-404.iife.js: MỘT file duy nhất (mọi module inline, dùng cho
 *                       hệ thống cũ; đánh đổi: không lazy-load)
 *  - arcade-404.css   : style cấp host
 *
 * Bundler chuyển đổi ES module theo quy ước code của repo này:
 * import tĩnh dạng named, export function/const/class/let, re-export
 * named, dynamic import bằng chuỗi tĩnh. Không hỗ trợ default export.
 *
 * Chạy: node tools/bundle.mjs
 * (Máy không có Node có thể dùng Electron của Cursor:
 *  ELECTRON_RUN_AS_NODE=1 cursor tools/bundle.mjs)
 */

import { readFileSync, writeFileSync, mkdirSync, statSync, cpSync, rmSync } from "node:fs";
import { join, dirname, resolve, relative, posix } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");
const DIST = join(ROOT, "dist");

/* ---------- Thu thập module theo đồ thị import ---------- */

const modules = new Map(); // id (tương đối so với src, dạng posix) → source

function idOf(absPath) {
  return posix.join(...relative(SRC, absPath).split(/[\\/]/));
}

function resolveImport(fromId, spec) {
  const abs = resolve(SRC, dirname(fromId), spec);
  return idOf(abs);
}

function collect(absPath) {
  const id = idOf(absPath);
  if (modules.has(id)) return;
  if (id.endsWith(".css")) return; // host.css xử lý riêng
  const src = readFileSync(absPath, "utf8");
  modules.set(id, src);

  const specs = new Set();
  for (const m of src.matchAll(/import\s*(?:\{[^}]*\}\s*from\s*)?["']([^"']+)["']/g)) specs.add(m[1]);
  for (const m of src.matchAll(/export\s*\{[^}]*\}\s*from\s*["']([^"']+)["']/g)) specs.add(m[1]);
  for (const m of src.matchAll(/import\(\s*["']([^"']+)["']\s*\)/g)) specs.add(m[1]);

  for (const spec of specs) {
    if (!spec.startsWith(".")) {
      throw new Error(`Import ngoài package không hỗ trợ offline: ${spec} (trong ${id})`);
    }
    collect(resolve(SRC, dirname(id), spec));
  }
}

collect(join(SRC, "index.js"));

/* ---------- Chuyển đổi một module sang CommonJS-lite ---------- */

function transform(id, src) {
  let out = src;
  const exportNames = [];

  // Re-export:  export { A } from "./x.js";
  out = out.replace(/export\s*\{([^}]*)\}\s*from\s*["']([^"']+)["'];?/g, (_, names, spec) => {
    const target = resolveImport(id, spec);
    return names
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean)
      .map((n) => {
        const [orig, alias] = n.split(/\s+as\s+/).map((s) => s.trim());
        return `exports.${alias || orig} = __req(${JSON.stringify(target)}).${orig};`;
      })
      .join("\n");
  });

  // Import named:  import { a, b as c } from "./x.js";
  out = out.replace(/import\s*\{([^}]*)\}\s*from\s*["']([^"']+)["'];?/g, (_, names, spec) => {
    const target = resolveImport(id, spec);
    const mapped = names
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean)
      .map((n) => {
        const [orig, alias] = n.split(/\s+as\s+/).map((s) => s.trim());
        return alias ? `${orig}: ${alias}` : orig;
      })
      .join(", ");
    return `const { ${mapped} } = __req(${JSON.stringify(target)});`;
  });

  // Import side-effect:  import "./x.js";
  out = out.replace(/import\s*["']([^"']+)["'];?/g, (_, spec) => {
    return `__req(${JSON.stringify(resolveImport(id, spec))});`;
  });

  // Dynamic import → Promise.resolve(module đã inline)
  out = out.replace(/import\(\s*["']([^"']+)["']\s*\)/g, (_, spec) => {
    return `Promise.resolve(__req(${JSON.stringify(resolveImport(id, spec))}))`;
  });

  // export function/class/const/let
  out = out.replace(/export\s+(async\s+)?function\s+([A-Za-z0-9_$]+)/g, (_, asyncKw, name) => {
    exportNames.push(name);
    return `${asyncKw || ""}function ${name}`;
  });
  out = out.replace(/export\s+class\s+([A-Za-z0-9_$]+)/g, (_, name) => {
    exportNames.push(name);
    return `class ${name}`;
  });
  out = out.replace(/export\s+const\s+([A-Za-z0-9_$]+)/g, (_, name) => {
    exportNames.push(name);
    return `const ${name}`;
  });
  out = out.replace(/export\s+let\s+([A-Za-z0-9_$]+)/g, (_, name) => {
    exportNames.push(name);
    return `let ${name}`;
  });

  // export { A, B };  (không from — from đã xử lý ở trên)
  out = out.replace(/export\s*\{([^}]*)\};?/g, (_, names) => {
    return names
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean)
      .map((n) => {
        const [orig, alias] = n.split(/\s+as\s+/).map((s) => s.trim());
        return `exports.${alias || orig} = ${orig};`;
      })
      .join("\n");
  });

  const tail = exportNames.map((n) => `exports.${n} = ${n};`).join(" ");
  return `${out}\n${tail}`;
}

/* ---------- Xuất dist ---------- */

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

// 1) Cây ES modules (giữ lazy-loading thật)
cpSync(SRC, join(DIST, "es"), { recursive: true });

// 2) Entry ES giữ tên file như tài liệu
writeFileSync(
  join(DIST, "arcade-404.es.js"),
  `/* 404 Arcade — ES entry (module thật trong ./es/, lazy-load nguyên bản) */\nexport * from "./es/index.js";\n`
);

// 3) IIFE một file
let iife = `/* 404 Arcade — IIFE build (offline bundler). Mọi game inline sẵn. */\n(function () {\n"use strict";\nconst __defs = {};\nconst __cache = {};\nfunction __req(id) {\n  if (__cache[id]) return __cache[id].exports;\n  const mod = (__cache[id] = { exports: {} });\n  __defs[id](mod.exports, __req);\n  return mod.exports;\n}\n`;

for (const [id, src] of modules) {
  iife += `__defs[${JSON.stringify(id)}] = function (exports, __req) {\n${transform(id, src)}\n};\n`;
}
iife += `window.Arcade404 = __req("index.js");\n})();\n`;

writeFileSync(join(DIST, "arcade-404.iife.js"), iife);

// 4) CSS cấp host
writeFileSync(join(DIST, "arcade-404.css"), readFileSync(join(SRC, "host.css"), "utf8"));

/* ---------- Báo cáo ---------- */
const size = (p) => `${(statSync(p).size / 1024).toFixed(1)} KB`;
console.log("dist/ da tao xong:");
console.log(`  arcade-404.es.js    (${size(join(DIST, "arcade-404.es.js"))}) + es/ (${modules.size} modules)`);
console.log(`  arcade-404.iife.js  (${size(join(DIST, "arcade-404.iife.js"))})`);
console.log(`  arcade-404.css      (${size(join(DIST, "arcade-404.css"))})`);
