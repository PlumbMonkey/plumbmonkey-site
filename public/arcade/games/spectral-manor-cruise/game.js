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
// Rivals never brake for curves, so their pace is tuned below a decent
// driver's LAP AVERAGE (~10800-11200), not below the 11800 top speed —
// drive clean and you out-run them; the rubber-band keeps them on screen
const opponentDefs = [
  { name: 'Vampire',  color: '#ef4444', trim: '#7f1d1d', speed: 9600, x: -0.5 },
  { name: 'Werewolf', color: '#a8a29e', trim: '#44403c', speed: 9300, x:  0.5 },
  { name: 'Witch',    color: '#a855f7', trim: '#581c87', speed: 9100, x: -0.2 },
  { name: 'Frank',    color: '#4ade80', trim: '#14532d', speed: 8900, x:  0.3 },
  { name: 'Ghost',    color: '#a5f3fc', trim: '#155e75', speed: 9450, x:  0.0, ghost: true }
];
let opponents = [];
let race = 1;          // race series — later races add speed and weapons
let cruiseScore = 0;   // cumulative run score (banked to the leaderboard on a loss)
let fireballs = [];    // opponent weapons (race 2+)
let scramble = 0;      // frames of haunted steering after a ghost passes through you

function resetRacers() {
  player.pos = 0; player.x = 0; player.speed = 0;
  player.lap = 1; player.totalZ = 0; player.finished = false;
  fireballs = []; scramble = 0;
  opponents = opponentDefs.map((d, i) => ({
    ...d,
    // rivals gain pace each race but cap below a good driver's lap average —
    // later races get tighter, never impossible
    speed: Math.min(d.speed + (race - 1) * 250, 11000),
    totalZ: (i + 1) * SEG_LEN * 3,      // staggered grid ahead of player
    wobble: Math.random() * Math.PI * 2,
    passed: false,
    fireTimer: 400 + Math.random() * 400,
    phasing: false,                      // ghost car overlap state
    boosting: false                      // rubber-band sprint state
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
  const medal = ['🏆', '🥈', '🥉', '💀', '💀', '💀'][place - 1];
  const won = place === 1;

  // score this race: placement + race bonus + a time bonus, accumulated over the run
  const placePts = [1500, 900, 600, 300, 150, 150][place - 1] || 100;
  const timeBonus = Math.max(0, Math.round((70 - raceTime / 60) * 10));
  cruiseScore += placePts + race * 400 + timeBonus;

  if (won) {
    race++;
    document.getElementById('startOverlay').classList.remove('hidden');
    document.getElementById('startOverlay').innerHTML = `
      <h2>YOU WIN THE CRUISE</h2>
      <p style="font-size:2rem; margin:0.4rem 0">${medal} ${ordinal(place)} PLACE</p>
      <p>Time: ${mins}:${secs.padStart(4, '0')}</p>
      <p>Run score: ${cruiseScore}</p>
      <p style="margin-top:0.4rem; color:#f0abfc">RACE ${race} unlocked — rivals are faster${race >= 2 ? ' and ARMED' : ''}</p>
      <p style="margin-top:0.8rem; opacity:0.8">Click or SPACE to keep the streak going</p>
    `;
  } else {
    // the run ends — bank the score to the leaderboard, then reset the streak
    const finalScore = cruiseScore;
    const reachedRace = race;
    const endRun = () => {
      document.getElementById('startOverlay').classList.remove('hidden');
      document.getElementById('startOverlay').innerHTML = `
        <h2>RUN OVER</h2>
        <p style="font-size:2rem; margin:0.4rem 0">${medal} ${ordinal(place)} PLACE</p>
        <p>Reached Race ${reachedRace} · Run score: ${finalScore}</p>
        <p style="margin-top:0.8rem; color:#a78bfa; font-size:0.8rem; letter-spacing:1px">TOP DRIVERS</p>
        ${Arcade.boardHTML(Arcade.slug)}
        <p style="margin-top:0.8rem; opacity:0.8">Click or SPACE for a fresh run from Race 1</p>
      `;
      race = 1; cruiseScore = 0; // fresh streak next time
    };
    Arcade.submitFlow(finalScore, endRun);
  }
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

  // Attract-mode autopilot (hub preview): floor it and steer through curves
  if (Arcade.attract) {
    keys = {};
    keys['ArrowUp'] = true;
    const seg = segAt(player.pos);
    if (seg.curve > 0.4 || player.x < -0.5) keys['ArrowRight'] = true;
    else if (seg.curve < -0.4 || player.x > 0.5) keys['ArrowLeft'] = true;
  }

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
  if (scramble > 0) {
    // a ghost passed through you — controls are haunted (reversed + jittery)
    scramble--;
    if (keys['ArrowLeft'] || keys['KeyA']) player.x += steer;
    if (keys['ArrowRight'] || keys['KeyD']) player.x -= steer;
    player.x += (Math.random() - 0.5) * 0.02;
  } else {
    if (keys['ArrowLeft'] || keys['KeyA']) player.x -= steer;
    if (keys['ArrowRight'] || keys['KeyD']) player.x += steer;
  }
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

  // Opponents — held at the grid until the lights go green, then they
  // rubber-band around the player so the pack stays on-screen and racy
  opponents.forEach(o => {
    o.wobble += 0.015;
    o.x += Math.sin(o.wobble * 1.7) * 0.002; // gentle lane drift
    o.x = Math.max(-0.8, Math.min(0.8, o.x));

    if (countdown > 0) return; // frozen on the starting grid

    // Keep the racing visible with a hysteresis boost: a rival that drops
    // >15 segments behind sprints (above your speed) until it has overtaken
    // you by 6 segments, then resumes natural pace — so stragglers blow past
    // into view instead of hovering just behind your bumper. Rivals that get
    // way ahead (player crashed a lot) ease off so you can claw back.
    const gap = o.totalZ - player.totalZ;            // + = ahead of player
    // final lap runs honest — no boost — so clean driving decides the finish
    if (player.lap >= LAPS) o.boosting = false;
    else if (gap < -SEG_LEN * 15) o.boosting = true;
    else if (gap > SEG_LEN * 6) o.boosting = false;
    let effSpeed = o.speed;
    if (o.boosting) {
      effSpeed = Math.max(o.speed, player.speed * 1.08 + 500);
    } else if (gap > SEG_LEN * 12) {
      // ahead of you: pace off YOUR current speed so they can't bank distance
      // while you brake for hairpins — they stay catchable
      effSpeed = Math.min(o.speed, Math.max(2000, player.speed * 0.92));
    }
    const oz = (0.97 + 0.05 * Math.sin(o.wobble)) * effSpeed * dt;
    o.totalZ += oz;

    // relative distance to player (on-track)
    const rel = o.totalZ - player.totalZ;

    // overtake chime
    if (!o.passed && rel < -SEG_LEN) { o.passed = true; sfx.pass(); }
    if (o.passed && rel > SEG_LEN) o.passed = false;

    // collision — ghosts phase through you and haunt your steering,
    // solid racers bump you hard
    if (Math.abs(rel) < SEG_LEN * 0.7 && Math.abs(o.x - player.x) < 0.28) {
      if (o.ghost) {
        if (!o.phasing) {
          o.phasing = true;
          scramble = 75; // ~1.25s of haunted controls
          shake = 5;
          sfx.pass();
          sfx.lose();
        }
      } else {
        player.speed = Math.min(player.speed, o.speed * 0.55);
        player.x += (player.x > o.x ? 1 : -1) * 0.06;
        shake = 8;
        sfx.crash();
      }
    } else if (o.ghost) {
      o.phasing = false;
    }

    // RACE 2+: rivals hurl fireballs at whoever is ahead of them
    if (race >= 2 && countdown <= 0) {
      o.fireTimer--;
      if (o.fireTimer <= 0) {
        // fire only when the player is ahead and within range
        const ahead = player.totalZ - o.totalZ;
        if (ahead > 0 && ahead < SEG_LEN * 30) {
          fireballs.push({
            totalZ: o.totalZ + SEG_LEN,
            x: o.x + (player.x - o.x) * 0.5, // lobbed toward your lane
            speed: o.speed * 1.5,
            life: 240,
            color: o.color
          });
        }
        o.fireTimer = 350 + Math.random() * 350;
      }
    }
  });

  // Fireballs fly down the track
  for (let fi = fireballs.length - 1; fi >= 0; fi--) {
    const f = fireballs[fi];
    f.totalZ += f.speed * dt;
    f.life--;
    if (f.life <= 0) { fireballs.splice(fi, 1); continue; }
    const rel = f.totalZ - player.totalZ;
    if (Math.abs(rel) < SEG_LEN * 0.6 && Math.abs(f.x - player.x) < 0.2) {
      fireballs.splice(fi, 1);
      player.speed *= 0.45;
      shake = 10;
      sfx.crash();
    }
  }

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

  // Three gothic silhouettes spaced along the horizon — a Victorian manor,
  // a ruined cathedral, and a crypt tower — drifting with the curves
  const span = W * 1.8;
  const base = H / 2;
  const win = 'rgba(232,121,249,0.7)';

  for (let bi = 0; bi < 3; bi++) {
    const bx = ((bi * span / 3 - curveOffset * 0.3) % span + span) % span - 200;
    if (bx < -260 || bx > W + 60) continue;
    ctx.fillStyle = '#120a20';

    if (bi === 0) {
      // Victorian manor with gable + spire tower
      ctx.fillRect(bx, base - 70, 240, 70);
      ctx.beginPath();
      ctx.moveTo(bx - 10, base - 70); ctx.lineTo(bx + 50, base - 115); ctx.lineTo(bx + 110, base - 70);
      ctx.fill();
      ctx.fillRect(bx + 150, base - 130, 34, 130);
      ctx.beginPath();
      ctx.moveTo(bx + 143, base - 130); ctx.lineTo(bx + 167, base - 158); ctx.lineTo(bx + 191, base - 130);
      ctx.fill();
      ctx.fillStyle = win;
      ctx.fillRect(bx + 30, base - 55, 8, 12);
      ctx.fillRect(bx + 90, base - 50, 8, 12);
      ctx.fillRect(bx + 160, base - 110, 7, 10);
    } else if (bi === 1) {
      // ruined cathedral — twin broken spires + pointed arch
      ctx.fillRect(bx, base - 85, 190, 85);
      ctx.beginPath(); // left spire (intact)
      ctx.moveTo(bx + 8, base - 85); ctx.lineTo(bx + 30, base - 150); ctx.lineTo(bx + 52, base - 85);
      ctx.fill();
      ctx.beginPath(); // right spire (broken, jagged)
      ctx.moveTo(bx + 138, base - 85); ctx.lineTo(bx + 146, base - 122);
      ctx.lineTo(bx + 156, base - 108); ctx.lineTo(bx + 166, base - 128); ctx.lineTo(bx + 182, base - 85);
      ctx.fill();
      // pointed-arch doorway cut-out
      ctx.fillStyle = '#07040f';
      ctx.beginPath();
      ctx.moveTo(bx + 80, base);
      ctx.lineTo(bx + 80, base - 40);
      ctx.quadraticCurveTo(bx + 95, base - 62, bx + 110, base - 40);
      ctx.lineTo(bx + 110, base);
      ctx.closePath(); ctx.fill();
      // rose window
      ctx.fillStyle = win;
      ctx.beginPath(); ctx.arc(bx + 95, base - 70, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(bx + 25, base - 70, 7, 14);
    } else {
      // crypt tower + mausoleum row with iron fence
      ctx.fillRect(bx + 20, base - 140, 46, 140);
      // crenellated top
      for (let c = 0; c < 4; c++) ctx.fillRect(bx + 20 + c * 13, base - 150, 8, 12);
      // mausoleums
      ctx.fillRect(bx + 90, base - 40, 60, 40);
      ctx.beginPath();
      ctx.moveTo(bx + 85, base - 40); ctx.lineTo(bx + 120, base - 60); ctx.lineTo(bx + 155, base - 40);
      ctx.fill();
      ctx.fillRect(bx + 170, base - 32, 48, 32);
      // iron fence posts
      for (let fpi = 0; fpi < 6; fpi++) {
        ctx.fillRect(bx + 90 + fpi * 26, base - 12, 2.5, 12);
      }
      ctx.fillStyle = win;
      ctx.fillRect(bx + 36, base - 120, 7, 10);
      ctx.fillRect(bx + 112, base - 28, 8, 10);
    }
  }
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

function drawCar(x, y, scale, o) {
  const s = scale * 7000;
  if (s < 2) return;
  const cw = s * 0.9, ch = s * 0.5;
  ctx.save();
  ctx.translate(x, y);
  if (o.ghost) ctx.globalAlpha = 0.55 + Math.sin(Date.now() * 0.006) * 0.15;
  ctx.shadowColor = o.color;
  ctx.shadowBlur = 10;
  // body
  ctx.fillStyle = o.color;
  ctx.fillRect(-cw / 2, -ch, cw, ch * 0.8);
  // roof
  ctx.fillStyle = o.trim;
  ctx.fillRect(-cw * 0.3, -ch * 1.35, cw * 0.6, ch * 0.45);
  ctx.shadowBlur = 0;
  // tail lights
  ctx.fillStyle = '#ff5555';
  ctx.fillRect(-cw / 2 + 1, -ch * 0.85, cw * 0.16, ch * 0.16);
  ctx.fillRect(cw / 2 - 1 - cw * 0.16, -ch * 0.85, cw * 0.16, ch * 0.16);
  // wheels (the ghost car hovers on wisps instead)
  if (o.ghost) {
    ctx.fillStyle = 'rgba(165,243,252,0.5)';
    ctx.beginPath();
    ctx.ellipse(-cw * 0.3, -ch * 0.05, cw * 0.14, ch * 0.12, 0, 0, Math.PI * 2);
    ctx.ellipse(cw * 0.3, -ch * 0.05, cw * 0.14, ch * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = '#111';
    ctx.fillRect(-cw / 2 - cw * 0.05, -ch * 0.25, cw * 0.16, ch * 0.3);
    ctx.fillRect(cw / 2 - cw * 0.11, -ch * 0.25, cw * 0.16, ch * 0.3);
  }

  // ---- monster head poking above the roof ----
  if (s > 12) {
    const hy = -ch * 1.5, hr = Math.max(3, s * 0.09);
    if (o.name === 'Frank') {
      ctx.fillStyle = '#86efac';
      ctx.fillRect(-hr, hy - hr * 1.6, hr * 2, hr * 1.7);
      ctx.fillStyle = '#166534';
      ctx.fillRect(-hr * 1.1, hy - hr * 1.9, hr * 2.2, hr * 0.5);
      if (s > 30) {
        ctx.fillStyle = '#a1a1aa';
        ctx.fillRect(-hr * 1.5, hy - hr * 0.7, hr * 0.5, hr * 0.5);
        ctx.fillRect(hr, hy - hr * 0.7, hr * 0.5, hr * 0.5);
      }
    } else if (o.name === 'Witch') {
      ctx.fillStyle = '#e9d5ff';
      ctx.beginPath(); ctx.arc(0, hy - hr * 0.4, hr * 0.9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4c1d95';
      ctx.beginPath();
      ctx.moveTo(0, hy - hr * 3);
      ctx.lineTo(-hr * 1.4, hy - hr);
      ctx.lineTo(hr * 1.4, hy - hr);
      ctx.closePath(); ctx.fill();
      ctx.fillRect(-hr * 1.7, hy - hr * 1.1, hr * 3.4, hr * 0.4);
    } else if (o.name === 'Vampire') {
      ctx.fillStyle = '#fce7f3';
      ctx.beginPath(); ctx.arc(0, hy - hr * 0.6, hr * 0.9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0f0a1a'; // slicked widow's peak
      ctx.beginPath();
      ctx.moveTo(-hr * 0.9, hy - hr * 1.1);
      ctx.lineTo(0, hy - hr * 0.6);
      ctx.lineTo(hr * 0.9, hy - hr * 1.1);
      ctx.lineTo(hr * 0.9, hy - hr * 1.5);
      ctx.lineTo(-hr * 0.9, hy - hr * 1.5);
      ctx.closePath(); ctx.fill();
      if (s > 30) {
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-hr * 0.5, hy - hr * 0.8, hr * 0.3, hr * 0.3);
        ctx.fillRect(hr * 0.2, hy - hr * 0.8, hr * 0.3, hr * 0.3);
      }
    } else if (o.name === 'Werewolf') {
      ctx.fillStyle = '#a8a29e';
      ctx.beginPath(); ctx.arc(0, hy - hr * 0.5, hr, 0, Math.PI * 2); ctx.fill();
      // ears
      ctx.beginPath();
      ctx.moveTo(-hr, hy - hr); ctx.lineTo(-hr * 0.6, hy - hr * 2.1); ctx.lineTo(-hr * 0.1, hy - hr * 1.1);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(hr, hy - hr); ctx.lineTo(hr * 0.6, hy - hr * 2.1); ctx.lineTo(hr * 0.1, hy - hr * 1.1);
      ctx.closePath(); ctx.fill();
      if (s > 30) {
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(-hr * 0.5, hy - hr * 0.7, hr * 0.35, hr * 0.25);
        ctx.fillRect(hr * 0.15, hy - hr * 0.7, hr * 0.35, hr * 0.25);
      }
    } else if (o.name === 'Ghost') {
      ctx.fillStyle = 'rgba(224,242,254,0.9)';
      ctx.beginPath();
      ctx.arc(0, hy - hr * 0.6, hr * 0.9, Math.PI, 0);
      ctx.lineTo(hr * 0.9, hy + hr * 0.3);
      ctx.quadraticCurveTo(hr * 0.4, hy, 0, hy + hr * 0.3);
      ctx.quadraticCurveTo(-hr * 0.4, hy, -hr * 0.9, hy + hr * 0.3);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#155e75';
      ctx.fillRect(-hr * 0.5, hy - hr * 0.8, hr * 0.3, hr * 0.4);
      ctx.fillRect(hr * 0.2, hy - hr * 0.8, hr * 0.3, hr * 0.4);
    }
  }

  // name tag
  if (s > 26) {
    ctx.fillStyle = '#e0d4ff';
    ctx.font = `${Math.max(9, s * 0.11)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(o.name, 0, -ch * 2.15);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
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

    // queue fireballs on this segment
    fireballs.forEach(f => {
      const fTrack = ((f.totalZ % TRACK_LEN) + TRACK_LEN) % TRACK_LEN;
      const fIdx = Math.floor(fTrack / SEG_LEN) % segments.length;
      if (fIdx === idx) {
        spriteQueue.push({
          fireball: f,
          x: p.x + f.x * p.w,
          y: p.y - p.scale * 3000,
          scale: p.scale
        });
      }
    });

    prev = p;
  }

  // sprites far → near
  for (let i = spriteQueue.length - 1; i >= 0; i--) {
    const sp = spriteQueue[i];
    if (sp.car) drawCar(sp.x, sp.y, sp.scale, sp.car);
    else if (sp.fireball) {
      const fs = Math.max(3, sp.scale * 900);
      ctx.fillStyle = '#fb923c';
      ctx.shadowColor = '#f97316';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, fs, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fef3c7';
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, fs * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
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

  // Race number + haunted-controls warning
  if (gameRunning) {
    ctx.fillStyle = '#a78bfa';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('RACE ' + race + (race >= 2 ? ' · ARMED' : ''), 16, 26);
    if (scramble > 0) {
      ctx.fillStyle = `rgba(165,243,252,${0.6 + Math.sin(Date.now() * 0.03) * 0.4})`;
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('👻 HAUNTED CONTROLS 👻', W / 2, 90);
    }
  }

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
