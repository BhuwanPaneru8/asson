import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { templateCsv } from "@/lib/product-import";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!can(user, "catalog.edit")) return new Response("Forbidden", { status: 403 });
  return new Response(templateCsv(), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="asson-products-template.csv"', "Cache-Control": "no-store" },
  });
}
