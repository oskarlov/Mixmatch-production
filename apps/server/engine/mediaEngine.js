import { getPlaylistData, getAccessToken } from "./spotifyAuth.js";

export async function makeTrackList(playlistID, n) {
  // optional shuffle helper
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // normalize raw Spotify track -> game shape
  function toGameTrack(t) {
    if (!t || !t.id) return null;
    const artists = (t.artists || []).map(a => a?.name).filter(Boolean);
    return {
      id: t.id,                             // ✅ real Spotify track id
      title: t.name || "",
      artist: artists.join(", "),
      previewUrl: t.preview_url || null,    // ✅ for browser fallback
      uri: t.uri || null,                   // ✅ for Spotify Connect
    };
  }

  const HARDCODED_TRACKS = [
    { id: "t1",  title: "Billie Jean",             artist: "Michael Jackson" },
    { id: "t2",  title: "Smells Like Teen Spirit", artist: "Nirvana" },
    { id: "t3",  title: "One More Time",           artist: "Daft Punk" },
    { id: "t4",  title: "Dancing Queen",           artist: "ABBA" },
    { id: "t5",  title: "Blinding Lights",         artist: "The Weeknd" },
    { id: "t6",  title: "Shake It Off",            artist: "Taylor Swift" },
    { id: "t7",  title: "Hey Ya!",                 artist: "OutKast" },
    { id: "t8",  title: "HUMBLE.",                 artist: "Kendrick Lamar" },
    { id: "t9",  title: "Poker Face",              artist: "Lady Gaga" },
    { id: "t10", title: "Take On Me",              artist: "a-ha" },
  ];

  const token = await getAccessToken();
  if (!token) {
    return HARDCODED_TRACKS; // no login yet; keeps your old behavior
  }

  // low-level: one page from the playlist (ensure getPlaylistData fields include id, uri, preview_url)
  const raw = await getPlaylistData(token, playlistID);   // -> array of raw track objects

  // normalize + de-dup by id
  const seen = new Set();
  const normalized = [];
  for (const t of raw) {
    const gt = toGameTrack(t);
    if (gt && !seen.has(gt.id)) {
      seen.add(gt.id);
      normalized.push(gt);
    }
  }

  // randomize BEFORE slice (as you noted)
  shuffle(normalized);

  // clamp to n and return
  return normalized.slice(0, n);
}


// example
// Provide at least { id, title, artist, previewUrl? }.
/*
const HARDCODED_TRACKS = [
    { id: "t1",  title: "Billie Jean",                 artist: "Michael Jackson" },
    { id: "t2",  title: "Smells Like Teen Spirit",     artist: "Nirvana" },
    { id: "t3",  title: "One More Time",               artist: "Daft Punk" },
    { id: "t4",  title: "Dancing Queen",               artist: "ABBA" },
    { id: "t5",  title: "Blinding Lights",             artist: "The Weeknd" },
    { id: "t6",  title: "Shake It Off",                artist: "Taylor Swift" },
    { id: "t7",  title: "Hey Ya!",                     artist: "OutKast" },
    { id: "t8",  title: "HUMBLE.",                     artist: "Kendrick Lamar" },
    { id: "t9",  title: "Poker Face",                  artist: "Lady Gaga" },
    { id: "t10", title: "Take On Me",                  artist: "a-ha" },
  ];*/
