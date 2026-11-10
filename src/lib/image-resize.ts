"use client";

import { MEDIA_WIDTHS } from "./media-url";

/**
 * Resize a photo in the browser into every stored width before upload. Doing it here means a 12 MB
 * phone photo becomes ~0.5 MB of uploads (fast on Nepali mobile data) and the server never decodes
 * images. WebP where the browser can encode it, JPEG otherwise (older Safari).
 */

export type Resized = { blobs: Map<number, Blob>; ext: "webp" | "jpg"; width: number; height: number };

const MAX_BLOB = 2.8 * 1024 * 1024;

export async function resizeForUpload(file: File): Promise<Resized> {
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error(/heic|heif/i.test(file.type + file.name) ? "iPhone HEIC photos can't be read here — export as JPEG first" : "This file isn't a photo we can read (use JPEG, PNG or WebP)");
  }
  try {
    if (bmp.width < 400) throw new Error("Photo is too small — use at least 400px wide (1600px+ is best)");
    const blobs = new Map<number, Blob>();
    let ext: "webp" | "jpg" | null = null;
    for (const w of MEDIA_WIDTHS) {
      const tw = Math.min(w, bmp.width);
      const th = Math.round((bmp.height * tw) / bmp.width);
      const canvas = drawScaled(bmp, tw, th);
      let q = 0.84;
      let blob = await encode(canvas, ext, q);
      ext ??= blob.type === "image/webp" ? "webp" : "jpg";
      while (blob.size > MAX_BLOB && q > 0.5) blob = await encode(canvas, ext, (q -= 0.1));
      blobs.set(w, blob);
    }
    return { blobs, ext: ext!, width: Math.min(bmp.width, MEDIA_WIDTHS[MEDIA_WIDTHS.length - 1]), height: bmp.height };
  } finally {
    bmp.close();
  }
}

/** Halve repeatedly, then one final pass: much sharper than a single big downscale. */
function drawScaled(src: CanvasImageSource & { width: number; height: number }, tw: number, th: number): HTMLCanvasElement {
  let cur: CanvasImageSource = src;
  let cw = src.width, ch = src.height;
  while (cw / 2 >= tw) {
    const c = canvasOf(Math.round(cw / 2), Math.round(ch / 2));
    paint(c, cur);
    cur = c; cw = c.width; ch = c.height;
  }
  const out = canvasOf(tw, th);
  paint(out, cur);
  return out;
}

function canvasOf(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}

function paint(c: HTMLCanvasElement, img: CanvasImageSource) {
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#ffffff"; // transparent PNGs get a white background (JPEG has no alpha)
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
}

function encode(c: HTMLCanvasElement, ext: "webp" | "jpg" | null, q: number): Promise<Blob> {
  const type = ext === "jpg" ? "image/jpeg" : "image/webp";
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not process the photo"))), type, q)).then(async (b) => {
    // browser can't encode WebP (it silently returns PNG): fall back to JPEG
    if (type === "image/webp" && (b as Blob).type !== "image/webp") return encode(c, "jpg", q);
    return b as Blob;
  });
}

/** Upload a resized set; returns the URL to store on the product. */
export async function uploadPhoto(file: File, purpose?: "issue" | "vm" | "visit"): Promise<{ url: string; width: number; height: number; reused: boolean }> {
  const r = await resizeForUpload(file);
  const form = new FormData();
  for (const [w, b] of r.blobs) form.append(`w${w}`, b, `${w}.${r.ext}`);
  form.append("name", file.name);
  const res = await fetch(purpose ? `/api/admin/media?purpose=${purpose}` : "/api/admin/media", { method: "POST", body: form });
  const data = await res.json().catch(() => ({ ok: false, error: `Upload failed (${res.status})` }));
  if (!data.ok) throw new Error(data.error ?? "Upload failed");
  return data;
}
