// ============================================================
// SPECTRAL MANOR CRYSTAL DIMENSION
// Zero-G · Crystal sectors · Space Ghosts
// Ghost Circuit / Plumbmonkey Media
//
// Files: sectors.js (level data) · sprites.js (scenery/hero/crystals)
//        enemies.js (enemy + boss art, overlays) · bosses.js (boss rules)
//        game.js (this: rules, flow, audio, loop)
// Rules run at a FIXED 60 Hz (see loop()), so a 120/144 Hz monitor no longer
// plays the game at double speed.
// ============================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

const NOVA_MAX = 3, NOVA_COST = 8;          // crystals per nova charge
const POWER_TIME = 720;                     // 12 s
const MINE_FUSE = 45, MINE_TRIGGER = 95;
const COMBO_WINDOW = 80, COMBO_MAX = 4;
const EXTRA_LIFE_EVERY = 25000;
const STEP = 1000 / 60;

// ---------- Audio ----------
let audioCtx = null;
function initAudio() {
  if (!audioCtx) audioCtx = ArcadeAudio.context();
  ArcadeAudio.resume();
}
function tone(f, d, t = 'square', v = 0.05, s = 0, bus = 'sfx') {
  if (!audioCtx) return;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = t; o.frequency.setValueAtTime(f, audioCtx.currentTime);
  if (s) o.frequency.linearRampToValueAtTime(Math.max(20, f + s), audioCtx.currentTime + d);
  g.gain.setValueAtTime(v, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + d);
  o.connect(g); g.connect(ArcadeAudio.output(bus));
  o.start(); o.stop(audioCtx.currentTime + d);
}
function noiseBlast(dur, vol, cutoff) {
  if (!audioCtx) return;
  const len = Math.floor(audioCtx.sampleRate * dur);
  const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const n = audioCtx.createBufferSource();
  n.buffer = buf;
  const lp = audioCtx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(cutoff, audioCtx.currentTime);
  lp.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + dur);
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(vol, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
  n.connect(lp); lp.connect(g); g.connect(ArcadeAudio.output('sfx'));
  n.start();
}
const later = (fn, ms) => setTimeout(fn, ms);
const sfx = {
  shoot: () => { tone(900, 0.05, 'square', 0.035, -400); tone(1800, 0.03, 'sine', 0.015, -900); },
  boom: () => { noiseBlast(0.3, 0.11, 2400); tone(90, 0.22, 'sine', 0.09, -50); tone(1400, 0.12, 'triangle', 0.035, -600); },
  clink: () => { tone(2200, 0.05, 'triangle', 0.04, -300); noiseBlast(0.06, 0.04, 5000); },
  bigBoom: () => { noiseBlast(0.45, 0.13, 1600); tone(70, 0.35, 'sine', 0.1, -40); tone(200, 0.2, 'sawtooth', 0.05, -140); },
  hurt: () => { noiseBlast(0.4, 0.1, 900); tone(100, 0.3, 'sawtooth', 0.07, -60); },
  shipDeath: () => {
    noiseBlast(0.7, 0.16, 2000); noiseBlast(0.5, 0.12, 600);
    tone(60, 0.6, 'sine', 0.13, -30); tone(180, 0.4, 'sawtooth', 0.07, -140);
    later(() => { noiseBlast(0.4, 0.09, 400); tone(45, 0.5, 'sine', 0.1, -20); }, 120);
  },
  crystal: () => { tone(700, 0.06, 'square', 0.04); later(() => tone(1000, 0.08, 'square', 0.04), 50); },
  novaReady: () => [880, 1109, 1319].forEach((f, i) => later(() => tone(f, 0.1, 'triangle', 0.05), i * 60)),
  nova: () => { noiseBlast(0.8, 0.14, 3000); tone(120, 0.7, 'sine', 0.12, -90); tone(1600, 0.5, 'sine', 0.04, -1400); },
  power: () => [523, 784, 1047].forEach((f, i) => later(() => tone(f, 0.09, 'square', 0.04), i * 55)),
  extraLife: () => [659, 784, 988, 1319].forEach((f, i) => later(() => tone(f, 0.12, 'triangle', 0.06), i * 90)),
  wave: () => { tone(440, 0.07); later(() => tone(554, 0.07), 70); later(() => tone(659, 0.1), 140); },
  warning: () => [0, 1, 2].forEach(i => later(() => tone(220, 0.25, 'sawtooth', 0.05, -40), i * 330)),
  mineArm: () => tone(1200, 0.05, 'square', 0.03),
  bossShot: () => { tone(300, 0.15, 'sawtooth', 0.05, -200); noiseBlast(0.12, 0.05, 1200); },
  bossHit: () => tone(160 + Math.random() * 40, 0.06, 'square', 0.04, -60),
  launch: () => tone(200, 0.3, 'triangle', 0.05, 500),
  charge: () => tone(180, 0.9, 'sawtooth', 0.04, 600),
  scream: () => { noiseBlast(0.6, 0.12, 4000); tone(1400, 0.5, 'sawtooth', 0.04, -1000); },
  laser: () => { tone(90, 0.45, 'sawtooth', 0.08, 30); noiseBlast(0.4, 0.07, 2500); },
  ping: () => tone(2600, 0.04, 'sine', 0.03, 400),
  bossDown: () => {
    [0, 180, 360, 600].forEach((ms, i) => later(() => { noiseBlast(0.6, 0.15, 2400 - i * 400); tone(70 - i * 8, 0.6, 'sine', 0.12, -30); }, ms));
    later(() => [523, 659, 784, 1047].forEach((f, i) => later(() => tone(f, 0.16, 'triangle', 0.05), i * 110)), 900);
  }
};

// ---------- Music: D-minor arpeggio over a drone, transposed per sector ----------
let musicTimer = null, musicStep = 0;
const arp = [293.66, 349.23, 440, 587.33, 440, 349.23, 311.13, 392, 466.16, 622.25, 466.16, 392];
const drone = [73.42, 0, 0, 0, 0, 0, 77.78, 0, 0, 0, 0, 0];
const SECTOR_KEY = [1, 1.122, 0.891, 1.335];
function musicTick() {
  if (!gameRunning || paused || deathFreeze > 0 || !audioCtx) return;
  const k = SECTOR_KEY[sectorIdx];
  // the boss fight doubles the pulse: every step plays, and the drone hits harder
  if (!boss && musicStep % 2) { musicStep++; return; }
  const n = arp[(musicStep >> (boss ? 0 : 1)) % arp.length] * k;
  tone(n, 0.3, 'triangle', 0.028, 0, 'music');
  tone(n * 2, 0.16, 'sine', 0.012, 0, 'music');
  const d = drone[(musicStep >> (boss ? 0 : 1)) % drone.length];
  if (d) tone(d * k, 1.1, 'sawtooth', boss ? 0.05 : 0.035, 4, 'music');
  musicStep++;
}
function startMusic() { if (!musicTimer) musicTimer = setInterval(musicTick, 120); }

// ---------- State ----------
let score = 0, lives = 3, gameRunning = false, gameOver = false, paused = false;
let keys = {};
let tick = 0;
let sectorIdx = 0, waveIdx = 0, cycle = 0, cycleMult = 1;
let phase = 'intro', phaseT = 0;
let ship, shots = [], eshots = [], rocks = [], saucers = [], wraiths = [], mines = [], seekers = [];
let crystals = [], powerups = [], particles = [], shockwaves = [], popups = [];
let clouds = [], well = null, boss = null;
let novas = 1, novaCharge = 0, novaHeld = false;
let power = null, powerTime = 0;
let combo = 0, comboT = 0, nextLife = EXTRA_LIFE_EVERY;
let deathFreeze = 0, shakeAmt = 0, respawnT = 0, respawnWait = 0;

const rnd = (a, b) => a + Math.random() * (b - a);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const sector = () => SECTORS[sectorIdx];
const isBossWave = () => waveIdx === WAVES_PER_SECTOR - 1;

function spawnPoint() {
  // the well core and the Prism Heart both sit dead centre
  return (well || (boss && boss.type === 'heart')) ? { x: W / 2, y: H - 80 } : { x: W / 2, y: H / 2 };
}

function resetShip() {
  const p = spawnPoint();
  ship = {
    x: p.x, y: p.y, angle: -Math.PI / 2, vx: 0, vy: 0, r: 12,
    invuln: 120, thrust: false, bank: 0, cool: 0, shield: power === 'shield', dead: false
  };
}

// ---------- Spawning ----------
function makeRock(x, y, size, variant) {
  const points = [];
  const baseRad = size * 13;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const rad = baseRad * (0.86 + Math.random() * 0.26);
    points.push({ x: Math.cos(a) * rad, y: Math.sin(a) * rad });
  }
  const sp = (1.2 + (4 - size) * 0.6) * cycleMult;
  const hp = variant === 'armored' ? 3 : 1;
  return {
    x, y, size, variant: variant || 'normal', hp, maxHp: hp, flash: 0,
    vx: (Math.random() - 0.5) * sp, vy: (Math.random() - 0.5) * sp,
    angle: Math.random() * Math.PI * 2, spin: (Math.random() - 0.5) * 0.04,
    points, r: size * 14, hue: Math.random() < 0.5 ? 0 : 1, shimmer: Math.random() * Math.PI * 2
  };
}

function openSpot(minFromShip) {
  let x, y, tries = 0;
  do {
    x = rnd(30, W - 30); y = rnd(30, H - 30);
    tries++;
  } while (tries < 60 && (Math.hypot(x - ship.x, y - ship.y) < minFromShip || (well && Math.hypot(x - well.x, y - well.y) < 150)));
  return { x, y };
}

function edgeSpot() {
  const side = Math.floor(Math.random() * 4);
  return side === 0 ? { x: rnd(0, W), y: -20 } : side === 1 ? { x: W + 20, y: rnd(0, H) }
    : side === 2 ? { x: rnd(0, W), y: H + 20 } : { x: -20, y: rnd(0, H) };
}

function spawnSaucerAt(x, y) {
  saucers.push({ x, y, vx: 0, vy: 0, angle: 0, r: 15, shootTimer: rnd(90, 150), burst: 0, burstT: 0, trail: [], seed: rnd(0, 6) });
}
function spawnSeekerAt(x, y, angle) {
  seekers.push({ x, y, angle, vx: Math.cos(angle) * 2, vy: Math.sin(angle) * 2, r: 7, life: 600, trail: [] });
}

function enterSector() {
  const hz = sector().hazard;
  clouds = hz === 'clouds'
    ? Array.from({ length: 3 }, (_, i) => ({ x: W * (0.2 + i * 0.3), y: rnd(120, H - 120), r: rnd(80, 105), vx: rnd(-0.35, 0.35), vy: rnd(-0.25, 0.25), seed: i * 2.3 }))
    : [];
  well = hz === 'well' ? { x: W / 2, y: H / 2, core: 22, pull: 0.085 } : null;
}

function spawnWave() {
  const s = sector();
  const def = isBossWave() ? s.boss : s.waves[waveIdx];
  const c = cycle;
  for (let i = 0; i < (def.rocks || 0) + (isBossWave() ? 0 : c); i++) {
    const p = openSpot(170), roll = Math.random();
    const variant = roll < (def.armored || 0) ? 'armored' : roll < (def.armored || 0) + (def.volatile || 0) ? 'volatile' : 'normal';
    rocks.push(makeRock(p.x, p.y, variant === 'volatile' ? 2 : 3, variant));
  }
  const add = isBossWave() ? 0 : Math.min(c, 2);
  for (let i = 0; i < (def.saucers || 0) + add; i++) { const p = edgeSpot(); spawnSaucerAt(p.x, p.y); }
  for (let i = 0; i < (def.wraiths || 0); i++) {
    const p = openSpot(260);
    wraiths.push({ x: p.x, y: p.y, vx: 0, vy: 0, r: 16, vis: 0, state: 'fadeIn', t: 30 + i * 40, face: 0 });
  }
  for (let i = 0; i < (def.mines || 0) + add; i++) {
    const p = openSpot(220);
    mines.push({ x: p.x, y: p.y, vx: rnd(-0.4, 0.4), vy: rnd(-0.4, 0.4), r: 12, rot: 0, fuse: 0 });
  }
  for (let i = 0; i < (def.seekers || 0); i++) { const p = edgeSpot(); spawnSeekerAt(p.x, p.y, Math.atan2(ship.y - p.y, ship.x - p.x)); }
  if (def.type) { boss = createBoss(def, c); resetRespawnPoint(); }
}

function resetRespawnPoint() {
  // the Heart spawns on top of the default spawn point: move a waiting/fresh ship
  if (boss && boss.type === 'heart' && dist(ship, boss) < 140) {
    const p = spawnPoint(); ship.x = p.x; ship.y = p.y; ship.vx = ship.vy = 0;
  }
}

// ---------- Flow ----------
function startGame() {
  score = 0; lives = 3; tick = 0;
  sectorIdx = 0; waveIdx = 0; cycle = 0; cycleMult = 1;
  shots = []; eshots = []; rocks = []; saucers = []; wraiths = []; mines = []; seekers = [];
  crystals = []; powerups = []; particles = []; shockwaves = []; popups = [];
  boss = null; novas = 1; novaCharge = 0; power = null; powerTime = 0;
  combo = 0; comboT = 0; nextLife = EXTRA_LIFE_EVERY;
  deathFreeze = 0; shakeAmt = 0; respawnT = 0; paused = false; ending = 0;
  enterSector();
  resetShip();
  phase = 'intro'; phaseT = 150;
  gameRunning = true; gameOver = false;
  document.getElementById('startOverlay').classList.add('hidden');
  startMusic();
  updateHUD();
}

function advance() {
  waveIdx++;
  if (waveIdx >= WAVES_PER_SECTOR) {
    waveIdx = 0;
    sectorIdx++;
    if (sectorIdx >= SECTORS.length) { sectorIdx = 0; cycle++; cycleMult = 1 + cycle * 0.15; }
    enterSector();
  }
  phase = 'intro';
  phaseT = waveIdx === 0 ? 150 : isBossWave() ? 150 : 90;
  if (isBossWave()) sfx.warning(); else sfx.wave();
  updateHUD();
}

function checkClear() {
  if (phase !== 'play' || ending) return;
  if (rocks.length || saucers.length || wraiths.length || mines.length || seekers.length || boss) return;
  phase = 'clear';
  phaseT = 110;
  eshots = [];
  const bonus = 250 * (sectorIdx * 4 + waveIdx + 1) * (1 + cycle);
  addScore(bonus);
  clearBonus = bonus;
}
let clearBonus = 0;

window.addEventListener('keydown', e => {
  initAudio();
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.code === 'Enter' && !e.repeat && !gameRunning) startGame();
  if ((e.code === 'KeyP' || e.code === 'Escape') && !e.repeat && gameRunning) paused = !paused;
});
window.addEventListener('keyup', e => keys[e.code] = false);
window.addEventListener('blur', () => { if (gameRunning && !(typeof Arcade !== 'undefined' && Arcade.attract)) paused = true; });
document.getElementById('startOverlay').addEventListener('click', () => {
  initAudio();
  if (!gameRunning) startGame();
});
canvas.addEventListener('click', () => { if (paused) paused = false; });

// ---------- Helpers used by bosses.js ----------
function fireEnemy(x, y, a, speed, color, life) {
  eshots.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: life || 80, color: color || '#f87171' });
}
function explode(x, y, color, n, shard) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = rnd(1, 4.5);
    particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rnd(20, 38), color, size: rnd(2, 4.5), shard: !!shard, rot: a, spin: rnd(-0.3, 0.3) });
  }
}
function shockwave(x, y, max, color) { shockwaves.push({ x, y, r: 6, max, life: 40, maxLife: 40, color }); }
function shake(n) { shakeAmt = Math.max(shakeAmt, n); }
function addScore(pts, x, y) {
  score += pts;
  if (x !== undefined) popups.push({ x, y, text: String(pts), life: 50 });
  while (score >= nextLife) {
    nextLife += EXTRA_LIFE_EVERY;
    lives++;
    sfx.extraLife();
    popups.push({ x: W / 2, y: H - 70, text: 'EXTRA SHIP', life: 90, big: true });
  }
  updateHUD();
}
function kill(pts, x, y) {
  combo = comboT > 0 ? Math.min(COMBO_MAX, combo + 1) : 1;
  comboT = COMBO_WINDOW;
  addScore(pts * combo, x, y);
}

// ---------- Player actions ----------
function fire() {
  const spreads = power === 'spread' ? [-0.2, 0, 0.2] : [0];
  spreads.forEach(o => {
    const a = ship.angle + o;
    shots.push({ x: ship.x + Math.cos(a) * 16, y: ship.y + Math.sin(a) * 16, vx: Math.cos(a) * 9 + ship.vx * 0.3, vy: Math.sin(a) * 9 + ship.vy * 0.3, life: 50, color: power ? POWER_COLORS[power] : null });
  });
  ship.cool = power === 'rapid' ? 6 : 11;
  sfx.shoot();
}

function nova() {
  if (novas <= 0 || ship.dead) return;
  novas--;
  const R = 260;
  shockwave(ship.x, ship.y, R, '#e879f9');
  shockwave(ship.x, ship.y, R * 0.6, '#ffffff');
  eshots = [];
  const inR = o => dist(o, ship) < R + (o.r || 0);
  rocks.slice().forEach(r => { if (!r.dead && inR(r)) { r.hp = 1; destroyRock(r); } });
  saucers.forEach(s => { if (inR(s)) { s.dead = true; kill(300, s.x, s.y); explode(s.x, s.y, '#67e8f9', 16); } });
  wraiths.forEach(w => { if (inR(w)) { w.dead = true; kill(400, w.x, w.y); explode(w.x, w.y, '#c084fc', 16); } });
  mines.forEach(m => { if (inR(m)) { m.dead = true; kill(150, m.x, m.y); explode(m.x, m.y, '#94a3b8', 10, true); } });
  seekers.forEach(s => { if (inR(s)) { s.dead = true; kill(150, s.x, s.y); } });
  if (boss) bossNovaHit(boss, ship.x, ship.y, R);
  ship.invuln = Math.max(ship.invuln, 40);
  shake(10);
  sfx.nova();
  updateHUD();
}

function destroyRock(r) {
  if (r.dead) return;
  if (r.hp > 1) {
    r.hp--; r.flash = 6;
    explode(r.x, r.y, '#a8a29e', 5, true);
    sfx.clink();
    return;
  }
  r.dead = true;
  const pal = sector().palette;
  const col = r.variant === 'volatile' ? '#fb923c' : r.variant === 'armored' ? '#c084fc' : pal.rock[r.hue];
  const pts = r.variant === 'armored' ? 300 : r.variant === 'volatile' ? 200 : [0, 150, 100, 50][r.size];
  kill(pts, r.x, r.y);
  explode(r.x, r.y, col, 8 + r.size * 4, true);
  sfx.boom();
  shake(r.size + 1);
  if (r.variant === 'volatile') {
    for (let i = 0; i < 8; i++) fireEnemy(r.x, r.y, i * Math.PI / 4 + 0.2, 3, '#fb923c', 40);
    shockwave(r.x, r.y, 80, '#fb923c');
    rocks.forEach(o => { if (!o.dead && o !== r && dist(o, r) < 70 + o.r) destroyRock(o); }); // chain reaction
  } else if (r.variant === 'armored') {
    rocks.push(makeRock(r.x, r.y, 2), makeRock(r.x, r.y, 2));
    for (let i = 0; i < 2; i++) crystals.push({ x: r.x, y: r.y, vx: rnd(-1.5, 1.5), vy: rnd(-1.5, 1.5), life: 480, r: 7 });
  } else if (r.size > 1) {
    rocks.push(makeRock(r.x, r.y, r.size - 1), makeRock(r.x, r.y, r.size - 1));
  } else if (Math.random() < 0.45) {
    crystals.push({ x: r.x, y: r.y, vx: rnd(-0.75, 0.75), vy: rnd(-0.75, 0.75), life: 420, r: 7 });
  }
}

function dropPowerup(x, y, chance) {
  if (Math.random() >= chance) return;
  const type = ['spread', 'rapid', 'shield'][Math.floor(Math.random() * 3)];
  powerups.push({ x, y, vx: rnd(-0.4, 0.4), vy: rnd(-0.4, 0.4), type, life: 600 });
}

function detonateMine(m) {
  if (m.dead) return;
  m.dead = true;
  for (let i = 0; i < 10; i++) fireEnemy(m.x, m.y, i * Math.PI / 5, 3.2, '#ef4444', 42);
  explode(m.x, m.y, '#94a3b8', 12, true);
  shockwave(m.x, m.y, 70, '#ef4444');
  shake(5);
  sfx.boom();
}

function bossDefeated(b) {
  addScore(b.points * (1 + cycle), b.x, b.y - 40);
  for (let i = 0; i < 4; i++) shockwave(b.x + rnd(-30, 30), b.y + rnd(-30, 30), 160 + i * 60, i % 2 ? '#fde047' : '#f0abfc');
  explode(b.x, b.y, '#ffffff', 30, true);
  explode(b.x, b.y, '#f0abfc', 40, true);
  explode(b.x, b.y, '#67e8f9', 30);
  for (let i = 0; i < 6; i++) crystals.push({ x: b.x, y: b.y, vx: rnd(-2, 2), vy: rnd(-2, 2), life: 600, r: 7 });
  powerups.push({ x: b.x, y: b.y, vx: 0, vy: 0.3, type: 'shield', life: 900 });
  eshots = [];
  saucers.forEach(s => { s.dead = true; explode(s.x, s.y, '#67e8f9', 10); });
  seekers.forEach(s => { s.dead = true; });
  boss = null;
  shake(16);
  deathFreeze = 24;
  sfx.bossDown();
}

function hitShip() {
  if (ship.dead || ship.invuln > 0) return;
  if (ship.shield) {
    ship.shield = false;
    if (power === 'shield') { power = null; powerTime = 0; }
    ship.invuln = 60;
    shockwave(ship.x, ship.y, 90, '#67e8f9');
    sfx.hurt();
    shake(6);
    return;
  }
  lives--;
  sfx.shipDeath();
  explode(ship.x, ship.y, '#ffffff', 18);
  explode(ship.x, ship.y, '#f472b6', 26, true);
  explode(ship.x, ship.y, '#67e8f9', 18);
  shockwave(ship.x, ship.y, 220, '#f472b6');
  deathFreeze = 18;
  shake(12);
  ship.dead = true;
  respawnT = 70; respawnWait = 0;
  power = null; powerTime = 0; combo = 0; comboT = 0;
  updateHUD();
  // The last ship: don't open the initials prompt on the frame it explodes.
  // The player is still holding thrust/rotate/nova — W, A, D and X are also
  // letters, so they typed straight into the prompt before anyone noticed the
  // game had ended. Play a GAME OVER beat first; finishGame() runs after it.
  if (lives <= 0) ending = ENDING_FRAMES;
}

const ENDING_FRAMES = 150;
let ending = 0;
function finishGame() {
  {
    gameOver = true; gameRunning = false;
    Object.keys(keys).forEach(k => { keys[k] = false; });
    const finalScore = score, reached = `${sectorIdx + 1}-${waveIdx + 1}`, sname = sector().name;
    const finish = () => {
      document.getElementById('startOverlay').classList.remove('hidden');
      document.getElementById('startOverlay').innerHTML = `
        <h2>DIMENSION COLLAPSED</h2>
        <p>Score: ${finalScore}</p>
        <p>Reached ${sname} · wave ${reached}${cycle ? ` · cycle ${cycle + 1}` : ''}</p>
        <p style="margin-top:0.8rem; color:#a78bfa; font-size:0.8rem; letter-spacing:1px">TOP PILOTS</p>
        ${typeof Arcade !== 'undefined' ? Arcade.boardHTML(Arcade.slug) : ''}
        <p style="margin-top:0.8rem; opacity:0.8">Click or ENTER to try again</p>
      `;
    };
    if (typeof Arcade !== 'undefined') Arcade.submitFlow(finalScore, finish); else finish();
  }
}

function wrap(o, pad) {
  if (o.x < -pad) o.x = W + pad; if (o.x > W + pad) o.x = -pad;
  if (o.y < -pad) o.y = H + pad; if (o.y > H + pad) o.y = -pad;
}
function pullToWell(o, k) {
  if (!well) return;
  const dx = well.x - o.x, dy = well.y - o.y, d = Math.hypot(dx, dy) || 1;
  const f = well.pull * k * Math.max(0, 1 - d / 420);
  o.vx += dx / d * f; o.vy += dy / d * f;
}

// Attract-mode pilot for the hub's cabinet preview: turn toward the nearest
// target and keep firing. Returns virtual controls.
function autopilot() {
  const targets = [...rocks, ...saucers, ...mines, ...seekers, ...wraiths.filter(w => w.vis > 0.6)];
  if (boss) targets.push(boss);
  let best = null, bd = 1e9;
  targets.forEach(t => { const d = dist(t, ship); if (d < bd) { bd = d; best = t; } });
  if (!best) return { left: false, right: false, thrust: false, fire: false };
  let d = Math.atan2(best.y - ship.y, best.x - ship.x) - ship.angle;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return { left: d < -0.05, right: d > 0.05, thrust: bd > 320 && Math.abs(d) < 0.4, fire: Math.abs(d) < 0.3 };
}

// ---------- Update (one fixed 60 Hz step) ----------
function update() {
  tick++;
  shockwaves.forEach(s => { s.r += (s.max - s.r) * 0.12; s.life--; });
  shockwaves = shockwaves.filter(s => s.life > 0);
  popups.forEach(p => { p.y -= 0.6; p.life--; });
  popups = popups.filter(p => p.life > 0);
  if (!gameRunning || paused) return;
  if (ending > 0 && --ending === 0) { finishGame(); return; }

  if (deathFreeze > 0) {
    deathFreeze--;
    particles.forEach(p => { p.x += p.vx * 0.3; p.y += p.vy * 0.3; p.life--; });
    particles = particles.filter(p => p.life > 0);
    return;
  }
  shakeAmt *= 0.85;
  if (comboT > 0 && --comboT === 0) combo = 0;
  if (powerTime > 0 && --powerTime === 0) { if (power === 'shield') ship.shield = false; power = null; }

  if (phase === 'intro' && --phaseT <= 0) { spawnWave(); phase = 'play'; }
  if (phase === 'clear' && --phaseT <= 0) advance();

  updateShip();
  updateShots();
  updateHostiles();
  if (boss) {
    updateBoss(boss);
    if (boss.hp <= 0) bossDefeated(boss);
  }
  updatePickups();
  collide();

  rocks = rocks.filter(r => !r.dead);
  saucers = saucers.filter(s => !s.dead);
  wraiths = wraiths.filter(w => !w.dead);
  mines = mines.filter(m => !m.dead);
  seekers = seekers.filter(s => !s.dead);
  shots = shots.filter(b => !b.dead && b.life > 0);
  eshots = eshots.filter(b => !b.dead && b.life > 0);

  particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.vx *= 0.97; p.vy *= 0.97; p.rot += p.spin || 0; p.life--; });
  particles = particles.filter(p => p.life > 0);
  checkClear();
}

function updateShip() {
  if (ship.dead) {
    if (lives <= 0) return;
    if (respawnT > 0) { respawnT--; return; }
    const p = spawnPoint();
    const hazards = [...rocks, ...saucers, ...mines, ...seekers, ...wraiths];
    const safe = !hazards.some(h => Math.hypot(h.x - p.x, h.y - p.y) < 110 + (h.r || 0)) && !(boss && Math.hypot(boss.x - p.x, boss.y - p.y) < 160);
    if (safe || ++respawnWait > 180) { resetShip(); ship.invuln = 140; }
    return;
  }
  const auto = typeof Arcade !== 'undefined' && Arcade.attract ? autopilot() : null;
  const left = auto ? auto.left : keys.ArrowLeft || keys.KeyA;
  const right = auto ? auto.right : keys.ArrowRight || keys.KeyD;
  if (left) ship.angle -= 0.07;
  if (right) ship.angle += 0.07;
  ship.bank += ((right ? 1 : 0) - (left ? 1 : 0) - ship.bank) * 0.2;
  ship.thrust = auto ? auto.thrust : !!(keys.ArrowUp || keys.KeyW);
  const inCloud = clouds.some(c => dist(c, ship) < c.r);
  if (ship.thrust) {
    const k = inCloud ? 0.09 : 0.18;
    ship.vx += Math.cos(ship.angle) * k;
    ship.vy += Math.sin(ship.angle) * k;
    if (tick % 3 === 0) particles.push({ x: ship.x - Math.cos(ship.angle) * 14, y: ship.y - Math.sin(ship.angle) * 14, vx: -Math.cos(ship.angle) * 2 + rnd(-0.4, 0.4), vy: -Math.sin(ship.angle) * 2 + rnd(-0.4, 0.4), life: 16, color: '#f0abfc', size: 1.8 });
  }
  pullToWell(ship, 1);
  const drag = inCloud ? 0.96 : 0.99;
  ship.vx *= drag; ship.vy *= drag;
  const sp = Math.hypot(ship.vx, ship.vy);
  if (sp > 6) { ship.vx = ship.vx / sp * 6; ship.vy = ship.vy / sp * 6; }
  ship.x += ship.vx; ship.y += ship.vy;
  wrap(ship, 0);
  if (ship.invuln > 0) ship.invuln--;

  if (ship.cool > 0) ship.cool--;
  const wantFire = auto ? auto.fire : keys.Space;
  if (wantFire && ship.cool <= 0 && ship.invuln < 125 && phase !== 'clear') fire();
  const novaKey = !!(keys.KeyX || keys.ShiftLeft || keys.ShiftRight);
  if (novaKey && !novaHeld) nova();
  novaHeld = novaKey;
}

function updateShots() {
  shots.forEach(b => { pullToWell(b, 0.6); b.x += b.vx; b.y += b.vy; b.life--; wrap(b, 0); });
  eshots.forEach(b => {
    b.x += b.vx; b.y += b.vy; b.life--;
    if (b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20) b.dead = true;
  });
}

function updateHostiles() {
  const lvl = sectorIdx * 3 + waveIdx + cycle * 4;
  rocks.forEach(r => {
    pullToWell(r, 0.25);
    const sp = Math.hypot(r.vx, r.vy), cap = 3.2 * cycleMult;
    if (sp > cap) { r.vx = r.vx / sp * cap; r.vy = r.vy / sp * cap; }
    r.x += r.vx; r.y += r.vy; r.angle += r.spin;
    if (r.flash > 0) r.flash--;
    wrap(r, 30);
  });

  saucers.forEach(g => {
    g.angle = Math.atan2(ship.y - g.y, ship.x - g.x);
    g.vx += Math.cos(g.angle) * 0.02; g.vy += Math.sin(g.angle) * 0.02;
    const gsp = Math.hypot(g.vx, g.vy), cap = 2.5 * cycleMult;
    if (gsp > cap) { g.vx = g.vx / gsp * cap; g.vy = g.vy / gsp * cap; }
    g.x += g.vx; g.y += g.vy;
    if (tick % 3 === 0) { g.trail.push({ x: g.x, y: g.y }); if (g.trail.length > 8) g.trail.shift(); }
    if (g.x < -30 || g.x > W + 30 || g.y < -30 || g.y > H + 30) { wrap(g, 30); g.trail = []; }
    if (ship.dead) return;
    // a queued burst (replaces the old wall-clock setTimeout bursts, which kept
    // firing through pauses and after the saucer had died)
    if (g.burst > 0 && --g.burstT <= 0) {
      fireEnemy(g.x, g.y, g.angle, 5.2 * cycleMult, '#f87171', 70);
      g.burst--; g.burstT = 8;
    }
    if (--g.shootTimer <= 0) {
      if (lvl >= 5 && Math.random() < 0.35) {
        for (let s = -2; s <= 2; s++) fireEnemy(g.x, g.y, g.angle + s * 0.22, 4.6, '#f87171', 75);
      } else if (lvl >= 2) {
        g.burst = 3; g.burstT = 0;
      } else {
        fireEnemy(g.x, g.y, g.angle, 5, '#f87171', 70);
      }
      g.shootTimer = rnd(90, 180) / cycleMult;
    }
  });

  wraiths.forEach(w => {
    w.face = Math.atan2(ship.y - w.y, ship.x - w.x);
    if (--w.t <= 0) {
      const next = { fadeIn: ['shown', 150], shown: ['fadeOut', 30], fadeOut: ['hidden', 90], hidden: ['fadeIn', 30] }[w.state];
      w.state = next[0]; w.t = next[1];
    }
    w.vis = w.state === 'shown' ? 1 : w.state === 'hidden' ? 0 : w.state === 'fadeIn' ? 1 - w.t / 30 : w.t / 30;
    const hidden = w.state === 'hidden';
    w.vx += Math.cos(w.face) * (hidden ? 0.07 : 0.03);
    w.vy += Math.sin(w.face) * (hidden ? 0.07 : 0.03);
    const sp = Math.hypot(w.vx, w.vy), cap = (hidden ? 3 : 1.6) * cycleMult;
    if (sp > cap) { w.vx = w.vx / sp * cap; w.vy = w.vy / sp * cap; }
    w.x += w.vx; w.y += w.vy;
    wrap(w, 20);
    if (w.state === 'shown' && w.t === 75 && !ship.dead) fireEnemy(w.x, w.y, w.face, 3.4, '#e879f9', 110);
  });

  mines.forEach(m => {
    m.x += m.vx; m.y += m.vy; m.rot += m.fuse > 0 ? 0.2 : 0.02;
    wrap(m, 20);
    if (m.fuse === 0 && !ship.dead && dist(m, ship) < MINE_TRIGGER) { m.fuse = MINE_FUSE; sfx.mineArm(); }
    else if (m.fuse > 0) {
      if (m.fuse % 10 === 0) sfx.mineArm();
      if (--m.fuse <= 0) detonateMine(m);
    }
  });

  seekers.forEach(s => {
    const want = Math.atan2(ship.y - s.y, ship.x - s.x);
    let d = want - s.angle;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    s.angle += Math.max(-0.05, Math.min(0.05, d));
    s.vx += Math.cos(s.angle) * 0.12; s.vy += Math.sin(s.angle) * 0.12;
    const sp = Math.hypot(s.vx, s.vy), cap = 3.2 * cycleMult;
    if (sp > cap) { s.vx = s.vx / sp * cap; s.vy = s.vy / sp * cap; }
    s.x += s.vx; s.y += s.vy;
    if (tick % 2 === 0) { s.trail.push({ x: s.x, y: s.y }); if (s.trail.length > 7) s.trail.shift(); }
    if (s.x < -20 || s.x > W + 20 || s.y < -20 || s.y > H + 20) { wrap(s, 20); s.trail = []; }
    if (--s.life <= 0) { s.dead = true; explode(s.x, s.y, '#f472b6', 8, true); }
  });

  clouds.forEach(c => { c.x += c.vx; c.y += c.vy; wrap(c, c.r); });
}

function updatePickups() {
  crystals.forEach(c => {
    const d = dist(c, ship);
    if (!ship.dead && (phase === 'clear' || d < 90)) {
      const k = phase === 'clear' ? 0.5 : 0.25;
      c.vx += (ship.x - c.x) / (d || 1) * k; c.vy += (ship.y - c.y) / (d || 1) * k;
      c.vx *= 0.9; c.vy *= 0.9;
    }
    c.x += c.vx; c.y += c.vy; c.life--;
    wrap(c, 0);
  });
  crystals = crystals.filter(c => c.life > 0 && !c.taken);
  powerups.forEach(p => { p.x += p.vx; p.y += p.vy; p.life--; wrap(p, 0); });
  powerups = powerups.filter(p => p.life > 0 && !p.taken);
}

function collide() {
  // player shots: each shot stops at the FIRST thing it hits. (The old code
  // spliced inside nested forEach loops, so one shot could shatter two rocks
  // and the second splice deleted a different, innocent bullet.)
  for (const b of shots) {
    if (b.dead) continue;
    if (boss && bossShotHit(boss, b)) { b.dead = true; continue; }
    const r = rocks.find(o => !o.dead && Math.hypot(b.x - o.x, b.y - o.y) < o.r);
    if (r) { b.dead = true; destroyRock(r); continue; }
    const s = saucers.find(o => !o.dead && Math.hypot(b.x - o.x, b.y - o.y) < o.r + 2);
    if (s) {
      b.dead = s.dead = true;
      kill(300, s.x, s.y); explode(s.x, s.y, '#67e8f9', 22, true); sfx.bigBoom(); shake(4);
      dropPowerup(s.x, s.y, 0.22);
      continue;
    }
    const w = wraiths.find(o => !o.dead && o.vis > 0.6 && Math.hypot(b.x - o.x, b.y - o.y) < o.r + 2);
    if (w) {
      b.dead = w.dead = true;
      kill(400, w.x, w.y); explode(w.x, w.y, '#c084fc', 22); sfx.bigBoom(); shake(4);
      dropPowerup(w.x, w.y, 0.3);
      continue;
    }
    const m = mines.find(o => !o.dead && Math.hypot(b.x - o.x, b.y - o.y) < o.r + 2);
    if (m) { b.dead = true; kill(150, m.x, m.y); detonateMine(m); continue; }
    const k = seekers.find(o => !o.dead && Math.hypot(b.x - o.x, b.y - o.y) < o.r + 3);
    if (k) { b.dead = k.dead = true; kill(150, k.x, k.y); explode(k.x, k.y, '#f472b6', 10, true); sfx.boom(); }
  }

  if (ship.dead) return;
  // pickups work even while invulnerable
  crystals.forEach(c => {
    if (dist(c, ship) < c.r + ship.r + 2) {
      c.taken = true;
      addScore(100);
      sfx.crystal();
      explode(c.x, c.y, '#e879f9', 6);
      if (++novaCharge >= NOVA_COST) {
        novaCharge = 0;
        if (novas < NOVA_MAX) { novas++; sfx.novaReady(); popups.push({ x: ship.x, y: ship.y - 24, text: 'NOVA READY', life: 60 }); }
        else addScore(500, ship.x, ship.y - 24);
      }
    }
  });
  powerups.forEach(p => {
    if (dist(p, ship) < 14 + ship.r) {
      p.taken = true;
      power = p.type; powerTime = POWER_TIME;
      ship.shield = p.type === 'shield' || ship.shield;
      sfx.power();
      popups.push({ x: ship.x, y: ship.y - 24, text: p.type.toUpperCase(), life: 60 });
    }
  });

  if (ship.invuln > 0) return;
  const touching = o => dist(o, ship) < o.r + ship.r;
  const e = eshots.find(b => Math.hypot(b.x - ship.x, b.y - ship.y) < ship.r + 3);
  if (e) { e.dead = true; return hitShip(); }
  if (rocks.some(r => !r.dead && dist(r, ship) < r.r * 0.9 + ship.r)) return hitShip();
  if (saucers.some(s => !s.dead && touching(s))) return hitShip();
  if (wraiths.some(w => !w.dead && w.vis > 0.6 && touching(w))) return hitShip();
  const m = mines.find(o => !o.dead && touching(o));
  if (m) { detonateMine(m); return hitShip(); }
  const k = seekers.find(o => !o.dead && touching(o));
  if (k) { k.dead = true; return hitShip(); }
  if (boss && bossTouchesShip(boss)) return hitShip();
  if (well && dist(well, ship) < well.core + ship.r * 0.5) return hitShip();
}

// ---------- Draw ----------
function draw() {
  const s = sector();
  ctx.save();
  if (shakeAmt > 0.3) ctx.translate(rnd(-shakeAmt, shakeAmt), rnd(-shakeAmt, shakeAmt));
  drawBackground(s);
  if (well) drawWell(well);
  if (clouds.length) drawClouds(clouds);
  rocks.forEach(r => drawRock(r, s.palette));
  crystals.forEach(drawCrystalPickup);
  powerups.forEach(drawPowerup);
  mines.forEach(drawMine);
  seekers.forEach(drawSeeker);
  saucers.forEach(drawSaucer);
  wraiths.forEach(drawWraith);
  if (boss) drawBoss(boss);
  drawShockwaves(shockwaves);
  drawShots(shots, false);
  drawShots(eshots, true);
  if (!ship.dead && (ship.invuln <= 0 || Math.floor(ship.invuln / 3) % 2 === 0)) drawShip(ship, power);
  drawParticles(particles);
  popups.forEach(p => {
    ctx.globalAlpha = Math.min(1, p.life / 20);
    ctx.fillStyle = p.big ? '#fde68a' : '#f5f3ff';
    ctx.font = p.big ? '800 22px Segoe UI, sans-serif' : '700 12px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.text, p.x, p.y);
  });
  ctx.globalAlpha = 1;
  ctx.restore();

  if (!gameRunning && !gameOver) return;
  if (boss && !boss.entry) drawBossBar(boss);
  drawHudOverlay({ novas, novaCharge, power, powerTime, combo, label: `${s.name} · ${sectorIdx + 1}-${waveIdx + 1}${cycle ? ` · CYCLE ${cycle + 1}` : ''}` });

  if (ending) {
    drawBanner('GAME OVER', `Final score ${score.toLocaleString()}`, Math.min(1, (ENDING_FRAMES - ending) / 30));
  } else if (phase === 'intro') {
    const fade = Math.min(1, phaseT / 25, (phaseTotal() - phaseT) / 20);
    if (isBossWave()) drawBanner('WARNING', s.boss.name + ' APPROACHES', fade * ((tick >> 5) % 2 ? 1 : 0.6));
    else if (waveIdx === 0) drawBanner((cycle ? `CYCLE ${cycle + 1} · ` : '') + `SECTOR ${sectorIdx + 1}: ${s.name}`, s.sub, fade);
    else drawBanner(`WAVE ${sectorIdx + 1}-${waveIdx + 1}`, s.name, fade);
  } else if (phase === 'clear') {
    drawBanner(isBossWave() ? 'SECTOR CLEAR' : 'WAVE CLEAR', `+${clearBonus} bonus`, Math.min(1, phaseT / 20, (110 - phaseT) / 15));
  }
  if (paused) drawBanner('PAUSED', 'P or Esc to resume', 1);
}
function phaseTotal() { return waveIdx === 0 || isBossWave() ? 150 : 90; }

function updateHUD() {
  document.getElementById('score').textContent = score;
  document.getElementById('lives').textContent = lives;
  document.getElementById('wave').textContent = `${sectorIdx + 1}-${waveIdx + 1}`;
  const n = document.getElementById('novas');
  if (n) n.textContent = novas;
}

resetShip();

// Fixed-step loop: rules always advance at 60 Hz whatever the display rate.
let lastFrame = null, acc = 0;
function loop(now) {
  now = typeof now === 'number' ? now : performance.now();
  if (lastFrame === null) lastFrame = now;
  acc += Math.min(250, Math.max(0, now - lastFrame));
  lastFrame = now;
  let steps = 0;
  while (acc >= STEP && steps++ < 8) { update(); acc -= STEP; }
  if (steps >= 8) acc = 0;
  draw();
  ArcadeVR.schedule(loop);
}
loop();
console.log('Spectral Manor Crystal Dimension ready');
