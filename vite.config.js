import { defineConfig } from "vite";
import { sveltekit } from "@sveltejs/kit/vite";
import process from "node:process";
import tailwindcss from "@tailwindcss/vite";
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [sveltekit(), tailwindcss()],
  cacheDir: process.env.SORREL_E2E === "1" ? "node_modules/.vite-e2e" : undefined,
  optimizeDeps: {
    exclude: [
      "svelte-codemirror-editor", "codemirror",
      "@codemirror/language", "@codemirror/view", "@codemirror/legacy-modes", "@codemirror/autocomplete",
      "@codemirror/state", "@codemirror/commands", "@codemirror/lint", "@codemirror/search",
      "@lezer/highlight", "@lezer/common", "@lezer/lr",
    ],
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || "127.0.0.1",
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
