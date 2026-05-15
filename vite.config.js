import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "");
  const devServerPort = Number.parseInt(env.VITE_DEV_SERVER_PORT || "5173", 10);
  const devHmrHost = env.VITE_DEV_HMR_HOST || env.VITE_DEV_LAN_HOST || "";
  const proxyTarget = env.VITE_DEV_PROXY_TARGET || "http://127.0.0.1:8080";
  const resolvedDevServerPort = Number.isNaN(devServerPort) ? 5173 : devServerPort;

  const hmrConfig = devHmrHost
    ? {
        host: devHmrHost,
        clientPort: resolvedDevServerPort,
        protocol: "ws",
      }
    : undefined;

  return {
    define: {
      // Polyfill Node.js `global` for browser bundles.
      // Required by sockjs-client, @stomp/stompjs and other Node-targeting libs.
      global: "globalThis",
    },
    server: {
      host: "0.0.0.0",
      port: resolvedDevServerPort,
      strictPort: true,
      hmr: hmrConfig,
      proxy: {
        // Browser API calls stay on /api in dev and Vite forwards them to the gateway.
        "/api": {
          target: proxyTarget,
          changeOrigin: true,
          rewrite: (requestPath) => requestPath.replace(/^\/api/, ""),
        },
        // SockJS/STOMP traffic uses the gateway /ws endpoint directly.
        "/ws": {
          target: proxyTarget,
          changeOrigin: true,
          ws: true,
        },
      },
    },
    build: {
      outDir: "dist/spa",
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./client"),
        "@shared": path.resolve(__dirname, "./shared"),
      },
    },
  };
});
