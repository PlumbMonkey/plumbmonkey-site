// ============================================================
// GHOST CIRCUIT — Web Drum Machine (scaffold)
// 8 tracks x 16 steps, Web-Audio-synthesized voices, drift-free
// lookahead scheduler. No samples, no backend.
// Companion/funnel to the desktop Drum Machine on Gumroad.
// ============================================================

// ---------- Audio context ----------
let audioCtx = null;
let master = null;
// Headroom instead of dynamics processing: a DynamicsCompressorNode tuned to
// only catch the rare overlapping-step peak turned out to unpredictably
// squash single hits too (measured), so gain-staging is used instead — a
// plain master level low enough that even the busiest realistic step
// (kick+snare+hat+clap all landing together) stays under 1.0. Verified: the
// demo pattern's worst step peaks ~0.66 at this level, with no coloration.
const MASTER_LEVEL = 0.6;
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    master = audioCtx.createGain();
    master.gain.value = MASTER_LEVEL;
    master.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

// Safety net for exports: guarantee a rendered file never hard-clips, without
// a compressor (which colours single hits — see above). We scan the rendered
// peak and, ONLY if it would clip, apply one linear gain to the whole buffer.
// That's transparent — it changes level, not shape — so a dense pattern whose
// overlapping voice tails stack past 1.0 exports undistorted instead of
// clipped. Patterns already under the ceiling are left untouched and match
// live playback exactly. (The single-step headroom above doesn't account for
// tails ringing across several 16th steps, which is where real clipping came
// from.)
function normalizePeak(buffer, ceiling) {
  ceiling = ceiling || 0.99;
  let peak = 0;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const d = buffer.getChannelData(c);
    for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > peak) peak = a; }
  }
  if (peak > ceiling) {
    const g = ceiling / peak;
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const d = buffer.getChannelData(c);
      for (let i = 0; i < d.length; i++) d[i] *= g;
    }
  }
  return peak;
}

// Offline render uses the same headroom-only bus, so exports match live playback.
function makeLimitedBus(ctx) {
  const bus = ctx.createGain();
  bus.connect(ctx.destination);
  return bus;
}

// ---------- Drum voices, tracks & GM map ----------
// All synthesized, and shared with the synth's backing beat and the Song
// view via shared/drum-engine.js — one definition, three consumers.
const { VOICES, TRACKS, GM_NOTE, STEPS } = DrumEngine;
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
    if (pattern[ti][step] && !mutes[ti]) VOICES[tr.id](audioCtx, master, t, 1);
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
    label.title = 'Click to mute · plays on click';
    const nameSpan = document.createElement('span');
    nameSpan.textContent = tr.name;
    label.appendChild(nameSpan);
    const dl = document.createElement('span');
    dl.className = 'sample-dl';
    dl.textContent = '⭳';
    dl.title = 'Download this sample as a WAV';
    dl.addEventListener('click', e => { e.stopPropagation(); exportVoiceOneShot(ti); });
    label.appendChild(dl);
    label.addEventListener('click', () => {
      mutes[ti] = !mutes[ti];
      label.classList.toggle('muted', mutes[ti]);
      if (!mutes[ti]) { initAudio(); VOICES[tr.id](audioCtx, master, audioCtx.currentTime, 1); } // preview
    });
    grid.appendChild(label);

    for (let s = 0; s < STEPS; s++) {
      const cell = document.createElement('div');
      cell.className = 'cell col-' + s + (s % 4 === 0 ? ' beat' : '');
      cell.dataset.track = ti; cell.dataset.step = s;
      cell.addEventListener('click', () => {
        pattern[ti][s] ^= 1;
        cell.classList.toggle('on', !!pattern[ti][s]);
        if (pattern[ti][s]) { initAudio(); VOICES[tr.id](audioCtx, master, audioCtx.currentTime, 1); }
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

// ---------- Export (WAV loop, MIDI loop, per-voice one-shot samples) ----------
// Renders the current pattern through an OfflineAudioContext using the SAME
// VOICES functions that drive live playback — what you hear is what exports.
async function renderPatternToBuffer(loops) {
  loops = loops || 1;
  const sr = (audioCtx && audioCtx.sampleRate) || 44100;
  const spb = secondsPerStep();
  const totalSeconds = spb * STEPS * loops + 0.6; // pad for voice tails
  const off = new OfflineAudioContext(2, Math.ceil(totalSeconds * sr), sr);
  const offMaster = makeLimitedBus(off);
  // Match live playback's level even when audio was never started (export-first).
  offMaster.gain.value = master ? master.gain.value : MASTER_LEVEL;
  for (let loop = 0; loop < loops; loop++) {
    for (let s = 0; s < STEPS; s++) {
      const stepTime = (loop * STEPS + s) * spb;
      const t = (s % 2 === 1) ? stepTime + spb * swing : stepTime;
      TRACKS.forEach((tr, ti) => {
        if (pattern[ti][s] && !mutes[ti]) VOICES[tr.id](off, offMaster, t, 1);
      });
    }
  }
  return off.startRendering();
}

async function exportLoopWav() {
  initAudio();
  const hasAnyHit = pattern.some(track => track.some(s => s));
  if (!hasAnyHit) { flash('Nothing to export — add some steps first'); return; }
  flash('Rendering…');
  const buffer = await renderPatternToBuffer(1);
  normalizePeak(buffer);
  const blob = ExportUtils.audioBufferToWav(buffer);
  ExportUtils.downloadBlob(blob, 'ghost-circuit-beat.wav');
  flash('WAV exported');
}

function exportLoopMidi() {
  const hasAnyHit = pattern.some(track => track.some(s => s));
  if (!hasAnyHit) { flash('Nothing to export — add some steps first'); return; }
  const division = 480;             // ticks per quarter note
  const ticksPerStep = division / 4; // 16th notes
  const hitTicks = 20;               // short note-off duration per hit
  const events = [];
  for (let s = 0; s < STEPS; s++) {
    const swingTicks = (s % 2 === 1) ? Math.round(ticksPerStep * swing) : 0;
    const tick = s * ticksPerStep + swingTicks;
    TRACKS.forEach((tr, ti) => {
      if (pattern[ti][s] && !mutes[ti]) {
        const note = GM_NOTE[tr.id];
        events.push({ tick, type: 'on', note, velocity: 100, channel: 9 });
        events.push({ tick: tick + hitTicks, type: 'off', note, velocity: 0, channel: 9 });
      }
    });
  }
  const blob = ExportUtils.buildMidiFile(events, division, tempo);
  ExportUtils.downloadBlob(blob, 'ghost-circuit-beat.mid');
  flash('MIDI exported');
}

// ---------- Send the current beat to the Song view ----------
function sendToSong() {
  const hasAnyHit = pattern.some(track => track.some(s => s));
  if (!hasAnyHit) { flash('Add some steps before sending to the Song view'); return; }
  const name = (prompt('Name this beat for the Song view:', SongStore.nextName('drum')) || '').trim();
  if (name === '') return; // cancelled
  // Deep-copy the pattern so later edits here don't mutate the saved clip.
  const clip = SongStore.addClip('drum', name, {
    pattern: pattern.map(row => row.slice()),
    swing: swing
  });
  flash(clip ? '"' + name + '" sent to the Song view' : 'Could not save — storage full?');
}

async function exportVoiceOneShot(ti) {
  initAudio();
  const tr = TRACKS[ti];
  const sr = (audioCtx && audioCtx.sampleRate) || 44100;
  const off = new OfflineAudioContext(2, Math.ceil(sr * 1.0), sr);
  const dest = makeLimitedBus(off); dest.gain.value = 1;
  VOICES[tr.id](off, dest, 0.01, 1);
  const buffer = await off.startRendering();
  normalizePeak(buffer);   // snare/cowbell sum two sources and can graze 1.0
  const blob = ExportUtils.audioBufferToWav(buffer);
  ExportUtils.downloadBlob(blob, tr.id + '.wav');
  flash(tr.name + ' sample downloaded');
}

// ---------- Wire up ----------
window.addEventListener('DOMContentLoaded', () => {
  buildGrid();
  document.getElementById('playBtn').addEventListener('click', () => { initAudio(); togglePlay(); });
  document.getElementById('clearBtn').addEventListener('click', clearPattern);
  document.getElementById('demoBtn').addEventListener('click', demoPattern);
  document.getElementById('saveBtn').addEventListener('click', savePattern);
  document.getElementById('loadBtn').addEventListener('click', loadPattern);
  document.getElementById('exportWavBtn').addEventListener('click', exportLoopWav);
  document.getElementById('exportMidiBtn').addEventListener('click', exportLoopMidi);
  document.getElementById('toSongBtn').addEventListener('click', sendToSong);
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
