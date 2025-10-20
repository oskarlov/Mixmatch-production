import { getPlaylistData, getAccessToken } from "./spotifyAuth.js";


export async function makeTrackList(playlistID, n) {
    // Shuffle to get n amount of random tracks from the list
    function shuffle(a) {
        for (let i = a.length - 1; i > 0; i--) {
          const j = (Math.random() * (i + 1)) | 0;
          [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    // Saves the correct track info
    function saveCorrectInfoCB(trackObject, i) {
        return {
            id: trackObject.id,// `t${i+1}`,
            title: trackObject.name,
            artist: trackObject.artists[0].name,
            previewUrl: trackObject.preview_url || null,
            uri: trackObject.uri || null,
        };
    }
    // fixa refresh token istället för hårdkodade tracks
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
    ];

    const token = await getAccessToken();
    console.log(token);
    if (!token) {
        return HARDCODED_TRACKS;
    }
    const dataPL = await getPlaylistData(token, playlistID);
    // console.log(dataPL);
    // lägg till randomize innan slice
    const tracks = shuffle(dataPL).slice(0, n).map(saveCorrectInfoCB);
    // console.log(tracks);
    return tracks;
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