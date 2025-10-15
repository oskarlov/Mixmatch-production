// packages/shared/socket.js
import { io } from "socket.io-client";

let s;

export function getSocket(url) {
  // Reuse across duplicate bundles
  if (typeof window !== "undefined" && window.__MIXMATCH_SOCKET__) {
    s = window.__MIXMATCH_SOCKET__;
    return s;
  }
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

  if (typeof window !== "undefined") {
    window.__MIXMATCH_SOCKET__ = s;
  }
  return s;
}

export function resetSocket() {
  if (s) {
    try { s.disconnect(); } catch {}
    if (typeof window !== "undefined") delete window.__MIXMATCH_SOCKET__;
    s = null;
  }
}
