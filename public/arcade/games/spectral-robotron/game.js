// ============================================================
// SPECTRAL ROBOTRON
// Ghost Circuit themed Robotron-style twin-stick arena
// Monsters hunt screaming fans — you save them
// ============================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

// ---------- Audio ----------
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
  if (slide) o.frequency.linearRampToValueAtTime(freq + slide, audioCtx.currentTime + dur);
  g.gain.setValueAtTime(vol, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
  o.connect(g); g.connect(audioCtx.destination);
  o.start(); o.stop(audioCtx.currentTime + dur);
}
const sfx = {
  shoot:  () => playTone(920, 0.05, 'square', 0.045, -450),
  hit:    () => playTone(160, 0.1, 'sawtooth', 0.06, -70),
  save:   () => { playTone(520,0.07); setTimeout(()=>playTone(680,0.08),60); setTimeout(()=>playTone(880,0.1),120); },
  lost:   () => playTone(280, 0.25, 'sawtooth', 0.05, -180),
  hurt:   () => playTone(130, 0.14, 'sawtooth', 0.07, -50),
  wave:   () => { playTone(440,0.07); setTimeout(()=>playTone(554,0.07),70); setTimeout(()=>playTone(659,0.12),140); }
};

// ---------- State ----------
let score = 0, lives = 3, wave = 1, saved = 0, lost = 0;
let gameRunning = false, gameOver = false;
let keys = {};
let mouse = { x: W/2, y: H/2, down: false };

// ---------- Player ----------
const player = {
  x: W/2, y: H/2,
  w: 26, h: 26,
  speed: 4.6,
  fireCooldown: 0,
  invuln: 0,
  angle: 0
};

// ---------- Entities ----------
let bullets = [];
let monsters = [];
let fans = [];
let particles = [];

// ---------- Input ----------
window.addEventListener('keydown', e => {
  initAudio();
  keys[e.code] = true;
  if (e.code === 'Space') e.preventDefault();
  if (e.code === 'Space' && !gameRunning && !gameOver) startGame();
});
window.addEventListener('keyup', e => keys[e.code] = false);

canvas.addEventListener('mousemove', e => {
  const r = canvas.getBoundingClientRect();
  mouse.x = (e.clientX - r.left) * (W / r.width);
  mouse.y = (e.clientY - r.top) * (H / r.height);
});
canvas.addEventListener('mousedown', () => { mouse.down = true; initAudio(); });
canvas.addEventListener('mouseup', () => mouse.down = false);

document.getElementById('startOverlay').addEventListener('click', () => {
  initAudio();
  if (!gameRunning && !gameOver) startGame();
});

// ---------- Core ----------
function startGame() {
  score = 0; lives = 3; wave = 1; saved = 0; lost = 0;
  bullets = []; monsters = []; fans = []; particles = [];
  player.x = W/2; player.y = H/2;
  player.fireCooldown = 0; player.invuln = 0;
  gameRunning = true; gameOver = false;
  document.getElementById('startOverlay').classList.add('hidden');
  spawnWave();
  updateHUD();
}

function spawnWave() {
  monsters = [];
  fans = [];

  // Fans — mostly screaming females, some males, a couple kids
  const fanCount = 7 + Math.floor(wave * 1.4);
  for (let i = 0; i < fanCount; i++) {
    const roll = Math.random();
    let type, color, scale;
    if (roll < 0.62) {          // female
      type = 'female';
      color = ['#f0abfc', '#f9a8d4', '#e879f9', '#d8b4fe'][Math.floor(Math.random()*4)];
      scale = 1;
    } else if (roll < 0.88) {   // male
      type = 'male';
      color = ['#93c5fd', '#67e8f9', '#a5b4fc'][Math.floor(Math.random()*3)];
      scale = 1.05;
    } else {                    // child
      type = 'child';
      color = ['#fde68a', '#fca5a5', '#bbf7d0'][Math.floor(Math.random()*3)];
      scale = 0.72;
    }
    fans.push({
      x: 60 + Math.random() * (W - 120),
      y: 50 + Math.random() * (H - 100),
      w: 16 * scale, h: 22 * scale,
      type, color, scale,
      panic: 0,
      grabbed: false,
      grabber: null,
      screamTimer: Math.random() * 40
    });
  }

  // Monsters
  const monsterTypes = [
    { type: 'grunt',   color: '#ef4444', speed: 1.5, hp: 1, size: 1 },
    { type: 'hunter',  color: '#f97316', speed: 2.3, hp: 1, size: 0.9 },
    { type: 'brute',   color: '#a855f7', speed: 1.0, hp: 3, size: 1.3 },
    { type: 'specter', color: '#22d3ee', speed: 1.8, hp: 1, size: 0.95 },
    { type: 'horror',  color: '#4ade80', speed: 1.3, hp: 2, size: 1.15 }
  ];

  const mCount = 5 + wave * 3;
  for (let i = 0; i < mCount; i++) {
    const m = monsterTypes[Math.floor(Math.random() * monsterTypes.length)];
    // spawn near edges
    let x, y;
    if (Math.random() < 0.5) {
      x = Math.random() < 0.5 ? 20 : W - 40;
      y = 40 + Math.random() * (H - 80);
    } else {
      x = 40 + Math.random() * (W - 80);
      y = Math.random() < 0.5 ? 30 : H - 50;
    }
    monsters.push({
      x, y,
      w: 24 * m.size, h: 26 * m.size,
      speed: m.speed + wave * 0.11,
      hp: m.hp + Math.floor(wave / 4),
      maxHp: m.hp + Math.floor(wave / 4),
      type: m.type,
      color: m.color,
      target: null,
      size: m.size
    });
  }
}

function fire() {
  if (player.fireCooldown > 0) return;
  const dx = mouse.x - (player.x + player.w/2);
  const dy = mouse.y - (player.y + player.h/2);
  const dist = Math.sqrt(dx*dx + dy*dy) || 1;
  const speed = 13;
  // dual shot slight spread for Robotron feel
  const baseAng = Math.atan2(dy, dx);
  for (let i = -1; i <= 1; i += 2) {
    const ang = baseAng + i * 0.06;
    bullets.push({
      x: player.x + player.w/2,
      y: player.y + player.h/2,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      r: 4,
      life: 55
    });
  }
  player.fireCooldown = 7;
  sfx.shoot();
}

// ---------- Update ----------
function update() {
  if (!gameRunning) return;

  // Move
  let vx = 0, vy = 0;
  if (keys['ArrowLeft'] || keys['KeyA']) vx = -player.speed;
  if (keys['ArrowRight'] || keys['KeyD']) vx = player.speed;
  if (keys['ArrowUp'] || keys['KeyW']) vy = -player.speed;
  if (keys['ArrowDown'] || keys['KeyS']) vy = player.speed;
  if (vx && vy) { vx *= 0.707; vy *= 0.707; }

  player.x = Math.max(8, Math.min(W - player.w - 8, player.x + vx));
  player.y = Math.max(28, Math.min(H - player.h - 8, player.y + vy));
  player.angle = Math.atan2(mouse.y - (player.y + player.h/2), mouse.x - (player.x + player.w/2));

  if ((mouse.down || keys['Space']) && player.fireCooldown <= 0) fire();
  if (player.fireCooldown > 0) player.fireCooldown--;
  if (player.invuln > 0) player.invuln--;

  // Bullets
  bullets.forEach(b => { b.x += b.vx; b.y += b.vy; b.life--; });
  bullets = bullets.filter(b => b.life > 0 && b.x > -10 && b.x < W+10 && b.y > -10 && b.y < H+10);

  // Fans panic + scream animation
  fans.forEach(f => {
    f.screamTimer--;
    if (f.screamTimer <= 0) {
      f.panic = 12;
      f.screamTimer = 50 + Math.random() * 70;
    }
    if (f.panic > 0) f.panic--;

    if (f.grabbed && f.grabber) {
      f.x = f.grabber.x + f.grabber.w/2 - f.w/2;
      f.y = f.grabber.y + f.grabber.h - 4;
    }
  });

  // Monsters AI — hunt nearest fan, or player if close
  monsters.forEach(m => {
    let target = null;
    let best = 99999;

    // Prefer ungrabbed fans
    fans.forEach(f => {
      if (f.grabbed) return;
      const dx = f.x - m.x, dy = f.y - m.y;
      const d = dx*dx + dy*dy;
      if (d < best) { best = d; target = f; }
    });

    // If a fan is very close to player, sometimes go after player
    const pdx = player.x - m.x, pdy = player.y - m.y;
    const pd = Math.sqrt(pdx*pdx + pdy*pdy);
    if (pd < 140 && Math.random() < 0.3) {
      target = null; // chase player
    }

    if (target && !target.grabbed) {
      const dx = target.x - m.x, dy = target.y - m.y;
      const dist = Math.sqrt(dx*dx + dy*dy) || 1;
      m.x += (dx / dist) * m.speed;
      m.y += (dy / dist) * m.speed;

      // Grab fan
      if (dist < 22) {
        target.grabbed = true;
        target.grabber = m;
        m.carrying = target;
      }
    } else if (m.carrying) {
      // Drag fan to nearest edge to "escape"
      const edges = [
        { x: -40, y: m.y },
        { x: W + 40, y: m.y },
        { x: m.x, y: -40 },
        { x: m.x, y: H + 40 }
      ];
      let nearest = edges[0], nd = 9999;
      edges.forEach(e => {
        const d = Math.abs(e.x - m.x) + Math.abs(e.y - m.y);
        if (d < nd) { nd = d; nearest = e; }
      });
      const dx = nearest.x - m.x, dy = nearest.y - m.y;
      const dist = Math.sqrt(dx*dx + dy*dy) || 1;
      m.x += (dx / dist) * m.speed * 1.15;
      m.y += (dy / dist) * m.speed * 1.15;

      // Escaped
      if (m.x < -20 || m.x > W + 20 || m.y < -20 || m.y > H + 20) {
        lost++;
        sfx.lost();
        const idx = fans.indexOf(m.carrying);
        if (idx > -1) fans.splice(idx, 1);
        m.carrying = null;
        updateHUD();
      }
    } else {
      // Chase player
      const dx = player.x - m.x, dy = player.y - m.y;
      const dist = Math.sqrt(dx*dx + dy*dy) || 1;
      m.x += (dx / dist) * m.speed;
      m.y += (dy / dist) * m.speed;
    }

    // Keep mostly on screen while hunting
    if (!m.carrying) {
      m.x = Math.max(10, Math.min(W - 40, m.x));
      m.y = Math.max(30, Math.min(H - 40, m.y));
    }
  });

  // Bullets vs monsters
  bullets.forEach((b, bi) => {
    monsters.forEach((m, mi) => {
      if (b.x > m.x && b.x < m.x + m.w && b.y > m.y && b.y < m.y + m.h) {
        m.hp--;
        createParticles(m.x + m.w/2, m.y + m.h/2, m.color, 6);
        bullets.splice(bi, 1);
        sfx.hit();
        if (m.hp <= 0) {
          // Free carried fan
          if (m.carrying) {
            m.carrying.grabbed = false;
            m.carrying.grabber = null;
            m.carrying = null;
          }
          score += 150 + wave * 15;
          createParticles(m.x + m.w/2, m.y + m.h/2, m.color, 16);
          monsters.splice(mi, 1);
          updateHUD();
        }
      }
    });
  });

  // Player rescues fans by walking into them (if not grabbed)
  fans.forEach((f, fi) => {
    if (f.grabbed) return;
    if (player.x < f.x + f.w && player.x + player.w > f.x &&
        player.y < f.y + f.h && player.y + player.h > f.y) {
      saved++;
      score += 300;
      sfx.save();
      createParticles(f.x + f.w/2, f.y + f.h/2, f.color, 10);
      fans.splice(fi, 1);
      updateHUD();
    }
  });

  // Monster touches player
  if (player.invuln <= 0) {
    monsters.forEach(m => {
      if (player.x < m.x + m.w && player.x + player.w > m.x &&
          player.y < m.y + m.h && player.y + player.h > m.y) {
        lives--;
        player.invuln = 70;
        sfx.hurt();
        createParticles(player.x + 13, player.y + 13, '#f472b6', 14);
        // knockback
        const dx = player.x - m.x, dy = player.y - m.y;
        const d = Math.sqrt(dx*dx + dy*dy) || 1;
        player.x += (dx / d) * 30;
        player.y += (dy / d) * 30;
        updateHUD();
        if (lives <= 0) {
          gameOver = true;
          gameRunning = false;
          document.getElementById('startOverlay').classList.remove('hidden');
          document.getElementById('startOverlay').innerHTML = `
            <h2>FANS LOST</h2>
            <p>Saved: ${saved} &nbsp;|&nbsp; Lost: ${lost}</p>
            <p style="margin-top:0.5rem">Final Score: ${score}</p>
            <p style="margin-top:0.9rem; opacity:0.8">Click or SPACE to try again</p>
          `;
        }
      }
    });
  }

  // Wave clear
  if (monsters.length === 0 && fans.length === 0 && gameRunning) {
    wave++;
    sfx.wave();
    spawnWave();
    updateHUD();
  } else if (monsters.length === 0 && fans.some(f => !f.grabbed)) {
    // all monsters dead but fans remain — auto rescue remaining
    fans.forEach(f => {
      if (!f.grabbed) { saved++; score += 300; }
    });
    fans = [];
    wave++;
    sfx.wave();
    spawnWave();
    updateHUD();
  }

  // Particles
  particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.life--; });
  particles = particles.filter(p => p.life > 0);
}

function createParticles(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    particles.push({
      x, y,
      vx: (Math.random()-0.5)*8,
      vy: (Math.random()-0.5)*8,
      life: 16 + Math.random()*14,
      color,
      size: 2 + Math.random()*3
    });
  }
}

// ---------- Draw ----------
function draw() {
  // Dark arena
  ctx.fillStyle = '#0b0614';
  ctx.fillRect(0, 0, W, H);

  // Subtle grid
  ctx.strokeStyle = 'rgba(124, 58, 237, 0.08)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 48) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += 48) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // Border glow
  ctx.strokeStyle = '#7c3aed';
  ctx.lineWidth = 3;
  ctx.strokeRect(4, 4, W-8, H-8);

  // Fans
  fans.forEach(f => {
    ctx.save();
    ctx.translate(f.x + f.w/2, f.y + f.h/2);

    // panic shake
    if (f.panic > 0 || f.grabbed) {
      ctx.translate((Math.random()-0.5)*3, (Math.random()-0.5)*3);
    }

    // body
    ctx.fillStyle = f.color;
    if (f.type === 'child') {
      ctx.beginPath();
      ctx.ellipse(0, 4, 7 * f.scale, 9 * f.scale, 0, 0, Math.PI*2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.ellipse(0, 5, 8 * f.scale, 11 * f.scale, 0, 0, Math.PI*2);
      ctx.fill();
    }

    // head
    ctx.fillStyle = '#fde8e8';
    ctx.beginPath();
    ctx.arc(0, -9 * f.scale, 7 * f.scale, 0, Math.PI*2);
    ctx.fill();

    // hair
    if (f.type === 'female') {
      ctx.fillStyle = ['#1e1b4b', '#4c1d95', '#831843', '#0f172a'][Math.floor(f.x) % 4];
      ctx.beginPath();
      ctx.ellipse(0, -12 * f.scale, 8 * f.scale, 6 * f.scale, 0, 0, Math.PI*2);
      ctx.fill();
    } else if (f.type === 'male') {
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.ellipse(0, -12 * f.scale, 7 * f.scale, 4 * f.scale, 0, 0, Math.PI*2);
      ctx.fill();
    }

    // eyes (scared)
    ctx.fillStyle = '#0f0a1a';
    ctx.fillRect(-3.5 * f.scale, -10 * f.scale, 2.5 * f.scale, 2.5 * f.scale);
    ctx.fillRect(1 * f.scale, -10 * f.scale, 2.5 * f.scale, 2.5 * f.scale);

    // open mouth scream
    if (f.panic > 0 || f.grabbed) {
      ctx.fillStyle = '#0f0a1a';
      ctx.beginPath();
      ctx.ellipse(0, -5 * f.scale, 2.5 * f.scale, 3 * f.scale, 0, 0, Math.PI*2);
      ctx.fill();
      // little scream lines
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(6 * f.scale, -14 * f.scale);
      ctx.lineTo(11 * f.scale, -18 * f.scale);
      ctx.moveTo(7 * f.scale, -10 * f.scale);
      ctx.lineTo(12 * f.scale, -11 * f.scale);
      ctx.stroke();
    }

    // arms up when panicked / grabbed
    if (f.panic > 0 || f.grabbed) {
      ctx.strokeStyle = f.color;
      ctx.lineWidth = 3 * f.scale;
      ctx.beginPath();
      ctx.moveTo(-6 * f.scale, 0);
      ctx.lineTo(-11 * f.scale, -12 * f.scale);
      ctx.moveTo(6 * f.scale, 0);
      ctx.lineTo(11 * f.scale, -12 * f.scale);
      ctx.stroke();
    }

    ctx.restore();
  });

  // Monsters
  monsters.forEach(m => {
    ctx.save();
    ctx.translate(m.x + m.w/2, m.y + m.h/2);

    ctx.fillStyle = m.color;
    ctx.shadowColor = m.color;
    ctx.shadowBlur = 12;

    if (m.type === 'specter') {
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.ellipse(0, 0, 13 * m.size, 16 * m.size, 0, 0, Math.PI*2);
      ctx.fill();
    } else if (m.type === 'brute') {
      ctx.fillRect(-14 * m.size, -12 * m.size, 28 * m.size, 28 * m.size);
    } else if (m.type === 'hunter') {
      ctx.beginPath();
      ctx.moveTo(0, -14 * m.size);
      ctx.lineTo(14 * m.size, 12 * m.size);
      ctx.lineTo(-14 * m.size, 12 * m.size);
      ctx.closePath();
      ctx.fill();
    } else {
      // grunt / horror
      ctx.beginPath();
      ctx.ellipse(0, 2, 12 * m.size, 14 * m.size, 0, 0, Math.PI*2);
      ctx.fill();
    }

    // eyes
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff';
    ctx.fillRect(-6 * m.size, -6 * m.size, 4 * m.size, 4 * m.size);
    ctx.fillRect(2 * m.size, -6 * m.size, 4 * m.size, 4 * m.size);
    ctx.fillStyle = '#000';
    ctx.fillRect(-5 * m.size, -5 * m.size, 2 * m.size, 2 * m.size);
    ctx.fillRect(3 * m.size, -5 * m.size, 2 * m.size, 2 * m.size);

    // HP bar
    if (m.maxHp > 1) {
      ctx.fillStyle = '#333';
      ctx.fillRect(-12, 16 * m.size, 24, 3);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-12, 16 * m.size, 24 * (m.hp / m.maxHp), 3);
    }

    ctx.restore();
  });

  // Player
  ctx.save();
  ctx.translate(player.x + player.w/2, player.y + player.h/2);
  if (player.invuln > 0 && Math.floor(player.invuln/3) % 2 === 0) ctx.globalAlpha = 0.35;

  // body
  ctx.fillStyle = '#c084fc';
  ctx.shadowColor = '#c084fc';
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.ellipse(0, 2, 12, 13, 0, 0, Math.PI*2);
  ctx.fill();

  // head
  ctx.fillStyle = '#e9d5ff';
  ctx.beginPath();
  ctx.arc(0, -11, 8, 0, Math.PI*2);
  ctx.fill();

  // gun arm
  ctx.strokeStyle = '#a78bfa';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(player.angle) * 18, Math.sin(player.angle) * 18);
  ctx.stroke();
  // muzzle
  ctx.fillStyle = '#f0abfc';
  ctx.beginPath();
  ctx.arc(Math.cos(player.angle)*20, Math.sin(player.angle)*20, 4, 0, Math.PI*2);
  ctx.fill();

  ctx.restore();
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;

  // Bullets — neon
  bullets.forEach(b => {
    ctx.shadowColor = '#00ffaa';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#00ffaa';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * 0.45, 0, Math.PI*2);
    ctx.fill();
  });
  ctx.shadowBlur = 0;

  // Particles
  particles.forEach(p => {
    ctx.globalAlpha = p.life / 22;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  // Aim line
  if (gameRunning) {
    ctx.strokeStyle = 'rgba(192,132,252,0.2)';
    ctx.setLineDash([3,5]);
    ctx.beginPath();
    ctx.moveTo(player.x + player.w/2, player.y + player.h/2);
    ctx.lineTo(mouse.x, mouse.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function updateHUD() {
  document.getElementById('score').textContent = score;
  document.getElementById('lives').textContent = lives;
  document.getElementById('wave').textContent = wave;
  document.getElementById('saved').textContent = saved;
  document.getElementById('lost').textContent = lost;
}

// ---------- Loop ----------
function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}
loop();
console.log('Spectral Robotron ready — Save the Ghost Circuit fans');
