import { useEffect, useRef, useState } from "react";
// If you published the shared package with this name (recommended):
//import { makeGameStore } from "@mixmatch/shared/gameStore";
// If not, temporarily use a relative import (uncomment below):
import { makeGameStore } from "../../../packages/shared/gameStore.js";

const useGame = makeGameStore(import.meta.env.VITE_SERVER_URL);

export default function Hub() {
  const {
    code, players, hostId, stage, question, seconds, media,
    createRoom, startRound, reveal, nextRound
  } = useGame();

  const audioRef = useRef(null);
  const [autoplayReady, setAutoplayReady] = useState(false);

  // Try to autoplay when media changes (most browsers require one user gesture first)
  useEffect(() => {
    if (!media?.audioUrl || !audioRef.current) return;
    const el = audioRef.current;
    el.src = media.audioUrl;
    const tryPlay = async () => {
      try { await el.play(); }
      catch { /* blocked until user clicks */ }
    };
    tryPlay();
  }, [media]);

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100 p-6">
      <div className="max-w-3xl mx-auto space-y-4">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Hub</h1>
          <span className="text-sm text-slate-400">
            Stage: <b className="text-slate-200">{stage}</b>
            {seconds ? <span> • {seconds}s</span> : null}
          </span>
        </header>

        <div className="flex gap-2">
          {!code ? (
            <button
              onClick={createRoom}
              className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500"
            >
              Create room
            </button>
          ) : (
            <div className="px-3 py-2 rounded-lg bg-slate-800">
              Room code: <b className="tracking-widest">{code}</b>
            </div>
          )}

          <button
            onClick={() => startRound()}
            disabled={!code}
            className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40"
          >
            Start round
          </button>

          <button
            onClick={() => reveal()}
            disabled={!code}
            className="px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-40"
          >
            Reveal
          </button>

          <button
            onClick={() => nextRound?.(code)}
            disabled={!code}
            className="px-3 py-2 rounded-lg bg-sky-700 hover:bg-sky-600 disabled:opacity-40"
          >
            Next
          </button>
        </div>

        {/* Audio controls */}
        <div className="rounded-xl bg-slate-900 p-4 space-y-3">
          <div className="text-sm text-slate-400">Hub audio</div>
          <audio ref={audioRef} controls className="w-full" />
          {!autoplayReady && (
            <button
              onClick={() => { audioRef.current?.play(); setAutoplayReady(true); }}
              className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600"
            >
              Enable audio autoplay
            </button>
          )}
        </div>

        {/* Current question */}
        <div className="rounded-xl bg-slate-900 p-4 space-y-2">
          <div className="text-sm text-slate-400">Question</div>
          <div className="text-lg">{question?.prompt ?? "—"}</div>
          <ol className="grid grid-cols-2 gap-2">
            {(question?.options ?? []).map((opt, i) => (
              <li
                key={i}
                className={[
                  "rounded-lg px-3 py-2 bg-slate-800",
                  (stage === "result" && i === question?.correctIndex) ? "outline outline-2 outline-emerald-500" : ""
                ].join(" ")}
              >
                {String.fromCharCode(65 + i)}. {opt}
              </li>
            ))}
          </ol>
        </div>

        {/* Players */}
        <div className="rounded-xl bg-slate-900 p-4">
          <div className="text-sm text-slate-400 mb-2">Players</div>
          <ul className="grid sm:grid-cols-2 gap-2">
            {players.map(p => (
              <li key={p.id} className="rounded-lg bg-slate-800 px-3 py-2 flex items-center justify-between">
                <span>
                  {p.name}{p.id === hostId ? " (host)" : ""}
                </span>
                <span className="text-slate-300">{p.score}</span>
              </li>
            ))}
            {players.length === 0 && <li className="text-slate-500">No players yet…</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
