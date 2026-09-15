// ============================================================
// INFESTATION — grounds, field layouts and scenery
// Four haunted grounds of the manor estate, each three levels and a boss.
// After the Conservatory the run loops back to the Graveyard as the next
// CYCLE: same fields, faster and busier. Layouts are SEEDED per level, so
// level 2-3 is always the same field — a set design, not a fresh scatter.
// This file loads first and owns the canvas + grid constants.
// ============================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;
const CELL = 24;
const COLS = Math.floor(W / CELL);   // 40
const ROWS = Math.floor(H / CELL);   // 22
const PLAYER_ZONE_ROW = ROWS - 5;    // 17 — the player is confined below this row
const ZONE_Y = PLAYER_ZONE_ROW * CELL;
const LEVELS_PER_GROUND = 4;         // three levels + the boss
const FIELD_TOP = 2, FIELD_BOTTOM = PLAYER_ZONE_ROW - 2; // rows terrain may use

function key(c, r) { return c + ',' + r; }
function cellX(c) { return c * CELL + CELL / 2; }
function cellY(r) { return r * CELL + CELL / 2; }

// Deterministic PRNG (mulberry32) — the same seed always builds the same field
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
// Hash scatter for scenery. (i*97, i*53)-style scatters form visible diagonals.
function hash(i, s) { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); }

// roster = the most of each critter allowed on the field at once
const GROUNDS = [
  {
    id: 'graveyard', name: 'THE GRAVEYARD', sub: 'Where the Hauntipede hatched',
    source: { x: W - 150, y: 46 },      // ghosts and scarabs spill out of the manor
    pal: { cap: ['#7c3aed', '#5b21b6'], spot: '#e9d5ff', stem: '#d8c8f0', glow: '#a855f7',
           body: '#a78bfa', head: '#e879f9', legs: '#7c3aed', accent: '#c084fc', mist: '148,163,184' },
    levels: [
      { len: 10, toadstools: 40, graveRows: [5, 11], roster: { ghost: 2, bug: 2, moth: 1 } },
      { len: 11, toadstools: 46, graveRows: [4, 8, 12], roster: { ghost: 2, bug: 3, moth: 1, beetle: 1 } },
      { len: 12, toadstools: 52, graveRows: [4, 7, 13], crypt: true, roster: { ghost: 3, bug: 3, moth: 1, beetle: 1, scorpion: 1 } }
    ],
    boss: { type: 'mother', name: 'THE GRAVE MOTHER', sub: 'She lays her eggs in the soil — shoot them before they hatch',
            toadstools: 28, graveRows: [7, 12], escort: 0, roster: { bug: 2, moth: 1 } }
  },
  {
    id: 'pumpkin', name: 'THE PUMPKIN PATCH', sub: 'Shoot a jack-o\'-lantern and it bursts',
    source: { x: W - 150, y: 150 },     // the barn door
    pal: { cap: ['#dc2626', '#991b1b'], spot: '#fde68a', stem: '#fef3c7', glow: '#f97316',
           body: '#fb923c', head: '#facc15', legs: '#9a3412', accent: '#fb923c', mist: '251,191,36' },
    levels: [
      { len: 11, toadstools: 34, vines: 3, roster: { ghost: 1, bug: 2, moth: 1, spider: 1 } },
      { len: 12, toadstools: 40, vines: 4, roster: { ghost: 2, bug: 3, moth: 1, spider: 1, beetle: 1 } },
      { len: 13, toadstools: 44, vines: 5, roster: { ghost: 2, bug: 3, moth: 1, spider: 1, beetle: 1, scorpion: 1 } }
    ],
    boss: { type: 'widow', name: 'THE HARVEST WIDOW', sub: 'Hit her hard while she is on the ground',
            toadstools: 24, vines: 3, escort: 6, roster: { bug: 2, moth: 1 } }
  },
  {
    id: 'bog', name: 'THE DROWNED BOG', sub: 'It swims fast underwater, and you can\'t hit it there',
    source: { x: W - 290, y: 118 },     // the sunken chapel
    pal: { cap: ['#0d9488', '#115e59'], spot: '#ccfbf1', stem: '#d1fae5', glow: '#2dd4bf',
           body: '#5eead4', head: '#a3e635', legs: '#0f766e', accent: '#2dd4bf', mist: '134,239,172' },
    levels: [
      { len: 12, toadstools: 38, water: [9], lilies: 3, roster: { ghost: 2, bug: 2, moth: 1, spider: 1 } },
      { len: 13, toadstools: 40, water: [6, 12], lilies: 3, roster: { ghost: 2, bug: 3, moth: 1, spider: 1, scorpion: 1 } },
      { len: 14, toadstools: 42, water: [5, 9, 13], lilies: 3, roster: { ghost: 3, bug: 3, moth: 1, spider: 1, beetle: 1, scorpion: 1 } }
    ],
    boss: { type: 'wyrm', name: 'THE BOG WYRM', sub: 'Shoot its head when it comes up',
            toadstools: 26, water: [7, 12], lilies: 2, escort: 6, roster: { bug: 2, moth: 1, scorpion: 1 } }
  },
  {
    id: 'conservatory', name: 'THE CONSERVATORY', sub: 'Open flytraps eat your shots and the Hauntipede alike',
    source: { x: W / 2, y: 78 },        // the cracked planter under the glass dome
    // the last ground is the hardest: a faster Hauntipede, busier critters, puffballs that burst three ways
    speedMult: 1.2, spawnMult: 1.45, spores: 3,
    pal: { cap: ['#db2777', '#9d174d'], spot: '#fce7f3', stem: '#fbcfe8', glow: '#f472b6',
           body: '#f9a8d4', head: '#c084fc', legs: '#9d174d', accent: '#f472b6', mist: '190,242,100' },
    levels: [
      { len: 14, toadstools: 46, traps: 4, puff: 0.35, roster: { ghost: 3, bug: 3, moth: 1, spider: 2, beetle: 1, scorpion: 1 } },
      { len: 15, toadstools: 52, traps: 5, puff: 0.42, roster: { ghost: 3, bug: 4, moth: 1, spider: 2, beetle: 2, scorpion: 2 } },
      { len: 16, toadstools: 58, traps: 6, puff: 0.5, roster: { ghost: 4, bug: 4, moth: 1, spider: 3, beetle: 2, scorpion: 2 } }
    ],
    boss: { type: 'mandrake', name: 'THE MANDRAKE', sub: 'Watch the vines, then shoot it while it\'s open',
            toadstools: 30, traps: 3, puff: 0.45, escort: 0, roster: { bug: 3, moth: 1, spider: 2, scorpion: 1 } }
  }
];

// ---------- Field builders ----------
// Returns { mushrooms, puffs, blocks, water, lilies }. blocks values are
// objects, never bare numbers, so a truthiness check can't silently miss one
// (the old tombstone variant-0 bug).
function buildField(gi, li) {
  const G = GROUNDS[gi];
  const def = li >= G.levels.length ? G.boss : G.levels[li];
  const rng = seeded((gi + 1) * 7919 + li * 131 + 17);
  const f = { mushrooms: {}, puffs: {}, blocks: {}, water: (def.water || []).slice(), lilies: [] };
  const reserved = (c, r) =>
    (G.id === 'conservatory' && r <= 4 && c >= 15 && c <= 24);   // the mandrake bed
  const isFree = (c, r) =>
    c >= 1 && c <= COLS - 2 && r >= FIELD_TOP && r <= FIELD_BOTTOM &&
    !f.blocks[key(c, r)] && !f.mushrooms[key(c, r)] && !f.water.includes(r) && !reserved(c, r);
  const stone = (c, r, v) => { if (isFree(c, r)) f.blocks[key(c, r)] = { type: 'stone', v }; };

  if (G.id === 'graveyard') {
    // Rows of graves, staggered like a real churchyard
    def.graveRows.forEach((r, i) => {
      for (let c = 2 + (i % 2) * 3; c < COLS - 2; c += 6) {
        if (rng() < 0.85) stone(c, r, 1 + Math.floor(rng() * 3));
      }
    });
    if (def.crypt) {                              // a crypt in the middle of level 3
      for (let c = 18; c <= 21; c++) for (let r = 9; r <= 10; r++) stone(c, r, 4);
    }
  } else if (G.id === 'pumpkin') {
    // Vines of pumpkins; every third one on a vine is a jack-o'-lantern
    for (let v = 0; v < def.vines; v++) {
      const dir = v % 2 ? -1 : 1;
      const c0 = dir > 0 ? 3 + Math.floor(rng() * 14) : COLS - 4 - Math.floor(rng() * 14);
      const r0 = FIELD_TOP + 1 + Math.floor(((v + rng() * 0.8) / def.vines) * (FIELD_BOTTOM - FIELD_TOP - 2));
      const len = 5 + Math.floor(rng() * 3);
      for (let k = 0; k < len; k++) {
        const c = c0 + k * 2 * dir, r = r0 + (k % 2);
        if (!isFree(c, r)) continue;
        f.blocks[key(c, r)] = k % 3 === 1 ? { type: 'lantern', hp: 2 } : { type: 'pumpkin', hp: 5 };
      }
    }
  } else if (G.id === 'bog') {
    // Mossy stones on the banks, lily pads drifting along each channel
    for (let i = 0; i < 6; i++) stone(2 + Math.floor(rng() * (COLS - 4)), FIELD_TOP + 1 + Math.floor(rng() * (FIELD_BOTTOM - FIELD_TOP)), 1 + Math.floor(rng() * 3));
    f.water.forEach((r, wi) => {
      const n = def.lilies || 3;
      for (let i = 0; i < n; i++) {
        f.lilies.push({ row: r, x: (i + 0.3 + rng() * 0.4) * (W / n), vx: (wi % 2 ? 1 : -1) * (0.45 + li * 0.08), spin: rng() * 6, bump: 0 });
      }
    });
  } else if (G.id === 'conservatory') {
    // Mirror-symmetric beds: planters and flytraps, placed as pairs
    for (let i = 0; i < 3; i++) {
      const c = 3 + Math.floor(rng() * 14), r = FIELD_TOP + 2 + Math.floor(rng() * (FIELD_BOTTOM - FIELD_TOP - 2));
      stone(c, r, 5); stone(COLS - 1 - c, r, 5);
    }
    for (let i = 0; i < def.traps; i++) {
      const c = 4 + Math.floor(rng() * 13), r = FIELD_TOP + 3 + Math.floor(rng() * (FIELD_BOTTOM - FIELD_TOP - 3));
      const phase = Math.floor(rng() * 210);
      if (isFree(c, r)) f.blocks[key(c, r)] = { type: 'trap', phase };
      if (isFree(COLS - 1 - c, r)) f.blocks[key(COLS - 1 - c, r)] = { type: 'trap', phase: phase + 105 };
    }
  }

  // Toadstools. The conservatory mirrors them too so its beds read as planted.
  const mirror = G.id === 'conservatory';
  let placed = 0, tries = 0;
  while (placed < def.toadstools && tries++ < 2000) {
    const c = 1 + Math.floor(rng() * (COLS - 2));
    const r = FIELD_TOP + Math.floor(rng() * (FIELD_BOTTOM - FIELD_TOP + 1));
    if (!isFree(c, r)) continue;
    const puff = def.puff && rng() < def.puff;
    f.mushrooms[key(c, r)] = 4; if (puff) f.puffs[key(c, r)] = true; placed++;
    if (mirror && isFree(COLS - 1 - c, r)) {
      f.mushrooms[key(COLS - 1 - c, r)] = 4; if (puff) f.puffs[key(COLS - 1 - c, r)] = true; placed++;
    }
  }
  return f;
}

// ---------- Scenery (painted once per level into an offscreen canvas) ----------
// Long thin strokes across the playfield read as rendering artifacts on this
// game (the old fence and zone line), so edges here are soft gradients.
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

function buildBackdrop(gi, f) {
  const c = makeCanvas(W, H), g = c.getContext('2d');
  if (!g) return c;
  [paintGraveyard, paintPumpkin, paintBog, paintConservatory][gi](g, f);
  // the player zone: a slightly lit band that fades in, no hard boundary
  const z = g.createLinearGradient(0, ZONE_Y - 40, 0, H);
  z.addColorStop(0, 'rgba(255,255,255,0)');
  z.addColorStop(0.35, 'rgba(255,255,255,0.025)');
  z.addColorStop(1, 'rgba(255,255,255,0.04)');
  g.fillStyle = z; g.fillRect(0, ZONE_Y - 40, W, H - ZONE_Y + 40);
  // vignette
  const v = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.45)');
  g.fillStyle = v; g.fillRect(0, 0, W, H);
  return c;
}

function stars(g, n, maxY, color) {
  for (let i = 0; i < n; i++) {
    g.globalAlpha = 0.15 + hash(i, 3) * 0.55;
    g.fillStyle = color;
    const s = 0.6 + hash(i, 4) * 1.2;
    g.fillRect(hash(i, 1) * W, hash(i, 2) * maxY, s, s);
  }
  g.globalAlpha = 1;
}
function glow(g, x, y, r, rgb, a) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
}
function vGrad(g, y0, y1, stops) {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  stops.forEach(([t, col]) => gr.addColorStop(t, col));
  return gr;
}
function bareTree(g, x, y, len, ang, depth) {
  if (depth === 0) return;
  const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
  g.lineWidth = depth * 1.3;
  g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
  bareTree(g, x2, y2, len * 0.72, ang - 0.45 - hash(depth, x) * 0.2, depth - 1);
  bareTree(g, x2, y2, len * 0.68, ang + 0.4 + hash(depth, y) * 0.25, depth - 1);
}

function paintGraveyard(g) {
  g.fillStyle = vGrad(g, 0, H, [[0, '#170b2a'], [0.3, '#0e071b'], [1, '#07040f']]);
  g.fillRect(0, 0, W, H);
  stars(g, 90, 160, '#e0d4ff');
  glow(g, W - 230, 58, 110, '224,212,255', 0.12);
  g.fillStyle = 'rgba(226,216,250,0.32)';
  g.beginPath(); g.arc(W - 230, 58, 26, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(120,100,160,0.18)';
  [[-8, -6, 6], [7, 4, 4], [-3, 10, 3]].forEach(([dx, dy, r]) => { g.beginPath(); g.arc(W - 230 + dx, 58 + dy, r, 0, Math.PI * 2); g.fill(); });
  // rolling far hills with a row of distant crosses
  g.fillStyle = '#0d0719';
  g.beginPath(); g.moveTo(0, 150);
  for (let x = 0; x <= W; x += 20) g.lineTo(x, 132 + Math.sin(x * 0.011) * 10 + Math.sin(x * 0.031) * 4);
  g.lineTo(W, H); g.lineTo(0, H); g.closePath(); g.fill();
  g.fillStyle = 'rgba(40,28,64,0.8)';
  for (let i = 0; i < 16; i++) {
    const x = 30 + hash(i, 9) * (W - 380), y = 132 + Math.sin(x * 0.011) * 10 + Math.sin(x * 0.031) * 4;
    g.fillRect(x - 1, y - 9, 2, 10); g.fillRect(x - 4, y - 6, 8, 2);
  }
  // bare trees on the left
  g.strokeStyle = '#120a22'; g.lineCap = 'round';
  bareTree(g, 70, 150, 42, -Math.PI / 2 - 0.1, 6);
  bareTree(g, 250, 146, 30, -Math.PI / 2 + 0.15, 5);
  // the manor on its hill (upper right) — ghosts & bugs spill from here
  const m = GROUNDS[0].source;
  const hill = g.createRadialGradient(W - 130, 10, 20, W - 130, 10, 170);
  hill.addColorStop(0, 'rgba(16,9,28,0.95)'); hill.addColorStop(0.6, 'rgba(14,8,24,0.55)'); hill.addColorStop(1, 'rgba(12,7,22,0)');
  g.fillStyle = hill; g.fillRect(W - 310, 0, 310, 190);
  g.fillStyle = '#160c26';
  g.fillRect(m.x - 34, m.y - 34, 68, 42);
  g.fillRect(m.x + 20, m.y - 52, 20, 60);
  g.beginPath(); g.moveTo(m.x - 40, m.y - 34); g.lineTo(m.x, m.y - 60); g.lineTo(m.x + 12, m.y - 34); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(m.x + 16, m.y - 52); g.lineTo(m.x + 30, m.y - 68); g.lineTo(m.x + 44, m.y - 52); g.closePath(); g.fill();
  // grave dirt: scattered tufts and pebbles
  g.strokeStyle = 'rgba(71,85,105,0.45)'; g.lineWidth = 1;
  for (let i = 0; i < 70; i++) {
    const x = hash(i, 11) * W, y = 160 + hash(i, 12) * (H - 170);
    g.beginPath();
    g.moveTo(x, y); g.lineTo(x - 2, y - 5); g.moveTo(x, y); g.lineTo(x + 1, y - 6); g.moveTo(x, y); g.lineTo(x + 3, y - 4);
    g.stroke();
  }
  g.fillStyle = 'rgba(100,90,130,0.12)';
  for (let i = 0; i < 50; i++) { g.beginPath(); g.ellipse(hash(i, 13) * W, 170 + hash(i, 14) * (H - 180), 2 + hash(i, 15) * 3, 1.5, 0, 0, Math.PI * 2); g.fill(); }
}

function paintPumpkin(g) {
  g.fillStyle = vGrad(g, 0, H, [[0, '#1a0d2e'], [0.16, '#3a1830'], [0.28, '#6b2c1c'], [0.31, '#1d100e'], [1, '#0f0808']]);
  g.fillRect(0, 0, W, H);
  stars(g, 50, 70, '#fde2c4');
  // harvest moon, low and huge
  glow(g, 170, 96, 150, '251,146,60', 0.22);
  g.fillStyle = '#f59e0b'; g.globalAlpha = 0.8;
  g.beginPath(); g.arc(170, 96, 44, 0, Math.PI * 2); g.fill();
  g.globalAlpha = 1;
  g.fillStyle = 'rgba(180,83,9,0.35)';
  [[-14, -10, 9], [12, 8, 7], [-4, 18, 5], [18, -14, 4]].forEach(([dx, dy, r]) => { g.beginPath(); g.arc(170 + dx, 96 + dy, r, 0, Math.PI * 2); g.fill(); });
  g.fillStyle = 'rgba(26,13,46,0.55)';
  g.beginPath(); g.ellipse(150, 92, 90, 6, -0.05, 0, Math.PI * 2); g.fill();
  // cornfield on the horizon
  g.fillStyle = '#1a0e10';
  g.beginPath(); g.moveTo(0, 170);
  for (let x = 0; x <= W; x += 5) g.lineTo(x, 150 - hash(x, 21) * 16 - Math.sin(x * 0.02) * 4);
  g.lineTo(W, 172); g.closePath(); g.fill();
  // scarecrow silhouette
  g.fillStyle = '#140a0c';
  g.fillRect(338, 112, 3, 50); g.fillRect(322, 124, 36, 3);
  g.beginPath(); g.arc(339, 108, 7, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(328, 104); g.lineTo(350, 104); g.lineTo(339, 94); g.closePath(); g.fill();
  // the barn (source of ghosts and bugs)
  const bx = W - 150, by = 150;
  g.fillStyle = '#1f0f10';
  g.fillRect(bx - 60, by - 60, 120, 62);
  g.beginPath(); g.moveTo(bx - 66, by - 58); g.lineTo(bx - 46, by - 92); g.lineTo(bx, by - 106); g.lineTo(bx + 46, by - 92); g.lineTo(bx + 66, by - 58); g.closePath(); g.fill();
  g.fillStyle = '#2b1416'; g.fillRect(bx - 20, by - 38, 40, 40);
  g.strokeStyle = '#3f1d1d'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(bx - 20, by - 38); g.lineTo(bx + 20, by + 2); g.moveTo(bx + 20, by - 38); g.lineTo(bx - 20, by + 2); g.stroke();
  // tilled soil: clods and straw
  for (let i = 0; i < 90; i++) {
    const x = hash(i, 22) * W, y = 176 + hash(i, 23) * (H - 180);
    if (i % 3) { g.fillStyle = 'rgba(60,34,22,0.35)'; g.beginPath(); g.ellipse(x, y, 3 + hash(i, 24) * 4, 2, 0, 0, Math.PI * 2); g.fill(); }
    else { g.strokeStyle = 'rgba(202,138,4,0.16)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 6, y - 3); g.stroke(); }
  }
}

function paintBog(g, f) {
  g.fillStyle = vGrad(g, 0, H, [[0, '#06161a'], [0.28, '#0a1f1b'], [1, '#050c0a']]);
  g.fillRect(0, 0, W, H);
  stars(g, 40, 90, '#d1fae5');
  glow(g, 520, 58, 140, '190,242,220', 0.13);
  g.fillStyle = 'rgba(210,245,230,0.24)';
  g.beginPath(); g.arc(520, 58, 24, 0, Math.PI * 2); g.fill();
  // sunken chapel, leaning
  const s = GROUNDS[2].source;
  g.save(); g.translate(s.x, s.y + 22); g.rotate(-0.08);
  g.fillStyle = '#0c1a17';
  g.fillRect(-30, -40, 60, 44);
  g.beginPath(); g.moveTo(-36, -40); g.lineTo(0, -64); g.lineTo(36, -40); g.closePath(); g.fill();
  g.fillRect(-6, -84, 12, 24); g.fillRect(-1.5, -96, 3, 14); g.fillRect(-6, -91, 12, 3);
  g.restore();
  // swamp line
  g.fillStyle = '#081411';
  g.beginPath(); g.moveTo(0, 150);
  for (let x = 0; x <= W; x += 16) g.lineTo(x, 140 + Math.sin(x * 0.017) * 6);
  g.lineTo(W, H); g.lineTo(0, H); g.closePath(); g.fill();
  // cypress trees with hanging moss at both edges
  const cypress = (x, h, lean) => {
    g.fillStyle = '#071210';
    g.beginPath(); g.moveTo(x - 16, 170); g.quadraticCurveTo(x - 4, 120, x + lean - 3, 170 - h); g.lineTo(x + lean + 3, 170 - h); g.quadraticCurveTo(x + 4, 120, x + 16, 170); g.closePath(); g.fill();
    for (let i = 0; i < 4; i++) {
      const bx = x + lean * (0.4 + i * 0.15), byy = 170 - h * (0.55 + i * 0.12), dir = i % 2 ? 1 : -1;
      g.lineWidth = 3; g.strokeStyle = '#071210';
      g.beginPath(); g.moveTo(bx, byy); g.lineTo(bx + dir * 40, byy - 10); g.stroke();
      g.strokeStyle = 'rgba(52,78,65,0.55)'; g.lineWidth = 1.2;
      for (let k = 0; k < 6; k++) {
        const mx = bx + dir * (6 + k * 6), my = byy - 1 - k * 1.5;
        g.beginPath(); g.moveTo(mx, my); g.quadraticCurveTo(mx + 3, my + 12, mx - 1, my + 18 + hash(k, x) * 16); g.stroke();
      }
    }
  };
  cypress(60, 150, -10); cypress(150, 110, 8); cypress(W - 70, 160, 12);
  // mud texture
  for (let i = 0; i < 70; i++) {
    g.fillStyle = `rgba(${20 + hash(i, 31) * 20},${40 + hash(i, 32) * 20},30,0.25)`;
    g.beginPath(); g.ellipse(hash(i, 33) * W, 170 + hash(i, 34) * (H - 180), 4 + hash(i, 35) * 6, 2, 0, 0, Math.PI * 2); g.fill();
  }
  // the channels
  (f.water || []).forEach(r => {
    const y = r * CELL;
    g.fillStyle = vGrad(g, y - 4, y + CELL + 4, [[0, 'rgba(14,70,70,0)'], [0.2, 'rgba(14,72,74,0.9)'], [0.5, 'rgba(8,44,50,0.95)'], [0.8, 'rgba(14,72,74,0.9)'], [1, 'rgba(14,70,70,0)']]);
    g.fillRect(0, y - 4, W, CELL + 8);
    g.fillStyle = 'rgba(160,240,220,0.10)';
    for (let i = 0; i < 18; i++) { g.fillRect(hash(i, r) * W, y + 5 + hash(i, r + 1) * 12, 8 + hash(i, r + 2) * 14, 1); }
    g.strokeStyle = 'rgba(64,110,70,0.7)'; g.lineWidth = 1.4;
    for (let i = 0; i < 7; i++) {
      const rx = hash(i, r * 3) * W, top = i % 2 ? y - 2 : y + CELL + 2;
      for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(rx + k * 3, top + 3); g.lineTo(rx + k * 3 + (k - 1.5), top - 8 - hash(k, i) * 6); g.stroke(); }
    }
  });
}

function paintConservatory(g) {
  g.fillStyle = vGrad(g, 0, H, [[0, '#0b1d17'], [0.25, '#0a1914'], [1, '#06100c']]);
  g.fillRect(0, 0, W, H);
  // night sky through the glass dome
  g.fillStyle = vGrad(g, 0, 110, [[0, '#0b1230'], [1, 'rgba(11,18,48,0)']]);
  g.fillRect(0, 0, W, 110);
  stars(g, 60, 90, '#dbeafe');
  // iron arches and panes
  for (let i = 0; i < 5; i++) {
    const cx = (i + 0.5) * W / 5, r = W / 10;
    g.fillStyle = 'rgba(150,210,190,0.05)';
    g.beginPath(); g.arc(cx, 110, r, Math.PI, 0); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(90,130,115,0.35)'; g.lineWidth = 3;
    g.beginPath(); g.arc(cx, 110, r, Math.PI, 0); g.stroke();
    g.lineWidth = 1.2; g.strokeStyle = 'rgba(90,130,115,0.22)';
    for (let k = 1; k < 4; k++) { const a = Math.PI + k * Math.PI / 4; g.beginPath(); g.moveTo(cx, 110); g.lineTo(cx + Math.cos(a) * r, 110 + Math.sin(a) * r); g.stroke(); }
  }
  // floor tiles — very low contrast checker, no grout lines
  for (let ty = 0; ty * 48 < H; ty++) for (let tx = 0; tx * 48 < W; tx++) {
    if ((tx + ty) % 2) continue;
    const y = ty * 48; if (y < 110) continue;
    g.fillStyle = 'rgba(200,255,230,0.018)'; g.fillRect(tx * 48, y, 48, 48);
  }
  // potted palms at the edges
  const palm = (x, y, s) => {
    g.fillStyle = '#3b1f14'; g.beginPath(); g.moveTo(x - 16 * s, y); g.lineTo(x + 16 * s, y); g.lineTo(x + 11 * s, y + 22 * s); g.lineTo(x - 11 * s, y + 22 * s); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(22,58,40,0.9)'; g.lineWidth = 3 * s;
    for (let k = 0; k < 7; k++) {
      const a = -Math.PI / 2 + (k - 3) * 0.42;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * 30 * s, y + Math.sin(a) * 40 * s, x + Math.cos(a) * 52 * s, y + Math.sin(a) * 30 * s + 18 * s); g.stroke();
    }
  };
  palm(34, 170, 1.1); palm(W - 34, 176, 1.2); palm(26, 470, 0.9); palm(W - 26, 460, 0.9);
  // the cracked mandrake bed under the dome
  const s = GROUNDS[3].source;
  g.fillStyle = '#3a1d14';
  g.beginPath(); g.ellipse(s.x, s.y + 26, 70, 18, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#1b0f0b';
  g.beginPath(); g.ellipse(s.x, s.y + 22, 58, 11, 0, 0, Math.PI * 2); g.fill();
  // hanging baskets with trailing vines
  [120, W - 120].forEach((x, i) => {
    g.strokeStyle = 'rgba(90,130,115,0.3)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 40); g.stroke();
    g.fillStyle = '#2a1810'; g.beginPath(); g.arc(x, 44, 12, 0, Math.PI); g.fill();
    g.strokeStyle = 'rgba(34,90,55,0.8)'; g.lineWidth = 1.5;
    for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(x - 10 + k * 5, 48); g.quadraticCurveTo(x - 14 + k * 7, 70, x - 8 + k * 4 + i * 3, 80 + hash(k, x) * 30); g.stroke(); }
  });
  // moonbeam through a broken pane
  const beam = g.createLinearGradient(300, 0, 420, H);
  beam.addColorStop(0, 'rgba(200,230,255,0.07)'); beam.addColorStop(1, 'rgba(200,230,255,0)');
  g.fillStyle = beam;
  g.beginPath(); g.moveTo(290, 0); g.lineTo(350, 0); g.lineTo(560, H); g.lineTo(380, H); g.closePath(); g.fill();
}
