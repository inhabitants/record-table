---
name: record-table
description: Turn a music catalogue into a photographic table of records that can be picked up and played. Use when someone wants a shareable page for an artist, a label, a personal shelf or a mixtape, or when they ask for a browsable interface that looks like real objects on a real surface instead of a grid of cards.
---

# Record Table

Build a page that looks like a photograph of records lying on a wooden table.
Hovering lifts a sleeve a few pixels. Clicking makes it fly off the table, turn
in 3D and open as an editorial card with a working Spotify player.

The whole point is that **the scene is a real photograph and it does not move.**
Every temptation to animate the background, tilt the table on scroll or float
the sleeves is the temptation to destroy the illusion. The only motion at rest
is the seven pixels a sleeve rises when the pointer reaches it.

## The idea worth stealing: the photograph is the board

Most "3D shelf" interfaces draw the furniture in CSS or WebGL, and it always
looks drawn. This one inverts it:

1. Generate **one photograph** of *blank* cardboard record sleeves lying on a
   table, each with its own black record slid halfway out. Blank is the whole
   trick. The photo is not an illustration, it is a **board** with known
   coordinates.
2. Lay the real cover art on top of each blank sleeve.
3. Take the photograph's own texture and put it **back over** the new art,
   twice, so the art is sealed into the board instead of floating on it.

Step 3 is the one that matters, and one pass is not enough. A single overlay
still reads as a transparency laid on top. A print mockup needs both halves of
the photograph:

```css
/* 1. the dark half comes DOWN onto the art:
      crease, foxing, ring wear, the shadow the light already casts */
.grain{
  background-image: var(--board);   /* the same photo, */
  background-size: var(--bs);       /* cropped to this one sleeve */
  background-position: var(--bp);
  mix-blend-mode: multiply;
  filter: brightness(1.30) contrast(.88);
  opacity: .70;
}
/* 2. the light half goes back UP over the ink: the pale paper fibre and the
      sheen of the board. Ink does not hide the grain of the paper it sits on.
      Crush it hard, or the mid tones wash out any dark artwork and leave a
      pale rectangle hovering in the middle of the sleeve. */
.fibre{
  background-image: var(--board);
  background-size: var(--bs);
  background-position: var(--bp);
  mix-blend-mode: screen;
  filter: brightness(.20) contrast(2) saturate(.4);
  opacity: .45;
}
/* 3. and the art itself gives up the black and the white it cannot hold:
      ink on kraft board is never as clean as a screen */
.art{ filter: saturate(.90) contrast(.94) brightness(1.03); }
```

The last giveaway is the trim. A hard rectangular edge is a decal; real ink
dies into the paper. Every printed layer gets the same soft mask, so they end
together:

```css
mask-image:
  linear-gradient(to right,  transparent 0, #000 1.4%, #000 98.6%, transparent 100%),
  linear-gradient(to bottom, transparent 0, #000 1.4%, #000 98.6%, transparent 100%);
mask-composite: intersect;
```

What CSS cannot do is displacement: the art will not bend along a dent in the
cardboard the way it would in Photoshop. Keeping the sleeves reasonably flat in
the photograph is how you avoid needing it.

The same percentage-sprite trick makes the hotspots invisible at rest: each
clickable region is a crop of the photograph itself, so it sits flush with the
background until it lifts.

**Give every sleeve its own record, half out.** A bare square of art on wood
reads as a poster; a square with a black disc emerging behind it reads as an
album, instantly, before anyone has read a word. The slot covers the cardboard
only, so lifting a sleeve leaves its disc on the table, which is what pulling a
sleeve out of a stack actually does.

Because the board is generated once and the content is data, adding a record
costs nothing. One photo serves every artist you will ever render.

## Run it

Three files matter: `build.mjs` (fetch), `table.html` (render), `board.webp`
(the photograph). Everything is static, no server, no framework, no build step.

**1. Get Spotify credentials.** Create an app at
`developer.spotify.com/dashboard`. Free, about two minutes. Copy the Client ID
and Client Secret into your environment or a `.env` next to `build.mjs`:

```
SPOTIFY_ID=...
SPOTIFY_SECRET_KEY=...
```

Only the Client Credentials flow is used. Nobody logs in, not you and not your
visitors, and no scope is requested.

**2. Build the data.** Three shapes, pick one:

```bash
# an artist's discography, newest first
node build.mjs artist "https://open.spotify.com/artist/4Z8W4fKeB5YxbusRsdQVPb"
node build.mjs artist "Radiohead"

# a small artist, with the empty slots filled by nearby artists
node build.mjs artist "https://open.spotify.com/artist/..." --neighbours

# ...or by the neighbours you name yourself, which is what a new artist needs
node build.mjs artist "My Band" --near "Portishead,Massive Attack,Björk"

# your own table, curated record by record
node build.mjs mix "In Rainbows" "Back To Black" "Blue Joni Mitchell" \
  "Voodoo D'Angelo" "Clube da Esquina" --title "A Sunday night"
```

It writes `table.json`. Useful flags: `--slots N` (default 12), `--out FILE`,
`--title "..."` for a mix.

**3. Bundle it, and hand over the file.**

```bash
node bundle.mjs            # -> dist/index.html, about 300 KB
```

That single file carries its own data and its own photograph as a `data:` URI,
so it **opens on a double click**, goes through email or a chat message, and
uploads anywhere that takes static files. Nothing has to sit next to it.

This step is not a nicety, it is what makes the thing usable by the person who
asked for it. Unbundled, the page fetches `table.json`, and fetching a local
file is exactly what `file://` forbids, so it cannot even be looked at without
a server. Finish the job: run the bundle and give them the file or a link, not
a folder and an instruction to install Node.

To put it online, any of these, no account needed up front for the first:

```bash
npx surge dist/                  # asks for an email, hands you a link
npx vercel deploy --prod dist/
# or drag the dist folder onto app.netlify.com/drop
```

While you are still adjusting the board, skip bundling: serve the folder
(`npx serve .`) and open `table.html` directly, which reloads without a build
step. Bundle once at the end.

Query parameters on the unbundled page, all optional:

| | |
|---|---|
| `?data=other.json` | load a different table, so one deploy holds many |
| `?board=grid` | the tidy 4x3 board instead of the default messy one |
| `?calibrate=1` | draw the slots over the photo, for measuring a new board |

## Two boards ship with this

**`board-messy.webp` is the default, and it is the better one.** Five sleeves
at loose angles, scattered unevenly, each with its own record halfway out, and
the clutter of an afternoon of listening filling the gaps: a cold mug of
coffee, tangled headphones, a cassette, a lighter, reading glasses, a
newspaper, a book face down, guitar picks. It exists because most artists do
not have twelve records, and a tidy grid with five empty squares reads as a
bug. Clutter reads as a table.

**`board.webp`** is a strict 4x3 grid of twelve. Use it for a full
discography, a label, or a year-end list, where the regularity is the point.

Fewer records than slots is fine either way: the middle fills first and the
leftover sleeves stay blank cardboard among the mess.

## Make your own board

To change the surface, the count or the mood, generate a new photo and
re-measure the slots.

The prompt that produced this one. The instruction that carries the most weight
is *blank*: an image model will happily invent cover art unless it is told not
to, several times, in several ways.

```
Full-bleed overhead flat-lay photograph, camera perfectly perpendicular to a
worn dark oak tabletop, the wood filling the entire frame edge to edge. On it
lie twelve completely BLANK 12-inch record sleeves made of plain unprinted
kraft cardboard, pale warm grey-beige, with absolutely no artwork, no text, no
logos, no printing of any kind on them, just bare cardboard surface. They are
laid out in a strict evenly spaced four by three grid, equal gutters of bare
wood between them, the whole grid centred with a narrow even margin of wood
around the outside. Each blank sleeve is rotated only very slightly, no more
than three degrees, so the grid still reads as regular. Five of the sleeves
have a glossy black vinyl record slid halfway out to the right, the grooves
catching the light in fine concentric rings, a plain cream centre label.
Physical realism on the cardboard: soft circular ring wear pressed into the
surface, bumped and softened corners, faint foxing and age spots, a thin white
paper inner sleeve peeking out of two of them. The oak underneath is scratched
and dusty with visible grain and a faint coffee ring. Warm natural window light
raking in from the upper left, long soft shadows falling down and to the right
of every sleeve, gentle falloff into the corners. Shot on medium format film,
sharp across the frame, fine grain, natural colour, no people, no hands.
```

Engines, best first. Any of them works; they differ in how well they hold
"blank" and how convincing the paper wear is:

| Engine | Notes |
|---|---|
| GPT Image (high quality) | what produced `board.webp`; holds "blank" best, most convincing wear |
| Seedream 5.0 | close second, cheaper, slightly glossier paper |
| Gemini 3 Pro Image | good light, sometimes prints faint marks on the "blank" sleeves |
| FLUX.1 | needs the word *blank* repeated again at the end of the prompt |
| A real photo | twelve blank sleeves and a phone on a tripod beats all of the above |

For a messy board, the same prompt with the grid instruction replaced by:

```
...scattered at loose irregular angles, tilted up to twelve degrees each and at
uneven distances. EVERY SINGLE ONE of the sleeves has its own glossy black
vinyl record slid halfway out of it, so that each sleeve and its record read as
one object, each disc showing about half of its circle beyond the cardboard
edge, the grooves catching the light in fine concentric rings, plain cream
centre labels. The sleeve-and-record pairs never overlap or touch each other,
each pair sits completely alone with bare wood all around it, generously spaced
apart. Filling the gaps between them, the clutter of someone who has been
listening all afternoon: a chipped mug with cold coffee and a dark ring,
tangled headphones, a cassette tape, a brass lighter, folded reading glasses, a
newspaper page, a book lying face down, a few guitar picks, breadcrumbs.
```

Three instructions there are load-bearing.

**EVERY SINGLE ONE has its record half out.** Ask for loose records lying
around instead and the model will happily scatter discs across the wood, which
looks great and is wrong: the sleeves are then bare squares, and once the art
lands on them they read as posters. The pairing is the thing.

**NONE overlapping.** A sleeve half under another cannot be lifted on its own,
because its crop would carry a piece of its neighbour up with it.

**Twelve degrees.** Past roughly twenty, an axis-aligned crop starts dragging
in too much wood at the corners.

Then measure. Open the image at full size, read the pixel box of each sleeve,
and convert to percentages of the image (`x/width*100`, `y/height*100`). Add a
board to `BOARDS` in `table.html`, each slot as
`[left, top, width, height, rotation]`. Load with `?calibrate=1` to see the
slots drawn over the photo, nudge, reload, look again. A regular grid means you
can compute most of it instead of measuring each one. Keep the camera dead
overhead: real perspective on the sleeves would need a quad transform rather
than the plain rotation this uses.

**The art must cover the whole sleeve.** `inset: 0.8%`, no more, so the only
cardboard left showing is the thickness of the edge. It is tempting to leave a
generous margin and call it the border of a printed sleeve, and it is wrong:
the moment a band of bare board is visible around the art, the eye reads two
objects, a photograph laid on a piece of cardboard. Nobody prints a cover that
way. The blank board is the substrate, and a substrate is never seen.

Which means the measurement has to be right, and the way to get it right is to
let the photograph tell you. The board is pale desaturated cardboard on
saturated wood, so it separates cleanly:

```js
const sat = max ? (max - min) / max : 0;
const lum = 0.299*r + 0.587*g + 0.114*b;
if (sat < 0.34 && lum > 100) mask[p] = 1;   // board yes, wood no, even in sunlight
```

Then flood fill for the blobs, and take the angle from **second-order moments**
rather than from the four extreme pixels:

```js
let deg = 0.5 * Math.atan2(2*u11, u20 - u02) * 180 / Math.PI;
while (deg >  45) deg -= 90;      // a square repeats every 90°
while (deg < -45) deg += 90;
const L = Math.sqrt(n) + 2*erosionRadius;   // area of a square, plus what erosion ate
```

Moments use the whole blob, so a bit of noise stuck to one corner barely moves
the answer, while a single extreme pixel would swing it by twenty degrees.
Expect two or three of them to still come out wrong, where a shaft of sunlight
or a white inner sleeve fuses with the board: measure those by hand and check
the lot by drawing the reconstructed squares back over the photo.

`order` decides which slots fill first when there are fewer records than slots.
It fills the middle outward, so a five-record table still reads as a table.

## What the Spotify API will and will not do

Checked in September 2026, on an app with default (development) quota:

- `GET /artists/{id}/albums` works, but **`limit` above 10 returns 400**. Use
  `offset` to paginate; `build.mjs` does.
- `GET /artists/{id}/related-artists` returns **403**. So does
  `/artists/{id}/top-tracks`, and an artist's `genres` array comes back empty.
  These need extended quota now. That is why neighbours come from elsewhere.
- The **embed iframe** (`open.spotify.com/embed/album/{id}`) needs no token and
  no login. It plays a preview for anonymous visitors and the full track for
  anyone already signed in to Spotify in that browser. This is the play button.
- Album art comes back at 640x640, enough for a full-screen sleeve.

Neighbours use **MusicBrainz** (name to MBID) then **ListenBrainz**
(`similar-artists`). Both are open, need no key, and return a ranked list of a
hundred. A brand new artist has no MusicBrainz entry, so `--neighbours` finds
nothing and says so; `--near "A,B"` is the answer for them.

## Adapting it to something else

Nothing here is about music. The board is a surface with known coordinates and
the content is data. Books on a desk, tools on a workbench, photographs in a
box, dishes on a counter, seed packets in a drawer: generate the blank
substrate, measure it once, lay the real thing on top, blend the substrate back
over it. The catalogue API changes and the CSS does not.

---

Built at [Sapiens Sintéticos](https://sapiensinteticos.com), a lab for
personalised learning and prototyping, where the image engines and the render
come with the bench.
