import { registerGameEngine } from "../engine/gameEngine.js";

export function registerGameHandlers(io, mediaDir) {
  registerGameEngine(io, mediaDir);
}

