/**
 * Build ES Module (có code-splitting — game & engine 3D tách chunk riêng,
 * không nằm trong initial bundle).
 *
 * LƯU Ý: máy phát triển hiện tại KHÔNG có Internet nên chưa cài được
 * vite; config này chuẩn bị sẵn cho môi trường có mạng:
 *   npm install && npm run build
 * Khi offline, dùng bộ bundler thuần Node đi kèm:
 *   npm run bundle:offline   (hoặc: node tools/bundle.mjs)
 */

import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: false,
    lib: {
      entry: "src/index.js",
      formats: ["es"],
      fileName: () => "arcade-404.es.js",
    },
    rollupOptions: {
      output: {
        chunkFileNames: "chunks/[name]-[hash].js",
      },
    },
  },
});
