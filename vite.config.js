// vite.config.js (ESM)
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    outDir: "dist",
    target: "es2018",
    assetsInlineLimit: 100000000, // 念のため大きめ
    cssCodeSplit: false,
  },
  base: "./", // 相対参照で単一HTMLにしやすく
});
