"use client";

import { createContext, useContext, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronDown, SlidersHorizontal, X } from "lucide-react";
import type { ProductFilters } from "@/lib/catalog";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn, formatNumber, formatPrice } from "@/lib/utils";
import { useT } from "@/components/site/i18n-provider";
import type { T } from "@/lib/i18n";

type Facets = { colors: { name: string; hex: string }[]; sizes: string[]; brands: { name: string; count: number }[]; priceMin: number; priceMax: number };

const Ctx = createContext<{ pending: boolean; update: (fn: (p: URLSearchParams) => void) => void } | null>(null);

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const update = (fn: (p: URLSearchParams) => void) => {
    const next = new URLSearchParams(params.toString());
    fn(next);
    next.delete("page");
    const s = next.toString();
    start(() => router.push(s ? `${pathname}?${s}` : pathname, { scroll: false }));
  };
  return <Ctx.Provider value={{ pending, update }}>{children}</Ctx.Provider>;
}

function useFilters() {
  const c = useContext(Ctx);
  if (!c) throw new Error("FilterProvider missing");
  return c;
}

function toggleList(p: URLSearchParams, key: string, value: string) {
  const list = (p.get(key) ?? "").split(",").filter(Boolean);
  const next = list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
  if (next.length) p.set(key, next.join(",")); else p.delete(key);
}

export function ResultsShell({ children }: { children: React.ReactNode }) {
  const { pending } = useFilters();
  return <div className={cn("transition-opacity", pending && "pointer-events-none opacity-50")} aria-busy={pending}>{children}</div>;
}

function Section({ title, children, defaultOpen = true, count }: { title: string; children: React.ReactNode; defaultOpen?: boolean; count?: number }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-line py-4">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between text-left text-[14px] font-semibold" aria-expanded={open}>
        <span>{title}{count ? <span className="ml-1.5 font-normal text-muted">({count})</span> : null}</span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="pt-3">{children}</div>}
    </div>
  );
}

const priceBands = (t: T) => [
  { label: t("f.under", { amount: "Rs. 1,500" }), min: undefined, max: 1499 },
  { label: "Rs. 1,500 – 3,000", min: 1500, max: 3000 },
  { label: "Rs. 3,000 – 6,000", min: 3000, max: 6000 },
  { label: t("f.over", { amount: "Rs. 6,000" }), min: 6000, max: undefined },
];

export function FilterPanel({ facets, filters }: { facets: Facets; filters: ProductFilters }) {
  const { update } = useFilters();
  const { t } = useT();
  const [min, setMin] = useState(filters.minPrice ? String(filters.minPrice / 100) : "");
  const [max, setMax] = useState(filters.maxPrice ? String(filters.maxPrice / 100) : "");
  const minR = filters.minPrice ? filters.minPrice / 100 : undefined;
  const maxR = filters.maxPrice ? filters.maxPrice / 100 : undefined;

  return (
    <div>
      <div className="space-y-3 border-b border-line pb-4">
        <label className="flex cursor-pointer items-center justify-between text-[14px]">
          <span>{t("f.inStock")}</span>
          <Toggle label={t("f.inStock")} on={!!filters.inStock} onClick={() => update((p) => (filters.inStock ? p.delete("stock") : p.set("stock", "1")))} />
        </label>
        <label className="flex cursor-pointer items-center justify-between text-[14px]">
          <span>{t("nav.onSale")}</span>
          <Toggle label={t("nav.onSale")} on={!!filters.sale} onClick={() => update((p) => (filters.sale ? p.delete("sale") : p.set("sale", "1")))} />
        </label>
      </div>

      {facets.sizes.length > 0 && (
        <Section title={t("f.size")} count={filters.sizes?.length}>
          <div className="grid grid-cols-4 gap-1.5">
            {facets.sizes.map((s) => {
              const on = filters.sizes?.includes(s);
              return <button key={s} onClick={() => update((p) => toggleList(p, "size", s))} aria-pressed={on} className={cn("h-9 border text-[13px] font-medium transition-colors", on ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink")}>{s}</button>;
            })}
          </div>
        </Section>
      )}

      {facets.colors.length > 0 && (
        <Section title={t("f.colour")} count={filters.colors?.length}>
          <div className="grid grid-cols-2 gap-x-2 gap-y-2">
            {facets.colors.map((c) => {
              const on = filters.colors?.includes(c.name);
              return (
                <button key={c.name} onClick={() => update((p) => toggleList(p, "color", c.name))} aria-pressed={on} className="flex items-center gap-2 text-left text-[13.5px]">
                  <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full border", on ? "ring-1 ring-ink ring-offset-2" : "border-black/10")} style={{ background: c.hex }}>
                    {on && <Check className={cn("h-3 w-3", isLight(c.hex) ? "text-ink" : "text-white")} strokeWidth={3} />}
                  </span>
                  <span className={cn(on && "font-semibold")}>{c.name}</span>
                </button>
              );
            })}
          </div>
        </Section>
      )}

      <Section title={t("f.price")}>
        <div className="space-y-2">
          {priceBands(t).map((b) => {
            const on = minR === b.min && maxR === b.max;
            return (
              <button key={b.label} onClick={() => update((p) => { if (on) { p.delete("min"); p.delete("max"); } else { if (b.min) p.set("min", String(b.min)); else p.delete("min"); if (b.max) p.set("max", String(b.max)); else p.delete("max"); } })} className="flex w-full items-center gap-2.5 text-left text-[14px]">
                <span className={cn("flex h-4 w-4 items-center justify-center rounded-full border", on ? "border-ink" : "border-line")}>{on && <span className="h-2 w-2 rounded-full bg-ink" />}</span>
                {b.label}
              </button>
            );
          })}
        </div>
        <form className="mt-3 flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); update((p) => { if (min) p.set("min", min); else p.delete("min"); if (max) p.set("max", max); else p.delete("max"); }); }}>
          <input value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder={`Rs ${Math.floor(facets.priceMin / 100)}`} className="h-9 w-full border border-line bg-white px-2 text-[13px] outline-none focus:border-ink" aria-label={t("f.min")} />
          <span className="text-muted">–</span>
          <input value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder={`Rs ${Math.ceil(facets.priceMax / 100)}`} className="h-9 w-full border border-line bg-white px-2 text-[13px] outline-none focus:border-ink" aria-label={t("f.max")} />
          <button className="h-9 shrink-0 border border-ink px-3 text-[13px] font-medium hover:bg-ink hover:text-white">{t("f.go")}</button>
        </form>
      </Section>

      {facets.brands.length > 1 && (
        <Section title={t("f.brand")} count={filters.brands?.length}>
          <div className="space-y-2">
            {facets.brands.map((b) => {
              const on = filters.brands?.includes(b.name);
              return (
                <button key={b.name} onClick={() => update((p) => toggleList(p, "brand", b.name))} aria-pressed={on} className="flex w-full items-center gap-2.5 text-left text-[14px]">
                  <span className={cn("flex h-4 w-4 items-center justify-center border", on ? "border-ink bg-ink" : "border-line bg-white")}>{on && <Check className="h-3 w-3 text-white" strokeWidth={3} />}</span>
                  <span className="flex-1">{b.name}</span>
                  <span className="text-[12.5px] text-muted">{b.count}</span>
                </button>
              );
            })}
          </div>
        </Section>
      )}
    </div>
  );
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick} className={cn("relative h-5 w-9 rounded-full transition-colors", on ? "bg-ink" : "bg-line")}>
      <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all", on ? "left-[18px]" : "left-0.5")} />
    </button>
  );
}

function isLight(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return r * 0.299 + g * 0.587 + b * 0.114 > 170;
}

export function ActiveFilters({ filters }: { filters: ProductFilters }) {
  const { update } = useFilters();
  const { t } = useT();
  const chips: { label: string; remove: (p: URLSearchParams) => void }[] = [];
  filters.sizes?.forEach((s) => chips.push({ label: t("f.sizeChip", { s }), remove: (p) => toggleList(p, "size", s) }));
  filters.colors?.forEach((c) => chips.push({ label: c, remove: (p) => toggleList(p, "color", c) }));
  filters.brands?.forEach((b) => chips.push({ label: b, remove: (p) => toggleList(p, "brand", b) }));
  if (filters.minPrice || filters.maxPrice)
    chips.push({ label: `${filters.minPrice ? formatPrice(filters.minPrice) : "Rs. 0"} – ${filters.maxPrice ? formatPrice(filters.maxPrice) : t("f.any")}`, remove: (p) => { p.delete("min"); p.delete("max"); } });
  if (filters.sale) chips.push({ label: t("nav.onSale"), remove: (p) => p.delete("sale") });
  if (filters.inStock) chips.push({ label: t("f.inStockChip"), remove: (p) => p.delete("stock") });
  if (!chips.length) return null;
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <button key={c.label} onClick={() => update(c.remove)} className="flex items-center gap-1.5 bg-cloud px-3 py-1.5 text-[13px] hover:bg-line">
          {c.label} <X className="h-3.5 w-3.5" />
        </button>
      ))}
      <button onClick={() => update((p) => ["size", "color", "brand", "min", "max", "sale", "stock"].forEach((k) => p.delete(k)))} className="px-2 text-[13px] font-medium underline underline-offset-4">{t("f.clearAll")}</button>
    </div>
  );
}

export function SortSelect({ sorts, value }: { sorts: { id: string; label: string }[]; value: string }) {
  const { update } = useFilters();
  const { t } = useT();
  return (
    <label className="relative flex items-center">
      <span className="sr-only">{t("f.sortBy")}</span>
      <select value={value} onChange={(e) => update((p) => p.set("sort", e.target.value))} className="h-10 appearance-none border border-line bg-white pl-3 pr-9 text-[14px] outline-none hover:border-ink focus:border-ink">
        {sorts.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4" />
    </label>
  );
}

export function MobileFilterButton({ facets, filters, total }: { facets: Facets; filters: ProductFilters; total: number }) {
  const [open, setOpen] = useState(false);
  const { pending } = useFilters();
  const { t } = useT();
  const n = (filters.sizes?.length ?? 0) + (filters.colors?.length ?? 0) + (filters.brands?.length ?? 0) + (filters.minPrice || filters.maxPrice ? 1 : 0) + (filters.sale ? 1 : 0) + (filters.inStock ? 1 : 0);
  return (
    <>
      <button onClick={() => setOpen(true)} className="flex h-10 items-center gap-2 border border-line bg-white px-3 text-[14px] lg:hidden">
        <SlidersHorizontal className="h-4 w-4" /> {t("f.filter")}{n > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-[11px] text-white">{n}</span>}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} side="bottom" title={t("f.filter")} footer={<div className="p-4"><Button className="w-full" size="lg" loading={pending} onClick={() => setOpen(false)}>{t("f.show", { n: formatNumber(total) })}</Button></div>}>
        <div className="px-5"><FilterPanel facets={facets} filters={filters} /></div>
      </Sheet>
    </>
  );
}
