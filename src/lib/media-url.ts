/**
 * Client-safe helpers for photos we host ourselves (uploaded in the admin).
 *
 * A stored photo URL looks like `/media/p/<32 hex>.webp` (or `.jpg`). The files on disk are the
 * same photo in fixed widths: `/media/p/<hash>-480.webp`, `-960`, `-1600`. Pages ask the image
 * loader for a width and get the smallest stored width that is at least as wide, so phones download
 * ~40 KB thumbnails while zoomed product shots stay sharp.
 */

export const MEDIA_WIDTHS = [480, 960, 1600] as const;
export type MediaWidth = (typeof MEDIA_WIDTHS)[number];

const MEDIA_RE = /^\/media\/(p\/[a-f0-9]{32})\.(webp|jpg)$/;

export function parseMediaUrl(url: string): { key: string; ext: "webp" | "jpg" } | null {
  const m = MEDIA_RE.exec(url);
  return m ? { key: m[1], ext: m[2] as "webp" | "jpg" } : null;
}

export const isMediaUrl = (url: string) => MEDIA_RE.test(url);

export const mediaUrl = (key: string, ext: string) => `/media/${key}.${ext}`;

/** The stored file that best serves a requested display width. */
export function mediaVariantUrl(url: string, width: number): string {
  const m = parseMediaUrl(url);
  if (!m) return url;
  const w = MEDIA_WIDTHS.find((x) => x >= width) ?? MEDIA_WIDTHS[MEDIA_WIDTHS.length - 1];
  return `/media/${m.key}-${w}.${m.ext}`;
}

/** Absolute URL for places outside the page (structured data, feeds, social cards, SMS). */
export function absoluteImageUrl(url: string, siteUrl: string): string {
  if (/^https?:\/\//.test(url)) return url;
  const base = siteUrl.replace(/\/$/, "");
  // share the largest stored width: social networks and Google want big images
  return `${base}${isMediaUrl(url) ? mediaVariantUrl(url, 1600) : url}`;
}
