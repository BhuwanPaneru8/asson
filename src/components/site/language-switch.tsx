"use client";

import { useTransition } from "react";
import { setLocale } from "@/actions/locale";
import { useT } from "./i18n-provider";
import { cn } from "@/lib/utils";

/** "नेपाली | English": each label in its own language, so anyone can find theirs. */
export function LanguageSwitch({ className }: { className?: string }) {
  const { locale } = useT();
  const [pending, start] = useTransition();
  return (
    <div className={cn("flex items-center gap-1 text-[13px]", pending && "opacity-60", className)} role="group" aria-label="Language / भाषा">
      {(["ne", "en"] as const).map((l, i) => (
        <span key={l} className="flex items-center gap-1">
          {i > 0 && <span className="text-muted" aria-hidden>|</span>}
          <button type="button" lang={l} aria-pressed={locale === l} onClick={() => locale !== l && start(() => setLocale(l))} className={cn("px-1 py-0.5", locale === l ? "font-semibold" : "text-muted underline-offset-4 hover:underline")}>
            {l === "ne" ? "नेपाली" : "English"}
          </button>
        </span>
      ))}
    </div>
  );
}
