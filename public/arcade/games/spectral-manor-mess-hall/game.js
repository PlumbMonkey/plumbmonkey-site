// ============================================================
// SPECTRAL MANOR MESS HALL — rules
// Defend the Grand Buffet through four rooms of the manor.
//
// Files (load order): rooms.js (layouts, room art, hazards art)
//   cast.js (hero, monsters, Head Chef, windmill rig) · boss.js (Head Chef rules)
//   render.js (draw pass, food shapes, overlays) · game.js (this)
// Levels: 3 per room. Level 3 of each room is a set piece — a Buffet Rush in
// the Mess Hall and Cold Pantry, the Head Chef in the Kitchen and Banquet Hall.
// After the Banquet Hall the manor loops with tougher monsters.
// ============================================================

const canvas = document.getElementById('gameCanvas');
let ctx = canvas.getContext('2d');       // let: rooms.js briefly swaps it to paint its cache
const W = canvas.width;
const H = canvas.height;
const ATTRACT_MODE = /[?&]attract\b/.test(location.search);
if (ATTRACT_MODE) document.body.classList.add('attract');

// ---------- Sound ----------
let audioCtx = null;
function initAudio() {
  if (!audioCtx) audioCtx = ArcadeAudio.context();
  ArcadeAudio.resume();
}
function playTone(freq, dur, type = 'square', vol = 0.07, slide = 0) {
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
const later = (fn, ms) => setTimeout(fn, ms);
const sfx = {
  throw: () => { playNoise(0.16, 0.07, 'bandpass', 400, 2800); playTone(200, 0.07, 'triangle', 0.04, 160); },
  whoosh: () => playNoise(0.3, 0.08, 'bandpass', 300, 3000),
  hit: () => { playNoise(0.16, 0.12, 'lowpass', 1600, 250); playTone(340, 0.08, 'sine', 0.08, -180); later(() => playTone(210, 0.09, 'sine', 0.06, -120), 45); },
  splash: () => { playNoise(0.35, 0.12, 'lowpass', 1200, 150); playTone(160, 0.2, 'sine', 0.07, -90); },
  pickup: () => { playTone(760, 0.05, 'square', 0.05); later(() => playTone(1140, 0.09, 'square', 0.05), 45); },
  power: () => [523, 659, 784, 1047].forEach((f, i) => later(() => playTone(f, 0.08, 'square', 0.05), i * 55)),
  hurt: () => { playNoise(0.3, 0.13, 'lowpass', 2200, 180); playTone(300, 0.12, 'sine', 0.1, -200); playTone(85, 0.28, 'sine', 0.11, -40); },
  level: () => { playNoise(0.22, 0.04, 'bandpass', 400, 3000); playTone(440, 0.08, 'square', 0.07); later(() => playTone(554, 0.08, 'square', 0.07), 70); later(() => playTone(659, 0.12, 'square', 0.08), 140); },
  bell: () => [0, 260].forEach(ms => later(() => { playTone(1320, 0.5, 'sine', 0.07); playTone(1980, 0.3, 'sine', 0.03); }, ms)),
  slam: () => { playNoise(0.5, 0.15, 'lowpass', 900, 80); playTone(70, 0.4, 'sine', 0.13, -30); },
  sizzle: () => playNoise(0.6, 0.04, 'highpass', 3000, 6000),
  crash: () => { playNoise(0.7, 0.14, 'highpass', 1500, 5000); playTone(90, 0.3, 'sine', 0.1, -40); },
  creak: () => playTone(140, 0.5, 'sawtooth', 0.03, -40),
  growl: () => { playTone(90, 0.3, 'sawtooth', 0.06, 40); playNoise(0.25, 0.05, 'lowpass', 600, 200); },
  blink: () => playTone(1200, 0.12, 'triangle', 0.04, -900),
  bossDown: () => { playNoise(0.8, 0.15, 'lowpass', 2000, 100); [392, 523, 659, 784, 1047].forEach((f, i) => later(() => playTone(f, 0.14, 'square', 0.06), 300 + i * 100)); }
};

// ---------- State ----------
const HERO_THROW = 18, MONSTER_THROW = 30, ENDING_FRAMES = 150;
let score = 0, lives = 3, level = 1, ammo = 12, tick = 0;
let gameRunning = false, gameOver = false, paused = false;
let keys = {};
let mouse = { x: W / 2, y: H / 2, down: false };

const BEST_KEY = 'spectralArcade.messhall.best';
function loadBest() { try { return parseInt(localStorage.getItem(BEST_KEY), 10) || 0; } catch (e) { return 0; } }
function saveBest() { try { localStorage.setItem(BEST_KEY, best); } catch (e) {} }
let best = loadBest();
let combo = 0, comboTimer = 0, hitPause = 0, shakeTime = 0, shakeMag = 0, waveDelay = 0;
let bannerText = '', bannerSub = '', bannerTime = 0, introTime = 0;
let ending = 0, endTitle = '', endLine = '';
let roomIdx = 0, pendingRoom = -1, roomFade = 0;
function triggerShake(mag, time) { shakeMag = Math.max(shakeMag * (shakeTime > 0 ? 1 : 0), mag); shakeTime = Math.max(shakeTime, time); }
function comboMult() { return Math.min(1 + Math.floor(combo / 5), 5); }
const roomOf = lv => Math.floor((lv - 1) / 3) % ROOMS.length;
const stageOf = lv => (lv - 1) % 3;
const cycleOf = lv => Math.floor((lv - 1) / (3 * ROOMS.length));
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const player = {
  x: 60, y: H / 2, w: 28, h: 32, speed: 4.2, vx: 0, vy: 0, angle: 0,
  invuln: 0, throwCooldown: 0, walkPhase: 0, throwAnim: 0, throwDur: HERO_THROW, pendingThrow: null,
  nextFood: 'pie', power: null, powerTime: 0, powerShots: 0
};

let foods = [], pickups = [], chefs = [], particles = [], tables = [], splats = [];
let lobs = [], puddles = [], chandeliers = [], boss = null;

const buffet = { x: 405, y: 235, w: 150, h: 60, dishes: 6, maxDishes: 6, flash: 0 };

const FOOD_TYPES = [
  { name: 'pie', color: '#fbbf24', points: 10 },
  { name: 'tomato', color: '#ef4444', points: 15 },
  { name: 'banana', color: '#facc15', points: 12 },
  { name: 'chicken', color: '#fb923c', points: 20 },
  { name: 'cake', color: '#f0abfc', points: 25 },
  { name: 'burger', color: '#f59e0b', points: 18 }
];
const FOOD_BY_NAME = Object.fromEntries(FOOD_TYPES.map(f => [f.name, f]));
function randomFood() { return FOOD_TYPES[Math.floor(Math.random() * FOOD_TYPES.length)]; }

const MONSTERS = {
  vampire: { color: '#9f1239', speed: 1.6, hp: 1 },
  werewolf: { color: '#78716c', speed: 1.8, hp: 2 },
  frank: { color: '#4ade80', speed: 0.9, hp: 3 },
  ghost: { color: '#c4b5fd', speed: 1.4, hp: 1 },
  witch: { color: '#7c3aed', speed: 1.3, hp: 2 }
};
const ROOM_ROSTER = [
  ['vampire', 'ghost', 'frank'],
  ['vampire', 'ghost', 'frank', 'werewolf'],
  ['ghost', 'frank', 'werewolf', 'witch', 'vampire'],
  ['vampire', 'werewolf', 'frank', 'ghost', 'witch']
];

function splatSpot(x, y, color) { spawnSplat(x, y, color); }
function spawnSplat(x, y, color) {
  const blobs = [];
  const n = 4 + Math.floor(Math.random() * 4);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, dist = Math.random() * 12;
    blobs.push({ dx: Math.cos(a) * dist, dy: Math.sin(a) * dist, r: 2 + Math.random() * 5 });
  }
  splats.push({ x, y, color, blobs, life: 240, maxLife: 240 });
  if (splats.length > 60) splats.shift();
}

// ---------- Input ----------
window.addEventListener('keydown', e => {
  initAudio();
  if ((e.code === 'KeyP' || e.code === 'Escape') && !e.repeat && gameRunning && !ending) { paused = !paused; mouse.down = false; Object.keys(keys).forEach(k => keys[k] = false); }
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
canvas.addEventListener('mousedown', () => { if (paused) { paused = false; return; } mouse.down = true; initAudio(); });
canvas.addEventListener('touchstart', () => { if (paused) paused = false; }, { passive: true });
window.addEventListener('mouseup', () => mouse.down = false);
window.addEventListener('blur', () => { Object.keys(keys).forEach(k => keys[k] = false); mouse.down = false; if (gameRunning && !ATTRACT_MODE) paused = true; });
document.getElementById('startOverlay').addEventListener('click', () => { initAudio(); if (!gameRunning) startGame(); });
TouchPad.init(canvas, {
  accent: '#c084fc', aimAccent: '#f0abfc',
  targets: () => chefs,
  onStart: () => { initAudio(); if (!gameRunning) startGame(); }
});

// ---------- Flow ----------
function startGame() {
  score = 0; lives = 3; level = 1; ammo = 12; tick = 0;
  foods = []; pickups = []; chefs = []; particles = []; splats = []; lobs = []; puddles = []; boss = null;
  combo = 0; comboTimer = 0; hitPause = 0; shakeTime = 0; waveDelay = 0; ending = 0; pendingRoom = -1;
  Object.assign(player, { invuln: 0, throwCooldown: 0, throwAnim: 0, throwDur: HERO_THROW, pendingThrow: null, vx: 0, vy: 0, power: null, powerTime: 0, powerShots: 0, nextFood: randomFood().name });
  gameRunning = true; gameOver = false; paused = false;
  document.getElementById('startOverlay').classList.add('hidden');
  enterRoom(0);
  spawnLevel();
  announce();
  updateHUD();
}

function startEnding(title, line) {
  if (ending || !gameRunning) return;
  ending = ENDING_FRAMES; endTitle = title; endLine = line;
  mouse.down = false;
  Object.keys(keys).forEach(k => keys[k] = false);
}

function endGame(title, line) {
  gameOver = true;
  gameRunning = false;
  const newBest = score > best;
  if (newBest) { best = score; saveBest(); }
  const finalScore = score, reached = ROOMS[roomIdx].name;
  if (ATTRACT_MODE) { setTimeout(startGame, 700); return; }
  Arcade.submitFlow(finalScore, () => {
    document.getElementById('startOverlay').classList.remove('hidden');
    document.getElementById('startOverlay').innerHTML = `
      <h2>${title}</h2>
      <p>${line}</p>
      <p style="margin-top:0.3rem">Final Score: ${finalScore} · Level ${level} · ${reached.toLowerCase()}</p>
      <p>Best: ${best}${newBest ? ' &nbsp;<span style="color:#f0abfc; font-weight:bold">NEW BEST!</span>' : ''}</p>
      <p style="margin-top:0.8rem; color:#a78bfa; font-size:0.8rem; letter-spacing:1px">TOP DEFENDERS</p>
      ${Arcade.boardHTML(Arcade.slug)}
      <p style="margin-top:0.8rem; opacity:0.8">Click or ENTER to fight again</p>
    `;
  });
  updateHUD();
}

function announce() {
  const room = ROOMS[roomIdx], stage = stageOf(level), cyc = cycleOf(level);
  if (stage === 2 && room.finale === 'boss') {
    bannerText = 'THE HEAD CHEF';
    bannerSub = roomIdx === 1 ? 'He wants his kitchen back' : 'Round two — in his own banquet hall';
  } else if (stage === 2) {
    bannerText = 'BUFFET RUSH'; bannerSub = 'Thieves everywhere — hold the table!';
  } else if (stage === 0) {
    bannerText = room.name; bannerSub = (cyc ? `Night ${cyc + 1} · ` : '') + room.sub;
  } else {
    bannerText = 'LEVEL ' + level; bannerSub = room.name.toLowerCase();
  }
  bannerTime = 130;
  introTime = bannerTime;
}

function enterRoom(ri) {
  roomIdx = ri;
  const room = ROOMS[ri];
  buffet.x = room.buffet.x; buffet.y = room.buffet.y;
  buffet.dishes = buffet.maxDishes; buffet.flash = 0;   // every room lays out a fresh buffet
  tables = room.obstacles.map((o, i) => Object.assign({}, o, o.kind === 'stove' ? { flare: { phase: 'idle', t: 150 + i * 110 } } : {}));
  tables.push({ kind: 'buffet', x: buffet.x, y: buffet.y, w: buffet.w, h: buffet.h });
  chandeliers = (room.chandeliers || []).map((c, i) => ({ x: c.x, y: c.y, state: 'hung', t: 260 + i * 170, tx: c.x, ty: c.y }));
  splats = []; puddles = []; lobs = []; foods = [];
  player.x = 50; player.y = H / 2 - 16; player.vx = player.vy = 0;
  pushOutOfTables();
  roomFade = 40;
}

function spawnTables() { enterRoom(roomIdx); }   // kept for older callers

function clearSpot(x, y, w, h, safeDistance = 0) {
  const clear = (x, y) => x >= 16 && y >= WALL_H + 6 && x + w <= W - 16 && y + h <= H - 20 &&
    Math.hypot(x + w / 2 - player.x - player.w / 2, y + h / 2 - player.y - player.h / 2) >= safeDistance &&
    !tables.some(t => x < t.x + t.w + 18 && x + w > t.x - 18 && y < t.y + t.h + 18 && y + h > t.y - 18);
  if (clear(x, y)) return { x, y };
  let best = null, distance = Infinity;
  for (let cy = WALL_H + 8; cy < H - h - 20; cy += 24) for (let cx = 16; cx < W - w - 16; cx += 24) {
    const d = Math.hypot(cx - x, cy - y);
    if (clear(cx, cy) && d < distance) { best = { x: cx, y: cy }; distance = d; }
  }
  return best || { x: 16, y: WALL_H + 8 };
}

function spawnMonster(type, x, y, opts = {}) {
  const m = MONSTERS[type], cyc = cycleOf(level);
  const s = clearSpot(x, y, 30, 34, opts.safe === undefined ? 150 : opts.safe);
  const hp = m.hp + Math.floor(level / 5) + cyc;
  const c = {
    x: s.x, y: s.y, w: 30, h: 34, type, color: m.color,
    speed: m.speed + Math.min(level, 12) * 0.07 + cyc * 0.2, hp, maxHp: hp, angle: 0,
    throwTimer: 60 + Math.random() * 90, target: null, aggression: 0.3 + Math.random() * 0.35,
    stealTimer: opts.rush ? 60 + Math.random() * 240 : 300 + Math.random() * 600,
    carryDish: false, walkPhase: Math.random() * 6, throwAnim: 0, throwDur: MONSTER_THROW, pendingThrow: null,
    hurtT: 0, blinkT: 0, pounce: null, pounceCd: 120, burnCd: 0, detour: 0, detourDir: 1
  };
  chefs.push(c);
  return c;
}

function spawnLevel() {
  chefs = []; pickups = [];
  const room = ROOMS[roomIdx], stage = stageOf(level), cyc = cycleOf(level);
  const finale = stage === 2 ? room.finale : null;
  const roster = ROOM_ROSTER[roomIdx];
  let count = Math.min(18, 4 + stage * 2 + roomIdx * 2 + cyc * 3);
  if (finale === 'boss') count = 2 + cyc;
  if (finale === 'rush') count += 2;
  for (let i = 0; i < count; i++) {
    const type = roster[Math.floor(Math.random() * roster.length)];
    spawnMonster(type, 100 + Math.random() * (W - 200), WALL_H + 20 + Math.random() * (H - WALL_H - 110), { rush: finale === 'rush' });
  }
  if (finale === 'boss') boss = createHeadChef(roomIdx === 1 ? 1 : 2);
  for (let i = 0; i < 10 + stage * 2; i++) spawnPickup(100 + Math.random() * (W - 200), WALL_H + 30 + Math.random() * (H - WALL_H - 110));
  spawnPowerPickup(W / 2 + rnd(-300, 300), rnd(WALL_H + 40, H - 60));
}

function spawnPickup(x, y) {
  ({ x, y } = clearSpot(x, y, 16, 16));
  const t = randomFood();
  pickups.push({ x, y, w: 16, h: 16, type: t.name, color: t.color, points: t.points, bob: Math.random() * Math.PI * 2 });
}
function spawnPowerPickup(x, y) {
  ({ x, y } = clearSpot(x, y, 18, 18));
  const power = ['hotsauce', 'triple', 'bigpie'][Math.floor(Math.random() * 3)];
  pickups.push({ x, y, w: 18, h: 18, power, points: 50, bob: 0, life: 900 });
}

// Push the hero out of any furniture they ended up inside.
function pushOutOfTables() {
  for (const t of tables) {
    if (!(player.x < t.x + t.w && player.x + player.w > t.x && player.y < t.y + t.h && player.y + player.h > t.y)) continue;
    const pcx = player.x + player.w / 2, pcy = player.y + player.h / 2;
    const tcx = t.x + t.w / 2, tcy = t.y + t.h / 2;
    const ox = (player.w / 2 + t.w / 2) - Math.abs(pcx - tcx);
    const oy = (player.h / 2 + t.h / 2) - Math.abs(pcy - tcy);
    if (ox < oy) player.x += pcx < tcx ? -ox : ox;
    else player.y += pcy < tcy ? -oy : oy;
  }
  player.x = clamp(player.x, 10, W - player.w - 10);
  player.y = clamp(player.y, WALL_H - 8, H - player.h - 18);
}

// ---------- Throwing ----------
// the same shoulder the Hero Kit draws, so the food leaves the hand you see
function heroShoulder() { return heroShoulderPoint(player, 0); }
function beginPlayerThrow() {
  if (player.throwAnim > 0 || player.throwCooldown > 0 || ammo <= 0) return;
  player.throwDur = player.power === 'hotsauce' ? 11 : HERO_THROW;
  player.throwAnim = player.throwDur;
  player.pendingThrow = true;
}
// The food leaves the hand at the top of the overhand pitch, in front of and
// above the shoulder.
function heroReleasePoint() { const sh = heroShoulder(); return releasePoint(sh.x, sh.y, player.angle, 17); }
function releasePlayerThrow() {
  const { x: hx, y: hy } = heroReleasePoint();
  const a = Math.atan2(mouse.y - hy, mouse.x - hx);
  const big = player.power === 'bigpie';
  const spreads = player.power === 'triple' ? [-0.2, 0, 0.2] : [0];
  spreads.forEach(o => {
    const t = big ? FOOD_BY_NAME.pie : FOOD_BY_NAME[player.nextFood] || randomFood();
    foods.push({ x: hx, y: hy, vx: Math.cos(a + o) * 9.5, vy: Math.sin(a + o) * 9.5, r: big ? 11 : 7, life: 90, type: t.name, color: t.color, rot: 0, rotSpeed: (Math.random() - 0.5) * 0.5, big });
  });
  ammo--;
  if (big && --player.powerShots <= 0) player.power = null;
  player.nextFood = randomFood().name;
  player.throwCooldown = player.power === 'hotsauce' ? 0 : 5;
  sfx.throw();
  updateHUD();
}
function throwFood() { beginPlayerThrow(); }   // kept for older callers

function monsterShoulder(c) {
  const face = Math.cos(c.angle) < 0 ? -1 : 1;
  // ghosts hover ~6px higher than walkers, so their arms do too
  return { x: c.x + c.w / 2 + face * 9, y: c.y + c.h + 2 - 40 - (c.type === 'ghost' ? 6 : 0) };
}
function releaseMonsterThrow(c) {
  const p = c.pendingThrow;
  c.pendingThrow = null;
  const sh = monsterShoulder(c);
  const { x: hx, y: hy } = releasePoint(sh.x, sh.y, c.angle, 16);
  if (p.potion) {
    lobs.push({ kind: 'potion', x0: hx, y0: hy, tx: p.tx, ty: p.ty, t: 0, dur: 50, arc: 70, radius: 34 });
  } else {
    const big = c.type === 'frank';
    foods.push({ x: hx, y: hy, vx: Math.cos(p.angle) * (big ? 4.4 : p.speed), vy: Math.sin(p.angle) * (big ? 4.4 : p.speed), r: big ? 9 : 6, life: 95, type: p.food.name, color: c.color, rot: 0, rotSpeed: (Math.random() - 0.5) * 0.5, fromChef: true, owner: c, big });
  }
  sfx.throw();
}

// ---------- Damage ----------
function hurtPlayer(line) {
  if (player.invuln > 0 || ending || !gameRunning) return false;
  lives--;
  player.invuln = 70;
  combo = 0; comboTimer = 0;
  hitPause = 5;
  triggerShake(9, 18);
  sfx.hurt();
  createParticles(player.x + 14, player.y + 10, '#f472b6', 14);
  updateHUD();
  if (lives <= 0) startEnding('KITCHEN CLOSED', line);
  return true;
}
function knockPlayer(fromX, fromY, amount) {
  const d = Math.hypot(player.x - fromX, player.y - fromY) || 1;
  player.x = clamp(player.x + (player.x - fromX) / d * amount, 10, W - player.w - 10);
  player.y = clamp(player.y + (player.y - fromY) / d * amount, WALL_H - 8, H - player.h - 18);
  player.vx = player.vy = 0;
}

function damageMonster(c, n, source, fx, fy) {
  if (c.defeated) return;
  c.hp -= n;
  c.hurtT = 10;
  spawnSplat(fx !== undefined ? fx : c.x + 15, fy !== undefined ? fy : c.y + 15, c.color);
  createParticles(c.x + 15, c.y + 10, c.color, 8);
  if (c.hp <= 0) {
    c.defeated = true;
    if (source === 'hero') {
      combo++; comboTimer = 150;
      score += (100 + level * 20) * comboMult();
      hitPause = 2;
    } else score += 60;
    if (c.carryDish) { buffet.dishes++; buffet.flash = 20; score += 150; sfx.level(); }
    triggerShake(3, 8);
    createParticles(c.x + 15, c.y + 15, c.color, 18);
    spawnPickup(c.x, c.y);
    if (Math.random() < 0.07) spawnPowerPickup(c.x + 20, c.y);
    updateHUD();
  } else if (c.type === 'vampire' && Math.random() < 0.7) {
    // vanish in a puff of bats and reappear a stride to the side
    createParticles(c.x + 15, c.y, '#4c1d95', 12);
    const a = Math.random() * Math.PI * 2;
    const s = clearSpot(c.x + Math.cos(a) * 80, c.y + Math.sin(a) * 60, 30, 34, 60);
    c.x = s.x; c.y = s.y; c.blinkT = 12;
    sfx.blink();
  }
}

// ---------- Update ----------
function update() {
  tick++;
  if (!gameRunning || paused) return;
  if (ending > 0) {
    ending--;
    particles.forEach(p => { p.x += p.vx * 0.4; p.y += p.vy * 0.4; p.life--; });
    particles = particles.filter(p => p.life > 0);
    if (ending === 0) endGame(endTitle, endLine);
    return;
  }
  if (hitPause > 0) { hitPause--; return; }
  if (shakeTime > 0) shakeTime--;
  if (bannerTime > 0) bannerTime--;
  if (roomFade > 0) roomFade--;
  if (comboTimer > 0 && --comboTimer === 0) combo = 0;
  if (buffet.flash > 0) buffet.flash--;
  if (waveDelay > 0 && --waveDelay === 0) {
    if (pendingRoom >= 0) { enterRoom(pendingRoom); pendingRoom = -1; }
    spawnLevel();
    announce();
  }
  // Round-start title: the action holds still until the banner has gone,
  // so a new wave never starts fighting underneath the title.
  if (introTime > 0) { introTime--; return; }

  if (ATTRACT_MODE) attractPilot();
  updatePlayer();
  updateFoods();
  updateMonsters();
  if (boss) updateBossFight();
  updateHazards();
  updateLobs();
  collide();

  foods = foods.filter(f => !f.spent && f.life > 0);
  chefs = chefs.filter(c => !c.defeated && !c.escaped);
  pickups = pickups.filter(p => !p.collected && (p.life === undefined || --p.life > 0));
  if (ammo === 0 && !pickups.some(p => !p.power) && gameRunning) spawnPickup(player.x + 48, player.y);

  if (chefs.length === 0 && !boss && gameRunning && waveDelay === 0 && !ending) levelClear();

  pushOutOfTables();
  particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.vx *= 0.96; p.vy *= 0.96; p.life--; });
  particles = particles.filter(p => p.life > 0);
  splats.forEach(s => s.life--);
  splats = splats.filter(s => s.life > 0);
  puddles.forEach(p => p.life--);
  puddles = puddles.filter(p => p.life > 0);
}

function levelClear() {
  const clearedStage = stageOf(level);
  score += 200 * level + buffet.dishes * 50;
  level++;
  sfx.level();
  ammo = Math.min(30, ammo + 6);
  foods = []; lobs = []; player.pendingThrow = null; player.throwAnim = 0; player.invuln = 90;
  const nextRoom = roomOf(level);
  if (clearedStage === 2) {
    pendingRoom = nextRoom;
    bannerText = 'ROOM CLEAR';
    bannerSub = `Next: ${ROOMS[nextRoom].name.toLowerCase()}`;
    waveDelay = 130;
  } else {
    bannerText = 'LEVEL CLEAR';
    bannerSub = `+${buffet.dishes * 50} for ${buffet.dishes} dishes saved`;
    waveDelay = 90;
  }
  bannerTime = 80;
  updateHUD();
}

function updatePlayer() {
  let ix = 0, iy = 0;
  if (keys.ArrowLeft || keys.KeyA) ix = -1;
  if (keys.ArrowRight || keys.KeyD) ix = 1;
  if (keys.ArrowUp || keys.KeyW) iy = -1;
  if (keys.ArrowDown || keys.KeyS) iy = 1;
  if (ix && iy) { ix *= 0.707; iy *= 0.707; }
  const cx = player.x + player.w / 2, cy = player.y + player.h / 2, feet = player.y + player.h;
  TouchPad.sync(mouse, cx, cy);
  if (TouchPad.moveActive) { ix = TouchPad.mx; iy = TouchPad.my; }
  ArcadeControls.applyAim(mouse, cx, cy);

  let sp = player.speed;
  if (puddles.some(pd => Math.hypot(cx - pd.x, (feet - pd.y) / 0.45) < pd.r)) sp *= 0.55;
  const onIce = (ROOMS[roomIdx].ice || []).some(p => cx > p.x && cx < p.x + p.w && feet > p.y && feet < p.y + p.h);
  if (onIce) { player.vx += (ix * sp - player.vx) * 0.035; player.vy += (iy * sp - player.vy) * 0.035; }
  else { player.vx = ix * sp; player.vy = iy * sp; }

  const nx = clamp(player.x + player.vx, 10, W - player.w - 10);
  const ny = clamp(player.y + player.vy, WALL_H - 8, H - player.h - 18);
  let canX = true, canY = true;
  for (const t of tables) {
    if (nx < t.x + t.w && nx + player.w > t.x && player.y < t.y + t.h && player.y + player.h > t.y) canX = false;
    if (player.x < t.x + t.w && player.x + player.w > t.x && ny < t.y + t.h && ny + player.h > t.y) canY = false;
  }
  if (canX) player.x = nx; else player.vx = 0;
  if (canY) player.y = ny; else player.vy = 0;
  if (Math.abs(player.vx) + Math.abs(player.vy) > 0.4) player.walkPhase += 0.28;
  player.angle = Math.atan2(mouse.y - cy, mouse.x - cx);

  if (mouse.down || keys.Space) beginPlayerThrow();
  if (player.throwAnim > 0) {
    player.throwAnim--;
    if (player.pendingThrow && 1 - player.throwAnim / player.throwDur >= WINDMILL_RELEASE) { player.pendingThrow = null; releasePlayerThrow(); }
  } else if (player.throwCooldown > 0) player.throwCooldown--;
  if (player.invuln > 0) player.invuln--;
  if (player.power && player.power !== 'bigpie' && --player.powerTime <= 0) player.power = null;
}

function updateFoods() {
  foods.forEach(f => {
    const oldX = f.x, oldY = f.y;
    f.x += f.vx; f.y += f.vy;
    f.rot = (f.rot || 0) + (f.rotSpeed || 0);
    f.life--;
    for (const t of tables) {
      if (f.x > t.x && f.x < t.x + t.w && f.y > t.y && f.y < t.y + t.h) {
        if (f.bounced) { f.life = 0; spawnSplat(f.x, f.y, f.color); break; }
        f.bounced = true;
        if (oldX <= t.x || oldX >= t.x + t.w) { f.x = oldX; f.vx *= -0.7; }
        else if (oldY <= t.y || oldY >= t.y + t.h) { f.y = oldY; f.vy *= -0.7; }
        else f.life = 0;
        break;
      }
    }
    if (f.x < -20 || f.x > W + 20 || f.y < -20 || f.y > H + 20) f.life = 0;
  });
}

function moveMonster(c, dx, dy) {
  if (c.type === 'ghost') { c.x += dx; c.y += dy; return true; }
  // collide with the lower half of the body, so monsters can stand close behind furniture
  const hit = (x, y) => tables.some(t => x < t.x + t.w && x + c.w > t.x && y + c.h * 0.5 < t.y + t.h && y + c.h > t.y);
  let ok = true;
  if (!hit(c.x + dx, c.y)) c.x += dx; else ok = false;
  if (!hit(c.x, c.y + dy)) c.y += dy; else ok = false;
  return ok;
}

function updateMonsters() {
  const px = player.x + player.w / 2, py = player.y + player.h / 2;
  chefs.forEach((c, ci) => {
    c.walkPhase += c.speed * 0.18;
    if (c.hurtT > 0) c.hurtT--;
    if (c.blinkT > 0) c.blinkT--;
    if (c.burnCd > 0) c.burnCd--;
    if (c.pounceCd > 0) c.pounceCd--;
    if (c.throwAnim > 0) {
      c.throwAnim--;
      if (c.pendingThrow && 1 - c.throwAnim / c.throwDur >= WINDMILL_RELEASE) releaseMonsterThrow(c);
    }

    if (c.carryDish) {                       // sprint for the nearest edge
      const exits = [{ x: -60, y: c.y }, { x: W + 60, y: c.y }, { x: c.x, y: -60 }, { x: c.x, y: H + 60 }];
      let exit = exits[0], ed = 1e9;
      exits.forEach(e2 => { const d = Math.hypot(e2.x - c.x, e2.y - c.y); if (d < ed) { ed = d; exit = e2; } });
      const fdx = exit.x - c.x, fdy = exit.y - c.y, fd = Math.hypot(fdx, fdy) || 1;
      c.x += fdx / fd * c.speed * 1.35;
      c.y += fdy / fd * c.speed * 1.35;
      c.angle = Math.atan2(fdy, fdx);
      if (c.x < -50 || c.x > W + 50 || c.y < -50 || c.y > H + 50) {
        c.escaped = true;
        sfx.hurt();
        triggerShake(5, 10);
        updateHUD();
        if (buffet.dishes <= 0 && !chefs.some(o => o.carryDish && !o.escaped)) startEnding('THE BUFFET IS LOST', 'The monsters took every last dish.');
      }
      return;
    }

    // werewolf: crouch (the tell), then a straight-line pounce
    if (c.pounce) {
      c.pounce.t--;
      if (c.pounce.phase === 'crouch') {
        c.angle = c.pounce.angle;
        if (c.pounce.t <= 0) { c.pounce.phase = 'dash'; c.pounce.t = 16; sfx.growl(); }
      } else {
        moveMonster(c, Math.cos(c.pounce.angle) * 7.5, Math.sin(c.pounce.angle) * 7.5);
        if (c.pounce.t <= 0) { c.pounce = null; c.pounceCd = 220; }
      }
      c.x = clamp(c.x, 10, W - 40); c.y = clamp(c.y, WALL_H - 10, H - 52);
      return;
    }

    c.stealTimer--;
    const raiding = c.stealTimer <= 0 && buffet.dishes > 0;
    let targetX = px - 15, targetY = py - 17, huntingPlayer = true;
    if (raiding) {
      huntingPlayer = false;
      targetX = buffet.x + buffet.w / 2 - 15;
      targetY = buffet.y + buffet.h + 4;
      if (Math.hypot(targetX - c.x, targetY - c.y) < 30) {
        buffet.dishes--;
        buffet.flash = 30;
        c.carryDish = true;
        c.pendingThrow = null; c.throwAnim = 0;
        sfx.pickup();
        updateHUD();
      }
    } else if (Math.random() < c.aggression || c.target) {
      let bestO = null, bestD = 9999;
      chefs.forEach((o, oi) => { if (oi === ci) return; const d = Math.hypot(o.x - c.x, o.y - c.y); if (d < bestD) { bestD = d; bestO = o; } });
      if (bestO && bestD < 350) { targetX = bestO.x; targetY = bestO.y; c.target = bestO; huntingPlayer = false; }
      else c.target = null;
    }

    const dx = targetX - c.x, dy = targetY - c.y, dist = Math.hypot(dx, dy) || 1;
    if (c.type === 'werewolf' && huntingPlayer && c.pounceCd <= 0 && dist < 200 && dist > 50) {
      c.pounce = { phase: 'crouch', t: 34, angle: Math.atan2(dy, dx) };
      return;
    }

    let ang = Math.atan2(dy, dx);
    if (c.detour > 0) { c.detour--; ang += c.detourDir * 1.2; }
    const slow = c.throwAnim > 0 ? 0.3 : 1;
    if (!moveMonster(c, Math.cos(ang) * c.speed * slow, Math.sin(ang) * c.speed * slow) && c.detour <= 0) {
      c.detour = 40; c.detourDir = Math.random() < 0.5 ? -1 : 1;
    }
    c.angle = Math.atan2(dy, dx);
    c.x = clamp(c.x, 10, W - 40);
    c.y = clamp(c.y, WALL_H - 10, H - 52);

    if (!c.pendingThrow) c.throwTimer--;
    if (c.throwTimer <= 0 && dist < 340 && !raiding && !c.pendingThrow && c.throwAnim === 0) {
      if (c.type === 'witch' && huntingPlayer && Math.random() < 0.6) {
        c.pendingThrow = { potion: true, tx: px + player.vx * 20, ty: player.y + player.h + player.vy * 20, food: { name: 'pie' } };
      } else {
        c.pendingThrow = { angle: Math.atan2(dy, dx), speed: 5.2 + Math.random(), food: randomFood() };
      }
      c.throwDur = c.throwAnim = stageOf(level) === 2 ? 26 : MONSTER_THROW;
      c.throwTimer = Math.max(45, 70 + Math.random() * 70 - level * 2);
    }
  });
}

function updateBossFight() {
  updateHeadChef(boss);
  if (headChefTouches(boss) && hurtPlayer('Run down by the Head Chef.')) knockPlayer(boss.x, boss.y - 30, 60);
  if (boss.hp <= 0) {
    score += 4000 * boss.round * (1 + cycleOf(level));
    for (let i = 0; i < 10; i++) spawnSplat(boss.x + rnd(-60, 60), boss.y + rnd(-30, 20), ['#fbbf24', '#f0abfc', '#ef4444', '#fef3c7'][i % 4]);
    createParticles(boss.x, boss.y - 60, '#fafaf9', 40);
    createParticles(boss.x, boss.y - 60, '#fbbf24', 30);
    triggerShake(16, 30);
    sfx.bossDown();
    spawnPowerPickup(boss.x, boss.y);
    bannerText = 'CHEF DEFEATED'; bannerSub = boss.round === 1 ? 'The kitchen is yours — for now' : 'The banquet is saved!'; bannerTime = 140;
    boss = null;
    updateHUD();
  }
}

function inStoveFlames(o, x, y, w, h) {
  return x < o.x + o.w + STOVE_REACH && x + w > o.x - STOVE_REACH && y < o.y + o.h + STOVE_REACH && y + h > o.y - STOVE_REACH;
}

function updateHazards() {
  tables.forEach(o => {
    if (!o.flare) return;
    const f = o.flare;
    f.t--;
    if (f.phase === 'idle' && f.t <= 0) { f.phase = 'warn'; f.t = STOVE_WARN; sfx.sizzle(); }
    else if (f.phase === 'warn' && f.t <= 0) { f.phase = 'fire'; f.t = STOVE_FIRE; sfx.whoosh(); }
    else if (f.phase === 'fire') {
      if (inStoveFlames(o, player.x, player.y, player.w, player.h) && hurtPlayer('Scorched by a stove.')) knockPlayer(o.x + o.w / 2, o.y + o.h / 2, 40);
      chefs.forEach(c => { if (c.type !== 'ghost' && c.burnCd <= 0 && inStoveFlames(o, c.x, c.y, c.w, c.h)) { c.burnCd = 40; damageMonster(c, 1, 'hazard'); } });
      if (f.t <= 0) { f.phase = 'idle'; f.t = STOVE_IDLE + Math.random() * 90; }
    }
  });

  let busy = chandeliers.some(c => c.state === 'warn' || c.state === 'fall');
  chandeliers.forEach(c => {
    c.t--;
    if (c.state === 'hung' && c.t <= 0) {
      if (busy || waveDelay > 0) { c.t = 30; return; }
      busy = true;
      c.state = 'warn'; c.t = CHAND_WARN;
      c.tx = clamp(player.x + player.w / 2 + player.vx * 25, 60, W - 60);
      c.ty = clamp(player.y + player.h + player.vy * 25, WALL_H + 50, H - 40);
      sfx.creak();
    } else if (c.state === 'warn' && c.t <= 0) { c.state = 'fall'; c.t = CHAND_FALL; }
    else if (c.state === 'fall' && c.t <= 0) {
      const inBlast = (x, y) => Math.hypot(x - c.tx, (y - c.ty) / 0.6) < CHAND_RADIUS;
      if (inBlast(player.x + player.w / 2, player.y + player.h)) hurtPlayer('Flattened by a chandelier.');
      chefs.forEach(m => { if (inBlast(m.x + m.w / 2, m.y + m.h)) damageMonster(m, 2, 'hazard'); });
      createParticles(c.tx, c.ty - 10, '#fbbf24', 20);
      createParticles(c.tx, c.ty - 10, '#fef3c7', 14);
      triggerShake(12, 18);
      sfx.crash();
      c.state = 'broken'; c.t = CHAND_BROKEN;
    } else if (c.state === 'broken' && c.t <= 0) { c.state = 'hung'; c.t = 240 + Math.random() * 200; }
  });
}

function updateLobs() {
  lobs.forEach(l => {
    if (++l.t < l.dur) return;
    l.done = true;
    const d = Math.hypot(player.x + player.w / 2 - l.tx, (player.y + player.h - l.ty) / 0.6);
    if (d < l.radius) hurtPlayer(l.kind === 'pie' ? 'Pied by the Head Chef.' : 'Caught in a witch\'s brew.');
    if (l.kind === 'potion') {
      puddles.push({ x: l.tx, y: l.ty, r: 38, life: 320, color: 'rgba(74,222,128,0.5)' });
      createParticles(l.tx, l.ty, '#4ade80', 14);
    } else {
      for (let i = 0; i < 4; i++) spawnSplat(l.tx + rnd(-26, 26), l.ty + rnd(-12, 12), i % 2 ? '#fbbf24' : '#fef3c7');
      createParticles(l.tx, l.ty, '#fbbf24', 20);
      triggerShake(6, 10);
    }
    sfx.splash();
  });
  lobs = lobs.filter(l => !l.done);
}

// Characters are tall and drawn above their feet: food counts as a hit
// anywhere on the body, not just the foot-level movement box.
const bodyHit = (e, x, y, up) => x > e.x && x < e.x + e.w && y > e.y - up && y < e.y + e.h;

function collide() {
  // the hero's food
  foods.forEach(f => {
    if (f.spent || f.fromChef) return;
    if (boss && headChefHit(boss, f)) {
      f.spent = true; spawnSplat(f.x, f.y, f.color); sfx.hit(); score += 25;
      createParticles(f.x, f.y, f.color, 10);
      updateHUD();
      return;
    }
    const c = chefs.find(o => !o.defeated && bodyHit(o, f.x, f.y, 26));
    if (!c) return;
    f.spent = true;
    sfx.hit();
    damageMonster(c, f.big ? 3 : 1, 'hero', f.x, f.y);
    if (f.big) {
      chefs.forEach(o => { if (o !== c && Math.hypot(o.x + 15 - f.x, o.y + 17 - f.y) < 60) damageMonster(o, 1, 'hero'); });
      createParticles(f.x, f.y, '#f0abfc', 20);
      triggerShake(5, 8);
    }
  });

  // monsters catching each other in the crossfire
  foods.forEach(f => {
    if (f.spent || !f.fromChef || !f.owner) return;
    const c = chefs.find(o => !o.defeated && o !== f.owner && bodyHit(o, f.x, f.y, 26));
    if (c) { f.spent = true; damageMonster(c, 1, 'monster', f.x, f.y); }
  });

  // hostile food vs the hero — one splat per food, one life per hit
  if (player.invuln <= 0) {
    const f = foods.find(o => !o.spent && o.fromChef && bodyHit(player, o.x, o.y, 16));
    if (f) { f.spent = true; spawnSplat(f.x, f.y, f.color); hurtPlayer('Splattered by flying food.'); }
  }

  // monster bodies
  if (player.invuln <= 0) {
    const c = chefs.find(o => !o.defeated && player.x < o.x + o.w && player.x + player.w > o.x && player.y < o.y + o.h && player.y + player.h > o.y);
    if (c && hurtPlayer(c.type === 'werewolf' ? 'The werewolf pounced.' : 'A monster caught you in the chaos.')) knockPlayer(c.x, c.y, c.type === 'frank' ? 55 : 32);
  }

  // pickups
  pickups.forEach(p => {
    p.bob += 0.07;
    if (!(player.x < p.x + p.w && player.x + player.w > p.x && player.y < p.y + p.h && player.y + player.h > p.y)) return;
    p.collected = true;
    score += p.points;
    if (p.power) {
      player.power = p.power;
      player.powerTime = 480;
      player.powerShots = p.power === 'bigpie' ? 5 : 0;
      ammo = Math.min(30, ammo + 5);
      bannerText = p.power === 'hotsauce' ? 'HOT SAUCE!' : p.power === 'triple' ? 'TRIPLE THROW!' : 'BIG PIES!';
      bannerSub = p.power === 'hotsauce' ? 'Lightning-fast windmills' : p.power === 'triple' ? 'Three at once' : 'Five giant splash pies';
      bannerTime = 60;
      sfx.power();
    } else {
      ammo = Math.min(30, ammo + 3);
      sfx.pickup();
    }
    createParticles(p.x + 8, p.y + 8, p.color || POWER_COLORS[p.power], 6);
    updateHUD();
  });
}

function createParticles(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    particles.push({ x, y, vx: (Math.random() - 0.5) * 7, vy: (Math.random() - 0.5) * 7, life: 18 + Math.random() * 15, color, size: 2 + Math.random() * 3 });
  }
}

// Cabinet preview: aim at the nearest monster, restock when low.
function attractPilot() {
  const px = player.x + player.w / 2, py = player.y + player.h / 2;
  let target = null, bd = 1e9;
  chefs.forEach(c => { const d = Math.hypot(c.x + 15 - px, c.y + 17 - py); if (d < bd) { bd = d; target = { x: c.x + 15, y: c.y + 5 }; } });
  if (boss) target = { x: boss.x, y: boss.y - 60 };
  if (target) { mouse.x = target.x; mouse.y = target.y; }
  mouse.down = !!target && ammo > 0;
  let goal = null;
  if (ammo < 6) { let pd = 1e9; pickups.forEach(p => { const d = Math.hypot(p.x - px, p.y - py); if (d < pd) { pd = d; goal = p; } }); }
  ['KeyA', 'KeyD', 'KeyW', 'KeyS'].forEach(k => keys[k] = false);
  if (goal) {
    if (goal.x < px - 6) keys.KeyA = true; else if (goal.x > px + 6) keys.KeyD = true;
    if (goal.y < py - 6) keys.KeyW = true; else if (goal.y > py + 6) keys.KeyS = true;
  } else if (target && bd < 150) {
    if (target.x > px) keys.KeyA = true; else keys.KeyD = true;
  }
}

function updateHUD() {
  document.getElementById('score').textContent = score;
  document.getElementById('lives').textContent = lives;
  document.getElementById('level').textContent = level;
  document.getElementById('ammo').textContent = ammo;
  const dishEl = document.getElementById('dishes');
  dishEl.textContent = buffet.dishes;
  dishEl.style.color = buffet.dishes <= 2 ? '#f87171' : '#c084fc';
  document.getElementById('best').textContent = best;
}

// ---------- Loop ----------
enterRoom(0);
let previousFrame = performance.now(), accumulator = 0;
function loop() {
  const now = performance.now();
  accumulator += Math.min(100, now - previousFrame); previousFrame = now;
  while (accumulator >= 1000 / 60) { update(); accumulator -= 1000 / 60; }
  draw();
  ArcadeVR.schedule(loop);
}
updateHUD();
if (ATTRACT_MODE) setTimeout(startGame, 0);
loop();
console.log('Spectral Manor Mess Hall ready — four rooms and the Head Chef');
