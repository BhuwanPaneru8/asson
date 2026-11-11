import Link from "next/link";
import type { OrderStatus } from "@prisma/client";
import { STATUS_LABEL } from "@/lib/order-status";
import { cn } from "@/lib/utils";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="text-[24px] font-semibold tracking-tight">{title}</h1>{description && <p className="mt-1 text-[14px] text-muted">{description}</p>}</div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className, title, action }: { children: React.ReactNode; className?: string; title?: string; action?: React.ReactNode }) {
  return (
    <div className={cn("rounded-lg border border-line bg-white", className)}>
      {title && <div className="flex items-center justify-between border-b border-line px-5 py-3.5"><h2 className="text-[14.5px] font-semibold">{title}</h2>{action}</div>}
      {children}
    </div>
  );
}

const STATUS_TONE: Record<OrderStatus, string> = {
  PENDING: "bg-[#fbf1df] text-warn",
  CONFIRMED: "bg-[#e7eefb] text-[#2453a6]",
  PACKED: "bg-[#efe8fb] text-[#5b3aa6]",
  SHIPPED: "bg-[#e3f2f4] text-[#1e6f73]",
  OUT_FOR_DELIVERY: "bg-[#e3f2f4] text-[#1e6f73]",
  RETURNING: "bg-[#fbeee0] text-[#9a5b13]",
  DELIVERED: "bg-[#e6f1ea] text-success",
  CANCELLED: "bg-cloud text-muted",
  RETURN_REQUESTED: "bg-[#fbe9e7] text-danger",
  RETURNED: "bg-cloud text-ink-soft",
};

export function StatusPill({ status }: { status: OrderStatus }) {
  return <span className={cn("inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-medium", STATUS_TONE[status])}>{STATUS_LABEL[status]}</span>;
}

export function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "success" | "warn" | "danger" }) {
  const t = { neutral: "bg-cloud text-ink-soft", success: "bg-[#e6f1ea] text-success", warn: "bg-[#fbf1df] text-warn", danger: "bg-[#fbe9e7] text-danger" }[tone];
  return <span className={cn("inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-medium", t)}>{children}</span>;
}

export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={cn("whitespace-nowrap px-4 py-2.5 text-left text-[12px] font-semibold uppercase tracking-wider text-muted", className)}>{children}</th>;
}
export function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 align-middle", className)}>{children}</td>;
}

export function AdminPager({ page, pages, href }: { page: number; pages: number; href: (p: number) => string }) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-line px-4 py-3 text-[13.5px]">
      <span className="text-muted">Page {page} of {pages}</span>
      <div className="flex gap-2">
        {page > 1 && <Link href={href(page - 1)} className="rounded-md border border-line px-3 py-1.5 hover:border-ink">Previous</Link>}
        {page < pages && <Link href={href(page + 1)} className="rounded-md border border-line px-3 py-1.5 hover:border-ink">Next</Link>}
      </div>
    </div>
  );
}
