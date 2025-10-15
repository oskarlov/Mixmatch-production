import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerGameEngine } from "./engine/gameEngine.js";

/** ------------------ setup ------------------ */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 8080);
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, methods: ["GET", "POST"] },
});

// quick info + health
app.get("/", (_req, res) =>
  res.type("text").send("MixMatch server is running. Try /health or /socket.io")
);
app.get("/health", (_req, res) => res.json({ ok: true }));

// Serve local media (optional)
const MEDIA_DIR = path.join(__dirname, "media");
app.use("/media", express.static(MEDIA_DIR));

/** ------------------ game engine ------------------ */
registerGameEngine(io, MEDIA_DIR);

/** ------------------ start server ------------------ */
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log(`Serving media from /media (dir: ${MEDIA_DIR})`);
});
