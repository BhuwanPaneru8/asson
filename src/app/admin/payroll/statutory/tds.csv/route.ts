import { requirePermission } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { tdsAnnual } from "@/lib/statutory";

/** The year's salary TDS per employee, for the e-TDS filing (rupees). */
export async function GET(req: Request) {
  await requirePermission("payroll");
  const fy = new URL(req.url).searchParams.get("fy") ?? "";
  if (!/^\d{4}\/\d{2}$/.test(fy)) return new Response("Give the fiscal year, e.g. 2083/84", { status: 400 });
  const a = await tdsAnnual(fy);
  const rs = (p: number) => (p / 100).toFixed(2);
  const csv = toCsv([["Fiscal year", "Employee", "PAN", "Months paid", "Gross salary", "SSF employee 11%", "TDS withheld"], ...a.rows.map((r) => [fy, r.name, r.pan, r.months, rs(r.gross), rs(r.ssf), rs(r.tds)])]);
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="asson-tds-${fy.replace("/", "-")}.csv"`, "Cache-Control": "no-store" } });
}
