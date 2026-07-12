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
  if ((e.code === 'Space' || e.code === 'Enter') && !gameRunning) startGame();
});
window.addEventListener('keyup', e => keys[e.code] = false);
document.getElementById('startOverlay').addEventListener('click', () => {
  initAudio();
  if (!gameRunning) startGame();
});

// ---------- Update ----------
function update() {
  if (!gameRunning) return;

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

  // Monsters AI (simple chase / scatter)
  monsters.forEach(m => {
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
        // player hurt
        lives--;
        sfx.hurt();
        player.x = PLAYER_START.x; player.y = PLAYER_START.y;
        player.dir = {x:0,y:0};
        magicField = 0;
        spawnMonsters(); // send monsters back to their corners
        updateHUD();
        if (lives <= 0) {
          gameOver = true;
          gameRunning = false;
          document.getElementById('startOverlay').classList.remove('hidden');
          document.getElementById('startOverlay').innerHTML = `
            <h2>SOUL LOST</h2>
            <p>Final Score: ${score}</p>
            <p style="margin-top:0.8rem; opacity:0.8">Click or SPACE to try again</p>
          `;
        }
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

  // Monsters
  monsters.forEach(m => {
    ctx.save();
    ctx.translate(m.x, m.y);
    if (magicField > 0) {
      // scared / blue-ish
      ctx.globalAlpha = 0.7 + Math.sin(Date.now()*0.01)*0.2;
      ctx.fillStyle = '#67e8f9';
    } else {
      ctx.fillStyle = m.color;
    }
    ctx.shadowColor = m.color;
    ctx.shadowBlur = 10;
    // body
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI*2);
    ctx.fill();
    // eyes
    ctx.fillStyle = '#0f0a1a';
    ctx.fillRect(-5, -4, 3, 4);
    ctx.fillRect(2, -4, 3, 4);
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  });

  // Player
  ctx.save();
  ctx.translate(player.x, player.y);
  if (magicField > 0) {
    ctx.shadowColor = '#e879f9';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#e879f9';
  } else {
    ctx.shadowColor = '#c084fc';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#c084fc';
  }
  ctx.beginPath();
  ctx.arc(0, 0, player.r, 0, Math.PI*2);
  ctx.fill();
  // simple face
  ctx.fillStyle = '#0f0a1a';
  ctx.fillRect(-4, -3, 3, 3);
  ctx.fillRect(1, -3, 3, 3);
  ctx.restore();
  ctx.shadowBlur = 0;

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
