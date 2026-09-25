#!/usr/bin/env node
/**
 * record-table / bundle.mjs
 *
 * Folds table.html + table.json + the one board photo it needs into a single
 * self-contained HTML file.
 *
 *   node bundle.mjs                    -> dist/index.html
 *   node bundle.mjs --data other.json --out dist/other.html
 *
 * Why this exists: an unbundled page fetches its data, and fetching a local
 * file is exactly what file:// forbids, so it needs a server to be looked at
 * at all. The bundled one opens on a double click, attaches to an email, and
 * uploads anywhere that takes static files. The cover art stays as remote
 * URLs, since it already lives on a CDN and is not ours to copy.
 */

import fs from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const flag = (n, d = null) => { const i = argv.indexOf("--" + n); return i === -1 ? d : argv[i + 1]; };

const HTML = flag("html", "table.html");
const DATA = flag("data", "table.json");
const OUT  = flag("out",  path.join("dist", "index.html"));

for (const f of [HTML, DATA]) {
  if (fs.existsSync(f)) continue;
  console.error(`missing ${f}`);
  if (f === DATA) console.error('run: node build.mjs artist "<name or link>"');
  process.exit(1);
}

const html = fs.readFileSync(HTML, "utf8");
const data = JSON.parse(fs.readFileSync(DATA, "utf8"));

/* The page picks its board by how many records there are, so the bundle only
   has to carry that one photo. Keep this rule and the one in table.html in
   step: shipping the wrong board is a blank table. */
const MESSY_SLOTS = 5;
const board = (data.discs?.length || 0) > MESSY_SLOTS ? "board.webp" : "board-messy.webp";
if (!fs.existsSync(board)) { console.error(`missing ${board}`); process.exit(1); }

const b64 = fs.readFileSync(board).toString("base64");
const inlineBoards = { [board]: `data:image/webp;base64,${b64}` };

/* </script> inside JSON would close the tag early and spill the data into the
   document as markup. Breaking the sequence is the whole fix. */
const safeJson = JSON.stringify(data).replace(/<\//g, "<\\/");

const injected =
  `<script id="table-data" type="application/json">${safeJson}</script>\n` +
  `<script>window.__INLINE_BOARDS=${JSON.stringify(inlineBoards).replace(/<\//g, "<\\/")}</script>\n`;

const out = html.replace("<body>", "<body>\n" + injected);
if (out === html) { console.error("could not find <body> in " + HTML); process.exit(1); }

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, out);

const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
console.log(`${OUT}  ${kb} KB  (${data.owner?.name ?? "table"}, ${data.discs?.length ?? 0} records, ${board})`);
console.log("");
console.log("Open it by double clicking. To put it online, any of:");
console.log("  npx surge dist/                       # asks for an email, gives you a link");
console.log("  drag the dist folder onto app.netlify.com/drop");
console.log("  npx vercel deploy --prod dist/");
console.log("  gh repo create <name> --public --source=dist  # then enable Pages");
