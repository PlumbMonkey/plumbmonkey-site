// ============================================================
// GHOST CIRCUIT — shared export helpers
// WAV encoding, Standard MIDI File writing, and file download.
// Used by both the drum machine and the synth. No backend.
// ============================================================

// ---------- WAV encoding (16-bit PCM, any channel count) ----------
function audioBufferToWav(buffer) {
  const numCh = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numCh * bytesPerSample;
  const dataSize = numFrames * blockAlign;
  const bufSize = 44 + dataSize;
  const ab = new ArrayBuffer(bufSize);
  const view = new DataView(ab);

  function writeStr(offset, str) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }

  writeStr(0, 'RIFF');
  view.setUint32(4, bufSize - 8, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);                          // fmt chunk size
  view.setUint16(20, 1, true);                            // PCM
  view.setUint16(22, numCh, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);      // byte rate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);                           // bits per sample
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  const channels = [];
  for (let c = 0; c < numCh; c++) channels.push(buffer.getChannelData(c));
  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let c = 0; c < numCh; c++) {
      let s = Math.max(-1, Math.min(1, channels[c][i]));
      s = s < 0 ? s * 0x8000 : s * 0x7fff;
      view.setInt16(offset, s, true);
      offset += 2;
    }
  }
  return new Blob([ab], { type: 'audio/wav' });
}

function downloadBlob(blob, filename) {
  if (window.CreativeHandoff && blob.type.startsWith('audio/')) {
    window.CreativeHandoff.saveAudio(blob, filename).catch(() => {});
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 300);
}

// ---------- Standard MIDI File writer (format 0, single track) ----------
// Classic MIDI variable-length-quantity encoder.
function writeVarLen(value) {
  let buffer = value & 0x7f;
  while ((value >>= 7) > 0) {
    buffer <<= 8;
    buffer |= (value & 0x7f) | 0x80;
  }
  const bytes = [];
  while (true) {
    bytes.push(buffer & 0xff);
    if (buffer & 0x80) buffer >>= 8;
    else break;
  }
  return bytes;
}

// events: [{ tick, type: 'on'|'off', note, velocity, channel }] — any order, will be sorted.
// division: ticks per quarter note. tempoBpm: written as a tempo meta event at tick 0.
function buildMidiFile(events, division, tempoBpm) {
  const sorted = events.slice().sort((a, b) => {
    if (a.tick !== b.tick) return a.tick - b.tick;
    return (a.type === 'off' ? 0 : 1) - (b.type === 'off' ? 0 : 1); // offs before ons on a tie
  });

  const trackBytes = [];
  const usPerQuarter = Math.round(60000000 / tempoBpm);
  trackBytes.push(...writeVarLen(0), 0xff, 0x51, 0x03,
    (usPerQuarter >> 16) & 0xff, (usPerQuarter >> 8) & 0xff, usPerQuarter & 0xff);

  let lastTick = 0;
  sorted.forEach(ev => {
    const delta = Math.max(0, ev.tick - lastTick);
    lastTick = ev.tick;
    const status = (ev.type === 'on' ? 0x90 : 0x80) | (ev.channel & 0x0f);
    trackBytes.push(...writeVarLen(delta), status, ev.note & 0x7f, ev.velocity & 0x7f);
  });
  trackBytes.push(...writeVarLen(0), 0xff, 0x2f, 0x00); // end of track

  const header = [
    0x4d, 0x54, 0x68, 0x64, // 'MThd'
    0x00, 0x00, 0x00, 0x06,
    0x00, 0x00,             // format 0
    0x00, 0x01,             // 1 track
    (division >> 8) & 0xff, division & 0xff
  ];
  const trackHeader = [
    0x4d, 0x54, 0x72, 0x6b, // 'MTrk'
    (trackBytes.length >>> 24) & 0xff,
    (trackBytes.length >>> 16) & 0xff,
    (trackBytes.length >>> 8) & 0xff,
    trackBytes.length & 0xff
  ];
  const all = new Uint8Array(header.length + trackHeader.length + trackBytes.length);
  all.set(header, 0);
  all.set(trackHeader, header.length);
  all.set(trackBytes, header.length + trackHeader.length);
  return new Blob([all], { type: 'audio/midi' });
}

window.ExportUtils = { audioBufferToWav, downloadBlob, writeVarLen, buildMidiFile };
console.log('Ghost Circuit export utils ready');
