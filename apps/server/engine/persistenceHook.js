import { saveRound } from "../services/gameRoundService.js";

/**
 * Hook for saving a finished game round.
 * You can safely import this in gameEngine.js once the team is ready.
 */
export async function handleGameEnd(gameState) {
  try {
    // Pick the fields you actually want to persist
    const roundData = {
      code: gameState.code,
      players: gameState.players,
      questions: gameState.questions || [],
      leaderboard: gameState.leaderboard || [],
      endedAt: new Date()
    };

    const result = await saveRound(roundData);
    if (result.ok) {
      console.log(`✅ Game round ${result.code} saved successfully`);
    } else {
      console.warn("⚠️ Game round save failed:", result.error);
    }
  } catch (err) {
    console.error("❌ Error in handleGameEnd:", err);
  }
}
