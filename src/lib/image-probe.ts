/**
 * Read an image's real format and pixel size from its header bytes, without decoding it.
 * Used to verify uploads: we never trust the file name, the declared MIME type or the client's
 * claimed size. Only WebP and baseline/progressive JPEG are accepted (no SVG, no HTML, no GIF).
 */

export type Probe = { format: "webp" | "jpg"; width: number; height: number };

export function probeImage(buf: Uint8Array): Probe | null {
  return probeWebp(buf) ?? probeJpeg(buf);
}

const u16le = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const u24le = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16);
const u16be = (b: Uint8Array, o: number) => (b[o] << 8) | b[o + 1];
const ascii = (b: Uint8Array, o: number, n: number) => String.fromCharCode(...b.subarray(o, o + n));

function probeWebp(b: Uint8Array): Probe | null {
  if (b.length < 30 || ascii(b, 0, 4) !== "RIFF" || ascii(b, 8, 4) !== "WEBP") return null;
  const chunk = ascii(b, 12, 4);
  if (chunk === "VP8 ") {
    // lossy: keyframe start code 9d 01 2a, then 14-bit width/height
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
    return { format: "webp", width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
  }
  if (chunk === "VP8L") {
    if (b[20] !== 0x2f) return null;
    const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
    return { format: "webp", width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8X") {
    return { format: "webp", width: u24le(b, 24) + 1, height: u24le(b, 27) + 1 };
  }
  return null;
}

function probeJpeg(b: Uint8Array): Probe | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let o = 2;
  while (o + 9 < b.length) {
    if (b[o] !== 0xff) return null;
    const marker = b[o + 1];
    if (marker === 0xff) { o++; continue; } // fill byte
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { o += 2; continue; }
    const len = u16be(b, o + 2);
    if (len < 2) return null;
    // SOF0..SOF15 except DHT (c4), JPG (c8) and DAC (cc)
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { format: "jpg", height: u16be(b, o + 5), width: u16be(b, o + 7) };
    }
    if (marker === 0xda || marker === 0xd9) return null; // image data started before any size
    o += 2 + len;
  }
  return null;
}
