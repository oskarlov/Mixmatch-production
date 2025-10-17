import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { requestToken } from "../../server/engine/spotifyAuth.js";

export default function SpotifyCallback() {
  const navigate = useNavigate();
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;      // guard: React 18 StrictMode double-mount
    ranRef.current = true;

    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    // Remove the params immediately so a second pass can't reuse the code
    window.history.replaceState({}, document.title, url.pathname);

    (async () => {
      try {
        await requestToken(code, state); // pass values explicitly
      } catch (e) {
        console.error("Spotify token error:", e);
      } finally {
        navigate("/", { replace: true });
      }
    })();
  }, [navigate]);

  return <div className="p-6 text-mist-100">Completing Spotify sign-in…</div>;
}
