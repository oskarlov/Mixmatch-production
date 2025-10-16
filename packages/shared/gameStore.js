import { create } from "zustand";
import { getSocket } from "./socket.js";

export const makeGameStore = (serverUrl) => {
  const s = getSocket(serverUrl);

  return create((set, get) => {
    // ---------- state ----------
    const init = {
      code: "",
      players: [],
      hostId: "",
      firstPlayerId: null,     // first player can Start/Continue
      selfId: s.connected ? s.id : null, // set immediately if already connected
      stage: "idle",           // idle | lobby | question | reveal | result | gameover | locked (player-only)
      question: null,          // { id, prompt, options[], correctIndex? }
      seconds: 0,
      deadline: null,
      revealUntil: null,
      resultUntil: null,
      progress: { answered: 0, total: 0 },
      perOptionCounts: [],
      leaderboard: [],
      media: null,             // { audioUrl } (hub-only)
      joinError: null,         // e.g., ROOM_LOCKED, NO_SUCH_ROOM

      // -------- Simple Game Settings (from server) --------
      config: { maxQuestions: 10, defaultDurationMs: 20000, selectedPlaylistIDs: [] },
    };

    const secondsFrom = (ts, fallback = 0) =>
      ts ? Math.max(0, Math.ceil((ts - Date.now()) / 1000)) : fallback;

    // ---------- socket events ----------
    s.on("connect", () => set({ selfId: s.id }));

    s.on("room:update", ({ code, players, hostId, firstPlayerId, config }) =>
      set((st) => ({
        code,
        players,
        hostId,
        firstPlayerId: firstPlayerId ?? st.firstPlayerId,
        config: config || st.config || init.config, // keep server as source of truth
        // only set lobby when we were idle; otherwise keep gameplay stage
        stage: code ? (st.stage === "idle" ? "lobby" : st.stage) : "idle",
      }))
    );

    s.on("room:closed", () =>
      set({ ...init, selfId: s.connected ? s.id : null })
    );

    // when server sends "we're back in lobby"
    s.on("game:lobby", () => {
      set({
        stage: "lobby",
        question: null,
        seconds: 0,
        revealUntil: null,
        resultUntil: null,
        perOptionCounts: [],
        leaderboard: [],
      });
    });

    s.on("question:new", (q) => {
      const seconds = Math.round((q.durationMs || 0) / 1000);
      set({
        stage: "question",
        question: q,
        seconds,
        deadline: q.deadline ?? (q.durationMs ? Date.now() + q.durationMs : null),
        revealUntil: null,
        resultUntil: null,
        perOptionCounts: [],
        leaderboard: [],
        progress: { answered: 0, total: get().players.length || 0 },
      });
    });

    s.on("question:next", (q) => {
      const seconds = Math.round((q.durationMs || 0) / 1000);
      set({
        stage: "question",
        question: q,
        seconds,
        deadline: q.deadline ?? (q.durationMs ? Date.now() + q.durationMs : null),
        revealUntil: null,
        resultUntil: null,
        perOptionCounts: [],
        leaderboard: [],
        progress: { answered: 0, total: get().players.length || 0 },
      });
    });

    s.on("question:tick", ({ seconds }) => set({ seconds }));
    s.on("progress:update", ({ answered, total }) =>
      set({ progress: { answered, total } })
    );
    s.on("question:hubMedia", (media) => set({ media }));

    s.on("question:reveal", ({ correctIndex, perOptionCounts = [], revealUntil }) =>
      set((st) => ({
        stage: "reveal",
        question: st.question ? { ...st.question, correctIndex } : st.question,
        perOptionCounts,
        revealUntil: revealUntil ?? null,
        seconds: secondsFrom(revealUntil, st.seconds),
      }))
    );

    s.on("question:result", ({ leaderboard = [], resultUntil }) =>
      set((st) => ({
        stage: "result",
        leaderboard,
        resultUntil: resultUntil ?? null,
        seconds: secondsFrom(resultUntil, st.seconds),
      }))
    );

    s.on("game:end", ({ leaderboard = [] }) =>
      set({ stage: "gameover", leaderboard })
    );

    // ---------- actions ----------
    return {
      ...init,

      // HOST: create a room
      createRoom: () => s.emit("host:createRoom"),

      // PLAYER: join (no auto-rejoin, no storage; always manual)
      joinRoom: (code, name, cb) => {
        const c = (code || "").trim().toUpperCase();
        const n = (name || "").trim() || "Player";
        if (!c) return;

        s.emit("player:joinRoom", { code: c, name: n }, (res) => {
          if (!res?.ok) {
            set({ joinError: res?.error || "JOIN_FAILED" });
          } else {
            set({
              joinError: null,
              // Show lobby right away; room:update will hydrate players/host/firstPlayerId/config
              code: c,
              stage: "lobby",
            });
          }
          cb?.(res);
        });
      },

      // host OR first player can start the game
      startGame: () => s.emit("game:startGame", { code: get().code }),
      // backward-compat alias
      startRound: () => s.emit("game:startGame", { code: get().code }),

      // skip timers in reveal/result
      advance: () => s.emit("game:advance", { code: get().code }),

      // game over controls
      playAgain: () => s.emit("game:playAgain", { code: get().code }),
      toLobby: () =>
        s.emit("game:toLobby", { code: get().code }, (res) => {
          if (res?.ok) {
            // Optimistic flip
            set({
              stage: "lobby",
              question: null,
              seconds: 0,
              revealUntil: null,
              resultUntil: null,
              perOptionCounts: [],
              leaderboard: [],
            });
          }
        }),

      // optional manual reveal trigger (host)
      reveal: () => s.emit("game:reveal", { code: get().code }),

      // PLAYER: submit an answer (locks locally)
      submitAnswer: (answerIndex) => {
        const q = get().question;
        if (!q) return;
        s.emit("answer:submit", {
          code: get().code,
          questionId: q.id,
          answerIndex,
        });
        set({ stage: "locked" });
      },

      // -------- Simple Game Settings (host-only) --------
      updateConfig: (partial, cb) => {
        const { code } = get();
        s.emit("game:updateConfig", { code, ...partial }, (res) => {
          if (res?.ok && res.config) set({ config: res.config });
          cb?.(res);
        });
      },
    };
  });
};
