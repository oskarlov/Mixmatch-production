import { useEffect, useRef, useState } from "react";
// If you published the shared package with this name (recommended):
// import { makeGameStore } from "@mixmatch/shared/gameStore";
// Temporary relative import:
import TheaterBackground from "./components/TheaterBackground";
import SpotlightOverlay from "./components/SpotlightOverlay";
import CurtainOverlay from "./components/CurtainOverlay"; // curtains overlay
import { useGameStore } from "./store";
import LobbySettings from "./components/LobbySettings";

const THEATRE_BG = "/images/theatre-lobby.png";
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

  useEffect(() => {
    if (!media?.audioUrl || !audioRef.current) return;
    const el = audioRef.current;
    el.src = media.audioUrl;
    const tryPlay = async () => {
      try { await el.play(); } catch {/* blocked until click */}
    };
    tryPlay();
  }, [media]);

  // ---- spotlight + curtains control ----
  const [spotlightActive, setSpotlightActive] = useState(false);
  const [spotlightEverSettled, setSpotlightEverSettled] = useState(false);
  const [questionVisible, setQuestionVisible] = useState(true);

  // Curtains: run BEFORE every question
  const [curtainKey, setCurtainKey] = useState(0);
  const [curtainRunning, setCurtainRunning] = useState(false);
  const [allowFlicker, setAllowFlicker] = useState(false);

  useEffect(() => {
    if (stage === "idle") {
      setSpotlightActive(false);
      setSpotlightEverSettled(false);
      setQuestionVisible(true);
      setAllowFlicker(false);
      setCurtainRunning(false);
      return;
    }

    if (stage === "lobby") {
      // Lobby: curtains visible at edges only (no animation)
      setSpotlightActive(false);
      setAllowFlicker(false);
      setQuestionVisible(true);
      setCurtainRunning(false);
      return;
    }

    if (stage === "question") {
      // Before each question: close→open, then spotlight flicker
      setSpotlightActive(true);
      setAllowFlicker(false);
      setSpotlightEverSettled(false);
      setQuestionVisible(false);
      setCurtainRunning(true);
      setCurtainKey((k) => k + 1); // trigger per-question cycle
      return;
    }

    if (stage === "reveal" || stage === "result" || stage === "gameover") {
      // Curtains stay open at edges; spotlight steady
      setSpotlightActive(true);
      setAllowFlicker(false);
      setQuestionVisible(true);
      return;
    }
  }, [stage, question?.id]);

  const isGameplay = stage === "question" || stage === "reveal" || stage === "result" || stage === "gameover";
  const isFlicker = stage === "question" && !spotlightEverSettled && allowFlicker;

  // ---- stage router ----
  if (stage === "idle") return <Landing onCreate={createRoom} />;

  // === LOBBY (1+1 grid, equal width, centered, big "Room Code") ===
  if (stage === "lobby") {
    const canStart = !!code && players.length >= 1;
    return (
      <TheaterBackground bgUrl={THEATRE_BG}>
        {/* Curtains visible at the edges; NO animation in lobby */}
        <CurtainOverlay cycleKey={-1} topOffsetPx={0} edgePx={72} />

        <Shell
          wide
          title={
            <span className="inline-flex items-baseline gap-2">
              <span className="uppercase text-xs tracking-widest text-mist-400">Room Code</span>
              <code className="font-mono tracking-widest text-3xl md:text-4xl">
                {code || "—"}
              </code>
            </span>
          }
          headerRight={<StageBadge stage={stage} />}
        >
          {/* Centered container, two equal columns on md+ */}
          <div className="mx-auto w-full max-w-[900px] grid gap-2 items-start grid-cols-1 md:grid-cols-2">
            <Card title={`Players (${players.length})`}>
              <PlayerGrid players={players} hostId={hostId} />
              {players.length === 0 && <EmptyNote>No players yet…</EmptyNote>}
            </Card>
            <Card title="Game settings">
              <div className="space-y-4 w-full">
                <LobbySettings />
                <PrimaryButton
                  onClick={startGame}
                  disabled={!canStart}
                  aria-label="Start game"
                  className="w-full text-lg px-5 py-3"
                >
                  Start game
                </PrimaryButton>
              </div>
            </Card>
          </div>
        </Shell>
      </TheaterBackground>
    );
  }

  if (stage === "question") {
    return (
      <TheaterBackground bgUrl={THEATRE_BG}>
        {/* Curtains: close → pause → open, then allow spotlight flicker */}
        <CurtainOverlay
          cycleKey={curtainKey}
          topOffsetPx={0}
          edgePx={72}
          onCycleStart={() => setCurtainRunning(true)}
          onCycleEnd={() => {
            setCurtainRunning(false);
            setQuestionVisible(true);
            setAllowFlicker(true);
          }}
        />

        <SpotlightOverlay
          active={spotlightActive}
          flicker={isFlicker}
          onSettled={() => {
            setQuestionVisible(true);
            setSpotlightEverSettled(true);
          }}
          holdOpacity={0.6}
          center={[0.5, 0.5]}
          duration={1.6}
          exitDuration={0.8}
        />

        {/* Keep header visible; hide ONLY the body during curtains/flicker */}
        <Shell
          title={
            <code className="font-mono tracking-widest text-xl md:text-2xl">
              {code || "—"}
            </code>
          }
          headerRight={<StageBadge stage={stage} seconds={seconds} />}
          bodyHidden={curtainRunning || isFlicker}
        >
          <StageCenter>
            {questionVisible ? (
              <>
                <QuestionBlock question={question} showOptionsDimmed />
                <AudioBlock
                  audioRef={audioRef}
                  autoplayReady={autoplayReady}
                  setAutoplayReady={setAutoplayReady}
                />
              </>
            ) : (
              <Card><div className="opacity-60">Preparing question…</div></Card>
            )}
            <Card>
              <div className="text-sm text-mist-300 text-center">
                Answers: {progress.answered}/{progress.total}
              </div>
            </Card>
          </StageCenter>
        </Shell>
      </TheaterBackground>
    );
  }

  if (stage === "reveal") {
    return (
      <TheaterBackground bgUrl={THEATRE_BG}>
        {/* Curtains open at edges; no animation */}
        <CurtainOverlay cycleKey={-1} topOffsetPx={0} edgePx={72} />
        <SpotlightOverlay
          active={spotlightActive}
          flicker={false}
          holdOpacity={0.6}
          center={[0.5, 0.5]}
          duration={1.6}
          exitDuration={0.8}
        />
        <Shell
          title={
            <code className="font-mono tracking-widest text-xl md:text-2xl">
              {code || "—"}
            </code>
          }
          headerRight={<StageBadge stage={stage} seconds={seconds} label="Reveal ends in" />}
        >
          <StageCenter>
            <RevealBlock question={question} perOptionCounts={perOptionCounts} />
          </StageCenter>
        </Shell>
      </TheaterBackground>
    );
  }

  if (stage === "result") {
    return (
      <TheaterBackground bgUrl={THEATRE_BG}>
        {/* Curtains open at edges; no animation */}
        <CurtainOverlay cycleKey={-1} topOffsetPx={0} edgePx={72} />
        <SpotlightOverlay
          active={spotlightActive}
          flicker={false}
          holdOpacity={0.6}
          center={[0.5, 0.5]}
          duration={1.6}
          exitDuration={0.8}
        />
        <Shell
          title={
            <code className="font-mono tracking-widest text-xl md:text-2xl">
              {code || "—"}
            </code>
          }
          headerRight={<StageBadge stage={stage} seconds={seconds} label="Next question in" />}
        >
          <StageCenter>
            {/* Compact leaderboard only on RESULT */}
            <LeaderboardBlock leaderboard={leaderboard} compact />
            {typeof nextQuestion === "function" && (
              <div className="mt-2">
                <SecondaryButton onClick={nextQuestion}>Next now</SecondaryButton>
              </div>
            )}
          </StageCenter>
        </Shell>
      </TheaterBackground>
    );
  }

  if (stage === "gameover") {
    return (
      <TheaterBackground bgUrl={THEATRE_BG}>
        {/* Curtains open at edges; no animation */}
        <CurtainOverlay cycleKey={-1} topOffsetPx={0} edgePx={72} />
        <SpotlightOverlay
          active={spotlightActive}
          flicker={false}
          holdOpacity={0.6}
          center={[0.5, 0.5]}
          duration={1.6}
          exitDuration={0.8}
        />
        <Shell
          title={
            <code className="font-mono tracking-widest text-xl md:text-2xl">
              {code || "—"}
            </code>
          }
          headerRight={<StageBadge stage={stage} />}
        >
          <StageCenter>
            <LeaderboardBlock leaderboard={leaderboard} />
            <div className="flex flex-wrap items-center justify-center gap-2">
              <PrimaryButton onClick={playAgain}>Play again</PrimaryButton>
              <SecondaryButton onClick={toLobby}>Back to lobby</SecondaryButton>
            </div>
          </StageCenter>
        </Shell>
      </TheaterBackground>
    );
  }

  // Fallback
  return (
    <TheaterBackground bgUrl={THEATRE_BG}>
      <CurtainOverlay cycleKey={-1} topOffsetPx={0} edgePx={72} />
      <SpotlightOverlay
        active={spotlightActive}
        flicker={false}
        holdOpacity={0.6}
        center={[0.5, 0.5]}
        duration={1.6}
        exitDuration={0.8}
      />
      <Shell
        title={isGameplay ? <code className="font-mono tracking-widest text-xl md:text-2xl">{code || "—"}</code> : <>Hub</>}
        headerRight={<StageBadge stage={stage} seconds={seconds} />}
      >
        <StageCenter>
          <Card>Unknown stage.</Card>
        </StageCenter>
      </Shell>
    </TheaterBackground>
  );
}

/* ================== UI Building Blocks ================== */

function Shell({ children, headerRight, wide = false, title = <>Hub</>, bodyHidden = false }) {
  return (
    <div className="relative z-10 min-h-dvh text-mist-100 font-sans px-4 sm:px-6 lg:px-8 py-6">
      {/* wide ? centered roomy layout (lobby) : spotlight-focused column */}
      <div
        className={
          (wide
            ? "mx-auto max-w-[920px]"   // centered lobby container
            : "mx-auto max-w-[900px]") +
          " space-y-4 relative overflow-hidden"
        }
      >
        <header className="flex items-center justify-between gap-4">
          <h1 className="tracking-wide text-balance text-2xl md:text-3xl font-semibold">
            {title}
          </h1>
          <div className="shrink-0">{headerRight}</div>
        </header>

        {/* Only the body gets hidden during curtains/flicker */}
        <div className={bodyHidden ? "opacity-0 pointer-events-none select-none" : ""}>
          {children}
        </div>
      </div>
    </div>
  );
}

/** Centers children in the middle of the screen with a max width (non-lobby stages) */
function StageCenter({ children }) {
  return (
    <div className="min-h-[70dvh] grid place-items-center">
      <div className="w-full max-w-[780px] mx-auto flex flex-col items-stretch gap-4">
        {children}
      </div>
    </div>
  );
}

function Landing({ onCreate }) {
  return (
    <div className="min-h-dvh grid place-items-center bg-ink-950 text-mist-100 p-6">
      <PrimaryButton onClick={onCreate}>Create room</PrimaryButton>
    </div>
  );
}

function StageBadge({ stage, seconds, label = "Time left" }) {
  return (
    <span className="text-sm text-mist-300 inline-flex items-center gap-2">
      <span className="hidden sm:inline">Stage:</span>
      <b className="text-mist-100">{stage}</b>
      {Number.isFinite(seconds) && seconds > 0 && (
        <span className="px-2 py-1 rounded-full bg-black/40 ring-1 ring-white/10">
          <span className="opacity-70 mr-1 hidden md:inline">{label}</span>
          <span className="font-mono tabular-nums">{seconds}s</span>
        </span>
      )}
    </span>
  );
}

function Card({ title, children, className = "" }) {
  return (
    <div className={className}>
      {title && (
        <div className="text-xs uppercase tracking-wide text-mist-400 mb-2">
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

function EmptyNote({ children }) {
  return <div className="text-mist-400">{children}</div>;
}

function PrimaryButton({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={[
        "px-3 py-2 rounded-lg",
        "bg-crimson-500 hover:bg-crimson-400 disabled:opacity-40",
        "text-mist-100",
        "transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400",
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
        "px-3 py-2 rounded-lg",
        "bg-ink-800/70 hover:bg-ink-700/70",
        "text-mist-100",
        "transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400",
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
        <div className="mt-2 flex justify-center">
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
      <div className="font-display text-lg md:text-xl mb-3 leading-snug text-balance text-center">
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
          <li key={i} className="rounded-lg px-3 py-2 bg-ink-800/70 break-words">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-ink-700 font-medium">
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
      <div className="font-display text-lg md:text-xl mb-3 leading-snug text-balance text-center">
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
                  ? "bg-emerald-700/40 outline outline-2 outline-emerald-500/70"
                  : "bg-ink-800/70",
              ].join(" ")}
            >
              <div className="font-medium">
                {String.fromCharCode(65 + i)}. {opt}
              </div>
              <div className="mt-2 h-1.5 rounded bg-ink-700/70 overflow-hidden">
                <div
                  className={"h-full " + (isCorrect ? "bg-emerald-500" : "bg-crimson-500")}
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
    </Card>
  );
}

function LeaderboardBlock({ leaderboard, compact = false }) {
  const wrap = compact
    ? "w-full max-w-[560px] mx-auto rounded-xl bg-ink-800/70"
    : "w-full rounded-xl bg-ink-800/70";

  return (
    <Card /* no title prop so we can control heading style */>
      {/* Big centered heading on RESULT (compact). Small label otherwise. */}
      <div
        className={
          compact
            ? "text-center font-display text-2xl md:text-3xl mb-3"
            : "text-xs uppercase tracking-wide text-mist-400 mb-2"
        }
      >
        Scores
      </div>

      <div className={wrap}>
        {leaderboard.length === 0 && (
          <div className="p-4 text-mist-400 text-center">No scores yet…</div>
        )}
        {leaderboard.map((p, idx) => (
          <div
            key={p.id}
            className={
              (compact ? "p-2" : "p-3") +
              " flex items-center justify-between border-b border-ink-700/60 last:border-b-0"
            }
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-6 text-right opacity-70">{idx + 1}.</span>
              <span
                className={
                  "font-semibold truncate " +
                  (compact ? "max-w-[12ch]" : "max-w-[18ch] md:max-w-none")
                }
                title={p.name}
              >
                {p.name}
              </span>
            </div>
            <span
              className={
                "inline-flex items-center justify-center rounded " +
                "bg-ink-700/70 font-mono tabular-nums " +
                (compact ? "text-sm min-w-[3.25rem] px-2 py-0.5" : "min-w-[3.75rem] px-3 py-1")
              }
              title={`${p.score}`}
            >
              {p.score}
            </span>
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
          className="rounded-lg bg-ink-800/80 px-3 py-2 flex items-center justify-between"
        >
          <span className="truncate max-w-[20ch] md:max-w-none">
            {p.name}
            {p.id === hostId ? " (host)" : ""}
          </span>
          <span className="text-mist-300 font-mono tabular-nums">{p.score ?? 0}</span>
        </li>
      ))}
    </ul>
  );
}
