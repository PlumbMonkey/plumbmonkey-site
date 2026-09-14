// ============================================================
// SPECTRAL MANOR: LUNO'S FLIGHT — rules
// Ride Luno the owl-griffin. Joust witches and ghosts from ABOVE.
//
// Files (load order, after ../wave3/sprite-kit.js): stages.js · luno.js ·
//   bosses.js · render.js · game.js
// Four stages × four waves; the fourth wave of each is a boss. Rules run at a
// fixed 60 Hz (loop()) so high-refresh screens play at the intended speed.
// ============================================================

const canvas = document.getElementById('gameCanvas');
let ctx = canvas.getContext('2d');   // let: stages.js swaps it briefly to paint its sky cache
const W = canvas.width;
const H = canvas.height;

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
function playNoise(dur, vol = 0.05, freq = 900) {
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
const sfx = {
  flap: () => { playNoise(0.16, 0.055, 850); playTone(210, 0.11, 'triangle', 0.045, -90); },
  perfectFlap: () => { playNoise(0.2, 0.07, 1200); playTone(330, 0.12, 'triangle', 0.06, 220); },
  dive: () => { playNoise(0.3, 0.06, 2200); playTone(700, 0.25, 'sawtooth', 0.03, -500); },
  stomp: () => { playNoise(0.2, 0.08, 250); playTone(80, 0.2, 'sine', 0.08, -30); },
  crystal: () => { playTone(784, 0.07, 'sine', 0.06); later(() => playTone(988, 0.08, 'sine', 0.06), 55); later(() => playTone(1318, 0.14, 'triangle', 0.07), 110); playNoise(0.06, 0.03, 2000); },
  ghostPop: () => { playNoise(0.25, 0.06, 1600); playTone(900, 0.25, 'sine', 0.05, -600); },
  hurt: () => { playTone(180, 0.1, 'sawtooth', 0.07, -100); playTone(90, 0.18, 'square', 0.05, -40); playNoise(0.15, 0.05, 300); },
  wave: () => [440, 554, 659, 880].forEach((f, i) => later(() => playTone(f, 0.1, i === 3 ? 'triangle' : 'square', 0.05), i * 70)),
  land: () => { playNoise(0.06, 0.03, 200); playTone(90, 0.08, 'triangle', 0.03); },
  mount: type => type === 'crow' ? (playNoise(0.12, 0.035, 1500), playTone(520, 0.1, 'sawtooth', 0.035, -170))
    : type === 'skimmer' ? (playTone(620, 0.16, 'sine', 0.045, 420), playTone(310, 0.18, 'triangle', 0.035, 140))
      : (playNoise(0.1, 0.035, 480), playTone(280, 0.08, 'triangle', 0.03, 90)),
  bump: () => { playNoise(0.05, 0.025, 320); playTone(120, 0.06, 'triangle', 0.025, -25); },
  hexCharge: () => playTone(360, 0.16, 'sine', 0.025, 260),
  hexFire: () => { playTone(720, 0.09, 'sawtooth', 0.04, -430); playNoise(0.06, 0.025, 1800); },
  shrieker: () => { playTone(980, 0.34, 'sawtooth', 0.05, -520); later(() => playTone(760, 0.28, 'sawtooth', 0.045, -360), 180); },
  crash: () => { playNoise(0.5, 0.1, 200); playTone(60, 0.4, 'sine', 0.1, -20); },
  stone: () => { playNoise(0.15, 0.07, 700); playTone(150, 0.12, 'square', 0.04, -60); },
  roar: () => { playNoise(0.6, 0.08, 400); playTone(110, 0.5, 'sawtooth', 0.06, 60); },
  bell: () => { playTone(330, 1.4, 'sine', 0.08); playTone(495, 1.1, 'sine', 0.04); playTone(660, 0.8, 'triangle', 0.02); },
  thunder: () => { playNoise(0.9, 0.12, 250); playTone(45, 0.7, 'sine', 0.1, -10); },
  extraLife: () => [659, 784, 988, 1319].forEach((f, i) => later(() => playTone(f, 0.12, 'triangle', 0.06), i * 90)),
  gameOver: () => { playTone(330, 0.2, 'sawtooth', 0.06, -40); later(() => playTone(220, 0.25, 'sawtooth', 0.06, -60), 180); later(() => playTone(140, 0.35, 'sawtooth', 0.05, -40), 380); },
  pickup: () => { playTone(1046, 0.06, 'sine', 0.05); later(() => playTone(1318, 0.1, 'sine', 0.05), 50); }
};

// ---------- State ----------
const ENDING_FRAMES = 150, BOSS_AFTER = 2700, EXTRA_LIFE_EVERY = 20000;
/* Half-height of the "neither of you won that" band. Inside it a joust
   bounces both parties apart instead of killing Luno. */
const LEVEL_JOUST = 7;
let score = 0, lives = 3, wave = 1, crystals = 0, tick = 0;
let gameRunning = false, gameOver = false;
let keys = {};
const BEST_KEY = 'spectralArcade.luno.best';
function loadBest() { try { return parseInt(localStorage.getItem(BEST_KEY), 10) || 0; } catch (e) { return 0; } }
function saveBest() { try { localStorage.setItem(BEST_KEY, best); } catch (e) {} }
let best = loadBest();
let combo = 0, comboTimer = 0, hitPause = 0, shakeTime = 0, shakeMag = 0, waveDelay = 0;
let bannerText = '', bannerSub = '', bannerTime = 0, ending = 0, stageFade = 0, nextLife = EXTRA_LIFE_EVERY;
let stageIdx = 0, waveTimer = 0, bumpSoundCooldown = 0, stormTimer = 0;
function triggerShake(mag, time) { shakeMag = Math.max(shakeTime > 0 ? shakeMag : 0, mag); shakeTime = Math.max(shakeTime, time); }
function comboMult() { return Math.min(1 + Math.floor(combo / 5), 5); }
function bannerFlash(text, sub = '') { bannerText = text; bannerSub = sub; bannerTime = 70; }

const player = {
  x: 120, y: H / 2, w: 48, h: 36, vx: 0, vy: 0,
  speed: 0.45, maxSpeed: 5.2, flapPower: -7.8, gravity: 0.28, facing: 1,
  invuln: 0, bumpCooldown: 0, flapAnim: 0, flapStrength: 0, flightPhase: 0, landSquash: 0,
  grounded: false, walkPhase: 0, dive: false, diveCd: 0
};

let platforms = [], witches = [], ghosts = [], crystalPickups = [], particles = [], nests = [], witchBolts = [];
let rings = [], storms = [], bell = null, boss = null;

function addScore(n) {
  score += n;
  while (score >= nextLife) {
    nextLife += EXTRA_LIFE_EVERY;
    lives++;
    sfx.extraLife();
    bannerFlash('EXTRA LIFE');
  }
  updateHUD();
}

// ---------- Input ----------
window.addEventListener('keydown', e => {
  initAudio();
  keys[e.code] = true;
  if (['Space', 'ArrowDown', 'ArrowUp'].includes(e.code)) e.preventDefault();
  if (e.code === 'Enter' && !e.repeat && !gameRunning) startGame();
});
window.addEventListener('keyup', e => keys[e.code] = false);
document.getElementById('startOverlay').addEventListener('click', () => { initAudio(); if (!gameRunning) startGame(); });

// ---------- Flow ----------
function startGame() {
  score = 0; lives = 3; wave = 1; crystals = 0; tick = 0; nextLife = EXTRA_LIFE_EVERY;
  witches = []; ghosts = []; crystalPickups = []; particles = []; nests = []; witchBolts = []; boss = null;
  combo = 0; comboTimer = 0; hitPause = 0; shakeTime = 0; waveDelay = 0; ending = 0; bumpSoundCooldown = 0;
  Object.assign(player, { x: 120, y: H / 2, vx: 0, vy: 0, facing: 1, invuln: 0, grounded: false, walkPhase: 0, flapAnim: 0, flapStrength: 0, flightPhase: 0, landSquash: 0, dive: false, diveCd: 0 });
  gameRunning = true; gameOver = false;
  document.getElementById('startOverlay').classList.add('hidden');
  enterStage(0);
  spawnWave();
  announce();
  updateHUD();
}

function enterStage(si) {
  stageIdx = si;
  platforms = STAGES[si].layout();
  bell = STAGES[si].hazard === 'bell' ? { x: 480, y: 236, state: 'idle', t: 300 } : null;
  storms = []; rings = []; stormTimer = 240;
  stageFade = 40;
}

function announce() {
  const s = STAGES[stageOf(wave)];
  if (isBossWave(wave)) { bannerText = 'WARNING'; bannerSub = s.bossName + ' APPROACHES'; }
  else if ((wave - 1) % WAVES_PER_STAGE === 0) { bannerText = s.name; bannerSub = (cycleOfWave(wave) ? `Night ${cycleOfWave(wave) + 1} · ` : '') + s.sub; }
  else { bannerText = 'WAVE ' + wave; bannerSub = s.name.toLowerCase(); }
  bannerTime = 120;
}

function makeWitch(x, y, mount, extra) {
  return Object.assign({
    x, y, w: 34, h: 30, vx: 0, vy: 0, flapTimer: 20 + Math.random() * 40, facing: 1, state: 'flying',
    walkPhase: Math.random() * 6, nest: { taken: true }, mountTimer: 0, boltTimer: 200 + Math.random() * 300, boltCharge: 0,
    mount, wingPhase: Math.random() * 6, bumpCooldown: 0,
    color: mount === 'skimmer' ? '#0f766e' : mount === 'crow' ? '#9f1239' : '#7c3aed',
    accent: mount === 'skimmer' ? '#67e8f9' : mount === 'crow' ? '#fb7185' : '#4ade80'
  }, extra || {});
}
function spawnFlyingWitch(x, y, mount) {
  const w = makeWitch(x, y, mount);
  w.vx = (Math.random() < 0.5 ? -1 : 1) * (1.8 + wave * 0.12);
  w.vy = -4;
  witches.push(w);
  createParticles(x, y, '#a5f3fc', 10);
}
function fireBolt(x, y, a, speed, color) {
  witchBolts.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: 150, color: color || '#4ade80' });
}
function addStorm(x) {
  storms.push({ x: Math.max(30, Math.min(W - 30, x)), state: 'warn', t: STORM_WARN, seed: Math.random() * 1000 });
}

function spawnWave() {
  const si = stageOf(wave), cyc = cycleOfWave(wave);
  if (si !== stageIdx || platforms.length === 0) enterStage(si);
  witches = []; ghosts = []; nests = []; witchBolts = []; boss = null; waveTimer = 0; storms = [];
  const bossWave = isBossWave(wave);
  const wCount = bossWave ? 2 + cyc : 3 + (wave % WAVES_PER_STAGE || WAVES_PER_STAGE) * 2 + si + cyc * 2;
  const launch = platforms.filter(p => !p.vx && p.w >= 100);
  for (let i = 0; i < wCount; i++) {
    const p = launch[i % launch.length];
    const lane = Math.floor(i / launch.length);
    const rideX = p.x + 20 + ((i * 37 + lane * 19) % Math.max(30, p.w - 45));
    const mount = wave >= 5 && i % 5 === 0 ? 'skimmer' : wave >= 2 && i % 3 === 0 ? 'crow' : 'broom';
    const nest = { x: rideX, y: p.y - 18, w: 18, h: 18, taken: false, stealable: wave >= 3, plat: p, mount };
    nests.push(nest);
    const startsLeft = i % 2 === 0;
    witches.push(makeWitch(startsLeft ? p.x + 3 : p.x + p.w - 37, p.y - 30, mount, { state: 'walking', facing: startsLeft ? 1 : -1, nest }));
  }
  const gCount = Math.min(5, 2 + Math.floor(wave / 3));   // 7 at once crowded the sky
  for (let i = 0; i < gCount; i++) {
    ghosts.push({ x: 80 + Math.random() * (W - 160), y: 60 + Math.random() * 300, w: 28, h: 32, vx: (Math.random() - 0.5) * 1.5, vy: 0, phase: Math.random() * 6, vis: 0, state: 'returning', t: 40 + i * 25, hurt: 0 });
  }
  if (bossWave) boss = createBoss(STAGES[si].boss, cyc);
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
  const finalScore = score;
  updateHUD();
  Arcade.submitFlow(finalScore, () => {
    document.getElementById('startOverlay').classList.remove('hidden');
    document.getElementById('startOverlay').innerHTML = `
      <h2>FALLEN FROM THE SKY</h2>
      <p>Crystals: ${crystals} &nbsp;|&nbsp; Wave ${wave} · ${STAGES[stageIdx].name.toLowerCase()} &nbsp;|&nbsp; Score: ${finalScore}</p>
      <p style="margin-top:0.3rem">Best: ${best}${newBest ? ' &nbsp;<span style="color:#f0abfc; font-weight:bold">NEW BEST!</span>' : ''}</p>
      <p style="margin-top:0.8rem; color:#a78bfa; font-size:0.8rem; letter-spacing:1px">TOP RIDERS</p>
      ${Arcade.boardHTML(Arcade.slug)}
      <p style="margin-top:0.8rem; opacity:0.8">Click or ENTER to soar again</p>
    `;
  });
}

function hurtLuno(color) {
  if (player.invuln > 0 || ending || !gameRunning) return false;
  lives--;
  player.invuln = 70;
  player.vy = -6;
  player.dive = false;
  combo = 0; comboTimer = 0;
  hitPause = 5;
  triggerShake(9, 18);
  sfx.hurt();
  createParticles(player.x + 20, player.y + 15, color || '#f472b6', 12);
  createFeathers(player.x + 20, player.y + 15, 8);
  updateHUD();
  if (lives <= 0) startEnding();
  return true;
}
function bounceLuno(vy) { player.vy = vy; player.dive = false; }

/* Joust resolution against any rect: 'above' | 'level' | 'below', or null if
   not touching. A near-level collision is a DRAW (see LEVEL_JOUST). A spirit
   dive counts as above whenever Luno's middle is higher than the target's. */
function joust(r) {
  if (!(player.x < r.x + r.w && player.x + player.w > r.x && player.y < r.y + r.h && player.y + player.h > r.y)) return null;
  if (player.dive && player.y + player.h * 0.5 < r.y + r.h * 0.5) return 'above';
  const adv = (r.y + r.h * 0.4) - (player.y + player.h * 0.4);
  if (adv > LEVEL_JOUST) return 'above';
  if (adv >= -LEVEL_JOUST) return 'level';
  return 'below';
}

function createParticles(x, y, color, n) {
  for (let i = 0; i < n; i++) particles.push({ x, y, vx: (Math.random() - 0.5) * 7, vy: (Math.random() - 0.5) * 7 - 1, life: 18 + Math.random() * 16, color, size: 2 + Math.random() * 3 });
}
function createFeathers(x, y, n, color) {
  for (let i = 0; i < n; i++) particles.push({ x, y, vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 2, life: 40 + Math.random() * 30, color: color || (i % 2 ? '#d6d3d1' : '#a8a29e'), feather: true, rot: Math.random() * 6, spin: (Math.random() - 0.5) * 0.2, size: 2 });
}

// ---------- Update ----------
function update() {
  tick++;
  if (!gameRunning) return;
  particles.forEach(p => {
    p.x += p.vx; p.y += p.vy; p.life--;
    if (p.feather) { p.vx *= 0.95; p.vy = Math.min(1.2, p.vy + 0.05); p.rot += p.spin; p.x += Math.sin(p.life * 0.2) * 0.4; }
  });
  particles = particles.filter(p => p.life > 0);
  if (ending > 0) { if (--ending === 0) endGame(); return; }
  if (hitPause > 0) { hitPause--; return; }
  if (shakeTime > 0) shakeTime--;
  if (bannerTime > 0) bannerTime--;
  if (stageFade > 0) stageFade--;
  if (bumpSoundCooldown > 0) bumpSoundCooldown--;
  if (player.bumpCooldown > 0) player.bumpCooldown--;
  if (comboTimer > 0 && --comboTimer === 0) combo = 0;
  if (waveDelay > 0 && --waveDelay === 0) { spawnWave(); announce(); }

  if (Arcade.attract) attractPilot();
  movePlatforms();
  updatePlayer();
  updateHazards();
  updateWitches();
  updateBolts();
  updateNests();
  updateBossFlow();
  updateGhosts();
  collideWitches();
  collideGhosts();
  updatePickups();

  witches = witches.filter(w => !w.dead);
  ghosts = ghosts.filter(g => !g.dead);

  if (witches.length === 0 && !boss && gameRunning && waveDelay === 0 && !ending) {
    wave++;
    sfx.wave();
    bannerFlash(isBossWave(wave - 1) ? 'SKY CLEARED' : 'WAVE CLEAR', `${crystals} crystals`);
    waveDelay = (wave - 1) % WAVES_PER_STAGE === 0 ? 120 : 80;
    updateHUD();
  }
}

function movePlatforms() {
  platforms.forEach(p => {
    const ox = p.x, oy = p.y;
    if (p.vx) { p.x += p.vx; if (Math.abs(p.x - p.baseX) > p.range) p.vx *= -1; }
    if (p.bob) p.y = p.baseY + Math.sin(tick * 0.02 + p.bobPhase) * p.bob;
    p.dx = p.x - ox; p.dy = p.y - oy;
    if (p.fade) {
      const f = p.fade;
      if (--f.t <= 0) {
        if (f.phase === 'solid') { f.phase = 'warn'; f.t = CLOUD_WARN; }
        else if (f.phase === 'warn') { f.phase = 'gone'; f.t = CLOUD_GONE; createParticles(p.x + p.w / 2, p.y + 6, '#e5e7eb', 10); }
        else { f.phase = 'solid'; f.t = CLOUD_SOLID; }
      }
    }
  });
}

function updatePlayer() {
  if (keys.ArrowLeft || keys.KeyA) { player.vx -= player.speed; player.facing = -1; }
  if (keys.ArrowRight || keys.KeyD) { player.vx += player.speed; player.facing = 1; }
  player.vx *= 0.92;
  player.vx = Math.max(-player.maxSpeed, Math.min(player.maxSpeed, player.vx));

  if ((keys.Space || keys.KeyW || keys.ArrowUp) && player.flapAnim <= 0) {
    const perfect = player.vy > 5.5;
    player.vy = player.flapPower - (perfect ? 1.35 : 0);
    player.flapAnim = 24;
    player.flapStrength = perfect ? 1 : 0;
    player.dive = false;
    createFeathers(player.x + player.w / 2 - player.facing * 14, player.y + player.h / 2 + 6, perfect ? 4 : 2);
    if (perfect) { addScore(15); createParticles(player.x + 8, player.y + 20, '#fde68a', 8); sfx.perfectFlap(); }
    else sfx.flap();
  }
  if (player.flapAnim > 0) player.flapAnim--; else player.flapStrength = 0;

  // SPIRIT DIVE: fold the wings and drop like a stone — anything you land on from above is destroyed
  if (player.diveCd > 0) player.diveCd--;
  if ((keys.ArrowDown || keys.KeyS) && !player.grounded && !player.dive && player.diveCd <= 0) {
    player.dive = true; player.diveCd = 50;
    player.vy = Math.max(player.vy, 9);
    sfx.dive();
  }
  player.flightPhase += 0.12 + Math.abs(player.vx) * 0.015;
  if (player.landSquash > 0) player.landSquash--;

  if (player.dive) { player.vy = Math.min(14, player.vy + 0.7); player.vx *= 0.9; if (tick % 2 === 0) particles.push({ x: player.x + player.w / 2, y: player.y, vx: 0, vy: -1, life: 14, color: '#c4b5fd', size: 2 }); }
  else player.vy = Math.min(11, player.vy + player.gravity);

  player.x += player.vx;
  player.y += player.vy;
  if (player.x < -player.w) player.x = W;
  if (player.x > W) player.x = -player.w;

  const wasDiving = player.dive;
  player.grounded = false;
  let landedOn = null;
  if (player.y > H - 70) { player.y = H - 70; player.vy = Math.min(0, player.vy); player.grounded = true; landedOn = 'floor'; }
  if (player.y < 20) { player.y = 20; player.vy = Math.max(0, player.vy); }

  platforms.forEach(p => {
    if (!isSolid(p)) return;
    const overlapX = player.x + player.w > p.x + 4 && player.x < p.x + p.w - 4;
    if (player.vy >= 0 && overlapX && player.y + player.h > p.y - 2 && player.y + player.h < p.y + p.h + 16 &&
        player.y + player.h - player.vy - (p.dy || 0) <= p.y + 5) {
      if (player.vy > 1.5) {
        sfx.land();
        player.landSquash = Math.min(8, Math.round(player.vy));
        createParticles(player.x + player.w / 2, p.y, '#a8a29e', 5);
      }
      player.y = p.y - player.h;
      player.vy = 0;
      player.grounded = true;
      player.x += p.dx || 0;
      landedOn = p;
      return;
    }
    if (player.vy < 0 && overlapX && player.y < p.y + p.h && player.y > p.y && player.y - player.vy >= p.y + p.h - 4) {
      player.y = p.y + p.h; player.vy = 1; sfx.land(); return;
    }
    if (player.y + player.h > p.y + 4 && player.y < p.y + p.h - 2 && player.x + player.w > p.x && player.x < p.x + p.w) {
      player.x = player.x + player.w / 2 < p.x + p.w / 2 ? p.x - player.w : p.x + p.w;
      player.vx *= -0.3;
    }
  });

  if (player.grounded) {
    if (wasDiving) {
      // STOMP: a dive landing knocks out walking witches nearby
      player.dive = false;
      triggerShake(6, 10); sfx.stomp();
      rings.push({ x: player.x + player.w / 2, y: player.y + player.h, r: 6, max: 70, speed: 5, life: 16, maxLife: 16, color: '#c4b5fd' });
      witches.forEach(w => { if (w.state === 'walking' && Math.abs(w.x + w.w / 2 - (player.x + player.w / 2)) < 75 && Math.abs(w.y + w.h - (player.y + player.h)) < 20) defeatWitch(w); });
    }
    if (Math.abs(player.vx) > 0.4) player.walkPhase += Math.abs(player.vx) * 0.09;
  }
  if (player.invuln > 0) player.invuln--;
}

function updateHazards() {
  if (bell) {
    if (--bell.t <= 0) {
      if (bell.state === 'idle') { bell.state = 'warn'; bell.t = BELL_WARN; sfx.hexCharge(); }
      else {
        rings.push({ x: bell.x, y: bell.y + 10, r: 10, max: BELL_RING_MAX, speed: 5.5, life: 55, maxLife: 55, color: '#fbbf24', shove: true });
        triggerShake(6, 14); sfx.bell();
        bell.state = 'idle'; bell.t = 420 + Math.random() * 200;
      }
    }
  }
  rings.forEach(r => {
    r.r = Math.min(r.max, r.r + r.speed); r.life--;
    if (!r.shove) return;
    const cx = player.x + player.w / 2, cy = player.y + player.h / 2;
    const d = Math.hypot(cx - r.x, cy - r.y) || 1;
    if (Math.abs(d - r.r) < 20) { player.vx += (cx - r.x) / d * 1.4; player.vy += (cy - r.y) / d * 1.1; player.dive = false; }
    witches.forEach(w => { const wd = Math.hypot(w.x - r.x, w.y - r.y) || 1; if (w.state === 'flying' && Math.abs(wd - r.r) < 20) { w.vx += (w.x - r.x) / wd * 0.8; w.vy += (w.y - r.y) / wd * 0.6; } });
  });
  rings = rings.filter(r => r.life > 0);

  if (STAGES[stageIdx].hazard === 'storm' && !waveDelay && --stormTimer <= 0) {
    addStorm(player.x + player.w / 2 + player.vx * 20);
    stormTimer = Math.max(130, 240 - wave * 4) + Math.random() * 80;
  }
  storms.forEach(s => {
    if (--s.t > 0) return;
    if (s.state === 'warn') {
      s.state = 'bolt'; s.t = STORM_BOLT;
      triggerShake(8, 12); sfx.thunder();
      const inCol = (x, w) => Math.abs(x + w / 2 - s.x) < STORM_WIDTH / 2 + w * 0.3;
      if (inCol(player.x, player.w)) hurtLuno('#a5f3fc');
      witches.forEach(w => { if (w.state === 'flying' && inCol(w.x, w.w)) defeatWitch(w, true); });
    } else s.done = true;
  });
  storms = storms.filter(s => !s.done);
}

function updateWitches() {
  witches.forEach(w => {
    if (w.state === 'walking') {
      const p = w.nest.plat;
      if (!isSolid(p)) { w.nest.taken = true; w.state = 'flying'; w.vy = -3; w.vx = (Math.random() < 0.5 ? -1 : 1) * 1.8; sfx.mount(w.mount); return; }
      w.y = p.y - w.h;
      w.x += p.dx || 0;
      if (w.nest.taken) {
        if (++w.mountTimer === 1) { w.mount = 'broom'; w.color = '#7c3aed'; w.accent = '#4ade80'; }
        if (w.mountTimer > 120) { w.state = 'flying'; w.vx = (Math.random() < 0.5 ? -1 : 1) * (1.6 + wave * 0.15); w.vy = -4; sfx.mount('broom'); }
      } else if (w.mountTimer > 0) {
        if (--w.mountTimer === 0) {
          w.nest.taken = true; w.state = 'flying';
          const base = w.mount === 'crow' ? 2.35 : w.mount === 'skimmer' ? 1.45 : 1.9;
          w.vx = (w.facing || 1) * (base + Math.min(wave, 16) * 0.12);
          w.vy = -5;
          sfx.mount(w.mount);
          createParticles(w.x + w.w / 2, w.y + w.h / 2, '#e879f9', 10);
        }
      } else {
        const dir = w.nest.x > w.x + w.w / 2 ? 1 : -1;
        w.x += dir * (0.72 + Math.min(wave, 8) * 0.055);
        w.facing = dir;
        w.walkPhase += 0.18;
        if (Math.abs(w.x + w.w / 2 - (w.nest.x + 8)) < 10) w.mountTimer = 50;
      }
      return;
    }
    if (--w.flapTimer <= 0) { w.vy = -5.5 - Math.random() * 2; w.flapTimer = 25 + Math.random() * 35; }
    w.vy = Math.min(7, w.vy + 0.22);
    w.x += w.vx; w.y += w.vy;
    w.facing = w.vx > 0 ? 1 : -1;
    if (w.x < -40) w.x = W + 10;
    if (w.x > W + 40) w.x = -10;
    if (w.y > H - 80) { w.y = H - 80; w.vy = -4; }
    if (w.y < 30) w.vy = Math.abs(w.vy) * 0.5;
    platforms.forEach(p => {
      if (!isSolid(p)) return;
      const overlapX = w.x + w.w > p.x && w.x < p.x + p.w;
      if (w.vy >= 0 && overlapX && w.y + w.h > p.y && w.y + w.h < p.y + 18) { w.y = p.y - w.h; w.vy = -3; }
      else if (w.vy < 0 && overlapX && w.y < p.y + p.h && w.y > p.y) { w.y = p.y + p.h; w.vy = 1; }
    });
    if (wave >= 4) {
      const pdx = player.x + player.w / 2 - (w.x + w.w / 2), pdy = player.y + player.h / 2 - (w.y + w.h / 2);
      if (w.boltCharge > 0) {
        if (--w.boltCharge === 0) {
          const base = Math.atan2(pdy, pdx);
          (w.mount === 'skimmer' ? [-0.1, 0.1] : [0]).forEach(o => fireBolt(w.x + w.w / 2, w.y + w.h / 2, base + o, 3.6, w.accent));
          sfx.hexFire();
          w.boltTimer = Math.max(120, 280 + Math.random() * 220 - wave * 8);
        }
      } else if (--w.boltTimer <= 0 && Math.hypot(pdx, pdy) < 420) {
        w.boltCharge = w.mount === 'skimmer' ? 48 : 36;
        sfx.hexCharge();
      }
    }
  });

  // flying witches are solid to each other, harmlessly
  for (let i = 0; i < witches.length; i++) {
    const a = witches[i];
    if (a.state !== 'flying') continue;
    if (a.bumpCooldown > 0) a.bumpCooldown--;
    for (let j = i + 1; j < witches.length; j++) {
      const b = witches[j];
      if (b.state !== 'flying') continue;
      const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy) || 1, minDist = (a.w + b.w) * 0.42;
      if (dist >= minDist) continue;
      const push = (minDist - dist) * 0.09, nx = dx / dist, ny = dy / dist;
      const aw = a.mount === 'skimmer' ? 0.45 : 1, bw = b.mount === 'skimmer' ? 0.45 : 1;
      a.x -= nx * push * bw; a.y -= ny * push * bw; b.x += nx * push * aw; b.y += ny * push * aw;
      a.vx -= nx * 0.18 * bw; b.vx += nx * 0.18 * aw; a.vy -= ny * 0.12; b.vy += ny * 0.12;
      a.bumpCooldown = b.bumpCooldown = 16;
      if (bumpSoundCooldown <= 0) { sfx.bump(); bumpSoundCooldown = 12; }
    }
  }
}

function updateBolts() {
  witchBolts.forEach(b => { b.x += b.vx; b.y += b.vy; b.life--; });
  witchBolts = witchBolts.filter(b => b.life > 0 && b.x > -20 && b.x < W + 20 && b.y > -20 && b.y < H + 20);
  if (player.invuln > 0) return;
  const hit = witchBolts.find(b => b.x > player.x && b.x < player.x + player.w && b.y > player.y && b.y < player.y + player.h);
  if (hit) { hit.life = 0; hurtLuno(hit.color); }
}

function updateNests() {
  nests.forEach(n => {
    if (n.taken) return;
    n.x += n.plat.dx || 0; n.y = n.plat.y - 18;
    if (n.stealable && player.x < n.x + n.w && player.x + player.w > n.x && player.y < n.y + n.h && player.y + player.h > n.y) {
      n.taken = true;
      crystals++;
      addScore(150);
      sfx.pickup();
      createParticles(n.x + 8, n.y + 8, '#e879f9', 10);
    }
  });
}

function updateBossFlow() {
  waveTimer++;
  // dawdle in a normal wave and the Shrieker comes hunting
  if (!boss && !isBossWave(wave) && waveTimer > BOSS_AFTER && witches.length > 0) {
    boss = createBoss('shrieker', cycleOfWave(wave));
    boss.hp = boss.maxHp = 4 + Math.floor(wave / 3);
    boss.name = 'THE SHRIEKER — HUNTING';
    bannerFlash('THE SHRIEKER COMES', 'You lingered too long');
    sfx.shrieker();
    triggerShake(6, 20);
  }
  if (!boss) return;
  updateBoss(boss);
  bossCollide(boss);
  if (boss.hp <= 0) {
    const cyc = cycleOfWave(wave);
    addScore(isBossWave(wave) ? 3000 * (1 + cyc) : 1000 * comboMult());
    crystals += 3;
    for (let i = 0; i < 5; i++) crystalPickups.push({ x: boss.x + i * 14, y: boss.y, w: 18, h: 18, life: 500, vy: -2 - i * 0.6 });
    createParticles(boss.x + boss.w / 2, boss.y + boss.h / 2, '#f59e0b', 40);
    createFeathers(boss.x + boss.w / 2, boss.y + boss.h / 2, 14, '#44403c');
    triggerShake(14, 28);
    hitPause = 10;
    sfx.wave();
    if (isBossWave(wave)) bannerFlash('BOSS DEFEATED', boss.name);
    boss = null;
    updateHUD();
  }
}

function updateGhosts() {
  ghosts.forEach(g => {
    if (g.hurt > 0) g.hurt--;
    if (--g.t <= 0) {
      const next = { visible: ['fading', 40], fading: ['phased', 120], phased: ['returning', 40], returning: ['visible', 240 + Math.random() * 120] }[g.state];
      g.state = next[0]; g.t = next[1];
    }
    g.vis = g.state === 'visible' ? 1 : g.state === 'phased' ? 0 : g.state === 'fading' ? g.t / 40 : 1 - g.t / 40;
    g.phase += 0.03;
    const dx = player.x + player.w / 2 - (g.x + g.w / 2), dy = player.y + player.h / 2 - (g.y + g.h / 2), d = Math.hypot(dx, dy) || 1;
    if (g.state === 'visible' && d < 260) { g.vx += dx / d * 0.025; g.vy += dy / d * 0.02; }
    else { g.vx += Math.sin(g.phase) * 0.02; g.vy += Math.cos(g.phase * 0.7) * 0.02; }
    const sp = Math.hypot(g.vx, g.vy), cap = 1.2 + Math.min(wave, 16) * 0.04;
    if (sp > cap) { g.vx = g.vx / sp * cap; g.vy = g.vy / sp * cap; }
    g.x += g.vx; g.y += g.vy;
    if (g.x < 20 || g.x > W - 48) g.vx *= -1;
    if (g.y < 40 || g.y > H - 110) g.vy *= -1;
    g.x = Math.max(20, Math.min(W - 48, g.x)); g.y = Math.max(40, Math.min(H - 110, g.y));
  });
}

function defeatWitch(w, byHazard) {
  if (w.dead) return;
  w.dead = true;
  if (!byHazard) { combo++; comboTimer = 150; hitPause = 2; }
  addScore((200 + wave * 25) * (byHazard ? 1 : comboMult()));
  crystals++;
  triggerShake(3, 8);
  sfx.crystal();
  createParticles(w.x + w.w / 2, w.y + w.h / 2, '#e879f9', 14);
  crystalPickups.push({ x: w.x + 8, y: w.y + 8, w: 18, h: 18, life: 300, vy: -1.5 });
}

function collideWitches() {
  if (player.invuln > 0) return;
  for (const w of witches) {
    if (w.dead) continue;
    const j = joust(w);
    if (!j) continue;
    if (j === 'above') { defeatWitch(w); if (player.dive) { player.dive = false; player.vy = -6; } }
    else if (j === 'level') {
      if (player.bumpCooldown > 0) continue;
      const away = player.x < w.x ? -1 : 1;
      player.vx = away * 4.2; player.vy -= 1.6; w.vx = -away * 3.4;
      player.bumpCooldown = 14;
      triggerShake(2, 5);
      if (bumpSoundCooldown <= 0) { sfx.bump(); bumpSoundCooldown = 12; }
    } else {
      player.vx = (player.x < w.x ? -1 : 1) * 4;
      hurtLuno();
      return;
    }
  }
}

// Ghosts are destroyable now: joust them from above (or dive through them).
// While faded out they are harmless AND untouchable.
function collideGhosts() {
  for (const g of ghosts) {
    if (g.dead || g.vis < 0.6) continue;
    const j = joust(g);
    if (!j) continue;
    if (j === 'above') {
      g.dead = true;
      combo++; comboTimer = 150;
      addScore(250 * comboMult());
      sfx.ghostPop();
      createParticles(g.x + g.w / 2, g.y + g.h / 2, '#c7d2fe', 20);
      createParticles(g.x + g.w / 2, g.y + g.h / 2, '#a78bfa', 10);
      crystalPickups.push({ x: g.x + 6, y: g.y + 6, w: 18, h: 18, life: 360, vy: 0, soul: true });
      if (player.dive) player.dive = false;
      player.vy = -6.5;
      hitPause = 2;
    } else if (player.invuln <= 0) {
      if (j === 'level' && player.bumpCooldown <= 0) {
        player.vx = (player.x < g.x ? -1 : 1) * 4; player.vy -= 1.5; g.vx *= -1; player.bumpCooldown = 14; sfx.bump();
      } else if (j === 'below') hurtLuno('#a78bfa');
    }
  }
}

function updatePickups() {
  crystalPickups.forEach(c => {
    c.life--;
    if (c.soul) { c.y += Math.sin(tick * 0.08 + c.x) * 0.4 - 0.15; }
    else {
      c.vy += 0.12; c.y += c.vy;
      if (c.y > H - 70) { c.y = H - 70; c.vy = 0; }
      platforms.forEach(p => { if (isSolid(p) && c.y + c.h > p.y && c.y < p.y + 8 && c.x + c.w > p.x && c.x < p.x + p.w) { c.y = p.y - c.h; c.vy = 0; } });
    }
    if (player.x < c.x + c.w && player.x + player.w > c.x && player.y < c.y + c.h && player.y + player.h > c.y) {
      c.taken = true;
      addScore(c.soul ? 150 : 100);
      sfx.pickup();
      createParticles(c.x + 9, c.y + 9, c.soul ? '#a5f3fc' : '#e879f9', 8);
    }
  });
  crystalPickups = crystalPickups.filter(c => c.life > 0 && !c.taken);
}

// Hub cabinet preview: chase the nearest witch and stay aloft.
function attractPilot() {
  keys = {};
  const tgt = boss || witches.find(w => !w.dead) || ghosts[0];
  if (tgt) keys[tgt.x > player.x ? 'ArrowRight' : 'ArrowLeft'] = true;
  if (player.y > H / 2 || (tgt && player.y > tgt.y - 10)) { if (player.flapAnim <= 0 && Math.random() < 0.5) keys.Space = true; }
}

function updateHUD() {
  document.getElementById('score').textContent = score;
  document.getElementById('lives').textContent = lives;
  document.getElementById('wave').textContent = wave;
  document.getElementById('crystals').textContent = crystals;
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
enterStage(0);
updateHUD();
loop();
console.log('Spectral Manor: Luno\'s Flight ready — four skies, four bosses');
