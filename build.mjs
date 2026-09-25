#!/usr/bin/env node
/**
 * record-table / build.mjs
 *
 * Turns music sources into `table.json`, the data file the board reads.
 *
 *   node build.mjs artist "https://open.spotify.com/artist/4Z8W..."
 *   node build.mjs artist "Radiohead" --neighbours
 *   node build.mjs mix "In Rainbows" "Back To Black" "spotify:album:0bPQ..."
 *
 * Flags
 *   --neighbours   fill the empty slots with similar artists (ListenBrainz)
 *   --slots N      how many objects the board holds (default 12)
 *   --out FILE     output path (default table.json)
 *   --title "..."  board title, for `mix` (default "A mix")
 *
 * Credentials: SPOTIFY_ID and SPOTIFY_SECRET_KEY, from the environment or from
 * a .env file in the working directory. Create them at
 * developer.spotify.com/dashboard, it is free and takes two minutes. Only the
 * Client Credentials flow is used, so no user ever logs in.
 *
 * Similar artists come from MusicBrainz + ListenBrainz, which need no key.
 */

import fs from "node:fs";

const UA = "record-table/0.1 (https://github.com/inhabitants/record-table)";

/* ---------------------------------------------------------------- args --- */
const argv = process.argv.slice(2);
const mode = argv[0];
const flag = (name, fallback = null) => {
  const i = argv.indexOf("--" + name);
  return i === -1 ? fallback : argv[i + 1];
};
const has = (name) => argv.includes("--" + name);
const VALUED = new Set(["--slots", "--out", "--title", "--near"]);
const terms = [];
for (let i = 1; i < argv.length; i++) {
  if (VALUED.has(argv[i])) { i++; continue; }
  if (argv[i].startsWith("--")) continue;
  terms.push(argv[i]);
}

const SLOTS = Number(flag("slots", 12));  // the page picks the board that fits
const OUT = flag("out", "table.json");

if (!mode || !["artist", "mix"].includes(mode) || terms.length === 0) {
  console.error("usage: node build.mjs artist <link|name> [--neighbours]");
  console.error("       node build.mjs mix <query|link> [<query|link> ...]");
  process.exit(1);
}

/* -------------------------------------------------------------- spotify --- */
function readEnv(key) {
  if (process.env[key]) return process.env[key];
  for (const f of [".env", ".env.local"]) {
    if (!fs.existsSync(f)) continue;
    const m = fs.readFileSync(f, "utf8")
      .match(new RegExp("^" + key + '\\s*=\\s*"?([^"\\r\\n]+)"?', "m"));
    if (m) return m[1];
  }
  return null;
}

const id = readEnv("SPOTIFY_ID") || readEnv("SPOTIFY_CLIENT_ID");
const secret = readEnv("SPOTIFY_SECRET_KEY") || readEnv("SPOTIFY_CLIENT_SECRET");
if (!id || !secret) {
  console.error("missing SPOTIFY_ID / SPOTIFY_SECRET_KEY");
  console.error("");
  console.error("Create a free app at https://developer.spotify.com/dashboard");
  console.error("then either export them, or drop a .env next to this file:");
  console.error("");
  console.error("  SPOTIFY_ID=...");
  console.error("  SPOTIFY_SECRET_KEY=...");
  process.exit(1);
}

const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    Authorization: "Basic " + Buffer.from(id + ":" + secret).toString("base64"),
  },
  body: "grant_type=client_credentials",
});
const token = (await tokenRes.json()).access_token;
if (!token) { console.error("spotify auth failed"); process.exit(1); }
const AUTH = { Authorization: "Bearer " + token };

const api = async (path) => {
  const r = await fetch("https://api.spotify.com/v1" + path, { headers: AUTH });
  if (!r.ok) return { __status: r.status };
  return r.json();
};

/* Album listing caps at limit=10 on this endpoint. Asking for more returns
   400 "Invalid limit", so paginate with offset instead of raising the limit. */
async function albumsOf(artistId, want = 12) {
  const out = [];
  for (let offset = 0; offset < want + 10 && out.length < want; offset += 10) {
    const page = await api(
      `/artists/${artistId}/albums?include_groups=album,single&limit=10&offset=${offset}`);
    if (!page.items?.length) break;
    out.push(...page.items);
    if (!page.next) break;
  }
  return out;
}

/* A discography lists every reissue and deluxe edition of the same record.
   Collapsing on the name before the first bracket keeps one per title. */
function dedupe(items) {
  const seen = new Set();
  return items.filter((i) => {
    const key = i.name.toLowerCase().replace(/\s*[([].*$/, "").trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const asDisc = (album, artistName) => ({
  kind: "album",
  id: album.id,
  title: album.name,
  artist: artistName ?? album.artists?.[0]?.name ?? "",
  year: Number((album.release_date || "").slice(0, 4)) || null,
  cover: album.images?.[0]?.url || null,
  tracks: album.total_tracks ?? null,
  embed: `https://open.spotify.com/embed/album/${album.id}`,
  open: album.external_urls?.spotify || null,
});

async function resolveArtist(input) {
  const m = String(input).match(/(artist|album|track)[/:]([A-Za-z0-9]{22})/);
  if (m?.[1] === "artist") return api("/artists/" + m[2]);
  if (m?.[1] === "album") {
    const a = await api("/albums/" + m[2]);
    return api("/artists/" + a.artists?.[0]?.id);
  }
  if (m?.[1] === "track") {
    const t = await api("/tracks/" + m[2]);
    return api("/artists/" + t.artists?.[0]?.id);
  }
  const s = await api(`/search?q=${encodeURIComponent(input)}&type=artist&limit=1`);
  const found = s.artists?.items?.[0];
  return found ? api("/artists/" + found.id) : null;
}

/* ------------------------------------------------- neighbours (no keys) --- */
/* Spotify's own related-artists and top-tracks endpoints answer 403 for apps
   that are not approved for extended quota, and an artist's `genres` come back
   empty on the same apps. MusicBrainz and ListenBrainz are open, need no key,
   and answer the same question, so the neighbour lookup goes through them. */
async function neighboursOf(name, want, seeds = []) {
  /* Explicit seeds win: a brand new artist has no MusicBrainz entry, and the
     person already knows who they sound like. --near "A,B" says it out loud. */
  if (seeds.length) {
    /* One queue per seed, then take one from each in turn: three names must
       read as three neighbours, not as the first one filling the whole table. */
    const queues = [];
    for (const seed of seeds) {
      const artist = await resolveArtist(seed);
      if (!artist?.id) { console.warn("  neighbour not found:", seed); continue; }
      const albums = dedupe(await albumsOf(artist.id, want))
        .filter((a) => a.images?.[0]?.url)
        .map((a) => ({ ...asDisc(a, artist.name), kind: "neighbour" }));
      if (albums.length) queues.push(albums);
    }
    const picked = [];
    for (let round = 0; picked.length < want && queues.some((q) => q[round]); round++) {
      for (const q of queues) {
        if (picked.length >= want) break;
        if (q[round]) picked.push(q[round]);
      }
    }
    if (picked.length) return picked;
  }
  try {
    const mb = await (await fetch(
      `https://musicbrainz.org/ws/2/artist?query=${encodeURIComponent(name)}&fmt=json&limit=1`,
      { headers: { "User-Agent": UA } })).json();
    const mbid = mb.artists?.[0]?.id;
    if (!mbid) return [];

    const algo = "session_based_days_7500_session_300_contribution_5_threshold_10_limit_100_filter_True_skip_30";
    const res = await fetch(
      `https://labs.api.listenbrainz.org/similar-artists/json?artist_mbids=${mbid}&algorithm=${algo}`);
    if (!res.ok) return [];
    const list = await res.json();
    const names = (Array.isArray(list) ? list : [])
      .map((x) => x.name).filter(Boolean)
      .filter((n) => n.toLowerCase() !== name.toLowerCase());

    const picked = [];
    for (const n of names) {
      if (picked.length >= want) break;
      const artist = await resolveArtist(n);
      if (!artist?.id) continue;
      const albums = dedupe(await albumsOf(artist.id, 3));
      const best = albums.find((a) => a.images?.[0]?.url);
      if (!best) continue;
      picked.push({ ...asDisc(best, artist.name), kind: "neighbour" });
    }
    return picked;
  } catch {
    return [];
  }
}

/* ----------------------------------------------------------------- run --- */
let owner = null;
let discs = [];

if (mode === "artist") {
  const artist = await resolveArtist(terms[0]);
  if (!artist?.id) { console.error("artist not found"); process.exit(1); }
  owner = { name: artist.name, photo: artist.images?.[0]?.url || null,
            open: artist.external_urls?.spotify || null };
  discs = dedupe(await albumsOf(artist.id, SLOTS)).map((a) => asDisc(a, artist.name));

  const seeds = (flag("near", "") || "").split(",").map((x) => x.trim()).filter(Boolean);
  if ((has("neighbours") || seeds.length) && discs.length < SLOTS) {
    const near = await neighboursOf(artist.name, SLOTS - discs.length, seeds);
    if (!near.length) {
      console.warn("  no neighbours found: this artist is not in MusicBrainz yet.");
      console.warn('  name them yourself with --near \"Artist A,Artist B\"');
    }
    discs = [...discs, ...near];
  }
} else {
  owner = { name: flag("title", "A mix"), photo: null, open: null };
  for (const term of terms) {
    if (discs.length >= SLOTS) break;
    const m = String(term).match(/album[/:]([A-Za-z0-9]{22})/);
    const album = m
      ? await api("/albums/" + m[1])
      : (await api(`/search?q=${encodeURIComponent(term)}&type=album&limit=1`)).albums?.items?.[0];
    if (!album?.id) { console.warn("  skipped, not found:", term); continue; }
    discs.push(asDisc(album));
  }
}

discs = discs.slice(0, SLOTS);
fs.writeFileSync(OUT, JSON.stringify({ owner, discs }, null, 2));

console.log(`${owner.name} | ${discs.length} of ${SLOTS} slots -> ${OUT}`);
for (const d of discs) {
  console.log(`  ${d.kind === "neighbour" ? "~" : " "} ${d.artist} - ${d.title}` +
              `${d.year ? " (" + d.year + ")" : ""}${d.cover ? "" : "  NO COVER"}`);
}
