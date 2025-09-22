require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const DEV_MEDIA_BASE = process.env.DEV_MEDIA_BASE || "http://localhost:5173";
const app = express();
app.use(cors()); // allow all in dev
app.use(express.json());

app.get("/health", (_, res) => res.json({ ok: true }));
app.get("/", (_, res) => res.send("MixMatch server is up"));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }, // dev-friendly; lock down later
});

// ---- In-memory rooms (MVP) ----
const rooms = new Map(); // code -> { hostId, players: Map<socketId,{name,score}> }

function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let c = "";
  for (let i = 0; i < 4; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return rooms.has(c) ? genCode() : c;
}

function emitRoster(code) {
  const room = rooms.get(code);
  if (!room) return;
  const players = [...room.players.entries()].map(([id, p]) => ({
    id, name: p.name, score: p.score,
  }));
  io.to(code).emit("room:update", { code, players, hostId: room.hostId });
}

io.on("connection", (socket) => {
  console.log("connected:", socket.id);

  socket.on("host:createRoom", (_payload, cb) => {
    try {
      const code = genCode();
      rooms.set(code, { hostId: socket.id, players: new Map() });
      socket.join(code);
      emitRoster(code);
      cb && cb({ ok: true, code });
    } catch {
      cb && cb({ ok: false, error: "CREATE_FAILED" });
    }
  });

  socket.on("player:joinRoom", ({ code, name }, cb) => {
    code = (code || "").toUpperCase().trim();
    name = (name || "").trim() || "Player";
    const room = rooms.get(code);
    if (!room) return cb && cb({ ok: false, error: "ROOM_NOT_FOUND" });
    socket.join(code);
    room.players.set(socket.id, { name, score: 0 });
    emitRoster(code);
    cb && cb({ ok: true, code });
    io.to(code).emit("room:toast", `${name} joined`);
  });

  socket.on("game:startRound", ({ code }, cb) => {
    const room = rooms.get(code);
    if (!room || room.hostId !== socket.id)
      return cb && cb({ ok: false, error: "NOT_HOST_OR_NO_ROOM" });
    const q = {
      id: String(Date.now()),
      type: "song-title",
      prompt: "Guess the song title (demo)",
      options: ["A", "B", "C", "D"],
      correctIndex: 1,
      durationMs: 15000,
    };
    io.to(code).emit("question:new", q);
    cb && cb({ ok: true, questionId: q.id });
  });

  socket.on("answer:submit", ({ code, questionId, answerIndex }, cb) => {
    const room = rooms.get(code);
    if (!room) return cb && cb({ ok: false, error: "NO_ROOM" });
    if (answerIndex === 1) {
      const p = room.players.get(socket.id);
      if (p) p.score += 1;
      emitRoster(code);
    }
    cb && cb({ ok: true });
  });

  socket.on("room:leave", ({ code }) => {
    const room = rooms.get(code);
    if (!room) return;
    socket.leave(code);
    if (room.players.has(socket.id)) {
      const name = room.players.get(socket.id).name;
      room.players.delete(socket.id);
      emitRoster(code);
      io.to(code).emit("room:toast", `${name} left`);
    } else if (room.hostId === socket.id) {
      io.to(code).emit("room:closed");
      io.in(code).socketsLeave(code);
      rooms.delete(code);
    }
  });

  socket.on("disconnect", () => {
    for (const [code, room] of rooms.entries()) {
      if (room.players.has(socket.id)) {
        const name = room.players.get(socket.id).name;
        room.players.delete(socket.id);
        emitRoster(code);
        io.to(code).emit("room:toast", `${name} disconnected`);
      } else if (room.hostId === socket.id) {
        io.to(code).emit("room:closed");
        io.in(code).socketsLeave(code);
        rooms.delete(code);
      }
    }
    console.log("disconnected:", socket.id);
  });
  // Host reveals the answer
socket.on("game:reveal", ({ code }, cb) => {
  const room = rooms.get(code);
  if (!room || room.hostId !== socket.id) return cb && cb({ ok:false, error:"NOT_HOST_OR_NO_ROOM" });
  // In demo we always say index=1 is correct
  io.to(code).emit("question:reveal", { correctIndex: 1 });
  cb && cb({ ok:true });
});

// Host requests next round (new demo question)
socket.on("game:startRound", ({ code }, cb) => {
  const room = rooms.get(code);
  if (!room || room.hostId !== socket.id)
    return cb && cb({ ok: false, error: "NOT_HOST_OR_NO_ROOM" });

  const q = {
    id: String(Date.now()),
    type: "audio-guess",
    prompt: "What song is this? (demo)",
    options: ["A", "B", "C", "D"],
    durationMs: 15000,
  };

  const correctIndex = 1; // demo
  const media = {
    // Hub-only audio. Replace later with Spotify preview_url.
    audioUrl: `${DEV_MEDIA_BASE}/samples/track1.mp3`,
  };

  // 1) Public question to everyone in the room (host + players)
  io.to(code).emit("question:new", q);

  // 2) Private media only to the host
  io.to(room.hostId).emit("question:hubMedia", { id: q.id, ...media });

  // (optional) start a simple tick
  let sec = q.durationMs / 1000 | 0;
  const t = setInterval(() => {
    sec--;
    if (sec <= 0) return clearInterval(t);
    io.to(code).emit("question:tick", { seconds: sec });
  }, 1000);

  // keep the answer server-side; reveal later
  cb && cb({ ok: true, questionId: q.id, correctIndex });
});
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`Server running on :${PORT}`));
