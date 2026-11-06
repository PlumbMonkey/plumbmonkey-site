// ============================================================
// SPECTRAL MANOR REVENGER
// Ghost Circuit aerial rescue game
// Ghosts + UAPs (Capsule / Cylinder / Sphere / Pyramid)
// Abducting fans at the Ghost Circuit concert outside the manor
// ============================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

// ---------- Sound System (Web Audio API - no files needed) ----------
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = ArcadeAudio.context();
  }
  ArcadeAudio.resume();
}

function soundPan(screenX) {
  return Math.max(-0.7, Math.min(0.7, (screenX / W) * 1.4 - 0.7));
}

function playTone(freq, duration, type = 'square', vol = 0.08, slide = 0, pan = 0) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  if (slide) osc.frequency.linearRampToValueAtTime(freq + slide, audioCtx.currentTime + duration);
  gain.gain.setValueAtTime(vol, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ArcadeAudio.output('sfx', pan));
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

function playNoise(duration, vol = 0.06, pan = 0) {
  if (!audioCtx) return;
  const bufferSize = audioCtx.sampleRate * duration;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;
  const gain = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 800;
  gain.gain.setValueAtTime(vol, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ArcadeAudio.output('sfx', pan));
  noise.start();
}

// Big laser cannon: noise crack + exponential pitch dive + detuned sub layer
function playLaserCannon(pan = 0) {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const f0 = 1900 + Math.random() * 400; // slight variation per shot

  // main zap — fast exponential dive, longer and louder
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(140, t + 0.13);
  g.gain.setValueAtTime(0.13, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
  const hp = audioCtx.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 220;
  o.connect(hp); hp.connect(g); g.connect(ArcadeAudio.output('sfx', pan));
  o.start(t); o.stop(t + 0.17);

  // detuned body layer — gives the shot weight
  const o2 = audioCtx.createOscillator();
  const g2 = audioCtx.createGain();
  o2.type = 'square';
  o2.frequency.setValueAtTime(f0 * 0.51, t);
  o2.frequency.exponentialRampToValueAtTime(80, t + 0.1);
  g2.gain.setValueAtTime(0.07, t);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  o2.connect(g2); g2.connect(ArcadeAudio.output('sfx', pan));
  o2.start(t); o2.stop(t + 0.13);

  // cannon thump — low sine drop for chest punch
  const o3 = audioCtx.createOscillator();
  const g3 = audioCtx.createGain();
  o3.type = 'sine';
  o3.frequency.setValueAtTime(150, t);
  o3.frequency.exponentialRampToValueAtTime(45, t + 0.12);
  g3.gain.setValueAtTime(0.12, t);
  g3.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
  o3.connect(g3); g3.connect(ArcadeAudio.output('sfx', pan));
  o3.start(t); o3.stop(t + 0.15);

  // muzzle crack — high-passed noise transient
  const len = Math.floor(audioCtx.sampleRate * 0.05);
  const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const n = audioCtx.createBufferSource();
  n.buffer = buf;
  const nhp = audioCtx.createBiquadFilter();
  nhp.type = 'highpass'; nhp.frequency.value = 1800;
  const ng = audioCtx.createGain();
  ng.gain.setValueAtTime(0.1, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  n.connect(nhp); nhp.connect(ng); ng.connect(ArcadeAudio.output('sfx', pan));
  n.start(t);
}

// Generic layered cannon blast: noise crack +
// exponential pitch dive + detuned body + low sine thump. All three fire
// modes use this so every trigger pull sounds like ARTILLERY, with the
// parameters giving each weapon its own character.
function playBlast(opts) {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const f0 = opts.f0 + Math.random() * opts.f0 * 0.15;

  // main zap — exponential dive
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(opts.fEnd, t + opts.dur);
  g.gain.setValueAtTime(opts.vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + opts.dur * 1.25);
  const hp = audioCtx.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 180;
  o.connect(hp); hp.connect(g); g.connect(ArcadeAudio.output('sfx', opts.pan));
  o.start(t); o.stop(t + opts.dur * 1.35);

  // detuned body layer
  const o2 = audioCtx.createOscillator();
  const g2 = audioCtx.createGain();
  o2.type = 'square';
  o2.frequency.setValueAtTime(f0 * 0.5, t);
  o2.frequency.exponentialRampToValueAtTime(Math.max(50, opts.fEnd * 0.55), t + opts.dur * 0.8);
  g2.gain.setValueAtTime(opts.vol * 0.55, t);
  g2.gain.exponentialRampToValueAtTime(0.001, t + opts.dur);
  o2.connect(g2); g2.connect(ArcadeAudio.output('sfx', opts.pan));
  o2.start(t); o2.stop(t + opts.dur * 1.1);

  // cannon thump — low sine punch
  const o3 = audioCtx.createOscillator();
  const g3 = audioCtx.createGain();
  o3.type = 'sine';
  o3.frequency.setValueAtTime(opts.subF, t);
  o3.frequency.exponentialRampToValueAtTime(Math.max(30, opts.subF * 0.3), t + opts.dur);
  g3.gain.setValueAtTime(opts.vol * 0.9, t);
  g3.gain.exponentialRampToValueAtTime(0.001, t + opts.dur * 1.1);
  o3.connect(g3); g3.connect(ArcadeAudio.output('sfx', opts.pan));
  o3.start(t); o3.stop(t + opts.dur * 1.2);

  // muzzle crack — high-passed noise transient
  const len = Math.floor(audioCtx.sampleRate * 0.05);
  const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const n = audioCtx.createBufferSource();
  n.buffer = buf;
  const nhp = audioCtx.createBiquadFilter();
  nhp.type = 'highpass'; nhp.frequency.value = opts.crackHz || 1800;
  const ng = audioCtx.createGain();
  ng.gain.setValueAtTime(opts.vol * 0.8, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  n.connect(nhp); nhp.connect(ng); ng.connect(ArcadeAudio.output('sfx', opts.pan));
  n.start(t);
}

// Sound presets
const sfx = {
  shoot: (pan = 0) => playLaserCannon(pan),
  // Heavy bolt — the deepest blast of the three: low dive, big sub, slow decay
  heavy: (pan = 0) => playBlast({ f0: 900, fEnd: 70, dur: 0.24, subF: 110, vol: 0.14, crackHz: 900, pan }),
  // Spread — wide triple crack: slightly shorter, brighter, doubled zap
  spread: (pan = 0) => {
    playBlast({ f0: 1500, fEnd: 160, dur: 0.13, subF: 140, vol: 0.11, crackHz: 1500, pan });
    setTimeout(() => playBlast({ f0: 1750, fEnd: 200, dur: 0.1, subF: 150, vol: 0.07, crackHz: 2200, pan }), 25);
  },
  explosion: (pan = 0) => {
    playNoise(0.25 + Math.random() * 0.05, 0.09, pan);
    playTone(115 + Math.random() * 15, 0.22, 'sawtooth', 0.06, -95, pan);
  },
  hit: () => {
    playTone(200, 0.12, 'sawtooth', 0.08, -150);
    playNoise(0.15, 0.05);
  },
  powerup: () => {
    playTone(523, 0.08, 'square', 0.06);
    setTimeout(() => playTone(659, 0.08, 'square', 0.06), 70);
    setTimeout(() => playTone(784, 0.12, 'square', 0.07), 140);
  },
  // Happy rising arpeggio on successful rescue (C–E–G–C)
  rescue: () => {
    playTone(523.25, 0.07, 'square', 0.055);
    setTimeout(() => playTone(659.25, 0.07, 'square', 0.055), 55);
    setTimeout(() => playTone(783.99, 0.07, 'square', 0.06), 110);
    setTimeout(() => playTone(1046.5, 0.16, 'triangle', 0.07), 165);
  },
  // Low descending tone when a fan is fully abducted
  abduct: () => {
    playTone(240, 0.5, 'sawtooth', 0.055, -170);
    playTone(120, 0.55, 'triangle', 0.04, -70);
    playTone(90, 0.4, 'sine', 0.03, -40);
  },
  gameOver: () => {
    playTone(300, 0.2, 'sawtooth', 0.07, -50);
    setTimeout(() => playTone(200, 0.3, 'sawtooth', 0.07, -80), 200);
  }
};

// ---------- Game State ----------
let score = 0;
let lives = 3;
let wave = 1;
let gameRunning = false;
let gameOver = false;
let deathPending = false; // true during the 1.1s death blast — blocks restart so the score isn't wiped
let keys = {};
let deathBlast = null; // dramatic full-screen death explosion

// ---------- Screen Shake (death + rescue feel) ----------
// shake.intensity decays each frame while duration counts down
let shake = { x: 0, y: 0, intensity: 0, duration: 0 };

function triggerShake(intensity, duration) {
  // Keep the stronger shake if one is already active
  if (intensity >= shake.intensity || shake.duration <= 0) {
    shake.intensity = intensity;
    shake.duration = duration;
  }
}

// ---------- Parallax scroll offsets (different layer speeds) ----------
// stars: very slow | hillsFar: slow | manor: medium | ground: fastest
const parallax = {
  stars: 0,
  hillsFar: 0,
  manor: 0,
  ground: 0
};

// ---------- Player ----------
const player = {
  x: 120,
  y: H / 2,
  w: 44,
  h: 20,
  speed: 5.8,
  vx: 0,
  vy: 0,
  fireCooldown: 0,
  bank: 0,           // banking tilt
  facing: 1,         // 1 = facing right, -1 = facing left
  shieldTimer: 0,    // frames of shield flicker after hit
  shotType: 0,       // 0 = dual, 1 = heavy, 2 = spread
  powerupTime: 0     // frames remaining on current power-up
};

// ---------- World & camera ----------
// The playfield is a wrapping world four screens wide:
// fly in either direction forever and you come back around. Everything —
// player, enemies, fans, bullets — lives in world coordinates; the camera
// follows the ship, leading in the facing direction.
const WORLD_W = W * 4;
let camX = 0;

function wrapX(x) { return ((x % WORLD_W) + WORLD_W) % WORLD_W; }
// shortest signed distance a→b around the wrap (result in [-WORLD_W/2, +WORLD_W/2])
function wrapDX(b, a) {
  let d = (b - a) % WORLD_W;
  if (d > WORLD_W / 2) d -= WORLD_W;
  if (d < -WORLD_W / 2) d += WORLD_W;
  return d;
}
// world x → screen x (shortest wrap relative to camera)
function toScreen(wx) {
  let r = (wx - camX) % WORLD_W;
  if (r < -WORLD_W / 2) r += WORLD_W;
  if (r > WORLD_W / 2) r -= WORLD_W;
  return r;
}

// ---------- Entities ----------
let bullets = [];
let enemyShots = [];  // aimed bolts + charged beams fired BY enemies
let enemies = [];
let particles = [];
let trails = [];     // engine trail particles
let laserTrails = []; // short neon trail particles behind lasers
let fans = [];       // concert fans on the ground (can be abducted)
let powerups = [];   // floating power-ups
let rescued = 0;
let abducted = 0;
let powerupTimer = 0; // frames until next power-up can spawn

// ---------- Juice: high score, combo, hit-pause, wave banner ----------
const BEST_KEY = 'spectralArcade.revenger.best';
function loadBest() { try { return parseInt(localStorage.getItem(BEST_KEY), 10) || 0; } catch (e) { return 0; } }
function saveBest() { try { localStorage.setItem(BEST_KEY, best); } catch (e) {} }
let best = loadBest();
let combo = 0, comboTimer = 0;      // kill streak; decays after 150 frames
let hitPause = 0;                   // frames to freeze the action on impact
let waveDelay = 0;                  // breather frames before next wave spawns
let bannerText = '', bannerTime = 0;
let paused = false;                 // P toggles; game state is preserved
function comboMult() { return Math.min(1 + Math.floor(combo / 5), 5); }

// ---------- Input ----------
window.addEventListener('keydown', e => {
  initAudio();
  keys[e.code] = true;
  if (e.code === 'Space' || e.code === 'KeyZ') e.preventDefault();
  if ((e.code === 'Space' || e.code === 'KeyZ') && !gameRunning && !deathPending) startGame();
  if (e.code === 'KeyP' && gameRunning) paused = !paused; // toggle pause, run preserved
});
window.addEventListener('keyup', e => keys[e.code] = false);

document.getElementById('startOverlay').addEventListener('click', () => {
  initAudio();
  if (!gameRunning && !deathPending) startGame();
});

// ---------- Core Functions ----------
function startGame() {
  initAudio();
  score = 0;
  lives = 3;
  wave = 1;
  rescued = 0;
  abducted = 0;
  bullets = [];
  enemyShots = [];
  enemies = [];
  particles = [];
  trails = [];
  laserTrails = [];
  fans = [];
  powerups = [];
  deathBlast = null;
  powerupTimer = 180;
  combo = 0; comboTimer = 0; hitPause = 0; waveDelay = 0;
  bannerText = 'WAVE 1'; bannerTime = 90;
  paused = false;
  shake.x = 0;
  shake.y = 0;
  shake.intensity = 0;
  shake.duration = 0;
  parallax.stars = 0;
  parallax.hillsFar = 0;
  parallax.manor = 0;
  parallax.ground = 0;
  player.x = 120;
  player.y = H / 2;
  player.bank = 0;
  player.facing = 1;
  player.shieldTimer = 0;
  camX = 0;
  player.shotType = 0;
  player.powerupTime = 0;
  gameRunning = true;
  gameOver = false;
  deathPending = false;
  document.getElementById('startOverlay').classList.add('hidden');
  spawnFans();
  spawnWave();
  updateHUD();
}

function spawnPowerup(x, y) {
  const types = [
    { type: 0, label: 'DUAL', color: '#c084fc' },
    { type: 1, label: 'HEAVY', color: '#f472b6' },
    { type: 2, label: 'SPREAD', color: '#22d3ee' }
  ];
  const pick = types[Math.floor(Math.random() * types.length)];
  powerups.push({
    x: x,
    y: y,
    w: 22,
    h: 22,
    type: pick.type,
    label: pick.label,
    color: pick.color,
    vy: -1.2,
    life: 420, // ~7 seconds before it fades
    bob: Math.random() * Math.PI * 2
  });
}

function spawnFans() {
  // Fans are scattered across the whole world — a
  // cluster near the concert stage plus stragglers all the way around
  for (let i = 0; i < 20; i++) {
    const nearStage = i < 8;
    fans.push({
      x: wrapX(nearStage
        ? 80 + i * 75 + Math.random() * 30                  // the stage crowd
        : Math.random() * WORLD_W),                          // world wanderers
      y: H - 60,
      w: 10,
      h: 16,
      state: 'ground',   // ground | grabbed | falling | rescued
      grabber: null,     // enemy that is carrying them
      fallVy: 0,
      color: Math.random() > 0.5 ? '#f0abfc' : '#c4b5fd'
    });
  }
}

function spawnWave() {
  const count = 4 + wave * 2;
  const types = ['ghost', 'sphere', 'capsule', 'cylinder', 'pyramid'];
  for (let i = 0; i < count; i++) {
    const t = types[Math.floor(Math.random() * types.length)];
    enemies.push({
      // spawn spread around the world, never within ~¾ screen of the player
      x: wrapX(player.x + W * 0.75 + Math.random() * (WORLD_W - W * 1.5)),
      y: 60 + Math.random() * (H - 160),
      w: t === 'capsule' ? 36 : 28,
      h: t === 'capsule' ? 16 : 22,
      speed: 1.3 + wave * 0.22 + Math.random() * 0.9,
      type: t,
      hp: 1,
      rot: Math.random() * Math.PI * 2,
      carrying: null,     // fan currently being abducted
      target: null,       // committed hunt target (lander behavior)
      seeking: Math.random() < 0.55, // some enemies actively hunt fans
      dir: -1,            // -1 = sweeping left (normal), +1 = looped back from behind
      loops: 0,           // how many times it has circled around
      // ~1s of grace so a fresh wave can't shoot you the instant it appears
      shootTimer: 60 + Math.random() * 150,
      charge: 0           // pyramid beam wind-up (telegraph)
    });
  }
}

// ---------- Player damage (shared by collisions AND enemy fire) ----------
function hitPlayer() {
  if (player.shieldTimer > 0 || !gameRunning) return;
  lives--;
  combo = 0; comboTimer = 0;
  hitPause = 5;
  updateHUD();

  if (lives <= 0) {
    // DRAMATIC FULL-SCREEN DEATH BLAST
    createDeathBlast(player.x + player.w / 2, player.y + player.h / 2);
    triggerShake(14, 40);
    sfx.hit();
    sfx.explosion();
    setTimeout(() => sfx.gameOver(), 300);
    gameRunning = false;
    // Capture the score NOW and lock out restarts — otherwise a held
    // Space (fire) restarts during the blast and wipes the score before
    // the initials prompt can read it
    deathPending = true;
    const finalScore = score;
    // Delay the game-over screen so the blast can play out
    setTimeout(() => {
      deathPending = false;
      gameOver = true;
      const newBest = finalScore > best;
      if (newBest) { best = finalScore; saveBest(); }
      Arcade.submitFlow(finalScore, () => {
        document.getElementById('startOverlay').classList.remove('hidden');
        document.getElementById('startOverlay').innerHTML = `
          <h2>CONCERT OVERRUN</h2>
          <p>Rescued: ${rescued} &nbsp;|&nbsp; Abducted: ${abducted}</p>
          <p style="margin-top:0.5rem">Final Score: ${finalScore}</p>
          <p style="margin-top:0.3rem">Best: ${best}${newBest ? ' &nbsp;<span style="color:#f0abfc; font-weight:bold">NEW BEST!</span>' : ''}</p>
          <p style="margin-top:0.8rem; color:#a78bfa; font-size:0.8rem; letter-spacing:1px">TOP REVENGERS</p>
          ${Arcade.boardHTML(Arcade.slug)}
          <p style="margin-top:0.8rem; opacity:0.8">Click or SPACE to defend again</p>
        `;
      });
      updateHUD();
    }, 1100);
  } else {
    createExplosion(player.x + player.w / 2, player.y + player.h / 2, '#f472b6');
    triggerShake(8, 18);
    sfx.hit();
    player.shieldTimer = 55;
  }
}

// ---------- Enemy weapons ----------
// Only spheres (aimed bolts) and pyramids (charged beam) shoot. Ghosts,
// capsules and cylinders stay melee so there are always enemies it's safe to
// close on — otherwise every wave becomes a bullet hell.
function enemyFire(e) {
  const ex = e.x + e.w / 2, ey = e.y + e.h / 2;
  const py = player.y + player.h / 2;
  // aim around the wrap — the shortest way to the player
  const dx = wrapDX(player.x + player.w / 2, ex);
  if (e.type === 'sphere') {
    const dy = py - ey;
    const d = Math.hypot(dx, dy) || 1;
    const sp = 4.2;
    enemyShots.push({ x: ex, y: ey, vx: (dx / d) * sp, vy: (dy / d) * sp, r: 4, life: 200, kind: 'bolt' });
    sfx.spread(soundPan(toScreen(e.x)));
  } else if (e.type === 'pyramid') {
    // fires along its current row — dodge by changing altitude
    enemyShots.push({ x: ex, y: ey, vx: (dx < 0 ? -1 : 1) * 9, vy: 0, r: 5, life: 140, kind: 'beam' });
    sfx.heavy(soundPan(toScreen(e.x)));
  }
}

function fire() {
  if (player.fireCooldown > 0) return;

  const baseY = player.y + player.h / 2;
  const f = player.facing;                       // 1 = right, -1 = left
  // shots leave from whichever end of the ship is the nose right now
  const noseX = f > 0 ? player.x + 40 : player.x + 4;
  const pan = soundPan(toScreen(player.x) + player.w / 2);

  if (player.shotType === 0) {
    // Dual long-form neon lasers
    bullets.push({ x: noseX, y: baseY - 7, w: 38, h: 3, speed: 16, dir: f, type: 'normal' });
    bullets.push({ x: noseX, y: baseY + 4, w: 38, h: 3, speed: 16, dir: f, type: 'normal' });
    player.fireCooldown = 7;
    sfx.shoot(pan);
  } else if (player.shotType === 1) {
    // Heavy neon bolt
    bullets.push({ x: noseX, y: baseY - 3, w: 36, h: 8, speed: 11, dir: f, type: 'heavy' });
    player.fireCooldown = 13;
    sfx.heavy(pan);
  } else {
    // Spread lasers
    bullets.push({ x: noseX, y: baseY - 2, w: 30, h: 3, speed: 15, dir: f, type: 'normal', vy: 0 });
    bullets.push({ x: noseX, y: baseY - 2, w: 28, h: 3, speed: 14, dir: f, type: 'normal', vy: -2.4 });
    bullets.push({ x: noseX, y: baseY - 2, w: 28, h: 3, speed: 14, dir: f, type: 'normal', vy: 2.4 });
    player.fireCooldown = 11;
    sfx.spread(pan);
  }
}

// ---------- Update ----------
function update() {
  // Screen shake always decays (even during death blast)
  if (shake.duration > 0) {
    shake.duration--;
    shake.x = (Math.random() - 0.5) * shake.intensity;
    shake.y = (Math.random() - 0.5) * shake.intensity;
    shake.intensity *= 0.88;
  } else {
    shake.x = 0;
    shake.y = 0;
    shake.intensity = 0;
  }

  // Parallax now tracks the CAMERA (the world only moves when you fly).
  // Factors are chosen so each layer's scroll is a whole number of its own
  // wrap-span per world lap — otherwise the scenery would visibly snap when
  // camX wraps at WORLD_W. (stars ¼ → 960≡0 mod 960; hills ½ → 1920≡0 mod
  // 1920; manor ⅔ → 2560≡0 mod 1280; ground 1 → 3840≡0 mod 1280.)
  parallax.stars = (camX * 0.25) % W;
  parallax.hillsFar = (camX * 0.5) % (W * 2);
  parallax.manor = (camX * (2 / 3)) % 1280;
  parallax.ground = camX % 1280;

  if (!gameRunning) {
    // Still update death blast particles when game freezes on death
    if (deathBlast) {
      deathBlast.life--;
      deathBlast.particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= p.friction;
        p.vy *= p.friction;
        p.life--;
      });
      deathBlast.particles = deathBlast.particles.filter(p => p.life > 0);
      if (deathBlast.life <= 0) deathBlast = null;
    }
    return;
  }

  if (paused) return;                          // frozen mid-run, P resumes
  if (hitPause > 0) { hitPause--; return; }   // impact freeze-frame
  if (bannerTime > 0) bannerTime--;
  if (comboTimer > 0) { comboTimer--; if (comboTimer === 0) combo = 0; }
  if (waveDelay > 0) {
    waveDelay--;
    if (waveDelay === 0) spawnWave();
  }

  // Player movement + banking. Holding a direction turns the ship to face it —
  // enemies loop around and attack from behind, so you must be able to fight
  // left as well as right.
  player.vx = 0;
  player.vy = 0;
  if (keys['ArrowLeft'] || keys['KeyA']) { player.vx = -player.speed; player.facing = -1; }
  if (keys['ArrowRight'] || keys['KeyD']) { player.vx = player.speed; player.facing = 1; }
  if (keys['ArrowUp'] || keys['KeyW']) player.vy = -player.speed;
  if (keys['ArrowDown'] || keys['KeyS']) player.vy = player.speed;

  // Free horizontal flight around the wrapping world; only altitude is clamped
  player.x = wrapX(player.x + player.vx);
  player.y = Math.max(30, Math.min(H - 55, player.y + player.vy));

  // Camera follows with a facing lead: the ship sits ~1/3 from the trailing
  // edge so most of the screen shows where you're going.
  const camTarget = wrapX(player.x + player.w / 2 - W * (player.facing > 0 ? 0.32 : 0.68));
  camX = wrapX(camX + wrapDX(camTarget, camX) * 0.08);

  // Smooth banking tilt (target based on vertical movement)
  const targetBank = player.vy * 0.045;
  player.bank += (targetBank - player.bank) * 0.18;

  if (keys['Space'] || keys['KeyZ']) fire();
  if (player.fireCooldown > 0) player.fireCooldown--;
  if (player.shieldTimer > 0) player.shieldTimer--;

  // Engine trail particles — emitted from the TAIL, which swaps ends when the
  // ship turns (facing right: tail = left edge; facing left: tail = right edge),
  // and the exhaust drifts opposite to the facing direction.
  if (Math.random() > 0.3) {
    trails.push({
      x: player.facing > 0 ? player.x + 2 : player.x + player.w - 2,
      y: player.y + player.h / 2 + (Math.random() - 0.5) * 8,
      life: 18 + Math.random() * 10,
      maxLife: 28,
      size: 2 + Math.random() * 3,
      vx: (-1.5 - Math.random() * 2) * player.facing,
      vy: (Math.random() - 0.5) * 1.5
    });
  }
  trails.forEach(t => {
    t.x += t.vx;
    t.y += t.vy;
    t.life--;
  });
  trails = trails.filter(t => t.life > 0);

  // Bullets (support vy for spread) + short neon trail particles
  bullets.forEach(b => {
    b.x = wrapX(b.x + b.speed * (b.dir || 1));   // travel in the direction the ship was facing
    if (b.vy) b.y += b.vy;
    // world coords wrap, so lasers die by range instead of screen edges
    if (b.range === undefined) b.range = W * 1.15;
    b.range -= b.speed;

    // Optional short trail sparks behind lasers
    if (Math.random() > 0.45) {
      laserTrails.push({
        x: b.x + Math.random() * 6,
        y: b.y + b.h / 2 + (Math.random() - 0.5) * 2,
        life: 6 + Math.random() * 5,
        maxLife: 11,
        size: b.type === 'heavy' ? 2.5 : 1.5,
        color: b.type === 'heavy' ? '#ff66cc' : '#67e8f9'
      });
    }
  });
  bullets = bullets.filter(b => b.range > 0 && b.y > -20 && b.y < H + 20);

  laserTrails.forEach(t => { t.life--; t.x -= 1.5; });
  laserTrails = laserTrails.filter(t => t.life > 0);

  // ---------- Fans & Abduction Logic ----------
  fans.forEach(f => {
    if (f.state === 'grabbed' && f.grabber) {
      // Follow the enemy that grabbed them
      f.x = f.grabber.x + f.grabber.w / 2 - 5;
      f.y = f.grabber.y + f.grabber.h + 2;
    } else if (f.state === 'falling') {
      f.fallVy += 0.28;
      f.y += f.fallVy;
      if (f.y >= H - 60) {
        f.y = H - 60;
        f.state = 'ground';
        f.fallVy = 0;
        f.grabber = null;
      }
    }
  });

  // Enemies AI + movement
  // "Cover fire": while any comrade is hauling a fan skyward, the shooters
  // press the attack to keep you off the rescue — killing the abductor fast
  // means flying INTO that fire. That's the risk/reward.
  const coverFire = enemies.some(en => en.carrying);
  enemies.forEach(e => {
    if (e.carrying) {
      // Carrying a fan → fly upward and away to abduct
      e.y -= 1.6;
      e.x = wrapX(e.x - e.speed * 0.7);
      // If they reach the top, the fan is lost forever — and the abductor
      // comes back down MEANER to hunt another one (mutant rules: survivors
      // keep attacking and abducting until you destroy them)
      if (e.y < -30) {
        abducted++;
        const idx = fans.indexOf(e.carrying);
        if (idx > -1) fans.splice(idx, 1);
        e.carrying = null;
        e.seeking = true;
        e.speed += 0.45;
        score = Math.max(0, score - 100);
        sfx.abduct();
        triggerShake(3, 12);
        updateHUD();
      }
    } else if (e.seeking) {
      // Target hunt: commit to a fan, cruise to its column,
      // then descend and grab. (The old version only dived when a fan was
      // within 280 units straight-line — but cruise altitude alone is ~350px
      // above the ground, so seekers never actually descended.)
      if (!e.target || e.target.state !== 'ground' || !fans.includes(e.target)) {
        e.target = null;
        let best = Infinity;
        fans.forEach(f => {
          if (f.state !== 'ground') return;
          const d = Math.abs(wrapDX(f.x, e.x));
          if (d < best) { best = d; e.target = f; }
        });
      }
      if (e.target) {
        const dx = wrapDX(e.target.x, e.x + e.w / 2);
        if (Math.abs(dx) > 14) {
          // travel leg — fly toward the fan's column at hunting speed
          e.dir = Math.sign(dx);
          e.x = wrapX(e.x + e.dir * e.speed);
        }
        if (Math.abs(dx) < 110) {
          // over the target — DESCEND for the grab
          const hover = e.target.y - e.h - 4;
          e.y += Math.min(hover - e.y, e.speed * 0.85);
          if (Math.abs(dx) < 20 && e.y > hover - 12) {
            e.target.state = 'grabbed';
            e.target.grabber = e;
            e.carrying = e.target;
            e.target = null;
            e.seeking = false;
          }
        } else if (e.y > 90 + (e.x % 70)) {
          // long way to go — climb back to cruise altitude while traveling
          e.y -= e.speed * 0.4;
        }
      } else {
        // No fans left on the ground → become a pure attacker
        e.seeking = false;
      }
    } else {
      e.x = wrapX(e.x + e.speed * e.dir);
      if (e.type === 'ghost') e.y += Math.sin(Date.now() * 0.004 + e.x) * 0.6;
      // Attackers near the player drift toward their altitude so a pass is a
      // genuine threat, whichever side it comes from
      const gap = wrapDX(player.x, e.x);
      if (Math.abs(gap) < W * 1.2) {
        const py = player.y + player.h / 2;
        e.y += Math.sign(py - (e.y + e.h / 2)) * Math.min(0.7, e.speed * 0.35);
      }
      // Persistent hunters: an undestroyed enemy far away turns back toward
      // you — sooner by chance, or FORCED after ~4s so nothing loiters in the
      // empty half of the world where you can't fight it
      if (Math.abs(gap) > W * 1.2) {
        e.awayTime = (e.awayTime || 0) + 1;
        if ((Math.random() < 0.01 || e.awayTime > 240) && Math.sign(gap) !== e.dir) {
          e.dir = Math.sign(gap) || 1;
          e.loops++;
          e.awayTime = 0;
        }
      } else {
        e.awayTime = 0;
      }
    }

    // ---- Shooting (spheres + pyramids only, when visible) ----
    if (!e.carrying && (e.type === 'sphere' || e.type === 'pyramid')) {
      const esx = toScreen(e.x);
      const onScreen = esx > -40 && esx < W + 40;
      if (onScreen) {
        // shooters fire ~2x faster while a comrade is hauling a fan away
        e.shootTimer -= coverFire ? 2 : 1;
        if (e.type === 'pyramid' && e.shootTimer <= 30 && e.shootTimer > 0) {
          e.charge = 1 - e.shootTimer / 30;   // eye glows as it winds up
        }
        if (e.shootTimer <= 0) {
          enemyFire(e);
          e.charge = 0;
          const base = e.type === 'pyramid' ? 260 : 170;
          e.shootTimer = base + Math.random() * 180 - wave * 6;
        }
      } else {
        e.charge = 0;
      }
    }
  });

  // ---- Enemy shots ----
  enemyShots.forEach(s => { s.x = wrapX(s.x + s.vx); s.y += s.vy; s.life--; });
  enemyShots = enemyShots.filter(s => s.life > 0 && s.y > -30 && s.y < H + 30);
  if (player.shieldTimer <= 0) {
    for (let si = enemyShots.length - 1; si >= 0; si--) {
      const s = enemyShots[si];
      const sdx = wrapDX(s.x, player.x);
      if (sdx > 0 && sdx < player.w &&
          s.y > player.y && s.y < player.y + player.h) {
        enemyShots.splice(si, 1);
        hitPlayer();
        break;
      }
    }
  }

  // Collisions: bullets vs enemies
  bullets.forEach((b, bi) => {
    enemies.forEach((e, ei) => {
      const bdx = wrapDX(b.x, e.x);   // wrap-aware rect overlap
      if (bdx < e.w && bdx > -b.w &&
          b.y < e.y + e.h && b.y + b.h > e.y) {
        createExplosion(e.x + e.w / 2, e.y + e.h / 2, e.type === 'ghost' ? '#c084fc' : '#22d3ee');
        sfx.explosion(soundPan(toScreen(e.x + e.w / 2)));

        // Free the fan if this enemy was carrying one
        if (e.carrying) {
          e.carrying.state = 'falling';
          e.carrying.fallVy = -1.5;
          e.carrying.grabber = null;
          e.carrying = null;
          score += 250; // big rescue bonus
          rescued++;
          sfx.rescue();
          triggerShake(4, 14); // light shake on rescue
        }

        // Chance to drop a power-up
        if (Math.random() < 0.22) {
          spawnPowerup(e.x + e.w / 2, e.y + e.h / 2);
        }

        enemies.splice(ei, 1);
        bullets.splice(bi, 1);
        combo++;
        comboTimer = 150;
        const points = { ghost: 150, sphere: 120, capsule: 180, cylinder: 140, pyramid: 200 };
        score += (points[e.type] || 100) * comboMult();
        if (b.type === 'heavy') score += 40;
        hitPause = 2;
        updateHUD();
      }
    });
  });

  // Player vs enemies (with shield flicker)
  enemies.forEach((e, ei) => {
    if (player.shieldTimer > 0) return;
    const pdx = wrapDX(player.x, e.x);   // wrap-aware rect overlap
    if (pdx < e.w && pdx > -player.w &&
        player.y < e.y + e.h && player.y + player.h > e.y) {
      // Drop fan if carrying
      if (e.carrying) {
        e.carrying.state = 'falling';
        e.carrying.fallVy = -1;
        e.carrying.grabber = null;
        e.carrying = null;
      }

      enemies.splice(ei, 1);
      hitPlayer();
    }
  });

  // Nothing despawns any more: the world wraps, and even successful abductors
  // dive back in to hunt again (see the carrying branch). The only way an
  // enemy leaves this wave is by being destroyed.

  // Next wave — breather: banner shows for a beat before enemies spawn
  if (enemies.length === 0 && waveDelay === 0) {
    wave++;
    // Respawn a few more fans if running low
    if (fans.filter(f => f.state === 'ground' || f.state === 'falling').length < 6) {
      for (let i = 0; i < 4; i++) {
        fans.push({
          x: Math.random() * WORLD_W,
          y: H - 60,
          w: 10, h: 16,
          state: 'ground',
          grabber: null,
          fallVy: 0,
          color: Math.random() > 0.5 ? '#f0abfc' : '#c4b5fd'
        });
      }
    }
    bannerText = 'WAVE ' + wave;
    bannerTime = 90;
    waveDelay = 75;
    updateHUD();
  }

  // ---------- Power-ups ----------
  if (player.powerupTime > 0) {
    player.powerupTime--;
    if (player.powerupTime <= 0) {
      player.shotType = 0; // back to dual
    }
  }

  // Move + collect power-ups
  powerups.forEach((p, pi) => {
    p.bob += 0.08;
    p.y += Math.sin(p.bob) * 0.6;
    p.life--;

    // Player pickup (wrap-aware)
    const pudx = wrapDX(player.x, p.x);
    if (pudx < p.w && pudx > -player.w &&
        player.y < p.y + p.h && player.y + player.h > p.y) {
      player.shotType = p.type;
      player.powerupTime = 480; // ~8 seconds
      createExplosion(p.x + 11, p.y + 11, p.color);
      sfx.powerup();
      powerups.splice(pi, 1);
      score += 50;
      updateHUD();
    }
  });
  powerups = powerups.filter(p => p.life > 0 && p.y < H + 20);

  // Particles
  particles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.life--;
  });
  particles = particles.filter(p => p.life > 0);

  // Dramatic death blast update
  if (deathBlast) {
    deathBlast.life--;
    deathBlast.particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= p.friction;
      p.vy *= p.friction;
      p.life--;
    });
    deathBlast.particles = deathBlast.particles.filter(p => p.life > 0);
    if (deathBlast.life <= 0) deathBlast = null;
  }
}

function createExplosion(x, y, color) {
  for (let i = 0; i < 10; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 6,
      vy: (Math.random() - 0.5) * 6,
      life: 20 + Math.random() * 15,
      color
    });
  }
}

function createDeathBlast(x, y) {
  // Massive colorful full-screen death explosion
  const colors = ['#ff00aa', '#00ff88', '#00ccff', '#ffee00', '#ff4400', '#c084fc', '#ffffff', '#ff66cc', '#22d3ee'];
  deathBlast = {
    x, y,
    life: 70,
    maxLife: 70,
    particles: []
  };
  // Huge ring of particles
  for (let i = 0; i < 180; i++) {
    const angle = (i / 180) * Math.PI * 2;
    const speed = 3 + Math.random() * 14;
    deathBlast.particles.push({
      x: x,
      y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 40 + Math.random() * 40,
      size: 2 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      friction: 0.97 + Math.random() * 0.02
    });
  }
  // Extra secondary burst
  for (let i = 0; i < 60; i++) {
    deathBlast.particles.push({
      x: x + (Math.random() - 0.5) * 40,
      y: y + (Math.random() - 0.5) * 40,
      vx: (Math.random() - 0.5) * 18,
      vy: (Math.random() - 0.5) * 18,
      life: 30 + Math.random() * 35,
      size: 3 + Math.random() * 8,
      color: colors[Math.floor(Math.random() * colors.length)],
      friction: 0.96
    });
  }
}

// ============================================================
// DRAW HELPERS — Parallax layers, pilot, manor
// ============================================================

/** Layer 0: twinkling stars (very slow scroll) */
function drawStars() {
  ctx.fillStyle = '#e0d4ff';
  for (let i = 0; i < 80; i++) {
    const sx = (((i * 97 - parallax.stars) % W) + W) % W;   // drift opposite the camera
    const sy = (i * 53) % (H - 110);
    ctx.globalAlpha = 0.22 + (i % 5) * 0.14;
    const size = (i % 7 === 0) ? 2 : 1.4;
    ctx.fillRect(sx, sy, size, size);
  }
  ctx.globalAlpha = 1;
}

/** Full moon (kept, stationary glow) */
function drawMoon() {
  ctx.beginPath();
  ctx.arc(W - 110, 70, 38, 0, Math.PI * 2);
  ctx.fillStyle = '#e9d5ff';
  ctx.shadowColor = '#c084fc';
  ctx.shadowBlur = 30;
  ctx.fill();
  ctx.shadowBlur = 0;
  // moon craters
  ctx.fillStyle = 'rgba(180, 140, 220, 0.25)';
  ctx.beginPath(); ctx.arc(W - 125, 60, 8, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(W - 100, 80, 6, 0, Math.PI * 2); ctx.fill();
}

/** Layer 1: distant rolling hills (slow scroll)
 *  Sine periods align with the wrap span (W*2) so the layer never snaps,
 *  and low amplitude keeps it reading as far-away land, not waves. */
function hillY(x) {
  const span = W * 2;
  const k1 = (Math.PI * 2 * 4) / span;  // 4 full cycles per wrap
  const k2 = (Math.PI * 2 * 9) / span;  // 9 full cycles per wrap
  return (H - 96)
    - Math.sin((x + parallax.hillsFar) * k1) * 11
    - Math.sin((x + parallax.hillsFar) * k2) * 5
    - 6;
}
function drawDistantHills() {
  ctx.fillStyle = '#10081c';
  ctx.beginPath();
  ctx.moveTo(0, H);
  ctx.lineTo(0, hillY(0));
  for (let x = 0; x <= W; x += 16) ctx.lineTo(x, hillY(x));
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();

  // Very soft ridge highlight (dim — it's far away)
  ctx.strokeStyle = 'rgba(88, 40, 140, 0.18)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 16) {
    if (x === 0) ctx.moveTo(x, hillY(x));
    else ctx.lineTo(x, hillY(x));
  }
  ctx.stroke();
}

/**
 * Layer 2: haunted Victorian manor silhouette on a hill
 * Medium parallax speed, slightly transparent, 4–6 glowing windows
 */
function drawManorSilhouette() {
  // Manor drifts across at medium speed; wraps past left edge
  const manorX = W + 40 - parallax.manor;
  const manorBase = H - 100;

  ctx.save();
  ctx.globalAlpha = 0.72;

  // Hill under the manor
  ctx.fillStyle = '#0c0614';
  ctx.beginPath();
  ctx.moveTo(manorX - 40, manorBase + 20);
  ctx.quadraticCurveTo(manorX + 90, manorBase - 18, manorX + 240, manorBase + 20);
  ctx.lineTo(manorX + 240, manorBase + 30);
  ctx.lineTo(manorX - 40, manorBase + 30);
  ctx.closePath();
  ctx.fill();

  // Main house body
  ctx.fillStyle = '#080410';
  ctx.fillRect(manorX + 40, manorBase - 95, 130, 95);
  // Left wing
  ctx.fillRect(manorX + 5, manorBase - 72, 48, 72);
  // Right tower
  ctx.fillRect(manorX + 160, manorBase - 130, 42, 130);
  // Far right annex
  ctx.fillRect(manorX + 195, manorBase - 58, 36, 58);

  // Main roof peak (Victorian gable)
  ctx.beginPath();
  ctx.moveTo(manorX + 32, manorBase - 95);
  ctx.lineTo(manorX + 105, manorBase - 148);
  ctx.lineTo(manorX + 178, manorBase - 95);
  ctx.closePath();
  ctx.fill();

  // Tower spire
  ctx.beginPath();
  ctx.moveTo(manorX + 155, manorBase - 130);
  ctx.lineTo(manorX + 181, manorBase - 172);
  ctx.lineTo(manorX + 207, manorBase - 130);
  ctx.closePath();
  ctx.fill();

  // Chimney
  ctx.fillRect(manorX + 72, manorBase - 158, 11, 28);
  // Tiny turret
  ctx.fillRect(manorX + 128, manorBase - 118, 16, 24);
  ctx.beginPath();
  ctx.moveTo(manorX + 125, manorBase - 118);
  ctx.lineTo(manorX + 136, manorBase - 138);
  ctx.lineTo(manorX + 147, manorBase - 118);
  ctx.closePath();
  ctx.fill();

  // Door (darker recess)
  ctx.fillStyle = '#05020a';
  ctx.fillRect(manorX + 88, manorBase - 32, 22, 32);

  ctx.globalAlpha = 1;

  // Glowing purple / amber windows (6 windows, readable silhouette)
  const winColors = ['#c084fc', '#f59e0b', '#e879f9', '#c084fc', '#fbbf24', '#d8b4fe'];
  const windows = [
    [manorX + 55, manorBase - 72, 12, 14],
    [manorX + 95, manorBase - 72, 12, 14],
    [manorX + 135, manorBase - 72, 12, 14],
    [manorX + 18, manorBase - 52, 11, 13],
    [manorX + 170, manorBase - 100, 10, 14],
    [manorX + 170, manorBase - 60, 10, 14]
  ];
  windows.forEach((w, i) => {
    const flicker = 0.55 + Math.sin(Date.now() * 0.0035 + i * 1.7) * 0.25;
    ctx.globalAlpha = flicker;
    ctx.shadowColor = winColors[i];
    ctx.shadowBlur = 10;
    ctx.fillStyle = winColors[i];
    ctx.fillRect(w[0], w[1], w[2], w[3]);
  });
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  ctx.restore();
}

/** Layer 3: solid foreground ground — flat earth with scrolling
 *  tombstones, grass tufts and fence posts (no more water-waves) */
function drawForegroundGround() {
  const groundY = H - 44;

  // Solid earth with a subtle vertical gradient
  const g = ctx.createLinearGradient(0, groundY, 0, H);
  g.addColorStop(0, '#150b24');
  g.addColorStop(1, '#0c0616');
  ctx.fillStyle = g;
  ctx.fillRect(0, groundY, W, H - groundY);

  // Dim top edge
  ctx.strokeStyle = 'rgba(124, 58, 237, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(W, groundY);
  ctx.stroke();

  // Deterministic scrolling features, seamless across the wrap span
  // (1280 divides WORLD_W exactly — see the parallax comment in update())
  const span = 1280;
  const off = parallax.ground;
  const SPACING = 68;
  const count = Math.ceil(span / SPACING);
  for (let i = 0; i < count; i++) {
    const sx = ((i * SPACING - off) % span + span) % span - 60;
    if (sx < -40 || sx > W + 40) continue;
    const kind = i % 5;
    ctx.fillStyle = '#241536';
    if (kind === 0) {
      // tombstone
      const th = 10 + (i * 7) % 6;
      ctx.beginPath();
      ctx.moveTo(sx - 5, groundY);
      ctx.lineTo(sx - 5, groundY - th + 4);
      ctx.arc(sx, groundY - th + 4, 5, Math.PI, 0);
      ctx.lineTo(sx + 5, groundY);
      ctx.closePath();
      ctx.fill();
    } else if (kind === 2) {
      // fence post with a slat
      ctx.fillRect(sx - 1.5, groundY - 12, 3, 12);
      ctx.fillRect(sx - 10, groundY - 9, 20, 2);
    } else {
      // grass tuft
      ctx.strokeStyle = '#1e1230';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sx, groundY); ctx.lineTo(sx - 3, groundY - 6);
      ctx.moveTo(sx, groundY); ctx.lineTo(sx, groundY - 7);
      ctx.moveTo(sx, groundY); ctx.lineTo(sx + 3, groundY - 5);
      ctx.stroke();
    }
  }
}

/** Concert stage — a fixed landmark in the WORLD (world x 180), so flying a
 *  full lap brings you back to it. Skipped entirely when off-screen. */
function drawConcertStage() {
  const stageX = toScreen(180);
  if (stageX < -320 || stageX > W + 100) return;
  const stageY = H - 78;

  // Stage platform
  ctx.fillStyle = '#1e1b4b';
  ctx.fillRect(stageX, stageY, 220, 18);
  // Stage front edge glow
  ctx.fillStyle = '#7c3aed';
  ctx.fillRect(stageX, stageY + 16, 220, 3);

  // Stage backdrop / screen
  ctx.fillStyle = '#0f0a1f';
  ctx.fillRect(stageX + 20, stageY - 55, 180, 55);
  ctx.fillStyle = 'rgba(192, 132, 252, 0.15)';
  ctx.fillRect(stageX + 25, stageY - 50, 170, 45);

  // Ghost Circuit logo on screen
  ctx.fillStyle = '#c084fc';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('GHOST CIRCUIT', stageX + 110, stageY - 25);
  ctx.font = '10px sans-serif';
  ctx.fillStyle = '#a78bfa';
  ctx.fillText('LIVE', stageX + 110, stageY - 10);

  // Speakers / stacks
  ctx.fillStyle = '#1e1b4b';
  ctx.fillRect(stageX - 25, stageY - 40, 22, 55);
  ctx.fillRect(stageX + 223, stageY - 40, 22, 55);
  ctx.fillStyle = '#4c1d95';
  ctx.beginPath(); ctx.arc(stageX - 14, stageY - 20, 7, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(stageX - 14, stageY + 5, 7, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(stageX + 234, stageY - 20, 7, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(stageX + 234, stageY + 5, 7, 0, Math.PI * 2); ctx.fill();

  // Animated stage light beams
  const t = Date.now() * 0.002;
  const lightColors = [
    'rgba(192,132,252,0.12)',
    'rgba(34,211,238,0.10)',
    'rgba(244,114,182,0.10)',
    'rgba(167,139,250,0.12)'
  ];
  for (let i = 0; i < 4; i++) {
    const lx = stageX + 40 + i * 45;
    const angle = Math.sin(t + i * 1.3) * 0.35;
    const beamLen = 160 + Math.sin(t * 1.5 + i) * 30;

    ctx.save();
    ctx.translate(lx, stageY - 55);
    ctx.rotate(angle);
    const beamGrad = ctx.createLinearGradient(0, 0, 0, -beamLen);
    beamGrad.addColorStop(0, lightColors[i]);
    beamGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.moveTo(-8, 0);
    ctx.lineTo(8, 0);
    ctx.lineTo(25, -beamLen);
    ctx.lineTo(-25, -beamLen);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Light fixtures
  for (let i = 0; i < 4; i++) {
    const lx = stageX + 40 + i * 45;
    ctx.fillStyle = '#c084fc';
    ctx.shadowColor = '#c084fc';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(lx, stageY - 55, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}

/**
 * Player — pilot silhouette in a sleek purple energy fighter
 * Readable at ~44px wide; keeps banking + thruster flames
 */
function drawPlayer() {
  ctx.save();
  ctx.translate(toScreen(player.x) + 22, player.y + 10); // pivot near center (screen coords)
  ctx.rotate(player.bank * player.facing);     // bank reads correctly when mirrored
  ctx.scale(player.facing, 1);                 // mirror the whole ship when facing left
  ctx.translate(-22, -10);

  // Shield flicker when hit
  if (player.shieldTimer > 0) {
    const flash = Math.sin(player.shieldTimer * 0.6) > 0;
    if (flash) {
      ctx.shadowColor = '#f0abfc';
      ctx.shadowBlur = 28;
      ctx.strokeStyle = 'rgba(240, 171, 252, 0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(22, 10, 32, 18, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Outer energy glow
  ctx.shadowColor = '#c084fc';
  ctx.shadowBlur = 16;

  // --- Sleek purple energy fighter hull ---
  // Lower fuselage
  ctx.fillStyle = '#1a1438';
  ctx.beginPath();
  ctx.moveTo(44, 10);
  ctx.lineTo(30, 4);
  ctx.lineTo(6, 3);
  ctx.lineTo(0, 7);
  ctx.lineTo(0, 13);
  ctx.lineTo(6, 17);
  ctx.lineTo(30, 16);
  ctx.closePath();
  ctx.fill();

  // Wing blades
  ctx.fillStyle = '#6d28d9';
  ctx.beginPath();
  ctx.moveTo(24, 3);
  ctx.lineTo(10, -5);
  ctx.lineTo(16, 4);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(24, 17);
  ctx.lineTo(10, 25);
  ctx.lineTo(16, 16);
  ctx.closePath();
  ctx.fill();

  // Energy core stripe
  ctx.fillStyle = '#a855f7';
  ctx.beginPath();
  ctx.moveTo(40, 10);
  ctx.lineTo(22, 6);
  ctx.lineTo(10, 10);
  ctx.lineTo(22, 14);
  ctx.closePath();
  ctx.fill();

  // Nose tip
  ctx.fillStyle = '#e879f9';
  ctx.beginPath();
  ctx.moveTo(44, 10);
  ctx.lineTo(36, 7);
  ctx.lineTo(36, 13);
  ctx.closePath();
  ctx.fill();

  // Cockpit rim (open top so pilot reads clearly)
  ctx.strokeStyle = '#c084fc';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(26, 8, 9, 5.5, 0, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();

  // --- Pilot silhouette (humanoid, readable at small size) ---
  ctx.shadowBlur = 0;

  // Legs tucked into cockpit
  ctx.fillStyle = '#1e1b4b';
  ctx.fillRect(20, 9, 3, 5);
  ctx.fillRect(25, 9, 3, 5);

  // Torso
  ctx.fillStyle = '#2e1065';
  ctx.beginPath();
  ctx.moveTo(20, 9);
  ctx.lineTo(19, 3);
  ctx.lineTo(29, 3);
  ctx.lineTo(28, 9);
  ctx.closePath();
  ctx.fill();

  // Arms on controls
  ctx.strokeStyle = '#3b0764';
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(20, 5);
  ctx.lineTo(15, 8);
  ctx.moveTo(28, 5);
  ctx.lineTo(33, 8);
  ctx.stroke();

  // Head
  ctx.fillStyle = '#4c1d95';
  ctx.beginPath();
  ctx.arc(24, 1.5, 3.2, 0, Math.PI * 2);
  ctx.fill();

  // Dark hair
  ctx.fillStyle = '#0f0a14';
  ctx.beginPath();
  ctx.arc(24, 0.5, 3.3, Math.PI * 1.05, Math.PI * 1.95);
  ctx.fill();
  // Hair tuft / side
  ctx.fillRect(21.2, -1.2, 5.6, 2.2);

  // Tiny face highlight (readability)
  ctx.fillStyle = 'rgba(196, 181, 253, 0.45)';
  ctx.fillRect(23, 1.5, 1.5, 1.2);

  // Thruster flames
  ctx.shadowColor = '#22d3ee';
  ctx.shadowBlur = 14;
  ctx.fillStyle = '#22d3ee';
  ctx.beginPath();
  ctx.moveTo(0, 6);
  ctx.lineTo(-11 - Math.random() * 5, 10);
  ctx.lineTo(0, 14);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#67e8f9';
  ctx.fillRect(-5, 3, 6, 3);
  ctx.fillRect(-5, 13, 6, 3);
  // Hot core of flame
  ctx.fillStyle = '#ecfeff';
  ctx.beginPath();
  ctx.moveTo(0, 8);
  ctx.lineTo(-6 - Math.random() * 2, 10);
  ctx.lineTo(0, 12);
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.restore();
}

/** Neon lasers with optional trails */
// Enemy fire — deliberately a different colour language from your neon lasers
// (hot red/orange vs cyan/magenta) so incoming vs outgoing reads instantly.
function drawEnemyShots() {
  enemyShots.forEach(s => {
    const sx = toScreen(s.x);
    if (sx < -40 || sx > W + 40) return;
    if (s.kind === 'beam') {
      ctx.shadowColor = '#f97316';
      ctx.shadowBlur = 16;
      ctx.fillStyle = '#fb923c';
      ctx.fillRect(sx - 14, s.y - 2.5, 28, 5);
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(sx - 10, s.y - 1, 20, 2);
    } else {
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#f87171';
      ctx.beginPath();
      ctx.arc(sx, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fee2e2';
      ctx.beginPath();
      ctx.arc(sx, s.y, s.r * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  ctx.shadowBlur = 0;
}

function drawBullets() {
  // Short trail particles first (behind beams)
  laserTrails.forEach(t => {
    const sx = toScreen(t.x);
    if (sx < -20 || sx > W + 20) return;
    const a = t.life / t.maxLife;
    ctx.globalAlpha = a * 0.7;
    ctx.fillStyle = t.color;
    ctx.beginPath();
    ctx.arc(sx, t.y, t.size * a, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  bullets.forEach(b => {
    const bx = toScreen(b.x);
    if (bx < -30 || bx > W + 30) return;
    if (b.type === 'heavy') {
      // Heavy = thick magenta/pink laser
      ctx.shadowColor = '#ff00aa';
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#ff66cc';
      ctx.fillRect(bx, b.y - 1, b.w + 4, b.h + 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(bx + 2, b.y + 1, b.w - 2, b.h - 2);
    } else {
      // Bright cyan/green core with a strong glow
      ctx.shadowColor = '#00ff99';
      ctx.shadowBlur = 16;
      // Outer green glow
      ctx.fillStyle = 'rgba(0, 255, 136, 0.55)';
      ctx.fillRect(bx - 1, b.y - 2, b.w + 8, b.h + 4);
      // Mid cyan body
      ctx.fillStyle = '#00ff88';
      ctx.fillRect(bx, b.y - 1, b.w + 5, b.h + 2);
      // Hot cyan-white core
      ctx.fillStyle = '#ccffee';
      ctx.fillRect(bx + 1, b.y, b.w + 2, b.h);
      // Bright tip
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(bx + b.w - 1, b.y, 7, b.h);
    }
  });
  ctx.shadowBlur = 0;
}

/** Thin purple abduction beam from UAP down to grabbed fan */
function drawAbductionBeams() {
  enemies.forEach(e => {
    if (!e.carrying) return;
    const esx = toScreen(e.x);
    if (esx < -60 || esx > W + 60) return;
    const shiftX = esx - e.x;   // same shift for both ends keeps the beam joined
    const fan = e.carrying;
    const topX = e.x + e.w / 2 + shiftX;
    const topY = e.y + e.h;
    const botX = fan.x + 5 + shiftX;
    const botY = fan.y;

    // Soft outer glow
    ctx.strokeStyle = 'rgba(192, 132, 252, 0.25)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.lineTo(botX, botY);
    ctx.stroke();

    // Thin core beam
    const pulse = 0.55 + Math.sin(Date.now() * 0.02) * 0.25;
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = '#e879f9';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = '#c084fc';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.lineTo(botX, botY);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    // Small energy motes along the beam
    for (let i = 0; i < 3; i++) {
      const t = ((Date.now() * 0.004 + i * 0.33) % 1);
      const mx = topX + (botX - topX) * t;
      const my = topY + (botY - topY) * t;
      ctx.fillStyle = 'rgba(240, 171, 252, 0.8)';
      ctx.beginPath();
      ctx.arc(mx, my, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

// ---------- Draw ----------
function draw() {
  // Apply screen shake via canvas transform
  ctx.save();
  ctx.translate(shake.x, shake.y);

  // Background sky
  ctx.fillStyle = '#0a0612';
  ctx.fillRect(-10, -10, W + 20, H + 20);

  // Distant purple nebula / atmosphere
  const skyGrad = ctx.createLinearGradient(0, 0, 0, H - 60);
  skyGrad.addColorStop(0, '#0a0612');
  skyGrad.addColorStop(0.55, '#130a24');
  skyGrad.addColorStop(1, '#1a0f2e');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(-10, -10, W + 20, H + 20);

  // ===== PARALLAX LAYERS =====
  drawStars();          // Layer 0 — very slow
  drawMoon();           // stationary
  drawDistantHills();   // Layer 1 — slow
  drawManorSilhouette();// Layer 2 — medium, translucent
  drawConcertStage();
  drawForegroundGround();// Layer 3 — fastest + purple glow

  // Engine trails (behind ship)
  trails.forEach(t => {
    const sx = toScreen(t.x);
    if (sx < -20 || sx > W + 20) return;
    const alpha = t.life / t.maxLife;
    ctx.globalAlpha = alpha * 0.7;
    ctx.fillStyle = alpha > 0.5 ? '#67e8f9' : '#c084fc';
    ctx.beginPath();
    ctx.arc(sx, t.y, t.size * alpha, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  // Player (pilot + fighter)
  if (gameRunning || (deathBlast && deathBlast.life > 50)) {
    // Hide ship once death blast is underway
    if (!(deathBlast && deathBlast.life <= 55)) {
      drawPlayer();
    }
  }

  // Neon lasers
  drawBullets();
  drawEnemyShots();

  // Enemies — alien attackers: pilots in glowing cockpits, running lights, a wraith
  const blinkOn = Math.floor(Date.now() / 250) % 2 === 0;
  enemies.forEach(e => {
    // World → screen: shift the whole context so the sprite code below can
    // keep drawing in world coordinates. Off-screen enemies are skipped.
    const shiftX = toScreen(e.x) - e.x;
    if (toScreen(e.x) < -90 || toScreen(e.x) > W + 90) return;
    ctx.save();
    ctx.translate(shiftX, 0);
    const cx = e.x + e.w / 2;
    const cy = e.y + e.h / 2;

    // little grey pilot: dome head + huge black almond eyes
    const alienPilot = (px, py, r) => {
      ctx.fillStyle = '#b8ce9d';
      ctx.beginPath();
      ctx.ellipse(px, py, r, r * 1.15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0a0a12';
      ctx.beginPath();
      ctx.ellipse(px - r * 0.45, py - r * 0.1, r * 0.32, r * 0.5, 0.5, 0, Math.PI * 2);
      ctx.ellipse(px + r * 0.45, py - r * 0.1, r * 0.32, r * 0.5, -0.5, 0, Math.PI * 2);
      ctx.fill();
    };

    if (e.type === 'ghost') {
      // wraith — wavy skirt, hollow glare, trailing wisps
      const wob = Date.now() * 0.008 + e.x * 0.05;
      ctx.fillStyle = 'rgba(167,139,250,0.9)';
      ctx.shadowColor = '#a78bfa';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(cx, cy - 3, e.w / 2, Math.PI, 0);
      // scalloped, rippling bottom
      const hem = cy + e.h / 2 - 4;
      ctx.lineTo(cx + e.w / 2, hem);
      for (let i = 0; i < 4; i++) {
        const sx = cx + e.w / 2 - (i + 0.5) * (e.w / 4);
        ctx.quadraticCurveTo(sx + e.w / 16, hem + 5 + Math.sin(wob + i) * 3, sx - e.w / 16, hem);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      // hollow glaring eyes + angry brows
      ctx.fillStyle = '#1a0a2e';
      ctx.beginPath();
      ctx.arc(cx - 5, cy - 4, 3.2, 0, Math.PI * 2);
      ctx.arc(cx + 5, cy - 4, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1a0a2e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 9, cy - 10); ctx.lineTo(cx - 2, cy - 7);
      ctx.moveTo(cx + 9, cy - 10); ctx.lineTo(cx + 2, cy - 7);
      ctx.stroke();
      // glowing eye cores
      ctx.fillStyle = '#f0abfc';
      ctx.fillRect(cx - 6, cy - 5, 2, 2);
      ctx.fillRect(cx + 4, cy - 5, 2, 2);
    } else if (e.type === 'sphere') {
      // orb scout — metal ball, equator lights, glass dome with pilot
      const grad = ctx.createRadialGradient(cx - 4, cy - 4, 2, cx, cy, e.w / 2);
      grad.addColorStop(0, '#cbd5e1');
      grad.addColorStop(1, '#334155');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, e.w / 2, 0, Math.PI * 2);
      ctx.fill();
      // equator band with blinking running lights
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 2, e.w / 2 - 1, 4, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = blinkOn ? '#4ade80' : '#166534';
      [-8, 0, 8].forEach(dx => ctx.fillRect(cx + dx - 1.5, cy + 4, 3, 3));
      // glass dome + pilot
      ctx.fillStyle = 'rgba(103,232,249,0.35)';
      ctx.beginPath();
      ctx.arc(cx, cy - 4, 7, Math.PI, 0);
      ctx.fill();
      alienPilot(cx, cy - 6, 3.4);
    } else if (e.type === 'capsule') {
      // abductor craft — hull, cockpit window with pilot, engine glow
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.roundRect(e.x, e.y, e.w, e.h, e.h / 2);
      ctx.fill();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // cockpit
      ctx.fillStyle = 'rgba(103,232,249,0.4)';
      ctx.beginPath();
      ctx.ellipse(e.x + e.w - 11, cy, 7, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      alienPilot(e.x + e.w - 11, cy - 1, 3);
      // engine glow at the back
      ctx.fillStyle = blinkOn ? '#f472b6' : '#be185d';
      ctx.beginPath();
      ctx.ellipse(e.x + 3, cy, 3, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === 'cylinder') {
      // mothership shard — hull with window rows + top dome pilot
      ctx.fillStyle = '#64748b';
      ctx.fillRect(e.x + 4, e.y, e.w - 8, e.h);
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.ellipse(cx, e.y + 3, (e.w - 8) / 2, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx, e.y + e.h - 3, (e.w - 8) / 2, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      // rows of lit windows (alternate blink)
      for (let r = 0; r < 3; r++) {
        const on = (Math.floor(Date.now() / 300) + r) % 2 === 0;
        ctx.fillStyle = on ? '#67e8f9' : '#155e75';
        ctx.fillRect(e.x + 8, e.y + 5 + r * 6, 4, 3);
        ctx.fillRect(e.x + e.w - 12, e.y + 5 + r * 6, 4, 3);
      }
      // dome on top with pilot
      ctx.fillStyle = 'rgba(103,232,249,0.35)';
      ctx.beginPath();
      ctx.arc(cx, e.y - 1, 6, Math.PI, 0);
      ctx.fill();
      alienPilot(cx, e.y - 3, 2.8);
    } else if (e.type === 'pyramid') {
      // void pyramid — obsidian faces + glowing eye
      ctx.fillStyle = '#2e1065';
      ctx.beginPath();
      ctx.moveTo(cx, e.y);
      ctx.lineTo(e.x + e.w, e.y + e.h);
      ctx.lineTo(e.x, e.y + e.h);
      ctx.closePath();
      ctx.fill();
      // face edge
      ctx.strokeStyle = '#e879f9';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, e.y);
      ctx.lineTo(cx + 4, e.y + e.h);
      ctx.stroke();
      // the Eye — pulses idly, then flares red as the beam winds up. The
      // charge is the tell: you have ~0.5s to change altitude and dodge.
      const charging = e.charge > 0;
      const pulse = charging
        ? 0.55 + e.charge * 0.45
        : 0.6 + Math.sin(Date.now() * 0.006) * 0.4;
      ctx.fillStyle = charging
        ? `rgba(248,113,113,${pulse})`
        : `rgba(232,121,249,${pulse})`;
      ctx.shadowColor = charging ? '#ef4444' : '#e879f9';
      ctx.shadowBlur = charging ? 10 + e.charge * 22 : 10;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 3, 6 + e.charge * 3, 3.5 + e.charge * 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#0a0612';
      ctx.beginPath();
      ctx.arc(cx, cy + 3, 1.8, 0, Math.PI * 2);
      ctx.fill();
      // Targeting beam while charging — a short, growing, gradient-faded ray
      // in front of the eye. (The old version was a dashed line across the
      // whole row, which read as a rendering glitch rather than an attack tell.)
      if (charging) {
        const aim = wrapDX(player.x, cx) < 0 ? -1 : 1;
        const reach = (40 + e.charge * 130) * aim;   // grows with the wind-up
        const grad = ctx.createLinearGradient(cx, 0, cx + reach, 0);
        grad.addColorStop(0, `rgba(248,113,113,${0.25 + e.charge * 0.65})`);
        grad.addColorStop(1, 'rgba(248,113,113,0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2 + e.charge * 2;
        ctx.beginPath();
        ctx.moveTo(cx + 8 * aim, cy + 3);
        ctx.lineTo(cx + reach, cy + 3);
        ctx.stroke();
      }
    }
    ctx.restore(); // end world→screen shift for this enemy
  });

  // Purple abduction beams (UAP → fan)
  drawAbductionBeams();

  // Power-ups
  powerups.forEach(p => {
    const px = toScreen(p.x);
    if (px < -30 || px > W + 30) return;
    const alpha = Math.min(1, p.life / 60);
    ctx.globalAlpha = alpha;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 15;
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px + 11, p.y + 11, 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(10, 6, 18, 0.85)';
    ctx.beginPath();
    ctx.arc(px + 11, p.y + 11, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.color;
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.label, px + 11, p.y + 11);
    ctx.shadowBlur = 0;
  });
  ctx.globalAlpha = 1;

  // Fans (concert crowd) — little humans: head, hair, torso, arms, legs
  fans.forEach((f, fi) => {
    const fsx = toScreen(f.x);
    if (fsx < -30 || fsx > W + 30) return;
    ctx.save();
    const cx = fsx + f.w / 2;
    const scared = f.state === 'grabbed' || f.state === 'falling';
    // each fan dances to their own beat
    const beat = Math.sin(Date.now() * 0.008 + fi * 1.9);
    const bounce = scared ? 0 : Math.max(0, beat) * 3;
    const top = f.y - bounce;

    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = f.color;

    // legs
    if (scared) {
      // dangling / kicking
      const kick = Math.sin(Date.now() * 0.02 + fi) * 3;
      ctx.beginPath();
      ctx.moveTo(cx, top + 9);
      ctx.lineTo(cx - 3 + kick, top + 16);
      ctx.moveTo(cx, top + 9);
      ctx.lineTo(cx + 3 - kick, top + 16);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(cx, top + 9);
      ctx.lineTo(cx - 3, f.y + f.h);
      ctx.moveTo(cx, top + 9);
      ctx.lineTo(cx + 3, f.y + f.h);
      ctx.stroke();
    }

    // torso (shirt)
    ctx.fillStyle = f.color;
    ctx.fillRect(cx - 3.5, top, 7, 10);

    // arms — up and waving at the concert, flailing when grabbed
    ctx.beginPath();
    if (scared) {
      ctx.moveTo(cx - 3, top + 2); ctx.lineTo(cx - 8, top - 6);
      ctx.moveTo(cx + 3, top + 2); ctx.lineTo(cx + 8, top - 6);
    } else if (beat > 0.3) {
      // arms in the air
      ctx.moveTo(cx - 3, top + 3); ctx.lineTo(cx - 7, top - 5);
      ctx.moveTo(cx + 3, top + 3); ctx.lineTo(cx + 7, top - 5);
    } else {
      // arms down, swaying
      ctx.moveTo(cx - 3, top + 2); ctx.lineTo(cx - 6, top + 9);
      ctx.moveTo(cx + 3, top + 2); ctx.lineTo(cx + 6, top + 9);
    }
    ctx.stroke();

    // head — skin tone + hair
    ctx.fillStyle = '#e8c39e';
    ctx.beginPath();
    ctx.arc(cx, top - 5, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = fi % 3 === 0 ? '#3b2a1e' : (fi % 3 === 1 ? '#14100c' : '#6d3f1f');
    ctx.beginPath();
    ctx.arc(cx, top - 6.5, 4, Math.PI * 0.95, Math.PI * 2.05);
    ctx.fill();
    ctx.restore();
  });

  // Particles
  particles.forEach(p => {
    const px = toScreen(p.x);
    if (px < -10 || px > W + 10) return;
    ctx.globalAlpha = p.life / 30;
    ctx.fillStyle = p.color;
    ctx.fillRect(px, p.y, 3, 3);
  });
  ctx.globalAlpha = 1;

  // ===== DRAMATIC DEATH BLAST =====
  if (deathBlast) {
    const progress = 1 - (deathBlast.life / deathBlast.maxLife);
    if (deathBlast.life > 55) {
      ctx.fillStyle = `rgba(255, 255, 255, ${(deathBlast.life - 55) / 15 * 0.7})`;
      ctx.fillRect(-10, -10, W + 20, H + 20);
    }
    ctx.strokeStyle = `rgba(255, 100, 255, ${1 - progress})`;
    ctx.lineWidth = 8 - progress * 6;
    ctx.beginPath();
    ctx.arc(toScreen(deathBlast.x), deathBlast.y, progress * 500, 0, Math.PI * 2);
    ctx.stroke();
    deathBlast.particles.forEach(p => {
      ctx.globalAlpha = Math.min(1, p.life / 20);
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(toScreen(p.x), p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  // Scanline / CRT feel (subtle)
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  for (let y = 0; y < H; y += 3) {
    ctx.fillRect(-10, y, W + 20, 1);
  }

  ctx.restore(); // end screen-shake transform

  // Wave banner
  if (bannerTime > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, bannerTime / 18);
    ctx.fillStyle = '#c084fc';
    ctx.shadowColor = '#c084fc';
    ctx.shadowBlur = 26;
    ctx.font = 'bold 52px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(bannerText, W/2, H/2 - 14);
    ctx.restore();
  }

  // Radar strip maps the entire wrapping world.
  // You are always the white blip in the center; the bracket is your viewport.
  if (gameRunning) {
    const rw = 220, rh = 26, rx = W / 2 - rw / 2, ry = 8;
    ctx.save();
    ctx.fillStyle = 'rgba(10,6,18,0.72)';
    ctx.strokeStyle = 'rgba(124,58,237,0.7)';
    ctx.lineWidth = 1;
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeRect(rx, ry, rw, rh);
    // viewport bracket = the part of the world you can actually see
    const vpW = (W / WORLD_W) * rw;
    ctx.strokeStyle = 'rgba(192,132,252,0.5)';
    ctx.strokeRect(rx + rw / 2 - vpW / 2, ry + 1, vpW, rh - 2);
    // shortest wrapped offset from the player → [-WORLD_W/2, +WORLD_W/2]
    const toRadar = (wx) => rx + rw / 2 + (wrapDX(wx, player.x + player.w / 2) / WORLD_W) * rw;
    // fans
    fans.forEach(f => {
      const bx = toRadar(f.x);
      if (bx < rx || bx > rx + rw) return;
      ctx.fillStyle = f.state === 'grabbed' ? '#f87171' : '#67e8f9';
      ctx.fillRect(bx - 1, ry + rh - 6, 2, 3);
    });
    // enemies — looped-back attackers flash amber so you know to turn
    enemies.forEach(e => {
      const bx = toRadar(e.x + e.w / 2);
      if (bx < rx || bx > rx + rw) return;
      const by = ry + 4 + ((e.y / H) * (rh - 12));
      ctx.fillStyle = e.dir > 0 ? '#fbbf24' : '#e879f9';
      ctx.fillRect(bx - 1.5, by, 3, 3);
    });
    // your ship
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(rx + rw / 2 - 1.5, ry + 4 + ((player.y / H) * (rh - 12)), 3, 4);
    ctx.restore();
  }

  // Combo multiplier indicator
  if (gameRunning && comboMult() > 1) {
    ctx.save();
    ctx.fillStyle = '#f0abfc';
    ctx.shadowColor = '#f0abfc';
    ctx.shadowBlur = 12;
    ctx.font = 'bold 20px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('COMBO ×' + comboMult(), W/2, 44);
    ctx.restore();
  }

  // Pause overlay
  if (paused) {
    ctx.save();
    ctx.fillStyle = 'rgba(10, 6, 18, 0.55)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#c084fc';
    ctx.shadowColor = '#c084fc';
    ctx.shadowBlur = 26;
    ctx.font = 'bold 52px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', W/2, H/2 - 14);
    ctx.font = 'bold 18px "Segoe UI", system-ui, sans-serif';
    ctx.shadowBlur = 10;
    ctx.fillText('Press P to resume', W/2, H/2 + 22);
    ctx.restore();
  }
}

function updateHUD() {
  document.getElementById('score').textContent = score;
  document.getElementById('lives').textContent = lives;
  document.getElementById('wave').textContent = wave;
  const r = document.getElementById('rescued');
  if (r) r.textContent = rescued;
  const bEl = document.getElementById('best');
  if (bEl) bEl.textContent = best;
  const w = document.getElementById('weapon');
  if (w) {
    const names = ['DUAL', 'HEAVY', 'SPREAD'];
    w.textContent = names[player.shotType] || 'DUAL';
    w.style.color = player.shotType === 1 ? '#f472b6' : player.shotType === 2 ? '#22d3ee' : '#c084fc';
  }
}

// ---------- Loop ----------
function loop() {
  update();
  draw();
  ArcadeVR.schedule(loop);
}

updateHUD();
loop();
console.log('Spectral Manor Revenger ready — Ghost Circuit Defense');
