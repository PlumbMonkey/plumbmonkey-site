// ============================================================
// GHOST CIRCUIT — Web Soft Synth (scaffold)
// Polyphonic subtractive synth: osc → lowpass filter → ADSR.
// On-screen keyboard + computer keys. No samples, no backend.
// ============================================================

let audioCtx = null, master = null;
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    master = audioCtx.createGain();
    master.gain.value = 0.25;
    master.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

// ---------- Patch (live-edited by the controls) ----------
const patch = {
  wave: 'sawtooth',
  cutoff: 2200,
  resonance: 6,
  attack: 0.02,
  decay: 0.2,
  sustain: 0.6,
  release: 0.35,
  volume: 0.25
};

const midiToFreq = m => 440 * Math.pow(2, (m - 69) / 12);
const voices = {}; // midi -> {osc, filt, gain}

// ---------- Recording (captures note timing + the patch as played) ----------
let recording = false;
let recordStart = 0;
let recordedEvents = []; // {midi, onT, offT, snap} — times are seconds from recordStart
let openRecordings = {}; // midi -> event object, while the key is still held

function noteOn(midi) {
  initAudio();
  if (voices[midi]) return; // already sounding
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  osc.type = patch.wave;
  osc.frequency.value = midiToFreq(midi);
  const filt = audioCtx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.value = patch.cutoff;
  filt.Q.value = patch.resonance;
  const gain = audioCtx.createGain();
  const peak = 0.9;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(peak, now + patch.attack);
  gain.gain.linearRampToValueAtTime(Math.max(0.0001, patch.sustain * peak), now + patch.attack + patch.decay);
  osc.connect(filt); filt.connect(gain); gain.connect(master);
  osc.start(now);
  voices[midi] = { osc, filt, gain };
  highlightKey(midi, true);

  if (recording) {
    const ev = { midi, onT: now - recordStart, offT: null, snap: { ...patch } };
    recordedEvents.push(ev);
    openRecordings[midi] = ev;
  }
}

function noteOff(midi) {
  const v = voices[midi];
  if (!v) return;
  const now = audioCtx.currentTime;
  const cur = v.gain.gain.value;
  v.gain.gain.cancelScheduledValues(now);
  v.gain.gain.setValueAtTime(cur, now);
  v.gain.gain.linearRampToValueAtTime(0.0001, now + patch.release);
  v.osc.stop(now + patch.release + 0.03);
  delete voices[midi];
  highlightKey(midi, false);

  if (recording && openRecordings[midi]) {
    openRecordings[midi].offT = now - recordStart;
    delete openRecordings[midi];
  }
}

function toggleRecording() {
  initAudio();
  if (!recording) {
    recording = true;
    recordStart = audioCtx.currentTime;
    recordedEvents = [];
    openRecordings = {};
    setRecordUI(true, 0);
  } else {
    recording = false;
    const stopT = audioCtx.currentTime - recordStart;
    // finalize any keys still held so nothing is left open-ended
    Object.values(openRecordings).forEach(ev => { ev.offT = stopT; });
    openRecordings = {};
    setRecordUI(false, recordedEvents.length);
  }
}

// ---------- Offline re-synthesis of a recorded note (for export) ----------
// Mirrors the live noteOn/noteOff envelope shape, but as a single scheduled
// curve computed ahead of time (no cancel/resume — see the simplification
// note below).
function scheduleVoice(ctx, dest, midi, onT, offT, snap) {
  const peak = 0.9;
  const osc = ctx.createOscillator();
  osc.type = snap.wave;
  osc.frequency.value = midiToFreq(midi);
  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.value = snap.cutoff;
  filt.Q.value = snap.resonance;
  const gain = ctx.createGain();
  const sustainLevel = Math.max(0.0001, snap.sustain * peak);
  gain.gain.setValueAtTime(0.0001, onT);
  gain.gain.linearRampToValueAtTime(peak, onT + Math.max(snap.attack, 0.001));
  gain.gain.linearRampToValueAtTime(sustainLevel, onT + snap.attack + snap.decay);
  // Simplification: if a note is released before the decay stage finishes,
  // the release begins once decay completes rather than mid-ramp — avoids
  // fragile scheduled-curve cancellation for a small audible difference on
  // very short notes.
  const releaseStart = Math.max(offT, onT + snap.attack + snap.decay);
  gain.gain.setValueAtTime(sustainLevel, releaseStart);
  gain.gain.linearRampToValueAtTime(0.0001, releaseStart + snap.release);
  osc.connect(filt); filt.connect(gain); gain.connect(dest);
  osc.start(onT);
  osc.stop(releaseStart + snap.release + 0.02);
}

async function renderRecordingToBuffer() {
  const sr = (audioCtx && audioCtx.sampleRate) || 44100;
  let endTime = 0;
  recordedEvents.forEach(e => {
    const off = e.offT != null ? e.offT : e.onT + 1;
    endTime = Math.max(endTime, Math.max(off, e.onT + e.snap.attack + e.snap.decay) + e.snap.release);
  });
  const off = new OfflineAudioContext(2, Math.ceil(sr * (endTime + 0.3)), sr);
  const dest = off.createGain();
  // match the volume the recording was actually heard at — an offline unity
  // bus here would export louder (and clip harder) than live playback
  dest.gain.value = master ? master.gain.value : patch.volume;
  dest.connect(off.destination);
  recordedEvents.forEach(e => {
    const offT = e.offT != null ? e.offT : e.onT + 1;
    scheduleVoice(off, dest, e.midi, e.onT, offT, e.snap);
  });
  return off.startRendering();
}

async function exportRecordingWav() {
  if (!recordedEvents.length) { setStatus('Nothing recorded yet — press ● Record and play something'); return; }
  setStatus('Rendering…');
  const buffer = await renderRecordingToBuffer();
  const blob = ExportUtils.audioBufferToWav(buffer);
  ExportUtils.downloadBlob(blob, 'ghost-circuit-riff.wav');
  setStatus('WAV exported — ' + recordedEvents.length + ' notes');
}

function exportRecordingMidi() {
  if (!recordedEvents.length) { setStatus('Nothing recorded yet — press ● Record and play something'); return; }
  const division = 480;
  const refTempo = 120; // reference tempo used only to express real recorded seconds as ticks
  const ticksPerSecond = division * (refTempo / 60);
  const events = [];
  recordedEvents.forEach(e => {
    const offT = e.offT != null ? e.offT : e.onT + 0.5;
    events.push({ tick: Math.round(e.onT * ticksPerSecond), type: 'on', note: e.midi, velocity: 100, channel: 0 });
    events.push({ tick: Math.round(offT * ticksPerSecond), type: 'off', note: e.midi, velocity: 0, channel: 0 });
  });
  const blob = ExportUtils.buildMidiFile(events, division, refTempo);
  ExportUtils.downloadBlob(blob, 'ghost-circuit-riff.mid');
  setStatus('MIDI exported — ' + recordedEvents.length + ' notes');
}

function setRecordUI(isRecording, noteCount) {
  const btn = document.getElementById('recordBtn');
  if (btn) {
    btn.textContent = isRecording ? '■ Stop' : '● Record';
    btn.classList.toggle('recording', isRecording);
  }
  if (isRecording) setStatus('Recording…');
  else setStatus(noteCount ? 'Recorded ' + noteCount + ' notes — ready to export' : 'Recording stopped (nothing played)');
}
function setStatus(msg) {
  const el = document.getElementById('synthStatus');
  if (el) el.textContent = msg;
}

// ---------- Keyboard (one+ octave, C4=60 .. E5=76) ----------
const LOW = 60, HIGH = 76;
const BLACK = { 1: 1, 3: 1, 6: 1, 8: 1, 10: 1 }; // semitone offsets that are black keys
function isBlack(m) { return !!BLACK[((m % 12) + 12) % 12]; }

// computer-key → midi (relative to LOW)
const KEYMAP = {
  KeyA: 60, KeyW: 61, KeyS: 62, KeyE: 63, KeyD: 64, KeyF: 65, KeyT: 66,
  KeyG: 67, KeyY: 68, KeyH: 69, KeyU: 70, KeyJ: 71, KeyK: 72, KeyO: 73,
  KeyL: 74, KeyP: 75, Semicolon: 76
};

function highlightKey(midi, on) {
  const el = document.querySelector('.key[data-midi="' + midi + '"]');
  if (el) el.classList.toggle('down', on);
}

function buildKeyboard() {
  const kb = document.getElementById('keyboard');
  kb.innerHTML = '';
  // render white keys as flow, black keys absolutely positioned over them
  const whites = [];
  for (let m = LOW; m <= HIGH; m++) if (!isBlack(m)) whites.push(m);
  const whiteW = 100 / whites.length;
  let wi = 0;
  for (let m = LOW; m <= HIGH; m++) {
    if (isBlack(m)) continue;
    const key = document.createElement('div');
    key.className = 'key white';
    key.dataset.midi = m;
    key.style.left = (wi * whiteW) + '%';
    key.style.width = whiteW + '%';
    bindKey(key, m);
    kb.appendChild(key);
    // black key sits to the right of this white (if the next semitone is black)
    if (isBlack(m + 1) && m + 1 <= HIGH) {
      const bk = document.createElement('div');
      bk.className = 'key black';
      bk.dataset.midi = m + 1;
      bk.style.left = (wi * whiteW + whiteW * 0.62) + '%';
      bk.style.width = (whiteW * 0.62) + '%';
      bindKey(bk, m + 1);
      kb.appendChild(bk);
    }
    wi++;
  }
}

function bindKey(el, midi) {
  const on = e => { e.preventDefault(); noteOn(midi); };
  const off = e => { e.preventDefault(); noteOff(midi); };
  el.addEventListener('mousedown', on);
  el.addEventListener('mouseup', off);
  el.addEventListener('mouseleave', () => { if (voices[midi]) noteOff(midi); });
  el.addEventListener('touchstart', on, { passive: false });
  el.addEventListener('touchend', off, { passive: false });
  el.addEventListener('touchcancel', off, { passive: false });
}

// ---------- Controls ----------
function bindControls() {
  const bind = (id, key, fmt) => {
    const el = document.getElementById(id);
    const out = document.getElementById(id + 'Val');
    const apply = () => {
      let v = +el.value;
      if (el.dataset.scale) v *= +el.dataset.scale;
      patch[key] = v;
      if (key === 'volume' && master) master.gain.value = v;
      if (out) out.textContent = fmt ? fmt(v) : v;
    };
    el.addEventListener('input', apply);
    apply();
  };
  document.getElementById('wave').addEventListener('change', e => patch.wave = e.target.value);
  bind('cutoff', 'cutoff', v => Math.round(v) + ' Hz');
  bind('resonance', 'resonance', v => v.toFixed(1));
  bind('attack', 'attack', v => (v * 1000).toFixed(0) + ' ms');
  bind('decay', 'decay', v => (v * 1000).toFixed(0) + ' ms');
  bind('sustain', 'sustain', v => Math.round(v * 100) + '%');
  bind('release', 'release', v => (v * 1000).toFixed(0) + ' ms');
  bind('volume', 'volume', v => Math.round(v * 100) + '%');
}

// ---------- Computer keyboard ----------
window.addEventListener('keydown', e => {
  if (e.repeat) return;
  const m = KEYMAP[e.code];
  if (m !== undefined) { e.preventDefault(); noteOn(m); }
});
window.addEventListener('keyup', e => {
  const m = KEYMAP[e.code];
  if (m !== undefined) { e.preventDefault(); noteOff(m); }
});

window.addEventListener('DOMContentLoaded', () => {
  buildKeyboard();
  bindControls();
  document.getElementById('recordBtn').addEventListener('click', toggleRecording);
  document.getElementById('exportWavBtn').addEventListener('click', exportRecordingWav);
  document.getElementById('exportMidiBtn').addEventListener('click', exportRecordingMidi);
});
console.log('Ghost Circuit Soft Synth ready');
