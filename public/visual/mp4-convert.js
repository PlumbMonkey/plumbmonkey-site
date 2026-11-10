// ============================================================
// WebM -> MP4 in the browser, no libraries.
// The browser's own codecs (WebCodecs) do the heavy lifting: a small WebM
// demuxer feeds VideoDecoder, frames are re-timed to a constant frame rate
// (MediaRecorder output is variable-rate even when tagged otherwise), then
// VideoEncoder makes H.264 and a small muxer writes a fast-start MP4.
// Audio becomes AAC where the browser can encode it, else Opus is copied.
// Port of the desktop WebMToMP4 tool's behaviour.
// ============================================================

(function (global) {
  'use strict';

  // ---------- WebM / Matroska demux ----------
  const ID = {
    SEGMENT: 0x18538067, CLUSTER: 0x1F43B675, INFO: 0x1549A966, TIMECODE_SCALE: 0x2AD7B1,
    TRACKS: 0x1654AE6B, TRACK_ENTRY: 0xAE, TRACK_NUMBER: 0xD7, TRACK_TYPE: 0x83,
    CODEC_ID: 0x86, CODEC_PRIVATE: 0x63A2, VIDEO: 0xE0, PIXEL_WIDTH: 0xB0, PIXEL_HEIGHT: 0xBA,
    AUDIO: 0xE1, SAMPLING_FREQ: 0xB5, CHANNELS: 0x9F, TIMECODE: 0xE7,
    SIMPLE_BLOCK: 0xA3, BLOCK_GROUP: 0xA0, BLOCK: 0xA1, REFERENCE_BLOCK: 0xFB
  };

  function readId(u8, pos) {
    const b = u8[pos];
    if (b === undefined) return null;
    let len = 1, mask = 0x80;
    while (len <= 4 && !(b & mask)) { len++; mask >>= 1; }
    if (len > 4 || pos + len > u8.length) return null;
    let id = 0;
    for (let i = 0; i < len; i++) id = id * 256 + u8[pos + i];
    return { len, id };
  }

  function readVint(u8, pos) {
    const b = u8[pos];
    if (b === undefined) return null;
    let len = 1, mask = 0x80;
    while (len <= 8 && !(b & mask)) { len++; mask >>= 1; }
    if (len > 8 || pos + len > u8.length) return null;
    let value = b & (mask - 1), unknown = value === mask - 1;
    for (let i = 1; i < len; i++) {
      value = value * 256 + u8[pos + i];
      if (u8[pos + i] !== 0xff) unknown = false;
    }
    return { len, value, unknown };
  }

  function readUint(u8, start, end) {
    let v = 0;
    for (let i = start; i < end; i++) v = v * 256 + u8[i];
    return v;
  }

  function readFloat(dv, start, end) {
    return end - start === 4 ? dv.getFloat32(start) : end - start === 8 ? dv.getFloat64(start) : 0;
  }

  // Calls fn(id, dataStart, dataEnd) for each child element in [start, end)
  function eachChild(u8, start, end, fn) {
    let pos = start;
    while (pos < end) {
      const id = readId(u8, pos); if (!id) return;
      const size = readVint(u8, pos + id.len); if (!size) return;
      const s = pos + id.len + size.len;
      const e = size.unknown ? end : Math.min(end, s + size.value);
      fn(id.id, s, e);
      pos = e;
    }
  }

  // Opus packet length in 48 kHz samples, from its TOC byte (RFC 6716 §3.1)
  function opusSamples(pkt) {
    if (!pkt.length) return 960;
    const toc = pkt[0], config = toc >> 3;
    const ms = config < 12 ? [10, 20, 40, 60][config & 3]
      : config < 16 ? [10, 20][config & 1]
      : [2.5, 5, 10, 20][config & 3];
    const c = toc & 3;
    const frames = c === 0 ? 1 : c < 3 ? 2 : (pkt[1] & 0x3f) || 1;
    return Math.round(frames * ms * 48);
  }

  function videoCodecString(t) {
    switch (t.codecId) {
      case 'V_VP9': return 'vp09.00.10.08';
      case 'V_VP8': return 'vp8';
      case 'V_AV1': return 'av01.0.08M.08';
      case 'V_MPEG4/ISO/AVC': {
        const p = t.codecPrivate;
        if (!p || p.length < 4) return null;
        return 'avc1.' + [p[1], p[2], p[3]].map(b => b.toString(16).padStart(2, '0')).join('');
      }
      default: return null;
    }
  }

  function demux(buffer) {
    const u8 = new Uint8Array(buffer), dv = new DataView(buffer);
    const head = readId(u8, 0);
    if (!head || head.id !== 0x1A45DFA3) throw new Error('That file is not a WebM video');

    let scaleNs = 1e6, clusterTc = 0;
    const tracks = new Map();
    const packets = { video: [], audio: [] };
    let videoTrack = null, audioTrack = null;

    const parseTracks = (s, e) => eachChild(u8, s, e, (id, ts, te) => {
      if (id !== ID.TRACK_ENTRY) return;
      const t = { number: 0, type: 0, codecId: '', codecPrivate: null, width: 0, height: 0, sampleRate: 48000, channels: 2 };
      eachChild(u8, ts, te, (cid, cs, ce) => {
        if (cid === ID.TRACK_NUMBER) t.number = readUint(u8, cs, ce);
        else if (cid === ID.TRACK_TYPE) t.type = readUint(u8, cs, ce);
        else if (cid === ID.CODEC_ID) t.codecId = new TextDecoder().decode(u8.subarray(cs, ce)).replace(/\0+$/, '');
        else if (cid === ID.CODEC_PRIVATE) t.codecPrivate = u8.slice(cs, ce);
        else if (cid === ID.VIDEO) eachChild(u8, cs, ce, (vid, vs, ve) => {
          if (vid === ID.PIXEL_WIDTH) t.width = readUint(u8, vs, ve);
          else if (vid === ID.PIXEL_HEIGHT) t.height = readUint(u8, vs, ve);
        });
        else if (cid === ID.AUDIO) eachChild(u8, cs, ce, (aid, as, ae) => {
          if (aid === ID.SAMPLING_FREQ) t.sampleRate = readFloat(dv, as, ae) || 48000;
          else if (aid === ID.CHANNELS) t.channels = readUint(u8, as, ae) || 2;
        });
      });
      tracks.set(t.number, t);
      if (t.type === 1 && !videoTrack) videoTrack = t;
      if (t.type === 2 && !audioTrack) audioTrack = t;
    });

    const parseBlock = (s, e, keyOverride) => {
      const tn = readVint(u8, s); if (!tn) return;
      let p = s + tn.len;
      if (p + 3 > e) return;
      const t = tracks.get(tn.value);
      if (!t || (t !== videoTrack && t !== audioTrack)) return;
      const rel = dv.getInt16(p), flags = u8[p + 2];
      p += 3;
      const key = keyOverride !== undefined ? keyOverride : !!(flags & 0x80);
      const lacing = (flags >> 1) & 3;
      let sizes;
      if (lacing === 0) sizes = [e - p];
      else {
        const count = u8[p++] + 1;
        sizes = [];
        if (lacing === 1) { // Xiph
          for (let i = 0; i < count - 1; i++) {
            let n = 0, b;
            do { b = u8[p++]; n += b; } while (b === 255);
            sizes.push(n);
          }
        } else if (lacing === 3) { // EBML
          const first = readVint(u8, p); p += first.len;
          sizes.push(first.value);
          for (let i = 1; i < count - 1; i++) {
            const d = readVint(u8, p); p += d.len;
            sizes.push(sizes[i - 1] + d.value - (Math.pow(2, 7 * d.len - 1) - 1));
          }
        } else { // fixed
          const each = Math.floor((e - p) / count);
          for (let i = 0; i < count - 1; i++) sizes.push(each);
        }
        sizes.push(e - p - sizes.reduce((a, b) => a + b, 0));
      }
      let tsUs = (clusterTc + rel) * scaleNs / 1000;
      for (const size of sizes) {
        if (size <= 0 || p + size > e) break;
        const data = u8.subarray(p, p + size);
        p += size;
        if (t === videoTrack) packets.video.push({ ts: tsUs, key, data });
        else {
          const dur = t.codecId === 'A_OPUS' ? opusSamples(data) / 48000 * 1e6 : 0;
          packets.audio.push({ ts: tsUs, key: true, data, dur });
          tsUs += dur;
        }
      }
    };

    // Flat walk: step INTO Segment and Cluster (often "unknown size" in
    // browser recordings), skip over everything else by its size.
    let pos = 0;
    while (pos < u8.length) {
      const id = readId(u8, pos); if (!id) break;
      const size = readVint(u8, pos + id.len); if (!size) break;
      const s = pos + id.len + size.len;
      if (id.id === ID.SEGMENT || id.id === ID.CLUSTER) { pos = s; continue; }
      if (!size.unknown && s + size.value > u8.length) break; // truncated tail
      const e = size.unknown ? u8.length : s + size.value;
      if (id.id === ID.INFO) eachChild(u8, s, e, (cid, cs, ce) => { if (cid === ID.TIMECODE_SCALE) scaleNs = readUint(u8, cs, ce) || 1e6; });
      else if (id.id === ID.TRACKS) parseTracks(s, e);
      else if (id.id === ID.TIMECODE) clusterTc = readUint(u8, s, e);
      else if (id.id === ID.SIMPLE_BLOCK) parseBlock(s, e);
      else if (id.id === ID.BLOCK_GROUP) {
        let block = null, hasRef = false;
        eachChild(u8, s, e, (cid, cs, ce) => {
          if (cid === ID.BLOCK) block = [cs, ce];
          else if (cid === ID.REFERENCE_BLOCK) hasRef = true;
        });
        if (block) parseBlock(block[0], block[1], !hasRef);
      }
      pos = e;
    }

    if (!videoTrack || !packets.video.length) throw new Error('No video found in that file');
    const vcodec = videoCodecString(videoTrack);
    if (!vcodec) throw new Error('Unsupported video codec ' + videoTrack.codecId);

    const v = packets.video, a = packets.audio;
    const base = Math.min(v[0].ts, a.length ? a[0].ts : Infinity);
    let maxV = -Infinity;
    for (const p of v) { p.ts -= base; if (p.ts > maxV) maxV = p.ts; }
    for (const p of a) p.ts -= base;
    const measuredFps = v.length > 1 ? (v.length - 1) / ((maxV - v[0].ts) / 1e6) : 30;
    const videoEnd = maxV + 1e6 / measuredFps;
    const audioEnd = a.length ? a[a.length - 1].ts + (a[a.length - 1].dur || 0) : 0;
    const audioOk = audioTrack && audioTrack.codecId === 'A_OPUS' && a.length > 0;

    return {
      video: { codec: vcodec, codecId: videoTrack.codecId, description: videoTrack.codecId === 'V_MPEG4/ISO/AVC' ? videoTrack.codecPrivate : undefined, width: videoTrack.width, height: videoTrack.height, packets: v },
      audio: audioOk ? { codecId: 'A_OPUS', sampleRate: Math.round(audioTrack.sampleRate), channels: audioTrack.channels, opusHead: audioTrack.codecPrivate, packets: a } : null,
      audioSkipped: audioTrack && !audioOk ? audioTrack.codecId : null,
      durationUs: Math.max(videoEnd, audioEnd),
      measuredFps
    };
  }

  // ---------- frame rate + sizing ----------
  const RATES = [[24000, 1001], [24, 1], [25, 1], [30000, 1001], [30, 1], [48, 1], [50, 1], [60000, 1001], [60, 1]];

  // A measured 29.98 really means 29.97 — snap within 1% like the desktop tool
  function snapRate(fps) {
    let best = RATES[0];
    for (const r of RATES) if (Math.abs(r[0] / r[1] - fps) < Math.abs(best[0] / best[1] - fps)) best = r;
    if (Math.abs(best[0] / best[1] - fps) / fps <= 0.01) return best;
    return [Math.max(1, Math.round(fps)), 1];
  }

  function rateLabel(r) { return String(+(r[0] / r[1]).toFixed(3)); }

  // "720p" names the short edge; never upscale; H.264 needs even sizes
  function outputSize(w, h, target) {
    const even = n => Math.max(2, Math.round(n / 2) * 2);
    if (!target || target === 'original') return { width: even(w), height: even(h) };
    const t = +target;
    if (w >= h) { const oh = Math.min(t, h); return { width: even(w * oh / h), height: even(oh) }; }
    const ow = Math.min(t, w); return { width: even(ow), height: even(h * ow / w) };
  }

  function avcCodecs(width, height, fps) {
    const mbs = Math.ceil(width / 16) * Math.ceil(height / 16), rate = mbs * fps;
    const levels = [[0x1F, 3600, 108000], [0x28, 8192, 245760], [0x2A, 8704, 522240], [0x32, 22080, 589824], [0x33, 36864, 983040], [0x34, 36864, 2073600]];
    const lv = (levels.find(l => mbs <= l[1] && rate <= l[2]) || levels[levels.length - 1])[0].toString(16).padStart(2, '0');
    return ['avc1.6400' + lv, 'avc1.4d00' + lv, 'avc1.4200' + lv];
  }

  const QUALITY_BPP = { high: 0.14, balanced: 0.09, small: 0.055 };

  async function pickEncoderConfig(width, height, rate, quality) {
    const fps = rate[0] / rate[1];
    const bitrate = Math.round(width * height * fps * (QUALITY_BPP[quality] || QUALITY_BPP.balanced));
    for (const codec of avcCodecs(width, height, fps)) {
      for (const hardwareAcceleration of ['no-preference', 'prefer-software']) {
        const config = { codec, width, height, bitrate, framerate: fps, avc: { format: 'avc' }, latencyMode: 'quality', hardwareAcceleration };
        try {
          const s = await VideoEncoder.isConfigSupported(config);
          if (s.supported) return s.config;
        } catch (e) { /* try the next profile */ }
      }
    }
    return null;
  }

  async function isSupported() {
    if (typeof VideoEncoder === 'undefined' || typeof VideoDecoder === 'undefined' || typeof VideoFrame === 'undefined') return false;
    return !!(await pickEncoderConfig(1280, 720, [30, 1], 'balanced'));
  }

  // ---------- transcode ----------
  function makeQueueWaiter(...codecs) {
    return () => new Promise(resolve => {
      let timer = 0;
      const done = () => {
        clearTimeout(timer);
        codecs.forEach(c => c.removeEventListener && c.removeEventListener('dequeue', done));
        resolve();
      };
      codecs.forEach(c => c.addEventListener && c.addEventListener('dequeue', done));
      timer = setTimeout(done, 50); // fallback where 'dequeue' is missing
    });
  }

  function toBytes(d) {
    return ArrayBuffer.isView(d) ? new Uint8Array(d.buffer, d.byteOffset, d.byteLength).slice() : new Uint8Array(d).slice();
  }

  function closeAll(...codecs) {
    for (const c of codecs) if (c.state !== 'closed') { try { c.close(); } catch (e) {} }
  }

  function checkAbort(signal) {
    if (signal && signal.aborted) throw new DOMException('Conversion cancelled', 'AbortError');
  }

  async function transcodeAudio(src, signal) {
    const ch = src.channels, sr = 48000;
    const aac = { codec: 'mp4a.40.2', sampleRate: sr, numberOfChannels: ch, bitrate: 192000 };
    let aacOk = false;
    try { aacOk = typeof AudioEncoder !== 'undefined' && typeof AudioDecoder !== 'undefined' && (await AudioEncoder.isConfigSupported(aac)).supported; } catch (e) {}

    if (!aacOk) {
      // Copy Opus straight across — valid MP4, and no quality loss
      return {
        kind: 'opus', sampleRate: sr, channels: ch, opusHead: src.opusHead,
        samples: src.packets.map(p => ({ data: p.data, ts: Math.round(p.ts * sr / 1e6), dur: opusSamples(p.data) }))
      };
    }

    const samples = [];
    let description = null, failure = null;
    const encoder = new AudioEncoder({
      output: (chunk, meta) => {
        if (meta && meta.decoderConfig && meta.decoderConfig.description && !description)
          description = toBytes(meta.decoderConfig.description);
        const data = new Uint8Array(chunk.byteLength);
        chunk.copyTo(data);
        samples.push({ data, ts: Math.round(chunk.timestamp * sr / 1e6), dur: 1024 });
      },
      error: e => { failure = e; }
    });
    encoder.configure(aac);
    const decoder = new AudioDecoder({
      output: audio => { if (!failure) encoder.encode(audio); audio.close(); },
      error: e => { failure = e; }
    });
    try {
      decoder.configure({ codec: 'opus', sampleRate: src.sampleRate || sr, numberOfChannels: ch, description: src.opusHead || undefined });
      const wait = makeQueueWaiter(decoder, encoder);
      for (const p of src.packets) {
        checkAbort(signal);
        if (failure) throw failure;
        decoder.decode(new EncodedAudioChunk({ type: 'key', timestamp: Math.round(p.ts), duration: Math.round(p.dur), data: p.data }));
        while (decoder.decodeQueueSize > 20 || encoder.encodeQueueSize > 20) await wait();
      }
      await decoder.flush();
      await encoder.flush();
    } finally {
      closeAll(decoder, encoder);
    }
    if (failure) throw failure;
    if (!description) { // AudioSpecificConfig: AAC-LC, 48 kHz
      description = new Uint8Array([(2 << 3) | (3 >> 1), ((3 & 1) << 7) | (ch << 3)]);
    }
    return { kind: 'aac', sampleRate: sr, channels: ch, description, samples };
  }

  async function transcodeVideo(src, opts, rate, size, signal, progress) {
    const encConfig = await pickEncoderConfig(size.width, size.height, rate, opts.quality);
    if (!encConfig) throw new Error('This browser cannot encode H.264 video');
    const decConfig = { codec: src.codec, codedWidth: src.width, codedHeight: src.height };
    if (src.description) decConfig.description = src.description;
    const decSupport = await VideoDecoder.isConfigSupported(decConfig).catch(() => ({ supported: false }));
    if (!decSupport.supported) throw new Error('This browser cannot decode ' + src.codecId + ' video');

    const [num, den] = rate;
    const totalFrames = Math.max(1, Math.round(opts.durationUs * num / (den * 1e6)));
    const frameUs = 1e6 * den / num;
    const tUs = i => Math.round(i * frameUs);
    const gop = Math.max(1, Math.round(2 * num / den)); // keyframe every ~2 s

    const samples = [];
    let description = null, colorSpace = null, failure = null, next = 0, current = null;
    const canvas = new OffscreenCanvas(size.width, size.height);
    const ctx = canvas.getContext('2d');

    const encoder = new VideoEncoder({
      output: (chunk, meta) => {
        if (meta && meta.decoderConfig && meta.decoderConfig.description && !description)
          description = toBytes(meta.decoderConfig.description);
        if (meta && meta.decoderConfig && meta.decoderConfig.colorSpace && !colorSpace) colorSpace = meta.decoderConfig.colorSpace;
        const data = new Uint8Array(chunk.byteLength);
        chunk.copyTo(data);
        samples.push({ data, pts: Math.round(chunk.timestamp / frameUs), key: chunk.type === 'key' });
        progress(samples.length / totalFrames);
      },
      error: e => { failure = e; }
    });
    encoder.configure(encConfig);

    const emit = () => {
      const f = new VideoFrame(current, { timestamp: tUs(next), duration: Math.round(frameUs) });
      encoder.encode(f, { keyFrame: next % gop === 0 });
      f.close();
      next++;
    };
    // Constant-rate output: frame i shows the latest source frame at or before i/fps
    const onFrame = frame => {
      if (failure) { frame.close(); return; }
      let pic = frame;
      if (frame.displayWidth !== size.width || frame.displayHeight !== size.height) {
        ctx.drawImage(frame, 0, 0, size.width, size.height);
        pic = new VideoFrame(canvas, { timestamp: frame.timestamp });
        frame.close();
      }
      if (!current) current = pic;
      while (next < totalFrames && tUs(next) < pic.timestamp) emit();
      if (current !== pic) current.close();
      current = pic;
    };
    const decoder = new VideoDecoder({ output: onFrame, error: e => { failure = e; } });
    try {
      decoder.configure(decConfig);
      const wait = makeQueueWaiter(decoder, encoder);
      let started = false;
      for (const p of src.packets) {
        checkAbort(signal);
        if (failure) throw failure;
        if (!started && !p.key) continue; // decoding must begin on a keyframe
        started = true;
        decoder.decode(new EncodedVideoChunk({ type: p.key ? 'key' : 'delta', timestamp: Math.round(p.ts), data: p.data }));
        while (decoder.decodeQueueSize > 4 || encoder.encodeQueueSize > 8) await wait();
      }
      await decoder.flush();
      if (failure) throw failure;
      while (current && next < totalFrames) {
        checkAbort(signal);
        emit();
        if (encoder.encodeQueueSize > 8) await wait();
      }
      await encoder.flush();
    } finally {
      // Runs on cancel and errors too, so no codec keeps calling back
      closeAll(decoder, encoder);
      if (current) { current.close(); current = null; }
    }
    if (failure) throw failure;
    if (!description) throw new Error('The H.264 encoder returned no configuration');
    return { width: size.width, height: size.height, timescale: num, delta: den, description, colorSpace, samples, codec: encConfig.codec };
  }

  // ---------- MP4 mux ----------
  const enc = new TextEncoder();
  function u32(n) { return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]; }
  function u16(n) { return [(n >> 8) & 255, n & 255]; }
  function i32(n) { return u32(n >>> 0); }
  function bytes(...parts) {
    let len = 0;
    for (const p of parts) len += p.length;
    const out = new Uint8Array(len);
    let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  }
  function box(type, ...parts) {
    const body = bytes(...parts.map(p => p instanceof Uint8Array ? p : Uint8Array.from(p)));
    return bytes(Uint8Array.from(u32(body.length + 8)), enc.encode(type), body);
  }
  function fullBox(type, version, flags, ...parts) {
    return box(type, [version, (flags >> 16) & 255, (flags >> 8) & 255, flags & 255], ...parts);
  }
  const MATRIX = [].concat(u32(0x10000), u32(0), u32(0), u32(0), u32(0x10000), u32(0), u32(0), u32(0), u32(0x40000000));

  function runLength(values) {
    const runs = [];
    for (const v of values) {
      const last = runs[runs.length - 1];
      if (last && last[1] === v) last[0]++; else runs.push([1, v]);
    }
    return runs;
  }

  function sampleTables(track, offsets) {
    const s = track.samples;
    const stts = fullBox('stts', 0, 0, u32(track.sttsRuns.length), ...track.sttsRuns.map(([c, d]) => u32(c).concat(u32(d))));
    const parts = [stts];
    if (track.cttsRuns) parts.push(fullBox('ctts', 1, 0, u32(track.cttsRuns.length), ...track.cttsRuns.map(([c, d]) => u32(c).concat(i32(d)))));
    if (track.type === 'video') {
      const keys = [];
      s.forEach((x, i) => { if (x.key) keys.push(i + 1); });
      parts.push(fullBox('stss', 0, 0, u32(keys.length), ...keys.map(u32)));
    }
    parts.push(fullBox('stsc', 0, 0, u32(1), u32(1), u32(1), u32(1)));
    const sizes = new Uint8Array(s.length * 4), sv = new DataView(sizes.buffer);
    s.forEach((x, i) => sv.setUint32(i * 4, x.data.length));
    parts.push(fullBox('stsz', 0, 0, u32(0), u32(s.length), sizes));
    const big = offsets.length && offsets[offsets.length - 1] > 0xFFFFFFFF;
    const offs = new Uint8Array(offsets.length * (big ? 8 : 4)), ov = new DataView(offs.buffer);
    offsets.forEach((o, i) => {
      if (big) { ov.setUint32(i * 8, Math.floor(o / 0x100000000)); ov.setUint32(i * 8 + 4, o >>> 0); }
      else ov.setUint32(i * 4, o);
    });
    parts.push(fullBox(big ? 'co64' : 'stco', 0, 0, u32(offsets.length), offs));
    return parts;
  }

  // Chrome's encoders write BT.709 but leave the H.264 stream unlabelled, so
  // players guess BT.601 and colours shift. Label it in the MP4 instead.
  function colrBox(cs) {
    cs = cs || {};
    const primaries = { bt709: 1, bt470bg: 5, smpte170m: 6, bt2020: 9, smpte432: 12 }[cs.primaries] || 1;
    // sRGB transfer (13) is barely supported by players; BT.709 looks the same
    const transfer = { bt709: 1, smpte170m: 6, 'iec61966-2-1': 1, linear: 8, pq: 16, hlg: 18 }[cs.transfer] || 1;
    const matrix = { rgb: 0, bt709: 1, bt470bg: 5, smpte170m: 6, 'bt2020-ncl': 9 }[cs.matrix] || 1;
    return box('colr', enc.encode('nclx'), u16(primaries), u16(transfer), u16(matrix), [cs.fullRange ? 0x80 : 0]);
  }

  function sampleEntry(track) {
    if (track.type === 'video') {
      return box('avc1', new Array(6).fill(0), u16(1), new Array(16).fill(0), u16(track.width), u16(track.height),
        u32(0x00480000), u32(0x00480000), u32(0), u16(1), new Array(32).fill(0), u16(0x18), u16(0xFFFF),
        box('avcC', track.description), colrBox(track.colorSpace), box('pasp', u32(1), u32(1)));
    }
    const audioHead = [].concat(new Array(6).fill(0), u16(1), new Array(8).fill(0), u16(track.channels), u16(16), u16(0), u16(0), u32(track.sampleRate << 16));
    if (track.kind === 'aac') {
      const asc = Array.from(track.description);
      const dsi = [0x05, asc.length].concat(asc);
      const dcd = [0x04, 13 + dsi.length, 0x40, 0x15, 0, 0, 0].concat(u32(0), u32(192000), dsi);
      const es = [0x03, 3 + dcd.length + 3].concat(u16(1), [0], dcd, [0x06, 1, 0x02]);
      return box('mp4a', audioHead, fullBox('esds', 0, 0, es));
    }
    // Opus-in-ISOBMFF: dOps is OpusHead minus magic/version, big-endian
    const h = track.opusHead;
    let dops;
    if (h && h.length >= 19) {
      const hv = new DataView(h.buffer, h.byteOffset, h.byteLength);
      dops = [0, h[9]].concat(u16(hv.getUint16(10, true)), u32(hv.getUint32(12, true)), u16(hv.getUint16(16, true) & 0xFFFF), [h[18]], Array.from(h.subarray(19)));
    } else dops = [0, track.channels].concat(u16(312), u32(48000), u16(0), [0]);
    return box('Opus', audioHead, box('dOps', dops));
  }

  function trak(track, id, offsets, movieDuration) {
    const isVideo = track.type === 'video';
    const tkhd = fullBox('tkhd', 0, 3, u32(0), u32(0), u32(id), u32(0), u32(track.movieDuration), new Array(8).fill(0),
      u16(0), u16(0), u16(isVideo ? 0 : 0x0100), u16(0), MATRIX, u32(isVideo ? track.width << 16 : 0), u32(isVideo ? track.height << 16 : 0));
    const parts = [tkhd];
    if (track.startOffset > 0) { // audio that starts after 0:00 keeps its place
      parts.push(box('edts', fullBox('elst', 0, 0, u32(2), u32(track.startOffset), i32(-1), u32(0x10000),
        u32(Math.max(0, track.movieDuration - track.startOffset)), u32(0), u32(0x10000))));
    }
    const hdlr = fullBox('hdlr', 0, 0, u32(0), enc.encode(isVideo ? 'vide' : 'soun'), new Array(12).fill(0), enc.encode(isVideo ? 'VideoHandler\0' : 'SoundHandler\0'));
    const mhd = isVideo ? fullBox('vmhd', 0, 1, new Array(8).fill(0)) : fullBox('smhd', 0, 0, u32(0));
    const dinf = box('dinf', fullBox('dref', 0, 0, u32(1), fullBox('url ', 0, 1)));
    const stbl = box('stbl', fullBox('stsd', 0, 0, u32(1), sampleEntry(track)), ...sampleTables(track, offsets));
    parts.push(box('mdia', fullBox('mdhd', 0, 0, u32(0), u32(0), u32(track.timescale), u32(track.mediaDuration), u16(0x55C4), u16(0)),
      hdlr, box('minf', mhd, dinf, stbl)));
    return box('trak', ...parts);
  }

  function prepareVideoTrack(v) {
    const pts = v.samples.map(s => s.pts);
    const dts = pts.slice().sort((a, b) => a - b);
    const reordered = pts.some((p, i) => p !== dts[i]);
    const deltas = dts.map((d, i) => i + 1 < dts.length ? (dts[i + 1] - d) * v.delta : v.delta);
    return Object.assign({}, v, {
      type: 'video',
      sttsRuns: runLength(deltas),
      cttsRuns: reordered ? runLength(pts.map((p, i) => (p - dts[i]) * v.delta)) : null,
      mediaDuration: (dts[dts.length - 1] - dts[0] + 1) * v.delta,
      startOffset: 0
    });
  }

  function prepareAudioTrack(a) {
    return Object.assign({}, a, {
      type: 'audio', timescale: a.sampleRate,
      sttsRuns: runLength(a.samples.map(s => s.dur)),
      mediaDuration: a.samples.reduce((n, s) => n + s.dur, 0),
      firstTs: a.samples.length ? Math.max(0, a.samples[0].ts) : 0
    });
  }

  function mux(video, audio) {
    const MOVIE_SCALE = 1000;
    const tracks = [prepareVideoTrack(video)];
    if (audio && audio.samples.length) tracks.push(prepareAudioTrack(audio));
    for (const t of tracks) {
      const startOffset = t.type === 'audio' ? Math.round(t.firstTs / t.timescale * MOVIE_SCALE) : 0;
      t.startOffset = startOffset;
      t.movieDuration = startOffset + Math.round(t.mediaDuration / t.timescale * MOVIE_SCALE);
    }
    const movieDuration = Math.max(...tracks.map(t => t.movieDuration));

    // Interleave samples by time so players can stream from the start
    const order = [];
    tracks.forEach((t, ti) => {
      let clock = 0;
      t.samples.forEach((s, si) => {
        const time = t.type === 'video' ? s.pts * t.delta / t.timescale : (clock += s.dur) / t.timescale;
        order.push({ ti, si, time, size: s.data.length });
      });
    });
    order.sort((a, b) => a.time - b.time || a.ti - b.ti);
    const mdatBody = order.reduce((n, o) => n + o.size, 0);
    const largeMdat = mdatBody + 8 > 0xFFFFFFFF;
    const ftyp = box('ftyp', enc.encode('isom'), u32(0x200), enc.encode('isomiso2avc1mp41'));

    const build = start => {
      const offsets = tracks.map(() => []);
      let at = start;
      for (const o of order) { offsets[o.ti][o.si] = at; at += o.size; }
      const mvhd = fullBox('mvhd', 0, 0, u32(0), u32(0), u32(MOVIE_SCALE), u32(movieDuration), u32(0x10000), u16(0x0100),
        new Array(10).fill(0), MATRIX, new Array(24).fill(0), u32(tracks.length + 1));
      return box('moov', mvhd, ...tracks.map((t, i) => trak(t, i + 1, offsets[i], movieDuration)));
    };
    const headerLen = largeMdat ? 16 : 8;
    let moov = build(0);
    moov = build(ftyp.length + moov.length + headerLen); // size doesn't depend on offsets' values
    const mdatHead = largeMdat
      ? bytes(Uint8Array.from(u32(1)), enc.encode('mdat'), Uint8Array.from(u32(Math.floor((mdatBody + 16) / 0x100000000))), Uint8Array.from(u32((mdatBody + 16) >>> 0)))
      : bytes(Uint8Array.from(u32(mdatBody + 8)), enc.encode('mdat'));
    return new Blob([ftyp, moov, mdatHead, ...order.map(o => tracks[o.ti].samples[o.si].data)], { type: 'video/mp4' });
  }

  // ---------- public API ----------
  async function probe(file) {
    const info = demux(await file.arrayBuffer());
    const rate = snapRate(info.measuredFps);
    return Object.assign(info, { rate, rateLabel: rateLabel(rate) });
  }

  // opts: { size: 'original'|'1080'|'720'|'480', fps: 'source'|number, quality: 'high'|'balanced'|'small', signal,
  //         durationUs: known real length — a canvas that stops changing stops producing frames, so the file alone can end early }
  async function convert(info, opts, onProgress) {
    opts = opts || {};
    const signal = opts.signal;
    const progress = typeof onProgress === 'function' ? onProgress : () => {};
    const rate = opts.fps && opts.fps !== 'source' ? snapRate(+opts.fps) : info.rate;
    const size = outputSize(info.video.width, info.video.height, opts.size);
    const audioShare = info.audio ? 0.08 : 0;
    progress(0, 'Preparing');
    const audio = info.audio ? await transcodeAudio(info.audio, signal) : null;
    progress(audioShare, 'Encoding video');
    const video = await transcodeVideo(info.video, { quality: opts.quality, durationUs: Math.max(info.durationUs, opts.durationUs || 0) }, rate, size, signal,
      f => progress(audioShare + (1 - audioShare) * Math.min(1, f) * 0.98, 'Encoding video'));
    checkAbort(signal);
    progress(0.99, 'Writing MP4');
    const blob = mux(video, audio);
    progress(1, 'Done');
    return { blob, width: size.width, height: size.height, fps: rateLabel(rate), audio: audio ? audio.kind : null, audioSkipped: info.audioSkipped };
  }

  global.LuminariumMP4 = { isSupported, probe, convert, outputSize, snapRate };
})(window);
