import { readMediaFile } from "@/lib/media";

export const dynamic = "force-dynamic";

/** Serves uploaded photos. Files are content-addressed and never change, so they cache for a year. */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const rel = (await params).path.join("/");
  const file = await readMediaFile(rel);
  if (!file) return new Response("Not found", { status: 404, headers: { "Cache-Control": "public, max-age=60" } });
  return new Response(new Uint8Array(file.body), {
    headers: {
      "Content-Type": file.type,
      "Content-Length": String(file.body.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}
