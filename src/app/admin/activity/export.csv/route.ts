import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { activityWhere } from "@/lib/audit-query";
import { redactChanges } from "@/lib/audit";
import { toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

/** The filtered activity log as CSV (for an accountant or an investigation). Owner only, max 50,000 rows. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!can(user?.role, "audit")) return new Response("Forbidden", { status: 403 });
  const sp = req.nextUrl.searchParams;
  const get = (k: string) => sp.get(k) ?? undefined;
  const rows = await db.auditLog.findMany({
    where: activityWhere({ group: get("group"), actor: get("actor"), q: get("q"), from: get("from"), to: get("to"), entityType: get("entityType"), entityId: get("entityId") }),
    orderBy: [{ at: "desc" }, { id: "desc" }],
    take: 50_000,
  });
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const canSeeCost = can(user?.role, "finance");
  const csv = toCsv([
    ["time (Nepal)", "person", "role", "action", "summary", "record type", "record id", "ip", "details"],
    ...rows.map((r) => [fmt.format(r.at).replace(",", ""), r.actorName, r.actorRole, r.action, r.summary, r.entityType, r.entityId, r.ip, r.changes ? JSON.stringify(redactChanges(r.changes, canSeeCost)) : ""]),
  ]);
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kathmandu" });
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="asson-activity-${day}.csv"`, "Cache-Control": "no-store" } });
}
