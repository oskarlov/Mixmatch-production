import { redirectToAuth, hasSpotifyToken } from "../../server/engine/spotifyAuth.js";
import { useGameStore } from "./store";
import { useNavigate } from "react-router-dom";

export default function StartPage() {
  const createRoom = useGameStore(s => s.createRoom);
  const navigate = useNavigate();

  const onCreate = () => {
    if (!hasSpotifyToken()) {
      localStorage.setItem("pending_action", "createRoom");
      redirectToAuth();                     // → Spotify
      return;
    }
    createRoom();                           // already connected
    navigate("/hub", { replace: true });    // go into the app
  };

  return (
    <div className="min-h-dvh grid place-items-center bg-slate-950 text-slate-100 p-6">
      <button className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500"
              onClick={onCreate}>
        Create room
      </button>
    </div>
  );
}