import mongoose from "mongoose";

const TrackSchema = new mongoose.Schema({
  id: String,
  title: String,
  artist: String,
  uri: String,
  previewUrl: String,
});

const PlayerSchema = new mongoose.Schema({
  name: String,
  score: Number,
});

const GameRoundSchema = new mongoose.Schema({
  code: { type: String, required: true },
  genre: { type: String },
  decade: { type: String },
  tracksPlayed: [TrackSchema],
  players: [PlayerSchema],
  leaderboard: [PlayerSchema],
  config: mongoose.Schema.Types.Mixed,
  endedAt: { type: Date, default: Date.now },
});

export const GameRound = mongoose.model("GameRound", GameRoundSchema);
