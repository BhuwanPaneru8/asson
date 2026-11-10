"use server";

import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { LOCALE_COOKIE, type Locale } from "@/lib/i18n";

/** Remember the shopper's language for a year. */
export async function setLocale(locale: Locale) {
  if (locale !== "en" && locale !== "ne") return;
  (await cookies()).set(LOCALE_COOKIE, locale, { maxAge: 365 * 86_400, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" });
  refresh();
}
