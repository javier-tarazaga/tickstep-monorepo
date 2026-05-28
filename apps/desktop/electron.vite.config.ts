import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: "dist/main",
      lib: {
        entry: "src/main/index.ts",
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: "dist/preload",
      lib: {
        entry: "src/main/preload.ts",
      },
    },
  },
  renderer: {
    plugins: [react()],
    root: "src/renderer",
    server: {
      port: 5273,
    },
    build: {
      outDir: "dist/renderer",
      // Workspace packages resolve to packages/* (outside node_modules), so by
      // default they fall outside Rollup's CommonJS transform. shared-types is
      // built as CJS; include it so its named exports (e.g. WS_EVENTS) resolve.
      commonjsOptions: {
        include: [
          /node_modules/,
          /packages\/shared-types/,
          /packages\/shared-utils/,
        ],
        transformMixedEsModules: true,
      },
      rollupOptions: {
        input: "src/renderer/index.html",
      },
    },
  },
});
