"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { passwordScore } from "@/lib/sign-in-shared";
import { useT } from "@/components/site/i18n-provider";
import { cn } from "@/lib/utils";

/** A password box with show/hide, a Caps Lock warning, and (for new passwords) a strength meter. */
export function PasswordField({ id, label, value, onChange, meter = false, autoComplete = "current-password", autoFocus = false }: { id: string; label: string; value: string; onChange: (v: string) => void; meter?: boolean; autoComplete?: string; autoFocus?: boolean }) {
  const { t } = useT();
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  const score = passwordScore(value);
  const words = [t("pw.weak"), t("pw.weak"), t("pw.ok"), t("pw.good"), t("pw.strong")];
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-ink-soft">{label}</label>
      <div className="relative">
        <input
          id={id} type={show ? "text" : "password"} value={value} autoComplete={autoComplete} autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)}
          onKeyUp={(e) => setCaps(e.getModifierState?.("CapsLock") ?? false)}
          onBlur={() => setCaps(false)}
          aria-describedby={meter ? `${id}-hint` : undefined}
          className="h-12 w-full border border-line bg-white px-3.5 pr-12 text-[15px] outline-none transition-colors focus:border-ink"
        />
        <button type="button" onClick={() => setShow(!show)} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted hover:text-ink" aria-label={show ? t("pw.hide") : t("pw.show")} aria-pressed={show}>
          {show ? <EyeOff className="h-[18px] w-[18px]" strokeWidth={1.7} /> : <Eye className="h-[18px] w-[18px]" strokeWidth={1.7} />}
        </button>
      </div>
      {caps && <p className="mt-1.5 text-[12.5px] font-medium text-warn">{t("pw.caps")}</p>}
      {meter && (
        <div id={`${id}-hint`} className="mt-2">
          <div className="flex gap-1" aria-hidden>{[1, 2, 3, 4].map((i) => <span key={i} className={cn("h-1 flex-1 transition-colors", value && score >= i ? (score <= 1 ? "bg-danger" : score === 2 ? "bg-warn" : "bg-success") : "bg-line")} />)}</div>
          <p className="mt-1 text-[12.5px] text-muted">{value ? `${words[score]} · ` : ""}{t("auth.passwordHint")}</p>
        </div>
      )}
    </div>
  );
}
