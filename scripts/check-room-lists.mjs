/**
 * Drift guard for the room list.
 *
 * public/shared/rooms.js is the single source of truth, and NavBar.tsx,
 * site-nav.js and room-menu.js all read it directly — those cannot drift.
 *
 * RoomDoors.tsx is the exception: it is the home page's feature grid, so it
 * carries its own presentation data (longer display names like "The Arcade",
 * numbering, taglines, descriptions, gradient colours) that the navs have no
 * use for. It cannot simply import the list. What it MUST NOT do is cover a
 * different set of rooms — a room added to the nav but missing from the home
 * page (or vice versa) is exactly the kind of silent inconsistency that put
 * "Sound Stage" and "Music Sandbox" on the same site at the same time.
 *
 * This asserts the two cover the same hrefs. Run via `npm test`.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { ROOMS, CTA } = require("../public/shared/rooms.js");

const problems = [];

// ---- 1. the canonical list itself is well formed ----
if (!Array.isArray(ROOMS) || ROOMS.length === 0) {
  problems.push("rooms.js exports no ROOMS array");
}
for (const room of ROOMS ?? []) {
  if (!room.href || !room.label) problems.push(`malformed room entry: ${JSON.stringify(room)}`);
}
if (!CTA?.href || !CTA?.label) problems.push("rooms.js exports no usable CTA");

const dupes = ROOMS.map((r) => r.href).filter((h, i, a) => a.indexOf(h) !== i);
if (dupes.length) problems.push(`duplicate hrefs in rooms.js: ${dupes.join(", ")}`);

// ---- 2. RoomDoors covers exactly the same rooms ----
const doors = readFileSync(new URL("../app/components/RoomDoors.tsx", import.meta.url), "utf8");
const doorHrefs = [...doors.matchAll(/href:\s*"([^"]+)"/g)].map((m) => m[1]);

const canonical = new Set(ROOMS.map((r) => r.href));
const inDoors = new Set(doorHrefs);

for (const href of canonical) {
  if (!inDoors.has(href)) problems.push(`RoomDoors.tsx is missing room: ${href}`);
}
for (const href of inDoors) {
  if (!canonical.has(href)) problems.push(`RoomDoors.tsx has a room not in rooms.js: ${href}`);
}

// ---- 3. nothing still hard-codes its own copy ----
const consumers = {
  "app/components/NavBar.tsx": /public\/shared\/rooms/,
  "public/shared/site-nav.js": /window\.PM_ROOMS/,
  "public/shared/room-menu.js": /window\.PM_ROOMS/,
};
for (const [file, mustMatch] of Object.entries(consumers)) {
  const src = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  if (!mustMatch.test(src)) {
    problems.push(`${file} no longer reads the canonical list (expected ${mustMatch})`);
  }
  if (/\{\s*href:\s*"\/arcade"\s*,\s*label:/.test(src)) {
    problems.push(`${file} has re-introduced its own copy of the room list`);
  }
}

if (problems.length) {
  console.error("Room list check FAILED:");
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}
console.log(`Room list OK — ${ROOMS.length} rooms, single source, RoomDoors in sync.`);
