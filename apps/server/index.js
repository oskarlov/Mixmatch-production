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

// quiet the 404 on /
app.get("/", (_req, res) => res.type("text").send("MixMatch server is running. Try /health or /socket.io"));
app.get("/health", (_req, res) => res.json({ ok: true }));

// Serve demo media from /media (drop an MP3 here)
const MEDIA_DIR = path.join(__dirname, "media");
app.use("/media", express.static(MEDIA_DIR));
/**/
/** ------------------ register sockets ------------------ */
registerGameHandlers(io, MEDIA_DIR);
/** ------------------ room state ------------------ */
/**
 * Room shape:
 * {
 *   code, hostId, stage: "lobby"|"question"|"reveal"|"result"|"gameover",
 *   players: Map<socketId, { id, name, score }>,
 *   firstPlayerId: string|null,
 *   reclaimByName: Map<lowerName, { name, score }>,
 *   whitelistNames: Set<lowerName>|null,
 *   config: { maxQuestions: number, defaultDurationMs: number },
 *   q, answersByName, perOptionCounts, deadline, revealUntil, resultUntil,
 *   timers: { tick, reveal, result }, _poolIdx, qCount, manualLock,
 *   emoteCooldownByName: Map<lowerName, number>,
 * }
 */
const rooms = new Map();

/** ------------------ helpers ------------------ */
function newCode() {
  return crypto.randomBytes(2).toString("hex").toUpperCase(); // e.g., A9F2
}
function uniqueName(room, base) {
  const lower = base.toLowerCase();
  const existing = new Set(Array.from(room.players.values()).map((p) => p.name.toLowerCase()));
  if (!existing.has(lower)) return base;
  let i = 2;
  while (existing.has(`${lower} (${i})`)) i++;
  return `${base} (${i})`;
}
function demoPool() {
  return [
    {
      id: "q1",
      prompt: "Which track is by Daft Punk?",
      options: ["One More Time", "Nikes", "Ribs", "Toxic"],
      correctIndex: 0,
      durationMs: 20000,
      media: { audioUrl: `/media/${AUDIO_FILE}` },
    },
    {
      id: "q2",
      prompt: "Which album is 'Blinding Lights' on?",
      options: ["After Hours", "Random Access Memories", "Fine Line", "DAMN."],
      correctIndex: 0,
      durationMs: 20000,
    },
    {
      id: "q3",
      prompt: "Who contributed this song to the round?",
      options: ["Alice", "Bob", "Charlie", "Dana"],
      correctIndex: 1,
      durationMs: 20000,
    },
  ];
}
function nextFromPool(room) {
  const pool = demoPool();
  const idx = (room._poolIdx ?? -1) + 1;
  room._poolIdx = idx % pool.length;
  return pool[room._poolIdx];
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
    firstPlayerId: room.firstPlayerId || null,
    config: room.config,
  });
}
function clearTimers(room) {
  if (!room?.timers) return;
  const { tick, reveal, result } = room.timers;
  if (tick) clearInterval(tick);
  if (reveal) clearTimeout(reveal);
  if (result) clearTimeout(result);
  room.timers = { tick: null, reveal: null, result: null };
}
function stopAllAndClose(room) {
  clearTimers(room);
  io.to(room.code).emit("room:closed");
  io.in(room.code).socketsLeave(room.code);
  rooms.delete(room.code);
}
function progressCounts(room) {
  const connected = new Set(Array.from(room.players.values()).map((p) => p.name.toLowerCase()));
  let answered = 0;
  for (const key of room.answersByName.keys()) {
    if (connected.has(key)) answered++;
  }
  return { answered, total: room.players.size };
}

/** ------------------ round engine ------------------ */
function startQuestion(room) {
  clearTimers(room);
  if (room.qCount >= room.config.maxQuestions) return gameEnd(room);

  const q = nextFromPool(room);
  if (!q) return gameEnd(room);

  room.stage = "question";
  room.q = q;
  room.answersByName = new Map();
  room.perOptionCounts = Array(q.options.length).fill(0);

  const durationMs = room.config.defaultDurationMs ?? 20000;
  room.deadline = Date.now() + durationMs;
  room.revealUntil = null;
  room.resultUntil = null;
  room.qCount += 1;

  io.to(room.code).emit("question:new", {
    id: q.id,
    prompt: q.prompt,
    options: q.options,
    durationMs,
    deadline: room.deadline,
  });

  if (q.media?.audioUrl) {
    io.to(room.hostId).emit("question:hubMedia", {
      id: q.id,
      audioUrl: q.media.audioUrl,
      durationMs,
    });
  }

  emitTick(room);
  const { answered, total } = progressCounts(room);
  io.to(room.code).emit("progress:update", { answered, total });

  room.timers.tick = setInterval(() => {
    emitTick(room);
    if (Date.now() >= room.deadline) {
      clearInterval(room.timers.tick);
      reveal(room);
    }
  }, 1000);
}
function emitTick(room) {
  const seconds = Math.max(0, Math.ceil((room.deadline - Date.now()) / 1000));
  io.to(room.code).emit("question:tick", { seconds });
}
function submitAnswer(room, socketId, answerIndex) {
  if (room.stage !== "question" || !room.q) return;
  if (Date.now() >= room.deadline) return;

  const player = room.players.get(socketId);
  if (!player) return;
  const key = player.name.toLowerCase();

  if (room.answersByName.has(key)) return;

  const choice = Number(answerIndex);
  room.answersByName.set(key, choice);
  if (Number.isInteger(choice) && choice >= 0 && choice < room.perOptionCounts.length) {
    room.perOptionCounts[choice]++;
  }

  const { answered, total } = progressCounts(room);
  io.to(room.code).emit("progress:update", { answered, total });

  if (answered >= total) {
    clearInterval(room.timers.tick);
    reveal(room);
  }
}
function reveal(room) {
  if (room.stage !== "question" || !room.q) return;
  room.stage = "reveal";
  room.revealUntil = Date.now() + 15000;

  io.to(room.code).emit("question:reveal", {
    correctIndex: room.q.correctIndex ?? 0,
    perOptionCounts: room.perOptionCounts || [],
    revealUntil: room.revealUntil,
  });

  room.timers.reveal = setTimeout(() => result(room), 15000);
}
function result(room) {
  if (!room.q) return;
  room.stage = "result";

  const correct = room.q.correctIndex ?? 0;
  for (const p of room.players.values()) {
    const idx = room.answersByName.get(p.name.toLowerCase());
    if (idx === correct) p.score = (p.score || 0) + 1;
  }

  const leaderboard = [...room.players.values()]
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .map((p) => ({ id: p.id, name: p.name, score: p.score || 0 }));

  room.resultUntil = Date.now() + 8000;

  io.to(room.code).emit("question:result", {
    leaderboard,
    resultUntil: room.resultUntil,
  });

  emitRoomUpdate(room.code);

  room.timers.result = setTimeout(() => {
    if (room.qCount >= room.config.maxQuestions) gameEnd(room);
    else startQuestion(room);
  }, 8000);
}
function gameEnd(room) {
  clearTimers(room);
  room.stage = "gameover";
  const leaderboard = [...room.players.values()]
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .map((p) => ({ id: p.id, name: p.name, score: p.score || 0 }));
  io.to(room.code).emit("game:end", { leaderboard });
}
function canControl(socket, room) {
  return socket.id === room.hostId || socket.id === room.firstPlayerId;
}
function advance(room) {
  if (room.stage === "reveal") {
    clearTimeout(room.timers.reveal);
    result(room);
  } else if (room.stage === "result") {
    clearTimeout(room.timers.result);
    if (room.qCount >= room.config.maxQuestions) gameEnd(room);
    else startQuestion(room);
  }
}
function playAgain(room) {
  clearTimers(room);
  for (const p of room.players.values()) p.score = 0;
  room._poolIdx = -1;
  room.qCount = 0;
  emitRoomUpdate(room.code);
  startQuestion(room);
}
function toLobby(room) {
  clearTimers(room);

  room.stage = "lobby";
  for (const p of room.players.values()) p.score = 0;

  room.q = null;
  room.answersByName = new Map();
  room.answers = new Map();
  room.perOptionCounts = [];
  room.deadline = null;
  room.revealUntil = null;
  room.resultUntil = null;
  room._poolIdx = -1;
  room.qCount = 0;

  room.whitelistNames = null;
  room.reclaimByName = new Map();
  room.emoteCooldownByName = new Map();

  emitRoomUpdate(room.code);
  io.to(room.code).emit("game:lobby");
}

/** ------------------ socket logic ------------------ */
io.on("connection", (socket) => {
  console.log("[WS] connected", socket.id);
  socket.onAny((event) => console.log("[WS IN]", event));

  socket.data.role = null; // "host" | "player"
  socket.data.code = null;

  /** Host creates a room */
  socket.on("host:createRoom", (_payload, cb) => {
    try {
      if (socket.data.code) socket.leave(socket.data.code);

      let code = newCode();
      while (rooms.has(code)) code = newCode();

      const room = {
        code,
        hostId: socket.id,
        stage: "lobby",
        players: new Map(),
        firstPlayerId: null,
        reclaimByName: new Map(),
        whitelistNames: null,
        config: {
          maxQuestions: demoPool().length,
          defaultDurationMs: 20000,
        },
        q: null,
        answersByName: new Map(),
        perOptionCounts: [],
        deadline: null,
        revealUntil: null,
        resultUntil: null,
        timers: { tick: null, reveal: null, result: null },
        _poolIdx: -1,
        qCount: 0,
        manualLock: false,
        emoteCooldownByName: new Map(),
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

  /** Player joins a room (strict: only whitelisted names can rejoin after start) */
  socket.on("player:joinRoom", ({ code, name }, cb) => {
    try {
      const room = rooms.get((code || "").toUpperCase());
      if (!room) return cb?.({ ok: false, error: "NO_SUCH_ROOM" });

      const desired = name?.trim() || "Player";
      const key = desired.toLowerCase();

      const joiningDuringGame = room.stage !== "lobby";
      const connectedNames = new Set(Array.from(room.players.values()).map((p) => p.name.toLowerCase()));

      let finalName = desired;
      let startScore = 0;
      let isReclaim = false;

      if (joiningDuringGame) {
        if (!room.whitelistNames?.has(key)) {
          return cb?.({ ok: false, error: "ROOM_LOCKED" });
        }
        if (room.reclaimByName.has(key) && !connectedNames.has(key)) {
          const saved = room.reclaimByName.get(key);
          finalName = saved.name;
          startScore = saved.score || 0;
          isReclaim = true;
          room.reclaimByName.delete(key);
        } else {
          return cb?.({ ok: false, error: "ROOM_LOCKED" });
        }
      } else {
        if (room.reclaimByName.has(key) && !connectedNames.has(key)) {
          const saved = room.reclaimByName.get(key);
          finalName = saved.name;
          startScore = saved.score || 0;
          isReclaim = true;
          room.reclaimByName.delete(key);
        } else {
          finalName = uniqueName(room, desired);
        }
      }

      socket.join(room.code);
      socket.data.role = "player";
      socket.data.code = room.code;

      const player = { id: socket.id, name: finalName, score: startScore };
      room.players.set(socket.id, player);

      if (!room.firstPlayerId) room.firstPlayerId = socket.id;

      // Stage sync to this socket only
      if (room.stage === "question" && room.q) {
        const nowLeft = Math.max(0, (room.deadline ?? Date.now()) - Date.now());
        socket.emit("question:new", {
          id: room.q.id,
          prompt: room.q.prompt,
          options: room.q.options,
          durationMs: nowLeft || room.config.defaultDurationMs,
          deadline: room.deadline,
        });
        const { answered, total } = progressCounts(room);
        socket.emit("progress:update", { answered, total });
      } else if (room.stage === "reveal") {
        socket.emit("question:reveal", {
          correctIndex: room.q?.correctIndex ?? 0,
          perOptionCounts: room.perOptionCounts || [],
          revealUntil: room.revealUntil || Date.now(),
        });
      } else if (room.stage === "result") {
        const leaderboard = [...room.players.values()]
          .sort((a, b) => (b.score || 0) - (a.score || 0))
          .map((p) => ({ id: p.id, name: p.name, score: p.score || 0 }));
        socket.emit("question:result", {
          leaderboard,
          resultUntil: room.resultUntil || Date.now(),
        });
      } else if (room.stage === "gameover") {
        const leaderboard = [...room.players.values()]
          .sort((a, b) => (b.score || 0) - (a.score || 0))
          .map((p) => ({ id: p.id, name: p.name, score: p.score || 0 }));
        socket.emit("game:end", { leaderboard });
      }

      emitRoomUpdate(room.code);
      cb?.({ ok: true, reclaimed: isReclaim, name: finalName, score: startScore });
    } catch (err) {
      console.error("player:joinRoom error", err);
      cb?.({ ok: false, error: "SERVER_ERROR" });
    }
  });

  /** Start game (host OR first player) */
  socket.on("game:startGame", ({ code }, cb) => {
    try {
      const room = rooms.get((code || socket.data.code || "").toUpperCase());
      if (!room) return cb?.({ ok: false, error: "NO_SUCH_ROOM" });
      if (!(socket.id === room.hostId || socket.id === room.firstPlayerId)) {
        return cb?.({ ok: false, error: "NOT_ALLOWED" });
      }
      if (room.stage !== "lobby") return cb?.({ ok: false, error: "ALREADY_STARTED" });

      room.whitelistNames = new Set(Array.from(room.players.values()).map((p) => p.name.toLowerCase()));
      room._poolIdx = -1;
      room.qCount = 0;

      startQuestion(room);
      cb?.({ ok: true, questionId: room.q?.id });
    } catch (err) {
      console.error("game:startGame error", err);
      cb?.({ ok: false, error: "SERVER_ERROR" });
    }
  });

  /** Backwards compat */
  socket.on("game:startRound", ({ code }, cb) => {
    try {
      const room = rooms.get((code || socket.data.code || "").toUpperCase());
      if (!room) return cb?.({ ok: false, error: "NO_SUCH_ROOM" });

      const allowed = socket.id === room.hostId || socket.id === room.firstPlayerId;
      if (!allowed) return cb?.({ ok: false, error: "NOT_ALLOWED" });
      if (room.stage !== "lobby") return cb?.({ ok: false, error: "ALREADY_STARTED" });

      room.whitelistNames = new Set(Array.from(room.players.values()).map((p) => p.name.toLowerCase()));
      room._poolIdx = -1;
      room.qCount = 0;

      startQuestion(room);
      cb?.({ ok: true, questionId: room.q?.id });
    } catch (err) {
      console.error("game:startRound error", err);
      cb?.({ ok: false, error: "SERVER_ERROR" });
    }
  });

  /** Player submits an answer */
  socket.on("answer:submit", ({ code, questionId, answerIndex }, cb) => {
    try {
      const room = rooms.get((code || socket.data.code || "").toUpperCase());
      if (!room) return cb?.({ ok: false, error: "NO_SUCH_ROOM" });
      if (!room.q || room.q.id !== questionId) return cb?.({ ok: false, error: "NO_ACTIVE_QUESTION" });

      submitAnswer(room, socket.id, answerIndex);
      cb?.({ ok: true });
    } catch (err) {
      console.error("answer:submit error", err);
      cb?.({ ok: false, error: "SERVER_ERROR" });
    }
  });

  /** Manual reveal (host only) */
  socket.on("game:reveal", ({ code }, cb) => {
    try {
      const room = rooms.get((code || socket.data.code || "").toUpperCase());
      if (!room) return cb?.({ ok: false, error: "NO_SUCH_ROOM" });
      if (room.hostId !== socket.id) return cb?.({ ok: false, error: "NOT_HOST" });

      clearInterval(room.timers.tick);
      reveal(room);
      cb?.({ ok: true });
    } catch (err) {
      console.error("game:reveal error", err);
      cb?.({ ok: false, error: "SERVER_ERROR" });
    }
  });

  /** Continue (skip timers) – host or first player; only in reveal/result */
  socket.on("game:advance", ({ code }, cb) => {
    try {
      const room = rooms.get((code || socket.data.code || "").toUpperCase());
      if (!room) return cb?.({ ok: false, error: "NO_SUCH_ROOM" });
      if (!canControl(socket, room)) return cb?.({ ok: false, error: "NOT_ALLOWED" });
      if (!["reveal", "result"].includes(room.stage)) {
        return cb?.({ ok: false, error: "BAD_STAGE" });
      }
      advance(room);
      cb?.({ ok: true });
    } catch (err) {
      console.error("game:advance error", err);
      cb?.({ ok: false, error: "SERVER_ERROR" });
    }
  });

  /** Play again (reset scores + start immediately) */
  socket.on("game:playAgain", ({ code }, cb) => {
    try {
      const room = rooms.get((code || socket.data.code || "").toUpperCase());
      if (!room) return cb?.({ ok: false, error: "NO_SUCH_ROOM" });
      if (!canControl(socket, room)) return cb?.({ ok: false, error: "NOT_ALLOWED" });
      room._poolIdx = -1;
      room.qCount = 0;
      playAgain(room);
      cb?.({ ok: true });
    } catch (err) {
      console.error("game:playAgain error", err);
      cb?.({ ok: false, error: "SERVER_ERROR" });
    }
  });

  /** Back to lobby */
  socket.on("game:toLobby", ({ code }, cb) => {
    try {
      const room = rooms.get((code || socket.data.code || "").toUpperCase());
      if (!room) return cb?.({ ok: false, error: "NO_SUCH_ROOM" });
      if (!canControl(socket, room)) return cb?.({ ok: false, error: "NOT_ALLOWED" });
      toLobby(room);
      cb?.({ ok: true });
    } catch (err) {
      console.error("game:toLobby error", err);
      cb?.({ ok: false, error: "SERVER_ERROR" });
    }
  });

  /** Simple Game Settings (host-only, lobby-only) */
  socket.on("game:updateConfig", (payload, cb) => {
    try {
      const code = (payload?.code || socket.data?.code || "").toUpperCase();
      const room = rooms.get(code);
      if (!room) return cb?.({ ok: false, error: "NO_SUCH_ROOM" });

      if (socket.id !== room.hostId) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.stage !== "lobby") return cb?.({ ok: false, error: "ALREADY_STARTED" });

      const clamp = (n, lo, hi, fallback) =>
        Number.isFinite(Number(n)) ? Math.max(lo, Math.min(hi, Number(n))) : fallback;

      const maxQuestions = clamp(payload?.maxQuestions, 1, 50, room.config.maxQuestions);
      const defaultDurationMs = clamp(payload?.durationMs, 5000, 120000, room.config.defaultDurationMs);

      room.config.maxQuestions = maxQuestions;
      room.config.defaultDurationMs = defaultDurationMs;

      emitRoomUpdate(room.code);
      cb?.({ ok: true, config: room.config });
    } catch (err) {
      console.error("game:updateConfig error", err);
      cb?.({ ok: false, error: "SERVER_ERROR" });
    }
  });

  /** ------------------ EMOTES ------------------ */
  // Player or Host sends a small base64 PNG emote; 5s cooldown per display name; ALWAYS acks.
  socket.on("emote:send", ({ code, image }, cb = () => {}) => {
    try {
      const room = rooms.get((code || socket.data.code || "").toUpperCase());
      if (!room) {
        console.warn("emote:send NO_SUCH_ROOM", code);
        return cb({ ok: false, error: "NO_SUCH_ROOM" });
      }

      const player = room.players.get(socket.id);
      const isHost = socket.id === room.hostId;
      if (!player && !isHost) {
        console.warn("emote:send NOT_IN_ROOM", { socket: socket.id, room: room.code });
        return cb({ ok: false, error: "NOT_IN_ROOM" });
      }

      if (typeof image !== "string" || !image.startsWith("data:image/png;base64,")) {
        console.warn("emote:send BAD_IMAGE");
        return cb({ ok: false, error: "BAD_IMAGE" });
      }
      if (image.length > 250_000) {
        console.warn("emote:send IMAGE_TOO_LARGE", image.length);
        return cb({ ok: false, error: "IMAGE_TOO_LARGE" });
      }

      if (!room.emoteCooldownByName) room.emoteCooldownByName = new Map();
      const displayName = player?.name ?? "Host";
      const key = displayName.toLowerCase();

      const now = Date.now();
      const last = room.emoteCooldownByName.get(key) || 0;
      const COOLDOWN_MS = 5000;
      if (now - last < COOLDOWN_MS) {
        const wait = Math.ceil((COOLDOWN_MS - (now - last)) / 1000);
        console.warn("emote:send COOLDOWN", { name: displayName, wait });
        return cb({ ok: false, error: "COOLDOWN", wait });
      }
      room.emoteCooldownByName.set(key, now);

      const payload = {
        id: `${now}-${socket.id}`,
        name: displayName,
        image,
        at: now,
      };

      io.to(room.code).emit("emote:new", payload);
      console.log("emote:send -> emote:new", { room: room.code, from: displayName, size: image.length });
      cb({ ok: true });
    } catch (err) {
      console.error("emote:send error", err);
      cb({ ok: false, error: "SERVER_ERROR" });
    }
  });

  /** Disconnect handling */
  socket.on("disconnect", () => {
    const code = socket.data.code;
    if (!code) return;

    const room = rooms.get(code);
    if (!room) return;

    if (socket.id === room.hostId) {
      stopAllAndClose(room);
    } else {
      const leaving = room.players.get(socket.id);
      if (leaving) {
        room.reclaimByName.set(leaving.name.toLowerCase(), {
          name: leaving.name,
          score: leaving.score || 0,
        });
      }

      const wasFirst = socket.id === room.firstPlayerId;
      room.players.delete(socket.id);
      if (wasFirst) {
        room.firstPlayerId = room.players.size ? roomPlayersArray(room)[0].id : null;
      }

      if (room.stage === "question" && room.q) {
        const { answered, total } = progressCounts(room);
        if (answered >= total) {
          clearInterval(room.timers.tick);
          reveal(room);
        }
      }

      emitRoomUpdate(code);
    }
  });
});

/**/
/** ------------------ start server ------------------ */
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log(`Serving media from /media (dir: ${MEDIA_DIR})`);
});
