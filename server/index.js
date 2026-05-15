/*
 * Lightweight Express wrapper used when the frontend is packaged with its own
 * small Node server instead of running only as a static Vite app.
 */
import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo.js";
export function createServer() {
    const app = express();
    // Middleware
    app.use(cors());
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    // Example API routes
    app.get("/api/ping", (_req, res) => {
        const ping = process.env.PING_MESSAGE ?? "ping";
        res.json({ message: ping });
    });
    app.get("/api/demo", handleDemo);
    return app;
}
