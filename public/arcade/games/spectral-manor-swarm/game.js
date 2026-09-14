// ============================================================
// SPECTRAL MANOR SWARM — rules
// Twin-stick survival: monsters hunt Ghost Circuit fans; you save them.
//
// Files (load order): arena.js (arenas, props, hazards, lighting) ·
//   fx.js (lasers + effects) · hero.js · bosses.js · render.js · game.js
// Three arenas × five waves; every fifth wave is a boss. After the Manor
// Courtyard the arenas loop with tougher monsters.
// Rules run at a fixed 60 Hz (loop()), so high-refresh screens play at the
// intended speed.
// ============================================================

const canvas = document.getElementById('gameCanvas');
let ctx = canvas.getContext('2d');   // let: arena.js swaps it briefly to paint its floor cache
const W = canvas.width;
const H = canvas.height;
const ATTRACT_MODE = /[?&]attract\b/.test(location.search);
if (ATTRACT_MODE) document.body.classList.add('attract');

// ---------- Audio ----------
let audioCtx = null;
function initAudio() {
  if (!audioCtx) audioCtx = ArcadeAudio.context();
  ArcadeAudio.resume();
}
function playTone(freq, dur, type = 'square', vol = 0.06, slide = 0) {
  if (!audioCtx) return;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, audioCtx.currentTime);
  if (slide) o.frequency.linearRampToValueAtTime(Math.max(20, freq + slide), audioCtx.currentTime + dur);
  g.gain.setValueAtTime(vol, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
  o.connect(g); g.connect(ArcadeAudio.output('sfx'));
  o.start(); o.stop(audioCtx.currentTime + dur);
}
function playNoise(dur, vol, filterType, f0, f1) {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const len = Math.floor(audioCtx.sampleRate * dur);
  const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const n = audioCtx.createBufferSource();
  n.buffer = buf;
  const flt = audioCtx.createBiquadFilter();
  flt.type = filterType;
  flt.frequency.setValueAtTime(f0, t);
  if (f1) flt.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  n.connect(flt); flt.connect(g); g.connect(ArcadeAudio.output('sfx'));
  n.start(t);
}
function playZap(f0, fEnd, dur, vol) {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(fEnd, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur * 1.2);
  o.connect(g); g.connect(ArcadeAudio.output('sfx'));
  o.start(t); o.stop(t + dur * 1.3);
}
const later = (fn, ms) => setTimeout(fn, ms);
const sfx = {
  // the gun fires ~8x/sec: keep every voice SHORT or it muds
  shoot: () => { playZap(2200 + Math.random() * 300, 420, 0.05, 0.05); playTone(90, 0.04, 'sine', 0.05, -30); playNoise(0.025, 0.04, 'highpass', 3000); },
  lance: () => playZap(600, 300, 0.05, 0.02),
  hit: () => { playNoise(0.1, 0.08, 'lowpass', 2600, 400); playZap(500, 120, 0.08, 0.05); },
  kill: () => { playNoise(0.18, 0.11, 'lowpass', 2200, 200); playZap(320, 60, 0.14, 0.08); playTone(70, 0.12, 'sine', 0.08, -20); },
  save: () => { playTone(520, 0.07, 'square', 0.06); later(() => playTone(680, 0.08, 'square', 0.06), 60); later(() => { playTone(880, 0.1, 'square', 0.07); playNoise(0.1, 0.03, 'highpass', 6000); }, 120); },
  lost: () => { playZap(420, 90, 0.4, 0.06); playTone(280, 0.35, 'triangle', 0.05, -180); },
  hurt: () => { playNoise(0.35, 0.13, 'lowpass', 2800, 200); playZap(700, 60, 0.3, 0.1); playTone(90, 0.3, 'sine', 0.12, -50); },
  wave: () => { playNoise(0.25, 0.04, 'bandpass', 400, 3200); playTone(440, 0.07, 'square', 0.06); later(() => playTone(554, 0.07, 'square', 0.06), 70); later(() => playTone(659, 0.12, 'square', 0.07), 140); },
  power: () => [523, 659, 784, 1047].forEach((f, i) => later(() => playTone(f, 0.08, 'square', 0.05), i * 50)),
  dash: () => { playNoise(0.18, 0.07, 'bandpass', 800, 3500); playZap(300, 900, 0.1, 0.03); },
  bolt: () => playZap(900, 300, 0.12, 0.04),
  rumble: () => playTone(55, 0.6, 'sawtooth', 0.06, 15),
  crash: () => { playNoise(0.6, 0.15, 'lowpass', 1500, 80); playTone(50, 0.5, 'sine', 0.13, -20); },
  slam: () => { playNoise(0.5, 0.15, 'lowpass', 900, 60); playTone(45, 0.5, 'sine', 0.14, -15); },
  wail: () => playTone(700, 0.8, 'sine', 0.05, 500),
  scream: () => { playNoise(0.5, 0.1, 'highpass', 2000, 6000); playZap(1600, 400, 0.4, 0.05); },
  thump: () => { playTone(60, 0.25, 'sine', 0.1, -20); playNoise(0.2, 0.06, 'lowpass', 400, 80); },
  thunder: () => { playNoise(0.9, 0.16, 'lowpass', 3000, 60); playTone(40, 0.8, 'sine', 0.12, -10); },
  bossDown: () => { playNoise(1, 0.16, 'lowpass', 2400, 60); [392, 523, 659, 784, 1047].forEach((f, i) => later(() => playTone(f, 0.14, 'square', 0.06), 400 + i * 100)); }
};

// ---------- State ----------
const ENDING_FRAMES = 150, DASH_TIME = 10, DASH_CD = 55, DASH_SPEED = 12;
let score = 0, lives = 3, wave = 1, saved = 0, lost = 0, tick = 0;
let gameRunning = false, gameOver = false;
let keys = {};
let mouse = { x: W / 2, y: H / 2, down: false };
const BEST_KEY = 'spectralArcade.swarm.best';
function loadBest() { try { return parseInt(localStorage.getItem(BEST_KEY), 10) || 0; } catch (e) { return 0; } }
function saveBest() { try { localStorage.setItem(BEST_KEY, best); } catch (e) {} }
let best = loadBest();
let combo = 0, comboTimer = 0, hitPause = 0, shakeTime = 0, shakeMag = 0, waveDelay = 0;
let bannerText = '', bannerSub = '', bannerTime = 0, ending = 0, flash = 0, arenaFade = 0, introTime = 0;
let arenaIdx = 0, dashHeld = false;
function triggerShake(mag, time) { shakeMag = Math.max(shakeTime > 0 ? shakeMag : 0, mag); shakeTime = Math.max(shakeTime, time); }
function comboMult() { return Math.min(1 + Math.floor(combo / 5), 5); }
function bannerFlash(text, sub = '') { bannerText = text; bannerSub = sub; bannerTime = 60; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);

const player = {
  x: W / 2, y: H / 2, w: 26, h: 26, speed: 4.6, fireCooldown: 0, invuln: 0, shieldT: 0,
  angle: 0, recoil: 0, moving: false, walkPhase: 0, powerType: null, powerTime: 0,
  weapon: 'dual', dashT: 0, dashCd: 0, dashVx: 0, dashVy: 0, trail: []
};

let bullets = [], monsters = [], fans = [], particles = [], obstacles = [], enemyBolts = [], drops = [];
let muzzles = [], impacts = [], scorches = [], shockRings = [], graves = [], strikes = [], bosses = [];
let lance = null, rescueChain = 0, graveBudget = 0, strikeTimer = 200;

// ---------- Obstacles ----------
function insideObstacle(x, y, w, h) {
  return obstacles.some(o => x < o.x + o.w && x + w > o.x && y < o.y + o.h && y + h > o.y);
}
function pushOutOfObstacles() {
  for (const o of obstacles) {
    if (!(player.x < o.x + o.w && player.x + player.w > o.x && player.y < o.y + o.h && player.y + player.h > o.y)) continue;
    const pcx = player.x + player.w / 2, pcy = player.y + player.h / 2;
    const ocx = o.x + o.w / 2, ocy = o.y + o.h / 2;
    const ox = (player.w / 2 + o.w / 2) - Math.abs(pcx - ocx);
    const oy = (player.h / 2 + o.h / 2) - Math.abs(pcy - ocy);
    if (ox < oy) player.x += pcx < ocx ? -ox : ox;
    else player.y += pcy < ocy ? -oy : oy;
  }
  player.x = clamp(player.x, 8, W - player.w - 8);
  player.y = clamp(player.y, 40, H - player.h - 8);
}
function spawnObstacles() {
  obstacles = [];
  const arena = ARENAS[arenaIdx];
  const count = 4 + Math.min(wave % WAVES_PER_ARENA || WAVES_PER_ARENA, 3);
  let guard = 0;
  while (obstacles.length < count && guard++ < 300) {
    const o = { kind: arena.prop, x: 70 + Math.random() * (W - 220), y: 80 + Math.random() * (H - 210), w: 50 + Math.random() * 40, h: 40 + Math.random() * 20 };
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
    if (Math.hypot(cx - W / 2, cy - H / 2) < 130) continue;
    if (obstacles.some(p => Math.hypot(p.x - o.x, p.y - o.y) < 140)) continue;
    if (o.kind === 'speaker') o.pulse = { phase: 'idle', t: 150 + obstacles.length * 70 };
    obstacles.push(o);
  }
}
function clearSpot(x, y, w, h) {
  for (let r = 0; r < 200; r += 12) {
    for (let a = 0; a < 6.28; a += 0.8) {
      const px = clamp(x + Math.cos(a) * r, 20, W - w - 20), py = clamp(y + Math.sin(a) * r, 50, H - h - 20);
      if (!insideObstacle(px - 6, py - 6, w + 12, h + 12)) return { x: px, y: py };
    }
  }
  return { x, y };
}

// ---------- Power-ups ----------
const DROP_TYPES = [
  { type: 'rapid', label: 'RAPID', color: '#4ade80' },
  { type: 'spread', label: 'SPREAD', color: '#e879f9' },
  { type: 'lance', label: 'LANCE', color: '#fbbf24' },
  { type: 'shield', label: 'SHIELD', color: '#86efac' },
  { type: 'banish', label: 'BANISH', color: '#f59e0b' }
];
function spawnDrop(x, y, type) {
  const pick = type ? DROP_TYPES.find(d => d.type === type) : DROP_TYPES[Math.floor(Math.random() * DROP_TYPES.length)];
  const s = clearSpot(x, y, 22, 22);
  drops.push({ x: s.x, y: s.y, w: 22, h: 22, ...pick, life: 540, bob: Math.random() * Math.PI * 2 });
}

// ---------- Input ----------
window.addEventListener('keydown', e => {
  initAudio();
  keys[e.code] = true;
  if (e.code === 'Space') e.preventDefault();
  if (e.code === 'Enter' && !e.repeat && !gameRunning) startGame();
});
window.addEventListener('keyup', e => keys[e.code] = false);
canvas.addEventListener('mousemove', e => {
  const r = canvas.getBoundingClientRect();
  mouse.x = (e.clientX - r.left) * (W / r.width);
  mouse.y = (e.clientY - r.top) * (H / r.height);
});
canvas.addEventListener('mousedown', e => { initAudio(); if (e.button === 2) keys.MouseDash = true; else mouse.down = true; });
canvas.addEventListener('mouseup', e => { if (e.button === 2) keys.MouseDash = false; else mouse.down = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());
document.getElementById('startOverlay').addEventListener('click', () => { initAudio(); if (!gameRunning) startGame(); });
TouchPad.init(canvas, {
  accent: '#c084fc', aimAccent: '#f0abfc',
  targets: () => monsters,
  onStart: () => { initAudio(); if (!gameRunning) startGame(); }
});

// ---------- Flow ----------
function startGame() {
  score = 0; lives = 3; wave = 1; saved = 0; lost = 0; tick = 0;
  bullets = []; monsters = []; fans = []; particles = []; enemyBolts = []; drops = [];
  muzzles = []; impacts = []; scorches = []; shockRings = []; graves = []; strikes = []; bosses = [];
  lance = null; rescueChain = 0;
  combo = 0; comboTimer = 0; hitPause = 0; shakeTime = 0; waveDelay = 0; ending = 0; flash = 0;
  Object.assign(player, { x: W / 2 - 13, y: H / 2 - 13, fireCooldown: 0, invuln: 0, shieldT: 0, recoil: 0, powerType: null, powerTime: 0, weapon: 'dual', dashT: 0, dashCd: 0, trail: [] });
  gameRunning = true; gameOver = false;
  document.getElementById('startOverlay').classList.add('hidden');
  spawnWave();
  announceWave();
  updateHUD();
}

function announceWave() {
  const arena = ARENAS[arenaOf(wave)];
  if (isBossWave(wave)) { bannerText = 'WARNING'; bannerSub = arena.bossName + ' APPROACHES'; }
  else if ((wave - 1) % WAVES_PER_ARENA === 0) { bannerText = arena.name; bannerSub = (cycleOfWave(wave) ? `Night ${cycleOfWave(wave) + 1} · ` : '') + arena.sub; }
  else { bannerText = 'WAVE ' + wave; bannerSub = arena.name.toLowerCase(); }
  bannerTime = 120;
  introTime = bannerTime;
}

function makeFan() {
  const roll = Math.random();
  let type, color, scale;
  if (roll < 0.62) { type = 'female'; color = ['#f0abfc', '#f9a8d4', '#e879f9', '#d8b4fe'][Math.floor(Math.random() * 4)]; scale = 1; }
  else if (roll < 0.88) { type = 'male'; color = ['#93c5fd', '#67e8f9', '#a5b4fc'][Math.floor(Math.random() * 3)]; scale = 1.05; }
  else { type = 'child'; color = ['#fde68a', '#fca5a5', '#bbf7d0'][Math.floor(Math.random() * 3)]; scale = 0.72; }
  const s = clearSpot(60 + Math.random() * (W - 120), 60 + Math.random() * (H - 110), 16 * scale, 22 * scale);
  fans.push({ x: s.x, y: s.y, w: 16 * scale, h: 22 * scale, type, color, scale, panic: 0, grabbed: false, grabber: null, screamTimer: Math.random() * 40 });
}

const MONSTER_TYPES = {
  grunt: { color: '#ef4444', speed: 1.5, hp: 1, size: 1 },
  hunter: { color: '#f97316', speed: 2.3, hp: 1, size: 0.9 },
  brute: { color: '#a855f7', speed: 1.0, hp: 3, size: 1.3 },
  horror: { color: '#4ade80', speed: 1.3, hp: 2, size: 1.15 },
  specter: { color: '#22d3ee', speed: 1.65, hp: 2, size: 0.95 },
  archon: { color: '#f472b6', speed: 1.45, hp: 5, size: 1.2 }
};
function spawnMonster(type, x, y) {
  const m = MONSTER_TYPES[type];
  const mon = {
    x, y, w: 24 * m.size, h: 26 * m.size, speed: m.speed + wave * 0.1, hp: m.hp + Math.floor(wave / 4), maxHp: m.hp + Math.floor(wave / 4),
    type, color: m.color, size: m.size, target: null, boltTimer: 100 + Math.random() * 120, boltCharge: 0,
    walkPhase: Math.random() * 6, hitFlash: 0, lunge: null, lungeCd: 90, lanceCd: 0
  };
  monsters.push(mon);
  return mon;
}
function raiseFromGrave(x, y, type) {
  const s = clearSpot(x, y, 30, 20);
  graves.push({ x: s.x + 15, y: s.y + 10, state: 'crack', t: 50, oneShot: true, spawnType: type });
}

function spawnWave() {
  arenaIdx = arenaOf(wave);
  const arena = ARENAS[arenaIdx], cyc = cycleOfWave(wave);
  monsters = []; fans = []; enemyBolts = []; shockRings = []; strikes = []; bosses = []; lance = null;
  rescueChain = 0;
  spawnObstacles();
  graves = [];
  if (arena.hazard === 'graves') {
    for (let i = 0; i < 4; i++) {
      const s = clearSpot(100 + Math.random() * (W - 200), 90 + Math.random() * (H - 180), 30, 20);
      graves.push({ x: s.x + 15, y: s.y + 10, state: 'idle', t: 160 + i * 110 });
    }
  }
  graveBudget = arena.hazard === 'graves' ? 2 + Math.floor(wave / 2) : 0;
  strikeTimer = 220;

  const fanCount = 7 + Math.floor(Math.min(wave, 15) * 1.2);
  for (let i = 0; i < fanCount; i++) makeFan();

  if (isBossWave(wave)) {
    const s = 1 + cyc * 0.5;
    bosses = arena.boss === 'duo' ? [createBoss('golem', s * 0.7), createBoss('banshee', s * 0.7)] : [createBoss(arena.boss, s)];
    if (arena.boss === 'duo') { bosses[0].x = W * 0.35; bosses[1].x = W * 0.65; }
  }

  const melee = ['grunt', 'hunter', 'brute', 'horror'];
  const mCount = isBossWave(wave) ? 3 + cyc : 5 + wave * 3;
  const rangedCap = wave < 3 ? 0 : Math.min(1 + Math.floor((wave - 3) / 3), 4);
  const pcx = player.x + player.w / 2, pcy = player.y + player.h / 2;
  for (let i = 0; i < mCount; i++) {
    const rangedSoFar = monsters.filter(m => m.type === 'specter' || m.type === 'archon').length;
    let type = melee[Math.floor(Math.random() * melee.length)];
    if (!isBossWave(wave) && rangedSoFar < rangedCap && i >= mCount - rangedCap) type = wave >= 6 && rangedSoFar === 0 ? 'archon' : 'specter';
    let x, y, tries = 0;
    do {
      if (Math.random() < 0.5) { x = Math.random() < 0.5 ? 20 : W - 40; y = 50 + Math.random() * (H - 90); }
      else { x = 40 + Math.random() * (W - 80); y = Math.random() < 0.5 ? 44 : H - 50; }
    } while (Math.hypot(x + 12 - pcx, y + 13 - pcy) < 170 && tries++ < 40);
    spawnMonster(type, x, y);
  }
}

function startEnding() {
  if (ending || !gameRunning) return;
  ending = ENDING_FRAMES;
  mouse.down = false;
  Object.keys(keys).forEach(k => keys[k] = false);
}
function endGame() {
  gameOver = true; gameRunning = false;
  const newBest = score > best;
  if (newBest) { best = score; saveBest(); }
  const finalScore = score;
  updateHUD();
  if (ATTRACT_MODE) { setTimeout(startGame, 700); return; }
  Arcade.submitFlow(finalScore, () => {
    document.getElementById('startOverlay').classList.remove('hidden');
    document.getElementById('startOverlay').innerHTML = `
      <h2>FANS LOST</h2>
      <p>Saved: ${saved} &nbsp;|&nbsp; Lost: ${lost} &nbsp;|&nbsp; Wave ${wave}</p>
      <p style="margin-top:0.5rem">Final Score: ${finalScore}</p>
      <p style="margin-top:0.3rem">Best: ${best}${newBest ? ' &nbsp;<span style="color:#f0abfc; font-weight:bold">NEW BEST!</span>' : ''}</p>
      <p style="margin-top:0.8rem; color:#a78bfa; font-size:0.8rem; letter-spacing:1px">TOP HEROES</p>
      ${Arcade.boardHTML(Arcade.slug)}
      <p style="margin-top:0.8rem; opacity:0.8">Click or ENTER to try again</p>
    `;
  });
}

// ---------- Weapons ----------
function fire() {
  const m = heroMuzzle(player);
  const a = player.angle;
  const kind = player.weapon;
  const sp = 16;
  const shots = kind === 'spread' ? [-0.28, -0.14, 0, 0.14, 0.28].map(o => ({ o, off: 0 }))
    : kind === 'rapid' ? [{ o: (Math.random() - 0.5) * 0.05, off: 0 }]
      : [{ o: 0, off: -4 }, { o: 0, off: 4 }];          // twin parallel beams
  shots.forEach(s => {
    const px = -Math.sin(a) * s.off, py = Math.cos(a) * s.off;
    bullets.push({ x: m.x + px, y: m.y + py, vx: Math.cos(a + s.o) * sp, vy: Math.sin(a + s.o) * sp, life: 50, age: 0, kind, seed: Math.random() * 6 });
  });
  muzzles.push({ x: m.x, y: m.y, a, life: 6, maxLife: 6, kind });
  player.fireCooldown = kind === 'rapid' ? 3 : kind === 'spread' ? 9 : 7;
  player.recoil = 5;
  sfx.shoot();
}

// The LANCE: a solid piercing beam while the trigger is held.
function updateLance(firing) {
  if (!firing || player.weapon !== 'lance' || player.dashT > 0) { lance = null; return; }
  const m = heroMuzzle(player), a = player.angle;
  let x = m.x, y = m.y, len = 0;
  const step = 8;
  while (len < 900) {
    x += Math.cos(a) * step; y += Math.sin(a) * step; len += step;
    if (x < 0 || x > W || y < 0 || y > H || insideObstacle(x - 2, y - 2, 4, 4)) break;
  }
  lance = { x0: m.x, y0: m.y, x1: x, y1: y };
  if (tick % 4 === 0) sfx.lance();
  if (tick % 6 === 0) { muzzles.push({ x: m.x, y: m.y, a, life: 5, maxLife: 5, kind: 'lance' }); impacts.push({ x, y, a, life: 10, maxLife: 10, color: '#fbbf24' }); }
  const hitsSeg = (px, py, r) => {
    const dx = x - m.x, dy = y - m.y, l2 = dx * dx + dy * dy || 1;
    const k = clamp(((px - m.x) * dx + (py - m.y) * dy) / l2, 0, 1);
    return Math.hypot(px - (m.x + dx * k), py - (m.y + dy * k)) < r;
  };
  monsters.forEach(mon => {
    if (mon.dead || mon.lanceCd > 0) return;
    if (hitsSeg(mon.x + mon.w / 2, mon.y + mon.h / 2 - 8, mon.w * 0.7)) { mon.lanceCd = 8; damageMonster(mon, 1, a); }
  });
  bosses.forEach(b => {
    if (tick % 8 === 0 && hitsSeg(b.x, b.y - b.h / 2, b.w * 0.5) && bossHitBy(b, b.x, b.y - b.h / 2)) { damageBoss(b, 1); pushImpact(b.x, b.y - b.h / 2, a, '#fbbf24'); }
  });
}

function pushImpact(x, y, a, color, big) { impacts.push({ x, y, a, life: big ? 22 : 14, maxLife: big ? 22 : 14, color, big }); }
function addScorch(x, y, r, color) {
  scorches.push({ x, y, r, a: Math.random() * 3, life: 900, maxLife: 900, color });
  if (scorches.length > 50) scorches.shift();
}
function fireBolt(x, y, a, speed, color, r, crackle) {
  enemyBolts.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r, color, life: 150, trail: [], seed: Math.random() * 6, crackle });
}

function damageMonster(m, n, a) {
  if (m.dead) return;
  m.hp -= n;
  m.hitFlash = 6;
  pushImpact(m.x + m.w / 2, m.y + m.h / 2 - 6, a, m.color);
  if (m.hp > 0) { sfx.hit(); return; }
  m.dead = true;
  fans.forEach(f => { if (f.grabber === m) { f.grabbed = false; f.grabber = null; } });
  m.carrying = null;
  combo++; comboTimer = 150;
  score += (150 + wave * 15) * comboMult();
  hitPause = 2;
  triggerShake(3, 8);
  burst(m.x + m.w / 2, m.y + m.h / 2, m.color, 22);
  pushImpact(m.x + m.w / 2, m.y + m.h / 2, a, m.color, true);
  addScorch(m.x + m.w / 2, m.y + m.h, 14 * m.size, m.color);
  sfx.kill();
  if (Math.random() < 0.13) spawnDrop(m.x, m.y);
  updateHUD();
}

function hurtPlayer() {
  if (player.invuln > 0 || player.dashT > 0 || player.shieldT > 0 || ending || !gameRunning) return false;
  lives--;
  player.invuln = 70;
  player.powerType = null; player.powerTime = 0; player.weapon = 'dual';
  combo = 0; comboTimer = 0;
  hitPause = 5;
  triggerShake(9, 18);
  sfx.hurt();
  burst(player.x + 13, player.y, '#f472b6', 18);
  updateHUD();
  if (lives <= 0) startEnding();
  return true;
}
function knockPlayer(fromX, fromY, amount) {
  const dx = player.x + player.w / 2 - fromX, dy = player.y + player.h / 2 - fromY, d = Math.hypot(dx, dy) || 1;
  player.x = clamp(player.x + dx / d * amount, 8, W - player.w - 8);
  player.y = clamp(player.y + dy / d * amount, 40, H - player.h - 8);
}

// ---------- Update ----------
function update() {
  tick++;
  if (!gameRunning) return;
  tickFx();
  if (ending > 0) { if (--ending === 0) endGame(); return; }
  if (hitPause > 0) { hitPause--; return; }
  if (shakeTime > 0) shakeTime--;
  if (bannerTime > 0) bannerTime--;
  if (flash > 0) flash = Math.max(0, flash - 0.08);
  if (arenaFade > 0) arenaFade--;
  if (comboTimer > 0 && --comboTimer === 0) combo = 0;
  if (waveDelay > 0 && --waveDelay === 0) { spawnWave(); announceWave(); arenaFade = (wave - 1) % WAVES_PER_ARENA === 0 ? 40 : 0; }
  // Round-start title: the action holds still until the banner has gone,
  // so a new wave never starts fighting underneath the title.
  if (introTime > 0) { introTime--; return; }

  if (ATTRACT_MODE) attractPilot();
  updatePlayer();
  updateProjectiles();
  updateDrops();
  updateFans();
  updateMonsters();
  bosses.forEach(updateBoss);
  updateHazards();
  collide();

  monsters = monsters.filter(m => !m.dead && !m.escaped);
  bullets = bullets.filter(b => !b.dead && b.life > 0);
  enemyBolts = enemyBolts.filter(b => !b.dead && b.life > 0);

  bosses.forEach(b => {
    if (b.hp > 0) return;
    b.dead = true;
    score += 5000 * (1 + cycleOfWave(wave));
    for (let i = 0; i < 4; i++) pushImpact(b.x + rnd(-40, 40), b.y - rnd(20, 90), Math.random() * 6, i % 2 ? '#fde047' : b.type === 'golem' ? '#4ade80' : '#f472b6', true);
    burst(b.x, b.y - 50, b.type === 'golem' ? '#a8a29e' : '#f472b6', 60);
    addScorch(b.x, b.y, 50, '#f97316');
    spawnDrop(b.x - 30, b.y); spawnDrop(b.x + 30, b.y);
    triggerShake(18, 34); flash = 0.8; hitPause = 12;
    sfx.bossDown();
    bannerFlash('BOSS DEFEATED', b.name);
    updateHUD();
  });
  bosses = bosses.filter(b => !b.dead);

  if (monsters.length === 0 && bosses.length === 0 && gameRunning && waveDelay === 0 && !ending) {
    fans.forEach(() => { saved++; score += 300; });
    fans = [];
    wave++;
    sfx.wave();
    bannerFlash('WAVE CLEAR', `${saved} fans saved so far`);
    waveDelay = (wave - 1) % WAVES_PER_ARENA === 0 ? 120 : 80;
    updateHUD();
  }
  pushOutOfObstacles();
}

// effects keep animating through hit-pause and the ending
function tickFx() {
  particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.vx *= 0.94; p.vy *= 0.94; p.life--; });
  particles = particles.filter(p => p.life > 0);
  muzzles.forEach(m => m.life--); muzzles = muzzles.filter(m => m.life > 0);
  impacts.forEach(i => i.life--); impacts = impacts.filter(i => i.life > 0);
  scorches.forEach(s => s.life--); scorches = scorches.filter(s => s.life > 0);
  player.trail.forEach(g => g.life--); player.trail = player.trail.filter(g => g.life > 0);
}

function updatePlayer() {
  let vx = 0, vy = 0;
  if (keys.ArrowLeft || keys.KeyA) vx = -1;
  if (keys.ArrowRight || keys.KeyD) vx = 1;
  if (keys.ArrowUp || keys.KeyW) vy = -1;
  if (keys.ArrowDown || keys.KeyS) vy = 1;
  if (vx && vy) { vx *= 0.707; vy *= 0.707; }
  const cx = player.x + player.w / 2, cy = player.y + player.h / 2;
  TouchPad.sync(mouse, cx, cy);
  if (TouchPad.moveActive) { vx = TouchPad.mx; vy = TouchPad.my; }
  ArcadeControls.applyAim(mouse, cx, cy);

  // DASH: a burst along the move direction (or the aim, standing still), invulnerable throughout
  const dashKey = !!(keys.ShiftLeft || keys.ShiftRight || keys.MouseDash);
  if (dashKey && !dashHeld && player.dashCd <= 0) {
    const mag = Math.hypot(vx, vy);
    const dx = mag ? vx / mag : Math.cos(player.angle), dy = mag ? vy / mag : Math.sin(player.angle);
    player.dashT = DASH_TIME; player.dashCd = DASH_CD;
    player.dashVx = dx * DASH_SPEED; player.dashVy = dy * DASH_SPEED;
    burst(cx, cy + 10, '#67e8f9', 10);
    sfx.dash();
  }
  dashHeld = dashKey;
  if (player.dashCd > 0) player.dashCd--;

  let mx = vx * player.speed, my = vy * player.speed;
  if (player.dashT > 0) {
    player.dashT--;
    mx = player.dashVx; my = player.dashVy;
    player.trail.push({ x: player.x + player.w / 2, y: player.y + player.h + 4, face: Math.cos(player.angle) < 0 ? -1 : 1, life: 16 });
  }
  const nx = clamp(player.x + mx, 8, W - player.w - 8);
  const ny = clamp(player.y + my, 40, H - player.h - 8);
  if (!insideObstacle(nx, player.y, player.w, player.h)) player.x = nx;
  if (!insideObstacle(player.x, ny, player.w, player.h)) player.y = ny;
  player.angle = Math.atan2(mouse.y - (player.y + player.h / 2 - 22), mouse.x - (player.x + player.w / 2));
  player.moving = !!(vx || vy) || player.dashT > 0;
  if (player.moving) player.walkPhase += 0.32;

  if (player.powerTime > 0 && --player.powerTime === 0) player.powerType = null;
  if (player.shieldT > 0) player.shieldT--;
  player.weapon = ['rapid', 'spread', 'lance'].includes(player.powerType) ? player.powerType : 'dual';
  const firing = (mouse.down || keys.Space) && player.dashT <= 0;
  if (player.weapon === 'lance') updateLance(firing);
  else { lance = null; if (firing && player.fireCooldown <= 0) fire(); }
  if (player.fireCooldown > 0) player.fireCooldown--;
  if (player.recoil > 0) player.recoil--;
  if (player.invuln > 0) player.invuln--;
}

function updateProjectiles() {
  bullets.forEach(b => {
    b.x += b.vx; b.y += b.vy; b.life--; b.age++;
    if (b.x < -10 || b.x > W + 10 || b.y < -10 || b.y > H + 10) { b.dead = true; return; }
    if (insideObstacle(b.x - 2, b.y - 2, 4, 4)) {
      b.dead = true;
      const st = WEAPON_STYLE[b.kind] || WEAPON_STYLE.dual;
      pushImpact(b.x - b.vx * 0.5, b.y - b.vy * 0.5, Math.atan2(b.vy, b.vx), st.mid);
    }
  });
  enemyBolts.forEach(b => {
    if (tick % 2 === 0) { b.trail.push({ x: b.x, y: b.y }); if (b.trail.length > 6) b.trail.shift(); }
    b.x += b.vx; b.y += b.vy; b.life--;
    if (b.x < -10 || b.x > W + 10 || b.y < -10 || b.y > H + 10) b.dead = true;
    else if (insideObstacle(b.x - 2, b.y - 2, 4, 4)) { b.dead = true; pushImpact(b.x, b.y, Math.atan2(b.vy, b.vx), b.color); }
  });
}

function updateDrops() {
  drops.forEach(d => {
    d.bob += 0.08; d.life--;
    if (player.x < d.x + d.w && player.x + player.w > d.x && player.y < d.y + d.h && player.y + player.h > d.y) {
      d.taken = true;
      sfx.power();
      if (d.type === 'shield') player.shieldT = 420;
      else if (d.type === 'banish') {
        triggerShake(12, 22); hitPause = 4; flash = 0.5;
        monsters.forEach(m => damageMonster(m, 1, Math.atan2(m.y - player.y, m.x - player.x)));
        bosses.forEach(b => damageBoss(b, 4));
        shockRings.push({ x: player.x + 13, y: player.y + 20, r: 10, max: 600, speed: 18, life: 34, maxLife: 34, color: '#f59e0b' });
      } else { player.powerType = d.type; player.powerTime = 480; }
      bannerFlash(d.label);
      bannerTime = 40;
    }
  });
  drops = drops.filter(d => !d.taken && d.life > 0);
}

function updateFans() {
  fans.forEach(f => {
    if (--f.screamTimer <= 0) { f.panic = 12; f.screamTimer = 50 + Math.random() * 70; }
    if (f.panic > 0) f.panic--;
    if (f.grabbed && f.grabber) { f.x = f.grabber.x + f.grabber.w / 2 - f.w / 2; f.y = f.grabber.y + f.grabber.h - 4; f.moving = true; return; }
    let near = null, nd = 1e9;
    monsters.forEach(m => { const d = Math.hypot(m.x - f.x, m.y - f.y); if (d < nd) { nd = d; near = m; } });
    let vx = 0, vy = 0;
    if (near && nd < 150) {
      const dx = f.x - near.x, dy = f.y - near.y, d = Math.hypot(dx, dy) || 1;
      vx = dx / d * 1.7; vy = dy / d * 1.7; f.facing = vx < 0 ? -1 : 1;
    } else {
      f.wander = (f.wander || 0) - 1;
      if (f.wander <= 0) { f.wx = (Math.random() - 0.5) * 1.1; f.wy = (Math.random() - 0.5) * 1.1; f.wander = 40 + Math.random() * 60; }
      vx = f.wx; vy = f.wy;
      if (Math.abs(vx) > 0.05) f.facing = vx < 0 ? -1 : 1;
    }
    f.moving = Math.abs(vx) + Math.abs(vy) > 0.15;
    if (f.moving) f.walkPhase = (f.walkPhase || 0) + 0.3;
    const nx = f.x + vx, ny = f.y + vy;
    if (nx > 14 && nx < W - f.w - 14 && !insideObstacle(nx, f.y, f.w, f.h)) f.x = nx;
    if (ny > 44 && ny < H - f.h - 10 && !insideObstacle(f.x, ny, f.w, f.h)) f.y = ny;
  });
}

function updateMonsters() {
  const pcx = player.x + player.w / 2, pcy = player.y + player.h / 2;
  monsters.forEach(m => {
    const prevX = m.x, prevY = m.y;
    m.walkPhase += m.speed * 0.14;
    if (m.hitFlash > 0) m.hitFlash--;
    if (m.lanceCd > 0) m.lanceCd--;
    if (m.lungeCd > 0) m.lungeCd--;

    if ((m.type === 'specter' || m.type === 'archon') && !m.carrying) {
      const pdx = pcx - (m.x + m.w / 2), pdy = pcy - (m.y + m.h / 2), pd = Math.hypot(pdx, pdy) || 1;
      const dir = pd < 170 ? -1 : pd > 260 ? 1 : 0;
      m.x += pdx / pd * m.speed * dir + Math.cos(tick * 0.02 + m.walkPhase) * 0.5;
      m.y += pdy / pd * m.speed * dir;
      if (m.boltCharge > 0) {
        if (--m.boltCharge === 0) {
          const base = Math.atan2(pdy, pdx);
          const offsets = m.type === 'archon' ? (wave >= 9 ? [-0.16, 0, 0.16] : [-0.1, 0.1]) : [0];
          offsets.forEach(o => fireBolt(m.x + m.w / 2, m.y + m.h / 2 - 8, base + o, m.type === 'archon' ? 5 : 4.4, m.color, m.type === 'archon' ? 6 : 5, m.type === 'archon'));
          sfx.bolt();
          m.boltTimer = Math.max(55, 125 + Math.random() * 75 - wave * 3);
        }
      } else if (--m.boltTimer <= 0) m.boltCharge = m.type === 'archon' ? 42 : 32;
    } else if (m.lunge) {
      // hunter: crouch (the tell), then a straight lunge
      if (--m.lunge.t <= 0 && m.lunge.phase === 'crouch') { m.lunge.phase = 'go'; m.lunge.t = 14; }
      else if (m.lunge.phase === 'go') {
        m.x += Math.cos(m.lunge.a) * 6.5; m.y += Math.sin(m.lunge.a) * 6.5;
        if (m.lunge.t <= 0) { m.lunge = null; m.lungeCd = 150; }
      }
    } else {
      let target = null, bestD = 1e12;
      fans.forEach(f => { if (f.grabbed) return; const d = (f.x - m.x) ** 2 + (f.y - m.y) ** 2; if (d < bestD) { bestD = d; target = f; } });
      const pd = Math.hypot(player.x - m.x, player.y - m.y);
      if (pd < 140 && Math.random() < 0.3) target = null;
      if (m.type === 'hunter' && !m.carrying && !target && pd < 170 && m.lungeCd <= 0) {
        m.lunge = { phase: 'crouch', t: 22, a: Math.atan2(player.y - m.y, player.x - m.x) };
      } else if (!m.carrying && target) {
        const dx = target.x - m.x, dy = target.y - m.y, d = Math.hypot(dx, dy) || 1;
        m.x += dx / d * m.speed; m.y += dy / d * m.speed;
        if (d < 22) { target.grabbed = true; target.grabber = m; m.carrying = target; }
      } else if (m.carrying) {
        const edges = [{ x: -40, y: m.y }, { x: W + 40, y: m.y }, { x: m.x, y: -40 }, { x: m.x, y: H + 40 }];
        let nearest = edges[0], nd = 1e9;
        edges.forEach(e => { const d = Math.abs(e.x - m.x) + Math.abs(e.y - m.y); if (d < nd) { nd = d; nearest = e; } });
        const dx = nearest.x - m.x, dy = nearest.y - m.y, d = Math.hypot(dx, dy) || 1;
        m.x += dx / d * m.speed * 1.15; m.y += dy / d * m.speed * 1.15;
        if (m.x < -20 || m.x > W + 20 || m.y < -20 || m.y > H + 20) {
          lost++; sfx.lost();
          const idx = fans.indexOf(m.carrying);
          if (idx > -1) fans.splice(idx, 1);
          m.carrying = null;
          updateHUD();
        }
      } else {
        const dx = player.x - m.x, dy = player.y - m.y, d = Math.hypot(dx, dy) || 1;
        m.x += dx / d * m.speed; m.y += dy / d * m.speed;
      }
    }
    if (!m.carrying && insideObstacle(m.x, m.y, m.w, m.h)) {
      if (!insideObstacle(m.x, prevY, m.w, m.h)) m.y = prevY;
      else if (!insideObstacle(prevX, m.y, m.w, m.h)) m.x = prevX;
      else { m.x = prevX; m.y = prevY; if (m.lunge) m.lunge = null; }
    }
    if (!m.carrying) { m.x = clamp(m.x, 10, W - 40); m.y = clamp(m.y, 40, H - 40); }
  });
}

function updateHazards() {
  const arena = ARENAS[arenaIdx];
  const pcx = player.x + player.w / 2, pcy = player.y + player.h / 2;

  graves.forEach(g => {
    g.t--;
    if (g.state === 'idle' && g.t <= 0) {
      if (graveBudget > 0 && monsters.length > 0 && Math.hypot(g.x - pcx, g.y - pcy) > 110) { g.state = 'crack'; g.t = GRAVE_CRACK; sfx.rumble(); }
      else g.t = 120;
    } else if (g.state === 'crack' && g.t <= 0) {
      g.state = 'open'; g.t = 60;
      const type = g.spawnType || (Math.random() < 0.6 ? 'grunt' : 'horror');
      const mon = spawnMonster(type, g.x - 12, g.y - 20);
      mon.boltTimer = 160;
      if (!g.oneShot) graveBudget--;
      burst(g.x, g.y, '#4ade80', 14);
      sfx.thump();
    } else if (g.state === 'open' && g.t <= 0) {
      if (g.oneShot) g.gone = true; else { g.state = 'idle'; g.t = 260 + Math.random() * 260; }
    }
  });
  graves = graves.filter(g => !g.gone);

  obstacles.forEach(o => {
    if (!o.pulse) return;
    const p = o.pulse;
    if (--p.t > 0) return;
    if (p.phase === 'idle') { p.phase = 'warn'; p.t = SPEAKER_WARN; sfx.thump(); }
    else {
      shockRings.push({ x: o.x + o.w / 2, y: o.y + o.h - 6, r: 12, max: 190, speed: 4.2, life: 44, maxLife: 44, shove: true, color: '#f472b6' });
      triggerShake(4, 8); sfx.thump();
      p.phase = 'idle'; p.t = 220 + Math.random() * 220;
    }
  });

  if (arena.hazard === 'lightning' && !waveDelay && --strikeTimer <= 0) {
    const onFan = fans.length && Math.random() < 0.3 ? fans[Math.floor(Math.random() * fans.length)] : null;
    const tx = onFan ? onFan.x : pcx + player.speed * rnd(-12, 12), ty = onFan ? onFan.y + 20 : pcy + 18 + rnd(-30, 30);
    strikes.push({ x: clamp(tx, 40, W - 40), y: clamp(ty, 60, H - 30), state: 'warn', t: STRIKE_WARN, seed: Math.random() * 1000 });
    strikeTimer = Math.max(90, 190 - wave * 4) + Math.random() * 60;
  }
  strikes.forEach(s => {
    if (--s.t > 0) return;
    if (s.state === 'warn') {
      s.state = 'bolt'; s.t = STRIKE_FLASH;
      flash = Math.max(flash, 0.7);
      triggerShake(10, 14);
      sfx.thunder();
      addScorch(s.x, s.y, 36, '#67e8f9');
      burst(s.x, s.y, '#a5f3fc', 24);
      const inStrike = (x, y) => Math.hypot(x - s.x, (y - s.y) / 0.6) < STRIKE_RADIUS;
      if (inStrike(pcx, player.y + player.h)) hurtPlayer();
      monsters.forEach(m => { if (inStrike(m.x + m.w / 2, m.y + m.h)) damageMonster(m, 3, -Math.PI / 2); });
    } else s.done = true;
  });
  strikes = strikes.filter(s => !s.done);

  shockRings.forEach(r => {
    r.r = Math.min(r.max, r.r + r.speed);
    r.life--;
    const band = e => Math.abs(Math.hypot(e.x - r.x, (e.y - r.y) / 0.75) - r.r) < 16;
    const pc = { x: pcx, y: player.y + player.h };
    if (band(pc)) {
      if (r.hurt && !r.hitPlayer) { if (hurtPlayer()) knockPlayer(r.x, r.y, 36); r.hitPlayer = true; }
      if (r.shove) knockPlayer(r.x, r.y, 5);
    }
    if (r.shove) fans.forEach(f => { if (!f.grabbed && band({ x: f.x, y: f.y + f.h })) { const d = Math.hypot(f.x - r.x, f.y - r.y) || 1; f.x = clamp(f.x + (f.x - r.x) / d * 3, 14, W - 30); f.y = clamp(f.y + (f.y - r.y) / d * 3, 44, H - 30); } });
  });
  shockRings = shockRings.filter(r => r.life > 0);
}

// Characters are drawn tall above their feet: hits count on the whole body.
const bodyHit = (e, x, y, up) => x > e.x - 2 && x < e.x + e.w + 2 && y > e.y - up && y < e.y + e.h;

function collide() {
  bullets.forEach(b => {
    if (b.dead) return;
    const a = Math.atan2(b.vy, b.vx);
    const boss = bosses.find(bs => bossHitBy(bs, b.x, b.y));
    if (boss) { b.dead = true; damageBoss(boss, 1); pushImpact(b.x, b.y, a, (WEAPON_STYLE[b.kind] || WEAPON_STYLE.dual).mid); sfx.hit(); return; }
    const m = monsters.find(o => !o.dead && bodyHit(o, b.x, b.y, 14));
    if (m) { b.dead = true; damageMonster(m, 1, a); }
  });

  fans.forEach(f => {
    if (f.grabbed || f.saved) return;
    if (player.x < f.x + f.w && player.x + player.w > f.x && player.y < f.y + f.h && player.y + player.h > f.y) {
      f.saved = true;
      saved++; rescueChain++;
      score += 300 * Math.min(rescueChain, 5);
      sfx.save();
      burst(f.x + f.w / 2, f.y + f.h / 2, f.color, 12);
      updateHUD();
    }
  });
  fans = fans.filter(f => !f.saved);

  if (player.invuln > 0 || player.dashT > 0 || player.shieldT > 0) return;
  const bolt = enemyBolts.find(b => !b.dead && bodyHit(player, b.x, b.y, 26));
  if (bolt) { bolt.dead = true; pushImpact(bolt.x, bolt.y, Math.atan2(bolt.vy, bolt.vx), bolt.color, true); hurtPlayer(); return; }
  const m = monsters.find(o => !o.dead && player.x < o.x + o.w && player.x + player.w > o.x && player.y < o.y + o.h && player.y + player.h > o.y);
  if (m) { if (hurtPlayer()) knockPlayer(m.x + m.w / 2, m.y + m.h / 2, 30); return; }
  const b = bosses.find(bossTouches);
  if (b && hurtPlayer()) knockPlayer(b.x, b.y - 30, 60);
}

// Cabinet preview pilot: aim at the nearest threat, collect fans when safe.
function attractPilot() {
  const pcx = player.x + player.w / 2, pcy = player.y + player.h / 2;
  let target = null, bd = 1e9;
  monsters.forEach(m => { const d = Math.hypot(m.x - pcx, m.y - pcy); if (d < bd) { bd = d; target = { x: m.x + m.w / 2, y: m.y + m.h / 2 - 8 }; } });
  bosses.forEach(b => { target = { x: b.x, y: b.y - b.h / 2 }; });
  if (target) { mouse.x = target.x; mouse.y = target.y; }
  mouse.down = !!target;
  ['KeyA', 'KeyD', 'KeyW', 'KeyS'].forEach(k => keys[k] = false);
  let goal = null, gd = 1e9;
  fans.forEach(f => { if (f.grabbed) return; const d = Math.hypot(f.x - pcx, f.y - pcy); if (d < gd) { gd = d; goal = f; } });
  if (bd < 110 && target) goal = { x: pcx - (target.x - pcx), y: pcy - (target.y - pcy) };
  if (goal) {
    if (goal.x < pcx - 6) keys.KeyA = true; else if (goal.x > pcx + 6) keys.KeyD = true;
    if (goal.y < pcy - 6) keys.KeyW = true; else if (goal.y > pcy + 6) keys.KeyS = true;
  }
}

function updateHUD() {
  document.getElementById('score').textContent = score;
  document.getElementById('lives').textContent = lives;
  document.getElementById('wave').textContent = wave;
  document.getElementById('saved').textContent = saved;
  document.getElementById('lost').textContent = lost;
  document.getElementById('best').textContent = best;
}

// ---------- Loop ----------
let previousFrame = performance.now(), accumulator = 0;
function loop() {
  const now = performance.now();
  accumulator += Math.min(100, now - previousFrame); previousFrame = now;
  let steps = 0;
  while (accumulator >= 1000 / 60 && steps++ < 6) { update(); accumulator -= 1000 / 60; }
  if (steps >= 6) accumulator = 0;
  draw();
  ArcadeVR.schedule(loop);
}
updateHUD();
if (ATTRACT_MODE) setTimeout(startGame, 0);
loop();
console.log('Spectral Manor Swarm ready — three arenas, two bosses, lasers');
