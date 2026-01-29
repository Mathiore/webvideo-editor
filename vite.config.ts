import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import crossOriginIsolation from "vite-plugin-cross-origin-isolation";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    crossOriginIsolation(), // Required for SharedArrayBuffer (needed by FFmpeg.wasm)
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    // FFmpeg is loaded inside the worker; exclude so worker resolution works
    exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util"],
  },
  worker: {
    format: "es",
  },
}));
