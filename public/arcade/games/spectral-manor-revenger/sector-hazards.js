// ============================================================
// REVENGER — what makes each sector its own place.
//   STORM COAST  gusts shove the ship; lightning gathers in a cloud, then strikes
//   NEON CITY    towers you fly round (they stop shots both ways) and
//                searchlights that call a hunter if they hold you
// Graveyard Hills' wraiths are an enemy and live in enemies.js.
// Rules first (seeded rng only), art at the bottom. Every hazard grows from
// its own source: the cloud, the lamp, the wind arrows.
// ============================================================

const GUST_WARN = 80, GUST_BLOW = 200, GUST_PUSH = 0.14;
const BOLT_WARN = 75, BOLT_STRIKE = 12, BOLT_HALF = 26;
const LIGHT_LEN = 250, LIGHT_HALF = 0.17, SPOT_FULL = 60, SPOT_COOL = 420;

let towers = [];
let wind = { state: 'calm', t: 480, dir: 1 };
let bolts = [], boltT = 300;
let spot = 0, spotCool = 0;

// Called as each stage is set up, before the fans are placed.
function setupSectorHazards() {
  const s = info.sector;
  towers = (s.towers || []).map(([x, w, h, light], i) => ({ id: i, x, w, top: terrainAt(s, x) - h, light: !!light, ph: i * 1.7 }));
  wind = { state: 'calm', t: 480, dir: 1 };
  bolts = []; boltT = 300; spot = 0; spotCool = 0;
}

// ---------- towers ----------
function towerAt(x) {
  for (const t of towers) if (Math.abs(wrapDX(x, t.x)) <= t.w / 2) return t;
  return null;
}
// what a fan, a pickup or a landing ship stands on: a roof, or the ground
function surfaceY(x) { const t = towerAt(x); return t ? t.top : groundY(x); }
function insideTower(x, y) { const t = towerAt(x); return !!t && y > t.top; }
// how far a shot fired from (x, y) flies before a tower stops it
function beamRange(x, y, dir) {
  let best = BEAM_RANGE;
  for (const t of towers) {
    if (y <= t.top) continue;
    const d = wrapDX(t.x - dir * t.w / 2, x) * dir;
    if (d >= -t.w && d < best) best = Math.max(0, d);
  }
  return best;
}

// ---------- searchlights ----------
// The lamp sweeps either side of straight up. Angle 0 is up, positive leans right.
function lightAngle(t) { return Math.sin(tick * 0.011 + t.ph); }
function inLight(t, x, y) {
  const dx = wrapDX(x, t.x), up = t.top - 10 - y;
  if (up <= 0 || Math.hypot(dx, up) > LIGHT_LEN) return false;
  return Math.abs(Math.atan2(dx, up) - lightAngle(t)) < LIGHT_HALF;
}
function stepSearchlights() {
  if (spotCool > 0) { spotCool--; spot = 0; return; }
  const seen = towers.some(t => t.light && inLight(t, ship.x, ship.y));
  spot = seen ? Math.min(SPOT_FULL, spot + 2) : Math.max(0, spot - 1);
  if (spot < SPOT_FULL) return;
  spot = 0; spotCool = SPOT_COOL;
  if (enemies.filter(e => !e.dead && e.type === 'baiter').length < 2) {
    spawnEnemy('baiter', ship.x + (rng() < 0.5 ? -1 : 1) * W * 0.7, HUD_H + 60);
  }
  FX.popup(ship.x, ship.y - 40, 'SPOTTED!', '#fca5a5');
  sfx.warning();
}

// ---------- wind ----------
function stepWind() {
  wind.t--;
  if (wind.state === 'calm') {
    if (wind.t <= 0) { wind.state = 'warn'; wind.t = GUST_WARN; wind.dir = rng() < 0.5 ? -1 : 1; sfx.gust(); }
    return;
  }
  if (wind.state === 'warn') {
    if (wind.t <= 0) { wind.state = 'blow'; wind.t = GUST_BLOW; }
    return;
  }
  ship.vx += wind.dir * GUST_PUSH;
  fans.forEach(f => { if (f.state === 'falling') f.x = wrapX(f.x + wind.dir * 0.8); });
  mines.forEach(m => { m.x = wrapX(m.x + wind.dir * 0.6); });
  if (wind.t <= 0) { wind.state = 'calm'; wind.t = Math.round(rrange(420, 660) / info.mult); }
}

// ---------- lightning ----------
// A cloud gathers over where the ship is heading, a leader creeps down, then
// the bolt lands. It kills whatever is under it: the ship, or the invaders.
function stepLightning() {
  if (--boltT <= 0) {
    boltT = Math.round(rrange(300, 420) / info.mult) - info.wave * 40;
    bolts.push({ id: ++nextId, x: wrapX(ship.x + ship.vx * 30 + rrange(-170, 170)), t: 0 });
  }
  bolts.forEach(b => {
    b.t++;
    if (b.t === BOLT_WARN) { sfx.thunder(); FX.flash(0.35, '#e0f2fe'); FX.shake(6, 14); }
    if (b.t < BOLT_WARN) return;
    enemies.forEach(e => { if (!e.dead && !ghosted(e) && Math.abs(wrapDX(e.x, b.x)) < BOLT_HALF + e.r) killEnemy(e); });
    mines.forEach(m => { if (!m.dead && Math.abs(wrapDX(m.x, b.x)) < BOLT_HALF + m.r) m.dead = true; });
  });
  bolts = bolts.filter(b => b.t < BOLT_WARN + BOLT_STRIKE);
}
function boltHitsShip() {
  return bolts.some(b => b.t >= BOLT_WARN && Math.abs(wrapDX(ship.x, b.x)) < BOLT_HALF + 12);
}

function stepSectorHazards() {
  if (info.sector.storm) { stepWind(); if (!info.isBoss) stepLightning(); }
  if (towers.length && !info.isBoss) stepSearchlights();
}

// ============================================================ art
function drawTowers(c) {
  towers.forEach(t => {
    const sx = toScreen(t.x);
    if (sx < -t.w - LIGHT_LEN || sx > W + t.w + LIGHT_LEN) return;
    const x0 = sx - t.w / 2, tall = H - t.top;
    // lighter and warmer than the skyline behind, with a lit edge, so it reads as the one you can hit
    c.fillStyle = '#45295f'; c.fillRect(x0, t.top, t.w, tall);
    c.fillStyle = '#2f1a47'; c.fillRect(x0 + t.w * 0.66, t.top, t.w * 0.34, tall);
    for (let r = 0; r * 17 + 16 < tall - 30; r++) for (let q = 0; q * 15 + 10 < t.w - 8; q++) {
      const k = hash(t.id * 71 + r * 13 + q * 5);
      if (k < 0.5) continue;
      c.fillStyle = k < 0.8 ? '#fde68a' : '#fb923c';
      c.fillRect(x0 + 8 + q * 15, t.top + 14 + r * 17, 8, 7);
    }
    c.strokeStyle = '#120b1e'; c.lineWidth = 3; c.strokeRect(x0, t.top, t.w, tall + 4);
    c.fillStyle = 'rgba(249,168,212,0.55)'; c.fillRect(x0 + 2, t.top + 2, 2, tall);
    c.fillStyle = '#5b3a78'; c.fillRect(x0 - 5, t.top - 6, t.w + 10, 7);
    c.strokeRect(x0 - 5, t.top - 6, t.w + 10, 7);
    c.fillStyle = '#f9a8d4'; c.fillRect(x0 - 4, t.top - 5, t.w + 8, 2);
    if (!t.light) {
      c.fillStyle = '#3b1a52'; c.fillRect(sx - 1, t.top - 24, 2, 19);
      drawGlow(c, '#f472b6', sx, t.top - 25, 9, 0.5 + Math.sin(tick * 0.1 + t.ph) * 0.4);
      return;
    }
    // the lamp and its cone; it glows red as it holds the ship, and goes dim while it cools
    const hot = spot / SPOT_FULL, off = spotCool > 0;
    const rgb = hot > 0 ? '252,165,165' : '254,240,138';
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.translate(sx, t.top - 10); c.rotate(lightAngle(t));
    const g = c.createLinearGradient(0, 0, 0, -LIGHT_LEN);
    g.addColorStop(0, `rgba(${rgb},${off ? 0.1 : 0.34 + hot * 0.3})`); g.addColorStop(1, `rgba(${rgb},0)`);
    const spread = Math.tan(LIGHT_HALF) * LIGHT_LEN;
    c.fillStyle = g;
    c.beginPath(); c.moveTo(-5, 0); c.lineTo(5, 0); c.lineTo(spread, -LIGHT_LEN); c.lineTo(-spread, -LIGHT_LEN); c.closePath(); c.fill();
    c.restore();
    c.fillStyle = '#2a1440'; c.strokeStyle = '#120b1e'; c.lineWidth = 2;
    c.beginPath(); c.arc(sx, t.top - 9, 8, Math.PI, 0); c.closePath(); c.fill(); c.stroke();
    drawGlow(c, hot > 0 ? '#fca5a5' : '#fef08a', sx, t.top - 12, 10, off ? 0.25 : 0.9);
  });
}

function boltPath(b, sx, y0, y1) {
  const pts = [];
  for (let k = 0; k <= 10; k++) pts.push([sx + (k && k < 10 ? (hash(b.id * 13 + k) - 0.5) * 30 : 0), y0 + (y1 - y0) * k / 10]);
  return pts;
}

// Drawn over the enemies: the wind, the storm cloud and the bolt.
function drawSectorFront(c) {
  if (!info.sector.storm) return;
  if (wind.state !== 'calm') {
    const warn = wind.state === 'warn';
    const a = warn ? 0.25 : 0.5 * Math.min(1, wind.t / 30);
    c.save();
    c.strokeStyle = `rgba(186,230,253,${a})`; c.lineWidth = 1.5; c.lineCap = 'round';
    c.beginPath();
    for (let i = 0; i < 26; i++) {
      const x = (((hash(i + 40) * W + wind.dir * tick * (warn ? 5 : 15)) % W) + W) % W;
      const y = HUD_H + 20 + hash(i + 80) * (H - HUD_H - 90);
      c.moveTo(x, y); c.lineTo(x - wind.dir * (warn ? 14 : 30), y);
    }
    c.stroke();
    if (!warn || Math.floor(tick / 8) % 2) {
      c.fillStyle = '#bae6fd'; c.textAlign = 'center'; c.font = 'bold 15px "Segoe UI", sans-serif';
      c.shadowColor = '#7dd3fc'; c.shadowBlur = 10;
      c.fillText(wind.dir > 0 ? 'GUST ▶▶' : '◀◀ GUST', W / 2, HUD_H + 48);
    }
    c.restore();
  }
  bolts.forEach(b => {
    const sx = toScreen(b.x);
    if (sx < -160 || sx > W + 160) return;
    const cy = HUD_H + 36, gy = groundY(b.x);
    const p = Math.min(1, b.t / BOLT_WARN), strike = b.t >= BOLT_WARN;
    const flick = 0.6 + Math.sin(b.t * 0.9) * 0.4;
    for (let i = 0; i < 5; i++) {
      c.save();
      c.translate(sx + (i - 2) * 30, cy + (i % 2) * 10); c.scale(1.5, 0.75);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, 44);
      g.addColorStop(0, `rgba(30,41,59,${0.9 * Math.min(1, b.t / 20)})`); g.addColorStop(1, 'rgba(30,41,59,0)');
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, 44, 0, Math.PI * 2); c.fill();
      c.restore();
    }
    drawGlow(c, '#e0f2fe', sx, cy + 8, 26 + p * 30, (0.2 + p * 0.5) * flick);
    drawGlow(c, '#7dd3fc', sx, gy - 4, 36, 0.15 + p * 0.45);
    const pts = boltPath(b, sx, cy + 12, gy);
    const upto = strike ? pts.length : Math.max(2, Math.ceil(pts.length * p * 0.55));
    c.save();
    c.globalCompositeOperation = 'lighter'; c.lineJoin = 'round'; c.lineCap = 'round';
    if (strike) {
      const col = c.createLinearGradient(sx - BOLT_HALF - 14, 0, sx + BOLT_HALF + 14, 0);
      col.addColorStop(0, 'rgba(125,211,252,0)'); col.addColorStop(0.5, 'rgba(224,242,254,0.5)'); col.addColorStop(1, 'rgba(125,211,252,0)');
      c.fillStyle = col; c.fillRect(sx - BOLT_HALF - 14, cy, BOLT_HALF * 2 + 28, gy - cy);
    }
    const trace = (w, style) => {
      c.strokeStyle = style; c.lineWidth = w;
      c.beginPath(); pts.slice(0, upto).forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
    };
    if (strike) { trace(11, 'rgba(125,211,252,0.55)'); trace(4, '#ffffff'); }
    else trace(2.5, `rgba(224,242,254,${0.35 + flick * 0.4})`);
    c.restore();
  });
}
