"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * The sticky header slides away while you scroll down a page and comes back the moment you scroll up, so phones
 * get the whole screen for products. It never hides near the top, or while something in it has focus (the
 * search box, a menu). `--header-offset` tells other sticky bars (filters, bag and checkout summaries) where
 * the header's edge is, so they move up with it.
 */
export function HeaderShell({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let last = window.scrollY, ticking = false;
    const update = () => {
      ticking = false;
      const y = window.scrollY, dy = y - last;
      if (Math.abs(dy) < 6) return;
      last = y;
      const focused = ref.current?.contains(document.activeElement) && document.activeElement !== document.body;
      setHidden(y > 160 && dy > 0 && !focused);
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty("--header-offset", hidden ? "0px" : "4rem");
  }, [hidden]);

  return (
    <header
      ref={ref}
      onFocusCapture={() => setHidden(false)}
      className={cn(
        "sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/85 motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-[cubic-bezier(0.2,0.8,0.2,1)]",
        hidden && "-translate-y-full",
      )}
    >
      {children}
    </header>
  );
}
