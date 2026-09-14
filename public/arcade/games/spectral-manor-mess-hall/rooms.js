// ============================================================
// MESS HALL — rooms: layout data + room artwork
// Four rooms, three levels each. Every room has its own hazard:
//   Mess Hall     none (learn the buffet)
//   Kitchen       stoves flare: burners glow, THEN flames burst out
//   Cold Pantry   ice patches: the hero slides with momentum
//   Banquet Hall  chandeliers: a shadow grows, THEN the chandelier drops
// Each room's third level is a set piece: a Buffet Rush in rooms 1 and 3,
// the Head Chef in rooms 2 and 4.
// Furniture is drawn 3/4 view (top face + front face) and depth-sorted with
// the characters by its bottom edge, so a monster behind a table is hidden
// by it rather than walking over it.
// ============================================================

const INK = '#0f0a1a';
const WALL_H = 58;              // back wall band; the floor starts below it

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
function inkPoly(pts, fill, w = 2) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (w) { ctx.strokeStyle = INK; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.stroke(); }
}
function inkOval(x, y, rx, ry, fill, w = 2) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (w) { ctx.strokeStyle = INK; ctx.lineWidth = w; ctx.stroke(); }
}
function inkRect(x, y, w, h, fill, lw = 2) { inkPoly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], fill, lw); }

const ROOMS = [
  {
    name: 'THE MESS HALL', sub: 'Guard the Grand Buffet', finale: 'rush',
    floor: ['#1d1233', '#241640'], wall: '#1e1b4b', trim: '#7c3aed',
    buffet: { x: 405, y: 235 },
    obstacles: [
      { kind: 'table', x: 180, y: 140, w: 110, h: 50 }, { kind: 'table', x: 670, y: 140, w: 110, h: 50 },
      { kind: 'table', x: 180, y: 360, w: 110, h: 50 }, { kind: 'table', x: 670, y: 360, w: 110, h: 50 }
    ]
  },
  {
    name: 'THE KITCHEN', sub: 'Watch the burners', finale: 'boss',
    floor: ['#2a1a1a', '#e7dccb'], wall: '#3b1d17', trim: '#f97316',
    buffet: { x: 405, y: 250 },
    obstacles: [
      { kind: 'stove', x: 170, y: 125, w: 120, h: 56 }, { kind: 'stove', x: 670, y: 125, w: 120, h: 56 },
      { kind: 'counter', x: 170, y: 380, w: 120, h: 44 }, { kind: 'counter', x: 670, y: 380, w: 120, h: 44 }
    ]
  },
  {
    name: 'THE COLD PANTRY', sub: 'Ice underfoot — you will slide', finale: 'rush',
    floor: ['#0f2433', '#12304a'], wall: '#0c1f2e', trim: '#67e8f9',
    buffet: { x: 405, y: 225 },
    ice: [{ x: 205, y: 262, w: 175, h: 118 }, { x: 590, y: 118, w: 175, h: 110 }],
    obstacles: [
      { kind: 'shelf', x: 120, y: 110, w: 60, h: 120 }, { kind: 'shelf', x: 790, y: 300, w: 60, h: 120 },
      { kind: 'crate', x: 300, y: 405, w: 70, h: 48 }, { kind: 'crate', x: 600, y: 400, w: 70, h: 48 }
    ]
  },
  {
    name: 'THE BANQUET HALL', sub: 'Mind the chandeliers', finale: 'boss',
    floor: ['#2b0d14', '#5c1424'], wall: '#1f0a10', trim: '#fbbf24',
    buffet: { x: 405, y: 250 },
    chandeliers: [{ x: 480, y: 150 }, { x: 250, y: 290 }, { x: 710, y: 290 }],
    obstacles: [
      { kind: 'long', x: 130, y: 135, w: 220, h: 46 }, { kind: 'long', x: 610, y: 135, w: 220, h: 46 },
      { kind: 'long', x: 130, y: 380, w: 220, h: 46 }, { kind: 'long', x: 610, y: 380, w: 220, h: 46 }
    ]
  }
];

// ------------------------------------------------------------ floor + wall
// Static per room, so it is painted once into an offscreen canvas. The test
// sandbox has no document.createElement — it just paints directly.
const roomCache = {};
function drawRoomBase(ri, t) {
  const room = ROOMS[ri];
  const canCache = typeof document !== 'undefined' && typeof document.createElement === 'function';
  if (canCache) {
    if (!roomCache[ri]) {
      const off = document.createElement('canvas');
      off.width = W; off.height = H;
      const real = ctx;
      ctx = off.getContext('2d');
      paintFloor(ri); paintWall(ri);
      ctx = real;
      roomCache[ri] = off;
    }
    ctx.drawImage(roomCache[ri], 0, 0);
  } else {
    paintFloor(ri); paintWall(ri);
  }
  wallLife(ri, t);
}

function paintFloor(ri) {
  const room = ROOMS[ri], [a, b] = room.floor;
  ctx.fillStyle = a;
  ctx.fillRect(0, 0, W, H);
  if (ri === 0) {                       // checker tiles
    for (let y = WALL_H; y < H; y += 40) for (let x = 0; x < W; x += 40) {
      if (((x + y) / 40) % 2) { ctx.fillStyle = b; ctx.fillRect(x, y, 40, 40); }
    }
  } else if (ri === 1) {                // black and white kitchen tile, dimmed
    for (let y = WALL_H; y < H; y += 34) for (let x = 0; x < W; x += 34) {
      ctx.fillStyle = ((x + y) / 34) % 2 ? 'rgba(231,220,203,0.22)' : 'rgba(20,12,12,0.6)';
      ctx.fillRect(x, y, 34, 34);
    }
  } else if (ri === 2) {                // frosted stone slabs
    for (let y = WALL_H, row = 0; y < H; y += 48, row++) for (let x = -(row % 2) * 40; x < W; x += 80) {
      ctx.fillStyle = (x / 80 + row) % 3 ? b : shade(b, 0.08);
      ctx.fillRect(x + 1, y + 1, 78, 46);
    }
  } else {                              // wood boards with a red carpet runner
    for (let y = WALL_H; y < H; y += 22) {
      ctx.fillStyle = (y / 22) % 2 ? '#2a1710' : '#241410';
      ctx.fillRect(0, y, W, 21);
    }
    ctx.fillStyle = b;
    ctx.fillRect(60, WALL_H + 30, W - 120, H - WALL_H - 60);
    ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 3;
    ctx.strokeRect(70, WALL_H + 40, W - 140, H - WALL_H - 80);
    // an offset lattice of small medallions (a single row read as a dotted line)
    ctx.fillStyle = 'rgba(251,191,36,0.10)';
    for (let row = 0, y = WALL_H + 80; y < H - 60; y += 70, row++) {
      for (let x = 120 + (row % 2) * 60; x < W - 100; x += 120) {
        ctx.beginPath(); ctx.moveTo(x, y - 9); ctx.lineTo(x + 9, y); ctx.lineTo(x, y + 9); ctx.lineTo(x - 9, y); ctx.closePath(); ctx.fill();
      }
    }
  }
  // soft vignette so the edges of the room fall into shadow
  const v = ctx.createRadialGradient(W / 2, H / 2 + 20, 180, W / 2, H / 2 + 20, 620);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  // bottom skirting
  ctx.fillStyle = room.wall; ctx.fillRect(0, H - 16, W, 16);
  ctx.fillStyle = room.trim; ctx.fillRect(0, H - 18, W, 2);
}

function paintWall(ri) {
  const room = ROOMS[ri];
  const g = ctx.createLinearGradient(0, 0, 0, WALL_H);
  g.addColorStop(0, shade(room.wall, -0.4)); g.addColorStop(1, room.wall);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, WALL_H);
  if (ri === 0) {                       // wallpaper stripes + arched windows
    ctx.fillStyle = 'rgba(124,58,237,0.12)';
    for (let x = 0; x < W; x += 24) ctx.fillRect(x, 0, 10, WALL_H);
    [150, 480, 810].forEach(x => {
      inkPoly([[x - 26, WALL_H - 6], [x - 26, 20], [x, 6], [x + 26, 20], [x + 26, WALL_H - 6]], '#0b1030');
      ctx.strokeStyle = '#4c1d95'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, 8); ctx.lineTo(x, WALL_H - 6); ctx.moveTo(x - 26, 32); ctx.lineTo(x + 26, 32); ctx.stroke();
    });
  } else if (ri === 1) {                // brick + hanging pans
    for (let y = 0, r = 0; y < WALL_H; y += 12, r++) for (let x = -(r % 2) * 16; x < W; x += 32) {
      ctx.fillStyle = (x + r * 7) % 3 ? '#4a2319' : '#562a1e';
      ctx.fillRect(x + 1, y + 1, 30, 10);
    }
    ctx.strokeStyle = '#78716c'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(60, 12); ctx.lineTo(W - 60, 12); ctx.stroke();
    for (let x = 110; x < W - 80; x += 95) {
      ctx.strokeStyle = '#a8a29e'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x, 12); ctx.lineTo(x, 22); ctx.stroke();
      inkOval(x, 32, 10, 10, x % 2 ? '#57534e' : '#b45309');
      ctx.fillStyle = '#44403c'; ctx.fillRect(x - 2, 42, 4, 12);
    }
  } else if (ri === 2) {                // shelves of jars
    for (let row = 0; row < 2; row++) {
      const y = 22 + row * 22;
      ctx.fillStyle = '#3f2a1d'; ctx.fillRect(0, y, W, 4);
      for (let x = 14; x < W; x += 26) {
        const c = ['#7dd3fc', '#fca5a5', '#fde68a', '#86efac'][(x / 26 + row) % 4 | 0];
        inkRect(x, y - 14, 14, 14, rgba(c, 0.55), 1.2);
        ctx.fillStyle = '#e7e5e4'; ctx.fillRect(x, y - 16, 14, 3);
      }
    }
    ctx.fillStyle = 'rgba(224,242,254,0.18)';
    for (let x = 0; x < W; x += 30) ctx.fillRect(x, 0, 18, 3 + (x % 7));
  } else {                              // curtains + portraits
    for (let x = 0; x < W; x += 16) {
      ctx.fillStyle = (x / 16) % 2 ? '#5b0f1d' : '#4a0c18';
      ctx.fillRect(x, 0, 16, WALL_H);
    }
    [240, 480, 720].forEach((x, i) => {
      inkRect(x - 22, 6, 44, 40, '#b45309', 2);
      ctx.fillStyle = ['#1e1b4b', '#14532d', '#3b0764'][i]; ctx.fillRect(x - 17, 11, 34, 30);
      inkOval(x, 22, 7, 8, '#e7e5e4', 1.2);
      ctx.fillStyle = '#0f0a1a'; ctx.fillRect(x - 10, 30, 20, 11);
    });
  }
  ctx.fillStyle = room.trim;
  ctx.fillRect(0, WALL_H - 3, W, 3);
}

// Animated bits of the wall (window moonlight, stove glow, candle flicker)
function wallLife(ri, t) {
  if (ri === 0) {
    [150, 480, 810].forEach((x, i) => {
      ctx.fillStyle = `rgba(196,181,253,${0.10 + Math.sin(t * 0.02 + i) * 0.04})`;
      ctx.beginPath(); ctx.moveTo(x - 22, WALL_H); ctx.lineTo(x + 22, WALL_H); ctx.lineTo(x + 70, WALL_H + 90); ctx.lineTo(x - 10, WALL_H + 90); ctx.closePath(); ctx.fill();
    });
  } else if (ri === 3) {
    [120, 360, 600, 840].forEach((x, i) => {
      const f = 0.6 + Math.sin(t * 0.3 + i * 2) * 0.25;
      ctx.fillStyle = `rgba(251,191,36,${f})`;
      ctx.beginPath(); ctx.ellipse(x, 30, 2.5, 5 + f * 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e7e5e4'; ctx.fillRect(x - 2, 36, 4, 12);
    });
  }
}

// ------------------------------------------------------------ hazards on the floor
function drawIce(room, t) {
  (room.ice || []).forEach(p => {
    ctx.save();
    ctx.beginPath();
    const r = 26;
    ctx.moveTo(p.x + r, p.y);
    ctx.arcTo(p.x + p.w, p.y, p.x + p.w, p.y + p.h, r);
    ctx.arcTo(p.x + p.w, p.y + p.h, p.x, p.y + p.h, r);
    ctx.arcTo(p.x, p.y + p.h, p.x, p.y, r);
    ctx.arcTo(p.x, p.y, p.x + p.w, p.y, r);
    ctx.closePath();
    ctx.fillStyle = 'rgba(186,230,253,0.28)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(224,242,254,0.7)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.clip();
    // moving glints tell you it is slick
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      const gx = p.x + ((t * 1.2 + i * 90) % (p.w + 80)) - 40;
      ctx.beginPath(); ctx.moveTo(gx, p.y + p.h); ctx.lineTo(gx + 40, p.y); ctx.stroke();
    }
    ctx.restore();
  });
}

// ------------------------------------------------------------ furniture
function drawObstacle(o, t) {
  const top = 14;                       // how much of the top face shows above the front face
  switch (o.kind) {
    case 'table': case 'long': {
      const cloth = o.kind === 'long' ? '#f5f0e6' : '#3b2a5a';
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.ellipse(o.x + o.w / 2, o.y + o.h + 8, o.w / 2 + 6, 9, 0, 0, Math.PI * 2); ctx.fill();
      // legs
      ctx.fillStyle = '#1c1024';
      ctx.fillRect(o.x + 8, o.y + o.h - 4, 7, 14); ctx.fillRect(o.x + o.w - 15, o.y + o.h - 4, 7, 14);
      // tablecloth: top face, then the draped front with scalloped hem
      inkRect(o.x, o.y, o.w, o.h - top, cloth);
      const hem = [];
      for (let x = 0; x <= o.w; x += 11) hem.push([o.x + x, o.y + o.h + (x / 11 % 2 ? 2 : -1)]);
      inkPoly([[o.x, o.y + o.h - top], [o.x + o.w, o.y + o.h - top], ...hem.reverse()], shade(cloth, -0.22));
      if (o.kind === 'long') {
        ctx.fillStyle = '#b91c1c'; ctx.fillRect(o.x + 6, o.y + 8, o.w - 12, 6);  // runner
        for (let x = o.x + 30; x < o.x + o.w - 20; x += 55) {                    // candles
          ctx.fillStyle = '#fef3c7'; ctx.fillRect(x - 2, o.y + 2, 4, 10);
          ctx.fillStyle = `rgba(251,191,36,${0.7 + Math.sin(t * 0.3 + x) * 0.3})`;
          ctx.beginPath(); ctx.ellipse(x, o.y, 2.5, 4, 0, 0, Math.PI * 2); ctx.fill();
        }
      } else {
        ctx.fillStyle = '#e9d5ff'; ctx.beginPath(); ctx.ellipse(o.x + 30, o.y + 16, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(o.x + o.w - 30, o.y + 14, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case 'counter': {
      inkRect(o.x, o.y, o.w, o.h - top, '#d6d3d1');
      inkRect(o.x, o.y + o.h - top, o.w, top + 6, '#57534e');
      ctx.fillStyle = '#a8a29e';
      for (let x = o.x + 20; x < o.x + o.w; x += 40) ctx.fillRect(x - 6, o.y + o.h - 6, 12, 2);
      inkRect(o.x + 14, o.y + 6, 34, 16, '#b45309', 1.5);                      // chopping board
      ctx.fillStyle = '#e7e5e4'; ctx.fillRect(o.x + 60, o.y + 10, 30, 4);        // cleaver
      ctx.fillStyle = '#44403c'; ctx.fillRect(o.x + 88, o.y + 9, 10, 6);
      break;
    }
    case 'stove': {
      inkRect(o.x, o.y, o.w, o.h - top, '#44403c');
      inkRect(o.x, o.y + o.h - top, o.w, top + 6, '#292524');
      ctx.fillStyle = '#0c0a09'; ctx.fillRect(o.x + 20, o.y + o.h - top + 3, o.w - 40, top - 2); // oven door
      const heat = o.flare ? (o.flare.phase === 'warn' ? 1 - o.flare.t / STOVE_WARN : o.flare.phase === 'fire' ? 1 : 0) : 0;
      [[0.27, 0.35], [0.73, 0.35]].forEach(([fx, fy]) => {
        const bx = o.x + o.w * fx, by = o.y + (o.h - top) * fy + 6;
        inkOval(bx, by, 17, 9, '#1c1917', 1.5);
        ctx.strokeStyle = heat > 0 ? `rgba(249,115,22,${0.4 + heat * 0.6})` : '#57534e';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(bx, by, 11, 5.5, 0, 0, Math.PI * 2); ctx.stroke();
      });
      break;
    }
    case 'shelf': {
      inkRect(o.x, o.y, o.w, o.h, '#5b3a24');
      for (let s = 0; s < 4; s++) {
        const y = o.y + 10 + s * 28;
        ctx.fillStyle = '#3f2a1d'; ctx.fillRect(o.x + 4, y + 16, o.w - 8, 4);
        for (let k = 0; k < 3; k++) {
          const c = ['#fca5a5', '#fde68a', '#93c5fd', '#86efac'][(s + k) % 4];
          inkRect(o.x + 8 + k * 16, y, 12, 16, rgba(c, 0.8), 1.2);
        }
      }
      ctx.fillStyle = 'rgba(224,242,254,0.35)'; ctx.fillRect(o.x, o.y - 3, o.w, 5);  // frost on top
      break;
    }
    case 'crate': {
      inkRect(o.x, o.y, o.w, o.h - top, '#a16207');
      inkRect(o.x, o.y + o.h - top, o.w, top + 4, '#854d0e');
      ctx.strokeStyle = '#713f12'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(o.x + 4, o.y + 4); ctx.lineTo(o.x + o.w - 4, o.y + o.h - top - 4); ctx.stroke();
      ctx.fillStyle = 'rgba(224,242,254,0.4)'; ctx.fillRect(o.x + 2, o.y, o.w - 4, 3);
      break;
    }
  }
}

const STOVE_IDLE = 200, STOVE_WARN = 70, STOVE_FIRE = 55, STOVE_REACH = 26;

// Flames are drawn over the stove in the depth pass.
function drawStoveFlames(o, t) {
  if (!o.flare || o.flare.phase === 'idle') return;
  const warn = o.flare.phase === 'warn';
  const k = warn ? 1 - o.flare.t / STOVE_WARN : 1;
  if (warn) {                           // TELL: heat shimmer + the danger zone outline
    ctx.strokeStyle = `rgba(249,115,22,${0.15 + k * 0.5})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.strokeRect(o.x - STOVE_REACH, o.y - STOVE_REACH, o.w + STOVE_REACH * 2, o.h + STOVE_REACH * 2);
    ctx.setLineDash([]);
    for (let i = 0; i < 4; i++) {
      const x = o.x + 20 + i * ((o.w - 40) / 3);
      ctx.strokeStyle = `rgba(254,215,170,${k * 0.35})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, o.y + 10);
      ctx.quadraticCurveTo(x + Math.sin(t * 0.3 + i) * 6, o.y - 8, x, o.y - 24 * k);
      ctx.stroke();
    }
    return;
  }
  // FIRE: tongues of flame all around the stove, reaching STOVE_REACH out
  const flame = (x, y, h, i) => {
    const sway = Math.sin(t * 0.5 + i * 1.7) * 4, hh = h * (0.8 + Math.sin(t * 0.7 + i) * 0.2);
    ctx.fillStyle = 'rgba(234,88,12,0.85)';
    ctx.beginPath(); ctx.moveTo(x - 9, y); ctx.quadraticCurveTo(x - 6 + sway, y - hh * 0.6, x + sway, y - hh); ctx.quadraticCurveTo(x + 8 + sway, y - hh * 0.5, x + 9, y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(254,240,138,0.9)';
    ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.quadraticCurveTo(x - 2 + sway, y - hh * 0.4, x + sway * 0.6, y - hh * 0.6); ctx.quadraticCurveTo(x + 4, y - hh * 0.3, x + 4, y); ctx.closePath(); ctx.fill();
  };
  const glow = ctx.createRadialGradient(o.x + o.w / 2, o.y + o.h / 2, 10, o.x + o.w / 2, o.y + o.h / 2, o.w);
  glow.addColorStop(0, 'rgba(249,115,22,0.35)'); glow.addColorStop(1, 'rgba(249,115,22,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(o.x - o.w / 2, o.y + o.h / 2 - o.w, o.w * 2, o.w * 2);
  let i = 0;
  for (let x = o.x - STOVE_REACH + 10; x <= o.x + o.w + STOVE_REACH - 10; x += 18) {
    flame(x, o.y + 4, 30, i++);
    flame(x, o.y + o.h + STOVE_REACH, 26, i++);
  }
  for (let y = o.y + 16; y <= o.y + o.h + STOVE_REACH; y += 18) {
    flame(o.x - STOVE_REACH + 8, y, 24, i++);
    flame(o.x + o.w + STOVE_REACH - 8, y, 24, i++);
  }
}

// ------------------------------------------------------------ chandeliers
const CHAND_WARN = 80, CHAND_FALL = 16, CHAND_BROKEN = 360, CHAND_RADIUS = 46;

function drawChandelierShadow(c) {
  if (c.state === 'warn') {             // TELL: shadow darkens and grows where it will land
    const k = 1 - c.t / CHAND_WARN;
    ctx.fillStyle = `rgba(0,0,0,${0.2 + k * 0.4})`;
    ctx.beginPath(); ctx.ellipse(c.tx, c.ty, CHAND_RADIUS * (0.4 + k * 0.6), CHAND_RADIUS * 0.45 * (0.4 + k * 0.6), 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(248,113,113,${0.3 + k * 0.6})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(c.tx, c.ty, CHAND_RADIUS, CHAND_RADIUS * 0.45, 0, 0, Math.PI * 2); ctx.stroke();
  } else if (c.state === 'broken') {
    ctx.globalAlpha = Math.min(1, c.t / 60);
    ctx.fillStyle = '#fef3c7';
    for (let i = 0; i < 9; i++) {
      const a = i * 0.7 + c.tx, r = 10 + (i * 13) % 30;
      ctx.fillRect(c.tx + Math.cos(a) * r, c.ty + Math.sin(a) * r * 0.45, 4, 2);
    }
    inkOval(c.tx, c.ty, 26, 9, null, 3);
    ctx.globalAlpha = 1;
  } else if (c.state === 'hung') {
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.ellipse(c.x, c.y, 24, 8, 0, 0, Math.PI * 2); ctx.fill();
  }
}

function drawChandelier(c, t) {
  if (c.state === 'broken') return;
  let x = c.x, y = c.y - 86;
  if (c.state === 'warn') { x = c.x + (c.tx - c.x) * (1 - c.t / CHAND_WARN) + Math.sin(t * 0.8) * 3; y = c.ty - 86; }
  if (c.state === 'fall') { x = c.tx; y = c.ty - 86 * (c.t / CHAND_FALL); }
  // a short chain that fades upward — a full-height line from the top edge
  // read as a rendering glitch, especially when it slid across the floor
  if (c.state !== 'fall') {
    const cg = ctx.createLinearGradient(0, y - 44, 0, y - 8);
    cg.addColorStop(0, 'rgba(120,113,108,0)'); cg.addColorStop(1, 'rgba(120,113,108,1)');
    ctx.strokeStyle = cg; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y - 44); ctx.lineTo(x, y - 8); ctx.stroke();
  }
  inkOval(x, y, 26, 8, '#b45309', 2);
  inkOval(x, y - 4, 10, 5, '#fbbf24', 1.5);
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2, cx = x + Math.cos(a) * 22, cy = y + Math.sin(a) * 6;
    ctx.fillStyle = '#fef3c7'; ctx.fillRect(cx - 1.5, cy - 9, 3, 8);
    ctx.fillStyle = `rgba(251,191,36,${0.7 + Math.sin(t * 0.4 + i) * 0.3})`;
    ctx.beginPath(); ctx.ellipse(cx, cy - 12, 2, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  }
}
