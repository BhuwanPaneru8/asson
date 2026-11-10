import { reportError } from "@/lib/errors";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { MAX_FILE_BYTES, saveMedia } from "@/lib/media";
import { MEDIA_WIDTHS } from "@/lib/media-url";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function sameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  let host: string;
  try { host = new URL(origin).host; } catch { return false; }
  const allowed = [req.headers.get("host"), req.headers.get("x-forwarded-host")];
  if (process.env.NEXT_PUBLIC_SITE_URL) allowed.push(new URL(process.env.NEXT_PUBLIC_SITE_URL).host);
  return allowed.includes(host);
}

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Upload one photo (already resized by the browser into every MEDIA_WIDTHS version, form fields
 * "w480", "w960", "w1600"). Catalogue photos are owner-only (catalog.edit); with purpose=issue any staff
 * member can attach a photo to an issue report (tighter hourly limit).
 */
export async function POST(req: NextRequest) {
  // same-origin only: the session cookie is SameSite=Lax, and this blocks any other site posting here
  if (!sameOrigin(req)) {
    return json({ ok: false, error: "Bad origin" }, 403);
  }
  const user = await getCurrentUser();
  if (!user) return json({ ok: false, error: "Sign in again" }, 401);
  const forIssue = req.nextUrl.searchParams.get("purpose") === "issue";
  if (forIssue ? !can(user.role, "self.time") : !can(user.role, "catalog.edit")) return json({ ok: false, error: "Only the owner can add photos" }, 403);
  if (!rateLimit(`media:${forIssue ? "issue:" : ""}${user.id}`, forIssue ? 40 : 300, 60 * 60_000)) return json({ ok: false, error: "Too many uploads — try again in an hour" }, 429);

  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_FILE_BYTES * MEDIA_WIDTHS.length + 64 * 1024) return json({ ok: false, error: "Photo file is too large" }, 413);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ ok: false, error: "Upload was interrupted — try again" }, 400);
  }
  const files = new Map<number, Uint8Array>();
  for (const w of MEDIA_WIDTHS) {
    const f = form.get(`w${w}`);
    if (f instanceof Blob) files.set(w, new Uint8Array(await f.arrayBuffer()));
  }
  const name = form.get("name");
  try {
    const r = await saveMedia({ files, originalName: typeof name === "string" ? name : "", uploadedById: user.id });
    if (r.ok && !r.reused) await audit(db, user, { action: "media.upload", entity: ["MediaAsset"], summary: `Uploaded photo ${typeof name === "string" ? name.slice(0, 80) : ""} (${r.width}×${r.height})`, changes: { url: r.url } });
    return json(r, r.ok ? 200 : 422);
  } catch (e) {
    void reportError("[media] upload failed", e);
    return json({ ok: false, error: "Could not save the photo — try again" }, 500);
  }
}
