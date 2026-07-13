// ============================================================
// GHOST CIRCUIT — Web Drum Machine (scaffold)
// 8 tracks x 16 steps, Web-Audio-synthesized voices, drift-free
// lookahead scheduler. No samples, no backend.
// Companion/funnel to the desktop Drum Machine on Gumroad.
// ============================================================

// ---------- Audio context ----------
let audioCtx = null;
let master = null;
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    master = audioCtx.createGain();
    master.gain.value = 0.9;
    master.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

// ---------- Drum voices (all synthesized) ----------
function noiseBuffer(dur) {
  const len = Math.floor(audioCtx.sampleRate * dur);
  const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}
function env(gain, t, peak, dur, release) {
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur + (release || 0));
}

const VOICES = {
  kick(t, v) {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(50, t + 0.12);
    env(g, t, 0.9 * v, 0.28);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.4);
  },
  snare(t, v) {
    const n = audioCtx.createBufferSource(); n.buffer = noiseBuffer(0.2);
    const bp = audioCtx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800;
    const ng = audioCtx.createGain(); env(ng, t, 0.6 * v, 0.12);
    n.connect(bp); bp.connect(ng); ng.connect(master); n.start(t); n.stop(t + 0.2);
    const o = audioCtx.createOscillator(), og = audioCtx.createGain();
    o.type = 'triangle'; o.frequency.value = 200; env(og, t, 0.4 * v, 0.09);
    o.connect(og); og.connect(master); o.start(t); o.stop(t + 0.15);
  },
  clap(t, v) {
    [0, 0.012, 0.024].forEach(off => {
      const n = audioCtx.createBufferSource(); n.buffer = noiseBuffer(0.1);
      const bp = audioCtx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1200;
      const g = audioCtx.createGain(); env(g, t + off, 0.5 * v, 0.06);
      n.connect(bp); bp.connect(g); g.connect(master); n.start(t + off); n.stop(t + off + 0.1);
    });
  },
  chat(t, v) {
    const n = audioCtx.createBufferSource(); n.buffer = noiseBuffer(0.05);
    const hp = audioCtx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000;
    const g = audioCtx.createGain(); env(g, t, 0.35 * v, 0.03);
    n.connect(hp); hp.connect(g); g.connect(master); n.start(t); n.stop(t + 0.06);
  },
  ohat(t, v) {
    const n = audioCtx.createBufferSource(); n.buffer = noiseBuffer(0.35);
    const hp = audioCtx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000;
    const g = audioCtx.createGain(); env(g, t, 0.3 * v, 0.28);
    n.connect(hp); hp.connect(g); g.connect(master); n.start(t); n.stop(t + 0.4);
  },
  ltom(t, v) {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(65, t + 0.2);
    env(g, t, 0.7 * v, 0.24); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.35);
  },
  htom(t, v) {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(120, t + 0.16);
    env(g, t, 0.7 * v, 0.2); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.3);
  },
  cowbell(t, v) {
    [560, 845].forEach(f => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'square'; o.frequency.value = f; env(g, t, 0.28 * v, 0.18);
      const bp = audioCtx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700;
      o.connect(bp); bp.connect(g); g.connect(master); o.start(t); o.stop(t + 0.25);
    });
  }
};

// ---------- Tracks & pattern ----------
const TRACKS = [
  { id: 'kick',    name: 'Kick' },
  { id: 'snare',   name: 'Snare' },
  { id: 'clap',    name: 'Clap' },
  { id: 'chat',    name: 'Closed Hat' },
  { id: 'ohat',    name: 'Open Hat' },
  { id: 'ltom',    name: 'Low Tom' },
  { id: 'htom',    name: 'Hi Tom' },
  { id: 'cowbell', name: 'Cowbell' }
];
const STEPS = 16;
// pattern[track][step] = 0/1 ; mutes[track] = bool
let pattern = TRACKS.map(() => new Array(STEPS).fill(0));
let mutes = TRACKS.map(() => false);

// ---------- Transport / scheduler ----------
let isPlaying = false;
let tempo = 120;
let swing = 0;               // 0..0.5 — delays odd 16ths
let currentStep = 0;
let nextNoteTime = 0;
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD = 0.12;
let timerID = null;
let drawQueue = [];          // {step, time} for the visual playhead

function secondsPerStep() { return (60.0 / tempo) / 4; } // 16th notes

function advanceStep() {
  nextNoteTime += secondsPerStep();
  currentStep = (currentStep + 1) % STEPS;
}

function scheduleStep(step, time) {
  // swing: push odd steps later
  const t = (step % 2 === 1) ? time + secondsPerStep() * swing : time;
  TRACKS.forEach((tr, ti) => {
    if (pattern[ti][step] && !mutes[ti]) VOICES[tr.id](t, 1);
  });
  drawQueue.push({ step, time: t });
}

function scheduler() {
  while (nextNoteTime < audioCtx.currentTime + SCHEDULE_AHEAD) {
    scheduleStep(currentStep, nextNoteTime);
    advanceStep();
  }
}

function play() {
  initAudio();
  if (isPlaying) return;
  isPlaying = true;
  currentStep = 0;
  nextNoteTime = audioCtx.currentTime + 0.05;
  timerID = setInterval(scheduler, LOOKAHEAD_MS);
  document.getElementById('playBtn').textContent = '❚❚ Stop';
  requestAnimationFrame(drawPlayhead);
}
function stop() {
  isPlaying = false;
  clearInterval(timerID);
  timerID = null;
  document.getElementById('playBtn').textContent = '▶ Play';
  document.querySelectorAll('.cell.playing').forEach(c => c.classList.remove('playing'));
}
function togglePlay() { isPlaying ? stop() : play(); }

// ---------- Visual playhead ----------
let lastDrawnStep = -1;
function drawPlayhead() {
  if (!isPlaying) return;
  const now = audioCtx.currentTime;
  let step = lastDrawnStep;
  while (drawQueue.length && drawQueue[0].time < now) {
    step = drawQueue.shift().step;
  }
  if (step !== lastDrawnStep) {
    document.querySelectorAll('.col-' + lastDrawnStep).forEach(c => c.classList.remove('playing'));
    document.querySelectorAll('.col-' + step).forEach(c => c.classList.add('playing'));
    lastDrawnStep = step;
  }
  requestAnimationFrame(drawPlayhead);
}

// ---------- Build the grid UI ----------
function buildGrid() {
  const grid = document.getElementById('grid');
  grid.innerHTML = '';
  TRACKS.forEach((tr, ti) => {
    const label = document.createElement('div');
    label.className = 'track-label';
    label.textContent = tr.name;
    label.title = 'Click to mute · plays on click';
    label.addEventListener('click', () => {
      mutes[ti] = !mutes[ti];
      label.classList.toggle('muted', mutes[ti]);
      if (!mutes[ti]) { initAudio(); VOICES[tr.id](audioCtx.currentTime, 1); } // preview
    });
    grid.appendChild(label);

    for (let s = 0; s < STEPS; s++) {
      const cell = document.createElement('div');
      cell.className = 'cell col-' + s + (s % 4 === 0 ? ' beat' : '');
      cell.dataset.track = ti; cell.dataset.step = s;
      cell.addEventListener('click', () => {
        pattern[ti][s] ^= 1;
        cell.classList.toggle('on', !!pattern[ti][s]);
        if (pattern[ti][s]) { initAudio(); VOICES[tr.id](audioCtx.currentTime, 1); }
      });
      grid.appendChild(cell);
    }
  });
  syncGrid();
}
function syncGrid() {
  document.querySelectorAll('.cell').forEach(c => {
    c.classList.toggle('on', !!pattern[+c.dataset.track][+c.dataset.step]);
  });
  TRACKS.forEach((tr, ti) => {
    const label = document.querySelectorAll('.track-label')[ti];
    if (label) label.classList.toggle('muted', mutes[ti]);
  });
}

// ---------- Pattern actions ----------
function clearPattern() {
  pattern = TRACKS.map(() => new Array(STEPS).fill(0));
  syncGrid();
}
function demoPattern() {
  clearPattern();
  const set = (id, steps) => { const ti = TRACKS.findIndex(t => t.id === id); steps.forEach(s => pattern[ti][s] = 1); };
  set('kick', [0, 4, 8, 12]);
  set('snare', [4, 12]);
  set('chat', [0, 2, 4, 6, 8, 10, 12, 14]);
  set('ohat', [2, 10]);
  set('clap', [12]);
  syncGrid();
}
const SAVE_KEY = 'ghostCircuit.drumMachine.pattern';
function savePattern() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ pattern, tempo, swing }));
    flash('Pattern saved');
  } catch (e) { flash('Save failed'); }
}
function loadPattern() {
  try {
    const d = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!d) { flash('No saved pattern'); return; }
    pattern = d.pattern; tempo = d.tempo || 120; swing = d.swing || 0;
    document.getElementById('tempo').value = tempo;
    document.getElementById('tempoVal').textContent = tempo;
    document.getElementById('swing').value = swing * 100;
    syncGrid();
    flash('Pattern loaded');
  } catch (e) { flash('Load failed'); }
}
let flashTimer = null;
function flash(msg) {
  const el = document.getElementById('flash');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => el.classList.remove('show'), 1400);
}

// ---------- Wire up ----------
window.addEventListener('DOMContentLoaded', () => {
  buildGrid();
  document.getElementById('playBtn').addEventListener('click', () => { initAudio(); togglePlay(); });
  document.getElementById('clearBtn').addEventListener('click', clearPattern);
  document.getElementById('demoBtn').addEventListener('click', demoPattern);
  document.getElementById('saveBtn').addEventListener('click', savePattern);
  document.getElementById('loadBtn').addEventListener('click', loadPattern);
  const tempoEl = document.getElementById('tempo');
  tempoEl.addEventListener('input', e => { tempo = +e.target.value; document.getElementById('tempoVal').textContent = tempo; });
  const swingEl = document.getElementById('swing');
  swingEl.addEventListener('input', e => { swing = +e.target.value / 100; });
  // spacebar toggles play
  window.addEventListener('keydown', e => {
    if (e.code === 'Space') { e.preventDefault(); initAudio(); togglePlay(); }
  });
  demoPattern(); // start with something audible
});
console.log('Ghost Circuit Drum Machine ready');
