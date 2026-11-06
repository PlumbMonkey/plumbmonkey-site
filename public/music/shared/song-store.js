// ============================================================
// GHOST CIRCUIT — song store
// The bridge between the three pages. The Drum Machine and the Synth push
// finished loops/takes into a shared clip library; the Song view arranges
// those clips on a bar timeline. Everything lives in one versioned
// localStorage document — no backend, survives a refresh.
//
//   doc = {
//     v: 1,
//     tempo, swing, bars,
//     clips: [ { id, kind:'drum'|'synth', name, created, data } ],
//     blocks: [ { id, clipId, lane:'drum'|'synth', startBar, bars } ]
//   }
//
// A drum clip's data is { pattern, swing }; a synth clip's data is
// { events, fx } — the recorded note list plus the FX settings it was
// played through, so the Song view can reproduce it exactly.
// ============================================================

(function () {
  const KEY = 'ghostCircuit.song.v1';
  const VERSION = 1;

  function blank() {
    return { v: VERSION, tempo: 120, swing: 0, bars: 8, clips: [], blocks: [] };
  }

  function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return blank();
      const doc = JSON.parse(raw);
      if (!doc || doc.v !== VERSION) return blank();
      // Defensive: an older or hand-edited doc shouldn't crash the arranger.
      doc.clips = Array.isArray(doc.clips) ? doc.clips : [];
      doc.blocks = Array.isArray(doc.blocks) ? doc.blocks : [];
      doc.tempo = doc.tempo || 120;
      doc.swing = doc.swing || 0;
      doc.bars = doc.bars || 8;
      return doc;
    } catch (e) { return blank(); }
  }

  function save(doc) {
    try { localStorage.setItem(KEY, JSON.stringify(doc)); return true; }
    catch (e) { return false; }
  }

  // Push a clip into the library from an instrument page. Returns the clip,
  // or null if it couldn't be stored.
  function addClip(kind, name, data) {
    const doc = load();
    const clip = { id: newId(), kind, name, created: Date.now(), data };
    doc.clips.push(clip);
    return save(doc) ? clip : null;
  }

  function clipsOfKind(kind) {
    return load().clips.filter(c => c.kind === kind);
  }

  // Auto-name clips so a user who never types a name still gets a usable
  // library: "Beat 1", "Beat 2", "Riff 1"…
  function nextName(kind) {
    const stem = kind === 'drum' ? 'Beat' : 'Riff';
    const used = clipsOfKind(kind).length;
    return stem + ' ' + (used + 1);
  }

  window.SongStore = { KEY, blank, newId, load, save, addClip, clipsOfKind, nextName };
})();
console.log('Ghost Circuit song store ready');
