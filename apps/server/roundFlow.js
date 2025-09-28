// apps/server/roundFlow.js
export function createRoundEngine(io) {
  const rooms = new Map(); // code -> room

  const makeRoom = (hostSocket) => {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const room = {
      code,
      hostId: hostSocket.id,
      stage: "lobby",
      players: new Map(), // socketId -> { id, name, disconnected: false, score: 0 }
      currentQuestion: null,
      deadline: null,
      answers: new Map(), // playerId -> answerIndex
      perOptionCounts: [],
      timers: { tick: null, reveal: null, result: null },
    };
    rooms.set(code, room);
    hostSocket.join(code);
    emitRoomUpdate(room);
    return room;
  };

  const emitRoomUpdate = (room) => {
    const players = [...room.players.values()].map(p => ({
      id: p.id, name: p.name, disconnected: !!p.disconnected, score: p.score || 0
    }));
    io.to(room.code).emit("room:update", { code: room.code, players, hostId: room.hostId });
  };

  const joinRoom = (socket, { code, name }) => {
    const room = rooms.get(code);
    if (!room) return;
    room.players.set(socket.id, { id: socket.id, name: name?.trim() || "Player", score: 0, disconnected: false });
    socket.join(code);
    emitRoomUpdate(room);
  };

  const createRoom = (socket) => {
    const room = makeRoom(socket);
    // mark host as player too (optional)
    room.players.set(socket.id, { id: socket.id, name: "Host", score: 0, disconnected: false });
    emitRoomUpdate(room);
  };

  const startRound = ({ code }) => {
    const room = rooms.get(code);
    if (!room) return;
    startQuestion(room);
  };

  const startQuestion = (room) => {
    clearTimers(room);
    const q = pickNextQuestion(room);
    if (!q) return endGame(room);

    room.stage = "question";
    room.currentQuestion = q;
    room.answers.clear();
    room.perOptionCounts = Array(q.options.length).fill(0);
    room.deadline = Date.now() + (q.durationMs || 20000);

    io.to(room.code).emit("question:new", {
      id: q.id, prompt: q.prompt, options: q.options,
      durationMs: q.durationMs || 20000,
      deadline: room.deadline,
      media: q.media || null,
    });

    // optional server tick (clients can also compute from deadline)
    room.timers.tick = setInterval(() => {
      const seconds = Math.max(0, Math.ceil((room.deadline - Date.now()) / 1000));
      io.to(room.code).emit("question:tick", { seconds });
      if (seconds <= 0) { clearInterval(room.timers.tick); reveal(room); }
    }, 1000);
  };

  const submitAnswer = ({ code, socketId, answerIndex }) => {
    const room = rooms.get(code);
    if (!room || room.stage !== "question") return;
    if (room.answers.has(socketId)) return; // idempotent
    room.answers.set(socketId, answerIndex);
    room.perOptionCounts[answerIndex]++;

    const total = activePlayers(room).length;
    io.to(room.code).emit("progress:update", { answered: room.answers.size, total });

    if (room.answers.size >= total) {
      clearInterval(room.timers.tick);
      reveal(room);
    }
  };

  const reveal = (room) => {
    if (room.stage !== "question") return;
    room.stage = "reveal";
    const revealUntil = Date.now() + 15000;
    io.to(room.code).emit("question:reveal", {
      correctIndex: room.currentQuestion.correctIndex,
      perOptionCounts: room.perOptionCounts,
      revealUntil
    });
    room.timers.reveal = setTimeout(() => result(room), 15000);
  };

  const result = (room) => {
    room.stage = "result";
    applyScores(room);
    const leaderboard = getLeaderboard(room);
    const resultUntil = Date.now() + 8000;
    io.to(room.code).emit("question:result", { leaderboard, resultUntil });
    room.timers.result = setTimeout(() => next(room), 8000);
  };

  const next = (room) => startQuestion(room);

  const endGame = (room) => {
    io.to(room.code).emit("room:closed");
    clearTimers(room);
    rooms.delete(room.code);
  };

  const markDisconnected = (socket) => {
    const code = [...socket.rooms].find(r => rooms.has(r));
    if (!code) return;
    const room = rooms.get(code);
    const p = room.players.get(socket.id);
    if (p) p.disconnected = true;
    emitRoomUpdate(room);
  };

  // utils
  const clearTimers = (room) => {
    Object.values(room.timers).forEach(t => t && clearTimeout(t));
    room.timers = { tick: null, reveal: null, result: null };
  };

  const activePlayers = (room) =>
    [...room.players.values()].filter(p => !p.disconnected);

  // super-simple question picker (replace with your real generator)
  const pickNextQuestion = (room) => {
    // Example dummy set:
    const pool = [
      { id: "q1", prompt: "Guess the song", options: ["A", "B", "C", "D"], correctIndex: 2, durationMs: 20000,
        media: { audioUrl: "/media/track1.mp3" } },
      { id: "q2", prompt: "Which album?",  options: ["X", "Y", "Z", "W"], correctIndex: 1, durationMs: 20000 }
    ];
    // naive rotate through pool
    const used = room._usedIdx ?? -1;
    const nextIdx = (used + 1) % pool.length;
    room._usedIdx = nextIdx;
    return pool[nextIdx];
  };

  const applyScores = (room) => {
    for (const [pid, ans] of room.answers.entries()) {
      const p = room.players.get(pid);
      if (!p) continue;
      if (ans === room.currentQuestion.correctIndex) p.score = (p.score || 0) + 100;
    }
  };

  const getLeaderboard = (room) =>
    [...room.players.values()]
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .map(p => ({ id: p.id, name: p.name, score: p.score || 0 }));

  return {
    createRoom,
    joinRoom,
    startRound,
    submitAnswer,
    markDisconnected,
  };
}
