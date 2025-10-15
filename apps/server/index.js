import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerGameHandlers } from "./sockets/game.js"; // <- NEW

/** ------------------ setup ------------------ */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 8080);
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, methods: ["GET", "POST"] },
});

// optional healthcheck
app.get("/health", (_req, res) => res.json({ ok: true }));

// Serve demo media from /media (drop an MP3 here)
const MEDIA_DIR = path.join(__dirname, "media");
app.use("/media", express.static(MEDIA_DIR));

/** ------------------ register sockets ------------------ */
registerGameHandlers(io, MEDIA_DIR);

/** ------------------ start server ------------------ */
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log(`Serving media from /media (dir: ${MEDIA_DIR})`);
});
