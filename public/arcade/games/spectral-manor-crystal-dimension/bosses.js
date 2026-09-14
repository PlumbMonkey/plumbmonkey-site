// ============================================================
// CRYSTAL DIMENSION — boss rules
// Interface used by game.js:
//   createBoss(def, cycle)       -> boss object
//   updateBoss(b)                -> movement + attacks (one 60 Hz step)
//   bossShotHit(b, shot)         -> true if the player's shot was stopped
//   bossTouchesShip(b)           -> true if the ship is touching the boss
//   bossNovaHit(b, x, y, radius) -> nova blast damage
// Each boss teaches one idea: the Warden = strip the armour first, the
// Carrier = manage its adds, the Serpent = its body blocks shots, the Heart =
// time your shots through the gaps and read the laser tells.
// ============================================================

const CARRIER_CHARGE = 60;
const HEART_PLATES = 10, HEART_SHELL = 62, HEART_WARN = 60, HEART_FIRE = 28, HEART_BEAM_W = 11;

function createBoss(def, cycle) {
  const hpScale = 1 + cycle * 0.5;
  const base = { type: def.type, name: def.name, flash: 0, t: 0 };
  if (def.type === 'warden') {
    return Object.assign(base, {
      x: W / 2, y: -60, entry: true, r: 36, hp: Math.round(18 * hpScale), rot: 0, plateR: 66, eyeA: 0,
      plates: Array.from({ length: 6 }, (_, i) => ({ a: i * Math.PI / 3, hp: 2 })),
      fireT: 120, fireWarn: false, points: 5000
    });
  }
  if (def.type === 'carrier') {
    return Object.assign(base, {
      x: -120, y: 96, entry: true, dir: 1, r: 60, hp: Math.round(34 * hpScale),
      charge: 0, screamT: 220, launchT: 150, seekT: 260, bayGlow: [0, 0], aim: Math.PI / 2, points: 6000
    });
  }
  if (def.type === 'serpent') {
    const segs = Array.from({ length: 12 }, (_, i) => ({ x: -30 - i * 14, y: 110, a: 0, hp: 2, flash: 0 }));
    return Object.assign(base, {
      x: -20, y: 110, angle: 0, speed: 2.1, r: 22, hp: Math.round(20 * hpScale),
      segs, path: [], goal: { x: W * 0.7, y: H * 0.3 }, goalT: 0, spitT: 140, jaw: 0, points: 7000
    });
  }
  // heart
  return Object.assign(base, {
    x: W / 2, y: H / 2, r: 34, hp: Math.round(30 * hpScale), rot: 0, spin: 0.01,
    gaps: [0, 5], spokes: [], spokeT: 150, ringT: 90, points: 9000
  });
}

function aimAt(b) { return Math.atan2(ship.y - b.y, ship.x - b.x); }

function updateBoss(b) {
  b.t++;
  if (b.flash > 0) b.flash--;
  const fast = cycleMult;
  if (b.type === 'warden') {
    if (b.entry) { b.y += 1.5; if (b.y >= 150) b.entry = false; return; }
    b.x = W / 2 + Math.sin(b.t * 0.008) * 260;
    b.y = H / 2 - 40 + Math.sin(b.t * 0.013) * 110;
    const platesLeft = b.plates.filter(p => p.hp > 0).length;
    b.rot += 0.014 + (6 - platesLeft) * 0.004;
    b.eyeA = aimAt(b);
    b.fireT -= fast;
    b.fireWarn = b.fireT < 30;
    if (b.fireT <= 0) {
      const n = platesLeft > 2 ? 8 : 12, off = b.t * 0.05;
      for (let i = 0; i < n; i++) fireEnemy(b.x, b.y, off + i * Math.PI * 2 / n, 2.8 * fast, '#e879f9', 110);
      if (platesLeft <= 2) [-0.15, 0, 0.15].forEach(d => fireEnemy(b.x, b.y, b.eyeA + d, 4.6 * fast, '#f87171', 90));
      sfx.bossShot();
      b.fireT = platesLeft > 2 ? 130 : 95;
    }
    return;
  }

  if (b.type === 'carrier') {
    if (b.entry) { b.x += 2; if (b.x >= 140) b.entry = false; return; }
    b.x += b.dir * 1.2 * fast;
    if (b.x > W - 110) b.dir = -1;
    if (b.x < 110) b.dir = 1;
    b.y = 96 + Math.sin(b.t * 0.02) * 16;
    b.bayGlow = b.bayGlow.map(g => Math.max(0, g - 0.03));
    b.launchT -= fast;
    if (b.launchT < 40) b.bayGlow[b.t % 2] = 1 - b.launchT / 40;
    if (b.launchT <= 0) {
      if (saucers.length < 3) { spawnSaucerAt(b.x + (b.t % 2 ? 44 : -44), b.y + 24); sfx.launch(); }
      b.launchT = 250;
    }
    b.seekT -= fast;
    if (b.seekT <= 0) {
      if (seekers.length < 4) { spawnSeekerAt(b.x - 30, b.y + 10, Math.PI * 0.6); spawnSeekerAt(b.x + 30, b.y + 10, Math.PI * 0.4); }
      b.seekT = 320;
    }
    if (b.charge > 0) {
      b.charge++;
      b.aim = aimAt({ x: b.x, y: b.y - 8 });
      if (b.charge >= CARRIER_CHARGE) {
        for (let ring = 0; ring < 3; ring++) {
          for (let i = -3; i <= 3; i++) fireEnemy(b.x, b.y - 8, b.aim + i * 0.12, (3 + ring * 0.8) * fast, '#fb7185', 120);
        }
        sfx.scream();
        shake(6);
        b.charge = 0;
        b.screamT = 260;
      }
    } else if ((b.screamT -= fast) <= 0) {
      b.charge = 1;
      sfx.charge();
    }
    return;
  }

  if (b.type === 'serpent') {
    // wander between goals, sometimes hunting the ship directly
    if (--b.goalT <= 0 || Math.hypot(b.goal.x - b.x, b.goal.y - b.y) < 40) {
      b.goal = Math.random() < 0.45 ? { x: ship.x, y: ship.y } : { x: 80 + Math.random() * (W - 160), y: 70 + Math.random() * (H - 140) };
      b.goalT = 180;
    }
    const want = Math.atan2(b.goal.y - b.y, b.goal.x - b.x);
    let d = want - b.angle;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    b.angle += Math.max(-0.045, Math.min(0.045, d));
    const lost = b.segs.filter(s => s.hp <= 0).length;
    const sp = (b.speed + lost * 0.12) * fast;
    b.x += Math.cos(b.angle) * sp;
    b.y += Math.sin(b.angle) * sp;
    b.x = Math.max(30, Math.min(W - 30, b.x));
    b.y = Math.max(30, Math.min(H - 30, b.y));
    b.path.unshift({ x: b.x, y: b.y });
    if (b.path.length > 200) b.path.pop();
    b.segs.forEach((s, i) => {
      const p = b.path[Math.min(b.path.length - 1, Math.round((i + 1) * 14 / Math.max(1, sp)))];
      if (p) { s.a = Math.atan2(p.y - s.y, p.x - s.x) || s.a; s.x = p.x; s.y = p.y; }
      if (s.flash > 0) s.flash--;
    });
    b.jaw = Math.max(-1, b.jaw - 0.05);
    b.spitT -= fast;
    if (b.spitT < 20) b.jaw = 1 - b.spitT / 20;   // TELL: jaws open before spitting
    if (b.spitT <= 0) {
      const a = aimAt(b);
      [-0.2, 0, 0.2].forEach(o => fireEnemy(b.x + Math.cos(b.angle) * 24, b.y + Math.sin(b.angle) * 24, a + o, 4.2 * fast, '#a5f3fc', 100));
      sfx.bossShot();
      b.spitT = lost > 6 ? 90 : 140;
    }
    return;
  }

  // heart
  b.rot += b.spin * fast;
  if (b.t % 420 === 0) b.spin = -b.spin;
  b.spokes.forEach(s => {
    s.t--;
    if (s.t <= 0 && s.state === 'warn') { s.state = 'fire'; s.t = HEART_FIRE; sfx.laser(); shake(4); }
  });
  b.spokes = b.spokes.filter(s => s.t > 0);
  if (--b.spokeT <= 0 && b.spokes.length === 0) {
    const n = b.hp < b.maxHp / 2 ? 4 : 3, off = aimAt(b) + (Math.random() < 0.5 ? 0.5 : -0.5);
    for (let i = 0; i < n; i++) b.spokes.push({ a: off + i * Math.PI * 2 / n, t: HEART_WARN, state: 'warn' });
    b.spokeT = 200;
  }
  if (--b.ringT <= 0) {
    for (let i = 0; i < 12; i++) fireEnemy(b.x, b.y, b.rot * 2 + i * Math.PI / 6, 2.6 * fast, '#fde047', 130);
    b.ringT = 150;
  }
}

function hurtBoss(b, n) {
  b.hp -= n;
  b.flash = 6;
  sfx.bossHit();
}

function bossShotHit(b, shot) {
  if (b.entry) return false;
  if (b.type === 'warden') {
    for (const p of b.plates) {
      if (p.hp <= 0) continue;
      const a = b.rot + p.a;
      if (Math.hypot(shot.x - (b.x + Math.cos(a) * b.plateR), shot.y - (b.y + Math.sin(a) * b.plateR)) < 18) {
        p.hp--;
        explode(shot.x, shot.y, '#a8a29e', p.hp > 0 ? 5 : 16, true);
        if (p.hp <= 0) { addScore(250, shot.x, shot.y); sfx.boom(); }
        return true;
      }
    }
    if (Math.hypot(shot.x - b.x, shot.y - b.y) < b.r) { hurtBoss(b, 1); return true; }
    return false;
  }
  if (b.type === 'carrier') {
    if (Math.abs(shot.x - b.x) < 72 && shot.y > b.y - 36 && shot.y < b.y + 26) { hurtBoss(b, 1); return true; }
    return false;
  }
  if (b.type === 'serpent') {
    if (Math.hypot(shot.x - b.x, shot.y - b.y) < b.r) { hurtBoss(b, 1); return true; }
    for (const s of b.segs) {
      if (s.hp > 0 && Math.hypot(shot.x - s.x, shot.y - s.y) < 13) {
        s.hp--; s.flash = 5;
        explode(s.x, s.y, '#67e8f9', s.hp > 0 ? 4 : 14, true);
        if (s.hp <= 0) { addScore(150, s.x, s.y); sfx.boom(); }
        return true;
      }
    }
    return false;
  }
  // heart: the shell deflects unless the shot comes through a gap
  const d = Math.hypot(shot.x - b.x, shot.y - b.y);
  if (d < HEART_SHELL + 9 && d > HEART_SHELL - 8) {
    const step = Math.PI * 2 / HEART_PLATES;
    let rel = (Math.atan2(shot.y - b.y, shot.x - b.x) - b.rot) % (Math.PI * 2);
    if (rel < 0) rel += Math.PI * 2;
    if (!b.gaps.includes(Math.floor(rel / step))) {
      explode(shot.x, shot.y, '#fafafa', 4);
      sfx.ping();
      return true;
    }
  }
  if (d < b.r) { hurtBoss(b, 1); return true; }
  return false;
}

function bossTouchesShip(b) {
  if (b.entry) return false;
  const near = (x, y, r) => Math.hypot(ship.x - x, ship.y - y) < r + ship.r;
  if (b.type === 'warden') {
    return near(b.x, b.y, b.r) || b.plates.some(p => p.hp > 0 && near(b.x + Math.cos(b.rot + p.a) * b.plateR, b.y + Math.sin(b.rot + p.a) * b.plateR, 14));
  }
  if (b.type === 'carrier') return Math.abs(ship.x - b.x) < 72 + ship.r && ship.y > b.y - 36 && ship.y < b.y + 28;
  if (b.type === 'serpent') return near(b.x, b.y, b.r) || b.segs.some(s => s.hp > 0 && near(s.x, s.y, 10));
  // heart: the core, the shell ring, and any firing spoke
  if (near(b.x, b.y, HEART_SHELL + 6)) return true;
  return b.spokes.some(s => {
    if (s.state !== 'fire') return false;
    const dx = ship.x - b.x, dy = ship.y - b.y;
    const along = dx * Math.cos(s.a) + dy * Math.sin(s.a);
    const across = Math.abs(-dx * Math.sin(s.a) + dy * Math.cos(s.a));
    return along > 30 && across < HEART_BEAM_W + ship.r * 0.6;
  });
}

function bossNovaHit(b, x, y, radius) {
  if (b.entry || Math.hypot(b.x - x, b.y - y) > radius + b.r) return;
  hurtBoss(b, 3);
  if (b.type === 'warden') {                 // a nova knocks off the nearest plate
    const p = b.plates.find(q => q.hp > 0);
    if (p) p.hp = 0;
  }
  if (b.type === 'heart') b.spokes = [];     // and cancels a laser in progress
}
