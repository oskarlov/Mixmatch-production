import express from "express";
import http from "http";
import { Server } from "socket.io";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** ------------------ setup ------------------ */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 8080);
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, methods: ["GET", "POST"] },
});

// Serve demo media from /media (drop an MP3 here)
const MEDIA_DIR = path.join(__dirname, "media");
const AUDIO_FILE = "track1.mp3"; // change if you use a different file
app.use("/media", express.static(MEDIA_DIR));

/** ------------------ room state ------------------ */
/**
 * Room shape:
 * {
 *   code: string,
 *   hostId: string,
 *   players: Map<socketId, { id, name, score }>,
 *   q: { id, prompt, options: string[], correctIndex: number, durationMs: number } | null,
 *   answers: Map<socketId, number>, // selected answer index
 *   seconds: number, // countdown
 *   timer: NodeJS.Timeout | null
 * }
 */
const rooms = new Map();

/** ------------------ helpers ------------------ */
function newCode() {
  // 4 hex chars, e.g., "A9F2"
  return crypto.randomBytes(2).toString("hex").toUpperCase();
}

function roomPlayersArray(room) {
  return Array.from(room.players.values());
}

function emitRoomUpdate(code) {
  const room = rooms.get(code);
  if (!room) return;
  io.to(code).emit("room:update", {
    code: room.code,
    hostId: room.hostId,
    players: roomPlayersArray(room),
  });
}

function stopTimer(room) {
  if (room.timer) {
    clearInterval(room.timer);
    room.timer = null;
  }
}

/** ------------------ socket logic ------------------ */
io.on("connection", (socket) => {
  // Keep track of where this socket is
  socket.data.role = null; // "host" | "player"
  socket.data.code = null;

  /** Host creates a room */
  socket.on("host:createRoom", (_payload, cb) => {
    try {
      // If already in a room, leave it
      if (socket.data.code) socket.leave(socket.data.code);

      let code = newCode();
      while (rooms.has(code)) code = newCode();

      const room = {
        code,
        hostId: socket.id,
        players: new Map(),
        q: null,
        answers: new Map(),
        seconds: 0,
        timer: null,
      };

      rooms.set(code, room);
      socket.join(code);
      socket.data.role = "host";
      socket.data.code = code;

      emitRoomUpdate(code);
      cb?.({ ok: true, code });
    } catch (err) {
      console.error("host:createRoom error", err);
      cb?.({ ok: false, error: "SERVER_ERROR" });
    }
  });

  /** Player joins a room */
  socket.on("player:joinRoom", ({ code, name }, cb) => {
    try {
      const room = rooms.get((code || "").toUpperCase());
      if (!room) return cb?.({ ok: false, error: "NO_SUCH_ROOM" });

      socket.join(room.code);
      socket.data.role = "player";
      socket.data.code = room.code;

      const player = { id: socket.id, name: name?.trim() || "Player", score: 0 };
      room.players.set(socket.id, player);

      emitRoomUpdate(room.code);
      cb?.({ ok: true });
    } catch (err) {
      console.error("player:joinRoom error", err);
      cb?.({ ok: false, error: "SERVER_ERROR" });
    }
  });

  /** Host starts a round */
  socket.on("game:startRound", ({ code }, cb) => {
    try {
      const room = rooms.get(code || socket.data.code);
      if (!room) return cb?.({ ok: false, error: "NO_SUCH_ROOM" });
      if (room.hostId !== socket.id) return cb?.({ ok: false, error: "NOT_HOST" });

      // Mock question for now
      const q = {
        id: String(Date.now()),
        prompt: "Which track is by Daft Punk?",
        options: ["One More Time", "Nikes", "Ribs", "Toxic"],
        correctIndex: 0,
        durationMs: 15000, // 15s
      };

      // reset round state
      stopTimer(room);
      room.q = q;
      room.answers = new Map();
      room.seconds = Math.max(1, Math.round(q.durationMs / 1000));

      // Emit new question to everyone in the room
      io.to(room.code).emit("question:new", q);

      // Send media to the hub only (host socket)
      const media = { id: q.id, audioUrl: `/media/${AUDIO_FILE}`, durationMs: q.durationMs };
      io.to(room.hostId).emit("question:hubMedia", media);

      // Start countdown ticks
      io.to(room.code).emit("question:tick", { seconds: room.seconds });
      room.timer = setInterval(() => {
        room.seconds -= 1;
        if (room.seconds <= 0) {
          stopTimer(room);
          room.seconds = 0;
        }
        io.to(room.code).emit("question:tick", { seconds: room.seconds });
      }, 1000);

      cb?.({ ok: true, questionId: q.id });
    } catch (err) {
      console.error("game:startRound error", err);
      cb?.({ ok: false, error: "SERVER_ERROR" });
    }
  });

  /** Player submits an answer */
  socket.on("answer:submit", ({ code, questionId, answerIndex }, cb) => {
    try {
      const room = rooms.get(code || socket.data.code);
      if (!room) return cb?.({ ok: false, error: "NO_SUCH_ROOM" });
      if (!room.q || room.q.id !== questionId) return cb?.({ ok: false, error: "NO_ACTIVE_QUESTION" });

      // If timer already ended, ignore new answers
      if (room.seconds <= 0) return cb?.({ ok: false, error: "TIME_UP" });

      // Record first answer only
      if (!room.answers.has(socket.id)) {
        room.answers.set(socket.id, Number(answerIndex));
      }
      cb?.({ ok: true });
    } catch (err) {
      console.error("answer:submit error", err);
      cb?.({ ok: false, error: "SERVER_ERROR" });
    }
  });

  /** Host reveals correct answer and scores */
  socket.on("game:reveal", ({ code }, cb) => {
    try {
      const room = rooms.get(code || socket.data.code);
      if (!room) return cb?.({ ok: false, error: "NO_SUCH_ROOM" });
      if (room.hostId !== socket.id) return cb?.({ ok: false, error: "NOT_HOST" });

      stopTimer(room);

      const correct = room.q?.correctIndex ?? 0;

      // Score: +1 for correct
      for (const [sid, idx] of room.answers.entries()) {
        if (idx === correct) {
          const p = room.players.get(sid);
          if (p) p.score += 1;
        }
      }

      // Reveal to all
      io.to(room.code).emit("question:reveal", { correctIndex: correct });

      // Update roster with new scores
      emitRoomUpdate(room.code);

      cb?.({ ok: true });
    } catch (err) {
      console.error("game:reveal error", err);
      cb?.({ ok: false, error: "SERVER_ERROR" });
    }
  });

  /** Disconnect handling */
  socket.on("disconnect", () => {
    const code = socket.data.code;
    if (!code) return;

    const room = rooms.get(code);
    if (!room) return;

    if (socket.id === room.hostId) {
      // Host left: close the room
      stopTimer(room);
      io.to(code).emit("room:closed");
      io.in(code).socketsLeave(code);
      rooms.delete(code);
    } else {
      // Remove player and update roster
      room.players.delete(socket.id);
      emitRoomUpdate(code);
    }
  });
});

/** ------------------ start server ------------------ */
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log(`Serving media from /media (dir: ${MEDIA_DIR})`);
});
