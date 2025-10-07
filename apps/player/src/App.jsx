import { useEffect, useMemo, useRef, useState } from "react";
import { makeGameStore } from "../../../packages/shared/gameStore.js";

const useGame = makeGameStore(import.meta.env.VITE_SERVER_URL);

// Delay before showing the question on *every* question stage.
// Match this to the Hub’s visible animation (curtain + flicker) settle time.
const QUESTION_WAIT_MS = 1600;

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
  const computedFirst = firstPlayerId || (players?.length ? players[0]?.id : null);
  const isFirst = selfId && computedFirst && selfId === computedFirst;

  /* ---------- Question visibility gate (no-flash + per-question wait) ---------- */
  const prevStageRef = useRef(stage);
  const gateRef = useRef(false);         // true => hide question synchronously
  const gateTimerRef = useRef(null);
  const [, forceTick] = useState(0);

  const questionKey = useMemo(
    () => (question?.id != null ? `q:${question.id}` : `stage:${stage}`),
    [question?.id, stage]
  );

  // Detect fresh entry into question stage
  const justEnteredQuestion =
    stage === "question" && prevStageRef.current !== "question";

  // Synchronous guard to prevent 1-frame flash on *every* question
  if (justEnteredQuestion) {
    gateRef.current = true;
  }

  useEffect(() => {
    clearTimeout(gateTimerRef.current);

    if (stage === "question") {
      // Wait for hub animation every time
      gateTimerRef.current = setTimeout(() => {
        gateRef.current = false;
        forceTick((n) => n + 1); // reveal
      }, QUESTION_WAIT_MS);
    } else {
      // Non-question stages: no gate
      gateRef.current = false;
    }

    prevStageRef.current = stage;
    return () => clearTimeout(gateTimerRef.current);
  }, [stage, questionKey]);

  // Track picked answer locally
  const [picked, setPicked] = useState(null);
  useEffect(() => {
    if (stage !== "question") setPicked(null);
  }, [stage, questionKey]);

  /* ========================= Renders ========================= */

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
      <Screen>
        <Card className="w-full max-w-sm mx-auto">
          <h1 className="text-2xl font-semibold mb-3 font-display">Join game</h1>
          <form onSubmit={onSubmit} className="space-y-3">
            <Input
              placeholder="ROOM CODE"
              value={room}
              onChange={(e) => setRoom(e.target.value.toUpperCase())}
            />
            <Input
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {joinError && (
              <div className="text-sm text-crimson-400/90">
                {friendlyJoinError(joinError)}
              </div>
            )}
            <PrimaryButton disabled={joining || !room.trim()} className="w-full">
              {joining ? "Joining…" : "Join"}
            </PrimaryButton>
          </form>
        </Card>
      </Screen>
    );
  }

  // --- Lobby ---
  if (stage === "lobby") {
    return (
      <Screen>
        <Header
          title={
            <span className="inline-flex items-baseline gap-2">
              <span className="uppercase text-xs tracking-widest text-mist-300">Room</span>
              <code className="font-mono tracking-widest text-2xl">{code}</code>
            </span>
          }
          right={<StageBadge stage={stage} />}
        />
        <div className="grid gap-3 mt-3">
          <Card title={`Players (${players.length})`}>
            <PlayerList players={players} hostId={computedFirst} />
            {players.length === 0 && <Muted>No players yet…</Muted>}
          </Card>
          {isFirst ? (
            <PrimaryButton onClick={startGame} className="w-full py-3 text-lg">
              Start game
            </PrimaryButton>
          ) : (
            <Muted className="text-center">Waiting for the first player…</Muted>
          )}
        </div>
      </Screen>
    );
  }

  // --- Game over ---
  if (stage === "gameover") {
    return (
      <Screen>
        <Header
          title={<code className="font-mono tracking-widest text-xl">{code}</code>}
          right={<StageBadge stage={stage} />}
        />
        <Card title="Scores">
          <Leaderboard leaderboardHint="Final" />
        </Card>
        <div className="flex gap-2">
          {isFirst ? (
            <>
              <PrimaryButton onClick={playAgain} className="flex-1">Play again</PrimaryButton>
              <SecondaryButton onClick={toLobby} className="flex-1">Back to lobby</SecondaryButton>
            </>
          ) : (
            <Muted className="text-center w-full">Waiting for next steps…</Muted>
          )}
        </div>
      </Screen>
    );
  }

  // --- In-game (question / reveal / result) ---
  const opts = question?.options ?? [];
  const canAnswer = stage === "question";
  const showContinue = isFirst && (stage === "reveal" || stage === "result");

  let main = null;

  if (stage === "question") {
    const hide = gateRef.current;

    if (hide) {
      main = (
        <Card title="Question">
          <div className="text-sm text-mist-300 text-center">Preparing question…</div>
        </Card>
      );
    } else {
      main = (
        <Card title="Question">
          <div className="font-display text-lg leading-snug text-center text-balance mb-3">
            {question?.prompt ?? "—"}
          </div>

          {/* Options grid — phone-first (1 col), becomes 2 cols on wider screens */}
          <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
            {opts.map((opt, i) => {
              const disabled = !canAnswer || picked != null;
              const pickedThis = picked === i;
              return (
                <button
                  key={i}
                  onClick={() => {
                    if (disabled) return;
                    setPicked(i);
                    submitAnswer(i);
                  }}
                  disabled={disabled}
                  className={[
                    "rounded-lg px-3 py-3 text-left",
                    "bg-ink-800/80 hover:bg-ink-700/80 disabled:opacity-50",
                    pickedThis ? "outline outline-2 outline-gold-400" : "",
                  ].join(" ")}
                >
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-ink-700 font-medium">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="leading-snug break-words">{opt}</span>
                  </div>
                </button>
              );
            })}
            {opts.length === 0 && <Muted>Waiting for the host…</Muted>}
          </div>
        </Card>
      );
    }
  } else if (stage === "reveal" && question?.correctIndex != null) {
    // Only the correct answer during reveal
    main = (
      <Card title="Correct answer">
        <RevealBars question={question} />
      </Card>
    );
  } else if (stage === "result") {
    // Only scores during result
    main = (
      <Card title="Scores">
        <Leaderboard />
      </Card>
    );
  }

  return (
    <Screen>
      <Header
        title={<code className="font-mono tracking-widest text-xl">{code}</code>}
        right={<StageBadge stage={stage} seconds={seconds} />}
      />

      {main}

      {/* Continue control for first player */}
      {showContinue && (
        <PrimaryButton onClick={advance} className="w-full mt-2">Continue</PrimaryButton>
      )}
    </Screen>
  );
}

/* ==================== UI bits (ink/mist/gold/crimson) ==================== */

function Screen({ children }) {
  return (
    <div className="min-h-dvh bg-ink-950 text-mist-100 px-4 sm:px-6 py-5 font-sans">
      <div className="mx-auto w-full max-w-[780px] grid gap-3">{children}</div>
    </div>
  );
}

function Header({ title, right }) {
  return (
    <header className="flex items-center justify-between gap-3">
      <h1 className="text-2xl md:text-3xl font-semibold">{title}</h1>
      <div className="shrink-0">{right}</div>
    </header>
  );
}

function StageBadge({ stage, seconds }) {
  return (
    <span className="text-sm text-mist-300 inline-flex items-center gap-2">
      <span className="hidden sm:inline">Stage:</span>
      <b className="text-mist-100">{stage}</b>
      {Number.isFinite(seconds) && seconds > 0 && (
        <span className="px-2 py-1 rounded-full bg-black/40 ring-1 ring-white/10">
          <span className="font-mono tabular-nums">{seconds}s</span>
        </span>
      )}
    </span>
  );
}

function Card({ title, children, className = "" }) {
  return (
    <section className={["rounded-xl bg-ink-900/70 p-4", className].join(" ")}>
      {title && (
        <div className="text-xs uppercase tracking-wide text-mist-400 mb-2">{title}</div>
      )}
      {children}
    </section>
  );
}

function Input(props) {
  return (
    <input
      {...props}
      className="w-full rounded-lg bg-ink-800/80 px-3 py-2 placeholder:text-mist-300/70"
    />
  );
}

function PrimaryButton({ className = "", ...props }) {
  return (
    <button
      {...props}
      className={[
        "px-3 py-2 rounded-lg",
        "bg-crimson-500 hover:bg-crimson-400 disabled:opacity-40",
        "text-mist-100 transition-colors",
        className,
      ].join(" ")}
    />
  );
}

function SecondaryButton({ className = "", ...props }) {
  return (
    <button
      {...props}
      className={[
        "px-3 py-2 rounded-lg",
        "bg-ink-800/70 hover:bg-ink-700/70",
        "text-mist-100 transition-colors",
        className,
      ].join(" ")}
    />
  );
}

function Muted({ children, className = "" }) {
  return <div className={["text-mist-400", className].join(" ")}>{children}</div>;
}

function PlayerList({ players, hostId }) {
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {players.map((p) => (
        <li
          key={p.id}
          className="rounded-lg bg-ink-800/80 px-3 py-2 flex items-center justify-between"
        >
          <span className="truncate max-w-[18ch]" title={p.name}>
            {p.name}{p.id === hostId ? " (first)" : ""}
          </span>
          <span className="text-mist-300 font-mono tabular-nums">{p.score ?? 0}</span>
        </li>
      ))}
    </ul>
  );
}

function RevealBars({ question }) {
  const correct = question?.correctIndex;
  const counts = question?.perOptionCounts ?? []; // optional; if missing, bars will be zero
  const total = counts.reduce((a, b) => a + (b || 0), 0);

  return (
    <ol className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {(question?.options ?? []).map((opt, i) => {
        const count = counts[i] ?? 0;
        const pct = total ? Math.round((100 * count) / total) : 0;
        const isCorrect = i === correct;
        return (
          <li
            key={i}
            className={[
              "rounded-lg px-3 py-2",
              isCorrect
                ? "bg-emerald-700/40 outline outline-2 outline-emerald-500/70"
                : "bg-ink-800/70",
            ].join(" ")}
          >
            <div className="font-medium">
              {String.fromCharCode(65 + i)}. {opt}
            </div>
            <div className="mt-2 h-1.5 rounded bg-ink-700/70 overflow-hidden">
              <div
                className={["h-full", isCorrect ? "bg-emerald-500" : "bg-crimson-500"].join(" ")}
                style={{ width: pct + "%" }}
              />
            </div>
            <div className="text-xs text-mist-400 mt-1">
              {count} picks{total ? ` (${pct}%)` : ""}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Leaderboard({ leaderboardHint = "" }) {
  const { players = [] } = useGame();
  const sorted = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));
  return (
    <div className="w-full rounded-xl bg-ink-800/70">
      {sorted.length === 0 && (
        <div className="p-4 text-mist-400 text-center">No scores yet…</div>
      )}
      {sorted.map((p, idx) => (
        <div
          key={p.id}
          className="p-3 flex items-center justify-between border-b border-ink-700/60 last:border-b-0"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-6 text-right opacity-70">{idx + 1}.</span>
            <span className="font-semibold truncate max-w-[18ch]" title={p.name}>
              {p.name}
            </span>
          </div>
          <span
            className="inline-flex items-center justify-center rounded bg-ink-700/70 font-mono tabular-nums min-w-[3.75rem] px-3 py-1"
            title={`${p.score ?? 0}`}
          >
            {p.score ?? 0}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ==================== Helpers ==================== */

function friendlyJoinError(code) {
  switch (code) {
    case "ROOM_LOCKED": return "The game already started. Try again for the next round.";
    case "NO_SUCH_ROOM": return "No room with that code. Double-check it.";
    case "SERVER_ERROR": return "Server error. Please try again.";
    default: return "Couldn’t join. Please try again.";
  }
}
