// ============================================================
// REVENGER — Plumbmonkey's invasion force and the fans they hunt.
// Defender roles: lander → abductor, mutant → a mutated fan, baiter → the
// hurry-up hunter, bomber → mine layer, pod → splits into swarmers,
// carrier → always drops a power-up.
// ============================================================

const ENEMY = {
  lander:  { r: 13, pts: 150,  core: true,  size: 2, hp: 1 },
  mutant:  { r: 12, pts: 150,  core: true,  size: 2, hp: 1 },
  baiter:  { r: 14, pts: 200,  core: false, size: 2, hp: 1 },
  bomber:  { r: 14, pts: 250,  core: true,  size: 2, hp: 1 },
  pod:     { r: 15, pts: 1000, core: true,  size: 3, hp: 1 },
  swarmer: { r: 8,  pts: 150,  core: true,  size: 1, hp: 1 },
  carrier: { r: 17, pts: 300,  core: false, size: 3, hp: 3 }
};
const FALL_SAFE = 150;          // a fan dropped from higher than this needs catching
const MAX_MINES = 14;

function speedMult() { return info.mult * (rift ? 1.2 : 1); }

function spawnEnemy(type, x, y, extra) {
  const d = ENEMY[type];
  const e = Object.assign({
    id: ++nextId, type, x: wrapX(x), y, vx: 0, vy: 0, r: d.r, hp: d.hp, state: 'hunt', t: 0,
    fireT: 90 + rng() * 150, carry: null, target: null, flash: 0, dead: false,
    cruise: HUD_H + 50 + rng() * 150, dir: rng() < 0.5 ? -1 : 1, away: 0, phaseOff: rng() * 6.28
  }, extra || {});
  if (type === 'lander' && rift) e.type = 'mutant';
  enemies.push(e);
  return e;
}

// Wave members start spread round the world, never within ¾ screen of the ship.
function spawnWaveEnemies(def) {
  const place = () => wrapX(ship.x + W * 0.75 + rng() * (WORLD_W - W * 1.5));
  const alt = () => HUD_H + 40 + rng() * 220;
  for (let i = 0; i < (def.landers || 0); i++) spawnEnemy('lander', place(), alt());
  for (let i = 0; i < (def.bombers || 0); i++) spawnEnemy('bomber', place(), alt());
  for (let i = 0; i < (def.pods || 0); i++) spawnEnemy('pod', place(), alt());
  for (let i = 0; i < (def.carriers || 0); i++) spawnEnemy('carrier', place(), alt());
}

function coreEnemiesLeft() { return enemies.some(e => !e.dead && ENEMY[e.type].core); }

// ---------- fans ----------
function spawnFans(n) {
  fans = [];
  for (let i = 0; i < n; i++) {
    const x = i < 4 ? 120 + i * 60 + rng() * 20 : rng() * WORLD_W;
    fans.push({ id: ++nextId, x: wrapX(x), y: groundY(x), vx: (rng() - 0.5) * 0.4, vy: 0,
      state: 'ground', by: 0, fallFrom: 0, look: i % 6, beat: rng() * 6.28 });
  }
}

function releaseFan(f) {
  if (!f || f.state !== 'grabbed') return;
  f.state = 'falling'; f.vy = -0.5; f.fallFrom = f.y; f.by = 0;
}

function loseFan(f, why) {
  f.dead = true;
  fansLost++;
  FX.explode(f.x, f.y - 10, 1, ['#fca5a5', '#f0abfc', '#ffffff']);
  FX.popup(f.x, f.y - 30, why, '#fca5a5');
  sfx.fanLost();
}

function stepFans() {
  fans.forEach(f => {
    if (f.dead) return;
    if (f.state === 'ground') {
      if (rng() < 0.004) f.vx = (rng() - 0.5) * 0.5;
      f.x = wrapX(f.x + f.vx);
      f.y = groundY(f.x);
    } else if (f.state === 'grabbed') {
      if (f.by === -1) return;                 // held in the Harvester's beam
      const e = enemies.find(en => en.id === f.by && !en.dead);
      if (!e) releaseFan(f);
      else { f.x = e.x; f.y = e.y + 34; }
    } else if (f.state === 'falling') {
      f.vy = Math.min(5, f.vy + 0.18);
      f.y += f.vy;
      const gy = groundY(f.x);
      if (f.y >= gy) {
        if (gy - f.fallFrom > FALL_SAFE) loseFan(f, 'FAN LOST');
        else { f.state = 'ground'; f.y = gy; f.vy = 0; addScore(250, f.x, gy - 24, 'LANDED'); }
      }
    }
  });
  fans = fans.filter(f => !f.dead);
}

// ---------- enemy fire ----------
function fireAt(e, speed) {
  if (!onScreen(e.x, -10)) return;
  const dx = wrapDX(ship.x, e.x), dy = ship.y - e.y, d = Math.hypot(dx, dy) || 1;
  if (d < 90 || phase !== 'play') return;          // no point-blank shots
  const sp = Math.min(6, speed * speedMult());
  enemyShots.push({ x: e.x, y: e.y, vx: (dx / d) * sp, vy: (dy / d) * sp, r: 4, life: 200, kind: 'bolt' });
  sfx.enemyShot(soundPan(toScreen(e.x)));
}

function homeOn(e, accel, max, tx, ty) {
  const dx = wrapDX(tx, e.x), dy = ty - e.y, d = Math.hypot(dx, dy) || 1;
  e.vx += (dx / d) * accel; e.vy += (dy / d) * accel;
  const v = Math.hypot(e.vx, e.vy);
  if (v > max) { e.vx *= max / v; e.vy *= max / v; }
}

// Far-flung wanderers drift back toward the ship so a wave can always end.
function returnIfFar(e, sp) {
  const gap = wrapDX(ship.x, e.x);
  if (Math.abs(gap) > W * 1.1) { e.away++; if (e.away > 200) e.x = wrapX(e.x + Math.sign(gap) * sp); }
  else e.away = 0;
}

function stepEnemy(e) {
  const m = speedMult();
  e.t++;
  if (e.flash > 0) e.flash--;
  switch (e.type) {
    case 'lander': {
      if (e.state === 'lift') {
        e.y -= 0.85 * m;
        e.x = wrapX(e.x + Math.sin(e.t * 0.05) * 0.4);
        if (e.y < HUD_H + 14) {                     // the fan is taken: it becomes a mutant
          const f = fans.find(fn => fn.id === e.carry);
          if (f) loseFan(f, 'ABDUCTED');
          e.type = 'mutant'; e.carry = null; e.state = 'hunt'; e.r = ENEMY.mutant.r;
          sfx.abduct();
          break;
        }
      } else {
        let f = fans.find(fn => fn.id === e.target && fn.state === 'ground');
        if (!f) {
          e.target = null;
          let best = Infinity;
          fans.forEach(fn => {
            if (fn.state !== 'ground') return;
            const taken = enemies.some(o => o !== e && o.target === fn.id && !o.dead);
            const d = Math.abs(wrapDX(fn.x, e.x)) + (taken ? 900 : 0);
            if (d < best) { best = d; f = fn; }
          });
          if (f) e.target = f.id;
        }
        if (f) {
          const dx = wrapDX(f.x, e.x);
          if (Math.abs(dx) > 6) e.x = wrapX(e.x + Math.sign(dx) * Math.min(Math.abs(dx), 1.5 * m));
          const hoverY = f.y - 32;
          if (Math.abs(dx) < 120) e.y += Math.max(-1.4 * m, Math.min(1.1 * m, hoverY - e.y));
          else e.y += Math.max(-1, Math.min(1, e.cruise - e.y));
          if (Math.abs(dx) < 8 && Math.abs(e.y - hoverY) < 5) {
            f.state = 'grabbed'; f.by = e.id;
            e.carry = f.id; e.target = null; e.state = 'lift';
          }
        } else {
          e.x = wrapX(e.x + e.dir * 1.3 * m);
          e.y += Math.sin(e.t * 0.03 + e.phaseOff) * 0.6;
          returnIfFar(e, 2.5);
        }
      }
      e.fireT -= 1;
      if (e.fireT <= 0) { fireAt(e, 3.6); e.fireT = (130 + rng() * 110) / info.mult; }
      break;
    }
    case 'mutant': {
      const jitter = Math.sin(e.t * 0.3 + e.phaseOff) * 14;
      homeOn(e, 0.22, 3.3 * m, ship.x, ship.y + jitter);
      e.x = wrapX(e.x + e.vx); e.y += e.vy + (rng() - 0.5) * 1.6;
      e.fireT -= 1;
      if (e.fireT <= 0) { fireAt(e, 4); e.fireT = (100 + rng() * 80) / info.mult; }
      break;
    }
    case 'baiter': {
      const side = wrapDX(e.x, ship.x) > 0 ? 1 : -1;
      homeOn(e, 0.35, 8.6 * Math.min(1.1, m), ship.x + side * 220, ship.y - 60);
      e.x = wrapX(e.x + e.vx); e.y += e.vy;
      e.fireT -= 1;
      if (e.fireT <= 0) { fireAt(e, 4.6); e.fireT = 70 + rng() * 40; }
      break;
    }
    case 'bomber': {
      e.x = wrapX(e.x + e.dir * 1.2 * m);
      e.y = e.cruise + Math.sin(e.t * 0.02 + e.phaseOff) * 50;
      returnIfFar(e, 2.5);
      e.fireT -= 1;
      if (e.fireT <= 0 && Math.abs(wrapDX(ship.x, e.x)) < W * 1.4 && mines.length < MAX_MINES) {
        mines.push({ id: ++nextId, x: e.x, y: e.y + 10, life: 520, arm: 30, r: 7 });
        sfx.mine(soundPan(toScreen(e.x)));
        e.fireT = (80 + rng() * 60) / info.mult;
      }
      break;
    }
    case 'pod': {
      e.x = wrapX(e.x + e.dir * 0.9 * m);
      e.y += (e.vy || (e.vy = 0.7)) * m;
      if (e.y < HUD_H + 30 || e.y > 360) e.vy = -e.vy;
      returnIfFar(e, 2);
      break;
    }
    case 'swarmer': {
      homeOn(e, 0.16, 4.4 * m, ship.x, ship.y);
      e.x = wrapX(e.x + e.vx); e.y += e.vy;
      e.fireT -= 1;
      if (e.fireT <= 0) { if (Math.sign(e.vx) === Math.sign(wrapDX(ship.x, e.x))) fireAt(e, 3.8); e.fireT = (160 + rng() * 120) / info.mult; }
      break;
    }
    case 'carrier': {
      const gap = wrapDX(e.x, ship.x);
      if (Math.abs(gap) < W * 0.8) e.x = wrapX(e.x + Math.sign(gap || 1) * 2.1 * m);
      else { e.x = wrapX(e.x + e.dir * 0.8); returnIfFar(e, 1.6); }
      e.y = e.cruise + Math.sin(e.t * 0.025) * 30;
      break;
    }
  }
  e.y = Math.max(HUD_H + 12, Math.min(groundY(e.x) - 18, e.y));
}

function stepEnemies() {
  enemies.forEach(e => { if (!e.dead) stepEnemy(e); });
  enemyShots.forEach(s => { s.x = wrapX(s.x + s.vx); s.y += s.vy; s.life--; });
  enemyShots = enemyShots.filter(s => s.life > 0 && s.y > HUD_H - 10 && s.y < H + 10);
  mines.forEach(mn => { mn.life--; if (mn.arm > 0) mn.arm--; });
  mines = mines.filter(mn => mn.life > 0 && !mn.dead);
}

function hitEnemy(e, dmg, x, y) {
  if (e.dead) return;
  e.hp -= dmg;
  e.flash = 6;
  if (e.hp <= 0) killEnemy(e);
  else { FX.spark(x, y, '#fde68a'); sfx.shield(); }
}

function killEnemy(e, quiet) {
  if (e.dead) return;
  e.dead = true;
  const d = ENEMY[e.type];
  if (e.carry) { const f = fans.find(fn => fn.id === e.carry); releaseFan(f); e.carry = null; }
  if (quiet) return;
  const pal = { lander: ['#94a3b8', '#67e8f9', '#f472b6', '#ffffff'], mutant: ['#86efac', '#c084fc', '#f0abfc', '#ffffff'],
    baiter: ['#fbbf24', '#f97316', '#ffffff'], bomber: ['#a855f7', '#e879f9', '#ffffff'], pod: ['#fb7185', '#fdba74', '#ffffff', '#c084fc'],
    swarmer: ['#e0e7ff', '#a5b4fc'], carrier: ['#5eead4', '#fde68a', '#ffffff'] }[e.type];
  FX.explode(e.x, e.y, d.size, pal);
  sfx.explode(d.size, soundPan(toScreen(e.x)));
  hitPause = Math.max(hitPause, d.size >= 3 ? 3 : d.size - 1);
  combo++; comboT = 150;
  addScore(d.pts * comboMult(), e.x, e.y - 16);
  if (combo > 0 && combo % 8 === 0) dropPickup(e.x, e.y);
  if (e.type === 'pod') for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    spawnEnemy('swarmer', e.x + Math.cos(a) * 12, e.y + Math.sin(a) * 12, { vx: Math.cos(a) * 3, vy: Math.sin(a) * 3, fireT: 120 + i * 20 });
  }
  if (e.type === 'carrier') dropPickup(e.x, e.y);
}

// ---------- art: every enemy is pre-rendered, 4 frames each ----------
const INK_E = '#120b1e';
const enemyCache = {};
function withSprite(key, size, paint) {
  if (enemyCache[key]) return enemyCache[key];
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const c = cv.getContext('2d');
  c.translate(size / 2, size / 2);
  c.lineJoin = 'round'; c.lineCap = 'round';
  paint(c);
  return (enemyCache[key] = cv);
}
function shape(c, pts, fill, lw = 2) {
  c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath();
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (lw) { c.strokeStyle = INK_E; c.lineWidth = lw; c.stroke(); }
}
function oval(c, x, y, rx, ry, fill, lw = 2) {
  c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (lw) { c.strokeStyle = INK_E; c.lineWidth = lw; c.stroke(); }
}
function litEyes(c, pts, color, r = 1.6) {
  c.save(); c.shadowColor = color; c.shadowBlur = 6; c.fillStyle = color;
  pts.forEach(([x, y]) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); });
  c.restore();
}
function greyPilot(c, x, y, s) {
  oval(c, x, y, 3.2 * s, 3.8 * s, '#b8ce9d', 1.2);
  c.fillStyle = '#0a0a12';
  c.beginPath(); c.ellipse(x - 1.3 * s, y - 0.2 * s, 1 * s, 1.6 * s, 0.5, 0, Math.PI * 2);
  c.ellipse(x + 1.3 * s, y - 0.2 * s, 1 * s, 1.6 * s, -0.5, 0, Math.PI * 2); c.fill();
}

const ENEMY_ART = {
  lander: k => withSprite('lander' + k, 56, c => {
    // abductor saucer: grey hull, glass dome with a grey pilot, blinking skirt lights
    shape(c, [[-18, 2], [-10, -3], [10, -3], [18, 2], [12, 7], [-12, 7]], '#94a3b8');
    shape(c, [[-18, 2], [18, 2], [12, 7], [-12, 7]], '#64748b', 0);
    c.save(); c.beginPath(); c.ellipse(0, -3, 9, 8, 0, Math.PI, 0); c.closePath();
    c.fillStyle = 'rgba(103,232,249,0.45)'; c.fill(); c.clip(); greyPilot(c, 0, -5, 1.2); c.restore();
    c.beginPath(); c.ellipse(0, -3, 9, 8, 0, Math.PI, 0); c.strokeStyle = INK_E; c.lineWidth = 1.8; c.stroke();
    [-12, -4, 4, 12].forEach((x, i) => litEyes(c, [[x, 4.5]], (i + k) % 2 ? '#f472b6' : '#4ade80', 1.3));
    shape(c, [[-6, 7], [6, 7], [4, 11], [-4, 11]], '#475569', 1.4);
  }),
  mutant: k => withSprite('mutant' + k, 56, c => {
    // a fan warped by the Rift: shirt and hair still there, head bulged, tendrils for legs
    const w = Math.sin(k * 1.57) * 3;
    for (let i = -1; i <= 1; i++) { c.strokeStyle = INK_E; c.lineWidth = 4.5; c.beginPath(); c.moveTo(i * 4, 6); c.quadraticCurveTo(i * 8 + w, 12, i * 5 - w, 18); c.stroke();
      c.strokeStyle = '#4ade80'; c.lineWidth = 2.5; c.stroke(); }
    shape(c, [[-7, -3], [7, -3], [6, 8], [-6, 8]], '#f0abfc');
    shape(c, [[-12, -4], [-7, -2], [-8, 4]], '#86efac', 1.5); shape(c, [[12, -4], [7, -2], [8, 4]], '#86efac', 1.5);
    oval(c, 0, -11, 9, 8, '#86efac');
    oval(c, -2, -9, 4, 5, '#5fbf86', 0);
    shape(c, [[-9, -13], [-4, -19], [4, -19], [9, -13], [3, -16], [-3, -15]], '#3b2a1e', 1.4);
    litEyes(c, [[-3.5, -10], [3.5, -10]], '#f43f5e', 2);
    litEyes(c, [[0, -14]], '#fde047', 1.2);
  }),
  baiter: k => withSprite('baiter' + k, 64, c => {
    // the hurry-up hunter: a flat amber blade saucer with a single glaring slit
    shape(c, [[-26, 0], [-12, -6], [12, -6], [26, 0], [12, 6], [-12, 6]], '#fbbf24');
    shape(c, [[-26, 0], [26, 0], [12, 6], [-12, 6]], '#b45309', 0);
    shape(c, [[-10, -2], [10, -2], [10, 2], [-10, 2]], '#1c1917', 1.2);
    c.save(); c.shadowColor = '#ef4444'; c.shadowBlur = 8; c.fillStyle = '#f87171';
    c.fillRect(-8 + k * 4, -1, 5, 2); c.restore();
  }),
  bomber: k => withSprite('bomber' + k, 56, c => {
    // void pyramid mine layer with a pulsing eye
    shape(c, [[0, -17], [16, 11], [-16, 11]], '#2e1065');
    shape(c, [[0, -17], [16, 11], [3, 11]], '#1e0b45', 0);
    c.beginPath(); c.moveTo(0, -17); c.lineTo(3, 11); c.strokeStyle = '#e879f9'; c.lineWidth = 1; c.stroke();
    oval(c, 0, 2, 5 + k * 0.4, 3, '#0a0612', 1.2);
    litEyes(c, [[0, 2]], '#e879f9', 2 + k * 0.3);
  }),
  pod: k => withSprite('pod' + k, 64, c => {
    // a pulsing egg sac with the swarm visible inside
    oval(c, 0, 0, 16 + k * 0.5, 15 - k * 0.3, '#9f1239');
    oval(c, -4, -4, 8, 7, '#be123c', 0);
    for (let i = 0; i < 5; i++) {
      const a = i * 1.26 + k * 0.3;
      litEyes(c, [[Math.cos(a) * 8, Math.sin(a) * 7]], '#fde68a', 1.6);
    }
    c.strokeStyle = INK_E; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(-10, 8); c.quadraticCurveTo(0, 2, 10, 8); c.stroke();
  }),
  swarmer: k => withSprite('swarmer' + k, 32, c => {
    // wisp ghost
    const s = Math.sin(k * 1.57) * 1.5;
    shape(c, [[-6, -2], [-6, 6], [-3 + s, 3], [0, 7], [3 + s, 3], [6, 6], [6, -2], [0, -9]], '#e0e7ff', 1.5);
    litEyes(c, [[-2, -2], [2.5, -2]], '#6366f1', 1.4);
  }),
  carrier: k => withSprite('carrier' + k, 72, c => {
    // a teal cargo cylinder with a glowing gift in the bay
    shape(c, [[-24, -9], [20, -9], [26, 0], [20, 9], [-24, 9], [-28, 0]], '#0f766e');
    shape(c, [[-24, 2], [24, 2], [20, 9], [-24, 9]], '#115e59', 0);
    for (let i = 0; i < 4; i++) litEyes(c, [[-18 + i * 9, -5]], (i + k) % 2 ? '#99f6e4' : '#134e4a', 1.4);
    oval(c, 4, 3, 7, 5, '#0a0612', 1.4);
    litEyes(c, [[4, 3]], '#fde68a', 3 + (k % 2));
  })
};

function drawEnemies(c) {
  enemies.forEach(e => {
    if (e.dead) return;
    const sx = toScreen(e.x);
    if (sx < -60 || sx > W + 60) return;
    if (e.type === 'lander' && e.carry) {
      const g = c.createLinearGradient(0, e.y + 8, 0, e.y + 36);
      g.addColorStop(0, 'rgba(232,121,249,0.55)'); g.addColorStop(1, 'rgba(232,121,249,0)');
      c.fillStyle = g;
      c.beginPath(); c.moveTo(sx - 5, e.y + 8); c.lineTo(sx + 5, e.y + 8); c.lineTo(sx + 13, e.y + 38); c.lineTo(sx - 13, e.y + 38); c.closePath(); c.fill();
    }
    const spr = ENEMY_ART[e.type](Math.floor((tick + e.id * 5) / 8) % 4);
    const face = e.vx < -0.2 || (e.type === 'lander' && e.dir < 0) ? -1 : 1;
    c.save();
    c.translate(sx, e.y);
    if (e.type === 'baiter' || e.type === 'carrier') c.scale(face, 1);
    c.drawImage(spr, -spr.width / 2, -spr.height / 2);
    c.restore();
    if (e.flash > 0) drawGlow(c, '#ffffff', sx, e.y, e.r + 8, e.flash / 6);
  });
}

function drawEnemyFire(c) {
  mines.forEach(mn => {
    const sx = toScreen(mn.x); if (sx < -20 || sx > W + 20) return;
    const blink = mn.arm > 0 ? 0.35 : 0.6 + Math.sin(tick * 0.3 + mn.id) * 0.4;
    drawGlow(c, '#e879f9', sx, mn.y, 14, blink * 0.7);
    c.save(); c.translate(sx, mn.y); c.rotate(tick * 0.05);
    shape(c, [[0, -7], [3, -3], [7, 0], [3, 3], [0, 7], [-3, 3], [-7, 0], [-3, -3]], '#4c1d95', 1.4);
    c.restore();
    litEyes(c, [[sx, mn.y]], '#f0abfc', 1.8);
  });
  c.save();
  c.globalCompositeOperation = 'lighter';
  enemyShots.forEach(s => {
    const sx = toScreen(s.x); if (sx < -20 || sx > W + 20) return;
    const tx = sx - s.vx * 3, ty = s.y - s.vy * 3;
    const g = c.createLinearGradient(tx, ty, sx, s.y);
    g.addColorStop(0, 'rgba(249,115,22,0)'); g.addColorStop(1, 'rgba(251,146,60,0.9)');
    c.strokeStyle = g; c.lineWidth = 5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(tx, ty); c.lineTo(sx, s.y); c.stroke();
    drawGlow(c, '#f97316', sx, s.y, 11, 0.9);
    drawGlow(c, '#fff7ed', sx, s.y, 4, 1);
  });
  c.restore();
}

const FAN_LOOKS = [['#f0abfc', '#3b2a1e'], ['#c4b5fd', '#14100c'], ['#67e8f9', '#6d3f1f'], ['#fda4af', '#e5c07b'], ['#86efac', '#2a211c'], ['#fde68a', '#7c2d12']];
function drawFans(c) {
  fans.forEach(f => {
    const sx = toScreen(f.x); if (sx < -20 || sx > W + 20) return;
    const [shirt, hair] = FAN_LOOKS[f.look];
    const scared = f.state !== 'ground';
    const beat = Math.sin(tick * 0.14 + f.beat);
    const top = f.y - 18 - (scared ? 0 : Math.max(0, beat) * 2.5);
    const limb = (pts, color, w) => {
      c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.strokeStyle = INK_E; c.lineWidth = w + 2; c.stroke(); c.strokeStyle = color; c.lineWidth = w; c.stroke();
    };
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
    const kick = scared ? Math.sin(tick * 0.4 + f.beat) * 3 : 0;
    limb([[sx, top + 11], [sx - 3 + kick, f.y]], '#1e293b', 2);
    limb([[sx, top + 11], [sx + 3 - kick, f.y]], '#1e293b', 2);
    const up = scared || beat > 0.3;
    limb([[sx - 3, top + 4], [sx - 7, up ? top - 3 : top + 10]], '#e8c39e', 1.6);
    limb([[sx + 3, top + 4], [sx + 7, up ? top - 3 : top + 10]], '#e8c39e', 1.6);
    shape(c, [[sx - 4, top + 2], [sx + 4, top + 2], [sx + 3.5, top + 12], [sx - 3.5, top + 12]], shirt, 1.4);
    oval(c, sx, top - 2, 3.8, 4, '#e8c39e', 1.4);
    c.beginPath(); c.arc(sx, top - 3.2, 3.9, Math.PI * 0.95, Math.PI * 2.05); c.fillStyle = hair; c.fill();
    if (f.state === 'falling') { c.fillStyle = '#fef08a'; c.font = 'bold 11px sans-serif'; c.textAlign = 'center'; c.fillText('!', sx, top - 10); }
    c.restore();
  });
}
