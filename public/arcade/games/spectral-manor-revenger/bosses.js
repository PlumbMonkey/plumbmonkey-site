// ============================================================
// REVENGER — the four sector motherships.
// Every boss is a set of parts (circles around its centre). A beam strikes
// the part nearest its origin along its path; a weak point wins a tie, so
// an open weak point is never shielded by the body behind it.
// ============================================================

const BOSS_HP = { harvester: 32, ossuary: 24, leviathan: 34, dreadnought: 44 };
const BOSS_NAME = { harvester: 'THE HARVESTER', ossuary: 'THE OSSUARY', leviathan: 'STORM LEVIATHAN', dreadnought: 'PRISM DREADNOUGHT' };

function createBoss(type) {
  const hp = Math.round(BOSS_HP[type] * info.mult);
  const b = {
    type, name: BOSS_NAME[type], x: wrapX(ship.x + ship.facing * 560), y: 190,
    hp, maxHp: hp, state: 'enter', t: 0, flash: 0, dying: 0, spin: 0, dir: -ship.facing,
    turrets: type === 'ossuary' ? [{ ox: -70, oy: -30, hp: 7 }, { ox: 0, oy: -36, hp: 7 }, { ox: 70, oy: -30, hp: 7 }] : null,
    beamFan: 0, cycleN: 0
  };
  return b;
}

function bossParts(b) {
  const P = [];
  const add = (ox, oy, r, kind, extra) => P.push(Object.assign({ x: wrapX(b.x + ox), y: b.y + oy, r, kind }, extra));
  switch (b.type) {
    case 'harvester':
      add(0, -8, 44, 'body'); add(-58, 6, 20, 'body'); add(58, 6, 20, 'body');
      add(0, 30, 15, b.state === 'beam' ? 'weak' : 'armor');
      break;
    case 'ossuary':
      for (let i = -2; i <= 2; i++) add(i * 40, 0, 24, 'body');
      b.turrets.forEach((t, i) => { if (t.hp > 0) add(t.ox, t.oy, 13, 'turret', { index: i }); });
      add(0, 34, 16, (b.turrets.every(t => t.hp <= 0) && b.state === 'vent') ? 'weak' : 'armor');
      break;
    case 'leviathan': {
      const f = b.dir;
      add(-f * 40, 0, 30, 'body'); add(0, 0, 32, 'body'); add(-f * 78, 4, 18, 'body');
      add(f * 50, -8, 15, b.state === 'dazed' ? 'weak' : 'armor');
      break;
    }
    case 'dreadnought': {
      add(0, 0, 16, 'weak');
      for (let i = 0; i < 10; i++) {
        if (dreadGap(b, i)) continue;
        const a = b.spin + (i / 10) * Math.PI * 2;
        add(Math.cos(a) * 54, Math.sin(a) * 54, 14, 'shield');
      }
      break;
    }
  }
  return P;
}
// two opposite gaps in the ring; they widen once the dreadnought is enraged
function dreadGap(b, i) {
  const enraged = b.hp < b.maxHp * 0.4;
  return i === 0 || i === 1 || i === 5 || i === 6 || (enraged && (i === 2 || i === 7));
}

// Returns true if the beam was spent on the boss.
function beamHitBoss(beam, b) {
  if (!b || b.dying) return false;
  let best = null, bestAlong = Infinity;
  bossParts(b).forEach(p => {
    if (beam.dead) return;
    // where the beam line actually enters this circle: a glancing pass meets a big body late.
    // Weak points reach 16px further out, so the growing beam always meets them first.
    const dy = Math.abs(beam.y - p.y), rr = p.r + beam.h / 2;
    if (dy > rr) return;
    const half = Math.sqrt(rr * rr - dy * dy), centre = wrapDX(p.x, beam.x0) * beam.dir;
    const weak = p.kind === 'weak' || p.kind === 'turret';
    const entry = centre - half - (weak ? 16 : 0);
    if (entry > beam.head || centre + half < beam.tail) return;
    if (entry < bestAlong) { bestAlong = entry; best = p; }
  });
  if (!best || !beamStrike(beam, 'boss:' + best.kind + (best.index ?? ''), best.x, best.y)) return !!best;
  // a boss part always ends the beam, whatever its pierce
  if (!beam.dead) { beam.dead = true; FX.afterimage(beam); }
  if (best.kind === 'weak') damageBoss(b, 1, best.x, best.y);
  else if (best.kind === 'turret') {
    const t = b.turrets[best.index];
    t.hp--; b.flash = 4;
    if (t.hp <= 0) { FX.explode(best.x, best.y, 2, ['#e5e7eb', '#a3a3a3', '#fde68a']); sfx.explode(2, 0); addScore(500, best.x, best.y - 20); }
  } else sfx.shield();
  return true;
}

function damageBoss(b, n, x, y) {
  if (b.dying) return;
  b.hp -= n; b.flash = 6;
  sfx.explode(1, soundPan(toScreen(b.x)));
  if (b.hp <= 0) {
    b.hp = 0; b.dying = 150;
    hazards = []; enemyShots = [];
    fans.forEach(f => { if (f.state === 'grabbed' && f.by === -1) releaseFan(f); });
    addScore(5000 * (info.cycle + 1), b.x, b.y - 60, 'MOTHERSHIP DOWN');
    sfx.explode(4, 0);
    FX.explode(b.x, b.y, 4, ['#ffffff', '#fde68a', '#f472b6', '#67e8f9']);
    FX.flash(0.9);
  }
}

function bossTouchesShip(b) {
  if (!b || b.dying) return false;
  return bossParts(b).some(p => Math.abs(wrapDX(ship.x, p.x)) < p.r + 18 && Math.abs(ship.y - p.y) < p.r + 9);
}

// keep station 320–520px from the ship on whichever side it is on
function bossStation(b, speed, alt) {
  const gap = wrapDX(b.x, ship.x);
  const side = gap >= 0 ? 1 : -1;
  const want = ship.x + side * 400;
  const dx = wrapDX(want, b.x);
  b.x = wrapX(b.x + Math.sign(dx) * Math.min(Math.abs(dx), speed));
  b.y += Math.max(-1.5, Math.min(1.5, alt - b.y));
  b.dir = -side;
}

function bossShoot(b, ox, oy, speed, spread = 0) {
  const x = wrapX(b.x + ox), y = b.y + oy;
  const dx = wrapDX(ship.x, x), dy = ship.y - y;
  const base = Math.atan2(dy, dx);
  for (let i = -spread; i <= spread; i++) {
    const a = base + i * 0.22;
    enemyShots.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: 5, life: 220, kind: 'bolt' });
  }
  sfx.enemyShot(soundPan(toScreen(x)));
}

function stepBoss(b) {
  if (b.flash > 0) b.flash--;
  if (b.dying) {
    b.dying--;
    b.y += 0.6;
    if (b.dying % 9 === 0) {
      const ox = (Math.random() - 0.5) * 140, oy = (Math.random() - 0.5) * 80;
      FX.explode(wrapX(b.x + ox), b.y + oy, 3, ['#ffffff', '#fde68a', '#f472b6']);
      sfx.explode(3, 0);
    }
    return;
  }
  const m = info.mult;
  b.t++;
  if (b.state === 'enter') {
    bossStation(b, 5, 170);
    if (b.t > 90) { b.state = 'hover'; b.t = 0; }
    return;
  }
  switch (b.type) {
    case 'harvester': {
      if (b.state === 'hover') {
        bossStation(b, 2.4 * m, 150 + Math.sin(b.t * 0.03) * 30);
        if (b.t % Math.round(70 / m) === 0) bossShoot(b, 0, 10, 3.6 * m, 1);
        if (b.t > 200) { b.state = 'drop'; b.t = 0; }
      } else if (b.state === 'drop') {
        if (b.t === 20 && enemies.filter(e => !e.dead && e.type === 'lander').length < 4) {
          spawnEnemy('lander', b.x - 40, b.y + 20); spawnEnemy('lander', b.x + 40, b.y + 20);
        }
        if (b.t > 50) { b.state = 'beam'; b.t = 0; b.beamFan = 0; }
      } else if (b.state === 'beam') {
        // it parks, opens the lens and drags the nearest fan up the beam
        b.y += Math.max(-1, Math.min(1, 200 - b.y));
        const f = fans.find(fn => fn.state === 'ground' && Math.abs(wrapDX(fn.x, b.x)) < 36);
        if (f) { f.state = 'grabbed'; f.by = -1; b.beamFan = f.id; }
        const held = fans.find(fn => fn.id === b.beamFan && fn.state === 'grabbed');
        if (held) {
          held.x = wrapX(held.x + wrapDX(b.x, held.x) * 0.1);
          held.y -= 0.9;
          if (held.y < b.y + 40) { loseFan(held, 'HARVESTED'); b.beamFan = 0; }
        }
        if (b.t > 190) {
          if (held) releaseFan(held);
          b.state = 'hover'; b.t = 0; b.cycleN++;
        }
      }
      break;
    }
    case 'ossuary': {
      bossStation(b, 1.9 * m, 170 + Math.sin(b.t * 0.02) * 40);
      const alive = b.turrets.filter(t => t.hp > 0);
      if (alive.length) {
        alive.forEach((t, i) => { if ((b.t + i * 25) % Math.round(80 / m) === 0) bossShoot(b, t.ox, t.oy, 3.8 * m); });
        if (b.t % 150 === 0 && mines.length < MAX_MINES) mines.push({ id: ++nextId, x: b.x, y: b.y + 30, life: 480, arm: 30, r: 7 });
      } else {
        if (b.state === 'hover' && b.t > 120) { b.state = 'vent'; b.t = 0; }
        else if (b.state === 'vent') {
          if (b.t % 40 === 0) bossShoot(b, 0, 34, 3.4 * m, 2);
          if (b.t > 170) { b.state = 'hover'; b.t = 0; }
        }
      }
      break;
    }
    case 'leviathan': {
      if (b.state === 'hover') {
        bossStation(b, 2.2 * m, ship.y);
        if (b.t % 200 === 100 && enemies.filter(e => !e.dead && e.type === 'pod').length < 2) spawnEnemy('pod', b.x, b.y - 40);
        if (b.t > 170) { b.state = 'charge'; b.t = 0; b.laneY = b.y - 6; b.laneDir = b.dir; }
      } else if (b.state === 'charge') {
        if (b.t === 60) {
          hazards.push({ kind: 'lane', x0: wrapX(b.x + b.laneDir * 60), y: b.laneY, dir: b.laneDir, len: 700, h: 22, life: 42, max: 42 });
          sfx.explode(2, 0);
        }
        if (b.t > 100) { b.state = 'dazed'; b.t = 0; }
      } else if (b.state === 'dazed') {
        b.y += Math.sin(b.t * 0.1) * 0.5;
        if (b.t > Math.round(150 / m)) { b.state = 'hover'; b.t = 0; }
      }
      break;
    }
    case 'dreadnought': {
      const enraged = b.hp < b.maxHp * 0.4;
      bossStation(b, 1.7 * m, 190 + Math.sin(b.t * 0.025) * 50);
      b.spin += enraged ? 0.024 : 0.014;
      if (b.state === 'hover' && b.t > 150) { b.state = 'spokeWarn'; b.t = 0; b.spokeA = b.spin; }
      else if (b.state === 'spokeWarn' && b.t > 55) {
        for (let i = 0; i < 4; i++) hazards.push({ kind: 'spoke', bossRef: true, angle: b.spokeA + i * Math.PI / 2 + Math.PI / 4, len: 300, life: 36, max: 36 });
        b.state = 'hover'; b.t = 0;
      }
      if (b.t % Math.round(70 / m) === 35) bossShoot(b, 0, 0, 3.4 * m, enraged ? 2 : 1);
      if (enraged && b.t % 400 === 200 && !enemies.some(e => !e.dead && e.type === 'baiter')) spawnEnemy('baiter', b.x, b.y);
      break;
    }
  }
}

function stepHazards() {
  hazards.forEach(h => { h.life--; });
  hazards = hazards.filter(h => h.life > 0);
}
function hazardHitsShip(h) {
  if (h.kind === 'lane') {
    const along = wrapDX(ship.x, h.x0) * h.dir;
    return along > -10 && along < h.len && Math.abs(ship.y - h.y) < h.h / 2 + 8;
  }
  if (h.kind === 'spoke' && boss) {
    const dx = wrapDX(ship.x, boss.x), dy = ship.y - boss.y;
    const ca = Math.cos(h.angle), sa = Math.sin(h.angle);
    const along = dx * ca + dy * sa, perp = Math.abs(-dx * sa + dy * ca);
    return along > 20 && along < h.len && perp < 12;
  }
  return false;
}

// ---------- art (drawn live) ----------
function bossPaint(c, b, sx) {
  const INK = '#120b1e';
  const sh = (pts, fill, lw = 2.5) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); } if (lw) { c.strokeStyle = INK; c.lineWidth = lw; c.stroke(); } };
  const ov = (x, y, rx, ry, fill, lw = 2.5) => { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    if (fill) { c.fillStyle = fill; c.fill(); } if (lw) { c.strokeStyle = INK; c.lineWidth = lw; c.stroke(); } };
  const eye = (x, y, r, color) => { drawGlow(c, color, x, y, r * 3, 0.8); ov(x, y, r, r, color, 1.5); ov(x, y, r * 0.4, r * 0.4, '#fff', 0); };
  c.save();
  c.translate(sx, b.y);
  c.lineJoin = 'round'; c.lineCap = 'round';
  switch (b.type) {
    case 'harvester': {
      if (b.state === 'beam') {
        const g = c.createLinearGradient(0, 30, 0, groundY(b.x) - b.y);
        g.addColorStop(0, 'rgba(232,121,249,0.5)'); g.addColorStop(1, 'rgba(232,121,249,0.05)');
        c.fillStyle = g;
        c.beginPath(); c.moveTo(-14, 30); c.lineTo(14, 30); c.lineTo(44, groundY(b.x) - b.y); c.lineTo(-44, groundY(b.x) - b.y); c.closePath(); c.fill();
      }
      sh([[-80, 6], [-44, -14], [44, -14], [80, 6], [52, 22], [-52, 22]], '#94a3b8');
      sh([[-80, 6], [80, 6], [52, 22], [-52, 22]], '#64748b', 0);
      for (let i = 0; i < 9; i++) { const on = (Math.floor(tick / 6) + i) % 3 === 0; ov(-60 + i * 15, 12, 3, 3, on ? '#f472b6' : '#831843', 1); }
      c.beginPath(); c.ellipse(0, -14, 36, 30, 0, Math.PI, 0); c.closePath();
      c.fillStyle = 'rgba(103,232,249,0.4)'; c.fill(); c.strokeStyle = INK; c.lineWidth = 2.5; c.stroke();
      greyPilot(c, 0, -26, 3.2);
      ov(0, 28, 15, 9, b.state === 'beam' ? '#fdf4ff' : '#475569');
      if (b.state === 'beam') eye(0, 29, 7, '#e879f9');
      break;
    }
    case 'ossuary': {
      sh([[-110, -6], [-90, -22], [90, -22], [110, -6], [100, 18], [-100, 18]], '#d6d3d1');
      sh([[-110, -6], [110, -6], [100, 18], [-100, 18]], '#a8a29e', 0);
      for (let i = -4; i <= 4; i++) { c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); c.moveTo(i * 22, -20); c.quadraticCurveTo(i * 22 + 6, 0, i * 22, 16); c.stroke(); }
      ov(-96, -2, 10, 12, '#e7e5e4'); ov(-99, -4, 2.5, 3, '#1c1917', 0); ov(-93, -4, 2.5, 3, '#1c1917', 0);
      b.turrets.forEach(t => {
        if (t.hp <= 0) { ov(t.ox, t.oy + 6, 10, 5, '#44403c'); return; }
        sh([[t.ox - 11, t.oy + 10], [t.ox - 8, t.oy - 6], [t.ox + 8, t.oy - 6], [t.ox + 11, t.oy + 10]], '#78716c');
        eye(t.ox, t.oy + 1, 4, '#fde047');
      });
      const open = b.turrets.every(t => t.hp <= 0) && b.state === 'vent';
      sh([[-10, 16], [10, 16], [8, 26], [-8, 26]], '#78716c', 2);
      ov(0, 34, 18, 10, open ? '#fca5a5' : '#57534e');
      if (open) eye(0, 34, 7, '#ef4444');
      break;
    }
    case 'leviathan': {
      c.scale(b.dir, 1);
      const sway = Math.sin(tick * 0.06) * 6;
      sh([[-100, 4 + sway], [-128, -20 + sway], [-120, 6], [-130, 26 + sway]], '#1e3a8a');
      sh([[-90, 0], [-40, -30], [30, -34], [72, -16], [80, 8], [40, 30], [-40, 28]], '#1d4ed8');
      sh([[-90, 0], [80, 8], [40, 30], [-40, 28]], '#bfdbfe', 0);
      for (let i = 0; i < 5; i++) { c.strokeStyle = '#1e3a8a'; c.lineWidth = 2; c.beginPath(); c.moveTo(-30 + i * 16, 18); c.lineTo(-24 + i * 16, 28); c.stroke(); }
      sh([[-20, -30], [0, -52], [16, -32]], '#1e40af');
      const charge = b.state === 'charge' ? b.t / 60 : 0;
      if (charge > 0) { drawGlow(c, '#e0f2fe', 78, -6, 16 + charge * 26, 0.9); }
      if (b.state === 'dazed') { eye(50, -8, 8, '#fde047'); ['*', '*'].forEach((s, i) => { c.fillStyle = '#fde68a'; c.font = 'bold 14px sans-serif'; c.fillText(s, 40 + i * 18 + Math.sin(tick * 0.2 + i) * 4, -40); }); }
      else ov(50, -8, 8, 4, '#0f172a', 2);
      break;
    }
    case 'dreadnought': {
      c.save(); c.rotate(b.spin * 0.5);
      sh([[-34, -34], [34, -34], [34, 34], [-34, 34]], '#1f1235');
      c.strokeStyle = '#f472b6'; c.lineWidth = 2; c.strokeRect(-26, -26, 52, 52);
      c.restore();
      for (let i = 0; i < 10; i++) {
        if (dreadGap(b, i)) continue;
        const a = b.spin + (i / 10) * Math.PI * 2;
        c.save(); c.translate(Math.cos(a) * 54, Math.sin(a) * 54); c.rotate(a);
        sh([[-6, -13], [6, -10], [6, 10], [-6, 13]], `hsl(${(i * 36 + tick * 2) % 360},80%,62%)`, 2);
        c.restore();
      }
      if (b.state === 'spokeWarn') {
        for (let i = 0; i < 4; i++) {
          const a = b.spokeA + i * Math.PI / 2 + Math.PI / 4, L = 40 + (b.t / 55) * 120;
          const g = c.createLinearGradient(0, 0, Math.cos(a) * L, Math.sin(a) * L);
          g.addColorStop(0, 'rgba(244,114,182,0.7)'); g.addColorStop(1, 'rgba(244,114,182,0)');
          c.strokeStyle = g; c.lineWidth = 4; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * L, Math.sin(a) * L); c.stroke();
        }
      }
      eye(0, 0, 10, b.hp < b.maxHp * 0.4 ? '#ef4444' : '#67e8f9');
      break;
    }
  }
  c.restore();
  if (b.flash > 0) drawGlow(c, '#ffffff', sx, b.y, 70, b.flash / 10);
}

function drawBoss(c, b) {
  if (!b) return;
  const sx = toScreen(b.x);
  if (sx > -220 && sx < W + 220) bossPaint(c, b, sx);
  // hazards
  c.save();
  c.globalCompositeOperation = 'lighter';
  hazards.forEach(h => {
    const k = h.life / h.max;
    if (h.kind === 'lane') {
      const x0 = toScreen(h.x0), x1 = x0 + h.dir * h.len;
      const g = c.createLinearGradient(x0, 0, x1, 0);
      g.addColorStop(0, `rgba(224,242,254,${k})`); g.addColorStop(0.8, `rgba(125,211,252,${k * 0.7})`); g.addColorStop(1, 'rgba(125,211,252,0)');
      c.fillStyle = g;
      c.beginPath();
      const n = 14;
      for (let i = 0; i <= n; i++) c.lineTo(x0 + (x1 - x0) * (i / n), h.y - h.h / 2 + (Math.random() - 0.5) * 8);
      for (let i = n; i >= 0; i--) c.lineTo(x0 + (x1 - x0) * (i / n), h.y + h.h / 2 + (Math.random() - 0.5) * 8);
      c.closePath(); c.fill();
    } else if (h.kind === 'spoke' && boss) {
      const bx = toScreen(boss.x);
      const g = c.createLinearGradient(bx, boss.y, bx + Math.cos(h.angle) * h.len, boss.y + Math.sin(h.angle) * h.len);
      g.addColorStop(0, `rgba(255,255,255,${k})`); g.addColorStop(0.85, `rgba(244,114,182,${k * 0.8})`); g.addColorStop(1, 'rgba(244,114,182,0)');
      c.strokeStyle = g; c.lineWidth = 14 * k + 4;
      c.beginPath(); c.moveTo(bx, boss.y); c.lineTo(bx + Math.cos(h.angle) * h.len, boss.y + Math.sin(h.angle) * h.len); c.stroke();
    }
  });
  c.restore();
}

// For the autopilot: where a beam will do damage right now, if anywhere.
function bossTarget(b) {
  if (!b || b.dying || b.state === 'enter') return null;
  const parts = bossParts(b);
  const t = parts.find(p => p.kind === 'turret') || parts.find(p => p.kind === 'weak');
  return t ? { x: t.x, y: t.y, r: t.r } : null;
}
