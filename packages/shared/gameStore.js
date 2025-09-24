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
      stage: "idle",         // idle | lobby | question | locked | result
      question: null,        // { id, prompt, options[], correctIndex? }
      seconds: 0,            // countdown
      media: null            // { audioUrl } (hub-only)
    };

    // ---------- socket events ----------
    s.on("room:update", ({ code, players, hostId }) =>
      set({ code, players, hostId, stage: code ? "lobby" : "idle" })
    );
    s.on("room:closed", () => set({ ...init }));

    s.on("question:new", (q) => set({ stage: "question", question: q, seconds: Math.round((q.durationMs||0)/1000) }));
    s.on("question:tick", ({ seconds }) => set({ seconds }));
    s.on("question:reveal", ({ correctIndex }) =>
      set((st) => ({ stage: "result", question: st.question ? { ...st.question, correctIndex } : st.question }))
    );
    s.on("question:hubMedia", (media) => set({ media }));

    // ---------- actions ----------
    return {
      ...init,
      createRoom: () => s.emit("host:createRoom"),
      joinRoom: (code, name) => s.emit("player:joinRoom", { code, name }),
      startRound: () => s.emit("game:startRound", { code: get().code }),
      reveal: () => s.emit("game:reveal", { code: get().code }),
      submitAnswer: (answerIndex) => {
        const q = get().question; if (!q) return;
        s.emit("answer:submit", { code: get().code, questionId: q.id, answerIndex });
        set({ stage: "locked" });
      }
    };
  });
};
