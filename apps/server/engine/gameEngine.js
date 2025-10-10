import crypto from "node:crypto";
import { generateQuestion } from "./questionEngine.js"; // adjust path as needed



export function registerGameEngine(io, mediaDir) {
  const rooms = new Map();

  const AUDIO_FILE = "track1.mp3"; // change if you use a different file


/** ------------------ helpers ------------------ */
function newCode() {
  return crypto.randomBytes(2).toString("hex").toUpperCase(); // e.g., A9F2
}
function uniqueName(room, base) {
  const lower = base.toLowerCase();
  const existing = new Set(Array.from(room.players.values()).map(p => p.name.toLowerCase()));
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
    config: room.config, // <= expose settings to clients
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
  // count how many CONNECTED players' names are in answersByName
  const connected = new Set(Array.from(room.players.values()).map(p => p.name.toLowerCase()));
  let answered = 0;
  for (const key of room.answersByName.keys()) {
    if (connected.has(key)) answered++;
  }
  return { answered, total: room.players.size };
}

/** ------------------ round engine ------------------ */

/*
function startQuestion(room) {
  clearTimers(room);
  if (room.qCount >= room.config.maxQuestions) return gameEnd(room);

  const q = nextFromPool(room);
  if (!q) return gameEnd(room);

  room.stage = "question";
  room.q = q;
  room.answersByName = new Map();
  room.perOptionCounts = Array(q.options.length).fill(0);

  //  Config wins, regardless of per-question duration
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

*/

async function startQuestion(room) {
  clearTimers(room);
  if (room.qCount >= room.config.maxQuestions) return gameEnd(room);

  // Pick a track to generate a question for
  // For now, you can pick a demo track; later, you could select from a playlist
  const track = {
    id: "track1",
    title: "One More Time",
    artist: "Daft Punk",
    previewUrl: `/media/track1.mp3`
  };

  // Generate a question using Gemini
  let q;
  try {
    q = await generateQuestion(track); // <-- Gemini call
  } catch (err) {
    console.error("Question generation failed, falling back to demo:", err);
    // fallback to demo
    q = nextFromPool(room);
  }

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
  if (Date.now() >= room.deadline) return; // time's up

  const player = room.players.get(socketId);
  if (!player) return;
  const key = player.name.toLowerCase();

  // Prevent double-answers across disconnects
  if (room.answersByName.has(key)) return;

  const choice = Number(answerIndex);
  room.answersByName.set(key, choice);
  if (Number.isInteger(choice) && choice >= 0 && choice < room.perOptionCounts.length) {
    room.perOptionCounts[choice]++;
  }

  // live progress
  const { answered, total } = progressCounts(room);
  io.to(room.code).emit("progress:update", { answered, total });

  // Early reveal if everyone answered
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
  // Award to currently connected players who answered correctly
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

/** Allow skipping timers by host or first player (not during question) */
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

/** Reset scores & start again */
function playAgain(room) {
  clearTimers(room);

  // reset all scores
  for (const p of room.players.values()) p.score = 0;

  // reset round pointers
  room._poolIdx = -1;
  room.qCount = 0;

  // push fresh scores so Hub shows 0s before the next question starts
  emitRoomUpdate(room.code);

  // start a new game
  startQuestion(room);
}

/** Back to lobby */
function toLobby(room) {
  clearTimers(room);

  room.stage = "lobby";

  // reset scores
  for (const p of room.players.values()) p.score = 0;

  // fully clear round state
  room.q = null;
  room.answersByName = new Map(); // if you use answersByName
  room.answers = new Map();       // if you still have answers by socket id anywhere
  room.perOptionCounts = [];
  room.deadline = null;
  room.revealUntil = null;
  room.resultUntil = null;
  room._poolIdx = -1;
  room.qCount = 0;

  // new game = new whitelist + empty reclaim list
  room.whitelistNames = null;
  room.reclaimByName = new Map();

  // update clients with zeroed scores, then flip UI back to lobby
  emitRoomUpdate(room.code);
  io.to(room.code).emit("game:lobby");
}



/** ------------------ socket logic ------------------ */
io.on("connection", (socket) => {
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
        whitelistNames: null, // set at game start
        config: {
          maxQuestions: demoPool().length,   // default: play each once
          defaultDurationMs: 20000           // 20s fallback if question has no durationMs
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

      const desired = (name?.trim() || "Player");
      const key = desired.toLowerCase();

      const joiningDuringGame = room.stage !== "lobby";
      const connectedNames = new Set(
        Array.from(room.players.values()).map(p => p.name.toLowerCase())
      );

      let finalName = desired;
      let startScore = 0;
      let isReclaim = false;

      if (joiningDuringGame) {
        // hard lock: only names captured at game start may rejoin, and only if we
        // have a saved claim (i.e., they actually disconnected previously)
        if (!room.whitelistNames?.has(key)) {
          return cb?.({ ok: false, error: "ROOM_LOCKED" });
        }
        if (room.reclaimByName.has(key) && !connectedNames.has(key)) {
          const saved = room.reclaimByName.get(key);
          finalName = saved.name;            // preserve original casing
          startScore = saved.score || 0;
          isReclaim = true;
          room.reclaimByName.delete(key);
        } else {
          return cb?.({ ok: false, error: "ROOM_LOCKED" });
        }
      } else {
        // Lobby: normal join (or reclaim if they just disconnected in lobby)
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

      if (!room.firstPlayerId) room.firstPlayerId = socket.id; // first joiner gets control

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
      const room = rooms.get(code || socket.data.code);
      if (!room) return cb?.({ ok: false, error: "NO_SUCH_ROOM" });
      if (!(socket.id === room.hostId || socket.id === room.firstPlayerId)) {
        return cb?.({ ok: false, error: "NOT_ALLOWED" });
      }
      if (room.stage !== "lobby") return cb?.({ ok: false, error: "ALREADY_STARTED" });

      // freeze whitelist of names at game start
      room.whitelistNames = new Set(
        Array.from(room.players.values()).map(p => p.name.toLowerCase())
      );

      // reset round counters
      room._poolIdx = -1;
      room.qCount = 0;

      startQuestion(room);
      cb?.({ ok: true, questionId: room.q?.id });
    } catch (err) {
      console.error("game:startGame error", err);
      cb?.({ ok: false, error: "SERVER_ERROR" });
    }
  });

  /** Backwards compat: startRound actually starts the game */
  socket.on("game:startRound", ({ code }, cb) => {
    try {
      const room = rooms.get(code || socket.data.code);
      if (!room) return cb?.({ ok: false, error: "NO_SUCH_ROOM" });

      const allowed = socket.id === room.hostId || socket.id === room.firstPlayerId;
      if (!allowed) return cb?.({ ok: false, error: "NOT_ALLOWED" });
      if (room.stage !== "lobby") return cb?.({ ok: false, error: "ALREADY_STARTED" });

      // freeze whitelist at start (compat path)
      room.whitelistNames = new Set(
        Array.from(room.players.values()).map(p => p.name.toLowerCase())
      );

      // reset round counters
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
      const room = rooms.get(code || socket.data.code);
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
      const room = rooms.get(code || socket.data.code);
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
      const room = rooms.get(code || socket.data.code);
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
      const room = rooms.get(code || socket.data.code);
      if (!room) return cb?.({ ok: false, error: "NO_SUCH_ROOM" });
      if (!canControl(socket, room)) return cb?.({ ok: false, error: "NOT_ALLOWED" });
      // reset counters before starting a new question
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
      const room = rooms.get(code || socket.data.code);
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
      const code = payload?.code || socket.data?.code;
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

  /** Disconnect handling */
  socket.on("disconnect", () => {
    const code = socket.data.code;
    if (!code) return;

    const room = rooms.get(code);
    if (!room) return;

    if (socket.id === room.hostId) {
      // Host left: close the room
      stopAllAndClose(room);
    } else {
      // Save for reclaim (only matters after start; harmless in lobby)
      const leaving = room.players.get(socket.id);
      if (leaving) {
        room.reclaimByName.set(
          leaving.name.toLowerCase(),
          { name: leaving.name, score: leaving.score || 0 }
        );
      }

      // Remove player
      const wasFirst = socket.id === room.firstPlayerId;
      room.players.delete(socket.id);

      // Re-assign firstPlayerId if needed
      if (wasFirst) {
        room.firstPlayerId = room.players.size
          ? roomPlayersArray(room)[0].id
          : null;
      }

      // If in-question and everyone remaining answered → reveal now
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

}