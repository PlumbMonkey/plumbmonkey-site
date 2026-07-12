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
      state: 'flying'   // flying | crystal
    });
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
  if (player.y > H - 70) {
    player.y = H - 70;
    player.vy = Math.min(0, player.vy);
  }
  if (player.y < 20) {
    player.y = 20;
    player.vy = Math.max(0, player.vy);
  }

  // Platform collision (land on top)
  platforms.forEach(p => {
    if (player.vy >= 0 &&
        player.x + player.w > p.x + 6 && player.x < p.x + p.w - 6 &&
        player.y + player.h > p.y && player.y + player.h < p.y + p.h + 14 &&
        player.y + player.h - player.vy <= p.y + 4) {
      if (player.vy > 1.5) sfx.land();
      player.y = p.y - player.h;
      player.vy = 0;
    }
  });

  if (player.invuln > 0) player.invuln--;

  // --- Alien platforms move ---
  platforms.forEach(p => {
    if (p.type === 'alien') {
      p.x += p.vx;
      if (Math.abs(p.x - p.originX) > p.range) p.vx *= -1;
    }
  });

  // --- Witches AI (Joust behavior) ---
  witches.forEach(w => {
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

    // bounce on platforms
    platforms.forEach(p => {
      if (w.vy >= 0 &&
          w.x + w.w > p.x && w.x < p.x + p.w &&
          w.y + w.h > p.y && w.y + w.h < p.y + 18) {
        w.y = p.y - w.h;
        w.vy = -3;
      }
    });
  });

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
  witches.forEach((w, wi) => {
    if (w.state !== 'flying') return;
    if (player.invuln > 0) return;

    if (player.x < w.x + w.w && player.x + player.w > w.x &&
        player.y < w.y + w.h && player.y + player.h > w.y) {

      // Who is higher? (center Y)
      const playerMid = player.y + player.h * 0.4;
      const witchMid  = w.y + w.h * 0.4;

      if (playerMid < witchMid - 4) {
        // Player wins — witch becomes crystal
        w.state = 'crystal';
        score += 200 + wave * 25;
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
        lives--;
        player.invuln = 70;
        player.vy = -6;
        player.vx = (player.x < w.x ? -1 : 1) * 4;
        sfx.hurt();
        createParticles(player.x + 20, player.y + 15, '#f472b6', 12);
        updateHUD();
        if (lives <= 0) {
          gameOver = true;
          gameRunning = false;
          sfx.gameOver();
          document.getElementById('startOverlay').classList.remove('hidden');
          document.getElementById('startOverlay').innerHTML = `
            <h2>FALLEN FROM THE SKY</h2>
            <p>Crystals: ${crystals} &nbsp;|&nbsp; Score: ${score}</p>
            <p style="margin-top:0.9rem; opacity:0.8">Click or SPACE to soar again</p>
          `;
        }
      }
    }
  });

  // Ghosts hurt on touch
  if (player.invuln <= 0) {
    ghosts.forEach(g => {
      if (player.x < g.x + g.w && player.x + player.w > g.x &&
          player.y < g.y + g.h && player.y + player.h > g.y) {
        lives--;
        player.invuln = 70;
        player.vy = -5;
        sfx.hurt();
        createParticles(player.x + 20, player.y + 15, '#a78bfa', 10);
        updateHUD();
        if (lives <= 0) {
          gameOver = true;
          gameRunning = false;
          sfx.gameOver();
          document.getElementById('startOverlay').classList.remove('hidden');
          document.getElementById('startOverlay').innerHTML = `
            <h2>FALLEN FROM THE SKY</h2>
            <p>Crystals: ${crystals} &nbsp;|&nbsp; Score: ${score}</p>
            <p style="margin-top:0.9rem; opacity:0.8">Click or SPACE to soar again</p>
          `;
        }
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

  // Wave clear
  if (witches.length === 0 && gameRunning) {
    wave++;
    sfx.wave();
    spawnWave();
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
  // Sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#0a0618');
  sky.addColorStop(0.6, '#150a28');
  sky.addColorStop(1, '#1a0f30');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

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

  // Witches
  witches.forEach(w => {
    if (w.state !== 'flying') return;
    ctx.save();
    ctx.translate(w.x + w.w/2, w.y + w.h/2);
    ctx.scale(w.facing, 1);

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

  // Player riding Luno (owl-griffin)
  ctx.save();
  ctx.translate(player.x + player.w/2, player.y + player.h/2);
  if (player.invuln > 0 && Math.floor(player.invuln/3)%2===0) ctx.globalAlpha = 0.4;
  ctx.scale(player.facing, 1);

  // Luno body (owl-griffin silhouette)
  ctx.fillStyle = '#a8a29e';
  ctx.shadowColor = '#c084fc';
  ctx.shadowBlur = 12;
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
  // wing (flaps)
  const wingOpen = player.flapAnim > 0 ? -18 : -6;
  ctx.fillStyle = '#78716c';
  ctx.beginPath();
  ctx.moveTo(-8, 0);
  ctx.quadraticCurveTo(-28, wingOpen, -22, 12);
  ctx.quadraticCurveTo(-14, 8, -6, 6);
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
}

function updateHUD() {
  document.getElementById('score').textContent = score;
  document.getElementById('lives').textContent = lives;
  document.getElementById('wave').textContent = wave;
  document.getElementById('crystals').textContent = crystals;
}

// ---------- Loop ----------
function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}
loop();
console.log('Spectral Manor: Luno\'s Flight ready — Ride Luno, shatter the witches');
