import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const manifest = JSON.parse(readFileSync(join(root, "public", "examples", "release-manifest.json"), "utf8"));
assert.equal(manifest.version, "0.8.1");
const required = [
  join(root, "out", "natural-media-lab.html"),
  ...manifest.examples.map((path) => join(root, "out", ...path.split("/").filter(Boolean))),
];
for (const path of required) {
  assert.ok(existsSync(path), `Missing release artifact: ${path}`);
  assert.ok(statSync(path).size > 100, `Release artifact is unexpectedly small: ${path}`);
}
const html = readFileSync(required[0], "utf8");
assert.match(html, /Natural Media Lab/);
assert.match(html, /_next\/static/);
console.log(`Natural Media Lab ${manifest.version}: static release package passed.`);
