import path from "node:path";
import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// TAURI_DEV_HOST is set by the Tauri CLI when developing on mobile devices.
// It contains the host address the device/emulator can reach (e.g. LAN IP or TUN addr).
const host = process.env.TAURI_DEV_HOST;

export default defineConfig(({ mode }) => ({
  plugins: mode === "desktop" || mode === "mobile" ? [react()] : [react(), cloudflare()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  // Vite options for mobile development
  clearScreen: false,
  server: {
    host: host || false,
    port: 1420,
    strictPort: true,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
  },
}));
