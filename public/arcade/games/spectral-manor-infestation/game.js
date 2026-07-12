// ============================================================
// SPECTRAL MANOR INFESTATION
// Centipede-style · Haunted toadstool field · Splitting Hauntipede
// Ghost Circuit / Plumbmonkey Media
// ============================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

// ---------- Audio ----------
let audioCtx = null;
function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}
function tone(f, d, t = 'square', v = 0.05, s = 0) {
  if (!audioCtx) return;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = t; o.frequency.setValueAtTime(f, audioCtx.currentTime);
  if (s) o.frequency.linearRampToValueAtTime(Math.max(30, f + s), audioCtx.currentTime + d);
  g.gain.setValueAtTime(v, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + d);
  o.connect(g); g.connect(audioCtx.destination);
  o.start(); o.stop(audioCtx.currentTime + d);
}
const sfx = {
  shoot:    () => tone(1100, 0.045, 'square', 0.035, -600),
  segment:  () => { tone(300, 0.07, 'sawtooth', 0.05, -120); tone(600, 0.05, 'square', 0.03, -200); },
  head:     () => { tone(200, 0.12, 'sawtooth', 0.06, -80); tone(800, 0.08, 'square', 0.04, -400); },
  mushroom: () => tone(500, 0.03, 'triangle', 0.03, -100),
  ghost:    () => { tone(700, 0.08, 'square', 0.05); setTimeout(() => tone(1000, 0.1, 'square', 0.05), 70); },
  death:    () => { tone(150, 0.3, 'sawtooth', 0.07, -100); setTimeout(() => tone(80, 0.4, 'sawtooth', 0.06, -30), 150); },
  levelUp:  () => { tone(523, 0.08); setTimeout(() => tone(659, 0.08), 80); setTimeout(() => tone(784, 0.08), 160); setTimeout(() => tone(1047, 0.15), 240); }
};

// ---------- Grid ----------
const CELL = 24;
const COLS = Math.floor(W / CELL);   // 40
const ROWS = Math.floor(H / CELL);   // 22
const PLAYER_ZONE_ROW = ROWS - 5;    // player confined below this row

// ---------- State ----------
let score = 0, lives = 3, level = 1;
let gameRunning = false, gameOver = false;
let keys = {};
let mushrooms = {};   // "c,r" -> hp (4..1)
let segments = [];    // hauntipede segments
let bullets = [];
let particles = [];
let ghost = null;     // bonus gravekeeper ghost
let ghostTimer = 500;
let respawnPause = 0;

const player = { x: W / 2, y: H - 50, w: 22, h: 22, speed: 4.4, lastShot: 0 };

// ---------- Mushroom field ----------
function key(c, r) { return c + ',' + r; }
function seedMushrooms() {
  mushrooms = {};
  const count = 45 + level * 3;
  for (let i = 0; i < count; i++) {
    const c = 1 + Math.floor(Math.random() * (COLS - 2));
    const r = 2 + Math.floor(Math.random() * (PLAYER_ZONE_ROW - 3));
    mushrooms[key(c, r)] = 4;
  }
}

// ---------- Hauntipede ----------
function spawnHauntipede() {
  segments = [];
  const len = Math.min(10 + level, 16);
  const speed = Math.min(2.0 + level * 0.25, 4.2);
  for (let i = 0; i < len; i++) {
    segments.push({
      x: (COLS - 2 - i) * CELL + CELL / 2,
      y: 1 * CELL + CELL / 2,
      dir: 1, drop: 0, speed,
      head: i === 0
    });
  }
}

function segmentUpdate(s) {
  if (s.drop > 0) {
    // descending to the next row
    s.y += 3;
    s.drop -= 3;
    if (s.drop <= 0) {
      s.y = Math.round((s.y - CELL / 2) / CELL) * CELL + CELL / 2;
      s.drop = 0;
    }
    return;
  }
  s.x += s.dir * s.speed;
  const nextC = Math.floor((s.x + s.dir * (CELL / 2 + 2)) / CELL);
  const r = Math.floor(s.y / CELL);
  const blocked = nextC < 0 || nextC >= COLS || mushrooms[key(nextC, r)];
  if (blocked) {
    s.dir *= -1;
    if (r >= ROWS - 2) {
      // at the bottom: bounce back up a row (stays trapped in the player zone)
      s.y -= CELL;
    } else {
      s.drop = CELL;
    }
  }
}

// ---------- Ghost (bonus enemy, spider role) ----------
function spawnGhost() {
  const fromLeft = Math.random() < 0.5;
  ghost = {
    x: fromLeft ? -20 : W + 20,
    y: H - 120 - Math.random() * 80,
    vx: (fromLeft ? 1 : -1) * (1.8 + level * 0.15),
    t: Math.random() * Math.PI * 2
  };
}

// ---------- Effects ----------
function explode(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 6,
      vy: (Math.random() - 0.5) * 6,
      life: 18 + Math.random() * 14,
      color, size: 2 + Math.random() * 3
    });
  }
}

// ---------- Game flow ----------
function startGame() {
  score = 0; lives = 3; level = 1;
  bullets = []; particles = []; ghost = null; ghostTimer = 400;
  player.x = W / 2; player.y = H - 50;
  seedMushrooms();
  spawnHauntipede();
  gameRunning = true; gameOver = false; respawnPause = 0;
  document.getElementById('startOverlay').classList.add('hidden');
  updateHUD();
}

function nextLevel() {
  level++;
  sfx.levelUp();
  // heal all damaged mushrooms, add a few more
  Object.keys(mushrooms).forEach(k => mushrooms[k] = 4);
  for (let i = 0; i < 6; i++) {
    const c = 1 + Math.floor(Math.random() * (COLS - 2));
    const r = 2 + Math.floor(Math.random() * (PLAYER_ZONE_ROW - 3));
    mushrooms[key(c, r)] = 4;
  }
  spawnHauntipede();
  updateHUD();
}

function loseLife() {
  lives--;
  sfx.death();
  explode(player.x, player.y, '#c084fc', 24);
  updateHUD();
  if (lives <= 0) {
    gameOver = true; gameRunning = false;
    document.getElementById('startOverlay').classList.remove('hidden');
    document.getElementById('startOverlay').innerHTML = `
      <h2>THE MANOR IS OVERRUN</h2>
      <p>Final Score: ${score}</p>
      <p>Level Reached: ${level}</p>
      <p style="margin-top:0.8rem; opacity:0.8">Click or SPACE to try again</p>
    `;
  } else {
    // brief pause, reset positions
    respawnPause = 60;
    player.x = W / 2; player.y = H - 50;
    bullets = [];
    ghost = null;
    spawnHauntipede();
  }
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
  if (respawnPause > 0) { respawnPause--; return; }

  // Player movement (confined to lower zone)
  if (keys['ArrowLeft'] || keys['KeyA']) player.x -= player.speed;
  if (keys['ArrowRight'] || keys['KeyD']) player.x += player.speed;
  if (keys['ArrowUp'] || keys['KeyW']) player.y -= player.speed;
  if (keys['ArrowDown'] || keys['KeyS']) player.y += player.speed;
  player.x = Math.max(14, Math.min(W - 14, player.x));
  player.y = Math.max(PLAYER_ZONE_ROW * CELL + 10, Math.min(H - 14, player.y));

  // Shooting
  if (keys['Space'] && Date.now() - player.lastShot > 160) {
    bullets.push({ x: player.x, y: player.y - 14, vy: -11 });
    player.lastShot = Date.now();
    sfx.shoot();
  }

  bullets.forEach(b => b.y += b.vy);
  bullets = bullets.filter(b => b.y > -10);

  // Hauntipede
  segments.forEach(segmentUpdate);

  // Bullet collisions
  for (let bi = bullets.length - 1; bi >= 0; bi--) {
    const b = bullets[bi];
    let consumed = false;

    // vs mushrooms
    const bc = Math.floor(b.x / CELL), br = Math.floor(b.y / CELL);
    const mk = key(bc, br);
    if (mushrooms[mk]) {
      mushrooms[mk]--;
      sfx.mushroom();
      explode(b.x, b.y, '#a78bfa', 3);
      if (mushrooms[mk] <= 0) { delete mushrooms[mk]; score += 5; }
      else score += 1;
      bullets.splice(bi, 1);
      updateHUD();
      continue;
    }

    // vs segments
    for (let si = segments.length - 1; si >= 0; si--) {
      const s = segments[si];
      if (Math.hypot(b.x - s.x, b.y - s.y) < 13) {
        const wasHead = s.head;
        score += wasHead ? 100 : 10;
        (wasHead ? sfx.head : sfx.segment)();
        explode(s.x, s.y, wasHead ? '#e879f9' : '#a78bfa', 10);
        // leave a mushroom where the segment died
        const sc = Math.floor(s.x / CELL), sr = Math.floor(s.y / CELL);
        if (sr > 1 && sr < PLAYER_ZONE_ROW) mushrooms[key(sc, sr)] = 4;
        segments.splice(si, 1);
        // the segment behind the gap becomes a new head (split)
        if (si < segments.length) segments[si].head = true;
        bullets.splice(bi, 1);
        consumed = true;
        updateHUD();
        break;
      }
    }
    if (consumed) continue;

    // vs ghost
    if (ghost && Math.hypot(b.x - ghost.x, b.y - ghost.y) < 16) {
      score += 300;
      sfx.ghost();
      explode(ghost.x, ghost.y, '#67e8f9', 16);
      ghost = null;
      bullets.splice(bi, 1);
      updateHUD();
    }
  }

  // Hauntipede cleared → next level
  if (segments.length === 0) nextLevel();

  // Segment vs player
  segments.forEach(s => {
    if (Math.hypot(s.x - player.x, s.y - player.y) < 16) loseLife();
  });

  // Ghost behavior
  if (ghost) {
    ghost.t += 0.06;
    ghost.x += ghost.vx;
    ghost.y += Math.sin(ghost.t) * 2.2;
    // eats mushrooms it passes over
    const gc = Math.floor(ghost.x / CELL), gr = Math.floor(ghost.y / CELL);
    if (mushrooms[key(gc, gr)] && Math.random() < 0.1) delete mushrooms[key(gc, gr)];
    if (Math.hypot(ghost.x - player.x, ghost.y - player.y) < 18) loseLife();
    if (ghost && (ghost.x < -40 || ghost.x > W + 40)) ghost = null;
  } else {
    ghostTimer--;
    if (ghostTimer <= 0) {
      spawnGhost();
      ghostTimer = 400 + Math.random() * 300;
    }
  }

  // Particles
  particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.life--; });
  particles = particles.filter(p => p.life > 0);
}

// ---------- Draw ----------
function drawMushroom(c, r, hp) {
  const x = c * CELL + CELL / 2, y = r * CELL + CELL / 2;
  const s = 0.55 + hp * 0.11; // shrink as damaged
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  // stem
  ctx.fillStyle = '#d8c8f0';
  ctx.fillRect(-3, 0, 6, 9);
  // cap
  ctx.fillStyle = hp >= 3 ? '#7c3aed' : '#5b21b6';
  ctx.shadowColor = '#a855f7';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.arc(0, 0, 10, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  // spots
  ctx.fillStyle = '#e9d5ff';
  ctx.beginPath(); ctx.arc(-4, -4, 1.8, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(3, -6, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function draw() {
  // Night garden background
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0d0618');
  g.addColorStop(1, '#07040f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // faint moon
  ctx.fillStyle = 'rgba(224,212,255,0.12)';
  ctx.beginPath(); ctx.arc(W - 90, 60, 34, 0, Math.PI * 2); ctx.fill();

  // player-zone boundary hint
  ctx.strokeStyle = 'rgba(124,58,237,0.25)';
  ctx.setLineDash([6, 10]);
  ctx.beginPath();
  ctx.moveTo(0, PLAYER_ZONE_ROW * CELL);
  ctx.lineTo(W, PLAYER_ZONE_ROW * CELL);
  ctx.stroke();
  ctx.setLineDash([]);

  // Mushrooms
  Object.keys(mushrooms).forEach(k => {
    const [c, r] = k.split(',').map(Number);
    drawMushroom(c, r, mushrooms[k]);
  });

  // Hauntipede
  segments.forEach(s => {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.fillStyle = s.head ? '#e879f9' : '#a78bfa';
    ctx.shadowColor = s.head ? '#e879f9' : '#8b5cf6';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(0, 0, s.head ? 11 : 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // eyes on head
    if (s.head) {
      ctx.fillStyle = '#0f0a1a';
      ctx.fillRect(s.dir > 0 ? 1 : -5, -4, 4, 4);
      ctx.fillRect(s.dir > 0 ? 5 : -9, -1, 3, 3);
    } else {
      // small ghostly wisp
      ctx.fillStyle = 'rgba(224,212,255,0.5)';
      ctx.beginPath(); ctx.arc(0, -2, 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  });

  // Ghost
  if (ghost) {
    ctx.save();
    ctx.translate(ghost.x, ghost.y);
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#67e8f9';
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 14;
    // sheet-ghost shape
    ctx.beginPath();
    ctx.arc(0, -4, 11, Math.PI, 0);
    ctx.lineTo(11, 8);
    for (let i = 0; i < 4; i++) ctx.lineTo(11 - (i + 0.5) * 5.5, i % 2 === 0 ? 12 : 8);
    ctx.lineTo(-11, 8);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#0f0a1a';
    ctx.fillRect(-6, -8, 4, 5);
    ctx.fillRect(2, -8, 4, 5);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // Bullets
  ctx.fillStyle = '#00ffaa';
  ctx.shadowColor = '#00ffaa';
  ctx.shadowBlur = 8;
  bullets.forEach(b => {
    ctx.fillRect(b.x - 2, b.y - 7, 4, 12);
  });
  ctx.shadowBlur = 0;

  // Player — little crystal wand turret
  const blink = respawnPause > 0 && Math.floor(respawnPause / 5) % 2 === 0;
  if (!blink) {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.fillStyle = '#c084fc';
    ctx.shadowColor = '#c084fc';
    ctx.shadowBlur = 12;
    // body
    ctx.beginPath();
    ctx.moveTo(0, -13);
    ctx.lineTo(9, 4);
    ctx.lineTo(5, 10);
    ctx.lineTo(-5, 10);
    ctx.lineTo(-9, 4);
    ctx.closePath();
    ctx.fill();
    // crystal tip
    ctx.fillStyle = '#e9d5ff';
    ctx.beginPath();
    ctx.moveTo(0, -14); ctx.lineTo(3, -8); ctx.lineTo(0, -4); ctx.lineTo(-3, -8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.shadowBlur = 0;
  }

  // Particles
  particles.forEach(p => {
    ctx.globalAlpha = p.life / 30;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function updateHUD() {
  document.getElementById('score').textContent = score;
  document.getElementById('lives').textContent = lives;
  document.getElementById('level').textContent = level;
}

// ---------- Boot ----------
// Seed the field immediately so the start screen has scenery behind it
seedMushrooms();
spawnHauntipede();

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}
loop();
console.log('Spectral Manor Infestation ready');
