import { BrowserRouter, Routes, Route } from "react-router-dom"; // Gjorde om App.jsx till en router
import SpotifyCallback from "./SpotifyCallback"; // Hantera redirectToAuth problem
import { useEffect, useRef, useState, useCallback } from "react";
import {redirectToAuth, requestToken, hasSpotifyToken} from "../../server/engine/spotifyAuth.js";
// If you published the shared package with this name (recommended):
// import { makeGameStore } from "@mixmatch/shared/gameStore";
// Temporary relative import:
import { useGameStore } from "./store";
import LobbySettings from "./components/LobbySettings";

const useGame = useGameStore;

function Hub() {
  const {
    code, players, hostId, stage, question, seconds, media,
    progress = { answered: 0, total: 0 },
    perOptionCounts = [],
    leaderboard = [],
    createRoom, startRound, reveal, nextQuestion,
    startGame, playAgain, toLobby,
  } = useGame();

  // ---- hub audio (host-only media) ----
  const audioRef = useRef(null);
  const [autoplayReady, setAutoplayReady] = useState(false);

  // Try to autoplay when media changes (most browsers require one user gesture first)
  useEffect(() => {
    if (!media?.audioUrl || !audioRef.current) return;
    const el = audioRef.current;
    el.src = media.audioUrl;
    const tryPlay = async () => {
      try { await el.play(); } catch {  }
    };
    tryPlay();
  }, [media]);

  // Förflyttad till SpotifyCallback.jsx
  /* 
  useEffect(() => {
    (async () => {
      try {
        const data = await requestToken(); // no-op if there's no ?code=
        // If we started an action before redirect, finish it now
        const pending = localStorage.getItem("pending_action");
        if (data && pending === "createRoom") {
          localStorage.removeItem("pending_action");
          createRoom();
        }
      } catch (e) {
        console.error("Spotify token exchange failed:", e);
      }
    })();
  }, [createRoom]);
  */
  const onCreate = useCallback(() => {
    console.log("[onCreate] hasSpotifyToken?", hasSpotifyToken());
    if (!hasSpotifyToken()) {
      localStorage.setItem("pending_action", "createRoom");
      redirectToAuth();            // navigates away; nothing after this runs now
      return;
    }
    createRoom();                  // already connected → just create
  }, [createRoom]);

  // ---- stage router ----
  if (stage === "idle") return <Landing onCreate={onCreate} />;

  if (stage === "lobby") {
    const canStart = !!code && players.length >= 1; // tweak min players if you want
    return (
      <Shell headerRight={<StageBadge stage={stage} />}>
        <RoomHeader code={code} />
        <div className="mt-6">
          <LobbySettings />
        </div>

        <Card title="Players">
          <PlayerGrid players={players} hostId={hostId} />
          {players.length === 0 && <EmptyNote>No players yet…</EmptyNote>}
        </Card>

        <div className="flex gap-2">
         {/*
          <PrimaryButton onClick={redirectToAuth}>
            Connect to Spotify
          </PrimaryButton>
        */}
          <PrimaryButton onClick={startGame} disabled={!canStart}>
            Start game
          </PrimaryButton>
        </div>
      </Shell>
    );
  }

  if (stage === "question") {
    return (
      <Shell headerRight={<StageBadge stage={stage} seconds={seconds} />}>
        <RoomHeader code={code} />
        <AudioBlock
          audioRef={audioRef}
          autoplayReady={autoplayReady}
          setAutoplayReady={setAutoplayReady}
        />
        <QuestionBlock question={question} showOptionsDimmed />
        <Card>
          <div className="text-sm text-slate-400">
            Answers: {progress.answered}/{progress.total}
          </div>
        </Card>
      </Shell>
    );
  }

  if (stage === "reveal") {
    return (
      <Shell headerRight={<StageBadge stage={stage} seconds={seconds} label="Reveal ends in" />}>
        <RoomHeader code={code} />
        <RevealBlock
          question={question}
          perOptionCounts={perOptionCounts}
        />
      </Shell>
    );
  }

  if (stage === "result") {
    return (
      <Shell headerRight={<StageBadge stage={stage} seconds={seconds} label="Next question in" />}>
        <RoomHeader code={code} />
        <LeaderboardBlock leaderboard={leaderboard} />
        {/* Manual next button (optional): server already auto-advances */}
        {typeof nextQuestion === "function" && (
          <div className="mt-4">
            <SecondaryButton onClick={nextQuestion}>Next now</SecondaryButton>
          </div>
        )}
      </Shell>
    );
  }
  if (stage === "gameover") {
  return (
    <Shell headerRight={<StageBadge stage={stage} />}>
      <RoomHeader code={code} />
      <LeaderboardBlock leaderboard={leaderboard} />
      <div className="flex gap-2">
        <PrimaryButton onClick={playAgain}>Play again</PrimaryButton>
        <SecondaryButton onClick={toLobby}>Back to lobby</SecondaryButton>
      </div>
    </Shell>
    );
  }

  // Fallback
  return (
    <Shell headerRight={<StageBadge stage={stage} seconds={seconds} />}>
      <RoomHeader code={code} />
      <Card>Unknown stage.</Card>
    </Shell>
  );
}

/* ================== UI Building Blocks ================== */

function Shell({ children, headerRight }) {
  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100 p-6">
      <div className="max-w-3xl mx-auto space-y-4">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Hub</h1>
          {headerRight}
        </header>
        {children}
      </div>
    </div>
  );
}

function Landing({ onCreate }) {
  return (
    <div className="min-h-dvh grid place-items-center bg-slate-950 text-slate-100 p-6">
      <PrimaryButton onClick={onCreate}>Create room</PrimaryButton>
    </div>
  );
}

function StageBadge({ stage, seconds, label = "Time left" }) {
  return (
    <span className="text-sm text-slate-400 inline-flex items-center gap-2">
      Stage: <b className="text-slate-200">{stage}</b>
      {Number.isFinite(seconds) && seconds > 0 && (
        <span className="px-2 py-1 rounded-full bg-slate-800">
          <span className="opacity-70 mr-1">{label}</span>
          <span className="font-mono">{seconds}s</span>
        </span>
      )}
    </span>
  );
}

function RoomHeader({ code }) {
  return (
    <div className="flex items-center gap-2">
      <Card>
        Room code:{" "}
        <b className="tracking-widest font-mono text-lg">{code || "—"}</b>
      </Card>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className="rounded-xl bg-slate-900 p-4">
      {title && <div className="text-sm text-slate-400 mb-2">{title}</div>}
      {children}
    </div>
  );
}

function EmptyNote({ children }) {
  return <div className="text-slate-500">{children}</div>;
}

function PrimaryButton({ children, ...props }) {
  return (
    <button
      {...props}
      className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, ...props }) {
  return (
    <button
      {...props}
      className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700"
    >
      {children}
    </button>
  );
}

/* ============ Hub-only audio block ============ */
function AudioBlock({ audioRef, autoplayReady, setAutoplayReady }) {
  return (
    <Card title="Hub audio">
      <audio ref={audioRef} controls className="w-full" />
      {!autoplayReady && (
        <div className="mt-2">
          <SecondaryButton
            onClick={() => {
              audioRef.current?.play();
              setAutoplayReady(true);
            }}
          >
            Enable audio autoplay
          </SecondaryButton>
        </div>
      )}
    </Card>
  );
}

/* ============ Question / Reveal / Leaderboard ============ */

function QuestionBlock({ question, showOptionsDimmed = false }) {
  return (
    <Card title="Question">
      <div className="text-lg mb-3">{question?.prompt ?? "—"}</div>
      <ol className={`grid grid-cols-2 gap-2 ${showOptionsDimmed ? "opacity-60" : ""}`}>
        {(question?.options ?? []).map((opt, i) => (
          <li key={i} className="rounded-lg px-3 py-2 bg-slate-800">
            {String.fromCharCode(65 + i)}. {opt}
          </li>
        ))}
      </ol>
    </Card>
  );
}

function RevealBlock({ question, perOptionCounts }) {
  const correct = question?.correctIndex;
  return (
    <Card title="Correct answer">
      <div className="text-lg mb-3">{question?.prompt ?? "—"}</div>
      <ol className="grid grid-cols-2 gap-2">
        {(question?.options ?? []).map((opt, i) => (
          <li
            key={i}
            className={[
              "rounded-lg px-3 py-2",
              i === correct ? "bg-emerald-700/40 outline outline-2 outline-emerald-500" : "bg-slate-800",
            ].join(" ")}
          >
            <div className="font-medium">
              {String.fromCharCode(65 + i)}. {opt}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {perOptionCounts?.[i] ?? 0} picks
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function LeaderboardBlock({ leaderboard }) {
  return (
    <Card title="Scores">
      <div className="rounded-xl bg-slate-800">
        {leaderboard.length === 0 && (
          <div className="p-4 text-slate-400">No scores yet…</div>
        )}
        {leaderboard.map((p, idx) => (
          <div
            key={p.id}
            className="flex items-center justify-between p-3 border-b border-slate-700 last:border-b-0"
          >
            <div className="flex items-center gap-3">
              <span className="w-6 text-right opacity-70">{idx + 1}.</span>
              <span className="font-semibold">{p.name}</span>
            </div>
            <span className="font-mono">{p.score}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ============ Player list ============ */

function PlayerGrid({ players, hostId }) {
  return (
    <ul className="grid sm:grid-cols-2 gap-2">
      {players.map((p) => (
        <li
          key={p.id}
          className="rounded-lg bg-slate-800 px-3 py-2 flex items-center justify-between"
        >
          <span>
            {p.name}
            {p.id === hostId ? " (host)" : ""}
          </span>
          <span className="text-slate-300">{p.score ?? 0}</span>
        </li>
      ))}
    </ul>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Hub />} />
        <Route path="/callback" element={<SpotifyCallback />} />
      </Routes>
    </BrowserRouter>
  );
}
