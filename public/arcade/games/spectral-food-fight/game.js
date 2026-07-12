// ============================================================
// SPECTRAL MANOR MESS HALL
// Ghost Circuit themed Food Fight clone
// Throw food at spectral chefs in the haunted manor cafeteria
// ============================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

// ---------- Sound (simple Web Audio) ----------
let audioCtx = null;
function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}
function playTone(freq, dur, type='square', vol=0.07, slide=0) {
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
const sfx = {
  throw: () => playTone(600, 0.08, 'square', 0.05, -300),
  hit: () => { playTone(180, 0.12, 'sawtooth', 0.07, -80); },
  pickup: () => playTone(880, 0.06, 'triangle', 0.05),
  hurt: () => playTone(140, 0.15, 'sawtooth', 0.08, -60),
  level: () => { playTone(440,0.08); setTimeout(()=>playTone(554,0.08),70); setTimeout(()=>playTone(659,0.12),140); }
};

// ---------- State ----------
let score = 0, lives = 3, level = 1, ammo = 12;
let gameRunning = false, gameOver = false;
let keys = {};
let mouse = { x: W/2, y: H/2, down: false };

// ---------- Juice: high score, combo, shake, hit-pause, banner ----------
const BEST_KEY = 'spectralArcade.messhall.best';
function loadBest() { try { return parseInt(localStorage.getItem(BEST_KEY), 10) || 0; } catch (e) { return 0; } }
function saveBest() { try { localStorage.setItem(BEST_KEY, best); } catch (e) {} }
let best = loadBest();
let combo = 0, comboTimer = 0;      // kill streak; decays after 150 frames
let hitPause = 0;                   // frames to freeze the action on impact
let shakeTime = 0, shakeMag = 0;    // screen shake
let waveDelay = 0;                  // breather frames before next level spawns
let bannerText = '', bannerTime = 0;
function triggerShake(mag, time) { shakeMag = mag; shakeTime = time; }
function comboMult() { return Math.min(1 + Math.floor(combo / 5), 5); }

// ---------- Player ----------
const player = {
  x: W/2, y: H/2,
  w: 28, h: 32,
  speed: 4.2,
  vx: 0, vy: 0,
  angle: 0,
  invuln: 0,
  throwCooldown: 0
};

// ---------- Entities ----------
let foods = [];      // thrown projectiles
let pickups = [];    // food on ground
let chefs = [];      // enemies
let particles = [];
let tables = [];     // obstacles

// ---------- Input ----------
window.addEventListener('keydown', e => {
  initAudio();
  keys[e.code] = true;
  if (e.code === 'Space') e.preventDefault();
  if ((e.code === 'Space') && !gameRunning) startGame();
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
  if (!gameRunning) startGame();
});

// ---------- Core ----------
function startGame() {
  score = 0; lives = 3; level = 1; ammo = 12;
  foods = []; pickups = []; chefs = []; particles = [];
  combo = 0; comboTimer = 0; hitPause = 0; shakeTime = 0; waveDelay = 0;
  bannerText = 'LEVEL 1'; bannerTime = 90;
  player.x = 80; player.y = H/2;          // start clear of tables
  player.invuln = 0; player.throwCooldown = 0;
  gameRunning = true; gameOver = false;
  document.getElementById('startOverlay').classList.add('hidden');
  spawnTables();
  spawnLevel();
  updateHUD();
}

function spawnTables() {
  tables = [
    { x: 180, y: 140, w: 110, h: 50 },
    { x: 670, y: 140, w: 110, h: 50 },
    { x: 180, y: 340, w: 110, h: 50 },
    { x: 670, y: 340, w: 110, h: 50 },
    { x: 425, y: 240, w: 110, h: 50 }
  ];
}

function spawnLevel() {
  chefs = [];
  pickups = [];

  // Monster roster for the haunted cafeteria
  const monsterTypes = [
    { type: 'vampire',   color: '#9f1239', speed: 1.6, hp: 1, label: 'Vamp' },
    { type: 'werewolf',  color: '#78716c', speed: 2.1, hp: 2, label: 'Wolf' },
    { type: 'frank',     color: '#4ade80', speed: 0.9, hp: 3, label: 'Frank' },
    { type: 'ghost',     color: '#c4b5fd', speed: 1.4, hp: 1, label: 'Ghost' },
    { type: 'witch',     color: '#7c3aed', speed: 1.3, hp: 2, label: 'Witch' }
  ];

  const count = 4 + level * 2;
  for (let i = 0; i < count; i++) {
    const m = monsterTypes[Math.floor(Math.random() * monsterTypes.length)];
    chefs.push({
      x: 100 + Math.random() * (W - 200),
      y: 70 + Math.random() * (H - 160),
      w: 30, h: 34,
      speed: m.speed + level * 0.12,
      hp: m.hp + Math.floor(level / 4),
      maxHp: m.hp + Math.floor(level / 4),
      angle: 0,
      throwTimer: 40 + Math.random() * 80,
      type: m.type,
      color: m.color,
      label: m.label,
      target: null,          // who they are currently chasing (player or another monster)
      aggression: 0.35 + Math.random() * 0.4   // chance they prefer fighting other monsters
    });
  }

  // Ground food pickups
  for (let i = 0; i < 12 + level * 2; i++) {
    spawnPickup(100 + Math.random() * (W-200), 80 + Math.random() * (H-160));
  }
}

// Shared food roster — pickups and projectiles all use these
const FOOD_TYPES = [
  { name: 'pie',     color: '#fbbf24', points: 10 },
  { name: 'tomato',  color: '#ef4444', points: 15 },
  { name: 'banana',  color: '#facc15', points: 12 },
  { name: 'chicken', color: '#fb923c', points: 20 },
  { name: 'cake',    color: '#f0abfc', points: 25 },
  { name: 'burger',  color: '#f59e0b', points: 18 }
];
function randomFood() { return FOOD_TYPES[Math.floor(Math.random() * FOOD_TYPES.length)]; }

function spawnPickup(x, y) {
  const t = randomFood();
  pickups.push({
    x, y, w: 16, h: 16,
    type: t.name,
    color: t.color,
    points: t.points,
    bob: Math.random() * Math.PI * 2
  });
}

function throwFood() {
  if (player.throwCooldown > 0 || ammo <= 0) return;
  ammo--;
  const dx = mouse.x - (player.x + player.w/2);
  const dy = mouse.y - (player.y + player.h/2);
  const dist = Math.sqrt(dx*dx + dy*dy) || 1;
  const speed = 9;
  const t = randomFood();
  foods.push({
    x: player.x + player.w/2,
    y: player.y + player.h/2,
    vx: (dx / dist) * speed,
    vy: (dy / dist) * speed,
    r: 7,
    life: 90,
    type: t.name,
    color: t.color,
    rot: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.5
  });
  player.throwCooldown = 12;
  sfx.throw();
  updateHUD();
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
    if (waveDelay === 0) spawnLevel();
  }

  // Player movement
  player.vx = 0; player.vy = 0;
  if (keys['ArrowLeft'] || keys['KeyA']) player.vx = -player.speed;
  if (keys['ArrowRight'] || keys['KeyD']) player.vx = player.speed;
  if (keys['ArrowUp'] || keys['KeyW']) player.vy = -player.speed;
  if (keys['ArrowDown'] || keys['KeyS']) player.vy = player.speed;

  // Normalize diagonal
  if (player.vx && player.vy) {
    player.vx *= 0.707;
    player.vy *= 0.707;
  }

  let nx = player.x + player.vx;
  let ny = player.y + player.vy;

  // Bounds
  nx = Math.max(10, Math.min(W - player.w - 10, nx));
  ny = Math.max(40, Math.min(H - player.h - 10, ny));

  // Table collision with sliding (try X and Y separately)
  let canX = true, canY = true;
  for (const t of tables) {
    if (nx < t.x + t.w && nx + player.w > t.x &&
        player.y < t.y + t.h && player.y + player.h > t.y) {
      canX = false;
    }
    if (player.x < t.x + t.w && player.x + player.w > t.x &&
        ny < t.y + t.h && ny + player.h > t.y) {
      canY = false;
    }
  }
  if (canX) player.x = nx;
  if (canY) player.y = ny;

  // Aim angle
  player.angle = Math.atan2(mouse.y - (player.y + player.h/2), mouse.x - (player.x + player.w/2));

  // Throw
  if ((mouse.down || keys['Space']) && player.throwCooldown <= 0) throwFood();
  if (player.throwCooldown > 0) player.throwCooldown--;
  if (player.invuln > 0) player.invuln--;

  // Foods (projectiles)
  foods.forEach(f => {
    f.x += f.vx;
    f.y += f.vy;
    f.rot = (f.rot || 0) + (f.rotSpeed || 0);   // tumble in flight
    f.life--;
    // bounce off tables lightly
    for (const t of tables) {
      if (f.x > t.x && f.x < t.x + t.w && f.y > t.y && f.y < t.y + t.h) {
        f.vx *= -0.6; f.vy *= -0.6;
      }
    }
  });
  foods = foods.filter(f => f.life > 0 && f.x > -20 && f.x < W+20 && f.y > -20 && f.y < H+20);

  // Monster AI — they fight the player AND each other
  chefs.forEach((c, ci) => {
    // Decide target: sometimes other monsters, sometimes the player
    let targetX = player.x, targetY = player.y;
    let targetingMonster = false;

    if (Math.random() < c.aggression || c.target) {
      // Prefer fighting another monster
      let best = null, bestDist = 9999;
      chefs.forEach((other, oi) => {
        if (oi === ci) return;
        const dx = other.x - c.x, dy = other.y - c.y;
        const d = Math.sqrt(dx*dx + dy*dy);
        if (d < bestDist) { bestDist = d; best = other; }
      });
      if (best && bestDist < 350) {
        targetX = best.x; targetY = best.y;
        targetingMonster = true;
        c.target = best;
      } else {
        c.target = null;
      }
    }

    const dx = targetX - c.x;
    const dy = targetY - c.y;
    const dist = Math.sqrt(dx*dx + dy*dy) || 1;

    // Move toward target
    c.x += (dx / dist) * c.speed;
    c.y += (dy / dist) * c.speed;
    c.angle = Math.atan2(dy, dx);

    // Bounds
    c.x = Math.max(20, Math.min(W - 50, c.x));
    c.y = Math.max(50, Math.min(H - 50, c.y));

    // Throw food at current target
    c.throwTimer--;
    if (c.throwTimer <= 0 && dist < 340) {
      const speed = 5.2 + Math.random();
      const ft = randomFood();
      foods.push({
        x: c.x + 15, y: c.y + 15,
        vx: (dx / dist) * speed,
        vy: (dy / dist) * speed,
        r: 6,
        life: 85,
        type: ft.name,
        color: c.color,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.5,
        fromChef: true,
        owner: c          // so we know who threw it
      });
      c.throwTimer = 55 + Math.random() * 70 - level * 2;
    }
  });

  // Monsters can hit each other with food
  foods.forEach((f, fi) => {
    if (!f.fromChef || !f.owner) return;
    chefs.forEach((c, ci) => {
      if (c === f.owner) return;
      if (f.x > c.x && f.x < c.x + c.w && f.y > c.y && f.y < c.y + c.h) {
        c.hp--;
        createParticles(c.x + 15, c.y + 15, c.color, 6);
        foods.splice(fi, 1);
        if (c.hp <= 0) {
          score += 60; // bonus for monster-on-monster kills
          createParticles(c.x + 15, c.y + 15, c.color, 14);
          spawnPickup(c.x, c.y);
          chefs.splice(ci, 1);
          updateHUD();
        }
      }
    });
  });

  // Food vs Chefs
  foods.forEach((f, fi) => {
    if (f.fromChef) return;
    chefs.forEach((c, ci) => {
      if (f.x > c.x && f.x < c.x + c.w && f.y > c.y && f.y < c.y + c.h) {
        c.hp--;
        createParticles(c.x + 15, c.y + 15, c.color, 8);
        foods.splice(fi, 1);
        sfx.hit();
        if (c.hp <= 0) {
          combo++;
          comboTimer = 150;
          score += (100 + level * 20) * comboMult();
          hitPause = 2;
          triggerShake(3, 8);
          createParticles(c.x + 15, c.y + 15, c.color, 18);
          // drop food
          spawnPickup(c.x, c.y);
          chefs.splice(ci, 1);
          updateHUD();
        }
      }
    });
  });

  // Chef food vs Player
  if (player.invuln <= 0) {
    foods.forEach((f, fi) => {
      if (!f.fromChef) return;
      if (f.x > player.x && f.x < player.x + player.w &&
          f.y > player.y && f.y < player.y + player.h) {
        foods.splice(fi, 1);
        lives--;
        player.invuln = 60;
        combo = 0; comboTimer = 0;
        hitPause = 5;
        triggerShake(9, 18);
        sfx.hurt();
        createParticles(player.x + 14, player.y + 16, '#f472b6', 12);
        updateHUD();
        if (lives <= 0) {
          gameOver = true;
          gameRunning = false;
          const newBest = score > best;
          if (newBest) { best = score; saveBest(); }
          document.getElementById('startOverlay').classList.remove('hidden');
          document.getElementById('startOverlay').innerHTML = `
            <h2>KITCHEN CLOSED</h2>
            <p>Final Score: ${score}</p>
            <p style="margin-top:0.3rem">Best: ${best}${newBest ? ' &nbsp;<span style="color:#f0abfc; font-weight:bold">NEW BEST!</span>' : ''}</p>
            <p style="margin-top:0.8rem; opacity:0.8">Click or SPACE to fight again</p>
          `;
          updateHUD();
        }
      }
    });
  }

  // Player vs Chefs (body)
  if (player.invuln <= 0) {
    chefs.forEach(c => {
      if (player.x < c.x + c.w && player.x + player.w > c.x &&
          player.y < c.y + c.h && player.y + player.h > c.y) {
        lives--;
        player.invuln = 70;
        combo = 0; comboTimer = 0;
        hitPause = 5;
        triggerShake(9, 18);
        sfx.hurt();
        createParticles(player.x + 14, player.y + 16, '#f472b6', 14);
        // knockback
        player.x += (player.x - c.x) * 0.4;
        player.y += (player.y - c.y) * 0.4;
        updateHUD();
        if (lives <= 0) {
          gameOver = true;
          gameRunning = false;
          const newBest = score > best;
          if (newBest) { best = score; saveBest(); }
          document.getElementById('startOverlay').classList.remove('hidden');
          document.getElementById('startOverlay').innerHTML = `
            <h2>KITCHEN CLOSED</h2>
            <p>Final Score: ${score}</p>
            <p style="margin-top:0.3rem">Best: ${best}${newBest ? ' &nbsp;<span style="color:#f0abfc; font-weight:bold">NEW BEST!</span>' : ''}</p>
            <p style="margin-top:0.8rem; opacity:0.8">Click or SPACE to fight again</p>
          `;
          updateHUD();
        }
      }
    });
  }

  // Pickups
  pickups.forEach((p, pi) => {
    p.bob += 0.07;
    if (player.x < p.x + p.w && player.x + player.w > p.x &&
        player.y < p.y + p.h && player.y + player.h > p.y) {
      ammo = Math.min(30, ammo + 3);
      score += p.points;
      sfx.pickup();
      createParticles(p.x + 8, p.y + 8, p.color, 6);
      pickups.splice(pi, 1);
      updateHUD();
    }
  });

  // Level clear — breather: banner shows for a beat before the next level spawns
  if (chefs.length === 0 && gameRunning && waveDelay === 0) {
    level++;
    sfx.level();
    ammo = Math.min(30, ammo + 6);
    bannerText = 'LEVEL ' + level;
    bannerTime = 90;
    waveDelay = 75;
    updateHUD();
  }

  // Particles
  particles.forEach(p => {
    p.x += p.vx; p.y += p.vy; p.life--;
  });
  particles = particles.filter(p => p.life > 0);
}

function createParticles(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x, y,
      vx: (Math.random()-0.5)*7,
      vy: (Math.random()-0.5)*7,
      life: 18 + Math.random()*15,
      color,
      size: 2 + Math.random()*3
    });
  }
}

// ---------- Food shapes (shared by pickups & projectiles) ----------
// Draws the given food centred on the origin at scale s (roughly a radius).
// Caller is responsible for ctx.save()/translate/rotate/restore.
function drawFoodShape(type, s) {
  switch (type) {
    case 'pie':
      // tin
      ctx.fillStyle = '#b45309';
      ctx.beginPath(); ctx.ellipse(0, s * 0.3, s, s * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      // filling
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath(); ctx.ellipse(0, 0, s * 0.85, s * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      // cream dollop
      ctx.fillStyle = '#fef3c7';
      ctx.beginPath(); ctx.ellipse(0, -s * 0.2, s * 0.4, s * 0.25, 0, 0, Math.PI * 2); ctx.fill();
      break;
    case 'tomato':
      ctx.fillStyle = '#ef4444';
      ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.fill();
      // shine
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.arc(-s * 0.35, -s * 0.35, s * 0.28, 0, Math.PI * 2); ctx.fill();
      // leafy stem
      ctx.fillStyle = '#16a34a';
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * s * 0.22, -s * 0.75, s * 0.28, s * 0.11, a, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case 'banana':
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = s * 0.55;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, -s * 0.25, s * 0.85, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      ctx.lineCap = 'butt';
      // brown tips
      ctx.fillStyle = '#854d0e';
      ctx.beginPath();
      ctx.arc(Math.cos(Math.PI * 0.15) * s * 0.85, -s * 0.25 + Math.sin(Math.PI * 0.15) * s * 0.85, s * 0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(Math.cos(Math.PI * 0.85) * s * 0.85, -s * 0.25 + Math.sin(Math.PI * 0.85) * s * 0.85, s * 0.15, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'chicken':
      // drumstick meat
      ctx.fillStyle = '#c2703d';
      ctx.beginPath(); ctx.ellipse(-s * 0.25, -s * 0.15, s * 0.72, s * 0.55, -0.5, 0, Math.PI * 2); ctx.fill();
      // roast highlight
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.beginPath(); ctx.ellipse(-s * 0.42, -s * 0.32, s * 0.26, s * 0.15, -0.5, 0, Math.PI * 2); ctx.fill();
      // bone
      ctx.strokeStyle = '#fef3c7';
      ctx.lineWidth = s * 0.2;
      ctx.beginPath(); ctx.moveTo(s * 0.2, s * 0.2); ctx.lineTo(s * 0.6, s * 0.55); ctx.stroke();
      ctx.fillStyle = '#fef3c7';
      ctx.beginPath(); ctx.arc(s * 0.75, s * 0.45, s * 0.17, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(s * 0.6, s * 0.72, s * 0.17, 0, Math.PI * 2); ctx.fill();
      break;
    case 'cake':
      // slice with layers + cherry
      ctx.fillStyle = '#f9a8d4';
      ctx.beginPath();
      ctx.moveTo(-s * 0.9, s * 0.6);
      ctx.lineTo(s * 0.9, s * 0.6);
      ctx.lineTo(0, -s * 0.65);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fdf2f8';
      ctx.fillRect(-s * 0.55, s * 0.05, s * 1.1, s * 0.17);
      ctx.fillStyle = '#dc2626';
      ctx.beginPath(); ctx.arc(0, -s * 0.78, s * 0.2, 0, Math.PI * 2); ctx.fill();
      break;
    case 'burger':
    default:
      // bottom bun
      ctx.fillStyle = '#d97706';
      ctx.beginPath(); ctx.ellipse(0, s * 0.42, s * 0.85, s * 0.28, 0, 0, Math.PI * 2); ctx.fill();
      // patty
      ctx.fillStyle = '#7c2d12';
      ctx.fillRect(-s * 0.8, s * 0.02, s * 1.6, s * 0.26);
      // lettuce
      ctx.fillStyle = '#4ade80';
      ctx.fillRect(-s * 0.85, -s * 0.12, s * 1.7, s * 0.15);
      // top bun dome
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath(); ctx.ellipse(0, -s * 0.1, s * 0.85, s * 0.55, 0, Math.PI, 0); ctx.fill();
      // sesame seeds
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(-s * 0.32, -s * 0.4, s * 0.12, s * 0.07);
      ctx.fillRect(s * 0.14, -s * 0.32, s * 0.12, s * 0.07);
      break;
  }
}

// ---------- Draw ----------
function draw() {
  // Screen shake — offset the whole world while shaking
  ctx.save();
  if (shakeTime > 0) {
    ctx.translate((Math.random() - 0.5) * shakeMag, (Math.random() - 0.5) * shakeMag);
  }

  // Background - manor cafeteria (oversized so shake never reveals the edge)
  ctx.fillStyle = '#12091f';
  ctx.fillRect(-12, -12, W + 24, H + 24);

  // Floor tiles
  ctx.strokeStyle = 'rgba(124, 58, 237, 0.12)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // Walls / trim
  ctx.fillStyle = '#1e1b4b';
  ctx.fillRect(0, 0, W, 28);
  ctx.fillRect(0, H-18, W, 18);
  ctx.fillStyle = '#7c3aed';
  ctx.fillRect(0, 26, W, 3);
  ctx.fillRect(0, H-20, W, 3);

  // Tables
  tables.forEach(t => {
    // table top
    ctx.fillStyle = '#2e1065';
    ctx.fillRect(t.x, t.y, t.w, t.h);
    // edge
    ctx.fillStyle = '#5b21b6';
    ctx.fillRect(t.x, t.y + t.h - 6, t.w, 6);
    // legs
    ctx.fillStyle = '#1e1b4b';
    ctx.fillRect(t.x + 8, t.y + t.h, 8, 12);
    ctx.fillRect(t.x + t.w - 16, t.y + t.h, 8, 12);
  });

  // Pickups (food on ground)
  pickups.forEach(p => {
    const by = Math.sin(p.bob) * 3;
    ctx.save();
    ctx.translate(p.x + 8, p.y + 8 + by);
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 10;
    drawFoodShape(p.type, 8);
    ctx.restore();
  });
  ctx.shadowBlur = 0;

  // Monsters (vampire, werewolf, frank, ghost, witch)
  chefs.forEach(c => {
    ctx.save();
    ctx.translate(c.x + 15, c.y + 17);

    if (c.type === 'ghost') {
      // Floating ghost
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = c.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 18, 0, 0, Math.PI*2);
      ctx.fill();
      // wavy bottom
      ctx.beginPath();
      ctx.moveTo(-14, 8);
      ctx.quadraticCurveTo(-7, 18, 0, 10);
      ctx.quadraticCurveTo(7, 18, 14, 8);
      ctx.fill();
      ctx.fillStyle = '#0f0a1a';
      ctx.beginPath(); ctx.arc(-5, -4, 3, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(5, -4, 3, 0, Math.PI*2); ctx.fill();
    } else if (c.type === 'vampire') {
      // Vampire - cape + fangs
      ctx.fillStyle = '#1e1b4b';
      ctx.beginPath();
      ctx.moveTo(-16, -5); ctx.lineTo(0, 20); ctx.lineTo(16, -5);
      ctx.fill(); // cape
      ctx.fillStyle = c.color;
      ctx.fillRect(-10, -6, 20, 24);
      ctx.fillStyle = '#fce7f3';
      ctx.beginPath(); ctx.arc(0, -12, 9, 0, Math.PI*2); ctx.fill();
      // fangs
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.moveTo(-4, -6); ctx.lineTo(-2, 0); ctx.lineTo(0, -6); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(2, 0); ctx.lineTo(4, -6); ctx.fill();
      // red eyes
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-5, -14, 3, 3); ctx.fillRect(2, -14, 3, 3);
    } else if (c.type === 'werewolf') {
      // Werewolf - hunched, ears
      ctx.fillStyle = c.color;
      ctx.fillRect(-13, -4, 26, 26);
      // head
      ctx.beginPath(); ctx.ellipse(0, -12, 11, 10, 0, 0, Math.PI*2); ctx.fill();
      // ears
      ctx.beginPath(); ctx.moveTo(-9, -18); ctx.lineTo(-5, -28); ctx.lineTo(-1, -18); ctx.fill();
      ctx.beginPath(); ctx.moveTo(9, -18); ctx.lineTo(5, -28); ctx.lineTo(1, -18); ctx.fill();
      // glowing eyes
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(-5, -14, 4, 3); ctx.fillRect(2, -14, 4, 3);
      // snout
      ctx.fillStyle = '#57534e';
      ctx.fillRect(-3, -8, 6, 5);
    } else if (c.type === 'frank') {
      // Frankenstein - blocky, bolts
      ctx.fillStyle = c.color;
      ctx.fillRect(-13, -6, 26, 28);
      ctx.fillStyle = '#86efac';
      ctx.fillRect(-11, -18, 22, 14); // head
      // flat head top
      ctx.fillStyle = '#166534';
      ctx.fillRect(-12, -20, 24, 4);
      // bolts
      ctx.fillStyle = '#a1a1aa';
      ctx.fillRect(-17, -10, 5, 6);
      ctx.fillRect(12, -10, 5, 6);
      // scars / eyes
      ctx.fillStyle = '#0f0a1a';
      ctx.fillRect(-6, -12, 4, 4); ctx.fillRect(3, -12, 4, 4);
      ctx.strokeStyle = '#14532d';
      ctx.beginPath(); ctx.moveTo(-4, -4); ctx.lineTo(5, -2); ctx.stroke();
    } else if (c.type === 'witch') {
      // Witch - pointed hat
      ctx.fillStyle = c.color;
      ctx.fillRect(-11, -4, 22, 26);
      // hat
      ctx.fillStyle = '#4c1d95';
      ctx.beginPath();
      ctx.moveTo(0, -32); ctx.lineTo(-14, -10); ctx.lineTo(14, -10);
      ctx.fill();
      ctx.fillRect(-16, -12, 32, 5); // brim
      // face
      ctx.fillStyle = '#e9d5ff';
      ctx.beginPath(); ctx.arc(0, -6, 8, 0, Math.PI*2); ctx.fill();
      // green eyes
      ctx.fillStyle = '#4ade80';
      ctx.fillRect(-5, -8, 3, 3); ctx.fillRect(2, -8, 3, 3);
    }

    // HP bar for tougher monsters
    if (c.maxHp > 1) {
      ctx.fillStyle = '#333';
      ctx.fillRect(-12, 20, 24, 4);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-12, 20, 24 * (c.hp / c.maxHp), 4);
    }

    ctx.restore();
  });

  // Player
  ctx.save();
  ctx.translate(player.x + player.w/2, player.y + player.h/2);
  if (player.invuln > 0 && Math.floor(player.invuln / 4) % 2 === 0) {
    ctx.globalAlpha = 0.4;
  }
  // body
  ctx.fillStyle = '#c084fc';
  ctx.beginPath();
  ctx.ellipse(0, 4, 13, 15, 0, 0, Math.PI*2);
  ctx.fill();
  // head
  ctx.fillStyle = '#e9d5ff';
  ctx.beginPath();
  ctx.arc(0, -10, 10, 0, Math.PI*2);
  ctx.fill();
  // arm aiming
  ctx.strokeStyle = '#c084fc';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(player.angle)*18, Math.sin(player.angle)*18);
  ctx.stroke();
  // hand
  ctx.fillStyle = '#f0abfc';
  ctx.beginPath();
  ctx.arc(Math.cos(player.angle)*20, Math.sin(player.angle)*20, 5, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;

  // Thrown food — real food shapes, tumbling; hostile food glows red
  foods.forEach(f => {
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rot || 0);
    ctx.shadowColor = f.fromChef ? '#f87171' : f.color;
    ctx.shadowBlur = 12;
    drawFoodShape(f.type, f.r + 2);
    ctx.restore();
  });
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

  // Aim line
  if (gameRunning && ammo > 0) {
    ctx.strokeStyle = 'rgba(192, 132, 252, 0.25)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(player.x + player.w/2, player.y + player.h/2);
    ctx.lineTo(mouse.x, mouse.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore(); // end screen shake — overlays below stay steady

  // Level banner
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
    ctx.fillText('COMBO ×' + comboMult(), W/2, 48);
    ctx.restore();
  }
}

function updateHUD() {
  document.getElementById('score').textContent = score;
  document.getElementById('lives').textContent = lives;
  document.getElementById('level').textContent = level;
  document.getElementById('ammo').textContent = ammo;
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
console.log('Spectral Manor Mess Hall ready — Ghost Circuit Cafeteria Chaos');
