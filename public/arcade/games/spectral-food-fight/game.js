// ============================================================
// SPECTRAL FOOD FIGHT
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

function spawnPickup(x, y) {
  const types = [
    { name: 'pie', color: '#fbbf24', points: 10 },
    { name: 'tomato', color: '#ef4444', points: 15 },
    { name: 'banana', color: '#facc15', points: 12 },
    { name: 'chicken', color: '#fb923c', points: 20 },
    { name: 'cake', color: '#f0abfc', points: 25 }
  ];
  const t = types[Math.floor(Math.random() * types.length)];
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
  foods.push({
    x: player.x + player.w/2,
    y: player.y + player.h/2,
    vx: (dx / dist) * speed,
    vy: (dy / dist) * speed,
    r: 7,
    life: 90,
    color: ['#fbbf24', '#ef4444', '#f0abfc', '#22d3ee'][Math.floor(Math.random()*4)]
  });
  player.throwCooldown = 12;
  sfx.throw();
  updateHUD();
}

// ---------- Update ----------
function update() {
  if (!gameRunning) return;

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
      foods.push({
        x: c.x + 15, y: c.y + 15,
        vx: (dx / dist) * speed,
        vy: (dy / dist) * speed,
        r: 6,
        life: 85,
        color: c.color,
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
          score += 100 + level * 20;
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
        sfx.hurt();
        createParticles(player.x + 14, player.y + 16, '#f472b6', 12);
        updateHUD();
        if (lives <= 0) {
          gameOver = true;
          gameRunning = false;
          document.getElementById('startOverlay').classList.remove('hidden');
          document.getElementById('startOverlay').innerHTML = `
            <h2>KITCHEN CLOSED</h2>
            <p>Final Score: ${score}</p>
            <p style="margin-top:0.8rem; opacity:0.8">Click or SPACE to fight again</p>
          `;
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
        sfx.hurt();
        createParticles(player.x + 14, player.y + 16, '#f472b6', 14);
        // knockback
        player.x += (player.x - c.x) * 0.4;
        player.y += (player.y - c.y) * 0.4;
        updateHUD();
        if (lives <= 0) {
          gameOver = true;
          gameRunning = false;
          document.getElementById('startOverlay').classList.remove('hidden');
          document.getElementById('startOverlay').innerHTML = `
            <h2>KITCHEN CLOSED</h2>
            <p>Final Score: ${score}</p>
            <p style="margin-top:0.8rem; opacity:0.8">Click or SPACE to fight again</p>
          `;
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

  // Level clear
  if (chefs.length === 0 && gameRunning) {
    level++;
    sfx.level();
    ammo = Math.min(30, ammo + 6);
    spawnLevel();
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

// ---------- Draw ----------
function draw() {
  // Background - manor cafeteria
  ctx.fillStyle = '#12091f';
  ctx.fillRect(0, 0, W, H);

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
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x + 8, p.y + 8 + by, 8, 0, Math.PI*2);
    ctx.fill();
    // highlight
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.arc(p.x + 5, p.y + 5 + by, 3, 0, Math.PI*2);
    ctx.fill();
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

  // Thrown food
  foods.forEach(f => {
    ctx.shadowColor = f.color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = f.color;
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(f.x - 2, f.y - 2, f.r*0.4, 0, Math.PI*2);
    ctx.fill();
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
}

function updateHUD() {
  document.getElementById('score').textContent = score;
  document.getElementById('lives').textContent = lives;
  document.getElementById('level').textContent = level;
  document.getElementById('ammo').textContent = ammo;
}

// ---------- Loop ----------
function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}
loop();
console.log('Spectral Food Fight ready — Ghost Circuit Cafeteria Chaos');
