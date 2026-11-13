"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * A thin bar across the top while the next page loads, so every tap visibly does something. It starts on a
 * click on a link to another page on this site and finishes when the address changes. Quick pages never show
 * it (it waits 120 ms), and it gives up after 10 s rather than hang.
 */
export function NavProgress() {
  const pathname = usePathname();
  const params = useSearchParams();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  // the address changed: the page has arrived
  const key = `${pathname}?${params.toString()}`;
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) { setLastKey(key); if (state === "loading") setState("done"); }

  useEffect(() => {
    if (state !== "done") return;
    clear();
    timers.current.push(setTimeout(() => setState("idle"), 300));
  }, [state]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element).closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
      clear();
      timers.current.push(setTimeout(() => setState("loading"), 120), setTimeout(() => setState("idle"), 10_000));
    };
    document.addEventListener("click", onClick, true);
    return () => { document.removeEventListener("click", onClick, true); clear(); };
  }, []);

  if (state === "idle") return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5" role="progressbar" aria-label="Loading page" aria-busy={state === "loading"}>
      <div className={`h-full bg-accent ${state === "loading" ? "nav-progress-run" : "w-full opacity-0 transition-opacity duration-300"}`} />
    </div>
  );
}
