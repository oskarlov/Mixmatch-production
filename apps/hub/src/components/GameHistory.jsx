import { useEffect, useState } from "react";

export default function GameHistory() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats/summary")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && Array.isArray(data.results)) {
          setResults(data.results);
        }
      })
      .catch((err) => console.error("Failed to fetch stats:", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="text-mist-400 text-sm text-center mt-2">
        Loading history…
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-mist-400 text-sm text-center mt-2">
        No previous games.
      </div>
    );
  }

  return (
    <div className="mt-4 bg-ink-800/60 rounded-lg p-3 text-mist-100">
      <h3 className="text-sm font-semibold mb-2 flex items-center gap-2 text-mist-200">
        🎵 Previous Games
      </h3>
      <table className="w-full text-left text-xs md:text-sm">
        <thead className="text-mist-400 border-b border-ink-700/60">
          <tr>
            <th className="py-1 px-2">Player</th>
            <th className="py-1 px-2">Points</th>
            <th className="py-1 px-2">Questions</th>
            <th className="py-1 px-2">Date</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r, idx) => (
            <tr
              key={idx}
              className="border-b border-ink-700/40 last:border-none hover:bg-ink-700/40 transition"
            >
              <td className="py-1 px-2">{r.playerName ?? "Unknown"}</td>
              <td className="py-1 px-2 font-mono">{r.totalPoints ?? 0}</td>
              <td className="py-1 px-2 font-mono">
                {r.totalQuestions ?? "—"}
              </td>
              <td className="py-1 px-2 whitespace-nowrap">
                {new Date(r.createdAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
