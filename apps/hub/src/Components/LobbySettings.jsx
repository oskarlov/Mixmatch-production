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
    // If Hub runs as host, you likely store the hub socket id somewhere;
    // Many setups compare against hostId in store or mark `isHost` explicitly.
    // If your Hub is always the host UI, set isHost=true. Otherwise wire it properly.
    return true;
  }, [hostId]);

  const [maxQuestions, setMaxQuestions] = useState(config.maxQuestions);
  const [durationMs, setDurationMs] = useState(config.defaultDurationMs);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // Keep inputs in sync when server config changes
  // (Optional, if your store updates while on lobby)
  // useEffect(() => {
  //   setMaxQuestions(config.maxQuestions);
  //   setDurationMs(config.defaultDurationMs);
  // }, [config.maxQuestions, config.defaultDurationMs]);

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
    <div className="p-4 rounded-2xl shadow-md border w-full max-w-md bg-white/5">
      <div className="text-xl font-semibold mb-2">Game Settings</div>

      <label className="block mb-3">
        <span className="text-sm">Number of questions (1–50)</span>
        <input
          type="number"
          min={1}
          max={50}
          className="mt-1 w-full rounded-xl px-3 py-2 bg-black/20 outline-none"
          value={maxQuestions}
          onChange={e => setMaxQuestions(e.target.value)}
          disabled={disabled}
        />
      </label>

      <label className="block mb-4">
        <span className="text-sm">Default question length (ms, 5000–120000)</span>
        <input
          type="number"
          min={5000}
          max={120000}
          step={1000}
          className="mt-1 w-full rounded-xl px-3 py-2 bg-black/20 outline-none"
          value={durationMs}
          onChange={e => setDurationMs(e.target.value)}
          disabled={disabled}
        />
      </label>

      <button
        onClick={onSave}
        disabled={disabled}
        className="rounded-2xl px-4 py-2 shadow hover:shadow-lg transition disabled:opacity-50 border"
      >
        {saving ? "Saving…" : "Save"}
      </button>

      <div className="h-6 mt-2 text-sm">{msg}</div>

      <div className="text-xs opacity-70 mt-2">
        Host-only. Locked after the game starts.
      </div>
    </div>
  );
}
