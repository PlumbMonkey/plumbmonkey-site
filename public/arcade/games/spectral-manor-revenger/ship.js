// ============================================================
// REVENGER — the hero ship: flight, one-press lasers, power-up levels,
// Ghost Options, tractor, warp. Drawn with the Hero Kit pilot in the canopy.
// ============================================================

const SHIP_ACC = 0.62, SHIP_MAX = 8.2, SHIP_DRAG = 0.93, SHIP_VY = 5.2;
const FIRE_GAP = 4;                       // frames: taps are buffered, never swallowed
const BEAM_SPEED = 26, BEAM_LEN = 230, BEAM_RANGE = 880;
const MAX_LASER = 3, MAX_BOMBS = 5, MAX_WARPS = 3, MAX_OPTIONS = 2, MAX_SHIELD = 2;
const OPTION_GAP = 14;                    // trail samples between the ship and each option
const CATCH_R = 26, TRACTOR_R = 140;

function newShip() {
  return {
    x: 200, y: 230, vx: 0, facing: 1, bank: 0, inv: 0, flameT: 0,
    laser: 0, bombs: 3, warps: 1, shield: 0, options: 0, tractor: false,
    fireCd: 0, fireQueued: false, bombCd: 0, warpCd: 0,
    carried: [], trail: []
  };
}

function shipCeil() { return HUD_H + 16; }
function shipFloor(x) { return groundY(x) - 20; }

let beamId = 0;
function makeBeam(x, y, dir, kind, pierce, hue) {
  return { id: ++beamId, x0: wrapX(x), y, dir, head: 0, tail: 0, age: 0, kind,
    h: kind === 'wave' ? 26 : 6, pierce, hits: [], dead: false, hue };
}

// inp: { left, right, up, down, fire (a fresh press), bomb, warp }
function stepShip(s, inp) {
  if (inp.left && !inp.right) { s.vx -= SHIP_ACC; s.facing = -1; }
  else if (inp.right && !inp.left) { s.vx += SHIP_ACC; s.facing = 1; }
  else s.vx *= SHIP_DRAG;
  s.vx = Math.max(-SHIP_MAX, Math.min(SHIP_MAX, s.vx));
  const vy = (inp.down ? SHIP_VY : 0) - (inp.up ? SHIP_VY : 0);
  s.x = wrapX(s.x + s.vx);
  s.y = Math.max(shipCeil(), Math.min(shipFloor(s.x), s.y + vy));
  s.bank += (vy * 0.05 - s.bank) * 0.2;
  s.flameT += Math.abs(s.vx) * 0.08 + 0.1;
  s.trail.unshift({ x: s.x, y: s.y });
  if (s.trail.length > OPTION_GAP * MAX_OPTIONS + 2) s.trail.length = OPTION_GAP * MAX_OPTIONS + 2;
  if (s.inv > 0) s.inv--;
  if (s.bombCd > 0) s.bombCd--;
  if (s.warpCd > 0) s.warpCd--;

  if (inp.fire) s.fireQueued = true;
  if (s.fireCd > 0) s.fireCd--;
  if (s.fireQueued && s.fireCd <= 0) { s.fireQueued = false; fireShip(s); }
}

function optionPos(s, i) {
  const p = s.trail[Math.min(s.trail.length - 1, (i + 1) * OPTION_GAP)] || s;
  return { x: p.x, y: p.y + (i === 0 ? -22 : 22) };
}

// One press → one volley. The level decides what a volley is.
function fireShip(s) {
  const nose = s.x + s.facing * 26;
  const hue = (tick * 7) % 360;
  const pierce = s.laser >= 2 ? 3 : 1;
  if (s.laser === 0) beams.push(makeBeam(nose, s.y + 2, s.facing, 'laser', 1, hue));
  else {
    beams.push(makeBeam(nose, s.y - 4, s.facing, 'laser', pierce, hue));
    beams.push(makeBeam(nose, s.y + 7, s.facing, 'laser', pierce, hue + 40));
  }
  if (s.laser >= 3) beams.push(makeBeam(nose, s.y + 2, s.facing, 'wave', 3, hue + 180));
  for (let i = 0; i < s.options; i++) {
    const o = optionPos(s, i);
    beams.push(makeBeam(o.x + s.facing * 10, o.y, s.facing, 'laser', pierce, hue + 90));
  }
  shotsFired++;
  s.fireCd = FIRE_GAP;
  sfx.laser(soundPan(toScreen(s.x)), s.laser);
}

function stepBeams() {
  beams.forEach(b => {
    b.age++;
    b.head = Math.min(BEAM_RANGE, b.head + BEAM_SPEED);
    b.tail = Math.max(b.tail, b.head - BEAM_LEN);
    if (b.head >= BEAM_RANGE) b.tail += BEAM_SPEED;
    if (b.tail >= b.head) b.dead = true;
  });
  beams = beams.filter(b => !b.dead);
}

// Does beam b touch a circle at (x, y, r)? Measured along the beam's own axis.
function beamTouches(b, x, y, r) {
  if (b.dead) return false;
  const along = wrapDX(x, b.x0) * b.dir;
  return along >= b.tail - r && along <= b.head + r && Math.abs(y - b.y) <= b.h / 2 + r;
}
// A beam hits each target at most once, and dies once its pierce is spent.
function beamStrike(b, id, x, y) {
  if (b.dead || b.hits.includes(id)) return false;
  b.hits.push(id);
  if (typeof FX !== 'undefined') FX.spark(x, y, `hsl(${b.hue % 360},100%,70%)`);
  if (b.hits.length >= b.pierce) { b.dead = true; FX.afterimage(b); }
  return true;
}

// Falling fans: caught on contact (or pulled in by the tractor), set down low.
function stepCatch(s) {
  fans.forEach(f => {
    if (f.state !== 'falling') return;
    const dx = wrapDX(f.x, s.x), dy = f.y - s.y;
    const d = Math.hypot(dx, dy);
    if (s.tractor && d < TRACTOR_R) {
      f.x = wrapX(f.x - dx * 0.12);
      f.y -= dy * 0.12;
      f.vy *= 0.6;
    }
    if (d < (s.tractor ? CATCH_R + 14 : CATCH_R)) {
      f.state = 'carried';
      s.carried.push(f);
      addScore(500, f.x, f.y, 'CAUGHT');
      sfx.catchFan();
    }
  });
  s.carried.forEach((f, i) => { f.x = wrapX(s.x - s.facing * (i * 6)); f.y = s.y + 18 + i * 3; });
  if (s.carried.length && s.y >= shipFloor(s.x) - 6) {
    s.carried.forEach(f => {
      f.state = 'ground'; f.y = groundY(f.x); f.vy = 0;
      addScore(500, f.x, f.y - 20, 'SAFE');
      rescuedCount++;
      if (rescuedCount % 3 === 0) dropPickup(f.x, f.y - 60);
    });
    s.carried = [];
    sfx.rescue();
  }
}

// ---------- Art ----------
const shipSprites = {};
function shipSprite(frame) {
  if (shipSprites[frame]) return shipSprites[frame];
  const cv = document.createElement('canvas');
  cv.width = 96; cv.height = 52;
  const c = cv.getContext('2d');
  c.translate(52, 28);
  c.lineJoin = 'round'; c.lineCap = 'round';
  const INK = '#120b1e';
  const poly = (pts, fill, lw = 2) => {
    c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (lw) { c.strokeStyle = INK; c.lineWidth = lw; c.stroke(); }
  };
  // thruster flame (behind the hull)
  const fl = [14, 20, 17][frame];
  c.save(); c.globalCompositeOperation = 'lighter';
  const g = c.createLinearGradient(-22 - fl, 0, -20, 0);
  g.addColorStop(0, 'rgba(34,211,238,0)'); g.addColorStop(0.6, 'rgba(103,232,249,0.8)'); g.addColorStop(1, '#ecfeff');
  c.fillStyle = g;
  c.beginPath(); c.moveTo(-20, -5); c.lineTo(-22 - fl, 1); c.lineTo(-20, 7); c.closePath(); c.fill();
  c.restore();
  // lower wing
  poly([[-4, 6], [-20, 18], [-10, 18], [12, 7]], '#1e3558');
  poly([[-4, 6], [-12, 12], [2, 8]], '#3f6aa8', 0);
  // hull
  poly([[30, 1], [18, -6], [-8, -8], [-21, -5], [-22, 7], [-8, 9], [18, 8]], '#eef0f2');
  poly([[-21, 2], [18, 3], [30, 1], [18, 8], [-8, 9], [-22, 7]], '#c3c8cf', 0);
  poly([[-18, -1], [16, 0], [22, 1], [16, 3], [-18, 3]], '#1e3558', 0);
  poly([[-10, -1], [2, 0], [2, 3], [-10, 3]], '#d98a3a', 0);
  poly([[30, 1], [24, -2], [24, 4]], '#e9b86a', 1.2);
  // upper wing / fin
  poly([[-6, -7], [-18, -18], [-12, -18], [8, -7]], '#1e3558');
  // engine block
  poly([[-22, -5], [-18, -7], [-18, 9], [-22, 7]], '#2a2230', 1.6);
  // canopy glass, pilot inside, gold frame
  c.save();
  c.beginPath(); c.ellipse(5, -8, 12, 8, 0, Math.PI, 0); c.closePath(); c.clip();
  c.fillStyle = 'rgba(56,120,160,0.55)'; c.fillRect(-10, -18, 30, 12);
  if (typeof HeroKit !== 'undefined') HeroKit.pilot(c, 4, -6, { face: 1, look: frame === 1 ? 1 : 0, scale: 0.78 });
  c.fillStyle = 'rgba(255,255,255,0.28)';
  c.beginPath(); c.ellipse(9, -13, 5, 2, -0.3, 0, Math.PI * 2); c.fill();
  c.restore();
  c.beginPath(); c.ellipse(5, -8, 12, 8, 0, Math.PI, 0);
  c.strokeStyle = INK; c.lineWidth = 2.2; c.stroke();
  c.strokeStyle = '#c9a24a'; c.lineWidth = 1; c.stroke();
  // running light
  c.shadowColor = '#f472b6'; c.shadowBlur = 6;
  c.fillStyle = '#fbcfe8'; c.beginPath(); c.arc(-15, 13, 1.6, 0, Math.PI * 2); c.fill();
  return (shipSprites[frame] = cv);
}

function drawShip(c, s, sx) {
  if (s.inv > 0 && Math.floor(s.inv / 4) % 2 === 0 && phase === 'play') return;
  c.save();
  c.translate(sx, s.y);
  c.rotate(s.bank * s.facing);
  c.scale(s.facing, 1);
  const spr = shipSprite(Math.floor(s.flameT) % 3);
  c.drawImage(spr, -52, -28);
  c.restore();
  if (s.shield > 0) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    const pulse = 0.5 + Math.sin(tick * 0.2) * 0.2;
    c.strokeStyle = `rgba(244,114,182,${pulse})`;
    c.lineWidth = s.shield === 2 ? 3 : 1.6;
    c.beginPath();
    for (let i = 0; i <= 6; i++) {
      const a = (i / 6) * Math.PI * 2 + tick * 0.02;
      const px = sx + Math.cos(a) * 38, py = s.y + Math.sin(a) * 24;
      i ? c.lineTo(px, py) : c.moveTo(px, py);
    }
    c.stroke();
    c.restore();
  }
}

function drawOption(c, sx, y, i) {
  const bob = Math.sin(tick * 0.12 + i * 2) * 2;
  c.save();
  drawGlow(c, '#a5f3fc', sx, y + bob, 18, 0.5);
  c.translate(sx, y + bob);
  c.lineJoin = 'round';
  c.beginPath();
  c.moveTo(-7, 6); c.lineTo(-7, -2); c.arc(0, -2, 7, Math.PI, 0); c.lineTo(7, 6);
  for (let k = 0; k < 3; k++) c.quadraticCurveTo(7 - (k + 0.5) * 4.6, 10 + Math.sin(tick * 0.3 + k) * 2, 7 - (k + 1) * 4.6, 6);
  c.closePath();
  c.fillStyle = 'rgba(226,246,255,0.9)'; c.fill();
  c.strokeStyle = '#120b1e'; c.lineWidth = 1.5; c.stroke();
  c.fillStyle = '#0e7490';
  c.fillRect(-4, -4, 2.4, 3); c.fillRect(1.6, -4, 2.4, 3);
  c.restore();
}

function drawTractor(c, s, sx) {
  if (!s.tractor) return;
  const near = fans.some(f => f.state === 'falling' && Math.hypot(wrapDX(f.x, s.x), f.y - s.y) < TRACTOR_R);
  if (!near) return;
  c.save();
  c.globalCompositeOperation = 'lighter';
  const g = c.createRadialGradient(sx, s.y + 8, 4, sx, s.y + 8, TRACTOR_R);
  g.addColorStop(0, 'rgba(94,234,212,0.35)');
  g.addColorStop(1, 'rgba(94,234,212,0)');
  c.fillStyle = g;
  c.beginPath(); c.arc(sx, s.y + 8, TRACTOR_R, 0, Math.PI * 2); c.fill();
  c.restore();
}
