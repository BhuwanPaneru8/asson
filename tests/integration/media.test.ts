import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { readMediaFile, saveMedia } from "@/lib/media";
import { POST } from "@/app/api/admin/media/route";
import { GET } from "@/app/media/[...path]/route";
import { saveProduct } from "@/actions/admin/catalog";
import { actAs, makeUser, resetDb } from "../support/db";
import { fakeJpeg, fakeSet, fakeWebp } from "../support/images";

let dir: string;
beforeAll(async () => { dir = await mkdtemp(path.join(tmpdir(), "asson-media-")); process.env.MEDIA_DIR = dir; });
afterAll(async () => { await rm(dir, { recursive: true, force: true }); delete process.env.MEDIA_DIR; });

function uploadRequest(files: Map<number, Uint8Array>, origin = "http://localhost:3000") {
  const form = new FormData();
  for (const [w, b] of files) form.append(`w${w}`, new Blob([new Uint8Array(b)]), `${w}.webp`);
  form.append("name", "linen-shirt.jpg");
  return new NextRequest("http://localhost:3000/api/admin/media", { method: "POST", body: form, headers: { origin, host: "localhost:3000" } });
}

describe("photo uploads", () => {
  beforeEach(resetDb);

  it("stores every width once, content-addressed, and serves them with a long cache", async () => {
    const r = await saveMedia({ files: fakeSet(3000, 4000), originalName: "a.jpg", uploadedById: null });
    expect(r).toMatchObject({ ok: true, width: 1600, height: 2133, reused: false });
    if (!r.ok) return;
    expect(r.url).toMatch(/^\/media\/p\/[a-f0-9]{32}\.webp$/);
    expect((await readdir(path.join(dir, "p"))).filter((f) => r.url.includes(f.split("-")[0])).length).toBe(3);

    const again = await saveMedia({ files: fakeSet(3000, 4000), originalName: "copy.jpg", uploadedById: null });
    expect(again).toMatchObject({ ok: true, url: r.url, reused: true });
    expect(await db.mediaAsset.count()).toBe(1);

    const key = r.url.slice("/media/".length, -".webp".length);
    const res = await GET(new Request("http://x"), { params: Promise.resolve({ path: [...`${key}-960.webp`.split("/")] }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/webp");
    expect(res.headers.get("cache-control")).toContain("immutable");
  });

  it("keeps a small source photo at its own size in every slot", async () => {
    const r = await saveMedia({ files: fakeSet(800, 1000, fakeJpeg), originalName: "", uploadedById: null });
    expect(r).toMatchObject({ ok: true, width: 800, height: 1000 });
    if (r.ok) expect(r.url.endsWith(".jpg")).toBe(true);
  });

  it("rejects forged, mismatched, oversized or tiny uploads", async () => {
    const svg = new TextEncoder().encode("<svg onload=alert(1)>");
    const cases: [Map<number, Uint8Array>, RegExp][] = [
      [new Map([[480, svg], [960, svg], [1600, svg]]), /JPEG and WebP/],
      [new Map([[480, fakeWebp(480, 640)], [960, fakeWebp(960, 1280)]]), /Missing/],
      [new Map([[480, fakeWebp(900, 1200)], [960, fakeWebp(960, 1280)], [1600, fakeWebp(1600, 2133)]]), /wrong size/],
      [new Map([[480, fakeWebp(480, 480)], [960, fakeWebp(960, 1280)], [1600, fakeWebp(1600, 2133)]]), /don't match/],
      [new Map([[480, fakeJpeg(480, 640)], [960, fakeWebp(960, 1280)], [1600, fakeWebp(1600, 2133)]]), /same format/],
      [fakeSet(300, 400), /too small/],
      [fakeSet(1600, 200), /unusual shape/],
      [new Map([[480, fakeWebp(480, 640)], [960, fakeWebp(960, 1280)], [1600, new Uint8Array(4 * 1024 * 1024)]]), /too large/],
    ];
    for (const [files, msg] of cases) expect(await saveMedia({ files, originalName: "", uploadedById: null })).toMatchObject({ ok: false, error: expect.stringMatching(msg) });
    expect(await db.mediaAsset.count()).toBe(0);
  });

  it("never serves paths outside the media folder", async () => {
    for (const p of ["../../etc/passwd", "p/../../x-480.webp", "p/abc-480.webp", `p/${"a".repeat(32)}-480.svg`]) {
      expect(await readMediaFile(p)).toBeNull();
    }
  });

  it("upload endpoint: owner only, same-origin only", async () => {
    expect((await POST(uploadRequest(fakeSet(2000, 2667)))).status).toBe(401);
    actAs(await makeUser("MANAGER"));
    expect((await POST(uploadRequest(fakeSet(2000, 2667)))).status).toBe(403);
    actAs(await makeUser("ADMIN"));
    expect((await POST(uploadRequest(fakeSet(2000, 2667), "https://evil.example"))).status).toBe(403);
    const ok = await POST(uploadRequest(fakeSet(2000, 2667, fakeWebp, "y")));
    expect(ok.status).toBe(200);
    const body = await ok.json();
    expect(body).toMatchObject({ ok: true, width: 1600 });
    expect((await db.mediaAsset.findFirstOrThrow()).originalName).toBe("linen-shirt.jpg");

    // the stored URL is accepted on a product
    const cat = await db.category.create({ data: { name: "Shirts", slug: "shirts" } });
    const saved = await saveProduct({
      name: "Linen Shirt", slug: "", brand: "Asson", description: "A breathable linen shirt.", details: [], gender: "MEN", status: "ACTIVE",
      categoryId: cat.id, price: "2400", compareAtPrice: "", material: "", fit: "", care: "", tags: [], featured: false, collectionIds: [],
      images: [{ url: body.url, alt: "Linen Shirt", color: null }],
      variants: [{ sku: "LS-WHT-M", color: "White", colorHex: "#ffffff", size: "M", stock: 3 }],
    } as never);
    expect(saved).toMatchObject({ ok: true });
    expect((await db.productImage.findFirstOrThrow()).url).toBe(body.url);
  });
});
