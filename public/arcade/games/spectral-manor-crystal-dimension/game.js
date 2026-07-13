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
function noiseBlast(dur, vol, cutoff) {
  if (!audioCtx) return;
  const len = Math.floor(audioCtx.sampleRate * dur);
  const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const n = audioCtx.createBufferSource();
  n.buffer = buf;
  const lp = audioCtx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(cutoff, audioCtx.currentTime);
  lp.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + dur);
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(vol, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
  n.connect(lp); lp.connect(g); g.connect(audioCtx.destination);
  n.start();
}
const sfx = {
  shoot: () => tone(900, 0.05, 'square', 0.04, -400),
  // shattering crystal — noise crack + glassy ring + low thump
  boom:  () => {
    noiseBlast(0.3, 0.11, 2400);
    tone(90, 0.22, 'sine', 0.09, -50);
    tone(1400, 0.12, 'triangle', 0.035, -600);
    setTimeout(() => tone(1800, 0.1, 'sine', 0.02, -800), 40);
  },
  // ship kill — bigger, deeper
  bigBoom: () => {
    noiseBlast(0.45, 0.13, 1600);
    tone(70, 0.35, 'sine', 0.1, -40);
    tone(200, 0.2, 'sawtooth', 0.05, -140);
  },
  hurt:  () => { noiseBlast(0.4, 0.1, 900); tone(100, 0.3, 'sawtooth', 0.07, -60); },
  // hero destroyed — huge layered detonation
  shipDeath: () => {
    noiseBlast(0.7, 0.16, 2000);
    noiseBlast(0.5, 0.12, 600);
    tone(60, 0.6, 'sine', 0.13, -30);
    tone(180, 0.4, 'sawtooth', 0.07, -140);
    setTimeout(() => { noiseBlast(0.4, 0.09, 400); tone(45, 0.5, 'sine', 0.1, -20); }, 120);
  },
  crystal: () => { tone(700,0.06); setTimeout(()=>tone(1000,0.08),50); },
  wave:  () => { tone(440,0.07); setTimeout(()=>tone(554,0.07),70); setTimeout(()=>tone(659,0.1),140); }
};

// ---------- Dramatic magical-dimension music (D-minor arpeggio + drone) ----------
let musicTimer = null, musicStep = 0;
// slow rolling arpeggio over a low pulsing drone
const arp = [293.66, 349.23, 440, 587.33, 440, 349.23,   // Dm
             311.13, 392, 466.16, 622.25, 466.16, 392];  // Ebm-ish shimmer
const drone = [73.42, 0, 0, 0, 0, 0, 77.78, 0, 0, 0, 0, 0];
function musicTick() {
  if (!gameRunning || deathFreeze > 0 || !audioCtx) return;
  const n = arp[musicStep % arp.length];
  // gentle bell-like arpeggio
  tone(n, 0.32, 'triangle', 0.03);
  tone(n * 2, 0.18, 'sine', 0.014);
  const d = drone[musicStep % drone.length];
  if (d) tone(d, 1.1, 'sawtooth', 0.035, 4);
  musicStep++;
}
function startMusic() { if (!musicTimer) musicTimer = setInterval(musicTick, 240); }

let score=0, lives=3, wave=1;
let gameRunning=false, gameOver=false;
let keys = {};
let ship, bullets=[], rocks=[], ghosts=[], crystals=[], particles=[], shockwaves=[];
let deathFreeze = 0; // brief slow-mo after the hero dies

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
  // hexagonal crystal — slightly irregular hex outline, pseudo-3D facets
  const points = [];
  const baseRad = size * 13;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const rad = baseRad * (0.88 + Math.random() * 0.24);
    points.push({ x: Math.cos(a) * rad, y: Math.sin(a) * rad });
  }
  return {
    x, y, size,
    vx: (Math.random()-0.5) * (1.2 + (4-size)*0.6),
    vy: (Math.random()-0.5) * (1.2 + (4-size)*0.6),
    angle: Math.random() * Math.PI * 2,
    spin: (Math.random()-0.5)*0.04,
    points, r: size * 14,
    hue: Math.random() < 0.5 ? 'purple' : 'pink',
    shimmer: Math.random() * Math.PI * 2
  };
}

function startGame() {
  score=0; lives=3; wave=1;
  bullets=[]; particles=[]; shockwaves=[]; deathFreeze=0;
  resetShip();
  spawnWave();
  gameRunning=true; gameOver=false;
  document.getElementById('startOverlay').classList.add('hidden');
  startMusic();
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

  // Shockwave rings expand + fade (also during the death slow-mo)
  shockwaves.forEach(s => { s.r += (s.max - s.r) * 0.12; s.life--; });
  shockwaves = shockwaves.filter(s => s.life > 0);

  // Slow-mo beat right after the hero explodes — let the blast land
  if (deathFreeze > 0) {
    deathFreeze--;
    particles.forEach(p => { p.x += p.vx * 0.3; p.y += p.vy * 0.3; p.life--; });
    particles = particles.filter(p => p.life > 0);
    return;
  }

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
      if (wave >= 4 && Math.random() < 0.35) {
        // 5-way spectral fan
        for (let s = -2; s <= 2; s++) {
          bullets.push({
            x: g.x, y: g.y,
            vx: Math.cos(g.angle + s * 0.22) * 4.6,
            vy: Math.sin(g.angle + s * 0.22) * 4.6,
            life: 75, fromGhost: true
          });
        }
      } else if (wave >= 2) {
        // 3-shot burst, staggered
        for (let s = 0; s < 3; s++) {
          setTimeout(() => {
            if (!gameRunning) return;
            const a = Math.atan2(ship.y - g.y, ship.x - g.x);
            bullets.push({
              x: g.x, y: g.y,
              vx: Math.cos(a) * 5.2, vy: Math.sin(a) * 5.2,
              life: 70, fromGhost: true
            });
          }, s * 130);
        }
      } else {
        bullets.push({
          x: g.x, y: g.y,
          vx: Math.cos(g.angle)*5, vy: Math.sin(g.angle)*5,
          life: 70, fromGhost: true
        });
      }
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
        sfx.bigBoom();
        explode(g.x, g.y, '#67e8f9', 22);
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
  sfx.shipDeath();
  // dramatic multi-color blast: white core, pink debris, cyan sparks
  explode(ship.x, ship.y, '#ffffff', 18);
  explode(ship.x, ship.y, '#f472b6', 26);
  explode(ship.x, ship.y, '#67e8f9', 18);
  shockwaves.push({ x: ship.x, y: ship.y, r: 6, max: 220, life: 40, maxLife: 40 });
  deathFreeze = 18; // short slow-mo beat
  resetShip();
  ship.invuln = 140; // longer breather after such a big death
  updateHUD();
  if (lives <= 0) {
    gameOver = true; gameRunning = false;
    const finalScore = score;
    Arcade.submitFlow(finalScore, () => {
      document.getElementById('startOverlay').classList.remove('hidden');
      document.getElementById('startOverlay').innerHTML = `
        <h2>DIMENSION COLLAPSED</h2>
        <p>Score: ${finalScore}</p>
        <p style="margin-top:0.8rem; color:#a78bfa; font-size:0.8rem; letter-spacing:1px">TOP PILOTS</p>
        ${Arcade.boardHTML(Arcade.slug)}
        <p style="margin-top:0.8rem; opacity:0.8">Click or SPACE to try again</p>
      `;
    });
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
  const now = Date.now();

  // ===== Magical dimension background =====
  // deep void
  const g = ctx.createRadialGradient(W/2, H/2, 50, W/2, H/2, 560);
  g.addColorStop(0, '#160a26');
  g.addColorStop(0.6, '#0c0518');
  g.addColorStop(1, '#04020a');
  ctx.fillStyle = g;
  ctx.fillRect(0,0,W,H);

  // drifting nebula blobs
  for (let i = 0; i < 3; i++) {
    const nx = W/2 + Math.sin(now * 0.00005 + i * 2.1) * 300;
    const ny = H/2 + Math.cos(now * 0.00004 + i * 1.7) * 160;
    const ng = ctx.createRadialGradient(nx, ny, 10, nx, ny, 220);
    ng.addColorStop(0, ['rgba(124,58,237,0.10)','rgba(232,121,249,0.07)','rgba(34,211,238,0.06)'][i]);
    ng.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = ng;
    ctx.fillRect(0, 0, W, H);
  }

  // aurora bands rippling across the dimension
  for (let band = 0; band < 2; band++) {
    ctx.beginPath();
    for (let x = 0; x <= W; x += 20) {
      const y = H * (0.25 + band * 0.5)
        + Math.sin(x * 0.008 + now * 0.0004 + band * 3) * 40
        + Math.sin(x * 0.02 + now * 0.0007) * 12;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = band === 0 ? 'rgba(232,121,249,0.12)' : 'rgba(103,232,249,0.10)';
    ctx.lineWidth = 26;
    ctx.stroke();
  }

  // twinkling stars
  for (let i=0; i<70; i++) {
    const sx = (i*97) % W, sy = (i*53) % H;
    ctx.globalAlpha = 0.25 + Math.abs(Math.sin(now * 0.001 + i)) * 0.4;
    ctx.fillStyle = i % 5 === 0 ? '#f0abfc' : '#e0d4ff';
    ctx.fillRect(sx, sy, i % 7 === 0 ? 2 : 1.4, i % 7 === 0 ? 2 : 1.4);
  }
  ctx.globalAlpha = 1;

  // faint floating runes, slowly orbiting
  ctx.strokeStyle = 'rgba(192,132,252,0.15)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 5; i++) {
    const rx = W/2 + Math.cos(now * 0.00008 + i * 1.26) * (250 + i * 40);
    const ry = H/2 + Math.sin(now * 0.00008 + i * 1.26) * (140 + i * 22);
    ctx.save();
    ctx.translate(rx, ry);
    ctx.rotate(now * 0.0003 + i);
    ctx.strokeRect(-5, -5, 10, 10);
    ctx.beginPath();
    ctx.moveTo(-5, -5); ctx.lineTo(5, 5);
    ctx.stroke();
    ctx.restore();
  }

  // ===== Crusher crystals — pseudo-3D hexagonal prisms =====
  rocks.forEach(r => {
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.rotate(r.angle);
    const main = r.hue === 'purple' ? '#a78bfa' : '#f0abfc';
    const deep = r.hue === 'purple' ? 'rgba(124,58,237,0.30)' : 'rgba(232,121,249,0.25)';
    const glow = 0.6 + Math.sin(now * 0.003 + r.shimmer) * 0.3;

    // translucent body
    ctx.fillStyle = deep;
    ctx.beginPath();
    r.points.forEach((p, i) => {
      if (i===0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.fill();

    // outer edge
    ctx.strokeStyle = main;
    ctx.lineWidth = 2;
    ctx.shadowColor = main;
    ctx.shadowBlur = 10 * glow;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // top face — smaller offset hexagon (the 3D read)
    ctx.beginPath();
    r.points.forEach((p, i) => {
      const fx = p.x * 0.55 - r.r * 0.1;
      const fy = p.y * 0.55 - r.r * 0.14;
      if (i===0) ctx.moveTo(fx, fy); else ctx.lineTo(fx, fy);
    });
    ctx.closePath();
    ctx.strokeStyle = `rgba(233,213,255,${0.5 * glow + 0.2})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // facet lines connecting the two faces
    ctx.beginPath();
    r.points.forEach((p, i) => {
      if (i % 2 === 0) {
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x * 0.55 - r.r * 0.1, p.y * 0.55 - r.r * 0.14);
      }
    });
    ctx.strokeStyle = `rgba(216,180,254,${0.35 * glow + 0.1})`;
    ctx.lineWidth = 1;
    ctx.stroke();

    // bright core glint
    ctx.fillStyle = `rgba(245,208,254,${glow * 0.5})`;
    ctx.beginPath();
    ctx.arc(-r.r * 0.15, -r.r * 0.2, r.size * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // ===== Spectral hunter ships (clearly not the hero) =====
  ghosts.forEach(g => {
    ctx.save();
    ctx.translate(g.x, g.y);
    // trailing shroud behind the saucer
    ctx.rotate(g.angle);
    ctx.fillStyle = 'rgba(34,211,238,0.15)';
    ctx.beginPath();
    ctx.moveTo(-8, -7);
    ctx.quadraticCurveTo(-26, 0, -8, 7);
    ctx.closePath();
    ctx.fill();
    ctx.rotate(-g.angle);
    // saucer hull
    ctx.fillStyle = '#155e75';
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.ellipse(0, 2, 15, 6.5, 0, 0, Math.PI*2);
    ctx.fill();
    // rim lights
    ctx.fillStyle = Math.floor(now / 200) % 2 === 0 ? '#67e8f9' : '#0e7490';
    [-10, 0, 10].forEach(dx => {
      ctx.beginPath(); ctx.arc(dx, 4, 1.8, 0, Math.PI*2); ctx.fill();
    });
    // dome with a wisp inside
    ctx.fillStyle = 'rgba(103,232,249,0.4)';
    ctx.beginPath();
    ctx.arc(0, -2, 7, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#e0f2fe';
    ctx.globalAlpha = 0.7 + Math.sin(now * 0.008 + g.x) * 0.3;
    ctx.beginPath();
    ctx.arc(0, -4, 3, 0, Math.PI*2);
    ctx.fill();
    ctx.globalAlpha = 1;
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

  // Shockwaves (expanding rings from big explosions)
  shockwaves.forEach(s => {
    const a = s.life / s.maxLife;
    ctx.strokeStyle = `rgba(255,255,255,${a * 0.7})`;
    ctx.lineWidth = 3 * a + 1;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(244,114,182,${a * 0.5})`;
    ctx.lineWidth = 6 * a + 1;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r * 0.8, 0, Math.PI * 2);
    ctx.stroke();
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

  // Hero ship — angular purple fighter with glowing cockpit and fins
  if (ship.invuln <= 0 || Math.floor(ship.invuln/3)%2===0) {
    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.rotate(ship.angle);
    ctx.shadowColor = '#c084fc';
    ctx.shadowBlur = 14;
    // back-swept wings first (behind the hull)
    ctx.fillStyle = '#6d28d9';
    ctx.beginPath();
    ctx.moveTo(2, -3); ctx.lineTo(-16, -14); ctx.lineTo(-6, -4);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(2, 3); ctx.lineTo(-16, 14); ctx.lineTo(-6, 4);
    ctx.closePath(); ctx.fill();
    // sleek dart hull with a long nose + notched tail (gradient)
    const hull = ctx.createLinearGradient(-12, 0, 20, 0);
    hull.addColorStop(0, '#4c1d95');
    hull.addColorStop(0.6, '#7c3aed');
    hull.addColorStop(1, '#d8b4fe');
    ctx.fillStyle = hull;
    ctx.beginPath();
    ctx.moveTo(20, 0);      // sharp nose
    ctx.lineTo(4, -4);
    ctx.lineTo(-8, -5);
    ctx.lineTo(-11, -2);    // tail notch
    ctx.lineTo(-7, 0);
    ctx.lineTo(-11, 2);
    ctx.lineTo(-8, 5);
    ctx.lineTo(4, 4);
    ctx.closePath();
    ctx.fill();
    // bright nose highlight
    ctx.strokeStyle = '#f5f3ff';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(20, 0); ctx.lineTo(4, -4);
    ctx.moveTo(20, 0); ctx.lineTo(4, 4);
    ctx.stroke();
    // glowing cockpit
    ctx.fillStyle = '#67e8f9';
    ctx.shadowColor = '#67e8f9';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.ellipse(6, 0, 3.5, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
    // engine flame
    if (ship.thrust) {
      ctx.fillStyle = '#f0abfc';
      ctx.shadowColor = '#f0abfc';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(-10, -3);
      ctx.lineTo(-20 - Math.random()*6, 0);
      ctx.lineTo(-10, 3);
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
