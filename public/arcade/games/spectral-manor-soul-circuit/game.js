// ============================================================
// SPECTRAL MANOR SOUL CIRCUIT
// Pac-Man style · Hedge maze · Crystals · Magic Field
// Ghost Circuit / Plumbmonkey Media
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
function tone(freq, dur, type='square', vol=0.05, slide=0) {
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
  collect: () => tone(880, 0.06, 'sine', 0.04),
  power:   () => { tone(440,0.08); setTimeout(()=>tone(660,0.08),60); setTimeout(()=>tone(880,0.12),120); },
  respawn: () => { tone(220,0.1,'sawtooth',0.05); setTimeout(()=>tone(330,0.1,'sawtooth',0.04),80); },
  hurt:    () => tone(120, 0.2, 'sawtooth', 0.06, -40),
  // soul dissolve — long falling wail
  dissolve:() => { tone(600, 0.5, 'sine', 0.06, -450); tone(900, 0.4, 'triangle', 0.04, -700); setTimeout(()=>tone(300,0.45,'sine',0.05,-220),150); },
  pickup:  () => { tone(700,0.06,'square',0.05); setTimeout(()=>tone(1050,0.09,'square',0.05),60); },
  freeze:  () => { tone(1200,0.12,'sine',0.05,-500); setTimeout(()=>tone(800,0.15,'sine',0.04,-400),90); },
  life:    () => { [523,659,784,1047].forEach((f,i)=>setTimeout(()=>tone(f,0.09,'triangle',0.06),i*70)); },
  win:     () => { tone(523,0.08); setTimeout(()=>tone(659,0.08),80); setTimeout(()=>tone(784,0.15),160); }
};

// ---------- Maze (1 = hedge wall, 0 = path, 2 = small crystal, 3 = power crystal) ----------
// 40 cols × 22 rows  (each cell 24×24 → 960×528)
const COLS = 40, ROWS = 22, CELL = 24;
const mazeTemplate = [
  "1111111111111111111111111111111111111111",
  "1000000000110000000000000011000000000001",
  "1011111100110111111111110110011111110101",
  "1010000100000100000000010000010000010101",
  "1010110101110101111111010111010110110101",
  "1000110000010001000000010001000011000001",
  "1110110111011101011111010111011101101111",
  "1000000100000001000000010000000100000001",
  "1011110101111111011111011111110101111101",
  "1000000000000000000000000000000000000001",
  "1011111111011111101101111110111111110101",
  "1000000000010000001100000010000000000001",
  "1111011111010111101101111010111110111111",
  "1000010000000100000000000100000010000001",
  "1011010111110101111111010111110101101101",
  "1000010000010001000000010001000001000001",
  "1011111100011101011111010111010001111101",
  "1000000100000001000000010000000100000001",
  "1011110101111111011111011111110101111101",
  "1000000000110000000000000011000000000001",
  "1011111111110111111111110111111111110101",
  "1111111111111111111111111111111111111111"
];

let maze = [];
let score = 0, lives = 3, level = 1, crystalsLeft = 0;
let gameRunning = false, gameOver = false;
let magicField = 0; // frames remaining
let keys = {};

// Death sequence + extra power-ups
let dying = 0;            // frames left in the soul-dissolve animation
let awaitingReady = false;// paused on the "READY?" prompt after a death
let particles = [];       // dissolve wisps
let pickups = [];         // maze power-ups: speed / freeze / life
let pickupTimer = 600;    // frames until the next pickup can appear
let speedBoost = 0;       // frames of extra speed
let freezeTime = 0;       // frames monsters stay frozen

function spawnPickup() {
  // find a random open corridor cell
  for (let tries = 0; tries < 60; tries++) {
    const c = 1 + Math.floor(Math.random() * (COLS - 2));
    const r = 1 + Math.floor(Math.random() * (ROWS - 2));
    if (maze[r][c] === 0 || maze[r][c] === 2) {
      const roll = Math.random();
      const type = roll < 0.12 ? 'life' : (roll < 0.55 ? 'speed' : 'freeze');
      pickups.push({
        c, r,
        x: c * CELL + CELL / 2, y: r * CELL + CELL / 2,
        type, life: 720, bob: Math.random() * Math.PI * 2
      });
      return;
    }
  }
}

function startDeath() {
  if (dying > 0) return; // one death at a time
  lives--;
  dying = 75;
  magicField = 0;
  sfx.dissolve();
  // soul wisps drift up and away
  for (let i = 0; i < 26; i++) {
    particles.push({
      x: player.x, y: player.y,
      vx: (Math.random() - 0.5) * 2.5,
      vy: -0.5 - Math.random() * 2.2,
      life: 40 + Math.random() * 40,
      size: 2 + Math.random() * 4,
      color: Math.random() < 0.5 ? '#c084fc' : '#e9d5ff'
    });
  }
  updateHUD();
}

function resumeAfterDeath() {
  awaitingReady = false;
  player.x = PLAYER_START.x; player.y = PLAYER_START.y;
  player.dir = {x:0,y:0}; player.nextDir = {x:0,y:0};
  spawnMonsters();
  speedBoost = 0; freezeTime = 0;
  sfx.respawn();
  document.getElementById('startOverlay').classList.add('hidden');
}

// Player — starts mid-maze in the open corridor (row 9 is fully open),
// far from all four monster home corners
const PLAYER_START = { x: 10.5 * CELL, y: 9.5 * CELL }; // open corridor, away from power crystals & monster corners
const player = {
  x: PLAYER_START.x, y: PLAYER_START.y,
  r: 9, speed: 2.4,
  dir: {x:0,y:0}, nextDir: {x:0,y:0}
};

// Monsters
const monsterDefs = [
  { name: 'Vampire',    color: '#ef4444', speed: 1.9, home: {c:38, r:1} },
  { name: 'Frank',      color: '#4ade80', speed: 1.3, home: {c:1,  r:20} },
  { name: 'Werewolf',   color: '#a8a29e', speed: 1.7, home: {c:38, r:20} },
  { name: 'Witch',      color: '#a855f7', speed: 1.6, home: {c:1,  r:1} }
];
let monsters = [];

// ---------- Helpers ----------
function cellAt(x, y) {
  const c = Math.floor(x / CELL);
  const r = Math.floor(y / CELL);
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return 1;
  return maze[r][c];
}
function isWall(x, y) {
  return cellAt(x, y) === 1;
}
function canMove(x, y, r = 8) {
  return !isWall(x - r, y - r) && !isWall(x + r, y - r) &&
         !isWall(x - r, y + r) && !isWall(x + r, y + r);
}

// ---------- Init / Level ----------
function buildMaze() {
  maze = mazeTemplate.map(row => row.split('').map(ch => parseInt(ch)));
  // place crystals
  crystalsLeft = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (maze[r][c] === 0) {
        // power crystals in open areas
        if ((r === 9 && c === 20) || (r === 9 && c === 19) ||
            (r === 3 && c === 3) || (r === 18 && c === 36)) {
          maze[r][c] = 3;
        } else if (Math.random() < 0.55) {
          maze[r][c] = 2;
          crystalsLeft++;
        }
      }
    }
  }
  // count power as well
  crystalsLeft += 4;
}

function spawnMonsters() {
  monsters = monsterDefs.map(d => ({
    ...d,
    x: d.home.c * CELL + CELL/2,
    y: d.home.r * CELL + CELL/2,
    dir: {x:0, y:0},
    scatter: 0
  }));
}

function startGame() {
  score = 0; lives = 3; level = 1; magicField = 0;
  dying = 0; awaitingReady = false;
  particles = []; pickups = []; pickupTimer = 600;
  speedBoost = 0; freezeTime = 0;
  buildMaze();
  player.x = PLAYER_START.x; player.y = PLAYER_START.y;
  player.dir = {x:0,y:0}; player.nextDir = {x:0,y:0};
  spawnMonsters();
  gameRunning = true; gameOver = false;
  document.getElementById('startOverlay').classList.add('hidden');
  updateHUD();
}

function nextLevel() {
  level++;
  buildMaze();
  player.x = PLAYER_START.x; player.y = PLAYER_START.y;
  player.dir = {x:0,y:0}; player.nextDir = {x:0,y:0};
  spawnMonsters();
  magicField = 0;
  sfx.win();
  updateHUD();
}

// ---------- Input ----------
window.addEventListener('keydown', e => {
  initAudio();
  keys[e.code] = true;
  if (e.code === 'Space') e.preventDefault();
  if (e.code === 'Space' || e.code === 'Enter') {
    if (awaitingReady) resumeAfterDeath();
    else if (!gameRunning) startGame();
  }
});
window.addEventListener('keyup', e => keys[e.code] = false);
document.getElementById('startOverlay').addEventListener('click', () => {
  initAudio();
  if (awaitingReady) resumeAfterDeath();
  else if (!gameRunning) startGame();
});

// ---------- Update ----------
function update() {
  // Dissolve wisps drift even while paused on READY? / game over
  particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy -= 0.02; p.life--; });
  particles = particles.filter(p => p.life > 0);

  if (!gameRunning || awaitingReady) return;

  // Soul dissolve in progress — world holds its breath
  if (dying > 0) {
    dying--;
    if (dying === 0) {
      if (lives <= 0) {
        gameOver = true;
        gameRunning = false;
        document.getElementById('startOverlay').classList.remove('hidden');
        document.getElementById('startOverlay').innerHTML = `
          <h2>SOUL LOST</h2>
          <p>Final Score: ${score}</p>
          <p style="margin-top:0.8rem; opacity:0.8">Click or SPACE to try again</p>
        `;
      } else {
        awaitingReady = true;
        document.getElementById('startOverlay').classList.remove('hidden');
        document.getElementById('startOverlay').innerHTML = `
          <h2>READY?</h2>
          <p>${lives} ${lives === 1 ? 'soul remains' : 'souls remain'}</p>
          <p style="margin-top:0.8rem; opacity:0.8">Click or SPACE when you're ready</p>
        `;
      }
    }
    return;
  }

  // Power-up spawning (keep up to 2 in the maze)
  pickupTimer--;
  if (pickupTimer <= 0 && pickups.length < 2) {
    spawnPickup();
    pickupTimer = 500 + Math.random() * 400;
  }
  pickups.forEach((p, pi) => {
    p.bob += 0.08;
    p.life--;
    if (p.life <= 0) { pickups.splice(pi, 1); return; }
    if (Math.hypot(p.x - player.x, p.y - player.y) < 16) {
      pickups.splice(pi, 1);
      if (p.type === 'speed') { speedBoost = 420; sfx.pickup(); }
      else if (p.type === 'freeze') { freezeTime = 300; sfx.freeze(); }
      else { lives++; sfx.life(); }
      score += 25;
      updateHUD();
    }
  });
  if (speedBoost > 0) speedBoost--;
  if (freezeTime > 0) freezeTime--;
  player.speed = speedBoost > 0 ? 3.4 : 2.4;

  // Desired direction
  if (keys['ArrowLeft'] || keys['KeyA']) player.nextDir = {x:-1, y:0};
  if (keys['ArrowRight']|| keys['KeyD']) player.nextDir = {x:1,  y:0};
  if (keys['ArrowUp']   || keys['KeyW']) player.nextDir = {x:0,  y:-1};
  if (keys['ArrowDown'] || keys['KeyS']) player.nextDir = {x:0,  y:1};

  // Try to change direction if possible
  const nx = player.x + player.nextDir.x * player.speed;
  const ny = player.y + player.nextDir.y * player.speed;
  if (canMove(nx, ny)) {
    player.dir = {...player.nextDir};
  }

  // Move
  let mx = player.x + player.dir.x * player.speed;
  let my = player.y + player.dir.y * player.speed;
  if (canMove(mx, my)) {
    player.x = mx; player.y = my;
  } else {
    // snap to center of cell for clean turns
    player.dir = {x:0,y:0};
  }

  // Wrap (optional tunnels)
  if (player.x < 0) player.x = W;
  if (player.x > W) player.x = 0;

  // Collect crystals
  const pc = Math.floor(player.x / CELL);
  const pr = Math.floor(player.y / CELL);
  if (pr >= 0 && pr < ROWS && pc >= 0 && pc < COLS) {
    if (maze[pr][pc] === 2) {
      maze[pr][pc] = 0;
      score += 10;
      crystalsLeft--;
      sfx.collect();
      updateHUD();
    } else if (maze[pr][pc] === 3) {
      maze[pr][pc] = 0;
      score += 50;
      crystalsLeft--;
      magicField = 480; // ~8 seconds
      sfx.power();
      updateHUD();
    }
  }

  if (magicField > 0) magicField--;

  // Level clear
  if (crystalsLeft <= 0) nextLevel();

  // Monsters AI (simple chase / scatter) — frozen monsters stand still
  monsters.forEach(m => {
    if (freezeTime > 0) return;
    // occasionally pick new direction
    if (Math.random() < 0.04 || (m.dir.x === 0 && m.dir.y === 0)) {
      const options = [];
      [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy]) => {
        if (canMove(m.x + dx * 12, m.y + dy * 12, 7)) options.push({x:dx,y:dy});
      });
      if (options.length) {
        // prefer toward player when not in magic field, away when magic field
        if (magicField > 0) {
          // run away
          options.sort((a,b) => {
            const da = Math.hypot(m.x + a.x - player.x, m.y + a.y - player.y);
            const db = Math.hypot(m.x + b.x - player.x, m.y + b.y - player.y);
            return db - da;
          });
        } else {
          options.sort((a,b) => {
            const da = Math.hypot(m.x + a.x - player.x, m.y + a.y - player.y);
            const db = Math.hypot(m.x + b.x - player.x, m.y + b.y - player.y);
            return da - db;
          });
        }
        m.dir = options[0];
      }
    }
    const speed = magicField > 0 ? m.speed * 0.7 : m.speed;
    let nmx = m.x + m.dir.x * speed;
    let nmy = m.y + m.dir.y * speed;
    if (canMove(nmx, nmy, 7)) {
      m.x = nmx; m.y = nmy;
    } else {
      m.dir = {x:0,y:0};
    }
    // wrap
    if (m.x < 0) m.x = W;
    if (m.x > W) m.x = 0;

    // collision with player
    const dist = Math.hypot(m.x - player.x, m.y - player.y);
    if (dist < 16) {
      if (magicField > 0) {
        // force respawn
        m.x = m.home.c * CELL + CELL/2;
        m.y = m.home.r * CELL + CELL/2;
        m.dir = {x:0,y:0};
        score += 200;
        sfx.respawn();
        updateHUD();
      } else {
        // player caught — soul dissolves, then READY? before the next life
        startDeath();
      }
    }
  });
}

// ---------- Draw ----------
function draw() {
  // Background
  ctx.fillStyle = '#0a0614';
  ctx.fillRect(0, 0, W, H);

  // Maze hedges
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = c * CELL, y = r * CELL;
      if (maze[r][c] === 1) {
        // hedge
        ctx.fillStyle = '#1a3a1a';
        ctx.fillRect(x, y, CELL, CELL);
        ctx.fillStyle = '#2d5a2d';
        ctx.fillRect(x+2, y+2, CELL-4, CELL-4);
        // little leaf dots
        ctx.fillStyle = '#3d7a3d';
        ctx.fillRect(x+6, y+6, 3, 3);
        ctx.fillRect(x+14, y+12, 3, 3);
      } else if (maze[r][c] === 2) {
        // small crystal
        ctx.fillStyle = '#67e8f9';
        ctx.shadowColor = '#67e8f9';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(x+12, y+6);
        ctx.lineTo(x+17, y+12);
        ctx.lineTo(x+12, y+18);
        ctx.lineTo(x+7, y+12);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
      } else if (maze[r][c] === 3) {
        // power crystal
        ctx.fillStyle = '#e879f9';
        ctx.shadowColor = '#e879f9';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.moveTo(x+12, y+3);
        ctx.lineTo(x+20, y+12);
        ctx.lineTo(x+12, y+21);
        ctx.lineTo(x+4, y+12);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#f5d0fe';
        ctx.beginPath();
        ctx.moveTo(x+12, y+7);
        ctx.lineTo(x+16, y+12);
        ctx.lineTo(x+12, y+17);
        ctx.lineTo(x+8, y+12);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
  }

  // Power-up pickups
  pickups.forEach(p => {
    const by = Math.sin(p.bob) * 2.5;
    ctx.save();
    ctx.translate(p.x, p.y + by);
    ctx.globalAlpha = Math.min(1, p.life / 60);
    if (p.type === 'speed') {
      ctx.fillStyle = '#fbbf24';
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 12;
      // lightning bolt
      ctx.beginPath();
      ctx.moveTo(1, -8); ctx.lineTo(-4, 1); ctx.lineTo(0, 1);
      ctx.lineTo(-1, 8); ctx.lineTo(4, -1); ctx.lineTo(0, -1);
      ctx.closePath();
      ctx.fill();
    } else if (p.type === 'freeze') {
      ctx.strokeStyle = '#67e8f9';
      ctx.shadowColor = '#67e8f9';
      ctx.shadowBlur = 12;
      ctx.lineWidth = 2;
      // snowflake
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * -8, Math.sin(a) * -8);
        ctx.lineTo(Math.cos(a) * 8, Math.sin(a) * 8);
        ctx.stroke();
      }
    } else {
      // heart (extra life)
      ctx.fillStyle = '#f472b6';
      ctx.shadowColor = '#f472b6';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(-3, -2, 4, 0, Math.PI * 2);
      ctx.arc(3, -2, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-6.5, 0); ctx.lineTo(0, 8); ctx.lineTo(6.5, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  });

  // Monsters — each classic monster gets its own look
  const frozen = freezeTime > 0;
  monsters.forEach(m => {
    ctx.save();
    ctx.translate(m.x, m.y);
    const scared = magicField > 0;
    if (scared) ctx.globalAlpha = 0.7 + Math.sin(Date.now()*0.01)*0.2;
    const body = frozen ? '#93c5fd' : (scared ? '#67e8f9' : m.color);
    ctx.shadowColor = body;
    ctx.shadowBlur = 10;

    if (m.name === 'Vampire') {
      // cape
      ctx.fillStyle = frozen || scared ? body : '#1e1b4b';
      ctx.beginPath();
      ctx.moveTo(-10, -4); ctx.lineTo(0, 11); ctx.lineTo(10, -4);
      ctx.closePath(); ctx.fill();
      // head
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.arc(0, -2, 7, 0, Math.PI*2); ctx.fill();
      // widow's peak hair
      ctx.fillStyle = '#0f0a1a';
      ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(0, -2); ctx.lineTo(6, -6); ctx.lineTo(6, -9); ctx.lineTo(-6, -9); ctx.closePath(); ctx.fill();
      // eyes + fangs
      ctx.fillStyle = frozen ? '#0f0a1a' : '#ff5555';
      ctx.fillRect(-4, -3, 2.5, 2.5); ctx.fillRect(1.5, -3, 2.5, 2.5);
      ctx.fillStyle = '#fff';
      ctx.fillRect(-3, 2, 2, 3); ctx.fillRect(1, 2, 2, 3);
    } else if (m.name === 'Frank') {
      // flat green head + bolts
      ctx.fillStyle = body;
      ctx.fillRect(-8, -9, 16, 18);
      ctx.fillStyle = '#14532d';
      ctx.fillRect(-9, -11, 18, 4);
      ctx.fillStyle = '#a1a1aa';
      ctx.fillRect(-11, -2, 3, 4); ctx.fillRect(8, -2, 3, 4);
      ctx.fillStyle = '#0f0a1a';
      ctx.fillRect(-5, -4, 3, 3); ctx.fillRect(2, -4, 3, 3);
      ctx.strokeStyle = '#14532d';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-4, 4); ctx.lineTo(4, 5); ctx.stroke();
    } else if (m.name === 'Werewolf') {
      // furry head with ears + snout
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-8, -6); ctx.lineTo(-6, -14); ctx.lineTo(-2, -7); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(8, -6); ctx.lineTo(6, -14); ctx.lineTo(2, -7); ctx.closePath(); ctx.fill();
      // snout
      ctx.fillStyle = frozen ? '#60a5fa' : '#57534e';
      ctx.beginPath(); ctx.ellipse(0, 4, 5, 3.5, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#0f0a1a';
      ctx.beginPath(); ctx.arc(0, 3, 1.5, 0, Math.PI*2); ctx.fill();
      // glowing eyes
      ctx.fillStyle = frozen ? '#0f0a1a' : '#fbbf24';
      ctx.fillRect(-5, -3, 3, 2.5); ctx.fillRect(2, -3, 3, 2.5);
    } else {
      // Witch — hat + green eyes
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.arc(0, 1, 7, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = frozen || scared ? body : '#4c1d95';
      ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(-8, -3); ctx.lineTo(8, -3); ctx.closePath(); ctx.fill();
      ctx.fillRect(-10, -5, 20, 3);
      ctx.fillStyle = frozen ? '#0f0a1a' : '#4ade80';
      ctx.fillRect(-4, 0, 2.5, 2.5); ctx.fillRect(1.5, 0, 2.5, 2.5);
    }

    // icy overlay when frozen
    if (frozen) {
      ctx.strokeStyle = 'rgba(147,197,253,0.9)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-10, -12, 20, 24);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  });

  // Player — a glowing spirit with a trailing wisp (hidden while dissolving)
  if (dying === 0 && !awaitingReady) {
    ctx.save();
    ctx.translate(player.x, player.y);
    const glow = magicField > 0 ? '#e879f9' : '#c084fc';
    // wisp tail behind movement direction
    ctx.fillStyle = glow;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.ellipse(-player.dir.x * 9, -player.dir.y * 9 + 2, 7, 5, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.ellipse(-player.dir.x * 5, -player.dir.y * 5 + 1, 8.5, 7, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.shadowColor = glow;
    ctx.shadowBlur = magicField > 0 ? 20 : 12;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, player.r, 0, Math.PI*2);
    ctx.fill();
    // inner core
    ctx.fillStyle = '#f3e8ff';
    ctx.beginPath();
    ctx.arc(0, -1, 4.5, 0, Math.PI*2);
    ctx.fill();
    // eyes look where you're headed
    ctx.fillStyle = '#2e1065';
    const lx = player.dir.x * 1.5, ly = player.dir.y * 1.5;
    ctx.fillRect(-3.5 + lx, -3 + ly, 2.5, 3);
    ctx.fillRect(1 + lx, -3 + ly, 2.5, 3);
    // speed boost sparkle
    if (speedBoost > 0) {
      ctx.fillStyle = '#fbbf24';
      ctx.globalAlpha = 0.5 + Math.sin(Date.now() * 0.02) * 0.4;
      ctx.beginPath();
      ctx.arc(0, 0, player.r + 4, 0, Math.PI * 2);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    ctx.shadowBlur = 0;
  }

  // Dissolve wisps
  particles.forEach(p => {
    ctx.globalAlpha = Math.min(1, p.life / 40);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  // Magic field ring
  if (magicField > 0) {
    ctx.strokeStyle = `rgba(232,121,249,${0.3 + Math.sin(Date.now()*0.02)*0.2})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 22 + Math.sin(Date.now()*0.02)*3, 0, Math.PI*2);
    ctx.stroke();
  }
}

function updateHUD() {
  document.getElementById('score').textContent = score;
  document.getElementById('lives').textContent = lives;
  document.getElementById('level').textContent = level;
  document.getElementById('crystals').textContent = crystalsLeft;
  document.getElementById('field').textContent = magicField > 0 ? 'ON' : 'OFF';
  document.getElementById('field').style.color = magicField > 0 ? '#e879f9' : '#c084fc';
}

// ---------- Loop ----------
// Build the maze immediately so the first draw() has data
// (previously maze was empty until Start, crashing the loop on frame one)
buildMaze();
spawnMonsters();

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}
loop();
console.log('Spectral Manor Soul Circuit ready');
