import { ID } from "../../../packages/shared/apiConfig.js"; // "../apiConfig.js";

const redirectUri = window.location.origin; // "https://halting-unsheltering-christa.ngrok-free.dev"; // Updatera efter deployment

// Redirect to Spotify (PKCE)
// Code from https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow
export async function redirectToAuth() {
    const generateRandomString = (length) => {
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const values = crypto.getRandomValues(new Uint8Array(length));
        return values.reduce((acc, x) => acc + possible[x % possible.length], "");
    }

    const sha256 = async (plain) => {
        const encoder = new TextEncoder()
        const data = encoder.encode(plain)
        return window.crypto.subtle.digest('SHA-256', data)
    }

    const base64encode = (input) => {
        return btoa(String.fromCharCode(...new Uint8Array(input)))
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
    }

    const codeVerifier  = generateRandomString(64);
    const state = generateRandomString(16);

    localStorage.setItem('code_verifier', codeVerifier);
    localStorage.setItem('spotify_auth_state', state);
    console.log('AUTH start', { origin: window.location.origin, state, codeVerifier }); // for testing

    const hashed = await sha256(codeVerifier)
    const codeChallenge = base64encode(hashed);

    const scope = 'user-read-private user-read-email';
    const authUrl = new URL("https://accounts.spotify.com/authorize")
    const spotifyID = ID;
    console.log(spotifyID);

    const params =  {
        response_type: 'code',
        client_id: spotifyID,
        scope,
        code_challenge_method: 'S256',
        code_challenge: codeChallenge,
        redirect_uri: redirectUri,
        state,
    }

    authUrl.search = new URLSearchParams(params).toString();
    window.location.href = authUrl.toString();
}


// Exchange ?code -> tokens (call once after you return)
export async function requestToken() {
    const url = new URL(window.location.href);
    // Temp for testing
    console.log('AUTH return', {
        origin: window.location.origin,
        returnedState: url.searchParams.get('state'),
        storedState: localStorage.getItem('spotify_auth_state')
    });

    // If Spotify sent back an error:
    const err = url.searchParams.get("error");
    if (err) throw new Error("Spotify auth error: " + err);
  
    const code = url.searchParams.get("code");
    if (!code) return null; // nothing to do (user hasn't just returned)
  
    // Optional CSRF check:
    const returnedState = url.searchParams.get("state");
    const storedState   = localStorage.getItem("spotify_auth_state");
    if (!returnedState || returnedState !== storedState) {
      throw new Error("State mismatch. Start the login flow from the same origin.");
    }
  
    const codeVerifier = localStorage.getItem("code_verifier");
    if (!codeVerifier) throw new Error("Missing code_verifier in localStorage");
  
    const body = new URLSearchParams({
      client_id: ID,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri, // MUST exactly match step 1 and Spotify dashboard
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
  
    // Remove ?code&state from the address bar
    // window.history.replaceState({}, document.title, url.pathname);
  
    return data; // or return data.access_token if you prefer
}
  
// Handy helpers
export function hasSpotifyToken() {
    const t  = localStorage.getItem("access_token");
    const ea = Number(localStorage.getItem("expires_at") || 0);
    return !!t && Date.now() < ea;
}
  
export async function getAccessToken() {
    // (Optional: add refresh flow here later if token expired)
    return hasSpotifyToken() ? localStorage.getItem("access_token") : null;
}
