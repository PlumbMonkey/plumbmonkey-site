// ============================================================
// SPECTRAL MANOR: SOUL CIRCUIT — rules
// Gather crystals, open the way out, and outrun the hunters.
//
// Files (load order): realms.js · cast.js · bosses.js · render.js · game.js
// Four realms × four levels; every fourth level is a boss. Rules run at a fixed
// 60 Hz (loop()) so high-refresh screens play at the intended speed.
// ============================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

// ---------- Audio ----------
let audioCtx = null;
function initAudio() {
  if (!audioCtx) audioCtx = ArcadeAudio.context();
  ArcadeAudio.resume();
}
function tone(freq, dur, type = 'square', vol = 0.05, slide = 0, bus = 'sfx') {
  if (!audioCtx) return;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, audioCtx.currentTime);
  if (slide) o.frequency.linearRampToValueAtTime(Math.max(20, freq + slide), audioCtx.currentTime + dur);
  g.gain.setValueAtTime(vol, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
  o.connect(g); g.connect(ArcadeAudio.output(bus));
  o.start(); o.stop(audioCtx.currentTime + dur);
}
function noise(dur, vol = 0.05, freq = 900) {
  if (!audioCtx) return;
  const size = Math.floor(audioCtx.sampleRate * dur);
  const buffer = audioCtx.createBuffer(1, size, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
  const src = audioCtx.createBufferSource();
  src.buffer = buffer;
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'bandpass'; filter.frequency.value = freq;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(vol, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
  src.connect(filter); filter.connect(g); g.connect(ArcadeAudio.output('sfx'));
  src.start();
}
const later = (fn, ms) => setTimeout(fn, ms);
let chompFlip = false;
const sfx = {
  chomp: () => { chompFlip = !chompFlip; tone(chompFlip ? 520 : 430, 0.05, 'triangle', 0.035, chompFlip ? 160 : -120); },
  power: () => { noise(0.25, 0.05, 2400); [440, 660, 880, 1175].forEach((f, i) => later(() => tone(f, 0.09, 'square', 0.045), i * 50)); },
  eat: () => { noise(0.12, 0.06, 1400); tone(300, 0.18, 'sawtooth', 0.05, 700); later(() => tone(1000, 0.12, 'triangle', 0.05, -300), 90); },
  dissolve: () => { tone(600, 0.5, 'sine', 0.06, -450); tone(900, 0.4, 'triangle', 0.04, -700); later(() => tone(300, 0.45, 'sine', 0.05, -220), 150); noise(0.5, 0.04, 700); },
  pickup: () => { tone(700, 0.06, 'square', 0.05); later(() => tone(1050, 0.09, 'square', 0.05), 60); noise(0.05, 0.02, 3000); },
  freeze: () => { tone(1200, 0.12, 'sine', 0.05, -500); later(() => tone(800, 0.15, 'sine', 0.04, -400), 90); noise(0.3, 0.03, 5000); },
  life: () => [523, 659, 784, 1047].forEach((f, i) => later(() => tone(f, 0.09, 'triangle', 0.06), i * 70)),
  relic: () => { [784, 988, 1175, 1568].forEach((f, i) => later(() => tone(f, 0.08, 'sine', 0.05), i * 45)); noise(0.1, 0.03, 4000); },
  exit: () => { tone(392, 0.3, 'triangle', 0.06, 392); later(() => tone(587, 0.35, 'triangle', 0.05, 200), 150); },
  win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => later(() => tone(f, 0.1, i === 4 ? 'triangle' : 'square', 0.05), i * 80)),
  lob: () => { noise(0.2, 0.04, 700); tone(260, 0.25, 'triangle', 0.04, 260); },
  boom: () => { noise(0.4, 0.09, 220); tone(90, 0.3, 'sine', 0.08, -50); },
  charge: () => tone(300, 0.4, 'sawtooth', 0.03, 500),
  beam: () => { noise(0.5, 0.08, 1500); tone(140, 0.45, 'sawtooth', 0.06, -60); },
  orbs: () => { tone(880, 0.3, 'sine', 0.05, -400); noise(0.2, 0.03, 2600); },
  swoop: () => { noise(0.4, 0.07, 2000); tone(900, 0.35, 'sawtooth', 0.04, -700); },
  bossHit: () => { noise(0.2, 0.08, 500); tone(160, 0.25, 'square', 0.07, -90); later(() => tone(620, 0.12, 'triangle', 0.05, 300), 60); },
  bossDown: () => { noise(0.9, 0.1, 300); [262, 330, 392, 523, 659, 784].forEach((f, i) => later(() => tone(f, 0.14, 'triangle', 0.06), 200 + i * 90)); },
  portal: () => { tone(500, 0.2, 'sine', 0.05, 700); noise(0.15, 0.03, 3500); },
  crack: () => { noise(0.15, 0.05, 400); tone(70, 0.15, 'square', 0.03, -20); },
  hand: () => { noise(0.25, 0.07, 250); tone(110, 0.2, 'sawtooth', 0.05, 80); },
  howl: () => { tone(420, 0.45, 'sawtooth', 0.04, 260); later(() => tone(680, 0.3, 'sine', 0.03, -220), 200); },
  hex: () => { tone(260, 0.2, 'sine', 0.035, -120); noise(0.12, 0.02, 1800); },
  ready: () => { tone(392, 0.1, 'triangle', 0.05); later(() => tone(523, 0.14, 'triangle', 0.05), 110); },
  gameOver: () => { tone(330, 0.2, 'sawtooth', 0.06, -40); later(() => tone(220, 0.25, 'sawtooth', 0.06, -60), 180); later(() => tone(140, 0.5, 'sawtooth', 0.05, -40), 380); }
};

// ---------- 8-bit background music (A-minor loop, transposed per realm) ----------
let musicTimer = null, musicStep = 0;
const A = 440, C = 523.25, D = 587.33, E = 659.25, F = 698.46, G = 783.99, Ah = 880;
const leadLine = [A, 0, C, 0, E, 0, D, 0, F, 0, E, 0, C, 0, A, 0, G, 0, E, 0, G, 0, Ah, 0, E, 0, D, 0, C, 0, A, 0];
const bassLine = [220, 0, 0, 0, 174.61, 0, 0, 0, 196, 0, 0, 0, 164.81, 0, 0, 0, 220, 0, 0, 0, 174.61, 0, 0, 0, 130.81, 0, 0, 0, 164.81, 0, 0, 0];
const REALM_KEY = [1, 0.8909, 1.1225, 0.8409];
function musicTick() {
  if (!gameRunning || paused || dying > 0 || ready > 0 || ending || levelDelay || !audioCtx) return;
  const k = REALM_KEY[realmOf(level)];
  const n = leadLine[musicStep % leadLine.length];
  if (n) tone(n * k, 0.13, 'square', 0.03, 0, 'music');
  const b = bassLine[musicStep % bassLine.length];
  if (b) tone(b * k, 0.16, 'triangle', 0.045, 0, 'music');
  if (boss && musicStep % 4 === 0) tone(70, 0.1, 'sine', 0.06, -30, 'music');
  musicStep++;
}
function startMusic() { if (!musicTimer) musicTimer = setInterval(musicTick, boss ? 150 : 165); }

// ---------- Tuning ----------
const ENDING_FRAMES = 150, READY_FRAMES = 120, DYING_FRAMES = 75, LEVEL_OUT = 80;
const EXTRA_LIFE_EVERY = 10000;
/* Cornering assists — see the long note in updatePlayer. Corridors are one cell
   (24px) and the Soul's box is 16px, so without them every junction refused a
   turn on 4px of drift. TURN_SLACK stays under the 12px half-cell on purpose. */
const CENTRE_PULL = 1.1, TURN_SLACK = 6;
const SCATTER_FRAMES = 7 * 60, CHASE_FRAMES = 20 * 60;
const PEN_DOOR = { r: PEN.gate.r - 1, c: PEN.gate.c };
const CORNERS = [{ r: -3, c: COLS + 2 }, { r: -3, c: -3 }, { r: ROWS + 2, c: COLS + 2 }, { r: ROWS + 2, c: -3 }];
const DIRS4 = [{ x: 0, y: -1 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 0 }];
const HUNTER_BASE = { vampire: 1.9, witch: 1.75, werewolf: 1.8, frank: 1.35, ghost: 1.15 };
const PEN_SLOTS = [19, 16, 22, 17, 21, 19];
const BEST_KEY = 'spectralArcade.soul.best';

// ---------- State ----------
let score = 0, lives = 3, level = 1, tick = 0, nextLife = EXTRA_LIFE_EVERY;
let gameRunning = false, gameOver = false, paused = false;
let keys = {};
function loadBest() { try { return parseInt(localStorage.getItem(BEST_KEY), 10) || 0; } catch (e) { return 0; } }
function saveBest() { try { localStorage.setItem(BEST_KEY, best); } catch (e) {} }
let best = loadBest();

let maze = null, grid = null, gems = null, gemsLeft = 0, gemsTotal = 0, art = null;
let magicField = 0, fieldMax = 480, eatChain = 0, speedBoost = 0, freezeTime = 0, lantern = 0;
let dying = 0, ready = 0, ending = 0, hitPause = 0, shakeT = 0, shakeMag = 0, levelDelay = 0, levelFade = 0;
let particles = [], popups = [], pickups = [], pickupTimer = 600, hands = [], handTimer = 300, puddles = [];
let relic = null, relicsShown = 0, regrow = [];
let hunters = [], boss = null, bombs = [], beams = [], bossShots = [], bats = [];
let exitOpen = false, exitCell = null, exitPulse = 0;
let bannerText = '', bannerSub = '', bannerTime = 0;
let aiPhase = 0, aiPhaseTimer = SCATTER_FRAMES;

const player = {
  x: 0, y: 0, r: 9, speed: 2.4,
  dir: { x: 0, y: 0 }, nextDir: { x: 0, y: 0 }, face: { x: -1, y: 0 },
  chomp: 0, invuln: 0, portalLock: 0
};

// ---------- Helpers ----------
function cellOf(x, y) { return { r: Math.floor(y / CELL), c: ((Math.floor(x / CELL) % COLS) + COLS) % COLS }; }
function gridAt(r, c) {
  if (r < 0 || r >= ROWS) return WALL;
  if (c < 0 || c >= COLS) { if (!maze.tunnels.has(r)) return WALL; c = (c + COLS) % COLS; }
  return grid[r][c];
}
function walkable(r, c) { return gridAt(r, c) === OPEN && !inPen(r, ((c % COLS) + COLS) % COLS); }
function isWall(x, y) { return gridAt(Math.floor(y / CELL), Math.floor(x / CELL)) !== OPEN; }
function canMove(x, y, r = 8) {
  return !isWall(x - r, y - r) && !isWall(x + r, y - r) && !isWall(x - r, y + r) && !isWall(x + r, y + r);
}
const laneCentre = v => (Math.floor(v / CELL) + 0.5) * CELL;
function easeTo(value, target, step) {
  const delta = target - value;
  return Math.abs(delta) <= step ? target : value + Math.sign(delta) * step;
}
const centreOf = q => ({ x: (q.c + 0.5) * CELL, y: (q.r + 0.5) * CELL });

function addScore(n) {
  score += n;
  while (score >= nextLife) { nextLife += EXTRA_LIFE_EVERY; lives++; sfx.life(); popup(player.x, player.y - 24, '1UP', '#f472b6'); }
  updateHUD();
}
function burst(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    particles.push({ x, y, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4 - 0.5, life: 20 + Math.random() * 20, size: 1.5 + Math.random() * 2.5, color });
  }
}
function popup(x, y, text, color) { popups.push({ x, y, text, color, life: 55 }); }
function shake(mag, t) { shakeMag = Math.max(shakeT > 0 ? shakeMag : 0, mag); shakeT = Math.max(shakeT, t); }
function bannerFlash(text, sub = '') { bannerText = text; bannerSub = sub; bannerTime = 110; }

// ---------- Flow ----------
function startGame() {
  score = 0; lives = 3; level = 1; tick = 0; nextLife = EXTRA_LIFE_EVERY;
  ending = 0; dying = 0; ready = 0; hitPause = 0; paused = false; levelDelay = 0;
  particles = []; popups = [];
  gameRunning = true; gameOver = false;
  document.getElementById('startOverlay').classList.add('hidden');
  loadLevel(1);
  startMusic();
  updateHUD();
}

function loadLevel(lvl) {
  level = lvl;
  maze = generateMaze(lvl);
  grid = maze.grid;
  const placed = placeCrystals(maze, isBossLevel(lvl));
  gems = placed.gems; gemsLeft = gemsTotal = placed.count;
  art = buildMazeArt(maze);
  pickups = []; pickupTimer = 600; relic = null; relicsShown = 0; regrow = [];
  exitOpen = false; exitCell = null; exitPulse = 0;
  handTimer = 300;
  boss = isBossLevel(lvl) ? createBoss(maze.realm.boss, cycleOf(lvl)) : null;
  fieldMax = Math.max(210, 480 - (lvl - 1) * 12 - cycleOf(lvl) * 40);
  lantern = 0;
  resetPositions();
  levelFade = 40;
  ready = READY_FRAMES;
  announce();
  updateHUD();
}

function announce() {
  const R = REALMS[realmOf(level)], cyc = cycleOf(level);
  if (isBossLevel(level)) bannerFlash('WARNING', R.bossName + ' HAUNTS THIS MAZE');
  else if (stageOf(level) === 0) bannerFlash(R.name, (cyc ? `Cycle ${cyc + 1} · ` : '') + R.sub);
  else bannerFlash('LEVEL ' + level, R.name.toLowerCase());
}

function makeHunter(type, idx, r, c, state, releaseT) {
  return {
    type, idx, state, releaseT, base: HUNTER_BASE[type],
    x: (c + 0.5) * CELL, y: (r + 0.5) * CELL, homeY: (r + 0.5) * CELL, tr: r, tc: c,
    dir: { x: idx % 2 ? 1 : -1, y: 0 }, phase: Math.random() * 6,
    scared: false, flash: false, frozen: false, alert: 0, sprint: 0, cool: 120, hexT: 420 + idx * 60, portalLock: 0
  };
}

function resetPositions() {
  Object.assign(player, { x: (START_CELL.c + 0.5) * CELL, y: (START_CELL.r + 0.5) * CELL, dir: { x: 0, y: 0 }, nextDir: { x: 0, y: 0 }, face: { x: -1, y: 0 }, chomp: 0, invuln: 0, portalLock: 0 });
  const n = isBossLevel(level) ? 2 : Math.min(6, 3 + Math.floor((level - 1) / 3));
  const types = REALMS[realmOf(level)].hunters;
  const gap = Math.max(60, 170 - level * 8);
  hunters = [];
  for (let i = 0; i < n; i++) {
    hunters.push(i === 0
      ? makeHunter(types[0], 0, PEN_DOOR.r, PEN_DOOR.c, 'out', 0)
      : makeHunter(types[i % types.length], i, 10, PEN_SLOTS[i], 'pen', 60 + i * gap));
  }
  aiPhase = 0; aiPhaseTimer = SCATTER_FRAMES;
  magicField = 0; eatChain = 0; speedBoost = 0; freezeTime = 0;
  bombs = []; beams = []; bossShots = []; bats = []; hands = []; puddles = [];
  if (boss) Object.assign(boss, { x: MW / 2, y: 3.5 * CELL, vx: 0, vy: 0, state: 'drift', attackT: 200, invuln: 60, trail: boss.trail ? [] : undefined });
}

function spawnHunter(type, fromPen) {
  const idx = hunters.length;
  hunters.push(makeHunter(type, idx, 10, PEN_SLOTS[idx % PEN_SLOTS.length], fromPen ? 'pen' : 'out', 30));
}

function nextLevel() { loadLevel(level + 1); }

function completeLevel() {
  addScore(250 + level * 100);
  sfx.win();
  bannerFlash('LEVEL CLEAR', isBossLevel(level) ? 'the realm is quiet' : `${REALMS[realmOf(level)].name.toLowerCase()} · ${stageOf(level) + 1} of ${LEVELS_PER_REALM}`);
  levelDelay = LEVEL_OUT;
  burst(player.x, player.y, '#fde68a', 30);
}

function openExit() {
  const pc = cellOf(player.x, player.y);
  const dist = floodFrom(grid, maze.tunnels, pc.r, pc.c);
  let bestD = -1;
  for (let r = 1; r < ROWS - 1; r++) {
    for (let c = 1; c < COLS - 1; c++) {
      if (!walkable(r, c) || !(r === 1 || r === ROWS - 2 || c === 1 || c === COLS - 2)) continue;
      if (dist[r][c] > bestD) { bestD = dist[r][c]; exitCell = { r, c }; }
    }
  }
  exitOpen = true; exitPulse = 0;
  sfx.exit();
  bannerFlash('THE WAY OUT HAS OPENED', 'find the golden gate');
}

function hurtSoul() {
  if (dying || ending || ready || levelDelay || !gameRunning || player.invuln > 0) return;
  lives--;
  dying = DYING_FRAMES;
  magicField = 0; eatChain = 0;
  hunters.forEach(m => { m.scared = false; m.flash = false; });
  sfx.dissolve();
  shake(6, 16);
  for (let i = 0; i < 26; i++) {
    particles.push({ x: player.x, y: player.y, vx: (Math.random() - 0.5) * 2.5, vy: -0.5 - Math.random() * 2.2, life: 40 + Math.random() * 40, size: 2 + Math.random() * 4, color: Math.random() < 0.5 ? '#c084fc' : '#e9d5ff', wisp: true });
  }
  bombs = []; beams = []; bossShots = []; bats = [];
  updateHUD();
}

function startEnding() {
  if (ending || !gameRunning) return;
  ending = ENDING_FRAMES;
  sfx.gameOver();
  Object.keys(keys).forEach(k => keys[k] = false);
}
function endGame() {
  gameOver = true; gameRunning = false;
  const newBest = score > best;
  if (newBest) { best = score; saveBest(); }
  const finalScore = score, R = REALMS[realmOf(level)];
  updateHUD();
  Arcade.submitFlow(finalScore, () => {
    const ov = document.getElementById('startOverlay');
    ov.classList.remove('hidden');
    ov.innerHTML = `
      <h2>SOUL LOST</h2>
      <p>Level ${level} · ${R.name.toLowerCase()} &nbsp;|&nbsp; Score: ${finalScore}</p>
      <p style="margin-top:0.3rem">Best: ${best}${newBest ? ' &nbsp;<span style="color:#f0abfc; font-weight:bold">NEW BEST!</span>' : ''}</p>
      <p style="margin-top:0.8rem; color:#a78bfa; font-size:0.8rem; letter-spacing:1px">TOP SOULS</p>
      ${Arcade.boardHTML(Arcade.slug)}
      <p style="margin-top:0.8rem; opacity:0.8">Click or ENTER to try again</p>
    `;
  });
}

// ---------- Input ----------
const MOVE_CODES = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS'];
window.addEventListener('keydown', e => {
  initAudio();
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  if (e.code === 'Enter' && !gameRunning) { startGame(); return; }
  if (!gameRunning || ending) return;
  if (e.code === 'KeyP' || e.code === 'Escape') { paused = !paused; return; }
  if (paused && (e.code === 'Enter' || e.code === 'Space')) { paused = false; return; }
  // skip the READY beat with a fresh press (not a key still held from before)
  if (ready > 0 && ready < READY_FRAMES - 25 && (e.code === 'Enter' || e.code === 'Space' || MOVE_CODES.includes(e.code))) ready = 1;
});
window.addEventListener('keyup', e => keys[e.code] = false);
window.addEventListener('blur', () => { if (gameRunning && !ending && !Arcade.attract) paused = true; });
document.getElementById('startOverlay').addEventListener('click', () => { initAudio(); if (!gameRunning) startGame(); });

// ---------- Update ----------
function update() {
  tick++;
  particles.forEach(p => { p.x += p.vx; p.y += p.vy; if (p.wisp) p.vy -= 0.02; else p.vx *= 0.94; p.life--; });
  particles = particles.filter(p => p.life > 0);
  popups.forEach(p => { p.y -= 0.5; p.life--; });
  popups = popups.filter(p => p.life > 0);
  if (!gameRunning || paused) return;
  if (ending > 0) { if (--ending === 0) endGame(); return; }
  if (hitPause > 0) { hitPause--; return; }
  if (shakeT > 0) shakeT--;
  if (bannerTime > 0) bannerTime--;
  if (levelFade > 0) levelFade--;
  if (levelDelay > 0) { if (--levelDelay === 0) nextLevel(); return; }
  if (dying > 0) {
    if (--dying === 0) {
      if (lives <= 0) startEnding();
      else { resetPositions(); ready = READY_FRAMES; }
    }
    return;
  }
  if (ready > 0) {
    if (Arcade.attract && ready > 40) ready = 40;
    // the level title belongs to the READY beat — never leave it over play
    if (--ready === 0) { sfx.ready(); bannerTime = 0; }
    return;
  }

  if (Arcade.attract) attractPilot();
  updatePlayer();
  collect();
  updatePickups();
  updateHazards();
  updateField();
  updateHunters();
  if (boss) {
    updateBoss(boss);
    if (bossCollide(boss)) defeatBoss();
  }
  regrow.forEach(g => { if (--g.t === 0) { gems[g.r][g.c] = 2; burst((g.c + 0.5) * CELL, (g.r + 0.5) * CELL, '#e879f9', 10); } });
  regrow = regrow.filter(g => g.t > 0);

  if (!exitOpen && !boss && gemsLeft <= 0) openExit();
  if (exitOpen && !levelDelay && !dying) {
    exitPulse++;
    const e = centreOf(exitCell);
    if (Math.hypot(player.x - e.x, player.y - e.y) < CELL * 0.7) completeLevel();
  }
}

function defeatBoss() {
  const b = boss;
  addScore(3000 * (1 + b.cyc));
  burst(b.x, b.y, '#fde68a', 40); burst(b.x, b.y, '#e879f9', 30);
  shake(14, 30); hitPause = 12;
  sfx.bossDown();
  boss = null;
  bombs = []; beams = []; bossShots = []; bats = [];
  hunters.forEach(m => { if (m.state === 'out') { m.state = 'eyes'; m.scared = false; } });
  regrow = [];
  openExit();
  bannerFlash(b.name + ' FALLS', 'the way out has opened');
}

function updatePlayer() {
  if (player.chomp > 0) player.chomp = Math.max(0, player.chomp - 0.08);
  if (player.invuln > 0) player.invuln--;
  if (speedBoost > 0) speedBoost--;
  const pc = cellOf(player.x, player.y);
  const slowed = puddles.some(p => p.r === pc.r && p.c === pc.c);
  player.speed = (speedBoost > 0 ? 3.3 : 2.4) * (slowed ? 0.6 : 1);

  if (keys.ArrowLeft || keys.KeyA) player.nextDir = { x: -1, y: 0 };
  if (keys.ArrowRight || keys.KeyD) player.nextDir = { x: 1, y: 0 };
  if (keys.ArrowUp || keys.KeyW) player.nextDir = { x: 0, y: -1 };
  if (keys.ArrowDown || keys.KeyS) player.nextDir = { x: 0, y: 1 };

  /* Try to turn. Tested straight first; if that fails, retry from the
     corridor's centre line and snap there — a turn taken a few pixels wide of
     the junction still lands, but a genuinely mistimed one misses. */
  const want = player.nextDir;
  if (want.x || want.y) {
    if (canMove(player.x + want.x * player.speed, player.y + want.y * player.speed)) {
      player.dir = { ...want };
    } else if (want.x !== 0) {
      const cy = laneCentre(player.y);
      if (Math.abs(cy - player.y) <= TURN_SLACK && canMove(player.x + want.x * player.speed, cy)) { player.y = cy; player.dir = { ...want }; }
    } else {
      const cx = laneCentre(player.x);
      if (Math.abs(cx - player.x) <= TURN_SLACK && canMove(cx, player.y + want.y * player.speed)) { player.x = cx; player.dir = { ...want }; }
    }
  }

  const mx = player.x + player.dir.x * player.speed, my = player.y + player.dir.y * player.speed;
  if (canMove(mx, my)) {
    player.x = mx; player.y = my;
    // ease onto the centre of the corridor being travelled (across travel only)
    if (player.dir.x !== 0) {
      const ny = easeTo(player.y, laneCentre(player.y), CENTRE_PULL);
      if (canMove(player.x, ny)) player.y = ny;
    } else if (player.dir.y !== 0) {
      const nx = easeTo(player.x, laneCentre(player.x), CENTRE_PULL);
      if (canMove(nx, player.y)) player.x = nx;
    }
  } else {
    // stopped against a wall: square up so the next turn actually fits
    if (player.dir.x !== 0) { const cy = laneCentre(player.y); if (canMove(player.x, cy)) player.y = cy; }
    else if (player.dir.y !== 0) { const cx = laneCentre(player.x); if (canMove(cx, player.y)) player.x = cx; }
    player.dir = { x: 0, y: 0 };
  }
  if (player.dir.x || player.dir.y) player.face = { ...player.dir };
  if (player.x < 0) player.x += MW;
  if (player.x >= MW) player.x -= MW;
}

function collect() {
  const { r, c } = cellOf(player.x, player.y);
  if (r < 0 || r >= ROWS) return;
  const g = gems[r][c];
  if (g === 1) {
    gems[r][c] = 0; gemsLeft--;
    addScore(10);
    player.chomp = 1;
    sfx.chomp();
    if (Math.random() < 0.3) burst(player.x, player.y, '#67e8f9', 2);
  } else if (g === 2) {
    gems[r][c] = 0; gemsLeft--;
    addScore(50);
    player.chomp = 1;
    startField();
    if (boss) regrow.push({ r, c, t: 480 });
  }
  // the relic appears at the start cell after 70 and 170 crystals
  const eaten = gemsTotal - gemsLeft;
  if (!boss && !relic && relicsShown < 2 && eaten >= (relicsShown ? 170 : 70) && gemsLeft > 10) {
    relic = { ...START_CELL, life: 600, kind: REALMS[realmOf(level)].relic };
    relicsShown++;
  }
  if (relic) {
    const q = centreOf(relic);
    if (Math.hypot(player.x - q.x, player.y - q.y) < 14) {
      const pts = 500 * (realmOf(level) + 1) * (cycleOf(level) + 1);
      addScore(pts); popup(q.x, q.y - 14, String(pts), '#fde68a'); sfx.relic(); burst(q.x, q.y, '#fde68a', 14);
      relic = null;
    } else if (--relic.life <= 0) relic = null;
  }
}

function startField() {
  magicField = fieldMax;
  eatChain = 0;
  sfx.power();
  shake(3, 6);
  hunters.forEach(m => {
    if (m.state !== 'out') return;
    m.scared = true; m.flash = false; m.alert = 0; m.sprint = 0;
    reverseHunter(m);
  });
  updateHUD();
}

function updateField() {
  if (freezeTime > 0) freezeTime--;
  if (lantern > 0) lantern--;
  if (magicField <= 0) return;
  if (--magicField === 0) { hunters.forEach(m => { m.scared = false; m.flash = false; }); updateHUD(); }
  else hunters.forEach(m => { m.flash = m.scared && magicField < 120; });
}

function spawnPickup() {
  for (let tries = 0; tries < 60; tries++) {
    const r = 1 + Math.floor(Math.random() * (ROWS - 2)), c = 1 + Math.floor(Math.random() * (COLS - 2));
    if (!walkable(r, c) || gems[r][c] === 2) continue;
    const q = centreOf({ r, c });
    if (Math.hypot(q.x - player.x, q.y - player.y) < 5 * CELL) continue;
    const roll = Math.random(), dark = REALMS[realmOf(level)].hazard === 'dark';
    const type = roll < 0.1 ? 'life' : dark && roll < 0.45 ? 'lantern' : roll < 0.62 ? 'speed' : 'freeze';
    pickups.push({ r, c, x: q.x, y: q.y, type, life: 720, bob: Math.random() * 6 });
    return;
  }
}
function updatePickups() {
  if (--pickupTimer <= 0 && pickups.length < 2) { spawnPickup(); pickupTimer = 500 + Math.random() * 400; }
  pickups.forEach(p => {
    p.bob += 0.08; p.life--;
    if (Math.hypot(p.x - player.x, p.y - player.y) >= 16) return;
    p.life = 0;
    if (p.type === 'speed') { speedBoost = 420; sfx.pickup(); }
    else if (p.type === 'freeze') { freezeTime = 300; sfx.freeze(); }
    else if (p.type === 'lantern') { lantern = 900; sfx.pickup(); }
    else { lives++; sfx.life(); }
    addScore(25);
    popup(p.x, p.y - 12, { speed: 'SPEED', freeze: 'FREEZE', life: '1UP', lantern: 'LANTERN' }[p.type], '#fde68a');
  });
  pickups = pickups.filter(p => p.life > 0);
}

// ---------- Realm hazards ----------
function portalAt(r, c) {
  for (const pair of maze.portals) for (let i = 0; i < 2; i++) if (pair[i].r === r && pair[i].c === c) return pair[1 - i];
  return null;
}
function updateHazards() {
  const R = REALMS[realmOf(level)];
  // portals: the Soul
  if (maze.portals.length) {
    const pc = cellOf(player.x, player.y), key = pc.r * 100 + pc.c;
    if (player.portalLock && player.portalLock !== key) player.portalLock = 0;
    const dest = portalAt(pc.r, pc.c);
    if (dest && !player.portalLock) {
      const here = centreOf(pc);
      if (Math.hypot(player.x - here.x, player.y - here.y) < 5) {
        burst(here.x, here.y, '#22d3ee', 12);
        const to = centreOf(dest);
        player.x = to.x; player.y = to.y;
        player.portalLock = dest.r * 100 + dest.c;
        burst(to.x, to.y, '#f472b6', 12);
        sfx.portal();
      }
    }
  }
  // grave hands: the earth cracks, then a hand erupts
  if (R.hazard === 'hands') {
    if (--handTimer <= 0) {
      spawnHand();
      handTimer = Math.max(130, 250 - stageOf(level) * 30 - cycleOf(level) * 25) + Math.random() * 60;
    }
    hands.forEach(h => {
      if (h.state === 'up') {
        const pc = cellOf(player.x, player.y);
        if (pc.r === h.r && pc.c === h.c) hurtSoul();
      }
      if (--h.t > 0) return;
      if (h.state === 'warn') { h.state = 'up'; h.t = 45; sfx.hand(); burst((h.c + 0.5) * CELL, (h.r + 0.5) * CELL, '#78716c', 10); }
      else h.done = true;
    });
    hands = hands.filter(h => !h.done);
  }
  puddles.forEach(p => p.t--);
  puddles = puddles.filter(p => p.t > 0);
}
function spawnHand() {
  const pc = cellOf(player.x, player.y), d = player.dir;
  const options = [];
  if (d.x || d.y) for (let i = 2; i <= 4; i++) options.push({ r: pc.r + d.y * i, c: pc.c + d.x * i });
  for (let i = 0; i < 12; i++) options.push({ r: pc.r + Math.floor(Math.random() * 9) - 4, c: pc.c + Math.floor(Math.random() * 9) - 4 });
  const pick = options.find(q => q.c > 0 && q.c < COLS - 1 && walkable(q.r, q.c) && !(q.r === pc.r && q.c === pc.c) && !hands.some(h => h.r === q.r && h.c === q.c));
  if (!pick) return;
  hands.push({ r: pick.r, c: pick.c, state: 'warn', t: 70 });
  sfx.crack();
}

// ---------- Hunters ----------
function hunterPass(m, r, c) { return gridAt(r, c) === OPEN && !inPen(r, ((c % COLS) + COLS) % COLS); }

function hunterSpeed(m) {
  if (m.state === 'eyes') return 4;
  if (m.alert > 0) return 0;
  let s = m.base * (1 + 0.03 * Math.min(level - 1, 12) + 0.06 * cycleOf(level));
  if (m.type === 'vampire' && !boss && gemsLeft < gemsTotal * 0.2) s *= 1.12;   // it gets hungrier as the maze empties
  s = Math.min(s, 2.3);
  if (m.sprint > 0) s = 3.4;
  if (m.scared) s *= 0.55;
  if (maze.tunnels.has(Math.floor(m.y / CELL)) && (m.x < 3 * CELL || m.x > MW - 3 * CELL)) s *= 0.6;
  return s;
}

function hunterTarget(m) {
  if (m.state === 'eyes') return PEN_DOOR;
  const pc = cellOf(player.x, player.y);
  if (aiPhase === 0 && m.sprint <= 0 && !boss) return CORNERS[m.idx % 4];
  if (m.type === 'witch') return { r: pc.r + player.face.y * 4, c: pc.c + player.face.x * 4 };
  if (m.type === 'werewolf' && m.sprint <= 0) {
    const v = hunters.find(h => h.type === 'vampire' && h.state === 'out');
    if (!v) return pc;
    const a = { r: pc.r + player.face.y * 2, c: pc.c + player.face.x * 2 }, vc = cellOf(v.x, v.y);
    return { r: 2 * a.r - vc.r, c: 2 * a.c - vc.c };
  }
  if (m.type === 'frank') {
    const mc = cellOf(m.x, m.y);
    return Math.abs(mc.r - pc.r) + Math.abs(mc.c - pc.c) > 8 ? pc : CORNERS[m.idx % 4];
  }
  return pc;
}

function chooseDir(m) {
  const back = { x: -m.dir.x, y: -m.dir.y };
  const opts = DIRS4.filter(d => !(d.x === back.x && d.y === back.y) && hunterPass(m, m.tr + d.y, m.tc + d.x));
  if (!opts.length) return hunterPass(m, m.tr + back.y, m.tc + back.x) ? back : null;
  if (m.scared) return opts[Math.floor(Math.random() * opts.length)];
  const tg = hunterTarget(m);
  let bestD = Infinity, pick = opts[0];
  opts.forEach(d => {
    const dd = (m.tr + d.y - tg.r) ** 2 + (m.tc + d.x - tg.c) ** 2;
    if (dd < bestD) { bestD = dd; pick = d; }
  });
  return pick;
}

/* Cell-to-cell movement: walk to the next cell centre, decide there, never
   reverse unless cornered. Wrapping through a tunnel shifts x by a board width
   so the hunter slides out of one side and in at the other. */
function stepTile(m, speed) {
  let rem = speed;
  for (let guard = 0; rem > 0 && guard < 4; guard++) {
    const tx = (m.tc + 0.5) * CELL, ty = (m.tr + 0.5) * CELL;
    if (tx - m.x > MW / 2) m.x += MW; else if (m.x - tx > MW / 2) m.x -= MW;
    const d = Math.abs(tx - m.x) + Math.abs(ty - m.y);
    if (d > rem) {
      m.x += Math.sign(tx - m.x) * Math.min(rem, Math.abs(tx - m.x));
      m.y += Math.sign(ty - m.y) * Math.min(rem, Math.abs(ty - m.y));
      break;
    }
    m.x = tx; m.y = ty; rem -= d;
    if (m.state === 'eyes' && m.tr === PEN_DOOR.r && m.tc === PEN_DOOR.c) { m.state = 'entering'; return; }
    if (m.portalLock && m.portalLock !== m.tr * 100 + m.tc) m.portalLock = 0;
    const dest = m.state === 'out' && maze.portals.length ? portalAt(m.tr, m.tc) : null;
    if (dest && !m.portalLock) {
      m.tr = dest.r; m.tc = dest.c; m.x = (dest.c + 0.5) * CELL; m.y = (dest.r + 0.5) * CELL;
      m.portalLock = dest.r * 100 + dest.c;
    }
    const nd = chooseDir(m);
    if (!nd) break;
    m.dir = nd; m.tr += nd.y; m.tc = (m.tc + nd.x + COLS) % COLS;
  }
  if (m.x < -CELL) m.x += MW;
  if (m.x > MW + CELL) m.x -= MW;
  m.phase += speed * 0.22;
}

/* The ghost ignores walls entirely, which is why it is the slowest hunter. */
function flyGhost(m, speed) {
  const dest = m.state === 'eyes' ? centreOf(PEN_DOOR) : m.scared
    ? { x: m.x * 2 - player.x, y: m.y * 2 - player.y }
    : (aiPhase === 0 && !boss ? centreOf({ r: Math.max(1, Math.min(ROWS - 2, CORNERS[m.idx % 4].r)), c: Math.max(1, Math.min(COLS - 2, CORNERS[m.idx % 4].c)) }) : player);
  const dx = dest.x - m.x, dy = dest.y - m.y, d = Math.hypot(dx, dy) || 1;
  if (m.state === 'eyes' && d < 4) { m.x = dest.x; m.y = dest.y; m.state = 'entering'; return; }
  m.x = Math.max(CELL / 2, Math.min(MW - CELL / 2, m.x + dx / d * speed));
  m.y = Math.max(CELL / 2, Math.min(MH - CELL / 2, m.y + dy / d * speed));
  m.dir = Math.abs(dx) > Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) };
  m.phase += speed * 0.22;
}

function reverseHunter(m) {
  if (m.state !== 'out' || m.type === 'ghost' || !(m.dir.x || m.dir.y)) return;
  const pr = m.tr - m.dir.y, pc = (m.tc - m.dir.x + COLS) % COLS;
  if (!hunterPass(m, pr, pc)) return;
  m.tr = pr; m.tc = pc; m.dir = { x: -m.dir.x, y: -m.dir.y };
}

function lineOfSight(m) {
  const pc = cellOf(player.x, player.y), mc = cellOf(m.x, m.y);
  if (pc.r !== mc.r && pc.c !== mc.c) return false;
  const n = Math.abs(pc.r - mc.r) + Math.abs(pc.c - mc.c);
  if (n > 8 || n < 2) return false;
  const sr = Math.sign(pc.r - mc.r), sc = Math.sign(pc.c - mc.c);
  for (let i = 1; i < n; i++) if (!walkable(mc.r + sr * i, mc.c + sc * i)) return false;
  return true;
}

function hunterSpecials(m) {
  if (m.state !== 'out' || m.scared) { m.alert = 0; m.sprint = 0; return; }
  if (m.type === 'werewolf') {
    if (m.alert > 0) { if (--m.alert === 0) { m.sprint = 70; sfx.howl(); } return; }
    if (m.sprint > 0) { m.sprint--; return; }
    if (m.cool > 0) { m.cool--; return; }
    if (level >= 2 && lineOfSight(m)) { m.alert = 32; m.cool = 300; }
  } else if (m.type === 'witch' && level >= 2 && --m.hexT <= 0) {
    const q = cellOf(m.x, m.y);
    if (walkable(q.r, q.c)) { puddles.push({ r: q.r, c: q.c, t: 360 }); sfx.hex(); }
    m.hexT = Math.max(300, 520 - level * 10);
  }
}

function updateHunters() {
  if (--aiPhaseTimer <= 0) {
    aiPhase = 1 - aiPhase;
    aiPhaseTimer = aiPhase === 0 ? SCATTER_FRAMES : CHASE_FRAMES;
    hunters.forEach(m => { if (!m.scared) reverseHunter(m); });
  }
  hunters.forEach(m => {
    if (m.state === 'pen') {
      m.phase += 0.1;
      m.y = m.homeY + Math.sin(tick * 0.08 + m.idx) * 4;
      if (freezeTime <= 0 && --m.releaseT <= 0) m.state = 'leaving';
      return;
    }
    if (m.state === 'leaving') {
      const gx = (PEN_DOOR.c + 0.5) * CELL, gy = (PEN_DOOR.r + 0.5) * CELL;
      if (Math.abs(m.x - gx) > 1.2) m.x += Math.sign(gx - m.x) * 1.2;
      else { m.x = gx; m.y -= 1.2; }
      m.phase += 0.25;
      if (m.x === gx && m.y <= gy) { m.y = gy; m.state = 'out'; m.tr = PEN_DOOR.r; m.tc = PEN_DOOR.c; m.dir = { x: m.idx % 2 ? 1 : -1, y: 0 }; }
      return;
    }
    if (m.state === 'entering') {
      m.x = (PEN_DOOR.c + 0.5) * CELL;
      m.y += 2;
      if (m.y >= 10.5 * CELL) { m.y = 10.5 * CELL; m.homeY = m.y; m.state = 'pen'; m.releaseT = 90; m.dir = { x: -1, y: 0 }; }
      return;
    }
    m.frozen = m.state === 'out' && freezeTime > 0;
    if (m.frozen) return;
    hunterSpecials(m);
    const sp = hunterSpeed(m);
    if (m.type === 'ghost') flyGhost(m, sp);
    else if (sp > 0) stepTile(m, sp);
    collideHunter(m);
  });
}

function collideHunter(m) {
  if (m.state !== 'out' || m.frozen || dying) return;
  if (Math.hypot(m.x - player.x, m.y - player.y) > (m.type === 'ghost' ? 14 : 16)) return;
  if (m.scared) {
    eatChain = Math.min(eatChain + 1, 4);
    const pts = 200 * 2 ** (eatChain - 1) * (1 + cycleOf(level));
    addScore(pts);
    popup(m.x, m.y - 12, String(pts), '#93c5fd');
    burst(m.x, m.y, '#60a5fa', 16);
    m.state = 'eyes'; m.scared = false; m.flash = false; m.alert = 0; m.sprint = 0;
    hitPause = 8;
    sfx.eat();
  } else hurtSoul();
}

// ---------- Attract pilot ----------
/* Breadth-first search to the nearest goal, treating cells near a live hunter
   (and every telegraphed hazard) as blocked. Hub cabinets use it; the headless
   test uses it to prove every board can be cleared. */
let pilotT = 0;
function attractPilot() {
  if (--pilotT > 0) return;
  pilotT = 4;
  MOVE_CODES.forEach(k => { keys[k] = false; });
  const pc = cellOf(player.x, player.y);
  const danger = new Set();
  const mark = (r, c) => danger.add(r * 100 + ((c % COLS) + COLS) % COLS);
  hunters.forEach(m => {
    if (m.state !== 'out' || m.scared || m.frozen) return;
    const mc = cellOf(m.x, m.y);
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) if (Math.abs(dr) + Math.abs(dc) <= 2) mark(mc.r + dr, mc.c + dc);
  });
  hands.forEach(h => mark(h.r, h.c));
  bombs.forEach(k => blastCells(k.r, k.c).forEach(q => mark(q.r, q.c)));
  beams.forEach(b => { for (let i = 0; i < (b.axis === 'row' ? COLS : ROWS); i++) b.axis === 'row' ? mark(b.idx, i) : mark(i, b.idx); });
  if (boss && magicField <= 0) { const bc = cellOf(boss.x, boss.y); for (let dr = -3; dr <= 3; dr++) for (let dc = -3; dc <= 3; dc++) mark(bc.r + dr, bc.c + dc); }
  const scared = hunters.filter(m => m.state === 'out' && m.scared && magicField > 60).map(m => cellOf(m.x, m.y));
  const bossCell = boss && magicField > 30 ? cellOf(boss.x, boss.y) : null;
  const goal = (r, c) => exitOpen ? r === exitCell.r && c === exitCell.c
    : bossCell ? Math.abs(r - bossCell.r) + Math.abs(c - bossCell.c) <= 1 || (magicField <= 30 && gems[r][c] === 2)
      : scared.some(q => q.r === r && q.c === c) || gems[r][c] > 0 || (relic && relic.r === r && relic.c === c);
  const step = pilotSearch(pc, goal, danger) || pilotSearch(pc, goal, new Set());
  if (!step) return;
  keys[step.x < 0 ? 'ArrowLeft' : step.x > 0 ? 'ArrowRight' : step.y < 0 ? 'ArrowUp' : 'ArrowDown'] = true;
}
function pilotSearch(start, goal, danger) {
  const seen = new Map([[start.r * 100 + start.c, null]]);
  const q = [start];
  for (let h = 0; h < q.length; h++) {
    const cur = q[h];
    if (h > 0 && goal(cur.r, cur.c)) {
      let node = cur;
      while (seen.get(node.r * 100 + node.c).from !== start) node = seen.get(node.r * 100 + node.c).from;
      return seen.get(node.r * 100 + node.c).dir;
    }
    for (const d of DIRS4) {
      const r = cur.r + d.y, c = (cur.c + d.x + COLS) % COLS;
      if (Math.abs(cur.c + d.x - c) > 0 && !maze.tunnels.has(cur.r)) continue;
      const k = r * 100 + c;
      if (seen.has(k) || !walkable(r, c) || danger.has(k)) continue;
      seen.set(k, { from: cur, dir: d });
      q.push({ r, c });
    }
  }
  return null;
}

function updateHUD() {
  document.getElementById('score').textContent = score;
  document.getElementById('lives').textContent = lives;
  document.getElementById('level').textContent = level;
  document.getElementById('crystals').textContent = gemsLeft;
  const f = document.getElementById('field');
  f.textContent = magicField > 0 ? 'ON' : 'OFF';
  f.style.color = magicField > 0 ? '#e879f9' : '#c084fc';
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
loadLevel(1);
ready = 0; bannerTime = 0;
updateHUD();
loop();
console.log('Spectral Manor: Soul Circuit ready — four realms, four bosses');
