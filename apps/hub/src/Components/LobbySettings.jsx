import { useMemo, useState } from "react";
import { useGameStore } from "../store";

// Use your working path or alias here:
import dictPlaylistID from "../../../../packages/shared/tempPlayListIDs.js";

/** ----- Genres (explicit allow-list; K-pop, Christmas, LOL omitted) ----- */
const GENRE_LABELS = {
  plRock: "Rock",
  plClassicRock: "Classic Rock",
  plHipHop: "Hip-Hop",
  plPop: "Pop",
  plFunkandSoul: "Funk & Soul",
  plClassicJazz: "Classic Jazz",
  plJazz: "Jazz",
  plHeavyMetal: "Heavy Metal",
  plCountry: "Country",
};
const GENRE_KEYS = Object.keys(GENRE_LABELS);

/** ----- Decades in shared list ----- */
const DECADE_KEYS = ["pl60s", "pl70s", "pl80s", "pl90s", "pl00s", "pl10s"];

/** Build lists from the shared dictionary */
function buildGenres() {
  const rows = GENRE_KEYS
    .map((key) => ({ key, id: dictPlaylistID[key], label: GENRE_LABELS[key] }))
    .filter((r) => !!r.id);

  // Deduplicate by playlist ID (in case two keys share one ID)
  const byId = new Map();
  for (const r of rows) if (!byId.has(r.id)) byId.set(r.id, r);
  return Array.from(byId.values());
}

function buildDecades() {
  return DECADE_KEYS
    .map((key) => {
      const id = dictPlaylistID[key];
      if (!id) return null;
      return { key, id, label: key.replace(/^pl/, "") };
    })
    .filter(Boolean);
}

export default function LobbySettings() {
  const { stage, hostId, config, updateConfig } = useGameStore((s) => ({
    stage: s.stage,
    hostId: s.hostId,
    config: s.config,
    updateConfig: s.updateConfig,
  }));
  if (stage !== "lobby") return null;

  const isHost = true; // hub acts as host
  const disabled = !isHost;

  // Data sources
  const genres = useMemo(buildGenres, []);
  const decades = useMemo(buildDecades, []);

  // Existing settings
  const [maxQuestions, setMaxQuestions] = useState(config.maxQuestions);

  // UI uses seconds; server stores ms → convert on read/write
  const [durationSec, setDurationSec] = useState(
    Math.round((config.defaultDurationMs ?? 20000) / 1000)
  );

  // Default: none selected. If config already has saved picks, hydrate from it.
  const inConfig = Array.isArray(config?.selectedPlaylistIDs) ? config.selectedPlaylistIDs : [];

  const [selGenres, setSelGenres] = useState(
    inConfig.filter((id) => genres.some((g) => g.id === id))
  );
  const [selDecades, setSelDecades] = useState(
    inConfig.filter((id) => decades.some((d) => d.id === id))
  );

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const toggle = (id, setter) =>
    setter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const selectAll = (list, setter) => setter(list.map((r) => r.id));
  const clearAll = (setter) => setter([]);

  const onSave = () => {
    setSaving(true);
    setMsg("");

    // Merge + de-dupe (Genres + Decades only)
    const combined = Array.from(new Set([...selGenres, ...selDecades]));

    // Clamp seconds in UI (5–120) then convert to ms for server
    const sec = Math.max(5, Math.min(120, Number(durationSec) || 20));
    const durationMs = sec * 1000;

    updateConfig(
      {
        maxQuestions: Number(maxQuestions),
        durationMs,
        selectedPlaylistIDs: combined,
      },
      (res) => {
        setSaving(false);
        setMsg(res?.ok ? "Saved ✓" : `Error: ${res?.error || "unknown"}`);
      }
    );
  };

  return (
    <div className="w-full max-w-md space-y-5">
      <div>
        {/* Compact row: two inputs side-by-side, perfectly aligned */}
<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
  <label className="block">
    {/* Reserve equal label height so wrapping doesn't shift inputs */}
    <span className="text-sm text-mist-300 block min-h-[40px]">
      Number of questions (1–50)
    </span>
    {/* Use the same input-group as the seconds field; add invisible suffix to match widths */}
    <div className="mt-1 flex items-stretch h-10 rounded-xl bg-ink-900 ring-1 ring-ink-700/70 focus-within:ring-ink-500">
      <input
        type="number"
        min={1}
        max={50}
        className="w-full rounded-l-xl px-3 py-2 bg-transparent text-mist-100 outline-none"
        value={maxQuestions}
        onChange={(e) => setMaxQuestions(e.target.value)}
        disabled={disabled || saving}
      />
      {/* invisible suffix to keep exact same layout as the seconds field */}
      <span className="px-3 py-2 text-mist-300 rounded-r-xl select-none opacity-0">s</span>
    </div>
  </label>

  <label className="block">
    <span className="text-sm text-mist-300 block min-h-[40px]">
      Default question length (seconds, 5–120)
    </span>
    <div className="mt-1 flex items-stretch h-10 rounded-xl bg-ink-900 ring-1 ring-ink-700/70 focus-within:ring-ink-500">
      <input
        type="number"
        min={5}
        max={120}
        step={1}
        className="w-full rounded-l-xl px-3 py-2 bg-transparent text-mist-100 outline-none"
        value={durationSec}
        onChange={(e) => setDurationSec(e.target.value)}
        disabled={disabled || saving}
      />
      <span className="px-3 py-2 text-mist-300 rounded-r-xl select-none">s</span>
    </div>
  </label>
</div>

      </div>

      {/* Genres */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm text-mist-300">Genres</h3>
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => selectAll(genres, setSelGenres)}
              disabled={saving}
              className="px-2 py-1 rounded bg-ink-800/70 hover:bg-ink-700/70"
            >
              Select all
            </button>
            <button
              onClick={() => clearAll(setSelGenres)}
              disabled={saving}
              className="px-2 py-1 rounded bg-ink-800/70 hover:bg-ink-700/70"
            >
              Clear
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {genres.map((g) => {
            const checked = selGenres.includes(g.id);
            return (
              <label
                key={g.id}
                className={
                  "flex items-center gap-2 rounded-xl px-3 py-2 ring-1 " +
                  (checked ? "ring-crimson-500 bg-ink-800/70" : "ring-ink-700/70 bg-ink-900")
                }
              >
                <input
                  type="checkbox"
                  className="accent-crimson-500"
                  checked={checked}
                  onChange={() => toggle(g.id, setSelGenres)}
                  disabled={saving}
                />
                <span className="text-sm">{g.label}</span>
              </label>
            );
          })}
        </div>
      </section>

      {/* Decades */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm text-mist-300">Decades</h3>
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => selectAll(decades, setSelDecades)}
              disabled={saving}
              className="px-2 py-1 rounded bg-ink-800/70 hover:bg-ink-700/70"
            >
              Select all
            </button>
            <button
              onClick={() => clearAll(setSelDecades)}
              disabled={saving}
              className="px-2 py-1 rounded bg-ink-800/70 hover:bg-ink-700/70"
            >
              Clear
            </button>
          </div>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {decades.map((d) => {
            const checked = selDecades.includes(d.id);
            return (
              <label
                key={d.id}
                className={
                  "flex items-center justify-center gap-2 rounded-xl px-2 py-2 ring-1 text-sm " +
                  (checked ? "ring-gold-400 bg-ink-800/70" : "ring-ink-700/70 bg-ink-900")
                }
              >
                <input
                  type="checkbox"
                  className="accent-gold-400 mr-1"
                  checked={checked}
                  onChange={() => toggle(d.id, setSelDecades)}
                  disabled={saving}
                />
                <span>{d.label}</span>
              </label>
            );
          })}
        </div>
      </section>

      <button
        onClick={onSave}
        disabled={saving}
        className="rounded-lg px-4 py-2 transition disabled:opacity-50 bg-crimson-500 hover:bg-crimson-400 text-mist-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400"
      >
        {saving ? "Saving…" : "Save"}
      </button>

      <div className="h-6 mt-2 text-sm text-mist-300">{msg}</div>
    </div>
  );
}
