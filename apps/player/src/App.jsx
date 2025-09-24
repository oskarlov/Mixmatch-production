import { useState } from "react";
// If published under a workspace name:
//import { makeGameStore } from "@mixmatch/shared/gameStore";
// Or use a relative import temporarily:
import { makeGameStore } from "../../../packages/shared/gameStore.js";

const useGame = makeGameStore(import.meta.env.VITE_SERVER_URL);

export default function Player() {
  const { code, stage, question, seconds, joinRoom, submitAnswer } = useGame();
  const [room, setRoom] = useState("");
  const [name, setName] = useState("");

  // Join screen
  if (!code) {
    return (
      <div className="min-h-dvh bg-slate-950 text-slate-100 grid place-items-center p-6">
        <form
          onSubmit={(e) => { e.preventDefault(); joinRoom(room.trim().toUpperCase(), name.trim() || "Player"); }}
          className="w-full max-w-sm space-y-3"
        >
          <h1 className="text-xl font-semibold">Join game</h1>
          <input
            className="w-full rounded-lg bg-slate-900 px-3 py-2 outline-none"
            placeholder="ROOM CODE"
            value={room}
            onChange={(e) => setRoom(e.target.value.toUpperCase())}
          />
          <input
            className="w-full rounded-lg bg-slate-900 px-3 py-2 outline-none"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-2">
            Join
          </button>
        </form>
      </div>
    );
  }

  // In-game
  const opts = question?.options ?? [];
  const canAnswer = stage === "question";

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100 p-6">
      <div className="max-w-xl mx-auto space-y-4">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Player</h1>
          <span className="text-sm text-slate-400">
            Stage: <b className="text-slate-200">{stage}</b>
            {seconds ? <span> • {seconds}s</span> : null}
          </span>
        </header>

        <div className="rounded-xl bg-slate-900 p-4 space-y-3">
          <div className="text-sm text-slate-400">Question</div>
          <div className="text-lg">{question?.prompt ?? "—"}</div>

          <div className="grid grid-cols-2 gap-3">
            {opts.map((opt, i) => (
              <button
                key={i}
                onClick={() => submitAnswer(i)}
                disabled={!canAnswer}
                className={[
                  "rounded-lg px-3 py-3 text-left bg-slate-800 hover:bg-slate-700 disabled:opacity-40",
                ].join(" ")}
              >
                {String.fromCharCode(65 + i)}. {opt}
              </button>
            ))}
            {opts.length === 0 && <div className="text-slate-500">Waiting for the host…</div>}
          </div>

          {stage === "result" && (question?.correctIndex != null) && (
            <div className="rounded-lg bg-emerald-900/30 px-3 py-2">
              Correct answer: <b>{String.fromCharCode(65 + question.correctIndex)}. {opts[question.correctIndex]}</b>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
