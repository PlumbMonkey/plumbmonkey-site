// ============================================================
// SOUL CIRCUIT — realms: level plan, maze generator, cached maze art
// Four realms × four levels; the fourth level of each is a boss.
//   THE HEDGE MAZE       the classic board                  boss: THE SCARECROW KING
//   THE GRAVEYARD        earth cracks, then a hand erupts   boss: THE GRAVE LORD
//   THE ETHEREAL PLANE   paired portals cross the board     boss: THE MIRROR WRAITH
//   THE CATACOMBS        darkness; stay near the torches    boss: THE BAT QUEEN
// After the Catacombs the run loops as CYCLE n+1 (faster hunters, shorter field).
// ============================================================

const INK = '#0f0a1a';
const COLS = 39, ROWS = 21, CELL = 24;
const MW = COLS * CELL, MH = ROWS * CELL;   // 936 × 504
const OX = 12, OY = 36;                    // maze offset on the 960×540 canvas; the top band is the HUD
const LEVELS_PER_REALM = 4;
const WALL = 1, OPEN = 0, GATE = 4;

const realmOf = lvl => Math.floor((lvl - 1) / LEVELS_PER_REALM) % REALMS.length;
const stageOf = lvl => (lvl - 1) % LEVELS_PER_REALM;
const isBossLevel = lvl => lvl % LEVELS_PER_REALM === 0;
const cycleOf = lvl => Math.floor((lvl - 1) / (LEVELS_PER_REALM * REALMS.length));

/* The crypt pen in the middle of every board. Hunters start inside and leave
   through the gate; eaten hunters' eyes fly home through it. The ring corridor
   around it is always open, so the pen is never walled off from the maze. */
const PEN = { r0: 9, r1: 11, c0: 15, c1: 23, gate: { r: 8, c: 19 } };
const RING = { r0: 7, r1: 13, c0: 13, c1: 25 };
const START_CELL = { r: 15, c: 19 };
const inPen = (r, c) => r >= PEN.r0 && r <= PEN.r1 && c >= PEN.c0 && c <= PEN.c1;

const REALMS = [
  {
    key: 'hedge', name: 'THE HEDGE MAZE', sub: 'Gather the crystals, then run for the way out',
    boss: 'scarecrow', bossName: 'THE SCARECROW KING', hazard: null,
    loops: 0.10, braid: 1, density: 0.64, tunnels: 1,
    floor: '#0c140a', floor2: '#131d0f', speck: '#26331d',
    wall: { top: '#24481f', lit: '#3f7a35', face: '#10230d', leaf: ['#2d5a27', '#376b2f', '#1f4119'] },
    glow: '#86efac', accent: '#bef264', mote: '#d9f99d', relic: 'rose', hunters: ['vampire', 'witch', 'werewolf', 'frank']
  },
  {
    key: 'grave', name: 'THE GRAVEYARD', sub: 'When the earth cracks, step away',
    boss: 'gravelord', bossName: 'THE GRAVE LORD', hazard: 'hands',
    loops: 0.08, braid: 0.9, density: 0.62, tunnels: 2,
    floor: '#0b0c10', floor2: '#121419', speck: '#232733',
    wall: { top: '#353b4b', lit: '#58607a', face: '#161923', moss: '#34503a' },
    glow: '#a5b4fc', accent: '#c7d2fe', mote: '#e0e7ff', relic: 'skull', hunters: ['vampire', 'witch', 'werewolf', 'frank', 'ghost']
  },
  {
    key: 'aether', name: 'THE ETHEREAL PLANE', sub: 'Step into a portal to cross the plane',
    boss: 'mirror', bossName: 'THE MIRROR WRAITH', hazard: 'portals',
    loops: 0.14, braid: 0.95, density: 0.62, tunnels: 1,
    floor: '#0a0616', floor2: '#120a24', speck: '#2e1f52',
    wall: { top: '#3b1f78', lit: '#8b5cf6', face: '#1a0d3a', facet: '#e879f9' },
    glow: '#e879f9', accent: '#f0abfc', mote: '#f5d0fe', relic: 'prism', hunters: ['witch', 'ghost', 'vampire', 'werewolf', 'frank']
  },
  {
    key: 'crypt', name: 'THE CATACOMBS', sub: 'Stay in the light — their eyes still see you',
    boss: 'batqueen', bossName: 'THE BAT QUEEN', hazard: 'dark',
    loops: 0.06, braid: 0.75, density: 0.6, tunnels: 0,
    floor: '#110c09', floor2: '#1a130e', speck: '#2c2118',
    wall: { top: '#4a3527', lit: '#7a5a41', face: '#20150e', mortar: '#2a1d14' },
    glow: '#fdba74', accent: '#fcd34d', mote: '#fed7aa', relic: 'chalice', hunters: ['vampire', 'werewolf', 'ghost', 'frank', 'witch']
  }
];

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(i, k) { const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); }
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const target = amt < 0 ? 0 : 255, p = Math.abs(amt);
  const ch = v => Math.round(v + (target - v) * p);
  return '#' + ((1 << 24) + (ch((n >> 16) & 255) << 16) + (ch((n >> 8) & 255) << 8) + ch(n & 255)).toString(16).slice(1);
}
function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/* ---------------------------------------------------------------------------
   MAZE GENERATOR

   Mirror-symmetric, like the arcade original: the left half (columns 0..19,
   column 19 is the axis) is carved and copied onto the right. Corridors are the
   odd rows and odd columns, so every corridor is exactly one cell wide and no
   2×2 open block can ever form outside the pen — which the cornering assists in
   game.js depend on.

   1. The ring round the pen is pre-opened and seeds a randomised DFS over every
      other node, so the whole board is one connected tree.
   2. `loops` knocks through extra walls, `braid` removes dead ends. The Hedge
      Maze braids every dead end away; the Catacombs keep some, which is what
      makes them feel like catacombs.
   3. Side tunnels wrap the board on chosen rows.
   4. The result is flood-filled from the start cell and REJECTED if any open
      cell is unreachable. A sealed pocket holding one crystal would make the
      level uncompletable (Soul Circuit shipped exactly that bug once).
   --------------------------------------------------------------------------- */
function generateMaze(level) {
  const realm = REALMS[realmOf(level)];
  for (let attempt = 0; attempt < 30; attempt++) {
    const m = tryGenerate(level * 7919 + attempt * 104729 + 17, realm, level);
    if (m) return m;
  }
  throw new Error('maze generation failed for level ' + level);
}

function tryGenerate(seed, realm, level) {
  const rand = mulberry32(seed);
  const g = Array.from({ length: ROWS }, () => new Array(COLS).fill(WALL));
  const half = c => (c > 19 ? 38 - c : c);
  const isOpen = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < COLS && g[r][half(c)] !== WALL;
  const open = (r, c) => { g[r][half(c)] = OPEN; };
  const isNode = (r, c) => r % 2 === 1 && c % 2 === 1 && r >= 1 && r <= 19 && c >= 1 && c <= 37;
  const reserved = (r, c) => r > RING.r0 && r < RING.r1 && c > RING.c0 && c < RING.c1;

  // 1. ring + DFS
  const visited = new Set();
  const key = (r, c) => r * 100 + half(c);
  const stack = [];
  for (let c = RING.c0; c <= 19; c++) { open(RING.r0, c); open(RING.r1, c); }
  for (let r = RING.r0; r <= RING.r1; r++) open(r, RING.c0);
  for (let c = RING.c0; c <= 19; c += 2) { visited.add(key(RING.r0, c)); visited.add(key(RING.r1, c)); stack.push([RING.r0, c], [RING.r1, c]); }
  for (let r = RING.r0; r <= RING.r1; r += 2) { visited.add(key(r, RING.c0)); stack.push([r, RING.c0]); }
  for (let i = stack.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [stack[i], stack[j]] = [stack[j], stack[i]]; }
  const DIRS = [[0, 2], [0, -2], [2, 0], [-2, 0]];
  while (stack.length) {
    const [r, c] = stack[stack.length - 1];
    const options = DIRS.map(([dr, dc]) => [r + dr, c + dc])
      .filter(([nr, nc]) => isNode(nr, nc) && nc <= 19 && !reserved(nr, nc) && !visited.has(key(nr, nc)));
    if (!options.length) { stack.pop(); continue; }
    const [nr, nc] = options[Math.floor(rand() * options.length)];
    open((r + nr) / 2, (c + nc) / 2); open(nr, nc);
    visited.add(key(nr, nc));
    stack.push([nr, nc]);
  }

  // 2. loops
  for (let r = 1; r <= 19; r++) {
    for (let c = 1; c <= 19; c++) {
      if (g[r][c] !== WALL || (r % 2) === (c % 2)) continue;     // only walls between two nodes
      const a = r % 2 ? [r, c - 1] : [r - 1, c], b = r % 2 ? [r, c + 1] : [r + 1, c];
      if (!isNode(a[0], a[1]) || !isNode(b[0], b[1]) || reserved(a[0], a[1]) || reserved(b[0], b[1])) continue;
      if (rand() < realm.loops) open(r, c);
    }
  }
  //    braid
  const degree = (r, c) => [[0, 1], [0, -1], [1, 0], [-1, 0]].filter(([dr, dc]) => isOpen(r + dr, c + dc)).length;
  for (let r = 1; r <= 19; r += 2) {
    for (let c = 1; c <= 19; c += 2) {
      if (reserved(r, c) || degree(r, c) !== 1 || rand() >= realm.braid) continue;
      const walls = [[0, 1], [0, -1], [1, 0], [-1, 0]]
        .filter(([dr, dc]) => !isOpen(r + dr, c + dc) && isNode(r + dr * 2, c + dc * 2) && !reserved(r + dr * 2, c + dc * 2));
      if (!walls.length) continue;
      walls.sort((a, b) => degree(r + b[0] * 2, c + b[1] * 2) === 1 ? 1 : degree(r + a[0] * 2, c + a[1] * 2) === 1 ? -1 : 0);
      const [dr, dc] = walls[0];
      open(r + dr, c + dc);
    }
  }

  // 3. tunnels on seeded rows
  const tunnelRows = [];
  const tunnelChoices = [5, 15, 3, 17].sort(() => rand() - 0.5);
  for (let i = 0; i < realm.tunnels; i++) { tunnelRows.push(tunnelChoices[i]); open(tunnelChoices[i], 0); }

  // mirror onto the right half
  for (let r = 0; r < ROWS; r++) for (let c = 20; c < COLS; c++) g[r][c] = g[r][38 - c];

  // the pen
  for (let r = PEN.r0; r <= PEN.r1; r++) for (let c = PEN.c0; c <= PEN.c1; c++) g[r][c] = OPEN;
  g[PEN.gate.r][PEN.gate.c] = GATE;

  // 4. flood fill
  const tunnels = new Set(tunnelRows);
  const dist = floodFrom(g, tunnels, START_CELL.r, START_CELL.c);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (g[r][c] === OPEN && !inPen(r, c) && dist[r][c] < 0) return null;
    }
  }

  const powerCells = [{ r: 1, c: 1 }, { r: 1, c: 37 }, { r: 19, c: 1 }, { r: 19, c: 37 }];
  const portals = realm.hazard === 'portals'
    ? [[{ r: 3, c: 9 }, { r: 17, c: 29 }], [{ r: 3, c: 29 }, { r: 17, c: 9 }]]
    : [];

  // torches in the catacombs: wall cells facing a corridor, spread out
  const torches = [];
  if (realm.hazard === 'dark') {
    for (let r = 2; r < ROWS - 1; r += 4) {
      for (let c = 2; c < COLS - 1; c += 6) {
        const rr = r + Math.floor(rand() * 2), cc = c + Math.floor(rand() * 3);
        if (g[rr] && g[rr][cc] === WALL && g[rr + 1] && g[rr + 1][cc] === OPEN && !inPen(rr + 1, cc)) torches.push({ r: rr, c: cc });
      }
    }
  }

  return { grid: g, tunnels, powerCells, portals, torches, seed, level, realm };
}

/* Breadth-first distances over walkable cells (gates are walls to the player). */
function floodFrom(g, tunnels, sr, sc, passGate) {
  const dist = Array.from({ length: ROWS }, () => new Array(COLS).fill(-1));
  const q = [[sr, sc]]; dist[sr][sc] = 0;
  for (let h = 0; h < q.length; h++) {
    const [r, c] = q[h];
    for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      let nr = r + dr, nc = c + dc;
      if (nc < 0 || nc >= COLS) { if (!tunnels.has(r)) continue; nc = (nc + COLS) % COLS; }
      if (nr < 0 || nr >= ROWS) continue;
      const v = g[nr][nc];
      if (v === WALL || (v === GATE && !passGate) || dist[nr][nc] >= 0) continue;
      dist[nr][nc] = dist[r][c] + 1;
      q.push([nr, nc]);
    }
  }
  return dist;
}

/* Crystal layout for a level: seeded, so a level is the same board every time. */
function placeCrystals(m, boss) {
  const rand = mulberry32(m.seed ^ 0x5bd1e995);
  const gems = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
  const density = boss ? 0.34 : m.realm.density;
  let count = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (m.grid[r][c] !== OPEN || inPen(r, c)) continue;
      if (Math.abs(r - START_CELL.r) + Math.abs(c - START_CELL.c) <= 1) continue;
      if (m.portals.some(p => p.some(q => q.r === r && q.c === c))) continue;
      if (c === 0 || c === COLS - 1) continue;                     // tunnel mouths stay clear
      if (m.powerCells.some(p => p.r === r && p.c === c)) { gems[r][c] = 2; count++; continue; }
      if (rand() < density) { gems[r][c] = 1; count++; }
    }
  }
  return { gems, count };
}

/* ---------------------------------------------------------------------------
   CACHED MAZE ART — painted once per level into an offscreen canvas.
   Floor texture, drop shadows, raised wall blocks with a lit top and a dark
   front face, per-realm surface detail and props. Draw cost per frame: 1 blit.
   --------------------------------------------------------------------------- */
function makeCanvas(w, h) {
  if (typeof document === 'undefined' || !document.createElement) return null;
  const cv = document.createElement('canvas');
  if (!cv || !cv.getContext) return null;
  cv.width = w; cv.height = h;
  return cv;
}

function buildMazeArt(m) {
  const cv = makeCanvas(MW, MH);
  if (!cv) return null;
  const c = cv.getContext('2d');
  const R = m.realm, g = m.grid;
  const wallAt = (r, cc) => r < 0 || r >= ROWS || (cc < 0 || cc >= COLS ? !m.tunnels.has(r) : g[r][cc] === WALL);

  // floor
  const grad = c.createLinearGradient(0, 0, 0, MH);
  grad.addColorStop(0, R.floor2); grad.addColorStop(1, R.floor);
  c.fillStyle = grad; c.fillRect(0, 0, MW, MH);
  const rand = mulberry32(m.seed + 99);
  for (let i = 0; i < 2600; i++) {
    c.fillStyle = rand() < 0.5 ? R.speck : shade(R.floor2, 0.08);
    c.fillRect(rand() * MW, rand() * MH, 1 + rand() * 2, 1 + rand() * 1.5);
  }
  if (R.key === 'aether') {
    for (let i = 0; i < 160; i++) {
      c.fillStyle = `rgba(245,208,254,${0.2 + rand() * 0.6})`;
      c.fillRect(rand() * MW, rand() * MH, 1.5, 1.5);
    }
    for (let i = 0; i < 6; i++) {
      const x = rand() * MW, y = rand() * MH, rg = c.createRadialGradient(x, y, 0, x, y, 140);
      rg.addColorStop(0, 'rgba(168,85,247,0.16)'); rg.addColorStop(1, 'rgba(168,85,247,0)');
      c.fillStyle = rg; c.fillRect(x - 140, y - 140, 280, 280);
    }
  }
  if (R.key === 'crypt') {
    c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 1;
    for (let r = 0; r < ROWS; r++) for (let cc = 0; cc < COLS; cc++) {
      if (g[r][cc] !== OPEN) continue;
      c.strokeRect(cc * CELL + 0.5, r * CELL + 0.5, CELL - 1, CELL - 1);
      if (hash(r, cc) < 0.08) { c.fillStyle = '#d6c7a8'; c.fillRect(cc * CELL + 6 + hash(cc, r) * 10, r * CELL + 14, 3, 1.5); }  // bone chips
    }
  }
  if (R.key === 'grave') {
    for (let i = 0; i < 260; i++) {
      const x = rand() * MW, y = rand() * MH;
      c.strokeStyle = rand() < 0.5 ? '#26402b' : '#1c2f20'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x - 1, y - 3); c.moveTo(x + 1, y); c.lineTo(x + 2, y - 3); c.stroke();
    }
  }
  if (R.key === 'hedge') {
    for (let i = 0; i < 700; i++) {
      c.fillStyle = rand() < 0.5 ? '#2a2c22' : '#1e2119';
      c.beginPath(); c.arc(rand() * MW, rand() * MH, 0.8 + rand() * 1.4, 0, Math.PI * 2); c.fill();
    }
  }

  // pen floor
  c.fillStyle = 'rgba(88,28,135,0.28)';
  c.fillRect(PEN.c0 * CELL, PEN.r0 * CELL, (PEN.c1 - PEN.c0 + 1) * CELL, (PEN.r1 - PEN.r0 + 1) * CELL);
  c.strokeStyle = 'rgba(192,132,252,0.18)';
  for (let cc = PEN.c0; cc <= PEN.c1; cc++) c.strokeRect(cc * CELL + 2.5, PEN.r0 * CELL + 2.5, CELL - 5, (PEN.r1 - PEN.r0 + 1) * CELL - 5);

  // drop shadows
  c.fillStyle = 'rgba(0,0,0,0.42)';
  for (let r = 0; r < ROWS; r++) for (let cc = 0; cc < COLS; cc++) if (g[r][cc] === WALL) c.fillRect(cc * CELL + 4, r * CELL + 6, CELL, CELL);

  // wall blocks
  for (let r = 0; r < ROWS; r++) {
    for (let cc = 0; cc < COLS; cc++) {
      if (g[r][cc] !== WALL) continue;
      const x = cc * CELL, y = r * CELL;
      const openBelow = !wallAt(r + 1, cc), openAbove = !wallAt(r - 1, cc);
      const openLeft = !wallAt(r, cc - 1), openRight = !wallAt(r, cc + 1);
      const faceH = openBelow ? 6 : 0;
      c.fillStyle = R.wall.top;
      c.fillRect(x, y, CELL, CELL - faceH);
      if (faceH) { c.fillStyle = R.wall.face; c.fillRect(x, y + CELL - faceH, CELL, faceH); }
      paintWallSurface(c, R, x, y, r, cc, faceH);
      c.fillStyle = R.wall.lit;
      if (openAbove) c.fillRect(x, y, CELL, 2);
      c.fillStyle = INK;
      if (openLeft) c.fillRect(x, y, 1.5, CELL);
      if (openRight) c.fillRect(x + CELL - 1.5, y, 1.5, CELL);
      if (openBelow) c.fillRect(x, y + CELL - 1.5, CELL, 1.5);
      if (openAbove) c.fillRect(x, y - 0.5, CELL, 1);
    }
  }

  // props standing on wall tops
  for (let r = 1; r < ROWS - 1; r++) {
    for (let cc = 1; cc < COLS - 1; cc++) {
      if (g[r][cc] !== WALL || !(g[r + 1][cc] !== WALL) || hash(r * 3, cc * 5) > 0.16) continue;
      paintProp(c, R, cc * CELL + CELL / 2, r * CELL + CELL - 7, hash(cc, r * 7));
    }
  }

  // tunnel mouths
  m.tunnels.forEach(r => {
    [0, MW - CELL].forEach((x, i) => {
      const lg = c.createLinearGradient(x, 0, x + CELL, 0);
      lg.addColorStop(i ? 1 : 0, 'rgba(0,0,0,0.85)'); lg.addColorStop(i ? 0 : 1, 'rgba(0,0,0,0)');
      c.fillStyle = lg; c.fillRect(x, r * CELL, CELL, CELL);
    });
  });
  return cv;
}

function paintWallSurface(c, R, x, y, r, cc, faceH) {
  const s = hash(r, cc), top = CELL - faceH;
  if (R.key === 'hedge') {
    for (let i = 0; i < 5; i++) {
      c.fillStyle = R.wall.leaf[i % 3];
      c.beginPath();
      c.arc(x + 4 + hash(r + i, cc) * 16, y + 3 + hash(r, cc + i) * (top - 6), 3 + hash(i, r + cc) * 2.5, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = 'rgba(190,242,100,0.25)';
    c.fillRect(x + 5 + s * 12, y + 4, 2, 1.5);
  } else if (R.key === 'grave') {
    c.fillStyle = shade(R.wall.top, -0.25);
    c.fillRect(x, y + Math.floor(top / 2), CELL, 1.5);
    c.fillRect(x + (r % 2 ? 7 : 16), y, 1.5, Math.floor(top / 2));
    c.fillRect(x + (r % 2 ? 15 : 5), y + Math.floor(top / 2), 1.5, Math.ceil(top / 2));
    if (s < 0.35) { c.fillStyle = R.wall.moss; c.fillRect(x + 2 + s * 30, y + top - 4, 5, 2.5); }
    if (s > 0.85) { c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(x + 12, y + 3, 1, 8); c.fillRect(x + 11, y + 7, 3, 1); }
  } else if (R.key === 'aether') {
    c.fillStyle = 'rgba(139,92,246,0.35)';
    c.beginPath(); c.moveTo(x + 2, y + top - 2); c.lineTo(x + 2 + s * 18, y + 2); c.lineTo(x + CELL - 2, y + top - 2); c.fill();
    c.strokeStyle = rgba(R.wall.facet, 0.45); c.lineWidth = 1;
    c.beginPath(); c.moveTo(x + 3, y + 4 + s * 6); c.lineTo(x + CELL - 4, y + top - 5); c.stroke();
    c.fillStyle = 'rgba(245,208,254,0.55)'; c.fillRect(x + 4 + s * 14, y + 3, 2, 2);
  } else {
    c.fillStyle = R.wall.mortar;
    c.fillRect(x, y + Math.floor(top / 3), CELL, 1.5);
    c.fillRect(x, y + Math.floor(top * 2 / 3), CELL, 1.5);
    c.fillRect(x + (r % 2 ? 11 : 4), y, 1.5, Math.floor(top / 3));
    c.fillRect(x + (r % 2 ? 4 : 17), y + Math.floor(top / 3), 1.5, Math.floor(top / 3));
    if (s > 0.9) {   // skull niche
      c.fillStyle = '#0a0705'; c.fillRect(x + 6, y + 4, 12, top - 7);
      c.fillStyle = '#d6c7a8'; c.beginPath(); c.arc(x + 12, y + 8, 3.5, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#0a0705'; c.fillRect(x + 10, y + 7, 1.5, 1.5); c.fillRect(x + 12.5, y + 7, 1.5, 1.5);
    }
  }
}

function paintProp(c, R, x, y, s) {
  c.lineJoin = 'round';
  if (R.key === 'hedge') {
    /* A rose tucked INTO the hedge. Muted and set back from the corridor edge:
       the first version was bright pink/gold on the path side and read as a
       collectible next to the cyan crystals. */
    c.globalAlpha = 0.8;
    c.fillStyle = s < 0.5 ? '#9d174d' : '#cbd5e1';
    [[-2, 0], [2, 0], [0, -2], [0, 2]].forEach(([dx, dy]) => { c.beginPath(); c.arc(x + dx * 0.7, y - 11 + dy * 0.7, 1.6, 0, Math.PI * 2); c.fill(); });
    c.fillStyle = '#1f2e14'; c.beginPath(); c.arc(x, y - 11, 0.9, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 1;
  } else if (R.key === 'grave') {
    // headstone or cross
    c.strokeStyle = INK; c.lineWidth = 1.5;
    if (s < 0.55) {
      c.fillStyle = '#6b7280';
      c.beginPath(); c.moveTo(x - 5, y); c.lineTo(x - 5, y - 9); c.arc(x, y - 9, 5, Math.PI, 0); c.lineTo(x + 5, y); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#374151'; c.fillRect(x - 2.5, y - 9, 5, 1.2); c.fillRect(x - 2.5, y - 6, 5, 1.2);
    } else {
      c.fillStyle = '#9ca3af';
      c.fillRect(x - 1.5, y - 14, 3, 14); c.fillRect(x - 5, y - 10, 10, 3);
      c.strokeRect(x - 1.5, y - 14, 3, 14);
    }
  } else if (R.key === 'aether') {
    c.fillStyle = 'rgba(232,121,249,0.8)'; c.strokeStyle = INK; c.lineWidth = 1;
    c.beginPath(); c.moveTo(x, y - 16); c.lineTo(x + 4, y - 9); c.lineTo(x, y - 3); c.lineTo(x - 4, y - 9); c.closePath(); c.fill(); c.stroke();
  } else {
    // candle stub with wax drip (the flame is drawn live in render.js)
    c.fillStyle = '#e7dcc4'; c.strokeStyle = INK; c.lineWidth = 1;
    c.fillRect(x - 2, y - 8, 4, 8); c.strokeRect(x - 2, y - 8, 4, 8);
  }
}
