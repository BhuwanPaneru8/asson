import { store } from "../config";
import "server-only";
import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, localise, makeT, type Locale } from "./index";

/** The shopper's language: their choice (cookie), else Nepali if their browser asks for it first, else English. */
export async function getLocale(): Promise<Locale> {
  if (!store.nepaliShop) return "en"; // the Nepali shop is switched off: English for everyone (config.ts)
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (chosen === "ne" || chosen === "en") return chosen;
  const accept = (await headers()).get("accept-language") ?? "";
  return /^\s*ne\b/i.test(accept) ? "ne" : "en";
}

export async function getT() {
  const locale = await getLocale();
  return { locale, t: makeT(locale) };
}

/** Translate an action's English result for the shopper: error, message and per-field errors. */
export async function localiseResult<R>(result: R): Promise<R> {
  if (!result || typeof result !== "object") return result;
  const locale = await getLocale();
  if (locale === "en") return result;
  const r = { ...(result as Record<string, unknown>) };
  for (const k of ["error", "message"]) if (typeof r[k] === "string") r[k] = localise(locale, r[k] as string);
  if (r.fieldErrors && typeof r.fieldErrors === "object") r.fieldErrors = Object.fromEntries(Object.entries(r.fieldErrors as Record<string, string>).map(([f, m]) => [f, localise(locale, m)]));
  return r as R;
}
