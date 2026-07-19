// ============================================================
// GHOST CIRCUIT — Web Soft Synth
// Polyphonic subtractive synth: osc → lowpass filter → ADSR → FX bus.
// FX rack: per-voice vibrato + bus drive/chorus/delay/reverb.
// On-screen keyboard + computer keys. No samples, no backend.
// ============================================================

let audioCtx = null, master = null, fxChain = null, analyser = null;
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    master = audioCtx.createGain();
    master.gain.value = patch.volume;
    // Voices → FX bus → master → destination. The SAME makeFxChain builds the
    // offline export bus too, so nothing you hear is missing from the WAV.
    fxChain = makeFxChain(audioCtx, patch.fx);
    fxChain.output.connect(master);
    master.connect(audioCtx.destination);
    // Oscilloscope tap — read-only, off the live master (no export impact).
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    master.connect(analyser);
    startScope();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

// ---------- Patch (live-edited by the controls) ----------
// Vibrato is per-voice and IS captured in each recorded note's snapshot.
// The bus FX (patch.fx) are re-amp style: they apply to the whole take using
// the knob values at export time, so they live outside the per-note snapshot.
const patch = {
  wave: 'sawtooth',
  cutoff: 2200,
  resonance: 6,
  attack: 0.02,
  decay: 0.2,
  sustain: 0.6,
  release: 0.35,
  volume: 0.25,
  vibRate: 5,     // Hz  (per-voice, snapshotted)
  vibDepth: 0,    // cents (per-voice, snapshotted; 0 = off)
  fx: {
    drive: 0,          // 0–100 %
    chorus: 0,         // 0–100 %
    delayTime: 0.320,  // seconds (60–800 ms)
    delayFeedback: 0,  // 0–0.75 (hard-clamped < 0.9 in code)
    delayWet: 0,       // 0–0.60
    reverbSize: 1.8,   // seconds (0.8–3.5)
    reverbWet: 0       // 0–0.50
  }
};

const midiToFreq = m => 440 * Math.pow(2, (m - 69) / 12);
const voices = {}; // midi -> {osc, filt, gain, vibLfo}

// ============================================================
// FX RACK — dual-graph bus (used by BOTH live and offline export)
// Chain order: input → drive → chorus → delay → reverb → output
// makeFxChain returns { input, output, applyFx } so live knob edits can
// update params in place; offline bakes the export-time values at build.
// ============================================================

// Reverb impulse response: stereo noise burst with exponential decay.
// AudioBuffers are per-context + sample-rate dependent, so this is always
// generated inside the chain for whichever context is rendering.
function makeReverbIR(ctx, sizeSec) {
  const s = Math.min(Math.max(sizeSec, 0.8), 3.5);
  const len = Math.max(1, Math.ceil(s * ctx.sampleRate));
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const ch = ir.getChannelData(c);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.2);
    }
  }
  return ir;
}

// tanh saturation curve for the WaveShaper — driveK pushes harder as amount rises.
function tanhCurve(driveK, n = 1024) {
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(driveK * x);
  }
  return curve;
}

function makeFxChain(ctx, fx) {
  const input = ctx.createGain();
  const output = ctx.createGain();
  // Bus headroom trim (gain-staging only — no compressor on this project).
  // The parallel dry+wet sums of a full 5-note chord peak ~1.26 undamped;
  // 0.75 keeps the worst case (all FX maxed) under 0.98 while a dry take
  // still lands well above the 0.3 audibility floor. Live + offline share
  // this identical trim because they share this constructor.
  output.gain.value = 0.75;

  // ---- Drive: parallel dry/wet tanh saturation (transparent at amount 0) ----
  const drDry = ctx.createGain();
  const shaper = ctx.createWaveShaper();
  shaper.oversample = '2x';
  const drWet = ctx.createGain();
  const driveSum = ctx.createGain();
  input.connect(drDry); drDry.connect(driveSum);
  input.connect(shaper); shaper.connect(drWet); drWet.connect(driveSum);

  // ---- Chorus: modulated delay blended with dry ----
  const chDry = ctx.createGain(); chDry.gain.value = 1;
  const chDelay = ctx.createDelay(0.05); chDelay.delayTime.value = 0.018; // 18 ms base
  const chWet = ctx.createGain();
  const chLfo = ctx.createOscillator(); chLfo.type = 'sine';
  const chLfoGain = ctx.createGain();
  chLfo.connect(chLfoGain); chLfoGain.connect(chDelay.delayTime);
  const chorusSum = ctx.createGain();
  driveSum.connect(chDry); chDry.connect(chorusSum);
  driveSum.connect(chDelay); chDelay.connect(chWet); chWet.connect(chorusSum);

  // ---- Delay: delay + feedback + wet, blended with dry ----
  const dlDry = ctx.createGain(); dlDry.gain.value = 1;
  const dl = ctx.createDelay(1.0);
  const dlFb = ctx.createGain();
  const dlWet = ctx.createGain();
  const delaySum = ctx.createGain();
  chorusSum.connect(dlDry); dlDry.connect(delaySum);
  chorusSum.connect(dl); dl.connect(dlFb); dlFb.connect(dl); dl.connect(dlWet); dlWet.connect(delaySum);

  // ---- Reverb: convolver (generated IR) + damping, blended with dry ----
  const rvDry = ctx.createGain(); rvDry.gain.value = 1;
  const conv = ctx.createConvolver();
  const damp = ctx.createBiquadFilter(); damp.type = 'lowpass'; damp.frequency.value = 5200;
  const rvWet = ctx.createGain();
  delaySum.connect(rvDry); rvDry.connect(output);
  delaySum.connect(conv); conv.connect(damp); damp.connect(rvWet); rvWet.connect(output);

  chLfo.start();

  let curSize = -1;
  function applyFx(fx) {
    // drive — dry(1-k)+wet(k) keeps roughly unity loudness across the sweep
    const k = Math.min(Math.max(fx.drive, 0), 100) / 100;
    drWet.gain.value = k * 0.9;
    drDry.gain.value = 1 - k;
    shaper.curve = tanhCurve(1 + k * 9);
    // chorus — single amount maps depth + wet together
    const c = Math.min(Math.max(fx.chorus, 0), 100) / 100;
    chWet.gain.value = c;
    chLfo.frequency.value = 0.2 + c * 0.8;      // 0.2–1 Hz
    chLfoGain.gain.value = 0.004 + c * 0.004;   // ±4–8 ms
    // delay — feedback hard-clamped well below self-oscillation
    dl.delayTime.value = Math.min(Math.max(fx.delayTime, 0.06), 0.8);
    dlFb.gain.value = Math.min(Math.max(fx.delayFeedback, 0), 0.85);
    dlWet.gain.value = Math.min(Math.max(fx.delayWet, 0), 0.6);
    // reverb — regenerate the IR only when size actually changes
    rvWet.gain.value = Math.min(Math.max(fx.reverbWet, 0), 0.5);
    const size = Math.min(Math.max(fx.reverbSize, 0.8), 3.5);
    if (Math.abs(size - curSize) > 0.001) { conv.buffer = makeReverbIR(ctx, size); curSize = size; }
  }
  applyFx(fx);
  return { input, output, applyFx };
}

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
  osc.connect(filt); filt.connect(gain); gain.connect(fxChain.input);
  osc.start(now);

  // Per-voice vibrato LFO → osc detune (cents). Only spun up when depth > 0.
  let vibLfo = null;
  if (patch.vibDepth > 0) {
    vibLfo = audioCtx.createOscillator();
    vibLfo.type = 'sine';
    vibLfo.frequency.value = patch.vibRate;
    const vibGain = audioCtx.createGain();
    vibGain.gain.value = patch.vibDepth;
    vibLfo.connect(vibGain); vibGain.connect(osc.detune);
    vibLfo.start(now);
  }
  voices[midi] = { osc, filt, gain, vibLfo };
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
  if (v.vibLfo) v.vibLfo.stop(now + patch.release + 0.03); // stop the LFO too or it leaks
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
  const stopAt = releaseStart + snap.release + 0.02;
  osc.stop(stopAt);

  // Reproduce this note's vibrato offline (it was captured in the snapshot).
  if (snap.vibDepth > 0) {
    const vibLfo = ctx.createOscillator();
    vibLfo.type = 'sine';
    vibLfo.frequency.value = snap.vibRate;
    const vibGain = ctx.createGain();
    vibGain.gain.value = snap.vibDepth;
    vibLfo.connect(vibGain); vibGain.connect(osc.detune);
    vibLfo.start(onT);
    vibLfo.stop(stopAt); // explicit stop — offline needs a finite source
  }
}

async function renderRecordingToBuffer() {
  const sr = (audioCtx && audioCtx.sampleRate) || 44100;
  let endTime = 0;
  recordedEvents.forEach(e => {
    const off = e.offT != null ? e.offT : e.onT + 1;
    endTime = Math.max(endTime, Math.max(off, e.onT + e.snap.attack + e.snap.decay) + e.snap.release);
  });
  // Tail padding: delay repeats and reverb decay live PAST the last note-off.
  // Without headroom the tails get chopped, so extend the render when either
  // wet path is active. (Dry take keeps the original tight 0.3 s pad.)
  const fx = patch.fx;
  let tail = 0.3;
  if (fx.delayWet > 0 || fx.reverbWet > 0) {
    tail = Math.max(fx.reverbSize, fx.delayTime * 6) + 0.5;
  }
  const off = new OfflineAudioContext(2, Math.ceil(sr * (endTime + tail)), sr);

  // Offline FX bus: same constructor as live, baked with the export-time knob
  // values (re-amp semantics). Voices → fx.input → dest(volume trim) → master.
  const offFx = makeFxChain(off, fx);
  const dest = off.createGain();
  // match the volume the recording was actually heard at — an offline unity
  // bus here would export louder (and clip harder) than live playback
  dest.gain.value = master ? master.gain.value : patch.volume;
  offFx.output.connect(dest);
  dest.connect(off.destination);
  recordedEvents.forEach(e => {
    const offT = e.offT != null ? e.offT : e.onT + 1;
    scheduleVoice(off, offFx.input, e.midi, e.onT, offT, e.snap);
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

// ---------- Keyboard (17 keys spanning ~1.3 octaves, base shiftable) ----------
const SPAN = 16;                 // semitones from base to top key (C .. E next octave)
const BASE_LOW = 60;             // C4 at octave shift 0
let octaveShift = 0;            // in octaves; clamped so the base stays C2..C6
const MIN_SHIFT = -2, MAX_SHIFT = 2;
function curLow() { return BASE_LOW + octaveShift * 12; }

const BLACK = { 1: 1, 3: 1, 6: 1, 8: 1, 10: 1 }; // semitone offsets that are black keys
function isBlack(m) { return !!BLACK[((m % 12) + 12) % 12]; }

// computer-key → semitone OFFSET from the current base (so it follows the octave)
const KEYMAP = {
  KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6,
  KeyG: 7, KeyY: 8, KeyH: 9, KeyU: 10, KeyJ: 11, KeyK: 12, KeyO: 13,
  KeyL: 14, KeyP: 15, Semicolon: 16
};

function highlightKey(midi, on) {
  const el = document.querySelector('.key[data-midi="' + midi + '"]');
  if (el) el.classList.toggle('down', on);
}

const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
function noteName(m) { return NOTE_NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1); }

function shiftOctave(delta) {
  const next = Math.min(MAX_SHIFT, Math.max(MIN_SHIFT, octaveShift + delta));
  if (next === octaveShift) return;
  // release anything currently held so the old midi notes don't hang
  Object.keys(voices).forEach(m => noteOff(+m));
  octaveShift = next;
  buildKeyboard();
  const lbl = document.getElementById('octaveVal');
  if (lbl) lbl.textContent = noteName(curLow()) + '–' + noteName(curLow() + SPAN);
}

function buildKeyboard() {
  const kb = document.getElementById('keyboard');
  kb.innerHTML = '';
  const LOW = curLow(), HIGH = LOW + SPAN;
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
    // label the C keys so the octave is readable
    if (m % 12 === 0) {
      const lab = document.createElement('span');
      lab.className = 'key-label';
      lab.textContent = noteName(m);
      key.appendChild(lab);
    }
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
// A patch value can be top-level (e.g. 'cutoff') or in the FX bus ('fx.drive').
function getPatch(path) { return path.startsWith('fx.') ? patch.fx[path.slice(3)] : patch[path]; }
function setPatch(path, v) { if (path.startsWith('fx.')) patch.fx[path.slice(3)] = v; else patch[path] = v; }

const registered = []; // {el, out, path, scale, fmt} — drives both input + syncControls

function onParamChange(path) {
  if (path === 'volume' && master) master.gain.value = patch.volume;
  if (path.startsWith('fx.') && fxChain) fxChain.applyFx(patch.fx);
}

function bindControls() {
  const bind = (id, path, fmt) => {
    const el = document.getElementById(id);
    const out = document.getElementById(id + 'Val');
    const scale = el.dataset.scale ? +el.dataset.scale : 1;
    const apply = () => {
      const v = (+el.value) * scale;
      setPatch(path, v);
      onParamChange(path);
      if (out) out.textContent = fmt ? fmt(v) : v;
    };
    el.addEventListener('input', apply);
    registered.push({ el, out, path, scale, fmt });
    apply();
  };
  document.getElementById('wave').addEventListener('change', e => patch.wave = e.target.value);
  // Oscillator / filter / envelope
  bind('cutoff', 'cutoff', v => Math.round(v) + ' Hz');
  bind('resonance', 'resonance', v => v.toFixed(1));
  bind('attack', 'attack', v => (v * 1000).toFixed(0) + ' ms');
  bind('decay', 'decay', v => (v * 1000).toFixed(0) + ' ms');
  bind('sustain', 'sustain', v => Math.round(v * 100) + '%');
  bind('release', 'release', v => (v * 1000).toFixed(0) + ' ms');
  // FX rack
  bind('vibRate', 'vibRate', v => v.toFixed(1) + ' Hz');
  bind('vibDepth', 'vibDepth', v => Math.round(v) + ' ¢');
  bind('drive', 'fx.drive', v => Math.round(v) + '%');
  bind('chorus', 'fx.chorus', v => Math.round(v) + '%');
  bind('delayTime', 'fx.delayTime', v => Math.round(v * 1000) + ' ms');
  bind('delayFeedback', 'fx.delayFeedback', v => Math.round(v * 100) + '%');
  bind('delayWet', 'fx.delayWet', v => Math.round(v * 100) + '%');
  bind('reverbSize', 'fx.reverbSize', v => v.toFixed(1) + ' s');
  bind('reverbWet', 'fx.reverbWet', v => Math.round(v * 100) + '%');
  // Output
  bind('volume', 'volume', v => Math.round(v * 100) + '%');
}

// Push the current patch back OUT to every slider + readout (for presets/load).
function syncControls() {
  registered.forEach(({ el, out, path, scale, fmt }) => {
    const v = getPatch(path);
    el.value = v / scale;
    if (out) out.textContent = fmt ? fmt(v) : v;
  });
  const w = document.getElementById('wave');
  if (w) w.value = patch.wave;
  if (master) master.gain.value = patch.volume;
  if (fxChain) fxChain.applyFx(patch.fx);
}

// ---------- Presets ----------
// Five patches designed to show off the whole rack, plus a clean Init.
const PRESETS = {
  'Init': {
    wave: 'sawtooth', cutoff: 2200, resonance: 6, attack: 0.02, decay: 0.2, sustain: 0.6, release: 0.35,
    volume: 0.25, vibRate: 5, vibDepth: 0,
    fx: { drive: 0, chorus: 0, delayTime: 0.320, delayFeedback: 0, delayWet: 0, reverbSize: 1.8, reverbWet: 0 }
  },
  'Neon Lead': {
    wave: 'sawtooth', cutoff: 3400, resonance: 8, attack: 0.005, decay: 0.15, sustain: 0.7, release: 0.25,
    volume: 0.24, vibRate: 5.5, vibDepth: 6,
    fx: { drive: 45, chorus: 15, delayTime: 0.260, delayFeedback: 0.35, delayWet: 0.3, reverbSize: 1.6, reverbWet: 0.12 }
  },
  'Ghost Pad': {
    wave: 'triangle', cutoff: 1500, resonance: 3, attack: 0.6, decay: 0.4, sustain: 0.8, release: 0.9,
    volume: 0.26, vibRate: 4, vibDepth: 4,
    fx: { drive: 0, chorus: 40, delayTime: 0.400, delayFeedback: 0.3, delayWet: 0.15, reverbSize: 3.0, reverbWet: 0.4 }
  },
  'Grave Bass': {
    wave: 'square', cutoff: 900, resonance: 10, attack: 0.01, decay: 0.16, sustain: 0.55, release: 0.2,
    volume: 0.26, vibRate: 5, vibDepth: 0,
    fx: { drive: 32, chorus: 0, delayTime: 0.300, delayFeedback: 0, delayWet: 0, reverbSize: 1.0, reverbWet: 0.06 }
  },
  'Haunted Bell': {
    wave: 'triangle', cutoff: 5200, resonance: 4, attack: 0.002, decay: 0.5, sustain: 0.15, release: 0.7,
    volume: 0.24, vibRate: 6, vibDepth: 3,
    fx: { drive: 0, chorus: 10, delayTime: 0.300, delayFeedback: 0.4, delayWet: 0.25, reverbSize: 3.2, reverbWet: 0.42 }
  }
};

function applyPreset(p) {
  patch.wave = p.wave;
  patch.cutoff = p.cutoff; patch.resonance = p.resonance;
  patch.attack = p.attack; patch.decay = p.decay; patch.sustain = p.sustain; patch.release = p.release;
  patch.volume = p.volume; patch.vibRate = p.vibRate; patch.vibDepth = p.vibDepth;
  patch.fx = { ...p.fx };
  syncControls();
}

const USER_PATCH_KEY = 'ghostCircuit.synth.userPatch';
function savePatch() {
  const snap = {
    wave: patch.wave, cutoff: patch.cutoff, resonance: patch.resonance,
    attack: patch.attack, decay: patch.decay, sustain: patch.sustain, release: patch.release,
    volume: patch.volume, vibRate: patch.vibRate, vibDepth: patch.vibDepth, fx: { ...patch.fx }
  };
  try { localStorage.setItem(USER_PATCH_KEY, JSON.stringify(snap)); flash('Patch saved'); }
  catch (e) { flash('Save failed'); }
}
function loadPatch() {
  try {
    const raw = localStorage.getItem(USER_PATCH_KEY);
    if (!raw) { flash('No saved patch yet'); return; }
    applyPreset(JSON.parse(raw));
    flash('Patch loaded');
  } catch (e) { flash('Load failed'); }
}
function flash(msg) { setStatus(msg); }

// ---------- Oscilloscope (live only, no export impact) ----------
let scopeRAF = null;
function startScope() {
  const canvas = document.getElementById('scope');
  if (!canvas || !analyser || scopeRAF !== null) return;
  const g = canvas.getContext('2d');
  const buf = new Uint8Array(analyser.fftSize);
  const draw = () => {
    scopeRAF = requestAnimationFrame(draw);
    analyser.getByteTimeDomainData(buf);
    const w = canvas.width, h = canvas.height;
    g.fillStyle = '#191512';
    g.fillRect(0, 0, w, h);
    g.lineWidth = 2;
    g.strokeStyle = '#f0b478';
    g.shadowColor = '#67e8f9';
    g.shadowBlur = 8;
    g.beginPath();
    const slice = w / buf.length;
    for (let i = 0; i < buf.length; i++) {
      const y = (buf[i] / 128) * (h / 2);
      const x = i * slice;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
    g.shadowBlur = 0;
  };
  draw();
}

// ---------- Computer keyboard ----------
window.addEventListener('keydown', e => {
  if (e.repeat) return;
  if (e.code === 'KeyZ') { e.preventDefault(); shiftOctave(-1); return; }
  if (e.code === 'KeyX') { e.preventDefault(); shiftOctave(1); return; }
  const off = KEYMAP[e.code];
  if (off !== undefined) { e.preventDefault(); noteOn(curLow() + off); }
});
window.addEventListener('keyup', e => {
  const off = KEYMAP[e.code];
  if (off !== undefined) { e.preventDefault(); noteOff(curLow() + off); }
});

window.addEventListener('DOMContentLoaded', () => {
  buildKeyboard();
  bindControls();
  document.getElementById('recordBtn').addEventListener('click', toggleRecording);
  document.getElementById('exportWavBtn').addEventListener('click', exportRecordingWav);
  document.getElementById('exportMidiBtn').addEventListener('click', exportRecordingMidi);
  // Preset chips
  document.querySelectorAll('.preset-chip').forEach(btn => {
    btn.addEventListener('click', () => { initAudio(); applyPreset(PRESETS[btn.dataset.preset]); });
  });
  document.getElementById('savePatchBtn').addEventListener('click', savePatch);
  document.getElementById('loadPatchBtn').addEventListener('click', loadPatch);
  // Octave buttons
  document.getElementById('octDown').addEventListener('click', () => shiftOctave(-1));
  document.getElementById('octUp').addEventListener('click', () => shiftOctave(1));
  const lbl = document.getElementById('octaveVal');
  if (lbl) lbl.textContent = noteName(curLow()) + '–' + noteName(curLow() + SPAN);
});
console.log('Ghost Circuit Soft Synth ready');
