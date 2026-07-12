// ============================================================
// SPECTRAL MANOR: LUNO'S FLIGHT
// Ghost Circuit Joust-style game
// Ride Luno the owl-griffin across the haunted manor skyline
// Bump witches from above → they become crystals
// Ghosts + aliens on floating platforms
// ============================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

// ---------- Audio (richer synthesized SFX) ----------
let audioCtx = null;
function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}
function playTone(freq, dur, type='square', vol=0.06, slide=0) {
  if (!audioCtx) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, audioCtx.currentTime);
  if (slide) o.frequency.linearRampToValueAtTime(freq+slide, audioCtx.currentTime+dur);
  g.gain.setValueAtTime(vol, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime+dur);
  o.connect(g); g.connect(audioCtx.destination);
  o.start(); o.stop(audioCtx.currentTime+dur);
}
function playNoise(dur, vol=0.05, freq=900) {
  if (!audioCtx) return;
  const bufferSize = audioCtx.sampleRate * dur;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const src = audioCtx.createBufferSource();
  src.buffer = buffer;
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(vol, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
  src.connect(filter); filter.connect(g); g.connect(audioCtx.destination);
  src.start();
}
const sfx = {
  flap: () => {
    playNoise(0.09, 0.045, 700);
    playTone(220, 0.08, 'triangle', 0.04, -80);
  },
  crystal: () => {
    playTone(784, 0.07, 'sine', 0.06);
    setTimeout(() => playTone(988, 0.08, 'sine', 0.06), 55);
    setTimeout(() => playTone(1318, 0.14, 'triangle', 0.07), 110);
    playNoise(0.06, 0.03, 2000);
  },
  hit: () => {
    playNoise(0.12, 0.06, 400);
    playTone(140, 0.12, 'sawtooth', 0.06, -90);
  },
  hurt: () => {
    playTone(180, 0.1, 'sawtooth', 0.07, -100);
    playTone(90, 0.18, 'square', 0.05, -40);
    playNoise(0.15, 0.05, 300);
  },
  wave: () => {
    playTone(440, 0.08, 'square', 0.05);
    setTimeout(() => playTone(554, 0.08, 'square', 0.05), 70);
    setTimeout(() => playTone(659, 0.08, 'square', 0.05), 140);
    setTimeout(() => playTone(880, 0.15, 'triangle', 0.06), 210);
  },
  land: () => {
    playNoise(0.06, 0.03, 200);
    playTone(90, 0.08, 'triangle', 0.03);
  },
  gameOver: () => {
    playTone(330, 0.2, 'sawtooth', 0.06, -40);
    setTimeout(() => playTone(220, 0.25, 'sawtooth', 0.06, -60), 180);
    setTimeout(() => playTone(140, 0.35, 'sawtooth', 0.05, -40), 380);
  },
  pickup: () => {
    playTone(1046, 0.06, 'sine', 0.05);
    setTimeout(() => playTone(1318, 0.1, 'sine', 0.05), 50);
  }
};

// ---------- State ----------
let score = 0, lives = 3, wave = 1, crystals = 0;
let gameRunning = false, gameOver = false;
let keys = {};

// ---------- Juice: high score, combo, shake, hit-pause, banner ----------
const BEST_KEY = 'spectralArcade.luno.best';
function loadBest() { try { return parseInt(localStorage.getItem(BEST_KEY), 10) || 0; } catch (e) { return 0; } }
function saveBest() { try { localStorage.setItem(BEST_KEY, best); } catch (e) {} }
let best = loadBest();
let combo = 0, comboTimer = 0;      // kill streak; decays after 150 frames
let hitPause = 0;                   // frames to freeze the action on impact
let shakeTime = 0, shakeMag = 0;    // screen shake
let waveDelay = 0;                  // breather frames before next wave spawns
let bannerText = '', bannerTime = 0;
function triggerShake(mag, time) { shakeMag = mag; shakeTime = time; }
function comboMult() { return Math.min(1 + Math.floor(combo / 5), 5); }

// ---------- Player (riding Luno) ----------
const player = {
  x: 120, y: H/2,
  w: 48, h: 36,
  vx: 0, vy: 0,
  speed: 0.45,      // horizontal accel
  maxSpeed: 5.2,
  flapPower: -7.8,
  gravity: 0.28,
  facing: 1,        // 1 right, -1 left
  invuln: 0,
  flapAnim: 0
};

// ---------- World ----------
let platforms = [];   // floating ledges + alien platforms
let witches = [];
let ghosts = [];
let crystalPickups = [];
let particles = [];
let groundScroll = 0;
let nests = [];       // crystals sitting on platforms that walking witches race to mount
let witchBolts = [];  // hex bolts (witches shoot from wave 4)
let boss = null;      // THE SHRIEKER — shows up if you dawdle
let waveTimer = 0;    // frames spent in the current wave
const BOSS_AFTER = 2700; // ~45 seconds

function hurtLuno(color) {
  lives--;
  player.invuln = 70;
  player.vy = -6;
  combo = 0; comboTimer = 0;
  hitPause = 5;
  triggerShake(9, 18);
  sfx.hurt();
  createParticles(player.x + 20, player.y + 15, color || '#f472b6', 12);
  updateHUD();
  if (lives <= 0) {
    gameOver = true;
    gameRunning = false;
    sfx.gameOver();
    const newBest = score > best;
    if (newBest) { best = score; saveBest(); }
    document.getElementById('startOverlay').classList.remove('hidden');
    document.getElementById('startOverlay').innerHTML = `
      <h2>FALLEN FROM THE SKY</h2>
      <p>Crystals: ${crystals} &nbsp;|&nbsp; Score: ${score}</p>
      <p style="margin-top:0.3rem">Best: ${best}${newBest ? ' &nbsp;<span style="color:#f0abfc; font-weight:bold">NEW BEST!</span>' : ''}</p>
      <p style="margin-top:0.9rem; opacity:0.8">Click or SPACE to soar again</p>
    `;
    updateHUD();
  }
}

// ---------- Input ----------
window.addEventListener('keydown', e => {
  initAudio();
  keys[e.code] = true;
  if (e.code === 'Space') e.preventDefault();
  if ((e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') && !gameRunning) startGame();
});
window.addEventListener('keyup', e => keys[e.code] = false);

document.getElementById('startOverlay').addEventListener('click', () => {
  initAudio();
  if (!gameRunning) startGame();
});

// ---------- Core ----------
function startGame() {
  score = 0; lives = 3; wave = 1; crystals = 0;
  witches = []; ghosts = []; crystalPickups = []; particles = [];
  nests = []; witchBolts = []; boss = null; waveTimer = 0;
  player.grounded = false; player.walkPhase = 0;
  combo = 0; comboTimer = 0; hitPause = 0; shakeTime = 0; waveDelay = 0;
  bannerText = 'WAVE 1'; bannerTime = 90;
  player.x = 120; player.y = H/2;
  player.vx = 0; player.vy = 0;
  player.facing = 1; player.invuln = 0;
  gameRunning = true; gameOver = false;
  document.getElementById('startOverlay').classList.add('hidden');
  buildSkyline();
  spawnWave();
  updateHUD();
}

function buildSkyline() {
  // Floating platforms across the haunted skyline
  platforms = [
    // ground-ish ledges
    { x: 0,   y: H - 50, w: 180, h: 20, type: 'stone' },
    { x: 780, y: H - 50, w: 180, h: 20, type: 'stone' },
    // mid platforms
    { x: 220, y: 380, w: 130, h: 16, type: 'stone' },
    { x: 610, y: 380, w: 130, h: 16, type: 'stone' },
    { x: 400, y: 280, w: 160, h: 16, type: 'stone' },
    // high platforms
    { x: 80,  y: 180, w: 110, h: 14, type: 'stone' },
    { x: 770, y: 180, w: 110, h: 14, type: 'stone' },
    { x: 380, y: 120, w: 200, h: 14, type: 'stone' },
    // alien floating platforms (move later)
    { x: 300, y: 320, w: 90, h: 12, type: 'alien', vx: 1.1, range: 80, originX: 300 },
    { x: 560, y: 220, w: 90, h: 12, type: 'alien', vx: -1.0, range: 70, originX: 560 }
  ];
}

function spawnWave() {
  witches = [];
  ghosts = [];
  nests = [];
  witchBolts = [];
  boss = null;
  waveTimer = 0;

  // Witches (Joust enemies)
  const wCount = 3 + wave * 2;
  for (let i = 0; i < wCount; i++) {
    witches.push({
      x: 100 + Math.random() * (W - 200),
      y: 80 + Math.random() * 280,
      w: 34, h: 30,
      vx: (Math.random() < 0.5 ? -1 : 1) * (1.4 + wave * 0.15 + Math.random()),
      vy: 0,
      flapTimer: 20 + Math.random() * 40,
      facing: 1,
      state: 'flying',  // flying | walking (racing to mount a crystal)
      walkPhase: Math.random() * Math.PI * 2,
      nest: null,
      mountTimer: 0,
      boltTimer: 200 + Math.random() * 300
    });
  }

  // From wave 3: some witches start on foot, racing to crystals perched
  // on the platforms. Steal the crystal before they mount up!
  if (wave >= 3) {
    const stonePlats = platforms.filter(p => p.type === 'stone' && p.y < H - 60);
    const nestCount = Math.min(2 + Math.floor(wave / 2), stonePlats.length, witches.length);
    const used = [];
    for (let i = 0; i < nestCount; i++) {
      let p;
      do { p = stonePlats[Math.floor(Math.random() * stonePlats.length)]; }
      while (used.includes(p));
      used.push(p);
      const nest = {
        x: p.x + p.w * (0.3 + Math.random() * 0.4),
        y: p.y - 16,
        w: 16, h: 16,
        taken: false,
        plat: p
      };
      nests.push(nest);
      // this witch starts walking on the same platform, from the edge
      const wch = witches[i];
      wch.state = 'walking';
      wch.nest = nest;
      wch.x = nest.x > p.x + p.w / 2 ? p.x + 4 : p.x + p.w - 38;
      wch.y = p.y - wch.h;
      wch.vx = 0; wch.vy = 0;
    }
  }

  // Ghosts (hazards that float around)
  const gCount = 2 + Math.floor(wave / 2);
  for (let i = 0; i < gCount; i++) {
    ghosts.push({
      x: 80 + Math.random() * (W - 160),
      y: 60 + Math.random() * 300,
      w: 28, h: 32,
      phase: Math.random() * Math.PI * 2,
      speed: 0.8 + Math.random() * 0.6
    });
  }
}

// ---------- Update ----------
function update() {
  if (!gameRunning) return;
  if (hitPause > 0) { hitPause--; return; }   // impact freeze-frame
  if (shakeTime > 0) shakeTime--;
  if (bannerTime > 0) bannerTime--;
  if (comboTimer > 0) { comboTimer--; if (comboTimer === 0) combo = 0; }
  if (waveDelay > 0) {
    waveDelay--;
    if (waveDelay === 0) spawnWave();
  }

  // --- Player (Luno) ---
  // Horizontal
  if (keys['ArrowLeft'] || keys['KeyA']) {
    player.vx -= player.speed;
    player.facing = -1;
  }
  if (keys['ArrowRight'] || keys['KeyD']) {
    player.vx += player.speed;
    player.facing = 1;
  }
  // Friction
  player.vx *= 0.92;
  player.vx = Math.max(-player.maxSpeed, Math.min(player.maxSpeed, player.vx));

  // Flap
  if (keys['Space'] || keys['KeyW'] || keys['ArrowUp']) {
    if (player.flapAnim <= 0) {
      player.vy = player.flapPower;
      player.flapAnim = 10;
      sfx.flap();
    }
  }
  if (player.flapAnim > 0) player.flapAnim--;

  // Gravity
  player.vy += player.gravity;
  player.vy = Math.min(player.vy, 11);

  // Apply movement
  player.x += player.vx;
  player.y += player.vy;

  // Screen wrap (classic Joust style)
  if (player.x < -player.w) player.x = W;
  if (player.x > W) player.x = -player.w;

  // Floor / ceiling
  player.grounded = false;
  if (player.y > H - 70) {
    player.y = H - 70;
    player.vy = Math.min(0, player.vy);
    player.grounded = true;
  }
  if (player.y < 20) {
    player.y = 20;
    player.vy = Math.max(0, player.vy);
  }

  // Platform collision — platforms are SOLID: land on top, bonk from
  // below, and get pushed out at the sides (no more flying through)
  platforms.forEach(p => {
    const overlapX = player.x + player.w > p.x + 4 && player.x < p.x + p.w - 4;

    // land on top
    if (player.vy >= 0 && overlapX &&
        player.y + player.h > p.y && player.y + player.h < p.y + p.h + 14 &&
        player.y + player.h - player.vy <= p.y + 4) {
      if (player.vy > 1.5) sfx.land();
      player.y = p.y - player.h;
      player.vy = 0;
      player.grounded = true;
      // moving alien platforms carry you
      if (p.type === 'alien') player.x += p.vx;
      return;
    }

    // bonk head on the underside
    if (player.vy < 0 && overlapX &&
        player.y < p.y + p.h && player.y > p.y &&
        player.y - player.vy >= p.y + p.h - 4) {
      player.y = p.y + p.h;
      player.vy = 1;
      sfx.land();
      return;
    }

    // side push-out (flying into the end of a ledge)
    if (player.y + player.h > p.y + 4 && player.y < p.y + p.h - 2 &&
        player.x + player.w > p.x && player.x < p.x + p.w) {
      if (player.x + player.w / 2 < p.x + p.w / 2) {
        player.x = p.x - player.w;
      } else {
        player.x = p.x + p.w;
      }
      player.vx *= -0.3;
    }
  });

  // Walk cycle when running along a surface (Joust-style)
  if (player.grounded && Math.abs(player.vx) > 0.4) {
    player.walkPhase += Math.abs(player.vx) * 0.09;
  }

  if (player.invuln > 0) player.invuln--;

  // --- Alien platforms move ---
  platforms.forEach(p => {
    if (p.type === 'alien') {
      p.x += p.vx;
      if (Math.abs(p.x - p.originX) > p.range) p.vx *= -1;
    }
  });

  // --- Witches AI (Joust behavior + on-foot crystal racers) ---
  witches.forEach(w => {
    // ----- Walking witches: stroll along their platform to the crystal -----
    if (w.state === 'walking') {
      const p = w.nest.plat;
      w.y = p.y - w.h + (p.type === 'alien' ? p.vx * 0 : 0);
      if (w.nest.taken) {
        // crystal stolen — she remembers her broom and takes off (angry)
        w.mountTimer++;
        if (w.mountTimer > 120) {
          w.state = 'flying';
          w.vx = (Math.random() < 0.5 ? -1 : 1) * (1.6 + wave * 0.15);
          w.vy = -4;
        }
      } else if (w.mountTimer > 0) {
        // mounting the crystal — brief channel, then airborne and faster
        w.mountTimer--;
        if (w.mountTimer === 0) {
          w.nest.taken = true;
          w.state = 'flying';
          w.vx = (w.facing || 1) * (2 + wave * 0.2);
          w.vy = -5;
          sfx.crystal();
          createParticles(w.x + w.w/2, w.y + w.h/2, '#e879f9', 10);
        }
        return;
      } else {
        // walk toward the crystal
        const dir = w.nest.x > w.x + w.w/2 ? 1 : -1;
        w.x += dir * (0.9 + wave * 0.08);
        w.facing = dir;
        w.walkPhase += 0.18;
        // reached it — start mounting
        if (Math.abs((w.x + w.w/2) - (w.nest.x + 8)) < 10) {
          w.mountTimer = 50;
        }
      }
      return;
    }

    if (w.state !== 'flying') return;

    // simple flap
    w.flapTimer--;
    if (w.flapTimer <= 0) {
      w.vy = -5.5 - Math.random() * 2;
      w.flapTimer = 25 + Math.random() * 35;
    }
    w.vy += 0.22;
    w.vy = Math.min(w.vy, 7);
    w.x += w.vx;
    w.y += w.vy;
    w.facing = w.vx > 0 ? 1 : -1;

    // wrap
    if (w.x < -40) w.x = W + 10;
    if (w.x > W + 40) w.x = -10;
    if (w.y > H - 80) { w.y = H - 80; w.vy = -4; }
    if (w.y < 30) w.vy = Math.abs(w.vy) * 0.5;

    // bounce on platform tops, bonk on undersides (solid both ways)
    platforms.forEach(p => {
      const overlapX = w.x + w.w > p.x && w.x < p.x + p.w;
      if (w.vy >= 0 && overlapX &&
          w.y + w.h > p.y && w.y + w.h < p.y + 18) {
        w.y = p.y - w.h;
        w.vy = -3;
      } else if (w.vy < 0 && overlapX &&
                 w.y < p.y + p.h && w.y > p.y) {
        w.y = p.y + p.h;
        w.vy = 1;
      }
    });

    // From wave 4: witches hurl hex bolts at Luno
    if (wave >= 4) {
      w.boltTimer--;
      const pdx = (player.x + player.w/2) - (w.x + w.w/2);
      const pdy = (player.y + player.h/2) - (w.y + w.h/2);
      const pd = Math.hypot(pdx, pdy);
      if (w.boltTimer <= 0 && pd < 420) {
        witchBolts.push({
          x: w.x + w.w/2, y: w.y + w.h/2,
          vx: (pdx / pd) * 3.6, vy: (pdy / pd) * 3.6,
          life: 130
        });
        sfx.flap();
        w.boltTimer = 260 + Math.random() * 240 - wave * 10;
      }
    }
  });

  // --- Witch hex bolts ---
  witchBolts.forEach(b => { b.x += b.vx; b.y += b.vy; b.life--; });
  witchBolts = witchBolts.filter(b => b.life > 0 && b.x > -20 && b.x < W + 20 && b.y > -20 && b.y < H + 20);
  if (player.invuln <= 0) {
    witchBolts.forEach((b, bi) => {
      if (b.x > player.x && b.x < player.x + player.w &&
          b.y > player.y && b.y < player.y + player.h) {
        witchBolts.splice(bi, 1);
        hurtLuno('#4ade80');
      }
    });
  }

  // --- Crystal nests: Luno can swoop the crystal before the witch mounts ---
  nests.forEach(n => {
    if (n.taken) return;
    // ride along if the platform moves
    if (n.plat.type === 'alien') n.x += n.plat.vx;
    if (player.x < n.x + n.w && player.x + player.w > n.x &&
        player.y < n.y + n.h && player.y + player.h > n.y) {
      n.taken = true;
      crystals++;
      score += 150;
      sfx.pickup();
      createParticles(n.x + 8, n.y + 8, '#e879f9', 10);
      updateHUD();
    }
  });

  // --- THE SHRIEKER: dawdle too long and the boss buzzard arrives ---
  waveTimer++;
  if (!boss && waveTimer > BOSS_AFTER && witches.length > 0) {
    boss = {
      x: -60, y: 100,
      w: 64, h: 48,
      vx: 2.5, vy: 0,
      hp: 4 + Math.floor(wave / 3),
      maxHp: 4 + Math.floor(wave / 3),
      flapTimer: 10,
      facing: 1,
      hitFlash: 0
    };
    bannerText = 'THE SHRIEKER COMES';
    bannerTime = 110;
    sfx.gameOver(); // ominous low tones announce it
    triggerShake(6, 20);
  }
  if (boss) {
    // relentless Joust-style pursuit — flaps toward Luno
    boss.flapTimer--;
    if (boss.flapTimer <= 0) {
      boss.vy = boss.y > player.y ? -6.5 : -3;
      boss.flapTimer = 16 + Math.random() * 14;
    }
    boss.vy += 0.24;
    boss.vy = Math.min(boss.vy, 7);
    boss.vx += (player.x > boss.x ? 0.12 : -0.12);
    boss.vx = Math.max(-3.6, Math.min(3.6, boss.vx));
    boss.x += boss.vx;
    boss.y += boss.vy;
    boss.facing = boss.vx > 0 ? 1 : -1;
    if (boss.y > H - 90) { boss.y = H - 90; boss.vy = -5; }
    if (boss.y < 26) boss.vy = 1;
    if (boss.x < -80) boss.x = W + 20;
    if (boss.x > W + 80) boss.x = -20;
    if (boss.hitFlash > 0) boss.hitFlash--;

    // Joust rules apply to the boss too — but it takes several hits
    if (player.invuln <= 0 &&
        player.x < boss.x + boss.w && player.x + player.w > boss.x &&
        player.y < boss.y + boss.h && player.y + player.h > boss.y) {
      const playerMid = player.y + player.h * 0.4;
      const bossMid = boss.y + boss.h * 0.4;
      if (playerMid < bossMid - 6) {
        boss.hp--;
        boss.hitFlash = 12;
        player.vy = -7; // bounce off its back
        hitPause = 3;
        triggerShake(6, 12);
        sfx.crystal();
        createParticles(boss.x + boss.w/2, boss.y, '#f59e0b', 16);
        if (boss.hp <= 0) {
          score += 1000 * comboMult();
          crystals += 3;
          sfx.wave();
          triggerShake(12, 25);
          createParticles(boss.x + boss.w/2, boss.y + boss.h/2, '#f59e0b', 30);
          for (let i = 0; i < 3; i++) {
            crystalPickups.push({
              x: boss.x + i * 20, y: boss.y,
              w: 18, h: 18, life: 400, vy: -2 - i
            });
          }
          boss = null;
        }
        updateHUD();
      } else {
        hurtLuno('#f59e0b');
      }
    }
  }

  // --- Ghosts float ---
  ghosts.forEach(g => {
    g.phase += 0.03;
    g.x += Math.sin(g.phase) * g.speed;
    g.y += Math.cos(g.phase * 0.7) * g.speed * 0.6;
    if (g.x < 20) g.x = 20;
    if (g.x > W - 40) g.x = W - 40;
    if (g.y < 40) g.y = 40;
    if (g.y > H - 100) g.y = H - 100;
  });

  // --- Player vs Witches (Joust collision: higher one wins) ---
  // Applies to walking witches too — swoop them before they mount!
  witches.forEach((w, wi) => {
    if (player.invuln > 0) return;

    if (player.x < w.x + w.w && player.x + player.w > w.x &&
        player.y < w.y + w.h && player.y + player.h > w.y) {

      // Who is higher? (center Y)
      const playerMid = player.y + player.h * 0.4;
      const witchMid  = w.y + w.h * 0.4;

      if (playerMid < witchMid - 4) {
        // Player wins — witch becomes crystal
        w.state = 'crystal';
        combo++;
        comboTimer = 150;
        score += (200 + wave * 25) * comboMult();
        hitPause = 2;
        triggerShake(3, 8);
        crystals++;
        sfx.crystal();
        createParticles(w.x + w.w/2, w.y + w.h/2, '#e879f9', 14);
        // spawn crystal pickup
        crystalPickups.push({
          x: w.x + 8, y: w.y + 8,
          w: 18, h: 18,
          life: 300,
          vy: -1.5
        });
        witches.splice(wi, 1);
        updateHUD();
      } else {
        // Witch hits player
        player.vx = (player.x < w.x ? -1 : 1) * 4;
        hurtLuno();
      }
    }
  });

  // Ghosts hurt on touch
  if (player.invuln <= 0) {
    ghosts.forEach(g => {
      if (player.x < g.x + g.w && player.x + player.w > g.x &&
          player.y < g.y + g.h && player.y + player.h > g.y) {
        hurtLuno('#a78bfa');
      }
    });
  }

  // Crystal pickups
  crystalPickups.forEach((c, ci) => {
    c.vy += 0.12;
    c.y += c.vy;
    c.life--;
    // land on platforms / floor
    if (c.y > H - 70) { c.y = H - 70; c.vy = 0; }
    platforms.forEach(p => {
      if (c.y + c.h > p.y && c.y < p.y + 8 &&
          c.x + c.w > p.x && c.x < p.x + p.w) {
        c.y = p.y - c.h;
        c.vy = 0;
      }
    });
    // collect
    if (player.x < c.x + c.w && player.x + player.w > c.x &&
        player.y < c.y + c.h && player.y + player.h > c.y) {
      score += 100;
      sfx.pickup();
      createParticles(c.x + 9, c.y + 9, '#e879f9', 8);
      crystalPickups.splice(ci, 1);
      updateHUD();
    }
  });
  crystalPickups = crystalPickups.filter(c => c.life > 0);

  // Wave clear — breather: banner shows for a beat before the next wave spawns
  // (the Shrieker must be driven off too)
  if (witches.length === 0 && !boss && gameRunning && waveDelay === 0) {
    wave++;
    sfx.wave();
    bannerText = 'WAVE ' + wave;
    bannerTime = 90;
    waveDelay = 75;
    updateHUD();
  }

  // Particles
  particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.life--; });
  particles = particles.filter(p => p.life > 0);

  groundScroll = (groundScroll + 0.4) % 100;
}

function createParticles(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    particles.push({
      x, y,
      vx: (Math.random()-0.5)*7,
      vy: (Math.random()-0.5)*7 - 1,
      life: 18 + Math.random()*16,
      color,
      size: 2 + Math.random()*3
    });
  }
}

// ---------- Draw ----------
function draw() {
  // Screen shake — offset the whole world while shaking
  ctx.save();
  if (shakeTime > 0) {
    ctx.translate((Math.random() - 0.5) * shakeMag, (Math.random() - 0.5) * shakeMag);
  }

  // Sky gradient (oversized so shake never reveals the canvas edge)
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#0a0618');
  sky.addColorStop(0.6, '#150a28');
  sky.addColorStop(1, '#1a0f30');
  ctx.fillStyle = sky;
  ctx.fillRect(-12, -12, W + 24, H + 24);

  // Stars
  ctx.fillStyle = '#e0d4ff';
  for (let i = 0; i < 50; i++) {
    const sx = (i * 73 + groundScroll * 0.3) % W;
    const sy = (i * 47) % (H - 80);
    ctx.globalAlpha = 0.3 + (i % 3) * 0.2;
    ctx.fillRect(sx, sy, 1.5, 1.5);
  }
  ctx.globalAlpha = 1;

  // Moon
  ctx.beginPath();
  ctx.arc(W - 90, 70, 32, 0, Math.PI*2);
  ctx.fillStyle = '#e9d5ff';
  ctx.shadowColor = '#c084fc';
  ctx.shadowBlur = 25;
  ctx.fill();
  ctx.shadowBlur = 0;

  // Distant manor silhouette
  ctx.fillStyle = '#0d0818';
  ctx.fillRect(W - 260, H - 160, 90, 110);
  ctx.fillRect(W - 200, H - 200, 50, 150);
  ctx.beginPath();
  ctx.moveTo(W - 270, H - 160);
  ctx.lineTo(W - 215, H - 220);
  ctx.lineTo(W - 160, H - 160);
  ctx.fill();
  // windows
  ctx.fillStyle = '#c084fc';
  ctx.globalAlpha = 0.6 + Math.sin(Date.now()*0.003)*0.2;
  ctx.fillRect(W - 245, H - 140, 12, 14);
  ctx.fillRect(W - 220, H - 140, 12, 14);
  ctx.fillRect(W - 185, H - 180, 12, 14);
  ctx.globalAlpha = 1;

  // Platforms
  platforms.forEach(p => {
    if (p.type === 'alien') {
      // glowing alien platform
      ctx.fillStyle = '#134e4a';
      ctx.shadowColor = '#22d3ee';
      ctx.shadowBlur = 12;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = '#22d3ee';
      ctx.fillRect(p.x + 4, p.y + 3, p.w - 8, 4);
      // little alien lights
      ctx.fillStyle = '#67e8f9';
      ctx.beginPath();
      ctx.arc(p.x + 15, p.y - 4, 3, 0, Math.PI*2);
      ctx.arc(p.x + p.w - 15, p.y - 4, 3, 0, Math.PI*2);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      // stone ledge
      ctx.fillStyle = '#1e1b4b';
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = '#4c1d95';
      ctx.fillRect(p.x, p.y, p.w, 4);
    }
  });

  // Ground
  ctx.fillStyle = '#12091f';
  ctx.fillRect(0, H - 48, W, 48);
  ctx.strokeStyle = '#7c3aed';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, H - 48);
  ctx.lineTo(W, H - 48);
  ctx.stroke();

  // Crystal pickups
  crystalPickups.forEach(c => {
    ctx.save();
    ctx.translate(c.x + 9, c.y + 9);
    ctx.rotate(Date.now() * 0.004);
    ctx.shadowColor = '#e879f9';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#e879f9';
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(8, 0);
    ctx.lineTo(0, 10);
    ctx.lineTo(-8, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f5d0fe';
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(4, 0);
    ctx.lineTo(0, 5);
    ctx.lineTo(-4, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.shadowBlur = 0;
  });

  // Ghosts
  ghosts.forEach(g => {
    ctx.save();
    ctx.translate(g.x + 14, g.y + 16);
    ctx.globalAlpha = 0.75 + Math.sin(g.phase) * 0.15;
    ctx.fillStyle = '#c4b5fd';
    ctx.shadowColor = '#a78bfa';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 18, 0, 0, Math.PI*2);
    ctx.fill();
    // wavy bottom
    ctx.beginPath();
    ctx.moveTo(-14, 10);
    ctx.quadraticCurveTo(-7, 20, 0, 12);
    ctx.quadraticCurveTo(7, 20, 14, 10);
    ctx.fill();
    // eyes
    ctx.fillStyle = '#0f0a1a';
    ctx.beginPath(); ctx.arc(-5, -4, 3, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(5, -4, 3, 0, Math.PI*2); ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  });

  // Crystal nests on the platforms (mount points for walking witches)
  nests.forEach(n => {
    if (n.taken) return;
    ctx.save();
    ctx.translate(n.x + 8, n.y + 8);
    const pulse = 1 + Math.sin(Date.now() * 0.005) * 0.12;
    ctx.scale(pulse, pulse);
    ctx.shadowColor = '#e879f9';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#e879f9';
    ctx.beginPath();
    ctx.moveTo(0, -9); ctx.lineTo(7, 0); ctx.lineTo(0, 9); ctx.lineTo(-7, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f5d0fe';
    ctx.beginPath();
    ctx.moveTo(0, -4); ctx.lineTo(3, 0); ctx.lineTo(0, 4); ctx.lineTo(-3, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.shadowBlur = 0;
  });

  // Witch hex bolts
  witchBolts.forEach(b => {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(Date.now() * 0.01);
    ctx.fillStyle = '#4ade80';
    ctx.shadowColor = '#4ade80';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      if (i === 0) ctx.moveTo(Math.cos(a) * 5, Math.sin(a) * 5);
      else ctx.lineTo(Math.cos(a) * 5, Math.sin(a) * 5);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });
  ctx.shadowBlur = 0;

  // Witches
  witches.forEach(w => {
    ctx.save();
    ctx.translate(w.x + w.w/2, w.y + w.h/2);
    ctx.scale(w.facing, 1);

    if (w.state === 'walking') {
      // on foot — walking legs, no broom yet
      const stride = Math.sin(w.walkPhase) * 5;
      ctx.strokeStyle = '#4c1d95';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-3, 12); ctx.lineTo(-3 + stride, 15 + Math.abs(stride) * 0.3);
      ctx.moveTo(3, 12);  ctx.lineTo(3 - stride, 15 + Math.abs(stride) * 0.3);
      ctx.stroke();
      // reaching arms while mounting
      if (w.mountTimer > 0 && !w.nest.taken) {
        ctx.strokeStyle = '#7c3aed';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(4, 0); ctx.lineTo(12, -4);
        ctx.stroke();
      }
    } else {
      // broom
      ctx.strokeStyle = '#78716c';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-18, 6);
      ctx.lineTo(16, 4);
      ctx.stroke();
      // bristles
      ctx.strokeStyle = '#a8a29e';
      ctx.beginPath();
      ctx.moveTo(12, 0); ctx.lineTo(20, -6);
      ctx.moveTo(12, 4); ctx.lineTo(22, 4);
      ctx.moveTo(12, 8); ctx.lineTo(20, 12);
      ctx.stroke();
    }

    // body
    ctx.fillStyle = '#7c3aed';
    ctx.fillRect(-8, -6, 16, 20);
    // hat
    ctx.fillStyle = '#4c1d95';
    ctx.beginPath();
    ctx.moveTo(0, -28);
    ctx.lineTo(-12, -8);
    ctx.lineTo(12, -8);
    ctx.fill();
    ctx.fillRect(-14, -10, 28, 4);
    // face
    ctx.fillStyle = '#e9d5ff';
    ctx.beginPath();
    ctx.arc(0, -4, 7, 0, Math.PI*2);
    ctx.fill();
    // eyes
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(-4, -6, 3, 3);
    ctx.fillRect(1, -6, 3, 3);

    ctx.restore();
  });

  // THE SHRIEKER (boss buzzard)
  if (boss) {
    ctx.save();
    ctx.translate(boss.x + boss.w/2, boss.y + boss.h/2);
    ctx.scale(boss.facing, 1);
    const flash = boss.hitFlash > 0 && Math.floor(boss.hitFlash / 3) % 2 === 0;
    ctx.fillStyle = flash ? '#fef3c7' : '#292524';
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 18;
    // hulking body
    ctx.beginPath();
    ctx.ellipse(0, 4, 24, 17, 0, 0, Math.PI*2);
    ctx.fill();
    // vulture neck + head
    ctx.beginPath();
    ctx.ellipse(20, -12, 9, 8, 0.4, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = flash ? '#fde68a' : '#7f1d1d';
    ctx.beginPath();
    ctx.ellipse(20, -12, 6, 5, 0.4, 0, Math.PI*2);
    ctx.fill();
    // hooked beak
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(27, -13); ctx.lineTo(36, -9); ctx.lineTo(26, -7);
    ctx.closePath();
    ctx.fill();
    // burning eye
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath(); ctx.arc(22, -13, 2.5, 0, Math.PI*2); ctx.fill();
    // ragged wings (flap)
    const bw = boss.vy < 0 ? -30 : -12;
    ctx.fillStyle = flash ? '#fef3c7' : '#1c1917';
    ctx.beginPath();
    ctx.moveTo(-10, -2);
    ctx.quadraticCurveTo(-40, bw, -46, 10);
    ctx.lineTo(-34, 6); ctx.lineTo(-38, 16); ctx.lineTo(-26, 10); ctx.lineTo(-28, 20);
    ctx.quadraticCurveTo(-18, 12, -8, 8);
    ctx.closePath();
    ctx.fill();
    // talons
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-2, 18); ctx.lineTo(-2, 25); ctx.moveTo(6, 18); ctx.lineTo(8, 25);
    ctx.stroke();
    ctx.restore();
    ctx.shadowBlur = 0;
    // HP pips above the boss
    for (let i = 0; i < boss.maxHp; i++) {
      ctx.fillStyle = i < boss.hp ? '#f59e0b' : 'rgba(245,158,11,0.2)';
      ctx.fillRect(boss.x + i * 12, boss.y - 14, 9, 5);
    }
  }

  // Player riding Luno (owl-griffin)
  ctx.save();
  ctx.translate(player.x + player.w/2, player.y + player.h/2);
  if (player.invuln > 0 && Math.floor(player.invuln/3)%2===0) ctx.globalAlpha = 0.4;
  ctx.scale(player.facing, 1);

  // Luno body (owl-griffin silhouette)
  ctx.fillStyle = '#a8a29e';
  ctx.shadowColor = '#c084fc';
  ctx.shadowBlur = 12;
  // legs — running stride when grounded (Joust-style), tucked in flight
  const running = player.grounded && Math.abs(player.vx) > 0.4;
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (running) {
    const stride = Math.sin(player.walkPhase) * 7;
    ctx.moveTo(-4, 12); ctx.lineTo(-4 + stride, 19);
    ctx.moveTo(6, 12);  ctx.lineTo(6 - stride, 19);
  } else if (player.grounded) {
    // standing
    ctx.moveTo(-4, 12); ctx.lineTo(-4, 19);
    ctx.moveTo(6, 12);  ctx.lineTo(6, 19);
  } else {
    // tucked while flying
    ctx.moveTo(-2, 12); ctx.lineTo(2, 15);
    ctx.moveTo(7, 12);  ctx.lineTo(10, 14);
  }
  ctx.stroke();
  // body
  ctx.beginPath();
  ctx.ellipse(0, 4, 16, 12, 0, 0, Math.PI*2);
  ctx.fill();
  // head
  ctx.beginPath();
  ctx.ellipse(12, -6, 11, 10, 0, 0, Math.PI*2);
  ctx.fill();
  // ear tufts
  ctx.beginPath();
  ctx.moveTo(8, -14); ctx.lineTo(6, -22); ctx.lineTo(12, -14);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(16, -14); ctx.lineTo(18, -22); ctx.lineTo(14, -14);
  ctx.fill();
  // wing — flaps in the air, folds neatly against the body on the ground
  const wingOpen = player.grounded ? 2 : (player.flapAnim > 0 ? -18 : -6);
  ctx.fillStyle = '#78716c';
  ctx.beginPath();
  if (player.grounded) {
    ctx.ellipse(-6, 4, 11, 8, -0.2, 0, Math.PI * 2);
  } else {
    ctx.moveTo(-8, 0);
    ctx.quadraticCurveTo(-28, wingOpen, -22, 12);
    ctx.quadraticCurveTo(-14, 8, -6, 6);
  }
  ctx.fill();
  // eye
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.arc(15, -7, 3.5, 0, Math.PI*2);
  ctx.fill();
  ctx.fillStyle = '#0f0a1a';
  ctx.beginPath();
  ctx.arc(16, -7, 1.5, 0, Math.PI*2);
  ctx.fill();
  // beak
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.moveTo(22, -4);
  ctx.lineTo(28, -2);
  ctx.lineTo(22, 1);
  ctx.fill();
  // rider (tiny Plumbmonkey silhouette)
  ctx.fillStyle = '#c084fc';
  ctx.fillRect(-4, -18, 10, 12);
  ctx.beginPath();
  ctx.arc(1, -22, 5, 0, Math.PI*2);
  ctx.fill();

  ctx.restore();
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;

  // Particles
  particles.forEach(p => {
    ctx.globalAlpha = p.life / 25;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  ctx.restore(); // end screen shake — overlays below stay steady

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
}

function updateHUD() {
  document.getElementById('score').textContent = score;
  document.getElementById('lives').textContent = lives;
  document.getElementById('wave').textContent = wave;
  document.getElementById('crystals').textContent = crystals;
  document.getElementById('best').textContent = best;
}

// ---------- Loop ----------
function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}
updateHUD();
loop();
console.log('Spectral Manor: Luno\'s Flight ready — Ride Luno, shatter the witches');
