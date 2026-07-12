// ============================================================
// SPECTRAL MANOR CRYSTAL DIMENSION
// Asteroids-style · Zero-G · Flying rocks · Space Ghosts
// Ghost Circuit / Plumbmonkey Media
// ============================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

let audioCtx = null;
function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}
function tone(f, d, t='square', v=0.05, s=0) {
  if (!audioCtx) return;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = t; o.frequency.setValueAtTime(f, audioCtx.currentTime);
  if (s) o.frequency.linearRampToValueAtTime(f+s, audioCtx.currentTime+d);
  g.gain.setValueAtTime(v, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime+d);
  o.connect(g); g.connect(audioCtx.destination);
  o.start(); o.stop(audioCtx.currentTime+d);
}
const sfx = {
  shoot: () => tone(900, 0.05, 'square', 0.04, -400),
  boom:  () => { tone(120, 0.15, 'sawtooth', 0.06, -60); tone(80, 0.2, 'triangle', 0.04); },
  hurt:  () => tone(100, 0.25, 'sawtooth', 0.07, -50),
  crystal: () => { tone(700,0.06); setTimeout(()=>tone(1000,0.08),50); },
  wave:  () => { tone(440,0.07); setTimeout(()=>tone(554,0.07),70); setTimeout(()=>tone(659,0.1),140); }
};

let score=0, lives=3, wave=1;
let gameRunning=false, gameOver=false;
let keys = {};
let ship, bullets=[], rocks=[], ghosts=[], crystals=[], particles=[];

function resetShip() {
  ship = {
    x: W/2, y: H/2, angle: -Math.PI/2,
    vx: 0, vy: 0, r: 12, invuln: 90, thrust: false
  };
}

function spawnWave() {
  rocks = []; ghosts = []; crystals = [];
  const rockCount = 3 + wave;
  for (let i=0; i<rockCount; i++) {
    let x, y;
    do {
      x = Math.random()*W; y = Math.random()*H;
    } while (Math.hypot(x-ship.x, y-ship.y) < 120);
    rocks.push(makeRock(x, y, 3));
  }
  const ghostCount = 1 + Math.floor(wave/2);
  for (let i=0; i<ghostCount; i++) {
    ghosts.push({
      x: Math.random()*W, y: Math.random()*H,
      vx: (Math.random()-0.5)*2, vy: (Math.random()-0.5)*2,
      angle: Math.random()*Math.PI*2, r: 14,
      shootTimer: 60 + Math.random()*90
    });
  }
}

function makeRock(x, y, size) {
  const verts = 7 + Math.floor(Math.random()*4);
  const points = [];
  for (let i=0; i<verts; i++) {
    const a = (i / verts) * Math.PI * 2;
    const rad = (size * 12) * (0.7 + Math.random()*0.5);
    points.push({ x: Math.cos(a)*rad, y: Math.sin(a)*rad });
  }
  return {
    x, y, size,
    vx: (Math.random()-0.5) * (1.2 + (4-size)*0.6),
    vy: (Math.random()-0.5) * (1.2 + (4-size)*0.6),
    angle: 0, spin: (Math.random()-0.5)*0.04,
    points, r: size * 14
  };
}

function startGame() {
  score=0; lives=3; wave=1;
  bullets=[]; particles=[];
  resetShip();
  spawnWave();
  gameRunning=true; gameOver=false;
  document.getElementById('startOverlay').classList.add('hidden');
  updateHUD();
}

window.addEventListener('keydown', e => {
  initAudio();
  keys[e.code]=true;
  if (e.code==='Space') e.preventDefault();
  if ((e.code==='Space'||e.code==='Enter') && !gameRunning) startGame();
});
window.addEventListener('keyup', e => keys[e.code]=false);
document.getElementById('startOverlay').addEventListener('click', () => {
  initAudio();
  if (!gameRunning) startGame();
});

function fire() {
  if (ship.invuln > 80) return; // little grace
  bullets.push({
    x: ship.x + Math.cos(ship.angle)*16,
    y: ship.y + Math.sin(ship.angle)*16,
    vx: Math.cos(ship.angle)*9 + ship.vx*0.3,
    vy: Math.sin(ship.angle)*9 + ship.vy*0.3,
    life: 50
  });
  sfx.shoot();
}

function update() {
  if (!gameRunning) return;

  // Ship controls
  if (keys['ArrowLeft']||keys['KeyA']) ship.angle -= 0.07;
  if (keys['ArrowRight']||keys['KeyD']) ship.angle += 0.07;
  ship.thrust = keys['ArrowUp']||keys['KeyW'];
  if (ship.thrust) {
    ship.vx += Math.cos(ship.angle) * 0.18;
    ship.vy += Math.sin(ship.angle) * 0.18;
  }
  // friction
  ship.vx *= 0.99; ship.vy *= 0.99;
  // max speed
  const sp = Math.hypot(ship.vx, ship.vy);
  if (sp > 6) { ship.vx = ship.vx/sp*6; ship.vy = ship.vy/sp*6; }

  ship.x += ship.vx; ship.y += ship.vy;
  // wrap
  if (ship.x < 0) ship.x = W; if (ship.x > W) ship.x = 0;
  if (ship.y < 0) ship.y = H; if (ship.y > H) ship.y = 0;
  if (ship.invuln > 0) ship.invuln--;

  if (keys['Space']) {
    if (!ship.lastFire || Date.now() - ship.lastFire > 180) {
      fire();
      ship.lastFire = Date.now();
    }
  }

  // Bullets
  bullets.forEach(b => { b.x += b.vx; b.y += b.vy; b.life--; });
  bullets = bullets.filter(b => b.life > 0);
  bullets.forEach(b => {
    if (b.x < 0) b.x = W; if (b.x > W) b.x = 0;
    if (b.y < 0) b.y = H; if (b.y > H) b.y = 0;
  });

  // Rocks
  rocks.forEach(r => {
    r.x += r.vx; r.y += r.vy; r.angle += r.spin;
    if (r.x < -30) r.x = W+30; if (r.x > W+30) r.x = -30;
    if (r.y < -30) r.y = H+30; if (r.y > H+30) r.y = -30;
  });

  // Ghosts
  ghosts.forEach(g => {
    g.x += g.vx; g.y += g.vy;
    g.angle = Math.atan2(ship.y - g.y, ship.x - g.x);
    // mild seek
    g.vx += Math.cos(g.angle) * 0.02;
    g.vy += Math.sin(g.angle) * 0.02;
    const gsp = Math.hypot(g.vx, g.vy);
    if (gsp > 2.5) { g.vx = g.vx/gsp*2.5; g.vy = g.vy/gsp*2.5; }
    if (g.x < 0) g.x = W; if (g.x > W) g.x = 0;
    if (g.y < 0) g.y = H; if (g.y > H) g.y = 0;
    g.shootTimer--;
    if (g.shootTimer <= 0) {
      bullets.push({
        x: g.x, y: g.y,
        vx: Math.cos(g.angle)*5, vy: Math.sin(g.angle)*5,
        life: 70, fromGhost: true
      });
      g.shootTimer = 80 + Math.random()*100;
    }
  });

  // Crystals drift
  crystals.forEach(c => {
    c.x += c.vx; c.y += c.vy; c.life--;
    if (c.x < 0) c.x = W; if (c.x > W) c.x = 0;
    if (c.y < 0) c.y = H; if (c.y > H) c.y = 0;
  });
  crystals = crystals.filter(c => c.life > 0);

  // Bullet vs Rock
  bullets.forEach((b, bi) => {
    if (b.fromGhost) return;
    rocks.forEach((r, ri) => {
      if (Math.hypot(b.x-r.x, b.y-r.y) < r.r) {
        bullets.splice(bi, 1);
        score += (4 - r.size) * 50;
        sfx.boom();
        explode(r.x, r.y, '#a78bfa', 12);
        if (r.size > 1) {
          rocks.push(makeRock(r.x, r.y, r.size-1));
          rocks.push(makeRock(r.x, r.y, r.size-1));
        } else if (Math.random() < 0.4) {
          crystals.push({
            x: r.x, y: r.y,
            vx: (Math.random()-0.5)*1.5, vy: (Math.random()-0.5)*1.5,
            life: 400, r: 7
          });
        }
        rocks.splice(ri, 1);
        updateHUD();
      }
    });
  });

  // Bullet vs Ghost
  bullets.forEach((b, bi) => {
    if (b.fromGhost) return;
    ghosts.forEach((g, gi) => {
      if (Math.hypot(b.x-g.x, b.y-g.y) < g.r) {
        bullets.splice(bi, 1);
        score += 300;
        sfx.boom();
        explode(g.x, g.y, '#67e8f9', 16);
        ghosts.splice(gi, 1);
        updateHUD();
      }
    });
  });

  // Ghost bullet vs ship
  if (ship.invuln <= 0) {
    bullets.forEach((b, bi) => {
      if (!b.fromGhost) return;
      if (Math.hypot(b.x-ship.x, b.y-ship.y) < ship.r+2) {
        bullets.splice(bi, 1);
        hitShip();
      }
    });
  }

  // Rock / Ghost vs Ship
  if (ship.invuln <= 0) {
    rocks.forEach(r => {
      if (Math.hypot(r.x-ship.x, r.y-ship.y) < r.r + ship.r) hitShip();
    });
    ghosts.forEach(g => {
      if (Math.hypot(g.x-ship.x, g.y-ship.y) < g.r + ship.r) hitShip();
    });
  }

  // Collect crystals
  crystals.forEach((c, ci) => {
    if (Math.hypot(c.x-ship.x, c.y-ship.y) < c.r + ship.r) {
      score += 100;
      sfx.crystal();
      explode(c.x, c.y, '#e879f9', 8);
      crystals.splice(ci, 1);
      updateHUD();
    }
  });

  // Wave clear
  if (rocks.length === 0 && ghosts.length === 0 && gameRunning) {
    wave++;
    sfx.wave();
    spawnWave();
    updateHUD();
  }

  // Particles
  particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.life--; });
  particles = particles.filter(p => p.life > 0);
}

function hitShip() {
  lives--;
  sfx.hurt();
  explode(ship.x, ship.y, '#f472b6', 20);
  resetShip();
  updateHUD();
  if (lives <= 0) {
    gameOver = true; gameRunning = false;
    document.getElementById('startOverlay').classList.remove('hidden');
    document.getElementById('startOverlay').innerHTML = `
      <h2>DIMENSION COLLAPSED</h2>
      <p>Score: ${score}</p>
      <p style="margin-top:0.8rem; opacity:0.8">Click or SPACE to try again</p>
    `;
  }
}

function explode(x, y, color, n) {
  for (let i=0; i<n; i++) {
    particles.push({
      x, y,
      vx: (Math.random()-0.5)*7,
      vy: (Math.random()-0.5)*7,
      life: 20 + Math.random()*15,
      color, size: 2+Math.random()*3
    });
  }
}

function draw() {
  // Cosmic background
  const g = ctx.createRadialGradient(W/2, H/2, 50, W/2, H/2, 500);
  g.addColorStop(0, '#12081f');
  g.addColorStop(1, '#05030c');
  ctx.fillStyle = g;
  ctx.fillRect(0,0,W,H);

  // Stars
  ctx.fillStyle = '#e0d4ff';
  for (let i=0; i<60; i++) {
    const sx = (i*97) % W, sy = (i*53) % H;
    ctx.globalAlpha = 0.3 + (i%3)*0.2;
    ctx.fillRect(sx, sy, 1.5, 1.5);
  }
  ctx.globalAlpha = 1;

  // Rocks
  rocks.forEach(r => {
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.rotate(r.angle);
    ctx.strokeStyle = '#a78bfa';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#7c3aed';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    r.points.forEach((p, i) => {
      if (i===0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
    ctx.shadowBlur = 0;
  });

  // Ghosts
  ghosts.forEach(g => {
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.rotate(g.angle);
    ctx.fillStyle = '#67e8f9';
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 14;
    // ghost ship
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-10, -9);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-10, 9);
    ctx.closePath();
    ctx.fill();
    // glow core
    ctx.fillStyle = '#e0f2fe';
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
    ctx.shadowBlur = 0;
  });

  // Crystals
  crystals.forEach(c => {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(Date.now()*0.003);
    ctx.fillStyle = '#e879f9';
    ctx.shadowColor = '#e879f9';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(0, -8); ctx.lineTo(6, 0); ctx.lineTo(0, 8); ctx.lineTo(-6, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.shadowBlur = 0;
  });

  // Bullets
  bullets.forEach(b => {
    ctx.fillStyle = b.fromGhost ? '#f87171' : '#00ffaa';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, Math.PI*2);
    ctx.fill();
  });
  ctx.shadowBlur = 0;

  // Ship
  if (ship.invuln <= 0 || Math.floor(ship.invuln/3)%2===0) {
    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.rotate(ship.angle);
    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#c084fc';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-10, -9);
    ctx.lineTo(-5, 0);
    ctx.lineTo(-10, 9);
    ctx.closePath();
    ctx.stroke();
    if (ship.thrust) {
      ctx.fillStyle = '#f0abfc';
      ctx.beginPath();
      ctx.moveTo(-10, -5);
      ctx.lineTo(-18 - Math.random()*4, 0);
      ctx.lineTo(-10, 5);
      ctx.fill();
    }
    ctx.restore();
    ctx.shadowBlur = 0;
  }

  // Particles
  particles.forEach(p => {
    ctx.globalAlpha = p.life / 30;
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
}

// Create the ship immediately so the first draw() has data
// (previously ship was undefined until Start, crashing the loop on frame one)
resetShip();

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}
loop();
console.log('Spectral Manor Crystal Dimension ready');
