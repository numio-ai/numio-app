import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // VITE_API_MODE selects the data source for the whole app (mock | real),
  // fixed at build time. It MUST resolve to a string literal so the unused
  // branch in src/api/client.js tree-shakes out: an undefined VITE_* var is
  // left as a runtime lookup by Vite and would defeat dead-code elimination.
  // An unset var compiles to "real", so default and production builds never
  // bundle the mock layer. (This subsumes the old stripMocksInProd plugin.)
  define: {
    "import.meta.env.VITE_API_MODE": JSON.stringify(process.env.VITE_API_MODE || "real"),
  },
  build: {
    chunkSizeWarningLimit: 600,
  },
  // Per-worktree dev server port and API proxy target are injected via env so
  // parallel worktrees don't fight over 5173/8000. scripts/numio-dev.sh exports
  // FRONTEND_PORT and BACKEND_PROXY_TARGET from .numio/worktree.env before
  // invoking `npm run dev`. Classic defaults apply when no worktree env is
  // loaded (e.g. running `npm run dev` directly).
  server: {
    port: Number(process.env.FRONTEND_PORT) || 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: process.env.BACKEND_PROXY_TARGET || "http://localhost:8000",
        changeOrigin: true,
      },
    },
  }
});

