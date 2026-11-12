import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminNav } from "@/components/admin/admin-nav";
import { ROLE_LABEL } from "@/lib/permissions";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  const [toFulfil, lowStock] = await Promise.all([
    db.order.count({ where: { status: { in: ["PENDING", "CONFIRMED", "PACKED", "RETURN_REQUESTED"] } } }),
    db.variant.count({ where: { stock: { lte: 3 }, product: { status: "ACTIVE" } } }),
  ]);
  return (
    <div className="flex min-h-screen flex-col bg-[#f6f5f2] lg:flex-row">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[60] focus:bg-ink focus:px-3 focus:py-2 focus:text-white">Skip to content</a>
      <div className="contents print:hidden"><AdminNav badges={{ orders: toFulfil, stock: lowStock }} role={user.role} /></div>
      <div className="min-w-0 flex-1">
        <div className="hidden h-14 items-center justify-end print:!hidden gap-3 border-b border-line bg-white px-8 text-[13.5px] lg:flex">
          <span className="text-muted">{user.email}</span>
          <span className="rounded-full bg-cloud px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider">{ROLE_LABEL[user.role]}</span>
        </div>
        <main id="main" className="p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
