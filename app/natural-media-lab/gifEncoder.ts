const word = (value: number) => [value & 255, value >> 8 & 255];

const lzw = (pixels: Uint8Array) => {
  const clear = 256, end = 257;
  let codeSize = 9, nextCode = 258;
  let dictionary = new Map<string, number>();
  const bytes: number[] = [];
  let bitBuffer = 0, bitCount = 0;
  const emit = (code: number) => {
    bitBuffer |= code << bitCount; bitCount += codeSize;
    while (bitCount >= 8) { bytes.push(bitBuffer & 255); bitBuffer >>>= 8; bitCount -= 8; }
  };
  const reset = () => { dictionary = new Map(); codeSize = 9; nextCode = 258; };
  emit(clear);
  let prefix = pixels[0] ?? 0;
  for (let i = 1; i < pixels.length; i++) {
    const value = pixels[i], key = `${prefix},${value}`, found = dictionary.get(key);
    if (found !== undefined) { prefix = found; continue; }
    emit(prefix);
    if (nextCode < 4096) {
      dictionary.set(key, nextCode++);
      if (nextCode === 1 << codeSize && codeSize < 12) codeSize++;
    } else { emit(clear); reset(); }
    prefix = value;
  }
  emit(prefix); emit(end);
  if (bitCount) bytes.push(bitBuffer & 255);
  return bytes;
};

export function encodeGif(frames: ImageData[], width: number, height: number, fps: number, loop: boolean, holds: number[] = []) {
  const output: number[] = [...new TextEncoder().encode("GIF89a"), ...word(width), ...word(height), 0xf7, 0, 0];
  for (let i = 0; i < 256; i++) output.push(Math.round((i >> 5 & 7) * 255 / 7), Math.round((i >> 2 & 7) * 255 / 7), Math.round((i & 3) * 255 / 3));
  if (loop) output.push(0x21, 0xff, 0x0b, ...new TextEncoder().encode("NETSCAPE2.0"), 3, 1, 0, 0, 0);
  for (let frameIndex = 0; frameIndex < frames.length; frameIndex++) {
    const frame = frames[frameIndex];
    const delay = Math.max(2, Math.round(100 / fps) * Math.max(1, holds[frameIndex] ?? 1));
    const pixels = new Uint8Array(width * height);
    for (let p = 0, i = 0; p < pixels.length; p++, i += 4) {
      pixels[p] = (frame.data[i] >> 5) << 5 | (frame.data[i + 1] >> 5) << 2 | frame.data[i + 2] >> 6;
    }
    output.push(0x21, 0xf9, 4, 0x04, ...word(delay), 0, 0);
    output.push(0x2c, 0, 0, 0, 0, ...word(width), ...word(height), 0, 8);
    const compressed = lzw(pixels);
    for (let offset = 0; offset < compressed.length; offset += 255) {
      const block = compressed.slice(offset, offset + 255); output.push(block.length, ...block);
    }
    output.push(0);
  }
  output.push(0x3b);
  return new Blob([new Uint8Array(output)], { type: "image/gif" });
}
