/**
 * Build IIFE/static embed — một file duy nhất cho hệ thống cũ
 * (mọi game inline sẵn; đổi lại không có lazy-loading).
 */

import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: false,
    lib: {
      entry: "src/index.js",
      formats: ["iife"],
      name: "Arcade404",
      fileName: () => "arcade-404.iife.js",
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
