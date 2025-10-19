import mongoose from "mongoose";

const questionSchema = new mongoose.Schema({
  id: String,
  prompt: String,
  options: [String],
  correctIndex: Number,
  durationMs: Number,
  media: {
    audioUrl: String,
    imageUrl: String,
  },
  track: {
    id: String,
    title: String,
    artist: String,
    album: String,
    spotifyUrl: String,
  },
});

const playerSchema = new mongoose.Schema({
  name: String,
  score: Number,
});

const configSchema = new mongoose.Schema({
  maxQuestions: Number,
  defaultDurationMs: Number,
  selectedPlaylistIDs: [String],
});

const gameRoundSchema = new mongoose.Schema({
  code: { type: String, unique: true },
  createdAt: { type: Date, default: Date.now },
  stage: { type: String, default: "idle" },
  hostId: String,
  firstPlayerId: String,
  players: [playerSchema],
  questions: [questionSchema],
  leaderboard: [playerSchema],
  lstTracks: [
    {
      id: String,
      title: String,
      artist: String,
    },
  ],
  config: configSchema,
});

export const GameRound = mongoose.model("GameRound", gameRoundSchema);
