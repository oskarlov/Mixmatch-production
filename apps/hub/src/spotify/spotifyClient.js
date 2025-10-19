// apps/hub/src/spotify/spotifyClient.js
import {
  getAccessToken,
  getPlaylistData,            // low-level: one page of tracks (needs uri in fields)
  getPreferredDeviceId,
  setPreferredDeviceId,
} from "../../../server/engine/spotifyAuth.js";

/* -------------------------------------------------------------------------- */
/*                                HTTP helper                                 */
/* -------------------------------------------------------------------------- */
async function api(path, init = {}) {
  const token = await getAccessToken();
  if (!token) throw new Error("No Spotify token");

  const resp = await fetch(`https://api.spotify.com/v1${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });

  if (resp.status === 204) return null;

  const ct = resp.headers.get("content-type") || "";
  const isJson = ct.includes("application/json");
  const body = isJson
    ? await resp.json().catch(() => null)
    : await resp.text().catch(() => "");

  if (resp.ok) return body;

  const snippet =
    typeof body === "string"
      ? ` - ${body.slice(0, 180)}`
      : body
      ? ` - ${JSON.stringify(body).slice(0, 180)}`
      : "";
  const e = new Error(`Spotify API ${resp.status}: ${resp.statusText}${snippet}`);
  e.status = resp.status;
  throw e;
}

/* -------------------------------------------------------------------------- */
/*                           Devices (Spotify Connect)                         */
/* -------------------------------------------------------------------------- */
export async function listDevices() {
  const data = await api("/me/player/devices");
  return data?.devices || [];
}

function pickBestDevice(devices) {
  if (!Array.isArray(devices) || devices.length === 0) return null;
  const byType = (t) => devices.find(d => (d.type || "").toLowerCase() === t);
  return (
    devices.find(d => d.is_active) ||  // active first
    byType("computer") ||              // prefer desktop app
    devices[0]                         // otherwise first available
  );
}

/** Returns a usable device id, preferring stored choice or desktop app. */
async function ensureDeviceId(candidate = null) {
  let id = candidate || getPreferredDeviceId();
  if (id) return id;

  const devices = await listDevices();
  const best = pickBestDevice(devices);
  if (!best) {
    // User must open Spotify once so the device appears in /me/player/devices
    throw new Error("Open Spotify on your computer once to activate it.");
  }
  setPreferredDeviceId(best.id);
  return best.id;
}

/* -------------------------------------------------------------------------- */
/*                   Playlists -> normalized minimal tracks                    */
/* -------------------------------------------------------------------------- */
/** Accept plain id, spotify:playlist:URI, or open.spotify.com URL. */
function normPlaylistId(input) {
  const s = String(input || "").trim();
  if (s.startsWith("spotify:playlist:")) return s.split(":").pop();
  const m = s.match(/open\.spotify\.com\/playlist\/([A-Za-z0-9]{22})/);
  return m ? m[1] : s;
}

function normalizeTrack(t) {
  if (!t || !t.id) return null;
  const artists = (t.artists || []).map(a => a?.name).filter(Boolean);
  return {
    id: t.id,
    title: t.name || "",
    artist: artists.join(", "),
    uri: t.uri || null,          // required for Spotify Connect playback
    previewUrl: t.preview_url || null, // kept for completeness, not used here
  };
}

/** One playlist, one page (up to 100 items) — via spotifyAuth.getPlaylistData */
export async function getPlaylistTracksLow(playlistId, { limit = 100 } = {}) {
  const token = await getAccessToken();
  if (!token) throw new Error("No Spotify token");
  const id = normPlaylistId(playlistId);
  const raw = await getPlaylistData(token, id);   // should return raw track objects
  const out = raw.map(normalizeTrack).filter(Boolean);
  return out.slice(0, limit);
}

/** Multiple playlists (concat first page from each, optional shuffle, clamp). */
export async function collectTracksFromPlaylists(
  playlistIds,
  { perList = 100, maxTotal = 200, shuffle = true } = {}
) {
  const ids = Array.from(new Set((playlistIds || []).map(normPlaylistId)));
  let bag = [];
  for (const id of ids) {
    try {
      const chunk = await getPlaylistTracksLow(id, { limit: perList });
      bag.push(...chunk);
    } catch (e) {
      console.warn("playlist fetch failed", id, e);
    }
  }
  // de-dup by track id
  const seen = new Set();
  const dedup = bag.filter(t => (t.id && !seen.has(t.id)) ? (seen.add(t.id), true) : false);

  // optional shuffle
  if (shuffle) {
    for (let i = dedup.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [dedup[i], dedup[j]] = [dedup[j], dedup[i]];
    }
  }
  return dedup.slice(0, maxTotal);
}

/* -------------------------------------------------------------------------- */
/*                                 Playback                                   */
/* -------------------------------------------------------------------------- */
export async function getPlaybackState() {
  try {
    // returns { is_playing, item, device, ... } or null
    const st = await api("/me/player");
    return st || null;
  } catch {
    // 204 No Content is normal if nothing is active
    return null;
  }
}
export async function startPlayback({ uris, position_ms = 0, device_id = null }) {
  if (!Array.isArray(uris) || uris.length === 0) {
    throw new Error("startPlayback: uris[] required");
  }

  // 1) Pick a device (prefer desktop), remember it
  const id = await ensureDeviceId(device_id);
  const q = `?device_id=${encodeURIComponent(id)}`;

  // 2) Direct play on that device
  try {
    await api(`/me/player/play${q}`, {
      method: "PUT",
      body: JSON.stringify({ uris, position_ms }),
    });
    return;
  } catch (e) {
    // 3) If play failed (e.g., session attached elsewhere), transfer then retry
    try {
      await api("/me/player", {
        method: "PUT",
        body: JSON.stringify({ device_ids: [id], play: false }),
      });
      await api(`/me/player/play${q}`, {
        method: "PUT",
        body: JSON.stringify({ uris, position_ms }),
      });
      return;
    } catch (e2) {
      // Surface the original error info but we tried transfer
      console.error("startPlayback failed after transfer attempt", e, e2);
      throw e2;
    }
  }
}

// Fire-and-forget pause: never parse JSON, never throw
export async function pausePlayback() {
  try {
    const st = await getPlaybackState().catch(() => null);
    if (!st?.is_playing) return; // nothing to pause → skip the call
    await api(`/me/player/pause`, { method: "PUT" }); // no device_id to avoid extra 403s
  } catch (e) {
    // ignore benign errors
    if (e?.status !== 403 && e?.status !== 404) console.warn("pausePlayback", e);
  }
}


/** Optional helper if you add a device picker UI later. */
export async function transferPlaybackTo(device_id, { play = false } = {}) {
  if (!device_id) throw new Error("transferPlaybackTo: device_id required");
  setPreferredDeviceId(device_id);
  await api("/me/player", {
    method: "PUT",
    body: JSON.stringify({ device_ids: [device_id], play: !!play }),
  });
}

/* -------------------------------------------------------------------------- */
/*                       Quiz-driven playback controller                      */
/* -------------------------------------------------------------------------- */
/**
 * Connect-only controller. Autostarts when:
 *  - stage enters "question" AND media.spotifyUri already present, OR
 *  - media.spotifyUri arrives later during the same question (race fix)
 * Stops on leaving "question" (reveal/result/gameover).
 *
 * Usage in App.jsx:
 *   useEffect(() => {
 *     const unsub = attachPlaybackController(useGame); // no getAudioEl: no browser audio
 *     return unsub;
 *   }, []);
 */
// Replace your current attachPlaybackController with THIS version
// ... keep existing imports and helpers ...

// --- Replace existing attachPlaybackController with this version ---
export function attachPlaybackController(useGame) {
  const select = (s) => ({
    stage: s.stage,
    qid: s.question?.id || null,
    uri: s.media?.spotifyUri || null,
  });
  const same = (a, b) => a.stage === b.stage && a.qid === b.qid && a.uri === b.uri;

  let last = select(useGame.getState());
  let lastQ = null;
  let playedThisQ = false;
  let keepAlive = null;

  // Only resume if it's the SAME track and currently paused.
  async function resumeIfPausedSameTrack(targetUri) {
    try {
      const st = await getPlaybackState().catch(() => null);
      const sameTrack = !!(st?.item?.uri && targetUri && st.item.uri === targetUri);
      if (!sameTrack) return;              // never start a different track here
      if (st?.is_playing) return;          // already playing → nothing to do

      // Empty body resumes current context; no device_id to avoid 403 churn.
      await api(`/me/player/play`, { method: "PUT", body: JSON.stringify({}) });
    } catch {
      // swallow – keepalive should never hard-reset the song
    }
  }

  async function onEnterQuestion(uri) {
    // Reset guards for the new question
    playedThisQ = false;

    // Stop any previous keepalive
    if (keepAlive) { clearInterval(keepAlive); keepAlive = null; }

    // IMPORTANT: don't pause here; it can create the start/pause flicker.
    if (uri) {
      try {
        await startPlayback({ uris: [uri], position_ms: 0 });
        playedThisQ = true;
      } catch (e) {
        console.warn("[ctrl] initial play failed", e);
      }
    }

    // Gentle keepalive: only resume if same track is paused; never restart.
    keepAlive = setInterval(() => {
      const st = select(useGame.getState());
      if (st.stage === "question" && st.qid === lastQ && st.uri) {
        resumeIfPausedSameTrack(st.uri);
      }
    }, 800);
  }

  async function react(curr, prev) {
    const { stage, qid, uri } = curr;
    const entering = stage === "question" && qid && qid !== lastQ;
    const leavingQuestion = prev.stage === "question" && stage !== "question";

    if (entering) {
      lastQ = qid;
      await onEnterQuestion(uri);
      return;
    }

    if (leavingQuestion) {
      if (keepAlive) { clearInterval(keepAlive); keepAlive = null; }
      // do NOT pause; let reveal/result continue audio if you want
      return;
    }

    // URI arrived later during the SAME question (race fix)
    const uriArrived =
      stage === "question" && qid === lastQ && !playedThisQ && !!uri && prev.uri !== uri;

    if (uriArrived) {
      try {
        await startPlayback({ uris: [uri], position_ms: 0 });
        playedThisQ = true;
      } catch (e) {
        console.warn("[ctrl] late media play failed", e);
      }
    }

    if (stage === "gameover") {
      if (keepAlive) { clearInterval(keepAlive); keepAlive = null; }
      try { await pausePlayback(); } catch {}
    }
  }

  // Run once immediately (handles refresh mid-question)
  react(last, last);

  const unsub = useGame.subscribe(() => {
    const curr = select(useGame.getState());
    if (same(curr, last)) return;
    const prev = last; last = curr;
    react(curr, prev);
  });

  if (typeof window !== "undefined") {
    try { window.__mm_playback_unsub?.(); } catch {}
    window.__mm_playback_unsub = unsub;
  }
  return () => {
    try { unsub(); } catch {}
    if (keepAlive) { clearInterval(keepAlive); keepAlive = null; }
    if (typeof window !== "undefined" && window.__mm_playback_unsub === unsub) {
      window.__mm_playback_unsub = null;
    }
  };
}

