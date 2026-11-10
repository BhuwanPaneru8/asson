import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { toCsv } from "@/lib/csv";

/** The month's payroll register for the accountant (rupees, one row per person). */
export async function GET(_req: Request, { params }: { params: Promise<{ month: string }> }) {
  await requirePermission("payroll");
  const r = await db.payrollRun.findUnique({ where: { month: (await params).month }, include: { slips: { include: { user: { select: { name: true, employment: { select: { pan: true, bankAccount: true } } } } }, orderBy: { user: { name: "asc" } } } } });
  if (!r) return new Response("Not found", { status: 404 });
  const rs = (p: number) => (p / 100).toFixed(2);
  const csv = toCsv([
    ["Month", "Status", "Name", "PAN", "Bank account", "SSF", "Working days", "Days worked", "Unpaid days", "Basic", "Allowance", "Unpaid deduction", "Bonus", "Commission", "Gross", "SSF employee 11%", "SSF employer 20%", "TDS", "Net pay", "Note"],
    ...r.slips.map((s) => [r.month, r.status, s.user.name, s.user.employment?.pan ?? "", s.user.employment?.bankAccount ?? "", s.inSsf ? "yes" : "no", s.workingDays, s.daysWorked, s.unpaidDays, rs(s.basic), rs(s.allowance), rs(s.unpaidDeduction), rs(s.bonus), rs(s.commission), rs(s.gross), rs(s.ssfEmployee), rs(s.ssfEmployer), rs(s.incomeTax), rs(s.net), s.note ?? ""]),
  ]);
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="asson-payroll-${r.month}.csv"`, "Cache-Control": "no-store" } });
}
