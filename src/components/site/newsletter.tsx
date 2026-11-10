"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useT } from "./i18n-provider";

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const { t } = useT();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!/^\S+@\S+\.\S+$/.test(email)) return toast.error(t("news.invalid"));
        // Hook up to your ESP (Klaviyo, Mailchimp, etc.) in an API route.
        toast.success(t("news.done"));
        setEmail("");
      }}
      className="flex max-w-sm"
    >
      <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder={t("news.placeholder")} aria-label={t("news.label")} className="h-11 flex-1 border border-r-0 border-line bg-white px-3 text-[14.5px] outline-none focus:border-ink" />
      <button className="h-11 bg-ink px-4 text-[13.5px] font-medium text-white hover:bg-ink-soft">{t("news.subscribe")}</button>
    </form>
  );
}
