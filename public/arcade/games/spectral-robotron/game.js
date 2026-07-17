// ============================================================
// SPECTRAL MANOR SWARM
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
// Filtered noise burst — the backbone of '80s arcade impact sounds
function playNoise(dur, vol, filterType, f0, f1) {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const len = Math.floor(audioCtx.sampleRate * dur);
  const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const n = audioCtx.createBufferSource();
  n.buffer = buf;
  const flt = audioCtx.createBiquadFilter();
  flt.type = filterType;
  flt.frequency.setValueAtTime(f0, t);
  if (f1) flt.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  n.connect(flt); flt.connect(g); g.connect(audioCtx.destination);
  n.start(t);
}

// Fast dive zap — sawtooth pitch dive, the Robotron gun voice
function playZap(f0, fEnd, dur, vol) {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(fEnd, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur * 1.2);
  o.connect(g); g.connect(audioCtx.destination);
  o.start(t); o.stop(t + dur * 1.3);
}

const sfx = {
  // Rapid-fire gun: bright, harsh, SHORT (fires ~8x/sec — anything longer muds)
  shoot: () => {
    playZap(1600 + Math.random() * 250, 380, 0.055, 0.06);
    playNoise(0.03, 0.05, 'highpass', 2600);
  },
  // Monster destroyed: crunchy pop + low thud
  hit: () => {
    playNoise(0.14, 0.1, 'lowpass', 2200, 300);
    playZap(300, 70, 0.12, 0.08);
  },
  // Rescue: rising sparkle arpeggio with a shimmer on top
  save: () => {
    playTone(520, 0.07, 'square', 0.06);
    setTimeout(() => playTone(680, 0.08, 'square', 0.06), 60);
    setTimeout(() => { playTone(880, 0.1, 'square', 0.07); playNoise(0.1, 0.03, 'highpass', 6000); }, 120);
  },
  // Fan dragged away: falling wail
  lost: () => {
    playZap(420, 90, 0.4, 0.06);
    playTone(280, 0.35, 'triangle', 0.05, -180);
  },
  // Player down: full detonation — noise blast + saw dive + sub thump
  hurt: () => {
    playNoise(0.35, 0.13, 'lowpass', 2800, 200);
    playZap(700, 60, 0.3, 0.1);
    playTone(90, 0.3, 'sine', 0.12, -50);
  },
  // Wave clear: fanfare + riser sweep
  wave: () => {
    playNoise(0.25, 0.04, 'bandpass', 400, 3200);
    playTone(440, 0.07, 'square', 0.06);
    setTimeout(() => playTone(554, 0.07, 'square', 0.06), 70);
    setTimeout(() => playTone(659, 0.12, 'square', 0.07), 140);
  }
};

// ---------- State ----------
let score = 0, lives = 3, wave = 1, saved = 0, lost = 0;
let gameRunning = false, gameOver = false;
let keys = {};
let mouse = { x: W/2, y: H/2, down: false };

// ---------- Juice: high score, combo, shake, hit-pause, banner ----------
const BEST_KEY = 'spectralArcade.swarm.best';
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
let obstacles = [];   // crypt blocks — cover for you, walls for everyone
let enemyBolts = [];  // specter projectiles
let drops = [];       // power-up pickups
let rescueChain = 0;  // escalating rescue bonus within a wave

// ---------- Obstacles ----------
function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
function insideObstacle(x, y, w, h) {
  return obstacles.some(o => x < o.x + o.w && x + w > o.x && y < o.y + o.h && y + h > o.y);
}
function spawnObstacles() {
  obstacles = [];
  const count = 4 + Math.min(wave, 3);
  let guard = 0;
  while (obstacles.length < count && guard++ < 200) {
    const o = {
      x: 70 + Math.random() * (W - 220),
      y: 70 + Math.random() * (H - 200),
      w: 46 + Math.random() * 40,
      h: 34 + Math.random() * 24
    };
    // keep the center clear for the player spawn, and space them out
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
    if (Math.hypot(cx - W / 2, cy - H / 2) < 120) continue;
    if (obstacles.some(p => Math.hypot(p.x - o.x, p.y - o.y) < 130)) continue;
    obstacles.push(o);
  }
}

// ---------- Power-ups ----------
const DROP_TYPES = [
  { type: 'rapid',  label: 'RAPID',  color: '#22d3ee' },
  { type: 'spread', label: 'SPREAD', color: '#f0abfc' },
  { type: 'shield', label: 'SHIELD', color: '#4ade80' },
  { type: 'banish', label: 'BANISH', color: '#f59e0b' }
];
function spawnDrop(x, y) {
  const pick = DROP_TYPES[Math.floor(Math.random() * DROP_TYPES.length)];
  drops.push({ x, y, w: 22, h: 22, ...pick, life: 480, bob: Math.random() * Math.PI * 2 });
}

// ---------- Input ----------
window.addEventListener('keydown', e => {
  initAudio();
  keys[e.code] = true;
  if (e.code === 'Space') e.preventDefault();
  if (e.code === 'Space' && !gameRunning) startGame();
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
  score = 0; lives = 3; wave = 1; saved = 0; lost = 0;
  bullets = []; monsters = []; fans = []; particles = [];
  enemyBolts = []; drops = []; rescueChain = 0;
  combo = 0; comboTimer = 0; hitPause = 0; shakeTime = 0; waveDelay = 0;
  bannerText = 'WAVE 1'; bannerTime = 90;
  player.x = W/2; player.y = H/2;
  player.fireCooldown = 0; player.invuln = 0;
  player.powerType = null; player.powerTime = 0;
  gameRunning = true; gameOver = false;
  document.getElementById('startOverlay').classList.add('hidden');
  spawnWave();
  updateHUD();
}

function spawnWave() {
  monsters = [];
  fans = [];
  enemyBolts = [];
  rescueChain = 0;
  spawnObstacles();

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
    let fx, fy, tries = 0;
    do {
      fx = 60 + Math.random() * (W - 120);
      fy = 50 + Math.random() * (H - 100);
    } while (insideObstacle(fx, fy, 16 * scale, 22 * scale) && tries++ < 30);
    fans.push({
      x: fx,
      y: fy,
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
      size: m.size,
      boltTimer: 100 + Math.random() * 120 // specters: time to next shot
    });
  }
}

function fire() {
  if (player.fireCooldown > 0) return;
  const dx = mouse.x - (player.x + player.w/2);
  const dy = mouse.y - (player.y + player.h/2);
  const speed = 13;
  const baseAng = Math.atan2(dy, dx);
  // SPREAD power-up: 5-way fan; otherwise classic dual shot
  const angles = player.powerType === 'spread'
    ? [-0.3, -0.15, 0, 0.15, 0.3]
    : [-0.06, 0.06];
  angles.forEach(a => {
    bullets.push({
      x: player.x + player.w/2,
      y: player.y + player.h/2,
      vx: Math.cos(baseAng + a) * speed,
      vy: Math.sin(baseAng + a) * speed,
      r: 4,
      life: 55
    });
  });
  player.fireCooldown = player.powerType === 'rapid' ? 3 : 7;
  sfx.shoot();
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

  // Move
  let vx = 0, vy = 0;
  if (keys['ArrowLeft'] || keys['KeyA']) vx = -player.speed;
  if (keys['ArrowRight'] || keys['KeyD']) vx = player.speed;
  if (keys['ArrowUp'] || keys['KeyW']) vy = -player.speed;
  if (keys['ArrowDown'] || keys['KeyS']) vy = player.speed;
  if (vx && vy) { vx *= 0.707; vy *= 0.707; }

  // Move with obstacle sliding (try X and Y separately)
  let nx = Math.max(8, Math.min(W - player.w - 8, player.x + vx));
  let ny = Math.max(28, Math.min(H - player.h - 8, player.y + vy));
  if (!insideObstacle(nx, player.y, player.w, player.h)) player.x = nx;
  if (!insideObstacle(player.x, ny, player.w, player.h)) player.y = ny;
  player.angle = Math.atan2(mouse.y - (player.y + player.h/2), mouse.x - (player.x + player.w/2));

  // walking animation state
  player.moving = !!(vx || vy);
  if (player.moving) player.walkPhase = (player.walkPhase || 0) + 0.32;

  if ((mouse.down || keys['Space']) && player.fireCooldown <= 0) fire();
  if (player.fireCooldown > 0) player.fireCooldown--;
  if (player.invuln > 0) player.invuln--;

  // Power-up timer
  if (player.powerTime > 0) {
    player.powerTime--;
    if (player.powerTime === 0) player.powerType = null;
  }

  // Bullets — obstacles block shots (yours and theirs)
  bullets.forEach(b => { b.x += b.vx; b.y += b.vy; b.life--; });
  bullets = bullets.filter(b =>
    b.life > 0 && b.x > -10 && b.x < W+10 && b.y > -10 && b.y < H+10 &&
    !insideObstacle(b.x - 2, b.y - 2, 4, 4));

  // Specter bolts
  enemyBolts.forEach(b => { b.x += b.vx; b.y += b.vy; b.life--; });
  enemyBolts = enemyBolts.filter(b =>
    b.life > 0 && b.x > -10 && b.x < W+10 && b.y > -10 && b.y < H+10 &&
    !insideObstacle(b.x - 2, b.y - 2, 4, 4));
  if (player.invuln <= 0) {
    enemyBolts.forEach((b, bi) => {
      if (b.x > player.x && b.x < player.x + player.w &&
          b.y > player.y && b.y < player.y + player.h) {
        enemyBolts.splice(bi, 1);
        hurtPlayer();
      }
    });
  }

  // Power-up pickups
  drops.forEach((d, di) => {
    d.bob += 0.08;
    d.life--;
    if (d.life <= 0) { drops.splice(di, 1); return; }
    if (player.x < d.x + d.w && player.x + player.w > d.x &&
        player.y < d.y + d.h && player.y + player.h > d.y) {
      drops.splice(di, 1);
      sfx.save();
      if (d.type === 'shield') {
        player.invuln = 360; // 6 seconds
      } else if (d.type === 'banish') {
        // shockwave — every monster takes a hit, carried fans drop
        triggerShake(12, 22);
        hitPause = 4;
        for (let mi = monsters.length - 1; mi >= 0; mi--) {
          const m = monsters[mi];
          m.hp--;
          createParticles(m.x + m.w/2, m.y + m.h/2, m.color, 10);
          if (m.hp <= 0) {
            fans.forEach(f => { if (f.grabber === m) { f.grabbed = false; f.grabber = null; } });
            score += (150 + wave * 15);
            monsters.splice(mi, 1);
          }
        }
        updateHUD();
      } else {
        player.powerType = d.type;   // rapid | spread
        player.powerTime = 480;      // 8 seconds
      }
    }
  });

  // Fans panic + scream + scramble away from danger (Revenger-style limbs)
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
      f.moving = true;
      return;
    }

    // find the nearest monster to flee from
    let near = null, nd = 1e9;
    monsters.forEach(m => {
      const d = Math.hypot(m.x - f.x, m.y - f.y);
      if (d < nd) { nd = d; near = m; }
    });

    let vx = 0, vy = 0;
    if (near && nd < 150) {
      // run away from it
      const dx = f.x - near.x, dy = f.y - near.y;
      const d = Math.hypot(dx, dy) || 1;
      vx = (dx / d) * 1.7;
      vy = (dy / d) * 1.7;
      f.facing = vx < 0 ? -1 : 1;
    } else {
      // idle wander
      f.wander = (f.wander || 0) - 1;
      if (f.wander <= 0) {
        f.wx = (Math.random() - 0.5) * 1.1;
        f.wy = (Math.random() - 0.5) * 1.1;
        f.wander = 40 + Math.random() * 60;
      }
      vx = f.wx; vy = f.wy;
      if (Math.abs(vx) > 0.05) f.facing = vx < 0 ? -1 : 1;
    }

    f.moving = Math.abs(vx) + Math.abs(vy) > 0.15;
    if (f.moving) f.walkPhase = (f.walkPhase || 0) + 0.3;

    const nx = f.x + vx, ny = f.y + vy;
    if (nx > 14 && nx < W - f.w - 14 && !insideObstacle(nx, f.y, f.w, f.h)) f.x = nx;
    if (ny > 34 && ny < H - f.h - 10 && !insideObstacle(f.x, ny, f.w, f.h)) f.y = ny;
  });

  // Monsters AI — hunt nearest fan, or player if close
  monsters.forEach(m => {
    const prevX = m.x, prevY = m.y; // for obstacle sliding
    m.walkPhase = (m.walkPhase || 0) + m.speed * 0.14; // limb animation

    // ----- Specters are casters: keep range and hurl bolts -----
    if (m.type === 'specter' && !m.carrying) {
      const pdx = (player.x + player.w/2) - (m.x + m.w/2);
      const pdy = (player.y + player.h/2) - (m.y + m.h/2);
      const pd = Math.hypot(pdx, pdy) || 1;
      // keep ~200px distance: back off when close, drift in when far
      const dir = pd < 170 ? -1 : (pd > 260 ? 1 : 0);
      m.x += (pdx / pd) * m.speed * dir;
      m.y += (pdy / pd) * m.speed * dir;
      // strafe slowly for a floaty feel
      m.x += Math.cos(Date.now() * 0.001 + m.y) * 0.5;
      m.boltTimer--;
      if (m.boltTimer <= 0) {
        enemyBolts.push({
          x: m.x + m.w/2, y: m.y + m.h/2,
          vx: (pdx / pd) * 4.6, vy: (pdy / pd) * 4.6,
          life: 110
        });
        sfx.hit();
        m.boltTimer = 110 + Math.random() * 90 - wave * 3;
      }
      // obstacle slide + clamp, then done
      if (insideObstacle(m.x, m.y, m.w, m.h)) {
        if (!insideObstacle(m.x, prevY, m.w, m.h)) m.y = prevY;
        else if (!insideObstacle(prevX, m.y, m.w, m.h)) m.x = prevX;
        else { m.x = prevX; m.y = prevY; }
      }
      m.x = Math.max(10, Math.min(W - 40, m.x));
      m.y = Math.max(30, Math.min(H - 40, m.y));
      return;
    }

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

    if (!m.carrying && target && !target.grabbed) {
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

    // Slide around obstacles rather than walking through them
    if (!m.carrying && insideObstacle(m.x, m.y, m.w, m.h)) {
      if (!insideObstacle(m.x, prevY, m.w, m.h)) m.y = prevY;
      else if (!insideObstacle(prevX, m.y, m.w, m.h)) m.x = prevX;
      else { m.x = prevX; m.y = prevY; }
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
          // Free every fan this monster was holding (covers any orphaned grabs)
          fans.forEach(f => {
            if (f.grabber === m) { f.grabbed = false; f.grabber = null; }
          });
          m.carrying = null;
          combo++;
          comboTimer = 150;
          score += (150 + wave * 15) * comboMult();
          hitPause = 2;
          triggerShake(3, 8);
          createParticles(m.x + m.w/2, m.y + m.h/2, m.color, 16);
          if (Math.random() < 0.14) spawnDrop(m.x, m.y); // sometimes drop a power-up
          monsters.splice(mi, 1);
          updateHUD();
        }
      }
    });
  });

  // Player rescues fans by walking into them (if not grabbed)
  // Robotron-style escalating bonus: 300, 600, 900... up to 1500 per wave chain
  fans.forEach((f, fi) => {
    if (f.grabbed) return;
    if (player.x < f.x + f.w && player.x + player.w > f.x &&
        player.y < f.y + f.h && player.y + player.h > f.y) {
      saved++;
      rescueChain++;
      score += 300 * Math.min(rescueChain, 5);
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
        // knockback away from the monster
        const dx = player.x - m.x, dy = player.y - m.y;
        const d = Math.sqrt(dx*dx + dy*dy) || 1;
        player.x += (dx / d) * 30;
        player.y += (dy / d) * 30;
        hurtPlayer();
      }
    });
  }

  // Wave clear — all monsters down; any fans still standing are safe.
  // Breather: banner shows for a beat before the next wave spawns.
  if (monsters.length === 0 && gameRunning && waveDelay === 0) {
    fans.forEach(() => { saved++; score += 300; });
    fans = [];
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
}

function hurtPlayer() {
  lives--;
  player.invuln = 70;
  player.powerType = null; player.powerTime = 0;
  combo = 0; comboTimer = 0;
  hitPause = 5;
  triggerShake(9, 18);
  sfx.hurt();
  createParticles(player.x + 13, player.y + 13, '#f472b6', 14);
  updateHUD();
  if (lives <= 0) {
    gameOver = true;
    gameRunning = false;
    const newBest = score > best;
    if (newBest) { best = score; saveBest(); }
    const finalScore = score;
    Arcade.submitFlow(finalScore, () => {
      document.getElementById('startOverlay').classList.remove('hidden');
      document.getElementById('startOverlay').innerHTML = `
        <h2>FANS LOST</h2>
        <p>Saved: ${saved} &nbsp;|&nbsp; Lost: ${lost}</p>
        <p style="margin-top:0.5rem">Final Score: ${finalScore}</p>
        <p style="margin-top:0.3rem">Best: ${best}${newBest ? ' &nbsp;<span style="color:#f0abfc; font-weight:bold">NEW BEST!</span>' : ''}</p>
        <p style="margin-top:0.8rem; color:#a78bfa; font-size:0.8rem; letter-spacing:1px">TOP HEROES</p>
        ${Arcade.boardHTML(Arcade.slug)}
        <p style="margin-top:0.8rem; opacity:0.8">Click or SPACE to try again</p>
      `;
    });
    updateHUD();
  }
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
  // Screen shake — offset the whole world while shaking
  ctx.save();
  if (shakeTime > 0) {
    ctx.translate((Math.random() - 0.5) * shakeMag, (Math.random() - 0.5) * shakeMag);
  }

  // Dark arena (oversized so shake never reveals the canvas edge)
  ctx.fillStyle = '#0b0614';
  ctx.fillRect(-12, -12, W + 24, H + 24);

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

  // Obstacles — crumbling crypt blocks
  obstacles.forEach(o => {
    ctx.fillStyle = '#241536';
    ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.fillStyle = '#2f1d47';
    ctx.fillRect(o.x + 3, o.y + 3, o.w - 6, o.h - 6);
    // stone cracks
    ctx.strokeStyle = '#1a0f2a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(o.x + o.w * 0.3, o.y);
    ctx.lineTo(o.x + o.w * 0.35, o.y + o.h * 0.5);
    ctx.lineTo(o.x + o.w * 0.25, o.y + o.h);
    ctx.moveTo(o.x, o.y + o.h * 0.55);
    ctx.lineTo(o.x + o.w, o.y + o.h * 0.5);
    ctx.stroke();
    // moss glow on top
    ctx.fillStyle = 'rgba(74,222,128,0.15)';
    ctx.fillRect(o.x, o.y, o.w, 4);
  });

  // Power-up drops
  drops.forEach(d => {
    const bobY = Math.sin(d.bob) * 3;
    ctx.save();
    ctx.globalAlpha = Math.min(1, d.life / 60);
    ctx.shadowColor = d.color;
    ctx.shadowBlur = 15;
    ctx.strokeStyle = d.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(d.x + 11, d.y + 11 + bobY, 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(10,6,18,0.85)';
    ctx.beginPath();
    ctx.arc(d.x + 11, d.y + 11 + bobY, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = d.color;
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(d.label, d.x + 11, d.y + 11 + bobY);
    ctx.restore();
  });

  // Specter bolts
  enemyBolts.forEach(b => {
    ctx.fillStyle = '#22d3ee';
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.shadowBlur = 0;

  // Fans
  fans.forEach(f => {
    ctx.save();
    ctx.translate(f.x + f.w/2, f.y + f.h/2);

    // panic shake
    if (f.panic > 0 || f.grabbed) {
      ctx.translate((Math.random()-0.5)*3, (Math.random()-0.5)*3);
    }

    const S = f.scale;
    const bodyH = f.type === 'child' ? 9 : 11;
    const legY = bodyH * S + 3;

    // legs — running stride while moving, planted when still
    ctx.strokeStyle = f.color;
    ctx.lineWidth = 2.5 * S;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (f.moving && !f.grabbed) {
      const stride = Math.sin(f.walkPhase || 0) * 5 * S;
      ctx.moveTo(-2.5 * S, bodyH * S - 2); ctx.lineTo(-2.5 * S + stride, legY + 5 * S);
      ctx.moveTo(2.5 * S, bodyH * S - 2);  ctx.lineTo(2.5 * S - stride, legY + 5 * S);
    } else if (f.grabbed) {
      // dangling, kicking
      const kick = Math.sin(Date.now() * 0.02) * 3 * S;
      ctx.moveTo(-2.5 * S, bodyH * S - 2); ctx.lineTo(-3 * S + kick, legY + 4 * S);
      ctx.moveTo(2.5 * S, bodyH * S - 2);  ctx.lineTo(3 * S - kick, legY + 4 * S);
    } else {
      ctx.moveTo(-2.5 * S, bodyH * S - 2); ctx.lineTo(-3 * S, legY + 5 * S);
      ctx.moveTo(2.5 * S, bodyH * S - 2);  ctx.lineTo(3 * S, legY + 5 * S);
    }
    ctx.stroke();

    // body
    ctx.fillStyle = f.color;
    if (f.type === 'child') {
      ctx.beginPath();
      ctx.ellipse(0, 4, 7 * S, 9 * S, 0, 0, Math.PI*2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.ellipse(0, 5, 8 * S, 11 * S, 0, 0, Math.PI*2);
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

    // arms — up when panicked/grabbed, swinging while running, else at rest
    ctx.strokeStyle = f.color;
    ctx.lineWidth = 3 * f.scale;
    ctx.beginPath();
    if (f.panic > 0 || f.grabbed) {
      ctx.moveTo(-6 * f.scale, 0); ctx.lineTo(-11 * f.scale, -12 * f.scale);
      ctx.moveTo(6 * f.scale, 0);  ctx.lineTo(11 * f.scale, -12 * f.scale);
    } else if (f.moving) {
      const swing = Math.sin(f.walkPhase || 0) * 4 * f.scale;
      ctx.moveTo(-6 * f.scale, 1); ctx.lineTo(-9 * f.scale, 8 * f.scale + swing);
      ctx.moveTo(6 * f.scale, 1);  ctx.lineTo(9 * f.scale, 8 * f.scale - swing);
    } else {
      ctx.moveTo(-6 * f.scale, 1); ctx.lineTo(-8 * f.scale, 9 * f.scale);
      ctx.moveTo(6 * f.scale, 1);  ctx.lineTo(8 * f.scale, 9 * f.scale);
    }
    ctx.stroke();

    ctx.restore();
  });

  // Monsters — five distinct silhouettes with animated limbs
  monsters.forEach(m => {
    ctx.save();
    ctx.translate(m.x + m.w/2, m.y + m.h/2);
    const S = m.size;
    const stride = Math.sin(m.walkPhase || 0) * 5 * S;

    ctx.fillStyle = m.color;
    ctx.shadowColor = m.color;
    ctx.shadowBlur = 12;

    if (m.type === 'specter') {
      // hooded wraith — floats (no legs), hem ripples
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.arc(0, -4 * S, 11 * S, Math.PI, 0);
      const hem = 10 * S;
      ctx.lineTo(11 * S, hem);
      for (let i = 0; i < 3; i++) {
        const sx = 11 * S - (i + 0.5) * (22 * S / 3);
        ctx.quadraticCurveTo(sx + 3.5 * S, hem + 5 * S + Math.sin((m.walkPhase || 0) + i) * 2.5, sx - 3.5 * S, hem);
      }
      ctx.closePath();
      ctx.fill();
      // hood shadow
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(8,10,20,0.7)';
      ctx.beginPath();
      ctx.arc(0, -5 * S, 6.5 * S, 0, Math.PI * 2);
      ctx.fill();
    } else if (m.type === 'brute') {
      // hulking golem — short legs, massive swinging fists
      ctx.strokeStyle = m.color;
      ctx.lineWidth = 5 * S;
      ctx.lineCap = 'round';
      ctx.beginPath(); // legs
      ctx.moveTo(-6 * S, 12 * S); ctx.lineTo(-6 * S + stride * 0.6, 19 * S);
      ctx.moveTo(6 * S, 12 * S);  ctx.lineTo(6 * S - stride * 0.6, 19 * S);
      ctx.stroke();
      ctx.fillRect(-13 * S, -12 * S, 26 * S, 26 * S); // slab body
      // crack across the chest
      ctx.strokeStyle = 'rgba(15,10,26,0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-8 * S, -2 * S); ctx.lineTo(-2 * S, 3 * S); ctx.lineTo(4 * S, 0);
      ctx.stroke();
      // giant fists, counter-swinging
      ctx.fillStyle = m.color;
      ctx.beginPath();
      ctx.arc(-17 * S, 2 * S + stride, 6 * S, 0, Math.PI * 2);
      ctx.arc(17 * S, 2 * S - stride, 6 * S, 0, Math.PI * 2);
      ctx.fill();
    } else if (m.type === 'hunter') {
      // lean sprinting hound — forward lunge, running legs, ears
      ctx.strokeStyle = m.color;
      ctx.lineWidth = 3 * S;
      ctx.lineCap = 'round';
      ctx.beginPath(); // sprinting legs
      ctx.moveTo(-3 * S, 8 * S); ctx.lineTo(-4 * S + stride, 17 * S);
      ctx.moveTo(4 * S, 8 * S);  ctx.lineTo(5 * S - stride, 17 * S);
      ctx.stroke();
      ctx.beginPath(); // lunging wedge body
      ctx.moveTo(0, -13 * S);
      ctx.lineTo(11 * S, 10 * S);
      ctx.lineTo(-11 * S, 10 * S);
      ctx.closePath();
      ctx.fill();
      // ears
      ctx.beginPath();
      ctx.moveTo(-5 * S, -10 * S); ctx.lineTo(-8 * S, -18 * S); ctx.lineTo(-1 * S, -12 * S);
      ctx.moveTo(5 * S, -10 * S);  ctx.lineTo(8 * S, -18 * S);  ctx.lineTo(1 * S, -12 * S);
      ctx.fill();
    } else if (m.type === 'horror') {
      // pulsing blob with wriggling tentacles
      const pulse = 1 + Math.sin((m.walkPhase || 0) * 0.7) * 0.08;
      ctx.beginPath();
      ctx.ellipse(0, 0, 12 * S * pulse, 12 * S / pulse, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = m.color;
      ctx.lineWidth = 2.5 * S;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const bx = (i - 1.5) * 6 * S;
        const wig = Math.sin((m.walkPhase || 0) + i * 1.4) * 4 * S;
        ctx.moveTo(bx, 9 * S);
        ctx.quadraticCurveTo(bx + wig, 15 * S, bx - wig, 20 * S);
      }
      ctx.stroke();
    } else {
      // grunt — horned imp with stubby limbs
      ctx.strokeStyle = m.color;
      ctx.lineWidth = 3 * S;
      ctx.lineCap = 'round';
      ctx.beginPath(); // waddling legs + swinging arms
      ctx.moveTo(-4 * S, 12 * S); ctx.lineTo(-5 * S + stride, 18 * S);
      ctx.moveTo(4 * S, 12 * S);  ctx.lineTo(5 * S - stride, 18 * S);
      ctx.moveTo(-10 * S, 0);     ctx.lineTo(-13 * S, 6 * S - stride);
      ctx.moveTo(10 * S, 0);      ctx.lineTo(13 * S, 6 * S + stride);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, 2, 11 * S, 13 * S, 0, 0, Math.PI * 2);
      ctx.fill();
      // horns
      ctx.beginPath();
      ctx.moveTo(-7 * S, -9 * S); ctx.lineTo(-10 * S, -17 * S); ctx.lineTo(-3 * S, -11 * S);
      ctx.moveTo(7 * S, -9 * S);  ctx.lineTo(10 * S, -17 * S);  ctx.lineTo(3 * S, -11 * S);
      ctx.fill();
    }

    // eyes (specter gets glowing hollow eyes inside the hood instead)
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    if (m.type === 'specter') {
      ctx.fillStyle = '#67e8f9';
      ctx.fillRect(-4 * S, -7 * S, 3 * S, 3 * S);
      ctx.fillRect(1.5 * S, -7 * S, 3 * S, 3 * S);
    } else if (m.type === 'horror') {
      // three mismatched eyes
      ctx.fillStyle = '#fff';
      ctx.fillRect(-7 * S, -5 * S, 4 * S, 4 * S);
      ctx.fillRect(2 * S, -6 * S, 4 * S, 4 * S);
      ctx.fillRect(-2 * S, -1 * S, 3 * S, 3 * S);
      ctx.fillStyle = '#000';
      ctx.fillRect(-6 * S, -4 * S, 2 * S, 2 * S);
      ctx.fillRect(3 * S, -5 * S, 2 * S, 2 * S);
      ctx.fillRect(-1.5 * S, 0, 1.5 * S, 1.5 * S);
    } else {
      ctx.fillStyle = '#fff';
      ctx.fillRect(-6 * S, -6 * S, 4 * S, 4 * S);
      ctx.fillRect(2 * S, -6 * S, 4 * S, 4 * S);
      ctx.fillStyle = '#000';
      ctx.fillRect(-5 * S, -5 * S, 2 * S, 2 * S);
      ctx.fillRect(3 * S, -5 * S, 2 * S, 2 * S);
    }

    // HP bar
    if (m.maxHp > 1) {
      ctx.fillStyle = '#333';
      ctx.fillRect(-12, 20 * S, 24, 3);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-12, 20 * S, 24 * (m.hp / m.maxHp), 3);
    }

    ctx.restore();
  });

  // Player — hero with running legs, off-arm, and the aiming gun arm
  ctx.save();
  ctx.translate(player.x + player.w/2, player.y + player.h/2);
  if (player.invuln > 0 && Math.floor(player.invuln/3) % 2 === 0) ctx.globalAlpha = 0.35;

  const hStride = player.moving ? Math.sin(player.walkPhase || 0) * 6 : 0;

  // legs — running stride while moving, planted when still
  ctx.strokeStyle = '#7c3aed';
  ctx.lineWidth = 4.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-4, 11); ctx.lineTo(-4 + hStride, 20);
  ctx.moveTo(4, 11);  ctx.lineTo(4 - hStride, 20);
  ctx.stroke();

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

  // off-arm — counter-swings away from the gun side while running
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#a78bfa';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-Math.cos(player.angle) * 7, 1 - Math.sin(player.angle) * 7);
  ctx.lineTo(-Math.cos(player.angle) * 13, 9 - Math.sin(player.angle) * 9 - hStride * 0.6);
  ctx.stroke();

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

  ctx.restore(); // end screen shake — HUD overlays below stay steady

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

  // Active power-up indicator with time bar
  if (gameRunning && player.powerType) {
    const def = DROP_TYPES.find(d => d.type === player.powerType);
    ctx.save();
    ctx.fillStyle = def.color;
    ctx.shadowColor = def.color;
    ctx.shadowBlur = 10;
    ctx.font = 'bold 15px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(def.label, W/2, 70);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(W/2 - 40, 76, 80 * (player.powerTime / 480), 4);
    ctx.restore();
  }
}

function updateHUD() {
  document.getElementById('score').textContent = score;
  document.getElementById('lives').textContent = lives;
  document.getElementById('wave').textContent = wave;
  document.getElementById('saved').textContent = saved;
  document.getElementById('lost').textContent = lost;
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
console.log('Spectral Manor Swarm ready — Save the Ghost Circuit fans');
