"use client";

import { useEffect, useState } from "react";
import { getForYou } from "@/actions/recommend";
import type { ProductCardData } from "@/lib/catalog";
import { ProductRail } from "./product-rail";

const KEY = "asson_recent"; // written by recently-viewed.tsx

/** "Recommended for you" from what this shopper viewed, saved and bought. Shows nothing until there's a history. */
export function ForYou({ title, eyebrow }: { title: string; eyebrow?: string }) {
  const [items, setItems] = useState<ProductCardData[]>([]);
  useEffect(() => {
    let recent: string[] = [];
    try { const v = JSON.parse(localStorage.getItem(KEY) ?? "[]"); if (Array.isArray(v)) recent = v.filter((x) => typeof x === "string").slice(0, 12); } catch {}
    let live = true;
    getForYou(recent).then((r) => { if (live) setItems(r); }).catch(() => {});
    return () => { live = false; };
  }, []);
  if (items.length < 4) return null; // a thin row looks unfinished
  return <ProductRail eyebrow={eyebrow} title={title} products={items} />;
}
