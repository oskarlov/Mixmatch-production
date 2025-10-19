import { nanoid } from "nanoid";
import { GameRound } from "../models/GameRound.js";

/**
 * Saves a full game round to MongoDB
 */
export async function saveRound(roundData) {
  const code = roundData.code || nanoid(6).toUpperCase();

  try {
    const round = new GameRound({ ...roundData, code });
    await round.save();
    console.log(`💾 [GameRoundService] Saved round with code ${code}`);
    return { ok: true, code };
  } catch (err) {
    console.error("❌ [GameRoundService] Error saving round:", err);
    return { ok: false, error: err.message };
  }
}

/**
 * Loads a game round by code
 */
export async function loadRound(code) {
  try {
    const round = await GameRound.findOne({ code });
    if (!round) return { ok: false, error: "Round not found" };
    console.log(`📦 [GameRoundService] Loaded round ${code}`);
    return { ok: true, round };
  } catch (err) {
    console.error("❌ [GameRoundService] Error loading round:", err);
    return { ok: false, error: err.message };
  }
}
