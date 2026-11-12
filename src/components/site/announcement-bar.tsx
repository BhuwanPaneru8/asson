"use client";

import { useEffect, useState } from "react";

/** Phones have room for one promise at a time: they take turns every few seconds (paused for reduced motion).
 * Wider screens show them all side by side. */
export function AnnouncementBar({ messages }: { messages: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (messages.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setI((n) => (n + 1) % messages.length), 4500);
    return () => clearInterval(id);
  }, [messages.length]);
  return (
    <>
      <p className="relative h-5 w-full overflow-hidden text-center md:hidden" aria-live="off">
        {messages.map((m, n) => (
          <span key={m} className={`absolute inset-0 transition-all duration-500 ${n === i ? "translate-y-0 opacity-100" : n === (i - 1 + messages.length) % messages.length ? "-translate-y-full opacity-0" : "translate-y-full opacity-0"}`} aria-hidden={n !== i}>{m}</span>
        ))}
      </p>
      <p className="hidden items-center gap-6 md:flex">
        {messages.map((m, n) => <span key={m} className="flex items-center gap-6">{n > 0 && <span className="text-white/40" aria-hidden>·</span>}{m}</span>)}
      </p>
    </>
  );
}
