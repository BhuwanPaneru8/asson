import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "./db";
import { probeImage } from "./image-probe";
import { MEDIA_WIDTHS, mediaUrl } from "./media-url";

/**
 * Photo storage. The browser resizes each photo to MEDIA_WIDTHS before upload (no image processing
 * on the server, which keeps a small server responsive); the server only verifies and stores.
 *
 * Files are content-addressed and immutable: <MEDIA_DIR>/p/<hash>-<width>.<ext>. They are served by
 * /media/[...path] with a one-year immutable cache, so after the first view Cloudflare serves them.
 * Storage is the local disk today; the nightly backup copies new files off-site. Swapping to object
 * storage later only means re-implementing writeFiles/readMediaFile.
 */

export const MAX_FILE_BYTES = 3 * 1024 * 1024;
export const MIN_SOURCE_WIDTH = 400;

export function mediaDir() {
  return process.env.MEDIA_DIR || path.join(process.cwd(), ".media");
}

export type UploadInput = { files: Map<number, Uint8Array>; originalName: string; uploadedById: string | null };
export type UploadResult = { ok: true; url: string; width: number; height: number; reused: boolean } | { ok: false; error: string };

/** Verify the resized set and store it. Never trusts the client: format, sizes and ratio are read from the bytes. */
export async function saveMedia(input: UploadInput): Promise<UploadResult> {
  const probes = new Map<number, { buf: Uint8Array; format: "webp" | "jpg"; width: number; height: number }>();
  for (const w of MEDIA_WIDTHS) {
    const buf = input.files.get(w);
    if (!buf) return { ok: false, error: `Missing the ${w}px version` };
    if (buf.byteLength > MAX_FILE_BYTES) return { ok: false, error: "Photo file is too large" };
    const p = probeImage(buf);
    if (!p) return { ok: false, error: "Only JPEG and WebP photos can be uploaded" };
    if (p.width > w || p.width < 1 || p.height < 1) return { ok: false, error: `The ${w}px version has the wrong size` };
    probes.set(w, { buf, ...p });
  }
  const all = [...probes.values()];
  const big = probes.get(MEDIA_WIDTHS[MEDIA_WIDTHS.length - 1])!;
  if (all.some((p) => p.format !== big.format)) return { ok: false, error: "All versions must be the same format" };
  if (big.width < MIN_SOURCE_WIDTH) return { ok: false, error: `Photo is too small — use at least ${MIN_SOURCE_WIDTH}px wide (1600px+ is best)` };
  const ratio = big.height / big.width;
  if (ratio > 4 || ratio < 0.25) return { ok: false, error: "Photo is an unusual shape — crop it closer to portrait 3:4" };
  for (let i = 1; i < all.length; i++) if (all[i].width < all[i - 1].width) return { ok: false, error: "Versions are out of order" };
  if (all.some((p) => Math.abs(p.height / p.width - ratio) > 0.03)) return { ok: false, error: "Versions don't match each other" };

  const hash = createHash("sha256").update(big.buf).digest("hex").slice(0, 32);
  const key = `p/${hash}`;
  const ext = big.format;
  const existing = await db.mediaAsset.findUnique({ where: { key } });
  if (!existing) {
    await writeFiles(key, ext, probes);
    await db.mediaAsset.upsert({
      where: { key },
      create: { key, ext, width: big.width, height: big.height, bytes: all.reduce((s, p) => s + p.buf.byteLength, 0), originalName: input.originalName.slice(0, 200), uploadedById: input.uploadedById },
      update: {},
    });
  }
  return { ok: true, url: mediaUrl(key, existing?.ext ?? ext), width: existing?.width ?? big.width, height: existing?.height ?? big.height, reused: !!existing };
}

async function writeFiles(key: string, ext: string, probes: Map<number, { buf: Uint8Array }>) {
  const dir = path.join(mediaDir(), path.dirname(key));
  await mkdir(dir, { recursive: true });
  for (const [w, { buf }] of probes) {
    const final = path.join(mediaDir(), `${key}-${w}.${ext}`);
    if (await exists(final)) continue;
    // write-then-rename so a reader never sees half a file
    const tmp = `${final}.${randomBytes(6).toString("hex")}.tmp`;
    await writeFile(tmp, buf);
    await rename(tmp, final);
  }
}

const exists = (f: string) => stat(f).then(() => true, () => false);

const FILE_RE = /^p\/[a-f0-9]{32}-(480|960|1600)\.(webp|jpg)$/;
export const MEDIA_TYPES = { webp: "image/webp", jpg: "image/jpeg" } as const;

/** Read a stored file by its public path ("p/<hash>-<w>.<ext>"). Anything else is rejected (no traversal). */
export async function readMediaFile(rel: string): Promise<{ body: Buffer; type: string } | null> {
  const m = FILE_RE.exec(rel);
  if (!m) return null;
  try {
    return { body: await readFile(path.join(mediaDir(), rel)), type: MEDIA_TYPES[m[2] as "webp" | "jpg"] };
  } catch {
    return null;
  }
}
