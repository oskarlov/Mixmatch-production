import { getAccessToken, getPreferredDeviceId, setPreferredDeviceId } from "../../../server/engine/spotifyAuth.js";

// Basic fetch with bearer + pagination helper
async function api(path, init = {}) {
  const token = await getAccessToken();
  if (!token) throw new Error("No Spotify token");
  const resp = await fetch(`https://api.spotify.com/v1${path}`, {
    ...init,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (resp.status === 204) return null;
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error?.message || "Spotify API error");
  return data;
}

export async function getPlaylistTracks(playlistId, max = 200) {
  let out = [];
  let next = `/playlists/${playlistId}/tracks?limit=100`;
  while (next && out.length < max) {
    const page = await api(next.replace(/^\/?v1/, ""));
    const items = (page.items || [])
      .map((i) => i.track)
      .filter((t) => t && !t.is_local);

    for (const t of items) {
      out.push({
        id: t.id,
        title: t.name,
        artist: t.artists?.[0]?.name || "Unknown",
        previewUrl: t.preview_url || null,
        uri: t.uri, // e.g., "spotify:track:..."
      });
      if (out.length >= max) break;
    }
    next = page.next ? page.next.replace(/^https:\/\/api\.spotify\.com\/v1/, "") : null;
  }
  // de-duplicate by track id
  const seen = new Set();
  return out.filter((t) => (t.id && !seen.has(t.id)) ? (seen.add(t.id), true) : false);
}

export async function collectTracksFromPlaylists(playlistIds, { perList = 60, maxTotal = 200 } = {}) {
  const lists = Array.from(new Set(playlistIds || []));
  let bag = [];
  for (const pid of lists) {
    try {
      const chunk = await getPlaylistTracks(pid, perList);
      bag.push(...chunk);
    } catch (e) {
      console.warn("playlist fetch failed", pid, e);
    }
  }
  // shuffle
  for (let i = bag.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  // clamp
  return bag.slice(0, maxTotal);
}

// ---- Playback helpers (Spotify Connect) ----
export async function listDevices() {
  const data = await api("/me/player/devices");
  return data.devices || [];
}

export async function startPlayback({ uris, position_ms = 0, device_id = null }) {
  // prefer stored device, else provided, else active
  let useId = getPreferredDeviceId() || device_id;
  if (!useId) {
    const devices = await listDevices();
    const active = devices.find((d) => d.is_active) || devices[0];
    if (!active) throw new Error("No active Spotify device found. Open Spotify on any device.");
    useId = active.id;
  }
  setPreferredDeviceId(useId);
  await api(`/me/player/play?device_id=${encodeURIComponent(useId)}`, {
    method: "PUT",
    body: JSON.stringify({ uris, position_ms }),
  });
}
