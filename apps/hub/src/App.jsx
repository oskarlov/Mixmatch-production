import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
const socket = io("http://localhost:8080");

export default function App() {
  const [code, setCode] = useState("");
  const [players, setPlayers] = useState([]);
  const [hostId, setHostId] = useState("");
  const created = useRef(false);

  // NEW: media + audio ref
  const [media, setMedia] = useState(null);
  const audioRef = useRef(null);

  useEffect(() => {
    socket.on("room:update", ({ code, players, hostId }) => {
      setCode(code); setPlayers(players); setHostId(hostId);
    });
    socket.on("room:toast", (t) => console.log(t));
    socket.on("room:closed", () => { setPlayers([]); setCode(""); setHostId(""); setMedia(null); });

    // Public question (both hub & players get this)
    socket.on("question:new", (q) => {
      console.log("question:new", q);
      // stop any previous audio
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    });

    // NEW: hub-only media (audio url)
    socket.on("question:hubMedia", (m) => {
      setMedia(m);
      // try autoplay; some browsers require a user gesture first
      setTimeout(() => audioRef.current?.play().catch(() => {}), 50);
    });

    // Stop audio on reveal
    socket.on("question:reveal", () => {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    });

    return () => socket.removeAllListeners();
  }, []);

  function createRoom() {
    if (created.current) return;
    socket.emit("host:createRoom", null, (res) => {
      if (!res?.ok) return alert("Failed to create room");
      created.current = true;
    });
  }

  function startRound() {
    socket.emit("game:startRound", { code }, (res) => {
      if (!res?.ok) alert(res.error || "Failed to start");
    });
  }

  function reveal() {
    socket.emit("game:reveal", { code }, (res) => {
      if (!res?.ok) alert(res.error || "Reveal failed");
    });
  }

  function nextRound() {
    socket.emit("game:startRound", { code }, (res) => {
      if (!res?.ok) alert(res.error || "Next failed");
    });
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <div className="max-w-3xl mx-auto">
        <header className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">MixMatch Hub</h1>
          <button onClick={createRoom} className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700">
            Create room
          </button>
        </header>

        <section className="mt-6 grid gap-4">
          <div className="p-4 bg-slate-900 rounded-2xl">
            <div className="text-sm opacity-70">Room code</div>
            <div className="text-5xl font-extrabold tracking-widest">{code || "— — — —"}</div>
          </div>

          {/* NEW: Media & transport */}
          <div className="p-4 bg-slate-900 rounded-2xl grid gap-3">
            <div className="text-sm opacity-70">Now playing (hub-only)</div>
            <audio ref={audioRef} src={media?.audioUrl || ""} controls className="w-full" />
            <div className="flex gap-3">
              <button onClick={() => audioRef.current?.play()} className="px-3 py-2 rounded-lg bg-slate-800">Play</button>
              <button onClick={() => audioRef.current?.pause()} className="px-3 py-2 rounded-lg bg-slate-800">Pause</button>
              <button onClick={() => { if (audioRef.current){ audioRef.current.currentTime=0; audioRef.current.play().catch(()=>{}); }}} className="px-3 py-2 rounded-lg bg-slate-800">Restart</button>
            </div>
            <p className="text-xs opacity-70">If autoplay is blocked, press <em>Play</em> once to unlock audio.</p>
          </div>

          <div className="p-4 bg-slate-900 rounded-2xl">
            <div className="text-sm opacity-70 mb-2">Players</div>
            <ul className="grid gap-2">
              {players.map((p) => (
                <li key={p.id} className="flex items-center justify-between bg-slate-800 rounded-xl px-3 py-2">
                  <span>{p.name}</span>
                  <span className="text-sm opacity-80">Score: {p.score}</span>
                </li>
              ))}
              {players.length === 0 && <li className="opacity-60">Waiting for players…</li>}
            </ul>
          </div>

          <div className="flex gap-3">
            <button onClick={startRound} disabled={!code} className="px-4 py-2 rounded-xl bg-emerald-600 disabled:bg-slate-700">
              Start round
            </button>
            <button onClick={reveal} disabled={!code} className="px-4 py-2 rounded-xl bg-slate-800">Reveal</button>
            <button onClick={nextRound} disabled={!code} className="px-4 py-2 rounded-xl bg-slate-800">Next</button>
          </div>

          <div className="opacity-70 text-sm">Host socket: {hostId || "—"}</div>
        </section>
      </div>
    </div>
  );
}
