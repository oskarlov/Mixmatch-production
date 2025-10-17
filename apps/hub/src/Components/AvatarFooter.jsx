import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  memo,
  forwardRef,
} from "react";

import Avatar from "./Avatar";
import { useGameStore } from "../store";

function hash(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

const AVATAR_SIZE = 88; // tweak 80–96
const NAME_VISIBLE_MIN_WIDTH = 640; // hide names on small screens

export default function AvatarFooter() {
  const { code, players = [], stage, answeredIds = [] } = useGameStore(s => ({
    code: s.code, players: s.players, stage: s.stage, answeredIds: s.answeredIds
  }));

  const items = useMemo(() => players.map(p => {
    const key = `${code}:${p.id || p.name}`;
    const h = hash(key);
    return {
      id: p.id, name: p.name,
      seed: `memphis-${h.toString(36)}`,
      tilt: (h % 15) - 7, // -7..+7°
    };
  }), [players, code]);

  const containerRef = useRef(null);
  const sampleRef = useRef(null);
  const [visibleCount, setVisibleCount] = useState(items.length);

  // Measure container width + sample item width -> how many fit
  useLayoutEffect(() => {
    const measure = () => {
      const cw = containerRef.current?.clientWidth ?? 0;
      const iw = sampleRef.current?.offsetWidth ?? (AVATAR_SIZE + 24); // fallback
      if (!cw || !iw) return;
      // keep a little gutter (16px), reserve space for "+N" chip if needed
      const fits = Math.max(1, Math.floor((cw - 16) / iw));
      setVisibleCount(fits);
    };
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    measure();
    return () => ro.disconnect();
  }, [items.length]);

  // Decide how many to show; reserve 1 slot for "+N" when needed
  const needCounter = items.length > visibleCount;
  const slotsForAvatars = Math.max(1, visibleCount - (needCounter ? 1 : 0));
  const shown = items.slice(0, slotsForAvatars);
  const hiddenCount = items.length - shown.length;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40">
      <div ref={containerRef} className="mx-auto max-w-screen-2xl px-4 pb-3">
        <div className="flex items-center gap-3 overflow-hidden rounded-2xl bg-black/45 backdrop-blur px-3 py-2 ring-1 ring-white/10">
          {/* invisible sample for measuring exact item width (includes name on wide screens) */}
          <div className="absolute -top-[9999px] -left-[9999px]" aria-hidden>
            <RailItem
              ref={sampleRef}
              item={{ id: "x", name: "Sample", seed: "sample", tilt: 0 }}
              stage={stage}
              answeredIds={answeredIds}
              showName={window.innerWidth >= NAME_VISIBLE_MIN_WIDTH}
            />
          </div>

          {/* real items */}
          {shown.map(it => (
            <RailItem
              key={it.id}
              item={it}
              stage={stage}
              answeredIds={answeredIds}
              showName={typeof window !== "undefined" ? window.innerWidth >= NAME_VISIBLE_MIN_WIDTH : true}
            />
          ))}

          {/* "+N" counter if some are hidden */}
          {needCounter && (
            <div className="shrink-0 px-3 py-2 rounded-full bg-white/10 text-mist-100 text-sm font-semibold">
              +{hiddenCount}
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes appear { from { opacity:0; transform: translateY(8px); } to { opacity:1; transform: translateY(0); } }
        .animate-appear { animation: appear .25s ease-out; }
      `}</style>
    </div>
  );
}

const RailItem = React.forwardRef(function RailItem(
  { item, stage, answeredIds, showName },
  ref
) {
  const hasAnswered = answeredIds.includes(item.id);
  const faded = stage === "question" && !hasAnswered;
  return (
    <div
      ref={ref}
      className="flex items-center gap-3 shrink-0 animate-appear"
      style={{ transform: `rotate(${item.tilt}deg)` }}
    >
      <Avatar
        seed={item.seed}
        size={AVATAR_SIZE}
        title={item.name}
        className={(hasAnswered ? "ring-emerald-400/60" : "ring-white/30") + " ring-4"}
        style={{ opacity: faded ? 0.45 : 1 }}
      />
      {/* hide names on small screens to fit more avatars */}
      {showName && (
        <span className="text-mist-100/90 text-base font-semibold select-none">
          {item.name}
        </span>
      )}
    </div>
  );
});
