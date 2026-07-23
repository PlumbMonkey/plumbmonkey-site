// ============================================================
// GHOST CIRCUIT — Song View
// Arranges clips from the Drum Machine and the Synth on a bar timeline.
// Blocks can be moved along the timeline and stretched to repeat over more
// bars; drum clips can be edited in place. Playback, WAV and MIDI export all
// run through the SAME shared engines the instruments use, so the song
// sounds exactly like the parts did where you made them.
// ============================================================

const STEPS_PER_BAR = 16;
const BEATS_PER_BAR = 4;

let doc = SongStore.load();
let selected = null;          // block id
let editingClipId = null;

// ---------- Audio ----------
let audioCtx = null, master = null;
const liveFx = {};            // clipId -> fx chain on the live context

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    master = audioCtx.createGain();
    // Same headroom the drum machine uses — the song can stack a full beat
    // plus a chord, so gain-staging matters more here, not less.
    master.gain.value = 0.6;
    master.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function fxForClip(clip) {
  if (!liveFx[clip.id]) {
    const chain = SynthEngine.makeFxChain(audioCtx, clip.data.fx);
    const trim = audioCtx.createGain();
    trim.gain.value = clip.data.volume != null ? clip.data.volume : 0.25;
    chain.output.connect(trim);
    trim.connect(master);
    liveFx[clip.id] = chain;
  }
  return liveFx[clip.id];
}

// ---------- Helpers ----------
const clipById = id => doc.clips.find(c => c.id === id);
const blockById = id => doc.blocks.find(b => b.id === id);
function secondsPerStep() { return (60.0 / doc.tempo) / 4; }
function barSeconds() { return secondsPerStep() * STEPS_PER_BAR; }
function totalSteps() { return doc.bars * STEPS_PER_BAR; }

// How many bars one pass of a synth take occupies at the current tempo.
function takeBars(clip) {
  const dur = SynthEngine.takeDuration(clip.data.events);
  return Math.max(1, Math.ceil(dur / barSeconds()));
}
function clipBars(clip) { return clip.kind === 'drum' ? 1 : takeBars(clip); }

function persist() { SongStore.save(doc); }

// ---------- Layout ----------
function barPx() { return window.innerWidth < 860 ? 56 : 84; }

function render() {
  renderLibrary();
  renderTimeline();
  document.getElementById('tempo').value = doc.tempo;
  document.getElementById('tempoVal').textContent = doc.tempo;
  document.getElementById('bars').value = doc.bars;
  document.getElementById('barsVal').textContent = doc.bars;
}

function renderLibrary() {
  const drumWrap = document.getElementById('drumClips');
  const synthWrap = document.getElementById('synthClips');
  drumWrap.innerHTML = '';
  synthWrap.innerHTML = '';
  doc.clips.forEach(clip => {
    const el = document.createElement('div');
    el.className = 'clip' + (clip.kind === 'synth' ? ' synth' : '');
    el.title = 'Add to the ' + (clip.kind === 'drum' ? 'drums' : 'synth') + ' lane';
    const name = document.createElement('span');
    name.className = 'clip-name';
    name.textContent = clip.name;
    const meta = document.createElement('span');
    meta.className = 'clip-meta';
    meta.textContent = clip.kind === 'drum'
      ? hitCount(clip) + ' hits'
      : (clip.data.events || []).length + ' notes';
    const x = document.createElement('span');
    x.className = 'clip-x';
    x.textContent = '×';
    x.title = 'Delete this clip (and remove it from the song)';
    x.addEventListener('click', e => { e.stopPropagation(); deleteClip(clip.id); });
    el.appendChild(name); el.appendChild(meta); el.appendChild(x);
    el.addEventListener('click', () => addBlock(clip));
    (clip.kind === 'drum' ? drumWrap : synthWrap).appendChild(el);
  });
  document.getElementById('clipCount').textContent = doc.clips.length ? '(' + doc.clips.length + ')' : '';
  document.getElementById('emptyNote').style.display = doc.clips.length ? 'none' : '';
}

function hitCount(clip) {
  return (clip.data.pattern || []).reduce((n, row) => n + row.reduce((a, s) => a + (s ? 1 : 0), 0), 0);
}

function renderTimeline() {
  const px = barPx();
  const width = doc.bars * px;

  const ruler = document.getElementById('ruler');
  ruler.innerHTML = '';
  for (let b = 0; b < doc.bars; b++) {
    const t = document.createElement('div');
    t.className = 'bar-tick';
    t.style.width = px + 'px';
    t.textContent = b + 1;
    ruler.appendChild(t);
  }

  ['drum', 'synth'].forEach(lane => {
    const track = document.getElementById(lane === 'drum' ? 'laneDrum' : 'laneSynth');
    track.innerHTML = '';
    track.style.width = width + 'px';
    for (let b = 1; b < doc.bars; b++) {
      const line = document.createElement('div');
      line.className = 'bar-line';
      line.style.left = (b * px) + 'px';
      track.appendChild(line);
    }
    doc.blocks.filter(bl => bl.lane === lane).forEach(bl => {
      const clip = clipById(bl.clipId);
      if (!clip) return;
      const el = document.createElement('div');
      el.className = 'block' + (lane === 'synth' ? ' synth' : '') + (bl.id === selected ? ' selected' : '');
      el.style.left = (bl.startBar * px) + 'px';
      el.style.width = (bl.bars * px - 3) + 'px';
      el.dataset.id = bl.id;
      const nm = document.createElement('span');
      nm.className = 'block-name';
      nm.textContent = clip.name + (bl.bars > 1 ? ' ×' + bl.bars : '');
      el.appendChild(nm);
      const grip = document.createElement('div');
      grip.className = 'grip';
      grip.title = 'Drag to repeat this clip over more bars';
      el.appendChild(grip);
      bindBlock(el, grip, bl);
      track.appendChild(el);
    });
  });
}

// ---------- Adding / removing blocks ----------
function firstFreeBar(lane, len) {
  const used = doc.blocks.filter(b => b.lane === lane);
  let bar = 0;
  // Walk right until a gap of `len` bars is clear — new clips land after
  // whatever is already in the lane rather than stacking on top of it.
  for (let guard = 0; guard < 512; guard++) {
    const clash = used.find(b => bar < b.startBar + b.bars && b.startBar < bar + len);
    if (!clash) return bar;
    bar = clash.startBar + clash.bars;
  }
  return bar;
}

function addBlock(clip) {
  const lane = clip.kind === 'drum' ? 'drum' : 'synth';
  const len = clipBars(clip);
  const startBar = firstFreeBar(lane, len);
  if (startBar + len > doc.bars) {
    doc.bars = Math.min(32, startBar + len);
  }
  const block = { id: SongStore.newId(), clipId: clip.id, lane, startBar, bars: len };
  doc.blocks.push(block);
  selected = block.id;
  persist(); render();
  flash(clip.name + ' added at bar ' + (startBar + 1));
}

function deleteBlock(id) {
  doc.blocks = doc.blocks.filter(b => b.id !== id);
  if (selected === id) selected = null;
  persist(); render();
}

function deleteClip(id) {
  const clip = clipById(id);
  doc.clips = doc.clips.filter(c => c.id !== id);
  doc.blocks = doc.blocks.filter(b => b.clipId !== id);
  if (editingClipId === id) closeEditor();
  persist(); render();
  flash((clip ? clip.name : 'Clip') + ' deleted');
}

// ---------- Block drag: move along the timeline, or stretch to repeat ----------
function bindBlock(el, grip, bl) {
  let mode = null, startX = 0, startBar = 0, startBars = 0, moved = false;

  const begin = (e, m) => {
    e.preventDefault();
    e.stopPropagation();
    mode = m; startX = e.clientX; startBar = bl.startBar; startBars = bl.bars; moved = false;
    selected = bl.id;
    el.setPointerCapture(e.pointerId);
    el.classList.add('dragging');
    renderSelection();
  };

  el.addEventListener('pointerdown', e => { if (e.target !== grip) begin(e, 'move'); });
  grip.addEventListener('pointerdown', e => begin(e, 'resize'));

  el.addEventListener('pointermove', e => {
    if (!mode) return;
    const deltaBars = Math.round((e.clientX - startX) / barPx());
    if (deltaBars !== 0) moved = true;
    if (mode === 'move') {
      bl.startBar = Math.max(0, Math.min(doc.bars - bl.bars, startBar + deltaBars));
    } else {
      bl.bars = Math.max(1, Math.min(doc.bars - bl.startBar, startBars + deltaBars));
    }
    const px = barPx();
    el.style.left = (bl.startBar * px) + 'px';
    el.style.width = (bl.bars * px - 3) + 'px';
    const clip = clipById(bl.clipId);
    el.querySelector('.block-name').textContent = clip.name + (bl.bars > 1 ? ' ×' + bl.bars : '');
  });

  const end = () => {
    if (!mode) return;
    mode = null;
    el.classList.remove('dragging');
    persist();
    // A click that never moved is a selection — open the editor for beats.
    if (!moved) {
      const clip = clipById(bl.clipId);
      if (clip && clip.kind === 'drum') openEditor(clip);
      else closeEditor();
    }
    render();
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}

function renderSelection() {
  document.querySelectorAll('.block').forEach(el =>
    el.classList.toggle('selected', el.dataset.id === selected));
}

// ---------- Inline drum-clip editor ----------
function openEditor(clip) {
  editingClipId = clip.id;
  document.getElementById('editorName').textContent = clip.name;
  const grid = document.getElementById('editorGrid');
  grid.innerHTML = '';
  DrumEngine.TRACKS.forEach((tr, ti) => {
    const label = document.createElement('div');
    label.className = 'ed-label';
    label.textContent = tr.name;
    grid.appendChild(label);
    for (let s = 0; s < STEPS_PER_BAR; s++) {
      const cell = document.createElement('div');
      cell.className = 'ed-cell col-' + s + (s % 4 === 0 ? ' beat' : '');
      if (clip.data.pattern[ti] && clip.data.pattern[ti][s]) cell.classList.add('on');
      cell.addEventListener('click', () => {
        clip.data.pattern[ti][s] ^= 1;
        cell.classList.toggle('on', !!clip.data.pattern[ti][s]);
        if (clip.data.pattern[ti][s]) {
          initAudio();
          DrumEngine.VOICES[tr.id](audioCtx, master, audioCtx.currentTime, 1);
        }
        persist();
        renderLibrary();
      });
      grid.appendChild(cell);
    }
  });
  document.getElementById('editor').classList.add('show');
}
function closeEditor() {
  editingClipId = null;
  document.getElementById('editor').classList.remove('show');
}

// ---------- Transport ----------
let isPlaying = false, loopOn = true;
let songStep = 0, nextNoteTime = 0, timerID = null, endAt = null;
let drawQueue = [];
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD = 0.12;

function scheduleSongStep(step, time) {
  const bar = Math.floor(step / STEPS_PER_BAR);
  const s = step % STEPS_PER_BAR;
  const spb = secondsPerStep();

  doc.blocks.forEach(bl => {
    if (bar < bl.startBar || bar >= bl.startBar + bl.bars) return;
    const clip = clipById(bl.clipId);
    if (!clip) return;
    if (bl.lane === 'drum') {
      DrumEngine.scheduleStep(audioCtx, master, clip.data.pattern, s, time,
        { secondsPerStep: spb, swing: doc.swing });
    } else if (s === 0) {
      // Synth takes retrigger every `takeBars` so a stretched block repeats
      // the riff instead of leaving silence after the first pass.
      const tb = takeBars(clip);
      if ((bar - bl.startBar) % tb === 0) scheduleTake(clip, time);
    }
  });
  drawQueue.push({ step, time });
}

function scheduleTake(clip, atTime) {
  const chain = fxForClip(clip);
  (clip.data.events || []).forEach(ev => {
    const offT = ev.offT != null ? ev.offT : ev.onT + 0.5;
    SynthEngine.scheduleVoice(audioCtx, chain.input, ev.midi, atTime + ev.onT, atTime + offT, ev.snap);
  });
}

function scheduler() {
  while (nextNoteTime < audioCtx.currentTime + SCHEDULE_AHEAD) {
    if (songStep === 0 && endAt !== null) break;   // finished, let the tail ring
    scheduleSongStep(songStep, nextNoteTime);
    nextNoteTime += secondsPerStep();
    songStep++;
    if (songStep >= totalSteps()) {
      songStep = 0;
      if (!loopOn) { endAt = nextNoteTime + 2.2; break; }
    }
  }
}

function play() {
  initAudio();
  if (isPlaying) return;
  if (!doc.blocks.length) { flash('Nothing to play — add a clip to the timeline first'); return; }
  isPlaying = true;
  songStep = 0; endAt = null; drawQueue = [];
  nextNoteTime = audioCtx.currentTime + 0.06;
  timerID = setInterval(scheduler, LOOKAHEAD_MS);
  document.getElementById('playBtn').textContent = '❚❚ Stop';
  document.getElementById('playhead').style.display = 'block';
  requestAnimationFrame(drawPlayhead);
}

function stop() {
  isPlaying = false;
  clearInterval(timerID);
  timerID = null;
  endAt = null;
  document.getElementById('playBtn').textContent = '▶ Play';
  document.getElementById('playhead').style.display = 'none';
  document.querySelectorAll('.ed-cell.playing').forEach(c => c.classList.remove('playing'));
}
function togglePlay() { isPlaying ? stop() : play(); }

let lastDrawnStep = -1;
function drawPlayhead() {
  if (!isPlaying) return;
  const now = audioCtx.currentTime;
  if (endAt !== null && now >= endAt) { stop(); return; }
  let step = lastDrawnStep;
  while (drawQueue.length && drawQueue[0].time < now) step = drawQueue.shift().step;
  if (step !== lastDrawnStep && step >= 0) {
    const px = barPx();
    const labelW = window.innerWidth < 860 ? 52 : 74;
    document.getElementById('playhead').style.left =
      (labelW + (step / STEPS_PER_BAR) * px) + 'px';
    // mirror the playhead into the open beat editor
    if (editingClipId) {
      document.querySelectorAll('.ed-cell.playing').forEach(c => c.classList.remove('playing'));
      document.querySelectorAll('#editorGrid .col-' + (step % STEPS_PER_BAR))
        .forEach(c => c.classList.add('playing'));
    }
    lastDrawnStep = step;
  }
  requestAnimationFrame(drawPlayhead);
}

// ---------- Export ----------
async function renderSongToBuffer() {
  const sr = (audioCtx && audioCtx.sampleRate) || 44100;
  const spb = secondsPerStep();
  const songSeconds = totalSteps() * spb;
  const tail = 3.0;                       // room for reverb/delay tails
  const off = new OfflineAudioContext(2, Math.ceil((songSeconds + tail) * sr), sr);
  const bus = off.createGain();
  bus.gain.value = master ? master.gain.value : 0.6;
  bus.connect(off.destination);

  const offFx = {};                        // clipId -> chain on THIS offline ctx
  const chainFor = clip => {
    if (!offFx[clip.id]) {
      const chain = SynthEngine.makeFxChain(off, clip.data.fx);
      const trim = off.createGain();
      trim.gain.value = clip.data.volume != null ? clip.data.volume : 0.25;
      chain.output.connect(trim);
      trim.connect(bus);
      offFx[clip.id] = chain;
    }
    return offFx[clip.id];
  };

  doc.blocks.forEach(bl => {
    const clip = clipById(bl.clipId);
    if (!clip) return;
    if (bl.lane === 'drum') {
      DrumEngine.schedulePattern(off, bus, clip.data.pattern,
        bl.startBar * barSeconds(), doc.tempo, doc.swing, bl.bars);
    } else {
      const tb = takeBars(clip);
      const chain = chainFor(clip);
      for (let rep = 0; rep * tb < bl.bars; rep++) {
        const at = (bl.startBar + rep * tb) * barSeconds();
        (clip.data.events || []).forEach(ev => {
          const offT = ev.offT != null ? ev.offT : ev.onT + 0.5;
          SynthEngine.scheduleVoice(off, chain.input, ev.midi, at + ev.onT, at + offT, ev.snap);
        });
      }
    }
  });
  return off.startRendering();
}

async function exportWav() {
  if (!doc.blocks.length) { flash('Nothing to export — add a clip to the timeline first'); return; }
  initAudio();
  flash('Rendering…');
  const buffer = await renderSongToBuffer();
  ExportUtils.downloadBlob(ExportUtils.audioBufferToWav(buffer), 'ghost-circuit-song.wav');
  flash('WAV exported');
}

function exportMidi() {
  if (!doc.blocks.length) { flash('Nothing to export — add a clip to the timeline first'); return; }
  const division = 480;
  const ticksPerStep = division / 4;               // 16th notes
  const ticksPerSecond = division * (doc.tempo / 60);
  const events = [];

  doc.blocks.forEach(bl => {
    const clip = clipById(bl.clipId);
    if (!clip) return;
    if (bl.lane === 'drum') {
      for (let rep = 0; rep < bl.bars; rep++) {
        for (let s = 0; s < STEPS_PER_BAR; s++) {
          const swingTicks = (s % 2 === 1) ? Math.round(ticksPerStep * doc.swing) : 0;
          const tick = ((bl.startBar + rep) * STEPS_PER_BAR + s) * ticksPerStep + swingTicks;
          DrumEngine.TRACKS.forEach((tr, ti) => {
            if (clip.data.pattern[ti] && clip.data.pattern[ti][s]) {
              const note = DrumEngine.GM_NOTE[tr.id];
              events.push({ tick, type: 'on', note, velocity: 100, channel: 9 });
              events.push({ tick: tick + 20, type: 'off', note, velocity: 0, channel: 9 });
            }
          });
        }
      }
    } else {
      const tb = takeBars(clip);
      for (let rep = 0; rep * tb < bl.bars; rep++) {
        const at = (bl.startBar + rep * tb) * barSeconds();
        (clip.data.events || []).forEach(ev => {
          const offT = ev.offT != null ? ev.offT : ev.onT + 0.5;
          events.push({ tick: Math.round((at + ev.onT) * ticksPerSecond), type: 'on', note: ev.midi, velocity: 100, channel: 0 });
          events.push({ tick: Math.round((at + offT) * ticksPerSecond), type: 'off', note: ev.midi, velocity: 0, channel: 0 });
        });
      }
    }
  });

  if (!events.length) { flash('Nothing to export — your clips are empty'); return; }
  ExportUtils.downloadBlob(ExportUtils.buildMidiFile(events, division, doc.tempo), 'ghost-circuit-song.mid');
  flash('MIDI exported');
}

// ---------- Chrome ----------
let flashTimer = null;
function flash(msg) {
  const el = document.getElementById('flash');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => el.classList.remove('show'), 1600);
}

window.addEventListener('DOMContentLoaded', () => {
  render();

  document.getElementById('playBtn').addEventListener('click', () => { initAudio(); togglePlay(); });
  const loopBtn = document.getElementById('loopBtn');
  loopBtn.addEventListener('click', () => {
    loopOn = !loopOn;
    loopBtn.classList.toggle('on', loopOn);
  });
  document.getElementById('tempo').addEventListener('input', e => {
    doc.tempo = +e.target.value;
    document.getElementById('tempoVal').textContent = doc.tempo;
    persist();
  });
  document.getElementById('bars').addEventListener('input', e => {
    doc.bars = +e.target.value;
    document.getElementById('barsVal').textContent = doc.bars;
    // Keep every block inside the new length rather than orphaning it
    doc.blocks.forEach(b => {
      b.bars = Math.min(b.bars, doc.bars);
      b.startBar = Math.min(b.startBar, doc.bars - b.bars);
    });
    persist(); renderTimeline();
  });
  document.getElementById('clearBtn').addEventListener('click', () => {
    doc.blocks = [];
    selected = null;
    closeEditor();
    persist(); render();
    flash('Timeline cleared');
  });
  document.getElementById('exportWavBtn').addEventListener('click', exportWav);
  document.getElementById('exportMidiBtn').addEventListener('click', exportMidi);
  document.getElementById('editorClose').addEventListener('click', closeEditor);

  window.addEventListener('keydown', e => {
    if (e.code === 'Space') { e.preventDefault(); initAudio(); togglePlay(); }
    if ((e.code === 'Delete' || e.code === 'Backspace') && selected) {
      e.preventDefault();
      deleteBlock(selected);
    }
  });

  // Bar width changes between the mobile and desktop breakpoints
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderTimeline, 120);
  });

  // Clips pushed from another tab (drum machine / synth) show up on focus
  window.addEventListener('focus', () => {
    const fresh = SongStore.load();
    if (fresh.clips.length !== doc.clips.length) {
      doc.clips = fresh.clips;
      render();
    }
  });
});
console.log('Ghost Circuit Song View ready');
