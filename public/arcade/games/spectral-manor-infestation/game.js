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
  bug:      () => { tone(400, 0.06, 'square', 0.05, -150); tone(900, 0.05, 'triangle', 0.03, -300); },
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
let ghosts = [];      // gravekeeper ghosts drifting down from the manor hill
let ghostTimer = 200;
let respawnPause = 0;
let bugs = [];        // independent scarab bugs crawling down the field
let bugTimer = 220;
let hauntipedeLen = 12; // segments at spawn — speed scales as it shrinks
// the manor sits on a hill in the upper-right; ghosts & bugs spill from it
const manor = { x: W - 150, y: 46 };

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
  hauntipedeLen = len;
  const base = Math.min(2.3 + level * 0.28, 4.6);
  for (let i = 0; i < len; i++) {
    segments.push({
      x: (COLS - 2 - i) * CELL + CELL / 2,
      y: 1 * CELL + CELL / 2,
      dir: 1, drop: 0,
      speed: base + Math.random() * 0.5, // each segment scuttles at its own pace
      head: i === 0,
      legPhase: Math.random() * Math.PI * 2
    });
  }
}

// The fewer segments remain, the angrier (faster) the survivors get
function segmentSpeed(s) {
  const fury = 1 + (1 - segments.length / hauntipedeLen) * 0.9;
  return s.speed * fury;
}

// ---------- Scarab bugs (independent hazards) ----------
function spawnBug() {
  // ~40% scuttle out from under the manor, the rest from across the top
  const fromManor = Math.random() < 0.4;
  bugs.push({
    x: fromManor ? manor.x + (Math.random() - 0.5) * 50 : 30 + Math.random() * (W - 60),
    y: -14,
    vy: 1.6 + level * 0.2 + Math.random(),
    sway: Math.random() * Math.PI * 2,
    legPhase: 0
  });
}

function segmentUpdate(s) {
  s.legPhase += 0.35;
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
  s.x += s.dir * segmentSpeed(s);
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

// ---------- Ghosts — spill out of the manor and drift down the hill ----------
function spawnGhost() {
  ghosts.push({
    x: manor.x + (Math.random() - 0.5) * 40,
    y: manor.y + 20,
    vx: (Math.random() - 0.5) * 2.2,
    vy: 0.7 + level * 0.12 + Math.random() * 0.6, // downhill drift
    t: Math.random() * Math.PI * 2
  });
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
  bullets = []; particles = []; ghosts = []; ghostTimer = 180;
  bugs = []; bugTimer = 200;
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
    const finalScore = score;
    Arcade.submitFlow(finalScore, () => {
      document.getElementById('startOverlay').classList.remove('hidden');
      document.getElementById('startOverlay').innerHTML = `
        <h2>THE MANOR IS OVERRUN</h2>
        <p>Final Score: ${finalScore}</p>
        <p>Level Reached: ${level}</p>
        <p style="margin-top:0.8rem; color:#a78bfa; font-size:0.8rem; letter-spacing:1px">TOP EXTERMINATORS</p>
        ${Arcade.boardHTML(Arcade.slug)}
        <p style="margin-top:0.8rem; opacity:0.8">Click or SPACE to try again</p>
      `;
    });
  } else {
    // brief pause, reset positions
    respawnPause = 60;
    player.x = W / 2; player.y = H - 50;
    bullets = [];
    ghosts = [];
    bugs = [];
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

    // vs ghosts
    for (let gi = ghosts.length - 1; gi >= 0; gi--) {
      const g = ghosts[gi];
      if (Math.hypot(b.x - g.x, b.y - g.y) < 16) {
        score += 300;
        sfx.ghost();
        explode(g.x, g.y, '#67e8f9', 16);
        ghosts.splice(gi, 1);
        bullets.splice(bi, 1);
        updateHUD();
        break;
      }
    }
  }

  // Hauntipede cleared → next level
  if (segments.length === 0) nextLevel();

  // Segment vs player
  segments.forEach(s => {
    if (Math.hypot(s.x - player.x, s.y - player.y) < 16) loseLife();
  });

  // Ghosts drifting down from the manor
  const maxGhosts = 2 + Math.floor(level / 2);
  ghostTimer--;
  if (ghostTimer <= 0 && ghosts.length < maxGhosts) {
    spawnGhost();
    ghostTimer = 130 + Math.random() * 130 - level * 6;
  }
  for (let gi = ghosts.length - 1; gi >= 0; gi--) {
    const g = ghosts[gi];
    g.t += 0.06;
    g.x += g.vx + Math.sin(g.t) * 0.8;
    g.y += g.vy;
    // curve toward the player a little as it descends
    g.vx += ((player.x - g.x) > 0 ? 1 : -1) * 0.015;
    g.vx = Math.max(-2.4, Math.min(2.4, g.vx));
    // eats mushrooms it passes over
    const gc = Math.floor(g.x / CELL), gr = Math.floor(g.y / CELL);
    if (mushrooms[key(gc, gr)] && Math.random() < 0.1) delete mushrooms[key(gc, gr)];
    if (Math.hypot(g.x - player.x, g.y - player.y) < 18) { ghosts.splice(gi, 1); loseLife(); continue; }
    if (g.y > H + 30 || g.x < -40 || g.x > W + 40) ghosts.splice(gi, 1);
  }

  // Scarab bugs — crawl down through the field, seeding toadstools
  bugTimer--;
  if (bugTimer <= 0 && bugs.length < 3 + level) {
    spawnBug();
    bugTimer = 75 + Math.random() * 90 - level * 6;
  }
  for (let bi = bugs.length - 1; bi >= 0; bi--) {
    const bug = bugs[bi];
    bug.sway += 0.08;
    bug.legPhase += 0.4;
    bug.y += bug.vy;
    bug.x += Math.sin(bug.sway) * 1.6;
    // seed a toadstool in cells it crawls through
    const bc = Math.floor(bug.x / CELL), br = Math.floor(bug.y / CELL);
    if (br > 1 && br < PLAYER_ZONE_ROW && Math.random() < 0.03 &&
        !mushrooms[key(bc, br)]) {
      mushrooms[key(bc, br)] = 4;
    }
    // hits player
    if (Math.hypot(bug.x - player.x, bug.y - player.y) < 15) {
      bugs.splice(bi, 1);
      loseLife();
      continue;
    }
    // player bullets vs bug
    let killed = false;
    for (let ci = bullets.length - 1; ci >= 0; ci--) {
      const b = bullets[ci];
      if (Math.hypot(b.x - bug.x, b.y - bug.y) < 12) {
        bullets.splice(ci, 1);
        score += 200;
        sfx.bug();
        explode(bug.x, bug.y, '#4ade80', 12);
        bugs.splice(bi, 1);
        killed = true;
        updateHUD();
        break;
      }
    }
    if (killed) continue;
    if (bug.y > H + 20) bugs.splice(bi, 1);
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

  // faint moon (behind the manor)
  ctx.fillStyle = 'rgba(224,212,255,0.12)';
  ctx.beginPath(); ctx.arc(W - 210, 54, 30, 0, Math.PI * 2); ctx.fill();

  // ---- Manor on its hill (upper-right) — ghosts & bugs spill from here ----
  // hill
  ctx.fillStyle = '#0c0716';
  ctx.beginPath();
  ctx.moveTo(W - 320, 130);
  ctx.quadraticCurveTo(W - 150, 20, W + 20, 120);
  ctx.lineTo(W + 20, 0);
  ctx.lineTo(W - 320, 0);
  ctx.closePath();
  ctx.fill();
  // manor body
  ctx.fillStyle = '#160c26';
  ctx.fillRect(manor.x - 34, manor.y - 34, 68, 42);
  ctx.fillRect(manor.x + 20, manor.y - 52, 20, 60); // tower
  // roofs
  ctx.beginPath();
  ctx.moveTo(manor.x - 40, manor.y - 34);
  ctx.lineTo(manor.x, manor.y - 60);
  ctx.lineTo(manor.x + 12, manor.y - 34);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(manor.x + 16, manor.y - 52);
  ctx.lineTo(manor.x + 30, manor.y - 68);
  ctx.lineTo(manor.x + 44, manor.y - 52);
  ctx.closePath(); ctx.fill();
  // lit windows flickering
  ctx.fillStyle = 'rgba(232,121,249,0.7)';
  ctx.globalAlpha = 0.6 + Math.sin(Date.now() * 0.004) * 0.3;
  ctx.fillRect(manor.x - 24, manor.y - 22, 8, 10);
  ctx.fillRect(manor.x + 2, manor.y - 22, 8, 10);
  ctx.fillRect(manor.x + 26, manor.y - 40, 7, 9);
  ctx.globalAlpha = 1;

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

  // Hauntipede — segments with scuttling insect legs
  segments.forEach(s => {
    ctx.save();
    ctx.translate(s.x, s.y);
    const r = s.head ? 11 : 9;
    // three pairs of legs, alternating stroke
    ctx.strokeStyle = s.head ? '#c026d3' : '#7c3aed';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let li = 0; li < 3; li++) {
      const lx = (li - 1) * 6;
      const kick = Math.sin(s.legPhase + li * 1.1) * 3;
      ctx.moveTo(lx, -r + 2);
      ctx.lineTo(lx + kick, -r - 5);
      ctx.moveTo(lx, r - 2);
      ctx.lineTo(lx - kick, r + 5);
    }
    ctx.stroke();
    // body
    ctx.fillStyle = s.head ? '#e879f9' : '#a78bfa';
    ctx.shadowColor = s.head ? '#e879f9' : '#8b5cf6';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // eyes + antennae on head
    if (s.head) {
      ctx.fillStyle = '#0f0a1a';
      ctx.fillRect(s.dir > 0 ? 1 : -5, -4, 4, 4);
      ctx.fillRect(s.dir > 0 ? 5 : -9, -1, 3, 3);
      ctx.strokeStyle = '#e879f9';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const ax = s.dir > 0 ? 8 : -8;
      ctx.moveTo(ax, -6); ctx.lineTo(ax + s.dir * 6, -12);
      ctx.moveTo(ax, -3); ctx.lineTo(ax + s.dir * 8, -6);
      ctx.stroke();
    } else {
      // small ghostly wisp
      ctx.fillStyle = 'rgba(224,212,255,0.5)';
      ctx.beginPath(); ctx.arc(0, -2, 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  });

  // Scarab bugs — green beetles with churning legs
  bugs.forEach(bug => {
    ctx.save();
    ctx.translate(bug.x, bug.y);
    ctx.rotate(Math.sin(bug.sway) * 0.3);
    // legs
    ctx.strokeStyle = '#166534';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let li = 0; li < 3; li++) {
      const ly = (li - 1) * 5;
      const kick = Math.sin(bug.legPhase + li * 1.3) * 4;
      ctx.moveTo(-6, ly); ctx.lineTo(-11, ly + kick);
      ctx.moveTo(6, ly);  ctx.lineTo(11, ly - kick);
    }
    ctx.stroke();
    // carapace
    ctx.fillStyle = '#4ade80';
    ctx.shadowColor = '#4ade80';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.ellipse(0, 0, 7, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // shell split line + head
    ctx.strokeStyle = '#166534';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -9); ctx.lineTo(0, 9);
    ctx.stroke();
    ctx.fillStyle = '#166534';
    ctx.beginPath();
    ctx.arc(0, 9, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // Ghosts
  ghosts.forEach(g => {
    ctx.save();
    ctx.translate(g.x, g.y);
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
  });

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
