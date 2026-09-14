// ============================================================
// SPECTRAL MANOR CRUISE — rules
// Pseudo-3D night racer. Four tracks, five monster rivals, one hot-rod hearse.
//
// Files (load order): tracks.js · cars.js · render.js · game.js
// Rules run at a fixed 60 Hz (loop()).
//
// Depth convention: `player.totalZ` is where YOUR CAR is. The camera sits
// PLAYER_Z behind it (cameraZ()). Every collision — rivals, hazards, orbs,
// ramps, roadside objects — is measured at the car, so what you see touch the
// car is what hits it.
// ============================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

// ---------- Audio ----------
let audioCtx = null, engine = null;
function initAudio() {
  if (!audioCtx) {
    audioCtx = ArcadeAudio.context();
    if (audioCtx) {
      const o1 = audioCtx.createOscillator(), o2 = audioCtx.createOscillator();
      const lp = audioCtx.createBiquadFilter(), gain = audioCtx.createGain();
      o1.type = 'sawtooth'; o2.type = 'square'; o2.detune.value = -1200;
      lp.type = 'lowpass'; lp.frequency.value = 400; gain.gain.value = 0;
      o1.connect(lp); o2.connect(lp); lp.connect(gain); gain.connect(ArcadeAudio.output('sfx'));
      o1.start(); o2.start();
      engine = { o1, o2, lp, gain };
    }
  }
  ArcadeAudio.resume();
}
function tone(f, d, type = 'square', v = 0.05, slide = 0, bus = 'sfx') {
  if (!audioCtx) return;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, audioCtx.currentTime);
  if (slide) o.frequency.linearRampToValueAtTime(Math.max(30, f + slide), audioCtx.currentTime + d);
  g.gain.setValueAtTime(v, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + d);
  o.connect(g); g.connect(ArcadeAudio.output(bus));
  o.start(); o.stop(audioCtx.currentTime + d);
}
function noise(d, v = 0.05, freq = 900) {
  if (!audioCtx) return;
  const size = Math.floor(audioCtx.sampleRate * d), buf = audioCtx.createBuffer(1, size, audioCtx.sampleRate), data = buf.getChannelData(0);
  for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
  const src = audioCtx.createBufferSource(), f = audioCtx.createBiquadFilter(), g = audioCtx.createGain();
  src.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq;
  g.gain.setValueAtTime(v, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + d);
  src.connect(f); f.connect(g); g.connect(ArcadeAudio.output('sfx')); src.start();
}
const later = (fn, ms) => setTimeout(fn, ms);
const sfx = {
  beep: () => tone(440, 0.14, 'square', 0.06),
  go: () => { tone(880, 0.35, 'square', 0.07); noise(0.2, 0.03, 3000); },
  crash: () => { noise(0.35, 0.1, 300); tone(110, 0.25, 'sawtooth', 0.07, -60); tone(60, 0.3, 'triangle', 0.06); },
  thud: () => { noise(0.15, 0.07, 180); tone(70, 0.2, 'sine', 0.08, -30); },
  bump: () => { noise(0.12, 0.06, 600); tone(150, 0.1, 'square', 0.04, -40); },
  pass: () => tone(600, 0.1, 'triangle', 0.04, 300),
  nearMiss: () => { noise(0.25, 0.05, 2500); tone(700, 0.18, 'sawtooth', 0.03, 500); },
  orb: () => { tone(988, 0.06, 'sine', 0.05); later(() => tone(1318, 0.09, 'sine', 0.05), 50); },
  nitro: () => { noise(0.5, 0.07, 1400); tone(200, 0.4, 'sawtooth', 0.04, 400); },
  splash: () => { noise(0.3, 0.06, 1800); },
  sizzle: () => { noise(0.4, 0.07, 3500); tone(240, 0.3, 'sawtooth', 0.03, -120); },
  haunt: () => { tone(900, 0.4, 'sine', 0.05, -600); tone(600, 0.45, 'triangle', 0.04, -300); },
  lap: () => { tone(523, 0.08); later(() => tone(659, 0.08), 80); later(() => tone(784, 0.14), 160); },
  win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => later(() => tone(f, 0.15, 'square', 0.07), i * 120)),
  lose: () => { tone(300, 0.25, 'sawtooth', 0.06, -80); later(() => tone(200, 0.35, 'sawtooth', 0.06, -60), 220); }
};
function updateEngine(ratio) {
  if (!engine || audioCtx.state !== 'running') return;
  // five "gears": pitch climbs within each and drops on the shift
  const gearPos = (ratio * 5) % 1, gear = Math.min(4, Math.floor(ratio * 5));
  const f = 55 + gear * 12 + gearPos * 70 + (player.nitroOn ? 25 : 0);
  engine.o1.frequency.value = f; engine.o2.frequency.value = f;
  engine.lp.frequency.value = 350 + ratio * 1400;
  engine.gain.gain.value = gameRunning && !paused ? 0.018 + ratio * 0.03 : 0;
}

// ---------- Tuning ----------
const COUNTDOWN = 180, FINISH_FRAMES = 150;
const NITRO_MIN = 25;
const MAX_SPEED = 11800;
/* How long a ghost's haunting lasts. The reversal is the skill test — prefer
   changing this over reintroducing random steering jitter. */
const SCRAMBLE_FRAMES = 55;
/* Sideways pull of a curve at full speed, per frame per unit of curve. At top
   speed the tightest bends pull harder than full lock can steer, so you have to
   lift; tuned with the clean/sloppy bots in scripts/test-cruise.cjs. */
const CURVE_PULL = 0.017;
const CAR_HALF = 0.125;         // half a car's width, in road half-widths
const LANES = [-0.62, 0, 0.62];

const RIVAL_DEFS = [
  { key: 'vampire',  name: 'Vampire',  tag: '#fca5a5', speed: 10700, x: -0.62 },
  { key: 'werewolf', name: 'Werewolf', tag: '#e7e5e4', speed: 10000, x: 0.62 },
  { key: 'witch',    name: 'Witch',    tag: '#d8b4fe', speed: 9800, x: -0.62 },
  { key: 'frank',    name: 'Frank',    tag: '#bef264', speed: 9600, x: 0.62 },
  { key: 'ghost',    name: 'Ghost',    tag: '#a5f3fc', speed: 10500, x: 0, ghost: true }
];

// ---------- State ----------
let tick = 0, race = 1, cycle = 0, cruiseScore = 0, raceBonus = 0;
let track = null;
const trackCache = {};
function trackFor(r) {
  const i = (r - 1) % TRACKS.length;
  if (!trackCache[i]) trackCache[i] = buildTrack(i);
  return trackCache[i];
}
let gameRunning = false, paused = false, finishing = 0, finishPlace = 0;
let countdown = 0, raceTime = 0, lapFlash = 0, bgOffset = 0;
let keys = {};
let shake = 0, scramble = 0, batSwarm = 0;
let opponents = [], fireballs = [], fx = [], popups = [];

const player = {
  totalZ: 0, prevTotalZ: 0, x: 0, speed: 0, maxSpeed: MAX_SPEED, lap: 1,
  air: 0, airMax: 0, airHeight: 0, bumpVx: 0, steerVis: 0, spin: 0, slide: 0,
  nitro: 0, nitroOn: false, drafting: 0, braking: false, gas: false, offroad: false,
  lapStartTime: 0, bestLap: 0
};

const cameraZ = () => (((player.totalZ - PLAYER_Z) % track.length) + track.length) % track.length;
const segAtZ = z => track.segments[Math.floor((((z % track.length) + track.length) % track.length) / SEG_LEN) % track.segments.length];
function ordinal(n) { return n + (['st', 'nd', 'rd'][n - 1] || 'th'); }
function fmtTime(frames) { const s = frames / 60; return Math.floor(s / 60) + ':' + (s % 60).toFixed(1).padStart(4, '0'); }
function racePosition() { return 1 + opponents.filter(o => o.totalZ > player.totalZ).length; }
function popup(text, color = '#fde68a') { popups.push({ text, color, life: 60, dx: (Math.random() - 0.5) * 80 }); }
function addFx(x, y, color, n, opts = {}) {
  for (let i = 0; i < n; i++) fx.push({ x, y, vx: (Math.random() - 0.5) * (opts.spread || 6), vy: -Math.random() * (opts.lift || 4), life: 20 + Math.random() * 20, size: 2 + Math.random() * (opts.size || 4), color, spark: opts.spark });
}

function resetRacers() {
  Object.assign(player, {
    totalZ: 0, prevTotalZ: 0, x: 0, speed: 0, lap: 1, air: 0, airMax: 0, airHeight: 0, bumpVx: 0, steerVis: 0, spin: 0, slide: 0,
    nitro: 30, nitroOn: false, drafting: 0, braking: false, gas: false, offroad: false, lapStartTime: 0
  });
  fireballs = []; fx = []; popups = []; scramble = 0; batSwarm = 0; raceBonus = 0;
  opponents = RIVAL_DEFS.map((d, i) => ({
    ...d,
    // rivals gain pace each race but cap below a clean driver's average. Tuned
    // with the bots in scripts/test-cruise.cjs: clean wins all four tracks,
    // full-throttle-and-hope loses them.
    speed: Math.min(d.speed + (race - 1) * 100, 11400),
    totalZ: (i + 1) * SEG_LEN * 3,
    lane: d.x, laneTimer: 120 + i * 50, contactCd: 0,
    wobble: Math.random() * Math.PI * 2,
    passed: false, fireTimer: 400 + Math.random() * 400,
    phasing: false, boosting: false, braking: false, lastRel: 1
  }));
  track.segments.forEach(s => s.orbs.forEach(o => { o.lap = 0; }));
}

// ---------- Flow ----------
function startRace() {
  track = trackFor(race);
  cycle = Math.floor((race - 1) / TRACKS.length);
  resetRacers();
  raceTime = 0; countdown = COUNTDOWN; finishing = 0; lapFlash = 0; paused = false;
  gameRunning = true;
  document.getElementById('startOverlay').classList.add('hidden');
  updateHUD();
}

function startFinish() {
  finishPlace = racePosition();
  finishing = FINISH_FRAMES;
  (finishPlace === 1 ? sfx.win : sfx.lose)();
  Object.keys(keys).forEach(k => { keys[k] = false; });
  player.nitroOn = false;
}

function finishRace() {
  gameRunning = false; finishing = 0;
  const place = finishPlace, won = place === 1;
  const secs = raceTime / 60;
  const par = LAPS * track.length / 10500 + 6;
  const placePts = [1500, 900, 600, 300, 150, 150][place - 1] || 100;
  const timeBonus = Math.max(0, Math.round((par - secs) * 20));
  cruiseScore += placePts + race * 400 + timeBonus + raceBonus;
  const theme = track.theme;
  const standings = [{ name: 'YOU', z: player.totalZ, you: true }, ...opponents.map(o => ({ name: o.name, z: o.totalZ }))]
    .sort((a, b) => b.z - a.z).map((r, i) => `<span style="${r.you ? 'color:#fde68a;font-weight:bold' : ''}">${i + 1}. ${r.name}</span>`).join(' &nbsp; ');
  const ov = document.getElementById('startOverlay');
  if (won) {
    race++;
    const next = TRACKS[(race - 1) % TRACKS.length];
    ov.classList.remove('hidden');
    ov.innerHTML = `
      <h2>YOU WIN — ${theme.name}</h2>
      <p style="font-size:1.6rem; margin:0.3rem 0">🏆 1st PLACE · ${fmtTime(raceTime)}</p>
      <p style="font-size:0.85rem">${standings}</p>
      <p>Race bonus +${raceBonus} · Time bonus +${timeBonus} · Run score: ${cruiseScore}</p>
      <p style="margin-top:0.4rem; color:#f0abfc">RACE ${race}: ${next.name} — rivals are faster${race >= 2 ? ' and ARMED' : ''}</p>
      <p style="margin-top:0.8rem; opacity:0.8">Click or ENTER to keep the streak going</p>`;
  } else {
    const finalScore = cruiseScore, reached = race;
    Arcade.submitFlow(finalScore, () => {
      ov.classList.remove('hidden');
      ov.innerHTML = `
        <h2>RUN OVER</h2>
        <p style="font-size:1.6rem; margin:0.3rem 0">${ordinal(place)} PLACE · ${theme.name}</p>
        <p style="font-size:0.85rem">${standings}</p>
        <p>Reached Race ${reached} · Run score: ${finalScore}</p>
        <p style="margin-top:0.8rem; color:#a78bfa; font-size:0.8rem; letter-spacing:1px">TOP DRIVERS</p>
        ${Arcade.boardHTML(Arcade.slug)}
        <p style="margin-top:0.8rem; opacity:0.8">Click or ENTER for a fresh run from Race 1</p>`;
      race = 1; cruiseScore = 0;
    });
  }
  updateHUD();
}

// ---------- Input ----------
window.addEventListener('keydown', e => {
  initAudio();
  keys[e.code] = true;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  if (e.code === 'Enter' && !gameRunning) startRace();
  if ((e.code === 'KeyP' || e.code === 'Escape') && gameRunning && !finishing) paused = !paused;
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
window.addEventListener('blur', () => { if (gameRunning && !finishing && !Arcade.attract) paused = true; });
document.getElementById('startOverlay').addEventListener('click', () => { initAudio(); if (!gameRunning) startRace(); });

// ---------- Update ----------
function update() {
  tick++;
  fx.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life--; });
  fx = fx.filter(p => p.life > 0);
  popups.forEach(p => p.life--);
  popups = popups.filter(p => p.life > 0);
  if (!gameRunning) { updateEngine(0); return; }
  if (paused) { updateEngine(0); return; }

  if (countdown > 0) {
    if (countdown % 60 === 0) sfx.beep();
    if (--countdown === 0) sfx.go();
    updateRivals(true);
    updateEngine(0);
    return;
  }
  if (!finishing) raceTime++;
  if (lapFlash > 0) lapFlash--;
  if (finishing > 0) {
    if (--finishing === 0) { finishRace(); return; }
  } else if (Arcade.attract) attractPilot();

  updatePlayer();
  if (!gameRunning) return;
  updateRivals(false);
  updateFireballs();
  if (batSwarm > 0) batSwarm--;
  if (shake > 0) shake *= 0.85;
  updateEngine(player.speed / player.maxSpeed);
  if (tick % 6 === 0) updateHUD();
}

function updatePlayer() {
  const seg = segAtZ(player.totalZ);
  const canDrive = !finishing;
  const input = {
    gas: finishing ? true : keys.ArrowUp || keys.KeyW,
    brake: !finishing && (keys.ArrowDown || keys.KeyS),
    left: !finishing && (keys.ArrowLeft || keys.KeyA),
    right: !finishing && (keys.ArrowRight || keys.KeyD),
    nitro: !finishing && (keys.Space || keys.ShiftLeft || keys.ShiftRight)
  };
  if (finishing) { input.left = player.x > 0.1; input.right = player.x < -0.1; }

  // nitro: needs a minimum charge to light, then burns while held
  player.nitroOn = canDrive && input.nitro && player.nitro > 0 && (player.nitroOn || player.nitro >= NITRO_MIN) && player.spin <= 0;
  if (player.nitroOn) { player.nitro = Math.max(0, player.nitro - 0.9); if (tick % 20 === 0) sfx.nitro(); }
  const top = player.maxSpeed * (player.nitroOn ? 1.22 : 1) * (player.drafting > 20 ? 1.05 : 1);

  player.gas = input.gas && player.spin <= 0;
  player.braking = !!input.brake;
  if (player.spin > 0) { player.spin--; player.speed *= 0.965; }
  // gas only accelerates UP TO the cap — adding first and trimming after let
  // speed creep 30/frame past top speed forever (both bots beat the clock)
  else if (player.gas) { if (player.speed < top) player.speed = Math.min(top, player.speed + (player.nitroOn ? 160 : 90)); }
  else if (input.brake) player.speed -= 180;
  else player.speed -= 35;
  if (finishing) player.speed = Math.min(player.speed, player.maxSpeed * 0.7);

  player.offroad = Math.abs(player.x) > 1.05 && player.air <= 0;
  if (player.offroad) {
    player.speed -= 140;
    if (Math.random() < 0.3) shake = Math.max(shake, 3);
    if (player.speed > 1500 && tick % 2 === 0) addFx(W / 2 + (Math.random() - 0.5) * 200, CAR_BOTTOM - 10, track.theme.key === 'canyon' ? '#b45309' : '#57534e', 2, { lift: 3 });
  }
  if (player.speed > top) player.speed = Math.max(top, player.speed - 60);
  player.speed = Math.max(0, player.speed);

  // steering + centrifugal pull; airborne = almost no authority
  const ratio = player.speed / player.maxSpeed;
  const airborne = player.air > 0;
  let steer = 0.028 * (0.4 + Math.min(1, ratio)) * (airborne ? 0.18 : 1);
  if (player.slide > 0) { player.slide--; steer *= 0.35; player.x += player.slideVx; player.slideVx *= 0.97; }
  let dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (player.spin > 0) dir = 0;
  if (scramble > 0) {
    // haunted controls: steering reverses, with a fading nudge the player can counter
    scramble--;
    dir = -dir;
    player.x += (Math.random() - 0.5) * 0.005 * (scramble / SCRAMBLE_FRAMES);
  }
  player.x += dir * steer;
  player.steerVis += (dir - player.steerVis) * 0.15;
  if (!airborne) player.x -= seg.curve * CURVE_PULL * Math.min(1, ratio) * Math.min(1, ratio);
  player.x += player.bumpVx; player.bumpVx *= 0.85;
  player.x = Math.max(-1.7, Math.min(1.7, player.x));
  bgOffset += seg.curve * Math.min(1, ratio) * 1.4;

  // advance (swept checks cover every segment the car crossed this frame)
  player.prevTotalZ = player.totalZ;
  player.totalZ += player.speed / 60;
  sweepTrack(player.prevTotalZ, player.totalZ);

  if (player.air > 0) {
    player.air--;
    const tt = 1 - player.air / player.airMax;
    player.airHeight = Math.sin(tt * Math.PI) * (60 + 50 * ratio);
    if (player.air === 0) { player.airHeight = 0; shake = Math.max(shake, 9); sfx.thud(); player.speed *= 0.94; addFx(W / 2, CAR_BOTTOM, '#a8a29e', 10, { spread: 10 }); }
  }

  // drafting: tuck in behind a rival for a pull and nitro charge
  const draft = opponents.some(o => { const rel = o.totalZ - player.totalZ; return rel > SEG_LEN && rel < SEG_LEN * 10 && Math.abs(o.x - player.x) < 0.22 && !o.ghost; });
  if (draft && ratio > 0.5) { player.drafting = Math.min(90, player.drafting + 1); player.nitro = Math.min(100, player.nitro + 0.18); }
  else player.drafting = Math.max(0, player.drafting - 3);

  // laps
  const lapNow = Math.floor(player.totalZ / track.length) + 1;
  if (lapNow > player.lap && !finishing) {
    if (player.totalZ >= LAPS * track.length) { startFinish(); return; }
    const lapTime = raceTime - player.lapStartTime;
    if (!player.bestLap || lapTime < player.bestLap) player.bestLap = lapTime;
    player.lapStartTime = raceTime;
    player.lap = lapNow;
    sfx.lap();
    if (player.lap === LAPS) lapFlash = 120;
  }
}

/* Everything static on the track is checked by the segments the car crossed,
   never by a proximity window: at top speed the car moves ~200 units a frame
   and nitro takes it past 240, so a window lets fast cars tunnel through. */
function sweepTrack(fromZ, toZ) {
  const N = track.segments.length;
  const first = Math.floor(fromZ / SEG_LEN) + 1, last = Math.floor(toZ / SEG_LEN);
  for (let k = first; k <= last; k++) {
    const seg = track.segments[((k % N) + N) % N];
    const airborne = player.air > 0;
    // ramp: lane-gated (the shoulder never launches you) and speed-gated
    if (seg.jump && !airborne && Math.abs(player.x) <= 1.0 && player.speed > player.maxSpeed * 0.55) {
      player.airMax = 52 + Math.round(28 * Math.min(1, player.speed / player.maxSpeed));
      player.air = player.airMax;
      sfx.beep(); shake = Math.max(shake, 4);
    }
    seg.hazards.forEach(hz => {
      if (airborne || Math.abs(hz.x - player.x) > hz.w + CAR_HALF * 0.6) return;
      if (hz.type === 'log') { player.speed *= 0.45; shake = 12; sfx.crash(); addFx(W / 2, CAR_BOTTOM - 20, '#a16207', 14, { spread: 12 }); popup('LOG!', '#fdba74'); }
      else if (hz.type === 'lava') { player.speed *= 0.62; shake = 8; sfx.sizzle(); addFx(W / 2, CAR_BOTTOM - 20, '#f97316', 16, { spark: true, spread: 10 }); popup('LAVA!', '#fb923c'); }
      else { player.slide = 50; player.slideVx = (Math.random() < 0.5 ? -1 : 1) * 0.012; sfx.splash(); addFx(W / 2, CAR_BOTTOM - 10, '#bae6fd', 16, { spread: 12 }); popup('AQUAPLANE!', '#67e8f9'); }
    });
    seg.orbs.forEach(ob => {
      if (ob.lap === player.lap || Math.abs(ob.x - player.x) > 0.24) return;
      ob.lap = player.lap;
      player.nitro = Math.min(100, player.nitro + 12);
      raceBonus += 50;
      sfx.orb();
    });
    if (!airborne && Math.abs(player.x) > 1.08 && player.spin <= 0) {
      const hit = seg.sprites.find(sp => SPRITE_DEFS[sp.name] && SPRITE_DEFS[sp.name].collide > 0 && Math.abs(sp.offset - player.x) < SPRITE_DEFS[sp.name].collide + CAR_HALF);
      if (hit) {
        player.spin = 50; player.speed *= 0.3; shake = 14;
        player.bumpVx = -Math.sign(player.x) * 0.03;
        sfx.crash();
        addFx(W / 2, CAR_BOTTOM - 30, '#fde68a', 18, { spark: true, spread: 14 });
        popup('CRASH!', '#fca5a5');
      }
    }
  }
}

function updateRivals(frozen) {
  opponents.forEach(o => {
    // lane choice: drift to a lane, dodge a slower car in front, and keep clear of you
    if (--o.laneTimer <= 0) { o.lane = LANES[Math.floor(Math.random() * 3)]; o.laneTimer = 180 + Math.random() * 240; }
    const relP = o.totalZ - player.totalZ;
    if (relP < 0 && relP > -SEG_LEN * 3 && Math.abs(o.x - player.x) < 0.3 && !o.ghost && race < 3) {
      o.lane = LANES.reduce((best, l) => Math.abs(l - player.x) > Math.abs(best - player.x) ? l : best, o.lane);
    }
    o.x += Math.sign(o.lane - o.x) * Math.min(0.008, Math.abs(o.lane - o.x));
    o.wobble += 0.015;
    if (frozen) return;

    /* Pack pacing. Before the final lap a straggler sprints back into view and
       a runaway leader eases off — but never below 80% of its own pace. It used
       to pace off 0.92 × YOUR speed on every lap, which meant a crawling,
       crashing driver dragged the whole field down and still won. The final
       lap is fully honest: no sprint, no easing. */
    const gap = relP;
    const honest = player.lap >= LAPS || finishing;
    if (honest) o.boosting = false;
    else if (gap < -SEG_LEN * 15) o.boosting = true;
    else if (gap > SEG_LEN * 6) o.boosting = false;
    let eff = o.speed;
    // rivals lift for the bends too (5% per unit of curve), so a track's pace
    // follows its shape and the fast straights are where you make up time
    eff *= 1 - Math.min(0.22, Math.abs(segAtZ(o.totalZ).curve) * 0.05);
    if (o.boosting) eff = Math.max(o.speed, player.speed * 1.08 + 500);
    else if (!honest && gap > SEG_LEN * 12) eff = Math.min(o.speed, Math.max(o.speed * 0.8, player.speed * 0.95));
    o.braking = eff < o.speed * 0.95;
    o.totalZ += (0.97 + 0.05 * Math.sin(o.wobble)) * eff / 60;

    const rel = o.totalZ - player.totalZ;
    if (finishing) return;

    // RACE 3+: side-swipe duels — a rival alongside leans into your lane
    if (race >= 3 && !o.ghost && Math.abs(rel) < SEG_LEN * 2.2) { o.lane = player.x; o.x += Math.sign(player.x - o.x) * 0.004; }

    // RACE 4+: character powers
    if (race >= 4 && Math.abs(rel) < SEG_LEN * 8) {
      o.powerTimer = (o.powerTimer || 240) - 1;
      if (o.powerTimer <= 0) {
        o.powerTimer = 420 + Math.random() * 300;
        if (o.key === 'witch') fireballs.push({ totalZ: player.totalZ + SEG_LEN * 14, x: player.x, life: 600, hex: true });
        else if (o.key === 'werewolf' && rel < 0) o.boosting = true;
        else if (o.key === 'vampire') batSwarm = 90;
      }
    }

    // overtakes: chime, and a near miss pays out
    if (o.lastRel > 0 && rel <= 0) {
      sfx.pass();
      if (Math.abs(o.x - player.x) < 0.45 && Math.abs(o.x - player.x) >= CAR_HALF * 2) { raceBonus += 150; player.nitro = Math.min(100, player.nitro + 8); popup('NEAR MISS +150', '#7dd3fc'); sfx.nearMiss(); }
    }
    o.lastRel = rel;

    // contact — once per touch: overlapping for several frames used to apply
    // the penalty every frame, so one side-swipe cost you three or four hits
    if (o.contactCd > 0) o.contactCd--;
    if (Math.abs(rel) < SEG_LEN * 0.7 && Math.abs(o.x - player.x) < CAR_HALF * 2) {
      if (o.ghost) {
        if (!o.phasing) { o.phasing = true; scramble = SCRAMBLE_FRAMES; shake = 5; sfx.haunt(); }
      } else if (player.air <= 0 && o.contactCd <= 0) {
        o.contactCd = 45;
        const dir = player.x > o.x ? 1 : -1;
        player.bumpVx = dir * 0.05;
        o.x -= dir * 0.14; o.lane = o.x;
        o.wobble += 1.7;
        player.speed = Math.min(player.speed, o.speed * 0.75);
        shake = 10;
        sfx.bump();
        addFx(W / 2 - dir * 90, CAR_BOTTOM - 40, '#fde68a', 10, { spark: true, spread: 10 });
      }
    } else if (o.ghost) o.phasing = false;
    o.x = Math.max(-0.9, Math.min(0.9, o.x));

    // RACE 2+: rivals AHEAD drop ghost-fire behind them — always from a car you can see
    if (race >= 2 && --o.fireTimer <= 0) {
      if (rel > SEG_LEN * 2 && rel < SEG_LEN * 60) fireballs.push({ totalZ: o.totalZ - SEG_LEN * 1.5, x: o.x, life: 900 });
      o.fireTimer = 320 + Math.random() * 320;
    }
  });
}

function updateFireballs() {
  for (let i = fireballs.length - 1; i >= 0; i--) {
    const f = fireballs[i];
    if (--f.life <= 0 || f.totalZ - player.totalZ < -SEG_LEN * 4) { fireballs.splice(i, 1); continue; }
    if (player.air > 0 || finishing) continue;
    const crossed = f.totalZ > player.prevTotalZ && f.totalZ <= player.totalZ;
    if (crossed && Math.abs(f.x - player.x) < 0.2) {
      fireballs.splice(i, 1);
      if (f.hex) { player.speed *= 0.72; shake = 5; sfx.lose(); popup('HEXED!', '#d8b4fe'); }
      else { player.speed *= 0.45; shake = 10; sfx.crash(); addFx(W / 2, CAR_BOTTOM - 20, '#f97316', 14, { spark: true }); popup('SCORCHED!', '#fb923c'); }
    }
  }
}

/* The hub-cabinet autopilot (and the "clean driver" in the tests): hold a lane
   that is clear of hazards and cars ahead, lean into the curves, lift for the
   tightest ones, and fire nitro on straights. */
function attractPilot() {
  MOVE_KEYS.forEach(k => { keys[k] = false; });
  const ratio = player.speed / player.maxSpeed;
  const seg = segAtZ(player.totalZ);
  const ahead = [];
  for (let d = 1; d < 22; d++) ahead.push(segAtZ(player.totalZ + d * SEG_LEN));
  const blocked = lane => ahead.slice(0, 14).some(s => s.hazards.some(h => Math.abs(h.x - lane) < h.w + 0.2)) ||
    fireballs.some(f => { const r = f.totalZ - player.totalZ; return r > 0 && r < SEG_LEN * 14 && Math.abs(f.x - lane) < 0.3; }) ||
    opponents.some(o => { const r = o.totalZ - player.totalZ; return r > -SEG_LEN && r < SEG_LEN * 6 && Math.abs(o.x - lane) < 0.34 && !o.ghost; });
  if (pilotLane === undefined || blocked(pilotLane)) pilotLane = [0, -0.62, 0.62].find(l => !blocked(l));
  if (pilotLane === undefined) pilotLane = 0;
  const upcoming = ahead.slice(0, 10).reduce((m, s) => Math.max(m, Math.abs(s.curve)), 0);
  const steerMax = 0.028 * (0.4 + ratio);
  const pull = seg.curve * CURVE_PULL * ratio * ratio / steerMax;              // share of full lock the curve eats
  const pullAhead = upcoming * CURVE_PULL * ratio * ratio / steerMax;
  const target = pilotLane - Math.sign(seg.curve) * Math.min(0.25, Math.abs(pull) * 0.4);
  const err = target - player.x + (pull * 0.9);
  if (err > 0.03) keys.ArrowRight = true;
  else if (err < -0.03) keys.ArrowLeft = true;
  keys.ArrowUp = pullAhead < 0.85 && Math.abs(player.x) < 1.0;
  keys.ArrowDown = pullAhead > 1.2 && ratio > 0.6;
  keys.Space = upcoming < 0.5 && player.nitro > 40 && Math.abs(player.x) < 0.8;
}
let pilotLane;
const MOVE_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];

function updateHUD() {
  document.getElementById('speed').textContent = Math.round(player.speed / player.maxSpeed * 120);
  document.getElementById('lap').textContent = Math.min(player.lap, LAPS) + '/' + LAPS;
  document.getElementById('place').textContent = ordinal(racePosition());
  document.getElementById('time').textContent = fmtTime(raceTime);
}

// ---------- Loop ----------
let previousFrame = performance.now(), accumulator = 0;
function loop() {
  const now = performance.now();
  accumulator += Math.min(100, now - previousFrame); previousFrame = now;
  let steps = 0;
  while (accumulator >= 1000 / 60 && steps++ < 6) { update(); accumulator -= 1000 / 60; }
  if (steps >= 6) accumulator = 0;
  draw();
  ArcadeVR.schedule(loop);
}
track = trackFor(1);
resetRacers();
buildSprites(); buildCars();
loop();
console.log('Spectral Manor Cruise ready — four tracks, five rivals');
