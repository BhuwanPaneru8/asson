import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Liveness + database check for deploys and uptime monitors. No secrets, no data. */
export async function GET() {
  const started = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { ok: true, release: process.env.ASSON_RELEASE, dbMs: Date.now() - started },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ ok: false, release: process.env.ASSON_RELEASE }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
