/**
 * Drift guard for the arcade game list.
 *
 * The list lives in three places that cannot import each other:
 *   · public/arcade/games/leaderboard.js  — a plain script the games load
 *   · app/arcade/ArcadeRoom.tsx           — the arcade page's cabinets
 *   · workers/plumbmonkey-api/src/index.js — which games may post a global score
 *
 * A game missing from the Worker would look fine locally and then have every
 * score refused as "bad-game" on the live site, so the three must cover exactly
 * the same slugs. Run via `npm test`.
 */
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

function slugs(path, start, end, pattern) {
  const text = read(path);
  const from = text.indexOf(start);
  if (from < 0) throw new Error(`${path}: could not find ${start}`);
  const block = text.slice(from + start.length, text.indexOf(end, from));
  return [...block.matchAll(pattern)].map((m) => m[1]).sort();
}

const lists = {
  "leaderboard.js": slugs("public/arcade/games/leaderboard.js", "const GAMES = [", "];", /slug:\s*'([^']+)'/g),
  "ArcadeRoom.tsx": slugs("app/arcade/ArcadeRoom.tsx", "const GAMES = [", "];", /slug:\s*"([^"]+)"/g),
  "plumbmonkey-api": slugs("workers/plumbmonkey-api/src/index.js", "const GAMES = new Set([", "]);", /'([^']+)'/g),
};

const [base, ...rest] = Object.keys(lists);
const problems = [];
if (!lists[base].length) problems.push(`${base}: no games found`);
for (const name of rest) {
  const missing = lists[base].filter((s) => !lists[name].includes(s));
  const extra = lists[name].filter((s) => !lists[base].includes(s));
  if (missing.length) problems.push(`${name} is missing: ${missing.join(", ")}`);
  if (extra.length) problems.push(`${name} has games ${base} does not: ${extra.join(", ")}`);
}

if (problems.length) {
  console.error("Arcade game lists have drifted:\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log(`arcade game lists agree (${lists[base].length} games)`);
