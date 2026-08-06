import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../public/visual/index.html", import.meta.url), "utf8");
const js = await readFile(new URL("../public/visual/visual.js", import.meta.url), "utf8");
const css = await readFile(new URL("../public/visual/luminarium.css", import.meta.url), "utf8");
const rooms = await readFile(new URL("../public/shared/rooms.js", import.meta.url), "utf8");
const doors = await readFile(new URL("../app/components/RoomDoors.tsx", import.meta.url), "utf8");
const music = await readFile(new URL("../app/music/page.tsx", import.meta.url), "utf8");

assert.match(html, /<title>The Luminarium \| Plumbmonkey<\/title>/);
assert.match(html, /luminarium\.css/);
assert.match(rooms, /label: "Luminarium"/);
assert.match(doors, /name: "The Luminarium"/);
assert.match(music, /Enter The Luminarium/);

const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(ids).size, ids.length, "The Luminarium HTML must not contain duplicate IDs");

const literalIdReferences = [...js.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)].map(match => match[1]);
const missingIds = [...new Set(literalIdReferences)].filter(id => !ids.includes(id));
assert.deepEqual(missingIds, [], `Missing HTML IDs referenced by visual.js: ${missingIds.join(", ")}`);

for (const group of ["explore", "shape", "sequence", "export"]) {
  assert.match(html, new RegExp(`data-console-tab="${group}"`));
  assert.match(html, new RegExp(`data-panel-group="${group}"`));
}

for (const dimension of ["1920,1080", "1080,1920", "1080,1080", "1080,1350"]) {
  assert.ok(js.includes(dimension), `Missing fixed high-quality output mapping ${dimension}`);
}

assert.match(js, /version:3/);
assert.match(js, /luminariumSession/);
assert.match(js, /lightLabSession/); // Required legacy migration fallback.
assert.match(js, /setOutputSize\(recordingSize\.width, recordingSize\.height\)/);
assert.match(css, /body\.controls-open \.inspector/);

new Function(js);
console.log("The Luminarium source checks passed");
