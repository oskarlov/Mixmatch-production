import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:8080");

export default function App() {
  const [stage, setStage] = useState("join"); // join | question | locked | result
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [question, setQuestion] = useState(null);
  const [remaining, setRemaining] = useState(0);
  const lockedIndex = useRef(null);

  useEffect(() => {
    socket.on("question:new", (q) => {
      setQuestion(q);
      setStage("question");
      lockedIndex.current = null;
      setRemaining(Math.round(q.durationMs / 1000));
    });
    socket.on("question:tick", (s) => setRemaining(s.seconds));   // optional if you emit ticks
    socket.on("question:reveal", ({ correctIndex }) => {
      setStage("result");
      setQuestion((q) => q ? { ...q, correctIndex } : q);
    });
    socket.on("room:closed", () => {
      setStage("join"); setQuestion(null); setCode(""); setName("");
    });
    return () => socket.removeAllListeners();
  }, []);

  function join() {
    socket.emit("player:joinRoom", { code, name }, (res) => {
      if (!res?.ok) return alert(res.error || "Join failed");
      setStage("waiting");
    });
  }

  function answer(i) {
    if (!question) return;
    lockedIndex.current = i;
    setStage("locked");
    socket.emit("answer:submit", { code, questionId: question.id, answerIndex: i }, () => {});
  }

  const opts = question?.options ?? [];

  if (stage === "join" || stage === "waiting") {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-950 text-slate-100 p-6">
        <div className="w-full max-w-sm bg-slate-900 p-5 rounded-2xl grid gap-3">
          <h1 className="text-2xl font-bold">Join a game</h1>
          <input className="px-3 py-2 rounded-lg bg-slate-800"
                 placeholder="Room code" value={code}
                 onChange={e=>setCode(e.target.value.toUpperCase())}/>
          <input className="px-3 py-2 rounded-lg bg-slate-800"
                 placeholder="Your name" value={name}
                 onChange={e=>setName(e.target.value)}/>
          <button onClick={join} className="px-4 py-2 rounded-xl bg-emerald-600">
            {stage === "waiting" ? "Waiting…" : "Join"}
          </button>
        </div>
      </div>
    );
  }

  if (stage === "question" || stage === "locked" || stage === "result") {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
        <div className="max-w-md mx-auto grid gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">{question?.prompt}</h2>
            <div className="text-sm opacity-80">{remaining > 0 ? `${remaining}s` : ""}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {opts.map((opt, i) => {
              const isLocked = stage !== "question";
              const isMine = lockedIndex.current === i;
              const isCorrect = stage === "result" && question?.correctIndex === i;
              return (
                <button key={i}
                  onClick={() => !isLocked && answer(i)}
                  className={[
                    "px-4 py-6 rounded-2xl bg-slate-900 transition",
                    isMine ? "ring-2 ring-amber-400" : "",
                    isCorrect ? "bg-emerald-700" : "",
                    isLocked && !isMine ? "opacity-60" : ""
                  ].join(" ")}>
                  {opt}
                </button>
              );
            })}
          </div>
          {stage === "locked" && <div className="text-sm opacity-80">Answer locked!</div>}
          {stage === "result" && <div className="text-sm">Answer revealed.</div>}
        </div>
      </div>
    );
  }

  return null;
}
