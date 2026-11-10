"use client";

import { createContext, useContext, useMemo } from "react";
import { localise, makeT, type Locale, type T } from "@/lib/i18n";

type Ctx = { locale: Locale; t: T; l: (text: string) => string };
const I18n = createContext<Ctx>({ locale: "en", t: makeT("en"), l: (s) => s });

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const value = useMemo<Ctx>(() => ({ locale, t: makeT(locale), l: (s) => localise(locale, s) }), [locale]);
  return <I18n.Provider value={value}>{children}</I18n.Provider>;
}

/** In client components: const { t, l } = useT(); t("key", vars), or l(englishText) for config/server text. */
export const useT = () => useContext(I18n);
