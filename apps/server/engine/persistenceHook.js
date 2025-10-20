import { saveGameRound } from "../services/gameRoundService.js";

export async function handleGameEnd(room) {
  try {
    const roundData = {
      code: room.code,
      genre: room.config.genre || "Unknown",
      decade: room.config.decade || "Unknown",
      tracksPlayed: (room.tracks || []).map(t => ({
        id: t.id,
        title: t.title,
        artist: t.artist,
        uri: t.uri || null,
        previewUrl: t.previewUrl || null,
      })),
      players: [...room.players.values()].map(p => ({
        name: p.name,
        score: p.score || 0,
      })),
      leaderboard: [...room.players.values()]
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .map(p => ({ name: p.name, score: p.score || 0 })),
      config: room.config,
      endedAt: new Date(),
    };

    await saveGameRound(roundData);
  } catch (err) {
    console.error("❌ [handleGameEnd] Failed to persist game:", err);
  }
}
