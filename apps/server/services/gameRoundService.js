import mongoose from "mongoose";
import { GameRound } from "../models/GameRound.js";

export async function saveGameRound(data) {
  try {
    const doc = new GameRound(data);
    await doc.save();
    console.log(`✅ [GameRoundService] Saved game ${data.code}`);
  } catch (err) {
    console.error("❌ [GameRoundService] Error saving round:", err);
  }
}
