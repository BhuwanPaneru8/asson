import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { toCsv } from "@/lib/csv";
import { REGISTERS, type RegisterKey } from "@/lib/accounting";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const day = /^\d{4}-\d{2}-\d{2}$/;

/** One accounting register as CSV for a date range. Owner only (contains customer names and costs). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ register: string }> }) {
  const user = await getCurrentUser();
  if (!can(user?.role, "finance")) return new Response("Forbidden", { status: 403 });
  const key = (await params).register as RegisterKey;
  const reg = REGISTERS[key];
  const from = req.nextUrl.searchParams.get("from") ?? "", to = req.nextUrl.searchParams.get("to") ?? "";
  if (!reg || !day.test(from) || !day.test(to) || from > to) return new Response("Choose a register and a valid date range.", { status: 400 });
  const rows = await (reg.load as (p: { from: string; to: string }) => Promise<unknown[]>)({ from, to });
  const csv = toCsv([[...reg.header], ...rows.map((r) => (reg.row as (x: unknown) => (string | number)[])(r))]);
  // who took the books out, and which ones (exports carry customer names)
  await audit(db, user, { action: "accounting.export", entity: ["Export", key], summary: `Downloaded ${reg.label} ${from} → ${to} (${rows.length} rows)` });
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="asson-${key}-${from}_${to}.csv"`, "Cache-Control": "no-store" } });
}
