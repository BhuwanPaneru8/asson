import { en } from "./en";
import { ne } from "./ne";

// Storefront languages. English is the source; Nepali must translate every key (`ne` is typed against
// `en`, so a missing translation is a build error and a Nepali page can never show a raw key).
// Client-safe: no server imports here.

export type Locale = "en" | "ne";
export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;
export const LOCALES: Locale[] = ["en", "ne"];
export const LOCALE_COOKIE = "asson_lang";
export const DICTIONARIES: Record<Locale, Messages> = { en, ne };

export type Vars = Record<string, string | number>;

/** "Only {n} left" + { n: 2 } → "Only 2 left". Placeholders without a value are left as they are. */
export function translate(messages: Messages, key: MessageKey, vars?: Vars) {
  const s = messages[key] ?? en[key] ?? key;
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : s;
}

export type T = (key: MessageKey, vars?: Vars) => string;
export const makeT = (locale: Locale): T => (key, vars) => translate(DICTIONARIES[locale], key, vars);

// English message → its key and values, so text produced in English (server actions, zod messages, config
// defaults) can be shown in the shopper's language without each caller knowing about languages.
// Longest templates are tried first, so a specific message never matches a looser one.
const escape = (s: string) => s.replace(/[.*+?^$()|[\]\\]/g, "\\$&");
let patterns: { key: MessageKey; re: RegExp; names: string[] }[] | null = null;
function compiled() {
  return (patterns ??= (Object.keys(en) as MessageKey[])
    .map((key) => {
      const src = en[key];
      const names = [...src.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
      const re = new RegExp(`^${src.split(/\{\w+\}/).map((part) => escape(part)).join("(.+?)")}$`);
      return { key, re, names, literal: src.replace(/\{\w+\}/g, "").length };
    })
    .filter((p) => p.literal >= 4 || !p.names.length)
    .sort((a, b) => b.literal - a.literal));
}

/** The shopper-language version of an English storefront message; unknown text comes back unchanged. */
export function localise(locale: Locale, text: string): string;
export function localise(locale: Locale, text: string | undefined): string | undefined;
export function localise(locale: Locale, text: string | undefined) {
  if (locale === "en" || !text) return text;
  for (const p of compiled()) {
    const m = p.re.exec(text);
    if (m) return translate(DICTIONARIES[locale], p.key, Object.fromEntries(p.names.map((n, i) => [n, m[i + 1]])));
  }
  return text;
}

/** Standard delivery time in words: "3–5 days" / "3–5 दिन". (Express shows its configured promise: l(store.shipping.express.eta).) */
export function etaText(t: T, rate: { etaMinDays: number; etaMaxDays: number }) {
  if (rate.etaMinDays === rate.etaMaxDays) return t(rate.etaMinDays === 1 ? "ship.day1" : "ship.days", { n: rate.etaMinDays });
  return t("ship.daysRange", { a: rate.etaMinDays, b: rate.etaMaxDays });
}
