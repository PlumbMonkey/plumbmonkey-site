// ============================================================
// CRYSTAL DIMENSION — enemy, boss and overlay artwork
// Every attack has a visible tell drawn here: saucer domes flare before they
// fire, mines strobe on their fuse, the carrier's mouth swells before the
// scream, and the heart's laser spokes glow thin before they go wide.
// Telegraph lines always start AT their source (see arcade notes: full-width
// thin lines read as rendering bugs).
// ============================================================

function drawTrail(trail, color, width) {
  for (let i = 1; i < trail.length; i++) {
    ctx.strokeStyle = rgba(color, (i / trail.length) * 0.35);
    ctx.lineWidth = width * (i / trail.length);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
    ctx.lineTo(trail[i].x, trail[i].y);
    ctx.stroke();
  }
}

// A tiny ghost: domed head, three-scallop hem, eyes that look at `look`.
function drawGhostPilot(x, y, s, look, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.arc(0, -2, 6, Math.PI, 0);
  ctx.lineTo(6, 5);
  for (let i = 0; i < 3; i++) {
    const x0 = 6 - i * 4;
    ctx.quadraticCurveTo(x0 - 2, 5 + ((tick >> 3) + i) % 2 * 2 - 2, x0 - 4, 5);
  }
  ctx.closePath();
  ctx.fillStyle = color || '#f0f9ff';
  ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke();
  const ex = Math.cos(look) * 1.4, ey = Math.sin(look) * 1.2;
  ctx.fillStyle = INK;
  ctx.fillRect(-3.5 + ex, -3 + ey, 2, 2.6);
  ctx.fillRect(1.5 + ex, -3 + ey, 2, 2.6);
  ctx.restore();
}

// ------------------------------------------------------------ saucer
function drawSaucer(g) {
  drawTrail(g.trail, '#22d3ee', 10);
  const charging = g.shootTimer < 24;
  ctx.save();
  ctx.translate(g.x, g.y);
  ctx.rotate(Math.sin(tick * 0.06 + g.seed) * 0.12);
  // dome glass + pilot
  ctx.fillStyle = 'rgba(165,243,252,0.28)';
  ctx.beginPath(); ctx.arc(0, -2, 9, Math.PI, 0); ctx.fill();
  drawGhostPilot(0, -3, 0.75, g.angle, '#f0f9ff');
  ctx.strokeStyle = 'rgba(236,254,255,0.8)'; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.arc(0, -2, 9, Math.PI * 1.05, Math.PI * 1.45); ctx.stroke();
  // hull
  const hull = ctx.createLinearGradient(0, -2, 0, 8);
  hull.addColorStop(0, '#67e8f9'); hull.addColorStop(0.5, '#0e7490'); hull.addColorStop(1, '#083344');
  ctx.beginPath(); ctx.ellipse(0, 2, 17, 6.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = hull; ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
  // chasing rim lights
  for (let i = 0; i < 5; i++) {
    const on = (Math.floor(tick / 6) + i) % 5 === 0;
    ctx.fillStyle = on ? '#ecfeff' : '#155e75';
    ctx.beginPath(); ctx.arc(-12 + i * 6, 3, 1.6, 0, Math.PI * 2); ctx.fill();
  }
  if (charging) {                       // TELL: dome flares before a shot
    const k = 1 - g.shootTimer / 24;
    glowOn('#f87171', 18 * k);
    ctx.strokeStyle = `rgba(248,113,113,${0.4 + k * 0.6})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, -2, 9 + k * 4, Math.PI, 0); ctx.stroke();
    glowOff();
  }
  ctx.restore();
}

// ------------------------------------------------------------ wraith
function drawWraith(w) {
  const vis = w.vis;
  ctx.save();
  ctx.translate(w.x, w.y);
  if (vis < 0.15) {                     // phased out: only a shimmer shows where it is
    ctx.strokeStyle = `rgba(216,180,254,${0.12 + Math.sin(tick * 0.3) * 0.06})`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(0, 0, 14, 18, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    return;
  }
  ctx.globalAlpha = vis;
  const trailA = Math.atan2(-w.vy, -w.vx);
  // streaming tatters behind the direction of travel
  // each tatter is a tapering wavy ribbon of the cloak colour
  for (let i = 0; i < 3; i++) {
    const a = trailA + (i - 1) * 0.4, len = 22 + Math.sin(tick * 0.15 + i) * 5;
    const px = -Math.sin(a), py = Math.cos(a);
    ctx.beginPath();
    for (let s = 0; s <= 6; s++) {
      const k = s / 6, wave = Math.sin(tick * 0.25 + i * 2 + k * 5) * 4 * k, half = 4.5 * (1 - k);
      const x = Math.cos(a) * len * k + px * (wave + half), y = 6 + Math.sin(a) * len * k + py * (wave + half);
      s === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    for (let s = 6; s >= 0; s--) {
      const k = s / 6, wave = Math.sin(tick * 0.25 + i * 2 + k * 5) * 4 * k, half = 4.5 * (1 - k);
      ctx.lineTo(Math.cos(a) * len * k + px * (wave - half), 6 + Math.sin(a) * len * k + py * (wave - half));
    }
    ctx.closePath();
    ctx.fillStyle = rgba(i === 1 ? '#7c3aed' : '#5b21b6', 0.75);
    ctx.fill();
  }
  // hooded cloak
  poly([[0, -20], [11, -12], [15, 4], [18, 16], [8, 12], [0, 18], [-8, 12], [-18, 16], [-15, 4], [-11, -12]], '#4c1d95', INK, 2.2);
  poly([[0, -20], [11, -12], [13, 2], [0, 8], [-4, -10]], '#6d28d9');
  // void face + eyes
  ctx.fillStyle = '#0b0614';
  ctx.beginPath(); ctx.ellipse(0, -8, 7, 8, 0, 0, Math.PI * 2); ctx.fill();
  glowOn('#e879f9', 10);
  ctx.fillStyle = '#f5d0fe';
  const lx = Math.cos(w.face) * 1.5;
  ctx.fillRect(-4 + lx, -10, 2.5, 2); ctx.fillRect(1.5 + lx, -10, 2.5, 2);
  glowOff();
  // reaching claws
  ctx.strokeStyle = '#c4b5fd'; ctx.lineWidth = 1.5;
  [-1, 1].forEach(s => {
    const reach = Math.sin(tick * 0.1) * 3;
    ctx.beginPath(); ctx.moveTo(s * 13, 2); ctx.lineTo(s * (19 + reach), -2); ctx.lineTo(s * (22 + reach), -5); ctx.stroke();
  });
  ctx.restore();
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------ mine
function drawMine(m) {
  const armed = m.fuse > 0;
  const strobe = armed && (tick >> (m.fuse < 20 ? 1 : 2)) % 2;
  ctx.save();
  ctx.translate(m.x, m.y);
  if (armed) {                          // TELL: blast radius ring
    ctx.strokeStyle = `rgba(248,113,113,${0.25 + (strobe ? 0.35 : 0)})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, 70 * (1 - m.fuse / MINE_FUSE) + 14, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.rotate(m.rot);
  const spikes = [];
  for (let i = 0; i < 16; i++) {
    const r = i % 2 ? 6 : 14;
    spikes.push([Math.cos(i * Math.PI / 8) * r, Math.sin(i * Math.PI / 8) * r]);
  }
  poly(spikes, '#334155', INK, 2);
  poly(spikes.map(([x, y]) => [x * 0.6, y * 0.6]), '#64748b');
  glowOn(armed ? '#ef4444' : '#93c5fd', armed ? 16 : 8);
  ctx.fillStyle = strobe ? '#fecaca' : armed ? '#ef4444' : '#93c5fd';
  ctx.beginPath(); ctx.arc(0, 0, 4 + Math.sin(tick * 0.12) * 0.8, 0, Math.PI * 2); ctx.fill();
  glowOff();
  ctx.restore();
}

// ------------------------------------------------------------ seeker
function drawSeeker(s) {
  drawTrail(s.trail, '#f472b6', 5);
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(s.angle);
  glowOn('#f472b6', 10);
  poly([[10, 0], [-6, -6], [-3, 0], [-6, 6]], '#db2777', INK, 1.6);
  glowOff();
  poly([[10, 0], [-6, -6], [-3, 0]], '#fbcfe8');
  ctx.fillStyle = '#fff';
  ctx.fillRect(1, -1, 3, 2);
  ctx.restore();
}

// ------------------------------------------------------------ bosses
function bossFlash(b) {
  if (b.flash > 0) { ctx.globalAlpha = 0.5 + (b.flash % 2) * 0.5; }
}

function drawWarden(b) {
  // orbiting stone plates — they soak shots until knocked away
  b.plates.forEach(p => {
    if (p.hp <= 0) return;
    const a = b.rot + p.a;
    ctx.save();
    ctx.translate(b.x + Math.cos(a) * b.plateR, b.y + Math.sin(a) * b.plateR);
    ctx.rotate(a);
    poly([[-8, -16], [8, -12], [9, 12], [-7, 16]], p.hp > 1 ? '#57534e' : '#44403c', INK, 2.4);
    poly([[-8, -16], [8, -12], [2, -2], [-5, -4]], '#78716c');
    if (p.hp === 1) {
      ctx.strokeStyle = '#d8b4fe'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-4, -10); ctx.lineTo(2, 0); ctx.lineTo(-2, 10); ctx.stroke();
    }
    ctx.restore();
  });
  ctx.save();
  ctx.translate(b.x, b.y);
  bossFlash(b);
  // geode body: stone octagon split open around a crystal eye
  const oct = [];
  for (let i = 0; i < 8; i++) oct.push([Math.cos(i * Math.PI / 4 + 0.39) * 38, Math.sin(i * Math.PI / 4 + 0.39) * 38]);
  poly(oct, '#44403c', INK, 3);
  for (let i = 0; i < 8; i++) {
    const [x1, y1] = oct[i], [x2, y2] = oct[(i + 1) % 8];
    const lit = (Math.cos(Math.atan2(y1 + y2, x1 + x2) - LIGHT_ANGLE) + 1) / 2;
    poly([[x1, y1], [x2, y2], [x2 * 0.7, y2 * 0.7], [x1 * 0.7, y1 * 0.7]], tint('#78716c', lit * 0.4 - 0.3));
  }
  const inner = oct.map(([x, y]) => [x * 0.7, y * 0.7]);
  poly(inner, '#3b0764', INK, 2);
  // amethyst spikes lining the cavity
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    poly([[Math.cos(a - 0.2) * 26, Math.sin(a - 0.2) * 26], [Math.cos(a) * 12, Math.sin(a) * 12], [Math.cos(a + 0.2) * 26, Math.sin(a + 0.2) * 26]], i % 2 ? '#a855f7' : '#d8b4fe');
  }
  // the eye tracks the ship
  const ex = Math.cos(b.eyeA) * 4, ey = Math.sin(b.eyeA) * 4;
  glowOn('#f0abfc', 18);
  ctx.fillStyle = '#fdf4ff';
  ctx.beginPath(); ctx.ellipse(0, 0, 11, 8, 0, 0, Math.PI * 2); ctx.fill();
  glowOff();
  ctx.fillStyle = b.fireWarn ? '#ef4444' : '#7e22ce';
  ctx.beginPath(); ctx.arc(ex, ey, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = INK;
  ctx.fillRect(ex - 1, ey - 4, 2, 8);
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawCarrier(b) {
  ctx.save();
  ctx.translate(b.x, b.y);
  bossFlash(b);
  // spectral wake
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = `rgba(251,113,133,${0.06 - i * 0.012})`;
    ctx.beginPath(); ctx.ellipse(-b.dir * (30 + i * 22), 4, 60, 18 - i * 3, 0, 0, Math.PI * 2); ctx.fill();
  }
  // hull
  const hull = ctx.createLinearGradient(0, -24, 0, 24);
  hull.addColorStop(0, '#fda4af'); hull.addColorStop(0.4, '#9f1239'); hull.addColorStop(1, '#3f0718');
  ctx.beginPath(); ctx.ellipse(0, 6, 72, 20, 0, 0, Math.PI * 2);
  ctx.fillStyle = hull; ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
  // launch bays glow when a saucer is about to drop
  [-44, 44].forEach((bx, i) => {
    const g = b.bayGlow[i];
    ctx.fillStyle = g > 0 ? `rgba(103,232,249,${0.4 + g * 0.6})` : '#1f0a12';
    ctx.fillRect(bx - 9, 16, 18, 6);
    ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.strokeRect(bx - 9, 16, 18, 6);
  });
  // hooded bridge
  poly([[-26, -2], [-18, -26], [0, -36], [18, -26], [26, -2]], '#4c0519', INK, 2.5);
  poly([[-18, -26], [0, -36], [6, -12], [-10, -4]], '#881337');
  // banshee face: hollow eyes + mouth that swells on the charge
  const open = b.charge / CARRIER_CHARGE;
  ctx.fillStyle = '#fff1f2';
  ctx.beginPath(); ctx.ellipse(0, -14, 11, 13, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.ellipse(-4, -18, 2.5, 3.5, 0, 0, Math.PI * 2); ctx.ellipse(4, -18, 2.5, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  if (open > 0) glowOn('#fb7185', 24 * open);
  ctx.fillStyle = open > 0 ? '#e11d48' : INK;
  ctx.beginPath(); ctx.ellipse(0, -8, 2.5 + open * 3, 2 + open * 5, 0, 0, Math.PI * 2); ctx.fill();
  glowOff();
  if (open > 0) {                       // TELL: rings pulse out of the mouth
    ctx.strokeStyle = `rgba(251,113,133,${open * 0.6})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 2; i++) {
      const r = ((tick * 0.8 + i * 10) % 20) + 8;
      ctx.beginPath(); ctx.arc(0, -8, r * open, b.aim - 0.6, b.aim + 0.6); ctx.stroke();
    }
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawSerpent(b) {
  // body from tail to head so the head overlaps
  for (let i = b.segs.length - 1; i >= 0; i--) {
    const s = b.segs[i];
    if (s.hp <= 0) continue;
    const r = 13 - i * 0.45;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.a);
    poly([[r, 0], [0, -r * 0.8], [-r, 0], [0, r * 0.8]], s.hp > 1 ? '#0891b2' : '#155e75', INK, 2.2);
    poly([[r, 0], [0, -r * 0.8], [-r * 0.2, 0]], '#a5f3fc');
    if (s.flash > 0) { ctx.globalAlpha = 0.7; poly([[r, 0], [0, -r * 0.8], [-r, 0], [0, r * 0.8]], '#fff'); ctx.globalAlpha = 1; }
    ctx.restore();
  }
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.angle);
  bossFlash(b);
  const jaw = 0.25 + Math.max(0, b.jaw) * 0.5;
  // lower + upper jaw
  poly([[0, 2], [30, 4 + jaw * 14], [24, 10 + jaw * 6], [-8, 12]], '#0e7490', INK, 2.5);
  poly([[-14, -14], [10, -14], [34, -4 - jaw * 12], [22, 2], [-14, 12], [-20, 0]], '#06b6d4', INK, 3);
  poly([[-14, -14], [10, -14], [34, -4 - jaw * 12], [4, -4]], '#67e8f9');
  // teeth
  ctx.fillStyle = '#ecfeff';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath(); ctx.moveTo(12 + i * 6, -1 - jaw * (4 + i * 3)); ctx.lineTo(14 + i * 6, 5 - jaw * (4 + i * 3)); ctx.lineTo(16 + i * 6, -1 - jaw * (4 + i * 3)); ctx.fill();
  }
  // crest spikes
  poly([[-14, -14], [-26, -26], [-4, -14]], '#cffafe', INK, 1.5);
  poly([[-4, -14], [-10, -30], [8, -14]], '#cffafe', INK, 1.5);
  glowOn('#fef08a', 12);
  ctx.fillStyle = '#fef08a';
  ctx.beginPath(); ctx.ellipse(2, -6, 4, 3, 0.3, 0, Math.PI * 2); ctx.fill();
  glowOff();
  ctx.fillStyle = INK; ctx.fillRect(2, -8, 1.5, 4);
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawHeart(b) {
  // laser spokes first, so the shell sits on top of their roots
  b.spokes.forEach(s => {
    const len = 900, a = s.a;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(a);
    if (s.state === 'warn') {
      const k = 1 - s.t / HEART_WARN;
      ctx.strokeStyle = `rgba(253,224,71,${0.25 + k * 0.5})`;
      ctx.lineWidth = 1 + k * 2;
      ctx.setLineDash([10, 8]);
      ctx.lineDashOffset = -tick * 2;
      ctx.beginPath(); ctx.moveTo(40, 0); ctx.lineTo(len, 0); ctx.stroke();
      ctx.setLineDash([]);
    } else {
      glowOn('#fde047', 24);
      ctx.fillStyle = 'rgba(253,224,71,0.55)';
      ctx.fillRect(36, -HEART_BEAM_W, len, HEART_BEAM_W * 2);
      ctx.fillStyle = '#fffbeb';
      ctx.fillRect(36, -3, len, 6);
      glowOff();
    }
    ctx.restore();
  });

  ctx.save();
  ctx.translate(b.x, b.y);
  bossFlash(b);
  // core: a slowly beating prism
  const beat = 1 + Math.sin(tick * 0.12) * 0.06 + (b.flash > 0 ? 0.08 : 0);
  ctx.save();
  ctx.scale(beat, beat);
  ctx.rotate(-b.rot * 1.5);
  const hex = [];
  for (let i = 0; i < 6; i++) hex.push([Math.cos(i * Math.PI / 3) * 30, Math.sin(i * Math.PI / 3) * 30]);
  const cols = ['#fde047', '#f0abfc', '#67e8f9', '#fde047', '#f0abfc', '#67e8f9'];
  glowOn('#fef9c3', 22);
  for (let i = 0; i < 6; i++) poly([[0, 0], hex[i], hex[(i + 1) % 6]], tint(cols[i], (i % 3) * 0.2 - 0.1));
  glowOff();
  poly(hex, null, INK, 2.5);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // mirror shell with open gaps
  const step = Math.PI * 2 / HEART_PLATES;
  for (let i = 0; i < HEART_PLATES; i++) {
    if (b.gaps.includes(i)) continue;
    const a0 = b.rot + i * step + 0.04, a1 = b.rot + (i + 1) * step - 0.04;
    ctx.beginPath();
    ctx.arc(0, 0, HEART_SHELL + 8, a0, a1);
    ctx.arc(0, 0, HEART_SHELL - 6, a1, a0, true);
    ctx.closePath();
    ctx.fillStyle = i % 2 ? '#a1a1aa' : '#d4d4d8';
    ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, HEART_SHELL + 4, a0 + 0.05, a0 + (a1 - a0) * 0.5); ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

const BOSS_DRAW = { warden: drawWarden, carrier: drawCarrier, serpent: drawSerpent, heart: drawHeart };
function drawBoss(b) { BOSS_DRAW[b.type](b); }

// ------------------------------------------------------------ overlays
function drawBossBar(b) {
  const w = 360, x = W / 2 - w / 2, y = 18, k = Math.max(0, b.hp / b.maxHp);
  ctx.fillStyle = 'rgba(5,3,12,0.7)';
  ctx.fillRect(x - 4, y - 4, w + 8, 20);
  ctx.fillStyle = '#3b0764';
  ctx.fillRect(x, y, w, 12);
  const bar = ctx.createLinearGradient(x, 0, x + w, 0);
  bar.addColorStop(0, '#f0abfc'); bar.addColorStop(1, '#c084fc');
  ctx.fillStyle = bar;
  ctx.fillRect(x, y, w * k, 12);
  ctx.fillStyle = '#f5f3ff';
  ctx.font = '800 11px Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(b.name, W / 2, y + 17);
}

function drawBanner(title, sub, alpha) {
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.fillStyle = 'rgba(5,3,12,0.55)';
  ctx.fillRect(0, H / 2 - 52, W, 104);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  glowOn('#c084fc', 20);
  ctx.fillStyle = '#f5f3ff';
  ctx.font = '800 38px Segoe UI, sans-serif';
  ctx.fillText(title, W / 2, H / 2 - 12);
  glowOff();
  ctx.fillStyle = '#d8b4fe';
  ctx.font = '600 16px Segoe UI, sans-serif';
  ctx.fillText(sub, W / 2, H / 2 + 26);
  ctx.globalAlpha = 1;
}

function drawHudOverlay(state) {
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.font = '700 12px Segoe UI, sans-serif';
  // nova charges + the meter toward the next one
  ctx.fillStyle = '#d8b4fe';
  ctx.fillText('NOVA', 14, H - 26);
  for (let i = 0; i < NOVA_MAX; i++) {
    const x = 56 + i * 18, full = i < state.novas;
    poly([[x, H - 28], [x + 6, H - 21], [x, H - 14], [x - 6, H - 21]], full ? '#e879f9' : 'rgba(232,121,249,0.15)', full ? INK : 'rgba(232,121,249,0.5)', 1.2);
  }
  ctx.fillStyle = 'rgba(232,121,249,0.2)';
  ctx.fillRect(50, H - 10, 50, 3);
  ctx.fillStyle = '#e879f9';
  ctx.fillRect(50, H - 10, 50 * (state.novaCharge / NOVA_COST), 3);

  if (state.power) {
    const col = POWER_COLORS[state.power];
    ctx.fillStyle = col;
    ctx.fillText(state.power.toUpperCase(), 124, H - 26);
    ctx.fillStyle = rgba(col, 0.25);
    ctx.fillRect(124, H - 10, 60, 3);
    ctx.fillStyle = col;
    ctx.fillRect(124, H - 10, 60 * Math.min(1, state.powerTime / POWER_TIME), 3);
  }
  if (state.combo > 1) {
    ctx.textAlign = 'right';
    ctx.font = '800 18px Segoe UI, sans-serif';
    glowOn('#fbbf24', 10);
    ctx.fillStyle = '#fde68a';
    ctx.fillText('x' + state.combo, W - 14, H - 32);
    glowOff();
  }
  ctx.textAlign = 'right';
  ctx.font = '700 12px Segoe UI, sans-serif';
  ctx.fillStyle = 'rgba(216,180,254,0.75)';
  ctx.fillText(state.label, W - 14, 12);
}
