// ============================================================
// SPECTRAL MANOR REVENGER
// Ghost Circuit Themed Defender Clone
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
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playTone(freq, duration, type = 'square', vol = 0.08, slide = 0) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  if (slide) osc.frequency.linearRampToValueAtTime(freq + slide, audioCtx.currentTime + duration);
  gain.gain.setValueAtTime(vol, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

function playNoise(duration, vol = 0.06) {
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
  gain.connect(audioCtx.destination);
  noise.start();
}

// Sound presets
const sfx = {
  shoot: () => {
    playTone(880, 0.07, 'square', 0.05, -400);
    playTone(440, 0.05, 'triangle', 0.03);
  },
  heavy: () => {
    playTone(180, 0.15, 'sawtooth', 0.07, -80);
    playNoise(0.1, 0.04);
  },
  spread: () => {
    playTone(660, 0.06, 'square', 0.04, -200);
    playTone(990, 0.05, 'square', 0.03, -300);
  },
  explosion: () => {
    playNoise(0.25, 0.09);
    playTone(120, 0.2, 'sawtooth', 0.06, -100);
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
  rescue: () => {
    playTone(440, 0.1, 'triangle', 0.06);
    setTimeout(() => playTone(554, 0.1, 'triangle', 0.06), 80);
    setTimeout(() => playTone(659, 0.15, 'triangle', 0.07), 160);
  },
  abduct: () => {
    playTone(300, 0.3, 'sawtooth', 0.05, -200);
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
let keys = {};
let deathBlast = null; // dramatic full-screen death explosion

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
  shieldTimer: 0,    // frames of shield flicker after hit
  shotType: 0,       // 0 = dual, 1 = heavy, 2 = spread
  powerupTime: 0     // frames remaining on current power-up
};

// ---------- Entities ----------
let bullets = [];
let enemies = [];
let particles = [];
let trails = [];     // engine trail particles
let fans = [];       // concert fans on the ground (can be abducted)
let powerups = [];   // floating power-ups
let groundScroll = 0;
let rescued = 0;
let abducted = 0;
let powerupTimer = 0; // frames until next power-up can spawn

// ---------- Input ----------
window.addEventListener('keydown', e => {
  initAudio();
  keys[e.code] = true;
  if (e.code === 'Space' || e.code === 'KeyZ') e.preventDefault();
  if ((e.code === 'Space' || e.code === 'KeyZ') && !gameRunning && !gameOver) startGame();
  if (e.code === 'KeyP' && gameRunning) gameRunning = false; // simple pause
});
window.addEventListener('keyup', e => keys[e.code] = false);

document.getElementById('startOverlay').addEventListener('click', () => {
  initAudio();
  if (!gameRunning && !gameOver) startGame();
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
  enemies = [];
  particles = [];
  trails = [];
  fans = [];
  powerups = [];
  deathBlast = null;
  powerupTimer = 180;
  player.x = 120;
  player.y = H / 2;
  player.bank = 0;
  player.shieldTimer = 0;
  player.shotType = 0;
  player.powerupTime = 0;
  gameRunning = true;
  gameOver = false;
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
  // Place fans along the ground (concert crowd outside the manor)
  for (let i = 0; i < 12; i++) {
    fans.push({
      x: 80 + i * 75 + Math.random() * 30,
      y: H - 52,
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
      x: W + 50 + Math.random() * 400,
      y: 60 + Math.random() * (H - 160),
      w: t === 'capsule' ? 36 : 28,
      h: t === 'capsule' ? 16 : 22,
      speed: 1.3 + wave * 0.22 + Math.random() * 0.9,
      type: t,
      hp: 1,
      rot: Math.random() * Math.PI * 2,
      carrying: null,     // fan currently being abducted
      seeking: Math.random() < 0.55  // some enemies actively hunt fans
    });
  }
}

function fire() {
  if (player.fireCooldown > 0) return;

  const baseY = player.y + player.h / 2;
  const noseX = player.x + 40;

  if (player.shotType === 0) {
    // Dual neon lasers
    bullets.push({ x: noseX, y: baseY - 7, w: 28, h: 3, speed: 16, type: 'normal' });
    bullets.push({ x: noseX, y: baseY + 4, w: 28, h: 3, speed: 16, type: 'normal' });
    player.fireCooldown = 7;
    sfx.shoot();
  } else if (player.shotType === 1) {
    // Heavy neon bolt
    bullets.push({ x: noseX, y: baseY - 3, w: 32, h: 8, speed: 11, type: 'heavy' });
    player.fireCooldown = 13;
    sfx.heavy();
  } else {
    // Spread lasers
    bullets.push({ x: noseX, y: baseY - 2, w: 24, h: 3, speed: 15, type: 'normal', vy: 0 });
    bullets.push({ x: noseX, y: baseY - 2, w: 22, h: 3, speed: 14, type: 'normal', vy: -2.4 });
    bullets.push({ x: noseX, y: baseY - 2, w: 22, h: 3, speed: 14, type: 'normal', vy: 2.4 });
    player.fireCooldown = 11;
    sfx.spread();
  }
}

// ---------- Update ----------
function update() {
  if (!gameRunning) return;

  // Player movement + banking
  player.vx = 0;
  player.vy = 0;
  if (keys['ArrowLeft'] || keys['KeyA']) player.vx = -player.speed;
  if (keys['ArrowRight'] || keys['KeyD']) player.vx = player.speed;
  if (keys['ArrowUp'] || keys['KeyW']) player.vy = -player.speed;
  if (keys['ArrowDown'] || keys['KeyS']) player.vy = player.speed;

  player.x = Math.max(10, Math.min(W - 90, player.x + player.vx));
  player.y = Math.max(30, Math.min(H - 55, player.y + player.vy));

  // Smooth banking tilt (target based on vertical movement)
  const targetBank = player.vy * 0.045;
  player.bank += (targetBank - player.bank) * 0.18;

  if (keys['Space'] || keys['KeyZ']) fire();
  if (player.fireCooldown > 0) player.fireCooldown--;
  if (player.shieldTimer > 0) player.shieldTimer--;

  // Engine trail particles
  if (Math.random() > 0.3) {
    trails.push({
      x: player.x + 2,
      y: player.y + player.h / 2 + (Math.random() - 0.5) * 8,
      life: 18 + Math.random() * 10,
      maxLife: 28,
      size: 2 + Math.random() * 3,
      vx: -1.5 - Math.random() * 2,
      vy: (Math.random() - 0.5) * 1.5
    });
  }
  trails.forEach(t => {
    t.x += t.vx;
    t.y += t.vy;
    t.life--;
  });
  trails = trails.filter(t => t.life > 0);

  // Bullets (support vy for spread)
  bullets.forEach(b => {
    b.x += b.speed;
    if (b.vy) b.y += b.vy;
  });
  bullets = bullets.filter(b => b.x < W + 30 && b.y > -20 && b.y < H + 20);

  // ---------- Fans & Abduction Logic ----------
  // Update fans
  fans.forEach(f => {
    if (f.state === 'grabbed' && f.grabber) {
      // Follow the enemy that grabbed them
      f.x = f.grabber.x + f.grabber.w/2 - 5;
      f.y = f.grabber.y + f.grabber.h + 2;
    } else if (f.state === 'falling') {
      f.fallVy += 0.28;
      f.y += f.fallVy;
      if (f.y >= H - 52) {
        f.y = H - 52;
        f.state = 'ground';
        f.fallVy = 0;
        f.grabber = null;
      }
    }
  });

  // Enemies AI + movement
  enemies.forEach(e => {
    if (e.carrying) {
      // Carrying a fan → fly upward and left to abduct
      e.y -= 1.6;
      e.x -= e.speed * 0.7;
      // If they reach the top, fan is lost forever
      if (e.y < -30) {
        abducted++;
        const idx = fans.indexOf(e.carrying);
        if (idx > -1) fans.splice(idx, 1);
        e.carrying = null;
        score = Math.max(0, score - 100);
        sfx.abduct();
        updateHUD();
      }
    } else if (e.seeking) {
      // Look for nearest ground fan
      let nearest = null;
      let nearestDist = 9999;
      fans.forEach(f => {
        if (f.state === 'ground') {
          const dx = f.x - e.x;
          const dy = f.y - e.y;
          const d = Math.sqrt(dx*dx + dy*dy);
          if (d < nearestDist) {
            nearestDist = d;
            nearest = f;
          }
        }
      });
      if (nearest && nearestDist < 280) {
        // Move toward the fan
        const dx = nearest.x - (e.x + e.w/2);
        const dy = nearest.y - (e.y + e.h);
        const dist = Math.sqrt(dx*dx + dy*dy) || 1;
        e.x += (dx / dist) * e.speed * 0.9;
        e.y += (dy / dist) * e.speed * 0.9;

        // Grab if close enough
        if (dist < 28) {
          nearest.state = 'grabbed';
          nearest.grabber = e;
          e.carrying = nearest;
          e.seeking = false;
        }
      } else {
        // Default left movement
        e.x -= e.speed;
      }
    } else {
      e.x -= e.speed;
      if (e.type === 'ghost') e.y += Math.sin(Date.now() * 0.004 + e.x) * 0.6;
    }
  });

  // Collisions: bullets vs enemies
  bullets.forEach((b, bi) => {
    enemies.forEach((e, ei) => {
      if (b.x < e.x + e.w && b.x + b.w > e.x &&
          b.y < e.y + e.h && b.y + b.h > e.y) {
        createExplosion(e.x + e.w/2, e.y + e.h/2, e.type === 'ghost' ? '#c084fc' : '#22d3ee');
        sfx.explosion();

        // Free the fan if this enemy was carrying one
        if (e.carrying) {
          e.carrying.state = 'falling';
          e.carrying.fallVy = -1.5;
          e.carrying.grabber = null;
          e.carrying = null;
          score += 250; // big rescue bonus
          rescued++;
          sfx.rescue();
        }

        // Chance to drop a power-up
        if (Math.random() < 0.22) {
          spawnPowerup(e.x + e.w/2, e.y + e.h/2);
        }

        enemies.splice(ei, 1);
        bullets.splice(bi, 1);
        const points = { ghost: 150, sphere: 120, capsule: 180, cylinder: 140, pyramid: 200 };
        score += points[e.type] || 100;
        if (b.type === 'heavy') score += 40;
        updateHUD();
      }
    });
  });

  // Player vs enemies (with shield flicker)
  enemies.forEach((e, ei) => {
    if (player.shieldTimer > 0) return;
    if (player.x < e.x + e.w && player.x + player.w > e.x &&
        player.y < e.y + e.h && player.y + player.h > e.y) {
      // Drop fan if carrying
      if (e.carrying) {
        e.carrying.state = 'falling';
        e.carrying.fallVy = -1;
        e.carrying.grabber = null;
        e.carrying = null;
      }

      enemies.splice(ei, 1);
      lives--;
      updateHUD();

      if (lives <= 0) {
        // DRAMATIC FULL-SCREEN DEATH BLAST
        createDeathBlast(player.x + player.w/2, player.y + player.h/2);
        sfx.hit();
        sfx.explosion();
        setTimeout(() => sfx.gameOver(), 300);
        gameRunning = false;
        // Delay the game-over screen so the blast can play out
        setTimeout(() => {
          gameOver = true;
          document.getElementById('startOverlay').classList.remove('hidden');
          document.getElementById('startOverlay').innerHTML = `
            <h2>CONCERT OVERRUN</h2>
            <p>Rescued: ${rescued} &nbsp;|&nbsp; Abducted: ${abducted}</p>
            <p style="margin-top:0.5rem">Final Score: ${score}</p>
            <p style="margin-top:1rem; opacity:0.8">Click or SPACE to defend again</p>
          `;
        }, 1100);
      } else {
        createExplosion(player.x + player.w/2, player.y + player.h/2, '#f472b6');
        sfx.hit();
        player.shieldTimer = 55;
      }
    }
  });

  // Remove off-screen enemies
  enemies = enemies.filter(e => {
    if (e.x < -50) {
      if (e.carrying) {
        abducted++;
        const idx = fans.indexOf(e.carrying);
        if (idx > -1) fans.splice(idx, 1);
      }
      return false;
    }
    return true;
  });

  // Next wave
  if (enemies.length === 0) {
    wave++;
    // Respawn a few more fans if running low
    if (fans.filter(f => f.state === 'ground' || f.state === 'falling').length < 6) {
      for (let i = 0; i < 4; i++) {
        fans.push({
          x: 100 + Math.random() * (W - 200),
          y: H - 52,
          w: 10, h: 16,
          state: 'ground',
          grabber: null,
          fallVy: 0,
          color: Math.random() > 0.5 ? '#f0abfc' : '#c4b5fd'
        });
      }
    }
    updateHUD();
    spawnWave();
  }

  // ---------- Power-ups ----------
  // Countdown active power-up
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

    // Player pickup
    if (player.x < p.x + p.w && player.x + player.w > p.x &&
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

  // Ground scroll
  groundScroll = (groundScroll + 2.2) % 60;
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

// ---------- Draw ----------
function draw() {
  // Background sky
  ctx.fillStyle = '#0a0612';
  ctx.fillRect(0, 0, W, H);

  // Distant purple nebula / atmosphere
  const skyGrad = ctx.createLinearGradient(0, 0, 0, H - 60);
  skyGrad.addColorStop(0, '#0a0612');
  skyGrad.addColorStop(0.6, '#130a24');
  skyGrad.addColorStop(1, '#1a0f2e');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, H - 40);

  // Stars
  ctx.fillStyle = '#e0d4ff';
  for (let i = 0; i < 70; i++) {
    const sx = (i * 97 + groundScroll * 0.25) % W;
    const sy = (i * 53) % (H - 100);
    ctx.globalAlpha = 0.25 + (i % 4) * 0.18;
    ctx.fillRect(sx, sy, 1.5, 1.5);
  }
  ctx.globalAlpha = 1;

  // Full moon
  ctx.beginPath();
  ctx.arc(W - 110, 70, 38, 0, Math.PI * 2);
  ctx.fillStyle = '#e9d5ff';
  ctx.shadowColor = '#c084fc';
  ctx.shadowBlur = 30;
  ctx.fill();
  ctx.shadowBlur = 0;
  // moon craters
  ctx.fillStyle = 'rgba(180, 140, 220, 0.25)';
  ctx.beginPath(); ctx.arc(W - 125, 60, 8, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(W - 100, 80, 6, 0, Math.PI*2); ctx.fill();

  // ===== MANOR SILHOUETTE (distant, right side) =====
  const manorX = W - 280;
  const manorBase = H - 95;
  ctx.fillStyle = '#0d0818';
  
  // Main house body
  ctx.fillRect(manorX + 40, manorBase - 90, 120, 90);
  // Left wing
  ctx.fillRect(manorX, manorBase - 70, 50, 70);
  // Right tower
  ctx.fillRect(manorX + 150, manorBase - 120, 40, 120);
  // Roof peaks
  ctx.beginPath();
  ctx.moveTo(manorX + 35, manorBase - 90);
  ctx.lineTo(manorX + 100, manorBase - 140);
  ctx.lineTo(manorX + 165, manorBase - 90);
  ctx.fill();
  // Tower roof
  ctx.beginPath();
  ctx.moveTo(manorX + 145, manorBase - 120);
  ctx.lineTo(manorX + 170, manorBase - 155);
  ctx.lineTo(manorX + 195, manorBase - 120);
  ctx.fill();
  // Chimney
  ctx.fillRect(manorX + 70, manorBase - 150, 12, 25);

  // Glowing windows (purple + amber)
  const winColors = ['#c084fc', '#f59e0b', '#e879f9', '#c084fc', '#fbbf24'];
  const windows = [
    [manorX + 55, manorBase - 70], [manorX + 85, manorBase - 70], [manorX + 115, manorBase - 70],
    [manorX + 55, manorBase - 40], [manorX + 100, manorBase - 40],
    [manorX + 15, manorBase - 50], [manorX + 160, manorBase - 90], [manorX + 160, manorBase - 55]
  ];
  windows.forEach((w, i) => {
    ctx.fillStyle = winColors[i % winColors.length];
    ctx.globalAlpha = 0.7 + Math.sin(Date.now() * 0.003 + i) * 0.2;
    ctx.fillRect(w[0], w[1], 14, 16);
  });
  ctx.globalAlpha = 1;

  // ===== CONCERT STAGE (left-center) =====
  const stageX = 180;
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
  // Screen glow
  ctx.fillStyle = 'rgba(192, 132, 252, 0.15)';
  ctx.fillRect(stageX + 25, stageY - 50, 170, 45);

  // Ghost Circuit "logo" on screen (simple)
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
  // Speaker cones
  ctx.fillStyle = '#4c1d95';
  ctx.beginPath(); ctx.arc(stageX - 14, stageY - 20, 7, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(stageX - 14, stageY + 5, 7, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(stageX + 234, stageY - 20, 7, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(stageX + 234, stageY + 5, 7, 0, Math.PI*2); ctx.fill();

  // ===== STAGE LIGHTS (animated beams) =====
  const t = Date.now() * 0.002;
  const lightColors = ['rgba(192,132,252,0.12)', 'rgba(34,211,238,0.10)', 'rgba(244,114,182,0.10)', 'rgba(167,139,250,0.12)'];
  
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

  // Light fixtures on stage
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

  // ===== GROUND / HILLS =====
  ctx.fillStyle = '#12091f';
  ctx.beginPath();
  ctx.moveTo(0, H - 40);
  for (let x = 0; x <= W; x += 20) {
    const y = H - 40 - Math.sin((x + groundScroll) * 0.018) * 14 - Math.sin((x + groundScroll) * 0.04) * 7;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();

  // Ground glow line
  ctx.strokeStyle = '#7c3aed';
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.moveTo(0, H - 40);
  for (let x = 0; x <= W; x += 20) {
    const y = H - 40 - Math.sin((x + groundScroll) * 0.018) * 14 - Math.sin((x + groundScroll) * 0.04) * 7;
    ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Engine trails (behind ship)
  trails.forEach(t => {
    const alpha = t.life / t.maxLife;
    ctx.globalAlpha = alpha * 0.7;
    ctx.fillStyle = alpha > 0.5 ? '#67e8f9' : '#c084fc';
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.size * alpha, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  // Player ship — Spectral Manor Revenger (with banking + shield)
  ctx.save();
  ctx.translate(player.x + 22, player.y + 10); // pivot near center
  ctx.rotate(player.bank);                     // banking tilt
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
  ctx.shadowBlur = 18;

  // Main hull
  ctx.fillStyle = '#1e1b4b';
  ctx.beginPath();
  ctx.moveTo(42, 9);
  ctx.lineTo(28, 2);
  ctx.lineTo(8, 0);
  ctx.lineTo(0, 5);
  ctx.lineTo(0, 13);
  ctx.lineTo(8, 18);
  ctx.lineTo(28, 16);
  ctx.closePath();
  ctx.fill();

  // Wing blades
  ctx.fillStyle = '#7c3aed';
  ctx.beginPath();
  ctx.moveTo(26, 1);
  ctx.lineTo(14, -6);
  ctx.lineTo(18, 2);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(26, 17);
  ctx.lineTo(14, 24);
  ctx.lineTo(18, 16);
  ctx.closePath();
  ctx.fill();

  // Core energy body
  ctx.fillStyle = '#c084fc';
  ctx.beginPath();
  ctx.moveTo(38, 9);
  ctx.lineTo(22, 5);
  ctx.lineTo(12, 9);
  ctx.lineTo(22, 13);
  ctx.closePath();
  ctx.fill();

  // Cockpit crystal
  ctx.shadowBlur = 12;
  ctx.fillStyle = '#f0abfc';
  ctx.beginPath();
  ctx.ellipse(28, 9, 7, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Front energy tip
  ctx.fillStyle = '#e879f9';
  ctx.beginPath();
  ctx.moveTo(42, 9);
  ctx.lineTo(36, 6);
  ctx.lineTo(36, 12);
  ctx.closePath();
  ctx.fill();

  // Thruster flames
  ctx.shadowColor = '#22d3ee';
  ctx.shadowBlur = 14;
  ctx.fillStyle = '#22d3ee';
  ctx.beginPath();
  ctx.moveTo(0, 6);
  ctx.lineTo(-11 - Math.random() * 5, 9);
  ctx.lineTo(0, 12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#67e8f9';
  ctx.fillRect(-5, 3, 6, 3);
  ctx.fillRect(-5, 12, 6, 3);

  ctx.shadowBlur = 0;
  ctx.restore();

  // Bullets — Classic Defender-style neon lasers
  bullets.forEach(b => {
    if (b.type === 'heavy') {
      // Heavy = thick magenta/pink laser
      ctx.shadowColor = '#ff00aa';
      ctx.shadowBlur = 16;
      ctx.fillStyle = '#ff66cc';
      ctx.fillRect(b.x, b.y - 1, b.w + 4, b.h + 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(b.x + 2, b.y + 1, b.w - 2, b.h - 2);
    } else {
      // Classic neon green / cyan laser beam (Defender style)
      ctx.shadowColor = '#00ff88';
      ctx.shadowBlur = 14;
      // Outer glow
      ctx.fillStyle = '#00ff88';
      ctx.fillRect(b.x, b.y - 1, b.w + 6, b.h + 2);
      // Bright core
      ctx.fillStyle = '#ccffee';
      ctx.fillRect(b.x, b.y, b.w + 2, b.h);
      // Hot white tip
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(b.x + b.w - 2, b.y, 6, b.h);
    }
  });
  ctx.shadowBlur = 0;

  // Enemies - Ghosts + UAP shapes (Sphere, Capsule, Cylinder, Pyramid)
  enemies.forEach(e => {
    const cx = e.x + e.w / 2;
    const cy = e.y + e.h / 2;

    if (e.type === 'ghost') {
      // Classic ghost
      ctx.fillStyle = '#a78bfa';
      ctx.beginPath();
      ctx.ellipse(cx, cy, e.w/2, e.h/2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f0abfc';
      ctx.beginPath();
      ctx.arc(cx - 5, cy - 3, 3, 0, Math.PI * 2);
      ctx.arc(cx + 5, cy - 3, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === 'sphere') {
      // Classic UAP Sphere
      const grad = ctx.createRadialGradient(cx - 4, cy - 4, 2, cx, cy, e.w/2);
      grad.addColorStop(0, '#e0f2fe');
      grad.addColorStop(1, '#0284c7');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, e.w/2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#7dd3fc';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (e.type === 'capsule') {
      // Tic-Tac / Capsule UAP
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.roundRect(e.x, e.y, e.w, e.h, e.h/2);
      ctx.fill();
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // subtle windows
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(e.x + 8, e.y + 5, 6, 6);
      ctx.fillRect(e.x + e.w - 14, e.y + 5, 6, 6);
    } else if (e.type === 'cylinder') {
      // Cylinder UAP
      ctx.fillStyle = '#64748b';
      ctx.fillRect(e.x + 4, e.y, e.w - 8, e.h);
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.ellipse(cx, e.y + 3, (e.w-8)/2, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx, e.y + e.h - 3, (e.w-8)/2, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === 'pyramid') {
      // Pyramid / Tetrahedron UAP
      ctx.fillStyle = '#c084fc';
      ctx.beginPath();
      ctx.moveTo(cx, e.y);
      ctx.lineTo(e.x + e.w, e.y + e.h);
      ctx.lineTo(e.x, e.y + e.h);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#e879f9';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  });

  // Power-ups
  powerups.forEach(p => {
    const alpha = Math.min(1, p.life / 60);
    ctx.globalAlpha = alpha;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 15;
    // Outer ring
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x + 11, p.y + 11, 12, 0, Math.PI * 2);
    ctx.stroke();
    // Inner fill
    ctx.fillStyle = 'rgba(10, 6, 18, 0.85)';
    ctx.beginPath();
    ctx.arc(p.x + 11, p.y + 11, 10, 0, Math.PI * 2);
    ctx.fill();
    // Label
    ctx.fillStyle = p.color;
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.label, p.x + 11, p.y + 11);
    ctx.shadowBlur = 0;
  });
  ctx.globalAlpha = 1;

  // Fans (concert crowd)
  fans.forEach(f => {
    ctx.save();
    if (f.state === 'grabbed') {
      // Being lifted — draw with a beam
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = 'rgba(192, 132, 252, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(f.x + 5, f.y);
      ctx.lineTo(f.x + 5, f.y - 18);
      ctx.stroke();
    }
    // Body
    ctx.fillStyle = f.color;
    ctx.fillRect(f.x, f.y, f.w, f.h - 4);
    // Head
    ctx.beginPath();
    ctx.arc(f.x + 5, f.y - 2, 5, 0, Math.PI * 2);
    ctx.fill();
    // Arms up if scared / grabbed
    if (f.state === 'grabbed' || f.state === 'falling') {
      ctx.strokeStyle = f.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(f.x, f.y + 4);
      ctx.lineTo(f.x - 5, f.y - 4);
      ctx.moveTo(f.x + f.w, f.y + 4);
      ctx.lineTo(f.x + f.w + 5, f.y - 4);
      ctx.stroke();
    }
    ctx.restore();
  });

  // Particles
  particles.forEach(p => {
    ctx.globalAlpha = p.life / 30;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 3, 3);
  });
  ctx.globalAlpha = 1;

  // ===== DRAMATIC DEATH BLAST (full screen takeover) =====
  if (deathBlast) {
    const progress = 1 - (deathBlast.life / deathBlast.maxLife);
    // White flash at the start
    if (deathBlast.life > 55) {
      ctx.fillStyle = `rgba(255, 255, 255, ${(deathBlast.life - 55) / 15 * 0.7})`;
      ctx.fillRect(0, 0, W, H);
    }
    // Expanding ring
    ctx.strokeStyle = `rgba(255, 100, 255, ${1 - progress})`;
    ctx.lineWidth = 8 - progress * 6;
    ctx.beginPath();
    ctx.arc(deathBlast.x, deathBlast.y, progress * 500, 0, Math.PI * 2);
    ctx.stroke();
    // All the colorful particles
    deathBlast.particles.forEach(p => {
      ctx.globalAlpha = Math.min(1, p.life / 20);
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  // Scanline / CRT feel (subtle)
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  for (let y = 0; y < H; y += 3) {
    ctx.fillRect(0, y, W, 1);
  }
}

function updateHUD() {
  document.getElementById('score').textContent = score;
  document.getElementById('lives').textContent = lives;
  document.getElementById('wave').textContent = wave;
  const r = document.getElementById('rescued');
  if (r) r.textContent = rescued;
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
  requestAnimationFrame(loop);
}

loop();
console.log('Spectral Manor Revenger ready — Ghost Circuit Defense');
