"use client";

import { ArrowUp } from "lucide-react";

export function BackToTop({ label }: { label: string }) {
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })}
      className="inline-flex min-h-6 items-center gap-1 hover:text-ink"
    >
      <ArrowUp className="h-3.5 w-3.5" strokeWidth={1.8} /> {label}
    </button>
  );
}
