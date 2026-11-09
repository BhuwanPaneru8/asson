import { describe, expect, it } from "vitest";
import { probeImage } from "@/lib/image-probe";
import { absoluteImageUrl, isMediaUrl, mediaVariantUrl, parseMediaUrl } from "@/lib/media-url";
import { fakeJpeg, fakeWebp } from "../support/images";

const H = "0123456789abcdef0123456789abcdef";

describe("image probe", () => {
  it("reads WebP (VP8X) and JPEG sizes from the header", () => {
    expect(probeImage(fakeWebp(1600, 2133))).toEqual({ format: "webp", width: 1600, height: 2133 });
    expect(probeImage(fakeJpeg(960, 1280))).toEqual({ format: "jpg", width: 960, height: 1280 });
  });

  it("reads lossy VP8 and lossless VP8L WebP", () => {
    const vp8 = new Uint8Array(30);
    vp8.set([..."RIFF"].map((c) => c.charCodeAt(0)), 0);
    vp8.set([..."WEBPVP8 "].map((c) => c.charCodeAt(0)), 8);
    vp8.set([0x9d, 0x01, 0x2a, 480 & 255, 480 >> 8, 640 & 255, 640 >> 8], 23);
    expect(probeImage(vp8)).toEqual({ format: "webp", width: 480, height: 640 });

    const vp8l = new Uint8Array(30);
    vp8l.set([..."RIFF"].map((c) => c.charCodeAt(0)), 0);
    vp8l.set([..."WEBPVP8L"].map((c) => c.charCodeAt(0)), 8);
    const bits = (960 - 1) | ((1280 - 1) << 14);
    vp8l.set([0x2f, bits & 255, (bits >>> 8) & 255, (bits >>> 16) & 255, (bits >>> 24) & 255], 20);
    expect(probeImage(vp8l)).toEqual({ format: "webp", width: 960, height: 1280 });
  });

  it("rejects anything that is not a JPEG or WebP, whatever it is called", () => {
    const enc = (s: string) => new TextEncoder().encode(s);
    expect(probeImage(enc("<svg xmlns='http://www.w3.org/2000/svg'></svg>"))).toBeNull();
    expect(probeImage(enc("<html><script>alert(1)</script></html>"))).toBeNull();
    expect(probeImage(enc("GIF89a......"))).toBeNull();
    expect(probeImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]))).toBeNull(); // PNG: browser converts first
    expect(probeImage(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2]))).toBeNull(); // JPEG with no size
  });
});

describe("media URLs", () => {
  const url = `/media/p/${H}.webp`;

  it("recognises only our own upload URLs", () => {
    expect(isMediaUrl(url)).toBe(true);
    expect(parseMediaUrl(`/media/p/${H}.jpg`)).toEqual({ key: `p/${H}`, ext: "jpg" });
    for (const bad of [`/media/p/${H}.svg`, `/media/../etc/${H}.webp`, `/media/p/${H.slice(1)}.webp`, `https://x.com/media/p/${H}.webp`]) expect(isMediaUrl(bad)).toBe(false);
  });

  it("serves the smallest stored width that covers the request", () => {
    expect(mediaVariantUrl(url, 256)).toBe(`/media/p/${H}-480.webp`);
    expect(mediaVariantUrl(url, 480)).toBe(`/media/p/${H}-480.webp`);
    expect(mediaVariantUrl(url, 640)).toBe(`/media/p/${H}-960.webp`);
    expect(mediaVariantUrl(url, 3840)).toBe(`/media/p/${H}-1600.webp`);
    expect(mediaVariantUrl("https://images.unsplash.com/a", 640)).toBe("https://images.unsplash.com/a");
  });

  it("makes absolute URLs for feeds and social cards, using the largest width", () => {
    expect(absoluteImageUrl(url, "https://asson.example/")).toBe(`https://asson.example/media/p/${H}-1600.webp`);
    expect(absoluteImageUrl("https://cdn.x/a.jpg", "https://asson.example")).toBe("https://cdn.x/a.jpg");
  });
});
