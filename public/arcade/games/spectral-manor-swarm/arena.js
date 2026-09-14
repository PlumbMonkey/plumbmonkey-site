// ============================================================
// SWARM — arenas: themes, props, hazards and lighting
// Three arenas, five waves each; the fifth is a boss wave.
//   THE GRAVEYARD        graves crack, glow, then a monster claws out
//   THE CONCERT GROUNDS  possessed speakers throb, then blast a shockwave
//                        ring that SHOVES (it never costs a life)
//   THE MANOR COURTYARD  a storm: strike rings pulse, then lightning lands
// Every hazard is telegraphed from its own source.
// ============================================================

const INK = '#0f0a1a';
const WAVES_PER_ARENA = 5;

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
  ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (w) { ctx.strokeStyle = INK; ctx.lineWidth = w; ctx.stroke(); }
}
function inkRect(x, y, w, h, fill, lw = 2) { inkPoly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], fill, lw); }

const ARENAS = [
  { name: 'THE GRAVEYARD', sub: 'The graves are opening', hazard: 'graves', prop: 'crypt', accent: '#4ade80', light: '#c4b5fd', boss: 'golem', bossName: 'THE GRAVEKEEPER GOLEM' },
  { name: 'THE CONCERT GROUNDS', sub: 'The speakers are possessed', hazard: 'speakers', prop: 'speaker', accent: '#f472b6', light: '#f0abfc', boss: 'banshee', bossName: 'THE BANSHEE ARCHON' },
  { name: 'THE MANOR COURTYARD', sub: 'A storm is breaking', hazard: 'lightning', prop: 'hedge', accent: '#67e8f9', light: '#a5f3fc', boss: 'duo', bossName: 'GOLEM AND BANSHEE' }
];
const arenaOf = w => Math.floor((w - 1) / WAVES_PER_ARENA) % ARENAS.length;
const isBossWave = w => w % WAVES_PER_ARENA === 0;
const cycleOfWave = w => Math.floor((w - 1) / (WAVES_PER_ARENA * ARENAS.length));

// ------------------------------------------------------------ floor (cached)
const floorCache = {};
function drawArenaFloor(ai) {
  const canCache = typeof document !== 'undefined' && typeof document.createElement === 'function';
  if (!canCache) { paintFloor(ai); return; }
  if (!floorCache[ai]) {
    const off = document.createElement('canvas');
    off.width = W; off.height = H;
    const real = ctx; ctx = off.getContext('2d');
    paintFloor(ai);
    ctx = real;
    floorCache[ai] = off;
  }
  ctx.drawImage(floorCache[ai], 0, 0);
}

// deterministic scatter so the cached floor is the same every visit
function seeded(i, k) { const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); }

function paintFloor(ai) {
  if (ai === 0) {
    // earth, a flagstone cross path, grass tufts, fence and small headstones
    ctx.fillStyle = '#151021'; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = `rgba(${40 + seeded(i, 1) * 30},${30 + seeded(i, 2) * 20},${55 + seeded(i, 3) * 30},0.35)`;
      ctx.beginPath(); ctx.ellipse(seeded(i, 4) * W, seeded(i, 5) * H, 30 + seeded(i, 6) * 60, 12 + seeded(i, 7) * 20, 0, 0, Math.PI * 2); ctx.fill();
    }
    const stone = (x, y, w, h, i) => { ctx.fillStyle = seeded(i, 9) > 0.5 ? '#2a2238' : '#241d31'; ctx.fillRect(x + 1, y + 1, w - 2, h - 2); ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(x + 1, y + 1, w - 2, 3); };
    let i = 0;
    for (let x = 0; x < W; x += 44) stone(x, H / 2 - 22, 44, 44, i++);
    for (let y = 0; y < H; y += 44) if (Math.abs(y + 22 - H / 2) > 30) stone(W / 2 - 22, y, 44, 44, i++);
    ctx.strokeStyle = 'rgba(74,222,128,0.25)'; ctx.lineWidth = 1.5;
    for (let k = 0; k < 140; k++) {
      const x = seeded(k, 11) * W, y = seeded(k, 12) * H;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 2, y - 5); ctx.moveTo(x, y); ctx.lineTo(x + 2, y - 6); ctx.stroke();
    }
    for (let k = 0; k < 14; k++) {                           // tiny background headstones
      const x = 30 + seeded(k, 13) * (W - 60), y = seeded(k, 14) < 0.5 ? 18 + seeded(k, 15) * 20 : H - 30 - seeded(k, 15) * 14;
      ctx.fillStyle = '#3b3350'; ctx.beginPath(); ctx.moveTo(x - 6, y + 10); ctx.lineTo(x - 6, y); ctx.arc(x, y, 6, Math.PI, 0); ctx.lineTo(x + 6, y + 10); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = '#0b0712';                                // iron fence along the top
    for (let x = 6; x < W; x += 14) { ctx.fillRect(x, 0, 3, 14); ctx.beginPath(); ctx.moveTo(x - 2, 2); ctx.lineTo(x + 1.5, -4); ctx.lineTo(x + 5, 2); ctx.fill(); }
    ctx.fillRect(0, 10, W, 3);
  } else if (ai === 1) {
    // trampled field in front of a stage: the stage apron lines the top
    ctx.fillStyle = '#120b1b'; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 120; i++) {
      ctx.fillStyle = `rgba(${30 + seeded(i, 1) * 30},${20 + seeded(i, 2) * 30},${40 + seeded(i, 3) * 30},0.4)`;
      ctx.beginPath(); ctx.ellipse(seeded(i, 4) * W, seeded(i, 5) * H, 20 + seeded(i, 6) * 50, 8 + seeded(i, 7) * 16, 0, 0, Math.PI * 2); ctx.fill();
    }
    const g = ctx.createLinearGradient(0, 0, 0, 34);
    g.addColorStop(0, '#2b1a3d'); g.addColorStop(1, '#1c1128');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 34);
    ctx.fillStyle = '#f472b6'; ctx.fillRect(0, 33, W, 2);
    for (let x = 20; x < W; x += 60) { ctx.fillStyle = '#0b0712'; ctx.fillRect(x, 4, 34, 22); ctx.fillStyle = '#3f2a55'; ctx.beginPath(); ctx.arc(x + 17, 15, 7, 0, Math.PI * 2); ctx.fill(); }
    for (let k = 0; k < 60; k++) {                            // litter: cups and glowsticks
      const x = seeded(k, 21) * W, y = 50 + seeded(k, 22) * (H - 60);
      ctx.fillStyle = k % 3 ? 'rgba(244,114,182,0.5)' : 'rgba(103,232,249,0.5)';
      ctx.save(); ctx.translate(x, y); ctx.rotate(seeded(k, 23) * 6); ctx.fillRect(-4, -1, 8, 2); ctx.restore();
    }
  } else {
    // wet cobblestones with a mosaic ring and hedge borders
    ctx.fillStyle = '#0d1618'; ctx.fillRect(0, 0, W, H);
    for (let y = 0, r = 0; y < H; y += 18, r++) for (let x = -(r % 2) * 11; x < W; x += 22) {
      const i = r * 50 + x;
      ctx.fillStyle = seeded(i, 1) > 0.5 ? '#18262a' : '#142024';
      ctx.beginPath(); ctx.ellipse(x + 11, y + 9, 10, 8, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(103,232,249,0.14)'; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.ellipse(W / 2, H / 2, 190, 120, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(165,243,252,0.08)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(W / 2, H / 2, 140, 86, 0, 0, Math.PI * 2); ctx.stroke();
    for (let k = 0; k < 10; k++) {                            // puddles
      const x = seeded(k, 31) * W, y = seeded(k, 32) * H;
      ctx.fillStyle = 'rgba(103,232,249,0.07)';
      ctx.beginPath(); ctx.ellipse(x, y, 30 + seeded(k, 33) * 30, 8 + seeded(k, 34) * 6, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#0f2a1a';
    ctx.fillRect(0, 0, W, 16); ctx.fillRect(0, H - 14, W, 14);
    for (let x = 0; x < W; x += 18) { ctx.fillStyle = '#14532d'; ctx.beginPath(); ctx.arc(x + 9, 14, 9, Math.PI, 0); ctx.fill(); ctx.beginPath(); ctx.arc(x + 9, H - 14, 9, 0, Math.PI); ctx.fill(); }
  }
}

// ------------------------------------------------------------ live atmosphere
function drawAtmosphere(ai, t) {
  if (ai === 0) {
    const mg = ctx.createRadialGradient(W - 90, 60, 10, W - 90, 60, 260);
    mg.addColorStop(0, 'rgba(233,213,255,0.16)'); mg.addColorStop(1, 'rgba(233,213,255,0)');
    ctx.fillStyle = mg; ctx.fillRect(W - 350, 0, 350, 320);
  } else if (ai === 1) {
    // two sweeping stage spotlights, fading well inside their own fill
    for (let i = 0; i < 2; i++) {
      const sx = W * (0.3 + i * 0.4), a = Math.sin(t * 0.012 + i * 2) * 0.6 + Math.PI / 2;
      ctx.save();
      ctx.translate(sx, 30); ctx.rotate(a - Math.PI / 2);
      const bg = ctx.createLinearGradient(0, 0, 0, 480);
      bg.addColorStop(0, i ? 'rgba(103,232,249,0.16)' : 'rgba(244,114,182,0.16)'); bg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.lineTo(110, 480); ctx.lineTo(-110, 480); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  } else {
    // rain streaks — short, so they read as rain, never as scan lines
    ctx.strokeStyle = 'rgba(165,243,252,0.18)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 70; i++) {
      const x = (seeded(i, 41) * W + t * 2) % W, y = (seeded(i, 42) * H + t * 9 * (0.7 + seeded(i, 43) * 0.6)) % H;
      ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 11);
    }
    ctx.stroke();
  }
  // drifting ground fog in every arena
  for (let i = 0; i < 4; i++) {
    const x = ((t * 0.25 * (i + 1) + i * 290) % (W + 300)) - 150, y = 90 + i * 120;
    const fg = ctx.createRadialGradient(x, y, 5, x, y, 110);
    fg.addColorStop(0, 'rgba(196,181,253,0.07)'); fg.addColorStop(1, 'rgba(196,181,253,0)');
    ctx.fillStyle = fg; ctx.fillRect(x - 110, y - 110, 220, 220);
  }
}

// Darkness with a light pool around the hero. Bright things are drawn AFTER
// this with additive glow, so shots light up the dark rather than sit on it.
function drawDarkness(px, py, ai, flash) {
  const g = ctx.createRadialGradient(px, py, 70, px, py, 520);
  g.addColorStop(0, 'rgba(4,2,10,0)');
  g.addColorStop(1, `rgba(4,2,10,${0.62 - flash * 0.5})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  if (flash > 0) { ctx.fillStyle = `rgba(224,242,254,${flash * 0.35})`; ctx.fillRect(0, 0, W, H); }
}

// ------------------------------------------------------------ props (obstacles)
function drawObstacle(o, t, beat) {
  const lift = 12;                                  // 3/4 view: top face + front face
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(o.x + o.w / 2, o.y + o.h + 4, o.w / 2 + 6, 7, 0, 0, Math.PI * 2); ctx.fill();
  if (o.kind === 'crypt') {
    inkRect(o.x, o.y + o.h - lift, o.w, lift, '#2b2338');
    inkRect(o.x, o.y, o.w, o.h - lift, '#3d3452');
    inkRect(o.x + 4, o.y + 3, o.w - 8, o.h - lift - 6, '#4a4063', 1.5);         // lid
    ctx.fillStyle = '#2b2338'; ctx.fillRect(o.x + o.w / 2 - 1.5, o.y + 6, 3, o.h - lift - 12);
    ctx.fillRect(o.x + o.w / 2 - 7, o.y + 10, 14, 3);                            // cross
    ctx.fillStyle = 'rgba(74,222,128,0.35)'; ctx.fillRect(o.x, o.y + o.h - lift, o.w * 0.4, 3); // moss
    const cx = o.x + o.w - 8, cy = o.y + 4;                                      // candle
    ctx.fillStyle = '#fef3c7'; ctx.fillRect(cx - 1.5, cy - 7, 3, 7);
    ctx.fillStyle = `rgba(251,191,36,${0.7 + Math.sin(t * 0.3 + o.x) * 0.3})`;
    ctx.beginPath(); ctx.ellipse(cx, cy - 9, 2, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  } else if (o.kind === 'speaker') {
    const hot = o.pulse ? o.pulse.phase === 'warn' ? 1 - o.pulse.t / SPEAKER_WARN : 0 : 0;
    inkRect(o.x, o.y + o.h - lift, o.w, lift, '#18181b');
    inkRect(o.x, o.y, o.w, o.h - lift, '#27272a');
    const cones = Math.max(1, Math.floor(o.w / 30));
    for (let i = 0; i < cones; i++) {
      const cx = o.x + (i + 0.5) * (o.w / cones), cy = o.y + (o.h - lift) / 2;
      const r = Math.min(12, (o.h - lift) / 2 - 3) * (1 + beat * 0.08 + hot * Math.sin(t * 0.9) * 0.12);
      inkOval(cx, cy, r, r * 0.9, '#0b0b0f', 1.5);
      inkOval(cx, cy, r * 0.45, r * 0.4, hot > 0 ? `rgba(244,114,182,${0.4 + hot * 0.6})` : '#3f3f46', 1.2);
    }
    ctx.fillStyle = '#f472b6'; ctx.fillRect(o.x + 4, o.y + o.h - lift + 4, 6, 3);  // power LED
  } else {
    const leaf = '#166534';
    inkRect(o.x, o.y + o.h - lift, o.w, lift, shade(leaf, -0.35));
    ctx.beginPath();
    for (let x = o.x; x <= o.x + o.w; x += 10) ctx.arc(x + 5, o.y + 5, 6, Math.PI, 0);
    ctx.lineTo(o.x + o.w, o.y + o.h - lift); ctx.lineTo(o.x, o.y + o.h - lift); ctx.closePath();
    ctx.fillStyle = leaf; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'rgba(134,239,172,0.25)';
    for (let k = 0; k < 6; k++) ctx.fillRect(o.x + 6 + seeded(k, o.x) * (o.w - 12), o.y + 6 + seeded(k, o.y) * (o.h - lift - 12), 4, 3);
  }
}

// ------------------------------------------------------------ hazards
const GRAVE_CRACK = 90, SPEAKER_WARN = 70, STRIKE_WARN = 75, STRIKE_FLASH = 14, STRIKE_RADIUS = 48;

function drawGrave(g, t) {
  const cracking = g.state === 'crack', k = cracking ? 1 - g.t / GRAVE_CRACK : 0;
  const sh = cracking ? Math.sin(t * 1.3) * k * 2.5 : 0;
  inkRect(g.x - 18, g.y - 6, 36, 16, g.state === 'open' ? '#0b0712' : '#2a1f14', 1.5);   // plot
  if (cracking) {                                         // TELL: glowing fissures + shaking headstone
    ctx.strokeStyle = `rgba(74,222,128,${0.3 + k * 0.7})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(g.x - 14, g.y); ctx.lineTo(g.x - 4, g.y + 4); ctx.lineTo(g.x + 3, g.y - 2); ctx.lineTo(g.x + 14, g.y + 5); ctx.stroke();
    ctx.fillStyle = `rgba(74,222,128,${k * 0.25})`;
    ctx.beginPath(); ctx.ellipse(g.x, g.y + 2, 30 * k + 10, 12 * k + 4, 0, 0, Math.PI * 2); ctx.fill();
  }
  if (g.state === 'open') {                               // a claw reaching out
    const up = Math.min(1, (60 - g.t) / 20);
    ctx.strokeStyle = '#86efac'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (let f = -1; f <= 1; f++) { ctx.beginPath(); ctx.moveTo(g.x + f * 4, g.y + 2); ctx.lineTo(g.x + f * 6, g.y - 10 * up); ctx.stroke(); }
  }
  ctx.save(); ctx.translate(g.x + sh, g.y - 8);
  ctx.beginPath(); ctx.moveTo(-9, 2); ctx.lineTo(-9, -14); ctx.arc(0, -14, 9, Math.PI, 0); ctx.lineTo(9, 2); ctx.closePath();
  ctx.fillStyle = '#5b536e'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#3b3350'; ctx.fillRect(-4, -16, 8, 2); ctx.fillRect(-1, -20, 2, 10);
  ctx.restore();
}

function drawShockRings(rings) {
  rings.forEach(r => {
    const a = r.life / r.maxLife;
    ctx.strokeStyle = `rgba(244,114,182,${a * 0.8})`; ctx.lineWidth = 5 * a + 2;
    ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r, r.r * 0.75, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${a * 0.5})`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r - 6, (r.r - 6) * 0.75, 0, 0, Math.PI * 2); ctx.stroke();
  });
}

function drawStrikeWarn(s, t) {
  const k = 1 - s.t / STRIKE_WARN;
  ctx.strokeStyle = `rgba(165,243,252,${0.25 + k * 0.7})`; ctx.lineWidth = 2 + k * 2;
  ctx.beginPath(); ctx.ellipse(s.x, s.y, STRIKE_RADIUS, STRIKE_RADIUS * 0.6, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = `rgba(165,243,252,${k * 0.18 + Math.sin(t * 0.6) * 0.04})`;
  ctx.beginPath(); ctx.ellipse(s.x, s.y, STRIKE_RADIUS * k, STRIKE_RADIUS * 0.6 * k, 0, 0, Math.PI * 2); ctx.fill();
}

// the bolt itself: thick, jagged and only on screen for STRIKE_FLASH frames
function drawStrikeBolt(s) {
  const a = s.t / STRIKE_FLASH;
  const pts = [[s.x + (seeded(s.seed, 0) - 0.5) * 60, -10]];
  for (let i = 1; i <= 8; i++) pts.push([s.x + (seeded(s.seed, i) - 0.5) * (70 - i * 7), (s.y / 8) * i]);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  [[16, `rgba(103,232,249,${a * 0.35})`], [7, `rgba(165,243,252,${a * 0.8})`], [2.5, `rgba(255,255,255,${a})`]].forEach(([w, c]) => {
    ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineJoin = 'round';
    ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
  });
  ctx.restore();
}
