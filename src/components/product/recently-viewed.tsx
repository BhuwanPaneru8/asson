"use client";

import { useEffect, useState } from "react";
import { getRecentlyViewed } from "@/actions/recent";
import type { ProductCardData } from "@/lib/catalog";
import { ProductRail } from "./product-rail";
import { useT } from "@/components/site/i18n-provider";

const KEY = "asson_recent";
const MAX = 12;

function read(): string[] {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? "[]"); return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []; } catch { return []; }
}

/** Remembers products this shopper opened (on this device only) and shows them as a rail. */
export function RecentlyViewed({ currentId, title }: { currentId?: string; title?: string }) {
  const { t } = useT();
  const [items, setItems] = useState<ProductCardData[]>([]);
  useEffect(() => {
    const prev = read();
    if (currentId) {
      try { localStorage.setItem(KEY, JSON.stringify([currentId, ...prev.filter((i) => i !== currentId)].slice(0, MAX))); } catch {}
    }
    const show = prev.filter((i) => i !== currentId).slice(0, 8);
    if (!show.length) return;
    let live = true;
    getRecentlyViewed(show).then((r) => { if (live) setItems(r); }).catch(() => {});
    return () => { live = false; };
  }, [currentId]);
  return <ProductRail title={title ?? t("rail.recent")} products={items} />;
}
