"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Pagination({ page, pages }: { page: number; pages: number }) {
  const pathname = usePathname();
  const params = useSearchParams();
  if (pages <= 1) return null;
  const href = (p: number) => {
    const next = new URLSearchParams(params.toString());
    if (p === 1) next.delete("page"); else next.set("page", String(p));
    const s = next.toString();
    return s ? `${pathname}?${s}` : pathname;
  };
  const nums = new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages));
  const list = [...nums].sort((a, b) => a - b);
  return (
    <nav className="mt-14 flex items-center justify-center gap-1" aria-label="Pagination">
      {page > 1 && <Link href={href(page - 1)} className="flex h-10 w-10 items-center justify-center border border-line hover:border-ink" aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></Link>}
      {list.map((n, i) => (
        <span key={n} className="flex items-center">
          {i > 0 && n - list[i - 1] > 1 && <span className="px-2 text-muted">…</span>}
          <Link href={href(n)} aria-current={n === page ? "page" : undefined} className={cn("flex h-10 min-w-10 items-center justify-center border px-2 text-[14px]", n === page ? "border-ink bg-ink text-white" : "border-line hover:border-ink")}>{n}</Link>
        </span>
      ))}
      {page < pages && <Link href={href(page + 1)} className="flex h-10 w-10 items-center justify-center border border-line hover:border-ink" aria-label="Next page"><ChevronRight className="h-4 w-4" /></Link>}
    </nav>
  );
}
