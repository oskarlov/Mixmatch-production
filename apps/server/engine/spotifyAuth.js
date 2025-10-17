// apps/server/engine/spotifyAuth.js
// Browser-only PKCE auth for Spotify (persistent + refresh + debug)
//const CLIENT_ID = import.meta?.env?.VITE_SPOTIFY_CLIENT_ID || null;
const CLIENT_ID = "98054721c122411d8880c1170d78b1b6"; // <- your Client ID

// fallback to shared if you insist, but avoid bundling secrets
// import { ID as CLIENT_ID } from "../../../packages/shared/apiConfig.js";

const REDIRECT_URI = `${window.location.origin}/callback`;

// Scopes needed:
// - read playlists, read/modify playback state, (optionally) streaming
// Scopes needed: read playlists, control playback, streaming
const SCOPES = [
  "user-read-private",
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-read-playback-state",
  "user-modify-playback-state",
  "streaming",
].join(" ");

/** LocalStorage keys */
const KEY = {
  ACCESS: "access_token",
  REFRESH: "refresh_token",
  EXPIRES_AT: "expires_at",
  CODE_VERIFIER: "code_verifier",
  STATE: "spotify_auth_state",
  PENDING: "pending_action",
  DEVICE: "spotify_preferred_device_id",
};

/** ─────────────────────────────────────────────────────────────────────────────
 *  Helpers
 *  ──────────────────────────────────────────────────────────────────────────── */
const base64url = (ab) =>
  btoa(String.fromCharCode(...new Uint8Array(ab)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

const generateRandomString = (len) => {
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const buf = crypto.getRandomValues(new Uint8Array(len));
  let out = "";
  for (let i = 0; i < len; i++) out += possible[buf[i] % possible.length];
  return out;
};

const sha256 = async (input) =>
  crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));

/** ─────────────────────────────────────────────────────────────────────────────
 *  Token state
 *  ──────────────────────────────────────────────────────────────────────────── */
export function hasSpotifyToken() {
  const t = localStorage.getItem(KEY.ACCESS);
  const ea = Number(localStorage.getItem(KEY.EXPIRES_AT) || 0);
  return !!t && Date.now() < ea;
}

export async function refreshAccessToken() {
  const refresh = localStorage.getItem(KEY.REFRESH);
  if (!refresh || !CLIENT_ID) return null;

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refresh,
    client_id: CLIENT_ID,
  });

  const resp = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data.error_description || data.error || "Refresh failed");
  }

  localStorage.setItem(KEY.ACCESS, data.access_token);
  if (data.refresh_token) localStorage.setItem(KEY.REFRESH, data.refresh_token);
  const expiresAt = Date.now() + (Number(data.expires_in || 3600) - 60) * 1000;
  localStorage.setItem(KEY.EXPIRES_AT, String(expiresAt));
  return data.access_token;
}

export async function getAccessToken() {
  if (hasSpotifyToken()) return localStorage.getItem(KEY.ACCESS);
  return await refreshAccessToken();
}

/** ─────────────────────────────────────────────────────────────────────────────
 *  Auth flow
 *  ──────────────────────────────────────────────────────────────────────────── */
export async function redirectToAuth() {
  if (!CLIENT_ID) throw new Error("Missing Spotify CLIENT_ID");

  const verifier = generateRandomString(64);
  const state = generateRandomString(16);
  localStorage.setItem(KEY.CODE_VERIFIER, verifier);
  localStorage.setItem(KEY.STATE, state);

  const challenge = base64url(await sha256(verifier));

  const auth = new URL("https://accounts.spotify.com/authorize");
  auth.search = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    code_challenge_method: "S256",
    code_challenge: challenge,
    scope: SCOPES,
    state,
  }).toString();

  window.location.href = auth.toString();
}

/**
 * Exchange authorization code for tokens.
 * Safe for React 18 StrictMode: we strip ?code&state from the URL immediately,
 * so a second effect run finds no code and exits quietly.
 *
 * @param {string|null} passedCode  optional code (if your callback extracted it)
 * @param {string|null} passedState optional state
 */
export async function requestToken(passedCode = null, passedState = null) {
  let code = passedCode;
  let state = passedState;

  if (!code) {
    // Read once from the URL, then strip params to avoid double-exchange
    const url = new URL(window.location.href);
    const err = url.searchParams.get("error");
    if (err) throw new Error("Spotify auth error: " + err);

    code = url.searchParams.get("code");
    state = url.searchParams.get("state");

    // Strip query params right away (prevents StrictMode second-run issues)
    if (code || state) {
      window.history.replaceState({}, document.title, url.pathname);
    }
  }

  if (!code) return null; // nothing to exchange

  const storedState = localStorage.getItem(KEY.STATE);
  if (!storedState || state !== storedState) {
    throw new Error("State mismatch. Did the login start from this origin?");
  }

  const verifier = localStorage.getItem(KEY.CODE_VERIFIER);
  if (!verifier) throw new Error("Missing code_verifier");

  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI, // MUST match the authorize step + dashboard
    code_verifier: verifier,
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
  localStorage.setItem(KEY.ACCESS, data.access_token);
  if (data.refresh_token) localStorage.setItem(KEY.REFRESH, data.refresh_token);
  const expiresAt = Date.now() + (Number(data.expires_in || 3600) - 60) * 1000;
  localStorage.setItem(KEY.EXPIRES_AT, String(expiresAt));

  // Cleanup
  localStorage.removeItem(KEY.CODE_VERIFIER);
  localStorage.removeItem(KEY.STATE);

  return data;
}

/** ─────────────────────────────────────────────────────────────────────────────
 *  Misc helpers
 *  ──────────────────────────────────────────────────────────────────────────── */
export function authDebug() {
  const t = localStorage.getItem(KEY.ACCESS);
  const r = localStorage.getItem(KEY.REFRESH);
  const ea = Number(localStorage.getItem(KEY.EXPIRES_AT) || 0);
  return {
    hasAccess: !!t,
    expiresInSec: ea ? Math.max(0, Math.floor((ea - Date.now()) / 1000)) : null,
    hasRefresh: !!r,
    redirectUri: REDIRECT_URI,
    clientId: CLIENT_ID ? CLIENT_ID.slice(0, 6) + "…" : null,
  };
}

export function logoutSpotify() {
  Object.values(KEY).forEach((k) => localStorage.removeItem(k));
}

export function getPreferredDeviceId() {
  return localStorage.getItem(KEY.DEVICE) || null;
}

export function setPreferredDeviceId(id) {
  if (id) localStorage.setItem(KEY.DEVICE, id);
}