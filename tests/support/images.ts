/** Tiny hand-built image headers for tests: enough bytes for the probe, plus filler to vary the hash. */

export function fakeWebp(width: number, height: number, salt = "") {
  const b = new Uint8Array(40 + salt.length);
  const w = (o: number, s: string) => [...s].forEach((c, i) => (b[o + i] = c.charCodeAt(0)));
  w(0, "RIFF"); w(8, "WEBP"); w(12, "VP8X");
  const put24 = (o: number, v: number) => { b[o] = v & 255; b[o + 1] = (v >> 8) & 255; b[o + 2] = (v >> 16) & 255; };
  put24(24, width - 1); put24(27, height - 1);
  w(40, salt);
  return b;
}

export function fakeJpeg(width: number, height: number, salt = "") {
  // SOI, APP0 (len 16), SOF0 (len 17): ff c0 00 11 08 HH HH WW WW ...
  const app0 = [0xff, 0xe0, 0x00, 0x10, ...Array(14).fill(0)];
  const sof = [0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 255, width >> 8, width & 255, ...Array(10).fill(0)];
  return new Uint8Array([0xff, 0xd8, ...app0, ...sof, ...[...salt].map((c) => c.charCodeAt(0))]);
}

/** A matching 480/960/1600 set for a source photo of the given size. */
export function fakeSet(srcW: number, srcH: number, make = fakeWebp, salt = "x") {
  const m = new Map<number, Uint8Array>();
  for (const w of [480, 960, 1600]) {
    const tw = Math.min(w, srcW);
    m.set(w, make(tw, Math.round((srcH * tw) / srcW), salt));
  }
  return m;
}
