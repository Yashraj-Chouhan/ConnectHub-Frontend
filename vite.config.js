import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

// https://vitejs.dev/config/
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => ({
    define: {
        // Polyfill Node.js `global` for browser bundles.
        // Required by sockjs-client, @stomp/stompjs and other Node-targeting libs.
        global: "globalThis",
    },
    server: {
        host: "::",
        port: 8080,
        fs: {
            allow: ["./client", "./shared", "index.html"],
            deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "server/**"],
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
}));

