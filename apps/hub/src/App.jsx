import { useEffect, useRef, useState } from "react";
// If you published the shared package with this name (recommended):
// import { makeGameStore } from "@mixmatch/shared/gameStore";
// Temporary relative import:
import { useGameStore } from "./store";
import LobbySettings from "./components/LobbySettings";
import { SpotlightOverlay, CurtainOverlay, CurtainConductor} from "./components/theater";


const useGame = useGameStore;

export default function Hub() {
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
      try { await el.play(); } catch { /* blocked until click */ }
    };
    tryPlay();
  }, [media]);

  // ---- stage router ----
  if (stage === "idle") return <Landing onCreate={createRoom} />;

  if (stage === "lobby") {
    const canStart = !!code && players.length >= 1; // tweak min players if you want
    return (
      <Shell headerRight={<StageBadge stage={stage} />}>
        <RoomHeader code={code} />
        <SpotlightOverlay />
        {/* Two-column lobby: Players (left) | Settings (right) */}
        <div className="grid gap-4 items-start grid-cols-1 lg:grid-cols-3">
          <Card title={`Players (${players.length})`} className="lg:col-span-2">
            <PlayerGrid players={players} hostId={hostId} />
            {players.length === 0 && <EmptyNote>No players yet…</EmptyNote>}
          </Card>

          <Card title="Game settings">
            <div className="space-y-4">
              <LobbySettings />
              <PrimaryButton onClick={startGame} disabled={!canStart} aria-label="Start game" className="w-full lg:w-auto">Start game</PrimaryButton>
            </div>
          </Card>
        </div>
      </Shell>
    );
  }

  if (stage === "question") {
    return (
      <Shell headerRight={<StageBadge stage={stage} seconds={seconds} />}>
        <RoomHeader code={code} />
        <CurtainConductor stage={stage} seconds={seconds} questionId={question?.id} />
        {/* Desktop: 2 columns (audio | question). Mobile: stacked */}
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          <AudioBlock
            audioRef={audioRef}
            autoplayReady={autoplayReady}
            setAutoplayReady={setAutoplayReady}
          />
          <QuestionBlock question={question} showOptionsDimmed />
        </div>

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
        <CurtainConductor stage={stage} seconds={seconds} questionId={question?.id} />


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
        <CurtainConductor stage={stage} seconds={seconds} questionId={question?.id} />

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
        <div className="flex flex-wrap gap-2">
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
    <div className="min-h-dvh bg-slate-950 text-slate-100 font-sans px-4 sm:px-6 lg:px-10 py-6">
      <div className="mx-auto max-w-screen-lg xl:max-w-screen-xl space-y-4 relative overflow-hidden">
        <header className="flex items-center justify-between gap-4">
          <h1 className="font-display tracking-wide text-balance text-2xl md:text-3xl font-semibold">Hub</h1>
          <div className="shrink-0">{headerRight}</div>
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
      <span className="hidden sm:inline">Stage:</span>
      <b className="text-slate-200">{stage}</b>
      {Number.isFinite(seconds) && seconds > 0 && (
        <span className="px-2 py-1 rounded-full bg-slate-800">
          <span className="opacity-70 mr-1 hidden md:inline">{label}</span>
          <span className="font-mono tabular-nums">{seconds}s</span>
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
        <b className="tracking-widest font-mono text-lg md:text-xl">{code || "—"}</b>
      </Card>
    </div>
  );
}

function Card({ title, children, className = "" }) {
  return (
    <div className={["rounded-xl bg-slate-900/90 ring-1 ring-white/5 shadow-lg shadow-black/30 p-4", className].join(" ") }>
      {title && <div className="text-sm text-slate-400 mb-2">{title}</div>}
      {children}
    </div>
  );
}

function EmptyNote({ children }) {
  return <div className="text-slate-500">{children}</div>;
}

function PrimaryButton({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={[
        "px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40",
        "transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400",
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={[
        "px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700",
        "transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400",
        className,
      ].join(" ")}
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
      <div className="font-display text-lg md:text-xl mb-3 leading-snug text-balance">
        {question?.prompt ?? "—"}
      </div>
      <ol
        className={[
          "grid gap-2",
          "grid-cols-1 md:grid-cols-2",
          showOptionsDimmed ? "opacity-60" : "",
        ].join(" ")}
      >
        {(question?.options ?? []).map((opt, i) => (
          <li key={i} className="rounded-lg px-3 py-2 bg-slate-800 break-words">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-700 font-medium">
                {String.fromCharCode(65 + i)}
              </span>
              <span className="leading-snug">{opt}</span>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function RevealBlock({ question, perOptionCounts }) {
  const correct = question?.correctIndex;
  const total = (perOptionCounts ?? []).reduce((a, b) => a + (b || 0), 0);

  return (
    <Card title="Correct answer">
      <div className="font-display text-lg md:text-xl mb-3 leading-snug text-balance">
        {question?.prompt ?? "—"}
      </div>
      <ol className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {(question?.options ?? []).map((opt, i) => {
          const count = perOptionCounts?.[i] ?? 0;
          const pct = total ? Math.round((100 * count) / total) : 0;
          const isCorrect = i === correct;
          return (
            <li
              key={i}
              className={[
                "rounded-lg px-3 py-2",
                isCorrect
                  ? "bg-emerald-700/40 outline outline-2 outline-emerald-500"
                  : "bg-slate-800",
              ].join(" ")}
            >
              <div className="font-medium">
                {String.fromCharCode(65 + i)}. {opt}
              </div>
              <div className="mt-2 h-1.5 rounded bg-slate-700 overflow-hidden">
                <div
                  className={"h-full " + (isCorrect ? "bg-emerald-500" : "bg-slate-500")}
                  style={{ width: pct + "%" }}
                />
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {count} picks{total ? ` (${pct}%)` : ""}
              </div>
            </li>
          );
        })}
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
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-6 text-right opacity-70">{idx + 1}.</span>
              <span className="font-semibold truncate max-w-[18ch] md:max-w-none">{p.name}</span>
            </div>
            <span className="font-mono tabular-nums">{p.score}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ============ Player list ============ */

function PlayerGrid({ players, hostId }) {
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
      {players.map((p) => (
        <li
          key={p.id}
          className="rounded-lg bg-slate-800 px-3 py-2 flex items-center justify-between"
        >
          <span className="truncate max-w-[20ch] md:max-w-none">
            {p.name}
            {p.id === hostId ? " (host)" : ""}
          </span>
          <span className="text-slate-300 font-mono tabular-nums">{p.score ?? 0}</span>
        </li>
      ))}
    </ul>
  );
}
