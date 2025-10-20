﻿import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { registerGameEngine } from "./engine/gameEngine.js";
import { GameRound } from "./models/GameRound.js";

/** ------------------ environment ------------------ */
dotenv.config();

/** ------------------ setup ------------------ */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 8080);
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  //cors: { origin: true, methods: ["GET", "POST"] },
  cors: {
    origin: ["https://mixmatch-production-hub.vercel.app", "https://mixmatch-production-player.vercel.app", "http://localhost:5173/"],
    methods: ["GET", "POST"],
  },
});

// quick info + health
app.get("/", (_req, res) =>
  res.type("text").send("MixMatch server is running. Try /health or /socket.io")
);
app.get("/health", (_req, res) => res.json({ ok: true }));

// Serve local media (optional)
const MEDIA_DIR = path.join(__dirname, "media");
app.use("/media", express.static(MEDIA_DIR));

/** ------------------ MongoDB connection ------------------ */
if (!process.env.MONGO_URI) {
  console.error("❌ MONGO_URI missing from environment");
} else {
  console.log("Attempting MongoDB connection...");
  mongoose
    .connect(process.env.MONGO_URI, { dbName: "mixmatch" })
    .then(() => console.log("✅ Connected to MongoDB Atlas"))
    .catch((err) => console.error("❌ MongoDB connection error:", err));
}

mongoose.connection.on("connected", () => console.log("🟢 MongoDB connected"));
mongoose.connection.on("error", (err) => console.error("🔴 MongoDB error:", err));

/** ------------------ Stats routes ------------------ */
import statsRoutes from "./routes/stats.js";
app.use("/api/stats", statsRoutes);

/** ------------------ game engine ------------------ */
registerGameEngine(io, MEDIA_DIR);

/** ------------------ start server ------------------ */
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log(`Serving media from /media (dir: ${MEDIA_DIR})`);
});
