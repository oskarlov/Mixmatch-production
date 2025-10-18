// server/engine/mediaEngine.js

import { getAccessToken, getPlaylistData } from "./spotifyAuth.js";

function normPlaylistId(input) {
  const s = String(input || "").trim();
  const m1 = s.match(/spotify:playlist:([A-Za-z0-9]{22})/);
  if (m1) return m1[1];
  const m2 = s.match(/open\.spotify\.com\/playlist\/([A-Za-z0-9]{22})/);
  if (m2) return m2[1];
  const m3 = s.match(/^([A-Za-z0-9]{22})$/);
  return m3 ? m3[1] : s;
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function toGameTrack(t) {
  if (!t || !t.id) return null;
  const artists = Array.isArray(t.artists) ? t.artists.map(a => a?.name).filter(Boolean) : [];
  if (artists.length === 0) return null;
  return {
    id: t.id,
    title: String(t.name || "").trim(),
    artist: artists.join(", "),
    previewUrl: t.preview_url || null,
    uri: t.uri || null,
  };
}

export async function makeTrackList(playlistID, n) {
  const id = normPlaylistId(playlistID);
  const num = Math.max(1, Number(n || 10));

  console.log(`[makeTrackList] Request: ${num} from ${id}`);

  const token = await getAccessToken();
  if (!token) throw new Error("No Spotify token. Please log in again.");

  const raw = await getPlaylistData(token, id);
  if (!raw || !Array.isArray(raw)) throw new Error(`Spotify returned ${typeof raw}, expected array`);

  const tracks = raw.map((x) => x?.track || x).filter(Boolean);
  if (!tracks.length) throw new Error("Playlist returned no items");

  const seen = new Set();
  const normalized = tracks
    .map(toGameTrack)
    .filter(Boolean)
    // *** only keep playable tracks ***
    .filter((t) => !!t.uri || !!t.previewUrl)
    // de-dup by id
    .filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)));

  console.log(`[makeTrackList] Normalized to ${normalized.length} playable tracks`);

  if (!normalized.length) throw new Error("Playlist has no playable tracks (no URI/previews).");

  shuffle(normalized);
  const result = normalized.slice(0, num);
  console.log(`[makeTrackList] ✓ Returning ${result.length} Spotify tracks`);
  return result;
}
