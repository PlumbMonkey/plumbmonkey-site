// ============================================================
// SPECTRAL MANOR REVENGER — sectors, world geometry, seeded rules RNG
// Load order: sectors.js → fx.js → ship.js → enemies.js → bosses.js → render.js → game.js
// ============================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;
const WORLD_W = W * 4;
const HUD_H = 46;                 // in-canvas HUD band; flight ceiling sits under it
const WAVES_PER_SECTOR = 4;       // three waves, then the mothership

function wrapX(x) { return ((x % WORLD_W) + WORLD_W) % WORLD_W; }
// shortest signed distance a→b around the wrap
function wrapDX(b, a) {
  let d = (b - a) % WORLD_W;
  if (d > WORLD_W / 2) d -= WORLD_W;
  if (d < -WORLD_W / 2) d += WORLD_W;
  return d;
}

// Rules draw from this seeded generator only; effects use Math.random, so
// explosions can never change how a run plays out.
let rngState = 1;
function seedRng(s) { rngState = (s >>> 0) || 1; }
function rng() {
  rngState = (rngState + 0x6D2B79F5) >>> 0;
  let t = rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const rrange = (a, b) => a + rng() * (b - a);

/* Each sector: a backdrop theme, a terrain line (whole sine cycles per world
   lap, so it never seams at the wrap), three waves and a mothership boss.
   Wave fields: landers abduct fans, bombers lay mines, pods split into
   swarmers, carriers always drop a power-up. */
const SECTORS = [
  {
    id: 'grounds', name: 'CONCERT GROUNDS', accent: '#c084fc',
    terrain: { base: H - 40, waves: [[3, 9, 0.2], [11, 4, 1.3]] },
    waves: [
      { landers: 7, bombers: 0, pods: 0, carriers: 1 },
      { landers: 9, bombers: 1, pods: 0, carriers: 0 },
      { landers: 10, bombers: 2, pods: 1, carriers: 1 }
    ],
    boss: { type: 'harvester', escort: { landers: 2 } }
  },
  {
    id: 'graveyard', name: 'GRAVEYARD HILLS', accent: '#5eead4',
    terrain: { base: H - 46, waves: [[4, 16, 0.7], [13, 6, 2.1]] },
    waves: [
      { landers: 9, bombers: 2, pods: 0, carriers: 1 },
      { landers: 10, bombers: 3, pods: 1, carriers: 0 },
      { landers: 11, bombers: 3, pods: 2, carriers: 1 }
    ],
    boss: { type: 'ossuary', escort: { bombers: 1 } }
  },
  {
    id: 'storm', name: 'STORM COAST', accent: '#7dd3fc',
    terrain: { base: H - 44, waves: [[2, 12, 1.1], [7, 10, 0.4], [19, 3, 2.6]] },
    waves: [
      { landers: 10, bombers: 2, pods: 1, carriers: 1 },
      { landers: 11, bombers: 3, pods: 2, carriers: 0 },
      { landers: 12, bombers: 4, pods: 2, carriers: 1 }
    ],
    boss: { type: 'leviathan', escort: { pods: 1 } }
  },
  {
    id: 'neon', name: 'NEON CITY', accent: '#f472b6',
    terrain: { base: H - 42, waves: [[5, 5, 0.9], [16, 3, 0.1]] },
    waves: [
      { landers: 11, bombers: 3, pods: 2, carriers: 1 },
      { landers: 12, bombers: 4, pods: 3, carriers: 0 },
      { landers: 14, bombers: 4, pods: 3, carriers: 1 }
    ],
    boss: { type: 'dreadnought', escort: { landers: 2, bombers: 1 } }
  }
];

// stage n (0-based) → which sector, which wave, which cycle
function stageInfo(n) {
  const cycle = Math.floor(n / (SECTORS.length * WAVES_PER_SECTOR));
  const sectorIdx = Math.floor(n / WAVES_PER_SECTOR) % SECTORS.length;
  const wave = n % WAVES_PER_SECTOR;
  const sector = SECTORS[sectorIdx];
  const isBoss = wave === WAVES_PER_SECTOR - 1;
  return {
    n, cycle, sectorIdx, wave, sector, isBoss,
    mult: 1 + cycle * 0.25,
    def: isBoss ? sector.boss.escort : sector.waves[wave],
    label: `${sectorIdx + 1}-${isBoss ? 'M' : wave + 1}`
  };
}

function terrainAt(sector, x) {
  const t = sector.terrain;
  let y = t.base;
  for (const [cycles, amp, ph] of t.waves) y -= Math.sin((x / WORLD_W) * Math.PI * 2 * cycles + ph) * amp;
  return y;
}

if (typeof module !== 'undefined' && module.exports) module.exports = { SECTORS, stageInfo, terrainAt };
