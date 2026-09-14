// ============================================================
// SPECTRAL MANOR INFESTATION — rules
// Four haunted grounds · Splitting Hauntipede · Four bosses
// Ghost Circuit / Plumbmonkey Media
// Load order: grounds.js → sprites.js → bosses.js → game.js
// ============================================================

const STEP = 1000 / 60;
const ENDING_FRAMES = 150;
const EXTRA_LIFE_EVERY = 12000;
const FIRE_COOLDOWN = 9, RAPID_COOLDOWN = 4;
const POWER_TIME = 600;
const SPAWN_EVERY = { ghost: 210, bug: 120, beetle: 480, moth: 620, scorpion: 760, spider: 400 };
const FIRST_SPAWN = { ghost: 160, bug: 90, beetle: 360, moth: 420, scorpion: 520, spider: 240 };

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
  if (s) o.frequency.linearRampToValueAtTime(Math.max(30, f + s), audioCtx.currentTime + d);
  g.gain.setValueAtTime(v, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + d);
  o.connect(g); g.connect(ArcadeAudio.output(bus));
  o.start(); o.stop(audioCtx.currentTime + d);
}
const later = (ms, fn) => setTimeout(fn, ms);   // sound only — never gameplay
const sfx = {
  bug:      () => { tone(400, 0.06, 'square', 0.05, -150); tone(900, 0.05, 'triangle', 0.03, -300); },
  shoot:    () => tone(1100, 0.045, 'square', 0.035, -600),
  segment:  () => { tone(300, 0.07, 'sawtooth', 0.05, -120); tone(600, 0.05, 'square', 0.03, -200); },
  head:     () => { tone(200, 0.12, 'sawtooth', 0.06, -80); tone(800, 0.08, 'square', 0.04, -400); },
  mushroom: () => tone(500, 0.03, 'triangle', 0.03, -100),
  clang:    () => { tone(1500, 0.04, 'triangle', 0.025, -300); tone(240, 0.05, 'square', 0.02, -60); },
  ghost:    () => { tone(700, 0.08, 'square', 0.05); later(70, () => tone(1000, 0.1, 'square', 0.05)); },
  death:    () => { tone(150, 0.3, 'sawtooth', 0.07, -100); later(150, () => tone(80, 0.4, 'sawtooth', 0.06, -30)); },
  levelUp:  () => { [523, 659, 784, 1047].forEach((f, i) => later(i * 80, () => tone(f, i === 3 ? 0.15 : 0.08))); },
  warning:  () => { [196, 147, 196, 147].forEach((f, i) => later(i * 180, () => tone(f, 0.16, 'sawtooth', 0.05))); },
  blast:    () => { tone(90, 0.35, 'sawtooth', 0.08, -50); tone(160, 0.2, 'square', 0.05, -120); },
  gulp:     () => { tone(320, 0.08, 'sine', 0.06, -220); later(60, () => tone(180, 0.08, 'sine', 0.05, -80)); },
  crack:    () => tone(700, 0.05, 'square', 0.04, -500),
  hiss:     () => tone(1800, 0.22, 'sawtooth', 0.015, -900),
  thud:     () => tone(70, 0.25, 'sine', 0.1, -30),
  spit:     () => tone(500, 0.1, 'triangle', 0.04, 300),
  bubble:   () => { [300, 420, 540].forEach((f, i) => later(i * 70, () => tone(f, 0.06, 'sine', 0.04, 200))); },
  lash:     () => { tone(140, 0.15, 'sawtooth', 0.07, -80); tone(900, 0.05, 'square', 0.03, -700); },
  open:     () => tone(400, 0.15, 'triangle', 0.04, 400),
  scream:   () => { tone(900, 0.5, 'sawtooth', 0.04, -500); tone(1300, 0.4, 'square', 0.02, -800); },
  splash:   () => tone(620, 0.06, 'triangle', 0.03, -400),
  hatch:    () => tone(250, 0.1, 'square', 0.05, 300),
  spore:    () => tone(220, 0.25, 'sine', 0.04, -120),
  bossHit:  () => tone(260, 0.05, 'square', 0.04, -90),
  bossDie:  () => { tone(60, 0.8, 'sawtooth', 0.09, -20); [392, 330, 262, 196].forEach((f, i) => later(i * 110, () => tone(f, 0.2, 'square', 0.05))); },
  pickup:   () => { [660, 880, 1320].forEach((f, i) => later(i * 50, () => tone(f, 0.07, 'triangle', 0.05))); },
  extra:    () => { [523, 784, 1047, 1568].forEach((f, i) => later(i * 70, () => tone(f, 0.1, 'triangle', 0.05))); }
};

// ---------- Music: a creeping bass line, transposed per ground; the boss doubles it ----------
let musicTimer = null, musicStep = 0;
const BASS = [110, 0, 130.81, 0, 146.83, 0, 130.81, 0, 110, 0, 164.81, 0, 146.83, 0, 130.81, 123.47];
const GROUND_KEY = [1, 1.189, 0.891, 1.122];
function musicTick() {
  if (!gameRunning || paused || dying || ending || !audioCtx) return;
  const fast = !!boss;
  if (!fast && musicStep % 2) { musicStep++; return; }
  const i = (musicStep >> (fast ? 0 : 1)) % BASS.length, k = GROUND_KEY[groundIdx];
  if (BASS[i]) tone(BASS[i] * k, 0.2, 'triangle', 0.035, 0, 'music');
  if (i % 4 === 0) tone((BASS[i] || 110) * 4 * k, 0.07, 'square', 0.01, 0, 'music');
  musicStep++;
}
function startMusic() { if (!musicTimer) musicTimer = setInterval(musicTick, 130); }

// ---------- State ----------
let score = 0, lives = 3, tick = 0, playT = 0;
let gameRunning = false, gameOver = false, paused = false;
let groundIdx = 0, levelIdx = 0, cycle = 0, cycleMult = 1;
let phase = 'intro', phaseT = 0, clearBonus = 0;
let keys = {};
let mushrooms = {};   // "c,r" -> hp (4..1)
let poisoned = {};    // "c,r" -> true: a scorpion walked over it
let puffs = {};       // "c,r" -> true: a puffball (pops in one hit, releases spores)
let blocks = {};      // "c,r" -> { type: 'stone'|'pumpkin'|'lantern'|'trap', ... }
let waterRows = [], lilies = [];
let segments = [], hauntipedeLen = 12;
let bullets = [], critters = [], eggs = [], spores = [], webs = [], acids = [], pickups = [], blasts = [];
let particles = [], shockwaves = [], popups = [];
let spawnT = {};
let boss = null;
let dying = 0, readyT = 0, ending = 0, nextLife = EXTRA_LIFE_EVERY;
let power = null, powerTime = 0, fireCd = 0, muzzle = 0, shakeAmt = 0;
let backdrop = null;

const player = { x: W / 2, y: H - 50, speed: 4.4, slowed: false };

function ground() { return GROUNDS[groundIdx]; }
function isBossLevel() { return levelIdx === LEVELS_PER_GROUND - 1; }
function levelDef() { const G = ground(); return isBossLevel() ? G.boss : G.levels[levelIdx]; }
function levelNumber() { return groundIdx * LEVELS_PER_GROUND + levelIdx + 1; }
function levelLabel() { return `${groundIdx + 1}-${levelIdx + 1}`; }
function isAttract() { return typeof Arcade !== 'undefined' && Arcade.attract; }

// ---------- Effects ----------
function explode(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    particles.push({ x, y, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6, life: 18 + Math.random() * 14, color, size: 2 + Math.random() * 3 });
  }
}
function shake(n) { shakeAmt = Math.max(shakeAmt, n); }
function popup(text, x, y, life = 50) { popups.push({ text, x, y, life, max: life }); }
function addScore(n, x, y) {
  score += n;
  if (x !== undefined && n >= 100) popup(String(n), x, y, 45);
  while (score >= nextLife) {
    nextLife += EXTRA_LIFE_EVERY; lives++;
    sfx.extra(); popup('EXTRA LIFE', player.x, player.y - 30, 80);
  }
  updateHUD();
}
function updateFx() {
  particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.vx *= 0.96; p.vy *= 0.96; p.life--; });
  particles = particles.filter(p => p.life > 0);
  shockwaves.forEach(s => { s.r += (s.max - s.r) * 0.2; s.life--; });
  shockwaves = shockwaves.filter(s => s.life > 0);
  popups.forEach(p => { p.y -= 0.6; p.life--; });
  popups = popups.filter(p => p.life > 0);
}

// ---------- Field helpers ----------
function removeToadstool(k) { delete mushrooms[k]; delete poisoned[k]; delete puffs[k]; }
function lilyAt(c, r) { return lilies.some(l => l.row === r && Math.floor(l.x / CELL) === c); }
function makeSpore(x, y, vx, vy) { return { x, y, vx, vy, r: 6, age: 0, life: 300 }; }
function sporeLethal(s) { return s.age > 36 && s.life > 30; }

// ---------- Flow ----------
function startGame() {
  score = 0; lives = 3; tick = 0; playT = 0;
  groundIdx = 0; levelIdx = 0; cycle = 0; cycleMult = 1;
  nextLife = EXTRA_LIFE_EVERY; paused = false; ending = 0; dying = 0; readyT = 0;
  power = null; powerTime = 0; fireCd = 0; shakeAmt = 0;
  particles = []; shockwaves = []; popups = [];
  enterLevel();
  gameRunning = true; gameOver = false;
  document.getElementById('startOverlay').classList.add('hidden');
  startMusic();
  updateHUD();
}

function clearCritters() {
  critters = []; eggs = []; spores = []; webs = []; acids = []; pickups = []; blasts = [];
}

// Build the level's field and scenery. Nothing moves until the title is gone.
function enterLevel() {
  const f = buildField(groundIdx, levelIdx);
  mushrooms = f.mushrooms; puffs = f.puffs; blocks = f.blocks; poisoned = {};
  waterRows = f.water; lilies = f.lilies;
  backdrop = buildBackdrop(groundIdx, f);
  segments = []; bullets = []; boss = null;
  clearCritters();
  player.x = W / 2; player.y = H - 50;
  Object.keys(FIRST_SPAWN).forEach(k => { spawnT[k] = FIRST_SPAWN[k]; });
  phase = 'intro';
  phaseT = introFrames();
  if (isBossLevel()) sfx.warning();
}
function introFrames() { return levelIdx === 0 || isBossLevel() ? 160 : 110; }

function spawnLevel() {
  const d = levelDef();
  if (isBossLevel()) {
    boss = createBoss(d);
    if (d.escort) spawnHauntipede(d.escort);
  } else {
    spawnHauntipede(d.len);
  }
}

function advance() {
  levelIdx++;
  if (levelIdx >= LEVELS_PER_GROUND) {
    levelIdx = 0;
    groundIdx++;
    if (groundIdx >= GROUNDS.length) { groundIdx = 0; cycle++; cycleMult = 1 + cycle * 0.15; }
  }
  enterLevel();
  updateHUD();
}

function checkClear() {
  if (phase !== 'play' || ending || dying) return;
  if (segments.length || boss || eggs.length) return;
  phase = 'clear';
  phaseT = 110;
  const bonus = 150 * levelNumber() * (1 + cycle);
  clearBonus = bonus;
  critters.forEach(e => explode(e.x, e.y, '#e9d5ff', 6));
  clearCritters();
  bullets = [];
  addScore(bonus);
  sfx.levelUp();
}

// ---------- Hauntipede ----------
// No column given: it enters along the top row. With a cell (egg, seed pod),
// a short one hatches there, heading for the middle of the field.
function spawnHauntipede(len, c0, r0) {
  const fromTop = c0 === undefined;
  let dir = 1;
  if (fromTop) { c0 = COLS - 2; r0 = 1; }
  else {
    dir = c0 < COLS / 2 ? 1 : -1;
    c0 = dir > 0 ? Math.max(c0, len - 1) : Math.min(c0, COLS - len);
  }
  const base = Math.min(2.1 + levelNumber() * 0.1, 3.7) * cycleMult;
  for (let i = 0; i < len; i++) {
    segments.push({
      x: cellX(c0 - i * dir), y: cellY(r0), dir, vdir: 1, drop: 0,
      speed: base + Math.random() * 0.45,     // each segment scuttles at its own pace
      head: i === 0, legPhase: Math.random() * Math.PI * 2,
      subPhase: Math.floor(Math.random() * 150), sub: false, diving: false
    });
  }
  hauntipedeLen = Math.max(1, segments.length);
}

// The fewer segments remain, the angrier (faster) the survivors get
function segmentSpeed(s) {
  const fury = 1 + (1 - segments.length / hauntipedeLen) * 0.9;
  return s.speed * Math.max(1, fury);
}

function segmentUpdate(s) {
  if (s.dead) return;
  s.legPhase += 0.35;
  // Poisoned: plunge straight at the player until the bottom of the zone
  if (s.diving) {
    s.sub = false;
    s.y += 6;
    if (s.y >= cellY(ROWS - 2)) { s.diving = false; s.y = cellY(ROWS - 2); s.vdir = -1; }
    return;
  }
  if (s.drop !== 0) {                       // moving one row down (or up in the zone)
    s.sub = false;
    const st = Math.sign(s.drop) * Math.min(3, Math.abs(s.drop));
    s.y += st; s.drop -= st;
    if (s.drop === 0) s.y = cellY(Math.round((s.y - CELL / 2) / CELL));
    return;
  }
  const r = Math.floor(s.y / CELL);
  const wet = waterRows.includes(r);
  // swimming: faster, and underwater (unhittable) for part of every stroke
  s.sub = wet && ((tick + s.subPhase) % 150) < 55;
  s.x += s.dir * segmentSpeed(s) * (wet ? 1.35 : 1);
  const nextC = Math.floor((s.x + s.dir * (CELL / 2 + 2)) / CELL);
  const k = key(nextC, r);
  const edge = nextC < 0 || nextC >= COLS;
  const blk = edge ? null : blocks[k];
  if (blk && blk.type === 'trap' && trapOpen(blk)) { s.eaten = true; blk.gulp = 12; return; }
  if (edge || mushrooms[k] || blk || lilyAt(nextC, r)) {
    // touching a POISONED toadstool sends it plunging at the player
    if (poisoned[k]) { s.diving = true; return; }
    s.dir *= -1;
    if (s.vdir > 0 && r >= ROWS - 2) s.vdir = -1;
    else if (s.vdir < 0 && r <= PLAYER_ZONE_ROW) s.vdir = 1;
    s.drop = CELL * s.vdir;
  }
}

function killSegment(s) {
  if (s.dead) return;
  s.dead = true;
  addScore(s.head ? 100 : 10, s.x, s.y);
  (s.head ? sfx.head : sfx.segment)();
  explode(s.x, s.y, s.head ? ground().pal.head : ground().pal.body, 10);
  // leave a toadstool where it died
  const c = Math.floor(s.x / CELL), r = Math.floor(s.y / CELL), k = key(c, r);
  if (r >= FIELD_TOP && r < PLAYER_ZONE_ROW && c >= 0 && c < COLS && !blocks[k] && !waterRows.includes(r)) mushrooms[k] = 4;
}

// Remove dead/eaten segments; the one behind each gap becomes a new head.
function sweepSegments() {
  if (!segments.some(s => s.dead || s.eaten)) return;
  segments.forEach(s => {
    if (s.eaten && !s.dead) { s.dead = true; addScore(s.head ? 50 : 5); sfx.gulp(); explode(s.x, s.y, '#f43f5e', 8); }
  });
  for (let i = 0; i < segments.length - 1; i++) {
    if (segments[i].dead && !segments[i + 1].dead) segments[i + 1].head = true;
  }
  segments = segments.filter(s => !s.dead);
}

// ---------- Critters ----------
function spawnCritter(kind, x, y) {
  const n = levelNumber(), m = cycleMult, src = ground().source;
  const fromLeft = Math.random() < 0.5;
  let e;
  switch (kind) {
    case 'ghost':      // drifts down from the ground's haunt, curving toward you
      e = { x: src.x + (Math.random() - 0.5) * 40, y: src.y + 20, vx: (Math.random() - 0.5) * 2.2, vy: (0.7 + n * 0.04 + Math.random() * 0.6) * m, r: 16, hurt: 18 };
      break;
    case 'bug': {      // scarab ("flea"): crawls down through the field seeding toadstools
      const fromSrc = Math.random() < 0.4;
      e = { x: fromSrc ? src.x + (Math.random() - 0.5) * 50 : 30 + Math.random() * (W - 60), y: -14, vy: (1.6 + n * 0.06 + Math.random()) * m, r: 12, hurt: 15 };
      break;
    }
    case 'beetle':     // grave beetle: sprints across the zone, forcing vertical dodges
      e = { x: fromLeft ? -16 : W + 16, y: ZONE_Y + CELL + Math.random() * (H - ZONE_Y - CELL - 30), vx: (fromLeft ? 1 : -1) * (1.7 + n * 0.04) * m, r: 12, hurt: 15 };
      break;
    case 'moth':       // wisp moth: harmless bonus that drops a power-up
      e = { x: 30 + Math.random() * (W - 60), y: 40 + Math.random() * 120, vx: (Math.random() < 0.5 ? -1 : 1) * (1.4 + Math.random()), vy: 0.8 + Math.random() * 0.8, wing: 0, r: 13, hurt: 0 };
      break;
    case 'scorpion': { // bone scorpion: poisons every toadstool on its row
      let row, tries = 0;
      do row = FIELD_TOP + Math.floor(Math.random() * (FIELD_BOTTOM - FIELD_TOP + 1)); while (waterRows.includes(row) && ++tries < 20);
      e = { x: fromLeft ? -20 : W + 20, y: cellY(row), vx: (fromLeft ? 1 : -1) * (1.5 + n * 0.03) * m, r: 14, hurt: 16 };
      break;
    }
    case 'spider': {   // zone spider: bounces through the zone eating toadstools
      const dropped = x !== undefined;
      e = { x: dropped ? x : (fromLeft ? -20 : W + 20), y: dropped ? y : ZONE_Y + 20 + Math.random() * 60,
            vx: (dropped ? (Math.random() < 0.5 ? -1 : 1) : (fromLeft ? 1 : -1)) * (1.6 + n * 0.03) * m,
            vy: 2.6 * m, r: 14, hurt: 15, falling: dropped };
      break;
    }
  }
  e.kind = kind; e.t = Math.random() * 6; e.legPhase = 0;
  if (x !== undefined && kind !== 'spider') { e.x = x; e.y = y; }
  critters.push(e);
  return e;
}

function spawnCritters() {
  const roster = levelDef().roster || {};
  Object.keys(SPAWN_EVERY).forEach(kind => {
    const max = roster[kind] || 0;
    if (!max || --spawnT[kind] > 0) return;
    const have = critters.reduce((n, e) => n + (e.kind === kind ? 1 : 0), 0);
    if (have < max) spawnCritter(kind);
    spawnT[kind] = Math.max(40, SPAWN_EVERY[kind] * (0.7 + Math.random() * 0.6) / cycleMult);
  });
}

function updateCritters() {
  for (const e of critters) {
    e.t += 0.06; e.legPhase += 0.4;
    const c = Math.floor(e.x / CELL), r = Math.floor(e.y / CELL), k = key(c, r);
    switch (e.kind) {
      case 'ghost':
        e.x += e.vx + Math.sin(e.t) * 0.8; e.y += e.vy;
        e.vx = Math.max(-2.4, Math.min(2.4, e.vx + (player.x > e.x ? 0.015 : -0.015)));
        if (mushrooms[k] && Math.random() < 0.1) removeToadstool(k);
        if (e.y > H + 30 || e.x < -40 || e.x > W + 40) e.gone = true;
        break;
      case 'bug':
        e.t += 0.02;
        e.y += e.vy; e.x += Math.sin(e.t) * 1.6;
        if (r >= FIELD_TOP && r < PLAYER_ZONE_ROW && c >= 0 && c < COLS && Math.random() < 0.03 &&
            !mushrooms[k] && !blocks[k] && !waterRows.includes(r)) mushrooms[k] = 4;
        if (e.y > H + 20) e.gone = true;
        break;
      case 'beetle':
        e.x += e.vx; e.legPhase += 0.1;
        if (e.x < -30 || e.x > W + 30) e.gone = true;
        break;
      case 'moth':
        e.wing += 0.5; e.t += 0.03;
        e.x += e.vx + Math.sin(e.t * 1.7) * 1.8;
        e.y += e.vy * Math.sin(e.t) * 0.9 + 0.25;
        if (e.x < 12) { e.x = 12; e.vx = Math.abs(e.vx); }
        if (e.x > W - 12) { e.x = W - 12; e.vx = -Math.abs(e.vx); }
        if (e.y > ZONE_Y) e.gone = true;
        break;
      case 'scorpion':
        e.x += e.vx;
        if (mushrooms[k]) poisoned[k] = true;
        if (e.x < -40 || e.x > W + 40) e.gone = true;
        break;
      case 'spider':
        if (e.falling) { e.y += 4; if (e.y >= ZONE_Y + 30) e.falling = false; break; }
        e.x += e.vx; e.y += e.vy;
        if (e.y < ZONE_Y - 40) e.vy = Math.abs(e.vy);
        if (e.y > H - 16) e.vy = -Math.abs(e.vy);
        if (Math.random() < 0.02) e.vy = (Math.random() < 0.5 ? -1 : 1) * (1.8 + Math.random() * 2) * cycleMult;
        if (mushrooms[k] && r >= PLAYER_ZONE_ROW - 3) removeToadstool(k);
        if (e.x < -40 || e.x > W + 40) e.gone = true;
        break;
    }
  }
  critters = critters.filter(e => !e.gone);
}

function killCritter(e) {
  if (e.gone) return;
  e.gone = true;
  switch (e.kind) {
    case 'ghost': addScore(300, e.x, e.y); sfx.ghost(); explode(e.x, e.y, '#67e8f9', 16); break;
    case 'bug': addScore(200, e.x, e.y); sfx.bug(); explode(e.x, e.y, '#4ade80', 12); break;
    case 'beetle': addScore(250, e.x, e.y); sfx.bug(); explode(e.x, e.y, '#f59e0b', 12); break;
    case 'moth':
      addScore(500, e.x, e.y); sfx.ghost(); explode(e.x, e.y, '#fde68a', 14);
      pickups.push({ x: e.x, y: e.y, type: Math.random() < 0.5 ? 'rapid' : 'spread', t: 0, life: 540 });
      break;
    case 'scorpion': addScore(1000, e.x, e.y); sfx.head(); explode(e.x, e.y, '#e2e8f0', 18); break;
    case 'spider': {   // the closer it was to you, the more it's worth (Centipede rules)
      const d = Math.hypot(e.x - player.x, e.y - player.y);
      addScore(d < 70 ? 900 : d < 140 ? 600 : 300, e.x, e.y);
      sfx.bug(); explode(e.x, e.y, '#f97316', 14);
      break;
    }
  }
}

// ---------- Eggs, hazards, pickups, lantern blasts ----------
function layEgg(c, r) {
  if (eggs.some(e => e.c === c && e.r === r)) return;
  removeToadstool(key(c, r));
  eggs.push({ c, r, x: cellX(c), y: cellY(r), hp: 2, t: 330 });
  sfx.hatch();
}
function updateEggs() {
  for (const e of eggs) {
    if (!e.gone && --e.t <= 0) {
      e.gone = true;
      spawnHauntipede(4, e.c, e.r);
      explode(e.x, e.y, '#f5f5f4', 10);
      sfx.hatch();
    }
  }
  eggs = eggs.filter(e => !e.gone);
}

function updateHazards() {
  spores.forEach(s => {
    s.age++; s.life--;
    s.x += s.vx + Math.sin(s.age * 0.05) * 0.4; s.y += s.vy;
    s.r = Math.min(30, s.r + 0.8);
    if (s.y > H + 30) s.life = 0;
  });
  spores = spores.filter(s => s.life > 0);
  webs.forEach(w => w.life--);
  webs = webs.filter(w => w.life > 0);
  acids.forEach(a => { a.age++; a.life--; });
  acids = acids.filter(a => a.life > 0);
  lilies.forEach(l => {
    l.x += l.vx; l.spin += l.vx * 0.01;
    if (l.bump > 0) l.bump--;
    if (l.x < -14) l.x += W + 28;
    if (l.x > W + 14) l.x -= W + 28;
  });
}

function updatePickups() {
  for (const p of pickups) {
    p.t++; p.life--;
    if (p.y < H - 30) p.y += 1.6;
    if (Math.hypot(p.x - player.x, p.y - player.y) < 24) {
      p.life = 0;
      power = p.type; powerTime = POWER_TIME;
      sfx.pickup();
      popup(p.type === 'rapid' ? 'RAPID FIRE' : 'SPREAD SHOT', p.x, p.y - 16, 60);
    }
  }
  pickups = pickups.filter(p => p.life > 0);
}

// A jack-o'-lantern bursts: clears the 3×3 around it, kills what's close,
// hurts the boss and sets off neighbouring lanterns a moment later.
function lanternBlast(c, r) {
  const x = cellX(c), y = cellY(r);
  delete blocks[key(c, r)];
  shockwaves.push({ x, y, r: 6, max: 72, life: 22, color: '251,146,60' });
  explode(x, y, '#fdba74', 26);
  shake(6); sfx.blast();
  addScore(50);
  for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) {
    const k = key(c + dc, r + dr);
    if (mushrooms[k]) { removeToadstool(k); addScore(5); }
    const b2 = blocks[k];
    if (b2 && b2.type === 'pumpkin') { delete blocks[k]; addScore(25); explode(cellX(c + dc), cellY(r + dr), '#f97316', 10); }
    if (b2 && b2.type === 'lantern' && !b2.lit) { b2.lit = true; blasts.push({ c: c + dc, r: r + dr, t: 8 }); }
  }
  segments.forEach(s => { if (!s.dead && Math.hypot(s.x - x, s.y - y) < 62) killSegment(s); });
  critters.forEach(e => { if (Math.hypot(e.x - x, e.y - y) < 62) killCritter(e); });
  if (boss && !boss.dying && bossNear(boss, x, y, 62)) damageBoss(3, x, y);
}
function updateBlasts() {
  for (const q of blasts) {
    if (--q.t <= 0) { q.done = true; if (blocks[key(q.c, q.r)]) lanternBlast(q.c, q.r); }
  }
  blasts = blasts.filter(q => !q.done);
}

// ---------- Boss ----------
function damageBoss(n, x, y) {
  if (!boss || boss.dying) return;
  boss.hp -= n; boss.flash = 5;
  sfx.bossHit();
  addScore(20 * n);
  explode(x, y, ground().pal.accent, 6);
  if (boss.hp <= 0) {
    boss.hp = 0; boss.dying = 110;
    addScore(2500 * (groundIdx + 1) * (1 + cycle), boss.x, boss.y);
    shake(14); sfx.bossDie();
    if (boss.shots) boss.shots = [];
    if (boss.vines) boss.vines = [];
  }
}
function updateBossDeath(b) {
  if (b.dying % 8 === 0) explode(b.x + (Math.random() - 0.5) * 60, b.y + (Math.random() - 0.5) * 40, ground().pal.accent, 16);
  if (b.type === 'mother' && b.nodes.length && b.dying % 6 === 0) motherShed(b, b.nodes.length - 1);
  if (--b.dying <= 0) {
    shockwaves.push({ x: b.x, y: b.y, r: 10, max: 160, life: 40, color: '255,255,255' });
    explode(b.x, b.y, '#ffffff', 40);
    webs = []; acids = []; spores = [];
    boss = null;
  }
}

// ---------- Player ----------
function movePlayer(auto) {
  player.slowed = webs.some(w => Math.hypot(player.x - w.x, (player.y - w.y) / 0.6) < w.r);
  const sp = player.speed * (player.slowed ? 0.45 : 1);
  let mx = 0, my = 0;
  if (auto) { mx = auto.mx; my = auto.my; }
  else {
    if (keys.ArrowLeft || keys.KeyA) mx -= 1;
    if (keys.ArrowRight || keys.KeyD) mx += 1;
    if (keys.ArrowUp || keys.KeyW) my -= 1;
    if (keys.ArrowDown || keys.KeyS) my += 1;
  }
  player.x = Math.max(14, Math.min(W - 14, player.x + mx * sp));
  player.y = Math.max(ZONE_Y + 10, Math.min(H - 14, player.y + my * sp));
}

function fire(want) {
  if (fireCd > 0) fireCd--;
  if (!want || fireCd > 0) return;
  fireCd = power === 'rapid' ? RAPID_COOLDOWN : FIRE_COOLDOWN;
  const y = player.y - 16;
  bullets.push({ x: player.x, y, vx: 0, vy: -11 });
  if (power === 'spread') bullets.push({ x: player.x, y, vx: -1.7, vy: -10.6 }, { x: player.x, y, vx: 1.7, vy: -10.6 });
  muzzle = 5;
  sfx.shoot();
}

// One shot hits exactly one thing. Creatures are checked before terrain
// because they sit over it.
function hitBullet(b) {
  if (boss && !boss.dying) {
    const res = bossBulletHit(boss, b);
    if (res > 0) { damageBoss(res, b.x, b.y); return true; }
    if (res < 0) { sfx.clang(); explode(b.x, b.y, '#e7e5e4', 3); return true; }
  }
  for (const s of segments) {
    if (!s.dead && !s.sub && Math.hypot(b.x - s.x, b.y - s.y) < 13) { killSegment(s); return true; }
  }
  for (const e of eggs) {
    if (!e.gone && Math.hypot(b.x - e.x, b.y - e.y) < 12) {
      if (--e.hp <= 0) { e.gone = true; addScore(50); explode(e.x, e.y, '#f5f5f4', 10); sfx.crack(); }
      else sfx.clang();
      return true;
    }
  }
  for (const e of critters) {
    if (!e.gone && Math.hypot(b.x - e.x, b.y - e.y) < e.r) { killCritter(e); return true; }
  }
  const c = Math.floor(b.x / CELL), r = Math.floor(b.y / CELL), k = key(c, r);
  const blk = blocks[k];
  if (blk) {
    if (blk.type === 'stone') { sfx.clang(); explode(b.x, b.y, '#94a3b8', 3); }
    else if (blk.type === 'trap') {
      if (trapOpen(blk)) { sfx.gulp(); blk.gulp = 10; }
      else { sfx.clang(); explode(b.x, b.y, '#86efac', 3); }
    } else if (blk.type === 'pumpkin') {
      explode(b.x, b.y, '#fb923c', 4); sfx.mushroom(); addScore(2);
      if (--blk.hp <= 0) { delete blocks[k]; addScore(25); explode(cellX(c), cellY(r), '#f97316', 14); sfx.crack(); }
    } else if (blk.type === 'lantern') {
      explode(b.x, b.y, '#fde68a', 4);
      if (--blk.hp <= 0) lanternBlast(c, r); else sfx.mushroom();
    }
    return true;
  }
  if (lilies.some(l => l.row === r && Math.abs(l.x - b.x) < 13)) { sfx.splash(); explode(b.x, b.y, '#86efac', 3); return true; }
  if (mushrooms[k]) {
    const puff = puffs[k];
    mushrooms[k] = puff ? 0 : mushrooms[k] - 1;   // a puffball pops on the first hit
    sfx.mushroom();
    explode(b.x, b.y, poisoned[k] ? POISON.glow : ground().pal.glow, 3);
    if (mushrooms[k] <= 0) {
      removeToadstool(k);
      addScore(5);
      if (puff) { spores.push(makeSpore(cellX(c), cellY(r), (Math.random() - 0.5) * 0.4, 0.55)); sfx.spore(); }
    } else addScore(1);
    return true;
  }
  return false;
}

function resolveBullets() {
  for (const b of bullets) {
    b.x += b.vx; b.y += b.vy;
    if (b.y < -10 || b.x < -10 || b.x > W + 10) { b.dead = true; continue; }
    if (hitBullet(b)) b.dead = true;
  }
  bullets = bullets.filter(b => !b.dead);
}

function checkPlayerHits() {
  if (dying || readyT > 0 || phase !== 'play') return;
  const px = player.x, py = player.y;
  if (segments.some(s => Math.hypot(s.x - px, s.y - py) < 16)) return loseLife();
  for (const e of critters) {
    if (e.hurt && !e.falling && Math.hypot(e.x - px, e.y - py) < e.hurt) { e.gone = true; return loseLife(); }
  }
  if (boss && !boss.dying && bossTouches(boss, px, py, 10)) return loseLife();
  if (spores.some(s => sporeLethal(s) && Math.hypot(s.x - px, s.y - py) < s.r * 0.7)) return loseLife();
  if (acids.some(a => a.age >= a.warm && a.life > 20 && Math.hypot(a.x - px, (a.y - py) / 0.5) < a.r * 0.85)) return loseLife();
}

function loseLife() {
  if (dying || ending || readyT > 0 || phase !== 'play') return;
  lives--;
  sfx.death();
  explode(player.x, player.y, '#c084fc', 30);
  shake(10);
  power = null; powerTime = 0; bullets = [];
  dying = 70;
  // The last life: don't open the initials prompt on the death frame — held
  // WASD keys would type into it. Play a GAME OVER beat first.
  if (lives <= 0) { lives = 0; ending = ENDING_FRAMES; }
  updateHUD();
}

function respawn() {
  // Classic Centipede: the damaged field is restored for points
  let restored = 0;
  Object.keys(mushrooms).forEach(k => {
    if (mushrooms[k] < 4 || poisoned[k]) { mushrooms[k] = 4; delete poisoned[k]; restored++; }
  });
  if (restored) { addScore(restored * 5); popup(`FIELD RESTORED +${restored * 5}`, W / 2, ZONE_Y - 20, 70); }
  // survivors regroup at the top as one hauntipede of the same length
  const survivors = segments.length;
  segments = [];
  if (survivors) spawnHauntipede(survivors);
  critters = []; eggs = []; spores = []; acids = []; webs = []; blasts = []; bullets = [];
  if (boss) bossRetreat(boss);
  player.x = W / 2; player.y = H - 50;
  readyT = 60;
}

const ENDING_OVERLAY = (finalScore, reached) => `
  <h2>THE MANOR IS OVERRUN</h2>
  <p>Final Score: ${finalScore}</p>
  <p>Reached ${reached}</p>
  <p style="margin-top:0.8rem; color:#a78bfa; font-size:0.8rem; letter-spacing:1px">TOP EXTERMINATORS</p>
  ${typeof Arcade !== 'undefined' ? Arcade.boardHTML(Arcade.slug) : ''}
  <p style="margin-top:0.8rem; opacity:0.8">Click or ENTER to try again</p>
`;
function finishGame() {
  gameOver = true; gameRunning = false;
  Object.keys(keys).forEach(k => { keys[k] = false; });
  const finalScore = score;
  const reached = `${ground().name.replace('THE ', '').toLowerCase().replace(/\b\w/g, m => m.toUpperCase())} · level ${levelLabel()}${cycle ? ` · cycle ${cycle + 1}` : ''}`;
  const finish = () => {
    const ov = document.getElementById('startOverlay');
    ov.classList.remove('hidden');
    ov.innerHTML = ENDING_OVERLAY(finalScore, reached);
  };
  if (typeof Arcade !== 'undefined') Arcade.submitFlow(finalScore, finish); else finish();
}

// Attract-mode pilot for the hub's cabinet preview: stay under the nearest
// target, fire constantly, sidestep anything close in the zone.
function autopilot() {
  const targets = segments.filter(s => !s.sub).concat(critters);
  if (boss && !boss.dying) targets.push(boss);
  let tx = W / 2, best = 1e9;
  targets.forEach(t => {
    const d = Math.abs(t.x - player.x) + (H - t.y) * 0.4;
    if (d < best) { best = d; tx = t.x; }
  });
  let mx = Math.abs(tx - player.x) > 6 ? Math.sign(tx - player.x) : 0, my = player.y < H - 40 ? 1 : 0;
  const threats = segments.concat(critters.filter(e => e.hurt));
  const danger = threats.find(t => t.y > ZONE_Y - 30 && Math.hypot(t.x - player.x, t.y - player.y) < 80);
  if (danger) { mx = Math.sign(player.x - danger.x) || 1; my = danger.y < player.y ? 1 : -1; }
  return { mx, my, fire: true };
}

// ---------- Input ----------
window.addEventListener('keydown', e => {
  initAudio();
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.code === 'Enter' && !e.repeat && !gameRunning) startGame();
  if ((e.code === 'KeyP' || e.code === 'Escape') && !e.repeat && gameRunning) paused = !paused;
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
window.addEventListener('blur', () => { if (gameRunning && !isAttract()) paused = true; });
document.getElementById('startOverlay').addEventListener('click', () => {
  initAudio();
  if (!gameRunning) startGame();
});
canvas.addEventListener('click', () => { if (paused) paused = false; });

// ---------- Update (one fixed 60 Hz step) ----------
function update() {
  tick++;
  if (!gameRunning || paused) return;
  updateFx();
  shakeAmt *= 0.85;
  if (muzzle > 0) muzzle--;
  if (ending > 0) { if (--ending === 0) finishGame(); return; }
  if (dying > 0) { if (--dying === 0) respawn(); return; }
  // The action never runs under a level title.
  if (phase === 'intro') { if (--phaseT <= 0) { spawnLevel(); phase = 'play'; } return; }
  if (phase === 'clear') { if (--phaseT <= 0) advance(); return; }
  if (readyT > 0) { readyT--; return; }

  playT++;
  if (powerTime > 0 && --powerTime === 0) power = null;
  const auto = isAttract() ? autopilot() : null;
  movePlayer(auto);
  fire(auto ? auto.fire : keys.Space);

  updateHazards();
  segments.forEach(segmentUpdate);
  if (boss) { if (boss.dying) updateBossDeath(boss); else updateBoss(boss); }
  updateCritters();
  spawnCritters();
  updateEggs();
  updatePickups();
  updateBlasts();
  resolveBullets();
  sweepSegments();
  blocksTick();
  checkPlayerHits();
  checkClear();
}
function blocksTick() {
  for (const k in blocks) if (blocks[k].gulp > 0) blocks[k].gulp--;
}

// ---------- Draw ----------
function draw() {
  ctx.save();
  if (shakeAmt > 0.5) ctx.translate((Math.random() - 0.5) * shakeAmt, (Math.random() - 0.5) * shakeAmt);
  if (backdrop) ctx.drawImage(backdrop, 0, 0);
  else { ctx.fillStyle = '#07040f'; ctx.fillRect(0, 0, W, H); }
  drawAmbient();
  webs.forEach(drawWeb);
  acids.forEach(drawAcid);
  for (const k in blocks) { const [c, r] = k.split(',').map(Number); drawBlock(c, r, blocks[k]); }
  lilies.forEach(drawLily);
  for (const k in mushrooms) { const [c, r] = k.split(',').map(Number); drawToadstool(c, r, mushrooms[k], poisoned[k], puffs[k]); }
  eggs.forEach(drawEgg);
  segments.forEach(drawSegment);
  if (boss && !(boss.dying && (boss.dying >> 2) % 2)) drawBoss(boss);
  critters.forEach(drawCritter);
  spores.forEach(drawSpore);
  drawFog();

  ctx.fillStyle = '#00ffaa'; ctx.shadowColor = '#00ffaa'; ctx.shadowBlur = 8;
  bullets.forEach(b => ctx.fillRect(b.x - 2, b.y - 7, 4, 12));
  ctx.shadowBlur = 0;
  pickups.forEach(drawPickup);

  const blink = readyT > 0 && Math.floor(readyT / 5) % 2 === 0;
  if (gameRunning && !dying && !ending && !blink) drawPlayer(player.x, player.y, muzzle, power, player.slowed);

  particles.forEach(p => {
    ctx.globalAlpha = Math.max(0, p.life / 30);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
  });
  ctx.globalAlpha = 1;
  shockwaves.forEach(s => {
    ctx.strokeStyle = `rgba(${s.color},${s.life / 40})`; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.stroke();
  });
  ctx.font = 'bold 13px "Segoe UI", system-ui, sans-serif'; ctx.textAlign = 'center';
  popups.forEach(p => {
    ctx.globalAlpha = Math.min(1, p.life / 20);
    ctx.fillStyle = '#fef9c3'; ctx.fillText(p.text, p.x, p.y);
  });
  ctx.globalAlpha = 1;
  ctx.restore();

  if (!gameRunning && !gameOver) return;
  if (boss) drawBossBar(boss);
  drawHudOverlay(`${ground().name} · ${isBossLevel() ? 'BOSS' : 'LEVEL ' + levelLabel()}${cycle ? ` · CYCLE ${cycle + 1}` : ''}`, power, powerTime);

  if (ending) {
    drawBanner('GAME OVER', `Final score ${score.toLocaleString()}`, Math.min(1, (ENDING_FRAMES - ending) / 30));
  } else if (phase === 'intro') {
    const fade = Math.min(1, phaseT / 25, (introFrames() - phaseT) / 20);
    const G = ground(), d = levelDef();
    if (isBossLevel()) drawBanner('WARNING · ' + d.name, d.sub, fade * ((tick >> 5) % 2 ? 1 : 0.7));
    else if (levelIdx === 0) drawBanner((cycle ? `CYCLE ${cycle + 1} · ` : '') + G.name, G.sub, fade);
    else drawBanner(`LEVEL ${levelLabel()}`, G.name, fade);
  } else if (phase === 'clear') {
    drawBanner(isBossLevel() ? 'GROUND CLEARED' : 'HAUNTIPEDE CLEARED', `+${clearBonus} bonus`, Math.min(1, phaseT / 20, (110 - phaseT) / 15));
  }
  if (paused) drawBanner('PAUSED', 'P or Esc to resume', 1);
}

function updateHUD() {
  document.getElementById('score').textContent = score;
  document.getElementById('lives').textContent = lives;
  document.getElementById('level').textContent = levelLabel();
}

// ---------- Boot ----------
enterLevel();   // paint the first field so the start screen has scenery behind it

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
console.log('Spectral Manor Infestation ready');
