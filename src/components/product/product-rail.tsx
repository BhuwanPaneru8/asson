"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import type { ProductCardData } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { ProductCard } from "./product-card";
import { useT } from "@/components/site/i18n-provider";

/**
 * A row of products that slides sideways: swipe on phones, arrow buttons on larger screens (4 at a time on
 * desktop, up to 8 in all). The arrows dim at each end and are hidden when everything already fits.
 * viewAll: the link text, already translated (this renders on the server and the client).
 * priority: the rail is the first thing on the page (an empty bag), so its first cards load straight away.
 */
export function ProductRail({ title, href, products, eyebrow, viewAll = "View all", priority }: { title: string; href?: string; products: ProductCardData[]; eyebrow?: string; viewAll?: string; priority?: boolean }) {
  const { t } = useT();
  const track = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const frame = requestAnimationFrame(measure);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => { cancelAnimationFrame(frame); ro.disconnect(); };
  }, [measure, products.length]);

  if (!products.length) return null;

  const page = (dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: reduce ? "auto" : "smooth" });
  };
  const fits = edges.start && edges.end;

  return (
    <section className="container-page py-12 md:py-16">
      <div className="mb-6 flex items-end justify-between gap-4 md:mb-8">
        <div className="min-w-0">
          {eyebrow && <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.16em] text-accent">{eyebrow}</p>}
          <h2 className="font-display text-3xl md:text-[34px]">{title}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          {href && (
            <Link href={href} className="group/all inline-flex items-center gap-1.5 text-[14px] font-medium">
              <span className="underline-offset-4 group-hover/all:underline">{viewAll}</span>
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover/all:translate-x-0.5" strokeWidth={1.8} aria-hidden />
            </Link>
          )}
          {!fits && (
            <div className="hidden items-center gap-2 md:flex">
              <RailArrow dir={-1} disabled={edges.start} onClick={() => page(-1)} label={t("rail.prev", { title })} />
              <RailArrow dir={1} disabled={edges.end} onClick={() => page(1)} label={t("rail.next", { title })} />
            </div>
          )}
        </div>
      </div>
      <div
        ref={track}
        onScroll={measure}
        className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 md:mx-0 md:scroll-px-0 md:gap-5 md:px-0"
      >
        {products.slice(0, 8).map((p, i) => (
          <div key={p.id} className="w-[46%] shrink-0 snap-start sm:w-[31%] md:w-[calc((100%-2.5rem)/3)] xl:w-[calc((100%-3.75rem)/4)]">
            <ProductCard p={p} priority={priority && i < 2} />
          </div>
        ))}
      </div>
    </section>
  );
}

function RailArrow({ dir, disabled, onClick, label }: { dir: 1 | -1; disabled: boolean; onClick: () => void; label: string }) {
  const Icon = dir === 1 ? ChevronRight : ChevronLeft;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white transition",
        "hover:border-ink disabled:cursor-default disabled:opacity-35 disabled:hover:border-line",
      )}
    >
      <Icon className="h-[18px] w-[18px]" strokeWidth={1.7} />
    </button>
  );
}
