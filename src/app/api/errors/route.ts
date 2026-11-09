import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { reportError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/client-ip";

const body = z.object({
  message: z.string().max(500),
  digest: z.string().max(100).optional(),
  path: z.string().max(300),
});

/** Crashes caught by the browser's error boundary. Rate-limited; stores no personal data. */
export async function POST(req: NextRequest) {
  if (!rateLimit(`client-error:${clientIp(req.headers)}`, 10, 60_000)) return new NextResponse(null, { status: 429 });
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return new NextResponse(null, { status: 400 });
  const path = p.data.path.split("?")[0].split("#")[0];
  const err = Object.assign(new Error(p.data.message || "Client error"), { digest: p.data.digest, stack: undefined });
  await reportError(`client:${path}`, err, { source: "client" });
  return new NextResponse(null, { status: 204 });
}
