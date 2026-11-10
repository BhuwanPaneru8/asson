"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search, X, Clock, TrendingUp, ArrowUpRight } from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";
import { useT } from "./i18n-provider";

type Suggest = {
  products: { name: string; slug: string; brand: string; price: number; compareAtPrice: number | null; image: string | null }[];
  categories: { name: string; slug: string; parent: string | null }[];
};

const POPULAR = ["Linen shirt", "Jeans", "Kurta", "Hoodie", "Dresses", "Oversized tee"];
const RECENT_KEY = "tl_recent_searches";

function loadRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]").slice(0, 5); } catch { return []; }
}
function saveRecent(q: string) {
  try {
    const list = [q, ...loadRecent().filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch { /* storage unavailable */ }
}

export function SearchBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [result, setResult] = useState<{ term: string; data: Suggest } | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) { setLastPath(pathname); setOpen(false); }
  const openSearch = () => { setRecent(loadRecent()); setOpen(true); };
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 10); }, [open]);

  // debounced, cancellable suggestions
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        setResult({ term, data: await res.json() });
        setActive(-1);
      } catch { /* aborted */ }
    }, 160);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);

  // close on outside click / Escape; "/" shortcut to open
  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (open && boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "/" && !open && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) { e.preventDefault(); setRecent(loadRecent()); setOpen(true); }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const go = (term: string) => {
    const t = term.trim();
    if (!t) return;
    saveRecent(t);
    setOpen(false);
    router.push(`/shop?q=${encodeURIComponent(t)}`);
  };

  const term = q.trim();
  const data = term.length >= 2 && result ? result.data : null;
  const loading = term.length >= 2 && result?.term !== term;
  const items = data?.products ?? [];
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, -1)); }
    if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0 && items[active]) { saveRecent(q.trim()); setOpen(false); router.push(`/p/${items[active].slug}`); }
      else go(q);
    }
  };

  return (
    <div ref={boxRef} className="lg:relative">
      <button
        onClick={openSearch}
        className="flex h-10 items-center gap-2 px-2.5 text-muted hover:bg-cloud lg:w-64 lg:border lg:border-line lg:bg-white lg:px-3 lg:hover:border-ink-soft lg:hover:bg-white"
        aria-label={t("search.open")}
      >
        <Search className="h-[19px] w-[19px] text-ink lg:h-4 lg:w-4 lg:text-muted" strokeWidth={1.8} />
        <span className="hidden text-[14px] lg:inline">{t("search.placeholderShort")}</span>
        <kbd className="ml-auto hidden border border-line px-1.5 text-[11px] lg:inline">/</kbd>
      </button>

      {open && (
        <div className="fixed inset-x-0 top-0 z-50 border-b border-line bg-paper shadow-xl animate-fade-in lg:absolute lg:inset-x-auto lg:right-0 lg:top-[-12px] lg:w-[560px] lg:border">
          <div className="flex h-16 items-center gap-3 border-b border-line px-4">
            <Search className="h-5 w-5 shrink-0 text-muted" strokeWidth={1.8} />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={t("search.placeholder")}
              className="h-full flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted/70"
              aria-label={t("search.label")}
              role="combobox"
              aria-expanded={!!data}
              aria-controls="search-results"
              autoComplete="off"
              enterKeyHint="search"
            />
            {q && <button onClick={() => { setQ(""); inputRef.current?.focus(); }} className="p-1 text-muted hover:text-ink" aria-label={t("search.clear")}><X className="h-4 w-4" /></button>}
            <button onClick={() => setOpen(false)} className="text-[13px] font-medium text-muted hover:text-ink lg:hidden">{t("search.cancel")}</button>
          </div>

          <div id="search-results" className="max-h-[70vh] overflow-y-auto">
            {q.trim().length < 2 ? (
              <div className="space-y-6 p-5">
                {recent.length > 0 && (
                  <div>
                    <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">{t("search.recent")}</p>
                    <ul>{recent.map((r) => <li key={r}><button onClick={() => go(r)} className="flex w-full items-center gap-3 py-2 text-left text-[15px] hover:text-accent"><Clock className="h-4 w-4 text-muted" />{r}</button></li>)}</ul>
                  </div>
                )}
                <div>
                  <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">{t("search.popular")}</p>
                  <div className="flex flex-wrap gap-2">
                    {POPULAR.map((p) => <button key={p} onClick={() => go(p)} className="flex items-center gap-1.5 border border-line bg-white px-3 py-1.5 text-[14px] hover:border-ink"><TrendingUp className="h-3.5 w-3.5 text-muted" />{p}</button>)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-2">
                {data?.categories.length ? (
                  <div className="border-b border-line px-3 pb-3 pt-2">
                    {data.categories.map((c) => (
                      <Link key={c.slug} href={`/c/${c.slug}`} onClick={() => setOpen(false)} className="flex items-center justify-between py-1.5 text-[15px] hover:text-accent">
                        <span>{c.parent ? <span className="text-muted">{c.parent} / </span> : null}{c.name}</span>
                        <ArrowUpRight className="h-4 w-4 text-muted" />
                      </Link>
                    ))}
                  </div>
                ) : null}
                {items.length > 0 ? (
                  <ul className="py-1">
                    {items.map((p, i) => (
                      <li key={p.slug}>
                        <Link href={`/p/${p.slug}`} onClick={() => { saveRecent(q.trim()); setOpen(false); }} className={cn("flex items-center gap-3 px-3 py-2 hover:bg-cloud", active === i && "bg-cloud")}>
                          <div className="relative h-14 w-11 shrink-0 overflow-hidden bg-cloud">{p.image && <Image src={p.image} alt="" fill sizes="44px" className="object-cover" />}</div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[14.5px] font-medium">{p.name}</p>
                            <p className="text-[12.5px] text-muted">{p.brand}</p>
                          </div>
                          <span className="text-[14px] font-medium">{formatPrice(p.price)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : !loading && data ? (
                  <p className="px-3 py-8 text-center text-muted">{t("search.noMatches", { q: q.trim() })}</p>
                ) : (
                  <p className="px-3 py-8 text-center text-muted">{t("search.searching")}</p>
                )}
                {items.length > 0 && (
                  <button onClick={() => go(q)} className="w-full border-t border-line px-3 py-3 text-left text-[14px] font-medium hover:text-accent">
                    {t("search.seeAll", { q: q.trim() })}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
