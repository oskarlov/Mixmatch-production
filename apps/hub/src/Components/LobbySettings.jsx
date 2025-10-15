import { useState, useMemo } from "react";
import { useGameStore } from "../store";

export default function LobbySettings() {
  const { stage, hostId, config, code, updateConfig } = useGameStore(s => ({
    stage: s.stage,
    hostId: s.hostId,
    config: s.config,
    code: s.code,
    updateConfig: s.updateConfig
  }));
  const isLobby = stage === "lobby";
  const isHost = useMemo(() => {
    return true; // adjust if your hub isn't always the host
  }, [hostId]);

  const [maxQuestions, setMaxQuestions] = useState(config.maxQuestions);
  const [durationMs, setDurationMs] = useState(config.defaultDurationMs);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  if (!isLobby) return null;

  const disabled = !isHost || saving;

  const onSave = () => {
    setSaving(true);
    setMsg("");
    updateConfig(
      { maxQuestions: Number(maxQuestions), durationMs: Number(durationMs) },
      (res) => {
        setSaving(false);
        setMsg(res?.ok ? "Saved ✓" : `Error: ${res?.error || "unknown"}`);
      }
    );
  };

  return (
    <div className="w-full max-w-md">
      <div className="text-xl font-semibold mb-2">Game Settings</div>

      <label className="block mb-3">
        <span className="text-sm text-mist-300">Number of questions (1–50)</span>
        <input
          type="number"
          min={1}
          max={50}
          className="mt-1 w-full rounded-xl px-3 py-2 bg-ink-900 text-mist-100 outline-none"
          value={maxQuestions}
          onChange={e => setMaxQuestions(e.target.value)}
          disabled={disabled}
        />
      </label>

      <label className="block mb-4">
        <span className="text-sm text-mist-300">Default question length (ms, 5000–120000)</span>
        <input
          type="number"
          min={5000}
          max={120000}
          step={1000}
          className="mt-1 w-full rounded-xl px-3 py-2 bg-ink-900 text-mist-100 outline-none"
          value={durationMs}
          onChange={e => setDurationMs(e.target.value)}
          disabled={disabled}
        />
      </label>

      <button
        onClick={onSave}
        disabled={disabled}
        className="rounded-lg px-4 py-2 transition disabled:opacity-50 bg-crimson-500 hover:bg-crimson-400 text-mist-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400"
      >
        {saving ? "Saving…" : "Save"}
      </button>

      <div className="h-6 mt-2 text-sm text-mist-300">{msg}</div>
      <div className="text-xs opacity-70 mt-2">Host-only. Locked after the game starts.</div>
    </div>
  );
}
