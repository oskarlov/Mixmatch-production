import { useState } from "react";
import { makeGameStore } from "../../../packages/shared/gameStore.js";

const useGame = makeGameStore(import.meta.env.VITE_SERVER_URL);

export default function Player() {
  const {
    code, stage, question, seconds, players,
    joinRoom, submitAnswer, joinError,
    selfId, firstPlayerId,
    startGame, advance, playAgain, toLobby
  } = useGame();

  const [room, setRoom] = useState("");
  const [name, setName] = useState("");
  const [joining, setJoining] = useState(false);

  // Fallback: if firstPlayerId not set yet, treat the first listed player as first
  const computedFirst =
    firstPlayerId ||
    (players?.length ? players[0]?.id : null);

  const isFirst = selfId && computedFirst && selfId === computedFirst;

  // --- Join screen ---
  if (!code) {
    const onSubmit = (e) => {
      e.preventDefault();
      const c = room.trim().toUpperCase();
      const n = (name || "").trim() || "Player";
      if (!c) return;
      setJoining(true);
      joinRoom(c, n, () => setJoining(false));
    };

    return (
      <div className="min-h-dvh bg-slate-950 text-slate-100 grid place-items-center p-6">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-3">
          <h1 className="text-xl font-semibold">Join game</h1>
          <input className="w-full rounded-lg bg-slate-900 px-3 py-2" placeholder="ROOM CODE"
                 value={room} onChange={(e) => setRoom(e.target.value.toUpperCase())}/>
          <input className="w-full rounded-lg bg-slate-900 px-3 py-2" placeholder="Your name"
                 value={name} onChange={(e) => setName(e.target.value)} />
          {joinError && <div className="text-sm text-red-400">{friendlyJoinError(joinError)}</div>}
          <button disabled={joining || !room.trim()} className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-2">
            {joining ? "Joining…" : "Join"}
          </button>
        </form>
      </div>
    );
  }

  // --- Lobby ---
  if (stage === "lobby") {
    return (
      <div className="min-h-dvh bg-slate-950 text-slate-100 grid place-items-center p-6">
        <div className="w-full max-w-sm space-y-4 text-center">
          <h1 className="text-xl font-semibold">Waiting in lobby</h1>
          <div className="text-slate-400">Room <b className="font-mono">{code}</b></div>
          {isFirst ? (
            <button onClick={startGame} className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-2">
              Start game
            </button>
          ) : (
            <div className="text-slate-500">Waiting for the first player…</div>
          )}
        </div>
      </div>
    );
  }

  // --- Game over ---
  if (stage === "gameover") {
    return (
      <div className="min-h-dvh bg-slate-950 text-slate-100 grid place-items-center p-6">
        <div className="w-full max-w-sm space-y-4 text-center">
          <h1 className="text-xl font-semibold">Game Over</h1>
          {isFirst ? (
            <div className="flex gap-2">
              <button onClick={playAgain} className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-2">
                Play again
              </button>
              <button onClick={toLobby} className="flex-1 rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-2">
                Back to lobby
              </button>
            </div>
          ) : (
            <div className="text-slate-500">Waiting for next steps…</div>
          )}
        </div>
      </div>
    );
  }

  // --- In-game ---
  const opts = question?.options ?? [];
  const canAnswer = stage === "question";
  const showContinue = isFirst && (stage === "reveal" || stage === "result");

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
                className="rounded-lg px-3 py-3 text-left bg-slate-800 hover:bg-slate-700 disabled:opacity-40"
              >
                {String.fromCharCode(65 + i)}. {opt}
              </button>
            ))}
            {opts.length === 0 && <div className="text-slate-500">Waiting for the host…</div>}
          </div>

          {stage === "result" && question?.correctIndex != null && (
            <div className="rounded-lg bg-emerald-900/30 px-3 py-2">
              Correct answer:{" "}
              <b>{String.fromCharCode(65 + question.correctIndex)}. {opts[question.correctIndex]}</b>
            </div>
          )}

          {showContinue && (
            <div className="pt-2">
              <button onClick={advance} className="w-full rounded-lg bg-sky-600 hover:bg-sky-500 px-3 py-2">
                Continue
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function friendlyJoinError(code) {
  switch (code) {
    case "ROOM_LOCKED": return "The game already started. Try again for the next round.";
    case "NO_SUCH_ROOM": return "No room with that code. Double-check it.";
    case "SERVER_ERROR": return "Server error. Please try again.";
    default: return "Couldn’t join. Please try again.";
  }
}
