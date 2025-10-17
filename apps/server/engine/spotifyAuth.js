// Minimal-Change Spotify Auth + Playlist Fetch (merged from your main + your custom file)
// Keeps your original signatures; only adds what's needed to work reliably for you & your friends.

import { ID } from "../../../packages/shared/apiConfig.js"; // keep existing import

// ---- Env-aware config (fallback to ID for backward compatibility) ----
const CLIENT_ID = import.meta?.env?.VITE_SPOTIFY_CLIENT_ID || ID;
const REDIRECT_URI =
  import.meta?.env?.VITE_SPOTIFY_REDIRECT_URI || `${window.location.origin}/callback`;

const SCOPES = [
  "user-read-private",
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-read-playback-state",
  "user-modify-playback-state",
  "streaming",
].join(" ");

// ---- PKCE helpers (yours, unchanged) ----
const generateRandomString = (length) => {
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const values = crypto.getRandomValues(new Uint8Array(length));
  return values.reduce((acc, x) => acc + possible[x % possible.length], "");
};

const sha256 = async (plain) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest("SHA-256", data);
};

const base64encode = (input) => {
  return btoa(String.fromCharCode(...new Uint8Array(input)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
};

// ---- Login redirect (yours, with centralized CLIENT_ID/REDIRECT_URI/SCOPES) ----
export async function redirectToAuth() {
  const codeVerifier = generateRandomString(64);
  const state = generateRandomString(16);

  localStorage.setItem("code_verifier", codeVerifier);
  localStorage.setItem("spotify_auth_state", state);
  console.log("AUTH start", { origin: window.location.origin, state, codeVerifier }); // debug

  const hashed = await sha256(codeVerifier);
  const codeChallenge = base64encode(hashed);

  const authUrl = new URL("https://accounts.spotify.com/authorize");
  authUrl.search = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,     // <— env or fallback to ID
    scope: SCOPES,
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
    redirect_uri: REDIRECT_URI,
    state,
  }).toString();

  window.location.href = authUrl.toString();
}

// ---- Exchange ?code → tokens (now strips URL early, uses env-aware config) ----
export async function requestToken() {
  const url = new URL(window.location.href);

  console.log("AUTH return", {
    origin: window.location.origin,
    returnedState: url.searchParams.get("state"),
    storedState: localStorage.getItem("spotify_auth_state"),
  });

  const err = url.searchParams.get("error");
  if (err) throw new Error("Spotify auth error: " + err);

  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");

  // Strip ?code&state EARLY to avoid React StrictMode double-exchange on re-render
  if (code || returnedState) {
    const clean = `${url.origin}${url.pathname}`;
    window.history.replaceState({}, document.title, clean);
  }

  if (!code) return null; // nothing to do

  // CSRF check (unchanged)
  const storedState = localStorage.getItem("spotify_auth_state");
  if (!returnedState || returnedState !== storedState) {
    throw new Error("State mismatch. Start the login flow from the same origin.");
  }

  const codeVerifier = localStorage.getItem("code_verifier");
  if (!codeVerifier) throw new Error("Missing code_verifier in localStorage");

  const body = new URLSearchParams({
    client_id: CLIENT_ID,     // <— env or fallback
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: codeVerifier,
  });

  const resp = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data.error_description || data.error || "Token exchange failed");
  }

  // Persist tokens
  localStorage.setItem("access_token", data.access_token);
  if (data.refresh_token) localStorage.setItem("refresh_token", data.refresh_token);
  const expiresAt = Date.now() + (Number(data.expires_in || 3600) - 60) * 1000; // minus skew
  localStorage.setItem("expires_at", String(expiresAt));

  // Cleanup
  localStorage.removeItem("code_verifier");
  localStorage.removeItem("spotify_auth_state");

  return data;
}

// ---- Token helpers (added refresh, but kept your original hasSpotifyToken) ----
export function hasSpotifyToken() {
  const t = localStorage.getItem("access_token");
  const ea = Number(localStorage.getItem("expires_at") || 0);
  return !!t && Date.now() < ea;
}

// Minimal refresh flow (new)
async function refreshAccessToken() {
  const refresh = localStorage.getItem("refresh_token");
  if (!refresh) return null;

  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: "refresh_token",
    refresh_token: refresh,
  });

  const resp = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error_description || data.error || "Refresh failed");

  localStorage.setItem("access_token", data.access_token);
  const expiresAt = Date.now() + (Number(data.expires_in || 3600) - 60) * 1000;
  localStorage.setItem("expires_at", String(expiresAt));
  if (data.refresh_token) localStorage.setItem("refresh_token", data.refresh_token);

  return data.access_token;
}

export async function getAccessToken() {
  if (hasSpotifyToken()) return localStorage.getItem("access_token");
  try {
    const t = await refreshAccessToken();
    if (t) return t;
  } catch (e) {
    // ignore and fall through
  }
  return null;
}

// ---- Playlist fetching (kept here as in your main) ----
async function readJsonOrText(resp) {
  const contentType = resp.headers.get("content-type") || "";
  const raw = await resp.text(); // read once

  let data = null;
  if (contentType.includes("application/json")) {
    try { data = JSON.parse(raw); } catch {/* malformed JSON – ignore */}
  }
  return { data, raw };
}

export async function getPlaylistData(accessToken, playlistID) {
  const url = new URL(`https://api.spotify.com/v1/playlists/${playlistID}/tracks`);
  url.searchParams.set(
    "fields",
    "items(track(id,name,artists(name),album(name,images)))"
  );

  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });

  const { data, raw } = await readJsonOrText(resp);
  if (!resp.ok) {
    const msg =
      data?.error?.message ||
      data?.error_description ||
      raw ||
      `Spotify error ${resp.status}`;
    throw new Error(msg);
  }
  return data.items.map((i) => i.track);
}

// ---- Device preference (added so your spotifyClient.js import stops erroring) ----
const PREFERRED_DEVICE_KEY = "spotify_preferred_device_id";

/** Returns the last chosen deviceId (or null if unset). */
export function getPreferredDeviceId() {
  try {
    return localStorage.getItem(PREFERRED_DEVICE_KEY) || null;
  } catch {
    return null;
  }
}

/** Persist a preferred deviceId (pass null/undefined to clear). */
export function setPreferredDeviceId(deviceId) {
  try {
    if (!deviceId) {
      localStorage.removeItem(PREFERRED_DEVICE_KEY);
      return null;
    }
    localStorage.setItem(PREFERRED_DEVICE_KEY, String(deviceId));
    return deviceId;
  } catch {
    return null;
  }
}

// ---- Optional helpers you may already use in dev ----
export function logoutSpotify() {
  try {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("expires_at");
    localStorage.removeItem(PREFERRED_DEVICE_KEY);
  } catch {}
}

export function authDebug() {
  return {
    origin: window.location.origin,
    hasAccess: !!localStorage.getItem("access_token"),
    hasRefresh: !!localStorage.getItem("refresh_token"),
    expiresAt: Number(localStorage.getItem("expires_at") || 0),
    clientIdPrefix: String(CLIENT_ID).slice(0, 6) + "…",
    redirectUri: REDIRECT_URI,
  };
}
