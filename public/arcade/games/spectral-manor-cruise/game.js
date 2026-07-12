// ============================================================
// SPECTRAL MANOR CRUISE
// Pseudo-3D night racer · Haunted highway · 4 monster racers
// Ghost Circuit / Plumbmonkey Media
// ============================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

// ---------- Audio ----------
let audioCtx = null;
let engineOsc = null, engineGain = null;
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    engineOsc = audioCtx.createOscillator();
    engineGain = audioCtx.createGain();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 50;
    engineGain.gain.value = 0;
    const lp = audioCtx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 400;
    engineOsc.connect(lp); lp.connect(engineGain); engineGain.connect(audioCtx.destination);
    engineOsc.start();
  }
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
  beep:  () => tone(440, 0.12, 'square', 0.06),
  go:    () => tone(880, 0.25, 'square', 0.07),
  crash: () => { tone(110, 0.2, 'sawtooth', 0.08, -60); tone(70, 0.3, 'triangle', 0.06); },
  pass:  () => tone(600, 0.1, 'triangle', 0.04, 300),
  lap:   () => { tone(523, 0.08); setTimeout(() => tone(659, 0.08), 80); setTimeout(() => tone(784, 0.14), 160); },
  win:   () => { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.15, 'square', 0.07), i * 130)); },
  lose:  () => { tone(300, 0.25, 'sawtooth', 0.06, -80); setTimeout(() => tone(200, 0.35, 'sawtooth', 0.06, -60), 220); }
};

// ---------- Road geometry ----------
const SEG_LEN = 200;
const ROAD_W = 2200;
const CAM_H = 1050;
const CAM_DEPTH = 0.84;        // 1 / tan(fov/2)
const DRAW_DIST = 140;         // segments
const LAPS = 3;

let segments = [];
function addRoad(count, curve) {
  for (let i = 0; i < count; i++) {
    segments.push({ curve, sprites: [] });
  }
}
function buildTrack() {
  segments = [];
  addRoad(90, 0);
  addRoad(80, 2.2);
  addRoad(60, 0);
  addRoad(90, -3);
  addRoad(50, 0);
  addRoad(60, 1.6);
  addRoad(60, -1.6);
  addRoad(80, 0);
  addRoad(110, 3.4);
  addRoad(60, 0);
  addRoad(70, -2.4);
  addRoad(50, 1.8);
  addRoad(60, 0);
  addRoad(80, -2.8);
  addRoad(70, 0);
  // roadside scenery: dead trees & tombstones
  for (let i = 0; i < segments.length; i += 4) {
    if (Math.random() < 0.65) {
      const side = Math.random() < 0.5 ? -1 : 1;
      segments[i].sprites.push({
        type: Math.random() < 0.6 ? 'tree' : 'grave',
        offset: side * (1.4 + Math.random() * 1.6)
      });
    }
  }
  // start banner
  segments[2].sprites.push({ type: 'banner', offset: 0 });
}
buildTrack();
const TRACK_LEN = segments.length * SEG_LEN;

// ---------- Racers ----------
const player = {
  pos: 0,            // z along track
  x: 0,              // -1..1 across road
  speed: 0,
  maxSpeed: 11800,
  lap: 1,
  totalZ: 0,
  finished: false
};
const opponentDefs = [
  { name: 'Vampire',  color: '#ef4444', trim: '#7f1d1d', speed: 10400, x: -0.5 },
  { name: 'Werewolf', color: '#a8a29e', trim: '#44403c', speed: 10000, x:  0.5 },
  { name: 'Witch',    color: '#a855f7', trim: '#581c87', speed: 9600,  x: -0.2 },
  { name: 'Frank',    color: '#4ade80', trim: '#14532d', speed: 9100,  x:  0.3 }
];
let opponents = [];
function resetRacers() {
  player.pos = 0; player.x = 0; player.speed = 0;
  player.lap = 1; player.totalZ = 0; player.finished = false;
  opponents = opponentDefs.map((d, i) => ({
    ...d,
    totalZ: (i + 1) * SEG_LEN * 3,  // staggered grid ahead of player
    wobble: Math.random() * Math.PI * 2,
    passed: false
  }));
}

// ---------- State ----------
let gameRunning = false, raceOver = false;
let countdown = 0;               // frames remaining in 3-2-1
let raceTime = 0;                // frames
let keys = {};
let shake = 0;

window.addEventListener('keydown', e => {
  initAudio();
  keys[e.code] = true;
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
  if ((e.code === 'Space' || e.code === 'Enter') && !gameRunning) startRace();
});
window.addEventListener('keyup', e => keys[e.code] = false);
document.getElementById('startOverlay').addEventListener('click', () => {
  initAudio();
  if (!gameRunning) startRace();
});

function startRace() {
  resetRacers();
  raceTime = 0;
  countdown = 180;
  gameRunning = true; raceOver = false;
  document.getElementById('startOverlay').classList.add('hidden');
  sfx.beep();
  setTimeout(sfx.beep, 1000);
  setTimeout(sfx.beep, 2000);
  setTimeout(sfx.go, 3000);
  updateHUD();
}

function finishRace() {
  player.finished = true;
  raceOver = true; gameRunning = false;
  const place = racePosition();
  (place === 1 ? sfx.win : sfx.lose)();
  const mins = Math.floor(raceTime / 3600);
  const secs = ((raceTime % 3600) / 60).toFixed(1);
  const medal = ['🏆', '🥈', '🥉', '💀', '💀'][place - 1];
  document.getElementById('startOverlay').classList.remove('hidden');
  document.getElementById('startOverlay').innerHTML = `
    <h2>${place === 1 ? 'YOU WIN THE CRUISE' : 'RACE COMPLETE'}</h2>
    <p style="font-size:2rem; margin:0.4rem 0">${medal} ${ordinal(place)} PLACE</p>
    <p>Time: ${mins}:${secs.padStart(4, '0')}</p>
    <p style="margin-top:0.8rem; opacity:0.8">Click or SPACE to race again</p>
  `;
}

function ordinal(n) { return n + (['st','nd','rd'][n - 1] || 'th'); }

function racePosition() {
  let ahead = 0;
  opponents.forEach(o => { if (o.totalZ > player.totalZ) ahead++; });
  return ahead + 1;
}

function segAt(z) {
  return segments[Math.floor(z / SEG_LEN) % segments.length];
}

// ---------- Update ----------
function update() {
  if (!gameRunning) {
    if (engineGain) engineGain.gain.value = 0;
    return;
  }
  raceTime++;

  const dt = 1 / 60;
  const canDrive = countdown <= 0;
  if (countdown > 0) countdown--;

  // Throttle / brake
  if (canDrive && (keys['ArrowUp'] || keys['KeyW'])) {
    player.speed += 90;
  } else if (keys['ArrowDown'] || keys['KeyS']) {
    player.speed -= 180;
  } else {
    player.speed -= 35; // coast
  }

  // Off-road drag
  if (Math.abs(player.x) > 1.05) {
    player.speed -= 140;
    if (Math.random() < 0.3) shake = Math.max(shake, 3);
  }
  player.speed = Math.max(0, Math.min(player.maxSpeed, player.speed));

  // Steering + centrifugal pull from curves
  const speedRatio = player.speed / player.maxSpeed;
  const steer = 0.028 * (0.4 + speedRatio);
  if (keys['ArrowLeft'] || keys['KeyA']) player.x -= steer;
  if (keys['ArrowRight'] || keys['KeyD']) player.x += steer;
  const seg = segAt(player.pos);
  player.x -= seg.curve * 0.00135 * speedRatio * speedRatio * 10;
  player.x = Math.max(-1.6, Math.min(1.6, player.x));

  // Advance
  const dz = player.speed * dt;
  player.pos += dz;
  player.totalZ += dz;
  if (player.pos >= TRACK_LEN) {
    player.pos -= TRACK_LEN;
    if (player.lap >= LAPS) { finishRace(); return; }
    player.lap++;
    sfx.lap();
  }

  // Opponents
  opponents.forEach(o => {
    o.wobble += 0.015;
    const oz = (0.92 + 0.12 * Math.sin(o.wobble)) * o.speed * dt;
    o.totalZ += oz;
    o.x += Math.sin(o.wobble * 1.7) * 0.002; // gentle lane drift
    o.x = Math.max(-0.8, Math.min(0.8, o.x));

    // relative distance to player (on-track)
    const rel = o.totalZ - player.totalZ;

    // overtake chime
    if (!o.passed && rel < -SEG_LEN) { o.passed = true; sfx.pass(); }
    if (o.passed && rel > SEG_LEN) o.passed = false;

    // collision — bump if overlapping
    if (Math.abs(rel) < SEG_LEN * 0.7 && Math.abs(o.x - player.x) < 0.28) {
      player.speed = Math.min(player.speed, o.speed * 0.55);
      player.x += (player.x > o.x ? 1 : -1) * 0.06;
      shake = 8;
      sfx.crash();
    }
  });

  if (shake > 0) shake *= 0.85;

  // Engine sound
  if (engineOsc && audioCtx && audioCtx.state === 'running') {
    engineOsc.frequency.value = 45 + speedRatio * 130 + Math.random() * 6;
    engineGain.gain.value = 0.02 + speedRatio * 0.035;
  }

  updateHUD();
}

// ---------- Projection ----------
function project(worldX, worldZ, camX) {
  const scale = CAM_DEPTH / worldZ;
  return {
    x: W / 2 + scale * (worldX - camX) * (W / 2),
    y: H / 2 + scale * CAM_H * (H / 2),
    w: scale * ROAD_W * (W / 2),
    scale
  };
}

// ---------- Draw ----------
function drawBackground(curveOffset) {
  // Night sky
  const g = ctx.createLinearGradient(0, 0, 0, H / 2);
  g.addColorStop(0, '#0b0518');
  g.addColorStop(1, '#1c0f33');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H / 2 + 20);

  // Stars (fixed pattern, drift slightly opposite of curve)
  ctx.fillStyle = '#e0d4ff';
  for (let i = 0; i < 70; i++) {
    const sx = ((i * 137 - curveOffset * 0.1) % W + W) % W;
    const sy = (i * 61) % (H / 2 - 30);
    ctx.globalAlpha = 0.25 + (i % 4) * 0.15;
    ctx.fillRect(sx, sy, 1.5, 1.5);
  }
  ctx.globalAlpha = 1;

  // Moon
  ctx.fillStyle = '#f5f0ff';
  ctx.shadowColor = '#c084fc';
  ctx.shadowBlur = 30;
  ctx.beginPath();
  ctx.arc(((W - 160 - curveOffset * 0.15) % W + W) % W, 80, 36, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Distant manor silhouette
  const mx = ((W / 2 - curveOffset * 0.3) % W + W) % W - 120;
  ctx.fillStyle = '#120a20';
  ctx.fillRect(mx, H / 2 - 70, 240, 70);
  ctx.beginPath();
  ctx.moveTo(mx - 10, H / 2 - 70); ctx.lineTo(mx + 50, H / 2 - 115); ctx.lineTo(mx + 110, H / 2 - 70);
  ctx.fill();
  ctx.fillRect(mx + 150, H / 2 - 130, 34, 130);
  ctx.beginPath();
  ctx.moveTo(mx + 143, H / 2 - 130); ctx.lineTo(mx + 167, H / 2 - 158); ctx.lineTo(mx + 191, H / 2 - 130);
  ctx.fill();
  // lit windows
  ctx.fillStyle = 'rgba(232,121,249,0.7)';
  ctx.fillRect(mx + 30, H / 2 - 55, 8, 12);
  ctx.fillRect(mx + 90, H / 2 - 50, 8, 12);
  ctx.fillRect(mx + 160, H / 2 - 110, 7, 10);
}

function drawSprite(type, x, y, scale) {
  const s = scale * 9000; // world→pixel sprite size factor
  if (s < 3) return;
  ctx.save();
  ctx.translate(x, y);
  if (type === 'tree') {
    ctx.strokeStyle = '#2d1a4a';
    ctx.lineWidth = Math.max(1.5, s * 0.07);
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(0, -s * 0.9);
    ctx.moveTo(0, -s * 0.45); ctx.lineTo(-s * 0.3, -s * 0.72);
    ctx.moveTo(0, -s * 0.55); ctx.lineTo(s * 0.32, -s * 0.85);
    ctx.moveTo(0, -s * 0.3); ctx.lineTo(s * 0.22, -s * 0.45);
    ctx.stroke();
  } else if (type === 'grave') {
    ctx.fillStyle = '#3f3356';
    ctx.beginPath();
    ctx.moveTo(-s * 0.18, 0);
    ctx.lineTo(-s * 0.18, -s * 0.3);
    ctx.arc(0, -s * 0.3, s * 0.18, Math.PI, 0);
    ctx.lineTo(s * 0.18, 0);
    ctx.closePath();
    ctx.fill();
  } else if (type === 'banner') {
    ctx.strokeStyle = '#7c3aed';
    ctx.lineWidth = Math.max(2, s * 0.04);
    ctx.beginPath();
    ctx.moveTo(-s * 0.75, 0); ctx.lineTo(-s * 0.75, -s * 0.5);
    ctx.moveTo(s * 0.75, 0); ctx.lineTo(s * 0.75, -s * 0.5);
    ctx.stroke();
    ctx.fillStyle = '#c084fc';
    ctx.fillRect(-s * 0.78, -s * 0.62, s * 1.56, s * 0.14);
    if (s > 40) {
      ctx.fillStyle = '#0f0a1a';
      ctx.font = `bold ${s * 0.09}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('SPECTRAL MANOR CRUISE', 0, -s * 0.52);
    }
  }
  ctx.restore();
}

function drawCar(x, y, scale, color, trim, name) {
  const s = scale * 7000;
  if (s < 2) return;
  const cw = s * 0.9, ch = s * 0.5;
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  // body
  ctx.fillStyle = color;
  ctx.fillRect(-cw / 2, -ch, cw, ch * 0.8);
  // roof
  ctx.fillStyle = trim;
  ctx.fillRect(-cw * 0.3, -ch * 1.35, cw * 0.6, ch * 0.45);
  ctx.shadowBlur = 0;
  // tail lights
  ctx.fillStyle = '#ff5555';
  ctx.fillRect(-cw / 2 + 1, -ch * 0.85, cw * 0.16, ch * 0.16);
  ctx.fillRect(cw / 2 - 1 - cw * 0.16, -ch * 0.85, cw * 0.16, ch * 0.16);
  // wheels
  ctx.fillStyle = '#111';
  ctx.fillRect(-cw / 2 - cw * 0.05, -ch * 0.25, cw * 0.16, ch * 0.3);
  ctx.fillRect(cw / 2 - cw * 0.11, -ch * 0.25, cw * 0.16, ch * 0.3);
  // name tag
  if (s > 26) {
    ctx.fillStyle = '#e0d4ff';
    ctx.font = `${Math.max(9, s * 0.11)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(name, 0, -ch * 1.55);
  }
  ctx.restore();
}

let bgCurveOffset = 0;

function draw() {
  ctx.save();
  if (shake > 0.5) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

  const baseIdx = Math.floor(player.pos / SEG_LEN);
  const basePct = (player.pos % SEG_LEN) / SEG_LEN;
  bgCurveOffset += segAt(player.pos).curve * (player.speed / player.maxSpeed) * 1.4;

  drawBackground(bgCurveOffset);

  // Ground below horizon
  ctx.fillStyle = '#0d081a';
  ctx.fillRect(0, H / 2, W, H / 2);

  const camX = player.x * ROAD_W * 0.9;
  let x = 0, dx = -(segments[baseIdx % segments.length].curve * basePct);
  let prev = null;
  const spriteQueue = [];

  for (let n = 0; n < DRAW_DIST; n++) {
    const idx = (baseIdx + n) % segments.length;
    const seg = segments[idx];
    const segZ = (n + 1) * SEG_LEN - basePct * SEG_LEN;
    if (segZ <= 0) { x += dx; dx += seg.curve; continue; }

    const p = project(x, segZ, camX);
    x += dx;
    dx += seg.curve;

    if (prev && p.y < prev.y && p.y >= H / 2 - 2) {
      const light = (idx % 6) < 3;
      // grass strips
      ctx.fillStyle = light ? '#0f0a1e' : '#0c0716';
      ctx.fillRect(0, p.y, W, prev.y - p.y + 1);
      // road
      ctx.fillStyle = light ? '#241a38' : '#1e1530';
      quad(prev.x - prev.w, prev.y, prev.x + prev.w, p.x - p.w, p.y, p.x + p.w);
      // rumble edges
      ctx.fillStyle = light ? '#7c3aed' : '#3b2660';
      quad(prev.x - prev.w, prev.y, prev.x - prev.w * 0.93, p.x - p.w, p.y, p.x - p.w * 0.93);
      quad(prev.x + prev.w * 0.93, prev.y, prev.x + prev.w, p.x + p.w * 0.93, p.y, p.x + p.w);
      // center dashes
      if (light) {
        ctx.fillStyle = '#c084fc';
        quad(prev.x - prev.w * 0.012, prev.y, prev.x + prev.w * 0.012, p.x - p.w * 0.012, p.y, p.x + p.w * 0.012);
      }
    }

    // queue roadside sprites (draw far→near afterwards)
    seg.sprites.forEach(sp => {
      spriteQueue.push({
        type: sp.type,
        x: p.x + sp.offset * p.w,
        y: p.y,
        scale: p.scale
      });
    });

    // queue opponent cars on this segment
    opponents.forEach(o => {
      const oTrack = ((o.totalZ % TRACK_LEN) + TRACK_LEN) % TRACK_LEN;
      const oIdx = Math.floor(oTrack / SEG_LEN) % segments.length;
      if (oIdx === idx) {
        spriteQueue.push({
          car: o,
          x: p.x + o.x * p.w,
          y: p.y,
          scale: p.scale
        });
      }
    });

    prev = p;
  }

  // sprites far → near
  for (let i = spriteQueue.length - 1; i >= 0; i--) {
    const sp = spriteQueue[i];
    if (sp.car) drawCar(sp.x, sp.y, sp.scale, sp.car.color, sp.car.trim, sp.car.name);
    else drawSprite(sp.type, sp.x, sp.y, sp.scale);
  }

  // ---------- Player car (fixed near bottom) ----------
  const px = W / 2;
  const py = H - 42;
  const tilt = (keys['ArrowLeft'] || keys['KeyA']) ? -1 : (keys['ArrowRight'] || keys['KeyD']) ? 1 : 0;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(tilt * 0.05);
  ctx.shadowColor = '#c084fc';
  ctx.shadowBlur = 18;
  // hearse-hot-rod body
  ctx.fillStyle = '#c084fc';
  ctx.fillRect(-46, -30, 92, 26);
  ctx.fillStyle = '#7c3aed';
  ctx.fillRect(-30, -46, 60, 18);
  ctx.shadowBlur = 0;
  // rear window
  ctx.fillStyle = '#e9d5ff';
  ctx.fillRect(-22, -43, 44, 12);
  // tail lights
  ctx.fillStyle = '#ff4444';
  ctx.shadowColor = '#ff4444';
  ctx.shadowBlur = 8;
  ctx.fillRect(-44, -26, 12, 7);
  ctx.fillRect(32, -26, 12, 7);
  ctx.shadowBlur = 0;
  // wheels
  ctx.fillStyle = '#111';
  ctx.fillRect(-52, -12, 16, 12);
  ctx.fillRect(36, -12, 16, 12);
  // exhaust flames when flooring it
  if ((keys['ArrowUp'] || keys['KeyW']) && player.speed > 200 && Math.random() < 0.6) {
    ctx.fillStyle = '#f0abfc';
    ctx.beginPath();
    ctx.moveTo(-50, -6); ctx.lineTo(-60 - Math.random() * 8, -3); ctx.lineTo(-50, 0);
    ctx.fill();
  }
  ctx.restore();

  // ---------- Countdown ----------
  if (gameRunning && countdown > 0) {
    const num = Math.ceil(countdown / 60);
    ctx.fillStyle = '#e879f9';
    ctx.shadowColor = '#e879f9';
    ctx.shadowBlur = 30;
    ctx.font = 'bold 110px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(num, W / 2, H / 2 - 40);
    ctx.shadowBlur = 0;
  } else if (gameRunning && countdown === 0 && raceTime < 260) {
    ctx.fillStyle = '#4ade80';
    ctx.shadowColor = '#4ade80';
    ctx.shadowBlur = 26;
    ctx.font = 'bold 90px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GO!', W / 2, H / 2 - 40);
    ctx.shadowBlur = 0;
  }

  ctx.restore();
}

function quad(x1, y1, x2, x3, y3, x4) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y1);
  ctx.lineTo(x4, y3);
  ctx.lineTo(x3, y3);
  ctx.closePath();
  ctx.fill();
}

function updateHUD() {
  document.getElementById('speed').textContent = Math.round(player.speed / player.maxSpeed * 120);
  document.getElementById('lap').textContent = Math.min(player.lap, LAPS) + '/' + LAPS;
  document.getElementById('place').textContent = ordinal(racePosition());
  const mins = Math.floor(raceTime / 3600);
  const secs = Math.floor((raceTime % 3600) / 60);
  document.getElementById('time').textContent = mins + ':' + String(secs).padStart(2, '0');
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}
loop();
console.log('Spectral Manor Cruise ready');
