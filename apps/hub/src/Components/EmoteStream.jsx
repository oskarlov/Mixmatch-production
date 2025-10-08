import { useEffect, useRef, useState } from "react";
import s from "../socket.js";

// Float timing
const DUR_MIN = 5500;
const DUR_MAX = 9000;
// Cap how many we keep in memory
const MAX_ITEMS = 24;

export default function EmoteStream() {
  const [items, setItems] = useState([]);
  const idSet = useRef(new Set());

  useEffect(() => {
    const onConnect = () => {
      console.debug("[Hub EmoteStream] connected", s.id);
    };
    const onNew = (payload) => {
      if (!payload?.id || idSet.current.has(payload.id)) return;
      idSet.current.add(payload.id);

      // Randomized layout per emote
      const size = randInt(56, 112);          // px
      const left = Math.random() * 80 + 10;   // 10%..90%
      const drift = (Math.random() - 0.5) * 20; // ±px sideways
      const dur = randInt(DUR_MIN, DUR_MAX);  // ms

      const item = { ...payload, size, left, drift, dur, born: Date.now() };

      console.debug("[Hub] emote:new", item.id, "by", item.name);

      setItems((prev) => {
        const next = [...prev, item];
        return next.length > MAX_ITEMS ? next.slice(next.length - MAX_ITEMS) : next;
      });

      // Remove after animation finishes
      setTimeout(() => {
        setItems((prev) => prev.filter((x) => x.id !== payload.id));
        idSet.current.delete(payload.id);
      }, dur + 200);
    };

    if (!s.connected) s.connect();
    s.on("connect", onConnect);
    s.on("emote:new", onNew);
    return () => {
      s.off("connect", onConnect);
      s.off("emote:new", onNew);
    };
  }, []);

  return (
    <>
      <style>{`
        @keyframes emote-rise {
          0%   { transform: translate(-50%, 20vh) scale(0.95); opacity: 0; }
          10%  { opacity: 1; }
          100% { transform: translate(-50%, -20vh) scale(1); opacity: 0; }
        }
      `}</style>

      {/* High z-index so emotes float above spotlight/curtains */}
      <div className="pointer-events-none fixed inset-0 z-[9999]">
        {items.map((it) => (
          <Emote key={it.id} item={it} />
        ))}
      </div>
    </>
  );
}

function Emote({ item }) {
  return (
    <div
      className="absolute will-change-transform"
      style={{
        left: `${item.left}%`,
        bottom: `-8vh`,
        transform: "translateX(-50%)",
        animation: `emote-rise ${item.dur}ms linear forwards`,
      }}
    >
      <div
        className="rounded-2xl bg-ink-900/80 ring-1 ring-white/10 p-1 shadow-xl"
        style={{ transform: `translateX(${item.drift}px)` }}
      >
        <img
          src={item.image}
          alt={`${item.name}'s emote`}
          style={{ width: item.size + "px", height: item.size + "px" }}
          className="block rounded-xl"
        />
      </div>
      <div className="mt-1 text-center text-sm text-mist-200 drop-shadow">{item.name}</div>
    </div>
  );
}

function randInt(a, b) {
  return Math.floor(Math.random() * (b - a + 1)) + a;
}
