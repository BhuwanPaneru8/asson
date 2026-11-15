import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { exportCatalogueCsv } from "@/lib/product-import";

export const dynamic = "force-dynamic";

/** Whole catalogue as a spreadsheet in the import format. Owner only (it includes costs). */
export async function GET() {
  const user = await getCurrentUser();
  if (!can(user, "catalog.edit")) return new Response("Forbidden", { status: 403 });
  const csv = await exportCatalogueCsv(db, { includeCost: can(user, "finance") });
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kathmandu" });
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="asson-products-${day}.csv"`, "Cache-Control": "no-store" },
  });
}
