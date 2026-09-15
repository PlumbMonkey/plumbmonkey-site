// ============================================================
// SPECTRAL MANOR CRUISE — tracks: road builder, themes, scenery, sky layers
// One track per race; after the fourth the series loops with faster rivals.
//   1 MIDNIGHT HIGHWAY   graveyard shoulders, two jump ramps
//   2 HOLLOW WOODS       rolling hills, fog banks, fallen logs across a lane
//   3 BONEYARD CANYON    steep crests, lava pools, bone arches, three jumps
//   4 NEON NECROPOLIS    rain, tunnels, slick puddles that break traction
// ============================================================

const INK = '#0f0a1a';
const SCREEN_W = 960, SCREEN_H = 540;
const SEG_LEN = 200;
const ROAD_W = 2200;            // half-width of the road in world units
const CAM_H = 1050;
const CAM_DEPTH = 0.84;         // 1 / tan(fov/2)
const DRAW_DIST = 160;          // segments
const LAPS = 3;
const CAR_BOTTOM = SCREEN_H - 26;
/* How far in front of the camera the player's car actually sits. The car is
   drawn near the bottom of the screen, which on a flat road is ~5 segments
   ahead of the camera — collisions, pickups and hazards are measured HERE, so
   what you hit is what you see touch the car. (The old game measured at the
   camera, so rivals "hit" you while still off the bottom of the screen.) */
const PLAYER_Z = Math.round(CAM_H * CAM_DEPTH * (SCREEN_H / 2) / (CAR_BOTTOM - SCREEN_H / 2));

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
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
function hexRgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function mix(a, b, t) {   // a, b as [r,g,b]
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
}
function makeCanvas(w, h) {
  if (typeof document === 'undefined' || !document.createElement) return null;
  const cv = document.createElement('canvas');
  if (!cv || !cv.getContext) return null;
  cv.width = w; cv.height = h;
  return cv;
}
const easeIn = (a, b, p) => a + (b - a) * p * p;
const easeInOut = (a, b, p) => a + (b - a) * (-Math.cos(p * Math.PI) / 2 + 0.5);

/* ---------------------------------------------------------------------------
   THEMES
   `pace` scales the rival pack per track: the Canyon's jumps (no steering in the
   air), crests and tight bends make it the hardest drive, so its pack runs 3%
   slower — measured with the bots in scripts/test-cruise.cjs.
   --------------------------------------------------------------------------- */
const TRACKS = [
  {
    key: 'highway', name: 'MIDNIGHT HIGHWAY', sub: 'Three laps past the manor graveyard',
    sky: ['#07030f', '#1a0d33', '#3b1a5c'], fog: '#241238', fogDensity: 2.2,
    grass: ['#120a1f', '#0e0818'], road: ['#2a2040', '#241b38'], rumble: ['#a855f7', '#3b2660'],
    lane: '#e9d5ff', edge: '#c4b5fd', weather: 'mist', moon: '#f5f0ff', glow: '#c084fc', tone: 1, pace: 1,
    seed: 101
  },
  {
    key: 'woods', name: 'HOLLOW WOODS', sub: 'Rolling hills, fog banks — and fallen logs',
    sky: ['#020a0c', '#0b2a2e', '#2d5a55'], fog: '#1d3b3a', fogDensity: 3.4,
    grass: ['#0a1a12', '#08150e'], road: ['#29302e', '#232a28'], rumble: ['#e5e7eb', '#7f1d1d'],
    lane: '#f1f5f9', edge: '#e2e8f0', weather: 'leaves', moon: '#ecfdf5', glow: '#5eead4', tone: 0.89, pace: 0.985,
    seed: 202
  },
  {
    key: 'canyon', name: 'BONEYARD CANYON', sub: 'Crests you cannot see over — and rivers of lava',
    sky: ['#1a0303', '#5c1208', '#c2410c'], fog: '#4a1a0e', fogDensity: 1.8,
    grass: ['#3a1a0e', '#32160c'], road: ['#3b2a24', '#35251f'], rumble: ['#fbbf24', '#7c2d12'],
    lane: '#fde68a', edge: '#fed7aa', weather: 'embers', moon: '#fecaca', glow: '#fb923c', tone: 1.12, pace: 0.97,
    seed: 303
  },
  {
    key: 'city', name: 'NEON NECROPOLIS', sub: 'Rain-slick streets, tunnels and puddles',
    sky: ['#05030d', '#1e0b2e', '#4a1646'], fog: '#2a1030', fogDensity: 2.6,
    grass: ['#111018', '#0d0c13'], road: ['#22202c', '#1d1b26'], rumble: ['#22d3ee', '#be185d'],
    lane: '#f0abfc', edge: '#67e8f9', weather: 'rain', moon: '#fbcfe8', glow: '#f472b6', tone: 0.84, pace: 1,
    seed: 404
  }
];

/* ---------------------------------------------------------------------------
   ROAD BUILDER — eased curves and hills (segments carry y1 → y2)
   --------------------------------------------------------------------------- */
function makeBuilder() {
  const segs = [];
  const lastY = () => (segs.length ? segs[segs.length - 1].y2 : 0);
  const add = (curve, y) => segs.push({ i: segs.length, curve, y1: lastY(), y2: y, sprites: [], hazards: [], orbs: [], tunnel: false, fogBank: 0 });
  function road(enter, hold, leave, curve = 0, hill = 0) {
    const start = segs.length, startY = lastY(), endY = startY + hill * SEG_LEN, total = enter + hold + leave;
    for (let n = 0; n < enter; n++) add(easeIn(0, curve, n / enter), easeInOut(startY, endY, n / total));
    for (let n = 0; n < hold; n++) add(curve, easeInOut(startY, endY, (enter + n) / total));
    for (let n = 0; n < leave; n++) add(easeInOut(curve, 0, n / leave), easeInOut(startY, endY, (enter + hold + n) / total));
    return { start, holdStart: start + enter, holdEnd: start + enter + hold, end: segs.length };
  }
  /* return to height 0 so the lap joins up */
  function close(len) { return road(Math.floor(len / 3), Math.floor(len / 3), len - 2 * Math.floor(len / 3), 0, -lastY() / SEG_LEN); }
  return { segs, road, close };
}

const LAYOUTS = {
  highway(b) {
    const s1 = b.road(20, 90, 20, 0, 0);
    b.road(40, 60, 40, 2.2, 8);
    b.road(30, 50, 30, 0, -8);
    b.road(40, 70, 40, -3, 0);
    b.road(20, 40, 20, 0, 6);
    b.road(30, 40, 30, 1.8, -6);
    b.road(30, 40, 30, -1.8, 10);
    const s2 = b.road(20, 70, 20, 0, -10);
    b.road(40, 60, 40, 3.2, 0);
    b.close(100);
    return { jumps: [s1.holdStart + 55, s2.holdStart + 35], straights: [s1, s2] };
  },
  woods(b) {
    const s1 = b.road(20, 50, 20, 0, 12);
    b.road(30, 50, 30, -2.6, -12);
    b.road(30, 40, 30, 2.8, 18);
    const s2 = b.road(20, 60, 20, 0, -18);
    b.road(40, 50, 40, -3.4, 10);
    b.road(30, 40, 30, 1.6, -10);
    b.road(30, 40, 30, -1.6, 14);
    const s3 = b.road(20, 50, 20, 0, -4);
    b.road(40, 60, 40, 3, -6);
    b.close(110);
    return { jumps: [], straights: [s1, s2, s3], fogBanks: [[s2.start - 30, s2.end + 10], [s3.start, s3.end + 60]] };
  },
  canyon(b) {
    const s1 = b.road(20, 80, 20, 0, 0);
    b.road(30, 40, 30, 2.6, 22);
    b.road(20, 30, 20, 0, -22);
    b.road(40, 60, 40, -3.2, 14);
    const s2 = b.road(20, 70, 20, 0, -14);
    b.road(30, 50, 30, 3.6, 0);
    b.road(30, 40, 30, -2, 20);
    const s3 = b.road(20, 70, 20, 0, -20);
    b.road(40, 50, 40, 2.4, 0);
    b.close(100);
    return { jumps: [s1.holdStart + 60, s2.holdStart + 40, s3.holdStart + 40], straights: [s1, s2, s3] };
  },
  city(b) {
    const s1 = b.road(20, 80, 20, 0, 0);
    b.road(30, 50, 30, -2.4, 4);
    const t1 = b.road(20, 80, 20, 0, -4);
    b.road(40, 40, 40, 3.2, 0);
    b.road(30, 40, 30, -3.2, 6);
    const s2 = b.road(20, 60, 20, 0, -6);
    b.road(40, 60, 40, 2.8, 0);
    const t2 = b.road(20, 70, 20, 0, 0);
    b.road(30, 50, 30, -2.2, 0);
    b.close(100);
    return { jumps: [], straights: [s1, s2, t1, t2], tunnels: [[t1.holdStart - 10, t1.holdEnd + 10], [t2.holdStart, t2.holdEnd + 20]] };
  }
};

/* ---------------------------------------------------------------------------
   BUILD — layout + scenery + hazards + orbs + minimap, all seeded
   --------------------------------------------------------------------------- */
function buildTrack(index) {
  const theme = TRACKS[index % TRACKS.length];
  const rng = mulberry32(theme.seed);
  const b = makeBuilder();
  const plan = LAYOUTS[theme.key](b);
  const segs = b.segs;
  const n = segs.length;
  const pick = arr => arr[Math.floor(rng() * arr.length)];
  const put = (i, name, offset) => { if (segs[i]) segs[i].sprites.push({ name, offset }); };

  (plan.tunnels || []).forEach(([a, z]) => { for (let i = a; i < z; i++) segs[i].tunnel = true; });
  (plan.fogBanks || []).forEach(([a, z]) => { for (let i = a; i < z; i++) segs[i].fogBank = Math.sin((i - a) / (z - a) * Math.PI); });

  // start/finish gantry and jump ramps
  put(4, 'gantry', 0);
  plan.jumps.forEach(i => { segs[i].jump = true; put(i, 'ramp', 0); });

  // roadside scenery: both shoulders, denser near the road on straights
  const SETS = {
    highway: { near: ['tomb', 'tomb', 'cross', 'pumpkin', 'lamp'], far: ['deadTree', 'deadTree', 'mausoleum', 'deadTree', 'billboard'] },
    woods: { near: ['mushroom', 'stump', 'mushroom', 'lantern'], far: ['pine', 'pine', 'oak', 'pine', 'oak'] },
    canyon: { near: ['skull', 'cactus', 'vent', 'rock'], far: ['cliff', 'rock', 'cliff', 'cactus'] },
    city: { near: ['lampPost', 'barrier', 'lampPost'], far: ['building', 'building', 'neon', 'building'] }
  }[theme.key];
  for (let i = 12; i < n - 4; i++) {
    const seg = segs[i];
    if (seg.tunnel) { if (i % 10 === 0) { put(i, 'tunnelLight', -1.02); put(i, 'tunnelLight', 1.02); } continue; }
    if (seg.jump || Math.abs(i - 4) < 4) continue;
    if (theme.key === 'city') {
      if (i % 4 === 0) { put(i, 'lampPost', -1.25); put(i, 'lampPost', 1.25); }
      if (i % 3 === 0) { put(i, pick(SETS.far), -(1.9 + rng() * 0.6)); put(i, pick(SETS.far), 1.9 + rng() * 0.6); }
      continue;
    }
    if (i % 3 === 0 && rng() < 0.75) put(i, pick(SETS.near), (rng() < 0.5 ? -1 : 1) * (1.25 + rng() * 0.35));
    // far scenery stands out by its own width, so a big cliff never reaches back
    // over the shoulder and grazing the road edge doesn't count as hitting it
    if (i % 5 === 0 && rng() < 0.8) { const nm = pick(SETS.far); put(i, nm, (rng() < 0.5 ? -1 : 1) * (1.75 + SPRITE_DEFS[nm].collide + rng() * 1.6)); }
    if (theme.key === 'highway' && i % 2 === 0) { put(i, 'fence', -1.2); put(i, 'fence', 1.2); }
    if (theme.key === 'canyon' && i % 70 === 30) put(i, 'boneArch', 0);
  }

  // static road hazards on straights (never on a ramp or within the grid)
  const LANES = [-0.62, 0, 0.62];
  const hazardType = { woods: 'log', canyon: 'lava', city: 'puddle' }[theme.key];
  if (hazardType) {
    plan.straights.forEach((s, si) => {
      for (let k = 0; k < 2; k++) {
        const i = s.holdStart + 14 + k * Math.max(12, Math.floor((s.holdEnd - s.holdStart - 28) / 2));
        if (i < 40 || segs[i].jump || (segs[i + 1] && segs[i + 1].jump)) continue;
        const lane = LANES[(si + k * 2) % 3];
        segs[i].hazards.push({ type: hazardType, x: lane, w: hazardType === 'log' ? 0.34 : 0.3 });
      }
    });
  }

  // soul-orb trails: a lane of six on straights, alternating lanes
  plan.straights.forEach((s, si) => {
    const lane = LANES[(si + 1) % 3];
    for (let k = 0; k < 6; k++) {
      const i = s.start + 6 + k * 3;
      if (i < 30 || segs[i].hazards.length) continue;
      segs[i].orbs.push({ x: lane, lap: 0 });
    }
  });

  return { theme, index, segments: segs, length: n * SEG_LEN, jumps: plan.jumps, map: buildMinimap(segs) };
}

/* A top-down outline for the HUD: integrate the curves into a heading, then
   spread the closing error over the lap so the drawn loop joins up. */
function buildMinimap(segs) {
  let hx = 0, hy = 0, head = -Math.PI / 2;
  const pts = [];
  let turn = 0;
  segs.forEach(s => { turn += s.curve; });
  const k = turn !== 0 ? (Math.PI * 2 * Math.sign(turn)) / turn : 0.002;
  segs.forEach((s, i) => {
    head += s.curve * k;
    hx += Math.cos(head); hy += Math.sin(head);
    if (i % 4 === 0) pts.push([hx, hy]);
  });
  const ex = pts[pts.length - 1][0] - pts[0][0], ey = pts[pts.length - 1][1] - pts[0][1];
  const fixed = pts.map(([x, y], i) => [x - ex * i / (pts.length - 1), y - ey * i / (pts.length - 1)]);
  const xs = fixed.map(p => p[0]), ys = fixed.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const sc = 1 / Math.max(maxX - minX, maxY - minY, 1);
  return fixed.map(([x, y]) => [(x - minX) * sc - (maxX - minX) * sc / 2, (y - minY) * sc - (maxY - minY) * sc / 2]);
}

/* ---------------------------------------------------------------------------
   ROADSIDE SPRITES — painted once into canvases, then scaled with drawImage.
   h = world height in units; collide = half-width (road units) you can hit.
   --------------------------------------------------------------------------- */
function ink(c, w = 3) { c.strokeStyle = INK; c.lineWidth = w; c.lineJoin = 'round'; c.stroke(); }
function poly(c, pts, fill, w = 3) {
  c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath();
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (w) ink(c, w);
}
function glowDot(c, x, y, r, color) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, 0.95)); g.addColorStop(0.35, rgba(color, 0.45)); g.addColorStop(1, rgba(color, 0));
  c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
}

const SPRITE_DEFS = {
  deadTree: { w: 200, h: 300, world: 2800, collide: 0.1, draw(c) {
    c.strokeStyle = '#1b1028'; c.lineCap = 'round';
    const branch = (x, y, a, len, wd) => {
      if (len < 10) return;
      const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
      c.lineWidth = wd; c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2); c.stroke();
      branch(x2, y2, a - 0.45, len * 0.68, wd * 0.62);
      branch(x2, y2, a + 0.38, len * 0.62, wd * 0.6);
    };
    c.fillStyle = '#1b1028'; poly(c, [[88, 300], [112, 300], [106, 190], [94, 190]], '#1b1028', 0);
    branch(100, 200, -Math.PI / 2 - 0.1, 70, 14);
    c.fillStyle = 'rgba(192,132,252,0.18)'; c.fillRect(96, 200, 3, 95);
  } },
  tomb: { w: 90, h: 110, world: 700, collide: 0.08, draw(c) {
    c.beginPath(); c.moveTo(12, 108); c.lineTo(12, 40); c.arc(45, 40, 33, Math.PI, 0); c.lineTo(78, 108); c.closePath();
    c.fillStyle = '#5b5670'; c.fill(); ink(c, 4);
    c.fillStyle = '#433e56'; c.fillRect(52, 14, 24, 92);
    c.fillStyle = '#2e2a3d'; c.fillRect(30, 42, 30, 5); c.fillRect(30, 56, 30, 5); c.fillRect(30, 70, 22, 5);
    c.fillStyle = '#34503a'; c.fillRect(12, 96, 30, 10);
  } },
  cross: { w: 80, h: 140, world: 1000, collide: 0.06, draw(c) {
    poly(c, [[33, 138], [47, 138], [47, 45], [72, 45], [72, 30], [47, 30], [47, 4], [33, 4], [33, 30], [8, 30], [8, 45], [33, 45]], '#8b86a0', 4);
    c.fillStyle = '#6b6680'; c.fillRect(40, 8, 7, 128);
  } },
  pumpkin: { w: 90, h: 80, world: 420, collide: 0, draw(c) {
    glowDot(c, 45, 45, 45, '#fb923c');
    c.beginPath(); c.ellipse(45, 48, 36, 28, 0, 0, Math.PI * 2); c.fillStyle = '#ea580c'; c.fill(); ink(c, 3);
    c.strokeStyle = '#9a3412'; c.lineWidth = 2; c.beginPath(); c.ellipse(45, 48, 14, 28, 0, 0, Math.PI * 2); c.stroke();
    c.fillStyle = '#fde047'; poly(c, [[28, 42], [38, 42], [33, 32]], '#fde047', 0); poly(c, [[52, 42], [62, 42], [57, 32]], '#fde047', 0);
    poly(c, [[26, 56], [64, 56], [58, 66], [32, 66]], '#fde047', 0);
    c.fillStyle = '#365314'; c.fillRect(42, 14, 7, 10);
  } },
  lamp: { w: 70, h: 260, world: 2300, collide: 0.05, draw(c) {
    glowDot(c, 35, 38, 34, '#fde68a');
    c.fillStyle = '#1f1a2e'; c.fillRect(31, 60, 8, 196); c.fillRect(20, 246, 30, 12);
    poly(c, [[22, 30], [48, 30], [44, 60], [26, 60]], '#fde68a', 3);
    poly(c, [[18, 30], [52, 30], [35, 14]], '#1f1a2e', 3);
  } },
  fence: { w: 120, h: 70, world: 520, collide: 0.04, draw(c) {
    c.fillStyle = '#18121f'; c.fillRect(0, 28, 120, 5); c.fillRect(0, 52, 120, 5);
    for (let x = 6; x < 120; x += 22) { c.fillRect(x, 12, 5, 58); poly(c, [[x - 2, 14], [x + 7, 14], [x + 2.5, 2]], '#18121f', 0); }
  } },
  mausoleum: { w: 220, h: 200, world: 1900, collide: 0.3, draw(c) {
    poly(c, [[20, 198], [200, 198], [200, 80], [20, 80]], '#3d3852', 4);
    poly(c, [[8, 82], [212, 82], [110, 20]], '#4b4563', 4);
    c.fillStyle = '#0b0712'; c.fillRect(85, 120, 50, 78);
    c.fillStyle = '#6b6680'; [36, 60, 160, 184].forEach(x => c.fillRect(x - 6, 86, 12, 112));
    glowDot(c, 110, 108, 22, '#a855f7');
  } },
  // one painted board per other cabinet in the arcade: a still of the game over its title
  billboard: { w: 260, h: 240, world: 2400, collide: 0.3, draw(c, rng, v = 0) {
    const game = BILLBOARD_GAMES[v % BILLBOARD_GAMES.length];
    c.fillStyle = '#1b1426'; c.fillRect(60, 170, 12, 70); c.fillRect(188, 170, 12, 70);
    poly(c, [[4, 4], [256, 4], [256, 178], [4, 178]], '#120a20', 4);
    const frame = () => {
      c.save(); c.strokeStyle = game.accent; c.lineWidth = 3; c.shadowColor = game.accent; c.shadowBlur = 10;
      c.strokeRect(12, 12, 236, 159); c.restore();
    };
    c.fillStyle = game.bg; c.fillRect(12, 12, 236, 133);
    c.fillStyle = '#0b0712'; c.fillRect(12, 145, 236, 26);
    let size = 17; c.font = `bold ${size}px sans-serif`;
    const wide = () => (c.measureText ? (c.measureText(game.title.toUpperCase()) || {}).width || 0 : 0);
    while (size > 11 && wide() > 224) c.font = `bold ${--size}px sans-serif`;
    c.fillStyle = game.accent; c.textAlign = 'center'; c.fillText(game.title.toUpperCase(), 130, 164);
    frame();
    if (typeof Image !== 'undefined') {           // the still arrives after the board is built; paint it in place
      const img = new Image();
      img.onload = () => { c.drawImage(img, 12, 12, 236, 133); frame(); };
      img.src = `billboards/${game.slug}.jpg`;
    }
  } },
  pine: { w: 180, h: 320, world: 3400, collide: 0.1, draw(c) {
    c.fillStyle = '#2a1a12'; c.fillRect(82, 270, 16, 50);
    for (let k = 0; k < 5; k++) {
      const y = 40 + k * 50, hw = 30 + k * 16;
      poly(c, [[90, y - 45], [90 + hw, y + 40], [90 - hw, y + 40]], k % 2 ? '#0f2a22' : '#123328', 3);
    }
    c.fillStyle = 'rgba(94,234,212,0.12)'; poly(c, [[90, 0], [130, 280], [95, 280]], 'rgba(94,234,212,0.12)', 0);
  } },
  oak: { w: 240, h: 300, world: 3000, collide: 0.14, draw(c) {
    poly(c, [[106, 300], [134, 300], [128, 170], [150, 120], [120, 150], [100, 110], [112, 170]], '#2b1d16', 3);
    [[70, 110, 60], [170, 100, 62], [120, 60, 70], [120, 130, 55]].forEach(([x, y, r], i) => {
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = i % 2 ? '#133024' : '#17392b'; c.fill(); ink(c, 3);
    });
    c.fillStyle = '#fde047'; c.fillRect(104, 128, 5, 4); c.fillRect(116, 128, 5, 4);   // something watching
  } },
  mushroom: { w: 80, h: 70, world: 360, collide: 0, draw(c) {
    glowDot(c, 40, 30, 40, '#5eead4');
    c.fillStyle = '#e2e8f0'; c.fillRect(34, 32, 12, 36);
    c.beginPath(); c.ellipse(40, 32, 32, 18, 0, Math.PI, 0); c.fillStyle = '#14b8a6'; c.fill(); ink(c, 3);
    c.fillStyle = '#ccfbf1'; [[28, 24], [46, 20], [56, 28]].forEach(([x, y]) => { c.beginPath(); c.arc(x, y, 3.5, 0, 7); c.fill(); });
  } },
  stump: { w: 110, h: 70, world: 480, collide: 0.08, draw(c) {
    poly(c, [[10, 68], [100, 68], [90, 20], [20, 20]], '#3b2a1e', 3);
    c.beginPath(); c.ellipse(55, 20, 35, 10, 0, 0, Math.PI * 2); c.fillStyle = '#a16207'; c.fill(); ink(c, 3);
    c.strokeStyle = '#713f12'; c.lineWidth = 2; c.beginPath(); c.ellipse(55, 20, 18, 5, 0, 0, Math.PI * 2); c.stroke();
  } },
  lantern: { w: 60, h: 180, world: 1300, collide: 0.04, draw(c) {
    c.fillStyle = '#2a1a12'; c.fillRect(27, 40, 6, 140);
    glowDot(c, 30, 30, 30, '#5eead4');
    poly(c, [[18, 18], [42, 18], [40, 44], [20, 44]], '#99f6e4', 3);
  } },
  rock: { w: 200, h: 140, world: 1400, collide: 0.22, draw(c) {
    poly(c, [[8, 138], [30, 50], [80, 16], [140, 30], [190, 90], [196, 138]], '#6b3a22', 4);
    poly(c, [[110, 30], [140, 30], [190, 90], [196, 138], [130, 138]], '#4a2616', 0);
    c.strokeStyle = '#2e170c'; c.lineWidth = 3; c.beginPath(); c.moveTo(60, 60); c.lineTo(90, 100); c.lineTo(80, 130); c.stroke();
  } },
  cliff: { w: 260, h: 380, world: 4800, collide: 0.45, draw(c) {
    poly(c, [[0, 380], [20, 120], [60, 60], [100, 80], [150, 10], [210, 60], [250, 180], [260, 380]], '#7c3a1c', 4);
    poly(c, [[150, 10], [210, 60], [250, 180], [260, 380], [170, 380], [180, 160]], '#5a2912', 0);
    c.fillStyle = '#a8521f'; for (let y = 120; y < 370; y += 38) c.fillRect(30, y, 150, 5);
  } },
  cactus: { w: 140, h: 220, world: 1700, collide: 0.07, draw(c) {
    // a cactus of bones
    c.fillStyle = '#e7e0cf'; c.strokeStyle = INK; c.lineWidth = 3;
    const bone = (x, y, w, h) => { c.fillRect(x, y, w, h); c.strokeRect(x, y, w, h); };
    bone(60, 30, 20, 190); bone(20, 80, 44, 16); bone(20, 40, 16, 50); bone(76, 110, 44, 16); bone(104, 70, 16, 50);
    [[70, 28], [28, 38], [112, 68]].forEach(([x, y]) => { c.beginPath(); c.arc(x, y, 11, 0, 7); c.fill(); c.stroke(); });
  } },
  skull: { w: 110, h: 100, world: 760, collide: 0.1, draw(c) {
    c.beginPath(); c.arc(55, 44, 40, Math.PI, 0); c.lineTo(95, 70); c.lineTo(75, 98); c.lineTo(35, 98); c.lineTo(15, 70); c.closePath();
    c.fillStyle = '#e7e0cf'; c.fill(); ink(c, 4);
    c.fillStyle = INK; c.beginPath(); c.ellipse(38, 52, 11, 13, 0, 0, 7); c.ellipse(72, 52, 11, 13, 0, 0, 7); c.fill();
    glowDot(c, 38, 52, 9, '#f97316'); glowDot(c, 72, 52, 9, '#f97316');
    for (let x = 40; x < 74; x += 8) c.fillRect(x, 84, 3, 12);
  } },
  vent: { w: 90, h: 90, world: 520, collide: 0, draw(c) {
    glowDot(c, 45, 60, 45, '#f97316');
    poly(c, [[10, 88], [80, 88], [60, 58], [30, 58]], '#3b1a0e', 3);
    c.fillStyle = '#fbbf24'; c.beginPath(); c.ellipse(45, 58, 15, 5, 0, 0, 7); c.fill();
  } },
  building: { w: 240, h: 480, world: 7000, collide: 0.5, draw(c, rng) {
    const col = ['#1e1b2e', '#241631', '#1a1f2e'][Math.floor(rng() * 3)];
    const hgt = 260 + Math.floor(rng() * 200);
    poly(c, [[6, 480], [234, 480], [234, 480 - hgt], [6, 480 - hgt]], col, 4);
    for (let y = 480 - hgt + 20; y < 460; y += 30) {
      for (let x = 22; x < 220; x += 34) {
        const lit = rng() < 0.4;
        c.fillStyle = lit ? (rng() < 0.3 ? '#f472b6' : '#fde68a') : '#0b0913';
        c.fillRect(x, y, 18, 16);
      }
    }
    if (rng() < 0.5) { poly(c, [[70, 480 - hgt], [170, 480 - hgt], [120, 480 - hgt - 60]], shade(col, 0.1), 4); }
  } },
  neon: { w: 220, h: 300, world: 2600, collide: 0.25, draw(c, rng) {
    c.fillStyle = '#15121e'; c.fillRect(100, 150, 16, 150);
    poly(c, [[10, 20], [210, 20], [210, 150], [10, 150]], '#0b0812', 4);
    const col = rng() < 0.5 ? '#22d3ee' : '#f472b6';
    c.shadowColor = col; c.shadowBlur = 16; c.strokeStyle = col; c.lineWidth = 5; c.strokeRect(22, 32, 176, 106);
    c.fillStyle = col; c.font = 'bold 34px sans-serif'; c.textAlign = 'center';
    c.fillText(['MOTEL', 'CRYPT', 'DINER', 'BAR'][Math.floor(rng() * 4)], 110, 78); c.font = 'bold 22px sans-serif'; c.fillText('OPEN 24 HRS', 110, 118);
    c.shadowBlur = 0;
  } },
  lampPost: { w: 120, h: 300, world: 2800, collide: 0.05, draw(c) {
    c.fillStyle = '#1f1d2b'; c.fillRect(24, 40, 10, 260); c.fillRect(24, 36, 74, 8);
    glowDot(c, 92, 50, 34, '#fbcfe8');
    poly(c, [[80, 42], [104, 42], [98, 56], [86, 56]], '#fdf2f8', 2);
  } },
  barrier: { w: 160, h: 60, world: 420, collide: 0.1, draw(c) {
    poly(c, [[4, 58], [156, 58], [150, 10], [10, 10]], '#e5e7eb', 3);
    c.fillStyle = '#be185d'; for (let x = 16; x < 150; x += 36) poly(c, [[x, 12], [x + 18, 12], [x + 6, 56], [x - 12, 56]], '#be185d', 0);
  } },
  tunnelLight: { w: 40, h: 60, world: 900, collide: 0, draw(c) { glowDot(c, 20, 20, 20, '#fde68a'); c.fillStyle = '#fef3c7'; c.fillRect(12, 14, 16, 8); } }
};

const BILLBOARD_GAMES = [
  { slug: 'spectral-manor-revenger', title: 'Revenger', accent: '#c084fc', bg: '#0a0612' },
  { slug: 'spectral-manor-mess-hall', title: 'Mess Hall', accent: '#f0abfc', bg: '#12091f' },
  { slug: 'spectral-manor-swarm', title: 'Swarm', accent: '#22d3ee', bg: '#0b0614' },
  { slug: 'spectral-skyline', title: "Luno's Flight", accent: '#fbbf24', bg: '#0a0618' },
  { slug: 'spectral-manor-soul-circuit', title: 'Soul Circuit', accent: '#e879f9', bg: '#0a0614' },
  { slug: 'spectral-manor-crystal-dimension', title: 'Crystal Dimension', accent: '#67e8f9', bg: '#06040f' },
  { slug: 'spectral-manor-infestation', title: 'Infestation', accent: '#4ade80', bg: '#0d0618' },
  { slug: 'spectral-manor-beam-me-up', title: 'Beam Me Up: Live!', accent: '#67e8f9', bg: '#06040f' },
  { slug: 'spectral-manor-amp-rampage', title: 'Amp Rampage', accent: '#d9ff63', bg: '#0a0612' },
  { slug: 'spectral-manor-hooded', title: 'House of the Hooded', accent: '#c084fc', bg: '#0b0614' },
  { slug: 'spectral-manor-graveyard-shift', title: 'Graveyard Shift', accent: '#fb7185', bg: '#0d0618' }
];

let SPRITES = null;
function buildSprites() {
  if (SPRITES) return SPRITES;
  SPRITES = {};
  const rng = mulberry32(777);
  Object.entries(SPRITE_DEFS).forEach(([name, d]) => {
    // variety: buildings and neon signs get several painted versions
    const variants = name === 'building' || name === 'neon' ? 4 : name === 'billboard' ? BILLBOARD_GAMES.length : 1;
    SPRITES[name] = [];
    for (let v = 0; v < variants; v++) {
      const cv = makeCanvas(d.w, d.h);
      if (cv) { const c = cv.getContext('2d'); c.lineJoin = 'round'; c.lineCap = 'round'; d.draw(c, rng, v); }
      SPRITES[name].push(cv);
    }
  });
  return SPRITES;
}
function spriteCanvas(name, seed) {
  const list = buildSprites()[name];
  return list ? list[seed % list.length] : null;
}

/* ---------------------------------------------------------------------------
   SKY + PARALLAX LAYERS — one cached set per theme
   --------------------------------------------------------------------------- */
const LAYER_W = 1920, LAYER_H = 260;
const skyCache = {};
function buildSky(theme) {
  if (skyCache[theme.key]) return skyCache[theme.key];
  const rng = mulberry32(theme.seed + 5);
  const sky = makeCanvas(SCREEN_W, SCREEN_H / 2 + 60), far = makeCanvas(LAYER_W, LAYER_H), near = makeCanvas(LAYER_W, LAYER_H);
  const set = { sky, far, near };
  skyCache[theme.key] = set;
  if (!sky) return set;

  let c = sky.getContext('2d');
  const g = c.createLinearGradient(0, 0, 0, sky.height);
  g.addColorStop(0, theme.sky[0]); g.addColorStop(0.6, theme.sky[1]); g.addColorStop(1, theme.sky[2]);
  c.fillStyle = g; c.fillRect(0, 0, sky.width, sky.height);
  if (theme.key !== 'city') {
    for (let i = 0; i < 160; i++) { c.fillStyle = `rgba(255,255,255,${0.2 + rng() * 0.6})`; c.fillRect(rng() * SCREEN_W, rng() * sky.height * 0.7, 1.5, 1.5); }
  }
  const moonR = theme.key === 'canyon' ? 70 : 34, mx = theme.key === 'canyon' ? 640 : 760, my = theme.key === 'canyon' ? 150 : 80;
  const halo = c.createRadialGradient(mx, my, moonR, mx, my, moonR * 3.2);
  halo.addColorStop(0, rgba(theme.glow, 0.35)); halo.addColorStop(1, rgba(theme.glow, 0));
  c.fillStyle = halo; c.fillRect(0, 0, sky.width, sky.height);
  c.fillStyle = theme.moon; c.beginPath(); c.arc(mx, my, moonR, 0, Math.PI * 2); c.fill();
  c.fillStyle = 'rgba(0,0,0,0.12)'; c.beginPath(); c.arc(mx - moonR * 0.3, my - moonR * 0.2, moonR * 0.25, 0, 7); c.arc(mx + moonR * 0.35, my + moonR * 0.3, moonR * 0.18, 0, 7); c.fill();
  if (theme.key === 'city' || theme.key === 'woods') {
    for (let i = 0; i < 9; i++) {
      c.fillStyle = rgba(theme.sky[2], 0.35);
      c.beginPath(); c.ellipse(rng() * SCREEN_W, 40 + rng() * 140, 120 + rng() * 140, 16 + rng() * 14, 0, 0, 7); c.fill();
    }
  }

  // far layer
  c = far.getContext('2d');
  const farCol = shade(theme.sky[2], -0.55), nearCol = shade(theme.grass[0], -0.2);
  c.fillStyle = farCol;
  if (theme.key === 'city') {
    for (let x = 0; x < LAYER_W; x += 26 + rng() * 30) {
      const h = 60 + rng() * 150, w = 30 + rng() * 50;
      c.fillStyle = farCol; c.fillRect(x, LAYER_H - h, w, h);
      for (let wy = LAYER_H - h + 8; wy < LAYER_H - 6; wy += 12) for (let wx = x + 5; wx < x + w - 5; wx += 9) if (rng() < 0.25) { c.fillStyle = rng() < 0.3 ? '#f472b6' : '#fde68a'; c.fillRect(wx, wy, 3, 4); }
    }
  } else {
    c.beginPath(); c.moveTo(0, LAYER_H);
    for (let x = 0; x <= LAYER_W; x += 40) {
      const peak = theme.key === 'canyon' ? (Math.floor(x / 240) % 2 ? 150 : 90) + rng() * 20 : 70 + Math.sin(x * 0.004) * 40 + rng() * 25;
      c.lineTo(x, LAYER_H - peak);
    }
    c.lineTo(LAYER_W, LAYER_H); c.closePath(); c.fill();
    if (theme.key === 'highway') {
      // the manor on the far hill, windows lit
      c.fillRect(1180, 90, 200, 80); poly(c, [[1170, 90], [1230, 45], [1290, 90]], farCol, 0); c.fillRect(1320, 40, 30, 60); poly(c, [[1314, 40], [1335, 10], [1356, 40]], farCol, 0);
      c.fillStyle = 'rgba(232,121,249,0.8)'; [[1200, 110], [1250, 120], [1300, 110], [1330, 60]].forEach(([x, y]) => c.fillRect(x, y, 9, 13));
    }
  }

  // near layer
  c = near.getContext('2d');
  c.fillStyle = nearCol;
  if (theme.key === 'woods' || theme.key === 'highway') {
    c.fillRect(0, LAYER_H - 30, LAYER_W, 30);
    for (let x = 0; x < LAYER_W; x += 22 + rng() * 26) {
      const h = 40 + rng() * 90;
      if (theme.key === 'woods') poly(c, [[x, LAYER_H - 20 - h], [x + 22, LAYER_H - 20], [x - 22, LAYER_H - 20]], nearCol, 0);
      else { c.strokeStyle = nearCol; c.lineWidth = 4; c.beginPath(); c.moveTo(x, LAYER_H - 20); c.lineTo(x, LAYER_H - 20 - h); c.lineTo(x - 18, LAYER_H - 40 - h); c.moveTo(x, LAYER_H - h * 0.6); c.lineTo(x + 20, LAYER_H - h * 0.9); c.stroke(); }
    }
  } else if (theme.key === 'canyon') {
    c.beginPath(); c.moveTo(0, LAYER_H);
    for (let x = 0; x <= LAYER_W; x += 60) c.lineTo(x, LAYER_H - 20 - (x % 360 < 120 ? 110 : 30) - rng() * 20);
    c.lineTo(LAYER_W, LAYER_H); c.fill();
  } else {
    for (let x = 0; x < LAYER_W; x += 60 + rng() * 50) {
      const h = 40 + rng() * 90;
      c.fillStyle = nearCol; c.fillRect(x, LAYER_H - h, 50, h);
      if (rng() < 0.35) { c.fillStyle = rng() < 0.5 ? '#22d3ee' : '#f472b6'; c.fillRect(x + 8, LAYER_H - h + 10, 34, 5); }
    }
  }
  return set;
}
