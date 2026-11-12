"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, X, Clock, TrendingUp, ArrowUpRight, ArrowUpLeft } from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";
import { addRecent } from "@/lib/search-intent";
import { useT } from "./i18n-provider";
import { pick } from "@/lib/i18n";

type Suggest = {
  products: { name: string; nameNe: string | null; slug: string; brand: string; price: number; compareAtPrice: number | null; image: string | null }[];
  categories: { name: string; nameNe: string | null; slug: string; parent: string | null; parentNe: string | null }[];
  /** ways to finish what's being typed, with where the typed letters sit (the rest is shown bold) */
  completions?: { text: string; match: [number, number] | null }[];
  /** the query as understood ("blue shirt, under Rs 2,000"), when it differs from what was typed */
  understood?: string | null;
  relaxed?: boolean;
};

// shown until the shop's own trending searches arrive (see lib/search-stats.ts)
const STARTER = ["Linen shirt", "Jeans", "Kurta", "Hoodie", "Oversized tee", "Jacket"];
const RECENT_KEY = "tl_recent_searches";

function loadRecent(): string[] {
  try { const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]"); return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 8) : []; } catch { return []; }
}
function storeRecent(list: string[]) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch { /* storage unavailable */ }
}

/** The search box in the header. On the results page it shows, and reopens with, what was searched. */
export function SearchBarWithQuery() {
  const params = useSearchParams();
  const pathname = usePathname();
  return <SearchBar current={pathname === "/shop" ? params.get("q") ?? "" : ""} />;
}

export function SearchBar({ current = "" }: { current?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t, locale } = useT();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [result, setResult] = useState<{ term: string; data: Suggest } | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [trending, setTrending] = useState<string[]>(STARTER);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // desktop: the panel lines up with the search button's right edge (it's rendered in <body>, see below)
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null);

  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) { setLastPath(pathname); setOpen(false); }

  // arriving on results from anywhere (a link, the back button) counts as a recent search too
  useEffect(() => { if (current.trim()) storeRecent(addRecent(loadRecent(), current)); }, [current]);

  const openSearch = () => {
    const r = boxRef.current?.getBoundingClientRect();
    if (r) setAnchor({ top: Math.max(8, r.top - 12), right: Math.max(8, window.innerWidth - r.right) });
    setRecent(loadRecent());
    // reopening on the results page: the search is there to refine or retype (it's selected, so typing replaces it)
    setQ(current);
    setActive(-1);
    setOpen(true);
  };

  // what shoppers search most, fetched once when the box first opens
  const fetchedTrending = useRef(false);
  useEffect(() => {
    if (!open || fetchedTrending.current) return;
    fetchedTrending.current = true;
    fetch("/api/search/suggest?q=").then((r) => r.json()).then((d: { trending?: string[] }) => { if (d.trending?.length) setTrending(d.trending); }).catch(() => {});
  }, [open]);

  // phones: the box covers the screen, so the page behind shouldn't scroll
  useEffect(() => {
    if (!open || window.matchMedia("(min-width: 1024px)").matches) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // debounced, cancellable suggestions (from the first letter: completions; from two: products too)
  useEffect(() => {
    const term = q.trim();
    if (!open || term.length < 1) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        setResult({ term, data: await res.json() });
        setActive(-1);
      } catch { /* aborted */ }
    }, term.length === 1 ? 60 : 140);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [q, open]);

  // close on outside click / Escape; "/" shortcut to open
  const openRef = useRef(openSearch);
  useEffect(() => { openRef.current = openSearch; });
  useEffect(() => {
    const onDown = (e: MouseEvent) => { const n = e.target as Node; if (open && !boxRef.current?.contains(n) && !panelRef.current?.contains(n)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "/" && !open && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) { e.preventDefault(); openRef.current(); }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const remember = (term: string) => storeRecent(addRecent(loadRecent(), term));
  const go = (term: string) => {
    const s = term.trim();
    if (!s) return;
    remember(s);
    setOpen(false);
    router.push(`/shop?q=${encodeURIComponent(s)}`);
  };
  const forget = (term: string) => { const next = recent.filter((r) => r !== term); setRecent(next); storeRecent(next); inputRef.current?.focus(); };
  const forgetAll = () => { setRecent([]); storeRecent([]); inputRef.current?.focus(); };
  /** put a suggestion in the box to keep typing, without searching yet */
  const fill = (text: string) => { setQ(`${text} `); inputRef.current?.focus(); };

  const term = q.trim();
  const data = term.length >= 1 && result ? result.data : null;
  const loading = term.length >= 1 && result?.term !== term;
  const completions = data?.completions ?? [];
  const products = term.length >= 2 ? data?.products ?? [] : [];
  // one list for the arrow keys: completions first, then products
  const options = [...completions.map((c) => ({ kind: "q" as const, text: c.text })), ...products.map((p) => ({ kind: "p" as const, text: p.slug }))];
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, options.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, -1)); }
    else if (e.key === "Tab" && active >= 0 && options[active]?.kind === "q") { e.preventDefault(); fill(options[active].text); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const o = options[active];
      if (o?.kind === "p") { remember(term); setOpen(false); router.push(`/p/${o.text}`); }
      else go(o?.kind === "q" ? o.text : q);
    }
  };
  const optId = (i: number) => `search-opt-${i}`;
  const heading = "mb-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-muted";

  return (
    <div ref={boxRef} className="lg:relative">
      <button
        onClick={openSearch}
        className="flex h-10 items-center gap-2 px-2.5 text-muted hover:bg-cloud lg:w-64 lg:border lg:border-line lg:bg-white lg:px-3 lg:hover:border-ink-soft lg:hover:bg-white"
        aria-label={current ? `${t("search.open")}: ${current}` : t("search.open")}
      >
        <Search className="h-[19px] w-[19px] text-ink lg:h-4 lg:w-4 lg:text-muted" strokeWidth={1.8} />
        {current ? <span className="hidden min-w-0 truncate text-[14px] text-ink lg:inline">{current}</span> : <span className="hidden text-[14px] lg:inline">{t("search.placeholderShort")}</span>}
        <kbd className="ml-auto hidden border border-line px-1.5 text-[11px] lg:inline">/</kbd>
      </button>

      {/* rendered into <body>: the sticky header (blur, slide) would otherwise become the box `fixed` is measured
          from and squeeze the panel into its 64px strip (Memory gotcha 30r) */}
      {open && createPortal(<>
        <div className="fixed inset-0 z-[55] hidden bg-black/20 animate-fade-in lg:block" aria-hidden onClick={() => setOpen(false)} />
        <div ref={panelRef} style={anchor ? ({ "--top": `${anchor.top}px`, "--right": `${anchor.right}px` } as React.CSSProperties) : undefined} className="fixed inset-0 z-[56] flex flex-col bg-paper animate-fade-in lg:inset-auto lg:right-[var(--right,2rem)] lg:top-[var(--top,0.75rem)] lg:w-[620px] lg:border lg:border-line lg:shadow-xl">
          <div className="flex h-16 shrink-0 items-center gap-3 border-b border-line px-4">
            <Search className="h-5 w-5 shrink-0 text-muted" strokeWidth={1.8} />
            <input
              ref={inputRef}
              // focused as it appears, so the first letters typed after a tap aren't lost; a reopened search is
              // selected, so typing replaces it and the arrow keys edit it
              autoFocus
              onFocus={(e) => { if (e.currentTarget.value) e.currentTarget.select(); }}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={t("search.placeholder")}
              className="h-full min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted"
              aria-label={t("search.label")}
              role="combobox"
              aria-expanded={options.length > 0}
              aria-controls="search-results"
              aria-autocomplete="list"
              aria-activedescendant={active >= 0 ? optId(active) : undefined}
              autoComplete="off"
              enterKeyHint="search"
            />
            {q && <button onClick={() => { setQ(""); inputRef.current?.focus(); }} className="p-1 text-muted hover:text-ink" aria-label={t("search.clear")}><X className="h-4 w-4" /></button>}
            <button onClick={() => setOpen(false)} className="text-[13px] font-medium text-muted hover:text-ink lg:hidden">{t("search.cancel")}</button>
          </div>

          <div id="search-results" role="listbox" aria-label={t("search.label")} className="flex-1 overflow-y-auto overscroll-contain lg:max-h-[72vh] lg:flex-none">
            {term.length < 1 ? (
              <div className="space-y-6 p-5">
                {recent.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between"><p className={heading}>{t("search.recent")}</p><button onClick={forgetAll} className="mb-2 text-[12.5px] text-muted underline-offset-4 hover:text-ink hover:underline">{t("search.clearRecent")}</button></div>
                    <ul>{recent.map((r) => (
                      <li key={r} className="group flex items-center">
                        <button onClick={() => go(r)} className="flex min-w-0 flex-1 items-center gap-3 py-2 text-left text-[15px] hover:text-accent"><Clock className="h-4 w-4 shrink-0 text-muted" /><span className="truncate">{r}</span></button>
                        <button onClick={() => forget(r)} className="p-2 text-muted opacity-60 hover:text-ink group-hover:opacity-100" aria-label={t("search.removeRecent", { q: r })}><X className="h-3.5 w-3.5" /></button>
                      </li>
                    ))}</ul>
                  </div>
                )}
                <div>
                  <p className={cn(heading, "mb-3")}>{t("search.trending")}</p>
                  <div className="flex flex-wrap gap-2">
                    {trending.map((p) => <button key={p} onClick={() => go(p)} className="flex items-center gap-1.5 border border-line bg-white px-3 py-1.5 text-[14px] transition-colors hover:border-ink"><TrendingUp className="h-3.5 w-3.5 text-muted" />{p}</button>)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-2">
                {completions.length > 0 && (
                  <ul className="border-b border-line pb-1" aria-label={t("search.suggestions")}>
                    {completions.map((c, i) => (
                      <li key={c.text} id={optId(i)} role="option" aria-selected={active === i} className={cn("flex items-center", active === i && "bg-cloud")}>
                        <button onClick={() => go(c.text)} className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left text-[15px] hover:bg-cloud">
                          <Search className="h-4 w-4 shrink-0 text-muted" strokeWidth={1.8} />
                          <span className="truncate">{c.match ? <><b className="font-semibold">{c.text.slice(0, c.match[0])}</b>{c.text.slice(c.match[0], c.match[1])}<b className="font-semibold">{c.text.slice(c.match[1])}</b></> : <b className="font-semibold">{c.text}</b>}</span>
                        </button>
                        <button onClick={() => fill(c.text)} className="p-2.5 text-muted hover:text-ink" aria-label={t("search.useSuggestion", { q: c.text })} tabIndex={-1}><ArrowUpLeft className="h-4 w-4" /></button>
                      </li>
                    ))}
                  </ul>
                )}
                {term.length >= 2 && data?.understood && products.length > 0 && (
                  <p className="px-3 pb-1 pt-3 text-[13px] text-muted">{data.relaxed ? t("search.relaxed", { q: term }) : t("search.understood", { q: data.understood })}</p>
                )}
                {term.length >= 2 && data?.categories.length ? (
                  <div className="border-b border-line px-3 pb-3 pt-2">
                    <p className="mb-1 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-muted">{t("search.categories")}</p>
                    {data.categories.map((c) => (
                      <Link key={c.slug} href={`/c/${c.slug}`} onClick={() => setOpen(false)} className="flex items-center justify-between py-1.5 text-[15px] hover:text-accent">
                        <span>{c.parent ? <span className="text-muted">{pick(locale, c.parent, c.parentNe)} / </span> : null}{pick(locale, c.name, c.nameNe)}</span>
                        <ArrowUpRight className="h-4 w-4 text-muted" />
                      </Link>
                    ))}
                  </div>
                ) : null}
                {products.length > 0 ? (
                  <ul className="py-1" aria-label={t("search.products")}>
                    {products.map((p, i) => {
                      const n = completions.length + i;
                      return (
                        <li key={p.slug} id={optId(n)} role="option" aria-selected={active === n}>
                          <Link href={`/p/${p.slug}`} onClick={() => { remember(term); setOpen(false); }} className={cn("flex items-center gap-3 px-3 py-2 hover:bg-cloud", active === n && "bg-cloud")}>
                            <div className="relative h-14 w-11 shrink-0 overflow-hidden bg-cloud">{p.image && <Image src={p.image} alt="" fill sizes="44px" className="object-cover" />}</div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[14.5px] font-medium">{pick(locale, p.name, p.nameNe)}</p>
                              <p className="text-[12.5px] text-muted">{p.brand}</p>
                            </div>
                            <span className="text-right text-[14px] font-medium tabular-nums">{formatPrice(p.price)}{p.compareAtPrice && p.compareAtPrice > p.price ? <span className="block text-[12px] font-normal text-muted line-through">{formatPrice(p.compareAtPrice)}</span> : null}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : term.length >= 2 && !loading && data && !completions.length ? (
                  <div className="px-3 py-8 text-center">
                    <p className="text-muted">{t("search.noMatches", { q: term })}</p>
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      {trending.slice(0, 4).map((p) => <button key={p} onClick={() => setQ(p)} className="border border-line bg-white px-3 py-1.5 text-[14px] hover:border-ink">{p}</button>)}
                    </div>
                  </div>
                ) : loading && !completions.length ? (
                  <p className="px-3 py-8 text-center text-muted">{t("search.searching")}</p>
                ) : null}
                {term.length >= 2 && (
                  <button onClick={() => go(q)} className="w-full border-t border-line px-3 py-3 text-left text-[14px] font-medium hover:text-accent">
                    {t("search.seeAll", { q: term })}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </>, document.body)}
    </div>
  );
}
