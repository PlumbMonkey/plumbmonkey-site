// ============================================================
// LUNO'S FLIGHT — stages: layouts, skies, platforms, hazards
// Four skies, four waves each; the fourth wave is a boss.
//   MANOR ROOFTOPS   the classic sky                        boss: THE SHRIEKER
//   THE BELL TOWER   the bell swings wider, then its toll   boss: THE GARGOYLE
//                    rings out a shockwave that SHOVES
//   STORM CLOUDS     clouds flicker then vanish and re-form; boss: THE STORM HAG
//                    a dark cloud gathers, then lightning
//   THE BLOOD MOON   every island bobs and drifts           boss: THE MOON WYRM
// ============================================================

const INK = '#0f0a1a';
const WAVES_PER_STAGE = 4;
const stageOf = w => Math.floor((w - 1) / WAVES_PER_STAGE) % STAGES.length;
const isBossWave = w => w % WAVES_PER_STAGE === 0;
const cycleOfWave = w => Math.floor((w - 1) / (WAVES_PER_STAGE * STAGES.length));

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
function inkOval(x, y, rx, ry, fill, w = 2, rot = 0) {
  ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (w) { ctx.strokeStyle = INK; ctx.lineWidth = w; ctx.stroke(); }
}
function hash(i, k) { const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); }

const P = (x, y, w, h, kind, extra) => Object.assign({ x, y, w, h, kind, baseX: x, baseY: y }, extra || {});

const STAGES = [
  {
    name: 'THE MANOR ROOFTOPS', sub: 'Swoop the witches before they ride', boss: 'shrieker', bossName: 'THE SHRIEKER',
    sky: ['#0a0618', '#1a0d33', '#2e1245'], moon: '#e9d5ff', glow: '#c084fc', accent: '#a78bfa',
    layout: () => [
      P(0, 490, 180, 20, 'roof'), P(780, 490, 180, 20, 'roof'),
      P(220, 380, 130, 16, 'roof'), P(610, 380, 130, 16, 'roof'), P(400, 280, 160, 16, 'roof'),
      P(80, 180, 110, 14, 'roof'), P(770, 180, 110, 14, 'roof'), P(380, 120, 200, 14, 'roof'),
      P(300, 320, 90, 12, 'float', { vx: 1.1, range: 80 }), P(560, 220, 90, 12, 'float', { vx: -1.0, range: 70 })
    ]
  },
  {
    name: 'THE BELL TOWER', sub: 'When the bell swings wide, brace for the toll', boss: 'gargoyle', bossName: 'THE GARGOYLE',
    sky: ['#070b1c', '#141a3a', '#2a2350'], moon: '#dbeafe', glow: '#93c5fd', accent: '#93c5fd',
    hazard: 'bell',
    layout: () => [
      P(0, 490, 180, 20, 'stone'), P(780, 490, 180, 20, 'stone'),
      P(150, 390, 130, 16, 'stone'), P(680, 390, 130, 16, 'stone'), P(390, 330, 180, 18, 'stone'),
      P(70, 250, 120, 14, 'stone'), P(770, 250, 120, 14, 'stone'), P(405, 120, 150, 16, 'belfry'),
      P(250, 190, 90, 12, 'float', { vx: 0.9, range: 60 }), P(620, 190, 90, 12, 'float', { vx: -0.9, range: 60 })
    ]
  },
  {
    name: 'THE STORM CLOUDS', sub: 'Clouds vanish — and lightning finds the tallest', boss: 'storm', bossName: 'THE STORM HAG',
    sky: ['#05080f', '#111827', '#1f2a3d'], moon: '#e5e7eb', glow: '#67e8f9', accent: '#67e8f9',
    hazard: 'storm',
    layout: () => [
      P(0, 490, 180, 20, 'stone'), P(780, 490, 180, 20, 'stone'),
      P(200, 390, 140, 18, 'cloud'), P(620, 390, 140, 18, 'cloud'), P(390, 290, 180, 18, 'cloud'),
      P(80, 200, 130, 18, 'cloud'), P(750, 200, 130, 18, 'cloud'), P(370, 120, 220, 18, 'cloud'),
      P(270, 230, 100, 16, 'cloud', { vx: 0.8, range: 70 }), P(590, 330, 100, 16, 'cloud', { vx: -0.8, range: 60 })
    ].map((p, i) => p.kind === 'cloud' ? Object.assign(p, { fade: { phase: 'solid', t: 260 + i * 97 } }) : p)
  },
  {
    name: 'THE BLOOD MOON', sub: 'The sky itself is moving', boss: 'wyrm', bossName: 'THE MOON WYRM',
    sky: ['#12030a', '#2a0714', '#4a0d1f'], moon: '#fca5a5', glow: '#ef4444', accent: '#fb7185',
    hazard: 'drift',
    layout: () => [
      P(0, 490, 180, 20, 'rock'), P(780, 490, 180, 20, 'rock'),
      P(220, 380, 130, 18, 'rock', { bob: 16, bobPhase: 0 }), P(610, 380, 130, 18, 'rock', { bob: 16, bobPhase: 2 }),
      P(400, 280, 160, 18, 'rock', { bob: 12, bobPhase: 1 }),
      P(80, 190, 110, 16, 'rock', { bob: 14, bobPhase: 3 }), P(770, 190, 110, 16, 'rock', { bob: 14, bobPhase: 4 }),
      P(380, 120, 200, 16, 'rock', { bob: 10, bobPhase: 5 }),
      P(300, 320, 90, 14, 'rock', { vx: 1.2, range: 90 }), P(560, 220, 90, 14, 'rock', { vx: -1.1, range: 80 })
    ]
  }
];

// A platform can be stood on unless it is a cloud that has dissolved.
const isSolid = p => !p.fade || p.fade.phase !== 'gone';
const CLOUD_SOLID = 380, CLOUD_WARN = 70, CLOUD_GONE = 150;

// ------------------------------------------------------------ sky (cached)
const skyCache = {};
function drawSky(si, t) {
  const canCache = typeof document !== 'undefined' && typeof document.createElement === 'function';
  if (canCache) {
    if (!skyCache[si]) {
      const off = document.createElement('canvas');
      off.width = W; off.height = H;
      const real = ctx; ctx = off.getContext('2d');
      paintSky(si);
      ctx = real;
      skyCache[si] = off;
    }
    ctx.drawImage(skyCache[si], 0, 0);
  } else paintSky(si);
  skyLife(si, t);
}

function paintSky(si) {
  const s = STAGES[si];
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, s.sky[0]); g.addColorStop(0.6, s.sky[1]); g.addColorStop(1, s.sky[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 120; i++) {
    ctx.globalAlpha = 0.2 + hash(i, 3) * 0.6;
    ctx.fillStyle = '#f5f3ff';
    const r = hash(i, 4) > 0.9 ? 1.6 : 1;
    ctx.fillRect(hash(i, 1) * W, hash(i, 2) * (H - 140), r, r);
  }
  ctx.globalAlpha = 1;
  // moon with halo and craters (the halo fades out inside its own box)
  const mx = si === 3 ? W / 2 : W - 110, my = si === 3 ? 150 : 86, mr = si === 3 ? 90 : 38;
  const halo = ctx.createRadialGradient(mx, my, mr * 0.8, mx, my, mr * 3);
  halo.addColorStop(0, rgba(s.glow, 0.35)); halo.addColorStop(1, rgba(s.glow, 0));
  ctx.fillStyle = halo; ctx.fillRect(mx - mr * 3, my - mr * 3, mr * 6, mr * 6);
  ctx.fillStyle = s.moon; ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  [[-0.3, -0.2, 0.22], [0.25, 0.1, 0.16], [-0.1, 0.35, 0.12], [0.35, -0.35, 0.09]].forEach(([dx, dy, r]) => {
    ctx.beginPath(); ctx.arc(mx + dx * mr, my + dy * mr, r * mr, 0, Math.PI * 2); ctx.fill();
  });
  // far silhouettes
  ctx.fillStyle = shade(s.sky[2], -0.55);
  if (si === 0) {                                     // the manor's roofline
    ctx.beginPath(); ctx.moveTo(0, H);
    [[0, 420], [60, 420], [90, 380], [120, 420], [230, 420], [230, 360], [260, 330], [290, 360], [290, 420], [420, 420], [470, 340], [520, 420], [640, 420], [640, 380], [700, 300], [760, 380], [760, 420], [880, 420], [910, 390], [960, 420]].forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  } else if (si === 1) {                              // the tower rising behind the belfry
    ctx.fillRect(420, 60, 120, H);
    ctx.beginPath(); ctx.moveTo(410, 62); ctx.lineTo(480, -10); ctx.lineTo(550, 62); ctx.fill();
    ctx.fillRect(0, 440, W, 100);
    ctx.fillStyle = rgba(s.glow, 0.18);
    for (let y = 180; y < 480; y += 70) { ctx.beginPath(); ctx.arc(480, y, 12, Math.PI, 0); ctx.lineTo(492, y + 26); ctx.lineTo(468, y + 26); ctx.fill(); }
  } else if (si === 2) {                              // a wall of storm cloud on the horizon
    for (let i = 0; i < 14; i++) { ctx.beginPath(); ctx.arc(i * 74, 470 + hash(i, 5) * 30, 60 + hash(i, 6) * 40, 0, Math.PI * 2); ctx.fill(); }
  } else {                                            // broken rock and a dead forest below
    for (let i = 0; i < 9; i++) { const x = 40 + i * 110; ctx.beginPath(); ctx.moveTo(x - 40, 240 + hash(i, 7) * 60); ctx.lineTo(x + 30, 230 + hash(i, 8) * 60); ctx.lineTo(x, 270 + hash(i, 9) * 60); ctx.fill(); }
    ctx.fillRect(0, 450, W, 90);
    for (let x = 10; x < W; x += 36) { ctx.fillRect(x, 400 + hash(x, 1) * 30, 4, 60); }
  }
}

function skyLife(si, t) {
  const s = STAGES[si];
  // two drifting cloud bands at different speeds
  for (let layer = 0; layer < 2; layer++) {
    ctx.fillStyle = layer ? rgba(s.accent, 0.05) : 'rgba(255,255,255,0.035)';
    for (let i = 0; i < 6; i++) {
      const x = ((i * 190 + t * (0.15 + layer * 0.2)) % (W + 300)) - 150, y = 70 + layer * 110 + hash(i, layer) * 60;
      ctx.beginPath(); ctx.ellipse(x, y, 110, 16, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  // a flock of bats crossing now and then
  const flock = (t % 1400) / 1400;
  if (flock < 0.4) {
    ctx.fillStyle = shade(s.sky[0], 0.1);
    for (let i = 0; i < 5; i++) {
      const x = W + 40 - flock / 0.4 * (W + 120) + i * 18, y = 150 + i * 9 + Math.sin(t * 0.2 + i) * 4, f = Math.sin(t * 0.6 + i) * 4;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 6, y - f); ctx.lineTo(x - 3, y + 1); ctx.lineTo(x, y + 2); ctx.lineTo(x + 3, y + 1); ctx.lineTo(x + 6, y - f); ctx.closePath(); ctx.fill();
    }
  }
  if (si === 3) {                                     // embers drifting up
    for (let i = 0; i < 30; i++) {
      const x = (hash(i, 11) * W + Math.sin(t * 0.01 + i) * 20) % W, y = H - ((t * (0.4 + hash(i, 12)) + hash(i, 13) * H) % H);
      ctx.fillStyle = `rgba(251,113,133,${0.3 + hash(i, 14) * 0.5})`; ctx.fillRect(x, y, 2, 2);
    }
  }
  // low fog above the ground
  const fg = ctx.createLinearGradient(0, H - 120, 0, H);
  fg.addColorStop(0, rgba(s.accent, 0)); fg.addColorStop(1, rgba(s.accent, 0.12));
  ctx.fillStyle = fg; ctx.fillRect(0, H - 120, W, 120);
}

// ------------------------------------------------------------ ground
function drawGround(si, t) {
  const s = STAGES[si];
  ctx.fillStyle = shade(s.sky[0], -0.3); ctx.fillRect(0, H - 48, W, 48);
  ctx.fillStyle = rgba(s.accent, 0.6); ctx.fillRect(0, H - 48, W, 2);
  // gravestones / rubble teeth along the bottom so it is not a flat bar
  ctx.fillStyle = shade(s.sky[1], -0.2);
  for (let x = 12; x < W; x += 46) {
    const h = 8 + hash(x, si) * 12;
    ctx.beginPath(); ctx.moveTo(x, H - 46); ctx.lineTo(x, H - 46 - h); ctx.arc(x + 7, H - 46 - h, 7, Math.PI, 0); ctx.lineTo(x + 14, H - 46); ctx.fill();
  }
}

// ------------------------------------------------------------ platforms
function drawPlatform(p, t) {
  if (p.kind === 'cloud') return drawCloud(p, t);
  const top = 5;
  if (p.kind === 'float') {
    ctx.save();
    ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = 14;
    inkPoly([[p.x, p.y], [p.x + p.w, p.y], [p.x + p.w - 10, p.y + p.h], [p.x + 10, p.y + p.h]], '#134e4a', 2);
    ctx.restore();
    ctx.fillStyle = '#22d3ee'; ctx.fillRect(p.x + 6, p.y + 3, p.w - 12, 3);
    ctx.fillStyle = `rgba(103,232,249,${0.35 + Math.sin(t * 0.1 + p.x) * 0.2})`;
    ctx.beginPath(); ctx.moveTo(p.x + 16, p.y + p.h); ctx.lineTo(p.x + p.w - 16, p.y + p.h); ctx.lineTo(p.x + p.w / 2 + 8, p.y + p.h + 22); ctx.lineTo(p.x + p.w / 2 - 8, p.y + p.h + 22); ctx.closePath(); ctx.fill();
    return;
  }
  if (p.kind === 'roof') {
    // slate roof ledge: tiles on the face, crenellations on top, a lamp
    inkPoly([[p.x, p.y + top], [p.x + p.w, p.y + top], [p.x + p.w - 6, p.y + p.h + 6], [p.x + 6, p.y + p.h + 6]], '#2a2240', 2);
    ctx.fillStyle = '#3b2f58';
    for (let x = p.x + 6; x < p.x + p.w - 6; x += 12) { ctx.beginPath(); ctx.arc(x + 6, p.y + top + 6, 6, 0, Math.PI); ctx.fill(); }
    inkPoly([[p.x - 3, p.y], [p.x + p.w + 3, p.y], [p.x + p.w + 3, p.y + top + 1], [p.x - 3, p.y + top + 1]], '#5b4a86', 1.6);
    ctx.fillStyle = '#4c1d95'; ctx.fillRect(p.x - 3, p.y, p.w + 6, 1.5);
    if (p.w > 120) {
      const lx = p.x + p.w - 18;
      ctx.fillStyle = '#1c1624'; ctx.fillRect(lx - 1, p.y - 14, 2, 14);
      ctx.fillStyle = `rgba(251,191,36,${0.7 + Math.sin(t * 0.2 + lx) * 0.2})`;
      ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 12; ctx.fillRect(lx - 3, p.y - 20, 6, 6); ctx.shadowBlur = 0;
    }
    return;
  }
  if (p.kind === 'stone' || p.kind === 'belfry') {
    const base = p.kind === 'belfry' ? '#475569' : '#334155';
    inkPoly([[p.x, p.y], [p.x + p.w, p.y], [p.x + p.w - 4, p.y + p.h + 4], [p.x + 4, p.y + p.h + 4]], base, 2);
    ctx.fillStyle = shade(base, 0.25); ctx.fillRect(p.x + 2, p.y + 1, p.w - 4, 3);
    ctx.strokeStyle = shade(base, -0.35); ctx.lineWidth = 1;
    for (let x = p.x + 18; x < p.x + p.w - 6; x += 22) { ctx.beginPath(); ctx.moveTo(x, p.y + 4); ctx.lineTo(x, p.y + p.h + 2); ctx.stroke(); }
    ctx.fillStyle = 'rgba(134,239,172,0.25)'; ctx.fillRect(p.x + 4, p.y + p.h, p.w * 0.3, 3);
    if (p.kind === 'belfry') {                        // arch posts holding the bell beam
      ['left', 'right'].forEach((side, i) => {
        const x = i ? p.x + p.w - 12 : p.x + 4;
        inkPoly([[x, p.y + p.h], [x + 8, p.y + p.h], [x + 8, p.y + p.h + 70], [x, p.y + p.h + 70]], '#334155', 1.6);
      });
      inkPoly([[p.x, p.y + p.h + 66], [p.x + p.w, p.y + p.h + 66], [p.x + p.w, p.y + p.h + 74], [p.x, p.y + p.h + 74]], '#1e293b', 1.6);
    }
    return;
  }
  // rock island with a crystal growing from it
  const bottom = p.y + p.h + 26;
  inkPoly([[p.x, p.y + 4], [p.x + p.w, p.y + 4], [p.x + p.w - 14, p.y + p.h + 8], [p.x + p.w * 0.6, bottom], [p.x + p.w * 0.35, p.y + p.h + 14], [p.x + 12, p.y + p.h + 6]], '#3f1d2b', 2);
  inkPoly([[p.x - 2, p.y], [p.x + p.w + 2, p.y], [p.x + p.w, p.y + 7], [p.x, p.y + 7]], '#6b2c3e', 1.6);
  ctx.fillStyle = 'rgba(252,165,165,0.25)'; ctx.fillRect(p.x + 3, p.y + 1, p.w - 6, 2);
  ctx.save(); ctx.shadowColor = '#fb7185'; ctx.shadowBlur = 10;
  inkPoly([[p.x + p.w * 0.6 - 4, bottom - 4], [p.x + p.w * 0.6, bottom + 8], [p.x + p.w * 0.6 + 4, bottom - 4]], '#fb7185', 1.2);
  ctx.restore();
}

function drawCloud(p, t) {
  const f = p.fade;
  let alpha = 1;
  if (f.phase === 'warn') alpha = 0.55 + Math.sin(t * 0.8) * 0.35;         // TELL: it flickers
  if (f.phase === 'gone') alpha = 0.12;
  ctx.save();
  ctx.globalAlpha = alpha;
  const puffs = Math.max(3, Math.round(p.w / 34));
  for (let i = 0; i < puffs; i++) {
    const cx = p.x + (i + 0.5) * (p.w / puffs), r = 16 + (i % 2) * 5;
    inkOval(cx, p.y + 6, r, r * 0.7, i % 2 ? '#e5e7eb' : '#f3f4f6', f.phase === 'gone' ? 0 : 1.6);
  }
  ctx.fillStyle = '#9ca3af';
  ctx.fillRect(p.x + 8, p.y + 10, p.w - 16, 8);
  ctx.restore();
}

// ------------------------------------------------------------ hazards
const BELL_WARN = 80, BELL_RING_MAX = 300;
function drawBell(bell, t) {
  const warn = bell.state === 'warn' ? 1 - bell.t / BELL_WARN : 0;
  const swing = Math.sin(t * (0.05 + warn * 0.15)) * (0.12 + warn * 0.5);
  ctx.save();
  ctx.translate(bell.x, bell.y);
  ctx.rotate(swing);
  ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(0, -8); ctx.stroke();
  if (warn > 0) { ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 20 * warn; }
  inkPoly([[-10, -12], [10, -12], [16, 10], [24, 22], [-24, 22], [-16, 10]], '#b45309', 2);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fbbf24'; ctx.fillRect(-20, 16, 40, 3);
  inkOval(0, 26, 5, 5, '#78350f', 1.5);
  ctx.restore();
}

function drawRings(rings) {
  rings.forEach(r => {
    const a = r.life / r.maxLife;
    ctx.strokeStyle = rgba(r.color, a * 0.8); ctx.lineWidth = 6 * a + 2;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${a * 0.4})`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(r.x, r.y, Math.max(0, r.r - 8), 0, Math.PI * 2); ctx.stroke();
  });
}

const STORM_WARN = 80, STORM_BOLT = 18, STORM_WIDTH = 30;
// a storm cell: dark cloud that gathers above its column, then strikes
function drawStorm(s, t) {
  const k = s.state === 'warn' ? 1 - s.t / STORM_WARN : 1;
  ctx.save();
  ctx.globalAlpha = s.state === 'warn' ? 0.5 + k * 0.5 : 1;
  for (let i = 0; i < 4; i++) inkOval(s.x - 30 + i * 20, 34 + (i % 2) * 6, 22 * (0.7 + k * 0.3), 14, i % 2 ? '#374151' : '#1f2937', 1.5);
  ctx.restore();
  if (s.state === 'warn') {                  // TELL: the column the bolt will fill, crackling down from the cloud
    ctx.fillStyle = `rgba(103,232,249,${0.05 + k * 0.12})`;
    ctx.fillRect(s.x - STORM_WIDTH / 2, 46, STORM_WIDTH, (H - 94) * k);
    if ((t >> 2) % 2) { ctx.strokeStyle = `rgba(165,243,252,${k})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(s.x, 46); ctx.lineTo(s.x + 6, 46 + 30 * k); ctx.lineTo(s.x - 4, 46 + 60 * k); ctx.stroke(); }
  } else if (s.state === 'bolt') {
    const a = s.t / STORM_BOLT;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    [[18, `rgba(103,232,249,${a * 0.4})`], [7, `rgba(165,243,252,${a * 0.9})`], [2.5, `rgba(255,255,255,${a})`]].forEach(([w, c]) => {
      ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(s.x, 46);
      for (let i = 1; i <= 10; i++) ctx.lineTo(s.x + (hash(s.seed, i) - 0.5) * 22, 46 + (H - 94) * i / 10);
      ctx.stroke();
    });
    ctx.restore();
  }
}
