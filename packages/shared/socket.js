// packages/shared/socket.js
import { io } from "socket.io-client";

let s;

export function getSocket(url) {
  if (s) return s;

  const resolvedUrl =
    url ||
    (typeof import.meta !== "undefined" &&
      import.meta.env &&
      import.meta.env.VITE_SERVER_URL) ||
    (typeof process !== "undefined" &&
      process.env &&
      process.env.VITE_SERVER_URL) ||
    "http://localhost:8080";

  s = io(resolvedUrl, { transports: ["websocket"], autoConnect: true });
  return s;
}

export function resetSocket() {
  if (s) {
    s.disconnect();
    s = null;
  }
}
