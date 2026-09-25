# Record Table

**English** · [Português](README.pt-BR.md) · [Site](https://www.sapiensinteticos.com/record-table)

A page that looks like a photograph of records on a table. Hover lifts a
sleeve. Click and it flies off the table, turns, and opens with a working
Spotify player.

[![Helen Ailith's five records on the table](docs/table.jpg)](https://www.sapiensinteticos.com/record-table)

The fastest way to make yours: paste this into Claude, ChatGPT, Gemini, Cursor
or Codex, with your Spotify link.

```
Use sapiensinteticos.com/record-table to put my records on a table.
```

The trick is that the photograph *is* the interface. One generated photo of
**blank** cardboard sleeves becomes a board with known coordinates; real cover
art is laid on top, and then the photograph's own texture is blended back over
the art twice, `multiply` for the crease and the shadow, `screen` for the pale
paper fibre that ink never hides. One pass and it reads as a transparency laid
on top. Two and it reads as printed on that exact sleeve.

Every sleeve has its record halfway out, because a bare square of art on wood
reads as a poster and a square with a black disc behind it reads as an album.

One board serves every artist. Adding a record costs nothing.

Two boards ship with it. The default is messy: five sleeves at loose angles
with a cold mug of coffee, tangled headphones and a cassette filling the gaps,
because most artists do not have twelve records and a tidy grid with seven
empty squares reads as a bug. `?board=grid` gives you the strict 4x3 of twelve
when the discography is long enough to earn it.

## Quick start

```bash
git clone https://github.com/inhabitants/record-table
cd record-table

# 1. free Spotify app at developer.spotify.com/dashboard, then:
export SPOTIFY_ID=...  SPOTIFY_SECRET_KEY=...

# 2. build a table
node build.mjs artist "My Band" --slots 5
node build.mjs artist "My Band" --near "Portishead,Massive Attack" --slots 5
node build.mjs mix "In Rainbows" "Back To Black" "Blue Joni Mitchell" --slots 5
node build.mjs artist "Radiohead" --slots 12   # with ?board=grid

# 3. fold it into one self-contained file and open that
node bundle.mjs        # -> dist/index.html, about 300 KB
```

`dist/index.html` carries its own data and its own photograph, so it opens on a
double click, attaches to an email, and uploads anywhere that takes a static
file. No server, no build step, nothing next to it.

To put it online, any of these:

```bash
npx surge dist/                  # asks for an email, hands you a link
npx vercel deploy --prod dist/
# or drag the dist folder onto app.netlify.com/drop
```

While editing, `npx serve .` and `table.html` is the faster loop: no bundling
between changes.

The table on the site is `examples/helen-ailith.json`, and it rebuilds without
any Spotify key: `node bundle.mjs --data examples/helen-ailith.json`.

No framework, no build step, no database, nobody logs in. Three files do the
work: `build.mjs`, `table.html`, `board.webp`.

`SKILL.md` is the same thing written for an agent: hand it the raw link and say
"follow this". It carries the prompt that generates a new board, the engine
fallback list, how to re-measure the slots, and the current state of the
Spotify endpoints (`related-artists` and `top-tracks` are 403 on default quota
as of September 2026; album listing caps at `limit=10`).

## Status

Published as an artefact, not as a product: MIT, no support, no roadmap, no
promises. It is a bit scrappy on purpose. Fork it, break it, put your own
photograph under it. Issues may sit unread.

## Credits

Neighbour lookup uses [MusicBrainz](https://musicbrainz.org) and
[ListenBrainz](https://listenbrainz.org), both open and key-free. Covers,
metadata and playback come from Spotify.

Built at [Sapiens Sintéticos](https://sapiensinteticos.com), a lab for
personalised learning and prototyping.

MIT.
