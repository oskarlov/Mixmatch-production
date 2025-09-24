import { io } from "socket.io-client";
let s;
export function getSocket(url) {
  if (!s) s = io(url, { transports: ["websocket"], autoConnect: true });
  return s;
}
