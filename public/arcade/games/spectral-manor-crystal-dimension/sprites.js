// ============================================================
// CRYSTAL DIMENSION — scenery, hero, crystals, pickups
// House style (shared with wave3/sprite-kit.js): an ink outline, a shade pass
// derived from the base colour, and lights that glow rather than paint.
// Everything animates off `tick` (the fixed 60 Hz frame counter in game.js),
// never the wall clock, so frames are deterministic under test.
// ============================================================

const INK = '#0f0a1a';
const LIGHT_ANGLE = -2.3; // world-space key light from the upper left

function tint(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const target = amt < 0 ? 0 : 255, p = Math.abs(amt);
  const ch = v => Math.round(v + (target - v) * p);
  return '#' + ((1 << 24) + (ch((n >> 16) & 255) << 16) + (ch((n >> 8) & 255) << 8) + ch(n & 255)).toString(16).slice(1);
}
function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
function glowOn(color, blur) { ctx.shadowColor = color; ctx.shadowBlur = blur; }
function glowOff() { ctx.shadowBlur = 0; }
function poly(pts, fill, stroke, width) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width || 2; ctx.lineJoin = 'round'; ctx.stroke(); }
}

// ------------------------------------------------------------ background
function drawBackground(sector) {
  const pal = sector.palette, t = tick;
  const g = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, 560);
  g.addColorStop(0, pal.void[0]); g.addColorStop(0.6, pal.void[1]); g.addColorStop(1, pal.void[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  for (let i = 0; i < 3; i++) {
    const nx = W / 2 + Math.sin(t * 0.0008 + i * 2.1) * 300;
    const ny = H / 2 + Math.cos(t * 0.0006 + i * 1.7) * 160;
    const ng = ctx.createRadialGradient(nx, ny, 10, nx, ny, 220);
    ng.addColorStop(0, pal.nebula[i]); ng.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = ng;
    ctx.fillRect(nx - 220, ny - 220, 440, 440); // gradient fades out inside its own fill
  }

  for (let band = 0; band < 2; band++) {
    ctx.beginPath();
    for (let x = 0; x <= W; x += 20) {
      const y = H * (0.25 + band * 0.5) + Math.sin(x * 0.008 + t * 0.006 + band * 3) * 40 + Math.sin(x * 0.02 + t * 0.011) * 12;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = pal.aurora[band];
    ctx.lineWidth = 26;
    ctx.stroke();
  }

  ctx.fillStyle = pal.star;
  // Hash-scattered: the old (i*97, i*53) layout put every star on a few
  // diagonal lines, which read as a rendering artifact.
  for (let i = 0; i < 80; i++) {
    const hx = Math.sin(i * 12.9898) * 43758.5453, hy = Math.sin(i * 78.233) * 12543.123;
    const sx = ((hx - Math.floor(hx)) * W + (i % 3) * t * 0.02) % W, sy = (hy - Math.floor(hy)) * H;
    ctx.globalAlpha = 0.25 + Math.abs(Math.sin(t * 0.016 + i)) * 0.45;
    const s = i % 7 === 0 ? 2 : 1.4;
    ctx.fillRect(sx, sy, s, s);
  }
  ctx.globalAlpha = 1;

  const feature = SCENERY[SECTORS.indexOf(sector)];
  if (feature) feature(t);
}

// One far-layer set piece per sector, drawn faint so it never reads as solid.
const SCENERY = [
  // Amethyst Drift: pieces of the manor tumbling through the void
  t => {
    for (let i = 0; i < 4; i++) {
      const x = ((i * 283 + t * (0.08 + i * 0.03)) % (W + 240)) - 120;
      const y = 80 + i * 118 + Math.sin(t * 0.01 + i) * 14;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.sin(t * 0.004 + i * 2) * 0.5);
      ctx.globalAlpha = 0.16;
      ctx.strokeStyle = '#c4b5fd';
      ctx.lineWidth = 2;
      if (i % 2 === 0) {            // gothic window frame
        ctx.beginPath();
        ctx.moveTo(-14, 20); ctx.lineTo(-14, -6); ctx.quadraticCurveTo(0, -26, 14, -6); ctx.lineTo(14, 20); ctx.closePath();
        ctx.moveTo(0, -18); ctx.lineTo(0, 20); ctx.moveTo(-14, 4); ctx.lineTo(14, 4);
        ctx.stroke();
      } else {                      // broken staircase
        ctx.beginPath();
        for (let s = 0; s < 4; s++) { ctx.moveTo(-24 + s * 12, 12 - s * 8); ctx.lineTo(-12 + s * 12, 12 - s * 8); ctx.lineTo(-12 + s * 12, 4 - s * 8); }
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  },
  // Rose Nebula: slow veils of dust
  t => {
    for (let i = 0; i < 2; i++) {
      const x = W * (0.3 + i * 0.4) + Math.sin(t * 0.003 + i) * 60, y = H * (0.35 + i * 0.3);
      const vg = ctx.createRadialGradient(x, y, 0, x, y, 160);
      vg.addColorStop(0, 'rgba(253,164,175,0.06)'); vg.addColorStop(1, 'rgba(253,164,175,0)');
      ctx.fillStyle = vg;
      ctx.fillRect(x - 160, y - 160, 320, 320);
    }
  },
  // Frozen Void: distant ice needles
  t => {
    ctx.strokeStyle = 'rgba(186,230,253,0.12)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 9; i++) {
      const x = (i * 131 + t * 0.05) % W, y = (i * 71) % H, a = i * 0.7 + t * 0.002;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * 18, y + Math.sin(a) * 18);
      ctx.lineTo(x - Math.cos(a) * 18, y - Math.sin(a) * 18);
      ctx.stroke();
    }
  },
  // Prism Core: rays turning slowly around the centre
  t => {
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(t * 0.0015);
    for (let i = 0; i < 12; i++) {
      ctx.rotate(Math.PI / 6);
      ctx.fillStyle = i % 2 ? 'rgba(253,224,71,0.025)' : 'rgba(240,171,252,0.025)';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(560, -40); ctx.lineTo(560, 40); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
];

// ------------------------------------------------------------ hazards
function drawClouds(clouds) {
  clouds.forEach(c => {
    const pulse = 1 + Math.sin(tick * 0.03 + c.seed) * 0.05;
    const cg = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r * pulse);
    cg.addColorStop(0, 'rgba(251,113,133,0.20)');
    cg.addColorStop(0.7, 'rgba(251,113,133,0.10)');
    cg.addColorStop(1, 'rgba(251,113,133,0)');
    ctx.fillStyle = cg;
    ctx.fillRect(c.x - c.r * 1.1, c.y - c.r * 1.1, c.r * 2.2, c.r * 2.2);
    // crackles of static so the cloud reads as a hazard, not decoration
    if ((tick + c.seed * 10) % 40 < 6) {
      ctx.strokeStyle = 'rgba(255,228,230,0.55)';
      ctx.lineWidth = 1.2;
      const a = c.seed + Math.floor(tick / 40);
      ctx.beginPath();
      ctx.moveTo(c.x + Math.cos(a) * c.r * 0.2, c.y + Math.sin(a) * c.r * 0.2);
      ctx.lineTo(c.x + Math.cos(a + 0.4) * c.r * 0.45, c.y + Math.sin(a + 0.9) * c.r * 0.35);
      ctx.lineTo(c.x + Math.cos(a + 0.1) * c.r * 0.65, c.y + Math.sin(a + 0.3) * c.r * 0.6);
      ctx.stroke();
    }
  });
}

function drawWell(well) {
  ctx.save();
  ctx.translate(well.x, well.y);
  // spiral arms fall inward
  for (let arm = 0; arm < 3; arm++) {
    ctx.beginPath();
    for (let s = 0; s <= 40; s++) {
      const r = 200 - s * 4.4, a = arm * 2.094 + s * 0.16 - tick * 0.02;
      s === 0 ? ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.strokeStyle = 'rgba(165,243,252,0.10)';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  const wg = ctx.createRadialGradient(0, 0, 0, 0, 0, 90);
  wg.addColorStop(0, 'rgba(0,0,0,0.9)');
  wg.addColorStop(0.3, 'rgba(8,47,73,0.7)');
  wg.addColorStop(1, 'rgba(8,47,73,0)');
  ctx.fillStyle = wg;
  ctx.fillRect(-90, -90, 180, 180);
  // the lethal core: a bright event-horizon ring
  glowOn('#67e8f9', 16);
  ctx.strokeStyle = '#a5f3fc';
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(0, 0, well.core + Math.sin(tick * 0.1) * 1.5, 0, Math.PI * 2); ctx.stroke();
  glowOff();
  ctx.restore();
}

// ------------------------------------------------------------ hero ship
function drawShip(s, power) {
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(s.angle);
  const bank = s.bank || 0; // -1..1 while turning — the wings foreshorten

  // engine plume: three layers, longer under thrust
  const flick = Math.sin(tick * 1.7) * 2 + Math.sin(tick * 0.9) * 1.5;
  const len = s.thrust ? 16 + flick : 5 + flick * 0.3;
  [['rgba(240,171,252,0.45)', 6, 1], ['#f0abfc', 4, 0.75], ['#ffffff', 2, 0.45]].forEach(([c, w, k]) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(-9, -w); ctx.lineTo(-10 - len * k - 4, 0); ctx.lineTo(-9, w);
    ctx.closePath(); ctx.fill();
  });

  const wingY = 15 * (1 - Math.abs(bank) * 0.3);
  const near = bank > 0 ? 1 : -1;
  // swept delta wings with a lit leading edge; the far wing sits in shadow
  [-1, 1].forEach(side => {
    const lit = side === near;
    poly([[6, side * 3], [-13, side * wingY], [-16, side * (wingY - 1)], [-10, side * 4.5]], lit ? '#7c3aed' : '#4c1d95', INK, 2);
    poly([[6, side * 3], [-13, side * wingY], [-9, side * (wingY * 0.55)]], lit ? '#a78bfa' : '#6d28d9');
    // wing-tip nav light
    ctx.fillStyle = (tick >> 4) % 2 ? (side < 0 ? '#f87171' : '#4ade80') : '#1e1b4b';
    ctx.fillRect(-15, side * wingY - 1.2, 2.5, 2.5);
  });

  // hull
  const hull = ctx.createLinearGradient(0, -5, 0, 5);
  hull.addColorStop(0, '#ddd6fe'); hull.addColorStop(0.45, '#8b5cf6'); hull.addColorStop(1, '#3b0764');
  poly([[21, 0], [5, -5], [-8, -5.5], [-11, -2.5], [-7, 0], [-11, 2.5], [-8, 5.5], [5, 5]], hull, INK, 2.2);
  // panel line + nose highlight
  ctx.strokeStyle = 'rgba(245,243,255,0.85)';
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(20, -0.5); ctx.lineTo(5, -4); ctx.stroke();
  ctx.strokeStyle = 'rgba(15,10,26,0.5)';
  ctx.beginPath(); ctx.moveTo(-2, -4); ctx.lineTo(-2, 4); ctx.stroke();

  // cannons pick up the power-up colour
  const gun = power ? POWER_COLORS[power] : '#c4b5fd';
  ctx.fillStyle = gun;
  ctx.fillRect(8, -6.5, 7, 2); ctx.fillRect(8, 4.5, 7, 2);

  // cockpit glass with a glint
  glowOn('#67e8f9', 8);
  ctx.fillStyle = '#22d3ee';
  ctx.beginPath(); ctx.ellipse(7, 0, 4, 2.6, 0, 0, Math.PI * 2); ctx.fill();
  glowOff();
  ctx.fillStyle = '#ecfeff';
  ctx.fillRect(7.5, -1.5, 2, 1);

  ctx.restore();

  if (s.shield) {
    const a = 0.35 + Math.sin(tick * 0.15) * 0.15;
    ctx.strokeStyle = `rgba(103,232,249,${a + 0.2})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(s.x, s.y, 22, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = `rgba(103,232,249,${a * 0.25})`;
    ctx.fill();
  }
}

const POWER_COLORS = { spread: '#fbbf24', rapid: '#4ade80', shield: '#67e8f9' };

// ------------------------------------------------------------ crystals
// A hex prism seen from above. Each side facet is lit by how squarely it faces
// the key light IN WORLD SPACE, so the shading stays put while the rock spins.
function drawRock(r, pal) {
  const main = r.variant === 'volatile' ? '#fb923c' : r.variant === 'armored' ? '#78716c' : pal.rock[r.hue];
  const n = r.points.length, inner = 0.55;
  const ox = -r.r * 0.08, oy = -r.r * 0.12;
  ctx.save();
  ctx.translate(r.x, r.y);
  ctx.rotate(r.angle);

  if (r.variant === 'volatile') {        // unstable glow leaks out around it
    const pg = ctx.createRadialGradient(0, 0, 0, 0, 0, r.r * 1.5);
    pg.addColorStop(0, `rgba(251,146,60,${0.18 + Math.sin(tick * 0.2 + r.shimmer) * 0.08})`);
    pg.addColorStop(1, 'rgba(251,146,60,0)');
    ctx.fillStyle = pg;
    ctx.fillRect(-r.r * 1.5, -r.r * 1.5, r.r * 3, r.r * 3);
  }

  for (let i = 0; i < n; i++) {
    const p = r.points[i], q = r.points[(i + 1) % n];
    const mid = Math.atan2(p.y + q.y, p.x + q.x) + r.angle;
    const lit = (Math.cos(mid - LIGHT_ANGLE) + 1) / 2;       // 0 shadow .. 1 lit
    poly([[p.x, p.y], [q.x, q.y], [q.x * inner + ox, q.y * inner + oy], [p.x * inner + ox, p.y * inner + oy]],
      tint(main, lit * 0.55 - 0.45));
  }
  // top face
  const top = r.points.map(p => [p.x * inner + ox, p.y * inner + oy]);
  poly(top, tint(main, 0.25));
  // outline in ink, then a thin coloured rim so it pops off the dark void
  poly(r.points.map(p => [p.x, p.y]), null, INK, 3);
  poly(r.points.map(p => [p.x, p.y]), null, tint(main, 0.35), 1);
  poly(top, null, 'rgba(255,255,255,0.35)', 1);

  if (r.variant === 'armored') {         // stone shell, amethyst showing through cracks
    ctx.strokeStyle = '#e9d5ff';
    ctx.lineWidth = 2;
    glowOn('#c084fc', 8);
    for (let c = 0; c < r.maxHp - r.hp; c++) {
      const a = r.shimmer + c * 2.2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r.r * 0.2, Math.sin(a) * r.r * 0.2);
      ctx.lineTo(Math.cos(a + 0.35) * r.r * 0.55, Math.sin(a + 0.35) * r.r * 0.55);
      ctx.lineTo(Math.cos(a - 0.1) * r.r * 0.85, Math.sin(a - 0.1) * r.r * 0.85);
      ctx.stroke();
    }
    glowOff();
  } else if (r.variant === 'volatile') { // molten core
    glowOn('#fb923c', 14);
    ctx.fillStyle = '#fed7aa';
    ctx.beginPath(); ctx.arc(ox, oy, r.size * 3 + Math.sin(tick * 0.25 + r.shimmer) * 1.5, 0, Math.PI * 2); ctx.fill();
    glowOff();
  } else {                               // glint that sweeps across the top face
    const gl = 0.45 + Math.sin(tick * 0.05 + r.shimmer) * 0.35;
    ctx.fillStyle = `rgba(255,255,255,${gl})`;
    ctx.beginPath(); ctx.arc(ox - r.r * 0.12, oy - r.r * 0.1, r.size * 1.6, 0, Math.PI * 2); ctx.fill();
  }

  if (r.flash > 0) {
    ctx.globalAlpha = r.flash / 6;
    poly(r.points.map(p => [p.x, p.y]), '#ffffff');
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawCrystalPickup(c) {
  const blink = c.life < 90 && (tick >> 3) % 2;
  if (blink) return;
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(Math.sin(tick * 0.05 + c.x) * 0.4);
  const s = 1 + Math.sin(tick * 0.12 + c.y) * 0.08;
  ctx.scale(s, s);
  glowOn('#e879f9', 12);
  poly([[0, -9], [6, -2], [0, 9], [-6, -2]], '#c026d3', INK, 1.5);
  glowOff();
  poly([[0, -9], [6, -2], [0, -1]], '#f5d0fe');
  poly([[0, -1], [6, -2], [0, 9]], '#e879f9');
  ctx.restore();
  // sparkle
  if ((tick + Math.floor(c.x)) % 50 < 8) {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(c.x + 7, c.y - 12); ctx.lineTo(c.x + 7, c.y - 4);
    ctx.moveTo(c.x + 3, c.y - 8); ctx.lineTo(c.x + 11, c.y - 8);
    ctx.stroke();
  }
}

function drawPowerup(p) {
  if (p.life < 120 && (tick >> 3) % 2) return;
  const col = POWER_COLORS[p.type];
  ctx.save();
  ctx.translate(p.x, p.y + Math.sin(tick * 0.08 + p.x) * 2);
  glowOn(col, 16);
  ctx.strokeStyle = col;
  ctx.lineWidth = 2;
  ctx.rotate(tick * 0.04);
  for (let i = 0; i < 3; i++) {
    ctx.beginPath(); ctx.arc(0, 0, 13, i * 2.094, i * 2.094 + 1.4); ctx.stroke();
  }
  ctx.rotate(-tick * 0.04);
  glowOff();
  ctx.fillStyle = rgba(col, 0.25);
  ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '800 11px Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(p.type === 'spread' ? 'S' : p.type === 'rapid' ? 'R' : '◈', 0, 1);
  ctx.restore();
}

// ------------------------------------------------------------ shots & fx
function drawShots(shots, enemy) {
  shots.forEach(b => {
    const col = enemy ? (b.color || '#f87171') : (b.color || '#00ffaa');
    const tail = enemy ? 2 : 3;
    ctx.strokeStyle = rgba(col.length === 7 ? col : '#00ffaa', 0.45);
    ctx.lineWidth = enemy ? 5 : 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - b.vx * tail, b.y - b.vy * tail);
    ctx.stroke();
    glowOn(col, 10);
    ctx.fillStyle = enemy ? col : '#eafff6';
    ctx.beginPath(); ctx.arc(b.x, b.y, enemy ? 3.5 : 2.6, 0, Math.PI * 2); ctx.fill();
    glowOff();
  });
}

function drawParticles(particles) {
  particles.forEach(p => {
    ctx.globalAlpha = Math.min(1, p.life / 25);
    ctx.fillStyle = p.color;
    if (p.shard) {           // spinning crystal splinter
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.beginPath(); ctx.moveTo(p.size * 1.6, 0); ctx.lineTo(-p.size, p.size * 0.7); ctx.lineTo(-p.size * 0.6, -p.size * 0.6); ctx.closePath(); ctx.fill();
      ctx.restore();
    } else {
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
  });
  ctx.globalAlpha = 1;
}

function drawShockwaves(list) {
  list.forEach(s => {
    const a = s.life / s.maxLife;
    ctx.strokeStyle = `rgba(255,255,255,${a * 0.7})`;
    ctx.lineWidth = 3 * a + 1;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = rgba(s.color || '#f472b6', a * 0.5);
    ctx.lineWidth = 6 * a + 1;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 0.8, 0, Math.PI * 2); ctx.stroke();
  });
}
